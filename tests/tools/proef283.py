# proef283 (10 nov 2026): webcam chat in een groep (groepbellen.js v2), tot 4 personen.
# Nagebootste Supabase en nep-Realtime met presence (uit proef282), echte WebRTC met nep-camera en nep-microfoon.
# Marcel, Bram en Lotte in een webcam-groep.
#  A. Marcel opent de groep: balk 'Nog niemand in de webcam chat' met Starten; tik -> een scherm met zijn eigen beeld
#     (gespiegeld), twee vrije plekjes, en de knoppen Microfoon, Luidspreker, Camera, Hand en Ophangen
#  B. Bram doet mee -> Marcel ziet het beeld van Bram (en andersom), verbonden
#  C. wie praat: het scherm van Bram krijgt bij Marcel de gouden rand (.praat)
#  D. Bram zet zijn camera uit -> Marcel ziet Brams rondje in plaats van beeld; weer aan -> beeld terug. Het
#     beeld-element blijft hetzelfde (wordt niet steeds opnieuw gemaakt, dus het beeld hapert niet)
#  E. Lotte heeft geen camera -> ze doet mee met alleen geluid (melding), Marcel ziet haar rondje; haar Camera-knop
#     staat uit; vier plekken = vol: er is geen vrij plekje meer over (3 leden)
#  F. Bram hangt op -> zijn scherm verdwijnt bij Marcel
#  G. geen paginafouten
# python3 -I proef283.py <map>
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
_t = [0]
def nu():  # oplopend, net als in de echte database (microseconden): de volgorde van berichten ligt vast
    _t[0] += 1
    return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + '.%06dZ' % _t[0]

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
            if naam == 'groep_ongelezen': return route.fulfill(status=200, json=[{'groep_id': g['id'], 'aantal': 3} for g in DB['groepen'] if lid(g['id'])])
            if naam in ('groep_markeer_gelezen', 'ongelezen_per_vriend'): return route.fulfill(status=200, json=[] if naam == 'ongelezen_per_vriend' else None)
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
            if m == 'DELETE':
                bid = eq('id')
                DB['berichten'][:] = [x for x in DB['berichten'] if not (x['id'] == bid and x['sender_id'] == uid)]
                return route.fulfill(status=204, body='')
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
            if (payload or {}).get('event') == 'rtc': rt.setdefault('rtc', []).append((s.uid, (payload or {}).get('payload')))
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


