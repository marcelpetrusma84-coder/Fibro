# proef48: ice-config.js v149 - eigen STUN, TURN-pasje 12 uur op het toestel (localStorage, alle tabbladen),
# en een gesprek met de echte bellen.js alleen via een echte coturn met een pasje uit dat geheugen.
# Nep: Supabase (inlogpas, gesprekskanaal via BroadcastChannel) en de functie get-turn-credentials
# (rekent het pasje net zo uit: <verloopt>:<uid>, base64(HMAC-SHA1(geheim, naam))). Echt: ice-config.js,
# bellen.js, account.js (wisOpslag), coturn met server/turnserver.conf.
# Nodig: coturn (apt-get install coturn), Playwright + Chromium, een eigen (niet-127) IP-adres.
# python3 -I proef48.py <map> <scratch>        (met de oude map als controle: daar moet een deel MIS geven)
import sys, os, re, time, json, hmac, hashlib, base64, subprocess, socket
from playwright.sync_api import sync_playwright
MAP, S = sys.argv[1], sys.argv[2]
os.makedirs(S, exist_ok=True)
IP = subprocess.run(['hostname', '-I'], capture_output=True, text=True).stdout.split()[0]
GEHEIM = 'proefgeheimalleenvoordeproefabcdefgh'
A = 'aaaaaaaa-0000-4000-8000-00000000000a'  # Bram (beller)
B = 'bbbbbbbb-0000-4000-8000-00000000000b'  # Lotte
ICE_V = re.search(r"ice-config\.js\?v=(\d+)", open(MAP + '/bellen.js').read()).group(1)
BEL_V = re.search(r"bellen\.js\?v=(\d+)", open(MAP + '/bellen.html').read()).group(1)

# ── coturn met de echte instellingen; alleen het eigen proefadres (192.0.2.x) niet weigeren ──
conf = open(MAP + '/server/turnserver.conf').read()
conf = re.sub(r'^denied-peer-ip=192\.0\.2\.0-192\.0\.2\.255\n', '', conf, flags=re.M)
conf += '\nlistening-ip=%s\nrelay-ip=%s\nstatic-auth-secret=%s\npidfile=%s/turn48.pid\n' % (IP, IP, GEHEIM, S)
open(S + '/turn48.conf', 'w').write(conf)
log = open(S + '/turn48.log', 'w')
turn = subprocess.Popen(['turnserver', '-c', S + '/turn48.conf'], stdout=log, stderr=subprocess.STDOUT)
for _ in range(50):
    time.sleep(0.2)
    if 'Relay ports initialization done' in open(S + '/turn48.log').read(): break

functie = {'stand': 'ok', 'aanroepen': []}
def functie_route(r):
    h = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type',
         'cache-control': 'no-store'}
    if r.request.method == 'OPTIONS': return r.fulfill(status=204, headers=h)
    uid = (r.request.headers.get('authorization') or '').replace('Bearer tok-', '')
    functie['aanroepen'].append(uid)
    if functie['stand'] == '503': return r.fulfill(status=503, headers=h, json={'fout': 'server nog niet ingesteld'})
    verloopt = int(time.time()) + (1800 if functie['stand'] == 'kort' else 86400)
    naam = '%d:%s' % (verloopt, uid)
    ww = base64.b64encode(hmac.new(GEHEIM.encode(), naam.encode(), hashlib.sha1).digest()).decode()
    antwoord = {'iceServers': [{'urls': ['turn:%s:3478?transport=udp' % IP, 'turn:%s:3478?transport=tcp' % IP], 'username': naam, 'credential': ww}]}
    if functie['stand'] != 'zonder-verloopt': antwoord['verloopt'] = verloopt
    return r.fulfill(status=200, headers=h, json=antwoord)

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
export const supabase = { channel,
  async removeChannel(k) { kanalen.delete(k); k.ingeschreven = false; return 'ok' },
  getChannels() { return [...kanalen] },
  auth: { async getSession() { const id = window.__UID; return { data: { session: id ? { user: { id }, access_token: 'tok-' + id } : null } } } } }
