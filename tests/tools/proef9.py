import subprocess, sys, time, json
from playwright.sync_api import sync_playwright
S = sys.argv[1]; WWW = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
def token(over): return json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + over, "user": {"id": UID}})
staat = {'online': True}
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
VR = [{"friend_id": "bbbb0001", "profiles": {"id": "bbbb0001", "username": "Bram", "avatar_url": "x"}}]
def supa(route):
    u = route.request.url
    if not staat['online']: return route.abort('internetdisconnected')
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=VR)
    if '/rpc/mijn_geblokkeerden' in u: return route.fulfill(status=200, json=[])
    if '/rest/v1/guestbook_entries' in u: return route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and route.request.method == 'GET':
        prof = {"id": UID, "username": "Marcel", "achtergrond_kleur": "#1a0a2e", "accent_kleur": "#c084fc"}
        return route.fulfill(status=200, json=prof if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [prof])
    return route.abort()
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='allow'); ctx.route('**/*supabase.co/**', supa); p = ctx.new_page()
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", token(3600))
    p.goto(B + 'index.html'); p.wait_for_timeout(1500); p.evaluate("() => navigator.serviceWorker.ready")
    p.goto(B + 'index.html'); p.wait_for_timeout(3000)
    p.goto(B + 'vrienden.html'); p.wait_for_function("() => document.querySelectorAll('.friend-row').length > 0", timeout=20000)
    p.goto(B + 'chat.html'); p.wait_for_timeout(3000)
    # pas verlopen, offline
    p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", token(-60))
    srv.kill(); staat['online'] = False
    cdp = ctx.new_cdp_session(p); cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    for pagina, klaar in [('index.html', "document.getElementById('heroNaam').textContent !== 'Laden...'"),
                          ('vrienden.html', "document.querySelectorAll('.friend-row').length > 0"),
                          ('chat.html', "document.querySelectorAll('#vriendenLijst .vriend-item').length > 0")]:
        t0 = time.time(); p.goto(B + pagina)
        try:
            p.wait_for_function("() => " + klaar, timeout=90000); print(pagina.ljust(14), 'klaar na', round(time.time() - t0, 1), 's (pas verlopen, offline)')
        except Exception: print(pagina.ljust(14), 'na 90 s nog niet klaar')
    br.close()
