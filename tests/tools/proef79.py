import subprocess, sys, time, json, os, hashlib, base64
from playwright.sync_api import sync_playwright
# proef79: stap 2 van de versleuteling (v182), onzichtbaar voor de gebruiker.
#  A. Vrienden > uitnodigen: de link heeft achter het hekje #s=<32 tekens> = het begin van de vingerafdruk van de
#     sleutel op dit toestel (niet die van de server). Zonder sleutel op het toestel: geen #s=.
#  B. Bestaand account opent de link en tikt Toevoegen: dit toestel onthoudt de vingerafdruk uit de link.
#  C. Nieuw account via de link: ook onthouden; en de herstelcode komt uit crypto.getRandomValues (tijdens het
#     registreren geen enkele Math.random), op invite.html en op login.html.
#  D. Chat: korte vingerafdruk uit de link die klopt = geen balk, en hij wordt de lange; klopt hij niet (de server
#     laat een andere sleutel zien) = meteen de gele balk.
# python3 -I proef79.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nepslot
WWW = S + '/www79_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'; NIEUW = 'eeee0004-0000-4000-8000-000000000004'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
def token(uid): return json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
M, ANDER, BR = nepslot.Sleutelpaar(), nepslot.Sleutelpaar(), nepslot.Sleutelpaar()   # Marcel, een sleutel die de server stiekem zou kunnen laten zien, Bram
VINGER = hashlib.sha256(base64.b64decode(M.pub)).hexdigest()
staat = {'ik': MARCEL, 'marcel_pub': M.pub, 'signup': [], 'rpc': []}
def supa(route):
    u = route.request.url; m = route.request.method
    een = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": staat['ik'], "aud": "authenticated", "role": "authenticated"})
    if '/auth/v1/signup' in u:
        a = json.loads(route.request.post_data or '{}'); staat['signup'].append(a)
        return route.fulfill(status=200, json={"access_token": "x", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "refresh_token": "y",
                                               "user": {"id": NIEUW, "aud": "authenticated", "role": "authenticated", "email": a.get('email'), "user_metadata": (a.get('data') or {})}})
    if '/rest/v1/rpc/' in u:
        naam = u.split('/rest/v1/rpc/')[1].split('?')[0]; staat['rpc'].append(naam)
        if naam == 'valideer_invite': return route.fulfill(status=200, json=[{"created_by": MARCEL}])
        return route.fulfill(status=200, json=None)
    if '/rest/v1/profielen_publiek' in u:
        e = {"username": "Marcel", "avatar_url": "x"}; return route.fulfill(status=200, json=e if een else [e])
    if '/rest/v1/invite_tokens' in u: return route.fulfill(status=201, body='')
    if '/rest/v1/friendships' in u and m == 'GET':
        if 'friend_id=eq.' in u: return route.fulfill(status=200, json=None if een else [])
        return route.fulfill(status=200, json=[{"user_id": staat['ik'], "friend_id": MARCEL}])
    if '/rest/v1/profiles' in u and m == 'GET':
        vriend = {"id": MARCEL, "username": "Marcel", "avatar_url": "x", "public_key": staat['marcel_pub']}
        prof = {"id": staat['ik'], "username": "Bram", "public_key": "x" * 20}
        if een: return route.fulfill(status=200, json=vriend if MARCEL in u and staat['ik'] != MARCEL else prof)
        return route.fulfill(status=200, json=[vriend] if 'in.' in u else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, json=[])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:300] if info != '' else ''))
    if not ok: fouten.append(naam)
