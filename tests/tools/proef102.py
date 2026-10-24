# proef102: de 35 meme-, montage- en emotiegeluiden (v209-v214), naar proef65 en proef54. Echte profiel.html, stickerfx.js,
# stickermaker.js, kastvullen.js en service-worker.js:
#  A. de mp3's: 35 x geluiden/<naam>.mp3, speelbaar, 0,5-2,7 s, even hard (-25 tot -18 dB), piek <= 0,9, ~64 kbps, zonder
#     ID3-tag, samen < 520 kB
#  B. stickerfx.js: 102 geluiden (met geen), elk nieuw geluid mp3: true met een terug-geluid met code; NL/EN-namen; de
#     geluiden van vel 1-5 ongewijzigd
#  C. het Stickerlab in Profiel: de 35 staan in de keuzelijst (Nederlandse namen); een plaatje kiezen en dan Ba-dum-tss
#     kiezen = dat mp3-geluid klinkt; bewaren = de eigen sticker heeft geluid 'badumtss' (FibroDB)
#  D. na de eerste tik zijn de 35 mp3's opgehaald (status 200)
#  E. de kast (kastvullen.js met de echte portier): de 35 mp3's in de mediakast, en ook zonder internet te krijgen
#  F. Engels: de namen in de keuzelijst; geen paginafouten
# Oude map (v208) als controle: bijna alles MIS.
# python3 -I proef102.py <map>
import sys, os, re, time, json, math, socket, subprocess, tempfile, shutil, array
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NIEUW = {'hoorn': ('Luchthoorn', 'Air horn'), 'badumtss': ('Ba-dum-tss', 'Ba dum tss'), 'kras': ('Platenkras', 'Record scratch'),
         'spanning': ('Spanningsakkoord', 'Suspense sting'), 'glijfluit': ('Glijfluit', 'Slide whistle'), 'pijp': ('Vallende pijp', 'Falling pipe'),
         'zoefweg': ('Zoef weg', 'Run away'), 'gameover': ('Game over', 'Game over'), 'levelup': ('Level up', 'Level up'),
         'fout': ('Fout antwoord', 'Wrong answer'), 'ooh': ('Ooooh!', 'Ooooh!'), 'aww': ('Awww', 'Awww'), 'bruh': ('Bruh', 'Bruh'),
         'viool': ('Treurige viool', 'Sad violin'), 'tadaa': ('Ta-daa!', 'Ta-da!'), 'bling': ('Bling', 'Bling'), 'clown': ('Clowntoeter', 'Clown horn'),
         'piep': ('Piepbeestje', 'Squeaky toy'), 'kazoo': ('Kazoo', 'Kazoo'), 'uitglijden': ('Uitglijden', 'Slip and fall'),
         'slowmo': ('Slow motion', 'Slow motion'), 'storing': ('Glitch', 'Glitch'), 'roffel': ('Tromgeroffel', 'Drum roll'), 'woesj': ('Woesj', 'Whoosh'),
         'woehoe': ('Woehoe!', 'Woohoo!'), 'bang': ('Bang', 'Scared'), 'verrast': ('Oh!', 'Oh!'), 'ieuw': ('Ieuw!', 'Eww!'), 'giechel': ('Giechel', 'Giggle'),
         'trots': ('Trots', 'Proud'), 'geeuw': ('Geeuw', 'Yawn'), 'bluergh': ('Misselijk', 'Queasy'), 'argh': ('Argh!', 'Argh!'),
         'ontroerd': ('Ontroerd', 'Touched'), 'dankbaar': ('Dankbaar', 'Grateful')}
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:230] if info != '' else ''), flush=True)

