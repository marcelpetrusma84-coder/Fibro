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
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/friendships' in u and m == 'GET':
        return route.fulfill(status=200, json=[{"friend_id": k, "profiles": v} for k, v in PROF.items()])
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
]
NL_WOORDEN = ['Vrienden', 'Uitnodigen', 'Geblokkeerd', 'terug', 'Stuur een bericht', 'Chat openen', 'Gastenboek', 'GASTENBOEK', 'dagen', 'geleden', 'Vriendschap',
              'Bellen', 'Annuleer', 'Kies hoe', 'Belt je op', 'Wat wil je doen', 'Blokkeren', 'Deblokkeren', 'Verwijderen', 'Annuleren', 'Sluiten', 'buzzt',
              'Je account', 'Reden', 'Nog geen', 'Spelen', 'Laden', 'Verbinden', 'jouw netwerk']
MAG_ERBIJ = set()

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
            check('NL: niets weg of anders', not eraf, eraf[:6])
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
