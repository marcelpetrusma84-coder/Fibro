# proef344 (26 nov 2026, Marcel): de kaart "Speel met een vriend" bovenaan Home (startkaart.js).
#  A. een nieuw account met een vriend: de kaart staat er met Four in a Row, Tic-Tac-Toe en Chess
#  B. een spel aantikken: eerst het titelscherm, dan opent dat spel (spel.html?spel=...)
#  C. het kruisje haalt de kaart weg, ook na opnieuw laden
#  D. is er een uitnodiging verstuurd (de markering uit spel.html), dan komt de kaart niet meer terug
#  E. een account zonder vrienden: "Nodig eerst een vriend uit" met een knop naar Vrienden
# Op de oude versie mislukt A (er was geen kaart).
# python3 -I proef344.py <map>
import sys, os, re, json, time, base64, functools, http.server, threading
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, p): return super().translate_path(p.removeprefix('/Fibro'))
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=MAP)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASIS = 'http://127.0.0.1:%d/Fibro/' % srv.server_port
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
jwt = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'role': 'authenticated', 'exp': int(time.time()) + 7200, 'aud': 'authenticated'}) + '.x'
user = {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'nieuw@x.nl', 'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'user_metadata': {'username': 'Nieuweling'}, 'app_metadata': {}}
sessie = {'access_token': jwt, 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'user': user}
VRIENDEN = [1]
def supabase(route):
    u = route.request.url
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=user)
    if '/rest/v1/friendships' in u:
        n = VRIENDEN[0]
        return route.fulfill(status=200, json=[], headers={'content-range': ('0-0/%d' % n) if n else '*/0', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range'})
    if '/rest/v1/profiles' in u: return route.fulfill(status=200, json=[{'id': UID, 'username': 'Nieuweling', 'public_key': 'x'}])
    return route.fulfill(status=200, json=[])
fouten = []
def open_home(ctx):
    pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + 'index.html')
    try: pg.get_by_text('Later (via Profiel bewerken)').click(timeout=4000)
    except Exception: pass
    return pg
def wacht(pg, js, ms=8000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL', has_touch=True)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        ctx.route('**/*supabase.co/**', supabase)
        s0 = ctx.new_page(); s0.goto(BASIS + 'manifest.json')
        s0.evaluate("([s]) => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify(s)) }", [sessie]); s0.close()
        # A
        pg = open_home(ctx)
        check(wacht(pg, "() => !!document.querySelector('.start-kaart')"), 'A: de kaart "Speel met een vriend" staat op Home')
        namen = pg.evaluate("() => [...document.querySelectorAll('.start-kaart-spel')].map(b => b.dataset.spel)")
        check(namen == ['vieroprij', 'botkaaseiren', 'schaken'], 'A: Four in a Row, Tic-Tac-Toe en Chess (%s)' % namen)
        check('Speel met een vriend' in pg.inner_text('.start-kaart'), 'A: met de kop')
        # B
        pg.click('.start-kaart-spel[data-spel="vieroprij"]')
        check(wacht(pg, "() => !!document.querySelector('.fibro-titelscherm')", 6000), 'B: eerst het titelscherm van Four in a Row (zoals bij elk spel op Home)')
        try: pg.locator('.fibro-titelscherm').click(position={'x': 150, 'y': 400}, timeout=3000)
        except Exception: pass
        check(wacht(pg, "() => [...document.querySelectorAll('iframe')].some(f => /spel\\.html\\?spel=vieroprij/.test(f.src))", 8000), 'B: na een tik opent het spel (spel.html?spel=vieroprij)')
        pg.close()
        # C
        pg = open_home(ctx); wacht(pg, "() => !!document.querySelector('.start-kaart')")
        pg.click('.start-kaart-sluit')
        check(pg.locator('.start-kaart').count() == 0, 'C: het kruisje haalt de kaart weg')
        pg.reload(); time.sleep(2.5)
        check(pg.locator('.start-kaart').count() == 0, 'C: na opnieuw laden blijft hij weg')
        pg.close()
        # D
        s1 = ctx.new_page(); s1.goto(BASIS + 'manifest.json'); s1.evaluate("([u]) => localStorage.removeItem('fibro_startkaart_klaar_' + u)", [UID]); s1.close()
        pg = open_home(ctx); wacht(pg, "() => !!document.querySelector('.start-kaart')")
        pg.evaluate("async ([u]) => { const m = await import('./startkaart.js?v=1'); m.markeerKlaar(localStorage, u) }", [UID])
        pg.reload(); time.sleep(2.5)
        check(pg.locator('.start-kaart').count() == 0, 'D: na een verstuurde uitnodiging komt de kaart niet terug')
        pg.close()
        # E
        s1 = ctx.new_page(); s1.goto(BASIS + 'manifest.json'); s1.evaluate("([u]) => localStorage.removeItem('fibro_startkaart_klaar_' + u)", [UID]); s1.close()
        VRIENDEN[0] = 0
        pg = open_home(ctx)
        check(wacht(pg, "() => !!document.querySelector('.start-kaart-vrienden')"), 'E: zonder vrienden: "Nodig eerst een vriend uit"')
        check(pg.locator('.start-kaart-spel').count() == 0, 'E: en geen spelknoppen')
        pg.click('.start-kaart-vrienden')
        check(wacht(pg, "() => /vrienden\\.html/.test(location.href)", 8000), 'E: de knop gaat naar Vrienden')
        pg.close()
        b.close()
        check(not fouten, 'geen paginafouten %s' % fouten)
except Exception as e:
    check(False, 'proef afgebroken: %s' % str(e).split('\n')[0])
print('\n%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
