# proef302 (14 nov 2026, Marcel): de kaarttafel v7 (kaartspel-hulp.js), getest met Pesten tegen de computer.
#  A. knop ⚙️ onderin: Instellingen met Hulp (aan), Grote kaarten (uit) en Trillen (aan)
#  B. Hulp uit = geen paarse gloed en niets donkerder; weer aan = wel; bewaard op dit toestel (fibro_kaarttafel)
#  C. Grote kaarten = je kaarten worden groter
#  D. met je vinger over de waaier schuiven: de kaart onder je vinger komt groot omhoog; loslaten = die kaart gekozen
#  E. een gekozen kaart + tik op de aflegstapel = de kaart wordt daar neergelegd
#  F. dubbeltik op een kaart = meteen spelen
#  G. tik op de aflegstapel zonder gekozen kaart = de laatste zet groot in beeld
#  H. geen paginafouten
# Gaat mis op kaartspel-hulp v6 (geen ⚙️, geen loep, geen tik op de aflegstapel, geen dubbeltik).
# python3 -I proef302.py <map>
import sys, os, time, socket, subprocess, tempfile, re, json
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef302_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
MIJN_BEURT = "() => !document.querySelector('.kt-einde') && !document.querySelector('.kt-keuze') && !!document.querySelector('.kt-tafel.kt-mijnbeurt') && " + RUST
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].map(k => k.dataset.id)"
MAG = "() => [...document.querySelectorAll('.kt-hand .kt-kaart.kt-mag, .kt-hand .kt-kaart.kt-gekozen')].map(k => k.dataset.id)"
GEKOZEN = "() => [...document.querySelectorAll('.kt-hand .kt-kaart.kt-gekozen')].map(k => k.dataset.id)"
TOP = "() => { const a = document.querySelectorAll('.kt-afleg .kt-ak'); return a.length ? a[a.length - 1].dataset.id : null }"
# Een plek op de kaart die echt bovenop ligt (de waaier overlapt)
PLEK = """e => { const r = e.getBoundingClientRect()
    for (const fy of [0.5, 0.35, 0.65, 0.8, 0.9, 0.2]) for (let fx = 0.08; fx < 0.95; fx += 0.06) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y)
        if (raak && (raak === e || e.contains(raak))) return [x, y] }
    return [r.left + r.width / 2, r.top + r.height / 2] }"""

def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def plek(pg, id): return pg.eval_on_selector('.kt-hand .kt-kaart[data-id="%s"]' % id, PLEK)
def gewoon(id): return id[1:] not in ('B',) and not id.startswith('J')   # boer en joker vragen eerst een kleur
def speelbare(pg):
    """Wacht op je beurt en geef een gewone kaart die je mag spelen (pak zo nodig van de stapel)."""
    for _ in range(8):
        if not wacht(pg, MIJN_BEURT, 25000): return None
        pg.wait_for_timeout(250)
        ids = [i for i in pg.evaluate(MAG) if gewoon(i)]
        if ids: return ids[0]
        if pg.query_selector('.kt-knop[data-naam=pas]'): pg.click('.kt-knop[data-naam=pas]')
        else: pg.click('.kt-stapel')
        pg.wait_for_timeout(600)
    return None
