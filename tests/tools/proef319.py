# proef319 (19 nov 2026, Marcel): de RSS-widget (rsswidget.js) in de echte app, met de echte huisregel van Home.
# Nagemaakt: de edge function rss-ophalen (geeft koppen als tekst) en de nieuwssite. (Harnas uit proef318.)
#  A. Store > Widgets: RSS-feed staat erin; Downloaden = op Home als 4 x 3, met "Nog geen feed"
#  B. Feed kiezen: een http-link wordt geweigerd; een link die geen feed is ook (de server zegt "geen feed")
#  C. een eigen feed toevoegen (naam komt van de server) en het voorbeeld NOS; de vraag gaat met de inlogpas naar
#     rss-ophalen, de link staat in de vraag; de app praat zelf niet met de nieuwssite
#  D. Klaar: de koppen staan er meteen (nieuwste eerst, met naam van de feed), bewaard in rss_<uid>
#  E. een tik op een kop opent het artikel in een nieuw tabblad, zonder referrer
#  F. ↻ haalt opnieuw op; na herladen komen de koppen uit het geheugen (vers: niet opnieuw gevraagd);
#     geen paginafouten of huisregel-meldingen
# python3 -I proef319.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, urllib.parse
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'}
NU = int(time.time() * 1000)
FEEDS = {
  'https://mijn.nepnieuws.nl/rss': {'ok': True, 'titel': 'Nepnieuws', 'berichten': [
    {'titel': 'Oud bericht van Nepnieuws', 'link': 'https://mijn.nepnieuws.nl/artikel/oud', 'datum': NU - 5 * 3600000},
    {'titel': 'Vers bericht van Nepnieuws', 'link': 'https://mijn.nepnieuws.nl/artikel/vers', 'datum': NU - 10 * 60000}]},
  'https://feeds.nos.nl/nosnieuwsalgemeen': {'ok': True, 'titel': 'NOS Nieuws', 'berichten': [
    {'titel': 'NOS: middelste bericht', 'link': 'https://nos.nl/artikel/1', 'datum': NU - 2 * 3600000}]},
}
FUNCTIE = []
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
    if '/functions/v1/rss-ophalen' in u:
        if m == 'OPTIONS': return route.fulfill(status=200, headers=CORS, body='ok')
        FUNCTIE.append({'auth': route.request.headers.get('authorization'), 'body': json.loads(route.request.post_data or '{}')})
        url = FUNCTIE[-1]['body'].get('url')
        antw = FEEDS.get(url)
        if not antw: return route.fulfill(status=422, headers=CORS, json={'ok': False, 'reden': 'geen feed'})
        return route.fulfill(status=200, headers=CORS, json=antw)
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    return route.fulfill(status=200, json=[])

