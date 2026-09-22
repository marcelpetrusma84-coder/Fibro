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
    background:#07051a;touch-action:none;-webkit-tap-highlight-color:transparent;flex:none}
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
  .rg .rol{font-size:8px;color:#ffd27a;margin-bottom:10px;line-height:2}
  .rg .knop:disabled{background:var(--rand);color:var(--zacht);box-shadow:none;cursor:default}
  .rg.telt .keuze,.rg.telt .knop,.rg.telt .rol{display:none}
  .rg.telt .laag h1{font-size:44px;line-height:1.2}
  .rg .bord{position:absolute;left:0;right:0;top:34%;text-align:center;pointer-events:none;z-index:2;
    font-size:clamp(14px,5.5vw,30px);color:#fff;letter-spacing:2px;opacity:0;
    text-shadow:0 0 3px var(--k),0 0 10px var(--k),0 0 22px var(--k),0 0 40px var(--k)}
  .rg .bord.aan{animation:rgBord 2.6s linear forwards}
  @keyframes rgBord{0%{opacity:0}4%{opacity:1}7%{opacity:.15}10%{opacity:1}13%{opacity:.35}16%{opacity:1}78%{opacity:1}100%{opacity:0}}
  .rg .geluidKnop{font-family:inherit;font-size:8px;color:var(--zacht);background:none;border:1px solid var(--rand);
    border-radius:0;padding:6px 10px;margin-top:12px;cursor:pointer}
  .rg.telt .geluidKnop{display:none}
  .rg.klein .geluidKnop{margin-top:6px;padding:4px 8px;font-size:7px}
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
          <div class="rol"></div>
          <div class="keuze">
            <button class="kRunner" aria-pressed="true"><b>RUNNER</b><small>Springt hoger.</small></button>
            <button class="kGunner" aria-pressed="false"><b>GUNNER</b><small>Sterker kanon.</small></button>
          </div>
          <button class="knop">START</button>
          <div><button class="geluidKnop" type="button">GELUID: AAN</button></div>
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

var FIG = (function(){
/* Runner & Gunner — figuren in code.
   Geen plaatjes: elk beeldje is een rooster van kleurnummers. */

const OUT=1, DARK=2, MID=3, LITE=4, TRIM=5, STD=6, ST=7, STL=8, CYD=9, CY=10, CYL=11, WIT=12;

const GEDEELD = {1:'#080c14',6:'#1d2433',7:'#4b5670',8:'#98a4be',9:'#0b5f70',10:'#22dbe6',11:'#bafcff',12:'#eaf3ff'};

const RUNNER = { naam:'Runner', b:46, h:54,
  dark:'#123a72', mid:'#2f74d8', lite:'#7cc2ff', trim:'#bafcff',
  cx:16, beenL:17, lijfH:13, lijfB:13, borstB:15, kopB:17, kopH:15,
  beenD:5, armD:4, stap:8, til:7, schouders:false, vin:true, loopL:12, loopH:6 };

const GUNNER = { naam:'Gunner', b:50, h:54,
  dark:'#5e1220', mid:'#b8262f', lite:'#ec5c3c', trim:'#ff902e',
  cx:19, beenL:16, lijfH:15, lijfB:16, borstB:22, kopB:20, kopH:17,
  beenD:7, armD:5, stap:7, til:6, schouders:true, vin:false, loopL:15, loopH:11 };

function palet(C){ const p=Object.assign({},GEDEELD); p[2]=C.dark;p[3]=C.mid;p[4]=C.lite;p[5]=C.trim; return p; }

function nieuw(b,h){ return {b,h,d:new Uint8Array(b*h)}; }
function zet(r,x,y,c){ x=Math.round(x);y=Math.round(y); if(x<0||y<0||x>=r.b||y>=r.h)return; r.d[y*r.b+x]=c; }
function blok(r,x,y,b,h,c){ for(let j=0;j<h;j++)for(let i=0;i<b;i++)zet(r,x+i,y+j,c); }
function rondBlok(r,x,y,b,h,k,c){
  for(let j=0;j<h;j++)for(let i=0;i<b;i++){
    const dx=Math.min(i,b-1-i), dy=Math.min(j,h-1-j);
    if(dx<k&&dy<k){ const a=k-dx, o=k-dy; if(a*a+o*o>k*k+1) continue; }
    zet(r,x+i,y+j,c);
  }
}
function ovaal(r,cx,cy,rx,ry,c){
  for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)
    for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
      const a=(x-cx)/rx,o=(y-cy)/ry; if(a*a+o*o<=1.06) zet(r,x,y,c);
    }
}
function dikLijn(r,x0,y0,x1,y1,d,c){
  const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1), h=Math.floor(d/2);
  for(let i=0;i<=n;i++){
    const x=x0+(x1-x0)*i/n, y=y0+(y1-y0)*i/n;
    blok(r,Math.round(x)-h,Math.round(y)-h,d,d,c);
  }
}
function omtrek(r){
  const k=r.d.slice();
  const v=(x,y)=>(x<0||y<0||x>=r.b||y>=r.h)?0:k[y*r.b+x];
  for(let y=0;y<r.h;y++)for(let x=0;x<r.b;x++){
    if(v(x,y))continue;
    if(v(x-1,y)||v(x+1,y)||v(x,y-1)||v(x,y+1)) zet(r,x,y,OUT);
  }
}

function been(r,C,hx,hy,fase,achter){
  const grond=r.h-2;
  const fx=hx+C.stap*Math.cos(fase);
  const fy=grond-Math.max(0,-Math.sin(fase))*C.til;
  const kx=(hx+fx)/2+1, ky=(hy+fy)/2;
  const kl=achter?DARK:MID;
  dikLijn(r,hx,hy,kx,ky,C.beenD,kl);
  dikLijn(r,kx,ky,fx,fy-3,C.beenD-1,kl);
  const bx0=fx-Math.floor(C.beenD/2)-1;
  blok(r,bx0,fy-3,C.beenD+3,4,achter?STD:ST);
  blok(r,bx0+C.beenD+1,fy-2,2,3,achter?STD:ST);
  if(!achter) blok(r,bx0,fy-3,C.beenD+3,1,STL);
}

function beenNaar(r,C,hx,hy,fx,fy,kx,ky,achter){
  const kl=achter?DARK:MID;
  dikLijn(r,hx,hy,kx,ky,C.beenD,kl);
  dikLijn(r,kx,ky,fx,fy-2,C.beenD-1,kl);
  const bx0=fx-Math.floor(C.beenD/2)-1;
  blok(r,bx0,fy-3,C.beenD+3,4,achter?STD:ST);
  blok(r,bx0+C.beenD+1,fy-2,2,3,achter?STD:ST);
  if(!achter) blok(r,bx0,fy-3,C.beenD+3,1,STL);
}

function arm(r,C,sx,sy,fase,achter){
  const hx=sx+C.stap*1.0*Math.cos(fase);
  const hy=sy+10-Math.abs(Math.sin(fase))*3;
  const ex=(sx+hx)/2+1, ey=(sy+hy)/2;
  const kl=achter?DARK:MID;
  dikLijn(r,sx,sy,ex,ey,C.armD,kl);
  dikLijn(r,ex,ey,hx,hy,C.armD-1,kl);
  blok(r,hx-2,hy-1,4,4,achter?STD:ST);
  if(!achter) blok(r,hx-2,hy-1,4,1,STL);
}


function armKanon(r,C,sx,sy,fase){
  const wip = Math.sin(fase*2)>0 ? -1 : 0;
  const ey = sy + 4 + wip, ex = sx + 5;
  const L = C.loopL, H = C.loopH, h = Math.floor(H/2);
  dikLijn(r,sx,sy+wip,ex,ey,C.armD+1,MID);            // bovenarm
  ovaal(r,sx,sy+wip,C.armD*0.7+1,C.armD*0.7+1,LITE);  // schoudergewricht
  blok(r,ex-2,ey-h-1,6,H+2,DARK);                     // elleboogstuk
  blok(r,ex-1,ey-h,4,2,MID);
  blok(r,ex+4,ey-h,L,H,MID);                          // de loop zelf
  blok(r,ex+5,ey-h,L-2,1,LITE);
  blok(r,ex+5,ey-h+3,L-2,2,TRIM);                     // ring
  blok(r,ex+4,ey+h-2,L,2,DARK);
  blok(r,ex+L+2,ey-h-1,3,H+2,STD);                    // mond
  ovaal(r,ex+L+3,ey,2,h-1,CYD);
  ovaal(r,ex+L+3,ey,1,h-2,CY);
}

function kop(r,C,cx,top){
  const x=cx-Math.floor(C.kopB/2);
  rondBlok(r,x,top,C.kopB,C.kopH,5,MID);
  blok(r,x+3,top+1,C.kopB-7,2,LITE);                 // glans bovenop
  if(C.vin){ blok(r,cx-2,top-5,4,7,LITE); blok(r,cx-1,top-6,2,4,TRIM); }
  else { blok(r,x+2,top+3,C.kopB-4,2,TRIM); blok(r,x-1,top+6,3,5,STD); blok(r,x+C.kopB-2,top+6,3,5,STD); }
  const vy=top+Math.floor(C.kopH*0.55);
  const rx=Math.floor(C.kopB/2)-2, ry=Math.floor(C.kopH/2)-2, vx=cx+1;
  ovaal(r,vx,vy,rx,ry,STD);
  ovaal(r,vx,vy,rx-1,ry-1,CYD);
  ovaal(r,vx,vy,rx-2,ry-2,CY);
  blok(r,vx-2,vy-2,3,2,CYL);
  blok(r,vx+2,vy+1,1,1,WIT);
}

function beeldje(C,nr,aantal,houding){
  houding=houding||'loop';
  const r=nieuw(C.b,C.h);
  const f=(nr/aantal)*Math.PI*2;
  const grond=r.h-2, cx=C.cx;
  const wip=houding==='loop'?(Math.sin(f*2)>0?-1:0):(houding==='sprong'?-2:0);
  const zak=houding==='glij'?Math.round(C.beenL*0.7):0;       // heupen omlaag bij glijden
  const lijfH=houding==='glij'?Math.round(C.lijfH*0.7):C.lijfH;
  const hy=grond-C.beenL+zak;
  const lijfOnder=hy+wip, lijfTop=lijfOnder-lijfH;
  const borstH=Math.round(lijfH*0.62);
  const schY=lijfTop+4;
  const kopOnder=lijfTop-1, kopTop=kopOnder-C.kopH;

  if(houding==='sprong') beenNaar(r,C,cx-3,lijfOnder,cx-9,lijfOnder+C.beenL-3,cx-8,lijfOnder+7,true);
  else if(houding==='glij') beenNaar(r,C,cx-3,lijfOnder,cx-9,grond,cx+1,grond-3,true);
  else been(r,C,cx-3,lijfOnder,f+Math.PI,true);
  arm(r,C,cx-Math.floor(C.borstB/2)+2,schY+1,f,true);

  const bx=cx-Math.floor(C.borstB/2);
  rondBlok(r,bx,lijfTop,C.borstB,borstH,3,MID);                       // borst
  blok(r,bx+3,lijfTop+1,C.borstB-9,2,LITE);
  blok(r,bx+2,lijfTop+borstH-3,C.borstB-4,2,TRIM);
  const wx=cx-Math.floor(C.lijfB/2);
  rondBlok(r,wx,lijfTop+borstH-1,C.lijfB,lijfH-borstH+2,2,MID);      // heup
  blok(r,wx+1,lijfOnder-3,C.lijfB-2,3,STD);

  if(C.schouders){
    ovaal(r,bx+1,schY,6,6,LITE); ovaal(r,bx+C.borstB-2,schY,6,6,LITE);
    ovaal(r,bx+1,schY+1,4,4,MID); ovaal(r,bx+C.borstB-2,schY+1,4,4,MID);
  }
  blok(r,cx-2,kopOnder-1,5,3,STD);                                    // nek

  kop(r,C,cx+(houding==='glij'?2:0),kopTop);

  armKanon(r,C,cx+Math.floor(C.borstB/2)-4,schY+4,f);

  if(houding==='sprong') beenNaar(r,C,cx+2,lijfOnder,cx+8,lijfOnder+C.beenL-6,cx+9,lijfOnder+4,false);
  else if(houding==='glij') beenNaar(r,C,cx+2,lijfOnder,cx+15,grond,cx+9,grond-2,false);
  else been(r,C,cx+2,lijfOnder,f,false);
  omtrek(r);
  return r;
}

