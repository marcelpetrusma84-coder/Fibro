import subprocess, sys, time, json, os, difflib
from playwright.sync_api import sync_playwright
# proef43: Fibro in twee talen, alle pagina's (v143 en verder). Per scherm:
#  - Nederlands: precies dezelfde tekst (zichtbare tekst, titel, en de attributen title/aria-label/placeholder)
#    als de oude code; alleen wat in MAG_ERBIJ staat mag erbij. Geen nieuwe fouten in de console.
#  - Engels: geen '[taal] nog geen vertaling', geen woorden uit NL_WOORDEN, wel de VERWACHT-woorden; lang="en".
# Een scherm = (naam, pagina, voorbereiden, actie, verwacht in het Engels). Nieuwe porties voegen schermen toe.
# python3 -I proef43.py <scratch met tools/server.py> <nieuwe map> <poort> [oude map] [filter]
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); OUD = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None
FILTER = sys.argv[5] if len(sys.argv) > 5 else ''
B = f'http://127.0.0.1:{PORT}/Fibro/'; BO = f'http://127.0.0.1:{PORT + 1}/Fibro/'
def www(naam, map_):
    d = S + '/www43_' + naam + '_' + str(PORT); os.makedirs(d, exist_ok=True)
    if os.path.islink(d + '/Fibro'): os.remove(d + '/Fibro')
    os.symlink(map_, d + '/Fibro'); return d
srv = [subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', www('n', MAP), str(PORT)], stderr=subprocess.DEVNULL)]
if OUD: srv.append(subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', www('o', OUD), str(PORT + 1)], stderr=subprocess.DEVNULL))
time.sleep(0.8)
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000001'
LOTTE = 'cccc0002-0000-4000-8000-000000000002'; KEES = 'dddd0003-0000-4000-8000-000000000003'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NU = 1791100000000
ISO = lambda s: time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(NU / 1000 - s))
PROF = {
    BRAM: {"id": BRAM, "username": "Bram", "avatar_url": "🐸", "mood": "😎 Zin in", "online_status": True, "laatst_gezien": ISO(30), "public_key": "x", "updated_at": ISO(9000), "avatar_versie": None, "bio": "Hoi", "toon_online": True},
    LOTTE: {"id": LOTTE, "username": "Lotte", "avatar_url": "🦊", "online_status": False, "offline_emoji": "💤", "offline_bericht": "Slapen", "laatst_gezien": ISO(90000), "public_key": None, "updated_at": ISO(9000), "avatar_versie": None},
}
def supa(route):
    u = route.request.url; m = route.request.method
    een = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/rpc/mijn_geblokkeerden' in u: return route.fulfill(status=200, json=[{"id": KEES, "username": "Kees", "sinds": ISO(86400 * 3)}])
    if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=True)  # v146: moderatie
    if '/rest/v1/rapporten' in u and m == 'GET':
        return route.fulfill(status=200, json=[
            {"id": "r1", "melder_id": BRAM, "gemelde_id": LOTTE, "reden": "Ongepaste inhoud", "status": "nieuw", "bericht_inhoud": "Hallo", "created_at": ISO(7200), "melder": {"username": "Bram"}, "gemelde": {"username": "Lotte"}},
            {"id": "r2", "melder_id": LOTTE, "gemelde_id": KEES, "reden": None, "status": "behandeld", "bericht_inhoud": None, "created_at": ISO(90000), "melder": {"username": "Lotte"}, "gemelde": {"username": "Kees"}}])
    if '/rest/v1/blokkades' in u and m == 'GET':
        return route.fulfill(status=200, json=[
            {"id": "b1", "gebruiker_id": KEES, "door": UID, "reden": "Spam", "van": ISO(86400), "tot": ISO(-86400 * 6), "opgeheven_op": None, "opgeheven_door": None},
            {"id": "b2", "gebruiker_id": LOTTE, "door": UID, "reden": "Test", "van": ISO(86400 * 30), "tot": ISO(86400 * 20), "opgeheven_op": None, "opgeheven_door": None}])
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/friendships' in u and m == 'GET':
        if 'profiles' in u: return route.fulfill(status=200, json=[{"friend_id": k, "profiles": v} for k, v in PROF.items()])
        return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": k} for k in PROF])  # chat.html
    if '/rest/v1/profiles' in u and m == 'GET' and 'id=in.' in u:
        return route.fulfill(status=200, json=[dict(v, public_key='x' * 20) for v in PROF.values()])
    if '/rest/v1/messages' in u and m == 'GET':
        b = [("e2e:abc", BRAM, None), ("spelinvite:schaken:" + BRAM + ":s1", BRAM, None), ("verwijderd:", UID, None), ("sticker:😀:blij", BRAM, None),
             ("e2e:def", UID, None), ("Oud antwoord", BRAM, "weg-id")]
        return route.fulfill(status=200, json=[{"id": "m%d" % i, "sender_id": z, "receiver_id": UID if z == BRAM else BRAM, "content": c, "antwoord_op": a,
                                                 "created_at": ISO(3600 - i * 60)} for i, (c, z, a) in enumerate(b)][::-1])
    if '/rest/v1/profiles' in u and m == 'GET':
        for k, v in PROF.items():
            if k in u: return route.fulfill(status=200, json=v if een else [v])
        e = {"id": UID, "username": "Marcel"}
        return route.fulfill(status=200, json=e if een else [e])
    if '/rest/v1/guestbook_entries' in u and m == 'GET':
        l = [{"id": 'g%d' % i, "profile_id": BRAM, "author_id": LOTTE, "content": "Hoi %d" % i, "created_at": ISO([30, 600, 7200, 90000, 300000, 900000][i]),
              "author": {"username": "Lotte", "avatar_url": "🦊", "updated_at": ISO(9000), "avatar_versie": None}} for i in range(6)]
        return route.fulfill(status=200, json=l)
    if '/rest/v1/poll_tellers' in u: return route.fulfill(status=200, json=[{"optie": 0, "aantal": 2}])
    if '/auth/v1/' in u and m == 'GET': return route.fulfill(status=200, json={"id": UID})
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, json=[])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:400] if info != '' else ''))
    if not ok: fouten.append(naam)

