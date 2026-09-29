// swarm-ui.js - The Swarm voor Fibro: samen tegen de zwerm (2 spelers).
// Speler 1 rekent het spel uit en stuurt de stand (sw-st); speler 2 stuurt positie en schoten (sw-in)
// en knoppen (sw-cmd). Het spel start pas als allebei op dezelfde knop hebben gedrukt.
// Geluiden: geluid/swarm/<naam>.wav (vervangbaar door eigen opnames); anders ingebouwde klanken. Tekent zichzelf in #spelInhoud via het spelkanaal van chat.html.

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
vriendNaam = vriendNaam || 'vriend'
isActief = isActief || (() => true)
const HOST = !!benIkSpeler1
document.getElementById('spelTitelBar').textContent = '\u{1FAB2} The Swarm'
const inhoud = document.getElementById('spelInhoud')
const BREED = 'min(94vw, calc((100vh - 190px) * 0.6667), 360px)'
inhoud.innerHTML = `
<style>@keyframes swdrup{0%{transform:scaleY(.35)}60%{transform:scaleY(1)}100%{transform:scaleY(.35)}}</style>
<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;width:${BREED};color:white;font-size:12px;box-sizing:border-box;">
    <span><span style="color:${HOST ? '#2ee8ff' : '#ff9a1f'};">&#9679;</span> Jij: <b id="sw-mij">0</b></span>
    <span id="sw-lv" style="color:var(--accent);text-align:center;"></span>
    <span><b id="sw-vr">0</b> :<span id="sw-vnaam"></span> <span style="color:${HOST ? '#ff9a1f' : '#2ee8ff'};">&#9679;</span></span>
    <button id="sw-snd" style="background:none;border:none;font-size:16px;cursor:pointer;padding:0 2px;">\u{1F50A}</button>
  </div>
  <div style="position:relative;width:${BREED};aspect-ratio:2/3;border-radius:10px;overflow:hidden;background:#15101c;border:2px solid rgba(255,255,255,0.15);">
    <canvas id="sw-canvas" width="140" height="210" style="width:100%;height:100%;display:block;image-rendering:pixelated;touch-action:none;"></canvas>
    <div style="position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,0.3) 0 1px,transparent 1px 3px);"></div>
    <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,0.55) 100%);"></div>
    <div id="sw-msg" style="position:absolute;left:0;right:0;top:36%;text-align:center;pointer-events:none;font-family:'Courier New',monospace;font-weight:bold;color:#ff5070;text-shadow:0 0 6px #ff2040,0 0 14px #ff2040;font-size:17px;letter-spacing:1px;padding:0 10px;line-height:1.3;"></div>
    <div id="sw-titel" style="position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(0,0,0,0.35);font-family:'Courier New',monospace;text-align:center;">
      <div style="font-size:15px;font-weight:900;letter-spacing:8px;color:#ff3050;text-shadow:0 0 6px #ff1030,0 0 16px #ff1030;">THE</div>
      <div style="position:relative;font-size:42px;font-weight:900;letter-spacing:4px;color:#b6ff3a;text-shadow:0 0 4px #6dff1a,0 0 16px #3a9a00,0 3px 0 #1a4a00;line-height:1;">SWARM<div id="sw-drup" style="position:absolute;left:6px;right:6px;top:92%;height:20px;"></div></div>
      <div style="margin:16px 0 4px;font-size:12px;color:#ffb0c0;letter-spacing:1px;">samen tegen de zwerm</div>
      <button id="sw-verhaal" style="font-family:'Courier New',monospace;font-weight:bold;font-size:15px;padding:9px 18px;border-radius:8px;min-width:200px;cursor:pointer;background:rgba(20,0,10,0.75);border:2px solid #8dff2a;color:#b6ff3a;box-shadow:0 0 10px rgba(141,255,42,0.4);">&#9654; Verhaal &middot; 5 levels</button>
      <button id="sw-eindeloos" style="font-family:'Courier New',monospace;font-weight:bold;font-size:15px;padding:9px 18px;border-radius:8px;min-width:200px;cursor:pointer;background:rgba(20,0,10,0.75);border:2px solid #ff3050;color:#ff8098;box-shadow:0 0 10px rgba(255,48,80,0.4);">&#8734; Eindeloos</button>
      <div id="sw-klaar" style="font-size:12px;color:#ffe060;max-width:88%;min-height:32px;line-height:1.35;"></div>
    </div>
    <div id="sw-eind" style="position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,0,0.65);color:white;font-family:'Courier New',monospace;font-weight:bold;text-align:center;font-size:13px;">
      <div id="sw-eind-tekst"></div>
      <div id="sw-klaar2" style="font-size:12px;color:#ffe060;max-width:88%;"></div>
      <button id="sw-verder" style="font-family:'Courier New',monospace;font-weight:bold;font-size:15px;padding:9px 18px;border-radius:8px;min-width:200px;cursor:pointer;background:rgba(20,0,10,0.75);border:2px solid #ff3050;color:#ff8098;display:none;">&#8734; Door: eindeloos</button>
      <button id="sw-opnieuw" style="background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:700;cursor:pointer;">&#8635; Naar het titelscherm</button>
    </div>
  </div>
  <div style="color:rgba(255,255,255,0.4);font-size:11px;">Veeg om te lopen &middot; tik om te schieten &middot; red je maatje door bij hem te staan</div>
</div>`
document.getElementById('sw-vnaam').textContent = vriendNaam
;(() => { const d = document.getElementById('sw-drup'); for (let i = 0; i < 13; i++) { const s = document.createElement('span'); s.style.cssText = 'position:absolute;top:0;left:' + (i * 7.8 + Math.random() * 3) + '%;width:3px;height:' + (5 + Math.random() * 15) + 'px;background:linear-gradient(#b6ff3a,#3a9a00);border-radius:0 0 3px 3px;transform-origin:top;animation:swdrup ' + (1.6 + Math.random() * 2.4) + 's ease-in-out ' + (Math.random() * 2) + 's infinite;box-shadow:0 0 4px #6dff1a;'; d.appendChild(s) } })()
const D=document,W=140,H=210;
const cv=D.getElementById('sw-canvas'),ctx=cv.getContext('2d');
const R=(a,b)=>a+Math.random()*(b-a),CL=(v,a,b)=>v<a?a:v>b?b:v,RI=a=>a[Math.random()*a.length|0];
const WP=new Proxy({},{get:()=>'#ffffff'});
function mk(w,h){const c=D.createElement('canvas');c.width=w;c.height=h;return c}
function sprite(rows,pal,glow,gb){const w=rows[0].length,h=rows.length,p=4;const b=mk(w+2*p,h+2*p),q=b.getContext('2d');
rows.forEach((r,y)=>{for(let i=0;i<w;i++){const ch=r[i];if(ch!=='.'){q.fillStyle=pal[ch];q.fillRect(i+p,y+p,1,1)}}});
const g=mk(b.width,b.height),gq=g.getContext('2d');
if(glow){gq.shadowColor=glow;gq.shadowBlur=gb||3;gq.drawImage(b,0,0);gq.drawImage(b,0,0);gq.shadowBlur=(gb||3)+2;gq.drawImage(b,0,0)}
return{b,g,w,h,p}}
function draw(s,x,y,ga){const X=Math.round(x-s.w/2-s.p),Y=Math.round(y-s.h/2-s.p);if(ga>0){ctx.globalAlpha=Math.min(1,ga);ctx.drawImage(s.g,X,Y);ctx.globalAlpha=1}ctx.drawImage(s.b,X,Y)}
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
function bgHut(FL){const b=mk(W,H),q=b.getContext('2d');
q.fillStyle='#1a0e08';q.fillRect(0,0,W,FL);for(let y=0;y<FL;y+=7){q.fillStyle='#3a2414';q.fillRect(0,y+1,W,5);q.fillStyle='#5a3a20';q.fillRect(0,y+1,W,1);q.fillStyle='#2a180c';q.fillRect(0,y+5,W,1);for(let x=(y*3)%11;x<W;x+=23)q.fillRect(x,y+2,1,2)}
q.fillStyle='#2a180c';q.fillRect(88,18,36,44);q.fillStyle='#141c28';q.fillRect(90,20,32,40);q.fillStyle='#2a3444';for(let y=40;y<60;y+=3)q.fillRect(90,y,32,1);
q.fillStyle='#d8d8c8';for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++)if(x*x+y*y<=16)q.fillRect(112+x,30+y,1,1);
q.fillStyle='#06080c';for(let y=34;y<60;y++){q.fillRect(96+Math.round(Math.sin(y*.3)),y,1,1);q.fillRect(116,y+2>59?59:y+2,1,1)}
q.fillStyle='#2a180c';q.fillRect(105,20,2,40);q.fillRect(90,38,32,2);
q.fillStyle='#4a2a14';q.fillRect(6,62,48,3);q.fillStyle='#2a180c';q.fillRect(8,65,2,6);q.fillRect(50,65,2,6);
q.fillStyle='#e8e0c0';q.fillRect(18,54,3,8);q.fillStyle='#4a3020';q.fillRect(34,53,12,9);q.fillStyle='#6a4a30';q.fillRect(35,54,10,7);q.fillStyle='#c8b8a0';q.fillRect(39,56,2,3);
q.fillStyle='#20140a';q.fillRect(0,FL,W,H-FL);q.fillStyle='#140c06';
for(let k=-10;k<=10;k++){const x0=W/2+k*7,x1=W/2+k*20;for(let y=FL;y<H;y++)q.fillRect(Math.round(x0+(x1-x0)*(y-FL)/(H-FL)),y,1,1)}
q.fillStyle='#2a180c';q.fillRect(0,FL,W,1);return b}
function bgAnder(FL){const b=mk(W,H),q=b.getContext('2d');
const g=q.createLinearGradient(0,0,0,FL);g.addColorStop(0,'#08000a');g.addColorStop(1,'#4a0818');q.fillStyle=g;q.fillRect(0,0,W,FL);
q.fillStyle='#140810';let yy=80;for(let x=0;x<W;x++){if(x%6===0)yy=CL(yy+R(-8,8),60,100);q.fillRect(x,yy,1,FL-yy)}
q.fillStyle='#2a0a20';for(let v=0;v<7;v++){const vx=R(5,W-5),len=R(15,55);for(let y=0;y<len;y++)q.fillRect(Math.round(vx+Math.sin(y*.25+v)*2),y,1,1)}
q.fillStyle='#0e0610';q.fillRect(0,FL,W,H-FL);q.fillStyle='#8a0020';
for(let c=0;c<9;c++){let x=R(0,W),y=FL+R(4,H-FL-4);for(let i=0;i<14;i++){q.fillRect(Math.round(x),Math.round(y),1,1);x+=R(-1.2,1.2);y+=R(-.5,1)}}
q.fillStyle='#3a0818';q.fillRect(0,FL,W,1);return b}
const MA=["dd.........dd","dDdd.....ddDd","dDoDd.f.dDoDd","ddeddfffddedd",".dddfEfEfddd.","..ddfffffdd..","....fafaf....",".....a.a....."];
const MB=["...dd...dd...","..dDd...dDd..",".dDoDdfdDoDd.",".ddeddfddedd.","..ddfEfEfdd..","...dfffffd...","....fafaf....",".....a.a....."];
const KA=["l.l.....l.l",".l.l...l.l.","..lbbbbbl..","l.bbcbcbb.l",".lbeEbEebl.","l.bbbbbbb.l","..lbmbmbl..",".l..mSm..l.","l.........l"];
const KB=[".l.l...l.l.","l.l.....l.l","..lbbbbbl..","l.bbcbcbb.l",".lbeEbEebl.","l.bbbbbbb.l","..lbmbmbl..",".l..mSm..l.",".l.......l."];
const TA=["...l...l...","....aaa....","..abbbbba..",".abVbbbVba.","labbbVbbbal",".abbbbbbba.","l.affffa.l.","..fEeEeEf..","l..fmSmf..l","....S.S...."];
const TB=["..l.....l..","....aaa....","..abbbbba..",".abVbbbVba.",".abbbVbbba.",".abbbbbbba.","l.affffa.l.","..fEeEeEf..","l..fmSmf..l","....S.S...."];
const PI={a:'#2a1030',b:'#7a3060',c:'#b060a0',f:'#5a3420',F:'#3a2010',E:'#5a0010',e:'#ff2a3a',m:'#e0d8a8',S:'#8dff2a',V:'#6dff1a',o:'#e8d890',w:'rgba(190,230,255,0.55)',l:'#4a2838',d:'#6a5a4a',D:'#3a3028'};
const GC='#6dff1a';
const ICEP=new Proxy({},{get:()=>'#a0e8ff'}),REDP=new Proxy({},{get:()=>'#ff2040'});
function bugT(A,B,o,pal,gl){const P=Object.assign({},PI,pal||{});return Object.assign({A:sprite(A,P,gl||GC),B:sprite(B,P,gl||GC),Wt:sprite(A,WP),Ic:sprite(A,ICEP)},o)}
const TY={sp:bugT(SA,SB,{rx:7,ry:6,mx:1.4,cm:1.9,hb:12,top:9,hp:4}),hg:bugT(HA,HB,{rx:4,ry:4,mx:2.2,cm:2.8,hb:7,top:6,hp:2}),
ws:bugT(WA,WB,{rx:5,ry:7,mx:1.8,cm:2.4,hb:9,top:10,hp:3}),br:bugT(mir(BL),mir(BLb),{rx:10,ry:9,mx:1,cm:1.3,hb:18,top:11,hp:9}),
mt:bugT(MA,MB,{rx:6,ry:4,mx:1,cm:1.5,hb:11,top:6,hp:3},{f:'#8a7a5a',a:'#4a3a2a'},'#d0ff60'),
kv:bugT(KA,KB,{rx:5,ry:5,mx:1.6,cm:2.2,hb:9,top:7,hp:3},{b:'#2a1a2a',c:'#6a4a6a',l:'#5a4a5a'},'#c040ff'),
sl:bugT(TA,TB,{rx:5,ry:5,mx:1.3,cm:1.8,hb:9,top:7,hp:4},{b:'#5a6a20',V:'#d0ff40'},'#b0ff30')};
const IC={hp:sprite([".rr.rr.","rrrrrrr","rrrrrrr",".rrrrr.","..rrr..","...r..."],{r:'#ff3050'},'#ff3050',2),
vlam:sprite(["...y...","..yoy..",".yoOoy.",".oOrOo.","oOrrrOo",".orrro.","..ooo.."],{y:'#fff080',o:'#ff9a1f',O:'#ffcf40',r:'#ff3a10'},'#ff7a10',2),
hagel:sprite([".r.r.r.",".r.r.r.",".r.r.r.",".r.r.r.",".y.y.y.",".y.y.y."],{r:'#d02020',y:'#e8c040'},'#ffb040',2),
snel:sprite(["...yy..","..yy...",".yyyyy.","...yy..","..yy...",".yy....","y......"],{y:'#ffff60'},'#ffff60',2),
schild:sprite([".bbbbb.","bBBBBBb","bBwBBBb","bBBBBBb",".bBBBb.","..bBb..","...b..."],{b:'#2060c0',B:'#60b0ff',w:'#ffffff'},'#60b0ff',2),
ijs:sprite(["...w...",".w.w.w.","..www..","wwwwwww","..www..",".w.w.w.","...w..."],{w:'#a0e8ff'},'#a0e8ff',2),
stuiter:sprite(["..ooo..",".oOOOo.","oOOwOOo","oOOOOOo","oOOOOOo",".oOOOo.","..ooo.."],{o:'#c05010',O:'#ff9030',w:'#ffffff'},'#ff9030',2),
drone:sprite(["r.....r","rr...rr",".rgggr.","..gWg..",".ggggg.","g.....g"],{r:'#9aa0b0',g:'#5a6070',W:'#ff3040'},'#ff3040',2)};
const MH=sprite(["rr.rr","rrrrr",".rrr.","..r.."],{r:'#ff3050'}),MHe=sprite(["rr.rr","rrrrr",".rrr.","..r.."],{r:'#3a1018'});
const HEROPAL=[{h:'#e8c040',s:'#f0b890',j:'#b8a070',k:'#3a2a18',P:'#4a4a5a',p:'#8a8a9a',L:'#2ee8ff',g:'#b0b8c8',t:'#2a2a30',W:'#ffffff'},{h:'#4a2210',s:'#d8a078',j:'#4a5a8a',k:'#2a2a3a',P:'#4a4a5a',p:'#8a8a9a',L:'#ff9a1f',g:'#b0b8c8',t:'#2a2a30',W:'#ffffff'}];
const heroS=i=>({A:sprite(HT.concat(HLa),HEROPAL[i],HEROPAL[i].L,2),B:sprite(HT.concat(HLb),HEROPAL[i],HEROPAL[i].L,2)});
function segD(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=CL(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy)}
const BW=57,BH=42,BC=28;
function bossPx(x,y,fr,C){const cx=BC,mx=Math.abs(x-cx);
if(y>=33&&y<=39&&mx===[6,6,5,5,4,4,5][y-33])return'm';
if(x===cx&&y>=33&&y<=38-fr)return'S';if(mx===1&&y===34)return'S';
const hd=((x-cx)/10)**2+((y-27)/7)**2;
if(hd<=1){for(const[dx,dy,r]of C.eyes)if((x-cx-dx)**2+(y-dy)**2<=r*r)return r>=2?((x+y)%2?'e':'E'):'e';return(x*3+y*5)%7===0?'F':'f'}
const[arx,ary,acy]=C.ab,ab=((x-cx)/arx)**2+((y-acy)/ary)**2;
if(ab<=1){for(const[ex,ey]of[[-6,-4],[6,-2],[0,-8],[-3,4],[4,5]])if((x-cx-ex)**2+(y-acy-ey)**2<=2)return'o';
if(Math.abs(Math.sin(x*.45+y*.35+fr*.6))<(C.veins||.1)&&ab<.85)return'V';if(ab>.85)return'a';if(x<cx-4&&y<acy-3&&ab<.7)return'c';return((y+fr)>>1)%2?'a':'b'}
for(const s of[-1,1])for(let i=0;i<C.legs;i++){const L=C.ll,ax=cx+s*9,ay=22+i*3,bx=cx+s*(17+i*2)*L,by=24+i*4+(fr&&i%2?2:0),ex=cx+s*(19+i*2)*L,ey=33+i*2+(fr&&!(i%2)?1:0);if(segD(x,y,ax,ay,bx,by)<.6||segD(x,y,bx,by,ex,ey)<.6)return'l'}
if(C.wing){const[wrx,wry,,wy]=C.wing;for(const s of[-1,1]){const wx=cx+s*(arx+wrx*.55),dd=((x-wx)/wrx)**2+((y-wy-fr*3)/wry)**2;if(dd<=1){if(C.spot){const sd=Math.hypot(x-wx,y-wy-fr*3);if(sd<1.5)return'e';if(sd<3)return'o'}return dd>.8?'D':'w'}}}return'.'}
function bossRows(fr,C){const g=[];for(let y=0;y<BH;y++){let r='';for(let x=0;x<BW;x++)r+=bossPx(x,y,fr,C);g.push(r)}return g}
const BOSSES=[
{n:'Koningin',ab:[16,12,12],wing:[7,4,0,11],eyes:[[-5,26,3],[5,26,3],[-8,30,1.4],[8,30,1.4]],legs:3,ll:1,pal:{},glow:GC,att:['waaier','angels','broed'],att2:['ring']},
{n:'Wespenkoning',ab:[10,15,15],wing:[9,5,0,10],eyes:[[-5,26,3.5],[5,26,3.5]],legs:3,ll:.85,pal:{a:'#2a1a05',b:'#d89a10',c:'#ffd060',V:'#ff6a1a',o:'#fff0b0'},glow:'#ffb01a',att:['duik','angels','broed'],att2:['waaier']},
{n:'Spinnenmoeder',ab:[17,13,12],eyes:[[-4,25,2],[4,25,2],[-7,28,1.5],[7,28,1.5],[-2,29,1.2],[2,29,1.2],[-6,24,1.2],[6,24,1.2]],legs:4,ll:1.3,pal:{a:'#10080e',b:'#3a2030',c:'#6a4060',V:'#c040ff',o:'#e0c0ff'},glow:'#c040ff',att:['web','broed','waaier'],att2:['duik']},
{n:'Motvorst',ab:[9,10,14],wing:[12,10,0,12],spot:1,eyes:[[-5,26,3],[5,26,3]],legs:3,ll:.9,pal:{a:'#2a2018',b:'#6a5a40',c:'#a89070',V:'#b0ff60',o:'#e8d890',w:'rgba(150,130,100,0.85)',D:'#4a3a28'},glow:'#b0ff60',att:['gif','ring','broed'],att2:['angels','web']},
{n:'Zwermhart',ab:[16,14,12],eyes:[[-6,26,2],[0,24,2.5],[6,26,2],[-4,30,1.5],[4,30,1.5]],legs:3,ll:1.1,veins:.22,pal:{a:'#1a0010',b:'#8a0020',c:'#ff4060',V:'#ff2040',o:'#ff90a0',f:'#3a0a1a'},glow:'#ff2040',att:['ring','waaier','duik','broed'],att2:['gif','web','angels']}];
BOSSES.forEach(C=>{const P=Object.assign({},PI,C.pal),r0=bossRows(0,C);C.A=sprite(r0,P,C.glow,4);C.B=sprite(bossRows(1,C),P,C.glow,4);C.Wt=sprite(r0,WP);C.Rd=sprite(r0,REDP)});
const trash=(x,y)=>{if(y<=2){if(y===0)return x>=6&&x<=9?'#5a5a60':null;return'#8a8a92'}if(x===0||x===15)return'#3a3a40';if(y>=18&&x>=5&&x<=7)return'#4a4a50';return x%3===0?'#4a4a52':'#6a6a74'};
const pipe=(x,y)=>{if((y===4||y===5||y===18||y===19)&&x>=1&&x<=12)return y%2?'#2a3a2a':'#3a4a3a';if(x<3||x>10)return null;if(y>=22&&x===6)return'#8dff2a';if(x===4)return'#7a9a7a';return x>8?'#2a3a2a':'#4a6a4a'};
const comp=(x,y)=>{if(x===0||x===19||y===0||y===25)return'#3a3a42';for(const cx of[6,13]){const d=Math.hypot(x-cx,y-7);if(d<=3.5)return d<1?'#c0c0c8':d>2.6?'#c0c0c8':'#2a2a30'}if(y===15||y===16){if(x>=3&&x<=16)return['#ff3040','#40ff60','#ffd040','#3a3a42'][(x+y)%4]}if(y>=19&&y<=23)return y%2?'#4a4a52':'#7a7a82';return'#8a8a92'};
const mcrate=(x,y)=>{if(x===0||x===19||y===0||y===21)return'#3a4048';if((x===2||x===17)&&(y===2||y===19))return'#b0b8c0';if(y>=9&&y<=11)return(x+y)%4<2?'#d8b020':'#1a1a1a';return x%5===0?'#4a5058':'#5a6068'};
const COV={plant:[plant,18,32],tv:[tv,20,26],crate:[crate(20,24),20,24],barrel:[barrel,16,24],logs:[logs,24,24],stump:[stump,18,24],rock:[rock,20,26],trash:[trash,16,22],pipe:[pipe,14,26],comp:[comp,20,26],mcrate:[mcrate,20,22]};
function bgRiool(FL){const b=mk(W,H),q=b.getContext('2d');
for(let y=0;y<FL;y+=5){for(let x=-((y/5|0)%2)*5;x<W;x+=10){q.fillStyle=((x*3+y)%7)?'#2e2e24':'#383828';q.fillRect(x,y,9,4)}q.fillStyle='#1a1a14';q.fillRect(0,y+4,W,1)}
q.fillStyle='#0a0c08';for(let y=30;y<FL;y++){const hw=Math.round(28*Math.sqrt(Math.max(0,1-((y-FL)/(FL-30))**2)));q.fillRect(W/2-hw,y,hw*2,1)}
q.fillStyle='#3a4a3a';q.fillRect(0,18,W,4);q.fillStyle='#4a6a4a';q.fillRect(0,18,W,1);q.fillStyle='#2a3a2a';for(let x=10;x<W;x+=30)q.fillRect(x,16,3,8);
q.fillStyle='#1e2018';q.fillRect(0,FL,W,H-FL);q.fillStyle='#2a2c22';for(let y=FL+2;y<H;y+=6)q.fillRect(0,y,W,1);
q.fillStyle='#1a3a14';q.fillRect(0,FL+8,W,12);q.fillStyle='#10200c';q.fillRect(0,FL+7,W,1);q.fillRect(0,FL+20,W,1);return b}
function bgLab(FL){const b=mk(W,H),q=b.getContext('2d');
q.fillStyle='#1c2226';q.fillRect(0,0,W,FL);q.fillStyle='#262e34';for(let y=0;y<FL;y+=8)q.fillRect(0,y,W,1);for(let x=0;x<W;x+=8)q.fillRect(x,0,1,FL);
for(const tx of[8,110]){q.fillStyle='#3a4448';q.fillRect(tx,26,22,4);q.fillRect(tx,88,22,6);q.fillStyle='#0c2a2a';q.fillRect(tx+2,30,18,58);q.fillStyle='#1a6a4a';q.fillRect(tx+2,42,18,46);q.fillStyle='#0a2a1c';
for(let y=50;y<84;y++){const w=y<58?Math.round(3+(y-50)/2):y<74?7:5;q.fillRect(tx+11-w/2|0,y,w,1)}q.fillStyle='#8adfc0';q.fillRect(tx+3,31,1,56)}
for(let x=0;x<W;x++){q.fillStyle=(x>>2)%2?'#d8b020':'#1a1a1a';q.fillRect(x,100,1,5)}
q.fillStyle='#141a1e';q.fillRect(0,FL,W,H-FL);q.fillStyle='#222c32';
for(let i=1;i<=8;i++)q.fillRect(0,Math.round(FL+(H-FL)*Math.pow(i/8,1.6)),W,1);
for(let k=-9;k<=9;k++){const x0=W/2+k*9,x1=W/2+k*26;for(let y=FL;y<H;y++)q.fillRect(Math.round(x0+(x1-x0)*(y-FL)/(H-FL)),y,1,1)}return b}
const LV=[
{n:'Het huis',FL:120,bg:bgHuis(120),fx:'huis',cov:[['plant',6],['tv',60],['crate',114]],B:0,tint:'rgba(140,0,30,0.10)',waves:[['hg','sp','hg','ws','hg','sp','hg','ws','hg','hg'],['sp','br','hg','ws','sl','sp','hg','ws','hg','hg','sp']]},
{n:'De blokhut',FL:118,bg:bgHut(118),fx:'hut',cov:[['logs',4],['barrel',62],['stump',116]],B:1,tint:'rgba(120,60,0,0.10)',waves:[['ws','ws','hg','sp','ws','mt','ws','sp','hg','ws'],['br','ws','ws','mt','br','ws','hg','sp','ws','hg']]},
{n:'Het riool',FL:116,dark:1,bg:bgRiool(116),fx:'riool',cov:[['trash',8],['pipe',63],['barrel',116]],B:2,tint:'rgba(30,90,0,0.10)',waves:[['kv','hg','sl','kv','hg','sp','kv','sl','hg','hg'],['br','kv','kv','sl','sp','kv','sl','hg','kv','hg']]},
{n:'Het lab',FL:118,bg:bgLab(118),fx:'lab',cov:[['comp',6],['mcrate',60],['comp',114]],B:3,tint:'rgba(0,80,90,0.10)',waves:[['mt','mt','hg','sl','mt','sp','hg','mt','kv','hg'],['br','mt','sl','mt','kv','sp','mt','ws','hg','sl']]},
{n:'De andere kant',FL:122,bg:bgAnder(122),fx:'ander',cov:[['rock',6],['rock',60],['rock',114]],B:4,tint:'rgba(160,0,20,0.14)',waves:[['br','hg','sl','sp','ws','kv','mt','sp','ws','hg','hg'],['br','br','sl','ws','kv','mt','sp','ws','sl','hg','hg','ws']]}];
let lv=0,cur=LV[0],covers=[];
const TYK=['sp','hg','ws','br','mt','kv','sl'],BK=['fl','st','dr','gw','wb','rb'],SK=['ring','pel','vl','ijs','bo'],IK=['hp','vlam','hagel','snel','schild','ijs','stuiter','drone'];
const WAPENS=['vlam','hagel','snel','ijs','stuiter'],EXTRA=['vlam','hagel','snel','ijs','stuiter','schild','drone'];
const PTS={sp:20,hg:10,ws:15,br:50,mt:15,kv:15,sl:20};
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
let EV=[],covNet=false;
function mkCover(name,x0){const[fn,w,h]=COV[name];const y0=H-2-h,cells=[],map=new Map();for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=fn(x,y);if(c){const k={x:x0+x,y:y0+y,c,a:1};cells.push(k);map.set((x0+x)*256+y0+y,k)}}return{cells,map,x0,y0,x1:x0+w,y1:y0+h,cv:mk(w,h),dirty:1}}
function coverAt(x,y){x=Math.round(x);y=Math.round(y);for(const c of covers){if(x<c.x0||x>=c.x1||y<c.y0||y>=c.y1)continue;const k=c.map.get(x*256+y);if(k&&k.a)return[c,k]}return null}
function erode(c,x,y,r){for(let ex=-r;ex<=r;ex++)for(let ey=-r;ey<=r;ey++){if(ex*ex+ey*ey>r*r)continue;const k=c.map.get((Math.round(x)+ex)*256+Math.round(y)+ey);if(k&&k.a){k.a=0;if(Math.random()<.2)parts.push({x:k.x,y:k.y,vx:R(-.6,.6),vy:R(-1,0),l:40,land:c.y1+R(-1,2),c:k.c,s:1,d:1})}}c.dirty=1;covNet=true}
function paint(c,x,y,r,col){if(!c)return;for(let ex=-r;ex<=r;ex++)for(let ey=-r;ey<=r;ey++){if(ex*ex+ey*ey>r*r||(ex+ey)%2)continue;const k=c.map.get((Math.round(x)+ex)*256+Math.round(y)+ey);if(k&&k.a)k.c=col}c.dirty=1;if(HOST)EV.push(['w',covers.indexOf(c),r1(x),r1(y),r,col])}
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function maskOf(c){let s='',v=0,n=0;for(const k of c.cells){v=(v<<1)|k.a;if(++n===6){s+=B64[v];v=0;n=0}}if(n)s+=B64[v<<(6-n)];return s}
function applyMask(c,s){let i=0;for(let j=0;j<s.length;j++){const v=B64.indexOf(s[j]);for(let b=5;b>=0&&i<c.cells.length;b--,i++){const a=(v>>b)&1;if(c.cells[i].a!==a){c.cells[i].a=a;c.dirty=1}}}}
let AC=null,snd=true,NB=null;const lastS={};
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){AC=null}}return AC}
function tone(f1,f2,dur,type,vol,dl){const a=ac();if(!a||!snd)return;const t=a.currentTime+(dl||0),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+dur+.02)}
function noise(dur,f,vol,q){const a=ac();if(!a||!snd)return;if(!NB){NB=a.createBuffer(1,a.sampleRate,a.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}const t=a.currentTime,s=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();s.buffer=NB;fl.type='lowpass';fl.frequency.setValueAtTime(f,t);fl.frequency.exponentialRampToValueAtTime(Math.max(40,f*.2),t+dur);fl.Q.value=q||1;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(fl);fl.connect(g);g.connect(a.destination);s.start(t);s.stop(t+dur+.02)}
const SFX={schiet:()=>tone(900,240,.08,'square',.04),hagel:()=>{noise(.16,2600,.14);tone(150,50,.12,'square',.05)},vlam:()=>noise(.12,1200,.05,3),squish:()=>{noise(.16,900,.12,6);tone(320,90,.12,'sawtooth',.025)},
plons:()=>{noise(.35,1400,.18,3);tone(200,40,.3,'sawtooth',.05)},knal:()=>{noise(.6,2000,.25);tone(110,30,.5,'triangle',.15)},au:()=>{tone(420,110,.22,'sawtooth',.07)},pak:()=>{tone(660,660,.07,'square',.05);tone(990,990,.1,'square',.05,.07)},
hart:()=>{tone(523,523,.08,'triangle',.09);tone(784,784,.14,'triangle',.09,.09)},brul:()=>{tone(95,38,1,'sawtooth',.13);noise(.9,450,.1,2)},zoem:()=>tone(170,330,.3,'sawtooth',.025),web:()=>noise(.2,3200,.06,8),gif:()=>noise(.5,500,.06,1),
klaar:()=>{tone(880,880,.08,'square',.05);tone(1320,1320,.12,'square',.05,.08)},ijs:()=>noise(.2,3200,.06,8),stuiter:()=>tone(900,240,.08,'square',.04),
level:()=>{[392,523,659,784].forEach((f,i)=>tone(f,f,.14,'square',.05,i*.12))},over:()=>{[392,330,262,196].forEach((f,i)=>tone(f,f*.98,.25,'triangle',.08,i*.22))}};
const WAV={},WAVN=['schiet','hagel','vlam','squish','plons','knal','au','pak','hart','brul','zoem','web','gif','level','over','klaar','ijs','stuiter'];
const WVOL={schiet:.35,vlam:.35,squish:.55,web:.6,zoem:.5,gif:.5,ijs:.45,stuiter:.4};
function laadWav(){const a=ac();if(!a||typeof fetch!=='function')return;WAVN.forEach(n=>{fetch('./geluid/swarm/'+n+'.wav?v=1').then(r=>r.ok?r.arrayBuffer():null).then(b=>b?new Promise((ok,no)=>a.decodeAudioData(b,ok,no)):null).then(buf=>{if(buf)WAV[n]=buf}).catch(()=>{})})}
function play(n,gap){if(!snd)return false;if(T-(lastS[n]||-99)<(gap||3))return false;lastS[n]=T;try{if(WAV[n]&&AC){const s=AC.createBufferSource(),v=AC.createGain();s.buffer=WAV[n];s.playbackRate.value=1+R(-.05,.05);v.gain.value=WVOL[n]||.7;s.connect(v);v.connect(AC.destination);s.start()}else if(SFX[n])SFX[n]()}catch(e){}return true}
function sfx(n,gap){if(HOST)EV.push(['a',n,gap||3]);play(n,gap)}
const bulbs=[...Array(16)].map((_,i)=>({x:4+i*9,c:['#ff3040','#40ff60','#4080ff','#ffd040'][i%4],on:1}));
const spores=[...Array(30)].map(()=>({x:R(0,W),y:R(0,H),v:R(.05,.2),p:R(0,6.28)}));
const fog=[...Array(6)].map(()=>({x:R(-40,W),y:R(150,200),w:R(30,60),v:R(.05,.15)}));
const bubs=[...Array(10)].map(()=>({x:R(0,18),y:R(42,88),t:Math.random()<.5?8:110,v:R(.1,.3)}));
let drips=[];
let bugs=[],shots=[],myShots=[],balls=[],parts=[],pud=[],rings=[],items=[],clouds=[],boss=null,T=0,mode='zwerm',modeT=0,waveT=0,waveNr=0,flash=0,next=0,bolt=null;
let rdy=[null,null],gst='titel',stT=0,banner='',bannerT=0,lastSnap=0,lastIn=0,shotN=0,lastN=0,gm='v',ewv=0,dark=0,shk=0,shA=0,slowT=0;
const HY=H-14;const hs=[heroS(0),heroS(1)];
function mkHero(x,i){return{x,tx:x,s:hs[i],hit:0,cd:0,c:i?'#ff9a1f':'#2ee8ff',hp:5,pu:null,puT:0,slow:0,dn:0,sc:0,rv:0,shT:0,drT:0,php:5}}
const h1=mkHero(50,0),h2=mkHero(90,1),HE=[h1,h2];const ME=HOST?h1:h2,OT=HOST?h2:h1;
const SLIME=['#8dff2a','#5fbf1a','#6b7a12','#a4ff5a','#3f5a10'];
function landY(y){return Math.min(H-3,Math.max(cur.FL+2,y+R(15,70)))}
function setMode(m){mode=m;modeT=0;if(m==='chaos')bugs.forEach(b=>{b.vx+=R(-2,2);b.vy+=R(-2,2);b.ax=CL(b.x,15,W-15);b.ay=CL(b.y,20,100)})}
function newBug(ty,x,y,i,sc){const hp=Math.round(TY[ty].hp*(sc||1));return{ty,x,y,vx:0,vy:0,hp,mx:hp,frz:0,spd:1+Math.min(.5,(sc||1)-1),pat:i%4,t:R(0,100)|0,ph:R(0,6.28),fl:0,cd:R(160,420),dir:Math.random()<.5?-1:1,ax:R(20,W-20),ay:R(25,85),wait:0,jx:0,jy:0,dv:0,kami:0}}
function revive(){HE.forEach(h=>{if(h.dn){h.dn=0;h.hp=3;h.hit=120}})}
function setDark(){const d=cur.dark||(gm==='e'&&ewv%4===3)?1:0;if(d&&!dark)say('DE STROOM VALT UIT!');dark=d}
function wave(){bugs=[];revive();cur.waves[waveNr%cur.waves.length].forEach((ty,i)=>{const b=newBug(ty,i%2?W+12:-12,R(10,40),i);b.wait=i*9;bugs.push(b)});setDark()}
function waveE(){bugs=[];revive();const n=9+Math.min(12,ewv),sc=1+ewv*.07,pool=['hg','hg','sp','ws','mt','kv','sl'];for(let i=0;i<n;i++){const ty=Math.random()<Math.min(.3,.04+ewv*.02)?'br':RI(pool);const b=newBug(ty,i%2?W+12:-12,R(10,40),i,sc);b.wait=i*8;bugs.push(b)}setDark();say('GOLF '+(ewv+1))}
function setLevelLocal(i){lv=i;cur=LV[i];covers=cur.cov.map(([n,x])=>mkCover(n,x));pud=[];parts=[];rings=[];drips=[];myShots=[]}
function setLevel(i,geenGolf){setLevelLocal(i);bugs=[];balls=[];shots=[];boss=null;waveNr=0;waveT=0;next=0;items=[];clouds=[];covNet=true;dark=0;if(!geenGolf){if(gm==='e')waveE();else wave()}}
function spawnBoss(){bugs=[];revive();const C=gm==='e'?BOSSES[(Math.round(ewv/5)-1+BOSSES.length)%BOSSES.length]:BOSSES[cur.B],hp=Math.round(130*(gm==='e'?1+ewv*.05:1));boss={C,x:W/2,y:-30,t:0,hp,mx:hp,fl:0,cd:120,st:0,dying:0,dv:0,ph:0,dw:0,dx:W/2};setDark();sfx('brul',1);say('EINDBAAS: '+C.n.toUpperCase());shake(2,40)}
function shake(a,f){if(shk<=0||a>=shA)shA=a;shk=Math.max(shk,f);if(HOST)EV.push(['k',a,f])}
function tril(ms){try{if(navigator.vibrate)navigator.vibrate(ms)}catch(e){}}
function say(t){banner=t;bannerT=150;if(HOST)EV.push(['m',t])}
function splat(x,y,n,big,net){for(let i=0;i<n;i++){const a=R(0,6.28),v=R(.3,big?2.2:1.2);parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-R(.2,1.2),l:R(50,100),land:landY(y),c:SLIME[i%5],s:Math.random()<.35?2:1})}if(HOST&&net!==false)EV.push(['s',r1(x),r1(y),n,big?1:0])}
function burst(x,y,size){splat(x,y,size,true,false);const cols=[PI.a,PI.b,PI.f,PI.e,PI.m,PI.c];for(let i=0;i<size/4;i++){const a=R(0,6.28),v=R(.6,2.4);parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.2,l:140,land:landY(y),c:RI(cols),s:2,ch:1})}rings.push({x,y,r:1,l:12,m:size/3});if(HOST)EV.push(['b',r1(x),r1(y),size])}
function ring(x,y,m,c){rings.push({x,y,r:1,l:10,m,c});if(HOST)EV.push(['r',r1(x),r1(y),m,c])}
function doFlash(n){flash=n;if(HOST)EV.push(['f',n])}
function drop(x,y,pHp,pPu){const r=Math.random();if(r<pHp)items.push({t:'hp',x,y,vy:.4,l:900});else if(r<pHp+pPu)items.push({t:RI(EXTRA),x,y,vy:.4,l:900})}
function mkShots(h,o,arr){const x=Math.round(h.x+5),y=HY-10;if(h.pu==='hagel'){h.cd=22;for(let i=-2;i<=2;i++)arr.push({x,y,vx:i*.55+R(-.15,.15),vy:-3.6,k:'pel',l:34,dmg:1,o});play('hagel')}
else if(h.pu==='ijs'){h.cd=12;arr.push({x,y,vx:0,vy:-4,k:'ijs',l:99,dmg:1,o});play('ijs')}
else if(h.pu==='stuiter'){h.cd=16;for(const v of[-1.3,1.3])arr.push({x,y,vx:v,vy:-3.3,k:'bo',l:150,dmg:1,o,p:3});play('stuiter')}
else{h.cd=h.pu==='snel'?5:13;arr.push({x,y,vx:0,vy:-4,k:'ring',l:99,dmg:1,o});play('schiet')}}
function shoot(h,o){if(h.cd>0||h.dn||gst!=='spel')return;if(HOST)mkShots(h,o,shots);else{mkShots(h,o,myShots);shotN++}}
function heroAt(x,y){for(const h of HE){if(!h.dn&&Math.abs(x-h.x)<5&&y>HY-11&&y<HY+11)return h}return null}
function hurt(h,n){if(h.hit>0||h.dn)return;if(h.shT>0){h.shT=0;h.hit=45;ring(h.x,HY,16,'#60b0ff');sfx('pak',2);return}h.hp-=n;h.hit=45;sfx('au',2);shake(1,10);if(h.hp<=0){h.hp=0;h.dn=1;h.rv=0;h.pu=null;h.drT=0;burst(h.x,HY,20);shake(3,20)}}
function tgHero(){return h1.dn?h2:h2.dn?h1:Math.random()<.5?h1:h2}
function updBug(b,act,cx,cy,avx,avy,lx,ly){if(b.wait>0){b.wait--;return}const ty=TY[b.ty];b.t++;if(b.fl>0)b.fl--;const fz=b.frz>0?.3:1;if(b.frz>0)b.frz--;
if(b.kami){if(b.kami===1){b.x+=R(-1,1);if(--b.kw<=0){b.kami=2;const tg=b.tg,dx=tg.x-b.x,dy=HY-b.y,d=Math.hypot(dx,dy)||1;b.ux=dx/d;b.uy=dy/d;b.vx=b.ux*.6;b.vy=b.uy*.6}return}
b.vx+=b.ux*.09;b.vy+=b.uy*.09;const sp=Math.hypot(b.vx,b.vy);if(sp>3.4){b.vx*=3.4/sp;b.vy*=3.4/sp}b.x+=b.vx*fz;b.y+=b.vy*fz;
const hc=coverAt(b.x,b.y+3);if(hc){erode(hc[0],b.x,b.y+3,4);b.dead=1;burst(b.x,b.y,24);sfx('plons');return}
const hh=heroAt(b.x,b.y);if(hh){hurt(hh,2);b.dead=1;burst(b.x,b.y,24);sfx('plons');shake(2,12);return}if(b.y>H-4||b.x<-10||b.x>W+10){b.dead=1;burst(b.x,Math.min(b.y,H-4),20)}return}
if((b.ty==='hg'||b.ty==='ws')&&b.y<110&&!b.frz&&Math.random()<.0018*(gm==='e'?1+ewv*.05:1)){b.kami=1;b.kw=40;b.tg=tgHero();sfx('zoem',20);return}
let tx=0,tyv=0,mx;
if(mode==='zwerm'){tx=(lx-b.x)*.012+(cx-b.x)*.006+(avx-b.vx)*.05;tyv=(ly-b.y)*.012+(cy-b.y)*.006+(avy-b.vy)*.05;const dx=b.x-lx,dy=b.y-ly;tx+=-dy*.004;tyv+=dx*.004;
for(const o of act){if(o===b)continue;const ex=b.x-o.x,ey=b.y-o.y,d2=ex*ex+ey*ey,mn=(ty.rx+TY[o.ty].rx)*1.1;if(d2<mn*mn&&d2>0){tx+=ex/d2*1.4;tyv+=ey/d2*1.4}}mx=ty.mx;b.vx*=.98;b.vy*=.98}
else{if(b.pat===0){tx=b.dir*.12;tyv=Math.sin(b.t*.12)*.14+(b.ay-b.y)*.004;if(b.x<10)b.dir=1;if(b.x>W-10)b.dir=-1}
else if(b.pat===1){b.ph+=.07;const r=18+Math.sin(b.t*.02)*10,px=b.ax+Math.cos(b.ph)*r,py=b.ay+Math.sin(b.ph)*r*.7;tx=(px-b.x)*.08-b.vx*.1;tyv=(py-b.y)*.08-b.vy*.1;b.ax=CL(b.ax+Math.sin(b.t*.01)*.4,25,W-25)}
else if(b.pat===2){if(!b.dv&&Math.random()<.006)b.dv=1;const hx=(b.t%2?h1:h2).x;if(b.dv===1){tyv=.18;tx=(hx-b.x)*.004;if(b.y>130)b.dv=2}else if(b.dv===2){tyv=-.16;if(b.y<40)b.dv=0}else{tx=(b.ax-b.x)*.01;tyv=(b.ay-b.y)*.01}}
else{if(b.t%8===0){b.jx=R(-.45,.45);b.jy=R(-.45,.45)}tx=b.jx+(b.ax-b.x)*.004;tyv=b.jy+(b.ay-b.y)*.004}
mx=ty.cm;b.vx*=.96;b.vy*=.96}
if(b.ty==='mt')tyv+=Math.sin(b.t*.3)*.12;
mx*=b.spd||1;b.vx+=tx;b.vy+=tyv;const sp=Math.hypot(b.vx,b.vy);if(sp>mx){b.vx*=mx/sp;b.vy*=mx/sp}
if(b.x<6)b.vx+=.3;if(b.x>W-6)b.vx-=.3;if(b.y<8)b.vy+=.3;if(b.y>135)b.vy-=.45;b.x+=b.vx*fz;b.y+=b.vy*fz;
if(fz<1)b.cd+=.7;if(--b.cd<=0&&b.y<130&&b.x>0&&b.x<W){b.cd=R(170,440)*(lv>=3?.8:1);const hx=tgHero().x;
if(b.ty==='sp')balls.push({k:'fl',x:b.x,y:b.y+8,vx:CL((hx-b.x)*.006,-.5,.5),vy:1,r:4});
else if(b.ty==='br'){for(const s of[-.5,0,.5])balls.push({k:'fl',x:b.x,y:b.y+10,vx:s,vy:1,r:4})}
else if(b.ty==='ws')balls.push({k:'st',x:b.x,y:b.y+9,vx:0,vy:2.2,r:2});
else if(b.ty==='mt'){balls.push({k:'gw',x:b.x,y:b.y+5,vx:R(-.2,.2),vy:.5,r:3});sfx('gif',10)}
else if(b.ty==='kv'){const d=Math.hypot(hx-b.x,HY-b.y)||1;balls.push({k:'wb',x:b.x,y:b.y+6,vx:(hx-b.x)/d*1.6,vy:(HY-b.y)/d*1.6,r:3});sfx('web',8)}
else if(b.ty==='sl')balls.push({k:'dr',x:b.x,y:b.y+6,vx:R(-.3,.3),vy:.8,r:2});
else balls.push({k:'dr',x:b.x,y:b.y+6,vx:0,vy:.6,r:2})}}
function killBug(b,o){b.dead=1;const big=b.ty==='br';HE[o].sc+=PTS[b.ty]||10;burst(b.x,b.y,big?60:b.ty==='hg'?22:34);sfx(big?'knal':'plons',big?1:3);if(big)shake(2,14);
if(b.ty==='sl')for(let i=0;i<2;i++){const n=newBug('hg',b.x+(i?4:-4),b.y,i);n.vx=i?1.5:-1.5;n.vy=-1;bugs.push(n)}
drop(b.x,b.y,big?.3:.07,big?.45:.1);if(mode==='zwerm'&&Math.random()<.4)setMode('chaos')}
function bossAtt(B,a){const tg=tgHero();
if(a==='waaier'){for(let i=-2;i<=2;i++)balls.push({k:'fl',x:B.x+i*4,y:B.y+18,vx:i*.35,vy:1.1,r:4});sfx('squish')}
else if(a==='angels'){for(let i=0;i<7;i++)balls.push({k:'st',x:R(10,W-10),y:R(-30,0),vx:0,vy:2,r:2})}
else if(a==='broed'){if(bugs.length>=12)return bossAtt(B,'waaier');const n=B.hp<B.mx/2?4:3;for(let i=0;i<n;i++){const b=newBug(B.C.n==='Spinnenmoeder'?'kv':B.C.n==='Motvorst'?'mt':'hg',B.x+R(-6,6),B.y+18,i);b.vx=R(-1.5,1.5);b.vy=R(.5,1.5);if(b.ty==='hg'&&Math.random()<.5){b.kami=1;b.kw=30+i*10;b.tg=tg}bugs.push(b)}splat(B.x,B.y+18,12,false);sfx('squish')}
else if(a==='duik'){B.dv=3;B.dw=50;B.dx=tg.x;sfx('zoem',10)}
else if(a==='web'){for(const h of HE){if(h.dn)continue;const d=Math.hypot(h.x-B.x,HY-B.y)||1;for(const o of[-.3,0,.3])balls.push({k:'wb',x:B.x,y:B.y+18,vx:(h.x-B.x)/d*1.7+o,vy:(HY-B.y)/d*1.7,r:3})}sfx('web')}
else if(a==='gif'){for(let i=0;i<3;i++)balls.push({k:'gw',x:B.x+(i-1)*14,y:B.y+14,vx:(i-1)*.5,vy:.6,r:3});sfx('gif')}
else if(a==='ring'){for(let i=0;i<14;i++){const an=i/14*6.283;balls.push({k:'rb',x:B.x,y:B.y+6,vx:Math.cos(an)*1.1,vy:Math.sin(an)*1.1+.35,r:3})}sfx('squish')}}
function updBoss(){const B=boss;B.t++;if(B.fl>0)B.fl--;
if(B.dying){B.dying--;if(B.dying%4===0){burst(B.x+R(-18,18),B.y+R(-16,16),30);doFlash(4);sfx('knal',1);shake(3,8)}if(B.dying===0){burst(B.x,B.y,90);shake(4,40);if(HOST)EV.push(['v',250]);tril(250);items.push({t:'hp',x:B.x-10,y:B.y,vy:.4,l:900},{t:RI(EXTRA),x:B.x+10,y:B.y,vy:.4,l:900});boss=null;next=240;say(gm==='e'?'BAAS VERSLAGEN!':lv===LV.length-1?'DE ZWERM IS VERSLAGEN!':'LEVEL GEHAALD!');sfx('level',1)}return}
const fase=B.hp<B.mx*.33?2:B.hp<B.mx*.66?1:0;if(fase>B.ph){B.ph=fase;say('FASE '+(fase+1)+'!');doFlash(8);shake(3,30);burst(B.x,B.y,40);sfx('brul',1)}
const rage=[1,1.35,1.7][B.ph];
if(B.y<46&&!B.dv){B.y+=.5;return}
if(B.dv===3){if(--B.dw<=0){B.dv=1;sfx('brul',1)}}
else if(B.dv===1){B.x+=(B.dx-B.x)*.04;B.y+=2.2;if(B.y>118)B.dv=2;const hh=heroAt(B.x,B.y+14);if(hh)hurt(hh,2);covers.forEach(c=>{if(B.x+14>c.x0&&B.x-14<c.x1&&B.y+18>c.y0)erode(c,CL(B.x,c.x0,c.x1),c.y0+2,5)})}
else if(B.dv===2){B.y-=1.4;if(B.y<=46){B.dv=0}}
else{B.x=W/2+Math.sin(B.t*.012*rage)*40;B.y=46+Math.sin(B.t*.03)*6}
if(!B.dv&&--B.cd<=0){const L=B.ph?B.C.att.concat(B.C.att2):B.C.att,a=L[B.st%L.length];B.st++;B.cd=(a==='broed'?200:140)/rage;bossAtt(B,a);if(B.ph===2&&a!=='duik'&&Math.random()<.4)bossAtt(B,RI(['waaier','angels','ring']))}}
function ambient(){if(flash>0)flash--;else if(HOST&&gst==='spel'&&Math.random()<(cur.fx==='ander'?.004:.002))doFlash(10);
if(flash===9&&cur.fx==='ander'){let x=R(20,W-20),y=0;bolt=[];while(y<cur.FL-30){bolt.push([x|0,y|0]);x+=R(-4,4);y+=R(3,7)}}
if(T%6===0)bulbs.forEach(b=>{b.on=Math.random()<.92?1:0});
spores.forEach(s=>{s.y-=s.v;s.x+=Math.sin(T*.01+s.p)*.1;if(s.y<0){s.y=H;s.x=R(0,W)}});fog.forEach(f=>{f.x+=f.v;if(f.x>W)f.x=-f.w});
bubs.forEach(b=>{b.y-=b.v;if(b.y<42){b.y=88;b.x=R(0,18)}});
if(cur.fx==='riool'&&Math.random()<.03)drips.push({x:R(0,W)|0,y:22,v:0});drips=drips.filter(d=>{d.v+=.05;d.y+=d.v;return d.y<cur.FL+8});
if(bannerT>0)bannerT--;if(shk>0)shk--}
function updFx(){parts=parts.filter(p=>{p.vy+=.08;p.x+=p.vx;p.y+=p.vy;p.vx*=.98;
if(!p.d&&p.y>150){const hc=coverAt(p.x,p.y);if(hc){if(!p.ch){hc[1].c=RI(SLIME);hc[0].dirty=1}return false}}
if(p.y>=p.land){if(p.ch)pud.push({x:p.x,y:p.land,c:p.c,l:600,ch:1});else if(!p.d&&Math.random()<.3)pud.push({x:p.x,y:p.land,r:R(.6,1.8),l:R(120,240)});return false}return--p.l>0});
pud=pud.filter(p=>--p.l>0);if(pud.length>160)pud.splice(0,pud.length-160);if(parts.length>700)parts.splice(0,parts.length-700);
rings=rings.filter(r=>{r.r+=r.m/12;return--r.l>0})}
function moveHero(h){if(h.dn){h.tx=h.x;return}h.x+=(h.tx-h.x)*(h.slow>0?.07:.25);if(h.cd>0)h.cd--;if(h.hit>0)h.hit--;if(h.slow>0)h.slow--}
function titleUpd(){const lx=W/2+Math.sin(T*.013)*45,ly=60+Math.sin(T*.021)*28;bugs.forEach(b=>{b.t=(b.t||0)+1;b.vx+=(lx-b.x)*.01+Math.sin(b.t*.05+b.ph)*.05;b.vy+=(ly-b.y)*.01+Math.cos(b.t*.04+b.ph)*.05;for(const o of bugs){if(o===b)continue;const ex=b.x-o.x,ey=b.y-o.y,d2=ex*ex+ey*ey;if(d2<100&&d2>0){b.vx+=ex/d2;b.vy+=ey/d2}}const sp=Math.hypot(b.vx,b.vy);if(sp>1.6){b.vx*=1.6/sp;b.vy*=1.6/sp}b.x+=b.vx;b.y+=b.vy})}
function titelBugs(){bugs=[];TYK.concat(['hg','hg','sp','ws','mt','kv','hg']).forEach((ty,i)=>{const b=newBug(ty,R(10,W-10),R(20,90),i);bugs.push(b)})}
function naarTitel(){rdy=[null,null];gst='titel';gm='v';ewv=0;HE.forEach((h,i)=>{h.hp=5;h.dn=0;h.pu=null;h.puT=0;h.slow=0;h.hit=0;h.rv=0;h.shT=0;h.drT=0;h.x=h.tx=i?90:50});setLevel(0,true);titelBugs()}
function beginSpel(m){rdy=[null,null];gm=m==='e'?'e':'v';ewv=0;HE.forEach((h,i)=>{h.hp=5;h.dn=0;h.pu=null;h.puT=0;h.slow=0;h.hit=0;h.sc=0;h.rv=0;h.shT=0;h.drT=0;h.x=h.tx=i?90:50});lastN=0;setLevel(0,true);gst='aftel';stT=180}
function verderEindeloos(){rdy=[null,null];gm='e';ewv=5;HE.forEach(h=>{if(h.dn){h.dn=0;h.hp=3}});setLevel(0,true);gst='overgang';stT=150;say('EINDELOZE MODUS');waveE();sfx('level',1)}
function hostCmd(c,wie){wie=wie?1:0;if(c==='titel'){if(gst==='over'||gst==='klaar')naarTitel();return}
const mag=(gst==='titel'&&(c==='verhaal'||c==='eindeloos'))||(gst==='klaar'&&c==='verder');if(!mag)return;
if(rdy[wie]===c)rdy[wie]=null;else{rdy[wie]=c;if(rdy[1-wie]&&rdy[1-wie]!==c)rdy[1-wie]=null}sfx('klaar',1);
if(rdy[0]&&rdy[0]===rdy[1]){const k=rdy[0];if(k==='verder')verderEindeloos();else beginSpel(k==='eindeloos'?'e':'v')}}
function ballTrail(o){if(o.k==='fl'&&T%4===0)parts.push({x:o.x,y:o.y,vx:0,vy:.2,l:25,land:o.y+R(4,10),c:'#5fbf1a',s:1});if(o.k==='gw'&&T%3===0)parts.push({x:o.x+R(-2,2),y:o.y,vx:R(-.2,.2),vy:-.1,l:20,land:H,c:'#a0c060',s:1,d:1})}
function ballMove(o){o.x+=o.vx;o.y+=o.vy;if(o.k==='fl'||o.k==='dr'||o.k==='gw')o.vy=Math.min(o.vy+.012,o.k==='gw'?.9:1.8)}
function hostUpd(){T++;ambient();
if(gst==='titel'){titleUpd();HE.forEach(moveHero);updFx();return}
if(gst==='aftel'){if(--stT<=0){gst='spel';if(gm==='e')waveE();else{wave();say('LEVEL 1 \u00b7 '+cur.n.toUpperCase())}sfx('level',1)}HE.forEach(moveHero);updFx();return}
if(gst==='overgang'){if(--stT<=0){gst='spel'}updFx();HE.forEach(moveHero);return}
if(gst!=='spel'){updFx();HE.forEach(moveHero);return}
modeT++;if(mode==='zwerm'&&modeT>360)setMode('chaos');else if(mode==='chaos'&&modeT>300)setMode('zwerm');
if(next>0){if(--next===0){if(gm==='e'){ewv++;setLevel((lv+1)%LV.length,true);gst='overgang';stT=150;say(cur.n.toUpperCase());waveE();sfx('level',1)}else if(lv===LV.length-1){gst='klaar';sfx('level',1)}else{setLevel(lv+1);gst='overgang';stT=150;say('LEVEL '+(lv+1)+' \u00b7 '+cur.n.toUpperCase());sfx('level',1)}}}
else if(!boss&&!bugs.length&&++waveT>70){waveT=0;if(gm==='e'){ewv++;if(ewv%5===4)spawnBoss();else if(ewv%3===0){setLevel((lv+1)%LV.length,true);gst='overgang';stT=120;say(cur.n.toUpperCase());waveE()}else waveE()}else{waveNr++;if(waveNr>=2)spawnBoss();else wave()}}
const act=bugs.filter(b=>b.wait<=0&&!b.kami);let cx=W/2,cy=60,avx=0,avy=0;if(act.length){cx=0;cy=0;act.forEach(b=>{cx+=b.x;cy+=b.y;avx+=b.vx;avy+=b.vy});cx/=act.length;cy/=act.length;avx/=act.length;avy/=act.length}
const lx=W/2+Math.sin(T*.013)*45+Math.sin(T*.031)*12,ly=(boss?80:58)+Math.sin(T*.021)*(boss?15:28)+Math.cos(T*.009)*12;
bugs.forEach(b=>updBug(b,act,cx,cy,avx,avy,lx,ly));if(boss)updBoss();
HE.forEach((h,i)=>{const o=HE[1-i];if(h.dn){if(!o.dn&&Math.abs(o.x-h.x)<11){h.rv++;if(h.rv%18===0)play('pak',10);if(h.rv>=90){h.dn=0;h.hp=3;h.hit=120;h.rv=0;ring(h.x,HY,20,'#ff6080');sfx('hart',1);say('GERED!')}}else h.rv=Math.max(0,h.rv-2);return}
moveHero(h);if(h.pu&&--h.puT<=0)h.pu=null;if(h.shT>0)h.shT--;
if(h.pu==='vlam'&&T%2===0){shots.push({x:h.x+5+R(-1,1),y:HY-10,vx:R(-.45,.45),vy:-2.3,k:'vl',l:R(20,26),dmg:.34,o:i});if(h===ME)play('vlam',6)}
if(h.drT>0){h.drT--;if(T%24===i*12){const dx=h.x+Math.sin(T*.05)*10,dy=HY-26;let tg=boss&&!boss.dying?boss:null,bd=1e9;if(!tg)for(const b of bugs){if(b.wait>0)continue;const d=Math.abs(b.x-dx)+Math.abs(b.y-dy)*.3;if(d<bd){bd=d;tg=b}}if(tg){const d=Math.hypot(tg.x-dx,tg.y-dy)||1;shots.push({x:dx,y:dy,vx:(tg.x-dx)/d*3.5,vy:(tg.y-dy)/d*3.5,k:'ring',l:80,dmg:.7,o:i,dr:1});play('schiet',4)}}}});
shots=shots.filter(s=>{s.x+=s.vx;s.y+=s.vy;if(--s.l<=0)return false;if(s.k==='bo'){if(s.x<2||s.x>W-2)s.vx=-s.vx;if(s.y<2)s.vy=Math.abs(s.vy)}
if(boss&&!boss.dying&&s.hb!==boss&&Math.abs(s.x-boss.x)<18&&Math.abs(s.y-boss.y)<16){boss.hp-=s.dmg;boss.fl=4;splat(s.x,s.y,s.k==='vl'?1:5,false);sfx('squish',4);if(boss.hp<=0){boss.dying=70;slowT=120;HE[s.o].sc+=500}if(s.k==='bo'&&--s.p>0){s.hb=boss;return true}return false}
for(const b of bugs){if(b.wait>0||b.dead||s.hb===b)continue;const ty=TY[b.ty];if(Math.abs(s.x-b.x)<ty.rx&&Math.abs(s.y-b.y)<ty.ry){b.hp-=s.dmg;b.fl=6;if(s.k==='ijs')b.frz=180;splat(b.x,b.y,s.k==='vl'?2:6,false);sfx('squish',4);if(b.hp<=0.01)killBug(b,s.o);if(s.k==='bo'&&--s.p>0){s.hb=b;return true}return false}}return s.y>-4&&s.y<H});
bugs=bugs.filter(b=>!b.dead);
balls=balls.filter(o=>{ballMove(o);ballTrail(o);
if(o.y>150){for(let d=-1;d<=1;d++){const hc=coverAt(o.x+d,o.y);if(hc){if(o.k==='wb')paint(hc[0],o.x,o.y,3,'#d8d8e0');else if(o.k==='gw')clouds.push({x:o.x,y:hc[0].y0-2,l:300});else{erode(hc[0],o.x,o.y,o.r);splat(o.x,o.y,7,false)}return false}}}
const hh=heroAt(o.x,o.y);if(hh){if(o.k==='wb'){if(hh.shT>0)hurt(hh,0);else{hh.slow=150;sfx('web')}}else if(o.k==='gw'){clouds.push({x:o.x,y:HY+4,l:300});hurt(hh,1)}else{hurt(hh,1);splat(o.x,o.y,10,false)}return false}
if(o.k==='gw'&&o.y>H-12){clouds.push({x:o.x,y:H-10,l:300});return false}
if(o.y>H-4||o.x<-8||o.x>W+8||o.y<-40){if(o.k!=='wb')splat(o.x,Math.min(o.y,H-4),6,false);return false}return true});
clouds=clouds.filter(c=>{for(const h of HE)if(!h.dn&&Math.abs(h.x-c.x)<11&&T%45===0)hurt(h,1);return--c.l>0});
items=items.filter(it=>{if(it.vy>0){it.y+=it.vy;it.vy=Math.min(it.vy+.03,1.4);if(it.y>=H-8){it.y=H-8;it.vy=0}}
for(const h of HE){if(!h.dn&&it.vy===0&&Math.abs(h.x-it.x)<8){if(it.t==='hp'){h.hp=Math.min(5,h.hp+2);sfx('hart',1)}else if(it.t==='schild'){h.shT=900;sfx('pak',1)}else if(it.t==='drone'){h.drT=900;sfx('pak',1)}else{h.pu=it.t;h.puT=600;sfx('pak',1)}ring(it.x,it.y,18,it.t==='hp'?'#ff6080':'#ffe060');return false}}return--it.l>0});
updFx();
if(h1.dn&&h2.dn){gst='over';sfx('over',1);shake(3,30)}}
function snap(){const m={T,lv,st:gst,stT,mode,gm,rd:rdy,ew:ewv,dk:dark,sl:slowT>0?1:0,
h:HE.map(h=>[r1(h.x),h.hp,h.pu?IK.indexOf(h.pu):-1,h.puT,h.slow,h.dn,h.hit,h.sc,h.rv,h.shT,h.drT]),
b:bugs.filter(b=>b.wait<=0).map(b=>[TYK.indexOf(b.ty),r1(b.x),r1(b.y),r2(b.vx),r2(b.vy),r1(b.hp),b.mx,b.fl,b.kami,b.frz>0?1:0]),
B:boss?[BOSSES.indexOf(boss.C),r1(boss.x),r1(boss.y),Math.round(boss.hp),boss.mx,boss.fl,boss.dying,boss.ph,boss.dv,r1(boss.dx)]:0,
o:balls.map(o=>[BK.indexOf(o.k),r1(o.x),r1(o.y),r2(o.vx),r2(o.vy)]),
s:shots.filter(s=>s.o===0||s.dr).map(s=>[SK.indexOf(s.k),r1(s.x),r1(s.y),r2(s.vx),r2(s.vy),s.l|0,s.o]),
i:items.map(it=>[IK.indexOf(it.t),r1(it.x),r1(it.y),r2(it.vy),it.l]),
c:clouds.map(c=>[r1(c.x),r1(c.y),c.l]),ev:EV};
if(covNet||T%120===0){m.cv=covers.map(maskOf);covNet=false}EV=[];return m}
function applyEv(e){const k=e[0];
if(k==='s')splat(e[1],e[2],e[3],!!e[4]);else if(k==='b')burst(e[1],e[2],e[3]);else if(k==='r')rings.push({x:e[1],y:e[2],r:1,l:10,m:e[3],c:e[4]});
else if(k==='a')play(e[1],e[2]);else if(k==='f')flash=e[1];else if(k==='k')shake(e[1],e[2]);else if(k==='v')tril(e[1]);else if(k==='m'){banner=e[1];bannerT=150}else if(k==='w')paint(covers[e[1]],e[2],e[3],e[4],e[5])}
function applySnap(m){lastSnap=performance.now();if(m.lv!==lv)setLevelLocal(m.lv);
if(gst!==m.st&&m.st==='aftel'){myShots=[];shotN=0}gst=m.st;stT=m.stT;mode=m.mode;gm=m.gm;rdy=m.rd||[null,null];ewv=m.ew;dark=m.dk;slowT=m.sl?10:0;
m.h.forEach((a,i)=>{const h=HE[i];if(h!==ME||a[5])h.tx=a[0];if(h===ME&&a[5])h.x=a[0];h.hp=a[1];h.pu=a[2]<0?null:IK[a[2]];h.puT=a[3];h.slow=a[4];h.dn=a[5];h.hit=a[6];h.sc=a[7];h.rv=a[8];h.shT=a[9];h.drT=a[10]});
bugs=m.b.map(a=>({ty:TYK[a[0]],x:a[1],y:a[2],vx:a[3],vy:a[4],hp:a[5],mx:a[6],fl:a[7],kami:a[8],frz:a[9],ph:(a[1]*7)%6.28,wait:0}));
if(m.B){const a=m.B,C=BOSSES[a[0]];if(!boss||boss.C!==C)boss={C,x:a[1],y:a[2]};boss.tx=a[1];boss.ty=a[2];boss.hp=a[3];boss.mx=a[4];boss.fl=a[5];boss.dying=a[6];boss.ph=a[7];boss.dv=a[8];boss.dx=a[9]}else boss=null;
balls=m.o.map(a=>({k:BK[a[0]],x:a[1],y:a[2],vx:a[3],vy:a[4]}));
shots=m.s.map(a=>({k:SK[a[0]],x:a[1],y:a[2],vx:a[3],vy:a[4],l:a[5],o:a[6]||0}));
items=m.i.map(a=>({t:IK[a[0]],x:a[1],y:a[2],vy:a[3],l:a[4]}));
clouds=m.c.map(a=>({x:a[0],y:a[1],l:a[2]}));
if(m.cv)m.cv.forEach((s,i)=>{if(covers[i])applyMask(covers[i],s)});
(m.ev||[]).forEach(applyEv)}
function guestUpd(){T++;ambient();
if(!lastSnap&&gst==='titel')titleUpd();
moveHero(ME);OT.x+=(OT.tx-OT.x)*.3;
if(gst==='spel'&&!ME.dn&&ME.pu==='vlam'&&T%2===0){myShots.push({x:ME.x+5+R(-1,1),y:HY-10,vx:R(-.45,.45),vy:-2.3,k:'vl',l:R(20,26),dmg:0,o:1});play('vlam',6)}
if(gst==='titel'&&lastSnap)bugs.forEach(b=>{b.x+=b.vx;b.y+=b.vy});else bugs.forEach(b=>{const fz=b.frz?.3:1;b.x+=b.vx*fz;b.y+=b.vy*fz;if(b.fl>0)b.fl--});
if(boss){boss.x+=(boss.tx-boss.x)*.3;boss.y+=(boss.ty-boss.y)*.3;if(boss.fl>0)boss.fl--}
balls.forEach(o=>{ballMove(o);ballTrail(o)});
shots=shots.filter(s=>{s.x+=s.vx;s.y+=s.vy;if(s.k==='bo'){if(s.x<2||s.x>W-2)s.vx=-s.vx;if(s.y<2)s.vy=Math.abs(s.vy)}return--s.l>0});
myShots=myShots.filter(s=>{s.x+=s.vx;s.y+=s.vy;if(s.k==='bo'){if(s.x<2||s.x>W-2)s.vx=-s.vx;if(s.y<2)s.vy=Math.abs(s.vy)}if(--s.l<=0||s.y<-4||s.y>H)return false;
if(boss&&!boss.dying&&Math.abs(s.x-boss.x)<18&&Math.abs(s.y-boss.y)<16)return false;
for(const b of bugs){const ty=TY[b.ty];if(Math.abs(s.x-b.x)<ty.rx&&Math.abs(s.y-b.y)<ty.ry)return false}return true});
items.forEach(it=>{if(it.vy>0){it.y+=it.vy;if(it.y>=H-8){it.y=H-8;it.vy=0}}});
updFx()}
function render(){ctx.save();if(shk>0)ctx.translate(Math.round(R(-shA,shA)),Math.round(R(-shA,shA)));ctx.drawImage(cur.bg,0,0);const fx=cur.fx;
if(fx==='huis'){if(flash>0&&flash%3){ctx.fillStyle='rgba(200,210,255,0.55)';ctx.fillRect(14,24,30,38)}
ctx.fillStyle='#0a0a0a';for(let x=0;x<W;x++)ctx.fillRect(x,Math.round(8+Math.abs(Math.sin(x*.35))*3),1,1);
bulbs.forEach(b=>{const y=Math.round(9+Math.abs(Math.sin(b.x*.35))*3)+1;if(b.on){ctx.globalAlpha=.25;ctx.fillStyle=b.c;ctx.fillRect(b.x-2,y-1,5,5);ctx.globalAlpha=1;ctx.fillStyle=b.c;ctx.fillRect(b.x,y,1,2);ctx.fillStyle='#fff';ctx.fillRect(b.x,y,1,1)}else{ctx.fillStyle='#222';ctx.fillRect(b.x,y,1,2)}})}
else if(fx==='hut'){const f=Math.random();ctx.globalAlpha=.18+f*.1;ctx.fillStyle='#ffb040';ctx.fillRect(13,44,13,13);ctx.globalAlpha=1;ctx.fillStyle=f<.5?'#ffd060':'#ff9020';ctx.fillRect(19,51-(f*2|0),1,3);ctx.fillStyle='#fff0b0';ctx.fillRect(19,52,1,1);
if(flash>0&&flash%3){ctx.fillStyle='rgba(200,210,255,0.4)';ctx.fillRect(90,20,32,40)}}
else if(fx==='riool'){ctx.fillStyle='#5a8a2a';for(let x=0;x<W;x+=3){const y=cur.FL+9+((x+T*.3|0)%11);if(y<cur.FL+20)ctx.fillRect(x,y,2,1)}ctx.fillStyle='#8dff2a';drips.forEach(d=>ctx.fillRect(d.x,d.y|0,1,2))}
else if(fx==='lab'){ctx.fillStyle='#8adfc0';bubs.forEach(b=>ctx.fillRect(Math.round(b.t+2+b.x),Math.round(b.y),1,1));const on=(T>>4)%2;ctx.globalAlpha=on?.5:.15;ctx.fillStyle='#ff2030';ctx.fillRect(W/2-6,2,12,5);ctx.globalAlpha=1;ctx.fillStyle=on?'#ff4050':'#6a1018';ctx.fillRect(W/2-2,3,4,3)}
else{if(flash>0&&bolt){ctx.fillStyle='#ff6080';bolt.forEach(p=>ctx.fillRect(p[0],p[1],1,4))}}
pud.forEach(p=>{if(p.ch){ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x),Math.round(p.y),2,1);return}const a=Math.min(1,p.l/80);ctx.fillStyle=`rgba(90,160,20,${(a*.8).toFixed(2)})`;const r=Math.max(1,Math.round(p.r*a));ctx.fillRect(Math.round(p.x-r),Math.round(p.y),r*2,1);ctx.fillStyle=`rgba(160,255,60,${(a*.5).toFixed(2)})`;ctx.fillRect(Math.round(p.x-r+1),Math.round(p.y),1,1)});
items.forEach(it=>{if(it.l<120&&(T>>2)%2)return;const s=IC[it.t];if(!s)return;ctx.globalAlpha=.25+.15*Math.sin(T*.15);ctx.fillStyle=it.t==='hp'?'#ff3050':'#ffe060';ctx.fillRect(Math.round(it.x)-6,Math.round(it.y)-6,12,12);ctx.globalAlpha=1;draw(s,it.x,it.y+Math.sin(T*.1)*1,.8)});
if(boss){const B=boss,C=B.C,s=B.fl>0?C.Wt:((T>>3)%2?C.A:C.B),bx=B.x+(B.dying||B.dv===3?R(-2,2):0);draw(s,bx,B.y,.6+.3*Math.sin(T*.08));if(B.ph){ctx.globalAlpha=(B.ph===2?.35:.18)+.12*Math.sin(T*.25);draw(C.Rd,bx,B.y,0);ctx.globalAlpha=1}}
bugs.forEach(b=>{if(b.wait>0)return;const ty=TY[b.ty];if(!ty)return;const fr=(T>>(b.ty==='mt'?3:2))%2,s=b.fl>0||(b.kami===1&&(T>>1)%2)?ty.Wt:(fr?ty.A:ty.B);
const ga=.4+.3*Math.sin(T*.12+b.ph)+.35*CL(b.y/140,0,1);draw(s,b.x,b.y,b.kami?1:ga);if(b.frz){ctx.globalAlpha=.55;draw(ty.Ic,b.x,b.y,0);ctx.globalAlpha=1}
if(b.kami===2&&T%2===0)parts.push({x:b.x,y:b.y-3,vx:0,vy:0,l:10,land:H,c:'#ff2a3a',s:1,d:1});
const bw=ty.hb,bx=Math.round(b.x-bw/2),by=Math.round(b.y-ty.top);ctx.fillStyle='#2a0010';ctx.fillRect(bx,by,bw,1);ctx.fillStyle=b.hp/b.mx>.5?'#8dff2a':'#ff3b2b';ctx.fillRect(bx,by,Math.max(1,Math.round(bw*b.hp/b.mx)),1)});
clouds.forEach(c=>{const a=Math.min(1,c.l/60)*(.35+.1*Math.sin(T*.1));for(let i=0;i<60;i++){const an=i*2.4+T*.01,r=(i%11)+1;const x=Math.round(c.x+Math.cos(an)*r),y=Math.round(c.y+Math.sin(an)*r*.45);ctx.globalAlpha=a;ctx.fillStyle=i%3?'#8ab040':'#a060c0';ctx.fillRect(x,y,2,1)}ctx.globalAlpha=1});
HE.forEach(h=>{if(h.dn){if((T>>3)%2){ctx.globalAlpha=.25;draw(h.s.A,h.x,HY,0);ctx.globalAlpha=1}return}if(h.hit&&(h.hit>>2)%2)return;const mv=Math.abs(h.tx-h.x)>.6;draw(mv&&(T>>3)%2?h.s.B:h.s.A,h.x,HY,.6);
if(h.slow>0){ctx.fillStyle='rgba(230,230,240,0.8)';for(let i=-6;i<=6;i+=2){ctx.fillRect(Math.round(h.x+i),HY+Math.abs(i)-4,1,1);ctx.fillRect(Math.round(h.x+i),HY-Math.abs(i)+6,1,1)}}
if(h.pu==='vlam'){ctx.globalAlpha=.3+.2*Math.random();ctx.fillStyle='#ff8020';ctx.fillRect(Math.round(h.x+3),HY-13,5,4);ctx.globalAlpha=1}
if(h.shT>0&&(h.shT>120||(T>>2)%2)){ctx.globalAlpha=.45+.2*Math.sin(T*.2);ctx.fillStyle='#60b0ff';for(let i=0;i<28;i++){const a=i/28*6.283;ctx.fillRect(Math.round(h.x+Math.cos(a)*9),Math.round(HY+Math.sin(a)*12),1,1)}ctx.globalAlpha=1}
if(h.drT>0&&(h.drT>120||(T>>2)%2))draw(IC.drone,h.x+Math.sin(T*.05)*10,HY-26+Math.sin(T*.1)*1.5,.5)});
covers.forEach(c=>{if(c.dirty){const q=c.cv.getContext('2d');q.clearRect(0,0,c.cv.width,c.cv.height);c.cells.forEach(k=>{if(k.a){q.fillStyle=k.c;q.fillRect(k.x-c.x0,k.y-c.y0,1,1)}});c.dirty=0}ctx.drawImage(c.cv,c.x0,c.y0)});
if(fx==='lab'){for(const c of covers){if(c.cv.width!==20||c.cv.height!==26)continue;for(let x=3;x<=16;x++){if((x*7+(T>>3))%5<2){ctx.fillStyle=['#ff3040','#40ff60','#ffd040'][x%3];const k=c.map.get((c.x0+x)*256+c.y0+15);if(k&&k.a)ctx.fillRect(c.x0+x,c.y0+15,1,2)}}}}
HE.forEach(h=>{if(!h.dn&&covers.some(c=>h.x+6>c.x0&&h.x-6<c.x1)){ctx.globalAlpha=.3;draw(h.s.A,h.x,HY,0);ctx.globalAlpha=1}});
if(dark&&!(flash>0&&flash%3)){const q=dkC.getContext('2d');q.globalCompositeOperation='source-over';q.clearRect(0,0,W,H);q.fillStyle='rgba(0,0,8,0.94)';q.fillRect(0,0,W,H);q.globalCompositeOperation='destination-out';
const licht=(x,y,r)=>{const g=q.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.6,'rgba(0,0,0,.7)');g.addColorStop(1,'rgba(0,0,0,0)');q.fillStyle=g;q.fillRect(x-r,y-r,r*2,r*2)};
HE.forEach(h=>{if(h.dn)return;licht(h.x,HY-18,30);licht(h.x,HY,14)});let nv=0;for(const s of(HOST?shots:shots.concat(myShots))){if(s.k==='vl'&&nv++<8)licht(s.x,s.y,10)}
q.globalCompositeOperation='source-over';ctx.drawImage(dkC,0,0);
bugs.forEach(b=>{if(b.wait>0)return;const ty=TY[b.ty];if(!ty)return;ctx.globalAlpha=.55+.3*Math.sin(T*.12+b.ph);ctx.drawImage(((T>>2)%2?ty.A:ty.B).g,Math.round(b.x-ty.A.w/2-ty.A.p),Math.round(b.y-ty.A.h/2-ty.A.p));ctx.globalAlpha=1});
if(boss){const C=boss.C;ctx.globalAlpha=.7;ctx.drawImage(C.A.g,Math.round(boss.x-C.A.w/2-C.A.p),Math.round(boss.y-C.A.h/2-C.A.p));ctx.globalAlpha=1}
items.forEach(it=>{const s=IC[it.t];if(s)draw(s,it.x,it.y,.9)})}
bugs.forEach(b=>{if(b.kami===1&&(T>>2)%2){const ty=TY[b.ty];if(!ty)return;const x=Math.round(b.x),y=Math.round(b.y-ty.top-6);ctx.fillStyle='#ff2030';ctx.fillRect(x,y,1,3);ctx.fillRect(x,y+4,1,1)}});
if(boss&&boss.dv===3){if((T>>2)%2){const x=Math.round(boss.x),y=Math.round(boss.y-26);ctx.fillStyle='#ff2030';ctx.fillRect(x-1,y,3,6);ctx.fillRect(x-1,y+8,3,2)}ctx.fillStyle=(T>>2)%2?'#ff2030':'#801018';const dx=Math.round(boss.dx);ctx.fillRect(dx-12,H-4,25,1);ctx.fillRect(dx-12,H-6,1,2);ctx.fillRect(dx+12,H-6,1,2);for(let y=boss.y+22;y<H-6;y+=6)ctx.fillRect(dx,Math.round(y),1,3)}
HE.forEach(h=>{if(!h.dn)return;const x=Math.round(h.x),p=Math.sin(T*.15)>0;draw(MH,x,HY-18+(p?0:-1),0);ctx.fillStyle='#401018';ctx.fillRect(x-7,HY-13,15,2);ctx.fillStyle='#ff6080';ctx.fillRect(x-7,HY-13,Math.round(15*h.rv/90),2)});
if(!ME.dn){const mx=Math.round(ME.x),my=HY-16+((T>>4)%2);ctx.fillStyle=ME.c;ctx.fillRect(mx-1,my,3,1);ctx.fillRect(mx,my+1,1,1)}
const allShots=HOST?shots:shots.concat(myShots);
allShots.forEach(s=>{const X=Math.round(s.x),Y=Math.round(s.y);if(s.k==='ijs'){ctx.globalAlpha=.4;ctx.fillStyle='#a0e8ff';ctx.fillRect(X-2,Y-2,5,5);ctx.globalAlpha=1;ctx.fillStyle='#e0f8ff';ctx.fillRect(X-1,Y,3,1);ctx.fillRect(X,Y-1,1,3);return}
if(s.k==='bo'){ctx.globalAlpha=.4;ctx.fillStyle='#ff9030';ctx.fillRect(X-2,Y-2,5,5);ctx.globalAlpha=1;ctx.fillStyle='#ffc070';ctx.fillRect(X-1,Y-1,3,3);ctx.fillStyle='#fff';ctx.fillRect(X,Y,1,1);return}
if(s.k==='vl'){const age=1-s.l/26;ctx.globalAlpha=.4;ctx.fillStyle=age<.3?'#fff080':age<.6?'#ff9a1f':'#c02010';ctx.fillRect(X-2,Y-2,4+Math.round(age*3),4+Math.round(age*3));ctx.globalAlpha=1;ctx.fillStyle=age<.3?'#ffffa0':age<.6?'#ffb030':'#ff4010';ctx.fillRect(X,Y,2,2);return}
if(s.k==='pel'){ctx.fillStyle='#fff0a0';ctx.fillRect(X,Y,1,2);ctx.globalAlpha=.4;ctx.fillRect(X-1,Y-1,3,3);ctx.globalAlpha=1;return}
const c=HE[s.o||0].c;ctx.globalAlpha=.35;ctx.fillStyle=c;ctx.fillRect(X-2,Y-2,5,5);ctx.globalAlpha=1;ctx.fillStyle=c;ctx.fillRect(X-1,Y-1,3,1);ctx.fillRect(X-1,Y+1,3,1);ctx.fillRect(X-1,Y,1,1);ctx.fillRect(X+1,Y,1,1);ctx.fillStyle='#fff';ctx.fillRect(X,Y,1,1)});
balls.forEach(o=>{const X=Math.round(o.x),Y=Math.round(o.y);if(o.k==='fl'){ctx.globalAlpha=.35;ctx.fillStyle='#8dff2a';ctx.fillRect(X-2,Y-3,5,7);ctx.globalAlpha=1;ctx.fillStyle='#5fbf1a';ctx.fillRect(X-1,Y-3,3,1);ctx.fillRect(X,Y-4,1,1);ctx.fillStyle='#8dff2a';ctx.fillRect(X-1,Y-2,3,4);ctx.fillStyle='#e8ffb0';ctx.fillRect(X,Y,1,1)}
else if(o.k==='st'){ctx.fillStyle='#e8e0c0';ctx.fillRect(X,Y-3,1,3);ctx.fillStyle='#ff3040';ctx.fillRect(X,Y,1,1)}
else if(o.k==='wb'){ctx.fillStyle='#e8e8f0';ctx.fillRect(X-1,Y,3,1);ctx.fillRect(X,Y-1,1,3);ctx.globalAlpha=.5;ctx.fillRect(X-2,Y-2,1,1);ctx.fillRect(X+2,Y-2,1,1);ctx.fillRect(X-2,Y+2,1,1);ctx.fillRect(X+2,Y+2,1,1);ctx.globalAlpha=1}
else if(o.k==='gw'){ctx.globalAlpha=.6;ctx.fillStyle='#a060c0';ctx.fillRect(X-2,Y-1,4,3);ctx.fillStyle='#8ab040';ctx.fillRect(X-1,Y-2,3,3);ctx.globalAlpha=1}
else if(o.k==='rb'){ctx.globalAlpha=.4;ctx.fillStyle=boss?boss.C.glow:'#8dff2a';ctx.fillRect(X-2,Y-2,5,5);ctx.globalAlpha=1;ctx.fillRect(X-1,Y-1,3,3);ctx.fillStyle='#fff';ctx.fillRect(X,Y,1,1)}
else{ctx.fillStyle='#8dff2a';ctx.fillRect(X,Y,1,2);ctx.fillStyle='#5fbf1a';ctx.fillRect(X,Y-1,1,1)}});
parts.forEach(p=>{ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.s,p.s)});
rings.forEach(r=>{ctx.globalAlpha=Math.max(0,r.l/12);ctx.fillStyle=r.c||'#c8ff80';for(let i=0;i<20;i++){const a=i/20*6.283;ctx.fillRect(Math.round(r.x+Math.cos(a)*r.r),Math.round(r.y+Math.sin(a)*r.r),1,1)}ctx.globalAlpha=1});
if(fx==='hut'){fog.forEach(f=>{ctx.fillStyle='rgba(180,190,200,0.06)';ctx.fillRect(Math.round(f.x),Math.round(f.y),Math.round(f.w),4);ctx.fillRect(Math.round(f.x+5),Math.round(f.y+2),Math.round(f.w-10),3)})}
spores.forEach(s=>{const a=.25+.25*Math.sin(T*.05+s.p);ctx.fillStyle=fx==='ander'?`rgba(255,120,140,${a.toFixed(2)})`:`rgba(255,200,210,${(a*.7).toFixed(2)})`;ctx.fillRect(Math.round(s.x),Math.round(s.y),1,1)});
if(boss){const w=100,x=20,f=Math.max(0,boss.hp/boss.mx);ctx.fillStyle='#200008';ctx.fillRect(x-1,2,w+2,4);ctx.fillStyle='#ff2040';ctx.fillRect(x,3,Math.round(w*f),2);ctx.fillStyle='#ffa0b0';ctx.fillRect(x,3,Math.round(w*f),1)}
ctx.restore();ctx.fillStyle=cur.tint;ctx.fillRect(0,0,W,H);
if(flash>0&&flash%3){ctx.fillStyle=fx==='ander'?'rgba(255,40,70,0.12)':'rgba(200,210,255,0.08)';ctx.fillRect(0,0,W,H)}
if(gst!=='titel')HE.forEach((h,i)=>{for(let k=0;k<5;k++){const x=i?W-6-k*6:6+k*6;draw(k<h.hp?MH:MHe,x,11,0)}const ic=[];if(h.pu&&IC[h.pu])ic.push([IC[h.pu],h.puT/600]);if(h.shT>0)ic.push([IC.schild,h.shT/900]);if(h.drT>0)ic.push([IC.drone,h.drT/900]);ic.forEach(([s,f],j)=>{const x=i?W-37-j*11:37+j*11;draw(s,x,11,.5);ctx.fillStyle=h.c;ctx.fillRect(x-4,16,Math.round(f*8),1)})})}
const dkC=mk(W,H),elTitel=document.getElementById('sw-titel'),elVerder=document.getElementById('sw-verder');
const elMij=document.getElementById('sw-mij'),elVr=document.getElementById('sw-vr'),elLv=document.getElementById('sw-lv'),elMsg=document.getElementById('sw-msg'),elEind=document.getElementById('sw-eind'),elEindT=document.getElementById('sw-eind-tekst');
let uiMsg=null,uiEind=null,uiKlaar=null;const elKlaar=document.getElementById('sw-klaar'),elKlaar2=document.getElementById('sw-klaar2'),elBV=document.getElementById('sw-verhaal'),elBE=document.getElementById('sw-eindeloos');
function ui(){if(T%5)return;elMij.textContent=ME.sc;elVr.textContent=OT.sc;elLv.textContent=gst==='titel'?'':(gm==='e'?'Golf '+(ewv+1):'Level '+(lv+1))+' \u00b7 '+cur.n;elTitel.style.display=gst==='titel'?'flex':'none';const mi=HOST?0:1,ik=rdy[mi],zij=rdy[1-mi],NM={verhaal:'Verhaal',eindeloos:'Eindeloos',verder:'Door: eindeloos'};
const kt=ik&&ik===zij?'Daar gaan we!':ik?'\u2714 Jij bent klaar voor '+NM[ik]+'. Wachten op '+vriendNaam+'...':zij?vriendNaam+' wil '+NM[zij]+' spelen. Druk ook op '+NM[zij]+'!':'Kies samen een spel. Het start als jullie allebei klaar zijn.';
if(kt!==uiKlaar){uiKlaar=kt;elKlaar.textContent=kt;elKlaar2.textContent=gst==='klaar'&&gm==='v'?kt.replace('Kies samen een spel. Het start als jullie allebei klaar zijn.','Allebei op Door drukken om verder te spelen.'):'';
elBV.textContent=(ik==='verhaal'?'\u2714 ':'\u25B6 ')+'Verhaal \u00b7 5 levels'+(zij==='verhaal'?' \u2190':'');elBE.textContent=(ik==='eindeloos'?'\u2714 ':'\u221E ')+'Eindeloos'+(zij==='eindeloos'?' \u2190':'');elVerder.textContent=(ik==='verder'?'\u2714 ':'\u221E ')+'Door: eindeloos'+(zij==='verder'?' \u2190':'');
elBV.style.background=ik==='verhaal'?'rgba(141,255,42,0.3)':'rgba(20,0,10,0.75)';elBE.style.background=ik==='eindeloos'?'rgba(255,48,80,0.3)':'rgba(20,0,10,0.75)';elVerder.style.background=ik==='verder'?'rgba(255,48,80,0.3)':'rgba(20,0,10,0.75)'}
let m='';if(gst==='titel')m='';else if(gst==='aftel')m='START IN '+Math.max(1,Math.ceil(stT/60));else if(!HOST&&lastSnap&&performance.now()-lastSnap>4000)m='WACHTEN OP '+vriendNaam.toUpperCase()+'...';else if(bannerT>0)m=banner;else if(ME.dn&&gst==='spel')m='GERAAKT! WACHT OP DE VOLGENDE GOLF';
if(m!==uiMsg){elMsg.textContent=m;uiMsg=m}
const e=(gst==='over'||gst==='klaar')?gst:'';if(e!==uiEind){uiEind=e;if(e){const tt=e==='klaar'?'GEWONNEN!':'GAME OVER';elEindT.innerHTML='<div style="font-size:26px;color:'+(e==='klaar'?'#8dff2a':'#ff4060')+';text-shadow:0 0 10px currentColor;">'+tt+'</div><div style="margin-top:8px;">'+(gm==='e'?'Golf '+(ewv+1):'Level '+(lv+1))+' \u00b7 '+cur.n+'</div><div style="margin-top:4px;">Jij: '+ME.sc+' \u00b7 '+esc(vriendNaam)+': '+OT.sc+'</div><div style="margin-top:4px;color:#ffe060;">Samen: '+(ME.sc+OT.sc)+'</div>';elVerder.style.display=e==='klaar'&&gm==='v'?'':'none';elEind.style.display='flex'}else elEind.style.display='none'}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';')}
function send(ev,payload){try{spelKanaal.send({type:'broadcast',event:ev,payload})}catch(e){}}
function net(){if(HOST)send('sw-st',snap());else send('sw-in',{x:r1(ME.tx),n:shotN})}
spelKanaal.on('broadcast',{event:'sw-st'},msg=>{if(!alive||HOST)return;try{applySnap(msg.payload)}catch(e){console.warn('[swarm] stand',e)}});
spelKanaal.on('broadcast',{event:'sw-in'},msg=>{if(!alive||!HOST)return;const p=msg.payload||{};lastIn=performance.now();if(typeof p.x==='number')OT.tx=CL(p.x,8,W-8);if(typeof p.n==='number'){if(p.n<lastN)lastN=p.n;if(p.n>lastN){let k=Math.min(3,p.n-lastN);lastN=p.n;while(k-->0){OT.cd=0;shoot(OT,1)}}}});
spelKanaal.on('broadcast',{event:'sw-cmd'},msg=>{if(!alive||!HOST)return;const p=msg.payload||{};hostCmd(p.c,1)});
function cmd(c){const a=ac();if(a&&a.state==='suspended')a.resume();if(HOST)hostCmd(c,0);else{send('sw-cmd',{c});const i=1;if(rdy[i]===c)rdy[i]=null;else if(c!=='titel')rdy[i]=c}}
document.getElementById('sw-opnieuw').onclick=()=>cmd('titel');elVerder.onclick=()=>cmd('verder');
document.getElementById('sw-verhaal').onclick=()=>cmd('verhaal');document.getElementById('sw-eindeloos').onclick=()=>cmd('eindeloos');
const sndBtn=document.getElementById('sw-snd');sndBtn.onclick=()=>{snd=!snd;sndBtn.textContent=snd?'\u{1F50A}':'\u{1F507}';const a=ac();if(a&&a.state==='suspended')a.resume()};
let pd=null;const keys={l:0,r:0};
const vlak=document.getElementById('spelOverlay')||inhoud;
const oudStijl={t:inhoud.style.touchAction,u:inhoud.style.userSelect,w:inhoud.style.webkitUserSelect,c:inhoud.style.webkitTouchCallout,v:vlak.style.webkitTapHighlightColor,vu:vlak.style.userSelect,vw:vlak.style.webkitUserSelect};
inhoud.style.touchAction='none';inhoud.style.userSelect='none';inhoud.style.webkitUserSelect='none';inhoud.style.webkitTouchCallout='none';vlak.style.webkitTapHighlightColor='transparent';vlak.style.userSelect='none';vlak.style.webkitUserSelect='none';
function isKnop(t){return!!(t&&t.closest&&t.closest('button,a,input,select,textarea'))}
function pDown(e){if(!alive||!isActief()||isKnop(e.target))return;const a=ac();if(a&&a.state==='suspended')a.resume();pd={id:e.pointerId,t:performance.now(),m:0,lx:e.clientX};if(e.cancelable)e.preventDefault()}
function pMove(e){if(!pd||e.pointerId!==pd.id)return;const s=W/cv.getBoundingClientRect().width,dx=(e.clientX-pd.lx)*s;pd.lx=e.clientX;pd.m+=Math.abs(dx);ME.tx=CL(ME.tx+dx*1.3,8,W-8);if(e.cancelable)e.preventDefault()}
function pUp(e){if(!pd||e.pointerId!==pd.id)return;if(pd.m<3&&performance.now()-pd.t<300)shoot(ME,HOST?0:1);pd=null}
function pCancel(){pd=null}
function tMove(e){if(pd&&e.cancelable)e.preventDefault()}
function selStop(e){if(alive&&isActief())e.preventDefault()}
vlak.addEventListener('pointerdown',pDown);window.addEventListener('pointermove',pMove);window.addEventListener('pointerup',pUp);window.addEventListener('pointercancel',pCancel);vlak.addEventListener('touchmove',tMove,{passive:false});vlak.addEventListener('selectstart',selStop);vlak.addEventListener('contextmenu',selStop);
function kd(e){if(!alive||!isActief())return;if(e.key==='ArrowLeft'){keys.l=1;e.preventDefault()}else if(e.key==='ArrowRight'){keys.r=1;e.preventDefault()}else if(e.key===' '){shoot(ME,HOST?0:1);e.preventDefault()}}
function ku(e){if(e.key==='ArrowLeft')keys.l=0;else if(e.key==='ArrowRight')keys.r=0}
function kblur(){keys.l=0;keys.r=0}
window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('blur',kblur);
let alive=true,raf=0,acc=0,lastT=performance.now(),stapN=0;
function stop(){if(!alive)return;alive=false;cancelAnimationFrame(raf);clearInterval(wacht);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('blur',kblur);vlak.removeEventListener('pointerdown',pDown);window.removeEventListener('pointermove',pMove);window.removeEventListener('pointerup',pUp);window.removeEventListener('pointercancel',pCancel);vlak.removeEventListener('touchmove',tMove);vlak.removeEventListener('selectstart',selStop);vlak.removeEventListener('contextmenu',selStop);inhoud.style.touchAction=oudStijl.t;inhoud.style.userSelect=oudStijl.u;inhoud.style.webkitUserSelect=oudStijl.w;inhoud.style.webkitTouchCallout=oudStijl.c;vlak.style.webkitTapHighlightColor=oudStijl.v;vlak.style.userSelect=oudStijl.vu;vlak.style.webkitUserSelect=oudStijl.vw;try{if(AC)AC.close()}catch(e){}}
const wacht=setInterval(()=>{if(!isActief())stop()},1000);
function frame(now){if(!alive)return;if(!isActief()){stop();return}
acc+=Math.min(100,now-lastT);lastT=now;const STEP=1000/60;
while(acc>=STEP){acc-=STEP;stapN++;if(slowT>0){if(HOST)slowT--;if(stapN%2)continue}if(keys.l!==keys.r)ME.tx=CL(ME.tx+(keys.r-keys.l)*1.4,8,W-8);if(HOST)hostUpd();else guestUpd();if(T%6===0)net();if(ME.hp<ME.php){tril(70);shk=Math.max(shk,10);shA=Math.max(shA,1)}ME.php=ME.hp}
render();ui();raf=requestAnimationFrame(frame);window._spelAnimFrame=raf}
laadWav();
if(HOST)naarTitel();else setLevelLocal(0);
raf=requestAnimationFrame(frame);window._spelAnimFrame=raf;
}
