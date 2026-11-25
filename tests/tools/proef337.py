# proef337 (25 nov 2026, Marcel): een spel maken in Stekky Studio, van het formulier tot spelen (spelmaker.js).
# In een kopie van de app (alleen studio-spellen.js en de map spelicoon zijn echt een kopie; de rest verwijst naar de echte map).
#  A. Studio (moderator): "Spel maken": de blauwdruk staat erbij; kaartspel kiezen; zonder naam geen bestand; een speciale
#     kaart erbij; wat er altijd in zit is aangevinkt en vast; met alles ingevuld: een spelbestand dat klopt (met icoon)
#  B. het installatiescript zet het spel in de app (studio-spellen.js, beginspel, icoon, bouwopdracht)
#  C. Store > Games: het spel staat erin met zijn eigen icoon; downloaden = op Home
#  D. Home: de spelwidget met het icoon
#  E. spel.html: het titelscherm (geleend van Pesten) met de eigen naam; dan tegen de computer: niveau kiezen, een zet doen,
#     de computer zet terug, de eigen naam in de titelbalk
#  F. Profiel > Widgets: het spel heeft een rij bij Spellen; geen paginafouten
# python3 -I proef337.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

tmp = tempfile.mkdtemp(prefix='proef337_'); app = os.path.join(tmp, 'Fibro'); os.mkdir(app)
for naam in os.listdir(MAP):
    if naam in ('.git', 'node_modules', 'studio-spellen.js', 'spelicoon', 'spellen'): continue
    os.symlink(os.path.join(MAP, naam), os.path.join(app, naam))
shutil.copy(os.path.join(MAP, 'studio-spellen.js'), os.path.join(app, 'studio-spellen.js'))
os.mkdir(os.path.join(app, 'spelicoon'))
for naam in os.listdir(os.path.join(MAP, 'spelicoon')): os.symlink(os.path.join(MAP, 'spelicoon', naam), os.path.join(app, 'spelicoon', naam))

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
STAND = {'moderator': True}
RIJEN = set()
def supa(route):
    u = route.request.url; m = route.request.method
    een = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=STAND['moderator'])
    if '/rest/v1/store_downloads' in u:
        if m == 'GET': return route.fulfill(status=200, json=[{'item_id': i} for i in sorted(RIJEN)])
        if m == 'POST': RIJEN.add(json.loads(route.request.post_data or '{}').get('item_id')); return route.fulfill(status=201, body='')
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/profiles' in u and m == 'GET':
        p = {"id": UID, "username": "marcel", "is_moderator": STAND['moderator']}
        return route.fulfill(status=200, json=p if een else [p])
    if '/auth/v1/' in u and m == 'GET': return route.fulfill(status=200, json={"id": UID})
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    if '/rest/v1/' in u: return route.fulfill(status=200, json=[])
    return route.fulfill(status=204, body='')

def wacht(pg, js, ms=8000):
    eind = time.time() + ms / 1000
    while time.time() < eind:
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        time.sleep(0.15)
    return False

