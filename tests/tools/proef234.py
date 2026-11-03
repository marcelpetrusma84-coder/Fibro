# proef234 (3 nov 2026): pushmeldingen voor spellen vanuit de app (chat.html). Twee echte chat.html's, nep-server
# (alle aanvragen aan stuur-push worden opgevangen):
#  A. Marcel nodigt Bram uit voor dammen (Bram is er niet): de app vraagt een melding met het id van de uitnodiging
#  B. Marcel stopt met wachten (sluit het spel): melding 'spel-gemist' voor Bram, met inlogpas
#  C. Samen spelen, beide actief, Marcel sluit: GEEN melding (Bram ziet het in het spel)
#  D. Samen spelen, Bram is weg (geen internet, 20 s niets gehoord), Marcel sluit: melding 'spel-verlaten' voor Bram
# python3 -I proef234.py <map>
import sys, os, time, json, socket, subprocess, re
from playwright.sync_api import sync_playwright
import threading
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram'}
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
# ---- nep-server: REST per toestel, Realtime gedeeld tussen de twee toestellen ----
RT = {'sockets': [], 'uit': [], 'lock': threading.Lock()}
def rest(uid, sleutels, posts):
    ander = BRAM if uid == MARCEL else MARCEL
    def supa(route):
        u = route.request.url; m = route.request.method
        if '/rest/v1/messages' in u and m == 'POST':
            posts.append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=201, json={"id": "mn%d" % len(posts)})
        if '/rest/v1/messages' in u: return route.fulfill(status=200, json=[])
        if '/rest/v1/friendships' in u:
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "online_status": True, "laatst_gezien": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), "public_key": sleutels.get(ander)}
            return route.fulfill(status=200, json=[{"user_id": uid, "friend_id": ander, "status": "accepted", "profiles": vr}])
        if '/rest/v1/profiles' in u and m == 'GET':
            ik = {"id": uid, "username": NAAM[uid], "display_name": None, "avatar_url": "\U0001F419"}
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "public_key": sleutels.get(ander), "avatar_data": None}
            if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vr if ander in u else ik)
            return route.fulfill(status=200, json=[vr] if ('in.' in u or ander in u) else [ik])
        if '/functions/v1/' in u: return route.fulfill(status=200, json={})
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": uid, "aud": "authenticated"})
        return route.fulfill(status=200, json=[])
    return supa
def stuur_door(van, topic, event, payload):
    with RT['lock']:
        RT['uit'].append((topic, event, payload))
        for s in list(RT['sockets']):
            if s['w'] is van or topic not in s['topics']: continue
            try: s['w'].send(json.dumps([s['topics'][topic], None, topic, 'broadcast', {'type': 'broadcast', 'event': event, 'payload': payload}]))
            except Exception: pass
def ws(w):
    s = {'w': w, 'topics': {}}
    with RT['lock']: RT['sockets'].append(s)
    def bericht(m):
        if isinstance(m, (bytes, bytearray)):
            b = bytes(m)
            try:
                if b[0] != 3: return
                lj, lr, lt, le, lm, cod = b[1], b[2], b[3], b[4], b[5], b[6]; i = 7 + lj + lr
                topic = b[i:i + lt].decode(); i += lt; ev_ = b[i:i + le].decode(); i += le + lm
                stuur_door(w, topic, ev_, json.loads(b[i:].decode() or '{}') if cod == 1 else None)
            except Exception: pass
            return
        try: jr, ref, topic, event, payload = json.loads(m)
        except Exception: return
        if event == 'phx_join':
            s['topics'][topic] = jr
            pg_ = [dict(f, id=k + 1) for k, f in enumerate(((payload or {}).get('config') or {}).get('postgres_changes') or [])]
            w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {'postgres_changes': pg_}}])); return
        if event == 'phx_leave': s['topics'].pop(topic, None)
        if event == 'broadcast': stuur_door(w, topic, (payload or {}).get('event'), (payload or {}).get('payload'))
        if ref: w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {}}]))
    w.on_message(bericht)
    w.on_close(lambda *a: RT['sockets'].remove(s) if s in RT['sockets'] else None)
def http_broadcast(route):
    try:
        for m in (json.loads(route.request.post_data or '{}').get('messages') or []):
            t = m.get('topic') or ''
            stuur_door(None, t if t.startswith('realtime:') else 'realtime:' + t, m.get('event'), m.get('payload'))
    except Exception: pass
    return route.fulfill(status=202, body='')

MAP = os.path.abspath(sys.argv[1])
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/' % poort
uitslag = []; fouten = []
def check(n, ok, info=''): uitslag.append(bool(ok)); print(('OK   ' if ok else 'MIS  ') + n + ('  | ' + str(info)[:260] if info != '' else ''), flush=True)
def wacht(pg, js, ms):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
STAND = """() => { const pcs = window.__pcs || []; const pc = pcs[pcs.length - 1]
  const a = document.getElementById('remoteAudio'); const at = a && a.srcObject ? a.srcObject.getAudioTracks().filter(t => t.readyState === 'live' && !t.muted) : []
  const k = document.getElementById('spelMuteBtn')
  return { verbonden: pc ? pc.connectionState : 'geen', geluidAnder: at.length, mic: k ? k.textContent : null, micZichtbaar: k ? getComputedStyle(k).display !== 'none' : false } }"""
