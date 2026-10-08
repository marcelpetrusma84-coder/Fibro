import subprocess, sys, time, json, os, uuid, urllib.parse as up
from playwright.sync_api import sync_playwright
# proef33: verlopen berichten ook van het toestel weg. De tekst van eigen verstuurde berichten
# (fibro_msg_cache_<ik>) wordt eens per 6 uur nagekeken bij de server; de bewaarde gesprekken
# (fibro_chatlog_*) verliezen hun verlopen berichten meteen. Lukt nakijken niet: niets weg.
# python3 -I proef33.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www33_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; LOTTE = 'cccc0002-0000-4000-8000-000000000002'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NOG = set()  # ids die de server nog heeft
staat = {'kapot': False, 'vragen': []}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and 'id=in.' in u:
        q = up.parse_qs(up.urlparse(u).query); ids = q['id'][0][4:-1].split(',')
        staat['vragen'].append(len(ids))
        if staat['kapot']: return route.fulfill(status=500, json={"message": "kapot"})
        return route.fulfill(status=200, json=[{"id": i} for i in ids if i in NOG])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": LOTTE, "status": "accepted"}])
    if '/rest/v1/profiles' in u and m == 'GET':
        v = {"id": LOTTE, "username": "Lotte", "avatar_url": "x", "public_key": None}; e = {"id": UID, "username": "Marcel"}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=v if LOTTE in u else e)
        return route.fulfill(status=200, json=[v] if ('in.' in u or LOTTE in u) else [e])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:200] if info != '' else ''))
    if not ok: fouten.append(naam)
def iso(t): return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(t)) + '.000Z'
nu = time.time()
ids = [str(uuid.UUID(int=i + 1)) for i in range(250)]
for i, x in enumerate(ids):
    if i % 5 != 0: NOG.add(x)  # 1 op de 5 is verlopen of weg
CACHE = {x: 'tekst ' + str(i) for i, x in enumerate(ids)}
LOGL = [{"id": "l1", "sender_id": LOTTE, "receiver_id": UID, "content": "geldig", "created_at": iso(nu - 60), "expires_at": iso(nu + 86400)},
        {"id": "l2", "sender_id": LOTTE, "receiver_id": UID, "content": "verlopen", "created_at": iso(nu - 90000), "expires_at": iso(nu - 10)}]
LOGB = [{"id": "b1", "sender_id": BRAM, "receiver_id": UID, "content": "verlopen", "created_at": iso(nu - 90000), "expires_at": iso(nu - 10)}]
LEES = """u => ({ cache: JSON.parse(localStorage.getItem('fibro_msg_cache_' + u) || '{}'), stempel: localStorage.getItem('fibro_msgcache_nagekeken_' + u),
  lotte: JSON.parse(localStorage.getItem('fibro_chatlog_' + u + '_cccc0002-0000-4000-8000-000000000002') || 'null'),
  bram: JSON.parse(localStorage.getItem('fibro_chatlog_' + u + '_bbbb0001-0000-4000-8000-000000000001') || 'null') })"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []
    p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200]))); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    def zet():
        p.evaluate("""([u, c, l, b]) => { localStorage.setItem('fibro_msg_cache_' + u, JSON.stringify(c)); localStorage.removeItem('fibro_msgcache_nagekeken_' + u);
          localStorage.setItem('fibro_chatlog_' + u + '_cccc0002-0000-4000-8000-000000000002', JSON.stringify(l));
          localStorage.setItem('fibro_chatlog_' + u + '_bbbb0001-0000-4000-8000-000000000001', JSON.stringify(b)) }""", [UID, CACHE, LOGL, LOGB])
    print('1. Server kapot: niets weggooien')
    zet(); staat['kapot'] = True; del staat['vragen'][:]
    p.goto(B + 'chat.html'); p.wait_for_timeout(18000)
    r = p.evaluate(LEES, UID)
    check('eigen berichten allemaal nog bewaard', len(r['cache']) == 250 and r['stempel'] is None, (len(r['cache']), r['stempel'], staat['vragen']))
    # (het gesprek met Lotte haalt bewaarAlleChats vers op; dat met Bram, geen vriend meer, blijft liggen)
    check('verlopen berichten wel uit de bewaarde gesprekken (gaat niet via de server)', r['bram'] == [], r['bram'])
    print('2. Server goed: verlopen eigen berichten weg, de rest blijft')
    zet(); staat['kapot'] = False; del staat['vragen'][:]
    p.goto(B + 'chat.html'); p.wait_for_timeout(18000)
    r = p.evaluate(LEES, UID)
    over = set(r['cache'])
    check('precies de verlopen 50 weg, 200 over', over == NOG and len(over) == 200, (len(over), len(over - NOG), len(NOG - over)))
    check('in stukjes van 100 gevraagd (3 vragen)', staat['vragen'] == [100, 100, 50], staat['vragen'])
    check('tijd van nakijken bewaard', r['stempel'] is not None)
    print('3. Binnen 6 uur opnieuw: niet nog eens vragen')
    del staat['vragen'][:]
    p.goto(B + 'chat.html'); p.wait_for_timeout(18000)
    check('geen vragen aan de server', staat['vragen'] == [], staat['vragen'])
    check('geen paginafouten', not perr, perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
