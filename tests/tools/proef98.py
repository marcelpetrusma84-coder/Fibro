# proef98: Fibro sneller (v203). Echte index.html, chat.html, vrienden.html, service-worker.js en kastvullen.js; een eigen
# server zoals GitHub Pages (max-age=600, Vary: Accept-Encoding, If-Modified-Since) die bijhoudt wat er gevraagd wordt.
#  A. De kast (kastvullen.js):
#   A1 begint kort nadat Home klaar is (de vraag om chat.html binnen 4 s na 'load'; was: na 6 s)
#   A2 daarna staan alle scripts en css van Chat en Vrienden in de kast
#   A3 Chat openen: geen enkel script of css meer bij de server, de lijst staat er
#   A4 Home nog eens (zelfde versie): de kast wordt niet opnieuw nagelopen (geen vraag om chat.html)
#   A5 een update (chat.html laadt een nieuw ?v=, FIBRO_VERSIE +1): Home = de kast meteen opnieuw (was: pas na 6 uur),
#      het nieuwe script en de nieuwe chat.html in de kast; Chat openen = ook dan niets meer bij de server
#  B. Vrienden (nep-Supabase met vertraging):
#   B1 eerste keer: de lijst komt van de server en wordt bewaard
#   B2 Supabase traag (2,5 s), Lotte erbij: Bram staat er binnen 1,2 s (de lijst van de vorige keer), Lotte nog niet;
#      daarna komt Lotte erbij; geen foto's van de server zolang de verse lijst er nog niet is
#   B3 niets veranderd: de rijen blijven dezelfde (niet opnieuw getekend); html in een naam blijft tekst
#   B4 de geblokkeerden worden tegelijk gevraagd (de vraag start voordat de vriendenlijst binnen is)
#  C. geen paginafouten
# Niet meegeteld: service-worker.js (die vraagt de browser zelf na bij elke pagina; een kleine vraag).
# Oude map (v202) als controle: A1, A5, B2 en B4 MIS.
# python3 -I proef98.py <map>
import sys, os, re, time, json, socket, tempfile, threading, shutil, asyncio, http.server, functools
from playwright.async_api import async_playwright
MAP = os.path.abspath(sys.argv[1])
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'; LOTTE = 'cccc0002-0000-4000-8000-000000000003'
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:260] if info != '' else ''), flush=True)
def token(uid): return json.dumps({"access_token": "tok", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})

# ---- server zoals GitHub Pages, met een logboek ----
www = tempfile.mkdtemp(); LINK = www + '/Fibro'
def wijs(doel):
    if os.path.islink(LINK): os.remove(LINK)
    os.symlink(doel, LINK)
wijs(MAP)
LOG = []; LOCK = threading.Lock()
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        with LOCK: LOG.append((time.time(), self.path))
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'max-age=600'); self.send_header('Vary', 'Accept-Encoding'); super().end_headers()
    def log_message(self, *a): pass
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', poort), functools.partial(H, directory=www))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
def gevraagd(sinds, tot=None): return [p for t, p in list(LOG) if t >= sinds and (tot is None or t <= tot)]

# ---- wat Chat en Vrienden meteen laden (statisch, zoals de browser het ziet) ----
def statisch(map_, pagina):
    uit, todo, gezien = set(), [os.path.join(map_, pagina)], set()
    while todo:
        p = todo.pop()
        if p in gezien or not os.path.exists(p): continue
        gezien.add(p); s = open(p, encoding='utf-8', errors='replace').read(); basis = os.path.dirname(p)
        if p.endswith('.html'):
            refs = re.findall(r'<script[^>]*\ssrc="([^"]+\?v=\d+)"', s) + re.findall(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+\?v=\d+)"', s)
            for m in re.finditer(r'<script type="module">(.*?)</script>', s, re.S):
                refs += re.findall(r'''^\s*import\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+\?v=\d+)['"]''', m.group(1), re.M)
        else:
            refs = re.findall(r'''^\s*(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+\?v=\d+)['"]''', s, re.M)
        for r in refs:
            if re.search(r"['+ ]", r): continue   # opgebouwd tijdens het laden (lettertype), geen vast bestand
            pad, v = r.split('?')
            vol = os.path.normpath(os.path.join(basis, pad)); uit.add(os.path.relpath(vol, map_) + '?' + v)
            if pad.endswith('.js'): todo.append(vol)
    return uit

