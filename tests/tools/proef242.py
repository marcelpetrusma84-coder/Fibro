# proef242 (4 nov 2026, v264): spraakberichtjes (spraak.js), twee echte toestellen in Chrome met een nagebootste microfoon.
# Het geluid gaat rechtstreeks van telefoon naar telefoon (p2pfoto.js), net als foto's.
#  V1 Bram houdt 🎤 2 s ingedrukt: rode balk met de tijd; loslaten = keuze Bewaren / Eén keer laten horen
#  V2 Bewaren: bij allebei een afspeelbalkje (± 0:02); Marcel tikt ▶ en het speelt
#  V3 kort tikken = niets versturen, wel de uitleg 'houd ingedrukt'
#  V4 naar links schuiven = weggooien
#  V5 Eén keer laten horen: na helemaal afspelen bij Marcel '👂 Spraakbericht beluisterd', ook na verversen; Bram ziet '👂 1 keer'
#  V6 na verversen staat het bewaarde berichtje er nog (bij allebei)
#  D  geen paginafouten
# python3 -I proef242.py <map>
import sys, os, time, json, socket, subprocess, re
from playwright.sync_api import sync_playwright
import threading
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram'}
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
# ---- nep-server: REST per toestel, Realtime gedeeld tussen de twee toestellen ----
def rest(uid, sleutels, posts):  # zoals proef231
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
def toestel(br, uid, sl):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, permissions=['microphone'])
    ctx.route('**/*supabase.co/**', rest(uid, sl, [])); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w, u=uid: rt['conns'].append(Conn(w, u))); ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page(); naam = NAAM[uid]
    pg.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json'); pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

