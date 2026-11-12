# proef291 (11 nov 2026): het spelmenu ☰ rechtsboven in elk spel (spelmenu.js) en het berichtenwolkje linksboven.
#  A. spel.html: ☰ rechtsboven, de oude ✕ is weg; het menu: Pauze, Geluid, Menu, Spel verlaten (geen microfoon/camera alleen)
#  B. Pauze bij een snel spel (Neo Paddle): de klok en de beeldjes staan stil; Verder = ze lopen weer, zonder sprong in de tijd
#  C. Pauze bij een beurtspel tegen de computer (boter-kaas-en-eieren): de computer zet pas na Verder spelen
#  D. Geluid uit: Web Audio-geluid is stil (gemeten); weer aan = geluid; de keuze blijft bewaard
#  E. Menu = terug naar het kiezen van het niveau; Spel verlaten = terug naar Home
#  F. het berichtenwolkje staat linksboven en niet over ☰ of de naam van het spel
#  H. Pesten (kaartspel) tegen de computer: het pauzescherm ligt boven de kaarten en het eindscherm van de tafel
#  G. in de chat, met z'n tweeën (nep-server van proef97): ☰ in het spel, de oude ✕ 🎤 📹 bovenin weg, Microfoon en Camera
#     in het menu; Marcel pauzeert = ook Bram staat stil (zonder Verder-knop); Marcel gaat verder = allebei verder;
#     een bericht van een ANDERE vriend = wolkje linksboven, alleen zolang het spel open is; Spel verlaten sluit het spel
# python3 -I proef291.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat, flush=True)
    if not ok: fout.append(wat)