www = tempfile.mkdtemp(prefix='proef319_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
B = '.widget-blok[data-id=rss]'
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 900})
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        buiten = []
        def overig(r):
            buiten.append(r.request.url); r.fulfill(status=204, body='')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), overig)
        artikel = []
        def site(r):
            artikel.append((r.request.url, r.request.headers.get('referer'))); buiten.append(r.request.url)
            r.fulfill(status=200, content_type='text/html', body='<title>artikel</title>artikel')
        ctx.route(re.compile(r'^https://mijn\.nepnieuws\.nl/artikel/.*'), site)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("uid => { localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'mood', icon: '😊', titel: 'Mood', w: 4, h: 1, volgorde: 0, aan: true }])); localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1') }", UID)

        # ── A ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        kaart = '#lijst .item[data-id=rss]'
        check(wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=rss]')", 4000), 'A: RSS-feed staat bij Widgets in de Store')
        if not fout:
            pg.click(kaart + ' .knop')
            check(wacht(pg, "() => document.querySelector('#lijst .item[data-id=rss] .knop').textContent.includes('Gedownload')") and pg.evaluate(LAYOUT) == ['mood:4x1', 'rss:4x3'], 'A: gedownload en op Home als 4 x 3 (%s)' % pg.evaluate(LAYOUT))
            pg.goto(BASIS + 'index.html')
            pg.evaluate("window.__csp = []; document.addEventListener('securitypolicyviolation', e => __csp.push(e.blockedURI + ' ' + e.violatedDirective))")
            check(wacht(pg, "() => { const w = document.querySelector('%s'); return !!w && w.innerText.includes('Nog geen feed') }" % B, 15000), 'A: op Home: "Nog geen feed"')

            # ── B ──
            pg.click(B + ' .rs-kies')
            pg.fill(B + ' .rs-link', 'http://mijn.nepnieuws.nl/rss')
            pg.click(B + ' .rs-erbij')
            check('https' in pg.inner_text(B + ' .rs-melding') and not FUNCTIE, 'B: een http-link wordt geweigerd (zonder iets te vragen)')
            pg.fill(B + ' .rs-link', 'https://mijn.nepnieuws.nl/geen-feed')
            pg.click(B + ' .rs-erbij')
            check(wacht(pg, "() => document.querySelector('%s .rs-melding').textContent.includes('geen RSS-feed')" % B, 5000), 'B: geen feed = melding')

            # ── C ──
            pg.fill(B + ' .rs-link', 'https://mijn.nepnieuws.nl/rss')
            pg.click(B + ' .rs-erbij')
            check(wacht(pg, "() => document.querySelector('%s').innerText.includes('Jouw feeds (1/3)')" % B, 5000), 'C: eigen feed toegevoegd')
            check('Nepnieuws' in pg.inner_text(B + ' .rs-item'), 'C: de naam komt van de server')
            pg.locator(B + ' .rs-voorbeeld', has_text='NOS Nieuws').click()
            check(wacht(pg, "() => document.querySelector('%s').innerText.includes('Jouw feeds (2/3)')" % B, 5000), 'C: voorbeeld NOS toegevoegd')
            check(all(f['auth'] == 'Bearer x' for f in FUNCTIE) and FUNCTIE[-1]['body'] == {'url': 'https://feeds.nos.nl/nosnieuwsalgemeen'}, 'C: met de inlogpas naar rss-ophalen, de link in de vraag (%s)' % FUNCTIE[-1:])
            check(not buiten, 'C: de app praat zelf niet met de nieuwssite (%s)' % buiten[:3])
            pg.locator(B).screenshot(path='/tmp/rss-bewerk.png')

            # ── D ──
            voor = len(FUNCTIE)
            pg.click(B + ' .rs-klaar')
            check(wacht(pg, "() => document.querySelectorAll('%s .rs-lijst > a').length === 3" % B, 8000), 'D: drie koppen op de widget')
            koppen = pg.eval_on_selector_all(B + ' .rs-lijst > a .rs-kop', 'els => els.map(e => e.textContent)')
            check(koppen == ['Vers bericht van Nepnieuws', 'NOS: middelste bericht', 'Oud bericht van Nepnieuws'], 'D: nieuwste eerst (%s)' % koppen)
            sub = pg.inner_text(B + ' .rs-lijst > a .rs-sub')
            check(sub.startswith('Nepnieuws') and '10 min geleden' in sub, 'D: naam van de feed en hoe oud (%s)' % sub)
            check(len(FUNCTIE) - voor == 2, 'D: elke feed één keer gevraagd')
            cfg = json.loads(pg.evaluate("uid => localStorage.getItem('rss_' + uid)", UID) or 'null')
            check(cfg and [f['url'] for f in cfg['feeds']] == ['https://mijn.nepnieuws.nl/rss', 'https://feeds.nos.nl/nosnieuwsalgemeen'] and len(cfg['berichten']) == 3 and cfg['bijgewerkt'] > 0, 'D: bewaard in rss_<uid>')
            pg.locator(B).screenshot(path='/tmp/rss.png')

            # ── E ──
            a = pg.locator(B + ' .rs-lijst > a').first
            check(a.get_attribute('target') == '_blank' and a.get_attribute('rel') == 'noopener noreferrer', 'E: nieuw tabblad, noopener noreferrer')
            with ctx.expect_page() as nieuw:
                a.click()
            np = nieuw.value; np.wait_for_load_state()
            check(np.url == 'https://mijn.nepnieuws.nl/artikel/vers', 'E: het artikel opent (%s)' % np.url)
            check(artikel and artikel[-1][1] is None, 'E: zonder referrer (%s)' % artikel[-1:])
            np.close()

            # ── F ──
            voor = len(FUNCTIE)
            pg.click(B + ' .rs-ververs')
            check(wacht(pg, "() => true") and wacht(pg, "() => document.querySelectorAll('%s .rs-lijst > a').length === 3" % B, 5000) and len(FUNCTIE) - voor == 2, 'F: ↻ haalt opnieuw op')
            time.sleep(0.5)
            voor = len(FUNCTIE)
            pg.reload()
            pg.evaluate("window.__csp = []; document.addEventListener('securitypolicyviolation', e => __csp.push(e.blockedURI + ' ' + e.violatedDirective))")
            check(wacht(pg, "() => document.querySelectorAll('%s .rs-lijst > a').length === 3" % B, 15000), 'F: na herladen staan de koppen er')
            time.sleep(1)
            check(len(FUNCTIE) == voor, 'F: vers: niet opnieuw gevraagd')
            check(not pg.evaluate('window.__csp'), 'F: de huisregel hield niets tegen (%s)' % pg.evaluate('window.__csp'))
            check(not fouten, 'F: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