ZAAI = """async ([t, u, bram]) => {
  localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)
  localStorage.setItem('fibro_opslagtip_later', String(Date.now()))
  const db = await new Promise((ok, f) => { const r = indexedDB.open('FibroDB', 2); r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }; r.onsuccess = e => ok(e.target.result); r.onerror = f })
  const zet = (id, data) => new Promise(k => { const tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id, data }); tx.oncomplete = k })
  await zet('vriend_' + bram + '_layout', JSON.stringify([
    { id: 'poll', icon: '🗳', titel: 'Poll', w: 4, h: 3, volgorde: 0, aan: true },
    { id: 'afteltimer', icon: '⏳', titel: 'Afteltimer', w: 4, h: 2, volgorde: 1, aan: true },
    { id: 'quote', icon: '✍', titel: 'Quote', w: 4, h: 2, volgorde: 2, aan: true },
    { id: 'gastenboek', icon: '📖', titel: 'Gastenboek', w: 4, h: 4, volgorde: 3, aan: true },
    { id: 'spel_schaken', icon: '♟️', titel: 'Chess', w: 2, h: 1, volgorde: 4, aan: true },
    { id: 'opteltimer', icon: '⏱', titel: 'Opteltimer', w: 4, h: 2, volgorde: 5, aan: true }]))
  await zet('vriend_' + bram + '_poll', JSON.stringify({ id: 'p1', vraag: 'Pizza of pasta?', opties: [{ tekst: 'Pizza' }, { tekst: 'Pasta' }] }))
  await zet('vriend_' + bram + '_aftel', JSON.stringify({ bericht: '', datum: '2026-12-24', tijd: '00:00' }))
  localStorage.setItem('fibro_nietverstuurd_' + u, JSON.stringify([{ id: 'nv1', vriendId: bram, tekst: 'Hallo?', antwoordOp: null, pling: true, tijd: Date.now() }]))
}"""
LANG = 'tests/tools/proef43: lange druk'
# (naam, pagina, actie in de pagina (JS, mag leeg), verwacht in het Engels)
SCHERMEN = [
    ('vrienden', 'vrienden.html', '', ['Friends', 'FRIENDS', '+ Invite', 'Offline (1)', 'Blocked (1)', 'Blocked · tap for options', 'your network']),
    ('vrienden: uitnodigen', 'vrienden.html', "() => { openInviteModal() }", ['Invite a friend', 'Create a QR code', 'Close']),
    ('vrienden: keuzemenu vriend', 'vrienden.html', "async () => { const m = await import('./persoonblok.js?v=' + (document.querySelector('script[type=module]').textContent.match(/persoonblok\\.js\\?v=(\\d+)/) || [0, 2])[1]); m.kiesVriendActie('Bram') }", ['What do you want to do?', 'Block', 'Remove from friends list', 'Cancel']),
    ('vrienden: keuzemenu geblokkeerd', 'vrienden.html', "async () => { const m = await import('./persoonblok.js?v=' + (document.querySelector('script[type=module]').textContent.match(/persoonblok\\.js\\?v=(\\d+)/) || [0, 2])[1]); m.kiesGeblokkeerdActie('Kees') }", ['Unblock', 'Remove', 'Cancel']),
    ('vriend-profiel', 'vriend-profiel.html?id=' + BRAM, '', ['← back', 'Online', 'Zin in', 'Send a message', 'Open chat', 'Pizza of pasta?', 'COUNTDOWN', 'days', 'hours', 'No quote yet', 'GUESTBOOK', 'just now', '10 min ago', 'p. 1 of 2', '▶ Play', 'End friendship']),
    ('vriend-profiel offline', 'vriend-profiel.html?id=' + LOTTE, '', ['Slapen', 'No mood', 'End friendship']),
    ('bellen: kiezen', 'bellen.html?vriend=' + BRAM + '&naam=Bram', '', ['← back', 'Choose how you want to call', 'Call', 'Video call', 'Cancel']),
    ('bellen: inkomend', 'bellen.html?vriend=' + BRAM + '&naam=Bram&inkomend=1', '', ['← back', 'Is calling you']),
    ('home: blokkade-balk', 'index.html?blokkadetest=1', '', ['Your account is blocked until', 'Reason: Voorbeeld', 'You can still read your messages']),
    ('home: buzz-melding', 'index.html', "() => { window.testBuzz() }", ['Test is buzzing you!']),
    # v144: Chat
    ('chat: lijst', 'chat.html', '', ['Who do you want to chat with?', 'Select a friend', 'Choose who you want to chat with below', 'Bram', '← back']),
    ('chat: gesprek', 'chat.html?vriend=' + BRAM, '', ['encrypted message — tap Restore key', 'Game invite: ♟️ Chess', 'Message deleted',
        '[your message]', 'message no longer available', 'Not sent · tap to try again', 'No key on this device', 'Send photo', '● active', 'Call', 'More']),
    ('chat: melden', 'chat.html?vriend=' + BRAM, "() => { toonChatMenu(); document.getElementById('cmMeld').click() }", ['Tap the messages you want to report (max 5)', 'Cancel', 'Report']),
    ('chat: eigen sticker', 'chat.html?vriend=' + BRAM, "() => { openStickerUpload() }", ['Add your own sticker', 'Choose image', 'Choose a sound (optional)', 'Jingle', 'Heart', 'Save ✓']),
    ('chat: screenshot', 'chat.html?vriend=' + BRAM, "() => { document.getElementById('screenshotModal').classList.add('show') }", ['Screenshot permission', 'Both people have to agree', '20 minutes', 'Agree']),
    ('chat: spellen', 'chat.html?vriend=' + BRAM, "() => { toggleSpelMenu() }", ['Play together', 'Chess', 'Twin Snakes']),
    # v145: Profiel (elk tabblad)
    ('profiel: profiel', 'profiel.html', '', ['My profile', 'Save', 'Profile', 'Background', 'Animation', 'Font', 'Colour', 'Tap your avatar to change it',
        'Information', 'Display name', 'Your name', 'Username', 'your login name', "can't be changed", 'characters left', 'Write something about yourself',
        'How are you feeling today?']),
    ('profiel: achtergrond', 'profiel.html', "() => { switchTab('achtergrond') }", ['Background type', 'Your own upload', 'Background colour']),
    ('profiel: wallpaper', 'profiel.html', "() => { switchTab('achtergrond'); setAchtergrondType('wallpaper') }", ['Choose a wallpaper', 'Night', 'Ocean', 'Sunset', 'Forest']),
    ('profiel: animatie', 'profiel.html', "() => { switchTab('animatie') }", ['Choose an animation', 'None', 'Stars', 'Snow', 'Rain', 'Leaves', 'Bubbles', 'Butterflies', 'Fireflies']),
    ('profiel: lettertype', 'profiel.html', "() => { switchTab('lettertype') }", ['Choose your font', 'Life is beautiful & special', 'Standard', 'Typewriter', 'Bubbles', 'Felt pen']),
    ('profiel: kleur', 'profiel.html', "() => { switchTab('kleur') }", ['Accent colour', 'Second accent colour', 'Blocks', 'Transparency', 'Rounded corners', 'tilt with your phone', 'Your bio here', 'Button example']),
    ('profiel: widgets', 'profiel.html', "() => { switchTab('widgets') }", ['Active widgets', 'Guestbook', 'Friends leave messages', 'Photo grid', 'Featured + 4 small', 'Games', 'Play against the computer', 'Upload music']),
    # v146: Mijn gegevens, account verwijderen, moderatie, spelen tegen de computer, Over Fibro, balkjes
    ('home: mijn gegevens', 'index.html', "async () => { openMenu(); [...document.querySelectorAll('#fibroMenu [role=menuitem]')][2].click() }", ['My data', 'You get one file', 'Get data', 'Close']),
    ('home: account verwijderen', 'index.html', "async () => { openMenu(); [...document.querySelectorAll('#fibroMenu [role=menuitem]')][4].click() }", ['Delete account', 'will be deleted immediately', 'Download my data first', 'Delete account permanently', 'To confirm, type your username: Marcel']),
    ('moderatie', 'moderatie.html', '', ['Moderation', 'Reports', 'Blocks', 'New', 'Handled', 'All', 'Warned', 'Reported by @Bram', 'Inappropriate content', 'No reason given', 'Handled', 'Warn', 'Block']),
    ('moderatie: blokkades', 'moderatie.html', "() => { kiesTab('blokkades') }", ['Block someone', 'username', 'Search', 'Active', 'Earlier (log)', 'Until', 'By @', 'Lift', 'Expired on']),
    ('spel: schaken', 'spel.html?spel=schaken', '', ['Chess', 'Against the computer. Choose a level:', 'Easy', 'Normal', 'Hard', 'Back']),
    ('spel: flapper', 'spel.html?spel=flappybird', '', ['Your record: 0']),
    ('over', 'over.html', "() => { document.getElementById('technisch').open = true }", ['About Fibro', '← Back', 'What is Fibro?', 'digital living room', 'Why Fibro exists', 'How your data works', 'Your recovery code',
        'Keep it somewhere other than your phone.', 'Your data and your account', 'Download my data', 'To be honest', 'Coming soon', 'under construction', 'Turn off buzz', 'Technical', 'House rule: active. Nothing blocked.']),
    ('home: geen internet', 'index.html', "() => { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); window.dispatchEvent(new Event('offline')) }", ['No internet · you\'re seeing what\'s saved on this device']),
    ('profiel: stickers', 'profiel.html', "() => { switchTab('stickers') }", ['Active stickers', 'No stickers chosen yet', 'Nature & Plants', 'Mood & Magic', 'Animals', 'Upload your own sticker']),
]
NL_WOORDEN = ['Vrienden', 'Uitnodigen', 'Geblokkeerd', 'terug', 'Stuur een bericht', 'Chat openen', 'Gastenboek', 'GASTENBOEK', 'dagen', 'geleden', 'Vriendschap',
              'Bellen', 'Annuleer', 'Kies hoe', 'Belt je op', 'Wat wil je doen', 'Blokkeren', 'Deblokkeren', 'Verwijderen', 'Annuleren', 'Sluiten', 'buzzt',
              'Je account', 'Reden', 'Nog geen', 'Spelen', 'Laden', 'Verbinden', 'jouw netwerk',
              'Selecteer', 'chatten', 'versleuteld', 'Bericht', 'bericht', 'Niet verstuurd', 'Geen sleutel', 'Melden', 'Speel samen', 'Akkoord', 'toestemming', 'Kies',
              'Mijn profiel', 'Opslaan', 'Achtergrond', 'Lettertype', 'Kleur', 'Informatie', 'Weergavenaam', 'tekens over', 'Sterren', 'Sneeuw', 'Vlinders',
              'Blokken', 'Doorzichtigheid', 'Actieve', 'Speel tegen', 'Dieren', 'Natuur', 'Typemachine', 'Standaard', 'Het leven',
              'Mijn gegevens', 'Gegevens ophalen', 'definitief', 'Moderatie', 'Rapporten', 'Behandeld', 'Gemeld door', 'Opheffen', 'Makkelijk', 'Moeilijk',
              'Tegen de computer', 'Wat is Fibro', 'Eerlijk gezegd', 'herstelcode', 'Technisch', 'Huisregel', 'Geen internet']
