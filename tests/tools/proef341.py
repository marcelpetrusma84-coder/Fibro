# proef341 (26 nov 2026, Marcel): samen spelen vanaf Home (spel.html + samenspelen.js).
#  A. Eenendertigen: bij het niveau kiezen staan "👤 Tegen een vriend" en "👥 Met een groep"
#  B. "Met een groep" toont je groepen (mijn_groepen); een groep kiezen opent groep.html?id=...&spel=eenendertigen
#  C. "Tegen een vriend" opent de vriendenkeuze (zonder account: eerst inloggen)
#  D. Pesten: wel tegen een vriend, niet met een groep (Pesten is voor 2)
#  E. een arcadespel (Block It): ook op het startscherm "Tegen een vriend"; schaken houdt zijn eigen knop
#  F. de groepschat: open('eenendertigen') zet meteen de wachtkamer neer, de groep krijgt de uitnodiging; geen paginafouten
# Op de oude versie mislukt A (er was alleen bij schaken een knop).
# python3 -I proef341.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef341_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
GROEP = '11111111-2222-4333-8444-555555555555'
fouten = []

def supabase(route):
    if '/rpc/mijn_groepen' in route.request.url:
        route.fulfill(status=200, json=[{ 'id': GROEP, 'naam': 'Kaartclub', 'soort': 'chat', 'leden': 3 }, { 'id': '../index.html', 'naam': 'Fout', 'soort': 'chat', 'leden': 1 }])
    else: route.fulfill(status=200, json=[])

