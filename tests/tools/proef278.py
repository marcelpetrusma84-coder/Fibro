# proef278 (10 nov 2026): groepschat - namen en 'Groepen met onbekenden' (groep.html, index.html, sql/groep-onbekenden.sql).
# Marcel is vriend van Bram en Lotte; Bram en Lotte kennen elkaar niet. Nagebootste Supabase.
#  A. In een groep ziet Bram Marcel met de weergavenaam die Marcel met hem deelde ('Marcel P.'), en Lotte (onbekend)
#     met haar gebruikersnaam ('lotte_88'); in het ledenpaneel ook
#  B. Lotte heeft 'Groepen met onbekenden' uit: Marcel maakt een groep met Bram en Lotte -> de server weigert en de app
#     zegt 'Lotte wil alleen in groepen waarin iedereen een vriend is.' (Lotte met de naam die Marcel kent)
#  C. Menu op Home: Instellingen > 'Groepen met onbekenden: aan'; tik = uit, en de server krijgt zet_groep_onbekenden(false)
#  D. geen paginafouten
# python3 -I proef278.py <map>
import sys, os, time, json, socket, subprocess, tempfile, urllib.parse, uuid
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'; LOTTE = 'cccc0002-0000-4000-8000-000000000003'
NAAM = {MARCEL: 'marcel_84', BRAM: 'bram_x', LOTTE: 'lotte_88'}
VRIENDEN = {MARCEL: [BRAM, LOTTE], BRAM: [MARCEL], LOTTE: [MARCEL]}
OPEN = {MARCEL: True, BRAM: True, LOTTE: True}
DB = {'sleutels': {}, 'groepen': [], 'leden': [], 'berichten': [], 'rpc': []}
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
_t = [0]
def nu():
    _t[0] += 1
    return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + '.%06dZ' % _t[0]
def wil_niet(a, b):
    if a == b or b in VRIENDEN[a]: return None
    if not OPEN[b]: return b
    if not OPEN[a]: return a
    return None

def server(uid):
    def supa(route):
        r = route.request; u = r.url; m = r.method
        obj = 'vnd.pgrst.object' in (r.headers.get('accept') or '')
        q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
        eq = lambda k: (q.get(k, [''])[0][3:] if q.get(k, [''])[0].startswith('eq.') else None)
        body = json.loads(r.post_data or '{}') if m in ('POST', 'PATCH') else {}
        lid = lambda g: any(l['groep_id'] == g and l['user_id'] == uid for l in DB['leden'])
        if '/rest/v1/rpc/' in u:
            naam = u.split('/rpc/')[1].split('?')[0]; DB['rpc'].append((uid, naam, body))
            if naam == 'mijn_groepen': return route.fulfill(status=200, json=[])
            if naam == 'zet_groep_onbekenden': OPEN[uid] = bool(body.get('p_aan')); return route.fulfill(status=204, body='')
            if naam == 'maak_groep':
                allen = body['p_leden'] + [uid]
                for a in allen:
                    for b in allen:
                        w = wil_niet(a, b)
                        if w: return route.fulfill(status=400, json={'code': 'P0001', 'message': 'wil alleen in groepen met bekenden', 'hint': 'onbekenden', 'details': w})
                g = {'id': str(uuid.uuid4()), 'naam': body['p_naam'], 'soort': body['p_soort'], 'maker': uid, 'created_at': nu()}
                DB['groepen'].append(g)
                DB['leden'].append({'groep_id': g['id'], 'user_id': uid, 'rol': 'beheerder'})
                for x in body['p_leden']: DB['leden'].append({'groep_id': g['id'], 'user_id': x, 'rol': 'lid'})
                return route.fulfill(status=200, json=g['id'])
            if naam == 'groep_leden_info':
                g = body['p_groep']
                if not lid(g): return route.fulfill(status=200, json=[])
                return route.fulfill(status=200, json=[{'id': l['user_id'], 'username': NAAM[l['user_id']], 'avatar_url': None, 'public_key': DB['sleutels'].get(l['user_id']), 'rol': l['rol']} for l in DB['leden'] if l['groep_id'] == g])
            return route.fulfill(status=200, json=None)
        if '/rest/v1/friendships' in u:
            return route.fulfill(status=200, json=[{'friend_id': v, 'profiles': {'id': v, 'username': NAAM[v], 'avatar_url': None, 'public_key': DB['sleutels'].get(v)}} for v in VRIENDEN[uid]])
        if '/rest/v1/chat_instellingen' in u: return route.fulfill(status=200, json={'groep_onbekenden': OPEN[uid]} if obj else [{'groep_onbekenden': OPEN[uid]}])
        if '/rest/v1/groepen' in u:
            g = [x for x in DB['groepen'] if x['id'] == eq('id') and lid(x['id'])]
            return route.fulfill(status=200, json=(g[0] if g else None) if obj else g)
        if '/rest/v1/groep_berichten' in u:
            if m == 'POST':
                b = dict(body, id=str(uuid.uuid4()), created_at=nu()); DB['berichten'].append(b)
                return route.fulfill(status=201, json=b if obj else [b])
            g = eq('groep_id')
            return route.fulfill(status=200, json=sorted([b for b in DB['berichten'] if b['groep_id'] == g and lid(g)], key=lambda b: b['created_at'], reverse=True))
        if '/rest/v1/profiles' in u:
            rij = {'id': uid, 'username': NAAM[uid], 'public_key': DB['sleutels'].get(uid)}
            return route.fulfill(status=200, json=rij if obj else [rij])
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={'id': uid})
        return route.fulfill(status=200, json=[])
    return supa

