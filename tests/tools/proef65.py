# proef65: stickervel 4 (v166, moderne handgebaren) in de echte chat.html, naar proef64 (vel 3):
# 12 stickers in vakje 4 (NL/EN-namen, 384 x 384), eigen mp3 per sticker (bestaat, speelbaar, 0,5-2,6 s, -25 tot -18 dB,
# piek <= 0,9, samen < 400 kB, terug-geluid met code), na de eerste tik opgehaald, echte klik = mp3 + fxsticker:f4-12
# (versleuteld), binnenkomend Jij!, Profiel-blok 'Stickervel 4'; vel 1-3 ongewijzigd.
# Oude map als controle: daar is vel 4 leeg (bijna alles MIS).
# python3 -I proef65.py <map>     (FOTO=<map> maakt een schermafbeelding van de keuze)
import sys, os, time, json, socket, subprocess, tempfile, shutil, re, math
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NAMEN = ['Liefde!', 'Heerlijk!', 'High five!', 'Succes!', 'Alsjeblieft', 'Twijfel\u2026', 'Boks!', 'Wat?', 'Raak!', 'Momentje', 'Jij!', 'Deal!']
GELUID = ['liefde', 'kus', 'vijf', 'geluk', 'engel', 'twijfel', 'boks', 'wat', 'pieuw', 'ahum', 'jij', 'deal']
NAMEN_EN = ['Love!', "Chef's kiss", 'High five!', 'Good luck!', 'Please', 'Not sure\u2026', 'Bump!', 'What?', 'Gotcha!', 'One moment', 'You!', 'Deal!']
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
def mp3_info(pad):
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', pad, '-f', 's16le', '-ac', '1', '-ar', '44100', '-'], capture_output=True)
    if r.returncode or not r.stdout: return None
    import array
    a = array.array('h'); a.frombytes(r.stdout[:len(r.stdout) // 2 * 2]); n = len(a)
    rms = math.sqrt(sum(x * x for x in a) / n) / 32768; piek = max(abs(x) for x in a) / 32768
    return (round(n / 44100, 2), round(20 * math.log10(rms or 1e-9), 1), round(piek, 2))
info = {g: (mp3_info(os.path.join(MAP, 'geluiden', g + '.mp3')) if os.path.exists(os.path.join(MAP, 'geluiden', g + '.mp3')) else None) for g in GELUID}
check("de 12 mp3's van vel 4 zijn er en zijn speelbaar", all(info.values()), [g for g, i in info.items() if not i])
check('elk 0,5-2,6 s, even hard (-25 tot -18 dB), piek hoogstens 0,9', all(i and 0.5 <= i[0] <= 2.6 and -25 <= i[1] <= -18 and i[2] <= 0.9 for i in info.values()), info)
groot = sum(os.path.getsize(os.path.join(MAP, 'geluiden', g + '.mp3')) for g in GELUID if info[g])
check("samen minder dan 400 kB", 0 < groot < 400 * 1024, groot)
plaatjes = [os.path.join(MAP, 'stickers', 'f4', '%02d.webp' % i) for i in range(1, 13)]
check('de 12 plaatjes stickers/f4/NN.webp zijn er, samen minder dan 450 kB', all(os.path.exists(x) for x in plaatjes) and sum(os.path.getsize(x) for x in plaatjes if os.path.exists(x)) < 450 * 1024, '')
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
        p.mp3urls = []; p.mp3fout = []
        p.on('response', lambda r: (p.mp3urls.append(r.url), (p.mp3fout.append(r.url) if r.status != 200 else None)) if '/geluiden/' in r.url else None)
        p.goto(BASIS + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l) }", [TOKEN, taal])
        staat['pub'] = p.evaluate("""async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); const v = await c.genereerKeypair();
          c.slaPrivateKeyOp(uid, ik.privateKeyB64); return v.publicKeyB64 }""", UID)
        p.goto(BASIS + 'chat.html')
        try: p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000); p.click('#vriendenLijst .vriend-item')
        except Exception: pass
        p.wait_for_timeout(1500)
        ev(p, "() => { toggleStickers(); const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\"f4\"]'); if (v) v.click() }"); p.wait_for_timeout(500)
        return ctx, p
    LIJST = "() => [...document.querySelectorAll('#stickerGrid .sk-sticker')].map(b => b.getAttribute('aria-label'))"
    staat['rijen'] = ['fxsticker:f4-11']
    ctx, p = chat('nl')
    namen = ev(p, LIJST)
    check('vakje 4: 12 stickers met de goede namen', namen == ['Stuur sticker ' + n for n in NAMEN], namen)
    maten = ev(p, "() => Promise.all([...document.querySelectorAll('#stickerGrid .sk-sticker img')].map(i => i.decode().then(() => [i.naturalWidth, i.naturalHeight, i.getAttribute('src')], () => null)))")
    check('alle 12 plaatjes laden: 384 x 384, stickers/f4/NN.webp', isinstance(maten, list) and len(maten) == 12 and all(m and m[:2] == [384, 384] and m[2] == 'stickers/f4/%02d.webp' % (i + 1) for i, m in enumerate(maten)), maten)
    ico = ev(p, "() => { const i = document.querySelector('#stickerGrid .sk-vak[data-vak=\"f4\"] img'); return i ? i.getAttribute('src') : null }")
    check('vakje 4 toont de eerste sticker', ico == 'stickers/f4/01.webp', ico)
    hel = ev(p, "() => { const i = document.querySelector('#stickerGrid .sk-inhoud'); return i ? [i.scrollHeight, i.clientHeight, Math.round(document.getElementById('stickerGrid').getBoundingClientRect().height)] : null }")
    check('het hele vel (3 rijen) past zonder schuiven, keuze niet te hoog', isinstance(hel, list) and hel[0] <= hel[1] + 1 and hel[2] < 380, hel)
    fx = ev(p, """async () => { const v = await import('./stickervellen.js?v=166'); const f = await import('./stickerfx.js?v=166');
      const G = f.GELUIDEN
      return v.FIBRO_VELLEN[3].stickers.map(s => [s.nr, !!f.BEWEGINGEN[s.b] && s.b !== 'geen', s.g, !!(G[s.g] && G[s.g].mp3 && G[s.g].terug && G[G[s.g].terug] && !G[G[s.g].terug].mp3 && G[G[s.g].terug].f), s.naam[1], /^[a-z]{1,20}$/.test(s.g) && /^[a-z]{1,20}$/.test(s.b)]) }""")
    check('elke sticker: een bestaande beweging, Engelse naam, namen alleen a-z', isinstance(fx, list) and len(fx) == 12 and all(x[1] and x[5] for x in fx) and [x[4] for x in fx] == NAMEN_EN, fx)
    check('elke sticker zijn eigen nieuwe geluid (alleen mp3, met een terug-geluid met code)', isinstance(fx, list) and [x[2] for x in fx] == GELUID and all(x[3] for x in fx), fx)
    vel1 = ev(p, """async () => { const v = await import('./stickervellen.js?v=166'); const f = await import('./stickerfx.js?v=166');
      return [v.FIBRO_VELLEN[0].stickers.length, v.zoekSticker('f1-02').g, v.FIBRO_VELLEN[1].stickers.length, v.zoekSticker('f2-12').g, v.FIBRO_VELLEN[2].stickers.length, v.zoekSticker('f3-12').g, Object.keys(f.GELUIDEN).length, v.FIBRO_VELLEN.slice(4).every(x => x.stickers.length === 0)] }""")
    check('vel 1-3 ongewijzigd; 67 geluiden (met geen); vel 5-6 nog leeg', vel1 == [12, 'ssst', 12, 'loser', 12, 'warp', 67, True], vel1)
    binnen = ev(p, "() => { const i = document.querySelector('#messages .fx-sticker'); return i ? [i.getAttribute('src'), i.alt] : null }")
    check('binnengekomen sticker (Jij!) staat in de chat', binnen == ['stickers/f4/11.webp', 'Jij!'], binnen)
    if FOTO: p.screenshot(path=FOTO + '/vel4-in-chat.png')
    # eerste echte tik (haalt de mp3's op), dan Deal! versturen met een echte klik: zijn mp3 klinkt
    p.mouse.click(5, 5); p.wait_for_timeout(1500)
    voor = ev(p, "window.__fxmp3 || 0")
    try: p.locator('#stickerGrid .sk-sticker').nth(11).click(timeout=3000)
    except Exception: pass
    p.wait_for_timeout(1500)
    na = ev(p, "window.__fxmp3 || 0")
    cache = ev(p, "u => localStorage.getItem('fibro_msg_cache_' + u) || ''", UID)
    inhoud = str((staat['posts'][-1] if staat['posts'] else {}).get('content', ''))
    check('Deal! versturen (echte klik): mp3-geluid, fxsticker:f4-12, versleuteld', isinstance(na, int) and na > voor and '"fxsticker:f4-12"' in cache and inhoud.startswith('e2e:'), (voor, na, cache[-60:], inhoud[:20]))
    gehaald = sorted(set(u.split('/geluiden/')[1].split('?')[0] for u in p.mp3urls))
    fout = [u for u in p.mp3fout if u.split('/geluiden/')[1].split('?')[0][:-4] in GELUID]
    check("na de eerste tik zijn de 12 nieuwe mp3's opgehaald (status 200)", all(g + '.mp3' in gehaald for g in GELUID) and not fout, (len(gehaald), fout[:3]))
    # Profiel -> Stickers: een blok 'Stickervel 4' met 12 stickers
    blok = ev(p, """async () => { const m = await import('./stickerwidget.js?v=166'); const d = document.createElement('div'); document.body.append(d); m.tekenFibroVellen(d, null)
      return [...d.querySelectorAll('.sw-sectie')].map(s => [s.dataset.vel, s.querySelector('.section-label').textContent, s.querySelectorAll('.sw-plek').length]) }""")
    check("Profiel: blok 'Stickervel 4' met 12 stickers (na vel 1-3)", blok == [['f1', 'Stickervel 1', 12], ['f2', 'Stickervel 2', 12], ['f3', 'Stickervel 3', 12], ['f4', 'Stickervel 4', 12]], blok)
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
