# proef101: stickervel 5 (v206-v208, chattaal: lol, rolf, omg ... GOAT, meh), naar proef65 (vel 4). Echte chat.html:
#  A. de plaatjes: 12 x stickers/f5/NN.webp, 384 x 384 met doorzichtigheid, samen < 300 kB; zonder achtergrond: de rand
#     van het plaatje helemaal doorzichtig, de sticker dekt 40-85% (niet alleen een witte omtrek), de buitenkant is
#     overal de witte rand (geen stukjes chatscherm), geen paarse resten van de kruizen in Marcels plaatjes
#  B. vakje 5 in de stickerkeuze: 12 stickers met de goede namen (NL/EN), plaatjes laden, vakje toont de eerste, past
#     zonder schuiven; elke sticker een bestaande beweging en een bestaand geluid (geen nieuwe geluiden: nog 67, de mp3
#     van elk mp3-geluid bestaat); vel 1-4 ongewijzigd, vel 6 nog leeg; binnenkomend GOAT staat in de chat; Meh
#     versturen met een echte klik = geluid + fxsticker:f5-12, versleuteld
#  C. Profiel: een blok 'Stickervel 5' met 12 stickers (na vel 1-4)
#  D. de kast (kastvullen.js met de echte portier): daarna staan de 12 plaatjes van vel 5 in de mediakast en werkt
#     stickers/f5/12.webp ook zonder internet
#  E. Engels; geen paginafouten
# Oude map (v205) als controle: bijna alles MIS.
# python3 -I proef101.py <map>     (FOTO=<map> maakt een schermafbeelding van de keuze)
import sys, os, time, json, socket, subprocess, tempfile, shutil
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nepslot; NEP = nepslot.Nep(MAP, UID, FID)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NAMEN = ['LOL', 'Rollen van het lachen', 'OMG!', 'Bedankt!', 'Gelukt!', 'Nee!', 'Ben zo terug', 'Vibing', 'Noob', 'Cringe', 'GOAT', 'Meh']
NAMEN_EN = ['LOL', 'ROFL', 'OMG!', 'Thanks!', 'Done!', 'No!', 'Be right back', 'Vibing', 'Noob', 'Cringe', 'GOAT', 'Meh']
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''), flush=True)

# ---- A. de plaatjes ----
plaatjes = [os.path.join(MAP, 'stickers', 'f5', '%02d.webp' % i) for i in range(1, 13)]
er = [p for p in plaatjes if os.path.exists(p)]
groot = sum(os.path.getsize(p) for p in er)
check('A de 12 plaatjes stickers/f5/NN.webp zijn er, samen minder dan 300 kB', len(er) == 12 and groot < 300 * 1024, (len(er), groot))
maat, rand, dekt, wit, paars = [], [], [], [], []
for p in er:
    im = Image.open(p); maat.append((im.format, im.size, im.mode))
    a = np.asarray(im.convert('RGBA')).astype(int); al = a[..., 3]
    rand.append(int(max(al[:2].max(), al[-2:].max(), al[:, :2].max(), al[:, -2:].max())))
    dekt.append(round(float((al >= 128).mean()), 2))
    buiten = (al >= 128) & nd.binary_dilation(al < 128, iterations=1)
    wit.append(round(float((a[..., :3][buiten].min(1) > 170).mean()), 3) if buiten.any() else 0)
    paars.append(round(float(((np.abs(a[..., :3] - [65, 31, 92]).max(2) < 25) & (al > 200)).mean()), 4))
check('A elk plaatje: WebP, 384 x 384, met doorzichtigheid', len(maat) == 12 and all(m == ('WEBP', (384, 384), 'RGBA') for m in maat), maat[:3])
check('A zonder achtergrond: de rand van elk plaatje helemaal doorzichtig', len(rand) == 12 and max(rand) == 0, rand)
check('A de sticker zelf is er (dekt 40-85%, niet alleen een witte omtrek)', len(dekt) == 12 and all(0.40 <= d <= 0.85 for d in dekt), dekt)
check('A de buitenkant is overal de witte rand (geen stukjes chatscherm)', len(wit) == 12 and all(w >= 0.95 for w in wit), wit)
check('A geen paarse resten van de kruizen', len(paars) == 12 and all(x < 0.005 for x in paars), paars)

