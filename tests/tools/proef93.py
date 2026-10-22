# proef93: PR #3 van valentijnpeters (v197): schaken met webcam, een vriend uitnodigen, nieuwe instellingen, in twee talen.
#  A. samen in de ECHTE chat.html, twee toestellen (Marcel en Bram, twee Chromium-contexten met nep-camera) en een
#     nep-Realtime-server die broadcasts tussen de twee doorgeeft (websocket en /api/broadcast). Per taal (nl, en):
#     A1 schaken via speelMee met een echte tijd-sessie (spelsessie.js): beide borden, webcamknop in de goede taal
#     A2 het spelgesprek komt vanzelf (hartslag -> belOp in spelmodus -> opnemen) met een WebRTC-verbinding
#     A3 Marcel tikt op de webcam: zijn eigen beeld speelt; bij Bram het beeld van Marcel (video speelt, beeldjes binnen)
#     A4 Marcel krijgt de bevestiging 'video-ontvangen': groene rand + 'Je vriend ziet je.' (EN 'Your friend can see you.')
#        en het label in de rand in de goede taal (data-gezien)
#     A5 Bram zet zijn webcam ook aan: Marcel ziet Bram; daarna zet Marcel uit: bij Bram verdwijnt Marcels beeld
#     A6 tik op een camerabeeld = groter (is-expanded), aria-label in de goede taal; nog een tik = terug
#     A7 een zet over het bord werkt nog met camera's aan
#     A8 spel sluiten: geen videomodus meer, camera uit (geen levende videotrack)
#     A9 een oudere uitnodiging (kleinere tijd-sessie) daarna opent geen spel (isNieuwsteSpelSessie)
#  B. spel.html tegen de computer, per taal: B1 werkbalk (Bord / Compact / Hele breedte / schuifjes), geen webcamknop;
#     B2 schuifjes-knop opent de instellingen helemaal in beeld (boven >= 0, onder <= schermhoogte) met de nieuwe
#     onderdelen; B3 punten per stuk (cijfers bij de geslagen stukken), glazen plaat (klassen), houten geluid
#     (select, previewSchaakGeluid zonder fout); B4 beginnersstand: een zet die een stuk weggeeft = vraag met
#     'Zet terugnemen' / 'Toch spelen', terugnemen = geen zet; B5 knop 'Tegen een vriend': lijst met vrienden,
#     uitnodigen = broadcast speluitnodiging + bericht spelinvite:schaken:... + naar chat.html met de goede vraag
#  C. samen via een proefpagina (zoals proef91): C1 'Extra duidelijk' en de beginnersstand staan uit met
#     '(alleen tegen de computer)'; C2 snelmat: SCHAAKMAT groot in beeld (na 3 s weg) en wie won in de status
#  D. de code: D1 een onEind in initBellen; D2 alle verwijzingen naar bellen.js, bordgeluid.js, speluitnodiging.js,
#     bel-luisteraar.js, schaken-ui.js en solo.js hebben hetzelfde nieuwe nummer; D3 CACHE_VERSION ongewijzigd (fibro-v31)
#  E. geen paginafouten, geen '[taal] nog geen vertaling'
# Oude map (v196) als controle: bijna alles MIS.
# python3 -I proef93.py <map> [nl|en|alles]
import sys, os, time, json, socket, subprocess, tempfile, re, threading
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); TALEN = ('nl', 'en') if len(sys.argv) < 3 or sys.argv[2] == 'alles' else (sys.argv[2],)
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram'}
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:230] if info != '' else ''), flush=True)
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP):
    if f != 'schaaksamen.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
