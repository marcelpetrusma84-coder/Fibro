# proef314 (18 nov 2026, Marcel): de PeerTube-widget (peertube.js) in een echte browser (Chromium, telefoonformaat).
# Met de huisregel (Content-Security-Policy) van index.html, en een nep-PeerTube-server (framatube.org wordt onderschept).
#  A. leeg: "Nog geen video"; een YouTube-link of onbekende server wordt geweigerd met een melding
#  B. een goede link + titel: bewaard, kaartje met titel en "van framatube.org", nog GEEN verbinding met framatube.org
#  C. Afspelen: pas nu laadt de speler; zonder p2p en PeerTube-link, in een afgesloten kader (geen nieuwe vensters)
#  D. Stoppen: de speler is weg; Wijzigen > Weghalen: weer leeg
#  E. bij een vriend: geen Wijzigen-knop; een link naar een andere server (van een "vriend") wordt niet getoond
#  F. de huisregel houdt een speler van een niet-goedgekeurde server tegen; geen paginafouten
# python3 -I proef314.py <map>
import sys, os, re, json, http.server, threading, socketserver, functools
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=MAP)
Handler.log_message = lambda *a: None
srv = socketserver.TCPServer(('127.0.0.1', 0), Handler)
poort = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', open(os.path.join(MAP, 'index.html'), encoding='utf-8').read()).group(0)
PAGINA = '''<!doctype html><html><head><meta charset="utf-8">''' + csp + '''
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#1a0a2e;color:#fff;font-family:sans-serif;margin:0}.w{width:360px;min-height:240px;flex-direction:column;margin:12px;border-radius:14px;background:rgba(255,255,255,.08);padding:10px;box-sizing:border-box;display:flex}</style>
</head><body><div class="w" id="w"></div><div class="w" id="v"></div>
<script type="module">
import * as P from './peertube.js?v=3'
window.P = P
window.csp = []
document.addEventListener('securitypolicyviolation', e => window.csp.push(e.blockedURI))
const w = document.getElementById('w')
window.teken = () => { w.textContent = ''; P.tekenPeertubeWidget(w, { cfg: JSON.parse(localStorage.getItem('peertube_ik') || 'null'), eigen: true,
  bewaar: c => { if (c) localStorage.setItem('peertube_ik', JSON.stringify(c)); else localStorage.removeItem('peertube_ik'); window.teken() } }) }
window.vriend = cfg => { const v = document.getElementById('v'); v.textContent = ''; P.tekenPeertubeWidget(v, { cfg }) }
window.teken()
window.klaar = true
</script></body></html>'''

NEP = '''<!doctype html><html><body style="background:#123;color:#fff">nep-peertube
<script>
let open = 'fout'
try { open = window.open('https://framatube.org/w/xyz') === null ? 'tegengehouden' : 'geopend' } catch (e) { open = 'tegengehouden' }
parent.postMessage({ nep: true, open }, '*')
</script></body></html>'''

