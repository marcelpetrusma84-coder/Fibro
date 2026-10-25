# proef105: op de Stijl-pagina witte stippellijnen met schaduw en duidelijkere knoppen (v217), echte profiel.html en
# stickermaker.js, op een lichte ruimtefoto als achtergrond (zoals die van Marcel, hier zelf getekend) en op de gewone
# donkere achtergrond, op een telefoon (390 x 844) en de Steam Deck (1280 x 800). Telkens NL; EN apart.
#  A. de stippellijnen: de drie kiesvakken (avatarfoto, muziek, eigen achtergrond) en de 24 lege stickerplekken hebben
#     een witte stippellijn van minstens 2 px (geen paars meer) met een schaduw (box-shadow, de plekken ook een
#     drop-shadow), een donkere ondergrond en een wit plusje; het grote vak heeft geen eigen style meer (klasse groot)
#  B. zichtbaar op de lichte foto (gemeten in de schermafdruk): stippellijn tegen het vlak erbinnen >= 3:1, het plusje
#     >= 3:1, de regel "JPG · PNG ..." en "MP3, M4A ..." >= 3:1
#  C. de knoppen: Kleur, Gradient, Wallpaper, Eigen upload hebben een donkere ondergrond (dekking >= 0,4) met een witte
#     rand en witte letters; de gekozen knop is gevuld (verloop van de accentkleur), donkere letters, witte rand.
#     'Nummer weghalen' heeft een donkere ondergrond en een rode rand. Letters tegen knop >= 4,5:1 op de lichte foto.
#  D. alles werkt nog: tik op een kiesvak = bestand kiezen (achtergrond, muziek, avatarfoto), Nummer weghalen roept
#     wisMuziek aan, een lege plek opent het Stickerlab, een volle plek houdt zijn eigen rand (geen stippel, geen schaduw)
#  E. ook met een andere accentkleur (geel): de gekozen knop gevuld in geel, stippellijnen blijven wit
#  F. Engels: dezelfde teksten als voorheen (Your own upload, Remove song, Upload a music file, Choose an image)
#  G. geen paginafouten, profiel.html laadt stickermaker.js?v=217
# Oude map (v216) als controle: A, B, C en E MIS.
# python3 -I proef105.py <map>
import sys, os, io, time, json, socket, subprocess, tempfile, shutil, base64, random
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFilter

MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:260] if info != '' else ''), flush=True)

# een lichte ruimtefoto: verloop naar licht paars, een grote lichte planeet met ring, lichte bergen, witte sterren
def maak_foto():
    random.seed(7); W, H = 900, 1600
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H; d.line([(0, y), (W, y)], fill=(int(70 + 110 * t), int(55 + 100 * t), int(110 + 100 * t)))
    d.ellipse([480, 150, 1000, 700], fill=(222, 200, 160)); d.ellipse([300, 330, 1150, 520], outline=(240, 225, 190), width=40)
    d.polygon([(0, 1100), (200, 800), (380, 980), (600, 760), (900, 1050), (900, 1600), (0, 1600)], fill=(190, 180, 210))
    for _ in range(400):
        x, y = random.randrange(W), random.randrange(H); r = random.choice([1, 1, 2, 3])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
    b = io.BytesIO(); im.filter(ImageFilter.GaussianBlur(1.2)).save(b, 'JPEG', quality=85)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
FOTO = maak_foto()
S = 2  # schermafdrukken op dubbele scherpte: dunne letters worden dan goed gemeten

def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=prof)
        return route.fulfill(status=200, json=[prof])
    return route.fulfill(status=200, json=[] if m == 'GET' else {})

def lum(px):
    def c(v):
        v = v / 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * c(px[0]) + 0.7152 * c(px[1]) + 0.0722 * c(px[2])
def ratio(a, b):
    a, b = max(a, b), min(a, b); return (a + 0.05) / (b + 0.05)
def pct(lst, p):
    s = sorted(lst); return s[min(len(s) - 1, int(p * len(s)))]

