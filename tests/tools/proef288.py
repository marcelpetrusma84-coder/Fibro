# proef288 (10 nov 2026, v131): de Stekky Store (store.html, store.js). Sinds 11 nov 2026 voor iedereen met een account.
#  A. Stijl (profiel.html) als moderator: het laatste vakje in de balk is Store; tik erop = store.html
#  B. Stijl als gewone gebruiker: ook het Store-vakje (sinds 11 nov 2026)
#  C. Store als moderator (v2, 11 nov): negen lettertype-pakketten per thema, elk met 4 lettertypes in hun eigen letter;
#     Downloaden = één rij in store_downloads (in je account) en de knop wordt "✓ Gedownload";
#     Games/Stickers/Widgets: "komen binnenkort"
#  D. Terug bij Stijl > Lettertype: alle 4 lettertypes van het pakket staan erbij (met "· Store"), een ander niet;
#     een oud los gedownload lettertype (v1, lettertype-special-elite) staat er ook nog bij
#  E. Weghalen in de store = de rij gaat weg uit je account
#  F. Store als gewone gebruiker: open; staat de database nog op 'alleen moderators', dan een duidelijke melding;
#     na sql/stekky-store-iedereen.sql kan downloaden wel. Zonder account: "Geen toegang".
#  G. Staat de tabel er nog niet (sql/stekky-store.sql niet uitgevoerd): een duidelijke melding, geen vastloper
#  I. (11 nov 2026) Games: Pesten staat in de store; vóór downloaden niet bij Profiel > Widgets, erna wel (aan te zetten);
#     🗑 bij de widget = verwijderd: uit je account, de widget uit en weg (ook van Home)
#  J. (11 nov 2026) Stijl > Lettertype > Uit de Store: gedownloade pakketten met Verwijderen
#  K. (11 nov 2026) De zwarte balk "Stekky Store" blijft bovenin staan tijdens scrollen; de paarse balk (zoals Profiel)
#     heeft Games, Widgets, Stickers, Achtergronden en Lettertypes; Games staat eerst aan
#  H. geen paginafouten
# python3 -I proef288.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, urllib.parse
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
STAND = {'mod': True, 'rijen': set(), 'geen_tabel': False, 'verzoeken': [], 'iedereen': False}

def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=STAND['mod'])
    if '/rest/v1/store_downloads' in u:
        STAND['verzoeken'].append(m)
        if STAND['geen_tabel']:
            return route.fulfill(status=404, json={'code': 'PGRST205', 'message': "Could not find the table 'public.store_downloads' in the schema cache"})
        if m == 'GET': return route.fulfill(status=200, json=[{'item_id': i} for i in sorted(STAND['rijen'])])
        if m == 'POST':
            r = json.loads(route.request.post_data or '{}')
            if not (STAND['mod'] or STAND['iedereen']) or r.get('user_id') != UID: return route.fulfill(status=403, json={'code': '42501', 'message': 'rls'})
            STAND['rijen'].add(r['item_id']); return route.fulfill(status=201, body='')
        if m == 'DELETE':
            q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
            item = (q.get('item_id') or ['eq.'])[0][3:]
            STAND['rijen'].discard(item); return route.fulfill(status=204, body='')
    if '/rest/v1/profiles' in u and m == 'GET':
        rij = {"id": UID, "username": "Marcel", "is_moderator": STAND['mod'], "lettertype": None}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=rij)
        return route.fulfill(status=200, json=[rij])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    return route.fulfill(status=200, json=[])

www = tempfile.mkdtemp(prefix='proef288_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
def nieuw(b):
    ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844})
    ctx.route('**/*supabase.co/**', supa)
    ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())   # 11 nov 2026: 'verwijderen?' met OK beantwoorden
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
    return ctx, pg
