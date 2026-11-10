# proef277 (10 nov 2026, groepschat stap 1): een groep maken en versleuteld kletsen (groep.html, groepsleutel.js,
# groepenlijst.js), met een nagebootste Supabase (de echte regels staan in sql/groepen.sql).
#  A. Chat: knop '+ Groep' en je groepen bovenaan de lijst (mijn_groepen)
#  B. Nieuwe chat: Groepschat kiezen (voice en webcam nog 'binnenkort'), naam en Bram kiezen (teller), Groep maken
#     = maak_groep met de goede gegevens, en je staat in het gesprek
#  C. Marcel stuurt 'Hoi Bram 👋': op de server staat alleen 'g1:...' (niet leesbaar); bij Marcel staat het bericht
#  D. Bram opent de groep: hij leest 'Hoi Bram 👋' met de naam Marcel erboven
#  E. een sticker uit de stickerkeuze komt als plaatje binnen; 🎮 zegt dat samen spelen later komt (📷 en 🎤: proef279)
#  F. Leden: Marcel is beheerder en kan Lotte toevoegen (groep_lid_toevoegen)
#  G. Engels; geen paginafouten
# python3 -I proef277.py <map>
import sys, os, time, json, socket, subprocess, tempfile, urllib.parse, uuid
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'; LOTTE = 'cccc0002-0000-4000-8000-000000000003'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram', LOTTE: 'Lotte'}
VRIENDEN = {MARCEL: [BRAM, LOTTE], BRAM: [MARCEL], LOTTE: [MARCEL]}
DB = {'sleutels': {}, 'groepen': [], 'leden': [], 'berichten': [], 'rpc': []}
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
def nu(): return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())

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
            if naam == 'mijn_groepen':
                rij = [{'id': g['id'], 'naam': g['naam'], 'soort': g['soort'], 'leden': sum(1 for l in DB['leden'] if l['groep_id'] == g['id']), 'laatste': g['created_at']} for g in DB['groepen'] if lid(g['id'])]
                return route.fulfill(status=200, json=rij)
            if naam == 'maak_groep':
                if any(x not in VRIENDEN[uid] for x in body['p_leden']): return route.fulfill(status=403, json={'message': 'alleen vrienden'})
                g = {'id': str(uuid.uuid4()), 'naam': body['p_naam'], 'soort': body['p_soort'], 'maker': uid, 'created_at': nu()}
                DB['groepen'].append(g)
                DB['leden'].append({'groep_id': g['id'], 'user_id': uid, 'rol': 'beheerder'})
                for x in body['p_leden']: DB['leden'].append({'groep_id': g['id'], 'user_id': x, 'rol': 'lid'})
                return route.fulfill(status=200, json=g['id'])
            if naam == 'groep_leden_info':
                g = body['p_groep']
                if not lid(g): return route.fulfill(status=200, json=[])
                return route.fulfill(status=200, json=[{'id': l['user_id'], 'username': NAAM[l['user_id']], 'avatar_url': None, 'public_key': DB['sleutels'].get(l['user_id']), 'rol': l['rol']} for l in DB['leden'] if l['groep_id'] == g])
            if naam == 'groep_lid_toevoegen':
                DB['leden'].append({'groep_id': body['p_groep'], 'user_id': body['p_lid'], 'rol': 'lid'}); return route.fulfill(status=204, body='')
            return route.fulfill(status=200, json=None)
        if '/rest/v1/friendships' in u:
            return route.fulfill(status=200, json=[{'friend_id': v, 'profiles': {'id': v, 'username': NAAM[v], 'avatar_url': None, 'public_key': DB['sleutels'].get(v)}} for v in VRIENDEN[uid]])
        if '/rest/v1/groepen' in u:
            g = [x for x in DB['groepen'] if x['id'] == eq('id') and lid(x['id'])]
            return route.fulfill(status=200, json=(g[0] if g else None) if obj else g)
        if '/rest/v1/groep_berichten' in u:
            if m == 'POST':
                if not lid(body['groep_id']) or body['sender_id'] != uid: return route.fulfill(status=403, json={'message': 'rls'})
                b = dict(body, id=str(uuid.uuid4()), created_at=nu()); DB['berichten'].append(b)
                return route.fulfill(status=201, json=b if obj else [b])
            g = eq('groep_id')
            rij = sorted([b for b in DB['berichten'] if b['groep_id'] == g and lid(g)], key=lambda b: b['created_at'], reverse=True)
            return route.fulfill(status=200, json=rij)
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

