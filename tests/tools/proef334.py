# proef334 (25 nov 2026, Marcel): kant-en-klare widgets uit Stekky Studio (layouts.js).
#  A. Studio: "Groot boven, breed eronder"; vak 1 PeerTube kant-en-klaar (spectra.video, Gaming, liken en reageren aan),
#     vak 2 RSS "gebruiker kiest uit mijn lijst" met 4 NU.nl-feeds; een kapotte link = melding; het bestand klopt
#  B. installeren; C. Store: downloaden
#  D. Home: het video-vak haalt zelf de nieuwste Gaming-video's (alleen eigen video's, geen 18+), zonder Wijzigen;
#     onder een video Liken en Reageren
#  E. het RSS-vak haalt de eerste 3 feeds op; "Feeds" = alleen vinkjes bij de 4 feeds van de maker (hoogstens 3, geen
#     vrije links); alleen Sport = alleen Sport opgehaald; alles staat in mix_<uid> (gaat via sync naar vrienden)
# python3 -I proef334.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, shutil, urllib.parse
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

# Een kopie van de app waar alleen studio-layouts.js echt van is
tmp = tempfile.mkdtemp(prefix='proef334_'); app = os.path.join(tmp, 'Fibro'); os.mkdir(app)
for naam in os.listdir(MAP):
    if naam in ('.git', 'node_modules', 'studio-layouts.js'): continue
    os.symlink(os.path.join(MAP, naam), os.path.join(app, naam))
bron = open(os.path.join(MAP, 'studio-layouts.js'), encoding='utf8').read()
open(os.path.join(app, 'studio-layouts.js'), 'w', encoding='utf8').write(re.sub(r'export const STUDIO_LAYOUTS = [\s\S]*$', 'export const STUDIO_LAYOUTS = []\n', bron))

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
STAND = {'moderator': True}
RIJEN = set()
RSS, PT = [], []
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'}
NU_MS = int(time.time() * 1000)
KORT = 'kkGMgK9ZtnKfYAgnEtQxbv'
def spectra(route):
    u = route.request.url
    if '/api/v1/videos' in u:
        PT.append(u)
        return route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body=json.dumps({'total': 1, 'data': [
            {'shortUUID': KORT, 'uuid': '9c9de5e8-0a1e-484a-b099-e80766180a6d', 'name': 'Speedrun level 1', 'duration': 125, 'channel': {'displayName': 'Retro Gamer'}}]}))
    route.fulfill(status=200, content_type='text/html', body='<html><body>nep-peertube</body></html>')
def supa(route):
    u = route.request.url; m = route.request.method
    een = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=STAND['moderator'])
    if '/rest/v1/store_downloads' in u:
        if m == 'GET': return route.fulfill(status=200, json=[{'item_id': i} for i in sorted(RIJEN)])
        if m == 'POST': RIJEN.add(json.loads(route.request.post_data or '{}').get('item_id')); return route.fulfill(status=201, body='')
    if '/functions/v1/rss-ophalen' in u:
        if m == 'OPTIONS': return route.fulfill(status=200, headers=CORS, body='ok')
        b = json.loads(route.request.post_data or '{}')
        if 'plaatje' in b: return route.fulfill(status=404, headers=CORS, json={'ok': False})
        RSS.append(b.get('url'))
        naam = (b.get('url') or '').rsplit('/', 1)[-1]
        return route.fulfill(status=200, headers=CORS, json={'ok': True, 'titel': 'NU - ' + naam, 'afbeelding': '', 'link': '',
            'berichten': [{'titel': naam + ' bericht %d' % i, 'link': 'https://www.nu.nl/' + naam.lower() + '/%d' % i, 'datum': NU_MS - i * 60000 - len(RSS), 'tekst': ''} for i in range(3)]})
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/profiles' in u and m == 'GET':
        p = {"id": UID, "username": "marcel", "is_moderator": STAND['moderator']}
        return route.fulfill(status=200, json=p if een else [p])
    if '/auth/v1/' in u and m == 'GET': return route.fulfill(status=200, json={"id": UID})
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    if '/rest/v1/' in u: return route.fulfill(status=200, json=[])
    return route.fulfill(status=204, body='')

