# proef274 (6 nov 2026, v275): een spreekwolkje bovenin het spel als je een berichtje krijgt (spelbericht.js).
#  A. spel.html laadt het en geeft zonder account geen fouten
#  B. eerste berichtje: groot wolkje "💬 Je hebt een berichtje" onder de ✕, dat na 4 s klein wordt naast de ✕ (niet erover)
#  C. meer berichtjes: het kleine wolkje telt (💬 3), er komt geen tweede groot wolkje
#  D. tik op het wolkje: vraag "Naar de chat?"; Verder spelen = weg, je blijft in het spel
#  E. Naar de chat: naar de chat met die vriend (een afzender), of naar de chatlijst (meer afzenders)
#  F. welke berichtjes tellen: niet je eigen, niet 'belt je', wel een gemiste oproep (net als het bolletje bij Chat)
#  G. Engels
# python3 -I proef274.py <map>
import sys, os, time, socket, subprocess
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/' % poort
def rect(pg, sel): return pg.evaluate("s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom } }", sel)
def overlapt(a, b): return a and b and a['l'] < b['r'] and b['l'] < a['r'] and a['t'] < b['b'] and b['t'] < a['b']
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for taal in ['nl-NL', 'en-US']:
            ctx = b.new_context(service_workers='block', locale=taal, viewport={'width': 360, 'height': 740}, has_touch=True, is_mobile=True)
            if taal == 'en-US': ctx.add_init_script("try { localStorage.setItem('fibro_taal', 'en') } catch (e) {}")
            pg = ctx.new_page(); paginafouten = []
            pg.on('pageerror', lambda e: paginafouten.append(str(e)))
            pg.route('**/*supabase.co/**', lambda r: r.abort())
            pg.goto(BASIS + 'spel.html?spel=botkaaseiren&titel=1'); pg.wait_for_timeout(2000)
            if taal == 'nl-NL':
                check(pg.evaluate("[...document.scripts].some(s => s.textContent.includes(\"from './spelbericht.js?v=1'\"))"), 'A: spel.html laadt spelbericht.js')
                check(not paginafouten, 'A: geen paginafouten zonder account (%s)' % paginafouten)
                ik = 'aaaa'
                f = pg.evaluate("""async () => { const m = await import('./spelbericht.js?v=1'); const ik = 'aaaa'
                  const b = (c, s) => m.telt({ receiver_id: ik, sender_id: s || 'bbbb', content: c }, ik)
                  return [b('hoi'), b('buzz:'), b('oproep:video:x'), b('oproep:gemist:x'), b('hoi', ik), m.telt({ receiver_id: 'cccc', sender_id: 'bbbb', content: 'x' }, ik), m.telt(null, ik)] }""")
                check(f == [True, True, False, True, False, False, False], 'F: welke tellen (%s)' % f)
            pg.evaluate("import('./spelbericht.js?v=1').then(m => { window.naar = 'nog niet'; window.w = m.maakWolkje(id => { window.naar = id }) })")
            pg.wait_for_function('window.w')
            pg.evaluate("window.w.erbij('bram')"); pg.wait_for_timeout(400)
            tekst = pg.inner_text('#spelbericht')
            if taal == 'en-US':
                check('You have a message' in tekst, 'G: Engels (%r)' % tekst)
                ctx.close(); continue
            check('Je hebt een berichtje' in tekst and '💬' in tekst, 'B: groot wolkje (%r)' % tekst)
            check(not overlapt(rect(pg, '#spelbericht'), rect(pg, '#sluitKnop')), 'B: niet over de ✕')
            pg.wait_for_timeout(4500)
            check(pg.evaluate("document.getElementById('spelbericht').classList.contains('klein')"), 'B: na 4 s klein')
            pg.wait_for_timeout(400)
            k, x, t = rect(pg, '#spelbericht'), rect(pg, '#sluitKnop'), rect(pg, '#spelTitelBar')
            check(not overlapt(k, x) and abs(k['t'] - x['t']) < 6 and k['r'] <= x['l'], 'B: klein, naast de ✕ (%s / %s)' % (k, x))
            check(not overlapt(k, t), 'B: niet over de naam van het spel')
            check(pg.inner_text('#spelbericht').replace('\n', '').replace(' ', '') == '💬1', 'B: klein wolkje met 1 (%r)' % pg.inner_text('#spelbericht'))
            pg.evaluate("window.w.erbij('bram'); window.w.erbij('bram')"); pg.wait_for_timeout(200)
            check(pg.inner_text('#spelbericht').replace('\n', '').replace(' ', '') == '💬3', 'C: telt door (💬 3)')
            check(pg.evaluate("document.querySelectorAll('#spelbericht').length") == 1 and pg.evaluate("document.getElementById('spelbericht').classList.contains('klein')"), 'C: geen tweede groot wolkje')
            check(pg.get_attribute('#spelbericht', 'aria-label') == 'Je hebt 3 berichtjes', 'C: voorleesstem zegt het aantal')
            pg.click('#spelbericht'); pg.wait_for_timeout(200)
            check('Naar de chat? Dan verlaat je het spel.' in pg.inner_text('#spelbericht-vraag'), 'D: eerst de vraag')
            pg.click('#spelbericht-vraag .sb-nee'); pg.wait_for_timeout(200)
            check(pg.query_selector('#spelbericht-vraag') is None and pg.evaluate('window.naar') == 'nog niet' and 'spel.html' in pg.url, 'D: Verder spelen = je blijft in het spel')
            pg.click('#spelbericht'); pg.click('#spelbericht-vraag .sb-ja'); pg.wait_for_timeout(100)
            check(pg.evaluate('window.naar') == 'bram', 'E: een afzender: naar de chat met Bram')
            pg.evaluate("window.w.erbij('kim')"); pg.click('#spelbericht'); pg.click('#spelbericht-vraag .sb-ja'); pg.wait_for_timeout(100)
            check(pg.evaluate('window.naar') is None, 'E: meer afzenders: naar de chatlijst')
            check(not paginafouten, 'geen paginafouten (%s)' % paginafouten)
            ctx.close()
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
