# proef239 (4 nov 2026, v259): meerdere foto's tegelijk in de chat, en groot bekijken met vegen (fotoviewer.js v8).
# Twee echte toestellen in Chrome (nep-Supabase en nep-Realtime met aanwezigheid uit proef62; de foto's gaan echt rechtstreeks via WebRTC):
#  A. Bram kiest drie foto's tegelijk -> bij Bram en bij Marcel staan ze samen in een rijtje (vierkantjes)
#  B. Marcel tikt op de tweede -> groot, "2 van 3"; vegen naar links = de derde, pijltje = weer terug
#  C. Daarna nog een losse foto -> een eigen rij, groot (200), en in de viewer "4 van 4" (alle foto's van het gesprek)
#  E. (v262) na verversen staan de foto's er nog, bij allebei, in dezelfde rijtjes (bewaard op het toestel, chatfotos.js);
#     een foto ouder dan de bewaartijd is weg
#  K. (v262) na het kiezen: een keuzescherm 💾 Bewaren / 👁️ Eén keer laten zien; groot bekijken heeft 💾 Opslaan
#  F. (v262) een keer laten zien: bij Marcel een vakje zonder foto; tik = groot (beschermd, geen Opslaan); sluiten = 'Foto
#     bekeken', ook na verversen, en de foto is van zijn toestel weg. Bram ziet zijn foto met '👁️ 1 keer'.
#  D. geen paginafouten
# python3 -I proef239.py <map>
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
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
    ctx.route('**/*supabase.co/**', rest(uid, sl, [])); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w, u=uid: rt['conns'].append(Conn(w, u))); ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page(); naam = NAAM[uid]
    pg.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json'); pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg
# kleine PNG-foto's in verschillende kleuren
FOTO_JS = """k => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = k; x.fillRect(0, 0, 300, 200); return c.toDataURL('image/png').split(',')[1] }"""
import base64
RIJEN = """() => [...document.querySelectorAll('#messages .foto-reeks')].map(r => ({ mijn: r.classList.contains('out'), n: r.querySelectorAll('img[data-fv-groep="chat"]').length, b: Math.round(r.querySelector('img').getBoundingClientRect().width) }))"""
VIEWER = """() => { const v = document.getElementById('fibro-fotoviewer'); return v && v.style.display !== 'none' ? { teller: document.getElementById('fv-teller').textContent, src: document.getElementById('fv-foto').src } : null }"""
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl); cb, b = toestel(br, BRAM, sl)
        m.goto(B + 'chat.html?vriend=' + BRAM); b.goto(B + 'chat.html?vriend=' + MARCEL)
        klaar = wacht(m, "() => !!document.querySelector('#fotoFileInput')", 15000) and wacht(b, "() => !!document.querySelector('#fotoFileInput')", 15000)
        b.wait_for_timeout(2500)  # aanwezigheid via paren.js
        check('0 meerdere foto\'s kiezen mag (multiple)', klaar and b.evaluate("document.getElementById('fotoFileInput').multiple"))
        kleuren = ['#c084fc', '#22c55e', '#f97316', '#38bdf8']
        bestanden = [{'name': 'foto%d.png' % i, 'mimeType': 'image/png', 'buffer': base64.b64decode(b.evaluate(FOTO_JS, k))} for i, k in enumerate(kleuren)]
        b.set_input_files('#fotoFileInput', bestanden[:3])
        k1 = wacht(b, "() => document.querySelectorAll('#fotoSoortScherm .foto-soort').length === 2", 5000)
        kt = b.evaluate("document.getElementById('fotoSoortScherm').innerText")
        check('K1 keuzescherm: 3 foto\'s versturen, Bewaren of Eén keer laten zien', k1 and '3 foto' in kt and 'Bewaren' in kt and 'Eén keer laten zien' in kt, kt[:120])
        b.click('#fotoSoortScherm .foto-soort[data-soort="bewaren"]')
        a_b = wacht(b, "() => [...document.querySelectorAll('#messages .foto-reeks img')].length === 3", 30000)
        a_m = wacht(m, "() => [...document.querySelectorAll('#messages .foto-reeks img')].length === 3", 30000)
        rb, rm = b.evaluate(RIJEN), m.evaluate(RIJEN)
        check('A drie foto\'s tegelijk: bij Bram en Marcel samen in een rij (vierkantjes van 104)', a_b and a_m and rb == [{'mijn': True, 'n': 3, 'b': 104}] and rm == [{'mijn': False, 'n': 3, 'b': 104}], (rb, rm))
        m.locator('#messages .foto-reeks img').nth(1).click()
        v1 = wacht(m, VIEWER, 4000) and m.evaluate(VIEWER)
        srcs = m.evaluate("[...document.querySelectorAll('#messages .foto-reeks img')].map(i => i.src)")
        # vegen naar links (touch)
        m.evaluate("""() => { const el = document.getElementById('fibro-fotoviewer'); const t = (type, x) => { const tp = new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 }); el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [tp], changedTouches: [tp], bubbles: true })) }
          t('touchstart', 300); t('touchmove', 250); t('touchmove', 120); t('touchend', 120) }""")
        m.wait_for_timeout(500)
        v2 = m.evaluate(VIEWER)
        m.click('#fv-vorige'); m.wait_for_timeout(200)
        v3 = m.evaluate(VIEWER)
        opslaan = m.evaluate("!!document.querySelector('#fv-balk #fotoOpslaan')")
        check('K2 groot bekijken: knop 💾 Opslaan', opslaan)
        check('B tik op de tweede: groot, 2 van 3; vegen = de derde; pijltje = terug', v1 and v1['teller'] == '2 van 3' and v1['src'] == srcs[1] and v2 and v2['teller'] == '3 van 3' and v2['src'] == srcs[2] and v3['teller'] == '2 van 3', (v1 and v1['teller'], v2 and v2['teller'], v3 and v3['teller']))
        m.click('#fv-sluit')
        b.set_input_files('#fotoFileInput', bestanden[3:])
        wacht(b, "() => !!document.querySelector('#fotoSoortScherm .foto-soort')", 5000); b.click('#fotoSoortScherm .foto-soort[data-soort="bewaren"]')
        c_m = wacht(m, "() => document.querySelectorAll('#messages .foto-reeks').length === 2", 30000)
        rm = m.evaluate(RIJEN)
        m.locator('#messages .foto-reeks').nth(1).locator('img').click()
        v4 = wacht(m, VIEWER, 4000) and m.evaluate(VIEWER)
        check('C een losse foto: eigen rij, groot (200); in de viewer 4 van 4', c_m and len(rm) == 2 and rm[1]['n'] == 1 and rm[1]['b'] > 150 and v4 and v4['teller'] == '4 van 4', (rm, v4 and v4['teller']))
        # ---- E: verversen ----
        m.click('#fv-sluit')
        # een foto van 40 dagen geleden erbij zetten (bewaartijd standaard 31 dagen): die moet verdwijnen
        m.evaluate("""async ([ik, vr]) => { const c = document.createElement('canvas'); c.width = c.height = 20; const b = await new Promise(r => c.toBlob(r, 'image/png'))
          const mod = await import('./chatfotos.js?v=2'); await mod.bewaarChatFoto(ik, vr, b, { mijn: false, tijd: Date.now() - 40 * 864e5 }) }""", [MARCEL, BRAM])
        m.reload(); b.reload()
        e_m = wacht(m, "() => document.querySelectorAll('#messages .foto-reeks img').length === 4", 15000)
        e_b = wacht(b, "() => document.querySelectorAll('#messages .foto-reeks img').length === 4", 15000)
        rm2, rb2 = m.evaluate(RIJEN), b.evaluate(RIJEN)
        oud = m.evaluate("""async ([ik, vr]) => (await (await import('./chatfotos.js?v=2')).haalChatFotos(ik, vr)).length""", [MARCEL, BRAM])
        check('E1 na verversen: de foto\'s staan er nog, bij allebei, in dezelfde rijtjes (3 en 1)', e_m and e_b and [r['n'] for r in rm2] == [3, 1] and [r['n'] for r in rb2] == [3, 1]
              and all(not r['mijn'] for r in rm2) and all(r['mijn'] for r in rb2), (rm2, rb2))
        check('E2 de foto van 40 dagen geleden is weggegooid', oud == 4, oud)
        m.locator('#messages .foto-reeks').nth(0).locator('img').nth(0).click()
        v5 = wacht(m, VIEWER, 4000) and m.evaluate(VIEWER)
        check('E3 groot bekijken werkt ook na verversen (1 van 4)', v5 and v5['teller'] == '1 van 4', v5 and v5['teller'])
        m.click('#fv-sluit')
        # ---- F: een keer laten zien ----
        groen = base64.b64decode(b.evaluate(FOTO_JS, '#ef4444'))
        b.set_input_files('#fotoFileInput', [{'name': 'geheim.png', 'mimeType': 'image/png', 'buffer': groen}])
        wacht(b, "() => !!document.querySelector('#fotoSoortScherm .foto-soort')", 5000); b.click('#fotoSoortScherm .foto-soort[data-soort="eenmalig"]')
        f1 = wacht(m, "() => !!document.querySelector('#messages .foto-eenmalig')", 30000)
        vak = m.evaluate("(() => { const v = document.querySelector('#messages .foto-eenmalig'); return { tekst: v.innerText, img: !!v.closest('.msg-row').querySelector('img'), chatGroep: document.querySelectorAll('#messages img[data-fv-groep=\"chat\"]').length } })()")
        bram = b.evaluate("(() => { const r = [...document.querySelectorAll('#messages .foto-reeks')].pop(); return r ? r.innerText : '' })()")
        check('F1 bij Marcel een vakje "👁️ Foto, tik om 1 keer te bekijken" zonder foto erin; Bram ziet "👁️ 1 keer"', f1 and 'Tik om 1 keer' in vak['tekst'] and not vak['img'] and vak['chatGroep'] == 4 and '1 keer' in bram, (vak, bram[:40]))
        m.click('#messages .foto-eenmalig')
        f2 = wacht(m, VIEWER, 4000) and m.evaluate(VIEWER)
        bes = m.evaluate("({ teller: document.getElementById('fv-teller').textContent, opslaan: !!document.querySelector('#fv-balk #fotoOpslaan'), callout: document.getElementById('fv-foto').style.webkitTouchCallout })")
        check('F2 tik: groot, alleen deze foto, zonder Opslaan en niet lang drukken', f2 and f2['src'].startswith('blob:') and bes['teller'] == '' and not bes['opslaan'] and bes['callout'] == 'none', bes)
        m.click('#fv-sluit'); m.wait_for_timeout(500)
        f3 = m.evaluate("(() => { const v = document.querySelector('#messages .foto-eenmalig'); return { tekst: v.innerText, uit: v.disabled } })()")
        m.click('#messages .foto-eenmalig', force=True); m.wait_for_timeout(300)
        nogEens = m.evaluate(VIEWER)
        check('F3 na sluiten: "Foto bekeken", nog eens tikken doet niets', 'Foto bekeken' in f3['tekst'] and f3['uit'] and not nogEens, (f3, nogEens))
        m.reload()
        f4 = wacht(m, "() => !!document.querySelector('#messages .foto-eenmalig')", 15000)
        f4t = m.evaluate("document.querySelector('#messages .foto-eenmalig').innerText")
        bytes_ = m.evaluate("""async ([ik, vr]) => (await (await import('./chatfotos.js?v=2')).haalChatFotos(ik, vr)).filter(f => f.eenmalig).map(f => [f.bekeken, !!f.blob])""", [MARCEL, BRAM])
        check('F4 na verversen nog steeds "Foto bekeken", en de foto is van Marcels toestel weg', f4 and 'Foto bekeken' in f4t and bytes_ == [[True, False]], (f4t, bytes_))
        cm.close(); cb.close(); br.close()
finally:
    srv.terminate()
check('D geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
