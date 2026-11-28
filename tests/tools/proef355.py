# proef355 (27 nov 2026, Marcel): widgets uit één lijst (widgets.js).
#  A. Home: de widgets Scorebord en Casino komen uit widgets.js en tekenen zichzelf; openSpel opent een spel
#  B. de Store toont ze, met de uitleg uit widgets.js
#  C. het sjabloon voor een nieuwe widget (sjabloon-widget.js) tekent zichzelf en telt je tikken
#  D. geen paginafouten
# Op de oude versie mislukt C (er was geen sjabloon).
# python3 -I proef355.py <map>
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
UID = 'aaaaaaaa-0000-4000-8000-000000000355'; TIJN = 'bbbbbbbb-0000-4000-8000-000000000355'; BRAM = 'cccccccc-0000-4000-8000-000000000355'
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
jwt = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'role': 'authenticated', 'exp': int(time.time()) + 7200, 'aud': 'authenticated'}) + '.x'
user = {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'marcel@x.nl', 'created_at': '2026-01-01T00:00:00Z', 'user_metadata': {'username': 'Marcel'}}
sessie = {'access_token': jwt, 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'user': user}
VOLGENDE = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + 3 * 86400 - 600))
STAND = {'saldo': 230}
def supabase(route):
    u = route.request.url
    if '/rpc/casino_overzicht' in u:
        return route.fulfill(status=200, json={'saldo': STAND['saldo'], 'volgende': '2026-11-30T00:00:00+01:00', 'laatste': [],
            'vrienden': [{'user_id': UID, 'username': 'Marcel', 'saldo': STAND['saldo']}]})
    if '/rpc/spel_scores_overzicht' in u:
        return route.fulfill(status=200, json=[{'spel': 'vieroprij', 'soort': 'winst', 'mijn': 4, 'laatst': '2026-11-26T10:00:00Z', 'vriend': None}])
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=user)
    if '/rest/v1/friendships' in u:
        return route.fulfill(status=200, json=[], headers={'content-range': '0-0/1', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range'})
    if '/rest/v1/profiles' in u: return route.fulfill(status=200, json=[{'id': UID, 'username': 'Marcel', 'public_key': 'x'}])
    return route.fulfill(status=200, json=[])
fouten = []
def wacht(pg, js, ms=12000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
WIDGETS = [{'id': 'scorebord', 'icon': '🏆', 'titel': 'Scorebord', 'w': 4, 'h': 3, 'volgorde': 0, 'aan': True},
           {'id': 'casino', 'icon': '🎰', 'titel': 'Casino', 'w': 4, 'h': 3, 'volgorde': 1, 'aan': True}]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL', has_touch=True)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        ctx.route('**/*supabase.co/**', supabase)
        s0 = ctx.new_page(); s0.goto(BASIS + 'manifest.json')
        s0.evaluate("""([s, uid, w]) => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify(s))
          localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify(w)) }""", [sessie, UID, WIDGETS]); s0.close()
        # ── A ── Home: beide widgets uit de lijst tekenen zichzelf
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:300])); pg.on('dialog', lambda d: d.dismiss())
        pg.goto(BASIS + 'index.html')
        try: pg.get_by_text('Later (via Profiel bewerken)').click(timeout=2500)
        except Exception: pass
        check(wacht(pg, "() => document.querySelectorAll('.sbw-rij').length >= 1", 15000), 'A de widget Scorebord (uit widgets.js) staat op Home')
        check(wacht(pg, "() => (document.querySelector('.csw-saldo')?.textContent || '').includes('230')", 15000), 'A de widget Casino (uit widgets.js) staat op Home')
        pg.click('.csw-speel[data-spel=eenentwintigen]')
        check(wacht(pg, "() => !!document.querySelector('iframe[src*=\"spel=eenentwintigen\"], .fibro-titelscherm') || location.href.includes('spel=eenentwintigen')", 8000),
              'A openSpel werkt: de knop Black Jack opent het spel')
        pg.close()
        # ── B ── de Store: de widgets uit de lijst, met hun uitleg
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:300]))
        pg.goto(BASIS + 'store.html')
        try:
            pg.locator('button, [role=tab]', has_text='Widgets').first.click(timeout=4000)
        except Exception: pass
        check(wacht(pg, "() => [...document.querySelectorAll('.item-titel')].some(e => e.textContent === 'Casino') && [...document.querySelectorAll('.item-titel')].some(e => e.textContent === 'Scorebord')", 12000),
              'B Casino en Scorebord staan in de Store')
        uitleg = pg.evaluate("() => [...document.querySelectorAll('.item-uitleg')].map(e => e.textContent).find(t => t.includes('casino-tokens')) || ''")
        check('500' in uitleg, 'B met de uitleg uit widgets.js (%s)' % uitleg[:50])
        pg.close()
        # ── C ── het sjabloon voor een nieuwe widget werkt
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:300]))
        pg.goto(BASIS + 'manifest.json')
        tekst = pg.evaluate("""async () => { document.body.innerHTML = '<div id="vak" style="width:300px;height:150px"></div>'
            const m = await import('./sjabloon-widget.js'); const vak = document.getElementById('vak')
            m.tekenSjabloonWidget(vak, { uid: 'proef355' }); const voor = vak.innerText
            vak.querySelector('button').click(); vak.querySelector('button').click()
            return [voor, vak.innerText, localStorage.getItem('fibro_sjabloonwidget_proef355')] }""")
        check('0 keer getikt' in tekst[0] and '2 keer getikt' in tekst[1] and tekst[2] == '2', 'C het sjabloon tekent zichzelf en telt (%s)' % tekst)
        ctx.close(); b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
check(not fouten, 'D geen paginafouten (%s)' % fouten[:3])
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
