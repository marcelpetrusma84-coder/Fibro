# proef351 (26 nov 2026, avond, Marcel: "sluit maar aan"): ook Ghost Tag, Twin Snakes en Runner & Gunner op het scorebord,
# en 🏆 Scores in het spelmenu ☰ (ook bij spellen met een eigen startscherm).
#  A. Ghost Tag: in het menu ☰ staat 🏆 Scores; een tik opent het scorebord van Ghost Tag
#  B. Twin Snakes tegen de computer: na een ronde gaat de uitslag naar Supabase (pinball, winst, spelvorm levels)
#  C. Runner & Gunner: na GAME OVER gaat de score naar Supabase (endlessrunner, punten)
#  D. Ghost Tag: na een ronde gaat de score van jouw spookje naar Supabase (pacman, punten)
#  E. het scorebord van Twin Snakes toont jouw overwinningen per spelvorm ("Levels")
#  F. Neon Raiders (eigen scorebord): geen 🏆 Scores in het menu; geen paginafouten (ook niet bij het opbouwen van het menu)
# Op de oude versie mislukken A, B, C en D.
# python3 -I proef351.py <map>
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
UID = 'aaaaaaaa-0000-4000-8000-000000000351'; TIJN = 'bbbbbbbb-0000-4000-8000-000000000349'
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
jwt = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'role': 'authenticated', 'exp': int(time.time()) + 7200, 'aud': 'authenticated'}) + '.x'
user = {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'marcel@x.nl', 'created_at': '2026-01-01T00:00:00Z', 'user_metadata': {'username': 'Marcel'}}
sessie = {'access_token': jwt, 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'user': user}
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

OPGESLAGEN = []
def bord(soort):
    if soort == 'winst':
        return {'soort': 'winst', 'personal': [{'niveau': 'makkelijk', 'gewonnen': 1, 'gespeeld': 2}],
                'friends': [{'user_id': TIJN, 'username': 'Tijn', 'gewonnen': 3, 'gespeeld': 5, 'laatst': NU},
                            {'user_id': UID, 'username': 'Marcel', 'gewonnen': 1, 'gespeeld': 2, 'laatst': NU}], 'global': None}
    return {'soort': 'punten', 'personal': [{'user_id': UID, 'run_id': '11111111-0000-4000-8000-000000000001', 'score': 7, 'niveau': '', 'played_at': NU, 'username': 'Marcel'}],
            'friends': [{'user_id': TIJN, 'run_id': '22222222-0000-4000-8000-000000000002', 'score': 42, 'niveau': '', 'played_at': NU, 'username': 'Tijn'},
                        {'user_id': UID, 'run_id': '11111111-0000-4000-8000-000000000001', 'score': 7, 'niveau': '', 'played_at': NU, 'username': 'Marcel'}],
            'global': {'score': 99, 'niveau': ''}}
