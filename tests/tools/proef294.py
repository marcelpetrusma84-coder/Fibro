# proef294 (11 nov 2026): kaartstijl kiezen in de kaartspellen (kaartspel-hulp.js v3, knop 🎴).
#  A. zonder keuze: gewone getekende kaarten (svg) in je hand, op de stapel en op de aflegstapel
#  B. 🎴 opent "Kies je kaarten" met Stekky (gekozen) en Perkament
#  C. Perkament: meteen plaatjes in je hand, de achterkant op de stapel en de waaier van de ander; de plaatjes laden echt
#  D. spelen gaat gewoon door: een kaart omhoog vegen (Pesten) en de kaart ligt als plaatje op de aflegstapel
#  E. de keuze blijft na opnieuw laden, ook in Toepen en Eenentwintigen; terug naar Stekky = weer svg; geen paginafouten
# python3 -I proef294.py <map> [schermafdruk.png]
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
FOTO = sys.argv[2] if len(sys.argv) > 2 else None
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef294_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
MIJN_BEURT = "() => !document.querySelector('.kt-einde') && !!document.querySelector('.kt-tafel.kt-mijnbeurt') && " + RUST
SOORT = """sel => [...document.querySelectorAll(sel)].map(e => e.querySelector('img.kt-img') ? 'img' : e.querySelector('svg') ? 'svg' : '?')"""
GELADEN = """() => [...document.querySelectorAll('.kt-tafel img.kt-img')].every(i => i.complete && i.naturalWidth > 100)"""

def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def soort(pg, sel): return set(pg.evaluate(SOORT, sel))
def open_spel(ctx, spel):
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(spel + ': ' + str(e)[:300])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("s => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_solo_niveau_' + s, 'makkelijk') }", spel)
    pg.goto(BASIS + 'spel.html?spel=%s&titel=1' % spel)
    pg.wait_for_selector('.niveau-btn[data-niveau=makkelijk]', timeout=10000)
    pg.click('.niveau-btn[data-niveau=makkelijk]')
    return pg

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True, reduced_motion='reduce')
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))

        pg = open_spel(ctx, 'pesten')
        check(wacht(pg, MIJN_BEURT), 'Pesten: gedeeld en jij bent aan de beurt')
        check(soort(pg, '.kt-hand .kt-kaart') == {'svg'} and soort(pg, '.kt-stapel .kt-st') == {'svg'} and soort(pg, '.kt-afleg .kt-ak') == {'svg'},
              'A: zonder keuze gewone getekende kaarten')

        pg.click('.kt-stijlknop')
        check(pg.locator('.kt-stijlkeus').count() == 1 and pg.locator('.kt-stijlkeuze').count() == 2, 'B: 🎴 opent de keuze met twee stijlen')
        check(pg.locator('.kt-stijlkeuze[data-stijl=stekky][aria-pressed=true]').count() == 1, 'B: Stekky staat aan')
        check('Perkament' in pg.inner_text('.kt-stijlkeus'), 'B: Perkament staat erbij')
        pg.click('.kt-stijlkeuze[data-stijl=perkament]')
        check(pg.locator('.kt-stijlkeus').count() == 0, 'C: de keuze gaat dicht')
        check(soort(pg, '.kt-hand .kt-kaart') == {'img'}, 'C: je hand is meteen perkament')
        check(soort(pg, '.kt-stapel .kt-st') == {'img'} and soort(pg, '.kt-anderwaaier .kt-mini') == {'img'}, 'C: achterkant op de stapel en bij de ander')
        check(soort(pg, '.kt-afleg .kt-ak') == {'img'}, 'C: aflegstapel ook')
        check(pg.evaluate("() => localStorage.getItem('fibro_kaartstijl')") == 'perkament', 'C: keuze bewaard op dit toestel')
        check(wacht(pg, GELADEN, 8000), 'C: de plaatjes laden echt')
        hand = pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart')].map(k => [k.dataset.id, k.querySelector('img').getAttribute('src')])")
        check(all(src.startswith('./kaarten/perkament/' + (id if not id.startswith('J') else 'joker') + '.webp?v=') for id, src in hand), 'C: elke kaart het goede plaatje')

        # D. spelen gaat door
        mag = pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart.kt-mag')].map(k => k.dataset.id)")
        if mag:
            box = pg.locator('.kt-hand .kt-kaart[data-id="%s"]' % mag[0]).bounding_box()
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] * 0.6
            pg.mouse.move(x, y); pg.mouse.down()
            for i in range(1, 9): pg.mouse.move(x, y - 30 * i); time.sleep(0.012)
            pg.mouse.up()
            check(wacht(pg, "() => [...document.querySelectorAll('.kt-afleg .kt-ak')].some(k => k.dataset.id === %r && k.querySelector('img.kt-img'))" % mag[0], 8000),
                  'D: een kaart omhoog vegen: hij ligt als plaatje op de aflegstapel')
        else:
            pg.click('.kt-stapel'); check(wacht(pg, "() => document.querySelectorAll('.kt-hand .kt-kaart').length > 7", 8000), 'D: (niets te spelen) een kaart pakken werkt')
        time.sleep(0.5)
        if FOTO:
            pg.screenshot(path=FOTO)
            pg.click('.kt-stijlknop'); time.sleep(0.4); pg.screenshot(path=FOTO.replace('.png', '-keuze.png')); pg.click('.kt-stijlkeus .kt-keuzekaart > .kt-knop')
        pg.close()

        # E. de keuze blijft, ook in de andere kaartspellen
        for spel in ('toepen', 'eenentwintigen'):
            q = open_spel(ctx, spel)
            check(wacht(q, "() => document.querySelectorAll('.kt-hand .kt-kaart').length >= 2", 15000) and soort(q, '.kt-hand .kt-kaart') == {'img'}, 'E: %s gebruikt ook perkament' % spel)
            q.close()
        q = open_spel(ctx, 'pesten')
        check(wacht(q, "() => document.querySelectorAll('.kt-hand .kt-kaart').length >= 7", 15000) and soort(q, '.kt-hand .kt-kaart') == {'img'}, 'E: na opnieuw laden nog steeds perkament')
        q.click('.kt-stijlknop')
        check(q.locator('.kt-stijlkeuze[data-stijl=perkament][aria-pressed=true]').count() == 1, 'E: Perkament staat nu aan in de keuze')
        q.click('.kt-stijlkeuze[data-stijl=stekky]')
        check(soort(q, '.kt-hand .kt-kaart') == {'svg'} and soort(q, '.kt-stapel .kt-st') == {'svg'}, 'E: terug naar Stekky = weer getekende kaarten')
        check(not fouten, 'E: geen paginafouten ' + ' | '.join(fouten))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT: %s' % (len(fout), '; '.join(fout))))
sys.exit(1 if fout else 0)
