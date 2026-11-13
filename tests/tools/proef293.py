# proef293 (11 nov 2026): Toepen en Eenentwintigen, de kaartspellen 2 en 3 op de blauwdruk (kaartspel-hulp.js).
# Speelt echt tegen de computer in spel.html, op een telefoonscherm.
# Toepen:
#  A. delen: 4 kaarten bij jou en bij de computer; inzet 1, slag 1/4; jij komt uit
#  B. ✊ Toep! = de computer moet antwoorden: mee (inzet 2) of eruit (strafpunt voor de computer, nieuwe ronde)
#  C. veeg een kaart omhoog = hij ligt op tafel; de computer legt erbij en de slag gaat naar de winnaar
#  D. bekennen: moet je bekennen, dan lichten alleen kaarten van die kleur op en blijft een andere kaart in je hand
#  E. een heel spel uitspelen tot iemand 10 strafpunten heeft; Opnieuw spelen deelt opnieuw
# Eenentwintigen:
#  F. delen: 2 kaarten bij jou en de computer; de stapel licht op; tik = een kaart erbij en je totaal klopt
#  G. ✋ Ik blijf: de computer speelt, daarna draait hij zijn kaarten om (open op tafel) en is er een uitslag
#  H. te veel (boven 21) = meteen af; Opnieuw spelen deelt opnieuw 2 kaarten
#  I. met z'n tweeën (nagemaakt spelkanaal): Toepen en Eenentwintigen komen bij allebei goed aan
#  J. de Store heeft beide spellen; geen paginafouten
# python3 -I proef293.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef293_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].sort((a, b) => a.dataset.plek - b.dataset.plek).map(k => k.dataset.id)"
AFLEG = "() => [...document.querySelectorAll('.kt-afleg .kt-ak')].map(k => k.dataset.id)"
ANDER = "() => parseInt(document.querySelector('.kt-anderaantal').textContent) || 0"
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
MIJN_BEURT = "() => !document.querySelector('.kt-einde') && !!document.querySelector('.kt-tafel.kt-mijnbeurt') && " + RUST
INFO = "() => document.querySelector('.kt-info').textContent"

def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def midden(pg, sel):
    return pg.eval_on_selector(sel, """e => { const r = e.getBoundingClientRect()
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) for (let fx = 0.08; fx < 0.95; fx += 0.08) {
            const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y)
            if (raak && (raak === e || e.contains(raak))) return [x, y] }
        return [r.left + r.width / 2, r.top + r.height / 2] }""")
def veeg(pg, x, y, dx, dy, stappen=8):
    pg.mouse.move(x, y); pg.mouse.down()
    for i in range(1, stappen + 1): pg.mouse.move(x + dx * i / stappen, y + dy * i / stappen); time.sleep(0.012)
    pg.mouse.up()
def kaart(id): return '.kt-hand .kt-kaart[data-id="%s"]' % id
def speelbaar(pg): return pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart.kt-mag')].map(k => k.dataset.id)")
def nietSpeelbaar(pg): return pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart.kt-niet')].map(k => k.dataset.id)")
def waarde(id):
    w = id[1:]
    return 11 if w == 'A' else 10 if w in ('B', 'V', 'H') else int(w)
def totaal(hand):
    t = sum(waarde(k) for k in hand); a = sum(1 for k in hand if k[1:] == 'A')
    while t > 21 and a: t -= 10; a -= 1
    return t

