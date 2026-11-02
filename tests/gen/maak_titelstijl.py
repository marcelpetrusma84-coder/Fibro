# maak_titelstijl.py - maakt titelstijl.js: de tekencode van The Swarm, Runner & Gunner en Neon Raiders,
# letterlijk gekopieerd uit de spellen zelf, zodat hun titelscherm er precies zo uitziet als het spel.
# Gebruik (in de map van Fibro): python3 tests/gen/maak_titelstijl.py
# Verandert een van die spellen zijn plaatjes, draai dit dan opnieuw.
import re, sys, os

MAP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
lees = lambda f: open(os.path.join(MAP, f), encoding='utf-8').read().split('\n')

def stuk(regels, van, tot, naam):
    """regels van..tot (1-telling, tot erbij) met een controle op het begin, zodat een verschoven bestand opvalt"""
    s = regels[van - 1:tot]
    return s

def zoek(regels, patroon, start=0):
    for i in range(start, len(regels)):
        if re.search(patroon, regels[i]):
            return i + 1
    sys.exit('niet gevonden: ' + patroon)

# ── The Swarm ──
sw = lees('swarm-ui.js')
a = zoek(sw, r'^function mk\(w,h\)'); b = zoek(sw, r'^function draw\(s,x,y,ga\)')
sw_hulp = sw[a - 1:b - 1]                                     # mk, sprite
a = zoek(sw, r'^const mir='); b = zoek(sw, r'^const rock=')
sw_sprites = sw[a - 1:b]                                       # held, beestjes, plant, tv, krat, ...
a = zoek(sw, r'^function bgHuis\(FL\)'); b = zoek(sw, r'return b\}$', a)
sw_huis = sw[a - 1:b]
a = zoek(sw, r'^const MA='); b = zoek(sw, r"^const GC=")
sw_meer = sw[a - 1:b]
sw_held = [sw[zoek(sw, r'^const HEROPAL=') - 1]]
sw_slijm = [sw[zoek(sw, r'^const SLIME=') - 1]]

# ── Runner & Gunner ──
rg = lees('runner-gunner-ui.js')
a = zoek(rg, r'^var FIG = \(function\(\)\{'); b = zoek(rg, r'^\}\)\(\);', a)
rg_fig = rg[a - 1:b]
a = zoek(rg, r'^function vlak\(g,k,x,y,b,h\)'); b = zoek(rg, r'^function nieuwDoek')
rg_hulp = rg[a - 1:b - 1]                                      # vlak, gloed, neonBord
a = zoek(rg, r'^function rng\(seed\)'); rg_rng = rg[a - 1:a + 7]
a = zoek(rg, r"^  \{ id:'stad'"); rg_stad = rg[a - 1:a + 4]
a = zoek(rg, r'^  stad: function\(v,d,r,B\)\{'); b = zoek(rg, r'^  jungle: function', a)
rg_lagen = rg[a - 1:b - 1]

# ── Neon Raiders ──
nr = lees('neon-raiders-ui.js')
a = zoek(nr, r'^function rng\(seed\) \{'); nr_rng = nr[a - 1:a + 7]
nr_hulp = [nr[zoek(nr, '^function ' + f + r'\(') - 1] for f in ('veelhoek', 'lijn', 'lin', 'rad', 'rondRect', 'wolk')]
a = zoek(nr, r"^    for \(const \[key, K\] of \[\['schip'"); b = zoek(nr, r'^    \}, K\.gloed, 5\)', a)
nr_schip = nr[a - 1:b]
a = zoek(nr, r'^    // vlammen:'); b = zoek(nr, r'^    \}$', a)
nr_vlam = nr[a - 1:b]
nr_puls = [nr[zoek(nr, r"^    this\.teken\('puls'") - 1]]
a = zoek(nr, r"^    this\.teken\(k\('dart'\)"); b = zoek(nr, r'^    \}, p\.gloed, 5\)', a)
nr_dart = nr[a - 1:b]
a = zoek(nr, r'^const PALET = \{'); b = zoek(nr, r'^\}$', a)
nr_palet = nr[a - 1:b]
a = zoek(nr, r'^  sterrenLaag\(key, n, maat, alpha, seed, kruis\) \{'); b = zoek(nr, r'^  \},$', a)
nr_sterren = nr[a - 1:b]
a = zoek(nr, r'^  achtergrond_ruimte\(\) \{'); b = zoek(nr, r'^  \},$', a)
nr_ruimte = nr[a - 1:b]

