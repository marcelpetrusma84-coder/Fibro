# proef336 (25 nov 2026, Marcel): wat niet commercieel gebruikt mag worden is weg uit de app.
#  A. Store > Widgets: geen Weer (Open-Meteo), de muziek-widget heet Funkwhale (zonder Bandcamp), Koningsjacht zonder "Regicide"
#  B. Home met een oude weer-widget en een oude weer-instelling: de widget staat er niet meer en niemand vraagt Open-Meteo iets
#  C. Profiel > Widgets: geen rij voor Weer; Opslaan haalt de weer-widget uit je Home
#  D. geen paginafouten
# python3 -I proef336.py <map>
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

www = tempfile.mkdtemp(prefix='proef336_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
LAYOUT = "() => JSON.parse(localStorage.getItem('fibro_widgets_profiel_%s') || '[]').map(w => w.id)" % UID
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
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("uid => localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1')", UID)
        # zoals iemand die de weer-widget vóór 25 nov 2026 had
        RIJEN.add('weer')
        pg.evaluate("""uid => { localStorage.setItem('fibro_store_weer', '1')
          localStorage.setItem('weer_' + uid, JSON.stringify({ plaats: { naam: 'Utrecht', lat: 52.09, lon: 5.12 } }))
          localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([
            { id: 'mood', icon: '😊', titel: 'Mood', w: 4, h: 1, volgorde: 0, aan: true },
            { id: 'weer', icon: '🌤️', titel: 'Weer', w: 4, h: 3, volgorde: 1, aan: true }])) }""", UID)

        # ── A ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=muziekwidget]')", 6000)
        check(pg.locator('#lijst .item[data-id=weer]').count() == 0, 'A: geen weer-widget in de Store')
        check('Bandcamp' not in pg.inner_text('#lijst'), 'A: nergens Bandcamp bij de widgets')
        check('Funkwhale' in pg.inner_text('#lijst .item[data-id=muziekwidget]'), 'A: de muziek-widget heet Funkwhale')
        pg.click('#soorten .main-tab[data-soort=game]')
        wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=koningsjacht]')", 6000)
        check(pg.locator('#lijst .item[data-id=koningsjacht]').count() == 1 and 'Regicide' not in pg.inner_text('#lijst .item[data-id=koningsjacht]'), 'A: Koningsjacht staat er, zonder "Regicide" in de tekst')

        # ── B ──
        n = len(buiten)
        pg.goto(BASIS + 'index.html')
        check(wacht(pg, "() => !!document.querySelector('.widget-blok[data-id=mood]')", 15000), 'B: Home is geladen')
        time.sleep(1.5)
        check(pg.locator('.widget-blok[data-id=weer]').count() == 0, 'B: de oude weer-widget staat er niet meer')
        check(not any('open-meteo' in u for u in buiten[n:]), 'B: Open-Meteo is niets gevraagd (%s)' % [u for u in buiten[n:] if 'meteo' in u][:2])

        # ── C ──
        pg.goto(BASIS + 'profiel.html')
        time.sleep(3)
        check(pg.locator('#widgetRij-weer').count() == 0, 'C: geen rij voor Weer bij Profiel > Widgets')
        knop = pg.locator('button', has_text=re.compile('Opslaan'))
        if knop.count():
            knop.first.click(); time.sleep(1.5)
            check('weer' not in pg.evaluate(LAYOUT), 'C: na Opslaan staat Weer niet meer in je Home (%s)' % pg.evaluate(LAYOUT))

        # ── D ──
        check(not any('open-meteo' in u for u in buiten), 'D: nooit verbinding met Open-Meteo')
        check(not fouten, 'D: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
