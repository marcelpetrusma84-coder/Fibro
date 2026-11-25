# proef339 (25 nov 2026, Marcel): Eenendertigen (uit Stekky Studio) echt spelen.
#  A. met z'n tweeën (nagemaakt spelkanaal, zoals proef301): allebei 3 kaarten, dezelfde 3 kaarten op tafel; speler 1 is aan de beurt
#  B. ruilen: kaart kiezen + tik op een tafelkaart: de kaarten wisselen, ook bij de ander; kloppen kan nog niet
#  C. speler 2 ruilt alles; daarna mag speler 1 kloppen; speler 2 ziet "klopt!" en mag nog één keer ruilen
#  D. de ronde is klaar: bij allebei dezelfde levens eraf; speler 1 deelt vanzelf ronde 2
#  E. ❓ opent de spelregels; E2 (v3) passen: past iedereen, dan 3 nieuwe tafelkaarten bij allebei
#  F. tegen de computer (spel.html): niveau kiezen, 1 computer kiezen, ruilen, de computer zet terug
#  G. (v2, 25 nov 2026) met z'n drieën (gastheer + 2 gasten, nagemaakt spelkanaal): de tegenstanders als rondjes, in de
#     rondte aan de beurt, iedereen ziet dezelfde tafel; een gast speelt via de gastheer
#  H. tegen 3 computers: drie rondjes, de computers spelen om de beurt; geen paginafouten
# python3 -I proef339.py <map>
import functools, http.server, json, os, re, sys, threading, time
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

class FibroHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path): return super().translate_path(path.removeprefix('/Fibro'))
    def log_message(self, *args): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(FibroHandler, directory=MAP))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASIS = 'http://127.0.0.1:%d/Fibro/' % srv.server_port
fouten = []
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].map(k => k.dataset.id)"
TAFEL = "() => [...document.querySelectorAll('.eed-tk')].map(k => k.dataset.id)"
KANAAL = """(ik, naam) => {
    const bc = new BroadcastChannel(naam), lui = {}
    bc.onmessage = e => { if (e.data.van !== ik) for (const f of (lui[e.data.event] || [])) f({ payload: e.data.payload }) }
    return { on(_, f, fn) { (lui[f.event] = lui[f.event] || []).push(fn); return this }, send(m) { bc.postMessage({ van: ik, event: m.event, payload: m.payload }); return Promise.resolve('ok') } }
}"""
def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def knop(pg, naam): return pg.locator('.kt-knoppen button[data-naam="%s"]' % naam)
def kies(pg, id):
    x, y = pg.eval_on_selector('.kt-hand .kt-kaart[data-id="%s"]' % id, """e => { const r = e.getBoundingClientRect()
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8, 0.9]) for (let fx = 0.08; fx < 0.95; fx += 0.08) { const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y); if (raak && raak.closest('.kt-kaart') === e) return [x, y] }
        return [r.left + r.width / 2, r.top + r.height / 2] }""")
    pg.mouse.click(x, y); time.sleep(0.15)
def speler(ctx, nr, groep=None, kanaal='eed339'):
    q = ctx.new_page()
    q.on('pageerror', lambda e: fouten.append('speler %d: %s' % (nr, str(e)[:300])))
    q.goto(BASIS + 'manifest.json')
    q.evaluate("localStorage.setItem('fibro_taal', 'nl')")
    q.evaluate("""async ([nr, maak, groep, kn]) => {
        document.body.innerHTML = '<div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud" style="position:fixed;inset:0"></div></div>'
        await import('./taal.js').catch(() => {})
        const m = await import('./eenendertigen-ui.js?v=1')
        m.start({ spelKanaal: (0, eval)('(' + maak + ')')(nr, kn), benIkSpeler1: nr === 1, vriendNaam: nr === 1 ? 'Tijn' : 'Marcel', spelers: groep, mijnZetel: nr })
    }""", [nr, KANAAL, groep, kanaal])
    return q
