# proef347 (26 nov 2026, Marcel): snel iemand uitnodigen via het deelmenu (uitnodigen.js).
#  A. Home: een ➕ bovenaan; één tik opent het deelmenu met een uitnodiging (zin + link naar invite.html, zonder spel)
#  B. het deelmenu gaat open vóórdat de server antwoordt (een iPhone opent het alleen vlak na een tik)
#  C. de code in de link staat ook in Supabase (invite_tokens): dezelfde code, van mij, 1 dag geldig; 16 willekeurige
#     tekens, en elke tik een nieuwe code
#  D. een spel (Eenendertigen): onder "Met een groep" een knop 📤 Delen; die deelt een uitnodiging mét dat spel
#  E. zonder account: geen knop Delen
#  F. geen deelmenu (computer): de uitnodiging wordt gekopieerd, met een melding
#  G. kon de server de code niet bewaren: een melding dat de link niet werkt; geen paginafouten
# Op de oude versie mislukt A (er was geen ➕) en D (geen knop Delen).
# python3 -I proef347.py <map>
import sys, os, re, json, time, base64, functools, http.server, threading
from urllib.parse import urlparse, parse_qs
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
UID = 'aaaaaaaa-0000-4000-8000-000000000347'
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
jwt = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'role': 'authenticated', 'exp': int(time.time()) + 7200, 'aud': 'authenticated'}) + '.x'
user = {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'marcel@x.nl', 'created_at': '2026-01-01T00:00:00Z', 'user_metadata': {'username': 'Marcel'}}
sessie = {'access_token': jwt, 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'user': user}

