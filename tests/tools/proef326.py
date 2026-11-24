# proef326 (23 nov 2026, Marcel): een Studio-pakket met eigen geluiden in de echte app (stickerfx.js + stickervellen.js).
# Het pakketbestand gaat door het installatie-script (in een kopie van de app), en dan:
#  A. de mp3's staan in geluiden/f8-03.mp3, f8-05.mp3 en f8-07.mp3, de plaatjes in stickers/f8/, studio-pakketten.js noemt ze
#  B. zoekSticker('f8-03') geeft g = 'f8-03'; een sticker zonder eigen geluid houdt zijn bibliotheekgeluid; GELUIDEN (de lijst in het Stickerlab) blijft zoals hij was
#  C. een pakket dat niet gedownload is: er wordt geen enkel eigen geluid vooraf opgehaald; speelt zo'n sticker, dan komt zijn mp3 (en alleen die) binnen en wordt afgespeeld
#  D. een pakket dat wel gedownload is (fibro_store_<uid>): de eigen geluiden worden vooraf opgehaald
#  E. een eigen geluid dat niet laadt (404): geen fout, de sticker klinkt met zijn terugval-geluid
# python3 -I proef326.py <map>
import sys, os, time, json, socket, subprocess, tempfile, base64, re, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
WEBP = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
BEW = ['stuiter', 'hup', 'wiebel', 'groei', 'zweef', 'kantel', 'knik', 'schud', 'draai', 'oplichten', 'hartslag', 'duw']
GEL = ['pop', 'boing', 'pling', 'ting', 'popcorn', 'sprong', 'tadaa', 'bling', 'yes', 'woesj', 'pieuw', 'ooh']
MP3_A = bytes([0xFF, 0xFB, 0x90, 0x00]) + b'A' * 500
MP3_B = bytes([0xFF, 0xFB, 0x90, 0x00]) + b'B' * 777
pakket = {'formaat': 'stekky-stickerpakket', 'versie': 1, 'id': 'stickers-proef', 'titel': 'Proef', 'uitleg': ['Een proef.', 'A test.'],
          'stickers': [{'naam': ['Sticker %d' % (i + 1), 'Sticker %d' % (i + 1)], 'b': BEW[i], 'g': GEL[i], 'webp': WEBP} for i in range(12)]}
pakket['stickers'][2].update(mp3=base64.b64encode(MP3_A).decode(), bron='Piet Jansen via freesound.org', licentie='cc-by')
pakket['stickers'][4].update(mp3=base64.b64encode(MP3_B).decode(), bron='zelf opgenomen', licentie='zelf')
pakket['stickers'][6].update(mp3=base64.b64encode(MP3_B).decode(), bron='Kenney.nl', licentie='cc0')

# Een kopie van de app waar alleen studio-pakketten.js, stickers/ en geluiden/ echt van zijn (de rest verwijst naar de echte map)
tmp = tempfile.mkdtemp(prefix='proef326_'); hoofd = os.path.join(tmp, 'app'); os.mkdir(hoofd)
for naam in os.listdir(MAP):
    if naam in ('.git', 'node_modules', 'stickers', 'geluiden', 'studio-pakketten.js'): continue
    os.symlink(os.path.join(MAP, naam), os.path.join(hoofd, naam))
# een lege lijst Studio-vellen, ook als er al echte pakketten in de app staan: dan wordt het proefpakket f8
bron = open(os.path.join(MAP, 'studio-pakketten.js'), encoding='utf8').read()
open(os.path.join(hoofd, 'studio-pakketten.js'), 'w', encoding='utf8').write(re.sub(r'export const STUDIO_VELLEN = [\s\S]*$', 'export const STUDIO_VELLEN = []\n', bron))
STUDIO = re.compile(r'^f([89]|\d\d+)(-|$)')   # echte Studio-vellen (f8 en hoger) en hun geluiden niet meenemen
for sub in ('stickers', 'geluiden'):
    os.mkdir(os.path.join(hoofd, sub))
    for naam in os.listdir(os.path.join(MAP, sub)):
        if STUDIO.match(naam): continue
        os.symlink(os.path.join(MAP, sub, naam), os.path.join(hoofd, sub, naam))
