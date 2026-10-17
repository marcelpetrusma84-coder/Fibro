# proef70: stickers zonder internet (v172). De portier bewaart de stickerplaatjes en -geluiden in zijn eigen kast
# (fibro-media-<n>) en kastvullen.js haalt ze alvast op, ook van een vel dat je nooit geopend hebt.
# Echte Chromium met de echte portier (service-worker.js), een server die net als GitHub Pages "10 minuten vers" zegt,
# en een proef-vel 5 (2 stickers in een kopie van stickervellen.js): dat moet vanzelf meedoen.
# Verloop: Home online (portier, kast vullen) -> mediakast compleet? -> Chat online openen (zoals gewoon gebruik) ->
# internet weg (server uit + offline) en de browsercache leeg (zoals GitHub na 10 minuten) -> Chat: vakjes 1, 4 en 5
# (echte klikken), alle plaatjes laden; een sticker versturen (echte klik) = mp3-geluid -> weer online: een nieuwe
# MP3_VERSIE ruimt de oude op; een nieuw getal in MEDIA_KAST (vervangen plaatje) = oude kast weg, nieuw plaatje.
# Oude map als controle: daar is er geen mediakast en werken de stickers zonder internet niet.
# python3 -I proef70.py <map>
import sys, os, re, time, json, socket, subprocess, tempfile, shutil, hashlib
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1]); HIER = os.path.dirname(os.path.abspath(__file__))
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''))

# --- een kopie van de app, met alle plaatjes en geluiden (upload-alles heeft ze niet allemaal) en een proef-vel 5
www = tempfile.mkdtemp(); APP = www + '/Fibro'
shutil.copytree(MAP, APP, ignore=shutil.ignore_patterns('tests', '.git'))
def lees(p): return open(os.path.join(APP, p), encoding='utf-8').read()
fxtekst = lees('stickerfx.js')
MP3V = re.search(r'\bMP3_VERSIE\s*=\s*(\d+)', fxtekst).group(1)
NAMEN = [n for n in re.findall(r'^ {2}([\w$]+):\s*\{\s*naam:', re.search(r'\bGELUIDEN\s*=\s*\{([\s\S]*?)\n\}', fxtekst).group(1), re.M) if n != 'geen']
os.makedirs(APP + '/geluiden', exist_ok=True)
voorbeeld_mp3 = next((os.path.join(APP, 'geluiden', f) for f in sorted(os.listdir(APP + '/geluiden')) if f.endswith('.mp3')), None)
for n in NAMEN:
    if not os.path.exists(APP + '/geluiden/' + n + '.mp3'): shutil.copy(voorbeeld_mp3, APP + '/geluiden/' + n + '.mp3')
for vel in ['f1', 'f2', 'f3', 'f4']:
    os.makedirs(APP + '/stickers/' + vel, exist_ok=True)
    for nr in range(1, 13):
        doel = APP + '/stickers/%s/%02d.webp' % (vel, nr)
        if not os.path.exists(doel): shutil.copy(APP + '/stickers/f2/%02d.webp' % nr, doel)
vellen = lees('stickervellen.js')
assert vellen.count("{ id: 'f5', stickers: [] }") == 1
vellen = vellen.replace("{ id: 'f5', stickers: [] }", "{ id: 'f5', stickers: [ { nr: '01', naam: ['Proef A', 'Test A'], b: 'hup', g: 'pling' }, { nr: '02', naam: ['Proef B', 'Test B'], b: 'hup', g: 'ting' } ] }")
open(APP + '/stickervellen.js', 'w', encoding='utf-8').write(vellen)
os.makedirs(APP + '/stickers/f5', exist_ok=True)
for nr in (1, 2): shutil.copy(APP + '/stickers/f3/%02d.webp' % nr, APP + '/stickers/f5/%02d.webp' % nr)
VELV = re.search(r'stickervellen\.js\?v=(\d+)', lees('chat.html')).group(1)
VERWACHT = sorted(['stickers/f%d/%02d.webp' % (v, n) for v in (1, 2, 3, 4) for n in range(1, 13)] + ['stickers/f5/01.webp', 'stickers/f5/02.webp'] +
                  ['geluiden/%s.mp3?v=%s' % (n, MP3V) for n in NAMEN])
print('verwacht in de mediakast: %d (%d plaatjes, %d geluiden), MP3_VERSIE %s' % (len(VERWACHT), 50, len(NAMEN), MP3V))

