# proef240 (4 nov 2026, v261): "… is aan het typen" en gelezen-vinkjes (chatstatus.js, sql/gelezen-vinkjes.sql).
# Twee echte toestellen in Chrome (nep-Supabase met berichten, laatst_gelezen en chat_instellingen; nep-Realtime met
# aanwezigheid en postgres_changes uit proef62):
#  T. Bram typt -> bij Marcel onder de naam "Bram is aan het typen…"; na 5 s stil weer weg; bericht binnen = meteen weg
#  G. Marcel stuurt terwijl Bram de chat NIET open heeft: ✓ (grijs). Bram opent de chat: bij Marcel ✓✓ blauw, zonder verversen
#  U. Bram zet Gelezen-vinkjes uit: Marcel ziet na verversen weer ✓, en Bram ziet bij Marcel ook geen blauwe vinkjes meer
#  D. geen paginafouten
# python3 -I proef240.py <map>
import sys, os, time, json, socket, subprocess, re
from playwright.sync_api import sync_playwright
import threading
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram'}
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
# ---- nep-server: REST per toestel, Realtime gedeeld tussen de twee toestellen ----
DB = {'berichten': [], 'gelezen': {}, 'instelling': {}}   # gelezen[(lezer, vriend)] = tijd; instelling[uid] = bool
def nu(): return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + '.%03dZ' % (int(time.time() * 1000) % 1000)
def rest(uid, sleutels, posts):
    ander = BRAM if uid == MARCEL else MARCEL
    def supa(route):
        u = route.request.url; m = route.request.method
        body = lambda: json.loads(route.request.post_data or '{}')
        if '/rest/v1/rpc/markeer_gelezen' in u:
            DB['gelezen'][(uid, body().get('p_vriend'))] = nu(); return route.fulfill(status=204, body='')
        if '/rest/v1/rpc/ongelezen_per_vriend' in u: return route.fulfill(status=200, json=[])
        if '/rest/v1/rpc/zet_leesbevestiging' in u:
            DB['instelling'][uid] = bool(body().get('p_aan')); return route.fulfill(status=204, body='')
        if '/rest/v1/rpc/gelezen_door' in u:
            vr = body().get('p_vriend')
            ok = DB['instelling'].get(uid, True) and DB['instelling'].get(vr, True)
            return route.fulfill(status=200, json=DB['gelezen'].get((vr, uid)) if ok else None)
        if '/rest/v1/chat_instellingen' in u:
            v = DB['instelling'].get(uid)
            return route.fulfill(status=200, json=None if v is None else {'leesbevestiging': v})
        if '/rest/v1/messages' in u and m == 'POST':
            r = body(); r = r[0] if isinstance(r, list) else r
            r['id'] = '00000000-0000-4000-8000-%012d' % (len(DB['berichten']) + 1); r['created_at'] = nu()
            DB['berichten'].append(r)
            bezorg(r)
            return route.fulfill(status=201, json=[r] if 'return=representation' in (route.request.headers.get('prefer') or '') else r)
        if '/rest/v1/messages' in u: return route.fulfill(status=200, json=list(reversed(DB['berichten'])))
        if '/rest/v1/friendships' in u:
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "online_status": True, "laatst_gezien": nu(), "public_key": sleutels.get(ander)}
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

def bezorg(rec):
    for c in [c for c in rt['conns'] if not c.dicht]:
        for topic, info in list(c.topics.items()):
            ids = []
            for i, f in info['pg']:
                if f.get('table') != 'messages' or f.get('event') not in ('*', 'INSERT'): continue
                flt = f.get('filter')
                if flt:
                    kol, waarde = flt.split('=eq.')
                    if rec.get(kol) != waarde: continue
                ids.append(i)
            if ids:
                c.stuur([info['join_ref'], None, topic, 'postgres_changes', {"ids": ids, "data": {"type": "INSERT", "schema": "public", "table": "messages",
                         "commit_timestamp": rec['created_at'], "record": rec, "columns": [], "errors": None}}])

MAP = os.path.abspath(sys.argv[1])
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/' % poort
uitslag = []; fouten = []
def check(n, ok, info=''): uitslag.append(bool(ok)); print(('OK   ' if ok else 'MIS  ') + n + ('  | ' + str(info)[:260] if info != '' else ''), flush=True)
def wacht(pg, js, ms):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def toestel(br, uid, sl):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
    ctx.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('fibro_eigennaam_gevraagd_') ? '1' : g.call(this, k) } })()")  # v270: geen vraag 'Hoe heet je?' over Home heen (eigennaam.js; die heeft een eigen test)
    ctx.route('**/*supabase.co/**', rest(uid, sl, [])); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w, u=uid: rt['conns'].append(Conn(w, u))); ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page(); naam = NAAM[uid]
    pg.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json'); pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

