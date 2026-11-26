# proef345 (26 nov 2026, Marcel): de radio-widget heeft altijd vier knoppen (radio.js), net als elke skin.
#  A. de gewone radio met 1, 3 en 4 zenders: altijd precies 4 voorkeuzeknoppen; knoppen zonder zender zijn uitgeschakeld
#  B. een radio met 6 zenders (van een vriend of van vroeger): er zijn er 4, de knoppen 1-4 werken
#  C. dezelfde radio met een skin: ook vier knoppen, dus gewoon en skin hebben evenveel
#  D. zenders bewerken: na 4 zenders is de radio vol ("4 zenders"); geen paginafouten
# Op de oude versie mislukt A (het aantal knoppen was het aantal zenders) en B (6 knoppen).
# python3 -I proef345.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)
www = tempfile.mkdtemp(prefix='proef345_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
def Z(n): return [{'naam': 'Nep %d' % i, 'url': 'https://z%d.nepradio.nl/s' % i, 'land': 'NL'} for i in range(1, n + 1)]
TEKEN = """async ([zenders, skin]) => {
    document.body.innerHTML = '<div id="w" style="width:340px"></div>'
    await import('./taal.js').catch(() => {})
    const R = await import('./radio.js')
    const cfg = { zenders }; if (skin) cfg.skin = skin
    // de cfg gaat NIET door normaliseer: zo komt ook een oude radio met 6 zenders binnen
    R.tekenRadioWidget(document.getElementById('w'), { cfg, eigen: false })
    await new Promise(r => setTimeout(r, 600))
    const k = [...document.querySelectorAll('#w .rd-preset')]
    return { aantal: k.length, uit: k.filter(b => b.disabled).length }
}"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:300]))
        pg.goto(BASIS + 'manifest.json'); pg.evaluate("localStorage.setItem('fibro_taal', 'nl')")
        for n in (1, 3, 4):
            r = pg.evaluate(TEKEN, [Z(n), None])
            check(r['aantal'] == 4 and r['uit'] == 4 - n, 'A: gewone radio met %d zender(s): 4 knoppen, %d uitgeschakeld (%s)' % (n, 4 - n, r))
        r = pg.evaluate(TEKEN, [Z(6), None])
        check(r['aantal'] == 4, 'B: 6 zenders erin: toch 4 knoppen (%s)' % r)
        r = pg.evaluate(TEKEN, [Z(3), 'neon'])
        check(r['aantal'] == 4 and r['uit'] == 1, 'C: met skin neon en 3 zenders: 4 knoppen, 1 uitgeschakeld (%s)' % r)
        r = pg.evaluate(TEKEN, [Z(4), 'steampunk'])
        check(r['aantal'] == 4 and r['uit'] == 0, 'C: met skin steampunk en 4 zenders: 4 knoppen (%s)' % r)
        # D. de limiet in de code
        gr = pg.evaluate("async () => (await import('./radio.js')).MAX_ZENDERS")
        check(gr == 4, 'D: MAX_ZENDERS = 4 (%s)' % gr)
        b.close()
        check(not fouten, 'D: geen paginafouten %s' % fouten)
except Exception as e:
    check(False, 'proef afgebroken: %s' % str(e).split('\n')[0])
finally:
    srv.terminate()
print('\n%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
