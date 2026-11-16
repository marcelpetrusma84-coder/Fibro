# proef276 (10 nov 2026, v277): het menu onderaan met lijn-iconen (zoals het ontwerp van de groepschat) in plaats van emoji's.
#  A. Home, Vrienden, Chat, Stijl en een vriendprofiel: 4 knoppen, elk met een lijn-icoon (svg), geen emoji meer
#  B. het gekozen tabblad is paars (accentkleur), ook het icoon (currentColor)
#  C. Engels: Home, Friends, Chat, Style
#  D. het rode bolletje met ongelezen berichten komt nog steeds bij het icoon van Chat (ongelezen.js)
#  E. Stijl > UX: Modern/Nostalgia met elk drie voorbeelden, op de telefoon passend en direct toepasbaar
#  F. de voorkeur blijft bij herladen en navigeren; profieltabs en chatknoppen doen mee, Modern herstelt de lijniconen
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

            # De nieuwe keuze werkt met gewone radioknoppen en navigatie, zonder een profielsave.
            pg.goto(BASIS + 'profiel.html'); pg.wait_for_selector('#tab-kleur')
            pg.click('#tab-kleur')
            pg.wait_for_selector('#panel-kleur.active [data-icoonthema-keuze]')
            check(pg.text_content('#tab-kleur .tab-woord') == 'UX', 'E: Kleur heet nu UX (%s)' % taal)
            voorbeelden = pg.evaluate("() => [...document.querySelectorAll('.icoonthema-keuze')].map(e => e.querySelectorAll('.icoonthema-voorbeelden > span').length)")
            check(voorbeelden == [3, 3], 'E: beide stijlen tonen precies drie voorbeeldiconen (%s)' % taal)
            check(pg.evaluate("() => { const p = document.querySelector('#panel-kleur'); return p.lastElementChild.contains(p.querySelector('.icoonthema-sectie')) }"), 'E: Icoonthema is de laatste UX-sectie')
            pg.locator('[data-icoonthema-keuze][value=nostalgia]').check()
            check(pg.get_attribute('html', 'data-icoonthema') == 'nostalgia' and pg.evaluate("localStorage.getItem('fibro_icoonthema')") == 'nostalgia', 'E: Nostalgia geldt direct en wordt bewaard')
            check(pg.evaluate("() => [...document.querySelectorAll('.icoonthema-keuze')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 })"), 'E: de twee thema-keuzes passen op 390px')
            check(pg.locator('.bottom-nav .icoon-nostalgia').count() == 4 and pg.evaluate("() => [...document.querySelectorAll('.bottom-nav .icoon-modern')].every(e => getComputedStyle(e).display === 'none')"), 'E: vier kleurrijke menu-iconen vervangen de lijniconen visueel')
            check(pg.locator('.main-tab > .icoon-nostalgia').count() >= 7 and pg.text_content('#tab-kleur .tab-woord') == 'UX', 'E: ook de Stijl-tabs krijgen hun oude iconen, labels blijven staan')
            if taal == 'en':
                check('Icon theme' in pg.text_content('.icoonthema-sectie') and 'saved on this device' in pg.text_content('.icoonthema-bewaren'), 'E: de nieuwe uitleg wordt naar Engels vertaald')
            pg.reload(); pg.wait_for_selector('.bottom-nav .icoon-nostalgia')
            check(pg.get_attribute('html', 'data-icoonthema') == 'nostalgia' and pg.locator('.bottom-nav .icoon-nostalgia').count() == 4, 'F: herladen behoudt Nostalgia')
            for icoon, pad in [('home', 'index.html'), ('vrienden', 'vrienden.html'), ('chat', 'chat.html')]:
                pg.click('.bottom-nav [data-icoon="%s"]' % icoon)
                pg.wait_for_url('**/' + pad)
                pg.wait_for_selector('.bottom-nav .icoon-nostalgia')
                check(pg.get_attribute('html', 'data-icoonthema') == 'nostalgia' and pg.locator('.bottom-nav .icoon-nostalgia').count() == 4, 'F: %s krijgt dezelfde bewaarde keuze' % pad)
            check(pg.evaluate("() => { const knoppen = [...document.querySelectorAll('[data-icoon]')].filter(e => ['emoji','foto','microfoon','spel','buzz'].includes(e.dataset.icoon)); return knoppen.length >= 5 && knoppen.every(e => e.querySelector('.icoon-nostalgia')) }"), 'F: chatknoppen doen mee met Nostalgia')
            check(pg.evaluate("() => [...document.querySelectorAll('.nav-item')].some(e => e.textContent.trim().endsWith('Chat'))"), 'F: de ongelezen-berichtenzoeker kan Chat blijven vinden')
            pg.click('.bottom-nav [data-icoon=stijl]'); pg.wait_for_url('**/profiel.html')
            pg.click('#tab-kleur'); pg.locator('[data-icoonthema-keuze][value=modern]').check()
            check(pg.get_attribute('html', 'data-icoonthema') == 'modern' and pg.locator('.bottom-nav .icoon-nostalgia').count() == 0 and pg.locator('.main-tab > .icoon-nostalgia').count() == 0, 'F: Modern herstelt alle lijniconen zonder verborgen emoji')
            check(pg.evaluate("() => [...document.querySelectorAll('.bottom-nav .icoon-modern')].every(e => getComputedStyle(e).display !== 'none')"), 'F: de moderne lijniconen zijn weer zichtbaar')
            pg.locator('[data-icoonthema-keuze][value=modern]').press('ArrowRight')
            check(pg.get_attribute('html', 'data-icoonthema') == 'nostalgia', 'F: pijltoets rechts kiest Nostalgia')
            pg.locator('[data-icoonthema-keuze][value=nostalgia]').press('ArrowLeft')
            check(pg.get_attribute('html', 'data-icoonthema') == 'modern', 'F: pijltoets links kiest Modern')
            pg.reload(); pg.wait_for_selector('.bottom-nav .nav-icon svg')
            check(pg.get_attribute('html', 'data-icoonthema') == 'modern' and pg.locator('.bottom-nav .icoon-nostalgia').count() == 0, 'F: ook terugschakelen naar Modern wordt onthouden')
            check(not fouten, '%s: geen paginafouten (%s)' % (taal, fouten[:3]))
            ctx.close()
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