function reeks(C,aantal){ const u=[]; for(let i=0;i<aantal;i++)u.push(beeldje(C,i,aantal)); return u; }



return { RUNNER:RUNNER, GUNNER:GUNNER, palet:palet, beeldje:beeldje };
})();

/* ---------- de acht gebieden ---------- */
/* Alles wordt getekend op dubbele scherpte: een tegel is 32x32 beeldpunten
   en verschijnt als 16x16 in de wereld. Achtergronden zijn 512 breed en
   herhalen zich; ze liggen in twee lagen die langzamer meeschuiven dan de baan. */

var BIOOM_LENGTE = 16;               // stukken baan per gebied
var LAAG_B = 512, LAAG_H = 360;      // maat van een achtergrondlaag, dubbele scherpte

var BIOMEN = [
  { id:'stad', naam:'NEON STAD', donker:false,
    lucht:['#07051a','#1d0b3c','#4a1250','#8a2a62'], neon:'#ff3d9a', neon2:'#22e6ff',
    grond:{ boven:'#4b5184', vlak:'#262a4a', donker:'#141630', lijn:'#22e6ff' },
    blok:{ rand:'#0c0e22', vlak:'#4a507c', licht:'#7c83b8', schaduw:'#2c3058', accent:'#ff3d9a', motief:'band' },
    vloei:['#22e6ff','#0e7c9a'], maan:null, sterren:true },
  { id:'jungle', naam:'NEON JUNGLE', donker:false,
    lucht:['#020d0f','#062a26','#0c4a38','#1e6a48'], neon:'#7dff5a', neon2:'#ffe14a',
    grond:{ boven:'#2a8a4e', vlak:'#1c2c24', donker:'#0e1812', lijn:'#9dff6a' },
    blok:{ rand:'#1a0f08', vlak:'#7a4a28', licht:'#a8703e', schaduw:'#4e2c16', accent:'#7dff5a', motief:'kruis' },
    vloei:['#9dff3a','#3a8a1a'], maan:{x:0.78,y:46,r:26,kleur:'#e8ffd8'}, sterren:true },
  { id:'riool', naam:'NEON RIOOL', donker:true,
    lucht:['#020409','#060d18','#0a1626','#0e1e32'], neon:'#3dff9a', neon2:'#2a8aff',
    grond:{ boven:'#3e5062', vlak:'#1c2632', donker:'#0e141c', lijn:'#3dff9a' },
    blok:{ rand:'#140a04', vlak:'#7c4a2c', licht:'#a86a3e', schaduw:'#4a2a16', accent:'#3dff9a', motief:'streep' },
    vloei:['#5aff4a','#1e6a2a'], maan:null, sterren:false },
  { id:'woestijn', naam:'NEON WOESTIJN', donker:false,
    lucht:['#0c0626','#2a1052','#6a2a6a','#d8663e'], neon:'#ff8a2a', neon2:'#ff3d9a',
    grond:{ boven:'#b06a4a', vlak:'#5a3236', donker:'#2e1a22', lijn:'#ffa24a' },
    blok:{ rand:'#1e0e0a', vlak:'#b07446', licht:'#d89a62', schaduw:'#7a4a2a', accent:'#ff8a2a', motief:'lijn' },
    vloei:['#3a1a2a','#1a0a14'], maan:{x:0.7,y:40,r:30,kleur:'#ffe8c8'}, sterren:true },
  { id:'tempel', naam:'NEON TEMPEL', donker:true,
    lucht:['#05080a','#0c1614','#16241e','#223328'], neon:'#ffd24a', neon2:'#5affd2',
    grond:{ boven:'#6a7458', vlak:'#2e3530', donker:'#161c18', lijn:'#ffd24a' },
    blok:{ rand:'#0e120e', vlak:'#6e7660', licht:'#98a084', schaduw:'#44493a', accent:'#ffd24a', motief:'glyph' },
    vloei:['#ffd24a','#6a4a0a'], maan:null, sterren:false },
  { id:'server', naam:'SERVERHAL', donker:false,
    lucht:['#0a0816','#1a1630','#2c2448','#40305e'], neon:'#c46aff', neon2:'#3dffcf',
    grond:{ boven:'#5c6284', vlak:'#2a2d44', donker:'#15172a', lijn:'#c46aff' },
    blok:{ rand:'#08080f', vlak:'#262a3c', licht:'#3c4260', schaduw:'#181a28', accent:'#3dffcf', motief:'leds' },
    vloei:['#c46aff','#3a1a5a'], maan:null, sterren:false },
  { id:'ijs', naam:'IJSGROT', donker:true,
    lucht:['#020612','#061430','#0c2450','#12366e'], neon:'#7af0ff', neon2:'#ffffff',
    grond:{ boven:'#a8e6ff', vlak:'#2c6aa0', donker:'#123a62', lijn:'#ffffff' },
    blok:{ rand:'#0a2448', vlak:'#7ecbf0', licht:'#d8f6ff', schaduw:'#3e8ac0', accent:'#ffffff', motief:'ijs' },
    vloei:['#7af0ff','#1a5a9a'], maan:null, sterren:false },
  { id:'magma', naam:'MAGMAFABRIEK', donker:false,
    lucht:['#070202','#200606','#4a0e06','#9a2a08'], neon:'#ff6a1a', neon2:'#ffd23a',
    grond:{ boven:'#4a3434', vlak:'#221616', donker:'#120a0a', lijn:'#ff6a1a' },
    blok:{ rand:'#0a0606', vlak:'#3a3232', licht:'#5a4e4e', schaduw:'#221c1c', accent:'#ff7a1a', motief:'kern' },
    vloei:['#ffb01a','#d83a0a'], maan:null, sterren:false }
];

