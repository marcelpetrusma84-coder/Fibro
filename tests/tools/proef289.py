# proef289 (11 nov 2026): foutmelding "null is not an object (evaluating 'document.getElementById('reg-username').value')"
#  Na het aanmaken van een account staat in het tabblad Registreren de herstelcode (het formulier is weg).
#  Tik je dan op Inloggen en weer op Registreren, dan zocht login.html het naamveld dat er niet meer is.
#  A. login.html opent zonder paginafouten en vult zelf een gebruikersnaam in
#  B. na de herstelcode: wisselen tussen de tabbladen geeft geen paginafout en de herstelcode blijft staan
#  C. ook via login.html#registreren (hashchange) geen paginafout
# python3 -I proef289.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef289_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("() => localStorage.setItem('fibro_taal', 'nl')")
        # ── A ──
        pg.goto(BASIS + 'login.html')
        try:
            pg.wait_for_function("() => (document.getElementById('reg-username') || {}).value", timeout=10000); a = True
        except Exception: a = False
        check(a, 'A: login.html vult zelf een gebruikersnaam in')
        check(not fouten, 'A: geen paginafouten bij openen (%s)' % fouten)
        # ── B: zo ziet het tabblad eruit na het aanmaken (registreer() vervangt #reg-form door de herstelcode) ──
        pg.evaluate("() => { window.switchTab('registreren'); document.getElementById('reg-form').innerHTML = '<div id=\"herstelcode\">ABCD-EFGH</div>' }")
        pg.evaluate("() => { window.switchTab('inloggen'); window.switchTab('registreren') }")
        pg.wait_for_timeout(500)
        check(not fouten, 'B: tabblad Registreren na de herstelcode: geen paginafout (%s)' % fouten)
        check(pg.evaluate("() => !!document.getElementById('herstelcode')"), 'B: de herstelcode blijft staan')
        # ── C ──
        pg.evaluate("() => { location.hash = 'inloggen' }"); pg.wait_for_timeout(200)
        pg.evaluate("() => { location.hash = 'registreren' }"); pg.wait_for_timeout(500)
        check(not fouten, 'C: via #registreren: geen paginafout (%s)' % fouten)
        b.close()
finally:
    srv.terminate()
print('\n%d fout(en)' % len(fout) if fout else '\nAlles goed')
sys.exit(1 if fout else 0)