MAG_ERBIJ = set()
MAG_WEG = {'Taal instellen'}  # v146: uit 'Binnenkort' op Over Fibro (is nu klaar)

def ctx_maken(br, taal):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 900}, locale='nl-NL')
    ctx.route('**/*supabase.co/**', supa)
    ctx.route('**/realtime/**', lambda r: r.abort())
    ctx.add_init_script("try{localStorage.setItem('fibro_taal'," + json.dumps(taal) + ")}catch(e){}")
    return ctx
def scherm(br, basis, taal, pad, actie):
    ctx = ctx_maken(br, taal); p = ctx.new_page(); log = []
    p.on('console', lambda m: log.append((m.type, m.text)))
    p.on('pageerror', lambda e: log.append(('pageerror', str(e))))
    p.on('dialog', lambda d: d.dismiss())
    p.clock.install(time=NU / 1000)
    p.goto(basis + 'icon.svg'); p.evaluate(ZAAI, [TOKEN, UID, BRAM])
    p.goto(basis + pad); p.clock.run_for(2500); p.wait_for_timeout(600); p.clock.run_for(1500); p.wait_for_timeout(300)
    if actie: p.evaluate(actie); p.clock.run_for(800); p.wait_for_timeout(500)
    t = p.evaluate("""() => document.title + '\\n' + document.body.innerText + '\\n' +
        [...document.querySelectorAll('[title],[aria-label],[placeholder]')].filter(e => e.offsetParent || e === document.body)
          .map(e => ['title', 'aria-label', 'placeholder'].map(a => e.getAttribute(a)).filter(Boolean).join(' / ')).join('\\n')""")
    r = (t, [x for (s, x) in log if s in ('error', 'pageerror') and 'supabase.co' not in x and 'Failed to load resource' not in x and 'WebSocket' not in x and 'navigator.vibrate' not in x],
         [x for (s, x) in log if '[taal] nog geen vertaling' in x], p.evaluate("document.documentElement.lang"))
    ctx.close(); return r
