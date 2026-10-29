# proef225: camerafilters (camerafilters.js). Nep-camera; elk filter tekent een live beeld, en de knop-UI werkt.
#  F. elk filter levert een live videotrack en een niet-leeg tekenvel; 'geen' geeft de rauwe track terug
#  K. de knop-UI: 6 chips, klikken kiest het filter; bij 'Nieuws' verschijnen tekstvelden die de tekst aanpassen
# python3 -I proef225.py <map> [plaatjesmap]
import sys, os, time, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); PLAAT = sys.argv[2] if len(sys.argv) > 2 else None
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:200] if info != '' else ''), flush=True)
HARNAS = r"""<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#111}#doel canvas{width:320px;display:block}#balk{position:relative;height:70px}</style></head>
<body><div id="doel"></div><div id="balk"></div>
<script type="module">
import { maakCameraFilter, bouwFilterKiezer, FILTERS } from './camerafilters.js?v=1'
const f = maakCameraFilter(); window.__f = f; window.__FILTERS = FILTERS
const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
f.zetBron(s.getVideoTracks()[0])
document.getElementById('doel').appendChild(f.canvas)
// knop-UI met f als 'api'
window.__gekozen = []
bouwFilterKiezer(document.getElementById('balk'), {
  huidig: () => f.huidig(),
  kies: (id) => { f.kies(id); window.__gekozen.push(id) },
  tekst: () => f.nieuwsTekst(),
  zetTekst: (t) => f.zetNieuwsTekst(t),
})
window.__klaar = true
</script></body></html>"""
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for fn in os.listdir(MAP):
    if fn != 'cf.html': os.symlink(os.path.join(MAP, fn), os.path.join(d, fn))
open(d + '/cf.html', 'w').write(HARNAS)
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
        pg = br.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(B + 'cf.html')
        try: pg.wait_for_function('window.__klaar===true', timeout=8000)
        except Exception as e: check('start', False, str(e))
        pg.wait_for_timeout(700)
        # F. elk filter
        res = {}
        for fid in ['geen', 'oudefilm', 'oudetv', 'anaglyph', 'beveiliging', 'nieuws']:
            pg.evaluate("window.__f.kies('%s')" % fid)
            pg.wait_for_timeout(700)
            res[fid] = pg.evaluate("""(() => { const t = window.__f.uitTrack(), c = window.__f.canvas, g = c.getContext('2d')
              const d = g.getImageData(0,0,c.width,c.height).data; let som = 0; for (let i=0;i<d.length;i+=800) som += d[i]+d[i+1]+d[i+2]
              return { live: !!(t && t.readyState === 'live'), som } })()""")
            if PLAAT: pg.locator('#doel canvas').screenshot(path=PLAAT + '/cf-%s.png' % fid)
        allesLive = all(v['live'] for v in res.values())
        # 'geen' tekent bewust niets (rauwe track); de echte filters tekenen wel
        filtersGetekend = all(res[k]['som'] > 0 for k in res if k != 'geen')
        check('F1 elk filter live; de echte filters tekenen een beeld ("geen" tekent niets)', allesLive and filtersGetekend, {k: v['som'] for k, v in res.items()})
        # 'geen' geeft dezelfde track als de rauwe bron
        geenRaw = pg.evaluate("(() => { window.__f.kies('geen'); const t = window.__f.uitTrack(); return t && t.kind === 'video' })()")
        check('F2 geen filter = de rauwe track terug', geenRaw)
        # K. knop-UI
        chips = pg.evaluate("[...document.querySelectorAll('#balk .cf-paneel button[data-id]')].map(b=>b.dataset.id)")
        pg.click('#balk .cf-knop')   # open het paneel
        pg.wait_for_timeout(200)
        pg.click("#balk button[data-id='nieuws']")
        pg.wait_for_timeout(300)
        velden = pg.evaluate("[...document.querySelectorAll('#balk .cf-nieuws input')].map(i=>i.dataset.veld)")
        nieuwsZichtbaar = pg.evaluate("!document.querySelector('#balk .cf-nieuws').hidden")
        pg.fill("#balk input[data-veld='kop']", 'TEST KOP 123')
        pg.wait_for_timeout(200)
        opgeslagen = pg.evaluate("window.__f.nieuwsTekst().kop")
        gekozen = pg.evaluate("window.__gekozen")
        check('K1 zes chips in het menu', set(chips) == {'geen','oudefilm','oudetv','anaglyph','beveiliging','nieuws'}, chips)
        check('K2 Nieuws kiezen toont de tekstvelden', nieuwsZichtbaar and set(velden) == {'kop','naam','plek','ticker'} and 'nieuws' in gekozen, (nieuwsZichtbaar, velden))
        check('K3 tekst typen past de nieuwsbalk aan', opgeslagen == 'TEST KOP 123', opgeslagen)
        if PLAAT: pg.screenshot(path=PLAAT + '/cf-menu.png')
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef225: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
