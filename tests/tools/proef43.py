import subprocess, sys, time, json, os, difflib, re
from playwright.sync_api import sync_playwright
# proef43: Fibro in twee talen, alle pagina's (v143 en verder; v157: stickervel 1 en knopjes in Profiel). Per scherm:
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
    ('chat: lijst', 'chat.html', '', ['Who do you want to chat with?', 'Chat', 'Bram', '← back']),  # v191: bovenaan alleen 'Chat'
    ('chat: gesprek', 'chat.html?vriend=' + BRAM, '', ['encrypted message — tap Restore key', 'Game invite: ♟️ Chess', 'Message deleted',
        '[your message]', 'message no longer available', 'Not sent · tap to try again', 'No key on this device', 'Send photo', 'Call', 'More']),  # v199: '● active' weg
    ('chat: melden', 'chat.html?vriend=' + BRAM, "() => { toonChatMenu(); document.getElementById('cmMeld').click() }", ['Tap the messages you want to report (max 5)', 'Cancel', 'Report']),
    # v153: het oude venster 'Eigen sticker toevoegen' is weg; nu de stickerkeuze (vakje Eigen open)
    ('chat: stickerkeuze', 'chat.html?vriend=' + BRAM, "() => { toggleStickers(); const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\\'e1\\']'); if (v) v.click() }",
        ['Fibro sheets', 'Your own', 'Shop', 'Sheet 1', 'Your own sheet 2', 'Shop slot 4', 'You make your own stickers in Style']),
    ('chat: screenshot', 'chat.html?vriend=' + BRAM, "() => { document.getElementById('screenshotModal').classList.add('show') }", ['Screenshot permission', 'Both people have to agree', '20 minutes', 'Agree']),
    ('chat: spellen', 'chat.html?vriend=' + BRAM, "() => { toggleSpelMenu() }", ['Play together', 'Chess', 'Twin Snakes']),
    # v145: Profiel (elk tabblad)
    ('profiel: profiel', 'profiel.html', '', ['My style', 'Save', 'Profile', 'Background', 'Animation', 'Font', 'Colour', 'Tap your avatar to change it',
        'Information', 'Display name', 'Your name', 'Username', 'your login name', "can't be changed", 'characters left', 'Write something about yourself',
        'How are you feeling today?', 'Profile music', 'plays automatically on your Home', 'Upload a music file']),
    ('profiel: achtergrond', 'profiel.html', "() => { switchTab('achtergrond') }", ['Background type', 'Your own upload', 'Background colour']),
    ('profiel: wallpaper', 'profiel.html', "() => { switchTab('achtergrond'); setAchtergrondType('wallpaper') }", ['Choose a wallpaper', 'Night', 'Ocean', 'Sunset', 'Forest']),
    ('profiel: animatie', 'profiel.html', "() => { switchTab('animatie') }", ['Choose an animation', 'None', 'Stars', 'Snow', 'Rain', 'Leaves', 'Bubbles', 'Butterflies', 'Fireflies']),
    ('profiel: lettertype', 'profiel.html', "() => { switchTab('lettertype') }", ['Choose your font', 'Life is beautiful & special', 'Standard', 'Typewriter', 'Bubbles', 'Felt pen']),
    ('profiel: kleur', 'profiel.html', "() => { switchTab('kleur') }", ['Accent colour', 'Second accent colour', 'Blocks', 'Transparency', 'Rounded corners', 'tilt with your phone', 'Your bio here', 'Button example']),
    ('profiel: widgets', 'profiel.html', "() => { switchTab('widgets') }", ['Active widgets', 'Guestbook', 'Friends leave messages', 'Photo grid', 'Featured + 4 small', 'Games', 'Play against the computer']),  # v179: Upload music staat nu bij Profiel
    # v146: Mijn gegevens, account verwijderen, moderatie, spelen tegen de computer, Over Fibro, balkjes
    ('home: mijn gegevens', 'index.html', "async () => { openMenu(); [...document.querySelectorAll('#fibroMenu [role=menuitem]')].find(b => /gegevens|my data/i.test(b.textContent)).click() }", ['My data', 'You get one file', 'Get data', 'Close']),
    ('home: account verwijderen', 'index.html', "async () => { openMenu(); [...document.querySelectorAll('#fibroMenu [role=menuitem]')].find(b => /Account verwijderen|Delete account/.test(b.textContent)).click() }", ['Delete account', 'will be deleted immediately', 'Download my data first', 'Delete account permanently', 'To confirm, type your username: Marcel']),
    # v178: het menu in groepjes en de uitleg om Fibro als app te installeren (de oude code heeft die nog niet)
    ('home: menu', 'index.html', "() => { openMenu() }", ['Settings', 'Account settings', 'My Fibro', 'Language / Taal', 'Keep messages', 'My music automatically: on', "Friends' music automatically: on", 'Download my data', 'Delete account', 'About Fibro', 'Install Fibro as an app']),
    ('home: app installeren', 'index.html', "() => { openMenu(); const b = [...document.querySelectorAll('#fibroMenu [role=menuitem]')].find(b => /als app|as an app/.test(b.textContent)); if (b) b.click() }",
        ['Install Fibro as an app', "Add Fibro to your phone's home screen", 'Open Fibro in Safari', 'Add to Home Screen', 'Open as Web App', 'only way to get notifications', 'Open Fibro in Chrome', 'three dots', 'Install app', 'Then open Fibro from the new icon', 'Close']),
    ('moderatie', 'moderatie.html', '', ['Moderation', 'Reports', 'Blocks', 'New', 'Handled', 'All', 'Warned', 'Reported by @Bram', 'Inappropriate content', 'No reason given', 'Handled', 'Warn', 'Block']),
    ('moderatie: blokkades', 'moderatie.html', "() => { kiesTab('blokkades') }", ['Block someone', 'username', 'Search', 'Active', 'Earlier (log)', 'Until', 'By @', 'Lift', 'Expired on']),
    ('spel: schaken', 'spel.html?spel=schaken', '', ['Chess', 'Against the computer. Choose a level:', 'Easy', 'Normal', 'Hard', 'Back']),
    ('spel: flapper', 'spel.html?spel=flappybird', '', ['Your record: 0']),
    ('over', 'over.html', "() => { document.getElementById('technisch').open = true }", ['About Fibro', '← Back', 'What is Fibro?', 'digital living room', 'Why Fibro exists', 'How your data works', 'Your recovery code',
        'Keep it somewhere other than your phone.', 'Your data and your account', 'Download my data', 'To be honest', 'Coming soon', 'under construction', 'Turn off buzz', 'Technical', 'House rule: active. Nothing blocked.']),
    ('home: geen internet', 'index.html', "() => { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); window.dispatchEvent(new Event('offline')) }", ['No internet · you\'re seeing what\'s saved on this device']),
    ('profiel: stickers', 'profiel.html', "() => { switchTab('stickers') }", ['Your own chat stickers', 'Your own sheet 2', '0 of 12', 'Sticker sheet 1', 'Tap a sticker: it moves', 'Use the \U0001F3E0 switch']),  # v173: de emoji-vakken zijn weg
]
NL_WOORDEN = ['Vrienden', 'Uitnodigen', 'Geblokkeerd', 'terug', 'Stuur een bericht', 'Chat openen', 'Gastenboek', 'GASTENBOEK', 'dagen', 'geleden', 'Vriendschap',
              'Bellen', 'Annuleer', 'Kies hoe', 'Belt je op', 'Wat wil je doen', 'Blokkeren', 'Deblokkeren', 'Verwijderen', 'Annuleren', 'Sluiten', 'buzzt',
              'Je account', 'Reden', 'Nog geen', 'Spelen', 'Laden', 'Verbinden', 'jouw netwerk',
              'Selecteer', 'chatten', 'versleuteld', 'Bericht', 'bericht', 'Niet verstuurd', 'Geen sleutel', 'Melden', 'Speel samen', 'Akkoord', 'toestemming', 'Kies',
              'Mijn profiel', 'Mijn stijl', 'Opslaan', 'Achtergrond', 'Lettertype', 'Kleur', 'Informatie', 'Weergavenaam', 'tekens over', 'Sterren', 'Sneeuw', 'Vlinders',
              'Blokken', 'Doorzichtigheid', 'Actieve', 'Speel tegen', 'Dieren', 'Natuur', 'Typemachine', 'Standaard', 'Het leven',
              'Mijn gegevens', 'Gegevens ophalen', 'definitief', 'Moderatie', 'Rapporten', 'Behandeld', 'Gemeld door', 'Opheffen', 'Makkelijk', 'Moeilijk',
              'Tegen de computer', 'Wat is Fibro', 'Eerlijk gezegd', 'herstelcode', 'Technisch', 'Huisregel', 'Geen internet']
