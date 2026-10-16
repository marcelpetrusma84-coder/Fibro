# proef57: stickers als widget op Home (v157), met de echte profiel.html, index.html en vriend-profiel.html.
# A. Profiel -> Stickers: volgorde 'Je eigen chatstickers', 'Stickervel 1', 'Actieve stickers'; vel 1 = 12 stickers
#    met elk een knopje (role=switch, uit); in het Stickerlab alleen een knopje onder een gevulde plek; tik op een
#    sticker van vel 1 = beweging en geluid; knopjes aan + Opslaan = in de widget-indeling (1 x 1, zonder kop),
#    de andere widgets blijven; na verversen nog aan; uit + Opslaan = weg; eigen sticker verwijderen = van Home af.
#    Niet breder dan de telefoon.
# B. Home: de stickers staan bij 'Jouw profiel', 1 kolom breed, met hun plaatje; een weggegooide eigen sticker
#    staat er niet; tik en Enter = beweging en geluid (en tijdens de beweging boven de buren); ingedrukt houden en
#    slepen = andere volgorde (bewaard) zonder af te spelen. Engels.
# C. Profiel van een vriend: sticker van Fibro, eigen sticker van de vriend, en een zandloper voor een eigen
#    sticker die nog niet binnen is; komt hij binnen (sync), dan verschijnt hij vanzelf. Tik = afspelen.
# Oude map als controle: daar bestaat dit niet (bijna alles MIS).
# python3 -I proef57.py <map>     (FOTO=<map> maakt schermafbeeldingen)
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
VEL1 = ['Tranen van het lachen', 'Ssst', 'Slaap lekker', 'Kapot', 'Huilen', 'Verliefd', 'Boos', 'Geschrokken', 'Offline', 'Druk', 'Spookje', 'Sluw']
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))

def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        if FID in u:
            v = {"id": FID, "username": "flamingo", "avatar_url": "\U0001F9A9", "online_status": True, "toon_online": True, "public_key": None}
            return route.fulfill(status=200, json=v if obj else [v])
        e = {"id": UID, "username": "marcel"}
        return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    if m in ('POST', 'PATCH'): return route.fulfill(status=200, json=[])
    return route.fulfill(status=200, json=[])

TELLER = """
(() => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
  window.__fxosc = 0
  const comp = AC.prototype.createDynamicsCompressor, start = AudioScheduledSourceNode.prototype.start
  AC.prototype.createDynamicsCompressor = function () { this.__fx = true; return comp.apply(this, arguments) }
  AudioScheduledSourceNode.prototype.start = function () {
    if (this.context && this.context.__fx && !(this.buffer && this.buffer.length <= 1)) window.__fxosc++
    return start.apply(this, arguments) }
})()
"""
# een plaatje als data-URL (zoals een eigen sticker op het toestel staat) en in de toesteldatabase zetten
ZET = """async ([id, src, rest]) => {
  const blob = await (await fetch(src)).blob()
  const data = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob) })
  const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
    r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
    r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  await new Promise(ok => { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put(Object.assign({ id, data }, rest)); tx.oncomplete = ok })
  return data.slice(0, 16) }"""
ZET_TEKST = """async ([id, data]) => {
  const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
    r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
    r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  await new Promise(ok => { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id, data }); tx.oncomplete = ok }) }"""
SPEELT = "sel => { const i = document.querySelector(sel); return !!(i && i.getAnimations().length) }"

