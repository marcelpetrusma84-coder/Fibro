import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef37: Profiel opslaan stuurt de avatar en de achtergrondfoto alleen mee als ze anders zijn dan wat dit
# toestel de vorige keer stuurde (vingerafdruk in fibro_fotos_verstuurd_<uid>); updated_at (het etiket voor
# de foto's bij vrienden) gaat alleen mee als er een foto veranderd is. Eerste keer, niets veranderd, alleen
# de achtergrond anders, alleen de avatar anders, achtergrond weg, server-fout (dan de volgende keer opnieuw).
# Op de oude code moet "niets veranderd" falen (controle).
# python3 -I proef37.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www37_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
EIGEN = {"id": UID, "username": "marcel", "offline_emoji": "\U0001F600", "offline_bericht": "Oud"}
staat = {'posts': [], 'fout': False}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return route.fulfill(status=200, json=EIGEN if obj else [EIGEN])
    if '/rest/v1/profiles' in u and m == 'POST':
        staat['posts'].append(route.request.post_data or '')
        if staat['fout']: return route.fulfill(status=503, json={"message": "server even weg"})
        return route.fulfill(status=201, json=[])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:200] if info != '' else ''))
    if not ok: fouten.append(naam)
# een "achtergrondfoto" van ±1,5 MB en een avatar van ±20 KB (data:-adressen, zoals in IndexedDB)
ACHTER1 = 'data:image/jpeg;base64,' + 'A' * 1500000
ACHTER2 = 'data:image/jpeg;base64,' + 'B' * 1500000
AV1 = 'data:image/jpeg;base64,' + 'C' * 20000
AV2 = 'data:image/jpeg;base64,' + 'D' * 20000
ZET = """async ([uid, avatar, achter]) => { const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
  r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  await new Promise(k => { const tx = db.transaction('fotos', 'readwrite'); const st = tx.objectStore('fotos')
    if (avatar) st.put({ id: 'avatar_thumbnail_' + uid, data: avatar }); else st.delete('avatar_thumbnail_' + uid)
    if (achter) st.put({ id: 'bg_wallpaper_' + uid, data: achter }); else st.delete('bg_wallpaper_' + uid)
    tx.oncomplete = k }); db.close() }"""
def opslaan(p):
    n = len(staat['posts'])
    p.evaluate("() => window.slaAllesOp()")
    for i in range(60):
        if len(staat['posts']) > n: break
        p.wait_for_timeout(100)
    p.wait_for_timeout(400)
    if len(staat['posts']) == n: return None, 0, ''
    ruw = staat['posts'][-1]
    return json.loads(ruw), len(ruw), p.evaluate("() => document.getElementById('statusMsg').textContent")
def wat(rij): return sorted(k for k in ('avatar_data', 'wallpaper_data', 'updated_at') if k in rij)
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport={'width': 400, 'height': 800}); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200]))); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.evaluate(ZET, [UID, AV1, ACHTER1])
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
    print('1. Eerste keer opslaan (nog geen vingerafdruk): alles mee, zoals vroeger')
    rij, n, st = opslaan(p)
    check('avatar, achtergrond en etiket mee', rij is not None and wat(rij) == ['avatar_data', 'updated_at', 'wallpaper_data'] and rij['wallpaper_data'] == ACHTER1, (wat(rij or {}), n))
    check('mood gaat ook mee', rij is not None and rij.get('offline_bericht'), rij and rij.get('offline_bericht'))
    check('melding opgeslagen', 'opgeslagen' in st, st)
    print('2. Alleen de mood anders: geen foto\'s, geen etiket')
    p.fill('#editMood', 'Vrolijk')
    rij, n, st = opslaan(p)
    check('geen foto\'s en geen updated_at', rij is not None and wat(rij) == [], (wat(rij or {}), n))
    check('klein verzoek (< 2 KB in plaats van 1,5 MB)', 0 < n < 2000, n)
    check('nieuwe mood wel mee', rij is not None and rij.get('offline_bericht') == 'Vrolijk', rij and rij.get('offline_bericht'))
    check('melding opgeslagen', 'opgeslagen' in st, st)
    print('3. Andere achtergrond: alleen de achtergrond (en het etiket)')
    p.evaluate(ZET, [UID, AV1, ACHTER2])
    rij, n, st = opslaan(p)
    check('achtergrond en etiket, geen avatar', rij is not None and wat(rij) == ['updated_at', 'wallpaper_data'] and rij['wallpaper_data'] == ACHTER2, (wat(rij or {}), n))
    rij, n, st = opslaan(p)
    check('daarna weer niets', rij is not None and wat(rij) == [], wat(rij or {}))
    print('4. Andere avatar: alleen de avatar (en het etiket)')
    p.evaluate(ZET, [UID, AV2, ACHTER2])
    rij, n, st = opslaan(p)
    check('avatar en etiket, geen achtergrond', rij is not None and wat(rij) == ['avatar_data', 'updated_at'] and rij['avatar_data'] == AV2 and 0 < n < 25000, (wat(rij or {}), n))
    print('5. Achtergrond weggehaald: leeg meesturen')
    p.evaluate(ZET, [UID, AV2, None])
    rij, n, st = opslaan(p)
    check('wallpaper_data leeg en etiket mee', rij is not None and wat(rij) == ['updated_at', 'wallpaper_data'] and rij['wallpaper_data'] is None, (wat(rij or {}), rij and rij.get('wallpaper_data')))
    rij, n, st = opslaan(p)
    check('daarna weer niets', rij is not None and wat(rij) == [], wat(rij or {}))
    print('6. Server even weg bij een nieuwe achtergrond: volgende keer opnieuw')
    p.evaluate(ZET, [UID, AV2, ACHTER1]); staat['fout'] = True
    rij, n, st = opslaan(p)
    check('geprobeerd met de achtergrond', rij is not None and 'wallpaper_data' in rij, wat(rij or {}))
    check('zegt dat het mislukte', 'mislukt' in st, st)
    staat['fout'] = False
    rij, n, st = opslaan(p)
    check('volgende keer gaat de achtergrond alsnog mee', rij is not None and wat(rij) == ['updated_at', 'wallpaper_data'] and rij['wallpaper_data'] == ACHTER1, wat(rij or {}))
    print('7. Na verversen onthouden')
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2000)
    rij, n, st = opslaan(p)
    check('niets veranderd: niets mee', rij is not None and wat(rij) == [], wat(rij or {}))
    check('geen paginafouten', not perr, perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