VOLG_PC = "(() => { const O = window.RTCPeerConnection; window.__pcs = []; window.RTCPeerConnection = function (...a) { const pc = new O(...a); window.__pcs.push(pc); return pc }; window.RTCPeerConnection.prototype = O.prototype })()"
# na 20 s geeft de foutmelder een melding: opvangen
FOUTMELDER = "(() => { window.__meldingen = []; Object.defineProperty(window, '__fibroFoutmelder', { configurable: true, get() { return { meld: (...a) => window.__meldingen.push(a.join(' | ')) } }, set() {} }) })()"

PUSH = []
def naam_van(uid): return NAAM[uid]
def push_of(gewoon, wie):
    def route(r):
        if '/functions/v1/stuur-push' in r.request.url:
            try: b = json.loads(r.request.post_data or '{}')
            except Exception: b = {}
            PUSH.append({'van': wie, 'pas': bool((r.request.headers.get('authorization') or '').startswith('Bearer ')), **b})
            return r.fulfill(status=200, json={'ok': True})
        return gewoon(r)
    return route
def toestel(br, uid, sl):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, permissions=['camera', 'microphone'])
    ctx.route('**/*supabase.co/**', push_of(rest(uid, sl, []), naam_van(uid))); ctx.route_web_socket('**/realtime/v1/websocket**', ws); ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.add_init_script(VOLG_PC); ctx.add_init_script(FOUTMELDER)
    pg = ctx.new_page(); naam = NAAM[uid]
    pg.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json'); pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

def open_chat(pg):
    pg.goto(B + 'chat.html')
    if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", 15000): pg.click('#vriendenLijst .vriend-item')
    pg.wait_for_timeout(1500)
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl); cb, b = toestel(br, BRAM, sl)
        open_chat(m)
        # A
        PUSH.clear()
        m.evaluate("window.startSpel('dammen')"); m.wait_for_timeout(3000)
        a = [x for x in PUSH if x['van'] == 'Marcel' and x.get('message_id')]
        check('A uitnodiging: de app vraagt een melding met het id van de uitnodiging', len(a) == 1, PUSH)
        # B
        PUSH.clear()
        m.evaluate("window.sluitSpel()"); m.wait_for_timeout(1500)
        g = [x for x in PUSH if x.get('type') == 'spel-gemist']
        check('B gestopt met wachten: spel-gemist voor Bram, met inlogpas', len(g) == 1 and g[0]['receiver_id'] == BRAM and g[0]['spel'] == 'dammen' and g[0]['pas'], PUSH)
        # C: samen, beide actief
        open_chat(b)
        sessie = m.evaluate("Date.now().toString(36)")
        for pg in (m, b): pg.evaluate("([s, n, u]) => { window.speelMee(s, n, u) }", ['dammen', sessie, MARCEL])
        for pg in (m, b):
            pg.wait_for_timeout(1500)
            for _ in range(3):
                if pg.evaluate("!!(e => e && getComputedStyle(e).display !== 'none')(document.querySelector('.fibro-titelscherm'))"): pg.mouse.click(195, 600); pg.wait_for_timeout(500)
        samen = wacht(m, "() => !!document.querySelector('.dm-video')", 20000) and wacht(b, "() => !!document.querySelector('.dm-video')", 20000)
        m.wait_for_timeout(2000)
        PUSH.clear()
        m.evaluate("window.sluitSpel()"); m.wait_for_timeout(1500)
        check('C samen actief, Marcel sluit: geen melding', samen and not [x for x in PUSH if str(x.get('type', '')).startswith('spel')], (samen, PUSH))
        # D: samen, dan Bram weg
        b.evaluate("window.sluitSpel(true)"); b.wait_for_timeout(500)
        sessie = m.evaluate("Date.now().toString(36) + 'd'")
        for pg in (m, b): pg.evaluate("([s, n, u]) => { window.speelMee(s, n, u) }", ['dammen', sessie, MARCEL])
        for pg in (m, b):
            pg.wait_for_timeout(1500)
            for _ in range(3):
                if pg.evaluate("!!(e => e && getComputedStyle(e).display !== 'none')(document.querySelector('.fibro-titelscherm'))"): pg.mouse.click(195, 600); pg.wait_for_timeout(500)
        samen = wacht(m, "() => !!document.querySelector('.dm-video')", 20000) and wacht(b, "() => !!document.querySelector('.dm-video')", 20000)
        cb.set_offline(True)  # Bram weg (telefoon in zijn zak)
        m.wait_for_timeout(26000)
        PUSH.clear()
        m.evaluate("window.sluitSpel()"); m.wait_for_timeout(1500)
        v = [x for x in PUSH if x.get('type') == 'spel-verlaten']
        check('D Bram weg, Marcel sluit: spel-verlaten voor Bram', samen and len(v) == 1 and v[0]['receiver_id'] == BRAM and v[0]['spel'] == 'dammen' and v[0]['pas'], (samen, PUSH))
        cm.close(); cb.close(); br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
