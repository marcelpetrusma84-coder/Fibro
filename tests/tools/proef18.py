import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef18: op Profiel zijn "Profiel preview" en "Geblokkeerd" weg (deblokkeren kan op Vrienden);
# de tabbladen, naam typen en een avatar kiezen werken zonder fouten
# python3 -I proef18.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www18_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
EIGEN = {"id": UID, "username": "bram"}
rpc = []
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rpc/' in u: rpc.append(u.split('/rpc/')[1].split('?')[0])
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return route.fulfill(status=200, json=EIGEN if obj else [EIGEN])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
ZICHT = "() => ({ preview: !!document.getElementById('previewNaam') || document.body.innerText.includes('Zo zien anderen'), blok: !!document.getElementById('geblokkeerdLijst') || /Geblokkeerd|geblokkeerd/.test(document.body.innerText), naam: !!document.getElementById('editNaam').offsetParent })"
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200])))
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2000)
    for tab in ['profiel', 'achtergrond', 'animatie', 'lettertype', 'kleur', 'widgets', 'stickers', 'profiel']:
        p.evaluate("t => window.switchTab(t)", tab); p.wait_for_timeout(150)
        r = p.evaluate(ZICHT)
        if tab == 'profiel': check('tabblad profiel: naam zichtbaar, geen preview en geen geblokkeerd', r['naam'] and not r['preview'] and not r['blok'], r)
        else: check('tabblad ' + tab + ': geen preview en geen geblokkeerd', not r['preview'] and not r['blok'] and not r['naam'], r)
    p.fill('#editNaam', 'Nieuwe naam'); p.fill('#editBio', 'abc')
    p.evaluate("() => window.toggleAvatarPicker()"); p.click('#avatarPicker .emoji-opt >> nth=3'); p.wait_for_timeout(300)
    r = p.evaluate("() => ({ av: document.getElementById('avatarEmoji').textContent, teller: document.getElementById('bioTeller').textContent })")
    check('naam typen en avatar kiezen werken', r['teller'] == '97 tekens over' and len(r['av']) > 0 and r['av'] != '\U0001F33F', r)
    check('geen fouten op de pagina', perr == [], perr)
    check('geblokkeerden niet meer opgevraagd op Profiel', 'mijn_geblokkeerden' not in rpc, rpc)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
