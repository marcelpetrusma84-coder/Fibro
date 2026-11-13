# proef300 (13 nov 2026): uitloggen lukt altijd, ook als de server niet (goed) antwoordt. Marcel kon niet uitloggen:
# hij kwam op 'Je sessie wordt hersteld' en daarna weer op Home, omdat de inlogpas van het toestel bleef staan.
#  A. de server antwoordt met een fout (500) op uitloggen: toch het aanmeldscherm, inlogpas weg, niet terug naar Home
#  B. de server antwoordt helemaal niet: na hooguit een paar seconden toch het aanmeldscherm, inlogpas weg
#  C. daarna opnieuw de app openen (login.html): het aanmeldformulier, geen sessielader; geen paginafouten
# python3 -I proef300.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
UITLOG = {'soort': 'fout'}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/auth/v1/logout' in u:
        if UITLOG['soort'] == 'fout': return route.fulfill(status=500, json={"message": "storing"})
        return None   # geen antwoord: het verzoek blijft hangen
    if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": UID, "aud": "authenticated", "user_metadata": {}})
    if '/rest/v1/profiles' in u and m == 'GET':
        rij = {"id": UID, "username": "Marcel", "public_key": "pk", "is_moderator": False}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=rij)
        return route.fulfill(status=200, json=[rij])
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    return route.fulfill(status=200, json=[])

www = tempfile.mkdtemp(prefix='proef300_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
PAS = "() => Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token')).length"
FORMULIER = "() => location.pathname.endsWith('/login.html') && !document.documentElement.hasAttribute('data-login-sessie') && !!document.getElementById('login-username')"

def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False

def ronde(ctx, soort, letter):
    UITLOG['soort'] = soort
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("t => { localStorage.clear(); localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); localStorage.setItem('fibro_privkey_" + UID + "', 'x'); localStorage.setItem('fibro_profiel_" + UID + "', JSON.stringify({ naam: 'Marcel' })) }", TOKEN)
    pg.goto(BASIS + 'index.html'); pg.wait_for_selector('#uitlogBtn', timeout=15000); time.sleep(1.5)
    begin = time.time()
    pg.click('#uitlogBtn')
    op_login = wacht(pg, FORMULIER, 12000)
    duur = time.time() - begin
    check(op_login, '%s: na Uitloggen het aanmeldformulier (geen "Je sessie wordt hersteld") na %.1f s' % (letter, duur))
    check(pg.evaluate(PAS) == 0, '%s: de inlogpas van dit toestel is weg' % letter)
    time.sleep(3)
    check(pg.evaluate("() => location.pathname.endsWith('/login.html')"), '%s: en je gaat niet vanzelf terug naar Home' % letter)
    return pg

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True)
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
        ronde(ctx, 'fout', 'A').close()
        pg = ronde(ctx, 'hangt', 'B')
        pg.goto(BASIS + 'login.html'); time.sleep(1.5)
        check(pg.evaluate(FORMULIER), 'C: de app opnieuw openen = het aanmeldformulier, geen sessielader')
        check(not fouten, 'C: geen paginafouten ' + ' | '.join(fouten))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT: %s' % (len(fout), '; '.join(fout))))
sys.exit(1 if fout else 0)