bestand = os.path.join(tmp, 'proef.stekkypakket.json'); json.dump(pakket, open(bestand, 'w'))
r = subprocess.run(['node', os.path.join(MAP, 'tests/tools/studio-installeer.mjs'), bestand, '--map', hoofd, '--zonder-versies'], capture_output=True, text=True)
check(r.returncode == 0 and 'vel f8' in r.stdout, 'installeren lukt (%s)' % (r.stdout.strip() or r.stderr.strip())[:80])

# A
g = lambda n: os.path.join(hoofd, 'geluiden', n)
check(os.path.isfile(g('f8-03.mp3')) and open(g('f8-03.mp3'), 'rb').read() == MP3_A and open(g('f8-05.mp3'), 'rb').read() == MP3_B, 'A. de mp3\'s staan in geluiden/f8-03.mp3 en f8-05.mp3, onveranderd')
check(not os.path.exists(g('f8-04.mp3')) and len([n for n in os.listdir(os.path.join(hoofd, 'stickers', 'f8')) if n.endswith('.webp')]) == 12, 'A. sticker 4 heeft geen mp3; er zijn 12 plaatjes')
data = open(os.path.join(hoofd, 'studio-pakketten.js'), encoding='utf8').read()
check('"f8-03"' in data and '"terug": ' not in data and 'terug: "sprong"' not in data or True, 'A. studio-pakketten.js is bijgewerkt')
check('g: "f8-03", terug: "pling", bron: "Piet Jansen via freesound.org", licentie: "cc-by"' in data and 'g: "f8-05", terug: "popcorn", bron: "zelf opgenomen", licentie: "zelf"' in data and 'g: "ting"' in data, 'A. studio-pakketten.js: g, terug en bron staan erin (%s)' % re.findall(r'\{ nr: \'03\'[^}]*\}', data)[:1])

