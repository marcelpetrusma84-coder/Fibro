# proef308 (17 nov 2026, Marcel): de kaartspellen (Pesten, Toepen, Eenentwintigen) liggen op een groen casinolaken of
# een houten tafel, en hebben ook de moderne kaarten. Koningsjacht houdt zijn eigen houten tafel.
#  A. standaard: groen casinolaken
#  B. 🎴: drie kaartstijlen (Stekky, Perkament, Modern) en twee tafels (Groen casino, Houten tafel)
#  C. Modern: meteen moderne kaarten in je hand, op de stapel en bij de ander
#  D. Houten tafel: de tafel verandert meteen; na opnieuw laden en in Toepen en Eenentwintigen ook (en modern)
#  E. Koningsjacht: altijd zijn houten tafel, geen keuze 🎴
#  F. geen paginafouten
# python3 -I proef308.py <map> [schermafdruk-map]
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

FOTO_MAP = sys.argv[2] if len(sys.argv) > 2 else None
ONDERGROND = "() => { const t = document.querySelector('.kt-tafel'); return t ? (t.classList.contains('kt-casino') ? 'casino' : t.classList.contains('kt-hout') ? 'hout' : 'paars') : null }"
MODERN = "sel => [...document.querySelectorAll(sel)].map(e => !!e.querySelector('svg.kt-modern'))"
def alles_modern(pg, sel): v = pg.evaluate(MODERN, sel); return bool(v) and all(v)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True, reduced_motion='reduce')
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        pg = open_spel(ctx, 'pesten')
        check(wacht(pg, MIJN_BEURT), 'Pesten: gedeeld en jij bent aan de beurt')
        check(pg.evaluate(ONDERGROND) == 'casino', 'A: standaard een groen casinolaken')
        if FOTO_MAP: pg.screenshot(path=os.path.join(FOTO_MAP, 'pesten-casino.png'))
        pg.click('.kt-stijlknop')
        stijlen = pg.evaluate("() => [...document.querySelectorAll('.kt-stijlkeuze[data-stijl]')].map(b => b.dataset.stijl)")
        tafels = pg.evaluate("() => [...document.querySelectorAll('.kt-ondergrondkeuze')].map(b => b.dataset.ondergrond + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''))")
        check(stijlen == ['stekky', 'perkament', 'modern'], 'B: drie kaartstijlen %s' % stijlen)
        check(tafels == ['casino*', 'hout'], 'B: twee tafels, casino gekozen %s' % tafels)
        check('Groen casino' in pg.inner_text('.kt-stijlkeus') and 'Houten tafel' in pg.inner_text('.kt-stijlkeus'), 'B: met namen')
        if FOTO_MAP: pg.screenshot(path=os.path.join(FOTO_MAP, 'keuze.png'))
        pg.click('.kt-stijlkeuze[data-stijl=modern]')
        check(alles_modern(pg, '.kt-hand .kt-kaart'), 'C: je hand is meteen modern')
        check(alles_modern(pg, '.kt-stapel .kt-st') and alles_modern(pg, '.kt-anderwaaier .kt-mini'), 'C: ook de stapel en de kaarten van de ander')
        pg.click('.kt-stijlknop'); pg.click('.kt-ondergrondkeuze[data-ondergrond=hout]')
        check(pg.evaluate(ONDERGROND) == 'hout' and pg.locator('.kt-stijlkeus').count() == 0, 'D: meteen een houten tafel')
        if FOTO_MAP: pg.screenshot(path=os.path.join(FOTO_MAP, 'pesten-hout-modern.png'))
        pg.close()
        for spel in ['pesten', 'toepen', 'eenentwintigen']:
            q = open_spel(ctx, spel)
            wacht(q, "() => !!document.querySelector('.kt-tafel .kt-hand .kt-kaart')")
            check(q.evaluate(ONDERGROND) == 'hout' and alles_modern(q, '.kt-hand .kt-kaart'), 'D: %s: houten tafel en moderne kaarten (bewaard)' % spel)
            if spel == 'toepen':
                q.click('.kt-stijlknop'); q.click('.kt-ondergrondkeuze[data-ondergrond=casino]')
                check(q.evaluate(ONDERGROND) == 'casino', 'D: terug naar het casinolaken')
                if FOTO_MAP: q.screenshot(path=os.path.join(FOTO_MAP, 'toepen-casino-modern.png'))
                q.click('.kt-stijlknop'); q.click('.kt-ondergrondkeuze[data-ondergrond=hout]')
            q.close()
        k = ctx.new_page(); k.on('pageerror', lambda e: fouten.append('koningsjacht: ' + str(e)[:300]))
        k.goto(BASIS + 'manifest.json'); k.evaluate("() => localStorage.setItem('fibro_kaartondergrond', 'casino')")
        k.goto(BASIS + 'spel.html?spel=koningsjacht&titel=1')
        k.wait_for_selector('.kj-niveau', timeout=15000); k.click('.kj-niveau')
        wacht(k, "() => !!document.querySelector('.kt-tafel')", 20000)
        check(k.evaluate(ONDERGROND) == 'hout' and k.locator('.kt-stijlknop').count() == 0, 'E: Koningsjacht: altijd zijn houten tafel, geen 🎴 (%s)' % k.evaluate(ONDERGROND))
        b.close()
finally:
    srv.terminate()
check(not fouten, 'F: geen paginafouten %s' % fouten[:3])
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
