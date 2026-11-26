# proef348 (26 nov 2026, Marcel): uitgenodigd met een spel -> na het vriend worden meteen samen naar de wachtkamer,
# en niemand zit vast in een lege wachtkamer.
#  A. Bram werd vriend via een uitnodiging met Four in a Row (fibro_uitdaag_<Bram>): de chat met Marcel opent en meteen
#     gaat de uitdaging eruit (bericht spelinvite + push), Bram zit in de wachtkamer; de markering is weg
#  B. Marcel (online) krijgt de uitnodiging in beeld ("Bram nodigt je uit!")
#  C. Marcel komt niet: na 2 minuten bij Bram een uitweg: 🤖 Tegen de computer en 💬 Naar de chat
#  D. Tegen de computer: Marcel krijgt een bericht dat Bram wilde spelen (push spel-gemist) en Bram speelt het spel
#     tegen de computer (spel.html?spel=vieroprij)
#  E. Marcel niet online: de uitweg komt al na 20 seconden ("Marcel is nu niet online")
#  F. een markering voor een andere vriend, of ouder dan een uur: geen uitdaging, geen wachtkamer
#  G. invite.html (bestaand account, met &spel=vieroprij): na "toevoegen" staat de markering klaar; zonder spel niet
#  H. geen paginafouten
# Op de oude versie mislukken A (geen uitdaging) en C/E (geen uitweg).
# python3 -I proef348.py <map>
import sys, os, time, json, socket, subprocess, re
from playwright.sync_api import sync_playwright
import threading
ONLINE = [True]
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram'}
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
# ---- nep-server: REST per toestel, Realtime gedeeld tussen de twee toestellen ----
def rest(uid, sleutels, posts):  # zoals proef231; posts: berichten en pushes
    ander = BRAM if uid == MARCEL else MARCEL
    def supa(route):
        u = route.request.url; m = route.request.method
        if '/rest/v1/messages' in u and m == 'POST':
            posts.append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=201, json={"id": "mn%d" % len(posts)})
        if '/rest/v1/messages' in u: return route.fulfill(status=200, json=[])
        if '/rest/v1/friendships' in u:
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "online_status": ONLINE[0], "laatst_gezien": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - (0 if ONLINE[0] else 86400))), "public_key": sleutels.get(ander)}
            return route.fulfill(status=200, json=[{"user_id": uid, "friend_id": ander, "status": "accepted", "profiles": vr}])
        if '/rest/v1/profiles' in u and m == 'GET':
            ik = {"id": uid, "username": NAAM[uid], "display_name": None, "avatar_url": "\U0001F419"}
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "public_key": sleutels.get(ander), "avatar_data": None}
            # zoals de echte server: ook de online-status (chat.html haalOnlineOp vraagt id, online_status, laatst_gezien)
            vr.update({"online_status": ONLINE[0], "laatst_gezien": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - (0 if ONLINE[0] else 86400)))})
            if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vr if ander in u else ik)
            return route.fulfill(status=200, json=[vr] if ('in.' in u or ander in u) else [ik])
        if '/functions/v1/' in u:
            try: posts.append({'push': json.loads(route.request.post_data or '{}')})
            except Exception: pass
            return route.fulfill(status=200, json={})
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": uid, "aud": "authenticated"})
        return route.fulfill(status=200, json=[])
    return supa
