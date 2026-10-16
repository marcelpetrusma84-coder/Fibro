# proef67: de chatbalk in een spel (emoji's en een invoervak) alleen bij de beurtspellen (v169), echte chat.html.
# Per spel: chat met een vriend open, window.speelMee(spel, sessie, ik), dan kijken of #spelChatWrap er is, en
# sluitSpel(true). Beurtspellen (boter-kaas-en-eieren, vier op een rij, schaken, dammen): wel een balk; de andere
# zeven (pong, flapper, block it, the swarm, runner & gunner, ghost tag, twin snakes): geen balk.
# Bij een beurtspel: een emoji-knop stuurt 'spelchat' over het spelkanaal en verschijnt in beeld.
# Oude map als controle: daar hebben alle spellen een balk (7 MIS).
# python3 -I proef67.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
_NAMEN = ['Tranen van het lachen', 'Ssst', 'Slaap lekker', 'Kapot', 'Huilen', 'Verliefd', 'Boos', 'Geschrokken', 'Offline', 'Druk', 'Spookje', 'Sluw']
_NAMEN_EN = ['Tears of joy', 'Shh', 'Sleep tight', 'Exhausted', 'Crying', 'In love', 'Angry', 'Shocked', 'Offline', 'Busy', 'Spooked', 'Sly']
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''))
staat = {'pub': None, 'posts': [], 'rijen': []}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'POST':
        staat['posts'].append(json.loads(route.request.post_data or '{}'))
        return route.fulfill(status=201, json={"id": "mnieuw%d" % len(staat['posts'])})
    if '/rest/v1/messages' in u and m == 'GET':
        return route.fulfill(status=200, json=[{'id': 'm%02d' % i, 'sender_id': FID, 'receiver_id': UID, 'content': c, 'created_at': '2026-10-16T00:%02d:00.000Z' % i,
                                                'expires_at': '2026-11-15T00:00:00.000Z', 'antwoord_op': None} for i, c in enumerate(staat['rijen'])][::-1])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}; vriend = {"id": FID, "username": "flamingo", "avatar_url": "\U0001F9A9", "public_key": staat['pub']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
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
BEURT = ['botkaaseiren', 'vieroprij', 'schaken', 'dammen']
SNEL = ['pong', 'flappybird', 'breakout', 'swarm', 'endlessrunner', 'pacman', 'pinball']  # (Space Invaders is nog niet speelbaar)
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa)
    verstuurd = []
    def ws(w):  # nep-Realtime: alles beantwoorden met ok, 'spelchat' onthouden
        def bericht(m):
            if isinstance(m, (bytes, bytearray)):
                if b'spelchat' in m: verstuurd.append({'tekst': 'binair'})
                return
            if 'spelchat' in m and '"tekst"' in m: verstuurd.append({'tekst': 'ws'})
            try: a = json.loads(m)
            except Exception: return
            if isinstance(a, list) and len(a) == 5:
                w.send(json.dumps([a[0], a[1], a[2], 'phx_reply', {'status': 'ok', 'response': {}}]))
        w.on_message(bericht)
    ctx.route_web_socket('**/realtime/v1/websocket**', ws)
    def http_broadcast(route):  # zonder lijn stuurt realtime-js een broadcast via http
        if 'spelchat' in (route.request.post_data or ''): verstuurd.append({'tekst': 'http'})
        return route.fulfill(status=202, body='')
    ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:200])); p.on('dialog', lambda d: d.dismiss())
    def ev(js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:100]
    p.goto(BASIS + 'manifest.json')
    p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", TOKEN)
    staat['pub'] = p.evaluate("""async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); const v = await c.genereerKeypair();
      c.slaPrivateKeyOp(uid, ik.privateKeyB64); return v.publicKeyB64 }""", UID)
    p.goto(BASIS + 'chat.html')
    try: p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000); p.click('#vriendenLijst .vriend-item')
    except Exception: pass
    p.wait_for_timeout(1500)
    uitkomst = {}
    for k, spel in enumerate(BEURT + SNEL):
        ev("([s, n, u]) => { window.speelMee(s, n, u) }", [spel, 'sessie%d' % k, UID])
        p.wait_for_timeout(2500)
        uitkomst[spel] = [ev("() => !!document.getElementById('spelChatWrap')"), ev("() => document.getElementById('spelOverlay').classList.contains('open')")]
        if spel == 'botkaaseiren':
            try: p.locator('#spelChatWrap button').first.click(timeout=3000)
            except Exception: pass
            p.wait_for_timeout(800)
            gezien = ev("() => { const l = document.getElementById('spelChatLaag'); return l ? l.textContent : '' }")
            check('boter-kaas-en-eieren: emoji-knop stuurt spelchat en staat in beeld', any(isinstance(x, dict) and x.get('tekst') for x in verstuurd) and gezien, (verstuurd[:2], gezien))
        ev("() => window.sluitSpel(true)"); p.wait_for_timeout(600)
    for spel in BEURT:
        check('beurtspel %s: chatbalk er wel' % spel, uitkomst[spel] == [True, True], uitkomst[spel])
    for spel in SNEL:
        check('snel spel %s: geen chatbalk (spel wel open)' % spel, uitkomst[spel] == [False, True], uitkomst[spel])
    check('na sluiten geen balk meer over', ev("() => !document.getElementById('spelChatWrap')") is True, '')
    print('   paginafouten (ter info, nep-server):', fouten[:3])
    br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
