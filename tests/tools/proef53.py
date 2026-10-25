# proef53: stickers met beweging en geluid (v153) in de echte chat.html.
# A. de stickerkeuze: 12 vakjes (6 vellen van Fibro, 2 eigen, 4 winkel), labels, lege vakjes zeggen wat er
#    komt, 4 stickers naast elkaar op de telefoon, niet te hoog, niet te breed, het gekozen vakje blijft
#    bewaard; de oude tabbladen, het oude venster 'Eigen sticker toevoegen' en de oude eigen stickers
#    (localStorage fibro_custom_stickers) zijn weg.
# B. versturen: tik op een sticker = geluid, de keuze gaat dicht, en er gaat alleen 'fxsticker:f1-03'
#    mee, versleuteld (op de server staat e2e:...).
# C. tonen: oude berichten met een fxsticker: plaatje van 120 px, stil (geen beweging, geen geluid);
#    onbekende of rare code = '🖼️ Sticker' als tekst (geen html); oude lossticker uit de eigen map
#    weer zichtbaar (veiligeUrl liet alleen https/data/blob toe), een raar pad niet.
# D. tik op een sticker in de chat: beweging + geluid.
# E. nieuw bericht via Realtime: van de ander beweging + geluid, van jezelf alleen beweging.
# F. Engels.
# Een testvel (f1, 12 stickers) wordt in een eigen www-map over de map heen gelegd (stickervellen.js +
# stickers/f1/*.webp); de map zelf blijft onaangeroerd. Oude map als controle: daar moet bijna alles MIS geven.
# python3 -I proef53.py <map>
import sys, os, re, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
from playwright._impl import _network as _pwn
def _sluitPagina(self, event):  # Playwright 1.56: 'code' ontbreekt soms als de pagina de verbinding sluit
    if self._on_page_close: self._on_page_close(event.get('code'), event.get('reason'))
_pwn.WebSocketRoute._channel_close_page = _sluitPagina
from PIL import Image, ImageDraw

MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
# v181: berichten versleuteld zoals in het echt (nepslot.py); zonder slot toont de nieuwe chat geen sticker meer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nepslot; NEP = nepslot.Nep(MAP, UID, FID)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
FOTO = os.environ.get('FOTO')  # FOTO=<map>: schermafbeeldingen van de keuze en de chat
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''))

# ── www-map: de map met een testvel erover ──
www = tempfile.mkdtemp(); fib = www + '/Fibro'; os.makedirs(fib)
for n in os.listdir(MAP):
    if n in ('stickervellen.js', 'stickers'): continue
    os.symlink(os.path.join(MAP, n), os.path.join(fib, n))
os.makedirs(fib + '/stickers/f1')
if os.path.isdir(MAP + '/stickers'):
    for n in os.listdir(MAP + '/stickers'):
        if n != 'f1': os.symlink(os.path.join(MAP, 'stickers', n), os.path.join(fib, 'stickers', n))  # v156: het echte vel 1 vervangen we
TEST = [('Grote ogen', 'Big eyes', 'groei', 'boing'), ('Vampier', 'Vampire', 'wiebel', 'slurp'), ('Error 404', 'Error 404', 'glitch', 'error'),
        ('Ugh', 'Ugh', 'knik', 'klets'), ('Drama!', 'Drama!', 'stuiter', 'popcorn'), ('Lit!', 'Lit!', 'flakker', 'vuur'),
        ('Alert!', 'Alert!', 'schud', 'alarm'), ('Huh?', 'Huh?', 'kantel', 'huh'), ('Idee!', 'Idea!', 'oplichten', 'ting'),
        ('Stop', 'Stop', 'duw', 'zoemer'), ('Krekels', 'Crickets', 'hup', 'tsjirp'), ('Mind blown', 'Mind blown', 'ontplof', 'boem')]
for i in range(12):
    im = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((16, 16, 240, 240), fill=(250, 243, 230, 255)); d.ellipse((30, 30, 226, 226), fill=(40 + i * 17, 120, 220 - i * 12, 255))
    im.save(fib + '/stickers/f1/%02d.webp' % (i + 1), 'WEBP', quality=80)
