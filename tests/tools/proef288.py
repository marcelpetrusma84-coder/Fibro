# proef288 (10 nov 2026, v131): de Stekky Store (store.html, store.js), voorlopig alleen voor moderators.
#  A. Stijl (profiel.html) als moderator: het laatste vakje in de balk is Store; tik erop = store.html
#  B. Stijl als gewone gebruiker: geen Store-vakje
#  C. Store als moderator: zes lettertypes, elk in zijn eigen letter; Downloaden = een rij in store_downloads
#     (in je account) en de knop wordt "✓ Gedownload"; Games/Stickers/Widgets: "komen binnenkort"
#  D. Terug bij Stijl > Lettertype: het gedownloade lettertype staat erbij (met "· Store"), een ander store-lettertype niet
#  E. Weghalen in de store = de rij gaat weg uit je account
#  F. Store als gewone gebruiker: "Geen toegang", niets geladen of gedownload
#  G. Staat de tabel er nog niet (sql/stekky-store.sql niet uitgevoerd): een duidelijke melding, geen vastloper
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
STAND = {'mod': True, 'rijen': set(), 'geen_tabel': False, 'verzoeken': []}

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
            if not STAND['mod'] or r.get('user_id') != UID: return route.fulfill(status=403, json={'code': '42501', 'message': 'rls'})
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
    pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
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
        # ── C ──
        c1 = wacht(pg, "() => document.querySelectorAll('#lijst .item').length === 6")
        namen = pg.evaluate("() => [...document.querySelectorAll('#lijst .item-naam')].map(e => e.textContent)")
        check(c1 and namen == ['Stripheld', 'Leger', 'Krantenkop', 'Sierlijk', 'Kinderhand', 'Oude typemachine'], 'C: zes lettertypes in de store (%s)' % namen)
        geladen = wacht(pg, "() => document.fonts.check(\"16px 'Bangers'\") && document.fonts.check(\"16px 'Special Elite'\")", 8000)
        check(geladen, 'C: de lettertypes worden echt geladen (Bangers, Special Elite)')
        knop = '#lijst .item[data-id="lettertype-bangers"] .knop'
        check(pg.inner_text(knop) == 'Downloaden', 'C: knop Downloaden')
        pg.click(knop)
        c2 = wacht(pg, "() => { const k = document.querySelector('#lijst .item[data-id=\"lettertype-bangers\"] .knop'); return k && k.textContent === '✓ Gedownload' }")
        check(c2 and STAND['rijen'] == {'lettertype-bangers'}, 'C: Downloaden = bewaard in je account, knop "✓ Gedownload" (%s)' % STAND['rijen'])
        check('Stijl → Lettertype' in pg.inner_text('#melding'), 'C: melding waar je het kunt kiezen')
        pg.click('.soort[data-soort="game"]')
        check('komen binnenkort' in pg.inner_text('#lijst'), 'C: Games: komen binnenkort (%r)' % pg.inner_text('#lijst'))
        # ── D ──
        pg.click('.terug')
        check(wacht(pg, "() => location.pathname.endsWith('/profiel.html')"), 'D: ← terug = Stijl')
        wacht(pg, "() => document.querySelectorAll('#fontGrid .font-item').length > 38")
        pg.wait_for_timeout(800)
        lijst = pg.evaluate(FONTS)
        check('Bangers|Stripheld · Store' in lijst, 'D: Bangers staat bij Lettertype, met "· Store" (%s)' % lijst[-3:])
        check(not any(x.startswith('Sacramento|') for x in lijst), 'D: een niet-gedownload store-lettertype staat er niet bij')
        # ── E ──
        pg.goto(BASIS + 'store.html')
        wacht(pg, "() => document.querySelector('#lijst .item[data-id=\"lettertype-bangers\"] .weghalen')")
        pg.click('#lijst .item[data-id="lettertype-bangers"] .weghalen')
        e1 = wacht(pg, "() => { const k = document.querySelector('#lijst .item[data-id=\"lettertype-bangers\"] .knop'); return k && k.textContent === 'Downloaden' }")
        check(e1 and STAND['rijen'] == set() and 'DELETE' in STAND['verzoeken'], 'E: Weghalen = uit je account (%s)' % STAND['rijen'])
        ctx.close()
        # ── G ──
        STAND['geen_tabel'] = True
        ctx, pg = nieuw(b)
        pg.goto(BASIS + 'store.html')
        g1 = wacht(pg, "() => document.getElementById('melding').style.display === 'block'")
        check(g1 and 'sql/stekky-store.sql' in pg.inner_text('#melding') and pg.evaluate("document.querySelectorAll('#lijst .item').length") == 6,
              'G: tabel ontbreekt: duidelijke melding, de store staat er wel (%r)' % pg.inner_text('#melding'))
        ctx.close()
        STAND['geen_tabel'] = False
        # ── B + F ──
        STAND['mod'] = False; STAND['verzoeken'] = []
        ctx, pg = nieuw(b)
        pg.goto(BASIS + 'profiel.html')
        wacht(pg, "() => document.querySelectorAll('#fontGrid .font-item').length >= 38")
        pg.wait_for_timeout(1500)
        check(pg.evaluate("getComputedStyle(document.getElementById('tab-store')).display") == 'none' and pg.evaluate(LAATSTE) == 'tab-stickers',
              'B: gewone gebruiker: geen Store-vakje (laatste: %s)' % pg.evaluate(LAATSTE))
        pg.goto(BASIS + 'store.html')
        f1 = wacht(pg, "() => getComputedStyle(document.getElementById('toegangGeweigerd')).display === 'block'")
        check(f1 and pg.evaluate("getComputedStyle(document.getElementById('inhoud')).display") == 'none', 'F: store als gewone gebruiker: Geen toegang')
        check(STAND['verzoeken'] == [], 'F: gewone gebruiker: niets opgevraagd of gedownload (%s)' % STAND['verzoeken'])
        ctx.close()
        b.close()
finally:
    srv.terminate()
check(not fouten, 'H: geen paginafouten (%s)' % fouten[:3])
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
