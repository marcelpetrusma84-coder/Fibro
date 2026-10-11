import subprocess, sys, time, json, os, hashlib, urllib.parse as up
from playwright.sync_api import sync_playwright
# proef41: gastenboeken zonder steeds dezelfde foto's. Home haalde bij elk bezoek de avatar van elke schrijver
# opnieuw op; het gastenboek op vriend-profiel kreeg de avatar zelfs bij elk bericht mee (tot 40 x 20 kB).
# Nu via vriendfotos.js (zoals Vrienden en Chat): van dit toestel, alleen opnieuw als het etiket van die avatar
# anders is. Home, vriend-profiel, nieuwe avatar, alleen een nieuwe achtergrond, avatar weg, zonder internet,
# server zonder etiketten, kolom bestaat niet. Nep-PostgREST: onbekende kolom = 400 42703. Op oud en nieuw.
# python3 -I proef41.py <scratch met tools/server.py> <map> <oud|nieuw> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; SOORT = sys.argv[3]; PORT = int(sys.argv[4]); B = f'http://127.0.0.1:{PORT}/Fibro/'
NIEUW = SOORT == 'nieuw'
WWW = S + '/www41_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'; LOTTE = 'cccc0002-0000-4000-8000-000000000002'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
KOL = ['id', 'username', 'display_name', 'bio', 'mood', 'theme', 'avatar_url', 'created_at', 'updated_at', 'achtergrond_kleur', 'achtergrond_type',
       'achtergrond_url', 'animatie', 'lettertype', 'accent_kleur', 'accent_kleur2', 'widgets', 'stickers', 'niveau', 'public_key', 'geblokkeerd',
       'online_status', 'offline_emoji', 'offline_bericht', 'laatst_gezien', 'avatar_data', 'wallpaper_data', 'muziek_titel', 'muziek_artiest',
       'profiel_quote', 'widget_layout', 'is_plus', 'is_moderator', 'toon_online']
PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
def foto(teken, n=20000): return 'data:image/png;base64,' + PNG + teken * n
def rij(**w):
    r = {k: None for k in KOL}; r.update(w); return r
PROF = {
    UID: rij(id=UID, username='Marcel', avatar_url='\U0001F600', updated_at='2026-10-02T10:00:00+00:00', avatar_data=foto('M')),
    BRAM: rij(id=BRAM, username='Bram', avatar_url='\U0001F419', updated_at='2026-10-01T10:00:00+00:00', avatar_data=foto('B'), wallpaper_data=foto('W', 100000)),
    LOTTE: rij(id=LOTTE, username='Lotte', avatar_url='\U0001F338', updated_at='2026-10-01T10:00:00+00:00', avatar_data=foto('L'), wallpaper_data=foto('V', 100000)),
}
def gb(boek, schrijvers):
    return [{"id": i + (0 if boek == UID else 100), "profile_id": boek, "author_id": a, "content": "Groet %d" % i, "created_at": "2026-10-1%dT09:00:00Z" % (9 - i)} for i, a in enumerate(schrijvers)]
GB = {UID: gb(UID, [BRAM, LOTTE, BRAM, LOTTE]), BRAM: gb(BRAM, [LOTTE, UID, LOTTE, UID])}
staat = {'etiketten': True, 'mist': None}
log = []  # (soort, select, bytes)
def kolommen(): return KOL + (['avatar_versie', 'wallpaper_versie'] if staat['etiketten'] else [])
def waarde(wie, k):
    if k in ('avatar_versie', 'wallpaper_versie'):
        d = PROF[wie][k.replace('versie', 'data')]; return hashlib.md5(d.encode()).hexdigest() if d else None
    return PROF[wie][k]
def fout(route, k): return route.fulfill(status=400, json={"code": "42703", "message": "column " + k + " does not exist"})
def supa(route):
    u = route.request.url; m = route.request.method
    q = up.parse_qs(up.urlparse(u).query); sel = (q.get('select') or ['*'])[0]
    if '/rest/v1/guestbook_entries' in u and m == 'GET':
        boek = (q.get('profile_id') or ['eq.'])[0][3:]
        auteur = []
        if 'author:author_id(' in sel:
            auteur = [k.strip() for k in sel[sel.index('author:author_id(') + 17:sel.rindex(')')].split(',')]
            for k in auteur:
                if k not in kolommen() or k == staat['mist']: return fout(route, k)
        rijen = [dict(e, author={k: waarde(e['author_id'], k) for k in auteur}) for e in GB.get(boek, [])]
        body = json.dumps(rijen); log.append(('boek', sel, len(body)))
        return route.fulfill(status=200, body=body, headers={'content-type': 'application/json'})
    if '/rest/v1/profiles' in u and m == 'GET':
        kols = kolommen() if sel == '*' else [k.strip() for k in sel.split(',')]
        for k in kols:
            if k not in kolommen() or (k == staat['mist'] and sel != '*'): return fout(route, k)
        if 'id' in q and q['id'][0].startswith('in.'):
            ids = [i for i in q['id'][0][4:-1].split(',') if i in PROF]
            body = json.dumps([{k: waarde(i, k) for k in kols} for i in ids])
            log.append(('profiel-in', sel, len(body)))
            return route.fulfill(status=200, body=body, headers={'content-type': 'application/json'})
        else:
            wie = next((v for v in PROF if 'id=eq.' + v in u), UID)
            r = {k: waarde(wie, k) for k in kols}
            body = json.dumps(r if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [r])
        log.append(('profiel', sel, len(body)))
        return route.fulfill(status=200, body=body, headers={'content-type': 'application/json'})
    if '/rest/v1/friendships' in u and m == 'GET': return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": v, "status": "accepted"} for v in (BRAM, LOTTE)])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:230] if info != '' else ''))
    if not ok: fouten.append(naam)
