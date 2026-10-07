import subprocess, sys, time, json
from playwright.sync_api import sync_playwright
S = sys.argv[1]; WWW = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
def start_srv(): 
    p = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=open(S + '/tools/srv8.log', 'a')); time.sleep(0.8); return p
srv = start_srv()
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
staat = {'online': True}
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
GB = [{"id": 1, "profile_id": UID, "author_id": "bbbb0001", "content": "Hallo uit de test", "created_at": NU, "author": {"username": "Bram", "avatar_url": "\U0001F419", "avatar_data": None}}]
VR = [{"friend_id": "bbbb0001", "profiles": {"id": "bbbb0001", "username": "Bram", "avatar_url": "\U0001F419", "online_status": True, "laatst_gezien": NU}},
      {"friend_id": "cccc0002", "profiles": {"id": "cccc0002", "username": "Lotte", "avatar_url": "\U0001F338", "online_status": False}}]
def supa(route):
    u = route.request.url
    if not staat['online']: return route.abort('internetdisconnected')
    if '/rest/v1/guestbook_entries' in u and route.request.method == 'GET': return route.fulfill(status=200, json=GB)
    if '/rest/v1/friendships' in u and route.request.method == 'GET': return route.fulfill(status=200, json=VR)
    if '/rpc/mijn_geblokkeerden' in u: return route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and route.request.method == 'GET':
        prof = {"id": UID, "username": "Marcel", "achtergrond_kleur": "#1a0a2e", "accent_kleur": "#c084fc", "accent_kleur2": "#f472b6", "lettertype": None, "animatie": None}
        return route.fulfill(status=200, json=prof if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [prof])
    return route.abort()
mislukt = []
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='allow')
    ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page()
    p.on('console', lambda m: print('   console:', m.text[:300]) if m.text.startswith('[kast]') or 'solo' in m.text or 'Init fout' in m.text else None)
    p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200]))
    p.on('requestfailed', lambda r: mislukt.append(r.url) if '127.0.0.1' in r.url else None)
    p.goto(B + 'login.html')
    p.evaluate("([t, u]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_widgets_home_' + u, JSON.stringify([{id:'gastenboek', icon:'x', titel:'Gastenboek', w:4, h:4, volgorde:0, aan:true}])) }", [TOKEN, UID])
    p.goto(B + 'index.html'); p.wait_for_timeout(1500); p.evaluate("() => navigator.serviceWorker.ready")
    t0 = time.time(); p.goto(B + 'index.html'); p.wait_for_timeout(2000)
    print('1 online Home: regelt =', p.evaluate("() => !!navigator.serviceWorker.controller"), '| boek:', p.evaluate("() => (document.querySelector('#gbl')||{}).textContent||'-'")[:60])
    # wachten tot de kast gevuld is
    for i in range(40):
        p.wait_for_timeout(1000)
        if p.evaluate("() => !!localStorage.getItem('fibro_kast_gevuld')"): break
    print('2 kast gevuld na', round(time.time() - t0), 's | stempel:', p.evaluate("() => localStorage.getItem('fibro_kast_gevuld')"))
    keys = p.evaluate("async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).map(r => r.url.replace(location.origin + '/Fibro/', '')) }")
    print('  in de kast:', len(keys))
    nodig = ['spel.html', 'vrienden.html', 'chat.html', 'profiel.html', 'vriend-profiel.html', 'solo.js?v=124', 'phaser.min.js?v=1', 'flappy-geluid.js?v=86', 'lettertypen/press-start-2p.css?v=1', 'lettertypen/press-start-2p-latin-400-normal.woff2', 'android-fix.css?v=1', 'kastvullen.js?v=127',
             'bke-ui.js?v=96', 'vieroprij-ui.js?v=115', 'schaken-ui.js?v=96', 'schaak.js?v=95', 'dammen-ui.js?v=96', 'dammen.js?v=95', 'pong-ui.js?v=115', 'ecto-ui.js?v=118', 'blockit-ui.js?v=115', 'swarm-ui.js?v=109', 'twin-snakes-ui.js?v=118', 'runner-gunner-ui.js?v=124', 'flappy-ui.js?v=115', 'invaders-ui.js?v=115', 'solo-bord.js?v=1', 'bordgeluid.js?v=95']
    print('  ontbreekt:', [k for k in nodig if k not in keys])
    print('  html in kast:', sorted(k for k in keys if k.endswith('.html')))
    # tweede keer: stempel -> niets doen
    # offline, Vrienden nooit online geopend
    srv.kill(); srv.wait(); staat['online'] = False
    cdp = ctx.new_cdp_session(p); cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    mislukt.clear()
    p.goto(B + 'vrienden.html'); p.wait_for_timeout(2500)
    print('3 offline Vrienden (nog nooit online geopend):', p.evaluate("() => document.getElementById('vriendenLijst').innerText.replace(/\\s+/g,' ').slice(0,120)"), '| regelt', p.evaluate("() => !!navigator.serviceWorker.controller"))
    t2 = time.time(); p.goto(B + 'index.html'); p.wait_for_function("() => document.getElementById('heroNaam').textContent !== 'Laden...' && document.querySelector('#gbl')", timeout=30000); p.wait_for_timeout(300)
    print('4 offline Home na', round(time.time() - t2, 1), 's: boek:', p.evaluate("() => (document.querySelector('#gbl')||{}).innerText||'-'").replace('\n',' ')[:80], '| naam', p.evaluate("() => document.getElementById('heroNaam').textContent"))
    # spellen
    p.goto(B + 'spel.html?spel=schaken'); p.wait_for_timeout(1500)
    print('5 offline spel.html:', p.evaluate("() => document.title"), '| regelt', p.evaluate("() => !!navigator.serviceWorker.controller"))
    res = p.evaluate("""async () => { const { SOLO_SPELLEN } = await import('./solo.js?v=124'); const uit = {};
      for (const [id, s] of Object.entries(SOLO_SPELLEN)) { try { await import(s.bestand); if (s.motor) await import(s.motor); uit[id] = 'ok' } catch (e) { uit[id] = 'FOUT ' + e.message } }
      for (const f of ['phaser.min.js?v=1', 'flappy-geluid.js?v=86', 'lettertypen/press-start-2p.css?v=1']) { try { const r = await fetch(f); uit[f] = r.ok ? 'ok' : r.status } catch (e) { uit[f] = 'FOUT' } }
      return uit }""")
    print('  spellen offline:', res)
    # vrienden online openen, dan offline
    srv = start_srv(); staat['online'] = True
    cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    p.goto(B + 'vrienden.html'); p.wait_for_function("() => document.querySelectorAll('.friend-row').length > 0", timeout=20000)
    print('6 online Vrienden:', p.evaluate("() => document.getElementById('vriendenLijst').innerText.replace(/\\s+/g,' ').slice(0,120)"))
    srv.kill(); srv.wait(); staat['online'] = False
    cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    t1 = time.time(); p.goto(B + 'vrienden.html'); p.wait_for_function("() => document.querySelectorAll('.friend-row').length > 0", timeout=20000)
    print('7 offline Vrienden: lijst na', round(time.time() - t1, 1), 's:', p.evaluate("() => document.getElementById('vriendenLijst').innerText.replace(/\\s+/g,' ').slice(0,120)"))
    p.wait_for_timeout(3000)
    print('  mislukte verzoeken naar Fibro zelf:', sorted(set(u.replace(B, '') for u in mislukt)))
    br.close()
srv.kill()
