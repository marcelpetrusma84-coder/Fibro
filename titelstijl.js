// titelstijl.js - GEMAAKT door tests/gen/maak_titelstijl.py; niet met de hand aanpassen (v2, 2 nov 2026; v2: ook Ghost Tag)
//
// In gewone woorden: de tekencode van drie spellen, letterlijk overgenomen uit het spel zelf, zodat hun titelscherm
// in precies dezelfde stijl is: The Swarm (swarm-ui.js, pixels op 140 x 210), Runner & Gunner (runner-gunner-ui.js,
// pixelfiguren en de neonstad) en Neon Raiders (neon-raiders-ui.js, neon in vectorstijl op 360 x 640).
// Alles zit in functies die pas iets maken als het titelscherm opent (zonder pagina werkt het niet).

/* eslint-disable */

// ── The Swarm ──
export function maakSwarm() {
const D=document,W=140,H=210;
function mk(w,h){const c=D.createElement('canvas');c.width=w;c.height=h;return c}
function sprite(rows,pal,glow,gb){const w=rows[0].length,h=rows.length,p=4;const b=mk(w+2*p,h+2*p),q=b.getContext('2d');
rows.forEach((r,y)=>{for(let i=0;i<w;i++){const ch=r[i];if(ch!=='.'){q.fillStyle=pal[ch];q.fillRect(i+p,y+p,1,1)}}});
const g=mk(b.width,b.height),gq=g.getContext('2d');
if(glow){gq.shadowColor=glow;gq.shadowBlur=gb||3;gq.drawImage(b,0,0);gq.drawImage(b,0,0);gq.shadowBlur=(gb||3)+2;gq.drawImage(b,0,0)}
return{b,g,w,h,p}}
const mir=L=>L.map(r=>r+[...r.slice(0,-1)].reverse().join(''));
const HT=["...h.h.h.....","..hhhhhhh..W.","..hhhhhhh..g.","..hhhhhhh..g.","...hhhhh...g.","...sssss...g.","....sss....g.",".jjPPPPPjj.g.","j.jPLpLPj.jg.","j.jPpLpPj.sg.","j.jPLpLPj.tg.","s.jPpLpPj.t..","..jPPPPPj.t..","..jjjjjjj.t..","..jkkkkkj.t..","..jjj.jjjt..."];
const HLa=["..jj...jj....","..jj...jj....","..jj...jj....","..jj...jj....",".kkk...kkk...",".kkk...kkk..."];
const HLb=["..jj...jj....","..jj...jj....",".jj.....jj...",".jj.....jj...","kkk.....kkk..","kkk.....kkk.."];
const SA=["......aba......",".....ababa.....","ww...babab...ww","wwww.ababa.wwww",".wwwwfffffwwww.","..l.fffffff.l..",".l.fEeEfEeEf.l.","l..feEefeEef..l","...fEeEfEeEf...","....fffffff....","....m.....m....","...m..SSS..m...","...m.......m...","....m.....m...."];
const SB=["......aba......",".....ababa.....",".....babab.....","www..ababa..www","wwwwwfffffwwwww","..l.fffffff.l..",".l.fEeEfEeEf.l.","l..feEefeEef..l","...fEeEfEeEf...","....fffffff....",".....m...m.....","....m.SSS.m....","....m.....m....",".....m...m....."];
const HA=["...aba...","ww.bab.ww",".wfffffw.","l.EefeE.l","..eEfEe..","l.fffff.l","...fSf...","...S.S...","....S...."];
const HB=["...aba...","...bab...","wwfffffww","l.EefeE.l","..eEfEe..","l.fffff.l","...fSf...","...S.S...","....S...."];
const WA=["l.........l",".l.......l.","..EeEfEeE..","..eEefeEe..","...fmSmf...","ww..fff..ww","wwww.a.wwww",".www.a.www.","...ababa...","..bababab..","..abababa..","...babab...","...ababa...","....bab....",".....a.....",".....S....."];
const WB=["l.........l",".l.......l.","..EeEfEeE..","..eEefeEe..","...fmSmf...","...wfffw...","..ww.a.ww..","wwww.a.wwww","ww.ababa.ww","..bababab..","..abababa..","...babab...","...ababa...","....bab....",".....a.....",".....S....."];
const BL=[".......aabb",".....aabbcc","ww..aabbcbb","wwwwabVbcbb",".wwwabbVbbb","..wwabbbVbb","l...aabbbbV",".l...aaaaaa","..l..ffffff","l..lfEeEfff",".ll.feEefff","...lfEeEfff",".....fffmff","......m..SS",".....m...SS",".....m....S","......mm...","........m.S"];
const BLb=BL.slice();BLb[2]="....aabbcbb";BLb[3]="w...abVbcbb";BLb[4]="wwwwabbVbbb";BLb[5]="wwwwabbbVbb";BLb[13]=".......m.SS";BLb[14]="......m..SS";BLb[15]="......m...S";BLb[16]=".......mm..";BLb[17]="........m..";
const crate=(w,h)=>(x,y)=>{if(x===0||x===w-1||y===0||y===h-1)return'#3a200c';if(Math.abs((x-1)-(h-2-(y-1))*(w-2)/(h-2))<1.3)return'#b07a3a';if(x%4===0)return'#5a3414';return(x>>2)%2?'#7a4a20':'#8a5a2a'};
const leaves=[[4,9,4,3],[14,7,4,3],[9,3,3,3],[3,15,3,2.5],[15,14,3,2.5]];
const plant=(x,y)=>{if(y>=20){const d=(y-20)/11*2,xl=2+d,xr=15-d;if(x<xl||x>xr)return null;if(y<=21)return'#a84a30';if(y===24+Math.abs((x%4)-2))return'#e8c070';return x>xr-2?'#6a2a1e':'#8a3a2a'}
for(const[cx,cy,rx,ry]of leaves){const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy<=1){if(((x*7+y*13)%5===0)&&dx*dx+dy*dy>.6)return null;if(Math.abs(dy)<.25)return'#2a6a1a';return dx<-.3&&dy<0?'#5aaa3a':'#3a8a2a'}}
if((x===8||x===9)&&y>=5)return'#2a5a1a';if(y>=9&&y<=12&&Math.abs(x-(y-4))<1)return'#2a5a1a';return null};
const tv=(x,y)=>{if(y>=22)return(x===2||x===3||x===16||x===17)?'#2a1a10':null;if(x===0||x===19||y===0||y===21)return'#4a2a14';if(x>=2&&x<=13&&y>=3&&y<=17){if((x===2||x===13)&&(y===3||y===17))return'#4a2a14';return(x*13+y*7)%5<2?'#9aa8b8':'#4a5468'}
if(x>=15&&x<=17){if(y===5||y===9)return'#c0c0c0';if(y>=13&&y<=18)return y%2?'#2a1a10':'#6a4020'}return'#6a4020'};
const barrel=(x,y)=>{const xl=Math.round(Math.abs(y-12)/12*2);if(x<xl||x>15-xl)return null;if(y===3||y===4||y===19||y===20)return x===xl||x===15-xl?'#3a3a40':'#6a6a74';if(x%3===0)return'#4a2a12';return x>11?'#5a3414':'#7a4a20'};
const logs=(x,y)=>{for(const[cx,cy]of[[4,19],[12,19],[20,19],[8,12],[16,12],[12,5]]){const d=Math.hypot(x-cx,y-cy);if(d<=4.2){if(d>3.3)return'#4a2a14';if(d<1.2)return'#c89a60';return(d|0)%2?'#a87a40':'#8a5a2a'}}return null};
const stump=(x,y)=>{if(y<5)return null;if(y<=8){if(((x-9)/7.5)**2+((y-6.5)/2)**2<=1)return(Math.hypot(x-9,(y-6.5)*3.5)|0)%3?'#b08850':'#8a6030';return null}const xl=y>20?0:2,xr=y>20?17:15;if(x<xl||x>xr)return null;return x%3===0?'#2a180c':'#4a2a14'};
const rock=(x,y)=>{const n=Math.sin(x*1.7)*0.08+Math.sin(y*1.3)*0.08;const d=((x-10)/10)**2+((y-15)/11)**2;if(d>1+n)return null;if(Math.abs(x-10-Math.sin(y*.5)*3)<.6&&y>8)return'#ff2040';if(y<7&&(x*5+y)%4===0)return'#4a1a3a';return x<8&&y<14?'#4a4054':d>.8?'#241c2c':'#3a3040'};
function bgHuis(FL){const b=mk(W,H),q=b.getContext('2d');
q.fillStyle='#1b1826';q.fillRect(0,0,W,FL);q.fillStyle='#262036';for(let y=4;y<96;y+=8)for(let x=(y/8|0)%2*4;x<W;x+=8){q.fillRect(x,y,1,1);q.fillRect(x-1,y+1,3,1);q.fillRect(x,y+2,1,1)}
q.fillStyle='#2a1a14';q.fillRect(0,96,W,FL-96);q.fillStyle='#1e120c';for(let x=0;x<W;x+=7)q.fillRect(x,98,1,FL-98);q.fillStyle='#3a2418';q.fillRect(0,96,W,2);
q.fillStyle='#3a2418';q.fillRect(12,22,34,42);q.fillStyle='#0a0e24';q.fillRect(14,24,30,38);
q.fillStyle='#e8e8d0';for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++)if(x*x+y*y<=25&&!((x+2)**2+(y-1)**2<=9))q.fillRect(36+x,33+y,1,1);
q.fillStyle='#05060f';[[16,62,16,40],[16,44,24,36],[20,50,14,46],[40,62,40,48],[40,52,44,44]].forEach(([a,b2,c,d])=>{const n=Math.max(Math.abs(c-a),Math.abs(d-b2));for(let i=0;i<=n;i++)q.fillRect(Math.round(a+(c-a)*i/n),Math.round(b2+(d-b2)*i/n),1,1)});
q.fillStyle='#3a2418';q.fillRect(28,24,2,38);q.fillRect(14,42,30,2);
q.fillStyle='#15101c';q.fillRect(0,FL,W,H-FL);q.fillStyle='#2e2440';
for(let i=1;i<=8;i++)q.fillRect(0,Math.round(FL+(H-FL)*Math.pow(i/8,1.6)),W,1);
for(let k=-9;k<=9;k++){const x0=W/2+k*9,x1=W/2+k*26;for(let y=FL;y<H;y++)q.fillRect(Math.round(x0+(x1-x0)*(y-FL)/(H-FL)),y,1,1)}
q.fillStyle='#3a2418';q.fillRect(0,FL,W,1);return b}
const MA=["dd.........dd","dDdd.....ddDd","dDoDd.f.dDoDd","ddeddfffddedd",".dddfEfEfddd.","..ddfffffdd..","....fafaf....",".....a.a....."];
const MB=["...dd...dd...","..dDd...dDd..",".dDoDdfdDoDd.",".ddeddfddedd.","..ddfEfEfdd..","...dfffffd...","....fafaf....",".....a.a....."];
const KA=["l.l.....l.l",".l.l...l.l.","..lbbbbbl..","l.bbcbcbb.l",".lbeEbEebl.","l.bbbbbbb.l","..lbmbmbl..",".l..mSm..l.","l.........l"];
const KB=[".l.l...l.l.","l.l.....l.l","..lbbbbbl..","l.bbcbcbb.l",".lbeEbEebl.","l.bbbbbbb.l","..lbmbmbl..",".l..mSm..l.",".l.......l."];
const TA=["...l...l...","....aaa....","..abbbbba..",".abVbbbVba.","labbbVbbbal",".abbbbbbba.","l.affffa.l.","..fEeEeEf..","l..fmSmf..l","....S.S...."];
const TB=["..l.....l..","....aaa....","..abbbbba..",".abVbbbVba.",".abbbVbbba.",".abbbbbbba.","l.affffa.l.","..fEeEeEf..","l..fmSmf..l","....S.S...."];
const PI={a:'#2a1030',b:'#7a3060',c:'#b060a0',f:'#5a3420',F:'#3a2010',E:'#5a0010',e:'#ff2a3a',m:'#e0d8a8',S:'#8dff2a',V:'#6dff1a',o:'#e8d890',w:'rgba(190,230,255,0.55)',l:'#4a2838',d:'#6a5a4a',D:'#3a3028'};
const GC='#6dff1a';
const HEROPAL=[{h:'#e8c040',s:'#f0b890',j:'#b8a070',k:'#3a2a18',P:'#4a4a5a',p:'#8a8a9a',L:'#2ee8ff',g:'#b0b8c8',t:'#2a2a30',W:'#ffffff'},{h:'#4a2210',s:'#d8a078',j:'#4a5a8a',k:'#2a2a3a',P:'#4a4a5a',p:'#8a8a9a',L:'#ff9a1f',g:'#b0b8c8',t:'#2a2a30',W:'#ffffff'}];
const heroS=i=>({A:sprite(HT.concat(HLa),HEROPAL[i],HEROPAL[i].L,2),B:sprite(HT.concat(HLb),HEROPAL[i],HEROPAL[i].L,2)});
const SLIME=['#8dff2a','#5fbf1a','#6b7a12','#a4ff5a','#3f5a10'];
const bugT=(A,B,pal,gl)=>{const P=Object.assign({},PI,pal||{});return{A:sprite(A,P,gl||GC),B:sprite(B,P,gl||GC)}};
const TY={sp:bugT(SA,SB),hg:bugT(HA,HB),ws:bugT(WA,WB),br:bugT(mir(BL),mir(BLb)),
mt:bugT(MA,MB,{f:'#8a7a5a',a:'#4a3a2a'},'#d0ff60'),kv:bugT(KA,KB,{b:'#2a1a2a',c:'#6a4a6a',l:'#5a4a5a'},'#c040ff'),
sl:bugT(TA,TB,{b:'#5a6a20',V:'#d0ff40'},'#b0ff30')};
const omslag=(fn,w,h)=>{const c=mk(w,h),q=c.getContext('2d');for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=fn(x,y);if(k){q.fillStyle=k;q.fillRect(x,y,1,1)}}return c};
const dekking=[[omslag(plant,18,32),6],[omslag(tv,20,26),60],[omslag(crate(20,24),20,24),114]];
return {W,H,mk,bg:bgHuis(120),FL:120,held:heroS(0),held2:heroS(1),TY,SLIME,dekking};
}

