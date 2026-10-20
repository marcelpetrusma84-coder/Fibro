# proef84: een rood stipje op je avatar op Home als je op offline staat (v188), echte index.html en profiel.html,
# echte klikken, nep-server die onthoudt wat Profiel en de hartslag (heartbeat.js) schrijven (profiles.toon_online).
#  1. online: geen stipje
#  2. Profiel > Online/Offline (echte klik) = Offline; Home: het rode stipje rechtsonder op je avatar, met uitleg
#     (aria-label/title); tik = naar Profiel
#  3. nieuw toestel (niets op het toestel), de server zegt offline: het stipje komt zodra het profiel binnen is
#  4. de server zegt online, het toestel nog offline: het stipje gaat weg zodra het profiel binnen is
#  5. Profiel weer op Online: Home zonder stipje
#  6. Engels; klein scherm (320 px): het stipje staat op de avatar, niets breder dan het scherm
# Geen paginafouten. Oude map (v187) als controle: geen stipje (bijna alles MIS).
# python3 -I proef84.py <map>     (FOTO=<map> maakt een schermafbeelding)
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
rij = {"id": UID, "username": "Marcel", "avatar_url": "\U0001F98A", "toon_online": True, "online_status": True, "bewaar_dagen": 31}
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u:
        if m in ('PATCH', 'POST'):
            b = json.loads(route.request.post_data or '{}'); b = b[0] if isinstance(b, list) else b
            rij.update({k: v for k, v in b.items() if k != 'id'})
            return route.fulfill(status=200, json=dict(rij) if obj else [dict(rij)])
        return route.fulfill(status=200, json=dict(rij) if obj else [dict(rij)])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
STIP = """() => { const s = document.getElementById('offlineStip'), a = document.getElementById('heroAvatar'); if (!s) return null
  const zichtbaar = !s.hidden && getComputedStyle(s).display !== 'none'
  const r = s.getBoundingClientRect(), b = a.getBoundingClientRect()
  return { zichtbaar, kleur: getComputedStyle(s).backgroundColor, label: s.getAttribute('aria-label'), titel: s.title,
           opAvatar: zichtbaar && r.right <= b.right + 4 && r.bottom <= b.bottom + 4 && r.left >= b.left + b.width / 2 && r.top >= b.top + b.height / 2,
           breed: document.documentElement.scrollWidth <= innerWidth } }"""
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
# het profiel 1,5 s later laten binnenkomen (in de pagina, zodat de proef zelf niet stilstaat)
TRAAG = """(() => { const f = window.fetch; window.fetch = function (u, o) { const s = String(u && u.url || u)
  if (s.includes('/rest/v1/profiles') && (!o || !o.method || o.method === 'GET')) return new Promise(ok => setTimeout(ok, 1500)).then(() => f.call(this, u, o))
  return f.call(this, u, o) } })()"""
def ev(p, js):
    try: return p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server'])
    def nieuw(taal='nl', maat=(390, 844)):
        ctx = br.new_context(service_workers='block', viewport={'width': maat[0], 'height': maat[1]}, locale='nl-NL')
        ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
        p.goto(B + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
        return ctx, p
    def home(p, ms=3000): p.goto(B + 'index.html'); p.wait_for_timeout(ms); return ev(p, STIP)
    def ok(s): return isinstance(s, dict)

    print('1. Online')
    ctx, p = nieuw(); s = home(p)
    check('online: geen stipje', ok(s) and not s['zichtbaar'], s)

    print('2. Profiel > Offline')
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500); p.click('#onlineToggle'); p.wait_for_timeout(800)
    lab = ev(p, "() => document.getElementById('onlineLabel').textContent")
    s = home(p)
    check('Profiel: echte klik = Offline (op de server en op dit toestel)', lab == 'Offline' and rij['toon_online'] is False and ev(p, "() => localStorage.getItem('fibro_ik_offline')") == '1', (lab, rij['toon_online']))
    check('Home: rood stipje rechtsonder op je avatar', ok(s) and s['zichtbaar'] and s['kleur'] == 'rgb(239, 68, 68)' and s['opAvatar'], s)
    check('met uitleg (aria-label en title)', ok(s) and s['label'] == 'Je staat op offline: vrienden zien je niet online. Tik om het te veranderen.' and s['titel'] == s['label'], s)
    if FOTO and ok(s): p.screenshot(path=os.path.join(FOTO, 'offline-stip.png'), clip={'x': 0, 'y': 0, 'width': 390, 'height': 220})
    try: p.click('#offlineStip', timeout=3000); p.wait_for_timeout(1200)
    except Exception as e: print('   klik:', str(e)[:80])
    check('tik op het stipje = naar Profiel', p.url.split('?')[0].endswith('profiel.html'), p.url)
    check('geen paginafouten', not p.fouten, p.fouten[:3])
    ctx.close()

    print('3. Nieuw toestel, de server zegt offline')
    rij['toon_online'] = False
    ctx, p = nieuw(); ctx.add_init_script(TRAAG)
    p.goto(B + 'index.html'); p.wait_for_timeout(400); vroeg = ev(p, STIP); p.wait_for_timeout(4000); laat = ev(p, STIP)
    check('eerst niets bekend: geen stipje; het profiel komt binnen: stipje', ok(vroeg) and not vroeg['zichtbaar'] and ok(laat) and laat['zichtbaar'], (vroeg and vroeg['zichtbaar'], laat))
    ctx.close()

    print('4. De server zegt online, het toestel nog offline')
    rij['toon_online'] = True
    ctx, p = nieuw(); p.evaluate("() => localStorage.setItem('fibro_ik_offline', '1')"); ctx.add_init_script(TRAAG)
    p.goto(B + 'index.html'); p.wait_for_timeout(400); vroeg = ev(p, STIP); p.wait_for_timeout(4000); laat = ev(p, STIP)
    check('eerst het toestel (stipje), dan de server (weg)', ok(vroeg) and vroeg['zichtbaar'] and ok(laat) and not laat['zichtbaar'], (vroeg and vroeg['zichtbaar'], laat and laat['zichtbaar']))
    ctx.close()

    print('5. Weer online')
    rij['toon_online'] = False
    ctx, p = nieuw(); p.evaluate("() => localStorage.setItem('fibro_ik_offline', '1')")
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500); p.click('#onlineToggle'); p.wait_for_timeout(800)
    s = home(p)
    check('Profiel weer Online: Home zonder stipje', rij['toon_online'] is True and ok(s) and not s['zichtbaar'], (rij['toon_online'], s))
    ctx.close()

    print('6. Engels en klein scherm')
    rij['toon_online'] = False
    ctx, p = nieuw('en', (320, 568)); s = home(p)
    check("Engels: 'You're set to offline...'", ok(s) and s['zichtbaar'] and s['label'] == "You're set to offline: friends don't see you online. Tap to change it.", s)
    check('320 px: op de avatar, niets breder dan het scherm', ok(s) and s['opAvatar'] and s['breed'], s)
    ctx.close()
    br.close()
srv.kill(); shutil.rmtree(www, ignore_errors=True)
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
