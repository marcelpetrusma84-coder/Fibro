import { maakEindscene } from './koningsjacht-eindscene.js?v=8'
// koningsjacht-ui.js - Koningsjacht, een kaartspel voor alleen (v1, 13 nov 2026). Op de BLAUWDRUK voor kaartspellen.
// Gebaseerd op het idee van Regicide (Badgers From Mars); de naam, de teksten en de uitwerking zijn van Stekky.
//
// In gewone woorden: de regels staan in koningsjacht.js, de tafel in kaartspel-hulp.js (met de perkamentkaarten en
// een houten tafelblad). Bovenin staat de vijand uit het kasteel, met zijn leven, zijn aanval en je schild.
// Kies kaarten en veeg ze omhoog (of tik op Aanvallen). Slaat de vijand terug, kies dan kaarten om af te werpen.
// Alleen tegen het kasteel: er is geen spelkanaal (solo.js: zonderKanaal). Het spel wordt op dit toestel bewaard,
// zodat je later verder kunt (fibro_koningsjacht_stand), net als je beste medaille per niveau (fibro_koningsjacht_best).
// v2 (13 nov 2026, Marcel): stoere geluiden en epische muziek (koningsjacht-geluid.js, knop 🎵), en aanvallen met licht:
// je kaarten vliegen gloeiend naar de vijand, een zwaardhaal van licht, vonken, een lichtflits en de tafel trilt. Elke
// soort heeft zijn eigen licht: ♣ twee halen (dubbel), ♠ een blauw schild, ♥ rode hartjes naar de taveerne, ♦ paarse
// fonkels. De vijand slaat terug met drie rode klauwhalen. Verslagen: gouden licht en brokstukken.
// v5 (13 nov 2026, Marcel): met z'n tweeën in de chat (spelKanaal), op drie manieren (speler 1 kiest):
//   samen     één kasteel, om de beurt (koningsjacht.js samen); de hele stand gaat over het kanaal ('zet', 'stand')
//   wedstrijd ieder een eigen spel met hetzelfde kasteel (zaadje); je ziet elkaars stand ('voortgang'). Wie het
//             verst komt (of het eerst alle 12 verslaat), wint
//   duel      als wedstrijd, maar precies raak = een vloek naar de ander ('vloek'): zijn vijand krijgt 10 leven erbij
//   beleg     (v6) ieder een eigen kasteel, om de beurt: je valt de voorste wachter van de ander aan en weert zijn
//             klap af (koningsjacht.js nieuwBeleg/belegStap). De hele stand gaat over het kanaal, net als bij samen
// Speler 1 kiest de manier en het niveau ('opnieuw'); speler 2 wacht. Wie later binnenkomt, vraagt de stand op.
// v4 (13 nov 2026, Marcel): kaarslicht. Twee kaarsen op tafel met flakkerende vlammen; de randen van de tafel zijn
// donker en het warme licht flakkert mee. Aan/uit met 🕯️ (bewaard: fibro_koningsjacht_kaars, standaard aan).
// v58 (25 nov 2026): ook kaarten in de aflegzone worden als hologram geprojecteerd.
import * as K from './koningsjacht.js?v=2'
import { maakKaartTafel, kaartSvg, achterkantSvg, kaartNaam, KLEUR_TEKEN, zetStijl, REACTIES, KAART_INSTELLINGEN, kaartInstellingen, zetKaartInstelling } from './kaartspel-hulp.js?v=22'
import { speel as geluid, muziekStaatAan, zetMuziek, startMuziek, stopMuziek, zetMuziekThema } from './koningsjacht-geluid.js?v=4'
import { maakKoningsjachtScene } from './koningsjacht-scene.js?v=16'
import { zetKaarsSlijtage } from './koningsjacht-kaarsen.js?v=1'
import { verbindBierpul, herstelBierPartij } from './koningsjacht-bier.js?v=2'
import { maakKoningsjachtScoreService } from './koningsjacht-scores.js?v=2'
import { maakKoningsjachtScorebord } from './koningsjacht-scoreboard.js?v=4'
import { maakScorePartij } from './koningsjacht-score-partij.js?v=1'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const BEWAAR = 'fibro_koningsjacht_stand', BESTE = 'fibro_koningsjacht_best'
const SOORT = { B: 'Boer', V: 'Vrouw', H: 'Heer' }
const KLEURNAAM = { h: 'harten', r: 'ruiten', k: 'klaveren', s: 'schoppen' }
const MEDAILLE = { goud: '🥇', zilver: '🥈', brons: '🥉' }
const NIVEAU_NAAM = { schildknaap: 'Schildknaap', ridder: 'Ridder', koning: 'Koning' }
const RUIMTE_SCENES = ['ruimteschip-oud', 'ruimteschip-futuristisch']
const isRuimteScene = scene => RUIMTE_SCENES.includes(scene)
const lees = (k, std) => { try { const w = localStorage.getItem(k); return w === null ? std : JSON.parse(w) } catch (e) { return std } }
const schrijf = (k, w) => { try { if (w === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(w)) } catch (e) {} }
export const vijandNaam = id => T('{soort} van {kleur}', { soort: T(SOORT[id.slice(1)]), kleur: T(KLEURNAAM[id[0]]) })

