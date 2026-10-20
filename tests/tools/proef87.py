# proef87: bovenaan de Chat-lijst staat alleen 'Chat' (v191; was 'Selecteer een vriend' met 'Kies hieronder met wie je
# wilt chatten'), echte chat.html in het Nederlands en het Engels, op een nagebootste telefoon met echte tikken:
#  1. de lijst: bovenaan 'Chat' als titel (sierletter, schuin, 18 px, zoals 'Vrienden' op de pagina Vrienden), geen tweede
#     regel eronder; de oude zinnen staan nergens meer op de pagina; 'Met wie wil je chatten?' en de vriend staan er nog
#  2. tik op de vriend: bovenaan zijn naam in de gewone letter (14 px, niet schuin) en '● actief' eronder
#  3. tik op '← terug': weer 'Chat' als titel, geen tweede regel
#  4. chat.html?vriend=<id> (rechtstreeks een gesprek, zoals na een pushmelding): naam + '● actief'; terug: 'Chat'
# Geen paginafouten. Oude map (v190) als controle: bijna alles MIS.
# python3 -I proef87.py <map>
import sys, os, time, json, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
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
        return route.fulfill(status=200, json=[rij])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
KOP = """() => { const n = document.getElementById('chatNaam'), s = document.getElementById('chatStatus'), cn = getComputedStyle(n)
  return { naam: n.textContent.trim(), status: s.textContent.trim(), statusZichtbaar: s.getBoundingClientRect().height > 0 && getComputedStyle(s).display !== 'none',
           maat: cn.fontSize, schuin: cn.fontStyle, letter: cn.fontFamily, tekst: document.body.innerText } }"""
VR = """() => { const t = document.querySelector('.top-title'); if (!t) return null; const c = getComputedStyle(t); return { maat: c.fontSize, schuin: c.fontStyle, letter: c.fontFamily, kleur: c.color } }"""
def ev(p, js):
    try: return p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
OUDE_NL = ['Selecteer een vriend', 'Kies hieronder met wie je wilt chatten']
OUDE_EN = ['Select a friend', 'Choose who you want to chat with below']
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server'])
        for taal in ['nl', 'en']:
            NL = taal == 'nl'
            print('== ' + ('Nederlands' if NL else 'Engels'))
            ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='nl-NL' if NL else 'en-GB')
            ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
            p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
            p.goto(B + 'manifest.json')
            p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
            p.goto(B + 'vrienden.html'); p.wait_for_timeout(2000)
            vr = ev(p, VR)
            def titel(k, wat):
                check(wat + ': bovenaan Chat', isinstance(k, dict) and k['naam'] == 'Chat', k.get('naam') if isinstance(k, dict) else k)
                check(wat + ': geen tweede regel', isinstance(k, dict) and k['status'] == '' and not k['statusZichtbaar'], (k.get('status'), k.get('statusZichtbaar')) if isinstance(k, dict) else k)
                check(wat + ': als titel, zoals Vrienden (zelfde letter, maat, schuin)', isinstance(k, dict) and isinstance(vr, dict) and k['maat'] == vr['maat'] == '18px' and k['schuin'] == vr['schuin'] == 'italic' and k['letter'] == vr['letter'],
                      ({x: k.get(x) for x in ('maat', 'schuin', 'letter')} if isinstance(k, dict) else k, vr))
                oude = [z for z in (OUDE_NL + OUDE_EN) if isinstance(k, dict) and z in k['tekst']]
                check(wat + ': de oude zinnen staan nergens meer', isinstance(k, dict) and not oude, oude)
            # 1. de lijst
            p.goto(B + 'chat.html'); p.wait_for_timeout(2500)
            k = ev(p, KOP); titel(k, 'lijst')
            t = k['tekst'] if isinstance(k, dict) else ''
            check('lijst: kop en vriend staan er nog', ('Met wie wil je chatten?' if NL else 'Who do you want to chat with?') in t and 'Bram' in t, t[:200])
            # 2. tik op de vriend
            p.locator('.vriend-item').first.tap(); p.wait_for_timeout(1500)
            k = ev(p, KOP)
            check('gesprek: naam + actief', isinstance(k, dict) and k['naam'] == 'Bram' and k['status'] == ('● actief' if NL else '● active') and k['statusZichtbaar'], (k.get('naam'), k.get('status')) if isinstance(k, dict) else k)
            check('gesprek: naam in de gewone letter (14 px, niet schuin)', isinstance(k, dict) and k['maat'] == '14px' and k['schuin'] == 'normal', (k.get('maat'), k.get('schuin')) if isinstance(k, dict) else k)
            # 3. terug
            p.locator('.back-btn').tap(); p.wait_for_timeout(800)
            k = ev(p, KOP); titel(k, 'terug')
            # 4. rechtstreeks naar een gesprek
            p.goto(B + 'chat.html?vriend=' + FID); p.wait_for_timeout(3000)
            k = ev(p, KOP)
            check('rechtstreeks: naam + actief, gewone letter', isinstance(k, dict) and k['naam'] == 'Bram' and k['statusZichtbaar'] and k['maat'] == '14px', (k.get('naam'), k.get('status'), k.get('maat')) if isinstance(k, dict) else k)
            p.locator('.back-btn').tap(); p.wait_for_timeout(800)
            k = ev(p, KOP); titel(k, 'rechtstreeks, terug')
            check('geen paginafouten (' + taal + ')', not fouten, fouten[:3])
            ctx.close()
        br.close()
finally:
    srv.terminate()
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
