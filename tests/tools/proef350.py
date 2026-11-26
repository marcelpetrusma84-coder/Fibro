# proef350 (26 nov 2026, Marcel): de widget 🏆 Scorebord op Home en de 🏆 Scoreborden in Stekky Studio.
#  A. Home met de widget: per spel jouw beste score naast die van je beste vriend (spel_scores_overzicht), ook
#     Koningsjacht (7/12) en Neon Raiders (eigen lijsten); de naam die jij je vriend gaf; wie er voorstaat
#  B. tik op een spel: het spel opent (met het titelscherm), Four in a Row
#  C. zonder verbinding met de scorelijst: je eigen scores van dit toestel, met een regel dat de vrienden later komen
#  D. Studio: 🏆 Scoreborden toont alle spellen; Neo Paddle uit, Four in a Row goud met titel "Vier op een rij!";
#     👁 Voorbeeld laat het echte scorebord in goud zien; het bestand scoreborden.stekky.json klopt
#  E. het installeerscript zet dat bestand in scoreborden.js; een spel met stijl goud krijgt het gouden scorebord met
#     de eigen titel, en Neo Paddle heeft geen knop 🏆 Scores meer
#  F. geen paginafouten
# Op de oude versie mislukken A (geen widget) en D (geen Scoreborden in Studio).
# python3 -I proef350.py <map>
import sys, os, re, json, time, base64, functools, http.server, threading, shutil, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, p): return super().translate_path(p.removeprefix('/Fibro'))
    def log_message(self, *a): pass
def server(map_):
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=map_)); threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, 'http://127.0.0.1:%d/Fibro/' % s.server_port
srv, BASIS = server(MAP)
UID = 'aaaaaaaa-0000-4000-8000-000000000350'; TIJN = 'bbbbbbbb-0000-4000-8000-000000000350'; BRAM = 'cccccccc-0000-4000-8000-000000000350'
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
jwt = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'role': 'authenticated', 'exp': int(time.time()) + 7200, 'aud': 'authenticated'}) + '.x'
user = {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'marcel@x.nl', 'created_at': '2026-01-01T00:00:00Z', 'user_metadata': {'username': 'Marcel'}}
sessie = {'access_token': jwt, 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'user': user}
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
STAND = {'kapot': False}
OVERZICHT = [
  {'spel': 'vieroprij', 'soort': 'winst', 'mijn': 4, 'laatst': NU, 'vriend': {'user_id': TIJN, 'username': 'tijn_echt', 'waarde': 9}},
  {'spel': 'flappybird', 'soort': 'punten', 'mijn': 12, 'laatst': '2026-11-20T10:00:00Z', 'vriend': {'user_id': BRAM, 'username': 'bram', 'waarde': 8}},
  {'spel': 'pesten', 'soort': 'winst', 'mijn': 2, 'laatst': '2026-11-19T10:00:00Z', 'vriend': None},
  {'spel': 'bestaatniet', 'soort': 'punten', 'mijn': 5, 'laatst': NU, 'vriend': None}]