# B: de stippellijn tegen het vlak erbinnen. Rand = de buitenste 'w' px (zonder de hoeken), binnen = een band
# een paar px binnen de rand (zonder de inhoud in het midden). Lijn = 90e percentiel van de rand.
def rand_contrast(im, w):
    if im is None: return 0
    w = w * S; a, z = w + 4 * S, w + 10 * S
    W, H = im.size; px = im.load(); r, b = [], []
    hoek = max(16 * S, int(min(W, H) * 0.18))
    for x in range(hoek, W - hoek):
        for y in list(range(0, w)) + list(range(H - w, H)): r.append(lum(px[x, y]))
        for y in list(range(a, z)) + list(range(H - z, H - a)): b.append(lum(px[x, y]))
    for y in range(hoek, H - hoek):
        for x in list(range(0, w)) + list(range(W - w, W)): r.append(lum(px[x, y]))
        for x in list(range(a, z)) + list(range(W - z, W - a)): b.append(lum(px[x, y]))
    return round(ratio(pct(r, 0.9), pct(b, 0.5)), 2)
# letters/plusje tegen hun ondergrond: licht (95e) tegen het midden (50e) of donker (5e) tegen het midden, het grootste
def tekst_contrast(im):
    if im is None: return 0
    d = im.tobytes(); L = [lum(d[i:i + 3]) for i in range(0, len(d), 3)]
    m = pct(L, 0.5); return round(max(ratio(pct(L, 0.97), m), ratio(pct(L, 0.03), m)), 2)

def klip(p, sel, i=0, rechts=None, binnen=0, midden=None):
    r = p.evaluate("([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return null; e.scrollIntoView({block: 'center'}); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } }", [sel, i])
    if not r: return None
    p.wait_for_timeout(150)
    r = p.evaluate("([s, i]) => { const b = document.querySelectorAll(s)[i].getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } }", [sel, i])
    if midden: binnen = min(r['w'], r['h']) * (1 - midden) / 2  # alleen het midden (het plusje)
    x, y, w, h = r['x'] + binnen, r['y'] + binnen, r['w'] - 2 * binnen, r['h'] - 2 * binnen
    if rechts: x, w = x + w * (1 - rechts), w * rechts
    return Image.open(io.BytesIO(p.screenshot(clip={'x': x, 'y': y, 'width': w, 'height': h}))).convert('RGB')

STIJLEN = """() => {
  const kl = s => { const c = getComputedStyle(s); return { stijl: c.borderTopStyle, breed: parseFloat(c.borderTopWidth), kleur: c.borderTopColor, schaduw: c.boxShadow, filter: c.filter, vlak: c.backgroundColor, tekst: c.color, beeld: c.backgroundImage } }
  const zones = [...document.querySelectorAll('.upload-zone')].map(z => Object.assign(kl(z), { id: z.getAttribute('onclick') }))
  const plekken = [...document.querySelectorAll('#eigenStickers .sm-plek:not(.vol)')].map(kl)
  const groot = document.querySelector('.upload-zone.groot')
  return { zones, plekken, groot: groot ? { style: groot.getAttribute('style'), klik: groot.getAttribute('onclick') } : null,
    knoppen: [...document.querySelectorAll('.type-btn')].map(b => Object.assign(kl(b), { id: b.id, actief: b.classList.contains('active') })),
    wis: (b => b ? kl(b) : null)(document.querySelector('#muziekNu button')),
    formaten: [...document.querySelectorAll('.upload-formats'), document.querySelector('#bg-upload-sectie .upload-zone > div:last-child, #bg-upload-sectie [onclick] > div:last-child')].filter(Boolean).map(e => getComputedStyle(e).color) }
}"""
def rgba(s):
    s = s.replace('rgba(', '').replace('rgb(', '').replace(')', ''); v = [float(x) for x in s.split(',')]
    return v + [1.0] if len(v) == 3 else v
