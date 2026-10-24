# proef104: de stickerkeuze altijd 4 naast elkaar (v216), echte chat.html, op vier schermen: kleine telefoon (360 x 740),
# telefoon (390 x 844), tablet (768 x 1024) en Steam Deck (1280 x 800). Per scherm, vakje 5 open:
#  - het raster heeft 4 kolommen; de 12 stickers staan in 3 rijen van 4 (gelijke afstanden), allemaal even hoog
#  - het hele vel past zonder schuiven, de keuze is niet hoger dan 380 px, de pagina niet breder dan het scherm
#  - geen paginafouten
# Oude map (v215) als controle: tablet en Steam Deck MIS (daar 6 naast elkaar in 2 rijen).
# python3 -I proef104.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:230] if info != '' else ''), flush=True)
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}; vriend = {"id": FID, "username": "Bram", "avatar_url": "\U0001F438", "public_key": None}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    return route.fulfill(status=200, json=[] if m == 'GET' else {})
MAAT = """() => {
  const r = document.querySelector('#stickerGrid .sk-raster'); const i = document.querySelector('#stickerGrid .sk-inhoud'); const g = document.getElementById('stickerGrid')
  if (!r || !i || !g) return null
  const knop = [...r.querySelectorAll('.sk-sticker')].map(b => b.getBoundingClientRect())
  const uniek = a => [...new Set(a.map(x => Math.round(x)))].sort((p, q) => p - q)
  return { kol: getComputedStyle(r).gridTemplateColumns.split(' ').length, n: knop.length, rijen: uniek(knop.map(k => k.top)), kolommen: uniek(knop.map(k => k.left)),
           hoog: uniek(knop.map(k => k.height)), schuif: [i.scrollHeight, i.clientHeight], keuze: Math.round(g.getBoundingClientRect().height),
           breed: document.documentElement.scrollWidth, scherm: innerWidth,
           zichtbaar: knop.every(k => k.top >= i.getBoundingClientRect().top - 1 && k.bottom <= i.getBoundingClientRect().bottom + 1) } }"""
fouten = []
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    B = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server'])
    for naam, w, h in (('kleine telefoon', 360, 740), ('telefoon', 390, 844), ('tablet', 768, 1024), ('Steam Deck', 1280, 800)):
        ctx = br.new_context(service_workers='block', viewport={'width': w, 'height': h}); ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda ws: None)
        p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200]))
        p.goto(B + 'manifest.json'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
        p.goto(B + 'chat.html')
        try: p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000); p.click('#vriendenLijst .vriend-item')
        except Exception: pass
        p.wait_for_timeout(1500)
        try: p.evaluate("() => { toggleStickers(); const v = document.querySelector('#stickerGrid .sk-vak[data-vak=f5]'); if (v) v.click() }")
        except Exception: pass
        p.wait_for_timeout(600)
        m = p.evaluate(MAAT)
        ok = isinstance(m, dict)
        gelijk = lambda a: len(a) > 1 and max(a[k + 1] - a[k] for k in range(len(a) - 1)) - min(a[k + 1] - a[k] for k in range(len(a) - 1)) <= 1
        check('%s (%d x %d): 4 kolommen, 12 stickers in 3 rijen van 4, gelijke afstanden, even hoog' % (naam, w, h),
              ok and m['kol'] == 4 and m['n'] == 12 and len(m['rijen']) == 3 and len(m['kolommen']) == 4 and gelijk(m['rijen']) and gelijk(m['kolommen']) and len(m['hoog']) == 1,
              m and {k: m[k] for k in ('kol', 'n', 'rijen', 'kolommen', 'hoog')})
        check('%s: het hele vel past zonder schuiven, keuze hoogstens 380 px, niet breder dan het scherm' % naam,
              ok and m['schuif'][0] <= m['schuif'][1] + 1 and m['zichtbaar'] and m['keuze'] <= 380 and m['breed'] <= m['scherm'], m and {k: m[k] for k in ('schuif', 'zichtbaar', 'keuze', 'breed', 'scherm')})
        ctx.close()
    br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
check('geen paginafouten', fouten == [], fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef104: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
