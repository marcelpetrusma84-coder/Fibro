# proef346 (26 nov 2026): "Kies je kaarten" past op een smalle telefoon; de rij kaarten (en tafels) kun je opzij vegen.
# Marcel zag op zijn iPhone dat Stekky links en Vrolijk rechts van het scherm afvielen, zonder dat je kon scrollen.
#  A. het keuzevenster valt niet buiten het scherm (390 breed, zoals een iPhone)
#  B. de rij kaarten is te breed, dus scrollbaar; wat nu gekozen is (Vrolijk) staat meteen helemaal in beeld
#  C. met een veeg (touch) en met het muiswiel kom je bij de eerste en de laatste kaart, en die staan dan helemaal in beeld
#  D. de twee tafels passen wel: allebei in beeld, netjes in het midden
#  E. na het vegen kun je gewoon kiezen (Perkament): de keuze gaat dicht en is bewaard
#  F. ook op een heel smal scherm (320 breed) valt het venster niet buiten beeld; geen paginafouten
# python3 -I proef346.py <map> [schermafdruk.png]
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
FOTO = sys.argv[2] if len(sys.argv) > 2 else None
fout = []
def check(ok, wat, extra=''):
    print(('OK   ' if ok else 'FOUT ') + wat + (('  | ' + str(extra)) if extra != '' else ''))
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef346_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
MIJN_BEURT = "() => !document.querySelector('.kt-einde') && !!document.querySelector('.kt-tafel.kt-mijnbeurt') && " + RUST

def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False

# Per rij: hoe breed, of hij scrolt, en per knop of hij helemaal binnen de rij in beeld staat
RIJ = """sel => { const r = document.querySelector(sel); if (!r) return null; const rr = r.getBoundingClientRect()
  return { scrollW: r.scrollWidth, clientW: r.clientWidth, links: r.scrollLeft, overflow: getComputedStyle(r).overflowX,
    knoppen: [...r.children].map(b => { const k = b.getBoundingClientRect()
      return { id: b.dataset.stijl || b.dataset.ondergrond, aan: b.getAttribute('aria-pressed') === 'true',
        inBeeld: k.left >= rr.left - 1 && k.right <= rr.right + 1 && k.left >= -1 && k.right <= innerWidth + 1, links: k.left - rr.left, rechts: rr.right - k.right } }) } }"""
VAK = "() => { const k = document.querySelector('.kt-stijlkeus .kt-keuzekaart').getBoundingClientRect(); return [k.left, k.right, innerWidth] }"

def open_keuze(ctx, breed):
    pg = ctx.new_page()
    pg.set_viewport_size({'width': breed, 'height': 844})
    pg.on('pageerror', lambda e: fouten.append(str(e)[:300])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("() => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_solo_niveau_pesten', 'makkelijk') }")
    pg.goto(BASIS + 'spel.html?spel=pesten&titel=1')
    pg.wait_for_selector('.niveau-btn[data-niveau=makkelijk]', timeout=10000)
    pg.click('.niveau-btn[data-niveau=makkelijk]')
    wacht(pg, MIJN_BEURT)
    pg.click('.kt-stijlknop')
    pg.wait_for_selector('.kt-stijlkeus .kt-stijlrij', timeout=5000)
    time.sleep(0.2)
    return pg

def veeg(pg, sel, dx):
    """Een echte vinger-veeg over de rij: dx < 0 = vinger naar links, dus verder naar rechts in de rij."""
    x, y = pg.eval_on_selector(sel, "e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }")
    cdp = pg.context.new_cdp_session(pg)
    stap = dx / 15
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    for i in range(1, 16):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + stap * i, 'y': y}]}); time.sleep(0.016)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    time.sleep(0.6)

