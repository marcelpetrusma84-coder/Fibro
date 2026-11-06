# proef272 (6 nov 2026, v271): nummers uit je playlist verwijderen (muziekwidget op Home), op verzoek van Marcel.
# De oude ✕ bewaarde de lijst op een oude plek (muziek_tracks_), dus na opnieuw openen stond het nummer er weer.
#  A. Home met drie nummers: drie regels, elk met een duidelijke ✕ (knop, minstens 28 px)
#  B. ✕ bij het middelste, vraag 'Annuleren': er verandert niets
#  C. ✕ bij het middelste, vraag 'OK': nog twee nummers (1 en 3)
#  D. opnieuw openen: nog steeds twee (1 en 3); in de opslag muziek_index met 2, muziek_nr_2 weg, geen muziek_tracks_
#  E. ook het laatste nummer weg: 'Geen nummers toegevoegd', en na opnieuw openen nog steeds leeg
#  F. geen paginafouten
# python3 -I proef272.py <map>
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

# Media: twee foto's, een nummer, een video-plaatje (echte, kleine data:-adressen, in de pagina gemaakt)
MEDIA_JS = """() => { const foto = k => { const c = document.createElement('canvas'); c.width = 120; c.height = 120; const x = c.getContext('2d'); x.fillStyle = k; x.fillRect(0, 0, 120, 120); x.fillStyle = '#fff'; x.fillRect(20, 20, 40, 40); return c.toDataURL('image/png') }
  const wav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
  return { f0: foto('#c084fc'), f1: foto('#22c55e'), muziek: wav, thumb: foto('#f97316').replace('image/png', 'image/png') } }"""
LAYOUT = json.dumps([{"id": "fotos_2x2", "icon": "x", "titel": "Foto grid 2×2", "w": 2, "h": 2, "aan": True, "volgorde": 0},
                     {"id": "muziek", "icon": "🎵", "titel": "Muziek player", "w": 4, "h": 2, "aan": True, "volgorde": 1},
                     {"id": "video", "icon": "🎬", "titel": "Video", "w": 4, "h": 3, "aan": True, "volgorde": 2}])
ZET_DB = """async recs => { const db = await new Promise((ok, f) => { const r = indexedDB.open('FibroDB', 2); r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }; r.onsuccess = e => ok(e.target.result); r.onerror = f })
  await new Promise(ok => { const tx = db.transaction('fotos', 'readwrite'); for (const [id, data] of recs) tx.objectStore('fotos').put({ id, data }); tx.oncomplete = ok }) }"""

def toestel(br, uid, sl):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
    ctx.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('fibro_eigennaam_gevraagd_') ? '1' : g.call(this, k) } })()")  # v270: geen vraag 'Hoe heet je?' over Home heen (eigennaam.js; die heeft een eigen test)
    ctx.route('**/*supabase.co/**', rest(uid, sl))
    ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(NAAM[uid] + ': ' + str(e)[:200]))
    pg.goto(B + 'manifest.json')
    pg.evaluate("([t, uid]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_meldkaart_weg', String(Date.now())) }", [token(uid), uid])
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=182'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

LEES_DB = """async ids => { const db = await new Promise((ok, f) => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = () => ok(r.result); r.onerror = f })
  const uit = {}; for (const id of ids) uit[id] = await new Promise(ok => { const q = db.transaction('fotos').objectStore('fotos').get(id); q.onsuccess = () => ok(q.result ? q.result.data : null); q.onerror = () => ok(null) }); return uit }"""
