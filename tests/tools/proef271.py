# proef271: v271, verzoek van Marcel: speel je een spel tegen de computer terwijl je profielmuziek aanstaat, dan gaat de
# muziek uit; sluit je het spel, dan gaat hij verder. Echte profielmuziek.js + titelscherm.js in Chromium (Home-situatie).
#  A. de profielmuziek speelt
#  B. tik op een spel (openSpelMetTitel): de muziek pauzeert meteen (ook tijdens het titelscherm)
#  C. door het titelscherm, het spel staat open (venster): nog steeds stil, ook als de pagina even weg en terug is
#  D. spel dicht (terugknop): de muziek gaat weer verder
#  E. titelscherm weggetikt met Escape is ook 'spelen'; maar: zelf gepauzeerd voor het spel = na het spel nog steeds uit
#  G. ook de quiz-widget: tijdens de quiz stil, na het sluiten weer verder
#  F. geen paginafouten
# python3 -I proef271.py <map>
import sys, os, subprocess, time, socket, base64, struct, math
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
uitslag, fouten = [], []
def check(naam, ok, info=''):
    uitslag.append(bool(ok)); print(('OK  ' if ok else 'MIS ') + naam + ('' if ok else '  ' + str(info)[:300]), flush=True)
# een kort toontje als wav (2 s)
sr = 8000; n = sr * 2
data = b''.join(struct.pack('<h', int(3000 * math.sin(2 * math.pi * 440 * i / sr))) for i in range(n))
wav = b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, sr, sr * 2, 2, 16) + b'data' + struct.pack('<I', len(data)) + data
WAV = 'data:audio/wav;base64,' + base64.b64encode(wav).decode()
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
B = 'http://127.0.0.1:%d/' % poort
PAGINA = '_proef271.html'
open(os.path.join(MAP, PAGINA), 'w').write('''<!doctype html><html data-taal><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="background:#1a0a2e;margin:0;height:100vh"><script type="module">
const pm = await import('./profielmuziek.js?v=186'); const ts = await import('./titelscherm.js?v=8'); const qz = await import('./quiz.js?v=2')
window.__ts = ts; window.__pm = pm; window.__qz = qz
await pm.speelProfielMuziek({ data: %r, titel: 'Mijn nummer', sleutel: 'proef271' })
window.__klaar = 1
</script></body></html>''' % WAV)
SPEELT = "(() => { const a = document.querySelector('audio[data-profielmuziek]') || [...document.querySelectorAll('*')].find(() => false); const k = document.getElementById('profielMuziekKnop'); return !!(window.__audio && !window.__audio.paused) })()"
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
        ctx.add_init_script("""(() => { const o = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { if (this.dataset && this.dataset.profielmuziek) window.__audio = this; return o.call(this) } })()""")
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(B + 'manifest.json'); pg.evaluate("localStorage.setItem('fibro_taal','nl'); localStorage.setItem('fibro_muziek_auto','1')")
        # 's nachts start de muziek niet vanzelf: de klok op middag
        pg.add_init_script("(() => { const D = Date; const vast = new D('2026-11-06T12:00:00').getTime(); class N extends D { constructor(...a) { super(...(a.length ? a : [vast + (performance.now())])) } static now() { return vast + performance.now() } } window.Date = N })()")
        pg.goto(B + PAGINA); pg.wait_for_function('window.__klaar === 1', timeout=15000)
        pg.mouse.click(30, 300); pg.wait_for_timeout(800)
        speelt = lambda: pg.evaluate("!!(window.__audio && !window.__audio.paused)")
        check('A profielmuziek speelt', speelt())
        pg.evaluate("window.__ts.openSpelMetTitel('breakout', 'spel.html?spel=breakout')"); pg.wait_for_timeout(500)
        check('B tik op een spel: muziek uit (titelscherm)', not speelt() and pg.evaluate("!!document.querySelector('.fibro-titel, [class*=titel]')") is not None)
        pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
        venster = pg.evaluate("!!document.querySelector('iframe.fibro-spelvenster')")
        pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(300)
        check('C spel open: nog steeds stil', venster and not speelt(), venster)
        pg.evaluate("history.back()"); pg.wait_for_timeout(1200)
        check('D spel dicht: muziek gaat verder', speelt() and not pg.evaluate("!!document.querySelector('iframe.fibro-spelvenster')"))
        # zelf gepauzeerd: na het spel nog steeds uit
        pg.click('#profielMuziekKnop'); pg.wait_for_timeout(300)
        pg.evaluate("window.__ts.openSpelMetTitel('breakout', 'spel.html?spel=breakout')"); pg.wait_for_timeout(400)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(1200); pg.evaluate("history.back()"); pg.wait_for_timeout(1000)
        check('E zelf gepauzeerd: na het spel nog steeds uit', not speelt())
        pg.click('#profielMuziekKnop'); pg.wait_for_timeout(500)   # weer aan
        aan = speelt()
        pg.evaluate("window.__quiz = window.__qz.speelQuiz({ titel: 'Proef', muziek: 'botkaaseiren', vragen: [{ v: 'Twee plus twee?', a: ['3', '4'], g: 1 }] })"); pg.wait_for_timeout(500)
        stil = not speelt()
        pg.evaluate("window.__quiz._sluit()"); pg.wait_for_timeout(1000)
        check('G quiz: tijdens de quiz stil, daarna weer verder', aan and stil and speelt(), (aan, stil, speelt()))
        br.close()
finally:
    srv.terminate()
    try: os.remove(os.path.join(MAP, PAGINA))
    except Exception: pass
check('F geen paginafouten', not fouten, fouten[:3])
print('KLAAR: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if all(uitslag) else 1)
