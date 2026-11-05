# proef241 (4 nov 2026, v263): de strook "✨ Nieuw bij je vrienden" op Home (nieuwbij.js), in Chrome.
#  S1 twee vrienden met iets nieuws: een strook met hun fotootje, naam en teken (📷🎵 / 🎬), nieuwste eerst; een
#     ex-vriend niet
#  S2 tik op Bram = zijn profiel; terug op Home is hij uit de strook (gezien), Lotte staat er nog
#  S3 niets nieuws meer = geen strook
#  S4 er komt iets binnen terwijl Home open is (sync.js meldt het): de strook verschijnt meteen
#  D  geen paginafouten
# python3 -I proef241.py <map>
import sys, os, time, json, socket, subprocess, re, urllib.parse
from playwright.sync_api import sync_playwright

MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'; GERRIT = 'dddd0004-0000-4000-8000-000000000004'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram', GERRIT: 'Gerrit'}
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
def djb2(s):
    h = 5381
    for c in s: h = ((h << 5) + h + ord(c)) & 0xFFFFFFFF
    return format(h, 'x')

SERVER = {'likes': [], 'berichten': []}
VRIENDEN = {(MARCEL, BRAM), (BRAM, MARCEL), (GERRIT, MARCEL), (MARCEL, GERRIT)}
def nu(): return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
def filters(u):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
    return {k: v[0][3:] for k, v in q.items() if v and v[0].startswith('eq.')}

def rest(uid, sleutels):
    ander = BRAM if uid == MARCEL else MARCEL
    def supa(route):
        u = route.request.url; m = route.request.method
        if '/rest/v1/rpc/profiel_like_tellers' in u:
            eig = json.loads(route.request.post_data or '{}').get('p_eigenaar')
            if not (uid == eig or (uid, eig) in VRIENDEN): return route.fulfill(status=200, json=[])
            tel = {}
            for l in SERVER['likes']:
                if l['eigenaar'] == eig and (l['liker'], eig) in VRIENDEN:
                    k = (l['soort'], l['item'], l['emoji']); tel[k] = tel.get(k, 0) + 1
            return route.fulfill(status=200, json=[{'soort': a, 'item': b, 'emoji': c, 'aantal': n} for (a, b, c), n in tel.items()])
        if '/rest/v1/profiel_likes' in u:
            f = filters(u)
            if m == 'GET':
                rijen = [l for l in SERVER['likes'] if (l['liker'] == uid or l['eigenaar'] == uid) and all(l.get(k) == v for k, v in f.items())]
                return route.fulfill(status=200, json=rijen)
            if m == 'POST':
                r = json.loads(route.request.post_data or '{}')
                if r.get('liker') != uid or (uid, r.get('eigenaar')) not in VRIENDEN: return route.fulfill(status=403, json={'message': 'rls'})
                SERVER['likes'] = [l for l in SERVER['likes'] if not (l['eigenaar'] == r['eigenaar'] and l['liker'] == uid and l['soort'] == r['soort'] and l['item'] == r['item'])]
                SERVER['likes'].append(dict(r, created_at=nu())); return route.fulfill(status=201, body='')
            if m == 'DELETE':
                SERVER['likes'] = [l for l in SERVER['likes'] if not (all(l.get(k) == v for k, v in f.items()) and (l['liker'] == uid or l['eigenaar'] == uid))]
                return route.fulfill(status=204, body='')
        if '/rest/v1/messages' in u and m == 'POST':
            r = json.loads(route.request.post_data or '{}'); r['id'] = '00000000-0000-4000-8000-%012d' % (len(SERVER['berichten']) + 1); r['created_at'] = nu()
            SERVER['berichten'].append(r); return route.fulfill(status=201, json={'id': r['id']})
        if '/rest/v1/messages' in u: return route.fulfill(status=200, json=list(reversed(SERVER['berichten'])))
        if '/rest/v1/friendships' in u:
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "online_status": True, "laatst_gezien": nu(), "public_key": sleutels.get(ander)}
            return route.fulfill(status=200, json=[{"id": "f1", "user_id": uid, "friend_id": ander, "status": "accepted", "profiles": vr}])
        if '/rest/v1/profiles' in u and m == 'GET':
            rij = lambda i: {"id": i, "username": NAAM[i], "display_name": None, "avatar_url": "\U0001F419", "public_key": sleutels.get(i), "avatar_data": None, "widgets": None}
            if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''):
                return route.fulfill(status=200, json=rij(ander if ander in u else uid))
            ids = [i for i in NAAM if i in u]
            return route.fulfill(status=200, json=[rij(i) for i in ids] if ids else [rij(uid)])
        if '/functions/v1/' in u: return route.fulfill(status=200, json={'ok': True})
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": uid, "aud": "authenticated"})
        if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
        return route.fulfill(status=200, json=[])
    return supa

MAP = os.path.abspath(sys.argv[1])
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/' % poort
uitslag = []; fouten = []
def check(n, ok, info=''): uitslag.append(bool(ok)); print(('OK   ' if ok else 'MIS  ') + n + ('  | ' + str(info)[:300] if info != '' else ''), flush=True)
def wacht(pg, js, ms, arg=None):
    try: pg.wait_for_function(js, arg=arg, timeout=ms); return True
    except Exception: return False


