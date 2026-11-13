# proef301 (13 nov 2026): Koningsjacht met z'n tweeën (in de chat, met een nagemaakt spelkanaal).
#  A. speler 2 wacht tot speler 1 kiest; speler 1 kiest 'samen' (Schildknaap)
#  B. samen: allebei 7 kaarten, niemand dezelfde; speler 1 is aan de beurt, speler 2 wacht ('Marcel is aan de beurt')
#  (zoals proef293: speler 1 heet hier Marcel en zijn vriend Tijn)
#  C. speler 1 valt aan: speler 2 ziet dezelfde schade bij de vijand; daarna (afweren of nar) is speler 2 aan de beurt
#  D. speler 2 valt aan: speler 1 ziet het ook
#  E. wedstrijd: allebei hetzelfde kasteel en dezelfde hand; je ziet de stand van de ander ('🏁 Marcel: 0/12');
#     wint de ander (bericht 'voortgang'), dan zie je 'Marcel wint!'
#  F. duel: een vloek van de ander = de vijand krijgt 10 leven erbij (20 -> 30)
#  H. belegering: ieder een eigen kasteel, om de beurt aanvallen en afweren; je ziet je eigen kasteel
#  G. geen paginafouten
# python3 -I proef301.py <map>
import sys, os, time, socket, subprocess, tempfile, re, json
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef301_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
MIJN = "() => !!document.querySelector('.kt-tafel.kt-mijnbeurt') && " + RUST
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].map(k => k.dataset.id).sort()"
LEVEN = "() => (document.querySelector('.kj-balk span') || {}).textContent || ''"
KANAAL = """(ik, naam) => {
    const bc = new BroadcastChannel(naam), lui = {}
    bc.onmessage = e => { if (e.data.van !== ik) for (const f of (lui[e.data.event] || [])) f({ payload: e.data.payload }) }
    return { on(_, f, fn) { (lui[f.event] = lui[f.event] || []).push(fn); return this }, send(m) { bc.postMessage({ van: ik, event: m.event, payload: m.payload }); return Promise.resolve('ok') } }
}"""

def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def waarde(id):
    w = id[1:]
    return 1 if w == 'A' else 10 if w == 'B' else 15 if w == 'V' else 20 if w == 'H' else int(w)
# Een gekozen kaart springt omhoog en wordt groter: dan is van de kaart ernaast soms alleen het onderste stukje
# nog te zien. Daarom ook laag op de kaart zoeken (0.8, 0.9); anders kwam de tik op de gekozen kaart (CI, 13 nov).
def kies(pg, ids):
    for id in ids:
        x, y = pg.eval_on_selector('.kt-hand .kt-kaart[data-id="%s"]' % id, """e => { const r = e.getBoundingClientRect()
            for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8, 0.9]) for (let fx = 0.08; fx < 0.95; fx += 0.08) { const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y); if (raak && e.contains(raak)) return [x, y] }
            return [r.left + r.width / 2, r.top + r.height / 2] }""")
        pg.mouse.click(x, y); time.sleep(0.15)
def speler(ctx, nr, kanaalnaam, bestand):
    q = ctx.new_page()
    q.on('pageerror', lambda e: fouten.append('speler %d: %s' % (nr, str(e)[:300])))
    q.on('dialog', lambda d: d.dismiss())
    q.goto(BASIS + 'manifest.json')
    q.evaluate("localStorage.setItem('fibro_taal', 'nl')")
    q.evaluate("""async ([nr, maak, kn, bestand]) => {
        document.body.innerHTML = '<div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud" style="position:fixed;inset:0"></div></div>'
        const m = await import(bestand)
        // alles wat over het kanaal gaat, ook voor de proef bewaren
        window.__kanaal = new BroadcastChannel(kn); window.__berichten = []; window.__kanaal.onmessage = e => window.__berichten.push(e.data)
        m.start({ spelKanaal: (0, eval)('(' + maak + ')')(nr, kn), benIkSpeler1: nr === 1, vriendNaam: nr === 1 ? 'Tijn' : 'Marcel' })
    }""", [nr, KANAAL, kanaalnaam, bestand])
    return q
