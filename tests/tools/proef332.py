# proef332 (25 nov 2026, Marcel): liken en reageren op een PeerTube-video met je EIGEN fediverse-account (fediverse.js).
# Met de huisregel (Content-Security-Policy) van index.html. Nagemaakt: de PeerTube-speler (spectra.video), de edge
# function fediverse van Stekky, en de inlogpagina van mastodon.social (die meteen terugstuurt, alsof je inlogt).
#  A. onder de speler: "Liken" en "Reageren"; niet ingelogd = eerst een inlogvakje; een rare server = melding
#  B. inloggen: de app gaat naar de inlogpagina van mastodon.social (PKCE, alleen zoeken/liken/reageren); terug via
#     fediverse-terug.html; de sleutel staat alleen op dit toestel, onder dit Stekky-account; de code niet in de geschiedenis
#  C. weer bij de video: "Ingelogd als @marcel@mastodon.social"; Liken = de video opzoeken en liken ("Geliket · 4")
#  D. Reageren: hoogstens 500 tekens, "✓ Geplaatst"; de reactie gaat met de sleutel via Stekky
#  E. de app praat zelf nooit met mastodon.social (alleen de inlogpagina, in het venster zelf); Uitloggen
#  F. geen paginafouten, en de huisregel houdt de app tegen als hij toch rechtstreeks met mastodon.social wil praten
# python3 -I proef332.py <map>
import sys, os, re, json, time, http.server, threading, socketserver, functools, urllib.parse
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=MAP)
Handler.log_message = lambda *a: None
srv = socketserver.TCPServer(('127.0.0.1', 0), Handler)
poort = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASIS = f'http://127.0.0.1:{poort}/'

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
SESSIE = json.dumps({"access_token": "PAS", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
KORT = 'kkGMgK9ZtnKfYAgnEtQxbv'
CFG = {'server': 'spectra.video', 'id': KORT, 'titel': 'Speedrun'}

csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', open(os.path.join(MAP, 'index.html'), encoding='utf-8').read()).group(0)
PAGINA = '''<!doctype html><html><head><meta charset="utf-8">''' + csp + '''
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#1a0a2e;color:#fff;font-family:sans-serif;margin:0}.w{width:360px;min-height:300px;flex-direction:column;margin:12px;border-radius:14px;background:rgba(255,255,255,.08);padding:10px;box-sizing:border-box;display:flex}</style>
</head><body><div class="w" id="w"></div>
<script type="module">
import * as P from './peertube.js?v=5'
import { supabase } from './supabase.js?v=95'
window.csp = []
document.addEventListener('securitypolicyviolation', e => window.csp.push(e.blockedURI))
const geefPas = async () => { const { data } = await supabase.auth.getSession(); return data && data.session ? data.session.access_token : null }
const acties = (el, video) => import('./fediverse.js?v=1').then(F => F.tekenActies(el, F.maakFedi({ uid: '%s', geefPas }), video))
window.teken = () => { const w = document.getElementById('w'); w.textContent = ''; P.tekenPeertubeWidget(w, { cfg: %s, acties }) }
window.teken()
window.klaar = true
</script></body></html>''' % (UID, json.dumps(CFG))
NEP_SPELER = '<!doctype html><html><body style="background:#123;color:#fff">nep-peertube</body></html>'

def wacht(p, js, ms=6000):  # wait_for_function gebruikt eval, en dat houdt de huisregel (terecht) tegen
    for _ in range(ms // 100):
        try:
            if p.evaluate(js): return True
        except Exception: pass
        p.wait_for_timeout(100)
    return False

functie = []     # wat de app aan de edge function vroeg
mastodon = []    # alles wat er naar mastodon.social ging
TOKEN = 'tokenABC123456'
def edge(route):
    req = route.request
    if req.method == 'OPTIONS':
        return route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'}, body='ok')
    b = json.loads(req.post_data or '{}'); b['_pas'] = req.headers.get('authorization'); functie.append(b)
    a = b.get('actie')
    d = {'ok': False, 'reden': 'actie'}
    if a == 'app': d = {'ok': True, 'client_id': 'clientID12345', 'client_secret': 'secretXYZ12345'}
    elif a == 'token': d = {'ok': True, 'token': TOKEN} if b.get('code') == 'codeCODE1234' and len(b.get('verifier', '')) >= 43 else {'ok': False, 'reden': 'gegevens'}
    elif a == 'ik': d = {'ok': True, 'acct': 'marcel', 'naam': 'Marcel'}
    elif a == 'zoek': d = {'ok': True, 'id': '777', 'favoriet': False, 'likes': 3, 'reacties': 1, 'acct': 'gamekanaal@spectra.video'}
    elif a == 'like': d = {'ok': True, 'id': '777', 'favoriet': b.get('aan') is not False, 'likes': 4 if b.get('aan') is not False else 3, 'reacties': 1, 'acct': ''}
    elif a == 'reageer': d = {'ok': True, 'id': '888'}
    elif a == 'uit': d = {'ok': True}
    route.fulfill(status=200 if d['ok'] else 400, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body=json.dumps(d))
def masto(route):
    u = route.request.url; mastodon.append(u)
    q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
    if '/oauth/authorize' in u:
        terug = q['redirect_uri'][0] + '?code=codeCODE1234&state=' + q['state'][0]
        return route.fulfill(status=302, headers={'Location': terug}, body='')
    route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body='{}')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 900}, service_workers='block')
    ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(SESSIE) + ");localStorage.setItem('fibro_taal','nl')}catch(e){}")
    ctx.route('https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/fediverse', edge)
    ctx.route(re.compile(r'^https://qmgatbphiplrfxrljtbe\.supabase\.co/(?!functions/v1/fediverse).*'), lambda r: r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body='{}'))
    ctx.route('https://mastodon.social/**', masto)
    ctx.route('https://spectra.video/**', lambda r: r.fulfill(status=200, content_type='text/html', body=NEP_SPELER))
    ctx.route(BASIS + '__fedi-proef.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGINA))
    p = ctx.new_page()
    p.on('pageerror', lambda e: fout.append('paginafout: ' + str(e)))
    p.goto(BASIS + '__fedi-proef.html'); wacht(p, 'window.klaar === true')

    # A
    p.click('#w .pt-speel')
    check(wacht(p, "!!document.querySelector('#w .fv-like') && !!document.querySelector('#w .fv-reageer')"), 'A onder de speler: Liken en Reageren')
    check(not functie, 'A niet ingelogd: nog niets gevraagd')
    p.click('#w .fv-like')
    check(p.locator('#w .fv-server').count() == 1 and 'wachtwoord' in p.inner_text('#w'), 'A niet ingelogd: eerst een inlogvakje (Stekky ziet je wachtwoord niet)')
    p.fill('#w .fv-server', 'localhost'); p.click('#w .fv-inloggen')
    check('geen geldige server' in p.inner_text('#w .fv-melding') and not functie, 'A een rare server: melding, niets gevraagd')

    # B
    p.fill('#w .fv-server', '@marcel@Mastodon.Social')
    with p.expect_navigation(url=re.compile(r'.*fediverse-terug\.html.*'), timeout=15000):
        p.click('#w .fv-inloggen')
    auth = [u for u in mastodon if '/oauth/authorize' in u]
    check(len(auth) == 1, 'B naar de inlogpagina van mastodon.social (%s)' % len(auth))
    if auth:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(auth[0]).query)
        check(q.get('code_challenge_method') == ['S256'] and len(q.get('code_challenge', [''])[0]) == 43, 'B met PKCE (S256)')
        check(q.get('scope') == ['read:search read:accounts read:statuses write:favourites write:statuses'], 'B alleen zoeken, liken en reageren (%s)' % q.get('scope'))
        check(q.get('redirect_uri') == [BASIS + 'fediverse-terug.html'], 'B terug naar fediverse-terug.html')
    check(wacht(p, "location.pathname.endsWith('__fedi-proef.html')", 10000), 'B terug op de pagina waar je was')
    acc = json.loads(p.evaluate("localStorage.getItem('fibro_fediverse_%s')" % UID) or 'null') or {}
    check(acc.get('token') == TOKEN and acc.get('acct') == '@marcel@mastodon.social', 'B de sleutel staat op dit toestel, onder dit Stekky-account')
    check(p.evaluate("localStorage.getItem('fibro_fediverse_wacht')") is None, 'B de inlogpoging is opgeruimd')
    tok = [f for f in functie if f.get('actie') == 'token']
    check(len(tok) == 1 and tok[0]['_pas'] == 'Bearer PAS', 'B de code is via Stekky omgeruild, met je Stekky-inlogpas')
    check(not any('code=' in h for h in p.evaluate("[location.href]")), 'B de code staat niet meer in het adres')

    # C
    wacht(p, 'window.klaar === true')
    p.click('#w .pt-speel')
    check(wacht(p, "(document.querySelector('#w .fv-wie') || {}).textContent?.includes('@marcel@mastodon.social')"), 'C "Ingelogd als @marcel@mastodon.social"')
    check(wacht(p, "(document.querySelector('#w .fv-like') || {}).textContent?.includes('· 3')"), 'C de video is opgezocht: 3 likes')
    zoek = [f for f in functie if f.get('actie') == 'zoek']
    check(zoek and zoek[-1].get('video') == 'https://spectra.video/videos/watch/' + KORT and zoek[-1].get('token') == TOKEN, 'C opzoeken met de link van de video')
    p.click('#w .fv-like')
    check(wacht(p, "(document.querySelector('#w .fv-like') || {}).textContent?.includes('Geliket · 4')"), 'C geliket: "Geliket · 4"')
    check(p.get_attribute('#w .fv-like', 'aria-pressed') == 'true', 'C de knop staat aan')

    # D
    p.click('#w .fv-reageer')
    check(p.get_attribute('#w .fv-tekst', 'maxlength') == '500', 'D hoogstens 500 tekens')
    p.click('#w .fv-plaats')
    check('Schrijf eerst iets' in p.inner_text('#w .fv-melding'), 'D leeg: "Schrijf eerst iets"')
    p.fill('#w .fv-tekst', 'Wat een goede run!'); p.click('#w .fv-plaats')
    check(wacht(p, "document.querySelector('#w').textContent.includes('✓ Geplaatst')"), 'D "✓ Geplaatst"')
    re_ = [f for f in functie if f.get('actie') == 'reageer']
    check(re_ and re_[-1].get('id') == '777' and re_[-1].get('tekst') == 'Wat een goede run!', 'D de reactie gaat naar de juiste video')

    # E
    check(all('/oauth/authorize' in u for u in mastodon), 'E de app praat zelf nooit met mastodon.social (%s)' % [u for u in mastodon if '/oauth/authorize' not in u])
    p.click('#w .fv-uit')
    check(wacht(p, "localStorage.getItem('fibro_fediverse_%s') === null" % UID), 'E Uitloggen: de sleutel is weg')
    check(functie[-1].get('actie') == 'uit' and functie[-1].get('token') == TOKEN, 'E en ingetrokken bij de server')

    # F
    p.evaluate("fetch('https://mastodon.social/api/v1/accounts/verify_credentials').catch(() => {})")
    check(wacht(p, "window.csp.some(u => u.includes('mastodon.social'))"), 'F de huisregel houdt rechtstreeks praten met mastodon.social tegen')
    b.close()

print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
