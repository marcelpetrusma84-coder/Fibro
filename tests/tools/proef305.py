# proef305 (17 nov 2026): Moderatie > Fouten groepeert dezelfde fout op één kaart (foutgroepen.js), ook als hij op
# een andere regel of pagina gebeurde; nieuwste bovenaan; Opgelost wist alle meldingen van de kaart.
# python -I tests/tools/proef305.py <map>
import json, os, re, socket, subprocess, sys, tempfile, time, urllib.parse
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fouten = []
def check(ok, tekst):
    print(('OK   ' if ok else 'FOUT ') + tekst)
    if not ok: fouten.append(tekst)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600,
                    "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def rij(i, t, pagina, soort, bericht, bron):
    return {"id": i, "created_at": "2026-11-%sZ" % t, "pagina": pagina, "soort": soort, "bericht": bericht, "bron": bron,
            "stapel": None, "toestel": "iPhone iOS 18.7 · Safari 27.2"}
RIJEN = [
    rij(1, '13T11:21:00', 'index.html', 'belofte', 'TypeError: Script service-worker.js load failed', ''),
    rij(2, '09T15:33:00', 'index.html', 'fout', "ReferenceError: Can't find variable: FileReader", 'index.html:1144:36'),
    rij(3, '09T15:33:00', 'vriend-profiel.html', 'belofte', "ReferenceError: Can't find variable: indexedDB", ''),
    rij(4, '09T15:31:00', 'profiel.html', 'belofte', "ReferenceError: Can't find variable: indexedDB", ''),
    rij(5, '09T15:30:00', 'index.html', 'fout', "ReferenceError: Can't find variable: FileReader", 'index.html:1542:36'),
    rij(6, '09T15:29:00', 'index.html', 'fout', "ReferenceError: Can't find variable: FileReader", 'index.html:1144:36'),
]
STAND = {'gewist': []}

def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=True)
    if '/rest/v1/foutmeldingen' in u and m == 'GET':
        return route.fulfill(status=200, json=[r for r in RIJEN if r['id'] not in STAND['gewist']])
    if '/rest/v1/foutmeldingen' in u and m == 'DELETE':
        ids = re.search(r'id=in\.\(([^)]*)\)', urllib.parse.unquote(u))
        if ids: STAND['gewist'] += [int(x) for x in ids.group(1).split(',') if x]
        return route.fulfill(status=204, body='')
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/' in u: return route.fulfill(status=200, json=[])
    return route.fulfill(status=204, body='')

sock = socket.socket(); sock.bind(('127.0.0.1', 0)); poort = sock.getsockname()[1]; sock.close()
www = tempfile.mkdtemp(prefix='proef305_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
basis = 'http://127.0.0.1:%d/Fibro/' % poort
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), supa)
        ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ")}catch(e){}")
        pg = ctx.new_page(); paginafouten = []
        pg.on('pageerror', lambda e: paginafouten.append(str(e)))
        pg.goto(basis + 'moderatie.html')
        pg.wait_for_function("() => document.querySelectorAll('#foutenLijst .fout-kaart').length > 0", timeout=15000)
        kaarten = pg.evaluate("""() => [...document.querySelectorAll('#foutenLijst .fout-kaart')].map(k => ({
            bericht: k.querySelector('.fout-bericht').textContent,
            chips: [...k.querySelectorAll('.fout-kop .fout-chip')].map(c => c.textContent),
            tal: k.querySelector('.fout-tal').textContent,
            varianten: !!k.querySelector('details summary') && [...k.querySelectorAll('details summary')].some(s => s.textContent.startsWith('Varianten')) }))""")
        check(len(kaarten) == 3, '6 meldingen = 3 kaarten (%s)' % [k['bericht'][:30] for k in kaarten])
        check(kaarten[0]['bericht'].startswith('TypeError: Script service-worker'), 'nieuwste bovenaan')
        fr = next((k for k in kaarten if 'FileReader' in k['bericht']), None)
        check(fr and fr['tal'].startswith('3×') and fr['varianten'], 'FileReader op twee regels: één kaart, 3×, met varianten (%s)' % fr)
        idb = next((k for k in kaarten if 'indexedDB' in k['bericht']), None)
        check(idb and 'profiel.html' in idb['chips'] and 'vriend-profiel.html' in idb['chips'] and idb['tal'].startswith('2×'),
              'indexedDB: één kaart met beide pagina\'s (%s)' % idb)
        i = next(n for n, k in enumerate(kaarten) if 'FileReader' in k['bericht'])
        pg.evaluate('i => wisFoutGroep(i)', i)
        pg.wait_for_function("() => document.querySelectorAll('#foutenLijst .fout-kaart').length === 2", timeout=8000)
        check(sorted(STAND['gewist']) == [2, 5, 6], 'Opgelost wist alle 3 meldingen van de kaart (%s)' % STAND['gewist'])
        check(not paginafouten, 'geen paginafouten ' + str(paginafouten[:2]))
        browser.close()
finally:
    server.terminate()
print('\n' + ('ALLES GOED' if not fouten else '%d FOUT(EN)' % len(fouten)))
sys.exit(1 if fouten else 0)
