# proef270: v270, verzoek van Marcel: bij schaken tegen een vriend de webcams net als bij dammen, vier op een rij en
# boter-kaas-en-eieren: twee RONDJES naast elkaar boven het bord, met dezelfde gekleurde randen (goud als iemand praat,
# rood als je een stuk kwijtraakt). Twee ECHTE chat.html's (Marcel wit, Bram zwart) met nep-camera (infrastructuur uit proef228).
#  A. beide webcams aan: rondjesmodus (dam-video-modus), NIET de oude schaakindeling (brede balken)
#  B. de twee beelden zijn rond, even groot, staan naast elkaar op dezelfde hoogte en boven het bord (niet erover)
#  C. maar een webcamknop (geen extra knop bovenin naast de microfoon)
#  D. praten: het rondje krijgt een gouden rand (de nep-microfoon piept)
#  E. slaan: e4 d5 exd5 -> bij Bram (stuk kwijt) wordt zijn eigen rondje rood, bij Marcel het rondje van Bram
#  F. geen paginafouten
# Oude map (v269) als controle: A, B en C MIS.
# python3 -I proef270.py <map>
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
def toestel(br, uid, sl):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, permissions=['camera', 'microphone'])
    ctx.route('**/*supabase.co/**', rest(uid, sl, [])); ctx.route_web_socket('**/realtime/v1/websocket**', ws); ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.add_init_script(VOLG_PC); ctx.add_init_script(FOUTMELDER)
    pg = ctx.new_page(); naam = NAAM[uid]
    pg.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json'); pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg
def open_spel(br, spel):
    RT['uit'].clear(); sl = {}
    cm, m = toestel(br, MARCEL, sl); cb, b = toestel(br, BRAM, sl)
    for pg in (m, b):
        pg.goto(B + 'chat.html')
        if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", 15000): pg.click('#vriendenLijst .vriend-item')
    m.wait_for_timeout(1200)
    sessie = m.evaluate("Date.now().toString(36)")
    for pg in (m, b): pg.evaluate("([s, n, u]) => { window.speelMee(s, n, u) }", [spel, sessie, MARCEL])
    for pg in (m, b):   # titelscherm wegtikken
        pg.wait_for_timeout(1500)
        for _ in range(3):
            if pg.evaluate("!!(e => e && getComputedStyle(e).display !== 'none')(document.querySelector('.fibro-titelscherm'))"): pg.mouse.click(195, 600); pg.wait_for_timeout(500)
    return cm, m, cb, b
RONDJES = r"""() => { const o = document.getElementById('spelOverlay'), e = document.getElementById('spelVideoEigen'), a = document.getElementById('spelVideoAnder'), f = document.querySelector('#spelInhoud .sch-frame')
  const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom), rond: getComputedStyle(el).borderRadius } }
  return { dam: o.classList.contains('dam-video-modus'), oud: o.classList.contains('chess-media-layout') || !!document.querySelector('.chess-camera-group'), eigen: r(e), ander: r(a), bord: f ? r(f) : null,
    knoppen: document.querySelectorAll('#spelCamKnop').length + document.querySelectorAll('#sch-video').length } }"""
def rondjes_ok(s):
    if not isinstance(s, dict) or not s['bord']: return False
    e, a, f = s['eigen'], s['ander'], s['bord']
    rond = all(x['rond'] in ('50%',) or x['rond'].startswith('9999') or (x['rond'].endswith('px') and float(x['rond'][:-2]) >= x['w'] / 2 - 1) for x in (e, a))
    return (rond and abs(e['w'] - e['h']) <= 2 and abs(e['w'] - a['w']) <= 2 and 80 <= e['w'] <= 140 and abs(e['y'] - a['y']) <= 2
            and a['x'] + a['w'] <= e['x'] and e['b'] <= f['y'] and a['b'] <= f['y'])
def klik(pg, sel):
    try: pg.click(sel, timeout=4000); return True
    except Exception as e: return False
def ev(pg, js):
    try: return pg.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:160]
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        cm, m, cb, b = open_spel(br, 'schaken')
        ok = wacht(m, "() => !!document.getElementById('sch-video')", 20000) and wacht(b, "() => !!document.getElementById('sch-video')", 20000)
        m.wait_for_timeout(1200)
        klik(m, '#sch-video'); m.wait_for_timeout(1500); klik(b, '#sch-video')
        wacht(m, "() => { const r = document.getElementById('remoteMedia'); return r && r.videoWidth > 0 }", 20000)
        m.wait_for_timeout(1500)
        sm, sb = ev(m, RONDJES), ev(b, RONDJES)
        check('A rondjesmodus zoals dammen, niet de oude schaakindeling', ok and isinstance(sm, dict) and sm['dam'] and not sm['oud'] and isinstance(sb, dict) and sb['dam'] and not sb['oud'], (ok, sm, sb))
        check('B twee ronde beelden naast elkaar boven het bord (Marcel)', rondjes_ok(sm), sm)
        check('B twee ronde beelden naast elkaar boven het bord (Bram)', rondjes_ok(sb), sb)
        check('C maar een webcamknop', isinstance(sm, dict) and sm['knoppen'] == 1, sm)
        if os.environ.get('PROEF_FOTO'): m.screenshot(path=os.environ['PROEF_FOTO'])
        for pg in (m, b): pg.mouse.click(380, 830)   # een tik: geluid mag beginnen (zoals op een telefoon)
        goud = wacht(m, "() => document.querySelector('#spelOverlay.dam-video-modus .spel-video-vak.praat') !== null", 10000)
        check('D praten: gouden rand om een rondje', goud)
        def zet(pg, a, b_): klik(pg, '#sch-bord [data-r="%d"][data-k="%d"]' % a); klik(pg, '#sch-bord [data-r="%d"][data-k="%d"]' % b_); pg.wait_for_timeout(1200)
        zet(m, (6, 4), (4, 4)); b.wait_for_timeout(1500); zet(b, (1, 3), (3, 3)); m.wait_for_timeout(1500)   # e4 d5 (wachten tot de zet bij de ander is)
        for pg in (m, b): pg.evaluate("""() => { window.__rood = []; new MutationObserver(() => { for (const id of ['spelVideoEigen', 'spelVideoAnder']) if (document.getElementById(id).classList.contains('geslagen') && !window.__rood.includes(id)) window.__rood.push(id) }).observe(document.getElementById('spelOverlay'), { subtree: true, attributes: true, attributeFilter: ['class'] }) }""")
        zet(m, (4, 4), (3, 3)); m.wait_for_timeout(2500)
        rm, rb = ev(m, "window.__rood"), ev(b, "window.__rood")
        if os.environ.get('PROEF_FOTO'): b.screenshot(path=os.environ['PROEF_FOTO'].replace('.png', '-bram.png'))
        check('E slaan: bij Bram zijn eigen rondje rood, bij Marcel dat van Bram', rm == ['spelVideoAnder'] and rb == ['spelVideoEigen'], (rm, rb))
        cm.close(); cb.close(); br.close()
finally:
    srv.terminate()
check('F geen paginafouten', not fouten, fouten[:3])
print('KLAAR: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if all(uitslag) else 1)