staat = {'pub': None, 'online': True, 'posts': []}
def supa(route):
    if not staat['online']: return route.abort('internetdisconnected')
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'POST':
        staat['posts'].append(1); return route.fulfill(status=201, json={"id": "mnieuw%d" % len(staat['posts'])})
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}; vriend = {"id": FID, "username": "flamingo", "avatar_url": "\U0001F9A9", "public_key": staat['pub']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
TELLER = """
(() => { const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    if (this.dataset && this.dataset.stickerfx && !this._zegen && String(this.src || '').startsWith('blob:')) window.__fxmp3 = (window.__fxmp3 || 0) + 1
    return speel.apply(this, arguments) }
})()
"""
MEDIA = """async () => { const n = (await caches.keys()).find(k => /^fibro-media-\\d+$/.test(k)); if (!n) return null
  const k = await caches.open(n); const uit = []
  for (const r of await k.keys()) { const a = await k.match(r); const u = new URL(r.url); uit.push([u.pathname.replace(/^\\/Fibro\\//, '') + u.search, a.status]) }
  return [n, uit] }"""

s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
srv = {'p': None}
def server_aan():
    srv['p'] = subprocess.Popen([sys.executable, '-I', HIER + '/server.py', www, str(poort)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
def server_uit():
    if srv['p']: srv['p'].terminate(); srv['p'].wait(); srv['p'] = None
server_aan()
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(service_workers='allow', viewport={'width': 390, 'height': 844})
    ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(TELLER)
    p = ctx.new_page(); fouten = []
    p.on('pageerror', lambda e: fouten.append(str(e)[:200])); p.on('dialog', lambda d: d.accept())
    def ev(js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:120]
    p.goto(BASIS + 'manifest.json')
    ev("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
    staat['pub'] = ev("""async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); const v = await c.genereerKeypair();
      c.slaPrivateKeyOp(uid, ik.privateKeyB64); return v.publicKeyB64 }""", UID)
    # 1. Home online: de portier komt, daarna nog een keer Home: kastvullen.js loopt na 6 s
    p.goto(BASIS + 'index.html')
    try: p.wait_for_function("() => !!navigator.serviceWorker.controller", timeout=15000)
    except Exception: pass
    p.goto(BASIS + 'index.html')
    try: p.wait_for_function("() => { try { return !!JSON.parse(localStorage.getItem('fibro_kast_gevuld') || 'null') } catch (e) { return false } }", timeout=90000)
    except Exception: pass
    p.wait_for_timeout(1500)
    stempel = ev("() => JSON.parse(localStorage.getItem('fibro_kast_gevuld') || 'null')")
    check('de kast is gevuld, de stempel noemt de mediakast', isinstance(stempel, dict) and stempel.get('media') == 'fibro-media-1', stempel)
    m = ev(MEDIA)
    inhoud = sorted(x[0] for x in m[1]) if isinstance(m, list) else []
    check('Home online: alle %d plaatjes en geluiden staan in de mediakast (ook vel 1 en het nooit geopende vel 5)' % len(VERWACHT), inhoud == VERWACHT,
          (len(inhoud), [x for x in VERWACHT if x not in inhoud][:4], [x for x in inhoud if x not in VERWACHT][:4]))
    check('alleen echte bestanden (status 200), geen andere kast-namen', isinstance(m, list) and all(x[1] == 200 for x in m[1]) and m[0] == 'fibro-media-1', m if not isinstance(m, list) else m[0])
    # 2. Chat een keer online openen (gewoon gebruik)
    p.goto(BASIS + 'chat.html')
    try: p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
    except Exception: pass
    p.wait_for_timeout(2500)
    # 3. internet weg en de browsercache leeg (zoals bij GitHub Pages na 10 minuten)
    staat['online'] = False; server_uit(); ctx.set_offline(True)
    cdp = ctx.new_cdp_session(p); cdp.send('Network.clearBrowserCache')
    p.goto(BASIS + 'chat.html')
    try:
        p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
        p.click('#vriendenLijst .vriend-item')
    except Exception: pass
    p.wait_for_timeout(1500)
    def vakje(vel):
        try:
            if not p.is_visible('#stickerGrid'): p.click('button.emoji-toggle:has-text("\U0001F3A8")', timeout=3000)
            p.click('#stickerGrid .sk-vak[data-vak="%s"]' % vel, timeout=3000)
        except Exception as e: return 'FOUT ' + str(e)[:80]
        p.wait_for_timeout(800)
        return ev("() => Promise.all([...document.querySelectorAll('#stickerGrid .sk-sticker img')].map(i => i.decode().then(() => [i.naturalWidth, i.getAttribute('src')], () => [0, i.getAttribute('src')])))")
    for vel, n in (('f1', 12), ('f4', 12), ('f5', 2)):
        r = vakje(vel)
        check('zonder internet, vakje %s (echte klik): alle %d plaatjes laden' % (vel[1], n), isinstance(r, list) and len(r) == n and all(x[0] == 384 for x in r), r if not isinstance(r, list) else [x for x in r if x[0] != 384][:3])
    voor = ev("window.__fxmp3 || 0")
    try: p.locator('#stickerGrid .sk-sticker').nth(1).click(timeout=3000)
    except Exception: pass
    p.wait_for_timeout(1200)
    na = ev("window.__fxmp3 || 0")
    check('zonder internet: een sticker versturen (echte klik) speelt zijn mp3 (niet het reservegeluid)', isinstance(na, int) and isinstance(voor, int) and na > voor, (voor, na))
    alle = ev("async l => { let ok = 0; for (const a of l) { try { const r = await fetch(a); if (r.ok && (await r.blob()).size > 100) ok++ } catch (e) {} } return ok }", [x for x in VERWACHT if x.startswith('geluiden/')])
    check('zonder internet: alle %d geluiden zijn op te halen' % len(NAMEN), alle == len(NAMEN), alle)
    # 4. weer online: een nieuwe MP3_VERSIE (hier ?v=999) ruimt de oude versie op
    server_aan(); ctx.set_offline(False); staat['online'] = True
    r = ev("""async () => { const n = (await caches.keys()).find(k => /^fibro-media-\\d+$/.test(k)); if (!n) return null
      const res = await fetch('geluiden/lach.mp3?v=999'); await res.blob(); await new Promise(k => setTimeout(k, 800))
      const k = await caches.open(n); return (await k.keys()).map(r => new URL(r.url)).filter(u => u.pathname.endsWith('/lach.mp3')).map(u => u.search) }""")
    check('nieuwe MP3_VERSIE: alleen de nieuwe versie blijft in de kast', r == ['?v=999'], r)
    # 5. een vervangen plaatje: nieuw plaatje op de server, en het getal in MEDIA_KAST omhoog. Eerst zorgen dat de
    # browsercache het oude plaatje nog vers heeft (10 minuten), zoals vlak na gebruik: de portier mag dat niet nemen.
    ev("""async () => { const n = (await caches.keys()).find(k => /^fibro-media-\\d+$/.test(k)); if (n) await (await caches.open(n)).delete('stickers/f4/05.webp')
      await (await fetch('stickers/f4/05.webp')).blob() }""")
    shutil.copy(APP + '/stickers/f3/07.webp', APP + '/stickers/f4/05.webp'); NIEUW_SHA = hashlib.sha256(open(APP + '/stickers/f4/05.webp', 'rb').read()).hexdigest()
    sw = lees('service-worker.js')
    if "'fibro-media-1'" in sw: open(APP + '/service-worker.js', 'w', encoding='utf-8').write(sw.replace("'fibro-media-1'", "'fibro-media-2'"))
    p.goto(BASIS + 'index.html')
    ev("async () => { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update() }")
    try: p.wait_for_function("async () => (await caches.keys()).includes('fibro-media-2')", timeout=20000)
    except Exception: pass
    p.goto(BASIS + 'index.html')
    try: p.wait_for_function("() => { try { return (JSON.parse(localStorage.getItem('fibro_kast_gevuld') || 'null') || {}).media === 'fibro-media-2' } catch (e) { return false } }", timeout=90000)
    except Exception: pass
    kasten = ev("async () => (await caches.keys()).filter(k => k.startsWith('fibro-media')).sort()")
    check('nieuw getal in MEDIA_KAST: de oude kast is weg', kasten == ['fibro-media-2'], kasten)
    m2 = ev(MEDIA)
    check('en kastvullen.js vult de nieuwe kast meteen weer (alles)', isinstance(m2, list) and sorted(x[0] for x in m2[1]) == VERWACHT, (len(m2[1]) if isinstance(m2, list) else m2))
    sha = ev("""async () => { const k = await caches.open('fibro-media-2'); const r = await k.match('stickers/f4/05.webp'); if (!r) return null
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await r.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('') }""")
    check('het vervangen plaatje is het nieuwe (niet het oude uit de browsercache)', sha == NIEUW_SHA, (str(sha)[:12], NIEUW_SHA[:12]))
    check('geen fouten op de pagina', fouten == [], fouten)
    ctx.close(); br.close()
server_uit()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
