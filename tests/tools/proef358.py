# proef358 (28 nov 2026, Marcel): Poker - de vijf kaarten op tafel waren te klein (altijd 50 px) en dus onleesbaar.
# Nu groeien ze mee met het scherm. Met z'n tweeën (nagemaakt spelkanaal), drie schermen:
#  A. computer (1280 x 800): de tafelkaarten zijn minstens 90 px breed
#  B. telefoon (360 x 740): minstens 56 px, alle vijf passen in het scherm
#  C. telefoon liggend (844 x 390): passen ook, en zijn niet kleiner dan vroeger (50 px; het scherm is daar te laag voor meer)
#  D. geen paginafouten
# Op de oude versie mislukt A (50 px).
# python3 -I proef358.py <map>
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from proefhulp import *
from playwright.sync_api import sync_playwright
MATEN = "() => { const k = [...document.querySelectorAll('.pk-bord .pk-kaart')].map(e => e.getBoundingClientRect()), h = [...document.querySelectorAll('.kt-hand .kt-kaart')].map(e => e.getBoundingClientRect()); return { n: k.length, breed: Math.min(...k.map(r => r.width)), links: Math.min(...k.map(r => r.left)), rechts: Math.max(...k.map(r => r.right)), onder: Math.max(...k.map(r => r.bottom)), hand: h.length ? Math.min(...h.map(r => r.top)) : 9999, scherm: innerWidth } }"
def tafel(b, breed, hoog, naam):
    ctx = context(b, breed, hoog)
    qs = []
    for nr in (1, 2):
        q = lege_spelpagina(ctx, '%s speler %d' % (naam, nr))
        start_spel(q, 'pokertexasholdem-ui.js?v=1', {'kanaal': [nr, 'pk358' + naam], 'benIkSpeler1': nr == 1, 'vriendNaam': 'x', 'mijnZetel': nr})
        qs.append(q)
    wacht(qs[0], "() => document.querySelectorAll('.pk-bord .pk-kaart').length === 5 && document.querySelectorAll('.kt-hand .kt-kaart').length === 2 && " + RUST, 15000)
    m = qs[0].evaluate(MATEN)
    ctx.close()
    return m
try:
    with sync_playwright() as p:
        b = browser(p)
        m = tafel(b, 1280, 800, 'groot')
        check(m['n'] == 5 and m['breed'] >= 90, 'A computer: tafelkaarten minstens 90 px breed (%s)' % m)
        m = tafel(b, 360, 740, 'staand')
        check(m['n'] == 5 and m['breed'] >= 56 and m['links'] >= 0 and m['rechts'] <= m['scherm'], 'B telefoon: minstens 56 px en alle vijf in beeld (%s)' % m)
        check(m['onder'] <= m['hand'], 'B de tafel botst niet met je eigen kaarten (%s)' % m)
        m = tafel(b, 844, 390, 'liggend')
        check(m['n'] == 5 and m['breed'] >= 50 and m['links'] >= 0 and m['rechts'] <= m['scherm'], 'C liggend: alles past, minstens 50 px (%s)' % m)
        b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
klaar()
