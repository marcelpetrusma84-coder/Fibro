# proef227: titelschermen (v1): voor elk van de 12 spellen een titelscherm met bewegend plaatje en muziek.
#  T1 elk scherm verschijnt, het lettertype van de titel is geladen, de muziek van dat spel speelt
#  T2 één tik: het scherm gaat weg, toonTitelscherm geeft true, de muziek speelt nog even door
#  T3 het muziekknopje 🔊 sluit het scherm niet en zet de muziek uit (onthouden)
#  T5 v252: tik op een spel elders (openSpelMetTitel): titelscherm met muziek, tik, dan spel.html zonder tweede titelscherm
#  T6 v253: de muziek speelt door in het menu van het spel (Block It: Start, dan de spelvormen) en stopt als het spel begint
#  T8-T10 v254: het spel in een venster op de pagina: muziek in de menu's, stopt bij spelen, ✕ sluit
#  T4 geen paginafouten
# python3 -I proef227.py <map> [plaatjesmap]
import sys, os, time, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); PLAAT = sys.argv[2] if len(sys.argv) > 2 else None
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''), flush=True)
HARNAS = r"""<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="taal.js"></script><link href="lettertypen/basis.css?v=1" rel="stylesheet"><title>titel proef</title>
<style>body{margin:0;background:#1a0a2e;color:#fff}</style></head><body>
<script type="module">
const q = new URLSearchParams(location.search)
const ts = await import('./titelscherm.js?v=6'), tm = await import('./titelmuziek.js?v=6')
window.__ts = ts
window.__tm = tm
window.__uitkomst = null
window.__start = () => ts.toonTitelscherm({ spelId: q.get('spel'), naam: q.get('naam') }).then(v => { window.__uitkomst = v })
window.__start()
window.__klaar = true
</script></body></html>"""
SPELLEN = [('botkaaseiren', 'Tic-Tac-Toe'), ('vieroprij', 'Four in a Row'), ('schaken', 'Schaken'), ('dammen', 'Draughts'),
           ('pong', 'Neo Paddle'), ('pacman', 'Ghost Tag'), ('breakout', 'Block It'), ('swarm', 'The Swarm'),
           ('pinball', 'Twin Snakes'), ('endlessrunner', 'Runner & Gunner'), ('flappybird', 'Flapper'), ('shmup', 'Neon Raiders')]
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP):
    if f != 'titelproef.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
