# proef297 (13 nov 2026): in de chat de datum boven de berichten van elke dag, en een enter in een bericht.
#  A. berichten van drie dagen: boven elke dag een scheiding (dag en datum, 'Gisteren', 'Vandaag'), op de goede plek;
#     het eerste bericht van een dag toont weer zijn fotootje (niet 'gegroepeerd'); elk bericht houdt zijn tijd
#  B. toetsenbord (pc, Steam Deck): shift + enter = een nieuwe regel, het vak groeit mee; enter = versturen;
#     het bericht toont twee regels en het vak is weer leeg en klein
#  C. telefoon (aanraakscherm): enter = een nieuwe regel, niet versturen
#  D. geen paginafouten
# python3 -I proef297.py <map> [schermafdruk.png]
import sys, os, time, json, socket, subprocess, tempfile, re, datetime
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
FOTO = sys.argv[2] if len(sys.argv) > 2 else None
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)
def token(uid): return json.dumps({"access_token": "tok", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
SERVER = {'berichten': [], 'posts': [], 'sleutels': {}}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'POST':
        r = json.loads(route.request.post_data or '{}'); SERVER['posts'].append(r)
        r = dict(r, id="nieuw%d" % len(SERVER['posts']), created_at=time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()), antwoord_op=None)
        SERVER['berichten'].append(r)   # zo staat het bericht er na opnieuw openen (er is hier geen realtime)
        return route.fulfill(status=201, json={"id": r['id']})
    if '/rest/v1/messages' in u: return route.fulfill(status=200, json=sorted(SERVER['berichten'], key=lambda b: b['created_at'], reverse=True))
    if '/rest/v1/friendships' in u:
        vr = {"id": BRAM, "username": "Bram", "display_name": None, "avatar_url": "\U0001F438", "online_status": True, "laatst_gezien": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), "public_key": SERVER['sleutels'].get(BRAM)}
        return route.fulfill(status=200, json=[{"user_id": MARCEL, "friend_id": BRAM, "status": "accepted", "profiles": vr}])
    if '/rest/v1/profiles' in u and m == 'GET':
        ik = {"id": MARCEL, "username": "Marcel", "display_name": None, "avatar_url": "\U0001F419", "public_key": SERVER['sleutels'].get(MARCEL)}
        vr = {"id": BRAM, "username": "Bram", "display_name": None, "avatar_url": "\U0001F438", "public_key": SERVER['sleutels'].get(BRAM), "avatar_data": None}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vr if BRAM in u else ik)
        return route.fulfill(status=200, json=[vr] if ('in.' in u or BRAM in u) else [ik])
    if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": MARCEL, "aud": "authenticated"})
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    return route.fulfill(status=200, json=[])

www = tempfile.mkdtemp(prefix='proef297_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
crypto = re.search(r"crypto\.js\?v=\d+", open(os.path.join(MAP, 'chat.html'), encoding='utf8').read()).group(0)

def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def toestel(b, aanraak):
    opties = dict(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844})
    if aanraak: opties.update(has_touch=True, is_mobile=True)
    ctx = b.new_context(**opties)
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_profiel_%s', JSON.stringify({ naam: 'Marcel' })) }" % MARCEL, token(MARCEL))
    return ctx, pg
