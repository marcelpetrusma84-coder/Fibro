# proef86: het tabblad onderaan heet Stijl met een waskrijtje (v190; was Profiel met een poppetje), echte pagina's,
# in het Nederlands en het Engels (Style), op een nagebootste telefoon met echte tikken:
#  1. Home, Vrienden, Chat, Profiel (nu Stijl) en het profiel van een vriend: het laatste tabblad onderaan is
#     waskrijtje + Stijl / Style, nergens meer het poppetje of Profiel/Profile in de onderbalk
#  2. op Home en Vrienden: tik op Stijl opent profiel.html; op die pagina is Stijl het actieve tabblad
#  3. de pagina zelf: titel 'Fibro — Stijl' / 'Fibro — Style', kop 'Mijn stijl' / 'My style', verborgen hoofdtitel,
#     de lijst met onderdelen heet 'Onderdelen van je stijl'; het eerste onderdeel blijft 'Profiel' (avatar, mood)
#  4. Home zonder widgets: 'Ga naar Stijl en zet widgets aan ...' / 'Go to Style ...'
#  5. Chat zonder vrienden: 'Nodig iemand uit via Vrienden!' (de uitnodiging zit op Vrienden, niet in je profiel)
#  6. Chat met een vriend, stickers, eigen vel 1 (leeg): 'Je eigen stickers maak je in Stijl, bij Stickers.'
#  7. het profiel van een vriend heet nog steeds Profiel / Profile (dat is zijn profiel)
# Geen paginafouten. Oude map (v189) als controle: bijna alles MIS.
# python3 -I proef86.py <map>
import sys, os, time, json, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
KRIJT = '\U0001F58D️'; POP = '\U0001F464'
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
VRIENDEN = {'aan': True}
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        if FID in u or 'in.' in u:
            v = {"id": FID, "username": "Bram", "avatar_url": "\U0001F438", "online_status": False, "public_key": None}; return route.fulfill(status=200, json=v if obj else [v])
        e = {"id": UID, "username": "Marcel"}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u:
        rij = {"user_id": UID, "friend_id": FID, "status": "accepted"}
        if 'profiles' in u:  # Vrienden: de vriendschap met het profiel erbij (profiles!friendships_friend_id_fkey(...))
            rij["profiles"] = {"id": FID, "username": "Bram", "avatar_url": "\U0001F438", "online_status": False, "laatst_gezien": None, "updated_at": None}
        return route.fulfill(status=200, json=[rij] if VRIENDEN['aan'] else [])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
ONDER = """() => [...document.querySelectorAll('.bottom-nav .nav-item')].map(n => ({ t: n.textContent.replace(/\\s+/g, ''), actief: n.classList.contains('active') }))"""
def ev(p, js, arg=None):
    try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server'])
        for taal in ['nl', 'en']:
            NL = taal == 'nl'
            STIJL = 'Stijl' if NL else 'Style'
            print('== ' + ('Nederlands' if NL else 'Engels'))
            ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='nl-NL' if NL else 'en-GB')
            ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
            p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
            p.goto(B + 'manifest.json')
            p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
            VRIENDEN['aan'] = True
            for pg in ['index.html', 'vrienden.html', 'chat.html', 'profiel.html', 'vriend-profiel.html?id=' + FID]:
                p.goto(B + pg); p.wait_for_timeout(2500)
                o = ev(p, ONDER)
                laatste = o[-1] if isinstance(o, list) and o else {}
                alles = ' '.join(x['t'] for x in o) if isinstance(o, list) else str(o)
                check(pg.split('?')[0] + ': laatste tabblad is ' + KRIJT + ' ' + STIJL, laatste.get('t') == KRIJT + STIJL, o)
                check(pg.split('?')[0] + ': geen poppetje of Profiel/Profile meer onderaan', POP not in alles and 'Profiel' not in alles and 'Profile' not in alles, alles)
                if pg == 'profiel.html':
                    check('profiel.html: Stijl is het actieve tabblad (en alleen dat)', laatste.get('actief') and sum(1 for x in o if x['actief']) == 1, o)
                    k = ev(p, """() => ({ titel: document.title, kop: document.querySelector('.top-title').textContent.trim(), h1: document.querySelector('main h1').textContent.trim(),
                        lijst: document.querySelector('.main-tabs').getAttribute('aria-label'), eerste: document.querySelector('.main-tab').textContent.trim() })""")
                    if NL:
                        verwacht = {'titel': 'Fibro — Stijl', 'kop': 'Mijn stijl', 'h1': 'Fibro – Mijn stijl', 'lijst': 'Onderdelen van je stijl', 'eerste': POP + ' Profiel'}
                    else:
                        verwacht = {'titel': 'Fibro — Style', 'kop': 'My style', 'h1': 'Fibro – My style', 'lijst': 'Parts of your style', 'eerste': POP + ' Profile'}
                    for sl in ['titel', 'kop', 'h1', 'lijst', 'eerste']:
                        check('profiel.html: ' + sl + ' = ' + verwacht[sl], isinstance(k, dict) and k.get(sl) == verwacht[sl], k.get(sl) if isinstance(k, dict) else k)
                if pg.startswith('vriend-profiel'):
                    t = ev(p, "() => document.title")
                    check('vriend-profiel: titel blijft ' + ('Fibro — Profiel' if NL else 'Fibro — Profile'), t == ('Fibro — Profiel' if NL else 'Fibro — Profile'), t)
                if pg == 'index.html':
                    t = ev(p, "() => (document.querySelector('.leeg-staat-sub') || {}).textContent || ''")
                    check('Home zonder widgets: verwijzing naar ' + STIJL, t == ('Ga naar Stijl en zet widgets aan om ze hier te zien.' if NL else 'Go to Style and switch widgets on to see them here.'), t)
                if pg in ('index.html', 'vrienden.html'):
                    p.locator('.bottom-nav .nav-item').last.tap(); p.wait_for_timeout(1500)
                    check(pg + ': tik op ' + STIJL + ' opent profiel.html', p.url.split('?')[0].endswith('/profiel.html'), p.url)
            # chat zonder vrienden
            VRIENDEN['aan'] = False
            p.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('fibro_chatvrienden')).forEach(k => localStorage.removeItem(k))")
            p.goto(B + 'chat.html'); p.wait_for_timeout(2500)
            t = ev(p, "() => (document.querySelector('.geen-vrienden') || {}).textContent || ''")
            check('Chat zonder vrienden: uitnodigen via Vrienden/Friends', t == ('Nog geen vrienden. Nodig iemand uit via Vrienden!' if NL else 'No friends yet. Invite someone via Friends!'), t)
            # chat met een vriend: stickers, eigen vel 1
            VRIENDEN['aan'] = True
            p.goto(B + 'chat.html?vriend=' + FID); p.wait_for_timeout(3000)
            p.locator('button[onclick="toggleStickers()"]').tap(); p.wait_for_timeout(800)
            p.locator('button.sk-vak[data-vak="e1"]').tap(); p.wait_for_timeout(500)
            t = ev(p, "() => (document.querySelector('#stickerGrid .sk-leeg') || {}).textContent || ''")
            check('Chat, stickers, eigen vel leeg: maken in ' + STIJL, t == ('Je eigen stickers maak je in Stijl, bij Stickers.' if NL else 'You make your own stickers in Style, under Stickers.'), t)
            check('geen paginafouten (' + taal + ')', not fouten, fouten[:3])
            ctx.close()
        br.close()
finally:
    srv.terminate()
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
