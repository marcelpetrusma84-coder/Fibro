# proef94: v198, melding van Tijn over de webcam bij schaken en het geluid van een gesprek. Twee ECHTE chat.html's
# (Marcel, Bram) met nep-camera en de nep-Realtime van proef93 (de infrastructuur hieronder is daaruit overgenomen).
#  A. de stap richting de vriend mislukt (createOffer gooit een fout bij Marcel): de camera gaat toch aan en het scherm
#     zegt dat ook: videomodus, eigen beeld, knop 'Webcam uitzetten', GEEN 'Je camera staat uit' of 'kon niet aan';
#     daarna weer uit (ook met de fout): camera echt uit, knop weer '📹 Webcam'
#  B. de browser houdt het geluid van de ander tegen (play() geeft NotAllowedError zonder tik, zoals op een iPhone):
#     er komt een knop '🔊 Tik hier voor geluid' (EN 'Tap here for sound'); een echte tik = geluid speelt, knop weg.
#     (Nagebootst via play(); het autoplay-attribuut speelt in de proefbrowser toch af, dus 'staat stil' wordt niet gemeten.)
#  C. zonder blokkade (zoals altijd): geen knop; spel dicht = geen knop over
#  D. geen paginafouten, geen ontbrekende vertaling
# Oude map (v197) als controle: A en B MIS.
# python3 -I proef94.py <map> [nl|en|alles]
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

FAAL_OFFER = "(() => { const o = RTCPeerConnection.prototype.createOffer; RTCPeerConnection.prototype.createOffer = function (...a) { if (window.__faalOffer && this.connectionState === 'connected') return Promise.reject(new Error('proef94: offer mislukt')); return o.apply(this, a) } })()"
BLOKKEER = """(() => { const p = HTMLMediaElement.prototype.play; window.__tik = false
  addEventListener('pointerdown', () => { window.__tik = true; setTimeout(() => { window.__tik = false }, 1000) }, true)
  HTMLMediaElement.prototype.play = function () {
    if (window.__blokkeer && this.srcObject && !this.muted && !window.__tik) return Promise.reject(new DOMException('play() failed because the user did not interact', 'NotAllowedError'))
    return p.apply(this, arguments) } })()"""
T94 = {'nl': dict(knop='🔊 Tik hier voor geluid', uit='Webcam uitzetten', aan='📹 Webcam', camUit='Je camera staat uit', mislukt='Je camera kon niet aan'),
       'en': dict(knop='🔊 Tap here for sound', uit='Turn webcam off', aan='📹 Webcam', camUit='Your camera is off', mislukt='Your camera could not be started')}
def start(br, taal):
    RT['uit'].clear(); sleutels = {}
    cm, m = toestel(br, MARCEL, taal, sleutels, []); cb, b = toestel(br, BRAM, taal, sleutels, [])
    for ctx in (cm, cb): ctx.add_init_script(FAAL_OFFER); ctx.add_init_script(BLOKKEER)
    return cm, m, cb, b
def open_schaken(m, b, blok=False):
    for pg in (m, b):
        pg.goto(BASIS + 'chat.html')
        if blok: pg.evaluate("window.__blokkeer = true")
        if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", 15000): klik(pg, '#vriendenLijst .vriend-item')
    m.wait_for_timeout(1200)
    if blok:
        for pg in (m, b): pg.evaluate("window.__blokkeer = true")
    sessie = m.evaluate("Date.now().toString(36)")
    for pg in (m, b): ev(pg, "([s, n, u]) => { window.speelMee(s, n, u) }", ['schaken', sessie, MARCEL])
    k = "() => !!document.getElementById('sch-video')"
    return wacht(m, k, 10000) and wacht(b, k, 10000) and wacht(m, "() => [...document.querySelectorAll('audio')].some(a => a.srcObject && a.srcObject.getAudioTracks().length)", 30000)
STAND = r"""() => { const l = document.getElementById('lokaalMedia'), v = document.getElementById('sch-video')
  return { live: l && l.srcObject ? l.srcObject.getVideoTracks().filter(t => t.readyState === 'live').length : 0,
    modus: document.getElementById('spelOverlay').classList.contains('sch-video-modus'), zicht: l && getComputedStyle(l).display !== 'none',
    wacht: !document.getElementById('spelVideoEigenWachten').hidden, knop: v && v.getAttribute('aria-label'), tekst: v && v.textContent,
    status: document.getElementById('sch-status').textContent } }"""
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        for taal in TALEN:
            t = T94[taal]; print('--- %s ---' % taal, flush=True)
            # A
            cm, m, cb, b = start(br, taal)
            ok = open_schaken(m, b)
            m.wait_for_timeout(1500); m.evaluate("window.__faalOffer = true")
            klik(m, '#sch-video'); m.wait_for_timeout(2500)
            s1 = ev(m, STAND)
            check('%s A1 stap naar de vriend mislukt: camera aan EN het scherm zegt aan ("%s")' % (taal, t['uit']),
                  ok and isinstance(s1, dict) and s1['live'] == 1 and s1['modus'] and s1['zicht'] and not s1['wacht'] and s1['knop'] == t['uit']
                  and t['camUit'] not in s1['status'] and t['mislukt'] not in s1['status'], (ok, s1))
            klik(m, '#sch-video'); m.wait_for_timeout(1500)
            s2 = ev(m, STAND)
            check('%s A2 weer uit (ook met de fout): camera echt uit, knop weer "%s"' % (taal, t['aan']),
                  isinstance(s2, dict) and s2['live'] == 0 and s2['tekst'] == t['aan'] and t['mislukt'] not in s2['status'], s2)
            # C: zonder blokkade geen knop
            c1 = ev(b, "!document.getElementById('fibroGeluidKnop')")
            check('%s C1 geluid niet tegengehouden: geen knop' % taal, c1 is True, c1)
            cm.close(); cb.close()
            # B
            cm, m, cb, b = start(br, taal)
            ok = open_schaken(m, b, blok=True)
            kn = wacht(b, "() => !!document.getElementById('fibroGeluidKnop')", 15000)
            tekst = ev(b, "(document.getElementById('fibroGeluidKnop') || {}).textContent")
            stil = ev(b, "document.getElementById('remoteAudio').paused")
            check('%s B1 geluid tegengehouden: knop "%s"' % (taal, t['knop']), ok and kn and tekst == t['knop'], (ok, kn, tekst, stil))
            klik(b, '#fibroGeluidKnop'); b.wait_for_timeout(800)
            na = ev(b, "[!!document.getElementById('fibroGeluidKnop'), document.getElementById('remoteAudio').paused]")
            check('%s B2 een tik: het geluid speelt en de knop is weg' % taal, na == [False, False], na)
            ev(b, "window.sluitSpel()"); b.wait_for_timeout(1500)
            check('%s C2 spel dicht: geen geluidsknop over' % taal, ev(b, "!document.getElementById('fibroGeluidKnop')") is True)
            cm.close(); cb.close()
        br.close()
finally:
    srv.terminate()
check('D geen paginafouten, geen ontbrekende vertaling', not [f for f in fouten if 'proef94' not in f] and not taalfout, (fouten[:3], taalfout[:3]))
goed = sum(uitslag)
print('UITSLAG proef94: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