SLEUTEL = """async (uid) => { const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const b = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  localStorage.setItem('fibro_privkey_' + uid, b(await crypto.subtle.exportKey('pkcs8', k.privateKey)))
  return b(await crypto.subtle.exportKey('spki', k.publicKey)) }"""

www = tempfile.mkdtemp(prefix='proef278_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
alle_fouten = []
def toestel(b, uid, namen):
    ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, bypass_csp=True)
    ctx.route('**/*supabase.co/**', server(uid))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: alle_fouten.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASIS + 'login.html')
    pg.evaluate("([t, uid, namen]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); localStorage.setItem('fibro_eigennaam_gevraagd_' + uid, '1');"
                " for (const [id, n] of Object.entries(namen)) localStorage.setItem('vriend_naam_' + id + '_' + uid, n) }", [token(uid), uid, namen])
    DB['sleutels'][uid] = pg.evaluate(SLEUTEL, uid)
    return ctx, pg
def stuur(pg, gid, tekst):
    pg.goto(BASIS + 'groep.html?id=' + gid); pg.wait_for_selector('#gesprek:not([hidden])'); pg.wait_for_function("document.getElementById('groepSub').textContent.length > 0")
    pg.fill('#bericht', tekst); pg.click('#verstuur'); pg.wait_for_selector('.b-rij.mijn')
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        mc, m = toestel(b, MARCEL, {BRAM: 'Bram', LOTTE: 'Lotte'})
        bc, bp = toestel(b, BRAM, {MARCEL: 'Marcel P.'})
        lc, lp = toestel(b, LOTTE, {MARCEL: 'Marcel'})
        # A: groep maken met Bram en Lotte (iedereen staat open)
        m.goto(BASIS + 'groep.html'); m.click('.keuze[data-soort=chat]'); m.wait_for_selector('#vriendenLijst .vriend')
        namen = m.eval_on_selector_all('#vriendenLijst .vriend-naam', 'els => els.map(e => e.textContent)')
        check(namen == ['Bram', 'Lotte'], 'A: Marcel kiest uit zijn vrienden met hun weergavenaam (%s)' % namen)
        m.fill('#groepNaam', 'Iedereen'); m.click('.vriend[data-id="%s"] input' % BRAM); m.click('.vriend[data-id="%s"] input' % LOTTE)
        m.click('#maakKnop'); m.wait_for_selector('#gesprek:not([hidden])')
        gid = DB['groepen'][0]['id']
        m.fill('#bericht', 'Hoi allebei'); m.click('#verstuur'); m.wait_for_selector('.b-rij.mijn')
        stuur(lp, gid, 'Hallo, ik ben Lotte')
        bp.goto(BASIS + 'groep.html?id=' + gid); bp.wait_for_function("document.querySelectorAll('.b-rij .b-naam').length === 2")
        n = bp.eval_on_selector_all('.b-rij .b-naam', 'els => els.map(e => e.textContent)')
        check(n == ['Marcel P.', 'lotte_88'], 'A: Bram ziet Marcel met weergavenaam en Lotte met gebruikersnaam (%s)' % n)
        bp.click('#ledenKnop'); bp.wait_for_selector('#ledenLijst .lid')
        lijst = bp.inner_text('#ledenLijst')
        check('Marcel P.' in lijst and 'lotte_88' in lijst and 'bram_x (jij)' in lijst, 'A: ook in het ledenpaneel (%r)' % lijst)
        # B: Lotte zet 'Groepen met onbekenden' uit; nieuwe groep met Bram en Lotte lukt niet
        OPEN[LOTTE] = False
        m.goto(BASIS + 'groep.html'); m.click('.keuze[data-soort=chat]'); m.wait_for_selector('#vriendenLijst .vriend')
        m.fill('#groepNaam', 'Nog een'); m.click('.vriend[data-id="%s"] input' % BRAM); m.click('.vriend[data-id="%s"] input' % LOTTE)
        m.click('#maakKnop'); m.wait_for_function("document.getElementById('maakMelding').textContent.length > 0")
        melding = m.inner_text('#maakMelding')
        check(melding == 'Lotte wil alleen in groepen waarin iedereen een vriend is.', 'B: melding met naam (%r)' % melding)
        check(len(DB['groepen']) == 1 and not m.is_disabled('#maakKnop'), 'B: geen groep gemaakt, je kunt het opnieuw proberen')
        # alleen met Lotte (zij kent Marcel): lukt wel
        m.click('.vriend[data-id="%s"] input' % BRAM); m.click('#maakKnop'); m.wait_for_selector('#gesprek:not([hidden])')
        check(len(DB['groepen']) == 2, 'B: met alleen bekenden lukt het wel')
        # C: menu op Home
        m.goto(BASIS + 'index.html'); m.wait_for_timeout(2500)
        m.evaluate("localStorage.setItem('fibro_menu_open', JSON.stringify(['menuKopInstellingen']))")
        m.click('#menuBtn'); m.wait_for_selector('#fibroMenu')
        knop = m.locator('#fibroMenu [role=menuitemcheckbox]', has_text='Groepen met onbekenden')
        check(knop.count() == 1 and 'aan' in knop.inner_text(), 'C: schakelaar in het menu, standaard aan (%r)' % (knop.inner_text() if knop.count() else ''))
        knop.click(); m.wait_for_timeout(500)
        check('uit' in knop.inner_text() and (MARCEL, 'zet_groep_onbekenden', {'p_aan': False}) in DB['rpc'], 'C: uit gezet en naar de server gestuurd')
        check(not alle_fouten, 'D: geen paginafouten (%s)' % alle_fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