# ---- nep-Supabase (met vertraging) ----
SUPA = {'ms': 0, 'lotte': False, 'log': []}
def vr(): return {"id": BRAM, "username": "Bram", "display_name": None, "bio": "", "avatar_url": "\U0001F438", "mood": "", "online_status": "online",
                  "offline_emoji": None, "offline_bericht": None, "laatst_gezien": NU, "updated_at": "2026-10-01T10:00:00Z", "avatar_versie": "a1", "public_key": "x" * 120, "avatar_data": None}
def lt(): return {"id": LOTTE, "username": "Lotte <b>x</b>", "display_name": None, "bio": "", "avatar_url": "\U0001F98A", "mood": "", "online_status": None,
                  "offline_emoji": None, "offline_bericht": None, "laatst_gezien": None, "updated_at": "2026-10-01T10:00:00Z", "avatar_versie": "a2", "public_key": "y" * 120, "avatar_data": None}
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
IK = {"id": MARCEL, "username": "Marcel", "display_name": None, "bio": "Hoi", "avatar_url": "\U0001F419", "public_key": None, "avatar_data": None, "wallpaper_data": None}
async def supa(route):
    u = route.request.url; m = route.request.method; t0 = time.time()
    if SUPA['ms']: await asyncio.sleep(SUPA['ms'] / 1000)
    def klaar(): SUPA['log'].append((t0, time.time(), m, u))
    vrienden = [vr()] + ([lt()] if SUPA['lotte'] else [])
    if '/rest/v1/friendships' in u:
        klaar(); return await route.fulfill(status=200, json=[{"friend_id": v['id'], "user_id": MARCEL, "status": "accepted", "profiles": v} for v in vrienden])
    if '/rpc/mijn_geblokkeerden' in u: klaar(); return await route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and m == 'GET':
        klaar()
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return await route.fulfill(status=200, json=IK if MARCEL in u else vrienden[0])
        return await route.fulfill(status=200, json=[v for v in vrienden if v['id'] in u] if 'in.' in u else [IK])
    if '/auth/v1/user' in u: klaar(); return await route.fulfill(status=200, json={"id": MARCEL, "aud": "authenticated"})
    klaar()
    return await route.fulfill(status=200, json=[] if m == 'GET' else {})
def ws(w):
    def bericht(msg):
        if isinstance(msg, (bytes, bytearray)): return
        try: jr, ref, topic, event, payload = json.loads(msg)
        except Exception: return
        if event == 'phx_join':
            pg_ = [dict(f, id=k + 1) for k, f in enumerate(((payload or {}).get('config') or {}).get('postgres_changes') or [])]
            w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {'postgres_changes': pg_}}])); return
        if ref: w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {}}]))
    w.on_message(bericht)
fouten = []
async def nieuwe_context(br, sw):
    ctx = await br.new_context(service_workers='allow' if sw else 'block', viewport={'width': 390, 'height': 844})
    await ctx.route('**/*supabase.co/**', supa)
    await ctx.route_web_socket('**/realtime/v1/websocket**', ws)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(str(e)[:200]))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
    await pg.goto(BASIS + 'manifest.json')
    await pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", token(MARCEL))
    return ctx, pg
async def wacht(pg, js, ms, arg=None):
    try: await pg.wait_for_function(js, arg=arg, timeout=ms); return True
    except Exception: return False
STEMPEL = "() => localStorage.getItem('fibro_kast_gevuld')"
KAST = "async () => { const uit = []; for (const k of await caches.keys()) if (/^fibro-v\\d+$/.test(k)) for (const r of await (await caches.open(k)).keys()) uit.push(r.url); return uit }"
KOPIE = "async a => { for (const k of await caches.keys()) { const r = await (await caches.open(k)).match(a); if (r) return await r.text() } return null }"
def rel(urls): return {u.split('/Fibro/', 1)[1] for u in urls if '/Fibro/' in u}

