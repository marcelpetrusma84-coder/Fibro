# proef356 (27 nov 2026, Marcel): de sjablonen voor nieuwe spellen werken echt.
#  A. kaartspel (sjabloon-kaartspel-ui.js) met z'n drieën in de groep: iedereen 5 kaarten en de 2 anderen als rondjes;
#     Marcel begint; om de beurt een kaart leggen (dubbeltik); na de slag zien alle drie "Slag 2 van 5" en 1 slag bij
#     de winnaar
#  B. automaat (sjabloon-automaat-ui.js): zonder tokens; Hoger raden geeft een uitslag, dan een nieuwe kaart
#  C. arcade (sjabloon-arcade-ui.js): tik om te beginnen, de score loopt op, en als je geraakt wordt: game over en
#     solo.nieuweScore krijgt je score (voor je record en het scorebord)
#  D. geen paginafouten
# Op de oude versie mislukt alles (er waren alleen sjablonen voor een beurtspel).
# python3 -I proef356.py <map>
import sys, os, json, functools, http.server, threading
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, p): return super().translate_path(p.removeprefix('/Fibro'))
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=MAP)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASIS = 'http://127.0.0.1:%d/Fibro/' % srv.server_port
fouten = []
def wacht(pg, js, ms=12000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].map(k => k.dataset.id)"
MIDDEN = "() => document.querySelector('.sjk-midden')?.innerText.replace(/\\s+/g, ' ') || ''"
KANAAL = """(ik, naam) => {
    const bc = new BroadcastChannel(naam), lui = {}
    bc.onmessage = e => { if (e.data.van !== ik) for (const f of (lui[e.data.event] || [])) f({ payload: e.data.payload }) }
    return { on(_, f, fn) { (lui[f.event] = lui[f.event] || []).push(fn); return this }, send(m) { bc.postMessage({ van: ik, event: m.event, payload: m.payload }); return Promise.resolve('ok') } }
}"""
def leeg(ctx, wie):
    q = ctx.new_page(); q.on('pageerror', lambda e: fouten.append(wie + ': ' + str(e)[:300]))
    q.goto(BASIS + 'manifest.json'); q.evaluate("localStorage.setItem('fibro_taal', 'nl')")
    q.evaluate("() => { document.body.innerHTML = '<div id=\"spelOverlay\"><div id=\"spelTitelBar\"></div><div id=\"spelInhoud\" style=\"position:fixed;inset:0\"></div></div>' }")
    return q
def speler(ctx, nr, groep):
    q = leeg(ctx, 'speler %d' % nr)
    q.evaluate("""async ([nr, maak, groep]) => { await import('./taal.js').catch(() => {})
        const m = await import('./sjabloon-kaartspel-ui.js?v=1')
        m.start({ spelKanaal: (0, eval)('(' + maak + ')')(nr, 'sj356'), benIkSpeler1: nr === 1, vriendNaam: 'x', spelers: groep, mijnZetel: nr }) }""", [nr, KANAAL, groep])
    return q
def leg(q):
    """dubbeltik op de eerste kaart van je hand"""
    id = q.evaluate(HAND)[0]
    x, y = q.eval_on_selector('.kt-hand .kt-kaart[data-id="%s"]' % id, """e => { const r = e.getBoundingClientRect()
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) for (let fx = 0.08; fx < 0.95; fx += 0.08) { const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y); if (raak && raak.closest('.kt-kaart') === e) return [x, y] }
        return [r.left + r.width / 2, r.top + r.height / 2] }""")
    q.mouse.click(x, y); q.wait_for_timeout(150); q.mouse.click(x, y)
    return id
