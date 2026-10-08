import subprocess, sys, time, json, os, urllib.parse as up
from playwright.sync_api import sync_playwright
# proef34: avatarfoto's van vrienden in Vrienden, de Chat-lijst, de kop van het gesprek en bij de berichten
# (eigen berichten: eigen foto). Foto's alleen ophalen als ze er niet zijn of de vriend opnieuw opsloeg.
# python3 -I proef34.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www34_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; LOTTE = 'cccc0002-0000-4000-8000-000000000002'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
def foto(x): return 'data:image/png;base64,' + PNG + x
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
P = {UID: {"id": UID, "username": "Marcel", "avatar_url": "\U0001F600", "avatar_data": foto('MM=='), "updated_at": "2026-10-01T00:00:00+00:00"},
     LOTTE: {"id": LOTTE, "username": "Lotte", "avatar_url": "\U0001F338", "avatar_data": foto('LL=='), "updated_at": "2026-10-01T00:00:00+00:00",
             "online_status": True, "laatst_gezien": NU, "public_key": None},
     BRAM: {"id": BRAM, "username": "Bram", "avatar_url": "\U0001F419", "avatar_data": None, "updated_at": "2026-10-01T00:00:00+00:00",
            "online_status": False, "laatst_gezien": "2026-10-01T00:00:00Z", "public_key": None}}
MSG = [{"id": "11111111-0000-4000-8000-000000000001", "sender_id": LOTTE, "receiver_id": UID, "content": "Hoi van Lotte", "created_at": NU, "expires_at": "2030-01-01T00:00:00Z"},
       {"id": "11111111-0000-4000-8000-000000000002", "sender_id": UID, "receiver_id": LOTTE, "content": "Hoi terug", "created_at": NU, "expires_at": "2030-01-01T00:00:00Z"}]
log = []
def supa(route):
    u = route.request.url; m = route.request.method
    q = up.parse_qs(up.urlparse(u).query); sel = (q.get('select') or ['*'])[0]
    if '/rest/v1/friendships' in u:
        if 'profiles' in sel:
            kol = sel[sel.index('(') + 1:sel.rindex(')')].replace(' ', '').split(',')
            return route.fulfill(status=200, json=[{"friend_id": v, "profiles": {k: P[v].get(k) for k in kol}} for v in (LOTTE, BRAM)])
        return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": v} for v in (LOTTE, BRAM)])
    if '/rest/v1/profiles' in u and m == 'GET':
        kol = [k.strip() for k in sel.split(',')] if sel != '*' else list(P[UID].keys())
        if 'id' in q and q['id'][0].startswith('in.'):
            ids = q['id'][0][4:-1].split(',')
            if 'avatar_data' in kol: log.append(('fotos', sorted(ids)))
            rows = [{k: P[i].get(k) for k in kol} for i in ids if i in P]
            return route.fulfill(status=200, json=rows)
        wie = next((i for i in P if 'id=eq.' + i in u), UID)
        r = {k: P[wie].get(k) for k in kol}
        if 'avatar_data' in kol: log.append(('een', wie))
        return route.fulfill(status=200, json=r if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [r])
    if '/rest/v1/messages' in u and m == 'GET': return route.fulfill(status=200, json=list(reversed(MSG)))
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:200] if info != '' else ''))
    if not ok: fouten.append(naam)
def staart(s): return (s or '')[-10:]
VRIENDEN = """() => Object.fromEntries([...document.querySelectorAll('.friend-row')].map(r => { const a = r.querySelector('.vriend-foto');
  return [r.dataset.vid, a ? (/^url/.test(a.style.backgroundImage) ? a.style.backgroundImage : ('emoji:' + a.textContent)) : 'geen'] }))"""
CHATLIJST = """() => Object.fromEntries([...document.querySelectorAll('#vriendenLijst .vriend-item')].map(r => { const a = r.querySelector('.vriend-av');
  return [r.dataset.vid, (/^url/.test(a.style.backgroundImage) ? a.style.backgroundImage : ('emoji:' + a.textContent)) + (a.querySelector('.online-dot') ? ' +stip' : '')] }))"""