# Een beurt: aanvallen met de sterkste losse kaart, dan afweren (of een nar)
def beurt(pg):
    hand = pg.evaluate(HAND)
    beste = max(hand, key=waarde)
    kies(pg, [beste]); pg.click('.kt-knop[data-naam=aanval]')
    wacht(pg, "() => " + RUST + " && !!document.querySelector('.kt-knop[data-naam=afweer], .kt-einde') || (document.querySelector('.kt-status').textContent.includes('aan de beurt'))", 15000)
    return beste
GEKOZEN = "() => [...document.querySelectorAll('.kt-hand .kt-kaart.kt-gekozen')].map(k => k.dataset.id).sort()"
# Kaarten één voor één kiezen, en kijken of het lukte. Op een drukke CI-machine kwam een tweede tik soms op de kaart
# die net omhoog sprong (dan ging die weer uit) en bleef afweren hangen op 0/10.
def kies_zeker(pg, ids):
    for _ in range(3):
        if sorted(pg.evaluate(GEKOZEN)) == sorted(ids): return True
        for id in pg.evaluate(GEKOZEN):   # wat er niet bij hoort eerst uit
            if id not in ids: kies(pg, [id]); wacht(pg, "() => !document.querySelector('.kt-hand .kt-kaart[data-id=\"%s\"].kt-gekozen')" % id, 2000)
        for id in ids:
            if id in pg.evaluate(GEKOZEN): continue
            kies(pg, [id]); wacht(pg, "() => !!document.querySelector('.kt-hand .kt-kaart[data-id=\"%s\"].kt-gekozen')" % id, 2000)
    return sorted(pg.evaluate(GEKOZEN)) == sorted(ids)
