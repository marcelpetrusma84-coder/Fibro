/* Neon Raiders — schietspel (shmup) voor Fibro. v220 (29 okt 2026): terughalen, schild valt vaker en gaat meteen aan, eigen kleur per schip, laserwaarschuwing.
   v193 (21 oktober 2026): het hele spel, alleen spelen.
   v194: samen spelen vanuit de chat (twee schepen tegen dezelfde aliens), zie 'samen spelen' hieronder.
   Zeven levels, elk met een eigen omgeving, eigen vijanden en een eigen eindbaas:
     1 Aarde (je ziet de grond, TITAN)        2 Stratosfeer (hoog boven de wolken, ZEPHYR)
     3 Ruimte (VORTEX)                        4 Moederschip (binnen in een groot ruimteschip, REACTOR)
     5 Diepe ruimte (ZOGGOTH PRIME)           6 Xeron, lucht (andere planeet hoog in de lucht, ZWERMKONINGIN)
     7 Xeron, grond (je ziet de grond, OVERLORD)
   Na een eindbaas vlieg je door naar het volgende level (score, levens en wapens blijven). Het hoogste bereikte level
   wordt onthouden: houd na een ronde OPNIEUW drie seconden ingedrukt om VERDER te tonen;
   dat begint bij het hoogst bereikte level (met de gewone uitrusting).
   Stijl: neon synthwave in vectorstijl (alles in code getekend, geen plaatjes) met een retro-arcade-HUD; Phaser 3.80.1
   uit de eigen repo, het lettertype Press Start 2P, geluid en muziek met Web Audio.
   Besturing: een vinger slepen = vliegen; een tweede vinger tikken of ingedrukt houden = schieten. Met de muis: slepen =
   vliegen en schieten. De tegel linksboven: wapen wisselen of een power-up gebruiken (even slow motion).
   Toetsen: pijltjes of WASD = vliegen, spatie = schieten, Q = de tegel, 1-6 = kiezen in de tegel.
   De golven komen uit een vaste toevalsreeks per level en alles wat telt hangt alleen van de speltijd af,
   zodat twee spelers samen precies hetzelfde level spelen.

   Samen spelen (v194): de berichten gaan rechtstreeks van telefoon naar telefoon (spelnet.js: WebRTC, met de
   eigen TURN-server als reserve; Supabase alleen voor het opzetten, en als laatste reserve 4 berichten per seconde).
   Elke telefoon speelt het level zelf af (zelfde golven, zelfde vijanden met hetzelfde nummer). Over de lijn gaan:
     - je eigen schip (plek, schieten, wapen, schild, levens, score), 20 keer per seconde;
     - wat jouw kogels raken (vijandnummer + schade): de ander trekt dat ook af, zo gaan vijanden bij allebei dood;
     - opgepakte power-ups (weg bij de ander), een bom, geraakt, af, pauze.
   De uitnodiger is de scheidsrechter: zijn speltijd is de maat (de ander loopt iets sneller of langzamer tot het
   klopt), de eindbaas komt pas als hij hem ook heeft, en van de levens van de baas telt steeds de laagste stand.
   Wie het hoogste level heeft, bepaalt het level. Vijanden mikken op het dichtstbijzijnde schip. Ben je af, dan
   kijk je mee en doe je bij het volgende level weer mee (2 levens). v220: of de ander haalt je eerder terug: hij
   vliegt naar de cirkel waar je neerging en blijft er 2 seconden in, dan doe je mee met 1 leven. Allebei af = game over. Samen is de baas 1,4 keer
   zo sterk en geeft de tegel geen slow motion (de tijd moet bij allebei gelijk lopen). */


import { maakNeonMuis, muisPunt } from './neon-raiders-input.js?v=2'
import { supabase } from './supabase.js?v=95'
import { maakNeonScoreService } from './neon-raiders-scores.js?v=3'
import { maakNeonScorebord } from './neon-raiders-scoreboard.js?v=2'
import { koppelNeonVerder } from './neon-raiders-verder.js?v=1'

const vertaal = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const PHASER_URL = new URL('./phaser.min.js?v=1', import.meta.url).href
const FONT_URL = 'lettertypen/press-start-2p.css?v=1'

function laadPhaser() {
  if (window.Phaser) return Promise.resolve()
  if (window._rgPhaserLaden) return window._rgPhaserLaden   // dezelfde lader als Runner & Gunner
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
  if (document.getElementById('nr-stijl')) return
  const st = document.createElement('style')
  st.id = 'nr-stijl'
  st.textContent = `
  .nr{--diep:#07051a;--paneel:#140f2e;--rand:#3a2a6e;--inkt:#e8f6ff;--zacht:#8f9cc8;--cyaan:#5ee7e0;--roze:#ff5d9e;--geel:#ffe14a;
    position:absolute;inset:0;padding:52px 8px 8px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;
    color:var(--inkt);font-family:"Press Start 2P",monospace;font-size:10px;line-height:1.9;
    touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .nr *{box-sizing:border-box}
  .nr .veld{position:relative;overflow:hidden;border:3px solid #3a4250;border-radius:10px;background:var(--diep);
    touch-action:none;-webkit-tap-highlight-color:transparent;flex:none;
    box-shadow:0 0 0 1px #0b0d12,0 0 22px rgba(94,231,224,.22),inset 0 0 0 1px rgba(94,231,224,.4)}
  .nr .hoek{position:absolute;width:20px;height:20px;bottom:3px;z-index:5;pointer-events:none;border:0 solid var(--cyaan);filter:drop-shadow(0 0 4px var(--cyaan))}
  .nr .hoek.l{left:3px;border-width:0 0 2px 2px}
  .nr .hoek.r{right:3px;border-width:0 2px 2px 0}
  .nr .veld canvas{display:block}
  .nr .hud{position:absolute;top:6px;right:8px;text-align:right;pointer-events:none;z-index:2}
  .nr .scoreRij{display:flex;align-items:baseline;gap:6px;justify-content:flex-end}
  .nr .p1{font-size:7px;color:var(--cyaan);text-shadow:0 0 6px var(--cyaan)}
  .nr .score{font-size:12px;color:#fff;text-shadow:0 0 6px var(--cyaan),2px 2px 0 #07051a;letter-spacing:1px}
  .nr .combo{font-size:8px;color:var(--geel);text-shadow:0 0 6px var(--geel);min-height:12px}
  .nr .levens{display:flex;gap:3px;justify-content:flex-end;margin-top:2px}
  .nr .levens svg{width:11px;height:13px;filter:drop-shadow(0 0 3px var(--cyaan))}
  .nr .p1.p2{color:var(--roze);text-shadow:0 0 6px var(--roze)}
  .nr .levens.p2 svg{filter:drop-shadow(0 0 3px var(--roze))}
  .nr .anderRij{display:flex;align-items:baseline;gap:5px;justify-content:flex-end;margin-top:4px;font-size:6px;color:var(--roze);text-shadow:0 0 6px var(--roze)}
  .nr .anderRij.p1{color:var(--cyaan);text-shadow:0 0 6px var(--cyaan)}
  .nr .anderRij[hidden]{display:none}
  .nr .anderRij .aScore{font-size:8px;color:#fff;letter-spacing:1px}
  .nr .anderRij.uit{opacity:.5}
  .nr .tegel{position:absolute;top:6px;left:6px;width:46px;height:46px;z-index:4;padding:0;cursor:pointer;
    background:rgba(20,15,46,.82);border:2px solid var(--cyaan);border-radius:8px;box-shadow:0 0 10px rgba(94,231,224,.55),inset 0 0 8px rgba(94,231,224,.25);
    display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-tap-highlight-color:transparent}
  .nr .tegel canvas{width:28px;height:28px;image-rendering:pixelated;image-rendering:crisp-edges}
  .nr .tegel .stip{position:absolute;bottom:3px;left:0;right:0;display:flex;gap:3px;justify-content:center}
  .nr .tegel .stip i{width:4px;height:4px;background:var(--zacht)}
  .nr .tegel .stip i.aan{background:#fff;box-shadow:0 0 4px #fff}
  .nr .tegel .extra{position:absolute;top:-7px;right:-9px;font-size:7px;line-height:1;padding:3px 3px 2px;color:#07051a;background:var(--geel);border-radius:3px;box-shadow:0 0 6px var(--geel)}
  .nr .tegel .extra:empty{display:none}
  .nr .tegel.open{border-color:var(--geel);box-shadow:0 0 14px rgba(255,225,74,.7)}
  .nr .arsenaal{position:absolute;top:6px;left:58px;right:6px;z-index:4;display:flex;flex-wrap:wrap;gap:6px}
  .nr .arsenaal[hidden]{display:none}
  .nr .arsenaal button{position:relative;width:42px;height:46px;padding:2px 0 0;font-family:inherit;font-size:6px;line-height:1;color:var(--inkt);
    background:rgba(20,15,46,.9);border:2px solid var(--rand);border-radius:7px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
    touch-action:none;-webkit-tap-highlight-color:transparent}
  .nr .arsenaal button canvas{width:21px;height:21px;image-rendering:pixelated;image-rendering:crisp-edges}
  .nr .arsenaal button.nu{border-color:var(--cyaan);box-shadow:0 0 8px rgba(94,231,224,.6)}
  .nr .arsenaal button:disabled{opacity:.35}
  .nr .arsenaal button .n{position:absolute;top:2px;right:3px;color:var(--geel)}
  .nr .baas{position:absolute;left:60px;right:96px;top:12px;z-index:2;pointer-events:none;font-size:7px;color:#ff8ad8;text-shadow:0 0 6px #ff3dd2}
  .nr .baas[hidden]{display:none}
  .nr .baas .balk{height:6px;margin-top:4px;border:1px solid #ff3dd2;background:rgba(40,0,40,.7);box-shadow:0 0 6px #ff3dd2}
  .nr .baas .balk i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff3dd2,#ffe14a);transition:width .12s linear}
  .nr .laag{position:absolute;inset:0;display:grid;place-items:center;text-align:center;background:rgba(7,5,26,.88);padding:14px;overflow-y:auto;z-index:6}
  .nr .laag[hidden]{display:none}
  .nr .laag h1{margin:0 0 12px;font-size:20px;line-height:1.5;font-weight:400;color:#fff;
    text-shadow:0 0 4px var(--roze),0 0 12px var(--roze),0 0 28px var(--roze)}
  .nr .laag h1 span{display:block;color:#fff;text-shadow:0 0 4px var(--cyaan),0 0 12px var(--cyaan),0 0 28px var(--cyaan)}
  .nr .laag .sub{margin:0 0 12px;font-size:9px;color:var(--geel);text-shadow:0 0 6px var(--geel)}
  .nr .laag p{margin:0 auto 12px;color:var(--zacht);max-width:30ch;font-size:8px;line-height:2}
  .nr .knop{font-family:inherit;font-size:11px;color:#07051a;background:var(--cyaan);border:none;border-radius:0;padding:11px 22px;cursor:pointer;
    box-shadow:0 0 12px rgba(94,231,224,.7),3px 3px 0 #1c9aa2}
  .nr .knop:active{transform:translate(2px,2px)}
  .nr .startKnop{position:relative;overflow:hidden;touch-action:none}
  .nr .startKnop.nr-vasthouden::after{content:'';position:absolute;inset:auto 0 0;height:4px;background:var(--roze);transform:scaleX(0);transform-origin:left;animation:nr-verder-wacht 3s linear forwards}
  @keyframes nr-verder-wacht{to{transform:scaleX(1)}}
  @media(prefers-reduced-motion:reduce){.nr .startKnop.nr-vasthouden::after{animation:none;transform:scaleX(1)}}
  .nr .knoppen{display:flex;flex-direction:column;align-items:center;gap:10px}
  .nr .knop.tweede{background:var(--roze);box-shadow:0 0 12px rgba(255,93,158,.7),3px 3px 0 #a3305f}
  .nr .knop:disabled{opacity:.4;cursor:default;box-shadow:none;transform:none}
  .nr .laag p.rol{color:var(--cyaan);text-shadow:0 0 6px var(--cyaan);font-size:8px}
  .nr .laag p.rol:empty{display:none}
  .nr .laag p.muisUitleg{color:var(--cyaan);max-width:38ch}
  @media (pointer:coarse){.nr .laag p.muisUitleg{display:none}}
  .nr .knop[hidden]{display:none}
  .nr .klein{font-family:inherit;font-size:8px;color:var(--zacht);background:none;border:1px solid var(--rand);border-radius:0;padding:6px 10px;margin:10px 4px 0;cursor:pointer}
  .nr .bord{position:absolute;left:0;right:0;top:36%;text-align:center;pointer-events:none;z-index:3;
    font-size:clamp(13px,5vw,22px);line-height:1.6;color:#fff;letter-spacing:2px;opacity:0;padding:0 8px;
    text-shadow:0 0 3px var(--k),0 0 10px var(--k),0 0 22px var(--k),0 0 40px var(--k)}
  .nr .bord small{display:block;font-size:.5em;letter-spacing:1px}
  .nr .bord.aan{animation:nrBord 2.8s linear forwards}
  .nr .bord.lang{animation:nrBord 3.6s linear forwards}
  .nr .bord.vast{opacity:1}
  @keyframes nrBord{0%{opacity:0}4%{opacity:1}7%{opacity:.15}10%{opacity:1}13%{opacity:.35}16%{opacity:1}80%{opacity:1}100%{opacity:0}}
  .nr .meldbalk{position:absolute;left:7%;right:7%;bottom:16px;z-index:4;pointer-events:none;text-align:center;font-size:9px;line-height:1.6;padding:7px 14px;color:#fff;
    background:linear-gradient(90deg,rgba(20,10,40,.4),rgba(20,10,40,.92) 12%,rgba(20,10,40,.92) 88%,rgba(20,10,40,.4));border-top:2px solid var(--k);border-bottom:2px solid var(--k);
    text-shadow:0 0 6px var(--k);clip-path:polygon(5% 0,95% 0,100% 50%,95% 100%,5% 100%,0 50%);opacity:0;transition:opacity .3s}
  .nr .meldbalk.aan{opacity:1;animation:nrKnipper .6s steps(2) 5}
  @keyframes nrKnipper{50%{opacity:.4}}
  .nr .fout{padding:18px;color:var(--roze);font-size:10px;line-height:2;text-align:center}
  `
  document.head.appendChild(st)
}

/* ---------- kleine hulpjes ---------- */
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
function hexInt(h) { return parseInt(String(h).slice(1), 16) }

/* tekenhulpjes (wereldmaten; de doeken staan op dubbele scherpte, zie R) */
let R = 2, SB = 0.5   // R: beeldpunten per wereldpunt (2 op telefoons, 1 op een gewoon scherm); SB = 1 / R: schaal van elk plaatje
function veelhoek(g, p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath() }
function lijn(g, kleur, dikte, p) { g.strokeStyle = kleur; g.lineWidth = dikte; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke() }
function lin(g, x0, y0, x1, y1, kleuren) { const k = g.createLinearGradient(x0, y0, x1, y1); kleuren.forEach((c, i) => k.addColorStop(i / (kleuren.length - 1), c)); return k }
function rad(g, x, y, r, kleuren) { const k = g.createRadialGradient(x, y, 0, x, y, r); kleuren.forEach((c, i) => k.addColorStop(i / (kleuren.length - 1), c)); return k }
function rondRect(g, x, y, b, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + b, y, x + b, y + h, r); g.arcTo(x + b, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + b, y, r); g.closePath() }
function getal(n) { try { return Number(n).toLocaleString((window.T && window.T.locale) || 'nl-NL') } catch (e) { return String(n) } }
function wolk(g, x, y, rx, ry, kleuren) { g.save(); g.translate(x, y); g.scale(1, ry / rx); g.fillStyle = rad(g, 0, 0, rx, kleuren); g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore() }

/* iconen voor de tegel, de keuzes en de capsules (7 x 7) */
const ICOON = {
  puls: ['.......', '.#.#.#.', '.#.#.#.', '.#.#.#.', '.......', '.#.#.#.', '.#.#.#.'],
  spreid: ['#..#..#', '.#.#.#.', '..###..', '...#...', '..###..', '.#####.', '.......'],
  straal: ['..###..', '..#w#..', '..#w#..', '..#w#..', '..#w#..', '.#####.', '#######'],
  raket: ['...#...', '..###..', '..#w#..', '..###..', '.#####.', '.#.#.#.', '...#...'],
  bom: ['#..#..#', '.#.#.#.', '..###..', '###w###', '..###..', '.#.#.#.', '#..#..#'],
  schild: ['#######', '#.....#', '#..w..#', '#.www.#', '.#.w.#.', '..#.#..', '...#...'],
  leven: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...', '.......'],
}
const SCHILD_VAN = new Set(['schutter', 'spuger', 'loper', 'tank', 'muurkanon'])   // v220: deze laten soms een schild vallen
const WRAK_STRAAL = 30, WRAK_TIJD = 2   // v220: terughalen: zo groot is de cirkel, zo lang moet je erin blijven
const LASER_RICHT = 1.5   // v220: zo lang waarschuwt de eindbaas voor zijn laser (was 0.9 s)
const KLEUR = { puls: '#5ee7e0', spreid: '#ff5d9e', straal: '#b6ff3c', raket: '#ffa53c', bom: '#ffe14a', schild: '#7fd4ff', leven: '#ff4f86' }
const WAPENS = ['puls', 'spreid', 'straal', 'raket']
const NAAM = () => ({ puls: vertaal('PULS'), spreid: vertaal('SPREID'), straal: vertaal('STRAAL'), raket: vertaal('RAKET'),
  bom: vertaal('BOM'), schild: vertaal('SCHILD'), leven: vertaal('+1 LEVEN') })

function tekenIcoon(canvas, soort, schaal) {
  const g = canvas.getContext('2d'), s = schaal || 3, rijen = ICOON[soort]
  canvas.width = 7 * s; canvas.height = 7 * s
  g.clearRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const c = rijen[y][x]; if (c === '.') continue
    g.fillStyle = c === 'w' ? '#ffffff' : KLEUR[soort]; g.fillRect(x * s, y * s, s, s)
  }
}

const GELUID = (function () {
  let ctx = null, meester = null, muziekBus = null, aan = true, ruisBuf = null
  let loopt = false, klok = null, stap = 0, volgende = 0, lied = null, straal = null
  const laatst = {}
  try { aan = localStorage.getItem('nr-geluid') !== 'uit' } catch (e) {}
  function wek() {
    if (!aan) return
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
        ctx = new AC()
        meester = ctx.createGain(); meester.gain.value = 0.3; meester.connect(ctx.destination)
        muziekBus = ctx.createGain(); muziekBus.gain.value = 0.5; muziekBus.connect(meester)
      }
      if (ctx.state === 'suspended') ctx.resume()
    } catch (e) {}
  }
  function klaar() { return ctx && aan && ctx.state !== 'closed' }
  function toon(f1, f2, duur, vorm, vol, wanneer, uit) {
    if (!klaar()) return
    try {
      const t = wanneer || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
      o.type = vorm || 'square'
      o.frequency.setValueAtTime(f1, t)
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + duur)
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
      o.connect(g); g.connect(uit || meester); o.start(t); o.stop(t + duur + 0.03)
    } catch (e) {}
  }
  function ruis(duur, vol, f1, f2, wanneer) {
    if (!klaar()) return
    try {
      if (!ruisBuf) { ruisBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = ruisBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 }
      const t = wanneer || ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
      s.buffer = ruisBuf; f.type = 'lowpass'
      f.frequency.setValueAtTime(f1 || 2000, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + duur)
      g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
      s.connect(f); f.connect(g); g.connect(meester); s.start(t); s.stop(t + duur + 0.03)
    } catch (e) {}
  }
  const SFX = {
    puls: () => toon(1700, 800, 0.05, 'square', 0.025),
    spreid: () => toon(1100, 420, 0.06, 'sawtooth', 0.022),
    raket: () => { ruis(0.12, 0.06, 3000, 600); toon(260, 620, 0.12, 'triangle', 0.04) },
    raak: () => toon(520, 260, 0.04, 'square', 0.03),
    ketsen: () => toon(2600, 1900, 0.04, 'triangle', 0.025),
    klein: () => { ruis(0.25, 0.22, 2600, 200); toon(180, 45, 0.22, 'square', 0.08) },
    groot: () => { ruis(0.8, 0.42, 1800, 50); toon(90, 28, 0.6, 'sine', 0.35); toon(60, 22, 0.75, 'triangle', 0.22) },
    vijandSchiet: () => toon(900, 600, 0.05, 'triangle', 0.02),
    pak: () => { const t = ctx.currentTime;[660, 880, 1100, 1320].forEach((f, i) => toon(f, 0, 0.08, 'square', 0.06, t + i * 0.05)) },
    leven: () => { const t = ctx.currentTime;[523, 659, 784, 1047, 1319].forEach((f, i) => toon(f, 0, 0.12, 'square', 0.07, t + i * 0.07)) },
    bom: () => { ruis(1.2, 0.5, 4000, 60); toon(140, 30, 1.0, 'sawtooth', 0.25); toon(70, 20, 1.1, 'sine', 0.4) },
    schild: () => { toon(300, 1200, 0.35, 'triangle', 0.1); toon(450, 1800, 0.35, 'sine', 0.05) },
    pijn: () => { toon(440, 80, 0.45, 'sawtooth', 0.16); ruis(0.6, 0.35, 2000, 80) },
    tel: () => toon(440, 0, 0.12, 'square', 0.1),
    go: () => { toon(880, 0, 0.3, 'square', 0.12); toon(1320, 0, 0.3, 'triangle', 0.06) },
    alarm: () => { const t = ctx.currentTime; for (let i = 0; i < 6; i++) toon(i % 2 ? 660 : 880, 0, 0.22, 'square', 0.1, t + i * 0.25) },
    richt: () => toon(180, 520, 0.9, 'sine', 0.06),
    laser: () => { ruis(1.3, 0.18, 1400, 300); toon(120, 90, 1.3, 'sawtooth', 0.1) },
    wissel: () => toon(1200, 1600, 0.06, 'square', 0.04),
    klaar: () => { const t = ctx.currentTime;[0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => toon(262 * Math.pow(2, n / 12), 0, 0.16, 'square', 0.08, t + i * 0.11)) },
    meteoor: () => { ruis(0.35, 0.25, 900, 120); toon(110, 40, 0.3, 'triangle', 0.12) },
    hek: () => toon(220, 230, 0.25, 'sawtooth', 0.03),
    zuur: () => { ruis(0.15, 0.08, 1200, 400); toon(300, 180, 0.12, 'sine', 0.05) },
    einde: () => { const t = ctx.currentTime;[7, 4, 0, -5].forEach((n, i) => toon(220 * Math.pow(2, n / 12), 0, 0.3, 'square', 0.09, t + i * 0.22)) },
  }
  const PAUZE = { puls: 60, spreid: 60, raak: 45, ketsen: 60, vijandSchiet: 70, klein: 40 }
  /* muziek: voortstuwende bas, arpeggio en een simpele drum. Elk level heeft een eigen lied (LEVELS[n].lied);
     de eindbazen delen een snel, dreigend lied (BAASLIED), getransponeerd naar het level. */
  function noot(n) { return 110 * Math.pow(2, n / 12) }
  function plan() {
    if (!loopt || !klaar()) return
    const L = lied, achtste = 60 / L.tempo / 2
    while (volgende < ctx.currentTime + 0.25) {
      const i = stap % 8, maat = Math.floor(stap / 8) % 4, b = L.bas[maat] + (L.grond || 0)
      toon(noot(b - 12), 0, achtste * 0.9, 'sawtooth', i % 2 ? 0.05 : 0.08, volgende, muziekBus)
      toon(noot(L.arp[i] + b + 12), 0, achtste * 0.7, 'square', 0.022, volgende, muziekBus)
      if (i % 4 === 0) toon(150, 40, 0.12, 'sine', 0.22, volgende, muziekBus)          // trommel
      if (i % 4 === 2) ruis(0.06, 0.06, 6000, 2000, volgende)                          // snare
      volgende += achtste; stap++
    }
  }
  return {
    wek,
    speel(n) {
      try {
        if (!SFX[n] || !klaar()) return
        const nu = ctx.currentTime * 1000
        if (PAUZE[n] && nu - (laatst[n] || -1e9) < PAUZE[n]) return
        laatst[n] = nu; SFX[n]()
      } catch (e) {}
    },
    muziek(start, nieuwLied) {
      if (nieuwLied) lied = nieuwLied
      if (start) { if (loopt || !lied) return; wek(); if (!klaar()) return; loopt = true; volgende = ctx.currentTime + 0.05; stap = 0; klok = setInterval(plan, 60) }
      else { loopt = false; if (klok) clearInterval(klok); klok = null }
    },
    straal(aanZet) {                               // brom van de straal zolang hij aan staat
      if (!klaar()) { straal = null; return }
      try {
        if (aanZet && !straal) {
          const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain()
          o.type = 'sawtooth'; o.frequency.value = 96; o2.type = 'square'; o2.frequency.value = 193
          g.gain.value = 0.035; o.connect(g); o2.connect(g); g.connect(meester); o.start(); o2.start()
          straal = { o, o2, g }
        } else if (!aanZet && straal) {
          const s = straal; straal = null
          s.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); s.o.stop(ctx.currentTime + 0.15); s.o2.stop(ctx.currentTime + 0.15)
        }
      } catch (e) { straal = null }
    },
    staatAan() { return aan },
    zet(v) {
      aan = !!v; try { localStorage.setItem('nr-geluid', aan ? 'aan' : 'uit') } catch (e) {}
      if (!aan) { this.muziek(false); this.straal(false) } else wek()
      if (meester) try { meester.gain.value = aan ? 0.3 : 0 } catch (e) {}
    },
    stop() { this.muziek(false); this.straal(false); try { if (ctx && ctx.state === 'running') ctx.suspend() } catch (e) {} },
  }
})()

/* ---------- de zeven levels ----------
   achtergrond: welke lagen (zie maakAchtergrond), grond: snelheid van de grond in wereldpunten per seconde
   (0 = geen grond: dan komen er geen grondvijanden), pal: kleuren van de vijanden, zwaar: levens van de vijanden
   (en een beetje de snelheid van hun kogels), lied: de muziek van het level. */
const LEVELS = [null,
  { nr: 1, naam: () => vertaal('AARDE'), kleur: '#5ee7e0', achtergrond: 'stad', grond: 46, baas: 'titan', pal: 'rood', zwaar: 1,
    lied: { tempo: 148, bas: [0, 0, -4, -2], arp: [0, 7, 12, 7, 15, 12, 7, 3] } },
  { nr: 2, naam: () => vertaal('STRATOSFEER'), kleur: '#7fd4ff', achtergrond: 'lucht', grond: 0, baas: 'zephyr', pal: 'staal', zwaar: 1.15,
    lied: { tempo: 152, bas: [0, -2, -4, -5], arp: [0, 7, 10, 12, 10, 7, 3, 7], grond: 2 } },
  { nr: 3, naam: () => vertaal('RUIMTE'), kleur: '#b13cff', achtergrond: 'ruimte', grond: 0, baas: 'vortex', pal: 'groen', zwaar: 1.3,
    lied: { tempo: 156, bas: [0, 3, 5, 3], arp: [0, 12, 7, 12, 3, 12, 7, 15], grond: -3 } },
  { nr: 4, naam: () => vertaal('MOEDERSCHIP'), kleur: '#ffd23c', achtergrond: 'schip', grond: 60, baas: 'reactor', pal: 'geel', zwaar: 1.45,
    lied: { tempo: 160, bas: [0, 0, 1, -1], arp: [0, 6, 12, 6, 13, 12, 6, 1], grond: 1 } },
  { nr: 5, naam: () => vertaal('DIEPE RUIMTE'), kleur: '#4aa3ff', achtergrond: 'diep', grond: 0, baas: 'zoggoth', pal: 'blauw', zwaar: 1.6,
    lied: { tempo: 160, bas: [0, -4, -2, -5], arp: [0, 7, 12, 14, 12, 7, 5, 7], grond: -2 } },
  { nr: 6, naam: () => vertaal('XERON · LUCHT'), kleur: '#ffa53c', achtergrond: 'alienlucht', grond: 0, baas: 'koningin', pal: 'organisch', zwaar: 1.75,
    lied: { tempo: 164, bas: [0, 1, -2, -1], arp: [0, 3, 7, 8, 7, 3, 12, 10], grond: 3 } },
  { nr: 7, naam: () => vertaal('XERON · GROND'), kleur: '#ff3dd2', achtergrond: 'aliengrond', grond: 50, baas: 'overlord', pal: 'zwart', zwaar: 1.9,
    lied: { tempo: 168, bas: [0, -1, -3, -5], arp: [0, 3, 6, 12, 6, 3, 15, 12], grond: -1 } },
]
const AANTAL_LEVELS = 7
const BAASLIED = { tempo: 170, bas: [0, 1, 0, -2], arp: [0, 3, 6, 12, 6, 3, 13, 12] }

/* kleuren van de vijanden per level */
const PALET = {
  rood: { licht: '#ff4d6d', mid: '#c0283c', donker: '#7a1028', diep: '#3b0a18', rand: '#ff9ab0', oog: '#ffd23c', motor: '#ff3dd2', gloed: '#ff3d6d' },
  staal: { licht: '#dfe6ee', mid: '#7d8a9c', donker: '#3a4354', diep: '#1a1f29', rand: '#f4f8fc', oog: '#ff4848', motor: '#ffa53c', gloed: '#ffa53c' },
  groen: { licht: '#b6ff3c', mid: '#4f9d2a', donker: '#2a5a14', diep: '#11260a', rand: '#e0ffb0', oog: '#ff3dd2', motor: '#5ee7e0', gloed: '#b6ff3c' },
  geel: { licht: '#ffe28a', mid: '#d9a21a', donker: '#7a5608', diep: '#2b2208', rand: '#fff3b0', oog: '#ff4848', motor: '#5ee7e0', gloed: '#ffd23c' },
  blauw: { licht: '#8fd0ff', mid: '#3d7fd8', donker: '#1b3f8b', diep: '#0b1a3a', rand: '#cfeaff', oog: '#ffe14a', motor: '#ff3dd2', gloed: '#4aa3ff' },
  organisch: { licht: '#ffb36b', mid: '#e0662a', donker: '#7a2a12', diep: '#2e0f06', rand: '#ffd9b0', oog: '#b6ff3c', motor: '#b6ff3c', gloed: '#ff8a1a' },
  zwart: { licht: '#ff5df0', mid: '#8a1f8f', donker: '#2a0b30', diep: '#0d0410', rand: '#ff9af5', oog: '#5ee7e0', motor: '#5ee7e0', gloed: '#ff3dd2' },
}

/* ---------- golven ----------
   t = seconden na de start van het level. Alles komt uit een vaste toevalsreeks (rng(1000 + level)). */