def wit(s, a=0.85):
    v = rgba(s); return v[0] >= 245 and v[1] >= 245 and v[2] >= 245 and v[3] >= a
def paars(s):
    v = rgba(s); return abs(v[0] - 192) < 6 and abs(v[1] - 132) < 6 and abs(v[2] - 252) < 6

fouten = []
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
check('G: profiel.html laadt stickermaker.js?v=217', "./stickermaker.js?v=217'" in open(MAP + '/profiel.html', encoding='utf-8').read())

def open_pagina(br, w, h, taal='nl', foto=True, accent=None):
    ctx = br.new_context(service_workers='block', viewport={'width': w, 'height': h}, device_scale_factor=S, reduced_motion='reduce')
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda ws: None)
    p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(str(e)[:200]))
    p.goto(B + 'manifest.json'); p.evaluate("([t, taal]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', taal) }", [TOKEN, taal])
    p.goto(B + 'profiel.html')
    try: p.wait_for_function("() => document.querySelectorAll('#eigenStickers .sm-plek').length === 24", timeout=15000)
    except Exception: pass
    p.wait_for_timeout(800)
    if foto:  # zoals thema.js doet bij een eigen achtergrondfoto
        p.evaluate("u => { zetWallpaperLaag(u); const r = document.documentElement.style; r.setProperty('--card', 'rgba(0,0,0,0.70)'); r.setProperty('--border', 'rgba(255,255,255,0.15)'); document.querySelector('.top-bar').style.background = 'rgba(0,0,0,0.75)'; document.querySelector('.bottom-nav').style.background = 'rgba(0,0,0,0.75)' }", FOTO)
    if accent: p.evaluate("a => { document.documentElement.style.setProperty('--accent', a); document.documentElement.style.setProperty('--accent2', '#fef08a') }", accent)
    # alles zichtbaar: avatarfoto-vak, het nummer dat speelt, Eigen upload gekozen
    p.evaluate("() => { toggleAvatarPicker(); switchAvatarTab('foto'); const n = document.getElementById('muziekNu'); n.style.display = 'flex'; document.getElementById('muziekNuTitel').textContent = 'Nu: proefnummer' }")
    return ctx, p

