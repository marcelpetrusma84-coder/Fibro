# proef327: de chatlijst: online bovenaan, daaronder wie het laatst een bericht wisselde (chatvolgorde.js, 23 nov 2026, Marcel).
# Echte chat.html, nagebootste telefoon met echte tikken, nep-Supabase. Vijf vrienden; de server geeft ze in een
# volgorde die NIET de goede is (Sanne, Daan, Lotte, Eva, Bram), zodat alleen de nieuwe regel de goede volgorde kan geven.
#   Eva en Bram zijn online (Eva schreef 20 min geleden, Bram 3 uur geleden); Lotte schreef 10 min geleden,
#   Sanne 1 uur geleden, met Daan is nog nooit iets gewisseld.
#  A. na het laden: Eva, Bram (online, nieuwste eerst), Lotte, Sanne, Daan
#  B. Sanne stuurt een nieuw bericht terwijl je de lijst ziet: ze gaat boven Lotte, maar onder de online vrienden
#  C. Bram stuurt een bericht: hij gaat boven Eva (nieuwste eerst, ook bij online)
#  D. jij stuurt echt een bericht aan Daan (versleuteld, via de chat): Daan staat daarna boven Sanne en Lotte
#  E. na opnieuw laden zonder dat de server de berichten kan geven (geen internet): dezelfde volgorde (onthouden)
#  F. Eva gaat offline: ze zakt naar de offline groep, op haar laatste bericht; Bram blijft bovenaan
#  G. een vriend met een eigen naam, een vriend zonder berichten en een lege lijst geven geen fouten; geen paginafouten
# Oude map (van voor deze wijziging) als controle: A, B, C, D, E, E2, F en F2 MIS (online eerst, maar de rest in laadvolgorde); G en H goed.
# python3 -I proef327.py <map>
import sys, os, time, json, socket, subprocess, tempfile, urllib.parse
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
NAMEN = {'sanne': 'Sanne', 'daan': 'Daan', 'lotte': 'Lotte', 'eva': 'Eva', 'bram': 'Bram'}   # de volgorde waarin de server ze geeft
ID = {k: '%s1a00000-0000-4000-8000-0000000000%02d' % (k[0], i + 2) for i, k in enumerate(NAMEN)}
VAN_ID = {v: k for k, v in ID.items()}
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:260] if info != '' else ''), flush=True)
def iso(sec): return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - sec))
staat = {'online': {'eva', 'bram'}, 'berichten_ok': True, 'pubkey': None, 'posts': []}
# (afzender, ontvanger, seconden geleden): met Daan is nog nooit iets gewisseld
OUD = [('lotte', 'ik', 600), ('ik', 'eva', 1200), ('sanne', 'ik', 3600), ('ik', 'bram', 10800)]
def prof(k):
    on = k in staat['online']
    return {"id": ID[k], "username": NAMEN[k], "avatar_url": "\U0001F438", "online_status": on, "laatst_gezien": iso(20) if on else iso(90000),
            "public_key": staat['pubkey'], "updated_at": iso(9000), "avatar_versie": None, "avatar_data": None}
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        if 'in.' in u: return route.fulfill(status=200, json=[prof(k) for k in NAMEN])   # volgorde van de server: Sanne, Daan, Lotte, Eva, Bram
        for k in NAMEN:
            if ID[k] in u: return route.fulfill(status=200, json=prof(k) if obj else [prof(k)])
        e = {"id": UID, "username": "Marcel", "toon_online": True}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/profiles' in u and m == 'PATCH':
        e = {"toon_online": True}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": ID[k], "status": "accepted"} for k in NAMEN])
    if '/rest/v1/messages' in u and m == 'POST':
        staat['posts'].append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=201, json={"id": "mn%d" % len(staat['posts'])})
    if '/rest/v1/messages' in u and m == 'GET':
        if 'select=sender_id,receiver_id,created_at' in urllib.parse.unquote(u):   # de lijst vraagt alleen afzender, ontvanger en tijd
            if not staat['berichten_ok']: return route.fulfill(status=500, json={"message": "geen internet"})
            return route.fulfill(status=200, json=[{"sender_id": UID if a == 'ik' else ID[a], "receiver_id": UID if b == 'ik' else ID[b], "created_at": iso(s)} for a, b, s in OUD])
        return route.fulfill(status=200, json=[])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
LIJST = """() => [...document.querySelectorAll('#vriendenLijst .vriend-item')].map(el => ({ 'Daan': 'daan', 'Sanne': 'sanne', 'Lotte': 'lotte', 'Bram': 'bram', 'Eva': 'eva' })[(el.querySelector('.vriend-naam') || {}).textContent] || '?')"""
ONLINE = """() => [...document.querySelectorAll('#vriendenLijst .vriend-item.is-online .vriend-naam')].map(e => e.textContent)"""
SLEUTELS = """async () => {
  const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  const maak = async () => { const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    return { priv: b64(await crypto.subtle.exportKey('pkcs8', k.privateKey)), pub: b64(await crypto.subtle.exportKey('spki', k.publicKey)) } }
  return [await maak(), await maak()] }"""
def ev(p, js, arg=None):
    try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
