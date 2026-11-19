# proef324 (19 nov 2026, Marcel): de weer-widget (weer.js) in de echte app, met de echte huisregel van Home.
# Nagemaakte Open-Meteo (zoeken en weer). Hoeveel data er gaat, telt de proef mee. (Harnas uit proef318.)
#  A. Store > Widgets: Weer staat erin; Downloaden = op Home als 4 x 3, met "Nog geen plaats"
#  B. Plaats kiezen: te kort = melding zonder vraag; "Utrecht" zoekt bij Open-Meteo; de lijst toont de plaatsen
#  C. een plaats kiezen: het weer staat er (temperatuur, plaats, 5 dagen), bewaard in weer_<uid>; samen maar een paar KB
#  D. Home opnieuw openen binnen het half uur: geen nieuwe vraag; ouder dan een half uur: vanzelf nieuw weer
#  E. Open-Meteo kapot: een nette melding, het oude weer blijft staan; ↻ probeert het opnieuw
#  F. zoals bij een vriend (zonder eigen): alleen tonen, geen knoppen, geen vraag aan Open-Meteo; oude dagen vallen weg
#  G. geen paginafouten en de huisregel hield niets tegen
# python3 -I proef324.py <map>
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

def dag(i):
    return time.strftime('%Y-%m-%d', time.localtime(time.time() + i * 86400))
ZOEK = {'results': [
    {'name': 'Utrecht', 'admin1': 'Utrecht', 'country_code': 'NL', 'latitude': 52.09083, 'longitude': 5.12222},
    {'name': 'Utrecht', 'admin1': 'KwaZulu-Natal', 'country_code': 'ZA', 'latitude': -27.65, 'longitude': 30.32},
]}
def weerAntwoord(temp):
    return {'current': {'time': 'x', 'temperature_2m': temp, 'weather_code': 61, 'wind_speed_10m': 18.4, 'is_day': 1},
            'daily': {'time': [dag(i) for i in range(5)], 'weather_code': [61, 3, 2, 0, 95],
                      'temperature_2m_max': [9.2, 8, 7.4, 6, 10], 'temperature_2m_min': [3.1, 2, 1, 0.4, 4],
                      'precipitation_probability_max': [85, 20, 5, 0, 60]}}
STAAT = {'temp': 7.4, 'kapot': False}

