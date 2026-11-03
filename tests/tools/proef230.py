# proef230 (3 nov 2026): hoe snel laadt Fibro op een trage telefoon? Per pagina: CPU 4x trager, trage 4G (1,6 Mbit/s,
# 150 ms), gzip zoals GitHub Pages, EERSTE bezoek (lege kast). Met 'warm' ook een tweede bezoek: eerst Home (service worker
# en kastvuller), dan de pagina. Meting 3 nov 2026: eerste bezoek chat 4,1 s (was 4,5), Home 3,9, vrienden 3,0, profiel
# 3,9, spel 2,6; tweede bezoek overal rond 1 s.
# python3 -I proef230.py <map> [rondes] [pagina,pagina] [warm]
import sys, os, time, json, socket, subprocess, re, gzip, io, http.server, functools
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

MAP = os.path.abspath(sys.argv[1]); RONDES = int(sys.argv[2]) if len(sys.argv) > 2 else 3
WARM = 'warm' in sys.argv[3:]
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_head(self):
        pad = self.translate_path(self.path.split('?')[0])
        if os.path.isfile(pad) and pad.endswith(('.html', '.js', '.css', '.json', '.svg', '.mjs', '.txt')) and 'gzip' in self.headers.get('Accept-Encoding', ''):
            data = gzip.compress(open(pad, 'rb').read(), 6)
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(pad)); self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(data))); self.end_headers()
            import io; return io.BytesIO(data)
        return super().send_head()
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
server = http.server.ThreadingHTTPServer(('127.0.0.1', poort), functools.partial(H, directory=MAP))
import threading as _t; _t.Thread(target=server.serve_forever, daemon=True).start()
B = 'http://127.0.0.1:%d/' % poort
class _Srv:
    def terminate(self): server.shutdown()
srv = _Srv()
KLAAR_ALLES = {
  'index.html': "() => document.body.innerText.length > 200",
  'chat.html': "() => document.querySelectorAll('#vriendenLijst .vriend-item').length > 0",
  'vrienden.html': "() => document.querySelectorAll('#vriendenLijst > *').length > 0",
  'profiel.html': "() => document.body.innerText.length > 200",
  'spel.html?spel=dammen': "() => document.body.innerText.length > 20",
}
KLAAR = {k: v for k, v in KLAAR_ALLES.items() if len(sys.argv) < 4 or sys.argv[3] == 'warm' or k in sys.argv[3].split(',')}
uit = {}
try:
  with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-proxy-server'])
    for naam, klaar in KLAAR.items():
      tijden = []
      for r in range(RONDES):
        ctx = br.new_context(service_workers=('allow' if WARM else 'block'), viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        sl = {}; ctx.route('**/*supabase.co/**', rest(MARCEL, sl, [])); ctx.route_web_socket('**/realtime/v1/websocket**', ws)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda rr: rr.fulfill(status=204, body=''))
        pg = ctx.new_page(); pg.goto(B + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(MARCEL))
        sl[BRAM] = sl[MARCEL] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", MARCEL)
        pg.close(); pg = ctx.new_page()
        if WARM:
          pg.goto(B + 'index.html', wait_until='load'); pg.wait_for_timeout(15000); pg.goto(B + naam, wait_until='load'); pg.wait_for_timeout(4000); pg.close(); pg = ctx.new_page()
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Network.enable'); cdp.send('Network.setCacheDisabled', {'cacheDisabled': not WARM})
        cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': 1.6e6 / 8, 'uploadThroughput': 750e3 / 8})
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        bytes_ = [0]; n = [0]
        pg.on('requestfinished', lambda rq: (n.__setitem__(0, n[0] + 1), bytes_.__setitem__(0, bytes_[0] + ((rq.sizes() or {}).get('responseBodySize') or 0))) if rq.url.startswith(B) else None)
        t0 = time.time(); pg.goto(B + naam, wait_until='load', timeout=120000); tl = time.time() - t0
        try: pg.wait_for_function(klaar, timeout=60000); tk = time.time() - t0
        except Exception: tk = None
        dcl = pg.evaluate("performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd / 1000")
        pg.wait_for_timeout(500)
        tijden.append({'dcl': round(dcl, 2), 'load': round(tl, 2), 'klaar': round(tk, 2) if tk else None, 'verzoeken': n[0], 'kB': round(bytes_[0] / 1024)})
        ctx.close()
      mid = sorted(tijden, key=lambda x: x['load'])[len(tijden) // 2]
      uit[naam] = mid; print(naam, mid, flush=True)
    br.close()
finally: srv.terminate()
json.dump(uit, open('/tmp/claude-0/bug/snelheid-' + os.path.basename(MAP.rstrip('/')) + '.json', 'w'), indent=1)