TELLER = "(() => { window.__gok = 0; const o = Math.random; Math.random = function () { window.__gok++; return o.apply(this, arguments) } })()"
SLEUTEL = "([u, f]) => localStorage.getItem('fibro_vriendsleutel_' + u + '_' + f)"
with sync_playwright() as pw:
    br = pw.chromium.launch()
    def ctx_voor(uid):
        staat['ik'] = uid
        c = br.new_context(service_workers='block', viewport={'width': 390, 'height': 900}, locale='nl-NL'); c.route('**/*supabase.co/**', supa); c.add_init_script(TELLER)
        p = c.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200])); p.on('dialog', lambda d: d.accept())
        p.goto(B + 'login.html?logout=1'); p.wait_for_timeout(300)
        if uid: p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", token(uid))
        return c, p

    print('A. Uitnodigen (Marcel)')
    c, p = ctx_voor(MARCEL)
    p.evaluate("([u, k]) => localStorage.setItem('fibro_privkey_' + u, k)", [MARCEL, M.priv])
    p.goto(B + 'vrienden.html'); p.wait_for_timeout(1500)
    p.evaluate("() => window.openInviteModal()"); p.wait_for_timeout(1500)
    link = p.evaluate("() => (document.getElementById('invite-link') || {}).value || ''")
    check('link heeft #s= met het begin van de vingerafdruk van mijn sleutel', link.endswith('#s=' + VINGER[:32]) and '?token=fibro-' in link, link)
    p.evaluate("u => localStorage.removeItem('fibro_privkey_' + u)", MARCEL)
    p.evaluate("() => window.openInviteModal()"); p.wait_for_timeout(1500)
    link2 = p.evaluate("() => (document.getElementById('invite-link') || {}).value || ''")
    check('zonder sleutel op dit toestel: geen #s=', '?token=fibro-' in link2 and '#' not in link2, link2)
    c.close()

    print('B. Bestaand account (Bram) tikt Toevoegen')
    c, p = ctx_voor(BRAM)
    p.goto(B + 'invite.html?token=abc#s=' + VINGER[:32]); p.wait_for_timeout(1500)
    p.click('#toevoegBtn'); p.wait_for_timeout(600)
    check('Brams toestel onthoudt de vingerafdruk uit de link', p.evaluate(SLEUTEL, [BRAM, MARCEL]) == VINGER[:32], p.evaluate(SLEUTEL, [BRAM, MARCEL]))
    c.close()
    c, p = ctx_voor(BRAM)
    p.evaluate("([k, w]) => localStorage.setItem(k, w)", ['fibro_vriendsleutel_' + BRAM + '_' + MARCEL, VINGER])
    p.goto(B + 'invite.html?token=abc#s=' + VINGER[:32]); p.wait_for_timeout(1500); p.click('#toevoegBtn'); p.wait_for_timeout(600)
    check('al een lange vingerafdruk die past: blijft staan', p.evaluate(SLEUTEL, [BRAM, MARCEL]) == VINGER, p.evaluate(SLEUTEL, [BRAM, MARCEL]))
    c.close()
    c, p = ctx_voor(BRAM)
    p.goto(B + 'invite.html?token=abc#s=zz' + VINGER[:30]); p.wait_for_timeout(1500); p.click('#toevoegBtn'); p.wait_for_timeout(600)
    check('rommel achter het hekje: niets onthouden', p.evaluate(SLEUTEL, [BRAM, MARCEL]) is None, p.evaluate(SLEUTEL, [BRAM, MARCEL]))
    c.close()

    print('C. Nieuw account via de link, en de herstelcode')
    c, p = ctx_voor(None)
    p.goto(B + 'invite.html?token=abc#s=' + VINGER[:32]); p.wait_for_timeout(1500)
    p.fill('#wachtwoord', 'geheim1234'); p.fill('#geboortejaar', '1990'); p.check('#akkoord')
    p.evaluate("() => { window.__gok = 0 }")
    p.click('#regBtn'); p.wait_for_timeout(3000)
    p.click('text=Geen Face ID? Gebruik een herstelcode'); p.wait_for_selector('#herstelScherm', state='visible', timeout=15000); p.wait_for_timeout(300)
    code = p.evaluate("() => document.getElementById('herstelCode').textContent.trim()")
    gok = p.evaluate("() => window.__gok")
    check('nieuw account onthoudt de vingerafdruk uit de link', p.evaluate(SLEUTEL, [NIEUW, MARCEL]) == VINGER[:32], p.evaluate(SLEUTEL, [NIEUW, MARCEL]))
    check('invite.html: herstelcode zonder Math.random', gok == 0 and len(code) == 20 and code.startswith('FIBRO-'), (gok, code))
    c.close()
    c, p = ctx_voor(None)
    p.goto(B + 'login.html?logout=1&r=1#registreren'); p.wait_for_timeout(1000)  # andere zoekregel: echt opnieuw laden
    p.fill('#reg-wachtwoord', 'geheim1234'); p.fill('#reg-jaar', '1990'); p.check('#reg-akkoord')
    p.evaluate("() => { window.__gok = 0 }")
    p.click('#reg-btn'); p.wait_for_timeout(3000)
    p.click('text=Geen Face ID? Gebruik een herstelcode'); p.wait_for_selector('text=Bewaar je herstelsleutel op een veilige plek', timeout=15000); p.wait_for_timeout(300)
    gok = p.evaluate("() => window.__gok")
    t = p.evaluate("() => document.body.innerText")
    check('login.html: herstelcode zonder Math.random', gok == 0 and 'FIBRO-' in t, (gok, t[-200:].replace('\n', ' | ')))
    c.close()

    print('D. Chat bij Bram')
    BALK = "() => { const b = document.getElementById('sleutelBalk'); return b ? getComputedStyle(b).display : null }"
    def chat(onthouden, server_pub):
        staat['marcel_pub'] = server_pub
        c, p = ctx_voor(BRAM)
        p.evaluate("([k, w, u, b]) => { localStorage.setItem(k, w); localStorage.setItem('fibro_privkey_' + u, b) }", ['fibro_vriendsleutel_' + BRAM + '_' + MARCEL, onthouden, BRAM, BR.priv])
        p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
        p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(1500)
        r = (p.evaluate(BALK), p.evaluate(SLEUTEL, [BRAM, MARCEL])); c.close(); return r
    b, w = chat(VINGER[:32], M.pub)
    check('vingerafdruk uit de link klopt: geen balk, wordt de lange', b == 'none' and w == VINGER, (b, w))
    b, w = chat(VINGER[:32], ANDER.pub)
    check('server laat een andere sleutel zien: meteen de gele balk', b == 'flex' and w == VINGER[:32], (b, w))
    b, w = chat(VINGER, M.pub)
    check('lange vingerafdruk zoals in v181: geen balk', b == 'none' and w == VINGER, (b, w))
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (' + str(len(fouten)) + '): ' + ', '.join(fouten))