aan_beurt = lambda q: 'Leg een kaart' in (q.evaluate("() => document.querySelector('.kt-status')?.textContent || ''"))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        # ── A ──
        ctx = b.new_context(viewport={'width': 420, 'height': 860}, service_workers='block')
        groep = [{'naam': 'Marcel'}, {'naam': 'Tijn'}, {'naam': 'Bram'}]
        drie = [speler(ctx, n, groep) for n in (1, 2, 3)]
        check(all(wacht(q, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 5 && document.querySelectorAll('.kt-tz').length === 2 && " + RUST, 15000) for q in drie),
              'A iedereen 5 kaarten en de 2 anderen als rondjes')
        check(len(set(sum([q.evaluate(HAND) for q in drie], []))) == 15, 'A niemand dezelfde kaarten')
        check(wacht(drie[0], "() => (document.querySelector('.kt-status')?.textContent || '').includes('Leg een kaart')", 6000) and not aan_beurt(drie[1]), 'A Marcel begint')
        gelegd = []
        for i, q in enumerate(drie):
            check(wacht(q, "() => (document.querySelector('.kt-status')?.textContent || '').includes('Leg een kaart') && " + RUST, 8000), 'A %s is aan de beurt' % groep[i]['naam'])
            gelegd.append(leg(q))
            q.wait_for_timeout(500)
        check(all(wacht(q, "() => (%s)().includes('Slag 2 van 5')" % MIDDEN, 10000) for q in drie), 'A na de slag zien alle drie: Slag 2 van 5')
        tellen = [q.evaluate("() => [...document.querySelectorAll('.kt-tz-info')].map(e => e.textContent).join('|') + '|' + (document.querySelector('.sjk-midden .sjk-pil')?.textContent || '')") for q in drie]
        check(all(t.count('1 slag') == 1 for t in tellen), 'A precies één speler heeft 1 slag (%s)' % tellen)
        check(all(len(q.evaluate(HAND)) == 4 for q in drie), 'A iedereen nog 4 kaarten')
        ctx.close()
        # ── B ── de automaat
        ctx = b.new_context(viewport={'width': 400, 'height': 800}, service_workers='block')
        q = leeg(ctx, 'automaat')
        q.evaluate("async () => { await import('./taal.js').catch(() => {}); (await import('./sjabloon-automaat-ui.js?v=1')).start() }")
        check(wacht(q, "() => (document.querySelector('.sja-saldo')?.textContent || '') === 'Zonder tokens' && !!document.querySelector('.sja-nu svg, .sja-nu img')", 8000), 'B de automaat: zonder tokens, een open kaart')
        q.click('.sja-knop[data-naam=hoger]')
        check(wacht(q, "() => /Goed geraden|Dezelfde waarde|Helaas/.test(document.querySelector('.sja-melding').textContent) && document.querySelector('.sja-knop[data-naam=hoger]').textContent === 'Nieuwe kaart'", 5000),
              'B Hoger raden geeft een uitslag (%s)' % q.evaluate("() => document.querySelector('.sja-melding').textContent"))
        q.click('.sja-knop[data-naam=hoger]')
        check(wacht(q, "() => document.querySelector('.sja-knop[data-naam=hoger]').textContent.includes('Hoger')", 3000), 'B en dan een nieuwe kaart')
        ctx.close()
        # ── C ── arcade
        ctx = b.new_context(viewport={'width': 400, 'height': 760}, service_workers='block')
        q = leeg(ctx, 'arcade')
        q.evaluate("""async () => { await import('./taal.js').catch(() => {}); window.__scores = []
            const solo = { record: () => 7, nieuweScore: n => { window.__scores.push(n); return n > 7 } }
            ;(await import('./sjabloon-arcade-ui.js?v=1')).start({ solo }) }""")
        check(wacht(q, "() => (document.querySelector('.sjr-sub')?.textContent || '').includes('Record 7')", 6000), 'C het startscherm met je record')
        q.click('.sjr-start')
        check(wacht(q, "() => /Score [1-9]/.test(document.querySelector('.sjr-score').textContent)", 6000), 'C de score loopt op')
        check(wacht(q, "() => window.__scores.length === 1", 90000), 'C geraakt: game over')
        sc = q.evaluate("() => window.__scores")
        check(sc and sc[0] > 0 and 'Score %d' % sc[0] in q.inner_text('.sjr-sub'), 'C solo.nieuweScore kreeg je score (%s)' % sc)
        ctx.close(); b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
check(not fouten, 'D geen paginafouten (%s)' % fouten[:3])
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