HARNAS = r"""<!doctype html><html lang="nl" data-taal><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="taal.js"></script><title>Schaken samen</title>
<style>body{margin:0;background:#1a0a2e;color:#fff} #spelOverlay{position:fixed;inset:0;display:flex;flex-direction:column} #spelInhoud{flex:1;position:relative;display:flex;align-items:center;justify-content:center}</style></head>
<body><div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud"></div></div>
<script type="module">
const q = new URLSearchParams(location.search), rol = q.get('rol')
const bc = new BroadcastChannel('schaak93-' + q.get('kamer'))
const h = []
const kanaal = { topic: 'realtime:spel_x', on(t, f, cb) { h.push([f && f.event, cb]); return kanaal },
  send(m) { bc.postMessage({ van: rol, m: JSON.parse(JSON.stringify(m)) }); return Promise.resolve('ok') }, subscribe(fn) { if (fn) fn('SUBSCRIBED'); return kanaal } }
bc.onmessage = e => { const d = e.data; if (d.van === rol) return; h.filter(x => x[0] === d.m.event).forEach(x => x[1]({ type: 'broadcast', event: d.m.event, payload: d.m.payload })) }
const chat = await (await fetch('./chat.html')).text()
const v = n => (chat.match(new RegExp(n.replace('.', '\\.') + '\\?v=(\\d+)')) || [])[1]
const Schaak = await import('./schaak.js?v=95'), Bordgeluid = await import('./bordgeluid.js?v=' + v('bordgeluid.js'))
const m = await import('./schaken-ui.js?v=' + v('schaken-ui.js'))
m.start({ Schaak, Bordgeluid, spelKanaal: kanaal, benIkSpeler1: rol === 'wit', vriendNaam: rol === 'wit' ? 'Bram' : 'Marcel' })
window.__klaar = true
</script></body></html>"""
open(d + '/schaaksamen.html', 'w', encoding='utf-8').write(HARNAS)
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten, taalfout = [], []
def volg(pg, wie):
    pg.on('pageerror', lambda e: fouten.append(wie + ': ' + str(e)[:200] + ' @ ' + str(getattr(e, 'stack', '') or '')[:300].replace(chr(10), ' ')))
    pg.on('console', lambda m: taalfout.append(wie + ': ' + m.text) if 'nog geen vertaling' in m.text else None)
    pg.on('dialog', lambda dl: dl.dismiss())
def wacht(pg, js, ms, arg=None):
    try: pg.wait_for_function(js, arg=arg, timeout=ms); return True
    except Exception: return False
def klik(pg, sel, **kw):   # een klik die niet lukt (oude map: knop bestaat niet) is een MIS, geen afgebroken proef
    try: pg.click(sel, timeout=4000, **kw); return True
    except Exception: return False
def ev(pg, js, arg=None):
    try: return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:120]

# ---- nep-server: REST per toestel, Realtime gedeeld tussen de twee toestellen ----
RT = {'sockets': [], 'uit': [], 'lock': threading.Lock()}
def rest(uid, sleutels, posts):
    ander = BRAM if uid == MARCEL else MARCEL
    def supa(route):
        u = route.request.url; m = route.request.method
        if '/rest/v1/messages' in u and m == 'POST':
            posts.append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=201, json={"id": "mn%d" % len(posts)})
        if '/rest/v1/messages' in u: return route.fulfill(status=200, json=[])
        if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": uid, "friend_id": ander, "status": "accepted"}])
        if '/rest/v1/profiles' in u and m == 'GET':
            ik = {"id": uid, "username": NAAM[uid], "display_name": None, "avatar_url": "\U0001F419"}
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "public_key": sleutels.get(ander), "avatar_data": None}
            if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vr if ander in u else ik)
            return route.fulfill(status=200, json=[vr] if ('in.' in u or ander in u) else [ik])
        if '/functions/v1/' in u: return route.fulfill(status=200, json={})
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": uid, "aud": "authenticated"})
        return route.fulfill(status=200, json=[])
    return supa
def stuur_door(van, topic, event, payload):
    with RT['lock']:
        RT['uit'].append((topic, event, payload))
        for s in list(RT['sockets']):
            if s['w'] is van or topic not in s['topics']: continue
            try: s['w'].send(json.dumps([s['topics'][topic], None, topic, 'broadcast', {'type': 'broadcast', 'event': event, 'payload': payload}]))
            except Exception: pass
