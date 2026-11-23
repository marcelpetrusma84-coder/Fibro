# proef325 (23 nov 2026, Marcel): Stekky Studio (studio.html), stap 1: een plaat met stickers inladen, losknippen, 12 kiezen,
# naam/beweging/geluid, en een pakketbestand (naam.stekkypakket.json) maken. Alleen voor moderators.
#  A. geen moderator: "Geen toegang", de Studio zelf blijft dicht
#  B. moderator: een nagemaakte plaat (14 gekleurde figuren op beige) geeft 14 stickers in de lijst
#  C. kiezen: de eerste 12 = "12 van 12 gekozen", 12 kaartjes met naam, beweging en geluid; een 13e kiezen kan niet
#  D. met minder dan 12 kan het pakket nog niet gemaakt worden
#  E. het pakketbestand: id uit de naam, 12 echte WebP-plaatjes van 384 x 384 onder 150 kB, doorzichtige hoeken, aangepaste naam
#  F. Moderatie heeft een link naar de Studio; geen paginafouten
#  H. een eigen geluid per sticker: een wav wordt opgeruimd (stilte eraf, even hard) en een kleine mp3; zonder bron geen pakket;
#     een bestand dat geen geluid is geeft een nette melding; de beschrijving voor een geluidsmaker wordt gekopieerd
#  G. de prompt voor Gemini: staat er bovenaan, past zich aan wat je invult, en de knop kopieert hem naar het klembord
# python3 -I proef325.py <map>
import sys, os, time, json, socket, subprocess, tempfile, base64, io, re, math, struct, wave
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
STAND = {'moderator': True}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=STAND['moderator'])
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/' in u: return route.fulfill(status=200, json=[])
    return route.fulfill(status=204, body='')

# De plaat: 14 gekleurde figuren (met een witte rand) op een beige achtergrond, 5 per rij. Getekend in de browser zelf (geen PIL nodig).
tmp = tempfile.mkdtemp(prefix='proef325_')
PLAAT = os.path.join(tmp, 'plaat.png')
TEKEN = """() => {
  const kleuren = [[220,40,60],[40,120,220],[30,160,80],[240,170,20],[150,60,200],[20,170,180],[230,90,150],[110,70,40],[60,60,190],[200,200,40],[250,120,30],[90,190,60],[170,30,110],[40,40,40]]
  const c = document.createElement('canvas'); c.width = 1250; c.height = 780
  const x = c.getContext('2d'); x.fillStyle = 'rgb(232,221,200)'; x.fillRect(0, 0, 1250, 780)
  const vorm = (n, cx, cy, r, kleur) => {
    x.fillStyle = kleur; x.beginPath()
    if (n % 3 === 0) x.arc(cx, cy, r, 0, 7)
    else if (n % 3 === 1) x.roundRect(cx - r - 5, cy - r * 0.8, 2 * r + 10, r * 1.6, r * 0.25)
    else { x.moveTo(cx, cy - r - 5); x.lineTo(cx + r + 5, cy + r * 0.85); x.lineTo(cx - r - 5, cy + r * 0.85); x.closePath() }
    x.fill()
  }
  kleuren.forEach((k, n) => { const cx = 125 + (n % 5) * 250, cy = 130 + Math.floor(n / 5) * 260; vorm(n, cx, cy, 90, '#fff'); vorm(n, cx, cy, 76, 'rgb(' + k + ')') })
  return c.toDataURL('image/png').split(',')[1]
}"""
# Een WebP uit het pakket in de browser lezen: afmeting en dekking op een paar plekken
LEES = """async b64 => {
  const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))
  const bm = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }))
  const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height
  const x = c.getContext('2d'); x.drawImage(bm, 0, 0)
  const alfa = (px, py) => x.getImageData(px, py, 1, 1).data[3]
  return { w: bm.width, h: bm.height, hoek: alfa(2, 2), midden: alfa(192, 192), riff: String.fromCharCode(...bytes.slice(0, 4)) + String.fromCharCode(...bytes.slice(8, 12)), lengte: bytes.length }
}"""