// ── Runner & Gunner ──
export function maakRunner() {
const vertaal = s => s;
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
function rng(seed){
  return function(){
    seed|=0;seed=seed+0x6D2B79F5|0;
    var t=Math.imul(seed^seed>>>15,1|seed);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
var LAAG_B = 512, LAAG_H = 360, GROND_Y = 288, BIOOM_LENGTE = 16;
var STAD = { id:'stad', naam:vertaal('NEON STAD'), donker:false,
    lucht:['#07051a','#1d0b3c','#4a1250','#8a2a62'], neon:'#ff3d9a', neon2:'#22e6ff',
    grond:{ boven:'#4b5184', vlak:'#262a4a', donker:'#141630', lijn:'#22e6ff' },
    blok:{ rand:'#0c0e22', vlak:'#4a507c', licht:'#7c83b8', schaduw:'#2c3058', accent:'#ff3d9a', motief:'band' },
    vloei:['#22e6ff','#0e7c9a'], maan:null, sterren:true };
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
};
function doek(b,h){ var c=document.createElement('canvas'); c.width=b; c.height=h; return {c:c,g:c.getContext('2d')}; }
// de lucht (zoals tekenLucht in het spel)
var lucht = doek(320,LAAG_H), g = lucht.g, k = STAD.lucht, band = LAAG_H/4;
for (var i=0;i<4;i++) vlak(g,k[i],0,Math.round(i*band),320,Math.ceil(band)+1);
for (var j=1;j<4;j++){ var y0 = Math.round(j*band);
  for (var x=0;x<320;x+=2){ vlak(g,k[j-1],x+(j%2),y0,1,1); vlak(g,k[j-1],x,y0+2,1,1); if(x%4===0) vlak(g,k[j-1],x+1,y0+4,1,1); } }
var rs = rng(77);
for (var s=0;s<70;s++){ var sx=Math.floor(rs()*320), sy=Math.floor(rs()*LAAG_H*0.5); g.globalAlpha = 0.4+rs()*0.6; vlak(g,'#ffffff',sx,sy,rs()<0.15?2:1,rs()<0.15?2:1); }
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
function figuur(C){ var pal=FIG.palet(C), uit=[]; for (var n=0;n<8;n++){ var r=FIG.beeldje(C,n,8), d=doek(r.b,r.h);
  for (var y=0;y<r.h;y++) for (var x2=0;x2<r.b;x2++){ var c=r.d[y*r.b+x2]; if(c){ d.g.fillStyle=pal[c]; d.g.fillRect(x2,y,1,1); } }
  uit.push(d.c); } return uit; }
return { LAAG_B:LAAG_B, LAAG_H:LAAG_H, GROND_Y:GROND_Y, STAD:STAD, lucht:lucht.c, ver:ver.c, dicht:dicht.c, grondT:gt.c, grondB:gb.c,
  kogelR:k1.c, kogelG:k2.c, runner:figuur(FIG.RUNNER), gunner:figuur(FIG.GUNNER) };
}

// ── Neon Raiders ──
export function maakNeon() {
const R = 2
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
function veelhoek(g, p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath() }
function lijn(g, kleur, dikte, p) { g.strokeStyle = kleur; g.lineWidth = dikte; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke() }
function lin(g, x0, y0, x1, y1, kleuren) { const k = g.createLinearGradient(x0, y0, x1, y1); kleuren.forEach((c, i) => k.addColorStop(i / (kleuren.length - 1), c)); return k }
function rad(g, x, y, r, kleuren) { const k = g.createRadialGradient(x, y, 0, x, y, r); kleuren.forEach((c, i) => k.addColorStop(i / (kleuren.length - 1), c)); return k }
function rondRect(g, x, y, b, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + b, y, x + b, y + h, r); g.arcTo(x + b, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + b, y, r); g.closePath() }
function wolk(g, x, y, rx, ry, kleuren) { g.save(); g.translate(x, y); g.scale(1, ry / rx); g.fillStyle = rad(g, 0, 0, rx, kleuren); g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore() }
const PALET = {
  rood: { licht: '#ff4d6d', mid: '#c0283c', donker: '#7a1028', diep: '#3b0a18', rand: '#ff9ab0', oog: '#ffd23c', motor: '#ff3dd2', gloed: '#ff3d6d' },
  staal: { licht: '#dfe6ee', mid: '#7d8a9c', donker: '#3a4354', diep: '#1a1f29', rand: '#f4f8fc', oog: '#ff4848', motor: '#ffa53c', gloed: '#ffa53c' },
  groen: { licht: '#b6ff3c', mid: '#4f9d2a', donker: '#2a5a14', diep: '#11260a', rand: '#e0ffb0', oog: '#ff3dd2', motor: '#5ee7e0', gloed: '#b6ff3c' },
  geel: { licht: '#ffe28a', mid: '#d9a21a', donker: '#7a5608', diep: '#2b2208', rand: '#fff3b0', oog: '#ff4848', motor: '#5ee7e0', gloed: '#ffd23c' },
  blauw: { licht: '#8fd0ff', mid: '#3d7fd8', donker: '#1b3f8b', diep: '#0b1a3a', rand: '#cfeaff', oog: '#ffe14a', motor: '#ff3dd2', gloed: '#4aa3ff' },
  organisch: { licht: '#ffb36b', mid: '#e0662a', donker: '#7a2a12', diep: '#2e0f06', rand: '#ffd9b0', oog: '#b6ff3c', motor: '#b6ff3c', gloed: '#ff8a1a' },
  zwart: { licht: '#ff5df0', mid: '#8a1f8f', donker: '#2a0b30', diep: '#0d0410', rand: '#ff9af5', oog: '#5ee7e0', motor: '#5ee7e0', gloed: '#ff3dd2' },
}
const tex = {}
const maker = {
  teken(key, b, h, f, gloed, sterkte) {
    const pad = gloed ? 6 : 0
    const c = document.createElement('canvas'); c.width = Math.ceil((b + pad * 2) * R); c.height = Math.ceil((h + pad * 2) * R)
    const g = c.getContext('2d')
    if (gloed) {
      const o = document.createElement('canvas'); o.width = Math.ceil(b * R); o.height = Math.ceil(h * R)
      const og = o.getContext('2d'); og.scale(R, R); f(og, b, h)
      g.shadowColor = gloed; g.shadowBlur = (sterkte || 7) * R; g.drawImage(o, pad * R, pad * R)
      g.shadowBlur = 0; g.drawImage(o, pad * R, pad * R)
    } else { g.scale(R, R); f(g, b, h) }
    tex[key] = { c, b: b + pad * 2, h: h + pad * 2 }
  },
  sterrenLaag(key, n, maat, alpha, seed, kruis) {
    this.teken(key, 360, 640, g => {
      const r = rng(seed), KL = ['#ffffff', '#bfe6ff', '#ffd9f0', '#fff3b0']
      for (let i = 0; i < n; i++) {
        const x = r() * 360, y = r() * 640, m = maat * (0.5 + r()), k = KL[Math.floor(r() * 4)], a = alpha * (0.5 + r() * 0.5), glint = kruis && r() < 0.3
        g.globalAlpha = a; g.fillStyle = k; g.beginPath(); g.arc(x, y, m / 2, 0, 7); g.fill()
        if (glint) { g.globalAlpha = a * 0.6; g.fillRect(x - m * 2, y - 0.25, m * 4, 0.5); g.fillRect(x - 0.25, y - m * 2, 0.5, m * 4) }
      }
      g.globalAlpha = 1
    })
  },
  achtergrond_ruimte() {
    this.teken('ag_ruimte', 360, 640, g => { g.fillStyle = lin(g, 0, 0, 0, 640, ['#04020c', '#0a0620', '#120830']); g.fillRect(0, 0, 360, 640) })
    this.sterrenLaag('ag_st1', 220, 0.6, 0.45, 301)
    this.teken('ag_nevel3', 360, 960, g => {
      const r = rng(302), KL = [['rgba(255,61,210,.28)', 'rgba(255,61,210,0)'], ['rgba(80,120,255,.3)', 'rgba(80,120,255,0)'], ['rgba(177,60,255,.3)', 'rgba(177,60,255,0)'], ['rgba(94,231,224,.2)', 'rgba(94,231,224,0)']]
      for (let i = 0; i < 12; i++) { const x = r() * 360, y = r() * 960, rx = 60 + r() * 90, ry = rx * (0.5 + r() * 0.4); for (const dy of [-960, 0, 960]) wolk(g, x, y + dy, rx, ry, KL[i % 4]) }
    })
    this.teken('ag_planeet3', 360, 1400, g => {
      const x = 270, y = 420, r0 = 80
      g.fillStyle = rad(g, x - 30, y - 30, r0 * 1.3, ['#c28bff', '#6a3ab8', '#2a1250', '#0a0418']); g.beginPath(); g.arc(x, y, r0, 0, 7); g.fill()
      g.save(); g.beginPath(); g.arc(x, y, r0, 0, 7); g.clip()
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.06)' : 'rgba(40,10,80,.25)'; g.fillRect(x - r0, y - r0 + i * 28 + 8, r0 * 2, 12) }
      g.restore()
      g.save(); g.shadowColor = '#c28bff'; g.shadowBlur = 8 * R; g.strokeStyle = 'rgba(200,150,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r0 + 1, Math.PI * 0.9, Math.PI * 1.6); g.stroke(); g.restore()
    })
    this.sterrenLaag('ag_st2', 60, 1.4, 0.9, 303, true)
    this.teken('ag_strepen', 360, 640, g => { const r = rng(304); for (let i = 0; i < 14; i++) { const x = r() * 360, y = r() * 640, l = 20 + r() * 40; g.fillStyle = 'rgba(200,220,255,.35)'; g.fillRect(x, y, 0.7, l) } })
    return [{ key: 'ag_ruimte', vast: true, diepte: -60 }, { key: 'ag_st1', v: 10, diepte: -58 }, { key: 'ag_nevel3', v: 6, add: true, alpha: 0.9, diepte: -56 },
      { key: 'ag_planeet3', v: 14, diepte: -54 }, { key: 'ag_st2', v: 30, diepte: -52 }, { key: 'ag_strepen', v: 200, alpha: 0.5, add: true, diepte: -50 }]
  },
  vast() {
    for (const [key, K] of [['schip', { licht: '#ff5d9e', streep: '#5ee7e0', glas: ['#ffffff', '#8ff6ff', '#1aa7b8', '#0b3c48'], gloed: '#5ee7e0',
                                        vleugel: ['#3fb6c8', '#155a6b'], rand: '#a8f4ff', romp: ['#2f7a8c', '#dffbff', '#9fe6f0', '#2a6a7a'] }],
                            ['schip2', { licht: '#5ee7e0', streep: '#ff5d9e', glas: ['#ffffff', '#ffc2e0', '#d8337a', '#4a0b2a'], gloed: '#ff5d9e',
                                         vleugel: ['#d8478c', '#6e1640'], rand: '#ffc2e0', romp: ['#8c2f5c', '#ffe3f0', '#f0a3c6', '#7a2a50'] }]]) this.teken(key, 36, 44, g => {
      g.fillStyle = lin(g, 0, 16, 0, 36, K.vleugel)
      veelhoek(g, [14, 15, 2, 30, 1, 35, 6, 36, 14, 32]); g.fill()
      veelhoek(g, [22, 15, 34, 30, 35, 35, 30, 36, 22, 32]); g.fill()
      lijn(g, K.rand, 0.7, [14, 15, 2, 30]); lijn(g, K.rand, 0.7, [22, 15, 34, 30])
      g.fillStyle = K.licht; veelhoek(g, [4, 31, 7, 28, 8, 30, 5, 33]); g.fill(); veelhoek(g, [32, 31, 29, 28, 28, 30, 31, 33]); g.fill()
      g.fillStyle = K.streep; veelhoek(g, [9, 27, 13, 22, 13, 24, 10, 28]); g.fill(); veelhoek(g, [27, 27, 23, 22, 23, 24, 26, 28]); g.fill()
      g.fillStyle = lin(g, 8, 0, 15, 0, ['#2a303c', '#5e6a7e', '#2a303c']); rondRect(g, 8.5, 25, 6, 16, 2); g.fill()
      g.fillStyle = lin(g, 21, 0, 28, 0, ['#2a303c', '#5e6a7e', '#2a303c']); rondRect(g, 21.5, 25, 6, 16, 2); g.fill()
      g.fillStyle = '#12151c'; g.fillRect(9.5, 40, 4, 2.5); g.fillRect(22.5, 40, 4, 2.5)
      g.fillStyle = lin(g, 12, 0, 24, 0, K.romp)
      veelhoek(g, [18, 0, 21.5, 9, 23, 20, 23, 33, 21, 41, 15, 41, 13, 33, 13, 20, 14.5, 9]); g.fill()
      lijn(g, 'rgba(25,32,45,.75)', 0.5, [13.5, 22, 22.5, 22]); lijn(g, 'rgba(25,32,45,.75)', 0.5, [13.3, 30, 22.7, 30]); lijn(g, 'rgba(25,32,45,.6)', 0.5, [18, 24, 18, 40])
      g.fillStyle = rad(g, 17.2, 11, 6, K.glas); g.beginPath(); g.ellipse(18, 12, 2.7, 5.6, 0, 0, 7); g.fill()
      g.fillStyle = K.streep; g.fillRect(17.3, 31, 1.4, 7)
    }, K.gloed, 5)
    // vlammen: blauw voor speler 1 (vlam0/vlam1), roze voor speler 2 (vlam0b/vlam1b)
    for (const [achter, kl, gl] of [['', ['rgba(255,255,255,1)', 'rgba(150,240,255,.95)', 'rgba(70,150,255,.55)', 'rgba(60,90,255,0)'], '#4ab8ff'],
                                    ['b', ['rgba(255,255,255,1)', 'rgba(255,190,225,.95)', 'rgba(255,70,160,.55)', 'rgba(255,40,140,0)'], '#ff5d9e']]) {
      for (const [key, L] of [['vlam0', 10], ['vlam1', 15]]) {
        this.teken(key + achter, 36, 16, g => {
          for (const x of [11.5, 24.5]) {
            g.fillStyle = lin(g, 0, 0, 0, L, kl)
            g.beginPath(); g.ellipse(x, 0, 2.6, L, 0, 0, Math.PI); g.fill()
          }
        }, gl, 4)
      }
    }
    this.teken('puls', 4, 22, g => { g.fillStyle = lin(g, 0, 0, 0, 22, ['#ffffff', '#b8fdff', '#5ee7e0', 'rgba(94,231,224,0)']); rondRect(g, 0.4, 0, 3.2, 22, 1.6); g.fill() }, '#5ee7e0', 4)
  },
  vijanden(pn) {
    const p = PALET[pn], k = s => s + '_' + pn
    this.teken(k('dart'), 26, 28, g => {
      g.fillStyle = lin(g, 0, 0, 0, 28, [p.diep, p.donker])
      veelhoek(g, [0, 4, 9, 2, 13, 6, 17, 2, 26, 4, 22, 12, 13, 28, 4, 12]); g.fill()
      g.fillStyle = lin(g, 6, 0, 20, 0, [p.donker, p.licht, p.mid])
      veelhoek(g, [13, 4, 18, 10, 16, 20, 13, 27, 10, 20, 8, 10]); g.fill()
      lijn(g, p.rand, 0.6, [0, 4, 4, 12, 13, 28, 22, 12, 26, 4])
      g.fillStyle = rad(g, 13, 15, 3.6, ['#ffffff', p.oog, 'rgba(0,0,0,0)']); g.beginPath(); g.arc(13, 15, 3.6, 0, 7); g.fill()
      g.fillStyle = p.motor; g.fillRect(4, 2.5, 3, 1.5); g.fillRect(19, 2.5, 3, 1.5)
    }, p.gloed, 5)
  }
}
const lagen = maker.achtergrond_ruimte()
maker.vast()
maker.vijanden('rood'); maker.vijanden('zwart')
return { tex, lagen }
}

