# proef317 (18 nov 2026, Marcel): titel en plaatje vanzelf bij de PeerTube- en de muziek-widget (haalInfo,
# voorbeeldplaatje.js), in de echte app met de echte huisregel van Home. Nagemaakte servers (framatube.org, open.audio)
# geven een titel en een echt PNG-plaatje terug, met CORS zoals PeerTube en Funkwhale dat doen. (Harnas uit proef316.)
#  A. PeerTube: link plakken zonder titel -> Opslaan: titel van de server, miniatuur als achtergrond (vult het vak)
#  B. alleen de API en het voorbeeldplaatje van die ene server; de huisregel houdt niets tegen
#  C. Funkwhale: albumlink -> "Plaat – Artiest" en de albumhoes als achtergrond
#  D. Bandcamp kan niet meer (25 nov 2026): een melding; Bandcamp wordt niets gevraagd; de Funkwhale-hoes blijft
#  E. zelf een titel typen bij dezelfde video: die blijft, niets opnieuw opgehaald, de miniatuur blijft
#  F. de 🖼-knop staat erbij; geen paginafouten
# python3 -I proef317.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, urllib.parse, zlib, struct
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

def png(b, h, kleur):
    rij = b'\x00' + bytes(kleur) * b
    data = zlib.compress(rij * h)
    def stuk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + stuk(b'IHDR', struct.pack('>IIBBBBB', b, h, 8, 2, 0, 0, 0)) + stuk(b'IDAT', data) + stuk(b'IEND', b'')
PREVIEW = png(160, 90, (200, 60, 60))   # 16:9, rood
HOES = png(100, 100, (60, 160, 90))     # vierkant, groen
CORS = {'Access-Control-Allow-Origin': '*'}
KORT = 'kkGMgK9ZtnKfYAgnEtQxbv'

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

