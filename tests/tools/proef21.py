import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef21: vriend-profiel - spel van een vriend: tikken = zelf spelen; lege poll/timer zeggen dat;
# nieuwe gegevens van de sync (BroadcastChannel fibro-vriend-data) werken de widgets meteen bij
# python3 -I proef21.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www21_' + str(PORT); os.makedirs(WWW, exist_ok=True)
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
    PO = '{"id":"mumaor3mhzzs4k","vraag":"Word het mooi weer vandaag?","opties":[{"tekst":"Ja","stemmen":1},{"tekst":"Nee","stemmen":0}],"gestemd":true}'
    LAY2 = json.dumps([{"id": i, "aan": True, "w": 4, "h": 2, "volgorde": n, "icon": "x", "titel": i} for n, i in enumerate(['poll', 'afteltimer', 'spel_pong'])])
    ZET = """([id, sleutel, data]) => new Promise(res => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite');
      tx.objectStore('fotos').put({ id: 'vriend_' + id + '_' + sleutel, data, hash: 'h' }); tx.oncomplete = res } })"""
    p.evaluate(ZET, [BRAM, 'layout', LAY2])
    p.goto(B + 'vriend-profiel.html?id=' + BRAM); p.wait_for_timeout(4000)
    t = p.evaluate("() => document.getElementById('vriendWidgetGrid').innerText.replace(/\\s+/g, ' ')")
    check('lege poll en timer zeggen dat', 'Nog geen poll' in t and 'Nog geen datum' in t, t)
    check('spel heeft een Spelen-knop', 'Spelen' in t, t)
    print('2. Poll komt binnen terwijl het profiel open staat')
    p.evaluate(ZET, [BRAM, 'poll', PO])
    p.evaluate("id => { const k = new BroadcastChannel('fibro-vriend-data'); k.postMessage({ id: 'vriend_' + id + '_poll' }) }", BRAM)
    p.wait_for_timeout(2500)
    t = p.evaluate("() => document.getElementById('vriendWidgetGrid').innerText.replace(/\\s+/g, ' ')")
    check('poll meteen zichtbaar, zonder verversen', 'Word het mooi weer vandaag?' in t and 'Nog geen poll' not in t, t)
    n = p.evaluate("() => document.querySelectorAll('#vriendWidgetGrid .widget-blok').length")
    check('geen dubbele widgets na bijwerken', n == 3, n)
    p.evaluate("id => { const k = new BroadcastChannel('fibro-vriend-data'); k.postMessage({ id: 'vriend_andere-vriend_poll' }) }", BRAM)
    print('3. Op het spel tikken')
    with p.expect_navigation(url='**/spel.html?spel=pong', timeout=8000):
        p.click('#vriendWidgetGrid .widget-blok >> nth=2')
    check('spel.html?spel=pong geopend', p.url.endswith('spel.html?spel=pong'), p.url)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
