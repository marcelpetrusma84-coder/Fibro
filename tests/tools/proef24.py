import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef24: balkje "Server even niet bereikbaar" (verbinding.js) als Supabase niet antwoordt;
# weg zodra de server weer antwoordt; niet bij een losse hapering, niet bij 401, niet zonder internet.
# python3 -I proef24.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www24_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
staat = {'modus': 'goed'}
def supa(route):
    u = route.request.url; m = route.request.method
    if staat['modus'] == 'kapot': return route.fulfill(status=503, json={"message": "even weg"})
    if staat['modus'] == 'weg': return route.abort('connectionrefused')
    if staat['modus'] == '401': return route.fulfill(status=401, json={"message": "nee"})
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        e = {"id": UID, "username": "marcel"}
        return route.fulfill(status=200, json=e if obj else [e])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
BALK = "() => { const b = document.getElementById('fibro-server-balk'); return b && b.style.display !== 'none' ? b.textContent : null }"
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200]))); p.on('dialog', lambda d: d.dismiss())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    for pg in ['index.html', 'vrienden.html', 'chat.html', 'profiel.html']:
        staat['modus'] = 'goed'; p.goto(B + pg); p.wait_for_timeout(2500)
        check(pg + ': server goed, geen balkje', p.evaluate(BALK) is None, p.evaluate(BALK))
        staat['modus'] = 'kapot'; p.goto(B + pg); p.wait_for_timeout(3000)
        b = p.evaluate(BALK)
        check(pg + ': server geeft fouten, balkje', b is not None and 'Server even niet bereikbaar' in b, b)
    staat['modus'] = 'weg'; p.goto(B + 'index.html'); p.wait_for_timeout(3000)
    check('server helemaal weg: balkje', p.evaluate(BALK) is not None, p.evaluate(BALK))
    p.wait_for_timeout(6500)
    check('na 6 s klein', p.evaluate(BALK) == '⚠️', p.evaluate(BALK))
    staat['modus'] = 'goed'
    p.evaluate("() => fetch('https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/profiles?select=id').catch(() => {})"); p.wait_for_timeout(800)
    check('server weer goed: balkje weg', p.evaluate(BALK) is None, p.evaluate(BALK))
    p.evaluate("() => { const f = () => fetch('https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/x').catch(() => {}); return f() }")
    staat['modus'] = 'kapot'
    p.evaluate("() => fetch('https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/x').catch(() => {})"); p.wait_for_timeout(500)
    check('één losse hapering: geen balkje', p.evaluate(BALK) is None, p.evaluate(BALK))
    staat['modus'] = '401'
    for i in range(3): p.evaluate("() => fetch('https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/x').catch(() => {})")
    p.wait_for_timeout(500)
    check('401 (geen toegang): geen balkje', p.evaluate(BALK) is None, p.evaluate(BALK))
    staat['modus'] = 'kapot'
    cdp = ctx.new_cdp_session(p); cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    p.wait_for_timeout(300)
    for i in range(3): p.evaluate("() => fetch('https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/x').catch(() => {})")
    p.wait_for_timeout(500)
    o = p.evaluate("() => { const b = document.getElementById('fibro-offline-balk'); return b && b.style.display !== 'none' }")
    check('zonder internet: geen serverbalkje (wel het internetbalkje)', p.evaluate(BALK) is None and o, (p.evaluate(BALK), o))
    check('geen fouten op de pagina', perr == [], perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
