# proef89: Neon Raiders, het hele spel (v193): alle 7 levels achter elkaar, versneld (tijdSchaal 4, onkwetsbaar, steeds
# schieten met de spatiebalk), via spel.html?spel=shmup. Per level:
#  1. de golven lopen zonder paginafouten tot de eindbaas komt (met zijn eigen naam in de balk en onderin)
#  2. de baas vecht een paar seconden (alle aanvallen), daarna de onderdelen met schild kapot: fase 2 of 3
#  3. de kern kapot: het volgende level begint (nieuwe achtergrond, P1 · Ln), het bereikte level wordt onthouden
# Na level 7: 'GEWONNEN!' met de score; daarna opnieuw laden: de knop 'VERDER: LEVEL 7' staat er en begint level 7.
# Ook: elke achtergrondlaag van een level is weg als het volgende begint (geen oude ag_-texturen meer).
# Oude map (v192) als controle: het spel heeft daar maar één level, dus bijna alles MIS.
# window.__fibroProef = true (het spel zet window.__neonRaiders), window.__nrScherpte = 1 (sneller in de proef).
# python3 -I proef89.py <map>
import sys, os, time, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:200] if info != '' else ''), flush=True)
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
S = 'window.__neonRaiders.scene'
NAMEN = {1: 'TITAN', 2: 'ZEPHYR', 3: 'VORTEX', 4: 'REACTOR', 5: 'ZOGGOTH PRIME', 6: 'ZWERMKONINGIN', 7: 'OVERLORD'}
fouten = []
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, bypass_csp=True)
        ctx.add_init_script("window.__fibroProef = true; window.__nrScherpte = 1; try { localStorage.setItem('fibro_taal', 'nl') } catch (e) {}")
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: fouten.append(str(e)))
        pg.goto(B + 'spel.html?spel=shmup')
        gestart = False
        try:
            pg.wait_for_selector('.nr .knop', timeout=12000)
            pg.tap('.nr .knop')
            pg.wait_for_function('!!(window.__neonRaiders && window.__neonRaiders.scene && window.__neonRaiders.scene.speler)', timeout=15000)
            gestart = True
        except Exception: pass
        check('spel gestart', gestart)
        if gestart:
            pg.evaluate("(() => { const n = window.__neonRaiders; if (n.toets) n.toets.vuur = 1; n.scene.godmode = true })()")
            for n in range(1, 8):
                pg.evaluate("(() => { const s = %s; s.tijdSchaal = 4; s.niveau.puls = 3; s.niveau.raket = 2; s.niveau.spreid = 3; s.wapen = ['puls', 'raket', 'spreid'][%d %% 3] })()" % (S, n))
                try: pg.wait_for_function('!!(%s.baas && %s.baas.binnen) || %s.level !== %d' % (S, S, S, n), timeout=150000); kwam = pg.evaluate('!!%s.baas' % S)
                except Exception: kwam = False
                naam = pg.inner_text('.nr .baasNaam') if kwam else ''
                check('L%d: golven zonder fouten, eindbaas %s komt' % (n, NAMEN[n]), kwam and naam == NAMEN[n] and not fouten, (naam, fouten[:2]))
                if not kwam: break
                pg.wait_for_timeout(5000)
                pg.evaluate("(() => { const s = %s, b = s.baas; b.delen.filter(d => !d.kern).forEach(d => s.raakBaas(d, 99999)) })()" % S)
                pg.wait_for_timeout(2500)
                fase = pg.evaluate('%s.baas && %s.baas.fase' % (S, S))
                check('L%d: onderdelen kapot, baas in fase 2/3, nog steeds geen fouten' % n, fase in (2, 3) and not fouten, (fase, fouten[:2]))
                pg.evaluate("(() => { const s = %s, b = s.baas; s.raakBaas(b.delen.find(d => d.kern), 99999) })()" % S)
                if n < 7:
                    try: pg.wait_for_function('%s.level === %d' % (S, n + 1), timeout=30000); verder = True
                    except Exception: verder = False
                    pg.wait_for_timeout(300)
                    ag = pg.evaluate("%s.textures.getTextureKeys().filter(k => k.startsWith('ag_'))" % S)
                    lagen = pg.evaluate("%s.lagen.map(l => l.spec.key)" % S)
                    check('L%d -> L%d: volgend level, nieuwe achtergrond, bereikt bewaard' % (n, n + 1), verder and 'L%d' % (n + 1) in pg.inner_text('.nr .p1') and sorted(ag) == sorted(lagen) and pg.evaluate("localStorage.getItem('nr-bereikt')") == str(n + 1), (pg.inner_text('.nr .p1'), lagen))
                    if not verder: break
                else:
                    try: pg.wait_for_function("!document.querySelector('.nr .laag').hidden", timeout=30000); klaar = True
                    except Exception: klaar = False
                    tekst = pg.inner_text('.nr .laag')
                    check('na level 7: GEWONNEN! met score en bonus', klaar and 'GEWONNEN' in tekst and 'Alle zeven levels gehaald' in tekst, tekst.replace('\n', ' ')[:160])
            # VERDER
            pg.reload()
            try:
                pg.wait_for_selector('.nr .verderKnop', timeout=12000)
                pg.wait_for_timeout(500)
                vk = pg.inner_text('.nr .verderKnop') if pg.evaluate("!document.querySelector('.nr .verderKnop').hidden") else ''
            except Exception: vk = ''
            check('opnieuw geladen: knop VERDER: LEVEL 7', 'VERDER: LEVEL 7' in vk, vk)
            if vk:
                pg.tap('.nr .verderKnop')
                try: pg.wait_for_function('!!(window.__neonRaiders && window.__neonRaiders.scene && window.__neonRaiders.scene.level === 7)', timeout=15000); l7 = True
                except Exception: l7 = False
                check('VERDER begint in level 7 met de gewone uitrusting', l7 and pg.evaluate(S + '.niveau.puls') == 1 and pg.evaluate(S + '.levens') == 3)
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:3])
goed = sum(uitslag)
print('UITSLAG proef89: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
