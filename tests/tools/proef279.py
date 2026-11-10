# proef279 (10 nov 2026): de chatbalk in een groep werkt zoals in de gewone chat (groep.html, groepmedia.js, groepsleutel.js v2).
# Nagebootste Supabase en nep-Realtime (uit proef239: broadcast tussen toestellen). Marcel, Bram en Lotte in een groep.
#  A. 📷 Marcel stuurt een foto terwijl Bram de groep open heeft: Bram krijgt hem rechtstreeks (live-kanaal, versleuteld,
#     niet in de database: daar staat alleen 'groepmedia:...' versleuteld); na verversen staat hij er nog (op het toestel)
#  B. Lotte had de groep niet open: zij ziet '📷 Foto · je was niet online'
#  C. 🎤 ingedrukt houden = spraakbericht; Bram krijgt een speler
#  D. een eigen sticker (Profiel > Stickerlab) gaat met plaatje mee: Bram (geen vriend van de maker nodig) ziet hem
#  E. 🎮 zegt dat samen spelen later komt; geen paginafouten
# python3 -I proef279.py <map>
import sys, os, time, json, socket, subprocess, tempfile, urllib.parse, uuid
from playwright.sync_api import sync_playwright
import base64
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'; LOTTE = 'cccc0002-0000-4000-8000-000000000003'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram', LOTTE: 'Lotte'}
VRIENDEN = {MARCEL: [BRAM, LOTTE], BRAM: [MARCEL], LOTTE: [MARCEL]}
DB = {'sleutels': {}, 'groepen': [], 'leden': [], 'berichten': [], 'rpc': []}
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
def nu(): return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())

def server(uid):
    def supa(route):
        r = route.request; u = r.url; m = r.method
        obj = 'vnd.pgrst.object' in (r.headers.get('accept') or '')
        q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
        eq = lambda k: (q.get(k, [''])[0][3:] if q.get(k, [''])[0].startswith('eq.') else None)
        body = json.loads(r.post_data or '{}') if m in ('POST', 'PATCH') else {}
        lid = lambda g: any(l['groep_id'] == g and l['user_id'] == uid for l in DB['leden'])
        if '/rest/v1/rpc/' in u:
            naam = u.split('/rpc/')[1].split('?')[0]; DB['rpc'].append((uid, naam, body))
            if naam == 'mijn_groepen':
                rij = [{'id': g['id'], 'naam': g['naam'], 'soort': g['soort'], 'leden': sum(1 for l in DB['leden'] if l['groep_id'] == g['id']), 'laatste': g['created_at']} for g in DB['groepen'] if lid(g['id'])]
                return route.fulfill(status=200, json=rij)
            if naam == 'maak_groep':
                if any(x not in VRIENDEN[uid] for x in body['p_leden']): return route.fulfill(status=403, json={'message': 'alleen vrienden'})
                g = {'id': str(uuid.uuid4()), 'naam': body['p_naam'], 'soort': body['p_soort'], 'maker': uid, 'created_at': nu()}
                DB['groepen'].append(g)
                DB['leden'].append({'groep_id': g['id'], 'user_id': uid, 'rol': 'beheerder'})
                for x in body['p_leden']: DB['leden'].append({'groep_id': g['id'], 'user_id': x, 'rol': 'lid'})
                return route.fulfill(status=200, json=g['id'])
            if naam == 'groep_leden_info':
                g = body['p_groep']
                if not lid(g): return route.fulfill(status=200, json=[])
                return route.fulfill(status=200, json=[{'id': l['user_id'], 'username': NAAM[l['user_id']], 'avatar_url': None, 'public_key': DB['sleutels'].get(l['user_id']), 'rol': l['rol']} for l in DB['leden'] if l['groep_id'] == g])
            if naam == 'groep_lid_toevoegen':
                DB['leden'].append({'groep_id': body['p_groep'], 'user_id': body['p_lid'], 'rol': 'lid'}); return route.fulfill(status=204, body='')
            return route.fulfill(status=200, json=None)
        if '/rest/v1/friendships' in u:
            return route.fulfill(status=200, json=[{'friend_id': v, 'profiles': {'id': v, 'username': NAAM[v], 'avatar_url': None, 'public_key': DB['sleutels'].get(v)}} for v in VRIENDEN[uid]])
        if '/rest/v1/groepen' in u:
            g = [x for x in DB['groepen'] if x['id'] == eq('id') and lid(x['id'])]
            return route.fulfill(status=200, json=(g[0] if g else None) if obj else g)
        if '/rest/v1/groep_berichten' in u:
            if m == 'POST':
                if not lid(body['groep_id']) or body['sender_id'] != uid: return route.fulfill(status=403, json={'message': 'rls'})
                b = dict(body, id=str(uuid.uuid4()), created_at=nu()); DB['berichten'].append(b)
                return route.fulfill(status=201, json=b if obj else [b])
            g = eq('groep_id')
            rij = sorted([b for b in DB['berichten'] if b['groep_id'] == g and lid(g)], key=lambda b: b['created_at'], reverse=True)
            return route.fulfill(status=200, json=rij)
        if '/rest/v1/profiles' in u:
            rij = {'id': uid, 'username': NAAM[uid], 'public_key': DB['sleutels'].get(uid)}
            return route.fulfill(status=200, json=rij if obj else [rij])
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={'id': uid})
        return route.fulfill(status=200, json=[])
    return supa

