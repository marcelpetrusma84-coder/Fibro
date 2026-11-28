# proef360 (28 nov 2026, Marcel): "als je moet wachten op je medespelers dat je nog hoger/lager of op een fruitautomaat
# kan spelen ... voor personen jonger dan 18 jaar dat de casino widget niet zichtbaar is en dat bij alle gokspellen het
# tokensysteem niet zichtbaar is." (wachtspellen.js, leeftijd.js, fruitautomaat(-ui).js, hogerlager(-ui).js,
# sql/casino-volwassen.sql)
#  A. 18+ (geboren 1990): spel.html?spel=fruitautomaat met je saldo 🪙 250; Draai gaat naar de server
#     (fruitautomaat_draai, inzet 10); de rollen van de server (🔔 🔔 🔔), "+390" en het nieuwe saldo 🪙 640
#  B. 18+: Hoger of lager met tokens: ⬆ Hoger zet in bij de server (casino_inzet, spel hogerlager) en stuurt de uitslag
#  C. onder de 18 (geboren 2010): de Fruitautomaat zonder iets over tokens (geen saldo, geen fiches, geen wisselknop,
#     niets in de spelregels) en niets naar de server; Poker tegen de computer zonder inzetscherm
#  D. onder de 18: de casino-widget staat niet op Home (ook niet als hij er al op stond)
#  E. het wachtspelletje (wachtspelKnoppen) met een vriend die 18+ is: de Fruitautomaat met tokens; met een vriend
#     onder de 18 (casino_mag_hier zegt nee): zonder tokens; ✕ terug naar de keuze; geen paginafouten
# Op de oude versie mislukt alles (er was geen Fruitautomaat, geen Hoger of lager en geen leeftijdsgrens).
# python3 -I proef360.py <map>
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from proefhulp import *
from playwright.sync_api import sync_playwright
UID = 'aaaaaaaa-0000-4000-8000-000000000360'
OUD, JONG = '22222222-0000-4000-8000-000000000360', '33333333-0000-4000-8000-000000000360'
STAND = {'saldo': 250}
RPC = []
def supabase(route, u, body):
    if '/rpc/' in u:
        naam = u.split('/rpc/')[1].split('?')[0]; RPC.append((naam, body))
        if naam == 'casino_overzicht':
            return route.fulfill(status=200, json={'saldo': STAND['saldo'], 'volgende': '2026-11-30T00:00:00+01:00', 'vrienden': [{'user_id': UID, 'username': 'Marcel', 'saldo': STAND['saldo']}], 'laatste': []})
        if naam == 'fruitautomaat_draai':
            STAND['saldo'] += 40 * body.get('p_inzet', 0) - body.get('p_inzet', 0)
            return route.fulfill(status=200, json={'rollen': ['bel', 'bel', 'bel'], 'inzet': body.get('p_inzet'), 'uitbetaling': 40 * body.get('p_inzet', 0), 'saldo': STAND['saldo'], 'al': False})
        if naam == 'casino_inzet':
            STAND['saldo'] -= body.get('p_inzet', 0)
            return route.fulfill(status=200, json={'saldo': STAND['saldo'], 'inzet': body.get('p_inzet'), 'al': False})
        if naam == 'casino_uitslag': return route.fulfill(status=200, json={'saldo': STAND['saldo']})
        if naam == 'casino_mag_hier': return route.fulfill(status=200, json=body.get('p_vriend') == OUD)
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=s_oud['user'])
def met_jaar(jaar):
    s = sessie(UID); s['user']['user_metadata']['geboortejaar'] = jaar; return s
