# proef318 (18 nov 2026, Marcel): de radio-widget (radio.js) in de echte app, met de echte huisregel van Home.
# Nagemaakte servers: Radio Browser (de1/de2/nl1/at1) en twee zenders die een kort WAV-geluid sturen. (Harnas uit proef316.)
#  A. Store > Widgets: Radio staat erin; Downloaden = op Home als 4 x 3, met "Nog geen zender"
#  B. Zenders kiezen: snelknop "Nederland" zoekt bij Radio Browser (countrycode=NL, alleen https); HLS en http vallen weg
#  C. twee zenders vastzetten en een eigen https-link toevoegen (een http-link wordt geweigerd); Klaar = de radio
#  D. vóór ▶: geen verbinding met een zender; het scherm toont zender 1, de uitleg noemt de host
#  E. ▶: pas nu de stream; hij speelt; de profielmuziek krijgt 'fibro-spel-open'
#  F. draaiknop: zender 2 speelt; ■: stil, de stream is weg, 'fibro-spel-dicht'
#  G. (19 nov) pijltjes ‹ ›: zappen rond (na de laatste weer de eerste), zonder ▶ geen verbinding, met ▶ speelt de nieuwe zender;
#     Klaar ✓ staat vast bovenaan in het zenders-scherm, ook als je naar beneden scrolt; geen paginafouten of huisregel-meldingen
# python3 -I proef318.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, urllib.parse, struct, math
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

def wav(sec=2, hz=8000):
    data = b''.join(struct.pack('<h', int(3000 * math.sin(2 * math.pi * 440 * i / hz))) for i in range(int(sec * hz)))
    return b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, hz, hz * 2, 2, 16) + b'data' + struct.pack('<I', len(data)) + data
GELUID = wav()
STATIONS = [
  {'name': 'Nep Radio Een', 'url_resolved': 'https://een.nepradio.nl/live.mp3', 'codec': 'MP3', 'bitrate': 128, 'hls': 0, 'lastcheckok': 1, 'countrycode': 'NL'},
  {'name': 'Nep HLS', 'url_resolved': 'https://hls.nepradio.nl/live.m3u8', 'codec': 'AAC', 'bitrate': 64, 'hls': 1, 'lastcheckok': 1, 'countrycode': 'NL'},
  {'name': 'Nep Twee', 'url_resolved': 'https://twee.nepradio.nl/aac', 'codec': 'AAC', 'bitrate': 96, 'hls': 0, 'lastcheckok': 1, 'countrycode': 'NL'},
  {'name': 'Nep Http', 'url_resolved': 'http://oud.nepradio.nl/live', 'codec': 'MP3', 'bitrate': 128, 'hls': 0, 'lastcheckok': 1, 'countrycode': 'NL'},
]

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

