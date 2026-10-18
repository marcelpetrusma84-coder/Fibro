# proef56: stickervel 1 (v156) in de echte chat.html: 12 stickers in vakje 1, de plaatjes laden (384 x 384, WebP),
# de namen kloppen (NL en EN), elke sticker heeft een bestaande beweging en een geluid, versturen = fxsticker:f1-NN
# (versleuteld) met geluid, en een binnenkomende sticker beweegt. Vakje 1 toont de eerste sticker.
# Oude map als controle: daar is vel 1 leeg (bijna alles MIS).
# python3 -I proef56.py <map>     (FOTO=<map> maakt een schermafbeelding van de keuze)
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
# v181: binnenkomende berichten versleuteld zoals in het echt (nepslot.py); zonder slot toont de chat geen sticker meer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nepslot; NEP = nepslot.Nep(MAP, UID, FID)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NAMEN = ['Tranen van het lachen', 'Ssst', 'Slaap lekker', 'Kapot', 'Huilen', 'Verliefd', 'Boos', 'Geschrokken', 'Offline', 'Druk', 'Spookje', 'Sluw']
NAMEN_EN = ['Tears of joy', 'Shh', 'Sleep tight', 'Exhausted', 'Crying', 'In love', 'Angry', 'Shocked', 'Offline', 'Busy', 'Spooked', 'Sly']
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
        return route.fulfill(status=200, json=[{'id': 'm%02d' % i, 'sender_id': FID, 'receiver_id': UID, 'content': NEP.inhoud(FID, c, '2026-10-16T00:%02d:00.000Z' % i), 'created_at': '2026-10-16T00:%02d:00.000Z' % i,
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
    def ev(p, js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:100]
    def chat(taal):
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(TELLER)
        p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:200]))
        p.goto(BASIS + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l) }", [TOKEN, taal])
        p.evaluate("([u, k]) => localStorage.setItem('fibro_privkey_' + u, k)", [UID, NEP.ik.priv]); staat['pub'] = NEP.vriend.pub
        p.goto(BASIS + 'chat.html')
        try: p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000); p.click('#vriendenLijst .vriend-item')
        except Exception: pass
        p.wait_for_timeout(1500)
        ev(p, "() => { toggleStickers(); const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\"f1\"]'); if (v) v.click() }"); p.wait_for_timeout(500)
        return ctx, p
    LIJST = "() => [...document.querySelectorAll('#stickerGrid .sk-sticker')].map(b => b.getAttribute('aria-label'))"
    staat['rijen'] = ['fxsticker:f1-07']
    ctx, p = chat('nl')
    namen = ev(p, LIJST)
    check('vakje 1: 12 stickers met de goede namen', namen == ['Stuur sticker ' + n for n in NAMEN], namen)
    maten = ev(p, "() => Promise.all([...document.querySelectorAll('#stickerGrid .sk-sticker img')].map(i => i.decode().then(() => [i.naturalWidth, i.naturalHeight, i.getAttribute('src')], () => null)))")
    check('alle 12 plaatjes laden: 384 x 384, stickers/f1/NN.webp', isinstance(maten, list) and len(maten) == 12 and all(m and m[:2] == [384, 384] and m[2] == 'stickers/f1/%02d.webp' % (i + 1) for i, m in enumerate(maten)), maten)
    ico = ev(p, "() => { const i = document.querySelector('#stickerGrid .sk-vak[data-vak=\"f1\"] img'); return i ? i.getAttribute('src') : null }")
    check('vakje 1 toont de eerste sticker', ico == 'stickers/f1/01.webp', ico)
    hel = ev(p, "() => { const i = document.querySelector('#stickerGrid .sk-inhoud'); return i ? [i.scrollHeight, i.clientHeight, Math.round(document.getElementById('stickerGrid').getBoundingClientRect().height)] : null }")
    check('het hele vel (3 rijen) past zonder schuiven, keuze niet te hoog', isinstance(hel, list) and hel[0] <= hel[1] + 1 and hel[2] < 380, hel)
    fx = ev(p, """async () => { const v = await import('./stickervellen.js?v=161'); const f = await import('./stickerfx.js?v=161');
      return v.FIBRO_VELLEN[0].stickers.map(s => [s.nr, !!f.BEWEGINGEN[s.b] && s.b !== 'geen', !!f.GELUIDEN[s.g] && s.g !== 'geen', s.naam[1]]) }""")
    check('elke sticker: een bestaande beweging en een geluid, Engelse naam', isinstance(fx, list) and len(fx) == 12 and all(x[1] and x[2] for x in fx) and [x[3] for x in fx] == NAMEN_EN, fx)
    check('Ssst heeft zijn eigen geluid (ssst, v161)', ev(p, "async () => (await import('./stickervellen.js?v=161')).zoekSticker('f1-02').g") == 'ssst', '')
    binnen = ev(p, "() => { const i = document.querySelector('#messages .fx-sticker'); return i ? [i.getAttribute('src'), i.alt] : null }")
    check('binnengekomen sticker (Boos) staat in de chat', binnen == ['stickers/f1/07.webp', 'Boos'], binnen)
    if FOTO: p.screenshot(path=FOTO + '/vel1-in-chat.png')
    voor = ev(p, "window.__fxosc || 0")
    ev(p, "() => document.querySelectorAll('#stickerGrid .sk-sticker')[4].click()"); p.wait_for_timeout(1200)
    na = ev(p, "window.__fxosc || 0")
    cache = ev(p, "u => localStorage.getItem('fibro_msg_cache_' + u) || ''", UID)
    inhoud = str((staat['posts'][-1] if staat['posts'] else {}).get('content', ''))
    check('Huilen versturen: geluid, fxsticker:f1-05, versleuteld', isinstance(na, int) and na > voor and '"fxsticker:f1-05"' in cache and inhoud.startswith('e2e:'), (voor, na, cache[-60:], inhoud[:20]))
    check('geen fouten (NL)', p.fouten == [], p.fouten)
    ctx.close()
    staat['rijen'] = []
    ctx, p = chat('en')
    namen = ev(p, LIJST)
    check('Engels: de namen', namen == ['Send sticker ' + n for n in NAMEN_EN], namen)
    check('geen fouten (EN)', p.fouten == [], p.fouten)
    ctx.close(); br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
