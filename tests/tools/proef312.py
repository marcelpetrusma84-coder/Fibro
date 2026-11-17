# proef312 (17 nov 2026, Marcel): de Vrolijke kaarten (kaartspel-hulp.js v10) in een echt spel.
#  A. Pesten zonder keuze: de Vrolijke kaarten in je hand, op de aflegstapel en als achterkant op de stapel
#  B. alle plaatjes laden echt (aas/2/3, boer/vrouw/heer, joker, achterkant): geen 404, op tijd geladen
#  C. 🎴 toont Vrolijk (aan) naast Stekky, Perkament en Modern; wisselen naar Stekky en terug werkt meteen
#  D. JACK/QUEEN/KING op de hofkaarten, in het Engels en (Marcel) ook in het Nederlands; geen paginafouten
# python3 -I proef312.py <map> [schermafdruk.png]
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
FOTO = sys.argv[2] if len(sys.argv) > 2 else None
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef312_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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

VRO_PLAATJES = """async () => {
  const urls = [], ids = []
  for (const k of 'hrks') for (const w of ['A', '2', '3', 'B', 'V', 'H']) ids.push(k + w)
  ids.push('joker', 'achterkant')
  const uit = []
  for (const id of ids) {
    const r = await fetch('./kaarten/vrolijk/' + id + '.webp?v=1'); const b = await r.blob()
    const ok = await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 300); i.onerror = () => res(false); i.src = URL.createObjectURL(b) })
    uit.push([id, r.status, ok])
  }
  return uit
}"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True, reduced_motion='reduce')
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        mis = []
        ctx.on('response', lambda r: mis.append(r.url) if '/kaarten/' in r.url and r.status >= 400 else None)
        pg = open_spel(ctx, 'pesten')
        check(wacht(pg, MIJN_BEURT), 'Pesten: gedeeld en jij bent aan de beurt')
        # A
        alle_vrolijk = "sel => { const k = [...document.querySelectorAll(sel)]; return k.length > 0 && k.every(e => e.querySelector('svg.kt-vrolijk')) }"
        check(pg.evaluate(alle_vrolijk, '.kt-hand .kt-kaart'), 'A: je hand: Vrolijke kaarten')
        check(pg.evaluate(alle_vrolijk, '.kt-afleg .kt-ak'), 'A: aflegstapel: Vrolijke kaart')
        check(pg.evaluate("() => !!document.querySelector('.kt-stapel image[href*=\"kaarten/vrolijk/achterkant.webp\"]')"), 'A: de stapel heeft de nieuwe achterkant')
        # B
        res = pg.evaluate(VRO_PLAATJES)
        slecht = [r for r in res if r[1] != 200 or not r[2]]
        check(len(res) == 26 and not slecht, 'B: alle 26 plaatjes bestaan en laden (%s)' % slecht)
        pg.wait_for_timeout(800)
        check(not mis, 'B: geen ontbrekende kaartplaatjes in het spel (%s)' % mis[:3])
        if FOTO: pg.screenshot(path=FOTO)
        # C
        pg.click('.kt-stijlknop')
        stijlen = pg.eval_on_selector_all('.kt-stijlkeuze[data-stijl]', 'els => els.map(e => e.dataset.stijl)')
        check(stijlen == ['stekky', 'perkament', 'modern', 'vrolijk'] and pg.locator('.kt-stijlkeuze[data-stijl=vrolijk][aria-pressed=true]').count() == 1, 'C: Vrolijk staat aan in de keuze %s' % stijlen)
        check('Vrolijk' in pg.inner_text('.kt-stijlkeus'), 'C: met de naam Vrolijk')
        pg.click('.kt-stijlkeuze[data-stijl=stekky]')
        check(not pg.evaluate(alle_vrolijk, '.kt-hand .kt-kaart'), 'C: Stekky gekozen: andere kaarten')
        pg.click('.kt-stijlknop'); pg.click('.kt-stijlkeuze[data-stijl=vrolijk]')
        check(pg.evaluate(alle_vrolijk, '.kt-hand .kt-kaart'), 'C: terug naar Vrolijk')
        # D
        nl = pg.evaluate("async () => { const m = await import('./kaartspel-hulp.js?v=10'); return ['hB','hV','hH'].map(id => m.kaartSvg(id, 'vrolijk')).join('') }")
        check('>JACK<' in nl and '>QUEEN<' in nl and '>KING<' in nl and '>BOER<' not in nl, 'D: in het Nederlands ook JACK, QUEEN, KING')
        q = ctx.new_page(); q.on('pageerror', lambda e: fouten.append('en: ' + str(e)[:300]))
        q.goto(BASIS + 'manifest.json')
        q.evaluate("() => { localStorage.setItem('fibro_taal', 'en'); localStorage.setItem('fibro_solo_niveau_pesten', 'makkelijk') }")
        q.goto(BASIS + 'spel.html?spel=pesten&titel=1')
        q.wait_for_selector('.niveau-btn[data-niveau=makkelijk]', timeout=10000); q.click('.niveau-btn[data-niveau=makkelijk]')
        check(wacht(q, "() => document.querySelectorAll('.kt-hand .kt-kaart').length >= 7"), 'D: Engels: kaarten gedeeld')
        tekst = q.evaluate("() => window.__kaartTekst = (async () => { const m = await import('./kaartspel-hulp.js?v=10'); return ['hB','hV','hH'].map(id => m.kaartSvg(id, 'vrolijk')).join('') })()")
        check('>JACK<' in tekst and '>QUEEN<' in tekst and '>KING<' in tekst and '>BOER<' not in tekst, 'D: in het Engels JACK, QUEEN, KING')
        check(not fouten, 'D: geen paginafouten ' + ' | '.join(fouten))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT: %s' % (len(fout), '; '.join(fout))))
sys.exit(1 if fout else 0)
