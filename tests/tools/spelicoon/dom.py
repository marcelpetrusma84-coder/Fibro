# Losse speelstukken uit de echte spellen (DOM/SVG): alles onzichtbaar behalve het stuk, transparante schermafbeelding.
from playwright.sync_api import sync_playwright
import os, sys; UIT = os.environ.get('SPELICOON_RAW', './raw/')
ISO_CSS = """html,body{background:transparent!important} *{visibility:hidden!important;animation:none!important;transition:none!important}
[data-iso],[data-iso] *{visibility:visible!important}"""
def open_spel(br, spel):
    p = br.new_page(viewport={'width': 400, 'height': 720}, device_scale_factor=6, locale='nl-NL')
    p.route('**/*supabase.co/**', lambda r: r.abort())
    p.goto('http://127.0.0.1:8765/Fibro/spel.html?spel=' + spel); p.wait_for_timeout(1200)
    for sel in ['[data-niveau="normaal"]', '#startKnop']:
        el = p.query_selector(sel)
        if el: el.click(); break
    p.wait_for_timeout(2000)
    return p
def isoleer(p, js, naam, rand=4):
    ok = p.evaluate("(f) => { const e = (new Function('return (' + f + ')()'))(); if (!e) return false; e.setAttribute('data-iso',''); return true }", js)
    assert ok, naam + ': element niet gevonden'
    p.add_style_tag(content=ISO_CSS); p.wait_for_timeout(300)
    b = p.eval_on_selector('[data-iso]', 'e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }')
    clip = {'x': b[0] - rand, 'y': b[1] - rand, 'width': b[2] + 2 * rand, 'height': b[3] + 2 * rand}
    p.screenshot(path=UIT + naam + '.png', clip=clip, omit_background=True)
    print('ok', naam, [round(v) for v in b])
with sync_playwright() as pw:
    br = pw.chromium.launch()
    # Tic-Tac-Toe: zet een X in het midden
    p = open_spel(br, 'botkaaseiren')
    p.locator('.bke-vak').nth(4).click(); p.wait_for_timeout(1500)
    isoleer(p, "() => document.querySelectorAll('.bke-vak')[4].querySelector('svg')", 'botkaaseiren'); p.close()
    # Four in a Row: ik rood, de computer geel
    p = open_spel(br, 'vieroprij')
    b = p.eval_on_selector('#spelInhoud', 'e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }')
    for i in range(3):
        p.mouse.click(200, 430); p.wait_for_timeout(1800)
    isoleer(p, "() => document.querySelector('.vor-schijf.geel:not(.vor-zweef)')", 'vieroprij', 6); p.close()
    # Chess: het witte paard
    p = open_spel(br, 'schaken')
    isoleer(p, "() => document.querySelector('svg.sch-figuur.sch-ivoor.sch-type-N')", 'schaken', 2); p.close()
    # Draughts: een witte schijf
    p = open_spel(br, 'dammen')
    isoleer(p, "() => [...document.querySelectorAll('#dam-bord div')].find(d => /radial-gradient\\(circle at 35% 30%, (#fff|rgb\\(255, 255, 255\\))/.test(d.style.background))", 'dammen', 4); p.close()
    br.close()
