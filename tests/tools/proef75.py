# proef75: profielmuziek (v179), echte profiel.html, index.html en vriend-profiel.html.
# A. Profiel: 'Profielmuziek' staat in het tabblad Profiel (niet meer bij Widgets); uploaden (echt bestand) = opgeslagen,
#    'Nu: <titel>' en een knop om weg te halen.
# B. Home (browser laat geluid toe): het nummer speelt vanzelf en herhaalt; knopje rechtsonder; echte tik = pauze;
#    opnieuw Home = blijft gepauzeerd (deze sessie), tik = verder.
# C. Home (browser wil eerst een tik, zoals de iPhone; nagebootst): eerst stil, na de eerste echte tik op de pagina speelt het.
# D. Ander geluid (bijv. de muziekspeler) pauzeert het profielnummer; een stickergeluidje niet.
# E. Menu > Instellingen: 'Muziek vanzelf afspelen: aan' (menuitemcheckbox); echte klik = uit, muziek en knopje weg,
#    opnieuw Home = stil; weer aan = speelt.
# F. Profiel van een vriend: zijn nummer (van sync.js, vriend_<id>_muziek_profiel) speelt vanzelf, 'Muziek van Bram'.
# G. Profiel: weghalen (echte klik) = weg, Home blijft stil. Geen fouten.
# Oude map als controle: geen profielmuziek (bijna alles MIS).
# python3 -I proef75.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil, wave, struct, math
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'f1a00000-0000-4000-8000-000000000009'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
werk = tempfile.mkdtemp(); WAV = werk + '/Mijn liedje.wav'
w = wave.open(WAV, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
w.writeframes(b''.join(struct.pack('<h', int(6000 * math.sin(2 * math.pi * 330 * i / 22050))) for i in range(22050 * 4))); w.close()
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
STAAT = """() => { const k = document.getElementById('profielMuziekKnop'); const a = window.__pm
  return { knop: k ? k.textContent : null, label: k ? k.getAttribute('aria-label') : null, speelt: !!(a && !a.paused), loop: !!(a && a.loop) } }"""
VANG = """(() => { const OudAudio = window.Audio; window.Audio = function (...x) { const a = new OudAudio(...x); window.__alle = (window.__alle || []).concat(a)
  queueMicrotask(() => { if (a.dataset && a.dataset.profielmuziek) window.__pm = a }); return a }; window.Audio.prototype = OudAudio.prototype })()"""
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
def ev(p, js, arg=None):
    try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
# Zoals de iPhone: geluid pas na een echte tik op deze pagina (nagebootst: Chromium zelf is hier niet streng genoeg)
IPHONE_SLOT = """(() => { let getikt = false
  for (const soort of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(soort, e => { if (e.isTrusted) getikt = true }, true)
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () { if (!getikt) return Promise.reject(new DOMException('geen tik', 'NotAllowedError')); return speel.apply(this, arguments) } })()"""
def ronde(beleid, werkje, slot=False):
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=' + beleid])
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
        ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None); ctx.add_init_script(VANG)
        if slot: ctx.add_init_script(IPHONE_SLOT)
        p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
        p.goto(B + 'manifest.json')
        p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        werkje(p)
        fouten = p.fouten; br.close(); return fouten
def uploaden(p):
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
    p.set_input_files('#muziekUpload', WAV)
    for i in range(40):
        p.wait_for_timeout(500)
        if 'opgeslagen' in (ev(p, "() => document.getElementById('muziekStatus').textContent") or ''): break
