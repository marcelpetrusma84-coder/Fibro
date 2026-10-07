import subprocess, sys, time, json
from playwright.sync_api import sync_playwright
S = sys.argv[1]; variant = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', S + '/www', str(PORT)], stderr=subprocess.DEVNULL); time.sleep(1)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": "aaaaaaaa-0000-4000-8000-000000000001"}})
test = open(S + '/tools/deur-test.js').read()
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='allow')
    ctx.route('**/*supabase.co/**', lambda r: r.abort()); p = ctx.new_page()
    p.on('dialog', lambda d: (print(variant.ljust(16), d.message), d.accept()))
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'index.html'); p.wait_for_timeout(1500); p.evaluate("() => navigator.serviceWorker.ready")
    p.goto(B + 'index.html'); p.wait_for_timeout(1500)
    cdp = ctx.new_cdp_session(p); cdp.send('Network.enable')
    if 'hard' in variant: cdp.send('Page.reload', {'ignoreCache': True}); p.wait_for_timeout(2000)
    if 'bypass' in variant: cdp.send('Network.setBypassServiceWorker', {'bypass': True})
    if 'offline' in variant: srv.kill(); srv.wait()
    p.evaluate(test); p.wait_for_timeout(9000)
    br.close()
srv.kill()