LOTTE = 'cccc0003-0000-4000-8000-000000000003'; WEG = 'eeee0005-0000-4000-8000-000000000005'
NAAM[LOTTE] = 'Lotte'; NAAM[WEG] = 'Weg'
VRIENDENPAGINA = json.dumps({'data': [{'profiles': {'id': BRAM, 'username': 'bram', 'avatar_url': '\U0001F438'}}, {'profiles': {'id': GERRIT, 'username': 'gerrit', 'avatar_url': '\U0001F98A'}}, {'profiles': {'id': LOTTE, 'username': 'lotte', 'avatar_url': '\U0001F431'}}]})
def toestel(br, uid, sl):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
    ctx.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('fibro_eigennaam_gevraagd_') ? '1' : g.call(this, k) } })()")  # v270: geen vraag 'Hoe heet je?' over Home heen (eigennaam.js; die heeft een eigen test)
    ctx.route('**/*supabase.co/**', rest(uid, sl))
    ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(NAAM[uid] + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json')
    pg.evaluate("([t, uid]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_meldkaart_weg', String(Date.now())) }", [token(uid), uid])
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=182'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg


STROOK = """() => { const v = document.getElementById('nieuwBij'); if (!v || v.hidden) return null
  return [...v.querySelectorAll('.nb-vriend')].map(b => b.querySelector('.nb-naam').textContent + '|' + b.querySelector('.nb-teken').textContent) }"""
def zet(pg, sl, waarde): pg.evaluate("([k, v]) => localStorage.setItem(k, v)", [sl, json.dumps(waarde)])
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl)
        zet(m, 'fibro_vriendenpagina_' + MARCEL, json.loads(VRIENDENPAGINA))
        zet(m, 'fibro_syncbij_' + MARCEL + '_' + BRAM, {'t': 5, 'nieuw': True, 'w': ['foto', 'muziek'], 'nt': 1000})
        zet(m, 'fibro_syncbij_' + MARCEL + '_' + LOTTE, {'t': 5, 'nieuw': True, 'w': ['video'], 'nt': 2000})
        zet(m, 'fibro_syncbij_' + MARCEL + '_' + WEG, {'t': 5, 'nieuw': True, 'w': ['foto'], 'nt': 3000})
        zet(m, 'fibro_syncbij_' + MARCEL + '_' + GERRIT, {'t': 5, 'nieuw': False, 'w': [], 'nt': 0})
        m.evaluate("([k, v]) => localStorage.setItem(k, v)", ['vriend_naam_' + BRAM + '_' + MARCEL, 'Bram B.'])
        m.goto(B + 'index.html')
        s1 = wacht(m, "() => { const v = document.getElementById('nieuwBij'); return v && !v.hidden && v.querySelectorAll('.nb-vriend').length === 2 }", 15000)
        r1 = m.evaluate(STROOK)
        plek = m.evaluate("(() => { const n = document.getElementById('nieuwBij'), h = document.getElementById('home-sectie'); return !!(n.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING) && n.querySelector('.nb-kop').textContent })()")
        check('S1 strook boven de widgets: Lotte 🎬, Bram B. 📷🎵 (nieuwste eerst, geen ex-vriend)', s1 and r1 == ['lotte|\U0001F3AC', 'Bram B.|\U0001F4F7\U0001F3B5'] and plek == '\u2728 Nieuw bij je vrienden', (r1, plek))
        m.click('#nieuwBij .nb-vriend[data-id="' + BRAM + '"]')
        naar = wacht(m, "() => location.pathname.endsWith('vriend-profiel.html') && location.search.includes('" + BRAM + "')", 10000)
        m.wait_for_timeout(2500)
        m.goto(B + 'index.html')
        s2 = wacht(m, "() => { const v = document.getElementById('nieuwBij'); return v && !v.hidden && v.querySelectorAll('.nb-vriend').length === 1 }", 15000)
        r2 = m.evaluate(STROOK)
        check('S2 tik op Bram = zijn profiel; terug op Home staat alleen Lotte er nog', naar and s2 and r2 == ['lotte|\U0001F3AC'], (naar, r2))
        zet(m, 'fibro_syncbij_' + MARCEL + '_' + LOTTE, {'t': 5, 'nieuw': False, 'w': [], 'nt': 2000})
        m.reload(); m.wait_for_timeout(3000)
        r3 = m.evaluate(STROOK)
        check('S3 niets nieuws = geen strook', r3 is None, r3)
        m.evaluate("""([k]) => { localStorage.setItem(k, JSON.stringify({ t: 9, nieuw: true, w: ['achtergrond'], nt: 9000 }))
            window.dispatchEvent(new CustomEvent('fibro-sync-bijgewerkt', { detail: { vriendId: 'x', nieuw: true } })) }""", ['fibro_syncbij_' + MARCEL + '_' + GERRIT])
        s4 = wacht(m, "() => { const v = document.getElementById('nieuwBij'); return v && !v.hidden }", 3000)
        r4 = m.evaluate(STROOK)
        check('S4 er komt iets binnen: de strook verschijnt meteen (gerrit 🖼️)', s4 and r4 == ['gerrit|\U0001F5BC\uFE0F'], r4)
        cm.close(); br.close()
finally:
    srv.terminate()
check('D geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
