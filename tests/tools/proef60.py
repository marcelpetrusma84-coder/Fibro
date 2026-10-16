# proef60: de stickergeluiden als mp3 (v160), met de echte profiel.html en stickerfx.js.
# A. de bestanden: 18 mp3's (een per geluid, niet 'geen'), elk speelbaar, 0,1-2,2 s, even hard (piek 0,3-0,9),
#    samen minder dan 350 kB.
# B. Profiel -> Stickers, echte klik op Boos: de mp3 zoemer.mp3 klinkt (een <audio>-speler met een blob), geen
#    code-geluid; na de eerste tik worden alle 18 opgehaald; het geluid wordt niet meteen weer stilgezet door het
#    klaarzetten (zegenen) van dezelfde tik.
# C. alle 12 stickers van vel 1: precies hun eigen mp3 (zelfde inhoud als geluiden/<g>.mp3).
# D. twee snel achter elkaar: allebei hoorbaar (twee spelers tegelijk).
# E. geen mp3 te krijgen (geen internet): het code-geluid klinkt, geen fouten.
# F. mp3's nog onderweg (traag): eerst het code-geluid na hoogstens 0,4 s, daarna de mp3.
# G. op de iPhone telt alleen het loslaten als tik: een touchend (zonder pointerdown) zet de vier spelers klaar.
# Oude map als controle: daar zijn er geen mp3's (A t/m D en F, G MIS).
# python3 -I proef60.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil, re
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
VEL1_G = ['boing', 'pling', 'ting', 'zucht', 'drama', 'pling', 'zoemer', 'alarm', 'error', 'popcorn', 'huh', 'fluit']
NAMEN = ['boing', 'pling', 'pop', 'popcorn', 'sprong', 'tsjirp', 'boem', 'alarm', 'huh', 'ting', 'klets', 'zucht', 'slurp', 'vuur', 'zoemer', 'error', 'drama', 'fluit']
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "marcel"}
        return route.fulfill(status=200, json=e if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [e])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