with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server'])
    for scherm, w, h in (('telefoon', 390, 844), ('Steam Deck', 1280, 800)):
        for foto in (True, False):
            waar = '%s, %s' % (scherm, 'lichte foto' if foto else 'donkere achtergrond')
            ctx, p = open_pagina(br, w, h, foto=foto)
            p.evaluate("() => { document.getElementById('bg-upload-sectie').style.display = 'block' }")
            s = p.evaluate(STIJLEN)
            z = s['zones']; pl = s['plekken']
            check('A %s: 3 kiesvakken met een witte stippellijn van >= 2 px en schaduw, donkere ondergrond' % waar,
                  len(z) == 3 and all(x['stijl'] == 'dashed' and x['breed'] >= 2 and wit(x['kleur']) and x['schaduw'] != 'none' and rgba(x['vlak'])[3] >= 0.2 and rgba(x['vlak'])[0] < 40 for x in z),
                  [(x['id'][:30] if x['id'] else '', x['stijl'], x['breed'], x['kleur'], x['vlak'], x['schaduw'][:40]) for x in z])
            check('A %s: 24 lege stickerplekken: witte stippellijn >= 2 px, schaduw en drop-shadow, wit plusje, geen paars' % waar,
                  len(pl) == 24 and all(x['stijl'] == 'dashed' and x['breed'] >= 2 and wit(x['kleur']) and x['schaduw'] != 'none' and 'drop-shadow' in x['filter'] and wit(x['tekst'], 1) and not paars(x['kleur']) for x in pl),
                  pl[:1])
            check('A %s: het grote vak (eigen achtergrond) is een kiesvak zonder eigen style, opent nog steeds het kiesvenster' % waar,
                  s['groot'] and not s['groot']['style'] and 'bgUpload' in (s['groot']['klik'] or ''), s['groot'])
            if foto:
                # B: meten in de schermafdruk
                p.evaluate("() => switchTab('stickers')"); p.wait_for_timeout(200)
                c = [rand_contrast(klip(p, '#eigenStickers .sm-plek:not(.vol)', i), 2) for i in (0, 5, 10, 13, 22)]
                check('B %s: stippellijn van de stickerplekken >= 3:1 tegen het vlak erbinnen' % waar, min(c) >= 3, c)
                c2 = [tekst_contrast(klip(p, '#eigenStickers .sm-plek:not(.vol)', i, midden=0.35)) for i in (0, 5, 10, 13, 22)]
                check('B %s: het plusje >= 3:1' % waar, min(c2) >= 3, c2)
                p.evaluate("() => switchTab('profiel')"); p.wait_for_timeout(200)
                cz = [rand_contrast(klip(p, '.upload-zone', i), 2) for i in range(2)]
                f = [tekst_contrast(klip(p, '.upload-formats', 1))]
                p.evaluate("() => { switchTab('achtergrond'); setAchtergrondType('upload') }"); p.wait_for_timeout(200)
                cz.append(rand_contrast(klip(p, '#bg-upload-sectie [onclick]', 0), 2))
                check('B %s: stippellijn van de drie kiesvakken >= 3:1' % waar, min(cz) >= 3, cz)
                # de regel met de bestandssoorten (onderste regel van het muziekvak en van het grote vak)
                f.append(tekst_contrast(klip(p, '#bg-upload-sectie [onclick] > div:last-child')))
                check('B %s: "JPG · PNG ..." en "MP3, M4A ..." >= 3:1' % waar, min(f) >= 3, f)
            # C: de knoppen
            kn = s['knoppen']; gewoon = [k for k in kn if not k['actief']]; actief = [k for k in kn if k['actief']]
            check('C %s: de typeknoppen hebben een donkere ondergrond, witte rand en witte letters' % waar,
                  len(gewoon) == 3 and all(rgba(k['vlak'])[3] >= 0.4 and rgba(k['vlak'])[0] < 40 and wit(k['kleur'], 0.6) and wit(k['tekst'], 1) and k['schaduw'] != 'none' for k in gewoon),
                  [(k['id'], k['vlak'], k['kleur'], k['tekst']) for k in gewoon])
            check('C %s: de gekozen knop (Kleur) gevuld met het verloop, donkere letters, witte rand' % waar,
                  len(actief) == 1 and actief[0]['id'] == 'type-kleur' and 'gradient' in actief[0]['beeld'] and rgba(actief[0]['tekst'])[0] < 60 and wit(actief[0]['kleur'], 1),
                  actief and (actief[0]['id'], actief[0]['beeld'][:50], actief[0]['tekst'], actief[0]['kleur']))
            wi = s['wis']
            check('C %s: Nummer weghalen met een donkere ondergrond en een rode rand' % waar,
                  wi and rgba(wi['vlak'])[3] >= 0.4 and rgba(wi['vlak'])[0] < 40 and rgba(wi['kleur'])[0] > 200 and rgba(wi['kleur'])[3] >= 0.6 and wi['schaduw'] != 'none', wi)
            if foto:
                p.evaluate("() => { switchTab('achtergrond'); setAchtergrondType('upload') }"); p.wait_for_timeout(200)
                ck = [tekst_contrast(klip(p, '.type-btn', i, rechts=0.6, binnen=4)) for i in range(4)]
                p.evaluate("() => switchTab('profiel')"); p.wait_for_timeout(200)
                ck.append(tekst_contrast(klip(p, '#muziekNu button', 0, rechts=0.7, binnen=4)))
                check('C %s: letters tegen knop >= 4,5:1 (Kleur, Gradient, Wallpaper, Eigen upload gekozen, Nummer weghalen)' % waar, min(ck) >= 4.5, ck)
                p.evaluate("() => setAchtergrondType('kleur')")
            # D: alles werkt nog
            if scherm == 'telefoon' and foto:
                gekozen = []
                for sel, wat in (('#bg-upload-sectie [onclick*=bgUpload]', 'bgUpload'), ('.upload-zone[onclick*=muziekUpload]', 'muziekUpload'), ('.upload-zone[onclick*=fotoInput]', 'fotoInput')):
                    p.evaluate("() => { switchTab('achtergrond'); setAchtergrondType('upload') }" if wat == 'bgUpload' else "() => switchTab('profiel')"); p.wait_for_timeout(150)
                    try:
                        with p.expect_file_chooser(timeout=3000) as fc: p.click(sel)
                        gekozen.append(fc.value.element.get_attribute('id'))
                    except Exception as e: gekozen.append('geen: ' + str(e)[:60])
                check('D: tik op een kiesvak = bestand kiezen (achtergrond, muziek, avatarfoto)', gekozen == ['bgUpload', 'muziekUpload', 'fotoInput'], gekozen)
                p.evaluate("() => { window._gewist = 0; window.wisMuziek = () => { window._gewist++ } }")
                p.click('#muziekNu button')
                check('D: Nummer weghalen roept wisMuziek aan', p.evaluate("() => window._gewist") == 1)
                p.evaluate("() => switchTab('stickers')")
                p.click('#eigenStickers .sm-plek[data-code="e1-01"]'); p.wait_for_timeout(300)
                check('D: een lege plek opent het Stickerlab', p.evaluate("() => { const s = document.querySelector('.sm-scherm'); return !!s && !s.hidden }"))
                p.keyboard.press('Escape'); p.wait_for_timeout(200)
                vol = p.evaluate("""() => { const b = document.querySelector('#eigenStickers .sm-plek[data-code="e1-02"]'); b.classList.add('vol'); b.textContent = '';
                    const c = getComputedStyle(b); return { stijl: c.borderTopStyle, schaduw: c.boxShadow, filter: c.filter } }""")
                check('D: een volle plek: gewone rand, geen schaduw, geen drop-shadow', vol['stijl'] == 'solid' and vol['schaduw'] == 'none' and vol['filter'] == 'none', vol)
            ctx.close()
    # E: gele accentkleur
    ctx, p = open_pagina(br, 390, 844, accent='#facc15')
    p.evaluate("() => switchTab('achtergrond')"); p.wait_for_timeout(200)
    s = p.evaluate(STIJLEN); a = [k for k in s['knoppen'] if k['actief']]
    check('E: met een gele accentkleur: de gekozen knop gevuld in geel, stippellijnen blijven wit',
          a and 'rgb(250, 204, 21)' in a[0]['beeld'] and all(wit(x['kleur']) for x in s['zones'] + s['plekken']), a and a[0]['beeld'][:80])
    ck = tekst_contrast(klip(p, '.type-btn.active', 0, rechts=0.6, binnen=4))
    check('E: letters op de gele knop >= 4,5:1', ck >= 4.5, ck)
    ctx.close()
    # F: Engels
    ctx, p = open_pagina(br, 390, 844, taal='en')
    p.evaluate("() => { document.getElementById('bg-upload-sectie').style.display = 'block' }")
    t = p.evaluate("""() => ({ upload: document.getElementById('type-upload').textContent.trim(), wis: document.querySelector('#muziekNu button').textContent.trim(),
        muziek: document.getElementById('muziekUploadTekst').textContent.trim(), kies: document.querySelector('#bg-upload-sectie [onclick] > div:nth-child(2)').textContent.trim() })""")
    check('F: Engels: dezelfde teksten', t == {'upload': '\U0001F4E4 Your own upload', 'wis': '\U0001F5D1️ Remove song', 'muziek': 'Upload a music file', 'kies': 'Choose an image'}, t)
    ctx.close()
    br.close()
srv.terminate(); shutil.rmtree(www, ignore_errors=True)
check('G: geen paginafouten', fouten == [], fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef105: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
