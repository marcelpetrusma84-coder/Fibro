# proef349 (26 nov 2026, Marcel): een scorebord bij elk spel (spelscores.js, scorespellen.js, sql/spel-scores.sql).
#  A. op het startscherm van Tic-Tac-Toe en Flapper een knop 🏆 Scores
#  B. Tic-Tac-Toe tegen de computer (makkelijk) tot het einde: precies één potje naar Supabase
#     (spel_score_opslaan: botkaaseiren, winst, makkelijk, gewonnen = wat het spel zegt)
#  C. 🏆 Scores bij Tic-Tac-Toe: "Jouw overwinningen" per niveau (Makkelijk) en de vrienden uit spel_scorebord
#     ("Tijn", "3× gewonnen", "van 5 potjes"); geen Stekky-record
#  D. Flapper: een potje (de vleermuis valt) gaat met de punten naar Supabase (punten, score, zonder niveau)
#  E. 🏆 Scores bij Flapper: jouw top 10, de vrienden top 10 met punten, en het Stekky-record
#  F. Black Jack (kaartspel): "Ik blijf" -> het potje eindigt -> precies één potje naar Supabase (eenentwintigen, winst)
#  G. zonder account: het potje blijft op dit toestel en het scorebord zegt dat (geen online lijst); geen paginafouten
# Op de oude versie mislukt A (er was geen knop 🏆 Scores) en B (er ging niets naar Supabase).
# python3 -I proef349.py <map>
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
UID = 'aaaaaaaa-0000-4000-8000-000000000349'; TIJN = 'bbbbbbbb-0000-4000-8000-000000000349'
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
        p = json.loads(route.request.post_data or '{}'); return route.fulfill(status=200, json=bord(p.get('p_soort')))
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
def speel_bke(pg):
    """Tik op vrije vakjes tot het potje voorbij is. Geeft de eindtekst."""
    for _ in range(40):
        st = pg.evaluate("() => document.querySelector('#bke-status, .bke-status, [id*=status]')?.textContent || ''")
        if any(w in st for w in ['wint', 'Gelijkspel']): return st
        try: pg.click('.bke-vak.kan', timeout=1500)
        except Exception: pass
        pg.wait_for_timeout(500)
    return pg.evaluate("() => document.querySelector('#bke-status, .bke-status, [id*=status]')?.textContent || ''")
