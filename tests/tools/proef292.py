# proef292 (11 nov 2026): Pesten alleen via de Stekky Store. In de chat staat Pesten pas in het spelmenu als je hem
# gedownload hebt EN de widget spel_pesten aan hebt (Profiel > Widgets; zie proef288 deel I). v2: de widgets staan op
# het toestel (fibro_widgets_profiel_<id>), niet op de server; de downloads komen uit store_downloads.
#  A. Marcel heeft de download en de widget aan: Pesten staat in het spelmenu, na Four in a Row, met het spelplaatje
#  B. Bram heeft hem niet: geen Pesten in zijn spelmenu
#  C. Marcel nodigt Bram uit voor Pesten: Bram kan toch meespelen (een uitnodiging mag je altijd aannemen)
#  D. Verwijderd (download weg, widget uit): bij het openen van het spelmenu is Pesten weg
# Gebruikt de nep-server van proef97 (het eerste stuk van dat bestand wordt hier ingelezen).
# python3 -I proef292.py <map>
import os, sys, json
HIER = os.path.dirname(os.path.abspath(__file__))
_bron = open(os.path.join(HIER, 'proef97.py'), encoding='utf-8').read()
exec(compile(_bron[:_bron.index('\nT97 = ')], 'proef97-basis', 'exec'))

DOWNLOADS = {}
def met_downloads(uid):
    def route(r):
        if r.request.method == 'GET': return r.fulfill(status=200, json=[{'item_id': i} for i in DOWNLOADS.get(uid, [])])
        return r.fallback()
    return route
def zet_toestel(pg, uid, downloads, widgets):
    pg.evaluate("""([uid, d, w]) => { localStorage.setItem('fibro_store_' + uid, JSON.stringify(d))
        localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify(w.map((id, i) => ({ id, aan: true, volgorde: i })))) }""", [uid, downloads, widgets])
KNOPPEN = "() => [...document.querySelectorAll('#spelMenuGrid .spel-keuze-btn')].map(k => k.textContent.trim())"
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        cm, m, cb, b = start(br, 'nl')
        DOWNLOADS[MARCEL] = ['pesten']; DOWNLOADS[BRAM] = []
        cm.route('**/rest/v1/store_downloads**', met_downloads(MARCEL)); cb.route('**/rest/v1/store_downloads**', met_downloads(BRAM))
        zet_toestel(m, MARCEL, ['pesten'], ['mood', 'spel_pesten'])
        zet_toestel(b, BRAM, ['pesten'], ['mood'])   # Bram heeft hem wel gedownload, maar de widget staat uit
        for pg in (m, b):
            pg.goto(BASIS + 'chat.html')
            if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", 15000): klik(pg, '#vriendenLijst .vriend-item')
        a = wacht(m, "() => !!document.getElementById('spelKnop-pesten')", 10000)
        knoppen = m.evaluate(KNOPPEN)
        check('A Marcel (widget aan): Pesten in het spelmenu, na Four in a Row', a and knoppen.index('Pesten') == knoppen.index('Four in a Row') + 1, knoppen)
        check('A het spelplaatje van Pesten', m.evaluate("() => (document.querySelector('#spelKnop-pesten img') || {}).getAttribute?.('src')") == 'spelicoon/pesten.webp?v=2')
        b.wait_for_timeout(1500)
        check('B Bram (gedownload, widget uit): geen Pesten', 'Pesten' not in b.evaluate(KNOPPEN) and len(b.evaluate(KNOPPEN)) == 12, b.evaluate(KNOPPEN))
        # C: Marcel start Pesten via de knop (zoals een tik in het menu); Bram neemt de uitnodiging aan
        sessie = m.evaluate("Date.now().toString(36)")
        for pg in (m, b): ev(pg, "([s, n, u]) => { window.speelMee(s, n, u) }", ['pesten', sessie, MARCEL])
        for pg in (m, b):
            if wacht(pg, "() => !!document.querySelector('.fibro-titelscherm')", 6000): pg.wait_for_timeout(600); pg.mouse.click(195, 420)
        klaar = "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 7"
        check('C Bram speelt mee zonder widget (7 kaarten bij allebei)', wacht(m, klaar, 20000) and wacht(b, klaar, 20000))
        # D: Marcel verwijdert Pesten (zoals in de Store of bij Widgets): download weg en widget uit
        for pg in (m, b): pg.evaluate("window.sluitSpel && window.sluitSpel(true)")
        DOWNLOADS[MARCEL] = []
        m.evaluate("""async uid => { const s = await import('./store.js?v=6'); localStorage.setItem('fibro_store_' + uid, '[]'); s.zetGameWidgetUit(uid, 'spel_pesten') }""", MARCEL)
        m.evaluate("window.toggleSpelMenu()")
        check('D na verwijderen: geen Pesten meer in het spelmenu', wacht(m, "() => !document.getElementById('spelKnop-pesten')", 4000), m.evaluate(KNOPPEN))
        check('geen paginafouten', not fouten, fouten[:3])
        br.close()
finally:
    srv.terminate()
sys.exit(0 if all(uitslag) else 1)