def wacht(p, ms=1500): p.wait_for_timeout(ms)
# A, B, D, E, F, G: browser laat geluid toe
def werkB(p):
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
    plek = ev(p, "() => { const s = document.getElementById('muziekUpload'); const pan = s && s.closest('.panel'); return pan ? pan.id : null }")
    kop = ev(p, "() => [...document.querySelectorAll('#panel-profiel .section-label')].map(k => k.textContent)")
    widgets = ev(p, "() => document.getElementById('panel-widgets').textContent.includes('Muziek uploaden')")
    check('A. Profielmuziek staat in het tabblad Profiel, niet meer bij Widgets', plek == 'panel-profiel' and isinstance(kop, list) and 'Profielmuziek' in kop and widgets is False, (plek, kop, widgets))
    uploaden(p)
    st = ev(p, "() => [document.getElementById('muziekStatus').textContent, (document.getElementById('muziekNuTitel') || {}).textContent, getComputedStyle(document.getElementById('muziekNu') || document.body).display]")
    check("A. uploaden (echt bestand): opgeslagen, 'Nu: Mijn liedje', knop weghalen", isinstance(st, list) and 'opgeslagen' in st[0] and st[1] == 'Nu: Mijn liedje' and st[2] == 'flex', st)
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
    nu = ev(p, "() => (document.getElementById('muziekNuTitel') || {}).textContent")
    check("A. opnieuw openen: 'Nu: Mijn liedje' staat er weer", nu == 'Nu: Mijn liedje', nu)
    # B. Home
    p.goto(B + 'index.html'); wacht(p, 3000)
    s1 = ev(p, STAAT)
    check('B. Home: het nummer speelt vanzelf en herhaalt, knopje met de titel', isinstance(s1, dict) and s1['speelt'] and s1['loop'] and 'Mijn liedje' in (s1['knop'] or ''), s1)
    try: p.click('#profielMuziekKnop', timeout=3000)
    except Exception as e: print('   knop:', str(e)[:80])
    wacht(p, 500); s2 = ev(p, STAAT)
    check('B. echte tik op het knopje = pauze', isinstance(s2, dict) and not s2['speelt'] and str(s2['label']).startswith('Profielmuziek afspelen'), s2)
    p.goto(B + 'index.html'); wacht(p, 3000); s3 = ev(p, STAAT)
    check('B. opnieuw Home: blijft gepauzeerd (deze sessie), knopje staat er', isinstance(s3, dict) and not s3['speelt'] and s3['knop'] and '▶' in s3['knop'], s3)
    try: p.click('#profielMuziekKnop', timeout=3000)
    except Exception: pass
    wacht(p, 800); s4 = ev(p, STAAT)
    check('B. tik = weer verder', isinstance(s4, dict) and s4['speelt'], s4)
    # D. ander geluid
    ev(p, "() => { const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='); a.dataset.stickerfx = '1'; a.play().catch(() => {}) }")
    wacht(p, 500); d1 = ev(p, STAAT)
    ev(p, "() => { const a = new Audio(window.__pm.src); a.loop = true; window.__ander = a; a.play().catch(() => {}) }")
    wacht(p, 1000); d2 = ev(p, STAAT)
    ev(p, "() => window.__ander && window.__ander.pause()")
    check('D. een stickergeluidje laat hem spelen, ander geluid (bijv. de muziekspeler) pauzeert hem', isinstance(d1, dict) and d1['speelt'] and isinstance(d2, dict) and not d2['speelt'], (d1 and d1.get('speelt'), d2 and d2.get('speelt')))
    # E. het menu
    p.goto(B + 'index.html'); wacht(p, 2500)
    try: p.click('#menuBtn', timeout=3000); wacht(p, 300)
    except Exception: pass
    m1 = ev(p, "() => { const b = document.querySelector('#fibroMenu [role=menuitemcheckbox]'); return b ? [b.textContent, b.getAttribute('aria-checked'), b.closest('[role=group]').querySelector('div').textContent] : null }")
    check("E. menu > Instellingen: 'Muziek vanzelf afspelen: aan'", m1 == ['\U0001F3B5 Muziek vanzelf afspelen: aan', 'true', 'Instellingen'], m1)
    try: p.click('#fibroMenu [role=menuitemcheckbox]', timeout=3000)
    except Exception: pass
    wacht(p, 800)
    m2 = ev(p, "() => { const b = document.querySelector('#fibroMenu [role=menuitemcheckbox]'); return [b ? b.textContent : null, !!document.getElementById('profielMuziekKnop'), !!(window.__pm && !window.__pm.paused)] }")
    check("E. echte klik: 'uit', muziek en knopje weg", isinstance(m2, list) and m2[0] == '\U0001F3B5 Muziek vanzelf afspelen: uit' and not m2[1] and not m2[2], m2)
    p.goto(B + 'index.html'); wacht(p, 3000); e3 = ev(p, STAAT)
    check('E. opnieuw Home: stil, geen knopje', isinstance(e3, dict) and not e3['speelt'] and e3['knop'] is None, e3)
    try: p.click('#menuBtn', timeout=3000); wacht(p, 300); p.click('#fibroMenu [role=menuitemcheckbox]', timeout=3000)
    except Exception: pass
    wacht(p, 1500); e4 = ev(p, STAAT)
    check('E. weer aan (echte klik): speelt meteen', isinstance(e4, dict) and e4['speelt'], e4)
    # F. profiel van een vriend
    ev(p, """async ([id]) => { const data = await new Promise(ok => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = () => { const q = r.result.transaction('fotos').objectStore('fotos').get('muziek_track'); q.onsuccess = () => ok(q.result && q.result.data) } })
      await new Promise(ok => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = () => { const tx = r.result.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: 'vriend_' + id + '_muziek_profiel', hash: 1, data }); tx.oncomplete = ok } }) }""", [FID])
    p.goto(B + 'vriend-profiel.html?id=' + FID); wacht(p, 3500); f1 = ev(p, STAAT)
    check("F. profiel van een vriend: zijn nummer speelt vanzelf, 'Muziek van Bram'", isinstance(f1, dict) and f1['speelt'] and 'Muziek van Bram' in (f1['knop'] or ''), f1)
    # G. weghalen
    p.goto(B + 'profiel.html'); wacht(p, 2500)
    try: p.click('#muziekNu button', timeout=3000)
    except Exception as e: print('   weghalen:', str(e)[:80])
    wacht(p, 800)
    g1 = ev(p, "() => [document.getElementById('muziekStatus').textContent, getComputedStyle(document.getElementById('muziekNu') || document.body).display]")
    p.goto(B + 'index.html'); wacht(p, 3000); g2 = ev(p, STAAT)
    check('G. weghalen (echte klik): weg, en Home blijft stil zonder knopje', isinstance(g1, list) and g1[0] == 'Nummer weggehaald' and g1[1] == 'none' and isinstance(g2, dict) and g2['knop'] is None and not g2['speelt'], (g1, g2))
fouten = ronde('no-user-gesture-required', werkB)
check('geen fouten (A, B, D, E, F, G)', not fouten, fouten)
# C. de browser wil eerst een tik (zoals de iPhone)
def werkC(p):
    uploaden(p)
    p.goto(B + 'index.html'); wacht(p, 3000); c1 = ev(p, STAAT)
    p.mouse.click(30, 450); wacht(p, 1200); c2 = ev(p, STAAT)
    check('C. browser wil eerst een tik: eerst stil (knopje met ▶), na de eerste echte tik speelt het (ook na de stille beltoon-ontgrendeling)', isinstance(c1, dict) and not c1['speelt'] and c1['knop'] and '▶' in c1['knop'] and isinstance(c2, dict) and c2['speelt'], (c1, c2))
fouten = ronde('no-user-gesture-required', werkC, slot=True)
check('geen fouten (C)', not fouten, fouten)
srv.terminate(); shutil.rmtree(www, ignore_errors=True); shutil.rmtree(werk, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
