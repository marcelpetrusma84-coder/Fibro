# proef69: een sticker als mood (v171), met de echte profiel.html, index.html en vriend-profiel.html.
# A. Profiel -> Mood: het knopje opent de stickerkeuze (geen emoji's); een sticker kiezen (echte klik) toont hem in het
#    knopje; Opslaan stuurt mood 'fxsticker:f2-11 <tekst>' en offline_emoji 'fxsticker:f2-11' naar de server.
# B. Home: de Mood-widget toont de sticker; een echte tik = beweging en geluid, geen fotoviewer; onder je naam staat
#    alleen de tekst (geen 'fxsticker').
# C. Profiel van een vriend: zijn sticker (vel 3) in de Mood, tik = beweging en geluid; de tekst klopt; de regel
#    'offline' zonder code. Een eigen sticker van de vriend die er nog niet is: zandloper, en hij verschijnt vanzelf
#    zodra hij binnen is (sync, BroadcastChannel). Een oude emoji-mood werkt nog.
# Oude map als controle: geen stickerkeuze en geen sticker (bijna alles MIS).
# python3 -I proef69.py <map>     (FOTO=<map> maakt schermafbeeldingen)
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
staat = {'ik': {"id": UID, "username": "marcel", "mood": "\U0001F60A Blij", "offline_emoji": "\U0001F60A", "offline_bericht": "Blij", "toon_online": True},
         'vriend': {"id": FID, "username": "flamingo", "avatar_url": "\U0001F9A9", "online_status": False, "toon_online": False, "laatst_gezien": "2026-10-16T10:00:00Z",
                    "mood": "fxsticker:f3-07 Rocken", "offline_emoji": "fxsticker:f3-07", "offline_bericht": "Rocken", "public_key": None},
         'patch': []}
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m in ('PATCH', 'POST'):
        try: staat['patch'].append(json.loads(route.request.post_data or '{}'))
        except Exception: pass
        return route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and m == 'GET':
        if FID in u or 'in.' in u:
            v = staat['vriend']; return route.fulfill(status=200, json=v if obj else [v])
        e = staat['ik']; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u and 'profiles' in u: return route.fulfill(status=200, json=[{"friend_id": FID, "profiles": staat['vriend']}])
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
  // v160: de geluiden zijn mp3's (<audio data-stickerfx> met een blob-adres): die tellen ook (niet het stille zegenen)
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    if (this.dataset && this.dataset.stickerfx && !this._zegen && String(this.src || '').startsWith('blob:')) { window.__fxosc++; window.__fxmp3 = (window.__fxmp3 || 0) + 1 }
    return speel.apply(this, arguments) }
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
VIEWER = "() => { const v = document.getElementById('fibro-fotoviewer'); return !!(v && getComputedStyle(v).display !== 'none') }"
BG = "sel => { const s = document.querySelector(sel); return s ? getComputedStyle(s).backgroundImage : null }"
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
    ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(TELLER)
    ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:200])); p.on('dialog', lambda d: d.dismiss())
    def ev(js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:100]
    p.goto(BASIS + 'manifest.json')
    p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", TOKEN)
    # ── A. Profiel ──
    print('A. Profiel')
    p.goto(BASIS + 'profiel.html'); p.wait_for_timeout(2500)
    try: p.click('#moodEmojiGekozen', timeout=3000)
    except Exception as e: print('   klik knopje:', str(e)[:80])
    p.wait_for_timeout(500)
    keuze = ev("() => { const k = document.getElementById('moodEmojiPicker'); return [getComputedStyle(k).display, k.querySelectorAll('.sk-sticker').length, k.querySelectorAll('.mood-emoji-opt').length] }")
    check('A. het knopje opent de stickerkeuze, geen emoji-lijst', isinstance(keuze, list) and keuze[0] != 'none' and keuze[1] >= 12 and keuze[2] == 0, keuze)
    try:
        p.click('#moodEmojiPicker .sk-vak[data-vak="f2"]', timeout=3000); p.wait_for_timeout(200)
        p.locator('#moodEmojiPicker .sk-sticker').nth(10).click(timeout=3000)
    except Exception as e: print('   kiezen:', str(e)[:80])
    p.wait_for_timeout(600)
    knop = ev("() => { const k = document.getElementById('moodEmojiGekozen'); const s = k.querySelector('.mood-sticker'); return [k.dataset.waarde, s ? getComputedStyle(s).backgroundImage : null, getComputedStyle(document.getElementById('moodEmojiPicker')).display] }")
    check('A. gekozen: het knopje toont de sticker (f2-11), keuze dicht', isinstance(knop, list) and knop[0] == 'fxsticker:f2-11' and 'stickers/f2/11.webp' in str(knop[1]) and knop[2] == 'none', knop)
    ev("() => { document.getElementById('editMood').value = 'Gewonnen' }")
    ev("() => window.slaAllesOp()"); p.wait_for_timeout(2000)
    pt = next((x for x in staat['patch'] if isinstance(x, dict) and 'mood' in x), None)
    pt2 = next((x for x in staat['patch'] if isinstance(x, dict) and 'offline_emoji' in x), None)
    check("A. Opslaan: mood 'fxsticker:f2-11 Gewonnen' (ook naar de server, voor je vrienden)", pt and pt.get('mood') == 'fxsticker:f2-11 Gewonnen', [x for x in staat['patch'] if 'offline_emoji' in x][:1])
    check("A. Opslaan: offline_emoji 'fxsticker:f2-11', offline_bericht 'Gewonnen'", pt2 and pt2.get('offline_emoji') == 'fxsticker:f2-11' and pt2.get('offline_bericht') == 'Gewonnen', pt2)
    # opnieuw openen: het knopje toont de sticker weer
    staat['ik'].update({'mood': 'fxsticker:f2-11 Gewonnen', 'offline_emoji': 'fxsticker:f2-11', 'offline_bericht': 'Gewonnen'})
    p.goto(BASIS + 'profiel.html'); p.wait_for_timeout(2500)
    knop = ev("() => { const k = document.getElementById('moodEmojiGekozen'); const s = k.querySelector('.mood-sticker'); return [k.dataset.waarde, s ? getComputedStyle(s).backgroundImage : null, document.getElementById('editMood').value] }")
    if FOTO: p.locator('#moodEmojiGekozen').scroll_into_view_if_needed(); p.screenshot(path=FOTO + '/mood-profiel.png')
    check('A. opnieuw openen: sticker in het knopje, tekst Gewonnen', isinstance(knop, list) and knop[0] == 'fxsticker:f2-11' and 'stickers/f2/11.webp' in str(knop[1]) and knop[2] == 'Gewonnen', knop)
    # ── B. Home ──
    print('B. Home')
    ev("([u, l]) => localStorage.setItem('fibro_widgets_profiel_' + u, JSON.stringify(l))", [UID, [{'id': 'mood', 'icon': '\U0001F60A', 'titel': 'Mood', 'w': 4, 'h': 1, 'volgorde': 0, 'aan': True}]])
    p.goto(BASIS + 'index.html'); p.wait_for_timeout(3500)
    SEL = '#profiel-sectie .widget-blok[data-id="mood"] .mood-sticker'
    check('B. Mood-widget toont de sticker (f2-11)', 'stickers/f2/11.webp' in str(ev(BG, SEL)), ev(BG, SEL))
    tekst = ev("() => { const b = document.querySelector('#profiel-sectie .widget-blok[data-id=\"mood\"] .widget-inhoud'); return b ? b.textContent.trim() : null }")
    check('B. ... met de tekst, zonder code', tekst == 'Gewonnen', tekst)
    voor = ev("window.__fxosc || 0")
    p.mouse.click(5, 5); p.wait_for_timeout(300)
    try: p.click(SEL, timeout=3000)
    except Exception as e: print('   tik:', str(e)[:80])
    p.wait_for_timeout(250)
    beweegt = ev("sel => { const s = document.querySelector(sel); return !!(s && s.getAnimations().length) }", SEL)
    p.wait_for_timeout(900)
    check('B. echte tik: beweging en geluid, geen fotoviewer', beweegt and isinstance(ev("window.__fxosc || 0"), int) and ev("window.__fxosc || 0") > voor and not ev(VIEWER), (beweegt, voor, ev("window.__fxosc || 0"), ev(VIEWER)))
    hero = ev("() => document.getElementById('heroMood').textContent")
    if FOTO: p.screenshot(path=FOTO + '/mood-home.png')
    check('B. onder je naam alleen de tekst', hero == 'Gewonnen', hero)
    # ── C. Profiel van een vriend ──
    print('C. vriend')
    p.goto(BASIS + 'vriend-profiel.html?id=' + FID); p.wait_for_timeout(3500)
    check('C. Mood van de vriend: zijn sticker (f3-07)', 'stickers/f3/07.webp' in str(ev(BG, '#moodEmoji .mood-sticker')), ev(BG, '#moodEmoji .mood-sticker'))
    if FOTO: p.screenshot(path=FOTO + '/mood-vriend.png')
    check('C. tekst Rocken', ev("() => document.getElementById('moodTekst').textContent") == 'Rocken', ev("() => document.getElementById('moodTekst').textContent"))
    lab = ev("() => document.getElementById('onlineLabel').textContent")
    check("C. de regel 'offline' zonder code", 'fxsticker' not in str(lab) and 'Rocken' in str(lab), lab)
    voor = ev("window.__fxosc || 0")
    p.mouse.click(5, 5); p.wait_for_timeout(300)
    try: p.click('#moodEmoji .mood-sticker', timeout=3000)
    except Exception as e: print('   tik:', str(e)[:80])
    p.wait_for_timeout(250)
    beweegt = ev("() => { const s = document.querySelector('#moodEmoji .mood-sticker'); return !!(s && s.getAnimations().length) }")
    p.wait_for_timeout(900)
    check('C. echte tik: beweging en geluid', beweegt and isinstance(ev("window.__fxosc || 0"), int) and ev("window.__fxosc || 0") > voor, (beweegt, voor, ev("window.__fxosc || 0")))
    # eigen sticker van de vriend, nog niet binnen
    staat['vriend'].update({'mood': 'fxsticker:e1-02 Eigen', 'offline_emoji': 'fxsticker:e1-02'})
    p.goto(BASIS + 'vriend-profiel.html?id=' + FID); p.wait_for_timeout(3000)
    wacht = ev("() => document.getElementById('moodEmoji').textContent")
    check('C. eigen sticker van de vriend nog niet binnen: zandloper', wacht == '\u23F3', wacht)
    ev(ZET, ['vriend_' + FID + '_sticker_e1-02', 'stickers/f2/05.webp', {'b': 'hup', 'g': 'pling', 'naam': 'Eigen', 'tijd': 1}])
    ev("id => { const k = new BroadcastChannel('fibro-vriend-data'); k.postMessage({ id }); k.close() }", 'vriend_' + FID + '_sticker_e1-02')
    p.wait_for_timeout(1200)
    bg = ev(BG, '#moodEmoji .mood-sticker')
    check('C. ... verschijnt vanzelf zodra hij binnen is', str(bg).startswith('url("data:image'), str(bg)[:40])
    staat['vriend'].update({'mood': '\U0001F60A Blij', 'offline_emoji': '\U0001F60A', 'offline_bericht': 'Blij'})
    p.goto(BASIS + 'vriend-profiel.html?id=' + FID); p.wait_for_timeout(3000)
    oud = ev("() => [document.getElementById('moodEmoji').textContent, document.getElementById('moodTekst').textContent]")
    check('C. een oude emoji-mood werkt nog', oud == ['\U0001F60A', 'Blij'], oud)
    check('geen fouten op de pagina', fouten == [], fouten[:3])
    br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
