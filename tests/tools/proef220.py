# proef220: Neon Raiders v220.
#  R. terughalen: de uitnodiger is af -> bij speler 2 een cirkel op die plek; ernaast blijven doet niets; 1 s erin en weer
#     weg: niet gered; 2 s erin: de uitnodiger doet weer mee met 1 leven, op die plek; allebei zien elkaar weer
#  S. schild: oppakken zonder schild = meteen aan (voorraad blijft); met schild aan = +1 in de voorraad;
#     een schutter met nummer 8n+3 laat een schild vallen (bij allebei dezelfde)
#  K. eigen kleur: de vleugels van schip 1 zijn blauwig, van schip 2 roodachtig
#  L. laser: eerst 1,5 s waarschuwing (rode baan, driehoek), pas daarna schiet hij
# python3 -I proef220.py <map> [plaatjesmap]
import sys, os, time, socket, subprocess, tempfile, json
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
PLAAT = sys.argv[2] if len(sys.argv) > 2 else None
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:220] if info != '' else ''), flush=True)
HARNAS = r"""<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="taal.js"></script><title>Samen proef</title>
<style>body{margin:0;background:#1a0a2e;color:#fff} #spelOverlay{position:fixed;inset:0;display:flex;flex-direction:column} #spelInhoud{flex:1;position:relative}</style></head>
<body><div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud"></div></div>
<script type="module">
const q = new URLSearchParams(location.search), rol = q.get('rol')
const bc = new BroadcastChannel('nr-proef-' + (q.get('kamer') || '1'))
const h = []
window.__kanaal = { uit: 0, in: 0, events: {}, tijden: [] }
const kanaal = { topic: 'realtime:spel_a_b_' + (q.get('kamer') || '1'), on(t, f, cb) { h.push([f && f.event, cb]); return kanaal },
  send(m) { const k = window.__kanaal; k.uit++; k.events[m.event] = (k.events[m.event] || 0) + 1; k.tijden.push([performance.now(), m.event])
    bc.postMessage({ van: rol, m: JSON.parse(JSON.stringify(m)) }); return Promise.resolve('ok') },
  subscribe(fn) { if (fn) fn('SUBSCRIBED'); return kanaal } }
bc.onmessage = e => { const d = e.data; if (d.van === rol) return; window.__kanaal.in++
  h.filter(x => x[0] === d.m.event).forEach(x => x[1]({ type: 'broadcast', event: d.m.event, payload: d.m.payload })) }
if (q.get('geenrtc')) window.RTCPeerConnection = undefined
const m = await import('./neon-raiders-ui.js?v=220')
window.__actief = true
window.__proef = await m.start({ spelKanaal: kanaal, benIkSpeler1: rol === 'host', vriendNaam: rol === 'host' ? 'Marcel' : 'Bram', isActief: () => window.__actief })
window.__klaar = true
</script></body></html>"""
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP):
    if f != 'nrsamen220.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
open(d + '/nrsamen220.html', 'w', encoding='utf-8').write(HARNAS)
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
S = 'window.__neonRaiders.scene'
fouten = []
def wacht(pg, js, ms):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def tekst(pg, sel):
    try: return pg.inner_text(sel)
    except Exception: return ''
def stand(pg):
    return pg.evaluate("""(() => { const n = window.__neonRaiders; if (!n || !n.scene || !n.scene.sys) return null; const s = n.scene
      return { level: s.level, klok: s.klok, nu: Date.now(), score: s.score, levens: s.levens, uit: s.uit, voorbij: s.voorbij, pauze: s.pauze,
        x: s.speler.x, y: s.speler.y, ax: s.anderSpr ? s.anderSpr.x : null, ay: s.anderSpr ? s.anderSpr.y : null, azien: !!(s.anderSpr && s.anderSpr.visible),
        ids: s.vijanden.filter(v => !v.dood && v.y > 0 && v.y < n.H).map(v => v.id), baas: s.baas ? s.baas.def.naam : null,
        bh: s.baas ? s.baas.delen.map(d => d.hp) : null, ronde: n.ronde(), modus: n.net ? n.net.modus() : null } })()""")
