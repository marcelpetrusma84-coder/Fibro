# proef290 (11 nov 2026): Pesten, het eerste kaartspel op de blauwdruk voor kaartspellen (kaartspel-hulp.js).
# Speelt echt tegen de computer in spel.html?spel=pesten, op een telefoonscherm.
#  A. delen: 7 kaarten in je waaier, 7 bij de computer, 1 open kaart; geen paginafouten
#  B. tik op een kaart = hij komt groot naar voren (kt-gekozen); nog eens tikken = terug
#  C. veeg een kaart die past omhoog = hij ligt bovenop de aflegstapel en is weg uit je hand
#  D. veeg een kaart die NIET past omhoog = hij blijft in je hand
#  E. de computer speelt terug, daarna ben jij weer aan de beurt
#  F. tik op de stapel = 1 kaart erbij; veeg vanaf de stapel = ook 1 kaart erbij (een andere animatie)
#  G. sorteren (⇅), een reactie (😀 > emoji vliegt over tafel), de beurtklok rond je rondje en rond het webcamrondje
#  H. een heel spel uitspelen tot er een winnaar is, en Opnieuw spelen deelt opnieuw
#  I. met z'n tweeën (twee schermen, een nagemaakt spelkanaal): speler 1 deelt, speler 2 ziet dezelfde open kaart;
#     een zet van de een komt bij de ander aan; daar komt de kaart uit de waaier van de ander
# python3 -I proef290.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef290_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].sort((a, b) => a.dataset.plek - b.dataset.plek).map(k => k.dataset.id)"
TOP = "() => { const a = document.querySelectorAll('.kt-afleg .kt-ak'); return a.length ? a[a.length - 1].dataset.id : null }"
ANDER = "() => parseInt(document.querySelector('.kt-anderaantal').textContent) || 0"
MIJN_BEURT = "() => !document.querySelector('.kt-einde') && !!document.querySelector('.kt-tafel.kt-mijnbeurt') && !document.querySelector('.kt-laag .kt-vlieg')"

def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
# Een punt waar je de kaart echt raakt (in de waaier ligt de volgende kaart er half overheen)
def midden(pg, sel):
    return pg.eval_on_selector(sel, """e => { const r = e.getBoundingClientRect()
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) for (let fx = 0.08; fx < 0.95; fx += 0.08) {
            const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y)
            if (raak && (raak === e || e.contains(raak))) return [x, y] }
        return [r.left + r.width / 2, r.top + r.height / 2] }""")
def veeg(pg, x, y, dx, dy, stappen=8):
    pg.mouse.move(x, y); pg.mouse.down()
    for i in range(1, stappen + 1): pg.mouse.move(x + dx * i / stappen, y + dy * i / stappen); time.sleep(0.012)
    pg.mouse.up()
