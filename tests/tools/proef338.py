# proef338 (25 nov 2026, Marcel): eigen speelkaarten maken in Stekky Studio, van de platen tot in de kaarttafel (kaartmaker.js).
# Twee nagemaakte platen van 3 x 3 (elke kaart een eigen kleur). In een kopie van de app (alleen studio-kaarten.js en de
# map kaarten zijn echt een kopie; de rest verwijst naar de echte map).
#  A. Studio (moderator): "Speelkaarten maken": alleen de plaatjes staat aan, met 2 platen en een prompt per plaat;
#     zonder platen: een melding met wat ontbreekt
#  B. beide platen tegelijk inladen: 18 kaarten, elk op de goede plek (de kleur klopt); een plaatje bij twee kaarten = melding
#  C. het kaartpakket klopt (18 webp-plaatjes van 375 x 525)
#  D. het installatiescript zet de kaarten in de app
#  E. de kaarttafel kent de set: "Kies je kaarten" heeft hem, de heer is het plaatje, de 5 is getekend in de eigen kleur;
#     geen paginafouten
# python3 -I proef338.py <map>
import sys, os, time, json, socket, subprocess, tempfile, re, shutil, zlib, struct
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

tmp = tempfile.mkdtemp(prefix='proef338_'); app = os.path.join(tmp, 'Fibro'); os.mkdir(app)
for naam in os.listdir(MAP):
    if naam in ('.git', 'node_modules', 'studio-kaarten.js', 'kaarten'): continue
    os.symlink(os.path.join(MAP, naam), os.path.join(app, naam))
shutil.copy(os.path.join(MAP, 'studio-kaarten.js'), os.path.join(app, 'studio-kaarten.js'))
os.mkdir(os.path.join(app, 'kaarten'))
for naam in os.listdir(os.path.join(MAP, 'kaarten')): os.symlink(os.path.join(MAP, 'kaarten', naam), os.path.join(app, 'kaarten', naam))

# Twee platen van 3 x 3: kaart nr n (0..17) krijgt kleur KLEUR(n)
KLEUR = lambda n: (20 + n * 13, 200 - n * 9, 90 + (n * 37) % 150)
def png(pad, b, h, kleur_op):  # een eenvoudige PNG zonder Pillow (op GitHub is Pillow er niet)
    rijen = b''.join(b'\x00' + bytes(c for x in range(b) for c in kleur_op(x, y)) for y in range(h))
    blok = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(pad, 'wb').write(b'\x89PNG\r\n\x1a\n' + blok(b'IHDR', struct.pack('>IIBBBBB', b, h, 8, 2, 0, 0, 0)) + blok(b'IDAT', zlib.compress(rijen, 6)) + blok(b'IEND', b''))
PLATEN = []
for p in range(2):
    def kleur_op(x, y, p=p):
        k, kx = divmod(x - 20, 145); r_, ry = divmod(y - 20, 195)
        if x < 20 or y < 20 or k > 2 or r_ > 2 or kx >= 125 or ry >= 175: return (255, 255, 255)
        if kx < 3 or ry < 3 or kx >= 122 or ry >= 172: return (30, 30, 30)
        return KLEUR(p * 9 + r_ * 3 + k)
    pad = os.path.join(tmp, 'plaat%d.png' % (p + 1)); png(pad, 3 * 145 + 20, 3 * 195 + 20, kleur_op); PLATEN.append(pad)
VOLGORDE = ['hA', 'hB', 'hV', 'hH', 'rA', 'rB', 'rV', 'rH', 'achterkant', 'kA', 'kB', 'kV', 'kH', 'sA', 'sB', 'sV', 'sH', 'joker']

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def supa(route):
    u = route.request.url; m = route.request.method
    een = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=True)
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/profiles' in u and m == 'GET':
        p = {"id": UID, "username": "marcel", "is_moderator": True}
        return route.fulfill(status=200, json=p if een else [p])
    if '/auth/v1/' in u and m == 'GET': return route.fulfill(status=200, json={"id": UID})
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
    if '/rest/v1/' in u: return route.fulfill(status=200, json=[])
    return route.fulfill(status=204, body='')
