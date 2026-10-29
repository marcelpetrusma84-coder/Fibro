# proef223: Twin Snakes v2: drie spelvormen, nieuw level 5 (ARENA), wrap-around.
#  L. levels: ronde 5 is nu ARENA (muren, geen ZIGZAG meer); ronde 1 is OPEN VELD
#  C. classic: leeg veld (geen muren), de rand is dodelijk (slang tegen de bovenrand = dood)
#  W. zonder muren: leeg veld, randloos; een slang die de bovenrand uit gaat komt onderaan weer binnen en leeft
#  M. samen: de uitnodiger kiest CLASSIC in het menu; bij de gast staat de spelvorm ook op classic (gast heeft geen menu)
#  (plaatjes van de drie spelvormen)
# python3 -I proef223.py <map> [plaatjesmap]
import sys, os, time, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); PLAAT = sys.argv[2] if len(sys.argv) > 2 else None
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''), flush=True)
HARNAS = r"""<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="taal.js"></script><title>TS proef</title>
<style>html,body{margin:0;height:100%;background:#0a0520;color:#fff} #spelOverlay{position:fixed;inset:0;display:flex;flex-direction:column} #spelInhoud{flex:1;position:relative}</style></head>
<body><div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud"></div></div>
<script type="module">
const q = new URLSearchParams(location.search), rol = q.get('rol')
let kanaal = null
if (rol !== 'solo') {
  const bc = new BroadcastChannel('ts-proef-' + (q.get('kamer') || '1'))
  const h = []
  kanaal = { on(t, f, cb) { h.push([f && f.event, cb]); return kanaal },
    send(m) { bc.postMessage({ van: rol, m: JSON.parse(JSON.stringify(m)) }); return Promise.resolve('ok') } }
  bc.onmessage = e => { const d = e.data; if (d.van === rol) return
    h.filter(x => x[0] === d.m.event).forEach(x => x[1]({ type: 'broadcast', event: d.m.event, payload: d.m.payload })) }
}
const m = await import('./twin-snakes-ui.js?v=148')
window.__ts = await m.start({ spelKanaal: kanaal, benIkSpeler1: rol !== 'guest', vriendNaam: rol === 'host' ? 'Bram' : 'Marcel', isActief: () => true })
window.__klaar = true
</script></body></html>"""
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP):
    if f != 'tssamen.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
open(d + '/tssamen.html', 'w', encoding='utf-8').write(HARNAS)
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
P = 'window.__ts._proef'
fouten = []
def wacht(pg, js, ms):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def naarSpel(pg):
    for _ in range(6):
        pg.evaluate("%s.update(1.1)" % P)
        if pg.evaluate("%s.staat" % P) == 'spel': return True
    return pg.evaluate("%s.staat" % P) == 'spel'
# zet een slang tegen de bovenrand, de ander dood (negeren), en doe één stap omhoog
PREP = """(([mx,my]) => { const pr = %s, s0 = pr.slangen[0], s1 = pr.slangen[1]
  if (s1) s1.dood = true
  s0.dood = false; s0.wacht = []; s0.dir = 'U'; s0.oudeStaart = null
  s0.lijf = [[mx, my], [mx, my+1], [mx, my+2], [mx, my+3]]
  pr.stap()
  return { kop: pr.slangen[0].lijf[0], dood: pr.slangen[0].dood } })""" % P
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        try:
            ctx = br.new_context(viewport={'width': 390, 'height': 760}, has_touch=True, is_mobile=True)
            ctx.add_init_script("try{localStorage.setItem('fibro_taal','nl');localStorage.removeItem('tsnk-modus')}catch(e){}")
            s = ctx.new_page(); s.on('pageerror', lambda e: fouten.append(str(e)))
            s.goto(B + 'tssamen.html?rol=solo'); wacht(s, 'window.__klaar===true', 8000)
            # menu aanwezig (solo = jij bent de baas)
            knoppen = s.evaluate("[...document.querySelectorAll('.tsnk .mKnop b')].map(b=>b.textContent)")
            check('S1 menu met drie spelvormen', knoppen == ['LEVELS', 'CLASSIC', 'ZONDER MUREN'], knoppen)
            if PLAAT: s.screenshot(path=PLAAT + '/ts-menu.png')
            # L. levels: ronde 5 = ARENA
            s.evaluate("%s.zetModus('levels')" % P)
            s.evaluate("%s.startRonde(1)" % P); r1 = s.evaluate("%s.veld.naam" % P)
            s.evaluate("%s.startRonde(5)" % P)
            lv5 = s.evaluate("[%s.veld.naam, %s.veld.muren.length]" % (P, P))
            check('L1 levels: ronde 1 = OPEN VELD, ronde 5 = ARENA met muren', r1 == 'OPEN VELD' and lv5[0] == 'ARENA' and lv5[1] >= 1, (r1, lv5))
            if PLAAT:
                naarSpel(s); s.wait_for_timeout(200); s.screenshot(path=PLAAT + '/ts-arena.png')
            # C. classic: leeg veld, rand dodelijk
            s.evaluate("%s.zetModus('classic')" % P); s.evaluate("%s.startRonde(1)" % P)
            cfg = s.evaluate("[%s.veld.muren.length, %s.randloos, %s.veld.naam]" % (P, P, P))
            naarSpel(s)
            dood = s.evaluate(PREP, [5, 0])
            check('C1 classic: geen muren, de rand is dodelijk', cfg[0] == 0 and cfg[1] == False and dood['dood'] == True, (cfg, dood))
            if PLAAT: s.screenshot(path=PLAAT + '/ts-classic.png')
            # W. zonder muren: wrap, blijft leven
            s.evaluate("%s.zetModus('muurloos')" % P); s.evaluate("%s.startRonde(1)" % P)
            rl = s.evaluate("%s.randloos" % P)
            naarSpel(s)
            w = s.evaluate(PREP, [5, 0])
            check('W1 zonder muren: randloos, de slang komt onderaan weer binnen en leeft', rl == True and w['dood'] == False and w['kop'][1] == 27 and w['kop'][0] == 5, (rl, w))
            if PLAAT: s.screenshot(path=PLAAT + '/ts-muurloos.png')
            s.close()
            # M. samen: host kiest classic, gast krijgt het
            h = ctx.new_page(); g = ctx.new_page()
            for pg in (h, g): pg.on('pageerror', lambda e: fouten.append(str(e)))
            h.goto(B + 'tssamen.html?rol=host&kamer=m'); g.goto(B + 'tssamen.html?rol=guest&kamer=m')
            wacht(h, 'window.__klaar===true', 8000) and wacht(g, 'window.__klaar===true', 8000)
            gastMenu = g.evaluate("document.querySelectorAll('.tsnk .mKnop').length")
            h.wait_for_timeout(500)
            h.click('.tsnk .mKnop >> nth=1')   # CLASSIC
            hostModus = h.evaluate("%s.modus" % P)
            # wacht tot de ander 'er is', dan start de host
            wacht(h, "!%s.leider || %s.anderIsEr()" % (P, P), 6000)
            h.click('.tsnk .kSpeel')
            ok = wacht(g, "%s.modus === 'classic'" % P, 6000)
            check('M1 samen: host kiest CLASSIC, gast krijgt classic (gast heeft geen menu)', hostModus == 'classic' and gastMenu == 0 and ok, (hostModus, gastMenu, ok))
        except Exception as e:
            check('proef afgebroken', False, str(e).split(chr(10))[0])
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef223: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
