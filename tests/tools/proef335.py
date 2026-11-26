# proef335 (25 nov 2026, Marcel): weergaven in kant-en-klare widgets (layouts.js, peertube.js v6), naar de schets van Marcel:
# boven een video-carrousel (vegen, de middelste groot, met miniaturen), eronder nieuws (hier: alleen koppen).
#  A. Studio: weergave kiezen bij een kant-en-klaar vak (carrousel, alleen koppen); het bestand klopt; "Eén groot vak" bestaat
#  B/C. installeren en downloaden
#  D. Home: een carrousel met alle video's; miniaturen (één plaatje, van de eigen server); de middelste is groot;
#     vegen = een andere in het midden; tik = afspelen met Liken en Reageren
#  E. nieuws "alleen koppen": geen plaatjes opgehaald; de miniaturen staan in mix_<uid> (gaan mee naar vrienden)
# (gebaseerd op proef334)
#  A. Studio: "Groot boven, breed eronder"; vak 1 PeerTube kant-en-klaar (spectra.video, Gaming, liken en reageren aan),
#     vak 2 RSS "gebruiker kiest uit mijn lijst" met 4 NU.nl-feeds; een kapotte link = melding; het bestand klopt
#  B. installeren; C. Store: downloaden
#  D. Home: het video-vak haalt zelf de nieuwste Gaming-video's (alleen eigen video's, geen 18+), zonder Wijzigen;
#     onder een video Liken en Reageren
#  E. het RSS-vak haalt de eerste 3 feeds op; "Feeds" = alleen vinkjes bij de 4 feeds van de maker (hoogstens 3, geen
#     vrije links); alleen Sport = alleen Sport opgehaald; alles staat in mix_<uid> (gaat via sync naar vrienden)
# python3 -I proef335.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, shutil, urllib.parse
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

# Een kopie van de app waar alleen studio-layouts.js echt van is
tmp = tempfile.mkdtemp(prefix='proef335_'); app = os.path.join(tmp, 'Fibro'); os.mkdir(app)
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
KORTEN = ['kkGMgK9ZtnKfYAgnEtQxb' + c for c in 'vwxy']
PLAATJES = []
import zlib, struct
def png(kleur, b=160, h=90):
    data = zlib.compress((b'\x00' + bytes(kleur) * b) * h)
    deel = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + deel(b'IHDR', struct.pack('>IIBBBBB', b, h, 8, 2, 0, 0, 0)) + deel(b'IDAT', data) + deel(b'IEND', b'')
