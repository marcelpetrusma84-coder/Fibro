# proef221: Runner & Gunner v148. Twee pagina's spelen samen via een nagemaakt spelkanaal (BroadcastChannel).
#  T. terughalen: speler 2 af -> tekst 'kan je nog terughalen'; bij de uitnodiger komt een hart; hart pakken =
#     speler 2 rent weer (1 leven, scherm weg), het hart is weg
#  K. kiestijd: allebei af, OPNIEUW -> allebei 'KIES JE SPELER' met aftellen; speler 2 kiest GUNNER; na ±5 s start
#     ronde 2 bij allebei, speler 2 is GUNNER
#  D. schermstand: telefoon rechtop, knop -> SCHERM: LIGGEND: het spel draait een kwartslag en vult het scherm;
#     tik bovenin (= links in het spel) springt, onderin schiet; weer VANZELF = niet gedraaid
# python3 -I proef221.py <map> [plaatjesmap]
import sys, os, time, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); PLAAT = sys.argv[2] if len(sys.argv) > 2 else None
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''), flush=True)
HARNAS = r"""<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="taal.js"></script><title>RG proef</title>
<style>body{margin:0;background:#1a0a2e;color:#fff} #spelOverlay{position:fixed;inset:0;display:flex;flex-direction:column} #spelInhoud{flex:1;position:relative}</style></head>
<body><div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud"></div></div>
<script type="module">
const q = new URLSearchParams(location.search), rol = q.get('rol')
const bc = new BroadcastChannel('rg-proef-' + (q.get('kamer') || '1'))
const h = []
const kanaal = { topic: 'realtime:spel_rg_' + (q.get('kamer') || '1'), on(t, f, cb) { h.push([f && f.event, cb]); return kanaal },
  send(m) { bc.postMessage({ van: rol, m: JSON.parse(JSON.stringify(m)) }); return Promise.resolve('ok') },
  subscribe(fn) { if (fn) fn('SUBSCRIBED'); return kanaal } }
bc.onmessage = e => { const d = e.data; if (d.van === rol) return
  h.filter(x => x[0] === d.m.event).forEach(x => x[1]({ type: 'broadcast', event: d.m.event, payload: d.m.payload })) }
const m = await import('./runner-gunner-ui.js?v=148')
window.__proef = await m.start({ spelKanaal: kanaal, benIkSpeler1: rol === 'host', vriendNaam: rol === 'host' ? 'Marcel' : 'Bram', isActief: () => true })
window.__klaar = true
</script></body></html>"""
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP):
    if f != 'rgsamen.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
open(d + '/rgsamen.html', 'w', encoding='utf-8').write(HARNAS)
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
SC = 'window.__proef._proef.scene()'
fouten = []
def wacht(pg, js, ms):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def tekst(pg, sel):
    try: return pg.inner_text(sel)
    except Exception: return ''