def ruil(pg):
    h, t = pg.evaluate(HAND)[0], pg.evaluate(TAFEL)[0]
    kies(pg, h); pg.click('.eed-tk[data-id="%s"]' % t)
    return h, t

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        ctx = browser.new_context(viewport={'width': 420, 'height': 860}, service_workers='block')
        een = speler(ctx, 1); twee = speler(ctx, 2)
        MIJN = "() => !!document.querySelector('.kt-knoppen button[data-naam=alles]') && " + RUST

        # ── A ──
        check(wacht(een, MIJN) and wacht(twee, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 3 && document.querySelectorAll('.eed-tk').length === 3 && " + RUST),
              'A allebei 3 kaarten, 3 op tafel; speler 1 is aan de beurt')
        h1, h2 = een.evaluate(HAND), twee.evaluate(HAND)
        check(len(set(h1 + h2)) == 6 and een.evaluate(TAFEL) == twee.evaluate(TAFEL), 'A niemand dezelfde kaarten, dezelfde tafel')
        check(twee.locator('.kt-knoppen button[data-naam=alles]').count() == 0 and 'Wachten op Marcel' in twee.inner_text('.kt-status'), 'A speler 2 wacht')
        check('🎲' in een.inner_text('#spelTitelBar') and 'Eenendertigen' in een.inner_text('#spelTitelBar'), 'A de naam in de titelbalk')

        # ── B ──
        check(knop(een, 'klop').is_disabled(), 'B kloppen kan nog niet in de eerste beurt')
        h, t = ruil(een)
        check(wacht(een, "() => (%s)().includes('%s') && (%s)().includes('%s')" % (HAND, t, TAFEL, h), 5000), 'B geruild: %s <-> %s' % (h, t))
        check(wacht(twee, "() => (%s)().includes('%s') && !(%s)().includes('%s')" % (TAFEL, h, TAFEL, t), 8000), 'B de ander ziet de nieuwe tafel')

        # ── C ──
        check(wacht(twee, MIJN, 10000), 'C speler 2 is aan de beurt')
        oudeTafel, oudeHand = twee.evaluate(TAFEL), twee.evaluate(HAND)
        knop(twee, 'alles').click()
        check(wacht(twee, "() => JSON.stringify((%s)().sort()) === '%s'" % (HAND, json.dumps(sorted(oudeTafel), separators=(',', ':'))), 5000), 'C alle 3 geruild')
        check(wacht(een, MIJN, 10000) and wacht(een, "() => !document.querySelector('.kt-knoppen button[data-naam=klop]').disabled", 5000), 'C nu mag speler 1 kloppen')
        knop(een, 'klop').click()
        check(wacht(twee, "() => document.querySelector('.eed-midden').innerText.includes('Marcel klopt') && !!document.querySelector('.kt-knoppen button[data-naam=alles]')", 10000)
              and twee.locator('.kt-knoppen button[data-naam=klop]').count() == 0, 'C speler 2 ziet "klopt!" en mag nog één keer (zonder kloppen)')
        check('nog één keer' in twee.inner_text('.kt-status'), 'C de status zegt het')

        # ── D ──
        ruil(twee)
        LEVENS = "() => (document.querySelector('.eed-midden').innerText.match(/🤍/g) || []).length"
        check(wacht(een, LEVENS + " >= 1", 10000) and wacht(twee, LEVENS + " >= 1", 10000), 'D de ronde is klaar: er is een leven af')
        check(wacht(een, "() => document.querySelector('.eed-midden').innerText.includes('Ronde 2')", 12000) and wacht(twee, "() => document.querySelector('.eed-midden').innerText.includes('Ronde 2')", 12000), 'D speler 1 deelt vanzelf ronde 2')
        check(een.evaluate(LEVENS) == twee.evaluate(LEVENS), 'D bij allebei dezelfde levens (%s)' % een.evaluate(LEVENS))

        # ── E ──
        knop(een, 'uitleg').click()
        check(wacht(een, "() => (document.querySelector('.eed-regels') || {}).innerText?.includes('30½')", 3000), 'E ❓ = de spelregels')
        een.click('.eed-regels button')
        check(een.locator('.eed-regels').count() == 0, 'E en weer dicht')

        # ── E2. passen (v3): past iedereen, dan 3 nieuwe tafelkaarten ──
        check(wacht(een, MIJN, 6000) or wacht(twee, MIJN, 6000), 'E2 iemand is aan de beurt in ronde 2')
        eerst, dan = (een, twee) if een.evaluate("() => !!document.querySelector('.kt-knoppen button[data-naam=alles]')") else (twee, een)
        oudeTafel = sorted(eerst.evaluate(TAFEL))
        check(knop(eerst, 'pas').count() == 1, 'E2 er is een knop Passen')
        knop(eerst, 'pas').click()
        check(wacht(dan, MIJN, 8000), 'E2 gepast: de ander is aan de beurt')
        check(sorted(dan.evaluate(TAFEL)) == oudeTafel, 'E2 één keer passen: de tafel blijft')
        knop(dan, 'pas').click()
        NIEUW = "() => { const t = (%s)(); return t.length === 3 && !t.some(k => %s.includes(k)) }" % (TAFEL, json.dumps(oudeTafel))
        check(wacht(een, NIEUW, 8000) and wacht(twee, NIEUW, 8000), 'E2 iedereen paste: bij allebei 3 nieuwe tafelkaarten')
        check(wacht(eerst, MIJN, 8000), 'E2 en de eerste is weer aan de beurt')
        ctx.close()

        # ── F. tegen de computer ──
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=200, json=[]))
        ctx.add_init_script("try{localStorage.setItem('fibro_taal','nl')}catch(e){}")
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append('solo: ' + str(e)[:200]))
        pg.goto(BASIS + 'spel.html?spel=eenendertigen&titel=1')
        check(wacht(pg, "() => document.querySelectorAll('.niveau-btn[data-niveau]').length === 3", 10000), 'F drie niveaus')
        pg.click('.niveau-btn[data-niveau=normaal]')
        check(wacht(pg, "() => (document.querySelector('.kt-keuze') || {}).innerText?.includes('Tegen hoeveel computers')", 8000), 'F kiezen: tegen hoeveel computers')
        pg.click('.kt-keuze button[aria-label="1"]')
        check(wacht(pg, MIJN, 15000), 'F jij bent aan de beurt')
        h, t = ruil(pg)
        check(wacht(pg, "() => (%s)().includes('%s')" % (HAND, t), 5000), 'F geruild')
        # Soms heeft iemand meteen 31: dan is de ronde klaar en begint de computer ronde 2 (kloppen mag dan nog niet)
        RONDE2 = "document.querySelector('.eed-midden').innerText.includes('Ronde 2')"
        check(wacht(pg, "() => /computer|Computer/.test(document.querySelector('.kt-status').innerText) || !!document.querySelector('.kt-knoppen button[data-naam=alles]') || " + RONDE2, 8000), 'F de computer is aan de beurt')
        check(wacht(pg, MIJN + " && (!document.querySelector('.kt-knoppen button[data-naam=klop]').disabled || " + RONDE2 + ")", 20000), 'F de computer zette terug; nu mag jij kloppen (of ronde 2 na een 31)')
        ctx.close()

        # ── G. met z'n drieën ──
        ctx = browser.new_context(viewport={'width': 420, 'height': 860}, service_workers='block')
        groep = [{'naam': 'Marcel'}, {'naam': 'Tijn'}, {'naam': 'Bram'}]
        drie = [speler(ctx, n, groep, 'eed339g') for n in (1, 2, 3)]
        RONDJES = "() => [...document.querySelectorAll('.kt-tz')].map(z => z.querySelector('.kt-tz-naam').textContent)"
        check(all(wacht(q, "() => document.querySelectorAll('.kt-tz').length === 2 && document.querySelectorAll('.kt-hand .kt-kaart').length === 3 && " + RUST, 15000) for q in drie),
              'G iedereen: 3 kaarten en de 2 anderen als rondjes')
        check(drie[0].evaluate(RONDJES) == ['Tijn', 'Bram'] and drie[1].evaluate(RONDJES) == ['Bram', 'Marcel'] and drie[2].evaluate(RONDJES) == ['Marcel', 'Tijn'], 'G de anderen in de rondte, te beginnen na jou')
        time.sleep(1)
        tafels = [q.evaluate(TAFEL) for q in drie]
        check(tafels[0] == tafels[1] == tafels[2], 'G iedereen dezelfde tafel (%s)' % tafels)
        handen = [tuple(q.evaluate(HAND)) for q in drie]
        check(len(set(sum(map(list, handen), []))) == 9, 'G niemand dezelfde kaarten')
        check(wacht(drie[0], MIJN) and wacht(drie[1], "() => document.querySelector('.kt-status').innerText.includes('Marcel is aan de beurt')", 5000), 'G Marcel begint; de anderen zien wie er aan de beurt is (%s)' % drie[1].inner_text('.kt-status'))
        check(drie[1].locator('.kt-tz[data-zetel="1"].kt-beurt').count() == 1, 'G het rondje van wie aan de beurt is licht op')
        ruil(drie[0])
        check(wacht(drie[1], MIJN, 10000), 'G daarna Tijn')
        h, t = ruil(drie[1])
        check(wacht(drie[1], "() => (%s)().includes('%s')" % (HAND, t), 8000) and wacht(drie[2], "() => (%s)().includes('%s')" % (TAFEL, h), 8000), 'G Tijn ruilt via de gastheer; Bram ziet de nieuwe tafel')
        check(wacht(drie[2], MIJN, 10000), 'G daarna Bram')
        ctx.close()

        # ── H. tegen 3 computers ──
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=200, json=[]))
        ctx.add_init_script("try{localStorage.setItem('fibro_taal','nl')}catch(e){}")
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append('solo3: ' + str(e)[:200]))
        pg.goto(BASIS + 'spel.html?spel=eenendertigen&titel=1')
        wacht(pg, "() => document.querySelectorAll('.niveau-btn[data-niveau]').length === 3", 10000)
        pg.click('.niveau-btn[data-niveau=makkelijk]')
        wacht(pg, "() => !!document.querySelector('.kt-keuze button[aria-label=\"3\"]')", 8000)
        pg.click('.kt-keuze button[aria-label="3"]')
        check(wacht(pg, "() => document.querySelectorAll('.kt-tz').length === 3", 10000) and pg.evaluate(RONDJES) == ['Computer 1', 'Computer 2', 'Computer 3'], 'H drie computers als rondjes')
        check(wacht(pg, MIJN, 15000), 'H jij begint')
        ruil(pg)
        check(wacht(pg, "() => !!document.querySelector('.kt-tz[data-zetel=\"2\"].kt-beurt')", 5000), 'H dan Computer 1')
        check(wacht(pg, MIJN, 15000), 'H de drie computers speelden om de beurt; dan weer jij')
        pg.screenshot(path='/tmp/eed-vier.png')
        ctx.close()
        check(not fouten, 'H geen paginafouten (%s)' % fouten[:3])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    srv.shutdown()
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