s_oud, s_jong = met_jaar(1990), met_jaar(2010)
def peil(pg, js, ms=12000):   # met evaluate (sommige pagina's houden eval tegen)
    for _ in range(ms // 150):
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        pg.wait_for_timeout(150)
    return False
def namen(): return [n for n, _ in RPC]
try:
    with sync_playwright() as p:
        b = browser(p)
        # ── A ── 18+: de Fruitautomaat met tokens
        ctx = context(b); nep_supabase(ctx, supabase); inloggen(ctx, s_oud)
        pg = nieuwe_pagina(ctx, 'fruit'); pg.goto(BASIS + 'spel.html?spel=fruitautomaat&titel=1')
        check(peil(pg, "(document.querySelector('.fa-saldo')?.textContent || '').includes('250')"), 'A de Fruitautomaat met je saldo 🪙 250')
        check(pg.locator('.fa-fiche').count() == 4 and pg.locator('.fa-wissel').is_visible(), 'A de fiches en de wisselknop')
        check('Fruitautomaat' in pg.inner_text('#spelTitelBar'), 'A de naam in de titelbalk')
        pg.click('.fa-knop[data-naam=draai]')
        check(peil(pg, "(document.querySelector('.fa-melding')?.textContent || '').includes('+390')", 8000), 'A drie bellen van de server: +390 (%s)' % pg.inner_text('.fa-melding'))
        d = [b_ for n, b_ in RPC if n == 'fruitautomaat_draai']
        check(len(d) == 1 and d[0].get('p_inzet') == 10 and d[0].get('p_expected_user') == UID, 'A inzet 10 naar de server (%s)' % d)
        check(pg.evaluate("[...document.querySelectorAll('.fa-rol')].map(r => r.textContent).join('')") == '🔔🔔🔔', 'A de rollen van de server')
        check('640' in pg.inner_text('.fa-saldo'), 'A het nieuwe saldo 🪙 640 (%s)' % pg.inner_text('.fa-saldo'))
        pg.click('.fa-knop[data-naam=uitleg]')
        check('97 van elke 100' in pg.inner_text('.fa-regels') and 'tokens' in pg.inner_text('.fa-regels'), 'A de spelregels zeggen eerlijk hoeveel je terugkrijgt')
        pg.close()
        # ── B ── Hoger of lager met tokens
        STAND['saldo'] = 250; RPC.clear()
        pg = nieuwe_pagina(ctx, 'hogerlager'); pg.goto(BASIS + 'spel.html?spel=hogerlager&titel=1')
        check(peil(pg, "(document.querySelector('.hl-saldo')?.textContent || '').includes('250')"), 'B Hoger of lager met je saldo')
        pg.click('.hl-knop[data-naam=hoger]')
        check(peil(pg, "document.querySelector('.hl-knop[data-naam=hoger]')?.textContent === 'Nieuwe kaart'", 8000), 'B de kaart is omgedraaid')
        i = [b_ for n, b_ in RPC if n == 'casino_inzet']
        check(len(i) == 1 and i[0].get('p_spel') == 'hogerlager' and i[0].get('p_inzet') == 10, 'B ingezet bij de server als hogerlager (%s)' % i)
        pg.wait_for_timeout(1500)
        check('casino_uitslag' in namen(), 'B de uitslag naar de server (%s)' % namen())
        pg.close(); ctx.close()
        # ── C ── onder de 18
        RPC.clear()
        ctx = context(b); nep_supabase(ctx, supabase); inloggen(ctx, s_jong, extra={
            'fibro_opslagtip_later': str(10 ** 13), 'fibro_eigennaam_gevraagd_' + UID: '1', 'fibro_store_' + UID: ['casino'],
            'fibro_widgets_profiel_' + UID: [{'id': 'mood', 'icon': '😊', 'titel': 'Mood', 'w': 4, 'h': 1, 'volgorde': 0, 'aan': True},
                                             {'id': 'casino', 'icon': '🎰', 'titel': 'Casino', 'w': 4, 'h': 3, 'volgorde': 1, 'aan': True}]})
        pg = nieuwe_pagina(ctx, 'fruit jong'); pg.goto(BASIS + 'spel.html?spel=fruitautomaat&titel=1')
        check(peil(pg, "!!document.querySelector('.fa-knop[data-naam=draai]')"), 'C de Fruitautomaat opent')
        pg.wait_for_timeout(800)
        check(pg.inner_text('.fa-saldo').strip() == '' and pg.locator('.fa-fiches').is_hidden() and pg.locator('.fa-wissel').is_hidden(), 'C geen saldo, geen fiches, geen wisselknop')
        pg.click('.fa-knop[data-naam=draai]')
        check(peil(pg, "!document.querySelector('.fa-knop[data-naam=draai]').disabled && (document.querySelector('.fa-melding')?.textContent || '').length > 2", 8000), 'C draaien op het toestel: %s' % pg.inner_text('.fa-melding'))
        check('tokens' not in pg.inner_text('.fa').lower(), 'C nergens het woord tokens')
        pg.click('.fa-knop[data-naam=uitleg]')
        check('token' not in pg.inner_text('.fa-regels').lower(), 'C de spelregels zonder tokens')
        check(not [n for n in namen() if n.startswith('casino') or n.startswith('fruit')], 'C niets naar de casino-server (%s)' % namen())
        pg.close()
        pg = nieuwe_pagina(ctx, 'poker jong'); pg.goto(BASIS + 'spel.html?spel=pokertexasholdem&titel=1')
        peil(pg, "!!document.querySelector('.niveau-btn[data-niveau]')", 8000)
        try: pg.click('.niveau-btn[data-niveau=normaal]', timeout=3000)
        except Exception: pass
        try: pg.click('#startKnop, .start-btn, button:has-text("Start")', timeout=3000)
        except Exception: pass
        if peil(pg, "!!document.querySelector('.kt-keuze button')", 8000): pg.click('.kt-keuze button >> nth=0')
        pg.wait_for_timeout(1500)
        check(pg.locator('.cas-inzet').count() == 0, 'C Poker tegen de computer: geen inzetscherm')
        pg.close()
        # ── D ── geen casino-widget op Home
        pg = nieuwe_pagina(ctx, 'home jong'); pg.goto(BASIS + 'index.html')
        check(peil(pg, "!!document.querySelector('.widget-blok[data-id=mood]')", 15000), 'D Home is er (met de mood-widget)')
        check(pg.locator('.widget-blok[data-id=casino]').count() == 0 and pg.locator('.csw').count() == 0, 'D geen casino-widget op Home')
        pg.close(); ctx.close()
        # ── E ── het wachtspelletje: met een vriend van 18+ en met een vriend onder de 18
        RPC.clear(); STAND['saldo'] = 250
        ctx = context(b); nep_supabase(ctx, supabase); inloggen(ctx, s_oud)
        for vriend, tokens in ((OUD, True), (JONG, False)):
            q = lege_spelpagina(ctx, 'wacht')
            q.evaluate("async v => { await import('./taal.js').catch(() => {}); const m = await import('./wachtspellen.js?v=1'); m.wachtspelKnoppen(document.getElementById('spelInhoud'), { vriend: v }) }", vriend)
            check(peil(q, "document.querySelectorAll('.ws-knop').length === 2"), 'E twee knoppen: Hoger of lager en Fruitautomaat')
            q.click('.ws-knop[data-spel=fruitautomaat]')
            check(peil(q, "!!document.querySelector('.ws-vak .fa-knop[data-naam=draai]')", 8000), 'E de Fruitautomaat staat in het wachtscherm')
            q.wait_for_timeout(1000)
            if tokens: check('250' in q.inner_text('.fa-saldo') and q.locator('.fa-fiche').count() == 4, 'E vriend 18+: met tokens (%s)' % q.inner_text('.fa-saldo'))
            else: check(q.inner_text('.fa-saldo').strip() == '' and q.locator('.fa-fiches').is_hidden(), 'E vriend onder de 18: zonder tokens')
            m = [b_ for n, b_ in RPC if n == 'casino_mag_hier']
            check(m and m[-1].get('p_vriend') == vriend, 'E de server is gevraagd of het mag (%s)' % m[-1:])
            q.click('.ws-dicht')
            check(peil(q, "!document.querySelector('.ws-knoppen').hidden && document.querySelector('.ws-spel').hidden"), 'E ✕ terug naar de keuze')
            q.close()
        ctx.close(); b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
klaar()
