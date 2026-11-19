# proef320 (19 nov 2026, Marcel): de RSS-widget v2 met plaatjes en samenvatting, in de echte app. (Harnas uit proef319.)
# Nagemaakt: rss-ophalen (koppen + plaatje-adressen; plaatjes als PNG in één effen kleur per bericht).
#  A. 8 berichten met plaatjes: de server krijgt hoogstens 6 plaatje-vragen; bovenaan het grote plaatje (vak 0, juiste
#     kleur), de rest vierkantjes; samenvatting onder de kop; zonder plaatje een letter
#  B. het fotoplaatje staat in widgetbg_rss_<uid> en pos { rss } = fotoId in rss_<uid>; geen 🖼-knop
#  C. ↻ met 1 nieuw bericht: alleen het plaatje van het nieuwe bericht (+ het ene dat vorige keer niet aan de beurt was)
#  D. een fotoplaatje dat niet bij de berichten hoort (andere fotoId) = geen plaatjes (nooit een verkeerd plaatje)
#  E. "Plaatjes tonen" uit: geen plaatje-vragen meer, geen plaatjes, het fotoplaatje is weg
#  F. geen paginafouten, de huisregel hield niets tegen
# python3 -I proef320.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, urllib.parse, zlib, struct
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

def png(kleur, b=200, h=120):
    rij = b'\x00' + bytes(kleur) * b
    data = zlib.compress(rij * h)
    deel = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + deel(b'IHDR', struct.pack('>IIBBBBB', b, h, 8, 2, 0, 0, 0)) + deel(b'IDAT', data) + deel(b'IEND', b'')

CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'}
NU = int(time.time() * 1000)
KLEUREN = [(220, 30, 30), (30, 180, 60), (40, 70, 220), (230, 200, 20), (200, 40, 200), (20, 200, 200), (240, 140, 20), (120, 120, 120)]
BEELD = {}
def bericht(i, plaatje=True):
    b = {'titel': 'Bericht %d' % i, 'link': 'https://nieuws.voorbeeld.nl/artikel/%d' % i, 'datum': NU - i * 600000,
         'tekst': 'Samenvatting van bericht %d.' % i, 'plaatje': '', 'plaatjeGroot': ''}
    if plaatje:
        b['plaatje'] = 'https://img.voorbeeld.nl/k%d.png' % i
        b['plaatjeGroot'] = 'https://img.voorbeeld.nl/g%d.png' % i
        BEELD[b['plaatje']] = png(KLEUREN[i % len(KLEUREN)])
        BEELD[b['plaatjeGroot']] = png(KLEUREN[i % len(KLEUREN)], 480, 240)
    return b
FEEDS = {'https://nieuws.voorbeeld.nl/rss': {'ok': True, 'titel': 'Voorbeeld', 'berichten': [bericht(i, i != 5) for i in range(1, 9)]}}
FUNCTIE = []
PLAATJES = []
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
        body = json.loads(route.request.post_data or '{}')
        if 'plaatje' in body:
            PLAATJES.append(body['plaatje'])
            png = BEELD.get(body['plaatje'])
            if not png: return route.fulfill(status=502, headers=CORS, json={'ok': False, 'reden': 'niet bereikbaar'})
            return route.fulfill(status=200, headers={**CORS, 'Content-Type': 'image/png'}, body=png)
        FUNCTIE.append({'auth': route.request.headers.get('authorization'), 'body': body})
        url = FUNCTIE[-1]['body'].get('url')
        antw = FEEDS.get(url)
        if not antw: return route.fulfill(status=422, headers=CORS, json={'ok': False, 'reden': 'geen feed'})
        return route.fulfill(status=200, headers=CORS, json=antw)
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    return route.fulfill(status=200, json=[])

