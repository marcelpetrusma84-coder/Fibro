# proef295 (13 nov 2026): stickervel 7, Sinterklaas, het eerste stickervel uit de Stekky Store.
#  A. Store > Stickers: Sinterklaas staat erin, met 12 stickers; tik op een sticker = hij beweegt en zijn geluid
#     (geluiden/<naam>.mp3) wordt opgehaald
#  B. Downloaden = een rij 'stickers-sinterklaas' in store_downloads en de melding waar je ze vindt
#  C. Stickerkeuze (chat): zonder download is Winkelvak 1 leeg (met uitleg); met download staat Sinterklaas erin,
#     met 12 stickers; tik = de sticker gaat mee als f7-xx
#  C2 (13 nov 2026, Marcel): na downloaden staat het vel eerst UIT; bij Stijl > Stickers zet je het aan (dan staat
#     het in Winkelvak 1), uit (dan is het weg) of verwijder je het
#  D. Verwijderen in de Store: weg uit je account en uit de stickerkeuze; een ontvangen f7-sticker blijft te zien
#  E. geen paginafouten
# python3 -I proef295.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, urllib.parse
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
RIJEN = set()
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/store_downloads' in u:
        if m == 'GET': return route.fulfill(status=200, json=[{'item_id': i} for i in sorted(RIJEN)])
        if m == 'POST': RIJEN.add(json.loads(route.request.post_data or '{}').get('item_id')); return route.fulfill(status=201, body='')
        if m == 'DELETE':
            q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query); RIJEN.discard((q.get('item_id') or ['eq.'])[0][3:])
            return route.fulfill(status=204, body='')
    if '/rest/v1/profiles' in u and m == 'GET':
        rij = {"id": UID, "username": "Marcel", "is_moderator": False}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=rij)
        return route.fulfill(status=200, json=[rij])
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    return route.fulfill(status=200, json=[])

