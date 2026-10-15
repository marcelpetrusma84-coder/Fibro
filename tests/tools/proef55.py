# proef55: eigen stickers slim gesynct (v155), met drie echte toestellen (drie Chromium-contexten) en de echte
# chat.html, sync.js, paren.js en WebRTC. Supabase nagebootst: REST via ctx.route (per gebruiker, aan de inlogpas
# te zien), Realtime via route_web_socket met een nep-Phoenix-server die aanwezigheid (presence) en broadcast tussen
# de toestellen doorgeeft, en nieuwe berichten (postgres_changes) bezorgt.
# Bram (A) heeft eigen stickers; Lotte (B) en Kees (C) zijn zijn vrienden.
# 1. voorrang: A synct eerst met een van de twee (X); A opent de chat met de ander (Y): dan krijgt Y de sticker ook
#    (zonder voorrang blijft A met X verbonden en krijgt Y niets).
# 2. de sticker staat bij de vriend als 'vriend_<A>_sticker_e1-01' (zelfde plaatje, beweging, geluid, naam).
# 3. A stuurt hem in de chat (vakje Eigen): bij B beweegt en klinkt hij, zonder dat het plaatje meegaat in het bericht.
# 4. een code die B (nog) niet heeft: plaatsvervanger 'Sticker komt eraan'; bij A (zelf niet meer) '🖼️ Sticker'.
#    Maakt A hem daarna en stuurt hij weer iets, dan komt hij binnen en wordt de plaatsvervanger vanzelf de sticker.
# 5. A gooit een sticker weg: bij de vriend ook weg na de volgende sync. 6. antwoord/melden: '🖼️ Sticker'.
# Oude map als controle: daar gebeurt dit niet (bijna alles MIS).
# python3 -I proef55.py <map>
import sys, os, time, json, socket, subprocess, tempfile, base64, io, re, shutil
from urllib.parse import unquote
from playwright.sync_api import sync_playwright
from playwright._impl import _network as _pwn
def _sluitPagina(self, event):  # Playwright 1.56: 'code' ontbreekt soms als de pagina de verbinding sluit
    if self._on_page_close: self._on_page_close(event.get('code'), event.get('reason'))
_pwn.WebSocketRoute._channel_close_page = _sluitPagina
from PIL import Image, ImageDraw

MAP = os.path.abspath(sys.argv[1])
A = 'aaaaaaaa-0000-4000-8000-00000000000a'; B = 'bbbbbbbb-0000-4000-8000-00000000000b'; C = 'cccccccc-0000-4000-8000-00000000000c'
NAAM = {A: 'Bram', B: 'Lotte', C: 'Kees'}
VRIENDEN = {A: [B, C], B: [A], C: [A]}
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
def token(u): return json.dumps({"access_token": "tok_" + u, "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": u}})

def plaatje(kleur):
    im = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((12, 12, 244, 244), fill=(251, 243, 230, 255)); d.ellipse((24, 24, 232, 232), fill=kleur + (255,))
    b = io.BytesIO(); im.save(b, 'WEBP', quality=80); return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
KREKEL = plaatje((60, 170, 60)); STER = plaatje((230, 190, 30))

# ── nep-database ──
db = {'pub': {}, 'messages': [], 'n': 0}
def iso(): t = time.time(); return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(t)) + '.%03dZ' % int((t % 1) * 1000)
def wie(route):
    m = re.search(r'tok_([0-9a-f-]{36})', route.request.headers.get('authorization') or '')
    return m.group(1) if m else None