/* volgorde: stad eerst, dan geschud uit de seed; nooit twee donkere naast elkaar */
function maakVolgorde(seed){
  var r = rng(seed ^ 0x5bd1e995), lijst = [];
  function schud(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function donker(i){ return BIOMEN[i].donker; }
  function cyclus(){
    var rij = lijst.length===0 ? [0].concat(schud([1,2,3,4,5,6,7])) : schud([0,1,2,3,4,5,6,7]);
    var vorige = lijst.length ? lijst[lijst.length-1] : -1;
    if (rij[0] === vorige) { var t0=rij[0]; rij[0]=rij[1]; rij[1]=t0; }
    for (var p=0;p<rij.length;p++){
      var ervoor = p===0 ? vorige : rij[p-1];
      if (ervoor>=0 && donker(ervoor) && donker(rij[p])) {
        for (var q=p+1;q<rij.length;q++) if(!donker(rij[q])){ var t=rij[p]; rij[p]=rij[q]; rij[q]=t; break; }
      }
    }
    lijst = lijst.concat(rij);
  }
  return function(n){ while(lijst.length<=n) cyclus(); return lijst[n]; };
}

/* ---------- teken-hulp op een canvas ---------- */
function vlak(g,k,x,y,b,h){ g.fillStyle=k; g.fillRect(x|0,y|0,b|0,h|0); }
function gloed(g,k,x,y,b,h,d){
  g.globalAlpha=0.10; vlak(g,k,x-d*2,y-d*2,b+d*4,h+d*4);
  g.globalAlpha=0.18; vlak(g,k,x-d,y-d,b+d*2,h+d*2);
  g.globalAlpha=1;
}
function neonBord(g,k,x,y,b,h){
  gloed(g,k,x,y,b,h,3);
  vlak(g,'#07050f',x,y,b,h);
  vlak(g,k,x,y,b,2); vlak(g,k,x,y+h-2,b,2); vlak(g,k,x,y,2,h); vlak(g,k,x+b-2,y,2,h);
  for (var i=6;i<b-6;i+=6) vlak(g,k,x+i,y+Math.floor(h/2)-1,3,2);
}
function nieuwDoek(scene,key,b,h){
  if (scene.textures.exists(key)) scene.textures.remove(key);
  var t = scene.textures.createCanvas(key,b,h);
  return { t:t, g:t.getContext() };
}

/* ---------- lucht: verloop met rasterovergangen, sterren, maan ---------- */
function tekenLucht(scene,B){
  var LB = 320, d = nieuwDoek(scene,'lucht_'+B.id,LB,LAAG_H), g = d.g, k = B.lucht, band = LAAG_H/4;
  for (var i=0;i<4;i++) vlak(g,k[i],0,Math.round(i*band),LB,Math.ceil(band)+1);
  for (var j=1;j<4;j++){                      // gerasterde overgang tussen de banden
    var y0 = Math.round(j*band);
    for (var x=0;x<LB;x+=2){ vlak(g,k[j-1],x+(j%2),y0,1,1); vlak(g,k[j-1],x,y0+2,1,1); if(x%4===0) vlak(g,k[j-1],x+1,y0+4,1,1); }
  }
  if (B.sterren){
    var r = rng(77);
    for (var s=0;s<70;s++){ var sx=Math.floor(r()*LB), sy=Math.floor(r()*LAAG_H*0.5);
      g.globalAlpha = 0.4+r()*0.6; vlak(g,'#ffffff',sx,sy,r()<0.15?2:1,r()<0.15?2:1); }
    g.globalAlpha = 1;
  }
  d.t.refresh();
  if (B.maan){
    var m = nieuwDoek(scene,'maan_'+B.id,B.maan.r*2+16,B.maan.r*2+16), mg=m.g, c=B.maan.r+8, rr=B.maan.r;
    mg.globalAlpha=0.12; mg.fillStyle=B.maan.kleur; mg.beginPath(); mg.arc(c,c,rr+7,0,7); mg.fill();
    mg.globalAlpha=1;
    for (var yy=-rr;yy<=rr;yy++){ var w=Math.floor(Math.sqrt(rr*rr-yy*yy)); vlak(mg,B.maan.kleur,c-w,c+yy,w*2,1); }
    mg.globalAlpha=0.18; vlak(mg,'#000000',c-rr*0.3,c-rr*0.4,rr*0.35,rr*0.3); vlak(mg,'#000000',c+rr*0.2,c+rr*0.2,rr*0.25,rr*0.2);
    mg.globalAlpha=1; m.t.refresh();
  }
}

/* ---------- achtergrondlagen per gebied ---------- */
function tekenLagen(scene,B){
  var ver = nieuwDoek(scene,'ver_'+B.id,LAAG_B,LAAG_H), dicht = nieuwDoek(scene,'dicht_'+B.id,LAAG_B,LAAG_H);
  var r = rng(B.id.length*9173+B.id.charCodeAt(0));
  var tek = LAGEN[B.id]; tek(ver.g,dicht.g,r,B);
  ver.t.refresh(); dicht.t.refresh();
}

var GROND_Y = 288;   // bovenkant van de grond op dubbele scherpte

var LAGEN = {
  stad: function(v,d,r,B){
    for (var x=0;x<LAAG_B;){ var b=24+Math.floor(r()*40), h=90+Math.floor(r()*120);
      vlak(v,'#1a0f36',x,GROND_Y-h,b,h+72);
      if (r()<0.5) vlak(v,'#1a0f36',x+Math.floor(b/2)-1,GROND_Y-h-14,2,14);
      for (var wy=GROND_Y-h+8;wy<GROND_Y-6;wy+=10) for (var wx=x+4;wx<x+b-4;wx+=7)
        if (r()<0.3) vlak(v,r()<0.5?'#ff3d9a':'#22e6ff',wx,wy,3,4);
      x+=b+2+Math.floor(r()*6); }
    for (var x2=0;x2<LAAG_B;){ var b2=40+Math.floor(r()*60), h2=60+Math.floor(r()*90);
      vlak(d,'#0c0720',x2,GROND_Y-h2,b2,h2+72);
      vlak(d,'#1c1238',x2,GROND_Y-h2,b2,3);
      if (r()<0.75){ var kk=[B.neon,B.neon2,'#ffe14a'][Math.floor(r()*3)], sb=Math.min(b2-10,20+Math.floor(r()*26));
        neonBord(d,kk,x2+5,GROND_Y-h2+12+Math.floor(r()*20),sb,12); }
      for (var wy2=GROND_Y-h2+44;wy2<GROND_Y-10;wy2+=14) for (var wx2=x2+6;wx2<x2+b2-6;wx2+=10)
        if (r()<0.2) vlak(d,'#ffd27a',wx2,wy2,4,5);
      x2+=b2+6+Math.floor(r()*20); }
  },
  jungle: function(v,d,r,B){
    for (var x=-20;x<LAAG_B+20;x+=18+Math.floor(r()*14)){ var h=120+Math.floor(r()*80), w=30+Math.floor(r()*30);
      for (var yy=0;yy<w;yy++){ var ww=Math.floor(Math.sqrt(w*w-yy*yy)); vlak(v,'#0a2a22',x-ww,GROND_Y-h+yy,ww*2,1); }
      vlak(v,'#0a2a22',x-w,GROND_Y-h+w,w*2,h); }
    for (var f=0;f<30;f++){ var fx=Math.floor(r()*LAAG_B), fy=60+Math.floor(r()*200); gloed(v,B.neon2,fx,fy,2,2,2); vlak(v,B.neon2,fx,fy,2,2); }
    for (var s=0;s<7;s++){ var sx=Math.floor(r()*LAAG_B), sw=10+Math.floor(r()*8);
      vlak(d,'#051410',sx,0,sw,GROND_Y+72);
      for (var k=0;k<5;k++){ var ly=40+Math.floor(r()*220), lw=26+Math.floor(r()*20), naar=r()<0.5?-1:1;
        for (var q=0;q<10;q++) vlak(d,'#0c3a24',naar>0?sx+sw:sx-lw+q*2,ly+q,lw-q*2,1);
        if (r()<0.6){ gloed(d,B.neon,sx+(naar>0?sw+6:-10),ly+4,3,3,2); vlak(d,B.neon,sx+(naar>0?sw+6:-10),ly+4,3,3); } } }
    for (var l=0;l<12;l++){ var lx=Math.floor(r()*LAAG_B), ll=40+Math.floor(r()*120);
      for (var yy2=0;yy2<ll;yy2+=2) vlak(d,'#1e5a2a',lx+Math.round(Math.sin(yy2/14)*3),yy2,2,2);
      gloed(d,B.neon,lx,ll,3,3,2); vlak(d,B.neon,lx,ll,3,3); }
  },
  riool: function(v,d,r,B){
    vlak(v,'#0a1422',0,40,LAAG_B,GROND_Y);
    for (var by=44;by<GROND_Y;by+=10) for (var bx=((by/10)%2)*14;bx<LAAG_B;bx+=28) vlak(v,'#0e1a2c',bx,by,26,8);
    for (var a=0;a<LAAG_B;a+=128){ for (var yy=0;yy<60;yy++){ var ww=Math.floor(Math.sqrt(60*60-yy*yy)*0.75);
        vlak(v,'#030609',a+64-ww,GROND_Y-100+yy+60-60,ww*2,1); }
      vlak(v,'#030609',a+19,GROND_Y-100+60,90,40); }
    vlak(d,'#1a2a38',0,120,LAAG_B,18); vlak(d,'#2a3e50',0,120,LAAG_B,3); vlak(d,'#0c141c',0,135,LAAG_B,3);
    for (var rv=10;rv<LAAG_B;rv+=40) vlak(d,'#3e5468',rv,126,4,4);
    for (var p=0;p<4;p++){ var px2=40+p*128+Math.floor(r()*30);
      vlak(d,'#162230',px2,138,14,GROND_Y-138); vlak(d,'#243646',px2,138,3,GROND_Y-138);
      gloed(d,B.neon,px2-2,160,18,8,3); vlak(d,B.neon,px2,162,14,4); }
    for (var dr=0;dr<14;dr++){ var dx=Math.floor(r()*LAAG_B); vlak(d,'#2a8aff',dx,139,2,3+Math.floor(r()*6)); }
  },
  woestijn: function(v,d,r,B){
    function duin(g,kleur,basis,amp,golf,fase){ for (var x=0;x<LAAG_B;x++){ var h=basis+Math.round(Math.sin(x/golf*Math.PI*2+fase)*amp+Math.sin(x/(golf*0.37)*Math.PI*2)*amp*0.3);
        vlak(g,kleur,x,GROND_Y-h,1,h+72); } }
    duin(v,'#3a1a4a',110,24,LAAG_B/2,0.4); duin(v,'#2a1238',70,18,LAAG_B/3,1.7);
    for (var c=0;c<5;c++){ var cx=30+c*100+Math.floor(r()*40), ch=40+Math.floor(r()*40);
      if (r()<0.5){ vlak(d,'#1a0c1e',cx,GROND_Y-ch,10,ch+2); vlak(d,'#1a0c1e',cx-10,GROND_Y-ch+16,10,6); vlak(d,'#1a0c1e',cx-10,GROND_Y-ch+6,6,14);
        vlak(d,'#1a0c1e',cx+10,GROND_Y-ch+24,10,6); vlak(d,'#1a0c1e',cx+14,GROND_Y-ch+12,6,16); }
      else { var mb=60+Math.floor(r()*50); vlak(d,'#221024',cx-20,GROND_Y-ch,mb,ch+2); vlak(d,'#2e1630',cx-20,GROND_Y-ch,mb,3); } }
    for (var s=0;s<LAAG_B;s+=32){ gloed(d,B.neon,s,GROND_Y-4,16,2,2); vlak(d,B.neon,s,GROND_Y-4,16,2); }
  },
  tempel: function(v,d,r,B){
    var mid=LAAG_B/2;
    for (var t=0;t<7;t++){ var w=200-t*26; vlak(v,'#141f1a',mid-w/2,GROND_Y-30-t*24,w,26); }
    vlak(v,'#141f1a',mid-14,GROND_Y-30-7*24-20,28,20);
    gloed(v,B.neon,mid-4,GROND_Y-30-7*24-12,8,6,3); vlak(v,B.neon,mid-4,GROND_Y-30-7*24-12,8,6);
    for (var c=0;c<6;c++){ var cx=20+c*88+Math.floor(r()*20), ch=80+Math.floor(r()*100);
      vlak(d,'#1c2620',cx,GROND_Y-ch,22,ch+2); vlak(d,'#2a3830',cx-4,GROND_Y-ch,30,8); vlak(d,'#2a3830',cx,GROND_Y-ch+8,3,ch-8);
      if (r()<0.4) vlak(d,'#0a0f0c',cx,GROND_Y-ch-10+Math.floor(r()*4),22,10);
      for (var gy=GROND_Y-ch+20;gy<GROND_Y-14;gy+=16) if (r()<0.55){ gloed(d,B.neon,cx+7,gy,8,8,2); vlak(d,B.neon,cx+7,gy,8,2); vlak(d,B.neon,cx+10,gy+2,2,6); } }
    d.globalAlpha=0.16; for (var m=0;m<3;m++) vlak(d,'#9ad0b8',0,GROND_Y-30+m*8,LAAG_B,6); d.globalAlpha=1;
  },
  server: function(v,d,r,B){
    for (var x=0;x<LAAG_B;x+=34){ vlak(v,'#161428',x,70,30,GROND_Y-70); vlak(v,'#221e3a',x,70,30,3);
      for (var y=80;y<GROND_Y-6;y+=8){ vlak(v,'#0e0c1c',x+3,y,24,6);
        if (r()<0.5) vlak(v,[B.neon,B.neon2,'#ff3d9a'][Math.floor(r()*3)],x+5+Math.floor(r()*18),y+2,2,2); } }
    for (var x2=0;x2<LAAG_B;x2+=86){ vlak(d,'#0a0914',x2,40,54,GROND_Y-40); vlak(d,'#1c1830',x2,40,54,4); vlak(d,'#1c1830',x2,40,3,GROND_Y-40);
      for (var y2=54;y2<GROND_Y-8;y2+=14){ vlak(d,'#141226',x2+6,y2,42,10);
        for (var l=0;l<5;l++) if (r()<0.6){ var kk=[B.neon,B.neon2][Math.floor(r()*2)]; gloed(d,kk,x2+10+l*7,y2+4,3,2,1); vlak(d,kk,x2+10+l*7,y2+4,3,2); } } }
    for (var k=0;k<LAAG_B;k+=86){ for (var t=0;t<32;t++) vlak(d,'#2a1e48',k+54+t,20+Math.round(Math.sin(t/32*Math.PI)*22),2,3); }
  },
  ijs: function(v,d,r,B){
    vlak(v,'#081a3a',0,0,LAAG_B,24);
    for (var x=0;x<LAAG_B;x+=10+Math.floor(r()*14)){ var l=20+Math.floor(r()*90), w=6+Math.floor(r()*10);
      for (var y=0;y<l;y++){ var ww=Math.max(1,Math.round(w*(1-y/l))); vlak(v,'#0e2c5a',x-ww/2,24+y,ww,1); } }
    for (var h=0;h<LAAG_B;h+=60){ var hh=60+Math.floor(r()*60); for (var y2=0;y2<hh;y2++) vlak(v,'#0c2448',h+y2*0.3,GROND_Y-hh+y2,50-y2*0.2,1); }
    for (var c=0;c<9;c++){ var cx=Math.floor(r()*LAAG_B), ch=24+Math.floor(r()*50), cw=8+Math.floor(r()*8);
      gloed(d,B.neon,cx-cw/2,GROND_Y-ch,cw,ch,3);
      for (var y3=0;y3<ch;y3++){ var w3=Math.max(1,Math.round(cw*(y3/ch))); vlak(d,y3<3?'#ffffff':'#7ad8ff',cx-w3/2,GROND_Y-ch+y3,w3,1); }
      vlak(d,'#ffffff',cx-1,GROND_Y-ch+4,1,ch*0.5); }
    for (var s=0;s<20;s++){ var sx=Math.floor(r()*LAAG_B), sy=24+Math.floor(r()*160); vlak(d,'#bff4ff',sx,sy,1,1); }
  },
  magma: function(v,d,r,B){
    for (var x=0;x<LAAG_B;){ var b=40+Math.floor(r()*60), h=70+Math.floor(r()*80);
      vlak(v,'#1a0806',x,GROND_Y-h,b,h+72);
      if (r()<0.6){ var sx=x+Math.floor(r()*(b-12)), sh=30+Math.floor(r()*40); vlak(v,'#1a0806',sx,GROND_Y-h-sh,12,sh);
        v.globalAlpha=0.25; for (var rk=0;rk<4;rk++) vlak(v,'#6a4a44',sx-4+rk*3,GROND_Y-h-sh-10-rk*10,14+rk*4,8); v.globalAlpha=1; }
      for (var wy=GROND_Y-h+10;wy<GROND_Y-8;wy+=14) for (var wx=x+6;wx<x+b-6;wx+=12) if (r()<0.3) vlak(v,'#ff6a1a',wx,wy,5,4);
      x+=b+4+Math.floor(r()*14); }
    vlak(d,'#221412',0,100,LAAG_B,14); vlak(d,'#3a2420',0,100,LAAG_B,3);
    for (var p=0;p<3;p++){ var px2=60+p*170+Math.floor(r()*40);
      vlak(d,'#2a1a18',px2-10,90,34,20);
      gloed(d,B.neon2,px2,114,10,GROND_Y-114,4); vlak(d,B.neon,px2,114,10,GROND_Y-114); vlak(d,B.neon2,px2+3,114,3,GROND_Y-114);
      gloed(d,B.neon,px2-16,GROND_Y-8,42,8,4); }
    for (var s=0;s<30;s++){ vlak(d,r()<0.5?B.neon2:B.neon,Math.floor(r()*LAAG_B),120+Math.floor(r()*160),2,2); }
  }
};

/* dunne rand in een kleur rond alles wat getekend is, zodat het loskomt van de achtergrond */
function neonRand(g,b,h,kleur){
  var id=g.getImageData(0,0,b,h), d=id.data, k=int(kleur), vol=function(x,y){ return x>=0&&y>=0&&x<b&&y<h&&d[(y*b+x)*4+3]>200; };
  var rand=[];
  for (var y=0;y<h;y++) for (var x=0;x<b;x++){ if (vol(x,y)) continue; if (vol(x-1,y)||vol(x+1,y)||vol(x,y-1)||vol(x,y+1)) rand.push(x,y); }
  for (var i=0;i<rand.length;i+=2){ var o=(rand[i+1]*b+rand[i])*4; d[o]=(k>>16)&255; d[o+1]=(k>>8)&255; d[o+2]=k&255; d[o+3]=170; }
  g.putImageData(id,0,0);
}

/* ---------- vijanden: loper over de grond, zwevende drone ---------- */
function tekenVijanden(scene,B){
  var oog=B.neon, schaal=B.id==='magma'?'#b04aff':'#ff3a4a', licht=B.id==='magma'?'#e0a0ff':'#ff9a8a', donker=B.id==='magma'?'#5a1a8a':'#8a1020';
  var Z='#07060e';
  for (var f=0;f<2;f++){
    /* loper: rood schild, vizier met oog, pootjes die wisselen */
    var a=nieuwDoek(scene,'loper_'+B.id+'_'+f,36,32), g=a.g, p=f?3:0;
    vlak(g,Z,8,2,20,4); vlak(g,Z,4,5,28,16); vlak(g,Z,2,9,32,10);
    vlak(g,schaal,8,4,20,3); vlak(g,schaal,6,7,24,12); vlak(g,schaal,4,10,28,7);
    vlak(g,licht,9,5,10,2); vlak(g,licht,7,8,4,3);
    vlak(g,donker,6,16,24,3); vlak(g,donker,26,9,4,8);
    vlak(g,Z,5,11,16,6); gloed(g,oog,7,12,8,4,2); vlak(g,oog,7,12,8,4); vlak(g,'#ffffff',8,12,3,2);
    vlak(g,Z,16,0,4,3); vlak(g,oog,17,0,2,2);
    vlak(g,Z,6+p,19,7,11); vlak(g,Z,23-p,19,7,11);
    vlak(g,'#9aa0c0',8+p,20,3,7); vlak(g,'#9aa0c0',25-p,20,3,7);
    vlak(g,Z,4+p,28,10,4); vlak(g,Z,21-p,28,10,4); vlak(g,'#5a6078',5+p,29,8,2); vlak(g,'#5a6078',22-p,29,8,2);
    a.t.refresh();
    /* vlieger: ronde koepel, schroef bovenop, gloed eronder */
    var b=nieuwDoek(scene,'vlieger_'+B.id+'_'+f,36,30), h=b.g;
    vlak(h,Z,10,5,16,3); vlak(h,Z,6,7,24,14); vlak(h,Z,4,10,28,8);
    vlak(h,schaal,10,7,16,3); vlak(h,schaal,8,9,20,10); vlak(h,schaal,6,11,24,6);
    vlak(h,licht,11,8,8,2); vlak(h,licht,9,11,3,3); vlak(h,donker,8,16,20,3);
    vlak(h,Z,11,11,14,6); gloed(h,oog,13,12,10,4,2); vlak(h,oog,13,12,10,4); vlak(h,'#ffffff',14,12,3,2);
    vlak(h,Z,17,1,2,5);
    if (f===0){ vlak(h,Z,6,0,24,3); vlak(h,'#c8d0e8',7,1,22,1); } else { vlak(h,Z,12,0,12,3); vlak(h,'#c8d0e8',13,1,10,1); }
    vlak(h,Z,10,20,4,5); vlak(h,Z,22,20,4,5);
    gloed(h,oog,15,22,6,3,2); vlak(h,oog,15,22,6,3); vlak(h,'#ffffff',17,23,2,1);
    b.t.refresh();
  }
}

/* ---------- grond, blokken en vloeistof per gebied ---------- */
function tekenTegels(scene,B){
  var G = B.grond, K = B.blok, T = 32;
  var a = nieuwDoek(scene,'grondT_'+B.id,T,T), g = a.g;          // bovenste laag grond
  vlak(g,G.vlak,0,0,T,T); vlak(g,G.boven,0,0,T,8); vlak(g,G.donker,0,8,T,2);
  vlak(g,G.lijn,0,0,T,2);
  g.globalAlpha=0.35; vlak(g,G.lijn,0,2,T,2); g.globalAlpha=1;
  vlak(g,G.donker,0,18,T,2); vlak(g,G.donker,15,10,2,8); vlak(g,G.donker,6,20,2,12); vlak(g,G.donker,24,20,2,12);
  vlak(g,G.boven,2,4,6,2); vlak(g,G.boven,18,4,8,2);
  a.t.refresh();
  var b = nieuwDoek(scene,'grondB_'+B.id,T,T), h = b.g;          // onderste laag
  vlak(h,G.vlak,0,0,T,T); vlak(h,G.donker,0,0,T,2); vlak(h,G.donker,0,16,T,2);
  vlak(h,G.donker,9,2,2,14); vlak(h,G.donker,25,18,2,14);
  h.globalAlpha=0.5; vlak(h,G.donker,0,24,T,8); h.globalAlpha=1;
  b.t.refresh();
  ['blok_','blokStuk_'].forEach(function(p,stuk){
    var c = nieuwDoek(scene,p+B.id,T,T), k = c.g;
    vlak(k,K.rand,0,0,T,T); vlak(k,K.vlak,2,2,T-4,T-4); vlak(k,K.licht,2,2,T-4,3); vlak(k,K.licht,2,2,3,T-4);
    vlak(k,K.schaduw,2,T-5,T-4,3); vlak(k,K.schaduw,T-5,2,3,T-4);
    var m = K.motief, A = K.accent;
    if (m==='band'){ vlak(k,K.rand,8,12,16,8); vlak(k,A,9,14,14,4); }
    else if (m==='kruis'){ for (var i=0;i<18;i++){ vlak(k,K.schaduw,7+i,7+i,3,3); vlak(k,K.schaduw,22-i,7+i,3,3); } vlak(k,A,14,14,4,4); }
    else if (m==='streep'){ for (var s=0;s<4;s++) vlak(k,s%2?K.rand:A,5+s*6,12,6,8); }
    else if (m==='lijn'){ vlak(k,A,6,10,20,2); vlak(k,A,6,20,20,2); vlak(k,K.schaduw,6,12,20,8); }
    else if (m==='glyph'){ vlak(k,A,11,8,10,2); vlak(k,A,15,10,2,10); vlak(k,A,11,20,10,2); vlak(k,A,9,13,3,2); vlak(k,A,20,13,3,2); }
    else if (m==='leds'){ for (var l=0;l<4;l++) vlak(k,l===1?'#ff3d9a':A,7+l*5,8,3,2); vlak(k,K.rand,6,16,20,2); vlak(k,K.rand,6,21,20,2); }
    else if (m==='ijs'){ k.globalAlpha=0.5; vlak(k,'#ffffff',6,6,6,14); vlak(k,'#ffffff',14,6,3,6); k.globalAlpha=1; vlak(k,'#ffffff',5,5,3,3); }
    else if (m==='kern'){ vlak(k,K.rand,8,8,16,16); vlak(k,'#ff3a0a',10,10,12,12); vlak(k,A,12,12,8,8); vlak(k,'#ffe08a',14,14,4,4); }
    vlak(k,K.rand,4,4,2,2); vlak(k,K.rand,T-6,4,2,2); vlak(k,K.rand,4,T-6,2,2); vlak(k,K.rand,T-6,T-6,2,2);
    if (stuk){ vlak(k,K.rand,6,4,2,8); vlak(k,K.rand,8,11,2,4); vlak(k,K.rand,22,5,2,6); vlak(k,K.rand,20,18,2,8); vlak(k,K.rand,12,24,8,2); vlak(k,K.rand,18,22,2,2); }
    c.t.refresh();
  });
  var pl = nieuwDoek(scene,'plat_'+B.id,T,12), q = pl.g;       // zwevende richel
  vlak(q,K.rand,0,0,T,12); vlak(q,G.boven,1,1,T-2,8); vlak(q,G.lijn,1,1,T-2,2);
  q.globalAlpha=0.4; vlak(q,G.lijn,1,3,T-2,1); q.globalAlpha=1;
  vlak(q,G.donker,1,7,T-2,2); vlak(q,K.rand,6,9,4,3); vlak(q,K.rand,22,9,4,3);
  pl.t.refresh();
  tekenVijanden(scene,B);
  var v = nieuwDoek(scene,'vloei_'+B.id,T,T), w = v.g;           // vloeistof in een gat
  vlak(w,B.vloei[1],0,0,T,T); vlak(w,B.vloei[0],0,0,T,6);
  w.globalAlpha=0.5; vlak(w,'#ffffff',4,1,6,1); vlak(w,'#ffffff',20,2,5,1); vlak(w,B.vloei[0],0,10,T,3); w.globalAlpha=1;
  v.t.refresh();
}

/* ---------- geluid: alles in code, geen bestanden ---------- */
/* Geluidseffecten uit oscillatoren en ruis, en een zacht deuntje eronder met
   per gebied een andere grondtoon. Faalt stil als de browser niet mee wil. */
var GELUID = (function(){
  var ctx=null, meester=null, muziekBus=null, aan=true, ruisBuf=null;
  var loopt=false, klok=null, stap=0, volgende=0, grond=0;
  try { aan = localStorage.getItem('rg-geluid') !== 'uit'; } catch(e) {}

  function wek(){
    if (!aan) return;
    try {
      if (!ctx){
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ctx = new AC();
        meester = ctx.createGain(); meester.gain.value = 0.32; meester.connect(ctx.destination);
        muziekBus = ctx.createGain(); muziekBus.gain.value = 0.55; muziekBus.connect(meester);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch(e) {}
  }
  function klaar(){ return ctx && aan && ctx.state !== 'closed'; }

  function toon(f1,f2,duur,vorm,vol,wanneer,uit){
    if (!klaar()) return;
    try {
      var t = wanneer || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = vorm || 'square';
      o.frequency.setValueAtTime(f1, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20,f2), t+duur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol||0.2, t+0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t+duur);
      o.connect(g); g.connect(uit || meester); o.start(t); o.stop(t+duur+0.03);
    } catch(e) {}
  }
  function ruis(duur,vol,f1,f2){
    if (!klaar()) return;
    try {
      if (!ruisBuf){ ruisBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = ruisBuf.getChannelData(0); for (var i=0;i<d.length;i++) d[i] = Math.random()*2-1; }
      var t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = ruisBuf; f.type = 'lowpass';
      f.frequency.setValueAtTime(f1||2000, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t+duur);
      g.gain.setValueAtTime(vol||0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t+duur);
      s.connect(f); f.connect(g); g.connect(meester); s.start(t); s.stop(t+duur+0.03);
    } catch(e) {}
  }
  function noot(n){ return 110*Math.pow(2,(n+grond)/12); }

  var SFX = {
    spring:  function(){ toon(330,660,0.12,'square',0.12); },
    dubbel:  function(){ toon(520,1040,0.14,'square',0.11); toon(780,1560,0.1,'triangle',0.06); },
    schietR: function(){ toon(1400,500,0.08,'square',0.06); },
    schietG: function(){ toon(180,70,0.14,'sawtooth',0.12); ruis(0.08,0.12,1800,300); },
    munt:    function(){ var t=ctx.currentTime; toon(988,0,0.07,'square',0.08,t); toon(1319,0,0.16,'square',0.08,t+0.07); },
    dikke:   function(){ var t=ctx.currentTime; [784,988,1175,1568].forEach(function(f,i){ toon(f,0,0.1,'square',0.08,t+i*0.06); }); },
    tik:     function(){ ruis(0.05,0.14,3000,800); toon(220,160,0.05,'square',0.05); },
    kapot:   function(){ ruis(0.22,0.24,2400,200); toon(160,50,0.2,'square',0.1); },
    knal:    function(){ ruis(0.7,0.45,1800,60); toon(90,30,0.55,'sine',0.35); toon(60,25,0.7,'triangle',0.25); },
    raak:    function(){ toon(700,350,0.06,'square',0.07); },
    vijand:  function(){ ruis(0.18,0.2,2600,300); toon(600,80,0.25,'square',0.09); },
    pijn:    function(){ toon(420,90,0.35,'sawtooth',0.14); ruis(0.15,0.15,1200,200); },
    val:     function(){ toon(700,60,0.6,'triangle',0.14); },
    tel:     function(){ toon(440,0,0.12,'square',0.1); },
    go:      function(){ toon(880,0,0.3,'square',0.12); toon(1320,0,0.3,'triangle',0.06); },
    bioom:   function(){ var t=ctx.currentTime; [0,4,7,12,16].forEach(function(i,k){ toon(noot(i+12),0,0.14,'square',0.07,t+k*0.07); toon(noot(i+24),0,0.1,'triangle',0.04,t+k*0.07); }); },
    einde:   function(){ var t=ctx.currentTime; [7,4,0,-5].forEach(function(i,k){ toon(noot(i+12),0,0.28,'square',0.09,t+k*0.2); }); }
  };

  /* zacht deuntje: bas op de tellen, arpeggio in achtsten, vier maten rond */
  var BAS = [0,7,5,3], ARP = [0,7,12,15, 12,7,10,7];
  function plan(){
    if (!loopt || !klaar()) return;
    var achtste = 60/132/2;
    while (volgende < ctx.currentTime + 0.25){
      var i = stap % 8, maat = Math.floor(stap/8) % 4;
      if (i%4===0) toon(noot(BAS[maat] - 12), 0, achtste*3.6, 'triangle', 0.12, volgende, muziekBus);
      if (i%4===2) toon(noot(BAS[maat] - 12 + 12), 0, achtste*1.2, 'triangle', 0.06, volgende, muziekBus);
      toon(noot(ARP[i] + BAS[maat]), 0, achtste*0.8, 'square', 0.026, volgende, muziekBus);
      if (i===4) toon(4000, 0, 0.02, 'square', 0.012, volgende, muziekBus);
      volgende += achtste; stap++;
    }
  }

  return {
    wek: wek,
    speel: function(n){ try { if (SFX[n] && klaar()) SFX[n](); } catch(e) {} },
    grondtoon: function(semitoon){ grond = semitoon|0; },
    muziek: function(start){
      if (start){ if (loopt) return; wek(); if (!klaar()) return; loopt = true; volgende = ctx.currentTime + 0.05; stap = 0; klok = setInterval(plan, 60); }
      else { loopt = false; if (klok) clearInterval(klok); klok = null; }
    },
    staatAan: function(){ return aan; },
    zet: function(v){
      aan = !!v; try { localStorage.setItem('rg-geluid', aan ? 'aan' : 'uit'); } catch(e) {}
      if (!aan) this.muziek(false); else wek();
      if (meester) try { meester.gain.value = aan ? 0.32 : 0; } catch(e) {}
    },
    stop: function(){ this.muziek(false); try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch(e) {} }
  };
})();
var GRONDTOON = { stad:0, jungle:5, riool:-2, woestijn:3, tempel:-5, server:7, ijs:2, magma:-3 };


/* ---------- palet voor effecten ---------- */
var P={
  zwart:0x0d1326, wit:0xeaf4ff, grijs:0xb9cfe8, staal:0x6b84ad,
  blauw:0x3d7fd8, blauwD:0x23508f, cyaan:0x5ee7e0,
  rood:0xc0392b, roodD:0x7a2018, oranje:0xe8892f,
  roze:0xff5d9e, goud:0xffc94a, steenL:0x8fa3bd
};
function int(hex){ return parseInt(String(hex).slice(1),16); }

var held="runner";
/* romp en mond in beeldpunten van de figuurtekening (dubbele scherpte);
   romp = [x, y, breed, hoog] vanaf linksboven van het figuur */
var HELDEN={
  runner:{sprong:300,tweede:250,loop:92,glijtijd:600,herlaad:300,levens:3,kracht:1,
    romp:[8,10,16,42], rompGlij:[8,24,26,28], mond:[16,4], mondGlij:[16,20], kogelKleur:P.cyaan},
  gunner:{sprong:285,tweede:235,loop:92,glijtijd:600,herlaad:300,levens:3,kracht:2,
    romp:[9,8,20,44], rompGlij:[9,20,28,32], mond:[24,3], mondGlij:[24,18], kogelKleur:P.oranje}
};
function kies(w){
  held=w;
  naKeuze(w);
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

function rng(seed){
  return function(){
    seed|=0;seed=seed+0x6D2B79F5|0;
    var t=Math.imul(seed^seed>>>15,1|seed);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

/* ---------- maten ---------- */
/* De wereld is 180 hoog en BREED breed; getekend wordt op dubbele scherpte. */
var BREED=320,HOOG=180,TEGEL=16,ZWAARTE=900,CHUNK=10*TEGEL,SCHERP=2;

/* ---------- figuren naar texturen ---------- */
function figuurTexturen(scene){
  var groen=Object.assign({},FIG.RUNNER,{dark:'#0e4a2a',mid:'#26a45a',lite:'#86e8a8',trim:'#e0ffb8'});
  var paars=Object.assign({},FIG.GUNNER,{dark:'#321060',mid:'#7a2ab8',lite:'#b870ec',trim:'#ff9ae0'});
  [['runner',FIG.RUNNER],['gunner',FIG.GUNNER],['runnerB',groen],['gunnerB',paars]].forEach(function(paar){
    var naam=paar[0], C=paar[1], pal=FIG.palet(C);
    for (var f=0;f<10;f++){
      var houding = f<8 ? 'loop' : (f===8 ? 'sprong' : 'glij');
      var r = FIG.beeldje(C, f<8?f:0, 8, houding);
      var d = nieuwDoek(scene,'fig_'+naam+'_'+f,r.b,r.h), id = d.g.createImageData(r.b,r.h);
      for (var i=0;i<r.b*r.h;i++){ var k=r.d[i]; if(!k||!pal[k]) continue; var hx=pal[k];
        id.data[i*4]=parseInt(hx.slice(1,3),16); id.data[i*4+1]=parseInt(hx.slice(3,5),16);
        id.data[i*4+2]=parseInt(hx.slice(5,7),16); id.data[i*4+3]=255; }
      d.g.putImageData(id,0,0); d.t.refresh();
    }
  });
}

/* ---------- munten en kogels, dubbele scherpte ---------- */
function maakMunten(scene){
  function munt(naam,maat,breed){
    var d=nieuwDoek(scene,naam,maat,maat), g=d.g, x0=Math.floor((maat-breed)/2);
    vlak(g,'#1a1004',x0,2,breed,maat-4);
    if (breed>4){ vlak(g,'#1a1004',x0+2,0,breed-4,maat);
      vlak(g,'#ffc94a',x0+2,2,breed-4,maat-4); vlak(g,'#c8781e',x0+breed-4,4,2,maat-8);
      vlak(g,'#fff2b0',x0+2,4,2,4); if (breed>8) vlak(g,'#e8a02e',x0+Math.floor(breed/2)-1,5,2,maat-10); }
    else vlak(g,'#ffc94a',x0,2,breed,maat-4);
    d.t.refresh();
  }
  munt("munt0",16,16); munt("munt1",16,10); munt("munt2",16,4);
  munt("muntD0",24,24); munt("muntD1",24,14); munt("muntD2",24,6);
  var vt=nieuwDoek(scene,'vat',32,32), v=vt.g;
  vlak(v,'#140606',4,0,24,32); vlak(v,'#140606',2,2,28,28);
  vlak(v,'#9a1e14',6,2,20,28); vlak(v,'#9a1e14',4,4,24,24); vlak(v,'#c8341e',6,2,5,28); vlak(v,'#5e100a',22,4,4,24);
  vlak(v,'#140606',4,7,24,2); vlak(v,'#140606',4,23,24,2);
  vlak(v,'#ffb01a',8,11,16,10); vlak(v,'#140606',9,12,14,8);
  vlak(v,'#ffd23a',15,12,2,5); vlak(v,'#ffd23a',15,18,2,2); vlak(v,'#ffe89a',12,13,1,1);
  vt.t.refresh();
  var k1=nieuwDoek(scene,'kogel_runner',12,6), a=k1.g;
  vlak(a,'#0a5a66',0,1,12,4); vlak(a,'#5ee7e0',1,1,11,4); vlak(a,'#ffffff',6,2,5,2); k1.t.refresh();
  var k2=nieuwDoek(scene,'kogel_gunner',10,10), b=k2.g;
  vlak(b,'#5a1e06',2,0,6,10); vlak(b,'#5a1e06',0,2,10,6); vlak(b,'#e8892f',2,2,6,6); vlak(b,'#ffe08a',3,3,3,3); k2.t.refresh();
}

/* ---------- scene ---------- */
var Spel=new Phaser.Class({
  Extends:Phaser.Scene,
  initialize:function Spel(){Phaser.Scene.call(this,{key:"spel"});},
  create:function(){
    var h=HELDEN[held];this.h=h;this.huid=mijnHuid();
    huidige=this;
    this.seed=SEED;this.camX=0;this.levens=h.levens;
    this.onraakbaar=0;this.glijdt=0;this.sprongen=0;this.wacht=0;
    this.coyote=0;this.herlaad=0;this.loper=0;
    this.laatsteChunk=-1;this.chunks={};
    this.brokken=[];this.bevries=0;
    this.score=0;this.getoond=0;this.muntTal=0;this.laatsteMeter=0;
    this.muntKlok=0;this.muntStand=0;
    this.volgorde=maakVolgorde(this.seed);this.bioomNu=-1;this.klaar={};

    figuurTexturen(this);maakMunten(this);
    for (var b=0;b<BIOMEN.length;b++) tekenTegels(this,BIOMEN[b]);

    var cam=this.cameras.main;
    cam.setZoom(SCHERP).setOrigin(0,0);cam.roundPixels=true;

    this.lucht=this.add.tileSprite(0,0,BREED*SCHERP,LAAG_H,'__WHITE').setOrigin(0,0).setScale(0.5).setScrollFactor(0).setDepth(-40);
    this.maan=this.add.image(0,0,'__WHITE').setOrigin(0.5).setScrollFactor(0).setDepth(-35).setScale(0.5).setVisible(false);
    this.laagVer=this.add.tileSprite(0,0,BREED*SCHERP,LAAG_H,'__WHITE').setOrigin(0,0).setScale(0.5).setScrollFactor(0).setDepth(-20);
    this.laagDicht=this.add.tileSprite(0,0,BREED*SCHERP,LAAG_H,'__WHITE').setOrigin(0,0).setScale(0.5).setScrollFactor(0).setDepth(-10);

    this.vast=this.physics.add.staticGroup();
    this.sier=this.add.group();
    this.kogels=this.physics.add.group({allowGravity:false});
    this.munten=this.physics.add.group({allowGravity:false,immovable:true});
    this.vijanden=this.physics.add.group();

    this.speler=this.physics.add.sprite(60,80,'fig_'+this.huid+'_0').setScale(0.5);
    this.zetRomp(false);
    this.speler.setDepth(5);
    this.physics.add.collider(this.speler,this.vast);
    this.physics.add.overlap(this.kogels,this.vast,this.raakBlok,null,this);
    this.physics.add.overlap(this.speler,this.munten,this.pak,null,this);
    this.physics.add.collider(this.vijanden,this.vast);
    this.physics.add.overlap(this.kogels,this.vijanden,this.raakVijand,null,this);
    this.physics.add.overlap(this.speler,this.vijanden,this.botsVijand,null,this);

    this.fx=this.add.graphics().setDepth(6);

    for(var c=0;c<4;c++)this.bouwChunk(c);
    this.laatsteChunk=3;
    this.wisselBioom(0,true);

    this.toetsen=this.input.keyboard.addKeys("SPACE,UP,DOWN,X",false);
    zetAanraking(this);
    maakGeest(this);
    tekenHarten(this.levens,h.levens);
  },

  /* ---------- gebieden ---------- */
  bioomVan:function(chunk){ return BIOMEN[this.volgorde(Math.floor(Math.max(0,chunk)/BIOOM_LENGTE))]; },
  zorgVoor:function(B){
    if (this.klaar[B.id]) return;
    tekenLucht(this,B); tekenLagen(this,B); this.klaar[B.id]=true;
  },
  wisselBioom:function(n,stil){
    var B=BIOMEN[this.volgorde(n)];this.bioomNu=n;this.B=B;
    this.zorgVoor(B);
    this.lucht.setTexture('lucht_'+B.id);
    this.laagVer.setTexture('ver_'+B.id);this.laagDicht.setTexture('dicht_'+B.id);
    if (B.maan){ this.maan.setTexture('maan_'+B.id).setVisible(true).setPosition(Math.round(BREED*B.maan.x),B.maan.y); }
    else this.maan.setVisible(false);
    /* texturen van gebieden die we niet meer zien, weer opruimen */
    var houd={}; houd[B.id]=1; houd[BIOMEN[this.volgorde(n+1)].id]=1;
    for (var id in this.klaar) if (!houd[id]){ ['lucht_','ver_','dicht_','maan_'].forEach(function(p){ if(this.textures.exists(p+id)) this.textures.remove(p+id); },this); delete this.klaar[id]; }
    GELUID.grondtoon(GRONDTOON[B.id]||0);
    if (!stil){ var k=int(B.neon); this.cameras.main.flash(260,(k>>16)&255,(k>>8)&255,k&255); GELUID.speel('bioom'); }
    toonBord(B.naam,B.neon);
  },

  /* Een pad boven loopt over vier stukken baan; of het er is en hoe hoog,
     hangt af van het blok van vier, zodat de stukken op elkaar aansluiten. */
  route:function(index){
    var seg=Math.floor(index/4), r=rng(this.seed^Math.imul(seg+7,0x85ebca6b));
    var aan = r()<0.5 && seg>=1;
    return { aan:aan, rij:r()<0.7?5:4, pos:index%4 };
  },
  rustig:function(index){
    if (index%BIOOM_LENGTE<3) return true;                  // elk gebied begint rustig
    return rng(this.seed^Math.imul(index,0x27d4eb2d))()<0.12;
  },

  bouwChunk:function(index){
    var r=rng(this.seed^Math.imul(index,0x9E3779B1));
    var r2=rng(this.seed^Math.imul(index+3,0x165667b1));     // aparte reeks voor de nieuwe dingen
    var basis=index*CHUNK,lijst=[],scene=this,bezet={};
    var B=this.bioomVan(index);
    if (index%BIOOM_LENGTE===0) this.zorgVoor(B);
    function tegel(tx,ty,soort){
      if (bezet[tx+","+ty]) return null;
      bezet[tx+","+ty]=true;
      var key = soort==='blok' ? 'blok_'+B.id : soort==='vat' ? 'vat' : soort==='plat' ? 'plat_'+B.id : (ty===9 ? 'grondT_'+B.id : 'grondB_'+B.id);
      var b=scene.vast.create(basis+tx*TEGEL,ty*TEGEL,key).setOrigin(0,0).setScale(0.5);
      b.refreshBody();
      b.stuk=(soort==="blok"||soort==="vat");
      b.vat=(soort==="vat");
      b.leven=soort==="vat"?1:2;b.bioom=B;
      if (soort==='plat'){ b.body.checkCollision.down=false; b.body.checkCollision.left=false; b.body.checkCollision.right=false; b.setDepth(2); }
      lijst.push(b);return b;
    }
    function munt(x,y,dik){ lijst.push(scene.maakMunt(x,y,dik)); }

    /* rustig stuk: alleen grond en een boog munten */
    if (index>=1 && this.rustig(index)){
      for (var t0=0;t0<10;t0++){ tegel(t0,9); tegel(t0,10); }
      if (index%BIOOM_LENGTE>=1) for (var m0=1;m0<9;m0++) munt(basis+m0*TEGEL+8, 8*TEGEL+6-Math.round(Math.sin(m0/9*Math.PI)*28), false);
      this.chunks[index]=lijst; return;
    }
    if (index===0){ for (var t1=0;t1<10;t1++){ tegel(t1,9); tegel(t1,10); } this.chunks[index]=lijst; return; }

    var R=this.route(index), metRoute=R.aan && !this.rustig(index-R.pos);
    var gat=-1;
    if(index>=2&&r()<0.4)gat=2+Math.floor(r()*5);
    var treden = metRoute && R.pos===0 ? (R.rij===5 ? 3 : 4) : 0;
    if (treden && gat>=0 && gat<treden+1) gat=treden+2;       // geen gat onder het trapje
    for(var t=0;t<10;t++){
      if(t===gat||t===gat+1){ var vl=scene.add.image(basis+t*TEGEL,10*TEGEL+4,'vloei_'+B.id).setOrigin(0,0).setScale(0.5).setDepth(1); lijst.push(vl); continue; }
      tegel(t,9);tegel(t,10);
    }

    /* pad boven: trapje, richels, soms een gat, munten erop */
    if (metRoute){
      var begin = R.pos===0 ? 3 : 0, eind = R.pos===3 ? 7 : 9, rij=R.rij;
      var gatB = (R.pos===1||R.pos===2) && r2()<0.5 ? 3+Math.floor(r2()*3) : -9;
      if (R.pos===0){                                          // trapje: treden van 16 pixels
        for (var tr=0;tr<treden;tr++) for (var th=0;th<=tr;th++) tegel(tr,8-th,'blok');
        begin=treden;
      }
      for (var c=begin;c<=eind;c++){
        if (c===gatB||c===gatB+1) continue;
        tegel(c,rij,'plat');
        if (c%2===1) munt(basis+c*TEGEL+8,(rij-1)*TEGEL+8,false);
      }
      if (R.pos===2) munt(basis+(gatB>0?gatB+1:5)*TEGEL,(rij-2)*TEGEL+4,true);
    }

    var n=r()<0.5?1:2;
    for(var i=0;i<n;i++){
      var tx=Math.floor(r()*9);
      if(tx===gat||tx===gat+1)continue;
      tegel(tx,8,r2()<0.22?"vat":"blok");
      if(r()<0.4)tegel(tx,7,"blok");
    }
    if(index>=3&&r()<0.35){
      var vx=1+Math.floor(r()*7);
      if(vx!==gat&&vx!==gat+1){
        tegel(vx,8,"blok");tegel(vx,7,"blok");tegel(vx,6,"blok");
        if (r2()<0.4) tegel(vx+1<10&&vx+1!==gat?vx+1:vx-1,8,"vat");   // vat naast de versperring
      }
    }

    if(r()<0.6){
      var s0=Math.floor(r()*6),lengte=3+Math.floor(r()*3);
      for(var m=0;m<lengte;m++){
        var mx=s0+m;if(mx>9)break;
        if(mx===gat||mx===gat+1||bezet[mx+",8"])continue;
        munt(basis+mx*TEGEL+8,8*TEGEL+6,false);
      }
    }
    if(gat>=0){
      var boog=[5,4,4,5];
      for(var bi=0;bi<4;bi++) if(!metRoute||boog[bi]!==R.rij) munt(basis+(gat-1+bi)*TEGEL+8,boog[bi]*TEGEL+8,false);
    }
    var top=null;
    for(var sleutel in bezet){
      var dl=sleutel.split(","),kx=+dl[0],ky=+dl[1];
      if(ky<9&&ky>6&&(top===null||ky<top.y))top={x:kx,y:ky};
    }
    if(top&&!metRoute&&r()<0.7) munt(basis+top.x*TEGEL+8,(top.y-2)*TEGEL+8,true);

    /* vijanden, pas vanaf het vijfde stuk */
    if (index>=5){
      if (r2()<0.38){ var lx=4+Math.floor(r2()*5); if(lx!==gat&&lx!==gat+1&&!bezet[lx+",8"]) lijst.push(this.maakVijand('loper',basis+lx*TEGEL+8,8*TEGEL+2,B)); }
      if (r2()<0.28){ var hy=metRoute?(R.rij-2):(4+Math.floor(r2()*3)); lijst.push(this.maakVijand('vlieger',basis+(3+Math.floor(r2()*6))*TEGEL,hy*TEGEL+8,B)); }
    }
    this.chunks[index]=lijst;
  },
  maakVijand:function(soort,x,y,B){
    var v=this.vijanden.create(x,y,soort+'_'+B.id+'_0').setScale(0.5).setDepth(4);
    v.soort=soort;v.B=B;v.fase=Math.random()*6;v.richting=-1;
    if(soort==='loper'){ v.leven=2; v.body.setSize(26,22); v.body.setOffset(5,9); }
    else { v.leven=1; v.body.setAllowGravity(false); v.body.setSize(24,18); v.body.setOffset(6,5); }
    return v;
  },
  raakVijand:function(kogel,v){
    if(!kogel.active||!v.active)return;
    kogel.destroy();
    v.leven-=this.h.kracht;
    this.spat(v.x,v.y,[P.wit,int(v.B.neon)],4);
    if(v.leven>0){ GELUID.speel('raak'); if(v.setTintFill){ v.setTintFill(0xffffff); this.time.delayedCall(70,function(){ if(v.active) v.clearTint(); }); } return; }
    this.doodVijand(v);
  },
  doodVijand:function(v){
    if(!v.active)return;
    var punten=v.soort==='loper'?100:150;
    this.score+=punten;
    this.spat(v.x,v.y,[int(v.B.neon),0x3a3348,0x5a5270,P.wit],18);
    this.zweef(v.x,v.y-10,'+'+punten,v.B.neon);
    this.cameras.main.shake(80,0.004);
    GELUID.speel('vijand');
    v.destroy();
  },
  botsVijand:function(speler,v){
    if(!v.active||this.onraakbaar>0)return;
    this.pijn();
  },
  pijn:function(){
    this.levens--;
    tekenHarten(Math.max(0,this.levens),this.h.levens);
    this.cameras.main.shake(160,0.008);
    this.spat(this.speler.x,this.speler.y,[P.roze,P.wit],14);
    GELUID.speel('pijn');
    if(this.levens<=0){this.einde();return;}
    this.onraakbaar=1500;
    this.speler.setVelocityY(-200);
  },
  explodeer:function(bron){
    if(!bron||!bron.scene)return;
    var x=bron.x+8,y=bron.y+8,sc=this,R=36;
    bron.destroy();
    this.spat(x,y,[0xffd23a,0xff6a1a,0xffffff,0x9a1e14],30);
    var ring2=this.add.circle(x,y,6,0xffd23a,0.85).setDepth(6);
    this.tweens.add({targets:ring2,scale:6,alpha:0,duration:300,onComplete:function(){ring2.destroy();}});
    var ring3=this.add.circle(x,y,8,0xff6a1a,0).setStrokeStyle(3,0xff6a1a,0.9).setDepth(6);
    this.tweens.add({targets:ring3,scale:5,alpha:0,duration:420,delay:40,onComplete:function(){ring3.destroy();}});
    this.cameras.main.shake(220,0.012);
    GELUID.speel('knal');
    this.score+=25; this.zweef(x,y-12,'+25','#ffd23a');
    var weg=[];
    this.vast.children.each(function(b){ if(b.active&&b.stuk){ var dx=b.x+8-x,dy=b.y+8-y; if(dx*dx+dy*dy<=R*R) weg.push(b); } });
    weg.forEach(function(b){
      if(!b.scene)return;
      if(b.vat){ sc.time.delayedCall(130,function(){ sc.explodeer(b); }); }
      else { var K=b.bioom.blok; sc.spat(b.x+8,b.y+8,[int(K.accent),int(K.vlak),int(K.licht)],10); b.destroy(); }
    });
    this.vijanden.children.each(function(v){ if(v.active){ var dx=v.x-x,dy=v.y-y; if(dx*dx+dy*dy<=(R+8)*(R+8)) sc.time.delayedCall(40,function(){ sc.doodVijand(v); }); } });
  },
  maakMunt:function(x,y,dik){
    var m=this.munten.create(x,y,dik?"muntD0":"munt0").setScale(0.5);
    m.body.setAllowGravity(false);
    m.body.setSize(dik?20:12,dik?20:12);
    m.dik=dik;m.setDepth(3);
    return m;
  },
  pak:function(speler,munt){
    if(!munt.active)return;
    var waarde=munt.dik?50:10;
    this.score+=waarde;this.muntTal++;
    this.spat(munt.x,munt.y,[P.goud,P.wit],munt.dik?12:4);
    GELUID.speel(munt.dik?'dikke':'munt');
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
      this.brokken.push({x:x,y:y,vx:Math.cos(hoek)*snel,vy:Math.sin(hoek)*snel-70,leven:1,
        kleur:kleuren[Math.floor(Math.random()*kleuren.length)],maat:(1+Math.floor(Math.random()*4))/2});
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
      g.fillRect(Math.round(p.x*2)/2,Math.round(p.y*2)/2,p.maat,p.maat);
    }
  },

  raakBlok:function(kogel,blok){
    if(!kogel.active||!blok.scene)return;
    if(!blok.bioom)blok.bioom=this.B;
    var mx=blok.x+8,my=blok.y+8,K=blok.bioom.blok;
    kogel.destroy();
    if(!blok.stuk){ this.spat(mx-6,my-6,[P.wit,int(blok.bioom.grond.lijn)],4); return; }
    if(blok.vat){ this.explodeer(blok); return; }
    blok.leven-=this.h.kracht;
    if(blok.leven>0){
      blok.setTexture("blokStuk_"+blok.bioom.id);
      this.spat(mx,my,[int(K.licht),int(K.vlak)],5);
      GELUID.speel('tik');
      this.cameras.main.shake(60,0.002);
      return;
    }
    this.spat(mx,my,[int(K.accent),int(K.vlak),int(K.licht),P.wit],16);
    GELUID.speel('kapot');
    blok.destroy();
    this.cameras.main.shake(100,0.005);
    this.bevries=60;
    this.physics.world.pause();
  },

  zetRomp:function(glij){
    var R=glij?this.h.rompGlij:this.h.romp;
    this.speler.body.setSize(R[2],R[3]);
    this.speler.body.setOffset(R[0],R[1]);
  },
  spring:function(){this.wacht=150;},
  glij:function(){
    if(this.glijdt>0||!this.speler.body.blocked.down)return;
    this.glijdt=this.h.glijtijd;
    this.zetRomp(true);
  },
  stopGlijden:function(){
    this.glijdt=0;
    this.zetRomp(false);
  },
  schiet:function(){
    if(this.herlaad>0||this.bevries>0)return;
    this.herlaad=this.h.herlaad;
    var M=this.glijdt>0?this.h.mondGlij:this.h.mond;
    var x=this.speler.x+M[0]/2, y=this.speler.y+M[1]/2;
    var k=this.kogels.create(x,y,'kogel_'+held).setScale(0.5);
    k.body.setAllowGravity(false);
    k.body.setSize(10,6);
    k.setVelocityX(260);k.setDepth(4);k.geboren=this.time.now;
    this.spat(x+2,y,[this.h.kogelKleur,P.wit],3);
    GELUID.speel(held==='gunner'?'schietG':'schietR');
  },

  update:function(tijd,dt){
    dt=Math.min(dt,50);
    var d=dt/1000;
    if(this.bevries>0){
      this.bevries-=dt;
      this.tekenBrokken(d*0.35);
      if(this.bevries<=0)this.physics.world.resume();
      return;
    }
    var s=this.speler,h=this.h;
    this.camX+=h.loop*d;
    this.cameras.main.scrollX=Math.round(this.camX*SCHERP)/SCHERP;
    this.laagDicht.tilePositionX=this.camX*0.4*SCHERP;
    this.laagVer.tilePositionX=this.camX*0.15*SCHERP;
    this.lucht.tilePositionX=this.camX*0.03*SCHERP;

    var nodig=Math.floor((this.camX+BREED)/CHUNK)+1;
    while(this.laatsteChunk<nodig){this.laatsteChunk++;this.bouwChunk(this.laatsteChunk);}
    var oud=Math.floor((this.camX-CHUNK*2)/CHUNK);
    if(this.chunks[oud])this.ruimChunk(oud);

    var hier=Math.floor(Math.max(0,s.x)/CHUNK/BIOOM_LENGTE);
    if(hier!==this.bioomNu)this.wisselBioom(hier,false);

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
        s.setVelocityY(-h.sprong);this.sprongen=1;this.wacht=0;this.coyote=0;GELUID.speel('spring');
        this.stopGlijden();
      } else if(!eerste&&this.sprongen===1){
        s.setVelocityY(-h.tweede);this.sprongen=2;this.wacht=0;GELUID.speel('dubbel');
        ring(this,s.x,s.y+10);
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

    this.loper+=d*(s.body.blocked.down&&this.glijdt<=0?15:0);
    var nr=this.glijdt>0?9:(!s.body.blocked.down?8:Math.floor(this.loper)%8);
    var key='fig_'+this.huid+'_'+nr;
    if(s.texture.key!==key)s.setTexture(key);

    this.kogels.children.each(function(k){
      if(k.active&&(k.x>this.camX+BREED+20||tijd-k.geboren>2200))k.destroy();
    },this);

    var tNu=tijd/1000;
    this.vijanden.children.each(function(v){
      if(!v.active)return;
      if(v.x<this.camX-40||v.y>HOOG+40){ v.destroy(); return; }
      var key=v.soort+'_'+v.B.id+'_'+(Math.floor(tNu*6+v.fase)%2);
      if(v.texture.key!==key)v.setTexture(key);
      if(v.soort==='loper'){
        if(v.body.blocked.left)v.richting=1; else if(v.body.blocked.right)v.richting=-1;
        v.setVelocityX(28*v.richting); v.setFlipX(v.richting>0);
      } else { v.setVelocityX(-18); v.setVelocityY(Math.cos(tNu*2.5+v.fase)*20); }
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
    GELUID.speel('val');
    if(this.levens<=0){this.einde();return;}
    this.speler.setPosition(this.camX+90,50);
    this.speler.setVelocity(0,0);
    this.stopGlijden();
    this.onraakbaar=1500;
  },

  einde:function(){
    var m=Math.floor(this.camX/16);
    this.scene.pause();
    GELUID.muziek(false);GELUID.speel('einde');
    stuurEinde(this);
    laag.querySelector("h1").textContent="GAME OVER";
    scoreVak.textContent=String(this.score).padStart(7,"0");
    laag.querySelector("p").textContent="SCORE "+String(this.score).padStart(7,"0")+
      " — "+m+" meter, "+this.muntTal+" munten.";
    startKnop.textContent="OPNIEUW";
    laag.hidden=false;startKnop.focus({preventScroll:true});
    naEinde();
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
    if(p.y-s.y>26*SCHERP&&scene.time.now-s.t<420){s.geveegd=true;scene.glij();}
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
    ander = { x: p.x, y: p.y, f: p.f | 0, h: ['runner','gunner','runnerB','gunnerB'].indexOf(p.h) >= 0 ? p.h : 'runner',
              s: p.s | 0, l: p.l | 0, d: !!p.d, v: +p.v || 92, tijd: performance.now() }
    toonAnder()
  })

  function maakGeest(scene) {
    scene.geest = scene.add.sprite(-500, -500, 'fig_runner_0').setScale(0.5).setAlpha(0.5).setDepth(4).setVisible(false)
    const stijl = { fontFamily: '"Press Start 2P",monospace', fontSize: '6px', color: '#ffd27a', stroke: '#0d1326', strokeThickness: 2 }
    scene.geestNaam = scene.add.text(0, 0, NAAM, stijl).setOrigin(0.5, 1).setDepth(7).setVisible(false)
    scene.pijl = scene.add.text(0, 0, '', stijl).setScrollFactor(0).setDepth(8).setVisible(false)
  }

  /* neonbord met de naam van het gebied */
  const bord = document.createElement('div')
  bord.className = 'bord'
  veld.appendChild(bord)
  function toonBord(naam, kleur) {
    bord.textContent = naam
    bord.style.setProperty('--k', kleur)
    bord.classList.remove('aan'); void bord.offsetWidth; bord.classList.add('aan')
  }

  function netwerkStap(scene, tijd, dt) {
    const s = scene.speler
    stuurKlok += dt
    if (stuurKlok >= 160) {                         // zes keer per seconde
      stuurKlok = 0
      stuur({ x: Math.round(s.x), y: Math.round(s.y), f: +s.texture.key.split('_').pop() || 0,
              h: scene.huid || held, s: scene.score, l: scene.levens, v: scene.h.loop, d: 0 })
    }
    const g = scene.geest, nm = scene.geestNaam, pijl = scene.pijl
    const oud = ander ? performance.now() - ander.tijd : 1e9
    if (!ander || ander.d || oud > 3000) { g.setVisible(false); nm.setVisible(false); pijl.setVisible(false); return }
    // tussen twee berichten doorrekenen: de ander rent altijd even hard vooruit
    const doelX = ander.x + ander.v * Math.min(oud, 400) / 1000
    if (!g.visible || Math.abs(doelX - g.x) > 160) g.setPosition(doelX, ander.y)
    g.x += (doelX - g.x) * 0.3
    g.y += (ander.y - g.y) * 0.3
    g.setTexture('fig_' + ander.h + '_' + Math.min(9, Math.max(0, ander.f)))
    const cam = scene.camX, links = g.x < cam - 10, rechts = g.x > cam + BREED + 10
    if (!links && !rechts) {
      g.setVisible(true); nm.setVisible(true).setPosition(Math.round(g.x), Math.round(g.y - 16))
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
    stuur({ x: Math.round(scene.speler.x), y: Math.round(scene.speler.y), f: 0, h: scene.huid || held,
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
  /* ---------- samen starten: de uitnodiger kiest en start voor allebei ---------- */
  const kanaalOk = !!(spelKanaal && typeof spelKanaal.on === 'function' && typeof spelKanaal.send === 'function')
  const leider = !!benIkSpeler1 || !kanaalOk
  const rolVak = wrap.querySelector('.rol')
  const AFTEL = 700
  let partnerKlaar = !kanaalOk, laatsteKlaar = 0, aftellen = false, klaarKlok = 0, ronde = 0
  if (!leider) wrap.classList.add('volger')
  const geldig = h => (h === 'runner' || h === 'gunner') ? h : null
  const KLEUR = { runner: 'GROEN', gunner: 'PAARS' }
  let anderHeld = null           // wat de ander gekozen heeft, voor zover we weten

  /* zelfde figuur? dan speelt de genodigde in de tweede kleur */
  function mijnHuid() { return held + ((!leider && anderHeld === held) ? 'B' : '') }

  function stuurBericht(event, payload) {
    if (!kanaalOk || !isActief()) return
    try { spelKanaal.send({ type: 'broadcast', event, payload: payload || {} }) } catch (e) {}
  }
  function werkStartscherm() {
    let regel = ''
    if (leider) {
      startKnop.hidden = false
      startKnop.disabled = !partnerKlaar
      startKnop.textContent = partnerKlaar ? (ronde ? 'OPNIEUW' : 'START') : 'WACHT OP ' + NAAM
      if (partnerKlaar && anderHeld) regel = NAAM + ' KIEST ' + anderHeld.toUpperCase()
    } else {
      startKnop.hidden = true
      regel = NAAM + ' START HET SPEL'
    }
    if (anderHeld && anderHeld === held)
      regel += ' — ALLEBEI ' + held.toUpperCase() + ', ' + (leider ? NAAM + ' IS ' : 'JIJ BENT ') + KLEUR[held]
    rolVak.textContent = regel
  }
  function naKeuze(w) {
    if (leider) stuurBericht('rg-keuze', { h: w })
    else stuurBericht('rg-klaar', { h: w })
    werkStartscherm()
  }
  function naEinde() { werkStartscherm() }

  function aftel(daarna) {
    aftellen = true
    wrap.classList.add('telt')
    const h1 = laag.querySelector('h1'), p = laag.querySelector('p')
    laag.hidden = false
    let n = 3
    const stap = () => {
      if (!isActief() || !wrap.isConnected) return
      if (n === 0) {
        GELUID.speel('go')
        aftellen = false; wrap.classList.remove('telt')
        h1.textContent = 'RUNNER & GUNNER'
        daarna(); return
      }
      h1.textContent = String(n)
      GELUID.speel('tel')
      p.textContent = 'JIJ BENT ' + held.toUpperCase() + (mijnHuid().endsWith('B') ? ' (' + KLEUR[held] + ')' : '')
      n--; setTimeout(stap, AFTEL)
    }
    stap()
  }

  if (kanaalOk) {
    spelKanaal.on('broadcast', { event: 'rg-klaar' }, msg => {
      if (!leider) return
      laatsteKlaar = performance.now()
      const h = geldig(msg && msg.payload && msg.payload.h)
      if (h) anderHeld = h
      if (!partnerKlaar && !aftellen) partnerKlaar = true
      if (!aftellen) werkStartscherm()
      stuurBericht('rg-keuze', { h: held })
    })
    spelKanaal.on('broadcast', { event: 'rg-keuze' }, msg => {
      if (leider) return
      const h = geldig(msg && msg.payload && msg.payload.h)
      if (!h) return
      anderHeld = h
      if (!laag.hidden && !aftellen) werkStartscherm()
    })
    spelKanaal.on('broadcast', { event: 'rg-start' }, msg => {
      if (leider || aftellen || laag.hidden) return
      const h = geldig(msg && msg.payload && msg.payload.h)
      if (!h) return
      anderHeld = h
      aftel(startRonde)
    })
  }

  const geluidKnop = wrap.querySelector('.geluidKnop')
  const toonGeluid = () => { geluidKnop.textContent = 'GELUID: ' + (GELUID.staatAan() ? 'AAN' : 'UIT') }
  toonGeluid()
  geluidKnop.addEventListener('click', e => { e.stopPropagation(); GELUID.zet(!GELUID.staatAan()); toonGeluid(); if (GELUID.staatAan() && laag.hidden) GELUID.muziek(true) })
  const wekGeluid = () => GELUID.wek()
  wrap.addEventListener('pointerdown', wekGeluid)
  window.addEventListener('keydown', wekGeluid)

  startKnop.addEventListener('click', () => {
    GELUID.wek()
    if (!leider || aftellen || !partnerKlaar) return
    partnerKlaar = !kanaalOk
    const h = held
    ;[0, 250, 500].forEach(ms => setTimeout(() => stuurBericht('rg-start', { h }), ms))
    aftel(startRonde)
  })
  werkStartscherm()

  function startRonde() {
    ronde++
    indeling()
    const verh = veld.clientWidth / Math.max(1, veld.clientHeight)
    BREED = Math.round(Math.min(640, Math.max(320, HOOG * verh)) / 2) * 2
    laag.hidden = true
    scoreVak.textContent = '0000000'; metersVak.textContent = '0M'
    tekenHarten(HELDEN[held].levens, HELDEN[held].levens)
    huidige = null
    if (spel) { spel.destroy(true); spel = null }
    spel = new Phaser.Game({
      type: Phaser.AUTO, width: BREED * SCHERP, height: HOOG * SCHERP, parent: veld,
      pixelArt: true, roundPixels: true, backgroundColor: '#07051a',
      input: { activePointers: 3 },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { y: ZWAARTE } } },
      scene: [Spel]
    })
    GELUID.muziek(true)
  }

  /* ---------- opruimen zodra het spel gesloten wordt ---------- */
  const waker = setInterval(() => {
    if (isActief() && wrap.isConnected) {
      document.body.classList.toggle('rg-vol', wrap.classList.contains('liggend') && laag.hidden)
      if (!leider && !aftellen && !laag.hidden) {
        klaarKlok += 300
        if (klaarKlok >= 900) { klaarKlok = 0; stuurBericht('rg-klaar', { h: held }) }
      }
      if (leider && kanaalOk && partnerKlaar && performance.now() - laatsteKlaar > 3000) {
        partnerKlaar = false; werkStartscherm()
      }
      return
    }
    clearInterval(waker)
    document.body.classList.remove('rg-vol')
    GELUID.stop()
    window.removeEventListener('keydown', wekGeluid)
    window.removeEventListener('resize', indeling)
    window.removeEventListener('orientationchange', indeling)
    huidige = null
    if (spel) { try { spel.destroy(true) } catch (e) {} spel = null }
    if (wrap.isConnected) wrap.remove()
  }, 300)
  return { _proef: { maakGeest, netwerkStap, stuurEinde, ander: () => ander, held: () => held, huid: mijnHuid, naEinde, scene: () => huidige, spel: () => spel } }
}