try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        ctx = br.new_context(service_workers='block', locale='nl-NL', has_touch=True, is_mobile=True, device_scale_factor=3, reduced_motion='reduce')
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))

        pg = open_keuze(ctx, 390)
        # A
        l, r, w = pg.evaluate(VAK)
        check(l >= 0 and r <= w, 'A: het keuzevenster valt niet buiten het scherm (390 breed)', [round(l), round(r), w])
        # B
        rij = pg.evaluate(RIJ, '.kt-stijlrij')
        check(rij['scrollW'] > rij['clientW'] + 20 and rij['overflow'] in ('auto', 'scroll'), 'B: de rij kaarten is breder dan het scherm en scrollbaar',
              (rij['scrollW'], rij['clientW'], rij['overflow']))
        if FOTO: pg.screenshot(path=FOTO)
        aan = [k for k in rij['knoppen'] if k['aan']]
        check(len(aan) == 1 and aan[0]['id'] == 'vrolijk' and aan[0]['inBeeld'], 'B: Vrolijk (gekozen) staat meteen helemaal in beeld', aan)
        # C: vegen naar het begin en naar het eind
        veeg(pg, '.kt-stijlrij', 300)
        rij = pg.evaluate(RIJ, '.kt-stijlrij')
        check(rij['links'] <= 1 and rij['knoppen'][0]['inBeeld'], 'C: met een veeg naar rechts zie je de eerste kaart (Stekky) helemaal',
              (rij['links'], rij['knoppen'][0]))
        veeg(pg, '.kt-stijlrij', -300)
        rij = pg.evaluate(RIJ, '.kt-stijlrij')
        check(rij['links'] > 20 and rij['knoppen'][-1]['inBeeld'], 'C: met een veeg naar links zie je de laatste kaart helemaal',
              (rij['links'], rij['knoppen'][-1]))
        bx = pg.eval_on_selector('.kt-stijlrij', "e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }")
        pg.mouse.move(bx[0], bx[1]); pg.mouse.wheel(-3000, 0); time.sleep(0.5)
        check(pg.evaluate(RIJ, '.kt-stijlrij')['links'] <= 1, 'C: het muiswiel (opzij) scrolt de rij ook')
        # D
        t = pg.evaluate(RIJ, '.kt-tafelrij')
        midden = t and abs(t['knoppen'][0]['links'] - t['knoppen'][-1]['rechts']) <= 4
        check(t and len(t['knoppen']) == 2 and all(k['inBeeld'] for k in t['knoppen']) and t['scrollW'] <= t['clientW'] + 1 and midden,
              'D: de twee tafels passen en staan in het midden', t and [(k['id'], round(k['links']), round(k['rechts'])) for k in t['knoppen']])
        # E: kiezen na het vegen
        pg.eval_on_selector('.kt-stijlkeuze[data-stijl=perkament]', "e => e.scrollIntoView({ inline: 'center', block: 'nearest' })")
        time.sleep(0.3)
        pg.tap('.kt-stijlkeuze[data-stijl=perkament]')
        check(wacht(pg, "() => !document.querySelector('.kt-stijlkeus')", 3000), 'E: na het kiezen gaat de keuze dicht')
        check(pg.evaluate("() => localStorage.getItem('fibro_kaartstijl')") == 'perkament', 'E: Perkament is bewaard')
        pg.close()

        # F: heel smal scherm
        pg = open_keuze(ctx, 320)
        l, r, w = pg.evaluate(VAK)
        check(l >= 0 and r <= w, 'F: ook op 320 breed valt het venster niet buiten het scherm', [round(l), round(r), w])
        k = pg.evaluate("() => { const k = document.querySelector('.kt-stijlkeus .kt-keuzekaart').getBoundingClientRect(); return [k.top, k.bottom, innerHeight] }")
        check(k[0] >= 0 and k[1] <= k[2], 'F: en ook niet boven of onder het scherm', [round(x) for x in k])
        pg.close()
        check(not fouten, 'F: geen paginafouten', fouten)
        br.close()
except Exception as e:
    check(False, 'proef afgebroken: ' + str(e)[:300])
finally:
    srv.terminate()

print()
print('ALLES GOED' if not fout else '%d FOUT: %s' % (len(fout), '; '.join(fout)))
sys.exit(1 if fout else 0)
