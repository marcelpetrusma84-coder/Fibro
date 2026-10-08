import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef23: een bericht of sticker raakt nooit stil kwijt. Lukt versturen niet (server weg, geen internet),
# dan blijft het in de chat staan als "Niet verstuurd · tik om opnieuw te proberen", ook na verversen.
# python3 -I proef23.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www23_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
staat = {'kapot': False, 'posts': [], 'pub': None}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'POST':
        if staat['kapot']: return route.fulfill(status=503, json={"message": "even weg"})
        staat['posts'].append(json.loads(route.request.post_data or '{}'))
        return route.fulfill(status=201, json={"id": "nieuw%d" % len(staat['posts'])}, headers={'content-type': 'application/vnd.pgrst.object+json'})
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID}])
    if '/rest/v1/messages' in u and m == 'GET': return route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}
        vriend = {"id": FID, "username": "flamingo", "avatar_url": "x", "public_key": staat['pub']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    if m == 'GET': return route.fulfill(status=200, json=[])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
NV = "u => { try { return JSON.parse(localStorage.getItem('fibro_nietverstuurd_' + u) || '[]') } catch (e) { return null } }"
RIJEN = "() => [...document.querySelectorAll('#messages .msg-nietverstuurd')].map(r => r.innerText.replace(/\\s+/g, ' '))"
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200])); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    k = p.evaluate("""async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); const v = await c.genereerKeypair();
      c.slaPrivateKeyOp(uid, ik.privateKeyB64); return v.publicKeyB64 }""", UID)
    staat['pub'] = k
    def openChat():
        p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
        p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(1500)
    print('1. Server even weg: bericht versturen')
    openChat(); staat['kapot'] = True
    p.fill('#msgInput', 'Hallo daar'); p.evaluate("() => window.sendMsg()"); p.wait_for_timeout(1500)
    r = p.evaluate(RIJEN); nv = p.evaluate(NV, UID)
    check('bericht blijft staan als niet verstuurd', len(r) == 1 and 'Hallo daar' in r[0] and 'Niet verstuurd' in r[0], r)
    check('bewaard op dit toestel', nv and len(nv) == 1 and nv[0]['tekst'] == 'Hallo daar', nv)
    print('2. Ook een sticker')
    p.evaluate("() => window.sendStickerMetGeluid('\\u{1F600}', 'blij')"); p.wait_for_timeout(1200)
    r = p.evaluate(RIJEN)
    check('sticker blijft staan als niet verstuurd', len(r) == 2 and 'sticker' in r[1], r)
    print('3. Verversen: nog steeds daar')
    openChat(); r = p.evaluate(RIJEN)
    check('na verversen nog allebei zichtbaar', len(r) == 2, r)
    print('4. Server weer goed: tikken = opnieuw versturen')
    staat['kapot'] = False
    p.click('#messages .msg-nietverstuurd .nv-blok >> nth=0'); p.wait_for_timeout(1500)
    r = p.evaluate(RIJEN); nv = p.evaluate(NV, UID)
    check('bericht verstuurd en weg uit de lijst', len(r) == 1 and len(nv) == 1 and len(staat['posts']) == 1 and staat['posts'][0]['content'].startswith('e2e:'), (r, nv, len(staat['posts'])))
    p.click('#messages .msg-nietverstuurd .nv-blok >> nth=0'); p.wait_for_timeout(1500)
    check('sticker ook verstuurd', p.evaluate(RIJEN) == [] and p.evaluate(NV, UID) == [] and len(staat['posts']) == 2, (p.evaluate(RIJEN), len(staat['posts'])))
    print('5. Geen internet: niet eens proberen, wel bewaren')
    cdp = ctx.new_cdp_session(p); cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    p.fill('#msgInput', 'Zonder internet'); p.evaluate("() => window.sendMsg()"); p.wait_for_timeout(1200)
    r = p.evaluate(RIJEN)
    check('zonder internet: blijft staan, niets naar de server', len(r) == 1 and 'Zonder internet' in r[0] and len(staat['posts']) == 2, (r, len(staat['posts'])))
    p.click('#messages .msg-nietverstuurd .nv-blok >> nth=0'); p.wait_for_timeout(800)
    check('tikken zonder internet zegt dat', 'Geen internet' in p.evaluate(RIJEN)[0], p.evaluate(RIJEN))
    cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    print('6. Gewoon versturen werkt nog')
    p.click('#messages .msg-nietverstuurd .nv-blok >> nth=0'); p.wait_for_timeout(1500)
    p.fill('#msgInput', 'Gewoon'); p.evaluate("() => window.sendMsg()"); p.wait_for_timeout(1200)
    check('gewoon versturen: geen melding', p.evaluate(RIJEN) == [] and len(staat['posts']) == 4, (p.evaluate(RIJEN), len(staat['posts'])))
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
