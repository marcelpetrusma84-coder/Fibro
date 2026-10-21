# proef88: Neon Raiders (v192), alleen spelen via spel.html?spel=shmup, op een nagebootste telefoon met echte aanrakingen
# (twee vingers tegelijk via CDP Input.dispatchTouchEvent, dus echte pointer-gebeurtenissen):
#  1. startscherm in het Nederlands en het Engels (geen Nederlandse woorden in het Engels), knoppen AUTOVUUR en GELUID
#  2. START: aftellen, dan draait het spel (Phaser-canvas in het veld)
#  3. een vinger slepen beweegt het schip en schiet niet; een tweede vinger schiet; loslaten = stoppen met schieten
#  4. de tegel linksboven: arsenaal open + slow motion; bom gebruiken (voorraad -1, kogels van de vijand weg); dicht;
#     wapen wisselen; een capsule oppakken (drager neerschieten, schip erheen) geeft het wapen
#  5. pauze als de app op de achtergrond gaat, tik = verder
#  6. de eindbaas TITAN komt (met balk), verslaan = 'LEVEL 1 GEHAALD!' en het record staat op het toestel
#  7. game over als de levens op zijn
#  8. Stijl > Widgets kent Neon Raiders (spel_shmup) en Home heeft het icoon (in de code)
# Geen paginafouten. Oude map (v191) als controle: bijna alles MIS (het spel bestaat daar nog niet).
# Alleen voor de proef: window.__fibroProef = true laat het spel window.__neonRaiders zetten (scene, vingers, vuurtNu);
# window.__nrScherpte = 1 tekent op gewone scherpte (de software-GPU haalt op 2x maar ±5 beeldjes per seconde).
# python3 -I proef88.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:200] if info != '' else ''))
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
S = 'window.__neonRaiders.scene'
NL_WOORDEN = re.compile(r'\b(vinger|schieten|vliegen|tegel|wapen|gebruiken|GELUID|AUTOVUUR|AARDE|OPNIEUW|Sleep)\b')
fouten = []
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        def nieuweContext(taal):
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, bypass_csp=True,
                                 user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
            # __nrScherpte = 1: op gewone scherpte, anders haalt de software-GPU van de proef maar ±5 beeldjes (de echte telefoon tekent op 2x)
            ctx.add_init_script("window.__fibroProef = true; window.__nrScherpte = 1; try { localStorage.setItem('fibro_taal', '%s') } catch (e) {}" % taal)
            pg = ctx.new_page()
            pg.on('pageerror', lambda e: fouten.append(str(e)))
            return ctx, pg
        # 1. Engels startscherm
        ctx, pg = nieuweContext('en')
        pg.goto(B + 'spel.html?spel=shmup')
        try: pg.wait_for_selector('.nr .knop', timeout=12000); en = pg.inner_text('.nr .laag')
        except Exception: en = pg.inner_text('body')
        check('EN: startscherm in het Engels', 'Drag one finger to fly' in en and 'AUTO FIRE: OFF' in en and 'SOUND: ON' in en and 'LEVEL 1 · EARTH' in en, en.replace('\n', ' '))
        check('EN: geen Nederlandse woorden', not NL_WOORDEN.search(en), NL_WOORDEN.findall(en))
        ctx.close()
        # 2. Nederlands, spelen
        ctx, pg = nieuweContext('nl')
        cdp = ctx.new_cdp_session(pg)
        def touch(soort, punten):
            cdp.send('Input.dispatchTouchEvent', {'type': soort, 'touchPoints': [{'x': x, 'y': y, 'id': i} for (i, x, y) in punten]})
        pg.goto(B + 'spel.html?spel=shmup')
        try: pg.wait_for_selector('.nr .knop', timeout=12000); nl = pg.inner_text('.nr .laag')
        except Exception: nl = pg.inner_text('body')
        check('NL: startscherm', 'NEON' in nl and 'Sleep met één vinger om te vliegen' in nl and 'AUTOVUUR: UIT' in nl and 'GELUID: AAN' in nl, nl.replace('\n', ' ')[-90:])
        check('titelbalk', pg.inner_text('#spelTitelBar') == '🚀 Neon Raiders', pg.inner_text('#spelTitelBar'))
        gestart = False
        try:
            pg.tap('.nr .knop')
            pg.wait_for_function('!!(window.__neonRaiders && window.__neonRaiders.scene && window.__neonRaiders.scene.speler)', timeout=12000)
            gestart = True
        except Exception: pass
        check('START: het spel draait (canvas in het veld)', gestart and pg.evaluate("!!document.querySelector('.nr .veld canvas') && document.querySelector('.nr .laag').hidden"))
        if gestart:
            pg.evaluate(S + '.godmode = true')
            pg.wait_for_timeout(500)
            x0 = pg.evaluate(S + '.speler.x')
            touch('touchStart', [(0, 200, 700)])
            for i in range(1, 11): touch('touchMove', [(0, 200 - i * 8, 700)]); pg.wait_for_timeout(16)
            x1 = pg.evaluate(S + '.speler.x')
            check('vinger slepen beweegt het schip', x1 < x0 - 60, '%.0f -> %.0f' % (x0, x1))
            pg.wait_for_timeout(300)
            check('een vinger alleen schiet niet', pg.evaluate(S + '.kogelsS.length') == 0)
            touch('touchStart', [(0, 120, 700), (1, 300, 400)])
            pg.wait_for_timeout(900)
            n = pg.evaluate(S + '.kogelsS.length')
            check('een tweede vinger schiet', n >= 2, n)
            touch('touchEnd', [(1, 300, 400)])
            try: pg.wait_for_function(S + '.kogelsS.length === 0', timeout=8000); leeg = True
            except Exception: leeg = False
            check('tweede vinger los: stoppen met schieten', leeg and not pg.evaluate('window.__neonRaiders.vuurtNu()'))
            touch('touchEnd', [(0, 120, 700)])
            # 4. de tegel
            pg.evaluate("(() => { const s = %s; s.kogel(100, 100, 'orb', 0, 10); s.kogel(200, 120, 'orb', 0, 10) })()" % S)
            pg.tap('.nr .tegel'); pg.wait_for_timeout(200)
            check('tegel opent het arsenaal', pg.evaluate("!document.querySelector('.nr .arsenaal').hidden"))
            check('slow motion zolang het arsenaal open is', pg.evaluate(S + '.tijdSchaal') < 0.5)
            knoppen = pg.evaluate("[...document.querySelectorAll('.nr .arsenaal button')].map(b => b.dataset.soort + (b.disabled ? '-' : '+'))")
            check('arsenaal: puls, bom (2), schild (0, uit)', knoppen == ['puls+', 'bom+', 'schild-'], knoppen)
            bom0 = pg.evaluate(S + '.voorraad.bom')
            pg.tap('.nr .arsenaal button[data-soort=bom]'); pg.wait_for_timeout(200)
            check('bom gebruikt', pg.evaluate(S + '.voorraad.bom') == bom0 - 1 and pg.evaluate(S + '.kogelsV.length') == 0, pg.evaluate(S + '.voorraad.bom'))
            check('arsenaal dicht, gewone snelheid', pg.evaluate("document.querySelector('.nr .arsenaal').hidden") and pg.evaluate(S + '.tijdSchaal') == 1)
            pg.evaluate(S + '.niveau.straal = 2')
            pg.tap('.nr .tegel'); pg.wait_for_timeout(200)
            try: pg.tap('.nr .arsenaal button[data-soort=straal]', timeout=4000)
            except Exception: pass
            pg.wait_for_timeout(200)
            check('wapen wisselen naar straal', pg.evaluate(S + '.wapen') == 'straal')
            # een capsule: drager neerschieten en oppakken
            pg.evaluate("(() => { const s = %s; s.wapen = 'puls'; const v = s.maak('drager', { x: 180, buit: 'spreid' }); v.y = 300; v.o.x = 180; s.dood(v) })()" % S)
            pg.wait_for_timeout(100)
            for i in range(30):
                pg.evaluate("(() => { const s = %s; const b = s.buit[0]; if (b) { s.speler.x = b.x; s.speler.y = Math.min(s.speler.y, b.y + 60); s.duw(0, -20) } })()" % S)
                pg.wait_for_timeout(100)
                if pg.evaluate(S + '.niveau.spreid'): break
            check('capsule opgepakt: spreid erbij en gekozen', pg.evaluate(S + '.niveau.spreid') == 1 and pg.evaluate(S + '.wapen') == 'spreid')
            # 5. pauze
            pg.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))")
            pg.wait_for_timeout(200)
            gp = pg.evaluate(S + '.pauze'); k1 = pg.evaluate(S + '.klok'); pg.wait_for_timeout(600); k2 = pg.evaluate(S + '.klok')
            check('pauze als de app op de achtergrond gaat', gp and k1 == k2 and 'GEPAUZEERD' in pg.inner_text('.nr .bord'))
            pg.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })")
            touch('touchStart', [(0, 200, 600)]); touch('touchEnd', [(0, 200, 600)])
            pg.wait_for_timeout(300)
            check('tik = verder', not pg.evaluate(S + '.pauze') and pg.evaluate(S + '.klok') > k2)
            # 6. de eindbaas
            pg.evaluate("(() => { const s = %s; s.niveau.puls = 3; s.wapen = 'puls'; s.klok = 108; s.golfNr = s.golven.findIndex(g => g.t >= 108) })()" % S)
            try: pg.wait_for_function('!!(%s.baas && %s.baas.binnen)' % (S, S), timeout=25000); baas = True
            except Exception: baas = False
            check('eindbaas TITAN komt, met balk', baas and pg.evaluate("!document.querySelector('.nr .baas').hidden"))
            touch('touchStart', [(0, 195, 760), (1, 300, 500)])
            for i in range(160):
                pg.wait_for_timeout(500)
                pg.evaluate("(() => { const s = %s; if (!s.baas || !s.baas.binnen || s.baas.dood) return; const d = s.baas.delen.find(d => !d.dood && d.naam !== 'kern') || s.baas.delen[2]; s.speler.x = d.x })()" % S)
                if pg.evaluate("!document.querySelector('.nr .laag').hidden"): break
            touch('touchEnd', [(0, 195, 760), (1, 300, 500)])
            h1 = pg.inner_text('.nr .laag h1').replace('\n', ' ')
            check('eindbaas verslagen: LEVEL 1 GEHAALD!', 'GEHAALD' in h1, h1)
            rec = pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('fibro_record_shmup')).map(k => +localStorage.getItem(k))")
            check('record op het toestel bewaard', rec and rec[0] == pg.evaluate(S + '.score') and rec[0] > 20000, rec)
            # 7. game over
            pg.tap('.nr .knop')
            pg.wait_for_timeout(2600)
            try: pg.wait_for_function('!!(window.__neonRaiders.scene && window.__neonRaiders.scene.speler && !window.__neonRaiders.scene.voorbij)', timeout=8000)
            except Exception: pass
            pg.evaluate("(() => { const s = %s; s.levens = 1; s.onraakbaar = 0; s.schild = 0; s.geraakt() })()" % S)
            pg.wait_for_timeout(400)
            h1 = pg.inner_text('.nr .laag h1').replace('\n', ' ')
            check('game over als de levens op zijn', 'GAME' in h1 and 'OVER' in h1 and not pg.evaluate("document.querySelector('.nr .laag').hidden"), h1)
        ctx.close()
        br.close()
finally:
    srv.terminate()
# 8. in de code
prof = open(os.path.join(MAP, 'profiel.html'), encoding='utf-8').read()
home = open(os.path.join(MAP, 'index.html'), encoding='utf-8').read()
check('Stijl > Widgets: schakelaar en widget spel_shmup', "toggleWidget('spel_shmup')" in prof and "spel_shmup:" in prof)
check('Home: icoon voor shmup', "shmup: '🚀'" in home)
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef88: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
