# proef83: 'Buzz schudt en trilt' aan/uit in het menu (v187), echte index.html en chat.html, echte klikken.
# Een buzz komt binnen zoals in het echt: een nieuw bericht 'buzz:' via nagebootste Realtime (zoals proef53).
#  A. menu > Instellingen: '⚡ Buzz schudt en trilt: aan' (schakelaar, staat standaard aan)
#  B. aan: buzz op Home = buzzgeluid, trillen, schuddend scherm en de melding '⚡ Bram buzzt je!'
#  C. echte klik = 'uit'; bewaard (localStorage fibro_buzz_schud = '0') en in het kastje voor de portier
#  D. uit: buzz op Home = alleen de melding (geen geluid, niet trillen, niet schudden)
#  E. uit, in de chat met Bram: geen buzzgeluid, niet trillen, niet schudden, geen grote bliksem; wel de regel
#     '📳 Bram stuurt een buzz!' en de melding
#  F. pushmelding (echte portier, CDP ServiceWorker.deliverPushMessage): uit = trilt als een gewoon bericht, gewoon icoon;
#     aan = het lange buzz-trillen en het buzz-icoon
#  G. in het Engels: '⚡ Buzz shakes and vibrates: off'
# Geen paginafouten. Oude map (v186) als controle: geen schakelaar, buzz schudt altijd (bijna alles MIS).
# python3 -I proef83.py <map>
import sys, os, re, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
from playwright._impl import _network as _pwn
def _sluitPagina(self, event):  # Playwright 1.56: 'code' ontbreekt soms als de pagina de verbinding sluit
    if self._on_page_close: self._on_page_close(event.get('code'), event.get('reason'))
_pwn.WebSocketRoute._channel_close_page = _sluitPagina
MAP = os.path.abspath(sys.argv[1])
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nepslot
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NEP = nepslot.Nep(MAP, UID, FID)
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        if FID in u or 'in.' in u:
            v = {"id": FID, "username": "Bram", "avatar_url": "\U0001F438", "public_key": NEP.vriend.pub, "online_status": True}; return route.fulfill(status=200, json=v if obj else [v])
        e = {"id": UID, "username": "Marcel"}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
# ── nep-Realtime (zoals proef53) ──
rt = {'conns': [], 'pgid': 0}
class Conn:
    def __init__(s, ws):
        s.ws = ws; s.dicht = False; s.topics = {}
        ws.on_message(s.bericht); ws.on_close(lambda *a: setattr(s, 'dicht', True))
    def stuur(s, arr):
        if s.dicht: return
        try: s.ws.send(json.dumps(arr))
        except Exception: s.dicht = True
    def bericht(s, msg):
        if not isinstance(msg, str): return
        try: join_ref, ref, topic, event, payload = json.loads(msg)
        except Exception: return
        if event == 'heartbeat': return s.stuur([None, ref, 'phoenix', 'phx_reply', {"status": "ok", "response": {}}])
        if event == 'phx_join':
            pg = []
            for f in ((payload or {}).get('config') or {}).get('postgres_changes') or []:
                rt['pgid'] += 1; pg.append((rt['pgid'], f))
            s.topics[topic] = {'join_ref': join_ref, 'pg': pg}
            return s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": {"postgres_changes": [dict(f, id=i) for i, f in pg]}}])
        if event == 'phx_leave':
            s.topics.pop(topic, None); return s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": {}}])
        if ref: s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": {}}])
def bezorg(rec, soort='INSERT', table='messages'):
    n = 0
    for c in [c for c in rt['conns'] if not c.dicht]:
        for topic, info in list(c.topics.items()):
            ids = []
            for i, f in info['pg']:
                if f.get('table') != table or f.get('event') not in ('*', soort): continue
                flt = f.get('filter')
                if flt:
                    kol, waarde = flt.split('=eq.')
                    if rec.get(kol) != waarde: continue
                ids.append(i)
            if ids:
                c.stuur([info['join_ref'], None, topic, 'postgres_changes', {"ids": ids, "data": {"type": soort, "schema": "public", "table": table,
                         "commit_timestamp": rec['created_at'], "record": rec, "columns": [], "errors": None}}]); n += 1
    return n
teller = [0]
def buzz():
    teller[0] += 1
    nu = time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + '.000Z'
    return bezorg({"id": "mbuzz%d" % teller[0], "sender_id": FID, "receiver_id": UID, "content": "buzz:", "created_at": nu, "antwoord_op": None, "expires_at": None})
