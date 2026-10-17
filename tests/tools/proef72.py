# proef72: Ghost Tag met lichter geluid (v176), echte spel.html?spel=pacman tegen de computer.
# A. Android/computer: geen <audio>-spelers meer, één AudioContext die na de echte tik op Start loopt; aftellen en
#    stippen klinken als Web Audio-bronnen; de pagina is per geluidje bijna niets kwijt; 🔇 = geen geluid; het spel
#    sluiten (zoals in de chat: het spel gaat uit de pagina) sluit de AudioContext.
# B. iPhone (iPhone-UA): geen AudioContext, wel <audio> zoals altijd, maar 14 spelers in plaats van 25; aftellen en
#    stippen klinken.
# Daarbij: geen fouten. Oude map als controle: overal 25 <audio>-spelers (A bijna alles MIS).
# python3 -I proef72.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
TELLER = """(() => {
  const w = window.__g = { audio: 0, play: 0, playMs: 0, ctx: 0, bron: 0, bronMs: 0, ctxen: [] }
  const OudAudio = window.Audio
  window.Audio = function (...a) { w.audio++; return new OudAudio(...a) }; window.Audio.prototype = OudAudio.prototype
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () { const t = performance.now(); try { return speel.apply(this, arguments) } finally { w.play++; w.playMs += performance.now() - t } }
  const tijd = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', { get() { return tijd.get.call(this) }, set(v) { const t = performance.now(); tijd.set.call(this, v); w.playMs += performance.now() - t } })
  const OudAC = window.AudioContext
  window.AudioContext = function (...a) { w.ctx++; const c = new OudAC(...a); w.ctxen.push(c); return c }; window.AudioContext.prototype = OudAC.prototype
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function () { const t = performance.now(); try { return start.apply(this, arguments) } finally { if (this.buffer && this.buffer.length > 1) w.bron++; w.bronMs += performance.now() - t } }
})()"""
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
def ronde(ua=None, stil=False, sluiten=False):
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
        opties = dict(service_workers='block', viewport={'width': 390, 'height': 844})
        if ua: opties.update(user_agent=ua)
        ctx = br.new_context(**opties)
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[])); ctx.add_init_script(TELLER)
        p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150]))
        p.goto(B + 'manifest.json'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
        p.goto(B + 'spel.html?spel=pacman'); p.wait_for_timeout(1500)
        k = p.query_selector('.niveau-btn[data-niveau="normaal"]') or p.query_selector('#startKnop') or p.query_selector('.niveau-btn')
        if k: k.click()
        p.wait_for_timeout(1500)
        voor = p.evaluate("() => ({ audio: window.__g.audio, ctx: window.__g.ctx, staat: window.__g.ctxen.map(c => c.state) })")
        if stil:
            try: p.click('.kGeluid', timeout=3000)
            except Exception as e: print('   🔊:', str(e)[:80])
        try: p.locator('button:has-text("▶")').first.click(timeout=3000)  # echte tik op Start
        except Exception as e: print('   start:', str(e)[:80])
        p.wait_for_timeout(600)
        na_tik = p.evaluate("() => window.__g.ctxen.map(c => c.state)")
        pijlen = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']
        p.wait_for_timeout(3200)
        for i in range(16): p.keyboard.press(pijlen[i % 4]); p.wait_for_timeout(500)
        g = p.evaluate("() => { const g = window.__g; return { audio: g.audio, play: g.play, playMs: g.playMs, ctx: g.ctx, bron: g.bron, bronMs: g.bronMs, staat: g.ctxen.map(c => c.state) } }")
        dicht = None
        if sluiten:  # zoals in de chat: het spel gaat uit de pagina; de lus ziet dat en ruimt op
            p.evaluate("() => { document.getElementById('spelInhoud').innerHTML = '' }")
            p.wait_for_timeout(1200)
            dicht = p.evaluate("() => window.__g.ctxen.map(c => c.state)")
        br.close()
        return dict(voor=voor, na_tik=na_tik, g=g, dicht=dicht, fouten=fouten)
print('A. Android/computer')
r = ronde(sluiten=True); g = r['g']
print('   ', {k: (round(v, 1) if isinstance(v, float) else v) for k, v in g.items()})
check('A. geen <audio>-spelers voor het spel (oud: 25)', r['voor']['audio'] == 0 and g['audio'] == 0, (r['voor'], g['audio']))
check('A. één AudioContext; na de echte tik op Start loopt hij', g['ctx'] == 1 and r['na_tik'] == ['running'], (g['ctx'], r['na_tik']))
check('A. aftellen en stippen klinken (Web Audio-bronnen, minstens 6)', g['bron'] >= 6 and g['play'] == 0, (g['bron'], g['play']))
check('A. per geluidje bijna niets kwijt (gemiddeld < 0,5 ms)', g['bron'] and g['bronMs'] / g['bron'] < 0.5, round(g['bronMs'] / max(1, g['bron']), 3))
check('A. het spel sluiten (uit de pagina, zoals in de chat) sluit de AudioContext', r['dicht'] == ['closed'], r['dicht'])
check('A. geen fouten', not r['fouten'], r['fouten'])
r = ronde(stil=True); g = r['g']
check('A. met \U0001F507 klinkt er niets', g['bron'] == 0 and g['play'] == 0 and g['ctx'] <= 1, (g['bron'], g['play']))
print('B. iPhone')
r = ronde(ua=IPHONE); g = r['g']
print('   ', {k: (round(v, 1) if isinstance(v, float) else v) for k, v in g.items()})
check('B. iPhone: geen AudioContext (Web Audio is daar stil op de stil-schakelaar)', g['ctx'] == 0, g['ctx'])
check('B. iPhone: <audio> met 14 spelers in plaats van 25', g['audio'] == 14, g['audio'])
check('B. iPhone: aftellen en stippen klinken (<audio>)', g['play'] >= 14 + 6, g['play'])
check('B. geen fouten', not r['fouten'], r['fouten'])
srv.terminate(); shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