const CSS = `
.kj-score-status{font:12px/1.4 system-ui;color:inherit;opacity:.85;margin:8px 0 0}
.kt-einde:has(.kj-eindscene){overflow:auto;align-items:safe center}
.kt-eindekaart:has(.kj-eindscene){width:min(680px,calc(100vw - 24px));box-sizing:border-box;max-height:calc(100dvh - 32px);overflow:auto}

.kj-start{width:100%;height:100%;overflow:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 18px 22px;box-sizing:border-box;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;
  background:radial-gradient(ellipse at 50% 40%,#0000 30%,#000a 100%),url(kaarten/hout.webp?v=1) center/cover #4a2c16}
.kj-start *{box-sizing:border-box}
.kj-titel{font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:900;letter-spacing:1px;text-shadow:0 2px 0 #3a1d08,0 0 18px #f5b30188;color:#fde68a}
.kj-uitleg{max-width:340px;font-size:14px;line-height:1.45;opacity:.92;text-shadow:0 1px 3px #000}
.kj-kaarten{display:flex;justify-content:center;margin:2px 0 6px}
.kj-kaarten>div{width:62px;height:87px;border-radius:5px;box-shadow:0 4px 12px #000a}
.kj-kaarten>div+div{margin-left:-18px}
.kj-kaarten>div:nth-child(1){transform:rotate(-12deg) translateY(6px)}.kj-kaarten>div:nth-child(3){transform:rotate(12deg) translateY(6px)}
.kj-niveaus{display:flex;flex-direction:column;gap:9px;width:100%;max-width:330px}
.kj-niveau{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;border:1px solid #f5d08a66;background:#2a1608d9;color:#fff;font:inherit;text-align:left;cursor:pointer;box-shadow:0 3px 10px #0008}
.kj-niveau:active{transform:scale(.98)}
.kj-niveau[aria-pressed=true]{border-color:#fde68a;background:#5a3410e6;box-shadow:0 0 16px #f5b30188}
.kj-niveau b{display:block;font-size:16px}.kj-niveau small{display:block;font-size:12px;opacity:.8}
.kj-niveau .kj-ico{font-size:26px}.kj-niveau .kj-med{margin-left:auto;font-size:22px}
.kj-knop{min-height:42px;padding:9px 16px;border-radius:12px;border:1px solid #c084fc;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 0 14px #8b3fd1aa}
.kj-knop.kj-zacht{background:#ffffff1c;border-color:#ffffff40;box-shadow:none}
.kj-bron{font-size:11px;opacity:.7;max-width:320px;text-shadow:0 1px 2px #000}
.kj-regels{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:#000b;padding:16px}
.kj-regelkaart{max-width:420px;max-height:86vh;overflow:auto;padding:18px 18px 14px;border-radius:16px;background:#f3e6c8;color:#2a1608;border:3px solid #8a5a2b;box-shadow:0 10px 40px #000;text-align:left;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.45}
.kj-regelkaart h2{margin:0 0 8px;font-size:22px;text-align:center}
.kj-regelkaart h3{margin:12px 0 4px;font-size:16px}
.kj-regelkaart p{margin:0 0 6px}.kj-regelkaart ul{margin:0 0 6px;padding-left:20px}
.kj-regelkaart .kj-knop{display:block;margin:12px auto 0;font-family:system-ui,sans-serif}
.kt-tafel.kj .kt-ander{min-height:132px;padding-top:4px;gap:14px}
.kt-tafel.kj .kt-ander>:not(.kj-vijand){display:none!important}
.kt-tafel.kj .kt-zetel-ik{display:none}
.kt-tafel.kj .kt-status{order:1;margin-top:10px}.kt-tafel.kj .kt-ander{order:0}.kt-tafel.kj .kt-midden{order:2}.kt-tafel.kj .kt-hand{order:3}.kt-tafel.kj .kt-onder{order:4}
.kj-vijand{display:flex;align-items:center;gap:clamp(6px,2vw,12px);width:min(100%,460px);min-width:0}
.kj-kasteel{position:relative;width:46px;height:64px;flex:none}
.kj-kasteel>div{position:absolute;inset:0;border-radius:4px;box-shadow:0 1px 4px #0009}
.kj-kasteel>div:nth-child(2){transform:translate(-2px,-3px)}.kj-kasteel>div:nth-child(3){transform:translate(-4px,-6px)}
.kj-kasteel>span{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);font-size:11px;font-weight:800;white-space:nowrap;text-shadow:0 1px 3px #000}
.kj-kaart{position:relative;width:86px;height:120px;flex:none;border-radius:7%;box-shadow:0 6px 18px #000b}
.kj-kaart.kj-geraakt{animation:kjRaak .45s}
@keyframes kjRaak{0%,100%{transform:none;filter:none}20%{transform:translateX(-7px) rotate(-3deg);filter:brightness(1.6) sepia(1) hue-rotate(-50deg) saturate(4)}45%{transform:translateX(6px) rotate(2deg)}70%{transform:translateX(-3px)}}
.kj-stats{display:flex;flex:1;flex-direction:column;gap:6px;min-width:0;text-shadow:0 1px 3px #000}
.kj-naam{font-weight:800;font-size:15px;font-family:Georgia,'Times New Roman',serif}
.kj-hud{display:flex;align-items:stretch;width:100%;min-width:0;padding:3px;border:1px solid #9b8964;border-radius:4px;background:linear-gradient(135deg,#b3a17b,#4c4c42 24%,#242b29 57%,#8b7958);box-shadow:inset 0 1px #ece2b77a,0 3px 0 #111914,0 5px 10px #000b}
.kj-wachters{flex:0 0 34px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:-3px 3px -3px -3px;border:2px solid #847659;border-radius:3px;background:radial-gradient(ellipse at top,#193538,#071518 75%);box-shadow:inset 0 0 6px #000,1px 0 0 #080b08;color:#fff5d9}
.kj-wachters b{font:800 20px/1 Georgia,serif;text-shadow:0 2px 2px #000}
.kj-wachters small{font:700 9px/1.2 system-ui;color:#c9b993;margin-top:3px}
.kj-hud-balken{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.kj-hud .kj-balk{position:relative;height:23px;border-radius:1px;background:#071b0b;border:1px solid #0a0e08;overflow:hidden;box-shadow:inset 0 1px 4px #000}
.kj-hud .kj-vul,.kj-schade-spoor{position:absolute;left:0;top:0;bottom:0;width:0;transition:width .55s cubic-bezier(.3,.7,.3,1)}
.kj-hud .kj-vul{background:linear-gradient(180deg,#9bd65b 0%,#63af32 20%,#338519 52%,#246312 54%,#4d981f 100%);box-shadow:inset 0 1px #d5f699aa,inset 0 -1px #102e08}
.kj-schade-spoor{background:#c8b67d;transition:width 1.1s ease .25s}
.kj-hud .kj-balk::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(var(--kj-segment,25%) - 1px),#071a10cc calc(var(--kj-segment,25%) - 1px),#071a10cc var(--kj-segment,25%));mask-image:linear-gradient(#000 0 38%,transparent 75%)}
.kj-hud .kj-balk span{position:absolute;z-index:1;inset:0;display:grid;place-items:center;color:#fffef1;font:800 11px/1 system-ui;white-space:nowrap;text-shadow:0 1px 2px #000,1px 0 2px #000,-1px 0 2px #000}
.kj-schildbalk{position:relative;height:12px;border:1px solid #071116;background:#06121b;overflow:hidden;box-shadow:inset 0 1px 3px #000}
.kj-schildvul{position:absolute;inset:0 auto 0 0;width:0;background:linear-gradient(#91def4,#2ba2ca 40%,#127798 55%,#1f90b0);box-shadow:inset 0 1px #c9f5ff99;transition:width .55s ease}
.kj-schildbalk span{position:absolute;inset:0;text-align:center;color:#f1fcff;font:800 9px/10px system-ui;text-shadow:0 1px 2px #000,1px 0 2px #000,-1px 0 2px #000}
.kj-regel{font-size:13px;font-weight:700;display:flex;gap:4px 10px;flex-wrap:wrap}
@media(max-width:360px){.kj-vijand .kj-kaart{width:68px;height:95px}.kj-vijand .kj-kasteel{width:36px;height:50px}.kj-wachters{flex-basis:28px}.kj-naam{font-size:13px}}
@media(prefers-reduced-motion:reduce){.kj-hud .kj-vul,.kj-schade-spoor,.kj-schildvul{transition:none}}
.kj-immuun{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px;line-height:1.35}
.kj-immuun-icoon{display:inline-grid;place-items:center;flex:none;width:38px;height:38px;border-radius:10px;border:2px solid #f6ead4;background:linear-gradient(145deg,#fffaf0,#e5ddd1 64%,#c6bdb1);box-shadow:inset 0 1px #fff,inset 0 -2px 2px #74634d55,0 2px 0 #514535,0 4px 8px #0009}
.kj-immuun-icoon span{font:bold 31px/1 Georgia,serif;color:var(--kj-suit);-webkit-text-fill-color:var(--kj-suit);-webkit-text-stroke:.35px var(--kj-suit-dark);filter:drop-shadow(0 1px 0 #fff) drop-shadow(0 2px 1px #655a4b77)}
.kj-immuun-icoon[data-kleur=h]{--kj-suit:#a3212b;--kj-suit-dark:#68141e}
.kj-immuun-icoon[data-kleur=r]{--kj-suit:#6d2a84;--kj-suit-dark:#411850}
.kj-immuun-icoon[data-kleur=k]{--kj-suit:#2e5b2a;--kj-suit-dark:#173b16}
.kj-immuun-icoon[data-kleur=s]{--kj-suit:#1d2d55;--kj-suit-dark:#101c36}
.kj-modern .kj-immuun-icoon{border-color:#e5d6ae;background:linear-gradient(145deg,#fff8e9,#e3e6e7 70%,#b7c2c7)}
.kj-modern .kj-immuun-icoon[data-kleur=h],.kj-modern .kj-immuun-icoon[data-kleur=r]{--kj-suit:#b92644;--kj-suit-dark:#681628}
.kj-modern .kj-immuun-icoon[data-kleur=k],.kj-modern .kj-immuun-icoon[data-kleur=s]{--kj-suit:#55441e;--kj-suit-dark:#312710}
.kj-raakgetal{position:fixed;z-index:50;font-weight:900;font-size:34px;color:#fecaca;text-shadow:0 0 10px #ef4444,0 2px 0 #450a0a;pointer-events:none;white-space:nowrap}
.kj .kt-kaart.kt-mag{box-shadow:0 2px 8px #0007}
.kj .kt-kaart.kt-gekozen{box-shadow:0 0 0 3px #fde68a,0 0 26px #f5b301,0 8px 20px #000a}
.kt-tafel.kj .kt-midden > :is(.kt-stapel-groep,.kt-afleg){translate:0 calc(var(--kj-hand-verschil, 0px) / 2)}
.kt-tafel.kj .kt-midden > .kj-kaars{translate:0 calc(var(--kj-hand-verschil, 0px) * .9)}
/* Langwerpige projecties volgen de draaiing van iedere kaart en liggen achter de kaart zelf. */
.kt-tafel.kj.kj-tafelschaduw .kt-kaart::before{content:"";position:absolute;inset:0;border-radius:inherit;background:rgba(0,0,0,.68);transform:translate(-20%,25%) skewX(-15deg) scaleY(.85);transform-origin:bottom center;filter:blur(3px);z-index:0;pointer-events:none}
.kt-tafel.kj.kj-tafelschaduw :is(.kt-stapel,.kt-afleg,.kj-kasteel){filter:drop-shadow(-13px 18px 4px rgba(0,0,0,.65))}
/* De bediening ligt boven de kaartschaduwen, met zacht tafellicht voor extra contrast. */
.kt-tafel.kj.kj-tafelschaduw .kt-onder{z-index:450}
.kt-tafel.kj.kj-tafelschaduw .kt-onder::before{content:"";position:absolute;inset:-5px 0;z-index:-1;pointer-events:none;border-radius:24px;background:radial-gradient(ellipse at center,rgba(190,137,65,.42),rgba(100,61,27,.18) 60%,transparent 78%)}
.kj .kt-vlieg .kt-v{box-shadow:0 0 18px #f5b301b0,0 6px 18px #000a}
.kj-fx{position:absolute;inset:0;pointer-events:none;z-index:45;overflow:hidden}
.kj-fx>*{position:absolute;pointer-events:none}
.kj-licht{border-radius:50%;mix-blend-mode:screen}
.kj-vonk{width:7px;height:7px;border-radius:50%;mix-blend-mode:screen}
.kj-haal{overflow:visible;z-index:1}
.kj-gloeit{filter:brightness(1.35) drop-shadow(0 0 10px var(--kj-gloed,#f5b301)) drop-shadow(0 0 22px var(--kj-gloed,#f5b301))}
.kj-flits{position:absolute;inset:0;z-index:40;pointer-events:none;background:radial-gradient(ellipse at 50% 20%,#ef444466,#0000 70%)}
.kj-herstart-golf{position:absolute;inset:0;z-index:80;pointer-events:none;background:linear-gradient(0deg,#55eaffee 0%,#38bdf855 38%,#38bdf800 85%);transform:translateY(105%);animation:kjHerstartGolf .72s cubic-bezier(.18,.72,.24,1) forwards}
@keyframes kjHerstartGolf{0%{transform:translateY(105%);opacity:0}18%{opacity:1}100%{transform:translateY(-105%);opacity:.9}}
@media(prefers-reduced-motion:reduce){.kj-herstart-golf{animation-duration:.18s}}
.kj-koepel{z-index:2;border-radius:50% 50% 12px 12px/80% 80% 12px 12px;border:3px solid #93c5fd;background:radial-gradient(ellipse at 50% 100%,#60a5fa55,#3b82f611 60%,#0000 75%);box-shadow:0 0 30px #60a5fa,inset 0 0 30px #93c5fd88}
.kj-koepel-spaceship{isolation:isolate;border-color:#a5fff2;background:radial-gradient(ellipse at 50% 96%,#5dffe544,#27cbbd23 38%,#4ef3eb0d 68%,transparent 78%);box-shadow:0 0 9px #c7fff2,0 0 30px #16e8d9,0 0 72px #0b9eafa6,inset 0 -6px 26px #9effefaa,inset 0 0 62px #16dacc70}
.kj-koepel-spaceship::before{content:"";position:absolute;inset:8% 5% 1%;border:1px solid #c7fff2bb;border-radius:50% 50% 12px 12px/80% 80% 12px 12px;background:repeating-conic-gradient(from -4deg at 50% 100%,#c9fff225 0deg .45deg,transparent .8deg 12deg);mask-image:linear-gradient(180deg,#000 0%,#000b 48%,transparent 100%);box-shadow:inset 0 0 18px #6fffe766;animation:kjShieldField 2.6s ease-in-out infinite alternate}
.kj-koepel-spaceship::after{content:"";position:absolute;left:12%;right:12%;bottom:4%;height:34%;border:2px solid #c5fff2d9;border-radius:50%;box-shadow:0 0 8px #e2fff7,0 0 24px #38f5e9, inset 0 0 14px #96fff1aa;transform:scale(.72,.42);opacity:0;animation:kjShieldRipple 1.45s cubic-bezier(.12,.55,.3,1) infinite}
@keyframes kjShieldField{from{opacity:.68;filter:brightness(.9)}to{opacity:1;filter:brightness(1.35)}}
@keyframes kjShieldRipple{0%{transform:scale(.68,.35);opacity:.95}75%,100%{transform:scale(1.16,1.22);opacity:0}}
@media(prefers-reduced-motion:reduce){.kj-koepel-spaceship::before,.kj-koepel-spaceship::after{animation:none}.kj-koepel-spaceship::after{opacity:.55;transform:scale(1,.8)}}
.kj-medieval-shield{position:absolute;z-index:430;pointer-events:none;filter:drop-shadow(0 14px 11px #000d);transform-style:preserve-3d;transform-origin:50% 88%}
.kj-medieval-shield svg{display:block;width:100%;height:100%;overflow:visible}
.kt-tafel.kj .kt-effect{box-sizing:border-box;width:max-content;max-width:calc(100vw - 28px);padding:7px 12px;white-space:normal;text-align:center;text-wrap:balance;line-height:1.15;font-size:clamp(22px,8vw,48px)}
.kj-zwevend{font-size:22px;text-shadow:0 0 10px currentColor}
.kj-muziek{display:flex;align-items:center;gap:8px}
.kj-muziek[aria-pressed=true]{background:#8b3fd1;border-color:#c084fc;box-shadow:0 0 14px #8b3fd1aa}
.kj-kaarslicht{position:absolute;inset:0;pointer-events:none;z-index:30;transition:opacity .5s}
.kj-kaarslicht .kj-donker{position:absolute;inset:0;background:radial-gradient(ellipse 85% 70% at 50% 52%,#0000 25%,#0a0400a6 70%,#050200e0 100%)}
.kj-kaarslicht .kj-warm{position:absolute;inset:0;mix-blend-mode:soft-light;opacity:var(--kj-licht,.9);background:radial-gradient(circle at 12% 46%,#ffb347 0,#ff8c1a55 18%,#0000 42%),radial-gradient(circle at 88% 46%,#ffb347 0,#ff8c1a55 18%,#0000 42%)}
.kj-kaarslicht .kj-gloed{position:absolute;inset:0;mix-blend-mode:screen;opacity:calc(var(--kj-licht,.9) * .55);background:radial-gradient(circle at 12% 46%,#ffcf7a66 0,#ff9a2e22 14%,#0000 30%),radial-gradient(circle at 88% 46%,#ffcf7a66 0,#ff9a2e22 14%,#0000 30%)}
.kj-spaceship-lamplicht{display:none;position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;isolation:isolate;mix-blend-mode:screen}
.kj-ruimteschip .kj-spaceship-lamplicht{display:block}
.kj.kj-geenkaars .kj-spaceship-lamplicht{display:none}
.kj-spaceship-lamplicht::before{content:"";position:absolute;inset:70% 4% 8%;background:radial-gradient(ellipse 17% 70% at 13% 48%,#ff72d62b,transparent 76%),radial-gradient(ellipse 17% 70% at 87% 48%,#a77aff30,transparent 76%);filter:blur(12px);opacity:.95}
.kj-spaceship-lamplicht::after{content:"";position:absolute;inset:48% 4% 12%;pointer-events:none;background:radial-gradient(ellipse 9% 48% at 11% 58%,#ff78e512,transparent 72%),radial-gradient(ellipse 8% 44% at 18% 42%,#c78aff15,transparent 72%),radial-gradient(ellipse 8% 45% at 82% 47%,#80dfff14,transparent 72%),radial-gradient(ellipse 9% 48% at 89% 60%,#ff8bce12,transparent 72%);filter:blur(8px);mix-blend-mode:screen;animation:kjShipHazeDrift 7s ease-in-out infinite alternate}
.kj-ship-beam{position:absolute;top:40%;height:36%;width:12%;clip-path:polygon(48% 0,52% 0,100% 100%,0 100%);filter:blur(4px);opacity:.45;transform-origin:50% 0;mix-blend-mode:screen;background:linear-gradient(180deg,#ffd2fdbb 0%,#ff73d967 20%,#c56bff42 54%,#68d9ff22 82%,transparent 100%);animation:kjShipBeamBreath 5.2s ease-in-out infinite alternate}
.kj-ship-beam::before{content:"";position:absolute;inset:0;clip-path:inherit;background:radial-gradient(ellipse at 40% 38%,#ff8ee526,transparent 50%),radial-gradient(ellipse at 66% 61%,#81dfff20,transparent 48%),radial-gradient(ellipse at 48% 78%,#d29aff25,transparent 48%);filter:blur(5px);animation:kjShipHazeDrift 6s ease-in-out infinite alternate}
.kj-ship-beam::after{content:"";position:absolute;left:47%;top:2%;bottom:8%;width:6%;border-radius:50%;background:linear-gradient(180deg,#fff1ff9c,#ff9bea55 35%,#b8a3ff44 68%,#9be8ff16);filter:blur(2px);opacity:.6}
.kj-ship-beam:nth-child(1){left:1.5%;transform:rotate(12deg);background:linear-gradient(180deg,#ffe0fdbb 0%,#ff73c967 24%,#d977ff42 56%,#9c83ff22 82%,transparent 100%)}
.kj-ship-beam:nth-child(2){left:6%;transform:rotate(7deg);animation-delay:-1.4s;background:linear-gradient(180deg,#fff0ffb8 0%,#e77cff67 24%,#aa7cff40 58%,#7fdfff20 84%,transparent 100%)}
.kj-ship-beam:nth-child(3){left:81.5%;transform:rotate(-7deg);animation-delay:-2.6s;background:linear-gradient(180deg,#fff0ffb8 0%,#d881ff68 22%,#a48bff42 56%,#7bdfff20 84%,transparent 100%)}
.kj-ship-beam:nth-child(4){left:86%;transform:rotate(-12deg);animation-delay:-3.7s;background:linear-gradient(180deg,#ffe0fdbb 0%,#ff79d167 24%,#c56bff42 56%,#85dfff22 82%,transparent 100%)}
.kt-tafel.kj-ruimteschip.kj-holografisch :is(.kt-hand .kt-kaart,.kj-vijand .kj-kaart,.kt-afleg .kt-ak){z-index:4;background-color:#061722f0;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.kt-tafel.kj-ruimteschip.kj-holografisch .kt-afleg .kt-ak{overflow:hidden;border:1px solid #6beaffbb;box-shadow:0 0 5px #48dfff99,0 0 15px #28bce966,inset 0 0 14px #29c8e52b}
.kt-tafel.kj-ruimteschip.kj-holografisch .kt-afleg .kt-ak>.kt-svg{opacity:.94;filter:brightness(1.12) drop-shadow(0 0 3px #6beaff66)}
.kt-tafel.kj-ruimteschip.kj-holografisch .kt-afleg .kt-ak::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,#8ef4ff0d 0,#8ef4ff0d 1px,transparent 1px,transparent 4px);mix-blend-mode:screen;opacity:.8}
@keyframes kjShipBeamBreath{from{opacity:.33;filter:blur(5px) brightness(.92)}to{opacity:.5;filter:blur(3px) brightness(1.13)}}
@keyframes kjShipHazeDrift{from{transform:translate3d(-.6%,0,0);opacity:.7}to{transform:translate3d(.6%,-1%,0);opacity:1}}
.kj-geenflikkering .kj-ship-beam,.kj-geenflikkering .kj-spaceship-lamplicht::after,.kj-geenflikkering .kj-ship-beam::before{animation:none}
@media(prefers-reduced-motion:reduce){.kj-ship-beam,.kj-spaceship-lamplicht::after,.kj-ship-beam::before{animation:none}}
.kj-kaars{position:absolute;bottom:18%;width:30px;height:96px;pointer-events:none;z-index:31}
.kj-kaars.kj-links{left:calc(12% - 15px)}.kj-kaars.kj-rechts{left:calc(88% - 15px)}
.kj-kaars > svg{position:absolute;left:0;bottom:0;width:30px;height:70px}
.kj-vlam{position:absolute;left:50%;bottom:62px;width:14px;height:26px;margin-left:-7px;transform-origin:50% 100%;border-radius:50% 50% 45% 45%/65% 65% 35% 35%;
  background:radial-gradient(ellipse at 50% 72%,#fff 0,#fff6c2 22%,#ffc94a 48%,#ff7a18 75%,#ff7a1800 100%);box-shadow:0 0 18px 6px #ffb34788,0 0 44px 16px #ff8c1a44;animation:kjVlam 1.6s ease-in-out infinite alternate}
.kj-rechts .kj-vlam{animation-duration:1.3s;animation-delay:-.6s}
@keyframes kjVlam{0%{transform:scale(1,1) skewX(0)}20%{transform:scale(.94,1.08) skewX(3deg)}45%{transform:scale(1.04,.95) skewX(-2deg)}70%{transform:scale(.97,1.1) skewX(2deg)}100%{transform:scale(1.02,.97) skewX(-3deg)}}
.kj-geenflikkering .kj-vlam{animation:none}
.kj-kaars .kj-kandelaar{display:none}
.kj .kj-kaars{width:clamp(52px,15vw,92px);height:auto;aspect-ratio:1086/1448;bottom:10%;transform:translate3d(var(--kj-scene-x, 0px),var(--kj-scene-y, 0px),0);filter:drop-shadow(0 9px 6px #000b)}
.kj .kj-kaars.kj-links{left:clamp(0px,2%,18px)}.kj .kj-kaars.kj-rechts{left:auto;right:clamp(0px,2%,18px)}
.kj .kj-kaars > svg{display:none}.kj .kj-kaars .kj-kandelaar{display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.kj .kj-vlam{left:48%;bottom:95.5%;width:15%;height:24%;margin-left:-7.5%}
.kj.kj-geenkaars .kj-kaarslicht,.kj.kj-geenkaars .kj-kaars{display:none}
.kt-tafel.kj .kt-info{flex-wrap:wrap;justify-content:center;width:96%;white-space:normal;row-gap:4px}
.kt-tafel.kj .kt-status{max-width:100%;white-space:normal;text-wrap:balance;line-height:1.25}
.kt-tafel.kj .kt-onder,.kt-tafel.kj .kt-status,.kt-tafel.kj .kt-info,.kt-tafel.kj .kj-stats{position:relative;z-index:32}.kt-tafel.kj .kt-info{position:absolute}
@media (prefers-reduced-motion:reduce){.kj-vlam{animation:none}}
.kj-pil{padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #f5d08a88;font-weight:800;font-size:13px}
.kj-steen-symbool{display:none}
.kj-instellingen{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:18px;background:#100a0cd9;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.kj-instellingen-kaart{width:min(100%,400px);max-height:min(86dvh,650px);overflow:auto;padding:22px;border:1px solid #e2bb7677;border-radius:20px;background:linear-gradient(145deg,#382519,#1f1512);color:#fff8e8;box-shadow:inset 0 1px #fff3,0 18px 60px #000b;text-align:left;font:15px/1.45 system-ui,sans-serif}
.kj-instellingen-kop{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.kj-instellingen-kop h2{margin:0;font:700 22px Georgia,serif;color:#f7dda6}
.kj-instellingen-sluit{min-width:44px;min-height:44px;border-radius:12px;border:1px solid #fff4;background:#ffffff14;color:inherit;font:24px/1 sans-serif;cursor:pointer}
.kj-herstart-knop{display:block;width:100%;min-height:44px;margin-top:16px;padding:10px 14px;border-radius:12px;border:1px solid #e6c68c88;background:#ffffff14;color:inherit;font:600 16px/1.2 system-ui,sans-serif;cursor:pointer}.kj-herstart-knop:focus-visible{outline:3px solid #fff;outline-offset:2px}
.kj-instellingen-optie{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid #ffffff20;cursor:pointer}.kj-instellingen-optie span{flex:1}.kj-instellingen-optie small{display:block;color:#d6c4aa;font-size:12px;margin-top:3px}.kj-instellingen-optie input{width:23px;height:23px;accent-color:#d69a43;flex:none}
.kj-instellingen-info{font-size:12px;color:#dccaaa;margin-top:10px;min-height:1.4em}
.kj-bier-inhoud{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 0 14px}.kj-bier-inhoud label{flex:1 1 100%;font-weight:700}.kj-bier-inhoud input{flex:1;min-width:120px;accent-color:#d69a43}.kj-bier-inhoud output{min-width:3.5em;text-align:right;font-variant-numeric:tabular-nums}.kj-bier-vol{min-height:40px;padding:8px 12px;border:1px solid #e6c68c88;border-radius:10px;background:#593717;color:#fff5dd;font:inherit;cursor:pointer}
.kj-start-instellingen{position:absolute;right:64px;top:12px;z-index:35;min-width:44px;min-height:44px;border:1px solid #e6c68c88;border-radius:12px;background:#25150cdd;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 3px 12px #0009}
.kj-start{position:relative;isolation:isolate;justify-content:safe center}
.kj-instellingen,.kj-instellingen *{box-sizing:border-box}.kj-scene-keuze{border:0;padding:0;margin:0 0 12px;min-width:0}.kj-scene-keuze legend{font-weight:700;margin-bottom:10px}.kj-scene-opties{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.kj-scene-opties label{display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;padding:7px 4px;border:1px solid #e6c68c55;border-radius:10px;background:#100d0d66;font-size:12px;cursor:pointer}.kj-scene-opties label:has(input:checked){background:linear-gradient(145deg,#8f652b,#4c3217);border-color:#ffe8a6;box-shadow:inset 0 1px #fff5,0 3px 8px #0006}.kj-scene-opties input{accent-color:#e5bb65;margin:0}
.kj-modern .kt-knop{background:linear-gradient(155deg,#142334,#090f19);border-color:#d6b66c;color:#fff4d3;box-shadow:inset 0 1px #fff2,0 3px 8px #0008}.kj-modern .kj-kaart{box-shadow:0 8px 22px #000b,0 0 0 1px #e2be6777}.kj-modern .kj-titel,.kj-modern .kj-naam{color:#f5d990}.kj-instellingen.kj-modern .kj-instellingen-kaart{background:linear-gradient(145deg,#172536,#09111c);border-color:#dfc37b99}
.kj-modern .kj-kaars.kj-links{width:clamp(62px,15vw,100px);aspect-ratio:2/3}.kj-modern .kj-kaars.kj-rechts{width:clamp(80px,18vw,118px);aspect-ratio:2/3}.kj-modern .kj-links .kj-vlam{left:49.7%;bottom:81%;height:11%;width:10%;margin-left:-5%}.kj-modern .kj-rechts .kj-vlam{left:49.8%;bottom:96%;height:12%;width:9%;margin-left:-4.5%}
.kj-ruimteschip .kj-kaars,.kj-ruimteschip .kj-kaarslicht{display:none!important}
.kj-ruimteschip .kj-titel,.kj-ruimteschip .kj-naam{color:#b8f7ff;text-shadow:0 0 12px #17cfff88}
.kj-ruimteschip .kj-knop{border-color:#53cfea;background:linear-gradient(155deg,#12344a,#091421);color:#e1fbff;box-shadow:inset 0 1px #c7fbff66,0 3px 12px #0009}
.kj-instellingen.kj-ruimteschip .kj-instellingen-kaart{border-color:#40dffc99;background:linear-gradient(145deg,#102a3e,#07121e);box-shadow:inset 0 1px #fff3,0 18px 60px #000c,0 0 28px #14cfff28}
.kj-instellingen.kj-ruimteschip .kj-instellingen-kop h2{color:#b8f7ff}
.kj-instellingen.kj-ruimteschip .kj-kaars-instelling{display:none}
.kj-scene-opties{grid-template-columns:repeat(auto-fit,minmax(112px,1fr))}.kj-scene-opties label{padding:7px 6px;text-align:center}
.kj-instellingen.kj-ruimteschip .kj-scene-opties label:has(input:checked){background:linear-gradient(145deg,#16627a,#102438);border-color:#a7f7ff;box-shadow:inset 0 1px #fff8,0 0 13px #18d9ff66}
.kj-spaceship-interior .kj-kaarslicht,.kj-spaceship-interior .kj-kaars{display:none!important}
.kj-spaceship-interior .kj-titel,.kj-spaceship-interior .kj-naam{color:#b8f7ff;text-shadow:0 0 12px #17cfff88}
.kj-spaceship-interior .kj-knop{border-color:#53cfea;background:linear-gradient(155deg,#12344a,#091421);color:#e1fbff;box-shadow:inset 0 1px #c7fbff66,0 3px 12px #0009}
.kj-instellingen.kj-spaceship-interior .kj-instellingen-kaart{border-color:#40dffc99;background:linear-gradient(145deg,#102a3e,#07121e);box-shadow:inset 0 1px #fff3,0 18px 60px #000c,0 0 28px #14cfff28}
.kj-instellingen.kj-spaceship-interior .kj-instellingen-kop h2{color:#b8f7ff}
.kt-tafel.kj-spaceship-interior .kt-keuze{background:radial-gradient(ellipse at 50% 48%,#051e2de6,#02070cef 76%);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
.kt-tafel.kj-spaceship-interior .kt-keuzekaart{position:relative;isolation:isolate;width:min(92%,560px);padding:clamp(20px,5vw,34px);overflow:hidden;border:1px solid #70edff;border-radius:18px;background:linear-gradient(155deg,#123b50f5 0%,#091d2cf7 48%,#07121ff7 100%);color:#e8fcff;text-align:center;box-shadow:inset 0 1px #d8fbff77,inset 0 0 30px #33dfff20,0 0 0 4px #102f3caa,0 0 26px #19c8ff88,0 24px 70px #000e;animation:kjCommandOpen .38s cubic-bezier(.18,.8,.25,1) both}
.kt-tafel.kj-spaceship-interior .kt-keuzekaart::before{content:"";position:absolute;z-index:0;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,#8ef5ff08 0 1px,transparent 1px 5px),linear-gradient(110deg,transparent 10%,#52eaff18 46%,transparent 70%);mask-image:linear-gradient(90deg,#000,transparent 92%)}
.kt-tafel.kj-spaceship-interior .kt-keuzekaart>*{position:relative;z-index:1}
.kt-tafel.kj-spaceship-interior .kt-command-tag{margin-bottom:12px;color:#8cecffb8;font:700 9px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase}
.kt-tafel.kj-spaceship-interior .kt-keuzekaart::after{content:"CAPTAIN’S COMMAND  ·  AUTHORIZATION REQUIRED";display:block;margin-top:18px;padding-top:11px;border-top:1px solid #58dff355;color:#8cecffb8;font:700 9px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.16em}
.kt-tafel.kj-spaceship-interior .kt-keuze-vraag{max-width:48ch;margin:auto!important;color:#f1fdff;font:750 clamp(17px,4vw,23px)/1.35 system-ui,sans-serif!important;text-wrap:balance;text-shadow:0 0 16px #40dfff55}
.kt-tafel.kj-spaceship-interior .kt-keuzerij{gap:18px;margin-top:22px}
.kt-tafel.kj-spaceship-interior .kt-keuzerij button{width:72px;height:62px;border:1px solid #73eaff;border-radius:12px;background:linear-gradient(155deg,#153d50,#0a1c2b);color:#bdf8ff;font-size:32px;box-shadow:inset 0 1px #dcfcff66,0 0 13px #13bfe755,0 5px 0 #04101b,0 8px 15px #000a;transition:transform .15s,filter .15s,box-shadow .15s}
.kt-tafel.kj-spaceship-interior .kt-keuzerij button:hover{transform:translateY(-2px);filter:brightness(1.2);box-shadow:inset 0 1px #dcfcff88,0 0 19px #13bfe799,0 5px 0 #04101b,0 10px 18px #000a}
.kt-tafel.kj-spaceship-interior .kt-keuzerij button:active{transform:translateY(2px);box-shadow:inset 0 1px #dcfcff55,0 0 12px #13bfe755,0 2px 0 #04101b}
@keyframes kjCommandOpen{from{opacity:0;transform:translateY(10px) scale(.97);filter:brightness(1.8)}to{opacity:1;transform:none;filter:none}}
@media(max-width:380px){.kt-tafel.kj-spaceship-interior .kt-keuzekaart{width:94%;padding:19px 14px}.kt-tafel.kj-spaceship-interior .kt-keuzerij{gap:14px}}
@media(prefers-reduced-motion:reduce){.kt-tafel.kj-spaceship-interior .kt-keuzekaart{animation:none}}
.kj-instellingen.kj-spaceship-interior .kj-kaars-instelling{display:none}
.kj-main-scene-keuze>.kj-hoofdscenes{grid-template-columns:repeat(3,minmax(0,1fr))}
.kj-modern-interior-keuze{margin:10px 0 12px 18px;padding:10px 12px 8px;border-left:2px solid #e6c68c88;border-radius:0 12px 12px 0;background:linear-gradient(100deg,#ffffff0c,#0000)}
.kj-modern-interior-keuze[hidden]{display:none}.kj-interior-opties label{min-height:54px;text-align:center;line-height:1.2}.kj-modern-interior-keuze legend{color:#b9e9ff}.kj-modern-interior-note{margin:0 0 9px;color:#d7c6a7;font-size:11px;line-height:1.3}
.kj-instellingen.kj-ruimteschip .kj-modern-interior-keuze{border-color:#41d3eb66;border-left-color:#4bd9ed;background:linear-gradient(145deg,#0e31429c,#081b29bb)}
.kj-instellingen.kj-ruimteschip .kj-modern-interior-keuze legend{color:#b9e9ff}.kj-instellingen.kj-ruimteschip .kj-modern-interior-note{color:#a8dce8}
@media(max-width:380px){.kj-main-scene-keuze>.kj-hoofdscenes{gap:5px}.kj-main-scene-keuze>.kj-hoofdscenes label{font-size:11px;min-height:64px}.kj-modern-interior-keuze{margin-left:8px;padding-right:7px;padding-left:10px}.kj-interior-opties label{font-size:10px;padding-inline:3px}}
.kj-mode-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%;max-width:450px}
.kj-mode-card{min-width:0;padding:0;overflow:hidden;border:2px solid #b68b50;border-radius:14px;background:linear-gradient(145deg,#382519,#1a1110);color:#fff0d1;font:inherit;text-align:left;cursor:pointer;box-shadow:0 5px 12px #0009;transition:transform .18s,border-color .18s,box-shadow .18s}
.kj-mode-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.kj-mode-label{display:flex;align-items:center;gap:8px;min-height:42px;padding:7px 10px;border-top:1px solid #eac98066;background:linear-gradient(180deg,#3b291f,#241812)}
.kj-mode-label .kj-ico{font-size:19px}.kj-mode-label b{font:750 13px/1.15 Georgia,serif;letter-spacing:.02em}
.kj-mode-card[aria-pressed=true]{transform:translateY(-2px);border-color:#ffe39b;box-shadow:0 0 0 2px #f2cc7a77,0 0 20px #f1b95b77,0 8px 18px #000b}
.kj-mode-card:focus-visible,.kj-mode-popup button:focus-visible{outline:3px solid #fff0b6;outline-offset:3px}
.kj-mode-popup{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:#080503df;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.kj-mode-popup-kaart{position:relative;width:min(100%,560px);max-height:calc(100dvh - 32px);overflow:auto;border:1px solid #e4c27d;border-radius:20px;background:linear-gradient(150deg,#543722,#211612 72%);color:#fff2d4;box-shadow:inset 0 1px #fff4,0 22px 72px #000d;text-align:center}
.kj-mode-popup-beeld{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-bottom:2px solid #d6b36d}
.kj-mode-popup-kop{padding:20px 54px 4px;font:800 clamp(22px,5vw,32px)/1.15 Georgia,serif;color:#ffe1a0;text-shadow:0 2px 3px #000}
.kj-mode-popup-bericht{margin:8px 20px 18px;color:#f4dfba;font:600 14px/1.4 system-ui,sans-serif}
.kj-mode-popup-start{min-height:48px;margin:0 20px 20px;padding:10px 20px;border:1px solid #ffe6a8;border-radius:12px;background:linear-gradient(145deg,#e9c374,#9d682e);color:#26170b;font:800 16px/1.2 system-ui,sans-serif;cursor:pointer;box-shadow:inset 0 1px #fff9,0 4px 12px #0009}
.kj-mode-popup-sluit{position:absolute;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:1;display:grid;place-items:center;width:46px;height:46px;border:1px solid #fff9;border-radius:50%;background:#160f0ddf;color:#fff4dd;font:300 31px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 12px #000a}
@media(max-width:380px){.kj-mode-choices{gap:7px}.kj-mode-label{gap:5px;padding:7px 6px}.kj-mode-label b{font-size:11px}.kj-mode-label .kj-ico{font-size:17px}}
@media(prefers-reduced-motion:reduce){.kj-mode-card{transition:none}}
`
function zetCss() {
  if (document.getElementById('kj-stijl')) return
  const s = document.createElement('style'); s.id = 'kj-stijl'; s.textContent = CSS; document.head.appendChild(s)
}