VINKEN = """() => [...document.querySelectorAll('#messages .msg-row.out .vink')].map(v => v.textContent + (v.classList.contains('gelezen') ? 'B' : ''))"""
STATUS = "() => document.getElementById('chatStatus').textContent"
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl); cb, b = toestel(br, BRAM, sl)
        m.goto(B + 'chat.html?vriend=' + BRAM); b.goto(B + 'chat.html?vriend=' + MARCEL)
        klaar = wacht(m, "() => !!document.querySelector('#msgInput') && !document.getElementById('sendBtn').disabled", 15000) and wacht(b, "() => !document.getElementById('sendBtn').disabled", 15000)
        b.wait_for_timeout(2500)
        # ---- T ----
        b.click('#msgInput'); b.keyboard.type('Hoi Mar', delay=40)
        t1 = wacht(m, "() => document.getElementById('chatStatus').textContent === 'Bram is aan het typen…'", 5000)
        m.wait_for_timeout(5600)
        t2 = m.evaluate(STATUS)
        check('T1 Bram typt: bij Marcel "Bram is aan het typen…", na 5 s stil weer weg', klaar and t1 and t2 == '', (t1, t2))
        b.keyboard.type('cel', delay=40)
        t3 = wacht(m, "() => document.getElementById('chatStatus').textContent.includes('typen')", 5000)
        b.keyboard.press('Enter')
        t4 = wacht(m, "() => [...document.querySelectorAll('#messages .bubble-content')].some(e => e.textContent === 'Hoi Marcel') && document.getElementById('chatStatus').textContent === ''", 8000)
        check('T2 bericht komt binnen: "aan het typen" meteen weg', t3 and t4, m.evaluate(STATUS))
        # ---- G: Bram gaat weg uit de chat; Marcel stuurt ----
        b.goto(B + 'vrienden.html'); b.wait_for_timeout(1500)
        m.fill('#msgInput', 'Ben je er?'); m.keyboard.press('Enter')
        g1 = wacht(m, "() => document.querySelectorAll('#messages .msg-row.out .vink').length === 1", 8000)
        m.wait_for_timeout(1500)
        v1 = m.evaluate(VINKEN)
        check('G1 Bram niet in de chat: ✓ (verstuurd, niet blauw)', g1 and v1 == ['✓'], v1)
        b.goto(B + 'chat.html?vriend=' + MARCEL)
        g2 = wacht(m, "() => { const v = document.querySelector('#messages .msg-row.out .vink'); return v && v.classList.contains('gelezen') }", 15000)
        v2 = m.evaluate(VINKEN)
        check('G2 Bram opent de chat: bij Marcel ✓✓ blauw, zonder verversen', g2 and v2 == ['✓✓B'], v2)
        m.reload(); wacht(m, "() => document.querySelectorAll('#messages .msg-row.out .vink').length === 1", 15000); m.wait_for_timeout(1500)
        v3 = m.evaluate(VINKEN)
        check('G3 na verversen nog steeds ✓✓ blauw (uit de database)', v3 == ['✓✓B'], v3)
        # ---- U: Bram zet het uit (menu op Home) ----
        b.goto(B + 'index.html'); b.wait_for_timeout(2500)
        b.evaluate("document.querySelectorAll('div').forEach(d => { if ((d.textContent || '').includes('Tik om te beginnen') && getComputedStyle(d).position === 'fixed') d.remove() })")
        knop = b.evaluate("""async () => { const k = document.getElementById('menuKnop') || document.querySelector('[aria-label=\"Menu\"]'); if (k) k.click(); await new Promise(r => setTimeout(r, 400))
            const s = [...document.querySelectorAll('#fibroMenu [role=menuitemcheckbox]')].find(x => x.textContent.includes('Gelezen-vinkjes')); if (!s) return null; const voor = s.textContent; s.click(); await new Promise(r => setTimeout(r, 600)); return [voor, localStorage.getItem('fibro_leesbevestiging')] }""")
        u0 = DB['instelling'].get(BRAM)
        check('U1 menu: "✓✓ Gelezen-vinkjes: aan" -> uit, ook op de server', knop and knop[0].endswith(': aan') and knop[1] == '0' and u0 is False, (knop, u0))
        m.reload(); wacht(m, "() => document.querySelectorAll('#messages .msg-row.out .vink').length === 1", 15000); m.wait_for_timeout(1500)
        v4 = m.evaluate(VINKEN)
        check('U2 Bram heeft het uit: Marcel ziet weer ✓', v4 == ['✓'], v4)
        b.goto(B + 'chat.html?vriend=' + MARCEL); wacht(b, "() => document.querySelectorAll('#messages .msg-row').length >= 2", 15000)
        DB['gelezen'][(MARCEL, BRAM)] = nu()
        b.reload(); wacht(b, "() => document.querySelectorAll('#messages .msg-row.out .vink').length === 1", 15000); b.wait_for_timeout(1500)
        v5 = b.evaluate(VINKEN)
        check('U3 en Bram ziet bij Marcel ook geen blauwe vinkjes', v5 == ['✓'], v5)
        cm.close(); cb.close(); br.close()
finally:
    srv.terminate()
check('D geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
