# Koningsjacht: iedere kaartwaarde blijft werkelijk zichtbaar, plus middeleeuwse materialen.
# python -I tests/tools/proef304.py <map>
import ast, os, re, socket, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fouten = []
def check(ok, tekst):
    print(('OK   ' if ok else 'FOUT ') + tekst)
    if not ok: fouten.append(tekst)

HOEKEN = """() => [...document.querySelectorAll('.kt-hand .kt-kaart')].every(k => {
  const r = k.getBoundingClientRect();
  if (r.left < 0 || r.right > innerWidth + .5 || r.bottom > innerHeight) return false;
  for (const x of [14,30,48]) for (const y of [20,52,82,100]) {
    if (document.elementFromPoint(r.left+r.width*x/250,r.top+r.height*y/350)?.closest('.kt-kaart') !== k) return false;
  }
  return true;
})"""
sock = socket.socket(); sock.bind(('127.0.0.1',0)); poort = sock.getsockname()[1]; sock.close()
www = tempfile.mkdtemp(prefix='proef304_'); os.symlink(MAP,os.path.join(www,'Fibro'))
server = subprocess.Popen([sys.executable,'-m','http.server',str(poort),'--bind','127.0.0.1','--directory',www],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(.8)
basis = 'http://127.0.0.1:%d/Fibro/' % poort
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        for breedte, hoogte in [(320,568),(390,844),(1280,720)]:
            ctx = browser.new_context(viewport={'width':breedte,'height':hoogte},service_workers='block',reduced_motion='reduce')
            ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'),lambda r:r.fulfill(status=204,body=''))
            pg = ctx.new_page(); paginafouten = []
            pg.on('pageerror',lambda e:paginafouten.append(str(e)))
            pg.goto(basis+'tests/fixtures/koningsjacht-hand-preview.html')
            pg.click('#voorbeeld')
            for stijl in ['standaard','middeleeuws','modern']:
                pg.select_option('#scene',stijl)
                pg.wait_for_function(HOEKEN)
                check(pg.locator('.kt-gekozen').count()==2 and pg.evaluate(HOEKEN),f'{breedte}px {stijl}: alle acht waarden/soorten vrij, ook schoppen 5')
                pg.click('.kt-instelknop')
                check(pg.evaluate("() => { const b=document.querySelector('.kt-instelkeus .kt-keuzekaart > .kt-knop'),r=b.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b }"),'Instellingen liggen boven de vergrote kaarten')
                pg.check('[data-kaartinstelling=groot]'); pg.click('.kt-instelkeus .kt-keuzekaart > .kt-knop')
                pg.wait_for_function(HOEKEN)
                check(pg.evaluate(HOEKEN),f'{breedte}px {stijl}: ook met Grote kaarten alle hoeken zichtbaar')
                pg.click('.kt-instelknop'); pg.uncheck('[data-kaartinstelling=groot]'); pg.click('.kt-instelkeus .kt-keuzekaart > .kt-knop')
                if stijl=='middeleeuws':
                    check(pg.evaluate("() => { const e=document.querySelector('.kt-afleg'), s=getComputedStyle(e,'::before'); return s.borderStyle==='solid' && s.backgroundImage.includes('gradient') && ![s,getComputedStyle(e)].some(s => s.boxShadow.includes('192, 132, 252')) }"),'Middeleeuws: houten/ijzeren aflegbak zonder paarse neonrand')
            pg.click('#wissen')
            check(pg.locator('.kt-gekozen').count()==0,'wissen herstelt de gewone waaier')
            check(not paginafouten,'geen paginafouten: '+str(paginafouten[:2]))
            pg.goto(basis+'tests/fixtures/koningsjacht-preview.html?voorbeeld=levensbalk')
            pg.wait_for_selector('.kt-tafel.kt-mijnbeurt')
            for stijl in ['standaard','middeleeuws','modern']:
                pg.click('.kt-knop[data-naam=instellingen]'); pg.check('[data-scene='+stijl+']'); pg.click('.kj-instellingen-sluit')
                hud = pg.evaluate("""() => {
                  const e=document.querySelector('.kj-hud'), h=e.querySelector('.kj-balk'), s=e.querySelector('.kj-schildbalk');
                  const r=e.getBoundingClientRect();
                  return { aantal:e.querySelector('.kj-wachters b').textContent,
                    hp:h.getAttribute('aria-valuenow'), max:h.getAttribute('aria-valuemax'),
                    schild:s.getAttribute('aria-valuenow'), aanval:s.getAttribute('aria-valuemax'),
                    levenBreedte:e.querySelector('.kj-vul').style.width, schildBreedte:e.querySelector('.kj-schildvul').style.width,
                    binnen:r.left>=0 && r.right<=innerWidth && r.width>100,
                    tekst:[h.querySelector('span'),s.querySelector('span')].every(t=>t.scrollWidth<=t.clientWidth),
                    segmenten:getComputedStyle(h,'::after').backgroundImage.includes('repeating-linear-gradient') };
                }""")
                check(hud['aantal']=='3' and hud['hp']=='13' and hud['max']=='20' and hud['levenBreedte']=='65%',f'{breedte}px {stijl}: 3/12 verslagen, 13/20 leven en juiste groene vulling')
                check(hud['schild']=='6' and hud['aanval']=='10' and hud['schildBreedte']=='60%',f'{breedte}px {stijl}: blauw toont 6 van 10 schade beschermd')
                check(hud['binnen'] and hud['tekst'] and hud['segmenten'],f'{breedte}px {stijl}: segmenten en beide cijfers volledig zichtbaar')
            pg.goto(basis+'tests/fixtures/koningsjacht-hand-preview.html?voorbeeld=afleg')
            check(pg.evaluate("""() => {
              const e=document.querySelector('.kt-afleg'), k=e.querySelector('.kt-ak');
              const bak=getComputedStyle(e,'::before'), kaart=getComputedStyle(k), r=k.getBoundingClientRect();
              return bak.content !== 'none' && Number(kaart.zIndex)>Number(bak.zIndex)
                && kaart.backgroundColor !== 'rgba(0, 0, 0, 0)' && kaart.opacity==='1'
                && bak.backgroundImage==='none' && bak.borderStyle==='none'
                && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.kt-ak')===k;
            }"""),f'{breedte}px: kaart ondoorzichtig boven de legbak, zonder beslag door de kaart')
            pg.goto(basis+'tests/fixtures/koningsjacht-eindscene-preview.html')
            for n in [0,1,4,5,6,7,8,12]:
                pg.locator('#wachters').press('Home')
                for _ in range(n): pg.locator('#wachters').press('ArrowRight')
                check(pg.locator('.kj-eindscene-schilden .verdiend').count()==n,f'{breedte}px: eindscene telt {n} wapenschilden')
                if 1 <= n <= 6:
                    check(pg.evaluate("""() => [...document.querySelectorAll('.kj-eindscene-beeld img')]
                      .filter(img => /stand-(8|12)-anatomie-v2\\.jpg/.test(img.src)).every(img => img.style.display === 'none')"""),
                      f'{breedte}px: tot en met zes wachters blijft de hand op het been')
            pg.wait_for_function("() => [...document.querySelectorAll('.kj-eindscene img')].every(i=>i.complete && i.naturalWidth>0)")
            check(True,f'{breedte}px: alle eindbeelden laden')
            check(pg.evaluate("""() => [...document.querySelectorAll('.kj-eindscene-beeld img')]
              .slice(0, 3).map(img => new URL(img.src).pathname.split('/').pop()).join(',')
              === 'stand-0-anatomie-v2.jpg,stand-4-anatomie-v2.jpg,stand-6-anatomie-v2.jpg'"""),
              f'{breedte}px: vroege eindbeelden zonder zwaard geladen')
            for narren in [2,4]:
                pg.locator(f'[data-narren="{narren}"]').click()
                pg.wait_for_function("() => [...document.querySelectorAll('.kj-eindscene img')].every(i=>i.complete && i.naturalWidth>0)")
                check(pg.locator('.kj-eindscene').get_attribute('data-narren')==str(narren),f'{breedte}px: reeks met {narren} narren gekozen')
                check(pg.evaluate("""n => [...document.querySelectorAll('.kj-eindscene-beeld img')]
                  .every(img => new URL(img.src).pathname.includes(`/narren-${n}/`))""",narren),
                  f'{breedte}px: alle vijf beelden uit reeks met {narren} narren geladen')
                pg.locator('#wachters').press('Home')
                for _ in range(6): pg.locator('#wachters').press('ArrowRight')
                check(pg.locator('.kj-eindscene-schilden .verdiend').count()==6,f'{breedte}px: zes wachters met {narren} narren')
                check(pg.evaluate("""() => [...document.querySelectorAll('.kj-eindscene-beeld img')]
                  .slice(3).every(img => img.style.display === 'none')"""),
                  f'{breedte}px: zwaardloze vroege reeks met {narren} narren')
            pg.locator('[data-scene="modern"]').click()
            pg.wait_for_function("() => [...document.querySelectorAll('.kj-eindscene img')].every(i=>i.complete && i.naturalWidth>0)")
            check(pg.locator('.kj-eindscene').get_attribute('data-scene')=='modern',f'{breedte}px: moderne eindscènes geselecteerd')
            check(pg.evaluate("() => [...document.querySelectorAll('.kj-eindscene img')].every(i=>new URL(i.src).pathname.includes('/modern/'))"),f'{breedte}px: alle moderne eindbeelden uit de onderwaterreeks geladen')
            check(pg.locator('.kj-eindscene[data-scene="modern"] .kj-eindscene-schilden span').count()==12,f'{breedte}px: onderwatervoortgang toont twaalf lampindicatoren')
            for narren in [0,2,4]:
                pg.locator(f'[data-narren="{narren}"]').click()
                pg.wait_for_function("() => [...document.querySelectorAll('.kj-eindscene img')].every(i=>i.complete && i.naturalWidth>0)")
                check(pg.evaluate("n => [...document.querySelectorAll('.kj-eindscene img')].every(i=>new URL(i.src).pathname.includes(`/modern/narren-${n}/`))",narren),f'{breedte}px: moderne reeks voor {narren} narren compleet')
                pg.eval_on_selector('#wachters',"e=>{e.value='12';e.dispatchEvent(new Event('input',{bubbles:true}))}")
                check('onderwaterstation' in pg.locator('.kj-eindscene figcaption').inner_text(),f'{breedte}px: volledige winst noemt het geredde onderwaterstation')
                pg.eval_on_selector('#wachters',"e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}))}")
            pg.goto(basis+'tests/fixtures/koningsjacht-preview.html')
            pg.click('.kj-scores')
            pg.wait_for_selector('dialog[open]')
            check('KONINGSJACHT' in pg.text_content('dialog') and 'Jouw top 10' in pg.text_content('dialog'),f'{breedte}px: scores openen vanuit Koningsjacht')
            pg.click('.nr-sb-close')
            ctx.close()

        ctx = browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'),lambda r:r.fulfill(status=204,body=''))
        pg=ctx.new_page(); pg.goto(basis+'tests/fixtures/koningsjacht-preview.html')
        pg.click('.kj-start-instellingen'); pg.check('[data-scene=middeleeuws]'); pg.click('.kj-instellingen-sluit')
        pg.click('.kj-niveau[data-niveau=schildknaap]'); pg.wait_for_selector('.kt-tafel.kt-mijnbeurt')
        check(pg.locator('.kj-steen-symbool').count()==3 and pg.evaluate("() => [...document.querySelectorAll('.kj-pil')].every(e => getComputedStyle(e).backgroundImage.includes('stone-grain.svg'))"),'de drie echte Koningsjacht-tellers zijn stenen plaatjes')
        pg.click('.kt-knop[data-naam=instellingen]'); pg.check('[data-scene=modern]'); pg.click('.kj-instellingen-sluit')
        check(pg.evaluate("() => [...document.querySelectorAll('.kj-steen-symbool')].every(e => getComputedStyle(e).display==='none') && [...document.querySelectorAll('.kj-pil')].every(e => !getComputedStyle(e).backgroundImage.includes('stone-grain.svg'))"),'Modern herstelt de eigen tellers zonder steenmateriaal')
        ctx.close(); browser.close()
except Exception as e:
    check(False,'proef afgebroken: '+str(e).split('\n')[0])
finally:
    server.terminate()
print('\n%d fout(en)' % len(fouten))
sys.exit(1 if fouten else 0)