# Telt: code-geluiden (oscillators in de stickerfx-context), mp3's (spelers met data-stickerfx en een blob), en het zegenen
TELLER = """
(() => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
  window.__code = 0; window.__mp3 = []; window.__zegen = 0
  const comp = AC.prototype.createDynamicsCompressor, start = AudioScheduledSourceNode.prototype.start
  AC.prototype.createDynamicsCompressor = function () { this.__fx = true; return comp.apply(this, arguments) }
  AudioScheduledSourceNode.prototype.start = function () {
    if (this.context && this.context.__fx && !(this.buffer && this.buffer.length <= 1)) window.__code++
    return start.apply(this, arguments) }
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    if (this.dataset && this.dataset.stickerfx) {
      if (this._zegen) window.__zegen++
      else if (String(this.src || '').startsWith('blob:')) window.__mp3.push(this)
    }
    return speel.apply(this, arguments) }
})()
"""
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'])
    def ev(p, js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:120]
    def profiel(mp3_route=None, extra=None):
        ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); ctx.route('**/*supabase.co/**', supa); ctx.add_init_script(TELLER)
        if extra: ctx.add_init_script(extra)
        if mp3_route: ctx.route('**/geluiden/*.mp3*', mp3_route)
        p = ctx.new_page(); p.fouten = []; p.verzoeken = []
        p.on('pageerror', lambda e: p.fouten.append(str(e)[:200])); p.on('dialog', lambda d: d.dismiss())
        p.on('request', lambda r: p.verzoeken.append(r.url) if '/geluiden/' in r.url else None)
        p.goto(BASIS + 'manifest.json')
        p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
        p.goto(BASIS + 'profiel.html'); p.wait_for_timeout(600)
        ev(p, "() => switchTab('stickers')"); p.wait_for_timeout(300)
        return ctx, p
    STICKER = '#fibroStickers .sw-cel:nth-child(%d) .sw-plek'
    # inhoud van een blob en van het bestand vergelijken (eerste en laatste bytes en de lengte)
    VERGELIJK = """async ([url, naam]) => { const a = new Uint8Array(await (await fetch(url)).arrayBuffer());
      const b = new Uint8Array(await (await fetch('geluiden/' + naam + '.mp3?v=160')).arrayBuffer());
      if (a.length !== b.length) return false; for (let i = 0; i < a.length; i += 97) if (a[i] !== b[i]) return false; return true }"""

    # ── A. de bestanden ──
    print('A. de bestanden')
    ctx, p = profiel()
    info = ev(p, """async namen => { const c = new OfflineAudioContext(1, 44100, 44100); const uit = {};
      for (const n of namen) { try { const r = await fetch('geluiden/' + n + '.mp3?v=160'); const ab = await r.arrayBuffer(); const b = await c.decodeAudioData(ab.slice(0));
        const d = b.getChannelData(0); let piek = 0; for (let i = 0; i < d.length; i++) piek = Math.max(piek, Math.abs(d[i]));
        uit[n] = [r.status, ab.byteLength, Math.round(b.duration * 1000) / 1000, Math.round(piek * 1000) / 1000, b.numberOfChannels] } catch (e) { uit[n] = String(e) } }
      return uit }""", NAMEN)
    goed = isinstance(info, dict) and all(isinstance(v, list) and v[0] == 200 and 0.1 <= v[2] <= 2.2 and 0.3 <= v[3] <= 0.9 and v[4] == 1 for v in info.values())
    check('18 mp3s, elk speelbaar, 0,1-2,2 s, piek 0,3-0,9, mono', goed and len(info) == 18, info)
    totaal = sum(v[1] for v in info.values()) if goed else None
    check('samen minder dan 350 kB', totaal and totaal < 350 * 1024, totaal)
    lijst = ev(p, "async () => Object.keys((await import('./stickerfx.js?v=160')).GELUIDEN).filter(n => n !== 'geen').sort()")
    check('precies een mp3 per geluid uit stickerfx.js', lijst == sorted(NAMEN), lijst)
    ctx.close()

    # ── B. Boos aanklikken ──
    print('B. echte klik op Boos')
    ctx, p = profiel()
    p.click(STICKER % 7); p.wait_for_timeout(150)
    speelt = ev(p, "() => { const a = window.__mp3[window.__mp3.length - 1]; return a ? [!a.paused, a.src.slice(0, 5)] : null }")
    p.wait_for_timeout(500)
    st = ev(p, "() => [window.__mp3.length, window.__code]")
    check('Boos: de mp3 klinkt, geen code-geluid', st == [1, 0], st)
    check('het geluid speelt echt (niet meteen stilgezet door het klaarzetten)', speelt == [True, 'blob:'], speelt)
    p.wait_for_timeout(1500)
    gehaald = sorted(set(re.sub(r'.*/geluiden/([a-z]+)\.mp3.*', r'\1', u) for u in p.verzoeken))
    check('na de eerste tik zijn alle 18 opgehaald', gehaald == sorted(NAMEN), gehaald)
    check('elk bestand maar een keer opgehaald', len(p.verzoeken) == 18, len(p.verzoeken))
    ok = ev(p, VERGELIJK, [ev(p, "() => window.__mp3[0].src"), 'zoemer'])  # (haalt zoemer.mp3 zelf nog een keer op)
    check('het is zoemer.mp3', ok is True, ok)

    # ── C. alle 12 van vel 1 ──
    print('C. alle 12 stickers van vel 1')
    fout = []
    for i, g in enumerate(VEL1_G, 1):
        voor = ev(p, "window.__mp3.length")
        p.click(STICKER % i); p.wait_for_timeout(250)
        url = ev(p, "() => window.__mp3.length > %d ? window.__mp3[window.__mp3.length - 1].src : null" % voor)
        if not url or ev(p, VERGELIJK, [url, g]) is not True: fout.append((i, g, url and url[:20]))
        p.wait_for_timeout(300)
    check('elke sticker speelt zijn eigen mp3', not fout, fout)
    check('en nooit het code-geluid', ev(p, "window.__code") == 0, ev(p, "window.__code"))

    # ── D. twee tegelijk ──
    print('D. twee snel achter elkaar')
    p.wait_for_timeout(2500)
    p.click(STICKER % 4); p.wait_for_timeout(60); p.click(STICKER % 5); p.wait_for_timeout(150)
    tegelijk = ev(p, "() => { const a = window.__mp3.slice(-2); return a.length === 2 && a[0] !== a[1] && !a[0].paused && !a[1].paused }")
    check('Kapot en Huilen klinken tegelijk (twee spelers)', tegelijk is True, tegelijk)
    check('geen fouten (B-D)', p.fouten == [], p.fouten)
    ctx.close()

    # ── E. geen mp3 te krijgen ──
    print('E. geen mp3 (geen internet)')
    ctx, p = profiel(lambda r: r.abort())
    p.click(STICKER % 7); p.wait_for_timeout(900)
    st = ev(p, "() => [window.__mp3.length, window.__code]")
    check('het code-geluid klinkt zoals vroeger', isinstance(st, list) and st[0] == 0 and st[1] > 0, st)
    check('geen fouten (E)', p.fouten == [], p.fouten)
    ctx.close()

    # ── F. traag ──
    print('F. mp3s nog onderweg')
    # de mp3's komen pas na 1,5 s binnen (in de pagina vertraagd, zodat de proef zelf niet stilstaat)
    TRAAG = "(() => { const f = window.fetch; window.fetch = function (u) { const a = arguments; return String(u).includes('geluiden/') ? new Promise(k => setTimeout(() => k(f.apply(window, a)), 1500)) : f.apply(window, a) } })()"
    ctx, p = profiel(extra=TRAAG)
    t0 = time.time(); p.click(STICKER % 7)
    try: p.wait_for_function("() => window.__code > 0 || window.__mp3.length > 0", timeout=3000)
    except Exception: pass
    duur = time.time() - t0
    st = ev(p, "() => [window.__mp3.length, window.__code]")
    check('eerst het code-geluid, binnen 0,4 s (plus marge)', isinstance(st, list) and st[1] > 0 and st[0] == 0 and duur < 1.2, (st, round(duur, 2)))
    p.wait_for_timeout(4000)
    p.click(STICKER % 7); p.wait_for_timeout(400)
    check('daarna de mp3', ev(p, "window.__mp3.length") == 1, ev(p, "window.__mp3.length"))
    check('geen fouten (F)', p.fouten == [], p.fouten)
    ctx.close()

    # ── G. touchend ──
    print('G. touchend zet de spelers klaar')
    ctx, p = profiel()
    ev(p, "() => document.dispatchEvent(new Event('touchend'))"); p.wait_for_timeout(300)
    check('een touchend (zonder pointerdown) zegent de vier spelers', ev(p, "window.__zegen") == 4, ev(p, "window.__zegen"))
    ev(p, "() => document.dispatchEvent(new Event('touchend'))"); p.wait_for_timeout(300)
    check('een tweede tik doet het niet nog eens (ze zijn vrij)', ev(p, "window.__zegen") == 4, ev(p, "window.__zegen"))
    p.wait_for_timeout(1500)
    ev(p, "async () => { const f = await import('./stickerfx.js?v=160'); f.speelGeluid('pling') }"); p.wait_for_timeout(300)
    check('een binnenkomend geluid (zonder tik) speelt daarna als mp3', ev(p, "window.__mp3.length") == 1, ev(p, "[window.__mp3.length, window.__code]"))
    check('geen fouten (G)', p.fouten == [], p.fouten)
    ctx.close()
    br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