def fotobytes(): return round(sum(x[2] for x in log if x[0] == 'profiel-in' and 'avatar_data' in x[1]) / 1024, 1)  # foto's van de schrijvers (niet het eigen profiel)
def boekbytes(): return round(sum(x[2] for x in log if x[0] == 'boek') / 1024, 1)
LEES = """sel => [...document.querySelectorAll(sel + ' > div')].map(d => { const i = d.querySelector('img');
  const naam = (d.querySelector('span') || {}).textContent || '?'; return naam + ':' + (i ? i.src.slice(-3) : 'emoji') })"""
LAY = json.dumps([{"id": "gastenboek", "aan": True, "w": 4, "h": 4, "volgorde": 0, "icon": "x", "titel": "Gastenboek"}])
OFFLINE = "(() => { if (localStorage.getItem('proef_offline') === '1') Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }) })()"
def nieuwe_foto(wie, soort, data, tijd): PROF[wie][soort + '_data'] = data; PROF[wie]['updated_at'] = tijd
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block', viewport={'width': 400, 'height': 900}); ctx.route('**/*supabase.co/**', supa)
    ctx.add_init_script(OFFLINE)
    p = ctx.new_page(); perr = []
    p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200]))); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html')
    p.evaluate("([t, u, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_widgets_home_' + u, l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, UID, LAY])
    p.evaluate("""([id, lay]) => new Promise(res => { const r = indexedDB.open('FibroDB', 2); r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos', { keyPath: 'id' }) };
      r.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: 'vriend_' + id + '_layout', data: lay, hash: 'a' }); tx.oncomplete = res } })""", [BRAM, LAY])
    def offline(aan): p.evaluate("a => a ? localStorage.setItem('proef_offline', '1') : localStorage.removeItem('proef_offline')", aan)
    def home(naam):
        del log[:]
        p.goto(B + 'index.html'); p.wait_for_function("() => /Groet/.test((document.querySelector('#gbl') || {}).textContent || '')", timeout=15000)
        p.wait_for_timeout(3000)
        r = p.evaluate(LEES, '#gbl')
        print('   Home ' + naam + ': ' + str(r) + ' | foto\'s ' + str(fotobytes()) + ' kB, boek ' + str(boekbytes()) + ' kB')
        return r
    def vriend(naam):
        del log[:]
        p.goto(B + 'vriend-profiel.html?id=' + BRAM); p.wait_for_function("() => /Groet/.test((document.querySelector('#gbwLijst') || {}).textContent || '')", timeout=15000)
        p.wait_for_timeout(3000)
        r = p.evaluate(LEES, '#gbwLijst')
        # alleen wat het gastenboek ophaalt (niet de foto's van Bram zelf bovenaan het profiel)
        gb_fotos = fotobytes()
        print('   Vriend ' + naam + ': ' + str(r) + ' | boek ' + str(boekbytes()) + ' kB, foto\'s voor het boek ' + str(gb_fotos) + ' kB')
        return r, boekbytes() + gb_fotos
    print('A. Home: mijn eigen gastenboek (Bram en Lotte schreven erin)')
    r = home('bezoek 1')
    check('foto\'s van Bram en Lotte te zien', r == ['Bram:BBB', 'Lotte:LLL', 'Bram:BBB', 'Lotte:LLL'], r)
    r = home('bezoek 2'); kb = fotobytes()
    check('foto\'s te zien', r == ['Bram:BBB', 'Lotte:LLL', 'Bram:BBB', 'Lotte:LLL'], r)
    if NIEUW: check('nieuw: tweede bezoek geen foto\'s opgehaald', kb == 0, kb)
    else: check('oud (controle): tweede bezoek alle foto\'s opnieuw', kb > 30, kb)
    nieuwe_foto(BRAM, 'avatar', foto('C'), '2026-10-11T09:00:00+00:00')
    r = home('Bram nieuwe avatar'); kb = fotobytes()
    # de nieuwe foto is even lang als de oude: de oude code zag dan geen verschil en tekende het boek niet opnieuw
    if NIEUW: check('nieuw: nieuwe avatar van Bram meteen te zien', r == ['Bram:CCC', 'Lotte:LLL', 'Bram:CCC', 'Lotte:LLL'], r)
    else: check('oud (controle): even lange nieuwe foto pas de volgende keer te zien', r == ['Bram:BBB', 'Lotte:LLL', 'Bram:BBB', 'Lotte:LLL'], r)
    if NIEUW: check('nieuw: alleen Bram opgehaald (< 25 kB)', 15 < kb < 25, kb)
    nieuwe_foto(LOTTE, 'wallpaper', foto('Q', 100000), '2026-10-11T09:10:00+00:00')
    r = home('Lotte alleen nieuwe achtergrond'); kb = fotobytes()
    check('foto\'s te zien', r == ['Bram:CCC', 'Lotte:LLL', 'Bram:CCC', 'Lotte:LLL'], r)
    if NIEUW: check('nieuw: niets opgehaald', kb == 0, kb)
    offline(True)
    r = home('zonder internet')
    check('zonder internet: boek met foto\'s', r == ['Bram:CCC', 'Lotte:LLL', 'Bram:CCC', 'Lotte:LLL'], r)
    offline(False)
    print('B. Vriend-profiel van Bram: zijn gastenboek (Lotte en ik schreven erin)')
    r, kb = vriend('bezoek 1')
    check('foto\'s van Lotte en Marcel te zien', r == ['Lotte:LLL', 'Marcel:MMM', 'Lotte:LLL', 'Marcel:MMM'], r)
    if NIEUW: check('nieuw: Lotte stond al op dit toestel (van Home): alleen Marcel opgehaald (< 25 kB)', kb < 25, kb)
    else: check('oud (controle): bij elk bericht de foto (> 70 kB)', kb > 70, kb)
    r, kb = vriend('bezoek 2')
    check('foto\'s te zien', r == ['Lotte:LLL', 'Marcel:MMM', 'Lotte:LLL', 'Marcel:MMM'], r)
    if NIEUW: check('nieuw: tweede bezoek < 3 kB', kb < 3, kb)
    else: check('oud (controle): weer > 70 kB', kb > 70, kb)
    nieuwe_foto(LOTTE, 'avatar', foto('K'), '2026-10-11T09:20:00+00:00')
    r, kb = vriend('Lotte nieuwe avatar')
    check('nieuwe avatar van Lotte te zien', r == ['Lotte:KKK', 'Marcel:MMM', 'Lotte:KKK', 'Marcel:MMM'], r)
    offline(True)
    r, kb = vriend('zonder internet')
    check('zonder internet: boek met foto\'s', r == ['Lotte:KKK', 'Marcel:MMM', 'Lotte:KKK', 'Marcel:MMM'], r)
    offline(False)
    nieuwe_foto(LOTTE, 'avatar', None, '2026-10-11T09:30:00+00:00')
    r, kb = vriend('Lotte haalt haar avatar weg')
    check('Lotte weer met emoji', r == ['Lotte:emoji', 'Marcel:MMM', 'Lotte:emoji', 'Marcel:MMM'], r)
    r = home('daarna Home')
    check('Home: Lotte ook met emoji', r == ['Bram:CCC', 'Lotte:emoji', 'Bram:CCC', 'Lotte:emoji'], r)
    print('C. Server zonder etiketten (bv. SQL teruggedraaid)')
    staat['etiketten'] = False
    nieuwe_foto(BRAM, 'avatar', foto('D'), '2026-10-11T09:40:00+00:00')
    r = home('Bram nieuwe avatar')
    if NIEUW: check('Home werkt: nieuwe avatar van Bram', r == ['Bram:DDD', 'Lotte:emoji', 'Bram:DDD', 'Lotte:emoji'], r)
    r = home('nog een keer'); kb = fotobytes()
    if NIEUW: check('nieuw: daarna niets opgehaald', kb == 0, kb)
    r, kb = vriend('vriend-profiel')
    check('vriend-profiel werkt', r == ['Lotte:emoji', 'Marcel:MMM', 'Lotte:emoji', 'Marcel:MMM'], r)
    staat['etiketten'] = True
    print('D. Een kolom bestaat niet meer (updated_at): dan geen boek van de server, wel het bewaarde')
    staat['mist'] = 'updated_at'
    r = home('Home')
    check('Home: boek staat er (bewaard)', len(r) == 4, r)
    staat['mist'] = None
    check('geen paginafouten', not perr, perr[:3])
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