# ---- A. de mp3's ----
def mp3_info(pad):
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', pad, '-f', 's16le', '-ac', '1', '-ar', '44100', '-'], capture_output=True)
    if r.returncode or not r.stdout: return None
    a = array.array('h'); a.frombytes(r.stdout[:len(r.stdout) // 2 * 2]); n = len(a)
    rms = math.sqrt(sum(x * x for x in a) / n) / 32768; piek = max(abs(x) for x in a) / 32768
    return (round(n / 44100, 2), round(20 * math.log10(rms or 1e-9), 1), round(piek, 2))
pad = {g: os.path.join(MAP, 'geluiden', g + '.mp3') for g in NIEUW}
info = {g: (mp3_info(p) if os.path.exists(p) else None) for g, p in pad.items()}
check("A de 35 mp3's zijn er en zijn speelbaar", all(info.values()), [g for g, i in info.items() if not i][:8])
check('A elk 0,5-2,7 s, even hard (-25 tot -18 dB), piek hoogstens 0,9',
      all(i and 0.5 <= i[0] <= 2.7 and -25 <= i[1] <= -18 and i[2] <= 0.9 for i in info.values()), {g: i for g, i in info.items() if not (i and 0.5 <= i[0] <= 2.7 and -25 <= i[1] <= -18 and i[2] <= 0.9)})
kbps = {g: round(os.path.getsize(p) * 8 / 1000 / info[g][0]) for g, p in pad.items() if info[g]}
kop = {g: open(p, 'rb').read(3) for g, p in pad.items() if os.path.exists(p)}
check('A ~64 kbps (56-72), zonder ID3-tag', len(kbps) == 35 and all(56 <= k <= 72 for k in kbps.values()) and all(k[:3] != b'ID3' for k in kop.values()), kbps)
groot = sum(os.path.getsize(p) for p in pad.values() if os.path.exists(p))
check('A samen minder dan 520 kB', 0 < groot < 520 * 1024, groot)

# ---- B-F in de browser ----
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        eigen = {"id": UID, "username": "bram"}
        return route.fulfill(status=200, json=eigen if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [eigen])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
TELLER = """
(() => { window.__fxmp3 = 0; window.__fxsrc = []
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    if (this.dataset && this.dataset.stickerfx && !this._zegen && String(this.src || '').startsWith('blob:')) { window.__fxmp3++ }
    return speel.apply(this, arguments) }
})()
"""
DB = """async k => { const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
  r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) });
  return await new Promise(ok => { const q = db.transaction('fotos').objectStore('fotos').get(k);
    q.onsuccess = () => { const v = q.result; ok(v ? { b: v.b, g: v.g, naam: v.naam } : null) }; q.onerror = () => ok(null) }) }"""
tmp = tempfile.mkdtemp()
im = Image.new('RGB', (400, 300), (60, 20, 90)); d = ImageDraw.Draw(im)
d.ellipse((100, 50, 300, 250), fill=(250, 200, 40), outline=(10, 10, 10), width=6); im.save(tmp + '/effen.png')
fouten = []
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    def ev(p, js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:120]
    def profiel(taal):
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(TELLER)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(taal + ': ' + str(e)[:200])); p.on('dialog', lambda dl: dl.dismiss())
        p.mp3 = {}
        p.on('response', lambda r: p.mp3.__setitem__(r.url.split('/geluiden/')[1].split('?')[0], r.status) if '/geluiden/' in r.url else None)
        p.goto(BASIS + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l) }", [TOKEN, taal])
        p.goto(BASIS + 'profiel.html'); p.wait_for_timeout(2200)
        ev(p, "() => window.switchTab('stickers')"); p.wait_for_timeout(300)
        return ctx, p
    # de versie van stickerfx.js die stickermaker.js laadt
    sm = open(os.path.join(MAP, 'stickermaker.js'), encoding='utf-8').read()
    FXV = './' + (re.search(r"stickerfx\.js\?v=\d+", sm) or re.search('stickerfx.js', 'stickerfx.js')).group(0)
    vv = open(os.path.join(MAP, 'chat.html'), encoding='utf-8').read()
    VELV = './' + (re.search(r"stickervellen\.js\?v=\d+", vv) or re.search('stickervellen.js', 'stickervellen.js')).group(0)
    ctx, p = profiel('nl')
    b = ev(p, """async ([fv, vv]) => { const f = await import(fv); const v = await import(vv); const G = f.GELUIDEN
      const nieuw = %s
      return { n: Object.keys(G).length,
        nieuw: nieuw.map(k => [k, !!(G[k] && G[k].mp3 && G[k].terug && G[G[k].terug] && !G[G[k].terug].mp3 && typeof G[G[k].terug].f === 'function'), G[k] ? G[k].naam : null]),
        vellen: v.FIBRO_VELLEN.slice(0, 5).map(x => x.stickers.map(s => s.g).join(',')) } }""" % json.dumps(list(NIEUW)), [FXV, VELV])
    check('B stickerfx.js: 102 geluiden (met geen)', isinstance(b, dict) and b['n'] == 102, b['n'] if isinstance(b, dict) else b)
    check('B elk nieuw geluid: mp3 met een terug-geluid met code, namen NL/EN', isinstance(b, dict) and all(x[1] and x[2] == list(NIEUW[x[0]]) for x in b['nieuw']),
          [x for x in b['nieuw'] if not (x[1] and x[2] == list(NIEUW[x[0]]))][:4] if isinstance(b, dict) else b)
    VELLEN = ['lach,ssst,snurk,moe,huil,hartklop,grom,schrik,uitval,druk,spook,sluw', 'peins,laden,tiktak,zzz,hmm,idee,sirene,facepalm,krekels,ontploft,winnaar,loser',
              'duimop,boe,pijl,halt,vrede,oke,rock,kracht,hallo,applaus,yes,warp', 'liefde,kus,vijf,geluk,engel,twijfel,boks,wat,pieuw,ahum,jij,deal',
              'lach,boing,schrik,liefde,yes,zoemer,pijl,rock,loser,facepalm,winnaar,moe']
    check('B de geluiden van vel 1-5 ongewijzigd', isinstance(b, dict) and b['vellen'] == VELLEN, b['vellen'] if isinstance(b, dict) else b)
    # C. het Stickerlab
    try: p.click('#eigenStickers .sm-plek[data-code="e1-01"]', timeout=3000)
    except Exception: pass
    p.wait_for_timeout(300)
    opties = ev(p, "() => [...document.querySelectorAll('#smGeluid option')].map(o => [o.value, o.textContent])")
    ok_lijst = isinstance(opties, list) and all([k, v[0]] in opties for k, v in NIEUW.items())
    check('C Stickerlab: de 35 in de keuzelijst, met Nederlandse namen (102 keuzes)', ok_lijst and len(opties) == 102, (len(opties) if isinstance(opties, list) else opties, [k for k, v in NIEUW.items() if not (isinstance(opties, list) and [k, v[0]] in opties)][:5]))
    try: p.set_input_files('.sm-scherm input[type=file]', tmp + '/effen.png', timeout=2000)
    except Exception: pass
    p.wait_for_timeout(900)
    voor = ev(p, "window.__fxmp3")
    try: p.select_option('#smGeluid', 'badumtss', timeout=2000)
    except Exception: pass
    p.wait_for_timeout(1500)
    na = ev(p, "window.__fxmp3")
    check('C plaatje kiezen en dan Ba-dum-tss kiezen: het mp3-geluid klinkt', isinstance(na, int) and isinstance(voor, int) and na > voor, (voor, na))
    try: p.click('.sm-onder .sm-knop.hoofd', timeout=2000)
    except Exception: pass
    p.wait_for_timeout(600)
    db = ev(p, DB, 'eigensticker_' + UID + '_e1-01')
    check("C bewaren: de eigen sticker heeft geluid 'badumtss'", isinstance(db, dict) and db.get('g') == 'badumtss', db)
    # D. opgehaald na de eerste tik
    p.mouse.click(5, 5); p.wait_for_timeout(2500)
    mis = [g for g in NIEUW if p.mp3.get(g + '.mp3') != 200]
    check("D na de eerste tik zijn de 35 mp3's opgehaald (status 200)", not mis, mis[:6])
    ctx.close()
    # F. Engels
    ctx, p = profiel('en')
    try: p.click('#eigenStickers .sm-plek[data-code="e1-01"]', timeout=3000)
    except Exception: pass
    p.wait_for_timeout(300)
    opties = ev(p, "() => [...document.querySelectorAll('#smGeluid option')].map(o => [o.value, o.textContent])")
    check('F Engels: de namen in de keuzelijst', isinstance(opties, list) and all([k, v[1]] in opties for k, v in NIEUW.items()), [k for k, v in NIEUW.items() if not (isinstance(opties, list) and [k, v[1]] in opties)][:5])
    ctx.close()
    # E. de kast, met de echte portier
    ctx = br.new_context(service_workers='allow', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append('kast: ' + str(e)[:200]))
    p.goto(BASIS + 'manifest.json')
    baas = ev(p, "() => navigator.serviceWorker.register('service-worker.js').then(() => navigator.serviceWorker.ready).then(() => new Promise(ok => { if (navigator.serviceWorker.controller) return ok(true); navigator.serviceWorker.addEventListener('controllerchange', () => ok(true), { once: true }); setTimeout(() => ok(false), 10000) }))")
    kv = re.search(r"kastvullen\.js\?v=\d+", open(os.path.join(MAP, 'index.html'), encoding='utf-8').read()).group(0)
    gevuld = ev(p, "kv => import('./' + kv).then(m => m.vulKast(999)).then(() => true)", kv)
    inkast = ev(p, "async () => { const k = await caches.open('fibro-media-1'); return (await k.keys()).map(r => new URL(r.url).pathname.split('/geluiden/')[1]).filter(Boolean) }")
    mis = [g for g in NIEUW if not (isinstance(inkast, list) and g + '.mp3' in inkast)]
    check("E kastvullen: de 35 mp3's in de mediakast", baas is True and gevuld is True and not mis, (baas, gevuld, mis[:5]))
    ctx.set_offline(True)
    mv = re.search(r"MP3_VERSIE = (\d+)", open(os.path.join(MAP, 'stickerfx.js'), encoding='utf-8').read()).group(1)
    los = ev(p, "u => fetch(u).then(r => r.ok ? r.blob().then(b => b.size) : -r.status, e => 'geen: ' + e)", 'geluiden/roffel.mp3?v=' + mv)
    check('E zonder internet: geluiden/roffel.mp3 komt uit de kast', los == (os.path.getsize(pad['roffel']) if os.path.exists(pad['roffel']) else 'x'), los)
    ctx.close(); br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True); shutil.rmtree(tmp, ignore_errors=True)
check('F geen paginafouten', fouten == [], fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef102: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
