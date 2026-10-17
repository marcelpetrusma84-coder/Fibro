# proef73: Ghost Tag alleen spelen net als samen spelen (v177), echte spel.html?spel=pacman op een nagebootste iPhone
# (iPhone-UA, scherpte 3, aanraken), echte tik op Start. Geen grens van 30 beeldjes meer (in Chromium hier ±60), volle
# scherpte (het doek heeft 2 beeldpunten per css-pixel, net als in de chat), de teller in de titel werkt nog, en de
# spookjes lopen precies even snel als het hoort (5,2 vakjes per seconde, de jager 6,8), ook op een 6x tragere
# processor. Voor die meting zet de proef in een kopie van ecto-ui.js een regel die de spelers laat zien (alleen
# in de proef). Geen fouten. Oude map als controle: 30 beeldjes en halve scherpte (4 van 6).
# python3 -I proef73.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
www = tempfile.mkdtemp(); APP = www + '/Fibro'
shutil.copytree(MAP, APP, ignore=shutil.ignore_patterns('tests', '.git', 'stickers', 'geluiden'))
s = open(APP + '/ecto-ui.js', encoding='utf-8').read()
a = "    spelers = [maakSpeler(0), maakSpeler(1)]\n"
assert s.count(a) == 1
open(APP + '/ecto-ui.js', 'w', encoding='utf-8').write(s.replace(a, a + "    window.__sp = spelers; window.__jager = () => jager // alleen in proef73\n"))
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
METEN = """() => new Promise(ok => {
  const sp = window.__sp, uit = { weg: 0, verwacht: 0, beeldjes: 0, tijd: 0 }; let v = sp.map(s => [s.x, s.y]), t0 = performance.now(), tv = t0, b0 = window.fibroBeeldjes || 0
  const iv = setInterval(() => {
    const nu = performance.now(), d = (nu - tv) / 1000; tv = nu
    const s = sp[1], [x, y] = v[1], stap = Math.abs(s.x - x) + Math.abs(s.y - y)
    if (!s.uit && stap < 3) { uit.weg += stap; uit.verwacht += d * (window.__jager() === 1 ? 6.8 : 5.2) * (sp[0].uit ? 2 : 1) }
    v = sp.map(s => [s.x, s.y])
    if (nu - t0 > 6000) { clearInterval(iv); uit.tijd = (nu - t0) / 1000; uit.beeldjes = (window.fibroBeeldjes || 0) - b0; ok(uit) }
  }, 50) })"""
def ronde(cpu):
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, user_agent=IPHONE)
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150]))
        p.goto(B + 'manifest.json'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
        p.goto(B + 'spel.html?spel=pacman'); p.wait_for_timeout(1500)
        k = p.query_selector('#startKnop') or p.query_selector('.niveau-btn')
        if k: k.tap()
        p.wait_for_timeout(1500)
        try: p.locator('button:has-text("▶")').first.tap(timeout=3000)
        except Exception as e: print('   start:', str(e)[:80])
        if cpu > 1: cdp = ctx.new_cdp_session(p); cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
        p.wait_for_timeout(3600)
        r = p.evaluate(METEN)
        doek = p.evaluate("() => { const c = document.querySelector('canvas'); return c ? [c.width, c.getBoundingClientRect().width] : null }")
        titel = p.evaluate("() => (document.getElementById('spelTitelBar') || {}).textContent || ''")
        br.close()
        return r, doek, titel, fouten
r, doek, titel, fouten = ronde(1)
fps = r['beeldjes'] / r['tijd']
print('   normaal: %.0f beeldjes/s, doek %s, %.1f van %.1f vakjes, titel %r' % (fps, doek, r['weg'], r['verwacht'], titel[-20:]))
check('geen grens van 30 beeldjes meer (hier minstens 50)', fps >= 50, round(fps))
check('volle scherpte: 2 beeldpunten per css-pixel, net als in de chat', doek and doek[0] >= 1.9 * doek[1], doek)
check('de teller in de titel werkt nog', 'fps' in titel, titel[-24:])
check('de spookjes lopen precies even snel als het hoort (98-102%)', r['verwacht'] > 10 and 0.98 <= r['weg'] / r['verwacht'] <= 1.02, round(100 * r['weg'] / max(0.01, r['verwacht'])))
r2, _, _, fouten2 = ronde(6)
check('ook op een 6x tragere processor even snel (98-102%)', r2['verwacht'] > 10 and 0.98 <= r2['weg'] / r2['verwacht'] <= 1.02, (round(100 * r2['weg'] / max(0.01, r2['verwacht'])), round(r2['beeldjes'] / r2['tijd'])))
check('geen fouten', not fouten and not fouten2, fouten + fouten2)
srv.terminate(); shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