def ws(w):
    s = {'w': w, 'topics': {}}
    with RT['lock']: RT['sockets'].append(s)
    def bericht(m):
        if isinstance(m, (bytes, bytearray)):
            b = bytes(m)
            try:
                if b[0] != 3: return
                lj, lr, lt, le, lm, cod = b[1], b[2], b[3], b[4], b[5], b[6]; i = 7 + lj + lr
                topic = b[i:i + lt].decode(); i += lt; ev_ = b[i:i + le].decode(); i += le + lm
                stuur_door(w, topic, ev_, json.loads(b[i:].decode() or '{}') if cod == 1 else None)
            except Exception: pass
            return
        try: jr, ref, topic, event, payload = json.loads(m)
        except Exception: return
        if event == 'phx_join':
            s['topics'][topic] = jr
            pg_ = [dict(f, id=k + 1) for k, f in enumerate(((payload or {}).get('config') or {}).get('postgres_changes') or [])]
            w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {'postgres_changes': pg_}}])); return
        if event == 'phx_leave': s['topics'].pop(topic, None)
        if event == 'broadcast': stuur_door(w, topic, (payload or {}).get('event'), (payload or {}).get('payload'))
        if ref: w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {}}]))
    w.on_message(bericht)
    w.on_close(lambda *a: RT['sockets'].remove(s) if s in RT['sockets'] else None)
def http_broadcast(route):
    try:
        for m in (json.loads(route.request.post_data or '{}').get('messages') or []):
            t = m.get('topic') or ''
            stuur_door(None, t if t.startswith('realtime:') else 'realtime:' + t, m.get('event'), m.get('payload'))
    except Exception: pass
    return route.fulfill(status=202, body='')

VIDEO = r"""() => { const r = document.getElementById('remoteMedia'), l = document.getElementById('lokaalMedia')
  const rt = r && r.srcObject && r.srcObject.getVideoTracks ? r.srcObject.getVideoTracks().filter(t => t.readyState === 'live') : []
  const lt = l && l.srcObject && l.srcObject.getVideoTracks ? l.srcObject.getVideoTracks().filter(t => t.readyState === 'live') : []
  const zicht = el => { if (!el) return false; const b = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && b.width > 20 && b.height > 20 }
  return { modus: document.getElementById('spelOverlay').classList.contains('sch-video-modus'), ander: rt.length, anderZicht: zicht(r) && r.videoWidth > 0,
    eigen: lt.length, eigenZicht: zicht(l), gezien: document.getElementById('spelVideoEigen').classList.contains('is-seen'),
    label: getComputedStyle(document.getElementById('spelVideoEigen'), '::after').content,
    status: (document.getElementById('sch-status') || {}).textContent, knop: (document.getElementById('sch-video') || {}).getAttribute ? document.getElementById('sch-video').getAttribute('aria-label') : null } }"""
