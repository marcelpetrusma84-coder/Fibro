# proef81: het knopje van de profielmuziek verslepen met je vinger (v184), echte index.html, profiel.html en
# vriend-profiel.html. Een echt nummer uploaden (zoals proef75), dan op Home met nagebootste vinger-aanrakingen
# (CDP Input.dispatchTouchEvent, zoals een telefoon) en met de muis:
#  1. nooit verplaatst: de oude plek rechtsonder (84 px boven de onderkant)
#  2. slepen naar links: het knopje volgt de vinger, de pagina schuift niet en veegt niet naar een andere pagina
#  3. loslaten: vast aan de linkerkant (12 px) op de hoogte van loslaten; muziek speelt nog (slepen is geen tik); bewaard
#  4. gewoon tikken = pauze, nog eens = verder (zoals altijd)
#  5. opnieuw Home: zelfde plek
#  6. slepen naar de rechterhelft: vast aan de rechterkant
#  7. helemaal naar boven of onder slepen: blijft tussen de balk bovenaan (64 px) en de balk onderaan (84 px)
#  8. draaien (844 x 390): nog helemaal op het scherm; terug: weer op dezelfde hoogte-verhouding
#  9. het profiel van een vriend: zelfde kant en hoogte
# 10. met de muis (Steam Deck): slepen werkt, klikken zonder bewegen = pauze
# Geen paginafouten. Oude map (v183) als controle: het knopje blijft rechtsonder (bijna alles MIS).
# python3 -I proef81.py <map>     (FOTO=<map> maakt schermafbeeldingen)
import sys, os, time, json, socket, subprocess, tempfile, shutil, wave, struct, math
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
werk = tempfile.mkdtemp(); WAV = werk + '/Mijn liedje.wav'
w = wave.open(WAV, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
w.writeframes(b''.join(struct.pack('<h', int(6000 * math.sin(2 * math.pi * 330 * i / 22050))) for i in range(22050 * 4))); w.close()
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        if FID in u or 'in.' in u:
            v = {"id": FID, "username": "Bram", "avatar_url": "\U0001F438", "online_status": False}; return route.fulfill(status=200, json=v if obj else [v])
        e = {"id": UID, "username": "Marcel"}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
VANG = """(() => { const OudAudio = window.Audio; window.Audio = function (...x) { const a = new OudAudio(...x)
  queueMicrotask(() => { if (a.dataset && a.dataset.profielmuziek) window.__pm = a }); return a }; window.Audio.prototype = OudAudio.prototype })()"""
KNOP = """() => { const k = document.getElementById('profielMuziekKnop'); if (!k) return null; const r = k.getBoundingClientRect()
  return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(innerWidth - r.right), b: Math.round(innerHeight - r.bottom), w: Math.round(r.width), h: Math.round(r.height),
           speelt: !!(window.__pm && !window.__pm.paused), iw: innerWidth, ih: innerHeight, sy: Math.round(scrollY), url: location.pathname.split('/').pop(),
           plek: localStorage.getItem('fibro_muziek_knop_plek') } }"""
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
def ev(p, js, arg=None):
    try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
def ok(k): return isinstance(k, dict)

with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='nl-NL')
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None); ctx.add_init_script(VANG)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
    cdp = ctx.new_cdp_session(p)
    def vinger(pad, stappen=8, wacht=25):
        """Een vinger: neer op pad[0], dan langs de punten, los op het laatste punt."""
        x0, y0 = pad[0]
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]}); p.wait_for_timeout(wacht)
        for (xa, ya), (xb, yb) in zip(pad, pad[1:]):
            for i in range(1, stappen + 1):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': xa + (xb - xa) * i / stappen, 'y': ya + (yb - ya) * i / stappen}]}); p.wait_for_timeout(wacht)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); p.wait_for_timeout(400)
    def midden(k): return (k['l'] + k['w'] / 2, k['t'] + k['h'] / 2)
    p.goto(B + 'manifest.json')
    p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
    p.set_input_files('#muziekUpload', WAV)
    for i in range(40):
        p.wait_for_timeout(500)
        if 'opgeslagen' in (ev(p, "() => document.getElementById('muziekStatus').textContent") or ''): break
    def home():
        p.goto(B + 'index.html'); p.wait_for_timeout(3000)
        return ev(p, KNOP)

    print('1. Oude plek')
    k = home()
    check('nooit verplaatst: rechtsonder (12 px van rechts, 84 px boven de onderkant), speelt', ok(k) and k['r'] == 12 and k['b'] == 84 and k['speelt'], k)

    print('2-3. Slepen naar links')
    if ok(k):
        x, y = midden(k)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); p.wait_for_timeout(30)
        for i in range(1, 13):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + (80 - x) * i / 12, 'y': y + (330 - y) * i / 12}]}); p.wait_for_timeout(25)
        tijdens = ev(p, KNOP)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); p.wait_for_timeout(500)
        na = ev(p, KNOP)
        dx = 80 - (tijdens['l'] + tijdens['w'] / 2) if ok(tijdens) else 999; dy = 330 - (tijdens['t'] + tijdens['h'] / 2) if ok(tijdens) else 999
        check('tijdens het slepen volgt het knopje de vinger', ok(tijdens) and abs(dx) <= 3 and abs(dy) <= 3, (dx, dy, tijdens))
        check('de pagina schuift niet en veegt niet naar een andere pagina', ok(na) and na['sy'] == 0 and na['url'] == 'index.html', na)
        check('loslaten: vast aan de linkerkant op de hoogte van loslaten', ok(na) and na['l'] == 12 and abs(na['t'] + na['h'] / 2 - 330) <= 3, na)
        check('slepen is geen tik: de muziek speelt nog', ok(na) and na['speelt'], na)
        plek = json.loads(na['plek']) if ok(na) and na['plek'] else None
        check('bewaard (kant links, hoogte tussen 0 en 1)', isinstance(plek, dict) and plek.get('kant') == 'links' and 0 < plek.get('y', -1) < 1, plek)
        if FOTO: p.screenshot(path=os.path.join(FOTO, 'knop-links.png'))

    print('4. Tikken')
    k = ev(p, KNOP)
    if ok(k): x, y = midden(k); p.touchscreen.tap(x, y); p.wait_for_timeout(500)
    t1 = ev(p, KNOP)
    if ok(t1): x, y = midden(t1); p.touchscreen.tap(x, y); p.wait_for_timeout(800)
    t2 = ev(p, KNOP)
    check('tik = pauze, nog een tik = verder, en het knopje blijft staan', ok(t1) and not t1['speelt'] and ok(t2) and t2['speelt'] and t2['l'] == 12 and t1['t'] == k['t'], (t1, t2))

    print('5. Opnieuw Home')
    voor = ev(p, KNOP); k = home()
    check('opnieuw Home: zelfde plek', ok(k) and ok(voor) and k['l'] == 12 and abs(k['t'] - voor['t']) <= 1, (voor, k))

    print('6. Naar rechts')
    if ok(k): vinger([midden(k), (300, 500)])
    k = ev(p, KNOP)
    check('slepen naar de rechterhelft: vast aan de rechterkant', ok(k) and k['r'] == 12 and abs(k['t'] + k['h'] / 2 - 500) <= 3, k)

    print('7. Grenzen')
    if ok(k): vinger([midden(k), (200, 5)])
    hoog = ev(p, KNOP)
    if ok(hoog): vinger([midden(hoog), (200, 840)])
    laag = ev(p, KNOP)
    check('helemaal naar boven: niet onder de balk bovenaan (64 px)', ok(hoog) and hoog['t'] == 64, hoog)
    check('helemaal naar onder: niet op de balk onderaan (84 px)', ok(laag) and laag['b'] == 84, laag)
    if ok(laag): vinger([midden(laag), (60, 422 + laag['h'] / 2)])   # ongeveer in het midden, links
    midden_k = ev(p, KNOP)

    print('8. Draaien')
    p.set_viewport_size({'width': 844, 'height': 390}); p.wait_for_timeout(500)
    lig = ev(p, KNOP)
    check('liggend (844 x 390): helemaal op het scherm, links, tussen de balken', ok(lig) and lig['l'] == 12 and lig['t'] >= 0 and lig['b'] >= 0 and lig['t'] + lig['h'] <= 390, lig)
    p.set_viewport_size({'width': 390, 'height': 844}); p.wait_for_timeout(500)
    rechtop = ev(p, KNOP)
    check('weer rechtop: dezelfde plek als voor het draaien', ok(rechtop) and ok(midden_k) and rechtop['l'] == 12 and abs(rechtop['t'] - midden_k['t']) <= 1, (midden_k, rechtop))

    print('9. Profiel van een vriend')
    ev(p, """async ([id]) => {
      const lees = () => new Promise(ok => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = () => { const q = r.result.transaction('fotos').objectStore('fotos').get('muziek_track'); q.onsuccess = () => ok(q.result && q.result.data) } })
      const data = await lees()
      await new Promise(ok => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = () => { const tx = r.result.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: 'vriend_' + id + '_muziek_profiel', hash: 1, data }); tx.oncomplete = () => ok() } }) }""", [FID])
    p.goto(B + 'vriend-profiel.html?id=' + FID); p.wait_for_timeout(3500)
    v = ev(p, KNOP)
    check('bij een vriend: zelfde kant en hoogte', ok(v) and ok(rechtop) and v['l'] == 12 and abs(v['t'] - rechtop['t']) <= 1, (v, rechtop))
    if FOTO: p.screenshot(path=os.path.join(FOTO, 'knop-vriend.png'))
    check('geen paginafouten (telefoon)', not fouten, fouten[:3])
    ctx.close()

    print('10. Met de muis (Steam Deck)')
    ctx = br.new_context(service_workers='block', viewport={'width': 1280, 'height': 800}, locale='nl-NL')
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None); ctx.add_init_script(VANG)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'manifest.json')
    p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
    p.set_input_files('#muziekUpload', WAV)
    for i in range(40):
        p.wait_for_timeout(500)
        if 'opgeslagen' in (ev(p, "() => document.getElementById('muziekStatus').textContent") or ''): break
    p.goto(B + 'index.html'); p.wait_for_timeout(3000)
    k = ev(p, KNOP)
    if ok(k):
        x, y = midden(k); p.mouse.move(x, y); p.mouse.down(); p.mouse.move(x - 200, y - 150, steps=10); p.mouse.move(150, 300, steps=10); p.mouse.up(); p.wait_for_timeout(500)
    m1 = ev(p, KNOP)
    check('muis: slepen naar links werkt, muziek speelt nog', ok(m1) and m1['l'] == 12 and abs(m1['t'] + m1['h'] / 2 - 300) <= 3 and m1['speelt'], m1)
    if ok(m1): x, y = midden(m1); p.mouse.click(x, y); p.wait_for_timeout(500)
    m2 = ev(p, KNOP)
    check('muis: klikken zonder bewegen = pauze', ok(m2) and not m2['speelt'] and m2['l'] == 12, m2)
    check('geen paginafouten (muis)', not fouten, fouten[:3])
    br.close()
srv.kill(); shutil.rmtree(www, ignore_errors=True); shutil.rmtree(werk, ignore_errors=True)
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
