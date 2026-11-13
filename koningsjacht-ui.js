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
import * as K from './koningsjacht.js?v=2'
import { maakKaartTafel, kaartSvg, achterkantSvg, KLEUR_TEKEN, zetStijl, REACTIES } from './kaartspel-hulp.js?v=6'
import { speel as geluid, muziekStaatAan, zetMuziek, startMuziek, stopMuziek, zetMuziekThema } from './koningsjacht-geluid.js?v=3'
import { maakKoningsjachtScene } from './koningsjacht-scene.js?v=5'
import { verbindBierpul } from './koningsjacht-bier.js?v=1'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
const wacht = ms => new Promise(k => setTimeout(k, ms))
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const BEWAAR = 'fibro_koningsjacht_stand', BESTE = 'fibro_koningsjacht_best'
const SOORT = { B: 'Boer', V: 'Vrouw', H: 'Heer' }
const KLEURNAAM = { h: 'harten', r: 'ruiten', k: 'klaveren', s: 'schoppen' }
const KLEURKLEUR = { h: '#ff6b7a', r: '#e7a8ff', k: '#86efac', s: '#93c5fd' }
const MEDAILLE = { goud: '🥇', zilver: '🥈', brons: '🥉' }
const NIVEAU_NAAM = { schildknaap: 'Schildknaap', ridder: 'Ridder', koning: 'Koning' }
const lees = (k, std) => { try { const w = localStorage.getItem(k); return w === null ? std : JSON.parse(w) } catch (e) { return std } }
const schrijf = (k, w) => { try { if (w === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(w)) } catch (e) {} }
export const vijandNaam = id => T('{soort} van {kleur}', { soort: T(SOORT[id.slice(1)]), kleur: T(KLEURNAAM[id[0]]) })