def open_spel(ctx, spel):
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(spel + ': ' + (str(e) + ' ' + str(getattr(e, 'stack', '') or ''))[:400])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("s => { localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_solo_niveau_' + s, 'makkelijk') }", spel)
    pg.goto(BASIS + 'spel.html?spel=%s&titel=1' % spel)
    pg.wait_for_selector('.niveau-btn[data-niveau=makkelijk]', timeout=10000)
    pg.evaluate("() => { for (const id of ['spelVideoAnder', 'spelVideoEigen']) { const d = document.createElement('div'); d.id = id; d.className = 'spel-video-vak'; document.body.appendChild(d) } }")
    pg.click('.niveau-btn[data-niveau=makkelijk]')
    return pg

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True, reduced_motion='reduce')
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))

        # ════════ Toepen ════════
        pg = open_spel(ctx, 'toepen')
        check(wacht(pg, MIJN_BEURT), 'A: na het delen ben jij aan de beurt (jij komt uit)')
        check(len(pg.evaluate(HAND)) == 4 and pg.evaluate(ANDER) == 4, 'A: 4 kaarten bij jou en bij de computer (%s, %d)' % (pg.evaluate(HAND), pg.evaluate(ANDER)))
        check('Inzet 1' in pg.evaluate(INFO) and 'Slag 1/4' in pg.evaluate(INFO), 'A: inzet 1, slag 1/4 (%s)' % pg.evaluate(INFO))
        check(pg.title() and pg.evaluate("() => document.getElementById('spelTitelBar')?.textContent || ''").find('Toepen') >= 0, 'A: titel Toepen')
        # ── B ──
        check(bool(pg.query_selector('.kt-knop[data-naam=toep]')), 'B: de knop ✊ Toep! staat er')
        pg.click('.kt-knop[data-naam=toep]')
        check(wacht(pg, "() => /Gaat .* mee\\?/.test(document.querySelector('.kt-status').textContent)", 3000), 'B: na de toep wacht je op de computer')
        b1 = wacht(pg, "() => /Inzet 2/.test(document.querySelector('.kt-info').textContent) || /Computer 1/.test(document.querySelector('.kt-info').textContent)", 12000)
        check(b1, 'B: de computer gaat mee (inzet 2) of eruit (1 strafpunt) (%s)' % pg.evaluate(INFO))
        check(not pg.query_selector('.kt-knop[data-naam=toep]') or 'Computer 1' in pg.evaluate(INFO), 'B: je kunt niet nog een keer achter elkaar toepen')
        # ── C ──
        def beurt_toepen(pg):   # wacht tot jij een kaart mag leggen; toept de computer, dan ga je mee
            for i in range(4):
                if not wacht(pg, "() => (%s)() || (%s && !!document.querySelector('.kt-knop[data-naam=mee]'))" % (MIJN_BEURT, RUST), 15000): return False
                if not pg.query_selector('.kt-knop[data-naam=mee]'): return True
                pg.click('.kt-knop[data-naam=mee]')
            return False
        check(beurt_toepen(pg), 'C: jij bent aan de beurt')
        mag = speelbaar(pg); hand_voor = pg.evaluate(HAND)
        x, y = midden(pg, kaart(mag[0])); veeg(pg, x, y, 20, -220)
        check(wacht(pg, "() => [...document.querySelectorAll('.kt-afleg .kt-ak')].some(k => k.dataset.id === '%s')" % mag[0], 4000), 'C: omhoog geveegd = op tafel (%s)' % mag[0])
        check(mag[0] not in pg.evaluate(HAND), 'C: en weg uit je hand')
        # (de computer kan eerst nog toepen: dan ga je mee)
        if wacht(pg, "() => !!document.querySelector('.kt-knop[data-naam=mee]') || /Slag 2\\/4/.test(document.querySelector('.kt-info').textContent)", 15000) and pg.query_selector('.kt-knop[data-naam=mee]'):
            pg.click('.kt-knop[data-naam=mee]')
        check(wacht(pg, "() => /Slag 2\\/4/.test(document.querySelector('.kt-info').textContent) && " + RUST, 15000), 'C: de computer legt erbij en de slag is gespeeld (%s)' % pg.evaluate(INFO))
        # ── D + E: uitspelen ──
        bekend = False; einde = False; rondes = set()
        for zet in range(400):
            if pg.query_selector('.kt-einde'): einde = True; break
            if not wacht(pg, "() => document.querySelector('.kt-einde') || (%s)() || (%s && document.querySelector('.kt-knop[data-naam=mee]'))" % (MIJN_BEURT, RUST), 25000): break
            if pg.query_selector('.kt-einde'): einde = True; break
            if pg.query_selector('.kt-knop[data-naam=mee]'): pg.click('.kt-knop[data-naam=mee]'); pg.wait_for_timeout(300); continue
            if pg.query_selector('.kt-knop[data-naam=toep]'): pg.click('.kt-knop[data-naam=toep]'); pg.wait_for_timeout(300); continue
            mag = speelbaar(pg); niet = nietSpeelbaar(pg)
            if not bekend and niet and len(pg.evaluate(AFLEG)) == 1:
                gevraagd = pg.evaluate(AFLEG)[0][0]
                bekend = all(k[0] == gevraagd for k in mag) and all(k[0] != gevraagd for k in niet)
                check(bekend, 'D: bekennen: alleen %s licht op (%s), de rest niet (%s)' % (gevraagd, mag, niet))
                x, y = midden(pg, kaart(niet[0])); veeg(pg, x, y, 0, -220); pg.wait_for_timeout(500)
                check(niet[0] in pg.evaluate(HAND), 'D: een kaart die niet mag blijft in je hand')
            if not mag: pg.wait_for_timeout(300); continue
            x, y = midden(pg, kaart(mag[0])); veeg(pg, x, y, 0, -220)
            pg.wait_for_timeout(250)
        print('     na', zet, 'zetten:', pg.evaluate(INFO), '·', pg.inner_text('.kt-status'))
        if not bekend: print('     (D niet voorgekomen: nooit hoeven bekennen met een andere kleur in de hand)')
        check(einde, 'E: het spel is uitgespeeld')
        if einde:
            tekst = pg.inner_text('.kt-einde')
            check('wint' in tekst and 'Strafpunten' in tekst and ('10' in tekst or '11' in tekst or '12' in tekst or '13' in tekst), 'E: winnaar en strafpunten in beeld (%s)' % tekst.replace('\n', ' '))
            pg.click('.kt-opnieuw')
            check(wacht(pg, "() => !document.querySelector('.kt-einde') && document.querySelectorAll('.kt-hand .kt-kaart').length === 4 && " + RUST + " && /Strafpunten: jij 0/.test(document.querySelector('.kt-info').textContent)", 10000), 'E: Opnieuw spelen = nieuwe kaarten en 0 strafpunten')
        pg.close()

        # ════════ Eenentwintigen ════════
        pg = open_spel(ctx, 'eenentwintigen')
        wacht(pg, "() => " + RUST + " && document.querySelectorAll('.kt-hand .kt-kaart').length === 2")
        # Meteen 21: dan blijf je vanzelf en speelt de computer direct; zijn kaarten liggen dan al open op tafel en de
        # uitslag staat er, dus F (beurt, stapel, aantal bij de computer, totaal) kan dan niet (G controleert de uitslag).
        if totaal(pg.evaluate(HAND)) == 21: print('     (meteen 21: dan blijf je vanzelf; F overgeslagen)')
        else:
            check(wacht(pg, MIJN_BEURT), 'F: na het delen ben jij aan de beurt')
            check(pg.evaluate("() => document.querySelector('.kt-stapel').classList.contains('kt-wijs')"), 'F: de stapel licht op')
            check(len(pg.evaluate(HAND)) == 2 and pg.evaluate(ANDER) >= 2, 'F: 2 kaarten bij jou en bij de computer')
            check(('Jij: %d' % totaal(pg.evaluate(HAND))) in pg.evaluate(INFO), 'F: je totaal staat erbij (%s, %s)' % (pg.evaluate(HAND), pg.evaluate(INFO)))
        if totaal(pg.evaluate(HAND)) < 21:
            pg.click('.kt-stapel')
            check(wacht(pg, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 3 && " + RUST, 6000), 'F: tik op de stapel = een kaart erbij')
            t = totaal(pg.evaluate(HAND))
            check(wacht(pg, "() => document.querySelector('.kt-info').textContent.includes('Jij: %d')" % t, 3000), 'F: totaal klopt na het pakken (%s, %s)' % (pg.evaluate(HAND), pg.evaluate(INFO)))
        # ── G ──
        if pg.query_selector('.kt-knop[data-naam=blijf]'): pg.click('.kt-knop[data-naam=blijf]')
        check(wacht(pg, "() => !!document.querySelector('.kt-einde')", 25000), 'G: daarna speelt de computer en is er een uitslag')
        hij = pg.evaluate(AFLEG)
        check(len(hij) >= 2 and not set(hij) & set(pg.evaluate(HAND)), 'G: de kaarten van de computer liggen open op tafel (%s)' % hij)
        tekst = pg.inner_text('.kt-einde')
        check(('wint' in tekst or 'Gelijkspel' in tekst) and 'Computer' in tekst and 'Stand' in tekst, 'G: uitslag met de totalen (%s)' % tekst.replace('\n', ' '))
        # ── H: blijven pakken tot je af bent ──
        dood = False
        for poging in range(8):   # (begint de computer en is hij zelf af, dan nog een keer)
            pg.click('.kt-opnieuw')
            for i in range(12):
                if not wacht(pg, "() => document.querySelector('.kt-einde') || (%s)()" % MIJN_BEURT, 15000) or pg.query_selector('.kt-einde'): break
                pg.click('.kt-stapel'); pg.wait_for_timeout(300)
            eind = wacht(pg, "() => !!document.querySelector('.kt-einde')", 15000)
            print('     poging', poging + 1, pg.evaluate(HAND), 'einde' if eind else 'geen einde', '·', pg.inner_text('.kt-einde').replace('\n', ' ') if eind else pg.inner_text('.kt-status'))
            if eind and totaal(pg.evaluate(HAND)) > 21: dood = True; break
        check(dood, 'H: boven 21 = meteen af (%s = %d)' % (pg.evaluate(HAND), totaal(pg.evaluate(HAND))))
        if dood: check('Computer wint' in pg.inner_text('.kt-einde'), 'H: en de computer wint')
        pg.click('.kt-opnieuw')
        check(wacht(pg, "() => !document.querySelector('.kt-einde') && document.querySelectorAll('.kt-hand .kt-kaart').length >= 2 && " + RUST, 10000), 'H: Opnieuw spelen deelt opnieuw')
        pg.close()

        # ════════ I: met z'n tweeën ════════
        KANAAL = """(ik) => {
            const bc = new BroadcastChannel('proef293'), lui = {}
            bc.onmessage = e => { if (e.data.van !== ik) for (const f of (lui[e.data.event] || [])) f({ payload: e.data.payload }) }
            return { on(_, f, fn) { (lui[f.event] = lui[f.event] || []).push(fn); return this }, send(m) { bc.postMessage({ van: ik, event: m.event, payload: m.payload }); return Promise.resolve('ok') } }
        }"""
        def speler(nr, bestand):
            q = ctx.new_page()
            q.on('pageerror', lambda e: fouten.append('speler %d: %s' % (nr, str(e)[:200])))
            q.goto(BASIS + 'manifest.json')
            q.evaluate("""async ([nr, maak, bestand]) => {
                document.body.innerHTML = '<div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud" style="position:fixed;inset:0"></div></div>'
                const m = await import(bestand)
                const kanaal = (0, eval)('(' + maak + ')')(nr)
                m.start({ spelKanaal: kanaal, benIkSpeler1: nr === 1, vriendNaam: nr === 1 ? 'Tijn' : 'Marcel' })
            }""", [nr, KANAAL, bestand])
            return q
        chat = open(os.path.join(MAP, 'chat.html'), encoding='utf8').read()
        for spel, n in [('toepen', 4), ('eenentwintigen', 2)]:
            bestand = './' + re.search(spel + r'-ui\.js\?v=\d+', chat).group(0)
            twee = speler(2, bestand); een = speler(1, bestand)
            klaar = "() => " + RUST + " && document.querySelectorAll('.kt-hand .kt-kaart').length === %d" % n
            check(wacht(een, klaar) and wacht(twee, klaar), 'I %s: allebei %d kaarten na het delen door speler 1' % (spel, n))
            check(not set(een.evaluate(HAND)) & set(twee.evaluate(HAND)), 'I %s: niemand heeft dezelfde kaart' % spel)
            # Eenentwintigen: met meteen 21 blijft speler 1 vanzelf en is speler 2 meteen aan de beurt (zoals bij F)
            meteen21 = spel == 'eenentwintigen' and totaal(een.evaluate(HAND)) == 21
            if meteen21: print('     (I: speler 1 had meteen 21: blijft vanzelf, pakken overgeslagen)')
            else: check(wacht(een, MIJN_BEURT) and not twee.evaluate("() => !!document.querySelector('.kt-tafel.kt-mijnbeurt')"), 'I %s: speler 1 begint, speler 2 wacht (%s)' % (spel, een.evaluate(HAND)))
            if spel == 'toepen':
                id = speelbaar(een)[0]; x, y = midden(een, kaart(id)); veeg(een, x, y, 0, -220)
                check(wacht(twee, "() => [...document.querySelectorAll('.kt-afleg .kt-ak')].some(k => k.dataset.id === '%s') && %s" % (id, RUST), 8000), 'I toepen: de kaart van speler 1 ligt ook bij speler 2 op tafel (%s)' % id)
                check(wacht(twee, MIJN_BEURT, 4000) and twee.evaluate(ANDER) == 3, 'I toepen: speler 2 is aan de beurt, de ander heeft nog 3 kaarten')
                twee.click('.kt-knop[data-naam=toep]')
                check(wacht(een, "() => !!document.querySelector('.kt-knop[data-naam=mee]')", 6000), 'I toepen: speler 2 toept, speler 1 krijgt Mee / Eruit')
                een.click('.kt-knop[data-naam=mee]')
                check(wacht(twee, "() => /Inzet 2/.test(document.querySelector('.kt-info').textContent)", 6000), 'I toepen: meegaan = inzet 2 bij allebei')
            elif not meteen21:
                een.click('.kt-stapel')
                check(wacht(twee, "() => parseInt(document.querySelector('.kt-anderaantal').textContent) === 3", 8000), 'I eenentwintigen: speler 1 pakt, speler 2 ziet 3 kaarten bij de ander')
            if spel == 'eenentwintigen':
                if een.query_selector('.kt-knop[data-naam=blijf]'): een.click('.kt-knop[data-naam=blijf]')
                check(wacht(twee, MIJN_BEURT, 8000) or wacht(twee, "() => !!document.querySelector('.kt-einde')", 2000), 'I eenentwintigen: daarna is speler 2 (of speler 1 was al af)')
            een.close(); twee.close()

        # ── J: de Store ──
        q = ctx.new_page()
        q.goto(BASIS + 'manifest.json')
        uit = q.evaluate("async () => { const s = await import('./store.js?v=7'); return s.STORE_GAMES.map(g => g.id + '|' + g.widget) }")
        check(uit == ['pesten|spel_pesten', 'toepen|spel_toepen', 'eenentwintigen|spel_eenentwintigen'], 'J: de Store heeft Pesten, Toepen en Eenentwintigen (%s)' % uit)
        check(not fouten, 'J: geen paginafouten (%s)' % fouten[:3])
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