www = tempfile.mkdtemp(prefix='proef283_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
    if uid == LOTTE:  # Lotte heeft geen camera
        ctx.add_init_script("(() => { const md = navigator.mediaDevices; const gum = md.getUserMedia.bind(md); md.getUserMedia = c => (c && c.video) ? Promise.reject(new DOMException('geen camera', 'NotFoundError')) : gum(c) })()")
    pg = ctx.new_page(); fouten = []
    pg.on('pageerror', lambda e: fouten.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASIS + 'login.html')
    pg.evaluate("([t, en, namen, uid]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); if (en) localStorage.setItem('fibro_taal', 'en'); for (const [id, n] of Object.entries(namen)) localStorage.setItem('vriend_naam_' + id + '_' + uid, n) }", [token(uid), taal == 'en', {MARCEL: 'Marcel'} if uid != MARCEL else {}, uid])
    DB['sleutels'][uid] = pg.evaluate(SLEUTEL, uid)
    return ctx, pg, fouten
def tegels(pg): return pg.eval_on_selector_all('#belTegels .tegel', "els => els.map(e => ({ naam: (e.querySelector('.tnaam') || e).textContent, cls: e.className, beeld: !!(e.querySelector('video') && !e.querySelector('video').hidden && e.querySelector('video').videoWidth > 0), rondje: !!(e.querySelector('.cirkel') && !e.querySelector('.cirkel').hidden) }))")
def tegel(pg, naam): return next((t for t in tegels(pg) if t['naam'] == naam), None)
def wacht_tot(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
ZIE = "(n => { const e = [...document.querySelectorAll('#belTegels .tegel')].find(e => (e.querySelector('.tnaam') || {}).textContent === n); const v = e && e.querySelector('video'); return !!(v && !v.hidden && v.videoWidth > 0) })"
RONDJE = "(n => { const e = [...document.querySelectorAll('#belTegels .tegel')].find(e => (e.querySelector('.tnaam') || {}).textContent === n); const c = e && e.querySelector('.cirkel'); return !!(c && !c.hidden && e.querySelector('video').hidden) })"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        mc, m, mf = toestel(b, MARCEL); bc, bp, bf = toestel(b, BRAM); lc, lp, lf = toestel(b, LOTTE)
        for c in (mc, bc, lc): c.grant_permissions(['microphone', 'camera'])
        VRIENDEN[LOTTE] = [MARCEL]
        gid = '99999999-9999-4999-8999-999999999999'
        DB['groepen'].append({'id': gid, 'naam': 'Kijkgroep', 'soort': 'webcam', 'maker': MARCEL, 'created_at': nu()})
        for u, rol in ((MARCEL, 'beheerder'), (BRAM, 'lid'), (LOTTE, 'lid')): DB['leden'].append({'groep_id': gid, 'user_id': u, 'rol': rol})
        open_ = lambda pg: (pg.goto(BASIS + 'groep.html?id=' + gid), pg.wait_for_function("document.getElementById('groepSub').textContent.includes('3')"), pg.wait_for_timeout(600))
        # A
        open_(m)
        m.wait_for_selector('#belBalk:not([hidden])')
        check('Nog niemand in de webcam chat' in m.inner_text('#belBalkTekst') and m.inner_text('#belMee') == 'Starten', 'A: balk met Starten (%r)' % m.inner_text('#belBalk'))
        m.click('#belMee'); m.wait_for_selector('#belPaneel:not([hidden])')
        ok = wacht_tot(m, ZIE + "('Jij')", 8000)
        t = tegels(m)
        check(ok and t[0]['naam'] == 'Jij' and 'scherm' in t[0]['cls'] and 'ik' in t[0]['cls'], 'A: eigen beeld in een scherm (%s)' % t)
        check(m.evaluate("getComputedStyle(document.querySelector('.tegel.ik video')).transform") != 'none', 'A: eigen beeld gespiegeld')
        check(sum('leeg' in x['cls'] for x in t) == 2, 'A: twee vrije plekjes')
        knoppen = m.inner_text('.bel-knoppen')
        check(all(w in knoppen for w in ('Microfoon', 'Luidspreker', 'Camera', 'Hand', 'Ophangen')) and m.is_visible('#belCam'), 'A: vijf knoppen met Camera (%r)' % knoppen)
        # B
        open_(bp)
        bp.wait_for_function("document.getElementById('belBalkTekst').textContent.includes('Marcel')", timeout=8000)
        check('Marcel zit in de webcam chat' in bp.inner_text('#belBalkTekst'), 'B: Bram ziet "Marcel zit in de webcam chat"')
        bp.click('#belMee'); bp.wait_for_selector('#belPaneel:not([hidden])')
        ok1 = wacht_tot(m, ZIE + "('Bram')", 20000); ok2 = wacht_tot(bp, ZIE + "('Marcel')", 20000)
        check(ok1 and ok2, 'B: Marcel ziet Bram en Bram ziet Marcel (%s | %s)' % (tegels(m), tegels(bp)))
        rtc = json.dumps([x[1] for x in rt.get('rtc', [])])
        check('m=video' not in rtc and 'sdp' not in rtc, 'B: seintjes versleuteld')
        # C
        check(wacht_tot(m, "[...document.querySelectorAll('#belTegels .tegel.praat')].some(e => e.textContent.includes('Bram'))"), 'C: Brams scherm kleurt goud als hij praat')
        rand = m.evaluate("getComputedStyle([...document.querySelectorAll('#belTegels .tegel.praat .vak')][0] || document.body).borderTopColor")
        check(rand == 'rgb(252, 211, 77)', 'C: gouden rand (%s)' % rand)
        if os.environ.get('SHOT'): m.screenshot(path=os.environ['SHOT'] + '/m283.png')
        # D
        m.evaluate("() => { const e = [...document.querySelectorAll('#belTegels .tegel')].find(e => e.textContent.includes('Bram')); e.querySelector('video').__merk = 1 }")
        bp.click('#belCam')
        check(bp.get_attribute('#belCam', 'aria-pressed') == 'false' and 'Camera uit' in bp.inner_text('#belCam'), 'D: knop zegt Camera uit')
        check(wacht_tot(m, RONDJE + "('Bram')", 8000), 'D: Marcel ziet Brams rondje (%s)' % tegel(m, 'Bram'))
        bp.click('#belCam')
        check(wacht_tot(m, ZIE + "('Bram')", 8000), 'D: camera weer aan -> beeld terug')
        check(m.evaluate("() => { const e = [...document.querySelectorAll('#belTegels .tegel')].find(e => e.textContent.includes('Bram')); return e.querySelector('video').__merk === 1 }"), 'D: hetzelfde beeld-element (niet opnieuw gemaakt)')
        # E
        open_(lp)
        lp.wait_for_function("document.getElementById('belBalkTekst').textContent.includes('Marcel')", timeout=8000)
        lp.click('#belMee'); lp.wait_for_selector('#belPaneel:not([hidden])')
        check('alleen geluid' in lp.inner_text('body'), 'E: Lotte krijgt de melding "alleen geluid"')
        check(lp.is_disabled('#belCam'), 'E: Lottes Camera-knop staat uit')
        ok = wacht_tot(m, RONDJE + "('Lotte')", 15000) and wacht_tot(m, "[...document.querySelectorAll('#belTegels .tegel')].some(e => e.textContent.includes('Lotte') && !e.classList.contains('wacht'))", 20000)
        check(ok, 'E: Marcel ziet Lottes rondje, verbonden (%s)' % tegels(m))
        check(wacht_tot(lp, ZIE + "('Marcel')", 20000), 'E: Lotte ziet wel het beeld van Marcel')
        check(sum('leeg' in x['cls'] for x in tegels(m)) == 0 and len(tegels(m)) == 3, 'E: drie schermen, geen vrij plekje meer')
        # F
        bp.click('#belWeg')
        check(wacht_tot(m, "![...document.querySelectorAll('#belTegels .tegel')].some(e => e.textContent.includes('Bram'))", 8000), 'F: Brams scherm weg bij Marcel (%s)' % tegels(m))
        check(not mf and not bf and not lf, 'G: geen paginafouten (%s %s %s)' % (mf[:2], bf[:2], lf[:2]))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
