# proef359 (28 nov 2026, Marcel): "ik heb de casino-widget gedownload maar ik zie hem niet in mijn widgetlijst".
# Profiel > Widgets had alleen vaste rijen (Radio, RSS, ...); widgets uit widgets.js (Casino, Scorebord) kregen er geen.
# En Opslaan daar haalde Casino zelfs van Home, omdat Profiel hem niet kende.
#  A. Casino gedownload en op Home: bij Profiel > Widgets staat een rij Casino (🎰), met de schakelaar aan en 🗑
#  B. Scorebord niet gedownload: geen rij
#  C. Opslaan: Casino blijft op Home
#  D. de schakelaar uit + Opslaan: Casino gaat van Home; geen paginafouten
# Op de oude versie mislukken A en C.
# python3 -I proef359.py <map>
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from proefhulp import *
from playwright.sync_api import sync_playwright
UID = 'aaaaaaaa-0000-4000-8000-000000000359'
def supabase(route, u, body):
    m = route.request.method
    if '/rest/v1/store_downloads' in u and m == 'GET': return route.fulfill(status=200, json=[{'item_id': 'casino'}])
    if '/rest/v1/profiles' in u and m == 'GET':
        rij = {'id': UID, 'username': 'Marcel', 'is_moderator': False}
        return route.fulfill(status=200, json=rij if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [rij])
    if '/auth/v1/user' in u: return route.fulfill(status=200, json=sessie(UID)['user'])
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
def peil(pg, js, ms=12000):   # met evaluate (de pagina's houden eval tegen, dus geen wait_for_function)
    for _ in range(ms // 150):
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        pg.wait_for_timeout(150)
    return False
LAYOUT = "() => JSON.parse(localStorage.getItem('fibro_widgets_profiel_%s') || '[]').filter(w => w.aan).map(w => w.id)" % UID
try:
    with sync_playwright() as p:
        b = browser(p)
        ctx = context(b)
        nep_supabase(ctx, supabase)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        inloggen(ctx, sessie(UID), extra={
            'fibro_opslagtip_later': str(10 ** 13), 'fibro_eigennaam_gevraagd_' + UID: '1', 'fibro_store_' + UID: ['casino'],
            'fibro_widgets_profiel_' + UID: [{'id': 'mood', 'icon': '😊', 'titel': 'Mood', 'w': 4, 'h': 1, 'volgorde': 0, 'aan': True},
                                             {'id': 'casino', 'icon': '🎰', 'titel': 'Casino', 'w': 4, 'h': 3, 'volgorde': 1, 'aan': True}]})
        pg = nieuwe_pagina(ctx, 'profiel')
        pg.on('dialog', lambda d: d.accept())
        pg.goto(BASIS + 'profiel.html')
        check(peil(pg, "() => { const r = document.getElementById('widgetRij-casino'); return !!r && r.style.display !== 'none' }"), 'A er is een rij Casino bij de widgets')
        if pg.locator('#widgetRij-casino').count():
            rij = pg.inner_text('#widgetRij-casino')
            check('Casino' in rij and '🎰' in rij, 'A met 🎰 en de naam (%s)' % rij.replace('\n', ' '))
            check(pg.locator('#widget-casino.on').count() == 1 and pg.locator('#widgetRij-casino .store-verwijder').count() == 1, 'A de schakelaar staat aan, met 🗑')
        check(pg.evaluate("() => { const r = document.getElementById('widgetRij-scorebord'); return !r || r.style.display === 'none' }"), 'B Scorebord (niet gedownload): geen rij')
        knop = pg.locator('button', has_text='Opslaan').first
        knop.click(); pg.wait_for_timeout(1200)
        check('casino' in pg.evaluate(LAYOUT), 'C na Opslaan staat Casino nog op Home (%s)' % pg.evaluate(LAYOUT))
        if pg.locator('#widget-casino').count():
            pg.evaluate("() => document.getElementById('widget-casino').click()"); knop.click(); pg.wait_for_timeout(1200)
            check('casino' not in pg.evaluate(LAYOUT), 'D schakelaar uit + Opslaan: Casino gaat van Home (%s)' % pg.evaluate(LAYOUT))
        else:
            check(False, 'D geen schakelaar')
        b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
klaar()
