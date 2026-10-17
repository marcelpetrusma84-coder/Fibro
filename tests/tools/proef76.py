# proef76: de geluidsregelaar (v180), echte index.html en vriend-profiel.html met echte klikken. Op Home staan de
# profielmuziek, de muziekspeler (1 nummer), de video-widget (webm met geluid, gemaakt met ffmpeg) en een sticker.
# A. Home: profielmuziek speelt; speler ▶ = profielmuziek wacht (stapel), knop ⏸; video = speler wacht (knop ▶);
#    video dicht = speler verder (knop ⏸); speler zelf ⏸ = profielmuziek verder, zacht ingefade.
# B. Sticker aantikken: de muziek pauzeert meteen en gaat na het geluid verder; twee stickers snel na elkaar: nooit twee
#    stickergeluiden tegelijk. Zelf gepauzeerde profielmuziek blijft na een sticker gepauzeerd.
# C. Kort geluid (zoals de buzz, 'fibro-geluid'): muziek wacht en gaat verder; meldingen.js meldt de buzz zo.
#    Een beltoon (onbekende speler die blijft klinken) onderbreekt; een stil ontgrendel-geluidje van 50 ms niet.
# D. Vergrendelscherm (Media Session): titel; de pauze- en de verder-knop werken.
# E. 's Nachts (23 uur): niets vanzelf, knopje met ▶; tik = speelt.
# F. Menu: twee schakelaars ('Mijn muziek vanzelf', 'Muziek van vrienden vanzelf'); vrienden uit = bij een vriend het
#    knopje met ▶ maar stil; tik = speelt. Bij een vriend (aan): zijn nummer speelt; zijn muziekspeler ▶ = wacht; ⏸ = verder.
# Oude map als controle (bijna alles MIS). Geen fouten.
# python3 -I proef76.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil, wave, struct, math, base64, io
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
def wav(sec, hz):
    b = io.BytesIO(); w = wave.open(b, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
    w.writeframes(b''.join(struct.pack('<h', int(5000 * math.sin(2 * math.pi * hz * i / 22050))) for i in range(int(22050 * sec)))); w.close()
    return b.getvalue()
url = lambda data, soort: 'data:%s;base64,%s' % (soort, base64.b64encode(data).decode())
LIED = url(wav(6, 330), 'audio/wav'); SPELER = url(wav(8, 440), 'audio/wav')
werk = tempfile.mkdtemp()
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=160x120:d=6', '-f', 'lavfi', '-i', 'sine=f=550:d=6',
                '-shortest', '-c:v', 'libvpx', '-b:v', '100k', '-c:a', 'libopus', werk + '/clip.webm'], check=True)
VIDEO = url(open(werk + '/clip.webm', 'rb').read(), 'video/webm')
# een kopie van de app met een stickerplaatje en stickergeluiden (upload-alles heeft ze niet)
www = tempfile.mkdtemp(); APP = www + '/Fibro'
shutil.copytree(MAP, APP, ignore=shutil.ignore_patterns('tests', '.git'))
os.makedirs(APP + '/stickers/f1', exist_ok=True); os.makedirs(APP + '/geluiden', exist_ok=True)
from PIL import Image
for nr in range(1, 13):
    if not os.path.exists(APP + '/stickers/f1/%02d.webp' % nr): Image.new('RGB', (384, 384), (200, 80, 160)).save(APP + '/stickers/f1/%02d.webp' % nr, 'WEBP')
for naam in ['lach', 'ssst', 'snurk', 'moe', 'huil', 'hartklop']:
    open(APP + '/geluiden/%s.mp3' % naam, 'wb').write(wav(0.7, 880))
MELDINGEN_MELDT = "'fibro-geluid'" in open(APP + '/meldingen.js', encoding='utf-8').read()
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        if FID in u or 'in.' in u:
            v = {"id": FID, "username": "Bram", "avatar_url": "\U0001F438", "online_status": False}; return route.fulfill(status=200, json=v if obj else [v])
        e = {"id": UID, "username": "Marcel"}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
INIT = """(() => { const OudAudio = window.Audio; window.__alle = []
  window.Audio = function (...x) { const a = new OudAudio(...x); window.__alle.push(a); return a }; window.Audio.prototype = OudAudio.prototype
  window.__sessie = {}; try { const z = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession)
    navigator.mediaSession.setActionHandler = (a, f) => { window.__sessie[a] = f; return z(a, f) } } catch (e) {} })()"""