s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', tmp], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        def context(breed=1280, hoog=900):
            ctx = browser.new_context(viewport={'width': breed, 'height': hoog}, service_workers='block', accept_downloads=True)
            ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), supa)
            ctx.route_web_socket(re.compile(r'.*realtime.*'), lambda w: None)
            ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ");localStorage.setItem('fibro_taal','nl');localStorage.setItem('fibro_opslagtip_later',String(Date.now()));localStorage.setItem('fibro_eigennaam_gevraagd_" + UID + "','1')}catch(e){}")
            return ctx
        fouten = []

        # ── A. Studio ──
        ctx = context(); pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200]))
        pg.goto(BASIS + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        pg.click('#spelBlok summary')
        check('chatbalk onderin' in pg.inner_text('#spelBlok') or pg.locator('#spelBlok details summary', has_text='blauwdruk').count() == 1, 'A de blauwdruk staat erbij')
        pg.click('#spSoorten .sp-soort[data-soort=kaart]')
        check(pg.locator('#spDeck').count() == 1 and pg.locator('#spBord').count() == 0, 'A kaartspel: welk kaartspel en kaarten per speler')
        vast = pg.evaluate("() => [...document.querySelectorAll('#spMet input')].filter(i => i.disabled).map(i => [i.dataset.id, i.checked])")
        check(sorted(vast) == [['computer', True], ['spelmenu', True], ['store', True]], 'A spelmenu, computer en Store zitten er altijd in (%s)' % vast)
        check(pg.input_value('#spSpraak') == 'vanzelf' and pg.input_value('#spTitel') == 'pesten', 'A kaartspel: spraak vanzelf, titelscherm zoals Pesten')
        pg.click('#spMaak')
        check('naam van het spel ontbreekt' in pg.inner_text('#spMelding'), 'A zonder naam: een melding (%s)' % pg.inner_text('#spMelding')[:80])
        pg.fill('#spNaam', 'Kleurenjacht'); pg.fill('#spNaamEn', 'Colour Hunt'); pg.fill('#spIcoon', '🌈')
        pg.fill('#spUitleg', 'Leg kaarten van dezelfde kleur, wie het eerst klaar is wint.'); pg.fill('#spUitlegEn', 'Play cards of the same colour, first to finish wins.')
        pg.fill('#spDoel', 'Wie het eerst geen kaarten meer heeft, wint.')
        pg.fill('#spRegels', 'Iedereen krijgt 7 kaarten. Leg een kaart van dezelfde kleur of waarde op de stapel. Kun je niet, pak er een.')
        pg.select_option('#spDeck', '54')
        pg.click('#spSpeciaalErbij')
        pg.select_option('#spSpeciaal .sp-kaart', '2'); pg.fill('#spSpeciaal .sp-wat', 'De ander pakt 2 kaarten.')
        pg.uncheck('#spMet input[data-id=webcam]')
        pg.check('#spExtras input[data-id=beurtklok]')
        with pg.expect_download() as dl:
            pg.click('#spMaak')
        d = dl.value
        check(d.suggested_filename == 'kleurenjacht.stekkyspel.json', 'A bestandsnaam: %s' % d.suggested_filename)
        bestand = os.path.join(tmp, d.suggested_filename); d.save_as(bestand)
        spel = json.load(open(bestand, encoding='utf8'))
        check(spel.get('formaat') == 'stekky-spel' and spel.get('soort') == 'kaart' and spel.get('naam') == ['Kleurenjacht', 'Colour Hunt'] and spel.get('icoon') == '🌈', 'A het bestand klopt')
        check(spel.get('kaarten') == {'deck': '54', 'perSpeler': 7, 'speciaal': [{'kaart': '2', 'wat': 'De ander pakt 2 kaarten.'}]}, 'A de kaarten: %s' % spel.get('kaarten'))
        check(spel.get('met', {}).get('webcam') is False and spel.get('met', {}).get('chatbalk') is True and 'beurtklok' in spel.get('extras', []), 'A wat erin zit en de extra\'s')
        check(str(spel.get('plaatje', '')).startswith('data:image/webp;base64,'), 'A het icoon is een webp-plaatje')
        check('is gemaakt' in pg.inner_text('#spMelding'), 'A melding: het bestand is gemaakt')
        ctx.close()

        # ── B. installeren ──
        r = subprocess.run(['node', os.path.join(MAP, 'tests/tools/studio-spel-installeer.mjs'), bestand, '--map', app, '--zonder-versies'], capture_output=True, text=True)
        check(r.returncode == 0 and 'kleurenjacht' in r.stdout, 'B geïnstalleerd: %s' % (r.stdout.strip() or r.stderr.strip())[:120])
        check(all(os.path.exists(os.path.join(app, f)) for f in ('kleurenjacht-ui.js', 'kleurenjacht.js', 'spelicoon/kleurenjacht.webp', 'spellen/kleurenjacht.md')), 'B beginspel, icoon en bouwopdracht staan er')

        # ── C. Store ──
        STAND['moderator'] = False
        ctx = context(390, 844); pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200]))
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=game]')
        ITEM = '#lijst .item[data-id="kleurenjacht"]'
        check(wacht(pg, "() => !!document.querySelector('%s img[src*=\"spelicoon/kleurenjacht.webp\"]')" % ITEM), 'C het spel staat bij Games, met zijn icoon')
        if pg.locator(ITEM).count():
            check('Kleurenjacht' in pg.inner_text(ITEM) and 'dezelfde kleur' in pg.inner_text(ITEM), 'C met naam en uitleg')
            pg.click(ITEM + ' .knop')
            check(wacht(pg, "() => document.querySelector('%s .knop').textContent.includes('Gedownload')" % ITEM), 'C gedownload')
            home = json.loads(pg.evaluate("localStorage.getItem('fibro_widgets_profiel_%s')" % UID) or '[]')
            check(any(w.get('id') == 'spel_kleurenjacht' and w.get('aan') for w in home), 'C op Home gezet')

            # ── D. Home ──
            pg.goto(BASIS + 'index.html')
            B = '.widget-blok[data-id="spel_kleurenjacht"]'
            check(wacht(pg, "() => !!document.querySelector('%s img[src*=\"spelicoon/kleurenjacht.webp\"]')" % B, 15000), 'D Home: de spelwidget met het icoon')

            # ── E. spel.html ──
            pg.goto(BASIS + 'spel.html?spel=kleurenjacht')
            check(wacht(pg, "() => { const t = document.querySelector('.fibro-titelscherm'); return !!t && (t.getAttribute('aria-label') || '').startsWith('Kleurenjacht') }", 10000), 'E het titelscherm (zoals Pesten) met de eigen naam')
            pg.goto(BASIS + 'spel.html?spel=kleurenjacht&titel=1')
            check(wacht(pg, "() => document.querySelectorAll('.niveau-btn[data-niveau]').length === 3", 10000), 'E tegen de computer: drie niveaus')
            pg.click('.niveau-btn[data-niveau=moeilijk]')
            check(wacht(pg, "() => (document.querySelector('.sj-status') || {}).textContent === 'Jouw beurt'", 10000), 'E het beginspel staat klaar: jouw beurt')
            check('🌈' in pg.inner_text('#spelTitelBar') and 'Kleurenjacht' in pg.inner_text('#spelTitelBar'), 'E de eigen naam in de titelbalk (%s)' % pg.inner_text('#spelTitelBar'))
            voor = pg.locator('.sj-stokjes > span').count()
            pg.locator('.sj-knoppen button').first.click()
            check(wacht(pg, "() => (document.querySelector('.sj-status') || {}).textContent === 'Jouw beurt' && document.querySelectorAll('.sj-stokjes > span').length < %d" % (voor - 1), 8000), 'E de computer zette terug (%d -> %d)' % (voor, pg.locator('.sj-stokjes > span').count()))

            # ── F. Profiel ──
            pg.goto(BASIS + 'profiel.html')
            check(wacht(pg, "() => { const r = document.getElementById('widgetRij-spel_kleurenjacht'); return !!r && getComputedStyle(r).display !== 'none' && r.innerText.includes('Kleurenjacht') }", 15000), 'F Profiel > Widgets: een rij bij Spellen')
        ctx.close()
        check(not fouten, 'F geen paginafouten (%s)' % fouten[:3])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    server.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
