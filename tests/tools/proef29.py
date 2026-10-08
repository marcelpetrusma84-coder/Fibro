import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef29: knoppen (Opslaan, Uitnodigen) nooit schaduw; witte tekst spierwit (#ffffff) op alle pagina's (stijl.css v3).
# python3 -I proef29.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www29_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/friendships' in u and m == 'GET': return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": BRAM, "status": "accepted", "profiles": {"id": BRAM, "username": "Bram"}}])
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        e = {"id": BRAM if BRAM in u else UID, "username": "bram" if BRAM in u else "marcel"}
        return route.fulfill(status=200, json=e if obj else ([e] if 'in.' not in u else [{"id": BRAM, "username": "Bram"}]))
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
TEKST = """() => { const wit = []; const lavendel = [];
  for (const e of document.querySelectorAll('body *')) { if (!e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue
    const c = getComputedStyle(e).color; if (c === 'rgb(243, 232, 255)' || c === 'rgb(229, 229, 229)') lavendel.push(e.tagName + '.' + e.className + ' ' + e.textContent.trim().slice(0, 20)); else if (c === 'rgb(255, 255, 255)') wit.push(1) }
  return { wit: wit.length, lavendel: lavendel.slice(0, 6), nLav: lavendel.length } }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: perr.append(str(e)[:150]))
    p.goto(B + 'login.html'); p.wait_for_timeout(800)
    r = p.evaluate(TEKST); check('login: geen lichtpaars-wit meer', r['nLav'] == 0, r)
    p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    for pg, knop in [('profiel.html', '.save-top-btn'), ('vrienden.html', '.invite-btn'), ('index.html', None), ('chat.html', None), ('vriend-profiel.html?id=' + BRAM, None), ('over.html', None), ('spel.html?spel=pong', None)]:
        p.goto(B + pg); p.wait_for_timeout(2200)
        p.evaluate("() => { const d = document.createElement('div'); d.id = 'fibro-wallpaper'; document.body.prepend(d) }"); p.wait_for_timeout(100)
        if knop:
            s = p.evaluate("k => getComputedStyle(document.querySelector(k)).textShadow", knop)
            check(pg + ': knop ' + knop + ' zonder schaduw (ook met foto)', s == 'none', s)
        r = p.evaluate(TEKST)
        check(pg.split('?')[0] + ': witte tekst spierwit (geen lichtpaars-wit)', r['nLav'] == 0 and r['wit'] > 0, r)
    check('geen fouten op de pagina', perr == [], perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
