/* Runner & Gunner — als spel in de Fibro-chat.
   Zelfde opbouw als pong-ui.js: één ingang, start(), die zichzelf in
   #spelInhoud tekent en zichzelf opruimt zodra het spel gesloten wordt.
   Beide spelers zitten in hetzelfde spelkanaal; uit de naam daarvan komt
   de seed, dus jullie rennen op precies dezelfde baan. */

const PHASER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js'
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'

function laadPhaser() {
  if (window.Phaser) return Promise.resolve()
  if (window._rgPhaserLaden) return window._rgPhaserLaden
  window._rgPhaserLaden = new Promise((ok, fout) => {
    const s = document.createElement('script')
    s.src = PHASER_URL
    s.onload = () => ok()
    s.onerror = () => { window._rgPhaserLaden = null; fout(new Error('Phaser kon niet laden')) }
    document.head.appendChild(s)
  })
  return window._rgPhaserLaden
}

function zetStijl() {
  if (!document.getElementById('rg-font')) {
    const l = document.createElement('link')
    l.id = 'rg-font'; l.rel = 'stylesheet'; l.href = FONT_URL
    document.head.appendChild(l)
  }
  if (document.getElementById('rg-stijl')) return
  const st = document.createElement('style')
  st.id = 'rg-stijl'
  st.textContent = `
  .rg{--diep:#0b1020;--paneel:#16203a;--rand:#2c3f66;--inkt:#dfeaff;--zacht:#7d90b8;--cyaan:#5ee7e0;--roze:#ff5d9e;
    position:absolute;inset:0;padding:52px 10px 64px;box-sizing:border-box;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
    color:var(--inkt);font-family:"Press Start 2P",monospace;font-size:11px;line-height:1.9;
    touch-action:manipulation;-webkit-user-select:none;user-select:none}
  .rg *{box-sizing:border-box}
  .rg .veld{position:relative;overflow:hidden;border:2px solid var(--rand);border-radius:6px;
    background:#4a7fc4;touch-action:none;-webkit-tap-highlight-color:transparent;flex:none}
  .rg .veld canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
  .rg .hud{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;
    padding:8px 9px;pointer-events:none;z-index:2}
  .rg .score{font-size:13px;color:#fff;text-shadow:2px 2px 0 #0b1020;letter-spacing:1px}
  .rg .meters{font-size:7px;color:#bfe9ff;text-shadow:1px 1px 0 #0b1020;margin-top:2px}
  .rg .ander{font-size:7px;color:#ffd27a;text-shadow:1px 1px 0 #0b1020;margin-top:4px}
  .rg .harten{display:flex;gap:4px}
  .rg .harten svg{width:14px;height:12px;shape-rendering:crispEdges}
  .rg .laag{position:absolute;inset:0;display:grid;place-items:center;text-align:center;
    background:rgba(8,12,26,.9);padding:16px;overflow-y:auto;z-index:3}
  .rg .laag[hidden]{display:none}
  .rg .laag h1{margin:0 0 10px;font-size:15px;color:var(--cyaan);text-shadow:2px 2px 0 #0b1020;line-height:1.6;font-weight:400}
  .rg .laag p{margin:0 0 14px;color:var(--zacht);max-width:34ch;font-size:9px;line-height:2}
  .rg .keuze{display:flex;gap:8px;justify-content:center;margin-bottom:14px}
  .rg .keuze button{font-family:inherit;font-size:9px;line-height:1.8;color:var(--inkt);
    background:var(--paneel);border:2px solid var(--rand);border-radius:0;padding:8px 9px;
    width:132px;text-align:left;cursor:pointer}
  .rg .keuze button[aria-pressed="true"]{border-color:var(--cyaan);background:#20345c}
  .rg .keuze b{display:block;color:#fff;margin-bottom:4px;font-weight:400}
  .rg .keuze small{display:block;color:var(--zacht);font-size:7px;line-height:1.9}
  .rg .knop{font-family:inherit;font-size:11px;color:#08131f;background:var(--cyaan);border:none;
    border-radius:0;padding:11px 20px;cursor:pointer;box-shadow:3px 3px 0 #1c9aa2}
  .rg .knop:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #1c9aa2}
  .rg .fout{padding:18px;color:var(--roze);font-size:10px;line-height:2;text-align:center}
  /* klein veld: startscherm compacter */
  .rg.klein .laag{padding:8px}
  .rg.klein .laag h1{font-size:11px;margin-bottom:6px;line-height:1.4}
  .rg.klein .laag p{font-size:7px;line-height:1.8;margin-bottom:8px}
  .rg.klein .keuze{gap:6px;margin-bottom:8px}
  .rg.klein .keuze button{width:auto;flex:1;max-width:140px;padding:5px 7px}
  .rg.klein .keuze b{margin-bottom:0}
  .rg.klein .keuze small{display:none}
  .rg.klein .knop{font-size:10px;padding:8px 18px}
  /* bedieningsvlakken, alleen rechtop op een aanraakscherm */
  .rg .bediening{display:none;width:100%;gap:8px}
  .rg.staand .bediening{display:flex}
  .rg .zone{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:10px;border:2px solid;border-radius:10px;background:rgba(22,32,58,.55);touch-action:none;
    -webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;text-align:center;padding:10px}
  .rg .zone b{font-size:12px;font-weight:400}
  .rg .zone small{font-size:7px;line-height:2;color:var(--zacht)}
  .rg .zSpring{border-color:var(--cyaan);color:var(--cyaan)}
  .rg .zSchiet{border-color:var(--roze);color:var(--roze)}
  .rg .zSpring.in{background:rgba(94,231,224,.16)}
  /* liggend: het veld vult het hele scherm; sluit- en microfoonknop liggen erbovenop */
  .rg.liggend{padding:0}
  .rg.liggend .veld{border:none;border-radius:0}
  .rg.liggend .hud{padding-right:108px}
  body.rg-vol #spelChatWrap{display:none!important}
  .rg .zSchiet.in{background:rgba(255,93,158,.16)}
  `
  document.head.appendChild(st)
}