MAG_ERBIJ = set()
MAG_WEG = {'Taal instellen'}  # v146: uit 'Binnenkort' op Over Fibro (is nu klaar)
# v153: de nieuwe stickerkeuze (alleen te zien in 'chat: stickerkeuze'); de oude emoji-tabbladen zijn weg
MAG_ERBIJ |= {'Vellen van Fibro', 'Eigen', 'Winkel', '+', '\U0001F6CD\uFE0F', '1', '2', '3', '4', '5', '6', 'Stickervellen',
              'Vel 1', 'Vel 2', 'Vel 3', 'Vel 4', 'Vel 5', 'Vel 6', 'Eigen vel 1', 'Eigen vel 2', 'Winkelvak 1', 'Winkelvak 2', 'Winkelvak 3', 'Winkelvak 4',
              'Hier komen je eigen stickers. Je kunt ze binnenkort zelf maken in Profiel.'}
MAG_WEG |= {'\U0001F642', '\u2764\uFE0F', '\U0001F436', '\U0001F431', '\U0001F476', '\U0001F466', '\U0001F467', '\u2B50', '\u2795'}
# v154: het Stickerlab bovenaan Profiel -> Stickers (het oude uploadvak deed niets); in de chat een nieuwe tekst bij Eigen
MAG_ERBIJ |= {'Je eigen chatstickers', 'Maak een sticker van je eigen afbeelding, met een beweging en een geluid. Je stickers staan alleen op dit toestel. Versturen naar vrienden komt binnenkort.',
              '0 van 12', 'Je eigen stickers maak je in Profiel, bij Stickers. Versturen naar vrienden komt binnenkort.'}