KORT = 'kkGMgK9ZtnKfYAgnEtQxbv'
def wacht(p, js, ms=5000):  # wait_for_function gebruikt eval, en dat houdt de huisregel (terecht) tegen
    for _ in range(ms // 100):
        if p.evaluate(js): return True
        p.wait_for_timeout(100)
    return False
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page(viewport={'width': 390, 'height': 800})
    p.on('pageerror', lambda e: fout.append('paginafout: ' + str(e)))
    naar_framatube = []
    def framatube(route):
        naar_framatube.append(route.request.url)
        route.fulfill(status=200, content_type='text/html', body=NEP)
    p.route('https://framatube.org/**', framatube)
    p.route(f'http://127.0.0.1:{poort}/__peertube-proef.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGINA))
    p.goto(f'http://127.0.0.1:{poort}/__peertube-proef.html')
    wacht(p, 'window.klaar === true')
    p.evaluate("window.berichten = []; addEventListener('message', e => window.berichten.push(e.data))")

    # A
    check('Nog geen video' in p.inner_text('#w'), 'A leeg: "Nog geen video"')
    p.click('#w .pt-kies')
    p.fill('#w .pt-link', 'https://www.youtube.com/watch?v=abc')
    p.click('#w .pt-opslaan')
    check('niet in de lijst' in p.inner_text('#w .pt-melding'), 'A YouTube-link: melding "niet in de lijst"')
    p.fill('#w .pt-link', 'https://framatube.org/w/p/' + KORT)
    p.click('#w .pt-opslaan')
    check('Afspeellijsten' in p.inner_text('#w .pt-melding'), 'A afspeellijst: melding')
    check(p.evaluate("localStorage.getItem('peertube_ik')") is None, 'A niets bewaard bij een foute link')

    # B
    p.fill('#w .pt-link', 'https://framatube.org/w/' + KORT)
    p.fill('#w .pt-titel', 'Mijn filmpje')
    p.click('#w .pt-opslaan')
    cfg = json.loads(p.evaluate("localStorage.getItem('peertube_ik')") or 'null')
    check(cfg == {'server': 'framatube.org', 'id': KORT, 'titel': 'Mijn filmpje'}, 'B bewaard: ' + json.dumps(cfg))
    t = p.inner_text('#w')
    check('Mijn filmpje' in t and 'van framatube.org' in t and 'verbinding met framatube.org' in t, 'B kaartje met titel, server en uitleg')
    p.wait_for_timeout(500)
    check(p.locator('iframe').count() == 0 and naar_framatube == [], 'B nog geen speler en geen verbinding met framatube.org')

    # C
    p.click('#w .pt-speel')
    check(wacht(p, 'window.berichten.some(m => m && m.nep)'), 'C de nep-speler is geladen')
    src = p.get_attribute('#w iframe.pt-speler', 'src') or ''
    check(src.startswith('https://framatube.org/videos/embed/' + KORT + '?') and 'p2p=0' in src and 'peertubeLink=0' in src, 'C speler geladen zonder p2p en PeerTube-link')
    check(len(naar_framatube) == 1, 'C precies één verzoek naar framatube.org: ' + str(len(naar_framatube)))
    check(p.get_attribute('#w iframe', 'sandbox') == 'allow-scripts allow-same-origin', 'C afgesloten kader')
    check(p.get_attribute('#w iframe', 'referrerpolicy') == 'no-referrer', 'C geen referrer')
    nep = [m for m in p.evaluate('window.berichten') if m and m.get('nep')][0]
    check(nep['open'] == 'tegengehouden', 'C de speler kan geen nieuw venster openen: ' + nep['open'])
    check(len(b.contexts[0].pages) == 1, 'C geen extra tabblad')
    box = p.locator('#w iframe').bounding_box()
    check(box and box['width'] > 300 and abs(box['width'] / box['height'] - 16 / 9) < 0.05, 'C 16:9 en breed genoeg')

    # D
    p.click('#w .pt-stop')
    check(p.locator('iframe').count() == 0 and 'Mijn filmpje' in p.inner_text('#w'), 'D gestopt: speler weg, kaartje terug')
    p.click('#w .pt-wijzig')
    check(p.input_value('#w .pt-link') == 'https://framatube.org/w/' + KORT, 'D Wijzigen: de link staat erin')
    p.click('#w .pt-weg')
    check(p.evaluate("localStorage.getItem('peertube_ik')") is None and 'Nog geen video' in p.inner_text('#w'), 'D weggehaald: weer leeg')

    # E
    p.evaluate("window.vriend({ server: 'framatube.org', id: '%s', titel: 'Van Bram' })" % KORT)
    t = p.inner_text('#v')
    check('Van Bram' in t and p.locator('#v .pt-wijzig').count() == 0 and p.locator('#v .pt-speel').count() == 1, 'E bij een vriend: wel Afspelen, geen Wijzigen')
    p.evaluate("window.vriend({ server: 'kwaad.example', id: '%s', titel: 'Kwaad' })" % KORT)
    check('Kwaad' not in p.inner_text('#v') and p.locator('#v .pt-speel').count() == 0, 'E andere server van een vriend: niet getoond')

    # F
    p.evaluate("""() => { const f = document.createElement('iframe'); f.src = 'https://kwaad.example/videos/embed/x'; document.body.appendChild(f) }""")
    check(wacht(p, "window.csp.some(u => u.includes('kwaad.example'))"), 'F de huisregel houdt kwaad.example tegen')
    check(not any('framatube' in u for u in p.evaluate('window.csp')), 'F framatube.org is wel toegestaan')
    b.close()

print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
