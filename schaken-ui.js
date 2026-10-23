import { stukSVG, registreerSlag, veroverdePunten, STUKPUNTEN } from './schaak-stukken.js?v=1'
const SETTINGS_KEY = 'fibro_chess_settings_v1'
const READABLE_NAMES = { P:'pawn', N:'knight', B:'bishop', R:'rook', Q:'queen', K:'king' }
function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    const thinking = Number(saved.thinking ?? 7)
    return { ...saved, thinking:Number.isFinite(thinking) ? Math.min(7,Math.max(0,thinking)) : 7, pieces:['small','medium','large'].includes(saved.pieces) ? saved.pieces : 'medium', board:['classic','wood','marble','glass'].includes(saved.board) ? saved.board : 'classic', soundTheme:['classic','wood'].includes(saved.soundTheme) ? saved.soundTheme : 'classic', showAttackRoutes:saved.showAttackRoutes === true, exaggerate:saved.exaggerate === true, pointsPerPiece:saved.pointsPerPiece === true, noobMode:saved.noobMode === true, camerasAtTop:saved.camerasAtTop === true }
  } catch { return { thinking:7, pieces:'medium', board:'classic', soundTheme:'classic', showAttackRoutes:false, exaggerate:false, pointsPerPiece:false, noobMode:false, camerasAtTop:false } }
}
// schaken-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.
export function start({ Schaak, Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
  vriendNaam = vriendNaam || 'Opponent'
  // Coaching aids can reveal tactical information to one player only. Keep them
  // for computer games, where there is no fairness concern.
  const isVriendPartij = !spelKanaal.isSolo
  document.getElementById('spelTitelBar').textContent = '♟️ Chess'
  const inhoud = document.getElementById('spelInhoud')

  let staat = Schaak.nieuweSpelStaat()
  const mijnKleur = benIkSpeler1 ? 'w' : 'z'
  const vriendKleur = benIkSpeler1 ? 'z' : 'w'
  let veroverd = { w:[], z:[] }
  let routeStuk = null
  let geselecteerd = null      // [r,k] van geselecteerd stuk
  let mogelijkeZetten = []     // legale zetten voor geselecteerd stuk
  let gameOver = false
  let bezig = false
  let promotieOpen = false
  let generatie = 0
  let checkmateTimers = []
  let pendingNoobMove = null
  let wachtrij = Promise.resolve()
  const minderBeweging = matchMedia('(prefers-reduced-motion: reduce)')
  const instellingen = readSettings()
  let laatsteZet = null        // voor highlight van laatste zet

  // Bord wordt altijd getoond met wit onderaan vanuit perspectief van de witte speler,
  // en zwart onderaan vanuit perspectief van de zwarte speler
  const omgedraaid = mijnKleur === 'z'

  inhoud.innerHTML = `
    <style>
      .sch-spel { display:flex; flex-direction:column; align-items:center; flex:none; gap:8px; width:100%; }
      .sch-frame { box-sizing:border-box; container-type:inline-size; flex:none; width:min(360px,82vw,calc(100% - 12px),max(180px,calc(100dvh - 290px))); padding:7px; border-radius:12px; transition:width .25s ease;
        background:linear-gradient(135deg,#d9ae76,#765032 45%,#39271e); box-shadow:0 9px 0 #39271e,0 12px 0 #211811,0 22px 30px #0008,inset 0 1px 1px #fff9; }
      .sch-spel.sch-groot .sch-frame { width:min(720px,calc(100% - 12px),max(320px,calc(100dvh - 380px))); }
      #sch-bord { display:grid; grid-template-columns:repeat(8,1fr); aspect-ratio:1; width:100%; touch-action:none; user-select:none; }
      .sch-vak { border:0; border-radius:0; padding:0; min-width:0; position:relative; display:grid; place-items:center; cursor:pointer; aspect-ratio:1; }
      .sch-vak:focus-visible { outline:3px solid #55dfff; outline-offset:-3px; z-index:2; }
      .sch-stuk { display:block; width:88%; aspect-ratio:1; line-height:1; pointer-events:none; position:relative; z-index:1; filter:drop-shadow(0 2px 1px #0006); }
      .sch-figuur { display:block; width:100%; height:100%; overflow:visible; }
      .sch-ivoor { color:#fff9e9; --sch-line:#40362e; }
      .sch-ebben { color:#282634; --sch-line:#d5c6b2; }
      .sch-type-N { transform:scale(1.09); transform-origin:50% 85%; }
      .sch-vangst { box-sizing:border-box; width:min(420px,calc(100vw - 20px)); padding:6px 10px; border:1px solid #bca98b70; border-radius:9px; background:linear-gradient(120deg,#39303e,#211c2b); color:#fff8ed; }
      .sch-vangst-kop { display:flex; justify-content:space-between; gap:8px; font-size:12px; }
      .sch-vangst-stukken { display:flex; flex-wrap:wrap; gap:0; min-height:24px; align-items:center; }
      .sch-vangst-stukken .sch-figuur { width:22px; height:24px; }
      .sch-vangst-stuk { display:inline-flex; align-items:center; gap:1px; min-height:26px; }
      .sch-vangst-waarde { color:#f5d59c; font-size:10px; font-weight:750; line-height:1; text-shadow:0 1px 2px #000; }
      .sch-promo-btn .sch-figuur { width:40px; height:40px; }
      .sch-legenda { font-size:11px; color:#eee1cf; text-align:center; }
      .sch-board-tools { display:flex; align-items:center; gap:6px; padding:4px; border:1px solid #b7c7e435; border-radius:16px; background:linear-gradient(145deg,#273044ee,#131a28f5); box-shadow:inset 0 1px 0 #ffffff16,0 5px 16px #0004; }
      .sch-board-label { padding-inline:8px 3px; color:#b6c4d9; font-size:10px; font-weight:750; letter-spacing:.08em; text-transform:uppercase; }
      .sch-size-switch { display:flex; align-items:center; gap:3px; }
      .sch-size-switch button,.sch-settings { position:relative; display:inline-flex; align-items:center; justify-content:center; gap:6px; overflow:hidden; border:1px solid transparent; background:transparent; color:#bfcce0; padding:8px 10px; border-radius:11px; min-height:40px; font:inherit; font-size:12px; font-weight:650; cursor:pointer; touch-action:manipulation; user-select:none; -webkit-touch-callout:none; transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease; }
      .sch-size-switch button[aria-pressed="true"] { background:linear-gradient(135deg,#beece3,#79bcb9); border-color:#d0fff055; color:#102f33; box-shadow:inset 0 1px 0 #ffffff80,0 2px 7px #0004; }
      .sch-board-tools svg { width:17px; height:17px; flex:none; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
      .sch-settings { width:40px; padding:8px; border-inline-start-color:#d2e2ff20; }
      .sch-board-tools button:focus-visible { outline:2px solid #9af2df; outline-offset:3px; }
      .sch-board-tools button:active { transform:scale(.95); }
      @media (hover:hover) { .sch-board-tools button:hover { background-color:#ffffff16; color:#fff; } .sch-size-switch button[aria-pressed="true"]:hover { color:#102f33; filter:brightness(1.07); } }
      @media (prefers-reduced-motion:reduce) { .sch-frame,.sch-board-tools button { transition:none; } }
      .sch-zoom::after { content:""; position:absolute; height:3px; left:10px; right:10px; bottom:3px; background:#f5ce86; transform:scaleX(0); transform-origin:left; transition:transform 1s linear; }
      .sch-zoom.sch-lange-druk::after { transform:scaleX(1); }
      .sch-acties { position:relative; display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; }
      .sch-video { margin-left:7px; min-height:44px; padding:10px 13px; border:1px solid #78e7cb99; border-radius:12px; background:linear-gradient(135deg,#164d4c,#267967); color:#eafff9; font:inherit; font-weight:700; cursor:pointer; transition:transform .16s ease,filter .2s ease,box-shadow .2s ease; }
      .sch-video:active, .sch-video.is-connecting { transform:translateY(2px) scale(.965); filter:brightness(.9); box-shadow:inset 0 3px 8px #001d1aaa; }
      .sch-video.is-connecting { animation:sch-video-pulse 1.05s ease-in-out infinite; }
      .sch-video.is-connecting::first-letter { display:inline-block; }
      .sch-media-controls { display:flex; align-items:center; justify-content:center; gap:6px; }
      .sch-video.sch-video-stop { position:static; z-index:5; width:29px; min-width:29px; height:29px; min-height:29px; margin:0; padding:0; border-radius:9px; font-size:14px; line-height:1; transform:none; box-shadow:0 3px 10px #0009; }
      .sch-video.sch-video-stop:active { transform:translateY(2px) scale(.94); }
      @keyframes sch-video-pulse { 50% { box-shadow:0 0 0 5px #78e7cb25,0 0 18px #78e7cb80; filter:brightness(1.14); } }
      .sch-video[aria-pressed="true"] { background:linear-gradient(135deg,#51d6ad,#d9ffdc); color:#06352a; box-shadow:0 0 14px #51d6ad88; }
      .sch-menu-backdrop { position:fixed; z-index:999; inset:0; background:linear-gradient(145deg,#070912c9,#0d0815dc); -webkit-backdrop-filter:blur(8px) saturate(.68); backdrop-filter:blur(8px) saturate(.68); }
      .sch-menu-backdrop[hidden] { display:none; }
      .sch-menu-backdrop:not([hidden]) { animation:sch-backdrop-enter .22s ease-out both; }
      .sch-menu { position:fixed; z-index:1000; left:50%; top:50%; transform:translate(-50%,-50%); box-sizing:border-box; width:min(500px,calc(100vw - 28px)); max-height:min(86dvh,760px); overflow:auto; overscroll-behavior:contain; scrollbar-color:#78d9c0 #171a27; padding:clamp(18px,4vw,26px); border:1px solid #baf8e2; border-radius:24px; background:radial-gradient(ellipse at 8% 0%,#7352a44d,transparent 44%),linear-gradient(145deg,#28243a 0%,#171522 52%,#10131d 100%); color:#f6f5ff; box-shadow:0 0 0 1px #bdffe233,0 0 34px #7ae6d51c,0 2px 0 #ffffff26 inset,0 5px 0 #0b0c13,0 12px 0 #07080d,0 30px 80px #000e; text-align:left; }
      .sch-menu:not([hidden]) { animation:sch-menu-enter .28s cubic-bezier(.18,.78,.24,1) both; }
      .sch-menu[hidden] { display:none; }
      @keyframes sch-backdrop-enter { from { opacity:0; } to { opacity:1; } }
      @keyframes sch-menu-enter { from { opacity:0; transform:translate(-50%,-47%) scale(.975); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
      .sch-menu h2 { margin:0; font-size:clamp(22px,5vw,28px); line-height:1.1; letter-spacing:-.035em; }
      .sch-menu-lead { margin:7px 0 19px; color:#c6c9d9; font-size:13px; line-height:1.45; }
      .sch-menu-section { margin-top:13px; padding:15px; border:1px solid #c2d3ff20; border-radius:17px; background:linear-gradient(145deg,#ffffff0b,#8db9ff05); box-shadow:inset 0 1px 0 #ffffff10,0 5px 12px #0002; }
      .sch-menu-section h3 { margin:0 0 12px; color:#a9f2db; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
      .sch-menu label,.sch-menu legend { color:#f0eff8; font-size:13px; font-weight:650; }
      .sch-menu fieldset { min-width:0; border:0; padding:0; margin:0 0 14px; }
      .sch-menu fieldset:last-child { margin-bottom:0; }
      .sch-menu input[type="range"] { display:block; width:100%; min-height:38px; accent-color:#7fe0c6; }
      .sch-menu select { box-sizing:border-box; width:100%; min-height:44px; margin-top:8px; padding:9px 12px; border:1px solid #b9c8ef55; border-radius:12px; background:linear-gradient(145deg,#25283a,#171a27); color:#fff; font:inherit; box-shadow:inset 0 1px 0 #ffffff12,0 3px 7px #0003; }
      .sch-menu-opties { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:9px; }
      .sch-menu-opties[data-options="board"] { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .sch-keuze { min-height:44px; padding:8px 7px; border:1px solid #c3c9df3b; border-radius:12px; background:linear-gradient(145deg,#ffffff10,#ffffff06); color:inherit; font:inherit; font-size:12px; font-weight:650; cursor:pointer; box-shadow:inset 0 1px 0 #ffffff0c,0 3px 7px #0002; transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease; }
      .sch-keuze[aria-pressed="true"] { border-color:#8bf0d2; background:linear-gradient(145deg,#baffeb,#58cdb7 60%,#37a994); color:#092a2b; box-shadow:inset 0 1px 0 #ffffffc9,0 3px 0 #267c70,0 7px 14px #58d9bc30; transform:translateY(-1px); }
      .sch-menu-hint { margin:5px 0 0; color:#bfc2d2; font-size:11px; line-height:1.5; }
      .sch-attack-toggle { display:flex; align-items:center; gap:10px; min-height:42px; padding:7px 9px; border:1px solid #d4d8f117; border-radius:11px; background:#ffffff06; font-size:13px; font-weight:650; }
      .sch-attack-toggle + .sch-attack-toggle { margin-top:6px; }
      .sch-attack-toggle input { width:19px; height:19px; flex:none; accent-color:#72dbc0; }
      .sch-menu button:focus-visible,.sch-menu select:focus-visible,.sch-menu input:focus-visible { outline:2px solid #91f1d7; outline-offset:3px; }
      @media (hover:hover) { .sch-keuze:not([aria-pressed="true"]):hover { border-color:#91f1d788; background:linear-gradient(145deg,#ffffff19,#ffffff0b); transform:translateY(-1px); } }
      @media (max-width:420px) { .sch-menu { padding:17px; border-radius:20px; } .sch-menu-section { padding:12px; } .sch-menu-opties { gap:6px; } .sch-keuze { font-size:11px; padding-inline:4px; } }
      @media (prefers-reduced-motion:reduce) { .sch-menu:not([hidden]),.sch-menu-backdrop:not([hidden]) { animation:none; } .sch-keuze { transition:none; } }
      .sch-threat::before { content:""; position:absolute; z-index:0; inset:0; pointer-events:none; background:radial-gradient(ellipse at 50% 60%,#ffe18fbb 0,#ffc85c88 35%,#ffb52b35 62%,transparent 80%); box-shadow:inset 0 0 14px #ffe293aa; animation:sch-threat-pulse 1.5s ease-in-out infinite alternate; }
      .sch-threat .sch-stuk { filter:drop-shadow(0 0 5px #fff1b8) drop-shadow(0 0 10px #ffbb45) drop-shadow(0 3px 2px #000b); }
      .sch-threat-exaggerated { z-index:2; }
      .sch-threat-exaggerated::before { background:radial-gradient(ellipse at 50% 55%,#ff8b8bdd 0,#f3263bba 36%,#a80021a8 67%,transparent 88%); box-shadow:inset 0 0 16px #ff5369d9,0 0 9px #fa354e99; }
      .sch-threat-exaggerated .sch-stuk { transform:scale(1.14); filter:sepia(1) saturate(9) brightness(1.05) hue-rotate(315deg) drop-shadow(0 0 5px #ff243dcc) drop-shadow(0 0 11px #f00b) drop-shadow(0 3px 2px #000b); }
      @keyframes sch-threat-pulse { from { opacity:.62; } to { opacity:1; } }
      @media (prefers-reduced-motion:reduce) { .sch-threat::before { animation:none; } }
      .sch-board-wood { background:repeating-linear-gradient(3deg,#6c462d 0 3px,#a87346 4px 7px,#774b30 8px 11px,#bd8c59 12px 13px)!important; }
      .sch-board-wood .sch-vak { background-image:repeating-linear-gradient(2deg,transparent 0 5px,#52351c22 6px,#fff5dd24 8px,transparent 10px)!important; }
      .sch-board-marble { background:repeating-linear-gradient(132deg,#d8d4cf 0 3px,#85818c 4px 6px,#ede8dc 7px 11px,#696876 12px 14px)!important; }
      .sch-board-marble .sch-vak:nth-child(odd) { filter:contrast(1.02) brightness(1.15); }
      .sch-board-marble .sch-vak:nth-child(even) { filter:contrast(1.08) brightness(.72); }
      .sch-board-glass { position:relative; isolation:isolate; background:linear-gradient(145deg,#e8fbff88,#73b5cc66 42%,#263f5b99)!important; }
      .sch-board-glass .sch-vak.sch-licht { background:linear-gradient(145deg,#e3fbff,#a9e4f2 48%,#75bdd8)!important; box-shadow:inset 0 1px 4px #fff9,inset 0 -3px 8px #143f5a66; }
      .sch-board-glass .sch-vak.sch-donker { background:linear-gradient(145deg,#759db5,#46677f 52%,#2a405d)!important; box-shadow:inset 0 1px 4px #e4faff66,inset 0 -3px 8px #101c31aa; }
      .sch-board-glass .sch-ivoor { color:#fffdf3; --sch-line:#332315; }
      .sch-board-glass .sch-ebben { color:#17202d; --sch-line:#f8fcff; }
      .sch-board-glass .sch-figuur { stroke-width:2.4; }
      .sch-board-glass .sch-stuk { filter:drop-shadow(0 1px 1px #fff9) drop-shadow(0 2px 2px #06101dcc); }
      .sch-frame.sch-frame-glass { border:1px solid #e4faffb0; background:linear-gradient(145deg,#d8f8ff99,#6698b8bb 48%,#1f3555ee); box-shadow:0 8px 0 #182941,0 12px 0 #102034,0 22px 34px #0009,inset 0 1px 2px #fff; }
      .sch-checkmate { position:fixed; z-index:20; inset:0; display:grid; place-items:center; pointer-events:none; background:radial-gradient(ellipse at center,#07122255,transparent 72%); opacity:1; transition:opacity .7s ease,transform .7s ease; }
      .sch-checkmate[hidden] { display:none; }
      .sch-checkmate-text { margin:0; padding:.14em .28em .22em; color:transparent; font-family:Impact,"Arial Black",system-ui,sans-serif; font-size:clamp(52px,15vw,150px); font-weight:1000; letter-spacing:.07em; line-height:1; text-align:center; -webkit-text-stroke:1px #f4fbff; background:linear-gradient(180deg,#fff 0%,#9da8b2 15%,#f8ffff 25%,#65717c 39%,#f2f7fb 52%,#77818b 66%,#fff 79%,#88939e 100%); background-clip:text; -webkit-background-clip:text; filter:drop-shadow(0 2px 0 #fff) drop-shadow(0 4px 0 #63707c) drop-shadow(0 7px 0 #222d37) drop-shadow(0 12px 13px #000c); text-shadow:0 1px 0 #fff,0 2px 0 #aeb8c1,0 3px 0 #59636d,0 5px 0 #252d35,0 12px 22px #000c; }
      .sch-checkmate-fade { opacity:0; transform:scale(1.08); }
      @media (prefers-reduced-motion:reduce) { .sch-checkmate { transition:none; } }
      .sch-noob-dialog { position:fixed; z-index:24; inset:0; display:grid; place-items:center; padding:20px; background:#070b14b8; }
      .sch-noob-dialog[hidden] { display:none; }
      .sch-noob-card { width:min(360px,100%); padding:20px; border:1px solid #f2cf97a0; border-radius:16px; background:linear-gradient(145deg,#30243a,#17121f); color:#fff8ed; box-shadow:0 18px 48px #000c; }
      .sch-noob-card h2 { margin:0 0 8px; font-size:18px; }
      .sch-noob-card p { margin:0 0 16px; color:#e5d8c8; font-size:13px; line-height:1.5; }
      .sch-noob-buttons { display:flex; justify-content:flex-end; gap:8px; }
      .sch-noob-buttons button { min-height:42px; padding:8px 12px; border:1px solid #ffffff55; border-radius:9px; background:#ffffff10; color:inherit; font:inherit; cursor:pointer; }
      .sch-noob-buttons button:last-child { background:linear-gradient(135deg,#f2c987,#d79d63); color:#211729; font-weight:750; }
      .sch-pieces-small .sch-stuk { width:72%; }
      .sch-pieces-medium .sch-stuk { width:88%; }
      .sch-pieces-large .sch-stuk { width:100%; }
    </style>
    <div class="sch-spel">
      <div id="sch-status" role="status" aria-live="polite" style="color:white;font-size:14px;font-weight:600;text-align:center;min-height:20px;"></div>
      <div class="sch-vangst" id="sch-tegenstander"></div>
      <div class="sch-frame"><div id="sch-bord" role="group" aria-label="Chess"></div></div>
      <div class="sch-vangst" id="sch-eigen"></div>
      <div class="sch-legenda"></div>
      <div class="sch-acties">
        <div class="sch-board-tools">
          <span class="sch-board-label">Board</span>
          <div class="sch-size-switch" role="group" aria-label="Board size">
            <button class="sch-compact" type="button" aria-pressed="true" aria-label="Compact board"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5"/></svg><span>Compact</span></button>
            <button class="sch-zoom" type="button" aria-pressed="false" aria-label="Full width board" aria-haspopup="dialog" aria-expanded="false"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"/></svg><span>Full width</span></button>
          </div>
          <button class="sch-settings" type="button" aria-label="Chess settings" aria-haspopup="dialog" aria-expanded="false" aria-controls="sch-menu"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#1e293b"/><circle cx="15" cy="17" r="3" fill="#1e293b"/></svg></button>
        </div>
        ${isVriendPartij ? '<button class="sch-video" id="sch-video" type="button" aria-pressed="false">📹 Webcam</button>' : ''}
        <div class="sch-menu-backdrop" id="sch-menu-backdrop" hidden aria-hidden="true"></div>
        <section class="sch-menu" id="sch-menu" role="dialog" aria-modal="true" aria-label="Chess settings" hidden>
          <h2>Chess settings</h2>
          <p class="sch-menu-lead">Make the board, pieces and game feel your own.</p>
          <section class="sch-menu-section" aria-labelledby="sch-gameplay-heading">
            <h3 id="sch-gameplay-heading">Gameplay</h3>
            <fieldset><legend>Computer thinking time</legend>
              <label for="sch-denktijd">Maximum: <output id="sch-denktijd-waarde">7 seconds</output></label>
              <input id="sch-denktijd" type="range" min="0" max="7" step="1" value="7" aria-describedby="sch-denktijd-hint">
              <p class="sch-menu-hint" id="sch-denktijd-hint">0 = instant. Otherwise, the computer varies its thinking time up to the selected maximum.</p>
            </fieldset>
            <fieldset><legend>Piece size</legend><div class="sch-menu-opties" data-options="pieces">
              <button class="sch-keuze" type="button" data-value="small">Smaller</button><button class="sch-keuze" type="button" data-value="medium">Default</button><button class="sch-keuze" type="button" data-value="large">Larger</button>
            </div></fieldset>
            <label class="sch-attack-toggle"><input id="sch-noob-mode" type="checkbox"> Noob (kids) mode</label>
            <p class="sch-menu-hint">Warns before your move leaves one of your pieces open to capture. Illegal moves that expose your king stay blocked.</p>
            <label class="sch-attack-toggle"><input id="sch-aanvalsroutes" type="checkbox"> Show attack routes</label>
            <label class="sch-attack-toggle" id="sch-exaggerate-wrap" hidden><input id="sch-exaggerate" type="checkbox"> Exaggerate</label>
            <p class="sch-menu-hint">Highlights opposing pieces that the last moved piece can legally capture.</p>
          </section>
          <section class="sch-menu-section" aria-labelledby="sch-board-heading">
            <h3 id="sch-board-heading">Board & captures</h3>
            <fieldset><legend>Board style</legend><div class="sch-menu-opties" data-options="board">
              <button class="sch-keuze" type="button" data-value="classic">Classic</button><button class="sch-keuze" type="button" data-value="wood">Wood grain</button><button class="sch-keuze" type="button" data-value="marble">Marble / granite</button><button class="sch-keuze" type="button" data-value="glass">Glass plate</button>
            </div></fieldset>
            <label class="sch-attack-toggle"><input id="sch-points-per-piece" type="checkbox"> Points per piece</label>
            <p class="sch-menu-hint">Show each captured piece’s value in the Captured panels.</p>
          </section>
          <section class="sch-menu-section" aria-labelledby="sch-media-heading">
            <h3 id="sch-media-heading">Sound & cameras</h3>
            <label for="sch-sound-theme">Sound theme</label>
            <select id="sch-sound-theme"><option value="classic">Classic (default)</option><option value="wood">Wooden board</option></select>
            <p class="sch-menu-hint">Choose how each piece sounds when it lands on the board.</p>
            <label class="sch-attack-toggle"><input id="sch-cameras-at-top" type="checkbox"> Keep webcams together at the top</label>
            <p class="sch-menu-hint">Place both camera views above the board. Tap either view to resize it.</p>
          </section>
          <p class="sch-menu-hint">Resize the board with Compact or Full width. Hold Full width for 3 seconds to reopen these settings.</p>
        </section>
      </div>
      <div id="sch-promotie" style="display:none;gap:8px;background:rgba(0,0,0,0.85);padding:10px;border-radius:10px;"></div>
      <div class="sch-checkmate" id="sch-checkmate" role="status" aria-live="assertive" hidden><h2 class="sch-checkmate-text">CHECKMATE</h2></div>
      <div class="sch-noob-dialog" id="sch-noob-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sch-noob-title" aria-describedby="sch-noob-message" hidden>
        <div class="sch-noob-card"><h2 id="sch-noob-title">Noob mode tip</h2><p id="sch-noob-message"></p><div class="sch-noob-buttons"><button type="button" id="sch-noob-cancel">Cancel move</button><button type="button" id="sch-noob-continue">Play anyway</button></div></div>
      </div>
      <button id="sch-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">↻ Play again</button>
    </div>`

  const bordEl = document.getElementById('sch-bord')
  const statusEl = document.getElementById('sch-status')
  const opnieuwBtn = document.getElementById('sch-opnieuw'); Bordgeluid.knop(statusEl, { language:'en' })
  const geluidBtn = statusEl.nextElementSibling
  const mediaControls = document.createElement('div')
  mediaControls.className = 'sch-media-controls'
  statusEl.insertAdjacentElement('afterend', mediaControls)
  if (geluidBtn) mediaControls.append(geluidBtn)
  const promotieEl = document.getElementById('sch-promotie')
  const checkmateEl = inhoud.querySelector('#sch-checkmate')
  const noobDialog = inhoud.querySelector('#sch-noob-dialog')
  const noobMessage = inhoud.querySelector('#sch-noob-message')
  const noobCancel = inhoud.querySelector('#sch-noob-cancel')
  const noobContinue = inhoud.querySelector('#sch-noob-continue')

  const spelEl = inhoud.querySelector('.sch-spel')
  const zoomBtn = inhoud.querySelector('.sch-zoom')
  const compactBtn = inhoud.querySelector('.sch-compact')
  const settingsBtn = inhoud.querySelector('.sch-settings')
  const videoBtn = inhoud.querySelector('#sch-video')
  if (videoBtn) {
    const videoKnopThuis = videoBtn.parentElement
    const videoKnopVolgende = videoBtn.nextSibling
    const zetVideoKnopPlek = eigen => {
      if (eigen) {
        mediaControls.append(videoBtn)
        videoBtn.classList.add('sch-video-stop')
        videoBtn.textContent = '📹'
        videoBtn.title = 'Turn webcam off'
        videoBtn.setAttribute('aria-label', 'Turn webcam off')
      } else {
        if (videoKnopVolgende?.parentNode === videoKnopThuis) videoKnopThuis.insertBefore(videoBtn, videoKnopVolgende)
        else videoKnopThuis.append(videoBtn)
        videoBtn.classList.remove('sch-video-stop')
        videoBtn.textContent = '📹 Webcam'
        videoBtn.title = ''
        videoBtn.setAttribute('aria-label', 'Turn webcam on')
      }
    }
    const pasVideoKnopAan = event => {
      const eigen = Boolean(event?.detail?.eigen)
      videoBtn.classList.remove('is-connecting')
      videoBtn.disabled = false
      videoBtn.setAttribute('aria-pressed', String(eigen))
      zetVideoKnopPlek(eigen)
    }
    const toonVideoVoortgang = event => {
      const detail = event?.detail || {}
      if (!detail.tekst) return
      statusEl.textContent = detail.tekst
      videoBtn.classList.toggle('is-connecting', Boolean(detail.bezig))
      videoBtn.disabled = false
      if (detail.bezig) videoBtn.textContent = '📹 Connecting…'
      else if (videoBtn.getAttribute('aria-pressed') !== 'true') zetVideoKnopPlek(false)
    }
    window.addEventListener('fibro-chess-video-state', pasVideoKnopAan)
    window.addEventListener('fibro-chess-video-progress', toonVideoVoortgang)
    videoBtn.addEventListener('click', async event => {
      event.stopPropagation()
      videoBtn.classList.add('is-connecting')
      videoBtn.textContent = '📹 Connecting…'
      statusEl.textContent = 'Starting your camera connection…'
      videoBtn.disabled = true
      const antwoord = await window.FibroChessVideo?.()
      videoBtn.disabled = false
      if (!antwoord?.ok) {
        videoBtn.classList.remove('is-connecting')
        videoBtn.textContent = '📹 Webcam'
        statusEl.textContent = antwoord?.reason === 'connecting'
          ? 'Still connecting to your friend. Keep the game open and try again in a moment.'
          : 'Your camera could not be started. Check camera permission and try again.'
        return
      }
      pasVideoKnopAan({ detail:antwoord })
    })
  }
  inhoud.querySelector('.sch-legenda').textContent = 'Pawn 1 · Knight 3 · Bishop 3 · Rook 5 · Queen 9'
  function tekenVeroverd() {
    for (const [id,kleur,naam] of [['sch-eigen',mijnKleur,'You'],['sch-tegenstander',vriendKleur,vriendNaam]]) {
      const paneel = document.getElementById(id)
      paneel.replaceChildren()
      const kop = document.createElement('div')
      kop.className = 'sch-vangst-kop'
      const label = document.createElement('strong')
      label.textContent = naam
      const score = document.createElement('span')
      const punten = veroverdePunten(veroverd[kleur])
      score.textContent = `Captured: ${punten} ${punten === 1 ? 'point' : 'points'}`
      kop.append(label,score)
      const lijst = document.createElement('div')
      lijst.className = 'sch-vangst-stukken'
      lijst.setAttribute('aria-label', `${score.textContent} (${veroverd[kleur].map(stuk => `${READABLE_NAMES[stuk[1]]}${instellingen.pointsPerPiece ? `, ${STUKPUNTEN[stuk[1]]} points` : ''}`).join(', ')})`)
      for (const stuk of veroverd[kleur]) {
        const item = document.createElement('span')
        item.className = 'sch-vangst-stuk'
        item.innerHTML = stukSVG(stuk)
        if (instellingen.pointsPerPiece) {
          const waarde = document.createElement('span')
          waarde.className = 'sch-vangst-waarde'
          waarde.textContent = String(STUKPUNTEN[stuk[1]] ?? 0)
          item.append(waarde)
        }
        lijst.append(item)
      }
      if (!veroverd[kleur].length) lijst.textContent = '—'
      paneel.append(kop,lijst)
    }
  }
  function vergroot(aan) {
    spelEl.classList.toggle('sch-groot', aan)
    zoomBtn.setAttribute('aria-pressed', String(aan))
    compactBtn.setAttribute('aria-pressed', String(!aan))
  }
  vergroot(false)
  const menu = inhoud.querySelector('#sch-menu')
  const menuBackdrop = inhoud.querySelector('#sch-menu-backdrop')
  const soundTheme = menu.querySelector('#sch-sound-theme')
  const acties = inhoud.querySelector('.sch-acties')
  // Keep board sizing within reach above the board, including camera mode.
  mediaControls.insertAdjacentElement('afterend', acties)
  let voortgangTimer = null, menuTimer = null, menuDruk = false, onderdrukKlik = false
  function bewaarInstellingen() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(instellingen)) } catch {}
    spelEl.classList.toggle('sch-pieces-small', instellingen.pieces === 'small')
    spelEl.classList.toggle('sch-pieces-medium', instellingen.pieces === 'medium')
    spelEl.classList.toggle('sch-pieces-large', instellingen.pieces === 'large')
    bordEl.classList.toggle('sch-board-wood', instellingen.board === 'wood')
    bordEl.classList.toggle('sch-board-marble', instellingen.board === 'marble')
    bordEl.classList.toggle('sch-board-classic', instellingen.board === 'classic')
    bordEl.classList.toggle('sch-board-glass', instellingen.board === 'glass')
    spelEl.querySelector('.sch-frame').classList.toggle('sch-frame-glass', instellingen.board === 'glass')
    spelEl.dataset.cameraLayout = instellingen.camerasAtTop ? 'top' : 'around'
  }
  function toonMenu(aan) {
    menu.hidden = !aan
    menuBackdrop.hidden = !aan
    zoomBtn.setAttribute('aria-expanded', String(aan))
    settingsBtn.setAttribute('aria-expanded', String(aan))
    if (aan) {
      const eersteBediening = [...menu.querySelectorAll('button,input,select')].find(el => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length)
      eersteBediening?.focus()
    }
  }
  function toonCheckmateOverlay() {
    checkmateTimers.forEach(clearTimeout)
    checkmateEl.hidden = false
    checkmateEl.classList.remove('sch-checkmate-fade')
    checkmateTimers = [
      setTimeout(() => checkmateEl.classList.add('sch-checkmate-fade'), 2300),
      setTimeout(() => { checkmateEl.hidden = true; checkmateEl.classList.remove('sch-checkmate-fade') }, 3000),
    ]
  }
  function wisCheckmateOverlay() {
    checkmateTimers.forEach(clearTimeout)
    checkmateTimers = []
    checkmateEl.hidden = true
    checkmateEl.classList.remove('sch-checkmate-fade')
  }
  function kiesMenuOptie(groep, waarde) {
    instellingen[groep] = waarde
    menu.querySelectorAll(`[data-options="${groep}"] .sch-keuze`).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === waarde)))
    bewaarInstellingen()
  }
  bewaarInstellingen()
  const denktijd = menu.querySelector('#sch-denktijd')
  const denktijdWaarde = menu.querySelector('#sch-denktijd-waarde')
  menu.querySelector('#sch-denktijd').closest('fieldset').hidden = !spelKanaal.isSolo
  denktijd.value = String(instellingen.thinking)
  denktijdWaarde.value = instellingen.thinking === 0 ? 'Instant' : `${instellingen.thinking} seconds`
  denktijd.addEventListener('input', () => {
    instellingen.thinking = Number(denktijd.value)
    denktijdWaarde.value = instellingen.thinking === 0 ? 'Instant' : `${instellingen.thinking} seconds`
    bewaarInstellingen()
    if (spelKanaal.isSolo) spelKanaal.send({ type:'broadcast', event:'bot-instellingen', payload:{ thinkingMs:instellingen.thinking * 1000 } })
  })
  menu.querySelectorAll('.sch-keuze').forEach(button => button.addEventListener('click', () => kiesMenuOptie(button.closest('[data-options]').dataset.options, button.dataset.value)))
  for (const group of ['pieces','board']) menu.querySelectorAll(`[data-options="${group}"] .sch-keuze`).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === instellingen[group])))
  soundTheme.value = instellingen.soundTheme
  soundTheme.addEventListener('change', () => {
    instellingen.soundTheme = soundTheme.value
    bewaarInstellingen()
    Bordgeluid.previewSchaakGeluid(instellingen.soundTheme)
  })
  const cameraLayoutToggle = menu.querySelector('#sch-cameras-at-top')
  cameraLayoutToggle.checked = instellingen.camerasAtTop
  cameraLayoutToggle.addEventListener('change', () => {
    instellingen.camerasAtTop = cameraLayoutToggle.checked
    bewaarInstellingen()
  })
  const aanvalToggle = menu.querySelector('#sch-aanvalsroutes')
  const exaggerateToggle = menu.querySelector('#sch-exaggerate')
  const exaggerateWrap = menu.querySelector('#sch-exaggerate-wrap')
  aanvalToggle.checked = instellingen.showAttackRoutes
  exaggerateWrap.hidden = !instellingen.showAttackRoutes && !isVriendPartij
  exaggerateToggle.checked = !isVriendPartij && instellingen.exaggerate
  exaggerateToggle.disabled = isVriendPartij
  if (isVriendPartij) {
    exaggerateWrap.hidden = false
    exaggerateWrap.title = 'Unavailable when playing a friend.'
    exaggerateWrap.append(' (computer games only)')
  }
  aanvalToggle.addEventListener('change', () => {
    instellingen.showAttackRoutes = aanvalToggle.checked
    exaggerateWrap.hidden = !instellingen.showAttackRoutes && !isVriendPartij
    bewaarInstellingen()
    tekenBord()
  })
  exaggerateToggle.addEventListener('change', () => {
    instellingen.exaggerate = exaggerateToggle.checked
    bewaarInstellingen()
    tekenBord()
  })
  const puntenPerStukToggle = menu.querySelector('#sch-points-per-piece')
  puntenPerStukToggle.checked = instellingen.pointsPerPiece
  puntenPerStukToggle.addEventListener('change', () => {
    instellingen.pointsPerPiece = puntenPerStukToggle.checked
    bewaarInstellingen()
    tekenVeroverd()
  })
  const noobToggle = menu.querySelector('#sch-noob-mode')
  noobToggle.checked = !isVriendPartij && instellingen.noobMode
  noobToggle.disabled = isVriendPartij
  if (isVriendPartij) {
    const noobWrap = noobToggle.closest('label')
    if (noobWrap) { noobWrap.title = 'Unavailable when playing a friend.'; noobWrap.append(' (computer games only)') }
  }
  noobToggle.addEventListener('change', () => {
    instellingen.noobMode = noobToggle.checked
    bewaarInstellingen()
  })
  if (spelKanaal.isSolo) spelKanaal.send({ type:'broadcast', event:'bot-instellingen', payload:{ thinkingMs:instellingen.thinking * 1000 } })
  function openMenuLater() {
    menuDruk = true
    onderdrukKlik = true
    zoomBtn.classList.add('sch-lange-druk')
    toonMenu(true)
  }
  zoomBtn.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    if (event.pointerId !== undefined && zoomBtn.setPointerCapture) {
      try { zoomBtn.setPointerCapture(event.pointerId) } catch {}
    }
    menuDruk = false
    zoomBtn.classList.remove('sch-lange-druk')
    clearTimeout(voortgangTimer)
    clearTimeout(menuTimer)
    voortgangTimer = setTimeout(() => zoomBtn.classList.add('sch-lange-druk'), 2000)
    menuTimer = setTimeout(openMenuLater, 3000)
  })
  zoomBtn.addEventListener('pointermove', event => {
    if (menuTimer && (Math.abs(event.movementX || 0) > 12 || Math.abs(event.movementY || 0) > 12)) eindigLangeDruk()
  })
  function eindigLangeDruk() {
    clearTimeout(voortgangTimer)
    clearTimeout(menuTimer)
    zoomBtn.classList.remove('sch-lange-druk')
    if (menuDruk) onderdrukKlik = true
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) zoomBtn.addEventListener(event, eindigLangeDruk)
  window.addEventListener('blur', eindigLangeDruk)
  zoomBtn.addEventListener('contextmenu', event => event.preventDefault())
  zoomBtn.addEventListener('click', () => {
    if (onderdrukKlik || menuDruk) { menuDruk = false; onderdrukKlik = false; return }
    vergroot(true)
  })
  compactBtn.addEventListener('click', () => vergroot(false))
  settingsBtn.addEventListener('click', () => toonMenu(menu.hidden))
  menuBackdrop.addEventListener('click', () => { toonMenu(false); settingsBtn.focus() })
  spelEl.addEventListener('pointerdown', event => { if (!acties.contains(event.target)) toonMenu(false) })
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { toonMenu(false); settingsBtn.focus(); return }
    if (event.key !== 'Tab') return
    const bediening = [...menu.querySelectorAll('button,input,select')].filter(el => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length)
    if (!bediening.length) return
    const eerste = bediening[0], laatste = bediening.at(-1)
    if (event.shiftKey && document.activeElement === eerste) { event.preventDefault(); laatste.focus() }
    else if (!event.shiftKey && document.activeElement === laatste) { event.preventDefault(); eerste.focus() }
  })
  const vingers = new Map()
  let afstand = 0, negeerKlikTot = 0
  const meetAfstand = () => {
    const [a,b] = [...vingers.values()]
    return Math.hypot(a.x-b.x, a.y-b.y)
  }
  bordEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return
    vingers.set(e.pointerId, { x:e.clientX, y:e.clientY })
    e.target.setPointerCapture(e.pointerId)
    if (vingers.size === 2) { afstand = meetAfstand(); negeerKlikTot = Infinity }
  })
  bordEl.addEventListener('pointermove', e => {
    if (!vingers.has(e.pointerId)) return
    vingers.set(e.pointerId, { x:e.clientX, y:e.clientY })
    if (vingers.size !== 2) return
    const nu = meetAfstand()
    if (nu - afstand > 24) vergroot(true)
    if (afstand - nu > 24) vergroot(false)
  })
  function los(e) {
    vingers.delete(e.pointerId)
    if (!vingers.size && negeerKlikTot === Infinity) negeerKlikTot = performance.now() + 400
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) bordEl.addEventListener(event, los)

  async function animeerZet(zet) {
    bezig = true
    const ronde = generatie
    const bewegingen = [[zet.van, zet.naar]]
    if (zet.type === 'rokade-kort') bewegingen.push([[zet.van[0],7],[zet.van[0],5]])
    if (zet.type === 'rokade-lang') bewegingen.push([[zet.van[0],0],[zet.van[0],3]])
    try {
      if (!minderBeweging.matches) await Promise.all(bewegingen.map(async ([van,naar]) => {
        const bron = bordEl.querySelector(`[data-r="${van[0]}"][data-k="${van[1]}"]`)
        const doel = bordEl.querySelector(`[data-r="${naar[0]}"][data-k="${naar[1]}"]`)
        const stuk = bron?.querySelector('.sch-stuk')
        if (!stuk?.animate || !doel) return
        const a = bron.getBoundingClientRect(), b = doel.getBoundingClientRect()
        const x = b.x-a.x, y = b.y-a.y
        bron.style.zIndex = '5'
        const animatie = stuk.animate([
          { transform:'translate(0,0) scale(1)', offset:0 },
          { transform:`translate(${x*.15}px,${y*.15-10}px) scale(1.18)`, offset:.22 },
          { transform:`translate(${x}px,${y-7}px) scale(1.12)`, offset:.8 },
          { transform:`translate(${x}px,${y}px) scale(1)`, offset:1 }
        ], { duration:680, easing:'cubic-bezier(.3,.05,.25,1)', fill:'forwards' })
        try { await animatie.finished } finally { animatie.cancel(); bron.style.zIndex = '' }
      }))
      return ronde === generatie && bordEl.isConnected
    } finally { if (ronde === generatie) bezig = false }
  }

  function rijVolgorde() { return omgedraaid ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7] }
  function kolVolgorde() { return omgedraaid ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7] }

  function tekenBord() {
    tekenVeroverd()
    bordEl.innerHTML = ''
    const rijen = rijVolgorde()
    const kols = kolVolgorde()
    const bedreigdeVelden = new Set()
    const route = routeStuk && staat.bord[routeStuk[0]]?.[routeStuk[1]]
    if (instellingen.showAttackRoutes && route) {
      for (const zet of Schaak.legaleZetten(staat, routeStuk[0], routeStuk[1])) {
        const doel = staat.bord[zet.naar[0]][zet.naar[1]]
        if (doel && doel[0] !== route[0]) bedreigdeVelden.add(`${zet.naar[0]},${zet.naar[1]}`)
      }
    }

    for (const r of rijen) {
      for (const k of kols) {
        const vakje = document.createElement('button')
        const isLicht = (r + k) % 2 === 0
        const isGeselecteerd = geselecteerd && geselecteerd[0] === r && geselecteerd[1] === k
        const isMogelijkeZet = mogelijkeZetten.some(z => z.naar[0] === r && z.naar[1] === k)
        const isLaatsteZet = laatsteZet && (
          (laatsteZet.van[0]===r && laatsteZet.van[1]===k) || (laatsteZet.naar[0]===r && laatsteZet.naar[1]===k)
        )

        let achtergrond = isLicht ? '#eed9b8' : '#8a6242'
        if (isLaatsteZet) achtergrond = isLicht ? '#f3e08a' : '#c9a93a'
        if (isGeselecteerd) achtergrond = '#7ec8e3'

        vakje.type = 'button'
        vakje.className = `sch-vak ${isLicht ? 'sch-licht' : 'sch-donker'}`
        const bedreigd = bedreigdeVelden.has(`${r},${k}`)
        if (bedreigd) {
          vakje.classList.add('sch-threat')
          if (!isVriendPartij && instellingen.exaggerate) vakje.classList.add('sch-threat-exaggerated')
        }
        vakje.style.background = `linear-gradient(145deg,#ffffff18,#00000018),${achtergrond}`
        const stukNaam = staat.bord[r][k] ? `${staat.bord[r][k][0] === 'w' ? 'white' : 'black'} ${READABLE_NAMES[staat.bord[r][k][1]]}` : 'empty'
        vakje.setAttribute('aria-label', `${String.fromCharCode(97+k)}${8-r}, ${stukNaam}${bedreigd ? `, can be captured by ${route[0] === 'w' ? 'white' : 'black'} ${READABLE_NAMES[route[1]]}` : ''}`)
        vakje.setAttribute('aria-pressed', String(Boolean(isGeselecteerd)))
        vakje.dataset.r = r
        vakje.dataset.k = k

        const stuk = staat.bord[r][k]
        if (stuk) {
          const figuur = document.createElement('span')
          figuur.className = 'sch-stuk'
          figuur.innerHTML = stukSVG(stuk)
          vakje.append(figuur)
        }

        if (isMogelijkeZet) {
          const stip = document.createElement('div')
          const heeftStuk = !!staat.bord[r][k]
          stip.style.cssText = heeftStuk
            ? 'position:absolute;inset:2px;border:3px solid rgba(220,38,38,0.7);border-radius:4px;pointer-events:none;'
            : 'position:absolute;width:12px;height:12px;border-radius:50%;background:rgba(34,197,94,0.6);pointer-events:none;'
          vakje.appendChild(stip)
        }

        bordEl.appendChild(vakje)
      }
    }
  }

  // Event delegation — één listener op het bord, nooit per-vakje (voorkomt iOS re-render bug)
  bordEl.addEventListener('click', (e) => {
    if (performance.now() < negeerKlikTot) return
    const vakje = e.target.closest('[data-r]')
    if (!vakje) return
    vakjeKlik(parseInt(vakje.dataset.r), parseInt(vakje.dataset.k))
  })

  function vakjeKlik(r, k) {
    if (bezig || promotieOpen || !noobDialog.hidden || gameOver || staat.aanZet !== mijnKleur) return

    // Als er al een stuk geselecteerd is en dit is een geldige zet
    if (geselecteerd) {
      const zet = mogelijkeZetten.find(z => z.naar[0] === r && z.naar[1] === k)
      if (zet) {
        uitvoerenZet(zet)
        return
      }
      const doel = staat.bord[r][k]
      if (!isVriendPartij && instellingen.noobMode && (!doel || doel[0] !== mijnKleur)) {
        statusEl.textContent = 'Noob mode: only legal moves are allowed, so your king can never be left in check.'
      }
    }

    // Selecteer een nieuw stuk (alleen eigen stukken)
    const stuk = staat.bord[r][k]
    if (stuk && stuk[0] === mijnKleur) {
      geselecteerd = [r, k]
      mogelijkeZetten = Schaak.legaleZetten(staat, r, k)
    } else {
      geselecteerd = null
      mogelijkeZetten = []
    }
    tekenBord()
  }

  function bedreigdeEigenStukken(spelStaat, kleur) {
    const bedreigd = new Map()
    for (const reactie of Schaak.alleLegaleZetten(spelStaat, kleur === 'w' ? 'z' : 'w')) {
      const [r,k] = reactie.type === 'enpassant' ? [reactie.van[0],reactie.naar[1]] : reactie.naar
      const slachtoffer = spelStaat.bord[r][k]
      if (slachtoffer && slachtoffer[0] === kleur && slachtoffer[1] !== 'K') {
        bedreigd.set(`${r},${k}`, slachtoffer)
      }
    }
    return bedreigd
  }

  function nieuweBedreigingen(zet, promotieStuk) {
    const voor = bedreigdeEigenStukken(staat, mijnKleur)
    const simulatie = { ...staat, bord:staat.bord.map(rij => rij.slice()), rokade:{ ...staat.rokade } }
    Schaak.voerZetUit(simulatie, zet, promotieStuk || 'Q')
    if (Schaak.isSchaakmat(simulatie, simulatie.aanZet)) return []
    const na = bedreigdeEigenStukken(simulatie, mijnKleur)
    return [...na].filter(([veld,stuk]) => voor.get(veld) !== stuk).map(([veld,stuk]) => {
      const [r,k] = veld.split(',').map(Number)
      return `${READABLE_NAMES[stuk[1]]} on ${String.fromCharCode(97+k)}${8-r}`
    })
  }

  noobCancel.addEventListener('click', () => {
    pendingNoobMove = null
    noobDialog.hidden = true
    geselecteerd = null
    mogelijkeZetten = []
    statusEl.textContent = 'Move cancelled. Choose a safer move.'
    tekenBord()
  })
  noobContinue.addEventListener('click', () => {
    const pending = pendingNoobMove
    pendingNoobMove = null
    noobDialog.hidden = true
    if (pending) uitvoerenZet(pending.zet, pending.promotieStuk, true)
  })

  async function uitvoerenZet(zet, promotieStuk, noobConfirmed = false) {
    const stuk = staat.bord[zet.van[0]][zet.van[1]]
    const isPromotie = Schaak.typeVan(stuk) === 'P' && (zet.naar[0] === 0 || zet.naar[0] === 7)

    if (isPromotie && !promotieStuk) {
      // Toon promotie-keuze voordat de zet wordt afgerond
      toonPromotieKeuze(zet)
      return
    }

    if (!isVriendPartij && instellingen.noobMode && !noobConfirmed) {
      const bedreigingen = nieuweBedreigingen(zet, promotieStuk)
      if (bedreigingen.length) {
        pendingNoobMove = { zet, promotieStuk }
        noobMessage.textContent = `After this move, your ${bedreigingen.slice(0,3).join(', ')}${bedreigingen.length > 3 ? ` and ${bedreigingen.length - 3} more piece(s)` : ''} could be captured. Play this move anyway?`
        noobDialog.hidden = false
        noobCancel.focus()
        return
      }
    }

    if (!await animeerZet(zet)) return
    registreerSlag(staat, zet, veroverd)
    Schaak.voerZetUit(staat, zet, promotieStuk)
    routeStuk = zet.naar.slice()
    laatsteZet = zet
    geselecteerd = null
    mogelijkeZetten = []

    verstuurZet(zet, promotieStuk)
    naBeurtControle()
  }

  function toonPromotieKeuze(zet) {
    const kleur = mijnKleur
    promotieOpen = true
    promotieEl.style.display = 'flex'
    promotieEl.innerHTML = ['Q','R','B','N'].map(t =>
      `<button class="sch-promo-btn ${kleur === 'w' ? 'sch-wit' : 'sch-zwart'}" data-t="${t}" aria-label="Promote to ${READABLE_NAMES[t]}" style="font-size:28px;background:#b6a18a;border:1px solid var(--accent);border-radius:8px;padding:6px 10px;cursor:pointer;">${stukSVG(kleur+t)}</button>`
    ).join('')
    promotieEl.querySelectorAll('.sch-promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        promotieOpen = false
        promotieEl.style.display = 'none'
        uitvoerenZet(zet, btn.dataset.t)
      })
    })
  }

  function naBeurtControle() {
    const volgendeKleur = staat.aanZet; Bordgeluid.schaak(Schaak, staat, laatsteZet, mijnKleur, instellingen.soundTheme)
    if (Schaak.isSchaakmat(staat, volgendeKleur)) {
      gameOver = true
      statusEl.textContent = ''
      toonCheckmateOverlay()
      opnieuwBtn.style.display = 'block'
    } else if (Schaak.isPat(staat, volgendeKleur)) {
      gameOver = true
      statusEl.textContent = '🤝 Stalemate — draw!'
      opnieuwBtn.style.display = 'block'
    } else if (Schaak.staatInSchaak(staat, volgendeKleur)) {
      statusEl.textContent = volgendeKleur === mijnKleur ? 'You are in check — your turn' : `${vriendNaam} is in check — waiting...`
    } else {
      statusEl.textContent = volgendeKleur === mijnKleur ? 'Your turn' : `Waiting for ${vriendNaam}...`
    }
    tekenBord()
  }

  function verstuurZet(zet, promotieStuk) {
    spelKanaal.send({ type: 'broadcast', event: 'zet', payload: { zet, promotieStuk } })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, (msg) => {
    const ronde = generatie
    wachtrij = wachtrij.then(async () => {
      if (ronde !== generatie || !bordEl.isConnected || gameOver) return
      const { zet, promotieStuk } = msg.payload || {}
      if (!zet || staat.aanZet !== vriendKleur) return
      const geldig = Schaak.alleLegaleZetten(staat, vriendKleur).find(z =>
        z.van[0] === zet.van?.[0] && z.van[1] === zet.van?.[1] &&
        z.naar[0] === zet.naar?.[0] && z.naar[1] === zet.naar?.[1] && z.type === zet.type)
      if (!geldig || !await animeerZet(geldig)) return
      registreerSlag(staat, geldig, veroverd)
      Schaak.voerZetUit(staat, geldig, ['Q','R','B','N'].includes(promotieStuk) ? promotieStuk : 'Q')
      routeStuk = geldig.naar.slice()
      laatsteZet = geldig
      geselecteerd = null
      mogelijkeZetten = []
      naBeurtControle()
    }).catch(error => console.error('[schaken] zet mislukt', error))
  })

  spelKanaal.on('broadcast', { event: 'opnieuw' }, () => {
    generatie++
    wisCheckmateOverlay()
    bezig = false
    promotieOpen = false
    promotieEl.style.display = 'none'
    veroverd = { w:[], z:[] }
    routeStuk = null
    staat = Schaak.nieuweSpelStaat()
    geselecteerd = null
    mogelijkeZetten = []
    laatsteZet = null
    gameOver = false
    opnieuwBtn.style.display = 'none'
    naBeurtControle()
  })

  opnieuwBtn.addEventListener('click', () => {
    generatie++
    wisCheckmateOverlay()
    bezig = false
    promotieOpen = false
    promotieEl.style.display = 'none'
    veroverd = { w:[], z:[] }
    routeStuk = null
    staat = Schaak.nieuweSpelStaat()
    geselecteerd = null
    mogelijkeZetten = []
    laatsteZet = null
    gameOver = false
    opnieuwBtn.style.display = 'none'
    spelKanaal.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
    naBeurtControle()
  })

  statusEl.textContent = mijnKleur === 'w' ? 'Your turn (White moves first)' : `Waiting for ${vriendNaam} (White moves first)...`
  tekenBord()
  if (new URLSearchParams(location.search).has('settings')) toonMenu(true)
}