def supabase(route):
    u = route.request.url
    if '/rpc/spel_score_opslaan' in u:
        OPGESLAGEN.append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=204, body='')
    if '/rpc/spel_scorebord' in u:
        p = json.loads(route.request.post_data or '{}'); b_ = bord(p.get('p_soort'))
        if p.get('p_spel') == 'pinball': b_['personal'] = [{'niveau': 'classic', 'gewonnen': 1, 'gespeeld': 3}, {'niveau': 'levels', 'gewonnen': 2, 'gespeeld': 4}]
        return route.fulfill(status=200, json=b_)
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=user)
    if '/rest/v1/friendships' in u:
        return route.fulfill(status=200, json=[], headers={'content-range': '0-0/1', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range'})
    if '/rest/v1/profiles' in u: return route.fulfill(status=200, json=[{'id': UID, 'username': 'Marcel', 'public_key': 'x'}])
    return route.fulfill(status=200, json=[])

fouten = []
def wacht(pg, js, ms=8000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def nieuwe_ctx(b, ingelogd=True):
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL', has_touch=True)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.route('**/*supabase.co/**', supabase)
    s0 = ctx.new_page(); s0.goto(BASIS + 'manifest.json')
    s0.evaluate("([s, i]) => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_solo_niveau_botkaaseiren', 'makkelijk'); if (i) localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify(s)) }", [sessie, ingelogd]); s0.close()
    return ctx
def open_pg(ctx, adres):
    pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + adres); return pg

def menu_scores(pg):
    pg.click('#spelMenuKnop'); pg.wait_for_timeout(300)
    zichtbaar = pg.evaluate("() => { const b = document.querySelector('#spelMenuLijst [data-menu=scores]'); return !!b && !b.hidden && b.offsetHeight > 0 }")
    return zichtbaar
def wacht_op(pg, spel, voor, sec=90):
    # via de browser wachten (pg.wait_for_timeout): dan handelt Playwright intussen de nep-server af (time.sleep blokkeert dat)
    for _ in range(sec * 2):
        nieuw = [x for x in OPGESLAGEN[voor:] if x.get('p_spel') == spel]
        if nieuw: return nieuw
        pg.wait_for_timeout(500)
    return []

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = nieuwe_ctx(b)
        # ── A, D ── Ghost Tag
        voor = len(OPGESLAGEN)
        pg = open_pg(ctx, 'spel.html?spel=pacman&titel=1')
        wacht(pg, "() => !!document.getElementById('spelMenuKnop')", 10000); pg.wait_for_timeout(1500)
        check(menu_scores(pg), 'A: Ghost Tag: 🏆 Scores staat in het menu ☰')
        pg.click('#spelMenuLijst [data-menu=scores]')
        merk = pg.evaluate("() => { const d = document.querySelector('dialog.nr-scoreboard'); return d && d.open ? d.querySelector('.nr-sb-eyebrow').textContent : '' }") if wacht(pg, "() => document.querySelector('dialog.nr-scoreboard')?.open", 5000) else ''
        check(merk == 'GHOST TAG', 'A: een tik opent het scorebord van Ghost Tag (%s)' % merk)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        try: pg.click('.sp-verder', timeout=2000)   # verder spelen na de pauze
        except Exception: pass
        try: pg.click('.kSpeel', timeout=3000)
        except Exception: pass
        gt = wacht_op(pg, 'pacman', voor, 120)
        check(gt and gt[0].get('p_soort') == 'punten' and isinstance(gt[0].get('p_score'), int), 'D: Ghost Tag: de score van een ronde gaat naar Supabase (%s)' % gt[:1])
        pg.close()
        # ── B, E ── Twin Snakes
        voor = len(OPGESLAGEN)
        pg = open_pg(ctx, 'spel.html?spel=pinball&titel=1')
        pg.wait_for_selector('.kSpeel', timeout=10000); pg.click('.kSpeel')
        ts = wacht_op(pg, 'pinball', voor, 60)
        check(len(ts) == 1 and ts[0].get('p_soort') == 'winst' and ts[0].get('p_niveau') == 'levels' and ts[0].get('p_score') == (1 if ts[0].get('p_gewonnen') else 0),
              'B: Twin Snakes: één ronde gaat naar Supabase (winst, spelvorm levels) (%s)' % ts)
        pg.goto(BASIS + 'spel.html?spel=pinball&titel=1'); wacht(pg, "() => !!document.getElementById('spelMenuKnop')", 10000); pg.wait_for_timeout(800)
        menu_scores(pg); pg.click('#spelMenuLijst [data-menu=scores]')
        wacht(pg, "() => { const d = document.querySelector('dialog.nr-scoreboard'); return d && d.open && d.getAttribute('aria-busy') === 'false' }", 8000)
        eigen = pg.evaluate("() => [...document.querySelectorAll('dialog.nr-scoreboard .nr-sb-personal .nr-sb-row')].map(r => r.innerText.replace(/\\s+/g, ' '))")
        check(len(eigen) == 2 and 'Levels' in eigen[0] and '2× gewonnen' in eigen[0] and 'Classic' in eigen[1], 'E: het scorebord van Twin Snakes: per spelvorm, Levels voor Classic (%s)' % eigen)
        pg.close()
        # ── C ── Runner & Gunner
        voor = len(OPGESLAGEN)
        pg = open_pg(ctx, 'spel.html?spel=endlessrunner&titel=1')
        pg.wait_for_selector('.rg .knop', timeout=10000); pg.click('.rg .knop')
        rg = wacht_op(pg, 'endlessrunner', voor, 90)
        check(len(rg) == 1 and rg[0].get('p_soort') == 'punten' and isinstance(rg[0].get('p_score'), int) and rg[0].get('p_niveau') == '',
              'C: Runner & Gunner: na GAME OVER gaat de score naar Supabase (%s)' % rg)
        pg.close()
        # ── F ── Neon Raiders: eigen scorebord, dus niet in het menu
        pg = open_pg(ctx, 'spel.html?spel=shmup&titel=1')
        wacht(pg, "() => !!document.getElementById('spelMenuKnop')", 10000); pg.wait_for_timeout(1200)
        check(not menu_scores(pg), 'F: Neon Raiders: geen 🏆 Scores in het menu (die heeft zijn eigen scorebord)')
        pg.close(); ctx.close()
        check(not fouten, 'F: geen paginafouten (%s)' % fouten[:3])
        b.close()
except Exception as e:
    check(False, 'proef afgebroken: ' + str(e)[:300])
finally:
    srv.shutdown()
print()
print('%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
