# Losse speelstukken die het spel met canvas-code tekent: de echte tekenfuncties uit het spelbestand, op een
# doorzichtig canvas (Neo Paddle: de paddle, Flapper: de vleermuis, Ghost Tag: het spookje, Twin Snakes: de slang,
# Block It: één blokje).
import re, json, base64
from playwright.sync_api import sync_playwright
import os, sys; UIT = os.environ.get('SPELICOON_RAW', './raw/')
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../')
def bron(f): return open(F + f, encoding='utf8').read()
def haal(src, naam):
    m = re.search(r'(?m)^[ \t]*(?:function\s+' + naam + r'\s*\(|(?:const|let)\s+' + naam + r'\s*=)', src)
    assert m, naam
    is_f = 'function' in m.group(0); i = m.start(); diep = 0; k = m.end() - 1 if is_f else m.end(); body = False
    while k < len(src):
        c = src[k]
        if c in "'\"`":
            q = c; k += 1
            while src[k] != q:
                if src[k] == '\\': k += 1
                k += 1
        elif c == '/' and src[k+1] == '/':
            k = src.index('\n', k); continue
        elif c in '([{':
            diep += 1
            if is_f and c == '{' and diep == 1: body = True
        elif c in ')]}':
            diep -= 1
            if is_f and body and diep == 0: return src[i:k+1]
        elif c == '\n' and not is_f and diep == 0:
            regel = src[i:k].rstrip()
            volgende = src[k+1:].lstrip()
            if not regel.endswith((',', '+', '=', '(', '?', ':', '&&', '||')) and not volgende.startswith(('.', '+', '?', ':', '&&', '||')):
                return src[i:k]
        k += 1
    raise Exception(naam)
pong, flap, ecto, slang, blok = bron('pong-ui.js'), bron('flappy-ui.js'), bron('ecto-ui.js'), bron('twin-snakes-ui.js'), bron('blockit-ui.js')
JS = "\n".join([
  # Neo Paddle
  "const PADDLE_HOOGTE = 10; let ctx;",
  haal(pong, 'tekenPaddle'),
  "function maakPaddle(g){ ctx = g; g.translate(15, 25); tekenPaddle(0, 0, 60, {}) }",
  # Flapper
  "const flapper = (function(){ let ctx, frame = 0;", haal(flap, 'tekenVleermuis'),
  "return g => { ctx = g; tekenVleermuis(25, 22, 1, '#60a5fa') } })()",
  # Ghost Tag
  "const spook = (function(){ const res = 1, gloedBeelden = new Map();",
  haal(ecto, 'hexRgb'), haal(ecto, 'rgba'), haal(ecto, 'pixels'), haal(ecto, 'SPOOK'), haal(ecto, 'RICHT'),
  haal(ecto, 'maakLaag'), haal(ecto, 'gloed'), haal(ecto, 'tekenFiguur'),
  "return g => tekenFiguur(g, 18, 18, 1.25, '#5ff4ff', 'normaal', 'D', 1.2) })()",
  # Twin Snakes
  "const slang = (function(){ let ctx; const res = 1, HUD = 0, staat = 'menu', tijd = 0.5, stapKlok = 1;",
  haal(slang, 'T'), haal(slang, 'DONKER'), haal(slang, 'RICHT'), haal(slang, 'hexRgb'), haal(slang, 'rgba'), haal(slang, 'meng'),
  haal(slang, 'midden'), haal(slang, 'tussen'), haal(slang, 'naast'), haal(slang, 'tekenSlang'),
  "return g => { ctx = g; tekenSlang({ lijf: [[3,0],[3,1],[2,1],[1,1],[1,2],[1,3],[2,3],[3,3],[3,4]], dir: 'U', kleur: '#ff6bd6', i: 0, n: 0, dood: false, doodFlits: 0 }) } })()",
  # Block It
  "const blokje = (function(){ let hoofdCtx;", haal(blok, 'ZWART'), haal(blok, 'ZWART_KLEUR'), haal(blok, 'KLEUREN'), haal(blok, 'tekenBlok'),
  "return g => tekenBlok(0, 0, 40, 3, 1, 1, g) })()",
])
TEKEN = {  # naam: (breedte, hoogte in spelpunten, functie)
  'pong': (90, 60, 'maakPaddle'), 'flappybird': (50, 44, 'flapper'), 'pacman': (36, 36, 'spook'),
  'pinball': (56, 70, 'slang'), 'breakout': (40, 40, 'blokje'),
}
with sync_playwright() as pw:
    br = pw.chromium.launch(); p = br.new_page()
    p.set_content('<html><body></body></html>')
    p.add_script_tag(content=JS)
    for naam, (b, h, f) in TEKEN.items():
        S = 12
        url = p.evaluate(f"""() => {{ const c = document.createElement('canvas'); c.width = {b} * {S}; c.height = {h} * {S};
          const g = c.getContext('2d'); g.scale({S}, {S});
          const ctxP = CanvasRenderingContext2D.prototype, d = Object.getOwnPropertyDescriptor(ctxP, 'shadowBlur');
          Object.defineProperty(g, 'shadowBlur', {{ get() {{ return d.get.call(this) / {S} }}, set(v) {{ d.set.call(this, v * {S}) }} }});
          {f}(g); return c.toDataURL() }}""")
        open(UIT + naam + '.png', 'wb').write(base64.b64decode(url.split(',')[1])); print('ok', naam)
    br.close()
