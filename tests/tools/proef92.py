# proef92: het versienummer van elk spel, los van de app (v196). Echte profiel.html, tabblad Widgets, lijst Spellen.
#  A. elk van de 12 spellen heeft een eigen nummer ("v3"), tussen de tekst (naam + uitleg) en de toggle-knop, op dezelfde regel
#  B. de nummers kloppen met spelversies.js (Neon Raiders v3, Schaken v2, de rest v1); alle spellen uit chat.html en de
#     widgetlijst staan in spelversies.js en omgekeerd
#  C. los van de app: de nummers zijn niet gelijk aan het versienummer van Fibro; "Fibro v196" in het menu op Home blijft staan
#  D. de toggle-knop werkt nog (klik = aan/uit) en het nummer blijft staan; ook op een smal scherm (320 px) past alles
#     zonder zijwaarts scrollen, en de rij blijft een rij
#  E. Engels: het label voor schermlezers is 'version 3'; Nederlands 'versie 3'; geen paginafouten
# Oude map (v195) als controle: geen nummers (A-D MIS). v197: B2/C1 verwachten Schaken v3 en Fibro v197 of hoger.
# python3 -I proef92.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''), flush=True)
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "Marcel"}; return route.fulfill(status=200, json=e if obj else [e])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
RIJEN = """() => [...document.querySelectorAll('#panel-widgets .widget-item')].filter(r => r.querySelector('[id^=widget-spel_]')).map(r => {
  const info = r.querySelector('.widget-info').getBoundingClientRect(), tog = r.querySelector('[id^=widget-spel_]').getBoundingClientRect()
  const v = r.querySelector('[data-spelversie]'), vb = v ? v.getBoundingClientRect() : null, rb = r.getBoundingClientRect()
  return { naam: r.querySelector('[id^=widget-spel_]').id.replace('widget-spel_', ''), tekst: r.querySelector('.widget-name').textContent.trim(),
    versie: v ? v.textContent : null, label: v ? v.getAttribute('aria-label') : null, spel: v ? v.getAttribute('data-spelversie') : null,
    info: [info.left, info.right, info.top, info.bottom], v: vb ? [vb.left, vb.right, vb.top, vb.bottom, vb.width] : null, tog: [tog.left, tog.right, tog.top, tog.bottom], rij: [rb.left, rb.right, rb.top, rb.bottom] } })"""
