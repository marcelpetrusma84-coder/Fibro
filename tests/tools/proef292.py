# proef292 (11 nov 2026): Pesten alleen via de Stekky Store. In de chat staat Pesten pas in het spelmenu als je de
# widget spel_pesten aan hebt (Profiel > Widgets, na downloaden in de Store; zie proef288 deel I).
#  A. Marcel heeft de widget aan: Pesten staat in het spelmenu, na Four in a Row, met het spelplaatje
#  B. Bram heeft hem niet: geen Pesten in zijn spelmenu
#  C. Marcel nodigt Bram uit voor Pesten: Bram kan toch meespelen (een uitnodiging mag je altijd aannemen)
# Gebruikt de nep-server van proef97 (het eerste stuk van dat bestand wordt hier ingelezen).
# python3 -I proef292.py <map>
import os, sys, json
HIER = os.path.dirname(os.path.abspath(__file__))
_bron = open(os.path.join(HIER, 'proef97.py'), encoding='utf-8').read()
exec(compile(_bron[:_bron.index('\nT97 = ')], 'proef97-basis', 'exec'))

def met_widgets(uid, widgets):
    def route(r):
        u = r.request.url
        if r.request.method == 'GET' and 'select=' in u and 'widgets' in u and uid in u:
            ik = {"id": uid, "username": NAAM[uid], "avatar_url": "\U0001F419", "avatar_data": None, "widgets": widgets}
            return r.fulfill(status=200, json=ik if 'vnd.pgrst.object' in (r.request.headers.get('accept') or '') else [ik])
        return r.fallback()
    return route
KNOPPEN = "() => [...document.querySelectorAll('#spelMenuGrid .spel-keuze-btn')].map(k => k.textContent.trim())"
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        cm, m, cb, b = start(br, 'nl')
        cm.route('**/rest/v1/profiles**', met_widgets(MARCEL, ['mood', 'spel_pesten']))
        cb.route('**/rest/v1/profiles**', met_widgets(BRAM, ['mood']))
        for pg in (m, b):
            pg.goto(BASIS + 'chat.html')
            if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", 15000): klik(pg, '#vriendenLijst .vriend-item')
        a = wacht(m, "() => !!document.getElementById('spelKnop-pesten')", 10000)
        knoppen = m.evaluate(KNOPPEN)
        check('A Marcel (widget aan): Pesten in het spelmenu, na Four in a Row', a and knoppen.index('Pesten') == knoppen.index('Four in a Row') + 1, knoppen)
        check('A het spelplaatje van Pesten', m.evaluate("() => (document.querySelector('#spelKnop-pesten img') || {}).getAttribute?.('src')") == 'spelicoon/pesten.webp?v=2')
        b.wait_for_timeout(1500)
        check('B Bram (geen widget): geen Pesten', 'Pesten' not in b.evaluate(KNOPPEN) and len(b.evaluate(KNOPPEN)) == 12, b.evaluate(KNOPPEN))
        # C: Marcel start Pesten via de knop (zoals een tik in het menu); Bram neemt de uitnodiging aan
        sessie = m.evaluate("Date.now().toString(36)")
        for pg in (m, b): ev(pg, "([s, n, u]) => { window.speelMee(s, n, u) }", ['pesten', sessie, MARCEL])
        for pg in (m, b):
            if wacht(pg, "() => !!document.querySelector('.fibro-titelscherm')", 6000): pg.wait_for_timeout(600); pg.mouse.click(195, 420)
        klaar = "() => document.querySelectorAll('.kt-hand .kt-kaart').length === 7"
        check('C Bram speelt mee zonder widget (7 kaarten bij allebei)', wacht(m, klaar, 20000) and wacht(b, klaar, 20000))
        check('geen paginafouten', not fouten, fouten[:3])
        br.close()
finally:
    srv.terminate()
sys.exit(0 if all(uitslag) else 1)
