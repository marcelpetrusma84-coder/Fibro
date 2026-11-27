# proef357 (27 nov 2026, Marcel): de speelkaarten "Salon" (kaarten/salon/, uit Marcels eigen platen).
#  A. Salon staat bij de kaartstijlen (Kies je kaarten)
#  B. de 19 plaatjes laden echt en zijn 375 x 525 (azen, boeren, vrouwen, heren, twee jokers, achterkant)
#     28 nov 2026: de heren, vrouwen en boeren zijn echt 5 : 7 (het plaatje loopt van boven tot onder, geen lege
#     crème banden); de twee jokers zijn verschillende plaatjes
#  C. de getekende 2 t/m 10 hebben dezelfde crème achtergrond als de plaatjes (#e4d7bc), niet wit; harten rood, schoppen
#     donker
#  D. een rij kaarten op tafel (voor de foto in /tmp/proef357.png); geen paginafouten
# Op de oude versie mislukt alles (er was geen Salon, en de getekende kaarten waren altijd wit).
# python3 -I proef357.py <map>
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from proefhulp import *
from playwright.sync_api import sync_playwright
NAMEN = [k + w for k in 'hrks' for w in 'ABVH'] + ['joker', 'joker2', 'achterkant']
try:
    with sync_playwright() as p:
        b = browser(p)
        ctx = context(b, 900, 700)
        q = lege_spelpagina(ctx, 'salon')
        q.evaluate("async () => { window.K = await import('./kaartspel-hulp.js?v=23') }")
        check(q.evaluate("() => K.KAARTSTIJLEN.salon?.naam") == 'Salon', 'A Salon staat bij de kaartstijlen')
        maten = q.evaluate("""async namen => Promise.all(namen.map(n => new Promise(ok => { const i = new Image()
            i.onload = () => ok([n, i.naturalWidth, i.naturalHeight]); i.onerror = () => ok([n, 0, 0]); i.src = './kaarten/salon/' + n + '.webp' })))""", NAMEN)
        check(all(w == 375 and h == 525 for _, w, h in maten), 'B alle 19 plaatjes laden, 375 x 525 (%s)' % [m for m in maten if m[1] != 375][:3])
        # hoe ver loopt het plaatje? (rijen waar meer dan de helft geen crème is)
        banden = q.evaluate("""async namen => Promise.all(namen.map(n => new Promise(ok => { const i = new Image()
            i.onload = () => { const c = document.createElement('canvas'); c.width = 375; c.height = 525; const x = c.getContext('2d'); x.drawImage(i, 0, 0)
                const d = x.getImageData(0, 0, 375, 525).data, vol = []
                for (let y = 0; y < 525; y++) { let a = 0; for (let px = 0; px < 375; px++) { const o = (y * 375 + px) * 4; if (Math.abs(d[o] - 228) + Math.abs(d[o + 1] - 215) + Math.abs(d[o + 2] - 188) > 60) a++ } vol.push(a / 375 > .5) }
                ok([n, vol.indexOf(true), 524 - vol.lastIndexOf(true)]) }
            i.src = './kaarten/salon/' + n + '.webp' })))""", [k + w for k in 'hrks' for w in 'HVB'])
        check(all(0 <= boven < 70 and 0 <= onder < 70 for _, boven, onder in banden), 'B de heren, vrouwen en boeren lopen van boven tot onder (%s)' % [b for b in banden if not (0 <= b[1] < 70 and 0 <= b[2] < 70)][:3])
        j1, j2 = q.evaluate("() => [K.kaartSvg('J1', 'salon'), K.kaartSvg('J2', 'salon')]")
        check('salon/joker.webp' in j1 and 'salon/joker2.webp' in j2, 'B twee verschillende jokers')
        h5, s9 = q.evaluate("() => [K.kaartSvg('h5', 'salon'), K.kaartSvg('s9', 'salon')]")
        check('fill="#e4d7bc"' in h5 and '#fffdf9' not in h5, 'C de getekende 5 is crème, niet wit')
        check('#a8262e' in h5 and '#1d1a17' in s9, 'C harten rood, schoppen donker')
        check('kaarten/salon/hH.webp' in q.evaluate("() => K.kaartSvg('hH', 'salon')") and 'salon/achterkant.webp' in q.evaluate("() => K.achterkantSvg('salon')"), 'C de heer en de achterkant zijn de plaatjes')
        q.evaluate("""() => { document.body.style.background = '#1f5e3c'
            const rij = ['hA', 'hH', 'rV', 'kB', 'sA', 'sH', 'h5', 'k9', 'J1', 'J2'].map(id => '<div style="width:100px;height:140px">' + K.kaartSvg(id, 'salon') + '</div>').join('')
            document.body.innerHTML = '<style>.kt-svg{width:100%;height:100%;display:block}.kt-img{object-fit:fill;border-radius:7%}.kt-pk{position:relative}.kt-pk>.kt-img{display:block;width:100%;height:100%}.kt-pk-hoek{position:absolute;inset:0;width:100%;height:100%}</style><div id="rij" style="display:flex;flex-wrap:wrap;gap:10px;padding:14px;width:470px">' + rij
              + '<div style="width:100px;height:140px">' + K.achterkantSvg('salon') + '</div></div>' }""")
        check(wacht(q, "() => [...document.querySelectorAll('#rij img')].every(i => i.complete && i.naturalWidth)", 8000), 'D de kaarten liggen op tafel')
        q.locator('#rij').screenshot(path='/tmp/proef357.png')
        ctx.close(); b.close()
except Exception as e:
    check(False, 'proef liep vast: %s' % e)
klaar()