def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
LAATSTE = "() => { const t = [...document.querySelectorAll('.profile-nav .main-tab')].filter(b => getComputedStyle(b).display !== 'none'); return t.length ? t[t.length - 1].id : null }"
FONTS = "() => [...document.querySelectorAll('#fontGrid .font-item')].map(d => d.dataset.font + '|' + d.querySelector('.font-name').textContent)"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        # ── A ──
        ctx, pg = nieuw(b)
        pg.goto(BASIS + 'profiel.html')
        a1 = wacht(pg, "() => { const s = document.getElementById('tab-store'); return s && getComputedStyle(s).display !== 'none' }")
        check(a1 and pg.evaluate(LAATSTE) == 'tab-store', 'A: moderator: het laatste vakje bij Stijl is Store (%s)' % pg.evaluate(LAATSTE))
        check(pg.inner_text('#tab-store').strip() == 'Store', 'A: het vakje heet Store')
        pg.click('#tab-store')
        check(wacht(pg, "() => location.pathname.endsWith('/store.html')"), 'A: tik op Store = de Stekky Store')
        # ── K: zwarte balk + paarse balk ──
        k1 = wacht(pg, "() => !!document.getElementById('storeNav') && getComputedStyle(document.getElementById('storeNav')).display !== 'none' && !!document.querySelector('#lijst .item[data-id=\"pesten\"]')")
        tabs = pg.evaluate("() => [...document.querySelectorAll('#storeNav .main-tab')].map(b => b.dataset.soort + (b.classList.contains('active') ? '*' : ''))")
        check(k1 and tabs == ['game*', 'widget', 'sticker', 'achtergrond', 'lettertype'], 'K: paarse balk met 5 soorten, Games eerst aan (%s)' % tabs)
        kleur = pg.evaluate("() => { const b = document.querySelector('.top-bar'), t = b.querySelector('.titel'); return [b.textContent.trim(), getComputedStyle(t).color, getComputedStyle(b.parentElement).position] }")
        check(kleur == ['Stekky Store', 'rgb(255, 255, 255)', 'sticky'], 'K: zwarte balk met witte tekst Stekky Store (%s)' % kleur)
        pg.click('#soorten .main-tab[data-soort="achtergrond"]')
        check(wacht(pg, "() => document.querySelector('#lijst').textContent.includes('Achtergronden komen binnenkort')"), 'K: Achtergronden: komen binnenkort')
        pg.click('#soorten .main-tab[data-soort="lettertype"]')
        wacht(pg, "() => document.querySelectorAll('#lijst .item').length === 9")
        pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(300)
        bovenin = pg.evaluate("() => { const r = document.querySelector('.top-bar').getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return [window.scrollY > 200, r.top >= 0 && r.top < 20, document.querySelector('.top-bar').contains(document.elementFromPoint(x, y))] }")
        check(bovenin == [True, True, True], 'K: na scrollen staat de zwarte balk nog bovenin, boven de rest (%s)' % bovenin)
        pg.evaluate("window.scrollTo(0, 0)")
        # ── C ──
        c1 = wacht(pg, "() => document.querySelectorAll('#lijst .item').length === 9")
        namen = pg.evaluate("() => [...document.querySelectorAll('#lijst .item-titel')].map(e => e.textContent)")
        check(c1 and namen == ['Retro', 'Sci-fi', 'Cowboy', 'Prinses', 'Urban', 'Horror', 'Strip', 'Geheim agent', 'Ridders & draken'],
              'C: negen pakketten in de store (%s)' % namen)
        regels = pg.evaluate("() => [...document.querySelectorAll('#lijst .item')].map(k => k.querySelectorAll('.item-regel').length)")
        check(regels == [4] * 9, 'C: elk pakket heeft 4 lettertypes (%s)' % regels)
        strip = pg.evaluate("() => [...document.querySelectorAll('#lijst .item[data-id=\"pakket-strip\"] .item-regel')].map(e => e.textContent + '|' + e.style.fontFamily)")
        check(strip[0].startswith('Superheld|') and 'Luckiest Guy' in strip[0], 'C: elke regel in zijn eigen letter (%s)' % strip[:2])
        geladen = wacht(pg, "() => document.fonts.check(\"16px 'Luckiest Guy'\") && document.fonts.check(\"16px 'Princess Sofia'\") && document.fonts.check(\"16px 'Smokum'\")", 8000)
        check(geladen, 'C: de lettertypes worden echt geladen (Luckiest Guy, Princess Sofia, Smokum)')
        knop = '#lijst .item[data-id="pakket-strip"] .knop'
        check(pg.inner_text(knop) == 'Downloaden', 'C: knop Downloaden')
        pg.click(knop)
        c2 = wacht(pg, "() => { const k = document.querySelector('#lijst .item[data-id=\"pakket-strip\"] .knop'); return k && k.textContent === '✓ Gedownload' }")
        check(c2 and STAND['rijen'] == {'pakket-strip'}, 'C: Downloaden = één rij in je account, knop "✓ Gedownload" (%s)' % STAND['rijen'])
        check('Stijl → Lettertype' in pg.inner_text('#melding'), 'C: melding waar je het kunt kiezen')
        # ── I (11 nov 2026): Pesten in de store ──
        pg.goto(BASIS + 'profiel.html'); pg.click('#tab-widgets') if pg.query_selector('#tab-widgets') else None
        wacht(pg, "() => !!document.getElementById('widgetRij-spel_pesten')"); pg.wait_for_timeout(800)
        check(pg.evaluate("getComputedStyle(document.getElementById('widgetRij-spel_pesten')).display") == 'none', 'I: vóór downloaden: Pesten niet bij de widgets')
        pg.goto(BASIS + 'store.html'); wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=\"pesten\"]')")
        pg.click('#soorten .main-tab[data-soort="game"]')
        i1 = wacht(pg, "() => !!document.querySelector('#lijst .item[data-id=\"pesten\"] img[src*=\"spelicoon/pesten.webp\"]')", 4000)
        check(i1 and 'Pesten' in pg.inner_text('#lijst') and 'Laatste kaart' in pg.inner_text('#lijst'), 'I: Games: Pesten met plaatje en uitleg (%r)' % pg.inner_text('#lijst')[:80])
        pg.click('#lijst .item[data-id="pesten"] .knop')
        i2 = wacht(pg, "() => { const k = document.querySelector('#lijst .item[data-id=\"pesten\"] .knop'); return k && k.textContent === '✓ Gedownload' }")
        check(i2 and 'pesten' in STAND['rijen'] and 'Widgets' in pg.inner_text('#melding'), 'I: Downloaden = rij in je account en melding: zet hem aan bij Widgets (%s)' % STAND['rijen'])
        pg.goto(BASIS + 'profiel.html')
        i3 = wacht(pg, "() => { const r = document.getElementById('widgetRij-spel_pesten'); return r && getComputedStyle(r).display !== 'none' }", 8000)
        check(i3, 'I: na downloaden: Pesten bij Profiel > Widgets > Spellen')
        pg.evaluate("toggleWidget('spel_pesten')")
        check(pg.evaluate("document.getElementById('widget-spel_pesten').classList.contains('on')"), 'I: de widget gaat aan')
        # 🗑 bij de widget: verwijderen (de widget staat aan en staat al op Home)
        pg.evaluate("""() => { const uid = 'aaaaaaaa-0000-4000-8000-000000000001'
            localStorage.setItem('fibro_widgets_profiel_' + uid, JSON.stringify([{ id: 'mood', aan: true, volgorde: 0 }, { id: 'spel_pesten', aan: true, volgorde: 1 }])) }""")
        pg.click('#tab-widgets')
        pg.click('#widgetRij-spel_pesten .store-verwijder')
        i4 = wacht(pg, "() => getComputedStyle(document.getElementById('widgetRij-spel_pesten')).display === 'none'", 5000)
        layout = pg.evaluate("() => JSON.parse(localStorage.getItem('fibro_widgets_profiel_aaaaaaaa-0000-4000-8000-000000000001')).map(w => w.id)")
        check(i4 and 'pesten' not in STAND['rijen'] and layout == ['mood'] and not pg.evaluate("document.getElementById('widget-spel_pesten').classList.contains('on')"),
              'I: 🗑 bij Widgets = verwijderd: uit je account, widget uit en weg van Home (%s, %s)' % (STAND['rijen'], layout))
        check(not pg.evaluate("document.body.dataset.widgetsUnsaved === 'true'"), 'I: daarna geen vraag om op te slaan')
        pg.goto(BASIS + 'store.html'); wacht(pg, "() => !!document.querySelector('#lijst .item')")
        # ── D ──
        STAND['rijen'].add('lettertype-special-elite')  # oude losse download uit v1
        pg.click('.terug')
        check(wacht(pg, "() => location.pathname.endsWith('/profiel.html')"), 'D: ← terug = Stijl')
        wacht(pg, "() => document.querySelectorAll('#fontGrid .font-item').length > 38")
        pg.wait_for_timeout(800)
        lijst = pg.evaluate(FONTS)
        verwacht = ['Luckiest Guy|Superheld · Store', 'Bubblegum Sans|Kauwgom · Store', 'Bangers|Stripheld · Store', 'Gloria Hallelujah|Kinderhand · Store']
        check(all(v in lijst for v in verwacht), 'D: alle 4 lettertypes van Strip staan bij Lettertype, met "· Store" (%s)' % lijst[-5:])
        check('Special Elite|Oude typemachine · Store' in lijst, 'D: het oude losse lettertype (Special Elite) staat er nog')
        check(not any(x.startswith(('Sacramento|', 'Smokum|', 'Stardos Stencil|')) for x in lijst), 'D: lettertypes uit niet-gedownloade pakketten staan er niet bij')
        # ── J: Uit de Store, met Verwijderen ──
        pg.click('#tab-lettertype') if pg.query_selector('#tab-lettertype') else None
        namen = pg.evaluate("() => [...document.querySelectorAll('#storeFontsLijst .store-rij .store-naam')].map(e => e.textContent)")
        check(sorted(namen) == sorted(['Strip', 'Oude typemachine']), 'J: Uit de Store: de gedownloade pakketten (%s)' % namen)
        pg.click('#storeFontsLijst .store-rij[data-id="pakket-strip"] .store-verwijder')
        j1 = wacht(pg, "() => !document.querySelector('#storeFontsLijst .store-rij[data-id=\"pakket-strip\"]')", 5000)
        check(j1 and 'pakket-strip' not in STAND['rijen'] and not any(x.startswith('Luckiest Guy|') for x in pg.evaluate(FONTS)),
              'J: Verwijderen = uit je account en de lettertypes van Strip weg (%s)' % STAND['rijen'])
        STAND['rijen'].add('pakket-strip')   # voor E (verwijderen in de store)
        STAND['rijen'].discard('lettertype-special-elite')
        # ── E ──
        pg.goto(BASIS + 'store.html'); wacht(pg, "() => !!document.querySelector('#lijst .item')"); pg.click('#soorten .main-tab[data-soort="lettertype"]'); 
        wacht(pg, "() => document.querySelector('#lijst .item[data-id=\"pakket-strip\"] .weghalen')")
        check(pg.inner_text('#lijst .item[data-id="pakket-strip"] .weghalen') == '🗑 Verwijderen', 'E: knop heet 🗑 Verwijderen')
        pg.click('#lijst .item[data-id="pakket-strip"] .weghalen')
        e1 = wacht(pg, "() => { const k = document.querySelector('#lijst .item[data-id=\"pakket-strip\"] .knop'); return k && k.textContent === 'Downloaden' }")
        check(e1 and STAND['rijen'] == set() and 'DELETE' in STAND['verzoeken'], 'E: Verwijderen (na de vraag) = uit je account (%s)' % STAND['rijen'])
        ctx.close()
        # ── G ──
        STAND['geen_tabel'] = True
        ctx, pg = nieuw(b)
        pg.goto(BASIS + 'store.html')
        g1 = wacht(pg, "() => document.getElementById('melding').style.display === 'block'")
        pg.click('#soorten .main-tab[data-soort="lettertype"]'); 
        check(g1 and 'sql/stekky-store.sql' in pg.inner_text('#melding') and pg.evaluate("document.querySelectorAll('#lijst .item').length") == 9,
              'G: tabel ontbreekt: duidelijke melding, de store staat er wel (%r)' % pg.inner_text('#melding'))
        ctx.close()
        STAND['geen_tabel'] = False
        # ── B + F ──
        STAND['mod'] = False; STAND['verzoeken'] = []
        ctx, pg = nieuw(b)
        pg.goto(BASIS + 'profiel.html')
        wacht(pg, "() => document.querySelectorAll('#fontGrid .font-item').length >= 38")
        pg.wait_for_timeout(1500)
        check(pg.evaluate(LAATSTE) == 'tab-store', 'B: gewone gebruiker: ook het Store-vakje (laatste: %s)' % pg.evaluate(LAATSTE))
        pg.goto(BASIS + 'store.html')
        f1 = wacht(pg, "() => getComputedStyle(document.getElementById('inhoud')).display === 'block' && !!document.querySelector('#lijst .item[data-id=\"pesten\"]')")
        check(f1, 'F: gewone gebruiker: de store is open')
        pg.click('#soorten .main-tab[data-soort="game"]'); pg.click('#lijst .item[data-id="pesten"] .knop')
        f2 = wacht(pg, "() => document.getElementById('melding').style.display === 'block'")
        check(f2 and 'alleen open voor moderators' in pg.inner_text('#melding') and 'pesten' not in STAND['rijen'],
              'F: database nog op alleen moderators: duidelijke melding (%r)' % pg.inner_text('#melding'))
        STAND['iedereen'] = True   # sql/stekky-store-iedereen.sql uitgevoerd
        pg.click('#lijst .item[data-id="pesten"] .knop')
        f3 = wacht(pg, "() => { const k = document.querySelector('#lijst .item[data-id=\"pesten\"] .knop'); return k && k.textContent === '✓ Gedownload' }")
        check(f3 and 'pesten' in STAND['rijen'], 'F: daarna kan een gewone gebruiker Pesten downloaden')
        ctx.close()
        # zonder account: geen toegang
        ctx = b.new_context(service_workers='block', locale='nl-NL'); ctx.route('**/*supabase.co/**', supa)
        pg = ctx.new_page(); pg.goto(BASIS + 'store.html')
        check(wacht(pg, "() => getComputedStyle(document.getElementById('toegangGeweigerd')).display === 'block'"), 'F: zonder account: Geen toegang')
        ctx.close()
        b.close()
finally:
    srv.terminate()
check(not fouten, 'H: geen paginafouten (%s)' % fouten[:3])
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
