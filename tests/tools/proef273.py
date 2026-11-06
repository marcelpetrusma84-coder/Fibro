# proef273 (6 nov 2026, v272): drie meldingen van Marcel.
#  A. login.html: tik je op Inloggen voordat de app geladen is, dan GEEN fout "Can't find variable: inloggen" maar
#     "Even geduld, de app wordt geladen..." en zodra de app er is, gaat het inloggen gewoon door ("Vul alle velden in.")
#  B. balk-vast.js: na het verlaten van een invoerveld (toetsenbord dicht) schuift de pagina 1 pixel heen en terug,
#     zodat de iPhone de navigatiebalk weer onderaan zet; ook na 'fibro-spel-dicht'. Staat op de vijf pagina's met een balk.
#  C. bellen.html: knop 'Tik voor geluid' (verborgen tot het geluid geblokkeerd is), microfoonhulp en de controle na 20 s
# python3 -I proef273.py <map>
import sys, os, time, socket, subprocess, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/' % poort
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ── A ──
        ctx = b.new_context(service_workers='block', locale='nl-NL')
        pg = ctx.new_page(); paginafouten = []
        pg.on('pageerror', lambda e: paginafouten.append(str(e)))
        vast = []
        pg.route('**/supabase-lib.js*', lambda r: vast.append(r))
        pg.goto(BASIS + 'login.html', wait_until='commit')  # module wacht nog: domcontentloaded komt pas later
        pg.wait_for_selector('#login-btn')
        pg.evaluate("document.getElementById('login-btn').click()")
        pg.wait_for_timeout(300)
        tekst = pg.inner_text('#login-msg')
        check('Even geduld' in tekst, 'A: tik voor het laden: "Even geduld" (%r)' % tekst)
        check(not any('inloggen' in f for f in paginafouten), 'A: geen fout "inloggen" (%s)' % paginafouten)
        for r in vast: r.continue_()
        pg.wait_for_timeout(1500)
        try: pg.wait_for_function("document.getElementById('login-msg').textContent.includes('Vul alle velden')", timeout=10000); ok = True
        except Exception: ok = False
        check(ok, 'A: na het laden gaat het inloggen gewoon door (%r)' % pg.inner_text('#login-msg'))
        ctx.close()

        # ── B ──
        ctx = b.new_context(service_workers='block', locale='nl-NL')
        pg = ctx.new_page()
        pg.route(BASIS + 'proef-balk.html', lambda r: r.fulfill(status=200, content_type='text/html',
            body='<!doctype html><meta charset="utf-8"><body style="height:3000px"><input id="i"><script>window.__s=[];var o=window.scrollTo.bind(window);window.scrollTo=function(x,y){window.__s.push(y);o(x,y)}</script><script src="balk-vast.js?v=1"></script>'))
        pg.goto(BASIS + 'proef-balk.html')
        pg.wait_for_timeout(300)
        pg.evaluate("window.scrollTo(0,200); window.__s=[]")
        pg.evaluate("document.getElementById('i').focus({preventScroll:true})"); pg.wait_for_timeout(100)
        check(pg.evaluate('window.__s.length') == 0, 'B: tijdens typen niets')
        pg.evaluate("document.getElementById('i').blur()"); pg.wait_for_timeout(700)
        s1 = pg.evaluate('window.__s')
        check(201 in s1 and s1[-1] == 200, 'B: toetsenbord dicht: 1 pixel heen en terug (%s)' % s1)
        check(pg.evaluate('window.scrollY') == 200, 'B: de pagina staat daarna weer op dezelfde plek')
        pg.evaluate("window.__s=[]; window.dispatchEvent(new CustomEvent('fibro-spel-dicht'))"); pg.wait_for_timeout(200)
        check(201 in pg.evaluate('window.__s'), 'B: ook na het sluiten van een spel')
        ctx.close()
        for f in ['vriend-profiel.html', 'index.html', 'chat.html', 'vrienden.html', 'profiel.html']:
            check('<script src="balk-vast.js?v=1"></script>' in open(os.path.join(MAP, f), encoding='utf-8').read(), 'B: ' + f + ' laadt balk-vast.js')

        # ── C ──
        html = open(os.path.join(MAP, 'bellen.html'), encoding='utf-8').read()
        check(re.search(r'id="geluidKnop" style="display:none', html) is not None, 'C: knop Tik voor geluid (eerst verborgen)')
        check("k.style.display = st.audioBlocked ? 'flex' : 'none'" in html, 'C: knop verschijnt als het geluid geblokkeerd is')
        check('onGeenMicrofoon: (e) => toonMicHulp(e)' in html, 'C: microfoonhulp als de microfoon niet lukt')
        check("'Gesprek: na 20 s nog geen goed geluid'" in html and 'controleerGeluid() // v163' in html, 'C: controle na 20 s')
        check("bellen.js?v=163'" in html, 'C: nieuwe bellen.js')
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
