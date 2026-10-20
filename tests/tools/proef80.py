# proef80: het versienummer onderaan in het menu (☰) op Home (v183), echte index.html, echte klikken.
#  1. onderaan, na het laatste groepje, staat 'Fibro v183 · 20 okt 2026' (gewone tekst, geen knop): de knoppen in het
#     menu zijn dezelfde als in v182, en de focus staat nog op het eerste item
#  2. tikken op het versienummer sluit het menu niet en doet niets; ernaast tikken sluit het wel
#  3. in het Engels: 'Fibro v183 · 20 Oct 2026'
#  4. op een klein scherm (320 x 568, iPhone SE) zichtbaar na schuiven in het menu, niets breder dan het scherm
#  5. de versie in de tekst is FIBRO_VERSIE/FIBRO_DATUM uit index.html (daar zet elk maak-script hem een hoger)
#  6. tests/gen/bouw.py maakt geen script als het nummer niet precies een omhoog gaat, de datum ouder is, of index.html
#     niet meedoet; wel als het klopt (en op een map van voor v183 zonder nummer)
# Geen paginafouten. Oude map (v182) als controle: geen versienummer (bijna alles MIS).
# python3 -I proef80.py <map>     (FOTO=<map> maakt schermafbeeldingen van het menu)
import sys, os, re, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "Marcel", "bewaar_dagen": 31}; return route.fulfill(status=200, json=e if obj else [e])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
idx = open(os.path.join(MAP, 'index.html'), encoding='utf-8').read()
nr = re.findall(r'^const FIBRO_VERSIE = (\d+)$', idx, re.M); dt = re.findall(r"^const FIBRO_DATUM = '(\d{4})-(\d{2})-(\d{2})'$", idx, re.M)
MAAND_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
MAAND_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
if nr and dt:
    j, mnd, dag = dt[0]; VERWACHT_NL = 'Fibro v%s · %d %s %s' % (nr[0], int(dag), MAAND_NL[int(mnd) - 1], j); VERWACHT_EN = 'Fibro v%s · %d %s %s' % (nr[0], int(dag), MAAND_EN[int(mnd) - 1], j)
else:
    VERWACHT_NL = VERWACHT_EN = '(geen FIBRO_VERSIE in index.html)'
