# proef356 (27 nov 2026, Marcel): de sjablonen voor nieuwe spellen werken echt.
#  A. kaartspel (sjabloon-kaartspel-ui.js) met z'n drieën in de groep: iedereen 5 kaarten en de 2 anderen als rondjes;
#     Marcel begint; om de beurt een kaart leggen (dubbeltik); na de slag zien alle drie "Slag 2 van 5" en 1 slag bij
#     de winnaar
#  B. automaat (sjabloon-automaat-ui.js): zonder tokens; Hoger raden geeft een uitslag, dan een nieuwe kaart
#  C. arcade (sjabloon-arcade-ui.js): tik om te beginnen, de score loopt op, en als je geraakt wordt: game over en
#     solo.nieuweScore krijgt je score (voor je record en het scorebord)
#  D. geen paginafouten
# Op de oude versie mislukt alles (er waren alleen sjablonen voor een beurtspel).
# python3 -I proef356.py <map>
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from proefhulp import *
from playwright.sync_api import sync_playwright
MIDDEN = "() => document.querySelector('.sjk-midden')?.innerText.replace(/\\s+/g, ' ') || ''"
def speler(ctx, nr, groep):
    q = lege_spelpagina(ctx, 'speler %d' % nr)
    start_spel(q, 'sjabloon-kaartspel-ui.js?v=1', {'kanaal': [nr, 'sj356'], 'benIkSpeler1': nr == 1, 'vriendNaam': 'x', 'spelers': groep, 'mijnZetel': nr})
    return q
def leg(q):
    """dubbeltik op de eerste kaart van je hand"""
    id = q.evaluate(HAND)[0]
    dubbeltik(q, '.kt-hand .kt-kaart[data-id="%s"]' % id)
    return id
aan_beurt = lambda q: 'Leg een kaart' in (q.evaluate("() => document.querySelector('.kt-status')?.textContent || ''"))
try:
    with sync_playwright() as p:
        b = browser(p)
        # ── A ──
        ctx = context(b, 420, 860)
        groep = [{'naam': 'Marcel'}, {'naam': 'Tijn'}, {'naam': 'Bram'}]
        drie = [speler(ctx, n, groep) for n in (1, 2, 3)]
        check(all(wacht(q, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 5 && document.querySelectorAll('.kt-tz').length === 2 && " + RUST, 15000) for q in drie),
              'A iedereen 5 kaarten en de 2 anderen als rondjes')
        check(len(set(sum([q.evaluate(HAND) for q in drie], []))) == 15, 'A niemand dezelfde kaarten')
        check(wacht(drie[0], "() => (document.querySelector('.kt-status')?.textContent || '').includes('Leg een kaart')", 6000) and not aan_beurt(drie[1]), 'A Marcel begint')
        gelegd = []
        for i, q in enumerate(drie):
            check(wacht(q, "() => (document.querySelector('.kt-status')?.textContent || '').includes('Leg een kaart') && " + RUST, 8000), 'A %s is aan de beurt' % groep[i]['naam'])
            gelegd.append(leg(q))
            q.wait_for_timeout(500)
        check(all(wacht(q, "() => (%s)().includes('Slag 2 van 5')" % MIDDEN, 10000) for q in drie), 'A na de slag zien alle drie: Slag 2 van 5')
        tellen = [q.evaluate("() => [...document.querySelectorAll('.kt-tz-info')].map(e => e.textContent).join('|') + '|' + (document.querySelector('.sjk-midden .sjk-pil')?.textContent || '')") for q in drie]
        check(all(t.count('1 slag') == 1 for t in tellen), 'A precies één speler heeft 1 slag (%s)' % tellen)
        check(all(len(q.evaluate(HAND)) == 4 for q in drie), 'A iedereen nog 4 kaarten')
        ctx.close()
        # ── B ── de automaat
        ctx = context(b, 400, 800)
        q = lege_spelpagina(ctx, 'automaat')
        start_spel(q, 'sjabloon-automaat-ui.js?v=1')
        check(wacht(q, "() => (document.querySelector('.sja-saldo')?.textContent || '') === 'Zonder tokens' && !!document.querySelector('.sja-nu svg, .sja-nu img')", 8000), 'B de automaat: zonder tokens, een open kaart')
        q.click('.sja-knop[data-naam=hoger]')
        check(wacht(q, "() => /Goed geraden|Dezelfde waarde|Helaas/.test(document.querySelector('.sja-melding').textContent) && document.querySelector('.sja-knop[data-naam=hoger]').textContent === 'Nieuwe kaart'", 5000),
              'B Hoger raden geeft een uitslag (%s)' % q.evaluate("() => document.querySelector('.sja-melding').textContent"))
        q.click('.sja-knop[data-naam=hoger]')
        check(wacht(q, "() => document.querySelector('.sja-knop[data-naam=hoger]').textContent.includes('Hoger')", 3000), 'B en dan een nieuwe kaart')
        ctx.close()
        # ── C ── arcade
        ctx = context(b, 400, 760)
        q = lege_spelpagina(ctx, 'arcade')
        start_spel(q, 'sjabloon-arcade-ui.js?v=1', {'solo': 'record:7'})
        check(wacht(q, "() => (document.querySelector('.sjr-sub')?.textContent || '').includes('Record 7')", 6000), 'C het startscherm met je record')
        q.click('.sjr-start')
        check(wacht(q, "() => /Score [1-9]/.test(document.querySelector('.sjr-score').textContent)", 6000), 'C de score loopt op')
        check(wacht(q, "() => window.__scores.length === 1", 90000), 'C geraakt: game over')
        sc = q.evaluate("() => window.__scores")
        check(sc and sc[0] > 0 and 'Score %d' % sc[0] in q.inner_text('.sjr-sub'), 'C solo.nieuweScore kreeg je score (%s)' % sc)
        ctx.close(); b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
klaar()