MAG_ERBIJ |= {'Nieuwe sticker in eigen vel %d, plek %d' % (v, n) for v in (1, 2) for n in range(1, 13)}
MAG_ERBIJ |= {'JE EIGEN CHATSTICKERS'}; MAG_WEG |= {'EIGEN STICKER UPLOADEN'}  # (koppen staan in hoofdletters)
# v155: je eigen stickers gaan nu mee naar je vrienden (andere uitleg in Profiel en bij Eigen in de chat)
MAG_ERBIJ |= {'Maak een sticker van je eigen afbeelding, met een beweging en een geluid. Je stickers staan op dit toestel. Je vrienden krijgen ze vanzelf zodra jullie allebei online zijn.',
              'Je eigen stickers maak je in Profiel, bij Stickers.'}
MAG_WEG |= {'Maak een sticker van je eigen afbeelding, met een beweging en een geluid. Je stickers staan alleen op dit toestel. Versturen naar vrienden komt binnenkort.',
            'Je eigen stickers maak je in Profiel, bij Stickers. Versturen naar vrienden komt binnenkort.'}
MAG_WEG |= {'Eigen sticker uploaden', 'Upload je eigen sticker', 'PNG, WEBP, SVG, GIF \u2014 max 2MB', '\U0001F3A8',
            'Hier komen je eigen stickers. Je kunt ze binnenkort zelf maken in Profiel.'}