# ---- B-E in de browser ----
staat = {'pub': None, 'posts': [], 'rijen': []}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'POST':
        staat['posts'].append(json.loads(route.request.post_data or '{}'))
        return route.fulfill(status=201, json={"id": "mnieuw%d" % len(staat['posts'])})
    if '/rest/v1/messages' in u and m == 'GET':
        return route.fulfill(status=200, json=[{'id': 'm%02d' % i, 'sender_id': FID, 'receiver_id': UID, 'content': NEP.inhoud(FID, c, '2026-10-24T00:%02d:00.000Z' % i), 'created_at': '2026-10-24T00:%02d:00.000Z' % i,
                                                'expires_at': '2026-11-23T00:00:00.000Z', 'antwoord_op': None} for i, c in enumerate(staat['rijen'])][::-1])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}; vriend = {"id": FID, "username": "flamingo", "avatar_url": "\U0001F9A9", "public_key": staat['pub']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
TELLER = """
(() => {
  // de geluiden zijn mp3's (<audio data-stickerfx> met een blob-adres) of gemaakt met de AudioContext (via een compressor)
  window.__fxgeluid = 0
  const AC = window.AudioContext || window.webkitAudioContext
  if (AC) {
    const comp = AC.prototype.createDynamicsCompressor, start = AudioScheduledSourceNode.prototype.start
    AC.prototype.createDynamicsCompressor = function () { this.__fx = true; return comp.apply(this, arguments) }
    AudioScheduledSourceNode.prototype.start = function () {
      if (this.context && this.context.__fx && !(this.buffer && this.buffer.length <= 1)) window.__fxgeluid++
      return start.apply(this, arguments) }
  }
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    if (this.dataset && this.dataset.stickerfx && !this._zegen && String(this.src || '').startsWith('blob:')) window.__fxgeluid++
    return speel.apply(this, arguments) }
})()
"""
fouten = []
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
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(taal + ': ' + str(e)[:200]))
        p.goto(BASIS + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l) }", [TOKEN, taal])
        p.evaluate("([u, k]) => localStorage.setItem('fibro_privkey_' + u, k)", [UID, NEP.ik.priv]); staat['pub'] = NEP.vriend.pub
        p.goto(BASIS + 'chat.html')
        try: p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000); p.click('#vriendenLijst .vriend-item')
        except Exception: pass
        p.wait_for_timeout(1500)
        ev(p, "() => { toggleStickers(); const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\"f5\"]'); if (v) v.click() }"); p.wait_for_timeout(500)
        return ctx, p
    LIJST = "() => [...document.querySelectorAll('#stickerGrid .sk-sticker')].map(b => b.getAttribute('aria-label'))"
    # de versie van stickervellen.js die chat.html echt laadt
    VELLEN = "() => { const s = [...document.querySelectorAll('script[type=module]')].map(x => x.textContent).join('\\n'); const m = /\\.\\/stickervellen\\.js\\?v=\\d+/.exec(s); return m ? m[0] : './stickervellen.js' }"
    FX = "() => { const s = [...document.querySelectorAll('script[type=module]')].map(x => x.textContent).join('\\n'); const m = /\\.\\/stickerfx\\.js\\?v=\\d+/.exec(s); return m ? m[0] : './stickerfx.js' }"
    staat['rijen'] = ['fxsticker:f5-11']
    ctx, p = chat('nl')
    namen = ev(p, LIJST)
    check('B vakje 5: 12 stickers met de goede namen', namen == ['Stuur sticker ' + n for n in NAMEN], namen)
    maten = ev(p, "() => Promise.all([...document.querySelectorAll('#stickerGrid .sk-sticker img')].map(i => i.decode().then(() => [i.naturalWidth, i.naturalHeight, i.getAttribute('src')], () => null)))")
    check('B alle 12 plaatjes laden: 384 x 384, stickers/f5/NN.webp', isinstance(maten, list) and len(maten) == 12 and all(m and m[:2] == [384, 384] and m[2] == 'stickers/f5/%02d.webp' % (i + 1) for i, m in enumerate(maten)), maten)
    ico = ev(p, "() => { const i = document.querySelector('#stickerGrid .sk-vak[data-vak=\"f5\"] img'); return i ? i.getAttribute('src') : null }")
    check('B vakje 5 toont de eerste sticker', ico == 'stickers/f5/01.webp', ico)
    hel = ev(p, "() => { const i = document.querySelector('#stickerGrid .sk-inhoud'); return i ? [i.scrollHeight, i.clientHeight, Math.round(document.getElementById('stickerGrid').getBoundingClientRect().height)] : null }")
    check('B het hele vel (3 rijen) past zonder schuiven, keuze niet te hoog', isinstance(hel, list) and hel[0] <= hel[1] + 1 and hel[2] < 380, hel)
    vv, fv = ev(p, VELLEN), ev(p, FX)
    fx = ev(p, """async ([vv, fv]) => { const v = await import(vv); const f = await import(fv); const G = f.GELUIDEN
      const kan = g => !!(G[g] && (typeof G[g].f === 'function' || (G[g].mp3 && G[g].terug && G[G[g].terug] && typeof G[G[g].terug].f === 'function')))
      return (v.FIBRO_VELLEN[4] || { stickers: [] }).stickers.map(s => [s.nr, !!f.BEWEGINGEN[s.b] && s.b !== 'geen', s.g, kan(s.g) && s.g !== 'geen', !!(G[s.g] && G[s.g].mp3), s.naam[1], /^[a-z]{1,20}$/.test(s.g) && /^[a-z]{1,20}$/.test(s.b)]) }""", [vv, fv])
    check('B elke sticker: een bestaande beweging, de Engelse naam, codes alleen a-z', isinstance(fx, list) and len(fx) == 12 and all(x[1] and x[6] for x in fx) and [x[5] for x in fx] == NAMEN_EN, fx)
    mp3 = [x[2] for x in fx if x[4]] if isinstance(fx, list) else []
    check('B elke sticker een bestaand geluid (mp3 met terug-geluid, of met code); de mp3 staat in geluiden/',
          isinstance(fx, list) and len(fx) == 12 and all(x[3] for x in fx) and all(os.path.exists(os.path.join(MAP, 'geluiden', g + '.mp3')) for g in mp3), (fx, mp3))
    check('B de geluiden binnen vel 5 zijn allemaal anders', isinstance(fx, list) and len(fx) == 12 and len(set(x[2] for x in fx)) == 12, [x[2] for x in fx] if isinstance(fx, list) else fx)
    rest = ev(p, """async ([vv, fv]) => { const v = await import(vv); const f = await import(fv)
      return [v.FIBRO_VELLEN.slice(0, 4).map(x => x.stickers.length), v.zoekSticker('f1-02').g, v.zoekSticker('f2-12').g, v.zoekSticker('f3-12').g, v.zoekSticker('f4-12').g,
              Object.keys(f.GELUIDEN).length, v.FIBRO_VELLEN[5].stickers.length, (v.zoekSticker('f5-11') || {}).g] }""", [vv, fv])
    check('B vel 1-4 ongewijzigd, geen nieuwe geluiden (67, met geen), vel 6 nog leeg, f5-11 te vinden', rest == [[12, 12, 12, 12], 'ssst', 'loser', 'warp', 'deal', 67, 0, 'winnaar'], rest)
    binnen = ev(p, "() => { const i = document.querySelector('#messages .fx-sticker'); return i ? [i.getAttribute('src'), i.alt] : null }")
    check('B binnengekomen sticker (GOAT) staat in de chat', binnen == ['stickers/f5/11.webp', 'GOAT'], binnen)
    if FOTO: p.screenshot(path=FOTO + '/vel5-in-chat.png')
    p.mouse.click(5, 5); p.wait_for_timeout(1500)
    voor = ev(p, "window.__fxgeluid || 0")
    try: p.locator('#stickerGrid .sk-sticker').nth(11).click(timeout=3000)
    except Exception: pass
    p.wait_for_timeout(1500)
    na = ev(p, "window.__fxgeluid || 0")
    cache = ev(p, "u => localStorage.getItem('fibro_msg_cache_' + u) || ''", UID)
    inhoud = str((staat['posts'][-1] if staat['posts'] else {}).get('content', ''))
    check('B Meh versturen (echte klik): geluid, fxsticker:f5-12, versleuteld', isinstance(na, int) and na > voor and '"fxsticker:f5-12"' in cache and inhoud.startswith('e2e:'), (voor, na, cache[-60:], inhoud[:20]))
    # C. Profiel -> Stickers: een blok 'Stickervel 5' met 12 stickers
    wv = ev(p, "() => './stickerwidget.js' + (/stickerwidget\\.js(\\?v=\\d+)/.exec(document.documentElement.outerHTML) || ['', ''])[1]")
    blok = ev(p, """async w => { const m = await import(w); const d = document.createElement('div'); document.body.append(d); m.tekenFibroVellen(d, null)
      return [...d.querySelectorAll('.sw-sectie')].map(s => [s.dataset.vel, s.querySelector('.section-label').textContent, s.querySelectorAll('.sw-plek').length]) }""", wv)
    check("C Profiel: blok 'Stickervel 5' met 12 stickers (na vel 1-4)", blok == [['f%d' % i, 'Stickervel %d' % i, 12] for i in range(1, 6)], blok)
    ctx.close()
    # E. Engels
    staat['rijen'] = []
    ctx, p = chat('en')
    namen = ev(p, LIJST)
    check('E Engels: de namen', namen == ['Send sticker ' + n for n in NAMEN_EN], namen)
    ctx.close()
    # D. de kast, met de echte portier
    ctx = br.new_context(service_workers='allow', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append('kast: ' + str(e)[:200]))
    p.goto(BASIS + 'manifest.json')
    baas = ev(p, "() => navigator.serviceWorker.register('service-worker.js').then(() => navigator.serviceWorker.ready).then(() => new Promise(ok => { if (navigator.serviceWorker.controller) return ok(true); navigator.serviceWorker.addEventListener('controllerchange', () => ok(true), { once: true }); setTimeout(() => ok(false), 10000) }))")
    t0 = time.time()
    kv = 'kastvullen.js' + (('?v=' + __import__('re').search(r"kastvullen\.js\?v=(\d+)", open(os.path.join(MAP, 'index.html'), encoding='utf-8').read()).group(1)) if os.path.exists(os.path.join(MAP, 'index.html')) else '')
    gevuld = ev(p, "kv => import('./' + kv).then(m => m.vulKast(208)).then(() => true)", kv)
    inkast = ev(p, "async () => { const k = await caches.open('fibro-media-1'); return (await k.keys()).map(r => new URL(r.url).pathname.split('/Fibro/')[1]).filter(x => x.startsWith('stickers/f5/')).sort() }")
    check('D kastvullen: de 12 plaatjes van vel 5 in de mediakast', baas is True and gevuld is True and inkast == ['stickers/f5/%02d.webp' % i for i in range(1, 13)], (baas, gevuld, round(time.time() - t0, 1), inkast if not isinstance(inkast, list) else len(inkast)))
    ctx.set_offline(True)
    los = ev(p, "() => fetch('stickers/f5/12.webp').then(r => r.ok ? r.blob().then(b => b.size) : -r.status, e => 'geen: ' + e)")
    check('D zonder internet: stickers/f5/12.webp komt uit de kast', los == (os.path.getsize(plaatjes[11]) if os.path.exists(plaatjes[11]) else 'x'), los)
    ctx.close(); br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
check('E geen paginafouten', fouten == [], fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef101: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