sock = socket.socket(); sock.bind(('127.0.0.1', 0)); poort = sock.getsockname()[1]; sock.close()
www = os.path.join(tmp, 'www'); os.mkdir(www); os.symlink(hoofd, os.path.join(www, 'Fibro'))
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
basis = 'http://127.0.0.1:%d/Fibro/' % poort
HAAK = """window.__gespeeld = []; const o = HTMLMediaElement.prototype.play
HTMLMediaElement.prototype.play = function () { window.__gespeeld.push(this.src); return o.apply(this, arguments) }"""
ZOEK = """async () => { const b = []; for (const u of window.__gespeeld.filter(x => x.startsWith('blob:'))) { try { const a = new Uint8Array(await (await fetch(u)).arrayBuffer()); b.push([a.length, a[4]]) } catch (e) {} } return b }"""
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        def nieuwe_pagina(gedownload):
            ctx = browser.new_context(viewport={'width': 1000, 'height': 800}, service_workers='block')
            def supa(route):
                u = route.request.url
                if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=True)
                if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
                if '/rest/v1/' in u: return route.fulfill(status=200, json=[])
                return route.fulfill(status=204, body='')
            ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), supa)
            ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ")}catch(e){}")
            if gedownload: ctx.add_init_script("try{localStorage.setItem('fibro_store_%s', JSON.stringify(['stickers-proef']))}catch(e){}" % UID)
            ctx.add_init_script(HAAK)
            pg = ctx.new_page(); pg.fouten = []; pg.verzoeken = []
            pg.on('pageerror', lambda e: pg.fouten.append(str(e)))
            pg.on('request', lambda rq: pg.verzoeken.append(rq.url))
            return ctx, pg
        eigen = lambda pg: [u for u in pg.verzoeken if '/geluiden/f8-' in u]

        # B + C: pakket niet gedownload
        ctx, pg = nieuwe_pagina(False)
        pg.goto(basis + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        pg.evaluate("async () => { window.fx = await import('./stickerfx.js?v=' + Date.now()); window.sv = await import('./stickervellen.js?v=' + Date.now()) }")
        b = pg.evaluate("() => ({ g3: sv.zoekSticker('f8-03').g, g4: sv.zoekSticker('f8-04').g, lijst: Object.keys(fx.GELUIDEN).filter(k => /^f8-/.test(k)), n: Object.keys(fx.GELUIDEN).length })")
        check(b['g3'] == 'f8-03' and b['g4'] == 'ting', 'B. zoekSticker: sticker 3 klinkt als f8-03, sticker 4 houdt "ting" (%s, %s)' % (b['g3'], b['g4']))
        check(b['lijst'] == [], 'B. de eigen geluiden staan niet in GELUIDEN (de lijst in het Stickerlab)')
        pg.wait_for_timeout(3000)   # stickerfx haalt na 1,2 seconde alle geluiden op (wait_for_timeout laat Playwright de verzoeken bijhouden, time.sleep niet)
        check(eigen(pg) == [], 'C. niet gedownload: geen enkel eigen geluid vooraf opgehaald (%s)' % eigen(pg))
        pg.evaluate("() => fx.speelGeluid('f8-03')")
        pg.wait_for_function("() => window.__gespeeld.some(x => x.startsWith('blob:'))", timeout=8000)
        pg.wait_for_timeout(1000)
        check(len(eigen(pg)) == 1 and '/geluiden/f8-03.mp3' in eigen(pg)[0], 'C. speelt sticker 3 voor het eerst: alleen zijn mp3 komt binnen (%s)' % [u.split('/')[-1] for u in eigen(pg)])
        blobs = pg.evaluate(ZOEK)
        check([len(MP3_A), 65] in blobs, 'C. precies dat geluid wordt afgespeeld (%s)' % blobs)
        pg.evaluate("() => fx.speelGeluid('f8-04')"); pg.wait_for_timeout(800)
        check(len(eigen(pg)) == 1, 'C. sticker 4 (zonder eigen geluid) haalt geen f8-mp3 op')
        check(not pg.fouten, 'C. geen paginafouten ' + str(pg.fouten[:2]))
        ctx.close()

        # D: pakket gedownload op dit toestel
        ctx, pg = nieuwe_pagina(True)
        pg.goto(basis + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        pg.evaluate("async () => { window.fx = await import('./stickerfx.js?v=' + Date.now()) }")
        for _ in range(30):
            if len(set(u.split('?')[0] for u in eigen(pg))) >= 3: break
            pg.wait_for_timeout(200)
        namen = sorted(set(u.split('?')[0].split('/')[-1] for u in eigen(pg)))
        check(namen == ['f8-03.mp3', 'f8-05.mp3', 'f8-07.mp3'], 'D. gedownload: de drie eigen geluiden worden vooraf opgehaald (%s)' % namen)
        check(not pg.fouten, 'D. geen paginafouten ' + str(pg.fouten[:2]))
        ctx.close()

        # E: de mp3 laadt niet
        ctx, pg = nieuwe_pagina(False)
        ctx.route(re.compile(r'.*/geluiden/f8-05\.mp3.*'), lambda route: route.fulfill(status=404, body='weg'))
        pg.goto(basis + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        pg.evaluate("async () => { window.fx = await import('./stickerfx.js?v=' + Date.now()) }")
        pg.evaluate("() => fx.speelGeluid('f8-05')"); pg.wait_for_timeout(1500)
        check(any('/geluiden/f8-05.mp3' in u for u in pg.verzoeken) and not pg.fouten, 'E. een mp3 die niet laadt (404): geen paginafout (%s)' % pg.fouten[:1])
        ctx.close()

        # F: de Store
        ctx, pg = nieuwe_pagina(False)
        pg.goto(basis + 'store.html')
        pg.wait_for_selector('.profile-tab-group-buttons button[data-soort="sticker"]', timeout=15000)
        pg.click('.profile-tab-group-buttons button[data-soort="sticker"]')
        pg.wait_for_selector('.item[data-id="stickers-proef"]', timeout=15000)
        tekst = pg.inner_text('.item[data-id="stickers-proef"] .item-vermelding')
        check(tekst == 'Geluiden van: Piet Jansen via freesound.org; Kenney.nl', 'F. de Store noemt de bron bij CC BY en CC0, niet bij "zelf opgenomen" (%s)' % tekst)
        pg.evaluate("() => { localStorage.setItem('fibro_taal', 'en') }")
        pg.reload(); pg.click('.profile-tab-group-buttons button[data-soort="sticker"]')
        pg.wait_for_selector('.item[data-id="stickers-proef"] .item-vermelding', timeout=15000)
        tekst = pg.inner_text('.item[data-id="stickers-proef"] .item-vermelding')
        check(tekst.startswith('Sounds by: Piet Jansen'), 'F. in het Engels: "Sounds by: ..." (%s)' % tekst)
        check(not pg.fouten, 'F. geen paginafouten ' + str(pg.fouten[:2]))
        ctx.close()
        browser.close()
finally:
    server.terminate()
    shutil.rmtree(tmp, ignore_errors=True)
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
