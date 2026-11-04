# proef243.py (v265): de quiz-widget in een echte browser (Chromium, telefoonformaat).
# Maken (titel, 3 vragen, instellingen), opslaan, spelen met 'meteen zien' (goed + fout, Yes!/Nee!-sticker),
# en spelen met 'pas aan het eind' (score en overzicht van de fouten). Start zelf een eenvoudige webserver.
import http.server, threading, socketserver, functools, os, sys
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=MAP)
Handler.log_message = lambda *a: None
srv = socketserver.TCPServer(('127.0.0.1', 0), Handler)
poort = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fouten = []

def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fouten.append(wat)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page(viewport={'width': 390, 'height': 800})
    p.on('pageerror', lambda e: fouten.append('paginafout: ' + str(e)))
    p.goto(f'http://127.0.0.1:{poort}/tests/fixtures/quiz-proef.html')
    p.wait_for_function('window.klaar === true')
    check('Nog geen quiz' in p.inner_text('#w'), 'lege widget zegt: nog geen quiz')
    p.click('text=✏️ Maak een quiz')
    check(p.is_visible('.quiz-maker'), 'maak-scherm open, beeldvullend')
    # opslaan zonder titel: melding
    p.click('.quiz-opslaan')
    check('titel' in p.inner_text('.quiz-maker'), 'zonder titel: melding')
    p.fill('.quiz-maker input[placeholder="Titel van je quiz"]', 'Ken jij Marcel?')
    vragen = [('Hoofdstad van Nederland?', ['Rotterdam', 'Amsterdam', 'Utrecht'], 1),
              ('2 + 2 =', ['4', '5'], 0),
              ('Kleur van de lucht?', ['Groen', 'Rood', 'Blauw', 'Geel'], 2)]
    for i, (v, ants, g) in enumerate(vragen):
        if i > 0: p.click('text=+ Vraag erbij')
        blok = p.locator('.quiz-vraagblok').nth(i)
        blok.locator('textarea').fill(v)
        velden = blok.locator('input:not([type=radio])')
        for j, a in enumerate(ants): velden.nth(j).fill(a)
        blok.locator('input[type=radio]').nth(g).check()
    p.click('.quiz-opslaan')
    check(not p.is_visible('.quiz-maker'), 'opgeslagen, maak-scherm dicht')
    q = p.evaluate("JSON.parse(localStorage.getItem('quiz_ik'))")
    check(q['titel'] == 'Ken jij Marcel?' and len(q['vragen']) == 3, 'quiz bewaard met 3 vragen')
    check(q['vragen'][0]['a'] == ['Rotterdam', 'Amsterdam', 'Utrecht'] and q['vragen'][0]['g'] == 1, 'lege antwoorden eruit, goede antwoord klopt')
    check(q['direct'] is True and q['stickers'] is True, 'standaard: meteen zien, met stickers')
    check('3 vragen' in p.inner_text('#w'), 'widget toont titel en aantal')

    # spelen, meteen zien
    p.click('text=▶ Spelen')
    check(p.is_visible('.quiz-speler'), 'speel-scherm open')
    box = p.locator('.quiz-speler').bounding_box()
    check(box['width'] >= 389 and box['height'] >= 799, 'beeldvullend')
    check('Vraag 1 van 3' in p.inner_text('.quiz-speler'), 'teller')
    p.screenshot(path=os.path.join(os.environ.get('PROEF_UIT', '/tmp'), 'proef243-vraag.png'))
    p.locator('.quiz-antwoord').nth(1).click()  # goed
    p.wait_for_timeout(250); p.screenshot(path=os.path.join(os.environ.get('PROEF_UIT', '/tmp'), 'proef243-goed.png'))
    check(p.locator('.quiz-sticker').count() == 1 and 'f5/05' in p.locator('.quiz-sticker').get_attribute('src'), 'goed: Gelukt!-sticker (vinkje)')
    check('Goed!' in p.inner_text('.quiz-uitleg'), 'goed: tekst')
    p.wait_for_selector('text=Vraag 2 van 3', timeout=4000)
    p.locator('.quiz-antwoord').nth(1).click()  # fout
    p.wait_for_selector('.quiz-sticker[src*="f5/06"]', timeout=2000)
    check(True, 'fout: Nee!-sticker')
    check('Het goede antwoord: 4' in p.inner_text('.quiz-uitleg'), 'fout: het goede antwoord staat er')
    p.click('.quiz-verder')
    p.locator('.quiz-antwoord').nth(2).click()  # goed
    p.wait_for_selector('.quiz-score', timeout=4000)
    check(p.inner_text('.quiz-score') == '2 van 3 goed', 'score 2 van 3')
    check(p.locator('.quiz-fout').count() == 0, 'meteen-zien: geen foutenlijst aan het eind')
    check(p.evaluate('window.TM.speeltNu()') is None, 'zonder gekozen muziek: stil')
    p.click('.quiz-klaar')
    check(p.locator('.quiz-speler').count() == 0, 'gesloten')

    # pas aan het eind
    p.click('text=✏️ Bewerken')
    p.locator('.quiz-maker label:has-text("Pas aan het eind de score") input').check()
    p.locator('.quiz-maker label:has-text("Stickers bij goed en fout") input').uncheck()
    p.select_option('.quiz-muziek', 'botkaaseiren')
    p.screenshot(path=os.path.join(os.environ.get('PROEF_UIT', '/tmp'), 'proef243-maken.png'))
    p.click('.quiz-opslaan')
    q = p.evaluate("JSON.parse(localStorage.getItem('quiz_ik'))")
    check(q['direct'] is False and q['stickers'] is False, 'instellingen bewaard')
    check(q['muziek'] == 'botkaaseiren', 'achtergrondmuziek bewaard')
    p.click('text=▶ Spelen')
    check(p.evaluate('window.TM.speeltNu()') == 'botkaaseiren', 'muziek speelt tijdens de quiz')
    for keuze in (0, 0, 2):
        p.locator('.quiz-antwoord').nth(keuze).click()
        p.wait_for_timeout(400)
    check(p.locator('.quiz-sticker').count() == 0, 'zonder stickers')
    p.wait_for_selector('.quiz-score', timeout=3000)
    check(p.inner_text('.quiz-score') == '2 van 3 goed', 'eind-score 2 van 3')
    fout = p.inner_text('.quiz-fout')
    check('Hoofdstad' in fout and 'Rotterdam' in fout and 'Amsterdam' in fout, 'overzicht: jouw antwoord en het goede')
    p.screenshot(path=os.path.join(os.environ.get('PROEF_UIT', '/tmp'), 'proef243-eind.png'))
    p.click('.quiz-klaar')
    check(p.evaluate('window.TM.speeltNu()') is None, 'muziek stopt bij sluiten')
    b.close()
srv.shutdown()
if fouten:
    print('\nMISLUKT:', fouten); sys.exit(1)
print('\nproef243: alles goed')
