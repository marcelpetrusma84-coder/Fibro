import subprocess, sys, time, json, os, urllib.parse as up
from playwright.sync_api import sync_playwright
# proef31: profielen zonder onnodige foto's. Vriend-profiel haalt avatar en achtergrondfoto alleen op als de
# vriend zijn profiel opnieuw opgeslagen heeft (updated_at), Home en Profiel nooit de eigen achtergrondfoto,
# het belscherm alleen naam en emoji. Nep-PostgREST: select=... geeft alleen die kolommen, onbekende kolom = 400.
# python3 -I proef31.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www31_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
# de echte kolommen van profiles (uit de SQL Editor, 8 oktober 2026)
KOL = ['id', 'username', 'display_name', 'bio', 'mood', 'theme', 'avatar_url', 'created_at', 'updated_at', 'achtergrond_kleur', 'achtergrond_type',
       'achtergrond_url', 'animatie', 'lettertype', 'accent_kleur', 'accent_kleur2', 'widgets', 'stickers', 'niveau', 'public_key', 'geblokkeerd',
       'online_status', 'offline_emoji', 'offline_bericht', 'laatst_gezien', 'avatar_data', 'wallpaper_data', 'muziek_titel', 'muziek_artiest',
       'profiel_quote', 'widget_layout', 'is_plus', 'is_moderator', 'toon_online']
def foto(teken, n): return 'data:image/png;base64,' + teken * n
def rij(**w):
    r = {k: None for k in KOL}; r.update(w); return r
PROF = {
    BRAM: rij(id=BRAM, username='Bram', bio='Bio van Bram', mood='\U0001F60E Lekker bezig', avatar_url='\U0001F419', online_status=True,
              laatst_gezien='2026-10-08T10:00:00Z', updated_at='2026-10-01T10:00:00+00:00', achtergrond_kleur='#ff0000', accent_kleur='#ff00aa',
              avatar_data=foto('A', 20000), wallpaper_data=foto('W', 1500000)),
    UID: rij(id=UID, username='Marcel', display_name='Marcel', bio='Mijn bio', mood='\U0001F600 Blij', avatar_url='\U0001F600',
             updated_at='2026-10-02T10:00:00+00:00', achtergrond_kleur='#1a0a2e', accent_kleur='#c084fc', offline_emoji='\U0001F319',
             offline_bericht='Even weg', toon_online=True, avatar_data=foto('M', 20000), wallpaper_data=foto('X', 1500000)),
}
staat = {'zwaar_kapot': False, 'mist': None}
log = []  # (id, select, bytes)
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        q = up.parse_qs(up.urlparse(u).query)
        sel = (q.get('select') or ['*'])[0]
        wie = next((v for v in PROF if 'id=eq.' + v in u), None)
        if not wie: return route.fulfill(status=200, json=[])
        kols = KOL if sel == '*' else [k.strip() for k in sel.split(',')]
        if staat['mist'] and staat['mist'] in kols and sel != '*':
            log.append((wie, sel, 0, 400))
            return route.fulfill(status=400, json={"code": "42703", "message": "column profiles." + staat['mist'] + " does not exist"})
        onbekend = [k for k in kols if k not in KOL]
        if onbekend: return route.fulfill(status=400, json={"code": "42703", "message": "column profiles." + onbekend[0] + " does not exist"})
        if staat['zwaar_kapot'] and ('wallpaper_data' in kols):
            log.append((wie, sel, 0, 500)); return route.fulfill(status=500, json={"message": "kapot"})
        r = {k: PROF[wie][k] for k in kols}
        body = json.dumps(r if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [r])
        log.append((wie, sel, len(body), 200))
        return route.fulfill(status=200, body=body, headers={'content-type': 'application/json'})
    if '/rest/v1/friendships' in u and m == 'GET':
        return route.fulfill(status=200, json=[{"friend_id": BRAM, "user_id": UID, "status": "accepted", "profiles": {k: PROF[BRAM][k] for k in ('id', 'username', 'avatar_url')}}])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    if m == 'GET': return route.fulfill(status=200, json=[])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:220] if info != '' else ''))
    if not ok: fouten.append(naam)
