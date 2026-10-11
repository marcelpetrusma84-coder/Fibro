import subprocess, sys, time, json, os, difflib
from playwright.sync_api import sync_playwright
# proef42: Fibro in twee talen, stap 1 (v142): taal.js + taal-en.js; inloggen, uitnodiging, Home (widgets, menu).
#  A. Nederlands: elke pagina toont precies dezelfde tekst als de oude code (alleen de taalknoppen en het
#     menu-item 'Taal / Language' zijn nieuw); dezelfde titel; geen nieuwe fouten in de console.
#  B. Engels: geen enkele '[taal] nog geen vertaling', lang="en", Engelse titels en teksten, ook in
#     dialoogjes (Berichten bewaren, Taal), widgets, gastenboek, het welkomstscherm en de opslagtip (iPhone).
#  C. Welke taal: browser en-US -> Engels; nl-NL -> Nederlands; en-US maar Fibro al gebruikt -> Nederlands;
#     zelf gekozen gaat voor alles.
#  D. Kiezen: knoppen op inloggen/uitnodiging, en het menu op Home (opnieuw laden, onthouden).
#  E. Nieuw account via een uitnodiging in het Engels: de keuze wordt bewaard; het herstelscherm werkt (naam).
#  F. Zonder woordenlijst (niet te laden): gewoon Nederlands, geen fouten. De huisregel houdt niets tegen.
# python3 -I proef42.py <scratch met tools/server.py> <map> <poort> [oude map voor A]
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); OUD = sys.argv[4] if len(sys.argv) > 4 else None
B = f'http://127.0.0.1:{PORT}/Fibro/'; BO = f'http://127.0.0.1:{PORT + 1}/Fibro/'
def www(naam, map_):
    d = S + '/www42_' + naam + '_' + str(PORT); os.makedirs(d, exist_ok=True)
    if os.path.islink(d + '/Fibro'): os.remove(d + '/Fibro')
    os.symlink(map_, d + '/Fibro'); return d
srv = [subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', www('n', MAP), str(PORT)], stderr=subprocess.DEVNULL)]
if OUD: srv.append(subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', www('o', OUD), str(PORT + 1)], stderr=subprocess.DEVNULL))
time.sleep(0.8)
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'; NIEUW = 'eeee0004-0000-4000-8000-000000000004'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NU = 1791100000000  # vaste tijd (ms), zodat klokken en timers bij oud en nieuw gelijk zijn
staat = {'signup': [], 'invite_geldig': True}
def supa(route):
    u = route.request.url; m = route.request.method
    acc = route.request.headers.get('accept') or ''
    een = 'vnd.pgrst.object' in acc
    if '/auth/v1/signup' in u:
        a = json.loads(route.request.post_data or '{}'); staat['signup'].append(a)
        return route.fulfill(status=200, json={"access_token": "x", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "refresh_token": "y",
                                               "user": {"id": NIEUW, "aud": "authenticated", "role": "authenticated", "email": a.get('email'), "user_metadata": (a.get('data') or {})}})
    if '/rest/v1/rpc/valideer_invite' in u:
        return route.fulfill(status=200, json=[{"created_by": BRAM}] if staat['invite_geldig'] else [])
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/profielen_publiek' in u:
        e = {"username": "Bram", "avatar_url": "🐸"}
        return route.fulfill(status=200, json=e if een else [e])
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "Marcel", "offline_emoji": "😊", "offline_bericht": "Lekker bezig", "bewaar_dagen": 31, "public_key": None}
        return route.fulfill(status=200, json=e if een else [e])
    if '/rest/v1/guestbook_entries' in u and m == 'GET':
        l = [{"id": 'g%d' % i, "profile_id": UID, "author_id": BRAM, "content": "Hoi %d" % i, "created_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(NU / 1000 - [30, 600, 7200, 90000, 300000, 900000][i])),
              "author": {"username": "Bram", "avatar_url": "🐸", "updated_at": "2026-10-01T00:00:00Z", "avatar_versie": None}} for i in range(6)]
        return route.fulfill(status=200, json=l)
    if '/rest/v1/messages' in u and m == 'GET':
        return route.fulfill(status=200, json=[{"content": "e2e:xyz", "sender_id": UID}])
    if '/auth/v1/logout' in u: return route.fulfill(status=204, body='')
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, json=[])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:300] if info != '' else ''))
    if not ok: fouten.append(naam)