TEKST = {
 'nl': dict(webcam='📹 Webcam', ziet='Je vriend ziet je.', label='"Je vriend ziet je"', groter='Camerabeeld groter', kleiner='Camerabeeld weer kleiner', uit='Webcam uitzetten',
            balk=['Bord', 'Compact', 'Hele breedte'], menu=['Schaakinstellingen', 'Geluid van de stukken', 'Klassiek (standaard)', 'Houten bord', 'Punten per stuk', 'Beginnersstand (kinderen)', 'Glazen plaat'],
            noob=['Tip van de beginnersstand', 'Zet terugnemen', 'Toch spelen', 'Na deze zet kan je'], terug='Zet teruggenomen. Kies een veiligere zet.', vriend='♟ Tegen een vriend',
            lijst='Spelen tegen een vriend', uitnodigen='Uitnodigen ›', alleen=' (alleen tegen de computer)', mat='SCHAAKMAT', wint='😢 Schaakmat — Bram wint!', wintZwart='🎉 Schaakmat — Jij wint!',
            vreemd=['Webcam on', 'Board', 'Full width', 'Sound theme', 'Points per piece', 'Noob', 'Glass', 'CHECKMATE', 'Friend', 'Invite', 'computer games only']),
 'en': dict(webcam='📹 Webcam', ziet='Your friend can see you.', label='"Visible to friend"', groter='Show larger camera view', kleiner='Restore camera view', uit='Turn webcam off',
            balk=['Board', 'Compact', 'Full width'], menu=['Chess settings', 'Sound theme', 'Classic (default)', 'Wooden board', 'Points per piece', 'Noob (kids) mode', 'Glass plate'],
            noob=['Noob mode tip', 'Cancel move', 'Play anyway', 'After this move, your'], terug='Move cancelled. Choose a safer move.', vriend='♟ Friend',
            lijst='Play against a friend', uitnodigen='Invite ›', alleen=' (computer games only)', mat='CHECKMATE', wint='😢 Checkmate — Bram wins!', wintZwart='🎉 Checkmate — You win!',
            vreemd=['Webcam aan', 'Bord', 'Hele breedte', 'Geluid van', 'Punten per', 'Beginners', 'Glazen', 'SCHAAKMAT', 'Tegen een vriend', 'Uitnodigen', 'alleen tegen']),
}
def toestel(br, uid, taal, sleutels, posts):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, permissions=['camera', 'microphone'])
    ctx.route('**/*supabase.co/**', rest(uid, sleutels, posts))
    ctx.route_web_socket('**/realtime/v1/websocket**', ws)
    ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    pg = ctx.new_page(); volg(pg, NAAM[uid])
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("([t, taal]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', taal) }", [token(uid), taal])
    sleutels[uid] = pg.evaluate("""async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }""", uid)
    return ctx, pg