async def deel_a(br):
    print('--- A: de kast ---', flush=True)
    ctx, pg = await nieuwe_context(br, True)
    t_nav = time.time()
    await pg.goto(BASIS + 'index.html')
    t_load = (await pg.evaluate("performance.timing.loadEventEnd")) / 1000
    gevuld = await wacht(pg, "() => !!localStorage.getItem('fibro_kast_gevuld')", 90000)
    chat_vraag = [t for t, p in list(LOG) if t >= t_nav and p.split('?')[0].endswith('/chat.html')]
    eerste = (chat_vraag[0] - t_load) if chat_vraag else None
    check('A1 de kast begint kort nadat Home klaar is (chat.html binnen 4 s na load)', gevuld and eerste is not None and eerste < 4.0, (gevuld, eerste and round(eerste, 2)))
    inkast = rel(await pg.evaluate(KAST))
    nodig = statisch(MAP, 'chat.html') | statisch(MAP, 'vrienden.html')
    mist = sorted(nodig - inkast)
    check('A2 alle scripts en css van Chat en Vrienden in de kast (%d)' % len(nodig), len(nodig) > 30 and not mist, mist[:6])
    t = time.time()
    await pg.goto(BASIS + 'chat.html')
    lijst = await wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length > 0", 15000)
    await pg.wait_for_timeout(2000)
    naar_server = [p for p in gevraagd(t) if re.search(r'\.(js|css)\?v=', p) and 'service-worker.js' not in p]   # (de portier zelf vraagt de browser altijd na)
    check('A3 Chat openen: geen script of css meer bij de server, de lijst staat er', lijst and not naar_server, (lijst, naar_server[:6]))
    stempel = await pg.evaluate(STEMPEL)
    t = time.time()
    await pg.goto(BASIS + 'index.html'); await pg.wait_for_timeout(9000)
    opnieuw = [p for p in gevraagd(t) if p.split('?')[0].endswith('/chat.html')]
    check('A4 Home nog eens (zelfde versie): de kast niet opnieuw nagelopen', not opnieuw and await pg.evaluate(STEMPEL) == stempel, opnieuw[:3])
    # A5: een update
    map2 = tempfile.mkdtemp()
    for f in os.listdir(MAP):
        if f not in ('chat.html', 'index.html'): os.symlink(os.path.join(MAP, f), os.path.join(map2, f))
    chat = open(MAP + '/chat.html', encoding='utf-8').read()
    oud_v = re.search(r'bellen\.js\?v=(\d+)', chat).group(1); nieuw_ref = 'bellen.js?v=9' + oud_v
    open(map2 + '/chat.html', 'w', encoding='utf-8').write(chat.replace('bellen.js?v=' + oud_v, nieuw_ref))
    idx = open(MAP + '/index.html', encoding='utf-8').read()
    fv = int(re.search(r'^const FIBRO_VERSIE = (\d+)$', idx, re.M).group(1))
    open(map2 + '/index.html', 'w', encoding='utf-8').write(re.sub(r'^const FIBRO_VERSIE = \d+$', 'const FIBRO_VERSIE = %d' % (fv + 1), idx, flags=re.M))
    os.utime(map2 + '/chat.html', (time.time() + 5, time.time() + 5))
    wijs(map2)
    t = time.time()
    await pg.goto(BASIS + 'index.html')
    nieuw = await wacht(pg, "r => { const s = localStorage.getItem('fibro_kast_gevuld'); return s !== r }", 40000, stempel)
    await pg.wait_for_timeout(1500)
    inkast = rel(await pg.evaluate(KAST))
    kopie = await pg.evaluate(KOPIE, BASIS + 'chat.html')
    check('A5 na een update meteen opnieuw: het nieuwe script en de nieuwe chat.html in de kast', nieuw and nieuw_ref in inkast and kopie is not None and nieuw_ref in kopie,
          (nieuw, nieuw_ref in inkast, bool(kopie and nieuw_ref in kopie)))
    t = time.time()
    await pg.goto(BASIS + 'chat.html')
    await wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length > 0", 15000)
    await pg.wait_for_timeout(2000)
    naar_server = [p for p in gevraagd(t) if re.search(r'\.(js|css)\?v=', p) and 'service-worker.js' not in p]
    check('A6 en dan Chat: ook het nieuwe script komt uit de kast', not naar_server, naar_server[:6])
    wijs(MAP)
    await ctx.close()