def afweren(pg):
    if not pg.query_selector('.kt-knop[data-naam=afweer]'): return
    nodig = int(re.search(r'/(\d+)', pg.text_content('.kt-knop[data-naam=afweer]')).group(1))
    hand = sorted(pg.evaluate(HAND), key=waarde, reverse=True); kies_ = []
    for id in hand:
        if sum(waarde(k) for k in kies_) >= nodig: break
        kies_.append(id)
    if sum(waarde(k) for k in kies_) >= nodig: kies_zeker(pg, kies_); pg.click('.kt-knop[data-naam=afweer]')
    else: pg.click('.kt-knop[data-naam=nar]')

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True, reduced_motion='reduce')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        chat = open(os.path.join(MAP, 'chat.html'), encoding='utf8').read()
        bestand = './' + re.search(r"koningsjacht-ui\.js\?v=\d+", chat).group(0)
        check("spelType === 'koningsjacht'" in chat and "'koningsjacht']" in chat, 'A: Koningsjacht staat in het spelmenu van de chat (%s)' % bestand)

        # ════════ A-D: samen ════════
        twee = speler(ctx, 2, 'kj-samen', bestand); een = speler(ctx, 1, 'kj-samen', bestand)
        check(wacht(twee, "() => (document.querySelector('.kj-wacht') || {}).textContent?.includes('Marcel kiest')", 8000), 'A: speler 2 wacht: "Marcel kiest hoe jullie spelen..." (zijn vriend heet hier Marcel)')
        check(een.locator('.kj-modi .kj-niveau').count() == 4, 'A: speler 1 kiest uit samen, wedstrijd, duel en belegering')
        een.click('.kj-modi .kj-niveau[data-modus=samen]'); een.click('.kj-niveaukeus .kj-niveau[data-niveau=schildknaap]')
        check(wacht(een, MIJN) and wacht(twee, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 7 && " + RUST), 'B: samen: het spel begint bij allebei')
        h1, h2 = een.evaluate(HAND), twee.evaluate(HAND)
        check(len(h1) == 7 and len(h2) == 7 and not set(h1) & set(h2), 'B: elk 7 kaarten, niemand dezelfde')
        check(not twee.evaluate("() => !!document.querySelector('.kt-tafel.kt-mijnbeurt')") and wacht(twee, "() => document.querySelector('.kt-status').textContent.includes('Marcel is aan de beurt')", 6000), 'B: speler 1 begint, speler 2 wacht ("Marcel is aan de beurt")')
        check(een.evaluate(LEVEN) == twee.evaluate(LEVEN) and '20 / 20' in een.evaluate(LEVEN), 'B: allebei dezelfde vijand (%s)' % een.evaluate(LEVEN))
        kaart1 = beurt(een)
        check(wacht(twee, "() => " + RUST + " && document.querySelector('.kj-balk span').textContent === %s" % json.dumps(een.evaluate(LEVEN)), 10000),
              'C: speler 1 valt aan met %s: speler 2 ziet dezelfde schade (%s)' % (kaart1, twee.evaluate(LEVEN)))
        check(twee.evaluate("k => [...document.querySelectorAll('.kt-afleg .kt-ak')].some(e => e.dataset.id === k) || !document.querySelector('.kt-afleg .kt-ak')", kaart1), 'C: en de kaart op tafel')
        # speler 1 maakt zijn beurt af (afweren of een nar; versloeg hij de vijand, dan is hij nog een keer)
        for _ in range(8):
            if wacht(twee, MIJN, 1500): break
            if een.query_selector('.kt-knop[data-naam=afweer]'): afweren(een)
            elif een.evaluate("() => !!document.querySelector('.kt-tafel.kt-mijnbeurt')"): beurt(een)
            wacht(een, "() => " + RUST, 8000); time.sleep(0.8)
        check(wacht(twee, MIJN, 15000), 'C: daarna is speler 2 aan de beurt')
        check(not een.evaluate("() => !!document.querySelector('.kt-tafel.kt-mijnbeurt')") and wacht(een, "() => document.querySelector('.kt-status').textContent.includes('Tijn')", 5000), 'C: speler 1 wacht nu op zijn vriend (Tijn)')
        voor = een.evaluate(LEVEN)
        kaart2 = beurt(twee)
        check(wacht(een, "() => " + RUST + " && document.querySelector('.kj-balk span').textContent === %s" % json.dumps(twee.evaluate(LEVEN)), 10000), 'D: speler 2 valt aan met %s: speler 1 ziet het ook (%s -> %s)' % (kaart2, voor, een.evaluate(LEVEN)))
        een.close(); twee.close()

        # ════════ E: wedstrijd ════════
        twee = speler(ctx, 2, 'kj-race', bestand); een = speler(ctx, 1, 'kj-race', bestand)
        wacht(twee, "() => !!document.querySelector('.kj-wacht')", 8000)
        een.click('.kj-modi .kj-niveau[data-modus=wedstrijd]'); een.click('.kj-niveaukeus .kj-niveau[data-niveau=ridder]')
        check(wacht(een, MIJN) and wacht(twee, MIJN), 'E: wedstrijd: allebei meteen aan de beurt')
        check(een.evaluate(HAND) == twee.evaluate(HAND) and een.evaluate("() => document.querySelector('.kj-kaart').dataset.id") == twee.evaluate("() => document.querySelector('.kj-kaart').dataset.id"),
              'E: hetzelfde kasteel en dezelfde hand (%s)' % een.evaluate(HAND))
        check(wacht(twee, "() => document.querySelector('.kt-info').textContent.includes('🏁 Marcel: 0/12')", 8000), 'E: speler 2 ziet de stand van de ander (🏁 Marcel: 0/12)')
        spel = twee.evaluate("() => { const b = [...window.__berichten].reverse().find(m => m.event === 'voortgang' && m.van === 1); return b && b.payload.spelId }")
        check(bool(spel), 'E: speler 1 stuurt zijn voortgang')
        twee.evaluate("id => window.__kanaal.postMessage({ van: 1, event: 'voortgang', payload: { wie: 1, spelId: id, verslagen: 12, over: 0, leven: 40, klaar: true, gewonnen: true, narren: 0 } })", spel)
        check(wacht(twee, "() => (document.querySelector('.kt-eindetitel') || {}).textContent?.includes('Marcel wint')", 8000), 'E: de ander verslaat alle 12: speler 2 ziet "Marcel wint!"')
        check('12/12' in twee.text_content('.kt-eindesub'), 'E: met de stand (%s)' % twee.text_content('.kt-eindesub'))
        een.close(); twee.close()

        # ════════ F: duel ════════
        twee = speler(ctx, 2, 'kj-duel', bestand); een = speler(ctx, 1, 'kj-duel', bestand)
        wacht(twee, "() => !!document.querySelector('.kj-wacht')", 8000)
        een.click('.kj-modi .kj-niveau[data-modus=duel]'); een.click('.kj-niveaukeus .kj-niveau[data-niveau=ridder]')
        check(wacht(twee, MIJN) and '20 / 20' in twee.evaluate(LEVEN), 'F: duel begint (%s)' % twee.evaluate(LEVEN))
        check('⚔️ Marcel' in twee.text_content('.kt-info'), 'F: duel: "⚔️ Marcel: 0/12"')
        spel = twee.evaluate("() => { const b = [...window.__berichten].reverse().find(m => m.event === 'voortgang' && m.van === 1); return b && b.payload.spelId }")
        twee.evaluate("id => window.__kanaal.postMessage({ van: 1, event: 'vloek', payload: { naar: 2, spelId: id, id: 'proef' } })", spel)
        check(wacht(twee, "() => document.querySelector('.kj-balk span').textContent.includes('30 / 30') && " + RUST, 8000), 'F: een vloek van de ander: de boer heeft nu 30 leven (%s)' % twee.evaluate(LEVEN))
        twee.evaluate("id => window.__kanaal.postMessage({ van: 1, event: 'vloek', payload: { naar: 2, spelId: id, id: 'proef' } })", spel); time.sleep(1)
        check('30 / 30' in twee.evaluate(LEVEN), 'F: dezelfde vloek telt maar één keer')
        een.close(); twee.close()
        # ════════ H: belegering ════════
        twee = speler(ctx, 2, 'kj-beleg', bestand); een = speler(ctx, 1, 'kj-beleg', bestand)
        wacht(twee, "() => !!document.querySelector('.kj-wacht')", 8000)
        check(een.locator('.kj-modi .kj-niveau[data-modus=beleg]').count() == 1, 'H: belegering staat erbij')
        een.click('.kj-modi .kj-niveau[data-modus=beleg]'); een.click('.kj-niveaukeus .kj-niveau[data-niveau=schildknaap]')
        check(wacht(een, MIJN) and wacht(twee, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 8 && " + RUST), 'H: belegering begint: allebei 8 kaarten, speler 1 is aan de beurt')
        check(not twee.evaluate("() => !!document.querySelector('.kt-tafel.kt-mijnbeurt')") and wacht(twee, "() => document.querySelector('.kt-status').textContent.includes('valt jouw kasteel aan')", 6000),
              'H: speler 2 wacht: "Marcel valt jouw kasteel aan..."')
        check(wacht(twee, "() => document.querySelector('.kt-info').textContent.includes('Jouw kasteel: 12')", 6000), 'H: speler 2 ziet zijn eigen kasteel (12 wachters)')
        beurt(een)
        check(wacht(twee, "() => /Jouw kasteel: (12 · ❤ (?!20)|11)/.test(document.querySelector('.kt-info').textContent)", 10000), 'H: speler 1 valt aan: de voorste wachter van speler 2 is geraakt (%s)' % twee.text_content('.kt-info'))
        for _ in range(8):
            if wacht(twee, MIJN, 1500): break
            if een.query_selector('.kt-knop[data-naam=afweer]'): afweren(een)
            wacht(een, "() => " + RUST, 8000); time.sleep(0.8)
        check(wacht(twee, MIJN, 15000), 'H: na zijn klap (afgeweerd of wachter verslagen) is speler 2 aan de beurt')
        check(wacht(een, "() => document.querySelector('.kt-status').textContent.includes('valt jouw kasteel aan')", 6000), 'H: speler 1 wacht nu')
        een.close(); twee.close()
        check(not fouten, 'G: geen paginafouten %s' % fouten[:3])
        b.close()
except Exception as e:
    check(False, 'proef afgebroken: ' + str(e).split('\n')[0])
finally:
    srv.terminate()
print('\n%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