INVITES = []           # (aankomst, klaar, body) per POST naar invite_tokens
SERVER = {'traag': 0.0, 'fout': False}
def supabase(route):
    u = route.request.url
    if '/rest/v1/invite_tokens' in u and route.request.method == 'POST':
        aankomst = time.time() * 1000
        try: body = json.loads(route.request.post_data or 'null')
        except Exception: body = None
        if SERVER['traag']: time.sleep(SERVER['traag'])
        klaar = time.time() * 1000
        INVITES.append((aankomst, klaar, body[0] if isinstance(body, list) else body))
        if SERVER['fout']: return route.fulfill(status=400, json={'message': 'nee', 'code': '42501'})
        return route.fulfill(status=201, body='', headers={'access-control-allow-origin': '*'})
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=user)
    if '/rest/v1/friendships' in u:
        return route.fulfill(status=200, json=[], headers={'content-range': '0-0/1', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range'})
    if '/rest/v1/profiles' in u: return route.fulfill(status=200, json=[{'id': UID, 'username': 'Marcel', 'display_name': 'Marcel', 'public_key': 'x'}])
    return route.fulfill(status=200, json=[])

# Het deelmenu nadoen: onthoud wat er gedeeld wordt en wanneer (Date.now, dezelfde klok als Python)
DEELMENU = """(() => { window.__gedeeld = []
  Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__gedeeld.push({ ...d, t: Date.now() }) } }) })()"""
GEEN_DEELMENU = """(() => { window.__gekopieerd = []
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__gekopieerd.push(t) } } }) } catch (e) {} })()"""

fouten = []
def wacht(pg, js, ms=8000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def nieuwe_ctx(b, ingelogd=True, deelmenu=True):
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL', has_touch=True)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.route('**/*supabase.co/**', supabase)
    ctx.add_init_script(DEELMENU if deelmenu else GEEN_DEELMENU)
    s0 = ctx.new_page(); s0.goto(BASIS + 'manifest.json')
    s0.evaluate("([s, i]) => { localStorage.setItem('fibro_taal', 'nl'); if (i) localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify(s)) }", [sessie, ingelogd]); s0.close()
    return ctx
def open_pg(ctx, adres):
    pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + adres)
    return pg
def link_uit(tekst):
    m = re.search(r'https://\S+/invite\.html\?\S+', tekst or '')
    return m.group(0) if m else ''

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        # ── A, B, C: Home ──
        ctx = nieuwe_ctx(b)
        pg = open_pg(ctx, 'index.html')
        try: pg.get_by_text('Later (via Profiel bewerken)').click(timeout=4000)
        except Exception: pass
        check(wacht(pg, "() => { const k = document.querySelector('.top-bar #uitnodigBtn'); return k && k.offsetWidth > 0 }"), 'A: een ➕ bovenaan Home')
        check(pg.get_attribute('#uitnodigBtn', 'aria-label') == 'Vriend uitnodigen', 'A: de knop heet "Vriend uitnodigen" (voor schermlezers)')
        time.sleep(0.6)
        SERVER['traag'] = 1.5
        klik = time.time() * 1000
        pg.click('#uitnodigBtn')
        gedeeld = wacht(pg, "() => window.__gedeeld && window.__gedeeld.length === 1", 6000)
        wacht(pg, "() => false", 2200)  # de trage server laten antwoorden
        SERVER['traag'] = 0
        d = pg.evaluate("() => (window.__gedeeld || [])[0] || null")
        check(gedeeld and d is not None, 'A: één tik opent het deelmenu')
        tekst = (d or {}).get('text', '')
        link = link_uit(tekst)
        q = parse_qs(urlparse(link).query)
        check('nodigt je uit voor Stekky' in tekst or 'uitgenodigd voor Stekky' in tekst, 'A: met een uitlegzin (%r)' % tekst[:80])
        check(link.startswith('https://marcelpetrusma84-coder.github.io/Fibro/invite.html?token=') and 'spel' not in q, 'A: een link naar invite.html, zonder spel (%s)' % link[:90])
        check('1 dag' in tekst, 'A: de zin zegt dat de link 1 dag geldig is')
        check(len(INVITES) == 1, 'C: één code naar Supabase (%d)' % len(INVITES))
        if INVITES and d:
            aankomst, klaar, body = INVITES[0]
            check(d['t'] < klaar - 500, 'B: het deelmenu ging open vóórdat de server antwoordde (%d ms eerder)' % (klaar - d['t']))
            code = (q.get('token') or [''])[0]
            check(re.fullmatch(r'fibro-[a-z2-7]{16}', code or '') is not None, 'C: de code is 16 willekeurige tekens (%s)' % code)
            check(body and body.get('token') == code and body.get('created_by') == UID, 'C: dezelfde code staat in Supabase, van mij (%s)' % body)
            try:
                uren = (time.mktime(time.strptime(body['expires_at'][:19], '%Y-%m-%dT%H:%M:%S')) - time.mktime(time.gmtime())) / 3600
            except Exception: uren = -1
            check(23 <= uren <= 25, 'C: 1 dag geldig (%.1f uur)' % uren)
        pg.click('#uitnodigBtn'); wacht(pg, "() => window.__gedeeld.length === 2", 5000); wacht(pg, "() => false", 600)
        codes = [parse_qs(urlparse(link_uit(x.get('text'))).query).get('token', [''])[0] for x in pg.evaluate("() => window.__gedeeld")]
        check(len(codes) == 2 and codes[0] != codes[1] and len(INVITES) == 2, 'C: elke tik een nieuwe code (%s)' % codes)
        pg.close()

        # ── D: een spel ──
        INVITES.clear()
        pg = open_pg(ctx, 'spel.html?spel=eenendertigen&titel=1')
        zichtbaar = wacht(pg, "() => { const k = document.getElementById('deelKnop'); return k && !k.hidden && k.offsetWidth > 0 }")
        check(zichtbaar, 'D: in Eenendertigen staat een knop 📤 Delen')
        volgorde = pg.evaluate("() => [...document.querySelectorAll('.niveau-kaart .niveau-btn')].map(b => b.id || b.dataset.niveau)")
        check('deelKnop' in volgorde and 'groepKnop' in volgorde and volgorde.index('deelKnop') == volgorde.index('groepKnop') + 1, 'D: direct onder "Met een groep" (%s)' % volgorde)
        if zichtbaar:
            pg.click('#deelKnop')
            check(wacht(pg, "() => window.__gedeeld && window.__gedeeld.length === 1", 6000), 'D: Delen opent het deelmenu')
            wacht(pg, "() => false", 600)
            tekst = (pg.evaluate("() => (window.__gedeeld || [])[0] || {}") or {}).get('text', '')
            link = link_uit(tekst)
            check(parse_qs(urlparse(link).query).get('spel') == ['eenendertigen'], 'D: de link stuurt Eenendertigen mee (%s)' % link[:100])
            check('Eenendertigen' in tekst, 'D: de zin noemt het spel (%r)' % tekst[:90])
            check(len(INVITES) == 1 and (INVITES[0][2] or {}).get('created_by') == UID, 'D: ook hier staat de code in Supabase')
        pg.close()
        # ook een arcadespel (eigen startknop) heeft de knop
        pg = open_pg(ctx, 'spel.html?spel=pong&titel=1')
        check(wacht(pg, "() => { const k = document.getElementById('deelKnop'); return k && !k.hidden }"), 'D: ook een arcadespel (Neo Paddle) heeft Delen')
        pg.close(); ctx.close()

        # ── E: zonder account ──
        ctx = nieuwe_ctx(b, ingelogd=False)
        pg = open_pg(ctx, 'spel.html?spel=eenendertigen&titel=1')
        wacht(pg, "() => !!document.querySelector('.niveau-kaart')"); time.sleep(1.0)
        check(pg.evaluate("() => { const k = document.getElementById('deelKnop'); return !k || k.hidden || k.offsetWidth === 0 }"), 'E: zonder account geen knop Delen')
        pg.close(); ctx.close()

        # ── F: geen deelmenu ──
        INVITES.clear()
        ctx = nieuwe_ctx(b, deelmenu=False)
        pg = open_pg(ctx, 'spel.html?spel=eenendertigen&titel=1')
        if wacht(pg, "() => { const k = document.getElementById('deelKnop'); return k && !k.hidden }"):
            pg.click('#deelKnop')
            check(wacht(pg, "() => window.__gekopieerd && window.__gekopieerd.length === 1", 5000), 'F: zonder deelmenu wordt de uitnodiging gekopieerd')
            check('invite.html?token=' in (pg.evaluate("() => (window.__gekopieerd || [''])[0]") or ''), 'F: met de link')
            check(wacht(pg, "() => (document.querySelector('.uitnodig-melding')?.textContent || '').includes('Gekopieerd')", 3000), 'F: met een melding "Gekopieerd"')
        else: check(False, 'F: knop Delen niet gevonden')

        # ── G: server kan de code niet bewaren ──
        SERVER['fout'] = True
        pg.reload(); wacht(pg, "() => { const k = document.getElementById('deelKnop'); return k && !k.hidden }")
        pg.click('#deelKnop')
        check(wacht(pg, "() => (document.querySelector('.uitnodig-melding')?.textContent || '').includes('link werkt niet')", 5000), 'G: melding dat de link niet werkt als de server hem niet bewaarde')
        SERVER['fout'] = False
        pg.close(); ctx.close()
        check(not fouten, 'G: geen paginafouten (%s)' % fouten[:3])
        b.close()
except Exception as e:
    check(False, 'proef afgebroken: ' + str(e)[:300])
finally:
    srv.shutdown()
print()
print('%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
