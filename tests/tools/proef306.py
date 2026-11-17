# proef306 (17 nov 2026): profiel via vrienden, stap 3. Marcel en Bram zijn tegelijk online en synchroniseren
# rechtstreeks (sync.js, nep-Supabase en nep-Realtime uit proef231). Marcel stuurt een ondertekend lijstje van zijn
# profielonderdelen mee (profielbundel.js).
#  A. Bram krijgt het profiel van Marcel rechtstreeks (indeling, quote, foto)
#  B. Bram bewaart het ondertekende lijstje (vriend_<marcel>_handtekening), met Marcel als eigenaar
#  C. de handtekening klopt met de publieke sleutel van Marcel, en elk bewaard onderdeel past bij het lijstje
#  D. geen paginafouten
# Oude map (zonder stap 3) als controle: B en C MIS.
# python3 -I proef306.py <map>
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
            s.setdefault('sleutel', {})[topic] = (((payload or {}).get('config') or {}).get('presence') or {}).get('key') or ''
            pg_ = [dict(f, id=k + 1) for k, f in enumerate(((payload or {}).get('config') or {}).get('postgres_changes') or [])]
            w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {'postgres_changes': pg_}}])); return
        if event == 'phx_leave': s['topics'].pop(topic, None)
        if event == 'broadcast': stuur_door(w, topic, (payload or {}).get('event'), (payload or {}).get('payload'))
        # proef306: aanwezigheid (presence), zodat sync.js ziet dat de ander online is
        if event == 'presence' and (payload or {}).get('event') == 'track':
            key = s.get('sleutel', {}).get(topic) or 'x'
            meta = dict((payload or {}).get('payload') or {}, phx_ref='r%d' % len(RT['uit']))
            with RT['lock']:
                RT.setdefault('aanwezig', {}).setdefault(topic, {})[key] = meta
                for t in list(RT['sockets']):
                    if topic in t['topics']:
                        try: t['w'].send(json.dumps([t['topics'][topic], None, topic, 'presence_diff', {'joins': {key: {'metas': [meta]}}, 'leaves': {}}]))
                        except Exception: pass
                staat = {k: {'metas': [v]} for k, v in RT['aanwezig'][topic].items()}
            try: w.send(json.dumps([jr, None, topic, 'presence_state', staat]))
            except Exception: pass
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
    if os.environ.get('LOG'): pg.on('console', lambda c: print(naam, c.text[:160]) if '[sync]' in c.text or '[paren]' in c.text or 'handtekening' in c.text else None)
    pg.goto(B + 'manifest.json'); pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

MARCEL_LS = {
  'fibro_widgets_profiel_' + MARCEL: json.dumps([{'id': 'quote', 'aan': True, 'volgorde': 1, 'w': 4, 'h': 1}, {'id': 'fotos_2x2', 'aan': True, 'volgorde': 2, 'w': 2, 'h': 2}]),
  'quote_' + MARCEL: json.dumps({'tekst': 'Ondertekend door Marcel', 'grootte': 16}),
  'fibro_profiel_' + MARCEL: json.dumps({'naam': 'Marcel P.'}),
}
FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
ZET_FOTO = """async ([uid, foto]) => { const db = await new Promise((ok, f) => { const r = indexedDB.open('FibroDB', 2)
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }
  r.onsuccess = e => ok(e.target.result); r.onerror = f })
  await new Promise(k => { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: 'pfoto_2x2_0_' + uid, data: foto }); tx.oncomplete = k }) }"""
LEES = """async ([marcel, sleutel]) => { const db = await new Promise((ok, f) => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = e => ok(e.target.result); r.onerror = f })
  const get = id => new Promise(k => { const q = db.transaction('fotos').objectStore('fotos').get(id); q.onsuccess = () => k(q.result || null); q.onerror = () => k(null) })
  const h = await import('./profielhandtekening.js?v=2')
  const pre = 'vriend_' + marcel + '_'
  const rec = await get(pre + 'handtekening')
  const uit = { layout: !!(await get(pre + 'layout')), quote: !!(await get(pre + 'quote')), foto: !!(await get(pre + 'foto_pfoto_2x2_0')), lijst: null }
  if (!rec) return uit
  const lijst = JSON.parse(rec.data)
  uit.lijst = { eigenaar: lijst.eigenaar, onderdelen: Object.keys(lijst.items).sort() }
  uit.klopt = await h.controleerProfiel(lijst, { eigenaar: marcel, publicKeyB64: sleutel })
  uit.onderdelenKloppen = {}
  for (const naam of ['layout', 'quote', 'foto_pfoto_2x2_0']) { const r = await get(pre + naam); uit.onderdelenKloppen[naam] = !!r && await h.controleerOnderdeel(lijst, naam, r.data) }
  return uit }"""
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl)
        cb, b = toestel(br, BRAM, sl)
        m.evaluate("ls => { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v) }", MARCEL_LS)
        m.evaluate(ZET_FOTO, [MARCEL, FOTO])
        m.goto(B + 'vrienden.html'); b.goto(B + 'vrienden.html')
        klaar = "async m => { const db = await new Promise(ok => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = e => ok(e.target.result); r.onerror = () => ok(null) }); if (!db || !db.objectStoreNames.contains('fotos')) return false; const n = await new Promise(k => { const q = db.transaction('fotos').objectStore('fotos').count(IDBKeyRange.bound('vriend_' + m + '_', 'vriend_' + m + '_~')); q.onsuccess = () => k(q.result); q.onerror = () => k(0) }); return n >= 4 }"
        t0 = time.time()
        while time.time() - t0 < 45 and not b.evaluate(klaar, MARCEL): b.wait_for_timeout(1000)
        b.wait_for_timeout(2000)
        u = b.evaluate(LEES, [MARCEL, sl[MARCEL]])
        check('A Bram kreeg het profiel van Marcel rechtstreeks (indeling, quote, foto)', u['layout'] and u['quote'] and u['foto'], u)
        check('B Bram bewaarde het ondertekende lijstje van Marcel', bool(u['lijst']) and u['lijst']['eigenaar'] == MARCEL
              and {'layout', 'quote', 'foto_pfoto_2x2_0'} <= set(u['lijst']['onderdelen']), u.get('lijst'))
        check('C de handtekening klopt met de sleutel van Marcel', u.get('klopt') is True, u.get('klopt'))
        check('C elk bewaard onderdeel past bij het lijstje', u.get('onderdelenKloppen') and all(u['onderdelenKloppen'].values()), u.get('onderdelenKloppen'))
        cm.close(); cb.close(); br.close()
finally:
    srv.terminate()
check('D geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