// De spelregels in gewone woorden (ook in het Engels via taal-en.js)
function regelsHtml() {
  const p = t => '<p>' + esc(T(t)) + '</p>'
  const li = t => '<li>' + esc(T(t)) + '</li>'
  return '<h2>👑 ' + esc(T('Koningsjacht')) + '</h2>'
    + p('Versla de 12 vijanden uit het kasteel: eerst de boeren, dan de vrouwen, dan de heren. Je speelt alleen.')
    + '<h3>⚔️ ' + esc(T('Aanvallen')) + '</h3>'
    + p('Speel een kaart: hij doet zoveel schade als erop staat (aas = 1). Samen spelen mag ook:')
    + '<ul>' + li('een aas met één andere kaart') + li('2 tot 4 kaarten met dezelfde waarde, samen niet meer dan 10') + '</ul>'
    + p('Elke soort geeft een kracht, zo sterk als je aanval:')
    + '<ul>' + li('♥ harten: kaarten van de aflegstapel gaan terug onder de taveerne') + li('♦ ruiten: pak kaarten (tot je er 8 hebt)')
    + li('♣ klaveren: dubbele schade') + li('♠ schoppen: een schild, de vijand slaat minder hard') + '</ul>'
    + p('Een vijand kan niet tegen zijn eigen soort: die kracht werkt dan niet.')
    + '<h3>🛡️ ' + esc(T('Afweren')) + '</h3>'
    + p('Daarna slaat de vijand terug. Gooi kaarten weg die samen minstens zijn aanval waard zijn (min je schild). Lukt dat niet, dan heb je verloren.')
    + p('Een boer in je hand is 10 waard, een vrouw 15, een heer 20.')
    + '<h3>👑 ' + esc(T('Verslagen')) + '</h3>'
    + p('Precies op nul? Dan komt de vijand bovenop de taveerne en vecht hij later met jou mee. Een nieuwe vijand slaat de eerste keer niet terug.')
    + '<h3>🃏 ' + esc(T('Narren')) + '</h3>'
    + p('Een nar gooit je hele hand weg en geeft je 8 nieuwe kaarten. Schildknaap: 4 narren, Ridder: 2, Koning: geen. Winnen zonder nar = goud, met 1 nar = zilver, meer = brons.')
    + p('Passen mag, maar niet twee beurten achter elkaar.')
    + '<h3>🤝 ' + esc(T('Met zijn tweeën')) + '</h3>'
    + p('In de chat kun je met een vriend spelen. Wie het spel begint, kiest hoe:')
    + '<ul>' + li('Samen: één kasteel, om de beurt. Elk 7 kaarten in je hand; ♦ deelt om en om uit. Wie aanvalt, weert ook af.')
    + li('Wedstrijd: ieder een eigen kasteel, precies hetzelfde geschud. Wie het verst komt, wint.')
    + li('Duel: als de wedstrijd, maar precies raak stuurt een vloek: de vijand van de ander krijgt 10 leven erbij.')
    + li('Belegering: ieder een eigen kasteel. Om de beurt val je de voorste wachter van de ander aan en weer je zijn klap af. Precies raak = je neemt hem gevangen. Wie het eerst alle 12 wachters van de ander verslaat, wint.') + '</ul>'
    + '<p style="font-size:12px;opacity:.75;margin-top:10px">' + esc(T('Gebaseerd op het kaartspel Regicide van Badgers From Mars.')) + '</p>'
}
function toonRegels() {
  const d = document.createElement('div'); d.className = 'kj-regels'
  d.innerHTML = '<div class="kj-regelkaart" role="dialog" aria-modal="true">' + regelsHtml() + '<button type="button" class="kj-knop">' + esc(T('Sluiten')) + '</button></div>'
  d.querySelector('.kj-knop').onclick = () => d.remove()
  d.addEventListener('click', e => { if (e.target === d) d.remove() })
  document.body.appendChild(d)
}

