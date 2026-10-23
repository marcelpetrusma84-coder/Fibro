# proef95: in het gesprek geen '● actief' meer, maar een groen stipje bij de foto bovenin als de vriend online is (v199).
# Echte chat.html, nagebootste telefoon met echte tikken, Nederlands en Engels. Twee vrienden: Bram online (online_status
# en laatst_gezien net), Lotte offline. Dezelfde regel als de lijst (online_status + laatst_gezien < 5 min).
#  1. de lijst: Bram met stipje, Lotte zonder (zoals altijd)
#  2. tik op Bram: groen stipje rechtsonder op zijn foto bovenin, titel '🟢 Bram is online', nergens 'actief'/'active'
#  3. Bram gaat offline (volgende keer ophalen): het stipje verdwijnt terwijl het gesprek open is
#  4. terug: geen stipje bij het chat-icoon; tik op Lotte (offline): geen stipje
#  5. zelf op offline (fibro_ik_offline): geen stipje, ook niet bij Bram (dezelfde regel als de lijst)
#  6. een foto als avatar (avatar_data): het stipje staat er nog bovenop
#  7. geen paginafouten
# Oude map (v198) als controle: 2, 3 en 6 MIS ('● actief' en geen stipje).
# python3 -I proef95.py <map>
import sys, os, time, json, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'b1a00000-0000-4000-8000-000000000002'; LOTTE = 'c1a00000-0000-4000-8000-000000000003'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''), flush=True)
staat = {'bram_online': True, 'foto': False, 'ik_offline': False}
def iso(sec): return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - sec))
def prof(i):
    if i == BRAM: return {"id": BRAM, "username": "Bram", "avatar_url": "\U0001F438", "online_status": staat['bram_online'], "laatst_gezien": iso(20) if staat['bram_online'] else iso(3600),
                          "public_key": None, "updated_at": iso(9000), "avatar_versie": "f1" if staat['foto'] else None, "avatar_data": FOTO if staat['foto'] else None}
    return {"id": LOTTE, "username": "Lotte", "avatar_url": "\U0001F98A", "online_status": False, "laatst_gezien": iso(90000), "public_key": None, "updated_at": iso(9000), "avatar_versie": None, "avatar_data": None}
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        if 'in.' in u: return route.fulfill(status=200, json=[prof(BRAM), prof(LOTTE)])
        for i in (BRAM, LOTTE):
            if i in u: return route.fulfill(status=200, json=prof(i) if obj else [prof(i)])
        e = {"id": UID, "username": "Marcel", "toon_online": not staat['ik_offline']}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/profiles' in u and m == 'PATCH':   # heartbeat.js: online-ping, antwoord met de eigen keuze toon_online
        e = {"toon_online": not staat['ik_offline']}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": BRAM, "status": "accepted"}, {"user_id": LOTTE, "friend_id": UID, "status": "accepted"}])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
STIP = """() => { const av = document.getElementById('chatAv'), d = av && av.querySelector('.online-dot')
  const zicht = !!d && getComputedStyle(d).display !== 'none'
  const a = av.getBoundingClientRect(), r = d ? d.getBoundingClientRect() : null
  return { zicht, titel: av.getAttribute('title') || '', rechtsonder: !!r && r.right >= a.right - 4 && r.bottom >= a.bottom - 4 && r.width >= 9,
           status: document.getElementById('chatStatus').textContent, foto: av.dataset.foto === '1',
           actief: /\\bactief\\b|\\bactive\\b/.test(document.querySelector('.top-bar').innerText) } }"""
LIJST = """() => [...document.querySelectorAll('#vriendenLijst .vriend-item')].map(el => [el.innerText.includes('Bram') ? 'Bram' : el.innerText.includes('Lotte') ? 'Lotte' : '?', el.classList.contains('is-online')])"""
def ev(p, js):
    try: return p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
fouten = []
def tik_vriend(p, naam):
    try: p.locator('#vriendenLijst .vriend-item', has_text=naam).first.tap(timeout=4000)
    except Exception: pass
    p.wait_for_timeout(1200)
def terug(p):
    try: p.locator('.top-bar .back-btn').tap(timeout=4000)
    except Exception: pass
    p.wait_for_timeout(800)
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server'])
        for taal in ['nl', 'en']:
            print('== ' + taal, flush=True)
            staat.update(bram_online=True, foto=False, ik_offline=False)
            ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
            ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
            p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
            p.goto(B + 'manifest.json')
            p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
            p.goto(B + 'chat.html'); p.wait_for_timeout(2500)
            l = ev(p, LIJST)
            check('%s 1 lijst: Bram met stipje, Lotte zonder' % taal, isinstance(l, list) and ['Bram', True] in l and ['Lotte', False] in l, l)
            tik_vriend(p, 'Bram'); s = ev(p, STIP)
            check('%s 2 Bram (online): groen stipje rechtsonder op zijn foto, titel "🟢 Bram is online", geen "actief"' % taal,
                  isinstance(s, dict) and s['zicht'] and s['rechtsonder'] and s['titel'] == '🟢 Bram is online' and s['status'] == '' and not s['actief'], s)
            staat['bram_online'] = False
            p.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); p.wait_for_timeout(1200)
            s = ev(p, STIP)
            check('%s 3 Bram gaat offline: stipje weg terwijl het gesprek open is' % taal, isinstance(s, dict) and not s['zicht'] and s['titel'] == '', s)
            staat['bram_online'] = True
            p.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); p.wait_for_timeout(1200)
            terug(p); s1 = ev(p, STIP)
            tik_vriend(p, 'Lotte'); s2 = ev(p, STIP)
            check('%s 4 terug: geen stipje bij het chat-icoon; Lotte (offline): geen stipje' % taal, isinstance(s1, dict) and not s1['zicht'] and isinstance(s2, dict) and not s2['zicht'] and not s2['actief'], (s1, s2))
            terug(p)
            staat['ik_offline'] = True   # je eigen profiel op offline (heartbeat.js zet dan fibro_ik_offline)
            p.evaluate("localStorage.setItem('fibro_ik_offline', '1')")
            p.goto(B + 'chat.html'); p.wait_for_timeout(2500); tik_vriend(p, 'Bram'); s = ev(p, STIP)
            check('%s 5 zelf op offline: geen stipje, ook niet bij Bram' % taal, isinstance(s, dict) and not s['zicht'], s)
            staat['ik_offline'] = False; p.evaluate("localStorage.removeItem('fibro_ik_offline')")
            staat['foto'] = True
            p.goto(B + 'chat.html'); p.wait_for_timeout(2500); tik_vriend(p, 'Bram'); p.wait_for_timeout(1500); s = ev(p, STIP)
            check('%s 6 met een foto als avatar: stipje staat erbovenop' % taal, isinstance(s, dict) and s['foto'] and s['zicht'] and s['rechtsonder'], s)
            ctx.close()
        br.close()
finally:
    srv.terminate()
check('7 geen paginafouten', not fouten, fouten[:3])
print('UITSLAG proef95: %d/%d %s' % (sum(uitslag), len(uitslag), 'GOED' if all(uitslag) else 'FOUT'))