def open_spel(ctx, spel):
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(spel + ': ' + str(e)[:300])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("() => localStorage.setItem('fibro_taal', 'nl')")
    pg.goto(BASIS + 'spel.html?spel=%s&titel=1' % spel)
    return pg

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True, reduced_motion='reduce')
        # de laatste regel gaat voor: eerst al het andere internet dicht, daarna Supabase met nepantwoorden
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        ctx.route('**/*supabase.co/**', supabase)

        # A. Eenendertigen
        pg = open_spel(ctx, 'eenendertigen')
        pg.wait_for_selector('.niveau-btn[data-niveau]', timeout=10000)
        check(pg.locator('#vriendKnop').count() == 1 and '👤 Tegen een vriend' in pg.inner_text('#vriendKnop'), 'A: knop "Tegen een vriend"')
        check(pg.locator('#groepKnop').count() == 1 and '👥 Met een groep' in pg.inner_text('#groepKnop'), 'A: knop "Met een groep"')
        check(pg.evaluate("() => getComputedStyle(document.getElementById('groepKnop')).backgroundColor") == 'rgb(139, 63, 209)', 'A: de groepsknop is paars (#8b3fd1) met witte letters')

        # B. met een groep
        if pg.locator('#groepKnop').count():
            pg.click('#groepKnop')
            pg.wait_for_selector('.vriend-modal .vriend-rij', timeout=8000)
            rijen = pg.locator('.vriend-modal .vriend-rij')
            check(rijen.count() == 1 and 'Kaartclub' in rijen.first.inner_text(), 'B: je groepen staan erin (zonder het foute groepsnummer)')
            check('Eenendertigen' in pg.inner_text('.vriend-modal'), 'B: met de naam van het spel')
            adressen = []
            pg.on('request', lambda r: adressen.append(r.url) if r.is_navigation_request() else None)
            rijen.first.click()
            ok = False
            for _ in range(50):
                if any('/groep.html?id=' + GROEP + '&spel=eenendertigen' in a for a in adressen): ok = True; break
                time.sleep(0.1)
            check(ok, 'B: een groep kiezen opent de groepschat met de wachtkamer (%s)' % [a.replace(BASIS, '') for a in adressen][:2])
        pg.close()

        # C. tegen een vriend (zonder account)
        pg = open_spel(ctx, 'eenendertigen')
        pg.wait_for_selector('#vriendKnop', timeout=10000)
        pg.click('#vriendKnop')
        try: pg.wait_for_function("() => /Log in om een vriend uit te nodigen/.test(document.querySelector('.vriend-modal')?.textContent || '')", timeout=8000); ok = True
        except Exception: ok = False
        check(ok and 'Eenendertigen' in pg.inner_text('.vriend-modal'), 'C: de vriendenkeuze voor Eenendertigen opent (zonder account: eerst inloggen)')
        pg.close()

        # D. Pesten
        pg = open_spel(ctx, 'pesten')
        pg.wait_for_selector('.niveau-btn[data-niveau]', timeout=10000)
        check(pg.locator('#vriendKnop').count() == 1 and pg.locator('#groepKnop').count() == 0, 'D: Pesten: wel tegen een vriend, niet met een groep')
        pg.close()

        # E. arcade en schaken
        pg = open_spel(ctx, 'breakout')
        pg.wait_for_selector('#startKnop', timeout=10000)
        check(pg.locator('#vriendKnop').count() == 1, 'E: Block It: ook op het startscherm "Tegen een vriend"')
        pg.close()
        pg = open_spel(ctx, 'schaken')
        pg.wait_for_selector('.niveau-btn[data-niveau]', timeout=15000)
        check(pg.locator('#vriendKnop').count() == 1 and pg.locator('#groepKnop').count() == 0, 'E: schaken houdt één eigen knop')
        pg.close()

        # F. in de groepschat: open(spel) (groep.html?spel=...) zet meteen de wachtkamer neer en de groep krijgt de uitnodiging
        IDS = {'Marcel': 'aaaaaaaa-0000-4000-8000-000000000001', 'Tijn': 'aaaaaaaa-0000-4000-8000-000000000002'}
        def lid(naam):
            q = ctx.new_page(); q.on('pageerror', lambda e: fouten.append('%s: %s' % (naam, str(e)[:300])))
            q.goto(BASIS + 'manifest.json'); q.evaluate("localStorage.setItem('fibro_taal', 'nl')")
            q.evaluate("""async ([ik, ids]) => {
                document.body.innerHTML = ''
                await import('./taal.js').catch(() => {})
                const { maakGroepKaartspel } = await import('./groepkaartspel.js?v=4')
                const bc = new BroadcastChannel('groep-proef341')
                const leden = Object.entries(ids).map(([username, id]) => ({ id, username }))
                const kanaal = { send(b) { bc.postMessage(b); return Promise.resolve('ok') } }
                window.__push = []
                const gk = maakGroepKaartspel({ ik: ids[ik], groepId: 'g1', kanaal: () => kanaal, leden: () => leden, naamVan: l => l.username, meldPush: (s, n) => window.__push.push(s) })
                bc.onmessage = e => { if (e.data && e.data.event === 'gs') gk.ontvang(e.data.payload) }
                window.__gk = gk
            }""", [naam, IDS])
            return q
        marcel, tijn = lid('Marcel'), lid('Tijn')
        marcel.evaluate("window.__gk.open('pesten')")
        check(marcel.locator('.gk-laag').count() == 0, 'F: Pesten (voor 2) opent geen wachtkamer in de groep')
        marcel.evaluate("window.__gk.open('eenendertigen')")
        try: marcel.wait_for_selector('.gk-laag .gk-start', timeout=5000); ok = True
        except Exception: ok = False
        check(ok and 'Wachtkamer' in marcel.inner_text('.gk-laag'), 'F: Marcel ziet meteen de wachtkamer voor Eenendertigen')
        try: tijn.wait_for_function("() => (document.querySelector('.gk-balk') || {}).innerText?.includes('Marcel wil Eenendertigen spelen')", timeout=5000); ok = True
        except Exception: ok = False
        check(ok, 'F: Tijn krijgt bovenin de uitnodiging')
        check(marcel.evaluate("window.__push") == ['eenendertigen'], 'F: en de groep krijgt een pushmelding')
        marcel.evaluate("window.__gk.open('eenendertigen')")
        check(marcel.locator('.gk-laag').count() == 1 and marcel.evaluate("window.__push") == ['eenendertigen'], 'F: nog eens open = geen tweede wachtkamer')
        check(not fouten, 'E: geen paginafouten %s' % fouten)
        b.close()
except Exception as e:
    check(False, 'proef afgebroken: %s' % str(e).split('\n')[0])
finally:
    srv.terminate()

print('\n%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