NACHT = "(() => { Date.prototype.getHours = function () { return 23 } })()"
ZET = """async ([sleutels]) => { const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }; r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  await new Promise(ok => { const tx = db.transaction('fotos', 'readwrite'); for (const [id, data] of sleutels) tx.objectStore('fotos').put({ id, data, hash: 1 }); tx.oncomplete = ok }) }"""
STAND = """() => { const pm = window.__alle.find(a => a.dataset && a.dataset.profielmuziek); const sp = window.__alle.filter(a => a.dataset && a.dataset.fibroGeluid === 'muziek').pop()
  const v = document.querySelector('video'); const k = document.getElementById('profielMuziekKnop')
  return { pm: pm ? !pm.paused : null, pmVol: pm ? Math.round(pm.volume * 100) / 100 : null, speler: sp ? !sp.paused : null, video: v ? !v.paused : null,
           knop: k ? k.textContent : null, spelerKnop: (document.getElementById('muz-play') || document.querySelector('#vm-play') || {}).textContent || null,
           stickers: window.__alle.filter(a => a.dataset && a.dataset.stickerfx && !a.paused && !a._zegen).length,
           regelaar: window.fibroGeluid ? window.fibroGeluid.stand() : null } }"""
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
def ev(p, js, arg=None):
    try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
def klik(p, sel):
    try: p.click(sel, timeout=3000); return True
    except Exception as e: print('   klik', sel, str(e)[:70]); return False
LAYOUT = [{'id': 'muziek', 'icon': '\U0001F3B5', 'titel': 'Muziek player', 'w': 4, 'h': 2, 'volgorde': 0, 'aan': True},
          {'id': 'video', 'icon': '\U0001F3AC', 'titel': 'Video', 'w': 4, 'h': 3, 'volgorde': 1, 'aan': True},
          {'id': 'sticker_f1-02', 'icon': '\U0001F3A8', 'titel': 'Sticker', 'w': 1, 'h': 1, 'geenHeader': True, 'volgorde': 2, 'aan': True}]