function golfHulp(r) {
  const g = []
  const op = (t, f) => g.push({ t, f })
  const h = {
    g, op,
    bord(t) { op(t, s => s.levelBord()) },
    baas(t) { g.push({ t, f: s => s.startBaas(), baas: true }) },
    lijn(t, n, x, soort) { for (let i = 0; i < n; i++) op(t + i * 0.28, s => s.maak(soort || 'dart', { x, fase: i * 0.7 })) },
    zwaai(t, n, kant) { for (let i = 0; i < n; i++) op(t + i * 0.3, s => s.maak('zwaai', { kant, y: 70 + i * 10 })) },
    vorm(t, n) { for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; op(t + Math.abs(k) * 0.22, s => s.maak('dart', { x: 180 + k * 34, fase: 0, recht: true })) } },
    tanks(t, n, soort) { for (let i = 0; i < n; i++) { const x = 40 + Math.floor(r() * 280); op(t + i * 0.9, s => s.maak(soort || 'tank', { x })) } },
    schutters(t, n) { for (let i = 0; i < n; i++) { const x = 60 + (i + 0.5) * (240 / n); op(t + i * 0.4, s => s.maak('schutter', { x, doelY: 110 + (i % 2) * 50 })) } },
    regen(t, n, snel) { for (let i = 0; i < n; i++) { const x = 24 + Math.floor(r() * 312), fase = r() * 6; op(t + i * 0.18, s => s.maak('dart', { x, fase, recht: true, snel: snel || 1.35 })) } },
    kolos(t, x) { op(t, s => s.maak('kolos', { x })) },
    drager(t, x, buit) { op(t, s => s.maak('drager', { x, buit })) },
    meteoren(t, n) { for (let i = 0; i < n; i++) { const x = 30 + Math.floor(r() * 300), vx = (r() - 0.5) * 60, vy = 55 + r() * 45, draai = (r() - 0.5) * 3; op(t + i * 0.55, s => s.maak('meteoor', { x, vx, vy, draai })) } },
    mijnen(t, n) { for (let i = 0; i < n; i++) { const x = 40 + Math.floor(r() * 280), fase = r() * 6; op(t + i * 0.7, s => s.maak('mijn', { x, fase })) } },
    muren(t, n) { for (let i = 0; i < n; i++) op(t + i * 1.1, s => s.maak('muurkanon', { kant: i % 2 ? 1 : -1 })) },
    hek(t, aanUit) { op(t, s => s.maakHek(aanUit || 0)) },
    slang(t, n, kant, y) { for (let i = 0; i < n; i++) op(t + i * 0.16, s => s.maak('zwerm', { kant, y: y || 90, fase: i * 0.5 })) },
    spugers(t, n) { for (let i = 0; i < n; i++) { const x = 70 + (i + 0.5) * (220 / n); op(t + i * 0.5, s => s.maak('spuger', { x, doelY: 120 + (i % 2) * 40 })) } },
    lopers(t, n) { for (let i = 0; i < n; i++) { const x = 50 + Math.floor(r() * 260); op(t + i * 1.0, s => s.maak('loper', { x })) } },
    klaar() { return g.sort((a, b) => a.t - b.t) },
  }
  return h
}

const GOLVEN = {
  1(h) {  // aarde, met tanks op de grond
    h.bord(0.5)
    h.lijn(4, 5, 180); h.lijn(7, 5, 90); h.lijn(9.5, 5, 270)
    h.zwaai(12, 4, -1); h.zwaai(14.5, 4, 1)
    h.drager(17, 120, 'spreid'); h.tanks(18, 2); h.schutters(21, 2); h.vorm(25, 7)
    h.zwaai(28, 3, -1); h.zwaai(28.4, 3, 1); h.tanks(31, 3)
    h.drager(34, 250, 'raket'); h.schutters(36, 3); h.lijn(37, 6, 60); h.lijn(38, 6, 300)
    h.kolos(41, 180); h.lijn(46, 6, 120); h.lijn(47.5, 6, 240)
    h.drager(50, 180, 'bom'); h.tanks(52, 4); h.zwaai(53, 4, -1); h.schutters(57, 2); h.vorm(58, 9)
    h.drager(62, 90, 'straal'); h.zwaai(64, 4, -1); h.zwaai(64.6, 4, 1)
    h.kolos(68, 110); h.tanks(69, 2); h.regen(75, 14)
    h.drager(80, 270, 'schild'); h.schutters(82, 4); h.zwaai(88, 4, 1); h.zwaai(88.5, 4, -1); h.tanks(89, 3)
    h.kolos(94, 100); h.kolos(95.5, 260); h.drager(100, 180, 'leven'); h.regen(103, 18)
    h.baas(109)
  },
  2(h) {  // stratosfeer: jagers, raketten, kanonneerboten
    h.bord(0.5)
    h.vorm(3.5, 7); h.zwaai(7, 5, -1); h.zwaai(9, 5, 1)
    h.drager(12, 180, 'spreid'); h.schutters(14, 3); h.lijn(16, 6, 70); h.lijn(16.5, 6, 290)
    h.kolos(21, 180); h.regen(26, 12, 1.5)
    h.drager(30, 100, 'bom'); h.zwaai(31, 5, 1); h.zwaai(31.5, 5, -1); h.schutters(35, 4)
    h.vorm(40, 9); h.drager(44, 260, 'raket'); h.kolos(46, 100); h.kolos(47, 260)
    h.lijn(52, 7, 180); h.zwaai(55, 6, -1); h.schutters(58, 3); h.regen(62, 16, 1.5)
    h.drager(67, 180, 'straal'); h.kolos(70, 180); h.zwaai(72, 5, 1); h.zwaai(72.5, 5, -1)
    h.schutters(77, 4); h.drager(82, 90, 'schild'); h.vorm(84, 9); h.lijn(87, 7, 60); h.lijn(88, 7, 300)
    h.kolos(92, 120); h.kolos(93, 240); h.drager(98, 180, 'leven'); h.regen(101, 18, 1.6)
    h.baas(108)
  },
  3(h) {  // ruimte: meteoren, mijnen
    h.bord(0.5)
    h.meteoren(3, 6); h.lijn(6, 6, 180, 'dart'); h.zwaai(9, 5, -1)
    h.drager(12, 140, 'spreid'); h.mijnen(13, 5); h.schutters(17, 3); h.meteoren(20, 8)
    h.zwaai(24, 5, 1); h.zwaai(24.5, 5, -1); h.kolos(28, 180)
    h.drager(33, 220, 'raket'); h.mijnen(34, 6); h.vorm(38, 9); h.meteoren(41, 10)
    h.schutters(46, 4); h.drager(50, 120, 'bom'); h.kolos(52, 90); h.kolos(53, 270)
    h.mijnen(58, 7); h.regen(61, 14, 1.5); h.meteoren(66, 10)
    h.drager(70, 180, 'straal'); h.zwaai(72, 6, -1); h.zwaai(72.5, 6, 1); h.schutters(76, 4)
    h.meteoren(81, 12); h.drager(85, 250, 'schild'); h.kolos(88, 180); h.mijnen(90, 6)
    h.drager(96, 100, 'leven'); h.regen(99, 18, 1.6); h.meteoren(101, 8)
    h.baas(108)
  },
  4(h) {  // binnen in het moederschip: muurkanonnen, laserhekken, geschut op de vloer
    h.bord(0.5)
    h.lijn(3.5, 6, 180); h.muren(6, 4); h.tanks(9, 2, 'tank')
    h.hek(12); h.drager(15, 180, 'spreid'); h.schutters(17, 3); h.muren(19, 4)
    h.zwaai(23, 5, -1); h.zwaai(23.5, 5, 1); h.hek(26, 1); h.tanks(28, 3)
    h.drager(32, 120, 'raket'); h.kolos(34, 180); h.muren(37, 6); h.vorm(40, 9)
    h.hek(44); h.hek(47, 1); h.drager(50, 240, 'bom'); h.schutters(52, 4); h.tanks(55, 3)
    h.regen(60, 14, 1.5); h.muren(63, 6); h.kolos(66, 100); h.kolos(67, 260)
    h.drager(71, 180, 'straal'); h.hek(73); h.zwaai(75, 6, 1); h.zwaai(75.5, 6, -1); h.tanks(78, 4)
    h.drager(83, 100, 'schild'); h.hek(85, 1); h.schutters(87, 4); h.muren(90, 6)
    h.drager(96, 260, 'leven'); h.regen(99, 18, 1.6); h.hek(102)
    h.baas(109)
  },
  5(h) {  // diepe ruimte: alles door elkaar, zwaarder
    h.bord(0.5)
    h.vorm(3, 9); h.meteoren(6, 8); h.schutters(9, 3)
    h.drager(12, 200, 'spreid'); h.zwaai(13, 6, -1); h.zwaai(13.5, 6, 1); h.mijnen(17, 6)
    h.kolos(21, 120); h.kolos(22, 240); h.regen(27, 16, 1.6)
    h.drager(31, 100, 'raket'); h.schutters(33, 4); h.meteoren(36, 10); h.lijn(39, 8, 180)
    h.drager(43, 260, 'bom'); h.kolos(45, 180); h.mijnen(48, 8); h.zwaai(51, 6, 1); h.zwaai(51.5, 6, -1)
    h.vorm(56, 11); h.schutters(59, 4); h.meteoren(62, 12)
    h.drager(66, 180, 'straal'); h.kolos(68, 90); h.kolos(68.5, 270); h.regen(73, 18, 1.7)
    h.drager(78, 120, 'schild'); h.mijnen(80, 8); h.schutters(83, 5); h.zwaai(87, 7, -1); h.zwaai(87.5, 7, 1)
    h.drager(93, 240, 'leven'); h.kolos(95, 180); h.meteoren(98, 12); h.regen(101, 20, 1.8)
    h.baas(108)
  },
  6(h) {  // Xeron, hoog in de lucht: zwermen en spugers
    h.bord(0.5)
    h.slang(3, 8, -1, 80); h.slang(6, 8, 1, 120); h.spugers(9, 2)
    h.drager(12, 180, 'spreid'); h.zwaai(13, 6, -1); h.slang(16, 10, -1, 100); h.schutters(19, 3)
    h.spugers(23, 3); h.slang(26, 10, 1, 70); h.kolos(29, 180)
    h.drager(33, 100, 'raket'); h.slang(34, 10, -1, 130); h.slang(35, 10, 1, 90); h.spugers(39, 3)
    h.drager(44, 250, 'bom'); h.regen(45, 16, 1.6); h.kolos(49, 110); h.kolos(50, 250)
    h.slang(55, 12, -1, 80); h.spugers(58, 4); h.zwaai(61, 6, 1); h.zwaai(61.5, 6, -1)
    h.drager(66, 180, 'straal'); h.slang(68, 12, 1, 110); h.schutters(71, 4); h.spugers(75, 3)
    h.drager(80, 90, 'schild'); h.slang(82, 12, -1, 70); h.slang(83, 12, 1, 140); h.kolos(87, 180)
    h.drager(93, 270, 'leven'); h.spugers(95, 4); h.regen(99, 20, 1.8); h.slang(102, 14, -1, 100)
    h.baas(108)
  },
  7(h) {  // Xeron, de grond: lopers en alles wat je al kent, het zwaarst
    h.bord(0.5)
    h.lopers(3, 2); h.vorm(5, 9); h.slang(8, 10, -1, 90); h.tanks(10, 3)
    h.drager(13, 180, 'spreid'); h.spugers(14, 3); h.lopers(17, 3); h.zwaai(20, 6, 1); h.zwaai(20.5, 6, -1)
    h.kolos(24, 120); h.kolos(25, 240); h.mijnen(29, 6)
    h.drager(33, 100, 'raket'); h.lopers(34, 4); h.schutters(37, 4); h.slang(40, 12, 1, 120)
    h.drager(44, 250, 'bom'); h.regen(45, 18, 1.7); h.tanks(48, 4); h.spugers(51, 4)
    h.kolos(55, 180); h.lopers(57, 4); h.meteoren(60, 8); h.slang(63, 12, -1, 80)
    h.drager(67, 180, 'straal'); h.schutters(69, 5); h.vorm(72, 11); h.tanks(75, 4)
    h.drager(80, 120, 'schild'); h.lopers(81, 5); h.kolos(84, 90); h.kolos(84.5, 270); h.spugers(88, 4)
    h.drager(93, 240, 'leven'); h.regen(96, 22, 1.9); h.slang(100, 14, 1, 100); h.lopers(102, 4)
    h.baas(109)
  },
}
function golvenVoor(nr) { const h = golfHulp(rng(1000 + nr)); GOLVEN[nr](h); return h.klaar() }

/* soorten vijanden: levens (keer zwaar van het level), raakstraal (r), punten, kleuren van de explosie
   (null = de kleuren van het level), grond: rijdt mee met de grond (geen botsing met je schip) */
const SOORT = {
  dart: { hp: 1, r: 10, punten: 100 },
  zwaai: { hp: 2, r: 11, punten: 150 },
  schutter: { hp: 8, r: 15, punten: 500 },
  tank: { hp: 6, r: 13, punten: 400, grond: true },
  kolos: { hp: 45, r: 27, punten: 2000, groot: true },
  drager: { hp: 5, r: 12, punten: 300, kleur: ['#ffd23c', '#ffffff'] },
  meteoor: { hp: 7, r: 17, punten: 250, kleur: ['#b9a58f', '#ffa53c', '#ffffff'] },
  meteoorK: { hp: 2, r: 9, punten: 100, kleur: ['#b9a58f', '#ffa53c'] },
  mijn: { hp: 4, r: 11, punten: 200, kleur: ['#ff4848', '#ffd23c', '#ffffff'] },
  muurkanon: { hp: 8, r: 13, punten: 400, grond: true },
  paal: { hp: 10, r: 11, punten: 300, grond: true, kleur: ['#ff4848', '#ffd23c', '#ffffff'] },
  zwerm: { hp: 1, r: 9, punten: 80 },
  spuger: { hp: 10, r: 16, punten: 600 },
  loper: { hp: 9, r: 15, punten: 500, grond: true },
  raketV: { hp: 1, r: 6, punten: 50, kleur: ['#ffa53c', '#ffffff'] },
}

/* ================= tekenen =================
   Deze functies komen als methodes op de scène (Object.assign op Spel.prototype) en gebruiken this.teken.
   Alles in wereldmaten; het doek staat op R keer de scherpte. */
