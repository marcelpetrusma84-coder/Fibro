# proef103: acht stickers van vel 5 met een meme-geluid (v215), echte chat.html, naar proef101:
#  A. stickervellen.js: vel 5 heeft de nieuwe geluiden (OMG! = ooh, Bedankt! = dankbaar, Gelukt! = tadaa, Nee! = fout,
#     Ben zo terug = zoefweg, Noob = gameover, Cringe = kras, GOAT = hoorn), de andere vier en alle namen en bewegingen
#     zoals in v208; twaalf verschillende geluiden, elk met zijn mp3
#  B. in de chat: OMG!, Noob en GOAT versturen (echte klik) = precies dat mp3-geluid klinkt (herkend aan de SHA-1 van het
#     bestand: hoorn.mp3 en boing.mp3 zijn toevallig even groot), fxsticker:f5-NN gaat versleuteld mee
#  C. een binnengekomen Ben zo terug aantikken = zoefweg klinkt
#  D. Engels; geen paginafouten
# Oude map (v214) als controle: A en B MIS.
# python3 -I proef103.py <map>
import sys, os, re, time, json, socket, subprocess, tempfile, shutil, hashlib
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nepslot; NEP = nepslot.Nep(MAP, UID, FID)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
VEL5 = [('01', 'LOL', 'LOL', 'hup', 'lach'), ('02', 'Rollen van het lachen', 'ROFL', 'draai', 'boing'), ('03', 'OMG!', 'OMG!', 'duw', 'ooh'),
        ('04', 'Bedankt!', 'Thanks!', 'hartslag', 'dankbaar'), ('05', 'Gelukt!', 'Done!', 'stuiter', 'tadaa'), ('06', 'Nee!', 'No!', 'schud', 'fout'),
        ('07', 'Ben zo terug', 'Be right back', 'flakker', 'zoefweg'), ('08', 'Vibing', 'Vibing', 'wiebel', 'rock'), ('09', 'Noob', 'Noob', 'glitch', 'gameover'),
        ('10', 'Cringe', 'Cringe', 'knik', 'kras'), ('11', 'GOAT', 'GOAT', 'oplichten', 'hoorn'), ('12', 'Meh', 'Meh', 'kantel', 'moe')]
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:230] if info != '' else ''), flush=True)
groot = {}  # (de SHA-1 van elk mp3-bestand)
for g in set(x[4] for x in VEL5):
    p = os.path.join(MAP, 'geluiden', g + '.mp3'); groot[g] = hashlib.sha1(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None
check('A elk geluid van vel 5 heeft zijn mp3', all(groot.values()), [g for g, h in groot.items() if not h])

staat = {'pub': None, 'posts': [], 'rijen': []}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'POST':
        staat['posts'].append(json.loads(route.request.post_data or '{}'))
        return route.fulfill(status=201, json={"id": "mnieuw%d" % len(staat['posts'])})
    if '/rest/v1/messages' in u and m == 'GET':
        return route.fulfill(status=200, json=[{'id': 'm%02d' % i, 'sender_id': FID, 'receiver_id': UID, 'content': NEP.inhoud(FID, c, '2026-10-24T00:%02d:00.000Z' % i), 'created_at': '2026-10-24T00:%02d:00.000Z' % i,
                                                'expires_at': '2026-11-23T00:00:00.000Z', 'antwoord_op': None} for i, c in enumerate(staat['rijen'])][::-1])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}; vriend = {"id": FID, "username": "flamingo", "avatar_url": "\U0001F9A9", "public_key": staat['pub']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
# welk mp3-bestand klinkt: de blob-adressen onthouden met hun grootte
TELLER = """
(() => { window.__blob = {}; window.__gespeeld = []
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('')
  const maak = URL.createObjectURL
  URL.createObjectURL = function (b) {
    const u = maak.apply(this, arguments)
    try { b.arrayBuffer().then(a => crypto.subtle.digest('SHA-1', a)).then(h => { window.__blob[u] = hex(h) }).catch(() => {}) } catch (e) {}
    return u }
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    if (this.dataset && this.dataset.stickerfx && !this._zegen && String(this.src || '').startsWith('blob:')) window.__gespeeld.push(this.src)
    return speel.apply(this, arguments) }
})()
"""
GESPEELD = "() => window.__gespeeld.map(u => window.__blob[u] || u)"
fouten = []
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    def ev(p, js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:100]
    def chat(taal):
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(TELLER)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(taal + ': ' + str(e)[:200]))
        p.goto(BASIS + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l) }", [TOKEN, taal])
        p.evaluate("([u, k]) => localStorage.setItem('fibro_privkey_' + u, k)", [UID, NEP.ik.priv]); staat['pub'] = NEP.vriend.pub
        p.goto(BASIS + 'chat.html')
        try: p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000); p.click('#vriendenLijst .vriend-item')
        except Exception: pass
        p.wait_for_timeout(1500)
        return ctx, p
    OPEN5 = "() => { if (!document.querySelector('#stickerGrid .sk-vak') || document.getElementById('stickerGrid').offsetParent === null) toggleStickers(); const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\"f5\"]'); if (v) v.click() }"
    VELLEN = "() => { const s = [...document.querySelectorAll('script[type=module]')].map(x => x.textContent).join('\\n'); const m = /\\.\\/stickervellen\\.js\\?v=\\d+/.exec(s); return m ? m[0] : './stickervellen.js' }"
    staat['rijen'] = ['fxsticker:f5-07']
    ctx, p = chat('nl')
    vel = ev(p, "async vv => (await import(vv)).FIBRO_VELLEN[4].stickers.map(s => [s.nr, s.naam[0], s.naam[1], s.b, s.g])", ev(p, VELLEN))
    check('A vel 5: de nieuwe geluiden, namen en bewegingen zoals in v208', vel == [list(x) for x in VEL5], vel)
    check('A twaalf verschillende geluiden', isinstance(vel, list) and len(set(x[4] for x in vel)) == 12, '')
    p.mouse.click(5, 5); p.wait_for_timeout(2500)  # eerste tik: de mp3's ophalen
    for nr, naam, g in (('03', 'OMG!', 'ooh'), ('09', 'Noob', 'gameover'), ('11', 'GOAT', 'hoorn')):
        ev(p, OPEN5); p.wait_for_timeout(400)
        voor = ev(p, "window.__gespeeld.length"); n_post = len(staat['posts'])
        try: p.locator('#stickerGrid .sk-sticker').nth(int(nr) - 1).click(timeout=3000)
        except Exception: pass
        p.wait_for_timeout(1200)
        gespeeld = ev(p, GESPEELD)
        nieuw = gespeeld[voor:] if isinstance(gespeeld, list) and isinstance(voor, int) else gespeeld
        inhoud = str((staat['posts'][-1] if len(staat['posts']) > n_post else {}).get('content', ''))
        cache = ev(p, "u => localStorage.getItem('fibro_msg_cache_' + u) || ''", UID)
        check('B %s versturen (echte klik): %s klinkt, fxsticker:f5-%s versleuteld' % (naam, g, nr),
              isinstance(nieuw, list) and groot[g] in nieuw and inhoud.startswith('e2e:') and ('"fxsticker:f5-%s"' % nr) in str(cache), (nieuw, groot[g], inhoud[:12]))
    # C. binnengekomen Ben zo terug aantikken
    voor = ev(p, "window.__gespeeld.length")
    try: p.locator('#messages .fx-sticker[src="stickers/f5/07.webp"]').first.click(timeout=3000)
    except Exception: pass
    p.wait_for_timeout(1200)
    gespeeld = ev(p, GESPEELD)
    nieuw = gespeeld[voor:] if isinstance(gespeeld, list) and isinstance(voor, int) else gespeeld
    check('C binnengekomen Ben zo terug aantikken: zoefweg klinkt', isinstance(nieuw, list) and groot['zoefweg'] in nieuw, (nieuw, groot['zoefweg']))
    ctx.close()
    # D. Engels
    staat['rijen'] = []
    ctx, p = chat('en'); ev(p, OPEN5); p.wait_for_timeout(500)
    namen = ev(p, "() => [...document.querySelectorAll('#stickerGrid .sk-sticker')].map(b => b.getAttribute('aria-label'))")
    check('D Engels: de namen van vel 5', namen == ['Send sticker ' + x[2] for x in VEL5], namen)
    ctx.close(); br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
check('D geen paginafouten', fouten == [], fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef103: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
