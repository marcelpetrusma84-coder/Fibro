# proef100: onderaan het profiel van een vriend geen 'Vriendschap beeindigen' meer (v205). Echte vriend-profiel.html en
# vrienden.html met een nep-Supabase, NL en EN:
#  A. vriend-profiel: geen knop #ontvriend-btn, geen tekst 'Vriendschap beeindigen' / 'End friendship', geen window.ontvriend;
#     de naam en de knop naar de chat staan er wel
#  B. Vrienden: lang drukken op een vriend geeft nog steeds 'Verwijderen uit vriendenlijst' (en Blokkeren)
#  C. geen paginafouten, geen ontbrekende vertaling
# Oude map (v204) als controle: A MIS.
# python3 -I proef100.py <map>
import sys, os, time, json, socket, tempfile, threading, http.server, functools
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''), flush=True)
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', poort), functools.partial(H, directory=www)); threading.Thread(target=srv.serve_forever, daemon=True).start()
B = 'http://127.0.0.1:%d/Fibro/' % poort
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
VR = {"id": BRAM, "username": "Bram", "display_name": None, "bio": "Hoi", "mood": "", "avatar_url": "\U0001F438", "updated_at": "2026-10-20T10:00:00Z",
      "online_status": "online", "laatst_gezien": NU, "avatar_versie": "", "wallpaper_versie": "", "avatar_data": None, "wallpaper_data": None, "widgets": None}
IK = {"id": MARCEL, "username": "Marcel", "achtergrond_kleur": "#1a0a2e"}
def supa(route):
    u = route.request.url
    if '/rest/v1/profiles' in u:
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        rij = VR if BRAM in u else IK
        return route.fulfill(status=200, json=rij if obj else [rij])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"friend_id": BRAM, "user_id": MARCEL, "status": "accepted", "profiles": VR}])
    if '/rpc/mijn_geblokkeerden' in u: return route.fulfill(status=200, json=[])
    return route.fulfill(status=200, json=[] if route.request.method == 'GET' else {})
fouten, taalfout = [], []
T = {'nl': dict(weg='Vriendschap beeindigen', menu='Verwijderen uit vriendenlijst', blok='Blokkeren'),
     'en': dict(weg='End friendship', menu='Remove from friends list', blok='Block')}
with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-proxy-server'])
    for taal in ('nl', 'en'):
        t = T[taal]
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:160]))
        pg.on('console', lambda m: taalfout.append(m.text) if 'nog geen vertaling' in m.text else None)
        pg.on('dialog', lambda d: d.dismiss())
        pg.goto(B + 'manifest.json')
        pg.evaluate("([t, taal]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', taal) }",
                    [json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": MARCEL}}), taal])
        pg.goto(B + 'vriend-profiel.html?id=' + BRAM); pg.wait_for_timeout(3000)
        a = pg.evaluate("""w => ({ knop: !!document.getElementById('ontvriend-btn'), tekst: document.body.innerText.includes(w), fn: typeof window.ontvriend,
            naam: (document.getElementById('profielNaam') || {}).textContent, chat: !!document.querySelector('[onclick*="naarChat"]') })""", t['weg'])
        check('%s A vriend-profiel: geen "%s", geen ontvriend(); naam en chatknop wel' % (taal, t['weg']),
              not a['knop'] and not a['tekst'] and a['fn'] == 'undefined' and a['naam'] == 'Bram' and a['chat'], a)
        pg.goto(B + 'vrienden.html')
        ok = False; menu = ''
        try:
            pg.wait_for_selector('#vriendenLijst .friend-row', timeout=10000)
            r = pg.locator('#vriendenLijst .friend-row').first.bounding_box()
            pg.mouse.move(r['x'] + 60, r['y'] + r['height'] / 2); pg.mouse.down(); pg.wait_for_timeout(900); pg.mouse.up()
            pg.wait_for_selector('#fibroVriendActie', timeout=3000); menu = pg.inner_text('#fibroVriendActie'); ok = True
        except Exception as e: menu = 'FOUT: ' + str(e)[:80]
        check('%s B Vrienden, lang drukken: "%s" en "%s"' % (taal, t['menu'], t['blok']), ok and t['menu'] in menu and t['blok'] in menu, menu.replace('\n', ' | ')[:160])
        ctx.close()
    br.close()
srv.shutdown()
check('C geen paginafouten, geen ontbrekende vertaling', not fouten and not taalfout, (fouten[:3], taalfout[:3]))
goed = sum(uitslag)
print('UITSLAG proef100: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
