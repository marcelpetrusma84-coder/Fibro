# proef58: Opslaan in Profiel houdt je eigen volgorde van Home (v158), met de echte profiel.html en index.html.
# A. Op Home versleept (indeling in fibro_widgets_profiel_<uid>), dan in Profiel een widget en een sticker erbij, een
#    widget uit, Opslaan: wat er al stond houdt zijn plek, nieuw komt achteraan (in de volgorde van aanzetten),
#    uitgezet gaat weg. Ook widgets met een andere naam in de indeling (countdown = afteltimer, fotos = fotos_3x3).
# B. Home tekent ze in die volgorde. C. Nog nooit versleept (geen indeling): de volgorde van Profiel, zoals vroeger.
# D. Kapotte indeling op het toestel: Opslaan werkt toch (volgorde van Profiel), geen fouten.
# E. Echt slepen op Home, daarna Opslaan in Profiel zonder iets te veranderen: de gesleepte volgorde blijft.
# Oude map als controle: daar zet Opslaan de volgorde terug (A, B en E MIS).
# python3 -I proef58.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "marcel"}
        return route.fulfill(status=200, json=e if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [e])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
def w(id_, i, **x):
    d = {'id': id_, 'icon': '*', 'titel': id_, 'w': 4, 'h': 1, 'volgorde': i, 'aan': True}; d.update(x); return d
def st(code, i): return w('sticker_' + code, i, w=1, h=1, geenHeader=True, titel='Sticker')

