# proef90: Neon Raiders samen spelen (v194). Twee pagina's in dezelfde browser spelen samen via een proefpagina
# (nrsamen.html, wordt hier gemaakt) met een nagemaakt spelkanaal (BroadcastChannel tussen de twee pagina's, zoals
# Supabase dat doet) en een echte WebRTC-verbinding tussen de twee pagina's (spelnet.js, met de echte ice-config.js).
#  A. wachtkamer: speler 2 ziet 'BRAM START HET SPEL', de uitnodiger eerst 'WACHT OP MARCEL', daarna
#     'RECHTSTREEKS VERBONDEN' en een START-knop die het doet; via het spelkanaal gaan alleen een paar berichtjes
#  B. samen spelen: allebei level 1, elk ziet het schip van de ander op de goede plek, de speltijd loopt gelijk,
#     dezelfde vijanden (zelfde nummers); speler 2 schiet: bij de uitnodiger gaan die vijanden ook dood (zonder punten
#     voor hem) en staat de score van speler 2 rechtsboven; een opgepakte power-up verdwijnt bij de ander; een bom
#     van de ander ruimt ook hier de kogels op; berichten per seconde (rechtstreeks, niet via het spelkanaal)
#  C. de eindbaas: komt bij allebei, schade van speler 2 telt bij de uitnodiger, de laagste stand telt, kern kapot =
#     allebei level 2; pauze bij de een = wachten bij de ander, en samen weer verder
#  D. af: de uitnodiger af = meekijken (schip weg, bij de ander 'GAME OVER' in de rij), bij een nieuw level weer mee
#     (2 levens); allebei af = game over bij allebei met de score van de ander; OPNIEUW = allebei weer level 1
#  E. reserve: speler 2 zonder WebRTC: na hoogstens ±11 s 'VERBONDEN (RESERVE)', het spel loopt, hooguit 4 berichten
#     per seconde over het spelkanaal (per speler), het schip van de ander is te zien
# Oude map (v193) als controle: daar kan Neon Raiders niet samen, dus bijna alles MIS.
# window.__fibroProef = true (het spel zet window.__neonRaiders), window.__nrScherpte = 1 (sneller in de proef).
# python3 -I proef90.py <map>
import sys, os, time, socket, subprocess, tempfile, json
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
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
const m = await import('./neon-raiders-ui.js?v=194')
window.__actief = true
window.__proef = await m.start({ spelKanaal: kanaal, benIkSpeler1: rol === 'host', vriendNaam: rol === 'host' ? 'Marcel' : 'Bram', isActief: () => window.__actief })
window.__klaar = true
</script></body></html>"""
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP):
    if f != 'nrsamen.html': os.symlink(os.path.join(MAP, f), os.path.join(d, f))
open(d + '/nrsamen.html', 'w', encoding='utf-8').write(HARNAS)
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
    h.goto(B + 'nrsamen.html?rol=host&kamer=' + kamer)
    g.goto(B + 'nrsamen.html?rol=guest&kamer=' + kamer + guest_args)
    return br, h, g
try:
    with sync_playwright() as p:
        try:
            br, h, g = paar(p, 'a')
            ok = wacht(h, 'window.__klaar === true', 15000) and wacht(g, 'window.__klaar === true', 15000)
            check('A1 beide pagina\'s geladen', ok)
            rg = tekst(g, '.nr .rol')
            check('A2 speler 2: "BRAM START HET SPEL", geen startknop', 'BRAM START HET SPEL' in rg and g.evaluate("document.querySelector('.nr .startKnop').hidden"), rg)
            verbonden = wacht(h, "document.querySelector('.nr .rol').textContent.includes('RECHTSTREEKS') && !document.querySelector('.nr .startKnop').disabled", 15000)
            check('A3 uitnodiger: "RECHTSTREEKS VERBONDEN", START doet het', verbonden, tekst(h, '.nr .rol'))
            m = (h.evaluate('window.__proef._proef.modus()'), g.evaluate('window.__proef._proef.modus()'))
            check('A4 allebei rechtstreeks (WebRTC)', m == ('direct', 'direct'), m)
            k0 = (h.evaluate('window.__kanaal.uit'), g.evaluate('window.__kanaal.uit'))
            # B. samen spelen
            h.click('.nr .startKnop')
            gestart = wacht(h, '!!(window.__neonRaiders && window.__neonRaiders.scene && window.__neonRaiders.scene.speler)', 15000) and \
                      wacht(g, '!!(window.__neonRaiders && window.__neonRaiders.scene && window.__neonRaiders.scene.speler)', 15000)
            sh, sg = stand(h), stand(g)
            check('B1 START: allebei level 1, ronde 1', gestart and sh and sg and sh['level'] == 1 and sg['level'] == 1 and sh['ronde'] == 1 and sg['ronde'] == 1, (sh and sh['level'], sg and sg['level']))
            for pg in (h, g): pg.evaluate("(() => { const s = %s; s.godmode = true })()" % S)
            h.evaluate("(() => { const s = %s; s.speler.setPosition(90, 600) })()" % S)
            g.evaluate("(() => { const s = %s; s.speler.setPosition(270, 560) })()" % S)
            g.wait_for_timeout(2500)
            sh, sg = stand(h), stand(g)
            check('B2 elk ziet het schip van de ander op de goede plek', sh['azien'] and sg['azien'] and abs(sh['ax'] - 270) < 25 and abs(sh['ay'] - 560) < 25 and abs(sg['ax'] - 90) < 25 and abs(sg['ay'] - 600) < 25,
                  (round(sh['ax'] or 0), round(sh['ay'] or 0), round(sg['ax'] or 0), round(sg['ay'] or 0)))
            verschil = (sg['klok'] - sh['klok']) - (sg['nu'] - sh['nu']) / 1000
            check('B3 de speltijd loopt gelijk (verschil < 0,35 s)', abs(verschil) < 0.35, round(verschil, 3))
            for pg in (h, g): pg.evaluate("(() => { %s.tijdSchaal = 4 })()" % S)   # versneld (de proef tekent traag)
            # alle vijanden die in 10 s voorbijkomen, bij allebei (nummer + soort)
            for pg in (h, g): pg.evaluate("(() => { const s = %s, o = s.maak.bind(s); s.__gezien = []; s.maak = (soort, x) => { const v = o(soort, x); s.__gezien.push(v.id + ':' + soort); return v } })()" % S)
            g.wait_for_timeout(10000)
            a, b = set(h.evaluate(S + '.__gezien')), set(g.evaluate(S + '.__gezien'))
            samen = len(a & b) / max(1, len(a | b))
            check('B4 dezelfde vijanden met dezelfde nummers', len(a | b) >= 4 and samen >= 0.8, (len(a), len(b), round(samen, 2), sorted(a ^ b)[:6]))
            h.evaluate("(() => { const s = %s, o = s.dood.bind(s); s.__doodAnder = 0; s.dood = (v, x) => { if (x) s.__doodAnder++; return o(v, x) }; s.onraakbaar = 9999; s.score = 0 })()" % S)   # (onraakbaar: hij ramt niets)
            g.evaluate("(() => { const n = window.__neonRaiders; n.toets.vuur = 1; n.scene.niveau.puls = 3 })()")
            g.wait_for_timeout(8000)
            sh, sg = stand(h), stand(g)
            dh = h.evaluate(S + '.__doodAnder')
            rij = tekst(h, '.nr .anderRij')
            check('B5 speler 2 schiet: bij de uitnodiger gaan die vijanden ook dood, zonder punten voor hem', dh >= 3 and sh['score'] == 0 and sg['score'] > 0, (dh, sh['score'], sg['score']))
            getoond = int(''.join(c for c in rij.split('\u00d7')[0] if c.isdigit()) or 0)
            check('B6 de score van speler 2 staat rechtsboven bij de uitnodiger (MARCEL)', 'MARCEL' in rij and 0 < getoond <= sg['score'] and sg['score'] - getoond < 5000, (rij.replace('\n', ' '), sg['score']))
            g.evaluate("(() => { window.__neonRaiders.toets.vuur = 0 })()")
            # power-up: dezelfde capsule bij allebei, speler 2 pakt hem
            for pg in (h, g): pg.evaluate("(() => { const s = %s; s.laatVallen(270, 520, 'spreid', 'proef:0') })()" % S)
            pak = wacht(g, "!%s.buit.some(b => b.id === 'proef:0')" % S, 4000)
            weg = wacht(h, "!%s.buit.some(b => b.id === 'proef:0')" % S, 3000)
            check('B7 speler 2 pakt een power-up: bij de uitnodiger is hij ook weg (en hij krijgt hem niet)', pak and weg and not h.evaluate(S + '.niveau.spreid') and g.evaluate(S + '.niveau.spreid') == 1)
            # bom van speler 2
            h.evaluate("(() => { const s = %s, o = s.bomVanAnder.bind(s); s.__bom = 0; s.bomVanAnder = (x, y) => { s.__bom++; return o(x, y) }; s.kogel(180, 200, 'orb', 0, 20) })()" % S)
            bomH = h.evaluate(S + '.voorraad.bom')
            g.evaluate("(() => { %s.gebruikBom() })()" % S)
            bom = wacht(h, S + '.__bom === 1', 3000)
            check('B8 bom van speler 2: ook bij de uitnodiger (kogels weg), zijn eigen bommen blijven', bom and h.evaluate(S + '.kogelsV.length') == 0 and h.evaluate(S + '.voorraad.bom') == bomH)
            k1 = (h.evaluate('window.__kanaal.uit'), g.evaluate('window.__kanaal.uit'))
            check('B9 tijdens het spel niets via het spelkanaal (alles rechtstreeks)', k1[0] - k0[0] <= 1 and k1[1] - k0[1] <= 1, (k0, k1))
            # C. de eindbaas
            h.evaluate("(() => { const s = %s; s.klok = 104 })()" % S)
            sprong = wacht(g, S + '.klok > 103', 4000)
            komt = wacht(h, '!!(%s.baas && %s.baas.binnen)' % (S, S), 25000) and wacht(g, '!!(%s.baas && %s.baas.binnen)' % (S, S), 8000)
            sh, sg = stand(h), stand(g)
            check('C1 speler 2 springt mee in de tijd, de eindbaas TITAN komt bij allebei', sprong and komt and sh['baas'] == 'TITAN' and sg['baas'] == 'TITAN', (sprong, sh['baas'], sg['baas']))
            voor = h.evaluate(S + '.baas.delen[0].hp')
            g.evaluate("(() => { const s = %s; s.raak(s.baas.delen[0], 50) })()" % S)
            g.wait_for_timeout(800)
            na = h.evaluate(S + '.baas.delen[0].hp')
            check('C2 schade van speler 2 aan de baas telt ook bij de uitnodiger', voor - na >= 49.5, (voor, na))
            g.evaluate("(() => { const s = %s; s.baas.delen[1].hp = 7 })()" % S)
            laag = wacht(h, S + '.baas.delen[1].hp <= 7.05', 3000)
            check('C3 van de baas telt de laagste stand', laag, h.evaluate(S + '.baas.delen[1].hp'))
            # pauze
            g.evaluate("(() => { %s.pauzeer() })()" % S)
            p1 = wacht(h, S + '.pauze === true && %s.pauzeAnder === true' % S, 3000)
            bordH = tekst(h, '.nr .bord')
            h.evaluate("(() => { %s.hervat() })()" % S)   # de uitnodiger tikt: hij kan niet alleen verder
            h.wait_for_timeout(300)
            nogPauze = h.evaluate(S + '.pauze')
            g.evaluate("(() => { %s.hervat() })()" % S)
            p2 = wacht(h, S + '.pauze === false', 3000) and not g.evaluate(S + '.pauze')
            check('C4 pauze bij speler 2: de uitnodiger wacht ("MARCEL PAUZEERT"), en ze gaan samen verder', p1 and 'MARCEL PAUZEERT' in bordH and nogPauze and p2, (p1, bordH.replace('\n', ' '), nogPauze, p2))
            # kern kapot
            g.evaluate("(() => { const s = %s, b = s.baas; b.delen.filter(d => !d.kern).forEach(d => s.raak(d, 99999)) })()" % S)
            g.wait_for_timeout(1200)
            g.evaluate("(() => { const s = %s, b = s.baas; s.raak(b.delen.find(d => d.kern), 99999) })()" % S)
            l2 = wacht(h, S + '.level === 2', 15000) and wacht(g, S + '.level === 2', 15000)
            check('C5 speler 2 schiet de kern kapot: allebei door naar level 2', l2, (stand(h)['level'], stand(g)['level']))
            # D. af
            g.wait_for_timeout(1500)
            h.evaluate("(() => { const s = %s; s.godmode = false; s.levens = 1; s.onraakbaar = 0; s.schild = 0; s.overgang = 0; s.geraakt() })()" % S)
            g.wait_for_timeout(1200)
            sh, sg = stand(h), stand(g)
            rijG = tekst(g, '.nr .anderRij')
            check('D1 de uitnodiger af: hij kijkt mee (schip weg), bij speler 2 "GAME OVER" in zijn rij', sh['uit'] and not sh['voorbij'] and not h.evaluate(S + '.speler.visible') and not sg['azien'] and 'GAME OVER' in rijG, (sh['uit'], sh['voorbij'], sg['azien'], rijG))
            g.evaluate("(() => { %s.naarLevel(3) })()" % S)
            terug = wacht(h, S + '.level === 3 && !%s.uit' % S, 8000)
            check('D2 nieuw level (speler 2 gaat naar level 3, de uitnodiger volgt): weer mee met 2 levens', terug and h.evaluate(S + '.levens') == 2 and h.evaluate(S + '.speler.visible'), stand(h)['level'])
            g.wait_for_timeout(3500)
            h.evaluate("(() => { const s = %s; s.levens = 1; s.onraakbaar = 0; s.schild = 0; s.overgang = 0; s.geraakt() })()" % S)
            g.wait_for_timeout(600)
            g.evaluate("(() => { const s = %s; s.godmode = false; s.levens = 1; s.onraakbaar = 0; s.schild = 0; s.overgang = 0; s.geraakt() })()" % S)
            eind = wacht(h, "!document.querySelector('.nr .laag').hidden", 6000) and wacht(g, "!document.querySelector('.nr .laag').hidden", 6000)
            th, tg = tekst(h, '.nr .laag'), tekst(g, '.nr .laag')
            scG = g.evaluate(S + '.score')
            check('D3 allebei af: GAME OVER bij allebei, met de score van de ander', eind and 'GAME' in th and 'GAME' in tg and 'MARCEL: SCORE ' + str(scG).zfill(7) in th and 'BRAM: SCORE' in tg,
                  (th.replace('\n', ' ')[:150], tg.replace('\n', ' ')[:120]))
            opnieuw = wacht(h, "!document.querySelector('.nr .startKnop').disabled", 6000)
            if opnieuw: h.click('.nr .startKnop')
            r2 = opnieuw and wacht(h, '%s && %s.level === 1 && !%s.voorbij && window.__neonRaiders.ronde() === 2' % (S, S, S), 12000) and \
                 wacht(g, '%s && %s.level === 1 && !%s.voorbij && window.__neonRaiders.ronde() === 2' % (S, S, S), 12000)
            check('D4 OPNIEUW (de uitnodiger): allebei weer level 1, ronde 2', r2)
            g.wait_for_timeout(1500)
            sh, sg = stand(h), stand(g)
            check('D5 in de nieuwe ronde ziet elk de ander weer', sh['azien'] and sg['azien'] and sh['levens'] == 3 and sg['levens'] == 3)
            # berichten per seconde rechtstreeks
            uit = g.evaluate("(() => { const n = window.__neonRaiders.net; return n.rechtstreeks() })()")
            check('D6 nog steeds rechtstreeks verbonden', uit)
            br.close()

        except Exception as e:
            check('%s: proef afgebroken' % 'A-D', False, str(e).split(chr(10))[0])
            try: br.close()
            except Exception: pass
        try:
            # E. reserve: speler 2 heeft geen WebRTC
            br, h, g = paar(p, 'b', '&geenrtc=1')
            ok = wacht(h, 'window.__klaar === true', 15000) and wacht(g, 'window.__klaar === true', 15000)
            t0 = time.time()
            res = wacht(h, "document.querySelector('.nr .rol').textContent.includes('RESERVE') && !document.querySelector('.nr .startKnop').disabled", 25000)
            check('E1 zonder WebRTC: "VERBONDEN (RESERVE)" binnen ±11 s, START doet het', ok and res and time.time() - t0 < 14, (tekst(h, '.nr .rol'), round(time.time() - t0, 1)))
            h.click('.nr .startKnop')
            gestart = wacht(h, '!!(window.__neonRaiders && %s && %s.speler)' % (S, S), 15000) and wacht(g, '!!(window.__neonRaiders && %s && %s.speler)' % (S, S), 15000)
            for pg in (h, g): pg.evaluate("(() => { const s = %s; s.godmode = true; s.tijdSchaal = 4 })()" % S)
            g.wait_for_timeout(3000)
            h.evaluate("(() => { const s = %s; s.speler.setPosition(100, 600) })()" % S)
            k0 = (h.evaluate('window.__kanaal.events["nr-pak"] || 0'), g.evaluate('window.__kanaal.events["nr-pak"] || 0'))
            g.wait_for_timeout(5000)
            k1 = (h.evaluate('window.__kanaal.events["nr-pak"] || 0'), g.evaluate('window.__kanaal.events["nr-pak"] || 0'))
            per = ((k1[0] - k0[0]) / 5, (k1[1] - k0[1]) / 5)
            sg = stand(g)
            check('E2 via het spelkanaal: hooguit 4 berichten per seconde per speler', gestart and 1.5 <= per[0] <= 4.4 and 1.5 <= per[1] <= 4.4, per)
            check('E3 het schip van de ander is te zien (via de reserve)', sg['azien'] and abs(sg['ax'] - 100) < 35, (sg['azien'], sg['ax']))
            br.close()
        except Exception as e:
            check('%s: proef afgebroken' % 'E', False, str(e).split(chr(10))[0])
            try: br.close()
            except Exception: pass
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef90: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