HOME_WIDGETS = [dict(id=i, icon='x', titel=t, w=4, h=2, volgorde=n, aan=True) for n, (i, t) in enumerate([
    ('klok', 'Wereldklok'), ('datum', 'Datum'), ('online', 'Online vrienden'), ('laastbericht', 'Laatste bericht'), ('batterij', 'Batterij'),
    ('activiteit', 'Activiteit'), ('poll', 'Poll'), ('afteltimer', 'Afteltimer'), ('gastenboek', 'Gastenboek')])]
PRO_WIDGETS = [dict(id=i, icon='x', titel=t, w=4, h=2, volgorde=n, aan=True) for n, (i, t) in enumerate([
    ('mood', 'Mood'), ('muziek', 'Muziek player'), ('quote', 'Quote'), ('video', 'Video'), ('fotos_3x3', 'Foto grid 3×3'), ('opteltimer', 'Opteltimer'),
    ('spel_schaken', 'Chess')])]
def vul_home(p, iphone=False):
    p.goto((B if p._nieuw else BO) + 'login.html?logout=1')
    p.evaluate("""([t, u, h, pr]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)
      localStorage.setItem('fibro_widgets_home_' + u, h); localStorage.setItem('fibro_widgets_profiel_' + u, pr)
      localStorage.setItem('poll_' + u, JSON.stringify({ id: 'p1', vraag: 'Pizza of pasta?', opties: [{ tekst: 'Pizza', stemmen: 2 }, { tekst: 'Pasta', stemmen: 1 }], gestemd: true }))
      localStorage.setItem('aftel_' + u, JSON.stringify({ bericht: 'Vakantie', datum: '2026-12-24', tijd: '00:00' }))
      localStorage.setItem('fibro_opslagtip_later', String(Date.now()))
      localStorage.setItem('fibro_bewaren_' + u, '31') }""", [TOKEN, UID, json.dumps(HOME_WIDGETS), json.dumps(PRO_WIDGETS)])