open(d + '/titelproef.html', 'w', encoding='utf-8').write(HARNAS)
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
from urllib.parse import quote
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
        try:
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
            ctx.add_init_script("try { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('bi-uitleg', 'gezien') } catch (e) {}")
            for i, (id_, naam) in enumerate(SPELLEN):
                pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
                pg.on('console', lambda m: fouten.append(m.text) if m.type == 'error' else None)
                pg.goto(B + 'titelproef.html?spel=%s&naam=%s' % (id_, quote(naam)))
                pg.wait_for_selector('.fibro-titelscherm'); pg.mouse.move(5, 5); pg.wait_for_timeout(2600)
                font = pg.evaluate("[...document.fonts].some(f => f.status === 'loaded' && f.family.replace(/\"/g,'') !== 'DM Sans' && f.family.replace(/\"/g,'') !== 'DM Mono')")
                muziek = pg.evaluate('window.__tm.speeltNu()')
                if PLAAT: pg.screenshot(path=PLAAT + '/titel-%02d-%s.png' % (i + 1, id_))
                check('T1 %s: titelscherm, lettertype en muziek' % naam, (font or id_ == 'swarm') and muziek == id_, (font, muziek))
                if i == 0:
                    pg.click('.fibro-titel-muziek'); pg.wait_for_timeout(300)
                    nogEr = pg.evaluate("!!document.querySelector('.fibro-titelscherm') && window.__uitkomst === null")
                    check('T3 muziekknopje: scherm blijft, muziek uit en onthouden', nogEr and pg.evaluate('window.__tm.speeltNu()') is None and pg.evaluate("localStorage.getItem('fibro_titelmuziek')") == 'uit')
                    pg.click('.fibro-titel-muziek'); pg.wait_for_timeout(200)
                pg.mouse.click(195, 500); pg.wait_for_timeout(600)
                weg = pg.evaluate("!document.querySelector('.fibro-titelscherm') && window.__uitkomst === true")
                check('T2 %s: één tik en weg, muziek speelt door' % naam, weg and pg.evaluate('window.__tm.speeltNu()') == id_)
                pg.close()
            pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
            pg.goto(B + 'titelproef.html?spel=pong&naam=x'); pg.wait_for_selector('.fibro-titelscherm'); pg.mouse.click(195, 500); pg.wait_for_timeout(600)
            pg.evaluate("window.__ts.openSpelMetTitel('breakout', 'spel.html?spel=breakout')"); pg.wait_for_timeout(800)
            muziek = pg.evaluate('window.__tm.speeltNu()')
            pg.mouse.click(195, 500)
            pg.wait_for_selector('iframe.fibro-spelvenster'); fr = pg.frame_locator('iframe.fibro-spelvenster')
            fr.locator('#startKnop').wait_for(timeout=8000); pg.wait_for_timeout(400)
            srcOk = 'titel=1&ingebed=1' in pg.get_attribute('iframe.fibro-spelvenster', 'src')
            geenTitel = fr.locator('.fibro-titelscherm').count() == 0
            opStart = pg.evaluate('window.__tm.speeltNu()')
            check('T5 v254: titelscherm met muziek, tik, dan het spel in een venster op deze pagina; muziek speelt door', muziek == 'breakout' and srcOk and geenTitel and opStart == 'breakout', (muziek, srcOk, geenTitel, opStart))
            fr.locator('#startKnop').click(); fr.locator('#bi-keuze button').first.wait_for(timeout=8000); pg.wait_for_timeout(400)
            inMenu = pg.evaluate('window.__tm.speeltNu()')
            fr.locator('#bi-keuze button').first.click(); pg.wait_for_timeout(600)
            naStart = pg.evaluate('window.__tm.speeltNu()')
            check('T8 venster: muziek ook in het menu van Block It, stopt bij Gewoon', inMenu == 'breakout' and naStart is None, (inMenu, naStart))
            fr.locator('#sluitKnop').click(); pg.wait_for_timeout(500)
            check('T9 venster: ✕ sluit het venster', pg.locator('iframe.fibro-spelvenster').count() == 0)
            pg.evaluate("window.__ts.openSpelMetTitel('schaken', 'spel.html?spel=schaken')"); pg.wait_for_timeout(600); pg.mouse.click(195, 500)
            fr = pg.frame_locator('iframe.fibro-spelvenster'); fr.locator('.niveau-btn').first.wait_for(timeout=8000); pg.wait_for_timeout(400)
            opNiveau = pg.evaluate('window.__tm.speeltNu()')
            fr.locator('.niveau-btn').first.click(); pg.wait_for_timeout(800)
            check('T10 venster: muziek bij Schaken op het niveauscherm, stopt als het bord komt', opNiveau == 'schaken' and pg.evaluate('window.__tm.speeltNu()') is None, opNiveau)
            pg.close()
            pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
            pg.goto(B + 'spel.html?spel=breakout'); pg.wait_for_selector('.fibro-titelscherm'); pg.wait_for_timeout(500)
            pg.mouse.click(195, 500); pg.wait_for_selector('#startKnop'); pg.click('#startKnop')
            pg.wait_for_selector('#bi-keuze button', timeout=8000); pg.wait_for_timeout(500)
            sp = "import('./titelmuziek.js?v=6').then(m => m.speeltNu())"
            inMenu = pg.evaluate(sp)
            pg.click('#bi-keuze button >> nth=0'); pg.wait_for_timeout(500)
            naStart = pg.evaluate(sp)
            check('T6 muziek in het menu van Block It, stopt bij Gewoon', inMenu == 'breakout' and naStart is None, (inMenu, naStart))
            pg.goto(B + 'spel.html?spel=swarm&titel=1'); pg.wait_for_timeout(1500)
            check('T7 na het titelscherm op Home: muziek in het menu op spel.html', pg.evaluate("import('./titelmuziek.js?v=6').then(m => m.speeltNu())") == 'swarm' and pg.evaluate("!document.querySelector('.fibro-titelscherm')"))
            pg.close()
        except Exception as e:
            check('proef afgebroken', False, str(e).split(chr(10))[0])
        br.close()
finally:
    srv.terminate()
check('T4 geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef227: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
