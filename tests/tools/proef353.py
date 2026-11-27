# proef353 (27 nov 2026, Marcel): Poker Texas Hold'em uit Stekky Studio (pokertexasholdem.js, pokertexasholdem-ui.js),
# met en zonder casino-tokens.
#  A. tegen de computer (spel.html): eerst kiezen tegen hoeveel computers, dan het inzetscherm; inzet 25 gaat naar de
#     server (casino_inzet, pokertexasholdem). Op tafel: 2 kaarten, 5 lege plekken, pot 30, blinds 10/20, de computer
#     als rondje met zijn fiches, knoppen Fold / Call 10 / Raise / ❓ (jij bent de dealer = small blind en begint)
#  B. ⬆ Raise opent de keuze (minimaal, ..., all-in); all-in tot het potje voorbij is: precies één casino_uitslag die
#     past bij het eindscherm, met het nieuwe saldo
#  C. ↻ Opnieuw spelen: weer het inzetscherm; "Zonder inzet spelen" = gewoon spelen, hand 1, geen uitslag naar de server
#  D. met z'n tweeën (via een nagemaakt spelkanaal): allebei 2 kaarten, niemand dezelfde; speler 1 begint; check/call
#     tot het einde van de hand: allebei dezelfde tafelkaarten en dezelfde fiches, en de pot gaat naar iemand
#  E. met z'n drieën in de groep: iedereen 2 kaarten en de 2 anderen als rondjes; de beurt gaat de rondte rond
#  F. ❓ = de spelregels; geen paginafouten
# Op de oude versie mislukt alles (er was geen poker).
# python3 -I proef353.py <map>
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from proefhulp import *
from playwright.sync_api import sync_playwright
UID = 'aaaaaaaa-0000-4000-8000-000000000353'
STAND = {'saldo': 230}
INZETTEN, UITSLAGEN, OPEN = [], [], {}
def supabase(route, u, body):
    if '/rpc/casino_overzicht' in u:
        return route.fulfill(status=200, json={'saldo': STAND['saldo'], 'volgende': '2026-11-30T00:00:00+01:00', 'vrienden': [], 'laatste': []})
    if '/rpc/casino_inzet' in u:
        INZETTEN.append(body); n = body.get('p_inzet')
        STAND['saldo'] -= n; OPEN[body.get('p_run_id')] = n
        return route.fulfill(status=200, json={'saldo': STAND['saldo'], 'inzet': n, 'al': False})
    if '/rpc/casino_uitslag' in u:
        UITSLAGEN.append(body); n = OPEN.pop(body.get('p_run_id'), 0)
        STAND['saldo'] += {'winst': 2 * n, 'gelijk': n}.get(body.get('p_uitslag'), 0)
        return route.fulfill(status=200, json={'saldo': STAND['saldo']})
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=sessie(UID)['user'])
BORD = "() => [...document.querySelectorAll('.pk-bord .pk-kaart[data-id]')].map(k => k.dataset.id)"
MIDDEN = "() => document.querySelector('.pk-midden')?.innerText.replace(/\\s+/g, ' ') || ''"
KNOPPEN = "() => [...document.querySelectorAll('.kt-knoppen button')].map(b => b.dataset.naam || b.textContent)"
def speler(ctx, nr, groep=None, kanaal='pk353'):
    q = lege_spelpagina(ctx, 'speler %d' % nr)
    start_spel(q, 'pokertexasholdem-ui.js?v=1', {'kanaal': [nr, kanaal], 'benIkSpeler1': nr == 1, 'vriendNaam': 'Tijn' if nr == 1 else 'Marcel', 'spelers': groep, 'mijnZetel': nr})
    return q
def aan_beurt(q): return q.evaluate("() => !!document.querySelector('.kt-knoppen button[data-naam=fold]')")
def check_of_call(q):
    for naam in ('check', 'call'):
        b = q.locator('.kt-knoppen button[data-naam=%s]' % naam)
        if b.count():
            try: b.click(timeout=1500); return True
            except Exception: return False
    return False