NAMEN = "() => [...document.querySelectorAll('.muz-item span:nth-child(2)')].map(e => e.textContent)"
ANTWOORD = {'ja': False}
def vraag(pg, antwoord):
    ANTWOORD['ja'] = antwoord
    if not getattr(pg, '_vraag', False):
        pg._vraag = True
        pg.on('dialog', lambda d: d.accept() if (d.type == 'confirm' and ANTWOORD['ja']) else d.dismiss())
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl)
        media = m.evaluate(MEDIA_JS)
        lijst = [{"naam": "Eerste nummer", "artiest": ""}, {"naam": "Tweede nummer", "artiest": ""}, {"naam": "Derde nummer", "artiest": ""}]
        m.evaluate(ZET_DB, [['muziek_index_' + MARCEL, json.dumps(lijst)], ['muziek_nr_' + MARCEL + '_0', media['muziek']],
                            ['muziek_nr_' + MARCEL + '_1', media['muziek']], ['muziek_nr_' + MARCEL + '_2', media['muziek']]])
        m.evaluate("([uid, l]) => localStorage.setItem('fibro_widgets_profiel_' + uid, l)", [MARCEL, json.dumps([{"id": "muziek", "icon": "🎵", "titel": "Muziek player", "w": 4, "h": 2, "aan": True, "volgorde": 0}])])
        m.goto(B + 'index.html')
        ok = wacht(m, "() => document.querySelectorAll('.muz-item').length === 3", 15000)
        maat = m.evaluate("() => [...document.querySelectorAll('.muz-del')].map(b => [b.tagName, Math.round(b.getBoundingClientRect().width)])")
        if os.environ.get('PROEF_FOTO'): m.locator('.muz-item').first.locator('xpath=ancestor::*[contains(@class,"widget-blok")][1]').screenshot(path=os.environ['PROEF_FOTO'])
        check('A drie nummers, elk met een duidelijke ✕', ok and len(maat) == 3 and all(t == 'BUTTON' and w >= 28 for t, w in maat), maat)
        vraag(m, False); m.click('.muz-del[data-i="1"]'); m.wait_for_timeout(500)
        check('B Annuleren: er verandert niets', m.evaluate(NAMEN) == ['Eerste nummer', 'Tweede nummer', 'Derde nummer'], m.evaluate(NAMEN))
        vraag(m, True); m.click('.muz-del[data-i="1"]')
        ok = wacht(m, "() => document.querySelectorAll('.muz-item').length === 2", 5000)
        check('C OK: nog twee nummers (1 en 3)', ok and m.evaluate(NAMEN) == ['Eerste nummer', 'Derde nummer'], m.evaluate(NAMEN))
        m.reload(); wacht(m, "() => document.querySelectorAll('.muz-item').length >= 1", 15000); m.wait_for_timeout(800)
        db = m.evaluate(LEES_DB, ['muziek_index_' + MARCEL, 'muziek_nr_' + MARCEL + '_2', 'muziek_tracks_' + MARCEL])
        idx = json.loads(db['muziek_index_' + MARCEL] or '[]')
        check('D opnieuw openen: nog steeds 1 en 3; opslag klopt', m.evaluate(NAMEN) == ['Eerste nummer', 'Derde nummer'] and [x['naam'] for x in idx] == ['Eerste nummer', 'Derde nummer']
              and db['muziek_nr_' + MARCEL + '_2'] is None and db['muziek_tracks_' + MARCEL] is None and m.evaluate("uid => localStorage.getItem('muziek_tracks_' + uid)", MARCEL) is None, (m.evaluate(NAMEN), idx, db))
        vraag(m, True)
        for _ in range(2):
            m.click('.muz-del[data-i="0"]'); m.wait_for_timeout(700)
        leeg = m.evaluate("() => document.querySelectorAll('.muz-item').length === 0 && document.body.innerText.includes('Geen nummers toegevoegd')")
        m.reload(); m.wait_for_timeout(2500)
        check('E alles weg: Geen nummers toegevoegd, ook na opnieuw openen', leeg and m.evaluate("() => document.querySelectorAll('.muz-item').length") == 0, (leeg, m.evaluate(NAMEN)))
        cm.close(); br.close()
finally:
    srv.terminate()
check('F geen paginafouten', not fouten, fouten[:3])
print('KLAAR: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if all(uitslag) else 1)