check('index.html: FIBRO_VERSIE en FIBRO_DATUM elk een keer', len(nr) == 1 and len(dt) == 1, (nr, dt))
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
KNOPPEN = "() => [...document.querySelectorAll('#fibroMenu [role^=menuitem]')].map(b => b.textContent)"
VERSIE = """() => { const m = document.getElementById('fibroMenu'), v = document.getElementById('menuVersie'); if (!m || !v) return null
  return { tekst: v.textContent, laatste: m.lastElementChild === v, rol: v.getAttribute('role'), knop: !!v.closest('button,[role^=menuitem]') || v.tagName === 'BUTTON',
           tab: v.tabIndex, zichtbaar: getComputedStyle(v).display !== 'none' && v.getBoundingClientRect().height > 0 } }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server'])
    def pagina(taal='nl', maat=(390, 844)):
        ctx = br.new_context(service_workers='block', viewport={'width': maat[0], 'height': maat[1]}, locale='nl-NL')
        ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.dismiss())
        p.goto(B + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
        p.goto(B + 'index.html'); p.wait_for_timeout(2500)
        return ctx, p
    def klik(p, sel):
        try: p.click(sel, timeout=3000); p.wait_for_timeout(400); return True
        except Exception as e: print('   klik', sel, str(e)[:80]); return False
    def ev(p, js):
        try: return p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:100]

    print('1. Het menu')
    ctx, p = pagina()
    klik(p, '#menuBtn')
    v = ev(p, VERSIE)
    check('onderaan het menu: ' + VERWACHT_NL, isinstance(v, dict) and v['tekst'] == VERWACHT_NL and v['laatste'] and v['zichtbaar'], v)
    check('gewone tekst: geen knop, niet in de tab-volgorde', isinstance(v, dict) and not v['knop'] and v['tab'] < 0 and v['rol'] is None, v)
    kn = ev(p, KNOPPEN)
    check('de knoppen in het menu zijn dezelfde als in v182', kn == ['\U0001F310 Taal / Language', '⏳ Berichten bewaren', '\U0001F3B5 Mijn muziek vanzelf: aan',
                                                                     '\U0001F3B5 Muziek van vrienden vanzelf: aan', '\U0001F4E6 Mijn gegevens downloaden',
                                                                     '\U0001F5D1️ Account verwijderen', 'ℹ️ Over Fibro', '\U0001F4F2 Fibro als app installeren'], kn)
    check('de focus staat nog op het eerste item', ev(p, "() => document.activeElement && document.activeElement.textContent") == '\U0001F310 Taal / Language')
    if FOTO and isinstance(v, dict): p.screenshot(path=os.path.join(FOTO, 'menu-versie-nl.png'))

    print('2. Tikken')
    if isinstance(v, dict): klik(p, '#menuVersie')
    check('tikken op het versienummer: menu blijft open', isinstance(v, dict) and ev(p, "() => !!document.getElementById('fibroMenu')") is True)
    p.mouse.click(20, 700); p.wait_for_timeout(300)
    check('ernaast tikken: menu dicht', ev(p, "() => !document.getElementById('fibroMenu')") is True)
    check('geen paginafouten', not p.fouten, p.fouten[:3])
    ctx.close()

    print('3. In het Engels')
    ctx, p = pagina('en'); klik(p, '#menuBtn'); v = ev(p, VERSIE)
    check('Engels: ' + VERWACHT_EN, isinstance(v, dict) and v['tekst'] == VERWACHT_EN, v)
    if FOTO and isinstance(v, dict): p.screenshot(path=os.path.join(FOTO, 'menu-versie-en.png'))
    ctx.close()

    print('4. Klein scherm')
    ctx, p = pagina(maat=(320, 568)); klik(p, '#menuBtn')
    ev(p, "() => { const m = document.getElementById('fibroMenu'); if (m) m.scrollTop = m.scrollHeight }"); p.wait_for_timeout(200)
    r = ev(p, """() => { const v = document.getElementById('menuVersie'), m = document.getElementById('fibroMenu'); if (!v || !m) return null
      const a = v.getBoundingClientRect(), b = m.getBoundingClientRect()
      return { binnen: a.top >= b.top - 1 && a.bottom <= b.bottom + 1 && a.bottom <= innerHeight, breed: Math.max(document.documentElement.scrollWidth, b.right) <= innerWidth + 1, regels: Math.round(a.height / 14) } }""")
    check('320 px: na schuiven zichtbaar, op een regel, niets breder dan het scherm', isinstance(r, dict) and r['binnen'] and r['breed'] and r['regels'] <= 3, r)
    if FOTO and isinstance(r, dict): p.screenshot(path=os.path.join(FOTO, 'menu-versie-320.png'))
    ctx.close()
    br.close()
srv.kill(); shutil.rmtree(www, ignore_errors=True)

print('6. bouw.py')
GEN = os.path.join(MAP, 'tests', 'gen')
def probeer(oud_nr, oud_dt, nieuw_nr, nieuw_dt, gewijzigd=('index.html',)):
    d = tempfile.mkdtemp()
    for k, (n, dd) in (('oud', (oud_nr, oud_dt)), ('nieuw', (nieuw_nr, nieuw_dt))):
        os.makedirs(os.path.join(d, k))
        regels = ['<html>']
        if n is not None: regels += ['const FIBRO_VERSIE = %d' % n, "const FIBRO_DATUM = '%s'" % dd]
        open(os.path.join(d, k, 'index.html'), 'w').write('\n'.join(regels + ['<!-- %s -->' % k, '</html>', '']))
    code = ("import sys; sys.path.insert(0, %r); import bouw; bouw.bouw('proef', %r, %r, %r, [], [], 'proef', [], %r)"
            % (GEN, d + '/oud', d + '/nieuw', list(gewijzigd), d + '/maak-proef.py'))
    r = subprocess.run([sys.executable, '-I', '-B', '-c', code], capture_output=True, text=True, timeout=30)  # -B: geen __pycache__ in tests/gen (v184)
    gemaakt = os.path.exists(d + '/maak-proef.py'); shutil.rmtree(d, ignore_errors=True)
    return gemaakt, (r.stdout + r.stderr).strip().splitlines()[-1:] if (r.stdout + r.stderr).strip() else ''
g = probeer(183, '2026-10-20', 184, '2026-10-21'); check('bouw.py: v183 -> v184 met een latere datum: script gemaakt', g[0] is True, g)
g = probeer(183, '2026-10-20', 184, '2026-10-20'); check('bouw.py: zelfde datum mag ook', g[0] is True, g)
g = probeer(183, '2026-10-20', 183, '2026-10-21'); check('bouw.py: nummer niet omhoog: geen script', g[0] is False and 'versienummer' in str(g[1]), g)
g = probeer(183, '2026-10-20', 185, '2026-10-21'); check('bouw.py: nummer twee omhoog: geen script', g[0] is False and 'versienummer' in str(g[1]), g)
g = probeer(183, '2026-10-20', 184, '2026-10-19'); check('bouw.py: oudere datum: geen script', g[0] is False and 'versienummer' in str(g[1]), g)
g = probeer(183, '2026-10-20', 184, '2026-13-40'); check('bouw.py: onzin-datum: geen script', g[0] is False, g)
g = probeer(183, '2026-10-20', None, None); check('bouw.py: nummer weg: geen script', g[0] is False, g)
g = probeer(183, '2026-10-20', 184, '2026-10-21', gewijzigd=()); check('bouw.py: index.html doet niet mee: geen script', g[0] is False and 'index.html' in str(g[1]), g)
g = probeer(None, None, 183, '2026-10-20'); check('bouw.py: van een map zonder nummer (v182) naar v183: script gemaakt', g[0] is True, g)
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
