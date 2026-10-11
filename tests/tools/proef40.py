import subprocess, sys, time, json, os, hashlib, urllib.parse as up
from playwright.sync_api import sync_playwright
# proef40: een eigen etiket per foto (avatar_versie, wallpaper_versie = md5 van de foto, gezet door de database,
# sql/foto-etiketten.sql). Vriend-profiel haalt alleen de foto op waarvan het etiket anders is; Vrienden en Chat
# (vriendfotos.js) halen de avatar niet meer op na een nieuwe achtergrond. Overgang: eerst een server zonder
# etiketten (zoals nu), dan met: niets opnieuw ophalen. Ook: zelfde foto opnieuw opgeslagen, foto weggehaald,
# foto niet meer op het toestel, ophalen lukt even niet, server zonder etiketten, kolom bestaat niet meer.
# Nep-PostgREST: select=... geeft alleen die kolommen, onbekende kolom = 400 42703. Op oud en nieuw.
# python3 -I proef40.py <scratch met tools/server.py> <map> <oud|nieuw> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; SOORT = sys.argv[3]; PORT = int(sys.argv[4]); B = f'http://127.0.0.1:{PORT}/Fibro/'
NIEUW = SOORT == 'nieuw'
WWW = S + '/www40_' + str(PORT); os.makedirs(WWW, exist_ok=True)
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
def foto(teken, n): return 'data:image/png;base64,' + PNG + teken * n
def rij(**w):
    r = {k: None for k in KOL}; r.update(w); return r
PROF = {
    BRAM: rij(id=BRAM, username='Bram', bio='Bio van Bram', avatar_url='\U0001F419', online_status=True, laatst_gezien='2026-10-11T08:00:00Z',
              updated_at='2026-10-01T10:00:00+00:00', achtergrond_kleur='#ff0000', avatar_data=foto('A', 20000), wallpaper_data=foto('W', 1500000)),
    LOTTE: rij(id=LOTTE, username='Lotte', avatar_url='\U0001F338', online_status=True, laatst_gezien='2026-10-11T08:00:00Z',
               updated_at='2026-10-01T10:00:00+00:00', avatar_data=foto('L', 20000), wallpaper_data=foto('V', 1500000)),
    UID: rij(id=UID, username='Marcel', avatar_url='\U0001F600', updated_at='2026-10-02T10:00:00+00:00', avatar_data=foto('M', 20000)),
}
staat = {'etiketten': False, 'mist': None, 'fotos_kapot': False}
log = []  # (wie, select, bytes, status)
def kolommen():
    return KOL + (['avatar_versie', 'wallpaper_versie'] if staat['etiketten'] else [])
def waarde(wie, k):
    if k == 'avatar_versie': d = PROF[wie]['avatar_data']; return hashlib.md5(d.encode()).hexdigest() if d else None
    if k == 'wallpaper_versie': d = PROF[wie]['wallpaper_data']; return hashlib.md5(d.encode()).hexdigest() if d else None
    return PROF[wie][k]
def fout(route, wie, sel, k):
    log.append((wie, sel, 0, 400))
    return route.fulfill(status=400, json={"code": "42703", "message": "column profiles." + k + " does not exist"})
def supa(route):
    u = route.request.url; m = route.request.method
    q = up.parse_qs(up.urlparse(u).query); sel = (q.get('select') or ['*'])[0]
    if '/rest/v1/friendships' in u and m == 'GET':
        if 'profiles' in sel:
            kols = [k.strip() for k in sel[sel.index('(') + 1:sel.rindex(')')].split(',')]
            for k in kols:
                if k not in kolommen() or k == staat['mist']: return fout(route, 'lijst', sel, k)
            return route.fulfill(status=200, json=[{"friend_id": v, "profiles": {k: waarde(v, k) for k in kols}} for v in (LOTTE, BRAM)])
        return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": v} for v in (LOTTE, BRAM)])
    if '/rest/v1/profiles' in u and m == 'GET':
        kols = kolommen() if sel == '*' else [k.strip() for k in sel.split(',')]
        if sel != '*':
            for k in kols:
                if k not in kolommen() or k == staat['mist']: return fout(route, 'profiel', sel, k)
        if staat['fotos_kapot'] and ('avatar_data' in kols or 'wallpaper_data' in kols) and sel != '*':
            log.append(('?', sel, 0, 500)); return route.fulfill(status=500, json={"message": "kapot"})
        if 'id' in q and q['id'][0].startswith('in.'):
            ids = [i for i in q['id'][0][4:-1].split(',') if i in PROF]
            body = json.dumps([{k: waarde(i, k) for k in kols} for i in ids])
            log.append(('lijst:' + ','.join(sorted(ids)), sel, len(body), 200))
            return route.fulfill(status=200, body=body, headers={'content-type': 'application/json'})
        wie = next((v for v in PROF if 'id=eq.' + v in u), None)
        if not wie: return route.fulfill(status=200, json=[])
        r = {k: waarde(wie, k) for k in kols}
        body = json.dumps(r if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [r])
        log.append((wie, sel, len(body), 200))
        return route.fulfill(status=200, body=body, headers={'content-type': 'application/json'})
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:230] if info != '' else ''))
    if not ok: fouten.append(naam)