# Telt wat een buzz doet: een zaagtand-oscillator (het buzzgeluid), trillen, en of het scherm schudt
WAAKT = """(() => {
  window.__zaag = 0; window.__tril = 0; window.__schud = 0
  const AC = window.AudioContext || window.webkitAudioContext
  if (AC) { const maak = AC.prototype.createOscillator
    AC.prototype.createOscillator = function () { const o = maak.apply(this, arguments); setTimeout(() => { if (o.type === 'sawtooth') window.__zaag++ }, 0); return o } }
  try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: function () { window.__tril++; return true } }) } catch (e) {}
  new MutationObserver(() => { const c = document.body && document.body.className || ''; if (/fibro-schudt|buzz-ontvangen/.test(c)) window.__schud++ })
    .observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] })
})()"""
STAND = """() => ({ zaag: window.__zaag, tril: window.__tril, schud: window.__schud,
  melding: [...document.querySelectorAll('#fibro-meldingen > div')].map(d => d.textContent),
  bliksem: !!(document.getElementById('buzzOverlay') && document.getElementById('buzzOverlay').classList.contains('show')),
  regels: [...document.querySelectorAll('#messages .sys-msg')].map(d => d.textContent).filter(t => t.includes('buzz')) })"""
SCHAKELAARS = "() => [...document.querySelectorAll('#fibroMenu [role=menuitemcheckbox]')].map(b => [b.textContent, b.getAttribute('aria-checked')])"
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
def ev(p, js, arg=None):
    try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL')
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda ws: rt['conns'].append(Conn(ws))); ctx.add_init_script(WAAKT)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'manifest.json')
    p.evaluate("([t, u, k]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); localStorage.setItem('fibro_privkey_' + u, k) }", [TOKEN, UID, NEP.ik.priv])
    def home():
        rt['conns'].clear(); p.goto(B + 'index.html'); p.wait_for_timeout(3500)
        p.mouse.click(200, 600); p.wait_for_timeout(300)  # een tik: geluid mag (zoals op de telefoon)
    def menu():
        p.click('#menuBtn'); p.wait_for_timeout(300); return ev(p, SCHAKELAARS)

    print('A. Het menu')
    home(); s = menu()
    buzzS = [x for x in s if 'Buzz' in x[0]] if isinstance(s, list) else []
    check("menu > Instellingen: '⚡ Buzz schudt en trilt: aan'", buzzS == [['⚡ Buzz schudt en trilt: aan', 'true']] and ev(p, "() => !!document.querySelector('#fibroMenu [aria-labelledby=menuKopInstellingen] [role=menuitemcheckbox]:last-child')"), s)
    p.keyboard.press('Escape'); p.wait_for_timeout(200)

    print('B. Aan: buzz op Home')
    n = buzz(); p.wait_for_timeout(1500); b = ev(p, STAND)
    check('aan: buzzgeluid, trillen, schudden en de melding', n > 0 and isinstance(b, dict) and b['zaag'] >= 1 and b['tril'] >= 1 and b['schud'] >= 1 and any('Bram buzzt je' in m for m in b['melding']), (n, b))

    print('C. Uitzetten')
    home(); menu()
    try: p.click('#fibroMenu [role=menuitemcheckbox]:has-text("Buzz")', timeout=3000); p.wait_for_timeout(500)
    except Exception as e: print('   klik:', str(e)[:80])
    s = ev(p, SCHAKELAARS)
    kast = ev(p, "async () => { try { const k = await caches.open('fibro-badge'); const r = await k.match('fibro-buzz-rustig'); return r ? await r.text() : null } catch (e) { return 'fout' } }")
    check("echte klik: '⚡ Buzz schudt en trilt: uit', bewaard en in het kastje", isinstance(s, list) and ['⚡ Buzz schudt en trilt: uit', 'false'] in s
          and ev(p, "() => localStorage.getItem('fibro_buzz_schud')") == '0' and kast == '1', (s, kast))

    print('D. Uit: buzz op Home')
    home(); n = buzz(); p.wait_for_timeout(1500); d = ev(p, STAND)
    check('uit: alleen de melding (geen geluid, niet trillen, niet schudden)', n > 0 and isinstance(d, dict) and d['zaag'] == 0 and d['tril'] == 0 and d['schud'] == 0 and any('Bram buzzt je' in m for m in d['melding']), (n, d))

    print('E. Uit: buzz in de chat met Bram')
    rt['conns'].clear(); p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
    p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(2500); p.mouse.click(200, 400); p.wait_for_timeout(300)
    n = buzz(); p.wait_for_timeout(300); e1 = ev(p, STAND); p.wait_for_timeout(1200); e = ev(p, STAND)
    check("uit, in de chat: geen geluid, trillen, schudden of bliksem; wel de regel '📳 Bram stuurt een buzz!' en de melding",
          n > 0 and isinstance(e, dict) and e['zaag'] == 0 and e['tril'] == 0 and e['schud'] == 0 and not e1['bliksem'] and any('Bram stuurt een buzz' in r for r in e['regels']) and any('Bram buzzt je' in m for m in e['melding']), (n, e1, e))
    p.evaluate("() => localStorage.setItem('fibro_buzz_schud', '1')")
    rt['conns'].clear(); p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
    p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(2500); p.mouse.click(200, 400); p.wait_for_timeout(300)
    n = buzz(); p.wait_for_timeout(300); a1 = ev(p, STAND); p.wait_for_timeout(1200); a = ev(p, STAND)
    check('weer aan, in de chat: buzzgeluid, trillen, schudden en de bliksem (zoals altijd)', n > 0 and isinstance(a, dict) and a['zaag'] >= 1 and a['tril'] >= 1 and a['schud'] >= 1 and a1['bliksem'], (n, a1, a))
    check('geen paginafouten', not fouten, fouten[:3])
    ctx.close()

    print('F. Pushmelding (echte portier)')
    br2 = pw.chromium.launch(channel='chromium', args=['--no-proxy-server'])  # de volledige Chromium: de kale headless-versie kan geen meldingen
    ctx = br2.new_context(viewport={'width': 390, 'height': 844}, locale='nl-NL'); ctx.grant_permissions(['notifications'], origin=B.rstrip('/').rsplit('/', 1)[0])
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda ws: None)
    p = ctx.new_page(); p.goto(B + 'manifest.json')
    p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
    p.goto(B + 'index.html'); p.wait_for_timeout(3000)
    reg = ev(p, "async () => { const r = await navigator.serviceWorker.ready; return r.scope }")
    cdp = ctx.new_cdp_session(p); regs = {}
    # v188: eerst luisteren, dan aanzetten (de aanmeldingen komen meteen bij het aanzetten; anders soms gemist)
    cdp.on('ServiceWorker.workerRegistrationUpdated', lambda e: [regs.__setitem__(r['scopeURL'], r['registrationId']) for r in e['registrations']])
    cdp.send('ServiceWorker.enable')
    for i in range(25):  # v188: tot 5 s wachten op de aanmelding (onder drukte duurde 0,8 s soms te kort)
        p.wait_for_timeout(200)
        if regs: break
    rid = regs.get(reg) or (list(regs.values())[0] if regs else None)
    def push(rustig):
        p.evaluate("async r => { localStorage.setItem('fibro_buzz_schud', r ? '0' : '1'); const k = await caches.open('fibro-badge'); await k.put('fibro-buzz-rustig', new Response(r ? '1' : '0'))"
                   "; const reg = await navigator.serviceWorker.ready; for (const n of await reg.getNotifications()) n.close() }", rustig)
        cdp.send('ServiceWorker.deliverPushMessage', {'origin': B.rsplit('/Fibro/', 1)[0] + '/', 'registrationId': rid, 'data': json.dumps({"title": "⚡ Buzz!", "body": "Bram buzzt je!", "type": "buzz"})})
        p.wait_for_timeout(1500)
        return ev(p, "async () => { const reg = await navigator.serviceWorker.ready; return (await reg.getNotifications()).map(n => ({ titel: n.title, icoon: n.icon, tril: Array.from(n.vibrate || []) })) }")
    if rid:
        r1 = push(True); r2 = push(False)
        check('push, uit: trilt als een gewoon bericht, gewoon icoon', isinstance(r1, list) and len(r1) == 1 and r1[0]['tril'] == [200, 100, 200] and r1[0]['icoon'].endswith('icon-192.png'), r1)
        check('push, aan: het lange buzz-trillen en het buzz-icoon', isinstance(r2, list) and len(r2) == 1 and r2[0]['tril'] == [300, 80, 300, 80, 300, 80, 500] and r2[0]['icoon'].endswith('icon-buzz.png'), r2)
    else:
        check('push: portier gevonden', False, (reg, regs))
    ctx.close(); br2.close()

    print('G. In het Engels')
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL')
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda ws: None)
    p = ctx.new_page(); p.goto(B + 'manifest.json')
    p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'en'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); localStorage.setItem('fibro_buzz_schud', '0') }", TOKEN)
    p.goto(B + 'index.html'); p.wait_for_timeout(3000); p.click('#menuBtn'); p.wait_for_timeout(300)
    s = ev(p, SCHAKELAARS)
    check("Engels: '⚡ Buzz shakes and vibrates: off'", isinstance(s, list) and ['⚡ Buzz shakes and vibrates: off', 'false'] in s, s)
    br.close()
srv.kill(); shutil.rmtree(www, ignore_errors=True)
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