INIT = "window.__fibroProef = true; window.__nrScherpte = 1; try { localStorage.setItem('fibro_taal', 'nl'); localStorage.removeItem('nr-bereikt') } catch (e) {}"
def paar(p, kamer, guest_args=''):
    br = p.chromium.launch(args=['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, bypass_csp=True)
    ctx.add_init_script(INIT)
    h = ctx.new_page(); g = ctx.new_page()
    for pg in (h, g): pg.on('pageerror', lambda e: fouten.append(str(e)))
    h.goto(B + 'nrsamen220.html?rol=host&kamer=' + kamer)
    g.goto(B + 'nrsamen220.html?rol=guest&kamer=' + kamer + guest_args)
    return br, h, g

try:
    with sync_playwright() as p:
        try:
            br, h, g = paar(p, 'r')
            wacht(h, 'window.__klaar === true', 15000) and wacht(g, 'window.__klaar === true', 15000)
            wacht(h, "document.querySelector('.nr .rol').textContent.includes('RECHTSTREEKS') && !document.querySelector('.nr .startKnop').disabled", 15000)
            h.click('.nr .startKnop')
            wacht(h, '!!(window.__neonRaiders && %s && %s.speler)' % (S, S), 15000) and wacht(g, '!!(window.__neonRaiders && %s && %s.speler)' % (S, S), 15000)
            g.wait_for_timeout(2500)
            # K. kleuren van de schepen (pixel op de linkervleugel)
            kl = h.evaluate("""(() => { const s = %s, uit = {}
              for (const k of ['schip', 'schip2']) { const c = s.textures.get(k).getSourceImage(), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
                let r = 0, b = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; b += d[i + 2] }
                uit[k] = [Math.round(r / 1000), Math.round(b / 1000)] }
              return uit })()""" % S)
            check('K1 schip 1 blauwig, schip 2 roodachtig (som rood/blauw)', kl['schip'][1] > kl['schip'][0] * 1.15 and kl['schip2'][0] > kl['schip2'][1] * 1.15, kl)
            for pg in (h, g): pg.evaluate("(() => { const s = %s; s.godmode = true; s.onraakbaar = 9999 })()" % S)
            # S. schild
            g.evaluate("(() => { const s = %s; s.schild = 0; s.voorraad.schild = 0; s.speler.setPosition(200, 600); s.laatVallen(200, 600, 'schild', 'proefS:0') })()" % S)
            g.wait_for_timeout(700)
            s1 = g.evaluate("[%s.schild, %s.voorraad.schild]" % (S, S))
            g.evaluate("(() => { const s = %s; s.laatVallen(200, 600, 'schild', 'proefS:1') })()" % S)
            g.wait_for_timeout(700)
            s2 = g.evaluate("[%s.schild, %s.voorraad.schild]" % (S, S))
            check('S1 schild oppakken: meteen aan; met schild aan: +1 in de voorraad', s1[0] > 7 and s1[1] == 0 and s2[1] == 1, (s1, s2))
            for pg in (h, g): pg.evaluate("(() => { const s = %s; const v = s.maak('schutter', { id: 11, x: 300, y: 150 }); s.dood(v, true) })()" % S)
            vh, vg = h.evaluate("%s.buit.some(b => b.id === '11:s' && b.soort === 'schild')" % S), g.evaluate("%s.buit.some(b => b.id === '11:s' && b.soort === 'schild')" % S)
            for pg in (h, g): pg.evaluate("(() => { const s = %s; const v = s.maak('schutter', { id: 12, x: 300, y: 150 }); s.dood(v, true) })()" % S)
            geen = not g.evaluate("%s.buit.some(b => b.id === '12:s')" % S)
            check('S2 schutter nummer 11 laat bij allebei een schild vallen, nummer 12 niet', vh and vg and geen, (vh, vg, geen))
            # R. terughalen
            h.evaluate("(() => { const s = %s; s.speler.setPosition(120, 500); s.godmode = false; s.levens = 1; s.onraakbaar = 0; s.schild = 0; s.overgang = 0; s.geraakt() })()" % S)
            g.evaluate("(() => { const s = %s; s.speler.setPosition(320, 650) })()" % S)
            cirkel = wacht(g, '!!(%s.wrak && !%s.wrak.eigen)' % (S, S), 3000)
            w = g.evaluate("%s.wrak && [%s.wrak.x, %s.wrak.y]" % (S, S, S)) if cirkel else None
            eigen = h.evaluate("!!(%s.wrak && %s.wrak.eigen) && %s.uit" % (S, S, S))
            check('R1 de uitnodiger af: bij speler 2 een cirkel op zijn plek, bij hemzelf ook ("HIER")', cirkel and eigen and abs(w[0] - 120) < 3 and abs(w[1] - 500) < 3, (w, eigen, tekst(h, '.nr .bord')[:80]))
            if PLAAT:
                g.wait_for_timeout(300); g.screenshot(path=PLAAT + '/r1-speler2.png'); h.screenshot(path=PLAAT + '/r1-uitnodiger.png')
            g.wait_for_timeout(2500)
            check('R2 ernaast blijven: niets', h.evaluate(S + '.uit') and g.evaluate(S + '.wrak.voortgang') == 0)
            g.evaluate("(() => { const s = %s; s.speler.setPosition(125, 505) })()" % S)
            g.wait_for_timeout(1000)
            if PLAAT: g.screenshot(path=PLAAT + '/r3-bezig.png')
            g.evaluate("(() => { const s = %s; s.speler.setPosition(320, 650) })()" % S)
            g.wait_for_timeout(2500)
            check('R3 1 s erin en weer weg: niet gered, de boog loopt terug', h.evaluate(S + '.uit') and g.evaluate(S + '.wrak.voortgang') < 0.2, g.evaluate(S + '.wrak && ' + S + '.wrak.voortgang'))
            g.evaluate("(() => { const s = %s; s.speler.setPosition(118, 498) })()" % S)
            gered = wacht(h, '!%s.uit' % S, 5000)
            g.wait_for_timeout(1200)
            sh, sg = stand(h), stand(g)
            rijG = tekst(g, '.nr .anderRij')
            check('R4 2 s erin: de uitnodiger doet weer mee met 1 leven, op zijn plek', gered and sh['levens'] == 1 and h.evaluate(S + '.speler.visible') and abs(sh['x'] - 120) < 3 and abs(sh['y'] - 500) < 3, (gered, sh['levens'], sh['x'], sh['y']))
            check('R5 allebei zien elkaar weer, geen cirkel meer, rij niet meer GAME OVER', sg['azien'] and sh['azien'] and not g.evaluate(S + '.wrak') and not h.evaluate(S + '.wrak') and 'GAME OVER' not in rijG, (sg['azien'], sh['azien'], rijG))
            check('R6 tekst bij de geredde: "GERED DOOR BRAM!"', 'GERED DOOR' in tekst(h, '.nr .bord'), tekst(h, '.nr .bord'))
            # L. laser
            for pg in (h, g): pg.evaluate("(() => { const s = %s; s.godmode = true; s.onraakbaar = 9999 })()" % S)
            for pg in (h, g): pg.evaluate("(() => { %s.tijdSchaal = 4 })()" % S)
            h.evaluate("(() => { const s = %s; s.klok = 104 })()" % S)
            komt = wacht(h, '!!(%s.baas && %s.baas.binnen)' % (S, S), 25000)
            for pg in (h, g): pg.evaluate("(() => { %s.tijdSchaal = 1 })()" % S)
            g.wait_for_timeout(500)
            h.evaluate("(() => { const s = %s, b = s.baas; b.laser = null; b.klok.laser = -99; const k = b.delen.find(d => d.kern); s.speler.setPosition(180, 600); s.laserStart(b, k); window.__lt0 = performance.now() })()" % S)
            h.wait_for_timeout(700)
            l1 = h.evaluate("(() => { const L = %s.baas.laser; return L && [L.t, !!L.vuur, %s.fx.commandBuffer.length] })()" % (S, S))
            if PLAAT: h.screenshot(path=PLAAT + '/l1-waarschuwing.png')
            h.wait_for_timeout(1300)
            l2 = h.evaluate("(() => { const L = %s.baas.laser; return L && [L.t, !!L.vuur] })()" % S)
            if PLAAT: h.screenshot(path=PLAAT + '/l2-vuur.png')
            check('L1 laser: eerst waarschuwing (rode baan, veel getekend), na 1,5 s schiet hij', komt and l1 and not l1[1] and l1[2] > 40 and l2 and l2[1], (komt, l1, l2))
            br.close()
        except Exception as e:
            check('proef afgebroken', False, str(e).split(chr(10))[0])
            try: br.close()
            except Exception: pass
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef220: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