def spectra(route):
    u = route.request.url
    if '/api/v1/videos' in u:
        PT.append(u)
        return route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body=json.dumps({'total': 1, 'data': [
            {'shortUUID': k, 'uuid': '9c9de5e8-0a1e-484a-b099-e80766180a6d', 'name': 'Video %d' % n, 'duration': 125, 'channel': {'displayName': 'Retro Gamer'},
             'thumbnailPath': '/lazy-static/thumbnails/%d.png' % n} for n, k in enumerate(KORTEN)]}))
    if '/lazy-static/thumbnails/' in u:
        PLAATJES.append(u)
        n = int(u.rsplit('/', 1)[-1].split('.')[0])
        return route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='image/png', body=png([(220, 40, 60), (40, 120, 220), (30, 160, 80), (240, 170, 20)][n % 4]))
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
        check(pg.locator('#loSjablonen .lo-sjabloon[data-sjabloon="een"]').count() == 1, 'A sjabloon "Eén groot vak" bestaat')
        pg.click('#loSjablonen .lo-sjabloon[data-sjabloon="groot-boven"]')
        V0, V1 = '#loVakken .lo-vakblok[data-vak="0"]', '#loVakken .lo-vakblok[data-vak="1"]'
        check(pg.locator(V0 + ' .lo-weergave').count() == 0, 'A geen weergave zolang de gebruiker het zelf invult')
        pg.select_option(V0 + ' .lo-manier', 'vast')
        pg.select_option(V0 + ' .lo-weergave', 'carrousel')
        pg.select_option(V1 + ' .lo-manier', 'vast')
        pg.select_option(V1 + ' .lo-weergave', 'koppen')
        pg.locator(V1 + ' .lo-feednaam').first.fill('Algemeen'); pg.locator(V1 + ' .lo-feedurl').first.fill(NU[0][1])
        check('carrousel' in pg.inner_text('#loVoorbeeld') and 'alleen koppen' in pg.inner_text('#loVoorbeeld'), 'A het voorbeeld laat de weergave zien')
        pg.fill('#loTitel', 'Video en nieuws')
        with pg.expect_download() as dl:
            pg.click('#loMaak')
        bestand = os.path.join(tmp, dl.value.suggested_filename); dl.value.save_as(bestand)
        layout = json.load(open(bestand, encoding='utf8'))
        check([v.get('weergave') for v in layout['vakken']] == ['carrousel', 'koppen'], 'A weergaven in het bestand')
        ctx.close()

        # B/C. installeren en downloaden
        r = subprocess.run(['node', os.path.join(MAP, 'tests/tools/studio-layout-installeer.mjs'), bestand, '--map', app, '--zonder-versies'], capture_output=True, text=True)
        check(r.returncode == 0, 'B geïnstalleerd: %s' % (r.stdout.strip() or r.stderr.strip())[:100])
        STAND['moderator'] = False
        ctx = context(390, 900); pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        ITEM = '#lijst .item[data-id="layout-video-en-nieuws"]'
        wacht(pg, "() => !!document.querySelector('%s')" % ITEM)
        pg.click(ITEM + ' .knop')
        wacht(pg, "() => document.querySelector('%s .knop').textContent.includes('Gedownload')" % ITEM)

        # D. Home: de carrousel
        pg.goto(BASIS + 'index.html')
        B = '.widget-blok[data-id="mix_l2"]'
        PTV = B + ' .mix-vak[data-soort=peertube]'
        check(wacht(pg, "() => document.querySelectorAll('%s .pt-carrousel .pt-dia').length === 4" % PTV, 15000), 'D een carrousel met de 4 video\'s')
        check(wacht(pg, "() => (document.querySelector('%s .pt-dia-beeld') || {style:{}}).style.backgroundImage.includes('data:image/jpeg')" % PTV, 15000), 'D met miniaturen (één plaatje)')
        check(len(PLAATJES) == 4 and all('spectra.video/lazy-static/thumbnails/' in u for u in PLAATJES), 'D de miniaturen komen van de eigen server (%d)' % len(PLAATJES))
        pg.wait_for_timeout(400)
        m0 = pg.evaluate("() => document.querySelector('%s .pt-midden')?.dataset.id" % PTV)
        maat = pg.evaluate("() => [...document.querySelectorAll('%s .pt-dia')].map(e => Math.round(e.getBoundingClientRect().width))" % PTV)
        check(m0 == KORTEN[0], 'D eerst staat de eerste video in het midden (%s)' % m0)
        pg.evaluate("() => { const r = document.querySelector('%s .pt-carrousel'); r.scrollBy({ left: r.querySelector('.pt-dia').getBoundingClientRect().width * 2.2 }) }" % PTV)
        pg.wait_for_timeout(600)
        m1 = pg.evaluate("() => document.querySelector('%s .pt-midden')?.dataset.id" % PTV)
        check(m1 not in (None, KORTEN[0]), 'D vegen: een andere video in het midden (%s)' % m1)
        breed = pg.evaluate("() => { const r = document.querySelector('%s .pt-carrousel').getBoundingClientRect(); const d = document.querySelector('%s .pt-midden').getBoundingClientRect(); return [Math.round(r.width), Math.round(d.width), Math.round(d.left - r.left), Math.round(r.right - d.right)] }" % (PTV, PTV))
        check(breed[1] > breed[0] * 0.55 and breed[2] > 10 and breed[3] > 10, 'D de middelste is groot, met links en rechts een stukje van de buren (%s)' % breed)
        pg.click(PTV + ' .pt-midden')
        check(wacht(pg, "() => !!document.querySelector('%s iframe.pt-speler') && !!document.querySelector('%s .fv-like')" % (PTV, PTV)), 'D tik = afspelen, met Liken en Reageren')

        # E. nieuws, alleen koppen
        RV = B + ' .mix-vak[data-soort=rss]'
        check(wacht(pg, "() => document.querySelectorAll('%s .rs-kop').length >= 3" % RV, 15000), 'E het nieuws staat eronder')
        check(pg.locator(RV + ' .rs-foto').count() == 0, 'E alleen koppen: geen fotootjes')
        mix = json.loads(pg.evaluate("localStorage.getItem('mix_%s')" % UID) or '{}')
        check(mix.get('l2:rss', {}).get('plaatjes') is False, 'E de server haalt ook geen plaatjes op (plaatjes: false)')
        check(str(mix.get('l2:peertube', {}).get('sprite', '')).startswith('data:image/jpeg') and mix['l2:peertube'].get('spriteN') == 4, 'E de miniaturen staan in mix_<uid> (gaan mee naar vrienden)')
        pg.screenshot(path=os.environ.get('SCHERM', os.path.join(tmp, 'home.png')))
        ctx.close()
        check(not fouten, 'geen paginafouten (%s)' % fouten[:3])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    server.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
