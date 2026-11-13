# proef296 (13 nov 2026): op Home blijft de balk met Stekky, beta, uitloggen en het menu bovenin staan tijdens het scrollen.
#  A. na flink scrollen staat de balk nog bovenin beeld, en het menu is nog aan te tikken
#  B. staat de sleutelwaarschuwing bovenin, dan staat de balk er net onder (niet erachter)
#  C. geen paginafouten
# python3 -I proef296.py <map> [schermafdruk.png]
import sys, os, time, json, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
FOTO = sys.argv[2] if len(sys.argv) > 2 else None
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def supa(route):
    u = route.request.url; m = route.request.method
    if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": UID, "aud": "authenticated", "user_metadata": {}})
    if '/rest/v1/profiles' in u and m == 'GET':
        rij = {"id": UID, "username": "Marcel", "public_key": "pk", "is_moderator": False}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=rij)
        return route.fulfill(status=200, json=[rij])
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    return route.fulfill(status=200, json=[])

www = tempfile.mkdtemp(prefix='proef296_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
BALK = "() => { const r = document.querySelector('.top-bar').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] }"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True)
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); localStorage.setItem('fibro_privkey_" + UID + "', 'x'); localStorage.setItem('fibro_profiel_" + UID + "', JSON.stringify({ naam: 'Marcel' })) }", TOKEN)
        pg.goto(BASIS + 'index.html'); pg.wait_for_selector('.top-bar', timeout=15000); time.sleep(1.5)
        # genoeg inhoud om te scrollen (het echte Home is langer met widgets)
        pg.evaluate("() => { const d = document.createElement('div'); d.id = 'proefVulling'; d.style.height = '3000px'; document.querySelector('#content-laag').appendChild(d) }")
        voor = pg.evaluate(BALK)
        pg.evaluate("() => window.scrollTo(0, 1500)"); time.sleep(0.4)
        na = pg.evaluate(BALK)
        check(pg.evaluate("() => window.scrollY") > 1000, 'A: de pagina is gescrold (%d px)' % pg.evaluate("() => window.scrollY"))
        check(0 <= na[0] <= 30 and na[1] > 30, 'A: de balk staat nog bovenin beeld (voor %s, na scrollen %s)' % (voor, na))
        raak = pg.evaluate("() => { const r = document.getElementById('menuBtn').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && e.closest('#menuBtn') ? true : (e ? (e.id || e.className || e.tagName) + ' ' + JSON.stringify(r) : 'niets') }")
        check(raak is True, 'A: het menu is na scrollen nog aan te tikken (niets ligt erover) %s' % raak)
        if FOTO: pg.screenshot(path=FOTO)
        # B: de sleutelwaarschuwing (geen sleutel op dit toestel)
        pg.evaluate("() => localStorage.removeItem('fibro_privkey_" + UID + "')")
        pg.reload(); pg.wait_for_selector('#sleutel-balk', state='visible', timeout=15000); time.sleep(0.5)
        pg.evaluate("() => { const d = document.createElement('div'); d.style.height = '3000px'; document.querySelector('#content-laag').appendChild(d); window.scrollTo(0, 1500) }"); time.sleep(0.4)
        sb = pg.evaluate("() => { const r = document.getElementById('sleutel-balk').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] }")
        tb = pg.evaluate(BALK)
        check(sb[0] <= 2 and tb[0] >= sb[1] - 2 and tb[0] <= sb[1] + 30, 'B: de balk staat net onder de sleutelwaarschuwing (waarschuwing %s, balk %s)' % (sb, tb))
        check(not fouten, 'C: geen paginafouten ' + ' | '.join(fouten))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT: %s' % (len(fout), '; '.join(fout))))
sys.exit(1 if fout else 0)