const TEKENAAR = {
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
    if (this.textures.exists(key)) this.textures.remove(key)
    this.textures.addCanvas(key, c)
  },

  /* ---- vaste texturen: het schip, kogels, effecten, capsules ---- */
  tekenVast() {
    // v194: twee schepen: 'schip' (speler 1, cyaan) en 'schip2' (speler 2, roze)
    // v220: elk schip een eigen kleur romp en vleugels (cyaan / roze), zodat je samen meteen ziet wie wie is
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
    this.teken('spreidKogel', 10, 14, g => { g.fillStyle = '#ff5d9e'; veelhoek(g, [5, 0, 10, 7, 5, 14, 0, 7]); g.fill(); g.fillStyle = '#ffffff'; veelhoek(g, [5, 3, 7, 7, 5, 11, 3, 7]); g.fill() }, '#ff5d9e', 5)
    this.teken('raketKogel', 6, 16, g => {
      g.fillStyle = lin(g, 0, 0, 6, 0, ['#7d8a9c', '#e8eef5', '#7d8a9c']); rondRect(g, 1.5, 2, 3, 11, 1.2); g.fill()
      g.fillStyle = '#ff4848'; veelhoek(g, [1.5, 3, 3, 0, 4.5, 3]); g.fill()
      g.fillStyle = '#596579'; veelhoek(g, [0, 13, 1.5, 9, 1.5, 13]); g.fill(); veelhoek(g, [6, 13, 4.5, 9, 4.5, 13]); g.fill()
      g.fillStyle = '#ffd23c'; g.fillRect(2, 13, 2, 3)
    }, '#ffa53c', 3)
    this.teken('orb', 12, 12, g => { g.fillStyle = rad(g, 6, 6, 6, ['#ffffff', '#ffc2ee', '#ff3dd2', 'rgba(255,61,210,0)']); g.fillRect(0, 0, 12, 12) })
    this.teken('orbO', 12, 12, g => { g.fillStyle = rad(g, 6, 6, 6, ['#ffffff', '#ffe0a0', '#ff8a1a', 'rgba(255,138,26,0)']); g.fillRect(0, 0, 12, 12) })
    this.teken('orbG', 12, 12, g => { g.fillStyle = rad(g, 6, 6, 6, ['#ffffff', '#e4ffb0', '#8be01a', 'rgba(139,224,26,0)']); g.fillRect(0, 0, 12, 12) })
    this.teken('orbB', 12, 12, g => { g.fillStyle = rad(g, 6, 6, 6, ['#ffffff', '#bfe6ff', '#3d9bff', 'rgba(61,155,255,0)']); g.fillRect(0, 0, 12, 12) })
    this.teken('naald', 4, 16, g => { g.fillStyle = lin(g, 0, 0, 0, 16, ['rgba(255,72,72,0)', '#ff4848', '#ffd0d0', '#ffffff']); rondRect(g, 0.5, 0, 3, 16, 1.5); g.fill() }, '#ff4848', 4)
    this.teken('zuur', 10, 10, g => { g.fillStyle = rad(g, 4.5, 4.5, 5, ['#ffffff', '#d8ff7a', '#7bd61a', 'rgba(60,140,10,0)']); g.beginPath(); g.arc(5, 5, 5, 0, 7); g.fill() }, '#b6ff3c', 3)
    this.teken('bomV', 10, 12, g => { g.fillStyle = lin(g, 0, 0, 10, 0, ['#4a3a20', '#c9a24a', '#4a3a20']); rondRect(g, 2, 1, 6, 10, 3); g.fill(); g.fillStyle = '#ff4848'; g.fillRect(4, 9, 2, 2) }, '#ffa53c', 3)
    this.teken('vonk', 3, 3, g => { g.fillStyle = rad(g, 1.5, 1.5, 1.5, ['#ffffff', '#ffffff', 'rgba(255,255,255,0)']); g.fillRect(0, 0, 3, 3) })
    this.teken('flits', 64, 64, g => { g.fillStyle = rad(g, 32, 32, 32, ['rgba(255,255,255,1)', 'rgba(255,255,255,.55)', 'rgba(255,255,255,0)']); g.fillRect(0, 0, 64, 64) })
    this.teken('schildBel', 56, 56, g => {
      g.strokeStyle = '#7fd4ff'; g.lineWidth = 2; g.beginPath(); g.arc(28, 28, 24, 0, 7); g.stroke()
      g.globalAlpha = 0.15; g.fillStyle = '#7fd4ff'; g.beginPath(); g.arc(28, 28, 24, 0, 7); g.fill()
      g.globalAlpha = 0.35
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; lijn(g, '#bfeaff', 0.6, [28 + Math.cos(a) * 12, 28 + Math.sin(a) * 12, 28 + Math.cos(a) * 24, 28 + Math.sin(a) * 24]) }
      g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.fillRect(14, 12, 6, 2)
    }, '#7fd4ff', 6)
    for (const soort of Object.keys(ICOON)) {
      this.teken('cap_' + soort, 28, 28, g => {
        const zes = r => { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; p.push(14 + Math.cos(a) * r, 14 + Math.sin(a) * r) } return p }
        g.fillStyle = lin(g, 0, 0, 0, 28, ['#3a4252', '#14171e']); veelhoek(g, zes(13)); g.fill()
        g.strokeStyle = KLEUR[soort]; g.lineWidth = 1.6; veelhoek(g, zes(13)); g.stroke()
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.6; veelhoek(g, zes(10)); g.stroke()
        const ic = document.createElement('canvas'); tekenIcoon(ic, soort, 4)
        g.imageSmoothingEnabled = false; g.drawImage(ic, 7, 7, 14, 14)
      }, KLEUR[soort], 6)
    }
    /* vijanden die in elk level hetzelfde zijn */
    this.teken('drager', 26, 32, g => {
      g.fillStyle = '#4a3c12'; veelhoek(g, [2, 10, 6, 4, 6, 26, 2, 22]); g.fill(); veelhoek(g, [24, 10, 20, 4, 20, 26, 24, 22]); g.fill()
      g.fillStyle = lin(g, 4, 0, 22, 0, ['#a8780e', '#ffe28a', '#ffd23c', '#8a5d08']); rondRect(g, 5, 1, 16, 30, 7); g.fill()
      g.fillStyle = '#2b2208'; g.fillRect(5, 9, 16, 2); g.fillRect(5, 21, 16, 2)
      g.fillStyle = rad(g, 13, 16, 5, ['#ffffff', '#fff3b0', 'rgba(255,210,60,0)']); g.beginPath(); g.arc(13, 16, 4.5, 0, 7); g.fill()
      g.fillStyle = '#ff4848'; g.beginPath(); g.arc(13, 4, 1.3, 0, 7); g.fill()
    }, '#ffd23c', 6)
    this.teken('raketV', 8, 18, g => {
      g.fillStyle = lin(g, 0, 0, 8, 0, ['#4a3a3a', '#d9c2b0', '#4a3a3a']); rondRect(g, 2, 0, 4, 13, 1.5); g.fill()
      g.fillStyle = '#ff4848'; veelhoek(g, [2, 11, 4, 18, 6, 11]); g.fill()
      g.fillStyle = '#5a4a4a'; veelhoek(g, [0, 3, 2, 6, 2, 1]); g.fill(); veelhoek(g, [8, 3, 6, 6, 6, 1]); g.fill()
      g.fillStyle = '#ffd23c'; g.fillRect(3, 0, 2, 2)
    }, '#ffa53c', 4)
    const meteoor = (key, b, seed) => this.teken(key, b, b, g => {
      const r2 = rng(seed), p = [], n = 11
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = b / 2 * (0.78 + r2() * 0.22); p.push(b / 2 + Math.cos(a) * rr, b / 2 + Math.sin(a) * rr) }
      g.fillStyle = rad(g, b * 0.38, b * 0.36, b * 0.6, ['#8c7c6c', '#5a4c42', '#2a221e']); veelhoek(g, p); g.fill()
      lijn(g, 'rgba(255,200,150,.35)', 0.7, p.slice(0, 10))
      for (let i = 0; i < 4; i++) { const cx = b * (0.25 + r2() * 0.5), cy = b * (0.25 + r2() * 0.5), cr = b * (0.06 + r2() * 0.08); g.fillStyle = 'rgba(20,14,10,.55)'; g.beginPath(); g.arc(cx, cy, cr, 0, 7); g.fill(); g.fillStyle = 'rgba(200,170,140,.35)'; g.beginPath(); g.arc(cx - cr * 0.3, cy - cr * 0.3, cr * 0.5, 0, 7); g.fill() }
      g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 3 * R; g.fillStyle = '#ffa53c'; g.fillRect(b * 0.55, b * 0.6, b * 0.12, 1); g.fillRect(b * 0.3, b * 0.4, 1, b * 0.1); g.restore()
    }, '#ffa53c', 2)
    meteoor('meteoor', 36, 7); meteoor('meteoorK', 20, 11)
    for (const [key, k] of [['mijn', '#ff4848'], ['mijnAan', '#ffffff']]) {
      this.teken(key, 24, 24, g => {
        g.strokeStyle = '#5a5f6e'; g.lineWidth = 2
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; lijn(g, '#7d8494', 2, [12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7, 12 + Math.cos(a) * 11.5, 12 + Math.sin(a) * 11.5]) }
        g.fillStyle = rad(g, 10, 10, 9, ['#9aa2b4', '#4a4f5c', '#1c1f26']); g.beginPath(); g.arc(12, 12, 8, 0, 7); g.fill()
        g.fillStyle = rad(g, 12, 12, 3.5, ['#ffffff', k, 'rgba(0,0,0,0)']); g.beginPath(); g.arc(12, 12, 3.5, 0, 7); g.fill()
      }, k, 5)
    }
  },

  /* ---- vijanden in de kleuren van het level (key: soort_palet) ---- */
  tekenVijanden(pn) {
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
    this.teken(k('zwaai'), 32, 26, g => {
      g.fillStyle = lin(g, 0, 0, 0, 26, [p.mid, p.diep])
      g.beginPath(); g.moveTo(16, 6); g.quadraticCurveTo(8, 0, 0, 4); g.lineTo(5, 10); g.lineTo(2, 16); g.lineTo(9, 15); g.lineTo(16, 26)
      g.lineTo(23, 15); g.lineTo(30, 16); g.lineTo(27, 10); g.lineTo(32, 4); g.quadraticCurveTo(24, 0, 16, 6); g.closePath(); g.fill()
      lijn(g, p.rand, 0.7, [0, 4, 5, 10, 2, 16, 9, 15, 16, 26, 23, 15, 30, 16, 27, 10, 32, 4])
      g.fillStyle = lin(g, 12, 0, 20, 0, [p.donker, p.licht, p.donker]); veelhoek(g, [16, 6, 20, 12, 16, 22, 12, 12]); g.fill()
      g.fillStyle = rad(g, 16, 13, 3.4, ['#ffffff', p.oog, 'rgba(0,0,0,0)']); g.beginPath(); g.arc(16, 13, 3.4, 0, 7); g.fill()
    }, p.gloed, 5)
    this.teken(k('schutter'), 38, 36, g => {
      g.fillStyle = '#1b2029'; rondRect(g, 2, 14, 6, 20, 2); g.fill(); rondRect(g, 30, 14, 6, 20, 2); g.fill()
      g.fillStyle = p.motor; g.fillRect(3.5, 32, 3, 3); g.fillRect(31.5, 32, 3, 3)
      g.fillStyle = lin(g, 0, 0, 38, 0, ['#262c38', '#6a7488', '#3a4252', '#262c38'])
      veelhoek(g, [10, 2, 28, 2, 34, 12, 31, 26, 22, 35, 16, 35, 7, 26, 4, 12]); g.fill()
      lijn(g, '#8f9bb0', 0.6, [10, 2, 4, 12, 7, 26, 16, 35]); lijn(g, '#59647a', 0.6, [28, 2, 34, 12, 31, 26, 22, 35])
      lijn(g, 'rgba(15,18,26,.8)', 0.6, [6, 14, 32, 14]); lijn(g, 'rgba(15,18,26,.8)', 0.6, [8, 24, 30, 24])
      g.fillStyle = p.licht; g.fillRect(8, 16.5, 7, 1.4); g.fillRect(23, 16.5, 7, 1.4)
      g.fillStyle = rad(g, 19, 22, 5, ['#ffffff', p.licht, p.diep]); veelhoek(g, [14, 19, 24, 19, 22, 26, 16, 26]); g.fill()
      g.fillStyle = p.motor; g.fillRect(12, 0, 4, 2.5); g.fillRect(22, 0, 4, 2.5)
    }, p.gloed, 5)
    this.teken(k('kolos'), 66, 60, g => {
      g.fillStyle = lin(g, 0, 0, 0, 60, ['#3a4252', '#1a1e27']); rondRect(g, 0, 14, 14, 36, 4); g.fill(); rondRect(g, 52, 14, 14, 36, 4); g.fill()
      g.fillStyle = lin(g, 0, 0, 66, 0, ['#1c2029', '#555f72', '#3b4352', '#1c2029'])
      veelhoek(g, [20, 0, 46, 0, 56, 12, 54, 40, 42, 58, 24, 58, 12, 40, 10, 12]); g.fill()
      lijn(g, '#8590a6', 0.7, [20, 0, 10, 12, 12, 40, 24, 58]); lijn(g, '#4b5466', 0.7, [46, 0, 56, 12, 54, 40, 42, 58])
      g.fillStyle = '#2a303c'; veelhoek(g, [24, 5, 42, 5, 48, 15, 18, 15]); g.fill()
      lijn(g, 'rgba(10,12,18,.8)', 0.6, [14, 26, 52, 26]); lijn(g, 'rgba(10,12,18,.8)', 0.6, [18, 44, 48, 44])
      g.save(); g.shadowColor = p.motor; g.shadowBlur = 4 * R; g.fillStyle = p.motor
      for (let i = 0; i < 4; i++) { g.fillRect(3, 20 + i * 6, 8, 1.6); g.fillRect(55, 20 + i * 6, 8, 1.6) }
      g.restore()
      g.fillStyle = rad(g, 33, 31, 8, ['#ffffff', p.licht, p.mid, p.diep]); g.beginPath(); g.arc(33, 31, 7.5, 0, 7); g.fill()
      g.strokeStyle = p.oog; g.lineWidth = 1; g.beginPath(); g.arc(33, 31, 9.5, 0, 7); g.stroke()
      g.fillStyle = '#14171e'; g.fillRect(25, 50, 4, 10); g.fillRect(37, 50, 4, 10)
      g.fillStyle = p.motor; g.fillRect(25, 58, 4, 2); g.fillRect(37, 58, 4, 2)
    }, p.gloed, 4)
    this.teken(k('tank'), 30, 30, g => {
      g.fillStyle = '#16120e'; rondRect(g, 1, 2, 7, 26, 2); g.fill(); rondRect(g, 22, 2, 7, 26, 2); g.fill()
      g.fillStyle = '#4a4036'; for (let y = 4; y < 27; y += 3) { g.fillRect(1.5, y, 6, 1); g.fillRect(22.5, y, 6, 1) }
      g.fillStyle = lin(g, 0, 0, 0, 30, [p.donker, p.diep]); rondRect(g, 6, 4, 18, 22, 3); g.fill()
      g.strokeStyle = p.licht; g.lineWidth = 0.8; rondRect(g, 6.5, 4.5, 17, 21, 3); g.stroke()
      g.fillStyle = p.licht; g.fillRect(8, 6, 2, 2); g.fillRect(20, 6, 2, 2)
    }, p.gloed, 3)
    this.teken(k('loop'), 14, 26, g => {
      g.fillStyle = '#20281a'; g.fillRect(5.5, 0, 3, 18)
      g.fillStyle = p.licht; g.fillRect(5.5, 0, 3, 2)
      g.fillStyle = rad(g, 6, 17, 7, [p.licht, p.mid, p.diep]); g.beginPath(); g.arc(7, 19, 6, 0, 7); g.fill()
      g.strokeStyle = p.rand; g.lineWidth = 0.7; g.beginPath(); g.arc(7, 19, 6, 0, 7); g.stroke()
    }, p.gloed, 3)
    /* muurkanon: een blok aan de wand met een draaibare loop (loop_*) */
    this.teken(k('muurkanon'), 28, 30, g => {
      g.fillStyle = lin(g, 0, 0, 28, 0, ['#1a1e27', '#4b5466', '#1a1e27']); rondRect(g, 1, 1, 26, 28, 4); g.fill()
      g.strokeStyle = p.licht; g.lineWidth = 1; rondRect(g, 1.5, 1.5, 25, 27, 4); g.stroke()
      g.fillStyle = '#0b0d12'; g.beginPath(); g.arc(14, 15, 8, 0, 7); g.fill()
      g.fillStyle = p.oog; g.fillRect(4, 4, 3, 3); g.fillRect(21, 23, 3, 3)
    }, p.gloed, 3)
    /* laserhek: een paal met een gloeiende kop */
    this.teken(k('paal'), 22, 26, g => {
      g.fillStyle = lin(g, 0, 0, 22, 0, ['#1a1e27', '#5e6a7e', '#1a1e27']); rondRect(g, 3, 4, 16, 20, 3); g.fill()
      g.fillStyle = '#ff4848'; g.fillRect(3, 12, 16, 2)
      g.fillStyle = rad(g, 11, 6, 6, ['#ffffff', '#ff9090', 'rgba(255,72,72,0)']); g.beginPath(); g.arc(11, 6, 5.5, 0, 7); g.fill()
    }, '#ff4848', 5)
    /* zwerm: klein insect met vleugels */
    this.teken(k('zwerm'), 20, 18, g => {
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(5, 7, 5, 3, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(15, 7, 5, 3, 0.5, 0, 7); g.fill()
      g.strokeStyle = p.rand; g.lineWidth = 0.5; g.beginPath(); g.ellipse(5, 7, 5, 3, -0.5, 0, 7); g.stroke(); g.beginPath(); g.ellipse(15, 7, 5, 3, 0.5, 0, 7); g.stroke()
      g.fillStyle = lin(g, 0, 4, 0, 18, [p.licht, p.mid, p.donker]); g.beginPath(); g.ellipse(10, 10, 3.5, 7, 0, 0, 7); g.fill()
      g.fillStyle = p.oog; g.fillRect(8, 12, 1.5, 1.5); g.fillRect(10.5, 12, 1.5, 1.5)
    }, p.gloed, 4)
    /* spuger: een vlezige bol met een bek en tentakels */
    this.teken(k('spuger'), 36, 38, g => {
      g.strokeStyle = p.donker; g.lineWidth = 2.4; g.lineCap = 'round'
      for (const [x, b] of [[8, -4], [14, -2], [22, 2], [28, 4]]) { g.beginPath(); g.moveTo(x, 6); g.quadraticCurveTo(x + b, -2, x + b * 1.5, 0); g.stroke() }
      g.fillStyle = rad(g, 15, 14, 17, [p.licht, p.mid, p.donker, p.diep]); g.beginPath(); g.ellipse(18, 18, 16, 15, 0, 0, 7); g.fill()
      g.fillStyle = 'rgba(0,0,0,.25)'; for (const [x, y, r] of [[10, 12, 2.5], [24, 10, 2], [27, 20, 2.2], [9, 22, 1.8]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill() }
      g.fillStyle = p.diep; g.beginPath(); g.ellipse(18, 27, 7, 5, 0, 0, 7); g.fill()
      g.fillStyle = rad(g, 18, 28, 5, ['#ffffff', p.oog, 'rgba(0,0,0,0)']); g.beginPath(); g.arc(18, 28, 3.5, 0, 7); g.fill()
      g.fillStyle = p.rand; for (let i = 0; i < 5; i++) veelhoek(g, [12 + i * 3, 23, 13.5 + i * 3, 26, 15 + i * 3, 23]), g.fill()
    }, p.gloed, 5)
    /* loper: een mechanische loper van boven, twee standen voor de poten */
    for (const st of [0, 1]) {
      this.teken(k('loper') + st, 34, 34, g => {
        g.strokeStyle = '#1c2029'; g.lineWidth = 3.4; g.lineCap = 'round'
        const z = st ? 1 : -1
        for (const [x0, y0, x1, y1] of [[10, 10, 2, 4 + z * 3], [24, 10, 32, 4 - z * 3], [10, 24, 2, 30 - z * 3], [24, 24, 32, 30 + z * 3]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() }
        g.strokeStyle = p.mid; g.lineWidth = 1.2
        for (const [x0, y0, x1, y1] of [[10, 10, 2, 4 + z * 3], [24, 10, 32, 4 - z * 3], [10, 24, 2, 30 - z * 3], [24, 24, 32, 30 + z * 3]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() }
        g.fillStyle = lin(g, 0, 0, 34, 0, ['#262c38', '#6a7488', '#262c38']); rondRect(g, 8, 7, 18, 20, 5); g.fill()
        g.strokeStyle = p.licht; g.lineWidth = 0.8; rondRect(g, 8.5, 7.5, 17, 19, 5); g.stroke()
        g.fillStyle = rad(g, 17, 20, 4, ['#ffffff', p.oog, p.diep]); g.beginPath(); g.arc(17, 20, 3.4, 0, 7); g.fill()
        g.fillStyle = '#0b0d12'; g.fillRect(12, 24, 3, 8); g.fillRect(19, 24, 3, 8)
      }, p.gloed, 4)
    }
  },
  achtergrond_stad() {
      const B = 360, HH = 720, r = rng(424242)
      const DAK = [['#221a44', '#16112e', '#3a2f6a'], ['#1d2240', '#121529', '#34406e'], ['#2a1a3e', '#180f26', '#4a2f6a'], ['#1a2333', '#0f1520', '#2f4058']]
      const NEON = ['#ff3dd2', '#5ee7e0', '#9b6bff', '#ff5d9e', '#ffd23c']
      this.teken('ag_stad', B, HH, g => {
        const gloei = (kleur, sterkte, f) => { g.save(); g.shadowColor = kleur; g.shadowBlur = sterkte * R; f(); g.restore() }
        g.fillStyle = '#0a0716'; g.fillRect(0, 0, B, HH)
        const wegX = [0, 124, 244, 360], wegY = [0, 120, 240, 360, 480, 600]
        const RIV0 = 510, RIV1 = 570
        const gebouw = (x, y, b, h) => {
          const k = DAK[Math.floor(r() * DAK.length)]
          g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + 3, y + 4, b, h)
          g.fillStyle = lin(g, x, y, x + b, y + h, [k[0], k[1]]); g.fillRect(x, y, b, h)
          g.strokeStyle = k[2]; g.lineWidth = 0.8; g.strokeRect(x + 0.8, y + 0.8, b - 1.6, h - 1.6)
          const n = 1 + Math.floor(r() * 3)
          for (let i = 0; i < n; i++) {
            const tp = r(), dx = x + 3 + r() * Math.max(1, b - 12), dy = y + 3 + r() * Math.max(1, h - 11)
            if (tp < 0.35) { g.fillStyle = '#2c2a44'; g.fillRect(dx, dy, 6, 5); g.strokeStyle = '#4a476a'; g.lineWidth = 0.5; g.beginPath(); g.arc(dx + 3, dy + 2.5, 1.6, 0, 7); g.stroke() }
            else if (tp < 0.55) { g.fillStyle = '#24223a'; g.beginPath(); g.arc(dx + 3, dy + 3, 3, 0, 7); g.fill(); g.fillStyle = '#3c3a5c'; g.fillRect(dx + 1.5, dy + 1.5, 1.5, 1) }
            else if (tp < 0.75) { g.fillStyle = '#152448'; g.fillRect(dx, dy, 8, 6); g.strokeStyle = '#3b5ba8'; g.lineWidth = 0.4; for (let j = 1; j < 4; j++) { g.beginPath(); g.moveTo(dx + j * 2, dy); g.lineTo(dx + j * 2, dy + 6); g.stroke() } }
            else gloei('#ffe9a8', 3, () => { g.fillStyle = 'rgba(255,233,168,.75)'; g.fillRect(dx, dy, 4, 3) })
          }
          if (r() < 0.4) { const nk = NEON[Math.floor(r() * NEON.length)]; gloei(nk, 4, () => { g.fillStyle = nk; if (r() < 0.5) g.fillRect(x, y + h - 1.4, b, 1.2); else g.fillRect(x + b - 1.4, y, 1.2, h) }) }
          if (r() < 0.12 && b > 24 && h > 24) { g.strokeStyle = '#ff5d9e'; g.lineWidth = 1; g.beginPath(); g.arc(x + b / 2, y + h / 2, 7, 0, 7); g.stroke(); lijn(g, '#ff5d9e', 1, [x + b / 2 - 3, y + h / 2 - 3.5, x + b / 2 - 3, y + h / 2 + 3.5]); lijn(g, '#ff5d9e', 1, [x + b / 2 + 3, y + h / 2 - 3.5, x + b / 2 + 3, y + h / 2 + 3.5]); lijn(g, '#ff5d9e', 1, [x + b / 2 - 3, y + h / 2, x + b / 2 + 3, y + h / 2]) }
          if (r() < 0.25) gloei('#ff4848', 4, () => { g.fillStyle = '#ff4848'; g.beginPath(); g.arc(x + b - 3, y + 3, 1, 0, 7); g.fill() })
        }
        const gebouwen = (x0, y0, x1, y1) => {
          let x = x0
          while (x < x1 - 8) {
            const b = Math.min(x1 - x, 18 + Math.floor(r() * 24)); let y = y0
            while (y < y1 - 8) { const h = Math.min(y1 - y, 18 + Math.floor(r() * 24)); gebouw(x, y, b - 3, h - 3); y += h }
            x += b
          }
        }
        const park = (x0, y0, x1, y1) => {
          g.fillStyle = lin(g, x0, y0, x1, y1, ['#0f2a1d', '#0a1d14']); g.fillRect(x0, y0, x1 - x0, y1 - y0)
          g.fillStyle = '#2a3628'; g.fillRect(x0, (y0 + y1) / 2 - 1, x1 - x0, 2); g.fillRect((x0 + x1) / 2 - 1, y0, 2, y1 - y0)
          for (let n = 0; n < 30; n++) {
            const tx = x0 + 4 + r() * (x1 - x0 - 8), ty = y0 + 4 + r() * (y1 - y0 - 8), tr = 2.5 + r() * 3
            g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(tx + 1.5, ty + 2, tr, 0, 7); g.fill()
            g.fillStyle = r() < 0.5 ? '#1d5a34' : '#246b3d'; g.beginPath(); g.arc(tx, ty, tr, 0, 7); g.fill()
            g.fillStyle = '#3f8a52'; g.beginPath(); g.arc(tx - tr * 0.3, ty - tr * 0.3, tr * 0.4, 0, 7); g.fill()
          }
          for (let n = 0; n < 4; n++) gloei('#ffe14a', 4, () => { g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(x0 + 8 + n * (x1 - x0 - 16) / 3, (y0 + y1) / 2 - 3, 0.9, 0, 7); g.fill() })
        }
        // blokken tussen de wegen
        for (let i = 0; i < wegX.length - 1; i++) for (let j = 0; j < wegY.length; j++) {
          const x0 = wegX[i] + 9, x1 = wegX[i + 1] - 9, y0 = wegY[j] + 8, y1 = (j + 1 < wegY.length ? wegY[j + 1] : HH) - 8
          if (y0 < RIV1 && y1 > RIV0) { gebouwen(x0, y0, x1, RIV0 - 6); gebouwen(x0, RIV1 + 6, x1, y1); continue }
          if (r() < 0.13) park(x0, y0, x1, y1); else gebouwen(x0, y0, x1, y1)
        }
        // de rivier
        g.fillStyle = lin(g, 0, RIV0, 0, RIV1, ['#061a33', '#0b2c55', '#061a33']); g.fillRect(0, RIV0, B, RIV1 - RIV0)
        g.fillStyle = 'rgba(59,130,214,.45)'
        for (let n = 0; n < 70; n++) g.fillRect(r() * B, RIV0 + 4 + r() * (RIV1 - RIV0 - 8), 4 + r() * 10, 0.7)
        for (let n = 0; n < 16; n++) { g.fillStyle = NEON[n % NEON.length]; g.globalAlpha = 0.35; g.fillRect(r() * B, RIV0 + 6 + r() * 48, 1, 4 + r() * 6); g.globalAlpha = 1 }
        gloei('#5ee7e0', 4, () => { g.fillStyle = '#5ee7e0'; g.fillRect(0, RIV0, B, 1); g.fillRect(0, RIV1 - 1, B, 1) })
        // wegen
        g.fillStyle = '#141020'
        for (const y of wegY) for (const yy of [y, y + HH]) g.fillRect(0, yy - 7, B, 14)
        for (const x of wegX) { g.fillRect(x - 8, 0, 16, RIV0); g.fillRect(x - 8, RIV1, 16, HH - RIV1) }
        g.fillStyle = '#251d38'
        for (const y of wegY) for (const yy of [y, y + HH]) { g.fillRect(0, yy - 7, B, 0.8); g.fillRect(0, yy + 6.2, B, 0.8) }
        // bruggen
        for (const x of wegX) {
          g.fillStyle = '#2a2240'; g.fillRect(x - 9, RIV0 - 2, 18, RIV1 - RIV0 + 4)
          gloei('#ff3dd2', 3, () => { g.fillStyle = '#ff3dd2'; g.fillRect(x - 9, RIV0 - 2, 1, RIV1 - RIV0 + 4); g.fillRect(x + 8, RIV0 - 2, 1, RIV1 - RIV0 + 4) })
        }
        // middenstrepen
        g.globalAlpha = 0.55
        g.fillStyle = '#5ee7e0'; for (const y of wegY) for (const yy of [y, y + HH]) for (let x = 0; x < B; x += 10) g.fillRect(x, yy - 0.4, 5, 0.8)
        g.fillStyle = '#ff5d9e'; for (const x of wegX) for (let y = 0; y < HH; y += 10) { if (y > RIV0 - 4 && y < RIV1 + 4) continue; g.fillRect(x - 0.4, y, 0.8, 5) }
        g.globalAlpha = 1
        // zebrapaden bij de kruispunten
        g.fillStyle = 'rgba(230,230,255,.22)'
        for (const x of wegX) for (const y of wegY) for (let k = -6; k <= 5; k += 2.4) { g.fillRect(x + k, y - 13, 1.2, 4); g.fillRect(x + 10, y + k, 4, 1.2) }
        // auto's met koplampen
        for (let n = 0; n < 34; n++) {
          const verticaal = r() < 0.5
          const x = verticaal ? wegX[Math.floor(r() * wegX.length)] + (r() < 0.5 ? -4 : 4) : r() * B
          const y = verticaal ? r() * HH : wegY[Math.floor(r() * wegY.length)] + (r() < 0.5 ? -3.5 : 3.5)
          if (y > RIV0 - 6 && y < RIV1 + 6 && !verticaal) continue
          const kleur = ['#c9d3df', '#ff5d9e', '#4aa3ff', '#ffd23c', '#7d8a9c'][Math.floor(r() * 5)]
          g.fillStyle = kleur
          if (verticaal) { rondRect(g, x - 1.6, y, 3.2, 6, 1); g.fill(); gloei('#ffffff', 3, () => { g.fillStyle = '#ffffff'; g.fillRect(x - 1.4, y - 0.4, 1, 0.8); g.fillRect(x + 0.4, y - 0.4, 1, 0.8) }); g.fillStyle = '#ff2a2a'; g.fillRect(x - 1.4, y + 5.6, 2.8, 0.6) }
          else { rondRect(g, x, y - 1.6, 6, 3.2, 1); g.fill(); gloei('#ffffff', 3, () => { g.fillStyle = '#ffffff'; g.fillRect(x + 5.6, y - 1.4, 0.8, 1); g.fillRect(x + 5.6, y + 0.4, 0.8, 1) }) }
        }
      })
      // nevel: een laag die sneller schuift
      this.teken('ag_nevel', 360, 640, g => {
        const r2 = rng(99)
        for (let n = 0; n < 9; n++) {
          const x = r2() * 360, y = r2() * 640, rx = 40 + r2() * 60, ry = 16 + r2() * 24
          for (const dy of [0, -640, 640]) {
            g.save(); g.translate(x, y + dy); g.scale(1, ry / rx)
            g.fillStyle = rad(g, 0, 0, rx, ['rgba(150,110,255,.32)', 'rgba(150,110,255,0)']); g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore()
          }
        }
      })
      return [{ key: 'ag_stad', v: 46, alpha: 0.62, diepte: -50 },
        { key: 'ag_nevel', v: 95, alpha: 0.55, add: true, diepte: 30 }]
  },

  /* ---- achtergronden per level: elke laag is een doorlopende strook (key, v = snelheid, alpha, add = oplichten,
     diepte), of vast = een stilstaand plaatje over het hele veld. ---- */
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
  achtergrond_lucht() {
    this.teken('ag_lucht', 360, 640, g => {
      g.fillStyle = lin(g, 0, 0, 0, 640, ['#070524', '#140f45', '#2a1a5e', '#5a2a6e', '#8a3a5e']); g.fillRect(0, 0, 360, 640)
      const r = rng(202)
      for (let i = 0; i < 90; i++) { const x = r() * 360, y = r() * 300, m = r() < 0.1 ? 1.4 : 0.8; g.globalAlpha = 0.3 + r() * 0.6; g.fillStyle = '#ffffff'; g.fillRect(x, y, m, m) }
      g.globalAlpha = 1
    })
    this.teken('ag_ver', 360, 720, g => {   // heel ver onder je: de lichtjes van steden
      const r = rng(203)
      for (let i = 0; i < 26; i++) {
        const cx = r() * 360, cy = r() * 720, n = 20 + Math.floor(r() * 40)
        for (let j = 0; j < n; j++) {
          const x = cx + (r() - 0.5) * 60, y = cy + (r() - 0.5) * 50, k = r() < 0.5 ? 'rgba(255,220,150,.55)' : 'rgba(94,231,224,.45)'
          g.fillStyle = k; for (const dy of [-720, 0, 720]) g.fillRect(x, y + dy, 1, 1)
        }
      }
    })
    this.teken('ag_wolkVer', 360, 720, g => {
      const r = rng(204)
      for (let i = 0; i < 14; i++) {
        const x = r() * 360, y = r() * 720, rx = 50 + r() * 70, ry = rx * (0.35 + r() * 0.2)
        for (const dy of [-720, 0, 720]) wolk(g, x, y + dy, rx, ry, ['rgba(120,100,200,.42)', 'rgba(80,60,160,.18)', 'rgba(60,40,140,0)'])
      }
    })
    this.teken('ag_wolkDicht', 360, 720, g => {
      const r = rng(205)
      for (let i = 0; i < 8; i++) {
        const x = r() * 360, y = r() * 720, rx = 40 + r() * 60, ry = rx * (0.3 + r() * 0.2)
        for (const dy of [-720, 0, 720]) {
          wolk(g, x, y + dy, rx, ry, ['rgba(255,190,230,.5)', 'rgba(180,140,230,.28)', 'rgba(120,90,200,0)'])
          wolk(g, x + rx * 0.2, y + dy - ry * 0.3, rx * 0.5, ry * 0.5, ['rgba(255,240,250,.35)', 'rgba(255,200,240,0)'])
        }
      }
    })
    return [{ key: 'ag_lucht', vast: true, diepte: -60 }, { key: 'ag_ver', v: 12, alpha: 0.8, diepte: -55 },
      { key: 'ag_wolkVer', v: 38, alpha: 0.9, diepte: -50 }, { key: 'ag_wolkDicht', v: 110, alpha: 0.35, diepte: 30 }]
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
  achtergrond_schip() {
    const r = rng(401)
    this.teken('ag_vloer', 360, 480, g => {
      g.fillStyle = '#14161d'; g.fillRect(0, 0, 360, 480)
      for (let y = 0; y < 480; y += 40) for (let x = 36; x < 324; x += 48) {
        g.fillStyle = lin(g, x, y, x + 48, y + 40, ['#2a2e3a', '#1e212b']); g.fillRect(x + 1, y + 1, 46, 38)
        g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, 47, 39)
        g.fillStyle = '#3a3f4e'; for (const [cx, cy] of [[4, 4], [44, 4], [4, 36], [44, 36]]) { g.beginPath(); g.arc(x + cx, y + cy, 1, 0, 7); g.fill() }
        const kans = r()
        if (kans < 0.2) {
          g.fillStyle = '#0b0c10'; g.fillRect(x + 10, y + 8, 28, 24)
          g.save(); g.shadowColor = '#ff8a1a'; g.shadowBlur = 6 * R; g.fillStyle = 'rgba(255,138,26,.55)'; for (let i = 0; i < 6; i++) g.fillRect(x + 12, y + 10 + i * 4, 24, 1.4); g.restore()
        } else if (kans < 0.36) {
          g.save(); g.beginPath(); g.rect(x + 6, y + 14, 36, 12); g.clip()
          for (let i = -2; i < 10; i++) { g.fillStyle = i % 2 ? '#c9a21a' : '#141414'; veelhoek(g, [x + i * 6, y + 26, x + 6 + i * 6, y + 14, x + 12 + i * 6, y + 14, x + 6 + i * 6, y + 26]); g.fill() }
          g.restore()
        }
      }
      g.save(); g.shadowColor = '#5ee7e0'; g.shadowBlur = 5 * R; g.fillStyle = '#5ee7e0'; g.fillRect(118, 0, 1.5, 480); g.fillRect(241, 0, 1.5, 480); g.restore()
      g.save(); g.shadowColor = '#ff3dd2'; g.shadowBlur = 5 * R; g.fillStyle = '#ff3dd2'; for (let y = 20; y < 480; y += 80) g.fillRect(36, y, 288, 1); g.restore()
      for (const [x0, x1] of [[0, 36], [324, 360]]) {
        g.fillStyle = lin(g, x0, 0, x1, 0, x0 === 0 ? ['#0b0c10', '#3a3f4e', '#262a35'] : ['#262a35', '#3a3f4e', '#0b0c10']); g.fillRect(x0, 0, 36, 480)
        for (let y = 0; y < 480; y += 60) {
          g.fillStyle = '#1a1d26'; g.fillRect(x0 + 4, y + 6, 28, 48)
          g.save(); g.shadowColor = '#ffd23c'; g.shadowBlur = 4 * R; g.fillStyle = '#ffd23c'; g.fillRect(x0 === 0 ? x1 - 3 : x0 + 1.5, y + 14, 1.5, 32); g.restore()
        }
      }
    })
    this.teken('ag_lichten', 360, 480, g => { for (let y = 40; y < 480; y += 160) { g.fillStyle = lin(g, 0, y - 18, 0, y + 18, ['rgba(255,240,200,0)', 'rgba(255,240,200,.28)', 'rgba(255,240,200,0)']); g.fillRect(36, y - 18, 288, 36) } })
    return [{ key: 'ag_vloer', v: 60, alpha: 0.72, diepte: -50 }, { key: 'ag_lichten', v: 140, add: true, alpha: 0.6, diepte: 30 }]
  },
  achtergrond_diep() {
    this.teken('ag_diep', 360, 640, g => { g.fillStyle = lin(g, 0, 0, 0, 640, ['#020812', '#04121c', '#061a24']); g.fillRect(0, 0, 360, 640) })
    this.sterrenLaag('ag_st1', 200, 0.6, 0.45, 501)
    this.teken('ag_nevel5', 360, 960, g => {
      const r = rng(502), KL = [['rgba(40,220,180,.25)', 'rgba(40,220,180,0)'], ['rgba(60,140,255,.28)', 'rgba(60,140,255,0)'], ['rgba(180,255,120,.16)', 'rgba(180,255,120,0)']]
      for (let i = 0; i < 11; i++) { const x = r() * 360, y = r() * 960, rx = 70 + r() * 90, ry = rx * (0.4 + r() * 0.4); for (const dy of [-960, 0, 960]) wolk(g, x, y + dy, rx, ry, KL[i % 3]) }
    })
    this.teken('ag_ringplaneet', 360, 1600, g => {
      const x = 90, y = 520, r0 = 56
      const ring = (van, tot) => { g.save(); g.translate(x, y); g.rotate(-0.35); g.strokeStyle = 'rgba(255,190,120,.55)'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, r0 * 1.9, r0 * 0.45, 0, van, tot); g.stroke(); g.strokeStyle = 'rgba(255,230,190,.5)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, r0 * 1.6, r0 * 0.36, 0, van, tot); g.stroke(); g.restore() }
      ring(Math.PI, Math.PI * 2)
      g.fillStyle = rad(g, x - 20, y - 22, r0 * 1.3, ['#9ff0e0', '#2a9a8a', '#0e3a3a', '#031414']); g.beginPath(); g.arc(x, y, r0, 0, 7); g.fill()
      ring(0, Math.PI)
    })
    this.sterrenLaag('ag_st2', 50, 1.5, 0.9, 503, true)
    this.teken('ag_puin', 360, 720, g => {
      const r = rng(504)
      for (let i = 0; i < 18; i++) {
        const x = r() * 360, y = r() * 720, m = 4 + r() * 9, a = r() * 6, k = r() < 0.5 ? '#ffa53c' : '#5ee7e0'
        for (const dy of [-720, 0, 720]) {
          g.save(); g.translate(x, y + dy); g.rotate(a)
          g.fillStyle = lin(g, -m, 0, m, 0, ['#2a2f3a', '#6a7488', '#2a2f3a']); veelhoek(g, [-m, -m * 0.4, m * 0.7, -m * 0.6, m, m * 0.3, -m * 0.3, m * 0.5]); g.fill()
          g.fillStyle = k; g.fillRect(-m * 0.3, -0.5, m * 0.6, 1)
          g.restore()
        }
      }
    })
    return [{ key: 'ag_diep', vast: true, diepte: -60 }, { key: 'ag_st1', v: 9, diepte: -58 }, { key: 'ag_nevel5', v: 5, add: true, alpha: 0.9, diepte: -56 },
      { key: 'ag_ringplaneet', v: 12, diepte: -54 }, { key: 'ag_st2', v: 26, diepte: -52 }, { key: 'ag_puin', v: 55, alpha: 0.85, diepte: -50 }]
  },
  achtergrond_alienlucht() {
    this.teken('ag_xl', 360, 640, g => {
      g.fillStyle = lin(g, 0, 0, 0, 640, ['#06222c', '#0f3a44', '#2a4a4a', '#7a4a3a', '#d0703a']); g.fillRect(0, 0, 360, 640)
      const r = rng(601)
      for (let i = 0; i < 50; i++) { const x = r() * 360, y = r() * 220; g.globalAlpha = 0.25 + r() * 0.5; g.fillStyle = '#e0fff8'; g.fillRect(x, y, 0.8, 0.8) }
      g.globalAlpha = 1
      g.save(); g.shadowColor = '#9ff0e0'; g.shadowBlur = 14 * R; g.fillStyle = rad(g, 70, 112, 40, ['#e8fff8', '#9fd8d0', '#3a7a78']); g.beginPath(); g.arc(80, 120, 34, 0, 7); g.fill(); g.restore()
      g.fillStyle = 'rgba(20,60,60,.35)'; for (const [x, y, rr] of [[70, 110, 7], [92, 132, 5], [88, 104, 4]]) { g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill() }
      g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 10 * R; g.fillStyle = rad(g, 286, 66, 18, ['#fff0d0', '#ffb36b', '#c0602a']); g.beginPath(); g.arc(290, 70, 16, 0, 7); g.fill(); g.restore()
    })
    this.teken('ag_eilanden', 360, 960, g => {
      const r = rng(602)
      for (let i = 0; i < 7; i++) {
        const x = 30 + r() * 300, y = r() * 960, b = 40 + r() * 50, kristal = r() < 0.6
        for (const dy of [-960, 0, 960]) {
          const yy = y + dy
          g.fillStyle = lin(g, 0, yy - 10, 0, yy + b * 0.6, ['#3a2450', '#22143a', '#120a20'])
          veelhoek(g, [x - b / 2, yy, x - b / 3, yy - 6, x + b / 4, yy - 7, x + b / 2, yy - 1, x + b / 3, yy + b * 0.25, x + b / 8, yy + b * 0.55, x - b / 6, yy + b * 0.35, x - b / 2.4, yy + b * 0.15]); g.fill()
          g.save(); g.shadowColor = '#2ad0b0'; g.shadowBlur = 5 * R; lijn(g, '#2ad0b0', 1.4, [x - b / 2, yy, x - b / 3, yy - 6, x + b / 4, yy - 7, x + b / 2, yy - 1]); g.restore()
          g.strokeStyle = 'rgba(42,208,176,.4)'; g.lineWidth = 0.7
          for (let j = 0; j < 4; j++) { const vx = x - b / 3 + j * b / 5; g.beginPath(); g.moveTo(vx, yy + b * 0.2); g.quadraticCurveTo(vx + 3, yy + b * 0.4, vx - 1, yy + b * 0.55 + j * 3); g.stroke() }
          if (kristal) { g.save(); g.shadowColor = '#ff3dd2'; g.shadowBlur = 6 * R; g.fillStyle = '#ff7ae0'; veelhoek(g, [x, yy - 18, x + 4, yy - 6, x - 4, yy - 6]); g.fill(); veelhoek(g, [x + 8, yy - 12, x + 11, yy - 5, x + 5, yy - 5]); g.fill(); g.restore() }
        }
      }
    })
    this.teken('ag_xwolken', 360, 720, g => {
      const r = rng(603)
      for (let i = 0; i < 9; i++) {
        const x = r() * 360, y = r() * 720, rx = 45 + r() * 60, ry = rx * (0.3 + r() * 0.2), k = i % 2 ? ['rgba(255,170,100,.45)', 'rgba(255,120,60,.15)', 'rgba(255,120,60,0)'] : ['rgba(120,240,220,.35)', 'rgba(60,180,170,.12)', 'rgba(60,180,170,0)']
        for (const dy of [-720, 0, 720]) wolk(g, x, y + dy, rx, ry, k)
      }
    })
    return [{ key: 'ag_xl', vast: true, diepte: -60 }, { key: 'ag_eilanden', v: 32, diepte: -55 }, { key: 'ag_xwolken', v: 100, alpha: 0.4, diepte: 30 }]
  },
  achtergrond_aliengrond() {
    const r = rng(701)
    this.teken('ag_xg', 360, 720, g => {
      g.fillStyle = lin(g, 0, 0, 360, 720, ['#1a0b24', '#24102e', '#160920']); g.fillRect(0, 0, 360, 720)
      for (let i = 0; i < 60; i++) {
        const x = r() * 360, y = r() * 720, rx = 6 + r() * 26, ry = rx * (0.5 + r() * 0.4)
        for (const dy of [-720, 0, 720]) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y + dy, rx, ry, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(160,90,200,.18)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x - 1, y + dy - 1, rx, ry, 0, Math.PI, Math.PI * 1.8); g.stroke() }
      }
      const rivier = () => { g.beginPath(); for (let y = -10; y <= 730; y += 8) { const x = 180 + Math.sin(y / 720 * Math.PI * 4) * 100; if (y < 0) g.moveTo(x, y); else g.lineTo(x, y) } }
      g.save(); g.shadowColor = '#8be01a'; g.shadowBlur = 10 * R; g.strokeStyle = 'rgba(80,160,20,.7)'; g.lineWidth = 24; rivier(); g.stroke(); g.restore()
      g.strokeStyle = 'rgba(139,224,26,.75)'; g.lineWidth = 14; rivier(); g.stroke()
      g.strokeStyle = 'rgba(230,255,170,.55)'; g.lineWidth = 2; rivier(); g.stroke()
      const KR = ['#5ee7e0', '#ff3dd2', '#b13cff']
      for (let i = 0; i < 26; i++) {
        const y = r() * 720; let x = r() * 360
        const rx = 180 + Math.sin(y / 720 * Math.PI * 4) * 100; if (Math.abs(x - rx) < 28) x = (x + 120) % 360
        const k = KR[i % 3], n = 3 + Math.floor(r() * 3), hoeken = []; for (let j = 0; j < n; j++) hoeken.push([(r() - 0.5) * 1.4, 6 + r() * 10])
        for (const dy of [-720, 0, 720]) {
          g.save(); g.shadowColor = k; g.shadowBlur = 6 * R
          for (const [a, l] of hoeken) { g.save(); g.translate(x, y + dy); g.rotate(a); g.fillStyle = lin(g, 0, -l, 0, 0, ['#ffffff', k, 'rgba(0,0,0,.4)']); veelhoek(g, [0, -l, 2, 0, -2, 0]); g.fill(); g.restore() }
          g.restore()
        }
      }
      for (let i = 0; i < 6; i++) {
        const x = 20 + r() * 300, y = r() * 720, b = 30 + r() * 30, h = 24 + r() * 20
        for (const dy of [-720, 0, 720]) {
          g.fillStyle = '#2a1838'; g.fillRect(x, y + dy, b, h)
          g.save(); g.shadowColor = '#ff3dd2'; g.shadowBlur = 4 * R; g.strokeStyle = '#ff3dd2'; g.lineWidth = 0.8; g.strokeRect(x + 3, y + dy + 3, b - 6, h - 6)
          g.beginPath(); g.arc(x + b / 2, y + dy + h / 2, Math.min(b, h) / 5, 0, 7); g.stroke(); g.restore()
        }
      }
    })
    this.teken('ag_sporen', 360, 640, g => {
      const r2 = rng(702)
      for (let i = 0; i < 40; i++) { const x = r2() * 360, y = r2() * 640, k = r2() < 0.5 ? 'rgba(180,255,120,' : 'rgba(255,120,230,'; g.fillStyle = rad(g, x, y, 2.5, [k + '.9)', k + '0)']); g.fillRect(x - 3, y - 3, 6, 6) }
    })
    return [{ key: 'ag_xg', v: 50, alpha: 0.7, diepte: -50 }, { key: 'ag_sporen', v: 80, add: true, alpha: 0.7, diepte: 30 }]
  },

  /* ---- de eindbazen: romp, kern en onderdelen apart (b_<naam>...); b_kapot = een kapot onderdeel ---- */
  baas_titan() {
      this.teken('b_titan', 280, 104, g => {
        g.fillStyle = lin(g, 0, 0, 0, 104, ['#3b4252', '#181c24'])
        veelhoek(g, [140, 0, 196, 10, 278, 50, 268, 66, 206, 64, 188, 88, 92, 88, 74, 64, 12, 66, 2, 50, 84, 10]); g.fill()
        lijn(g, '#8590a6', 1, [84, 10, 2, 50]); lijn(g, '#5b6478', 1, [196, 10, 278, 50])
        g.fillStyle = lin(g, 100, 0, 180, 0, ['#262c38', '#4d5668', '#353d4c', '#262c38'])
        veelhoek(g, [140, 6, 180, 18, 176, 80, 104, 80, 100, 18]); g.fill()
        lijn(g, 'rgba(10,12,18,.85)', 0.8, [101, 40, 179, 40]); lijn(g, 'rgba(10,12,18,.85)', 0.8, [102, 62, 178, 62]); lijn(g, 'rgba(10,12,18,.85)', 0.8, [140, 6, 140, 34])
        for (const p of [[92, 20, 30, 50], [188, 20, 250, 50], [58, 34, 66, 60], [222, 34, 214, 60], [120, 20, 116, 40], [160, 20, 164, 40]]) lijn(g, 'rgba(10,12,18,.7)', 0.7, p)
        g.fillStyle = '#5e6a7e'; for (const [x, y] of [[110, 24], [170, 24], [110, 70], [170, 70], [60, 44], [220, 44]]) { g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill() }
        g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 5 * R; g.fillStyle = '#ffa53c'
        for (let i = 0; i < 5; i++) { g.fillRect(26 + i * 12, 53 - i * 4.4, 7, 1.8); g.fillRect(247 - i * 12, 53 - i * 4.4, 7, 1.8) }
        for (const x of [116, 130, 150, 164]) g.fillRect(x - 3, 9, 6, 2.5)
        g.restore()
        g.save(); g.shadowColor = '#ff3dd2'; g.shadowBlur = 4 * R; lijn(g, '#ff3dd2', 1.2, [2, 50, 12, 66, 74, 64, 92, 88, 188, 88, 206, 64, 268, 66, 278, 50]); g.restore()
        g.fillStyle = '#0b0d12'; g.beginPath(); g.arc(140, 80, 22, Math.PI, 0); g.fill()
        g.strokeStyle = '#ff3dd2'; g.lineWidth = 1; g.beginPath(); g.arc(140, 80, 22, Math.PI, 0); g.stroke()
        g.fillStyle = lin(g, 0, 44, 0, 74, ['#2a303c', '#14171e']); rondRect(g, 40, 44, 36, 28, 4); g.fill(); rondRect(g, 204, 44, 36, 28, 4); g.fill()
        g.strokeStyle = '#596579'; g.lineWidth = 0.7; rondRect(g, 40, 44, 36, 28, 4); g.stroke(); rondRect(g, 204, 44, 36, 28, 4); g.stroke()
        g.fillStyle = '#5ee7e0'; for (const x of [120, 160]) g.fillRect(x - 1, 84, 2, 3)
      }, '#ff3dd2', 6)
      this.teken('b_titan_kern', 46, 46, g => {
        g.fillStyle = rad(g, 23, 23, 21, ['#ffffff', '#ffb3f0', '#ff3dd2', '#7a0c6a', '#22061e']); g.beginPath(); g.arc(23, 23, 20, 0, 7); g.fill()
        g.fillStyle = '#12041e'; g.beginPath(); g.ellipse(23, 23, 2.6, 12, 0, 0, 7); g.fill()
        g.strokeStyle = '#ffd23c'; g.lineWidth = 1.4
        for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(23, 23, 21.5, i * Math.PI / 4 + 0.1, i * Math.PI / 4 + 0.6); g.stroke() }
      }, '#ff3dd2', 7)
      this.teken('b_titan_kanon', 34, 46, g => {
        g.fillStyle = '#14171e'; g.fillRect(9, 22, 6, 24); g.fillRect(19, 22, 6, 24)
        g.fillStyle = '#ffa53c'; g.fillRect(9, 43, 6, 3); g.fillRect(19, 43, 6, 3)
        g.fillStyle = lin(g, 0, 0, 34, 0, ['#2a303c', '#6a7488', '#2a303c']); rondRect(g, 3, 2, 28, 24, 4); g.fill()
        g.strokeStyle = '#ffd23c'; g.lineWidth = 1.2; rondRect(g, 3.5, 2.5, 27, 23, 4); g.stroke()
        lijn(g, 'rgba(10,12,18,.8)', 0.6, [5, 14, 29, 14])
        g.fillStyle = rad(g, 17, 9, 4, ['#ffffff', '#ff6b6b', '#7a0f1a']); g.beginPath(); g.arc(17, 9, 3.4, 0, 7); g.fill()
      }, '#ffd23c', 5)
      this.teken('b_kapot', 34, 46, g => {
        g.fillStyle = '#120f16'; veelhoek(g, [4, 4, 14, 2, 30, 6, 28, 22, 18, 26, 6, 22]); g.fill()
        g.fillStyle = '#2a2430'; veelhoek(g, [8, 8, 16, 6, 14, 14]); g.fill(); veelhoek(g, [20, 12, 27, 10, 26, 18]); g.fill()
        g.fillStyle = '#14171e'; g.fillRect(10, 24, 5, 10)
        g.save(); g.shadowColor = '#ff8a1a'; g.shadowBlur = 4 * R; g.fillStyle = '#ff8a1a'; g.fillRect(16, 14, 2, 2); g.fillRect(9, 18, 1.5, 1.5); g.restore()
      })
  },

  /* ZEPHYR: een reusachtige vliegende vleugel (bommenwerper) met twee motoren, een geschutstoren en de brug */
  baas_zephyr() {
    this.teken('b_zephyr', 300, 100, g => {
      g.fillStyle = lin(g, 0, 0, 0, 100, ['#3a414e', '#14171d'])
      veelhoek(g, [150, 0, 200, 14, 300, 62, 290, 74, 230, 70, 190, 96, 110, 96, 70, 70, 10, 74, 0, 62, 100, 14]); g.fill()
      lijn(g, '#9aa6ba', 1, [100, 14, 0, 62]); lijn(g, '#5b6478', 1, [200, 14, 300, 62])
      g.fillStyle = lin(g, 110, 0, 190, 0, ['#232832', '#4a5364', '#232832']); veelhoek(g, [150, 4, 178, 16, 172, 86, 128, 86, 122, 16]); g.fill()
      for (const p of [[100, 30, 30, 62], [200, 30, 270, 62], [128, 40, 172, 40], [130, 62, 170, 62], [60, 46, 80, 70], [240, 46, 220, 70]]) lijn(g, 'rgba(10,12,18,.75)', 0.7, p)
      g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 5 * R; g.fillStyle = '#ffa53c'
      for (let i = 0; i < 6; i++) { g.fillRect(118 + i * 12, 7, 6, 2) }
      g.restore()
      g.save(); g.shadowColor = '#ff4848'; g.shadowBlur = 5 * R; g.fillStyle = '#ff4848'; g.beginPath(); g.arc(4, 64, 2, 0, 7); g.fill(); g.restore()
      g.save(); g.shadowColor = '#5ee7e0'; g.shadowBlur = 5 * R; g.fillStyle = '#5ee7e0'; g.beginPath(); g.arc(296, 64, 2, 0, 7); g.fill(); g.restore()
      g.save(); g.shadowColor = '#7fd4ff'; g.shadowBlur = 3 * R; lijn(g, '#7fd4ff', 1, [0, 62, 10, 74, 70, 70, 110, 96, 190, 96, 230, 70, 290, 74, 300, 62]); g.restore()
      g.fillStyle = '#0b0d12'; rondRect(g, 66, 22, 36, 34, 6); g.fill(); rondRect(g, 198, 22, 36, 34, 6); g.fill()
    }, '#7fd4ff', 5)
    this.teken('b_zephyr_motor', 36, 40, g => {
      g.fillStyle = lin(g, 0, 0, 36, 0, ['#1c2029', '#7d8a9c', '#2a303c']); rondRect(g, 3, 2, 30, 36, 8); g.fill()
      g.fillStyle = '#0b0d12'; g.beginPath(); g.arc(18, 14, 9, 0, 7); g.fill()
      g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 6 * R; g.strokeStyle = '#ffa53c'; g.lineWidth = 1.2
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; lijn(g, '#ffa53c', 1.2, [18, 14, 18 + Math.cos(a) * 8, 14 + Math.sin(a) * 8]) }
      g.restore()
      g.fillStyle = '#ff4848'; g.fillRect(16, 31, 4, 3)
    }, '#ffa53c', 5)
    this.teken('b_zephyr_toren', 34, 38, g => {
      g.fillStyle = '#14171e'; g.fillRect(11, 18, 4, 20); g.fillRect(19, 18, 4, 20)
      g.fillStyle = '#ff4848'; g.fillRect(11, 35, 4, 3); g.fillRect(19, 35, 4, 3)
      g.fillStyle = rad(g, 14, 12, 16, ['#9aa6ba', '#4a5364', '#1c2029']); g.beginPath(); g.arc(17, 16, 13, 0, 7); g.fill()
      g.strokeStyle = '#7fd4ff'; g.lineWidth = 1; g.beginPath(); g.arc(17, 16, 13, 0, 7); g.stroke()
      g.fillStyle = rad(g, 17, 14, 4, ['#ffffff', '#ff6b6b', '#7a0f1a']); g.beginPath(); g.arc(17, 14, 3.4, 0, 7); g.fill()
    }, '#7fd4ff', 5)
    this.teken('b_zephyr_brug', 44, 30, g => {
      g.fillStyle = lin(g, 0, 0, 0, 30, ['#4a5364', '#1c2029']); veelhoek(g, [6, 4, 38, 4, 44, 16, 34, 28, 10, 28, 0, 16]); g.fill()
      g.fillStyle = lin(g, 0, 6, 0, 24, ['#e8ffff', '#5ee7e0', '#0e5866']); veelhoek(g, [10, 8, 34, 8, 38, 16, 30, 24, 14, 24, 6, 16]); g.fill()
      lijn(g, 'rgba(10,30,40,.8)', 0.8, [22, 8, 22, 24]); lijn(g, 'rgba(10,30,40,.8)', 0.8, [8, 16, 36, 16])
    }, '#5ee7e0', 6)
  },
  /* VORTEX: een draaiend ringstation met vier torens op de ring en een grote kern in het midden */
  baas_vortex() {
    this.teken('b_vortex', 200, 200, g => {
      g.save(); g.translate(100, 100)
      g.strokeStyle = '#2a303c'; g.lineWidth = 3
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; lijn(g, '#3a4252', 3, [Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 78, Math.sin(a) * 78]) }
      g.lineWidth = 22; g.strokeStyle = lin(g, -96, -96, 96, 96, ['#5e6a7e', '#2a303c', '#4b5466', '#1c2029']); g.beginPath(); g.arc(0, 0, 86, 0, 7); g.stroke()
      g.lineWidth = 1; g.strokeStyle = '#9aa6ba'; g.beginPath(); g.arc(0, 0, 97, 0, 7); g.stroke(); g.strokeStyle = '#1c2029'; g.beginPath(); g.arc(0, 0, 75, 0, 7); g.stroke()
      for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; lijn(g, 'rgba(10,12,18,.8)', 0.8, [Math.cos(a) * 76, Math.sin(a) * 76, Math.cos(a) * 96, Math.sin(a) * 96]) }
      g.shadowColor = '#b13cff'; g.shadowBlur = 5 * R
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + 0.13; g.fillStyle = i % 2 ? '#b13cff' : '#5ee7e0'; g.beginPath(); g.arc(Math.cos(a) * 86, Math.sin(a) * 86, 1.8, 0, 7); g.fill() }
      g.restore()
    }, '#b13cff', 6)
    this.teken('b_vortex_toren', 30, 30, g => {
      g.fillStyle = rad(g, 12, 11, 15, ['#9aa6ba', '#4a5364', '#1c2029']); g.beginPath(); g.arc(15, 15, 13, 0, 7); g.fill()
      g.strokeStyle = '#b6ff3c'; g.lineWidth = 1.1; g.beginPath(); g.arc(15, 15, 13, 0, 7); g.stroke()
      g.fillStyle = rad(g, 15, 15, 6, ['#ffffff', '#b6ff3c', '#2a5a14']); g.beginPath(); g.arc(15, 15, 5.5, 0, 7); g.fill()
    }, '#b6ff3c', 5)
    this.teken('b_vortex_kern', 58, 58, g => {
      g.fillStyle = rad(g, 29, 29, 28, ['#ffffff', '#e6c8ff', '#b13cff', '#4a1270', '#12041e']); g.beginPath(); g.arc(29, 29, 26, 0, 7); g.fill()
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(29, 29, 22 - i * 5, 8 + i * 3, i * 1.05, 0, 7); g.stroke() }
      g.fillStyle = '#12041e'; g.beginPath(); g.arc(29, 29, 5, 0, 7); g.fill()
    }, '#b13cff', 8)
  },
  /* REACTOR: de machinekamer bovenin het moederschip; vier generatoren beschermen de reactorkern */
  baas_reactor() {
    this.teken('b_reactor', 340, 110, g => {
      g.fillStyle = lin(g, 0, 0, 0, 110, ['#2a2e3a', '#14161d']); veelhoek(g, [0, 0, 340, 0, 340, 52, 300, 66, 210, 66, 190, 104, 150, 104, 130, 66, 40, 66, 0, 52]); g.fill()
      g.save(); g.beginPath(); g.rect(0, 0, 340, 12); g.clip()
      for (let i = -2; i < 60; i++) { g.fillStyle = i % 2 ? '#c9a21a' : '#141414'; veelhoek(g, [i * 8, 12, i * 8 + 8, 0, i * 8 + 16, 0, i * 8 + 8, 12]); g.fill() }
      g.restore()
      for (let x = 10; x < 330; x += 30) { g.fillStyle = '#1c1f28'; g.fillRect(x, 16, 22, 28); g.strokeStyle = '#3a3f4e'; g.lineWidth = 0.8; g.strokeRect(x + 0.5, 16.5, 21, 27) }
      g.save(); g.shadowColor = '#5ee7e0'; g.shadowBlur = 5 * R; g.fillStyle = '#5ee7e0'; g.fillRect(0, 48, 340, 1.4); g.restore()
      g.fillStyle = '#3a3f4e'; for (const y of [24, 34]) g.fillRect(0, y, 340, 2)
      g.save(); g.shadowColor = '#ffd23c'; g.shadowBlur = 4 * R; lijn(g, '#ffd23c', 1.2, [0, 52, 40, 66, 130, 66, 150, 104, 190, 104, 210, 66, 300, 66, 340, 52]); g.restore()
      g.fillStyle = '#0b0c10'; g.beginPath(); g.arc(170, 82, 28, 0, 7); g.fill()
    }, '#ffd23c', 5)
    this.teken('b_reactor_gen', 30, 38, g => {
      g.fillStyle = lin(g, 0, 0, 30, 0, ['#1c1f28', '#6a7488', '#1c1f28']); rondRect(g, 4, 2, 22, 34, 4); g.fill()
      g.save(); g.shadowColor = '#ffd23c'; g.shadowBlur = 5 * R; g.fillStyle = '#ffd23c'; for (let i = 0; i < 6; i++) g.fillRect(6, 7 + i * 4.5, 18, 1.6); g.restore()
      g.fillStyle = '#ff4848'; g.fillRect(13, 33, 4, 3)
    }, '#ffd23c', 5)
    this.teken('b_reactor_kern', 56, 56, g => {
      g.fillStyle = rad(g, 28, 28, 27, ['#ffffff', '#c8ffff', '#5ee7e0', '#0e5866', '#06161c']); g.beginPath(); g.arc(28, 28, 25, 0, 7); g.fill()
      g.strokeStyle = '#ffd23c'; g.lineWidth = 1.6; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(28, 28, 26.5, i * Math.PI / 3 + 0.15, i * Math.PI / 3 + 0.75); g.stroke() }
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.arc(28, 28, 12, 0, 7); g.stroke()
    }, '#5ee7e0', 8)
  },
  /* ZOGGOTH PRIME: een zwaar vlaggenschip met twee motoren, een geschutstoren en de kern */
  baas_zoggoth() {
    this.teken('b_zoggoth', 320, 130, g => {
      g.fillStyle = lin(g, 0, 0, 0, 130, ['#363c4a', '#111419'])
      veelhoek(g, [160, 0, 214, 10, 260, 6, 318, 34, 312, 60, 262, 72, 232, 108, 196, 126, 124, 126, 88, 108, 58, 72, 8, 60, 2, 34, 60, 6, 106, 10]); g.fill()
      lijn(g, '#9aa6ba', 1, [106, 10, 60, 6, 2, 34]); lijn(g, '#5b6478', 1, [214, 10, 260, 6, 318, 34])
      g.fillStyle = lin(g, 120, 0, 200, 0, ['#1f232c', '#4d5668', '#1f232c']); veelhoek(g, [160, 8, 196, 18, 206, 70, 186, 116, 134, 116, 114, 70, 124, 18]); g.fill()
      for (const p of [[124, 40, 196, 40], [116, 74, 204, 74], [160, 8, 160, 30], [60, 30, 112, 40], [260, 30, 208, 40], [70, 56, 110, 62], [250, 56, 210, 62]]) lijn(g, 'rgba(10,12,18,.8)', 0.8, p)
      g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 6 * R; g.fillStyle = '#ffa53c'
      for (let i = 0; i < 6; i++) { g.fillRect(70 + i * 7, 46 - i * 2, 4, 1.8); g.fillRect(246 - i * 7, 46 - i * 2, 4, 1.8) }
      for (const x of [134, 148, 172, 186]) g.fillRect(x - 3, 96, 6, 2.5)
      g.restore()
      g.fillStyle = '#c0283c'; veelhoek(g, [150, 20, 170, 20, 166, 30, 154, 30]); g.fill()
      g.save(); g.shadowColor = '#ff4848'; g.shadowBlur = 4 * R; lijn(g, '#ff4848', 1.1, [2, 34, 8, 60, 58, 72, 88, 108, 124, 126, 196, 126, 232, 108, 262, 72, 312, 60, 318, 34]); g.restore()
    }, '#ff4848', 6)
    this.teken('b_zog_motor', 40, 48, g => {
      g.fillStyle = lin(g, 0, 0, 40, 0, ['#1c2029', '#6a7488', '#1c2029']); rondRect(g, 4, 0, 32, 40, 6); g.fill()
      g.fillStyle = '#0b0d12'; rondRect(g, 9, 30, 22, 14, 4); g.fill()
      g.fillStyle = lin(g, 0, 36, 0, 48, ['#ffffff', '#ffa53c', 'rgba(255,120,30,0)']); g.fillRect(11, 38, 18, 10)
      g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 4 * R; g.fillStyle = '#ffa53c'; for (let i = 0; i < 4; i++) g.fillRect(8, 6 + i * 5, 24, 1.4); g.restore()
    }, '#ffa53c', 6)
    this.teken('b_zog_toren', 38, 42, g => {
      g.fillStyle = '#14171e'; g.fillRect(12, 20, 5, 22); g.fillRect(21, 20, 5, 22)
      g.fillStyle = '#ff4848'; g.fillRect(12, 38, 5, 4); g.fillRect(21, 38, 5, 4)
      g.fillStyle = lin(g, 0, 0, 38, 0, ['#2a303c', '#7d8a9c', '#2a303c']); veelhoek(g, [8, 2, 30, 2, 36, 14, 30, 26, 8, 26, 2, 14]); g.fill()
      g.strokeStyle = '#ffa53c'; g.lineWidth = 1; veelhoek(g, [8, 2, 30, 2, 36, 14, 30, 26, 8, 26, 2, 14]); g.stroke()
      g.fillStyle = rad(g, 19, 13, 5, ['#ffffff', '#ffd23c', '#7a5608']); g.beginPath(); g.arc(19, 13, 4.5, 0, 7); g.fill()
    }, '#ffa53c', 5)
    this.teken('b_zog_kern', 48, 48, g => {
      g.fillStyle = rad(g, 24, 24, 23, ['#ffffff', '#ffc2c2', '#ff4848', '#7a0f1a', '#200408']); g.beginPath(); g.arc(24, 24, 21, 0, 7); g.fill()
      g.strokeStyle = '#ffa53c'; g.lineWidth = 1.4; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(24, 24, 22.5, i * Math.PI / 2 + 0.2, i * Math.PI / 2 + 1.2); g.stroke() }
      g.fillStyle = '#200408'; veelhoek(g, [24, 12, 27, 24, 24, 36, 21, 24]); g.fill()
    }, '#ff4848', 8)
  },
  /* ZWERMKONINGIN: een reusachtig insect met twee vleugels en een kop vol ogen */
  baas_koningin() {
    this.teken('b_koningin', 200, 160, g => {
      g.strokeStyle = '#3a1a0e'; g.lineWidth = 4; g.lineCap = 'round'
      for (const [x0, y0, x1, y1, x2, y2] of [[86, 70, 40, 90, 30, 130], [114, 70, 160, 90, 170, 130], [88, 84, 56, 112, 54, 150], [112, 84, 144, 112, 146, 150]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2); g.stroke() }
      g.fillStyle = lin(g, 70, 0, 130, 0, ['#4a1a0a', '#c0602a', '#4a1a0a'])
      for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(100, 8 + i * 13, 22 - i * 1.5, 9, 0, 0, 7); g.fill() }
      g.save(); g.shadowColor = '#b6ff3c'; g.shadowBlur = 5 * R; g.fillStyle = '#b6ff3c'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(90, 8 + i * 13, 1.5, 0, 7); g.fill(); g.beginPath(); g.arc(110, 8 + i * 13, 1.5, 0, 7); g.fill() } g.restore()
      g.fillStyle = rad(g, 96, 80, 34, ['#ffb36b', '#c0602a', '#5a2210']); g.beginPath(); g.ellipse(100, 84, 30, 26, 0, 0, 7); g.fill()
      lijn(g, 'rgba(40,10,4,.6)', 1, [74, 84, 126, 84]); lijn(g, 'rgba(40,10,4,.6)', 1, [100, 60, 100, 108])
    }, '#ff8a1a', 5)
    this.teken('b_kon_vleugel', 90, 60, g => {
      g.fillStyle = lin(g, 90, 0, 0, 60, ['rgba(180,255,220,.55)', 'rgba(120,200,180,.25)', 'rgba(255,170,100,.2)'])
      g.beginPath(); g.moveTo(88, 10); g.quadraticCurveTo(40, -6, 4, 18); g.quadraticCurveTo(20, 40, 50, 58); g.quadraticCurveTo(76, 44, 88, 22); g.closePath(); g.fill()
      g.strokeStyle = 'rgba(255,220,180,.8)'; g.lineWidth = 1; g.stroke()
      g.strokeStyle = 'rgba(120,50,20,.6)'; g.lineWidth = 0.8
      for (const [x, y] of [[10, 20], [26, 40], [48, 54], [30, 10], [60, 6]]) { g.beginPath(); g.moveTo(86, 16); g.quadraticCurveTo((86 + x) / 2, (16 + y) / 2 + 6, x, y); g.stroke() }
    }, '#b6ff3c', 4)
    this.teken('b_kon_kop', 48, 46, g => {
      g.fillStyle = '#3a1a0e'; veelhoek(g, [8, 34, 2, 46, 14, 40]); g.fill(); veelhoek(g, [40, 34, 46, 46, 34, 40]); g.fill()
      g.fillStyle = rad(g, 22, 18, 24, ['#ffb36b', '#c0602a', '#4a1a0a']); g.beginPath(); g.ellipse(24, 22, 20, 18, 0, 0, 7); g.fill()
      g.save(); g.shadowColor = '#b6ff3c'; g.shadowBlur = 5 * R
      for (const [x, y, r] of [[14, 20, 5], [34, 20, 5], [19, 30, 3], [29, 30, 3], [24, 12, 2.5]]) { g.fillStyle = rad(g, x - 1, y - 1, r, ['#ffffff', '#b6ff3c', '#2a5a14']); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill() }
      g.restore()
    }, '#ff8a1a', 6)
  },
  /* OVERLORD: een buitenaardse vesting op poten, met kanonnen, schildbollen en een kern */
  baas_overlord() {
    this.teken('b_overlord', 340, 150, g => {
      g.fillStyle = '#0d0410'
      for (const [x0, x1] of [[60, 20], [280, 320]]) { veelhoek(g, [x0 - 6, 70, x0 + 6, 70, x1 + 4, 148, x1 - 4, 148]); g.fill() }
      g.fillStyle = lin(g, 0, 0, 0, 150, ['#2a1030', '#12061a'])
      veelhoek(g, [170, 0, 230, 14, 300, 18, 338, 56, 300, 90, 240, 96, 214, 140, 126, 140, 100, 96, 40, 90, 2, 56, 40, 18, 110, 14]); g.fill()
      for (const [x, y] of [[40, 18], [300, 18], [170, 0]]) { g.fillStyle = '#3a1446'; veelhoek(g, [x - 6, y + 4, x, y - 12, x + 6, y + 4]); g.fill() }
      g.save(); g.shadowColor = '#ff3dd2'; g.shadowBlur = 5 * R; g.strokeStyle = '#ff3dd2'; g.lineWidth = 1.1
      g.beginPath(); g.moveTo(110, 30); g.lineTo(150, 30); g.lineTo(160, 46); g.lineTo(180, 46); g.lineTo(190, 30); g.lineTo(230, 30); g.stroke()
      g.beginPath(); g.moveTo(60, 60); g.lineTo(100, 60); g.lineTo(120, 80); g.moveTo(280, 60); g.lineTo(240, 60); g.lineTo(220, 80); g.stroke()
      for (const [x, y] of [[90, 44], [250, 44], [170, 22]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.stroke() }
      lijn(g, '#ff3dd2', 1.2, [2, 56, 40, 90, 100, 96, 126, 140, 214, 140, 240, 96, 300, 90, 338, 56])
      g.restore()
      g.fillStyle = '#05010a'; g.beginPath(); g.arc(170, 104, 32, 0, 7); g.fill()
    }, '#ff3dd2', 6)
    this.teken('b_ov_kanon', 40, 54, g => {
      g.fillStyle = '#0d0410'; veelhoek(g, [14, 24, 26, 24, 24, 54, 16, 54]); g.fill()
      g.save(); g.shadowColor = '#5ee7e0'; g.shadowBlur = 5 * R; g.fillStyle = '#5ee7e0'; g.fillRect(17, 48, 6, 4); g.restore()
      g.fillStyle = lin(g, 0, 0, 40, 0, ['#1a0820', '#5a2a6a', '#1a0820']); veelhoek(g, [20, 0, 38, 10, 34, 28, 20, 32, 6, 28, 2, 10]); g.fill()
      g.strokeStyle = '#ff3dd2'; g.lineWidth = 1; veelhoek(g, [20, 0, 38, 10, 34, 28, 20, 32, 6, 28, 2, 10]); g.stroke()
      g.fillStyle = rad(g, 20, 15, 5, ['#ffffff', '#5ee7e0', '#0e5866']); g.beginPath(); g.arc(20, 15, 4.5, 0, 7); g.fill()
    }, '#ff3dd2', 5)
    this.teken('b_ov_schild', 32, 32, g => {
      g.fillStyle = rad(g, 14, 13, 16, ['#ffffff', '#bfe6ff', '#3d9bff', '#0b1a3a']); g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill()
      g.strokeStyle = '#ff3dd2'; g.lineWidth = 1.2; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(16, 16, 14.5, i * 2.1, i * 2.1 + 1.3); g.stroke() }
    }, '#3d9bff', 7)
    this.teken('b_ov_kern', 62, 62, g => {
      g.fillStyle = rad(g, 31, 31, 30, ['#ffffff', '#ffb3f0', '#ff3dd2', '#5a0a50', '#12041e']); g.beginPath(); g.arc(31, 31, 28, 0, 7); g.fill()
      g.fillStyle = '#12041e'; g.beginPath(); g.ellipse(31, 31, 3.4, 16, 0, 0, 7); g.fill()
      g.strokeStyle = '#5ee7e0'; g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(31, 31, 29.5, i * Math.PI / 3 + 0.1, i * Math.PI / 3 + 0.7); g.stroke() }
    }, '#ff3dd2', 9)
  },
}

