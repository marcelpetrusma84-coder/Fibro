import subprocess, sys, time, json, os, re
from playwright.sync_api import sync_playwright
# proef25: alle lettertypen die je kunt kiezen zijn ongeveer even breed als DM Sans (size-adjust), zodat tekst
# niet uitsteekt; de spellen houden 'Press Start 2P' op de oude maat; oude keuze Press Start 2P wordt omgezet.
# Let op: de .woff2-bestanden zitten niet in upload-alles; zet ze eerst in <map>/lettertypen (npm @fontsource/<naam>).
# python3 -I proef25.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www25_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        e = {"id": UID, "username": "marcel", "lettertype": staat['lt']}
        return route.fulfill(status=200, json=e if obj else [e])
    return route.fulfill(status=200, json=[])
staat = {'lt': None}
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
ZIN = 'Het leven is mooi & bijzonder Marcel 0123'
MEET = """async ([fam, zin]) => { await document.fonts.load('400 32px ' + fam, zin); await new Promise(r => setTimeout(r, 50))
  const c = document.createElement('canvas').getContext('2d'); c.font = '400 32px ' + fam; return c.measureText(zin).width }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: perr.append(str(e)[:150]))
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    lijst = p.evaluate("async () => (await import('./lettertypes.js?v=' + (document.querySelector('script') ? '130' : '130'))).LETTERTYPES")
    p.goto(B + 'profiel.html'); p.wait_for_timeout(1500)
    for f in lijst: p.evaluate("n => import('./lettertypes.js?v=130').then(m => m.laadFont(n))", f['naam'])
    p.wait_for_timeout(1500)
    basis = p.evaluate(MEET, ["'DM Sans'", ZIN])
    te_breed = []; uitslag = {}
    for f in lijst:
        w = p.evaluate(MEET, ["'" + f['naam'] + "'", ZIN]); r = w / basis; uitslag[f['naam']] = round(r, 2)
        if r > 1.12 or r < 0.55: te_breed.append((f['naam'], round(r, 2)))
    print('   breedte t.o.v. DM Sans:', uitslag)
    check('alle ' + str(len(lijst)) + ' lettertypen tussen 0,55 en 1,12 keer zo breed als DM Sans', not te_breed, te_breed)
    p.evaluate("() => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'lettertypen/press-start-2p.css?v=1'; document.head.appendChild(l) }"); p.wait_for_timeout(800)
    g = p.evaluate(MEET, ["'Press Start 2P'", ZIN]) / basis
    check('spellen: Press Start 2P zelf onveranderd (±2,1 keer zo breed)', 2.0 < g < 2.3, round(g, 2))
    print('2. Oude keuze Press Start 2P wordt de kleinere versie')
    staat['lt'] = "'Press Start 2P',cursive"
    p.evaluate("([u, lt]) => { localStorage.setItem('fibro_thema_' + u, JSON.stringify({ lettertype: lt })) }", [UID, staat['lt']])
    p.goto(B + 'index.html'); p.wait_for_timeout(3000)
    ff = p.evaluate("() => getComputedStyle(document.getElementById('heroNaam')).fontFamily")
    check('Home gebruikt Press Start 2P Tekst', 'Press Start 2P Tekst' in ff, ff)
    gl = p.evaluate("() => !!document.getElementById('font-press-start-2p-tekst') && [...document.fonts].some(f => f.family.replace(/[\"']/g, '') === 'Press Start 2P Tekst' && f.status === 'loaded')")
    check('en dat lettertype is echt geladen', gl, gl)
    check('geen fouten op de pagina', perr == [], perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