def kaart(pg, id): return '.kt-hand .kt-kaart[data-id="%s"]' % id
def speelbaar(pg): return pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart.kt-mag')].map(k => k.dataset.id)")
def nietSpeelbaar(pg): return pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart.kt-niet')].map(k => k.dataset.id)")

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True)
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append((str(e) + ' ' + str(getattr(e, 'stack', '') or ''))[:400])); pg.on('dialog', lambda d: d.dismiss())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("() => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_solo_niveau_pesten', 'makkelijk') }")
        pg.goto(BASIS + 'spel.html?spel=pesten&titel=1')
        pg.wait_for_selector('.niveau-btn[data-niveau=makkelijk]', timeout=10000)
        # Webcamrondjes zoals in chat.html, om de beurtklok daar te zien
        pg.evaluate("() => { for (const id of ['spelVideoAnder', 'spelVideoEigen']) { const d = document.createElement('div'); d.id = id; d.className = 'spel-video-vak'; document.body.appendChild(d) } }")
        pg.click('.niveau-btn[data-niveau=makkelijk]')
        # ── A ──
        check(wacht(pg, MIJN_BEURT), 'A: na het delen ben jij aan de beurt')
        check(len(pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart:not(.kt-weg)')]")) == 7, 'A: 7 kaarten in je waaier')
        check(pg.evaluate(ANDER) == 7, 'A: de computer heeft 7 kaarten')
        check(pg.evaluate(TOP) is not None, 'A: er ligt een open kaart')
        check(pg.evaluate("() => document.querySelectorAll('.kt-hand .kt-kaart svg').length === 7"), 'A: de kaarten zijn vectorplaatjes (svg)')
        # ── B ──
        eerste = pg.evaluate(HAND)[0]
        pg.click(kaart(pg, eerste))
        check(wacht(pg, "() => document.querySelector('%s').classList.contains('kt-gekozen')" % kaart(pg, eerste), 2000), 'B: tik = de kaart komt groot naar voren')
        groot = pg.eval_on_selector(kaart(pg, eerste), "e => e.getBoundingClientRect().width")
        check(groot > 90, 'B: en is groter (%d px breed)' % groot)
        pg.click(kaart(pg, eerste))
        check(wacht(pg, "() => !document.querySelector('%s').classList.contains('kt-gekozen')" % kaart(pg, eerste), 2000), 'B: nog eens tikken = terug in de waaier')
        # ── D (eerst: een kaart die niet past) ──
        niet = nietSpeelbaar(pg)
        if niet:
            x, y = midden(pg, kaart(pg, niet[0]))
            veeg(pg, x, y, 0, -200)
            pg.wait_for_timeout(500)
            check(niet[0] in pg.evaluate(HAND), 'D: een kaart die niet past blijft in je hand')
        else: print('     (D overgeslagen: alle kaarten passen)')
        # ── C ──
        mag = speelbaar(pg)
        if mag:
            id = mag[0]; x, y = midden(pg, kaart(pg, id))
            veeg(pg, x, y, 30, -220)
            if wacht(pg, "() => !!document.querySelector('.kt-keuze')", 800): pg.click('.kt-keuzerij button >> nth=0')   # een boer: kleur kiezen
            check(wacht(pg, "() => { const a = document.querySelectorAll('.kt-afleg .kt-ak'); return a.length && a[a.length-1].dataset.id === '%s' && !document.querySelector('.kt-laag .kt-vlieg') }" % id, 5000), 'C: omhoog geveegd = bovenop de aflegstapel (' + id + ')')
            check(id not in pg.evaluate(HAND), 'C: en weg uit je hand')
        else:
            pg.click('.kt-stapel'); pg.wait_for_timeout(1200)
            if pg.query_selector('.kt-knop[data-naam=pas]'): pg.click('.kt-knop[data-naam=pas]')
            print('     (C overgeslagen: niets paste, gepakt)')
        # ── E ──
        check(wacht(pg, MIJN_BEURT, 20000), 'E: de computer speelde terug en jij bent weer aan de beurt')
        # ── F: tik op de stapel ──
        voor = len(pg.evaluate(HAND))
        pg.click('.kt-stapel')
        check(wacht(pg, "() => document.querySelectorAll('.kt-hand .kt-kaart').length >= %d && !document.querySelector('.kt-laag .kt-vlieg')" % (voor + 1), 6000), 'F: tik op de stapel = een kaart erbij')
        # passen of spelen, dan weer wachten
        if pg.query_selector('.kt-knop[data-naam=pas]'): pg.click('.kt-knop[data-naam=pas]')
        check(wacht(pg, MIJN_BEURT, 20000), 'F: weer aan de beurt')
        voor = len(pg.evaluate(HAND))
        x, y = midden(pg, '.kt-stapel')
        pg.mouse.move(x, y); pg.mouse.down()
        for i in range(1, 9): pg.mouse.move(x + 6 * i, y + 30 * i); time.sleep(0.02)
        gesleept = pg.evaluate("() => document.querySelectorAll('.kt-laag .kt-vlieg').length")
        pg.mouse.up()
        check(gesleept == 1, 'F: vegen vanaf de stapel: de kaart gaat met je vinger mee')
        check(wacht(pg, "() => document.querySelectorAll('.kt-hand .kt-kaart').length >= %d && !document.querySelector('.kt-laag .kt-vlieg')" % (voor + 1), 6000), 'F: veeg vanaf de stapel = ook een kaart erbij')
        # ── G ──
        pg.click('.kt-sorteer'); pg.wait_for_timeout(300)
        h = pg.evaluate(HAND)
        kleuren = [k[0] for k in h if not k.startswith('J')]
        check(kleuren == sorted(kleuren, key=lambda k: 'hkrs'.index(k)), 'G: ⇅ sorteert op kleur (%s)' % ' '.join(h))
        pg.click('.kt-reactieknop'); pg.click('.kt-reacties button >> nth=2')
        check(wacht(pg, "() => [...document.querySelectorAll('.kt-reactie')].some(e => e.textContent === '🔥')", 2000), 'G: een reactie vliegt over tafel')
        check(pg.evaluate("() => document.querySelector('.kt-zetel-ik .kt-klok').classList.contains('kt-aan')"), 'G: de beurtklok loopt rond jouw rondje')
        check(pg.evaluate("() => !!document.querySelector('#spelVideoEigen > .kt-klok.kt-aan')"), 'G: en rond je webcamrondje')
        # ── H: uitspelen ──
        if pg.query_selector('.kt-knop[data-naam=pas]'): pg.click('.kt-knop[data-naam=pas]')
        einde = False
        for beurt in range(150):
            if pg.query_selector('.kt-einde'): einde = True; break
            if not wacht(pg, "() => document.querySelector('.kt-einde') || (%s)()" % MIJN_BEURT, 20000): break
            if pg.query_selector('.kt-einde'): einde = True; break
            if pg.query_selector('.kt-anderknop .kt-knop'): pg.click('.kt-anderknop .kt-knop', force=True); pg.wait_for_timeout(900); continue
            if pg.query_selector('.kt-knop[data-naam=roep]'): pg.click('.kt-knop[data-naam=roep]', force=True); pg.wait_for_timeout(300)
            mag = speelbaar(pg)
            if mag:
                x, y = midden(pg, kaart(pg, mag[0])); veeg(pg, x, y, 0, -220)
                if wacht(pg, "() => !!document.querySelector('.kt-keuze')", 700): pg.click('.kt-keuzerij button >> nth=0')
            elif pg.query_selector('.kt-knop[data-naam=pas]'): pg.click('.kt-knop[data-naam=pas]')
            else: pg.click('.kt-stapel')
            pg.wait_for_timeout(700)
        print('     na', beurt, 'beurten:', len(pg.evaluate(HAND)), 'tegen', pg.evaluate(ANDER), '·', pg.inner_text('.kt-status'))
        check(einde, 'H: het spel is uitgespeeld (er is een winnaar)')
        if einde:
            tekst = pg.inner_text('.kt-einde')
            check('wint' in tekst and 'Stand' in tekst, 'H: winnaar en stand in beeld')
            pg.click('.kt-opnieuw')
            check(wacht(pg, "() => !document.querySelector('.kt-einde') && document.querySelectorAll('.kt-hand .kt-kaart:not(.kt-weg)').length === 7 && !document.querySelector('.kt-laag .kt-vlieg')", 10000), 'H: Opnieuw spelen deelt opnieuw 7 kaarten')

        # ── I: met z'n tweeën ──
        KANAAL = """(ik) => {
            const bc = new BroadcastChannel('proef290'), lui = {}
            bc.onmessage = e => { if (e.data.van !== ik) for (const f of (lui[e.data.event] || [])) f({ payload: e.data.payload }) }
            return { on(_, f, fn) { (lui[f.event] = lui[f.event] || []).push(fn); return this }, send(m) { bc.postMessage({ van: ik, event: m.event, payload: m.payload }); return Promise.resolve('ok') } }
        }"""
        def speler(nr):
            q = ctx.new_page()
            q.on('pageerror', lambda e: fouten.append('speler %d: %s' % (nr, str(e)[:200])))
            q.goto(BASIS + 'manifest.json')
            q.evaluate("""async ([nr, maak]) => {
                document.body.innerHTML = '<div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud" style="position:fixed;inset:0"></div></div>'
                const m = await import('./pesten-ui.js?v=1')
                const kanaal = (0, eval)('(' + maak + ')')(nr)
                m.start({ spelKanaal: kanaal, benIkSpeler1: nr === 1, vriendNaam: nr === 1 ? 'Tijn' : 'Marcel' })
            }""", [nr, KANAAL])
            return q
        twee = speler(2)
        een = speler(1)
        klaar = "() => !document.querySelector('.kt-laag .kt-vlieg') && document.querySelectorAll('.kt-hand .kt-kaart:not(.kt-weg)').length === 7 && document.querySelector('.kt-afleg .kt-ak')"
        check(wacht(een, klaar) and wacht(twee, klaar), 'I: allebei 7 kaarten na het delen door speler 1')
        check(een.evaluate(TOP) == twee.evaluate(TOP), 'I: dezelfde open kaart (%s)' % een.evaluate(TOP))
        check(not set(een.evaluate(HAND)) & set(twee.evaluate(HAND)), 'I: niemand heeft dezelfde kaart als de ander')
        check(wacht(een, MIJN_BEURT) and not twee.evaluate("() => !!document.querySelector('.kt-tafel.kt-mijnbeurt')"), 'I: speler 1 begint, speler 2 wacht')
        mag = speelbaar(een)
        if mag:
            x, y = midden(een, kaart(een, mag[0])); veeg(een, x, y, 0, -220)
            if wacht(een, "() => !!document.querySelector('.kt-keuze')", 700): een.click('.kt-keuzerij button >> nth=1')
            check(wacht(twee, "() => { const a = document.querySelectorAll('.kt-afleg .kt-ak'); return a.length && a[a.length-1].dataset.id === '%s' && !document.querySelector('.kt-laag .kt-vlieg') }" % mag[0], 8000), 'I: de zet van speler 1 komt aan bij speler 2 (' + mag[0] + ')')
            check(twee.evaluate(ANDER) == 6, 'I: bij speler 2 heeft de ander nu 6 kaarten')
        else:
            een.click('.kt-stapel')
            check(wacht(twee, "() => parseInt(document.querySelector('.kt-anderaantal').textContent) === 8", 8000), 'I: speler 1 pakt, speler 2 ziet 8 kaarten bij de ander')
        een.close(); twee.close()
        check(not fouten, 'geen paginafouten (%s)' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\n%d fout(en)' % len(fout) if fout else '\nAlles goed')
sys.exit(1 if fout else 0)
