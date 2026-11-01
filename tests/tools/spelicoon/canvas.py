# Sprites uit de echte spellen: canvassen die het spel zelf maakt (The Swarm, Runner & Gunner, Neon Raiders)
import base64, json
from playwright.sync_api import sync_playwright
import os, sys; UIT = os.environ.get('SPELICOON_RAW', './raw/')
INIT = """
window.__doeken = [];
const oud = Document.prototype.createElement;
Document.prototype.createElement = function(t, ...r){ const e = oud.call(this, t, ...r); if (String(t).toLowerCase()==='canvas') window.__doeken.push(e); return e };
window.__tex = {};
const kijk = setInterval(()=>{ if (window.Phaser && Phaser.Textures && !Phaser.__p) { Phaser.__p=1;
  const A = Phaser.Textures.TextureManager.prototype.addCanvas;
  Phaser.Textures.TextureManager.prototype.addCanvas = function(k, c, ...r){ window.__tex[k]=c; return A.call(this,k,c,...r) } } }, 2);
"""
def bewaar(url, naam):
    open(UIT + naam + '.png', 'wb').write(base64.b64decode(url.split(',')[1])); print('ok', naam)
def open_spel(br, spel, start=True):
    p = br.new_page(viewport={'width': 400, 'height': 720}, device_scale_factor=2, locale='nl-NL')
    p.add_init_script(INIT)
    p.route('**/*supabase.co/**', lambda r: r.abort())
    p.goto('http://127.0.0.1:8765/Fibro/spel.html?spel=' + spel); p.wait_for_timeout(1200)
    if start:
        for sel in ['[data-niveau="normaal"]', '#startKnop']:
            el = p.query_selector(sel)
            if el: el.click(); break
        p.wait_for_timeout(2500)
    return p
with sync_playwright() as pw:
    br = pw.chromium.launch()
    p = open_spel(br, 'swarm')
    lijst = p.evaluate("() => window.__doeken.map(c => c.toDataURL())")
    for i in [0, 8, 16, 24, 32, 40, 48, 56, 121, 131, 132]:
        bewaar(lijst[i], f'swarm_{i}')
    p.close()
    p = open_spel(br, 'endlessrunner')
    for k in ['kRunner', 'kGunner']:
        bewaar(p.evaluate(f"() => document.querySelector('.{k} canvas.pop').toDataURL()"), 'endlessrunner_' + k)
    p.close()
    p = open_spel(br, 'shmup')
    p.get_by_text('START', exact=True).first.click(); p.wait_for_timeout(3000)
    print(p.evaluate("() => Object.keys(window.__tex).join(' ')"))
    for k in ['schip', 'schip2']:
        u = p.evaluate(f"() => window.__tex['{k}'] && window.__tex['{k}'].toDataURL()")
        if u: bewaar(u, 'shmup_' + k)
    p.close()
    br.close()
