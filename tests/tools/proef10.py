import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
S = sys.argv[1]; PORT = int(sys.argv[2]); B = f'http://127.0.0.1:{PORT}/Fibro/'; WWW = S + '/www3'
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
def link(doel):
    if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
    os.symlink(S + '/' + doel, WWW + '/Fibro')
link('fibro')  # eerst de oude stand (fibro-v29)
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
def token(over): return json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + over, "user": {"id": UID}})
staat = {'online': True}
VR = [{"friend_id": "bbbb0001", "profiles": {"id": "bbbb0001", "username": "Bram", "avatar_url": "x"}}]
def supa(route):
    u = route.request.url
    if not staat['online']: return route.abort('internetdisconnected')
    if '/rest/v1/friendships' in u and 'or=' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": "bbbb0001"}])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=VR)
    if '/rpc/mijn_geblokkeerden' in u: return route.fulfill(status=200, json=[])
    if '/rest/v1/guestbook_entries' in u or '/rest/v1/messages' in u: return route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and route.request.method == 'GET':
        prof = {"id": UID, "username": "Marcel", "achtergrond_kleur": "#1a0a2e", "accent_kleur": "#c084fc"}
        lijst = [prof, {"id": "bbbb0001", "username": "Bram", "avatar_url": "x", "public_key": None}]
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=prof)
        return route.fulfill(status=200, json=lijst if 'in.' in u else [prof])
    return route.abort()
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='allow'); ctx.route('**/*supabase.co/**', supa); p = ctx.new_page()
    p.on('console', lambda m: print('   console:', m.text[:160]) if m.text.startswith('[kast]') else None)
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", token(3600))
    p.goto(B + 'index.html'); p.wait_for_timeout(1500); p.evaluate("() => navigator.serviceWorker.ready")
    p.goto(B + 'index.html'); p.wait_for_timeout(2000)
    print('oud:', p.evaluate("async () => (await caches.keys()).join(',')"), '| regelt', p.evaluate("() => !!navigator.serviceWorker.controller"))
    # nieuwe stand online zetten (zoals na git push)
    link('nieuw'); p.wait_for_timeout(300)
    p.goto(B + 'index.html'); p.wait_for_timeout(3000)
    p.goto(B + 'index.html'); p.wait_for_timeout(1000)
    sw = p.evaluate("async () => { const r = await navigator.serviceWorker.getRegistration(); return (await caches.keys()).join(',') + ' | actief: ' + (r && r.active && r.active.state) }")
    print('na update:', sw)
    for i in range(40):
        p.wait_for_timeout(1000)
        st = p.evaluate("() => localStorage.getItem('fibro_kast_gevuld')")
        if st and 'fibro-v30' in st: break
    print('kast:', p.evaluate("async () => { const c = await caches.open('fibro-v30'); return (await c.keys()).length }"), 'bestanden | stempel', p.evaluate("() => localStorage.getItem('fibro_kast_gevuld')"))
    p.goto(B + 'vrienden.html'); p.wait_for_function("() => document.querySelectorAll('.friend-row').length > 0", timeout=20000)
    p.goto(B + 'chat.html'); p.wait_for_timeout(3000)
    # offline met verlopen pas
    p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", token(-60))
    srv.kill(); staat['online'] = False
    cdp = ctx.new_cdp_session(p); cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    for pagina in ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html?id=bbbb0001', 'spel.html?spel=dammen']:
        t0 = time.time(); p.goto(B + pagina); p.wait_for_timeout(3000)
        info = p.evaluate("() => location.pathname.split('/').pop() + ' | regelt=' + !!(navigator.serviceWorker && navigator.serviceWorker.controller) + ' | ' + document.body.innerText.replace(/\\s+/g, ' ').slice(0, 110)")
        print(pagina.ljust(30), '->', info)
    # chat: Bram openen
    p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length > 0", timeout=10000)
    t0 = time.time(); p.click('#vriendenLijst .vriend-item')
    p.wait_for_function("() => getComputedStyle(document.getElementById('chatScherm')).display !== 'none' && document.getElementById('messages').innerText.length > 0", timeout=40000)
    print('chat met Bram open na', round(time.time() - t0, 1), 's:', p.evaluate("() => document.getElementById('messages').innerText.replace(/\\s+/g,' ').slice(0,100)"))
    br.close()
