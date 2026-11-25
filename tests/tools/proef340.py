# proef340 (25 nov 2026, Marcel): kaartspellen met de groep in de groepschat (groepkaartspel.js, multiplayer stap 2).
# Drie groepsleden (Marcel, Tijn, Bram), elk een eigen pagina, met een nagemaakt groepskanaal (BroadcastChannel).
#  A. Marcel tikt op 🎲 en kiest Eenendertigen; Tijn en Bram krijgen bovenin "Marcel wil Eenendertigen spelen [Doe mee]"
#  B. Tijn en Bram doen mee; iedereen ziet de wachtkamer met 3 spelers; alleen Marcel heeft Start; Marcel zet een computer erbij
#  C. Start: bij alle drie gaat het spel open met de 3 anderen als rondjes (de computer heeft 🤖), het spelmenu ☰ staat erbij
#  D. in de rondte spelen: Marcel ruilt, Tijn ziet het; Tijn speelt via Marcel
#  E. 🏠 Menu = terug naar de chat (het spel blijft), "Terug naar het spel" brengt je terug
#  F. Bram verlaat het spel: de computer neemt zijn zetel over; daarna stopt Marcel: Tijn ziet "Het spel is gestopt."
#  G. iemand die geen lid is, kan niets sturen; geen paginafouten
# python3 -I proef340.py <map>
import functools, http.server, json, os, sys, threading, time
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, p): return super().translate_path(p.removeprefix('/Fibro'))
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=MAP))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASIS = 'http://127.0.0.1:%d/Fibro/' % srv.server_port
IDS = {'Marcel': 'aaaaaaaa-0000-4000-8000-000000000001', 'Tijn': 'aaaaaaaa-0000-4000-8000-000000000002', 'Bram': 'aaaaaaaa-0000-4000-8000-000000000003'}
fouten = []
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
MIJN = "() => !!document.querySelector('.kt-knoppen button[data-naam=alles]') && " + RUST
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].map(k => k.dataset.id)"
TAFEL = "() => [...document.querySelectorAll('.eed-tk')].map(k => k.dataset.id)"
def wacht(pg, js, ms=12000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def kies(pg, id):
    x, y = pg.eval_on_selector('.kt-hand .kt-kaart[data-id="%s"]' % id, """e => { const r = e.getBoundingClientRect()
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8, 0.9]) for (let fx = 0.08; fx < 0.95; fx += 0.08) { const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y); if (raak && raak.closest('.kt-kaart') === e) return [x, y] }
        return [r.left + r.width / 2, r.top + r.height / 2] }""")
    pg.mouse.click(x, y); time.sleep(0.15)
def ruil(pg):
    h, t = pg.evaluate(HAND)[0], pg.evaluate(TAFEL)[0]
    kies(pg, h); pg.click('.eed-tk[data-id="%s"]' % t)
    return h, t
def lid(ctx, naam):
    q = ctx.new_page()
    q.on('pageerror', lambda e: fouten.append('%s: %s' % (naam, str(e)[:300])))
    q.goto(BASIS + 'manifest.json')
    q.evaluate("localStorage.setItem('fibro_taal', 'nl')")
    q.evaluate("""async ([ik, ids]) => {
        document.body.innerHTML = ''
        await import('./taal.js').catch(() => {})
        const { maakGroepKaartspel } = await import('./groepkaartspel.js?v=1')
        const bc = new BroadcastChannel('groep-proef340')
        const leden = Object.entries(ids).map(([username, id]) => ({ id, username }))
        // het groepskanaal: wat met event 'gs' gestuurd wordt, komt bij de anderen binnen
        const kanaal = { send(b) { bc.postMessage(b); return Promise.resolve('ok') } }
        window.__toasts = []
        const gk = maakGroepKaartspel({ ik: ids[ik], groepId: 'g1', kanaal: () => kanaal, leden: () => leden, naamVan: l => l.username, toast: t => window.__toasts.push(t),
          bel: { kan: () => true, aan: () => false, wissel: () => { window.__bel = (window.__bel || 0) + 1 } } })
        bc.onmessage = e => { if (e.data && e.data.event === 'gs') gk.ontvang(e.data.payload) }
        window.__gk = gk; window.__bc = bc
    }""", [naam, IDS])
    return q

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        ctx = browser.new_context(viewport={'width': 420, 'height': 860}, service_workers='block')
        marcel, tijn, bram = lid(ctx, 'Marcel'), lid(ctx, 'Tijn'), lid(ctx, 'Bram')

        # ── A ──
        marcel.evaluate("window.__gk.kies()")
        check(wacht(marcel, "() => !!document.querySelector('.gk-spel[data-spel=eenendertigen]')", 5000), 'A het keuzescherm heeft Eenendertigen (2 tot 6 spelers)')
        check('2 tot 6 spelers' in marcel.inner_text('.gk-kaart'), 'A met het aantal spelers')
        marcel.click('.gk-spel[data-spel=eenendertigen]')
        for q, n in ((tijn, 'Tijn'), (bram, 'Bram')):
            check(wacht(q, "() => (document.querySelector('.gk-balk') || {}).innerText?.includes('Marcel wil Eenendertigen spelen')", 5000), 'A %s krijgt de uitnodiging bovenin' % n)

        # ── B ──
        tijn.click('.gk-balk .gk-mee'); bram.click('.gk-balk .gk-mee')
        DRIE = "() => document.querySelectorAll('.gk-spelers li').length === 3"
        check(all(wacht(q, DRIE, 5000) for q in (marcel, tijn, bram)), 'B iedereen ziet de wachtkamer met 3 spelers')
        check(marcel.locator('.gk-start').count() == 1 and tijn.locator('.gk-start').count() == 0 and 'Wachten tot Marcel start' in tijn.inner_text('.gk-kaart'), 'B alleen Marcel kan starten')
        marcel.click('.gk-computer-erbij')
        check(wacht(tijn, "() => document.querySelectorAll('.gk-spelers li').length === 4 && document.querySelector('.gk-computer')", 5000), 'B een computer erbij: iedereen ziet 4 spelers')

        # ── C ──
        marcel.click('.gk-start')
        VIER = "() => document.querySelectorAll('.gk-overlay .kt-tz').length === 3 && document.querySelectorAll('.kt-hand .kt-kaart').length === 3 && " + RUST
        check(all(wacht(q, VIER, 15000) for q in (marcel, tijn, bram)), 'C bij alle drie het spel, met de 3 anderen als rondjes')
        RONDJES = "() => [...document.querySelectorAll('.kt-tz')].map(z => z.querySelector('.kt-tz-naam').textContent + (z.querySelector('.kt-zetel span').textContent === '🤖' ? '🤖' : ''))"
        check(marcel.evaluate(RONDJES) == ['Tijn', 'Bram', 'Computer 1🤖'] and tijn.evaluate(RONDJES) == ['Bram', 'Computer 1🤖', 'Marcel'], 'C in de rondte, de computer met 🤖 (%s)' % marcel.evaluate(RONDJES))
        check(marcel.locator('#spelMenuKnop').count() == 1, 'C het spelmenu ☰ staat erbij')
        check(marcel.locator('.gk-laag').count() == 0 and tijn.locator('.gk-laag').count() == 0, 'C de wachtkamer is dicht')

        # ── D ──
        check(wacht(marcel, MIJN, 10000), 'D Marcel begint')
        h, t = ruil(marcel)
        check(wacht(tijn, "() => (%s)().includes('%s')" % (TAFEL, h), 8000), 'D Tijn ziet de nieuwe tafel')
        check(wacht(tijn, MIJN, 8000), 'D dan Tijn')
        h, t = ruil(tijn)
        check(wacht(tijn, "() => (%s)().includes('%s')" % (HAND, t), 8000) and wacht(bram, MIJN, 8000), 'D Tijn ruilt via Marcel; dan Bram')

        # ── E ──
        marcel.click('#spelMenuKnop'); marcel.click('#spelMenuLijst [data-menu=menu]')
        check(wacht(marcel, "() => document.querySelector('.gk-overlay').hidden && !!document.querySelector('.gk-terug')", 3000), 'E 🏠 = terug naar de chat, het spel blijft')
        marcel.click('.gk-terug')
        check(wacht(marcel, "() => !document.querySelector('.gk-overlay').hidden && !document.querySelector('.gk-terug')", 3000), 'E terug naar het spel')
        marcel.click('#spelMenuKnop')
        check(marcel.locator('#spelMenuLijst [data-menu=mic]').is_visible(), 'E de microfoon (voice chat van de groep) staat in het spelmenu')
        marcel.click('#spelMenuLijst [data-menu=mic]')
        check(marcel.evaluate("window.__bel") == 1, 'E microfoon = meedoen met de voice chat')

        # ── F ──
        bram.click('#spelMenuKnop'); bram.click('#spelMenuLijst [data-menu=exit]')
        check(wacht(bram, "() => !document.querySelector('.gk-overlay')", 3000), 'F Bram verlaat het spel')
        # Bram is aan de beurt geweest of komt nog: de computer speelt voor hem; het spel gaat door tot Marcel weer kan
        check(wacht(marcel, MIJN, 20000), 'F de computer speelde voor Bram; Marcel is weer aan de beurt')
        marcel.click('#spelMenuKnop'); marcel.click('#spelMenuLijst [data-menu=exit]')
        check(wacht(tijn, "() => (document.querySelector('.kt-einde') || {}).innerText?.includes('Het spel is gestopt')", 8000), 'F Marcel stopt: Tijn ziet "Het spel is gestopt."')

        # ── G ──
        tijn.evaluate("""() => { window.__bc.postMessage({ type: 'broadcast', event: 'gs', payload: { e: 'open', sessie: 'abcdef12', spel: 'eenendertigen', van: 'ffffffff-0000-4000-8000-000000000009' } }) }""")
        time.sleep(0.5)
        check(marcel.locator('.gk-balk').count() == 0, 'G iemand die geen lid is, kan geen spel openen')
        check(not fouten, 'G geen paginafouten (%s)' % fouten[:3])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    srv.shutdown()
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