def wacht(pg, js, ms=10000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def rect(pg, sel): return pg.evaluate("s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width } }", sel)
def overlapt(a, b): return bool(a and b and a['l'] < b['r'] and b['l'] < a['r'] and a['t'] < b['b'] and b['t'] < a['b'])
GEVULD = "() => [...document.querySelectorAll('#bke-bord .bke-vak')].filter(v => !/: leeg$/.test(v.getAttribute('aria-label') || '')).length"
ITEMS = "() => [...document.querySelectorAll('#spelMenuLijst button')].filter(b => !b.hidden).map(b => b.dataset.menu)"

www = tempfile.mkdtemp(prefix='proef291_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True)
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("() => { localStorage.setItem('fibro_taal', 'nl'); localStorage.removeItem('fibro_spelgeluid') }")
        # ── A ──
        pg.goto(BASIS + 'spel.html?spel=botkaaseiren&titel=1')
        pg.wait_for_selector('.niveau-btn', timeout=10000)
        knop = rect(pg, '#spelMenuKnop')
        check(knop and knop['r'] > 340 and knop['t'] < 30, 'A: ☰ rechtsboven (%s)' % knop)
        check(not pg.is_visible('#sluitKnop'), 'A: de oude ✕ is weg')
        pg.click('#spelMenuKnop')
        check(pg.evaluate(ITEMS) == ['pauze', 'geluid', 'menu', 'exit'], 'A: volgorde: Pauze, Geluid, Menu, Spel verlaten (%s)' % pg.evaluate(ITEMS))
        check(pg.is_disabled('[data-menu=pauze]'), 'A: pauze kan pas als het spel loopt')
        pg.keyboard.press('Escape')
        check(not pg.is_visible('#spelMenuLijst'), 'A: Escape sluit het menu')
        # ── C ──
        pg.click('.niveau-btn[data-niveau=makkelijk]')
        pg.wait_for_selector('.bke-vak.kan', timeout=10000)
        pg.click('.bke-vak.kan >> nth=0')
        pg.click('#spelMenuKnop'); pg.click('[data-menu=pauze]')
        check(pg.is_visible('#spelPauzeLaag') and 'Gepauzeerd' in pg.inner_text('#spelPauzeLaag'), 'C: pauzescherm')
        pg.wait_for_timeout(2500)
        stukken = pg.evaluate(GEVULD)
        check(stukken == 1, 'C: de computer zet niet tijdens de pauze (%d stukken)' % stukken)
        pg.click('#spelPauzeLaag .sp-verder')
        check(wacht(pg, "() => (%s)() === 2" % GEVULD, 6000), 'C: na Verder spelen zet de computer')
        check(not pg.is_visible('#spelPauzeLaag'), 'C: pauzescherm weg')
        # ── E: Menu ──
        pg.click('#spelMenuKnop'); pg.click('[data-menu=menu]')
        check(wacht(pg, "() => /titel=1/.test(location.search) && !!document.querySelector('.niveau-btn')"), 'E: Menu = terug naar het kiezen van het niveau')
        # ── B ──
        pg.goto(BASIS + 'spel.html?spel=pong&titel=1')
        pg.wait_for_selector('.niveau-btn', timeout=10000)
        pg.click('.niveau-btn[data-niveau=normaal]'); pg.wait_for_timeout(1500)
        pg.evaluate("() => { window.__n = 0; const tel = () => { window.__n++; requestAnimationFrame(tel) }; requestAnimationFrame(tel) }")
        pg.wait_for_timeout(300)
        pg.click('#spelMenuKnop'); pg.click('[data-menu=pauze]')
        t1, n1 = pg.evaluate("() => [performance.now(), window.__n]")
        pg.wait_for_timeout(800)
        t2, n2 = pg.evaluate("() => [performance.now(), window.__n]")
        check(abs(t2 - t1) < 1 and n2 - n1 <= 1, 'B: tijdens de pauze staan klok en beeldjes stil (%.1f ms, %d beeldjes)' % (t2 - t1, n2 - n1))
        pg.click('#spelPauzeLaag .sp-verder'); pg.wait_for_timeout(500)
        t3, n3 = pg.evaluate("() => [performance.now(), window.__n]")
        check(n3 - n2 > 10 and 300 < t3 - t2 < 1500, 'B: na Verder lopen ze weer, zonder sprong (%d beeldjes, %.0f ms)' % (n3 - n2, t3 - t2))
        # ── D ──
        GELUID = """async () => { const ac = new OfflineAudioContext(1, 4410, 44100); const o = ac.createOscillator(); o.connect(ac.destination); o.start()
            const buf = await ac.startRendering(); return Math.max(...buf.getChannelData(0).map(Math.abs)) }"""
        check(pg.evaluate(GELUID) > 0.5, 'D: geluid aan = geluid')
        pg.click('#spelMenuKnop'); pg.click('[data-menu=geluid]')
        check(pg.evaluate(GELUID) == 0, 'D: geluid uit = stil')
        check(pg.get_attribute('[data-menu=geluid]', 'data-aan') == 'false' and pg.evaluate("localStorage.getItem('fibro_spelgeluid')") == 'uit', 'D: bewaard')
        pg.reload(); pg.wait_for_selector('#spelMenuKnop', timeout=10000)
        check(pg.evaluate(GELUID) == 0, 'D: na opnieuw laden nog steeds uit')
        pg.click('#spelMenuKnop'); pg.click('[data-menu=geluid]')
        check(pg.evaluate(GELUID) > 0.5, 'D: weer aan = geluid')
        pg.keyboard.press('Escape')
        # ── F ──
        pg.evaluate("import('./spelbericht.js?v=2').then(m => { window.w = m.maakWolkje(() => {}) })"); pg.wait_for_function('window.w')
        pg.evaluate("window.w.erbij('bram')"); pg.wait_for_timeout(300)
        w, k, t = rect(pg, '#spelbericht'), rect(pg, '#spelMenuKnop'), rect(pg, '#spelTitelBar')
        check(w and w['l'] < 30 and not overlapt(w, k), 'F: groot wolkje linksboven, niet over ☰ (%s)' % w)
        pg.wait_for_timeout(4500)
        w = rect(pg, '#spelbericht')
        check(w['l'] < 30 and w['t'] < 30 and not overlapt(w, k) and not overlapt(w, t), 'F: klein wolkje in de hoek linksboven, niet over de naam (%s / %s)' % (w, t))
        # ── H: Pesten ──
        pg.goto(BASIS + 'spel.html?spel=pesten&titel=1'); pg.wait_for_selector('.niveau-btn', timeout=10000)
        pg.click('.niveau-btn[data-niveau=normaal]')
        wacht(pg, "() => !!document.querySelector('.kt-tafel.kt-mijnbeurt')", 15000)
        pg.evaluate("() => { const d = document.createElement('div'); d.className = 'kt-einde'; d.id = 'proefEinde'; d.style.zIndex = '999'; document.querySelector('.kt-tafel').appendChild(d) }")
        pg.click('#spelMenuKnop'); pg.click('[data-menu=pauze]')
        boven = pg.evaluate("() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !!e.closest('#spelPauzeLaag') }")
        check(boven, 'H: Pesten: het pauzescherm ligt boven de kaarten en de schermen van de tafel')
        pg.click('#spelPauzeLaag .sp-verder')
        check(wacht(pg, "() => !document.getElementById('spelPauzeLaag').classList.contains('open')", 3000), 'H: Pesten: verder spelen')
        # ── E: Spel verlaten ──
        pg.click('#spelMenuKnop'); pg.click('[data-menu=exit]')
        check(wacht(pg, "() => location.pathname.endsWith('/index.html')"), 'E: Spel verlaten = terug naar Home')
        check(not fouten, 'A-F: geen paginafouten (%s)' % fouten[:3])
        ctx.close(); b.close()
finally:
    srv.terminate()

# ── G: in de chat, met z'n tweeën ──
G = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'proef291_chat.py')
r = subprocess.run([sys.executable, '-I', G, MAP], capture_output=True, text=True, timeout=400)
print(r.stdout.strip()); 
if r.returncode != 0: fout.append('G: zie hierboven'); print(r.stderr[-1500:])
print('\n%d fout(en)' % len(fout) if fout else '\nAlles goed')
sys.exit(1 if fout else 0)