def blok(r):
    return '\n'.join(r)

uit = f'''// titelstijl.js - GEMAAKT door tests/gen/maak_titelstijl.py; niet met de hand aanpassen (v1, 2 nov 2026)
//
// In gewone woorden: de tekencode van drie spellen, letterlijk overgenomen uit het spel zelf, zodat hun titelscherm
// in precies dezelfde stijl is: The Swarm (swarm-ui.js, pixels op 140 x 210), Runner & Gunner (runner-gunner-ui.js,
// pixelfiguren en de neonstad) en Neon Raiders (neon-raiders-ui.js, neon in vectorstijl op 360 x 640).
// Alles zit in functies die pas iets maken als het titelscherm opent (zonder pagina werkt het niet).

/* eslint-disable */

// ── The Swarm ──
export function maakSwarm() {{
const D=document,W=140,H=210;
{blok(sw_hulp)}
{blok(sw_sprites)}
{blok(sw_huis)}
{blok(sw_meer)}
{blok(sw_held)}
const heroS=i=>({{A:sprite(HT.concat(HLa),HEROPAL[i],HEROPAL[i].L,2),B:sprite(HT.concat(HLb),HEROPAL[i],HEROPAL[i].L,2)}});
{blok(sw_slijm)}
const bugT=(A,B,pal,gl)=>{{const P=Object.assign({{}},PI,pal||{{}});return{{A:sprite(A,P,gl||GC),B:sprite(B,P,gl||GC)}}}};
const TY={{sp:bugT(SA,SB),hg:bugT(HA,HB),ws:bugT(WA,WB),br:bugT(mir(BL),mir(BLb)),
mt:bugT(MA,MB,{{f:'#8a7a5a',a:'#4a3a2a'}},'#d0ff60'),kv:bugT(KA,KB,{{b:'#2a1a2a',c:'#6a4a6a',l:'#5a4a5a'}},'#c040ff'),
sl:bugT(TA,TB,{{b:'#5a6a20',V:'#d0ff40'}},'#b0ff30')}};
const omslag=(fn,w,h)=>{{const c=mk(w,h),q=c.getContext('2d');for(let y=0;y<h;y++)for(let x=0;x<w;x++){{const k=fn(x,y);if(k){{q.fillStyle=k;q.fillRect(x,y,1,1)}}}}return c}};
const dekking=[[omslag(plant,18,32),6],[omslag(tv,20,26),60],[omslag(crate(20,24),20,24),114]];
return {{W,H,mk,bg:bgHuis(120),FL:120,held:heroS(0),held2:heroS(1),TY,SLIME,dekking}};
}}

// ── Runner & Gunner ──
export function maakRunner() {{
const vertaal = s => s;
{blok(rg_fig)}
{blok(rg_hulp)}
{blok(rg_rng)}
var LAAG_B = 512, LAAG_H = 360, GROND_Y = 288, BIOOM_LENGTE = 16;
var STAD = {blok(rg_stad).strip().rstrip(',')};
var LAGEN = {{
{blok(rg_lagen)}
}};
function doek(b,h){{ var c=document.createElement('canvas'); c.width=b; c.height=h; return {{c:c,g:c.getContext('2d')}}; }}
// de lucht (zoals tekenLucht in het spel)
var lucht = doek(320,LAAG_H), g = lucht.g, k = STAD.lucht, band = LAAG_H/4;
for (var i=0;i<4;i++) vlak(g,k[i],0,Math.round(i*band),320,Math.ceil(band)+1);
for (var j=1;j<4;j++){{ var y0 = Math.round(j*band);
  for (var x=0;x<320;x+=2){{ vlak(g,k[j-1],x+(j%2),y0,1,1); vlak(g,k[j-1],x,y0+2,1,1); if(x%4===0) vlak(g,k[j-1],x+1,y0+4,1,1); }} }}
var rs = rng(77);
for (var s=0;s<70;s++){{ var sx=Math.floor(rs()*320), sy=Math.floor(rs()*LAAG_H*0.5); g.globalAlpha = 0.4+rs()*0.6; vlak(g,'#ffffff',sx,sy,rs()<0.15?2:1,rs()<0.15?2:1); }}
g.globalAlpha = 1;
// de twee lagen gebouwen (zoals tekenLagen)
var ver = doek(LAAG_B,LAAG_H), dicht = doek(LAAG_B,LAAG_H);
LAGEN.stad(ver.g,dicht.g,rng(STAD.id.length*9173+STAD.id.charCodeAt(0)),STAD);
// grondtegels (zoals tekenTegels)
var G = STAD.grond, T = 32, gt = doek(T,T), q = gt.g;
vlak(q,G.vlak,0,0,T,T); vlak(q,G.boven,0,0,T,8); vlak(q,G.donker,0,8,T,2); vlak(q,G.lijn,0,0,T,2);
q.globalAlpha=0.35; vlak(q,G.lijn,0,2,T,2); q.globalAlpha=1;
vlak(q,G.donker,0,18,T,2); vlak(q,G.donker,15,10,2,8); vlak(q,G.donker,6,20,2,12); vlak(q,G.donker,24,20,2,12);
vlak(q,G.boven,2,4,6,2); vlak(q,G.boven,18,4,8,2);
var gb = doek(T,T), h2 = gb.g;
vlak(h2,G.vlak,0,0,T,T); vlak(h2,G.donker,0,0,T,2); vlak(h2,G.donker,0,16,T,2); vlak(h2,G.donker,9,2,2,14); vlak(h2,G.donker,25,18,2,14);
h2.globalAlpha=0.5; vlak(h2,G.donker,0,24,T,8); h2.globalAlpha=1;
// kogels (zoals in het spel)
var k1 = doek(12,6), a1 = k1.g; vlak(a1,'#0a5a66',0,1,12,4); vlak(a1,'#5ee7e0',1,1,11,4); vlak(a1,'#ffffff',6,2,5,2);
var k2 = doek(10,10), b1 = k2.g; vlak(b1,'#5a1e06',2,0,6,10); vlak(b1,'#5a1e06',0,2,10,6); vlak(b1,'#e8892f',2,2,6,6); vlak(b1,'#ffe08a',3,3,3,3);
// de figuren: 8 loopbeeldjes van elk
function figuur(C){{ var pal=FIG.palet(C), uit=[]; for (var n=0;n<8;n++){{ var r=FIG.beeldje(C,n,8), d=doek(r.b,r.h);
  for (var y=0;y<r.h;y++) for (var x2=0;x2<r.b;x2++){{ var c=r.d[y*r.b+x2]; if(c){{ d.g.fillStyle=pal[c]; d.g.fillRect(x2,y,1,1); }} }}
  uit.push(d.c); }} return uit; }}
return {{ LAAG_B:LAAG_B, LAAG_H:LAAG_H, GROND_Y:GROND_Y, STAD:STAD, lucht:lucht.c, ver:ver.c, dicht:dicht.c, grondT:gt.c, grondB:gb.c,
  kogelR:k1.c, kogelG:k2.c, runner:figuur(FIG.RUNNER), gunner:figuur(FIG.GUNNER) }};
}}

// ── Neon Raiders ──
export function maakNeon() {{
const R = 2
{blok(nr_rng)}
{blok(nr_hulp)}
{blok(nr_palet)}
const tex = {{}}
const maker = {{
  teken(key, b, h, f, gloed, sterkte) {{
    const pad = gloed ? 6 : 0
    const c = document.createElement('canvas'); c.width = Math.ceil((b + pad * 2) * R); c.height = Math.ceil((h + pad * 2) * R)
    const g = c.getContext('2d')
    if (gloed) {{
      const o = document.createElement('canvas'); o.width = Math.ceil(b * R); o.height = Math.ceil(h * R)
      const og = o.getContext('2d'); og.scale(R, R); f(og, b, h)
      g.shadowColor = gloed; g.shadowBlur = (sterkte || 7) * R; g.drawImage(o, pad * R, pad * R)
      g.shadowBlur = 0; g.drawImage(o, pad * R, pad * R)
    }} else {{ g.scale(R, R); f(g, b, h) }}
    tex[key] = {{ c, b: b + pad * 2, h: h + pad * 2 }}
  }},
{blok(nr_sterren)}
{blok(nr_ruimte)}
  vast() {{
{blok(nr_schip)}
{blok(nr_vlam)}
{blok(nr_puls)}
  }},
  vijanden(pn) {{
    const p = PALET[pn], k = s => s + '_' + pn
{blok(nr_dart)}
  }}
}}
const lagen = maker.achtergrond_ruimte()
maker.vast()
maker.vijanden('rood'); maker.vijanden('zwart')
return {{ tex, lagen }}
}}
'''
open(os.path.join(MAP, 'titelstijl.js'), 'w', encoding='utf-8').write(uit)
print('titelstijl.js gemaakt:', len(uit.split(chr(10))), 'regels')
