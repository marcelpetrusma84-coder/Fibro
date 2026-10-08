import subprocess, sys, time, json, os, base64, zlib, struct
from playwright.sync_api import sync_playwright
# proef22: vegen. Gastenboek: naar links/rechts = bladeren (en niet naar een andere pagina).
# Fotoviewer: naar beneden vegen sluit de foto, een klein stukje niet, opzij = volgende foto.
# python3 -I proef22.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www22_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def png(kleur):
    rij = b'\x00' + bytes(kleur) * 200
    raw = rij * 150
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 200, 150, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')).decode()
GB = [{"id": i, "profile_id": UID, "author_id": BRAM, "content": "Groet %d" % (11 - i), "created_at": "2026-10-07T10:00:00Z", "author": {"username": "Bram", "avatar_url": "x"}} for i in range(12)]
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/guestbook_entries' in u and m == 'GET': return route.fulfill(status=200, json=GB)
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        e = {"id": UID, "username": "marcel"}
        return route.fulfill(status=200, json=e if obj else [e])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(has_touch=True, is_mobile=True, viewport={'width': 390, 'height': 800}); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200])))
    cdp = ctx.new_cdp_session(p)
    def veeg(x0, y0, x1, y1, stappen=8):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
        for i in range(1, stappen + 1):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / stappen, 'y': y0 + (y1 - y0) * i / stappen}]}); p.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); p.wait_for_timeout(600)
    p.goto(B + 'login.html')
    LAY = json.dumps([{"id": "gastenboek", "aan": True, "w": 4, "h": 4, "volgorde": 0, "icon": "x", "titel": "Gastenboek"}])
    p.evaluate("([t, uid, lay]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_widgets_home_' + uid, lay) }", [TOKEN, UID, LAY])
    print('1. Gastenboek op Home')
    p.goto(B + 'index.html'); p.wait_for_function("() => /blz\\. 1 van 3/.test((document.querySelector('#gbl-nav') || {}).textContent || '')", timeout=10000)
    b = p.evaluate("() => { const r = document.querySelector('#gbl').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }")
    p.evaluate("() => document.querySelector('#gbl').scrollIntoView({ block: 'center' })"); p.wait_for_timeout(300)
    b = p.evaluate("() => { const r = document.querySelector('#gbl').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }")
    veeg(b[0] + 100, b[1], b[0] - 100, b[1])
    nav = p.evaluate("() => document.querySelector('#gbl-nav').textContent")
    check('naar links vegen: blz. 2', 'blz. 2 van 3' in nav and p.url.endswith('index.html'), (nav, p.url))
    veeg(b[0] + 100, b[1], b[0] - 100, b[1])
    veeg(b[0] - 100, b[1], b[0] + 100, b[1])
    nav = p.evaluate("() => document.querySelector('#gbl-nav').textContent")
    check('nog eens links en dan rechts: blz. 2', 'blz. 2 van 3' in nav and p.url.endswith('index.html'), (nav, p.url))
    veeg(b[0], b[1] - 60, b[0] + 10, b[1] + 60)
    nav = p.evaluate("() => document.querySelector('#gbl-nav').textContent")
    check('omlaag vegen bladert niet', 'blz. 2 van 3' in nav, nav)
    print('2. Fotoviewer op het profiel van een vriend')
    LAY2 = json.dumps([{"id": "fotos_3x3", "aan": True, "w": 4, "h": 3, "volgorde": 0, "icon": "x", "titel": "Foto's"}])
    p.evaluate("""([id, lay, f1, f2]) => new Promise(res => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite'); const s = tx.objectStore('fotos');
      s.put({ id: 'vriend_' + id + '_layout', data: lay, hash: 'a' }); s.put({ id: 'vriend_' + id + '_foto_pfoto_3x3_0', data: f1, hash: 'b' }); s.put({ id: 'vriend_' + id + '_foto_pfoto_3x3_1', data: f2, hash: 'c' }); tx.oncomplete = res } })""", [BRAM, LAY2, png((200, 40, 40)), png((40, 40, 200))])
    p.goto(B + 'vriend-profiel.html?id=' + BRAM); p.wait_for_selector('#vriendWidgetGrid img', timeout=10000); p.wait_for_timeout(800)
    open_ = "() => { const o = document.getElementById('fibro-fotoviewer'); return !!o && o.style.display !== 'none' }"
    def openFoto():
        p.evaluate("() => document.querySelector('#vriendWidgetGrid img').scrollIntoView({ block: 'center' })"); p.wait_for_timeout(200)
        p.locator('#vriendWidgetGrid img').first.click(); p.wait_for_timeout(300)
    openFoto(); check('foto open', p.evaluate(open_))
    veeg(195, 400, 195, 430)
    check('klein stukje omlaag: blijft open', p.evaluate(open_))
    veeg(195, 400, 80, 405)
    check('opzij vegen: volgende foto', p.evaluate("() => document.getElementById('fv-teller').textContent") == '2 van 2', p.evaluate("() => document.getElementById('fv-teller').textContent"))
    veeg(195, 300, 200, 560)
    check('naar beneden vegen: foto dicht', not p.evaluate(open_))
    openFoto()
    st = p.evaluate("() => { const f = document.getElementById('fv-foto'); const o = document.getElementById('fibro-fotoviewer'); return [f.style.transform, f.style.opacity, o.style.background] }")
    check('opnieuw openen: foto weer normaal', st[0] == '' and st[1] == '' and '0.94' in st[2], st)
    print('3. Gastenboek op het profiel van een vriend')
    LAY3 = json.dumps([{"id": "gastenboek", "aan": True, "w": 4, "h": 4, "volgorde": 0, "icon": "x", "titel": "Gastenboek"}])
    p.evaluate("""([id, lay]) => new Promise(res => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite');
      tx.objectStore('fotos').put({ id: 'vriend_' + id + '_layout', data: lay, hash: 'd' }); tx.oncomplete = res } })""", [BRAM, LAY3])
    p.goto(B + 'vriend-profiel.html?id=' + BRAM); p.wait_for_function("() => /blz\\. 1 van 3/.test((document.querySelector('#gbwLijst-nav') || {}).textContent || '')", timeout=10000)
    p.evaluate("() => document.querySelector('#gbwLijst').scrollIntoView({ block: 'center' })"); p.wait_for_timeout(300)
    b = p.evaluate("() => { const r = document.querySelector('#gbwLijst').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }")
    veeg(b[0] + 100, b[1], b[0] - 100, b[1])
    nav = p.evaluate("() => document.querySelector('#gbwLijst-nav').textContent")
    check('vriend: naar links vegen = blz. 2', 'blz. 2 van 3' in nav, nav)
    check('geen fouten op de pagina', perr == [], perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