# ── nep-Realtime: Phoenix (vsn 2.0.0) met presence en broadcast tussen toestellen ──
rt = {'conns': [], 'ref': 0}
wacht_bezorg = []
class Conn:
    def __init__(s, ws, uid):
        s.ws = ws; s.uid = uid; s.dicht = False; s.topics = {}  # topic -> {join_ref, pg, key, meta}
        ws.on_message(s.bericht); ws.on_close(lambda *a: s.sluit())
    def stuur(s, arr):
        if s.dicht: return
        try: s.ws.send(json.dumps(arr))
        except Exception: s.dicht = True
    def leden(s, topic): return [c for c in rt['conns'] if not c.dicht and topic in c.topics]
    def staat(s, topic):
        st = {}
        for c in s.leden(topic):
            i = c.topics[topic]
            if i.get('meta') is not None: st.setdefault(i['key'], {'metas': []})['metas'].append(dict(i['meta'], phx_ref=i['phx_ref']))
        return st
    def diff(s, topic, joins, leaves):
        for c in s.leden(topic): c.stuur([c.topics[topic]['join_ref'], None, topic, 'presence_diff', {'joins': joins, 'leaves': leaves}])
    def vertrek(s, topic):
        i = s.topics.get(topic)
        if i and i.get('meta') is not None:
            weg = {i['key']: {'metas': [dict(i['meta'], phx_ref=i['phx_ref'])]}}
            i['meta'] = None
            s.diff(topic, {}, weg)
    def sluit(s):
        if s.dicht: return
        s.dicht = True
        for topic in list(s.topics):
            i = s.topics[topic]
            if i.get('meta') is not None:
                weg = {i['key']: {'metas': [dict(i['meta'], phx_ref=i['phx_ref'])]}}
                for c in s.leden(topic): c.stuur([c.topics[topic]['join_ref'], None, topic, 'presence_diff', {'joins': {}, 'leaves': weg}])
    def bericht(s, msg):
        if isinstance(msg, (bytes, bytearray)):
            # supabase-js stuurt een broadcast binair: soort 3, lengtes, dan join_ref, ref, topic, event, metadata, inhoud
            try:
                b = bytes(msg)
                if b[0] != 3: return
                lj, lr, lt, le, lm, codering = b[1], b[2], b[3], b[4], b[5], b[6]
                i = 7
                join_ref = b[i:i + lj].decode(); i += lj
                ref = b[i:i + lr].decode() or None; i += lr
                topic = b[i:i + lt].decode(); i += lt
                ev_ = b[i:i + le].decode(); i += le
                i += lm
                inhoud = json.loads(b[i:].decode() or '{}') if codering == 1 else None
            except Exception: return
            join_ref, ref, topic, event, payload = join_ref, ref, topic, 'broadcast', {'type': 'broadcast', 'event': ev_, 'payload': inhoud}
        elif isinstance(msg, str):
            try: join_ref, ref, topic, event, payload = json.loads(msg)
            except Exception: return
        else: return
        ok = lambda resp={}: s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": resp}])
        if event == 'heartbeat': return s.stuur([None, ref, 'phoenix', 'phx_reply', {"status": "ok", "response": {}}])
        if event == 'phx_join':
            cfg = (payload or {}).get('config') or {}
            pg = []
            for f in cfg.get('postgres_changes') or []:
                rt['ref'] += 1; pg.append((rt['ref'], f))
            rt['ref'] += 1
            s.topics[topic] = {'join_ref': join_ref, 'pg': pg, 'key': ((cfg.get('presence') or {}).get('key') or s.uid), 'meta': None, 'phx_ref': 'p%d' % rt['ref']}
            ok({"postgres_changes": [dict(f, id=i) for i, f in pg]})
            return s.stuur([join_ref, None, topic, 'presence_state', s.staat(topic)])
        if event == 'phx_leave':
            s.vertrek(topic); s.topics.pop(topic, None); return ok()
        if event == 'presence' and topic in s.topics:
            p = payload or {}
            if p.get('event') == 'track':
                i = s.topics[topic]
                # opnieuw volgen: oud eruit en nieuw erin in een bericht (zoals Supabase), anders lijkt hij even weg
                weg = {i['key']: {'metas': [dict(i['meta'], phx_ref=i['phx_ref'])]}} if i.get('meta') is not None else {}
                rt['ref'] += 1; i['phx_ref'] = 'p%d' % rt['ref']; i['meta'] = dict(p.get('payload') or {})
                ok(); return s.diff(topic, {i['key']: {'metas': [dict(i['meta'], phx_ref=i['phx_ref'])]}}, weg)
            if p.get('event') == 'untrack': s.vertrek(topic); return ok()
            return ok()
        if event == 'broadcast' and topic in s.topics:
            for c in s.leden(topic):
                if c is s: continue
                c.stuur([c.topics[topic]['join_ref'], None, topic, 'broadcast', payload])
            if ref: ok()
            return
        if ref: ok()
def http_broadcast(route):
    # een broadcast over http (als het kanaal nog niet open is): doorgeven aan iedereen op dat kanaal
    try:
        for m in (json.loads(route.request.post_data or '{}').get('messages') or []):
            t = m.get('topic') or ''; t = t if t.startswith('realtime:') else 'realtime:' + t
            for c in [c for c in rt['conns'] if not c.dicht and t in c.topics]:
                c.stuur([c.topics[t]['join_ref'], None, t, 'broadcast', {'type': 'broadcast', 'event': m.get('event'), 'payload': m.get('payload')}])
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
def toestel(br, uid, sl, posts=None):
    posts = [] if posts is None else posts
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, permissions=['microphone'])
    ctx.route('**/*supabase.co/**', rest(uid, sl, posts)); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w, u=uid: rt['conns'].append(Conn(w, u))); ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page(); naam = NAAM[uid]
    pg.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json'); pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

OTHER = 'cccc0001-0000-4000-8000-000000000003'
def zet_uitdaging(pg, uid, data):
    pg.evaluate("([k, v]) => localStorage.setItem(k, v)", ['fibro_uitdaag_' + uid, json.dumps(data)])