INIT = "try { localStorage.setItem('fibro_taal', 'nl'); localStorage.removeItem('rg-stand'); localStorage.setItem('rg-geluid', 'uit') } catch (e) {}"
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        try:
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, bypass_csp=True)
            ctx.add_init_script(INIT)
            h = ctx.new_page(); g = ctx.new_page()
            for pg in (h, g): pg.on('pageerror', lambda e: fouten.append(str(e)))
            h.goto(B + 'rgsamen.html?rol=host&kamer=a'); g.goto(B + 'rgsamen.html?rol=guest&kamer=a')
            wacht(h, 'window.__klaar === true', 15000) and wacht(g, 'window.__klaar === true', 15000)
            klaar = wacht(h, "!document.querySelector('.rg .knop').disabled", 8000)
            h.click('.rg .knop')
            speelt = wacht(h, '!!(%s && %s.speler)' % (SC, SC), 15000) and wacht(g, '!!(%s && %s.speler)' % (SC, SC), 15000)
            check('A1 samen gestart', klaar and speelt)
            g.wait_for_timeout(1500)
            for pg in (h, g): pg.evaluate("(() => { const s = %s; s.levens = 99 })()" % SC)
            # T. terughalen
            g.evaluate("(() => { const s = %s; s.levens = 0; s.einde() })()" % SC)
            g.wait_for_timeout(600)
            pg_tekst = tekst(g, '.rg .laag p')
            check('T1 speler 2 af: "kan je nog terughalen" op zijn scherm', 'terughalen' in pg_tekst and g.evaluate(SC + '.af'), pg_tekst)
            hart = wacht(h, '!!%s.hart' % SC, 5000)
            if PLAAT: h.wait_for_timeout(1500); h.screenshot(path=PLAAT + '/t-hart.png')
            check('T2 bij de uitnodiger komt een hart op de baan', hart)
            h.evaluate("(() => { const s = %s, sp = s.speler; s.hart.x = sp.x + 4; s.hart.basisY = sp.y })()" % SC)
            terug = wacht(g, '!%s.af && document.querySelector(".rg .laag").hidden' % SC, 5000)
            g.wait_for_timeout(800)
            check('T3 hart gepakt: speler 2 rent weer met 1 leven, scherm weg', terug and g.evaluate(SC + '.levens') == 1 and g.evaluate(SC + '.sys.isActive()'), (terug, g.evaluate(SC + '.levens')))
            check('T4 het hart is weg bij de uitnodiger', h.evaluate('!' + SC + '.hart'))
            if PLAAT: g.screenshot(path=PLAAT + '/t-gered.png')
            # K. kiestijd
            g.evaluate("(() => { const s = %s; s.levens = 0; s.einde() })()" % SC)
            h.wait_for_timeout(500)
            h.evaluate("(() => { const s = %s; s.levens = 0; s.einde() })()" % SC)
            kan = wacht(h, "!document.querySelector('.rg .knop').disabled && document.querySelector('.rg .knop').textContent.includes('OPNIEUW')", 6000)
            h.click('.rg .knop')
            kies = wacht(h, "document.querySelector('.rg .laag h1').textContent.includes('KIES')", 2000) and wacht(g, "document.querySelector('.rg .laag h1').textContent.includes('KIES')", 3000)
            if PLAAT: g.screenshot(path=PLAAT + '/k-kies.png')
            check('K1 allebei af, OPNIEUW: allebei "KIES JE SPELER" met aftellen', kan and kies, (tekst(h, '.rg .laag p'), tekst(g, '.rg .laag p')))
            g.wait_for_timeout(1500)
            g.click('.rg .kGunner')
            t0 = time.time()
            nog = h.evaluate("document.querySelector('.rg .laag h1').textContent")
            gestart = wacht(h, '!!(%s && %s.sys.isActive() && !%s.af)' % (SC, SC, SC), 15000) and wacht(g, '!!(%s && %s.sys.isActive() && !%s.af)' % (SC, SC, SC), 15000)
            duur = time.time() - t0
            check('K2 ronde 2 start pas na de kiestijd, speler 2 is GUNNER', gestart and 'KIES' in nog and g.evaluate('window.__proef._proef.held()') == 'gunner' and duur > 3,
                  (gestart, nog, g.evaluate('window.__proef._proef.held()'), round(duur, 1)))
            # D. schermstand
            for pg in (h, g): pg.evaluate("(() => { const s = %s; s.levens = 99 })()" % SC)
            h.evaluate("(() => { const s = %s; s.levens = 0; s.einde() })()" % SC)
            h.wait_for_timeout(400)
            k0 = tekst(h, '.rg .standKnop')
            h.click('.rg .standKnop')
            h.wait_for_timeout(400)
            info = h.evaluate("""(() => { const w = document.querySelector('.rg'), r = w.getBoundingClientRect(), i = document.getElementById('spelInhoud').getBoundingClientRect()
              return { t: w.style.transform, lig: w.classList.contains('liggend'), r: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
                       i: [Math.round(i.left), Math.round(i.top), Math.round(i.width), Math.round(i.height)], knop: document.querySelector('.rg .standKnop').textContent } })()""")
            check('D1 knop: SCHERM: LIGGEND draait het spel een kwartslag en vult het scherm', k0 == 'SCHERM: VANZELF' and info['knop'] == 'SCHERM: LIGGEND' and 'rotate(90deg)' in info['t'] and info['lig'] and info['r'] == info['i'], info)
            if PLAAT: h.screenshot(path=PLAAT + '/d-menu-liggend.png')
            # spelen in de gedraaide stand: g moet klaar zijn voor OPNIEUW
            g.evaluate("(() => { const s = %s; s.levens = 0; s.einde() })()" % SC)
            kan = wacht(h, "!document.querySelector('.rg .knop').disabled", 6000)
            h.click('.rg .knop')
            wacht(h, "document.querySelector('.rg .laag').hidden", 15000)
            h.wait_for_timeout(800)
            h.evaluate("(() => { const s = %s; s.levens = 99; window.__sp = 0; window.__sc = 0; const a = s.spring.bind(s), b = s.schiet.bind(s); s.spring = () => { window.__sp++; return a() }; s.schiet = () => { window.__sc++; return b() } })()" % SC)
            h.touchscreen.tap(200, 150)
            h.wait_for_timeout(200)
            h.touchscreen.tap(200, 700)
            h.wait_for_timeout(200)
            sp, sc = h.evaluate('window.__sp'), h.evaluate('window.__sc')
            if PLAAT: h.screenshot(path=PLAAT + '/d-spel-liggend.png')
            check('D2 gedraaid spelen: tik bovenin = springen, onderin = schieten', sp == 1 and sc == 1, (sp, sc))
            h.evaluate("(() => { const s = %s; s.levens = 0; s.einde() })()" % SC)
            h.wait_for_timeout(300)
            h.click('.rg .standKnop'); h.click('.rg .standKnop')
            h.wait_for_timeout(300)
            t3 = h.evaluate("[document.querySelector('.rg').style.transform, document.querySelector('.rg .standKnop').textContent, localStorage.getItem('rg-stand')]")
            check('D3 RECHTOP en weer VANZELF: niet gedraaid, keuze onthouden', t3[0] == '' and t3[1] == 'SCHERM: VANZELF' and t3[2] == 'vanzelf', t3)
        except Exception as e:
            check('proef afgebroken', False, str(e).split(chr(10))[0])
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef221: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