# Een nagemaakt geluid: 0,3 s stilte, 0,5 s toon (zacht), 0,4 s stilte; mono, 22050 Hz (de Studio moet het omzetten naar 44100)
WAV = os.path.join(tmp, 'toon.wav')
with wave.open(WAV, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
    sr = 22050
    w.writeframes(b''.join(struct.pack('<h', int(0.1 * 32767 * math.sin(2 * math.pi * 440 * i / sr)) if 0.3 * sr <= i < 0.8 * sr else 0) for i in range(int(1.2 * sr))))
TEKST = os.path.join(tmp, 'geen-geluid.wav'); open(TEKST, 'w').write('dit is geen geluid')
LEES_MP3 = """async b64 => {
  const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))
  const cx = new AudioContext(); const ab = await cx.decodeAudioData(bytes.buffer.slice(0)); cx.close()
  const x = ab.getChannelData(0); let som = 0, piek = 0
  for (let i = 0; i < x.length; i++) { som += x[i] * x[i]; piek = Math.max(piek, Math.abs(x[i])) }
  return { duur: ab.duration, kanalen: ab.numberOfChannels, sr: ab.sampleRate, bytes: bytes.length, kop: bytes[0],
           rmsDb: 20 * Math.log10(Math.sqrt(som / x.length)), piekDb: 20 * Math.log10(piek) }
}"""

sock = socket.socket(); sock.bind(('127.0.0.1', 0)); poort = sock.getsockname()[1]; sock.close()
www = tempfile.mkdtemp(prefix='proef325w_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
basis = 'http://127.0.0.1:%d/Fibro/' % poort
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block', accept_downloads=True)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), supa)
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='http://127.0.0.1:%d' % poort)
        ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ")}catch(e){}")
        pg = ctx.new_page(); paginafouten = []
        pg.on('pageerror', lambda e: paginafouten.append(str(e)))

        # A. geen moderator
        STAND['moderator'] = False
        pg.goto(basis + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('toegangGeweigerd').classList.contains('verborgen')", timeout=15000)
        check(pg.evaluate("() => document.getElementById('inhoud').classList.contains('verborgen')"), 'A. geen moderator: de Studio blijft dicht')

        # B. moderator: de plaat inladen
        STAND['moderator'] = True
        pg.goto(basis + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        check(pg.evaluate("() => document.getElementById('toegangGeweigerd').classList.contains('verborgen')"), 'B. moderator: de Studio is open')
        check(pg.evaluate("() => document.getElementById('stap2').classList.contains('verborgen')"), 'B. voor de plaat zijn stap 2 tot 4 nog dicht')
        open(PLAAT, 'wb').write(base64.b64decode(pg.evaluate(TEKEN)))
        pg.set_input_files('#bestand', PLAAT)
        pg.wait_for_function("() => document.querySelectorAll('#vakken .vak').length > 0", timeout=20000)
        n = pg.evaluate("() => document.querySelectorAll('#vakken .vak').length")
        check(n == 14, 'B. 14 figuren op de plaat = 14 stickers in de lijst (%s)' % n)
        check('14 stickers gevonden' in pg.inner_text('#knipMelding'), 'B. de melding zegt 14 gevonden (%s)' % pg.inner_text('#knipMelding')[:60])

        # D. te weinig gekozen
        pg.click('#vakken .vak[data-nr="0"]'); pg.click('#vakken .vak[data-nr="1"]'); pg.click('#vakken .vak[data-nr="2"]')
        check(pg.inner_text('#teller').startswith('3 van 12'), 'D. 3 gekozen: "3 van 12 gekozen" (%s)' % pg.inner_text('#teller'))
        check(pg.evaluate("() => document.getElementById('maakPakket').disabled"), 'D. met 3 stickers kan het pakket nog niet gemaakt worden')

        # C. de eerste 12
        pg.click('#kiesEerste')
        check(pg.inner_text('#teller').startswith('12 van 12'), 'C. "Kies de eerste 12": 12 van 12 (%s)' % pg.inner_text('#teller'))
        k = pg.evaluate("() => document.querySelectorAll('#gekozenLijst .kaartje').length")
        check(k == 12, 'C. 12 kaartjes met naam, beweging en geluid (%s)' % k)
        keuzes = pg.evaluate("() => [...document.querySelectorAll('#gekozenLijst .kaartje')].map(c => { const s = c.querySelectorAll('select'); return [s[0].value, s[1].value, s[0].options.length > 5, s[1].options.length > 5] })")
        check(all(a and b and c and dd for a, b, c, dd in keuzes) and len({tuple(x[:2]) for x in keuzes}) == 12, 'C. elke sticker heeft een eigen voorstel voor beweging en geluid')
        pg.click('#vakken .vak[data-nr="12"]')
        check(pg.inner_text('#teller').startswith('Er passen er maar 12'), 'C. een 13e kiezen kan niet (%s)' % pg.inner_text('#teller'))
        check(pg.evaluate("() => document.querySelectorAll('#vakken .vak.gekozen').length") == 12, 'C. er blijven er 12 gekozen')
        check(not pg.evaluate("() => document.getElementById('maakPakket').disabled"), 'C. met 12 stickers kan het pakket gemaakt worden')
        pg.click('#gekozenLijst .kaartje:first-child .speel')   # ▶ geeft geen fout

        # E. het pakketbestand
        pg.fill('#gekozenLijst .kaartje:first-child input[type=text]', 'Rode bol')
        # H. een eigen geluid voor sticker 1
        kaart1 = '#gekozenLijst .kaartje:nth-child(1)'; kaart2 = '#gekozenLijst .kaartje:nth-child(2)'
        pg.set_input_files(kaart2 + ' input[type=file]', TEKST)
        pg.wait_for_function("() => document.querySelector('#gekozenLijst .kaartje:nth-child(2) .geluidstatus.fout')", timeout=15000)
        check('niet als geluid gelezen' in pg.inner_text(kaart2 + ' .geluidstatus'), 'H. een bestand dat geen geluid is: een nette melding (%s)' % pg.inner_text(kaart2 + ' .geluidstatus')[:50])
        pg.set_input_files(kaart1 + ' input[type=file]', WAV)
        pg.wait_for_function("() => /^✓ Eigen geluid/.test(document.querySelector('#gekozenLijst .kaartje:nth-child(1) .geluidstatus')?.textContent || '')", timeout=30000)
        status = pg.inner_text(kaart1 + ' .geluidstatus')
        check('0,5 seconden' in status, 'H. de stilte is eraf: 0,5 seconden over van de 1,2 (%s)' % status)
        pg.fill('#titel', 'Zomer Dieren!')
        pg.click('#maakPakket')
        pg.wait_for_function("() => document.getElementById('pakketMelding').textContent.includes('bron ontbreekt')", timeout=30000)
        check(True, 'H. zonder bron komt er geen pakket (de melding noemt de bron)')
        pg.fill(kaart1 + ' input[placeholder^="bijvoorbeeld Kenney"]', 'zelf gemaakt (testtoon)')
        pg.click(kaart1 + ' .speel:not(.stil)')   # ▶ met een eigen geluid geeft geen fout
        pg.click(kaart1 + ' .speel.stil:has-text("Engels")')
        pg.wait_for_function("() => document.querySelector('#gekozenLijst .kaartje:nth-child(1) .nr:last-child')?.textContent.includes('Gekopieerd')", timeout=8000)
        klem = pg.evaluate("() => navigator.clipboard.readText()")
        check('"Sticker 1"' in klem and 'bounce' in klem and 'no music' in klem, 'H. de beschrijving voor een geluidsmaker staat op het klembord (%s)' % klem[:60])
        with pg.expect_download(timeout=30000) as dl:
            pg.click('#maakPakket')
        bestand = dl.value
        check(bestand.suggested_filename == 'zomer-dieren.stekkypakket.json', 'E. bestandsnaam uit de naam (%s)' % bestand.suggested_filename)
        if os.environ.get('PROEF325_UIT'): bestand.save_as(os.environ['PROEF325_UIT'])   # voor een handmatige controle met studio-installeer.mjs
        pak = json.load(open(bestand.path(), encoding='utf8'))
        check(pak.get('formaat') == 'stekky-stickerpakket' and pak.get('id') == 'stickers-zomer-dieren' and pak.get('titel') == 'Zomer Dieren!', 'E. formaat, id en naam kloppen (%s)' % pak.get('id'))
        check(len(pak['stickers']) == 12, 'E. 12 stickers')
        check(pak['stickers'][0]['naam'][0] == 'Rode bol', 'E. de aangepaste naam staat in het bestand (%s)' % pak['stickers'][0]['naam'])
        mooi = True; groot = 0
        for s in pak['stickers']:
            r = pg.evaluate(LEES, s['webp']); groot = max(groot, r['lengte'])
            if r['riff'] != 'RIFFWEBP' or (r['w'], r['h']) != (384, 384) or r['hoek'] != 0 or r['midden'] < 200: mooi = False; print('   ', r)
        check(mooi, 'E. alle 12 zijn WebP van 384 x 384, doorzichtige hoeken en een gevulde sticker in het midden')
        st0 = pak['stickers'][0]
        check('mp3' in st0 and st0.get('bron') == 'zelf gemaakt (testtoon)' and all('mp3' not in x and 'bron' not in x for x in pak['stickers'][1:]), 'H. alleen sticker 1 heeft een eigen geluid, met de bron erbij')
        m = pg.evaluate(LEES_MP3, st0['mp3'])
        check(m['kop'] == 0xFF and m['bytes'] < 40 * 1024, 'H. een echte mp3 onder 40 kB (%d bytes)' % m['bytes'])
        check(0.4 < m['duur'] < 0.75 and m['kanalen'] == 1, 'H. ongeveer een halve seconde, mono (%.2f s)' % m['duur'])
        check(-24 < m['rmsDb'] < -18 and m['piekDb'] < 0, 'H. even hard als de andere geluiden: rond -21 dB (%.1f dB, piek %.1f dB)' % (m['rmsDb'], m['piekDb']))
        check(groot <= 150 * 1024, 'E. het zwaarste plaatje is %d kB (grens 150 kB)' % (groot // 1024))
        check('is gemaakt' in pg.inner_text('#pakketMelding'), 'E. de melding zegt dat het bestand klaar is')

        # G. de prompt voor Gemini
        pg.goto(basis + 'studio.html')
        pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
        check(pg.evaluate("() => document.getElementById('promptBlok').compareDocumentPosition(document.getElementById('stap2')) & Node.DOCUMENT_POSITION_FOLLOWING") > 0, 'G. de prompt staat boven de stappen')
        pg.click('#promptBlok summary')
        std = pg.input_value('#promptTekst')
        check('15 losse stickers' in std and '5 kolommen en 3 rijen' in std and 'effen, egale kleur' in std, 'G. standaardprompt: 15 stickers, 5 x 3, effen achtergrond')
        check('vaste indeling' in pg.inner_text('#promptOpmerking') and '5 kolommen en 3 rijen' in pg.inner_text('#promptOpmerking'), 'G. de opmerking zegt wat je in de Studio instelt')
        pg.fill('#promptThema', 'winterdieren'); pg.fill('#promptStijl', 'zachte waterverf'); pg.fill('#promptAchtergrond', 'lichtgrijs')
        pg.fill('#promptKolommen', '4'); pg.fill('#promptRijen', '4')
        eigen = pg.input_value('#promptTekst')
        check('Thema: winterdieren' in eigen and '- zachte waterverf' in eigen and 'kleur: lichtgrijs.' in eigen and '16 losse stickers' in eigen and '4 kolommen en 4 rijen' in eigen, 'G. de tekst past zich aan wat je invult')
        pg.fill('#promptKolommen', '3'); pg.fill('#promptRijen', '3')
        check('nodig' in pg.inner_text('#promptOpmerking') and 'maar 9' in pg.inner_text('#promptOpmerking'), 'G. een rooster met minder dan 12 krijgt een waarschuwing (%s)' % pg.inner_text('#promptOpmerking')[:60])
        pg.fill('#promptKolommen', '4'); pg.fill('#promptRijen', '4')
        pg.click('#kopieerPrompt')
        pg.wait_for_function("() => document.getElementById('kopieerMelding').textContent.startsWith('✓')", timeout=8000)
        klem = pg.evaluate("() => navigator.clipboard.readText()")
        check(klem == pg.input_value('#promptTekst') and 'Thema: winterdieren' in klem, 'G. de knop zet de hele prompt op het klembord (%d tekens)' % len(klem))
        # zonder toegang tot het klembord: de knop probeert het oude kopieerkommando en meldt eerlijk wat er gebeurde
        pg.evaluate("() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('geen recht')) }, configurable: true }); document.execCommand = () => false }")
        pg.click('#kopieerPrompt')
        pg.wait_for_function("() => document.getElementById('kopieerMelding').textContent.startsWith('Kopiëren lukte niet')", timeout=8000)
        check(True, 'G. zonder klembord: een nette melding in plaats van een fout')

        # F. Moderatie heeft een link, geen paginafouten
        pg.goto(basis + 'moderatie.html')
        pg.wait_for_selector('a[href="studio.html"]', timeout=15000)
        check(True, 'F. Moderatie heeft een link naar de Studio')
        check(not paginafouten, 'F. geen paginafouten ' + str(paginafouten[:2]))
        browser.close()
finally:
    server.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