export function start({ spelKanaal = null, benIkSpeler1 = true, vriendNaam = '', scoreService = null } = {}) {
  zetCss(); zetStijl()
  const multiplayer = Boolean(spelKanaal)
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '👑 ' + T('Koningsjacht')
  let staat = null, tafel = null, selectie = [], bezig = 0, rij = Promise.resolve(), sceneMode = 'samen'
  // Lazily share the app's authenticated client; preview fixtures inject a local service.
  const api = () => import('./supabase.js?v=95').then(m => m.supabase)
  const scores = scoreService || maakKoningsjachtScoreService({ supabase: {
    auth: { getSession: async () => (await api()).auth.getSession() },
    rpc: async (...args) => (await api()).rpc(...args)
  } })
  const scorePartij = maakScorePartij({ service: scores, storage: {
    getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v)
  } })
  let scorebord = null, scoreOpslag = null
  function toonScores() {
    if (!inhoud.isConnected) return
    if (!inhoud.querySelector('.nr-scoreboard')) {
      scorebord?.destroy()
      scorebord = maakKoningsjachtScorebord({ host: inhoud, service: scores, T: window.T || T, isActief: () => inhoud.isConnected })
    }
    scorebord.open()
  }
  function scoreKnop(parent, className = 'kj-knop kj-zacht') {
    const b = document.createElement('button')
    b.type = 'button'; b.className = className + ' kj-scores'
    b.textContent = '🏆 ' + T('Scores'); b.onclick = toonScores
    parent?.appendChild(b)
  }
  function bewaarScore() {
    if (!scoreOpslag) {
      scoreOpslag = scorePartij.finish(staat, modus)
      scoreOpslag.catch(() => {}) // The end screen reports any save failure.
    }
    return scoreOpslag
  }
  function toonEinde(options) {
    const opgeslagen = bewaarScore()
    tafel.einde(options)
    const kaart = tafel.element.querySelector('.kt-eindekaart')
    kaart?.prepend(maakEindscene(staat.verslagen, { T, scene: sceneNaam(), narren: (staat.narren || 0) + (staat.narrenGebruikt || 0) }).element)
    scoreKnop(kaart, 'kt-knop')
    const status = document.createElement('p')
    status.className = 'kj-score-status'; status.setAttribute('role', 'status')
    status.textContent = T('Score bewaren…'); kaart?.appendChild(status)
    opgeslagen.then(r => {
      if (!status.isConnected) return
      status.textContent = r?.reason === 'account-changed' ? T('Account gewijzigd: deze score is niet bewaard.')
        : r?.synced ? T('Score bewaard en gedeeld.')
        : r?.persisted ? T('Score bewaard op dit apparaat.')
        : r?.inMemory ? T('Score tijdelijk bewaard; houd het spel open.') : ''
      scorebord?.refresh()
    }).catch(() => { status.textContent = T('Score kon niet worden bewaard.') })
  }
  const INSTELLINGEN = 'fibro_koningsjacht_instellingen'
  const BIER_PARTIJ = 'fibro_koningsjacht_bierpartij', BIER_VRIEND = 'fibro_koningsjacht_bierpartij_vriend'
  const bewaardeInstellingen = lees(INSTELLINGEN, {}) || {}
  const instellingen = {
    scene: ['standaard', 'modern', 'middeleeuws'].includes(bewaardeInstellingen.scene) ? bewaardeInstellingen.scene : (isRuimteScene(bewaardeInstellingen.scene) ? 'modern' : (bewaardeInstellingen.middeleeuws === true ? 'middeleeuws' : 'standaard')),
    modernInterior: ['none', 'old', 'futuristic'].includes(bewaardeInstellingen.modernInterior) ? bewaardeInstellingen.modernInterior
      : bewaardeInstellingen.scene === 'ruimteschip-oud' ? 'old' : bewaardeInstellingen.scene === 'ruimteschip-futuristisch' ? 'futuristic' : 'none',
    beweging: bewaardeInstellingen.beweging === true,
    slowMoves: bewaardeInstellingen.slowMoves === true,
    impact: bewaardeInstellingen.impact === true,
    middeleeuws: bewaardeInstellingen.middeleeuws === true,
    flikkeren: bewaardeInstellingen.flikkeren !== false,
    tafelschaduw: bewaardeInstellingen.tafelschaduw !== false,
    bierpul: bewaardeInstellingen.bierpul === true,
    bierInhoud: Number.isInteger(bewaardeInstellingen.bierInhoud) && bewaardeInstellingen.bierInhoud >= 0 && bewaardeInstellingen.bierInhoud <= 100 ? bewaardeInstellingen.bierInhoud : 100,
    bierOorRechts: bewaardeInstellingen.bierOorRechts !== false,
    bierRonde: 0
  }
  const sceneNaam = () => multiplayer ? 'middeleeuws' : instellingen.scene
  const ruimteschipActief = () => !multiplayer && instellingen.scene === 'modern' && instellingen.modernInterior !== 'none'
  instellingen.middeleeuws = sceneNaam() === 'middeleeuws'
  const koningsjachtBewegingsfactor = () => instellingen.slowMoves && !rustig() ? 1.25 : 1
  const wacht = ms => new Promise(k => setTimeout(k, ms * koningsjachtBewegingsfactor()))
  let STIJL = sceneNaam() === 'modern' ? 'modern' : 'perkament'
  let scene = null, flikkerTimer = null, anderBier = null, bierTimer = null

  const sceneOpties = () => ({ ...instellingen, scene: sceneNaam(), multiplayer, multiplayerMode: sceneMode, anderBier, eigenNaam: T('Jij'), bierLabel: T('Inhoud van je bierpul'), onBierInhoud: wijzigBierInhoud, onBierNieuw: nieuweBierpul })
  zetMuziekThema(sceneNaam() === 'middeleeuws' ? 'middeleeuws' : 'standaard')

  function bewaarInstellingen() {
    const { bierRonde, ...voorkeuren } = instellingen
    schrijf(INSTELLINGEN, voorkeuren)
  }
  function bewaarBierPartij() {
    if (!staat || staat.klaar) return
    schrijf(samenSpel ? BIER_VRIEND : BIER_PARTIJ, {
      partij: samenSpel ? 'vriend:' + spelId + ':' + ik : 'solo',
      ronde: instellingen.bierRonde, inhoud: instellingen.bierInhoud, oorRechts: instellingen.bierOorRechts
    })
  }
  function beginBierPartij(nieuw) {
    const partij = samenSpel ? 'vriend:' + spelId + ':' + ik : 'solo'
    const herstel = herstelBierPartij(lees(samenSpel ? BIER_VRIEND : BIER_PARTIJ, null), partij, !samenSpel && nieuw)
    instellingen.bierRonde = herstel.ronde
    instellingen.bierInhoud = herstel.inhoud
    instellingen.bierOorRechts = herstel.oorRechts
    clearTimeout(bierTimer); bierTimer = null
    bewaarBierPartij()
  }

  function wijzigBierInhoud(niveau, afgerond = false) {
    if (!Number.isFinite(niveau)) return
    instellingen.bierInhoud = Math.round(Math.max(0, Math.min(100, niveau)))
    scene?.update(sceneOpties())
    const slider = document.getElementById('kj-bier-inhoud')
    if (slider) slider.value = String(instellingen.bierInhoud)
    bewaarInstellingen(); bewaarBierPartij()
    if (afgerond) { clearTimeout(bierTimer); bierTimer = null; stuurBier() }
    else if (samenSpel && !bierTimer) bierTimer = setTimeout(() => { bierTimer = null; stuurBier() }, 200)
  }
  function nieuweBierpul() {
    instellingen.bierInhoud = 100
    instellingen.bierOorRechts = !instellingen.bierOorRechts
    instellingen.bierRonde++
    const slider = document.getElementById('kj-bier-inhoud')
    if (slider) slider.value = '100'
    pasInstellingenToe()
    bewaarBierPartij()
    clearTimeout(bierTimer); bierTimer = null; stuurBier()
  }

  function stopScene() {
    clearInterval(flikkerTimer); flikkerTimer = null
    scene?.stop(); scene = null
  }

  function pasInstellingenToe() {
    const actief = tafel?.element?.isConnected ? tafel.element : inhoud.querySelector('.kj-start')
    const sfeer = sceneNaam()
    instellingen.middeleeuws = sfeer === 'middeleeuws'
    actief?.classList.toggle('kj-sfeer', instellingen.middeleeuws)
    actief?.classList.toggle('kj-modern', sfeer === 'modern')
    actief?.classList.toggle('kj-ruimteschip', ruimteschipActief())
    actief?.classList.toggle('kj-holografisch', ruimteschipActief())
    actief?.classList.toggle('kj-spaceship-interior', ruimteschipActief())
    const instellingenScherm = document.querySelector('.kj-instellingen')
    instellingenScherm?.classList.toggle('kj-modern', sfeer === 'modern')
    instellingenScherm?.classList.toggle('kj-ruimteschip', ruimteschipActief())
    instellingenScherm?.classList.toggle('kj-spaceship-interior', ruimteschipActief())
    actief?.classList.toggle('kj-geenflikkering', !instellingen.flikkeren)
    actief?.classList.toggle('kj-tafelschaduw', instellingen.tafelschaduw)
    scene?.update(sceneOpties())
    zetMuziekThema(sfeer === 'middeleeuws' ? 'middeleeuws' : 'standaard')
    const nieuweStijl = sfeer === 'modern' ? 'modern' : 'perkament'
    if (nieuweStijl !== STIJL) {
      STIJL = nieuweStijl
      for (const [i, kaart] of [...inhoud.querySelectorAll('.kj-kaarten>div')].entries()) kaart.innerHTML = kaartSvg(['kB', 'hH', 'sV'][i], STIJL)
      if (tafel?.element?.isConnected) {
        tafel.zetKaartStijl(STIJL)
        for (const kaart of tafel.element.querySelectorAll('.kj-kasteel>div')) kaart.innerHTML = achterkantSvg(STIJL)
        if (staat) tekenVijand(staat)
      }
    }
    tafel?.element.classList.toggle('kj-geenkaars', !kaarsAan())
    verversKandelaars()
    verversKaarslicht()
    bewaarInstellingen()
  }

  function plaatsScene(element) {
    stopScene()
    if (!element) return
    element.classList.toggle('kj-sfeer', instellingen.middeleeuws)
    element.classList.toggle('kj-modern', sceneNaam() === 'modern')
    element.classList.toggle('kj-ruimteschip', ruimteschipActief())
    element.classList.toggle('kj-holografisch', ruimteschipActief())
    element.classList.toggle('kj-spaceship-interior', ruimteschipActief())
    element.classList.toggle('kj-geenflikkering', !instellingen.flikkeren)
    element.classList.toggle('kj-tafelschaduw', instellingen.tafelschaduw)
    scene = maakKoningsjachtScene(element, sceneOpties())
  }

  function toonInstellingen() {
    if (document.querySelector('.kj-instellingen')) return
    const vorigeFocus = document.activeElement
    const kanHerstarten = !samenSpel && !afgelopen && !!(tafel?.element?.isConnected && staat && !staat.klaar)
    const scherm = document.createElement('div')
    scherm.className = 'kj-instellingen' + (sceneNaam() === 'modern' ? ' kj-modern' : '') + (ruimteschipActief() ? ' kj-ruimteschip kj-spaceship-interior' : '')
    scherm.innerHTML = '<section class="kj-instellingen-kaart" role="dialog" aria-modal="true" aria-labelledby="kj-instellingen-titel">'
      + '<div class="kj-instellingen-kop"><h2 id="kj-instellingen-titel">' + esc(T('Instellingen')) + '</h2>'
      + '<button type="button" class="kj-instellingen-sluit" aria-label="' + esc(T('Sluiten')) + '">×</button></div>'
      + (multiplayer ? '' : '<fieldset class="kj-scene-keuze kj-main-scene-keuze"><legend>' + esc(T('Tafelsfeer')) + '</legend><div class="kj-scene-opties kj-hoofdscenes">'
        + [['standaard', '🪵', T('Standaard')], ['modern', '✦', T('Modern')], ['middeleeuws', '🕯️', T('Middeleeuws')]].map(([id, icoon, label]) => '<label><input type="radio" name="kj-scene" data-scene="' + id + '" value="' + id + '"' + (instellingen.scene === id ? ' checked' : '') + '><span aria-hidden="true">' + icoon + '</span><span>' + esc(label) + '</span></label>').join('')
        + '</div><fieldset class="kj-modern-interior-keuze"' + (instellingen.scene === 'modern' ? '' : ' hidden') + '><legend>' + esc(T('Varianten binnen Modern')) + '</legend><p class="kj-modern-interior-note">' + esc(T('Deze drie tafelvarianten horen bij de hoofdsfeer Modern.')) + '</p><div class="kj-scene-opties kj-interior-opties">'
        + [['none', T('Epoxytafel')], ['old', T('Inside · oud schip')], ['futuristic', T('Inside · futuristisch')]].map(([id, label]) => '<label><input type="radio" name="kj-modern-interior" data-interior="' + id + '" value="' + id + '"' + (instellingen.modernInterior === id ? ' checked' : '') + '><span>' + esc(label) + '</span></label>').join('')
        + '</div></fieldset></fieldset>')
      + '<label class="kj-instellingen-optie"><span><b>' + esc(T('Achtergrond bewegen')) + '</b><small>' + esc(T('Beweeg je telefoon voor een subtiel diepte-effect.')) + '</small></span><input type="checkbox" data-instelling="beweging"></label>'
      + '<label class="kj-instellingen-optie"><span><b>' + esc(T('Slow moves')) + '</b><small>' + esc(T('Laat kaartbewegingen en effecten rustiger verlopen, zodat je beter ziet wat er gebeurt.')) + '</small></span><input type="checkbox" data-instelling="slowMoves"></label>'
      + '<label class="kj-instellingen-optie"><span><b>' + esc(T('Beuken en trillen')) + '</b><small>' + esc(T('Laat het speelveld bij harde inslagen schudden en je telefoon meetrillen.')) + '</small></span><input type="checkbox" data-instelling="impact"></label>'
      + '<label class="kj-instellingen-optie kj-kaars-instelling" data-instelling-optie="kaars"><span><b>' + esc(T('Kaarsen laten flikkeren')) + '</b><small>' + esc(T('Laat de vlam en het kaarslicht zacht bewegen.')) + '</small></span><input type="checkbox" data-instelling="flikkeren"></label>'
      + '<label class="kj-instellingen-optie"><span><b>' + esc(T('Schaduwen op tafel')) + '</b><small>' + esc(T('Laat de kaarten en stapels een schaduw op de tafel werpen.')) + '</small></span><input type="checkbox" data-instelling="tafelschaduw"></label>'
      + '<label class="kj-instellingen-optie"><span><b>' + esc(T('Bierpul tonen')) + '</b><small>' + esc(T('Zet een bierpul op de tafel.')) + '</small></span><input type="checkbox" data-instelling="bierpul"></label>'
      // kaarttafel (kaartspel-hulp v7): hulp, grote kaarten, trillen; voor alle kaartspellen op dit toestel
      + KAART_INSTELLINGEN.map(i => '<label class="kj-instellingen-optie"><span><b>' + esc(T(i.titel)) + '</b><small>' + esc(T(i.uitleg)) + '</small></span><input type="checkbox" data-kaartinstelling="' + i.sleutel + '"></label>').join('')
      + '<div class="kj-bier-inhoud"><label for="kj-bier-inhoud">' + esc(T('Inhoud van je bierpul')) + '</label><input id="kj-bier-inhoud" type="range" min="0" max="100" step="1"><button type="button" class="kj-bier-vol">' + esc(T('Nieuwe volle pul')) + '</button></div>'
      + (kanHerstarten ? '<button type="button" class="kj-herstart-knop">↻ ' + esc(T('Opnieuw beginnen')) + '</button>' : '')
      + '<p class="kj-instellingen-info" role="status" aria-live="polite"></p></section>'
    document.body.appendChild(scherm)
    const kaart = scherm.querySelector('.kj-instellingen-kaart')
    const melding = scherm.querySelector('.kj-instellingen-info')
    const sluit = () => { scherm.remove(); document.removeEventListener('keydown', toetsen); if (vorigeFocus?.isConnected) vorigeFocus.focus() }
    const toetsen = e => {
      if (e.key === 'Escape') { e.preventDefault(); sluit(); return }
      if (e.key !== 'Tab') return
      const items = [...kaart.querySelectorAll('button, input')].filter(el => !el.disabled)
      if (!items.length) return
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus() }
      else if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus() }
    }
    document.addEventListener('keydown', toetsen)
    scherm.querySelector('.kj-instellingen-sluit').onclick = sluit
    const herstartKnop = scherm.querySelector('.kj-herstart-knop')
    if (herstartKnop) herstartKnop.onclick = () => { sluit(); herstartNaarKeuze() }
    scherm.addEventListener('click', e => { if (e.target === scherm) sluit() })
    for (const input of scherm.querySelectorAll('[data-scene]')) input.addEventListener('change', () => {
      if (!input.checked) return
      instellingen.scene = input.value
      const interiorChoice = scherm.querySelector('.kj-modern-interior-keuze')
      scherm.classList.toggle('kj-modern', input.value === 'modern')
      if (interiorChoice) interiorChoice.hidden = multiplayer || input.value !== 'modern'
      pasInstellingenToe()
    })
    for (const input of scherm.querySelectorAll('[data-interior]')) input.addEventListener('change', () => {
      if (!input.checked) return
      instellingen.modernInterior = input.value
      pasInstellingenToe()
    })
    for (const input of scherm.querySelectorAll('[data-instelling]')) {
      const key = input.dataset.instelling
      input.checked = instellingen[key]
      input.addEventListener('change', () => {
        instellingen[key] = input.checked
        pasInstellingenToe()
        if (key === 'bierpul') stuurBier()
        // iOS vraagt sensortoegang: begin de aanvraag direct bij de tik.
        const verzoek = key === 'beweging' && input.checked ? scene?.verplaatsingsToestemming() : null
        if (verzoek) Promise.resolve(verzoek).then(status => {
          if (!melding.isConnected) return
          melding.textContent = status === 'geweigerd' ? T('Beweging niet toegestaan op dit apparaat.')
            : status === 'niet-ondersteund' && scene?.bewegingsStatus !== 'muis' ? T('Beweging is niet beschikbaar op dit apparaat.')
              : status === 'verminderde-beweging' ? T('Beweging staat uit vanwege je apparaatinstelling.') : ''
        }).catch(() => { if (melding.isConnected) melding.textContent = T('Beweging is niet beschikbaar op dit apparaat.') })
      })
    }
    const kaartInst = kaartInstellingen()
    for (const input of scherm.querySelectorAll('[data-kaartinstelling]')) {
      input.checked = kaartInst[input.dataset.kaartinstelling]
      input.addEventListener('change', () => zetKaartInstelling(input.dataset.kaartinstelling, input.checked))
    }
    const bierSlider = scherm.querySelector('#kj-bier-inhoud')
    const nieuwePul = scherm.querySelector('.kj-bier-vol')
    const toonBierWaarde = () => {
      bierSlider.value = String(instellingen.bierInhoud)
      bierSlider.disabled = nieuwePul.disabled = !instellingen.bierpul
    }
    toonBierWaarde()
    scherm.querySelector('[data-instelling="bierpul"]').addEventListener('change', toonBierWaarde)
    bierSlider.addEventListener('input', () => {
      wijzigBierInhoud(Number(bierSlider.value))
    })
    bierSlider.addEventListener('change', () => wijzigBierInhoud(Number(bierSlider.value), true))
    nieuwePul.addEventListener('click', nieuweBierpul)
    scherm.querySelector('.kj-instellingen-sluit').focus()
  }

  function startInstellingen() {
    const el = inhoud.querySelector('.kj-start')
    if (!el) return
    scoreKnop(el)
    plaatsScene(el)
    const knop = document.createElement('button')
    knop.type = 'button'; knop.className = 'kj-start-instellingen'
    knop.setAttribute('aria-label', T('Instellingen')); knop.title = T('Instellingen'); knop.textContent = '⚙'
    knop.onclick = toonInstellingen
    el.appendChild(knop)
  }
  // ── Met z'n tweeën (v5) ──
  const kanaal = spelKanaal, samenSpel = multiplayer
  const ik = benIkSpeler1 ? 1 : 2, hij = ik === 1 ? 2 : 1
  const naam = vriendNaam || T('vriend')
  let modus = 'solo', spelId = -1, nr = 0, opzet = null, tegen = null, afgelopen = false, beleg = null
  let modePopup = null, pendingStart = null
  const vloeken = new Set()
  const stuur = (event, payload) => { try { kanaal && kanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }
  const bierVerbinding = verbindBierpul(kanaal, {
    speler: ik, partij: () => spelId, actief: () => inhoud.isConnected,
    lees: () => ({ zichtbaar: instellingen.bierpul, inhoud: instellingen.bierInhoud, oorRechts: instellingen.bierOorRechts, ronde: instellingen.bierRonde }),
    toon: stand => { anderBier = { ...stand, naam }; scene?.update(sceneOpties()) }
  })
  const stuurBier = () => bierVerbinding.update()
  const mijnHand = s => modus === 'samen' ? K.hand(s, ik) : s.hand
  const aanMij = s => modus === 'beleg' ? Boolean(beleg && !beleg.klaar && beleg.aanZet === ik) : (modus !== 'samen' || s.aanZet === ik)
  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[koningsjacht]', e)); return rij }

  // ── Het beginscherm: kies een niveau (of ga verder) ──
  function startScherm() {
    if (samenSpel) return benIkSpeler1 ? kiesSamenScherm() : wachtScherm()
    tafel = null; staat = null
    const beste = lees(BESTE, {}) || {}
    const bewaard = lees(BEWAAR, null)
    const verder = K.geldigeStand(bewaard) && !bewaard.klaar ? bewaard : null
    const niveau = (id, ico) => '<button type="button" class="kj-niveau" data-niveau="' + id + '"><span class="kj-ico">' + ico + '</span><span><b>' + esc(T(NIVEAU_NAAM[id]))
      + '</b><small>' + esc(K.NIVEAUS[id].narren ? T('{n} narren', { n: K.NIVEAUS[id].narren }) : T('Geen narren')) + '</small></span><span class="kj-med">' + (MEDAILLE[beste[id]] || '') + '</span></button>'
    inhoud.innerHTML = '<div class="kj-start">'
      + '<div class="kj-kaarten"><div>' + kaartSvg('kB', STIJL) + '</div><div>' + kaartSvg('hH', STIJL) + '</div><div>' + kaartSvg('sV', STIJL) + '</div></div>'
      + '<div class="kj-titel">' + esc(T('Koningsjacht')) + '</div>'
      + '<div class="kj-uitleg">' + esc(T('Versla de twaalf vijanden uit het kasteel. Elke soort kaart heeft een eigen kracht.')) + '</div>'
      + (verder ? '<button type="button" class="kj-knop kj-verder">▶ ' + esc(T('Verder spelen')) + ' (' + esc(T(NIVEAU_NAAM[verder.niveau])) + ', ' + verder.verslagen + '/12)</button>' : '')
      + '<div class="kj-niveaus">' + niveau('schildknaap', '🛡️') + niveau('ridder', '⚔️') + niveau('koning', '👑') + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button type="button" class="kj-knop kj-zacht kj-regelknop">📜 ' + esc(T('Hoe speel je?')) + '</button>'
      + '<button type="button" class="kj-knop kj-zacht kj-muziek" aria-pressed="' + muziekStaatAan() + '">🎵 ' + esc(muziekStaatAan() ? T('Muziek aan') : T('Muziek uit')) + '</button></div>'
      + '<div class="kj-bron">' + esc(T('Gebaseerd op het kaartspel Regicide van Badgers From Mars.')) + '</div></div>'
    startInstellingen()
    for (const b of inhoud.querySelectorAll('.kj-niveau')) b.onclick = () => speel(K.nieuwSpel({ niveau: b.dataset.niveau }), true)
    inhoud.querySelector('.kj-regelknop').onclick = toonRegels
    const v = inhoud.querySelector('.kj-verder'); if (v) v.onclick = () => speel(verder, false)
    const mk = inhoud.querySelector('.kj-muziek')
    mk.onclick = () => {
      const aan = !muziekStaatAan(); zetMuziek(aan)
      mk.setAttribute('aria-pressed', String(aan)); mk.textContent = '🎵 ' + (aan ? T('Muziek aan') : T('Muziek uit'))
    }
    if (muziekStaatAan()) startMuziek()   // werkt pas na een tik (de browser), anders bij de keuze van een niveau
  }
  function herstartNaarKeuze() {
    if (samenSpel || !tafel?.element?.isConnected) return
    const laag = document.createElement('div')
    laag.className = 'kj-herstart-golf'
    laag.setAttribute('aria-hidden', 'true')
    tafel.element.appendChild(laag)
    setTimeout(() => {
      laag.remove()
      stopScene()
      schrijf(BEWAAR, null)
      schrijf(BIER_PARTIJ, null)
      startScherm()
    }, 720)
  }
  // Met z'n tweeën: speler 1 kiest hoe jullie spelen en het niveau
  const MODI = [['samen', '🤝', 'Samen', 'Eén team, om de beurt. Samen winnen of samen verliezen.'],
    ['wedstrijd', '🏁', 'Wedstrijd', 'Ieder een eigen kasteel, precies hetzelfde geschud. Wie het verst komt, wint.'],
    ['duel', '⚔️', 'Duel', 'Als de wedstrijd, maar precies raak stuurt een vloek: de vijand van de ander krijgt 10 leven erbij.'],
    ['beleg', '🏰', 'Belegering', 'Ieder een eigen kasteel. Om de beurt val je de wachters van de ander aan en weer je hun klap af. Wie het eerst het kasteel van de ander verovert, wint.']]
  const modusInfo = id => MODI.find(m => m[0] === id)
  const modusBeeld = id => new URL('./assets/koningsjacht/modus-' + (id === 'beleg' ? 'belegering' : id) + '.svg', import.meta.url).href
  function toonSpeltype(o) {
    if (!o || !(o.spelId > spelId) || !modusInfo(o.modus)) return
    if (pendingStart && o.spelId < pendingStart.spelId) return
    if (pendingStart?.spelId === o.spelId) {
      if ((o.nr || 0) <= (pendingStart.nr || 0)) return
      // Een partij kan al beginnen terwijl de ander de melding nog open heeft.
      // Bewaar dan de nieuwste stand zonder de popup opnieuw te laten knipperen.
      pendingStart = o
      return
    }
    modePopup?.remove()
    pendingStart = o
    const info = modusInfo(o.modus)
    const popup = document.createElement('div'); popup.className = 'kj-mode-popup'
    popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-modal', 'true')
    popup.setAttribute('aria-label', T('Speltype gekozen'))
    const kaart = document.createElement('div'); kaart.className = 'kj-mode-popup-kaart'
    const sluiten = document.createElement('button'); sluiten.type = 'button'; sluiten.className = 'kj-mode-popup-sluit'
    sluiten.textContent = '×'; sluiten.setAttribute('aria-label', T('Sluit en start dit spel'))
    const beeld = document.createElement('img'); beeld.className = 'kj-mode-popup-beeld'; beeld.src = modusBeeld(info[0]); beeld.alt = ''
    const kop = document.createElement('h2'); kop.className = 'kj-mode-popup-kop'; kop.textContent = T(info[2])
    const bericht = document.createElement('p'); bericht.className = 'kj-mode-popup-bericht'
    bericht.textContent = benIkSpeler1
      ? T('Jij koos voor: {modus}', { modus: T(info[2]) })
      : T('{naam} koos voor: {modus}', { naam, modus: T(info[2]) })
    const starten = document.createElement('button'); starten.type = 'button'; starten.className = 'kj-mode-popup-start'; starten.textContent = T('Start dit spel')
    kaart.append(sluiten, beeld, kop, bericht, starten); popup.append(kaart)
    function gaVerder() {
      if (modePopup !== popup || !pendingStart) return
      const start = pendingStart
      modePopup = null; pendingStart = null; popup.remove()
      tafel?.sluitEinde?.()
      openSpel(start)
    }
    sluiten.addEventListener('click', gaVerder)
    starten.addEventListener('click', gaVerder)
    popup.addEventListener('click', e => { if (e.target === popup) gaVerder() })
    popup.addEventListener('keydown', e => { if (e.key === 'Escape') gaVerder() })
    inhoud.appendChild(popup)
    modePopup = popup
    sluiten.focus()
  }
  function kiesSamenScherm() {
    tafel = null; staat = null; afgelopen = false
    let gekozen = 'samen'
    const knop = ([id, ico, t, u]) => '<button type="button" class="kj-mode-card" data-modus="' + id + '" aria-label="' + esc(T(t) + '. ' + T(u)) + '"><img src="' + esc(modusBeeld(id)) + '" alt=""><span class="kj-mode-label"><span class="kj-ico" aria-hidden="true">' + ico + '</span><b>' + esc(T(t)) + '</b></span></button>'
    inhoud.innerHTML = '<div class="kj-start">'
      + '<div class="kj-titel">' + esc(T('Koningsjacht')) + '</div>'
      + '<div class="kj-uitleg">' + esc(T('Hoe spelen jullie?')) + '</div>'
      + '<div class="kj-mode-choices kj-modi">' + MODI.map(knop).join('') + '</div>'
      + '<div class="kj-uitleg">' + esc(T('Kies het niveau')) + '</div>'
      + '<div class="kj-niveaus kj-niveaukeus"><button type="button" class="kj-niveau" data-niveau="schildknaap"><span class="kj-ico">🛡️</span><span><b>' + esc(T('Schildknaap')) + '</b></span></button>'
      + '<button type="button" class="kj-niveau" data-niveau="ridder"><span class="kj-ico">⚔️</span><span><b>' + esc(T('Ridder')) + '</b></span></button>'
      + '<button type="button" class="kj-niveau" data-niveau="koning"><span class="kj-ico">👑</span><span><b>' + esc(T('Koning')) + '</b></span></button></div>'
      + '<button type="button" class="kj-knop kj-zacht kj-regelknop">📜 ' + esc(T('Hoe speel je?')) + '</button>'
      + '<div class="kj-bron">' + esc(T('Gebaseerd op het kaartspel Regicide van Badgers From Mars.')) + '</div></div>'
    startInstellingen()
    const zet = () => { for (const b of inhoud.querySelectorAll('.kj-modi .kj-mode-card')) b.setAttribute('aria-pressed', String(b.dataset.modus === gekozen)) }
    for (const b of inhoud.querySelectorAll('.kj-modi .kj-mode-card')) b.onclick = () => { gekozen = b.dataset.modus; zet() }
    zet()
    for (const b of inhoud.querySelectorAll('.kj-niveaukeus .kj-niveau')) b.onclick = () => begin(gekozen, b.dataset.niveau)
    inhoud.querySelector('.kj-regelknop').onclick = toonRegels
    if (muziekStaatAan()) startMuziek()
  }
  function wachtScherm() {
    tafel = null; staat = null; afgelopen = false
    inhoud.innerHTML = '<div class="kj-start"><div class="kj-kaarten"><div>' + kaartSvg('kB', STIJL) + '</div><div>' + kaartSvg('hH', STIJL) + '</div><div>' + kaartSvg('sV', STIJL) + '</div></div>'
      + '<div class="kj-titel">' + esc(T('Koningsjacht')) + '</div>'
      + '<div class="kj-uitleg kj-wacht">' + esc(T('{naam} kiest hoe jullie spelen...', { naam })) + '</div>'
      + '<button type="button" class="kj-knop kj-zacht kj-regelknop">📜 ' + esc(T('Hoe speel je?')) + '</button></div>'
    startInstellingen()
    inhoud.querySelector('.kj-regelknop').onclick = toonRegels
  }
  // Speler 1 begint een spel (ook bij Opnieuw spelen)
  function begin(m, niveau) {
    const id = Math.max(Date.now(), spelId + 1, (pendingStart?.spelId ?? -1) + 1)
    if (m === 'beleg') {
      const b = K.nieuwBeleg({ niveau, begint: 1 })
      opzet = { modus: m, niveau, spelId: id }
      const start = { modus: m, niveau, spelId: id, nr: 0, beleg: b }
      stuur('opnieuw', start)
      toonSpeltype(start)
    } else if (m === 'samen') {
      const st = K.nieuwSpel({ niveau, samen: true, begint: 1 })
      opzet = { modus: m, niveau, spelId: id }
      const start = { modus: m, niveau, spelId: id, staat: st, nr: 0 }
      stuur('opnieuw', start)
      toonSpeltype(start)
    } else {
      const zaad = Math.floor(Math.random() * 2e9) + 1
      opzet = { modus: m, niveau, spelId: id, zaad }
      stuur('opnieuw', opzet)
      toonSpeltype(opzet)
    }
  }
  // Een spel openen (bij jezelf of na een bericht van de ander)
  function openSpel(o) {
    if (o.spelId !== spelId) anderBier = null
    sceneMode = ['samen', 'wedstrijd', 'duel', 'beleg'].includes(o.modus) ? o.modus : 'samen'
    modus = o.modus; spelId = o.spelId; nr = o.nr || 0; tegen = null; afgelopen = false; vloeken.clear()
    opzet = { modus: o.modus, niveau: o.niveau, spelId: o.spelId, zaad: o.zaad }
    beleg = modus === 'beleg' ? o.beleg : null
    const st = modus === 'beleg' ? beleg.spelers[ik] : modus === 'samen' ? o.staat : K.nieuwSpel({ niveau: o.niveau, rng: K.zaadRng(o.zaad) })
    speel(st, true)
    if (modus === 'wedstrijd' || modus === 'duel') stuurVoortgang()
  }
  function stuurVoortgang() {
    if (!samenSpel || (modus !== 'wedstrijd' && modus !== 'duel') || !staat) return
    const v = K.vijandInfo(staat)
    stuur('voortgang', { wie: ik, spelId, verslagen: staat.verslagen, over: v ? v.over : 0, leven: v ? v.leven : 0, klaar: staat.klaar, gewonnen: staat.gewonnen, narren: staat.narrenGebruikt })
  }
  if (samenSpel) {
    const nieuwer = (id, n) => id > spelId || (id === spelId && n > nr)
    kanaal.on('broadcast', { event: 'opnieuw' }, msg => {
      const p = msg.payload || {}
      if (!(p.spelId > spelId) || !['samen', 'wedstrijd', 'duel', 'beleg'].includes(p.modus) || !K.NIVEAUS[p.niveau]) return
      if (p.modus === 'samen' && !K.geldigeStand(p.staat)) return
      if (p.modus === 'beleg' && !K.geldigBeleg(p.beleg)) return
      toonSpeltype(p)
    })
    const zet = msg => {
      const p = msg.payload || {}
      if (p.beleg) {   // belegering: de hele stand van allebei
        if (!K.geldigBeleg(p.beleg)) return
        if (p.spelId > spelId) { toonSpeltype({ modus: 'beleg', niveau: p.beleg.niveau, spelId: p.spelId, beleg: p.beleg, nr: p.nr }); return }
        if (modus !== 'beleg' || !nieuwer(p.spelId, p.nr)) return
        const oudB = beleg; nr = p.nr; beleg = p.beleg; staat = beleg.spelers[ik]
        inRij(() => verwerkBeleg(oudB, beleg))
        return
      }
      if (p.modus && p.modus !== 'samen') { if (p.spelId > spelId && K.NIVEAUS[p.niveau]) toonSpeltype(p); return }
      if (!p.staat || !K.geldigeStand(p.staat) || !p.staat.handen) return
      if (p.spelId > spelId) { toonSpeltype({ modus: 'samen', niveau: p.staat.niveau, spelId: p.spelId, staat: p.staat, nr: p.nr }); return }
      if (modus !== 'samen' || !nieuwer(p.spelId, p.nr)) return
      const oud = staat; nr = p.nr; staat = p.staat
      inRij(() => verwerkAnder(oud, p.staat))
    }
    kanaal.on('broadcast', { event: 'zet' }, zet)
    kanaal.on('broadcast', { event: 'stand' }, zet)
    kanaal.on('broadcast', { event: 'vraag-stand' }, msg => {
      const p = msg.payload || {}
      if (spelId < 0) return
      const nieuwerBijMij = spelId > (p.spelId ?? -1) || (spelId === (p.spelId ?? -1) && nr > (p.nr ?? 0))
      if (modus === 'beleg') { if (beleg && nieuwerBijMij) stuur('stand', { beleg, nr, spelId }) }
      else if (modus === 'samen') { if (staat && nieuwerBijMij) stuur('stand', { staat, nr, spelId }) }
      else { if (spelId > (p.spelId ?? -1) && opzet) stuur('stand', opzet); stuurVoortgang() }
    })
    kanaal.on('broadcast', { event: 'voortgang' }, msg => {
      const p = msg.payload || {}
      if (p.wie !== hij || p.spelId !== spelId || (modus !== 'wedstrijd' && modus !== 'duel')) return
      const oud = tegen; tegen = p
      if (tafel && staat) { tekenInfo(staat); if (oud && p.verslagen > oud.verslagen && !afgelopen) tafel.status(T('{naam} versloeg al {n} vijanden', { naam, n: p.verslagen })) }
      controleerUitslag()
    })
    kanaal.on('broadcast', { event: 'vloek' }, msg => {
      const p = msg.payload || {}
      if (p.naar !== ik || p.spelId !== spelId || modus !== 'duel' || vloeken.has(p.id)) return
      vloeken.add(p.id)
      inRij(() => ontvangVloek())
    })
    kanaal.on('broadcast', { event: 'kaartreactie' }, msg => { const e = msg.payload && msg.payload.emoji; if (tafel && REACTIES.includes(e)) tafel.reactie(e, 'ander') })
    const klok = setInterval(() => {
      if (!inhoud.isConnected) { clearInterval(klok); return }
      if (spelId < 0 || (modus === 'samen' && staat && !staat.klaar && staat.aanZet !== ik) || (modus === 'beleg' && beleg && !beleg.klaar && beleg.aanZet !== ik)) stuur('vraag-stand', { spelId, nr })
      else if ((modus === 'wedstrijd' || modus === 'duel') && staat) { stuurVoortgang(); if (!tegen) stuur('vraag-stand', { spelId, nr }) }
    }, 3000)
    if (!benIkSpeler1) stuur('vraag-stand', { spelId, nr })
  }

  // De muziek stopt als je het spel verlaat, en zwijgt zolang de app op de achtergrond staat
  const bewaker = setInterval(() => { if (!inhoud.isConnected) { clearInterval(bewaker); stopMuziek(); scorebord?.destroy() } }, 1000)
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMuziek(); else if (muziekStaatAan() && inhoud.isConnected) startMuziek() })
  // ── Kaarslicht ──
  const KAARS = 'fibro_koningsjacht_kaars'
  const kaarsAan = () => {
    try { return localStorage.getItem(KAARS) !== 'uit' } catch (e) { return true }
  }
  function wisselKaars() {
    try { localStorage.setItem(KAARS, kaarsAan() ? 'uit' : 'aan') } catch (e) {}
    tafel?.element.classList.toggle('kj-geenkaars', !kaarsAan()); verversKaarslicht(); tekenKnoppen()
  }
  const kaarsSvg = '<svg viewBox="0 0 30 70" aria-hidden="true"><defs><linearGradient id="kjWas" x1="0" x2="1"><stop offset="0" stop-color="#d8c7a0"/><stop offset=".45" stop-color="#fff6dc"/><stop offset="1" stop-color="#b9a37a"/></linearGradient></defs>'
    + '<ellipse cx="15" cy="66" rx="14" ry="4" fill="#3a2410" opacity=".7"/><rect x="5" y="58" width="20" height="9" rx="3" fill="#8a6a2a"/><rect x="8" y="12" width="14" height="49" rx="3" fill="url(#kjWas)"/>'
    + '<path d="M8 15 q3 6 0 12 M21 14 q-2 8 1 15" stroke="#fff6dc" stroke-width="2.5" fill="none" stroke-linecap="round"/><rect x="14.3" y="5" width="1.4" height="8" fill="#2a1a0a"/></svg>'
  function zetKaarslicht() {
    const el = tafel.element
    el.classList.toggle('kj-geenkaars', !kaarsAan())
    const licht = document.createElement('div'); licht.className = 'kj-kaarslicht'
    licht.innerHTML = '<div class="kj-warm"></div><div class="kj-gloed"></div><div class="kj-donker"></div>'
    el.appendChild(licht)
    const ruimteschipLicht = document.createElement('div')
    ruimteschipLicht.className = 'kj-spaceship-lamplicht'
    ruimteschipLicht.setAttribute('aria-hidden', 'true')
    for (let i = 0; i < 4; i++) {
      const bundel = document.createElement('span')
      bundel.className = 'kj-ship-beam'
      ruimteschipLicht.appendChild(bundel)
    }
    el.appendChild(ruimteschipLicht)
    const midden = el.querySelector('.kt-midden')
    for (const kant of ['kj-links', 'kj-rechts']) {
      const k = document.createElement('div'); k.className = 'kj-kaars ' + kant
      k.innerHTML = kaarsSvg + '<img class="kj-kandelaar" src="./assets/koningsjacht/chamberstick.png" alt="" draggable="false"><div class="kj-vlam"></div>'
      midden.appendChild(k)
    }
    verversKandelaars()
    verversKaarslicht()
  }
  function verversKandelaars() {
    const el = tafel?.element
    if (!el?.isConnected) return
    el.classList.toggle('kj-geenkaars', !kaarsAan())
    for (const kaars of el.querySelectorAll('.kj-kaars')) {
      const bestand = sceneNaam() === 'modern' ? (kaars.classList.contains('kj-links') ? 'candle-modern-left.png' : 'candle-modern-right.png') : 'chamberstick.png'
      const afbeelding = kaars.querySelector('.kj-kandelaar')
      const url = new URL('./assets/koningsjacht/' + bestand, import.meta.url).href
      if (afbeelding.src !== url) afbeelding.src = url
    }
    if (!ruimteschipActief()) zetKaarsSlijtage(el, { scene: sceneNaam(), bierpul: instellingen.bierpul, ronde: instellingen.bierRonde })
  }
  function verversKaarslicht() {
    clearInterval(flikkerTimer); flikkerTimer = null
    const el = tafel?.element, licht = el?.querySelector('.kj-kaarslicht')
    if (!el || !licht) return
    licht.style.setProperty('--kj-licht', '0.9')
    if (!instellingen.flikkeren || !kaarsAan() || rustig()) return
    let nu = 0.9
    flikkerTimer = setInterval(() => {
      if (!el.isConnected) { clearInterval(flikkerTimer); flikkerTimer = null; return }
      if (document.hidden) return
      if (rustig()) { licht.style.setProperty('--kj-licht', '0.9'); return }
      const doel = 0.72 + Math.random() * 0.28 - (Math.random() < 0.06 ? 0.2 : 0)
      nu += (doel - nu) * 0.45
      licht.style.setProperty('--kj-licht', nu.toFixed(3))
    }, 90)
  }
  function wisselMuziek() { zetMuziek(!muziekStaatAan()); tekenKnoppen() }

  // ── De tafel ──
  function speel(s, nieuw) {
    stopScene()
    staat = s; selectie = []; scoreOpslag = null
    scorePartij.begin(samenSpel ? 'vriend:' + spelId + ':' + ik : 'solo', !samenSpel && nieuw)
    beginBierPartij(nieuw)
    if (muziekStaatAan()) startMuziek()
    bewaar()
    tafel = maakKaartTafel(inhoud, {
      solo: !samenSpel, naamAnder: samenSpel ? naam : '', stijl: STIJL, onReactie: emoji => stuur('kaartreactie', { emoji }), ondergrond: 'hout', stapelTekst: n => T('Taveerne: {n}', { n }),
      groep: () => 'alles',                              // je mag elke kaart erbij kiezen; magSpelen beslist
      magSpelen: ids => !afgelopen && aanMij(staat) && (staat.fase === 'aanval' ? K.magAanvallen(staat, ids) : K.magAfweren(staat, ids)),
      onSpeel: (ids, opts) => staat.fase === 'aanval' ? valAan(ids, opts) : weerAf(ids, opts),
      onPak: () => tafel.status(T('De taveerne: met ♦ ruiten pak je hier kaarten')),
      onSelectie: ids => { selectie = ids; if (!bezig) { tekenKnoppen(); tafel.status(statusTekst()) } },
      instellingKnop: false, trillen: () => instellingen.impact,   // één eigen schakelaar bestuurt schermschok én telefoontrilling
      animatieFactor: koningsjachtBewegingsfactor,
      dynamischeStapel: true,
      leesbareSelectie: true, // ruimte voor iedere kaartwaarde en soort, ook achter vergrote kaarten
    })
    tafel.element.classList.add('kj')
    plaatsScene(tafel.element)
    zetKaarslicht()
    stuurBier()
    const ander = tafel.element.querySelector('.kt-ander')
    const paneel = document.createElement('div'); paneel.className = 'kj-vijand'
    paneel.innerHTML = '<div class="kj-kasteel" aria-hidden="true"><div>' + achterkantSvg(STIJL) + '</div><div>' + achterkantSvg(STIJL) + '</div><div>'
      + achterkantSvg(STIJL) + '</div><span></span></div><div class="kj-kaart"></div><div class="kj-stats"><div class="kj-naam"></div>'
      + '<div class="kj-hud"><div class="kj-wachters" role="img"><b>0</b><small>/12</small></div><div class="kj-hud-balken">'
      + '<div class="kj-balk" role="progressbar"><div class="kj-schade-spoor"></div><div class="kj-vul"></div><span></span></div>'
      + '<div class="kj-schildbalk" role="progressbar"><div class="kj-schildvul"></div><span></span></div></div></div><div class="kj-regel"></div><div class="kj-immuun"></div></div>'
    ander.appendChild(paneel)
    if (nieuw) inRij(async () => {
      tafel.toon(beeld(staat, { mijnBeurt: false, status: T('De kaarten worden geschud...') }))
      tekenVijand({ kasteel: [], schade: 0, schild: 0 })
      await tafel.deelAnimatie({ mijnKaarten: mijnHand(staat), anderAantal: 0, open: null })
      await nieuweVijand(staat)
      teken()
    })
    else inRij(async () => { tafel.toon(beeld(staat, { mijnBeurt: false })); tekenInfo(staat); await nieuweVijand(staat); teken() })
  }

  function bewaar() {
    if (samenSpel) return
    if (staat?.klaar) bewaarScore()
    schrijf(BEWAAR, staat && !staat.klaar ? staat : null)
    if (!staat || staat.klaar) schrijf(BIER_PARTIJ, null)
  }
  function beeld(s, extra = {}) {
    const aan = !s.klaar && !afgelopen && aanMij(s)
    return { hand: mijnHand(s), anderAantal: 0, stapelAantal: s.taveerne.length, afleg: s.tafel, mijnBeurt: aan,
      speelbaar: aan ? mijnHand(s) : [], status: statusTekst(s), ...extra }
  }
  function statusTekst(s = staat) {
    if (!s || s.klaar) return ''
    if (afgelopen) return ''
    if (modus === 'beleg' && beleg && !aanMij(s)) return T('{naam} valt jouw kasteel aan...', { naam })
    if (!aanMij(s)) return s.fase === 'verdedig' ? T('{naam} moet afweren...', { naam }) : T('{naam} is aan de beurt...', { naam })
    if (s.fase === 'verdedig') {
      const n = K.teAfweren(s), gekozen = K.som(selectie)
      return selectie.length ? T('Afweren: {s} van {n}', { s: gekozen, n }) : T('Weer {n} af: kies kaarten die samen {n} of meer zijn', { n })
    }
    if (!selectie.length) return mijnHand(s).length ? T('Val aan: kies kaarten en veeg ze omhoog') : T('Geen kaarten meer: pas of zet een nar in')
    const u = K.aanvalUitkomst(s, selectie)
    if (!u) return T('Samen mag alleen: een aas met één kaart, of dezelfde waarden tot 10')
    const delen = [T('{n} schade', { n: u.schade })]
    if (u.werkt.includes('h')) delen.push('♥ ' + T('{n} terug', { n: Math.min(u.kracht, s.afleg.length) }))
    if (u.werkt.includes('r')) delen.push('♦ ' + T('pak {n}', { n: Math.min(u.kracht, K.maxHand(s) - (mijnHand(s).length - selectie.length), s.taveerne.length) }))
    if (u.werkt.includes('s')) delen.push('♠ ' + T('schild {n}', { n: u.kracht }))
    if (u.immuun) delen.push(T('{k} werkt niet', { k: KLEUR_TEKEN[u.immuun] }))
    return delen.join(' · ')
  }
  function teken() {
    if (!tafel || !staat) return
    tafel.toon(beeld(staat))
    tekenVijand(staat); tekenKnoppen(); tekenInfo(staat)
  }
  function tekenKnoppen() {
    if (!tafel || !staat || staat.klaar || afgelopen) { tafel?.knoppen([]); return }
    const lijst = []
    // 26 nov 2026: ↻ Opnieuw beginnen staat onder ⚙️ Instellingen. Vooraan in deze balk maakte hij de balk op smalle
    // telefoons (360-375 px) drie rijen hoog, en dan lag de balk over je bierpul (proef299 R).
    if (!aanMij(staat)) { /* de ander is aan de beurt: alleen muziek, kaarslicht en spelregels */ }
    else if (staat.fase === 'aanval') {
      lijst.push({ naam: 'aanval', tekst: '⚔️ ' + T('Aanvallen'), nadruk: K.magAanvallen(staat, selectie), opKlik: () => valAan(selectie) })
      lijst.push({ naam: 'pas', tekst: T('Passen'), uit: !K.magPassen(staat), opKlik: pas })
    } else {
      lijst.push({ naam: 'afweer', tekst: '🛡️ ' + T('Afweren') + ' ' + K.som(selectie) + '/' + K.teAfweren(staat), nadruk: K.magAfweren(staat, selectie), opKlik: () => weerAf(selectie) })
    }
    if (staat.narren > 0 && aanMij(staat)) lijst.push({ naam: 'nar', tekst: '🃏 ' + T('Nar') + ' ×' + staat.narren, schud: staat.fase === 'verdedig' && K.som(mijnHand(staat)) < K.teAfweren(staat), opKlik: nar })
    lijst.push({ naam: 'muziek', tekst: '🎵', nadruk: muziekStaatAan(), opKlik: wisselMuziek })
    lijst.push({ naam: 'kaars', tekst: '🕯️', nadruk: kaarsAan(), opKlik: wisselKaars })
    lijst.push({ naam: 'instellingen', tekst: '⚙️', opKlik: toonInstellingen })
    lijst.push({ naam: 'regels', tekst: '📜', opKlik: toonRegels })
    lijst.push({ naam: 'scores', tekst: '🏆', opKlik: toonScores })
    tafel.knoppen(lijst)
    const instellingenKnop = tafel.element.querySelector('[data-naam="instellingen"]')
    if (instellingenKnop) { instellingenKnop.setAttribute('aria-label', T('Instellingen')); instellingenKnop.title = T('Instellingen') }
    const scoresKnop = tafel.element.querySelector('[data-naam="scores"]')
    if (scoresKnop) { scoresKnop.setAttribute('aria-label', T('Scores')); scoresKnop.title = T('Scores') }
  }
  function tekenInfo(s) {
    const pil = t => '<span class="kj-pil">' + t + '</span>'
    const steen = (emoji, waarde, pad) => pil('<span class="kj-teller-emoji">' + emoji + '</span><svg class="kj-steen-symbool" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + pad + '</svg> ' + waarde)
    let extra = ''
    if (modus === 'beleg' && beleg) {
      const f = beleg.spelers[hij], v = K.vijandInfo(f)
      extra = pil((beleg.aanZet === hij ? '▶ ' : '') + '⚔️ ' + esc(naam)) + pil('🏰 ' + esc(T('Jouw kasteel')) + ': ' + (12 - f.verslagen) + (v ? ' · ❤ ' + v.over : ''))
    } else if (modus === 'samen') extra = pil((s.aanZet === hij ? '▶ ' : '') + '🤝 ' + esc(naam) + ': ' + K.hand(s, hij).length)
    else if (samenSpel) extra = pil((modus === 'duel' ? '⚔️ ' : '🏁 ') + esc(naam) + ': ' + (tegen ? tegen.verslagen : 0) + '/12' + (tegen && tegen.klaar && !tegen.gewonnen ? ' 💀' : ''))
    tafel.info(steen('👑',s.verslagen + '/12','<path d="M3 7l4 4 5-7 5 7 4-4-2 11H5zM6 21h12"/>') + steen('🃏',s.narren,'<path d="M4 18h16M6 18V8l4 4 2-8 2 8 4-4v10M5 5h.01M12 2h.01M19 5h.01"/>') + (samenSpel ? '' : steen('🗑️',s.afleg.length,'<rect x="4" y="8" width="11" height="13" rx="1"/><path d="M9 8V3h11v13h-5M7 12h5M7 16h5"/>')) + extra)
  }
  // Het paneel bovenin: kasteel, de vijand, zijn leven, aanval, schild en waar hij niet tegen kan
  function tekenVijand(s, { kaart = true } = {}) {
    const p = tafel?.element.querySelector('.kj-vijand')
    if (!p) return
    const v = K.vijandInfo(s)
    p.querySelector('.kj-kasteel > span').textContent = modus === 'beleg' ? T('{naam}: {n}', { naam, n: Math.max(0, s.kasteel.length - 1) }) : T('Kasteel: {n}', { n: Math.max(0, s.kasteel.length - 1) })
    p.querySelector('.kj-kasteel').style.visibility = s.kasteel.length > 1 ? '' : 'hidden'
    const kaartEl = p.querySelector('.kj-kaart')
    const verslagenAantal = Math.max(0, Math.min(12, s.verslagen ?? staat?.verslagen ?? 0))
    p.querySelector('.kj-wachters b').textContent = verslagenAantal
    p.querySelector('.kj-wachters').setAttribute('aria-label', T('{n} van de 12 wachters verslagen', { n: verslagenAantal }))
    const levensbalk = p.querySelector('.kj-balk'), schildbalk = p.querySelector('.kj-schildbalk')
    const schild = Math.max(0, s.schild || 0), aanval = v?.aanval || 0, bescherming = Math.min(schild, aanval)
    for (const [balk, waarde, max, tekst] of [
      [levensbalk, v?.over || 0, v?.leven || 1, T('Leven van de wachter')],
      [schildbalk, bescherming, aanval || 1, T('Jouw schild: {n} van {aanval} schade afgevangen', { n: bescherming, aanval })]
    ]) {
      balk.setAttribute('aria-valuemin', '0'); balk.setAttribute('aria-valuemax', max)
      balk.setAttribute('aria-valuenow', waarde); balk.setAttribute('aria-label', tekst); balk.title = tekst
    }
    p.querySelector('.kj-schildvul').style.width = (aanval ? 100 * bescherming / aanval : 0) + '%'
    p.querySelector('.kj-schildbalk span').textContent = '🛡 ' + schild
    p.querySelector('.kj-schade-spoor').style.width = (v ? 100 * v.over / v.leven : 0) + '%'
    levensbalk.style.setProperty('--kj-segment', (v ? 100 * 5 / v.leven : 25) + '%')
    if (!v) { kaartEl.innerHTML = ''; for (const c of ['.kj-naam', '.kj-regel', '.kj-immuun', '.kj-balk span']) p.querySelector(c).textContent = ''; p.querySelector('.kj-vul').style.width = '0%'; return }
    if (kaart && (kaartEl.dataset.id !== v.id || kaartEl.dataset.stijl !== STIJL)) { kaartEl.innerHTML = kaartSvg(v.id, STIJL); kaartEl.dataset.id = v.id; kaartEl.dataset.stijl = STIJL }
    p.querySelector('.kj-naam').textContent = vijandNaam(v.id)
    p.querySelector('.kj-vul').style.width = (100 * v.over / v.leven) + '%'
    p.querySelector('.kj-balk span').textContent = '❤ ' + v.over + ' / ' + v.leven
    p.querySelector('.kj-regel').innerHTML = '<span>⚔️ ' + v.slag + (s.schild ? ' <s style="opacity:.6">' + v.aanval + '</s>' : '') + '</span>' + (s.schild ? '<span>🛡️ ' + s.schild + '</span>' : '')
    const im = p.querySelector('.kj-immuun')
    im.innerHTML = '<span>' + esc(T('Immuun voor')) + '</span><b class="kj-immuun-icoon" data-kleur="' + v.kleur + '" role="img" aria-label="' + esc(T(KLEURNAAM[v.kleur])) + '"><span aria-hidden="true">' + KLEUR_TEKEN[v.kleur] + '</span></b>'
    p.setAttribute('aria-label', vijandNaam(v.id) + ': ' + v.over + '/' + v.leven)
  }
  const vijandKaart = () => tafel.element.querySelector('.kj-kaart')

  // ── Licht en animaties ──
  const rustig = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false } }
  const LICHT = { h: '#ff4d6d', r: '#c084fc', k: '#4ade80', s: '#60a5fa' }
  function fxLaag() {
    let f = tafel.element.querySelector('.kj-fx')
    if (!f) { f = document.createElement('div'); f.className = 'kj-fx'; tafel.element.appendChild(f) }
    return f
  }
  // midden van een element, ten opzichte van de tafel
  function plek(el) {
    const t = tafel.element.getBoundingClientRect(), r = el.getBoundingClientRect()
    return { x: r.left - t.left + r.width / 2, y: r.top - t.top + r.height / 2, b: r.width, h: r.height }
  }
  const anim = (el, frames, opts = {}) => { try { const factor = koningsjachtBewegingsfactor(); return el.animate(frames, { ...opts, duration: (opts.duration || 0) * factor, delay: (opts.delay || 0) * factor }).finished.catch(() => {}) } catch (e) { return Promise.resolve() } }
  // een ronde lichtflits (kleur) op een plek
  function lichtflits(x, y, kleur, maat = 160, duur = 520) {
    const d = document.createElement('div'); d.className = 'kj-licht'
    d.style.cssText = 'left:' + (x - maat / 2) + 'px;top:' + (y - maat / 2) + 'px;width:' + maat + 'px;height:' + maat + 'px;background:radial-gradient(circle,#fff 0%,' + kleur + ' 30%,' + kleur + '00 70%)'
    fxLaag().appendChild(d)
    return anim(d, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.25 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: duur, easing: 'ease-out' }).then(() => d.remove())
  }
  // vonken die alle kanten op vliegen
  function vonken(x, y, kleuren, n = 16, ver = 90) {
    if (rustig()) n = Math.min(n, 5)
    const f = fxLaag(), klaar = []
    for (let i = 0; i < n; i++) {
      const v = document.createElement('div'); v.className = 'kj-vonk'
      const k = kleuren[i % kleuren.length]
      v.style.cssText = 'left:' + (x - 3) + 'px;top:' + (y - 3) + 'px;background:' + k + ';box-shadow:0 0 8px ' + k + ',0 0 16px ' + k
      f.appendChild(v)
      const hoek = Math.random() * Math.PI * 2, af = ver * (0.5 + Math.random() * 0.7)
      klaar.push(anim(v, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + Math.cos(hoek) * af + 'px,' + (Math.sin(hoek) * af + 20) + 'px) scale(.2)', opacity: 0 }],
        { duration: 500 + Math.random() * 350, easing: 'cubic-bezier(.1,.7,.3,1)' }).then(() => v.remove()))
    }
    return Promise.all(klaar)
  }
  // een zwaardhaal van licht over de vijand (schuin), of een kruis (dubbel)
  function zwaardhaal(p, kleur, richting = 1, vertraging = 0, bijInslag = null) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'kj-haal')
    const w = p.b * 1.9, h = p.h * 1.5
    svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none')
    svg.style.cssText = 'left:' + (p.x - w / 2) + 'px;top:' + (p.y - h / 2) + 'px;filter:drop-shadow(0 0 6px ' + kleur + ') drop-shadow(0 0 14px ' + kleur + ')'
    if (bijInslag) svg.dataset.schildinslag = 'ja'
    const pad = richting > 0 ? 'M8 12 Q50 46 92 88' : 'M92 12 Q50 46 8 88'
    svg.innerHTML = '<path d="' + pad + '" fill="none" stroke="' + kleur + '" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>'
      + '<path d="' + pad + '" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>'
    fxLaag().appendChild(svg)
    const lijnen = [...svg.querySelectorAll('path')]
    return Promise.all(lijnen.map(l => anim(l, [{ strokeDashoffset: 100 }, { strokeDashoffset: 0, offset: 0.35 }, { strokeDashoffset: 0 }], { duration: 520, delay: vertraging, easing: 'ease-out', fill: 'forwards' })))
      .then(() => { bijInslag?.(); return anim(svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 }) }).then(() => svg.remove())
  }
  function tril(sterk = 6) {
    if (!instellingen.impact || rustig()) return
    anim(tafel.element, [{ transform: 'none' }, { transform: 'translate(' + sterk + 'px,-' + sterk / 2 + 'px)' }, { transform: 'translate(-' + sterk + 'px,' + sterk / 2 + 'px)' },
      { transform: 'translate(' + sterk / 2 + 'px,0)' }, { transform: 'none' }], { duration: 320 })
  }
  function impact(patroon) { if (instellingen.impact) tafel?.tril(patroon) }
  // iets wat zweeft van a naar b (hartjes, fonkels)
  function zweef(tekst, kleur, van, naar, vertraging = 0) {
    const d = document.createElement('div'); d.className = 'kj-zwevend'; d.textContent = tekst; d.style.color = kleur
    d.style.left = (van.x - 11) + 'px'; d.style.top = (van.y - 14) + 'px'; d.style.opacity = '0'
    fxLaag().appendChild(d)
    const dx = naar.x - van.x + (Math.random() - 0.5) * 30, dy = naar.y - van.y
    return anim(d, [{ transform: 'translate(0,0) scale(.5)', opacity: 0 }, { transform: 'translate(' + dx * 0.3 + 'px,' + (dy * 0.3 - 30) + 'px) scale(1.2)', opacity: 1, offset: 0.3 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.6)', opacity: 0 }], { duration: 900, delay: vertraging, easing: 'ease-in-out', fill: 'both' }).then(() => d.remove())
  }

  // Jouw kaarten vallen aan: ze lichten op in hun kleur, schieten naar de vijand en terug; bij de inslag licht en vonken
  async function kaartenVallenAan(ids, l) {
    const kaart = vijandKaart(); if (!kaart) return
    const doel = plek(kaart)
    const aflegKaarten = [...tafel.element.querySelectorAll('.kt-afleg .kt-ak')].slice(-ids.length)
    const kleuren = [...new Set(ids.map(id => LICHT[id[0]]))]
    const hoofdKleur = l.immuun ? '#9ca3af' : kleuren[0]
    const dubbel = l.werkt.includes('k')
    let inslag
    const geraakt = new Promise(k => { inslag = k })
    aflegKaarten.forEach((el, i) => {
      el.style.setProperty('--kj-gloed', LICHT[ids[i][0]] || '#f5b301'); el.classList.add('kj-gloeit')
      const van = plek(el), dx = doel.x - van.x, dy = doel.y - van.y + doel.h * 0.15
      const basis = el.style.transform || ''
      anim(el, [{ transform: basis, offset: 0 }, { transform: basis + ' translate(0,14px) scale(1.05)', offset: 0.18 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (i % 2 ? 18 : -18) + 'deg) scale(.8)', offset: 0.5 },
        { transform: basis, offset: 1 }], { duration: rustig() ? 420 : 760, delay: i * 70, easing: 'cubic-bezier(.5,0,.3,1)' })
        .then(() => el.classList.remove('kj-gloeit'))
    })
    setTimeout(inslag, ((rustig() ? 210 : 380) + (aflegKaarten.length - 1) * 70) * koningsjachtBewegingsfactor())
    await geraakt
    if (l.immuun) geluid('immuun'); else if (dubbel) geluid('dubbel'); else geluid('zwaard', l.schade >= 15 ? 2 : 1)
    impact(dubbel ? [30, 40, 50] : [25, 30, 25]); tril(dubbel ? 9 : 6)
    const halen = [zwaardhaal(doel, hoofdKleur, 1)]
    if (dubbel) halen.push(zwaardhaal(doel, LICHT.k, -1, 260))
    lichtflits(doel.x, doel.y, hoofdKleur, doel.b * 2.4)
    vonken(doel.x, doel.y, l.immuun ? ['#d1d5db', '#9ca3af'] : [...kleuren, '#fde68a', '#fff'], 18, 100)
    if (dubbel) setTimeout(() => { lichtflits(doel.x, doel.y, LICHT.k, doel.b * 3); vonken(doel.x, doel.y, [LICHT.k, '#fff'], 14, 120); impact(10); tril(10) }, 300 * koningsjachtBewegingsfactor())
    await Promise.all([raak(l.schade, dubbel), ...halen])
  }
  let actiefSchild = null
  async function schildLicht(n, houden = false) {
    if (actiefSchild?.isConnected) return actiefSchild
    geluid('schild')
    const hand = tafel.element.querySelector('.kt-hand'); if (!hand) return
    const p = plek(hand)
    const middeleeuws = sceneNaam() === 'middeleeuws'
    const d = document.createElement('div')
    if (middeleeuws) {
      const breedte = Math.min(190, Math.max(150, p.b * 0.44)), hoogte = breedte * 1.3
      d.className = 'kj-medieval-shield'
      // Het schild staat op de voorrand van de hand: de kaartspeler ziet de achterkant en de draagbanden.
      d.style.cssText = 'left:' + (p.x - breedte / 2) + 'px;top:' + (p.y + p.h * 0.5 - hoogte * 0.78) + 'px;width:' + breedte + 'px;height:' + hoogte + 'px'
      d.innerHTML = '<svg viewBox="0 0 200 260" role="img" aria-label="' + esc(T('De achterkant van een middeleeuws schild, met draagbanden naar jou en de voorkant naar de tegenstander')) + '" xmlns="http://www.w3.org/2000/svg">'
        + '<defs><linearGradient id="kjSchildRand" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b8a783"/><stop offset=".18" stop-color="#514638"/><stop offset=".42" stop-color="#a79570"/><stop offset=".68" stop-color="#393229"/><stop offset=".88" stop-color="#958365"/><stop offset="1" stop-color="#30291f"/></linearGradient>'
        + '<linearGradient id="kjSchildHout" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#291a11"/><stop offset=".2" stop-color="#503722"/><stop offset=".48" stop-color="#322116"/><stop offset=".72" stop-color="#62442b"/><stop offset="1" stop-color="#26180f"/></linearGradient>'
        + '<linearGradient id="kjSchildLeer" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#765239"/><stop offset=".48" stop-color="#3f281b"/><stop offset="1" stop-color="#25180f"/></linearGradient>'
        + '<linearGradient id="kjSchildHandvat" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a27b50"/><stop offset=".38" stop-color="#4b3020"/><stop offset=".72" stop-color="#291a12"/><stop offset="1" stop-color="#866342"/></linearGradient>'
        + '<filter id="kjSchildTextuur"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="8"/><feColorMatrix values=".35 0 0 0 .18 .35 0 0 0 .13 .35 0 0 0 .08 0 0 0 .16 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>'
        + '<path d="M15 14Q100 31 185 14L177 137Q169 207 100 250Q31 207 23 137Z" fill="url(#kjSchildRand)" stroke="#17130f" stroke-width="5"/>'
        + '<path d="M25 25Q100 40 175 25L168 135Q161 194 100 232Q39 194 32 135Z" fill="url(#kjSchildHout)" stroke="#33291d" stroke-width="2.5"/>'
        + '<path d="M25 25Q100 40 175 25L168 135Q161 194 100 232Q39 194 32 135Z" fill="#87613e" opacity=".13" filter="url(#kjSchildTextuur)"/>'
        + '<path d="M56 34Q61 126 69 199M100 39V222M144 34Q139 126 131 199" fill="none" stroke="#160f0a" stroke-width="3" opacity=".68"/>'
        + '<path d="M60 35Q65 122 72 196M104 39V220M148 34Q143 122 128 196" fill="none" stroke="#b18a5d" stroke-width="1.2" opacity=".34"/>'
        + '<g fill="url(#kjSchildLeer)" stroke="#241810" stroke-width="2.5"><path d="M45 65Q100 78 155 65L151 83Q100 97 49 83Z"/><path d="M39 164Q100 188 161 164L157 182Q100 207 43 182Z"/></g>'
        + '<path d="M48 71Q100 84 152 71M43 170Q100 192 157 170" fill="none" stroke="#c4a174" stroke-width="1.5" opacity=".65"/>'
        + '<path d="M53 74L76 79M147 74L124 79M46 173L72 181M154 173L128 181" fill="none" stroke="#d2b48c" stroke-width="1.6" stroke-dasharray="2 5" opacity=".8"/>'
        + '<g fill="url(#kjSchildRand)" stroke="#241a12" stroke-width="2"><path d="M72 101Q100 91 128 101L124 157Q100 169 76 157Z"/><path d="M62 96L78 91L83 108L67 113Z"/><path d="M138 96L122 91L117 108L133 113Z"/></g>'
        + '<path d="M81 111Q100 118 119 111L116 145Q100 151 84 145Z" fill="url(#kjSchildHandvat)" stroke="#24170f" stroke-width="2.5"/>'
        + '<path d="M84 117Q100 123 116 117M84 139Q100 145 116 139" fill="none" stroke="#c09a6b" stroke-width="1.4" opacity=".65"/>'
        + '<path d="M86 123Q100 128 114 123M86 130Q100 135 114 130" fill="none" stroke="#1b120c" stroke-width="1.2" opacity=".8"/>'
        + '<g fill="#b9aa89" stroke="#2c2419" stroke-width="2"><circle cx="28" cy="39" r="3.8"/><circle cx="172" cy="39" r="3.8"/><circle cx="34" cy="103" r="3.8"/><circle cx="166" cy="103" r="3.8"/><circle cx="43" cy="164" r="3.8"/><circle cx="157" cy="164" r="3.8"/><circle cx="68" cy="211" r="3.8"/><circle cx="132" cy="211" r="3.8"/></g>'
        + '<path d="M77 53Q100 61 123 53" fill="none" stroke="#d3c4a4" stroke-width="1.6" opacity=".7"/></svg>'
    } else {
      d.className = 'kj-koepel' + (ruimteschipActief() ? ' kj-koepel-spaceship' : '')
      d.style.cssText = 'left:' + (p.x - p.b * 0.46) + 'px;top:' + (p.y - p.h * 0.62) + 'px;width:' + (p.b * 0.92) + 'px;height:' + (p.h * 1.05) + 'px'
    }
    if (middeleeuws) tafel.element.appendChild(d)
    else fxLaag().appendChild(d)
    tafel.effect('♠ ' + T('Schild {n}', { n }), { gloed: false, geluid: false })
    if (houden) {
      actiefSchild = d
      d.dataset.afweer = 'omhoog'
      await anim(d, [{ transform: 'translateY(35px) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: rustig() ? 100 : 700, fill: 'forwards' })
      return d
    }
    const frames = middeleeuws
      ? [{ transform: 'perspective(650px) translateY(42px) rotateX(-76deg) scale(.5)', opacity: 0 }, { transform: 'perspective(650px) translateY(-5px) rotateX(-8deg) scale(1.06)', opacity: 1, offset: 0.48 }, { transform: 'perspective(650px) translateY(0) rotateX(-3deg) scale(1)', opacity: .98, offset: .8 }, { transform: 'perspective(650px) translateY(18px) rotateX(-6deg) scale(.96)', opacity: 0 }]
      : [{ transform: 'scaleY(.1)', opacity: 0 }, { transform: 'scaleY(1.05)', opacity: 1, offset: 0.48 }, { transform: 'scaleY(1)', opacity: 0.9, offset: 0.8 }, { transform: 'scaleY(1)', opacity: 0 }]
    await anim(d, frames, { duration: rustig() ? 900 : 2100, easing: 'ease-out' })
    d.remove()
  }
  async function genezenLicht(n) {
    geluid('genezen')
    tafel.effect('♥ ' + T('{n} kaarten terug', { n }), { gloed: false, geluid: false })
    const van = plek(tafel.element.querySelector('.kt-afleg')), naar = plek(tafel.element.querySelector('.kt-stapel'))
    const tochten = []
    for (let i = 0; i < Math.min(8, n + 2); i++) tochten.push(zweef('♥', LICHT.h, van, naar, i * 90))
    await Promise.all(tochten)
    lichtflits(naar.x, naar.y, LICHT.h, 120)
  }
  function pakLicht() {
    geluid('pakken')
    const p = plek(tafel.element.querySelector('.kt-stapel'))
    lichtflits(p.x, p.y, LICHT.r, 140, 700); vonken(p.x, p.y, [LICHT.r, '#fff'], 12, 70)
  }

  // ── De vijand ──
  async function nieuweVijand(s) {
    tekenVijand(s)
    const k = vijandKaart()
    if (!k || !K.vijand(s)) return
    geluid('hoorn')
    const p = plek(k)
    lichtflits(p.x, p.y, '#ef4444', p.b * 2.6, 900)
    await anim(k, [{ transform: 'translateY(-90px) rotate(-14deg) scale(.6)', opacity: 0, filter: 'brightness(3)' }, { transform: 'translateY(6px) rotate(3deg) scale(1.1)', opacity: 1, filter: 'brightness(1.6) drop-shadow(0 0 16px #ef4444)', offset: 0.7 },
      { transform: 'none', opacity: 1, filter: 'none' }], { duration: rustig() ? 300 : 700, easing: 'cubic-bezier(.2,.8,.3,1)' })
  }
  async function raak(schade, dubbel) {
    const k = vijandKaart()
    if (!k) return
    k.classList.remove('kj-geraakt'); void k.offsetWidth; k.classList.add('kj-geraakt')
    const r = k.getBoundingClientRect()
    const g = document.createElement('div'); g.className = 'kj-raakgetal'; g.textContent = '−' + schade + (dubbel ? ' ♣×2' : '')
    g.style.left = (r.left + r.width / 2) + 'px'; g.style.top = (r.top + r.height * 0.3) + 'px'
    document.body.appendChild(g)
    await anim(g, [{ transform: 'translate(-50%,0) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-30px) scale(1.3)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-60px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out' })
    g.remove()
  }
  // de vijand springt naar voren en haalt drie keer uit: rode klauwen over de tafel
  async function slaTerug(s) {
    const k = vijandKaart(), v = K.vijandInfo(s)
    if (!k || !v) return
    const beschermd = s.schild > 0
    const schild = beschermd ? await schildLicht(s.schild, true) : null
    const t = tafel.element.getBoundingClientRect()
    const midden = { x: t.width / 2, y: t.height * .62, b: t.width * .55, h: t.height * .35 }
    geluid('vijandSlaat', v.slag >= 15 ? 1.4 : 1)
    const sprong = anim(k, [{ transform: 'none', filter: 'none' }, { transform: 'translateY(34px) scale(1.18) rotate(-5deg)', filter: 'brightness(1.5) drop-shadow(0 0 18px #ef4444)', offset: .4 }, { transform: 'none', filter: 'none' }], { duration: 640, easing: 'ease-in-out' })
    await wacht(rustig() ? 150 : 420)
    try {
      if (schild) {
        const hit = plek(schild), van = plek(k)
        schild.dataset.afweer = 'geraakt'
        impact([40, 40, 60]); tril(11)
        const flits = document.createElement('div'); flits.className = 'kj-flits'; tafel.element.appendChild(flits)
        // De bestaande neonhalen eindigen op de bovenzijde van de voorkant. Het schild ligt
        // vóór de lichtlaag en bedekt de laatste pixels; onder het schild verschijnt niets.
        const randY = hit.y - hit.h / 2, eindY = randY + 8
        const beginY = Math.min(van.y + van.h * .35, eindY - 80)
        const hoogte = (eindY - beginY) / .76, breedte = Math.min(125, Math.max(68, hit.b * .6))
        const halen = [-.24, 0, .24].map((d, i) => {
          const x = hit.x + d * hit.b
          return zwaardhaal({ x: x + .42 * breedte, y: beginY + .38 * hoogte, b: breedte / 1.9, h: hoogte / 1.5 }, '#ef4444', -1, i * 70, () => {
            lichtflits(x, randY - 2, '#ef4444', 44, 260)
            vonken(x, randY - 2, ['#fff', '#ff6b42', '#ffce81'], 8, 35)
          })
        })
        await Promise.all([sprong, anim(flits, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 700 }).then(() => flits.remove()), ...halen])
        geluid('afweren'); impact([25, 30, 25])
        await anim(schild, [{ transform: 'translateY(0)' }, { transform: 'translateY(7px) rotate(3deg)', offset: .3 }, { transform: 'none' }], { duration: 400 })
        tafel.effect(v.slag === 0 ? T('Je schild houdt hem tegen!') : T('Schild vangt {n} op · nog {schade} afweren', { n: Math.min(s.schild, v.aanval), schade: v.slag }), { geluid: false, gloed: false })
        await wacht(rustig() ? 300 : 850)
      } else {
        impact([40, 40, 60]); tril(11)
        const flits = document.createElement('div')
        flits.className = 'kj-flits'; tafel.element.appendChild(flits)
        vonken(midden.x, midden.y, ['#ef4444', '#f97316', '#fff'], 16, 120)
        const flitsAnimatie = anim(flits, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 700 }).then(() => flits.remove())
        await Promise.all([sprong, flitsAnimatie, ...[-.18, 0, .18].map((d, i) => zwaardhaal({ x: midden.x + d * t.width, y: midden.y, b: midden.b * .5, h: midden.h }, '#ef4444', -1, i * 70))])
        tafel.effect(T('{naam} slaat terug: {n}!', { naam: vijandNaam(v.id), n: v.slag }), { geluid: false, gloed: false })
        await wacht(500)
      }
      await sprong
    } finally {
      if (schild) { await anim(schild, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(30px)' }], { duration: rustig() ? 100 : 550 }); schild.remove(); actiefSchild = null }
    }
  }
  async function verslagen(l, nieuw) {
    const k = vijandKaart()
    const kaart = vijandNaam(l.vijand)
    geluid('verslagen', l.precies)
    const uitleg = l.precies ? T('Precies raak. De {kaart} gaat boven op de Taveerne.', { kaart })
      : T('De {kaart} is verslagen en gaat naar de aflegstapel.', { kaart })
    tafel.status(uitleg)
    tafel.effect(l.precies ? T('Precies raak!') : T('Wachter verslagen!'), { geluid: false })
    if (k) {
      const p = plek(k)
      lichtflits(p.x, p.y, '#fde68a', p.b * 3.2, 900)
      vonken(p.x, p.y, ['#fde68a', '#f5b301', '#fff', '#a16207'], 26, 150)
      const r = k.getBoundingClientRect()
      const doel = tafel.element.querySelector(l.precies ? '.kt-stapel' : '.kt-afleg').getBoundingClientRect()
      const dx = doel.left + doel.width / 2 - (r.left + r.width / 2), dy = doel.top + doel.height / 2 - (r.top + r.height / 2)
      if (l.precies) { k.style.setProperty('--kj-gloed', '#fde68a'); k.classList.add('kj-gloeit') }
      await anim(k, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-10px) scale(1.1)', opacity: 1, offset: 0.2 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (l.precies ? 0 : 8) + 'deg) scale(' + doel.width / r.width + ')', opacity: 1 }], { duration: rustig() ? 400 : 1150, easing: 'ease-in-out' })
      k.classList.remove('kj-gloeit')
      k.innerHTML = ''; k.dataset.id = ''
      if (l.precies) { const st = plek(tafel.element.querySelector('.kt-stapel')); lichtflits(st.x, st.y, '#fde68a', 150) }
    }
    tafel.toon(beeld(nieuw, { afleg: l.precies ? [] : [l.vijand], mijnBeurt: false, status: uitleg }))
    await wacht(750)
  }

  // ── Een aanval laten zien (van jou, of in 'samen' van de ander: dan komen de kaarten van boven) ──
  const vanBoven = n => { const t = tafel.element.getBoundingClientRect(); return Array.from({ length: n }, (_, i) => ({ left: t.left + t.width / 2 - 30 + i * 12, top: t.top - 90, width: 60, height: 84 })) }
  function toonGespeeldeKaarten(ids, eigen, vanRects, opts, snelheid) {
    const vertrek = vanRects || vanBoven(ids.length)
    if (!eigen) return tafel.anderSpeeltAnimatie(ids, { leesbaar: true, vanRects: vertrek })
    return tafel.speelAnimatie(ids, { leesbaar: true, snelheid: opts.snelheid || snelheid, richting: opts.richting || { x: 0, y: -1 }, vanRects: vertrek })
  }
  function zetUitleg(ids, l) {
    const kaarten = ids.map(kaartNaam).join(' + ')
    const redenen = []
    if (l.schade) redenen.push(T('{n} schade', { n: l.schade }))
    if (l.genezen) redenen.push(T('brengt {n} kaarten van de aflegstapel terug naar de Taveerne', { n: l.genezen }))
    const gepakt = l.gepaktPer ? Object.values(l.gepaktPer).reduce((som, kaarten) => som + kaarten.length, 0) : (l.gepakt || []).length
    if (gepakt) redenen.push(T('pakt {n} kaarten uit de Taveerne', { n: gepakt }))
    if (l.schild && !l.verslagen) redenen.push(T('geeft {n} schild', { n: l.schild }))
    if (l.immuun) redenen.push(T('werkt niet tegen {kleur}', { kleur: KLEUR_TEKEN[l.immuun] }))
    return T('Gespeeld: {kaarten} — {reden}', { kaarten, reden: redenen.join(' · ') || T('gebruikt deze kaart') })
  }
  async function toonAanval(oud, nieuw, ids, { eigen = true, vanRects = null, opts = {} } = {}) {
    const l = nieuw.laatste
    const handNa = eigen ? mijnHand(oud).filter(id => !ids.includes(id)) : mijnHand(oud)
    const uitleg = zetUitleg(ids, l)
    tafel.toon(beeld(oud, { hand: handNa, afleg: [...oud.tafel, ...ids], mijnBeurt: false, status: uitleg }))
    await toonGespeeldeKaarten(ids, eigen, vanRects, opts, 1)
    if (l.genezen) { tafel.toon(beeld(oud, { hand: handNa, afleg: [...oud.tafel, ...ids], stapelAantal: oud.taveerne.length + l.genezen, mijnBeurt: false, status: uitleg })); await genezenLicht(l.genezen) }
    const tussen = { kasteel: oud.kasteel, schade: Math.min(K.vijandInfo(oud).leven, oud.schade + l.schade), schild: l.verslagen ? 0 : oud.schild + l.schild, extra: oud.extra }
    await Promise.all([kaartenVallenAan(ids, l), wacht(rustig() ? 260 : 480).then(() => tekenVijand(tussen))])
    if (l.immuun) { tafel.effect(T('{naam} is immuun voor {k}', { naam: vijandNaam(l.vijand), k: KLEUR_TEKEN[l.immuun] }), { gloed: false, geluid: false }); await wacht(650) }
    if (l.schild && !l.verslagen) await schildLicht(tussen.schild, nieuw.fase === 'verdedig' || l.geenSlag)
    const mijnGepakt = l.gepaktPer ? (l.gepaktPer[ik] || []) : (eigen ? l.gepakt : [])
    if (l.gepakt.length || mijnGepakt.length) {
      pakLicht()
      if (mijnGepakt.length) {
        const alle = l.gepaktPer ? l.gepaktPer[1].length + l.gepaktPer[2].length : l.gepakt.length
        tafel.toon(beeld(oud, { hand: [...handNa, ...mijnGepakt], afleg: [...oud.tafel, ...ids], stapelAantal: oud.taveerne.length + l.genezen - alle, mijnBeurt: false, status: uitleg }))
        await tafel.pakAnimatie(mijnGepakt)
      }
    }
    if (l.verslagen) {
      await verslagen(l, nieuw)
      tafel.toon(beeld(nieuw, { mijnBeurt: false }))
      if (!nieuw.klaar) await nieuweVijand(nieuw)
    } else if (nieuw.fase === 'verdedig') {
      tafel.toon(beeld(nieuw, { mijnBeurt: false }))
      await slaTerug(nieuw)
    } else if (l.geenSlag) { await slaTerug(nieuw) }
  }
  // Na jouw zet: met z'n tweeën de stand (samen) of je voortgang (wedstrijd, duel) naar de ander
  function deel(nieuw) {
    if (!samenSpel) return
    if (modus === 'beleg') { const b = K.belegStap(beleg, ik, nieuw); if (b) { beleg = b; nr++; stuur('zet', { beleg, nr, spelId }) } }
    else if (modus === 'samen') { nr++; stuur('zet', { staat: nieuw, nr, spelId }) }
    else if (modus === 'duel' && nieuw.laatste.soort === 'aanval' && nieuw.laatste.precies) stuur('vloek', { naar: hij, spelId, id: spelId + ':' + nieuw.beurt })
  }

  // ── Wat jij doet ──
  function valAan(ids, opts = {}) {
    if (bezig || afgelopen || !aanMij(staat) || !K.magAanvallen(staat, ids)) { if (!bezig && ids.length) tafel.status(statusTekst()); return }
    const oud = staat, nieuw = K.valAan(oud, ids), l = nieuw.laatste
    const vanRects = ids.map(id => tafel.kaartRechthoek(id))
    staat = nieuw; selectie = []; bewaar(); deel(nieuw)
    inRij(async () => {
      tafel.wisSelectie(); tafel.knoppen([])
      await toonAanval(oud, nieuw, ids, { eigen: true, vanRects, opts })
      if (modus === 'duel' && l.precies && !nieuw.klaar) { tafel.effect('😈 ' + T('Vloek naar {naam}: +10 ❤', { naam }), { gloed: false, geluid: false }); await wacht(600) }
      naZet()
    })
  }
  function pas() {
    if (bezig || afgelopen || !aanMij(staat) || !K.magPassen(staat)) return
    const nieuw = K.pas(staat)
    staat = nieuw; selectie = []; bewaar(); deel(nieuw)
    inRij(async () => {
      tafel.wisSelectie(); tafel.knoppen([])
      tafel.toon(beeld(nieuw, { mijnBeurt: false, status: '' }))
      geluid('passen'); tafel.effect(T('Gepast'), { gloed: false, geluid: false }); await wacht(500)
      if (nieuw.fase === 'verdedig' || nieuw.laatste.geenSlag) await slaTerug(nieuw)
      naZet()
    })
  }
  async function toonAfweer(oud, nieuw, ids, { eigen = true, vanRects = null, opts = {} } = {}) {
    const uitleg = T('Afgeweerd met {kaarten}', { kaarten: ids.map(kaartNaam).join(' + ') })
    tafel.toon(beeld(oud, { hand: eigen ? mijnHand(oud).filter(id => !ids.includes(id)) : mijnHand(oud), afleg: [...oud.tafel, ...ids], mijnBeurt: false, status: uitleg }))
    await toonGespeeldeKaarten(ids, eigen, vanRects, opts, 0.6)
    geluid('afweren')
    const p = plek(tafel.element.querySelector('.kt-afleg'))
    lichtflits(p.x, p.y, LICHT.s, 170); vonken(p.x, p.y, [LICHT.s, '#fff'], 12, 80)
    await wacht(250)
    tafel.effect('🛡️ ' + (eigen ? T('Afgeweerd!') : T('{naam} weert af!', { naam })), { gloed: false, geluid: false })
  }
  function weerAf(ids, opts = {}) {
    if (bezig || afgelopen || !aanMij(staat) || !K.magAfweren(staat, ids)) { if (!bezig) { tafel.status(statusTekst()); tafel.geluid.nee?.() } return }
    const oud = staat, nieuw = K.weerAf(oud, ids)
    const vanRects = ids.map(id => tafel.kaartRechthoek(id))
    staat = nieuw; selectie = []; bewaar(); deel(nieuw)
    inRij(async () => {
      tafel.wisSelectie(); tafel.knoppen([])
      await toonAfweer(oud, nieuw, ids, { eigen: true, vanRects, opts })
      naZet()
    })
  }
  function nar() {
    if (bezig || afgelopen || !aanMij(staat) || !K.magNar(staat)) return
    const zeker = staat.fase === 'verdedig' && K.som(mijnHand(staat)) < K.teAfweren(staat)
    const doe = () => {
      const nieuw = K.nar(staat), l = nieuw.laatste
      staat = nieuw; selectie = []; bewaar(); deel(nieuw)
      inRij(async () => {
        tafel.wisSelectie(); tafel.knoppen([])
        geluid('nar')
        tafel.effect('🃏 ' + T('Nar!'), { geluid: false })
        const hp = plek(tafel.element.querySelector('.kt-hand'))
        vonken(hp.x, hp.y, ['#f43f5e', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#fff'], 30, 160)
        tafel.toon(beeld(nieuw, { hand: [], mijnBeurt: false, status: '' }))
        await wacht(500)
        tafel.toon(beeld(nieuw, { mijnBeurt: false, status: '' }))
        await tafel.pakAnimatie(l.gepakt)
        naZet()
      })
    }
    if (zeker) return doe()
    tafel.kiesUit(T('Nar inzetten? Je hele hand gaat weg en je krijgt {n} nieuwe kaarten.', { n: K.maxHand(staat) }), [
      { html: '✔', label: T('Ja'), waarde: true, kleur: '#15803d' }, { html: '✖', label: T('Nee'), waarde: false, kleur: '#b91c1c' }])
      .then(ja => { if (ja) doe() })
  }

  // ── Samen: wat de ander deed ──
  async function verwerkAnder(oud, nieuw) {
    const l = nieuw.laatste || {}
    if (!tafel) return
    if (!oud || l.wie !== hij) { tafel.toon(beeld(nieuw, { mijnBeurt: false })); tekenVijand(nieuw); return naZet(oud) }
    tafel.wisSelectie(); tafel.knoppen([])
    if (l.soort === 'aanval') await toonAanval(oud, nieuw, l.kaarten, { eigen: false })
    else if (l.soort === 'afweer') await toonAfweer(oud, nieuw, l.kaarten, { eigen: false })
    else if (l.soort === 'pas') {
      tafel.toon(beeld(nieuw, { mijnBeurt: false, status: '' }))
      geluid('passen'); tafel.effect(T('{naam} past', { naam }), { gloed: false, geluid: false }); await wacht(500)
      if (nieuw.fase === 'verdedig' || l.geenSlag) await slaTerug(nieuw)
    } else if (l.soort === 'nar') { geluid('nar'); tafel.effect('🃏 ' + T('{naam}: nar!', { naam }), { geluid: false }); await wacht(600) }
    naZet(oud)
  }
  // ── Duel: een vloek van de ander ──
  async function ontvangVloek() {
    if (!staat || staat.klaar || afgelopen || !tafel) return
    const n = K.vervloek(staat, 10)
    if (!n) return
    staat = n
    geluid('immuun')
    const k = vijandKaart()
    if (k) { const p = plek(k); lichtflits(p.x, p.y, '#7c3aed', p.b * 2.8, 900); vonken(p.x, p.y, ['#7c3aed', '#a855f7', '#000'], 18, 110) }
    tafel.effect('😈 ' + T('Vloek van {naam}: +10 ❤', { naam }), { gloed: false, geluid: false })
    tekenVijand(staat)
    await wacht(700)
    teken()
  }

  // ── Belegering: wat de ander deed (hij viel jouw kasteel aan) ──
  async function verwerkBeleg(oudB, b) {
    if (!tafel) return
    const l = b.laatste || {}
    if (l.wie === hij) {
      const wachter = l.vijand ? vijandNaam(l.vijand).toLowerCase() : ''
      if (l.soort === 'aanval') {
        if (l.verslagen) { geluid('verslagen', l.precies); tafel.effect('🏰 ' + (l.precies ? T('{naam} neemt jouw {wachter} gevangen!', { naam, wachter }) : T('{naam} verslaat jouw {wachter}!', { naam, wachter })), { gloed: false, geluid: false }) }
        else { geluid('zwaard', l.schade >= 15 ? 2 : 1); impact([25, 30, 25]); tafel.effect('⚔️ ' + T('{naam} valt jouw {wachter} aan: −{n}', { naam, wachter, n: l.schade }), { gloed: false, geluid: false }) }
        await wacht(rustig() ? 400 : 1100)
      } else if (l.soort === 'afweer') { geluid('afweren'); tafel.effect('🛡️ ' + T('{naam} weert af!', { naam }), { gloed: false, geluid: false }); await wacht(600) }
      else if (l.soort === 'pas') { geluid('passen'); tafel.effect(T('{naam} past', { naam }), { gloed: false, geluid: false }); await wacht(500) }
      else if (l.soort === 'nar') { geluid('nar'); tafel.effect('🃏 ' + T('{naam}: nar!', { naam }), { geluid: false }); await wacht(600) }
    }
    teken()
    if (b.klaar) return belegEinde()
    if (b.aanZet === ik && (!oudB || oudB.aanZet !== ik)) { tafel.geluid.beurt?.(); impact(15); tafel.effect(T('Jouw beurt!'), { gloed: false, geluid: false }) }
  }
  function belegEinde() {
    if (afgelopen || !beleg) return
    afgelopen = true
    const winst = beleg.winnaar === ik
    tafel.knoppen([]); tafel.toon(beeld(staat, { mijnBeurt: false, status: '' }))
    geluid(winst ? 'win' : 'verlies')
    toonEinde({
      gewonnen: winst,
      titel: winst ? '👑 ' + T('Jij wint!') : '🏰 ' + T('{naam} wint!', { naam }),
      sub: T('Jij {a} · {naam} {b}', { a: beleg.spelers[ik].verslagen + '/12', b: beleg.spelers[hij].verslagen + '/12', naam }),
      opnieuw: () => startScherm(),
    })
  }

  // ── Wedstrijd en duel: wie wint? ──
  function controleerUitslag() {
    if (modus === 'solo' || modus === 'samen' || afgelopen || !staat || !tafel) return
    const mij = { klaar: staat.klaar, gewonnen: staat.gewonnen, verslagen: staat.verslagen, narren: staat.narrenGebruikt }
    const hem = tegen || { klaar: false, gewonnen: false, verslagen: 0 }
    let uitslag = null   // 'winst', 'verlies', 'gelijk'
    if (mij.gewonnen && hem.gewonnen) uitslag = mij.narren < hem.narren ? 'winst' : mij.narren > hem.narren ? 'verlies' : 'gelijk'
    else if (mij.gewonnen) uitslag = 'winst'
    else if (hem.gewonnen) uitslag = 'verlies'
    else if (mij.klaar && hem.verslagen > mij.verslagen) uitslag = 'verlies'
    else if (hem.klaar && mij.verslagen > hem.verslagen) uitslag = 'winst'
    else if (mij.klaar && hem.klaar) uitslag = 'gelijk'
    if (!uitslag) {
      if (mij.klaar) { tafel.knoppen([]); tafel.status(T('Jij bent af met {n} van de 12. {naam} speelt nog...', { n: mij.verslagen, naam })) }
      return
    }
    afgelopen = true
    tafel.knoppen([]); tafel.toon(beeld(staat, { mijnBeurt: false, status: '' }))
    geluid(uitslag === 'winst' ? 'win' : 'verlies')
    toonEinde({
      gewonnen: uitslag === 'winst',
      titel: uitslag === 'winst' ? '👑 ' + T('Jij wint!') : uitslag === 'verlies' ? '😢 ' + T('{naam} wint!', { naam }) : '🤝 ' + T('Gelijkspel!'),
      sub: T('Jij {a} · {naam} {b}', { a: mij.verslagen + '/12', b: hem.verslagen + '/12', naam }),
      opnieuw: () => startScherm(),
    })
  }

  function naZet(oud) {
    teken()
    if (modus === 'samen' && !staat.klaar && staat.aanZet === ik && oud && oud.aanZet !== ik) { tafel.geluid.beurt?.(); impact(15) }
    if (modus === 'wedstrijd' || modus === 'duel') { stuurVoortgang(); controleerUitslag(); return }
    if (modus === 'beleg') { if (beleg && beleg.klaar) belegEinde(); return }
    if (!staat.klaar) return
    if (samenSpel) {   // samen: allebei hetzelfde einde
      geluid(staat.gewonnen ? 'win' : 'verlies')
      const v = staat.kasteel[0]
      toonEinde({
        gewonnen: staat.gewonnen,
        titel: staat.gewonnen ? '👑 ' + T('Het kasteel is van jullie!') : T('Verslagen door de {naam}', { naam: v ? vijandNaam(v).toLowerCase() : '' }),
        sub: T('Samen versloegen jullie {n} van de 12 vijanden', { n: staat.verslagen }),
        opnieuw: () => startScherm(),
      })
      return
    }
    schrijf(BEWAAR, null)
    const med = K.medaille(staat)
    if (med) { const b = lees(BESTE, {}) || {}; const volg = ['goud', 'zilver', 'brons']; if (!b[staat.niveau] || volg.indexOf(med) < volg.indexOf(b[staat.niveau])) { b[staat.niveau] = med; schrijf(BESTE, b) } }
    const v = staat.kasteel[0]
    geluid(staat.gewonnen ? 'win' : 'verlies')
    toonEinde({
      gewonnen: staat.gewonnen,
      titel: staat.gewonnen ? '👑 ' + T('Het kasteel is van jou!') : T('Verslagen door de {naam}', { naam: v ? vijandNaam(v).toLowerCase() : '' }),
      sub: staat.gewonnen ? MEDAILLE[med] + ' ' + T('Medaille: {m}', { m: T(med) }) + ' · ' + T('Narren gebruikt: {n}', { n: staat.narrenGebruikt })
        : T('Je versloeg {n} van de 12 vijanden', { n: staat.verslagen }),
      opnieuw: startScherm,
    })
  }

  startScherm()
}