SLEUTEL = """async (uid) => { const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const b = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  localStorage.setItem('fibro_privkey_' + uid, b(await crypto.subtle.exportKey('pkcs8', k.privateKey)))
  return b(await crypto.subtle.exportKey('spki', k.publicKey)) }"""

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


www = tempfile.mkdtemp(prefix='proef279_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
toestellen = {}
def toestel(b, uid, taal='nl'):
    ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, bypass_csp=True)  # wait_for_function gebruikt eval
    ctx.route('**/*supabase.co/**', server(uid))
    ctx.route_web_socket('**/realtime/v1/websocket**', lambda w, u=uid: rt['conns'].append(Conn(w, u)))
    ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    ctx.grant_permissions(['microphone'])
    pg = ctx.new_page(); fouten = []
    pg.on('pageerror', lambda e: fouten.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASIS + 'login.html')
    pg.evaluate("([t, en, namen, uid]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); if (en) localStorage.setItem('fibro_taal', 'en'); for (const [id, n] of Object.entries(namen)) localStorage.setItem('vriend_naam_' + id + '_' + uid, n) }", [token(uid), taal == 'en', {MARCEL: 'Marcel'} if uid != MARCEL else {}, uid])
    DB['sleutels'][uid] = pg.evaluate(SLEUTEL, uid)
    return ctx, pg, fouten
EIGEN = """async (uid) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ff00aa'; x.fillRect(8, 8, 48, 48)
  const data = c.toDataURL('image/png')
  const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2); r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }; r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  await new Promise(ok => { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: 'eigensticker_' + uid + '_e1-01', data, b: 'stuiter', g: 'geen', naam: 'Roze', tijd: Date.now() }); tx.oncomplete = ok }); db.close(); return data.length }"""