www = tempfile.mkdtemp(prefix='proef295_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []; geluiden = []
def wacht(pg, js, ms=15000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
# De stickerkeuze los op een lege pagina (zoals in de chat): kiezen = window.gekozen
KEUZE = """async uid => { document.body.innerHTML = '<div id="k" style="width:390px"></div>'
  const m = await import('./stickerkeuze.js?v=238'); window.gekozen = []
  window.keuze = m.maakStickerkeuze(document.getElementById('k'), { uid: () => uid, onKies: st => window.gekozen.push(st.vel + '-' + st.nr) }) }"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', supa)
        ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
        pg.on('request', lambda r: geluiden.append(r.url.split('/geluiden/')[1].split('.mp3')[0]) if '/geluiden/' in r.url else None)
        pg.goto(BASIS + 'manifest.json')
        pg.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)

        # ── C (zonder download) ──
        pg.evaluate(KEUZE, UID)
        pg.click('.sk-vak[data-vak=w1]')
        check(pg.locator('.sk-vak[data-vak=w1] img').count() == 0 and 'Stekky Store' in pg.inner_text('.sk-inhoud'), 'C: zonder download is Winkelvak 1 leeg, met uitleg over de Store')

        # ── A ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=sticker]')
        check(wacht(pg, "() => document.querySelector('.item[data-id=\"stickers-sinterklaas\"]')"), 'A: Sinterklaas staat bij Stickers in de Store')
        kaart = '.item[data-id="stickers-sinterklaas"]'
        check(pg.locator(kaart + ' .item-sticker img').count() == 12 and '12 stickers' in pg.inner_text(kaart), 'A: met alle 12 stickers')
        check(wacht(pg, "() => [...document.querySelectorAll('.item-sticker img')].every(i => i.complete && i.naturalWidth === 384)", 8000), 'A: de plaatjes laden (384 px)')
        pg.locator(kaart + ' .item-sticker').nth(4).click()
        check(wacht(pg, "() => document.querySelectorAll('.item-sticker img')[4].getAnimations().length > 0", 3000), 'A: tik = de sticker beweegt')
        check(wacht(pg, "() => true", 100) and (time.sleep(0.6) or 'stoomfluit' in geluiden), 'A: en zijn geluid wordt opgehaald (stoomfluit.mp3) %s' % geluiden[-3:])

        # ── B ──
        pg.click(kaart + ' .knop')
        check(wacht(pg, "() => document.querySelector('.item[data-id=\"stickers-sinterklaas\"] .knop').textContent.includes('Gedownload')"), 'B: gedownload')
        check(RIJEN == {'stickers-sinterklaas'}, 'B: een rij in store_downloads (%s)' % RIJEN)
        check('Stijl → Stickers' in pg.inner_text('#melding'), 'B: de melding zegt waar je ze aanzet (%s)' % pg.inner_text('#melding'))

        # ── C2: eerst uit; aanzetten bij Stijl > Stickers ──
        pg.goto(BASIS + 'manifest.json'); pg.evaluate(KEUZE, UID)
        check(pg.locator('.sk-vak[data-vak=w1] img').count() == 0, 'C2: na downloaden staat het nog niet in de chat')
        def stijl():
            pg.goto(BASIS + 'profiel.html'); pg.wait_for_selector('#tab-stickers', timeout=15000)
            pg.click('#tab-stickers')
            return wacht(pg, "() => { const s = document.getElementById('storeStickersSectie'); return s && s.style.display !== 'none' && s.querySelector('.store-vel[data-id=\"stickers-sinterklaas\"]') }")
        check(stijl(), 'C2: Sinterklaas staat bij Stijl > Stickers, Uit de Store')
        vel = '.store-vel[data-id="stickers-sinterklaas"]'
        check(pg.locator(vel + ' .store-vel-plaatjes img').count() == 5 and pg.get_attribute(vel + ' .toggle', 'aria-checked') == 'false', 'C2: met voorbeeldjes, en de schakelaar staat uit')
        pg.click(vel + ' .toggle')
        check(pg.get_attribute(vel + ' .toggle', 'aria-checked') == 'true' and 'Winkelvak 1' in pg.inner_text(vel), 'C2: aangezet: in de chat, Winkelvak 1')

        # ── C (met download) ──
        pg.goto(BASIS + 'manifest.json'); pg.evaluate(KEUZE, UID)
        check(pg.locator('.sk-vak[data-vak=w1] img').count() == 1, 'C: Winkelvak 1 toont Sinterklaas')
        check(pg.locator('.sk-vak[data-vak=w2] img').count() == 0, 'C: Winkelvak 2 nog leeg')
        pg.click('.sk-vak[data-vak=w1]')
        check(pg.locator('.sk-inhoud .sk-sticker').count() == 12, 'C: 12 stickers in het vel')
        pg.locator('.sk-inhoud .sk-sticker').nth(7).click()
        check(pg.evaluate('window.gekozen') == ['f7-08'], 'C: tik = de sticker gaat mee als f7-08 (%s)' % pg.evaluate('window.gekozen'))
        st = pg.evaluate("async () => { const v = await import('./stickervellen.js?v=237'); const s = v.zoekSticker('f7-08'); return [s.naam[0], s.g] }")
        check(st == ['Ozosnel!', 'hoefslag'], 'C: f7-08 is Ozosnel met hoefgetrappel (%s)' % st)

        # ── C2: uitzetten bij Stijl = weg uit de chat; weer aan voor D ──
        check(stijl(), 'C2: terug naar Stijl > Stickers')
        pg.click(vel + ' .toggle')
        pg.goto(BASIS + 'manifest.json'); pg.evaluate(KEUZE, UID)
        check(pg.locator('.sk-vak[data-vak=w1] img').count() == 0, 'C2: uitgezet: weg uit de chat')
        stijl(); pg.click(vel + ' .toggle')

        # ── D ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=sticker]')
        pg.click(kaart + ' .weghalen')
        check(wacht(pg, "() => document.querySelector('.item[data-id=\"stickers-sinterklaas\"] .knop').textContent.includes('Downloaden')"), 'D: verwijderd in de Store')
        check(not RIJEN, 'D: weg uit je account')
        pg.goto(BASIS + 'manifest.json'); pg.evaluate(KEUZE, UID)
        check(pg.locator('.sk-vak[data-vak=w1] img').count() == 0, 'D: en weg uit de stickerkeuze')
        ok = pg.evaluate("async () => { const v = await import('./stickervellen.js?v=237'); return v.zoekSticker('f7-01')?.src }")
        check(ok == 'stickers/f7/01.webp', 'D: een ontvangen f7-sticker blijft te zien (%s)' % ok)
        # ── C2: opnieuw downloaden (staat dan uit) en verwijderen bij Stijl > Stickers ──
        pg.goto(BASIS + 'store.html'); pg.wait_for_selector('#inhoud', state='visible', timeout=15000)
        pg.click('#soorten .main-tab[data-soort=sticker]'); pg.click(kaart + ' .knop')
        wacht(pg, "() => document.querySelector('.item[data-id=\"stickers-sinterklaas\"] .knop').textContent.includes('Gedownload')")
        check(stijl() and pg.get_attribute(vel + ' .toggle', 'aria-checked') == 'false', 'C2: opnieuw gedownload: staat weer uit')
        pg.click(vel + ' .store-verwijder')
        check(wacht(pg, "() => document.getElementById('storeStickersSectie').style.display === 'none'") and not RIJEN, 'C2: verwijderd bij Stijl > Stickers: weg uit de lijst en uit je account')
        check(not fouten, 'E: geen paginafouten ' + ' | '.join(fouten))
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT: %s' % (len(fout), '; '.join(fout))))
sys.exit(1 if fout else 0)
