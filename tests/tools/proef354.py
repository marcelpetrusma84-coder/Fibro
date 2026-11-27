# proef354 (27 nov 2026, Marcel): Video Poker uit Stekky Studio (videopoker.js, videopoker-ui.js, sql/videopoker.sql).
#  A. spel.html?spel=videopoker: geen niveaus, meteen de automaat: de uitbetalingstabel (bij inzet 10: royal flush 2.500),
#     je saldo 🪙 230 en de fiches
#  B. met tokens: Deel (inzet 25) gaat naar de server (videopoker_deel); je ziet precies de kaarten van de server; tik twee
#     kaarten aan (HOUDEN) en Ruil: videopoker_ruil met houd = 3; de kaarten van de server, "Three of a kind" licht op in
#     de tabel, "+75" en het nieuwe saldo 🪙 290
#  C. saldo -90: alleen fiche 10 kan nog (anders onder -100)
#  D. "Zonder tokens": delen en ruilen op het toestel, niets naar de server; 💡 Tip zet HOUDEN-vinkjes
#  E. zonder account: meteen zonder tokens, geen knop om te wisselen
#  F. de casino-widget op Home heeft een knop 🎰 Video Poker die het spel opent; geen paginafouten
# Op de oude versie mislukt alles (er was geen Video Poker).
# python3 -I proef354.py <map>
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
UID = 'aaaaaaaa-0000-4000-8000-000000000354'
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
jwt = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'role': 'authenticated', 'exp': int(time.time()) + 7200, 'aud': 'authenticated'}) + '.x'
user = {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'marcel@x.nl', 'created_at': '2026-01-01T00:00:00Z', 'user_metadata': {'username': 'Marcel'}}
sessie = {'access_token': jwt, 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'user': user}
STAND = {'saldo': 230, 'sessie': True}
DEEL, RUIL = [], []
RID = '33333333-0000-4000-8000-000000000354'
def supabase(route):
    u = route.request.url
    body = json.loads(route.request.post_data or '{}') if route.request.method == 'POST' else {}
    if '/rpc/casino_overzicht' in u:
        return route.fulfill(status=200, json={'saldo': STAND['saldo'], 'volgende': '2026-11-30T00:00:00+01:00', 'vrienden': [{'user_id': UID, 'username': 'Marcel', 'saldo': STAND['saldo']}], 'laatste': []})
    if '/rpc/videopoker_deel' in u:
        DEEL.append(body); STAND['saldo'] -= body.get('p_inzet', 0)
        return route.fulfill(status=200, json={'ronde_id': RID, 'kaarten': ['hB', 'sB', 'r2', 'k5', 'h9'], 'inzet': body.get('p_inzet'), 'saldo': STAND['saldo'], 'al': False})
    if '/rpc/videopoker_ruil' in u:
        RUIL.append(body); STAND['saldo'] += 75
        return route.fulfill(status=200, json={'kaarten': ['hB', 'sB', 'rB', 'k7', 'h3'], 'hand': 'three', 'uitbetaling': 75, 'saldo': STAND['saldo'], 'al': False})
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=user)
    if '/rest/v1/friendships' in u:
        return route.fulfill(status=200, json=[], headers={'content-range': '0-0/1', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range'})
    if '/rest/v1/profiles' in u: return route.fulfill(status=200, json=[{'id': UID, 'username': 'Marcel', 'public_key': 'x'}])
    return route.fulfill(status=200, json=[])
fouten = []
def wacht(pg, js, ms=10000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def ctx_maak(b, ingelogd=True, extra=None):
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL', has_touch=True)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.route('**/*supabase.co/**', supabase)
    s0 = ctx.new_page(); s0.goto(BASIS + 'manifest.json')
    s0.evaluate("([s, i, extra]) => { localStorage.setItem('fibro_taal', 'nl'); if (i) localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify(s)); for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v) }", [sessie, ingelogd, extra or {}]); s0.close()
    return ctx
def open_pg(ctx, adres):
    pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:300])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + adres)
    try: pg.get_by_text('Later (via Profiel bewerken)').click(timeout=2500)
    except Exception: pass
    return pg
KAARTEN = "() => [...document.querySelectorAll('.vp-kaart')].map(k => k.dataset.id)"
HOUD = "() => [...document.querySelectorAll('.vp-kaart')].map(k => k.classList.contains('houd'))"
MELDING = "() => document.querySelector('.vp-melding')?.textContent || ''"
FICHES = "() => [...document.querySelectorAll('.vp-fiche')].map(b => [Number(b.dataset.inzet), !b.disabled])"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = ctx_maak(b, extra={'fibro_videopoker_inzet': '25'})
        # ── A ──
        pg = open_pg(ctx, 'spel.html?spel=videopoker&titel=1')
        check(wacht(pg, "() => !!document.querySelector('.vp-tabel') && (document.querySelector('.vp-saldo')?.textContent || '').includes('230')", 12000), 'A meteen de automaat met je saldo 🪙 230')
        check(pg.locator('.niveau-btn[data-niveau]').count() == 0, 'A geen niveaus')
        tabel = pg.evaluate("() => document.querySelector('.vp-tabel').innerText.replace(/\\s+/g, ' ')")
        check('Royal flush 6.250' in tabel and 'Boeren of beter 25' in tabel, 'A de tabel met bedragen bij inzet 25 (%s)' % tabel)
        check(pg.evaluate(FICHES) == [[10, True], [25, True], [50, True], [100, True]] and pg.locator('.vp-fiche.gekozen[data-inzet="25"]').count() == 1, 'A de fiches, 25 gekozen')
        check('Video Poker' in pg.inner_text('#spelTitelBar'), 'A de naam in de titelbalk')
        # ── B ──
        pg.click('.vp-knop[data-naam=hoofd]')
        check(wacht(pg, "() => (%s)().join() === 'hB,sB,r2,k5,h9'" % KAARTEN, 8000), 'B de kaarten van de server')
        check(len(DEEL) == 1 and DEEL[0].get('p_inzet') == 25 and DEEL[0].get('p_expected_user') == UID, 'B inzet 25 naar de server (%s)' % DEEL)
        check('205' in pg.inner_text('.vp-saldo'), 'B saldo na het inzetten: 205')
        pg.click('.vp-kaart[data-i="0"]'); pg.click('.vp-kaart[data-i="1"]')
        check(pg.evaluate(HOUD) == [True, True, False, False, False] and 'HOUDEN' in pg.inner_text('.vp-kaart[data-i="0"]'), 'B twee kaarten HOUDEN')
        check(pg.inner_text('.vp-knop[data-naam=hoofd]') == 'Ruil', 'B de knop heet nu Ruil')
        pg.click('.vp-knop[data-naam=hoofd]')
        check(wacht(pg, "() => (%s)().join() === 'hB,sB,rB,k7,h3' && (%s)().includes('+75')" % (KAARTEN, MELDING), 8000), 'B na het ruilen: de kaarten van de server en +75 (%s)' % pg.evaluate(MELDING))
        check(len(RUIL) == 1 and RUIL[0].get('p_houd') == 3 and RUIL[0].get('p_ronde_id') == RID, 'B ruilen met houd = 3 (%s)' % RUIL)
        check(pg.evaluate("() => document.querySelector('.vp-tabel .winst')?.textContent") == 'Three of a kind', 'B Three of a kind licht op in de tabel')
        check('290' in pg.inner_text('.vp-saldo') and pg.inner_text('.vp-knop[data-naam=hoofd]') == 'Deel', 'B het nieuwe saldo 🪙 290, en weer Deel')
        pg.close()
        # ── C ──
        STAND['saldo'] = -90
        pg = open_pg(ctx, 'spel.html?spel=videopoker&titel=1')
        wacht(pg, "() => (document.querySelector('.vp-saldo')?.textContent || '').includes('-90')", 12000)
        check(pg.evaluate(FICHES) == [[10, True], [25, False], [50, False], [100, False]], 'C saldo -90: alleen fiche 10 (%s)' % pg.evaluate(FICHES))
        check(pg.locator('.vp-knop[data-naam=hoofd]').is_disabled(), 'C met inzet 25 kun je niet delen')
        # ── D ── zonder tokens
        pg.click('.vp-wissel')
        check('Zonder tokens' in pg.inner_text('.vp-saldo') and pg.locator('.vp-fiches').is_hidden(), 'D zonder tokens: geen fiches')
        tabel = pg.evaluate("() => document.querySelector('.vp-tabel').innerText.replace(/\\s+/g, ' ')")
        check('Royal flush 250×' in tabel, 'D de tabel in × (%s)' % tabel[:40])
        voor = len(DEEL)
        pg.click('.vp-knop[data-naam=hoofd]')
        check(wacht(pg, "() => (%s)().every(Boolean) && document.querySelector('.vp-knop[data-naam=hoofd]').textContent === 'Ruil'" % KAARTEN, 5000), 'D gedeeld op het toestel')
        pg.click('.vp-knop[data-naam=tip]')
        tip = pg.evaluate(HOUD)
        check(isinstance(tip, list) and len(tip) == 5, 'D 💡 Tip zet HOUDEN-vinkjes (%s)' % tip)
        pg.click('.vp-knop[data-naam=hoofd]')
        check(wacht(pg, "() => document.querySelector('.vp-knop[data-naam=hoofd]').textContent === 'Deel' && (%s)().length > 2" % MELDING, 5000), 'D geruild: %s' % pg.evaluate(MELDING))
        check(len(DEEL) == voor and len(RUIL) == 1, 'D niets naar de server')
        pg.close(); ctx.close()
        # ── E ── zonder account
        ctx = ctx_maak(b, ingelogd=False)
        pg = open_pg(ctx, 'spel.html?spel=videopoker&titel=1')
        check(wacht(pg, "() => (document.querySelector('.vp-saldo')?.textContent || '').includes('Zonder tokens')", 12000) and pg.locator('.vp-wissel').is_hidden(), 'E zonder account: zonder tokens, geen wisselknop')
        pg.close(); ctx.close()
        # ── F ── de widget
        STAND['saldo'] = 230
        ctx = ctx_maak(b, extra={'fibro_widgets_profiel_' + UID: json.dumps([{'id': 'casino', 'icon': '🎰', 'titel': 'Casino', 'w': 4, 'h': 3, 'volgorde': 0, 'aan': True}])})
        pg = open_pg(ctx, 'index.html')
        check(wacht(pg, "() => !!document.querySelector('.csw-speel[data-spel=videopoker]')", 15000), 'F de casino-widget heeft een knop Video Poker')
        pg.click('.csw-speel[data-spel=videopoker]')
        check(wacht(pg, "() => !!document.querySelector('iframe[src*=\"spel=videopoker\"], .fibro-titelscherm') || location.href.includes('spel=videopoker')", 8000), 'F en die opent het spel')
        ctx.close(); b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
check(not fouten, 'F geen paginafouten (%s)' % fouten[:3])
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