/* ---------- de eindbazen ----------
   Elke baas: een romp met losse onderdelen. Onderdelen met schild: true beschermen de kern: zolang er een heel is,
   krijgt de kern maar 20% schade (fase 1). Daarna fase 2; onder 35% van de kern fase 3 (WOEDEND).
   beweeg(b, W): plek van de baas; aanval(s, b, dt): wat hij doet (s = de scène, met hulpjes als s.elke, s.waaier,
   s.ring, s.raketten, s.laserStart, s.tapijt, s.regenV, s.zuurBoog, s.maak). baan: onderdelen die rond de kern draaien.
   blok: de romp houdt kogels tegen in dit gebied (halve breedte b, van boven tot onder t.o.v. het midden). */
const BAZEN = {
  titan: {
    naam: 'TITAN', teken: 'baas_titan', romp: 'b_titan', y: 118, blok: { b: 132, boven: 52, onder: 10 },
    delen: [
      { naam: 'kanonL', label: () => vertaal('KANON L'), dx: -82, dy: 16, key: 'b_titan_kanon', hp: 70, r: 18, schild: true },
      { naam: 'kanonR', label: () => vertaal('KANON R'), dx: 82, dy: 16, key: 'b_titan_kanon', hp: 70, r: 18, schild: true },
      { naam: 'kern', label: () => vertaal('KERN'), dx: 0, dy: 28, key: 'b_titan_kern', hp: 220, r: 21, kern: true, laserY: 16 },
    ],
    beweeg(b, W) { b.x = W / 2 + Math.sin(b.tb * 0.55) * W * 0.1 },
    aanval(s, b, dt) {
      const k = b.d.kern
      for (const d of [b.d.kanonL, b.d.kanonR]) if (!d.dood && s.elke(b, d.naam, 1.7, dt, d.dx > 0 ? 1.85 : 1)) s.waaier(d.x, d.y + 22, 3, 0.4, 150, 'orb')
      s.spiraal(b, 'sp', k.x, k.y, 120, b.fase === 3 ? 0.05 : 0.07, b.fase === 1 ? 4.5 : 6, 1.6, 'orb', b.fase === 3 ? 'orbO' : null)
      if (b.fase >= 2) {
        if (s.elke(b, 'ring', b.fase === 3 ? 1.6 : 2.6, dt)) s.ring(k.x, k.y, 14, 115, 'orbO', b.t * 0.7)
        if (s.elke(b, 'laser', b.fase === 3 ? 4 : 6, dt, 1.5)) s.laserStart(b, k)
        if (s.elke(b, 'hulp', 9, dt, 6)) for (let i = 0; i < 3; i++) s.maak('dart', { x: 60 + i * 120, fase: i })
      }
    },
  },
  zephyr: {
    naam: 'ZEPHYR', teken: 'baas_zephyr', romp: 'b_zephyr', y: 112, blok: { b: 140, boven: 50, onder: 20 },
    delen: [
      { naam: 'motorL', label: () => vertaal('MOTOR L'), dx: -66, dy: -11, key: 'b_zephyr_motor', hp: 80, r: 18, schild: true },
      { naam: 'motorR', label: () => vertaal('MOTOR R'), dx: 66, dy: -11, key: 'b_zephyr_motor', hp: 80, r: 18, schild: true },
      { naam: 'toren', label: () => vertaal('TOREN'), dx: 0, dy: 48, key: 'b_zephyr_toren', hp: 75, r: 17, schild: true },
      { naam: 'kern', label: () => vertaal('BRUG'), dx: 0, dy: 12, key: 'b_zephyr_brug', hp: 240, r: 19, kern: true, laserY: 12 },
    ],
    beweeg(b, W) { b.x = W / 2 + Math.sin(b.tb * 0.45) * W * 0.12; b.y = b.basisY + Math.sin(b.tb * 0.9) * 8 },
    aanval(s, b, dt) {
      const k = b.d.kern, t = b.d.toren
      for (const d of [b.d.motorL, b.d.motorR]) if (!d.dood && s.elke(b, d.naam, 3.2, dt, d.dx > 0 ? 2.6 : 1)) s.raketten(d.x, d.y + 20, 1)
      if (!t.dood && s.elke(b, 'toren', 1.5, dt, 0.8)) { b.salvo = 3; b.klok.salvoTik = 0 }
      if (b.salvo > 0 && !t.dood && s.elke(b, 'salvoTik', 0.12, dt)) { b.salvo--; s.waaier(t.x, t.y + 20, 1, 0, 190, 'naald') }
      if (b.fase === 1) { if (s.elke(b, 'ring', 4, dt, 2)) s.ring(k.x, k.y, 10, 100, 'orbB', b.t) }
      else {
        if (s.elke(b, 'tapijt', b.fase === 3 ? 2.4 : 3.5, dt, 1)) s.tapijt(b.x, b.y + 30, 240, b.fase === 3 ? 9 : 7)
        s.spiraal(b, 'sp', k.x, k.y, 115, 0.08, 5, 1.4, 'orbB', null)
        if (b.fase === 3 && s.elke(b, 'kraket', 3, dt, 1.5)) s.raketten(k.x, k.y + 16, 2)
      }
    },
  },
  vortex: {
    naam: 'VORTEX', teken: 'baas_vortex', romp: 'b_vortex', y: 150, draai: 0.3, blok: null,
    delen: [
      { naam: 'toren1', label: () => vertaal('TOREN'), baan: { straal: 86, hoek: 0 }, key: 'b_vortex_toren', hp: 55, r: 14, schild: true },
      { naam: 'toren2', label: () => vertaal('TOREN'), baan: { straal: 86, hoek: Math.PI / 2 }, key: 'b_vortex_toren', hp: 55, r: 14, schild: true },
      { naam: 'toren3', label: () => vertaal('TOREN'), baan: { straal: 86, hoek: Math.PI }, key: 'b_vortex_toren', hp: 55, r: 14, schild: true },
      { naam: 'toren4', label: () => vertaal('TOREN'), baan: { straal: 86, hoek: Math.PI * 1.5 }, key: 'b_vortex_toren', hp: 55, r: 14, schild: true },
      { naam: 'kern', label: () => vertaal('KERN'), dx: 0, dy: 0, key: 'b_vortex_kern', hp: 300, r: 24, kern: true },
    ],
    beweeg(b, W) { b.x = W / 2 + Math.sin(b.tb * 0.3) * 40 },
    aanval(s, b, dt) {
      const k = b.d.kern
      b.delen.forEach((d, i) => { if (!d.kern && !d.dood && s.elke(b, d.naam, 2.4, dt, 1 + i * 0.6)) s.waaier(d.x, d.y, 2, 0.25, 135, 'orbG') })
      if (b.fase === 1) s.spiraal(b, 'sp', k.x, k.y, 95, 0.09, 5, 1.6, 'orbB', null)
      else {
        s.spiraal(b, 'sp', k.x, k.y, 110, b.fase === 3 ? 0.05 : 0.07, 3, 1.8, 'orbB', 'orb')
        if (s.elke(b, 'ring', b.fase === 3 ? 2 : 3, dt)) s.ring(k.x, k.y, 12, 105, 'orbG', b.t)
        if (b.fase === 3 && s.elke(b, 'mijnen', 6, dt, 2)) for (let i = 0; i < 2; i++) s.maak('mijn', { x: 90 + i * 180, fase: i })
      }
    },
  },
  reactor: {
    naam: 'REACTOR', teken: 'baas_reactor', romp: 'b_reactor', y: 100, blok: { b: 170, boven: 55, onder: 15 },
    delen: [
      { naam: 'gen1', label: () => vertaal('GENERATOR'), dx: -128, dy: 22, key: 'b_reactor_gen', hp: 55, r: 15, schild: true },
      { naam: 'gen2', label: () => vertaal('GENERATOR'), dx: -64, dy: 22, key: 'b_reactor_gen', hp: 55, r: 15, schild: true },
      { naam: 'gen3', label: () => vertaal('GENERATOR'), dx: 64, dy: 22, key: 'b_reactor_gen', hp: 55, r: 15, schild: true },
      { naam: 'gen4', label: () => vertaal('GENERATOR'), dx: 128, dy: 22, key: 'b_reactor_gen', hp: 55, r: 15, schild: true },
      { naam: 'kern', label: () => vertaal('KERN'), dx: 0, dy: 27, key: 'b_reactor_kern', hp: 320, r: 25, kern: true, laserY: 20 },
    ],
    beweeg(b, W) { b.x = W / 2 + Math.sin(b.tb * 9) * (b.fase === 3 ? 1.2 : 0.4) },
    aanval(s, b, dt) {
      const k = b.d.kern
      b.delen.forEach((d, i) => { if (!d.kern && !d.dood && s.elke(b, d.naam, 2.2, dt, 0.8 + i * 0.5)) s.waaier(d.x, d.y + 18, 2, 0.3, 140, 'orbO') })
      if (b.fase === 1) { if (s.elke(b, 'ring', 3.5, dt, 2)) s.ring(k.x, k.y, 8, 100, 'orbB', b.t) }
      else {
        if (s.elke(b, 'laser', b.fase === 3 ? 3.5 : 5, dt, 1)) s.laserStart(b, k)
        if (s.elke(b, 'ring', b.fase === 3 ? 1.8 : 2.4, dt)) s.ring(k.x, k.y, 12, 110, 'orbB', b.t)
        if (s.elke(b, 'regen', b.fase === 3 ? 2.5 : 4, dt, 2)) s.regenV(b.fase === 3 ? 10 : 6, 'orbO', 150)
        if (b.fase === 3) s.spiraal(b, 'sp', k.x, k.y, 120, 0.07, 4, 1.4, 'orb', null)
      }
    },
  },
  zoggoth: {
    naam: 'ZOGGOTH PRIME', teken: 'baas_zoggoth', romp: 'b_zoggoth', y: 118, blok: { b: 150, boven: 64, onder: 18 },
    delen: [
      { naam: 'motorL', label: () => vertaal('MOTOR L'), dx: -112, dy: 8, key: 'b_zog_motor', hp: 90, r: 19, schild: true },
      { naam: 'motorR', label: () => vertaal('MOTOR R'), dx: 112, dy: 8, key: 'b_zog_motor', hp: 90, r: 19, schild: true },
      { naam: 'toren', label: () => vertaal('TOREN'), dx: 0, dy: 56, key: 'b_zog_toren', hp: 90, r: 18, schild: true, laserY: 20 },
      { naam: 'kern', label: () => vertaal('KERN'), dx: 0, dy: 16, key: 'b_zog_kern', hp: 360, r: 22, kern: true, laserY: 14 },
    ],
    beweeg(b, W) { b.x = W / 2 + Math.sin(b.tb * 0.35) * W * 0.1 },
    aanval(s, b, dt) {
      const k = b.d.kern, t = b.d.toren
      for (const d of [b.d.motorL, b.d.motorR]) if (!d.dood && s.elke(b, d.naam, 3, dt, d.dx > 0 ? 2.5 : 1)) s.raketten(d.x, d.y + 22, 1)
      if (!t.dood) {
        if (s.elke(b, 'toren', 1.8, dt, 0.6)) s.waaier(t.x, t.y + 20, 5, 0.7, 150, 'orb')
        if (s.elke(b, 'laserT', 6, dt, 3)) s.laserStart(b, t)
      }
      if (b.fase === 1) { if (s.elke(b, 'ring', 4, dt, 2)) s.ring(k.x, k.y, 10, 95, 'orbO', b.t) }
      else {
        if (s.elke(b, 'ring', b.fase === 3 ? 1.6 : 2.2, dt)) s.ring(k.x, k.y, 16, 115, 'orbO', b.t * 0.8)
        if (s.elke(b, 'hulp', 8, dt, 3)) for (let i = 0; i < 3; i++) s.maak('dart', { x: 70 + i * 110, fase: i })
        s.spiraal(b, 'sp', k.x, k.y, 120, 0.07, 5, 1.6, 'orb', b.fase === 3 ? 'orbO' : null)
        if (b.fase === 3 && s.elke(b, 'laserK', 4, dt, 1)) s.laserStart(b, k)
      }
    },
  },
  koningin: {
    naam: 'ZWERMKONINGIN', teken: 'baas_koningin', romp: 'b_koningin', y: 120, blok: { b: 34, boven: 80, onder: 40 },
    delen: [
      { naam: 'vleugelL', label: () => vertaal('VLEUGEL L'), dx: -86, dy: -14, key: 'b_kon_vleugel', spiegel: false, hp: 85, r: 26, schild: true, fladder: true },
      { naam: 'vleugelR', label: () => vertaal('VLEUGEL R'), dx: 86, dy: -14, key: 'b_kon_vleugel', spiegel: true, hp: 85, r: 26, schild: true, fladder: true },
      { naam: 'kern', label: () => vertaal('KOP'), dx: 0, dy: 62, key: 'b_kon_kop', hp: 330, r: 22, kern: true },
    ],
    beweeg(b, W) { b.x = W / 2 + Math.sin(b.tb * 0.5) * W * 0.13; b.y = b.basisY + Math.sin(b.tb * 1.0) * 14 },
    aanval(s, b, dt) {
      const k = b.d.kern
      for (const d of [b.d.vleugelL, b.d.vleugelR]) if (!d.dood && s.elke(b, d.naam, 2.6, dt, d.dx > 0 ? 2.3 : 1)) s.zuurBoog(d.x, d.y + 10, 3)
      if (b.fase === 1) { if (s.elke(b, 'ring', 3.5, dt, 1.5)) s.ring(k.x, k.y, 10, 95, 'orbG', b.t) }
      else {
        if (s.elke(b, 'zwerm', b.fase === 3 ? 5 : 7, dt, 2)) for (let i = 0; i < 8; i++) s.maak('zwerm', { kant: i % 2 ? 1 : -1, y: 80 + (i % 4) * 25, fase: i * 0.5 })
        if (s.elke(b, 'ring', b.fase === 3 ? 1.8 : 2.6, dt)) s.ring(k.x, k.y, 14, 110, 'orbG', b.t)
        s.spiraal(b, 'sp', k.x, k.y, 110, 0.08, 5, 1.5, 'orbG', null)
        if (b.fase === 3 && s.elke(b, 'zuurK', 2.5, dt, 1)) s.zuurBoog(k.x, k.y + 10, 5)
      }
    },
  },
  overlord: {
    naam: 'OVERLORD', teken: 'baas_overlord', romp: 'b_overlord', y: 122, blok: { b: 160, boven: 72, onder: 20 },
    delen: [
      { naam: 'kanonL', label: () => vertaal('KANON L'), dx: -122, dy: 34, key: 'b_ov_kanon', hp: 100, r: 19, schild: true },
      { naam: 'kanonR', label: () => vertaal('KANON R'), dx: 122, dy: 34, key: 'b_ov_kanon', hp: 100, r: 19, schild: true },
      { naam: 'schildL', label: () => vertaal('SCHILD'), dx: -56, dy: 18, key: 'b_ov_schild', hp: 80, r: 15, schild: true },
      { naam: 'schildR', label: () => vertaal('SCHILD'), dx: 56, dy: 18, key: 'b_ov_schild', hp: 80, r: 15, schild: true },
      { naam: 'kern', label: () => vertaal('KERN'), dx: 0, dy: 29, key: 'b_ov_kern', hp: 460, r: 27, kern: true, laserY: 22 },
    ],
    beweeg(b, W) { b.x = W / 2 + Math.sin(b.tb * 0.28) * W * 0.08 },
    aanval(s, b, dt) {
      const k = b.d.kern
      for (const d of [b.d.kanonL, b.d.kanonR]) if (!d.dood) {
        if (s.elke(b, d.naam, 2, dt, d.dx > 0 ? 1.8 : 0.8)) s.waaier(d.x, d.y + 24, 5, 0.6, 150, 'orb')
        if (s.elke(b, d.naam + 'r', 4.5, dt, d.dx > 0 ? 3.5 : 2)) s.raketten(d.x, d.y + 24, 1)
      }
      for (const d of [b.d.schildL, b.d.schildR]) if (!d.dood && s.elke(b, d.naam, 3, dt, d.dx > 0 ? 2.2 : 1.2)) s.ring(d.x, d.y, 10, 100, 'orbB', b.t)
      if (b.fase === 1) s.spiraal(b, 'sp', k.x, k.y, 100, 0.09, 5, 1.4, 'orb', null)
      else {
        if (s.elke(b, 'laser', b.fase === 3 ? 3 : 4.5, dt, 1)) s.laserStart(b, k)
        s.spiraal(b, 'sp', k.x, k.y, 120, b.fase === 3 ? 0.05 : 0.07, 3.5, 1.8, 'orb', 'orbB')
        if (s.elke(b, 'lopers', 9, dt, 4)) for (let i = 0; i < 2; i++) s.maak('loper', { x: 80 + i * 200 })
        if (b.fase === 3) {
          if (s.elke(b, 'regen', 2.6, dt, 1)) s.regenV(10, 'orbO', 155)
          if (s.elke(b, 'ring', 2, dt)) s.ring(k.x, k.y, 16, 115, 'orbB', b.t)
        }
      }
    },
  },
}