/* seed uit de kanaalnaam: voor beide spelers gelijk */
function seedUit(tekst) {
  let h = 0x811c9dc5
  for (let i = 0; i < tekst.length; i++) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h | 0
}

function typtIemand() {
  const a = document.activeElement
  return !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName))
}

export async function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (!inhoud) return
  if (titel) titel.textContent = '🏃 Runner & Gunner'
  if (getComputedStyle(inhoud).position === 'static') inhoud.style.position = 'relative'
  zetStijl()

  const naamVriend = String(vriendNaam || 'je vriend').replace(/[<>&"]/g, '')
  const wrap = document.createElement('div')
  wrap.className = 'rg'
  wrap.innerHTML = `
    <div class="veld">
      <div class="hud" aria-hidden="true">
        <div><div class="score">0000000</div><div class="meters">0M</div><div class="ander"></div></div>
        <div class="harten"></div>
      </div>
      <div class="laag">
        <div>
          <h1>RUNNER &amp; GUNNER</h1>
          <p>Jij en ${naamVriend} rennen op dezelfde baan. Wie komt het verst?</p>
          <div class="keuze">
            <button class="kRunner" aria-pressed="true"><b>RUNNER</b><small>Licht. Springt hoog. Schiet snel.</small></button>
            <button class="kGunner" aria-pressed="false"><b>GUNNER</b><small>Zwaar. Lage sprong. Lange glijpartij.</small></button>
          </div>
          <button class="knop">START</button>
        </div>
      </div>
    </div>
    <div class="bediening" aria-hidden="true">
      <div class="zone zSpring"><b>SPRING</b><small>tik = springen<br>nog eens = dubbel<br>omlaag vegen = glijden</small></div>
      <div class="zone zSchiet"><b>SCHIET</b><small>tik = schieten</small></div>
    </div>`
  inhoud.appendChild(wrap)

  const veld = wrap.querySelector('.veld')
  const laag = wrap.querySelector('.laag')
  const startKnop = wrap.querySelector('.knop')
  const kRunner = wrap.querySelector('.kRunner')
  const kGunner = wrap.querySelector('.kGunner')
  const metersVak = wrap.querySelector('.meters')
  const hartenVak = wrap.querySelector('.harten')
  const scoreVak = wrap.querySelector('.score')
  const zS = wrap.querySelector('.zSpring')
  const zX = wrap.querySelector('.zSchiet')

  try { await laadPhaser() } catch (e) {
    wrap.innerHTML = '<p class="fout">Het spel kon niet laden.<br>Controleer je verbinding en probeer opnieuw.</p>'
    return
  }
  if (!isActief() || !wrap.isConnected) { wrap.remove(); return }

  const Phaser = window.Phaser
  const SEED = seedUit((spelKanaal && (spelKanaal.topic || spelKanaal.subTopic)) || String(Date.now()))
  const aanraak = window.matchMedia && window.matchMedia('(pointer:coarse)').matches
  let huidige = null
  let spel = null

  /* ---------- indeling: past het veld in de ruimte die de chat overlaat ---------- */
  function indeling() {
    const volB = wrap.clientWidth, volH = wrap.clientHeight
    const liggend = volB > volH
    const W = volB - 20, H = volH - 52 - 64
    const staand = aanraak && !liggend
    wrap.classList.toggle('liggend', liggend)
    wrap.classList.toggle('staand', staand)
    let vb, vh
    if (liggend) {
      vh = volH; vb = Math.min(volB, Math.round(vh * 640 / 180))
    } else if (staand) {
      vb = W; vh = Math.round(vb * 180 / 320)
      const rest = H - vh - 10
      wrap.querySelector('.bediening').style.height = Math.max(110, rest) + 'px'
    } else {
      vh = H; vb = Math.min(W, Math.round(vh * 640 / 180))
      if (vb < vh * 320 / 180) vh = Math.round(vb * 180 / 320)
    }
    veld.style.width = vb + 'px'
    veld.style.height = vh + 'px'
    wrap.classList.toggle('klein', vh < 260)
  }
  indeling()
  window.addEventListener('resize', indeling)
  window.addEventListener('orientationchange', indeling)

/* ---------- pixelraster-helper ---------- */
function px(g,kleur,x,y,b,h){ g.fillStyle(kleur,1); g.fillRect(x,y,b||1,h||1); }

/* ---------- palet, 16bit-beperkt ---------- */
var P={
  zwart:0x0d1326, wit:0xeaf4ff, grijs:0xb9cfe8, staal:0x6b84ad,
  blauw:0x3d7fd8, blauwD:0x23508f, cyaan:0x5ee7e0,
  rood:0xc0392b, roodD:0x7a2018, oranje:0xe8892f,
  roze:0xff5d9e, goud:0xffc94a,
  steenL:0x8fa3bd, steen:0x5d7396, steenD:0x3a4c6e,
  luchtA:0x4a7fc4, luchtB:0x6ea5d8, luchtC:0x9ecbe8, luchtD:0xc9e5f2,
  stadA:0x35558a, stadB:0x2a4370, raam:0x7fe3ff
};

var held="runner";
var HELDEN={
  runner:{sprong:305,tweede:255,loop:92,glijtijd:520,herlaad:260,levens:3,
    bb:9,bh:19,teken:tekenRunner,kogelKleur:P.cyaan,kogelR:2},
  gunner:{sprong:262,tweede:215,loop:92,glijtijd:720,herlaad:440,levens:4,
    bb:12,bh:21,teken:tekenGunner,kogelKleur:P.oranje,kogelR:3}
};
function kies(w){
  held=w;
  kRunner.setAttribute("aria-pressed",w==="runner");
  kGunner.setAttribute("aria-pressed",w==="gunner");
}
kRunner.addEventListener("click",function(){kies("runner");});
kGunner.addEventListener("click",function(){kies("gunner");});

function tekenHarten(n,max){
  var vorm=[[1,0],[2,0],[5,0],[6,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],
    [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
    [2,4],[3,4],[4,4],[5,4],[3,5],[4,5]];
  var uit="";
  for(var i=0;i<max;i++){
    var k=i<n?"#ff5d9e":"#3a4c6e",r="";
    for(var v=0;v<vorm.length;v++)r+='<rect x="'+vorm[v][0]+'" y="'+vorm[v][1]+'" width="1" height="1"/>';
    uit+='<svg viewBox="0 0 8 6" fill="'+k+'">'+r+'</svg>';
  }
  hartenVak.innerHTML=uit;
}
tekenHarten(3,3);

/* ---------- toevalsreeks ---------- */
function rng(seed){
  return function(){
    seed|=0;seed=seed+0x6D2B79F5|0;
    var t=Math.imul(seed^seed>>>15,1|seed);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

/* ---------- maten ---------- */
var BREED=320,HOOG=180,TEGEL=16,GRONDY=144,ZWAARTE=900,CHUNK=10*TEGEL;

/* ---------- figuren, met de hand op het pixelraster ---------- */
function tekenRunner(g,f){
  var K=P.zwart,B=P.blauw,D=P.blauwD,W=P.wit,C=P.cyaan,G=P.grijs;
  if(f===3){
    px(g,K,0,10,22,10);
    px(g,B,1,11,18,7); px(g,D,1,16,18,3);
    px(g,W,3,12,6,2);
    px(g,G,9,11,7,5); px(g,C,13,12,4,3);
    px(g,D,17,13,5,4); px(g,C,21,14,1,2);
    px(g,K,2,19,4,1); px(g,K,9,19,5,1);
    return;
  }
  px(g,K,2,0,11,10);
  px(g,B,3,1,9,8);
  px(g,W,4,1,5,2);
  px(g,C,8,3,4,4);
  px(g,D,3,7,6,2);
  px(g,K,0,1,2,2); px(g,B,0,2,2,1);
  px(g,K,2,9,10,8);
  px(g,B,3,10,8,6);
  px(g,C,5,11,3,2);
  px(g,G,3,10,2,4);
  px(g,D,3,15,8,2);
  px(g,K,11,11,9,6);
  px(g,D,12,12,7,4);
  px(g,C,18,13,1,2);
  var voor=f===0?7:3, achter=f===0?3:7;
  px(g,K,voor,16,4,4); px(g,B,voor+1,17,2,3);
  px(g,K,achter,16,3,3); px(g,D,achter+1,17,1,2);
  px(g,K,voor-1,19,5,1);
  px(g,K,achter-1,18,4,1);
}

function tekenGunner(g,f){
  var K=P.zwart,R=P.rood,D=P.roodD,O=P.oranje,C=P.cyaan,G=P.grijs,S=P.staal;
  if(f===3){
    px(g,K,0,11,26,11);
    px(g,R,1,12,22,8); px(g,D,1,18,22,3);
    px(g,O,3,13,7,2);
    px(g,G,10,12,8,6); px(g,C,14,13,5,4);
    px(g,S,19,14,7,5); px(g,K,25,15,1,3);
    px(g,K,2,21,5,1); px(g,K,10,21,6,1);
    return;
  }
  px(g,K,2,0,13,11);
  px(g,G,3,1,11,9);
  px(g,O,4,1,5,2);
  px(g,C,9,3,5,5);
  px(g,D,3,8,7,2);
  px(g,K,2,10,14,10);
  px(g,R,3,11,12,8);
  px(g,O,5,12,4,2);
  px(g,G,3,11,3,5);
  px(g,D,3,17,12,2);
  px(g,K,14,11,11,8);
  px(g,S,15,12,9,6);
  px(g,D,15,13,6,2);
  px(g,K,23,13,2,4);
  var voor=f===0?9:4, achter=f===0?4:9;
  px(g,K,voor,18,5,4); px(g,R,voor+1,19,3,3);
  px(g,K,achter,18,4,3); px(g,D,achter+1,19,2,2);
  px(g,K,voor-1,21,6,1);
  px(g,K,achter-1,20,5,1);
}

/* ---------- omgeving ---------- */
function maakTegel(scene){
  var g=scene.make.graphics({x:0,y:0,add:false});
  px(g,P.steen,0,0,16,16);
  px(g,P.steenL,0,0,16,3);
  px(g,P.cyaan,2,4,5,1);
  px(g,P.steenD,0,13,16,3);
  px(g,P.steenD,7,3,1,10);
  px(g,P.steenD,0,8,16,1);
  g.generateTexture("tegel",16,16);g.destroy();

  var b=scene.make.graphics({x:0,y:0,add:false});
  px(b,P.steenD,0,0,16,16);
  px(b,P.staal,1,1,14,14);
  px(b,P.steenL,1,1,14,2);
  px(b,P.roze,4,6,8,3);
  px(b,P.zwart,4,6,8,1);
  b.generateTexture("blok",16,16);b.destroy();

  /* aangeschoten blok: dezelfde steen met barsten erin */
  var s=scene.make.graphics({x:0,y:0,add:false});
  px(s,P.steenD,0,0,16,16);
  px(s,P.staal,1,1,14,14);
  px(s,P.steenL,1,1,14,2);
  px(s,P.roze,4,6,8,3);
  px(s,P.zwart,4,6,8,1);
  px(s,P.zwart,3,2,1,4); px(s,P.zwart,4,6,1,2);
  px(s,P.zwart,11,3,1,3); px(s,P.zwart,10,9,1,4);
  px(s,P.zwart,6,11,4,1);
  s.generateTexture("blokStuk",16,16);s.destroy();
}

function maakStad(scene){
  for(var laagNr=0;laagNr<2;laagNr++){
    var g=scene.make.graphics({x:0,y:0,add:false});
    var r=rng(laagNr===0?404:909);
    var kleur=laagNr===0?P.stadA:P.stadB;
    var x=0;
    while(x<BREED){
      var b=10+Math.floor(r()*20), h=24+Math.floor(r()*(laagNr===0?50:80));
      px(g,kleur,x,HOOG-h-20,b,h);
      for(var ry=0;ry<Math.floor(h/8)-1;ry++)
        for(var rx=0;rx<Math.floor(b/5);rx++)
          if(r()<0.45)px(g,P.raam,x+2+rx*5,HOOG-h-16+ry*8,2,3);
      x+=b+2+Math.floor(r()*8);
    }
    g.generateTexture("stad"+laagNr,BREED,HOOG);g.destroy();
  }
}

function maakLucht(scene){
  var g=scene.make.graphics({x:0,y:0,add:false});
  px(g,P.luchtA,0,0,BREED,40);
  px(g,P.luchtB,0,40,BREED,40);
  px(g,P.luchtC,0,80,BREED,40);
  px(g,P.luchtD,0,120,BREED,60);
  for(var b=0;b<3;b++){
    var y=40+b*40, k=[P.luchtA,P.luchtB,P.luchtC][b];
    for(var x=0;x<BREED;x+=2)px(g,k,x+(b%2),y,1,1);
    for(var x2=0;x2<BREED;x2+=4)px(g,k,x2,y+2,1,1);
  }
  var r=rng(31);
  for(var w=0;w<5;w++){
    var cx=Math.floor(r()*BREED),cy=12+Math.floor(r()*44),cb=16+Math.floor(r()*18);
    px(g,P.luchtD,cx,cy,cb,4);
    px(g,P.luchtD,cx+3,cy-3,cb-8,3);
    px(g,P.wit,cx+3,cy-3,cb-12,1);
  }
  g.generateTexture("lucht",BREED,HOOG);g.destroy();
}

/* ---------- munten: drie standen van een draaiende munt ---------- */
function maakMunten(scene){
  function munt(naam,maat,breed){
    var g=scene.make.graphics({x:0,y:0,add:false});
    var x0=Math.floor((maat-breed)/2);
    px(g,P.zwart,x0,1,breed,maat-2);
    if(breed>2)px(g,P.zwart,x0+1,0,breed-2,maat);
    if(breed>2){
      px(g,P.goud,x0+1,1,breed-2,maat-2);
      px(g,0xc8871e,x0+breed-2,2,1,maat-4);
      px(g,P.wit,x0+1,2,1,2);
    } else px(g,P.goud,x0,1,breed,maat-2);
    g.generateTexture(naam,maat,maat);g.destroy();
  }
  munt("munt0",8,8); munt("munt1",8,5); munt("munt2",8,2);
  munt("muntD0",12,12); munt("muntD1",12,7); munt("muntD2",12,3);
}

/* ---------- scene ---------- */
var Spel=new Phaser.Class({
  Extends:Phaser.Scene,
  initialize:function Spel(){Phaser.Scene.call(this,{key:"spel"});},
  create:function(){
    var h=HELDEN[held];this.h=h;
    huidige=this;
    this.seed=SEED;this.camX=0;this.levens=h.levens;
    this.onraakbaar=0;this.glijdt=0;this.sprongen=0;this.wacht=0;
    this.coyote=0;this.herlaad=0;this.loper=0;
    this.laatsteChunk=-1;this.chunks={};
    this.brokken=[];this.bevries=0;
    this.score=0;this.getoond=0;this.muntTal=0;this.laatsteMeter=0;
    this.muntKlok=0;this.muntStand=0;

    ["r0","r1","r2","r3","kogel"].forEach(function(k){
      if(this.textures.exists(k))this.textures.remove(k);
    },this);
    for(var f=0;f<4;f++){
      var g=this.make.graphics({x:0,y:0,add:false});
      h.teken(g,f);
      g.generateTexture("r"+f,f===3?28:26,24);
      g.destroy();
    }
    /* kogeltextuur vooraf, niet pas bij het eerste schot */
    var gk=this.make.graphics({x:0,y:0,add:false}),R=h.kogelR;
    px(gk,h.kogelKleur,0,1,R*2+2,R*2);
    px(gk,h.kogelKleur,1,0,R*2,R*2+2);
    px(gk,P.wit,1,1,2,2);
    gk.generateTexture("kogel",R*2+2,R*2+2);gk.destroy();

    maakTegel(this);maakStad(this);maakLucht(this);maakMunten(this);

    this.add.image(0,0,"lucht").setOrigin(0,0).setScrollFactor(0).setDepth(-30);
    this.verA=this.add.tileSprite(0,0,BREED,HOOG,"stad1").setOrigin(0,0)
      .setScrollFactor(0).setDepth(-20);
    this.verB=this.add.tileSprite(0,0,BREED,HOOG,"stad0").setOrigin(0,0)
      .setScrollFactor(0).setDepth(-10);

    this.vast=this.physics.add.staticGroup();
    this.kogels=this.physics.add.group({allowGravity:false});
    this.munten=this.physics.add.group({allowGravity:false,immovable:true});

    this.speler=this.physics.add.sprite(60,80,"r0");
    this.speler.body.setSize(h.bb,h.bh);
    this.speler.body.setOffset(4,2);
    this.speler.setDepth(5);
    this.physics.add.collider(this.speler,this.vast);
    this.physics.add.overlap(this.kogels,this.vast,this.raakBlok,null,this);
    this.physics.add.overlap(this.speler,this.munten,this.pak,null,this);

    /* brokstukken worden met de hand getekend, geen aparte objecten */
    this.fx=this.add.graphics().setDepth(6);

    for(var c=0;c<4;c++)this.bouwChunk(c);
    this.laatsteChunk=3;
    this.cameras.main.setBounds(-1e6,0,2e7,HOOG);
    this.cameras.main.roundPixels=true;

    this.toetsen=this.input.keyboard.addKeys("SPACE,UP,DOWN,X",false);
    zetAanraking(this);
    maakGeest(this);
    tekenHarten(this.levens,h.levens);
  },

  bouwChunk:function(index){
    var r=rng(this.seed^Math.imul(index,0x9E3779B1));
    var basis=index*CHUNK,lijst=[],scene=this,bezet={};
    function tegel(tx,ty,key){
      bezet[tx+","+ty]=true;
      var b=scene.vast.create(basis+tx*TEGEL,ty*TEGEL,key||"tegel").setOrigin(0,0);
      b.refreshBody();
      b.stuk=(key==="blok");   /* alleen losse blokken zijn kapot te schieten */
      b.leven=2;
      lijst.push(b);return b;
    }
    var gat=-1;
    if(index>=2&&r()<0.4)gat=2+Math.floor(r()*5);
    for(var t=0;t<10;t++){
      if(t===gat||t===gat+1)continue;
      tegel(t,9);tegel(t,10);
    }
    if(index>=1){
      var n=r()<0.5?1:2;
      for(var i=0;i<n;i++){
        var tx=Math.floor(r()*9);
        if(tx===gat||tx===gat+1)continue;
        tegel(tx,8,"blok");
        if(r()<0.4)tegel(tx,7,"blok");
      }
    }
    /* een versperring: drie blokken op elkaar, dwars op je route */
    if(index>=3&&r()<0.35){
      var vx=1+Math.floor(r()*7);
      if(vx!==gat&&vx!==gat+1){
        tegel(vx,8,"blok");tegel(vx,7,"blok");tegel(vx,6,"blok");
      }
    }
    /* munten — pas NA de rest, zodat de baan zelf niet verschuift */
    if(index>=1){
      if(r()<0.6){                                   /* rijtje op de grond */
        var s0=Math.floor(r()*6),lengte=3+Math.floor(r()*3);
        for(var m=0;m<lengte;m++){
          var mx=s0+m;if(mx>9)break;
          if(mx===gat||mx===gat+1||bezet[mx+",8"])continue;
          lijst.push(scene.maakMunt(basis+mx*TEGEL+8,8*TEGEL+6,false));
        }
      }
      if(gat>=0){                                     /* boog over het gat */
        var boog=[5,4,4,5];
        for(var bi=0;bi<4;bi++)
          lijst.push(scene.maakMunt(basis+(gat-1+bi)*TEGEL+8,boog[bi]*TEGEL+8,false));
      }
      var top=null;                                   /* dikke munt, hoog */
      for(var sleutel in bezet){
        var dl=sleutel.split(","),kx=+dl[0],ky=+dl[1];
        if(ky<9&&(top===null||ky<top.y))top={x:kx,y:ky};
      }
      if(top&&r()<0.7)
        lijst.push(scene.maakMunt(basis+top.x*TEGEL+8,(top.y-2)*TEGEL+8,true));
    }
    this.chunks[index]=lijst;
  },

  maakMunt:function(x,y,dik){
    var m=this.munten.create(x,y,dik?"muntD0":"munt0");
    m.body.setAllowGravity(false);
    m.body.setSize(dik?10:6,dik?10:6);
    m.dik=dik;m.setDepth(3);
    return m;
  },

  pak:function(speler,munt){
    if(!munt.active)return;
    var waarde=munt.dik?50:10;
    this.score+=waarde;this.muntTal++;
    this.spat(munt.x,munt.y,[P.goud,P.wit],munt.dik?12:4);
    this.zweef(munt.x,munt.y-6,"+"+waarde,munt.dik?"#ffffff":"#ffc94a");
    munt.destroy();
  },

  zweef:function(x,y,tekst,kleur){
    var t=this.add.text(x,y,tekst,{fontFamily:'"Press Start 2P",monospace',
      fontSize:"8px",color:kleur,stroke:"#0d1326",strokeThickness:2})
      .setOrigin(0.5).setDepth(7);
    this.tweens.add({targets:t,y:y-18,alpha:0,duration:650,ease:"Cubic.easeOut",
      onComplete:function(){t.destroy();}});
  },
  ruimChunk:function(i){
    var l=this.chunks[i];if(!l)return;
    for(var k=0;k<l.length;k++)if(l[k]&&l[k].scene)l[k].destroy();
    delete this.chunks[i];
  },

  /* ---------- brokstukken, naar het voorbeeld van Blockit ---------- */
  spat:function(x,y,kleuren,aantal){
    for(var i=0;i<aantal;i++){
      var hoek=Math.random()*Math.PI*2,snel=40+Math.random()*150;
      this.brokken.push({
        x:x,y:y,
        vx:Math.cos(hoek)*snel,
        vy:Math.sin(hoek)*snel-70,
        leven:1,
        kleur:kleuren[Math.floor(Math.random()*kleuren.length)],
        maat:1+Math.floor(Math.random()*3)
      });
    }
    if(this.brokken.length>180)this.brokken=this.brokken.slice(-180);
  },
  tekenBrokken:function(d){
    var g=this.fx;g.clear();
    for(var i=this.brokken.length-1;i>=0;i--){
      var p=this.brokken[i];
      p.vy+=700*d;p.x+=p.vx*d;p.y+=p.vy*d;p.leven-=d*1.5;
      if(p.leven<=0){this.brokken.splice(i,1);continue;}
      g.fillStyle(p.kleur,p.leven>0.35?1:0.6);
      g.fillRect(Math.floor(p.x),Math.floor(p.y),p.maat,p.maat);
    }
  },

  raakBlok:function(kogel,blok){
    if(!kogel.active||!blok.scene)return;
    var mx=blok.x+8,my=blok.y+8;
    kogel.destroy();
    if(!blok.stuk){
      /* harde grond: alleen vonken, de kogel is weg */
      this.spat(mx-6,my-6,[P.wit,P.cyaan],4);
      return;
    }
    blok.leven--;
    if(blok.leven>0){
      blok.setTexture("blokStuk");
      this.spat(mx,my,[P.steenL,P.staal],5);
      this.cameras.main.shake(60,0.002);
      return;
    }
    this.spat(mx,my,[P.roze,P.staal,P.steenL,P.wit],16);
    blok.destroy();
    this.cameras.main.shake(100,0.005);
    this.bevries=60;                 /* alles staat heel even stil */
    this.physics.world.pause();
  },

  spring:function(){this.wacht=150;},
  glij:function(){
    if(this.glijdt>0||!this.speler.body.blocked.down)return;
    this.glijdt=this.h.glijtijd;
    this.speler.body.setSize(this.h.bb+6,10);
    this.speler.body.setOffset(2,12);
  },
  stopGlijden:function(){
    this.glijdt=0;
    this.speler.body.setSize(this.h.bb,this.h.bh);
    this.speler.body.setOffset(4,2);
  },
  schiet:function(){
    if(this.herlaad>0||this.bevries>0)return;
    this.herlaad=this.h.herlaad;
    var y=this.speler.y+(this.glijdt>0?5:-1);
    var k=this.kogels.create(this.speler.x+9,y,"kogel");
    k.body.setAllowGravity(false);
    k.body.setSize(6,6);
    k.setVelocityX(260);k.setDepth(4);k.geboren=this.time.now;
    this.spat(this.speler.x+12,y,[this.h.kogelKleur],2);
  },

  update:function(tijd,dt){
    dt=Math.min(dt,50);
    var d=dt/1000;

    /* korte stilstand na een treffer: alleen de brokstukken bewegen door */
    if(this.bevries>0){
      this.bevries-=dt;
      this.tekenBrokken(d*0.35);
      if(this.bevries<=0)this.physics.world.resume();
      return;
    }

    var s=this.speler,h=this.h;

    this.camX+=h.loop*d;
    this.cameras.main.scrollX=Math.floor(this.camX);
    this.verB.tilePositionX=this.camX*0.35;
    this.verA.tilePositionX=this.camX*0.15;

    var nodig=Math.floor((this.camX+BREED)/CHUNK)+1;
    while(this.laatsteChunk<nodig){this.laatsteChunk++;this.bouwChunk(this.laatsteChunk);}
    var oud=Math.floor((this.camX-CHUNK*2)/CHUNK);
    if(this.chunks[oud])this.ruimChunk(oud);

    s.setVelocityX(h.loop);

    if(s.body.blocked.down){this.sprongen=0;this.coyote=110;}
    else if(this.coyote>0)this.coyote-=dt;

    var typt=typtIemand();
    if(!typt&&(this.toetsen.SPACE.isDown||this.toetsen.UP.isDown)){
      if(!this.sVast){this.sVast=true;this.spring();}
    } else this.sVast=false;
    if(!typt&&this.toetsen.DOWN.isDown)this.glij();
    if(!typt&&this.toetsen.X.isDown){if(!this.xVast){this.xVast=true;this.schiet();}}
    else this.xVast=false;

    if(this.wacht>0){
      this.wacht-=dt;
      var eerste=s.body.blocked.down||this.coyote>0;
      if(eerste&&this.sprongen===0){
        s.setVelocityY(-h.sprong);this.sprongen=1;this.wacht=0;this.coyote=0;
        this.stopGlijden();
      } else if(!eerste&&this.sprongen===1){
        s.setVelocityY(-h.tweede);this.sprongen=2;this.wacht=0;
        ring(this,s.x,s.y+6);
      }
    }
    if(s.body.velocity.y<0&&!(this.toetsen.SPACE.isDown||this.vinger))
      s.body.velocity.y+=ZWAARTE*0.5*d;

    if(this.glijdt>0){this.glijdt-=dt;if(this.glijdt<=0)this.stopGlijden();}
    if(this.herlaad>0)this.herlaad-=dt;
    if(this.onraakbaar>0){
      this.onraakbaar-=dt;
      s.setVisible(Math.floor(this.onraakbaar/80)%2===0);
      if(this.onraakbaar<=0)s.setVisible(true);
    }

    this.loper+=d*(s.body.blocked.down&&this.glijdt<=0?9:0);
    var frame=this.glijdt>0?"r3":(!s.body.blocked.down?"r2":"r"+(Math.floor(this.loper)%2));
    if(s.texture.key!==frame&&this.textures.exists(frame))s.setTexture(frame);

    this.kogels.children.each(function(k){
      if(k.active&&(k.x>this.camX+BREED+20||tijd-k.geboren>2200))k.destroy();
    },this);

    this.tekenBrokken(d);

    this.muntKlok+=dt;
    if(this.muntKlok>110){
      this.muntKlok=0;this.muntStand=(this.muntStand+1)%4;
      var st=[0,1,2,1][this.muntStand];
      this.munten.children.each(function(m){
        if(m.active)m.setTexture((m.dik?"muntD":"munt")+st);
      });
    }

    var meter=Math.floor(this.camX/16);
    if(meter>this.laatsteMeter){this.score+=meter-this.laatsteMeter;this.laatsteMeter=meter;}
    if(this.getoond<this.score){
      this.getoond+=Math.max(1,Math.ceil((this.score-this.getoond)*0.18));
      if(this.getoond>this.score)this.getoond=this.score;
      scoreVak.textContent=String(this.getoond).padStart(7,"0");
    }

    if(s.x<this.camX+8||s.y>HOOG+80)this.verliesLeven();
    metersVak.textContent=meter+"M  "+this.muntTal+" MUNTEN";
    netwerkStap(this,tijd,dt);
  },

  verliesLeven:function(){
    if(this.onraakbaar>0&&this.speler.x>=this.camX+8)return;
    this.levens--;
    tekenHarten(Math.max(0,this.levens),this.h.levens);
    this.cameras.main.shake(140,0.006);
    this.spat(this.speler.x,this.speler.y,[P.roze,P.wit],14);
    if(this.levens<=0){this.einde();return;}
    this.speler.setPosition(this.camX+90,50);
    this.speler.setVelocity(0,0);
    this.stopGlijden();
    this.onraakbaar=1500;
  },

  einde:function(){
    var m=Math.floor(this.camX/16);
    this.scene.pause();
    stuurEinde(this);
    laag.querySelector("h1").textContent="GAME OVER";
    scoreVak.textContent=String(this.score).padStart(7,"0");
    laag.querySelector("p").textContent="SCORE "+String(this.score).padStart(7,"0")+
      " — "+m+" meter, "+this.muntTal+" munten.";
    startKnop.textContent="OPNIEUW";
    laag.hidden=false;startKnop.focus({preventScroll:true});
  }
});

function ring(scene,x,y){
  var c=scene.add.circle(x,y,4).setStrokeStyle(1,P.cyaan,1).setDepth(4);
  scene.tweens.add({targets:c,scale:3,alpha:0,duration:260,
    onComplete:function(){this.targets[0].destroy();}});
}

function zetAanraking(scene){
  scene.vinger=false;
  var start={};
  scene.input.on("pointerdown",function(p){
    var links=p.x<scene.scale.width/2;
    start[p.id]={y:p.y,t:scene.time.now,geveegd:false,links:links};
    if(links){scene.vinger=true;scene.spring();}
    else scene.schiet();
  });
  scene.input.on("pointermove",function(p){
    var s=start[p.id];
    if(!s||s.geveegd||!s.links)return;
    if(p.y-s.y>26&&scene.time.now-s.t<420){s.geveegd=true;scene.glij();}
  });
  function los(p){
    delete start[p.id];
    scene.vinger=Object.keys(start).some(function(k){return start[k].links;});
  }
  scene.input.on("pointerup",los);
  scene.input.on("pointerupoutside",los);
}


  /* ---------- samen: de ander als doorzichtige figuur ---------- */
  const anderVak = wrap.querySelector('.ander')
  const NAAM = naamVriend.toUpperCase().slice(0, 10)
  let ander = null          // laatste stand van de ander
  let stuurKlok = 0
  function stuur(p) {
    if (!spelKanaal || typeof spelKanaal.send !== 'function' || !isActief()) return
    try { spelKanaal.send({ type: 'broadcast', event: 'rg', payload: p }) } catch (e) {}
  }
  function toonAnder() {
    if (!ander) { anderVak.textContent = NAAM + ': NOG NIET GESTART'; return }
    const sc = String(ander.s || 0).padStart(7, '0')
    anderVak.textContent = ander.d ? NAAM + ': GAME OVER ' + sc
      : NAAM + ' ' + sc + '  ' + '\u2665'.repeat(Math.max(0, ander.l || 0))
  }
  toonAnder()
  if (spelKanaal && typeof spelKanaal.on === 'function') spelKanaal.on('broadcast', { event: 'rg' }, msg => {
    const p = msg && msg.payload
    if (!p || typeof p.x !== 'number') return
    ander = { x: p.x, y: p.y, f: p.f | 0, h: p.h === 'gunner' ? 'gunner' : 'runner',
              s: p.s | 0, l: p.l | 0, d: !!p.d, v: +p.v || 92, tijd: performance.now() }
    toonAnder()
  })

  function maakGeest(scene) {
    ;[['runner', tekenRunner], ['gunner', tekenGunner]].forEach(([n, teken]) => {
      for (let f = 0; f < 4; f++) {
        const k = 'gh_' + n + f
        if (scene.textures.exists(k)) continue
        const g = scene.make.graphics({ x: 0, y: 0, add: false })
        teken(g, f); g.generateTexture(k, f === 3 ? 28 : 26, 24); g.destroy()
      }
    })
    scene.geest = scene.add.sprite(-500, -500, 'gh_runner0').setAlpha(0.5).setDepth(4).setVisible(false)
    const stijl = { fontFamily: '"Press Start 2P",monospace', fontSize: '6px', color: '#ffd27a', stroke: '#0d1326', strokeThickness: 2 }
    scene.geestNaam = scene.add.text(0, 0, NAAM, stijl).setOrigin(0.5, 1).setDepth(7).setVisible(false)
    scene.pijl = scene.add.text(0, 0, '', stijl).setScrollFactor(0).setDepth(8).setVisible(false)
  }

  function netwerkStap(scene, tijd, dt) {
    const s = scene.speler
    stuurKlok += dt
    if (stuurKlok >= 160) {                         // zes keer per seconde
      stuurKlok = 0
      stuur({ x: Math.round(s.x), y: Math.round(s.y), f: parseInt(s.texture.key.slice(1)) || 0,
              h: held, s: scene.score, l: scene.levens, v: scene.h.loop, d: 0 })
    }
    const g = scene.geest, nm = scene.geestNaam, pijl = scene.pijl
    const oud = ander ? performance.now() - ander.tijd : 1e9
    if (!ander || ander.d || oud > 3000) { g.setVisible(false); nm.setVisible(false); pijl.setVisible(false); return }
    // tussen twee berichten doorrekenen: de ander rent altijd even hard vooruit
    const doelX = ander.x + ander.v * Math.min(oud, 400) / 1000
    if (!g.visible || Math.abs(doelX - g.x) > 160) g.setPosition(doelX, ander.y)
    g.x += (doelX - g.x) * 0.3
    g.y += (ander.y - g.y) * 0.3
    g.setTexture('gh_' + ander.h + Math.min(3, Math.max(0, ander.f)))
    const cam = scene.camX, links = g.x < cam - 10, rechts = g.x > cam + BREED + 10
    if (!links && !rechts) {
      g.setVisible(true); nm.setVisible(true).setPosition(Math.round(g.x), Math.round(g.y - 14))
      pijl.setVisible(false)
    } else {
      g.setVisible(false); nm.setVisible(false)
      const verschil = Math.round((g.x - s.x) / 16)
      pijl.setText(links ? '< ' + NAAM + ' ' + verschil + 'M' : NAAM + ' +' + verschil + 'M >')
      pijl.setOrigin(links ? 0 : 1, 0.5)
      pijl.setPosition(links ? 4 : BREED - 4, Math.max(40, Math.min(150, Math.round(g.y))))
      pijl.setVisible(true)
    }
  }

  function stuurEinde(scene) {
    stuur({ x: Math.round(scene.speler.x), y: Math.round(scene.speler.y), f: 0, h: held,
            s: scene.score, l: 0, v: 0, d: 1 })
  }

  /* ---------- bediening buiten het veld ---------- */
  function speeltNu() {
    try { return !!(huidige && huidige.sys && huidige.sys.isActive()) } catch (e) { return false }
  }
  let begin = null
  zS.addEventListener('pointerdown', e => {
    e.preventDefault(); zS.classList.add('in')
    begin = { y: e.clientY, t: performance.now(), geveegd: false, id: e.pointerId }
    if (speeltNu()) { huidige.vinger = true; huidige.spring() }
  })
  zS.addEventListener('pointermove', e => {
    if (!begin || begin.geveegd || e.pointerId !== begin.id) return
    if (e.clientY - begin.y > 30 && performance.now() - begin.t < 450) {
      begin.geveegd = true; if (speeltNu()) huidige.glij()
    }
  })
  const losS = () => { zS.classList.remove('in'); begin = null; if (huidige) huidige.vinger = false }
  zS.addEventListener('pointerup', losS)
  zS.addEventListener('pointercancel', losS)
  zS.addEventListener('pointerleave', losS)
  zX.addEventListener('pointerdown', e => {
    e.preventDefault(); zX.classList.add('in')
    if (speeltNu()) huidige.schiet()
  })
  ;['pointerup', 'pointercancel', 'pointerleave'].forEach(n => zX.addEventListener(n, () => zX.classList.remove('in')))

  /* iOS zoomt bij een dubbeltik via touch-gebeurtenissen */
  ;[zS, zX, veld].forEach(el => {
    const stop = e => { if (e.target.closest('.knop,.keuze')) return; e.preventDefault() }
    el.addEventListener('touchstart', stop, { passive: false })
    el.addEventListener('touchend', stop, { passive: false })
  })

  /* ---------- starten ---------- */
  startKnop.addEventListener('click', () => {
    indeling()
    const verh = veld.clientWidth / Math.max(1, veld.clientHeight)
    BREED = Math.round(Math.min(640, Math.max(320, HOOG * verh)) / 2) * 2
    laag.hidden = true
    scoreVak.textContent = '0000000'; metersVak.textContent = '0M'
    tekenHarten(HELDEN[held].levens, HELDEN[held].levens)
    huidige = null
    if (spel) { spel.destroy(true); spel = null }
    spel = new Phaser.Game({
      type: Phaser.AUTO, width: BREED, height: HOOG, parent: veld,
      pixelArt: true, roundPixels: true, backgroundColor: '#4a7fc4',
      input: { activePointers: 3 },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { y: ZWAARTE } } },
      scene: [Spel]
    })
  })

  /* ---------- opruimen zodra het spel gesloten wordt ---------- */
  const waker = setInterval(() => {
    if (isActief() && wrap.isConnected) {
      document.body.classList.toggle('rg-vol', wrap.classList.contains('liggend') && laag.hidden)
      return
    }
    clearInterval(waker)
    document.body.classList.remove('rg-vol')
    window.removeEventListener('resize', indeling)
    window.removeEventListener('orientationchange', indeling)
    huidige = null
    if (spel) { try { spel.destroy(true) } catch (e) {} spel = null }
    if (wrap.isConnected) wrap.remove()
  }, 300)
  return { _proef: { maakGeest, netwerkStap, stuurEinde, ander: () => ander } }
}