try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        for taal in TALEN:
            t = TEKST[taal]
            print('--- %s ---' % taal, flush=True)
            # ======== A. samen in de echte chat.html ========
            RT['uit'].clear(); sleutels, postsM, postsB = {}, [], []
            cm, m = toestel(br, MARCEL, taal, sleutels, postsM); cb, b = toestel(br, BRAM, taal, sleutels, postsB)
            for pg in (m, b):
                pg.goto(BASIS + 'chat.html')
                if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", 15000): klik(pg, '#vriendenLijst .vriend-item')
            m.wait_for_timeout(1500)
            sessie = m.evaluate("Date.now().toString(36)")
            for pg in (m, b): ev(pg, "([s, n, u]) => { window.speelMee(s, n, u) }", ['schaken', sessie, MARCEL])
            KLAAR = "() => !!document.querySelector('#sch-bord [data-r]') && !!document.getElementById('sch-video')"
            ok = [wacht(m, KLAAR, 10000), wacht(b, KLAAR, 10000)]
            knop = ev(m, "document.getElementById('sch-video') && document.getElementById('sch-video').textContent")
            check('%s A1 schaken samen in de chat: twee borden, webcamknop "%s"' % (taal, t['webcam']), ok == [True, True] and knop == t['webcam'], (ok, knop))
            gesprek = wacht(m, "() => (window.__pcsOk = [...document.querySelectorAll('audio')].some(a => a.srcObject && a.srcObject.getAudioTracks().length))", 30000)
            check('%s A2 het spelgesprek komt vanzelf (geluid van de ander binnen)' % taal, gesprek, [x[1] for x in RT['uit'] if x[1] not in ('ping',)][:8])
            m.wait_for_timeout(1500)
            klik(m, '#sch-video')
            a3 = wacht(b, "() => { const r = document.getElementById('remoteMedia'); return r && r.videoWidth > 0 && document.getElementById('spelOverlay').classList.contains('sch-video-modus') }", 20000)
            vm, vb = ev(m, VIDEO), ev(b, VIDEO)
            check('%s A3 webcam aan bij Marcel: eigen beeld, en Bram ziet Marcel' % taal, a3 and isinstance(vm, dict) and vm['eigen'] == 1 and vm['eigenZicht'] and vb['anderZicht'], (a3, vb, vm))
            a4 = wacht(m, "() => document.getElementById('spelVideoEigen').classList.contains('is-seen')", 15000)
            m.wait_for_timeout(300); vm = ev(m, VIDEO)
            check('%s A4 bevestiging: groene rand, "%s" en het label %s' % (taal, t['ziet'], t['label']), a4 and vm['status'] == t['ziet'] and vm['label'] == t['label'] and vm['knop'] == t['uit'], vm)
            klik(b, '#sch-video')
            a5a = wacht(m, "() => { const r = document.getElementById('remoteMedia'); return r && r.videoWidth > 0 }", 20000)
            klik(m, '#sch-video'); b.wait_for_timeout(2500)
            a5b = wacht(b, "() => { const r = document.getElementById('remoteMedia'); return !r.srcObject || getComputedStyle(r).display === 'none' || !r.srcObject.getVideoTracks().some(t => t.readyState === 'live' && !t.muted) }", 12000)
            vm, vb = ev(m, VIDEO), ev(b, VIDEO)
            check('%s A5 Bram ook aan: Marcel ziet Bram; Marcel uit: bij Bram is zijn beeld weg, Bram blijft in videomodus' % taal, a5a and a5b and vm['eigen'] == 0 and vb['eigen'] == 1 and vb['modus'], (a5a, a5b, vm, vb))
            vak = '#spelVideoEigen'
            l0 = ev(b, "document.querySelector('%s').getAttribute('aria-label')" % vak)
            klik(b, vak, position={'x': 30, 'y': 30}); b.wait_for_timeout(300)
            l1 = ev(b, "[document.querySelector('%s').classList.contains('is-expanded'), document.querySelector('%s').getAttribute('aria-label')]" % (vak, vak))
            klik(b, vak, position={'x': 30, 'y': 30}); b.wait_for_timeout(300)
            l2 = ev(b, "document.querySelector('%s').classList.contains('is-expanded')" % vak)
            check('%s A6 tik op het camerabeeld: groter en terug, labels "%s" / "%s"' % (taal, t['groter'], t['kleiner']), l0 == t['groter'] and l1 == [True, t['kleiner']] and l2 is False, (l0, l1, l2))
            klik(m, '#sch-bord [data-r="6"][data-k="4"]'); klik(m, '#sch-bord [data-r="4"][data-k="4"]')
            zet = wacht(b, "() => (document.querySelector('#sch-bord [data-r=\"4\"][data-k=\"4\"]').getAttribute('aria-label') || '').includes(%r)" % ('witte pion' if taal == 'nl' else 'white pawn'), 8000)
            check('%s A7 een zet komt aan bij Bram, met camera\'s aan' % taal, zet, ev(b, "document.querySelector('#sch-bord [data-r=\"4\"][data-k=\"4\"]').getAttribute('aria-label')"))
            ev(b, "window.sluitSpel()"); b.wait_for_timeout(1500)
            a8 = ev(b, "() => { const l = document.getElementById('lokaalMedia'); const lev = l && l.srcObject ? l.srcObject.getVideoTracks().filter(t => t.readyState === 'live').length : 0; return [document.getElementById('spelOverlay').classList.contains('sch-video-modus'), document.getElementById('spelOverlay').classList.contains('chess-media-layout'), lev] }")
            check('%s A8 spel dicht: geen videomodus, geen layout, camera uit' % taal, a8 == [False, False, 0], a8)
            oud = (lambda n: ''.join('0123456789abcdefghijklmnopqrstuvwxyz'[(n // 36 ** i) % 36] for i in range(8))[::-1].lstrip('0'))(int(sessie, 36) - 60000)
            ev(b, "([s, n, u]) => { window.speelMee(s, n, u) }", ['schaken', oud, MARCEL]); b.wait_for_timeout(1200)
            check('%s A9 een oudere uitnodiging opent geen spel meer' % taal, ev(b, "document.getElementById('spelOverlay').classList.contains('open')") is False, oud)
            cm.close(); cb.close()
            # ======== B. spel.html tegen de computer ========
            sleutels, posts = {}, []
            cs, s = toestel(br, MARCEL, taal, sleutels, posts)
            s.add_init_script("try { localStorage.setItem('fibro_chess_settings_v1', JSON.stringify({ thinking: 0, pointsPerPiece: true, noobMode: true, board: 'glass' })) } catch (e) {}")
            s.goto(BASIS + 'spel.html?spel=schaken'); s.wait_for_timeout(1200)
            vk = ev(s, "(document.getElementById('vriendKnop') || {}).textContent")
            s.evaluate("(() => { const b = [...document.querySelectorAll('button')].find(b => /^(Makkelijk|Easy)$/.test(b.textContent.trim())); if (b) b.click() })()")
            wacht(s, "!!document.querySelector('#sch-bord [data-r]')", 10000); s.wait_for_timeout(400)
            balk = ev(s, "document.querySelector('.sch-board-tools').innerText")
            check('%s B1 werkbalk %s, geen webcamknop tegen de computer' % (taal, t['balk']), isinstance(balk, str) and all(w.upper() in balk.upper() for w in t['balk']) and ev(s, "!document.getElementById('sch-video')"), balk.replace('\n', ' | ') if isinstance(balk, str) else balk)
            klik(s, '.sch-settings'); s.wait_for_timeout(300)
            r = ev(s, "(() => { const r = document.getElementById('sch-menu').getBoundingClientRect(); return [r.top, r.bottom, innerHeight, document.getElementById('sch-menu').hidden] })()")
            mt = ev(s, "document.getElementById('sch-menu').textContent")
            mis = [w for w in t['menu'] if w not in mt]
            check('%s B2 schuifjes: instellingen helemaal in beeld met de nieuwe onderdelen' % taal, r[3] is False and r[0] >= 0 and r[1] <= r[2] and not mis, (r, mis))
            ev(s, "() => { const sel = document.getElementById('sch-sound-theme'); sel.value = 'wood'; sel.dispatchEvent(new Event('change')) }")
            glas = ev(s, "[document.getElementById('sch-bord').classList.contains('sch-board-glass'), document.querySelector('.sch-frame').classList.contains('sch-frame-glass'), JSON.parse(localStorage.getItem('fibro_chess_settings_v1')).soundTheme]")
            klik(s, '#sch-status'); s.wait_for_timeout(200)
            # B4: beginnersstand: 1. e4 (de computer antwoordt), dan Bf1-a6: daar slaan de pion b7 en het paard b8
            klik(s, '#sch-bord [data-r="6"][data-k="4"]'); klik(s, '#sch-bord [data-r="4"][data-k="4"]')
            wacht(s, "() => document.querySelector('#sch-status').textContent.trim() === %r" % ('Jouw beurt' if taal == 'nl' else 'Your turn'), 12000)
            s.wait_for_timeout(300)
            voor = ev(s, "[...document.querySelectorAll('#sch-bord [data-r]')].map(x => x.getAttribute('aria-label')).join('|')")
            klik(s, '#sch-bord [data-r="7"][data-k="5"]'); klik(s, '#sch-bord [data-r="2"][data-k="0"]'); s.wait_for_timeout(300)
            vraag = ev(s, "!document.getElementById('sch-noob-dialog').hidden")
            dt = ev(s, "document.getElementById('sch-noob-dialog').innerText")
            if vraag: klik(s, '#sch-noob-cancel'); s.wait_for_timeout(300)
            na = ev(s, "[...document.querySelectorAll('#sch-bord [data-r]')].map(x => x.getAttribute('aria-label')).join('|')")
            check('%s B4 beginnersstand: vraag %s; terugnemen = geen zet' % (taal, t['noob'][:3]), vraag and isinstance(dt, str) and all(w in dt for w in t['noob']) and voor == na and ev(s, "document.querySelector('#sch-status').textContent") == t['terug'], (vraag, dt))
            # B3: punten per stuk: speel tot er iets geslagen is is lastig; teken de geslagen stukken via een echte slag van de computer niet nodig:
            # kijk naar de opmaak bij een slag in de samen-proef (C); hier: instelling bewaard + glas + hout
            check('%s B3 glazen plaat (bord en lijst) en houten geluid bewaard, zonder fout' % taal, glas == [True, True, 'wood'], glas)
            # B5: knop 'Tegen een vriend'
            s.goto(BASIS + 'spel.html?spel=schaken'); s.wait_for_timeout(1000)
            klik(s, '#vriendKnop'); wacht(s, "() => !!document.querySelector('.vriend-rij')", 8000)
            kaart = ev(s, "document.querySelector('.vriend-kaart').innerText")
            RT['uit'].clear()
            url = ''
            try:
                with s.expect_request(lambda rq: 'chat.html' in rq.url, timeout=8000) as rq: klik(s, '.vriend-rij')
                url = rq.value.url
            except Exception: pass
            s.wait_for_timeout(300)
            q = dict(re.findall(r'[?&]([^=&]+)=([^&]*)', url))   # (chat.html haalt de vraag daarna zelf uit de adresbalk)
            uitn = [x for x in RT['uit'] if x[1] == 'speluitnodiging']
            pl = uitn[0][2] if uitn else {}
            check('%s B5 "%s": lijst met Bram, uitnodigen = broadcast + spelinvite-bericht + naar chat.html' % (taal, t['vriend']),
                  vk == t['vriend'] and isinstance(kaart, str) and t['lijst'] in kaart and 'Bram' in kaart and t['uitnodigen'] in kaart
                  and uitn and uitn[0][0] == 'realtime:speluitnodiging-' + BRAM and pl.get('spelType') == 'schaken' and pl.get('van') == MARCEL
                  and posts and posts[-1].get('content') == 'spelinvite:schaken:%s:%s' % (MARCEL, pl.get('sessieId')) and posts[-1].get('receiver_id') == BRAM
                  and 'chat.html' in url and q.get('spelVriend') == BRAM and q.get('spelType') == 'schaken' and q.get('sessieId') == pl.get('sessieId') and q.get('starterId') == MARCEL,
                  (vk, (kaart or '').replace('\n', ' | ')[:90], uitn[:1], posts[-1:], url[-120:]))
            cs.close()
            # ======== C. samen via de proefpagina ========
            # zonder beweging (reduced motion): een tabblad op de achtergrond laat zijn animaties anders liggen
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True, reduced_motion='reduce')
            ctx.add_init_script("try { localStorage.setItem('fibro_taal', '%s'); localStorage.setItem('fibro_chess_settings_v1', JSON.stringify({ exaggerate: true, showAttackRoutes: true, noobMode: true, pointsPerPiece: true })) } catch (e) {}" % taal)
            wit = ctx.new_page(); zwart = ctx.new_page(); volg(wit, 'wit'); volg(zwart, 'zwart')
            wit.goto(BASIS + 'schaaksamen.html?rol=wit&kamer=' + taal); zwart.goto(BASIS + 'schaaksamen.html?rol=zwart&kamer=' + taal)
            wacht(wit, 'window.__klaar === true', 10000); wacht(zwart, 'window.__klaar === true', 10000)
            c1 = ev(wit, "[document.getElementById('sch-exaggerate').disabled, document.getElementById('sch-exaggerate').checked, document.getElementById('sch-noob-mode').disabled, document.getElementById('sch-noob-mode').checked, document.getElementById('sch-exaggerate-wrap').textContent, document.getElementById('sch-noob-mode').closest('label').textContent]")
            check('%s C1 tegen een vriend: Extra duidelijk en beginnersstand uit, met "%s"' % (taal, t['alleen'].strip()), isinstance(c1, list) and c1[:4] == [True, False, True, False] and c1[4].endswith(t['alleen']) and c1[5].endswith(t['alleen']), c1)
            def zet(pg, a, b_): klik(pg, '#sch-bord [data-r="%d"][data-k="%d"]' % a); klik(pg, '#sch-bord [data-r="%d"][data-k="%d"]' % b_); pg.wait_for_timeout(900)
            zet(wit, (6, 4), (4, 4)); zet(zwart, (1, 3), (3, 3)); zet(wit, (4, 4), (3, 3))   # e4 d5 exd5: punten per stuk
            pps = ev(zwart, "document.querySelector('#sch-tegenstander .sch-vangst-waarde') && document.querySelector('#sch-tegenstander .sch-vangst-waarde').textContent")
            ppsl = ev(zwart, "document.querySelector('#sch-tegenstander .sch-vangst-stukken').getAttribute('aria-label')")
            check('%s B3b punten per stuk: "1" bij de geslagen pion, label met punt' % taal, pps == '1' and ('pion, 1 punt' if taal == 'nl' else 'pawn, 1 point') in (ppsl or ''), (pps, ppsl))
            # snelmat met wit als verliezer: f3 e5 g4 Qh4# (zwart wint) -> opnieuw beginnen
            ev(wit, "() => { const b = document.getElementById('sch-opnieuw'); b.style.display = 'block'; b.click() }"); wit.wait_for_timeout(800)
            zet(wit, (6, 5), (5, 5)); zet(zwart, (1, 4), (3, 4)); zet(wit, (6, 6), (4, 6)); zet(zwart, (0, 3), (4, 7))
            mw = ev(wit, "[!document.getElementById('sch-checkmate').hidden, document.getElementById('sch-checkmate').innerText.trim(), document.getElementById('sch-status').textContent]")
            mz = ev(zwart, "[!document.getElementById('sch-checkmate').hidden, document.getElementById('sch-status').textContent]")
            wit.wait_for_timeout(3300)
            weg = ev(wit, "document.getElementById('sch-checkmate').hidden")
            check('%s C2 snelmat: "%s" groot in beeld, status "%s" / "%s", na 3 s weg' % (taal, t['mat'], t['wint'], t['wintZwart']), mw == [True, t['mat'], t['wint']] and mz == [True, t['wintZwart']] and weg is True, (mw, mz, weg))
            alles = ev(wit, "document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label],[title]')].map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' ')")
            vreemd = [w for w in t['vreemd'] if w in alles]
            check('%s C3 geen woorden uit de andere taal (tekst, labels, menu)' % taal, not vreemd, vreemd)
            ctx.close()
        br.close()
finally:
    srv.terminate()
# ======== D. de code ========
chat = open(os.path.join(MAP, 'chat.html'), encoding='utf-8').read()
blok = chat[chat.find('initBellen(huidigeUser.id'):]; blok = blok[:blok.find('\n    })\n')]
check('D1 een onEind in initBellen (een tweede zou de eerste overschrijven)', blok.count('onEind:') == 1, blok.count('onEind:'))
nrs = {}
for root, _, files in os.walk(MAP):
    if '/tests' in root.replace(MAP, ''): continue
    for f in files:
        if f.endswith(('.html', '.js')):
            for n, v in re.findall(r'(bellen|bordgeluid|speluitnodiging|bel-luisteraar|schaken-ui|solo)\.js\?v=(\d+)', open(os.path.join(root, f), encoding='utf-8', errors='ignore').read()):
                nrs.setdefault(n, set()).add(v)
check('D2 elk gewijzigd bestand overal hetzelfde nieuwe nummer', all(len(v) == 1 for v in nrs.values()) and all(int(next(iter(v))) >= 197 for v in nrs.values()), nrs)
sw = open(os.path.join(MAP, 'service-worker.js'), encoding='utf-8').read()
check('D3 CACHE_VERSION ongewijzigd (fibro-v31: de ?v= regelen het, geen volle kast opnieuw)', "CACHE_VERSION = 'fibro-v31'" in sw, re.findall(r"CACHE_VERSION = '[^']+'", sw))
check('E geen paginafouten, geen ontbrekende vertaling', not fouten and not taalfout, (fouten[:3], taalfout[:3]))
goed = sum(uitslag)
print('UITSLAG proef93: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