def bord_tekst(pg):
    wacht(pg, "() => { const d = document.querySelector('dialog.nr-scoreboard'); return d && d.open && d.getAttribute('aria-busy') === 'false' }", 8000)
    return pg.evaluate("""() => { const d = document.querySelector('dialog.nr-scoreboard'); if (!d) return null
      return { tekst: d.innerText, record: d.querySelector('.nr-sb-global').offsetHeight > 0,   // echt te zien, niet alleen een vlaggetje
        eigen: [...d.querySelectorAll('.nr-sb-personal .nr-sb-row')].map(r => r.innerText.replace(/\\s+/g, ' ')),
        vrienden: [...d.querySelectorAll('.nr-sb-friends .nr-sb-row')].map(r => r.innerText.replace(/\\s+/g, ' ')) } }""")

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = nieuwe_ctx(b)
        # ── A, B ── Tic-Tac-Toe
        pg = open_pg(ctx, 'spel.html?spel=botkaaseiren&titel=1')
        check(wacht(pg, "() => !!document.getElementById('scoreKnop')"), 'A: Tic-Tac-Toe heeft een knop 🏆 Scores')
        pg.click('.niveau-btn[data-niveau=makkelijk]')
        eind = speel_bke(pg); pg.wait_for_timeout(1500)
        check(any(w in eind for w in ['wint', 'Gelijkspel']), 'B: het potje Tic-Tac-Toe is uitgespeeld (%s)' % eind.strip()[:40])
        bke = [x for x in OPGESLAGEN if x.get('p_spel') == 'botkaaseiren']
        verwacht = 'Jij wint' in eind
        check(len(bke) == 1, 'B: precies één potje naar Supabase (%d)' % len(bke))
        if bke:
            x = bke[0]
            check(x.get('p_soort') == 'winst' and x.get('p_niveau') == 'makkelijk' and x.get('p_gewonnen') == verwacht and x.get('p_score') == (1 if verwacht else 0)
                  and x.get('p_expected_user') == UID and re.fullmatch(r'[0-9a-f-]{36}', x.get('p_run_id', '')),
                  'B: botkaaseiren, winst, makkelijk, gewonnen=%s (%s)' % (verwacht, {k: x.get(k) for k in ['p_soort', 'p_niveau', 'p_gewonnen', 'p_score']}))
        # ── C ── 🏆 bij Tic-Tac-Toe (terug naar het startscherm)
        pg.goto(BASIS + 'spel.html?spel=botkaaseiren&titel=1'); wacht(pg, "() => !!document.getElementById('scoreKnop')")
        pg.click('#scoreKnop')
        s = bord_tekst(pg)
        check(s and 'Jouw overwinningen' in s['tekst'] and any('Makkelijk' in r for r in s['eigen']), 'C: "Jouw overwinningen" met Makkelijk (%s)' % (s and s['eigen']))
        check(s and s['vrienden'] and 'Tijn' in s['vrienden'][0] and '3× gewonnen' in s['vrienden'][0] and 'van 5 potjes' in s['vrienden'][0], 'C: vrienden: Tijn 3× gewonnen van 5 potjes (%s)' % (s and s['vrienden']))
        check(s and not s['record'], 'C: geen Stekky-record bij spellen zonder punten')
        pg.close()
        # ── D, E ── Flapper
        pg = open_pg(ctx, 'spel.html?spel=flappybird&titel=1')
        check(wacht(pg, "() => !!document.getElementById('scoreKnop')"), 'A: Flapper heeft een knop 🏆 Scores')
        pg.click('#startKnop')
        voor = len(OPGESLAGEN)
        # tik een paar keer om te beginnen, dan laten vallen
        for _ in range(3):
            try: pg.mouse.click(195, 400)
            except Exception: pass
            pg.wait_for_timeout(200)
        # wachten tot het potje voorbij is (de vleermuis valt); op een trage computer (GitHub) duurt dat langer
        for _ in range(60):
            if [x for x in OPGESLAGEN[voor:] if x.get('p_spel') == 'flappybird']: break
            pg.wait_for_timeout(500)
        fl = [x for x in OPGESLAGEN[voor:] if x.get('p_spel') == 'flappybird']
        check(len(fl) >= 1 and fl[0].get('p_soort') == 'punten' and fl[0].get('p_niveau') == '' and isinstance(fl[0].get('p_score'), int),
              'D: een potje Flapper gaat met de punten naar Supabase (%s)' % fl[:1])
        pg.goto(BASIS + 'spel.html?spel=flappybird&titel=1'); wacht(pg, "() => !!document.getElementById('scoreKnop')")
        pg.click('#scoreKnop')
        s = bord_tekst(pg)
        check(s and 'Jouw top 10' in s['tekst'] and s['eigen'], 'E: Flapper: jouw top 10 (%s)' % (s and s['eigen'][:2]))
        check(s and s['vrienden'] and 'Tijn' in s['vrienden'][0] and '42' in s['vrienden'][0], 'E: vrienden top 10 met punten (%s)' % (s and s['vrienden'][:2]))
        check(s and s['record'] and '99' in s['tekst'], 'E: het Stekky-record (99)')
        pg.close()
        # ── F ── Black Jack
        voor = len(OPGESLAGEN)
        pg = open_pg(ctx, 'spel.html?spel=eenentwintigen&titel=1')
        wacht(pg, "() => !!document.querySelector('.niveau-btn[data-niveau]')")
        pg.click('.niveau-btn[data-niveau=normaal]')
        einde = False
        for _ in range(12):
            if pg.evaluate("() => !!document.querySelector('.kt-einde')"): einde = True; break
            try: pg.click('button[data-naam=blijf]', timeout=2500)
            except Exception: pass
            pg.wait_for_timeout(1000)
        einde = einde or wacht(pg, "() => !!document.querySelector('.kt-einde')", 15000)
        pg.wait_for_timeout(1500)
        bj = [x for x in OPGESLAGEN[voor:] if x.get('p_spel') == 'eenentwintigen']
        check(einde, 'F: Black Jack: het potje is afgelopen')
        check(len(bj) == 1 and bj[0].get('p_soort') == 'winst' and bj[0].get('p_niveau') == 'normaal', 'F: precies één potje Black Jack naar Supabase (%s)' % bj)
        pg.close(); ctx.close()
        # ── G ── zonder account
        voor = len(OPGESLAGEN)
        ctx = nieuwe_ctx(b, ingelogd=False)
        pg = open_pg(ctx, 'spel.html?spel=botkaaseiren&titel=1')
        wacht(pg, "() => !!document.getElementById('scoreKnop')")
        pg.click('.niveau-btn[data-niveau=makkelijk]')
        speel_bke(pg); pg.wait_for_timeout(1200)
        check(len(OPGESLAGEN) == voor, 'G: zonder account gaat er niets naar Supabase')
        pg.goto(BASIS + 'spel.html?spel=botkaaseiren&titel=1'); wacht(pg, "() => !!document.getElementById('scoreKnop')")
        pg.click('#scoreKnop')
        s = bord_tekst(pg)
        check(s and 'Log in' in s['tekst'] and any('Makkelijk' in r for r in s['eigen']), 'G: het potje staat op dit toestel, met "Log in" (%s)' % (s and s['eigen']))
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