www = tempfile.mkdtemp(prefix='proef320_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
KLEUR = r"""([sel, x, y]) => new Promise(ok => { const e = document.querySelector(sel); const m = /url\("(data:[^"]+)"\)/.exec(e.style.backgroundImage); if (!m) return ok(null)
  const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 400; const g = c.getContext('2d'); g.drawImage(img, 0, 0); ok(Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3)) }; img.src = m[1] })"""
def lijkt(a, b): return a is not None and all(abs(a[i] - b[i]) < 40 for i in range(3))
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
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("""uid => { localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'rss', icon: '📰', titel: 'RSS-feed', w: 4, h: 3, volgorde: 0, aan: true }]))
          localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1'); localStorage.setItem('fibro_store_' + uid, JSON.stringify(['rss']))
          localStorage.setItem('rss_' + uid, JSON.stringify({ feeds: [{ url: 'https://nieuws.voorbeeld.nl/rss', naam: 'Voorbeeld' }], berichten: [], bijgewerkt: 0 })) }""", UID)
        pg.goto(BASIS + 'index.html')
        pg.evaluate("window.__csp = []; document.addEventListener('securitypolicyviolation', e => __csp.push(e.blockedURI + ' ' + e.violatedDirective))")

        # ── A ──
        check(wacht(pg, "() => document.querySelectorAll('%s .rs-lijst > a').length === 8" % B, 15000), 'A: 8 berichten op de widget')
        check(wacht(pg, "() => !!document.querySelector('%s .rs-groot').style.backgroundImage" % B, 8000), 'A: het bovenste bericht heeft een plaatje')
        check(len(PLAATJES) == 6, 'A: hoogstens 6 plaatjes gevraagd (%d)' % len(PLAATJES))
        check(PLAATJES[0] == 'https://img.voorbeeld.nl/g1.png' and all('/k' in u for u in PLAATJES[1:]), 'A: bovenaan het grote, de rest het kleine (%s)' % PLAATJES[:3])
        kl = pg.evaluate(KLEUR, [B + ' .rs-groot', 240, 120])
        check(lijkt(kl, KLEUREN[1]), 'A: het grote plaatje heeft de kleur van bericht 1 (%s)' % kl)
        fotos = pg.eval_on_selector_all(B + ' .rs-lijst > a', "els => els.map(a => a.querySelector('.rs-foto') ? 'f' : a.querySelector('.rs-letter') ? 'l' : 'g')")
        check(fotos == ['g', 'f', 'f', 'f', 'l', 'f', 'f', 'l'], 'A: vierkantjes voor 2-4, 6 en 7; een letter zonder plaatje (5) of nog niet aan de beurt (8) (%s)' % fotos)
        kl3 = pg.evaluate("""() => new Promise(ok => { const e = document.querySelectorAll('%s .rs-lijst > a')[2].querySelector('.rs-foto'); const m = /url\\("(data:[^"]+)"\\)/.exec(e.style.backgroundImage)
          const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 400; const g = c.getContext('2d'); g.drawImage(img, 0, 0); ok(Array.from(g.getImageData(80 + 40, 240 + 40, 1, 1).data).slice(0, 3)) }; img.src = m[1] })""" % B)
        check(lijkt(kl3, KLEUREN[3]), 'A: het derde vierkantje (vak 2) heeft de kleur van bericht 3 (%s)' % kl3)
        sam = pg.inner_text(B + ' .rs-lijst > a:nth-child(2) .rs-sam')
        check(sam == 'Samenvatting van bericht 2.', 'A: samenvatting onder de kop (%s)' % sam)
        check(pg.text_content(B + ' .rs-groot .rs-label') == 'Voorbeeld', 'A: de naam van de site op het grote plaatje')
        check(not buiten, 'A: de app praat zelf niet met de nieuwssite of de beeldserver (%s)' % buiten[:3])
        pg.locator(B).screenshot(path='/tmp/rss2.png')
        hoog = pg.evaluate("() => [document.querySelector('%s').getBoundingClientRect().height, (l => l.scrollHeight > l.clientHeight)(document.querySelector('%s .rs-lijst'))]" % (B, B))
        check(hoog[0] < 520 and hoog[1], 'A: de widget blijft even groot; de lijst scrolt erbinnen (%s)' % hoog)

        # ── B ──
        cfg = json.loads(pg.evaluate("uid => localStorage.getItem('rss_' + uid)", UID))
        pos = json.loads(pg.evaluate("uid => localStorage.getItem('widgetbgpos_widgetbg_rss_' + uid)", UID) or 'null')
        sprite = pg.evaluate("""uid => new Promise(ok => { const r = indexedDB.open('FibroDB'); r.onsuccess = () => { const g = r.result.transaction('fotos').objectStore('fotos').get('widgetbg_rss_' + uid); g.onsuccess = () => ok(g.result ? g.result.data.slice(0, 23) : null); g.onerror = () => ok(null) } })""", UID)
        check(sprite == 'data:image/jpeg;base64,' and pos and pos.get('rss') == cfg.get('fotoId'), 'B: fotoplaatje bewaard, pos = fotoId (%s, %s)' % (sprite, pos))
        check([x.get('vak') for x in cfg['berichten']] == [0, 1, 2, 3, None, 5, 6, None], 'B: vakken in de berichten (%s)' % [x.get('vak') for x in cfg['berichten']])
        check(pg.locator(B + ' .wbg-knop').count() == 0, 'B: geen 🖼-knop op de RSS-widget')

        # ── C ──
        FEEDS['https://nieuws.voorbeeld.nl/rss']['berichten'].insert(0, bericht(0))
        voor = len(PLAATJES)
        pg.click(B + ' .rs-ververs')
        check(wacht(pg, "() => document.querySelector('%s .rs-groot .rs-kop').textContent === 'Bericht 0'" % B, 8000), 'C: het nieuwe bericht staat bovenaan')
        time.sleep(0.5)
        nieuwP = PLAATJES[voor:]
        check(sorted(nieuwP) == sorted(['https://img.voorbeeld.nl/g0.png', 'https://img.voorbeeld.nl/k8.png']), 'C: alleen nieuwe plaatjes gevraagd (%s)' % nieuwP)
        check(wacht(pg, "() => document.querySelectorAll('%s .rs-foto').length === 7" % B, 5000), 'C: nu 7 vierkantjes (%d)' % pg.locator(B + ' .rs-foto').count())
        kl = pg.evaluate(KLEUR, [B + ' .rs-groot', 240, 120])
        check(lijkt(kl, KLEUREN[0]), 'C: het grote plaatje is van het nieuwe bericht (%s)' % kl)

        # ── D ──
        pg.evaluate("uid => { const c = JSON.parse(localStorage.getItem('rss_' + uid)); c.fotoId = 'anders1'; localStorage.setItem('rss_' + uid, JSON.stringify(c)) }", UID)
        pg.reload()
        check(wacht(pg, "() => document.querySelectorAll('%s .rs-lijst > a').length === 9" % B, 15000), 'D: berichten staan er')
        time.sleep(0.5)
        check(pg.locator(B + ' .rs-foto').count() == 0 and not pg.evaluate("() => document.querySelector('%s .rs-groot').style.backgroundImage" % B), 'D: fotoplaatje hoort er niet bij = geen plaatjes')

        # ── E ──
        voor = len(PLAATJES)
        pg.click(B + ' .rs-wijzig')
        pg.uncheck(B + ' .rs-plaatjes')
        pg.click(B + ' .rs-klaar')
        check(wacht(pg, "() => document.querySelectorAll('%s .rs-lijst > a').length === 9" % B, 8000), 'E: berichten opnieuw opgehaald')
        time.sleep(0.5)
        check(len(PLAATJES) == voor, 'E: geen plaatjes gevraagd')
        check(pg.locator(B + ' .rs-foto').count() == 0 and pg.locator(B + ' .rs-letter').count() == 8, 'E: geen plaatjes, wel letters')
        weg = pg.evaluate("""uid => new Promise(ok => { const r = indexedDB.open('FibroDB'); r.onsuccess = () => { const g = r.result.transaction('fotos').objectStore('fotos').get('widgetbg_rss_' + uid); g.onsuccess = () => ok(!g.result); g.onerror = () => ok(false) } })""", UID)
        check(weg and pg.evaluate("uid => localStorage.getItem('widgetbgpos_widgetbg_rss_' + uid)", UID) is None, 'E: het fotoplaatje is weg')
        pg.locator(B).screenshot(path='/tmp/rss2-uit.png')

        # ── F ──
        check(not pg.evaluate('window.__csp'), 'F: de huisregel hield niets tegen (%s)' % pg.evaluate('window.__csp'))
        check(not fouten, 'F: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
