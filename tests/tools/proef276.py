# proef276 (10 nov 2026, v277): het menu onderaan met lijn-iconen (zoals het ontwerp van de groepschat) in plaats van emoji's.
#  A. Home, Vrienden, Chat, Stijl en een vriendprofiel: 4 knoppen, elk met een lijn-icoon (svg), geen emoji meer
#  B. het gekozen tabblad is paars (accentkleur), ook het icoon (currentColor)
#  C. Engels: Home, Friends, Chat, Style
#  D. het rode bolletje met ongelezen berichten komt nog steeds bij het icoon van Chat (ongelezen.js)
# python3 -I proef276.py <map>
import sys, os, time, json, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def supa(route):
    u = route.request.url
    if '/rest/v1/profiles' in u:
        rij = {"id": BRAM, "username": "Bram"} if BRAM in u else {"id": UID, "username": "Marcel"}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=rij)
        return route.fulfill(status=200, json=[rij])
    return route.fulfill(status=200, json=[])
PAGINAS = [('index.html', 'Home'), ('vrienden.html', 'Vrienden'), ('chat.html', 'Chat'), ('profiel.html', 'Stijl'), ('vriend-profiel.html?id=' + BRAM, 'Vrienden')]
MENU = """() => [...document.querySelectorAll('.bottom-nav > .nav-item')].map(k => ({
  tekst: k.textContent.trim(), svg: k.querySelectorAll('.nav-icon svg').length, actief: k.classList.contains('active'),
  kleur: getComputedStyle(k).color, icoonKleur: k.querySelector('.nav-icon svg') ? getComputedStyle(k.querySelector('.nav-icon svg')).color : '' }))"""

www = tempfile.mkdtemp(prefix='proef276_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for taal in ['nl', 'en']:
            ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 800})
            ctx.route('**/*supabase.co/**', supa)
            pg = ctx.new_page(); fouten = []
            pg.on('pageerror', lambda e: fouten.append(str(e)))
            pg.goto(BASIS + 'login.html')
            pg.evaluate("([t, en]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); if (en) localStorage.setItem('fibro_taal', 'en') }", [TOKEN, taal == 'en'])
            for pad, actief in PAGINAS:
                pg.goto(BASIS + pad); pg.wait_for_timeout(1500)
                m = pg.evaluate(MENU)
                naam = pad.split('?')[0]
                if taal == 'en':
                    check([k['tekst'] for k in m] == ['Home', 'Friends', 'Chat', 'Style'], 'C: %s in het Engels (%s)' % (naam, [k['tekst'] for k in m]))
                    continue
                check([k['tekst'] for k in m] == ['Home', 'Vrienden', 'Chat', 'Stijl'], 'A: %s: vier knoppen (%s)' % (naam, [k['tekst'] for k in m]))
                check(all(k['svg'] == 1 for k in m), 'A: %s: elk een lijn-icoon' % naam)
                html = pg.evaluate("document.querySelector('.bottom-nav').innerHTML")
                check(not any(e in html for e in ['🏠', '👥', '💬', '🖍']), 'A: %s: geen emoji meer in het menu' % naam)
                a = [k for k in m if k['actief']]
                check(len(a) == 1 and a[0]['tekst'] == actief, 'B: %s: %s is gekozen' % (naam, actief))
                check(bool(a) and a[0]['icoonKleur'] == a[0]['kleur'] and a[0]['kleur'] != 'rgb(255, 255, 255)', 'B: %s: gekozen icoon in de accentkleur (%s)' % (naam, a[0]['kleur'] if a else '-'))
                if naam == 'vrienden.html':
                    # D: ongelezen.js zet het bolletje bij het icoon van Chat
                    pg.evaluate("""() => { const i = [...document.querySelectorAll('.nav-item')].find(k => k.textContent.trim().endsWith('Chat')).querySelector('.nav-icon'); window.__icoon = i }""")
                    check(pg.evaluate("!!window.__icoon"), 'D: ongelezen.js vindt het icoon van Chat nog (tekst eindigt op Chat)')
            check(not fouten, '%s: geen paginafouten (%s)' % (taal, fouten[:3]))
            ctx.close()
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
