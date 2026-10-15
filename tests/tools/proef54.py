# proef54: het Stickerlab in Profiel (v154), met de echte profiel.html, eigenstickers.js en stickermaker.js.
# A. Profiel -> Stickers: bovenaan 'Je eigen chatstickers' met 2 vellen van 12 plekken (0 van 12), het oude
#    (werkloze) uploadvak weg, de emoji-versiering staat er nog; niet breder dan de telefoon.
# B. nieuwe sticker van een afbeelding met een effen achtergrond: achtergrond weg (hoeken doorzichtig, midden
#    vol), witte rand (aan/uit), beweging/geluid/naam kiezen (geluid bij kiezen en tikken), bewaren op dit
#    toestel (FibroDB 'eigensticker_<uid>_e1-01'), de plek toont hem, '1 van 12'.
# C. drukke achtergrond: standaard 'met je vinger'; zonder lijn niet te bewaren; lijn trekken (muis) = alleen
#    wat binnen de lijn ligt; 'alles houden'.
# D. aanpassen: titel, velden ingevuld, ander geluid bewaren (plaatje blijft).
# E. verwijderen: eerst 'Echt verwijderen?', dan weg (ook uit de database).
# F. Escape/annuleren bewaart niets. G. geen afbeelding = melding; al doorzichtig = 'heeft al geen achtergrond'.
# H. na verversen nog daar; een ander account op dit toestel ziet ze niet. I. Engels. J. chat: tekst bij Eigen.
# Oude map als controle: daar bestaat dit niet (bijna alles MIS).
# python3 -I proef54.py <map>     (FOTO=<map> maakt schermafbeeldingen)
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
import random

MAP = os.path.abspath(sys.argv[1]); FOTO = os.environ.get('FOTO')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; UID2 = 'bbbbbbbb-0000-4000-8000-000000000002'
def token(u): return json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": u}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))

# ── testplaatjes ──
tmp = tempfile.mkdtemp()
im = Image.new('RGB', (400, 300), (60, 20, 90)); d = ImageDraw.Draw(im)
d.ellipse((100, 50, 300, 250), fill=(250, 200, 40), outline=(10, 10, 10), width=6); d.ellipse((160, 110, 190, 140), fill=(255, 255, 255))
im.save(tmp + '/effen.png')
random.seed(5); im = Image.new('RGB', (400, 400)); px = im.load()
for y in range(400):
    for x in range(400): px[x, y] = (random.randrange(256), random.randrange(256), random.randrange(256))
ImageDraw.Draw(im).rectangle((140, 140, 260, 260), fill=(220, 30, 30)); im.save(tmp + '/druk.jpg', quality=92)
im = Image.new('RGBA', (300, 300), (0, 0, 0, 0)); ImageDraw.Draw(im).polygon([(150, 20), (190, 120), (290, 130), (210, 190), (240, 290), (150, 230), (60, 290), (90, 190), (10, 130), (110, 120)], fill=(40, 200, 90, 255)); im.save(tmp + '/ster.png')
open(tmp + '/geen.txt', 'w').write('dit is geen plaatje')

def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        uid = UID2 if UID2 in u else UID
        eigen = {"id": uid, "username": "bram"}
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return route.fulfill(status=200, json=eigen if obj else [eigen])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])

TELLER = """
(() => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
  window.__fxosc = 0
  const comp = AC.prototype.createDynamicsCompressor, start = AudioScheduledSourceNode.prototype.start
  AC.prototype.createDynamicsCompressor = function () { this.__fx = true; return comp.apply(this, arguments) }
  AudioScheduledSourceNode.prototype.start = function () {
    if (this.context && this.context.__fx && !(this.buffer && this.buffer.length <= 1)) window.__fxosc++
    return start.apply(this, arguments) }
})()
"""
DB = """async k => { const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
  r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) });
  return await new Promise(ok => { const q = db.transaction('fotos').objectStore('fotos').get(k);
    q.onsuccess = () => { const v = q.result; ok(v ? { b: v.b, g: v.g, naam: v.naam, len: (v.data || '').length, soort: (v.data || '').slice(0, 16), data: v.data } : null) }; q.onerror = () => ok(null) }) }"""