www = tempfile.mkdtemp(prefix='proef277_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
toestellen = {}
def toestel(b, uid, taal='nl'):
    ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, bypass_csp=True)  # wait_for_function gebruikt eval
    ctx.route('**/*supabase.co/**', server(uid))
    pg = ctx.new_page(); fouten = []
    pg.on('pageerror', lambda e: fouten.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASIS + 'login.html')
    pg.evaluate("([t, en]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); if (en) localStorage.setItem('fibro_taal', 'en') }", [token(uid), taal == 'en'])
    DB['sleutels'][uid] = pg.evaluate(SLEUTEL, uid)
    return ctx, pg, fouten
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        mc, m, mf = toestel(b, MARCEL)
        bc, bp, bf = toestel(b, BRAM)
        # B
        m.goto(BASIS + 'groep.html'); m.wait_for_selector('#kiezen:not([hidden])')
        check(m.is_disabled('.keuze[data-soort=voice]') and m.is_disabled('.keuze[data-soort=webcam]') and not m.is_disabled('.keuze[data-soort=chat]'), 'B: groepschat kiesbaar, voice en webcam nog binnenkort')
        m.click('.keuze[data-soort=chat]'); m.wait_for_selector('#vriendenLijst .vriend')
        check(m.locator('#vriendenLijst .vriend').count() == 2, 'B: twee vrienden om te kiezen')
        check(m.is_disabled('#maakKnop'), 'B: zonder naam en vrienden geen Groep maken')
        m.fill('#groepNaam', 'Zaterdag-gamers')
        m.click('#vriendenLijst .vriend[data-id="%s"] input' % BRAM)
        check(m.inner_text('#teller') == '2 van 50', 'B: teller 2 van 50 (%r)' % m.inner_text('#teller'))
        if os.environ.get('SHOT'): m.screenshot(path=os.environ['SHOT'] + '/kies.png')
        m.click('#maakKnop'); m.wait_for_selector('#gesprek:not([hidden])')
        mk = [x for x in DB['rpc'] if x[1] == 'maak_groep']
        check(len(mk) == 1 and mk[0][2] == {'p_naam': 'Zaterdag-gamers', 'p_soort': 'chat', 'p_leden': [BRAM]}, 'B: maak_groep met naam, soort en Bram (%s)' % mk)
        gid = DB['groepen'][0]['id']
        check(('groep.html?id=' + gid) in m.url, 'B: het adres is de groep')
        m.wait_for_function("document.getElementById('groepSub').textContent.includes('2')")
        check(m.inner_text('#groepTitel') == 'Zaterdag-gamers' and m.inner_text('#groepSub') == '2 leden', 'B: kop met naam en 2 leden')
        # C
        m.fill('#bericht', 'Hoi Bram 👋'); m.click('#verstuur')
        m.wait_for_selector('.b-rij.mijn .bubbel')
        check(len(DB['berichten']) == 1 and DB['berichten'][0]['content'].startswith('g1:') and 'Hoi' not in DB['berichten'][0]['content'], 'C: op de server alleen versleuteld')
        check(m.inner_text('.b-rij.mijn .bubbel') == 'Hoi Bram 👋', 'C: Marcel ziet zijn bericht')
        # E (sticker en spel)
        m.click('#stickerKnop'); m.wait_for_selector('#stickerRaster .sk-sticker')
        m.click('#stickerRaster .sk-sticker >> nth=0'); m.wait_for_function("document.querySelectorAll('.b-rij.mijn').length === 2")
        m.wait_for_timeout(300)
        check(m.locator('.b-rij.mijn img.b-sticker').count() == 1, 'E: sticker als plaatje bij Marcel')
        m.click('.balk-knop.later[aria-label="Spel"]')
        check('Samen spelen in een groep komt later' in m.inner_text('.toast'), 'E: spel zegt later')
        # D
        bp.goto(BASIS + 'groep.html?id=' + gid); bp.wait_for_selector('.b-rij .bubbel')
        bp.wait_for_function("document.querySelectorAll('.b-rij').length === 2")
        check(bp.inner_text('.b-rij .bubbel') == 'Hoi Bram 👋' and bp.inner_text('.b-rij .b-naam') == 'Marcel', 'D: Bram leest het bericht van Marcel (%r)' % bp.inner_text('.b-rij'))
        check(bp.locator('.b-rij img.b-sticker').count() == 1, 'E: Bram ziet de sticker')
        if os.environ.get('SHOT'): bp.screenshot(path=os.environ['SHOT'] + '/bram.png')
        check(bp.locator('.b-rij.mijn').count() == 0, 'D: bij Bram staan ze links (van een ander)')
        # A
        m.goto(BASIS + 'chat.html'); m.wait_for_selector('#groepenLijst .groep-item')
        check(m.inner_text('#groepenLijst .groep-item .vriend-naam') == 'Zaterdag-gamers' and m.get_attribute('#groepenLijst .groep-item', 'href') == 'groep.html?id=' + gid, 'A: groep bovenaan de chatlijst')
        if os.environ.get('SHOT'): m.screenshot(path=os.environ['SHOT'] + '/chat.png')
        check(m.get_attribute('#nieuweGroep', 'href') == 'groep.html', 'A: knop + Groep')
        # F
        m.goto(BASIS + 'groep.html?id=' + gid); m.wait_for_selector('.b-rij')
        m.click('#ledenKnop'); m.wait_for_selector('#toevoegenLijst .klein-knop')
        check('beheerder' in m.inner_text('#ledenLijst'), 'F: Marcel is beheerder')
        if os.environ.get('SHOT'): m.screenshot(path=os.environ['SHOT'] + '/leden.png')
        m.click('#toevoegenLijst .klein-knop'); m.wait_for_timeout(600)
        check(any(x[1] == 'groep_lid_toevoegen' and x[2] == {'p_groep': gid, 'p_lid': LOTTE} for x in DB['rpc']), 'F: Lotte toegevoegd')
        check(m.locator('#ledenLijst .lid').count() == 3, 'F: nu drie leden')
        check(not mf and not bf, 'G: geen paginafouten (%s %s)' % (mf[:2], bf[:2]))
        mc.close(); bc.close()
        # G Engels
        ec, e, ef = toestel(b, MARCEL, 'en')
        e.goto(BASIS + 'groep.html'); e.wait_for_selector('#kiezen:not([hidden])'); e.wait_for_timeout(300)
        t = e.inner_text('#kiezen')
        check('What kind of chat do you want to make?' in t and 'Group chat' in t and 'coming soon' in t, 'G: Engels (%r)' % t[:120])
        ec.close()
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