def wacht_op_lijst(p, n=5):
    try: p.wait_for_function("n => document.querySelectorAll('#vriendenLijst .vriend-item').length === n", arg=n, timeout=12000)
    except Exception: pass
    p.wait_for_timeout(1800)
def nieuw_bericht_van(p, k):   # ongelezen.js geeft dit seintje door als er een bericht van een vriend binnenkomt
    p.evaluate("v => document.dispatchEvent(new CustomEvent('fibro-nieuw-bericht', { detail: { van: v } }))", ID[k]); p.wait_for_timeout(600)
fouten = []
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server'])
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
        p.goto(B + 'manifest.json')
        ik, vriend = p.evaluate(SLEUTELS); staat['pubkey'] = vriend['pub']
        p.evaluate("([t, k, u]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); localStorage.setItem('fibro_privkey_' + u, k) }", [TOKEN, ik['priv'], UID])
        p.goto(B + 'chat.html'); wacht_op_lijst(p)
        l = ev(p, LIJST)
        check('A  na het laden: Eva, Bram (online), dan Lotte, Sanne, Daan', l == ['eva', 'bram', 'lotte', 'sanne', 'daan'], l)
        check('A2 alleen Eva en Bram staan online', sorted(ev(p, ONLINE) or []) == ['Bram', 'Eva'], ev(p, ONLINE))

        nieuw_bericht_van(p, 'sanne'); l = ev(p, LIJST)
        check('B  Sanne stuurt een bericht: boven Lotte, onder de online vrienden', l == ['eva', 'bram', 'sanne', 'lotte', 'daan'], l)
        nieuw_bericht_van(p, 'bram'); l = ev(p, LIJST)
        check('C  Bram stuurt een bericht: boven Eva (nieuwste eerst, ook bij online)', l == ['bram', 'eva', 'sanne', 'lotte', 'daan'], l)

        # D: echt een bericht sturen aan Daan (versleuteld, met een echte sleutel)
        p.locator('#vriendenLijst .vriend-item', has_text='Daan').first.tap(timeout=4000); p.wait_for_timeout(1500)
        p.fill('#msgInput', 'hoi Daan'); p.locator('#sendBtn').tap(timeout=4000); p.wait_for_timeout(1500)
        p.locator('.top-bar .back-btn').tap(timeout=4000); p.wait_for_timeout(800)
        l = ev(p, LIJST)
        check('D  een bericht aan Daan: hij staat boven Sanne en Lotte (en het bericht ging echt naar de server)',
              l == ['bram', 'eva', 'daan', 'sanne', 'lotte'] and len(staat['posts']) == 1 and staat['posts'][0].get('receiver_id') == ID['daan'], (l, len(staat['posts'])))

        # E: opnieuw laden, de server kan de berichten niet geven: de volgorde van de vorige keer
        staat['berichten_ok'] = False
        p.goto(B + 'chat.html'); wacht_op_lijst(p); l = ev(p, LIJST)
        check('E  opnieuw laden zonder berichten van de server: dezelfde volgorde (onthouden op dit toestel)', l == ['bram', 'eva', 'daan', 'sanne', 'lotte'], l)
        opgeslagen = ev(p, "() => localStorage.getItem('fibro_chatlaatste_' + '%s')" % UID) or ''
        check('E2 alleen wie en wanneer is onthouden, nooit wat er in een bericht stond', 'hoi Daan' not in opgeslagen and ID['daan'] in opgeslagen, opgeslagen[:160])
        staat['berichten_ok'] = True

        # F: Eva gaat offline: naar de offline groep, op haar laatste bericht (20 min geleden: onder Lotte niet, want Lotte 10 min)
        staat['online'] = {'bram'}
        p.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); p.wait_for_timeout(1800)
        l = ev(p, LIJST)
        check('F  Eva gaat offline: Bram blijft bovenaan, Eva zakt naar de rest (op haar laatste bericht)', l == ['bram', 'daan', 'sanne', 'lotte', 'eva'], l)
        staat['online'] = {'eva', 'bram'}
        p.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); p.wait_for_timeout(1800)
        l = ev(p, LIJST)
        check('F2 Eva weer online: weer bovenaan, onder Bram (zijn bericht is nieuwer)', l == ['bram', 'eva', 'daan', 'sanne', 'lotte'], l)
        ctx.close()

        # G: een nieuw toestel zonder onthouden tijden en de server zonder berichten: de laadvolgorde met online eerst, geen fouten
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(str(e)[:150]))
        p.goto(B + 'manifest.json')
        p.evaluate("([t, u]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, UID])
        staat['berichten_ok'] = False
        p.goto(B + 'chat.html'); wacht_op_lijst(p); l = ev(p, LIJST)
        check('G  nieuw toestel en geen berichten van de server: online eerst, de rest zoals de server ze gaf', l == ['eva', 'bram', 'sanne', 'daan', 'lotte'], l)
        ctx.close(); br.close()
finally:
    srv.terminate()
check('H  geen paginafouten', not fouten, fouten[:3])
print('UITSLAG proef327: %d/%d %s' % (sum(uitslag), len(uitslag), 'GOED' if all(uitslag) else 'FOUT'))