FOTO = """() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#2299ff'; x.fillRect(0, 0, 800, 600); x.fillStyle = '#ffcc00'; x.fillRect(100, 100, 300, 200); return c.toDataURL('image/png').split(',')[1] }"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        mc, m, mf = toestel(b, MARCEL); bc, bp, bf = toestel(b, BRAM); lc, lp, lf = toestel(b, LOTTE)
        gid = '99999999-9999-4999-8999-999999999999'
        DB['groepen'].append({'id': gid, 'naam': 'Drie', 'soort': 'chat', 'maker': MARCEL, 'created_at': nu()})
        for u, rol in ((MARCEL, 'beheerder'), (BRAM, 'lid'), (LOTTE, 'lid')): DB['leden'].append({'groep_id': gid, 'user_id': u, 'rol': rol})
        open_ = lambda pg: (pg.goto(BASIS + 'groep.html?id=' + gid), pg.wait_for_function("document.getElementById('groepSub').textContent.includes('3')"))
        open_(bp); open_(m)
        m.wait_for_timeout(1500); bp.wait_for_timeout(500)  # beide op het live-kanaal
        check(any(c.uid == BRAM and 'realtime:groep-' + gid in c.topics for c in rt['conns']), 'A: Bram zit op het live-kanaal van de groep')
        # A: foto
        png = base64.b64decode(m.evaluate(FOTO))
        m.set_input_files('#fotoInvoer', files=[{'name': 'foto.png', 'mimeType': 'image/png', 'buffer': png}])
        m.wait_for_selector('.b-rij.mijn img.b-foto', timeout=15000)
        check(m.locator('.b-rij.mijn img.b-foto').count() == 1, 'A: Marcel ziet zijn foto')
        mk = [x for x in DB['berichten'] if x['groep_id'] == gid]
        check(len(mk) == 1 and mk[0]['content'].startswith('g1:') and len(mk[0]['content']) < 3000, 'A: in de database alleen een klein versleuteld berichtje (%d tekens)' % (len(mk[0]['content']) if mk else -1))
        # Bram: de foto kwam binnen over het kanaal; de marker komt bij Bram pas na verversen (nep-Realtime kent geen database-seintjes)
        bp.wait_for_timeout(1500)
        bp.reload(); bp.wait_for_selector('.b-rij .bubbel.media', timeout=15000)
        try: bp.wait_for_selector('.b-rij img.b-foto', timeout=8000); ok = True
        except Exception: ok = False
        check(ok, 'A: Bram heeft de foto (rechtstreeks gekregen, bewaard op zijn toestel) (%r)' % bp.inner_text('.b-rij .bubbel.media'))
        # B: Lotte was er niet
        open_(lp); lp.wait_for_selector('.b-rij .media-wacht')
        t = lp.inner_text('.b-rij .media-wacht')
        check('je was niet online' in t and '📷' in t, 'B: Lotte ziet dat ze niet online was (%r)' % t)
        # C: spraak (ingedrukt houden)
        k = m.locator('#spraakKnop').bounding_box()
        m.mouse.move(k['x'] + 20, k['y'] + 20); m.mouse.down(); m.wait_for_timeout(2500)
        check(not m.is_hidden('#spraakBalk'), 'C: tijdens opnemen de balk met de tijd')
        m.mouse.up()
        m.wait_for_selector('.b-rij.mijn .spraak-speler', timeout=15000)
        check(True, 'C: Marcel ziet zijn spraakbericht')
        bp.wait_for_timeout(1500); bp.reload()
        try: bp.wait_for_selector('.b-rij .spraak-speler', timeout=10000); ok = True
        except Exception: ok = False
        check(ok, 'C: Bram kreeg het spraakbericht')
        if os.environ.get('SHOT'): bp.screenshot(path=os.environ['SHOT'] + '/bram279.png')
        # D: eigen sticker
        m.evaluate(EIGEN, MARCEL)
        m.click('#stickerKnop'); m.wait_for_selector('#stickerRaster .sk-vak')
        # het vak met eigen stickers kiezen en de sticker sturen
        vakken = m.locator('#stickerRaster .sk-vak')
        for i in range(vakken.count()):
            if 'Eigen' in (vakken.nth(i).get_attribute('aria-label') or '') or 'eigen' in (vakken.nth(i).get_attribute('title') or '').lower():
                vakken.nth(i).click(); break
        m.wait_for_timeout(500)
        sk = m.locator('#stickerRaster .sk-sticker')
        n_voor = len(DB['berichten'])
        if sk.count(): sk.first.click()
        m.wait_for_timeout(1500)
        check(len(DB['berichten']) == n_voor + 1, 'D: eigen sticker verstuurd')
        bp.reload(); bp.wait_for_timeout(2500)
        srcs = bp.eval_on_selector_all('.b-rij img.b-sticker', 'els => els.map(e => e.src.slice(0, 22))')
        check('data:image/png;base64,' in srcs, 'D: Bram ziet de eigen sticker van Marcel (%s)' % srcs)
        # E
        m.click('.balk-knop.later')
        check('later' in m.inner_text('.toast'), 'E: 🎮 zegt dat samen spelen later komt')
        check(not mf and not bf and not lf, 'E: geen paginafouten (%s %s %s)' % (mf[:2], bf[:2], lf[:2]))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
