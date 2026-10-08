import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# keuring: (axe-core eerst: npm install axe-core@4.10.2 in <scratch>/axe)
# python3 -I keuring.py <scratch> <map> <poort>
# (1) kwaadaardige namen/teksten van de server worden niet uitgevoerd (XSS),
# (2) pagina's geven geen fouten als de server faalt, (3) toegankelijkheid (axe-core), (4) laadtijd.
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
AXE = open(S + '/axe/node_modules/axe-core/axe.min.js').read()
WWW = S + '/wwwk_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
K = '<img src=x onerror="window.__xss=(window.__xss||0)+1">'
staat = {'kapot': False}
PROF = {"id": BRAM, "username": "Bram" + K, "bio": "bio" + K, "mood": "\U0001F600 " + K, "avatar_url": K, "online_status": True,
        "laatst_gezien": "2026-10-08T09:00:00Z", "offline_emoji": K, "offline_bericht": K}
EIGEN = {"id": UID, "username": "marcel" + K, "bio": K, "offline_emoji": K, "offline_bericht": K, "avatar_url": K}
def supa(route):
    u = route.request.url; m = route.request.method
    if staat['kapot']: return route.fulfill(status=500, json={"message": "kapot"})
    if '/rest/v1/friendships' in u and m == 'GET': return route.fulfill(status=200, json=[{"friend_id": BRAM, "profiles": PROF, "user_id": UID, "status": "accepted"}])
    if '/rest/v1/guestbook_entries' in u and m == 'GET':
        return route.fulfill(status=200, json=[{"id": 1, "profile_id": UID, "author_id": BRAM, "content": "hoi" + K, "created_at": "2026-10-08T09:00:00Z", "author": {"username": K, "avatar_url": K}}])
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        d = PROF if BRAM in u else EIGEN
        return route.fulfill(status=200, json=d if obj else [d])
    return route.fulfill(status=200, json=[])
PAGINAS = ['index.html', 'vrienden.html', 'chat.html', 'profiel.html', 'vriend-profiel.html?id=' + BRAM, 'over.html', 'spel.html?spel=pong', 'login.html']
uit = {}
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); fout = []
    p.on('pageerror', lambda e: fout.append(str(e)[:160])); p.on('dialog', lambda d: d.dismiss())
    p.goto(B + 'login.html')
    p.evaluate("([t, uid, id]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_widgets_home_' + uid, JSON.stringify([{id:'gastenboek',aan:true,w:4,h:4,volgorde:0}])) }", [TOKEN, UID, BRAM])
    for ronde in ['normaal', 'server kapot']:
        staat['kapot'] = ronde != 'normaal'
        for pg in PAGINAS:
            fout.clear()
            t0 = time.time(); p.goto(B + pg); p.wait_for_timeout(3500)
            xss = p.evaluate("() => window.__xss || 0")
            r = {'xss': xss, 'fouten': list(fout)}
            if ronde == 'normaal' and not pg.startswith('login'):
                p.add_script_tag(content=AXE)
                ax = p.evaluate("""async () => { const r = await axe.run(document, { resultTypes: ['violations'] });
                  return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length })) }""")
                r['axe'] = ax
            uit[(ronde, pg)] = r
    br.close()
srv.kill()
for (ronde, pg), r in uit.items():
    print(f"[{ronde}] {pg}: xss={r['xss']} fouten={len(r['fouten'])} {r['fouten'][:2]}")
    if 'axe' in r: print('     toegankelijkheid:', ', '.join(f"{v['id']}({v['impact']},{v['n']})" for v in r['axe']))