def open_chat(pg):
    pg.goto(BASIS + 'chat.html')
    if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1"): pg.click('#vriendenLijst .vriend-item')
    return wacht(pg, "() => !document.getElementById('sendBtn').disabled", 15000)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx, pg = toestel(b, False)
        # sleutels van Marcel (op dit toestel) en Bram, en berichten van drie dagen (versleuteld met de tijd van toen)
        nu = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
        vandaag = nu.replace(hour=max(nu.hour, 2) if nu.hour else 0)
        plan = [(BRAM, 3, 10, 'Hoi Marcel!'), (BRAM, 3, 10.02, 'Alles goed?'), (MARCEL, 1, 9, 'Ja hoor'), (BRAM, 0, None, 'Goedemorgen'), (MARCEL, 0, None, 'Hallo')]
        keys = pg.evaluate("""async ([mod, ik, vriend]) => { const c = await import(mod)
            const a = await c.genereerKeypair(), b = await c.genereerKeypair(); c.slaPrivateKeyOp(ik, a.privateKeyB64)
            return { m: a, b: b } }""", ['./' + crypto, MARCEL, BRAM])
        SERVER['sleutels'] = {MARCEL: keys['m']['publicKeyB64'], BRAM: keys['b']['publicKeyB64']}
        lokaal = datetime.datetime.now().astimezone()
        for i, (van, dagen, uur, tekst) in enumerate(plan):
            if uur is None: t = nu - datetime.timedelta(minutes=30 - i)
            else:
                d = (lokaal - datetime.timedelta(days=dagen)).replace(hour=int(uur), minute=int(round((uur % 1) * 100)), second=0, microsecond=0)
                t = d.astimezone(datetime.timezone.utc)
            ms = int(t.timestamp() * 1000)
            priv = keys['m']['privateKeyB64'] if van == MARCEL else keys['b']['privateKeyB64']
            pub = SERVER['sleutels'][BRAM] if van == MARCEL else SERVER['sleutels'][MARCEL]
            naar = BRAM if van == MARCEL else MARCEL
            inhoud = pg.evaluate("""async ([mod, tekst, priv, pub, van, naar, ms]) => { const c = await import(mod); const echt = Date.now
                Date.now = () => ms; try { return await c.versleutel(tekst, priv, pub, { soort: 'bericht', van, naar }) } finally { Date.now = echt } }""",
                ['./' + crypto, tekst, priv, pub, van, naar, ms])
            SERVER['berichten'].append({"id": "b%d" % i, "sender_id": van, "receiver_id": naar, "content": inhoud, "created_at": t.strftime('%Y-%m-%dT%H:%M:%S.000Z'), "antwoord_op": None})
        check(open_chat(pg), 'chat met Bram geopend')
        wacht(pg, "() => document.querySelectorAll('#messages .msg-row').length === 5")
        # ── A ──
        volgorde = pg.evaluate("""() => [...document.getElementById('messages').children].map(e => e.classList.contains('dag-scheiding') ? '#' + e.textContent
            : e.classList.contains('msg-row') ? (e.querySelector('.bubble-content')?.textContent || '?') + (e.classList.contains('gegroepeerd') ? '(g)' : '') : null).filter(Boolean)""")
        drie = (lokaal - datetime.timedelta(days=3))
        dagnaam = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'][drie.weekday()]
        check(len(volgorde) == 8 and volgorde[0].startswith('#' + dagnaam) and volgorde[1] == 'Hoi Marcel!' and volgorde[2] == 'Alles goed?(g)'
              and volgorde[3] == '#Gisteren' and volgorde[4] == 'Ja hoor' and volgorde[5] == '#Vandaag' and volgorde[6] == 'Goedemorgen' and volgorde[7] == 'Hallo',
              'A: per dag een datum op de goede plek (%s)' % volgorde)
        check(str(drie.day) in volgorde[0], 'A: met de datum (%s)' % volgorde[0])
        tijden = pg.evaluate("() => [...document.querySelectorAll('#messages .msg-row .bubble-time')].map(e => e.textContent.replace('✓', '').trim())")
        check(len(tijden) == 5 and all(re.match(r'^\d\d:\d\d$', t_) for t_ in tijden) and tijden[0] == '10:00', 'A: elk bericht houdt zijn tijd (%s)' % tijden)
        # ── B ──
        vak = '#msgInput'
        check(pg.evaluate("document.getElementById('msgInput').tagName") == 'TEXTAREA', 'B: het berichtvak is een tekstvak')
        h0 = pg.evaluate("document.getElementById('msgInput').offsetHeight")
        pg.click(vak); pg.keyboard.type('Eerste regel'); pg.keyboard.press('Shift+Enter'); pg.keyboard.type('Tweede regel')
        waarde = pg.evaluate("document.getElementById('msgInput').value"); h1 = pg.evaluate("document.getElementById('msgInput').offsetHeight")
        check(waarde == 'Eerste regel\nTweede regel' and not SERVER['posts'], 'B: shift + enter = een nieuwe regel, nog niet verstuurd (%r)' % waarde)
        check(h1 > h0 + 10, 'B: het vak groeit mee (%d -> %d px)' % (h0, h1))
        pg.keyboard.press('Enter')
        verstuurd = False
        for _ in range(40):
            if SERVER['posts']: verstuurd = True; break
            pg.wait_for_timeout(200)
        check(verstuurd, 'B: enter = versturen')
        check(pg.evaluate("document.getElementById('msgInput').value") == '' and pg.evaluate("document.getElementById('msgInput').offsetHeight") <= h0 + 2, 'B: het vak is weer leeg en klein')
        open_chat(pg)   # opnieuw openen: het bericht komt van de (nep)server, ontsleuteld
        check(wacht(pg, "() => [...document.querySelectorAll('#messages .bubble-content')].some(e => e.textContent === 'Eerste regel\\nTweede regel')", 8000), 'B: het bericht heeft twee regels')
        rij = pg.evaluate("() => { const e = [...document.querySelectorAll('#messages .bubble-content')].find(e => e.textContent.includes('Tweede regel')); return e ? e.getBoundingClientRect().height : 0 }")
        check(rij > 30, 'B: ook echt op twee regels te zien (%d px hoog)' % rij)
        if FOTO: pg.screenshot(path=FOTO)
        ctx.close()
        # ── C ──
        ctx, pg = toestel(b, True)
        pg.evaluate("([mod, ik, priv]) => import(mod).then(c => c.slaPrivateKeyOp(ik, priv))", ['./' + crypto, MARCEL, keys['m']['privateKeyB64']])
        open_chat(pg); n0 = len(SERVER['posts'])
        pg.tap(vak); pg.keyboard.type('Hoi'); pg.keyboard.press('Enter'); pg.keyboard.type('daar')
        time.sleep(0.5)
        check(pg.evaluate("document.getElementById('msgInput').value") == 'Hoi\ndaar' and len(SERVER['posts']) == n0, 'C: op een telefoon is enter een nieuwe regel (%r)' % pg.evaluate("document.getElementById('msgInput').value"))
        pg.tap('#sendBtn')
        for _ in range(40):
            if len(SERVER['posts']) > n0: break
            pg.wait_for_timeout(200)
        open_chat(pg)
        check(wacht(pg, "() => [...document.querySelectorAll('#messages .bubble-content')].some(e => e.textContent === 'Hoi\\ndaar')", 8000), 'C: versturen met de knop ➤ (twee regels)')
        check(not fouten, 'D: geen paginafouten ' + ' | '.join(fouten))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT: %s' % (len(fout), '; '.join(fout))))
sys.exit(1 if fout else 0)
