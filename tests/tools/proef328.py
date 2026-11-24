# proef328 (24 nov 2026): veel meer gebruikersnamen en "Zelf samenstellen" (naambouwer.js) bij registreren.
#  Voor login.html en invite.html:
#  A. de pagina vult zelf een gebruikersnaam in, zonder paginafouten (invite.html: na een geldige uitnodiging)
#  B. de generatorknop geeft steeds andere namen, uit de nieuwe lijsten
#  C. "Zelf samenstellen" opent drie keuzelijstjes naast elkaar; een keuze verandert de naam; het veld blijft op slot
#  D. 🔄 bij een stukje verandert alleen dat stukje; "Geen" einde mag; Klaar sluit het paneel
#  E. na de generatorknop staan de keuzelijstjes op de nieuwe naam
#  F. in het Engels staan de knop en de groepjes in het Engels (de woorden zelf niet)
#  Op de oude versie (zonder naambouwer.js) gaan C t/m F mis.
# python3 -I proef328.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef328_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
PAGINAS = [('login.html#registreren', 'reg-username', 'reg-naam-zelf'), ('invite.html?token=proef328', 'gebruikersnaam', 'naam-zelf')]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        for taal in ('nl', 'en'):
            for pad, veld, zelf in PAGINAS:
                naam = pad.split('.html')[0] + ' (' + taal + ')'
                ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844})
                ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
                ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
                ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
                pg = ctx.new_page(); fouten = []
                pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
                pg.goto(BASIS + 'manifest.json')
                pg.evaluate("t => localStorage.setItem('fibro_taal', t)", taal)
                pg.goto(BASIS + pad)
                if pad.startswith('invite'):
                    # Zonder echte uitnodiging (Supabase is hier nep) blijft het scherm verborgen: zet het zelf open,
                    # zoals invite.html doet na een geldige uitnodiging (en dan nieuweNaam()).
                    pg.wait_for_function("() => typeof window.nieuweNaam === 'function'", timeout=10000)
                    pg.evaluate("() => { document.getElementById('uitnodigingScherm').style.display = 'block'; window.nieuweNaam() }")
                waarde = lambda: pg.evaluate("id => document.getElementById(id).value", veld)
                try:
                    pg.wait_for_function("id => (document.getElementById(id) || {}).value", arg=veld, timeout=10000); a = True
                except Exception: a = False
                check(a, naam + ' A: vult zelf een gebruikersnaam in')
                if taal == 'nl':
                    # ── B ──
                    gezien = set()
                    for _ in range(12):
                        pg.evaluate("() => window.nieuweNaam()"); gezien.add(waarde())
                    check(len(gezien) >= 10, naam + ' B: generator geeft steeds andere namen (%d van 12)' % len(gezien))
                    # ── C ──
                    pg.click('#' + zelf)
                    check(pg.is_visible('#naambouwer'), naam + ' C: paneel Zelf samenstellen open')
                    check(pg.get_attribute('#' + zelf, 'aria-expanded') == 'true', naam + ' C: knop zegt dat het paneel open is')
                    check(pg.locator('#naambouwer select').count() == 3, naam + ' C: drie keuzelijstjes')
                    vakken = pg.eval_on_selector_all('#naambouwer select', 'ss => ss.map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left), Math.round(r.right)] })')
                    check(len(set(v[0] for v in vakken)) == 1 and vakken[0][2] <= vakken[1][1] and vakken[1][2] <= vakken[2][1],
                          naam + ' C: begin, midden en einde staan naast elkaar (%s)' % vakken)
                    breed = pg.evaluate("() => [document.documentElement.scrollWidth, innerWidth]")
                    check(breed[0] <= breed[1], naam + ' C: paneel past op een telefoon, niets steekt uit (%s)' % breed)
                    groepen = pg.eval_on_selector_all('#naambouwer select[data-deel=midden] optgroup', 'gs => gs.map(g => g.label)')
                    check(groepen == ['Dieren', 'Fantasie', 'Eten', 'Dingen en geluiden'], naam + ' C: groepjes bij dier of woord (%s)' % groepen)
                    pg.select_option('#naambouwer select[data-deel=begin]', 'Gekke')
                    pg.select_option('#naambouwer select[data-deel=midden]', 'Stroopwafel')
                    pg.select_option('#naambouwer select[data-deel=einde]', 'Koning')
                    check(waarde() == 'GekkeStroopwafelKoning', naam + ' C: zelf samengesteld: %s' % waarde())
                    check(pg.evaluate("id => document.getElementById(id).readOnly", veld), naam + ' C: naamveld blijft op slot')
                    # ── D ──
                    for _ in range(8):
                        pg.click('#naambouwer button.naambouwer-schud[data-deel=midden]')
                        if waarde() != 'GekkeStroopwafelKoning': break
                    w = waarde()
                    check(w.startswith('Gekke') and w.endswith('Koning') and w != 'GekkeStroopwafelKoning', naam + ' D: 🔄 verandert alleen het middelste stukje (%s)' % w)
                    pg.select_option('#naambouwer select[data-deel=einde]', '')
                    check(not re.search(r'Koning$', waarde()) and waarde().startswith('Gekke'), naam + ' D: zonder einde: %s' % waarde())
                    pg.click('#naambouwer .naambouwer-klaar')
                    check(not pg.is_visible('#naambouwer'), naam + ' D: Klaar sluit het paneel')
                    # ── E ──
                    pg.evaluate("() => window.nieuweNaam()")
                    pg.click('#' + zelf)
                    keuze = pg.evaluate("() => [...document.querySelectorAll('#naambouwer select')].map(s => s.value).join('')")
                    check(keuze == waarde(), naam + ' E: keuzelijstjes volgen de generator (%s / %s)' % (keuze, waarde()))
                else:
                    # ── F ──
                    check(pg.inner_text('#' + zelf).strip() == '✏️ Build it yourself', naam + ' F: knop in het Engels (%s)' % pg.inner_text('#' + zelf))
                    pg.click('#' + zelf)
                    groepen = pg.eval_on_selector_all('#naambouwer select[data-deel=midden] optgroup', 'gs => gs.map(g => g.label)')
                    check(groepen == ['Animals', 'Fantasy', 'Food', 'Things and sounds'], naam + ' F: groepjes in het Engels (%s)' % groepen)
                    check(pg.locator('#naambouwer select[data-deel=midden] option[value=Kikker]').count() == 1, naam + ' F: de woorden zelf blijven zoals ze zijn')
                check(not fouten, naam + ': geen paginafouten (%s)' % fouten)
                ctx.close()
        b.close()
finally:
    srv.terminate()
print('\n%d fout(en)' % len(fout) if fout else '\nAlles goed')
sys.exit(1 if fout else 0)