www = tempfile.mkdtemp(prefix='proef318_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
B = '.widget-blok[data-id=radio]'
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 900})
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        buiten = []
        def overig(r):
            buiten.append(r.request.url); r.fulfill(status=204, body='')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), overig)
        zoekvragen = []
        def rb(r):
            zoekvragen.append(r.request.url); buiten.append(r.request.url)
            veel = 'name=veel' in r.request.url  # G: een zoekvraag met veel uitkomsten (zoals echt: tot 40)
            lijst = [{'name': 'Vul %d' % i, 'url_resolved': 'https://vul%d.nepradio.nl/s' % i, 'codec': 'MP3', 'bitrate': 128, 'hls': 0, 'lastcheckok': 1, 'countrycode': 'NL'} for i in range(25)] if veel else STATIONS
            r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body=json.dumps(lijst))
        ctx.route(re.compile(r'^https://(de1|de2|nl1|at1)\.api\.radio-browser\.info/.*'), rb)
        def stream(r):
            buiten.append(r.request.url); r.fulfill(status=200, content_type='audio/wav', body=GELUID)
        ctx.route(re.compile(r'^https://(een|twee|mijn)\.nepradio\.nl/.*'), stream)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("uid => { localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'mood', icon: '😊', titel: 'Mood', w: 4, h: 1, volgorde: 0, aan: true }])); localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1') }", UID)

        # ── A ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        kaart = '#lijst .item[data-id=radio]'
        check(wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=radio]')", 4000), 'A: Radio staat bij Widgets in de Store')
        pg.click(kaart + ' .knop')
        check(wacht(pg, "() => document.querySelector('#lijst .item[data-id=radio] .knop').textContent.includes('Gedownload')") and pg.evaluate(LAYOUT) == ['mood:4x1', 'radio:4x3'], 'A: gedownload en op Home als 4 x 3 (%s)' % pg.evaluate(LAYOUT))
        pg.goto(BASIS + 'index.html')
        pg.evaluate("window.__ev = []; window.__csp = []; addEventListener('fibro-spel-open', () => __ev.push('open')); addEventListener('fibro-spel-dicht', () => __ev.push('dicht')); document.addEventListener('securitypolicyviolation', e => __csp.push(e.blockedURI + ' ' + e.violatedDirective))")
        check(wacht(pg, "() => { const w = document.querySelector('%s'); return !!w && w.innerText.includes('Nog geen zender') }" % B, 15000), 'A: op Home: "Nog geen zender"')

        # ── B ──
        pg.click(B + ' .rd-kies')
        pg.locator(B + ' .rd-snel').first.click()
        check(wacht(pg, "() => document.querySelectorAll('%s .rd-uitkomst .rd-item').length > 0" % B, 8000), 'B: zoekresultaten')
        q = urllib.parse.urlparse(zoekvragen[-1]); qs = urllib.parse.parse_qs(q.query)
        check(qs.get('countrycode') == ['NL'] and qs.get('is_https') == ['true'] and q.path == '/json/stations/search', 'B: gezocht bij Radio Browser op NL, alleen https (%s)' % zoekvragen[-1][:110])
        namen = pg.eval_on_selector_all(B + ' .rd-uitkomst .rd-item .rd-in', 'els => els.map(e => e.textContent)')
        check(namen == ['🇳🇱 Nep Radio Een', '🇳🇱 Nep Twee'], 'B: HLS en http vallen weg (%s)' % namen)

        # ── C ──
        pg.locator(B + ' .rd-uitkomst .rd-pin').nth(0).click()
        pg.locator(B + ' .rd-uitkomst .rd-pin').nth(1).click()
        pg.fill(B + ' .rd-link', 'http://mijn.nepradio.nl/live')
        pg.fill(B + ' .rd-linknaam', 'Mijn zender')
        pg.click(B + ' .rd-erbij')
        check('https' in pg.inner_text(B + ' .rd-melding'), 'C: een http-link wordt geweigerd')
        pg.fill(B + ' .rd-link', 'https://mijn.nepradio.nl/live')
        pg.click(B + ' .rd-erbij')
        check('Jouw zenders (3/4)' in pg.inner_text(B), 'C: drie zenders op de radio')
        pg.locator(B).screenshot(path='/tmp/radio-bewerk.png')
        boven = pg.evaluate("() => { const r = document.querySelector('%s .rd-radio'), k = r.querySelector('.rd-klaar'), u = r.querySelector('.rd-uitkomst'); return k.getBoundingClientRect().top < u.getBoundingClientRect().top }" % B)
        check(boven, 'G: Klaar ✓ staat boven de zoekresultaten')
        pg.fill(B + ' .rd-zoekveld', 'veel'); pg.click(B + ' .rd-zoek')
        check(wacht(pg, "() => document.querySelectorAll('%s .rd-uitkomst .rd-item').length === 25" % B, 8000), 'G: 25 zoekresultaten')
        hoog = pg.evaluate("() => document.querySelector('%s').getBoundingClientRect().height" % B)
        check(hoog < 560, 'G: de widget groeit niet eindeloos mee met de resultaten (%d px)' % hoog)
        vast = pg.evaluate("() => { const r = document.querySelector('%s .rd-radio'); r.scrollTop = r.scrollHeight; const a = r.getBoundingClientRect(), k = r.querySelector('.rd-klaar').getBoundingClientRect(); return [Math.round(k.top - a.top), Math.round(a.bottom - k.bottom), r.scrollTop > 0] }" % B)
        check(vast[2] and 0 <= vast[0] <= 30, 'G: na scrollen staat Klaar ✓ nog bovenaan in beeld (%s)' % vast)
        pg.locator(B).screenshot(path='/tmp/radio-bewerk-gescrold.png')
        pg.click(B + ' .rd-klaar')
        cfg = json.loads(pg.evaluate("uid => localStorage.getItem('radio_' + uid)", UID) or 'null')
        check(cfg and [z['naam'] for z in cfg['zenders']] == ['Nep Radio Een', 'Nep Twee', 'Mijn zender'], 'C: bewaard (%s)' % cfg)

        # ── D ──
        check(wacht(pg, "() => !!document.querySelector('%s .rd-aan')" % B, 5000), 'D: de radio staat er')
        check(pg.inner_text(B + ' .rd-naam') == 'Nep Radio Een' and 'een.nepradio.nl' in pg.inner_text(B + ' .rd-uitleg'), 'D: zender 1 op het scherm, uitleg noemt de host')
        time.sleep(0.5)
        check(not any('nepradio' in u for u in buiten), 'D: nog geen verbinding met een zender')
        pg.locator(B).screenshot(path='/tmp/radio.png')

        # ── E ──
        pg.click(B + ' .rd-aan')
        check(wacht(pg, "() => { const a = document.querySelector('%s audio'); return !!a && !a.paused && a.currentTime > 0 }" % B, 8000), 'E: de stream speelt')
        check(pg.get_attribute(B + ' audio', 'src') == 'https://een.nepradio.nl/live.mp3', 'E: de goede stream')
        check([u for u in buiten if 'nepradio' in u][:1] == ['https://een.nepradio.nl/live.mp3'], 'E: pas nu verbinding met de zender')
        check(pg.evaluate('window.__ev') == ['open'], 'E: profielmuziek stil (fibro-spel-open)')
        check(pg.inner_text(B + ' .rd-aan') == '■', 'E: de knop wordt ■')
        pg.locator(B).screenshot(path='/tmp/radio-aan.png')

        # ── F ──
        pg.click(B + ' .rd-draai')
        check(wacht(pg, "() => { const a = document.querySelector('%s audio'); return !!a && a.src.includes('twee.nepradio.nl') && !a.paused }" % B, 8000), 'F: draaiknop: zender 2 speelt')
        check(pg.inner_text(B + ' .rd-naam') == 'Nep Twee', 'F: het scherm toont zender 2')
        pg.click(B + ' .rd-aan')
        check(pg.locator(B + ' audio').count() == 0 and pg.inner_text(B + ' .rd-aan') == '▶', 'F: ■ = stil, de stream is weg')
        check(pg.evaluate('window.__ev') == ['open', 'dicht'], 'F: profielmuziek mag weer (fibro-spel-dicht) (%s)' % pg.evaluate('window.__ev'))

        # ── G ──
        naam = lambda: pg.inner_text(B + ' .rd-naam')
        check(pg.get_attribute(B + ' .rd-vorige', 'aria-label') == 'Vorige zender' and pg.get_attribute(B + ' .rd-volgende', 'aria-label') == 'Volgende zender', 'G: pijltjes ‹ › naast het schermpje')
        streams = lambda: len([u for u in buiten if 'nepradio' in u])
        voor = streams()
        pg.click(B + ' .rd-volgende')
        check(naam() == 'Mijn zender' and 'Zender 3 van 3' in pg.inner_text(B + ' .rd-sub'), 'G: › = zender 3 (%s)' % naam())
        pg.click(B + ' .rd-volgende')
        check(naam() == 'Nep Radio Een', 'G: › na de laatste = weer de eerste (%s)' % naam())
        pg.click(B + ' .rd-vorige')
        check(naam() == 'Mijn zender', 'G: ‹ vóór de eerste = de laatste (%s)' % naam())
        check(pg.get_attribute(B + ' .rd-preset:nth-child(3)', 'aria-pressed') == 'true', 'G: voorkeuzeknop 3 zit ingedrukt')
        time.sleep(0.3)
        check(streams() == voor and pg.locator(B + ' audio').count() == 0, 'G: zappen zonder ▶ maakt geen verbinding')
        pg.click(B + ' .rd-aan')
        check(wacht(pg, "() => { const a = document.querySelector('%s audio'); return !!a && a.src.includes('mijn.nepradio.nl') && !a.paused }" % B, 8000), 'G: ▶ speelt zender 3')
        pg.click(B + ' .rd-vorige')
        check(wacht(pg, "() => { const a = document.querySelector('%s audio'); return !!a && a.src.includes('twee.nepradio.nl') && !a.paused && a.currentTime > 0 }" % B, 8000) and naam() == 'Nep Twee', 'G: ‹ tijdens het spelen: zender 2 speelt meteen')
        check(pg.locator(B + ' audio').count() == 1, 'G: maar één stream tegelijk')
        pg.locator(B).screenshot(path='/tmp/radio-zappen.png')
        pg.click(B + ' .rd-aan')
        check(pg.locator(B + ' audio').count() == 0 and pg.evaluate('window.__ev') == ['open', 'dicht', 'open', 'dicht'], 'G: ■ = stil (%s)' % pg.evaluate('window.__ev'))
        check(not pg.evaluate('window.__csp'), 'G: de huisregel hield niets tegen (%s)' % pg.evaluate('window.__csp'))
        check(not fouten, 'G: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
