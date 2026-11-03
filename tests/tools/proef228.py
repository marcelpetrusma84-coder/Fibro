# proef228 (bugtest 3 nov 2026): spelgeluid met twee echte chat.html's (Marcel = speler 1, Bram = speler 2), nep-camera
# en nep-microfoon, nep-Supabase en nep-Realtime (uit proef94). Zelfde situatie als de iPhone-foutmeldingen van 3 nov.
#  A. dammen: speler 2 tikt op 📹 -> verbonden, beide horen elkaar, geen melding 'na 20 s nog geen goed geluid'
#  B. dammen: speler 2 tikt op 🎤 -> verbonden
#  C. schaken: microfoonknop uit en weer aan (de knop zet de microfoon in de stand die erop staat)
#  E. boter-kaas-en-eieren, vier op een rij, Neo Paddle, Block It: speler 2 tikt op 📹 -> verbonden, geluid, beeld
#  D. geen paginafouten
# Oude map (v van voor PR #79, 170862f) als controle: A1, A2, A3 en B1 MIS (precies de foutmelding van de iPhone).
# python3 -I proef228.py <map>
# Twee echte chat.html's (Marcel = speler 1, Bram = speler 2) met nep-camera/microfoon en de nep-Realtime uit proef94.
# A. dammen: Bram (speler 2) tikt op 📹 Webcam. Komt er een verbinding en hoort Marcel Bram (en andersom)?
# B. dammen: Bram tikt op 🎤 (nog geen microfoon). Komt er een verbinding?
# C. schaken: microfoonknop. Staat de microfoon aan na het automatische gesprek; tik op 🎤 = uit, nog eens = aan.
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
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        # A
        cm, m, cb, b = open_spel(br, 'dammen')
        klaar = wacht(b, "() => !!document.querySelector('.dm-video')", 20000) and wacht(m, "() => !!document.querySelector('.dm-video')", 20000)
        m.wait_for_timeout(1500)
        voor = (m.evaluate(STAND), b.evaluate(STAND))
        check('A0 dammen open bij beiden, nog geen gesprek', klaar and voor[0]['verbonden'] == 'geen' and voor[1]['verbonden'] == 'geen', voor)
        try: b.click('.dm-video', timeout=4000)
        except Exception as e: print('klik mislukt', e)
        ok = wacht(b, "() => (window.__pcs || []).some(pc => pc.connectionState === 'connected')", 15000)
        wacht(m, "() => { const a = document.getElementById('remoteAudio'); return a && a.srcObject && a.srcObject.getAudioTracks().some(t => t.readyState === 'live' && !t.muted) }", 15000)
        wacht(b, "() => { const a = document.getElementById('remoteAudio'); return a && a.srcObject && a.srcObject.getAudioTracks().some(t => t.readyState === 'live' && !t.muted) }", 15000)
        na = (m.evaluate(STAND), b.evaluate(STAND))
        check('A1 speler 2 tikt op 📹: verbonden', ok and na[0]['verbonden'] == 'connected' and na[1]['verbonden'] == 'connected', na)
        check('A2 Marcel hoort Bram en Bram hoort Marcel', na[0]['geluidAnder'] >= 1 and na[1]['geluidAnder'] >= 1, na)
        b.wait_for_timeout(21000)
        check('A3 geen melding "na 20 s nog geen goed geluid"', not b.evaluate("window.__meldingen") and not m.evaluate("window.__meldingen"), (b.evaluate("window.__meldingen"), m.evaluate("window.__meldingen")))
        cm.close(); cb.close()
        # B
        cm, m, cb, b = open_spel(br, 'dammen')
        wacht(b, "() => !!document.querySelector('.dm-video')", 20000); b.wait_for_timeout(1500)
        zicht = b.evaluate(STAND)
        if not zicht['micZichtbaar']: b.evaluate("document.getElementById('spelMuteBtn').style.display = 'flex'")  # knop is er misschien nog niet; dan direct de knop gebruiken
        try: b.click('#spelMuteBtn', timeout=4000, force=True)
        except Exception as e: print('klik mislukt', e)
        ok = wacht(b, "() => (window.__pcs || []).some(pc => pc.connectionState === 'connected')", 15000)
        check('B1 speler 2 tikt op 🎤: verbonden', ok, (zicht, b.evaluate(STAND)))
        cm.close(); cb.close()
        # C
        cm, m, cb, b = open_spel(br, 'schaken')
        ok = wacht(b, "() => (window.__pcs || []).some(pc => pc.connectionState === 'connected')", 30000)
        wacht(b, "() => { const k = document.getElementById('spelMuteBtn'); return k && k.textContent === '🎤' }", 8000)
        s1 = b.evaluate(STAND)
        check('C0 schaken: automatisch verbonden, microfoon aan (🎤)', ok and s1['mic'] == '🎤', s1)
        b.click('#spelMuteBtn'); b.wait_for_timeout(600)
        s2 = b.evaluate(STAND); uit = b.evaluate("(() => { const t = []; for (const pc of window.__pcs) for (const s of pc.getSenders()) if (s.track && s.track.kind === 'audio') t.push(s.track.enabled); return t })()")
        check('C1 tik op 🎤 = microfoon uit (🔇)', s2['mic'] == '🔇' and uit and not any(uit), (s2, uit))
        b.click('#spelMuteBtn'); b.wait_for_timeout(600)
        s3 = b.evaluate(STAND); aan = b.evaluate("(() => { const t = []; for (const pc of window.__pcs) for (const s of pc.getSenders()) if (s.track && s.track.kind === 'audio') t.push(s.track.enabled); return t })()")
        check('C2 nog eens = weer aan (🎤)', s3['mic'] == '🎤' and aan and all(aan), (s3, aan))
        cm.close(); cb.close()
        # E
        for spel in ('botkaaseiren', 'vieroprij', 'pong', 'breakout'):
            cm, m, cb, b = open_spel(br, spel)
            er = wacht(b, "() => !!document.getElementById('spelCamKnop')", 20000); b.wait_for_timeout(1500)
            for _ in range(8):
                if not b.evaluate("!!document.querySelector('.bi-uitleg')"): break
                b.evaluate("(() => { const u = document.querySelector('.bi-uitleg'); const k = [...u.querySelectorAll('button')].find(x => /✕|×|Sluit|Close/.test(x.textContent + (x.getAttribute('aria-label')||''))); (k || u.querySelector('button')).click() })()"); b.wait_for_timeout(400)
            try: b.click('#spelCamKnop', timeout=4000)
            except Exception as e: print('klik', str(e)[:80])
            ok = wacht(b, "() => (window.__pcs || []).some(pc => pc.connectionState === 'connected')", 15000)
            for pg in (m, b):  # beide kanten (op een trage computer komt het geluid bij de een later binnen)
                wacht(pg, "() => { const a = document.getElementById('remoteAudio'); return a && a.srcObject && a.srcObject.getAudioTracks().some(t => t.readyState === 'live' && !t.muted) }", 15000)
            st = (m.evaluate(STAND), b.evaluate(STAND))
            beeld = m.evaluate("(() => { const r = document.getElementById('remoteMedia'); return !!(r && r.srcObject && r.srcObject.getVideoTracks().some(t => t.readyState === 'live')) })()")
            check(spel + ': speler 2 tikt op 📹 -> verbonden, geluid beide kanten, Marcel krijgt beeld', er and ok and st[0]['geluidAnder'] and st[1]['geluidAnder'] and beeld, (er, st, beeld))
            cm.close(); cb.close()
        br.close()
finally:
    srv.terminate()
check('D geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