www = tempfile.mkdtemp(prefix='proef317_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
BP = '.widget-blok[data-id=peertube]'
BM = '.widget-blok[data-id=muziekwidget]'
def achtergrond(pg, blok):
    return pg.evaluate("s => { const w = document.querySelector(s + ' .widget-inhoud') || document.querySelector(s); return w ? w.style.backgroundImage : '' }", blok)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 1100})
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        buiten = []
        def overig(r):
            buiten.append(r.request.url); r.fulfill(status=204, body='')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), overig)
        def pt_api(r):
            buiten.append(r.request.url)
            r.fulfill(status=200, headers=CORS, content_type='application/json', body=json.dumps({'name': 'Mijn video', 'previewPath': '/lazy-static/previews/p.png', 'thumbnailPath': '/lazy-static/thumbnails/t.png'}))
        def pt_plaatje(r):
            buiten.append(r.request.url); r.fulfill(status=200, headers=CORS, content_type='image/png', body=PREVIEW)
        def fw_api(r):
            buiten.append(r.request.url)
            r.fulfill(status=200, headers=CORS, content_type='application/json', body=json.dumps({'title': 'Plaat', 'artist': {'name': 'Artiest'}, 'cover': {'urls': {'large_square_crop': 'https://open.audio/media/__sized__/hoes.png'}}}))
        def fw_plaatje(r):
            buiten.append(r.request.url); r.fulfill(status=200, headers=CORS, content_type='image/png', body=HOES)
        ctx.route('https://framatube.org/api/v1/videos/**', pt_api)
        ctx.route('https://framatube.org/lazy-static/**', pt_plaatje)
        ctx.route('https://open.audio/api/v1/**', fw_api)
        ctx.route('https://open.audio/media/**', fw_plaatje)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("""uid => {
          localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1')
          localStorage.setItem('fibro_store_' + uid, JSON.stringify(['muziekwidget', 'peertube']))
          localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([
            { id: 'peertube', icon: '🎬', titel: 'PeerTube', w: 4, h: 3, volgorde: 0, aan: true },
            { id: 'muziekwidget', icon: '🎧', titel: 'Funkwhale', w: 4, h: 3, volgorde: 1, aan: true }])) }""", UID)
        RIJEN.update({'peertube', 'muziekwidget'})
        pg.goto(BASIS + 'index.html')
        pg.evaluate("window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.blockedURI + ' ' + e.violatedDirective))")
        check(wacht(pg, "() => !!document.querySelector('%s .pt-kies') && !!document.querySelector('%s .mw-kies')" % (BP, BM), 15000), 'start: beide widgets staan op Home')

        # ── A + B ──
        pg.click(BP + ' .pt-kies')
        pg.fill(BP + ' .pt-link', 'https://framatube.org/w/' + KORT)
        pg.click(BP + ' .pt-opslaan')
        check(wacht(pg, "() => (document.querySelector('%s .pt-speel') && document.querySelector('%s').innerText.includes('Mijn video'))" % (BP, BP), 8000), 'A: de titel komt van de server: "Mijn video"')
        check(wacht(pg, "() => (document.querySelector('%s .widget-inhoud') || {style:{}}).style.backgroundImage.includes('data:image/jpeg')" % BP, 5000), 'A: de miniatuur is de achtergrond van het kaartje')
        pos = json.loads(pg.evaluate("uid => localStorage.getItem('widgetbgpos_widgetbg_peertube_' + uid)", UID) or 'null')
        check(bool(pos) and pos['s'] > 100, 'A: groot genoeg om het vak te vullen (%s)' % pos)
        cfg = json.loads(pg.evaluate("uid => localStorage.getItem('peertube_' + uid)", UID))
        check(cfg.get('titel') == 'Mijn video', 'A: titel bewaard (%s)' % cfg)
        pt = [u for u in buiten if 'framatube' in u]
        check(pt == ['https://framatube.org/api/v1/videos/' + KORT, 'https://framatube.org/lazy-static/previews/p.png'], 'B: alleen de API en het voorbeeldplaatje (%s)' % pt)
        check(pg.locator(BP + ' iframe').count() == 0, 'B: de video zelf is nog niet geladen')
        try: pg.locator(BP).screenshot(path='/tmp/pt-met-plaatje.png')
        except Exception: pass

        # ── C ──
        pg.click(BM + ' .mw-kies')
        pg.fill(BM + ' .mw-invoer', 'https://open.audio/library/albums/16183')
        pg.click(BM + ' .mw-opslaan')
        check(wacht(pg, "() => (document.querySelector('%s .mw-speel') && document.querySelector('%s').innerText.includes('Plaat – Artiest'))" % (BM, BM), 8000), 'C: Funkwhale: "Plaat – Artiest"')
        check(wacht(pg, "() => (document.querySelector('%s .widget-inhoud') || {style:{}}).style.backgroundImage.includes('data:image/jpeg')" % BM, 5000), 'C: de albumhoes is de achtergrond')
        try: pg.locator(BM).screenshot(path='/tmp/fw-met-hoes.png')
        except Exception: pass

        # ── D ──
        n = len(buiten)
        pg.click(BM + ' .mw-wijzig')
        pg.fill(BM + ' .mw-invoer', '<iframe src="https://bandcamp.com/EmbeddedPlayer/album=3656183138/size=large/" seamless><a href="https://x.bandcamp.com/album/y">Zomer &amp; Zee by De Band</a></iframe>')
        pg.click(BM + ' .mw-opslaan')
        check('Bandcamp kan niet' in pg.inner_text(BM + ' .mw-melding'), 'D: Bandcamp kan niet (25 nov 2026): een melding')
        time.sleep(0.4)
        check(not any('bandcamp' in u for u in buiten[n:]), 'D: Bandcamp is niets gevraagd (%s)' % buiten[n:])
        pg.locator(BM + ' button', has_text='Annuleren').click()
        check(wacht(pg, "() => (document.querySelector('%s .widget-inhoud') || {style:{}}).style.backgroundImage.includes('data:image/jpeg')" % BM, 4000), 'D: de Funkwhale-hoes blijft staan')

        # ── E ──
        n = len(buiten)
        pg.click(BP + ' .pt-wijzig')
        pg.fill(BP + ' .pt-titel', 'Eigen titel')
        pg.click(BP + ' .pt-opslaan')
        check(wacht(pg, "() => (document.querySelector('%s .pt-speel') && document.querySelector('%s').innerText.includes('Eigen titel'))" % (BP, BP), 6000), 'E: je eigen titel blijft staan')
        time.sleep(0.4)
        check(not any('framatube' in u for u in buiten[n:]), 'E: niets opnieuw opgehaald (%s)' % buiten[n:])
        check('data:image/jpeg' in achtergrond(pg, BP), 'E: de miniatuur blijft')

        # ── F ──
        check(pg.locator(BP + ' .wbg-knop').count() == 1 and pg.locator(BM + ' .wbg-knop').count() == 1, 'F: de 🖼-knop staat bij allebei (eigen foto kan ook)')
        csp = pg.evaluate('window.__csp')
        check(not csp, 'F: de huisregel hield niets tegen (%s)' % csp)
        check(not fouten, 'F: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
