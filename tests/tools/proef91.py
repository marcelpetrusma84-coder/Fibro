# proef91: het vernieuwde schaken (van valentijnpeters, PR #2) in twee talen (v195). Echte spel.html (tegen de computer)
# en een proefpagina voor samen spelen (schaaksamen.html, wordt hier gemaakt: twee pagina's met een nagemaakt spelkanaal
# via BroadcastChannel). In het Nederlands en in het Engels:
#  A. tegen de computer: status, 'Jij' en 'Geslagen: 0 punten', de puntenregel, de knop 'Bord groter', de knop geluid,
#     de namen van de velden (a1, witte toren); geen Engelse woorden in het Nederlands en omgekeerd geen Nederlandse
#  B. 3 s ingedrukt houden op 'Bord groter' = de instellingen (koppen, knoppen, uitleg) in de goede taal; de bedenktijd:
#     0 = 'Meteen', 1 = '1 seconde', 3 = '3 seconden'; kort tikken = 'Bord kleiner' en terug
#  C. een zet: de computer antwoordt (bedenktijd 0)
#  D. samen: wit zet, zwart ziet de zet en 'Jouw beurt'; de status bij wit 'Wachten op ...'; d4 e5 dxe5 =
#     'Geslagen: 1 punt' bij wit (Jij) en bij zwart onder de tegenstander
#  E. geen paginafouten, geen '[taal] nog geen vertaling'
# Oude map (v194) als controle: daar is het Nederlands nog Engels, dus de Nederlandse controles MIS.
# v197: de knop 'Bord groter' is twee knoppen geworden (Compact / Hele breedte, PR #3); A1 en B3 kijken daarnaar. Het
# nieuwe van v197 zelf (webcam, beginnersstand, SCHAAKMAT ...) staat in proef93.
# python3 -I proef91.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''), flush=True)
HARNAS = r"""<!doctype html><html lang="nl" data-taal><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="taal.js"></script><title>Schaken samen</title>
<style>body{margin:0;background:#1a0a2e;color:#fff} #spelOverlay{position:fixed;inset:0;display:flex;flex-direction:column} #spelInhoud{flex:1;position:relative;display:flex;align-items:center;justify-content:center}</style></head>
<body><div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud"></div></div>
<script type="module">
const q = new URLSearchParams(location.search), rol = q.get('rol')
const bc = new BroadcastChannel('schaak-proef-' + q.get('kamer'))
const h = []
const kanaal = { topic: 'realtime:spel_x', on(t, f, cb) { h.push([f && f.event, cb]); return kanaal },
  send(m) { bc.postMessage({ van: rol, m: JSON.parse(JSON.stringify(m)) }); return Promise.resolve('ok') }, subscribe(fn) { if (fn) fn('SUBSCRIBED'); return kanaal } }
bc.onmessage = e => { const d = e.data; if (d.van === rol) return; h.filter(x => x[0] === d.m.event).forEach(x => x[1]({ type: 'broadcast', event: d.m.event, payload: d.m.payload })) }
const Schaak = await import('./schaak.js?v=95'), Bordgeluid = await import('./bordgeluid.js?v=' + (((await (await fetch('./chat.html')).text()).match(/bordgeluid\.js\?v=(\d+)/) || [])[1] || '148'))
const chat = await (await fetch('./chat.html')).text()
const versie = (chat.match(/schaken-ui\.js\?v=(\d+)/) || [])[1] || '149'
const m = await import('./schaken-ui.js?v=' + versie)
m.start({ Schaak, Bordgeluid, spelKanaal: kanaal, benIkSpeler1: rol === 'wit', vriendNaam: rol === 'wit' ? 'Marcel' : 'Bram' })
window.__klaar = true
</script></body></html>"""
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP):
    if f != 'schaaksamen.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
