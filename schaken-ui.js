import { maakSchaakTaal } from './schaak-taal.js?v=12'
import { stukSVG, registreerSlag, veroverdePunten, STUKPUNTEN } from './schaak-stukken.js?v=1'
import { schaakFen } from './schaak-ultra-engine.js?v=1'
import { schaakNotatie, maakUltraEvaluatieHistorie } from './schaak-ultra-historie.js?v=1'
import { maakSchaakWallpaper } from './schaak-wallpaper.js?v=4'
import { maakUltraFocus } from './schaak-ultra-focus.js?v=1'
import { maakUltraSwipe } from './schaak-ultra-swipe.js?v=1'
import { maakPaardRoutesUI } from './schaak-paardroutes-ui.js?v=4'
import { maakSchaakTafelklap } from './schaak-tafelklap.js?v=9'
const SETTINGS_KEY = 'fibro_chess_settings_v1'
const READABLE_NAMES = { P:'pion', N:'paard', B:'loper', R:'toren', Q:'dame', K:'koning' }

// Read the victim before the engine changes the board. A capture's value belongs to
// the captured piece, including en passant and a pawn that promotes while capturing.
export function schaakSlagEffect(staat, zet, mijnKleur) {
  if (!zet || !['w','z'].includes(mijnKleur)) return null
  const aanvaller = staat.bord[zet.van[0]]?.[zet.van[1]]
  const slachtoffer = zet.type === 'enpassant'
    ? staat.bord[zet.van[0]]?.[zet.naar[1]]
    : staat.bord[zet.naar[0]]?.[zet.naar[1]]
  if (!aanvaller || !slachtoffer || aanvaller[0] === slachtoffer[0]) return null
  const value = STUKPUNTEN[slachtoffer[1]]
  if (![1,3,5,9].includes(value)) return null
  return { value, outcome:slachtoffer[0] === mijnKleur ? 'loss' : 'win' }
}
function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    const thinking = Number(saved.thinking ?? 7)
    const ultraThinking = typeof saved.ultraThinking === 'number' ? saved.ultraThinking : 5
    return { ...saved, thinking:Number.isFinite(thinking) ? Math.min(7,Math.max(0,thinking)) : 7, ultraThinking:Number.isFinite(ultraThinking) ? Math.min(7,Math.max(0,ultraThinking)) : 5, pieces:['small','medium','large'].includes(saved.pieces) ? saved.pieces : 'medium', board:['classic','wood','marble','glass'].includes(saved.board) ? saved.board : 'classic', soundTheme:['classic','wood'].includes(saved.soundTheme) ? saved.soundTheme : 'classic', gradedCaptureSounds:saved.gradedCaptureSounds === true, ultraGradedCaptureSounds:typeof saved.ultraGradedCaptureSounds === 'boolean' ? saved.ultraGradedCaptureSounds : true, ultraEvaluationSound:saved.ultraEvaluationSound === true, ultraTakeback:saved.ultraTakeback === true, ultraHints:saved.ultraHints === true, spinBoard:saved.spinBoard === true, showAttackRoutes:saved.showAttackRoutes === true, exaggerate:saved.exaggerate === true, pointsPerPiece:saved.pointsPerPiece === true, noobMode:saved.noobMode === true, camerasAtTop:saved.camerasAtTop === true, threePlayer:saved.threePlayer === true, showUltraEvaluation:saved.showUltraEvaluation === true, knightRouteSteps:Array.isArray(saved.knightRouteSteps) && saved.knightRouteSteps.length === 4 && saved.knightRouteSteps.every(value => typeof value === 'boolean') ? saved.knightRouteSteps.slice() : [true,true,true,false] }
  } catch { return { thinking:7, ultraThinking:5, pieces:'medium', board:'classic', soundTheme:'classic', gradedCaptureSounds:false, ultraGradedCaptureSounds:true, ultraEvaluationSound:false, ultraTakeback:false, ultraHints:false, spinBoard:false, showAttackRoutes:false, exaggerate:false, pointsPerPiece:false, noobMode:false, camerasAtTop:false, threePlayer:false, showUltraEvaluation:false, knightRouteSteps:[true,true,true,false] } }
}
// schaken-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// v265: animatie bij schaakmat (koning valt om, schokgolf, dan SCHAAKMAT). Slaan heeft geen eigen animatie (op verzoek
// van Marcel weer weggehaald, v265b): de aanvaller schuift gewoon naar het vak, zoals altijd.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.
export function start({ Schaak, Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam, onInviteThird = null, testMode = false }) {
  const taal = maakSchaakTaal()
  const t = (key, values) => taal.t(key, values)
  const kleurBijStuk = stuk => t(stuk[0] === 'w' ? (stuk[1] === 'N' ? 'wit' : 'witte') : (stuk[1] === 'N' ? 'zwart' : 'zwarte'))
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]))
  const tekst = key => `<span data-sch-text="${esc(key)}">${esc(t(key))}</span>`
  const tegenstanderNaam = () => testMode ? t('Testspeler · Zwart') : (vriendNaam || t('Tegenstander'))
  const opruimers = []
  // Coaching aids can reveal tactical information to one player only. Keep them
  // for computer games, where there is no fairness concern.
  const isVriendPartij = !spelKanaal.isSolo
  const isUltra = spelKanaal.isSolo === true && spelKanaal.niveau === 'ultra'
  document.getElementById('spelTitelBar').textContent = '♟️ ' + t('Schaken')
  const inhoud = document.getElementById('spelInhoud')

  let staat = Schaak.nieuweSpelStaat()
  const mijnKleur = benIkSpeler1 ? 'w' : 'z'
  const vriendKleur = benIkSpeler1 ? 'z' : 'w'
  let veroverd = { w:[], z:[] }
  let routeStuk = null
  let geselecteerd = null      // [r,k] van geselecteerd stuk
  let mogelijkeZetten = []     // legale zetten voor geselecteerd stuk
  let gameOver = false
  let spinPerspectiveActive = false
  let bezig = false
  let promotieOpen = false
  let generatie = 0
  let checkmateTimers = []
  let pendingNoobMove = null
  let wachtrij = Promise.resolve()
  const minderBeweging = matchMedia('(prefers-reduced-motion: reduce)')
  const instellingen = readSettings()
  let laatsteZet = null        // voor highlight van laatste zet
  let paardRoutesUI = null

  // Bord wordt altijd getoond met wit onderaan vanuit perspectief van de witte speler,
  // en zwart onderaan vanuit perspectief van de zwarte speler
  const omgedraaid = mijnKleur === 'z'

  inhoud.innerHTML = `
    <style>
      .sch-spel { display:flex; flex-direction:column; align-items:center; flex:none; gap:8px; width:100%; }
      .sch-frame { box-sizing:border-box; container-type:inline-size; flex:none; width:min(360px,82vw,calc(100% - 12px),max(180px,calc(100dvh - 290px))); padding:7px; border-radius:12px; transition:width .25s ease;
        background:linear-gradient(135deg,#d9ae76,#765032 45%,#39271e); box-shadow:0 9px 0 #39271e,0 12px 0 #211811,0 22px 30px #0008,inset 0 1px 1px #fff9; }
      .sch-spel.sch-groot .sch-frame { width:min(720px,calc(100% - 12px),max(320px,calc(100dvh - 380px))); }
      .sch-board-row { --sch-history-width:clamp(76px,21vw,150px); --sch-evaluation-width:0px; display:flex; justify-content:center; align-items:stretch; gap:6px; width:100%; min-width:0; }
      .sch-board-row.sch-with-evaluation { --sch-evaluation-width:50px; }
      .sch-board-row .sch-frame { width:min(360px,calc(100% - var(--sch-history-width) - var(--sch-evaluation-width) - 12px),max(150px,calc(100dvh - 290px))); min-width:0; }
      .sch-spel.sch-groot .sch-board-row .sch-frame { width:min(720px,calc(100% - var(--sch-history-width) - var(--sch-evaluation-width) - 12px),max(220px,calc(100dvh - 380px))); }
      .sch-evaluation { box-sizing:border-box; display:flex; flex:none; flex-direction:column; align-items:center; gap:4px; width:44px; padding:7px 0; color:#d9e4ef; }
      .sch-evaluation[hidden] { display:none; }
      .sch-evaluation-score { font-size:10px; font-weight:750; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .sch-evaluation-bar { position:relative; flex:1; width:18px; min-height:70px; overflow:hidden; border:1px solid #a2abb850; border-radius:6px; background:#242631; box-shadow:0 3px 12px #0006,inset 0 1px 3px #0008; }
      .sch-evaluation-white { position:absolute; inset:auto 0 0; height:var(--sch-white-share,50%); background:linear-gradient(90deg,#d6dccf,#fffbed); transition:height .35s ease; }
      .sch-evaluation-delta { display:none; position:absolute; z-index:1; bottom:var(--sch-delta-bottom,50%); height:var(--sch-delta-height,0%); width:50%; pointer-events:none; box-shadow:0 0 0 1px #7b7d80b0; }
      .sch-evaluation[data-direction="gain"] .sch-evaluation-delta,.sch-evaluation[data-direction="loss"] .sch-evaluation-delta { display:block; min-height:2px; }
      .sch-evaluation-delta-white { left:0; background:linear-gradient(0deg,#696b6e80,#d5d6d8aa); }
      .sch-evaluation-delta-black { right:0; background:linear-gradient(180deg,#54565a88,#c5c6c8b8); }
      .sch-evaluation[data-magnitude="medium"] .sch-evaluation-delta { background:repeating-linear-gradient(135deg,#6c6e72dd 0 2px,#d0d1d4dd 2px 4px); }
      .sch-evaluation[data-magnitude="large"] .sch-evaluation-delta { background:repeating-linear-gradient(45deg,#373a40f5 0 3px,#e0e1e4f5 3px 5px); box-shadow:0 0 0 1px #e0e1e4; }
      .sch-evaluation-delta-value { min-height:10px; color:#c1c3c7; font-size:9px; line-height:1; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .sch-evaluation-ply { max-width:44px; color:#b8c9c8; font-size:9px; line-height:1.2; white-space:nowrap; }
      .sch-evaluation-bar::after { content:""; position:absolute; inset:50% 0 auto; border-top:1px solid #82c9bcaa; }
      .sch-evaluation-side { font-size:9px; line-height:1; }
      .sch-evaluation[data-pending="true"] .sch-evaluation-bar { opacity:.45; }
      .sch-history { box-sizing:border-box; contain:size; display:flex; flex:none; flex-direction:column; width:var(--sch-history-width); min-width:0; min-height:0; padding:8px 4px; border:1px solid #a6c9be35; border-radius:10px; background:linear-gradient(160deg,#2a3437,#151b24); color:#ecf1ed; }
      .sch-history h3 { margin:0 0 7px; overflow-wrap:anywhere; font-size:10px; font-weight:750; }
      .sch-history-scroll { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:#8aa8a0 transparent; }
      .sch-history table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; font-variant-numeric:tabular-nums; }
      .sch-history th,.sch-history td { padding:4px 1px; overflow-wrap:anywhere; text-align:left; }
      .sch-history th { color:#a8c9c0; font-size:9px; font-weight:600; }
      .sch-history th:first-child { width:18%; }
      .sch-history td:first-child { color:#7e9991; font-size:9px; }
      .sch-history tr:last-child td { background:#ffffff0a; }
      .sch-history-empty { margin:7px 0; color:#9dafaa; font-size:10px; overflow-wrap:anywhere; }
      .sch-ultra-info { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:6px; }
      .sch-ultra-status { min-height:16px; margin:1px 0 0; color:#a8c8c2; font-size:11px; text-align:center; }
      .sch-ultra-status[data-phase="error"] { color:#ffb6b3; }
      .sch-ultra-retry { min-height:32px; padding:5px 10px; border:1px solid #80d8c377; border-radius:9px; background:#24443f; color:#dffff4; font:inherit; font-size:11px; cursor:pointer; }
      .sch-ultra-retry[hidden] { display:none; }
      .sch-ultra-retry:focus-visible { outline:2px solid #91f1d7; outline-offset:3px; }
      .sch-ultra-frame { position:relative; }
      .sch-ultra-frame.sch-has-hints { padding-top:33px; }
      .sch-frame.sch-has-spin { padding-top:34px; }
      .sch-wallpaper-layer { transition:transform .45s ease; }
      .sch-wallpaper-flipped .sch-wallpaper-layer { transform:scaleX(-1); }
      @media (prefers-reduced-motion:reduce) { .sch-wallpaper-layer { transition:none; } }
      .sch-hint-button { position:absolute; top:3px; right:7px; display:grid; place-items:center; width:25px; height:25px; border:1px solid #ffe2a0; border-radius:50%; background:linear-gradient(145deg,#ffe9a8,#bd8030); color:#39230c; font:bold 16px Georgia,serif; cursor:pointer; box-shadow:0 2px 5px #0007; }
      .sch-hint-button[hidden],.sch-takeback[hidden] { display:none; }
      .sch-hint-button:disabled { cursor:wait; opacity:.6; }
      .sch-hint-button:focus-visible,.sch-takeback:focus-visible { outline:2px solid #ffe2a0; outline-offset:3px; }
      .sch-spin-perspective { position:absolute; z-index:10; top:4px; right:7px; display:grid; place-items:center; width:26px; height:26px; padding:0; border:1px solid #b8d8ff66; border-radius:9px; color:#dcedff; background:linear-gradient(145deg,#334866,#17253a); box-shadow:inset 0 1px #fff4,0 2px 5px #0008; cursor:pointer; }
      .sch-spin-perspective[hidden] { display:none; }
      .sch-spin-perspective svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; transition:transform .24s ease; }
      .sch-spin-perspective[aria-pressed="true"] { border-color:#a8eddd; color:#092c2b; background:linear-gradient(145deg,#c5fff1,#67cdbb); box-shadow:inset 0 1px #fff,0 0 10px #62dbba70; }
      .sch-spin-perspective[aria-pressed="true"] svg { transform:rotate(180deg); }
      .sch-frame.sch-has-spin-and-hint .sch-spin-perspective { right:38px; }
      .sch-spin-perspective:focus-visible { outline:2px solid #d8f3ff; outline-offset:3px; }
      .sch-assistance-status { position:absolute; top:8px; left:8px; right:38px; margin:0; color:#fff0ca; font-size:10px; line-height:1.25; }
      .sch-assistance-status:empty { display:none; }
      .sch-takeback { min-height:36px; padding:7px 11px; border:1px solid #9bb9b06b; border-radius:10px; background:#243a37; color:#e4f9ed; font:inherit; font-size:12px; cursor:pointer; }
      .sch-takeback:disabled { cursor:default; opacity:.45; }
      .sch-swipe-takeback { --sch-swipe-progress:0; position:relative; display:none; box-sizing:border-box; flex:none; width:100%; max-width:480px; min-height:48px; margin:8px 0 2px; padding:14px 46px 14px 12px; border:1px solid #9fdac44d; border-radius:16px; overflow:hidden; touch-action:pan-y; user-select:none; -webkit-user-select:none; color:#c8e3dc; background:linear-gradient(145deg,#29463b,#132b2d 62%,#15232f); box-shadow:0 3px 0 #08171a,0 7px 15px #0005,inset 0 1px #e3fff32b; text-align:center; font:600 11px/1.5 system-ui; cursor:default; }
      .sch-swipe-takeback[data-swipe-active="true"]:not([hidden]) { display:block; }
      .sch-swipe-takeback::before { content:""; position:absolute; inset:0 0 0 auto; width:calc(var(--sch-swipe-progress)*100%); background:linear-gradient(270deg,#67dcb72c,#8dffe14d); pointer-events:none; }
      .sch-swipe-takeback::after { content:""; position:absolute; top:8px; bottom:8px; left:42%; width:1px; background:linear-gradient(transparent,#b0ffdd70,transparent); pointer-events:none; }
      .sch-swipe-label { position:relative; z-index:1; }
      .sch-swipe-takeback[data-swipe-state="dragging"] .sch-swipe-label { opacity:0; }
      .sch-swipe-takeback[data-swipe-state="ready"] .sch-swipe-label { position:absolute; left:54%; right:8px; top:50%; transform:translateY(-50%); font-size:10px; line-height:1.3; }
      .sch-swipe-help { position:absolute; width:1px; height:1px; padding:0; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
      .sch-swipe-thumb { position:absolute; z-index:2; top:50%; right:calc(5px + var(--sch-swipe-progress)*52%); display:grid; place-items:center; width:32px; height:32px; border-radius:11px; color:#0d3431; background:linear-gradient(145deg,#dcfff0,#79cbb5); box-shadow:0 2px 0 #487e70,inset 0 1px #fff9; transform:translateY(-50%); pointer-events:none; font-size:20px; }
      .sch-swipe-takeback[data-swipe-state="ready"] { border-color:#a4ffe0; color:#f0fff8; box-shadow:0 3px 0 #08171a,0 0 18px #65e3b836,inset 0 1px #e3fff340; }
      .sch-swipe-takeback { opacity:0; }
      [data-sch-swipe-preview] .sch-swipe-takeback { opacity:1; }
      [data-sch-swipe-preview] .sch-swipe-takeback[aria-disabled="true"] { opacity:.45; }
      .sch-swipe-takeback:focus-visible { opacity:1; outline:2px solid #9cf5d7; outline-offset:3px; }
      .sch-wallpaper-motion { min-height:40px; margin-top:9px; padding:8px 12px; border:1px solid #9ecbbb66; border-radius:11px; background:#25453e; color:#e7fff3; font:inherit; font-size:12px; cursor:pointer; }
      .sch-wallpaper-motion[hidden] { display:none; }
      .sch-hint-piece { box-shadow:inset 0 0 0 3px #ffd16e,inset 0 0 15px #f7b83d99!important; animation:sch-hint-pulse 1.4s ease-in-out infinite alternate; }
      @keyframes sch-hint-pulse { to { box-shadow:inset 0 0 0 3px #fff1bb,inset 0 0 23px #f7b83dcc; } }
      @media (prefers-reduced-motion:reduce) { .sch-hint-piece { animation:none; } }
      @media (prefers-reduced-motion:reduce) { .sch-evaluation-white { transition:none; } }
      /* Explicit rows stop mobile browsers from deriving tall implicit tracks
         from button/SVG intrinsic sizing. The wire protocol only sends chess
         coordinates; each client must render its own stable square geometry. */
      #sch-bord { display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); grid-template-rows:repeat(8,minmax(0,1fr)); grid-auto-rows:minmax(0,1fr); box-sizing:border-box; width:100%; aspect-ratio:1 / 1; overflow:hidden; touch-action:none; user-select:none; }
      #sch-bord,.sch-vak,.sch-stuk { -webkit-user-select:none; -webkit-touch-callout:none; }
      .sch-knight-marker { position:absolute; z-index:3; width:var(--knight-size); height:var(--knight-size); border:2px solid var(--knight-line); border-radius:50%; background:var(--knight-color); box-shadow:0 0 0 1px #fff,0 0 0 2.5px #0b1020,0 2px 4px #0009; box-sizing:border-box; pointer-events:none; }
      .sch-knight-depth-1 { --knight-size:72%; --knight-color:rgb(239 68 68 / .28); --knight-line:#ff7777; z-index:3; }
      .sch-knight-depth-2 { --knight-size:54%; --knight-color:rgb(59 130 246 / .28); --knight-line:#6cb6ff; z-index:4; }
      .sch-knight-depth-3 { --knight-size:38%; --knight-color:rgb(34 197 94 / .28); --knight-line:#64ee95; z-index:5; }
      .sch-knight-depth-4 { --knight-size:24%; --knight-color:rgb(168 85 247 / .3); --knight-line:#d6a0ff; z-index:6; }
      .sch-knight-enemy { border-radius:2px; }
      .sch-knight-enemy.sch-knight-depth-1 { --knight-color:rgb(249 115 22 / .28); --knight-line:#ffad60; }
      .sch-knight-enemy.sch-knight-depth-2 { --knight-color:rgb(6 182 212 / .28); --knight-line:#67e8f9; }
      .sch-knight-enemy.sch-knight-depth-3 { --knight-color:rgb(250 204 21 / .28); --knight-line:#ffe568; }
      .sch-knight-enemy.sch-knight-depth-4 { --knight-color:rgb(255 255 255 / .3); --knight-line:#fff; }
      .sch-knight-source { outline:2px solid #fff3a8; outline-offset:-3px; }
      .sch-knight-holding::after { content:""; position:absolute; z-index:7; inset:3px; border:2px solid #baffdf; border-radius:50%; box-shadow:0 0 7px #78efbd70; pointer-events:none; animation:sch-knight-hold 2s linear both; }
      @keyframes sch-knight-hold { from { transform:scale(1); opacity:.25; } to { transform:scale(.58); opacity:1; } }
      .sch-knight-route-description { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
      .sch-knight-settings { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
      .sch-knight-option { display:flex; flex-direction:column; align-items:center; gap:6px; padding:9px 3px; border:1px solid #c2d3ff33; border-radius:11px; background:linear-gradient(145deg,#ffffff0b,#ffffff03); font-size:11px!important; text-align:center; }
      .sch-knight-option input { width:19px; height:19px; accent-color:#79e6c7; }
      .sch-knight-legend { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px; max-width:100%; padding:7px 10px; border:1px solid #a6c9be55; border-radius:12px; color:#f1f6ee; background:linear-gradient(145deg,#223535f0,#181e2bf0); font-size:11px; }
      .sch-knight-legend[hidden] { display:none; }
      .sch-knight-legend [data-knight-legend-steps] { display:flex; align-items:center; gap:8px; }
      .sch-knight-legend .sch-knight-marker { position:relative; display:inline-grid; place-items:center; width:21px; height:21px; color:#fff; background:#0b1020; font-weight:800; }
      .sch-knight-legend button { width:28px; height:28px; border:1px solid #ffffff44; border-radius:8px; color:#fff; background:#ffffff10; font:inherit; cursor:pointer; }
      .sch-knight-legend .sch-knight-step-toggle { pointer-events:auto; width:26px; height:26px; margin:2px; border:2px solid var(--knight-line); background:var(--knight-color); color:#fff; text-shadow:0 1px 2px #000,0 0 3px #000; }
      .sch-knight-legend .sch-knight-step-toggle[aria-pressed="false"] { opacity:.35; filter:grayscale(.8); }
      .sch-knight-legend .sch-knight-step-toggle:focus-visible { outline:2px solid #fff; outline-offset:3px; }
      @media (prefers-reduced-motion:reduce) { .sch-knight-holding::after { animation:none; opacity:.8; } }
      .sch-vak { box-sizing:border-box; border:0; border-radius:0; padding:0; width:100%; height:100%; min-width:0; min-height:0; position:relative; display:grid; place-items:center; cursor:pointer; }
      .sch-vak:focus-visible { outline:3px solid #55dfff; outline-offset:-3px; z-index:2; }
      .sch-legal-dot { position:absolute; z-index:2; left:50%; top:50%; width:25%; aspect-ratio:1; border:1px solid #111823; border-radius:50%; background:radial-gradient(circle at 32% 24%,#eaffef 0 5%,#94f5b3 16%,#39d979 42%,#13a856 70%,#08643a 100%); box-shadow:inset 0 1px 1px #ffffffd9,inset 0 -2px 3px #03432499,0 1px 3px #000b,0 0 0 1px #ffffffbb; transform:translate(-50%,-50%); pointer-events:none; }
      .sch-legal-capture { position:absolute; z-index:2; inset:3px; border:2px solid #121720; border-radius:8px; background:linear-gradient(145deg,#ff8a8eb0,#f34254a0 52%,#a81336b0); box-shadow:inset 0 1px 0 #fff9,inset 0 -3px 7px #4c071e7a,0 1px 4px #000a,0 0 0 1px #ffdce0; pointer-events:none; }
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
      .sch-menu-backdrop { position:fixed; z-index:999; inset:0; background:linear-gradient(145deg,#07091265,#0d08157a); -webkit-backdrop-filter:blur(6px) saturate(.72) brightness(.74); backdrop-filter:blur(6px) saturate(.72) brightness(.74); }
      .sch-menu-backdrop[hidden] { display:none; }
      .sch-menu-backdrop:not([hidden]) { animation:sch-backdrop-enter .22s ease-out both; }
      .sch-menu { position:fixed; z-index:1000; left:50%; top:50%; transform:translate(-50%,-50%); box-sizing:border-box; width:min(500px,calc(100vw - 28px)); max-height:min(86dvh,760px); overflow:auto; overscroll-behavior:contain; scrollbar-color:#78d9c0 #171a27; padding:clamp(18px,4vw,26px); border:1px solid #baf8e2; border-radius:24px; background:radial-gradient(ellipse at 8% 0%,#7352a44d,transparent 44%),linear-gradient(145deg,#28243a 0%,#171522 52%,#10131d 100%); color:#f6f5ff; box-shadow:0 0 0 1px #bdffe233,0 0 34px #7ae6d51c,0 2px 0 #ffffff26 inset,0 5px 0 #0b0c13,0 12px 0 #07080d,0 30px 80px #000e; text-align:left; }
      .sch-menu:not([hidden]) { animation:sch-menu-enter .28s cubic-bezier(.18,.78,.24,1) both; }
      .sch-menu[hidden] { display:none; }
      @keyframes sch-backdrop-enter { from { opacity:0; } to { opacity:1; } }
      @keyframes sch-menu-enter { from { opacity:0; transform:translate(-50%,-47%) scale(.975); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
      .sch-menu-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .sch-menu h2 { margin:0; padding:4px 0; font-size:clamp(22px,5vw,28px); line-height:1.1; letter-spacing:-.035em; }
      .sch-menu-close { display:grid; place-items:center; flex:none; width:34px; height:34px; padding:0; border:1px solid #d8e8ff3d; border-radius:11px; color:#edf6ff; background:linear-gradient(145deg,#ffffff18,#ffffff08); box-shadow:inset 0 1px #ffffff20,0 3px 7px #0004; font:600 19px/1 system-ui; cursor:pointer; }
      .sch-menu-close:hover { border-color:#a7f2dc; background:linear-gradient(145deg,#ffffff26,#ffffff0c); }
      .sch-menu-close:active { transform:translateY(1px); box-shadow:inset 0 2px 4px #0005; }
      .sch-menu-close:focus-visible { outline:2px solid #91f1d7; outline-offset:3px; }
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
      /* v265: bij schaakmat valt de koning om, met vonken en een schokgolf */
      .sch-koning-mat .sch-stuk { transform:rotate(90deg) translate(14%,-6%) scale(.92); filter:sepia(1) saturate(7) hue-rotate(315deg) brightness(.95) drop-shadow(0 0 6px #ff2d45) drop-shadow(0 2px 2px #000b); }
      .sch-vonk { position:fixed; z-index:30; width:7px; height:7px; margin:-3.5px 0 0 -3.5px; border-radius:50%; pointer-events:none; background:radial-gradient(circle,#fff 0 30%,#ffd36e 45%,#ff7a2f 80%,transparent); box-shadow:0 0 6px #ffb347; }
      .sch-schokgolf { position:fixed; z-index:30; border-radius:50%; pointer-events:none; border:3px solid #ff4d5e; box-shadow:0 0 18px #ff2d45, inset 0 0 12px #ff2d4599; }
      .sch-checkmate-text { box-sizing:border-box; width:max-content; max-width:calc(100vw - 16px); overflow:visible; margin:0; padding:.15em .1em .22em; color:transparent; font-family:Impact,"Arial Black",system-ui,sans-serif; font-size:clamp(28px,11vw,132px); font-size:clamp(28px,min(11vw,calc((100vw - 24px)/5.4)),132px); font-weight:1000; letter-spacing:.035em; line-height:1.1; text-align:center; white-space:nowrap; -webkit-text-stroke:1px #f4fbff; background:linear-gradient(180deg,#fff 0%,#9da8b2 15%,#f8ffff 25%,#65717c 39%,#f2f7fb 52%,#77818b 66%,#fff 79%,#88939e 100%); background-clip:text; -webkit-background-clip:text; filter:drop-shadow(0 2px 0 #fff) drop-shadow(0 4px 0 #63707c) drop-shadow(0 7px 0 #222d37) drop-shadow(0 12px 13px #000c); text-shadow:0 1px 0 #fff,0 2px 0 #aeb8c1,0 3px 0 #59636d,0 5px 0 #252d35,0 12px 22px #000c; }
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
      .sch-focus-restore { position:fixed; top:max(16px,env(safe-area-inset-top)); left:max(16px,env(safe-area-inset-left)); z-index:11; display:grid; place-items:center; width:38px; height:38px; border:1px solid #b6ebde66; border-radius:50%; background:linear-gradient(145deg,#263d42,#121c29); color:#dcfff4; box-shadow:0 3px 0 #080e18,0 6px 18px #0006,inset 0 1px #ffffff35; cursor:pointer; }
      .sch-focus-restore svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
      .sch-focus-restore[hidden] { display:none; }
      .sch-focus-restore:focus-visible,#sch-bord[tabindex="0"]:focus-visible { outline:2px solid #91f1d7; outline-offset:3px; }
      .sch-ultra-focus-host > .spel-titel-bar { display:none; }
      .sch-spel.sch-ultra-focus-active:not([data-ultra-focus="0"]) { gap:6px; }
      .sch-ultra-focus-active:not([data-ultra-focus="0"]) > #sch-status,
      .sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-media-controls,
      .sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-vangst,
      .sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-takeback,
      .sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-legenda,
      .sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-ultra-status,
      .sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-ultra-info:has(.sch-ultra-retry[hidden]) { display:none; }
      .sch-spel.sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-board-row { --sch-history-width:clamp(64px,17vw,90px); gap:4px; }
      .sch-spel.sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-board-row.sch-with-evaluation { --sch-evaluation-width:40px; }
      .sch-spel.sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-evaluation { width:36px; }
      .sch-spel.sch-ultra-focus-active:not([data-ultra-focus="0"]) .sch-board-row .sch-frame { width:calc(100% - var(--sch-history-width) - var(--sch-evaluation-width) - 16px); }
      .sch-spel.sch-ultra-focus-active:is([data-ultra-focus="2"],[data-ultra-focus="3"],[data-ultra-focus="4"]) .sch-board-row { --sch-history-width:0px; }
      .sch-ultra-focus-active:is([data-ultra-focus="2"],[data-ultra-focus="3"],[data-ultra-focus="4"]) .sch-history { display:none; }
      .sch-spel.sch-ultra-focus-active:is([data-ultra-focus="3"],[data-ultra-focus="4"]) .sch-board-row.sch-with-evaluation { --sch-evaluation-width:0px; }
      .sch-ultra-focus-active:is([data-ultra-focus="3"],[data-ultra-focus="4"]) .sch-evaluation { display:none; }
      .sch-spel.sch-ultra-focus-active[data-ultra-focus="3"] .sch-board-row .sch-frame { width:calc(100% - 16px); }
      .sch-ultra-focus-active[data-ultra-focus="4"] .sch-board-tools { display:none; }
      .sch-spel.sch-ultra-focus-active[data-ultra-focus="4"] .sch-board-row .sch-frame { width:100%; padding:2px; border-radius:8px; }
      .sch-spel.sch-ultra-focus-active[data-ultra-focus="4"] .sch-frame.sch-has-hints { padding-top:31px; }
      @media (prefers-reduced-motion:reduce) { .sch-ultra-focus-active .sch-frame { transition:none; } }
    </style>
    <div class="sch-spel">
      ${isUltra ? '<button class="sch-focus-restore" id="sch-focus-restore" type="button" data-sch-label="Compact bord" aria-label="Compact bord" hidden><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5"/></svg></button>' : ''}
      <div id="sch-status" role="status" aria-live="polite" style="color:white;font-size:14px;font-weight:600;text-align:center;min-height:20px;"></div>
      <div class="sch-vangst" id="sch-tegenstander"></div>
      ${isUltra ? `<div class="sch-board-row" id="sch-board-row">
        <aside class="sch-evaluation" id="sch-evaluation" data-sch-label="Geschat voordeel" aria-label="Geschat voordeel" hidden>
          <output class="sch-evaluation-score" id="sch-evaluation-score" aria-live="off">—</output>
          <span class="sch-evaluation-side" data-sch-text="Zwart">Zwart</span>
          <output class="sch-evaluation-delta-value" id="sch-evaluation-black-delta"></output>
          <div class="sch-evaluation-bar" aria-hidden="true"><div class="sch-evaluation-white" id="sch-evaluation-white"></div><div class="sch-evaluation-delta sch-evaluation-delta-white"></div><div class="sch-evaluation-delta sch-evaluation-delta-black"></div></div>
          <output class="sch-evaluation-delta-value" id="sch-evaluation-white-delta"></output>
          <span class="sch-evaluation-side" data-sch-text="Wit">Wit</span>
          <output class="sch-evaluation-ply" id="sch-evaluation-ply" data-sch-title="Telt elke zet van wit en zwart afzonderlijk."></output>
        </aside>` : ''}
        <div class="sch-frame${isUltra ? ' sch-ultra-frame' : ''}"${isUltra ? ' id="sch-ultra-frame"' : ''}><div id="sch-bord" role="group" data-sch-label="Schaken" aria-label="Schaken"></div><button class="sch-spin-perspective" id="sch-spin-perspective" type="button" data-sch-label="Bekijk vanaf de tegenstander" aria-label="Bekijk vanaf de tegenstander" aria-pressed="false" hidden><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 4a8 8 0 0 1 13 6"/><path d="M20 4v6h-6M17 20a8 8 0 0 1-13-6"/><path d="M4 20v-6h6"/></svg></button>${isUltra ? '<button class="sch-hint-button" id="sch-ultra-hint" type="button" data-sch-label="Tip voor deze zet" aria-label="Tip voor deze zet" hidden>!</button><p class="sch-assistance-status" id="sch-ultra-assistance-status" role="status" aria-live="polite"></p>' : ''}</div>
      ${isUltra ? '<aside class="sch-history" id="sch-history" data-sch-label="Zetgeschiedenis" aria-label="Zetgeschiedenis"><h3 data-sch-text="Zetgeschiedenis">Zetgeschiedenis</h3><div class="sch-history-scroll" id="sch-history-scroll" tabindex="0" data-sch-label="Zetgeschiedenis" aria-label="Zetgeschiedenis"><table><thead><tr><th scope="col">#</th><th scope="col" data-sch-text="Wit">Wit</th><th scope="col" data-sch-text="Zwart">Zwart</th></tr></thead><tbody id="sch-history-moves"></tbody></table><p class="sch-history-empty" id="sch-history-empty" data-sch-text="Nog geen zetten">Nog geen zetten</p></div></aside></div><div class="sch-swipe-takeback" id="sch-ultra-swipe" role="button" tabindex="0" aria-disabled="true" aria-labelledby="sch-ultra-swipe-label" aria-describedby="sch-ultra-swipe-help" hidden><span class="sch-swipe-label" id="sch-ultra-swipe-label"></span><span class="sch-swipe-thumb" aria-hidden="true">←</span></div><span id="sch-ultra-swipe-help" class="sch-swipe-help" data-sch-text="Veeg van rechts naar links tot voorbij het midden. Laat daarna los.">Veeg van rechts naar links tot voorbij het midden. Laat daarna los.</span><div class="sch-ultra-info"><p class="sch-ultra-status" id="sch-ultra-status" role="status" aria-live="polite"></p><button class="sch-ultra-retry" id="sch-ultra-retry" type="button" data-sch-text="Opnieuw proberen" hidden>Opnieuw proberen</button></div>' : ''}
      <div class="sch-vangst" id="sch-eigen"></div>
      ${!isVriendPartij ? '<div class="sch-knight-legend" id="sch-knight-route-legend" role="status" aria-live="polite" hidden><span data-knight-legend-label></span><span data-knight-legend-steps></span><button type="button" data-knight-close data-sch-label="Paardroutes sluiten" aria-label="Paardroutes sluiten">×</button></div>' : ''}
      <div class="sch-legenda"></div>
      <div class="sch-acties">
        ${isUltra ? '<button class="sch-takeback" id="sch-ultra-takeback" type="button" hidden disabled>↶ <span data-sch-text="Zet terugnemen">Zet terugnemen</span></button>' : ''}
        <div class="sch-board-tools">
          <span class="sch-board-label"><span data-sch-text="Bord">Bord</span></span>
          <div class="sch-size-switch" role="group" data-sch-label="Bordgrootte" aria-label="Bordgrootte">
            <button class="sch-compact" type="button" aria-pressed="true" data-sch-label="Compact bord" aria-label="Compact bord"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5"/></svg><span><span data-sch-text="Compact">Compact</span></span></button>
            <button class="sch-zoom" type="button" aria-pressed="false" data-sch-label="Bord op volle breedte" aria-label="Bord op volle breedte" aria-haspopup="dialog" aria-expanded="false"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"/></svg><span><span data-sch-text="Volle breedte">Volle breedte</span></span></button>
          </div>
          <button class="sch-settings" type="button" data-sch-label="Schaakinstellingen" aria-label="Schaakinstellingen" aria-haspopup="dialog" aria-expanded="false" aria-controls="sch-menu"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#1e293b"/><circle cx="15" cy="17" r="3" fill="#1e293b"/></svg></button>
        </div>
        ${isVriendPartij ? '<button class="sch-video" id="sch-video" type="button" aria-pressed="false">📹 Webcam</button>' : ''}
        <div class="sch-menu-backdrop" id="sch-menu-backdrop" hidden aria-hidden="true"></div>
        <section class="sch-menu" id="sch-menu" role="dialog" aria-modal="true" data-sch-label="Schaakinstellingen" aria-label="Schaakinstellingen" hidden>
          <header class="sch-menu-header"><h2><span data-sch-text="Schaakinstellingen">Schaakinstellingen</span></h2><button class="sch-menu-close" id="sch-menu-close" type="button" data-sch-label="Instellingen sluiten" aria-label="Instellingen sluiten">×</button></header>
          <p class="sch-menu-lead"><span data-sch-text="Maak het bord, de stukken en het spel naar jouw smaak.">Maak het bord, de stukken en het spel naar jouw smaak.</span></p>
          <section class="sch-menu-section" aria-labelledby="sch-language-heading">
            <h3 id="sch-language-heading" data-sch-text="Taal">Taal</h3>
            <label for="sch-language" data-sch-text="Taal van het schaakspel">Taal van het schaakspel</label>
            <select id="sch-language" aria-describedby="sch-language-hint"><option value="nl" lang="nl">Nederlands</option><option value="en" lang="en">English</option></select>
            <p class="sch-menu-hint" id="sch-language-hint" data-sch-text="Deze keuze geldt alleen voor schaken op dit apparaat. Je partij en andere instellingen blijven bewaard.">Deze keuze geldt alleen voor schaken op dit apparaat. Je partij en andere instellingen blijven bewaard.</p>
          </section>
          <section class="sch-menu-section" aria-labelledby="sch-gameplay-heading">
            <h3 id="sch-gameplay-heading"><span data-sch-text="Spelverloop">Spelverloop</span></h3>
            <fieldset><legend><span data-sch-text="Denktijd van de computer">Denktijd van de computer</span></legend>
              <label for="sch-denktijd"><span data-sch-text="Maximum:">Maximum:</span> <output id="sch-denktijd-waarde">7 seconden</output></label>
              <input id="sch-denktijd" type="range" min="0" max="7" step="1" value="${isUltra ? instellingen.ultraThinking : instellingen.thinking}" aria-describedby="sch-denktijd-hint">
              <p class="sch-menu-hint" id="sch-denktijd-hint">${tekst(isUltra ? '0 = geen extra wachttijd. De engine heeft wel rekentijd nodig. Anders wisselt de computer zijn denktijd af tot het gekozen maximum.' : '0 = direct. Anders wisselt de computer zijn denktijd af tot het gekozen maximum.')}</p>
            </fieldset>
            <fieldset><legend><span data-sch-text="Grootte van de stukken">Grootte van de stukken</span></legend><div class="sch-menu-opties" data-options="pieces">
              <button class="sch-keuze" type="button" data-value="small"><span data-sch-text="Kleiner">Kleiner</span></button><button class="sch-keuze" type="button" data-value="medium"><span data-sch-text="Standaard">Standaard</span></button><button class="sch-keuze" type="button" data-value="large"><span data-sch-text="Groter">Groter</span></button>
            </div></fieldset>
            <label class="sch-attack-toggle"><input id="sch-spin-board-enabled" type="checkbox"> <span data-sch-text="Bord draaien kijken is mogelijk">Bord draaien kijken is mogelijk</span></label>
            <p class="sch-menu-hint" data-sch-text="Toont een knop om het bord vanuit het perspectief van de tegenstander te bekijken. In die stand kun je geen zetten doen.">Toont een knop om het bord vanuit het perspectief van de tegenstander te bekijken. In die stand kun je geen zetten doen.</p>
            <label class="sch-attack-toggle"><input id="sch-noob-mode" type="checkbox"> <span data-sch-text="Beginnersmodus (kinderen)">Beginnersmodus (kinderen)</span></label>
            <p class="sch-menu-hint"><span data-sch-text="Waarschuwt voordat je een stuk onbeschermd achterlaat. Zetten die je eigen koning schaak zetten, blijven geblokkeerd.">Waarschuwt voordat je een stuk onbeschermd achterlaat. Zetten die je eigen koning schaak zetten, blijven geblokkeerd.</span></p>
            <label class="sch-attack-toggle"><input id="sch-aanvalsroutes" type="checkbox"> <span data-sch-text="Aanvalsroutes tonen">Aanvalsroutes tonen</span></label>
            <label class="sch-attack-toggle" id="sch-exaggerate-wrap" hidden><input id="sch-exaggerate" type="checkbox"> <span data-sch-text="Extra nadruk">Extra nadruk</span></label>
            <p class="sch-menu-hint"><span data-sch-text="Markeert vijandelijke stukken die het laatst verplaatste stuk volgens de regels kan slaan.">Markeert vijandelijke stukken die het laatst verplaatste stuk volgens de regels kan slaan.</span></p>
            ${isUltra ? `<label class="sch-attack-toggle"><input id="sch-ultra-evaluation-enabled" type="checkbox" aria-describedby="sch-ultra-evaluation-hint"> <span data-sch-text="Live evaluatie tonen">Live evaluatie tonen</span></label>
            <p class="sch-menu-hint" id="sch-ultra-evaluation-hint" data-sch-text="Toont een geschatte stellingsevaluatie naast het bord. Positief is voordeel voor wit; negatief voor zwart.">Toont een geschatte stellingsevaluatie naast het bord. Positief is voordeel voor wit; negatief voor zwart.</p>
            <label class="sch-attack-toggle"><input id="sch-ultra-takeback-enabled" type="checkbox"> <span data-sch-text="Take-back">Take-back</span></label>
            <p class="sch-menu-hint" data-sch-text="Neem je laatste eigen zet terug, ook als Ultra al heeft geantwoord. Standaard uit.">Neem je laatste eigen zet terug, ook als Ultra al heeft geantwoord. Standaard uit.</p>
            <label class="sch-attack-toggle"><input id="sch-ultra-hints-enabled" type="checkbox"> <span data-sch-text="Tips &amp; hints">Tips &amp; hints</span></label>
            <p class="sch-menu-hint" data-sch-text="De !-knop markeert één eigen stuk dat je goed kunt verplaatsen. Standaard uit.">De !-knop markeert één eigen stuk dat je goed kunt verplaatsen. Standaard uit.</p>` : ''}
          </section>
          ${!isVriendPartij ? `<section class="sch-menu-section" aria-labelledby="sch-knight-heading">
            <h3 id="sch-knight-heading" data-sch-text="Paardroutes">Paardroutes</h3>
            <p class="sch-menu-hint" id="sch-knight-help" data-sch-text="Houd tijdens jouw beurt een paard twee seconden vast. Bolletjes zijn jouw routes; vierkantjes zijn die van de computer. De andere stukken blijven staan; tegenzetten worden niet voorspeld.">Houd tijdens jouw beurt een paard twee seconden vast. Bolletjes zijn jouw routes; vierkantjes zijn die van de computer. De andere stukken blijven staan; tegenzetten worden niet voorspeld.</p>
            <div class="sch-knight-settings">${[1,2,3,4].map(n => `<label class="sch-knight-option"><input type="checkbox" data-knight-step="${n}" aria-describedby="sch-knight-help"${instellingen.knightRouteSteps[n-1] ? ' checked' : ''}><span data-sch-text="${n === 1 ? '1 sprong' : n + ' sprongen'}">${n === 1 ? '1 sprong' : n + ' sprongen'}</span></label>`).join('')}</div>
          </section>` : ''}
          <section class="sch-menu-section" aria-labelledby="sch-board-heading">
            <h3 id="sch-board-heading"><span data-sch-text="Bord en veroverde stukken">Bord en veroverde stukken</span></h3>
            <fieldset><legend><span data-sch-text="Bordstijl">Bordstijl</span></legend><div class="sch-menu-opties" data-options="board">
              <button class="sch-keuze" type="button" data-value="classic"><span data-sch-text="Klassiek">Klassiek</span></button><button class="sch-keuze" type="button" data-value="wood"><span data-sch-text="Houtnerf">Houtnerf</span></button><button class="sch-keuze" type="button" data-value="marble"><span data-sch-text="Marmer / graniet">Marmer / graniet</span></button><button class="sch-keuze" type="button" data-value="glass"><span data-sch-text="Glasplaat">Glasplaat</span></button>
            </div></fieldset>
            <label class="sch-attack-toggle"><input id="sch-points-per-piece" type="checkbox"> <span data-sch-text="Punten per stuk">Punten per stuk</span></label>
            <p class="sch-menu-hint"><span data-sch-text="Toont de waarde van elk veroverd stuk in de scorevakken.">Toont de waarde van elk veroverd stuk in de scorevakken.</span></p>
          </section>
          <section class="sch-menu-section" aria-labelledby="sch-wallpaper-heading">
            <h3 id="sch-wallpaper-heading"><span data-sch-text="4D wallpaper">4D wallpaper</span></h3>
            <label class="sch-attack-toggle"><input id="sch-wallpaper-enabled" type="checkbox" aria-describedby="sch-wallpaper-hint"> <span data-sch-text="Tafelachtergrond">Tafelachtergrond</span></label>
            <p class="sch-menu-hint" id="sch-wallpaper-hint" data-sch-text="Kantel je telefoon of beweeg je muis voor diepte in de achtergrond. Het bord blijft stil.">Kantel je telefoon of beweeg je muis voor diepte in de achtergrond. Het bord blijft stil.</p>
            <button class="sch-wallpaper-motion" id="sch-wallpaper-motion" type="button" data-sch-text="Telefoonbeweging activeren" hidden>Telefoonbeweging activeren</button>
            <p class="sch-menu-hint" id="sch-wallpaper-status" role="status" aria-live="polite"></p>
          </section>
          <section class="sch-menu-section" aria-labelledby="sch-media-heading">
            <h3 id="sch-media-heading"><span data-sch-text="Geluid en camera’s">Geluid en camera’s</span></h3>
            <label for="sch-sound-theme"><span data-sch-text="Geluidsthema">Geluidsthema</span></label>
            <select id="sch-sound-theme"><option value="classic" data-sch-text="Klassiek (standaard)">Klassiek (standaard)</option><option value="wood" data-sch-text="Houten bord">Houten bord</option></select>
            <p class="sch-menu-hint"><span data-sch-text="Kies hoe het klinkt wanneer een stuk op het bord wordt gezet.">Kies hoe het klinkt wanneer een stuk op het bord wordt gezet.</span></p>
            <label class="sch-attack-toggle"><input id="sch-graded-capture-sounds" type="checkbox" aria-describedby="sch-graded-capture-hint"> <span data-sch-text="Gradatie-geluiden schaakstukken">Gradatie-geluiden schaakstukken</span></label>
            <p class="sch-menu-hint" id="sch-graded-capture-hint">${tekst(isUltra ? 'Ultra: standaard aan. Positieve klanken bij veroveren en donkere klanken bij verlies; meer punten klinkt krachtiger.' : 'Standaard uit: de oorspronkelijke geluiden. Aan: positieve klanken bij veroveren en donkere klanken bij verlies. Meer punten klinkt krachtiger.')}</p>
            ${isUltra ? '<label class="sch-attack-toggle"><input id="sch-ultra-evaluation-sound" type="checkbox" aria-describedby="sch-ultra-evaluation-sound-hint"> <span data-sch-text="Geluid bij evaluatieverandering">Geluid bij evaluatieverandering</span></label><p class="sch-menu-hint" id="sch-ultra-evaluation-sound-hint" data-sch-text="Speelt na elke zet een korte klank voor de verandering vanuit jouw perspectief. Standaard uit.">Speelt na elke zet een korte klank voor de verandering vanuit jouw perspectief. Standaard uit.</p>' : ''}
            <label class="sch-attack-toggle"><input id="sch-cameras-at-top" type="checkbox"> <span data-sch-text="Webcams samen bovenaan">Webcams samen bovenaan</span></label>
            <p class="sch-menu-hint"><span data-sch-text="Zet beide camerabeelden boven het bord. Tik op een beeld om het te vergroten of te verkleinen.">Zet beide camerabeelden boven het bord. Tik op een beeld om het te vergroten of te verkleinen.</span></p>
          </section>
          ${isVriendPartij ? `<section class="sch-menu-section" aria-labelledby="sch-three-player-heading">
            <h3 id="sch-three-player-heading"><span data-sch-text="Schaken met drie spelers">Schaken met drie spelers</span></h3>
            <label class="sch-attack-toggle"><input id="sch-three-player-enabled" type="checkbox"> <span data-sch-text="Een derde speler uitnodigen toestaan">Een derde speler uitnodigen toestaan</span></label>
            <p class="sch-menu-hint">${testMode ? tekst('Alleen een lokale test: deelnemen opent het bord met 96 vakken. Er wordt niemand uitgenodigd.') : tekst('Tip: zet dit aan vóór de eerste zet. Je kunt ook later tijdens een partij met twee spelers iemand uitnodigen. Bij acceptatie begint voor iedereen een nieuwe partij met drie spelers vanuit de beginstelling.')}</p>
            <button class="sch-keuze" id="sch-three-player-invite" type="button" hidden>${testMode ? tekst('＋ Als derde testspeler meedoen') : tekst('＋ Nu een derde speler uitnodigen')}</button>
          </section>` : ''}
          <p class="sch-menu-hint"><span data-sch-text="Kies Compact of Volle breedte om het bord te schalen. Houd Volle breedte drie seconden ingedrukt om deze instellingen te openen.">Kies Compact of Volle breedte om het bord te schalen. Houd Volle breedte drie seconden ingedrukt om deze instellingen te openen.</span></p>
        </section>
      </div>
      <div id="sch-promotie" style="display:none;gap:8px;background:rgba(0,0,0,0.85);padding:10px;border-radius:10px;"></div>
      <div class="sch-checkmate" id="sch-checkmate" role="status" aria-live="assertive" hidden><h2 class="sch-checkmate-text"><span data-sch-text="SCHAAKMAT">SCHAAKMAT</span></h2></div>
      <div class="sch-noob-dialog" id="sch-noob-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sch-noob-title" aria-describedby="sch-noob-message" hidden>
        <div class="sch-noob-card"><h2 id="sch-noob-title"><span data-sch-text="Beginnertip">Beginnertip</span></h2><p id="sch-noob-message"></p><div class="sch-noob-buttons"><button type="button" id="sch-noob-cancel"><span data-sch-text="Zet annuleren">Zet annuleren</span></button><button type="button" id="sch-noob-continue"><span data-sch-text="Toch spelen">Toch spelen</span></button></div></div>
      </div>
      <button id="sch-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;"><span data-sch-text="↻ Opnieuw spelen">↻ Opnieuw spelen</span></button>
    </div>`

  const bordEl = document.getElementById('sch-bord')
  const tafelklap = maakSchaakTafelklap({
    stage:inhoud.querySelector('.sch-frame'),
    board:bordEl,
    channel:spelKanaal?.isSolo ? null : spelKanaal,
    onImpact:({ cracked }) => Bordgeluid.tafelklap?.({ cracked })
  })
  opruimers.push(() => tafelklap.destroy())
  const statusEl = document.getElementById('sch-status')
  let statusBericht = null
  function toonStatus(key, values) {
    statusBericht = { key, values }
    statusEl.textContent = spinPerspectiveActive
      ? t('Tegenstandersperspectief: alleen bekijken; zetten zijn uitgeschakeld.')
      : t(key, values)
  }
  const opnieuwBtn = document.getElementById('sch-opnieuw'); Bordgeluid.knop(statusEl, { language:taal.language })
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
        videoBtn.title = t('Webcam uitzetten')
        videoBtn.setAttribute('aria-label', t('Webcam uitzetten'))
      } else {
        if (videoKnopVolgende?.parentNode === videoKnopThuis) videoKnopThuis.insertBefore(videoBtn, videoKnopVolgende)
        else videoKnopThuis.append(videoBtn)
        videoBtn.classList.remove('sch-video-stop')
        videoBtn.textContent = '📹 Webcam'
        videoBtn.title = ''
        videoBtn.setAttribute('aria-label', t('Webcam aanzetten'))
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
      toonStatus(detail.sleutel || detail.tekst, detail.waarden)
      videoBtn.classList.toggle('is-connecting', Boolean(detail.bezig))
      videoBtn.disabled = false
      if (detail.bezig) videoBtn.textContent = '📹 ' + t('Verbinden…')
      else if (videoBtn.getAttribute('aria-pressed') !== 'true') zetVideoKnopPlek(false)
    }
    window.addEventListener('fibro-chess-video-state', pasVideoKnopAan)
    window.addEventListener('fibro-chess-video-progress', toonVideoVoortgang)
    opruimers.push(() => {
      window.removeEventListener('fibro-chess-video-state', pasVideoKnopAan)
      window.removeEventListener('fibro-chess-video-progress', toonVideoVoortgang)
    })
    videoBtn.addEventListener('click', async event => {
      event.stopPropagation()
      videoBtn.classList.add('is-connecting')
      videoBtn.textContent = '📹 ' + t('Verbinden…')
      toonStatus('Je cameraverbinding wordt gestart…')
      videoBtn.disabled = true
      const antwoord = await window.FibroChessVideo?.()
      videoBtn.disabled = false
      if (!antwoord?.ok) {
        videoBtn.classList.remove('is-connecting')
        videoBtn.textContent = '📹 Webcam'
        toonStatus(antwoord?.reason === 'connecting'
          ? 'De verbinding met je vriend wordt nog opgebouwd. Houd de partij open en probeer het zo nog eens.'
          : 'Je camera kon niet worden gestart. Controleer de cameratoestemming en probeer het opnieuw.')
        return
      }
      pasVideoKnopAan({ detail:antwoord })
    })
  }
  inhoud.querySelector('.sch-legenda').textContent = t('Pion 1 · Paard 3 · Loper 3 · Toren 5 · Dame 9')
  function tekenVeroverd() {
    for (const [id,kleur,naam] of [['sch-eigen',mijnKleur,t('Jij')],['sch-tegenstander',vriendKleur,tegenstanderNaam()]]) {
      const paneel = document.getElementById(id)
      paneel.replaceChildren()
      const kop = document.createElement('div')
      kop.className = 'sch-vangst-kop'
      const label = document.createElement('strong')
      label.textContent = naam
      const score = document.createElement('span')
      const punten = veroverdePunten(veroverd[kleur])
      score.textContent = t(punten === 1 ? 'Veroverd: {n} punt' : 'Veroverd: {n} punten', { n:punten })
      kop.append(label,score)
      const lijst = document.createElement('div')
      lijst.className = 'sch-vangst-stukken'
      lijst.setAttribute('aria-label', `${score.textContent} (${veroverd[kleur].map(stuk => `${t(READABLE_NAMES[stuk[1]])}${instellingen.pointsPerPiece ? ', ' + t(STUKPUNTEN[stuk[1]] === 1 ? '{n} punt' : '{n} punten', { n:STUKPUNTEN[stuk[1]] }) : ''}`).join(', ')})`)
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
  const menuClose = inhoud.querySelector('#sch-menu-close')
  const soundTheme = menu.querySelector('#sch-sound-theme')
  const languageSelect = menu.querySelector('#sch-language')
  const spinBoardToggle = menu.querySelector('#sch-spin-board-enabled')
  const spinButton = inhoud.querySelector('#sch-spin-perspective')
  const spinHintButton = inhoud.querySelector('#sch-ultra-hint')
  const schaakFrame = inhoud.querySelector('.sch-frame')
  const wallpaperRoot = document.getElementById('spelOverlay') || inhoud
  function toonSpinButton() {
    spinButton.hidden = instellingen.spinBoard !== true
    schaakFrame.classList.toggle('sch-has-spin', !spinButton.hidden)
    schaakFrame.classList.toggle('sch-has-spin-and-hint', !spinButton.hidden && Boolean(spinHintButton && !spinHintButton.hidden))
    const label = spinPerspectiveActive ? 'Terug naar jouw perspectief' : 'Bekijk vanaf de tegenstander'
    spinButton.setAttribute('aria-pressed', String(spinPerspectiveActive))
    spinButton.dataset.schLabel = label
    spinButton.setAttribute('aria-label', t(label))
  }
  function herstelStatusNaSpin() {
    if (spinPerspectiveActive) {
      statusEl.textContent = t('Tegenstandersperspectief: alleen bekijken; zetten zijn uitgeschakeld.')
    } else if (statusBericht) {
      statusEl.textContent = t(statusBericht.key, statusBericht.values)
    } else if (gameOver) {
      statusEl.textContent = ''
    } else if (staat.aanZet === mijnKleur) {
      toonStatus('Jij bent aan zet')
    } else {
      toonStatus('Wachten op {naam}', { naam:tegenstanderNaam() })
    }
  }
  function zetSpinPerspectief(aan) {
    const actief = aan === true && instellingen.spinBoard === true
    if (spinPerspectiveActive === actief) return
    spinPerspectiveActive = actief
    wallpaperRoot.classList.toggle('sch-wallpaper-flipped', actief)
    geselecteerd = null
    mogelijkeZetten = []
    paardRoutesUI?.clear()
    if (isUltra) wisUltraHint()
    toonSpinButton()
    tekenBord()
    herstelStatusNaSpin()
  }
  spinBoardToggle.checked = instellingen.spinBoard === true
  spinBoardToggle.addEventListener('change', () => {
    instellingen.spinBoard = spinBoardToggle.checked === true
    if (!instellingen.spinBoard) zetSpinPerspectief(false)
    bewaarInstellingen()
    toonSpinButton()
  })
  spinButton.addEventListener('click', () => zetSpinPerspectief(!spinPerspectiveActive))
  toonSpinButton()
  languageSelect.value = taal.language
  languageSelect.addEventListener('change', () => taal.setLanguage(languageSelect.value))
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
    ultraSwipe?.refresh()
    paardRoutesUI?.refresh()
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
  const thinkingKey = isUltra ? 'ultraThinking' : 'thinking'
  menu.querySelector('#sch-denktijd').closest('fieldset').hidden = !spelKanaal.isSolo
  denktijd.value = String(instellingen[thinkingKey])
  function toonDenktijd() {
    const thinking = instellingen[thinkingKey]
    denktijdWaarde.value = thinking === 0 ? t('Direct') : t(thinking === 1 ? '{n} seconde' : '{n} seconden', { n:thinking })
  }
  toonDenktijd()
  denktijd.addEventListener('input', () => {
    instellingen[thinkingKey] = Number(denktijd.value)
    toonDenktijd()
    bewaarInstellingen()
    if (spelKanaal.isSolo) spelKanaal.send({ type:'broadcast', event:'bot-instellingen', payload:{ thinkingMs:instellingen[thinkingKey] * 1000 } })
  })
  menu.querySelectorAll('[data-options] .sch-keuze').forEach(button => button.addEventListener('click', () => kiesMenuOptie(button.closest('[data-options]').dataset.options, button.dataset.value)))
  for (const group of ['pieces','board']) menu.querySelectorAll(`[data-options="${group}"] .sch-keuze`).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === instellingen[group])))
  soundTheme.value = instellingen.soundTheme
  soundTheme.addEventListener('change', () => {
    instellingen.soundTheme = soundTheme.value
    bewaarInstellingen()
    Bordgeluid.previewSchaakGeluid(instellingen.soundTheme)
  })
  const gradedCaptureToggle = menu.querySelector('#sch-graded-capture-sounds')
  const gradedCaptureKey = isUltra ? 'ultraGradedCaptureSounds' : 'gradedCaptureSounds'
  gradedCaptureToggle.checked = instellingen[gradedCaptureKey]
  gradedCaptureToggle.addEventListener('change', () => {
    instellingen[gradedCaptureKey] = gradedCaptureToggle.checked === true
    bewaarInstellingen()
  })
  const cameraLayoutToggle = menu.querySelector('#sch-cameras-at-top')
  // v265: tegen een vriend staan de webcams nu als rondjes bovenin (chat.html); deze keuze geldt alleen nog in de schaaktest
  if (!testMode) cameraLayoutToggle.closest('label').hidden = true
  cameraLayoutToggle.checked = instellingen.camerasAtTop
  cameraLayoutToggle.addEventListener('change', () => {
    instellingen.camerasAtTop = cameraLayoutToggle.checked
    bewaarInstellingen()
  })
  // The background has a shared preference across ordinary, Ultra and three-player chess.
  const wallpaperToggle = menu.querySelector('#sch-wallpaper-enabled')
  const wallpaperMotionButton = menu.querySelector('#sch-wallpaper-motion')
  const wallpaperStatus = menu.querySelector('#sch-wallpaper-status')
  const schaakWallpaper = maakSchaakWallpaper({ root:wallpaperRoot })
  function toonSchaakWallpaper() {
    wallpaperToggle.checked = schaakWallpaper.enabled
    const state = schaakWallpaper.motionState
    wallpaperMotionButton.hidden = !schaakWallpaper.enabled || !['permission','denied'].includes(state)
    const key = {
      pointer:'Beweeg je muis voor diepte. Het bord blijft stil.',
      motion:'Telefoonbeweging actief. Het bord blijft stil.',
      permission:'Activeer telefoonbeweging voor diepte bij kantelen.',
      denied:'Telefoonbeweging is niet toegestaan. Je tafelachtergrond blijft zichtbaar.',
      reduced:'Je voorkeur voor minder beweging houdt de achtergrond stil.',
      unavailable:'Je tafelachtergrond blijft stil op dit apparaat.'
    }[state]
    wallpaperStatus.textContent = schaakWallpaper.enabled && key ? t(key) : ''
  }
  wallpaperToggle.addEventListener('change', () => {
    // Keep the permission request in this user gesture, including on iOS.
    schaakWallpaper.setEnabled(wallpaperToggle.checked === true, { requestMotion:true }).then(toonSchaakWallpaper)
  })
  wallpaperMotionButton.addEventListener('click', () => {
    schaakWallpaper.activateMotion().then(toonSchaakWallpaper)
  })
  const stopWallpaper = schaakWallpaper.subscribe(toonSchaakWallpaper)
  toonSchaakWallpaper()
  opruimers.push(() => { wallpaperRoot.classList.remove('sch-wallpaper-flipped'); stopWallpaper(); schaakWallpaper.destroy() })
  const threePlayerToggle = menu.querySelector('#sch-three-player-enabled')
  const threePlayerInvite = menu.querySelector('#sch-three-player-invite')
  if (threePlayerToggle && threePlayerInvite) {
    threePlayerToggle.checked = instellingen.threePlayer
    threePlayerInvite.hidden = !threePlayerToggle.checked
    threePlayerInvite.disabled = typeof onInviteThird !== 'function'
    threePlayerToggle.addEventListener('change', () => {
      instellingen.threePlayer = threePlayerToggle.checked
      threePlayerInvite.hidden = !threePlayerToggle.checked
      bewaarInstellingen()
    })
    threePlayerInvite.addEventListener('click', async () => {
      if (typeof onInviteThird !== 'function') return
      threePlayerInvite.disabled = true
      try { await onInviteThird() }
      catch (error) { console.warn('[chess] Third-player invitation failed:', error) }
      finally { threePlayerInvite.disabled = false }
    })
  }
  const aanvalToggle = menu.querySelector('#sch-aanvalsroutes')
  const exaggerateToggle = menu.querySelector('#sch-exaggerate')
  const exaggerateWrap = menu.querySelector('#sch-exaggerate-wrap')
  aanvalToggle.checked = instellingen.showAttackRoutes
  exaggerateWrap.hidden = !instellingen.showAttackRoutes && !isVriendPartij
  exaggerateToggle.checked = !isVriendPartij && instellingen.exaggerate
  exaggerateToggle.disabled = isVriendPartij
  if (isVriendPartij) {
    exaggerateWrap.hidden = false
    exaggerateWrap.setAttribute('data-sch-title', 'Niet beschikbaar tegen een vriend.')
    exaggerateWrap.insertAdjacentHTML('beforeend', ' ' + tekst('(alleen tegen de computer)'))
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
    if (noobWrap) {
      noobWrap.setAttribute('data-sch-title', 'Niet beschikbaar tegen een vriend.')
      noobWrap.insertAdjacentHTML('beforeend', ' ' + tekst('(alleen tegen de computer)'))
    }
  }
  noobToggle.addEventListener('change', () => {
    instellingen.noobMode = noobToggle.checked
    bewaarInstellingen()
  })

  // Ultra evaluation is a solo-only aid. A value is shown only for the current
  // position; analysis arriving during the move animation waits for its board.
  const ultraEvaluationToggle = menu.querySelector('#sch-ultra-evaluation-enabled')
  const ultraSoundToggle = menu.querySelector('#sch-ultra-evaluation-sound')
  const ultraEvaluationEl = inhoud.querySelector('#sch-evaluation')
  const ultraEvaluationScore = inhoud.querySelector('#sch-evaluation-score')
  const ultraEvaluationWhite = inhoud.querySelector('#sch-evaluation-white')
  const ultraWhiteDelta = inhoud.querySelector('#sch-evaluation-white-delta')
  const ultraBlackDelta = inhoud.querySelector('#sch-evaluation-black-delta')
  const ultraPlyEl = inhoud.querySelector('#sch-evaluation-ply')
  const ultraHistoryMoves = inhoud.querySelector('#sch-history-moves')
  const ultraHistoryEmpty = inhoud.querySelector('#sch-history-empty')
  const ultraHistoryScroll = inhoud.querySelector('#sch-history-scroll')
  const ultraBoardRow = inhoud.querySelector('#sch-board-row')
  const ultraStatusEl = inhoud.querySelector('#sch-ultra-status')
  const ultraRetryBtn = inhoud.querySelector('#sch-ultra-retry')
  const ultraTakebackToggle = menu.querySelector('#sch-ultra-takeback-enabled')
  const ultraHintsToggle = menu.querySelector('#sch-ultra-hints-enabled')
  const ultraTakebackBtn = inhoud.querySelector('#sch-ultra-takeback')
  const ultraSwipeEl = inhoud.querySelector('#sch-ultra-swipe')
  const ultraSwipeLabel = inhoud.querySelector('#sch-ultra-swipe-label')
  const ultraHintBtn = inhoud.querySelector('#sch-ultra-hint')
  const ultraFrame = inhoud.querySelector('#sch-ultra-frame')
  const ultraAssistanceStatus = inhoud.querySelector('#sch-ultra-assistance-status')
  const ultraHistorie = isUltra ? maakUltraEvaluatieHistorie() : null
  const ultraAnalyseGeluid = isUltra ? Bordgeluid.maakSchaakAnalyseGeluid?.() : null
  const ultraZetten = []
  const ultraWachtendeEvaluaties = new Map()
  const ultraBordMomenten = new Map()
  let ultraGeneration = 0
  let ultraTakebackPending = null
  let ultraHintPending = null
  let ultraHint = null
  let ultraAssistanceStatusKey = ''
  let ultraEvaluation = null
  let ultraPhase = 'loading'
  let ultraSource = null
  let ultraDisposed = false
  let ultraSwipe = null
  let ultraSwipeState = { active:false, enabled:false, state:'disabled' }
  const ultraFenSleutel = fen => typeof fen === 'string' ? fen.trim().split(/\s+/).slice(0,4).join(' ') : ''
  const ultraAnalyseAan = () => instellingen.showUltraEvaluation === true || instellingen.ultraEvaluationSound === true
  const kopieerUltra = value => value == null ? value : JSON.parse(JSON.stringify(value))
  const ultraGeldigeGeneratie = payload => payload.generation === undefined || payload.generation === ultraGeneration
  function wisUltraHint() {
    ultraHint = null
    ultraHintPending = null
    if (!ultraTakebackPending) ultraAssistanceStatusKey = ''
  }
  function toonUltraAssistentie() {
    if (!isUltra || ultraDisposed) return
    ultraTakebackBtn.hidden = instellingen.ultraTakeback !== true
    ultraTakebackBtn.disabled = !kanUltraTerugnemen()
    ultraSwipeEl.hidden = instellingen.ultraTakeback !== true
    ultraSwipe?.refresh()
    toonUltraVeeg()
    const hintAan = instellingen.ultraHints === true
    ultraHintBtn.hidden = !hintAan || spinPerspectiveActive || staat.aanZet !== mijnKleur || gameOver || promotieOpen
    ultraHintBtn.disabled = bezig || !!ultraHintPending || !!ultraTakebackPending
    ultraHintBtn.setAttribute('aria-busy', String(!!ultraHintPending))
    ultraFrame.classList.toggle('sch-has-hints', hintAan || !!ultraAssistanceStatusKey)
    ultraAssistanceStatus.textContent = ultraAssistanceStatusKey ? t(ultraAssistanceStatusKey) : ''
    toonSpinButton()
  }
  function kanUltraTerugnemen() {
    return isUltra && !ultraDisposed && spelEl.isConnected && instellingen.ultraTakeback === true &&
      ultraZetten.length > 0 && !bezig && !promotieOpen && !ultraTakebackPending
  }
  function toonUltraVeeg() {
    if (!isUltra) return
    const key = ultraTakebackPending ? 'Zet terugnemen…' : ultraSwipeState.state === 'ready' ? 'Laat los om je zet terug te nemen.' :
      ultraSwipeState.enabled ? 'Veeg naar links om je zet terug te nemen.' : 'Geen zet om terug te nemen.'
    ultraSwipeLabel.textContent = t(key)
  }
  function neemUltraZetTerug() {
    if (!kanUltraTerugnemen()) return false
    const targetPly = Math.max(...[...ultraBordMomenten].filter(([ply, moment]) => ply < ultraZetten.length && moment.staat.aanZet === mijnKleur).map(([ply]) => ply))
    if (!Number.isSafeInteger(targetPly)) return false
    ultraTakebackPending = { ply:ultraZetten.length, generation:ultraGeneration, targetPly }
    wisUltraHint()
    ultraAssistanceStatusKey = 'Zet terugnemen…'
    toonUltraAssistentie()
    spelKanaal.send({ type:'broadcast', event:'ultra-takeback', payload:{ ply:ultraZetten.length, generation:ultraGeneration } })
    return true
  }
  function bewaarUltraMoment() {
    if (!isUltra) return
    ultraBordMomenten.set(ultraZetten.length, kopieerUltra({
      staat, veroverd, laatsteZet, routeStuk, geselecteerd, mogelijkeZetten,
      gameOver, statusBericht, promotieOpen, pendingNoobMove
    }))
  }
  function verstuurUltraAssistentie() {
    spelKanaal.send({ type:'broadcast', event:'ultra-assistentie-instellingen', payload:{ takeback:instellingen.ultraTakeback === true, hints:instellingen.ultraHints === true } })
  }
  function ontvangUltraTakeback(payload) {
    const verzoek = ultraTakebackPending
    if (!verzoek || ultraDisposed || !spelEl.isConnected) return
    if (payload.ok !== true) {
      if (payload.generation !== verzoek.generation || !Number.isSafeInteger(payload.ply) || payload.ply < verzoek.ply) return
      ultraTakebackPending = null
      ultraAssistanceStatusKey = 'Terugnemen is nu niet beschikbaar.'
      toonUltraAssistentie()
      return
    }
    const moment = ultraBordMomenten.get(payload.ply)
    if (payload.generation !== verzoek.generation + 1 || payload.ply !== verzoek.targetPly || !moment ||
        ultraFenSleutel(payload.fen) !== ultraFenSleutel(schaakFen(moment.staat)) || moment.staat.aanZet !== mijnKleur) return
    generatie++
    ultraGeneration = payload.generation
    // Cancel both the currently drawn motion and any queued old reply.
    bordEl.getAnimations?.({ subtree:true }).forEach(animation => animation.cancel())
    wachtrij = Promise.resolve()
    bezig = false
    wisCheckmateOverlay()
    staat = kopieerUltra(moment.staat)
    veroverd = kopieerUltra(moment.veroverd)
    laatsteZet = kopieerUltra(moment.laatsteZet)
    routeStuk = kopieerUltra(moment.routeStuk)
    geselecteerd = kopieerUltra(moment.geselecteerd)
    mogelijkeZetten = kopieerUltra(moment.mogelijkeZetten)
    gameOver = moment.gameOver
    statusBericht = kopieerUltra(moment.statusBericht)
    promotieOpen = false
    promotieEl.style.display = 'none'
    pendingNoobMove = null
    noobDialog.hidden = true
    opnieuwBtn.style.display = gameOver ? 'block' : 'none'
    ultraZetten.length = payload.ply
    for (const ply of ultraBordMomenten.keys()) if (ply >= payload.ply) ultraBordMomenten.delete(ply)
    ultraHistorie.reset()
    ultraWachtendeEvaluaties.clear()
    ultraEvaluation = null
    ultraAnalyseGeluid?.annuleer()
    ultraTakebackPending = null
    wisUltraHint()
    ultraAssistanceStatusKey = 'Zet teruggenomen.'
    Bordgeluid.kiesSchaakGeluid?.(Schaak, staat, null, mijnKleur)
    if (statusBericht) statusEl.textContent = t(statusBericht.key, statusBericht.values)
    else toonStatus('Jij bent aan zet')
    tekenUltraHistorie()
    tekenBord()
  }
  function ontvangUltraHint(payload) {
    const verzoek = ultraHintPending
    if (!verzoek || ultraDisposed || !spelEl.isConnected) return
    if (payload.ply !== verzoek.ply || payload.generation !== verzoek.generation) return
    const actueel = instellingen.ultraHints === true && payload.ply === verzoek.ply && payload.ply === ultraZetten.length &&
      payload.generation === verzoek.generation && payload.generation === ultraGeneration &&
      ultraFenSleutel(payload.fen) === verzoek.fen && verzoek.fen === ultraFenSleutel(schaakFen(staat)) &&
      staat.aanZet === mijnKleur && !bezig && !promotieOpen && !gameOver && !ultraTakebackPending
    if (!actueel) {
      wisUltraHint()
      tekenBord()
      return
    }
    ultraHintPending = null
    const van = payload.from
    if (payload.ok === false || !Array.isArray(van) || van.length !== 2 || !van.every(n => Number.isInteger(n) && n >= 0 && n < 8) ||
        staat.bord[van[0]]?.[van[1]]?.[0] !== mijnKleur || !Schaak.legaleZetten(staat, ...van).length) {
      ultraHint = null
      ultraAssistanceStatusKey = 'Even geen tip beschikbaar. Probeer het zo nog eens.'
    } else {
      ultraHint = van.slice()
      ultraAssistanceStatusKey = 'Probeer het gemarkeerde stuk te verplaatsen.'
    }
    tekenBord()
  }
  function tekenUltraHistorie() {
    if (!isUltra) return
    const volgLaatste = ultraHistoryScroll.scrollHeight - ultraHistoryScroll.scrollTop - ultraHistoryScroll.clientHeight < 35
    const rijen = []
    for (let i = 0; i < ultraZetten.length; i += 2) {
      rijen.push(`<tr><td>${i / 2 + 1}.</td><td>${esc(ultraZetten[i])}</td><td>${esc(ultraZetten[i + 1] || '')}</td></tr>`)
    }
    ultraHistoryMoves.innerHTML = rijen.join('')
    ultraHistoryEmpty.hidden = ultraZetten.length > 0
    if (volgLaatste) ultraHistoryScroll.scrollTop = ultraHistoryScroll.scrollHeight
  }
  function voegUltraZetToe(zet, promotieStuk) {
    if (!isUltra) return
    // SAN needs the legal position before this exact move changes it.
    ultraZetten.push(schaakNotatie(Schaak, staat, zet, promotieStuk || 'Q'))
    tekenUltraHistorie()
  }
  function resetUltraHistorie() {
    if (!isUltra) return
    ultraZetten.length = 0
    ultraGeneration++
    ultraTakebackPending = null
    ultraBordMomenten.clear()
    wisUltraHint()
    ultraHistorie.reset()
    ultraWachtendeEvaluaties.clear()
    ultraEvaluation = null
    ultraAnalyseGeluid?.annuleer()
    tekenUltraHistorie()
    toonUltraAssistentie()
  }
  function verwerkUltraEvaluatie() {
    const sleutel = ultraZetten.length + '|' + ultraFenSleutel(schaakFen(staat))
    const payload = ultraWachtendeEvaluaties.get(sleutel)
    if (!payload) return
    ultraWachtendeEvaluaties.delete(sleutel)
    const volgende = ultraHistorie.update(payload)
    if (!volgende) return
    ultraEvaluation = volgende
    if (ultraEvaluation?.isNewFinal && ultraEvaluation.ply > 0 && instellingen.ultraEvaluationSound === true && Number.isFinite(ultraEvaluation.deltaCp)) {
      ultraAnalyseGeluid?.speel(ultraEvaluation.deltaCp * (mijnKleur === 'w' ? 1 : -1))
    }
    // Old positions cannot become current again within this game.
    for (const [key, waiting] of ultraWachtendeEvaluaties) if (waiting.ply < ultraZetten.length) ultraWachtendeEvaluaties.delete(key)
  }
  function ultraGetal(cp, precies = false) {
    return (cp > 0 ? '+' : cp < 0 ? '−' : '') + (Math.abs(cp) / 100).toLocaleString(taal.language === 'en' ? 'en-GB' : 'nl-NL', { minimumFractionDigits:1, maximumFractionDigits:precies ? 2 : 1 })
  }
  function toonUltraEvaluatie() {
    if (!isUltra || ultraDisposed) return
    toonUltraAssistentie()
    verwerkUltraEvaluatie()
    const enabled = instellingen.showUltraEvaluation === true
    ultraEvaluationEl.hidden = !enabled
    ultraBoardRow.classList.toggle('sch-with-evaluation', enabled)
    ultraPlyEl.textContent = ultraZetten.length ? t('Zet #{n}', { n:ultraZetten.length }) : t('Start')
    const bronTekst = ultraSource === 'lichess' ? t('Ultra · Lichess') : ultraSource === 'stockfish' ? t('Ultra · Stockfish 19') : t('Ultra · Lichess + Stockfish 19')
    const faseTekst = ultraPhase === 'error' ? t('Niet beschikbaar. Probeer het opnieuw.') : ultraPhase === 'loading' ? t('Laden...') : ultraPhase === 'searching' ? t('Denkt…') : ''
    const statusTekst = bronTekst + (faseTekst ? ' · ' + faseTekst : '')
    if (ultraStatusEl.textContent !== statusTekst) ultraStatusEl.textContent = statusTekst
    ultraStatusEl.dataset.phase = ultraPhase
    ultraRetryBtn.hidden = ultraPhase !== 'error'
    const actueel = enabled && ultraEvaluation && ultraEvaluation.ply === ultraZetten.length && ultraFenSleutel(ultraEvaluation.fen) === ultraFenSleutel(schaakFen(staat))
    ultraEvaluationEl.style.setProperty('--sch-delta-height', '0%')
    ultraEvaluationEl.dataset.magnitude = ''
    ultraEvaluationEl.dataset.direction = ''
    ultraWhiteDelta.textContent = ''
    ultraBlackDelta.textContent = ''
    if (!actueel) {
      ultraEvaluationEl.dataset.pending = 'true'
      ultraEvaluationScore.textContent = '—'
      ultraEvaluationWhite.style.setProperty('--sch-white-share', '50%')
      ultraEvaluationEl.setAttribute('aria-label', t('Geschat voordeel') + ': ' + t('Wachten op evaluatie…'))
      ultraEvaluationEl.title = enabled ? t('Evaluatie wordt bijgewerkt…') : ''
      return
    }
    const { cp, mate, previousWhiteShare, whiteShare, deltaCp, direction, magnitude } = ultraEvaluation
    const richting = mate !== null ? (mate === 0 ? (staat.aanZet === 'w' ? -1 : 1) : Math.sign(mate)) : Math.sign(cp)
    const getal = mate !== null ? '#' + Math.abs(mate) : ultraGetal(cp)
    const voordeel = richting > 0 ? t('Voordeel voor wit') : richting < 0 ? t('Voordeel voor zwart') : t('Gelijk')
    const beschrijving = mate !== null ? t('Mat in {n}', { n:Math.abs(mate) }) : getal
    const witAandeel = whiteShare
    let verandering = ''
    if (Number.isFinite(deltaCp) && Number.isFinite(previousWhiteShare)) {
      const delta = ultraGetal(deltaCp, true), tegenDelta = ultraGetal(-deltaCp, true)
      ultraWhiteDelta.textContent = delta
      ultraBlackDelta.textContent = tegenDelta
      ultraEvaluationEl.style.setProperty('--sch-delta-bottom', `${Math.min(previousWhiteShare, witAandeel)}%`)
      ultraEvaluationEl.style.setProperty('--sch-delta-height', `${Math.abs(witAandeel - previousWhiteShare)}%`)
      ultraEvaluationEl.dataset.magnitude = magnitude || ''
      ultraEvaluationEl.dataset.direction = direction || ''
      verandering = t('Verandering sinds de vorige zet') + ': ' + t('Wit {delta}; zwart {tegenDelta}', { delta, tegenDelta })
      if (magnitude) verandering += ', ' + t(magnitude === 'large' ? 'Grote verandering' : magnitude === 'medium' ? 'Middelgrote verandering' : 'Kleine verandering')
      ultraWhiteDelta.setAttribute('aria-label', verandering)
      ultraBlackDelta.setAttribute('aria-label', verandering)
    }
    ultraEvaluationEl.dataset.pending = 'false'
    ultraEvaluationScore.textContent = (richting > 0 ? '↑' : richting < 0 ? '↓' : '') + getal
    ultraEvaluationWhite.style.setProperty('--sch-white-share', `${witAandeel}%`)
    ultraEvaluationEl.setAttribute('aria-label', t('Geschat voordeel') + ': ' + voordeel + ', ' + beschrijving + (verandering ? '. ' + verandering : ''))
    ultraEvaluationEl.title = voordeel + ' · ' + beschrijving + (verandering ? ' · ' + verandering : '')
  }
  if (isUltra) {
    ultraRetryBtn.addEventListener('click', () => {
      if (ultraDisposed || ultraPhase !== 'error') return
      ultraPhase = 'loading'
      ultraEvaluation = null
      toonUltraEvaluatie()
      spelKanaal.send({ type:'broadcast', event:'ultra-opnieuw-proberen', payload:{} })
    })
    ultraEvaluationToggle.checked = instellingen.showUltraEvaluation
    ultraEvaluationToggle.addEventListener('change', () => {
      instellingen.showUltraEvaluation = ultraEvaluationToggle.checked === true
      bewaarInstellingen()
      toonUltraEvaluatie()
      spelKanaal.send({ type:'broadcast', event:'ultra-evaluatie-instelling', payload:{ enabled:ultraAnalyseAan() } })
    })
    ultraSoundToggle.checked = instellingen.ultraEvaluationSound
    ultraSoundToggle.addEventListener('change', () => {
      instellingen.ultraEvaluationSound = ultraSoundToggle.checked === true
      if (!instellingen.ultraEvaluationSound) ultraAnalyseGeluid?.annuleer()
      bewaarInstellingen()
      toonUltraEvaluatie()
      spelKanaal.send({ type:'broadcast', event:'ultra-evaluatie-instelling', payload:{ enabled:ultraAnalyseAan() } })
    })
    spelKanaal.on('broadcast', { event:'ultra-status' }, msg => {
      if (ultraDisposed || !spelEl.isConnected) return
      const payload = msg.payload || {}
      if (!ultraGeldigeGeneratie(payload)) return
      if (['loading','ready','searching','error'].includes(payload.phase)) ultraPhase = payload.phase
      if (['lichess','stockfish'].includes(payload.source)) ultraSource = payload.source
      if (payload.phase === 'error') ultraEvaluation = null
      toonUltraEvaluatie()
    })
    spelKanaal.on('broadcast', { event:'ultra-evaluatie' }, msg => {
      if (ultraDisposed || !spelEl.isConnected || !ultraAnalyseAan()) return
      const payload = msg.payload || {}
      if (!ultraGeldigeGeneratie(payload)) return
      const cp = typeof payload.cp === 'number' && Number.isFinite(payload.cp) ? payload.cp : null
      const mate = Number.isSafeInteger(payload.mate) ? payload.mate : null
      const fen = ultraFenSleutel(payload.fen)
      const ply = payload.ply
      if ((!Number.isFinite(cp) && mate === null) || fen.split(' ').length !== 4 || !Number.isSafeInteger(ply) || ply < ultraZetten.length) return
      const sleutel = ply + '|' + fen
      const vorige = ultraWachtendeEvaluaties.get(sleutel)
      if (!vorige?.final || payload.final === true) ultraWachtendeEvaluaties.set(sleutel, { ...payload, cp, mate, ply, final:payload.final === true })
      toonUltraEvaluatie()
    })
    ultraTakebackToggle.checked = instellingen.ultraTakeback
    ultraTakebackToggle.addEventListener('change', () => {
      instellingen.ultraTakeback = ultraTakebackToggle.checked === true
      bewaarInstellingen()
      toonUltraAssistentie()
      verstuurUltraAssistentie()
    })
    ultraHintsToggle.checked = instellingen.ultraHints
    ultraHintsToggle.addEventListener('change', () => {
      instellingen.ultraHints = ultraHintsToggle.checked === true
      wisUltraHint()
      bewaarInstellingen()
      tekenBord()
      verstuurUltraAssistentie()
    })
    ultraTakebackBtn.addEventListener('click', neemUltraZetTerug)
    ultraHintBtn.addEventListener('click', () => {
      if (spinPerspectiveActive || ultraHintBtn.hidden || ultraHintBtn.disabled || instellingen.ultraHints !== true) return
      ultraHint = null
      ultraHintPending = { ply:ultraZetten.length, fen:ultraFenSleutel(schaakFen(staat)), generation:ultraGeneration }
      ultraAssistanceStatusKey = 'Een tip zoeken…'
      toonUltraAssistentie()
      spelKanaal.send({ type:'broadcast', event:'ultra-hint', payload:{ ply:ultraZetten.length, generation:ultraGeneration } })
    })
    spelKanaal.on('broadcast', { event:'ultra-takeback-result' }, msg => ontvangUltraTakeback(msg.payload || {}))
    spelKanaal.on('broadcast', { event:'ultra-hint-result' }, msg => ontvangUltraHint(msg.payload || {}))
    ultraSwipe = maakUltraSwipe({
      element:ultraSwipeEl,
      canUndo:() => kanUltraTerugnemen() && menu.hidden,
      onUndo:neemUltraZetTerug,
      onChange:state => { ultraSwipeState = state; toonUltraVeeg() },
    })
    toonUltraEvaluatie()
    // Register listeners before opting in: a cached result can arrive immediately.
    spelKanaal.send({ type:'broadcast', event:'ultra-evaluatie-instelling', payload:{ enabled:ultraAnalyseAan() } })
    verstuurUltraAssistentie()
    opruimers.push(() => {
      ultraDisposed = true
      ultraSwipe?.destroy()
      ultraEvaluation = null
      ultraWachtendeEvaluaties.clear()
      ultraAnalyseGeluid?.destroy()
      try { spelKanaal.send({ type:'broadcast', event:'ultra-evaluatie-instelling', payload:{ enabled:false } }) } catch {}
    })
  }
  if (spelKanaal.isSolo) spelKanaal.send({ type:'broadcast', event:'bot-instellingen', payload:{ thinkingMs:instellingen[thinkingKey] * 1000 } })
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
  compactBtn.addEventListener('click', () => { ultraFocus?.setStage(0); vergroot(false) })
  settingsBtn.addEventListener('click', () => toonMenu(menu.hidden))
  menuClose.addEventListener('click', () => { toonMenu(false); settingsBtn.focus() })
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
  const ultraFocus = isUltra ? maakUltraFocus({
    root:spelEl, board:bordEl, host:document.getElementById('spelOverlay') || spelEl,
    restoreButton:inhoud.querySelector('#sch-focus-restore'),
  }) : null
  if (ultraFocus) opruimers.push(() => ultraFocus.destroy())
  paardRoutesUI = !isVriendPartij ? maakPaardRoutesUI({
    Schaak, board:bordEl, root:spelEl, menu,
    legend:inhoud.querySelector('#sch-knight-route-legend'),
    getState:() => staat, getRevision:() => generatie, playerColor:mijnKleur,
    getSteps:() => instellingen.knightRouteSteps.slice(),
    saveSteps:steps => { instellingen.knightRouteSteps = steps.slice(); bewaarInstellingen() },
    canInspect:() => !spinPerspectiveActive && staat.aanZet === mijnKleur && !bezig && !promotieOpen && !gameOver && !ultraTakebackPending && noobDialog.hidden,
    t,
    onInspect:candidate => {
      if (candidate) {
        if (isUltra) wisUltraHint()
        geselecteerd = candidate.color === mijnKleur ? [candidate.r,candidate.k] : null
        mogelijkeZetten = geselecteerd ? Schaak.legaleZetten(staat,candidate.r,candidate.k) : []
      }
      tekenBord()
    },
  }) : null
  if (paardRoutesUI) opruimers.push(() => paardRoutesUI.destroy())
  const vingers = new Map()
  let afstand = 0, negeerKlikTot = 0
  const meetAfstand = () => {
    const [a,b] = [...vingers.values()]
    return Math.hypot(a.x-b.x, a.y-b.y)
  }
  bordEl.addEventListener('pointerdown', e => {
    if (ultraFocus?.active) return
    if (e.pointerType === 'mouse') return
    vingers.set(e.pointerId, { x:e.clientX, y:e.clientY })
    e.target.setPointerCapture(e.pointerId)
    if (vingers.size === 2) { afstand = meetAfstand(); negeerKlikTot = Infinity }
  })
  bordEl.addEventListener('pointermove', e => {
    if (ultraFocus?.active) return
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

  // v265: vonkjes die uit het midden van een vakje spatten en een rode schokgolf (schaakmat)
  function vonken(vak, aantal = 10, vertraging = 0) {
    const r = vak.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2
    const klaar = []
    for (let i = 0; i < aantal; i++) {
      const v = document.createElement('div')
      v.className = 'sch-vonk'
      v.style.left = cx + 'px'; v.style.top = cy + 'px'
      document.body.appendChild(v)
      const hoek = (i / aantal) * Math.PI * 2 + Math.random() * 0.5, afstand = r.width * (0.55 + Math.random() * 0.55)
      const a = v.animate([
        { transform:'translate(0,0) scale(1)', opacity:1 },
        { transform:`translate(${Math.cos(hoek) * afstand}px,${Math.sin(hoek) * afstand}px) scale(.2)`, opacity:0 }
      ], { duration:520 + Math.random() * 200, delay:vertraging, easing:'cubic-bezier(.2,.7,.3,1)', fill:'both' })
      klaar.push(a.finished.catch(() => {}).finally(() => v.remove()))
    }
    return Promise.all(klaar)
  }
  function schokgolf(vak) {
    const r = vak.getBoundingClientRect(), g = document.createElement('div')
    g.className = 'sch-schokgolf'
    g.style.left = r.x + 'px'; g.style.top = r.y + 'px'; g.style.width = r.width + 'px'; g.style.height = r.height + 'px'
    document.body.appendChild(g)
    g.animate([{ transform:'scale(.4)', opacity:1 }, { transform:'scale(4.2)', opacity:0 }], { duration:900, easing:'cubic-bezier(.15,.6,.3,1)' })
      .finished.catch(() => {}).finally(() => g.remove())
  }
  // Schaakmat: de koning schudt, valt om en kleurt rood; daarna pas het woord SCHAAKMAT
  function animeerSchaakmat(kleur) {
    const vak = bordEl.querySelector('.sch-koning-mat')
    const stuk = vak?.querySelector('.sch-stuk')
    if (!stuk?.animate || minderBeweging.matches) return 0
    stuk.animate([
      { transform:'rotate(0) translate(0,0) scale(1)', filter:'none', offset:0 },
      { transform:'rotate(-9deg) scale(1.08)', offset:.12 },
      { transform:'rotate(9deg) scale(1.08)', offset:.24 },
      { transform:'rotate(-7deg) scale(1.08)', offset:.36 },
      { transform:'rotate(5deg) scale(1.05)', offset:.48 },
      { transform:'rotate(-14deg) translate(0,-8%) scale(1.04)', offset:.6 },
      { transform:'rotate(98deg) translate(16%,-6%) scale(.92)', offset:.88 },
      { transform:'rotate(90deg) translate(14%,-6%) scale(.92)', offset:1 }
    ], { duration:1300, easing:'ease-in-out' })
    setTimeout(() => { if (vak.isConnected) { schokgolf(vak); vonken(vak, 16) } }, 1130)
    return 1250
  }

  // v265: wie een stuk kwijtraakt, krijgt (net als bij dammen) even een rode rand om zijn webcamrondje (chat.html)
  function meldGeslagen(effect) {
    if (!effect || !isVriendPartij) return
    try { window.dispatchEvent(new CustomEvent('fibro-spel-geslagen', { detail:{ wie:effect.outcome === 'loss' ? 'ik' : 'vriend', aantal:1 } })) } catch (e) {}
  }

  async function animeerZet(zet) {
    bezig = true
    if (isUltra) {
      wisUltraHint()
      bordEl.querySelectorAll('.sch-hint-piece').forEach(vakje => vakje.classList.remove('sch-hint-piece'))
      toonUltraAssistentie()
    }
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
    } catch (error) {
      if (ronde !== generatie || error?.name === 'AbortError') return false
      throw error
    } finally {
      if (ronde === generatie) {
        bezig = false
        toonUltraAssistentie()
      }
    }
  }

  function rijVolgorde() { return omgedraaid !== spinPerspectiveActive ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7] }
  function kolVolgorde() { return omgedraaid !== spinPerspectiveActive ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7] }

  function tekenBord() {
    const matKleur = gameOver && Schaak.isSchaakmat(staat, staat.aanZet) ? staat.aanZet : null // v265: de koning ligt
    toonUltraEvaluatie()
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
        if (isUltra && instellingen.ultraHints && ultraHint?.[0] === r && ultraHint?.[1] === k && staat.aanZet === mijnKleur) vakje.classList.add('sch-hint-piece')
        const bedreigd = bedreigdeVelden.has(`${r},${k}`)
        if (bedreigd) {
          vakje.classList.add('sch-threat')
          if (!isVriendPartij && instellingen.exaggerate) vakje.classList.add('sch-threat-exaggerated')
        }
        vakje.style.background = `linear-gradient(145deg,#ffffff18,#00000018),${achtergrond}`
        const stukNaam = staat.bord[r][k] ? `${t(staat.bord[r][k][0] === 'w' ? 'witte' : 'zwarte')} ${t(READABLE_NAMES[staat.bord[r][k][1]])}` : t('leeg')
        vakje.setAttribute('aria-label', `${String.fromCharCode(97+k)}${8-r}, ${stukNaam}${bedreigd ? ', ' + t('kan worden geslagen door {stuk}', { stuk:kleurBijStuk(route) + ' ' + t(READABLE_NAMES[route[1]]) }) : ''}`)
        vakje.setAttribute('aria-pressed', String(Boolean(isGeselecteerd)))
        vakje.dataset.r = r
        vakje.dataset.k = k

        const stuk = staat.bord[r][k]
        if (stuk && matKleur && stuk === matKleur + 'K') vakje.classList.add('sch-koning-mat')
        if (stuk) {
          const figuur = document.createElement('span')
          figuur.className = 'sch-stuk'
          figuur.innerHTML = stukSVG(stuk)
          vakje.append(figuur)
        }

        if (isMogelijkeZet && !paardRoutesUI?.active) {
          const stip = document.createElement('div')
          const heeftStuk = !!staat.bord[r][k]
          stip.className = heeftStuk ? 'sch-legal-capture' : 'sch-legal-dot'
          vakje.appendChild(stip)
        }

        bordEl.appendChild(vakje)
      }
    }
    paardRoutesUI?.refresh()
  }

  // Event delegation — één listener op het bord, nooit per-vakje (voorkomt iOS re-render bug)
  bordEl.addEventListener('click', (e) => {
    if (paardRoutesUI?.shouldIgnoreClick()) return
    if (performance.now() < negeerKlikTot) return
    const vakje = e.target.closest('[data-r]')
    if (!vakje) return
    vakjeKlik(parseInt(vakje.dataset.r), parseInt(vakje.dataset.k))
  })

  function vakjeKlik(r, k) {
    if (spinPerspectiveActive || bezig || promotieOpen || (isUltra && ultraTakebackPending) || !noobDialog.hidden || gameOver || staat.aanZet !== mijnKleur) return
    paardRoutesUI?.clear()

    // Als er al een stuk geselecteerd is en dit is een geldige zet
    if (geselecteerd) {
      const zet = mogelijkeZetten.find(z => z.naar[0] === r && z.naar[1] === k)
      if (zet) {
        uitvoerenZet(zet)
        return
      }
      const doel = staat.bord[r][k]
      if (!isVriendPartij && instellingen.noobMode && (!doel || doel[0] !== mijnKleur)) {
        toonStatus('Beginnersmodus: alleen geldige zetten zijn toegestaan. Je koning kan daardoor nooit schaak blijven staan.')
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
      return { stuk:stuk[1], veld:`${String.fromCharCode(97+k)}${8-r}` }
    })
  }

  noobCancel.addEventListener('click', () => {
    pendingNoobMove = null
    noobDialog.hidden = true
    geselecteerd = null
    mogelijkeZetten = []
    toonStatus('Zet geannuleerd. Kies een veiligere zet.')
    tekenBord()
  })
  noobContinue.addEventListener('click', () => {
    const pending = pendingNoobMove
    pendingNoobMove = null
    noobDialog.hidden = true
    if (pending) uitvoerenZet(pending.zet, pending.promotieStuk, true)
  })

  async function uitvoerenZet(zet, promotieStuk, noobConfirmed = false) {
    if (isUltra && ultraTakebackPending) return
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
        pendingNoobMove = { zet, promotieStuk, bedreigingen }
        toonNoobBericht()
        noobDialog.hidden = false
        noobCancel.focus()
        return
      }
    }

    if (!await animeerZet(zet)) return
    const slagEffect = schaakSlagEffect(staat, zet, mijnKleur)
    meldGeslagen(slagEffect)
    bewaarUltraMoment()
    registreerSlag(staat, zet, veroverd)
    voegUltraZetToe(zet, promotieStuk)
    Schaak.voerZetUit(staat, zet, promotieStuk)
    routeStuk = zet.naar.slice()
    laatsteZet = zet
    geselecteerd = null
    mogelijkeZetten = []

    verstuurZet(zet, promotieStuk)
    naBeurtControle(slagEffect)
  }

  function toonNoobBericht() {
    const bedreigingen = pendingNoobMove?.bedreigingen || []
    noobMessage.textContent = t('Na deze zet kan je tegenstander je {stukken}{meer} slaan. Wil je toch doorgaan?', {
      stukken:bedreigingen.slice(0,3).map(item => t('{stuk} op {veld}', { stuk:t(READABLE_NAMES[item.stuk]), veld:item.veld })).join(', '),
      meer:bedreigingen.length > 3 ? t(' en nog {n} andere stukken', { n:bedreigingen.length - 3 }) : ''
    })
  }
  function toonPromotieKeuze(zet) {
    const kleur = mijnKleur
    promotieOpen = true
    toonUltraAssistentie()
    promotieEl.style.display = 'flex'
    promotieEl.innerHTML = ['Q','R','B','N'].map(t =>
      `<button class="sch-promo-btn ${kleur === 'w' ? 'sch-wit' : 'sch-zwart'}" data-piece="${t}" aria-label="${esc(taal.t('Promoveer tot {stuk}', { stuk:taal.t(READABLE_NAMES[t]) }))}" style="font-size:28px;background:#b6a18a;border:1px solid var(--accent);border-radius:8px;padding:6px 10px;cursor:pointer;">${stukSVG(kleur+t)}</button>`
    ).join('')
    promotieEl.querySelectorAll('.sch-promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        promotieOpen = false
        promotieEl.style.display = 'none'
        uitvoerenZet(zet, btn.dataset.piece)
      })
    })
  }

  function naBeurtControle(slagEffect = null) {
    const volgendeKleur = staat.aanZet; Bordgeluid.schaak(Schaak, staat, laatsteZet, mijnKleur, instellingen.soundTheme, instellingen[isUltra ? 'ultraGradedCaptureSounds' : 'gradedCaptureSounds'] ? slagEffect : null)
    let mat = false
    if (Schaak.isSchaakmat(staat, volgendeKleur)) {
      gameOver = true
      mat = true
      statusBericht = null
      statusEl.textContent = ''
      opnieuwBtn.style.display = 'block'
    } else if (Schaak.isPat(staat, volgendeKleur)) {
      gameOver = true
      toonStatus('🤝 Pat — remise!')
      opnieuwBtn.style.display = 'block'
    } else if (Schaak.staatInSchaak(staat, volgendeKleur)) {
      toonStatus(volgendeKleur === mijnKleur ? 'Je staat schaak — jij bent aan zet' : '{naam} staat schaak — even wachten…', { naam:tegenstanderNaam() })
    } else {
      toonStatus(volgendeKleur === mijnKleur ? 'Jij bent aan zet' : 'Wachten op {naam}…', { naam:tegenstanderNaam() })
    }
    tekenBord()
    if (mat) { // v265: eerst valt de koning om, dan SCHAAKMAT
      const wacht = animeerSchaakmat(volgendeKleur)
      checkmateTimers.forEach(clearTimeout)
      if (wacht) checkmateTimers = [setTimeout(toonCheckmateOverlay, wacht)]
      else toonCheckmateOverlay()
    }
  }

  function verstuurZet(zet, promotieStuk) {
    spelKanaal.send({ type: 'broadcast', event: 'zet', payload: { zet, promotieStuk, ...(isUltra ? { ultraPly:ultraZetten.length - 1, ultraGeneration } : {}) } })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, (msg) => {
    const ronde = generatie
    wachtrij = wachtrij.then(async () => {
      if (ronde !== generatie || !bordEl.isConnected || gameOver) return
      const { zet, promotieStuk, ultraPly, ultraGeneration:replyGeneration } = msg.payload || {}
      if (isUltra && ((replyGeneration !== undefined && replyGeneration !== ultraGeneration) || (ultraPly !== undefined && ultraPly !== ultraZetten.length + 1))) return
      if (!zet || staat.aanZet !== vriendKleur) return
      const geldig = Schaak.alleLegaleZetten(staat, vriendKleur).find(z =>
        z.van[0] === zet.van?.[0] && z.van[1] === zet.van?.[1] &&
        z.naar[0] === zet.naar?.[0] && z.naar[1] === zet.naar?.[1] && z.type === zet.type)
      if (!geldig || !await animeerZet(geldig)) return
      if (isUltra && replyGeneration !== undefined && replyGeneration !== ultraGeneration) return
      const slagEffect = schaakSlagEffect(staat, geldig, mijnKleur)
      meldGeslagen(slagEffect)
      bewaarUltraMoment()
      registreerSlag(staat, geldig, veroverd)
      const promotie = ['Q','R','B','N'].includes(promotieStuk) ? promotieStuk : 'Q'
      voegUltraZetToe(geldig, promotie)
      Schaak.voerZetUit(staat, geldig, promotie)
      routeStuk = geldig.naar.slice()
      laatsteZet = geldig
      geselecteerd = null
      mogelijkeZetten = []
      naBeurtControle(slagEffect)
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
    resetUltraHistorie()
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
    resetUltraHistorie()
    geselecteerd = null
    mogelijkeZetten = []
    laatsteZet = null
    gameOver = false
    opnieuwBtn.style.display = 'none'
    spelKanaal.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
    naBeurtControle()
  })

  toonStatus(mijnKleur === 'w' ? 'Jij bent aan zet (wit begint)' : 'Wachten op {naam} (wit begint)…', { naam:tegenstanderNaam() })
  function vertaalSpel() {
    taal.translate(spelEl)
    document.getElementById('spelTitelBar').textContent = '♟️ ' + t('Schaken')
    languageSelect.value = taal.language
    geluidBtn?.setLanguage?.(taal.language)
    toonDenktijd()
    toonSchaakWallpaper()
    toonUltraEvaluatie()
    toonUltraVeeg()
    paardRoutesUI?.refresh()
    inhoud.querySelector('.sch-legenda').textContent = t('Pion 1 · Paard 3 · Loper 3 · Toren 5 · Dame 9')
    if (statusBericht) statusEl.textContent = t(statusBericht.key, statusBericht.values?.naam !== undefined ? { ...statusBericht.values, naam:tegenstanderNaam() } : statusBericht.values)
    if (pendingNoobMove) toonNoobBericht()
    promotieEl.querySelectorAll('.sch-promo-btn').forEach(btn => btn.setAttribute('aria-label', t('Promoveer tot {stuk}', { stuk:t(READABLE_NAMES[btn.dataset.piece]) })))
    if (videoBtn) {
      const eigen = videoBtn.getAttribute('aria-pressed') === 'true'
      videoBtn.title = eigen ? t('Webcam uitzetten') : ''
      videoBtn.setAttribute('aria-label', t(eigen ? 'Webcam uitzetten' : 'Webcam aanzetten'))
      if (videoBtn.classList.contains('is-connecting')) videoBtn.textContent = '📹 ' + t('Verbinden…')
    }
    // Existing square nodes and focus stay intact; only their accessible descriptions change.
    bordEl.querySelectorAll('[data-r]').forEach(vakje => {
      const r = Number(vakje.dataset.r), k = Number(vakje.dataset.k), stuk = staat.bord[r][k]
      const naam = stuk ? `${kleurBijStuk(stuk)} ${t(READABLE_NAMES[stuk[1]])}` : t('leeg')
      const route = routeStuk && staat.bord[routeStuk[0]]?.[routeStuk[1]]
      const bedreigd = vakje.classList.contains('sch-threat') && route
      vakje.setAttribute('aria-label', `${String.fromCharCode(97+k)}${8-r}, ${naam}${bedreigd ? ', ' + t('kan worden geslagen door {stuk}', { stuk:kleurBijStuk(route) + ' ' + t(READABLE_NAMES[route[1]]) }) : ''}`)
    })
    tekenVeroverd()
  }
  tekenBord()
  vertaalSpel()
  const stopTaal = taal.subscribe(vertaalSpel)
  const lifecycle = new MutationObserver(() => {
    if (spelEl.isConnected) return
    stopTaal(); taal.destroy(); lifecycle.disconnect()
    opruimers.forEach(opruimen => opruimen())
    window.removeEventListener('blur', eindigLangeDruk)
    clearTimeout(voortgangTimer); clearTimeout(menuTimer)
    checkmateTimers.forEach(clearTimeout)
  })
  lifecycle.observe(inhoud, { childList:true })
  if (new URLSearchParams(location.search).has('settings')) toonMenu(true)
}