www = tempfile.mkdtemp(prefix='proef324_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
B = '.widget-blok[data-id=weer]'
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
        vragen = []; bytes_ = [0]
        def om(r):
            u = r.request.url; vragen.append(u); buiten.append(u)
            if STAAT['kapot']: return r.fulfill(status=503, headers={'Access-Control-Allow-Origin': '*'}, body='')
            body = json.dumps(ZOEK if 'geocoding-api' in u else weerAntwoord(STAAT['temp']))
            bytes_[0] += len(body)
            r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body=body)
        ctx.route(re.compile(r'^https://(api|geocoding-api)\.open-meteo\.com/.*'), om)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("uid => { localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'mood', icon: '😊', titel: 'Mood', w: 4, h: 1, volgorde: 0, aan: true }])); localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1') }", UID)
        def naarHome():
            pg.goto(BASIS + 'index.html')
            pg.evaluate("window.__csp = []; document.addEventListener('securitypolicyviolation', e => __csp.push(e.blockedURI + ' ' + e.violatedDirective))")

        # ── A ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        kaart = '#lijst .item[data-id=weer]'
        check(wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=weer]')", 4000), 'A: Weer staat bij Widgets in de Store')
        check('Open-Meteo' in pg.inner_text(kaart), 'A: de uitleg noemt Open-Meteo')
        pg.click(kaart + ' .knop')
        check(wacht(pg, "() => document.querySelector('#lijst .item[data-id=weer] .knop').textContent.includes('Gedownload')") and pg.evaluate(LAYOUT) == ['mood:4x1', 'weer:4x3'], 'A: gedownload en op Home als 4 x 3 (%s)' % pg.evaluate(LAYOUT))
        naarHome()
        check(wacht(pg, "() => { const w = document.querySelector('%s'); return !!w && w.innerText.includes('Nog geen plaats') }" % B, 15000), 'A: op Home: "Nog geen plaats"')
        check(not vragen, 'A: nog geen vraag aan Open-Meteo')

        # ── B ──
        pg.click(B + ' .wr-kies')
        pg.fill(B + ' .wr-zoekveld', 'U'); pg.click(B + ' .wr-zoek')
        check('2 letters' in pg.inner_text(B + ' .wr-melding') and not vragen, 'B: te kort: melding, geen vraag')
        pg.fill(B + ' .wr-zoekveld', 'Utrecht'); pg.press(B + ' .wr-zoekveld', 'Enter')
        check(wacht(pg, "() => document.querySelectorAll('%s .wr-uitkomst .wr-item').length === 2" % B, 8000), 'B: twee plaatsen gevonden')
        q = urllib.parse.urlparse(vragen[-1]); qs = urllib.parse.parse_qs(q.query)
        check(q.netloc == 'geocoding-api.open-meteo.com' and qs.get('name') == ['Utrecht'], 'B: gezocht bij Open-Meteo (%s)' % vragen[-1][:100])
        items = pg.eval_on_selector_all(B + ' .wr-uitkomst .wr-item', 'els => els.map(e => e.innerText.replace(/\\s+/g, " "))')
        check('🇳🇱 Utrecht' in items[0] and 'KwaZulu-Natal' in items[1], 'B: met vlag en provincie (%s)' % items)
        pg.locator(B).screenshot(path='/tmp/weer-kiezen.png')

        # ── C ──
        pg.locator(B + ' .wr-uitkomst .wr-item').first.click()
        check(wacht(pg, "() => !!document.querySelector('%s .wr-temp')" % B, 8000), 'C: het weer staat er')
        q = urllib.parse.urlparse(vragen[-1]); qs = urllib.parse.parse_qs(q.query)
        check(q.netloc == 'api.open-meteo.com' and qs.get('latitude') == ['52.09'] and qs.get('longitude') == ['5.12'], 'C: het weer gevraagd voor Utrecht (%s)' % vragen[-1][:110])
        check(pg.inner_text(B + ' .wr-temp') == '7°' and 'Utrecht' in pg.inner_text(B + ' .wr-plaats'), 'C: 7° in Utrecht (%s)' % pg.inner_text(B + ' .wr-temp'))
        check('Regen' in pg.inner_text(B + ' .wr-beeld') and 'wind 18 km/u' in pg.inner_text(B + ' .wr-beeld'), 'C: regen en wind (%s)' % pg.inner_text(B + ' .wr-beeld'))
        check(pg.locator(B + ' .wr-dag').count() == 5 and pg.inner_text(B + ' .wr-dag >> nth=0').startswith('Vandaag'), 'C: vijf dagen, de eerste is Vandaag')
        cfg = json.loads(pg.evaluate("uid => localStorage.getItem('weer_' + uid)", UID) or 'null')
        check(cfg and cfg['plaats']['naam'] == 'Utrecht' and len(cfg['dagen']) == 5 and cfg['nu']['temp'] == 7.4, 'C: bewaard in weer_<uid>')
        check(len(json.dumps(cfg)) < 1500, 'C: wat naar vrienden gaat is klein (%d tekens)' % len(json.dumps(cfg)))
        check(bytes_[0] < 5000, 'C: zoeken en weer samen maar %d bytes' % bytes_[0])
        pg.locator(B).screenshot(path='/tmp/weer.png')

        # ── D ──
        voor = len(vragen)
        naarHome()
        check(wacht(pg, "() => !!document.querySelector('%s .wr-temp')" % B, 15000), 'D: Home opnieuw: het weer staat er meteen')
        time.sleep(0.8)
        check(len(vragen) == voor, 'D: binnen het half uur geen nieuwe vraag')
        pg.evaluate("uid => { const k = 'weer_' + uid, c = JSON.parse(localStorage.getItem(k)); c.bijgewerkt = Date.now() - 31 * 60000; localStorage.setItem(k, JSON.stringify(c)) }", UID)
        STAAT['temp'] = 11.2
        naarHome()
        check(wacht(pg, "() => { const t = document.querySelector('%s .wr-temp'); return !!t && t.textContent === '11°' }" % B, 15000), 'D: ouder dan een half uur: vanzelf nieuw weer (11°)')
        check(len(vragen) == voor + 1 and 'api.open-meteo.com' in vragen[-1], 'D: precies één nieuwe vraag')
        check('zojuist' in pg.inner_text(B + ' .wr-uitleg'), 'D: "Bijgewerkt: zojuist"')

        # ── E ──
        STAAT['kapot'] = True
        voor = len(vragen)
        pg.click(B + ' .wr-ververs')
        check(wacht(pg, "() => (document.querySelector('%s .wr-melding') || {}).textContent.includes('lukt nu niet')" % B, 8000), 'E: Open-Meteo kapot: nette melding')
        check(pg.inner_text(B + ' .wr-temp') == '11°' and len(vragen) == voor + 1, 'E: het oude weer blijft staan')
        STAAT['kapot'] = False; STAAT['temp'] = 12.6
        pg.click(B + ' .wr-ververs')
        check(wacht(pg, "() => { const t = document.querySelector('%s .wr-temp'); return !!t && t.textContent === '13°' }" % B, 8000), 'E: ↻ werkt weer (13°)')

        # ── F: zoals bij een vriend ──
        voor = len(vragen)
        oud = dict(cfg); oud['bijgewerkt'] = int(time.time() * 1000) - 2 * 86400000
        oud['dagen'] = [{'datum': dag(i - 2), 'code': 3, 'max': 5, 'min': 1} for i in range(5)]
        n = pg.evaluate("""async c => {
            const W = await import('./weer.js?v=1')
            const vak = document.createElement('div'); vak.id = 'vriendvak'; vak.style.width = '360px'; document.body.appendChild(vak)
            W.tekenWeerWidget(vak, { cfg: c })
            return { knoppen: vak.querySelectorAll('button').length, dagen: [...vak.querySelectorAll('.wr-dag b')].map(b => b.textContent), temp: vak.querySelector('.wr-temp') && vak.querySelector('.wr-temp').textContent, sub: vak.querySelector('.wr-beeld').textContent }
        }""", oud)
        time.sleep(0.5)
        check(n['knoppen'] == 0, 'F: bij een vriend geen knoppen (%s)' % n['knoppen'])
        check(len(n['dagen']) == 3 and n['dagen'][0] == 'Vandaag', 'F: dagen van gisteren en eergisteren vallen weg (%s)' % n['dagen'])
        check(n['temp'] == '5°' and n['sub'].startswith('Vandaag'), 'F: oud "nu" niet als nu getoond, maar vandaag (%s, %s)' % (n['temp'], n['sub']))
        check(len(vragen) == voor, 'F: geen vraag aan Open-Meteo')

        # ── G ──
        check(not pg.evaluate('window.__csp'), 'G: de huisregel hield niets tegen (%s)' % pg.evaluate('window.__csp'))
        check(not [u for u in buiten if 'open-meteo' not in u], 'G: niets anders van buiten (%s)' % [u for u in buiten if 'open-meteo' not in u][:3])
        check(not fouten, 'G: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