def nieuw_ctx(br, locale='nl-NL', iphone=False, taal=None, zonder_lijst=False):
    o = dict(service_workers='block', viewport={'width': 390, 'height': 900}, locale=locale)
    if iphone: o['user_agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    ctx = br.new_context(**o)
    ctx.route('**/*supabase.co/**', supa)
    if zonder_lijst: ctx.route('**/taal-en.js*', lambda r: r.abort())
    if taal: ctx.add_init_script("try{localStorage.setItem('fibro_taal'," + json.dumps(taal) + ")}catch(e){}")
    return ctx
def nieuwe_pagina(ctx, nieuw=True):
    p = ctx.new_page(); p._nieuw = nieuw; p._log = []
    p.on('console', lambda m: p._log.append((m.type, m.text)))
    p.on('pageerror', lambda e: p._log.append(('pageerror', str(e))))
    p.clock.install(time=NU / 1000)
    return p
def tekst(p): return p.evaluate("() => document.title + '\\n' + document.body.innerText")
def fouten_in(p): return [t for (s, t) in p._log if s in ('error', 'pageerror') and 'supabase.co' not in t and 'Failed to load resource' not in t]
def mist(p): return [t for (s, t) in p._log if '[taal] nog geen vertaling' in t]
def wacht(p, ms=1500): p.clock.run_for(ms); p.wait_for_timeout(300)

SCHERMEN = [  # (naam, pad, voorbereiden)
    ('inloggen', 'login.html?logout=1', None),
    ('registreren', 'login.html?logout=1#registreren', None),
    ('herstellen', 'login.html?logout=1#herstellen', None),
    ('uitnodiging', 'invite.html?token=abc', None),
    ('uitnodiging fout', 'invite.html', None),
    ('home', 'index.html', 'home'),
    ('home menu', 'index.html', 'menu'),
    ('home bewaren', 'index.html', 'bewaren'),
]
def open_scherm(ctx, pad, wat, nieuw=True):
    p = nieuwe_pagina(ctx, nieuw)
    if wat: vul_home(p)
    p.goto((B if nieuw else BO) + pad); wacht(p, 2500)
    if pad.startswith('login.html'): p.evaluate("() => { const r = document.getElementById('reg-username'); if (r) r.value = 'TurboKikker42' }")
    if wat == 'menu': p.click('#menuBtn'); wacht(p, 300)
    if wat == 'bewaren':
        p.click('#menuBtn'); wacht(p, 300); p.click('#fibroMenu [role=menuitem] >> nth=0'); wacht(p, 800)
    return p

with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ---------------- A. Nederlands = precies als vroeger ----------------
    if OUD:
        print('A. Nederlands: zelfde tekst als de oude code')
        NIEUW_MAG = {'Nederlands', 'English', '🌐 Taal / Language'}
        for naam, pad, wat in SCHERMEN:
            uit = {}
            for nieuw in (False, True):
                ctx = nieuw_ctx(br, 'nl-NL'); p = open_scherm(ctx, pad, wat, nieuw)
                uit[nieuw] = (tekst(p), fouten_in(p), p.evaluate("document.documentElement.lang"), mist(p)); ctx.close()
            a = [l for l in uit[False][0].split('\n') if not l.strip().isdigit()]  # seconden van de afteltimer
            b = [l for l in uit[True][0].split('\n') if not l.strip().isdigit()]
            erbij = [l[1:] for l in difflib.ndiff(a, b) if l.startswith('+ ')]
            eraf = [l[1:] for l in difflib.ndiff(a, b) if l.startswith('- ')]
            check(naam + ': niets weg of anders', not eraf, eraf)
            check(naam + ': alleen de taalkeuze erbij', all(x.strip() in NIEUW_MAG for x in erbij), erbij)
            check(naam + ': geen nieuwe fouten', len(uit[True][1]) <= len(uit[False][1]), uit[True][1][:3])
            check(naam + ': lang="nl", geen vertaling gezocht', uit[True][2] == 'nl' and not uit[True][3], (uit[True][2], uit[True][3][:3]))
        # het welkomstscherm en de opslagtip op de iPhone
        for nieuw in (False, True):
            ctx = nieuw_ctx(br, 'nl-NL', iphone=True); p = nieuwe_pagina(ctx, nieuw); vul_home(p)
            p.evaluate("() => localStorage.removeItem('fibro_opslagtip_later')")
            p.goto((B if nieuw else BO) + 'index.html'); wacht(p, 2500)
            t = tekst(p)
            if not nieuw: oud_t = t
            ctx.close()
        zonder = lambda x: [l for l in x.split('\n') if not l.strip().isdigit()]
        check('iPhone (welkom + opslagtip): zelfde tekst', zonder(oud_t) == zonder(t), [l for l in difflib.ndiff(zonder(oud_t), zonder(t)) if l[:1] in '+-'][:6])

    # ---------------- B. Engels ----------------
    print('B. Engels')
    VERWACHT = {
        'inloggen': ['Fibro — Log in', 'Your personal space', 'LOG IN', 'SIGN UP', 'RECOVER', 'Username', 'Password', '🔒 End-to-end encrypted'],
        'registreren': ['Year of birth', 'Remember this name', 'I agree to the Fibro house rules', 'Create account', 'After signing up'],
        'herstellen': ['Recovery key', 'Recover account', 'Recover with Face ID'],
        'uitnodiging': ['Fibro — Invitation', 'invites you to Fibro ✨', 'Your username', 'Just the year', 'Create account 🌸', 'Already have a Fibro account?', 'Copy link'],
        'uitnodiging fout': ['Invalid invitation', 'This invite link has expired'],
        'home': ['Friends', 'Profile', 'Your profile', 'Storage on this device', 'WORLD CLOCK', 'Tokyo', 'friends online', 'battery', 'messages today',
                 'Votes: 3', '✏️ Edit', 'COUNTDOWN', 'days', 'hours', 'GUESTBOOK', 'just now', '10 min ago', '2 h ago', 'yesterday', 'p. 1 of 2',
                 'MUSIC PLAYER', 'No songs added', 'Add song', 'No video yet', 'Choose video', 'Add title', 'Your quote...' if False else 'Size', 'Save ✓',
                 'COUNT-UP TIMER', '▶ Play', 'Last message', '🔒 encrypted'],
        'home menu': ['⏳ Keep messages', '🌐 Language / Taal', '📦 Download my data', 'ℹ️ About Fibro', '🗑️ Delete account'],
        'home bewaren': ['⏳ Keep messages', 'After this time, messages disappear', '31 days (default)', '1 year', 'Close'],
    }
    NL_WOORDEN = ['Inloggen', 'Wachtwoord', 'Gebruikersnaam', 'Vrienden', 'Laden', 'Opslag op', 'stemmen', 'Gastenboek', 'GASTENBOEK', 'Wereldklok', 'WERELDKLOK',
                  'Berichten bewaren', 'Sluiten', 'Uitnodiging', 'Registreren', 'Herstel', 'geleden', 'gisteren', 'zojuist', 'dagen', 'Jouw', 'Toevoegen', 'Opslaan']
    for naam, pad, wat in SCHERMEN:
        ctx = nieuw_ctx(br, 'nl-NL', taal='en'); p = open_scherm(ctx, pad, wat)
        t = tekst(p); lang = p.evaluate("document.documentElement.lang")
        ontbreekt = [w for w in VERWACHT[naam] if w.lower() not in t.lower()]  # kopjes staan in hoofdletters (CSS)
        nog_nl = [w for w in NL_WOORDEN if w in t]
        check(naam + ': Engels', not ontbreekt and not nog_nl, {'ontbreekt': ontbreekt, 'nog Nederlands': nog_nl})
        check(naam + ': geen ontbrekende vertaling, lang="en"', not mist(p) and lang == 'en', (lang, mist(p)[:4]))
        check(naam + ': geen fouten', not fouten_in(p), fouten_in(p)[:3])
        hr = p.evaluate("() => localStorage.getItem('fibro_huisregel')")
        check(naam + ': huisregel hield niets tegen', not hr, hr)
        if naam in ('home', 'registreren', 'uitnodiging'):
            print('     --- tekst (' + naam + ') ---'); print('     ' + t.replace('\n', ' | ')[:1600])
        ctx.close()
    # widgets met invoer (poll leeg, aftel/optel leeg) en placeholders
    ctx = nieuw_ctx(br, 'nl-NL', taal='en'); p = nieuwe_pagina(ctx); vul_home(p)
    p.evaluate("u => { localStorage.removeItem('poll_' + u); localStorage.removeItem('aftel_' + u) }", UID)
    p.goto(B + 'index.html'); wacht(p, 2500)
    ph = p.evaluate("() => [...document.querySelectorAll('input[placeholder],textarea[placeholder]')].map(e => e.placeholder)")
    for w in ['Your question...', 'Option 1', 'Option 3 (optional)', 'E.g. Summer holiday 🌞', 'E.g. Together since ❤', 'Your quote...', 'Write something in the book...']:
        check('placeholder "' + w + '"', w in ph, ph)
    titels = p.evaluate("() => [...document.querySelectorAll('[title]')].map(e => e.title)")
    check('titels Engels (Log out, Post)', 'Log out' in titels and 'Post' in titels, titels)
    msgs = []
    p.on('dialog', lambda d: (msgs.append(d.message), d.accept()))
    p.click('#pok'); wacht(p, 200)
    check('melding poll Engels', msgs[-1:] == ['Fill in a question and at least 2 options'], msgs)
    p.click('#uitlogBtn'); wacht(p, 300)
    check('vraag uitloggen Engels', 'Are you sure you want to log out?' in msgs, msgs)
    check('geen ontbrekende vertaling (widgets met invoer)', not mist(p), mist(p)[:4])
    ctx.close()
    # iPhone: welkomstscherm (beltoon.js) en opslagtip (opslag.js) in het Engels
    ctx = nieuw_ctx(br, 'nl-NL', iphone=True, taal='en'); p = nieuwe_pagina(ctx); vul_home(p)
    p.evaluate("() => localStorage.removeItem('fibro_opslagtip_later')")
    p.goto(B + 'index.html'); wacht(p, 2500); t = tekst(p)
    for w in ['Welcome to', '👆 Tap to start', "🔔 Then you'll hear the ringtone", '📱 Add Fibro to your home screen', 'How to do it:', 'Add to Home Screen', 'Got it']:
        check('iPhone: "' + w + '"', w in t, t[:400].replace('\n', ' | '))
    check('iPhone: geen ontbrekende vertaling', not mist(p), mist(p)[:4])
    ctx.close()

    # ---------------- C. Welke taal ----------------
    print('C. Welke taal')
    def taal_van(locale, voor=None, pad='login.html?logout=1'):
        ctx = nieuw_ctx(br, locale); p = nieuwe_pagina(ctx)
        if voor:
            p.goto(B + 'icon.svg'); p.evaluate(voor)
        p.goto(B + pad); wacht(p, 800)
        r = p.evaluate("() => [T.taal, document.documentElement.lang, document.querySelector('.tab').textContent]"); ctx.close(); return r
    check('browser en-US, nieuw toestel: Engels', taal_van('en-US') == ['en', 'en', 'Log in'], taal_van('en-US'))
    check('browser nl-NL: Nederlands', taal_van('nl-NL') == ['nl', 'nl', 'Inloggen'], taal_van('nl-NL'))
    check('browser nl-BE: Nederlands', taal_van('nl-BE')[0] == 'nl')
    check('browser de-DE: Engels', taal_van('de-DE')[0] == 'en')
    check('en-US, maar Fibro al ingelogd geweest: Nederlands', taal_van('en-US', "t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', 'x')")[0] == 'nl')
    check('en-US, maar Fibro al gebruikt (fibro_-sleutel): Nederlands', taal_van('en-US', "() => localStorage.setItem('fibro_privkey_x', 'y')")[0] == 'nl')
    check('nl-NL, zelf Engels gekozen: Engels', taal_van('nl-NL', "() => localStorage.setItem('fibro_taal', 'en')")[0] == 'en')
    check('en-US, zelf Nederlands gekozen: Nederlands', taal_van('en-US', "() => localStorage.setItem('fibro_taal', 'nl')")[0] == 'nl')
    check('rommel in fibro_taal telt niet', taal_van('en-US', "() => localStorage.setItem('fibro_taal', 'fr')")[0] == 'en')
    ctx = nieuw_ctx(br, 'en-US'); p = nieuwe_pagina(ctx); p.goto(B + 'over.html'); wacht(p, 500)
    r = p.evaluate("() => [location.pathname.split('/').pop(), document.documentElement.lang, typeof T, T.taal, typeof window.FIBRO_EN]")
    # v146: Over Fibro is nu ook vertaald (data-taal), dus lang="en"
    check('Over Fibro (sinds v146 vertaald): lang="en", T en de woordenlijst zijn er', r == ['over.html', 'en', 'function', 'en', 'object'], r)
    ctx.close()

    # ---------------- D. Kiezen ----------------
    print('D. Kiezen')
    ctx = nieuw_ctx(br, 'nl-NL'); p = nieuwe_pagina(ctx); p.goto(B + 'login.html?logout=1'); wacht(p, 500)
    check('inloggen: knop Nederlands staat aan', p.evaluate("() => [...document.querySelectorAll('[data-kies-taal]')].map(b => b.getAttribute('aria-pressed'))") == ['true', 'false'])
    p.click('[data-kies-taal=en]'); p.wait_for_load_state(); wacht(p, 800)
    check('inloggen: na English alles Engels en onthouden', p.evaluate("() => [localStorage.getItem('fibro_taal'), document.querySelector('.tab').textContent, document.querySelector('.aan').textContent]") == ['en', 'Log in', 'English'])
    p.click('[data-kies-taal=nl]'); p.wait_for_load_state(); wacht(p, 800)
    check('inloggen: terug naar Nederlands', p.evaluate("() => [localStorage.getItem('fibro_taal'), document.querySelector('.tab').textContent]") == ['nl', 'Inloggen'])
    ctx.close()
    ctx = nieuw_ctx(br, 'nl-NL'); p = nieuwe_pagina(ctx); vul_home(p); p.goto(B + 'index.html'); wacht(p, 2000)
    p.click('#menuBtn'); wacht(p, 200)
    items = p.evaluate("() => [...document.querySelectorAll('#fibroMenu [role=menuitem]')].map(b => b.textContent)")
    check('menu: Taal / Language na Berichten bewaren', items[:2] == ['⏳ Berichten bewaren', '\U0001F310 Taal / Language'], items)
    p.click('#fibroMenu [role=menuitem]:has-text("Taal")'); wacht(p, 300)
    d = p.evaluate("() => [document.getElementById('taalTitel').textContent, [...document.querySelectorAll('#taalScherm [role=radio]')].map(b => b.textContent + '=' + b.getAttribute('aria-checked')), document.activeElement.textContent]")
    check('taalvenster: twee keuzes, Nederlands aan en in focus', d[1] == ['◉  Nederlands=true', '○  English=false'] and 'Nederlands' in d[2], d)
    p.keyboard.press('Escape'); wacht(p, 200)
    check('taalvenster: Escape sluit', p.evaluate("() => !document.getElementById('taalScherm')"))
    p.click('#menuBtn'); wacht(p, 200); p.click('#fibroMenu [role=menuitem]:has-text("Taal")'); wacht(p, 300)
    p.click('#taalScherm [role=radio]:has-text("English")'); p.wait_for_load_state(); wacht(p, 2000)
    check('menu: English kiezen -> Home in het Engels', p.evaluate("() => [localStorage.getItem('fibro_taal'), document.documentElement.lang, document.querySelectorAll('.nav-label')[1].textContent]") == ['en', 'en', 'Friends'])
    p.click('#menuBtn'); wacht(p, 200); p.click('#fibroMenu [role=menuitem]:has-text("Language")'); wacht(p, 300)
    check('taalvenster in het Engels', p.evaluate("() => document.getElementById('taalScherm').innerText").count('Not everything is in English yet') == 1)
    p.click('#taalScherm [role=radio]:has-text("Nederlands")'); p.wait_for_load_state(); wacht(p, 2000)
    check('menu: terug naar Nederlands', p.evaluate("() => [localStorage.getItem('fibro_taal'), document.querySelectorAll('.nav-label')[1].textContent]") == ['nl', 'Vrienden'])
    check('geen fouten bij het kiezen', not fouten_in(p), fouten_in(p)[:3])
    ctx.close()

    # ---------------- E. Nieuw account via een uitnodiging ----------------
    print('E. Nieuw account (uitnodiging, Engelse browser)')
    ctx = nieuw_ctx(br, 'en-US'); p = nieuwe_pagina(ctx); p.goto(B + 'invite.html?token=abc'); wacht(p, 1500)
    check('uitnodiging meteen Engels (nieuw toestel, en-US)', 'invites you to Fibro' in tekst(p) and p.evaluate("() => localStorage.getItem('fibro_taal')") is None)
    p.fill('#wachtwoord', 'geheim1234'); p.fill('#geboortejaar', '1990'); p.check('#akkoord')
    naam = p.evaluate("() => document.getElementById('gebruikersnaam').value")
    p.click('#regBtn'); wacht(p, 3000)
    check('Face ID-paneel in het Engels', ('Welcome, ' + naam + '!') in tekst(p) and 'No Face ID? Use a recovery code' in tekst(p), tekst(p)[-300:].replace('\n', ' | '))
    p.click('text=No Face ID? Use a recovery code'); p.wait_for_selector('#herstelScherm', state='visible', timeout=15000); wacht(p, 300)
    t = tekst(p)
    check('account gemaakt, keuze bewaard (en)', p.evaluate("() => localStorage.getItem('fibro_taal')") == 'en' and len(staat['signup']) == 1, (p.evaluate("() => localStorage.getItem('fibro_taal')"), len(staat['signup'])))
    check('aanmelding stuurt niets extra mee (zelfde gegevens als vroeger)', sorted((staat['signup'][-1].get('data') or {}).keys()) == ['geboortejaar', 'niveau', 'username'], staat['signup'][-1].get('data'))
    check('herstelscherm Engels met de naam erin', 'Welcome to Fibro!' in t and ('You log in with: ' + naam) in t and 'Your recovery key:' in t, t[-500:].replace('\n', ' | '))
    check('geen fouten', not fouten_in(p) and not mist(p), (fouten_in(p)[:3], mist(p)[:3]))
    ctx.close()
    ctx = nieuw_ctx(br, 'en-US'); p = nieuwe_pagina(ctx); p.goto(B + 'invite.html?token=abc'); wacht(p, 1500)
    p.click('[data-kies-taal=nl]'); p.wait_for_load_state(); wacht(p, 1500)
    p.fill('#wachtwoord', 'geheim1234'); p.fill('#geboortejaar', '1990'); p.check('#akkoord'); p.click('#regBtn'); wacht(p, 3000)
    p.click('text=Geen Face ID? Gebruik een herstelcode'); p.wait_for_selector('#herstelScherm', state='visible', timeout=15000); wacht(p, 300)
    check('uitnodiging: Nederlands gekozen -> account Nederlands', p.evaluate("() => localStorage.getItem('fibro_taal')") == 'nl' and 'Welkom bij Fibro!' in tekst(p), tekst(p)[-300:].replace('\n', ' | '))
    ctx.close()
    ctx = nieuw_ctx(br, 'nl-NL'); p = nieuwe_pagina(ctx); p.goto(B + 'login.html?logout=1#registreren'); wacht(p, 800)
    p.click('[data-kies-taal=en]'); p.wait_for_load_state(); wacht(p, 800)
    check('registreren: na English blijft het tabblad Registreren open', p.evaluate("() => document.getElementById('panel-registreren').classList.contains('active')"))
    p.fill('#reg-wachtwoord', 'geheim1234'); p.fill('#reg-jaar', '1990'); p.check('#reg-akkoord'); p.click('#reg-btn'); wacht(p, 3000)
    check('registreren: Face ID-paneel Engels', 'Account created!' in tekst(p) and 'Turn on Face ID recovery now' in tekst(p))
    p.click('text=No Face ID? Use a recovery code'); p.wait_for_selector('text=Keep your recovery key somewhere safe', timeout=15000); wacht(p, 300)
    t = tekst(p)
    check('registreren (login.html): account in het Engels', p.evaluate("() => localStorage.getItem('fibro_taal')") == 'en' and 'You will only see this once! Write it down.' in t and 'GO TO LOGIN' in t.upper(), t[-400:].replace('\n', ' | '))
    ctx.close()

    # ---------------- F. Zonder woordenlijst ----------------
    print('F. Woordenlijst niet te laden')
    ctx = nieuw_ctx(br, 'nl-NL', taal='en', zonder_lijst=True); p = open_scherm(ctx, 'index.html', 'home')
    t = tekst(p)
    check('Home gewoon in het Nederlands, geen fouten', 'Vrienden' in t and 'GASTENBOEK' in t and not fouten_in(p) and not mist(p), (fouten_in(p)[:3], mist(p)[:3]))
    ctx.close()
    br.close()
for s in srv: s.terminate()
print('\nproef42: ' + ('ALLES GOED' if not fouten else str(len(fouten)) + ' FOUT: ' + ', '.join(fouten)))
sys.exit(1 if fouten else 0)
