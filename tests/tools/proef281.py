# proef281 (10 nov 2026): groepschat zoals de gewone chat - antwoorden, reacties, weghalen, typen en ongelezen.
# Nagebootste Supabase en nep-Realtime (uit proef239). Marcel, Bram en Lotte in een groep.
#  A. Bram houdt een bericht van Marcel lang ingedrukt -> menu met emoji's; 👍 = een 'stil' versleuteld bericht; het
#     duimpje staat onder het bericht, bij Bram en (na verversen) bij Marcel
#  B. Antwoorden: menu > ↩ Antwoorden, balk boven het invoerveld, versturen -> bij Marcel een citaat van zijn bericht
#  C. Weghalen: Marcel haalt zijn eigen bericht weg -> uit de database, '🚫 Bericht verwijderd'; Bram ziet het niet meer
#  D. Typen: terwijl Marcel typt, ziet Bram 'Marcel typt…' bovenin
#  E. Ongelezen: de chatlijst toont het aantal nieuwe berichten bij de groep en telt het mee op het tabblad Chat;
#     een groep openen = gelezen (groep_markeer_gelezen)
#  F. geen paginafouten
# python3 -I proef281.py <map>
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


www = tempfile.mkdtemp(prefix='proef281_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
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
def rij_met(pg, tekst): return pg.locator('.b-rij', has_text=tekst).last
def menu(pg, tekst):
    r = rij_met(pg, tekst); b = r.locator('.bubbel').bounding_box()
    r.locator('.bubbel').dispatch_event('contextmenu', {'clientX': b['x'] + 10, 'clientY': b['y'] + 10})
    pg.wait_for_selector('#berichtMenu')
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        mc, m, mf = toestel(b, MARCEL); bc, bp, bf = toestel(b, BRAM)
        gid = '99999999-9999-4999-8999-999999999999'
        DB['groepen'].append({'id': gid, 'naam': 'Drie', 'soort': 'chat', 'maker': MARCEL, 'created_at': nu()})
        for u, rol in ((MARCEL, 'beheerder'), (BRAM, 'lid'), (LOTTE, 'lid')): DB['leden'].append({'groep_id': gid, 'user_id': u, 'rol': rol})
        open_ = lambda pg: (pg.goto(BASIS + 'groep.html?id=' + gid), pg.wait_for_function("document.getElementById('groepSub').textContent.includes('3')"))
        def stuur(pg, tekst): pg.fill('#bericht', tekst); pg.click('#verstuur'); pg.wait_for_selector('.b-rij.mijn >> text=' + tekst)
        open_(m); stuur(m, 'Wie komt zaterdag?')
        # A
        open_(bp); bp.wait_for_selector('.b-rij >> text=Wie komt zaterdag?')
        menu(bp, 'Wie komt zaterdag?')
        knoppen = bp.eval_on_selector_all('#berichtMenu button', 'els => els.map(e => e.textContent)')
        check('👍' in knoppen and '↩ Antwoorden' in knoppen and '🗑 Weghalen' not in knoppen, 'A: menu met emoji, antwoorden, geen weghalen bij een ander (%s)' % knoppen)
        n0 = len(DB['berichten'])
        bp.click('#berichtMenu button >> text=👍'); bp.wait_for_function("document.querySelector('.b-rij .reacties')")
        r = DB['berichten'][-1]
        check(len(DB['berichten']) == n0 + 1 and r.get('stil') is True and r['content'].startswith('g1:'), 'A: reactie = stil versleuteld bericht')
        check(bp.inner_text('.b-rij .reacties') == '👍', 'A: duimpje onder het bericht bij Bram (%r)' % bp.inner_text('.b-rij .reacties'))
        check(bp.locator('.b-rij').count() == 1, 'A: de reactie is zelf geen bericht')
        open_(m); m.wait_for_selector('.b-rij .reacties')
        check(m.inner_text('.b-rij .reacties') == '👍', 'A: Marcel ziet het duimpje ook')
        # B
        menu(bp, 'Wie komt zaterdag?'); bp.click('#berichtMenu button >> text=↩ Antwoorden')
        check(not bp.is_hidden('#antwoordBalk') and 'Wie komt zaterdag?' in bp.inner_text('#antwoordBalk'), 'B: antwoordbalk boven het invoerveld (%s %r)' % (bp.is_hidden('#antwoordBalk'), bp.eval_on_selector('#antwoordBalk', 'e => e.outerHTML')))
        stuur(bp, 'Ik!')
        check(bp.is_hidden('#antwoordBalk'), 'B: balk weg na versturen')
        open_(m); m.wait_for_selector('.b-rij >> text=Ik!')
        c = rij_met(m, 'Ik!').locator('.citaat').inner_text()
        check('Wie komt zaterdag?' in c, 'B: Marcel ziet het citaat (%r)' % c)
        if os.environ.get('SHOT'): m.screenshot(path=os.environ['SHOT'] + '/m281.png')
        # D: typen (Bram heeft de groep open)
        open_(bp); bp.wait_for_timeout(800)
        m.type('#bericht', 'Ik ben er ook bij', delay=30)
        try: bp.wait_for_function("document.getElementById('groepSub').textContent.includes('typt')", timeout=5000); ok = True
        except Exception: ok = False
        check(ok and 'Marcel typt' in bp.inner_text('#groepSub'), 'D: Bram ziet "Marcel typt…" (%r)' % bp.inner_text('#groepSub'))
        m.fill('#bericht', '')
        # C: weghalen
        stuur(m, 'Oeps')
        oeps = [x for x in DB['berichten'] if x['sender_id'] == MARCEL][-1]['id']
        menu(m, 'Oeps'); m.click('#berichtMenu button >> text=🗑 Weghalen')
        m.wait_for_selector('.bubbel.weg')
        check(not any(x['id'] == oeps for x in DB['berichten']), 'C: uit de database')
        check('Bericht verwijderd' in m.inner_text('.bubbel.weg'), 'C: Marcel ziet "Bericht verwijderd"')
        open_(bp); bp.wait_for_selector('.b-rij >> text=Ik!')
        check(bp.locator('.b-rij', has_text='Oeps').count() == 0, 'C: Bram ziet het niet meer')
        # E: ongelezen
        mark_voor = sum(1 for x in DB['rpc'] if x[1] == 'groep_markeer_gelezen' and x[0] == BRAM)
        check(mark_voor > 0, 'E: groep openen = gelezen gemarkeerd')
        m.goto(BASIS + 'chat.html'); m.wait_for_selector('#groepenLijst .groep-item .fo-bol', timeout=10000)
        check(m.inner_text('#groepenLijst .groep-item .fo-bol') == '3', 'E: bolletje met 3 bij de groep')
        tab = m.locator('.nav-item', has_text='Chat').locator('.fo-bol')
        check(tab.count() == 1 and tab.inner_text() == '3', 'E: ook op het tabblad Chat')
        check(not mf and not bf, 'F: geen paginafouten (%s %s)' % (mf[:2], bf[:2]))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