SPELERS = "() => [...document.querySelectorAll('#messages .spraak-rij')].map(r => ({ mijn: r.classList.contains('out'), tekst: r.innerText.replace(/\\s+/g, ' ').trim() }))"
def houVast(pg, ms, schuif=0):
    k = pg.locator('#spraakBtn').bounding_box(); x, y = k['x'] + k['width'] / 2, k['y'] + k['height'] / 2
    pg.mouse.move(x, y); pg.mouse.down()
    pg.wait_for_timeout(ms)
    if schuif: pg.mouse.move(x - schuif, y, steps=5)
    pg.mouse.up()
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl); cb, b = toestel(br, BRAM, sl)
        m.goto(B + 'chat.html?vriend=' + BRAM); b.goto(B + 'chat.html?vriend=' + MARCEL)
        wacht(m, "() => !!document.querySelector('#spraakBtn')", 15000); wacht(b, "() => !!document.querySelector('#spraakBtn')", 15000)
        b.wait_for_timeout(2500)
        plek = b.evaluate("(() => { const k = [...document.querySelectorAll('.emoji-toggle-row > *')].map(x => x.id || x.textContent.trim()); return k })()")
        # ---- V1 ----
        k = b.locator('#spraakBtn').bounding_box(); x, y = k['x'] + k['width'] / 2, k['y'] + k['height'] / 2
        b.mouse.move(x, y); b.mouse.down()
        balk = wacht(b, "() => !document.getElementById('spraakBalk').hidden", 4000)
        b.wait_for_timeout(2200)
        t = b.evaluate("document.getElementById('spraakTijd').textContent")
        b.mouse.up()
        keuze = wacht(b, "() => document.querySelectorAll('#fotoSoortScherm .foto-soort').length === 2", 5000)
        kt = keuze and b.evaluate("document.getElementById('fotoSoortScherm').innerText")
        check('V1 🎤 tussen 📷 en buzz; ingedrukt = rode balk met tijd; loslaten = Bewaren / Eén keer laten horen',
              plek.index('spraakBtn') == plek.index('fotoBtn') + 1 and plek.index('buzzBtn') == plek.index('spraakBtn') + 1 and balk and t in ('0:02', '0:03') and keuze and 'Spraakbericht versturen' in kt and 'Eén keer laten horen' in kt, (plek, t, kt and kt[:80]))
        # ---- V2 ----
        b.click('#fotoSoortScherm .foto-soort[data-soort="bewaren"]')
        v2b = wacht(b, "() => document.querySelectorAll('#messages .spraak-rij').length === 1", 15000)
        v2m = wacht(m, "() => document.querySelectorAll('#messages .spraak-rij .spraak-knop').length === 1", 30000)
        sb, sm = b.evaluate(SPELERS), m.evaluate(SPELERS)
        m.click('#messages .spraak-rij .spraak-knop')
        speelt = wacht(m, "() => { const a = document.querySelector('#messages .spraak-rij .spraak-speler')._audio; return a && !a.paused && a.currentTime > 0.2 }", 5000)
        check('V2 Bewaren: bij allebei een balkje (0:02), Marcel speelt het af', v2b and v2m and len(sb) == 1 and sb[0]['mijn'] and '0:02' in sb[0]['tekst'] and len(sm) == 1 and not sm[0]['mijn'] and speelt, (sb, sm, speelt))
        # ---- V3 kort tikken ----
        houVast(b, 250)
        b.wait_for_timeout(1500)
        v3 = b.evaluate("({ n: document.querySelectorAll('#messages .spraak-rij').length, scherm: !!document.getElementById('fotoSoortScherm'), uitleg: document.getElementById('fotoStatus').textContent })")
        check('V3 kort tikken: niets verstuurd, wel "houd ingedrukt"', v3['n'] == 1 and not v3['scherm'] and 'ingedrukt' in v3['uitleg'], v3)
        # ---- V4 wegschuiven ----
        houVast(b, 1500, schuif=150)
        b.wait_for_timeout(1500)
        v4 = b.evaluate("({ n: document.querySelectorAll('#messages .spraak-rij').length, scherm: !!document.getElementById('fotoSoortScherm'), balk: document.getElementById('spraakBalk').hidden })")
        check('V4 naar links schuiven: weggegooid', v4 == {'n': 1, 'scherm': False, 'balk': True}, v4)
        # ---- V5 een keer ----
        houVast(b, 1600)
        wacht(b, "() => !!document.querySelector('#fotoSoortScherm .foto-soort')", 5000); b.click('#fotoSoortScherm .foto-soort[data-soort="eenmalig"]')
        v5m = wacht(m, "() => document.querySelectorAll('#messages .spraak-rij .spraak-knop').length === 2", 30000)
        m.evaluate("[...document.querySelectorAll('#messages .spraak-rij')].pop().querySelector('.spraak-knop').click()")
        klaar = wacht(m, "() => [...document.querySelectorAll('#messages .spraak-rij')].pop().innerText.includes('beluisterd')", 15000)
        bram = b.evaluate("[...document.querySelectorAll('#messages .spraak-rij')].pop().innerText")
        m.reload(); b.reload()
        na = wacht(m, "() => document.querySelectorAll('#messages .spraak-rij').length === 2", 15000)
        sm2 = m.evaluate(SPELERS)
        opslag = m.evaluate("""async ([ik, vr]) => (await (await import('./chatfotos.js?v=2')).haalChatFotos(ik, vr)).filter(f => f.soort === 'spraak').map(f => [f.eenmalig, f.bekeken, !!f.blob])""", [MARCEL, BRAM])
        check('V5 Eén keer: na afspelen "beluisterd", ook na verversen, en weg van Marcels toestel; Bram ziet "1 keer"',
              v5m and klaar and '1 keer' in bram and na and 'beluisterd' in sm2[1]['tekst'] and opslag == [[False, False, True], [True, True, False]], (klaar, bram[:30], sm2, opslag))
        # ---- V6 ----
        v6b = wacht(b, "() => document.querySelectorAll('#messages .spraak-rij .spraak-knop').length === 2", 15000)
        check('V6 na verversen: het bewaarde berichtje staat er nog bij allebei (Marcel 1 speelbaar, Bram 2)', na and v6b and '🎤 0:02' in sm2[0]['tekst'], sm2)
        cm.close(); cb.close(); br.close()
finally:
    srv.terminate()
check('D geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
