# proef352 (27 nov 2026, Marcel): casino-tokens (casino.js, casinowidget.js, sql/casino-tokens.sql) in Black Jack.
#  A. Home met de widget 🎰 Casino: je saldo (🪙 230), wanneer de volgende 250 komen, de rijkste vrienden (👑 met de naam
#     die jij je vriend gaf, "Jij" gemarkeerd); ♠️ Black Jack opent het spel
#  B. Black Jack tegen de computer met saldo -50: eerst het inzetscherm; 10, 25 en 50 mogen, 100 niet (dan zou je onder
#     -100 komen). Inzet 50 gaat naar de server (casino_inzet), tijdens het potje staat 🪙 50 op tafel; aan het eind
#     precies één casino_uitslag die past bij wat het spel zegt, en het nieuwe saldo in het eindscherm
#  C. ↻ Opnieuw spelen: weer het inzetscherm, nu met het saldo van de server; "Zonder inzet spelen" = geen uitslag naar de server
#  D. zonder verbinding met de casino-lijst: geen inzetscherm, het spel begint gewoon
#  E. geen paginafouten
# Op de oude versie mislukken A (geen widget) en B (geen inzetscherm).
# python3 -I proef352.py <map>
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
UID = 'aaaaaaaa-0000-4000-8000-000000000352'; TIJN = 'bbbbbbbb-0000-4000-8000-000000000352'; BRAM = 'cccccccc-0000-4000-8000-000000000352'
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
jwt = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'role': 'authenticated', 'exp': int(time.time()) + 7200, 'aud': 'authenticated'}) + '.x'
user = {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'marcel@x.nl', 'created_at': '2026-01-01T00:00:00Z', 'user_metadata': {'username': 'Marcel'}}
sessie = {'access_token': jwt, 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'user': user}
VOLGENDE = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + 3 * 86400 - 600))
STAND = {'saldo': 230, 'kapot': False}
INZETTEN, UITSLAGEN, OPEN = [], [], {}
def overzicht():
    return {'saldo': STAND['saldo'], 'weekbedrag': 250, 'minimum': -100, 'max_inzet': 100, 'volgende': VOLGENDE, 'laatste': [],
            'vrienden': [{'user_id': TIJN, 'username': 'tijn_echt', 'saldo': 520}, {'user_id': UID, 'username': 'Marcel', 'saldo': STAND['saldo']},
                         {'user_id': BRAM, 'username': 'bram', 'saldo': 10}]}
