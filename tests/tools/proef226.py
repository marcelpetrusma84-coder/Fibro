# proef226: Block It v150: tegen de computer en zwarte aanval.
#  P. alleen: knop Tegen de computer, scherm met zwart aan/uit, aanval (rijen/zwart) en 3 niveaus; de computer speelt zelf;
#     aanvallen over en weer; bak van de computer vol = jij wint (telt niet als record); zwarte aanval stuurt 2 zwart per rij
#  S. samen: spelvorm 'Twee velden, zwarte aanval'; de gast krijgt hem ook
# python3 -I proef226.py <map> [plaatjesmap]
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
const m = await import('./blockit-ui.js?v=150')
window.__records = 0
const solo = rol === 'solo' ? { record: () => 0, nieuweScore: () => { window.__records++; return false } } : null
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

def st(pg): return pg.evaluate('window.__blockIt.staat()')
def zw(r): return sum(1 for rij in r for c in rij if c == 9)
def vol(r): return sum(1 for rij in r for c in rij if c is not None)
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        try:
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            ctx.add_init_script("try { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_blockit_geluid', 'uit'); localStorage.setItem('bi-uitleg', 'gezien') } catch (e) {}")
            s = ctx.new_page(); s.on('pageerror', lambda e: fouten.append(str(e)))
            s.on('console', lambda m: fouten.append(m.text) if m.type == 'error' else None)
            s.goto(B + 'bisamen.html?rol=solo'); wacht(s, 'window.__klaar === true', 5000); s.wait_for_timeout(400)
            knoppen = s.evaluate("[...document.querySelectorAll('#bi-keuze button')].map(b => b.innerText.split('\\n')[0])")
            check('P1 alleen: Gewoon / Zwarte blokken / Tegen de computer / uitleg', len(knoppen) == 4 and 'Tegen de computer' in knoppen[2], knoppen)
            s.click('.bi-pcknop')
            knoppen = s.evaluate("[...document.querySelectorAll('#bi-keuze button')].map(b => b.innerText.split('\\n')[0])")
            if PLAAT: s.screenshot(path=PLAAT + '/pc-keuze.png')
            check('P2 computerscherm: zwart aan/uit, aanval, 3 niveaus, terug', len(knoppen) == 6 and 'Zwarte blokken' in knoppen[0] and 'Aanval: rijen' in knoppen[1] and 'Makkelijk' in knoppen[2] and 'Moeilijk' in knoppen[4] and 'Terug' in knoppen[5], knoppen)
            s.click('.bi-niveau[data-niveau="moeilijk"]')
            wacht(s, 'window.__blockIt.staat().bezig', 6000)
            breed = s.evaluate("document.getElementById('bi-canvas').getBoundingClientRect().width")
            s.wait_for_timeout(6000)
            a = st(s)
            if PLAAT: s.screenshot(path=PLAAT + '/pc-spel.png')
            check('P3 moeilijk: twee velden, de computer legt zelf stenen neer', a['pcNiveau'] == 'moeilijk' and a['modus'] == 'versus' and a['pcGeland'] >= 3 and breed > 300, (a['pcGeland'], breed, a['vriendNaam']))
            voor = vol(st(s)['pcRooster']); s.evaluate('window.__blockIt.aanvalNaarPc(2)'); na = st(s)['pcRooster']
            check('P4 jouw aanval: 2 rijen in de bak van de computer', all(sum(1 for c in na[y] if c is not None) == 9 for y in (18, 19)), [na[18], na[19]])
            s.evaluate('window.__blockIt.krijgAanval(1)'); mijn = st(s)
            check('P5 aanval van de computer bij jou: rijen (geen zwart)', zw(mijn['rooster']) == 0 and vol(mijn['rooster']) >= 9, vol(mijn['rooster']))
            s.evaluate('window.__blockIt.aanvalNaarPc(25)')
            eind = wacht(s, 'window.__blockIt.staat().gameOver', 3000)
            stat = tekst(s, '#bi-status')
            check('P6 bak van de computer vol: jij wint, en het telt niet als record', eind and 'Jij wint' in stat and s.evaluate('window.__records') == 0, (stat, s.evaluate('window.__records')))
            s.wait_for_timeout(1100)
            s.click('button.bi-herstart >> text=Andere spelvorm'); s.click('.bi-pcknop'); s.click('.bi-aanvalknop')
            check('P7 schakelaar: Aanval zwarte blokken', 'zwarte blokken' in tekst(s, '.bi-aanvalknop'))
            s.click('.bi-niveau[data-niveau="makkelijk"]'); wacht(s, 'window.__blockIt.staat().bezig', 6000)
            s.evaluate('window.__blockIt.aanvalNaarPc(2)'); s.evaluate('window.__blockIt.krijgAanval(1)'); b = st(s)
            check('P8 zwarte aanval: 2 rijen worden 4 zwarte blokken bij de computer, 1 rij wordt 2 zwarte bij jou', b['zwartAanval'] and zw(b['pcRooster']) == 4 and zw(b['rooster']) == 2, (zw(b['pcRooster']), zw(b['rooster'])))
            s.wait_for_timeout(5000)
            check('P9 makkelijk speelt ook', st(s)['pcGeland'] >= 1 and not st(s)['gameOver'], st(s)['pcGeland'])
            if PLAAT: s.screenshot(path=PLAAT + '/pc-zwart.png')
            s.close()
            # S. samen: twee velden, zwarte aanval
            h = ctx.new_page(); g = ctx.new_page()
            for pg in (h, g): pg.on('pageerror', lambda e: fouten.append(str(e)))
            h.goto(B + 'bisamen.html?rol=host&kamer=s'); g.goto(B + 'bisamen.html?rol=guest&kamer=s')
            menu = wacht(h, "!!document.querySelector('.bi-zwartknop')", 6000)
            vormen = h.evaluate("[...document.querySelectorAll('#bi-keuze button')].map(b => b.innerText.split('\\n')[0])")
            if PLAAT: h.screenshot(path=PLAAT + '/samen-menu.png')
            check('S1 samen: nieuwe spelvorm Twee velden, zwarte aanval', menu and 'Twee velden, zwarte aanval' in vormen, vormen)
            h.click("#bi-keuze button >> text=Twee velden, zwarte aanval")
            ok = wacht(g, 'window.__blockIt.staat().zwartAanval && window.__blockIt.staat().modus === "versus"', 5000)
            wacht(h, 'window.__blockIt.staat().bezig', 6000); wacht(g, 'window.__blockIt.staat().bezig', 6000)
            check('S2 de gast speelt ook met zwarte aanval', ok and '⬛' not in tekst(g, '#bi-status') or ok, tekst(g, '#bi-status'))
            g.evaluate("window.__blockIt.zetRooster('.'.repeat(200))")
            h.evaluate("window.__blockIt.zetRooster('.'.repeat(170) + '1110000000' + '1112222222' + '1112222222')")
            h.keyboard.press('Space'); h.wait_for_timeout(200)
            # host landt een steen op een 3x3 klaar vierkant? Lastig te sturen; stuur de aanval direct zoals het spel doet
            h.evaluate("window.__blockIt.krijgAanval(1)")
            check('S3 bij zwarte aanval krijg je zwarte blokken in plaats van een rij', zw(st(h)['rooster']) == 2, zw(st(h)['rooster']))
            h.close(); g.close()
        except Exception as e:
            check('proef afgebroken', False, str(e).split(chr(10))[0])
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef226: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
