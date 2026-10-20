# proef85: een sticker geeft een pushmelding (v189), echte chat.html, echte klikken, nep-server die bijhoudt wat er
# verstuurd wordt (messages) en welke pushmeldingen de app vraagt (functions/v1/stuur-push).
#  1. een sticker van Fibro versturen (echte klik in de stickerkeuze): versleuteld naar de server en een pushmelding
#     voor de vriend (soort 'bericht', zoals tekst; de server kiest de tekst, wat erin staat blijft geheim)
#  2. een tekstbericht: nog steeds een pushmelding
#  3. sticker terwijl de server even weg is: 'Niet verstuurd'; server terug, tik = verstuurd en dan de pushmelding
#  4. een buzz: nog steeds een eigen pushmelding (soort 'buzz')
# Geen paginafouten. Oude map (v188) als controle: bij een sticker geen pushmelding (1 en 3 MIS).
# python3 -I proef85.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nepslot
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NEP = nepslot.Nep(MAP, UID, FID)
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
staat = {'kapot': False, 'posts': [], 'push': []}
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/functions/v1/stuur-push' in u:
        staat['push'].append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=200, json={"ok": True})
    if '/rest/v1/messages' in u and m == 'POST':
        if staat['kapot']: return route.fulfill(status=503, json={"message": "even weg"})
        staat['posts'].append(json.loads(route.request.post_data or '{}'))
        return route.fulfill(status=201, json={"id": "nieuw%d" % len(staat['posts'])}, headers={'content-type': 'application/vnd.pgrst.object+json'})
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}; vriend = {"id": FID, "username": "Bram", "avatar_url": "x", "public_key": NEP.vriend.pub}
        if obj: return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
NV = "() => [...document.querySelectorAll('#messages .msg-nietverstuurd')].length"
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server']); ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL')
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: (fouten.append('dialoog: ' + d.message[:80]), d.accept()))
    p.goto(B + 'login.html')
    p.evaluate("([t, u, k]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_privkey_' + u, k) }", [TOKEN, UID, NEP.ik.priv])
    p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
    p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(2000)
    def sticker():
        p.evaluate("() => { const g = document.getElementById('stickerGrid'); if (g.style.display === 'none') toggleStickers() }"); p.wait_for_timeout(300)
        p.click('#stickerGrid .sk-vak[data-vak="f1"]'); p.wait_for_timeout(200)
        p.click('#stickerGrid .sk-sticker >> nth=0'); p.wait_for_timeout(1500)
    def pushes_naar_bram(): return [x for x in staat['push'] if x.get('receiver_id') == FID]

    print('1. Sticker')
    n0, q0 = len(staat['posts']), len(staat['push']); sticker()
    post = staat['posts'][-1] if len(staat['posts']) > n0 else {}
    nieuw = staat['push'][q0:]
    check('sticker: versleuteld naar de server', str(post.get('content', '')).startswith('e2e:') and post.get('receiver_id') == FID, str(post.get('content', ''))[:20])
    check('sticker: een pushmelding voor Bram (soort bericht)', len(nieuw) == 1 and nieuw[0].get('receiver_id') == FID and nieuw[0].get('type') == 'bericht', nieuw)

    print('2. Tekst')
    q0 = len(staat['push']); p.fill('#msgInput', 'Hoi Bram'); p.click('#sendBtn'); p.wait_for_timeout(1500)
    nieuw = staat['push'][q0:]
    check('tekst: nog steeds een pushmelding', len(nieuw) == 1 and nieuw[0].get('type') == 'bericht', nieuw)

    print('3. Server even weg')
    staat['kapot'] = True; q0 = len(staat['push']); sticker()
    nv = p.evaluate(NV); tussen = staat['push'][q0:]
    staat['kapot'] = False
    p.click('#messages .msg-nietverstuurd .nv-blok >> nth=0'); p.wait_for_timeout(1500)
    na = staat['push'][q0:]
    check("server weg: 'Niet verstuurd' en (nog) geen melding; tik = verstuurd en dan de melding", nv == 1 and tussen == [] and p.evaluate(NV) == 0 and len(na) == 1 and na[0].get('type') == 'bericht', (nv, tussen, na))

    print('4. Buzz')
    q0 = len(staat['push']); p.click('#buzzBtn'); p.wait_for_timeout(1200)
    nieuw = staat['push'][q0:]
    check("buzz: eigen melding (soort buzz)", len(nieuw) == 1 and nieuw[0].get('type') == 'buzz', nieuw)
    check('geen paginafouten of meldvensters', not fouten, fouten[:3])
    br.close()
srv.kill(); shutil.rmtree(www, ignore_errors=True)
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