def weg_titel(pg):
    # het titelscherm van het spel ligt eerst bovenop (net als bij elke uitdaging uit de chat): wegtikken zoals een mens
    for _ in range(3):
        if not pg.evaluate("() => !!document.querySelector('.fibro-titelscherm')"): return
        try: pg.click('.fibro-titelscherm', timeout=3000)
        except Exception: pass
        pg.wait_for_timeout(700)
def invites(posts): return [x for x in posts if isinstance(x, dict) and str(x.get('content', '')).startswith('spelinvite:')]
def pushes(posts, soort=None): return [x['push'] for x in posts if isinstance(x, dict) and 'push' in x and (soort is None or x['push'].get('type') == soort)]

try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
        sl = {}
        pm, pb = [], []
        cm, m = toestel(br, MARCEL, sl, pm); cb, b = toestel(br, BRAM, sl, pb)
        # Marcel is online en heeft de chat open (daar luistert hij naar speluitnodigingen)
        m.goto(B + 'chat.html'); wacht(m, "() => !!document.querySelector('.vriend-item')", 20000)
        # ── A ──
        b.clock.install()
        zet_uitdaging(b, BRAM, {'id': MARCEL, 'spel': 'vieroprij', 't': int(time.time() * 1000)})
        b.goto(B + 'chat.html?vriend=' + MARCEL)
        wscherm = wacht(b, "() => !!document.getElementById('spelWachtscherm')", 30000)
        check('A Bram komt meteen in de wachtkamer van Four in a Row', wscherm, b.evaluate("() => (document.getElementById('spelWachtscherm') || {}).innerText || ''")[:100])
        inv = invites(pb)
        check('A de uitdaging gaat naar Marcel (bericht spelinvite:vieroprij van Bram)', len(inv) == 1 and inv[0].get('content', '').startswith('spelinvite:vieroprij:' + BRAM + ':') and inv[0].get('receiver_id') == MARCEL, inv)
        check('A met een pushmelding (stuur-push met het bericht)', any(x.get('message_id') for x in pushes(pb)), pushes(pb))
        check('A de markering is weg (maar één keer)', b.evaluate("k => localStorage.getItem(k)", 'fibro_uitdaag_' + BRAM) is None)
        # ── B ──
        check('B Marcel krijgt de uitnodiging in beeld', wacht(m, "() => (document.getElementById('spelUitnodigingTitel') || {}).textContent?.includes('Bram')", 15000),
              m.evaluate("() => (document.getElementById('spelUitnodigingTitel') || {}).textContent || ''"))
        # ── C ── (Marcel reageert niet; de klok van Bram 2 minuten vooruit)
        geen_vroeg = b.evaluate("() => !document.querySelector('.spel-wacht-uitweg')")
        b.clock.fast_forward(125000); b.wait_for_timeout(800)
        uitweg = b.evaluate("() => { const s = document.getElementById('spelWachtscherm'); return s ? { tekst: s.innerText, pc: !!s.querySelector('.spel-wacht-computer'), knoppen: [...s.querySelectorAll('.spel-wacht-uitweg button')].map(k => k.textContent) } : null }")
        check('C Marcel is online: geen uitweg vóór de 2 minuten', geen_vroeg)
        check('C na 2 minuten: "Marcel is er na 2 minuten nog niet ... bericht dat je wilde spelen"', uitweg and 'na 2 minuten nog niet' in uitweg['tekst'] and 'bericht dat je wilde spelen' in uitweg['tekst'], uitweg)
        check('C met 🤖 Tegen de computer en 💬 Naar de chat', uitweg and uitweg['knoppen'] == ['🤖 Tegen de computer', '💬 Naar de chat'], uitweg and uitweg['knoppen'])
        # ── D ──
        voor = len(pushes(pb, 'spel-gemist'))
        weg_titel(b); b.click('.spel-wacht-computer')
        naar_spel = wacht(b, "() => location.pathname.endsWith('/spel.html') && location.search.includes('spel=vieroprij')", 15000)
        check('D Tegen de computer: naar spel.html met Four in a Row', naar_spel, b.url)
        check('D Marcel krijgt een bericht dat Bram wilde spelen (push spel-gemist)', len(pushes(pb, 'spel-gemist')) == voor + 1 and pushes(pb, 'spel-gemist')[-1].get('receiver_id') == MARCEL, pushes(pb, 'spel-gemist'))
        cm.close(); cb.close()
        for c in list(rt['conns']): c.sluit()   # de nep-server: oude verbindingen echt weg (anders lijkt Marcel nog online)

        # ── E ── Marcel niet online (geen toestel, en de server zegt offline)
        ONLINE[0] = False
        pb2 = []
        cb2, b2 = toestel(br, BRAM, sl, pb2)
        b2.clock.install()
        zet_uitdaging(b2, BRAM, {'id': MARCEL, 'spel': 'vieroprij', 't': int(time.time() * 1000)})
        b2.goto(B + 'chat.html?vriend=' + MARCEL)
        check('E Bram komt in de wachtkamer', wacht(b2, "() => !!document.getElementById('spelWachtscherm')", 30000))
        for _ in range(5):   # in stapjes (samen 30 s, ruim onder de 2 minuten)
            b2.clock.fast_forward(6000); b2.wait_for_timeout(400)
            if b2.evaluate("() => !!document.querySelector('.spel-wacht-uitweg')"): break
        tekst = b2.evaluate("() => { const s = document.getElementById('spelWachtscherm'); return s && s.querySelector('.spel-wacht-uitweg') ? s.innerText : '' }")
        check('E Marcel niet online: de uitweg al na 20 seconden ("is nu niet online")', 'Marcel is nu niet online' in tekst and 'Tegen de computer' in tekst, tekst[:160])
        # Naar de chat: het spel gaat dicht, je bent in de chat met Marcel
        weg_titel(b2); b2.click('.spel-wacht-uitweg button:last-child')
        check('E Naar de chat: het spel gaat dicht en de chat met Marcel staat open',
              wacht(b2, "() => !document.getElementById('spelOverlay').classList.contains('open') && !!document.getElementById('chatScherm') && getComputedStyle(document.getElementById('chatScherm')).display !== 'none'", 8000))
        cb2.close()
        ONLINE[0] = True

        # ── F ── een markering voor een andere vriend, of te oud
        for wat, data in [('een andere vriend', {'id': OTHER, 'spel': 'vieroprij', 't': int(time.time() * 1000)}),
                          ('ouder dan een uur', {'id': MARCEL, 'spel': 'vieroprij', 't': int(time.time() * 1000) - 2 * 3600 * 1000}),
                          ('een spel dat niet met een vriend kan', {'id': MARCEL, 'spel': 'bestaatniet', 't': int(time.time() * 1000)})]:
            pf = []
            cf, f = toestel(br, BRAM, sl, pf)
            zet_uitdaging(f, BRAM, data)
            f.goto(B + 'chat.html?vriend=' + MARCEL)
            wacht(f, "() => !!document.getElementById('messages')", 20000); f.wait_for_timeout(3000)
            check('F %s: geen uitdaging en geen wachtkamer' % wat, not invites(pf) and not f.evaluate("() => !!document.getElementById('spelWachtscherm')"), invites(pf))
            cf.close()

        # ── G ── invite.html met een bestaand account
        def invite_rest(route):
            u = route.request.url
            if '/rpc/valideer_invite' in u: return route.fulfill(status=200, json=[{'created_by': MARCEL, 'token': 'fibro-proef348proef3', 'expires_at': '2099-01-01T00:00:00Z'}])
            if '/rpc/uitnodiger_van_invite' in u: return route.fulfill(status=200, json=[{'username': 'Marcel', 'avatar_url': '🐸'}])
            if '/rpc/maak_vriendschap_via_invite' in u: return route.fulfill(status=200, json=True)
            if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[])
            if '/auth/v1/user' in u: return route.fulfill(status=200, json={'id': BRAM, 'aud': 'authenticated'})
            return route.fulfill(status=200, json=[])
        for spel, verwacht in [('vieroprij', True), ('', False)]:
            cg = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
            cg.route('**/*supabase.co/**', invite_rest)
            cg.route('**/chat.html*', lambda r: r.fulfill(status=200, body='<html>chat</html>', content_type='text/html'))
            cg.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
            g = cg.new_page(); g.on('pageerror', lambda e: fouten.append('invite: ' + str(e)[:200])); g.on('dialog', lambda d: d.dismiss())
            g.goto(B + 'manifest.json'); g.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(BRAM))
            g.goto(B + 'invite.html?token=fibro-proef348proef3' + ('&spel=' + spel if spel else ''))
            if wacht(g, "() => { const s = document.getElementById('bestaandScherm'); return s && s.style.display === 'block' }", 15000):
                g.click('#toevoegBtn')
                wacht(g, "() => location.pathname.endsWith('/chat.html')", 8000)
                m_ = g.evaluate("k => localStorage.getItem(k)", 'fibro_uitdaag_' + BRAM)
                d = json.loads(m_) if m_ else None
                if verwacht: check('G invite.html met spel: de markering staat klaar (Marcel, vieroprij)', d and d.get('id') == MARCEL and d.get('spel') == 'vieroprij' and abs(d.get('t', 0) / 1000 - time.time()) < 60, d)
                else: check('G invite.html zonder spel: geen markering', d is None, d)
            else: check('G invite.html: het scherm voor een bestaand account', False)
            cg.close()
        br.close()
finally:
    srv.terminate()
check('H geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