def kb(regels): return round(sum(r[2] for r in regels) / 1024, 1)
def haalt(regels, kolom): return [r for r in regels if r[3] == 200 and (r[1] == '*' or kolom in r[1])]
LEES = """async () => { const db = await new Promise(r => { const q = indexedDB.open('FibroDB'); q.onsuccess = () => r(q.result) })
  const get = id => new Promise(r => { const q = db.transaction('fotos').objectStore('fotos').get(id); q.onsuccess = () => r(q.result ? q.result.data.slice(-3) : null) })
  const a = document.getElementById('avatarEmoji')
  return { naam: document.getElementById('profielNaam').textContent,
    muur: (document.getElementById('wallpaperBg').style.backgroundImage || '').slice(-5, -2),
    avatar: ((a.innerHTML.match(/data:image[^"]*/) || [''])[0]).slice(-3) || ('emoji:' + a.textContent.trim()),
    opslag_avatar: await get('vriend_avatar_""" + BRAM + """'), opslag_muur: await get('vriend_wallpaper_""" + BRAM + """') } }"""
VRIENDEN = """() => Object.fromEntries([...document.querySelectorAll('.friend-row')].map(r => { const a = r.querySelector('.vriend-foto');
  return [r.dataset.vid, a ? (/^url/.test(a.style.backgroundImage) ? a.style.backgroundImage.slice(-6, -2) : ('emoji:' + a.textContent)) : 'geen'] }))"""
CHATLIJST = """() => Object.fromEntries([...document.querySelectorAll('#vriendenLijst .vriend-item')].map(r => { const a = r.querySelector('.vriend-av');
  return [r.dataset.vid, /^url/.test(a.style.backgroundImage) ? a.style.backgroundImage.slice(-6, -2) : ('emoji:' + a.textContent)] }))"""
