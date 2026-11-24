# proef330 (24 nov 2026, Marcel): het eerste stickerpakket uit Stekky Studio ("Santa", vel f8) staat in de Store.
#  A. Store > Stickers: "Santa" staat erin, met de Nederlandse uitleg
#  B. alle twaalf plaatjes van stickers/f8/ laden echt (geen kapotte plaatjes)
#  C. downloaden: de knop zegt Gedownload, en zoekSticker kent f8-01 t/m f8-12 met hun Nederlandse naam
#  D. geen paginafouten
# python3 -I proef330.py <map>
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

def wacht(pg, js, ms=6000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False

NAMEN = ['Kerstman', 'Open haard', 'Cadeautjes', 'Sneeuwbol', 'Kerstboom', 'Peperkoekmannetje', 'Kerstkrans', 'Arrenslee', 'Zuurstok', 'Kerstklokken', 'Kerstsok', 'Roodborstje']
www = tempfile.mkdtemp(prefix='proef330_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), supa)
        pg = ctx.new_page(); fouten = []
        pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)

        # A
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=sticker]')
        ITEM = '#lijst .item[data-id="stickers-santa"]'
        check(wacht(pg, "() => !!document.querySelector('%s')" % ITEM), 'A: Santa staat bij Stickers in de Store')
        if not fout:
            tekst = pg.inner_text(ITEM)
            check('Santa' in tekst and 'Twaalf stickers' in tekst, 'A: met titel en Nederlandse uitleg (%s)' % tekst.replace('\n', ' ')[:80])

            # B
            ok = wacht(pg, """() => { const l = [...document.querySelectorAll('img')].filter(i => /stickers\\/f8\\//.test(i.src));
                                       return l.length >= 1 && l.every(i => i.complete && i.naturalWidth > 0) }""", 10000)
            n = pg.evaluate("() => [...document.querySelectorAll('img')].filter(i => /stickers\\/f8\\//.test(i.src)).length")
            check(ok, 'B: de Santa-plaatjes in de Store laden (%s plaatjes)' % n)
            geladen = pg.evaluate("""async () => { const r = []; for (let i = 1; i <= 12; i++) {
                const nr = String(i).padStart(2, '0'); const res = await fetch('stickers/f8/' + nr + '.webp'); r.push(res.ok && (await res.blob()).size > 1000) } return r }""")
            check(all(geladen), 'B: alle twaalf plaatjes stickers/f8/01 t/m 12.webp bestaan (%s)' % geladen)

            # C
            pg.click(ITEM + ' .knop')
            check(wacht(pg, "() => document.querySelector('%s .knop').textContent.includes('Gedownload')" % ITEM), 'C: na downloaden zegt de knop Gedownload')
            namen = pg.evaluate("""async () => { const v = await import('./stickervellen.js?v=' + Date.now());
                return Array.from({ length: 12 }, (_, i) => { const s = v.zoekSticker('f8-' + String(i + 1).padStart(2, '0')); return s ? s.naam[0] : null }) }""")
            check(namen == NAMEN, 'C: zoekSticker kent alle twaalf Santa-stickers met hun naam (%s)' % namen)
        check(not fouten, 'D: geen paginafouten (%s)' % fouten[:2])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    server.terminate()
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