open(d + '/schaaksamen.html', 'w', encoding='utf-8').write(HARNAS)
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
fouten, taalfout = [], []
T = {
  'nl': dict(status='Jouw beurt (wit begint)', jij='Jij', geslagen0='Geslagen: 0 punten', geslagen1='Geslagen: 1 punt', legenda='Pion 1 · Paard 3 · Loper 3 · Toren 5 · Dame 9',
             groter='Hele breedte', kleiner='Compact', geluid='Geluid', veld='a1, witte toren', menu=['Schaakinstellingen', 'Bedenktijd van de computer', 'Grootte van de stukken', 'Kleiner', 'Standaard', 'Groter', 'Aanvalsroutes tonen', 'Soort bord', 'Klassiek', 'Hout', 'Marmer / graniet'],
             meteen='Meteen', een='1 seconde', drie='3 seconden', wacht='Wachten op Bram', beurt='Jouw beurt',
             vreemd=['Your turn', 'Captured', 'Enlarge', 'Smaller', 'Chess settings', 'Piece size', 'Board style', 'Pawn', 'seconds', 'Play again', 'Sound', 'white rook', 'Waiting']),
  'en': dict(status='Your turn (white starts)', jij='You', geslagen0='Captured: 0 points', geslagen1='Captured: 1 point', legenda='Pawn 1 · Knight 3 · Bishop 3 · Rook 5 · Queen 9',
             groter='Full width', kleiner='Compact', geluid='Sound', veld='a1, white rook', menu=['Chess settings', 'Computer thinking time', 'Piece size', 'Smaller', 'Default', 'Larger', 'Show attack routes', 'Board style', 'Classic', 'Wood grain', 'Marble / granite'],
             meteen='Instant', een='1 second', drie='3 seconds', wacht='Waiting for Bram', beurt='Your turn',
             vreemd=['Jouw beurt', 'Geslagen', 'Bord groter', 'Schaakinstellingen', 'Bedenktijd', 'Pion', 'seconden', 'Opnieuw', 'Geluid', 'witte toren', 'Wachten']),
}
def klik(pg, r, k): pg.click('#sch-bord [data-r="%d"][data-k="%d"]' % (r, k))
def tekst(pg): return pg.inner_text('#spelInhoud')
def wacht(pg, js, ms):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        for taal in ('nl', 'en'):
            t = T[taal]
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, bypass_csp=True)
            ctx.add_init_script("try { localStorage.setItem('fibro_taal', '%s'); localStorage.setItem('fibro_chess_settings_v1', '{\"thinking\":0}') } catch (e) {}" % taal)
            pg = ctx.new_page()
            pg.on('pageerror', lambda e: fouten.append(str(e)))
            pg.on('console', lambda m: taalfout.append(m.text) if 'nog geen vertaling' in m.text else None)
            pg.goto(B + 'spel.html?spel=schaken')
            pg.wait_for_timeout(1200)
            pg.evaluate("(() => { const b = [...document.querySelectorAll('button')].find(b => /^(Makkelijk|Easy)$/.test(b.textContent.trim())); if (b) b.click() })()")
            ok = wacht(pg, "!!document.querySelector('#sch-bord [data-r]')", 10000)
            pg.wait_for_timeout(500)
            x = tekst(pg)
            aria = pg.get_attribute('#sch-bord [data-r="7"][data-k="0"]', 'aria-label') if ok else ''
            check('%s A1 tegen de computer: status, Jij, Geslagen, puntenregel, Bord groter, geluid' % taal,
                  ok and t['status'] in x and t['jij'] in x and t['geslagen0'] in x and t['legenda'] in x and t['groter'] in x and t['geluid'] in x, x.replace('\n', ' | ')[:200])
            check('%s A2 de velden hebben een naam in de goede taal (%s)' % (taal, t['veld']), aria == t['veld'], aria)
            menuTekst = pg.evaluate("document.querySelector('#sch-menu').textContent")
            alles = x + ' ' + menuTekst + ' ' + pg.evaluate("[...document.querySelectorAll('#spelInhoud [aria-label]')].map(e => e.getAttribute('aria-label')).join(' ')")
            vreemd = [w for w in t['vreemd'] if w in alles]
            check('%s A3 geen woorden uit de andere taal (ook niet in het menu en de labels)' % taal, not vreemd, vreemd)
            # B. instellingen: 3 s ingedrukt
            knop = pg.locator('.sch-zoom'); bb = knop.bounding_box()
            pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.mouse.down(); pg.wait_for_timeout(3300); pg.mouse.up()
            open_ = pg.evaluate("!document.querySelector('#sch-menu').hidden")
            mt = pg.inner_text('#sch-menu') if open_ else ''
            mis = [w for w in t['menu'] if w not in mt]
            check('%s B1 3 s ingedrukt: de instellingen in de goede taal' % taal, open_ and not mis, mis or mt.replace('\n', ' | ')[:160])
            waarden = []
            for v in ('0', '1', '3'):
                pg.evaluate("v => { const s = document.querySelector('#sch-denktijd'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })) }", v)
                waarden.append(pg.inner_text('#sch-denktijd-waarde'))
            check('%s B2 bedenktijd: %s / %s / %s' % (taal, t['meteen'], t['een'], t['drie']), waarden == [t['meteen'], t['een'], t['drie']], waarden)
            pg.evaluate("v => { const s = document.querySelector('#sch-denktijd'); s.value = '0'; s.dispatchEvent(new Event('input', { bubbles: true })) }", '0')
            pg.click('#sch-status'); pg.wait_for_timeout(200)   # ergens anders in het spel tikken sluit het menu
            dicht = pg.evaluate("document.querySelector('#sch-menu').hidden")
            # v197: twee knoppen (Compact / Hele breedte) met aria-pressed in plaats van een knop die van tekst wisselt
            pg.click('.sch-zoom'); pg.wait_for_timeout(200); k1 = (pg.get_attribute('.sch-zoom', 'aria-pressed'), pg.evaluate("document.querySelector('.sch-spel').classList.contains('sch-groot')"))
            pg.click('.sch-compact'); pg.wait_for_timeout(200); k2 = (pg.get_attribute('.sch-zoom', 'aria-pressed'), pg.evaluate("document.querySelector('.sch-spel').classList.contains('sch-groot')"))
            check('%s B3 tikken naast het menu sluit het; "%s" maakt het bord groot, "%s" weer klein' % (taal, t['groter'], t['kleiner']), dicht and k1 == ('true', True) and k2 == ('false', False), (dicht, k1, k2))
            # C. zetten: e4, de computer antwoordt; daarna zo mogelijk slaan
            klik(pg, 6, 4); klik(pg, 4, 4)
            antw = wacht(pg, "document.querySelector('#sch-status').textContent.trim() === %r" % t['beurt'], 12000)
            check('%s C1 een zet: de computer antwoordt, status "%s"' % (taal, t['beurt']), antw, pg.inner_text('#sch-status'))
            ctx.close()
            # D. samen
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True)
            ctx.add_init_script("try { localStorage.setItem('fibro_taal', '%s') } catch (e) {}" % taal)
            wit = ctx.new_page(); zwart = ctx.new_page()
            for pg in (wit, zwart): pg.on('pageerror', lambda e: fouten.append(str(e))); pg.on('console', lambda m: taalfout.append(m.text) if 'nog geen vertaling' in m.text else None)
            wit.goto(B + 'schaaksamen.html?rol=wit&kamer=' + taal); zwart.goto(B + 'schaaksamen.html?rol=zwart&kamer=' + taal)
            ok = wacht(wit, 'window.__klaar === true', 10000) and wacht(zwart, 'window.__klaar === true', 10000)
            sz0 = zwart.inner_text('#sch-status')
            klik(wit, 6, 3); klik(wit, 4, 3)
            gezien = wacht(zwart, "(document.querySelector('#sch-bord [data-r=\"4\"][data-k=\"3\"]').getAttribute('aria-label') || '').includes(%r)" % ('witte pion' if taal == 'nl' else 'white pawn'), 6000)
            sz, sw = zwart.inner_text('#sch-status'), wit.inner_text('#sch-status')
            check('%s D1 samen: zwart ziet de zet van wit en "%s", wit wacht' % (taal, t['beurt']), ok and gezien and sz == t['beurt'] and ('Marcel' in sw) and ('Bram' in sz0) and t['wacht'].split(' Bram')[0] in sz0,
                  (sz0, sz, sw))
            # slaan: (wit d4 staat er al) zwart e5, wit dxe5
            klik(zwart, 1, 4); klik(zwart, 3, 4)
            wacht(wit, "document.querySelector('#sch-status').textContent.trim() === %r" % t['beurt'], 6000)
            wit.wait_for_timeout(300)
            klik(wit, 4, 3); klik(wit, 3, 4)
            geslagen = wacht(wit, "document.querySelector('#sch-eigen').textContent.includes(%r)" % t['geslagen1'], 6000)
            bijZwart = wacht(zwart, "document.querySelector('#sch-tegenstander').textContent.includes(%r)" % t['geslagen1'], 6000)
            check('%s D2 slaan: "%s" bij wit (Jij) en bij zwart onder de tegenstander' % (taal, t['geslagen1']), geslagen and bijZwart, (wit.inner_text('#sch-eigen').replace('\n', ' '), zwart.inner_text('#sch-tegenstander').replace('\n', ' ')))
            ctx.close()
        br.close()
finally:
    srv.terminate()
check('E geen paginafouten, geen ontbrekende vertaling', not fouten and not taalfout, (fouten[:2], taalfout[:2]))
goed = sum(uitslag)
print('UITSLAG proef91: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