def wis(pg):
    for id in pg.evaluate(GEKOZEN):
        x, y = plek(pg, id); pg.mouse.click(x, y); pg.wait_for_timeout(450)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:300])); pg.on('dialog', lambda d: d.dismiss())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("() => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_solo_niveau_pesten', 'makkelijk') }")
        pg.goto(BASIS + 'spel.html?spel=pesten&titel=1')
        pg.wait_for_selector('.niveau-btn[data-niveau=makkelijk]', timeout=10000)
        pg.click('.niveau-btn[data-niveau=makkelijk]')
        check(wacht(pg, MIJN_BEURT, 25000), 'Pesten: gedeeld en jij bent aan de beurt')

        # A. instellingen
        check(pg.locator('.kt-instelknop').count() == 1, 'A: knop ⚙️ onderin')
        pg.click('.kt-instelknop')
        check(pg.locator('.kt-instelkeus [data-kaartinstelling]').count() == 3, 'A: drie instellingen')
        check(pg.is_checked('[data-kaartinstelling=hulp]') and not pg.is_checked('[data-kaartinstelling=groot]') and pg.is_checked('[data-kaartinstelling=trillen]'),
              'A: standaard: hulp aan, grote kaarten uit, trillen aan')

        # B. hulp uit en weer aan
        voor = pg.locator('.kt-hand .kt-mag, .kt-hand .kt-niet').count()
        pg.uncheck('[data-kaartinstelling=hulp]')
        check(voor > 0 and pg.locator('.kt-hand .kt-mag, .kt-hand .kt-niet').count() == 0, 'B: hulp uit = niets licht op en niets wordt donkerder (%d -> 0)' % voor)
        check(json.loads(pg.evaluate("() => localStorage.getItem('fibro_kaarttafel')") or '{}').get('hulp') is False, 'B: bewaard op dit toestel')
        pg.check('[data-kaartinstelling=hulp]')
        check(pg.locator('.kt-hand .kt-mag, .kt-hand .kt-niet').count() == voor, 'B: hulp weer aan = weer oplichten')

        # C. grote kaarten
        w0 = pg.eval_on_selector('.kt-hand .kt-kaart', 'e => e.offsetWidth')
        pg.check('[data-kaartinstelling=groot]')
        w1 = pg.eval_on_selector('.kt-hand .kt-kaart', 'e => e.offsetWidth')
        check(w1 >= w0 * 1.15, 'C: grote kaarten (%d -> %d px)' % (w0, w1))
        pg.uncheck('[data-kaartinstelling=groot]')
        check(pg.eval_on_selector('.kt-hand .kt-kaart', 'e => e.offsetWidth') == w0, 'C: weer gewoon')
        pg.click('.kt-instelkeus .kt-keuzekaart > .kt-knop')
        check(pg.locator('.kt-instelkeus').count() == 0, 'A: Sluiten')

        # D. met je vinger over de waaier: van de linkerkaart naar rechts
        wis(pg)
        hand = pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(k => k.dataset.id)")
        x0, y0 = plek(pg, hand[0])
        xe = pg.eval_on_selector('.kt-hand .kt-kaart[data-id="%s"]' % hand[-2], 'e => { const r = e.getBoundingClientRect(); return r.left + r.width * 0.3 }')
        pg.mouse.move(x0, y0); pg.mouse.down()
        for i in range(1, 13): pg.mouse.move(x0 + (xe - x0) * i / 12, y0 + 2); time.sleep(0.02)
        loep = pg.evaluate("() => { const k = document.querySelector('.kt-hand .kt-kaart.kt-loep'); if (!k) return null; const r = k.getBoundingClientRect(); return [k.dataset.id, r.width, r.top] }")
        check(bool(loep) and loep[0] != hand[0] and loep[1] > w0 * 1.3, 'D: de kaart onder je vinger komt groot omhoog (%s)' % (loep,))
        pg.mouse.up(); pg.wait_for_timeout(200)
        check(loep is not None and pg.evaluate(GEKOZEN) == [loep[0]] and pg.locator('.kt-loep').count() == 0, 'D: loslaten = die kaart is gekozen (%s)' % pg.evaluate(GEKOZEN))
        wis(pg)

        # E. kiezen + tik op de aflegstapel = daar neerleggen
        id = speelbare(pg)
        check(bool(id), 'E: een kaart die je mag spelen (%s)' % id)
        if id:
            wis(pg)
            x, y = plek(pg, id); pg.mouse.click(x, y); pg.wait_for_timeout(450)
            check(pg.evaluate(GEKOZEN) == [id], 'E: %s gekozen' % id)
            check(pg.locator('.kt-afleg.kt-doel').count() == 1, 'E: de aflegstapel licht op (daar mag hij heen)')
            pg.click('.kt-afleg')
            check(wacht(pg, "() => !document.querySelector('.kt-hand .kt-kaart[data-id=\"%s\"]')" % id, 8000), 'E: de kaart is weg uit je hand')
            check(id in pg.evaluate("() => [...document.querySelectorAll('.kt-afleg .kt-ak')].map(e => e.dataset.id)") or wacht(pg, "() => [...document.querySelectorAll('.kt-afleg .kt-ak')].length > 0", 3000), 'E: en ligt op de aflegstapel')

        # F. dubbeltik = meteen spelen
        id = speelbare(pg)
        if id:
            wis(pg)
            x, y = plek(pg, id)
            pg.mouse.click(x, y); time.sleep(0.12); pg.mouse.click(x, y)
            check(wacht(pg, "() => !document.querySelector('.kt-hand .kt-kaart[data-id=\"%s\"]')" % id, 8000), 'F: dubbeltik op %s = meteen gespeeld' % id)
        else: check(False, 'F: geen kaart om te spelen')

        # G. tik op de aflegstapel zonder gekozen kaart = de laatste zet groot
        wacht(pg, MIJN_BEURT, 25000); wis(pg)
        pg.click('.kt-afleg')
        check(wacht(pg, "() => !!document.querySelector('.kt-laatstekeus')", 3000), 'G: tik op de aflegstapel = de laatste zet in beeld')
        tekst = pg.text_content('.kt-laatstekeus') if pg.query_selector('.kt-laatstekeus') else ''
        kaarten = pg.evaluate("() => [...document.querySelectorAll('.kt-laatstekeus .kt-laatste > div')].map(e => e.dataset.id)")
        check(len(kaarten) >= 1 and ('Laatste zet van' in tekst or 'Bovenop de aflegstapel' in tekst), 'G: met de kaart(en) groot (%s, %s)' % (tekst[:40], kaarten))
        if pg.query_selector('.kt-laatstekeus'): pg.click('.kt-laatstekeus .kt-keuzekaart > .kt-knop')
        check(pg.locator('.kt-laatstekeus').count() == 0, 'G: en weer dicht')
        check(not fouten, 'H: geen paginafouten %s' % fouten[:3])
        b.close()
except Exception as e:
    check(False, 'proef afgebroken: ' + str(e).split('\n')[0])
finally:
    srv.terminate()
print('\n%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