try:
    with sync_playwright() as p:
        b = browser(p)
        ctx = context(b, has_touch=True)
        nep_supabase(ctx, supabase)
        inloggen(ctx, sessie(UID))
        # ── A ── tegen de computer, met tokens
        pg = nieuwe_pagina(ctx, 'solo')
        pg.goto(BASIS + 'spel.html?spel=pokertexasholdem&titel=1')
        check(wacht(pg, "() => document.querySelectorAll('.niveau-btn[data-niveau]').length === 3", 10000), 'A het startscherm met drie niveaus')
        pg.click('.niveau-btn[data-niveau=normaal]')
        check(wacht(pg, "() => (document.querySelector('.kt-keuze') || {}).innerText?.includes('Tegen hoeveel computers')", 8000), 'A eerst: tegen hoeveel computers')
        pg.click('.kt-keuze button[aria-label="1"]')
        check(wacht(pg, "() => document.querySelectorAll('.cas-fiche').length === 4", 8000), 'A dan het inzetscherm')
        pg.click('.cas-fiche[data-inzet="25"]')
        check(len(INZETTEN) == 1 and INZETTEN[0].get('p_spel') == 'pokertexasholdem' and INZETTEN[0].get('p_inzet') == 25, 'A inzet 25 naar de server (%s)' % INZETTEN)
        check(wacht(pg, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 2 && !!document.querySelector('.kt-knoppen button[data-naam=fold]') && " + RUST, 15000), 'A twee kaarten en jij bent aan de beurt')
        m = pg.evaluate(MIDDEN)
        check('Hand 1' in m and 'Blinds 10/20' in m and 'Pot 30' in m and '🪙 25' in m and pg.locator('.pk-kaart.leeg').count() == 5, 'A hand 1, blinds 10/20, pot 30, 🪙 25, vijf lege plekken (%s)' % m)
        check(pg.evaluate(KNOPPEN) == ['fold', 'call', 'raise', 'uitleg'] and 'Call 10' in pg.inner_text('.kt-knoppen'), 'A knoppen Fold, Call 10, Raise, ❓ (%s)' % pg.evaluate(KNOPPEN))
        tz = pg.evaluate("() => [...document.querySelectorAll('.kt-tz')].map(z => z.innerText.replace(/\\s+/g, ' '))")
        check(len(tz) == 1 and 'Computer' in tz[0] and '980' in tz[0], 'A de computer als rondje met zijn fiches (%s)' % tz)
        check("Poker Texas Hold'em" in pg.inner_text('#spelTitelBar'), 'A de naam in de titelbalk')
        # ── F ── de regels
        pg.click('.kt-knoppen button[data-naam=uitleg]')
        check(wacht(pg, "() => (document.querySelector('.pk-regels') || {}).innerText?.includes('zijpot')", 3000), 'F ❓ = de spelregels')
        pg.click('.pk-regels button')
        # ── B ── all-in tot het einde
        pg.click('.kt-knoppen button[data-naam=raise]')
        check(wacht(pg, "() => [...document.querySelectorAll('.kt-keuze button')].some(b => b.innerText.includes('All-in'))", 4000)
              and pg.locator('.kt-keuze button', has_text='Minimaal').count() == 1, 'B Raise: kiezen hoeveel (Minimaal ... All-in)')
        pg.locator('.kt-keuze button', has_text='All-in').click()
        einde = False
        eind_tijd = time.time() + 180          # elke hand duurt even (delen, de computer denkt, de uitslag)
        while time.time() < eind_tijd:
            if pg.evaluate("() => !!document.querySelector('.kt-einde')"): einde = True; break
            if aan_beurt(pg):
                try:
                    pg.click('.kt-knoppen button[data-naam=raise]', timeout=1500)
                    pg.locator('.kt-keuze button', has_text='All-in').click(timeout=2000)
                except Exception:
                    check_of_call(pg)
            pg.wait_for_timeout(700)
        einde = einde or wacht(pg, "() => !!document.querySelector('.kt-einde')", 20000)
        if not einde:
            print('STAAT', pg.evaluate("() => [document.querySelector('.kt-status')?.innerText, document.querySelector('.pk-midden')?.innerText.replace(/\\s+/g, ' '), [...document.querySelectorAll('.kt-knoppen button')].map(b => b.dataset.naam), !!document.querySelector('.kt-keuze'), document.querySelector('.kt-keuze')?.innerText]"))
            pg.screenshot(path='/tmp/pk-vast.png')
        pg.wait_for_timeout(1200)
        titel = pg.evaluate("() => document.querySelector('.kt-eindetitel')?.textContent || ''")
        sub = pg.evaluate("() => document.querySelector('.kt-eindesub')?.textContent || ''")
        check(einde and titel, 'B het potje is voorbij (%s | %s | %s)' % (titel, sub, pg.evaluate("() => document.querySelector('.kt-einde')?.outerHTML.slice(0, 300)")))
        verwacht = 'winst' if 'Jij wint' in titel else 'verlies'
        check(len(UITSLAGEN) == 1 and UITSLAGEN[0].get('p_uitslag') == verwacht and UITSLAGEN[0].get('p_run_id') == INZETTEN[0].get('p_run_id'),
              'B precies één uitslag naar de server: %s (%s)' % (verwacht, UITSLAGEN))
        na = 205 + (50 if verwacht == 'winst' else 0)
        check(('Saldo: 🪙 %d' % na) in sub, 'B het nieuwe saldo in het eindscherm (%d) (%s)' % (na, sub))
        # ── C ── opnieuw, zonder tokens
        pg.click('.kt-opnieuw')
        check(wacht(pg, "() => document.querySelectorAll('.cas-fiche').length === 4", 8000), 'C ↻ Opnieuw spelen: weer het inzetscherm')
        pg.click('.cas-zonder')
        check(wacht(pg, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 2 && (document.querySelector('.pk-midden')?.innerText || '').includes('Hand 1') && !document.querySelector('.kt-einde')", 15000),
              'C zonder inzet: een nieuw potje, hand 1')
        check('🪙' not in pg.evaluate(MIDDEN) and len(INZETTEN) == 1, 'C geen tokens op tafel en geen nieuwe inzet')
        pg.close(); ctx.close()

        # ── D ── met z'n tweeën
        ctx = context(b, 420, 860)
        een, twee = speler(ctx, 1), speler(ctx, 2)
        check(wacht(een, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 2 && " + RUST) and wacht(twee, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 2 && " + RUST),
              'D allebei 2 kaarten')
        h1, h2 = een.evaluate(HAND), twee.evaluate(HAND)
        check(len(set(h1 + h2)) == 4, 'D niemand dezelfde kaarten (%s %s)' % (h1, h2))
        check(wacht(een, "() => !!document.querySelector('.kt-knoppen button[data-naam=fold]')", 8000) and not aan_beurt(twee)
              and 'Marcel' in twee.inner_text('.kt-status'), 'D speler 1 (de dealer) begint, speler 2 wacht (%s)' % twee.inner_text('.kt-status'))
        rond = False
        for _ in range(40):
            if all(q.evaluate("() => /Hand 2/.test(document.querySelector('.pk-midden')?.innerText || '')") for q in (een, twee)): rond = True; break
            for q in (een, twee):
                if aan_beurt(q) and q.evaluate("() => " + RUST): check_of_call(q)
            een.wait_for_timeout(600)
        check(rond, 'D check/call tot het einde: speler 1 deelt vanzelf hand 2')
        twee.wait_for_timeout(800)
        fiches = [q.evaluate("() => [...document.querySelectorAll('.kt-tz-info')].map(e => e.innerText)") for q in (een, twee)]
        mij = [q.evaluate("() => (document.querySelector('.pk-midden').innerText.match(/💰 ([\\d.]+)/) || [])[1]") for q in (een, twee)]
        check(mij[0] and mij[1] and fiches[0] and fiches[1] and mij[0] in fiches[1][0] and mij[1] in fiches[0][0], 'D allebei dezelfde fiches (%s / %s)' % (mij, fiches))
        ctx.close()

        # ── E ── met z'n drieën in de groep
        ctx = context(b, 420, 860)
        groep = [{'naam': 'Marcel'}, {'naam': 'Tijn'}, {'naam': 'Bram'}]
        drie = [speler(ctx, n, groep, 'pk353g') for n in (1, 2, 3)]
        RONDJES = "() => [...document.querySelectorAll('.kt-tz')].map(z => z.querySelector('.kt-tz-naam').textContent.replace('Ⓓ ', ''))"
        check(all(wacht(q, "() => document.querySelectorAll('.kt-tz').length === 2 && document.querySelectorAll('.kt-hand .kt-kaart').length === 2 && " + RUST, 15000) for q in drie),
              'E iedereen 2 kaarten en de 2 anderen als rondjes')
        check(drie[0].evaluate(RONDJES) == ['Tijn', 'Bram'] and drie[1].evaluate(RONDJES) == ['Bram', 'Marcel'], 'E de anderen in de rondte, te beginnen na jou')
        handen = [q.evaluate(HAND) for q in drie]
        check(len(set(sum(handen, []))) == 6, 'E niemand dezelfde kaarten')
        # met 3: knop 1, small blind 2, big blind 3: Marcel (1) begint pre-flop
        check(wacht(drie[0], "() => !!document.querySelector('.kt-knoppen button[data-naam=fold]')", 8000), 'E Marcel (de dealer) begint pre-flop')
        check_of_call(drie[0])
        check(wacht(drie[1], "() => !!document.querySelector('.kt-knoppen button[data-naam=fold]')", 8000), 'E dan Tijn (small blind)')
        check_of_call(drie[1])
        check(wacht(drie[2], "() => !!document.querySelector('.kt-knoppen button[data-naam=check]')", 8000), 'E dan Bram (big blind) mag checken')
        check_of_call(drie[2])
        check(all(wacht(q, "() => (%s)().length === 3" % BORD, 10000) for q in drie) and drie[0].evaluate(BORD) == drie[1].evaluate(BORD) == drie[2].evaluate(BORD),
              'E de flop: bij iedereen dezelfde 3 kaarten')
        ctx.close()
        b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
klaar()
