# proef333 (25 nov 2026, Marcel): widget-layouts uit Stekky Studio, van Studio tot Home (layouts.js).
# In een kopie van de app (alleen studio-layouts.js is echt een kopie; de rest verwijst naar de echte map).
#  A. Studio (moderator): sjabloon "Groot boven, twee eronder", wat er in elk vak komt; twee keer dezelfde soort = melding;
#     zonder naam geen bestand; met naam: een layoutbestand (naam.stekkylayout.json) dat klopt
#  B. het installatie-script zet het bestand in de app (l2: l1 was Nu.nl en wordt niet opnieuw gebruikt)
#  C. Store > Widgets: de layout staat erin met een plaatje van de vakken; downloaden = op Home (mix_l2, 4 breed, 6 hoog)
#  D. Home: één widget met drie vakken (PeerTube groot boven, muziek en RSS eronder naast elkaar), elk vak is de
#     gewone widget ("Nog geen video" met "Video kiezen"); niets steekt uit; geen paginafouten
# python3 -I proef333.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, shutil, urllib.parse
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

# Een kopie van de app waar alleen studio-layouts.js echt van is
tmp = tempfile.mkdtemp(prefix='proef333_'); app = os.path.join(tmp, 'Fibro'); os.mkdir(app)
for naam in os.listdir(MAP):
    if naam in ('.git', 'node_modules', 'studio-layouts.js'): continue
    os.symlink(os.path.join(MAP, naam), os.path.join(app, naam))
bron = open(os.path.join(MAP, 'studio-layouts.js'), encoding='utf8').read()
open(os.path.join(app, 'studio-layouts.js'), 'w', encoding='utf8').write(re.sub(r'export const STUDIO_LAYOUTS = [\s\S]*$', 'export const STUDIO_LAYOUTS = []\n', bron))

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
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False

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
            ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ");localStorage.setItem('fibro_taal','nl');localStorage.setItem('fibro_opslagtip_later',String(Date.now()))}catch(e){}")
            return ctx
        fouten = []

        # A. Studio
        ctx = context(); pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(BASIS + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        pg.click('#layoutBlok summary')
        check(pg.locator('#loSjablonen .lo-sjabloon').count() == 5, 'A vijf sjablonen om uit te kiezen (ook Eén groot vak)')
        pg.click('#loSjablonen .lo-sjabloon[data-sjabloon="drie"]')
        check(pg.locator('#loVakken select.lo-soort').count() == 3 and pg.locator('#loVoorbeeld .lo-vak').count() == 3, 'A "Groot boven, twee eronder": drie vakken en een voorbeeld')
        pg.select_option('#loVakken select[data-vak="1"]', 'rss')
        check('staat er al in' in pg.inner_text('#loMelding'), 'A twee keer RSS: melding "staat er al in"')
        pg.select_option('#loVakken select[data-vak="1"]', 'muziekwidget')
        check(pg.inner_text('#loMelding').strip() == '', 'A weer goed: geen melding')
        pg.click('#loMaak')
        check('naam van de layout ontbreekt' in pg.inner_text('#loMelding'), 'A zonder naam: geen bestand, wel een melding')
        pg.fill('#loTitel', 'Video en nieuws')
        with pg.expect_download() as dl:
            pg.click('#loMaak')
        d = dl.value
        check(d.suggested_filename == 'video-en-nieuws.stekkylayout.json', 'A bestandsnaam: %s' % d.suggested_filename)
        bestand = os.path.join(tmp, d.suggested_filename); d.save_as(bestand)
        layout = json.load(open(bestand, encoding='utf8'))
        check(layout.get('formaat') == 'stekky-layout' and layout.get('h') == 6 and [v['soort'] for v in layout['vakken']] == ['peertube', 'muziekwidget', 'rss'], 'A het bestand klopt (%s)' % [v['soort'] for v in layout.get('vakken', [])])
        check('is gemaakt' in pg.inner_text('#loMelding'), 'A melding: het bestand is gemaakt')
        ctx.close()

        # B. installeren
        r = subprocess.run(['node', os.path.join(MAP, 'tests/tools/studio-layout-installeer.mjs'), bestand, '--map', app, '--zonder-versies'], capture_output=True, text=True)
        check(r.returncode == 0 and 'mix_l2' in r.stdout, 'B geïnstalleerd: %s' % (r.stdout.strip() or r.stderr.strip())[:100])

        # C. Store
        STAND['moderator'] = False
        ctx = context(390, 844); pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        ITEM = '#lijst .item[data-id="layout-video-en-nieuws"]'
        check(wacht(pg, "() => !!document.querySelector('%s')" % ITEM), 'C de layout staat bij Widgets in de Store')
        if pg.locator(ITEM).count():
            t = pg.inner_text(ITEM)
            check('Video en nieuws' in t and pg.locator(ITEM + ' .item-layout > div').count() == 3, 'C met naam en een plaatje van de drie vakken')
            pg.click(ITEM + ' .knop')
            check(wacht(pg, "() => document.querySelector('%s .knop').textContent.includes('Gedownload')" % ITEM), 'C gedownload')
            home = json.loads(pg.evaluate("localStorage.getItem('fibro_widgets_profiel_%s')" % UID) or '[]')
            mix = [w for w in home if w.get('id') == 'mix_l2']
            check(mix and mix[0].get('aan') and mix[0].get('w') == 4 and mix[0].get('h') == 6 and mix[0].get('titel') == 'Video en nieuws', 'C op Home gezet: %s' % mix)

            # D. Home
            pg.goto(BASIS + 'index.html')
            B = '.widget-blok[data-id="mix_l2"]'
            check(wacht(pg, "() => document.querySelectorAll('%s .mix-vak').length === 3" % B, 15000), 'D op Home: één widget met drie vakken')
            soorten = pg.evaluate("() => [...document.querySelectorAll('%s .mix-vak')].map(v => v.dataset.soort)" % B)
            check(soorten == ['peertube', 'muziekwidget', 'rss'], 'D de juiste widgets in de vakken (%s)' % soorten)
            check(wacht(pg, "() => (document.querySelector('%s .mix-vak[data-soort=peertube]') || {}).textContent?.includes('Nog geen video')" % B, 8000)
                  and pg.locator(B + ' .mix-vak[data-soort=peertube] .pt-kies').count() == 1, 'D het video-vak is de gewone PeerTube-widget (Nog geen video, Video kiezen)')
            maat = pg.evaluate("""() => { const b = document.querySelector('%s').getBoundingClientRect()
              const v = [...document.querySelectorAll('%s .mix-vak')].map(e => e.getBoundingClientRect())
              return { breed: Math.round(v[0].width), half: [Math.round(v[1].width), Math.round(v[2].width)], naast: Math.abs(v[1].top - v[2].top) < 2 && v[1].left < v[2].left,
                       onder: v[1].top >= v[0].bottom - 1, uit: v.some(r => r.left < b.left - 1 || r.right > b.right + 1), schuif: document.documentElement.scrollWidth - innerWidth } }""" % (B, B))
            check(maat['naast'] and maat['onder'] and maat['breed'] > max(maat['half']) * 1.8, 'D groot boven, twee naast elkaar eronder (%s)' % maat)
            check(not maat['uit'] and maat['schuif'] <= 0, 'D niets steekt uit, de pagina schuift niet opzij')
        ctx.close()
        check(not fouten, 'geen paginafouten (%s)' % fouten[:3])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    server.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
