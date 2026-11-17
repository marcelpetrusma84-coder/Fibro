# proef309 (17 nov 2026, Marcel): in het witte inlogvak was de tekst vaag (zwarte schaduw door de achtergrondfoto),
# en het oogje bij het wachtwoord was een emoji (👁 / 🙈). Nu:
#  A. login met achtergrondfoto: geen schaduw op de tekst in het witte vak (Gebruikersnaam, Wachtwoord vergeten, versleuteld)
#  B. de tekst buiten het vak (Je eigen plekkie) houdt zijn schaduw
#  C. het oogje is een SVG-lijntekening, geen emoji, en wisselt tussen tonen en verbergen
#  D. hetzelfde op de uitnodigingspagina
#  E. geen paginafouten
# python3 -I proef309.py <map> [schermafdruk-map]
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
FOTO = sys.argv[2] if len(sys.argv) > 2 else None
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef309_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
SCHADUW = "sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent && e.textContent.trim()).map(e => getComputedStyle(e).textShadow)"
OOG = """kaart => { const o = document.querySelector(kaart + ' .ww-oog'); if (!o) return null
  return { svg: !!o.querySelector('svg'), tekst: o.textContent.trim(), druk: o.getAttribute('aria-pressed'),
    soort: o.parentElement.querySelector('input').type } }"""

def proef(pg, naam, kaart, binnen):
    pg.evaluate("() => document.body.classList.add('heeft-wallpaper')")
    sch = pg.evaluate(SCHADUW, ', '.join(kaart + ' ' + b for b in binnen))
    check(len(sch) > 0 and all(x == 'none' for x in sch), '%s: geen schaduw op tekst in het witte vak %s' % (naam, sorted(set(sch))))
    o = pg.evaluate(OOG, kaart)
    check(o and o['svg'] and o['tekst'] == '' and o['soort'] == 'password' and o['druk'] == 'false', '%s: oogje is een SVG zonder emoji %s' % (naam, o))
    pg.click(kaart + ' .ww-oog >> nth=0')
    o = pg.evaluate(OOG, kaart)
    check(o and o['svg'] and o['tekst'] == '' and o['soort'] == 'text' and o['druk'] == 'true', '%s: na tikken is het wachtwoord zichtbaar, nog steeds SVG %s' % (naam, o))
    pg.click(kaart + ' .ww-oog >> nth=0')
    check(pg.evaluate(OOG, kaart)['soort'] == 'password', '%s: nog een keer tikken verbergt het weer' % naam)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append('login: ' + str(e)[:300])); pg.on('dialog', lambda d: d.dismiss())
        pg.goto(BASIS + 'login.html'); pg.wait_for_selector('.card .ww-oog', timeout=10000)
        proef(pg, 'login', '.card', ['label', 'a', '.e2e-badge', 'p', 'span'])
        sch = pg.evaluate(SCHADUW, '.logo p')
        check(len(sch) > 0 and all(x != 'none' for x in sch), 'B: tekst buiten het vak houdt zijn schaduw %s' % sch)
        if FOTO: pg.screenshot(path=os.path.join(FOTO, 'login.png'))
        pg2 = ctx.new_page(); pg2.on('pageerror', lambda e: fouten.append('invite: ' + str(e)[:300])); pg2.on('dialog', lambda d: d.dismiss())
        pg2.goto(BASIS + 'invite.html?code=PROEF'); pg2.wait_for_selector('.kaart .ww-oog', state='attached', timeout=10000)
        pg2.evaluate("() => document.querySelectorAll('.kaart [hidden], .kaart [style*=\"display:none\"]').forEach(e => { e.hidden = false; e.style.display = '' })")
        proef(pg2, 'uitnodiging', '.kaart', ['label', 'p'])
        if FOTO: pg2.screenshot(path=os.path.join(FOTO, 'invite.png'))
        b.close()
    check(not fouten, 'E: geen paginafouten %s' % fouten)
finally:
    srv.terminate()
print('\nKLAAR: ' + ('alles goed' if not fout else '%d fout(en)' % len(fout)))
sys.exit(1 if fout else 0)
