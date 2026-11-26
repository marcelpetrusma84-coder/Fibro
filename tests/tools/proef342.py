# proef342 (26 nov 2026, Marcel): Mollen meppen, de mini-game in de wachtkamer (mollenmeppen.js).
#  A. de knop "🔨 Mollen meppen terwijl je wacht" zet een raster van 4x4 neer en start een ronde
#  B. er komen mollen; een mol aantikken = een punt (en hij gaat omlaag); tikken op een leeg gat = niets
#  C. na 30 seconden: "Nieuw record", het record wordt onthouden; nog een ronde met minder = geen nieuw record
#  D. haal je het wachtscherm weg, dan stopt het vanzelf
#  E. de wachtkamer van een groepsspel: de knop staat erin; het spelletje blijft lopen als de wachtkamer opnieuw getekend
#     wordt (Tijn doet mee) en stopt als het spel start; geen paginafouten
# Op de oude versie mislukt A (mollenmeppen.js bestond niet).
# python3 -I proef342.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)
www = tempfile.mkdtemp(prefix='proef342_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
def wacht(pg, js, ms=6000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, has_touch=True)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:300]))
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('sb-x-auth-token', JSON.stringify({ user: { id: 'u-marcel' } }))")
        # de klok van het spel zelf bijhouden, zodat de proef niet 30 seconden hoeft te wachten
        pg.evaluate("""async () => {
            document.body.innerHTML = '<div id="wachtscherm"></div>'
            await import('./taal.js').catch(() => {})
            window.__M = await import('./mollenmeppen.js?v=1')
            window.__klok = 0
            const echt = window.__M.maakMollenMeppen
            window.__houder = document.getElementById('wachtscherm')
            window.__houder.addEventListener('mollen', e => { window.__mol = e.detail })
            // de knop gebruikt maakMollenMeppen zonder klok; voor de proef een spel met een eigen klok ernaast
            window.__M.molKnop(window.__houder)
            window.__eigen = () => { const m = echt({ nu: () => Date.now() + window.__klok }); document.getElementById('wachtscherm').replaceChildren(m.el); m.start(); window.__mol = m }
        }""")
        # A
        check(pg.locator('.mol-start').count() == 1 and 'Mollen meppen terwijl je wacht' in pg.inner_text('.mol-start'), 'A: de knop "Mollen meppen terwijl je wacht"')
        pg.click('.mol-start')
        check(pg.locator('.mol-spel .mol-gat').count() == 16, 'A: een raster van 4x4')
        check(pg.evaluate("() => window.__mol && window.__mol.bezig"), 'A: de ronde loopt meteen')
        # B
        pg.evaluate("window.__eigen()")
        check(wacht(pg, "() => !!document.querySelector('.mol-gat.op')", 4000), 'B: er komt een mol uit een gat')
        leeg = pg.evaluate("() => [...document.querySelectorAll('.mol-gat')].findIndex(g => !g.classList.contains('op'))")
        pg.locator('.mol-gat').nth(leeg).dispatch_event('pointerdown')
        check(pg.evaluate("() => window.__mol.score") == 0, 'B: een leeg gat aantikken = niets')
        geraakt = 0
        for _ in range(4):
            if not wacht(pg, "() => !!document.querySelector('.mol-gat.op')", 4000): break
            nr = pg.evaluate("() => document.querySelector('.mol-gat.op').dataset.nr")
            pg.locator('.mol-gat[data-nr="%s"]' % nr).dispatch_event('pointerdown')
            geraakt += 1
            check(pg.evaluate("n => document.querySelector('.mol-gat[data-nr=\"' + n + '\"]').classList.contains('raak')", nr), 'B: geraakte mol %d gaat omlaag (💫)' % geraakt)
        check(geraakt >= 3 and pg.evaluate("() => window.__mol.score") == geraakt, 'B: elke geraakte mol is een punt (%d)' % geraakt)
        check('⭐ %d' % geraakt in pg.inner_text('.mol-score'), 'B: de score staat bovenin')
        # C
        pg.evaluate("window.__klok = 31000")
        check(wacht(pg, "() => !window.__mol.bezig", 3000), 'C: na 30 seconden is de ronde klaar')
        check('Nieuw record: %d' % geraakt in pg.inner_text('.mol-onder'), 'C: "Nieuw record" (%s)' % pg.inner_text('.mol-onder').replace('\n', ' '))
        check(pg.evaluate("() => localStorage.getItem('fibro_mollen_record_u-marcel')") == str(geraakt), 'C: het record is onthouden (per account)')
        pg.evaluate("window.__klok = 0"); pg.click('.mol-onder .mol-knop')
        check(pg.evaluate("() => window.__mol.bezig && window.__mol.score === 0"), 'C: "Nog een keer" start een nieuwe ronde')
        pg.evaluate("window.__klok = 31000")
        wacht(pg, "() => !window.__mol.bezig", 3000)
        check('Record: %d' % geraakt in pg.inner_text('.mol-onder') and 'Nieuw' not in pg.inner_text('.mol-onder'), 'C: 0 mollen is geen nieuw record')
        # D
        pg.evaluate("window.__klok = 0"); pg.click('.mol-onder .mol-knop')
        pg.evaluate("document.getElementById('wachtscherm').remove()")
        check(wacht(pg, "() => window.__mol.gestopt && !window.__mol.bezig", 2000), 'D: wachtscherm weg = het spelletje stopt vanzelf')
        pg.close()

        # E. de wachtkamer van een groepsspel
        IDS = {'Marcel': 'aaaaaaaa-0000-4000-8000-000000000001', 'Tijn': 'aaaaaaaa-0000-4000-8000-000000000002'}
        def lid(naam):
            q = ctx.new_page(); q.on('pageerror', lambda e: fouten.append('%s: %s' % (naam, str(e)[:300])))
            q.goto(BASIS + 'manifest.json'); q.evaluate("localStorage.setItem('fibro_taal', 'nl')")
            q.evaluate("""async ([ik, ids]) => {
                document.body.innerHTML = ''
                await import('./taal.js').catch(() => {})
                const { maakGroepKaartspel } = await import('./groepkaartspel.js?v=4')
                const bc = new BroadcastChannel('groep-proef342')
                const leden = Object.entries(ids).map(([username, id]) => ({ id, username }))
                const kanaal = { send(b) { bc.postMessage(b); return Promise.resolve('ok') } }
                const gk = maakGroepKaartspel({ ik: ids[ik], groepId: 'g1', kanaal: () => kanaal, leden: () => leden, naamVan: l => l.username })
                bc.onmessage = e => { if (e.data && e.data.event === 'gs') gk.ontvang(e.data.payload) }
                window.__gk = gk
            }""", [naam, IDS])
            return q
        marcel, tijn = lid('Marcel'), lid('Tijn')
        marcel.evaluate("window.__gk.open('eenendertigen')")
        marcel.wait_for_selector('.gk-laag .gk-start', timeout=5000)
        check(marcel.locator('.gk-laag .mol-start').count() == 1, 'E: de knop staat in de wachtkamer')
        marcel.click('.gk-laag .mol-start')
        check(marcel.locator('.gk-laag .mol-spel').count() == 1, 'E: het spelletje staat in de wachtkamer')
        marcel.evaluate("window.__molEl = document.querySelector('.mol-spel')")
        tijn.wait_for_selector('.gk-balk .gk-mee', timeout=5000); tijn.click('.gk-balk .gk-mee')
        check(wacht(marcel, "() => document.querySelectorAll('.gk-spelers li').length === 2", 5000), 'E: Tijn doet mee (de wachtkamer is opnieuw getekend)')
        time.sleep(0.4)
        check(marcel.evaluate("() => document.querySelector('.gk-laag .mol-spel') === window.__molEl && window.__molEl.isConnected"), 'E: hetzelfde spelletje loopt gewoon door')
        check(tijn.locator('.gk-laag .mol-start').count() == 1, 'E: ook Tijn kan mollen meppen terwijl hij wacht')
        marcel.click('.gk-laag .gk-start')
        check(wacht(marcel, "() => !window.__molEl.isConnected", 8000), 'E: het spel start: de wachtkamer en het spelletje zijn weg')
        b.close()
        check(not fouten, 'E: geen paginafouten %s' % fouten)
except Exception as e:
    check(False, 'proef afgebroken: %s' % str(e).split('\n')[0])
finally:
    srv.terminate()
print('\n%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