# v157: stickervel 1 onder je eigen stickers, en bij elke sticker een knopje voor Home (stickerwidget.js)
VEL1 = ['Tranen van het lachen', 'Ssst', 'Slaap lekker', 'Kapot', 'Huilen', 'Verliefd', 'Boos', 'Geschrokken', 'Offline', 'Druk', 'Spookje', 'Sluw']
MAG_ERBIJ |= {'STICKERVEL 1', '\U0001F3E0', 'Met het knopje \U0001F3E0 onder een sticker zet je hem op Home (druk daarna op Opslaan).',
              'Tik op een sticker: hij beweegt en maakt geluid. Zet het knopje \U0001F3E0 aan en druk op Opslaan, dan staat hij op Home.'}
MAG_ERBIJ |= {'Speel sticker ' + n for n in VEL1} | {n + ' op Home' for n in VEL1}
# v173: de oude emoji-stickers en de widget 'Sticker board' zijn weg uit Profiel (koppen staan in hoofdletters)
MAG_WEG |= {'ACTIEVE STICKERS', 'Nog geen stickers gekozen', 'NATUUR & PLANTEN', 'SFEER & MAGIE', 'MUZIEK & KUNST', 'DIEREN',
            'Sticker board', 'Collage van stickers'}
MAG_WEG |= {'\U0001F33F', '\U0001F338', '\U0001F33A', '\U0001F33B', '\U0001F340', '\U0001F331', '\U0001F33E', '\U0001F343', '\U0001F334', '\U0001F30A', '\U0001F342', '\U0001F339', '\U0001F337', '\U0001F33C', '\U0001F341', '\u2728', '\U0001F52E', '\U0001F319', '\u2B50', '\U0001F4AB', '\U0001F31F', '\U0001F52F', '\U0001F320', '\U0001F30C', '\U0001FA84', '\U0001F48E', '\U0001F308', '\u26A1', '\U0001F525', '\U0001F300', '\U0001F3B5', '\U0001F3B8', '\U0001F3A8', '\U0001F3AD', '\U0001F3AC', '\U0001F4F7', '\U0001F3AA', '\U0001F3AF', '\U0001F3B2', '\U0001F3B9', '\U0001F941', '\U0001F3BA', '\U0001F3BB', '\U0001F5BC', '\u270F', '\U0001F98B', '\U0001F98A', '\U0001F431', '\U0001F43A', '\U0001F984', '\U0001F409', '\U0001F981', '\U0001F43B', '\U0001F99D', '\U0001F994', '\U0001F427', '\U0001F985', '\U0001F420', '\U0001F42C', '\U0001F98B'}

# v178: het menu in groepjes (twee items van plek gewisseld) en de nieuwe uitleg 'Fibro als app installeren'
MAG_ERBIJ |= {'INSTELLINGEN', 'ACCOUNTINSTELLINGEN', 'MIJN FIBRO', '\U0001F4F2 Fibro als app installeren', '\U0001F310 Taal / Language',
              '\U0001F5D1\uFE0F Account verwijderen', 'iPhone \u00B7 Safari', 'Android \u00B7 Chrome', 'Sluiten'}
MAG_ERBIJ |= {re.sub(r'<[^>]+>', '', x) for x in [
    'Zet Fibro op het beginscherm van je telefoon. Dan opent Fibro als een gewone app: over het hele scherm, met meldingen en een bolletje bij ongelezen berichten.',
    'Open Fibro in <b>Safari</b>.',
    'Tik op de deelknop (vierkantje met pijl omhoog). Bij nieuwere iPhones eerst op <b>\u2022\u2022\u2022</b> naast het adres en dan op <b>Deel</b>.',
    'Kies <b>Zet op beginscherm</b>. Zie je <b>Open als webapp</b>, laat dat dan aan staan.',
    'Tik op <b>Voeg toe</b>.',
    'Open Fibro daarna via het nieuwe icoon. Dat heeft eigen opslag: log daar opnieuw in en herstel je sleutel met Face ID (of je herstelcode).',
    'Op de iPhone krijg je alleen zo meldingen.',
    'Open Fibro in <b>Chrome</b>.',
    'Tik rechtsboven op <b>\u22EE</b> (drie puntjes).',
    'Kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b> en dan <b>Installeren</b>.',
    'Open Fibro daarna via het nieuwe icoon.']}
