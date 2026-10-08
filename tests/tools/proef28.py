import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef28: gastenboek (Home en vriend) nooit een schaduw achter de tekst, ook niet met achtergrondfoto;
# de rest van de pagina met foto wel (stijl.css v2).
# python3 -I proef28.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www28_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
GB = [{"id": i, "profile_id": UID, "author_id": BRAM, "content": "Groet %d" % i, "created_at": "2026-10-08T09:00:00Z", "author": {"username": "Bram", "avatar_url": "x"}} for i in range(3)]
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/guestbook_entries' in u and m == 'GET': return route.fulfill(status=200, json=GB)
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        e = {"id": BRAM if BRAM in u else UID, "username": "bram" if BRAM in u else "marcel"}
        return route.fulfill(status=200, json=e if obj else [e])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
LAY = json.dumps([{"id": "gastenboek", "aan": True, "w": 4, "h": 4, "volgorde": 0, "icon": "x", "titel": "Gastenboek"}])
MEET = """lijst => { const uit = {}; for (const sel of lijst) { const e = document.querySelector(sel); uit[sel] = e ? getComputedStyle(e).textShadow : 'ontbreekt' } return uit }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: perr.append(str(e)[:150]))
    p.goto(B + 'login.html'); p.evaluate("([t, u, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_widgets_home_' + u, l) }", [TOKEN, UID, LAY])
    p.evaluate("""([id, lay]) => new Promise(res => { const r = indexedDB.open('FibroDB', 2); r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos', { keyPath: 'id' }) };
      r.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: 'vriend_' + id + '_layout', data: lay, hash: 'a' }); tx.oncomplete = res } })""", [BRAM, LAY])
    for pg, boek, rest in [('index.html', ['#gbl', '#gbl-nav', '#gbi'], ['#heroNaam', '.bottom-nav .nav-item']),
                           ('vriend-profiel.html?id=' + BRAM, ['#gbwLijst', '#gbwLijst-nav'], ['.bottom-nav .nav-item'])]:
        p.goto(B + pg); p.wait_for_function("s => /Groet/.test((document.querySelector(s) || {}).textContent || '')", arg=boek[0], timeout=10000)
        p.evaluate("() => { const d = document.createElement('div'); d.id = 'fibro-wallpaper'; document.body.prepend(d) }"); p.wait_for_timeout(100)
        sel = boek + [boek[0] + ' span', boek[0] + ' div']
        b = p.evaluate(MEET, sel); r = p.evaluate(MEET, rest)
        check(pg.split('?')[0] + ': gastenboek zonder schaduw (met foto)', all(v == 'none' for v in b.values()), b)
        check(pg.split('?')[0] + ': rest van de pagina met schaduw (met foto)', all(v not in ('none', 'ontbreekt') for v in r.values()), r)
    check('geen fouten op de pagina', perr == [], perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
