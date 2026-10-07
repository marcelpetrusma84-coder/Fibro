import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef13: vriend-profiel zonder internet (A: nooit online geopend, B: eerder online geopend), uitloggen wist het
# python3 -I proef13.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www13'; os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
BRAM = 'bbbb0001-0000-4000-8000-000000000001'; LOTTE = 'cccc0002-0000-4000-8000-000000000002'
def start_srv():
    p = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8); return p
srv = start_srv()
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
staat = {'online': True}
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
PROF = {BRAM: {"id": BRAM, "username": "Bram", "bio": "Bio van Bram", "mood": "\U0001F60E Lekker bezig", "avatar_url": "\U0001F419", "online_status": True,
               "laatst_gezien": "2026-10-07T10:00:00Z", "offline_emoji": "\U0001F4A4", "offline_bericht": "Even weg", "accent_kleur": "#ff00aa"},
        LOTTE: {"id": LOTTE, "username": "Lotte", "bio": "Bio van Lotte", "mood": "\U0001F338 Bloemen", "avatar_url": "\U0001F338", "online_status": False,
                "laatst_gezien": "2026-10-07T09:00:00Z"}}
EIGEN = {"id": UID, "username": "Marcel", "achtergrond_kleur": "#1a0a2e", "accent_kleur": "#c084fc"}
def gb(vid):
    return [{"id": i, "profile_id": vid, "author_id": UID, "content": f"Groet {i} voor {PROF[vid]['username']}", "created_at": NU,
             "author": {"username": "Marcel", "avatar_url": "\U0001F600", "avatar_data": None}} for i in range(5)]
def supa(route):
    u = route.request.url; m = route.request.method
    if not staat['online']: return route.abort('internetdisconnected')
    if '/auth/v1/logout' in u: return route.fulfill(status=204, body='')
    if '/rest/v1/friendships' in u and m == 'GET':
        return route.fulfill(status=200, json=[{"friend_id": v, "profiles": PROF[v]} for v in PROF])
    if '/rpc/mijn_geblokkeerden' in u: return route.fulfill(status=200, json=[])
    if '/rest/v1/guestbook_entries' in u and m == 'GET':
        for v in PROF:
            if v in u: return route.fulfill(status=200, json=gb(v))
        return route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        for v in PROF:
            if 'id=eq.' + v in u: return route.fulfill(status=200, json=PROF[v] if obj else [PROF[v]])
        return route.fulfill(status=200, json=EIGEN if obj else [EIGEN])
    if m == 'GET': return route.fulfill(status=200, json=[])
    return route.abort()
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
LEES = """() => ({ naam: document.getElementById('profielNaam').textContent, label: document.getElementById('onlineLabel').textContent,
  mood: document.getElementById('moodTekst').textContent, bio: document.getElementById('profielBio').textContent,
  avatar: document.getElementById('avatarEmoji').textContent,
  boek: ((document.querySelector('.gbw-inhoud #gbwLijst') || {}).innerText || '-').replace(/\\s+/g, ' ').slice(0, 90),
  overal: document.body.innerText.includes('Laden...') })"""
LAYOUT = json.dumps([{"id": "gastenboek", "aan": True, "w": 4, "h": 2, "volgorde": 0, "icon": "x", "titel": "Gastenboek"}])
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='allow'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200])); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'index.html'); p.wait_for_timeout(1500); p.evaluate("() => navigator.serviceWorker.ready")
    # gesyncte widgets (zoals sync.js ze in IndexedDB zet): gastenboek-widget bij allebei
    p.evaluate("""([ids, lay]) => new Promise(res => { const r = indexedDB.open('FibroDB', 2); r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos', { keyPath: 'id' }) };
      r.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite'); for (const v of ids) tx.objectStore('fotos').put({ id: 'vriend_' + v + '_layout', data: lay }); tx.oncomplete = res } })""", [[BRAM, LOTTE], LAYOUT])
    p.goto(B + 'vrienden.html'); p.wait_for_function("() => document.querySelectorAll('.friend-row').length > 0", timeout=20000)
    print('1. Online: alleen het profiel van Bram openen')
    p.goto(B + 'vriend-profiel.html?id=' + BRAM); p.wait_for_function("() => document.getElementById('profielNaam').textContent === 'Bram'", timeout=15000); p.wait_for_timeout(2000)
    r = p.evaluate(LEES); check('online Bram', r['naam'] == 'Bram' and 'Groet 0 voor Bram' in r['boek'], r)
    print('2. Zonder internet')
    srv.kill(); srv.wait(); staat['online'] = False
    cdp = ctx.new_cdp_session(p); cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    for vid, naam, eerder in [(BRAM, 'Bram', True), (LOTTE, 'Lotte', False)]:
        t0 = time.time(); p.goto(B + 'vriend-profiel.html?id=' + vid); p.wait_for_timeout(2500)
        r = p.evaluate(LEES)
        print('   ', naam, round(time.time() - t0, 1), 's', r)
        check(naam + ' offline: naam', r['naam'] == naam, r['naam'])
        check(naam + ' offline: geen Laden...', not r['overal'])
        check(naam + ' offline: mood en bio', r['bio'] == 'Bio van ' + naam and r['mood'] not in ('Laden...', 'Geen mood'), (r['mood'], r['bio']))
        if eerder: check(naam + ' offline: gastenboek bewaard', 'Groet 0 voor Bram' in r['boek'], r['boek'])
        else: check(naam + ' offline: gastenboek zegt geen internet', 'internet' in r['boek'].lower(), r['boek'])
    ONB = 'dddd0003-0000-4000-8000-000000000003'
    p.goto(B + 'vriend-profiel.html?id=' + ONB); p.wait_for_timeout(2500); r = p.evaluate(LEES)
    check('onbekende vriend offline: geen Laden...', not r['overal'] and r['naam'] == 'Vriend' and 'nog niet op dit toestel' in r['mood'] and r['label'].endswith('Geen internet'), r)
    print('3. Uitloggen wist het (weer online)')
    srv = start_srv(); staat['online'] = True
    cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    voor = p.evaluate("u => Object.keys(localStorage).filter(k => k.startsWith('fibro_vriendgb_' + u + '_') || (k.startsWith('vriend_cache_') && k.endsWith('_' + u)))", UID)
    check('voor uitloggen bewaard', len(voor) >= 2, voor)
    p.goto(B + 'index.html'); p.wait_for_function("() => document.getElementById('heroNaam').textContent !== 'Laden...'", timeout=15000)
    with p.expect_navigation(url='**/login.html', timeout=15000): p.evaluate("() => { window.uitloggen() }")
    na = p.evaluate("u => Object.keys(localStorage).filter(k => k.startsWith('fibro_vriendgb_' + u + '_') || (k.startsWith('vriend_cache_') && k.endsWith('_' + u)))", UID)
    check('na uitloggen (Home) gewist', na == [], na)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
