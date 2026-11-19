# proef321 (19 nov 2026, Marcel): de Mastodon-widget (mastodon.js) in de echte app. (Harnas uit proef320.)
# Nagemaakt: rss-ophalen (zoals versie 3 een Mastodon-feed teruggeeft) en de plaatjes (PNG in één kleur).
#  A. Store > Widgets: Mastodon staat erin; Downloaden = op Home met "Nog geen account"
#  B. een rare naam wordt geweigerd zonder iets te vragen; een onbekend account geeft een melding
#  C. @marcel@mastodon.social: de openbare feed (https://mastodon.social/@marcel.rss) via rss-ophalen; naam,
#     @naam@server en "Volg mij op Mastodon" (nieuw tabblad, zonder referrer)
#  D. een bericht met een waarschuwing: eerst alleen de waarschuwing, de tekst pas na "Toon bericht"
#  E. plaatjes: alleen de profielfoto en de KLEINE versie van het gewone plaatje; nooit van gevoelige berichten;
#     de juiste kleur op de juiste plek
#  F. de app maakt zelf geen verbinding met Mastodon; geen paginafouten of huisregel-meldingen
# python3 -I proef321.py <map>
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
AVATAR = 'https://files.mastodon.social/accounts/avatars/1/original/a.png'
FOTO = 'https://files.mastodon.social/media_attachments/files/1/original/foto.png'
BEELD = {AVATAR: png((220, 30, 30), 120, 120), FOTO.replace('/original/', '/small/'): png((30, 180, 60), 320, 180)}
FEEDS = {'https://mastodon.social/@marcel.rss': {'ok': True, 'titel': 'Marcel 🐘', 'afbeelding': AVATAR, 'link': 'https://mastodon.social/@marcel', 'berichten': [
  {'titel': 'Hallo #stekky!', 'inhoud': 'Hallo #stekky!\n\nTweede alinea', 'link': 'https://mastodon.social/@marcel/1', 'datum': NU - 600000, 'tekst': '', 'plaatje': FOTO, 'plaatjeGroot': FOTO},
  {'titel': 'spoilers film', 'cw': 'spoilers film', 'inhoud': 'De dader is de butler', 'gevoelig': True, 'link': 'https://mastodon.social/@marcel/2', 'datum': NU - 3600000, 'tekst': '', 'plaatje': '', 'plaatjeGroot': ''},
  {'titel': 'Gevoelig', 'inhoud': 'Zonder waarschuwing, wel gevoelig', 'gevoelig': True, 'link': 'https://mastodon.social/@marcel/3', 'datum': NU - 7200000, 'tekst': '', 'plaatje': '', 'plaatjeGroot': ''},
]}}
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

