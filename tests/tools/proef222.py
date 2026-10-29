# proef222: Block It v149: zwarte blokken en de uitleg.
#  U. de eerste keer opent de uitleg vanzelf: 6 pagina's met een plaatje, Verder/Terug, 'Spelen!' sluit; daarna niet meer vanzelf;
#     de knop ❓ opent hem weer
#  Z. alleen spelen: eerst kiezen (Gewoon / Zwarte blokken / uitleg). Zwarte blokken: na 5 gelande stenen ligt er zwart in de bak;
#     een vierkant van zwart telt niet; een bom haalt zwart weg. Gewoon: geen zwart.
#  M. samen: de uitnodiger zet zwart AAN en kiest Gedeelde bak: bij de gast staat zwart ook aan; de gast heeft geen schakelaar
# python3 -I proef222.py <map> [plaatjesmap]
import sys, os, time, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); PLAAT = sys.argv[2] if len(sys.argv) > 2 else None
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''), flush=True)
HARNAS = r"""<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="taal.js"></script><title>BI proef</title>
<style>body{margin:0;background:#1a0a2e;color:#fff} #spelInhoud{position:relative;padding-top:8px}</style></head>
<body><div id="spelTitelBar"></div><div id="spelInhoud"></div>
<script type="module">
const q = new URLSearchParams(location.search), rol = q.get('rol')
const bc = new BroadcastChannel('bi-proef-' + (q.get('kamer') || '1'))
const h = []
const kanaal = { on(t, f, cb) { h.push([f && f.event, cb]); return kanaal },
  send(m) { if (rol !== 'solo') bc.postMessage({ van: rol, m: JSON.parse(JSON.stringify(m)) }); return Promise.resolve('ok') },
  subscribe(fn) { if (fn) fn('SUBSCRIBED'); return kanaal } }
bc.onmessage = e => { const d = e.data; if (d.van === rol) return
  h.filter(x => x[0] === d.m.event).forEach(x => x[1]({ type: 'broadcast', event: d.m.event, payload: d.m.payload })) }
window.__fibroProef = true
const m = await import('./blockit-ui.js?v=149')
const solo = rol === 'solo' ? { record: () => 0, nieuweScore: () => false } : null
m.start({ spelKanaal: kanaal, benIkSpeler1: rol !== 'guest', vriendNaam: rol === 'host' ? 'Bram' : 'Marcel', isActief: () => true, solo })
window.__klaar = true
</script></body></html>"""
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP):
    if f != 'bisamen.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
open(d + '/bisamen.html', 'w', encoding='utf-8').write(HARNAS)
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
def wacht(pg, js, ms):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def tekst(pg, sel):
    try: return pg.inner_text(sel)
    except Exception: return ''