PIX = """async src => { if (!src) return null; const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const p = c.getContext('2d'); p.drawImage(img, 0, 0);
  const d = p.getImageData(0, 0, c.width, c.height).data; const px = (x, y) => { const i = (y * c.width + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]] };
  let eerste = null; for (let x = 0; x < c.width; x++) { const q = px(x, c.height >> 1); if (q[3] > 200) { eerste = q; break } }
  return { w: c.width, h: c.height, hoek: px(2, 2), midden: px(c.width >> 1, c.height >> 1), eerste } }"""
creme = lambda q: q and abs(q[0] - 251) < 12 and abs(q[1] - 243) < 12 and abs(q[2] - 230) < 12
VOORBEELD = "() => { const i = document.querySelector('.sm-voorbeeld img'); return i && !i.hidden && i.getAttribute('src') || null }"

www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(TELLER)
    p = ctx.new_page(); p.fouten = []
    p.on('pageerror', lambda e: p.fouten.append(str(e)[:200])); p.on('dialog', lambda dl: (p.fouten.append('dialoog: ' + dl.message), dl.dismiss()))
    def klik(sel, t=2500):
        try: p.click(sel, timeout=t); return True
        except Exception: return False
    def zet(soort, sel, waarde):  # op de oude code bestaan de velden niet: dan niet vastlopen
        try: (p.select_option if soort == 'kies' else p.fill)(sel, waarde, timeout=2000)
        except Exception: pass
    def ev(js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:120]
    def profiel(uid=UID, taal='nl'):
        p.goto(BASIS + 'manifest.json')  # (login.html stuurt met een inlogpas meteen door)
        p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", token(uid))
        p.evaluate("t => localStorage.setItem('fibro_taal', t)", taal)
        p.goto(BASIS + 'profiel.html'); p.wait_for_timeout(2200)
        ev("() => window.switchTab('stickers')"); p.wait_for_timeout(300)
    def kies(pad):
        try: p.set_input_files('.sm-scherm input[type=file]', pad, timeout=2000)
        except Exception: return False
        p.wait_for_timeout(700); return True
    OPEN = "() => { const s = document.querySelector('.sm-scherm'); return !!s && !s.hidden }"
    TELLERS = "() => [...document.querySelectorAll('.sm-velkop span')].map(s => s.textContent)"

    # ───────────── A ─────────────
    print('A. Profiel -> Stickers')
    profiel()
    a = ev("""() => { const pan = document.getElementById('panel-stickers'); const eerste = pan && pan.querySelector('.section-label');
      return { eerste: eerste && eerste.textContent, plekken: document.querySelectorAll('#eigenStickers .sm-plek').length,
        labels: [...document.querySelectorAll('#eigenStickers .sm-plek')].map(b => b.getAttribute('aria-label')).filter((x, i) => i === 0 || i === 23),
        oud: !!document.getElementById('stickerUpload'), natuur: !!document.getElementById('stickerNatuur'),
        dicht: !!document.querySelector('.sm-scherm') && document.querySelector('.sm-scherm').hidden, breed: document.documentElement.scrollWidth } }""")
    check('bovenaan: Je eigen chatstickers, 24 plekken (2 vellen van 12)', isinstance(a, dict) and a['eerste'] == 'Je eigen chatstickers' and a['plekken'] == 24 and a['labels'] == ['Nieuwe sticker in eigen vel 1, plek 1', 'Nieuwe sticker in eigen vel 2, plek 12'], a)
    check('tellers 0 van 12, maker dicht', ev(TELLERS) == ['0 van 12', '0 van 12'] and isinstance(a, dict) and a['dicht'], ev(TELLERS))
    check('oud uploadvak weg, emoji-versiering er nog, niet breder dan de telefoon', isinstance(a, dict) and not a['oud'] and a['natuur'] and a['breed'] <= 390, a)

    # ───────────── B ─────────────
    print('B. effen achtergrond')
    klik('#eigenStickers .sm-plek[data-code="e1-01"]'); p.wait_for_timeout(200)
    b = ev("() => ({ open: !document.querySelector('.sm-scherm').hidden, titel: document.getElementById('smTitel').textContent, focus: document.activeElement && document.activeElement.textContent, wis: document.querySelector('.sm-knop.wis').hidden })")
    check('tik op een lege plek: Nieuwe sticker, knop Kies een afbeelding heeft de focus, geen Verwijderen', isinstance(b, dict) and b['open'] and b['titel'] == 'Nieuwe sticker' and b['focus'] == 'Kies een afbeelding' and b['wis'], b)
    klik('.sm-onder .sm-knop.hoofd')
    check('bewaren zonder afbeelding: melding, blijft open', ev("() => document.querySelector('.sm-fout').textContent") == 'Kies eerst een afbeelding.' and ev(OPEN) is True, ev("() => document.querySelector('.sm-fout').textContent"))
    kies(tmp + '/effen.png')
    m = ev("() => ({ modus: (document.querySelector('.sm-segment [aria-checked=true]') || {}).dataset?.modus, knip: !document.querySelector('.sm-scherm .sm-stap:nth-of-type(2)').hidden, schuif: !document.querySelector('.sm-schuif').hidden, hint: document.querySelector('.sm-hint').textContent })")
    vb = ev(VOORBEELD); pix = ev(PIX, vb) if vb else None
    check('effen achtergrond: standaard Achtergrond weg, met Hoe streng', isinstance(m, dict) and m['modus'] == 'achtergrond' and m['knip'] and m['schuif'] and m['hint'].startswith('Alles wat op de kleur'), m)
    check('voorbeeld: 256 x 256 WebP, hoeken doorzichtig, midden vol geel', vb and vb.startswith('data:image/webp') and pix and pix['w'] == 256 and pix['hoek'][3] == 0 and pix['midden'][3] == 255 and pix['midden'][0] > 200 and pix['midden'][2] < 120, (vb or '')[:30] + ' ' + str(pix))
    check('witte rand: eerste pixel van links is de randkleur', pix and creme(pix['eerste']), pix and pix['eerste'])
    if FOTO: p.screenshot(path=FOTO + '/maker-effen.png', full_page=False)
    klik('#smRand'); p.wait_for_timeout(200); pix2 = ev(PIX, ev(VOORBEELD))
    check('witte rand uit: eerste pixel is de zwarte omtrek', pix2 and pix2['eerste'] and max(pix2['eerste'][:3]) < 90, pix2 and pix2['eerste'])
    klik('#smRand'); p.wait_for_timeout(200)
    voor = ev("window.__fxosc || 0")
    zet('kies', '#smBeweging', 'hup'); zet('kies', '#smGeluid', 'tsjirp'); zet('vul', '#smNaam', 'Krekel'); p.wait_for_timeout(200)
    na = ev("window.__fxosc || 0")
    klik('.sm-voorbeeld'); p.wait_for_timeout(100)
    tik = ev("() => ({ anim: document.querySelector('.sm-voorbeeld img').getAnimations().length, geluid: window.__fxosc || 0 })")
    check('geluid kiezen laat het horen; tikken = beweging + geluid', isinstance(na, int) and na > voor and isinstance(tik, dict) and tik['anim'] >= 1 and tik['geluid'] > na, (voor, na, tik))
    klik('.sm-onder .sm-knop.hoofd'); p.wait_for_timeout(500)
    rec = ev(DB, 'eigensticker_' + UID + '_e1-01')
    plek = ev("() => { const b = document.querySelector('#eigenStickers .sm-plek[data-code=\"e1-01\"]'); return b ? { vol: b.classList.contains('vol'), img: !!b.querySelector('img'), label: b.getAttribute('aria-label'), focus: document.activeElement === b } : null }")
    check('bewaard: maker dicht, de plek toont de sticker en heeft de focus', ev(OPEN) is False and isinstance(plek, dict) and plek['vol'] and plek['img'] and plek['label'] == 'Sticker Krekel aanpassen' and plek['focus'], plek)
    check('op dit toestel: eigensticker_<uid>_e1-01 met hup/tsjirp/Krekel (WebP)', isinstance(rec, dict) and rec['b'] == 'hup' and rec['g'] == 'tsjirp' and rec['naam'] == 'Krekel' and rec['soort'].startswith('data:image/webp'), rec and {k: rec[k] for k in ('b', 'g', 'naam', 'len', 'soort')})
    check('teller 1 van 12, melding Sticker bewaard; plaatje klein (< 60 kB)', ev(TELLERS) == ['1 van 12', '0 van 12'] and ev("() => document.querySelector('.sm-status').textContent") == 'Sticker bewaard' and isinstance(rec, dict) and rec['len'] < 80000, (ev(TELLERS), rec and rec['len']))

    # ───────────── C ─────────────
    print('C. met je vinger')
    klik('#eigenStickers .sm-plek[data-code="e1-02"]'); kies(tmp + '/druk.jpg')
    m = ev("() => ({ modus: (document.querySelector('.sm-segment [aria-checked=true]') || {}).dataset?.modus, schuif: !document.querySelector('.sm-schuif').hidden, hint: document.querySelector('.sm-hint').textContent })")
    check('drukke achtergrond: standaard Met je vinger, geen Hoe streng, uitleg', isinstance(m, dict) and m['modus'] == 'vinger' and not m['schuif'] and m['hint'] == 'Trek met je vinger een lijn om wat je wilt houden.', m)
    klik('.sm-onder .sm-knop.hoofd')
    check('zonder lijn niet te bewaren: melding', ev("() => document.querySelector('.sm-fout').textContent") == 'Trek eerst met je vinger een lijn om wat je wilt houden.' and ev(VOORBEELD) is None, ev("() => document.querySelector('.sm-fout').textContent"))
    try:
        p.locator('.sm-werk').scroll_into_view_if_needed(); p.wait_for_timeout(150)
        r = p.locator('.sm-werk').bounding_box()
        print('   werkvlak', {k: round(v) for k, v in r.items()}, 'scherm 390 x 844')
        pt = lambda x, y: (r['x'] + x * r['width'] / 400, r['y'] + y * r['height'] / 400)
        pad = [(120, 120), (200, 115), (280, 120), (285, 200), (280, 280), (200, 285), (120, 280), (115, 200), (120, 125)]
        p.mouse.move(*pt(*pad[0])); p.mouse.down()
        for a_, b_ in zip(pad, pad[1:]):
            for i in range(1, 6): p.mouse.move(*pt(a_[0] + (b_[0] - a_[0]) * i / 5, a_[1] + (b_[1] - a_[1]) * i / 5))
        p.mouse.up(); p.wait_for_timeout(300)
    except Exception as e: print('   (lijn trekken lukte niet)', str(e)[:80])
    vb = ev(VOORBEELD); pix = ev(PIX, vb) if vb else None
    check('lijn getrokken: alleen het rode vierkant blijft (hoeken doorzichtig, midden rood)', pix and pix['hoek'][3] == 0 and pix['midden'][3] == 255 and pix['midden'][0] > 180 and pix['midden'][1] < 80, pix)
    if FOTO: p.screenshot(path=FOTO + '/maker-vinger.png', full_page=False)
    klik('.sm-segment [data-modus="alles"]'); p.wait_for_timeout(200)
    pa = ev(PIX, ev(VOORBEELD))
    check('Alles houden: de hele afbeelding (bonte kleuren tot aan de rand)', pa and pa['midden'][0] > 180 and pa['eerste'] and creme(pa['eerste']) and ev("() => document.querySelector('.sm-hint').textContent") == 'De hele afbeelding wordt de sticker.', pa)
    klik('.sm-segment [data-modus="vinger"]'); p.wait_for_timeout(200)
    check('terug naar Met je vinger: de lijn is er nog', ev(VOORBEELD) is not None, '')
    klik('.sm-onder .sm-knop.hoofd'); p.wait_for_timeout(400)
    check('tweede sticker bewaard (2 van 12)', ev(TELLERS) == ['2 van 12', '0 van 12'] and isinstance(ev(DB, 'eigensticker_' + UID + '_e1-02'), dict), ev(TELLERS))

    # ───────────── D ─────────────
    print('D. aanpassen')
    oud = ev(DB, 'eigensticker_' + UID + '_e1-01')
    klik('#eigenStickers .sm-plek[data-code="e1-01"]'); p.wait_for_timeout(200)
    dd = ev("() => ({ titel: document.getElementById('smTitel').textContent, kies: document.querySelector('.sm-stap .sm-knop').textContent, b: document.getElementById('smBeweging').value, g: document.getElementById('smGeluid').value, naam: document.getElementById('smNaam').value, wis: !document.querySelector('.sm-knop.wis').hidden, knip: document.querySelectorAll('.sm-stap')[1].hidden })")
    check('aanpassen: titel, Andere afbeelding, velden ingevuld, Verwijderen zichtbaar', isinstance(dd, dict) and dd == {'titel': 'Sticker aanpassen', 'kies': 'Andere afbeelding', 'b': 'hup', 'g': 'tsjirp', 'naam': 'Krekel', 'wis': True, 'knip': True}, dd)
    zet('kies', '#smGeluid', 'boem'); klik('.sm-onder .sm-knop.hoofd'); p.wait_for_timeout(400)
    nw = ev(DB, 'eigensticker_' + UID + '_e1-01')
    check('ander geluid bewaard, plaatje hetzelfde', isinstance(nw, dict) and nw['g'] == 'boem' and nw['b'] == 'hup' and isinstance(oud, dict) and nw['data'] == oud['data'], nw and nw['g'])

    # ───────────── E ─────────────
    print('E. verwijderen')
    klik('#eigenStickers .sm-plek[data-code="e1-02"]'); p.wait_for_timeout(200)
    klik('.sm-knop.wis'); p.wait_for_timeout(100)
    e1 = ev("() => ({ tekst: document.querySelector('.sm-knop.wis').textContent, open: !document.querySelector('.sm-scherm').hidden })")
    klik('.sm-knop.wis'); p.wait_for_timeout(400)
    check('eerst Echt verwijderen?, dan weg (plek leeg, database leeg, 1 van 12)', isinstance(e1, dict) and e1 == {'tekst': 'Echt verwijderen?', 'open': True} and ev(OPEN) is False
          and ev(DB, 'eigensticker_' + UID + '_e1-02') is None and ev("() => !document.querySelector('#eigenStickers .sm-plek[data-code=\"e1-02\"]').classList.contains('vol')") is True
          and ev(TELLERS) == ['1 van 12', '0 van 12'] and ev("() => document.querySelector('.sm-status').textContent") == 'Sticker verwijderd', (e1, ev(TELLERS)))

    # ───────────── F + G ─────────────
    print('F/G. annuleren, rare bestanden')
    klik('#eigenStickers .sm-plek[data-code="e2-05"]'); kies(tmp + '/effen.png'); p.keyboard.press('Escape'); p.wait_for_timeout(200)
    klik('#eigenStickers .sm-plek[data-code="e2-06"]'); kies(tmp + '/effen.png'); klik('.sm-onder .sm-knop:not(.hoofd):not(.wis)'); p.wait_for_timeout(200)
    check('Escape en Annuleren bewaren niets', ev(OPEN) is False and ev(DB, 'eigensticker_' + UID + '_e2-05') is None and ev(DB, 'eigensticker_' + UID + '_e2-06') is None and ev(TELLERS) == ['1 van 12', '0 van 12'], ev(TELLERS))
    klik('#eigenStickers .sm-plek[data-code="e2-01"]'); kies(tmp + '/geen.txt')
    check('geen afbeelding: melding, niets kapot', ev("() => document.querySelector('.sm-fout').textContent") == 'Dit bestand is geen afbeelding die Fibro kan openen.' and ev(VOORBEELD) is None, ev("() => document.querySelector('.sm-fout').textContent"))
    kies(tmp + '/ster.png')
    g = ev("() => ({ hint: document.querySelector('.sm-hint').textContent, schuif: !document.querySelector('.sm-schuif').hidden, fout: document.querySelector('.sm-fout').textContent })")
    ps = ev(PIX, ev(VOORBEELD))
    check('al doorzichtig (png): heeft al geen achtergrond, geen Hoe streng, midden groen', isinstance(g, dict) and g['hint'] == 'Deze afbeelding heeft al geen achtergrond.' and not g['schuif'] and g['fout'] == '' and ps and ps['hoek'][3] == 0 and ps['midden'][1] > 150, (g, ps))
    zet('vul', '#smNaam', 'Ster'); klik('.sm-onder .sm-knop.hoofd'); p.wait_for_timeout(400)
    check('ook in vel 2 te bewaren (1 van 12 / 1 van 12)', ev(TELLERS) == ['1 van 12', '1 van 12'], ev(TELLERS))
    check('A-G: geen fouten op de pagina', p.fouten == [], p.fouten)

    # ───────────── H ─────────────
    print('H. verversen, ander account')
    profiel()
    check('na verversen nog daar', ev(TELLERS) == ['1 van 12', '1 van 12'] and ev("() => !!document.querySelector('#eigenStickers .sm-plek[data-code=\"e1-01\"] img')") is True, ev(TELLERS))
    if FOTO: p.screenshot(path=FOTO + '/vellen.png', full_page=False)
    profiel(UID2)
    check('ander account op dit toestel: ziet ze niet, die van het eerste blijven bewaard', ev(TELLERS) == ['0 van 12', '0 van 12'] and isinstance(ev(DB, 'eigensticker_' + UID + '_e1-01'), dict), ev(TELLERS))

    # ───────────── I ─────────────
    print('I. Engels')
    profiel(UID, 'en')
    en = ev("() => ({ label: document.querySelector('#panel-stickers .section-label').textContent, kop: document.querySelector('.sm-velkop b').textContent, teller: document.querySelector('.sm-velkop span').textContent, uitleg: document.querySelector('.sm-uitleg').textContent })")
    klik('#eigenStickers .sm-plek[data-code="e1-03"]'); kies(tmp + '/effen.png')
    en2 = ev("() => ({ titel: document.getElementById('smTitel').textContent, modi: [...document.querySelectorAll('.sm-segment button')].map(b => b.textContent), hint: document.querySelector('.sm-hint').textContent, bewaar: document.querySelector('.sm-onder .sm-knop.hoofd').textContent, rand: document.querySelector('.sm-vink span').textContent, beweging: document.getElementById('smBeweging').selectedOptions[0].textContent })")
    check('Engels: vellen', isinstance(en, dict) and en['label'] == 'Your own chat stickers' and en['kop'] == 'Your own sheet 1' and en['teller'] == '1 of 12' and en['uitleg'].startswith('Make a sticker from your own picture') and 'automatically' in en['uitleg'], en)
    check('Engels: maker', isinstance(en2, dict) and en2['titel'] == 'New sticker' and en2['modi'] == ['Remove background', 'With your finger', 'Keep everything'] and en2['hint'].startswith('Everything that looks like') and en2['bewaar'] == 'Save' and en2['rand'] == 'White border' and en2['beweging'] == 'Bounce', en2)
    check('H/I: geen fouten op de pagina', p.fouten == [], p.fouten)
    ctx.close()

    # ───────────── J ─────────────
    print('J. chat: tekst bij Eigen')
    ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa); p = ctx.new_page(); p.fouten = []
    p.on('pageerror', lambda e: p.fouten.append(str(e)[:200]))
    p.goto(BASIS + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", token(UID))
    p.goto(BASIS + 'chat.html'); p.wait_for_timeout(2500)
    ev("() => { const v = document.querySelector('#stickerGrid .sk-vak[data-vak=\"e1\"]'); if (v) v.click() }"); p.wait_for_timeout(200)  # (de chat zelf is nog dicht)
    t = ev("() => { const i = document.querySelector('#stickerGrid .sk-inhoud'); return i ? i.innerText.trim() : null }")
    check('chat, vakje Eigen zonder eigen stickers: je maakt ze in Profiel', t == 'Je eigen stickers maak je in Profiel, bij Stickers.', t)
    check('J: geen fouten op de pagina', p.fouten == [], p.fouten)
    ctx.close(); br.close(); srv.terminate()

shutil.rmtree(www, ignore_errors=True); shutil.rmtree(tmp, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
