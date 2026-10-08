import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef35: menu (☰) op Home met "Mijn gegevens downloaden" en "Account verwijderen" (account.js).
# Echte sleutels en versleutelde berichten (crypto.js); nep-Supabase met mijn_gegevens en verwijder_mijn_account.
# Downloaden (gewoon en zoals op de iPhone: delen), verkeerde naam, server nog niet bijgewerkt, geen internet,
# verbinding weg na het verwijderen (opnieuw = gelukt), geslaagd: wat er daarna op het toestel over is
# (van een ander account blijft alles staan).
# python3 -I proef35.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www35_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
LOTTE = 'cccc0002-0000-4000-8000-000000000002'; ANDER = 'dddd0003-0000-4000-8000-000000000003'  # ander account op dit toestel
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
staat = {'bijgewerkt': True, 'servernaam': 'Marcel', 'gegevens': None, 'verwijderd': False, 'afbreken': False, 'rpc': [], 'logout': 0}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/rpc/' in u:
        naam = u.split('/rest/v1/rpc/')[1].split('?')[0]
        a = json.loads(route.request.post_data or '{}'); staat['rpc'].append((naam, a))
        if not staat['bijgewerkt']: return route.fulfill(status=404, json={"code": "PGRST202", "message": "Could not find the function public." + naam + " without parameters in the schema cache"})
        if naam == 'mijn_gegevens': return route.fulfill(status=200, json=staat['gegevens'])
        if naam == 'verwijder_mijn_account':
            if staat['verwijderd']: return route.fulfill(status=400, json={"code": "P0001", "message": "Account niet gevonden"})
            if str(a.get('p_bevestiging', '')).strip().lower() != staat['servernaam'].lower():
                return route.fulfill(status=400, json={"code": "P0001", "message": "Bevestiging klopt niet: typ je gebruikersnaam"})
            staat['verwijderd'] = True
            if staat['afbreken']: return route.abort('connectionreset')
            return route.fulfill(status=200, json=True)
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "Marcel"}
        return route.fulfill(status=200, json=e if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [e])
    if '/auth/v1/logout' in u: staat['logout'] += 1; return route.fulfill(status=204, body='')
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:240] if info != '' else ''))
    if not ok: fouten.append(naam)
class Stop(Exception): pass
MENU = "() => [...document.querySelectorAll('#fibroMenu [role=menuitem]')].map(b => b.textContent)"
def status(p, id): return p.evaluate("id => (document.querySelector('#' + id + ' [role=status]') || {}).textContent || ''", id)
def menu(p, tekst):
    p.click('#menuBtn'); p.wait_for_timeout(200)
    items = p.evaluate(MENU)
    i = next((n for n, t in enumerate(items) if tekst in t), None)
    if i is None:
        check('menu heeft "' + tekst + '"', False, items); p.keyboard.press('Escape'); raise Stop()
    p.click('#fibroMenu [role=menuitem] >> nth=' + str(i)); p.wait_for_timeout(600)