# emoji_0_0.webp voor de oude lossticker (staat niet in upload-alles): een echt plaatje maken
if not os.path.exists(fib + '/stickers/emoji_0_0.webp'): Image.new('RGBA', (64, 64), (255, 200, 0, 255)).save(fib + '/stickers/emoji_0_0.webp', 'WEBP')
vellen = open(MAP + '/stickervellen.js').read() if os.path.exists(MAP + '/stickervellen.js') else "export const FIBRO_VELLEN = [ { id: 'f1', stickers: [] } ]\nexport function zoekSticker(){return null}\n"
regel = "  { id: 'f1', stickers: [] },"
gevuld = "  { id: 'f1', stickers: [\n" + ''.join("    { nr: '%02d', naam: [%s, %s], b: '%s', g: '%s' },\n" % (i + 1, json.dumps(a), json.dumps(b), c, e) for i, (a, b, c, e) in enumerate(TEST)) + "  ] },"
# v156: vel 1 is in het echt al gevuld; het testvel komt ervoor in de plaats (wat er ook staat)
vellen = re.sub(r"^  \{ id: 'f1', stickers: \[.*?\] \},$", lambda m: regel, vellen, count=1, flags=re.S | re.M)
open(fib + '/stickervellen.js', 'w').write(vellen.replace(regel, gevuld))

# ── nep-REST ──
def iso(i): return '2026-10-15T01:%02d:00.000Z' % i
staat = {'pub': None, 'rijen': [], 'posts': []}
def berichten():
    uit = []
    for i, (van, inhoud) in enumerate(staat['rijen']):
        uit.append({'id': 'm%02d' % i, 'sender_id': van, 'receiver_id': FID if van == UID else UID, 'content': NEP.inhoud(van, inhoud, iso(i)),
                    'created_at': iso(i), 'expires_at': '2026-11-15T00:00:00.000Z', 'antwoord_op': None})
    return list(reversed(uit))
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'POST':
        try: staat['posts'].append(json.loads(route.request.post_data or '{}'))
        except Exception: staat['posts'].append({})
        return route.fulfill(status=201, json={"id": "mnieuw%d" % len(staat['posts'])})
    if '/rest/v1/messages' in u and m == 'GET': return route.fulfill(status=200, json=berichten())
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted",
                                                                            "profiles": {"id": FID, "username": "flamingo", "avatar_url": "🦩", "public_key": staat['pub']}}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}
        vriend = {"id": FID, "username": "flamingo", "avatar_url": "🦩", "public_key": staat['pub']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])

# ── nep-Realtime (zoals proef30) ──
rt = {'conns': [], 'pgid': 0}
class Conn:
    def __init__(s, ws):
        s.ws = ws; s.dicht = False; s.topics = {}
        ws.on_message(s.bericht); ws.on_close(lambda *a: setattr(s, 'dicht', True))
    def stuur(s, arr):
        if s.dicht: return
        try: s.ws.send(json.dumps(arr))
        except Exception: s.dicht = True
    def bericht(s, msg):
        if not isinstance(msg, str): return
        try: join_ref, ref, topic, event, payload = json.loads(msg)
        except Exception: return
        if event == 'heartbeat': return s.stuur([None, ref, 'phoenix', 'phx_reply', {"status": "ok", "response": {}}])
        if event == 'phx_join':
            pg = []
            for f in ((payload or {}).get('config') or {}).get('postgres_changes') or []:
                rt['pgid'] += 1; pg.append((rt['pgid'], f))
            s.topics[topic] = {'join_ref': join_ref, 'pg': pg}
            return s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": {"postgres_changes": [dict(f, id=i) for i, f in pg]}}])
        if event == 'phx_leave':
            s.topics.pop(topic, None); return s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": {}}])
        if ref: s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": {}}])
