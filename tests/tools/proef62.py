# proef62: eigen stickers met versie (v163, naar proef61 van v162), met twee echte toestellen (Bram = A, Lotte = B), echte
# chat.html, sync.js, paren.js en WebRTC; Supabase nagebootst zoals in proef55.
# Nieuw in v163: een aangepaste of weggegooide eigen sticker verdwijnt niet meer uit de chat, maar het bericht blijft
# staan als tekstballon '🖼️ Sticker' (op dezelfde plek, met de tijd), zodat het gesprek blijft kloppen.
# 1. versturen: in het bericht staat fxsticker:<code>@<versie>; bij allebei te zien.
# 2. aanpassen: Bram past de sticker aan: zijn oude bericht wordt bij hem '🖼️ Sticker', en bij Lotte zodra de nieuwe
#    versie binnen is (zonder verversen); een nieuw bericht met de nieuwe versie staat er gewoon als sticker.
# 3. weggooien: bij Bram '🖼️ Sticker', bij Lotte ook na de sync (grafsteen).
# 4. Lotte offline: de eerste eigen sticker gaat met het plaatje mee via de server (groot bericht, in Brams cache alleen
#    de code), de tweede niet (klein bericht). Lotte komt online: de eerste staat er meteen, de tweede na de sync. Het
#    bewaarde pakketje heeft dezelfde vingerafdruk als bij de sync (wordt niet nog eens gehaald). Na de sync mag er
#    weer een via de server.
# 5. een oud bericht zonder versie (fxsticker:e1-01) toont de sticker zoals hij nu is.
# Oude map als controle: v162 (proef61) haalt de berichten weg: de checks met '🖼️ Sticker' zijn daar MIS.
# python3 -I proef62.py <map>      (LOG=1 laat de sync-regels zien)
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
VRIENDEN = {A: [B], B: [A], C: []}
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
  // v160: de geluiden zijn mp3's (<audio data-stickerfx> met een blob-adres): die tellen ook (niet het stille zegenen)
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    if (this.dataset && this.dataset.stickerfx && !this._zegen && String(this.src || '').startsWith('blob:')) { window.__fxosc++; window.__fxmp3 = (window.__fxmp3 || 0) + 1 }
    return speel.apply(this, arguments) }
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

    for u in (A, B): toestel(u)
    NU = 1760000000000
    def zet_eigen(code, kleur, tijd, naam):
        ev(pag[A], ZET, {'id': 'eigensticker_' + A + '_' + code, 'data': plaatje(kleur), 'b': 'hup', 'g': 'pling', 'naam': naam, 'tijd': tijd})
    zet_eigen('e1-01', (60, 170, 60), NU + 1000, 'Krekel')
    zet_eigen('e2-07', (230, 190, 30), NU + 2000, 'Ster')
    def zichtbaar(uid, code):  # [versie, wacht?] van de stickers met deze code in de chat
        return ev(pag[uid], "c => [...document.querySelectorAll('#messages img.fx-sticker')].filter(i => i.dataset.fx === c).map(i => [i.dataset.versie || '', !!i.dataset.wacht, (i.getAttribute('src') || '').slice(0, 15)])", code)
    def stuur(uid, vak, nr):
        ev(pag[uid], "() => toggleStickers()"); pomp(400)
        ev(pag[uid], "v => { const b = document.querySelector('#stickerGrid .sk-vak[data-vak=\"' + v + '\"]'); if (b) b.click() }", vak); pomp(300)
        ev(pag[uid], "n => { const b = document.querySelectorAll('#stickerGrid .sk-sticker')[n]; if (b) b.click() }", nr); pomp(1500)
    v36 = lambda t: format_36(t)
    def format_36(n):
        d = '0123456789abcdefghijklmnopqrstuvwxyz'; s = ''
        while n: n, r = divmod(n, 36); s = d[r] + s
        return s or '0'
    # v163: de berichten (data-mid) die als tekstballon '🖼️ Sticker' staan, met hun tijd en of het een eigen bericht is
    def tekstballon(uid):
        return ev(pag[uid], """() => [...document.querySelectorAll('#messages .msg-row')].filter(r => { const b = r.querySelector('.bubble-content');
          return b && b.textContent === '\\u{1F5BC}\\uFE0F Sticker' }).map(r => [r.dataset.mid, r.querySelector('.bubble-time').textContent.trim(), r.classList.contains('out'), !!r.querySelector('.msg-av-sm')])""")
    def mid_van(uid, code):
        return ev(pag[uid], "c => [...document.querySelectorAll('#messages img.fx-sticker')].filter(i => i.dataset.fx === c).map(i => i.closest('.msg-row').dataset.mid)", code)
    cache = lambda: ev(pag[A], "u => localStorage.getItem('fibro_msg_cache_' + u) || ''", A)

    # ── 1. versturen ──
    print('1. versturen met versie')
    chat(B, A); chat(A, B); pomp(2500)
    stuur(A, 'e1', 0)
    c = cache()
    check('in het bericht: fxsticker:e1-01@<versie>, zonder plaatje (Lotte is online)', '"fxsticker:e1-01@' + v36(NU + 1000) + '"' in c and '#' not in c, c[-90:])
    klein = db['messages'][-1]['content'] if db['messages'] else ''
    check('het bericht is klein', 0 < len(klein) < 600, len(klein))
    zb = wacht_tot(lambda: (lambda z: z if z and not z[0][1] and z[0][2].startswith('data:image') else None)(zichtbaar(B, 'e1-01')), 40)
    check('bij Lotte te zien (na de sync), met de versie', zb and zb[0][0] == str(NU + 1000), zichtbaar(B, 'e1-01'))
    check('bij Bram te zien', (lambda z: z and z[0][2].startswith('data:image'))(zichtbaar(A, 'e1-01')), zichtbaar(A, 'e1-01'))
    mid1A = (mid_van(A, 'e1-01') or [None])[0]; mid1B = (mid_van(B, 'e1-01') or [None])[0]
    n_rijA = ev(pag[A], "() => document.querySelectorAll('#messages .msg-row').length")

    # ── 2. aanpassen ──
    print('2. aanpassen')
    zet_eigen('e1-01', (200, 40, 40), NU + 5000, 'Rode krekel')
    chat(A, B); pomp(1500)
    check('bij Bram: de oude sticker is niet meer te zien', zichtbaar(A, 'e1-01') == [], zichtbaar(A, 'e1-01'))
    tb = tekstballon(A)
    check('bij Bram: het bericht staat er nog, als 🖼️ Sticker (eigen ballon, met tijd en vinkjes)', mid1A and any(t[0] == mid1A and t[2] and t[1].endswith('✓✓') and ':' in t[1] for t in tb), (mid1A, tb))
    check('bij Bram: evenveel berichten als ervoor', ev(pag[A], "() => document.querySelectorAll('#messages .msg-row').length") == n_rijA, (n_rijA, ev(pag[A], "() => document.querySelectorAll('#messages .msg-row').length")))
    weg = wacht_tot(lambda: zichtbaar(B, 'e1-01') == [], 45)
    check('bij Lotte: de oude sticker weg zodra de nieuwe versie binnen is (zonder verversen)', weg, zichtbaar(B, 'e1-01'))
    tb = tekstballon(B)
    check('bij Lotte: het bericht staat er nog, als 🖼️ Sticker (ballon van de ander, met tijd)', mid1B and any(t[0] == mid1B and not t[2] and ':' in t[1] and t[3] for t in tb), (mid1B, tb))
    stuur(A, 'e1', 0)
    nb = wacht_tot(lambda: (lambda z: z if z and z[-1][0] == str(NU + 5000) and not z[-1][1] else None)(zichtbaar(B, 'e1-01')), 20)
    check('een nieuw bericht met de nieuwe versie staat er bij Lotte wel', nb, zichtbaar(B, 'e1-01'))
    check('...en bij Bram', (lambda z: len(z) == 1 and z[0][0] == str(NU + 5000))(zichtbaar(A, 'e1-01')), zichtbaar(A, 'e1-01'))

    # ── 3. weggooien ──
    print('3. weggooien')
    stuur(A, 'e2', 0)
    ok = wacht_tot(lambda: (lambda z: z and not z[-1][1])(zichtbaar(B, 'e2-07')), 30)
    check('Ster verstuurd en bij Lotte te zien', ok, zichtbaar(B, 'e2-07'))
    mid7A = (mid_van(A, 'e2-07') or [None])[-1]; mid7B = (mid_van(B, 'e2-07') or [None])[-1]
    ev(pag[A], WIS, 'eigensticker_' + A + '_e2-07')
    chat(A, B); pomp(1500)
    check('bij Bram: de sticker weg', zichtbaar(A, 'e2-07') == [], zichtbaar(A, 'e2-07'))
    check('bij Bram: het bericht staat er nog, als 🖼️ Sticker', mid7A and any(t[0] == mid7A and t[2] for t in tekstballon(A)), (mid7A, tekstballon(A)))
    weg = wacht_tot(lambda: zichtbaar(B, 'e2-07') == [], 45)
    graf = ev(pag[B], LEES, 'vriend_' + A + '_stickerweg_e2-07')
    check('bij Lotte: de sticker weg na de sync (grafsteen met de laatste versie)', weg and isinstance(graf, dict) and graf.get('tijd') == NU + 2000, (zichtbaar(B, 'e2-07'), graf))
    check('bij Lotte: het bericht staat er nog, als 🖼️ Sticker', mid7B and any(t[0] == mid7B and not t[2] for t in tekstballon(B)), (mid7B, tekstballon(B)))
    # opnieuw openen (uit de cache en de server): nog steeds als tekstballon
    chat(B, A); pomp(1500)
    check('bij Lotte na opnieuw openen: beide oude berichten als 🖼️ Sticker', all(any(t[0] == m for t in tekstballon(B)) for m in (mid1B, mid7B)), tekstballon(B))

    # ── 4. Lotte offline ──
    print('4. Lotte offline')
    zet_eigen('e1-02', (40, 90, 220), NU + 7000, 'Blauwtje')
    zet_eigen('e1-03', (220, 120, 40), NU + 8000, 'Oranje')
    pag[B].goto('about:blank'); pomp(2500)
    off = ev(pag[A], "async v => (await import('./paren.js?v=2')).isOnline(v)", B)
    check('Lotte is offline voor Bram', off is False, off)
    n0 = len(db['messages'])
    stuur(A, 'e1', 1)
    groot = db['messages'][-1]['content'] if len(db['messages']) > n0 else ''
    c = cache()
    check('de eerste gaat met het plaatje mee (groot bericht)', len(groot) > 3000, len(groot))
    check('in Brams cache alleen de code, niet het plaatje', '"fxsticker:e1-02@' + v36(NU + 7000) + '"' in c and '#' not in c, c[-80:])
    stuur(A, 'e1', 2)
    tweede = db['messages'][-1]['content'] if len(db['messages']) > n0 + 1 else ''
    check('de tweede niet (klein bericht, wacht op de sync)', 0 < len(tweede) < 600, len(tweede))
    chat(B, A); pomp(1500)
    eerst = zichtbaar(B, 'e1-02')
    check('Lotte komt online: de eerste staat er meteen', eerst and not eerst[0][1] and eerst[0][2].startswith('data:image'), eerst)
    rec = ev(pag[B], LEES, 'vriend_' + A + '_sticker_e1-02')
    vingerA = ev(pag[A], """async () => { const e = await import('./eigenstickers.js?v=162'); const r = await e.zoekEigenSticker('%s', 'e1-02');
      return e.vinger(e.stickerPakket({ data: r.src, b: r.b, g: r.g, naam: r.naam, tijd: r.tijd })) }""" % A)
    check('bewaard met versie en dezelfde vingerafdruk als bij de sync', isinstance(rec, dict) and rec.get('tijd') == NU + 7000 and rec.get('hash') == vingerA and rec.get('naam') == 'Blauwtje', (rec and {k: rec.get(k) for k in ('tijd', 'hash', 'naam')}, vingerA))
    tw = wacht_tot(lambda: (lambda z: z if z and not z[0][1] else None)(zichtbaar(B, 'e1-03')), 45)
    check('de tweede komt binnen na de sync', tw, zichtbaar(B, 'e1-03'))
    vrij = wacht_tot(lambda: ev(pag[A], "u => localStorage.getItem('fibro_serversticker_' + u + '_%s')" % B, A) is None, 20)
    check('na de sync mag er weer een via de server', vrij, ev(pag[A], "u => localStorage.getItem('fibro_serversticker_' + u + '_%s')" % B, A))

    # ── 5. oud bericht zonder versie ──
    print('5. oud bericht zonder versie')
    ev(pag[A], "() => { document.getElementById('msgInput').value = 'fxsticker:e1-01'; return window.sendMsg() }")
    oud = wacht_tot(lambda: (lambda z: z if any(x[0] == '' and not x[1] for x in z) else None)(zichtbaar(B, 'e1-01')), 15)
    check('wordt getoond zoals de sticker nu is', oud, zichtbaar(B, 'e1-01'))
    for u in (A, B):
        check('geen fouten op de pagina (%s)' % NAAM[u], pag[u].fouten == [], pag[u].fouten[:3])
    br.close(); srv.terminate()

shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