def prof(u): return {"id": u, "username": NAAM[u], "avatar_url": "\U0001F642", "public_key": db['pub'].get(u)}
def supa(route):
    u = unquote(route.request.url); m = route.request.method; ik = wie(route)
    een = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/functions/v1/' in u:
        return route.fulfill(status=503 if 'turn' in u else 200, json={}, headers={'access-control-allow-origin': '*'})
    if '/rest/v1/friendships' in u:
        return route.fulfill(status=200, json=[{"user_id": ik, "friend_id": f, "status": "accepted"} for f in VRIENDEN.get(ik, [])])
    if '/rest/v1/profiles' in u and m == 'GET':
        ids = [x for x in (A, B, C) if x in u]
        rijen = [prof(x) for x in ids] or ([prof(ik)] if ik else [])
        return route.fulfill(status=200, json=(rijen[0] if rijen else {}) if een else rijen)
    if '/rest/v1/messages' in u and m == 'POST':
        rij = json.loads(route.request.post_data or '{}')
        if isinstance(rij, list): rij = rij[0]
        db['n'] += 1
        rec = {"id": "m%03d" % db['n'], "sender_id": rij.get('sender_id'), "receiver_id": rij.get('receiver_id'), "content": rij.get('content'),
               "created_at": iso(), "expires_at": rij.get('expires_at'), "antwoord_op": rij.get('antwoord_op')}
        db['messages'].append(rec); wacht_bezorg.append((time.time() + 0.3, rec))  # Realtime komt (zoals echt) iets na het antwoord
        return route.fulfill(status=201, json={"id": rec['id']} if een else [{"id": rec['id']}])
    if '/rest/v1/messages' in u and m == 'GET':
        ander = [x for x in (A, B, C) if x in u and x != ik]
        rijen = [r for r in db['messages'] if ik in (r['sender_id'], r['receiver_id']) and (not ander or ander[0] in (r['sender_id'], r['receiver_id']))]
        return route.fulfill(status=200, json=list(reversed(rijen))[:50])
    return route.fulfill(status=200, json=[] if not een else {})

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

TELLER = """
(() => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
  window.__fxosc = 0
  const comp = AC.prototype.createDynamicsCompressor, start = AudioScheduledSourceNode.prototype.start
  AC.prototype.createDynamicsCompressor = function () { this.__fx = true; return comp.apply(this, arguments) }
  AudioScheduledSourceNode.prototype.start = function () {
    if (this.context && this.context.__fx && !(this.buffer && this.buffer.length <= 1)) window.__fxosc++
    return start.apply(this, arguments) }
})()
"""
OPEN_DB = """const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
  r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) });"""
ZET = "async rec => { " + OPEN_DB + " await new Promise(ok => { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put(rec); tx.oncomplete = ok; tx.onerror = ok }) }"
WIS = "async k => { " + OPEN_DB + " await new Promise(ok => { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').delete(k); tx.oncomplete = ok; tx.onerror = ok }) }"
LEES = "async k => { " + OPEN_DB + " return await new Promise(ok => { const q = db.transaction('fotos').objectStore('fotos').get(k); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null) }) }"

