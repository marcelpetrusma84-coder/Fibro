# proef238 (4 nov 2026, v258): likes en reacties onder foto's, muziek en video's (profielreacties.js), in Chrome.
# Bram bekijkt het profiel van Marcel (vriend-profiel.html); Marcel kijkt op zijn eigen Home en in de chat.
# De server is nagebootst, met een echte tabel profiel_likes in het geheugen (dezelfde regels: alleen tellers voor
# vrienden, namen alleen voor de eigenaar).
#  L. Bij een vriend: 🤍 onder een foto (groot bekijken), in de muziekspeler en op de video. Tik = ❤️, nog eens = weg,
#     vasthouden = een andere emoji. De vingerafdruk (item) is dezelfde rekensom als sync.js (djb2), hier nagerekend.
#     Tellers van anderen zie je, namen niet. 💬 Reageer = een versleuteld chatbericht met een klein plaatje.
#  O. Op je eigen profiel: hoeveel likes bij je foto, muziek en video, tik = van wie (met de naam).
#  C. In de chat: de reactie als kaartje met het plaatje en de tekst.
# python3 -I proef238.py <map>
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
    ctx.route('**/*supabase.co/**', rest(uid, sl))
    ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(NAAM[uid] + ': ' + str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json')
    pg.evaluate("([t, uid]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_meldkaart_weg', String(Date.now())) }", [token(uid), uid])
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=182'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

HART = "(sel) => { const b = document.querySelector(sel); return b ? b.textContent.trim() : null }"
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        sl = {}
        cm, m = toestel(br, MARCEL, sl); cb, b = toestel(br, BRAM, sl)
        media = b.evaluate(MEDIA_JS)
        meta = json.dumps({"thumb": media['thumb'], "titel": "Strand", "duur": 12, "breedte": 120, "hoogte": 120, "grootte": 1000})
        IT = {'f0': djb2(media['f0']), 'f1': djb2(media['f1']), 'muziek': djb2(media['muziek']), 'video': djb2(media['thumb'])}
        # Bram heeft het profiel van Marcel binnen (zoals sync.js het opslaat)
        b.evaluate(ZET_DB, [['vriend_' + MARCEL + '_layout', LAYOUT], ['vriend_' + MARCEL + '_foto_pfoto_2x2_0', media['f0']], ['vriend_' + MARCEL + '_foto_pfoto_2x2_1', media['f1']],
                            ['vriend_' + MARCEL + '_muziek_index', json.dumps([{"naam": "Zomerliedje", "artiest": "Marcel"}])], ['vriend_' + MARCEL + '_muziek_nr0', media['muziek']],
                            ['vriend_' + MARCEL + '_video_meta', meta]])
        # Marcel heeft dezelfde dingen zelf
        m.evaluate(ZET_DB, [['pfoto_2x2_0_' + MARCEL, media['f0']], ['pfoto_2x2_1_' + MARCEL, media['f1']], ['muziek_index_' + MARCEL, json.dumps([{"naam": "Zomerliedje", "artiest": "Marcel"}])],
                            ['muziek_nr_' + MARCEL + '_0', media['muziek']], ['video_meta_' + MARCEL, meta]])
        m.evaluate("([uid, l]) => localStorage.setItem('fibro_widgets_profiel_' + uid, l)", [MARCEL, LAYOUT])
        # Gerrit vond de tweede foto al leuk
        SERVER['likes'].append({'eigenaar': MARCEL, 'liker': GERRIT, 'soort': 'foto', 'item': IT['f1'], 'emoji': '😍', 'created_at': nu()})

        # ---- L: Bram bij Marcel ----
        b.goto(B + 'vriend-profiel.html?id=' + MARCEL)
        fotos = wacht(b, "() => document.querySelectorAll('#vriendWidgetGrid .widget-blok img').length >= 3", 15000)
        b.locator('#vriendWidgetGrid .widget-blok img').first.click()
        balk = wacht(b, "() => !!document.querySelector('#fv-balk .pr-hart') && !!document.querySelector('#fv-balk .pr-reageer')", 8000)
        check('L1 foto groot: eronder 🤍 en 💬 Reageer', fotos and balk and b.evaluate(HART, '#fv-balk .pr-hart') == '🤍', b.evaluate(HART, '#fv-balk .pr-hart'))
        b.click('#fv-balk .pr-hart'); b.wait_for_timeout(500)
        mijn = [l for l in SERVER['likes'] if l['liker'] == BRAM]
        check('L2 tik: ❤️ 1, en op de server een like met de vingerafdruk van sync.js', b.evaluate(HART, '#fv-balk .pr-hart') == '❤️ 1' and len(mijn) == 1
              and mijn[0]['soort'] == 'foto' and mijn[0]['item'] == IT['f0'] and mijn[0]['emoji'] == '❤️' and mijn[0]['eigenaar'] == MARCEL, (b.evaluate(HART, '#fv-balk .pr-hart'), mijn, IT['f0']))
        b.click('#fv-balk .pr-hart'); b.wait_for_timeout(500)
        check('L3 nog eens: weg', b.evaluate(HART, '#fv-balk .pr-hart') == '🤍' and not [l for l in SERVER['likes'] if l['liker'] == BRAM], SERVER['likes'])
        # vasthouden: een andere emoji
        h = b.locator('#fv-balk .pr-hart').bounding_box()
        b.mouse.move(h['x'] + h['width'] / 2, h['y'] + h['height'] / 2); b.mouse.down(); b.wait_for_timeout(700); b.mouse.up()
        keuze = wacht(b, "() => document.querySelectorAll('#pr-emojikeuze button').length === 6", 3000)
        b.click('#pr-emojikeuze button[aria-label="🔥"]'); b.wait_for_timeout(500)
        mijn = [l for l in SERVER['likes'] if l['liker'] == BRAM]
        check('L4 vasthouden: zes emoji, 🔥 gekozen', keuze and b.evaluate(HART, '#fv-balk .pr-hart') == '🔥 1' and len(mijn) == 1 and mijn[0]['emoji'] == '🔥', (b.evaluate(HART, '#fv-balk .pr-hart'), mijn))
        # de tweede foto: Gerrit vond hem leuk; Bram ziet het aantal, geen naam
        b.click('#fv-volgende'); b.wait_for_timeout(400)
        check('L5 andere foto: het aantal van anderen (1), zonder namen', b.evaluate(HART, '#fv-balk .pr-hart') == '🤍 1' and 'Gerrit' not in b.evaluate("document.getElementById('fibro-fotoviewer').innerText"), b.evaluate(HART, '#fv-balk .pr-hart'))
        b.click('#fv-vorige'); b.wait_for_timeout(300)
        # reageren
        b.click('#fv-balk .pr-reageer')
        scherm = wacht(b, "() => !!document.querySelector('.pr-scherm .pr-tekst')", 3000)
        kop = b.evaluate("document.querySelector('.pr-scherm').innerText")
        b.fill('.pr-scherm .pr-tekst', 'Mooie foto!'); b.click('.pr-scherm .pr-verstuur')
        klaar = wacht(b, "() => !!document.querySelector('.pr-scherm .pr-klaar')", 5000)
        ber = SERVER['berichten'][-1] if SERVER['berichten'] else {}
        check('L6 Reageer: scherm "Reageer op de foto van Marcel", versleuteld bericht aan Marcel, "Verstuurd"', scherm and 'Reageer op de foto van Marcel' in kop and klaar
              and ber.get('receiver_id') == MARCEL and ber.get('sender_id') == BRAM and str(ber.get('content', '')).startswith('e2e:') and 'Mooie' not in ber.get('content', ''), (kop[:80], ber.get('content', '')[:30]))
        b.keyboard.press('Escape'); b.evaluate("document.querySelectorAll('.pr-scherm').forEach(e => e.remove()); document.getElementById('fv-sluit').click()")
        b.wait_for_timeout(300)
        # muziek
        mh = wacht(b, "() => !!document.querySelector('#vriendWidgetGrid #vm-play') && !!document.querySelector('#vriendWidgetGrid .pr-hart')", 5000)
        rij = b.evaluate("(() => { const r = document.querySelector('#vriendWidgetGrid #vm-play').closest('div[style*=\"space-between\"]'); return r ? [...r.children].map(c => c.className || c.tagName) : null })()")
        b.evaluate("[...document.querySelectorAll('#vriendWidgetGrid .pr-hart')].find(h => h.closest('.widget-blok').querySelector('#vm-play')).click()"); b.wait_for_timeout(500)
        mz = [l for l in SERVER['likes'] if l['liker'] == BRAM and l['soort'] == 'muziek']
        check('L7 muziek: 🤍 links en Reageer rechts in de knoppenrij; like met de vingerafdruk van het nummer', mh and rij and rij[0] == 'pr-hart' and rij[-1] == 'pr-reageer' and len(mz) == 1 and mz[0]['item'] == IT['muziek'], (rij, mz))
        # video
        vh = b.evaluate("(() => { const k = document.querySelector('#vriendWidgetGrid .vid-play-knop'); const h = k && k.parentElement.querySelector('.pr-hart'); return !!h })()")
        b.evaluate("document.querySelector('#vriendWidgetGrid .vid-play-knop').parentElement.querySelector('.pr-hart').click()"); b.wait_for_timeout(500)
        vd = [l for l in SERVER['likes'] if l['liker'] == BRAM and l['soort'] == 'video']
        speelt = b.evaluate("!!document.querySelector('#vriendWidgetGrid .vid-plek')")
        check('L8 video: 🤍 op het plaatje; tik = like (en de video gaat niet spelen)', vh and len(vd) == 1 and vd[0]['item'] == IT['video'] and not speelt, (vd, speelt))
        cb.close()

        # ---- O: Marcel op zijn eigen Home ----
        m.goto(B + 'index.html'); m.wait_for_timeout(3000)
        m.evaluate("document.querySelectorAll('div').forEach(d => { if ((d.textContent || '').includes('Tik om te beginnen') && getComputedStyle(d).position === 'fixed') d.remove() })")
        eigen = wacht(m, "() => document.querySelectorAll('#profiel-sectie .widget-blok img').length >= 2", 15000)
        m.locator('#profiel-sectie .widget-blok img').first.click()
        tel = wacht(m, "() => { const h = document.querySelector('#fv-balk .pr-hart'); return h && h.offsetParent !== null }", 8000)
        check('O1 eigen foto groot: 🔥 1 (geen Reageer op je eigen foto)', eigen and tel and m.evaluate(HART, '#fv-balk .pr-hart') == '🔥 1' and not m.evaluate("!!document.querySelector('#fv-balk .pr-reageer')"), m.evaluate(HART, '#fv-balk .pr-hart'))
        m.click('#fv-balk .pr-hart')
        lijst = wacht(m, "() => document.querySelectorAll('.pr-wielijst .pr-wie').length === 1", 5000)
        tekst = m.evaluate("(document.querySelector('.pr-wielijst') || {}).innerText || ''")
        check('O2 tik: van wie (Bram 🔥)', lijst and 'Bram' in tekst and '🔥' in tekst, tekst)
        m.evaluate("document.querySelectorAll('.pr-scherm').forEach(e => e.remove()); document.getElementById('fv-sluit').click()")
        badges = m.evaluate("(() => { const u = {}; for (const id of ['muziek', 'video']) { const h = document.querySelector('#profiel-sectie .widget-blok[data-id=\"' + id + '\"] .pr-hart'); u[id] = h && h.offsetParent !== null ? h.textContent.trim() : null } return u })()")
        check('O3 eigen muziek en video: ❤️ 1', badges == {'muziek': '❤️ 1', 'video': '❤️ 1'}, badges)
        fb = m.evaluate("(() => { const h = document.querySelector('#profiel-sectie .widget-blok[data-id=\"fotos_2x2\"] > .pr-balk .pr-hart'); return h && h.offsetParent !== null ? h.textContent.trim() : null })()")
        check('O3b eigen fotowidget: alle likes bij elkaar (🔥😍 2)', fb == '🔥😍 2', fb)
        m.evaluate("document.querySelector('#profiel-sectie .widget-blok[data-id=\"muziek\"] .pr-hart').click()")
        lijst = wacht(m, "() => document.querySelectorAll('.pr-wielijst .pr-wie').length === 1", 5000)
        tekst = m.evaluate("(document.querySelector('.pr-wielijst') || {}).innerText || ''")
        check('O4 muziek: van wie, met de naam van het nummer', lijst and 'Bram' in tekst and 'Zomerliedje' in tekst, tekst)
        m.evaluate("document.querySelectorAll('.pr-scherm').forEach(e => e.remove())")

        # ---- C: de reactie in de chat van Marcel ----
        m.goto(B + 'chat.html?vriend=' + BRAM)
        kaart = wacht(m, "() => !!document.querySelector('#messages .pr-kaart')", 15000)
        k = m.evaluate("(() => { const k = document.querySelector('#messages .pr-kaart'); if (!k) return null; const img = k.querySelector('img'); return { tekst: k.innerText, plaatje: img ? img.getAttribute('src').slice(0, 23) : null, html: k.querySelector('script') ? 'script!' : '' } })()")
        check('C1 chat: kaartje "Reageerde op je foto", met plaatje en tekst', kaart and k and 'Reageerde op je foto' in k['tekst'] and 'Mooie foto!' in k['tekst'] and k['plaatje'] == 'data:image/jpeg;base64,', k)
        cm.close()
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
