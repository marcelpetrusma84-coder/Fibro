# proef322 (19 nov 2026, Marcel): de radio met skins (radio.js v3, radioskins.js, radioskins/*.webp). (Harnas uit proef318.)
#  A. een radio met skin "neon": het plaatje uit de app, het schermpje toont de echte zender; geen verbinding met een zender
#  B. de getekende knoppen 1-4 werken (4 is uit bij 3 zenders); ‹ › zappen rond; de draaiknop draait mee
#  C. ▶: de stream speelt, de knop toont ■, de luidspreker gloeit; ■: stil
#  D. 🎨 Skin: 8 keuzes (Standaard + 7); steampunk kiezen = bewaard en meteen te zien; Zenders bewerken houdt de skin;
#     Standaard = de gewone paarse radio
#  E. alle 11 skins tekenen (19 nov: + draak, candy, onderwater, space) (plaatje geladen, schermpje met tekst, knoppen op hun plek); geen paginafouten of huisregel-meldingen
# python3 -I proef322.py <map>
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
SKINS = ['hout', 'neon', 'scifi', 'natuur', 'graffiti', 'pixel', 'steampunk', 'draak', 'candy', 'onderwater', 'space']
ZENDERS = [{'naam': 'Nep Radio Een', 'url': 'https://een.nepradio.nl/live.mp3', 'land': 'NL'}, {'naam': 'Nep Twee', 'url': 'https://twee.nepradio.nl/aac', 'land': 'BE'},
           {'naam': 'Mijn Zender', 'url': 'https://mijn.nepradio.nl/s', 'land': ''}]
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