def bezorg(rec, soort='INSERT', table='messages'):
    n = 0
    for c in [c for c in rt['conns'] if not c.dicht]:
        for topic, info in list(c.topics.items()):
            ids = []
            for i, f in info['pg']:
                if f.get('table') != table or f.get('event') not in ('*', soort): continue
                flt = f.get('filter')
                if flt:
                    kol, waarde = flt.split('=eq.')
                    if rec.get(kol) != waarde: continue
                ids.append(i)
            if ids:
                c.stuur([info['join_ref'], None, topic, 'postgres_changes', {"ids": ids, "data": {"type": soort, "schema": "public", "table": table,
                         "commit_timestamp": rec['created_at'], "record": rec, "columns": [], "errors": None}}]); n += 1
    return n

# Telt de oscillatoren van het geluid van stickerfx.js (die AudioContext maakt als enige een compressor)
# (het stille toontje van 1 sample dat het geluid ontgrendelt telt niet mee)
TELLER = """
(() => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
  window.__fxosc = 0
  const comp = AC.prototype.createDynamicsCompressor, start = AudioScheduledSourceNode.prototype.start
  AC.prototype.createDynamicsCompressor = function () { this.__fx = true; return comp.apply(this, arguments) }
  AudioScheduledSourceNode.prototype.start = function () {
    if (this.context && this.context.__fx && !(this.buffer && this.buffer.length <= 1)) window.__fxosc++
    return start.apply(this, arguments) }
  // v160: de geluiden zijn mp3's (<audio data-stickerfx> met een blob-adres): die tellen ook (niet het stille zegenen)
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    if (this.dataset && this.dataset.stickerfx && !this._zegen && String(this.src || '').startsWith('blob:')) { window.__fxosc++; window.__fxmp3 = (window.__fxmp3 || 0) + 1 }
    return speel.apply(this, arguments) }
})()
"""

