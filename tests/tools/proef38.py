import subprocess, sys, time, json, os, shutil
from playwright.sync_api import sync_playwright
# proef38: foto's in een formaat dat het toestel echt kan maken. Safari (iPhone) kan geen WebP en Chromium
# geen AVIF: dan komt er stilletjes PNG uit (5-10x groter). Nagebootst in Chromium ("iPhone": wie om WebP of
# AVIF vraagt krijgt PNG) en gewoon ("Chrome"). Met een testfoto van 4032x3024:
# A achtergrond kiezen op Profiel, B bestaande grote PNG-achtergrond wordt kleiner bij het openen van Profiel,
# C foto in de 3x3-widget op Home, D foto in de chat (vroeger altijd PNG door de AVIF-test).
# python3 -I proef38.py <scratch met tools/server.py en testfoto.jpg> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www38_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro'); shutil.copy(S + '/testfoto.jpg', WWW + '/testfoto.jpg')
FOTO = S + '/testfoto.jpg'
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/friendships' in u and m == 'GET': return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": BRAM}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}; vriend = {"id": BRAM, "username": "Bram", "avatar_url": "x", "public_key": None}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if BRAM in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or BRAM in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
IPHONE = """(() => {
  const td = HTMLCanvasElement.prototype.toDataURL, tb = HTMLCanvasElement.prototype.toBlob
  const fix = t => (t === 'image/webp' || t === 'image/avif') ? 'image/png' : t
  HTMLCanvasElement.prototype.toDataURL = function (t, q) { return td.call(this, fix(t), q) }
  HTMLCanvasElement.prototype.toBlob = function (cb, t, q) { return tb.call(this, cb, fix(t), q) }
})()"""
LEES = """async (sleutel) => { const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
  r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  const v = await new Promise(ok => { const q = db.transaction('fotos').objectStore('fotos').get(sleutel); q.onsuccess = () => ok(q.result ? q.result.data : null) }); db.close()
  return v ? [String(v).slice(0, 15), String(v).length] : null }"""
ZET = """async ([sleutel, data]) => { const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
  r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  await new Promise(ok => { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: sleutel, data }); tx.oncomplete = ok }); db.close() }"""
GROTE_PNG = """async () => { const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = '../testfoto.jpg' })
  const c = document.createElement('canvas'); c.width = 1080; c.height = 810; c.getContext('2d').drawImage(img, 0, 0, 1080, 810)
  return HTMLCanvasElement.prototype.toDataURL.call(c, 'image/png') }"""
CHATFOTO = """async () => { const b = await (await fetch('../testfoto.jpg')).blob(); const f = new File([b], 'foto.jpg', { type: 'image/jpeg' })
  const dt = new DataTransfer(); dt.items.add(f); const inp = document.createElement('input'); inp.type = 'file'; inp.files = dt.files
  window.__blobs = []; const tb = HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob = function (cb, t, q) { return tb.call(this, b => { if (this.width > 100) window.__blobs.push([t, b && b.type, b && b.size]); cb(b) }, t, q) }
  await window.fotoGekozen(inp); await new Promise(r => setTimeout(r, 500)); return window.__blobs }"""
uitkomst = {}
def ronde(soort):
    r = {}
    with sync_playwright() as pw:
        br = pw.chromium.launch(); ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 800}); ctx.route('**/*supabase.co/**', supa)
        if soort == 'iphone': ctx.add_init_script(IPHONE)
        p = ctx.new_page(); perr = []
        p.on('pageerror', lambda e: perr.append(str(e))); p.on('dialog', lambda d: d.accept())
        p.goto(B + 'login.html')
        p.evaluate("([t, u]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now()));"
                   " localStorage.setItem('fibro_widgets_profiel_' + u, JSON.stringify([{ id: 'fotos_3x3', icon: 'x', titel: 'Foto grid 3x3', w: 4, h: 3, volgorde: 0, aan: true }])) }", [TOKEN, UID])
        # A: achtergrond kiezen op Profiel
        p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
        p.set_input_files('#bgUpload', FOTO); p.wait_for_timeout(3000)
        r['A'] = p.evaluate(LEES, 'bg_wallpaper_' + UID)
        # B: bestaande grote PNG-achtergrond (zoals een iPhone hem vroeger bewaarde) wordt kleiner bij openen
        png = p.evaluate(GROTE_PNG); p.evaluate(ZET, ['bg_wallpaper_' + UID, png])
        r['B_voor'] = p.evaluate(LEES, 'bg_wallpaper_' + UID)
        p.goto(B + 'profiel.html'); p.wait_for_timeout(4000)
        r['B_na'] = p.evaluate(LEES, 'bg_wallpaper_' + UID)
        # C: foto in de 3x3-widget op Home
        p.goto(B + 'index.html'); p.wait_for_timeout(3000)
        if p.query_selector('#foto-inp-3x3-0'):
            p.set_input_files('#foto-inp-3x3-0', FOTO); p.wait_for_timeout(3000)
            r['C'] = p.evaluate(LEES, 'pfoto_3x3_0_' + UID)
        else: r['C'] = 'geen widget'
        # D: foto in de chat
        p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
        p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(1500)
        r['D'] = p.evaluate(CHATFOTO)
        r['fouten'] = perr
        br.close()
    return r
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:200] if info != '' else ''))
    if not ok: fouten.append(naam)
def goed(x, maxkb): return isinstance(x, list) and len(x) == 2 and not x[0].startswith('data:image/png') and x[1] < maxkb * 1024
for soort in ('chrome', 'iphone'):
    r = uitkomst[soort] = ronde(soort)
    print(soort)
    check(soort + ': achtergrond kiezen geen PNG, < 150 kB', goed(r['A'], 150), r['A'])
    check(soort + ': grote PNG-achtergrond wordt kleiner bij openen Profiel', r['B_voor'] and r['B_voor'][0].startswith('data:image/png') and goed(r['B_na'], 150), (r['B_voor'], r['B_na']))
    check(soort + ': foto in de 3x3-widget geen PNG, < 80 kB', goed(r['C'], 80), r['C'])
    d = r['D'] if isinstance(r['D'], list) else []
    check(soort + ': foto in de chat ' + ('WebP' if soort == 'chrome' else 'JPEG') + ', < 150 kB', bool(d) and d[-1][1] == ('image/webp' if soort == 'chrome' else 'image/jpeg') and d[-1][2] < 150 * 1024, d)
    check(soort + ': geen paginafouten', not r['fouten'], r['fouten'][:3])
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