RIJEN = "() => [...document.querySelectorAll('#vriendenLijst .friend-row')].map(r => r.dataset.vid)"
async def deel_b(br):
    print('--- B: Vrienden ---', flush=True)
    ctx, pg = await nieuwe_context(br, False)
    SUPA.update(ms=0, lotte=False); SUPA['log'].clear()
    await pg.goto(BASIS + 'vrienden.html')
    ok = await wacht(pg, "() => document.querySelectorAll('#vriendenLijst .friend-row').length === 1", 10000)
    bewaard = await pg.evaluate("u => !!localStorage.getItem('fibro_vriendenpagina_' + u)", MARCEL)
    check('B1 eerste keer: de lijst van de server (Bram), en bewaard', ok and bewaard and await pg.evaluate(RIJEN) == [BRAM], (ok, bewaard))
    await pg.wait_for_timeout(1000)
    # B2
    SUPA.update(ms=2500, lotte=True); SUPA['log'].clear()
    t0 = time.time()
    await pg.goto(BASIS + 'vrienden.html', wait_until='commit')
    snel = await wacht(pg, "b => [...document.querySelectorAll('#vriendenLijst .friend-row')].some(r => r.dataset.vid === b)", 1200, BRAM)
    rij1 = await pg.evaluate(RIJEN)
    lotte = await wacht(pg, "l => [...document.querySelectorAll('#vriendenLijst .friend-row')].some(r => r.dataset.vid === l)", 9000, LOTTE)
    vriendenlijst = [x for x in SUPA['log'] if '/rest/v1/friendships' in x[3]]
    eind = vriendenlijst[0][1] if vriendenlijst else time.time()
    fotos_vroeg = [x for x in SUPA['log'] if 'avatar_data' in x[3] and x[0] < eind]
    check('B2 Supabase traag: Bram meteen (lijst van de vorige keer), Lotte nog niet; daarna Lotte erbij', snel and rij1 == [BRAM] and lotte, (snel, rij1, lotte, round(time.time() - t0, 1)))
    check('B2b geen foto\'s van de server zolang de verse lijst er nog niet is', not fotos_vroeg, [x[3][-80:] for x in fotos_vroeg][:2])
    gebl = [x for x in SUPA['log'] if 'mijn_geblokkeerden' in x[3]]
    check('B4 de geblokkeerden tegelijk gevraagd (voordat de vriendenlijst binnen is)', vriendenlijst and gebl and gebl[0][0] < vriendenlijst[0][1] - 1.0,
          (vriendenlijst and round(vriendenlijst[0][1] - vriendenlijst[0][0], 2), gebl and round(gebl[0][0] - vriendenlijst[0][0], 2)))
    await pg.wait_for_timeout(1500)
    # B3
    SUPA['log'].clear()
    await pg.goto(BASIS + 'vrienden.html', wait_until='commit')
    snel = await wacht(pg, "l => [...document.querySelectorAll('#vriendenLijst .friend-row')].some(r => r.dataset.vid === l)", 1200, LOTTE)
    await pg.evaluate("() => document.querySelectorAll('#vriendenLijst .friend-row').forEach(r => { r.__merk = 1 })")
    await wacht(pg, "() => false", 4500)
    zelfde = await pg.evaluate("() => { const r = [...document.querySelectorAll('#vriendenLijst .friend-row')]; return r.length === 2 && r.every(x => x.__merk === 1) }")
    binnen = any('/rest/v1/friendships' in x[3] for x in SUPA['log'])
    tekst = await pg.evaluate("() => ({ b: document.querySelectorAll('#vriendenLijst b').length, t: document.getElementById('vriendenLijst').textContent.includes('Lotte <b>x</b>') })")
    check('B3 niets veranderd: dezelfde rijen blijven staan (niet opnieuw getekend); html in een naam blijft tekst', snel and binnen and zelfde and tekst == {'b': 0, 't': True}, (snel, binnen, zelfde, tekst))
    klik = await pg.evaluate("l => { const r = [...document.querySelectorAll('#vriendenLijst .friend-row')].find(x => x.dataset.vid === l); return !!r }", LOTTE)
    if klik:
        await pg.click('#vriendenLijst .friend-row[data-vid="%s"]' % LOTTE)
        await pg.wait_for_timeout(1200)
    check('B5 een tik op een rij werkt nog (profiel van Lotte)', 'vriend-profiel.html?id=' + LOTTE in pg.url, pg.url)
    await ctx.close()

async def hoofd():
    global NU
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--no-proxy-server'])
        await deel_a(br)
        NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        await deel_b(br)
        await br.close()
try:
    asyncio.run(hoofd())
finally:
    srv.shutdown()
check('C geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef98: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