www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server'])
    def ev(p, js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:120]
    def begin(widgets, layout):
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa)
        p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:200])); p.on('dialog', lambda d: d.dismiss())
        p.goto(BASIS + 'manifest.json')
        p.evaluate("""([t, u, w, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now()))
          localStorage.setItem('fibro_profiel_' + u, JSON.stringify({ naam: 'Marcel', widgets: w }))
          if (l !== null) localStorage.setItem('fibro_widgets_profiel_' + u, typeof l === 'string' ? l : JSON.stringify(l)) }""", [TOKEN, UID, widgets, layout])
        return ctx, p
    def profiel_open(p):
        p.goto(BASIS + 'profiel.html'); p.wait_for_timeout(2500); ev(p, "() => switchTab('stickers')"); p.wait_for_timeout(400)
    def opslaan(p):
        ev(p, "() => slaAllesOp()"); p.wait_for_timeout(1200)
        l = ev(p, "u => JSON.parse(localStorage.getItem('fibro_widgets_profiel_' + u) || 'null')", UID)
        return l if isinstance(l, list) else []
    ids = lambda l: [x.get('id') for x in sorted(l, key=lambda x: x.get('volgorde', 0))]
    def home_volgorde(p):
        p.goto(BASIS + 'index.html')
        try: p.wait_for_function("() => document.querySelectorAll('#profiel-sectie > .widget-blok').length >= 3", timeout=12000)
        except Exception: pass
        p.wait_for_timeout(800)
        return ev(p, "() => [...document.querySelectorAll('#profiel-sectie > .widget-blok')].map(b => b.dataset.id)")

    # ── A + B ──
    print('A. versleept op Home, dan Opslaan in Profiel')
    ctx, p = begin(['gastenboek', 'mood', 'muziek', 'countdown', 'fotos', 'sticker_f1-07'],
                   [st('f1-07', 0), w('afteltimer', 1, h=2), w('muziek', 2, h=2), w('fotos_3x3', 3, h=3), w('gastenboek', 4, h=4), w('mood', 5)])
    profiel_open(p)
    ev(p, "() => toggleWidget('quote')")
    ev(p, "() => document.querySelector('#panel-stickers [role=switch][data-widget=\"sticker_f1-02\"]').click()")
    ev(p, "() => toggleWidget('muziek')")
    l = opslaan(p)
    check('wat er stond houdt zijn plek, nieuw achteraan, uitgezet weg', ids(l) == ['sticker_f1-07', 'afteltimer', 'fotos_3x3', 'gastenboek', 'mood', 'quote', 'sticker_f1-02'], ids(l))
    check('volgorde 0 t/m 6, alles aan, maten kloppen', [x.get('volgorde') for x in l] == list(range(7)) and all(x.get('aan') is True for x in l)
          and [(x.get('w'), x.get('h')) for x in l] == [(1, 1), (4, 2), (4, 3), (4, 4), (4, 1), (4, 2), (1, 1)], [(x.get('id'), x.get('w'), x.get('h')) for x in l])
    check('geen fouten (Profiel)', p.fouten == [], p.fouten)
    hv = home_volgorde(p)
    check('Home tekent ze in jouw volgorde', hv == ['sticker_f1-07', 'afteltimer', 'fotos_3x3', 'gastenboek', 'mood', 'quote', 'sticker_f1-02'], hv)
    check('geen fouten (Home)', p.fouten == [], p.fouten)
    ctx.close()

    # ── C ──
    print('C. nog nooit versleept')
    ctx, p = begin(['gastenboek', 'mood'], None)
    profiel_open(p); ev(p, "() => toggleWidget('quote')"); ev(p, "() => document.querySelector('#panel-stickers [role=switch][data-widget=\"sticker_f1-05\"]').click()")
    l = opslaan(p)
    check('zonder indeling: de volgorde van Profiel (zoals vroeger)', ids(l) == ['gastenboek', 'mood', 'quote', 'sticker_f1-05'], ids(l))
    ctx.close()

    # ── D ──
    print('D. kapotte indeling')
    ctx, p = begin(['gastenboek', 'mood'], '{kapot')
    profiel_open(p); l = opslaan(p)
    check('kapotte indeling: Opslaan werkt toch', ids(l) == ['gastenboek', 'mood'], ids(l))
    ctx.close()
    ctx, p = begin(['mood', 'gastenboek'], {'geen': 'lijst'})
    profiel_open(p); l = opslaan(p)
    check('indeling is geen lijst: Opslaan werkt toch', ids(l) == ['mood', 'gastenboek'], ids(l))
    check('geen fouten (kapot)', p.fouten == [], p.fouten)
    ctx.close()

    # ── E ──
    print('E. echt slepen op Home, dan Opslaan')
    ctx, p = begin(['mood', 'sticker_f1-01', 'sticker_f1-02', 'sticker_f1-03'], None)
    profiel_open(p); opslaan(p)
    hv = home_volgorde(p)
    r1 = p.locator('#profiel-sectie .widget-blok[data-id="sticker_f1-01"]').bounding_box()
    r3 = p.locator('#profiel-sectie .widget-blok[data-id="sticker_f1-03"]').bounding_box()
    p.mouse.move(r1['x'] + r1['width'] / 2, r1['y'] + r1['height'] / 2); p.mouse.down(); p.wait_for_timeout(700)
    for k in range(1, 11): p.mouse.move(r1['x'] + r1['width'] / 2 + (r3['x'] - r1['x']) * k / 10, r1['y'] + r1['height'] / 2); p.wait_for_timeout(30)
    p.wait_for_timeout(300); p.mouse.up(); p.wait_for_timeout(800)
    gesleept = ev(p, "() => [...document.querySelectorAll('#profiel-sectie > .widget-blok')].map(b => b.dataset.id)")
    check('slepen op Home werkt', hv == ['mood', 'sticker_f1-01', 'sticker_f1-02', 'sticker_f1-03'] and gesleept == ['mood', 'sticker_f1-02', 'sticker_f1-03', 'sticker_f1-01'], (hv, gesleept))
    profiel_open(p); l = opslaan(p)
    check('Opslaan in Profiel: de gesleepte volgorde blijft', ids(l) == ['mood', 'sticker_f1-02', 'sticker_f1-03', 'sticker_f1-01'], ids(l))
    hv = home_volgorde(p)
    check('en Home laat hem zo zien', hv == ['mood', 'sticker_f1-02', 'sticker_f1-03', 'sticker_f1-01'], hv)
    check('geen fouten (slepen)', p.fouten == [], p.fouten)
    ctx.close()
    br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