// ── Ghost Tag ──
export function maakEcto(resolutie) {
let ctx = null, tijd = 0, stippen = null
const VELDEN = [
  {
    naam: 'stad', muur: '#b44dff', binnen: '#150a26', achter: '#07030f',
    start: [[1, 1, 'R'], [17, 19, 'L']],
    kaart: [
    '###################', '#........#........#', '#.##.###.#.###.##.#', '#.................#',
    '#.##.#.#####.#.##.#', '#....#...#...#....#', '####.###.#.###.####', 'XXX#.#.......#.#XXX',
    '####.#.##.##.#.####', '........#X#........', '####.#.#####.#.####', 'XXX#.#.......#.#XXX',
    '####.#.#####.#.####', '#........#........#', '#.##.###.#.###.##.#', '#..#...........#..#',
    '##.#.#.#####.#.#.##', '#....#...#...#....#', '#.######.#.######.#', '#.................#',
    '###################',
    ],
  },
  {
    naam: 'riool', muur: '#3ddc84', binnen: '#0b1a12', achter: '#04100a',
    start: [[10, 5, 'R'], [6, 19, 'L']],
    kaart: [
    '###################', '#........#........#', '#.#####..#..#####.#', '#.#...#..#..#...#.#',
    '#...#.#.###.#.#...#', '###.#.#.....#.#.###', '#...#.###.###.#...#', '#.#...#.....#...#.#',
    '#.#.#####.#####.#.#', '....#.........#....', '#.#.#####.#####.#.#', '#.#.....#.#.....#.#',
    '#.#####.#.#.#####.#', '#.......#.#.......#', '#.#####.#.#.#####.#', '#.....#.#.#.#.....#',
    '###.#.#.#.#.#.#.###', '#...#...#.#...#...#', '#.#############.#.#', '#.................#',
    '###################',
    ],
  },
  {
    naam: 'tempel', muur: '#ffb347', binnen: '#241505', achter: '#0f0803',
    start: [[2, 1, 'R'], [14, 19, 'L']],
    kaart: [
    '###################', '#........#........#', '#.##.##..#..##.##.#', '#.................#',
    '#.##.#.#####.#.##.#', '#....#...#...#....#', '##.#.#.#.#.#.#.#.##', '#..#.#.#.#.#.#.#..#',
    '#.##...#...#...##.#', '.........#.........', '#.##...#...#...##.#', '#..#.#.#.#.#.#.#..#',
    '##.#.#.#.#.#.#.#.##', '#....#...#...#....#', '#.##.#.#####.#.##.#', '#.................#',
    '#.##.##..#..##.##.#', '#........#........#', '#.###.#######.###.#', '#.................#',
    '###################',
    ],
  },
  {
    naam: 'ijsgrot', muur: '#7aa2ff', binnen: '#0d1730', achter: '#04060f',
    start: [[13, 7, 'R'], [3, 19, 'L']],
    kaart: [
    '###################', '#.................#', '#.###.###.###.###.#', '#.#.....#.#.....#.#',
    '#.#.###.#.#.###.#.#', '#...#.....#...#...#', '###.#.###.#.#.#.###', '#...#...#.#...#...#',
    '#.#####.#.#.#####.#', '.......#...#.......', '#.#####.#.#.#####.#', '#...#...#.#...#...#',
    '###.#.###.#.#.#.###', '#...#.....#...#...#', '#.#.###.#.#.###.#.#', '#.#.....#.#.....#.#',
    '#.###.###.###.###.#', '#.................#', '#.##.##.###.##.##.#', '#.................#',
    '###################',
    ],
  },
]

let veldNr = 0
let KAART = VELDEN[0].kaart
let NEON = VELDEN[0].muur, MUURBINNEN = VELDEN[0].binnen, ACHTER = VELDEN[0].achter
let STARTPLEK = VELDEN[0].start

function zetVeld(n) {
  veldNr = ((n % VELDEN.length) + VELDEN.length) % VELDEN.length
  const v = VELDEN[veldNr]
  KAART = v.kaart; NEON = v.muur; MUURBINNEN = v.binnen; ACHTER = v.achter
  STARTPLEK = v.start
}

const RIJEN = KAART.length, KOLOM = KAART[0].length
const T = 16, HUD = 32
const W = KOLOM * T, H = RIJEN * T + HUD

const KLEUR = ['#5ff4ff', '#ff6bd6']
const BANG_BLAUW = '#2a38ff'
const ECTO = '#7dff6a'
const RICHT = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }
const TEGEN = { L: 'R', R: 'L', U: 'D', D: 'U' }
const SPOOK = ['.....####.....', '...########...', '..##########..', '.############.',
  '##############', '##############', '##############', '##############',
  '##############', '##############', '##############', '##############']
