import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef27: menu onderaan overal gelijk (maat, kleur van de gekozen pagina); schaduw achter tekst alleen
# met een achtergrondfoto, nooit in invoervakken. (stijl.css)
# python3 -I proef27.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www27_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        e = {"id": BRAM if BRAM in u else UID, "username": "bram" if BRAM in u else "marcel", "accent_kleur": "#c084fc"}
        return route.fulfill(status=200, json=e if obj else [e])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
MENU = """() => [...document.querySelectorAll('.bottom-nav .nav-item')].map(n => { const t = n.querySelector('.nav-label') || n; const s = getComputedStyle(t);
  return { tekst: n.innerText.trim().split('\\n').pop(), maat: s.fontSize, kleur: s.color, actief: n.classList.contains('active'), zicht: getComputedStyle(n).opacity } })"""
SCHADUW = """() => { const uit = {}; for (const sel of ['.bottom-nav .nav-item', '.top-bar', '#heroNaam', '.section-label', 'main h1 + *', 'input']) { const e = document.querySelector(sel); if (e) uit[sel] = getComputedStyle(e).textShadow } return uit }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport={'width': 390, 'height': 800}, service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: perr.append(str(e)[:150]))
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    menus = {}
    for pg in ['index.html', 'vrienden.html', 'chat.html', 'profiel.html', 'vriend-profiel.html?id=' + BRAM]:
        p.goto(B + pg); p.wait_for_timeout(2000)
        m = p.evaluate(MENU); menus[pg] = m
        actief = [x for x in m if x['actief']]; anders = [x for x in m if not x['actief']]
        ok = all(x['maat'] == m[0]['maat'] for x in m) and all(x['zicht'] == '1' for x in m) and \
             all(x['kleur'] == 'rgb(192, 132, 252)' for x in actief) and all(x['kleur'] == 'rgb(255, 255, 255)' for x in anders)
        check(pg.split('?')[0] + ': menu: gelijke maat, gekozen pagina paars, rest wit', ok, [(x['tekst'], x['maat'], x['kleur'], x['zicht']) for x in m])
        s = p.evaluate(SCHADUW)
        check(pg.split('?')[0] + ': zonder achtergrondfoto geen schaduw', all(v == 'none' for v in s.values()), s)
        p.evaluate("() => { const d = document.createElement('div'); d.id = 'fibro-wallpaper'; document.body.prepend(d) }"); p.wait_for_timeout(100)
        s = p.evaluate(SCHADUW)
        ok = all((v != 'none') == (k != 'input') for k, v in s.items())
        check(pg.split('?')[0] + ': met achtergrondfoto schaduw (niet in invoervakken)', ok, s)
    maten = {pg: m[0]['maat'] for pg, m in menus.items()}
    check('menu overal even groot', len(set(maten.values())) == 1, maten)
    check('geen fouten op de pagina', perr == [], perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