www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    def ev(p, js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:120]
    def nieuw_ctx(taal='nl'):
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(TELLER)
        p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:200]))
        p.on('dialog', lambda d: d.dismiss())
        p.goto(BASIS + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
        return ctx, p
    LAYOUT = "u => { try { return JSON.parse(localStorage.getItem('fibro_widgets_profiel_' + u) || 'null') } catch (e) { return 'kapot' } }"
    SCHAKEL = "c => { const k = document.querySelector('#panel-stickers [role=switch][data-widget=\"sticker_' + c + '\"]'); return k ? k.getAttribute('aria-checked') : null }"
    KLIK = "c => document.querySelector('#panel-stickers [role=switch][data-widget=\"sticker_' + c + '\"]').click()"

    # ── A. Profiel ──
    print('A. Profiel -> Stickers')
    ctx, p = nieuw_ctx()
    ev(p, "u => localStorage.setItem('fibro_profiel_' + u, JSON.stringify({ naam: 'Marcel', widgets: ['gastenboek', 'mood'] }))", UID)
    ev(p, ZET, ['eigensticker_' + UID + '_e1-01', 'stickers/f1/03.webp', {'b': 'stuiter', 'g': 'boing', 'naam': 'Blije kat', 'tijd': 1}])
    p.goto(BASIS + 'profiel.html'); p.wait_for_timeout(2500)
    ev(p, "() => switchTab('stickers')"); p.wait_for_timeout(600)
    labels = ev(p, "() => [...document.querySelectorAll('#panel-stickers .section-label')].map(l => l.textContent.trim()).slice(0, 3)")
    check('volgorde: eigen stickers, dan Stickervel 1, dan de emoji', labels == ['Je eigen chatstickers', 'Stickervel 1', 'Actieve stickers'], labels)
    vel = ev(p, """() => [...document.querySelectorAll('#fibroStickers .sw-cel')].map(c => { const b = c.querySelector('.sw-plek'), i = b && b.querySelector('img'), k = c.querySelector('[role=switch]');
      return [b && b.getAttribute('aria-label'), i && i.getAttribute('src'), k && k.getAttribute('aria-label'), k && k.getAttribute('aria-checked')] })""")
    check('vel 1: 12 stickers, elk met plaatje, naam en een knopje (uit)', isinstance(vel, list) and len(vel) == 12 and all(
        v == ['Speel sticker ' + n, 'stickers/f1/%02d.webp' % (i + 1), n + ' op Home', 'false'] for i, (v, n) in enumerate(zip(vel, VEL1))), vel[:2] if isinstance(vel, list) else vel)
    lab = ev(p, "() => [...document.querySelectorAll('#eigenStickers [role=switch]')].map(k => [k.getAttribute('aria-label'), k.getAttribute('data-widget')])")
    check('Stickerlab: alleen onder de gevulde plek een knopje', lab == [['Blije kat op Home', 'sticker_e1-01']], lab)
    check('Stickerlab: nog steeds 24 plekken', ev(p, "() => document.querySelectorAll('#eigenStickers .sm-plek').length") == 24, '')
    breed = ev(p, "() => [document.documentElement.scrollWidth, Math.round(document.querySelector('#fibroStickers .sw-plek').getBoundingClientRect().width)]")
    check('niet breder dan de telefoon, stickers groot genoeg', isinstance(breed, list) and breed[0] <= 390 and breed[1] >= 60, breed)
    if FOTO: p.screenshot(path=FOTO + '/a-profiel-stickers.png', full_page=False); ev(p, "() => document.getElementById('fibroStickers').scrollIntoView()"); p.screenshot(path=FOTO + '/a-vel1.png')
    voor = ev(p, "window.__fxosc || 0")
    ev(p, "() => document.querySelectorAll('#fibroStickers .sw-plek')[6].click()")
    beweegt = ev(p, SPEELT, '#fibroStickers .sw-cel:nth-child(7) img'); p.wait_for_timeout(300)
    check('tik op Boos in Profiel: beweging en geluid', beweegt is True and ev(p, "window.__fxosc || 0") > voor, (beweegt, voor))
    ev(p, KLIK, 'f1-07'); ev(p, KLIK, 'e1-01')
    check('knopjes gaan aan', ev(p, SCHAKEL, 'f1-07') == 'true' and ev(p, SCHAKEL, 'e1-01') == 'true', '')
    ev(p, "() => slaAllesOp()"); p.wait_for_timeout(1200)
    lay = ev(p, LAYOUT, UID)
    ids = [w.get('id') for w in lay] if isinstance(lay, list) else lay
    st = [w for w in lay if str(w.get('id', '')).startswith('sticker_')] if isinstance(lay, list) else []
    check('Opslaan: de stickers staan in de widget-indeling, de andere widgets ook', ids == ['gastenboek', 'mood', 'sticker_f1-07', 'sticker_e1-01'], ids)
    check('een stickerwidget is 1 x 1, zonder kop, aan', len(st) == 2 and all(w.get('w') == 1 and w.get('h') == 1 and w.get('geenHeader') is True and w.get('aan') is True for w in st), st)
    lok = ev(p, "u => JSON.parse(localStorage.getItem('fibro_profiel_' + u)).widgets", UID)
    check('ook in je bewaarde profiel', lok == ['gastenboek', 'mood', 'sticker_f1-07', 'sticker_e1-01'], lok)
    check('geen fouten (Profiel)', p.fouten == [], p.fouten)
    p.reload(); p.wait_for_timeout(2500); ev(p, "() => switchTab('stickers')"); p.wait_for_timeout(500)
    check('na verversen staan de knopjes nog aan (andere uit)', ev(p, SCHAKEL, 'f1-07') == 'true' and ev(p, SCHAKEL, 'e1-01') == 'true' and ev(p, SCHAKEL, 'f1-01') == 'false', '')
    ev(p, KLIK, 'f1-07'); ev(p, "() => slaAllesOp()"); p.wait_for_timeout(1000)
    ids = [w.get('id') for w in (ev(p, LAYOUT, UID) or [])]
    check('uit + Opslaan: weg uit de indeling', ids == ['gastenboek', 'mood', 'sticker_e1-01'], ids)
    # eigen sticker verwijderen: dan ook van Home af
    ev(p, "() => document.querySelector('#eigenStickers .sm-plek[data-code=\"e1-01\"]').click()"); p.wait_for_timeout(300)
    ev(p, "() => { const w = [...document.querySelectorAll('.sm-onder .sm-knop.wis')][0]; w.click(); w.click() }"); p.wait_for_timeout(700)
    weg = ev(p, "() => document.querySelectorAll('#eigenStickers [role=switch]').length")
    ev(p, "() => slaAllesOp()"); p.wait_for_timeout(1000)
    ids = [w.get('id') for w in (ev(p, LAYOUT, UID) or [])]
    check('eigen sticker verwijderd: geen knopje meer en van Home af', weg == 0 and ids == ['gastenboek', 'mood'], (weg, ids))
    check('geen fouten (Profiel, daarna)', p.fouten == [], p.fouten)
    ctx.close()

    # ── B. Home ──
    print('B. Home')
    def home(taal='nl', layout=None):
        ctx, p = nieuw_ctx(taal)
        ev(p, ZET, ['eigensticker_' + UID + '_e1-01', 'stickers/f1/03.webp', {'b': 'stuiter', 'g': 'boing', 'naam': 'Blije kat', 'tijd': 1}])
        ev(p, "([u, l]) => localStorage.setItem('fibro_widgets_profiel_' + u, JSON.stringify(l))", [UID, layout or [
            {'id': 'sticker_f1-07', 'icon': '\U0001F3A8', 'titel': 'Sticker', 'w': 1, 'h': 1, 'geenHeader': True, 'volgorde': 0, 'aan': True},
            {'id': 'sticker_e2-05', 'icon': '\U0001F3A8', 'titel': 'Sticker', 'w': 1, 'h': 1, 'geenHeader': True, 'volgorde': 1, 'aan': True},
            {'id': 'sticker_e1-01', 'icon': '\U0001F3A8', 'titel': 'Sticker', 'w': 1, 'h': 1, 'geenHeader': True, 'volgorde': 2, 'aan': True},
            {'id': 'sticker_f1-11', 'icon': '\U0001F3A8', 'titel': 'Sticker', 'w': 1, 'h': 1, 'geenHeader': True, 'volgorde': 3, 'aan': True}]])
        p.goto(BASIS + 'index.html')
        try: p.wait_for_function("() => document.querySelectorAll('#profiel-sectie .sw-sticker').length >= 3", timeout=12000)
        except Exception: pass
        p.wait_for_timeout(500)
        return ctx, p
    ctx, p = home()
    blokken = ev(p, """() => [...document.querySelectorAll('#profiel-sectie > .widget-blok')].map(b => { const i = b.querySelector('img');
      return [b.dataset.id, b.getAttribute('aria-label'), i ? (i.getAttribute('src') || '').slice(0, 22) : null] })""")
    check('Home: drie stickers bij Jouw profiel (de weggegooide niet)', blokken == [['sticker_f1-07', 'Speel sticker Boos', 'stickers/f1/07.webp'],
        ['sticker_e1-01', 'Speel sticker Blije kat', 'data:image/webp;base64'], ['sticker_f1-11', 'Speel sticker Spookje', 'stickers/f1/11.webp']], blokken)
    check('het kopje Jouw profiel staat er', ev(p, "() => getComputedStyle(document.getElementById('profiel-sectie-label')).display") == 'block', '')
    maat = ev(p, """() => { const g = document.getElementById('profiel-sectie').getBoundingClientRect(), b = document.querySelector('#profiel-sectie > .widget-blok').getBoundingClientRect(),
      i = document.querySelector('#profiel-sectie .sw-sticker').getBoundingClientRect(); return [Math.round(g.width), Math.round(b.width), Math.round(i.width), Math.round(i.height)] }""")
    check('een sticker is 1 kolom breed en het plaatje vult hem', isinstance(maat, list) and abs(maat[1] - (maat[0] - 28 - 30) / 4) <= 3 and maat[2] >= maat[1] - 2 and abs(maat[2] - maat[3]) <= 2, maat)
    naakt = ev(p, "() => { const b = document.querySelector('#profiel-sectie > .widget-blok'); const s = getComputedStyle(b); return [s.backgroundColor, s.borderTopStyle, getComputedStyle(b.querySelector('.widget-inhoud')).overflow] }")
    check('zonder kaartje eromheen, beweging wordt niet afgeknipt', naakt == ['rgba(0, 0, 0, 0)', 'none', 'visible'], naakt)
    if FOTO: p.screenshot(path=FOTO + '/b-home.png', full_page=True)
    voor = ev(p, "window.__fxosc || 0")
    ev(p, "() => document.querySelector('#profiel-sectie .widget-blok[data-id=\"sticker_f1-07\"]').click()")
    beweegt = ev(p, SPEELT, '#profiel-sectie .widget-blok[data-id="sticker_f1-07"] img')
    boven = ev(p, "() => document.querySelector('#profiel-sectie .widget-blok[data-id=\"sticker_f1-07\"]').style.zIndex")
    p.wait_for_timeout(400)
    check('tik op Boos: beweging en geluid, tijdens de beweging bovenop', beweegt is True and boven == '5' and ev(p, "window.__fxosc || 0") > voor, (beweegt, boven, voor))
    p.wait_for_timeout(900)
    check('na de beweging weer gewoon', ev(p, "() => document.querySelector('#profiel-sectie .widget-blok[data-id=\"sticker_f1-07\"]').style.zIndex") == '', '')
    voor = ev(p, "window.__fxosc || 0")
    p.focus('#profiel-sectie .widget-blok[data-id="sticker_e1-01"]'); p.keyboard.press('Enter'); p.wait_for_timeout(300)
    check('Enter op je eigen sticker: geluid (Boing) en beweging', ev(p, "window.__fxosc || 0") > voor and ev(p, SPEELT, '#profiel-sectie .widget-blok[data-id="sticker_e1-01"] img') is True, voor)
    p.wait_for_timeout(1200)
    # slepen: ingedrukt houden (500 ms) en naar de plek van de derde, dan loslaten
    r1 = p.locator('#profiel-sectie .widget-blok[data-id="sticker_f1-07"]').bounding_box()
    r3 = p.locator('#profiel-sectie .widget-blok[data-id="sticker_f1-11"]').bounding_box()
    voor = ev(p, "window.__fxosc || 0")
    p.mouse.move(r1['x'] + r1['width'] / 2, r1['y'] + r1['height'] / 2); p.mouse.down(); p.wait_for_timeout(700)
    for k in range(1, 11): p.mouse.move(r1['x'] + r1['width'] / 2 + (r3['x'] - r1['x']) * k / 10, r1['y'] + r1['height'] / 2); p.wait_for_timeout(30)
    p.wait_for_timeout(300); p.mouse.up(); p.wait_for_timeout(800)
    volg = ev(p, "() => [...document.querySelectorAll('#profiel-sectie > .widget-blok')].map(b => b.dataset.id)")
    bew = [w['id'] for w in sorted(ev(p, LAYOUT, UID) or [], key=lambda w: w.get('volgorde', 0))]
    check('ingedrukt houden en slepen: andere volgorde, bewaard', volg == ['sticker_e1-01', 'sticker_f1-11', 'sticker_f1-07'] and bew[0] == 'sticker_e1-01' and bew.index('sticker_f1-07') > bew.index('sticker_f1-11'), (volg, bew))
    check('slepen speelt de sticker niet af', ev(p, "window.__fxosc || 0") == voor, voor)
    check('geen fouten (Home)', p.fouten == [], p.fouten)
    ctx.close()
    ctx, p = home('en')
    lab = ev(p, "() => [...document.querySelectorAll('#profiel-sectie > .widget-blok')].map(b => b.getAttribute('aria-label'))")
    check('Engels: Play sticker Angry enz.', lab == ['Play sticker Angry', 'Play sticker Blije kat', 'Play sticker Spooked'], lab)
    check('geen fouten (Home, Engels)', p.fouten == [], p.fouten)
    ctx.close()

    # ── C. Profiel van een vriend ──
    print('C. Profiel van een vriend')
    ctx, p = nieuw_ctx()
    ev(p, ZET_TEKST, ['vriend_' + FID + '_layout', json.dumps([
        {'id': 'sticker_f1-03', 'icon': '\U0001F3A8', 'titel': 'Sticker', 'w': 1, 'h': 1, 'geenHeader': True, 'volgorde': 0, 'aan': True},
        {'id': 'sticker_e1-02', 'icon': '\U0001F3A8', 'titel': 'Sticker', 'w': 1, 'h': 1, 'geenHeader': True, 'volgorde': 1, 'aan': True},
        {'id': 'sticker_e2-01', 'icon': '\U0001F3A8', 'titel': 'Sticker', 'w': 1, 'h': 1, 'geenHeader': True, 'volgorde': 2, 'aan': True}])])
    ev(p, ZET, ['vriend_' + FID + '_sticker_e1-02', 'stickers/f1/06.webp', {'b': 'draai', 'g': 'pop', 'naam': 'Hondje'}])
    p.goto(BASIS + 'vriend-profiel.html?id=' + FID)
    try: p.wait_for_function("() => document.querySelectorAll('#vriendWidgetGrid .sw-sticker, #vriendWidgetGrid .sw-wacht').length >= 3", timeout=12000)
    except Exception: pass
    p.wait_for_timeout(400)
    vr = ev(p, """() => [...document.querySelectorAll('#vriendWidgetGrid > .widget-blok')].map(b => { const i = b.querySelector('img'), w = b.querySelector('.sw-wacht');
      return [b.getAttribute('aria-label'), i ? (i.getAttribute('src') || '').slice(0, 22) : (w ? w.getAttribute('aria-label') : null), b.style.gridColumn] })""")
    check('vriend: sticker van Fibro, zijn eigen sticker en een zandloper', vr == [['Speel sticker Slaap lekker', 'stickers/f1/03.webp', 'span 1'], ['Speel sticker Hondje', 'data:image/webp;base64', 'span 1'],
        [None, 'Sticker komt eraan', 'span 1']], vr)
    if FOTO: p.screenshot(path=FOTO + '/c-vriend.png', full_page=True)
    voor = ev(p, "window.__fxosc || 0")
    ev(p, "() => document.querySelector('#vriendWidgetGrid .widget-blok[aria-label=\"Speel sticker Hondje\"]').click()")
    beweegt = ev(p, SPEELT, '#vriendWidgetGrid .widget-blok[aria-label="Speel sticker Hondje"] img'); p.wait_for_timeout(300)
    check('tik op de sticker van de vriend: beweging en geluid', beweegt is True and ev(p, "window.__fxosc || 0") > voor, (beweegt, voor))
    # de ontbrekende sticker komt binnen via de sync (sync.js bewaart hem en meldt het op 'fibro-vriend-data')
    ev(p, ZET, ['vriend_' + FID + '_sticker_e2-01', 'stickers/f1/12.webp', {'b': 'kantel', 'g': 'fluit', 'naam': 'Vosje'}])
    ev(p, "id => { const k = new BroadcastChannel('fibro-vriend-data'); k.postMessage({ id }); k.close() }", 'vriend_' + FID + '_sticker_e2-01')
    try: p.wait_for_function("() => !!document.querySelector('#vriendWidgetGrid .widget-blok[aria-label=\"Speel sticker Vosje\"] img')", timeout=6000)
    except Exception: pass
    check('komt hij binnen, dan staat hij er vanzelf', ev(p, "() => !!document.querySelector('#vriendWidgetGrid .widget-blok[aria-label=\"Speel sticker Vosje\"] img') && !document.querySelector('#vriendWidgetGrid .sw-wacht')") is True, '')
    check('geen fouten (vriend)', p.fouten == [], p.fouten)
    ctx.close()
    br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