def pagina(br, nacht=False):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 1100})
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None); ctx.add_init_script(INIT)
    if nacht: ctx.add_init_script(NACHT)
    p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'manifest.json')
    ev(p, "([t, u, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())); localStorage.setItem('fibro_widgets_profiel_' + u, JSON.stringify(l)) }", [TOKEN, UID, LAYOUT])
    ev(p, ZET, [[['muziek_track', LIED], ['muziek_titel', 'Mijn liedje'], ['muziek_index_' + UID, json.dumps([{'naam': 'Lied A', 'artiest': ''}])], ['muziek_nr_' + UID + '_0', SPELER],
                 ['video_data_' + UID, VIDEO], ['video_meta_' + UID, json.dumps({'thumb': 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'breedte': 160, 'hoogte': 120, 'duur': 6, 'titel': 'Clip'})],
                 ['vriend_' + FID + '_muziek_profiel', LIED], ['vriend_' + FID + '_muziek_index', json.dumps([{'naam': 'Lied B', 'artiest': ''}])], ['vriend_' + FID + '_muziek_nr0', SPELER],
                 ['vriend_' + FID + '_layout', json.dumps([{'id': 'muziek', 'icon': '\U0001F3B5', 'titel': 'Muziek', 'w': 4, 'h': 2, 'volgorde': 0, 'aan': True}])]]])
    return ctx, p
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    ctx, p = pagina(br)
    p.goto(B + 'index.html'); p.wait_for_timeout(3500)
    s = ev(p, STAND)
    check('A. Home: de profielmuziek speelt vanzelf', isinstance(s, dict) and s['pm'] is True, s)
    klik(p, '#muz-play'); p.wait_for_timeout(900); s = ev(p, STAND)
    check('A. speler ▶ (echte klik): speler speelt, profielmuziek wacht (stapel), knop ⏸', isinstance(s, dict) and s['speler'] and s['pm'] is False and s['spelerKnop'] == '⏸'
          and (s['regelaar'] or {}).get('stapel') == ['achtergrond'], s)
    klik(p, '#vid-play'); p.wait_for_timeout(2500); s = ev(p, STAND)
    check('A. video starten (echte klik): speler wacht, knop ▶', isinstance(s, dict) and s['video'] and s['speler'] is False and s['pm'] is False and s['spelerKnop'] == '▶'
          and (s['regelaar'] or {}).get('stapel') == ['achtergrond', 'muziek'], s)
    klik(p, '#vid-sluit'); p.wait_for_timeout(1200); s = ev(p, STAND)
    check('A. video dicht (echte klik): de speler gaat verder, knop ⏸', isinstance(s, dict) and s['speler'] and s['pm'] is False and s['spelerKnop'] == '⏸', s)
    klik(p, '#muz-play'); p.wait_for_timeout(500); s1 = ev(p, STAND); p.wait_for_timeout(900); s2 = ev(p, STAND)
    check('A. speler zelf ⏸: de profielmuziek gaat verder, zacht ingefade (eerst zachter, dan 0,7)', isinstance(s2, dict) and s2['pm'] and s2['speler'] is False
          and isinstance(s1, dict) and s1['pmVol'] is not None and s1['pmVol'] < 0.7 and s2['pmVol'] == 0.7, (s1 and s1.get('pmVol'), s2))
    # B. stickers
    p.wait_for_timeout(1500)
    klik(p, '.widget-blok[data-id="sticker_f1-02"] img'); p.wait_for_timeout(300); b1 = ev(p, STAND)
    p.wait_for_timeout(2600); b2 = ev(p, STAND)
    check('B. sticker aantikken (echte klik): de muziek pauzeert meteen en gaat daarna verder', isinstance(b1, dict) and b1['pm'] is False and isinstance(b2, dict) and b2['pm'], (b1 and b1['pm'], b2 and b2['pm']))
    klik(p, '.widget-blok[data-id="sticker_f1-02"] img'); p.wait_for_timeout(150)
    klik(p, '.widget-blok[data-id="sticker_f1-02"] img'); p.wait_for_timeout(250); b3 = ev(p, STAND)
    check('B. twee stickers snel na elkaar: nooit twee stickergeluiden tegelijk', isinstance(b3, dict) and b3['stickers'] <= 1, b3 and b3['stickers'])
    p.wait_for_timeout(2600)
    klik(p, '#profielMuziekKnop'); p.wait_for_timeout(300)
    klik(p, '.widget-blok[data-id="sticker_f1-02"] img'); p.wait_for_timeout(2800); b4 = ev(p, STAND)
    check('B. zelf gepauzeerde profielmuziek blijft na een sticker gepauzeerd', isinstance(b4, dict) and b4['pm'] is False, b4)
    klik(p, '#profielMuziekKnop'); p.wait_for_timeout(800)
    # C. kort geluid, beltoon, stil ontgrendelen
    ev(p, "() => window.dispatchEvent(new CustomEvent('fibro-geluid', { detail: { soort: 'kort', ms: 1150 } }))"); p.wait_for_timeout(250); c1 = ev(p, STAND)
    p.wait_for_timeout(1800); c2 = ev(p, STAND)
    check("C. kort geluid (zoals de buzz): muziek wacht en gaat verder; meldingen.js meldt de buzz", MELDINGEN_MELDT and isinstance(c1, dict) and c1['pm'] is False and isinstance(c2, dict) and c2['pm'], (MELDINGEN_MELDT, c1 and c1['pm'], c2 and c2['pm']))
    ev(p, "() => { const a = document.createElement('audio'); a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='; document.body.appendChild(a); a.play().catch(() => {}) }")
    p.wait_for_timeout(600); c3 = ev(p, STAND)
    check('C. een stil ontgrendel-geluidje (50 ms) onderbreekt niet', isinstance(c3, dict) and c3['pm'], c3 and c3['pm'])
    ev(p, "src => { const a = document.createElement('audio'); a.loop = true; a.src = src; a.id = 'beltest'; document.body.appendChild(a); a.play().catch(() => {}) }", SPELER)
    p.wait_for_timeout(900); c4 = ev(p, STAND)
    ev(p, "() => document.getElementById('beltest').pause()"); p.wait_for_timeout(1200); c5 = ev(p, STAND)
    check('C. beltoon (blijft klinken): muziek wacht; beltoon stil = muziek verder', isinstance(c4, dict) and c4['pm'] is False and isinstance(c5, dict) and c5['pm'], (c4 and c4['pm'], c5 and c5['pm']))
    # D. vergrendelscherm
    d1 = ev(p, "() => [navigator.mediaSession.metadata && navigator.mediaSession.metadata.title, navigator.mediaSession.playbackState, Object.keys(window.__sessie).sort()]")
    ev(p, "() => window.__sessie.pause && window.__sessie.pause()"); p.wait_for_timeout(500); d2 = ev(p, STAND)
    ev(p, "() => window.__sessie.play && window.__sessie.play()"); p.wait_for_timeout(800); d3 = ev(p, STAND)
    check('D. vergrendelscherm: titel Mijn liedje, pauze en verder werken', isinstance(d1, list) and d1[0] == 'Mijn liedje' and d1[1] == 'playing' and 'pause' in d1[2] and 'play' in d1[2]
          and isinstance(d2, dict) and d2['pm'] is False and isinstance(d3, dict) and d3['pm'], (d1, d2 and d2['pm'], d3 and d3['pm']))
    # F. menu en vrienden
    klik(p, '#menuBtn'); p.wait_for_timeout(300)
    f1 = ev(p, "() => [...document.querySelectorAll('#fibroMenu [role=menuitemcheckbox]')].map(b => [b.textContent, b.getAttribute('aria-checked')])")
    check("F. menu: 'Mijn muziek vanzelf: aan' en 'Muziek van vrienden vanzelf: aan'", f1 == [['\U0001F3B5 Mijn muziek vanzelf: aan', 'true'], ['\U0001F3B5 Muziek van vrienden vanzelf: aan', 'true']], f1)
    p.goto(B + 'vriend-profiel.html?id=' + FID); p.wait_for_timeout(3500); v1 = ev(p, STAND)
    check('F. bij een vriend: zijn nummer speelt vanzelf', isinstance(v1, dict) and v1['pm'] and 'Muziek van Bram' in (v1['knop'] or ''), v1)
    klik(p, '#vm-play'); p.wait_for_timeout(900); v2 = ev(p, STAND)
    klik(p, '#vm-play'); p.wait_for_timeout(1300); v3 = ev(p, STAND)
    check('F. zijn muziekspeler ▶: zijn nummer wacht; ⏸: weer verder', isinstance(v2, dict) and v2['speler'] and v2['pm'] is False and isinstance(v3, dict) and v3['pm'] and v3['speler'] is False, (v2, v3))
    p.goto(B + 'index.html'); p.wait_for_timeout(2500)
    klik(p, '#menuBtn'); p.wait_for_timeout(300)
    klik(p, '#fibroMenu [role=menuitemcheckbox]:has-text("vrienden")'); p.wait_for_timeout(300)
    f2 = ev(p, "() => [...document.querySelectorAll('#fibroMenu [role=menuitemcheckbox]')].map(b => b.textContent)")
    p.goto(B + 'vriend-profiel.html?id=' + FID); p.wait_for_timeout(3500); v4 = ev(p, STAND)
    klik(p, '#profielMuziekKnop'); p.wait_for_timeout(800); v5 = ev(p, STAND)
    check("F. 'Muziek van vrienden vanzelf: uit' (echte klik): bij een vriend stil met ▶; tik = speelt", isinstance(f2, list) and len(f2) == 2 and f2[1].endswith('uit')
          and isinstance(v4, dict) and v4['pm'] is False and '▶' in (v4['knop'] or '') and isinstance(v5, dict) and v5['pm'], (f2, v4, v5))
    check('geen fouten (Home en vriend)', not p.fouten, p.fouten)
    ctx.close()
    # E. 's nachts
    ctx, p = pagina(br, nacht=True)
    p.goto(B + 'index.html'); p.wait_for_timeout(3500); e1 = ev(p, STAND)
    klik(p, '#profielMuziekKnop'); p.wait_for_timeout(800); e2 = ev(p, STAND)
    check("E. 's nachts (23 uur): niets vanzelf, knopje met ▶; tik = speelt", isinstance(e1, dict) and e1['pm'] is False and '▶' in (e1['knop'] or '') and isinstance(e2, dict) and e2['pm'], (e1, e2))
    check('geen fouten (nacht)', not p.fouten, p.fouten)
    ctx.close(); br.close()
srv.terminate(); shutil.rmtree(www, ignore_errors=True); shutil.rmtree(werk, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