def zwart(pg):
    return pg.evaluate("window.__blockIt.staat().rooster.flat().filter(c => c === 9).length")
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        try:
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            ctx.add_init_script("try { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('bi-geluid', 'uit') } catch (e) {}")
            s = ctx.new_page(); s.on('pageerror', lambda e: fouten.append(str(e)))
            s.goto(B + 'bisamen.html?rol=solo')
            # U. uitleg
            open_ = wacht(s, "!!document.querySelector('.bi-uitleg')", 4000)
            titels = []
            for i in range(6):
                titels.append(tekst(s, '.bi-u-titel'))
                if PLAAT and i in (1, 4): s.screenshot(path=PLAAT + '/uitleg-%d.png' % (i + 1))
                if i < 5: s.click('.bi-u-verder')
            laatste = tekst(s, '.bi-u-verder')
            s.click('.bi-u-terug'); terug = tekst(s, '.bi-u-titel')
            s.click('.bi-u-verder'); s.click('.bi-u-verder')
            dicht = not s.evaluate("!!document.querySelector('.bi-uitleg')")
            check('U1 de eerste keer vanzelf: 6 pagina\'s, Terug werkt, "Spelen!" sluit', open_ and len(set(titels)) == 6 and titels[0].startswith('1.') and laatste == 'Spelen!' and terug.startswith('5.') and dicht, (titels, laatste, terug))
            s.reload(); wacht(s, 'window.__klaar === true', 5000); s.wait_for_timeout(800)
            nietVanzelf = not s.evaluate("!!document.querySelector('.bi-uitleg')")
            s.click('#bi-uitleg'); weer = s.evaluate("!!document.querySelector('.bi-uitleg')")
            s.click('.bi-u-sluit')
            check('U2 daarna niet meer vanzelf; ❓ opent hem weer', nietVanzelf and weer)
            # Z. alleen spelen
            knoppen = s.evaluate("[...document.querySelectorAll('#bi-keuze button')].map(b => b.innerText.split('\\n')[0])")
            check('Z1 alleen spelen: eerst kiezen (Gewoon / Zwarte blokken / uitleg)', len(knoppen) == 3 and knoppen[0] == 'Gewoon' and 'Zwarte' in knoppen[1] and 'Hoe speel' in knoppen[2], knoppen)
            if PLAAT: s.screenshot(path=PLAAT + '/solo-keuze.png')
            s.click('#bi-keuze button >> nth=1')
            wacht(s, 'window.__blockIt.staat().bezig', 6000)
            for i in range(12):
                s.wait_for_timeout(450); s.keyboard.press('Space')
            s.wait_for_timeout(500)
            st = s.evaluate('window.__blockIt.staat()')
            nz = zwart(s)
            if PLAAT: s.screenshot(path=PLAAT + '/solo-zwart.png')
            check('Z2 zwarte blokken: na een paar stenen ligt er zwart in de bak', st['zwartAan'] and st['zwartTeller'] >= 5 and nz >= 1, (st['zwartTeller'], nz))
            # vierkant van zwart telt niet; bom haalt zwart weg
            leeg = '.' * 10
            rij = lambda t: (t + '.' * 10)[:10]
            r = [leeg] * 15 + [rij('999'), rij('999'), rij('999'), rij('9990'), rij('9990')]
            s.evaluate("t => window.__blockIt.zetRooster(t)", ''.join(r))
            geenVierkant = s.evaluate('window.__blockIt.grootsteVierkant()') is None
            s.evaluate("window.__blockIt.bom(1, 14)")
            na = zwart(s)
            check('Z3 een vierkant van zwart telt niet; een bom haalt de zwarte blokken weg', geenVierkant and na < 15, (geenVierkant, na))
            # gewoon: geen zwart
            s.evaluate("window.__blockIt.zetRooster('.'.repeat(200))")
            s2 = ctx.new_page(); s2.on('pageerror', lambda e: fouten.append(str(e)))
            s2.goto(B + 'bisamen.html?rol=solo'); wacht(s2, 'window.__klaar === true', 5000); s2.wait_for_timeout(500)
            s2.click('#bi-keuze button >> nth=0')
            wacht(s2, 'window.__blockIt.staat().bezig', 6000)
            for i in range(12):
                s2.wait_for_timeout(400); s2.keyboard.press('Space')
            check('Z4 gewoon: geen zwarte blokken', not s2.evaluate('window.__blockIt.staat().zwartAan') and zwart(s2) == 0, zwart(s2))
            s.close(); s2.close()
            # M. samen
            h = ctx.new_page(); g = ctx.new_page()
            for pg in (h, g): pg.on('pageerror', lambda e: fouten.append(str(e)))
            h.goto(B + 'bisamen.html?rol=host&kamer=m'); g.goto(B + 'bisamen.html?rol=guest&kamer=m')
            menu = wacht(h, "!!document.querySelector('.bi-zwartknop')", 6000)
            if menu and 'AAN' not in tekst(h, '.bi-zwartknop'): h.click('.bi-zwartknop')
            if PLAAT: h.screenshot(path=PLAAT + '/samen-menu.png')
            gastKnop = g.evaluate("!!document.querySelector('.bi-zwartknop')")
            h.click("#bi-keuze button >> text=Gedeelde bak")
            ok = wacht(g, 'window.__blockIt.staat().modus === "samen" && window.__blockIt.staat().zwartAan', 5000)
            check('M1 samen: de uitnodiger zet zwart AAN, bij de gast staat het ook aan (geen schakelaar bij de gast)', menu and ok and not gastKnop, (menu, ok, gastKnop))
            st = g.evaluate("window.__blockIt.staat().modus") ; stat = tekst(g, '#bi-status')
            check('M2 de gast ziet ⬛ bij het aftellen', '⬛' in stat, stat)
        except Exception as e:
            check('proef afgebroken', False, str(e).split(chr(10))[0])
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef222: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
