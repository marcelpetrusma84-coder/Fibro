# proef232 (3 nov 2026): het buzzgeluid op de iPhone (buzzgeluid.js). Marcel: het scherm schudde wel, maar het geluid
# kwam soms pas na een tik. Chrome met de regel van de iPhone nagebootst: een speler mag alleen tijdens een tik spelen,
# of als hij al eens tijdens een tik speelde.  A: eerder getikt -> latere buzz klinkt meteen (twee keer), het geluid is
# 1,1 s zoemen.  B: nog nooit getikt -> eerst geblokkeerd, bij de eerste tik alsnog.   python3 -I proef232.py <map>
import sys, os, time, socket, subprocess
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/' % poort
PAGINA = "<!doctype html><meta charset=utf-8><body style='height:600px'><button id=b style='width:200px;height:100px'>tik</button><script type=module>import { speelBuzz, buzzSamples } from './buzzgeluid.js?v=1'; window.speelBuzz = speelBuzz; window.buzzSamples = buzzSamples</script>"
open(os.path.join(MAP, '__buzzproef.html'), 'w').write(PAGINA)
SPEELT = "() => [...document.querySelectorAll('audio'), ...(window.__spelers||[])].length"
uit = []
def check(n, ok, info=''): uit.append(bool(ok)); print(('OK   ' if ok else 'MIS  ') + n + ('  | ' + str(info) if info != '' else ''), flush=True)
VOLG = """(() => { const P = HTMLMediaElement.prototype.play; window.__speelt = []; const gezegend = new WeakSet()
  for (const t of ['pointerdown', 'touchend', 'click']) window.addEventListener(t, () => { window.__tikTot = Date.now() + 1000 }, true)
  // de regel van de iPhone: alleen spelen tijdens een tik, of als deze speler al eens tijdens een tik speelde
  HTMLMediaElement.prototype.play = function () {
    const el = this, tik = Date.now() < (window.__tikTot || 0)
    if (!tik && !gezegend.has(el)) { window.__speelt.push({ src: String(el.src).slice(0, 5), ok: false, fout: 'NotAllowedError' }); return Promise.reject(new DOMException('iPhone-regel', 'NotAllowedError')) }
    if (tik) gezegend.add(el)
    const p = P.apply(this, arguments); p.then(() => window.__speelt.push({ src: String(el.src).slice(0, 5), ok: true, duur: el.duration }), e => window.__speelt.push({ ok: false, fout: e.name })); return p } })()"""
try:
  with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=user-gesture-required'])
    # A. eerst getikt, later (zonder tik) een buzz -> klinkt meteen
    ctx = br.new_context(); ctx.add_init_script(VOLG); pg = ctx.new_page(); pg.goto(B + '__buzzproef.html'); pg.wait_for_timeout(500)
    pg.click('#b'); pg.wait_for_timeout(800)
    pg.evaluate("window.__speelt.length = 0")
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(3000)
    pg.evaluate("window.speelBuzz()"); pg.wait_for_timeout(600)
    s = pg.evaluate("window.__speelt")
    check('A eerder getikt: buzz klinkt meteen, zonder nieuwe tik', s and s[-1]['ok'] and s[-1]['src'] == 'blob:', s)
    pg.wait_for_timeout(1500)
    pg.evaluate("window.__speelt.length = 0; window.speelBuzz()"); pg.wait_for_timeout(600)
    s = pg.evaluate("window.__speelt")
    check('A2 een tweede buzz later ook', s and s[-1]['ok'], s)
    d = pg.evaluate("(() => { const s = window.buzzSamples(); let m = 0; for (const x of s) m = Math.max(m, Math.abs(x)); return [s.length, m] })()")
    check('A3 het geluid zelf: 1,1 s zoemen', d[0] == 24255 and 0.2 < d[1] <= 0.3, d)
    ctx.close()
    # B. nog nooit getikt: buzz mag niet -> bij de eerste tik (binnen 4 s) alsnog
    ctx = br.new_context(); ctx.add_init_script(VOLG); pg = ctx.new_page(); pg.goto(B + '__buzzproef.html'); pg.wait_for_timeout(500)
    
    pg.wait_for_timeout(1500)
    
    pg.evaluate("window.speelBuzz()"); pg.wait_for_timeout(500)
    s1 = pg.evaluate("window.__speelt.slice()")
    pg.click('#b'); pg.wait_for_timeout(800)
    s2 = pg.evaluate("window.__speelt.slice()")
    check('B nooit getikt: eerst geblokkeerd, bij de eerste tik alsnog de buzz', s1 and not s1[-1]['ok'] and any(x['ok'] and x['src'] == 'blob:' for x in s2[len(s1):]), (s1, s2))
    ctx.close(); br.close()
finally:
  srv.terminate(); os.remove(os.path.join(MAP, '__buzzproef.html'))
print('UITSLAG: %d van %d goed' % (sum(uit), len(uit)))
sys.exit(0 if uit and all(uit) else 1)