def ronde(taal, breed):
    fouten = []
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server'])
        ctx = br.new_context(service_workers='block', viewport={'width': breed, 'height': 800})
        ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
        p.on('console', lambda m: fouten.append('console: ' + m.text[:120]) if '[taal] nog geen vertaling' in m.text else None)
        p.goto(B + 'manifest.json')
        p.evaluate("([t, taal]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', taal); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
        p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
        p.evaluate("() => switchTab('widgets')"); p.wait_for_timeout(800)
        rijen = p.evaluate(RIJEN)
        scrol = p.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
        # D: toggle klikken
        tog = None
        if rijen:
            sel = '#widget-spel_shmup'
            voor = p.evaluate("s => document.querySelector(s).className", sel)
            p.click(sel); p.wait_for_timeout(300)
            na = p.evaluate("s => document.querySelector(s).className", sel)
            v_na = p.evaluate("() => (document.querySelector('[data-spelversie=shmup]') || {}).textContent")
            p.click(sel); p.wait_for_timeout(300)
            terug = p.evaluate("s => document.querySelector(s).className", sel)
            tog = (voor, na, terug, v_na)
        br.close()
    return rijen, scrol, tog, fouten
def lees(pad): return open(os.path.join(MAP, pad), encoding='utf-8').read() if os.path.exists(os.path.join(MAP, pad)) else ''
try:
    rijen, scrol, tog, fouten = ronde('nl', 390)
    check('A1: 12 spellen in de lijst Spellen', len(rijen) == 12, len(rijen))
    check('A2: elk spel heeft een nummer "v<getal>"', len(rijen) == 12 and all(r['versie'] and re.fullmatch(r'v\d+', r['versie']) for r in rijen), [r['versie'] for r in rijen])
    def tussen(r):
        if not r['v']: return False
        gelijk = abs((r['v'][2] + r['v'][3]) / 2 - (r['tog'][2] + r['tog'][3]) / 2) < 12 and abs((r['info'][2] + r['info'][3]) / 2 - (r['tog'][2] + r['tog'][3]) / 2) < 30
        return r['info'][1] <= r['v'][0] + 0.5 and r['v'][1] <= r['tog'][0] + 0.5 and gelijk and r['v'][4] > 5
    check('A3: het nummer staat tussen de tekst en de toggle-knop, op dezelfde regel', len(rijen) == 12 and all(tussen(r) for r in rijen), [r['naam'] for r in rijen if not tussen(r)])
    check('A4: het nummer staat rechts (bij de toggle), niet midden in de rij', len(rijen) == 12 and all(r['v'] and r['tog'][0] - r['v'][1] < 30 for r in rijen), [round(r['tog'][0] - r['v'][1]) for r in rijen if r['v']])
    bron = lees('spelversies.js')
    kaart = {m.group(1): int(m.group(2)) for m in re.finditer(r'^\s+([a-z]+):\s*(\d+),', bron, re.M)}
    check('B1: spelversies.js heeft 12 spellen', len(kaart) == 12, kaart)
    # v197: Schaken v3 (PR #3); sindsdien: elk nummer hoogstens omhoog sinds v196 (Neon Raiders 3, Schaken 3, de rest 1)
    check('B2: Neon Raiders v3+, Schaken v3+, de rest v1+', kaart.get('shmup', 0) >= 3 and kaart.get('schaken', 0) >= 3 and all(n >= 1 for n in kaart.values()), kaart)
    check('B3: wat het scherm toont = wat spelversies.js zegt', len(rijen) == 12 and all(r['versie'] == 'v%s' % kaart.get(r['naam']) and r['spel'] == r['naam'] for r in rijen), [(r['naam'], r['versie']) for r in rijen])
    chat = lees('chat.html')
    in_chat = set(re.findall(r"startSpel\('([a-z]+)'\)", chat))
    check('B4: elk spel uit het speelmenu van chat.html staat in spelversies.js', in_chat <= set(kaart), sorted(in_chat - set(kaart)))
    check('B5: elk spel in spelversies.js is een spel uit de widgetlijst', set(kaart) == {r['naam'] for r in rijen}, sorted(set(kaart) ^ {r['naam'] for r in rijen}))
    idx = lees('index.html'); m = re.search(r'const FIBRO_VERSIE = (\d+)', idx); fv = int(m.group(1)) if m else 0
    check('C1: FIBRO_VERSIE is 197 of hoger en geen enkel spelnummer is gelijk aan het appnummer', fv >= 197 and all(n != fv for n in kaart.values()), (fv, kaart))
    check('C2: de app-versie staat niet in de spellijst (alleen spelnummers, geen "196" of "195")', len(rijen) == 12 and all(r['versie'] not in ('v%d' % fv, 'v196', 'v195') for r in rijen))
    check('D1: de toggle-knop werkt nog (uit -> aan -> uit) en het nummer blijft v3', tog and 'off' in tog[0] and 'on' in tog[1] and 'off' in tog[2] and tog[3] == 'v3', tog)
    check('D2: geen zijwaarts scrollen op 390 px', scrol <= 0, scrol)
    check('E1: Nederlands: label "versie 3" voor schermlezers', len(rijen) == 12 and [r for r in rijen if r['naam'] == 'shmup'][0]['label'] == 'versie 3', [r['label'] for r in rijen][:3])
    fouten_nl = fouten
    rijen2, scrol2, tog2, fouten2 = ronde('nl', 320)
    check('D3: op 320 px: nog 12 nummers, geen zijwaarts scrollen, de rij blijft één regel naast de toggle', len(rijen2) == 12 and scrol2 <= 0 and all(r['v'] and tussen(r) for r in rijen2), (len(rijen2), scrol2, [r['naam'] for r in rijen2 if not tussen(r)]))
    rijen3, scrol3, tog3, fouten3 = ronde('en', 390)
    lab = [r for r in rijen3 if r['naam'] == 'shmup']
    check('E2: Engels: label "version 3", nummer v3', lab and lab[0]['label'] == 'version 3' and lab[0]['versie'] == 'v3', lab[0]['label'] if lab else None)
    check('E3: Engels: nog steeds 12 nummers tussen tekst en toggle', len(rijen3) == 12 and all(tussen(r) for r in rijen3))
    check('E4: geen paginafouten of ontbrekende vertalingen', not (fouten_nl or fouten2 or fouten3), (fouten_nl + fouten2 + fouten3)[:3])
finally:
    srv.kill()
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