def kb(regels): return round(sum(r[2] for r in regels) / 1024, 1)
def zwaar(regels): return [r for r in regels if r[1] == '*' or 'wallpaper_data' in r[1]]
LEES = """() => ({ naam: document.getElementById('profielNaam').textContent,
  muur: (document.getElementById('wallpaperBg').style.backgroundImage || '').slice(-8),
  heeftMuur: document.body.classList.contains('heeft-wallpaper'),
  bg: document.documentElement.style.getPropertyValue('--bg'),
  avatar: !!document.querySelector('#avatarEmoji img, #avatarEmoji[style*="background"]') || (document.getElementById('avatarEmoji').innerHTML || '').includes('data:image') })"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []
    p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200]))); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    def bezoek(naam):
        del log[:]
        p.goto(B + 'vriend-profiel.html?id=' + BRAM)
        p.wait_for_function("() => document.getElementById('profielNaam').textContent === 'Bram'", timeout=15000)
        p.wait_for_timeout(2500)
        r = p.evaluate(LEES); regels = [x for x in log if x[0] == BRAM]
        print('   ' + naam + ': ' + str(kb(regels)) + ' KB voor het profiel, verzoeken: ' + str([(x[1][:30], x[3]) for x in regels]))
        return r, regels
    print('1. Vriend-profiel, eerste bezoek: alles ophalen')
    r, g = bezoek('bezoek 1')
    check('achtergrondfoto en avatar te zien', r['heeftMuur'] and r['muur'].startswith('WWW') and r['avatar'], r)
    print('2. Tweede bezoek, Bram heeft niets veranderd')
    r, g = bezoek('bezoek 2')
    check('geen foto\'s opgehaald (minder dan 20 KB)', not zwaar(g) and kb(g) < 20, (kb(g), [x[1][:20] for x in g]))
    check('achtergrondfoto en avatar toch te zien (van dit toestel)', r['heeftMuur'] and r['muur'].startswith('WWW') and r['avatar'], r)
    print('3. Bram slaat zijn profiel op met een nieuwe achtergrondfoto')
    PROF[BRAM]['wallpaper_data'] = foto('N', 1400000); PROF[BRAM]['updated_at'] = '2026-10-08T15:00:00+00:00'
    r, g = bezoek('bezoek 3')
    check('nieuwe foto opgehaald en te zien', len(zwaar(g)) == 1 and r['muur'].startswith('NNN'), (r, [x[1][:20] for x in g]))
    r, g = bezoek('bezoek 4')
    check('daarna weer zonder foto\'s ophalen, nieuwe foto blijft', not zwaar(g) and r['muur'].startswith('NNN'), (r, kb(g)))
    print('4. Foto niet meer op het toestel (bijv. opgeruimd door de iPhone)')
    p.evaluate("""id => new Promise(res => { const q = indexedDB.open('FibroDB'); q.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite');
      tx.objectStore('fotos').delete('vriend_wallpaper_' + id); tx.oncomplete = res } })""", BRAM)
    r, g = bezoek('bezoek 5')
    check('foto opnieuw opgehaald en te zien', len(zwaar(g)) == 1 and r['muur'].startswith('NNN'), (r, [x[1][:20] for x in g]))
    print('5. Bram slaat op, maar de foto\'s ophalen lukt even niet')
    PROF[BRAM]['wallpaper_data'] = foto('Z', 1400000); PROF[BRAM]['updated_at'] = '2026-10-08T16:00:00+00:00'; staat['zwaar_kapot'] = True
    r, g = bezoek('bezoek 6')
    check('pagina werkt, oude foto van het toestel', r['naam'] == 'Bram' and r['muur'].startswith('NNN'), r)
    staat['zwaar_kapot'] = False
    r, g = bezoek('bezoek 7')
    check('volgende keer wel opgehaald', len(zwaar(g)) == 1 and r['muur'].startswith('ZZZ'), (r, [x[1][:20] for x in g]))
    print('6. Een kolom bestaat niet meer: dan alles, zoals vroeger')
    staat['mist'] = 'theme'
    r, g = bezoek('bezoek 8')
    check('pagina werkt toch, met foto', r['naam'] == 'Bram' and r['muur'].startswith('ZZZ'), (r, [(x[1][:20], x[3]) for x in g]))
    staat['mist'] = None
    print('7. Home en Profiel: nooit de eigen achtergrondfoto')
    for pg, test in [('index.html', "() => (document.body.innerText.includes('Marcel'))"), ('profiel.html', "() => (document.getElementById('usernameWeergave') || {}).textContent === 'Marcel'")]:
        del log[:]; p.goto(B + pg); p.wait_for_timeout(4000)
        eigen = [x for x in log if x[0] == UID]
        alles = [x for x in eigen if x[1] == '*']
        print('   ' + pg + ': ' + str(kb(eigen)) + ' KB voor het eigen profiel, verzoeken: ' + str([x[1][:30] for x in eigen]))
        check(pg + ': eigen achtergrondfoto niet opgehaald', eigen and not zwaar(eigen), [x[1][:40] for x in eigen])
        check(pg + ': naam staat er', p.evaluate(test))
    print('8. Belscherm (inkomend gesprek): alleen naam en emoji')
    del log[:]; p.goto(B + 'bellen.html?vriend=' + BRAM + '&naam=Bram&inkomend=1&opnemen=1'); p.wait_for_timeout(2500)
    g = [x for x in log if x[0] == BRAM]
    check('belscherm: alleen naam en emoji', g and all(x[1].replace(' ', '') == 'username,avatar_url' for x in g), [x[1][:40] for x in g])
    check('belscherm: emoji van Bram te zien', p.evaluate("() => document.getElementById('avatar').textContent") == '\U0001F419', p.evaluate("() => document.getElementById('avatar').textContent"))
    check('geen paginafouten', not perr, perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