with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    def chatpagina(taal, voor=None, breed=390):
        ctx = br.new_context(service_workers='block', viewport={'width': breed, 'height': 844})
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda ws: rt['conns'].append(Conn(ws)))
        ctx.add_init_script(TELLER)
        p = ctx.new_page(); p.fouten = []
        p.on('pageerror', lambda e: p.fouten.append(str(e)[:200])); p.on('dialog', lambda d: (p.fouten.append('dialoog: ' + d.message), d.dismiss()))
        p.goto(BASIS + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
        p.evaluate("t => localStorage.setItem('fibro_taal', t)", taal)
        if voor: p.evaluate(voor)
        p.evaluate("([u, k]) => localStorage.setItem('fibro_privkey_' + u, k)", [UID, NEP.ik.priv]); staat['pub'] = NEP.vriend.pub
        p.goto(BASIS + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
        p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(2000)
        return ctx, p
    def klik(p, sel):  # op de oude code bestaat het meestal niet: dan niet vastlopen
        try: p.click(sel, timeout=2000); return True
        except Exception: return False
    def openKeuze(p):
        p.evaluate("() => { const g = document.getElementById('stickerGrid'); if (g.style.display === 'none') toggleStickers() }"); p.wait_for_timeout(200)
    VAKKEN = "() => [...document.querySelectorAll('#stickerGrid .sk-vak')].map(b => b.getAttribute('aria-label'))"
    INHOUD = "() => { const i = document.querySelector('#stickerGrid .sk-inhoud'); return i ? i.innerText.trim() : null }"

    # ───────────── A + B: de keuze en versturen ─────────────
    print('A. stickerkeuze')
    staat['rijen'] = [(FID, 'Hoi')]
    ctx, p = chatpagina('nl', voor="localStorage.setItem('fibro_custom_stickers', JSON.stringify([{image:'data:image/webp;base64,AAAA', geluid:'pop'}]))")
    openKeuze(p)
    vak = p.evaluate(VAKKEN)
    check('12 vakjes: Vel 1-6, Eigen vel 1-2, Winkelvak 1-4', vak == ['Vel %d' % i for i in range(1, 7)] + ['Eigen vel 1', 'Eigen vel 2'] + ['Winkelvak %d' % i for i in range(1, 5)], vak)
    rijen = p.evaluate("() => [...document.querySelectorAll('#stickerGrid .sk-rij')].map(r => [...r.children].map(b => Math.round(b.getBoundingClientRect().top)))")
    check('twee rijen van zes, elk op een lijn', len(rijen) == 2 and all(len(r) == 6 and len(set(r)) == 1 for r in rijen) and rijen[0][0] < rijen[1][0], rijen)
    lab = p.evaluate("() => [...document.querySelectorAll('#stickerGrid .sk-label')].map(l => l.innerText.replace(/\\s+/g, ' ').trim())")
    check('labels: Vellen van Fibro / Eigen Winkel', lab == ['Vellen van Fibro', 'Eigen Winkel'], lab)
    klik(p, '#stickerGrid .sk-vak[data-vak="f1"]')
    n = p.evaluate("() => document.querySelectorAll('#stickerGrid .sk-sticker img').length")
    kol = p.evaluate("() => { const r = document.querySelector('#stickerGrid .sk-raster'); return r ? getComputedStyle(r).gridTemplateColumns.split(' ').length : 0 }")
    geladen = p.evaluate("() => Promise.all([...document.querySelectorAll('#stickerGrid .sk-sticker img')].map(i => i.decode().then(() => i.naturalWidth > 0, () => false)))")
    check('vel 1 (testvel): 12 stickers, 4 naast elkaar op de telefoon, plaatjes geladen', n == 12 and kol == 4 and all(geladen), (n, kol, geladen.count(True)))
    ico = p.evaluate("() => { const i = document.querySelector('#stickerGrid .sk-vak[data-vak=\"f1\"] img'); return i ? i.getAttribute('src') : null }")
    check('het vakje van een gevuld vel toont de eerste sticker', ico == 'stickers/f1/01.webp', ico)
    klik(p, '#stickerGrid .sk-vak[data-vak="f6"]'); t2 = p.evaluate(INHOUD)  # v208: vel 5 is gevuld, vel 6 nog leeg
    if FOTO: p.screenshot(path=FOTO + '/keuze-vel2.png')
    klik(p, '#stickerGrid .sk-vak[data-vak="e1"]'); te = p.evaluate(INHOUD)
    klik(p, '#stickerGrid .sk-vak[data-vak="w3"]'); tw = p.evaluate(INHOUD)
    # (v190: Profiel heet nu Stijl; v208: dit stond nog op 'in Profiel')
    check('leeg vel / eigen / winkel zeggen wat er komt', t2 and t2.startswith('Vel 6 is nog leeg') and te and te.startswith('Je eigen stickers maak je in Stijl') and tw and 'winkel' in tw, (t2, te, tw))
    sel = p.evaluate("() => [...document.querySelectorAll('#stickerGrid .sk-vak')].filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.dataset.vak)")
    check('precies een vakje gekozen (w3)', sel == ['w3'], sel)
    maat = p.evaluate("() => { const g = document.getElementById('stickerGrid'); return { h: Math.round(g.getBoundingClientRect().height), sw: g.scrollWidth, cw: g.clientWidth, doc: document.documentElement.scrollWidth } }")
    klik(p, '#stickerGrid .sk-vak[data-vak="f1"]')
    maat1 = p.evaluate("() => Math.round(document.getElementById('stickerGrid').getBoundingClientRect().height)")
    if FOTO: p.screenshot(path=FOTO + '/keuze-vel1.png')
    check('niet te hoog (< 380 px) en niet breder dan het scherm', maat1 < 380 and maat['sw'] <= maat['cw'] and maat['doc'] <= 390, (maat1, maat))
    oud = p.evaluate("() => ({ tab: document.querySelectorAll('.sticker-tab').length, venster: !!document.getElementById('stickerUploadModal'), eigen: localStorage.getItem('fibro_custom_stickers') })")
    check('oude tabbladen, oud venster en oude eigen stickers weg', oud == {'tab': 0, 'venster': False, 'eigen': None}, oud)

    print('B. versturen')
    voor = p.evaluate("window.__fxosc || 0")
    klik(p, '#stickerGrid .sk-sticker >> nth=2'); p.wait_for_timeout(1500)
    na = p.evaluate("window.__fxosc || 0")
    post = staat['posts'][-1] if staat['posts'] else {}
    inhoud = str(post.get('content', ''))
    cache = p.evaluate("u => localStorage.getItem('fibro_msg_cache_' + u) || ''", UID)
    dicht = p.evaluate("document.getElementById('stickerGrid').style.display")
    check('versturen: geluid bij het versturen', na > voor, (voor, na))
    check('versturen: versleuteld naar de server (e2e:), niet leesbaar', inhoud.startswith('e2e:') and 'fxsticker' not in inhoud and 'f1-03' not in inhoud, inhoud[:60])
    check('versturen: in het bericht staat alleen fxsticker:f1-03', '"fxsticker:f1-03"' in cache, cache[-120:])
    check('versturen: de keuze gaat dicht', dicht == 'none', dicht)
    p.reload(); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
    p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(1500); openKeuze(p)
    sel = p.evaluate("() => [...document.querySelectorAll('#stickerGrid .sk-vak')].filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.dataset.vak)")
    check('het laatst gekozen vakje blijft bewaard', sel == ['f1'], sel)
    check('A/B: geen fouten op de pagina', p.fouten == [], p.fouten)
    ctx.close()

    # ───────────── C + D + E: tonen, tikken, nieuw ─────────────
    print('C. tonen')
    staat['rijen'] = [(FID, 'fxsticker:f1-02'), (UID, 'fxsticker:f1-05'), (FID, 'fxsticker:f9-01'), (FID, 'fxsticker:<img src=x onerror=alert(1)>'),
                      (FID, 'lossticker:stickers/emoji_0_0.webp:blij'), (FID, 'lossticker:../../geheim.webp:blij'), (FID, 'Gewoon een bericht')]
    rt['conns'].clear()
    ctx, p = chatpagina('nl')
    st = p.evaluate("""() => [...document.querySelectorAll('#messages .fx-sticker')].map(i => ({ src: i.getAttribute('src'), w: Math.round(i.getBoundingClientRect().width),
        ok: i.complete && i.naturalWidth > 0, anim: i.getAnimations().length, uit: i.closest('.msg-row').classList.contains('out'), alt: i.alt }))""")
    check('fxsticker in oude berichten: plaatje 120 px van de ander en van mij', [(x['src'], x['w'], x['ok'], x['uit']) for x in st] == [('stickers/f1/02.webp', 120, True, False), ('stickers/f1/05.webp', 120, True, True)], st)
    check('fxsticker heeft een naam (alt) voor schermlezers', [x['alt'] for x in st] == ['Vampier', 'Drama!'], [x['alt'] for x in st])
    stil = p.evaluate("window.__fxosc || 0")
    check('oude berichten zijn stil en bewegen niet bij het openen', stil == 0 and all(x['anim'] == 0 for x in st), (stil, [x['anim'] for x in st]))
    bub = p.evaluate("() => [...document.querySelectorAll('#messages .bubble-content')].map(b => b.textContent)")
    check('onbekende of rare code: "🖼️ Sticker" als tekst, geen html', bub.count('\U0001F5BC️ Sticker') == 2 and not p.evaluate("!!document.querySelector('#messages img[src=\"x\"]')") and 'fxsticker' not in p.evaluate("document.getElementById('messages').innerText"), bub)
    los = p.evaluate("""() => [...document.querySelectorAll('#messages .msg-row img')].filter(i => !i.classList.contains('fx-sticker') && i.style.width === '80px').map(i => i.getAttribute('src'))""")
    check('oude sticker (lossticker) uit de eigen map weer zichtbaar, raar pad niet', los == ['stickers/emoji_0_0.webp', ''], los)

    print('D. tikken')
    klik(p, '#messages .fx-sticker >> nth=0'); p.wait_for_timeout(100)
    anim = p.evaluate("() => { const i = document.querySelectorAll('#messages .fx-sticker')[0]; return i ? i.getAnimations().length : 0 }")
    tik = p.evaluate("window.__fxosc || 0")
    check('tik op een sticker in de chat: beweging + geluid', anim >= 1 and tik > 0, (anim, tik))

    print('E. nieuw via Realtime')
    for _ in range(50):
        if any(c.topics for c in rt['conns'] if not c.dicht): break
        p.wait_for_timeout(200)
    p.wait_for_timeout(1500)
    voor = p.evaluate("window.__fxosc || 0")
    n = bezorg({"id": "mrt1", "sender_id": FID, "receiver_id": UID, "content": NEP.inhoud(FID, "fxsticker:f1-11", iso(40)), "created_at": iso(40), "antwoord_op": None, "expires_at": "2026-11-15T00:00:00.000Z"})
    p.wait_for_timeout(300)
    nw = p.evaluate("() => { const i = [...document.querySelectorAll('#messages .fx-sticker')].pop(); return i ? { src: i.getAttribute('src'), anim: i.getAnimations().length } : null }")
    na = p.evaluate("window.__fxosc || 0")
    check('nieuwe sticker van de ander: beweging + geluid', n and nw and nw['src'] == 'stickers/f1/11.webp' and nw['anim'] >= 1 and na > voor, (n, nw, voor, na))
    p.wait_for_timeout(1500)
    voor = p.evaluate("window.__fxosc || 0")
    bezorg({"id": "mrt2", "sender_id": UID, "receiver_id": FID, "content": NEP.inhoud(UID, "fxsticker:f1-12", iso(41)), "created_at": iso(41), "antwoord_op": None, "expires_at": "2026-11-15T00:00:00.000Z"})
    p.wait_for_timeout(300)
    nw = p.evaluate("() => { const i = [...document.querySelectorAll('#messages .fx-sticker')].pop(); return i ? { src: i.getAttribute('src'), anim: i.getAnimations().length } : null }")
    na = p.evaluate("window.__fxosc || 0")
    check('eigen nieuwe sticker: beweegt, geen tweede keer geluid', nw and nw['src'] == 'stickers/f1/12.webp' and nw['anim'] >= 1 and na == voor, (nw, voor, na))
    if FOTO: p.screenshot(path=FOTO + '/chat.png')
    check('C/D/E: geen fouten op de pagina', p.fouten == [], p.fouten)
    ctx.close()

    # ───────────── F: Engels ─────────────
    print('F. Engels')
    staat['rijen'] = [(FID, 'fxsticker:f9-01')]
    ctx, p = chatpagina('en')
    openKeuze(p)
    vak = p.evaluate(VAKKEN)
    lab = p.evaluate("() => [...document.querySelectorAll('#stickerGrid .sk-label')].map(l => l.innerText.replace(/\\s+/g, ' ').trim())")
    klik(p, '#stickerGrid .sk-vak[data-vak="f6"]'); t3 = p.evaluate(INHOUD)
    klik(p, '#stickerGrid .sk-vak[data-vak="e2"]'); te = p.evaluate(INHOUD)
    klik(p, '#stickerGrid .sk-vak[data-vak="w1"]'); tw = p.evaluate(INHOUD)
    klik(p, '#stickerGrid .sk-vak[data-vak="f1"]')
    knop = p.evaluate("() => (document.querySelector('#stickerGrid .sk-sticker') || {}).ariaLabel || ''")
    check('Engels: vakjes en labels', vak[0:1] == ['Sheet 1'] and vak[6:7] == ['Your own sheet 1'] and vak[8:9] == ['Shop slot 1'] and lab == ['Fibro sheets', 'Your own Shop'], (vak, lab))
    check('Engels: lege vakjes', t3 and t3.startswith('Sheet 6 is still empty') and te and te.startswith('You make your own stickers') and tw and tw.startswith('Sticker sheets from the shop'), (t3, te, tw))
    check('Engels: sticker heet in het Engels', knop == 'Send sticker Big eyes', knop)
    check('F: geen fouten op de pagina', p.fouten == [], p.fouten)
    ctx.close()
    srv.terminate(); br.close()

shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
