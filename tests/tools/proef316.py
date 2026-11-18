# proef316 (18 nov 2026, Marcel): de muziek-widget (muziekwidget.js) voor Bandcamp en Funkwhale, in de echte app, met de
# echte huisregel van Home en nagemaakte servers voor bandcamp.com en open.audio. (Harnas uit proef315.)
#  A. Store > Widgets: "Bandcamp & Funkwhale" staat erin; Downloaden = rij in je account en op Home als 4 x 3
#  B. Home: "Nog geen muziek"; een gewone Bandcamp-link geeft uitleg over de insluitcode; de insluitcode werkt
#  C. Kaartje met titel en "van Bandcamp"; nog GEEN verbinding met bandcamp.com
#  D. Luisteren: pas nu de Bandcamp-speler (Stekky-kleuren, album + nummer), afgesloten kader, geen nieuwe vensters
#  E. Wijzigen: een Funkwhale-link (open.audio) -> Luisteren laadt de Funkwhale-speler (album, 330 px hoog)
#  F. een andere Funkwhale-server wordt geweigerd; geen paginafouten
# python3 -I proef316.py <map>
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

www = tempfile.mkdtemp(prefix='proef316_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
NEP = """<!doctype html><html><body style="background:#123;color:#fff">nep-speler
<script>
let open = 'fout'
try { open = window.open('https://example.org/koop') === null ? 'tegengehouden' : 'geopend' } catch (e) { open = 'tegengehouden' }
parent.postMessage({ nep: location.hostname, open }, '*')
</script></body></html>"""
BLOK = '.widget-blok[data-id=muziekwidget]'
CODE = '<iframe style="border: 0; width: 350px; height: 470px;" src="https://bandcamp.com/EmbeddedPlayer/album=3656183138/size=large/bgcol=ffffff/linkcol=0687f5/track=3220102216/transparent=true/" seamless><a href="https://iemand.bandcamp.com/album/plaat">Plaat</a></iframe>'
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        buiten = []
        def overig(r):
            buiten.append(r.request.url); r.fulfill(status=204, body='')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), overig)
        def nep(r):
            buiten.append(r.request.url); r.fulfill(status=200, content_type='text/html', body=NEP)
        ctx.route('https://bandcamp.com/EmbeddedPlayer/**', nep)
        ctx.route('https://open.audio/front/embed.html**', nep)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("uid => localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'mood', icon: '😊', titel: 'Mood', w: 4, h: 1, volgorde: 0, aan: true }]))", UID)
        pg.evaluate("uid => localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1')", UID)  # niet om een naam vragen

        # ── A ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        kaart = '#lijst .item[data-id=muziekwidget]'
        check(wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=muziekwidget]')", 4000), 'A: de muziek-widget staat bij Widgets in de Store')
        check('Bandcamp & Funkwhale' in pg.inner_text(kaart) and 'luisteren' in pg.inner_text(kaart), 'A: naam en uitleg')
        pg.screenshot(path='/tmp/store-muziek.png')
        pg.click(kaart + ' .knop')
        check(wacht(pg, "() => document.querySelector('#lijst .item[data-id=muziekwidget] .knop').textContent.includes('Gedownload')"), 'A: gedownload')
        check('muziekwidget' in RIJEN and pg.evaluate(LAYOUT) == ['mood:4x1', 'muziekwidget:4x3'], 'A: in je account en op Home als 4 x 3 (%s)' % pg.evaluate(LAYOUT))

        # ── B ──
        pg.goto(BASIS + 'index.html')
        check(wacht(pg, "() => { const w = document.querySelector('%s'); return !!w && w.innerText.includes('Nog geen muziek') }" % BLOK.replace("'", "\\'"), 15000), 'B: op Home: "Nog geen muziek"')
        pg.click(BLOK + ' .mw-kies')
        pg.fill(BLOK + ' .mw-invoer', 'https://iemand.bandcamp.com/album/plaat')
        pg.click(BLOK + ' .mw-opslaan')
        check('insluitcode' in pg.inner_text(BLOK + ' .mw-melding'), 'B: gewone Bandcamp-link: uitleg over de insluitcode')
        pg.fill(BLOK + ' .mw-invoer', CODE)
        pg.fill(BLOK + ' .mw-titel', 'Mijn plaat')
        pg.locator(BLOK).screenshot(path='/tmp/home-muziek-invoer.png')
        pg.click(BLOK + ' .mw-opslaan')
        cfg = json.loads(pg.evaluate("uid => localStorage.getItem('muziekwidget_' + uid)", UID) or 'null')
        check(cfg == {'bron': 'bandcamp', 'soort': 'album', 'id': '3656183138', 'nummer': '3220102216', 'titel': 'Mijn plaat'}, 'B: bewaard: %s' % cfg)

        # ── C ──
        wacht(pg, "() => !!document.querySelector('%s .mw-speel')" % BLOK, 4000)
        t = pg.inner_text(BLOK)
        check('Mijn plaat' in t and 'van Bandcamp' in t and 'verbinding met Bandcamp' in t, 'C: kaartje met titel, bron en uitleg')
        pg.locator(BLOK).screenshot(path='/tmp/home-muziek-kaart.png')
        time.sleep(0.5)
        check(not any('bandcamp' in u or 'open.audio' in u for u in buiten), 'C: nog geen verbinding met Bandcamp of Funkwhale (%s)' % [u for u in buiten if 'bandcamp' in u][:2])

        # ── D ──
        pg.evaluate("window.__mw = []; addEventListener('message', e => window.__mw.push(e.data))")
        pg.click(BLOK + ' .mw-speel')
        check(wacht(pg, "() => window.__mw.some(m => m && m.nep === 'bandcamp.com')", 6000), 'D: de Bandcamp-speler is geladen (na de tik)')
        src = pg.get_attribute(BLOK + ' iframe.mw-speler', 'src') or ''
        check(src.startswith('https://bandcamp.com/EmbeddedPlayer/album=3656183138/track=3220102216/') and 'bgcol=1a0a2e' in src, 'D: album + nummer, in Stekky-kleuren')
        check(pg.get_attribute(BLOK + ' iframe', 'sandbox') == 'allow-scripts allow-same-origin', 'D: afgesloten kader')
        nep = [m for m in pg.evaluate('window.__mw') if m and m.get('nep') == 'bandcamp.com'][0]
        check(nep['open'] == 'tegengehouden' and len(ctx.pages) == 1, 'D: de speler kan geen nieuw venster openen (%s)' % nep['open'])
        pg.locator(BLOK).screenshot(path='/tmp/home-muziek-speler.png')
        pg.click(BLOK + ' .mw-stop')
        check(pg.locator(BLOK + ' iframe').count() == 0, 'D: Stoppen: speler weg')

        # ── E ──
        pg.click(BLOK + ' .mw-wijzig')
        pg.fill(BLOK + ' .mw-invoer', 'https://open.audio/library/albums/16183')
        pg.fill(BLOK + ' .mw-titel', '')
        pg.click(BLOK + ' .mw-opslaan')
        wacht(pg, "() => !!document.querySelector('%s .mw-speel')" % BLOK, 4000)
        check('Funkwhale-album' in pg.inner_text(BLOK) and 'van open.audio' in pg.inner_text(BLOK), 'E: Funkwhale-album, van open.audio')
        pg.click(BLOK + ' .mw-speel')
        check(wacht(pg, "() => window.__mw.some(m => m && m.nep === 'open.audio')", 6000), 'E: de Funkwhale-speler is geladen')
        f = pg.locator(BLOK + ' iframe.mw-speler')
        check(f.get_attribute('src') == 'https://open.audio/front/embed.html?&type=album&id=16183' and abs(f.bounding_box()['height'] - 330) < 2, 'E: album-speler, 330 px hoog')

        # ── F ──
        pg.click(BLOK + ' .mw-stop'); pg.click(BLOK + ' .mw-wijzig')
        pg.fill(BLOK + ' .mw-invoer', 'https://ander.pod/library/tracks/1')
        pg.click(BLOK + ' .mw-opslaan')
        check('niet in de lijst' in pg.inner_text(BLOK + ' .mw-melding'), 'F: andere Funkwhale-server geweigerd')
        check(not fouten, 'F: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