import re
zonder = lambda t: [l for l in t.split('\n') if l.strip() and not l.strip().isdigit() and not re.search(r'fibro-[a-z2-7]{16}', l)]  # uitnodigingscode is willekeurig
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for naam, pad, actie, verwacht in SCHERMEN:
        if FILTER and FILTER not in naam: continue
        print(naam)
        n = scherm(br, B, 'nl', pad, actie)
        if OUD:
            o = scherm(br, BO, 'nl', pad, actie)
            erbij = [l[2:] for l in difflib.ndiff(zonder(o[0]), zonder(n[0])) if l.startswith('+ ')]
            eraf = [l[2:] for l in difflib.ndiff(zonder(o[0]), zonder(n[0])) if l.startswith('- ')]
            check('NL: niets weg of anders', all(x.strip() in MAG_WEG for x in eraf), eraf[:6])
            check('NL: niets erbij', all(x.strip() in MAG_ERBIJ for x in erbij), erbij[:6])
            check('NL: geen nieuwe fouten', len(n[1]) <= len(o[1]), (n[1][:3], o[1][:3]))
        check('NL: geen vertaling gezocht', not n[2], n[2][:3])
        e = scherm(br, B, 'en', pad, actie)
        mist = [w for w in verwacht if w.lower() not in e[0].lower()]
        nl = [w for w in NL_WOORDEN if w in e[0]]
        check('EN: verwachte tekst', not mist, mist)
        check('EN: geen Nederlands meer', not nl, nl)
        check('EN: elke tekst vertaald, lang="en"', not e[2] and e[3] == 'en', (e[3], e[2][:4]))
        check('EN: geen fouten', not e[1], e[1][:3])
        if os.environ.get('TOON'): print('     ' + e[0].replace('\n', ' | ')[:1500])
    br.close()
for s in srv: s.terminate()
print('\nproef43: ' + ('ALLES GOED' if not fouten else str(len(fouten)) + ' FOUT: ' + ', '.join(fouten)))
sys.exit(1 if fouten else 0)
