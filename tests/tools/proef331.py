# proef331 (25 nov 2026, Marcel): de PeerTube-widget met categorieën (peertube.js v4), bijvoorbeeld alleen Gaming.
# Met de huisregel (Content-Security-Policy) van index.html, en een nep-PeerTube-server (spectra.video wordt onderschept).
#  A. leeg: naast "Video kiezen" ook "Categorie kiezen"; Gaming staat al aangevinkt; zonder vinkje: melding, niets bewaard
#  B. Gaming + Muziek: precies één vraag aan de server (alleen eigen video's, geen 18+), live-uitzendingen eruit;
#     de lijst staat in de widget met titel, kanaal en duur; nog geen speler
#  C. tik op een video: pas nu de speler (zonder p2p, in een afgesloten kader); "Terug naar de lijst"
#  D. Wijzigen: de vinkjes staan er nog; wisselen naar "Eén video" en terug; Annuleren
#  E. bij een vriend: de lijst zonder Wijzigen, en zonder dat de vriend de server iets vraagt; een andere server niet
#  F. geeft de server geen antwoord: een melding en niets bewaard; geen paginafouten
# python3 -I proef331.py <map>
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
import * as P from './peertube.js?v=4'
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
try { open = window.open('https://spectra.video/w/xyz') === null ? 'tegengehouden' : 'geopend' } catch (e) { open = 'tegengehouden' }
parent.postMessage({ nep: true, open }, '*')
</script></body></html>'''

KORT = 'kkGMgK9ZtnKfYAgnEtQxbv'
UUID = '9c9de5e8-0a1e-484a-b099-e80766180a6d'
API = {'total': 3, 'data': [
    {'shortUUID': KORT, 'uuid': UUID, 'name': 'Speedrun level 1', 'duration': 125, 'channel': {'displayName': 'Retro Gamer'}},
    {'shortUUID': 'nietgoed', 'uuid': UUID, 'name': 'Gitaarles', 'duration': 3725, 'channel': {'name': 'muziekkanaal'}},
    {'shortUUID': KORT, 'uuid': UUID, 'name': 'Nu live', 'isLive': True, 'channel': {'displayName': 'Live'}}]}
def wacht(p, js, ms=5000):  # wait_for_function gebruikt eval, en dat houdt de huisregel (terecht) tegen
    for _ in range(ms // 100):
        if p.evaluate(js): return True
        p.wait_for_timeout(100)
    return False
STAND = {'api': 'goed'}
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page(viewport={'width': 390, 'height': 800})
    p.on('pageerror', lambda e: fout.append('paginafout: ' + str(e)))
    naar_api, naar_speler = [], []
    def spectra(route):
        u = route.request.url
        if '/api/v1/videos' in u:
            naar_api.append(u)
            if STAND['api'] == 'kapot': return route.fulfill(status=503, headers={'Access-Control-Allow-Origin': '*'}, body='weg')
            return route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body=json.dumps(API))
        naar_speler.append(u)
        route.fulfill(status=200, content_type='text/html', body=NEP)
    p.route('https://spectra.video/**', spectra)
    p.route(f'http://127.0.0.1:{poort}/__peertube-proef.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGINA))
    p.goto(f'http://127.0.0.1:{poort}/__peertube-proef.html')
    wacht(p, 'window.klaar === true')
    p.evaluate("window.berichten = []; addEventListener('message', e => window.berichten.push(e.data))")
    opgeslagen = lambda: json.loads(p.evaluate("localStorage.getItem('peertube_ik')") or 'null')
    vinkjes = lambda: p.evaluate("[...document.querySelectorAll('#w .pt-cats input:checked')].map(i => +i.value)")

    # A
    check(p.locator('#w .pt-kies').count() == 1 and p.locator('#w .pt-kies-cat').count() == 1, 'A leeg: "Video kiezen" en "Categorie kiezen"')
    p.click('#w .pt-kies-cat')
    check(p.input_value('#w .pt-server') == 'spectra.video', 'A standaard de gaming-server spectra.video')
    check(vinkjes() == [7], 'A Gaming staat al aangevinkt (%s)' % vinkjes())
    check(p.locator('#w .pt-cats input').count() == 18, 'A alle 18 categorieën van PeerTube om aan te vinken')
    p.uncheck('#w .pt-cats input[value="7"]')
    p.click('#w .pt-opslaan')
    check('Vink eerst' in p.inner_text('#w .pt-melding') and opgeslagen() is None and not naar_api, 'A zonder vinkje: melding, niets bewaard, niets gevraagd')

    # B
    p.check('#w .pt-cats input[value="7"]'); p.check('#w .pt-cats input[value="1"]')
    p.click('#w .pt-opslaan')
    check(wacht(p, "!!document.querySelector('#w .pt-lijst')"), 'B de lijst staat in de widget')
    check(len(naar_api) == 1, 'B precies één vraag aan de server (%s)' % len(naar_api))
    if naar_api:
        q = naar_api[0]
        check('categoryOneOf=7' in q and 'categoryOneOf=1' in q and 'isLocal=true' in q and 'nsfw=false' in q, 'B Gaming en Muziek, alleen eigen video\'s, geen 18+ (%s)' % q.split('?')[1])
    cfg = opgeslagen() or {}
    check(cfg.get('soort') == 'categorie' and cfg.get('cats') == [7, 1] and cfg.get('server') == 'spectra.video', 'B bewaard als categorie: %s' % {k: cfg.get(k) for k in ('soort', 'cats', 'server')})
    check([v['titel'] for v in cfg.get('videos', [])] == ['Speedrun level 1', 'Gitaarles'], 'B live-uitzending eruit, video zonder korte code via uuid (%s)' % [v['titel'] for v in cfg.get('videos', [])])
    t = p.inner_text('#w')
    check('Gaming' in t and 'Muziek' in t and 'Speedrun level 1' in t and 'Retro Gamer · 2:05' in t and 'muziekkanaal · 1:02:05' in t, 'B titel, kanaal en duur in de lijst')
    p.wait_for_timeout(300)
    check(p.locator('iframe').count() == 0 and not naar_speler, 'B nog geen speler en geen verbinding voor video')

    # C
    p.click('#w .pt-video[data-id="%s"]' % UUID)
    check(wacht(p, 'window.berichten.some(m => m && m.nep)'), 'C de speler is geladen na een tik')
    src = p.get_attribute('#w iframe.pt-speler', 'src') or ''
    check(src.startswith('https://spectra.video/videos/embed/' + UUID + '?') and 'p2p=0' in src and 'peertubeLink=0' in src, 'C de gekozen video, zonder p2p en PeerTube-link')
    check(p.get_attribute('#w iframe', 'sandbox') == 'allow-scripts allow-same-origin', 'C afgesloten kader')
    check('Terug naar de lijst' in p.inner_text('#w .pt-stop'), 'C knop "Terug naar de lijst"')
    p.click('#w .pt-stop')
    check(p.locator('iframe').count() == 0 and p.locator('#w .pt-video').count() == 2, 'C terug: speler weg, lijst terug')

    # D
    p.click('#w .pt-wijzig')
    check(sorted(vinkjes()) == [1, 7], 'D Wijzigen: Gaming en Muziek staan aangevinkt (%s)' % vinkjes())
    p.click('#w .pt-soort[data-soort="video"]')
    check(p.locator('#w .pt-link').count() == 1 and p.input_value('#w .pt-link') == '', 'D wisselen naar "Eén video": een leeg linkveld')
    p.click('#w .pt-soort[data-soort="categorie"]')
    check(p.locator('#w .pt-cats').count() == 1, 'D en weer terug naar categorieën')
    p.click('#w button:has-text("Annuleren")')
    check(p.locator('#w .pt-video').count() == 2 and len(naar_api) == 1, 'D Annuleren: de lijst, zonder opnieuw te vragen')

    # E
    voor = len(naar_api)
    p.evaluate("window.vriend(%s)" % json.dumps(cfg))
    check(p.locator('#v .pt-video').count() == 2 and p.locator('#v .pt-wijzig').count() == 0, 'E bij een vriend: de lijst, zonder Wijzigen')
    p.wait_for_timeout(300)
    check(len(naar_api) == voor, 'E de vriend vraagt de server niets')
    kwaad = dict(cfg, server='kwaad.example')
    p.evaluate("window.vriend(%s)" % json.dumps(kwaad))
    check(p.locator('#v .pt-video').count() == 0 and 'Speedrun' not in p.inner_text('#v'), 'E een lijst van een andere server: niet getoond')

    # F
    p.evaluate("localStorage.removeItem('peertube_ik'); window.teken()")
    STAND['api'] = 'kapot'
    p.click('#w .pt-kies-cat'); p.click('#w .pt-opslaan')
    check(wacht(p, "(document.querySelector('#w .pt-melding') || {}).textContent?.includes('geen antwoord')"), 'F geen antwoord van de server: een melding')
    check(opgeslagen() is None, 'F niets bewaard')
    b.close()

print('\nKLAAR: alles goed' if not fout else '\nMISLUKT: ' + '; '.join(fout))
sys.exit(1 if fout else 0)
