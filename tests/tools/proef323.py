# proef323 (19 nov 2026, foto van Marcel): het spelertje op het vergrendelscherm (Media Session) in een echte Chrome.
# Eerst stond er alleen "Stekky", een leeg vakje, --:-- en knoppen van 10 seconden. Nu (vergrendelscherm.js):
#  A. spraakbericht (spraak.js): "Spraakbericht van Bram", tijdbalk (setPositionState) en spoelen via het vergrendelscherm
#  B. radio (radio.js): naam van de zender, "Live radio", geen tijdbalk en geen spoelen; ⏭ = volgende zender;
#     ⏸ = radio uit maar nog in beeld (gepauzeerd), ▶ = weer aan
#  C. na de radio weer het spraakbericht in beeld als dat nog speelt; alles weg = leeg spelertje
#  D. geen paginafouten
# Met de oude versie (origin/main) als controle gaat bijna alles MIS.
# python3 -I proef323.py <map>
import sys, os, time, socket, subprocess, tempfile, io, wave, struct, math
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat, info=''):
    print(('OK   ' if ok else 'FOUT ') + wat + ('  | ' + str(info)[:300] if info != '' else ''))
    if not ok: fout.append(wat)
def wav(sec, hz):
    b = io.BytesIO(); w = wave.open(b, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
    w.writeframes(b''.join(struct.pack('<h', int(4000 * math.sin(2 * math.pi * hz * i / 22050))) for i in range(int(22050 * sec)))); w.close()
    return b.getvalue()
GELUID = wav(20, 440)

www = tempfile.mkdtemp(prefix='proef323_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
open(os.path.join(www, 'test.html'), 'w').write("""<!doctype html><meta charset=utf-8><body><div id=spraak></div><div id=radio></div>
<script type=module>
window.__h = {}; window.__pos = []
const ms = navigator.mediaSession
const z = ms.setActionHandler.bind(ms); ms.setActionHandler = (a, f) => { if (f) window.__h[a] = f; else delete window.__h[a]; try { z(a, f) } catch (e) {} }
const p = ms.setPositionState ? ms.setPositionState.bind(ms) : null
ms.setPositionState = s => { window.__pos.push(s || null); try { p && p(s) } catch (e) {} }
const sp = await import('/Fibro/spraak.js?t=' + Date.now())
const ra = await import('/Fibro/radio.js?t=' + Date.now())
const blob = await (await fetch('/geluid.wav')).blob()
document.getElementById('spraak').appendChild(sp.maakSpeler(URL.createObjectURL(blob), 20, { van: 'Bram' }))
ra.tekenRadioWidget(document.getElementById('radio'), { cfg: { zenders: [
  { naam: 'Zender Een', url: 'https://radio.test/een.mp3' }, { naam: 'Zender Twee', url: 'https://radio.test/twee.mp3' } ] } })
window.__klaar = true
</script>""")
open(os.path.join(www, 'geluid.wav'), 'wb').write(GELUID)
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
STAND = "() => { const m = navigator.mediaSession; return { titel: m.metadata && m.metadata.title, artiest: m.metadata && m.metadata.artist, hoes: m.metadata && m.metadata.artwork.length, stand: m.playbackState, knoppen: Object.keys(window.__h).sort(), pos: window.__pos.length ? window.__pos[window.__pos.length - 1] : 'geen' } }"
fouten = []
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.route('https://radio.test/**', lambda r: r.fulfill(status=200, body=GELUID, headers={'content-type': 'audio/wav', 'access-control-allow-origin': '*'}))
        pg.goto('http://127.0.0.1:%d/test.html' % poort); pg.wait_for_function('window.__klaar === true', timeout=10000)
        # A. spraakbericht
        pg.click('.spraak-knop'); pg.wait_for_timeout(900)
        a = pg.evaluate(STAND)
        check(a['titel'] == 'Spraakbericht van Bram' and a['stand'] == 'playing' and a['hoes'] >= 2, 'A. spraakbericht: titel "Spraakbericht van Bram", speelt, met plaatje', a)
        check(isinstance(a['pos'], dict) and abs(a['pos']['duration'] - 20) < 0.5, 'A. tijdbalk met de echte lengte (20 s)', a['pos'])
        check(all(k in a['knoppen'] for k in ['seekto', 'seekforward', 'seekbackward', 'pause', 'play']), 'A. spoelen en pauze op het vergrendelscherm', a['knoppen'])
        pg.evaluate("() => window.__h.seekto && window.__h.seekto({ seekTime: 12 })"); pg.wait_for_timeout(200)
        t = pg.evaluate("() => document.querySelector('#spraak .spraak-speler')._audio.currentTime")
        check(t >= 11.9, 'A. slepen op het vergrendelscherm spoelt het spraakbericht door', t)
        # B. radio
        pg.click('.rd-aan'); pg.wait_for_timeout(1500)
        r = pg.evaluate(STAND)
        check(r['titel'] == 'Zender Een' and 'Live radio' in (r['artiest'] or '') and r['stand'] == 'playing', 'B. radio: naam van de zender en "Live radio"', r)
        check(r['pos'] is None and 'seekto' not in r['knoppen'] and 'seekforward' not in r['knoppen'], 'B. radio: geen tijdbalk en geen spoelen (live)', r)
        check('nexttrack' in r['knoppen'] and 'previoustrack' in r['knoppen'], 'B. radio: ⏮ ⏭ om te zappen', r['knoppen'])
        pg.evaluate("() => window.__h.nexttrack && window.__h.nexttrack()"); pg.wait_for_timeout(1500)
        r2 = pg.evaluate(STAND)
        check(r2['titel'] == 'Zender Twee' and r2['stand'] == 'playing', 'B. ⏭ op het vergrendelscherm = volgende zender', r2)
        pg.evaluate("() => window.__h.pause && window.__h.pause()"); pg.wait_for_timeout(500)
        r3 = pg.evaluate(STAND); uit = pg.evaluate("() => !document.querySelector('.rd-audio')")
        # het spraakbericht speelde ook nog (de radio pauzeert dat niet zonder geluidregelaar): dan komt dat bovenaan
        check(uit and (r3['titel'] == 'Spraakbericht van Bram' or (r3['titel'] == 'Zender Twee' and r3['stand'] == 'paused')), 'B. ⏸ zet de radio uit', (uit, r3))
        pg.evaluate("() => document.querySelector('#spraak .spraak-speler')._audio.pause()"); pg.wait_for_timeout(300)
        pg.evaluate("() => window.__h.play && window.__h.play()"); pg.wait_for_timeout(300)
        r4 = pg.evaluate(STAND)
        check(r4['titel'] in ('Zender Twee', 'Spraakbericht van Bram') and r4['stand'] == 'playing', 'B/C. ▶ op het vergrendelscherm speelt weer', r4)
        # C. alles weg
        pg.evaluate("() => { document.getElementById('radio').innerHTML = ''; const a = document.querySelector('#spraak .spraak-speler')._audio; a.pause(); a.removeAttribute('src'); a.load() }")
        pg.evaluate("async () => { const m = await import('/Fibro/vergrendelscherm.js?v=1'); m.nuWeg('radio') }"); pg.wait_for_timeout(300)
        c = pg.evaluate(STAND)
        check(c['stand'] == 'none' and not c['titel'], 'C. alles gestopt: geen spelertje meer', c)
        check(not fouten, 'D. geen paginafouten', fouten)
        b.close()
finally:
    srv.terminate()
print('\n%d fout' % len(fout) if fout else '\nalles goed')
sys.exit(1 if fout else 0)