MAG_WEG |= {'\u23F3 Berichten bewaren', '\U0001F310 Taal / Language', '\U0001F4E6 Mijn gegevens downloaden', '\u2139\uFE0F Over Fibro', '\U0001F5D1\uFE0F Account verwijderen'}

# v179: 'Muziek uploaden' (bij Widgets) is verhuisd naar het tabblad Profiel als 'Profielmuziek'; in het menu een schakelaar
MAG_WEG |= {'MUZIEK UPLOADEN'}
MAG_ERBIJ |= {'PROFIELMUZIEK', 'Dit nummer speelt vanzelf op je Home en als vrienden je profiel bekijken. Je vrienden krijgen het als jullie allebei online zijn.',
              'Upload een muziekbestand', 'MP3, M4A, OGG \u2014 wordt verkleind naar 128kbps', '\U0001F3B5', '\U0001F3B5 Muziek vanzelf afspelen: aan'}
MAG_WEG |= {'Upload een muziekbestand', 'MP3, M4A, OGG \u2014 wordt verkleind naar 128kbps', '\U0001F3B5'}

# v180: twee schakelaars in plaats van een
MAG_ERBIJ |= {'\U0001F3B5 Mijn muziek vanzelf: aan', '\U0001F3B5 Muziek van vrienden vanzelf: aan'}
MAG_WEG |= {'\U0001F3B5 Muziek vanzelf afspelen: aan'}

# v190: het tabblad onderaan heet Stijl met een waskrijtje (was Profiel met een poppetje); Profiel heet nu Mijn stijl;
# verwijzingen naar die pagina mee, en uitnodigen gaat via Vrienden
MAG_WEG |= {'\U0001F464', 'Profiel', 'Mijn profiel', 'Ga naar je profiel en zet widgets aan om ze hier te zien.',
            'Nog geen vrienden. Nodig iemand uit via je profiel!', 'Je eigen stickers maak je in Profiel, bij Stickers.'}
MAG_ERBIJ |= {'\U0001F58D\uFE0F', 'Stijl', 'Mijn stijl', 'Ga naar Stijl en zet widgets aan om ze hier te zien.',
              'Nog geen vrienden. Nodig iemand uit via Vrienden!', 'Je eigen stickers maak je in Stijl, bij Stickers.'}
