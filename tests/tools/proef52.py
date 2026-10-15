# proef52: belregels in de chat (v152).
# A. bellen met de echte bellen.html en bellen.js (nep-Supabase zoals proef51): de beller schrijft precies een
#    regel in messages: gemist (niemand nam op, beller hing op), geweigerd (ook via weigerooproep zoals de
#    bel-luisteraar), gesprek met duur (a of v); de gebelde schrijft niets; spel: niets. bellen.html wacht op
#    het wegschrijven en gaat dan naar chat.html?vriend=<de ander> (beide kanten).
#    Pagina dicht tijdens het gesprek: keepalive-poging naar /rest/v1/messages (INFO, telt niet mee).
# B. de echte chat.html: belregels als regel in het midden (NL en EN), rood bij een gemiste oproep van de ander,
#    het bericht erna sluit niet aan, niet te melden, rare inhoud wordt 'Oproep' (geen html), alleen
#    belregels = geen 'Stuur je eerste bericht'.
# C. Home, widget 'Laatste bericht': de belregel in woorden.
# D. ongelezen.js: een binnenkomende belregel telt alleen als het een gemiste oproep is.
# Oude map als controle: daar moet een deel MIS geven.
# python3 -I proef52.py <map>
import sys, os, re, time, json, socket, subprocess, tempfile, ssl, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
A = 'aaaaaaaa-0000-4000-8000-00000000000a'  # Bram (belt)
B = 'bbbbbbbb-0000-4000-8000-00000000000b'  # Lotte
NAMEN = {A: 'Bram', B: 'Lotte'}
BEL_V = re.search(r"bellen\.js\?v=(\d+)", open(MAP + '/bellen.html').read()).group(1)
ONG_V = re.search(r"ongelezen\.js\?v=(\d+)", open(MAP + '/chat.html').read()).group(1)

uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''))

# ───────────── A: nep-Supabase voor bellen ─────────────
NEP_SUPA = r'''
const ik = Math.random().toString(36).slice(2)
const bc = new BroadcastChannel('nep-realtime')
const kanalen = new Set()
bc.onmessage = (e) => {
  const m = e.data; if (m.van === ik) return
  for (const k of kanalen) if (k.naam === m.naam && k.ingeschreven)
    for (const [ev, cb] of k.luisteraars) if (ev === m.event) setTimeout(() => cb({ type: 'broadcast', event: m.event, payload: m.payload }), 0)
}
function channel(naam) {
  return { topic: 'realtime:' + naam, naam, luisteraars: [], ingeschreven: false,
    on(t, f, cb) { this.luisteraars.push([f.event, cb]); return this },
    subscribe(cb) { kanalen.add(this); setTimeout(() => { this.ingeschreven = true; cb && cb('SUBSCRIBED') }, 200); return this },
    async send(m) { bc.postMessage({ van: ik, naam, event: m.event, payload: JSON.parse(JSON.stringify(m.payload)) }); return 'ok' } }
}
function vraag(tabel) {
  const v = { data: null, error: null }
  const p = new Proxy(function () {}, {
    get(t, k) {
      if (k === 'then') return (ok, nee) => Promise.resolve(window.__PROFIEL ? { data: window.__PROFIEL, error: null } : v).then(ok, nee)
      if (k === 'insert') return (rij) => {
        try { window.nepInsert(String(tabel), JSON.stringify(rij), window.__UID) } catch (e) {}
        // het wegschrijven duurt even (600 ms): bellen.html moet erop wachten
        return { then(ok, nee) { return new Promise(r => setTimeout(r, 600)).then(() => { try { window.nepInsertKlaar() } catch (e) {} ; return { data: null, error: null } }).then(ok, nee) } }
      }
      return () => p },
    apply() { return p } })
  return p
}
export const supabase = { channel, from: (t) => vraag(t), rpc: () => vraag('rpc'),
  async removeChannel(k) { kanalen.delete(k); k.ingeschreven = false; return 'ok' },
  getChannels() { return [...kanalen] },
  auth: { async getSession() { const id = window.__UID; return { data: { session: id ? { user: { id }, access_token: 'tok-' + id } : null } } },
          onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } } } }
'''
NEP_LIJN = "export function houOpen(naam, maak) { const k = maak(); k.subscribe(); return { stop() { k.ingeschreven = false } } }\n"
SOORT = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json'}
PAGINA_BEL = '<!doctype html><html><body><script type="module">import * as B from "./bellen.js?v=@@V@@"; window.BEL = B; window.__klaar = 1</script></body></html>'
def routeA(r):
    p = r.request.url.split('fibro.test/Fibro/')[1]
    if p.startswith('supabase.js'): return r.fulfill(body=NEP_SUPA, content_type='text/javascript')
    if p.startswith('lijntjes.js'): return r.fulfill(body=NEP_LIJN, content_type='text/javascript')
    if p.startswith('chat.html'): return r.fulfill(body='<!doctype html><title>chat</title>chat', content_type='text/html')
    if p.startswith('bel.html'): return r.fulfill(body=PAGINA_BEL.replace('@@V@@', BEL_V), content_type='text/html')
    f = os.path.join(MAP, p.split('?')[0])
    if os.path.isfile(f): return r.fulfill(path=f, content_type=SOORT.get(os.path.splitext(f)[1]))
    return r.fulfill(status=404, body='')