const KROON = ['#..#..#', '##.#.##', '#######', '#.#.#.#', '#######']
const wrapX = x => ((x % KOLOM) + KOLOM) % KOLOM
function isOpen(x, y) {
  if (y < 0 || y >= RIJEN) return false
  const c = KAART[y][wrapX(x)]
  return c !== '#' && c !== 'X'
}
function openZonderWrap(x, y) {
  if (x < 0 || x >= KOLOM || y < 0 || y >= RIJEN) return false
  const c = KAART[y][x]
  return c !== '#' && c !== 'X'
}
function kan(x, y, r) { const [dx, dy] = RICHT[r]; return isOpen(x + dx, y + dy) }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})` }
function meng(h1, h2, t) {
  const a = hexRgb(h1), b = hexRgb(h2)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
function pixels(g, rijen, x0, y0, u, kleur) {
  g.fillStyle = kleur
  rijen.forEach((rij, r) => {
    let c = 0
    while (c < rij.length) {
      if (rij[c] !== '#') { c++; continue }
      let e = c; while (e < rij.length && rij[e] === '#') e++
      g.fillRect(x0 + c * u, y0 + r * u, (e - c) * u + 0.05, u + 0.05)
      c = e
    }
  })
}
  let res = 1, doolhofLaag = null, stipBeeld = null, druppelBeeld = []
  let stippenLaag = null, stippenCtx = null, gloedBeelden = new Map()
  let laatsteMaat = ''

  function maakLaag(w, h) {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.ceil(w * res)); c.height = Math.max(1, Math.ceil(h * res))
    const g = c.getContext('2d'); g.setTransform(res, 0, 0, res, 0, 0)
    return [c, g]
  }

  function bouwDoolhof() {
    const [m, mg] = maakLaag(W, RIJEN * T)
    let z = 7
    const r2 = () => (z = (z * 16807) % 2147483647) / 2147483647
    const d = 2
    for (let y = 0; y < RIJEN; y++) for (let x = 0; x < KOLOM; x++) {
      if (KAART[y][x] !== '#') continue
      const px = x * T, py = y * T
      const l = openZonderWrap(x - 1, y), r = openZonderWrap(x + 1, y)
      const o = openZonderWrap(x, y - 1), b = openZonderWrap(x, y + 1)
      mg.fillStyle = NEON; mg.fillRect(px, py, T, T)
      mg.fillStyle = MUURBINNEN
      mg.fillRect(px + (l ? d : 0), py + (o ? d : 0), T - (l ? d : 0) - (r ? d : 0), T - (o ? d : 0) - (b ? d : 0))
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (openZonderWrap(x + dx, y + dy) && !openZonderWrap(x + dx, y) && !openZonderWrap(x, y + dy)) {
          mg.fillStyle = NEON; mg.fillRect(dx < 0 ? px : px + T - d, dy < 0 ? py : py + T - d, d, d)
        }
      }
      mg.fillStyle = 'rgba(180,77,255,0.12)'
      if (r2() < 0.55) mg.fillRect(px + 4 + Math.floor(r2() * 7), py + 4 + Math.floor(r2() * 8), 3, 1)
      if (r2() < 0.25) mg.fillRect(px + 4 + Math.floor(r2() * 8), py + 4 + Math.floor(r2() * 8), 1, 1)
    }
    const [c, g] = maakLaag(W, RIJEN * T)
    g.shadowColor = NEON; g.shadowBlur = 7 * res
    g.drawImage(m, 0, 0, W, RIJEN * T)
    g.shadowBlur = 0
    g.drawImage(m, 0, 0, W, RIJEN * T)
    doolhofLaag = c
  }

  function bouwSprites() {
    const [c, g] = maakLaag(10, 10)
    const gr = g.createRadialGradient(5, 5, 0, 5, 5, 5)
    gr.addColorStop(0, rgba(ECTO, 0.6)); gr.addColorStop(1, rgba(ECTO, 0))
    g.fillStyle = gr; g.fillRect(0, 0, 10, 10)
    g.fillStyle = ECTO; g.fillRect(4.5, 3.2, 1, 1); g.fillRect(4, 4.2, 2, 2.2)
    g.fillStyle = '#eaffe4'; g.fillRect(4.3, 4.6, 0.8, 0.8)
    stipBeeld = c
    druppelBeeld = KLEUR.map(kl => {
      const [c2, g2] = maakLaag(8, 8)
      const gr2 = g2.createRadialGradient(4, 4.5, 0, 4, 4.5, 4)
      gr2.addColorStop(0, rgba(kl, 0.7)); gr2.addColorStop(1, rgba(kl, 0))
      g2.fillStyle = gr2; g2.fillRect(0, 0, 8, 8)
      g2.fillStyle = kl
      g2.fillRect(3.5, 1.5, 1, 1); g2.fillRect(3, 2.5, 2, 1); g2.fillRect(2.5, 3.5, 3, 2); g2.fillRect(3, 5.5, 2, 1)
      g2.fillStyle = '#ffffff'; g2.fillRect(3.1, 3.7, 0.8, 0.8)
      return c2
    })
    gloedBeelden = new Map()
  }

  // Alle stippen staan in één laag. Een opgegeten stip wordt uit die laag
  // gewist; dat is veel lichter dan er tweehonderd per beeldje tekenen.
  function bouwStippen() {
    const [c, g] = maakLaag(W, RIJEN * T)
    stippenLaag = c; stippenCtx = g
    if (!stippen) return
    for (let i = 0; i < stippen.length; i++) {
      if (!stippen[i]) continue
      const x = i % KOLOM, y = (i / KOLOM) | 0
      g.drawImage(stipBeeld, x * T + 3, y * T + 3, 10, 10)
    }
  }

  function wisStip(x, y) {
    if (stippenCtx) stippenCtx.clearRect(x * T, y * T, T, T)
  }

  // De gloed om een spookje is een vast plaatje per kleur, niet elk beeldje opnieuw.
  function gloed(kleur) {
    let b = gloedBeelden.get(kleur)
    if (!b) {
      const [c, g] = maakLaag(64, 64)
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, rgba(kleur, 0.4)); gr.addColorStop(1, rgba(kleur, 0))
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
      b = c; gloedBeelden.set(kleur, b)
    }
    return b
  }

  // fase laat de rok deinen; gezicht is 'normaal', 'boos' of 'bang'
  function tekenFiguur(g, cx, cy, u, kleur, gezicht, kijk, fase, alpha = 1, wit = false) {
    const x0 = cx - 7 * u, y0 = cy - 7.5 * u
    g.save()
    g.globalAlpha = alpha
    g.drawImage(gloed(kleur), cx - 13 * u, cy - 13 * u, 26 * u, 26 * u)
    const lijf = wit ? '#ffffff' : kleur
    const px = (x, y, w = 1, h = 1) => g.fillRect(x0 + x * u, y0 + y * u, w * u + 0.05, h * u + 0.05)
    pixels(g, SPOOK, x0, y0, u, lijf)
    g.fillStyle = lijf
    px(-1, 6, 1, 2); px(14, 6, 1, 2)                       // armpjes
    for (let c = 0; c < 14; c++) {                          // deinende rok
      const laag = 1.7 + Math.sin(c * 0.85 + fase) * 1.4
      px(c, 12, 1, Math.max(0.2, laag))
    }
    if (gezicht === 'bang') {
      g.fillStyle = '#ffffff'; px(2, 4, 3, 3); px(9, 4, 3, 3)
      g.fillStyle = '#1b1245'; px(3, 5); px(10, 5)
      for (let i = 0; i < 8; i++) px(3 + i, i % 2 ? 8 : 9)   // zigzagmondje
    } else if (gezicht === 'boos') {
      g.fillStyle = '#ffffff'; px(2, 4, 4, 4); px(8, 4, 4, 4)
      const [dx, dy] = RICHT[kijk] || [0, 1]
      const ox = dx < 0 ? 0 : dx > 0 ? 2 : 1, oy = dy < 0 ? 0 : dy > 0 ? 2 : 1
      g.fillStyle = '#ff2a2a'; px(2 + ox, 4 + oy, 2, 2); px(8 + ox, 4 + oy, 2, 2)
      g.fillStyle = '#2a0014'
      px(1, 2, 2, 1); px(3, 3, 2, 1); px(11, 2, 2, 1); px(9, 3, 2, 1)   // boze wenkbrauwen
      px(4, 9, 6, 2)                                                     // grijns
      g.fillStyle = '#ffffff'; px(4, 9); px(6, 9); px(8, 9); px(5, 10); px(7, 10); px(9, 10)
    } else {
      g.fillStyle = '#ffffff'; px(2, 3, 4, 5); px(8, 3, 4, 5)
      const [dx, dy] = RICHT[kijk] || [0, 1]
      const ox = dx < 0 ? 0 : dx > 0 ? 2 : 1, oy = dy < 0 ? 0 : dy > 0 ? 3 : 1.5
      g.fillStyle = '#1b1245'; px(2 + ox, 3 + oy, 2, 2); px(8 + ox, 3 + oy, 2, 2)
      g.fillStyle = 'rgba(255,255,255,0.85)'; px(2 + ox, 3 + oy, 0.7, 0.7); px(8 + ox, 3 + oy, 0.7, 0.7)
      g.fillStyle = rgba('#ff6b9d', 0.5); px(0, 8, 2, 1); px(12, 8, 2, 1)   // blosjes
      g.fillStyle = '#1b1245'; px(6, 9, 2, 2)                                // mondje
    }
    g.restore()
  }

  function tekenKroon(cx, cy, u) {
    const x0 = cx - 3.5 * u, y0 = cy - 2.5 * u
    ctx.save()
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8 * res
    pixels(ctx, KROON, x0, y0, u, '#ffd23f')
    ctx.shadowBlur = 0
    ctx.fillStyle = '#ff3b6b'
    for (const x of [1, 3, 5]) ctx.fillRect(x0 + x * u, y0 + 3 * u, u, u)
    ctx.restore()
  }

  function tekenBol(cx, cy, s = 1) {
    const p = 1 + 0.15 * Math.sin(tijd * 6)
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12 * p * s)
    gr.addColorStop(0, rgba(ECTO, 0.75)); gr.addColorStop(0.45, rgba(ECTO, 0.3)); gr.addColorStop(1, rgba(ECTO, 0))
    ctx.fillStyle = gr; ctx.fillRect(cx - 13 * s, cy - 13 * s, 26 * s, 26 * s)
    ctx.fillStyle = ECTO
    ctx.beginPath(); ctx.arc(cx, cy, 4.2 * p * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f2ffe9'; ctx.fillRect(cx - 2 * s, cy - 2.5 * s, 1.6 * s, 1.6 * s)
    for (let n = 0; n < 3; n++) {
      const h = tijd * 3 + n * 2.094
      ctx.fillStyle = rgba(ECTO, 0.9)
      ctx.fillRect(cx + Math.cos(h) * 8 * s - 0.75, cy + Math.sin(h) * 8 * s - 0.75, 1.5, 1.5)
    }
  }

res = resolutie || 2
return {
  KAART, KOLOM, RIJEN, T, W, KLEUR, BANG_BLAUW, CFG: { jagerGroot: 1.4 }, openZonderWrap, meng,
  zet(c, t) { ctx = c; tijd = t },
  bouw(nieuweStippen) { stippen = nieuweStippen; bouwDoolhof(); bouwSprites(); bouwStippen() },
  wisStip, tekenFiguur, tekenBol,
  get doolhof() { return doolhofLaag }, get stippenLaag() { return stippenLaag }
}
}