www = tempfile.mkdtemp(prefix='proef322_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
def zet(pg, cfg):
    pg.evaluate("([uid, c]) => localStorage.setItem('radio_' + uid, JSON.stringify(c))", [UID, cfg])
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 900}, device_scale_factor=2)
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        buiten = []
        def overig(r):
            buiten.append(r.request.url); r.fulfill(status=204, body='')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), overig)
        def stream(r):
            buiten.append(r.request.url); r.fulfill(status=200, content_type='audio/wav', body=GELUID)
        ctx.route(re.compile(r'^https://(een|twee|mijn)\.nepradio\.nl/.*'), stream)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        pg.evaluate("""uid => { localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'radio', icon: '📻', titel: 'Radio', w: 4, h: 3, volgorde: 0, aan: true }]))
          localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1'); localStorage.setItem('fibro_store_' + uid, JSON.stringify(['radio'])) }""", UID)
        zet(pg, {'zenders': ZENDERS, 'skin': 'neon'})
        pg.goto(BASIS + 'index.html')
        pg.evaluate("window.__csp = []; document.addEventListener('securitypolicyviolation', e => __csp.push(e.blockedURI + ' ' + e.violatedDirective))")

        # ── A ──
        check(wacht(pg, "() => !!document.querySelector('%s .rd-skin')" % B, 15000), 'A: de radio met skin')
        bg = pg.evaluate("() => document.querySelector('%s .rd-skin').style.backgroundImage" % B)
        check('radioskins/neon.webp' in bg, 'A: het neon-plaatje uit de app (%s)' % bg[:80])
        check(wacht(pg, "() => new Promise(ok => { const m = /url\\(\"([^\"]+)\"\\)/.exec(document.querySelector('%s .rd-skin').style.backgroundImage); const i = new Image(); i.onload = () => ok(i.naturalWidth > 500); i.onerror = () => ok(false); i.src = m[1] })" % B, 5000), 'A: het plaatje laadt')
        check(pg.inner_text(B + ' .rd-sscherm .rd-naam') == 'Nep Radio Een' and 'Zender 1 van 3' in pg.inner_text(B + ' .rd-sscherm .rd-sub'), 'A: het schermpje toont de echte zender')
        check(not [u for u in buiten if 'nepradio' in u], 'A: nog geen verbinding met een zender')

        # ── B ──
        presets = B + ' .rd-skin .rd-preset'
        check(pg.locator(presets).count() == 4 and pg.locator(presets + ':disabled').count() == 1, 'B: knoppen 1-4, de 4 is uit (3 zenders)')
        pg.locator(presets).nth(1).click()
        check(pg.inner_text(B + ' .rd-sscherm .rd-naam') == 'Nep Twee' and pg.locator(presets).nth(1).get_attribute('aria-pressed') == 'true', 'B: knop 2 = zender 2, en hij licht op')
        l1 = pg.evaluate("() => document.querySelector('%s .rd-snaald').style.left" % B)
        pg.click(B + ' .rd-skin .rd-volgende')
        pg.click(B + ' .rd-skin .rd-volgende')
        check(pg.inner_text(B + ' .rd-sscherm .rd-naam') == 'Nep Radio Een', 'B: › zapt rond (na 3 weer 1)')
        pg.click(B + ' .rd-skin .rd-vorige')
        check(pg.inner_text(B + ' .rd-sscherm .rd-naam') == 'Mijn Zender', 'B: ‹ terug (van 1 naar 3)')
        l3 = pg.evaluate("() => document.querySelector('%s .rd-snaald').style.left" % B)
        check(l1 != l3, 'B: het naaldje loopt mee (%s → %s)' % (l1, l3))
        pg.click(B + ' .rd-skin .rd-draai')
        tr = pg.evaluate("() => document.querySelector('%s .rd-skin .rd-draai').style.transform" % B)
        check(pg.inner_text(B + ' .rd-sscherm .rd-naam') == 'Nep Radio Een' and 'rotate' in tr, 'B: de draaiknop zapt en draait mee (%s)' % tr)
        check(not [u for u in buiten if 'nepradio' in u], 'B: zappen zonder ▶ = geen verbinding')

        # ── C ──
        pg.click(B + ' .rd-skin .rd-aan')
        check(wacht(pg, "() => document.querySelector('%s .rd-radio').classList.contains('rd-speelt')" % B, 8000), 'C: ▶ = de stream speelt')
        check(pg.get_attribute(B + ' .rd-skin .rd-aan', 'aria-pressed') == 'true' and pg.inner_text(B + ' .rd-skin .rd-aan') == '■', 'C: de knop toont ■')
        pg.locator(B).screenshot(path='/tmp/skin-speelt.png')
        pg.click(B + ' .rd-skin .rd-aan')
        check(pg.locator(B + ' audio').count() == 0, 'C: ■ = stil, de stream is weg')

        # ── D ──
        pg.click(B + ' .rd-skinknop')
        check(pg.locator(B + ' .rd-skinoptie').count() == 12, 'D: 12 keuzes (Standaard + 11 skins)')
        check(pg.get_attribute(B + ' .rd-skinoptie[data-skin=neon]', 'aria-pressed') == 'true', 'D: neon staat aan')
        pg.locator(B).screenshot(path='/tmp/skin-kiezen.png')
        pg.evaluate("s => document.querySelector(s).scrollIntoView({ block: 'center' })", B + ' .rd-skinoptie[data-skin=steampunk]')
        pg.click(B + ' .rd-skinoptie[data-skin=steampunk]')
        check(wacht(pg, "() => (document.querySelector('%s .rd-skin') || {}).style?.backgroundImage?.includes('steampunk')" % B, 5000), 'D: steampunk meteen te zien')
        cfg = json.loads(pg.evaluate("uid => localStorage.getItem('radio_' + uid)", UID))
        check(cfg.get('skin') == 'steampunk' and len(cfg['zenders']) == 3, 'D: bewaard (skin steampunk, zenders blijven)')
        pg.click(B + ' .rd-wijzig')
        pg.click(B + ' .rd-klaar')
        cfg = json.loads(pg.evaluate("uid => localStorage.getItem('radio_' + uid)", UID))
        check(cfg.get('skin') == 'steampunk', 'D: zenders bewerken houdt de skin')
        pg.click(B + ' .rd-skinknop')
        pg.evaluate("s => document.querySelector(s).scrollIntoView({ block: 'center' })", B + ' .rd-skinoptie[data-skin=standaard]')
        pg.click(B + ' .rd-skinoptie[data-skin=standaard]')
        check(wacht(pg, "() => !document.querySelector('%s .rd-skin') && !!document.querySelector('%s .rd-luidspreker')" % (B, B), 5000), 'D: Standaard = de gewone radio')
        cfg = json.loads(pg.evaluate("uid => localStorage.getItem('radio_' + uid)", UID))
        check('skin' not in cfg, 'D: geen skin bewaard')

        # ── E ──
        for sk in SKINS:
            zet(pg, {'zenders': ZENDERS + [{'naam': 'Vier', 'url': 'https://een.nepradio.nl/4', 'land': 'NL'}], 'skin': sk})
            pg.reload()
            ok = wacht(pg, "() => !!document.querySelector('%s .rd-skin') && document.querySelector('%s .rd-sscherm .rd-naam').textContent === 'Nep Radio Een'" % (B, B), 15000)
            laadt = wacht(pg, "() => new Promise(ok => { const i = new Image(); i.onload = () => ok(i.naturalWidth > 300); i.onerror = () => ok(false); i.src = 'radioskins/%s.webp?v=1' })" % sk, 5000)
            time.sleep(0.4)
            pg.locator(B + ' .rd-skin').screenshot(path='/tmp/skin-%s.png' % sk)
            # alle knoppen binnen het plaatje
            binnen = pg.evaluate("""() => { const v = document.querySelector('%s .rd-skin').getBoundingClientRect()
              return [...document.querySelectorAll('%s .rd-skin > *')].every(e => { const r = e.getBoundingClientRect(); return r.left >= v.left - 1 && r.right <= v.right + 1 && r.top >= v.top - 1 && r.bottom <= v.bottom + 1 && r.width > 4 }) }""" % (B, B))
            check(ok and laadt and binnen, 'E: skin %s: plaatje, schermpje en knoppen' % sk)
        check(not pg.evaluate('window.__csp'), 'E: de huisregel hield niets tegen (%s)' % pg.evaluate('window.__csp'))
        check(not fouten, 'E: geen paginafouten %s' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