www = tempfile.mkdtemp(prefix='proef321_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
B = '.widget-blok[data-id=mastodon]'
KLEUR = r"""([el, x, y]) => new Promise(ok => { const e = document.querySelector(el); const m = /url\("(data:[^"]+)"\)/.exec(e.style.backgroundImage); if (!m) return ok(null)
  const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 636; const g = c.getContext('2d'); g.drawImage(img, 0, 0); ok(Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3)) }; img.src = m[1] })"""
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
        pg.evaluate("uid => { localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'mood', icon: '😊', titel: 'Mood', w: 4, h: 1, volgorde: 0, aan: true }])); localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1') }", UID)

        # ── A ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=widget]')
        check(wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=mastodon]')", 4000), 'A: Mastodon staat bij Widgets in de Store')
        if not fout:
            pg.click('#lijst .item[data-id=mastodon] .knop')
            check(wacht(pg, "() => document.querySelector('#lijst .item[data-id=mastodon] .knop').textContent.includes('Gedownload')") and pg.evaluate(LAYOUT) == ['mood:4x1', 'mastodon:4x3'], 'A: gedownload en op Home als 4 x 3 (%s)' % pg.evaluate(LAYOUT))
            pg.goto(BASIS + 'index.html')
            pg.evaluate("window.__csp = []; document.addEventListener('securitypolicyviolation', e => __csp.push(e.blockedURI + ' ' + e.violatedDirective))")
            check(wacht(pg, "() => { const w = document.querySelector('%s'); return !!w && w.innerText.includes('Nog geen account') }" % B, 15000), 'A: op Home: "Nog geen account"')

            # ── B ──
            pg.click(B + ' .md-kies')
            pg.fill(B + ' .md-naamveld', 'marcel')
            pg.click(B + ' .md-klaar')
            check('@naam@server' in pg.inner_text(B + ' .md-melding') and not FUNCTIE, 'B: een rare naam wordt geweigerd (zonder iets te vragen)')
            pg.fill(B + ' .md-naamveld', '@onbekend@mastodon.social')
            pg.click(B + ' .md-klaar')
            check(wacht(pg, "() => document.querySelector('%s .md-melding').textContent.includes('niet gevonden')" % B, 5000), 'B: onbekend account = melding')

            # ── C ──
            pg.fill(B + ' .md-naamveld', '@marcel@mastodon.social')
            pg.click(B + ' .md-klaar')
            check(wacht(pg, "() => document.querySelectorAll('%s .md-bericht').length === 3" % B, 10000), 'C: drie berichten op de widget')
            check([f['body'].get('url') for f in FUNCTIE if 'url' in f['body']][-1] == 'https://mastodon.social/@marcel.rss' and all(f['auth'] == 'Bearer x' for f in FUNCTIE), 'C: alleen de openbare feed, via rss-ophalen met de inlogpas')
            check(pg.inner_text(B + ' .md-naam') == 'Marcel 🐘' and pg.inner_text(B + ' .md-handle') == '@marcel@mastodon.social', 'C: naam en @naam@server')
            volg = pg.locator(B + ' .md-volg')
            check(volg.get_attribute('href') == 'https://mastodon.social/@marcel' and volg.get_attribute('target') == '_blank' and volg.get_attribute('rel') == 'noopener noreferrer', 'C: "Volg mij op Mastodon" naar het profiel, nieuw tabblad, zonder referrer')
            tekst1 = pg.inner_text(B + ' .md-bericht:nth-child(1) .md-tekst')
            check(tekst1 == 'Hallo #stekky!\n\nTweede alinea', 'C: de tekst met alinea\'s (%r)' % tekst1)

            # ── D ──
            cw = B + ' .md-bericht:nth-child(2)'
            check('spoilers film' in pg.inner_text(cw + ' .md-cw') and not pg.is_visible(cw + ' .md-tekst'), 'D: eerst alleen de waarschuwing, de tekst verborgen')
            pg.click(cw + ' .md-toon')
            check(pg.is_visible(cw + ' .md-tekst') and pg.inner_text(cw + ' .md-tekst') == 'De dader is de butler', 'D: na "Toon bericht" de tekst')
            check(pg.locator(cw + ' .md-plaatje').count() == 0, 'D: nooit een plaatje bij een waarschuwing')

            # ── E ──
            check(wacht(pg, "() => !!document.querySelector('%s .md-foto').style.backgroundImage" % B, 8000), 'E: de profielfoto staat er')
            check(sorted(PLAATJES) == sorted([AVATAR, FOTO.replace('/original/', '/small/')]), 'E: alleen de profielfoto en de kleine versie gevraagd (%s)' % PLAATJES)
            check(pg.locator(B + ' .md-plaatje').count() == 1 and pg.locator(B + ' .md-bericht:nth-child(1) .md-plaatje').count() == 1, 'E: één plaatje, bij het eerste bericht; niet bij het gevoelige')
            kl = pg.evaluate(KLEUR, [B + ' .md-foto', 48, 48])
            check(lijkt(kl, (220, 30, 30)), 'E: de profielfoto heeft de juiste kleur (%s)' % kl)
            kl = pg.evaluate(KLEUR, [B + ' .md-bericht:nth-child(1) .md-plaatje', 120, 96 + 67])
            check(lijkt(kl, (30, 180, 60)), 'E: het plaatje bij bericht 1 heeft de juiste kleur (%s)' % kl)
            cfg = json.loads(pg.evaluate("uid => localStorage.getItem('mastodon_' + uid)", UID))
            pos = json.loads(pg.evaluate("uid => localStorage.getItem('widgetbgpos_widgetbg_mastodon_' + uid)", UID) or 'null')
            check(cfg['account'] == {'naam': 'marcel', 'server': 'mastodon.social'} and pos and pos.get('mastodon') == cfg.get('fotoId'), 'E: bewaard in mastodon_<uid>, fotoId = pos')
            check(pg.locator(B + ' .wbg-knop').count() == 0, 'E: geen 🖼-knop')
            pg.locator(B).screenshot(path='/tmp/mastodon.png')

            # ── F ──
            voor = len(FUNCTIE)
            pg.reload()
            check(wacht(pg, "() => document.querySelectorAll('%s .md-bericht').length === 3" % B, 15000), 'F: na herladen staan de berichten er')
            time.sleep(1)
            check(len(FUNCTIE) == voor, 'F: vers: niet opnieuw gevraagd')
            check(not buiten, 'F: de app maakt zelf geen verbinding met Mastodon (%s)' % buiten[:3])
            check(not pg.evaluate('window.__csp'), 'F: de huisregel hield niets tegen (%s)' % pg.evaluate('window.__csp'))
            check(not fouten, 'F: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