RIJEN = """() => [...document.querySelectorAll('#messages .msg-row')].map(r => { const a = r.querySelector('.msg-av-sm');
  return (r.classList.contains('out') ? 'ik ' : 'zij ') + (a ? (/^url/.test(a.style.backgroundImage) ? a.style.backgroundImage : ('emoji:' + a.textContent)) : 'geen') })"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []
    p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200]))); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    print('1. Vrienden, eerste keer: foto van Lotte ophalen, Bram heeft geen foto')
    del log[:]; p.goto(B + 'vrienden.html'); p.wait_for_timeout(3000)
    r = p.evaluate(VRIENDEN)
    check('Lotte met foto', 'LL==' in r.get(LOTTE, ''), r.get(LOTTE, '')[-40:])
    check('Bram met emoji', r.get(BRAM) == 'emoji:\U0001F419', r.get(BRAM))
    check('een vraag voor beide foto\'s', [x for x in log if x[0] == 'fotos'] == [('fotos', sorted([LOTTE, BRAM]))], log)
    print('2. Vrienden, tweede keer: niets ophalen, foto blijft')
    del log[:]; p.goto(B + 'vrienden.html'); p.wait_for_timeout(3000)
    r = p.evaluate(VRIENDEN)
    check('Lotte met foto (van dit toestel)', 'LL==' in r.get(LOTTE, ''), r.get(LOTTE, '')[-40:])
    check('geen foto\'s opgehaald', not [x for x in log if x[0] == 'fotos'], log)
    print('3. Chat: lijst, kop en berichten')
    del log[:]; p.goto(B + 'chat.html'); p.wait_for_timeout(3000)
    r = p.evaluate(CHATLIJST)
    check('Chat-lijst: Lotte met foto en online-stip', 'LL==' in r.get(LOTTE, '') and r.get(LOTTE, '').endswith('+stip'), r.get(LOTTE, '')[-50:])
    check('Chat-lijst: Bram met emoji', r.get(BRAM, '').startswith('emoji:\U0001F419'), r.get(BRAM))
    check('Chat: geen foto\'s opgehaald (al op dit toestel)', not [x for x in log if x[0] == 'fotos'], log)
    p.click('#vriendenLijst .vriend-item[data-vid="' + LOTTE + '"]'); p.wait_for_timeout(2000)
    kop = p.evaluate("() => document.getElementById('chatAv').style.backgroundImage")
    check('kop van het gesprek met foto', 'LL==' in kop, kop[-40:])
    rij = p.evaluate(RIJEN)
    check('bericht van Lotte met haar foto, eigen bericht met eigen foto', any(x.startswith('zij ') and 'LL==' in x for x in rij) and any(x.startswith('ik ') and 'MM==' in x for x in rij), rij)
    p.evaluate("() => window.gaTerug()"); p.wait_for_timeout(500)
    kop = p.evaluate("() => [document.getElementById('chatAv').style.backgroundImage, document.getElementById('chatAv').textContent]")
    check('terug: kop weer 💬 zonder foto', kop == ['', '\U0001F4AC'], kop)
    p.click('#vriendenLijst .vriend-item[data-vid="' + BRAM + '"]'); p.wait_for_timeout(1500)
    kop = p.evaluate("() => [document.getElementById('chatAv').style.backgroundImage, document.getElementById('chatAv').textContent]")
    check('gesprek met Bram: kop met emoji', kop == ['', '\U0001F419'], kop)
    rij = p.evaluate(RIJEN)
    check('berichten bij Bram: geen foto van Lotte', not any('LL==' in x for x in rij), rij)
    print('4. Lotte zet een nieuwe foto (slaat haar profiel op)')
    P[LOTTE]['avatar_data'] = foto('NN=='); P[LOTTE]['updated_at'] = '2026-10-08T18:00:00+00:00'
    del log[:]; p.goto(B + 'vrienden.html'); p.wait_for_timeout(3000)
    r = p.evaluate(VRIENDEN)
    check('nieuwe foto te zien', 'NN==' in r.get(LOTTE, ''), r.get(LOTTE, '')[-40:])
    check('alleen Lotte opgehaald', [x for x in log if x[0] == 'fotos'] == [('fotos', [LOTTE])], log)
    print('5. Lotte haalt haar foto weg')
    P[LOTTE]['avatar_data'] = None; P[LOTTE]['updated_at'] = '2026-10-08T19:00:00+00:00'
    p.goto(B + 'vrienden.html'); p.wait_for_timeout(3000)
    r = p.evaluate(VRIENDEN)
    check('weer de emoji', r.get(LOTTE) == 'emoji:\U0001F338', r.get(LOTTE))
    p.goto(B + 'vrienden.html'); p.wait_for_timeout(2000)
    check('blijft de emoji', p.evaluate(VRIENDEN).get(LOTTE) == 'emoji:\U0001F338', p.evaluate(VRIENDEN).get(LOTTE))
    check('geen paginafouten', not perr, perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