def wacht(pg, js, ms=8000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
NU = [('Algemeen', 'https://www.nu.nl/rss/Algemeen'), ('Sport', 'https://www.nu.nl/rss/Sport'), ('Tech', 'https://www.nu.nl/rss/Tech'), ('Economie', 'https://www.nu.nl/rss/Economie')]

s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', tmp], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        def context(breed=1280, hoog=900):
            ctx = browser.new_context(viewport={'width': breed, 'height': hoog}, service_workers='block', accept_downloads=True)
            ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!spectra\.video).*'), supa)
            ctx.route('https://spectra.video/**', spectra)
            ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ");localStorage.setItem('fibro_taal','nl');localStorage.setItem('fibro_opslagtip_later',String(Date.now()))}catch(e){}")
            return ctx
        fouten = []

        # A. Studio
        ctx = context(); pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(BASIS + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        pg.click('#layoutBlok summary')
        pg.click('#loSjablonen .lo-sjabloon[data-sjabloon="groot-boven"]')
        V0, V1 = '#loVakken .lo-vakblok[data-vak="0"]', '#loVakken .lo-vakblok[data-vak="1"]'
        check(pg.locator(V0 + ' .lo-manier option').count() == 2 and pg.locator(V1 + ' .lo-manier option').count() == 3, 'A PeerTube: zelf of vast; RSS: zelf, vast of kiezen')
        pg.select_option(V0 + ' .lo-manier', 'vast')
        check(pg.input_value(V0 + ' .lo-server') == 'spectra.video' and pg.is_checked(V0 + ' .lo-cats input[value="7"]') and pg.is_checked(V0 + ' .lo-reageren'), 'A PeerTube vast: spectra.video, Gaming en reageren staan klaar')
        pg.select_option(V1 + ' .lo-manier', 'kiezen')
        for n, (naam, url) in enumerate(NU):
            if n: pg.click(V1 + ' .lo-feederbij')
            pg.locator(V1 + ' .lo-feednaam').nth(n).fill(naam)
            pg.locator(V1 + ' .lo-feedurl').nth(n).fill(url if n != 2 else 'http://www.nu.nl/rss/Tech')
        check('geen goede https-link' in pg.inner_text('#loMelding'), 'A een http-link: melding')
        pg.locator(V1 + ' .lo-feedurl').nth(2).fill(NU[2][1])
        check(pg.inner_text('#loMelding').strip() == '', 'A alles goed: geen melding')
        check('☑️ kiezen' in pg.inner_text('#loVoorbeeld') and '🔒 vast' in pg.inner_text('#loVoorbeeld'), 'A het voorbeeld laat vast en kiezen zien')
        pg.fill('#loTitel', 'Gaming en nieuws')
        with pg.expect_download() as dl:
            pg.click('#loMaak')
        bestand = os.path.join(tmp, dl.value.suggested_filename); dl.value.save_as(bestand)
        layout = json.load(open(bestand, encoding='utf8'))
        inh = [v.get('inhoud') for v in layout['vakken']]
        check(inh[0] == {'manier': 'vast', 'server': 'spectra.video', 'cats': [7], 'reageren': True}, 'A PeerTube-inhoud in het bestand: %s' % inh[0])
        check(inh[1] and inh[1]['manier'] == 'kiezen' and [f['naam'] for f in inh[1]['feeds']] == [n for n, _ in NU], 'A RSS-inhoud in het bestand')
        ctx.close()

        # B. installeren
        r = subprocess.run(['node', os.path.join(MAP, 'tests/tools/studio-layout-installeer.mjs'), bestand, '--map', app, '--zonder-versies'], capture_output=True, text=True)
        check(r.returncode == 0, 'B geïnstalleerd: %s' % (r.stdout.strip() or r.stderr.strip())[:100])

        # C. Store
        STAND['moderator'] = False
        ctx = context(390, 900); pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        ITEM = '#lijst .item[data-id="layout-gaming-en-nieuws"]'
        check(wacht(pg, "() => !!document.querySelector('%s')" % ITEM) and 'Algemeen, Sport, Tech, Economie' in pg.inner_text(ITEM), 'C in de Store, met de feeds in het plaatje')
        pg.click(ITEM + ' .knop')
        wacht(pg, "() => document.querySelector('%s .knop').textContent.includes('Gedownload')" % ITEM)

        # D. Home: het video-vak
        pg.goto(BASIS + 'index.html')
        B = '.widget-blok[data-id="mix_l1"]'
        PTV = B + ' .mix-vak[data-soort=peertube]'
        check(wacht(pg, "() => !!document.querySelector('%s .pt-video')" % PTV, 15000), 'D het video-vak laat de nieuwste Gaming-video zien')
        check(PT and 'categoryOneOf=7' in PT[0] and 'isLocal=true' in PT[0] and 'nsfw=false' in PT[0], 'D alleen Gaming, eigen video\'s, geen 18+')
        check(pg.locator(PTV + ' .pt-wijzig, ' + PTV + ' .pt-kies, ' + PTV + ' .pt-kies-cat').count() == 0, 'D vast: geen Wijzigen of Kiezen')
        pg.click(PTV + ' .pt-video')
        check(wacht(pg, "() => !!document.querySelector('%s .fv-like') && !!document.querySelector('%s .fv-reageer')" % (PTV, PTV)), 'D onder de video: Liken en Reageren')

        # E. het RSS-vak
        RV = B + ' .mix-vak[data-soort=rss]'
        check(wacht(pg, "() => document.querySelectorAll('%s .rs-kop').length >= 3" % RV, 15000), 'E het RSS-vak heeft berichten')
        check(sorted(RSS[:3]) == sorted(u for _, u in NU[:3]), 'E eerst de eerste 3 feeds opgehaald (%s)' % RSS)
        pg.click(RV + ' .rs-wijzig')
        check(pg.locator(RV + ' .mix-keuze input[type=checkbox]').count() == 4 and pg.locator(RV + ' .mix-keuze input:checked').count() == 3, 'E "Feeds": vinkjes bij de 4 feeds van de maker, 3 aan')
        check(pg.locator(RV + ' input[type=url], ' + RV + ' .rs-bewerk').count() == 0, 'E geen vrije links invullen')
        pg.click(RV + ' .mix-keuze input[value="%s"]' % NU[3][1])
        check(pg.locator(RV + ' .mix-keuze input:checked').count() == 3 and 'Hoogstens 3' in pg.inner_text(RV + ' .mix-keuze'), 'E een 4e aanvinken kan niet')
        for naam, url in [NU[0], NU[2]]: pg.uncheck(RV + ' .mix-keuze input[value="%s"]' % url)
        voor = len(RSS)
        pg.click(RV + ' .mix-klaar')
        check(wacht(pg, "() => [...document.querySelectorAll('%s .rs-kop')].some(e => e.textContent.startsWith('Sport'))" % RV, 10000) and RSS[voor:] == [NU[1][1]], 'E alleen Sport: alleen Sport opgehaald (%s)' % RSS[voor:])
        mix = json.loads(pg.evaluate("localStorage.getItem('mix_%s')" % UID) or '{}')
        check([f['naam'] for f in mix.get('l1:rss', {}).get('feeds', [])] == ['Sport'] and mix.get('l1:peertube', {}).get('videos'), 'E alles staat in mix_<uid> (%s)' % list(mix))
        check(pg.evaluate("localStorage.getItem('rss_%s')" % UID) is None and pg.evaluate("localStorage.getItem('peertube_%s')" % UID) is None, 'E de gewone RSS- en PeerTube-widget blijven leeg (eigen inhoud)')
        ctx.close()
        check(not fouten, 'geen paginafouten (%s)' % fouten[:3])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    server.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