'''
NEP_LIJN = "export function houOpen(naam, maak) { const k = maak(); k.subscribe(); return { stop() { k.ingeschreven = false } } }\n"
ICE_PAGINA = ('<!doctype html><html><body><script type="module">import { ICE_SERVERS, iceReady } from "./ice-config.js?v=' + ICE_V + '";'
              'await iceReady; window.__ice = JSON.parse(JSON.stringify(ICE_SERVERS)); window.__klaar = 1</script></body></html>')
BEL_PAGINA = ('<!doctype html><html><body><audio id="remoteAudio" autoplay></audio><script type="module">'
              'import * as B from "./bellen.js?v=' + BEL_V + '"; window.BEL = B; window.__klaar = 1</script></body></html>')
def route(r):
    p = r.request.url.split('fibro.test/Fibro/')[1]
    if p.startswith('supabase.js'): return r.fulfill(body=NEP_SUPA, content_type='text/javascript')
    if p.startswith('lijntjes.js'): return r.fulfill(body=NEP_LIJN, content_type='text/javascript')
    if p.startswith('ice.html'): return r.fulfill(body=ICE_PAGINA, content_type='text/html')
    if p.startswith('bel.html'): return r.fulfill(body=BEL_PAGINA, content_type='text/html')
    f = os.path.join(MAP, p.split('?')[0])
    if os.path.isfile(f): return r.fulfill(path=f, content_type='text/javascript' if f.endswith('.js') else None)
    return r.fulfill(status=404, body='')

uitslag = []
def check(naam, ok, info=''):
    uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:160] if info != '' else ''))

SLEUTEL = 'fibro_turn_pasje'
with sync_playwright() as pw:
    env = {k: v for k, v in os.environ.items() if 'proxy' not in k.lower()}
    br = pw.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
                                  '--autoplay-policy=no-user-gesture-required'], env=env)
    def context(extra=''):
        ctx = br.new_context(permissions=['microphone', 'camera'])
        ctx.route('https://fibro.test/**', route)
        ctx.route('https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/get-turn-credentials', functie_route)
        if extra: ctx.add_init_script(extra)
        return ctx
    def pagina(ctx, uid, voor=None, pad='ice.html'):
        p = ctx.new_page(); fouten = []; logs = []
        p.on('pageerror', lambda e: fouten.append(str(e)))
        p.on('console', lambda m: logs.append(m.text))
        p.add_init_script('window.__UID = %s' % json.dumps(uid))
        if voor:  # localStorage/sessionStorage van tevoren zetten (zelfde herkomst)
            p.goto('https://fibro.test/Fibro/leeg.txt'); p.evaluate(voor)
        p.goto('https://fibro.test/Fibro/' + pad); p.wait_for_function('window.__klaar', timeout=15000)
        p.fouten, p.logs = fouten, logs
        return p
    def opslag(p):
        return p.evaluate('(k) => { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return "kapot" } }', SLEUTEL)
    def turn_in(ice):
        return [s for s in ice['iceServers'] if any(str(u).startswith('turn') for u in ([s['urls']] if isinstance(s['urls'], str) else s['urls']))]
    def stun_in(ice):
        return [s['urls'] for s in ice['iceServers'] if str(s['urls']).startswith('stun')]

    # 1 eerste keer
    functie.update(stand='ok', aanroepen=[]); ctx = context()
    p1 = pagina(ctx, A); ice1 = p1.evaluate('window.__ice'); c1 = opslag(p1)
    check('eerste keer: 1 aanroep, TURN geladen', functie['aanroepen'] == [A] and len(turn_in(ice1)) == 1, functie['aanroepen'])
    check('spiegel (STUN) alleen de eigen server', stun_in(ice1) == ['stun:136.144.154.200:3478'], stun_in(ice1))
    check('pasje op het toestel bewaard (uid, tijd, verloopt, turn)', isinstance(c1, dict) and c1.get('uid') == A and isinstance(c1.get('verloopt'), int)
          and abs(c1['tijd'] / 1000 - time.time()) < 30 and c1.get('turn') == turn_in(ice1), c1)
    # 2 tweede pagina (nieuw tabblad, zelfde toestel)
    p2 = pagina(ctx, A); ice2 = p2.evaluate('window.__ice')
    check('tweede tabblad: geen aanroep, zelfde pasje', functie['aanroepen'] == [A] and ice2 == ice1, functie['aanroepen'])
    check('log zegt: uit toestel-geheugen', any('toestel-geheugen' in l for l in p2.logs), [l for l in p2.logs if '[ice]' in l])
    # 3 pasje 12 uur oud
    def met_tijd(dt_ms, verloopt_s=None):
        c = dict(c1) if isinstance(c1, dict) else {'uid': A, 'turn': turn_in(ice1)}; c['tijd'] = int(time.time() * 1000) + dt_ms
        if verloopt_s is not None: c['verloopt'] = int(time.time()) + verloopt_s
        return 'localStorage.setItem(%s, %s)' % (json.dumps(SLEUTEL), json.dumps(json.dumps(c)))
    n = len(functie['aanroepen']); p = pagina(ctx, A, met_tijd(-(12 * 3600 + 60) * 1000))
    check('pasje ouder dan 12 uur: nieuw gehaald', len(functie['aanroepen']) == n + 1 and abs((opslag(p) or {}).get('tijd', 0) / 1000 - time.time()) < 30)
    n = len(functie['aanroepen']); p = pagina(ctx, A, met_tijd(-(11 * 3600) * 1000))
    check('pasje 11 uur oud: nog gebruikt', len(functie['aanroepen']) == n)
    n = len(functie['aanroepen']); p = pagina(ctx, A, met_tijd(-60000, 1800))
    check('nog maar 30 min geldig: nieuw gehaald', len(functie['aanroepen']) == n + 1)
    n = len(functie['aanroepen']); p = pagina(ctx, A, met_tijd(3600 * 1000))
    check('klok ging terug (tijd in de toekomst): nieuw gehaald', len(functie['aanroepen']) == n + 1)
    # 4 ander account op hetzelfde toestel
    n = len(functie['aanroepen']); p = pagina(ctx, B)
    check('ander account: eigen pasje gehaald, niet dat van de vorige', functie['aanroepen'][n:] == [B] and (opslag(p) or {}).get('uid') == B
          and all(s['username'].endswith(':' + B) for s in turn_in(p.evaluate('window.__ice'))))
    # 5 kapotte opslag
    n = len(functie['aanroepen']); p = pagina(ctx, A, 'localStorage.setItem(%s, "{kapot")' % json.dumps(SLEUTEL))
    check('kapotte opslag: gewoon nieuw gehaald, geen fout', len(functie['aanroepen']) == n + 1 and not p.fouten and len(turn_in(p.evaluate('window.__ice'))) == 1, p.fouten)
    # 6 oude sessionStorage (v106-v148) opgeruimd
    p = pagina(ctx, A, 'sessionStorage.setItem("fibro_turn_cache", "{}")')
    check('oude fibro_turn_cache (sessionStorage) opgeruimd', p.evaluate('sessionStorage.getItem("fibro_turn_cache")') is None)
    ctx.close()
    # 7 functie geeft 503
    functie.update(stand='503', aanroepen=[]); ctx = context()
    p = pagina(ctx, A); q = pagina(ctx, A)
    check('functie 503: geen TURN, niets bewaard, volgende pagina probeert opnieuw', len(functie['aanroepen']) == 2 and opslag(q) is None
          and not turn_in(q.evaluate('window.__ice')) and stun_in(q.evaluate('window.__ice')) == ['stun:136.144.154.200:3478'], functie['aanroepen'])
    ctx.close()
    # 8 niet ingelogd
    functie.update(stand='ok', aanroepen=[]); ctx = context()
    p = pagina(ctx, None)
    check('niet ingelogd: geen aanroep, alleen de spiegel', functie['aanroepen'] == [] and not turn_in(p.evaluate('window.__ice')))
    ctx.close()
    # 9 localStorage geblokkeerd (privevenster, Safari-instelling)
    ctx = context('Storage.prototype.getItem = function () { throw new Error("geblokkeerd") }; Storage.prototype.setItem = function () { throw new Error("geblokkeerd") }')
    functie['aanroepen'] = []; p = pagina(ctx, A); q = pagina(ctx, A)
    check('opslag geblokkeerd: werkt toch (elke pagina een aanroep), geen fout', len(functie['aanroepen']) == 2 and not p.fouten and not q.fouten
          and len(turn_in(q.evaluate('window.__ice'))) == 1, p.fouten + q.fouten)
    ctx.close()
    # 10 oudere functie zonder 'verloopt'
    functie.update(stand='zonder-verloopt', aanroepen=[]); ctx = context()
    p = pagina(ctx, A); q = pagina(ctx, A)
    check('functie zonder verloopt: bewaard en gebruikt', len(functie['aanroepen']) == 1 and isinstance(opslag(q), dict) and opslag(q).get('verloopt') is None)
    ctx.close()
    # 11 uitloggen wist het pasje (wisOpslag uit account.js)
    bron = open(MAP + '/account.js').read()
    uuid = re.search(r'^const UUID = .*$', bron, re.M).group(0)
    wis = re.search(r'^function wisOpslag\(opslag, uid\) \{.*?^\}', bron, re.M | re.S).group(0)
    functie.update(stand='ok', aanroepen=[]); ctx = context(); p = pagina(ctx, A)
    voor = opslag(p) is not None
    p.evaluate('(uid) => { %s\n%s\n wisOpslag(localStorage, uid) }' % (uuid, wis), A)
    check('uitloggen (wisOpslag van account.js) wist het pasje', voor and opslag(p) is None)
    ctx.close()
    # 12 pasje uit het geheugen werkt bij de postbode (alleen relay)
    functie.update(stand='ok', aanroepen=[]); ctx = context(); pagina(ctx, A); p = pagina(ctx, A)
    soorten = p.evaluate('''async () => { const pc = new RTCPeerConnection(Object.assign({}, window.__ice, { iceTransportPolicy: 'relay' }))
      pc.createDataChannel('x'); const k = []; pc.onicecandidate = e => { if (e.candidate) k.push(e.candidate.type + '/' + (e.candidate.relayProtocol || '')) }
      await pc.setLocalDescription(await pc.createOffer()); await new Promise(r => setTimeout(r, 4000)); pc.close(); return k }''')
    check('pasje uit het geheugen: postbode geeft relay (udp en tcp)', len(functie['aanroepen']) == 1 and 'relay/udp' in soorten and 'relay/tcp' in soorten, soorten)
    ctx.close()
    # 13 echt gesprek met bellen.js, beide kanten met een pasje uit het geheugen, alleen via de postbode
    functie.update(stand='ok', aanroepen=[])
    ctx = context('const O = window.RTCPeerConnection; window.__pcs = []; window.RTCPeerConnection = class extends O { '
                  'constructor(c, ...r) { super(Object.assign({}, c, { iceTransportPolicy: "relay" }), ...r); window.__pcs.push(this) } }')
    # een eigen context per 'toestel' zou BroadcastChannel scheiden; hier delen A en B er een. Daarom:
    # A haalt een pasje, een nieuw tabblad van A gebruikt het uit het geheugen, daarna haalt B zijn eigen
    pa = pagina(ctx, A, pad='bel.html'); pa2 = pagina(ctx, A, pad='bel.html'); pa.close()
    pb = pagina(ctx, B, pad='bel.html')
    na_laden = list(functie['aanroepen'])
    check('beller (A) laadt het pasje uit het geheugen', any('toestel-geheugen' in l for l in pa2.logs), [l for l in pa2.logs if '[ice]' in l])
    pb.evaluate('() => window.BEL.initBellen(window.__UID, { onOproep: () => setTimeout(() => window.BEL.accepteerOproep(false), 800), '
                'onVerbonden: () => { window.__verbonden = 1 } })')
    pa2.evaluate('() => window.BEL.initBellen(window.__UID, { onVerbonden: () => { window.__verbonden = 1 } })')
    pa2.evaluate('(b) => window.BEL.belOp(b, false)', B)
    t0 = time.time()
    while time.time() - t0 < 30 and not (pa2.evaluate('window.__verbonden') and pb.evaluate('window.__verbonden')): time.sleep(0.3)
    time.sleep(3)
    stats = 'async () => { let n = 0, rel = false; for (const pc of window.__pcs) { const s = await pc.getStats(); const k = {}; s.forEach(x => { if (x.type === "local-candidate") k[x.id] = x });'\
            ' s.forEach(x => { if (x.type === "inbound-rtp" && x.kind === "audio") n += x.packetsReceived; if (x.type === "candidate-pair" && x.nominated && x.state === "succeeded" && (k[x.localCandidateId] || {}).candidateType === "relay") rel = true }) } return [n, rel] }'
    sa, sb = pa2.evaluate(stats), pb.evaluate(stats)
    check('gesprek via de postbode met pasje uit het geheugen: verbonden, geluid beide kanten', sa[0] > 50 and sb[0] > 50 and sa[1] and sb[1]
          and na_laden == [A, B], 'A %s, B %s, aanroepen %s' % (sa, sb, na_laden))
    ctx.close()
    br.close()
turn.terminate(); turn.wait(5)
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