def supabase(route):
    u = route.request.url
    body = json.loads(route.request.post_data or '{}') if route.request.method == 'POST' else {}
    if '/rpc/casino_overzicht' in u:
        return route.fulfill(status=500, json={'message': 'kapot'}) if STAND['kapot'] else route.fulfill(status=200, json=overzicht())
    if '/rpc/casino_inzet' in u:
        INZETTEN.append(body)
        n = body.get('p_inzet')
        if STAND['saldo'] - n < -100: return route.fulfill(status=400, json={'message': 'Not enough tokens', 'code': 'P0001'})
        STAND['saldo'] -= n; OPEN[body.get('p_run_id')] = n
        return route.fulfill(status=200, json={'saldo': STAND['saldo'], 'inzet': n, 'al': False})
    if '/rpc/casino_uitslag' in u:
        UITSLAGEN.append(body)
        n = OPEN.pop(body.get('p_run_id'), None)
        if n is None: return route.fulfill(status=400, json={'message': 'Unknown bet'})
        STAND['saldo'] += {'winst': 2 * n, 'gelijk': n}.get(body.get('p_uitslag'), 0)
        return route.fulfill(status=200, json={'saldo': STAND['saldo']})
    if '/rpc/spel_score_opslaan' in u: return route.fulfill(status=204, body='')
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=user)
    if '/rest/v1/friendships' in u:
        return route.fulfill(status=200, json=[], headers={'content-range': '0-0/1', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range'})
    if '/rest/v1/profiles' in u: return route.fulfill(status=200, json=[{'id': UID, 'username': 'Marcel', 'public_key': 'x'}])
    return route.fulfill(status=200, json=[])
WIDGETS = [{'id': 'casino', 'icon': '🎰', 'titel': 'Casino', 'w': 4, 'h': 3, 'volgorde': 0, 'aan': True}]
fouten = []
def wacht(pg, js, ms=8000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def nieuwe_ctx(b):
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL', has_touch=True)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.route('**/*supabase.co/**', supabase)
    s0 = ctx.new_page(); s0.goto(BASIS + 'manifest.json')
    s0.evaluate("""([s, uid, tijn, w]) => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify(s))
      localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify(w)); localStorage.setItem('vriend_naam_' + uid + '_' + tijn, 'Tijntje') }""",
      [sessie, UID, TIJN, WIDGETS]); s0.close()
    return ctx
def open_pg(ctx, adres):
    pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + adres)
    try: pg.get_by_text('Later (via Profiel bewerken)').click(timeout=3000)
    except Exception: pass
    return pg
def speel_uit(pg):
    """Tik op Ik blijf tot het eindscherm er is. Geeft de titel van het eindscherm."""
    for _ in range(14):
        if pg.evaluate("() => !!document.querySelector('.kt-einde')"): break
        try: pg.click('button[data-naam=blijf]', timeout=2500)
        except Exception: pass
        pg.wait_for_timeout(1000)
    wacht(pg, "() => !!document.querySelector('.kt-einde')", 15000)
    pg.wait_for_timeout(1500)
    return pg.evaluate("() => [document.querySelector('.kt-eindetitel')?.textContent || '', document.querySelector('.kt-eindesub')?.textContent || '']")
VRIJ = "() => [...document.querySelectorAll('.cas-fiche')].map(b => [Number(b.dataset.inzet), !b.disabled])"

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = nieuwe_ctx(b)
        # ── A ── de widget op Home
        pg = open_pg(ctx, 'index.html')
        check(wacht(pg, "() => !!document.querySelector('.csw-saldo') && document.querySelector('.csw-saldo').textContent.includes('230')", 15000),
              'A: de widget Casino staat op Home met je saldo 🪙 230')
        sub = pg.evaluate("() => document.querySelector('.csw-sub')?.textContent || ''")
        check('+250 over 3 dagen' in sub, 'A: wanneer de volgende 250 komen (%s)' % sub)
        rijen = pg.evaluate("() => [...document.querySelectorAll('.csw-rij')].map(r => ({ ik: r.classList.contains('ik'), tekst: r.innerText.replace(/\\s+/g, ' ') }))")
        check(len(rijen) == 3 and '👑' in rijen[0]['tekst'] and 'Tijntje' in rijen[0]['tekst'] and '520' in rijen[0]['tekst']
              and rijen[1]['ik'] and 'Jij' in rijen[1]['tekst'] and 'bram' in rijen[2]['tekst'], 'A: de rijkste vrienden, Tijntje 👑 bovenaan, Jij gemarkeerd (%s)' % rijen)
        pg.click('.csw-speel[data-spel=eenentwintigen]')
        check(wacht(pg, "() => !!document.querySelector('.fibro-titelscherm, iframe[src*=\"spel=eenentwintigen\"]') || location.href.includes('spel=eenentwintigen')", 8000),
              'A: ♠️ Black Jack opent het spel')
        pg.close()
        # ── B ── inzetten met saldo -50
        STAND['saldo'] = -50
        pg = open_pg(ctx, 'spel.html?spel=eenentwintigen&titel=1')
        wacht(pg, "() => !!document.querySelector('.niveau-btn[data-niveau]')")
        pg.click('.niveau-btn[data-niveau=normaal]')
        check(wacht(pg, "() => document.querySelectorAll('.cas-fiche').length === 4", 10000), 'B: eerst het inzetscherm')
        saldo = pg.evaluate("() => document.querySelector('.cas-saldo')?.textContent || ''")
        vrij = pg.evaluate(VRIJ)
        check('-50' in saldo, 'B: met je saldo (%s)' % saldo)
        check(vrij == [[10, True], [25, True], [50, True], [100, False]], 'B: 10, 25 en 50 mogen, 100 niet (onder -100) (%s)' % vrij)
        check(not pg.evaluate("() => !!document.querySelector('button[data-naam=blijf]')"), 'B: de kaarten worden nog niet gedeeld')
        pg.click('.cas-fiche[data-inzet="50"]')
        check(wacht(pg, "() => !document.querySelector('.cas-inzet')", 8000), 'B: het inzetscherm gaat weg')
        check(len(INZETTEN) == 1 and INZETTEN[0].get('p_inzet') == 50 and INZETTEN[0].get('p_spel') == 'eenentwintigen' and INZETTEN[0].get('p_expected_user') == UID,
              'B: inzet 50 naar de server (%s)' % INZETTEN)
        check(wacht(pg, "() => document.body.innerText.includes('🪙 50')", 10000), 'B: 🪙 50 staat op tafel')
        titel, sub = speel_uit(pg)
        verwacht = 'winst' if 'Jij wint' in titel else 'gelijk' if 'Gelijkspel' in titel else 'verlies'
        check(len(UITSLAGEN) == 1 and UITSLAGEN[0].get('p_uitslag') == verwacht and UITSLAGEN[0].get('p_run_id') == INZETTEN[0].get('p_run_id'),
              'B: precies één uitslag naar de server, %s (%s / %s)' % (verwacht, titel, UITSLAGEN))
        na = -100 + {'winst': 100, 'gelijk': 50}.get(verwacht, 0)
        check(('Saldo: 🪙 %d' % na) in sub, 'B: het nieuwe saldo in het eindscherm (%d) (%s)' % (na, sub))
        # ── C ── opnieuw: weer kiezen, nu zonder inzet
        pg.click('.kt-opnieuw')
        check(wacht(pg, "() => document.querySelectorAll('.cas-fiche').length === 4", 10000), 'C: ↻ Opnieuw spelen: weer het inzetscherm')
        saldo = pg.evaluate("() => document.querySelector('.cas-saldo')?.textContent || ''")
        check(str(STAND['saldo']) in saldo, 'C: met het saldo van de server (%s, %s)' % (STAND['saldo'], saldo))
        pg.click('.cas-zonder')
        titel, sub = speel_uit(pg)
        check(len(INZETTEN) == 1 and len(UITSLAGEN) == 1 and 'Saldo' not in sub, 'C: zonder inzet: niets naar de server (%d inzetten, %d uitslagen)' % (len(INZETTEN), len(UITSLAGEN)))
        pg.close()
        # ── D ── geen casino-lijst: gewoon spelen
        STAND['kapot'] = True
        pg = open_pg(ctx, 'spel.html?spel=eenentwintigen&titel=1')
        wacht(pg, "() => !!document.querySelector('.niveau-btn[data-niveau]')")
        pg.click('.niveau-btn[data-niveau=normaal]')
        pg.wait_for_timeout(2500)
        check(not pg.evaluate("() => !!document.querySelector('.cas-inzet')"), 'D: geen inzetscherm zonder de casino-lijst')
        check(wacht(pg, "() => !!document.querySelector('.kt-hand .kt-kaart, button[data-naam=blijf]')", 10000), 'D: het spel begint gewoon')
        pg.close(); ctx.close()
        b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
check(not fouten, 'E: geen paginafouten (%s)' % fouten[:3])
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
