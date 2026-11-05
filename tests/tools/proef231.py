# proef231 (3 nov 2026): kleine profielupdates via de postbus (postbus.js) als je NIET tegelijk online bent.
# Twee echte toestellen (nep-Supabase met een echte tabel profiel_post in het geheugen, nep-Realtime uit proef94):
#  A. Marcel zet een quote-widget en een weergavenaam op zijn profiel en opent Vrienden; Bram is offline.
#     -> er staat een versleuteld pakketje voor Bram op de 'server' (zonder leesbare tekst)
#  B. Marcel gaat weg. Pas DAARNA opent Bram Fibro -> het pakketje komt binnen en is van de server weg
#  C. Op het profiel van Marcel ziet Bram de quote en de weergavenaam, zonder dat Marcel online was
#  D. geen paginafouten
# Oude map (zonder postbus) als controle: A, B en C MIS.
# python3 -I proef231.py <map>
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

POST = []   # de tabel profiel_post op de nep-server
def postbus_of(gewoon):
    from urllib.parse import urlparse, parse_qsl
    def route(r):
        u = r.request.url
        if '/rest/v1/profiel_post' not in u: return gewoon(r)
        q = dict(parse_qsl(urlparse(u).query))
        f = {k: v[3:] for k, v in q.items() if k in ('afzender', 'ontvanger') and v.startswith('eq.')}
        past = lambda rij: all(rij[k] == v for k, v in f.items())
        m = r.request.method
        if m == 'POST':
            b = json.loads(r.request.post_data or '[]'); b = b if isinstance(b, list) else [b]
            for rij in b:
                for oud in [x for x in POST if x['afzender'] == rij['afzender'] and x['ontvanger'] == rij['ontvanger']]: POST.remove(oud)
                POST.append(dict(rij, bijgewerkt=time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())))
            return r.fulfill(status=201, body='')
        if m == 'DELETE':
            for rij in [x for x in POST if past(x)]: POST.remove(rij)
            return r.fulfill(status=204, body='')
        return r.fulfill(status=200, json=[dict(x) for x in POST if past(x)])
    return route
def toestel(br, uid, sl):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, permissions=['camera', 'microphone'])
    ctx.route('**/*supabase.co/**', postbus_of(rest(uid, sl, []))); ctx.route_web_socket('**/realtime/v1/websocket**', ws); ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.add_init_script(VOLG_PC); ctx.add_init_script(FOUTMELDER)
    pg = ctx.new_page(); naam = NAAM[uid]
    pg.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json'); pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

MARCEL_LS = {
  'fibro_widgets_profiel_' + MARCEL: json.dumps([{'id': 'quote', 'aan': True, 'volgorde': 1, 'w': 4, 'h': 1}]),
  'quote_' + MARCEL: json.dumps({'tekst': 'Groeten van Marcel uit de postbus', 'grootte': 16}),
  'fibro_profiel_' + MARCEL: json.dumps({'naam': 'Marcel P.'}),
}
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl)
        cb, b = toestel(br, BRAM, sl)   # alleen sleutels maken; Bram opent nog niets van Stekky
        b.goto(B + 'manifest.json')
        m.evaluate("ls => { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v) }", MARCEL_LS)
        m.goto(B + 'vrienden.html')
        t0 = time.time()
        while time.time() - t0 < 25 and not any(x['ontvanger'] == BRAM for x in POST): m.wait_for_timeout(500)
        pak = [x for x in POST if x['afzender'] == MARCEL and x['ontvanger'] == BRAM]
        check('A Marcel zet een versleuteld pakketje klaar voor Bram (Bram offline)', len(pak) == 1 and pak[0]['inhoud'].startswith('e2e:2:')
              and 'Groeten' not in pak[0]['inhoud'] and 'Marcel P.' not in pak[0]['inhoud'], [len(POST), pak[0]['inhoud'][:40] if pak else None])
        cm.close()   # Marcel weg
        b.goto(B + 'vrienden.html')
        t0 = time.time()
        while time.time() - t0 < 25 and any(x['ontvanger'] == BRAM for x in POST): b.wait_for_timeout(500)
        b.wait_for_timeout(1500)
        check('B Bram opent Stekky later: pakketje binnen en van de server weg', not any(x['ontvanger'] == BRAM for x in POST), len(POST))
        b.goto(B + 'vriend-profiel.html?id=' + MARCEL)
        wacht(b, "() => document.body.innerText.includes('Groeten van Marcel uit de postbus')", 10000)
        tekst = b.evaluate("document.body.innerText")
        check('C Bram ziet de quote van Marcel', 'Groeten van Marcel uit de postbus' in tekst, tekst[:200])
        check('C Bram ziet de weergavenaam van Marcel', 'Marcel P.' in tekst, tekst[:200])
        cb.close(); br.close()
finally:
    srv.terminate()
check('D geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