INIT = ('const O = window.RTCPeerConnection; window.__pcs = []; window.RTCPeerConnection = class extends O { constructor(...a) { super(...a); window.__pcs.push(this) } };'
        ' const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms >= 40000 ? (window.__snel || 2500) : ms, ...a);'  # 45 s beltijd: versneld
        ' try { localStorage.setItem("fibro_taal", "nl") } catch (e) {}')
inserts = []   # (tabel, rij, uid, tijd)
klaar = []     # tijdstippen waarop een insert klaar was
navs = {}      # pagina -> (url, tijd) van de laatste navigatie naar chat

# ───────────── B/C: echte supabase-lib, REST nagebootst ─────────────
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def iso(i): return '2026-10-15T01:%02d:00.000Z' % i
RIJEN = [  # (van, inhoud) in volgorde, oudste eerst
    (FID, 'oproep:gemist:a:0'),
    (UID, 'oproep:gemist:v:0'),
    (FID, 'oproep:geweigerd:a:0'),
    (UID, 'oproep:gesprek:a:154'),
    (FID, 'oproep:gesprek:v:3723'),
    (FID, 'oproep:gesprek:a:0'),
    (FID, 'Hallo na het bellen'),
    (FID, 'oproep:<img src=x onerror=alert(1)>:a:zz'),
    (UID, 'oproep:geweigerd:v:0'),
    (FID, 'oproep:gemist:v:0'),
]
VERWACHT_NL = ['📵 Gemiste oproep', '📹 Video-oproep · niet opgenomen', '📵 Oproep geweigerd', '📞 Gesprek · 2:34',
               '📹 Videogesprek · 1:02:03', '📞 Gesprek', '📞 Oproep', '📹 Video-oproep · geweigerd', '📵 Gemiste video-oproep']
VERWACHT_EN = ['📵 Missed call', '📹 Video call · no answer', '📵 Call declined', '📞 Call · 2:34',
               '📹 Video call · 1:02:03', '📞 Call', '📞 Call', '📹 Video call · declined', '📵 Missed video call']
staat = {'pub': None, 'rijen': RIJEN, 'laatste': None}
def berichten():
    uit = []
    for i, (van, inhoud) in enumerate(staat['rijen']):
        uit.append({'id': 'm%02d' % i, 'sender_id': van, 'receiver_id': FID if van == UID else UID, 'content': inhoud,
                    'created_at': iso(i), 'expires_at': '2026-11-15T00:00:00.000Z', 'antwoord_op': None})
    return list(reversed(uit))
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'GET':
        if 'limit=1' in u and staat['laatste']:
            return route.fulfill(status=200, json=[staat['laatste']])
        return route.fulfill(status=200, json=berichten())
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted",
                                                                            "profiles": {"id": FID, "username": "flamingo", "avatar_url": "🦩", "public_key": staat['pub']}}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}
        vriend = {"id": FID, "username": "flamingo", "avatar_url": "🦩", "public_key": staat['pub']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])

