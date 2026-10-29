# proef224: driespelerschaak — een kwaadaardige gebruikersnaam mag geen code uitvoeren (XSS).
# We starten het spel met namen die een <img onerror=...> en een "><svg onload=...> bevatten en controleren:
#  - er wordt geen code uitgevoerd (window.__pwned blijft leeg)
#  - de naam staat als gewone tekst in de scorelijst (niet als element)
#  - oud: de ongefilterde versie voert de code WEL uit (bewijst dat de test werkt)
# python3 -I proef224.py <nieuwe map> [oude map]
import sys, os, time, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:200] if info != '' else ''), flush=True)
HARNAS = r"""<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>schaak xss</title></head>
<body><div id="spelOverlay"><div id="spelInhoud"></div></div>
<script type="module">
window.__pwned = 0
const m = await import('./schaken-drie-ui.js?v=22')
m.start({ localPreview: true, players: [
  { id: 'a', username: '<img src=x onerror="window.__pwned=1">' },
  { id: 'b', username: '\"><svg onload=\"window.__pwned=1\">' },
  { id: 'c', username: 'Lotte' } ] })
window.__klaar = true
</script></body></html>"""
def draai(MAP, label):
    www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
    for f in os.listdir(MAP):
        if f != 'xss.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
    open(d + '/xss.html', 'w', encoding='utf-8').write(HARNAS)
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.7)
    B = 'http://127.0.0.1:%d/Fibro/' % poort
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(args=['--no-proxy-server'])
            pg = br.new_page()
            fouten = []; pg.on('pageerror', lambda e: fouten.append(str(e)))
            pg.goto(B + 'xss.html')
            try: pg.wait_for_function('window.__klaar===true', timeout=8000)
            except Exception: pass
            pg.wait_for_timeout(1200)
            pwned = pg.evaluate('window.__pwned')
            tekst = pg.inner_text('.chess3-capturebar') if pg.query_selector('.chess3-capturebar') else ''
            geinjecteerd = pg.evaluate("document.querySelectorAll('.chess3-capturebar img, .chess3-capturebar svg').length")
            br.close()
            return pwned, tekst, geinjecteerd, fouten
    finally:
        srv.terminate()
NIEUW = os.path.abspath(sys.argv[1]); OUD = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else None
pwned, tekst, inj, fouten = draai(NIEUW, 'nieuw')
check('N1 geen code uitgevoerd (window.__pwned blijft 0)', pwned == 0, pwned)
check('N2 geen geïnjecteerd <img>/<svg> in de scorelijst', inj == 0, inj)
check('N3 de naam staat als tekst in de scorelijst', '<img' in tekst and 'onerror' in tekst, tekst[:120])
if OUD:
    pwned2, _, inj2, _ = draai(OUD, 'oud')
    check('O1 oude versie voert de code WEL uit (test werkt)', pwned2 == 1, pwned2)
goed = sum(uitslag)
print('UITSLAG proef224: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