VULLEN = """async ([u, bram, lotte, ander]) => {
  const c = await import('./crypto.js?v=95')
  const ik = await c.genereerKeypair(), br = await c.genereerKeypair(), lo = await c.genereerKeypair(), fout = await c.genereerKeypair()
  c.slaPrivateKeyOp(u, ik.privateKeyB64)
  localStorage.setItem('fibro_privkey_' + ander, 'sleutel-van-een-ander-account')
  const naarBram = await c.versleutel('Hoi Bram, hoe is het?', ik.privateKeyB64, br.publicKeyB64)
  const vanBram = await c.versleutel('Goed! En met jou?', br.privateKeyB64, ik.publicKeyB64)
  const uitCache = await c.versleutel('Dit staat ook in mijn geheugen', ik.privateKeyB64, br.publicKeyB64)
  const vanLotte = await c.versleutel('Met een sleutel die niet meer klopt', lo.privateKeyB64, fout.publicKeyB64)
  localStorage.setItem('fibro_msg_cache_' + u, JSON.stringify({ m3: 'Dit staat ook in mijn geheugen' }))
  const t = (h) => new Date(Date.now() - h * 3600000).toISOString()
  const gegevens = {
    uitleg: 'Alles wat Fibro op de server over jou bewaart.', gemaakt_op: new Date().toISOString(),
    account: { id: u, email: 'marcel@nep.invalid' },
    profiel: { id: u, username: 'Marcel', public_key: ik.publicKeyB64, bewaar_dagen: 31 },
    berichten: [
      { id: 'm1', sender_id: u, receiver_id: bram, content: naarBram, created_at: t(5) },
      { id: 'm2', sender_id: bram, receiver_id: u, content: vanBram, created_at: t(4) },
      { id: 'm3', sender_id: u, receiver_id: bram, content: uitCache, created_at: t(3) },
      { id: 'm4', sender_id: lotte, receiver_id: u, content: vanLotte, created_at: t(2) },
      { id: 'm5', sender_id: u, receiver_id: lotte, content: 'spelinvite:pong:x:1', created_at: t(1) }],
    personen: [{ id: bram, username: 'Bram', public_key: br.publicKeyB64 }, { id: lotte, username: 'Lotte', public_key: lo.publicKeyB64 }],
    vriendschappen: [{ user_id: u, friend_id: bram, status: 'accepted' }], gastenboek: [], reacties: []
  }
  // van alles op dit toestel: van mij, van mijn vrienden, algemeen, en van een ander account
  const zet = (k, w) => localStorage.setItem(k, w)
  zet('fibro_chatlog_' + u + '_' + bram, '[]'); zet('fibro_chatvrienden_' + u, '[]'); zet('vriend_cache_' + bram + '_' + u, '{}')
  zet('fibro_bewaren_' + u, '31'); zet('fibro_vriendfotos_' + u, '{}'); zet('fibro_custom_stickers', '[]'); zet('fibro_lettertype', 'x')
  zet('fibro_chatlog_' + ander + '_' + bram, '[]'); zet('fibro_profielcache_' + ander, '{}'); zet('wereldklok_steden', '[]')
  const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2); r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }; r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  await new Promise(k => { const tx = db.transaction('fotos', 'readwrite'); const st = tx.objectStore('fotos')
    for (const id of ['bg_wallpaper_' + u, 'avatar_thumbnail_' + u, 'video_data_' + u, 'vriend_avatar_' + bram, 'vriend_' + bram + '_layout', 'muziek_abc', 'bg_wallpaper_' + ander, 'video_data_' + ander]) st.put({ id, data: 'x' })
    tx.oncomplete = k })
  db.close()
  return gegevens
}"""
FOTOS = """async () => { const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  const k = await new Promise(ok => { const r = db.transaction('fotos').objectStore('fotos').getAllKeys(); r.onsuccess = () => ok(r.result) }); db.close(); return k.sort() }"""
IOS = """() => { window.__gedeeld = []; window.__deelAntwoord = 'ok'
  try { localStorage.setItem('fibro_opslagtip_later', String(Date.now())) } catch (e) {} // geen tip "zet op je beginscherm"
  Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' })
  navigator.canShare = (d) => !!(d && d.files && d.files.length && d.files[0].type === 'application/json')
  navigator.share = async (d) => { if (window.__deelAntwoord === 'nee') { const e = new Error('geannuleerd'); e.name = 'AbortError'; throw e }
    window.__gedeeld.push({ naam: d.files[0].name, type: d.files[0].type, tekst: await d.files[0].text() }) } }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 800}, accept_downloads=True)
    ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; dialogen = []
    p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200])))
    p.on('dialog', lambda d: (dialogen.append(d.message), d.accept()))
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'index.html'); p.wait_for_timeout(2000)
    staat['gegevens'] = p.evaluate(VULLEN, [UID, BRAM, LOTTE, ANDER])
    try:
        print('1. Menu')
        p.click('#menuBtn'); p.wait_for_timeout(300)
        items = p.evaluate(MENU)
        check('vier keuzes in de goede volgorde', len(items) == 4 and 'Berichten bewaren' in items[0] and 'Mijn gegevens downloaden' in items[1]
              and 'Over Fibro' in items[2] and 'Account verwijderen' in items[3], items)
        kleur = p.evaluate("() => getComputedStyle(document.querySelectorAll('#fibroMenu [role=menuitem]')[3] || document.body).color")
        check('Account verwijderen in het rood', kleur == 'rgb(252, 165, 165)', kleur)
        p.keyboard.press('Escape'); p.wait_for_timeout(200)

        print('2. Mijn gegevens: server nog niet bijgewerkt')
        staat['bijgewerkt'] = False
        menu(p, 'Mijn gegevens')
        eigen = lambda: [r for r in staat['rpc'] if r[0] in ('mijn_gegevens', 'verwijder_mijn_account')]
        check('scherm open, nog niets opgehaald', p.evaluate("() => !!document.getElementById('gegevensScherm')") and not eigen(), eigen())
        p.click('#gegevensScherm button:has-text("Gegevens ophalen")'); p.wait_for_timeout(800)
        check('zegt dat het nog niet kan', 'nog niet bijgewerkt' in status(p, 'gegevensScherm'), status(p, 'gegevensScherm'))
        check('knop weer te gebruiken', p.evaluate("() => !document.querySelector('#gegevensScherm button').disabled"))
        staat['bijgewerkt'] = True

        print('3. Ophalen en bewaren (gewoon downloaden)')
        p.click('#gegevensScherm button:has-text("Gegevens ophalen")'); p.wait_for_timeout(1500)
        st = status(p, 'gegevensScherm')
        check('klaar: 5 berichten, 4 leesbaar', 'Klaar: 5 berichten (4 leesbaar)' in st, st)
        with p.expect_download() as dl:
            p.click('#gegevensScherm button:has-text("Bestand bewaren")')
        d = dl.value; inhoud = json.loads(open(d.path(), encoding='utf-8').read())
        check('bestandsnaam', d.suggested_filename.startswith('fibro-gegevens-Marcel-') and d.suggested_filename.endswith('.json'), d.suggested_filename)
        tk = {b['id']: (b['van'], b['naar'], b['tekst']) for b in inhoud['berichten']}
        check('eigen bericht leesbaar (met mijn sleutel)', tk.get('m1') == ('ik', 'Bram', 'Hoi Bram, hoe is het?'), tk.get('m1'))
        check('bericht van Bram leesbaar', tk.get('m2') == ('Bram', 'ik', 'Goed! En met jou?'), tk.get('m2'))
        check('eigen bericht uit het geheugen', tk.get('m3') == ('ik', 'Bram', 'Dit staat ook in mijn geheugen'), tk.get('m3'))
        check('niet te lezen staat er eerlijk', tk.get('m4') == ('Lotte', 'ik', '(niet te lezen op dit toestel)'), tk.get('m4'))
        check('onversleuteld bericht zoals het is', tk.get('m5') == ('ik', 'Lotte', 'spelinvite:pong:x:1'), tk.get('m5'))
        check('versleutelde inhoud zit er ook in', inhoud['berichten'][0]['content'].startswith('e2e:'))
        check('rest van de gegevens mee', inhoud['account']['email'] == 'marcel@nep.invalid' and inhoud['profiel']['username'] == 'Marcel' and len(inhoud['vriendschappen']) == 1)
        check('status zegt gedownload', 'Gedownload' in status(p, 'gegevensScherm'), status(p, 'gegevensScherm'))
        p.click('#gegevensScherm button:text("Sluiten")'); p.wait_for_timeout(200)
        check('Sluiten sluit het scherm', p.evaluate("() => !document.getElementById('gegevensScherm')"))

        print('4. Geen internet')
        ctx.set_offline(True); p.wait_for_timeout(300); n = len(eigen())
        menu(p, 'Mijn gegevens')
        p.click('#gegevensScherm button:has-text("Gegevens ophalen")'); p.wait_for_timeout(500)
        check('zegt geen internet, niets gevraagd', 'Geen internet' in status(p, 'gegevensScherm') and len(eigen()) == n, status(p, 'gegevensScherm'))
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        menu(p, 'Account verwijderen')
        p.fill('#verwijderNaam', 'Marcel'); p.wait_for_timeout(100)
        p.click('#verwijderScherm button:has-text("definitief")', force=True); p.wait_for_timeout(500)
        check('verwijderen zonder internet: zegt het, niets gevraagd', 'Geen internet' in status(p, 'verwijderScherm') and len(eigen()) == n, status(p, 'verwijderScherm'))
        p.keyboard.press('Escape'); ctx.set_offline(False); p.wait_for_timeout(300)

        print('5. Account verwijderen: bevestigen')
        menu(p, 'Account verwijderen')
        lab = p.inner_text('#verwijderScherm label')
        check('vraagt de gebruikersnaam', 'Typ ter bevestiging je gebruikersnaam: Marcel' in lab, lab)
        knop = '#verwijderScherm button:has-text("definitief")'
        check('knop uit zolang er niets staat', p.is_disabled(knop))
        p.fill('#verwijderNaam', 'Marc'); check('knop uit bij een half woord', p.is_disabled(knop))
        p.fill('#verwijderNaam', ' marcel '); check('knop aan (hoofdletters en spaties maken niet uit)', p.is_enabled(knop))

        print('6. Server nog niet bijgewerkt')
        staat['bijgewerkt'] = False
        p.click(knop); p.wait_for_timeout(800)
        check('zegt dat het nog niet kan, niets verwijderd', 'nog niet bijgewerkt' in status(p, 'verwijderScherm') and 'niets verwijderd' in status(p, 'verwijderScherm'), status(p, 'verwijderScherm'))
        check('niets gewist op dit toestel', p.evaluate("u => !!localStorage.getItem('fibro_privkey_' + u) && !!localStorage.getItem('sb-qmgatbphiplrfxrljtbe-auth-token')", UID))
        check('opnieuw te proberen', p.is_enabled(knop) and p.is_enabled('#verwijderNaam'))
        staat['bijgewerkt'] = True

        print('7. Server vindt de naam niet goed')
        staat['servernaam'] = 'Marcel2'
        p.click(knop); p.wait_for_timeout(800)
        check('zegt dat de naam niet klopt', 'naam klopt niet' in status(p, 'verwijderScherm') and not staat['verwijderd'], status(p, 'verwijderScherm'))
        check('niets gewist', p.evaluate("u => !!localStorage.getItem('fibro_privkey_' + u)", UID))
        staat['servernaam'] = 'Marcel'

        print('8. Eerst mijn gegevens downloaden (vanuit verwijderen)')
        p.click('#verwijderScherm button:has-text("Eerst mijn gegevens")'); p.wait_for_timeout(400)
        check('gegevensscherm open, verwijderscherm dicht', p.evaluate("() => !!document.getElementById('gegevensScherm') && !document.getElementById('verwijderScherm')"))
        p.keyboard.press('Escape'); p.wait_for_timeout(200)

        print('9. Verbinding weg net na het verwijderen, dan opnieuw')
        menu(p, 'Account verwijderen')
        p.fill('#verwijderNaam', 'Marcel'); staat['afbreken'] = True
        p.click(knop); p.wait_for_timeout(800)
        check('zegt geen verbinding', 'Geen verbinding' in status(p, 'verwijderScherm'), status(p, 'verwijderScherm'))
        check('nog niets gewist (weet het niet zeker)', p.evaluate("u => !!localStorage.getItem('fibro_privkey_' + u)", UID))
        staat['afbreken'] = False
        sluitbaar = []
        p.click(knop); p.wait_for_timeout(300)
        sluitbaar.append(p.is_disabled('#verwijderScherm button:text("Sluiten")'))
        p.keyboard.press('Escape'); p.wait_for_timeout(100)
        sluitbaar.append(p.evaluate("() => !!document.getElementById('verwijderScherm')"))
        check('tijdens het opruimen niet te sluiten', all(sluitbaar), sluitbaar)
        p.wait_for_timeout(1500)
        check('tweede keer: "Account niet gevonden" telt als gelukt', 'Je account is verwijderd' in status(p, 'verwijderScherm'), status(p, 'verwijderScherm'))
        p.wait_for_function("() => /Tot ziens/.test((document.querySelector('#verwijderScherm [role=status]') || {}).textContent || '')", timeout=10000)

        print('10. Op dit toestel opgeruimd')
        ls = p.evaluate("() => Object.keys(localStorage).sort()")
        check('niets meer met mijn id', not [k for k in ls if UID in k], [k for k in ls if UID in k])
        check('inlogpas weg', not [k for k in ls if k.startswith('sb-')], ls)
        check('algemene Fibro-dingen weg', 'fibro_custom_stickers' not in ls and 'fibro_lettertype' not in ls, ls)
        check('van het andere account staat alles er nog', all(k in ls for k in ['fibro_privkey_' + ANDER, 'fibro_chatlog_' + ANDER + '_' + BRAM, 'fibro_profielcache_' + ANDER, 'wereldklok_steden']), ls)
        fotos = p.evaluate(FOTOS)
        check('foto\'s: alleen die van het andere account over', fotos == sorted(['bg_wallpaper_' + ANDER, 'video_data_' + ANDER]), fotos)
        check('uitgelogd bij de server geprobeerd', staat['logout'] >= 1, staat['logout'])
        check('bewuste uitlog (sessie.js haalt de pas niet terug)', p.evaluate("() => sessionStorage.getItem('fibro_bewust_uitloggen')") == '1')
        try: p.wait_for_url('**/login.html?logout=1', timeout=10000)
        except Exception: pass
        check('naar het inlogscherm', 'login.html?logout=1' in p.url, p.url)
        p.wait_for_timeout(1500)
        check('blijft op het inlogscherm', 'login.html' in p.url, p.url)
        ls2 = p.evaluate("() => Object.keys(localStorage).filter(k => k.includes('aaaaaaaa'))")
        check('ook daarna niets met mijn id', not ls2, ls2)

        print('11. Zoals op de iPhone: delen ("Bewaar in Bestanden")')
        staat['verwijderd'] = False
        p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
        p2 = ctx.new_page(); p2.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200])))
        p2.add_init_script('(' + IOS + ')()')
        p2.goto(B + 'index.html'); p2.wait_for_timeout(2000)
        p2.mouse.click(195, 400); p2.wait_for_timeout(500)  # iPhone: "Welkom bij Fibro, tik om te beginnen" (beltoon.js)
        menu(p2, 'Mijn gegevens')
        p2.click('#gegevensScherm button:has-text("Gegevens ophalen")'); p2.wait_for_timeout(1200)
        p2.evaluate("() => { window.__deelAntwoord = 'nee' }")
        p2.click('#gegevensScherm button:has-text("Bestand bewaren")'); p2.wait_for_timeout(300)
        check('geannuleerd: zegt het, knop blijft', 'Niet bewaard' in status(p2, 'gegevensScherm') and p2.is_visible('#gegevensScherm button:has-text("Bestand bewaren")'), status(p2, 'gegevensScherm'))
        p2.evaluate("() => { window.__deelAntwoord = 'ok' }")
        p2.click('#gegevensScherm button:has-text("Bestand bewaren")'); p2.wait_for_timeout(300)
        g = p2.evaluate("() => window.__gedeeld")
        check('gedeeld als JSON-bestand', len(g) == 1 and g[0]['naam'].startswith('fibro-gegevens-Marcel-') and g[0]['type'] == 'application/json' and '"tekst"' in g[0]['tekst'], [x['naam'] for x in g])
        check('status zegt bewaard', 'Bewaard' in status(p2, 'gegevensScherm'), status(p2, 'gegevensScherm'))
        p2.close()
    except Stop:
        print('  (verder overgeslagen)')
    check('geen paginafouten', not perr, perr)
    check('geen meldvensters', not dialogen, dialogen)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