MAG_WEG |= {'Fibro \u2014 Profiel', 'Fibro \u2013 Mijn profiel', 'Onderdelen van je profiel', 'Fibro v189 \u00B7 20 okt 2026'}  # titel, hoofdtitel, lijst, menu
MAG_ERBIJ |= {'Fibro \u2014 Stijl', 'Fibro \u2013 Mijn stijl', 'Onderdelen van je stijl', 'Fibro v190 \u00B7 21 okt 2026'}
# v191: bovenaan de Chat-lijst alleen 'Chat' (was 'Selecteer een vriend' + 'Kies hieronder met wie je wilt chatten')
MAG_WEG |= {'Selecteer een vriend', 'Kies hieronder met wie je wilt chatten', 'Fibro v190 \u00B7 21 okt 2026'}
MAG_ERBIJ |= {'Chat', 'Fibro v191 \u00B7 21 okt 2026'}
# v192: Neon Raiders in Stijl > Widgets (alleen spelen)
MAG_WEG |= {'Fibro v191 \u00B7 21 okt 2026'}
MAG_ERBIJ |= {'\U0001F680', 'Neon Raiders', 'Speel alleen', 'Fibro v192 \u00B7 21 okt 2026'}
# v193: het hele Neon Raiders (alleen het versienummer verandert op de schermen)
MAG_WEG |= {'Fibro v192 \u00B7 21 okt 2026'}
MAG_ERBIJ |= {'Fibro v193 \u00B7 21 okt 2026'}
# v194: Neon Raiders samen vanuit de chat (alleen het versienummer verandert op de schermen)
MAG_WEG |= {'Fibro v193 \u00B7 21 okt 2026'}
MAG_ERBIJ |= {'Fibro v194 \u00B7 21 okt 2026'}
# v195: het vernieuwde schaken weer in twee talen (alleen het versienummer verandert op de schermen)
MAG_WEG |= {'Fibro v194 \u00B7 21 okt 2026'}
MAG_ERBIJ |= {'Fibro v195 \u00B7 21 okt 2026'}
# v196: bij elk spel in Stijl > Widgets een eigen versienummer (spelversies.js), los van het nummer van Fibro
MAG_WEG |= {'Fibro v195 \u00B7 21 okt 2026'}
MAG_ERBIJ |= {'Fibro v196 \u00B7 21 okt 2026', 'v1', 'v2', 'v3', 'versie 1', 'versie 2', 'versie 3'}  # (label voor schermlezers: Nederlands; Engels 'version N' staat in spelversies.js)
# v197: PR #3 van valentijnpeters (schaken met webcam enz.): het versienummer, Schaken v3 en de knop 'Tegen een vriend'
MAG_WEG |= {'Fibro v196 \u00B7 21 okt 2026', 'v2', 'versie 2'}  # Schaken v2 -> v3, geen spel meer op v2
MAG_ERBIJ |= {'Fibro v197 \u00B7 22 okt 2026', '\u265F Tegen een vriend'}  # spel.html?spel=schaken: knop 'Tegen een vriend'
# v198: webcam-status en tegengehouden geluid (melding van Tijn); op de schermen alleen het versienummer en Schaken v4
MAG_WEG |= {'Fibro v197 \u00B7 22 okt 2026', 'v3', 'versie 3'}
MAG_ERBIJ |= {'Fibro v198 \u00B7 22 okt 2026', 'v4', 'versie 4'}
# v199: in een gesprek geen '\u25CF actief' meer (groen stipje bij de foto als de vriend online is)
MAG_WEG |= {'Fibro v198 \u00B7 22 okt 2026', '\u25CF actief'}
MAG_ERBIJ |= {'Fibro v199 \u00B7 22 okt 2026', '\U0001F7E2 Bram is online'}  # (title bij de foto)
# v200: geen dicht slotje meer bij een vriend; een open slotje is een knop met uitleg (slotuitleg.js)
MAG_WEG |= {'Fibro v199 \u00B7 22 okt 2026', '\U0001F512'}
MAG_ERBIJ |= {'Fibro v200 \u00B7 22 okt 2026', 'Nog geen versleuteling met Lotte \u2014 tik voor uitleg / Nog geen versleuteling met Lotte \u2014 tik voor uitleg'}  # (title / aria-label)
# v201: op Vrienden geen slotje meer (die lijst haalt public_key niet op; het stond er altijd open)
MAG_WEG |= {'Fibro v200 \u00B7 22 okt 2026', '\U0001F513', 'Nog geen versleuteling met Lotte \u2014 tik voor uitleg / Nog geen versleuteling met Lotte \u2014 tik voor uitleg'}
MAG_ERBIJ |= {'Fibro v201 \u00B7 22 okt 2026'}
# v202: spelchat en spelstickers versleuteld, herstelsleutel eerst gecontroleerd (stap 1 van PR #4); op de schermen alleen het versienummer
MAG_WEG |= {'Fibro v201 \u00B7 22 okt 2026'}
MAG_ERBIJ |= {'Fibro v202 \u00B7 23 okt 2026'}

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
            check('NL: niets weg of anders', all(x.strip() in MAG_WEG for x in eraf), [x for x in eraf if x.strip() not in MAG_WEG][:6])
            check('NL: niets erbij', all(x.strip() in MAG_ERBIJ for x in erbij), [x for x in erbij if x.strip() not in MAG_ERBIJ][:6])
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