const CSS = `
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
.kj-vijand{display:flex;align-items:center;gap:12px}
.kj-kasteel{position:relative;width:46px;height:64px;flex:none}
.kj-kasteel>div{position:absolute;inset:0;border-radius:4px;box-shadow:0 1px 4px #0009}
.kj-kasteel>div:nth-child(2){transform:translate(-2px,-3px)}.kj-kasteel>div:nth-child(3){transform:translate(-4px,-6px)}
.kj-kasteel>span{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);font-size:11px;font-weight:800;white-space:nowrap;text-shadow:0 1px 3px #000}
.kj-kaart{position:relative;width:86px;height:120px;flex:none;border-radius:7%;box-shadow:0 6px 18px #000b}
.kj-kaart.kj-geraakt{animation:kjRaak .45s}
@keyframes kjRaak{0%,100%{transform:none;filter:none}20%{transform:translateX(-7px) rotate(-3deg);filter:brightness(1.6) sepia(1) hue-rotate(-50deg) saturate(4)}45%{transform:translateX(6px) rotate(2deg)}70%{transform:translateX(-3px)}}
.kj-stats{display:flex;flex-direction:column;gap:5px;min-width:126px;text-shadow:0 1px 3px #000}
.kj-naam{font-weight:800;font-size:15px;font-family:Georgia,'Times New Roman',serif}
.kj-balk{position:relative;height:17px;border-radius:9px;background:#000a;border:1px solid #ffffff55;overflow:hidden}
.kj-vul{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#991b1b,#ef4444);transition:width .55s cubic-bezier(.3,.7,.3,1)}
.kj-balk span{position:absolute;inset:0;text-align:center;font-size:11px;font-weight:800;line-height:16px}
.kj-regel{font-size:13px;font-weight:700;display:flex;gap:10px}
.kj-immuun{font-size:12px;opacity:.9}
.kj-raakgetal{position:fixed;z-index:50;font-weight:900;font-size:34px;color:#fecaca;text-shadow:0 0 10px #ef4444,0 2px 0 #450a0a;pointer-events:none;white-space:nowrap}
.kj-flits{position:absolute;inset:0;z-index:40;pointer-events:none;background:radial-gradient(ellipse at 50% 20%,#ef444466,#0000 70%)}
.kj .kt-kaart.kt-mag{box-shadow:0 2px 8px #0007}
.kj .kt-kaart.kt-gekozen{box-shadow:0 0 0 3px #fde68a,0 0 26px #f5b301,0 8px 20px #000a}
.kj .kt-vlieg .kt-v{box-shadow:0 0 18px #f5b301b0,0 6px 18px #000a}
.kj-fx{position:absolute;inset:0;pointer-events:none;z-index:45;overflow:hidden}
.kj-fx>*{position:absolute;pointer-events:none}
.kj-licht{border-radius:50%;mix-blend-mode:screen}
.kj-vonk{width:7px;height:7px;border-radius:50%;mix-blend-mode:screen}
.kj-haal{overflow:visible}
.kj-gloeit{filter:brightness(1.35) drop-shadow(0 0 10px var(--kj-gloed,#f5b301)) drop-shadow(0 0 22px var(--kj-gloed,#f5b301))}
.kj-koepel{border-radius:50% 50% 12px 12px/80% 80% 12px 12px;border:3px solid #93c5fd;background:radial-gradient(ellipse at 50% 100%,#60a5fa55,#3b82f611 60%,#0000 75%);box-shadow:0 0 30px #60a5fa,inset 0 0 30px #93c5fd88}
.kj-zwevend{font-size:22px;text-shadow:0 0 10px currentColor}
.kj-muziek{display:flex;align-items:center;gap:8px}
.kj-muziek[aria-pressed=true]{background:#8b3fd1;border-color:#c084fc;box-shadow:0 0 14px #8b3fd1aa}
.kj-kaarslicht{position:absolute;inset:0;pointer-events:none;z-index:30;transition:opacity .5s}
.kj-kaarslicht .kj-donker{position:absolute;inset:0;background:radial-gradient(ellipse 85% 70% at 50% 52%,#0000 25%,#0a0400a6 70%,#050200e0 100%)}
.kj-kaarslicht .kj-warm{position:absolute;inset:0;mix-blend-mode:soft-light;opacity:var(--kj-licht,.9);background:radial-gradient(circle at 12% 46%,#ffb347 0,#ff8c1a55 18%,#0000 42%),radial-gradient(circle at 88% 46%,#ffb347 0,#ff8c1a55 18%,#0000 42%)}
.kj-kaarslicht .kj-gloed{position:absolute;inset:0;mix-blend-mode:screen;opacity:calc(var(--kj-licht,.9) * .55);background:radial-gradient(circle at 12% 46%,#ffcf7a66 0,#ff9a2e22 14%,#0000 30%),radial-gradient(circle at 88% 46%,#ffcf7a66 0,#ff9a2e22 14%,#0000 30%)}
.kj-kaars{position:absolute;bottom:18%;width:30px;height:96px;pointer-events:none;z-index:31}
.kj-kaars.kj-links{left:calc(12% - 15px)}.kj-kaars.kj-rechts{left:calc(88% - 15px)}
.kj-kaars svg{position:absolute;left:0;bottom:0;width:30px;height:70px}
.kj-vlam{position:absolute;left:50%;bottom:62px;width:14px;height:26px;margin-left:-7px;transform-origin:50% 100%;border-radius:50% 50% 45% 45%/65% 65% 35% 35%;
  background:radial-gradient(ellipse at 50% 72%,#fff 0,#fff6c2 22%,#ffc94a 48%,#ff7a18 75%,#ff7a1800 100%);box-shadow:0 0 18px 6px #ffb34788,0 0 44px 16px #ff8c1a44;animation:kjVlam 1.6s ease-in-out infinite alternate}
.kj-rechts .kj-vlam{animation-duration:1.3s;animation-delay:-.6s}
@keyframes kjVlam{0%{transform:scale(1,1) skewX(0)}20%{transform:scale(.94,1.08) skewX(3deg)}45%{transform:scale(1.04,.95) skewX(-2deg)}70%{transform:scale(.97,1.1) skewX(2deg)}100%{transform:scale(1.02,.97) skewX(-3deg)}}
.kj-geenflikkering .kj-vlam{animation:none}
.kj-kaars .kj-kandelaar{display:none}
.kj .kj-kaars{width:clamp(52px,15vw,92px);height:auto;aspect-ratio:1086/1448;bottom:10%;transform:translate3d(var(--kj-scene-x, 0px),var(--kj-scene-y, 0px),0);filter:drop-shadow(0 9px 6px #000b)}
.kj .kj-kaars.kj-links{left:clamp(0px,2%,18px)}.kj .kj-kaars.kj-rechts{left:auto;right:clamp(0px,2%,18px)}
.kj .kj-kaars svg{display:none}.kj .kj-kaars .kj-kandelaar{display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.kj .kj-vlam{left:48%;bottom:95.5%;width:15%;height:24%;margin-left:-7.5%}
.kj.kj-geenkaars .kj-kaarslicht,.kj.kj-geenkaars .kj-kaars{display:none}
.kt-tafel.kj .kt-info{flex-wrap:wrap;justify-content:center;width:96%;white-space:normal;row-gap:4px}
.kt-tafel.kj .kt-onder,.kt-tafel.kj .kt-status,.kt-tafel.kj .kt-info,.kt-tafel.kj .kj-stats{position:relative;z-index:32}.kt-tafel.kj .kt-info{position:absolute}
@media (prefers-reduced-motion:reduce){.kj-vlam{animation:none}}
.kj-pil{padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #f5d08a88;font-weight:800;font-size:13px}
.kj-instellingen{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:18px;background:#100a0cd9;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.kj-instellingen-kaart{width:min(100%,400px);max-height:min(86dvh,650px);overflow:auto;padding:22px;border:1px solid #e2bb7677;border-radius:20px;background:linear-gradient(145deg,#382519,#1f1512);color:#fff8e8;box-shadow:inset 0 1px #fff3,0 18px 60px #000b;text-align:left;font:15px/1.45 system-ui,sans-serif}
.kj-instellingen-kop{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.kj-instellingen-kop h2{margin:0;font:700 22px Georgia,serif;color:#f7dda6}
.kj-instellingen-sluit{min-width:44px;min-height:44px;border-radius:12px;border:1px solid #fff4;background:#ffffff14;color:inherit;font:24px/1 sans-serif;cursor:pointer}
.kj-instellingen-optie{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid #ffffff20;cursor:pointer}.kj-instellingen-optie span{flex:1}.kj-instellingen-optie small{display:block;color:#d6c4aa;font-size:12px;margin-top:3px}.kj-instellingen-optie input{width:23px;height:23px;accent-color:#d69a43;flex:none}
.kj-instellingen-info{font-size:12px;color:#dccaaa;margin-top:10px;min-height:1.4em}
.kj-bier-inhoud{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 0 14px}.kj-bier-inhoud label{flex:1 1 100%;font-weight:700}.kj-bier-inhoud input{flex:1;min-width:120px;accent-color:#d69a43}.kj-bier-inhoud output{min-width:3.5em;text-align:right;font-variant-numeric:tabular-nums}.kj-bier-vol{min-height:40px;padding:8px 12px;border:1px solid #e6c68c88;border-radius:10px;background:#593717;color:#fff5dd;font:inherit;cursor:pointer}
.kj-start-instellingen{position:absolute;right:12px;top:12px;z-index:35;min-width:44px;min-height:44px;border:1px solid #e6c68c88;border-radius:12px;background:#25150cdd;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 3px 12px #0009}
.kj-start{position:relative;isolation:isolate;justify-content:safe center}
.kj-instellingen,.kj-instellingen *{box-sizing:border-box}.kj-scene-keuze{border:0;padding:0;margin:0 0 12px;min-width:0}.kj-scene-keuze legend{font-weight:700;margin-bottom:10px}.kj-scene-opties{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.kj-scene-opties label{display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;padding:7px 4px;border:1px solid #e6c68c55;border-radius:10px;background:#100d0d66;font-size:12px;cursor:pointer}.kj-scene-opties label:has(input:checked){background:linear-gradient(145deg,#8f652b,#4c3217);border-color:#ffe8a6;box-shadow:inset 0 1px #fff5,0 3px 8px #0006}.kj-scene-opties input{accent-color:#e5bb65;margin:0}
.kj-modern .kt-knop{background:linear-gradient(155deg,#142334,#090f19);border-color:#d6b66c;color:#fff4d3;box-shadow:inset 0 1px #fff2,0 3px 8px #0008}.kj-modern .kj-kaart{box-shadow:0 8px 22px #000b,0 0 0 1px #e2be6777}.kj-modern .kj-titel,.kj-modern .kj-naam{color:#f5d990}.kj-instellingen.kj-modern .kj-instellingen-kaart{background:linear-gradient(145deg,#172536,#09111c);border-color:#dfc37b99}
.kj-modern .kj-kaars.kj-links{width:clamp(62px,15vw,100px);aspect-ratio:2/3}.kj-modern .kj-kaars.kj-rechts{width:clamp(80px,18vw,118px);aspect-ratio:2/3}.kj-modern .kj-links .kj-vlam{left:49.7%;bottom:81%;height:11%;width:10%;margin-left:-5%}.kj-modern .kj-rechts .kj-vlam{left:49.8%;bottom:96%;height:12%;width:9%;margin-left:-4.5%}
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

export function start({ spelKanaal = null, benIkSpeler1 = true, vriendNaam = '' } = {}) {
  zetCss(); zetStijl()
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '👑 ' + T('Koningsjacht')
  let staat = null, tafel = null, selectie = [], bezig = 0, rij = Promise.resolve()
  const INSTELLINGEN = 'fibro_koningsjacht_instellingen'
  const bewaardeInstellingen = lees(INSTELLINGEN, {}) || {}
  const instellingen = {
    scene: ['standaard', 'modern', 'middeleeuws'].includes(bewaardeInstellingen.scene) ? bewaardeInstellingen.scene : (bewaardeInstellingen.middeleeuws === true ? 'middeleeuws' : 'standaard'),
    beweging: bewaardeInstellingen.beweging === true,
    middeleeuws: bewaardeInstellingen.middeleeuws === true,
    flikkeren: bewaardeInstellingen.flikkeren !== false,
    bierpul: bewaardeInstellingen.bierpul === true,
    bierInhoud: Number.isInteger(bewaardeInstellingen.bierInhoud) && bewaardeInstellingen.bierInhoud >= 0 && bewaardeInstellingen.bierInhoud <= 100 ? bewaardeInstellingen.bierInhoud : 100,
    bierOorRechts: bewaardeInstellingen.bierOorRechts !== false,
    bierRonde: Number.isSafeInteger(bewaardeInstellingen.bierRonde) && bewaardeInstellingen.bierRonde >= 0 ? bewaardeInstellingen.bierRonde : 0
  }
  instellingen.middeleeuws = instellingen.scene === 'middeleeuws'
  let STIJL = instellingen.scene === 'modern' ? 'modern' : 'perkament'
  let scene = null, flikkerTimer = null, anderBier = null, bierTimer = null

  const sceneOpties = () => ({ ...instellingen, anderBier, eigenNaam: T('Jij'), bierLabel: T('Inhoud van je bierpul'), onBierInhoud: wijzigBierInhoud, onBierNieuw: nieuweBierpul })
  zetMuziekThema(instellingen.middeleeuws ? 'middeleeuws' : 'standaard')

  function wijzigBierInhoud(niveau, afgerond = false) {
    if (!Number.isFinite(niveau)) return
    instellingen.bierInhoud = Math.round(Math.max(0, Math.min(100, niveau)))
    scene?.update(sceneOpties())
    const slider = document.getElementById('kj-bier-inhoud')
    if (slider) slider.value = String(instellingen.bierInhoud)
    schrijf(INSTELLINGEN, instellingen)
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
    clearTimeout(bierTimer); bierTimer = null; stuurBier()
  }

  function stopScene() {
    clearInterval(flikkerTimer); flikkerTimer = null
    scene?.stop(); scene = null
  }

  function pasInstellingenToe() {
    const actief = tafel?.element?.isConnected ? tafel.element : inhoud.querySelector('.kj-start')
    instellingen.middeleeuws = instellingen.scene === 'middeleeuws'
    actief?.classList.toggle('kj-sfeer', instellingen.middeleeuws)
    actief?.classList.toggle('kj-modern', instellingen.scene === 'modern')
    document.querySelector('.kj-instellingen')?.classList.toggle('kj-modern', instellingen.scene === 'modern')
    actief?.classList.toggle('kj-geenflikkering', !instellingen.flikkeren)
    scene?.update(sceneOpties())
    zetMuziekThema(instellingen.middeleeuws ? 'middeleeuws' : 'standaard')
    const nieuweStijl = instellingen.scene === 'modern' ? 'modern' : 'perkament'
    if (nieuweStijl !== STIJL) {
      STIJL = nieuweStijl
      for (const [i, kaart] of [...inhoud.querySelectorAll('.kj-kaarten>div')].entries()) kaart.innerHTML = kaartSvg(['kB', 'hH', 'sV'][i], STIJL)
      if (tafel?.element?.isConnected) {
        tafel.zetKaartStijl(STIJL)
        for (const kaart of tafel.element.querySelectorAll('.kj-kasteel>div')) kaart.innerHTML = achterkantSvg(STIJL)
        if (staat) tekenVijand(staat)
      }
    }
    verversKandelaars()
    verversKaarslicht()
    schrijf(INSTELLINGEN, instellingen)
  }

  function plaatsScene(element) {
    stopScene()
    if (!element) return
    element.classList.toggle('kj-sfeer', instellingen.middeleeuws)
    element.classList.toggle('kj-modern', instellingen.scene === 'modern')
    element.classList.toggle('kj-geenflikkering', !instellingen.flikkeren)
    scene = maakKoningsjachtScene(element, sceneOpties())
  }

  function toonInstellingen() {
    if (document.querySelector('.kj-instellingen')) return
    const vorigeFocus = document.activeElement
    const scherm = document.createElement('div')
    scherm.className = 'kj-instellingen' + (instellingen.scene === 'modern' ? ' kj-modern' : '')
    scherm.innerHTML = '<section class="kj-instellingen-kaart" role="dialog" aria-modal="true" aria-labelledby="kj-instellingen-titel">'
      + '<div class="kj-instellingen-kop"><h2 id="kj-instellingen-titel">' + esc(T('Instellingen')) + '</h2>'
      + '<button type="button" class="kj-instellingen-sluit" aria-label="' + esc(T('Sluiten')) + '">×</button></div>'
      + '<fieldset class="kj-scene-keuze"><legend>' + esc(T('Tafelsfeer')) + '</legend><div class="kj-scene-opties">'
      + [['standaard', T('Standaard')], ['modern', T('Modern')], ['middeleeuws', T('Middeleeuws')]].map(([id, label]) => '<label><input type="radio" name="kj-scene" data-scene="' + id + '" value="' + id + '"' + (instellingen.scene === id ? ' checked' : '') + '><span>' + esc(label) + '</span></label>').join('')
      + '</div></fieldset>'
      + '<label class="kj-instellingen-optie"><span><b>' + esc(T('Achtergrond bewegen')) + '</b><small>' + esc(T('Beweeg je telefoon voor een subtiel diepte-effect.')) + '</small></span><input type="checkbox" data-instelling="beweging"></label>'
      + '<label class="kj-instellingen-optie"><span><b>' + esc(T('Kaarsen laten flikkeren')) + '</b><small>' + esc(T('Laat de vlam en het kaarslicht zacht bewegen.')) + '</small></span><input type="checkbox" data-instelling="flikkeren"></label>'
      + '<label class="kj-instellingen-optie"><span><b>' + esc(T('Bierpul tonen')) + '</b><small>' + esc(T('Zet een bierpul op de tafel.')) + '</small></span><input type="checkbox" data-instelling="bierpul"></label>'
      + '<div class="kj-bier-inhoud"><label for="kj-bier-inhoud">' + esc(T('Inhoud van je bierpul')) + '</label><input id="kj-bier-inhoud" type="range" min="0" max="100" step="1"><button type="button" class="kj-bier-vol">' + esc(T('Nieuwe volle pul')) + '</button></div>'
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
    scherm.addEventListener('click', e => { if (e.target === scherm) sluit() })
    for (const input of scherm.querySelectorAll('[data-scene]')) input.addEventListener('change', () => {
      if (!input.checked) return
      instellingen.scene = input.value
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
    plaatsScene(el)
    const knop = document.createElement('button')
    knop.type = 'button'; knop.className = 'kj-start-instellingen'
    knop.setAttribute('aria-label', T('Instellingen')); knop.title = T('Instellingen'); knop.textContent = '⚙'
    knop.onclick = toonInstellingen
    el.appendChild(knop)
  }
  // ── Met z'n tweeën (v5) ──
  const kanaal = spelKanaal, samenSpel = Boolean(kanaal)
  const ik = benIkSpeler1 ? 1 : 2, hij = ik === 1 ? 2 : 1
  const naam = vriendNaam || T('vriend')
  let modus = 'solo', spelId = -1, nr = 0, opzet = null, tegen = null, afgelopen = false, beleg = null
  const vloeken = new Set()
  const stuur = (event, payload) => { try { kanaal && kanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }
  const bierVerbinding = verbindBierpul(kanaal, {
    speler: ik, actief: () => inhoud.isConnected,
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
  // Met z'n tweeën: speler 1 kiest hoe jullie spelen en het niveau
  const MODI = [['samen', '🤝', 'Samen tegen het kasteel', 'Eén team, om de beurt. Samen winnen of samen verliezen.'],
    ['wedstrijd', '🏁', 'Wedstrijd', 'Ieder een eigen kasteel, precies hetzelfde geschud. Wie het verst komt, wint.'],
    ['duel', '⚔️', 'Duel', 'Als de wedstrijd, maar precies raak stuurt een vloek: de vijand van de ander krijgt 10 leven erbij.'],
    ['beleg', '🏰', 'Belegering', 'Ieder een eigen kasteel. Om de beurt val je de wachters van de ander aan en weer je hun klap af. Wie het eerst het kasteel van de ander verovert, wint.']]
  function kiesSamenScherm() {
    tafel = null; staat = null; afgelopen = false
    let gekozen = 'samen'
    const knop = ([id, ico, t, u]) => '<button type="button" class="kj-niveau" data-modus="' + id + '"><span class="kj-ico">' + ico + '</span><span><b>' + esc(T(t)) + '</b><small>' + esc(T(u)) + '</small></span></button>'
    inhoud.innerHTML = '<div class="kj-start">'
      + '<div class="kj-titel">' + esc(T('Koningsjacht')) + '</div>'
      + '<div class="kj-uitleg">' + esc(T('Hoe spelen jullie?')) + '</div>'
      + '<div class="kj-niveaus kj-modi">' + MODI.map(knop).join('') + '</div>'
      + '<div class="kj-uitleg">' + esc(T('Kies het niveau')) + '</div>'
      + '<div class="kj-niveaus kj-niveaukeus"><button type="button" class="kj-niveau" data-niveau="schildknaap"><span class="kj-ico">🛡️</span><span><b>' + esc(T('Schildknaap')) + '</b></span></button>'
      + '<button type="button" class="kj-niveau" data-niveau="ridder"><span class="kj-ico">⚔️</span><span><b>' + esc(T('Ridder')) + '</b></span></button>'
      + '<button type="button" class="kj-niveau" data-niveau="koning"><span class="kj-ico">👑</span><span><b>' + esc(T('Koning')) + '</b></span></button></div>'
      + '<button type="button" class="kj-knop kj-zacht kj-regelknop">📜 ' + esc(T('Hoe speel je?')) + '</button>'
      + '<div class="kj-bron">' + esc(T('Gebaseerd op het kaartspel Regicide van Badgers From Mars.')) + '</div></div>'
    startInstellingen()
    const zet = () => { for (const b of inhoud.querySelectorAll('.kj-modi .kj-niveau')) b.setAttribute('aria-pressed', String(b.dataset.modus === gekozen)) }
    for (const b of inhoud.querySelectorAll('.kj-modi .kj-niveau')) b.onclick = () => { gekozen = b.dataset.modus; zet() }
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
    const id = Math.max(Date.now(), spelId + 1)
    if (m === 'beleg') {
      const b = K.nieuwBeleg({ niveau, begint: 1 })
      opzet = { modus: m, niveau, spelId: id }
      stuur('opnieuw', { modus: m, niveau, spelId: id, nr: 0, beleg: b })
      openSpel({ modus: m, niveau, spelId: id, beleg: b, nr: 0 })
    } else if (m === 'samen') {
      const st = K.nieuwSpel({ niveau, samen: true, begint: 1 })
      opzet = { modus: m, niveau, spelId: id }
      stuur('opnieuw', { modus: m, niveau, spelId: id, nr: 0, staat: st })
      openSpel({ modus: m, niveau, spelId: id, staat: st, nr: 0 })
    } else {
      const zaad = Math.floor(Math.random() * 2e9) + 1
      opzet = { modus: m, niveau, spelId: id, zaad }
      stuur('opnieuw', opzet)
      openSpel(opzet)
    }
  }
  // Een spel openen (bij jezelf of na een bericht van de ander)
  function openSpel(o) {
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
      tafel?.sluitEinde?.(); openSpel(p)
    })
    const zet = msg => {
      const p = msg.payload || {}
      if (p.beleg) {   // belegering: de hele stand van allebei
        if (!K.geldigBeleg(p.beleg)) return
        if (p.spelId > spelId) { openSpel({ modus: 'beleg', niveau: p.beleg.niveau, spelId: p.spelId, beleg: p.beleg, nr: p.nr }); return }
        if (modus !== 'beleg' || !nieuwer(p.spelId, p.nr)) return
        const oudB = beleg; nr = p.nr; beleg = p.beleg; staat = beleg.spelers[ik]
        inRij(() => verwerkBeleg(oudB, beleg))
        return
      }
      if (p.modus && p.modus !== 'samen') { if (p.spelId > spelId && K.NIVEAUS[p.niveau]) openSpel(p); return }
      if (!p.staat || !K.geldigeStand(p.staat) || !p.staat.handen) return
      if (p.spelId > spelId) { openSpel({ modus: 'samen', niveau: p.staat.niveau, spelId: p.spelId, staat: p.staat, nr: p.nr }); return }
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
  const bewaker = setInterval(() => { if (!inhoud.isConnected) { clearInterval(bewaker); stopMuziek() } }, 1000)
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMuziek(); else if (muziekStaatAan() && inhoud.isConnected) startMuziek() })
  // ── Kaarslicht ──
  const KAARS = 'fibro_koningsjacht_kaars'
  const kaarsAan = () => { try { return localStorage.getItem(KAARS) !== 'uit' } catch (e) { return true } }
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
    for (const kaars of el.querySelectorAll('.kj-kaars')) {
      const bestand = instellingen.scene === 'modern' ? (kaars.classList.contains('kj-links') ? 'candle-modern-left.png' : 'candle-modern-right.png') : 'chamberstick.png'
      const afbeelding = kaars.querySelector('.kj-kandelaar')
      const url = new URL('./assets/koningsjacht/' + bestand, import.meta.url).href
      if (afbeelding.src !== url) afbeelding.src = url
    }
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
    staat = s; selectie = []
    if (muziekStaatAan()) startMuziek()
    bewaar()
    tafel = maakKaartTafel(inhoud, {
      solo: !samenSpel, naamAnder: samenSpel ? naam : '', stijl: STIJL, onReactie: emoji => stuur('kaartreactie', { emoji }), ondergrond: 'hout', stapelTekst: n => T('Taveerne: {n}', { n }),
      groep: () => 'alles',                              // je mag elke kaart erbij kiezen; magSpelen beslist
      magSpelen: ids => !afgelopen && aanMij(staat) && (staat.fase === 'aanval' ? K.magAanvallen(staat, ids) : K.magAfweren(staat, ids)),
      onSpeel: (ids, opts) => staat.fase === 'aanval' ? valAan(ids, opts) : weerAf(ids, opts),
      onPak: () => tafel.status(T('De taveerne: met ♦ ruiten pak je hier kaarten')),
      onSelectie: ids => { selectie = ids; if (!bezig) { tekenKnoppen(); tafel.status(statusTekst()) } },
    })
    tafel.element.classList.add('kj')
    plaatsScene(tafel.element)
    zetKaarslicht()
    const ander = tafel.element.querySelector('.kt-ander')
    const paneel = document.createElement('div'); paneel.className = 'kj-vijand'
    paneel.innerHTML = '<div class="kj-kasteel" aria-hidden="true"><div>' + achterkantSvg(STIJL) + '</div><div>' + achterkantSvg(STIJL) + '</div><div>'
      + achterkantSvg(STIJL) + '</div><span></span></div><div class="kj-kaart"></div><div class="kj-stats"><div class="kj-naam"></div>'
      + '<div class="kj-balk"><div class="kj-vul"></div><span></span></div><div class="kj-regel"></div><div class="kj-immuun"></div></div>'
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

  function bewaar() { if (!samenSpel) schrijf(BEWAAR, staat && !staat.klaar ? staat : null) }   // met z'n tweeën niet bewaren
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
    tafel.knoppen(lijst)
    const instellingenKnop = tafel.element.querySelector('[data-naam="instellingen"]')
    if (instellingenKnop) { instellingenKnop.setAttribute('aria-label', T('Instellingen')); instellingenKnop.title = T('Instellingen') }
  }
  function tekenInfo(s) {
    const pil = t => '<span class="kj-pil">' + t + '</span>'
    let extra = ''
    if (modus === 'beleg' && beleg) {
      const f = beleg.spelers[hij], v = K.vijandInfo(f)
      extra = pil((beleg.aanZet === hij ? '▶ ' : '') + '⚔️ ' + esc(naam)) + pil('🏰 ' + esc(T('Jouw kasteel')) + ': ' + (12 - f.verslagen) + (v ? ' · ❤ ' + v.over : ''))
    } else if (modus === 'samen') extra = pil((s.aanZet === hij ? '▶ ' : '') + '🤝 ' + esc(naam) + ': ' + K.hand(s, hij).length)
    else if (samenSpel) extra = pil((modus === 'duel' ? '⚔️ ' : '🏁 ') + esc(naam) + ': ' + (tegen ? tegen.verslagen : 0) + '/12' + (tegen && tegen.klaar && !tegen.gewonnen ? ' 💀' : ''))
    tafel.info(pil('👑 ' + s.verslagen + '/12') + pil('🃏 ' + s.narren) + (samenSpel ? '' : pil('🗑️ ' + s.afleg.length)) + extra)
  }
  // Het paneel bovenin: kasteel, de vijand, zijn leven, aanval, schild en waar hij niet tegen kan
  function tekenVijand(s, { kaart = true } = {}) {
    const p = tafel?.element.querySelector('.kj-vijand')
    if (!p) return
    const v = K.vijandInfo(s)
    p.querySelector('.kj-kasteel > span').textContent = modus === 'beleg' ? T('{naam}: {n}', { naam, n: Math.max(0, s.kasteel.length - 1) }) : T('Kasteel: {n}', { n: Math.max(0, s.kasteel.length - 1) })
    p.querySelector('.kj-kasteel').style.visibility = s.kasteel.length > 1 ? '' : 'hidden'
    const kaartEl = p.querySelector('.kj-kaart')
    if (!v) { kaartEl.innerHTML = ''; for (const c of ['.kj-naam', '.kj-regel', '.kj-immuun', '.kj-balk span']) p.querySelector(c).textContent = ''; p.querySelector('.kj-vul').style.width = '0%'; return }
    if (kaart && (kaartEl.dataset.id !== v.id || kaartEl.dataset.stijl !== STIJL)) { kaartEl.innerHTML = kaartSvg(v.id, STIJL); kaartEl.dataset.id = v.id; kaartEl.dataset.stijl = STIJL }
    p.querySelector('.kj-naam').textContent = vijandNaam(v.id)
    p.querySelector('.kj-vul').style.width = (100 * v.over / v.leven) + '%'
    p.querySelector('.kj-balk span').textContent = '❤ ' + v.over + ' / ' + v.leven
    p.querySelector('.kj-regel').innerHTML = '<span>⚔️ ' + v.slag + (s.schild ? ' <s style="opacity:.6">' + v.aanval + '</s>' : '') + '</span>' + (s.schild ? '<span>🛡️ ' + s.schild + '</span>' : '')
    const im = p.querySelector('.kj-immuun')
    im.innerHTML = esc(T('Immuun voor')) + ' <b style="color:' + KLEURKLEUR[v.kleur] + '">' + KLEUR_TEKEN[v.kleur] + '</b>'
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
  const anim = (el, frames, opts) => { try { return el.animate(frames, opts).finished.catch(() => {}) } catch (e) { return Promise.resolve() } }
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
  function zwaardhaal(p, kleur, richting = 1, vertraging = 0) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'kj-haal')
    const w = p.b * 1.9, h = p.h * 1.5
    svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none')
    svg.style.cssText = 'left:' + (p.x - w / 2) + 'px;top:' + (p.y - h / 2) + 'px;filter:drop-shadow(0 0 6px ' + kleur + ') drop-shadow(0 0 14px ' + kleur + ')'
    const pad = richting > 0 ? 'M8 12 Q50 46 92 88' : 'M92 12 Q50 46 8 88'
    svg.innerHTML = '<path d="' + pad + '" fill="none" stroke="' + kleur + '" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>'
      + '<path d="' + pad + '" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>'
    fxLaag().appendChild(svg)
    const lijnen = [...svg.querySelectorAll('path')]
    return Promise.all(lijnen.map(l => anim(l, [{ strokeDashoffset: 100 }, { strokeDashoffset: 0, offset: 0.35 }, { strokeDashoffset: 0 }], { duration: 520, delay: vertraging, easing: 'ease-out', fill: 'forwards' })))
      .then(() => anim(svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 })).then(() => svg.remove())
  }
  function tril(sterk = 6) {
    if (rustig()) return
    anim(tafel.element, [{ transform: 'none' }, { transform: 'translate(' + sterk + 'px,-' + sterk / 2 + 'px)' }, { transform: 'translate(-' + sterk + 'px,' + sterk / 2 + 'px)' },
      { transform: 'translate(' + sterk / 2 + 'px,0)' }, { transform: 'none' }], { duration: 320 })
  }
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
    setTimeout(inslag, (rustig() ? 210 : 380) + (aflegKaarten.length - 1) * 70)
    await geraakt
    if (l.immuun) geluid('immuun'); else if (dubbel) geluid('dubbel'); else geluid('zwaard', l.schade >= 15 ? 2 : 1)
    tafel.tril(dubbel ? [30, 40, 50] : [25, 30, 25]); tril(dubbel ? 9 : 6)
    const halen = [zwaardhaal(doel, hoofdKleur, 1)]
    if (dubbel) halen.push(zwaardhaal(doel, LICHT.k, -1, 260))
    lichtflits(doel.x, doel.y, hoofdKleur, doel.b * 2.4)
    vonken(doel.x, doel.y, l.immuun ? ['#d1d5db', '#9ca3af'] : [...kleuren, '#fde68a', '#fff'], 18, 100)
    if (dubbel) setTimeout(() => { lichtflits(doel.x, doel.y, LICHT.k, doel.b * 3); vonken(doel.x, doel.y, [LICHT.k, '#fff'], 14, 120); tril(10) }, 300)
    await Promise.all([raak(l.schade, dubbel), ...halen])
  }
  async function schildLicht(n) {
    geluid('schild')
    const hand = tafel.element.querySelector('.kt-hand'); if (!hand) return
    const p = plek(hand)
    const d = document.createElement('div'); d.className = 'kj-koepel'
    d.style.cssText = 'left:' + (p.x - p.b * 0.46) + 'px;top:' + (p.y - p.h * 0.62) + 'px;width:' + (p.b * 0.92) + 'px;height:' + (p.h * 1.05) + 'px'
    fxLaag().appendChild(d)
    tafel.effect('♠ ' + T('Schild {n}', { n }), { gloed: false, geluid: false })
    await anim(d, [{ transform: 'scaleY(.1)', opacity: 0 }, { transform: 'scaleY(1.05)', opacity: 1, offset: 0.35 }, { transform: 'scaleY(1)', opacity: 0.9, offset: 0.7 }, { transform: 'scaleY(1)', opacity: 0 }],
      { duration: rustig() ? 500 : 1100, easing: 'ease-out' })
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
    try { await g.animate([{ transform: 'translate(-50%,0) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-30px) scale(1.3)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-60px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).finished } catch (e) {}
    g.remove()
  }
  // de vijand springt naar voren en haalt drie keer uit: rode klauwen over de tafel
  async function slaTerug(s) {
    const k = vijandKaart(), v = K.vijandInfo(s)
    if (!k || !v) return
    geluid('vijandSlaat', v.slag >= 15 ? 1.4 : 1)
    const f = document.createElement('div'); f.className = 'kj-flits'; tafel.element.appendChild(f)
    const t = tafel.element.getBoundingClientRect()
    const midden = { x: t.width / 2, y: t.height * 0.62, b: t.width * 0.55, h: t.height * 0.35 }
    const sprong = anim(k, [{ transform: 'none', filter: 'none' }, { transform: 'translateY(34px) scale(1.18) rotate(-5deg)', filter: 'brightness(1.5) drop-shadow(0 0 18px #ef4444)', offset: 0.4 }, { transform: 'none', filter: 'none' }], { duration: 640, easing: 'ease-in-out' })
    await wacht(rustig() ? 150 : 420)
    tafel.tril([40, 40, 60]); tril(11)
    const klauwen = [-0.18, 0, 0.18].map((d, i) => zwaardhaal({ x: midden.x + d * t.width, y: midden.y, b: midden.b * 0.5, h: midden.h }, '#ef4444', -1, i * 70))
    vonken(midden.x, midden.y, ['#ef4444', '#f97316', '#fff'], 16, 120)
    await Promise.all([sprong, anim(f, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 700 }), ...klauwen])
    f.remove()
    tafel.effect(T('{naam} slaat terug: {n}!', { naam: vijandNaam(v.id), n: v.slag }), { gloed: false, geluid: false })
    await wacht(500)
  }
  async function verslagen(l, oud) {
    const k = vijandKaart()
    geluid('verslagen', l.precies)
    tafel.effect(l.precies ? T('Precies raak!') : T('Verslagen!'), { geluid: false })
    if (k) {
      const p = plek(k)
      lichtflits(p.x, p.y, '#fde68a', p.b * 3.2, 900)
      vonken(p.x, p.y, ['#fde68a', '#f5b301', '#fff', '#a16207'], 26, 150)
      const r = k.getBoundingClientRect()
      const doel = l.precies ? tafel.element.querySelector('.kt-stapel').getBoundingClientRect() : { left: r.left + 40, top: window.innerHeight + 40, width: r.width, height: r.height }
      const dx = doel.left + doel.width / 2 - (r.left + r.width / 2), dy = doel.top + doel.height / 2 - (r.top + r.height / 2)
      if (l.precies) { k.style.setProperty('--kj-gloed', '#fde68a'); k.classList.add('kj-gloeit') }
      await anim(k, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-10px) scale(1.1)', opacity: 1, offset: 0.2 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (l.precies ? 0 : 160) + 'deg) scale(' + (l.precies ? 0.85 : 0.6) + ')', opacity: l.precies ? 1 : 0 }], { duration: rustig() ? 400 : 800, easing: 'cubic-bezier(.5,0,.7,1)' })
      k.classList.remove('kj-gloeit')
      k.innerHTML = ''; k.dataset.id = ''
      if (l.precies) { const st = plek(tafel.element.querySelector('.kt-stapel')); lichtflits(st.x, st.y, '#fde68a', 150) }
    }
    if (l.precies) { tafel.toon(beeld(oud, { hand: tafelHand, afleg: [], stapelAantal: oud.taveerne.length + 1, mijnBeurt: false, status: T('{naam} ligt nu bovenop de taveerne', { naam: vijandNaam(l.vijand) }) })); await wacht(700) }
  }
  let tafelHand = []

  // ── Een aanval laten zien (van jou, of in 'samen' van de ander: dan komen de kaarten van boven) ──
  const vanBoven = n => { const t = tafel.element.getBoundingClientRect(); return Array.from({ length: n }, (_, i) => ({ left: t.left + t.width / 2 - 30 + i * 12, top: t.top - 90, width: 60, height: 84 })) }
  async function toonAanval(oud, nieuw, ids, { eigen = true, vanRects = null, opts = {} } = {}) {
    const l = nieuw.laatste
    const handNa = eigen ? mijnHand(oud).filter(id => !ids.includes(id)) : mijnHand(oud)
    tafelHand = handNa
    tafel.toon(beeld(oud, { hand: handNa, afleg: [...oud.tafel, ...ids], mijnBeurt: false, status: eigen ? '' : T('{naam} valt aan!', { naam }) }))
    await tafel.speelAnimatie(ids, { snelheid: opts.snelheid || 1, richting: opts.richting || { x: 0, y: eigen ? -1 : 1 }, vanRects: vanRects || vanBoven(ids.length) })
    if (l.genezen) { tafel.toon(beeld(oud, { hand: handNa, afleg: [...oud.tafel, ...ids], stapelAantal: oud.taveerne.length + l.genezen, mijnBeurt: false, status: '' })); await genezenLicht(l.genezen) }
    const tussen = { kasteel: oud.kasteel, schade: Math.min(K.vijandInfo(oud).leven, oud.schade + l.schade), schild: oud.schild + l.schild, extra: oud.extra }
    await Promise.all([kaartenVallenAan(ids, l), wacht(rustig() ? 260 : 480).then(() => tekenVijand(tussen))])
    if (l.immuun) { tafel.effect(T('{naam} is immuun voor {k}', { naam: vijandNaam(l.vijand), k: KLEUR_TEKEN[l.immuun] }), { gloed: false, geluid: false }); await wacht(650) }
    if (l.schild) await schildLicht(tussen.schild)
    const mijnGepakt = l.gepaktPer ? (l.gepaktPer[ik] || []) : (eigen ? l.gepakt : [])
    if (l.gepakt.length || mijnGepakt.length) {
      pakLicht()
      if (mijnGepakt.length) {
        tafelHand = [...handNa, ...mijnGepakt]
        const alle = l.gepaktPer ? l.gepaktPer[1].length + l.gepaktPer[2].length : l.gepakt.length
        tafel.toon(beeld(oud, { hand: tafelHand, afleg: [...oud.tafel, ...ids], stapelAantal: oud.taveerne.length + l.genezen - alle, mijnBeurt: false, status: '' }))
        await tafel.pakAnimatie(mijnGepakt)
      }
    }
    if (l.verslagen) {
      await verslagen(l, oud)
      tafel.toon(beeld(nieuw, { mijnBeurt: false }))
      if (!nieuw.klaar) await nieuweVijand(nieuw)
    } else if (nieuw.fase === 'verdedig') {
      tafel.toon(beeld(nieuw, { mijnBeurt: false }))
      await slaTerug(nieuw)
    } else if (l.geenSlag) { geluid('afweren'); tafel.effect(T('Je schild houdt hem tegen!'), { gloed: false, geluid: false }); await wacht(500) }
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
      if (nieuw.fase === 'verdedig') await slaTerug(nieuw)
      else if (nieuw.laatste.geenSlag) { geluid('afweren'); tafel.effect(T('Je schild houdt hem tegen!'), { gloed: false, geluid: false }); await wacht(500) }
      naZet()
    })
  }
  async function toonAfweer(oud, nieuw, ids, { eigen = true, vanRects = null, opts = {} } = {}) {
    tafel.toon(beeld(oud, { hand: eigen ? mijnHand(oud).filter(id => !ids.includes(id)) : mijnHand(oud), afleg: [...oud.tafel, ...ids], mijnBeurt: false, status: eigen ? '' : T('{naam} weert af', { naam }) }))
    await tafel.speelAnimatie(ids, { snelheid: opts.snelheid || 0.6, richting: opts.richting || { x: 0, y: eigen ? -1 : 1 }, vanRects: vanRects || vanBoven(ids.length) })
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
      if (nieuw.fase === 'verdedig') await slaTerug(nieuw)
      else if (l.geenSlag) { geluid('afweren'); tafel.effect(T('Je schild houdt hem tegen!'), { gloed: false, geluid: false }); await wacht(500) }
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
        else { geluid('zwaard', l.schade >= 15 ? 2 : 1); tafel.tril([25, 30, 25]); tafel.effect('⚔️ ' + T('{naam} valt jouw {wachter} aan: −{n}', { naam, wachter, n: l.schade }), { gloed: false, geluid: false }) }
        await wacht(rustig() ? 400 : 1100)
      } else if (l.soort === 'afweer') { geluid('afweren'); tafel.effect('🛡️ ' + T('{naam} weert af!', { naam }), { gloed: false, geluid: false }); await wacht(600) }
      else if (l.soort === 'pas') { geluid('passen'); tafel.effect(T('{naam} past', { naam }), { gloed: false, geluid: false }); await wacht(500) }
      else if (l.soort === 'nar') { geluid('nar'); tafel.effect('🃏 ' + T('{naam}: nar!', { naam }), { geluid: false }); await wacht(600) }
    }
    teken()
    if (b.klaar) return belegEinde()
    if (b.aanZet === ik && (!oudB || oudB.aanZet !== ik)) { tafel.geluid.beurt?.(); tafel.tril(15); tafel.effect(T('Jouw beurt!'), { gloed: false, geluid: false }) }
  }
  function belegEinde() {
    if (afgelopen || !beleg) return
    afgelopen = true
    const winst = beleg.winnaar === ik
    tafel.knoppen([]); tafel.toon(beeld(staat, { mijnBeurt: false, status: '' }))
    geluid(winst ? 'win' : 'verlies')
    tafel.einde({
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
    tafel.einde({
      gewonnen: uitslag === 'winst',
      titel: uitslag === 'winst' ? '👑 ' + T('Jij wint!') : uitslag === 'verlies' ? '😢 ' + T('{naam} wint!', { naam }) : '🤝 ' + T('Gelijkspel!'),
      sub: T('Jij {a} · {naam} {b}', { a: mij.verslagen + '/12', b: hem.verslagen + '/12', naam }),
      opnieuw: () => startScherm(),
    })
  }

  function naZet(oud) {
    teken()
    if (modus === 'samen' && !staat.klaar && staat.aanZet === ik && oud && oud.aanZet !== ik) { tafel.geluid.beurt?.(); tafel.tril(15) }
    if (modus === 'wedstrijd' || modus === 'duel') { stuurVoortgang(); controleerUitslag(); return }
    if (modus === 'beleg') { if (beleg && beleg.klaar) belegEinde(); return }
    if (!staat.klaar) return
    if (samenSpel) {   // samen: allebei hetzelfde einde
      geluid(staat.gewonnen ? 'win' : 'verlies')
      const v = staat.kasteel[0]
      tafel.einde({
        gewonnen: staat.gewonnen,
        titel: staat.gewonnen ? '👑 ' + T('Het kasteel is van jullie!') : '💀 ' + T('Verslagen door de {naam}', { naam: v ? vijandNaam(v).toLowerCase() : '' }),
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
    tafel.einde({
      gewonnen: staat.gewonnen,
      titel: staat.gewonnen ? '👑 ' + T('Het kasteel is van jou!') : '💀 ' + T('Verslagen door de {naam}', { naam: v ? vijandNaam(v).toLowerCase() : '' }),
      sub: staat.gewonnen ? MEDAILLE[med] + ' ' + T('Medaille: {m}', { m: T(med) }) + ' · ' + T('Narren gebruikt: {n}', { n: staat.narrenGebruikt })
        : T('Je versloeg {n} van de 12 vijanden', { n: staat.verslagen }),
      opnieuw: startScherm,
    })
  }

  startScherm()
}