with sync_playwright() as pw:
    env = {k: v for k, v in os.environ.items() if 'proxy' not in k.lower()}
    br = pw.chromium.launch(channel='chromium', args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
                                  '--autoplay-policy=no-user-gesture-required'], env=env)
    # ───────────── A ─────────────
    print('A. bellen')
    def contextA(b=None, snel=2500):
        ctx = (b or br).new_context(permissions=['microphone', 'camera', 'notifications'])
        ctx.add_init_script('window.__snel = %d' % snel)
        ctx.route('https://fibro.test/**', routeA)
        ctx.expose_binding('nepInsert', lambda src, t, rij, uid: inserts.append((t, json.loads(rij), uid, time.time())))
        ctx.expose_binding('nepInsertKlaar', lambda src: klaar.append(time.time()))
        if not b:
            ctx.route('https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/**',
                      lambda r: r.fulfill(status=503 if 'turn' in r.request.url else 200, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type'}, body='{}'))
        ctx.add_init_script(INIT)
        return ctx
    def pagina(ctx, uid, naam):
        pg = ctx.new_page(); pg.dialogen = []
        pg.on('dialog', lambda d: (pg.dialogen.append(d.message), d.dismiss()))
        pg.on('framenavigated', lambda f: navs.__setitem__(naam, (f.url, time.time())) if f == pg.main_frame and 'chat.html' in f.url else None)
        pg.add_init_script('window.__UID = %s; window.__PROFIEL = { username: %s, avatar_url: "🙂" }' % (json.dumps(uid), json.dumps(NAMEN[B if uid == A else A])))
        return pg
    def bel(ctx, video=False):
        a = pagina(ctx, A, 'A')
        a.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Lotte' % B)
        a.wait_for_function('typeof window.startBellen === "function"', timeout=15000)
        a.evaluate('(v) => window.startBellen(v)', video)
        a.wait_for_timeout(1200)
        return a
    def status(pg):
        try: return pg.evaluate('document.getElementById("status").textContent')
        except Exception: return '?'
    def wacht_op(pg, f, s=20):
        t0 = time.time()
        while time.time() - t0 < s and not f(): pg.wait_for_timeout(200)
    def regels(): return [(t, r.get('sender_id'), r.get('receiver_id'), r.get('content')) for t, r, uid, _ in inserts]
    def leeg(): inserts.clear(); klaar.clear(); navs.clear()
    def duur(c):
        try: return int(c.split(':')[3])
        except Exception: return -1
    MSG = 'messages'

    # 1 opgenomen, gesprek, de beller hangt op
    leeg(); ctx = contextA(); a = bel(ctx)
    b = pagina(ctx, B, 'B'); b.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1&opnemen=1' % A)
    wacht_op(a, lambda: status(a) == 'Verbonden' and status(b) == 'Verbonden'); a.wait_for_timeout(3500)
    a.evaluate('window.hangop()'); wacht_op(a, lambda: 'A' in navs and 'B' in navs, 10)
    r = regels()
    check('gesprek, beller hangt op: een regel gesprek met duur', len(r) == 1 and r[0][:3] == (MSG, A, B) and r[0][3].startswith('oproep:gesprek:a:') and 2 <= duur(r[0][3]) <= 8, r)
    check('beller gaat pas naar de chat als de regel weg is', 'A' in navs and klaar and navs['A'][1] >= klaar[0] - 0.05, (navs.get('A'), klaar))
    check('beller naar de chat met Lotte', 'A' in navs and navs['A'][0].endswith('chat.html?vriend=' + B), navs.get('A'))
    check('gebelde naar de chat met Bram', 'B' in navs and navs['B'][0].endswith('chat.html?vriend=' + A), navs.get('B'))
    ctx.close()
    # 2 opgenomen, de gebelde hangt op
    leeg(); ctx = contextA(); a = bel(ctx)
    b = pagina(ctx, B, 'B'); b.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1&opnemen=1' % A)
    wacht_op(a, lambda: status(a) == 'Verbonden' and status(b) == 'Verbonden'); a.wait_for_timeout(2500)
    b.evaluate('window.hangop()'); wacht_op(a, lambda: 'A' in navs and 'B' in navs, 10); a.wait_for_timeout(1500)
    r = regels()
    check('gebelde hangt op: de beller schrijft een regel gesprek, de gebelde niets', len(r) == 1 and r[0][:3] == (MSG, A, B) and r[0][3].startswith('oproep:gesprek:a:') and 1 <= duur(r[0][3]) <= 7, r)
    check('beller wachtte op de regel en ging naar de chat met Lotte', 'A' in navs and klaar and navs['A'][1] >= klaar[0] - 0.05 and navs['A'][0].endswith('?vriend=' + B), (navs.get('A'), klaar))
    ctx.close()
    # 3 videogesprek
    leeg(); ctx = contextA(); a = bel(ctx, video=True)
    b = pagina(ctx, B, 'B'); b.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1&opnemen=1&video=1' % A)
    wacht_op(a, lambda: status(a) == 'Verbonden'); a.wait_for_timeout(2000)
    a.evaluate('window.hangop()'); wacht_op(a, lambda: 'A' in navs, 10)
    r = regels()
    check('videogesprek: oproep:gesprek:v:<duur>', len(r) == 1 and r[0][3].startswith('oproep:gesprek:v:') and duur(r[0][3]) >= 1, r)
    ctx.close()
    # 4 niemand neemt op (beltijd versneld)
    leeg(); ctx = contextA(); a = bel(ctx)
    wacht_op(a, lambda: 'A' in navs, 12)
    r = regels()
    check('niemand nam op: oproep:gemist:a:0', r == [(MSG, A, B, 'oproep:gemist:a:0')], r)
    check('daarna naar de chat met Lotte', 'A' in navs and navs['A'][0].endswith('?vriend=' + B), navs.get('A'))
    ctx.close()
    # 5 de beller hangt op voor het opnemen (video)
    leeg(); ctx = contextA(); a = bel(ctx, video=True)
    a.evaluate('window.annuleer()'); wacht_op(a, lambda: 'A' in navs, 8)
    r = regels()
    check('beller hing op voor het opnemen: oproep:gemist:v:0, voordat hij naar de chat ging',
          r == [(MSG, A, B, 'oproep:gemist:v:0')] and klaar and 'A' in navs and navs['A'][1] >= klaar[0] - 0.05, (r, navs.get('A'), klaar))
    ctx.close()
    # 6 de gebelde weigert op het belscherm (beltijd hier 10 s: het belscherm laden duurt even)
    leeg(); ctx = contextA(snel=10000); a = bel(ctx)
    b = pagina(ctx, B, 'B'); b.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1' % A)
    b.wait_for_function('typeof window.weiger === "function"'); b.wait_for_timeout(1000)
    b.evaluate('window.weiger()'); wacht_op(a, lambda: 'A' in navs, 8); a.wait_for_timeout(500)
    r = regels()
    check('geweigerd op het belscherm: oproep:geweigerd:a:0 (geen gemist)', r == [(MSG, A, B, 'oproep:geweigerd:a:0')], r)
    check('gebelde na weigeren naar de chat met Bram', 'B' in navs and navs['B'][0].endswith('?vriend=' + A), navs.get('B'))
    ctx.close()
    # 7 de gebelde weigert via weigerooproep (zoals de bel-luisteraar en de chat)
    leeg(); ctx = contextA(snel=10000)
    b = pagina(ctx, B, 'B'); b.goto('https://fibro.test/Fibro/bel.html'); b.wait_for_function('window.__klaar')
    b.evaluate('() => window.BEL.initBellen(window.__UID, { onOproep: () => { window.__oproep = 1 } })'); b.wait_for_timeout(500)
    a = bel(ctx); b.wait_for_function('window.__oproep', timeout=8000)
    b.evaluate('() => window.BEL.weigerooproep()'); wacht_op(a, lambda: 'A' in navs, 8); a.wait_for_timeout(500)
    r = regels()
    check('geweigerd via weigerooproep: oproep:geweigerd:a:0', r == [(MSG, A, B, 'oproep:geweigerd:a:0')], r)
    ctx.close()
    # 8 spel: geen regel
    leeg(); ctx = contextA(); s = pagina(ctx, A, 'S'); s.goto('https://fibro.test/Fibro/bel.html'); s.wait_for_function('window.__klaar')
    s.evaluate('() => { window.BEL.initBellen(window.__UID, {}); return window.BEL.belOp(%s, false, true) }' % json.dumps(B)); s.wait_for_timeout(5000)
    s.evaluate('() => window.BEL.hangOp()'); s.wait_for_timeout(1500)
    check('spel (belOp met spelModus): geen regel', regels() == [], regels())
    ctx.close()
    # 9 twee keer achter elkaar bellen: elk gesprek een eigen regel
    leeg(); ctx = contextA(); s = pagina(ctx, A, 'S'); s.goto('https://fibro.test/Fibro/bel.html'); s.wait_for_function('window.__klaar')
    s.evaluate('() => window.BEL.initBellen(window.__UID, {})')
    s.evaluate('(b) => window.BEL.belOp(b, false)', B); s.wait_for_timeout(800); s.evaluate('() => window.BEL.hangOp()'); s.wait_for_timeout(1500)
    s.evaluate('(b) => window.BEL.belOp(b, true)', B); s.wait_for_timeout(800); s.evaluate('() => window.BEL.hangOp()'); s.wait_for_timeout(1500)
    r = regels()
    check('twee keer bellen en ophangen: twee regels (a en v), niet meer', [x[3] for x in r] == ['oproep:gemist:a:0', 'oproep:gemist:v:0'], r)
    ctx.close()
    # 10 pagina dicht tijdens het gesprek: keepalive naar /rest/v1/messages (poging)
    d = tempfile.mkdtemp(); rest = []
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1',
                    '-subj', '/CN=nep', '-keyout', d + '/k.pem', '-out', d + '/c.pem'], capture_output=True, check=True)
    class Nep(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def kop(self, code):
            self.send_response(code); self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'authorization, apikey, content-type, prefer'); self.send_header('Access-Control-Allow-Private-Network', 'true'); self.send_header('Content-Length', '2'); self.end_headers(); self.wfile.write(b'{}')
        def do_OPTIONS(self): self.kop(200)
        def do_GET(self): self.kop(503)
        def do_POST(self):
            n = int(self.headers.get('Content-Length') or 0); body = json.loads(self.rfile.read(n) or b'{}')
            if '/rest/v1/messages' in self.path: rest.append((body, self.headers.get('apikey'), self.headers.get('Authorization')))
            self.kop(201)
    nep = ThreadingHTTPServer(('127.0.0.1', 443), Nep); c = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); c.load_cert_chain(d + '/c.pem', d + '/k.pem')
    nep.socket = c.wrap_socket(nep.socket, server_side=True); threading.Thread(target=nep.serve_forever, daemon=True).start()
    br2 = pw.chromium.launch(channel='chromium', env=env, args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
        '--host-resolver-rules=MAP qmgatbphiplrfxrljtbe.supabase.co 127.0.0.1', '--ignore-certificate-errors',
        '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'])
    for poging in range(3):
        leeg(); rest.clear(); ctx = contextA(br2); a = bel(ctx)
        b = pagina(ctx, B, 'B'); b.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1&opnemen=1' % A)
        wacht_op(a, lambda: status(a) == 'Verbonden'); a.wait_for_timeout(2000)
        a.goto('about:blank'); wacht_op(b, lambda: len(rest) >= 1, 4)
        print('INFO pagina dicht tijdens gesprek (poging %d, telt niet mee): ' % (poging + 1) + (('regel kwam aan: ' + str(rest[0][0].get('content'))) if rest else 'regel kwam niet aan'),
              '| via supabase-js:', regels())
        ctx.close()
    br2.close(); nep.shutdown()

    # ───────────── B: de chat ─────────────
    print('B. chat')
    www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    brc = pw.chromium.launch()
    def chatpagina(taal):
        ctx = brc.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
        p = ctx.new_page(); p.fouten = []
        p.on('pageerror', lambda e: p.fouten.append(str(e)[:200])); p.on('dialog', lambda d: (p.fouten.append('dialoog: ' + d.message), d.dismiss()))
        p.goto(BASIS + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
        p.evaluate("t => localStorage.setItem('fibro_taal', t)", taal)
        k = p.evaluate("""async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); const v = await c.genereerKeypair();
          c.slaPrivateKeyOp(uid, ik.privateKeyB64); return v.publicKeyB64 }""", UID)
        staat['pub'] = k
        p.goto(BASIS + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
        p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(2000)
        return ctx, p
    LEES = """() => [...document.querySelectorAll('#messages .belregel')].map(r => ({ tekst: (r.querySelector('.belregel-tekst') || r).firstChild.textContent.trim(),
        gemist: r.classList.contains('gemist'), uit: r.classList.contains('out'), meld: r.dataset.meldbaar || null, img: !!r.querySelector('img'),
        tijd: (r.querySelector('.bubble-time') || {}).textContent || '' }))"""
    staat['rijen'] = RIJEN
    ctx, p = chatpagina('nl'); rs = p.evaluate(LEES)
    check('chat NL: alle belregels in woorden', [x['tekst'] for x in rs] == VERWACHT_NL, [x['tekst'] for x in rs])
    check('rood alleen bij een gemiste oproep van de ander', [x['gemist'] for x in rs] == [True, False, False, False, False, False, False, False, True], [x['gemist'] for x in rs])
    check('eigen regels rechts gemarkeerd (out), niet te melden, geen html, met tijd',
          [x['uit'] for x in rs] == [False, True, False, True, False, False, False, True, False] and all(x['meld'] is None and not x['img'] and re.search(r'\d:\d\d', x['tijd']) for x in rs), rs)
    los = p.evaluate("() => { const r = [...document.querySelectorAll('#messages .msg-row')].find(x => x.textContent.includes('Hallo na het bellen')); return r ? { groep: r.classList.contains('gegroepeerd'), meld: r.dataset.meldbaar } : null }")
    check('het bericht na een belregel sluit niet aan (eigen avatar) en is wel te melden', los and los['groep'] is False and los['meld'] == '1', los)
    check('geen ruwe oproep:-tekst in de chat', 'oproep:' not in p.evaluate("document.getElementById('messages').innerText"), '')
    check('geen fouten op de pagina', p.fouten == [], p.fouten)
    ctx.close()
    ctx, p = chatpagina('en'); rs = p.evaluate(LEES)
    check('chat EN: alle belregels in het Engels', [x['tekst'] for x in rs] == VERWACHT_EN, [x['tekst'] for x in rs])
    ctx.close()
    staat['rijen'] = [(FID, 'oproep:gemist:a:0')]
    ctx, p = chatpagina('nl')
    tekst = p.evaluate("document.getElementById('messages').innerText")
    check('alleen een belregel: geen "Stuur je eerste bericht"', 'Gemiste oproep' in tekst and 'eerste bericht' not in tekst, tekst[:200])
    ctx.close()

    # ───────────── C: Home ─────────────
    print('C. Home')
    def home(laatste, taal='nl'):
        staat['laatste'] = laatste
        ctx = brc.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
        p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:200])); p.on('dialog', lambda d: d.dismiss())
        p.goto(BASIS + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
        p.evaluate("([uid, taal]) => { localStorage.setItem('fibro_taal', taal); localStorage.setItem('fibro_widgets_home_' + uid, JSON.stringify([{ id: 'laastbericht', icon: '💬', titel: 'Laatste bericht', w: 4, h: 1, volgorde: 0, aan: true }])) }", [UID, taal])
        p.goto(BASIS + 'index.html')
        try: p.wait_for_function("() => { const e = document.getElementById('wlb'); return e && !/Laden|Loading/.test(e.textContent) }", timeout=15000)
        except Exception: pass
        t = p.evaluate("(document.getElementById('wlb') || {}).textContent || ''")
        ctx.close(); return t
    t1 = home({'content': 'oproep:gemist:a:0', 'sender_id': FID})
    check('Home: gemiste oproep van een vriend', t1.replace('\xa0', ' ').strip() == 'Iemand: 📵 Gemiste oproep', t1)
    t2 = home({'content': 'oproep:gesprek:v:154', 'sender_id': UID})
    check('Home: eigen videogesprek', t2.replace('\xa0', ' ').strip() == 'Jij: 📹 Videogesprek · 2:34', t2)
    t3 = home({'content': 'oproep:gemist:a:0', 'sender_id': UID}, 'en')
    check('Home in het Engels', t3.replace('\xa0', ' ').strip() == 'You: 📞 Call · no answer', t3)
    staat['laatste'] = None
    brc.close(); srv.terminate()

    # ───────────── D: ongelezen ─────────────
    print('D. ongelezen')
    NEP_D = r'''export const supabase = {
      auth: { async getSession() { return { data: { session: { user: { id: window.__UID } } } } } },
      async rpc() { return { data: [], error: null } },
      channel(naam) { const k = { on(t, f, cb) { if (t === 'postgres_changes') window.__ins = cb; return k }, subscribe() { return k } }; return k } }'''
    PAGINA_D = '<!doctype html><html><head><title>proef</title></head><body><script type="module">import { startOngelezen } from "./ongelezen.js?v=%s"; startOngelezen().then(() => { window.__klaar = 1 })</script></body></html>' % ONG_V
    def routeD(r):
        p = r.request.url.split('fibro.test/Fibro/')[1]
        if p.startswith('supabase.js'): return r.fulfill(body=NEP_D, content_type='text/javascript')
        if p.startswith('lijntjes.js'): return r.fulfill(body=NEP_LIJN, content_type='text/javascript')
        if p.startswith('ong.html'): return r.fulfill(body=PAGINA_D, content_type='text/html')
        f = os.path.join(MAP, p.split('?')[0])
        if os.path.isfile(f): return r.fulfill(path=f, content_type=SOORT.get(os.path.splitext(f)[1]))
        return r.fulfill(status=404, body='')
    ctx = br.new_context(); ctx.route('https://fibro.test/**', routeD); ctx.add_init_script('window.__UID = %s' % json.dumps(UID))
    p = ctx.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200]))
    p.goto('https://fibro.test/Fibro/ong.html'); p.wait_for_function('!!(window.__klaar && window.__ins)', timeout=10000)
    def binnen(inhoud):
        p.evaluate('([u, f, c]) => window.__ins({ new: { receiver_id: u, sender_id: f, content: c } })', [UID, FID, inhoud]); p.wait_for_timeout(100)
        return p.title()
    tt = [binnen('oproep:gemist:a:0'), binnen('oproep:gesprek:a:12'), binnen('oproep:geweigerd:v:0'), binnen('oproep:gemist:v:0'), binnen('e2e:abc'), binnen('buzz:')]
    check('ongelezen: gemist telt, gesprek en geweigerd niet, berichten en buzz wel', tt == ['(1) proef', '(1) proef', '(1) proef', '(2) proef', '(3) proef', '(4) proef'], tt)
    ctx.close()
    br.close()
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
