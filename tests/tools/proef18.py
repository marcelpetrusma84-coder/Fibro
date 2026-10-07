import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef18: op Profiel staan "Profiel preview" en "Geblokkeerd" alleen bij het tabblad Profiel
# python3 -I proef18.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www18_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
EIGEN = {"id": UID, "username": "bram"}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return route.fulfill(status=200, json=EIGEN if obj else [EIGEN])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
ZICHT = "() => ({ preview: !!document.getElementById('previewNaam').offsetParent, blok: !!document.getElementById('geblokkeerdLijst').offsetParent, naam: !!document.getElementById('editNaam').offsetParent })"
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200]))
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2000)
    for tab in ['profiel', 'achtergrond', 'animatie', 'lettertype', 'kleur', 'widgets', 'stickers', 'profiel']:
        p.evaluate("t => window.switchTab(t)", tab); p.wait_for_timeout(150)
        r = p.evaluate(ZICHT)
        if tab == 'profiel': check('tabblad profiel: naam, preview en geblokkeerd zichtbaar', r['naam'] and r['preview'] and r['blok'], r)
        else: check('tabblad ' + tab + ': geen preview en geen geblokkeerd', not r['preview'] and not r['blok'] and not r['naam'], r)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