def wacht(pg, js, ms=8000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False

s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', tmp], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block', accept_downloads=True)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), supa)
        ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ");localStorage.setItem('fibro_taal','nl')}catch(e){}")
        fouten = []
        pg = ctx.new_page(); pg.on('pageerror', lambda e: fouten.append(str(e)[:200]))

        # ── A ──
        pg.goto(BASIS + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        pg.click('#kaartBlok summary')
        check(pg.locator('#kaartBlok .kt-plaat').count() == 2, 'A alleen de plaatjes: 2 platen')
        prompt = pg.input_value('#ktPrompt-0')
        check('3 columns and 3 rows' in prompt and '1. Ace of hearts' in prompt and '9. the card back' in prompt, 'A een prompt voor plaat 1')
        pg.fill('#ktStijl', 'retro space')
        check('retro space' in pg.input_value('#ktPrompt-1'), 'A de stijl komt in de prompt')
        pg.fill('#ktNaam', 'Ruimtekaarten'); pg.fill('#ktNaamEn', 'Space cards')
        pg.click('#ktMaak')
        check('harten aas' in pg.inner_text('#ktMelding') and 'joker' in pg.inner_text('#ktMelding'), 'A zonder platen: wat ontbreekt')
        pg.click('#kaartBlok .kt-soort[data-soort=alles]')
        check(pg.locator('#kaartBlok .kt-plaat').count() == 5 and pg.locator('#ktOverzicht .kt-kaart').count() == 54, 'A alle 54: 5 platen, 54 kaarten')
        pg.click('#kaartBlok .kt-soort[data-soort=plaatjes]')
        check(pg.input_value('#ktNaam') == 'Ruimtekaarten', 'A de naam blijft staan')
        pg.fill('#ktKleur-h', '#123456')

        # ── B ──
        pg.set_input_files('#ktAlle', PLATEN)
        check(wacht(pg, "() => document.querySelectorAll('#ktOverzicht .kt-kaart img').length === 18", 15000), 'B 18 kaarten geknipt en op hun plek')
        kleuren = pg.evaluate("""() => [...document.querySelectorAll('#ktOverzicht .kt-kaart')].map(k => { const i = k.querySelector('img'); if (!i) return null
          const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d'); g.drawImage(i, 0, 0)
          return [k.dataset.kaart, [...g.getImageData(c.width >> 1, c.height >> 1, 1, 1).data].slice(0, 3), i.naturalWidth, i.naturalHeight] })""")
        goed = all(k and abs(k[1][0] - KLEUR(VOLGORDE.index(k[0]))[0]) < 12 and abs(k[1][1] - KLEUR(VOLGORDE.index(k[0]))[1]) < 12 for k in kleuren)
        check(goed, 'B elke kaart heeft het plaatje uit het goede vakje')
        check(all(k[2] == 375 and k[3] == 525 for k in kleuren if k), 'B elk plaatje is 375 x 525')
        hA = pg.input_value('#ktOverzicht select[data-kaart=hA]')
        pg.select_option('#ktOverzicht select[data-kaart=hB]', hA)
        pg.click('#ktMaak')
        check('bij twee kaarten' in pg.inner_text('#ktMelding'), 'B een plaatje bij twee kaarten: melding')
        pg.select_option('#ktOverzicht select[data-kaart=hB]', str(VOLGORDE.index('hB')))

        # ── C ──
        with pg.expect_download() as dl:
            pg.click('#ktMaak')
        d = dl.value
        check(d.suggested_filename == 'ruimtekaarten.stekkykaarten.json', 'C bestandsnaam: %s' % d.suggested_filename)
        bestand = os.path.join(tmp, d.suggested_filename); d.save_as(bestand)
        st = json.load(open(bestand, encoding='utf8'))
        check(st.get('formaat') == 'stekky-kaarten' and st.get('soort') == 'plaatjes' and st.get('naam') == ['Ruimtekaarten', 'Space cards'] and st.get('kleur', {}).get('h') == '#123456', 'C het pakket klopt')
        maten = pg.evaluate("async k => { const u = {}; for (const [n, d] of Object.entries(k)) { const b = await createImageBitmap(await (await fetch(d)).blob()); u[n] = [b.width, b.height] } return u }", st.get('kaarten', {}))
        check(sorted(maten) == sorted(VOLGORDE) and all(v == [375, 525] for v in maten.values()) and all(v.startswith('data:image/webp;base64,') for v in st['kaarten'].values()), 'C 18 webp-plaatjes van 375 x 525')

        # ── D ──
        r = subprocess.run(['node', os.path.join(MAP, 'tests/tools/studio-kaarten-installeer.mjs'), bestand, '--map', app, '--zonder-versies'], capture_output=True, text=True)
        check(r.returncode == 0 and 'ruimtekaarten' in r.stdout, 'D geïnstalleerd: %s' % (r.stdout.strip() or r.stderr.strip())[:100])

        # ── E ──
        pg.goto(BASIS + 'studio.html')
        uit = pg.evaluate("""async () => { const K = await import('./kaartspel-hulp.js?x=' + Date.now())
          const s = K.KAARTSTIJLEN.ruimtekaarten
          const img = new Image(); img.src = './kaarten/ruimtekaarten/hH.webp?v=1'; await img.decode().catch(() => {})
          return { naam: s && s.naam, soort: s && s.studio, heer: K.kaartSvg('hH', 'ruimtekaarten'), vijf: K.kaartSvg('h5', 'ruimtekaarten'), achter: K.achterkantSvg('ruimtekaarten'), breed: img.naturalWidth } }""")
        check(uit['naam'] == 'Ruimtekaarten' and uit['soort'] == 'plaatjes', 'E de set staat bij Kies je kaarten')
        check('kaarten/ruimtekaarten/hH.webp' in uit['heer'] and uit['breed'] == 375, 'E de heer is het plaatje (en dat laadt)')
        check('kt-studio' in uit['vijf'] and '#123456' in uit['vijf'], 'E de 5 is getekend, in de eigen kleur')
        check('kaarten/ruimtekaarten/achterkant.webp' in uit['achter'], 'E de achterkant is het plaatje')
        check(not fouten, 'E geen paginafouten (%s)' % fouten[:3])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    server.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