def nieuwe_foto(wie, soort, data, tijd):
    PROF[wie][soort + '_data'] = data; PROF[wie]['updated_at'] = tijd  # zoals Profiel opslaan (v137): updated_at alleen bij een andere foto
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
        r = p.evaluate(LEES); g = [x for x in log if x[0] in (BRAM, '?')]
        print('   ' + naam + ': ' + str(kb(g)) + ' KB, verzoeken: ' + str([(x[1][:40] if len(x[1]) < 60 else x[1][:12] + '...' + x[1][-30:], x[3]) for x in g]))
        return r, g
    def lijst(pagina, naam):
        del log[:]
        p.goto(B + pagina); p.wait_for_timeout(3000)
        r = p.evaluate(VRIENDEN if pagina == 'vrienden.html' else CHATLIJST)
        g = [x for x in log if x[0].startswith('lijst') and 'avatar_data' in x[1]]
        print('   ' + naam + ': ' + str(r) + ' | avatars opgehaald: ' + str([x[0] for x in g]))
        return r, g
    print('A. Vriend-profiel van Bram')
    print('1. Server zonder etiketten (zoals nu): eerste bezoek haalt alles')
    r, g = bezoek('bezoek 1')
    check('avatar en achtergrond te zien', r['avatar'] == 'AAA' and r['muur'] == 'WWW', r)
    print('2. Marcel draait foto-etiketten.sql; Bram veranderde niets')
    staat['etiketten'] = True
    r, g = bezoek('bezoek 2')
    check('geen foto\'s opnieuw opgehaald', not haalt(g, 'avatar_data') and not haalt(g, 'wallpaper_data') and kb(g) < 20, (kb(g), r))
    check('foto\'s toch te zien', r['avatar'] == 'AAA' and r['muur'] == 'WWW', r)
    print('3. Bram zet alleen een nieuwe avatar')
    nieuwe_foto(BRAM, 'avatar', foto('B', 20000), '2026-10-11T09:00:00+00:00')
    r, g = bezoek('bezoek 3')
    check('nieuwe avatar te zien, achtergrond nog', r['avatar'] == 'BBB' and r['muur'] == 'WWW', r)
    if NIEUW: check('nieuw: alleen de avatar opgehaald (< 40 KB)', len(haalt(g, 'avatar_data')) == 1 and not haalt(g, 'wallpaper_data') and kb(g) < 40, kb(g))
    else: check('oud (controle): achtergrond ook opgehaald (> 1 MB)', haalt(g, 'wallpaper_data') and kb(g) > 1000, kb(g))
    r, g = bezoek('bezoek 4')
    check('daarna niets opgehaald', not haalt(g, 'avatar_data') and not haalt(g, 'wallpaper_data'), kb(g))
    print('4. Bram zet alleen een nieuwe achtergrond')
    nieuwe_foto(BRAM, 'wallpaper', foto('X', 1400000), '2026-10-11T09:10:00+00:00')
    r, g = bezoek('bezoek 5')
    check('nieuwe achtergrond te zien, avatar nog', r['avatar'] == 'BBB' and r['muur'] == 'XXX', r)
    if NIEUW: check('nieuw: alleen de achtergrond opgehaald', len(haalt(g, 'wallpaper_data')) == 1 and not haalt(g, 'avatar_data'), [x[1][:30] for x in g])
    else: check('oud (controle): avatar ook opgehaald', haalt(g, 'avatar_data'), [x[1][:30] for x in g])
    print('5. Bram slaat dezelfde avatar opnieuw op (ander toestel): updated_at anders, etiket hetzelfde')
    nieuwe_foto(BRAM, 'avatar', foto('B', 20000), '2026-10-11T09:20:00+00:00')
    r, g = bezoek('bezoek 6')
    if NIEUW: check('nieuw: niets opgehaald', not haalt(g, 'avatar_data') and not haalt(g, 'wallpaper_data') and kb(g) < 20, kb(g))
    else: check('oud (controle): alles opnieuw (> 1 MB)', kb(g) > 1000, kb(g))
    check('foto\'s te zien', r['avatar'] == 'BBB' and r['muur'] == 'XXX', r)
    print('6. Achtergrond niet meer op dit toestel (bv. opgeruimd door de iPhone)')
    p.evaluate("""id => new Promise(res => { const q = indexedDB.open('FibroDB'); q.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite');
      tx.objectStore('fotos').delete('vriend_wallpaper_' + id); tx.oncomplete = res } })""", BRAM)
    r, g = bezoek('bezoek 7')
    check('achtergrond opnieuw opgehaald en te zien', len(haalt(g, 'wallpaper_data')) == 1 and r['muur'] == 'XXX', (r, [x[1][:30] for x in g]))
    if NIEUW: check('nieuw: avatar niet opgehaald', not haalt(g, 'avatar_data'), [x[1][:30] for x in g])
    print('7. Nieuwe achtergrond, maar foto\'s ophalen lukt even niet')
    nieuwe_foto(BRAM, 'wallpaper', foto('Z', 1400000), '2026-10-11T09:30:00+00:00'); staat['fotos_kapot'] = True
    r, g = bezoek('bezoek 8')
    check('pagina werkt, oude achtergrond van het toestel', r['naam'] == 'Bram' and r['muur'] == 'XXX' and r['avatar'] == 'BBB', r)
    staat['fotos_kapot'] = False
    r, g = bezoek('bezoek 9')
    check('volgende keer wel opgehaald', len(haalt(g, 'wallpaper_data')) == 1 and r['muur'] == 'ZZZ', (r, [x[1][:30] for x in g]))
    if NIEUW: check('nieuw: avatar ook dan niet opgehaald', not haalt(g, 'avatar_data'), [x[1][:30] for x in g])
    print('8. Bram haalt zijn avatar weg')
    nieuwe_foto(BRAM, 'avatar', None, '2026-10-11T09:40:00+00:00')
    r, g = bezoek('bezoek 10')
    check('weer de emoji', r['avatar'] == 'emoji:\U0001F419' and r['muur'] == 'ZZZ', r)
    if NIEUW: check('nieuw: ook van dit toestel weg', r['opslag_avatar'] is None, r)
    r, g = bezoek('bezoek 11')
    check('blijft de emoji', r['avatar'] == 'emoji:\U0001F419', r)
    print('9. Server zonder etiketten (bv. SQL teruggedraaid): werkt zoals vroeger')
    staat['etiketten'] = False
    nieuwe_foto(BRAM, 'avatar', foto('C', 20000), '2026-10-11T09:50:00+00:00')
    r, g = bezoek('bezoek 12')
    check('nieuwe avatar te zien', r['avatar'] == 'CCC' and r['muur'] == 'ZZZ', r)
    r, g = bezoek('bezoek 13')
    check('daarna niets opgehaald', not haalt(g, 'avatar_data') and not haalt(g, 'wallpaper_data'), [x[1][:30] for x in g])
    staat['etiketten'] = True
    r, g = bezoek('bezoek 14')
    check('etiketten weer aan: niets opgehaald', not haalt(g, 'avatar_data') and not haalt(g, 'wallpaper_data'), [x[1][:30] for x in g])
    print('10. Een kolom bestaat niet meer: dan alles, zoals vroeger')
    staat['mist'] = 'theme'
    r, g = bezoek('bezoek 15')
    check('pagina werkt toch, met foto\'s', r['naam'] == 'Bram' and r['muur'] == 'ZZZ' and r['avatar'] == 'CCC', r)
    staat['mist'] = None
    r, g = bezoek('bezoek 16')
    check('daarna weer niets opgehaald', not haalt(g, 'avatar_data') and not haalt(g, 'wallpaper_data'), [x[1][:30] for x in g])

    print('B. Vrienden en Chat (avatars in de lijst)')
    staat['etiketten'] = False
    p.evaluate("u => localStorage.removeItem('fibro_vriendfotos_' + u)", UID)
    r, g = lijst('vrienden.html', '1. server zonder etiketten, eerste keer')
    check('Lotte met foto', r.get(LOTTE) == 'LLLL', r)
    staat['etiketten'] = True
    r, g = lijst('vrienden.html', '2. met etiketten, niets veranderd')
    check('niets opgehaald, foto\'s te zien', not g and r.get(LOTTE) == 'LLLL', (r, g))
    nieuwe_foto(LOTTE, 'wallpaper', foto('Q', 1400000), '2026-10-11T10:00:00+00:00')
    r, g = lijst('vrienden.html', '3. Lotte zet alleen een nieuwe achtergrond')
    if NIEUW: check('nieuw: avatar van Lotte niet opgehaald', not g and r.get(LOTTE) == 'LLLL', (r, g))
    else: check('oud (controle): avatar van Lotte opnieuw opgehaald', g and r.get(LOTTE) == 'LLLL', (r, g))
    r, g = lijst('chat.html', '4. Chat')
    check('Chat: niets opgehaald, foto te zien', not g and r.get(LOTTE) == 'LLLL', (r, g))
    nieuwe_foto(LOTTE, 'avatar', foto('K', 20000), '2026-10-11T10:10:00+00:00')
    r, g = lijst('chat.html', '5. Lotte zet een nieuwe avatar, Chat')
    check('nieuwe avatar in Chat, alleen Lotte opgehaald', r.get(LOTTE) == 'KKKK' and [x[0] for x in g] == ['lijst:' + LOTTE], (r, g))
    r, g = lijst('vrienden.html', '6. daarna Vrienden')
    check('Vrienden: nieuwe avatar, niets opgehaald', not g and r.get(LOTTE) == 'KKKK', (r, g))
    nieuwe_foto(LOTTE, 'avatar', None, '2026-10-11T10:20:00+00:00')
    r, g = lijst('vrienden.html', '7. Lotte haalt haar avatar weg')
    check('weer de emoji', r.get(LOTTE) == 'emoji:\U0001F338', r)
    staat['etiketten'] = False
    nieuwe_foto(LOTTE, 'avatar', foto('J', 20000), '2026-10-11T10:30:00+00:00')
    r, g = lijst('vrienden.html', '8. server zonder etiketten, Lotte nieuwe avatar')
    check('werkt zoals vroeger: nieuwe avatar', r.get(LOTTE) == 'JJJJ' and g, (r, g))
    r, g = lijst('chat.html', '9. server zonder etiketten, Chat')
    check('Chat werkt, niets opgehaald', r.get(LOTTE) == 'JJJJ' and not g, (r, g))
    staat['etiketten'] = True
    check('geen paginafouten', not perr, perr[:3])
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
