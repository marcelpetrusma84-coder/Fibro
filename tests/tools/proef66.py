# proef66: het bolletje op het icoon van de app (v168), met de echte vrienden.html, ongelezen.js en service-worker.js.
# A. 3 ongelezen: navigator.setAppBadge(3), het kastje 'fibro-badge' bewaart 3, de titel begint met (3).
# B. alles gelezen (opnieuw tellen geeft 0): clearAppBadge, het kastje 0, een gewone melding weg, een oproep die nog
#    overgaat (requireInteraction) blijft staan.
# C. pushmeldingen naar de portier (via DevTools, ServiceWorker.deliverPushMessage): bericht +1, buzz +1, gemist +1,
#    'belt je' (oproep) niet; elke push geeft een melding.
# Oude map als controle: geen bolletje en geen kastje (bijna alles MIS).
# xvfb-run -a python3 -I proef66.py <map>   (met een echt (onzichtbaar) scherm: meldingen werken niet headless)
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''))
staat = {'ongelezen': [{'vriend_id': FID, 'aantal': 3}]}
def supa(route):
    u = route.request.url
    if '/rpc/ongelezen_per_vriend' in u: return route.fulfill(status=200, json=staat['ongelezen'])
    if '/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/profiles' in u and 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''):
        return route.fulfill(status=200, json={"id": UID, "username": "Marcel"})
    return route.fulfill(status=200, json=[])
STUB = """(() => { window.__badge = []
  Navigator.prototype.setAppBadge = function (n) { window.__badge.push(n); return Promise.resolve() }
  Navigator.prototype.clearAppBadge = function () { window.__badge.push('weg'); return Promise.resolve() } })()"""
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    ORIGIN = 'http://127.0.0.1:%d' % poort; BASIS = ORIGIN + '/Fibro/'
    br = pw.chromium.launch(headless=False, args=['--no-proxy-server'])  # meldingen werken niet in de kale headless-browser: draaien met xvfb-run
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    ctx.grant_permissions(['notifications'], origin=ORIGIN)
    ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(STUB)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:200]))
    def ev(js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:120]
    p.goto(BASIS + 'manifest.json')
    p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl') }", TOKEN)
    p.goto(BASIS + 'vrienden.html'); p.wait_for_timeout(3000)
    KAST = "async () => { if (!(await caches.has('fibro-badge'))) return null; const r = await (await caches.open('fibro-badge')).match('fibro-badge-teller'); return r ? await r.text() : null }"
    # A
    check('A. 3 ongelezen: setAppBadge(3)', 3 in (ev("window.__badge") or []), ev("window.__badge"))
    check('A. het kastje bewaart 3', ev(KAST) == '3', ev(KAST))
    check('A. de titel begint met (3)', str(ev("document.title")).startswith('(3) '), ev("document.title"))
    # B
    reg = ev("""async () => { const r = await navigator.serviceWorker.register('./service-worker.js?v=95'); await navigator.serviceWorker.ready
      await r.showNotification('Fibro', { body: 'bericht' }); await r.showNotification('Fibro', { body: 'belt je', tag: 'oproep-x', requireInteraction: true })
      return (await r.getNotifications()).length }""")
    check('B. twee meldingen staan er (voorbereiding)', reg == 2, reg)
    staat['ongelezen'] = []
    ev("() => document.dispatchEvent(new Event('visibilitychange'))"); p.wait_for_timeout(1500)
    check('B. alles gelezen: clearAppBadge', (ev("window.__badge") or [None])[-1] == 'weg', ev("window.__badge"))
    check('B. het kastje bewaart 0', ev(KAST) == '0', ev(KAST))
    over = ev("async () => (await (await navigator.serviceWorker.getRegistration()).getNotifications()).map(m => m.body)")
    check('B. de gewone melding is weg, de oproep die overgaat blijft', over == ['belt je'], over)
    check('B. de titel zonder getal', not str(ev("document.title")).startswith('('), ev("document.title"))
    # C
    cdp = ctx.new_cdp_session(p); regs = []
    cdp.on('ServiceWorker.workerRegistrationUpdated', lambda e: regs.extend(e.get('registrations', [])))
    cdp.send('ServiceWorker.enable'); p.wait_for_timeout(800)
    rid = next((r['registrationId'] for r in regs if r.get('scopeURL', '').startswith(BASIS)), None)
    def push(soort):
        n0 = ev("async () => (await (await navigator.serviceWorker.getRegistration()).getNotifications()).length")
        try: cdp.send('ServiceWorker.deliverPushMessage', {'origin': ORIGIN + '/', 'registrationId': rid, 'data': json.dumps({'title': 'Fibro', 'body': soort, 'type': soort, 'url': '/Fibro/chat.html'})})
        except Exception as e: print('   push mislukt:', str(e)[:120])
        p.wait_for_timeout(1200)
        n1 = ev("async () => (await (await navigator.serviceWorker.getRegistration()).getNotifications()).length")
        return ev(KAST), n1 - n0 if isinstance(n0, int) and isinstance(n1, int) else None
    check('C. de portier is er (voorbereiding)', rid is not None, regs[:1])
    a = push('bericht'); check('C. push bericht: het kastje 0 -> 1, en een melding', a == ('1', 1), a)
    a = push('buzz'); check('C. push buzz: 1 -> 2', a[0] == '2', a)
    a = push('oproep'); check("C. push 'belt je': telt niet (blijft 2)", a[0] == '2', a)
    a = push('gemist'); check('C. push gemiste oproep: 2 -> 3', a[0] == '3', a)
    check('geen fouten op de pagina', fouten == [], fouten[:3])
    br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