www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'])
    pag = {}
    def toestel(uid):
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda ws, u=uid: rt['conns'].append(Conn(ws, u)))
        ctx.add_init_script(TELLER)
        p = ctx.new_page(); p.fouten = []
        p.on('pageerror', lambda e: p.fouten.append(str(e)[:200])); p.on('dialog', lambda d: d.dismiss())
        if os.environ.get('LOG'): p.on('console', lambda m, n=NAAM[uid]: print('   [%s] %s' % (n, m.text[:160])) if re.match(r'\[(sync|paren|ice)\]', m.text) else None)
        p.goto(BASIS + 'manifest.json')
        p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(uid))
        db['pub'][uid] = p.evaluate("""async uid => { const c = await import('./crypto.js?v=95'); const k = await c.genereerKeypair();
          c.slaPrivateKeyOp(uid, k.privateKeyB64); return k.publicKeyB64 }""", uid)
        pag[uid] = p
        return p
    def ev(p, js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:120]
    def pomp(ms):  # tijd laten verstrijken en intussen nieuwe berichten bezorgen
        eind = time.time() + ms / 1000
        while time.time() < eind:
            while wacht_bezorg and wacht_bezorg[0][0] <= time.time(): bezorg(wacht_bezorg.pop(0)[1])
            pag[A].wait_for_timeout(100)
    def wacht_tot(f, s):
        eind = time.time() + s
        while time.time() < eind:
            r = f()
            if r: return r
            pomp(400)
        return f()
    def chat(uid, met=None):
        p = pag[uid]
        p.goto(BASIS + 'chat.html')
        try: p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item[data-vid]').length >= 1", timeout=15000)
        except Exception: pass
        if met:
            try: p.click('#vriendenLijst .vriend-item[data-vid="%s"]' % met, timeout=4000)
            except Exception: pass
        pomp(800)
    heeft = lambda uid, code: (lambda r: r if isinstance(r, dict) else None)(ev(pag[uid], LEES, 'vriend_' + A + '_sticker_' + code))

    for u in (A, B, C): toestel(u)
    ev(pag[A], ZET, {'id': 'eigensticker_' + A + '_e1-01', 'data': KREKEL, 'b': 'hup', 'g': 'tsjirp', 'naam': 'Krekel', 'tijd': 1})

    # ───────────── 1. voorrang ─────────────
    print('1. voorrang voor de vriend van de chat')
    chat(B); chat(C); chat(A)
    x = wacht_tot(lambda: B if heeft(B, 'e1-01') else (C if heeft(C, 'e1-01') else None), 45)
    check('A synct met een online vriend (die heeft de sticker)', x in (B, C), x)
    y = C if x == B else B
    pomp(3000)
    check('...en de ander nog niet (A blijft met de eerste verbonden)', x and not heeft(y, 'e1-01'), y)
    if x:
        try: pag[A].click('#vriendenLijst .vriend-item[data-vid="%s"]' % y, timeout=4000)
        except Exception: pass
        kreeg = wacht_tot(lambda: heeft(y, 'e1-01'), 40)
        check('A opent de chat met de ander: die krijgt de sticker nu ook', kreeg, y)

    # ───────────── 2. wat er binnenkwam ─────────────
    print('2. bij de vriend')
    rb = heeft(B, 'e1-01')
    check('bij Lotte: vriend_<Bram>_sticker_e1-01, zelfde plaatje, hup/tsjirp/Krekel', rb and rb.get('data') == KREKEL and rb.get('b') == 'hup' and rb.get('g') == 'tsjirp' and rb.get('naam') == 'Krekel',
          rb and {k: rb.get(k) for k in ('b', 'g', 'naam')})

    # ───────────── 3. versturen ─────────────
    print('3. versturen in de chat')
    chat(B, A); chat(A, B)
    pomp(1500)
    voor = ev(pag[B], "window.__fxosc || 0")
    ev(pag[A], "() => toggleStickers()"); pomp(500)
    ev(pag[A], "() => { const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\"e1\"]'); if (v) v.click() }"); pomp(300)
    knop = ev(pag[A], "() => { const b = document.querySelector('#stickerGrid .sk-sticker'); return b ? b.getAttribute('aria-label') : null }")
    check('vakje Eigen in de chat toont Brams sticker', knop == 'Stuur sticker Krekel', knop)
    ev(pag[A], "() => { const b = document.querySelector('#stickerGrid .sk-sticker'); if (b) b.click() }")
    bij_b = wacht_tot(lambda: ev(pag[B], "() => { const i = [...document.querySelectorAll('#messages .fx-sticker')].pop(); return i && i.getAttribute('src') && i.getAttribute('src').startsWith('data:image/webp') ? { anim: i.getAnimations().length, alt: i.alt } : null }"), 15)
    na = ev(pag[B], "window.__fxosc || 0")
    post = [r for r in db['messages'] if r['sender_id'] == A and r['receiver_id'] == B]
    inhoud = post[-1]['content'] if post else ''
    check('bij Lotte: de sticker verschijnt, beweegt en klinkt', isinstance(bij_b, dict) and bij_b['alt'] == 'Krekel' and isinstance(na, int) and na > voor, (bij_b, voor, na))
    check('in het bericht: versleuteld en klein (geen plaatje)', inhoud.startswith('e2e:') and len(inhoud) < 400, (inhoud[:40], len(inhoud)))
    bij_a = wacht_tot(lambda: ev(pag[A], "() => { const i = [...document.querySelectorAll('#messages .fx-sticker')].pop(); return i ? (i.getAttribute('src') || '').slice(0, 22) : null }"), 10)
    check('bij Bram zelf: zijn eigen sticker', bij_a == 'data:image/webp;base64', bij_a)
    if os.environ.get('LOG'): print('   rijen bij Bram:', ev(pag[A], "() => [...document.querySelectorAll('#messages .msg-row')].slice(-3).map(r => r.className + ' | ' + r.innerText.replace(/\\s+/g, ' ').slice(0, 60) + ' | img=' + !!r.querySelector('img'))"))

    # ───────────── 4. plaatsvervanger ─────────────
    print('4. nog niet binnen')
    ev(pag[A], "() => { document.getElementById('msgInput').value = 'fxsticker:e2-07'; return window.sendMsg() }")
    wacht = wacht_tot(lambda: ev(pag[B], "() => { const i = [...document.querySelectorAll('#messages .fx-sticker')].pop(); return i && i.classList.contains('fx-wacht') ? { alt: i.alt, tekst: (i.parentElement.querySelector('.fx-wachttekst') || {}).textContent } : null }"), 12)
    check('bij Lotte: plaatsvervanger Sticker komt eraan', isinstance(wacht, dict) and wacht['alt'] == 'Sticker komt eraan' and wacht['tekst'] == 'Komt binnen zodra jullie allebei online zijn', wacht)
    zelf = ev(pag[A], "() => [...document.querySelectorAll('#messages .bubble-content')].map(b => b.textContent).pop()")
    check('bij Bram (heeft hem zelf niet): 🖼️ Sticker', zelf == '\U0001F5BC️ Sticker', zelf)
    ev(pag[A], ZET, {'id': 'eigensticker_' + A + '_e2-07', 'data': STER, 'b': 'draai', 'g': 'ting', 'naam': 'Ster', 'tijd': 2})
    ev(pag[A], "() => toggleStickers()"); pomp(300)
    ev(pag[A], "() => { const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\"e1\"]'); if (v) v.click() }"); pomp(300)
    ev(pag[A], "() => { const b = document.querySelector('#stickerGrid .sk-sticker'); if (b) b.click() }")
    bij = wacht_tot(lambda: ev(pag[B], "() => { const i = document.querySelectorAll('#messages .fx-sticker'); const w = [...i].find(x => x.dataset.fx === 'e2-07'); return w && !w.classList.contains('fx-wacht') && (w.getAttribute('src') || '').startsWith('data:image/webp') ? w.alt : null }"), 25)
    check('daarna gemaakt en Bram stuurt iets: de plaatsvervanger wordt vanzelf de sticker', bij == 'Ster', bij)
    check('...en de wachttekst is weg', ev(pag[B], "() => document.querySelectorAll('#messages .fx-wachttekst').length") == 0, '')

    # ───────────── 5. weggooien ─────────────
    print('5. weggooien')
    ev(pag[A], WIS, 'eigensticker_' + A + '_e1-01')
    ev(pag[A], "() => toggleStickers()"); pomp(300)
    ev(pag[A], "() => { const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\"e2\"]'); if (v) v.click() }"); pomp(300)
    ev(pag[A], "() => { const b = document.querySelector('#stickerGrid .sk-sticker'); if (b) b.click() }")
    weg = wacht_tot(lambda: heeft(B, 'e1-01') is None and heeft(B, 'e2-07') is not None, 25)
    check('Bram gooit Krekel weg: bij Lotte ook weg, Ster blijft', weg, (heeft(B, 'e1-01') is None, heeft(B, 'e2-07') is not None))

    # ───────────── 6. antwoord / melden ─────────────
    print('6. antwoorden en melden')
    mt = ev(pag[B], "() => [...document.querySelectorAll('#messages .msg-row')].filter(r => r.querySelector('.fx-sticker')).map(r => r.dataset.mtekst)")
    check('een sticker heet in antwoord en melding 🖼️ Sticker (geen code)', isinstance(mt, list) and mt and all(x == '\U0001F5BC️ Sticker' for x in mt), mt)
    for u in (A, B, C):
        check('geen fouten op de pagina (%s)' % NAAM[u], pag[u].fouten == [], pag[u].fouten[:3])
    br.close(); srv.terminate()

shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
