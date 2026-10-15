# proef51: pushmelding bij bellen (v151) met de echte bellen.html, bellen.js en service-worker.js.
# - bellen: een 'oproep' (of 'oproep-video') naar de vriend; nam hij op: verder niets
# - niemand nam op (45 s, hier versneld) of de beller hing op voor het opnemen: 'gemist'
# - pagina dicht terwijl het overgaat: 'gemist' met keepalive is een poging, geen garantie (een verzoek met
#   inlogpas heeft een CORS-voorvraag; in de werkmap kwam hij er 1 van de 4 keer door). Telt niet mee: INFO.
# - de vriend weigerde: geen 'gemist'; een spel (belOp met spelModus): geen pushmelding
# - de portier (service worker): oproep met tag oproep-<beller>, blijft staan (requireInteraction), gemist
#   vervangt hem, een bericht niet; sluitBelMelding haalt alleen de belmelding van die vriend weg
# Nep: Supabase (inlogpas, profielen, gesprekskanaal via BroadcastChannel), lijntjes.js, de functies (stuur-push
# telt wat er gevraagd wordt; get-turn-credentials 503). Push afleveren: CDP ServiceWorker.deliverPushMessage.
# Oude map als controle: daar moet een deel MIS geven.
# python3 -I proef51.py <map>
import sys, os, time, json, socket, subprocess, tempfile, ssl, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
MAP = sys.argv[1]
A = 'aaaaaaaa-0000-4000-8000-00000000000a'  # Bram
B = 'bbbbbbbb-0000-4000-8000-00000000000b'  # Lotte
NAMEN = {A: 'Bram', B: 'Lotte'}
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
function vraag() {
  const v = { data: null, error: null }
  const p = new Proxy(function () {}, {
    get(t, k) { if (k === 'then') return (ok, nee) => Promise.resolve(window.__PROFIEL ? { data: window.__PROFIEL, error: null } : v).then(ok, nee); return () => p },
    apply() { return p } })
  return p
}
export const supabase = { channel, from: vraag, rpc: vraag,
  async removeChannel(k) { kanalen.delete(k); k.ingeschreven = false; return 'ok' },
  getChannels() { return [...kanalen] },
  auth: { async getSession() { const id = window.__UID; return { data: { session: id ? { user: { id }, access_token: 'tok-' + id } : null } } },
          onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } } } }
'''
NEP_LIJN = "export function houOpen(naam, maak) { const k = maak(); k.subscribe(); return { stop() { k.ingeschreven = false } } }\n"
def route(r):
    p = r.request.url.split('fibro.test/Fibro/')[1]
    if p.startswith('supabase.js'): return r.fulfill(body=NEP_SUPA, content_type='text/javascript')
    if p.startswith('lijntjes.js'): return r.fulfill(body=NEP_LIJN, content_type='text/javascript')
    f = os.path.join(MAP, p.split('?')[0])
    if os.path.isfile(f):
        soort = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json'}
        return r.fulfill(path=f, content_type=soort.get(os.path.splitext(f)[1]))
    return r.fulfill(status=404, body='')

INIT = ('const O = window.RTCPeerConnection; window.__pcs = []; window.RTCPeerConnection = class extends O { constructor(...a) { super(...a); window.__pcs.push(this) } };'
        ' const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms >= 40000 ? 2500 : ms, ...a);'  # 45 s beltijd: versneld
        ' try { localStorage.setItem("fibro_taal", "nl") } catch (e) {}')
PAGINA_BEL = '<!doctype html><html><body><script type="module">import * as B from "./bellen.js?v=@@V@@"; window.BEL = B; window.__klaar = 1</script></body></html>'
SW_PAGINA = '<!doctype html><html><body><script>navigator.serviceWorker.register("./service-worker.js?v=95").then(() => navigator.serviceWorker.ready).then(() => { window.__sw = 1 })</script></body></html>'
BEL_V = __import__('re').search(r"bellen\.js\?v=(\d+)", open(MAP + '/bellen.html').read()).group(1)
pushes = []
def push_route(r):
    h = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type'}
    if r.request.method == 'OPTIONS': return r.fulfill(status=204, headers=h)
    try: b = json.loads(r.request.post_data or '{}')
    except Exception: b = {}
    pushes.append((b.get('type'), b.get('receiver_id'), (r.request.headers.get('authorization') or '').replace('Bearer ', '')))
    return r.fulfill(status=200, headers=h, json={'ok': True, 'verstuurd': 1})
def route2(r):
    p = r.request.url.split('fibro.test/Fibro/')[1]
    if p.startswith('bel.html'): return r.fulfill(body=PAGINA_BEL.replace('@@V@@', BEL_V), content_type='text/html')
    if p.startswith('sw.html'): return r.fulfill(body=SW_PAGINA, content_type='text/html')
    return route(r)

uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:170] if info != '' else ''))
soorten = lambda: [(t, 'B' if r == B else ('A' if r == A else r)) for t, r, _ in pushes]

with sync_playwright() as pw:
    env = {k: v for k, v in os.environ.items() if 'proxy' not in k.lower()}
    # channel='chromium': de volledige Chromium (zonder scherm); de kale headless-versie weigert meldingen altijd
    br = pw.chromium.launch(channel='chromium', args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
                                  '--autoplay-policy=no-user-gesture-required'], env=env)
    def context(b=None):
        ctx = (b or br).new_context(permissions=['microphone', 'camera', 'notifications'])
        ctx.route('https://fibro.test/**', route2)
        if b: return ctx  # eigen browser: de functies gaan naar de echte (nep)server, zie proef 6
        ctx.route('https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/get-turn-credentials',
                  lambda r: r.fulfill(status=503, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey'}, body='{}'))
        ctx.route('https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push', push_route)
        ctx.add_init_script(INIT)
        return ctx
    def pagina(ctx, uid):
        pg = ctx.new_page(); pg.dialogen = []
        pg.on('dialog', lambda d: (pg.dialogen.append(d.message), d.dismiss()))
        pg.add_init_script('window.__UID = %s; window.__PROFIEL = { username: %s, avatar_url: "🙂" }' % (json.dumps(uid), json.dumps(NAMEN[B if uid == A else A])))
        return pg
    def bel(ctx, video=False):
        a = pagina(ctx, A)
        a.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Lotte' % B)
        a.wait_for_function('typeof window.startBellen === "function"', timeout=15000)
        a.evaluate('(v) => window.startBellen(v)', video)
        a.wait_for_timeout(1200)
        return a
    def status(pg):
        try: return pg.evaluate('document.getElementById("status").textContent')
        except Exception: return '?'
    # Let op: tijdens time.sleep handelt Playwright niets af (ook de nep-functie niet); daarom wait_for_timeout
    def wacht_op(pg, f, s=20):
        t0 = time.time()
        while time.time() - t0 < s and not f(): pg.wait_for_timeout(200)

    # 1 bellen, de vriend neemt op
    pushes.clear(); ctx = context(); a = bel(ctx)
    b = pagina(ctx, B); b.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1&opnemen=1' % A)
    wacht_op(a, lambda: status(a) == 'Verbonden' and status(b) == 'Verbonden'); a.wait_for_timeout(4000)
    check('bellen + opgenomen: alleen een oproep, geen gemist', status(a) == 'Verbonden' and soorten() == [('oproep', 'B')], soorten())
    check('met de inlogpas van de beller', pushes and pushes[0][2] == 'tok-' + A, pushes[:1])
    ctx.close()
    # 2 videobellen
    pushes.clear(); ctx = context(); a = bel(ctx, video=True)
    b = pagina(ctx, B); b.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1&opnemen=1&video=1' % A)
    wacht_op(a, lambda: status(a) == 'Verbonden'); a.wait_for_timeout(1000)
    check('videobellen: oproep-video', soorten() == [('oproep-video', 'B')], soorten())
    ctx.close()
    # 3 niemand neemt op (beltijd versneld)
    pushes.clear(); ctx = context(); a = bel(ctx)
    wacht_op(a, lambda: len(pushes) >= 2, 12)
    check('niemand nam op: oproep, daarna gemist', soorten() == [('oproep', 'B'), ('gemist', 'B')] and pushes[1][2] == 'tok-' + A, soorten())
    ctx.close()
    # 4 de beller hangt op voor het opnemen
    pushes.clear(); ctx = context(); a = bel(ctx)
    a.evaluate('window.annuleer()'); wacht_op(a, lambda: 'chat.html' in a.url, 8)
    check('beller hing op voor het opnemen: gemist (voor hij naar de chat ging)', soorten() == [('oproep', 'B'), ('gemist', 'B')] and 'chat.html' in a.url, (soorten(), a.url))
    ctx.close()
    # 5 de vriend weigert
    pushes.clear(); ctx = context(); a = bel(ctx)
    b = pagina(ctx, B); b.goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1' % A)
    b.wait_for_function('typeof window.weiger === "function"'); b.wait_for_timeout(1000)
    b.evaluate('window.weiger()'); a.wait_for_timeout(4000)
    check('vriend weigerde: geen gemist', soorten() == [('oproep', 'B')] and status(a) != 'Verbonden', (soorten(), status(a)))
    ctx.close()
    # 6 de beller sluit de pagina terwijl het overgaat. Een onderschept verzoek breekt Playwright af als de pagina
    # weggaat; daarom hier een eigen browser die de functies echt verstuurt, naar een nep-server op 127.0.0.1:443
    # (host-resolver-rules, eigen certificaat). Zo zie je of keepalive het sluiten echt overleeft.
    d = tempfile.mkdtemp()
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1',
                    '-subj', '/CN=nep', '-keyout', d + '/k.pem', '-out', d + '/c.pem'], capture_output=True, check=True)
    class Nep(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def kop(self, code):
            self.send_response(code); self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'authorization, apikey, content-type'); self.send_header('Access-Control-Allow-Private-Network', 'true'); self.send_header('Content-Length', '2'); self.end_headers(); self.wfile.write(b'{}')
        def do_OPTIONS(self): self.kop(200)
        def do_GET(self): self.kop(503)
        def do_POST(self):
            n = int(self.headers.get('Content-Length') or 0); b = json.loads(self.rfile.read(n) or b'{}')
            if self.path.endswith('/stuur-push'): pushes.append((b.get('type'), b.get('receiver_id'), (self.headers.get('Authorization') or '').replace('Bearer ', '')))
            self.kop(200)
    nep = ThreadingHTTPServer(('127.0.0.1', 443), Nep); c = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); c.load_cert_chain(d + '/c.pem', d + '/k.pem')
    nep.socket = c.wrap_socket(nep.socket, server_side=True); threading.Thread(target=nep.serve_forever, daemon=True).start()
    br2 = pw.chromium.launch(channel='chromium', env=env, args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
        '--host-resolver-rules=MAP qmgatbphiplrfxrljtbe.supabase.co 127.0.0.1', '--ignore-certificate-errors',
        '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'])
    pushes.clear(); ctx = context(br2); a = bel(ctx)
    a.goto('about:blank'); wacht_op(a, lambda: len(pushes) >= 2, 5)
    print('INFO pagina dicht tijdens overgaan (poging, telt niet mee): ' + ('gemist kwam aan' if soorten() == [('oproep', 'B'), ('gemist', 'B')] else 'gemist kwam niet aan'), soorten())
    ctx.close(); br2.close(); nep.shutdown()
    # 7 spel: geen pushmelding
    pushes.clear(); ctx = context(); s = pagina(ctx, A); s.goto('https://fibro.test/Fibro/bel.html'); s.wait_for_function('window.__klaar')
    s.evaluate('() => { window.BEL.initBellen(window.__UID, {}); return window.BEL.belOp(%s, false, true) }' % json.dumps(B)); s.wait_for_timeout(5000)
    check('spel (belOp met spelModus): geen pushmelding', soorten() == [], soorten())
    ctx.close()
    # 8 de portier: meldingen tonen, vervangen en weghalen. Een service worker moet echt van een server komen
    # (localhost telt als veilig): een eigen map met verwijzingen naar <map> plus sw.html en bel.html.
    www = tempfile.mkdtemp(); os.mkdir(www + '/Fibro')
    for n in os.listdir(MAP): os.symlink(os.path.join(os.path.abspath(MAP), n), www + '/Fibro/' + n)
    open(www + '/Fibro/sw.html', 'w').write(SW_PAGINA); open(www + '/Fibro/bel.html', 'w').write(PAGINA_BEL.replace('@@V@@', BEL_V))
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    HIER = 'http://localhost:%d' % poort
    ctx = br.new_context(); ctx.grant_permissions(['notifications'], origin=HIER); p = ctx.new_page()
    cdp = ctx.new_cdp_session(p); reg = {}
    cdp.on('ServiceWorker.workerRegistrationUpdated', lambda e: [reg.update({r['scopeURL']: r['registrationId']}) for r in e['registrations']])
    cdp.send('ServiceWorker.enable')
    p.goto(HIER + '/Fibro/sw.html'); p.wait_for_function('window.__sw', timeout=15000); p.wait_for_timeout(1000)
    rid = reg.get(HIER + '/Fibro/')
    def lever(data):
        cdp.send('ServiceWorker.deliverPushMessage', {'origin': HIER, 'registrationId': rid, 'data': json.dumps(data)}); p.wait_for_timeout(1200)
    meldingen = lambda: p.evaluate('async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => ({ tag: n.tag, body: n.body, blijft: n.requireInteraction, url: n.data && n.data.url }))')
    url = '/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1' % A
    lever({'title': 'Fibro', 'body': '📞 Bram belt je', 'url': url, 'type': 'oproep', 'tag': 'oproep-' + A}); m1 = meldingen()
    check('portier: oproep met tag, blijft staan, opent het belscherm', len(m1) == 1 and m1[0]['tag'] == 'oproep-' + A and m1[0]['blijft'] is True and m1[0]['url'] == url, m1)
    lever({'title': 'Fibro', 'body': '📵 Gemiste oproep van Bram', 'url': '/Fibro/chat.html', 'type': 'gemist', 'tag': 'oproep-' + A}); m2 = meldingen()
    check('portier: gemist vervangt de oproep', len(m2) == 1 and m2[0]['body'] == '📵 Gemiste oproep van Bram' and m2[0]['blijft'] is False, m2)
    lever({'title': 'Fibro', 'body': 'Je hebt een nieuw bericht 💬', 'url': '/Fibro/chat.html', 'type': 'bericht'})
    lever({'title': 'Fibro', 'body': '📞 Gerrit belt je', 'url': '/x', 'type': 'oproep', 'tag': 'oproep-gggg'}); m3 = meldingen()
    check('portier: bericht en een oproep van een ander staan er los naast', len(m3) == 3, m3)
    p.goto(HIER + '/Fibro/bel.html'); p.wait_for_function('window.__klaar', timeout=15000)
    p.evaluate('(a) => window.BEL.sluitBelMelding ? window.BEL.sluitBelMelding(a) : null', A); p.wait_for_timeout(500); m4 = meldingen()
    check('sluitBelMelding: alleen de melding van die vriend weg', sorted(x['body'] for x in m4) == sorted(['Je hebt een nieuw bericht 💬', '📞 Gerrit belt je']), m4)
    ctx.close(); srv.terminate()
    br.close()
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
