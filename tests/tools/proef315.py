# proef315 (18 nov 2026, Marcel): de PeerTube-widget in de Stekky Store (store.js STORE_WIDGETS).
#  A. vóór downloaden: Profiel > Widgets toont PeerTube niet
#  B. Store > Widgets: PeerTube staat erin (icoon, naam, uitleg); Downloaden = een rij 'peertube' in store_downloads,
#     melding "staat nu op je beginscherm", en op Home als 4 × 3
#  C. Home (index.html, met de echte huisregel): de widget staat er met "Nog geen video" en "Video kiezen"
#  D. Profiel > Widgets: PeerTube staat er nu, aan
#  E. 🗑 bij Profiel > Widgets = verwijderd: uit je account, schakelaar weg en van Home
#  F. opnieuw downloaden en Verwijderen in de Store: ook weg van Home; geen paginafouten
# python3 -I proef315.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, urllib.parse
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
RIJEN = set()
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/store_downloads' in u:
        if m == 'GET': return route.fulfill(status=200, json=[{'item_id': i} for i in sorted(RIJEN)])
        if m == 'POST': RIJEN.add(json.loads(route.request.post_data or '{}').get('item_id')); return route.fulfill(status=201, body='')
        if m == 'DELETE':
            q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query); RIJEN.discard((q.get('item_id') or ['eq.'])[0][3:])
            return route.fulfill(status=204, body='')
    if '/rest/v1/profiles' in u and m == 'GET':
        rij = {"id": UID, "username": "Marcel", "is_moderator": False}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=rij)
        return route.fulfill(status=200, json=[rij])
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    return route.fulfill(status=200, json=[])

www = tempfile.mkdtemp(prefix='proef315_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
def wacht(pg, js, ms=15000):  # met evaluate: wait_for_function gebruikt eval, en dat houdt de huisregel van Home tegen
    eind = time.time() + ms / 1000
    while time.time() < eind:
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        time.sleep(0.15)
    return False
LAYOUT = "() => JSON.parse(localStorage.getItem('fibro_widgets_profiel_%s') || '[]').filter(w => w.aan).map(w => w.id + ':' + w.w + 'x' + w.h)" % UID
RIJ_ZICHTBAAR = "() => { const r = document.getElementById('widgetRij-peertube'); return !!r && getComputedStyle(r).display !== 'none' }"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        naar_buiten = []
        def buiten(r):
            naar_buiten.append(r.request.url); r.fulfill(status=204, body='')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), buiten)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("uid => localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'mood', icon: '😊', titel: 'Mood', w: 4, h: 1, volgorde: 0, aan: true }]))", UID)

        # ── A ──
        pg.goto(BASIS + 'profiel.html'); wacht(pg, "() => !!document.getElementById('widgetRij-peertube')"); pg.wait_for_timeout(800)
        check(not pg.evaluate(RIJ_ZICHTBAAR), 'A: vóór downloaden staat PeerTube niet bij Profiel > Widgets')

        # ── B ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        kaart = '#lijst .item[data-id="peertube"]'
        check(wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=\"peertube\"]')", 4000), 'B: PeerTube staat bij Widgets in de Store')
        t = pg.inner_text(kaart)
        check('PeerTube' in t and 'afspelen tikt' in t and '🎬' in t and 'binnenkort' not in pg.inner_text('#lijst'), 'B: met icoon, naam en uitleg (%r)' % t[:90])
        pg.screenshot(path='/tmp/store-widget.png')
        pg.click(kaart + ' .knop')
        check(wacht(pg, "() => document.querySelector('#lijst .item[data-id=\"peertube\"] .knop').textContent.includes('Gedownload')"), 'B: gedownload')
        check(RIJEN == {'peertube'}, 'B: een rij in store_downloads (%s)' % RIJEN)
        check('beginscherm' in pg.inner_text('#melding'), 'B: melding (%s)' % pg.inner_text('#melding'))
        check(pg.evaluate(LAYOUT) == ['mood:4x1', 'peertube:4x3'], 'B: op Home als 4 × 3 (%s)' % pg.evaluate(LAYOUT))
        check(pg.locator(kaart + ' .deel-knop').count() == 0, 'B: geen uitnodigingslink (dat is alleen voor games)')
        pg.screenshot(path='/tmp/store-widget-gedownload.png')

        # ── C ──
        pg.goto(BASIS + 'index.html')
        c = wacht(pg, "() => { const w = document.querySelector('.widget-blok[data-id=\"peertube\"]'); return !!w && w.innerText.includes('Nog geen video') && !!w.querySelector('.pt-kies') }", 15000)
        check(c, 'C: op Home staat de widget, met "Nog geen video" en "Video kiezen"')
        check(not any('framatube' in u for u in naar_buiten), 'C: Home maakt geen verbinding met PeerTube')
        try: pg.locator('.widget-blok[data-id="peertube"]').screenshot(path='/tmp/home-peertube.png')
        except Exception: pass

        # ── D ──
        pg.goto(BASIS + 'profiel.html')
        check(wacht(pg, RIJ_ZICHTBAAR, 8000), 'D: na downloaden staat PeerTube bij Profiel > Widgets')
        check(wacht(pg, "() => document.getElementById('widget-peertube').classList.contains('on')", 4000), 'D: en hij staat al aan')

        # ── E ──
        pg.click('#tab-widgets')
        pg.click('#widgetRij-peertube .store-verwijder')
        check(wacht(pg, "() => getComputedStyle(document.getElementById('widgetRij-peertube')).display === 'none'", 5000), 'E: 🗑 = de schakelaar is weg')
        check('peertube' not in RIJEN and pg.evaluate(LAYOUT) == ['mood:4x1'], 'E: uit je account en van Home (%s, %s)' % (RIJEN, pg.evaluate(LAYOUT)))

        # ── F ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=\"peertube\"] .knop')")
        check(pg.inner_text(kaart + ' .knop') == 'Downloaden', 'F: in de Store weer "Downloaden"')
        pg.click(kaart + ' .knop')
        wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=\"peertube\"] .weghalen')")
        pg.click(kaart + ' .weghalen')
        check(wacht(pg, "() => document.querySelector('#lijst .item[data-id=\"peertube\"] .knop').textContent === 'Downloaden'"), 'F: Verwijderen in de Store')
        check('peertube' not in RIJEN and pg.evaluate(LAYOUT) == ['mood:4x1'], 'F: weg uit je account en van Home (%s, %s)' % (RIJEN, pg.evaluate(LAYOUT)))
        check(not fouten, 'F: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
