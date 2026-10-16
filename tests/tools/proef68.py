# proef68: stickers in een beurtspel (v170), echte chat.html met een nep-Realtime-server, boter-kaas-en-eieren:
# A. de balk: geen emoji-knoppen meer, wel een stickerknop en het invoervak.
# B. sticker sturen: knop -> stickerkeuze, echte klik op een sticker -> 'spelsticker' { code } over het spelkanaal,
#    groot midden in beeld (met beweging en geluid), keuze dicht, knop dicht (per beurt een).
# C. nog een keer: de keuze gaat niet open. Na een eigen zet (echte klik op het bord) mag het weer.
# D. van de vriend: een sticker komt groot in beeld; een tweede in dezelfde beurt telt niet; na zijn zet weer wel.
# E. na 2,5 s is de sticker weg; tekst sturen werkt nog; bij sluiten niets over.
# Oude map als controle: daar zijn er emoji's en geen stickers (bijna alles MIS).
# python3 -I proef68.py <map>
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
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa)
    ctx.add_init_script(TELLER)
    rt = {'w': None, 'topics': {}, 'uit': []}
    def ws(w):  # nep-Realtime: joins beantwoorden, verstuurde broadcasts onthouden
        rt['w'] = w
        def bericht(m):
            if isinstance(m, (bytes, bytearray)):
                b = bytes(m)
                try:
                    if b[0] != 3: return
                    lj, lr, lt, le, lm, cod = b[1], b[2], b[3], b[4], b[5], b[6]; i = 7 + lj + lr
                    topic = b[i:i + lt].decode(); i += lt; ev_ = b[i:i + le].decode(); i += le + lm
                    rt['uit'].append((topic, ev_, json.loads(b[i:].decode() or '{}') if cod == 1 else None))
                except Exception: pass
                return
            try: jr, ref, topic, event, payload = json.loads(m)
            except Exception: return
            if event == 'phx_join':
                rt['topics'][topic] = jr
                pg = [dict(f, id=k + 1) for k, f in enumerate(((payload or {}).get('config') or {}).get('postgres_changes') or [])]
                w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {'postgres_changes': pg}}])); return
            if event == 'broadcast': rt['uit'].append((topic, (payload or {}).get('event'), (payload or {}).get('payload')))
            if ref: w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {}}]))
        w.on_message(bericht)
    ctx.route_web_socket('**/realtime/v1/websocket**', ws)
    def http_broadcast(route):
        try:
            for m in (json.loads(route.request.post_data or '{}').get('messages') or []): rt['uit'].append((m.get('topic'), m.get('event'), m.get('payload')))
        except Exception: pass
        return route.fulfill(status=202, body='')
    ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    def binnen(event, payload):  # een broadcast van de vriend
        t = next((t for t in rt['topics'] if t.startswith('realtime:spel_')), None)
        if t and rt['w']: rt['w'].send(json.dumps([rt['topics'][t], None, t, 'broadcast', {'type': 'broadcast', 'event': event, 'payload': payload}]))
        return t
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
    ev("([s, n, u]) => { window.speelMee(s, n, u) }", ['botkaaseiren', 'sessie1', UID]); p.wait_for_timeout(2500)
    GROOT = "() => { const g = document.getElementById('spelStickerGroot'); if (!g) return null; const i = g.querySelector('img'), r = g.getBoundingClientRect();  /* het vak (de beweging zit op het plaatje) */ return [i.getAttribute('src'), Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), Math.round(r.width)] }"
    def stickers_uit(): return [x for x in rt['uit'] if x[1] == 'spelsticker']
    # A
    balk = ev("() => { const w = document.getElementById('spelChatWrap'); if (!w) return null; return [[...w.querySelectorAll('button')].map(b => b.textContent), !!w.querySelector('input'), !!document.getElementById('spelStickerKnop')] }")
    check('A. geen emoji-knoppen, wel een stickerknop en het invoervak', isinstance(balk, list) and balk[2] and balk[1] and not any(t in ('\U0001F44D', '\U0001F602', '\U0001F389') for t in balk[0]), balk)
    # B
    try: p.click('#spelStickerKnop', timeout=3000)
    except Exception: pass
    p.wait_for_timeout(400)
    open_ = ev("() => { const k = document.getElementById('spelStickerPaneel'); return k ? [k.style.display, k.querySelectorAll('.sk-sticker').length] : null }")
    check('B. de stickerkeuze gaat open (met stickers)', isinstance(open_, list) and open_[0] == 'block' and open_[1] >= 12, open_)
    try: p.click('#spelStickerPaneel .sk-vak[data-vak="f3"]', timeout=3000); p.wait_for_timeout(200); p.locator('#spelStickerPaneel .sk-sticker').nth(10).click(timeout=3000)
    except Exception: pass
    geluid0 = ev("window.__fxosc || 0"); p.wait_for_timeout(700)
    g = ev(GROOT)
    check("B. 'spelsticker' f3-11 over het spelkanaal", [x[2] for x in stickers_uit()] == [{'code': 'f3-11'}], stickers_uit())
    check('B. groot midden in beeld (195 +- 10, 422 +- 30)', isinstance(g, list) and g[0] == 'stickers/f3/11.webp' and abs(g[1] - 195) <= 10 and abs(g[2] - 422) <= 30 and g[3] >= 150, g)
    check('B. met geluid', isinstance(ev("window.__fxosc || 0"), int) and ev("window.__fxosc || 0") > 0, ev("window.__fxosc || 0"))
    check('B. keuze dicht en de knop dicht', ev("() => [document.getElementById('spelStickerPaneel').style.display, document.getElementById('spelStickerKnop').disabled]") == ['none', True], '')
    # C
    try: p.click('#spelStickerKnop', timeout=1500, force=True)
    except Exception: pass
    p.wait_for_timeout(300)
    check('C. nog een keer: de keuze gaat niet open', ev("() => document.getElementById('spelStickerPaneel').style.display") == 'none', '')
    try: p.locator('#bke-bord > div').nth(0).click(timeout=3000)
    except Exception as e: print('   klik bord:', str(e)[:80])
    p.wait_for_timeout(500)
    check('C. na mijn zet (echte klik op het bord) mag het weer', any(x[1] == 'zet' for x in rt['uit']) and ev("() => document.getElementById('spelStickerKnop').disabled") is False, [x[1] for x in rt['uit']][-4:])
    # D
    p.wait_for_timeout(2600)
    check('E. na 2,5 s is mijn sticker weg', ev(GROOT) is None, ev(GROOT))
    binnen('spelsticker', {'code': 'f1-07'}); p.wait_for_timeout(800)
    g = ev(GROOT)
    check('D. sticker van de vriend groot in beeld', isinstance(g, list) and g[0] == 'stickers/f1/07.webp', g)
    p.wait_for_timeout(3200)
    binnen('spelsticker', {'code': 'f1-08'}); p.wait_for_timeout(800)
    check('D. een tweede in dezelfde beurt telt niet', ev(GROOT) is None, ev(GROOT))
    binnen('zet', {'i': 4, 'symbool': 'O'}); p.wait_for_timeout(500)
    binnen('spelsticker', {'code': 'f2-11'}); p.wait_for_timeout(800)
    g = ev(GROOT)
    check('D. na zijn zet weer wel', isinstance(g, list) and g[0] == 'stickers/f2/11.webp', g)
    binnen('spelsticker', {'code': '../x'}); p.wait_for_timeout(300)
    # E
    try:
        p.fill('#spelChatWrap input', 'goed gespeeld'); p.press('#spelChatWrap input', 'Enter')
    except Exception: pass
    p.wait_for_timeout(500)
    check('E. tekst sturen werkt nog', any(x[1] == 'spelchat' and (x[2] or {}).get('tekst') == 'goed gespeeld' for x in rt['uit']), [x[1] for x in rt['uit']][-3:])
    ev("() => window.sluitSpel(true)"); p.wait_for_timeout(600)
    check('E. na sluiten geen balk en geen sticker meer', ev("() => !document.getElementById('spelChatWrap') && !document.getElementById('spelStickerGroot')") is True, '')
    check('geen fouten op de pagina', fouten == [], fouten[:3])
    br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