def supabase(route):
    u = route.request.url
    if '/rpc/spel_scores_overzicht' in u:
        return route.fulfill(status=500, json={'message': 'kapot'}) if STAND['kapot'] else route.fulfill(status=200, json=OVERZICHT)
    if '/rpc/koningsjacht_boards' in u:
        return route.fulfill(status=200, json={'personal': [{'user_id': UID, 'run_id': 'x', 'score': 7, 'played_at': '2026-11-18T10:00:00Z', 'username': 'Marcel'}],
                                                'friends': [{'user_id': TIJN, 'run_id': 'y', 'score': 11, 'played_at': NU, 'username': 'tijn_echt'},
                                                            {'user_id': UID, 'run_id': 'x', 'score': 7, 'played_at': NU, 'username': 'Marcel'}], 'global': None})
    if '/rpc/neon_raiders_boards' in u: return route.fulfill(status=200, json={'personal': [], 'friends': [], 'global': None})
    if '/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=True)
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=user)
    if '/rest/v1/friendships' in u:
        return route.fulfill(status=200, json=[], headers={'content-range': '0-0/1', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range'})
    if '/rest/v1/profiles' in u: return route.fulfill(status=200, json=[{'id': UID, 'username': 'Marcel', 'public_key': 'x'}])
    return route.fulfill(status=200, json=[])
WIDGETS = [{'id': 'scorebord', 'icon': '🏆', 'titel': 'Scorebord', 'w': 4, 'h': 3, 'volgorde': 0, 'aan': True}]
fouten = []
def wacht(pg, js, ms=8000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def nieuwe_ctx(b, basis, extra=None):
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL', has_touch=True, accept_downloads=True)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.route('**/*supabase.co/**', supabase)
    s0 = ctx.new_page(); s0.goto(basis + 'manifest.json')
    s0.evaluate("""([s, uid, tijn, w, extra]) => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify(s))
      localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify(w)); localStorage.setItem('vriend_naam_' + uid + '_' + tijn, 'Tijntje')
      for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v) }""", [sessie, UID, TIJN, WIDGETS, extra or {}]); s0.close()
    return ctx
def open_pg(ctx, adres, basis=None):
    pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto((basis or BASIS) + adres)
    try: pg.get_by_text('Later (via Profiel bewerken)').click(timeout=3000)
    except Exception: pass
    return pg
RIJEN = "() => [...document.querySelectorAll('.sbw-rij')].map(r => ({ spel: r.dataset.spel, tekst: r.innerText.replace(/\\s+/g, ' ') }))"

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        # ── A ──
        ctx = nieuwe_ctx(b, BASIS)
        pg = open_pg(ctx, 'index.html')
        check(wacht(pg, "() => document.querySelectorAll('.sbw-rij').length >= 3", 15000), 'A: de widget Scorebord staat op Home met spellen')
        rijen = pg.evaluate(RIJEN)
        spellen = [r['spel'] for r in rijen]
        check(spellen[:2] == ['vieroprij', 'flappybird'] and 'koningsjacht' in spellen and 'pesten' in spellen and 'bestaatniet' not in spellen and 'shmup' not in spellen,
              'A: de spellen, het laatst gespeelde eerst; Koningsjacht erbij; geen onbekend spel, geen Neon Raiders zonder score (%s)' % spellen)
        vor = next((r['tekst'] for r in rijen if r['spel'] == 'vieroprij'), '')
        check('Jij: 4× gewonnen' in vor and 'Tijntje: 9× gewonnen' in vor and 'Tijntje staat voor' in vor, 'A: Four in a Row: jij 4×, Tijntje 9× (jouw naam voor Tijn), Tijntje staat voor (%s)' % vor)
        fl = next((r['tekst'] for r in rijen if r['spel'] == 'flappybird'), '')
        check('Jij: 12' in fl and 'bram: 8' in fl and 'Jij staat voor' in fl, 'A: Flapper: jij 12, bram 8, jij staat voor (%s)' % fl)
        kj = next((r['tekst'] for r in rijen if r['spel'] == 'koningsjacht'), '')
        check('Jij: 7/12' in kj and 'Tijntje: 11/12' in kj, 'A: Koningsjacht uit zijn eigen lijst: 7/12 tegen 11/12 (%s)' % kj)
        pe = next((r['tekst'] for r in rijen if r['spel'] == 'pesten'), '')
        check('Nog geen vriend met een score' in pe, 'A: Pesten zonder vriend (%s)' % pe)
        # ── B ──
        pg.click('.sbw-rij[data-spel="vieroprij"]')
        geopend = wacht(pg, "() => !!document.querySelector('.fibro-titelscherm, iframe[src*=\"spel=vieroprij\"]') || location.href.includes('spel=vieroprij')", 8000)
        check(geopend, 'B: tik op Four in a Row: het spel opent')
        pg.close()
        # ── C ──
        STAND['kapot'] = True
        lokaal = json.dumps({'potjes': [{'id': '11111111-1111-4111-8111-111111111111', 'score': 33, 'gewonnen': False, 'niveau': '', 'playedAt': NU}], 'pending': []})
        ctx2 = nieuwe_ctx(b, BASIS, {'fibro_spelscores_v1_swarm_' + UID: lokaal})
        pg = open_pg(ctx2, 'index.html')
        wacht(pg, "() => document.querySelectorAll('.sbw-rij').length >= 1", 15000)
        rijen = pg.evaluate(RIJEN)
        sw = next((r['tekst'] for r in rijen if r['spel'] == 'swarm'), '')
        voet = pg.evaluate("() => document.querySelector('.sbw-voet')?.textContent || ''")
        check('Jij: 33' in sw, 'C: zonder scorelijst: je eigen score van dit toestel (The Swarm 33) (%s)' % [r['spel'] for r in rijen])
        check('zodra je online bent' in voet, 'C: met de regel dat de vrienden later komen')
        STAND['kapot'] = False
        pg.close(); ctx2.close()
        # ── D ── Stekky Studio
        pg = open_pg(ctx, 'studio.html')
        wacht(pg, "() => !!document.getElementById('scoreBlok')", 10000)
        pg.evaluate("() => { document.getElementById('scoreBlok').open = true }")
        n = pg.evaluate("() => document.querySelectorAll('#sbLijst [data-rij]').length")
        check(n >= 12, 'D: Studio: 🏆 Scoreborden met alle spellen (%d)' % n)
        pg.uncheck('#sbLijst input[data-spel="pong"]')
        pg.select_option('#sbLijst select[data-stijl-van="vieroprij"]', 'goud')
        pg.fill('#sbLijst input[data-titel-van="vieroprij"]', 'Vier op een rij!')
        check(pg.evaluate("() => document.querySelector('#sbLijst select[data-stijl-van=\"pong\"]').disabled"), 'D: Neo Paddle uit: de stijl is niet te kiezen')
        pg.click('#sbLijst button[data-voorbeeld="vieroprij"]')
        vb = wacht(pg, "() => { const d = document.querySelector('dialog.nr-scoreboard.sb-stijl-goud'); return d && d.open && d.querySelectorAll('.nr-sb-row').length >= 2 }", 5000)
        merk = pg.evaluate("() => document.querySelector('dialog.nr-scoreboard[open] .nr-sb-eyebrow')?.textContent || ''")
        check(vb and merk == 'VIER OP EEN RIJ!', 'D: 👁 Voorbeeld: het scorebord in goud met de eigen titel (%s)' % merk)
        pg.keyboard.press('Escape')
        with pg.expect_download(timeout=8000) as dl: pg.click('#sbMaak')
        pad = os.path.join(tempfile.mkdtemp(prefix='proef350_'), 'scoreborden.stekky.json'); dl.value.save_as(pad)
        data = json.load(open(pad))
        check(data.get('versie') == 1 and data['scoreborden']['pong']['aan'] is False and data['scoreborden']['vieroprij'] == {'aan': True, 'stijl': 'goud', 'titel': 'Vier op een rij!'},
              'D: scoreborden.stekky.json klopt (pong uit, vieroprij goud)')
        pg.close(); ctx.close()
        # ── E ── installeren in een kopie en daar spelen
        kopie = tempfile.mkdtemp(prefix='proef350_app_')
        shutil.copytree(MAP, kopie, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.git', 'node_modules', 'android'))
        r = subprocess.run(['node', os.path.join(kopie, 'tests/tools/studio-scorebord-installeer.mjs'), pad, '--zonder-versies', '--map', kopie], capture_output=True, text=True)
        inhoud = open(os.path.join(kopie, 'scoreborden.js')).read()
        check(r.returncode == 0 and '"vieroprij": { aan: true, stijl: "goud", titel: "Vier op een rij!" }' in inhoud and '"pong": { aan: false' in inhoud and '"swarm"' not in inhoud,
              'E: het installeerscript zet alleen de afwijkingen in scoreborden.js (%s)' % (r.stdout + r.stderr).strip()[:160])
        fout_r = subprocess.run(['node', os.path.join(kopie, 'tests/tools/studio-scorebord-installeer.mjs'), os.path.join(kopie, 'manifest.json'), '--zonder-versies', '--map', kopie], capture_output=True, text=True)
        check(fout_r.returncode != 0, 'E: een verkeerd bestand wordt geweigerd')
        srv2, BASIS2 = server(kopie)
        ctx3 = nieuwe_ctx(b, BASIS2)
        pg = open_pg(ctx3, 'spel.html?spel=vieroprij&titel=1', BASIS2)
        wacht(pg, "() => !!document.getElementById('scoreKnop')")
        pg.click('#scoreKnop')
        goud = wacht(pg, "() => !!document.querySelector('dialog.nr-scoreboard.sb-stijl-goud[open]')", 5000)
        merk = pg.evaluate("() => document.querySelector('dialog.nr-scoreboard[open] .nr-sb-eyebrow')?.textContent || ''")
        check(goud and merk == 'VIER OP EEN RIJ!', 'E: Four in a Row: het gouden scorebord met de eigen titel (%s)' % merk)
        pg.goto(BASIS2 + 'spel.html?spel=pong&titel=1'); wacht(pg, "() => !!document.querySelector('.niveau-btn')")
        pg.wait_for_timeout(800)
        check(not pg.evaluate("() => !!document.getElementById('scoreKnop')"), 'E: Neo Paddle (uit in Studio): geen knop 🏆 Scores')
        pg.close(); ctx3.close(); srv2.shutdown(); shutil.rmtree(kopie, ignore_errors=True)
        check(not fouten, 'F: geen paginafouten (%s)' % fouten[:3])
        b.close()
except Exception as e:
    check(False, 'proef afgebroken: ' + str(e)[:300])
finally:
    srv.shutdown()
print()
print('%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