/* soorten die per level een eigen kleur krijgen (texturen soort_palet); de rest is overal gelijk */
const KLEURSOORT = new Set(['dart', 'zwaai', 'schutter', 'kolos', 'tank', 'loop', 'muurkanon', 'paal', 'zwerm', 'spuger', 'loper'])
/* omgevingen met een grond of wolken onder je: daar hebben schepen een schaduw */
const MET_SCHADUW = new Set(['stad', 'lucht', 'schip', 'alienlucht', 'aliengrond'])

/* ================= het spel ================= */
export async function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief, solo, scoreService: scoreServiceKeuze }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (!inhoud) return
  if (typeof isActief !== 'function') isActief = () => true
  if (titel) titel.textContent = '🚀 Neon Raiders'
  if (getComputedStyle(inhoud).position === 'static') inhoud.style.position = 'relative'
  zetStijl()

  let autovuur = false
  try { autovuur = localStorage.getItem('nr-autovuur') === 'aan' } catch (e) {}
  let bereikt = 1   // hoogste level dat je ooit bereikt hebt (op dit toestel)
  try { bereikt = Math.min(AANTAL_LEVELS, Math.max(1, parseInt(localStorage.getItem('nr-bereikt'), 10) || 1)) } catch (e) {}
  // v194: samen spelen (vanuit de chat). De uitnodiger is speler 1 (cyaan) en de scheidsrechter; de ander speler 2 (roze).
  const samen = !!(spelKanaal && typeof spelKanaal.on === 'function' && typeof spelKanaal.send === 'function')
  const leider = !samen || !!benIkSpeler1
  const NAAMV = (String(vriendNaam || '').trim().toUpperCase().slice(0, 10)) || (leider ? 'P2' : 'P1')
  const IKP = leider ? 'P1' : 'P2'
  const wrap = document.createElement('div')
  wrap.className = 'nr'
  wrap.innerHTML = `
    <div class="veld">
      <button type="button" class="tegel" aria-label="${vertaal('Wapen wisselen of power-up gebruiken')}" aria-expanded="false">
        <canvas class="tIcoon"></canvas><span class="stip"><i></i><i></i><i></i></span><span class="extra"></span>
      </button>
      <div class="arsenaal" hidden></div>
      <div class="hud" aria-hidden="true"><div class="scoreRij"><span class="p1">P1</span><span class="score">0000000</span></div><div class="combo"></div><div class="levens"></div><div class="anderRij" hidden><span class="aNaam"></span><span class="aScore"></span><span class="aLevens"></span></div></div>
      <div class="meldbalk" aria-live="polite"></div><span class="hoek l"></span><span class="hoek r"></span>
      <div class="baas" hidden aria-hidden="true"><span class="baasNaam"></span><div class="balk"><i></i></div></div>
      <div class="bord" aria-live="polite"></div>
      <div class="laag">
        <div>
          <h1>NEON<span>RAIDERS</span></h1>
          <div class="sub">${vertaal('LEVEL {n} · {naam}', { n: 1, naam: LEVELS[1].naam() })}</div>
          <p class="uitleg">${vertaal('Sleep met één vinger om te vliegen. Tik of houd een tweede vinger op het scherm om te schieten.')}</p>
          <p class="uitleg2">${vertaal('De tegel linksboven: wapen wisselen of een power-up gebruiken.')}</p>
          <p class="record"></p>
          <p class="rol"></p>
          <p class="muisUitleg"></p>
          <div class="knoppen"><button type="button" class="knop startKnop"${samen ? (leider ? ' disabled' : ' hidden') : ''}>START</button><button type="button" class="knop tweede verderKnop" hidden></button></div>
          <div><button type="button" class="klein autoKnop">${autovuur ? vertaal('AUTOVUUR: AAN') : vertaal('AUTOVUUR: UIT')}</button><button type="button" class="klein geluidKnop">${GELUID.staatAan() ? vertaal('GELUID: AAN') : vertaal('GELUID: UIT')}</button><button type="button" class="klein scoresKnop">${vertaal('Scores')}</button></div>
        </div>
      </div>
    </div>`
  inhoud.appendChild(wrap)

  const veld = wrap.querySelector('.veld')
  const laag = wrap.querySelector('.laag')
  const h1 = laag.querySelector('h1')
  const sub = laag.querySelector('.sub')
  const uitleg = laag.querySelector('.uitleg')
  const uitleg2 = laag.querySelector('.uitleg2')
  const recordVak = laag.querySelector('.record')
  const startKnop = laag.querySelector('.startKnop')
  const verderKnop = laag.querySelector('.verderKnop')
  let verderBediening = null, opnieuwScherm = false
  const autoKnop = laag.querySelector('.autoKnop')
  const geluidKnop = laag.querySelector('.geluidKnop')
  const scoresKnop = laag.querySelector('.scoresKnop')
  const tegel = wrap.querySelector('.tegel')
  const tegelIcoon = tegel.querySelector('.tIcoon')
  const tegelStip = tegel.querySelectorAll('.stip i')
  const tegelExtra = tegel.querySelector('.extra')
  const arsenaal = wrap.querySelector('.arsenaal')
  const scoreVak = wrap.querySelector('.score')
  const p1Vak = wrap.querySelector('.p1')
  const comboVak = wrap.querySelector('.combo')
  const levensVak = wrap.querySelector('.levens')
  const baasVak = wrap.querySelector('.baas')
  const baasNaamVak = baasVak.querySelector('.baasNaam')
  const baasBalk = baasVak.querySelector('.balk i')
  const bordVak = wrap.querySelector('.bord')
  const balkVak = wrap.querySelector('.meldbalk')
  const rolVak = laag.querySelector('.rol')
  const anderRij = wrap.querySelector('.anderRij')
  if (!leider) { p1Vak.classList.add('p2'); levensVak.classList.add('p2') } else anderRij.classList.add('p2')
  if (samen) {
    anderRij.classList.toggle('p1', !leider)
    anderRij.querySelector('.aNaam').textContent = NAAMV
    sub.textContent = vertaal('SAMEN MET {naam}', { naam: NAAMV })
  }

  try { await laadPhaser() } catch (e) {
    wrap.innerHTML = '<p class="fout">' + vertaal('Het spel kon niet laden.<br>Controleer je verbinding en probeer opnieuw.') + '</p>'
    return
  }
  if (!isActief() || !wrap.isConnected) { wrap.remove(); return }
  const Phaser = window.Phaser

  /* ---------- samen spelen: de lijn naar de ander (spelnet.js) ---------- */
  let net = null, ronde = 0
  let partnerKlaar = !samen, laatsteKlaar = 0, netModus = samen ? 'zoeken' : 'alleen', verbindGedaan = false, klaarKlok = 0
  if (samen) {
    try {
      const { maakSpelNet } = await import('./spelnet.js?v=194')
      net = maakSpelNet({ spelKanaal, host: leider, naam: 'nr', isActief: () => isActief() && wrap.isConnected,
        opBericht: ontvangBericht, opModus: m => { netModus = m; werkStartscherm() } })
    } catch (e) {
      wrap.innerHTML = '<p class="fout">' + vertaal('Het spel kon niet laden.<br>Controleer je verbinding en probeer opnieuw.') + '</p>'
      return
    }
    if (!isActief() || !wrap.isConnected) { net.sluit(); wrap.remove(); return }
  }
  function ontvangBericht(m) {
    if (!isActief() || !wrap.isConnected) return
    if (m.t === 'klaar') {                       // de ander staat op het startscherm (alleen de uitnodiger let erop)
      if (!leider) return
      laatsteKlaar = performance.now()
      if (!partnerKlaar && !aftellen) { partnerKlaar = true; werkStartscherm() }
      if (!verbindGedaan) { verbindGedaan = true; net.verbind() }
      return
    }
    if (m.t === 'start') {                       // de uitnodiger start (of opnieuw)
      if (leider || !((m.r | 0) > ronde)) return
      ronde = m.r | 0
      startRonde(m.l | 0)
      return
    }
    // de uitnodiger speelt al (zijn startbericht kwam niet aan): meedoen in zijn level
    if (m.t === 's' && !leider && (m.r | 0) > ronde && !aftellen && !laag.hidden) { ronde = m.r | 0; startRonde(m.l | 0); return }
    if (huidige && huidige.samen) huidige.ontvang(m)
  }
  function modusTekst() {
    return netModus === 'direct' ? vertaal('RECHTSTREEKS VERBONDEN') : netModus === 'turn' ? vertaal('VERBONDEN VIA DE SERVER')
      : netModus === 'supabase' ? vertaal('VERBONDEN (RESERVE)') : vertaal('VERBINDING ZOEKEN…')
  }
  function werkStartscherm() {
    if (!samen) return
    if (leider) {
      const klaar = partnerKlaar && netModus !== 'zoeken'
      startKnop.disabled = !klaar
      verderKnop.disabled = !klaar
      if (!klaar) verderBediening?.cancel()
      rolVak.textContent = partnerKlaar ? modusTekst() : vertaal('WACHT OP {naam}', { naam: NAAMV })
    } else {
      startKnop.hidden = true; verderKnop.hidden = true
      rolVak.textContent = vertaal('{naam} START HET SPEL', { naam: NAAMV }) + (netModus !== 'zoeken' ? ' · ' + modusTekst() : '')
    }
  }

  let W = 360, H = 640
  let spel = null, huidige = null, beginLevel = 1
  const scoreService = scoreServiceKeuze || maakNeonScoreService({ supabase })
  const scorebord = maakNeonScorebord({ service: scoreService, T: vertaal,
    isActief: () => isActief() && wrap.isConnected, onOpen: () => { wisBesturing(); verderBediening?.cancel() } })
  scoresKnop.addEventListener('click', e => { e.stopPropagation(); scorebord.open() })

  /* ---------- indeling: een staand veld dat in de ruimte past ---------- */
  function indeling() {
    const volB = wrap.clientWidth - 16, volH = wrap.clientHeight - 60
    let vh = volH, vb = Math.min(volB, Math.round(vh * 0.5625))
    if (vb < vh * 0.45) vh = Math.round(vb / 0.45)
    vb = Math.max(160, vb); vh = Math.max(280, vh)
    veld.style.width = vb + 'px'
    veld.style.height = vh + 'px'
  }
  indeling()
  window.addEventListener('resize', indeling)
  window.addEventListener('orientationchange', indeling)

  function tekenLevens(n) {
    const schip = '<svg viewBox="0 0 12 14"><path fill="' + (leider ? '#5ee7e0' : '#ff5d9e') + '" d="M6 0L7.6 4 7.8 8 12 11 12 12.5 7.8 11.5 7 14H5L4.2 11.5 0 12.5V11L4.2 8 4.4 4Z"/></svg>'
    let uit = ''
    for (let i = 0; i < Math.max(0, Math.min(n, 6)); i++) uit += schip
    levensVak.innerHTML = uit
  }

  /* ---------- bediening: vinger, muis, toetsen ---------- */
  const vingers = new Map()   // pointerId -> { rol: 'stuur' | 'vuur', x, y }
  let toets = { l: 0, r: 0, o: 0, n: 0, vuur: 0 }
  let muisOpslag
  try { muisOpslag = window.localStorage } catch (e) {}
  const muisBesturing = maakNeonMuis({ opslag: muisOpslag })
  const muisUitleg = laag.querySelector('.muisUitleg')
  function toonMuisBesturing() {
    muisUitleg.textContent = (muisBesturing.modus === 'volgen'
      ? vertaal('MUIS: VOLGEN · Linkermuisknop = schieten.')
      : vertaal('MUIS: SLEPEN · Houd de linkermuisknop ingedrukt om te vliegen en schieten.')) + ' ' +
      vertaal('Dubbelklik op je eigen schip om de muisstand te wisselen.')
  }
  toonMuisBesturing()
  function stuurVinger() { for (const [id, v] of vingers) if (v.rol === 'stuur') return id; return null }
  function schaal() { return W / Math.max(1, veld.clientWidth) }
  function wereldPunt(e) {
    const canvas = veld.querySelector(':scope > canvas')
    return muisPunt(e, (canvas || veld).getBoundingClientRect(), W, H)
  }
  function wisBesturing() {
    vingers.clear(); muisBesturing.leeg()
    for (const code of Object.keys(toets)) toets[code] = 0
  }
  veld.addEventListener('pointerdown', e => {
    if (e.target.closest('.tegel,.arsenaal,.laag')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    GELUID.wek()
    try { veld.setPointerCapture(e.pointerId) } catch (x) {}
    const muis = e.pointerType === 'mouse'
    muisBesturing.neer(e, wereldPunt(e))
    if (!muis || muisBesturing.modus === 'slepen') {
      const rol = (stuurVinger() === null) ? 'stuur' : 'vuur'
      vingers.set(e.pointerId, { rol, x: e.clientX, y: e.clientY, muis })
    }
    if (huidige && huidige.pauze) huidige.hervat()
  })
  veld.addEventListener('pointermove', e => {
    if (e.target.closest('.tegel,.arsenaal,.laag')) return
    muisBesturing.beweeg(e, wereldPunt(e))
    const v = vingers.get(e.pointerId); if (!v) return
    if (v.muis && !(e.buttons & 1)) { vingers.delete(e.pointerId); return }
    if (v.rol === 'stuur' && huidige) huidige.duw((e.clientX - v.x) * schaal() * 1.15, (e.clientY - v.y) * schaal() * 1.15)
    v.x = e.clientX; v.y = e.clientY
  })
  const los = e => { vingers.delete(e.pointerId); muisBesturing.los(e) }
  veld.addEventListener('pointerup', los)
  veld.addEventListener('pointercancel', e => { vingers.delete(e.pointerId); muisBesturing.leeg() })
  veld.addEventListener('lostpointercapture', e => { vingers.delete(e.pointerId); muisBesturing.verlorenVangst() })
  veld.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !veld.hasPointerCapture(e.pointerId)) muisBesturing.leeg() })
  veld.addEventListener('dblclick', e => {
    if (!huidige || !laag.hidden || huidige.voorbij || huidige.uit || huidige.pauze || e.target.closest('.tegel,.arsenaal,.laag')) return
    const schip = huidige.speler
    if (!muisBesturing.wissel(e, wereldPunt(e), { x: schip.x, y: schip.y, width: schip.displayWidth, height: schip.displayHeight })) return
    e.preventDefault()
    wisBesturing(); toonMuisBesturing()
    balk(muisBesturing.modus === 'volgen' ? vertaal('MUIS: VOLGEN · Linkermuisknop = schieten.') : vertaal('MUIS: SLEPEN · Ingedrukt houden = vliegen en schieten.'), '#5ee7e0', 3500)
  })
  /* iOS: geen zoom of tekstselectie bij dubbeltikken in het veld */
  const stopTouch = e => { if (e.target.closest('.laag button')) return; e.preventDefault() }
  veld.addEventListener('touchstart', stopTouch, { passive: false })
  veld.addEventListener('touchend', stopTouch, { passive: false })
  function vuurtNu() {
    if (autovuur || toets.vuur) return true
    if (muisBesturing.modus === 'volgen' && muisBesturing.vuurt) return true
    for (const v of vingers.values()) if (v.rol === 'vuur' || v.muis) return true
    return false
  }
  const TOETS = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'o', KeyW: 'o', ArrowDown: 'n', KeyS: 'n', Space: 'vuur', KeyJ: 'vuur' }
  function toetsNeer(e) {
    if (!isActief() || !wrap.isConnected) return
    if (document.querySelector('.nr-scoreboard[open]')) return
    GELUID.wek()
    if (TOETS[e.code]) { toets[TOETS[e.code]] = 1; if (TOETS[e.code] !== 'vuur') muisBesturing.stopVolgen(); if (laag.hidden) e.preventDefault() }
    if (e.code === 'KeyQ' || e.code === 'Tab') { e.preventDefault(); if (laag.hidden) wisselArsenaal() }
    if (/^Digit[1-6]$/.test(e.code) && !arsenaal.hidden) { const k = arsenaal.querySelectorAll('button')[+e.code.slice(5) - 1]; if (k && !k.disabled) k.click() }
    if (e.code === 'Escape' && !arsenaal.hidden) sluitArsenaal()
  }
  function toetsOp(e) { if (TOETS[e.code]) toets[TOETS[e.code]] = 0 }
  window.addEventListener('keydown', toetsNeer)
  window.addEventListener('keyup', toetsOp)
  window.addEventListener('blur', wisBesturing)

  /* ---------- de tegel en het arsenaal ---------- */
  let arsenaalKlok = null
  function werkTegelBij() {
    const s = huidige
    const wapen = s ? s.wapen : 'puls', niv = s ? s.niveau[wapen] || 1 : 1
    tekenIcoon(tegelIcoon, wapen, 4)
    tegelStip.forEach((el, i) => el.classList.toggle('aan', i < niv))
    const extra = s ? (s.voorraad.bom || 0) + (s.voorraad.schild || 0) : 0
    tegelExtra.textContent = extra ? '+' + extra : ''
    tegel.style.borderColor = KLEUR[wapen]
  }
  function bouwArsenaal() {
    const s = huidige; if (!s) return
    const namen = NAAM()
    arsenaal.innerHTML = ''
    const knop = (soort, n, actief, nu) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.soort = soort
      const c = document.createElement('canvas'); tekenIcoon(c, soort, 3); b.appendChild(c)
      const t = document.createElement('span'); t.textContent = namen[soort]; b.appendChild(t)
      if (n != null) { const m = document.createElement('span'); m.className = 'n'; m.textContent = n; b.appendChild(m) }
      if (nu) b.classList.add('nu')
      b.disabled = !actief
      b.setAttribute('aria-label', namen[soort] + (n != null ? ' ' + n : ''))
      // kiezen bij loslaten (pointerup): het veld houdt de touch-klik tegen (geen zoom op iOS), dus click komt niet altijd
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); b._neer = e.pointerId })
      b.addEventListener('pointerup', e => { e.stopPropagation(); if (b._neer !== e.pointerId || b.disabled) return; b._neer = null; kiesUitArsenaal(soort) })
      b.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0 && !b.disabled) kiesUitArsenaal(soort) })   // toetsenbord
      arsenaal.appendChild(b)
    }
    WAPENS.forEach(w => { if (s.niveau[w]) knop(w, null, true, w === s.wapen) })
    knop('bom', s.voorraad.bom || 0, (s.voorraad.bom || 0) > 0)
    knop('schild', s.voorraad.schild || 0, (s.voorraad.schild || 0) > 0 && !(s.schild > 0))
  }
  function openArsenaal() {
    if (!huidige || huidige.voorbij || huidige.pauze) return
    bouwArsenaal()
    arsenaal.hidden = false; tegel.classList.add('open'); tegel.setAttribute('aria-expanded', 'true')
    if (!samen) huidige.tijdSchaal = 0.3   // samen geen slow motion: de tijd loopt bij allebei gelijk
    GELUID.speel('wissel')
    clearTimeout(arsenaalKlok); arsenaalKlok = setTimeout(sluitArsenaal, 3200)
  }
  function sluitArsenaal() {
    clearTimeout(arsenaalKlok)
    arsenaal.hidden = true; tegel.classList.remove('open'); tegel.setAttribute('aria-expanded', 'false')
    if (huidige && !samen) huidige.tijdSchaal = 1
  }
  function wisselArsenaal() { if (arsenaal.hidden) openArsenaal(); else sluitArsenaal() }
  function kiesUitArsenaal(soort) {
    const s = huidige; if (!s) return
    if (WAPENS.includes(soort)) { if (s.niveau[soort]) { s.wapen = soort; GELUID.speel('wissel') } }
    else if (soort === 'bom') s.gebruikBom()
    else if (soort === 'schild') s.gebruikSchild()
    sluitArsenaal(); werkTegelBij()
  }
  tegel.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); GELUID.wek(); if (laag.hidden) wisselArsenaal() })
  tegel.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0 && laag.hidden) wisselArsenaal() })  // toetsenbord (Enter)

  /* ---------- neonbord en balk onderaan ---------- */
  function bord(tekst, klein, kleur, lang) {
    bordVak.innerHTML = ''
    bordVak.appendChild(document.createTextNode(tekst))
    if (klein) { const s = document.createElement('small'); s.textContent = klein; bordVak.appendChild(s) }
    bordVak.style.setProperty('--k', kleur || '#5ee7e0')
    bordVak.className = 'bord'; void bordVak.offsetWidth; bordVak.className = 'bord ' + (lang ? 'lang' : 'aan')
  }
  let balkKlok = null
  function balk(tekst, kleur, ms) {
    balkVak.textContent = tekst
    balkVak.style.setProperty('--k', kleur || '#ff4848')
    balkVak.classList.remove('aan'); void balkVak.offsetWidth; balkVak.classList.add('aan')
    clearTimeout(balkKlok); balkKlok = setTimeout(() => balkVak.classList.remove('aan'), ms || 3500)
  }
  /* samen: de score en levens van de ander, rechtsboven onder die van jou */
  const aScoreVak = anderRij.querySelector('.aScore'), aLevensVak = anderRij.querySelector('.aLevens')
  function werkAnderRij(a) {
    const sc = String(a.score || 0).padStart(7, '0'), lv = a.uit ? 'GAME OVER' : '\u00d7' + Math.max(0, a.levens || 0)
    if (aScoreVak.textContent !== sc) aScoreVak.textContent = sc
    if (aLevensVak.textContent !== lv) aLevensVak.textContent = lv
    anderRij.classList.toggle('uit', !!(a.uit || a.weg))
  }
  function toonAnderEinde(score) {
    if (samen && !laag.hidden && !aftellen) uitleg2.textContent = vertaal('{naam}: SCORE {score}', { naam: NAAMV, score: String(score || 0).padStart(7, '0') })
  }
  function bewaarBereikt(n) {
    if (n <= bereikt) return
    bereikt = Math.min(AANTAL_LEVELS, n)
    try { localStorage.setItem('nr-bereikt', String(bereikt)) } catch (e) {}
  }

  /* ================= de Phaser-scène ================= */
  class Spel extends Phaser.Scene {
    constructor() { super({ key: 'spel' }) }

    /* ---- opbouw ---- */
    create() {
      huidige = this
      this.tekenVast()
      for (const p of Object.keys(PALET)) this.tekenVijanden(p)
      this.tijdSchaal = 1
      this.pool = {}
      this.vijanden = []; this.kogelsV = []; this.kogelsS = []; this.buit = []; this.hekken = []
      this.lagen = []
      this.score = 0; this.getoond = 0; this.combo = 1; this.comboTijd = 0
      this.scoreRondeId = crypto.randomUUID()
      this.scoreEigenaar = scoreService.captureOwner()
      this.levens = 3; this.onraakbaar = 2.2; this.schild = 0
      this.niveau = { puls: 1 }; this.wapen = 'puls'
      this.voorraad = { bom: 2, schild: 0 }
      this.herlaad = 0; this.raketKlok = 0; this.straalAan = false
      this.voorbij = false; this.pauze = false
      this.baas = null; this.dtNu = 0
      this.perId = new Map()
      // v194: samen spelen
      this.samen = samen; this.host = leider; this.uit = false
      this.pauzeEigen = false; this.pauzeAnder = false
      this.ander = null; this.kogelsA = []; this.anderSt = { herlaad: 0, raketKlok: 0 }
      this.uitgaand = []; this.raakBuf = new Map(); this.stuurKlok = 0

      this.cameras.main.setZoom(R).setOrigin(0, 0)   // de wereld is W x H; het beeld heeft R keer zoveel punten
      const mijnSchip = leider ? 'schip' : 'schip2'
      this.mijnVlam = leider ? '' : 'b'; this.zijnVlam = leider ? 'b' : ''
      this.schaduw = this.add.image(0, 0, mijnSchip).setTint(0x000000).setAlpha(0.35).setDepth(-5).setScale(0.8 * SB)
      this.speler = this.add.image(samen ? W / 2 + (leider ? -50 : 50) : W / 2, H - 90, mijnSchip).setDepth(20).setScale(SB)
      this.vlam = this.add.image(0, 0, 'vlam0').setDepth(19).setScale(SB).setOrigin(0.5, 6 / 28).setBlendMode(Phaser.BlendModes.ADD)
      this.bel = this.add.image(0, 0, 'schildBel').setDepth(21).setScale(SB).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
      this.baasG = this.add.graphics().setDepth(31)
      this.hekG = this.add.graphics().setDepth(12).setBlendMode(Phaser.BlendModes.ADD)
      this.straalG = this.add.graphics().setDepth(18).setBlendMode(Phaser.BlendModes.ADD)
      this.fx = this.add.graphics().setDepth(25).setBlendMode(Phaser.BlendModes.ADD)
      this.vonken = {}
      for (const k of ['#5ee7e0', '#ff5d9e', '#ff3dd2', '#ffd23c', '#ffffff', '#b6ff3c', '#4aa3ff', '#ff4848', '#ffa53c', '#7fd4ff']) this.vonkVoor(k)
      if (samen) {   // het schip van de ander, met naam, vlam en schild
        const zijn = leider ? 'schip2' : 'schip'
        this.anderSchaduw = this.add.image(0, 0, zijn).setTint(0x000000).setAlpha(0.3).setDepth(-5).setScale(0.8 * SB).setVisible(false)
        this.anderSpr = this.add.image(W / 2 + (leider ? 50 : -50), H - 90, zijn).setDepth(19.6).setScale(SB).setVisible(false)
        this.anderVlam = this.add.image(0, 0, 'vlam0').setDepth(19.5).setScale(SB).setOrigin(0.5, 6 / 28).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
        this.anderBel = this.add.image(0, 0, 'schildBel').setDepth(21).setScale(SB).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
        this.anderNaam = this.add.text(0, 0, NAAMV, { fontFamily: '"Press Start 2P",monospace', fontSize: '6px', color: leider ? '#ffb3d1' : '#b8fdff', stroke: '#07051a', strokeThickness: 2 })
          .setOrigin(0.5, 0).setDepth(32).setResolution(R).setVisible(false)
        anderRij.hidden = false; anderRij.classList.remove('uit')
        // v220: terughalen. Waar een schip neerging, staat een cirkel; de ander vliegt erin en blijft er 2 seconden.
        this.wrak = null
        this.wrakG = this.add.graphics().setDepth(22).setBlendMode(Phaser.BlendModes.ADD)
        this.wrakNaam = this.add.text(0, 0, '', { fontFamily: '"Press Start 2P",monospace', fontSize: '6px', color: '#ffffff', stroke: '#07051a', strokeThickness: 2 })
          .setOrigin(0.5, 1).setDepth(32).setResolution(R).setVisible(false)
        anderRij.querySelector('.aScore').textContent = '0000000'; anderRij.querySelector('.aLevens').textContent = ''
      }
      tekenLevens(this.levens)
      scoreVak.textContent = '0000000'; comboVak.textContent = ''
      baasVak.hidden = true
      this.startLevel(beginLevel)
      werkTegelBij()
      if (window.__fibroProef) window.__neonRaiders = { scene: this, W, H, vingers, vuurtNu, toets, net, ronde: () => ronde }   // alleen in de proeven (tests/tools/proef88.py, proef90.py)
    }
    vonkVoor(k) {
      if (!this.vonken[k]) {
        this.vonken[k] = this.add.particles(0, 0, 'vonk', {
          lifespan: { min: 260, max: 820 }, speed: { min: 50, max: 300 }, angle: { min: 0, max: 360 },
          scale: { start: 1.5, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', tint: hexInt(k), emitting: false
        }).setDepth(26)
      }
      return this.vonken[k]
    }

    /* ---- een level beginnen: achtergrond, golven, muziek ---- */
    startLevel(n) {
      this.level = n
      this.wrak = null
      const L = this.L = LEVELS[n]
      for (const v of this.vijanden) this.ruimVijand(v)
      for (const k of this.kogelsV.concat(this.kogelsS)) this.weg(k.spr)
      for (const b of this.buit) this.weg(b.spr)
      for (const k of this.kogelsA) this.weg(k.spr)
      this.vijanden = []; this.kogelsV = []; this.kogelsS = []; this.kogelsA = []; this.buit = []; this.hekken = []
      this.perId.clear(); this.raakBuf.clear(); this.golfId = null; this.baasTel = 0
      this.hekG.clear(); this.fx.clear(); this.baasG.clear(); baasVak.hidden = true
      if (this.baas && !this.baas.weg) this.ruimBaas()
      this.baas = null; this.golfStop = false; this.baasWacht = 0; this.klok = 0; this.golfNr = 0; this.overgang = 0
      this.golven = golvenVoor(n)
      this.snelK = 1 + (n - 1) * 0.035
      this.baasR = rng(5000 + n)
      // achtergrond vervangen
      for (const l of this.lagen) l.obj.destroy()
      for (const key of this.textures.getTextureKeys()) if (key.startsWith('ag_')) this.textures.remove(key)
      const lagen = this['achtergrond_' + L.achtergrond]()
      this.lagen = lagen.map(spec => {
        const obj = spec.vast
          ? this.add.image(0, 0, spec.key).setOrigin(0, 0).setScale(SB * W / 360, SB * H / 640)
          : this.add.tileSprite(0, 0, W * R, H * R, spec.key).setOrigin(0, 0).setScale(SB)
        obj.setDepth(spec.diepte).setAlpha(spec.alpha == null ? 1 : spec.alpha)
        if (spec.add) obj.setBlendMode(Phaser.BlendModes.ADD)
        if (this.zuinig && (spec.diepte >= 30 || spec.add)) obj.setVisible(false)
        return { obj, spec }
      })
      this.schaduwAan = MET_SCHADUW.has(L.achtergrond)
      this.schaduw.setVisible(this.schaduwAan)
      for (const key of this.textures.getTextureKeys()) if (key.startsWith('b_') && key !== 'b_kapot') this.textures.remove(key)
      this[BAZEN[L.baas].teken]()
      if (!this.textures.exists('b_kapot')) this.baas_titan()
      p1Vak.textContent = IKP + ' · L' + n
      GELUID.muziek(false); GELUID.muziek(true, L.lied)
      bewaarBereikt(n)
      if (this.samen && this.uit) {   // af geweest: bij een nieuw level doe je weer mee
        this.uit = false; this.levens = 2; tekenLevens(this.levens)
        this.speler.setVisible(true).setPosition(W / 2, H - 70); this.vlam.setVisible(true); this.schaduw.setVisible(this.schaduwAan)
        this.onraakbaar = 3
      }
      if (this.uit) this.schaduw.setVisible(false)
    }
    /* de baas meteen weghalen (als de ander al naar het volgende level is) */
    ruimBaas() {
      const b = this.baas; if (!b) return
      b.weg = true
      try { b.romp.destroy(); if (b.schaduw) b.schaduw.destroy(); b.delen.forEach(d => { d.spr.destroy(); d.label.destroy() }) } catch (e) {}
    }
    levelBord() { const L = this.L; bord('LEVEL ' + L.nr, L.naam(), L.kleur, true) }
    /* na de eindbaas: bonus, en door naar het volgende level (of gewonnen na level 7) */
    levelKlaar() {
      if (this.voorbij) return
      const n = this.level, bonus = this.levens * 2000 * n
      this.score += bonus
      GELUID.speel('klaar')
      bord('LEVEL ' + n, vertaal('GEHAALD!'), this.L.kleur, true)
      balk(vertaal('BONUS {n}', { n: getal(bonus) }), this.L.kleur, 3000)
      if (n >= AANTAL_LEVELS) { this.time.delayedCall(2600, () => this.einde(true)); return }
      bewaarBereikt(n + 1)
      this.overgang = 1
      this.time.delayedCall(2800, () => {
        if (this.voorbij) return
        this.cameras.main.fadeOut(450, 7, 5, 26)
        this.time.delayedCall(480, () => {
          if (this.voorbij) return
          this.startLevel(n + 1)
          this.onraakbaar = 2
          this.cameras.main.fadeIn(600, 7, 5, 26)
        })
      })
    }

    /* ---- de speler duwen (vanuit de vinger) ---- */
    duw(dx, dy) {
      if (this.voorbij || this.pauze || this.uit) return
      this.speler.x = Phaser.Math.Clamp(this.speler.x + dx, 18, W - 18)
      this.speler.y = Phaser.Math.Clamp(this.speler.y + dy, 70, H - 24)
    }

    /* ---- pool: plaatjes hergebruiken in plaats van steeds nieuw maken ---- */
    pak(key) {
      const p = this.pool[key] || (this.pool[key] = [])
      const img = p.pop() || this.add.image(0, 0, key)
      img.setVisible(true).setActive(true).setAlpha(1).setScale(SB).setRotation(0).clearTint().setFlipX(false).setOrigin(0.5).setBlendMode(Phaser.BlendModes.NORMAL)
      return img
    }
    weg(img) { if (!img) return; img.setVisible(false).setActive(false); (this.pool[img.texture.key] || (this.pool[img.texture.key] = [])).push(img) }
    tex(soort) { return KLEURSOORT.has(soort) ? soort + '_' + this.L.pal : soort }

    /* ---- vijanden maken ---- */
    maak(soort, o) {
      const S = SOORT[soort], L = this.L
      const hp = Math.max(1, Math.round(S.hp * L.zwaar * 10) / 10)
      const v = { soort, hp, max: hp, r: S.r, punten: Math.round(S.punten * (1 + (L.nr - 1) * 0.1)), t: 0, x: o.x == null ? W / 2 : o.x, y: o.y == null ? -30 : o.y, o, vx: 0, vy: 0, schiet: 0, grond: !!S.grond }
      // v194: elke vijand een nummer, bij allebei hetzelfde: uit een golf (golfnummer en volgorde), anders van de baas
      v.id = o.id != null ? o.id : this.golfId != null ? this.golfId * 16 + (this.golfSub++) : 'b' + (this.baasTel++)
      this.perId.set(v.id, v)
      if (soort === 'zwaai') { v.x = o.kant < 0 ? -20 : W + 20; v.y = o.y || 80; v.vx = o.kant < 0 ? 170 : -170; v.vy = 10 }
      if (soort === 'tank' || soort === 'loper') { v.y = -24; v.vx = (v.x < W / 2 ? 1 : -1) * 8 }
      if (soort === 'kolos') v.y = -50
      if (soort === 'muurkanon') { v.x = o.kant < 0 ? 22 : W - 22; v.y = -20 }
      if (soort === 'zwerm') { v.x = o.kant < 0 ? -16 : W + 16 }
      if (soort === 'raketV') v.hoek = o.hoek == null ? Math.PI / 2 : o.hoek
      v.spr = this.pak(this.tex(soort === 'loper' ? 'loper' : soort) + (soort === 'loper' ? '0' : '')).setDepth(v.grond ? -10 : 10)
      if (soort === 'tank' || soort === 'muurkanon') v.loop = this.pak(this.tex('loop')).setDepth(-9).setOrigin(0.5, 25 / 38)
      if ((soort === 'kolos' || soort === 'schutter' || soort === 'spuger') && this.schaduwAan) v.schaduw = this.pak(this.tex(soort)).setTint(0x000000).setAlpha(0.3).setDepth(-5).setScale(0.75 * SB)
      if (soort === 'zwerm' && o.kant > 0) v.spr.setFlipX(true)
      v.spr.setPosition(v.x, v.y)
      this.vijanden.push(v)
      return v
    }
    /* laserhek: twee palen, met een straal ertussen (aanUit: knippert, anders altijd aan) */
    maakHek(aanUit) {
      const a = this.maak('paal', { x: 50, y: -20 }), b = this.maak('paal', { x: W - 50, y: -20 })
      const hek = { a, b, aanUit, t: 0 }
      a.hek = hek; b.hek = hek
      this.hekken.push(hek)
    }

    vijandStap(v, dt) {
      v.t += dt
      const sp = this.doel(v.x, v.y), gs = this.grondSnelheid
      switch (v.soort) {
        case 'dart': {
          const snel = v.o.snel || 1
          v.y += 130 * snel * dt
          if (!v.o.recht) v.x = v.o.x + Math.sin(v.t * 2.6 + v.o.fase) * 46
          else v.x = v.o.x + Math.sin(v.t * 3 + v.o.fase) * 8
          break
        }
        case 'zwaai': {
          v.x += v.vx * dt; v.y += v.vy * dt
          v.vy += 95 * dt; v.vx *= Math.pow(0.55, dt)
          if (v.schiet === 0 && v.t > 0.9 && v.y > 20) { v.schiet = 1; this.mik(v.x, v.y, 'orb', 150, 0) }
          break
        }
        case 'schutter': {
          const doel = v.o.doelY || 140
          if (v.t < 6.5) { v.y += (doel - v.y) * Math.min(1, 2.2 * dt) }
          else { v.y += 110 * dt; v.x += (v.x < W / 2 ? -40 : 40) * dt }
          v.x += Math.sin(v.t * 1.4) * 12 * dt
          v.schiet -= dt
          if (v.t > 1.2 && v.t < 6.5 && v.schiet <= 0) { v.schiet = 1.5; for (let i = -1; i <= 1; i++) this.mik(v.x, v.y + 10, 'orb', 140, i * 0.22) }
          break
        }
        case 'tank': {
          v.y += gs * dt; v.x += v.vx * dt
          if (v.x < 50 || v.x > W - 50) v.vx = -v.vx
          const hoek = Math.atan2(sp.y - v.y, sp.x - v.x)
          v.loop.setRotation(hoek + Math.PI / 2)
          v.schiet -= dt
          if (v.y > 40 && v.y < H - 140 && v.schiet <= 0) { v.schiet = 2; this.mik(v.x + Math.cos(hoek) * 14, v.y + Math.sin(hoek) * 14, 'naald', 165, 0) }
          break
        }
        case 'muurkanon': {
          v.y += gs * dt
          const hoek = Math.atan2(sp.y - v.y, sp.x - v.x)
          v.loop.setRotation(hoek + Math.PI / 2)
          v.schiet -= dt
          if (v.y > 40 && v.y < H - 140 && v.schiet <= 0) { v.schiet = 1.7; this.mik(v.x + Math.cos(hoek) * 14, v.y + Math.sin(hoek) * 14, 'naald', 170, 0) }
          break
        }
        case 'paal': v.y += gs * dt; break
        case 'kolos': {
          if (v.t < 4) v.y += (150 - v.y) * Math.min(1, 1.2 * dt)
          else if (v.t < 14) v.x = v.o.x + Math.sin((v.t - 4) * 0.7) * 50
          else v.y += 60 * dt
          v.schiet -= dt
          if (v.t > 2 && v.t < 14 && v.schiet <= 0) { v.schiet = 2.3; this.ring(v.x, v.y, 10, 105, 'orbO', v.t) }
          break
        }
        case 'drager': v.y += 52 * dt; v.x = v.o.x + Math.sin(v.t * 1.5) * 30; break
        case 'meteoor': case 'meteoorK':
          v.x += v.o.vx * dt; v.y += v.o.vy * dt; v.spr.rotation += (v.o.draai || 1) * dt
          break
        case 'mijn': {
          v.y += 38 * dt; v.x = v.o.x + Math.sin(v.t * 1.3 + (v.o.fase || 0)) * 20
          const dx = v.x - sp.x, dy = v.y - sp.y
          if (!v.ontsteek && dx * dx + dy * dy < 70 * 70) v.ontsteek = 0.7
          if (v.ontsteek) {
            v.ontsteek -= dt
            v.spr.setTexture(Math.floor(v.t * 14) % 2 ? 'mijnAan' : 'mijn')
            if (v.ontsteek <= 0) { this.ring(v.x, v.y, 8, 90, 'orb', v.t); this.ontplof(v.x, v.y, 1.2, SOORT.mijn.kleur); this.ruimVijand(v); return false }
          }
          break
        }
        case 'zwerm': {
          const r = v.o.kant < 0 ? 1 : -1
          v.x = (v.o.kant < 0 ? -16 : W + 16) + r * 150 * v.t
          v.y = v.o.y + v.t * 28 + Math.sin(v.t * 5 + (v.o.fase || 0)) * 24
          break
        }
        case 'spuger': {
          const doel = v.o.doelY || 140
          if (v.t < 7) v.y += (doel - v.y) * Math.min(1, 1.8 * dt)
          else v.y += 90 * dt
          v.x += Math.sin(v.t * 1.1) * 16 * dt
          v.spr.setScale(SB * (1 + Math.sin(v.t * 4) * 0.04), SB * (1 - Math.sin(v.t * 4) * 0.04))
          v.schiet -= dt
          if (v.t > 1.5 && v.t < 7 && v.schiet <= 0) { v.schiet = 2.2; this.zuurBoog(v.x, v.y + 12, 3) }
          break
        }
        case 'loper': {
          v.y += (gs * 0.6 + 16) * dt
          v.x += Math.sign(sp.x - v.x) * 20 * dt
          v.spr.setTexture(this.tex('loper') + (Math.floor(v.t * 4) % 2))
          v.schiet -= dt
          if (v.y > 40 && v.y < H - 140 && v.schiet <= 0) { v.schiet = 2.2; this.waaier(v.x, v.y + 14, 2, 0.3, 160, 'naald') }
          break
        }
        case 'raketV': {
          if (v.t < 2.2) { const wens = Math.atan2(sp.y - v.y, sp.x - v.x); v.hoek += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(wens - v.hoek), -2.2 * dt, 2.2 * dt) }
          const sn = 125 * this.snelK
          v.x += Math.cos(v.hoek) * sn * dt; v.y += Math.sin(v.hoek) * sn * dt
          v.spr.setRotation(v.hoek - Math.PI / 2)
          if (Math.random() < 0.5) this.vonken['#ffa53c'].explode(1, v.x - Math.cos(v.hoek) * 8, v.y - Math.sin(v.hoek) * 8)
          break
        }
      }
      v.spr.setPosition(v.x, v.y)
      if (v.loop) v.loop.setPosition(v.x, v.y)
      if (v.schaduw) v.schaduw.setPosition(v.x + 20, v.y + 28)
      if (v.flits > 0) { v.flits -= dt; if (v.flits <= 0) v.spr.clearTint() }
      return v.y < H + 60 && v.y > -120 && v.x > -80 && v.x < W + 80 && !(v.soort === 'zwaai' && v.t > 6) && !(v.soort === 'raketV' && v.t > 7)
    }
    ruimVijand(v) {
      if (v.dood) return
      this.weg(v.spr); if (v.loop) this.weg(v.loop); if (v.schaduw) this.weg(v.schaduw)
      v.dood = true
      if (this.perId.get(v.id) === v) this.perId.delete(v.id)
    }
    hekStap() {
      const g = this.hekG; g.clear()
      const sp = this.speler
      this.hekken = this.hekken.filter(h => !(h.a.dood && h.b.dood))
      for (const h of this.hekken) {
        if (h.a.dood || h.b.dood) continue
        const aan = !h.aanUit || (h.a.t % 2.6) < 1.5
        const y = h.a.y - 6
        if (!aan) { g.lineStyle(1, 0xff4848, 0.25); g.lineBetween(h.a.x, y, h.b.x, y); continue }
        const f = 0.8 + Math.random() * 0.2
        g.fillStyle(0xff4848, 0.25 * f); g.fillRect(h.a.x, y - 5, h.b.x - h.a.x, 10)
        g.fillStyle(0xff4848, 0.7 * f); g.fillRect(h.a.x, y - 2, h.b.x - h.a.x, 4)
        g.fillStyle(0xffffff, 0.9); g.fillRect(h.a.x, y - 0.6, h.b.x - h.a.x, 1.2)
        if (!this.uit && Math.abs(sp.y - y) < 7 && sp.x > h.a.x && sp.x < h.b.x) this.geraakt()
        if (!h.zoem && y > 0) { h.zoem = true; GELUID.speel('hek') }
      }
    }

    /* ---- kogels ---- */
    kogel(x, y, key, vx, vy, ay) {
      const k = { spr: this.pak(key).setDepth(24).setBlendMode(Phaser.BlendModes.ADD), x, y, vx: vx * this.snelK, vy: vy * this.snelK, ay: ay || 0, r: key === 'naald' ? 4 : 5 }
      if (key === 'naald') k.spr.setRotation(Math.atan2(vy, vx) - Math.PI / 2)
      k.spr.setPosition(x, y)
      this.kogelsV.push(k)
      return k
    }
    mik(x, y, key, snelheid, extraHoek) {
      const d = this.doel(x, y)
      const a = Math.atan2(d.y - y, d.x - x) + (extraHoek || 0)
      this.kogel(x, y, key, Math.cos(a) * snelheid, Math.sin(a) * snelheid)
      GELUID.speel('vijandSchiet')
    }
    /* hulpjes voor de eindbazen (zie BAZEN) */
    waaier(x, y, n, spreid, snel, key) { for (let i = 0; i < n; i++) this.mik(x, y, key || 'orb', snel, n > 1 ? (i - (n - 1) / 2) * (spreid / (n - 1)) : 0) }
    ring(x, y, n, snel, key, offset) {
      for (let i = 0; i < n; i++) { const a = (offset || 0) + i * Math.PI * 2 / n; this.kogel(x, y, key || 'orb', Math.cos(a) * snel, Math.sin(a) * snel) }
      GELUID.speel('vijandSchiet')
    }
    raketten(x, y, n) { for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; this.maak('raketV', { x: x + k * 16, y, hoek: Math.PI / 2 + k * 0.4 }) } GELUID.speel('raket') }
    tapijt(x, y, breed, n) { for (let i = 0; i < n; i++) this.kogel(x - breed / 2 + i * breed / (n - 1), y, 'bomV', 0, 60 + (i % 2) * 22, 55); GELUID.speel('vijandSchiet') }
    regenV(n, key, snel) { const r = this.baasR; for (let i = 0; i < n; i++) this.kogel(16 + r() * (W - 32), -10 - r() * 60, key || 'orbO', 0, snel || 150) }
    zuurBoog(x, y, n) {
      const sp = this.speler, tijd = 1.3, ay = 160
      for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; this.kogel(x, y, 'zuur', (sp.x - x) / tijd + k * 32, (sp.y - y - 0.5 * ay * tijd * tijd) / tijd, ay) }
      GELUID.speel('zuur')
    }
    elke(b, naam, interval, dt, eerst) {
      if (b.klok[naam] === undefined) b.klok[naam] = eerst == null ? interval : eerst
      b.klok[naam] -= dt
      if (b.klok[naam] <= 0) { b.klok[naam] += interval; if (b.klok[naam] <= 0) b.klok[naam] = interval; return true }
      return false
    }
    spiraal(b, naam, x, y, snel, tik, pauze, duur, key, key2) {
      const st = b.sp[naam] || (b.sp[naam] = { wacht: 0.5, aan: 0, tik: 0, hoek: 0 }), dt = this.dtNu
      if (st.aan > 0) {
        st.aan -= dt; st.tik -= dt
        if (st.tik <= 0) {
          st.tik += tik; st.hoek += 0.42
          this.kogel(x, y, key, Math.cos(st.hoek) * snel, Math.sin(st.hoek) * snel)
          if (key2) this.kogel(x, y, key2, Math.cos(-st.hoek) * snel * 0.88, Math.sin(-st.hoek) * snel * 0.88)
        }
        if (st.aan <= 0) st.wacht = pauze
      } else { st.wacht -= dt; if (st.wacht <= 0) { st.aan = duur; st.tik = 0 } }
    }
    laserStart(b, bron) {
      if (b.laser || bron.dood) return
      const d = this.doel(bron.x, bron.y)
      b.laser = { t: 0, x: d.x, bron, wie: d === this.speler ? 'ik' : 'ander' }; GELUID.speel('richt')
    }
    /* v194: op wie mikt een vijand? Op het dichtstbijzijnde schip (alleen spelen: altijd op jou) */
    doel(x, y) {
      if (!this.samen) return this.speler
      const a = this.anderLeeft() ? this.anderSpr : null
      if (this.uit || !a) return a || this.speler
      const sp = this.speler
      return (a.x - x) ** 2 + (a.y - y) ** 2 < (sp.x - x) ** 2 + (sp.y - y) ** 2 ? a : sp
    }
    anderLeeft() { return !!(this.samen && this.ander && this.ander.zichtbaar) }

    schot(key, x, y, vx, vy, dmg, extra) {
      const k = Object.assign({ spr: this.pak(key).setDepth(15).setBlendMode(Phaser.BlendModes.ADD), x, y, vx, vy, dmg, r: 6 }, extra || {})
      k.spr.setPosition(x, y).setRotation(Math.atan2(vy, vx) + Math.PI / 2)
      this.kogelsS.push(k)
    }
    vuur(dt) {
      const sp = this.speler, niv = this.niveau[this.wapen] || 1
      this.herlaad -= dt; this.raketKlok -= dt
      const straal = this.wapen === 'straal', mag = vuurtNu() && !this.overgang && !this.uit
      if (straal !== this.straalAan || !mag) { if (this.straalAan) GELUID.straal(false); this.straalAan = false }
      if (!mag) return
      if (straal) { if (!this.straalAan) { this.straalAan = true; GELUID.straal(true) } return }
      if (this.herlaad > 0) return
      const geluid = this.salvo(this, sp.x, sp.y, this.wapen, niv, (key, x, y, vx, vy, dmg, extra) => this.schot(key, x, y, vx, vy, dmg, extra))
      if (geluid) GELUID.speel(geluid)
    }
    /* één salvo van een wapen (ook voor de kogels van de ander, die alleen te zien zijn); st houdt herlaad en raketKlok bij */
    salvo(st, x, y, wapen, niv, schot) {
      if (wapen === 'puls') {
        st.herlaad = 0.11
        const rijen = niv === 1 ? [0] : niv === 2 ? [-6, 6] : [-10, 0, 10]
        rijen.forEach(dx => schot('puls', x + dx, y - 16, 0, -620, 1))
        if (niv === 3) { schot('puls', x - 14, y - 6, -90, -580, 0.7); schot('puls', x + 14, y - 6, 90, -580, 0.7) }
        return 'puls'
      } else if (wapen === 'spreid') {
        st.herlaad = 0.17
        const n = niv === 1 ? 3 : niv === 2 ? 5 : 7, br = niv === 3 ? 0.9 : 0.7
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * (br / (n - 1)); schot('spreidKogel', x, y - 12, Math.cos(a) * 470, Math.sin(a) * 470, 0.75) }
        return 'spreid'
      } else if (wapen === 'raket') {
        st.herlaad = 0.16
        schot('puls', x, y - 16, 0, -620, 0.6)
        if (st.raketKlok <= 0) {
          st.raketKlok = niv === 1 ? 0.55 : niv === 2 ? 0.42 : 0.3
          const paar = niv === 3 ? [-14, -6, 6, 14] : [-10, 10]
          paar.forEach(dx => schot('raketKogel', x + dx, y - 4, dx * 6, -160, 3, { raket: true, leeft: 0 }))
          return 'raket'
        }
      }
      return null
    }
    /* de straal raakt het eerste doel recht voor je */
    straalStap(dt) {
      const g = this.straalG; g.clear()
      if (this.straalAan) this.straalVan(this.speler, this.niveau.straal || 1, dt, true)
      const a = this.ander
      if (a && a.zichtbaar && WAPENS[a.w] === 'straal' && (a.f & 1)) this.straalVan(this.anderSpr, a.n || 1, dt, false)
    }
    straalVan(sp, niv, dt, echt) {
      const g = this.straalG, breed = 8 + niv * 6, dps = 10 + niv * 6
      let doel = null, eind = -20
      for (const d of this.doelen()) { if (Math.abs(d.x - sp.x) < d.r + breed / 2 && d.y < sp.y - 10 && d.y > eind) { eind = d.y; doel = d } }
      const top = doel ? doel.y + doel.r * 0.4 : -20
      const flikker = (0.85 + Math.random() * 0.15) * (echt ? 1 : 0.7)
      g.fillStyle(0xb6ff3c, 0.18 * flikker); g.fillRect(sp.x - breed, top, breed * 2, sp.y - 14 - top)
      g.fillStyle(0xb6ff3c, 0.55 * flikker); g.fillRect(sp.x - breed / 2, top, breed, sp.y - 14 - top)
      g.fillStyle(0xffffff, echt ? 0.9 : 0.6); g.fillRect(sp.x - 1.5, top, 3, sp.y - 14 - top)
      if (doel) {
        if (echt) this.raak(doel, dps * dt, true)   // de straal van de ander raakt hier niets: wat hij raakt, komt via de lijn
        if (Math.random() < 0.5) this.vonken['#b6ff3c'].explode(1, sp.x + (Math.random() - 0.5) * breed, top)
      }
    }
    /* alles wat geraakt kan worden: vijanden en de onderdelen van de baas */
    doelen() {
      const uit = []
      for (const v of this.vijanden) if (!v.dood && v.y > -10) uit.push(v)
      if (this.baas && this.baas.binnen && !this.baas.dood) for (const d of this.baas.delen) if (!d.dood) uit.push(d)
      return uit
    }

    /* ---- raken, ontploffen, punten ---- */
    /* bron: niets = mijn kogels (de ander krijgt het door), 'bom' = mijn bom (de ander doet de bom zelf na), 'ander' = van de ander */
    raak(d, schade, stil, bron) {
      if (d.dood) return
      if (this.samen && !bron && d.id != null) this.raakBuf.set(d.id, (this.raakBuf.get(d.id) || 0) + schade)
      if (d.baasdeel) { this.raakBaas(d, schade, stil, bron); return }
      d.hp -= schade
      if (!stil || Math.random() < 0.08) { d.spr.setTintFill(0xffffff); d.flits = 0.05; if (bron !== 'ander') GELUID.speel('raak') }
      if (d.hp <= 0) this.dood(d, bron === 'ander')
    }
    kleurenVan(v) { const S = SOORT[v.soort], p = PALET[this.L.pal]; return S.kleur || [p.licht, p.oog, '#ffffff'] }
    dood(v, vanAnder) {
      const groot = v.soort === 'kolos' ? 3 : (v.soort === 'schutter' || v.soort === 'tank' || v.soort === 'spuger' || v.soort === 'loper' || v.soort === 'muurkanon' || v.soort === 'meteoor') ? 1.6 : 1
      this.ontplof(v.x, v.y, groot, this.kleurenVan(v))
      if (!vanAnder) this.punten(v.punten, v.x, v.y, v.soort === 'kolos')   // de punten zijn voor wie hem neerschiet
      if (v.soort === 'drager') this.laatVallen(v.x, v.y, v.o.buit, v.id + ':0')
      // v220: grote vijanden laten soms een schild vallen. Het nummer van de vijand beslist, dus bij allebei dezelfde.
      if (SCHILD_VAN.has(v.soort) && typeof v.id === 'number' && v.id % 8 === 3) this.laatVallen(v.x, v.y, 'schild', v.id + ':s')
      if (v.soort === 'kolos') {   // v194: welke power-ups hangt af van het nummer van de kolos (bij allebei gelijk)
        const k = typeof v.id === 'number' ? v.id : 0
        this.laatVallen(v.x - 16, v.y, k % 2 ? 'bom' : 'schild', v.id + ':0'); this.laatVallen(v.x + 16, v.y, WAPENS[(k >> 1) % 4], v.id + ':1')
      }
      if (v.soort === 'meteoor') for (const r of [-1, 1]) this.maak('meteoorK', { id: v.id + (r < 0 ? 'a' : 'b'), x: v.x + r * 8, y: v.y, vx: r * 55 + v.o.vx * 0.5, vy: v.o.vy * 0.8, draai: r * 2.4 })
      if (v.soort === 'mijn') this.ring(v.x, v.y, 6, 70, 'orbO', v.t)
      this.ruimVijand(v)
    }
    punten(n, x, y, groot) {
      this.comboTijd = 1.4
      this.combo = Math.min(8, this.combo + (n >= 300 ? 1 : 0.25))
      const m = Math.floor(this.combo)
      const erbij = n * m
      this.score += erbij
      comboVak.textContent = m > 1 ? 'x' + m : ''
      if (groot || n >= 800) {   // alleen bij grote vijanden: tekst maken kost de telefoon veel
        const t = this.add.text(x, y - 10, '+' + getal(erbij), { fontFamily: '"Press Start 2P",monospace', fontSize: groot ? '12px' : '8px', color: groot ? '#ffe14a' : '#ffffff', stroke: groot ? '#b5106a' : '#ff3dd2', strokeThickness: 3 }).setOrigin(0.5).setDepth(40).setResolution(R)
        t.setShadow(0, 0, groot ? '#ffe14a' : '#ff3dd2', 8, true, true)
        this.tweens.add({ targets: t, y: y - (groot ? 56 : 40), alpha: 0, duration: groot ? 1400 : 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() })
      }
    }
    ontplof(x, y, grootte, kleuren) {
      const n = Math.round((this.zuinig ? 5 : 10) * grootte)
      ;(kleuren || ['#ff3dd2', '#ffffff']).forEach((k, i) => this.vonkVoor(k).explode(i === 0 ? n : Math.ceil(n / 2), x, y))
      const f = this.add.image(x, y, 'flits').setDepth(27).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3 * grootte * SB)
      this.tweens.add({ targets: f, scale: 1.3 * grootte * SB, alpha: 0, duration: 260 + 60 * grootte, onComplete: () => f.destroy() })
      const ring = this.add.circle(x, y, 6, 0xffffff, 0).setStrokeStyle(2, hexInt((kleuren || ['#ff3dd2'])[0]), 1).setDepth(27).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: ring, scale: 2.5 + grootte * 2, alpha: 0, duration: 380 + 80 * grootte, onComplete: () => ring.destroy() })
      if (grootte >= 1.5) this.cameras.main.shake(120 + grootte * 60, 0.004 + grootte * 0.002)
      GELUID.speel(grootte >= 2 ? 'groot' : 'klein')
    }

    /* ---- power-ups ---- */
    laatVallen(x, y, soort, id) {
      if (!soort) return
      const b = { soort, x, y, t: 0, id, spr: this.pak('cap_' + soort).setDepth(16) }
      b.spr.setPosition(x, y)
      this.buit.push(b)
    }
    pakBuit(b) {
      if (this.samen && b.id != null) this.uitgaand.push(['p', b.id])   // bij de ander verdwijnt hij
      const s = b.soort, namen = NAAM()
      let tekst = namen[s]
      if (WAPENS.includes(s)) {
        const was = this.niveau[s] || 0
        if (was >= 3) { this.punten(1000, b.x, b.y); tekst = 'MAX +1000' }
        else { this.niveau[s] = was + 1; tekst += ' ' + this.niveau[s] }
        if (!was) this.wapen = s
        GELUID.speel('pak')
      } else if (s === 'schild' && !(this.schild > 0) && !this.uit) {   // v220: geen schild aan? dan gaat hij meteen aan
        this.schild = 9; tekst = vertaal('SCHILD AAN'); GELUID.speel('schild')
      } else if (s === 'bom' || s === 'schild') { this.voorraad[s] = Math.min(9, (this.voorraad[s] || 0) + 1); tekst += ' +1'; GELUID.speel('pak') }
      else if (s === 'leven') { this.levens = Math.min(6, this.levens + 1); tekenLevens(this.levens); GELUID.speel('leven') }
      const t = this.add.text(b.x, b.y - 14, tekst, { fontFamily: '"Press Start 2P",monospace', fontSize: '8px', color: '#ffffff', stroke: KLEUR[s], strokeThickness: 3 }).setOrigin(0.5).setDepth(40).setResolution(R)
      this.tweens.add({ targets: t, y: b.y - 50, alpha: 0, duration: 1100, onComplete: () => t.destroy() })
      this.vonkVoor(KLEUR[s]).explode(14, b.x, b.y)
      werkTegelBij(); if (!arsenaal.hidden) bouwArsenaal()
    }
    gebruikBom() {
      if (!(this.voorraad.bom > 0) || this.voorbij) return
      this.voorraad.bom--
      const sp = this.speler
      GELUID.speel('bom')
      this.cameras.main.flash(260, 255, 240, 160)
      this.cameras.main.shake(500, 0.016)
      const ring = this.add.circle(sp.x, sp.y, 10, 0xffe14a, 0.25).setStrokeStyle(6, 0xffe14a, 1).setDepth(28).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: ring, scale: 70, alpha: 0, duration: 900, onComplete: () => ring.destroy() })
      for (const k of this.kogelsV) { this.vonken['#ffd23c'].explode(2, k.x, k.y); this.weg(k.spr); k.dood = true }
      this.kogelsV = []
      for (const d of this.doelen()) this.raak(d, d.baasdeel ? 30 : 40, false, this.samen ? 'bom' : undefined)
      this.onraakbaar = Math.max(this.onraakbaar, 1.2)
      if (this.samen) this.uitgaand.push(['b', Math.round(sp.x), Math.round(sp.y)])
      werkTegelBij()
    }
    /* de ander gooit een bom: hier gebeurt hetzelfde (minder fel), zonder punten */
    bomVanAnder(x, y) {
      GELUID.speel('bom')
      this.cameras.main.flash(160, 255, 240, 160)
      this.cameras.main.shake(300, 0.01)
      const ring = this.add.circle(x, y, 10, 0xffe14a, 0.2).setStrokeStyle(5, 0xffe14a, 1).setDepth(28).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: ring, scale: 70, alpha: 0, duration: 900, onComplete: () => ring.destroy() })
      for (const k of this.kogelsV) { this.vonken['#ffd23c'].explode(2, k.x, k.y); this.weg(k.spr); k.dood = true }
      this.kogelsV = []
      for (const d of this.doelen()) this.raak(d, d.baasdeel ? 30 : 40, true, 'ander')
    }
    gebruikSchild() {
      if (!(this.voorraad.schild > 0) || this.schild > 0 || this.voorbij) return
      this.voorraad.schild--
      this.schild = 9
      GELUID.speel('schild')
      werkTegelBij()
    }

    /* ---- geraakt worden ---- */
    geraakt() {
      if (this.onraakbaar > 0 || this.voorbij || this.godmode || this.overgang || this.uit) return
      if (this.schild > 0) return
      this.levens--
      tekenLevens(this.levens)
      const sp = this.speler
      if (this.samen) this.uitgaand.push(['h'])
      this.ontplof(sp.x, sp.y, 2.4, ['#5ee7e0', '#ffffff', '#ff5d9e'])
      GELUID.speel('pijn')
      this.cameras.main.flash(180, 255, 80, 140)
      const w = this.wapen; if (this.niveau[w] > 1) this.niveau[w]--
      this.combo = 1; comboVak.textContent = ''
      for (const k of this.kogelsV) { this.weg(k.spr); k.dood = true }
      this.kogelsV = []
      werkTegelBij()
      if (this.levens <= 0) { if (this.samen) this.uitGaan(); else this.einde(false); return }
      sp.setPosition(W / 2, H - 70)
      this.onraakbaar = 2.6
    }
    /* samen: je laatste leven is op. Je kijkt mee; bij het volgende level doe je weer mee. Allebei af = game over. */
    uitGaan() {
      this.uit = true
      this.speler.setVisible(false); this.vlam.setVisible(false); this.schaduw.setVisible(false); this.bel.setVisible(false)
      if (this.straalAan) { GELUID.straal(false); this.straalAan = false }
      sluitArsenaal()
      const sp = this.speler
      this.uitgaand.push(['u', Math.round(sp.x), Math.round(sp.y)])
      if (!this.anderSpeeltNog()) { this.einde(false); return }
      this.wrak = { x: sp.x, y: sp.y, eigen: true, t: 0, voortgang: 0 }
      bord('GAME OVER', vertaal('Wacht tot {naam} je komt halen, of doe bij het volgende level weer mee.', { naam: NAAMV }), '#ff5d9e', true)
    }
    /* v220: de cirkel waar een schip neerging. Is het de ander: vlieg erin en blijf er 2 s, dan is hij terug.
       Is het je eigen schip: je ziet waar de ander je moet komen halen. */
    wrakStap(dt, tijd) {
      const w = this.wrak, g = this.wrakG
      g.clear()
      if (!w || this.voorbij) { this.wrakNaam.setVisible(false); return }
      w.t += dt
      const a = this.ander
      if (w.eigen ? !this.uit : (this.uit || !a || a.weg || (w.t > 1.5 && !a.uit))) { this.wrak = null; this.wrakNaam.setVisible(false); return }
      // de kleur van het schip dat er ligt: speler 1 cyaan, speler 2 roze
      const zijnKleur = (w.eigen ? leider : !leider) ? 0x5ee7e0 : 0xff5d9e
      const tik = 0.5 + 0.5 * Math.sin(tijd / 140)
      if (!w.eigen && !this.overgang) {
        const sp = this.speler, erin = (sp.x - w.x) ** 2 + (sp.y - w.y) ** 2 < WRAK_STRAAL * WRAK_STRAAL
        w.voortgang = erin ? w.voortgang + dt : Math.max(0, w.voortgang - dt * 0.6)
        if (erin && Math.floor(w.t * 6) !== Math.floor((w.t - dt) * 6)) this.vonkVoor(w.eigen ? '#5ee7e0' : '#ffffff').explode(2, w.x, w.y)
        if (w.voortgang >= WRAK_TIJD) { this.redAnder(w); return }
      }
      g.fillStyle(zijnKleur, 0.08 + 0.08 * tik); g.fillCircle(w.x, w.y, WRAK_STRAAL)
      g.lineStyle(2, zijnKleur, 0.55 + 0.45 * tik)
      for (let i = 0; i < 12; i++) { const a0 = i * Math.PI / 6 + tijd / 900; g.beginPath(); g.arc(w.x, w.y, WRAK_STRAAL, a0, a0 + Math.PI / 10); g.strokePath() }
      if (w.voortgang > 0) {   // hoe ver het terughalen is: een witte boog rondom
        g.lineStyle(4, 0xffffff, 0.95); g.beginPath()
        g.arc(w.x, w.y, WRAK_STRAAL + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, w.voortgang / WRAK_TIJD)); g.strokePath()
      }
      g.fillStyle(0xffffff, 0.5 + 0.5 * tik); g.fillRect(w.x - 1.5, w.y - 7, 3, 14); g.fillRect(w.x - 7, w.y - 1.5, 14, 3)   // een plusje in het midden
      this.wrakNaam.setText(w.eigen ? vertaal('HIER') : NAAMV).setColor(zijnKleur === 0x5ee7e0 ? '#b8fdff' : '#ffb3d1')
        .setPosition(Math.round(w.x), Math.round(w.y - WRAK_STRAAL - 4)).setVisible(true)
    }
    /* ik heb de ander teruggehaald */
    redAnder(w) {
      this.wrak = null; this.wrakG.clear(); this.wrakNaam.setVisible(false)
      this.uitgaand.push(['g'])
      if (this.ander) { this.ander.uit = false; this.ander.gered = performance.now(); werkAnderRij(this.ander) }
      this.vonkVoor('#ffffff').explode(24, w.x, w.y)
      GELUID.speel('leven')
      balk(vertaal('{naam} IS GERED!', { naam: NAAMV }), '#5ee7e0', 3000)
    }
    /* de ander heeft mij teruggehaald: met 1 leven weer meedoen, op de plek waar ik neerging */
    gered() {
      if (!this.uit || this.voorbij) return
      const w = this.wrak
      this.uit = false; this.wrak = null; this.wrakG.clear(); this.wrakNaam.setVisible(false)
      this.levens = 1; tekenLevens(this.levens)
      this.speler.setVisible(true).setPosition(w ? w.x : W / 2, w ? w.y : H - 70)
      this.vlam.setVisible(true); this.schaduw.setVisible(!!this.schaduwAan)
      this.onraakbaar = 3
      this.vonkVoor('#ffffff').explode(24, this.speler.x, this.speler.y)
      GELUID.speel('leven')
      bord(vertaal('GERED DOOR {naam}!', { naam: NAAMV }), '', '#5ee7e0')
      werkTegelBij()
    }
    /* speelt de ander nog (in dit spel, niet af, en nog verbonden)? */
    anderSpeeltNog() {
      const a = this.ander
      return !!(a && a.ronde === ronde && !a.uit && !a.weg)
    }

    /* ---- de eindbaas ---- */
    startBaas() { this.golfStop = true; this.baasWacht = 0 }
    baasKomt() {
      const def = BAZEN[this.L.baas], n = this.level
      bord(vertaal('WAARSCHUWING'), def.naam, '#ff4848', true)
      balk(vertaal('EINDBAAS NADERT: {naam}', { naam: def.naam }), '#ff4848', 4200)
      GELUID.speel('alarm')
      GELUID.muziek(false)
      this.time.delayedCall(2200, () => { if (!this.voorbij && this.baas) GELUID.muziek(true, Object.assign({}, BAASLIED, { grond: this.L.lied.grond || 0 })) })
      const b = { def, x: W / 2, y: -100, basisY: def.y, t: 0, tb: 0, hoek: 0, binnen: false, fase: 1, laser: null, dood: false, sterft: 0, klok: {}, sp: {}, d: {}, salvo: 0 }
      b.romp = this.add.image(b.x, b.y, def.romp).setDepth(9).setScale(SB)
      if (this.schaduwAan) b.schaduw = this.add.image(b.x, b.y, def.romp).setDepth(-6).setTint(0x000000).setAlpha(0.3).setScale(0.7 * SB)
      const stijl = { fontFamily: '"Press Start 2P",monospace', fontSize: '6px', color: '#ffffff', stroke: '#07051a', strokeThickness: 2 }
      const sterker = (1 + (n - 1) * 0.12) * (this.samen ? 1.4 : 1)   // samen: twee schepen, dus een sterkere baas
      b.delen = def.delen.map((p, i) => {
        const d = Object.assign({}, p, { id: 'B' + i, hp: Math.round(p.hp * sterker), max: Math.round(p.hp * sterker), baasdeel: true, dood: false, x: 0, y: 0 })
        this.perId.set(d.id, d)
        d.spr = this.add.image(0, 0, p.key).setDepth(p.kern ? 11 : 10).setScale(SB).setFlipX(!!p.spiegel)
        d.label = this.add.text(0, 0, p.label(), stijl).setOrigin(0.5, 1).setDepth(32).setResolution(R).setVisible(false)
        b.d[p.naam] = d
        return d
      })
      this.baas = b
      baasNaamVak.textContent = def.naam
      baasBalk.style.width = '100%'
    }
    raakBaas(d, schade, stil, bron) {
      const b = this.baas; if (!b || b.dood || !b.binnen) return
      if (d.kern && b.fase === 1) { schade *= 0.2; if (bron !== 'ander' && (!stil || Math.random() < 0.1)) GELUID.speel('ketsen') }
      d.hp -= schade
      if (!stil || Math.random() < 0.1) { d.spr.setTintFill(0xffffff); d.flits = 0.05; if ((!d.kern || b.fase > 1) && bron !== 'ander') GELUID.speel('raak') }
      if (d.hp <= 0) {
        d.dood = true
        if (d.kern) { this.baasSterft(); return }
        this.ontplof(d.x, d.y, 2.5, ['#ffd23c', '#ff3dd2', '#ffffff'])
        if (bron !== 'ander') this.punten(3000, d.x, d.y, true)
        d.spr.setTexture('b_kapot').clearTint().setScale(SB).setFlipX(false); d.label.setVisible(false)
        if (b.laser && b.laser.bron === d) b.laser = null
      }
      this.werkBaasBalkBij()
    }
    /* kleine balkjes met naam bij elk onderdeel: boven de onderdelen, onder de kern */
    tekenBaasBalkjes() {
      const b = this.baas, g = this.baasG
      g.clear()
      if (!b || !b.binnen || b.dood) { if (b && b.delen) b.delen.forEach(d => d.label.setVisible(false)); return }
      for (const d of b.delen) {
        if (d.dood) { d.label.setVisible(false); continue }
        const kern = !!d.kern, bw = kern ? 40 : 30, x = d.x - bw / 2, y = kern ? d.y + d.r + 5 : d.y - d.r - 12
        const kleur = kern ? 0xff3dd2 : 0xffd23c
        g.fillStyle(0x07051a, 0.85); g.fillRect(x - 1, y - 1, bw + 2, 5)
        g.fillStyle(kleur, 1); g.fillRect(x, y, bw * Math.max(0, d.hp / d.max), 3)
        g.lineStyle(0.6, kleur, 0.9); g.strokeRect(x - 1, y - 1, bw + 2, 5)
        if (kern) d.label.setOrigin(0.5, 0).setPosition(d.x, y + 6)
        else d.label.setPosition(d.x, y - 2)
        d.label.setColor(kern && b.fase === 1 ? '#8f9cc8' : '#ffffff').setVisible(true)
      }
    }
    werkBaasBalkBij() {
      const b = this.baas; if (!b) return
      let hp = 0, max = 0
      for (const d of b.delen) { hp += Math.max(0, d.hp); max += d.max }
      baasBalk.style.width = Math.max(0, Math.round(100 * hp / max)) + '%'
    }
    baasStap(dt) {
      const b = this.baas; if (!b) return
      const def = b.def
      b.t += dt
      if (b.sterft > 0) { this.baasDoodStap(dt); return }
      if (!b.binnen) {
        b.y += (def.y - b.y) * Math.min(1, 1.1 * dt)
        if (b.t > 3.2) { b.binnen = true; baasVak.hidden = false }
      } else { b.tb += dt; def.beweeg(b, W) }
      if (def.draai) { b.hoek += def.draai * dt * (b.fase === 3 ? 1.6 : 1); b.romp.setRotation(b.hoek) }
      b.romp.setPosition(b.x, b.y)
      if (b.schaduw) b.schaduw.setPosition(b.x + 30, b.y + 48).setRotation(b.hoek)
      for (const d of b.delen) {
        if (d.baan) { const a = d.baan.hoek + b.hoek; d.x = b.x + Math.cos(a) * d.baan.straal; d.y = b.y + Math.sin(a) * d.baan.straal }
        else { d.x = b.x + d.dx; d.y = b.y + d.dy }
        d.spr.setPosition(d.x, d.y)
        if (d.fladder && !d.dood) d.spr.setScale(SB, SB * (1 + Math.sin(b.t * 12) * 0.1))
        if (d.flits > 0) { d.flits -= dt; if (d.flits <= 0) d.spr.clearTint() }
      }
      const kern = b.delen.find(d => d.kern)
      kern.spr.setScale((1 + Math.sin(b.t * 6) * 0.06) * SB)
      this.tekenBaasBalkjes()
      if (!b.binnen) return
      const schildOver = b.delen.some(d => d.schild && !d.dood)
      const fase = schildOver ? 1 : (kern.hp < kern.max * 0.35 ? 3 : 2)
      if (fase > b.fase) { b.fase = fase; if (fase === 3) bord(vertaal('WOEDEND'), '', '#ff4848') }
      if (b.fase === 3) b.romp.setTint(Math.sin(b.t * 14) > 0 ? 0xff9090 : 0xffffff)
      def.aanval(this, b, dt)
      if (b.laser) {
        const L = b.laser; L.t += dt
        if (L.bron.dood) b.laser = null
        else {
          if (L.t > LASER_RICHT - 0.45 && !L.piep) { L.piep = true; GELUID.speel('richt') }   // tweede piep: nu wegwezen
          if (L.t > LASER_RICHT && !L.vuur) { L.vuur = true; GELUID.speel('laser') }
          const wie = L.wie === 'ander' && this.anderLeeft() ? this.anderSpr : this.speler
          if (L.vuur) L.x += Phaser.Math.Clamp(wie.x - L.x, -(38 + this.level * 4) * dt, (38 + this.level * 4) * dt)
          if (L.t > LASER_RICHT + 1.4) b.laser = null
        }
      }
    }
    laserStap() {
      const b = this.baas, g = this.fx
      g.clear()
      if (!b || !b.laser || b.sterft > 0) return
      const L = b.laser, top = L.bron.y + (L.bron.laserY || 16)
      if (!L.vuur) { this.laserTeken(g, L, top); return }
      const f = 0.85 + Math.random() * 0.15
      g.fillStyle(0xff3dd2, 0.25 * f); g.fillRect(L.x - 22, top, 44, H - top)
      g.fillStyle(0xff3dd2, 0.6 * f); g.fillRect(L.x - 12, top, 24, H - top)
      g.fillStyle(0xffffff, 0.95); g.fillRect(L.x - 4, top, 8, H - top)
      if (!this.uit && Math.abs(this.speler.x - L.x) < 15 && this.speler.y > top) this.geraakt()
    }
    /* v220: de waarschuwing voor de laser. Waar hij straks schiet, kleurt een rode baan op die steeds feller knippert,
       met stippellijnen langs de randen, een gevarendriehoek onderin en een bol die oplaadt bij het kanon. */
    laserTeken(g, L, top) {
      const p = Math.min(1, L.t / LASER_RICHT)            // 0 = net begonnen, 1 = hij schiet
      const knip = Math.sin(L.t * (14 + p * 30)) > 0      // knippert steeds sneller
      g.fillStyle(0xff2a2a, (knip ? 0.1 : 0.04) + p * 0.12); g.fillRect(L.x - 22, top, 44, H - top)
      g.lineStyle(1.5, 0xff4848, knip ? 0.95 : 0.45)
      for (let y = top; y < H; y += 14) { g.lineBetween(L.x - 22, y, L.x - 22, Math.min(H, y + 7)); g.lineBetween(L.x + 22, y, L.x + 22, Math.min(H, y + 7)) }
      g.lineStyle(1, 0xffffff, 0.25 + 0.5 * p); g.lineBetween(L.x, top, L.x, H)
      g.fillStyle(0xff3dd2, 0.35 + 0.4 * p); g.fillCircle(L.x, top, 3 + p * 11)   // de bol laadt op
      g.fillStyle(0xffffff, 0.6 + 0.4 * p); g.fillCircle(L.x, top, 1.5 + p * 4)
      if (knip || p > 0.8) {   // gevarendriehoek met uitroepteken, onderin de baan
        const y = H - 130, k = 13   // boven de balk onderin, op de hoogte waar je meestal vliegt
        g.fillStyle(0xff2a2a, 0.9); g.fillTriangle(L.x, y - k, L.x - k, y + k * 0.75, L.x + k, y + k * 0.75)
        g.fillStyle(0xffffff, 1); g.fillRect(L.x - 1.5, y - 5, 3, 8); g.fillRect(L.x - 1.5, y + 5, 3, 3)
      }
    }
    baasSterft() {
      const b = this.baas
      b.sterft = 0.001; b.laser = null; b.dood = true; this.fx.clear()
      b.delen.forEach(d => { d.dood = true })
      this.tekenBaasBalkjes()
      for (const k of this.kogelsV) { this.weg(k.spr); k.dood = true }
      this.kogelsV = []
      for (const v of this.vijanden) if (v.soort === 'raketV') this.ruimVijand(v)
      GELUID.muziek(false)
      baasVak.hidden = true
      this.onraakbaar = 99
    }
    baasDoodStap(dt) {
      const b = this.baas
      if (b.weg) return
      b.sterft += dt
      b.x += (Math.random() - 0.5) * 3
      b.romp.setPosition(b.x, b.y)
      b.romp.setTint(Math.random() < 0.5 ? 0xffffff : 0xff9090)
      const bw = b.romp.displayWidth * 0.75, bh = b.romp.displayHeight * 0.7
      b.knal = (b.knal || 0) - dt
      if (b.knal <= 0 && b.sterft < 2.3) {
        b.knal = 0.15
        this.ontplof(b.x + (Math.random() - 0.5) * bw, b.y + (Math.random() - 0.5) * bh, 1.4 + Math.random(), ['#ff3dd2', '#ffd23c', '#ffffff', '#5ee7e0'])
      }
      if (b.sterft >= 2.3 && !b.weg) {
        b.weg = true
        this.ontplof(b.x, b.y, 6, ['#ffffff', '#ff3dd2', '#ffd23c', '#5ee7e0', '#ffa53c'])
        this.cameras.main.flash(500, 255, 255, 255)
        this.cameras.main.shake(700, 0.02)
        b.romp.destroy(); if (b.schaduw) b.schaduw.destroy(); b.delen.forEach(d => { d.spr.destroy(); d.label.destroy() }); this.baasG.clear()
        this.punten(20000 + (this.level - 1) * 5000, b.x, b.y, true)
        this.time.delayedCall(2000, () => { this.onraakbaar = 2; this.levelKlaar() })
      }
    }

    /* ---- elke tik ---- */
    update(tijd, delta) {
      if (this.voorbij) return
      if (this.samen) this.netStap(delta)
      if (this.pauze || this.voorbij) return
      this.dtEcht = Math.min(delta, 50) / 1000
      const dt = Math.min(delta, 50) / 1000 * this.tijdSchaal * (this.samen ? this.syncTempo() : 1)
      this.dtNu = dt
      this.klok += dt
      if (!this.zuinig && this.klok > 5 && this.klok < 6 && this.game.loop.actualFps < 40) {
        this.zuinig = true   // trage telefoon: geen lagen boven het spel (nevel, wolken), geen oplichtende lagen, minder vonken
        for (const l of this.lagen) if (l.spec.diepte >= 30 || l.spec.add) l.obj.setVisible(false)
      }
      const rem = this.baas && this.baas.binnen ? 0.65 : 1
      this.grondSnelheid = (this.L.grond || 0) * rem
      for (const l of this.lagen) if (!l.spec.vast) l.obj.tilePositionY -= l.spec.v * rem * R * dt

      // golven
      while (!this.golfStop && this.golfNr < this.golven.length && this.golven[this.golfNr].t <= this.klok) {
        this.golfId = this.golfNr; this.golfSub = 0
        this.golven[this.golfNr++].f(this)
        this.golfId = null
      }
      if (this.golfStop && !this.baas) {
        this.baasWacht += dt
        const lucht = this.vijanden.some(v => !v.dood && !v.grond)
        // samen: de baas komt bij speler 2 pas als hij er bij de uitnodiger ook is
        const a = this.ander, volg = this.samen && !this.host && a && !a.weg && a.ronde === ronde && a.level === this.level
        if (volg ? (a.baas || this.baasWacht > 12) : (this.baasWacht > 6 || (!lucht && this.baasWacht > 1.5))) this.baasKomt()
      }

      // speler: toetsen
      const sp = this.speler
      const kx = toets.r - toets.l, ky = toets.n - toets.o
      if (kx || ky) this.duw(kx * 250 * dt / Math.max(0.3, this.tijdSchaal), ky * 250 * dt / Math.max(0.3, this.tijdSchaal))
      else {
        const muisStap = muisBesturing.stap(sp, dt / Math.max(0.3, this.tijdSchaal))
        if (muisStap) this.duw(muisStap.x, muisStap.y)
      }
      this.schaduw.setPosition(sp.x + 16, sp.y + 24)
      this.vlam.setTexture((Math.floor(tijd / 60) % 2 ? 'vlam0' : 'vlam1') + this.mijnVlam).setPosition(sp.x, sp.y + 19)
      if (this.onraakbaar > 0) { this.onraakbaar -= dt; sp.setAlpha(Math.floor(this.onraakbaar * 12) % 2 ? 0.35 : 1) } else sp.setAlpha(1)
      if (this.schild > 0) { this.schild -= dt; this.bel.setVisible(this.schild > 2 || Math.floor(this.schild * 8) % 2 === 0).setPosition(sp.x, sp.y).setRotation(tijd / 300) }
      else this.bel.setVisible(false)

      // schieten
      this.vuur(dt)
      if (this.samen) { this.anderStap(dt, tijd); this.wrakStap(dt, tijd) }

      // vijanden
      for (const v of this.vijanden) if (!v.dood && !this.vijandStap(v, dt)) this.ruimVijand(v)
      this.vijanden = this.vijanden.filter(v => !v.dood)
      this.hekStap()
      this.baasStap(dt)

      // kogels van de speler
      const doelen = this.doelen()
      const b = this.baas, blok = b && b.binnen && !b.dood && b.def.blok
      for (const lijst of this.kogelsA.length ? [this.kogelsS, this.kogelsA] : [this.kogelsS]) for (const k of lijst) {
        if (k.raket) {
          k.leeft += dt
          if (k.leeft > 0.12) {
            let best = null, bd = 1e9
            for (const d of doelen) { if (d.dood) continue; const dd = (d.x - k.x) ** 2 + (d.y - k.y) ** 2; if (dd < bd) { bd = dd; best = d } }
            const sn = 430, wens = best ? Math.atan2(best.y - k.y, best.x - k.x) : -Math.PI / 2
            let a = Math.atan2(k.vy, k.vx), verschil = Phaser.Math.Angle.Wrap(wens - a)
            a += Phaser.Math.Clamp(verschil, -7 * dt, 7 * dt)
            k.vx = Math.cos(a) * sn; k.vy = Math.sin(a) * sn
            k.spr.setRotation(a + Math.PI / 2)
            if (Math.random() < 0.6) this.vonken['#ffa53c'].explode(1, k.x, k.y)
          }
        }
        k.x += k.vx * dt; k.y += k.vy * dt
        k.spr.setPosition(k.x, k.y)
        if (k.y < -30 || k.x < -30 || k.x > W + 30 || k.y > H + 30 || (k.raket && k.leeft > 2.4)) { k.dood = true; continue }
        for (const d of doelen) {
          if (d.dood) continue
          const rr = d.r + k.r
          if ((d.x - k.x) ** 2 + (d.y - k.y) ** 2 < rr * rr) {
            if (k.dmg) this.raak(d, k.dmg)   // de kogels van de ander (dmg 0) raken hier niets: dat komt via de lijn
            k.dood = true
            this.vonken[k.raket ? '#ffa53c' : k.spr.texture.key === 'spreidKogel' ? '#ff5d9e' : '#5ee7e0'].explode(3, k.x, k.y)
            break
          }
        }
        // de romp van de baas houdt kogels tegen
        if (!k.dood && blok && Math.abs(k.x - b.x) < blok.b && k.y < b.y + blok.onder && k.y > b.y - blok.boven) {
          k.dood = true; this.vonken['#ffffff'].explode(2, k.x, k.y); if (k.dmg) GELUID.speel('ketsen')
        }
      }
      this.kogelsS = this.kogelsS.filter(k => { if (k.dood) this.weg(k.spr); return !k.dood })
      if (this.kogelsA.length) this.kogelsA = this.kogelsA.filter(k => { if (k.dood) this.weg(k.spr); return !k.dood })
      this.straalStap(dt)

      // kogels van de vijand
      const hit = 4
      for (const k of this.kogelsV) {
        if (k.ay) k.vy += k.ay * dt
        k.x += k.vx * dt; k.y += k.vy * dt
        k.spr.setPosition(k.x, k.y)
        if (k.y < -80 || k.x < -30 || k.x > W + 30 || k.y > H + 30) { k.dood = true; continue }
        if (this.uit) continue
        const dx = k.x - sp.x, dy = k.y - sp.y
        if (this.schild > 0 && dx * dx + dy * dy < 26 * 26) { k.dood = true; this.vonken['#7fd4ff'].explode(4, k.x, k.y); continue }
        if (dx * dx + dy * dy < (hit + k.r) * (hit + k.r)) { k.dood = true; this.geraakt(); break }
      }
      this.kogelsV = this.kogelsV.filter(k => { if (k.dood) this.weg(k.spr); return !k.dood })

      // botsen met vijanden in de lucht
      if (!this.uit) for (const v of this.vijanden) {
        if (v.dood || v.grond) continue
        const rr = v.r + (this.schild > 0 ? 20 : 8)
        if ((v.x - sp.x) ** 2 + (v.y - sp.y) ** 2 < rr * rr) {
          if (this.schild > 0) this.raak(v, 12)
          else if (this.onraakbaar <= 0 && !this.overgang) { this.raak(v, 10); this.geraakt() }
        }
      }
      this.laserStap()

      // buit
      for (const bt of this.buit) {
        if (bt.dood) continue   // (de ander pakte hem net)
        bt.t += dt; bt.y += 55 * dt; bt.x += Math.sin(bt.t * 3) * 20 * dt
        bt.spr.setPosition(bt.x, bt.y).setScale((1 + Math.sin(bt.t * 8) * 0.08) * SB)
        if (!this.uit && (bt.x - sp.x) ** 2 + (bt.y - sp.y) ** 2 < 30 * 30) { bt.dood = true; this.pakBuit(bt) }
        else if (bt.y > H + 30) bt.dood = true
      }
      this.buit = this.buit.filter(bt => { if (bt.dood) this.weg(bt.spr); return !bt.dood })

      // combo en score
      if (this.comboTijd > 0) { this.comboTijd -= dt; if (this.comboTijd <= 0) { this.combo = 1; comboVak.textContent = '' } }
      if (this.getoond < this.score) {
        this.getoond += Math.max(1, Math.ceil((this.score - this.getoond) * 0.2))
        if (this.getoond > this.score) this.getoond = this.score
        scoreVak.textContent = String(this.getoond).padStart(7, '0')
      }
    }

    /* ---- pauze (app op de achtergrond) ---- */
    /* samen: pauzeert de een, dan wacht de ander ook (vanAnder); verder gaat het als niemand meer pauzeert */
    pauzeer(vanAnder) {
      if (this.voorbij) return
      if (vanAnder) this.pauzeAnder = true
      else if (!this.pauzeEigen) { this.pauzeEigen = true; if (this.samen) net.stuurNu({ t: 'z', r: ronde, p: 1 }) }
      if (!this.pauze) {
        this.pauze = true
        GELUID.muziek(false); GELUID.straal(false); this.straalAan = false
        sluitArsenaal()
      }
      this.toonPauze()
    }
    toonPauze() {
      if (this.pauzeEigen) bord(vertaal('GEPAUZEERD'), vertaal('Tik om verder te gaan'), '#5ee7e0', true)
      else bord(vertaal('{naam} PAUZEERT', { naam: NAAMV }), vertaal('Even wachten…'), '#ff5d9e', true)
      bordVak.className = 'bord vast'
    }
    hervat(vanAnder) {
      if (vanAnder) { if (!this.pauzeAnder) return; this.pauzeAnder = false }
      else { if (!this.pauzeEigen) return; this.pauzeEigen = false; if (this.samen) net.stuurZeker({ t: 'z', r: ronde, p: 0 }) }
      if (!this.pauze || this.voorbij) return
      if (this.pauzeEigen || this.pauzeAnder) { this.toonPauze(); return }
      this.pauze = false
      bordVak.className = 'bord'
      GELUID.muziek(true, this.baas && this.baas.binnen && !this.baas.dood ? Object.assign({}, BAASLIED, { grond: this.L.lied.grond || 0 }) : this.L.lied)
    }

    /* ================= samen spelen ================= */
    /* elke tik: kijken of de ander er nog is, en (20 keer per seconde, via de reserve 4 keer) berichten sturen */
    netStap(delta) {
      const a = this.ander, nu = performance.now()
      const geduld = this.pauzeAnder ? 30000 : net.rechtstreeks() ? 4000 : 6000
      if (a && !a.weg && nu - a.ontvangen > geduld) {
        a.weg = true; a.zichtbaar = false; werkAnderRij(a)
        if (!a.uit) balk(vertaal('{naam}: VERBINDING WEG', { naam: NAAMV }), '#ff5d9e', 3500)
        if (this.pauzeAnder) this.hervat(true)
        if (this.uit) { this.einde(false); return }
      }
      // op de echte klok (Phaser maakt delta glad als het beeld hapert)
      if (nu - this.stuurKlok < (net.rechtstreeks() ? 50 : 250)) return
      this.stuurKlok = nu
      this.stuurUit()
      net.stuurSnel(this.stand())
    }
    stuurUit() {
      if (this.raakBuf.size) { for (const [id, sch] of this.raakBuf) this.uitgaand.push(['r', id, Math.round(sch * 100) / 100]); this.raakBuf.clear() }
      if (this.uitgaand.length) { net.stuurZeker({ t: 'e', r: ronde, l: this.level, e: this.uitgaand }); this.uitgaand = [] }
    }
    /* mijn stand: plek, vlaggen (1 schiet, 2 schild, 4 knippert, 8 af, 16 pauze, 32 baas, 64 wissel van level), wapen, score */
    stand() {
      const sp = this.speler, b = this.baas
      let f = 0
      if (vuurtNu() && !this.overgang && !this.uit) f |= 1
      if (this.schild > 0) f |= 2
      if (this.onraakbaar > 0 && this.onraakbaar < 50) f |= 4
      if (this.uit) f |= 8
      if (this.pauze) f |= 16
      if (b) f |= 32
      if (this.overgang) f |= 64
      const m = { t: 's', r: ronde, l: this.level, k: Math.round(this.klok * 1000) / 1000, x: Math.round(sp.x * 10) / 10, y: Math.round(sp.y * 10) / 10, f,
        w: WAPENS.indexOf(this.wapen), n: this.niveau[this.wapen] || 1, sc: this.score, lv: this.levens }
      if (b && b.binnen && !b.dood) m.bh = b.delen.map(d => Math.round(Math.max(0, d.hp) * 10) / 10)
      return m
    }
    /* een bericht van de ander */
    ontvang(m) {
      const nu = performance.now()
      if (m.t === 's') {
        if (this.voorbij || (m.r | 0) !== ronde || typeof m.x !== 'number' || typeof m.y !== 'number') return
        let a = this.ander
        const nieuw = !a
        if (!a) a = this.ander = { tempo: 1, vx: 0, vy: 0, snap: true, score: 0, levens: 3 }
        const l = Math.min(AANTAL_LEVELS, Math.max(1, m.l | 0)), k = +m.k || 0
        if (!nieuw && !a.weg && a.level === l) {
          const dtw = (nu - a.ontvangen) / 1000
          if (dtw > 0.015) {
            a.tempo = a.tempo * 0.8 + Phaser.Math.Clamp((k - a.klok) / dtw, 0, 6) * 0.2
            a.vx = Phaser.Math.Clamp((m.x - a.x) / dtw, -900, 900); a.vy = Phaser.Math.Clamp((m.y - a.y) / dtw, -900, 900)
          }
        } else { a.vx = 0; a.vy = 0; a.snap = true }
        if (a.weg) { a.weg = false; if (!this.voorbij) balk(vertaal('{naam} IS TERUG', { naam: NAAMV }), '#5ee7e0', 2500) }
        a.ronde = m.r | 0; a.level = l; a.klok = k; a.ontvangen = nu
        a.x = m.x; a.y = m.y; a.f = m.f | 0; a.w = m.w | 0; a.n = m.n | 0
        a.uit = !!(a.f & 8) && !(a.gered && nu - a.gered < 1500); a.pauze = !!(a.f & 16); a.baas = !!(a.f & 32)   // v220: net gered
        a.score = m.sc | 0; a.levens = m.lv | 0
        werkAnderRij(a)
        if (a.uit && this.uit) { this.einde(false); return }      // allebei af
        if (l > this.level) this.naarLevel(l)                     // wie het hoogste level heeft, bepaalt het level
        else if (l === this.level && Array.isArray(m.bh)) this.baasSamen(m.bh)
        return
      }
      if (m.t === 'e') {
        if ((m.r | 0) !== ronde || !Array.isArray(m.e)) return
        const zelfde = (m.l | 0) === this.level && !this.voorbij
        for (const e of m.e.slice(0, 400)) {
          if (!Array.isArray(e)) continue
          if (e[0] === 'u') {
            if (this.ander) { this.ander.uit = true; werkAnderRij(this.ander) }
            if (this.voorbij) continue
            if (this.uit) this.einde(false)
            else if (zelfde && typeof e[1] === 'number' && typeof e[2] === 'number') {   // v220: zijn plek, om hem terug te halen
              this.wrak = { x: Phaser.Math.Clamp(e[1], 30, W - 30), y: Phaser.Math.Clamp(e[2], 100, H - 40), eigen: false, t: 0, voortgang: 0 }
              balk(vertaal('HAAL {naam} TERUG: VLIEG NAAR DE CIRKEL', { naam: NAAMV }), '#ff5d9e', 4500)
            } else balk(vertaal('{naam}: GAME OVER', { naam: NAAMV }), '#ff5d9e', 3000)
          } else if (e[0] === 'x') {
            if (this.ander) { this.ander.score = e[1] | 0; werkAnderRij(this.ander) }
            if (this.voorbij) toonAnderEinde(e[1] | 0)
          } else if (!zelfde) continue
          else if (e[0] === 'r') { const d = this.perId.get(e[1]); if (d && !d.dood) this.raak(d, Math.max(0, Math.min(500, +e[2] || 0)), true, 'ander') }
          else if (e[0] === 'p') { const bt = this.buit.find(x => x.id === e[1] && !x.dood); if (bt) { bt.dood = true; this.vonkVoor(KLEUR[bt.soort]).explode(10, bt.x, bt.y) } }
          else if (e[0] === 'g') this.gered()
          else if (e[0] === 'b') this.bomVanAnder(Phaser.Math.Clamp(+e[1] || 0, 0, W), Phaser.Math.Clamp(+e[2] || 0, 0, H))
          else if (e[0] === 'h') { if (this.anderLeeft()) this.ontplof(this.anderSpr.x, this.anderSpr.y, 2, leider ? ['#ff5d9e', '#ffffff', '#5ee7e0'] : ['#5ee7e0', '#ffffff', '#ff5d9e']) }
        }
        return
      }
      if (m.t === 'z' && (m.r | 0) === ronde) { if (m.p) this.pauzeer(true); else this.hervat(true) }
    }
    /* de baas: van elk onderdeel telt de laagste stand van ons tweeën */
    baasSamen(bh) {
      const b = this.baas
      if (!b || !b.binnen || b.dood || bh.length !== b.delen.length) return
      let anders = false
      b.delen.forEach((d, i) => {
        const hp = +bh[i]
        if (d.dood || !(hp < d.hp - 0.05)) return
        d.hp = hp; anders = true
        if (d.hp <= 0) this.raakBaas(d, 0, true, 'ander')
      })
      if (anders && this.baas && !this.baas.dood) this.werkBaasBalkBij()
    }
    /* de ander is al in een hoger level: meteen mee */
    naarLevel(n) {
      if (this.overgang || this.voorbij || n > AANTAL_LEVELS || n <= this.level) return
      if (this.baas && this.baas.sterft > 0) return   // mijn baas is al stuk: het volgende level komt vanzelf
      this.overgang = 1
      if (this.straalAan) { GELUID.straal(false); this.straalAan = false }
      this.cameras.main.fadeOut(300, 7, 5, 26)
      this.time.delayedCall(330, () => {
        if (this.voorbij) return
        this.startLevel(n)
        this.onraakbaar = Math.max(this.onraakbaar, 2)
        this.cameras.main.fadeIn(500, 7, 5, 26)
      })
    }
    /* speler 2 volgt de speltijd van de uitnodiger: iets sneller of langzamer, of (na een grote sprong) meteen gelijk */
    syncTempo() {
      if (this.host) return 1
      const a = this.ander
      if (!a || a.weg || a.ronde !== ronde || a.level !== this.level || a.pauze || this.overgang || (a.f & 64)) return 1
      const schat = a.klok + Math.min(1.5, (performance.now() - a.ontvangen) / 1000) * a.tempo
      const verschil = schat - this.klok
      if (Math.abs(verschil) > 2) { this.springKlok(schat); return 1 }
      return Phaser.Math.Clamp(1 + verschil * 0.6, 0.8, 1.25)
    }
    springKlok(k) {
      // vooruit: golven die al lang voorbij zijn overslaan (anders komen ze allemaal tegelijk); de baas-golf blijft
      while (k > this.klok && !this.golfStop && this.golfNr < this.golven.length && this.golven[this.golfNr].t < k - 1.5 && !this.golven[this.golfNr].baas) this.golfNr++
      this.klok = k
    }
    /* het schip van de ander: zachtjes naar de laatste plek (een beetje vooruit), met vlam, schild, naam en kogels */
    anderStap(dt, tijd) {
      const a = this.ander, s = this.anderSpr
      const zien = !!(a && !a.weg && !a.uit && a.ronde === ronde && a.level === this.level && !(a.f & 64))
      if (a) a.zichtbaar = zien
      if (!zien) {
        if (s.visible) { s.setVisible(false); this.anderVlam.setVisible(false); this.anderNaam.setVisible(false); this.anderBel.setVisible(false); this.anderSchaduw.setVisible(false) }
        return
      }
      const oud = Math.min((performance.now() - a.ontvangen) / 1000, net.rechtstreeks() ? 0.15 : 0.3)
      const tx = Phaser.Math.Clamp(a.x + a.vx * oud, 18, W - 18), ty = Phaser.Math.Clamp(a.y + a.vy * oud, 70, H - 24)
      if (a.snap || !s.visible || Math.abs(tx - s.x) + Math.abs(ty - s.y) > 160) { s.setPosition(tx, ty); a.snap = false }
      else { const k = Math.min(1, (this.dtEcht || 0.016) * 14); s.x += (tx - s.x) * k; s.y += (ty - s.y) * k }
      s.setVisible(true).setAlpha((a.f & 4) && Math.floor(tijd / 80) % 2 ? 0.35 : 1)
      this.anderVlam.setVisible(true).setTexture((Math.floor(tijd / 60) % 2 ? 'vlam1' : 'vlam0') + this.zijnVlam).setPosition(s.x, s.y + 19)
      this.anderNaam.setVisible(true).setPosition(Math.round(s.x), Math.round(s.y - 34))
      this.anderBel.setVisible(!!(a.f & 2)).setPosition(s.x, s.y).setRotation(-tijd / 300)
      this.anderSchaduw.setVisible(!!this.schaduwAan).setPosition(s.x + 16, s.y + 24)
      // de kogels van de ander: alleen om te zien (wat ze raken, komt via de lijn)
      const st = this.anderSt; st.herlaad -= dt; st.raketKlok -= dt
      const w = WAPENS[a.w] || 'puls'
      if ((a.f & 1) && w !== 'straal' && st.herlaad <= 0) this.salvo(st, s.x, s.y, w, Math.min(3, Math.max(1, a.n || 1)), (key, x, y, vx, vy, dmg, extra) => this.schotA(key, x, y, vx, vy, extra))
    }
    schotA(key, x, y, vx, vy, extra) {
      const k = Object.assign({ spr: this.pak(key).setDepth(14).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.75), x, y, vx, vy, dmg: 0, r: 6 }, extra || {})
      k.spr.setPosition(x, y).setRotation(Math.atan2(vy, vx) + Math.PI / 2)
      this.kogelsA.push(k)
    }

    einde(gewonnen) {
      if (this.voorbij) return
      this.voorbij = true
      GELUID.muziek(false); GELUID.straal(false)
      sluitArsenaal()
      this.straalG.clear(); this.fx.clear(); this.hekG.clear()
      for (const k of this.kogelsS.concat(this.kogelsV, this.kogelsA)) this.weg(k.spr)
      this.kogelsS = []; this.kogelsV = []; this.kogelsA = []
      if (gewonnen) { this.score += this.levens * 10000; GELUID.speel('klaar') } else GELUID.speel('einde')
      // Eén eindscore per ronde, voor solo én samen. De eigen score telt; nooit die van de ander.
      const scoreRonde = { id: this.scoreRondeId, score: this.score, playedAt: new Date().toISOString(), level: this.level,
        won: gewonnen, mode: this.samen ? 'co-op' : 'solo' }
      Promise.resolve(this.scoreEigenaar).then(ownerId => scoreService.saveRun({ ...scoreRonde, ownerId }))
        .catch(error => console.warn('[nr-score]', error))
      scoreVak.textContent = String(this.score).padStart(7, '0')
      if (this.samen) {   // het laatste nieuws (ook mijn eindscore) meteen naar de ander; daarna stuurt dit spel niets meer
        this.uitgaand.push(['x', this.score])
        this.stuurUit()
      }
      toonEinde(gewonnen, this.score, this.levens, this.level, this.ander ? this.ander.score : 0)
    }
  }
  Object.assign(Spel.prototype, TEKENAAR)

  /* ---------- schermen ---------- */
  function toonRecord() {
    const r = solo && typeof solo.record === 'function' ? solo.record() : 0
    recordVak.textContent = r ? vertaal('RECORD {n}', { n: String(r).padStart(7, '0') }) : ''
  }
  function toonVerder() {
    verderKnop.hidden = true
    verderBediening?.reset()
    verderKnop.textContent = vertaal('VERDER: LEVEL {n}', { n: bereikt })
  }
  function toonEinde(gewonnen, score, levens, level, anderScore) {
    opnieuwScherm = true
    const nieuw = solo && typeof solo.nieuweScore === 'function' ? solo.nieuweScore(score) : false
    h1.innerHTML = gewonnen ? vertaal('GEWONNEN!') + '<span>NEON RAIDERS</span>' : 'GAME<span>OVER</span>'
    sub.textContent = 'SCORE ' + String(score).padStart(7, '0') + (nieuw ? ' · ' + vertaal('NIEUW RECORD!') : '')
    uitleg.textContent = gewonnen ? vertaal('Alle zeven levels gehaald. Bonus voor je levens: {n}.', { n: getal(levens * 10000) })
      : samen ? vertaal('Jullie schepen zijn neergeschoten. Jullie kwamen tot level {n}.', { n: level })
      : vertaal('Je schip is neergeschoten.') + ' ' + vertaal('Je kwam tot level {n}.', { n: level })
    uitleg2.textContent = samen ? vertaal('{naam}: SCORE {score}', { naam: NAAMV, score: String(anderScore || 0).padStart(7, '0') })
      : vertaal('De tegel linksboven: wapen wisselen of een power-up gebruiken.') + toetsUitleg
    toonRecord(); toonVerder()
    startKnop.textContent = vertaal('OPNIEUW')
    werkStartscherm()
    laag.hidden = false
    try { startKnop.focus({ preventScroll: true }) } catch (e) {}
  }
  const toonAuto = () => { autoKnop.textContent = autovuur ? vertaal('AUTOVUUR: AAN') : vertaal('AUTOVUUR: UIT') }
  const toonGeluid = () => { geluidKnop.textContent = GELUID.staatAan() ? vertaal('GELUID: AAN') : vertaal('GELUID: UIT') }
  const aanraak = window.matchMedia && window.matchMedia('(pointer:coarse)').matches
  const toetsUitleg = aanraak ? '' : ' ' + vertaal('Toetsen: pijltjes = vliegen, spatie = schieten, Q = tegel.')
  uitleg2.textContent += toetsUitleg
  toonAuto(); toonGeluid(); toonRecord(); toonVerder(); werkTegelBij(); werkStartscherm()
  autoKnop.addEventListener('click', e => { e.stopPropagation(); autovuur = !autovuur; try { localStorage.setItem('nr-autovuur', autovuur ? 'aan' : 'uit') } catch (x) {} toonAuto() })
  geluidKnop.addEventListener('click', e => { e.stopPropagation(); GELUID.zet(!GELUID.staatAan()); toonGeluid() })

  let aftellen = false
  function startRonde(level) {
    if (aftellen) return
    opnieuwScherm = false
    toonVerder()
    GELUID.wek()
    aftellen = true
    partnerKlaar = !samen
    if (samen) {   // (de ander kan opnieuw starten terwijl dit spel nog loopt)
      sluitArsenaal(); laag.hidden = false; rolVak.textContent = ''
      if (huidige) { try { huidige.voorbij = true } catch (e) {} }
      GELUID.muziek(false); GELUID.straal(false)
    }
    beginLevel = Math.min(AANTAL_LEVELS, Math.max(1, level || 1))
    indeling()
    H = Math.round(Math.min(800, Math.max(560, W * veld.clientHeight / Math.max(1, veld.clientWidth))) / 2) * 2
    R = window.__nrScherpte || ((window.devicePixelRatio || 1) >= 1.5 ? 2 : 1); SB = 1 / R
    h1.innerHTML = 'NEON<span>RAIDERS</span>'
    let n = 3
    const stap = () => {
      if (!isActief() || !wrap.isConnected) return
      if (n === 0) {
        GELUID.speel('go'); aftellen = false
        laag.hidden = true
        wisBesturing()
        huidige = null
        if (spel) { try { spel.destroy(true) } catch (e) {} spel = null }
        spel = new Phaser.Game({
          type: Phaser.AUTO, width: W * R, height: H * R, parent: veld,
          antialias: true, backgroundColor: '#07051a',
          input: { activePointers: 4, keyboard: false, mouse: false, touch: false },
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          scene: [Spel]
        })
        return
      }
      sub.textContent = vertaal('LEVEL {n} · {naam}', { n: beginLevel, naam: LEVELS[beginLevel].naam() }) + ' — ' + n
      GELUID.speel('tel')
      n--; setTimeout(stap, 600)
    }
    stap()
  }
  function begin(level) {
    if (aftellen) return
    if (samen) {   // samen: alleen de uitnodiger start, voor allebei
      if (!leider || !partnerKlaar || netModus === 'zoeken') return
      ronde++
      net.stuurZeker({ t: 'start', l: level, r: ronde })
    }
    startRonde(level)
  }
  const magVerder = () => opnieuwScherm && bereikt > 1 && leider && !aftellen && !laag.hidden &&
    !startKnop.hidden && !startKnop.disabled && isActief() && wrap.isConnected
  verderBediening = koppelNeonVerder({ startKnop, verderKnop, kanTonen:magVerder,
    onStart:() => { if (isActief() && wrap.isConnected) begin(1) } })
  verderKnop.addEventListener('click', e => {
    e.stopPropagation()
    if (!verderKnop.hidden && magVerder()) begin(bereikt)
  })

  const zichtbaarheid = () => { if (document.hidden) { wisBesturing(); if (huidige) huidige.pauzeer() } }
  document.addEventListener('visibilitychange', zichtbaarheid)
  const wekGeluid = () => GELUID.wek()
  wrap.addEventListener('pointerdown', wekGeluid)

  /* ---------- opruimen zodra het spel gesloten wordt ---------- */
  const waker = setInterval(() => {
    if (isActief() && wrap.isConnected) {
      if (samen && !leider && !laag.hidden && !aftellen) {   // ik sta op het startscherm: de uitnodiger kan starten
        klaarKlok += 300
        if (klaarKlok >= 900) { klaarKlok = 0; net.stuurSnel({ t: 'klaar' }) }
      }
      if (samen && leider && partnerKlaar && !aftellen && performance.now() - laatsteKlaar > 3500) { partnerKlaar = false; werkStartscherm() }
      return
    }
    clearInterval(waker)
    scorebord.destroy()
    verderBediening.destroy()
    if (net) net.sluit()
    clearTimeout(arsenaalKlok)
    GELUID.stop()
    window.removeEventListener('keydown', toetsNeer)
    window.removeEventListener('keyup', toetsOp)
    window.removeEventListener('blur', wisBesturing)
    window.removeEventListener('resize', indeling)
    window.removeEventListener('orientationchange', indeling)
    document.removeEventListener('visibilitychange', zichtbaarheid)
    huidige = null
    if (spel) { try { spel.destroy(true) } catch (e) {} spel = null }
    if (wrap.isConnected) wrap.remove()
  }, 300)

  return { _proef: { scene: () => huidige, spel: () => spel, start: startRonde, net: () => net, modus: () => netModus, ronde: () => ronde } }
}
