import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef12: geen stickergeluid bij het openen van een chat met oude stickers
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www12'; os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
INHOUD = ['sticker:\U0001F600:blij', 'lossticker:stickers/x.webp:feest', 'packsticker:' + json.dumps({"src": "stickers/p.webp", "cols": 2, "rows": 2, "kolom": 0, "rij": 0, "geluid": "wow"}),
          'customsticker:' + json.dumps({"image": "data:image/webp;base64,AAAA", "geluid": "ding"}), 'gewoon tekst']
MSG = [{"id": f"m{i}", "sender_id": FID, "receiver_id": UID, "content": c, "created_at": f"2026-10-07T1{i}:00:00+00:00", "antwoord_op": None} for i, c in enumerate(INHOUD)]
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID}])
    if '/rest/v1/messages' in u and m == 'GET': return route.fulfill(status=200, json=list(reversed(MSG)))
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=prof)
        return route.fulfill(status=200, json=[{"id": FID, "username": "flamingo", "avatar_url": "x", "public_key": None}] if 'in.' in u else [prof])
    if m == 'GET': return route.fulfill(status=200, json=[])
    return route.abort()
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    ctx.add_init_script("""(() => { window.__geluid = 0; const O = window.AudioContext; window.AudioContext = window.webkitAudioContext = function (...a) { window.__geluid++; console.log("GELUID " + new Error().stack.split(String.fromCharCode(10)).slice(2,5).join(" < ")); return new O(...a) } })()""")
    p = ctx.new_page(); p.on('console', lambda m: print('   ', m.text[:300]) if m.text.startswith('GELUID') else None); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200]))
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000); p.wait_for_timeout(1500)
    voor = p.evaluate("() => window.__geluid")
    p.click('#vriendenLijst .vriend-item'); p.wait_for_function("() => document.querySelectorAll('#messages .msg-row').length >= 5", timeout=15000); p.wait_for_timeout(1000)
    na = p.evaluate("() => window.__geluid"); rijen = p.evaluate("() => document.querySelectorAll('#messages .msg-row').length")
    print('berichten getoond:', rijen, '| geluiden bij openen:', na - voor)
    br.close()
srv.kill()
