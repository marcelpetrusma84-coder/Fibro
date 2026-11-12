# proef291_chat (11 nov 2026): deel G van proef291 - het spelmenu in de chat, met z'n tweeën.
# Gebruikt de nep-server (Realtime, REST, sleutels) van proef97: het eerste stuk van dat bestand wordt hier ingelezen.
import os, sys
HIER = os.path.dirname(os.path.abspath(__file__))
_bron = open(os.path.join(HIER, 'proef97.py'), encoding='utf-8').read()
exec(compile(_bron[:_bron.index('\nT97 = ')], 'proef97-basis', 'exec'))   # check, wacht, start, toestel, klik, ev, typ, BASIS, srv, ...

def open_spel_tik(m, b, spel):
    for pg in (m, b):
        pg.set_viewport_size({'width': 390, 'height': 844})
        pg.goto(BASIS + 'chat.html')
        if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", 15000): klik(pg, '#vriendenLijst .vriend-item')
    m.wait_for_timeout(1200)
    sessie = m.evaluate("Date.now().toString(36)")
    for pg in (m, b): ev(pg, "([s, n, u]) => { window.speelMee(s, n, u) }", [spel, sessie, MARCEL])
    for pg in (m, b):   # het titelscherm wegtikken
        if wacht(pg, "() => !!document.querySelector('.fibro-titelscherm')", 6000): pg.wait_for_timeout(600); pg.mouse.click(195, 420)
    k = "() => !!document.querySelector('#spelChatWrap input')"
    return wacht(m, k, 15000) and wacht(b, k, 15000)

ZICHT = "s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0 }"
ITEMS = "() => [...document.querySelectorAll('#spelMenuLijst button')].filter(b => !b.hidden).map(b => b.dataset.menu)"
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        cm, m, cb, b = start(br, 'nl')
        ok = open_spel_tik(m, b, 'vieroprij')
        check('G0 vier op een rij met z\'n tweeën open (met chatbalk)', ok)
        check('G1 ☰ in het spel', m.evaluate(ZICHT, '#spelMenuKnop') and b.evaluate(ZICHT, '#spelMenuKnop'))
        weg = [m.evaluate(ZICHT, s) for s in ('.spel-sluit-btn', '#spelMuteBtn', '#spelCamKnop')]
        check('G2 de oude ✕, 🎤 en 📹 bovenin zijn weg', not any(weg), weg)
        m.click('#spelMenuKnop')
        items = m.evaluate(ITEMS)
        check('G3 menu: Pauze, Geluid, Microfoon, Camera, Menu, Spel verlaten', items == ['pauze', 'geluid', 'mic', 'cam', 'menu', 'exit'], items)
        m.click('[data-menu=pauze]')
        check('G4 Marcel pauzeert: bij Marcel het pauzescherm met Verder', m.evaluate(ZICHT, '#spelPauzeLaag') and m.evaluate(ZICHT, '#spelPauzeLaag .sp-verder'))
        ok = wacht(b, "() => { const l = document.getElementById('spelPauzeLaag'); return l && l.classList.contains('open') }", 6000)
        tekst = b.inner_text('#spelPauzeLaag') if ok else ''
        check('G5 ook Bram staat stil, met de naam van Marcel en zonder Verder-knop', ok and 'Marcel' in tekst and not b.evaluate(ZICHT, '#spelPauzeLaag .sp-verder'), tekst)
        t1 = b.evaluate("performance.now()"); b.wait_for_timeout(500); t2 = b.evaluate("performance.now()")
        check('G6 bij Bram staat de klok stil', abs(t2 - t1) < 1, (t1, t2))
        check('G7 de chatbalk werkt tijdens de pauze', typ(b, 'even plassen 🚽') and wacht(m, "() => [...document.querySelectorAll('#spelChatLaag > div')].some(d => d.textContent.includes('even plassen'))", 6000))
        m.click('#spelPauzeLaag .sp-verder')
        check('G8 Marcel gaat verder: allebei verder', wacht(m, "() => !document.getElementById('spelPauzeLaag').classList.contains('open')", 3000)
              and wacht(b, "() => !document.getElementById('spelPauzeLaag').classList.contains('open')", 6000))
        # bericht van een andere vriend (ongelezen.js geeft het seintje)
        b.evaluate("document.dispatchEvent(new CustomEvent('fibro-nieuw-bericht', { detail: { van: 'cccc0001-0000-4000-8000-000000000003' } }))")
        w = b.evaluate("() => { const e = document.getElementById('spelbericht'); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, tekst: e.textContent } }")
        check('G9 bericht van een andere vriend: wolkje linksboven', w and w['l'] < 30 and 'berichtje' in w['tekst'], w)
        b.click('#spelMenuKnop'); b.click('[data-menu=exit]')
        check('G10 Spel verlaten sluit het spel (en het wolkje)', wacht(b, "() => !document.getElementById('spelOverlay').classList.contains('open') && !document.getElementById('spelbericht') && !document.getElementById('spelMenuKnop')", 5000))
        b.evaluate("document.dispatchEvent(new CustomEvent('fibro-nieuw-bericht', { detail: { van: 'cccc0001-0000-4000-8000-000000000003' } }))")
        check('G11 zonder spel geen wolkje', not b.evaluate("!!document.getElementById('spelbericht')"))
        # G13: Pesten in de chat: het pauzescherm ligt boven alles van de kaarttafel
        sessie = m.evaluate("Date.now().toString(36)")
        for pg in (m, b): ev(pg, "([s, n, u]) => { window.speelMee(s, n, u) }", ['pesten', sessie, MARCEL])
        for pg in (m, b):
            if wacht(pg, "() => !!document.querySelector('.fibro-titelscherm')", 6000): pg.wait_for_timeout(600); pg.mouse.click(195, 420)
        wacht(m, "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 7", 20000)
        m.evaluate("() => { const d = document.createElement('div'); d.className = 'kt-einde'; d.style.zIndex = '999'; document.querySelector('.kt-tafel').appendChild(d) }")
        m.click('#spelMenuKnop'); m.click('[data-menu=pauze]')
        boven = m.evaluate("() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('#spelPauzeLaag')")
        check('G13 Pesten in de chat: het pauzescherm ligt boven de kaarttafel', boven)
        check('G12 geen paginafouten', not fouten, fouten[:3])
        br.close()
finally:
    srv.terminate()
sys.exit(0 if all(uitslag) else 1)
