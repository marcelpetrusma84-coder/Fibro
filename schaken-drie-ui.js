import {
  applyThreePlayerMove,
  legalThreePlayerMoves,
  newThreePlayerGame,
  threePlayerCellPolygon,
  THREE_PLAYER_OUTLINE,
  THREE_PLAYER_NAMES
} from './schaak-drie.js?v=10'
import { THREE_PLAYER_VIEWBOX, THREE_PLAYER_BOARD_ARTWORK, threePlayerPieceArtwork } from './schaak-drie-artwork.js?v=3'
import { maakSchaakTaal, schaakT } from './schaak-taal.js?v=3'

const COLOR_STYLES = ['#fff', '#c4c7ce', '#ff7777']
const LABELS = { K:'Koning', Q:'Dame', R:'Toren', B:'Loper', N:'Paard', P:'Pion' }
const COLORS = ['Wit', 'Zwart', 'Rood']
// v22: gebruikersnamen komen van andere spelers. Overal waar een naam in innerHTML/SVG belandt, eerst veilig maken,
// anders kan een naam als <img src=x onerror=...> code uitvoeren bij de anderen.
const veilig = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const TURN_LIGHT_COLORS = ['#fff0bd', '#9bdcff', '#ffa4a8']

function pieceLighting(player) {
  // Shadows point away from the active home edge, towards the board's centre.
  const [dx, dy] = [[0,-6], [5.2,3], [-5.2,3]][player] || [0,2]
  const rim = player === null ? '' : `<feDropShadow dx="${-dx / 6}" dy="${-dy / 6}" stdDeviation=".2" flood-color="${TURN_LIGHT_COLORS[player]}" flood-opacity=".35"/>`
  return `<defs><filter id="chess3-piece-light" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">
    ${rim}<feDropShadow dx="${dx}" dy="${dy}" stdDeviation="1.2" flood-color="#0a1020" flood-opacity=".44"/>
  </filter></defs>`
}

function turnSpotlight(player) {
  const edges = [[4,5], [3,2], [1,0]]
  const colors = TURN_LIGHT_COLORS
  const [start, end] = edges[player].map(index => THREE_PLAYER_OUTLINE[index])
  const midpoint = start.map((value, index) => (value + end[index]) / 2)
  const inward = point => point.map(value => value * .76)
  const band = [start, end, inward(end), inward(start)].map(point => point.join(',')).join(' ')
  const path = `M ${start.join(' ')} L ${end.join(' ')}`
  return `<g class="chess3-turn-spotlight" data-player="${player}" aria-hidden="true" pointer-events="none">
    <defs>
      <linearGradient id="chess3-turn-wash" gradientUnits="userSpaceOnUse" x1="${midpoint[0]}" y1="${midpoint[1]}" x2="${inward(midpoint)[0]}" y2="${inward(midpoint)[1]}">
        <stop stop-color="${colors[player]}" stop-opacity=".24"/>
        <stop offset="1" stop-color="${colors[player]}" stop-opacity="0"/>
      </linearGradient>
      <filter id="chess3-turn-glow" filterUnits="userSpaceOnUse" x="-500" y="-450" width="1000" height="900"><feGaussianBlur stdDeviation="10"/></filter>
    </defs>
    <polygon points="${band}" fill="url(#chess3-turn-wash)"/>
    <path d="${path}" fill="none" stroke="${colors[player]}" stroke-width="22" stroke-linecap="round" opacity=".72" filter="url(#chess3-turn-glow)"/>
    <path d="${path}" fill="none" stroke="${colors[player]}" stroke-width="6" stroke-linecap="round" opacity=".95"/>
    <path d="${path}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>
  </g>`
}

// A capture between the other two players is neutral for this listener.
export function drieSlagEffect(captured, mover, viewer) {
  if (!captured || ![0,1,2].includes(mover) || ![0,1,2].includes(viewer) || captured.player === mover) return null
  const value = {P:1,N:3,B:3,R:5,Q:9,K:9}[captured.type]
  if (!value || (captured.player !== viewer && mover !== viewer)) return null
  return { value, outcome:captured.player === viewer ? 'loss' : 'win' }
}

export function start({ Bordgeluid = null, gameChannel = null, players = [], userId = null, localPreview = false, inviteThird = null, testMode = false, testStream = null, onTestCameraChange = null, onReturnToTwoPlayer = null } = {}) {
  const root = document.getElementById('spelInhoud')
  if (!root) throw new Error(schaakT('Het schaakscherm ontbreekt.'))
  if (players.length !== 3) throw new TypeError(schaakT('Er zijn drie spelers nodig.'))
  const roster = players.map((player, index) => typeof player === 'string'
    ? { id:player, username:THREE_PLAYER_NAMES[index], defaultName:true }
    : { id:String(player.id), username:String(player.username || THREE_PLAYER_NAMES[index]), defaultName:!player.username })
  const myPlayer = roster.findIndex(player => player.id === userId)
  if (!localPreview && myPlayer < 0) throw new TypeError(schaakT('Je account staat niet in deze schaakpartij.'))
  const previousLanguage = root.getAttribute?.('lang') ?? null
  const titleSurface = document.getElementById('spelTitelBar')
  const previousTitleLanguage = titleSurface?.getAttribute?.('lang') ?? null
  const taal = maakSchaakTaal()
  const t = (key, values) => taal.t(key, values)
  const tekst = key => `<span data-sch-text="${veilig(key)}">${veilig(t(key))}</span>`
  const staticText = (node, key) => { node.setAttribute('data-sch-text', key); node.textContent = t(key); return node }
  const playerName = index => {
    const player = roster[index]
    if (testMode && ['fibro-test-you','fibro-test-black','fibro-test-red'].includes(player.id)) return t(['Jij · Test','Testspeler · Zwart','Testspeler · Rood'][index])
    return player.defaultName ? t(COLORS[index]) : player.username
  }
  root.classList.add('chess3-layout')
  document.getElementById('spelOverlay')?.classList.add('chess3-board-layout')
  let state = newThreePlayerGame()
  let selected = null
  let highlighted = []
  let destroyed = false
  let localStream = null
  let statusMessage = null
  const say = (key, values = {}) => { statusMessage = { key, values }; status.textContent = t(key, values) }
  const setCameraButton = (button, key) => { button.dataset.chessCameraText = key; button.textContent = t(key) }
  const setCameraWait = (item, key, values = {}) => { item.waitMessage = { key, values }; item.wait.textContent = key ? t(key, values) : '' }
  let iceServers = { iceServers:[] }
  const peers = new Map()
  const pendingIce = new Map()
  const status = document.createElement('div')
  status.className = 'chess3-status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  const cameraRow = document.createElement('div')
  cameraRow.className = 'chess3-cameras'
  cameraRow.hidden = localPreview && !testMode
  const controls = document.createElement('div')
  controls.className = 'chess3-controls'
  const helpActions = document.createElement('div')
  helpActions.className = 'chess3-help-actions'
  const boardWrap = document.createElement('div')
  boardWrap.className = 'chess3-frame'
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.classList.add('chess3-board')
  svg.setAttribute('role', 'grid')
  svg.setAttribute('data-sch-label', 'Schaakbord voor drie spelers, 96 velden')
  svg.setAttribute('aria-label', t('Schaakbord voor drie spelers, 96 velden'))
  svg.setAttribute('viewBox', THREE_PLAYER_VIEWBOX)
  boardWrap.append(svg)
  const captureBar = document.createElement('div')
  captureBar.className = 'chess3-capturebar'
  const heading = document.createElement('header')
  heading.className = 'chess3-heading'
  heading.innerHTML = `<span class="chess3-kicker">${tekst('FIBRO · DRIE SPELERS')}</span><h2>${tekst('Schaken met drie spelers')}</h2><p>${tekst('Sla een koning om die speler uit te schakelen. De laatste koning wint. Als een derde speler aansluit tijdens een partij, begint iedereen opnieuw vanuit deze beginstelling.')}</p>`
  controls.innerHTML = `<span class="chess3-turns" data-sch-label="Beurtvolgorde" aria-label="${veilig(t('Beurtvolgorde'))}"><b>${tekst('Wit')}</b><i>→</i><b>${tekst('Zwart')}</b><i>→</i><b>${tekst('Rood')}</b></span>`
  if (testMode) {
    const resetButton = document.createElement('button')
    resetButton.type = 'button'; resetButton.className = 'chess3-reset'; staticText(resetButton, '↻ Bord met 96 velden opnieuw beginnen')
    controls.append(resetButton)
    if (onReturnToTwoPlayer) {
      const backButton = document.createElement('button')
      backButton.type = 'button'; backButton.className = 'chess3-return'; staticText(backButton, '← Terug naar test met 2 spelers')
      backButton.addEventListener('click', () => onReturnToTwoPlayer())
      helpActions.append(backButton)
    }
  } else if (localPreview && inviteThird) {
    const inviteButton = document.createElement('button')
    inviteButton.type = 'button'; inviteButton.className = 'chess3-invite'; staticText(inviteButton, 'Een derde speler uitnodigen')
    inviteButton.addEventListener('click', () => inviteThird())
    controls.append(inviteButton)
  }
  const rulesButton = document.createElement('button')
  rulesButton.type = 'button'
  rulesButton.className = 'chess3-rules-button'
  staticText(rulesButton, 'ⓘ Spelregels')
  rulesButton.setAttribute('data-sch-title', 'Zo speel je schaken met drie spelers')
  rulesButton.title = t('Zo speel je schaken met drie spelers')
  rulesButton.setAttribute('aria-haspopup', 'dialog')
  rulesButton.setAttribute('aria-controls', 'chess3-rules')
  helpActions.append(rulesButton)
  controls.append(helpActions)

  const rulesDialog = document.createElement('dialog')
  rulesDialog.id = 'chess3-rules'
  rulesDialog.className = 'chess3-rules'
  rulesDialog.setAttribute('aria-labelledby', 'chess3-rules-title')
  rulesDialog.innerHTML = `
    <header class="chess3-rules-header">
      <div><span class="chess3-kicker">${tekst('FIBRO · SPELUITLEG')}</span><h2 id="chess3-rules-title">${tekst('Drie spelers. De laatste koning wint.')}</h2></div>
      <button class="chess3-rules-close" type="button" data-sch-label="Spelregels sluiten" aria-label="${veilig(t('Spelregels sluiten'))}">✕</button>
    </header>
    <div class="chess3-rules-content">
      <p class="chess3-rules-lead">${tekst('Drie legers, 96 velden. Elke kleur begint met 16 stukken. Er is geen wereldwijd uniform reglement voor schaken met drie spelers; Fibro gebruikt de variant waarin je koningen slaat en de laatste koning wint.')}</p>
      <section class="chess3-rules-goal"><h3>${tekst('Het doel')}</h3><p><strong>${tekst('Houd je koning in leven.')}</strong> ${tekst('Sla de koning van een tegenstander om die speler uit te schakelen. De laatste speler met een koning wint.')}</p></section>
      <section><h3>${tekst('1 · Speel om de beurt')}</h3><p class="chess3-rules-order"><b>${tekst('Wit')}</b><span>→</span><b>${tekst('Zwart')}</b><span>→</span><b>${tekst('Rood')}</b><span>${tekst('→ opnieuw')}</span></p><p>${tekst('Doe één zet, daarna is de volgende kleur aan de beurt. De beurtmelding laat zien wie er mag zetten.')}</p></section>
      <section><h3>${tekst('2 · Kies een stuk en daarna een gemarkeerd veld')}</h3><p>${tekst('Kies een stuk van de kleur die aan de beurt is. Het bord toont waar dat stuk naartoe kan:')}</p><ul><li><strong>${tekst('Groene rand:')}</strong> ${tekst('een mogelijke zet.')}</li><li><strong>${tekst('Rode rand:')}</strong> ${tekst('een stuk van een tegenstander slaan.')}</li></ul><p>${tekst('Klik op een gemarkeerd doelveld om te zetten. Klik op een ander eigen stuk om je keuze te veranderen. Je kunt beide tegenstanders aanvallen.')}</p></section>
      <section><h3>${tekst('3 · Volg de banen op het bord')}</h3><p>${tekst('Het bord bestaat uit drie verbonden gebieden van elk 32 velden. Rechte en diagonale banen kunnen via het midden naar een ander gebied lopen. Een baan kan daar vertakken; gebruik de gemarkeerde velden als leidraad.')}</p>
        <dl class="chess3-rules-pieces">
          <div><dt>♜ ${tekst('Toren')}</dt><dd>${tekst('Volgt een rechte baan, zolang er geen stuk in de weg staat.')}</dd></div>
          <div><dt>♝ ${tekst('Loper')}</dt><dd>${tekst('Volgt een diagonale baan, zolang er geen stuk in de weg staat.')}</dd></div>
          <div><dt>♛ ${tekst('Dame')}</dt><dd>${tekst('Combineert de zetten van de toren en de loper.')}</dd></div>
          <div><dt>♞ ${tekst('Paard')}</dt><dd>${tekst('Springt in een L-vorm: twee velden in één richting en één opzij. Het mag over stukken springen.')}</dd></div>
          <div><dt>♚ ${tekst('Koning')}</dt><dd>${tekst('Eén veld langs een rechte of diagonale baan. Bescherm hem tegen beide tegenstanders.')}</dd></div>
          <div><dt>♟ ${tekst('Pion')}</dt><dd>${tekst('Eén leeg veld vooruit; bij de eerste zet mag hij twee velden als beide vrij zijn. Slaat één veld schuin vooruit. Op de achterste rij van een tegenstander verandert hij automatisch in een dame.')}</dd></div>
        </dl><p>${tekst('Alleen het paard springt over stukken. Je mag niet eindigen op een veld met een eigen stuk.')}</p>
      </section>
      <section class="chess3-rules-important"><h3>${tekst('Een geslagen koning schakelt de speler uit')}</h3><p><strong>${tekst('Een koning kan worden geslagen. Je mag zetten doen die je koning aan aanvallen blootstellen.')}</strong> ${tekst('Deze variant blokkeert geen schaak of schaakmat. Controleer vóór je zet de dreigingen van beide tegenstanders.')}</p><p><strong>${tekst('Voorbeeld:')}</strong> ${tekst('Wit slaat de zwarte koning → alle zwarte stukken verdwijnen → Wit en Rood spelen verder om de beurt. Wordt daarna de rode koning geslagen, dan wint Wit.')}</p></section>
      <section><h3>${tekst('Aansluiten en bijzondere regels')}</h3><ul><li>${tekst('Als een derde speler aansluit bij een partij met twee spelers, begint iedereen opnieuw vanuit de beginstelling voor drie spelers. De oude stelling wordt niet overgenomen.')}</li><li>${tekst('Deze variant heeft geen rokade of en passant.')}</li><li>${tekst('Remise en pat worden niet automatisch vastgesteld.')}</li></ul></section>
      ${localPreview ? `<section class="chess3-rules-test"><h3>${tekst(testMode ? 'In FIBRO TEST' : 'In deze lokale preview')}</h3><p><strong>${tekst('Je bestuurt alle drie de kleuren.')}</strong> ${tekst('Na een witte zet speel je een zwarte zet en daarna een rode.')}</p>${testMode ? `<p>${tekst('De drie cameravakken tonen je eigen webcam. Er worden geen uitnodigingen verstuurd. Opnieuw beginnen herstelt de beginstelling; Terug naar test met 2 spelers opent het gewone testbord.')}</p>` : ''}</section>` : ''}
    </div>
    <footer class="chess3-rules-footer"><button class="chess3-rules-done" type="button">${tekst('Begrepen — terug naar het spel')}</button><p class="chess3-artwork-credit">${tekst('Bord en stukken:')} <a href="https://greenchess.net/info.php?item=downloads" target="_blank" rel="noopener noreferrer">Uray M. János / Green Chess</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a></p></footer>`
  rulesButton.addEventListener('click', () => {
    if (rulesDialog.open) return
    rulesDialog.showModal()
    rulesDialog.scrollTop = 0
  })
  rulesDialog.querySelectorAll('.chess3-rules-close, .chess3-rules-done').forEach(button => button.addEventListener('click', () => rulesDialog.close()))
  rulesDialog.addEventListener('click', event => {
    if (event.target !== rulesDialog) return
    const bounds = rulesDialog.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) rulesDialog.close()
  })
  rulesDialog.addEventListener('close', () => { if (!destroyed && rulesButton.isConnected) rulesButton.focus() })
  const settingsButton = staticText(document.createElement('button'), '⚙ Instellingen')
  settingsButton.type = 'button'; settingsButton.className = 'chess3-rules-button'
  settingsButton.setAttribute('aria-haspopup', 'dialog'); settingsButton.setAttribute('aria-controls', 'chess3-settings')
  helpActions.append(settingsButton)
  const settingsDialog = document.createElement('dialog')
  settingsDialog.id = 'chess3-settings'; settingsDialog.className = 'chess3-rules chess3-settings'
  settingsDialog.setAttribute('aria-labelledby', 'chess3-settings-title')
  settingsDialog.innerHTML = `<header class="chess3-rules-header"><h2 id="chess3-settings-title">${tekst('Schaakinstellingen')}</h2><button type="button" class="chess3-rules-close" data-sch-label="Instellingen sluiten" aria-label="${veilig(t('Instellingen sluiten'))}">✕</button></header><div class="chess3-rules-content"><label for="chess3-language">${tekst('Taal van het schaakspel')}</label><select id="chess3-language"><option value="nl">Nederlands</option><option value="en">English</option></select><p class="chess3-rules-lead">${tekst('Deze keuze geldt alleen voor schaken op dit apparaat. Je partij en camerabeelden blijven behouden.')}</p></div><footer class="chess3-rules-footer"><button type="button" class="chess3-rules-done">${tekst('Terug naar het spel')}</button></footer>`
  const languageSelect = settingsDialog.querySelector('#chess3-language')
  languageSelect.value = taal.language
  languageSelect.addEventListener('change', () => taal.setLanguage(languageSelect.value))
  settingsButton.addEventListener('click', () => { if (!settingsDialog.open) settingsDialog.showModal(); languageSelect.focus() })
  settingsDialog.querySelectorAll('.chess3-rules-close, .chess3-rules-done').forEach(button => button.addEventListener('click', () => settingsDialog.close()))
  settingsDialog.addEventListener('click', event => {
    if (event.target !== settingsDialog) return
    const bounds = settingsDialog.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) settingsDialog.close()
  })
  settingsDialog.addEventListener('close', () => { if (!destroyed && settingsButton.isConnected) settingsButton.focus() })
  root.replaceChildren()
  root.append(heading, cameraRow, controls, status, boardWrap, captureBar, rulesDialog, settingsDialog)
  const soundButton = Bordgeluid?.knop?.(status, { language:taal.language })
  if (soundButton) helpActions.append(soundButton)
  const soundPerspective = document.createElement('p')
  soundPerspective.style.cssText = 'margin:0;color:var(--muted,#b5bfd2);font-size:11px;text-align:center;line-height:1.4'
  if (testMode || myPlayer < 0) controls.append(soundPerspective)
  function playMoveSound(mover) {
    if (!Bordgeluid) return
    let theme = 'classic'
    try { if (JSON.parse(localStorage.getItem('fibro_chess_settings_v1') || '{}').soundTheme === 'wood') theme = 'wood' } catch {}
    const effect = drieSlagEffect(state.lastMove?.captured, mover, myPlayer < 0 ? mover : myPlayer)
    if (effect) Bordgeluid.capturePiece?.({ ...effect, theme })
    else Bordgeluid.previewSchaakGeluid?.(theme)
  }
  root.insertAdjacentHTML('afterbegin', `<style>
    .chess3-shell{color:#f8fbff}.chess3-heading{text-align:center;margin:0 auto 12px;max-width:620px}.chess3-heading h2{margin:3px 0;font-size:clamp(20px,4vw,28px);letter-spacing:-.04em}.chess3-heading p{margin:3px 0;color:#b9c6d6;font-size:13px}.chess3-kicker{color:#81e6cb;font-size:10px;font-weight:850;letter-spacing:.18em}.chess3-status{min-height:24px;margin:6px 0 10px;text-align:center;color:#fff;font-weight:750}.chess3-status[data-player="0"]{color:#fff}.chess3-status[data-player="1"]{color:#c4c7ce}.chess3-status[data-player="2"]{color:#ff7777}.chess3-controls{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin:8px 0 12px}.chess3-turns{text-transform:uppercase;display:flex;align-items:center;gap:9px;border:1px solid #bccae738;border-radius:999px;padding:8px 13px;background:linear-gradient(145deg,#20293a,#141a27);box-shadow:inset 0 1px #ffffff17,0 4px 12px #0005;font-size:10px;letter-spacing:.12em}.chess3-turns b:nth-of-type(1){color:#fff}.chess3-turns b:nth-of-type(2){color:#c4c7ce}.chess3-turns b:nth-of-type(3){color:#ff7777}.chess3-turns i{color:#93a1b3;font-style:normal}.chess3-invite,.chess3-camera button,.chess3-reset,.chess3-return{border:1px solid #82ead088;border-radius:12px;background:linear-gradient(145deg,#baffeb,#58cdb7 60%,#37a994);color:#092a2b;font:inherit;font-size:12px;font-weight:800;padding:9px 13px;cursor:pointer;box-shadow:inset 0 1px #fff9,0 4px 0 #267c70,0 8px 16px #0004}.chess3-reset{background:linear-gradient(145deg,#ffe98a,#ffc629 60%,#e69a00);border-color:#ffec9a;color:#211800;box-shadow:inset 0 1px #fff9,0 4px 0 #9a6500,0 8px 16px #0004}.chess3-return{background:linear-gradient(145deg,#242424,#101010);border-color:#ffd400;color:#ffe34a;box-shadow:inset 0 1px #ffffff33,0 4px 0 #050505,0 8px 16px #0004}.chess3-frame{width:min(740px,94vw,calc(100dvh - 210px));margin:auto;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}.chess3-board{display:block;width:100%;height:auto;overflow:visible;touch-action:manipulation}.chess3-cell polygon{stroke:none;pointer-events:all}.chess3-cell[role="button"]{cursor:pointer;outline:none}.chess3-cell[role="button"]:focus-visible polygon{stroke:#7bf0d9;stroke-width:7}.chess3-cell .chess3-piece{pointer-events:none;filter:none}.chess3-cell.is-selected polygon{fill:#ffe68d33;stroke:#ffe68d;stroke-width:7}.chess3-cell.is-legal polygon{fill:#58d89533;stroke:#8af4b7;stroke-width:5}.chess3-cell.is-capture polygon{fill:#ff6f7733;stroke:#ff8a8f;stroke-width:6}.chess3-capturebar{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin:12px auto;color:#d5dfed;font-size:12px}.chess3-captures{min-width:100px;padding:7px 10px;border:1px solid #bccae725;border-radius:12px;background:linear-gradient(145deg,#252b3b,#151a25)}.chess3-captures strong{font-size:11px}.chess3-eliminated{opacity:.45;text-decoration:line-through}.chess3-cameras{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;width:min(740px,94vw);margin:8px auto}.chess3-camera{position:relative;width:min(220px,29vw);aspect-ratio:16/9;overflow:hidden;border:1px solid #ffffff36;border-radius:15px;background:linear-gradient(145deg,#20293a,#111721);box-shadow:inset 0 1px #fff2,0 5px 14px #0006}.chess3-camera video{display:none;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}.chess3-camera.has-video video{display:block}.chess3-camera-name{position:absolute;left:8px;bottom:7px;border-radius:999px;padding:4px 8px;background:#07111dcc;color:#fff;font-size:11px;font-weight:750}.chess3-camera[data-player="0"]{outline-color:#fff}.chess3-camera[data-player="1"]{outline-color:#c4c7ce}.chess3-camera[data-player="2"]{outline-color:#ff7777}.chess3-camera.has-video{outline:2px solid currentColor}.chess3-camera[data-player="0"].has-video{color:#fff}.chess3-camera[data-player="1"].has-video{color:#c4c7ce}.chess3-camera[data-player="2"].has-video{color:#ff7777}.chess3-camera button{position:absolute;inset:auto 7px 7px auto;padding:6px 8px;font-size:10px}.chess3-camera.has-video button{background:linear-gradient(145deg,#ffc6cc,#fb6875);color:#3d0d17;border-color:#ffb3be}.chess3-camera-wait{position:absolute;inset:0;display:grid;place-items:center;padding:10px;text-align:center;color:#c1ccdc;font-size:11px;pointer-events:none}.chess3-camera.has-video .chess3-camera-wait{display:none}.chess3-test-note{width:min(740px,94vw);margin:5px auto;padding:7px 10px;border:1px solid #ffd40099;border-radius:10px;background:repeating-linear-gradient(135deg,#171717 0 8px,#242424 8px 16px);color:#ffe34a;font-size:10px;font-weight:850;letter-spacing:.1em;text-align:center}@media(max-width:560px){.chess3-frame{width:min(740px,94vw,calc(100dvh - 210px));margin:auto;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}.chess3-camera{width:calc(50% - 6px)}.chess3-cameras{gap:7px}.chess3-heading p{font-size:12px}}@media(prefers-reduced-motion:reduce){.chess3-cell polygon{transition:none}}
  </style>`)

  root.insertAdjacentHTML('afterbegin', `<style>
    .chess3-cameras[hidden]{display:none}.chess3-artwork-credit{margin:14px 0 0;color:#aab7c8;font-size:10px;text-align:center}.chess3-artwork-credit a{color:inherit}
    .chess3-cell .chess3-piece{opacity:.8;transition:opacity .22s ease}
    .chess3-board .chess3-cell .chess3-piece{filter:url(#chess3-piece-light)}
    .chess3-board[data-turn="0"] .chess3-cell[data-player="0"] .chess3-piece,
    .chess3-board[data-turn="1"] .chess3-cell[data-player="1"] .chess3-piece,
    .chess3-board[data-turn="2"] .chess3-cell[data-player="2"] .chess3-piece,
    .chess3-board[data-turn="finished"] .chess3-piece{opacity:1}
    .chess3-turn-spotlight{pointer-events:none}
    @media(prefers-reduced-motion:reduce){.chess3-cell .chess3-piece{transition:none}}
    .chess3-settings{width:min(460px,calc(100vw - 24px))}.chess3-settings .chess3-rules-content{padding-block:20px}.chess3-settings label{display:block;font-size:14px;font-weight:750}.chess3-settings select{box-sizing:border-box;display:block;width:100%;min-height:44px;margin-top:10px;padding:9px 12px;border:1px solid #bfd5f44d;border-radius:11px;background:#182234;color:#fff;font:inherit}.chess3-settings select:focus-visible{outline:2px solid #a8f5df;outline-offset:3px}
    .chess3-help-actions{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;max-width:100%}
    .chess3-rules-button{min-height:36px;min-width:64px;padding:7px 10px;border:1px solid #b0d7ff70;border-radius:11px;background:linear-gradient(145deg,#34455e,#192535);color:#e4f3ff;font:750 11px system-ui,sans-serif;cursor:pointer;box-shadow:inset 0 1px #ffffff30,0 3px 0 #0d1521,0 6px 12px #0005}
    .chess3-rules-button:active{transform:translateY(2px);box-shadow:inset 0 1px #ffffff20,0 1px 0 #0d1521}
    .chess3-rules-button:focus-visible,.chess3-rules button:focus-visible{outline:2px solid #a8f5df;outline-offset:3px}
    .chess3-rules{position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(650px,calc(100vw - 24px));max-height:88dvh;padding:0;overflow:auto;overscroll-behavior:contain;scrollbar-color:#8fcae4 #151e2e;border:1px solid #bfdeff;border-radius:22px;background:radial-gradient(ellipse at 0 0,#3b527a66,transparent 55%),linear-gradient(145deg,#222d40,#101825 70%);color:#eef5ff;box-shadow:inset 0 1px #ffffff33,0 5px 0 #080e18,0 24px 80px #000c;font:14px/1.55 system-ui,sans-serif;text-align:left}
    .chess3-rules:not([open]){display:none}.chess3-rules::backdrop{background:#050a146e;backdrop-filter:blur(6px) brightness(.66)}
    .chess3-rules-header{position:sticky;top:0;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 22px 16px;border-bottom:1px solid #c4dfff22;background:linear-gradient(145deg,#26344af7,#182234f7);backdrop-filter:blur(12px)}
    .chess3-rules-header h2{margin:4px 0 0;font-size:clamp(20px,4vw,27px);line-height:1.15;letter-spacing:-.035em}
    .chess3-rules-close{flex:none;width:34px;min-width:34px;height:34px;min-height:34px;border:1px solid #bfd5f44d;border-radius:10px;background:#ffffff0a;color:#e7f2ff;font-size:16px;cursor:pointer}
    .chess3-rules-content{padding:2px 22px 20px}.chess3-rules-content section{margin-top:20px}.chess3-rules-content h3{margin:0 0 7px;font-size:15px;color:#b5f3df}.chess3-rules-content p{margin:7px 0}.chess3-rules-lead{color:#c4d2e7}.chess3-rules-content ul{margin:8px 0;padding-left:20px}.chess3-rules-content li{margin:6px 0}
    .chess3-rules-goal,.chess3-rules-important,.chess3-rules-test{padding:14px 16px;border:1px solid #9cebd657;border-radius:14px;background:linear-gradient(135deg,#63d7b516,#8ebeff08);box-shadow:inset 0 1px #ffffff0f}
    .chess3-rules-important{border-color:#f3cf7b66;background:linear-gradient(135deg,#d6a94d18,#9e6b2108)}.chess3-rules-important h3{color:#ffe09b}.chess3-rules-test{border-color:#ffe05d66}.chess3-rules-test h3{color:#ffe56d}
    .chess3-rules-order{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 0;font-size:12px;letter-spacing:.06em}.chess3-rules-order b:nth-of-type(1){color:#fff}.chess3-rules-order b:nth-of-type(2){color:#c4c7ce}.chess3-rules-order b:nth-of-type(3){color:#ff7777}.chess3-rules-order span{color:#b1c0d6}
    .chess3-rules-pieces{display:grid;gap:0;margin:10px 0;border:1px solid #bbd7ff26;border-radius:12px;overflow:hidden}.chess3-rules-pieces div{display:grid;grid-template-columns:95px 1fr;gap:8px;padding:11px 12px;background:#ffffff05}.chess3-rules-pieces div+div{border-top:1px solid #bbd7ff1a}.chess3-rules-pieces dt{font-weight:750;color:#e4eeff}.chess3-rules-pieces dd{margin:0;color:#c9d5e8;font-size:13px}
    .chess3-rules-footer{padding:0 22px 22px}.chess3-rules-done{width:100%;min-height:44px;padding:10px 16px;border:1px solid #b9ffe8;border-radius:12px;background:linear-gradient(145deg,#c4ffec,#67cfb8);color:#092d2b;font:800 13px system-ui,sans-serif;box-shadow:inset 0 1px #fff9,0 3px 0 #277c71;cursor:pointer}
    @media(max-width:420px){.chess3-rules-header{padding:17px 16px 14px}.chess3-rules-content{padding:2px 16px 18px}.chess3-rules-footer{padding:0 16px 18px}.chess3-rules-pieces div{grid-template-columns:78px 1fr;padding:10px 9px;gap:6px}}
  </style>`)


  if (testMode) {
    const note = document.createElement('div')
    note.className = 'chess3-test-note'
    staticText(note, 'TESTPOP · LOKALE SIMULATIE · 3 CAMERABEELDEN · GEEN UITNODIGINGEN')
    root.insertBefore(note, cameraRow)
  }

  const cameraTiles = roster.map((player, index) => {
    const tile = document.createElement('section'); tile.className = 'chess3-camera'; tile.dataset.player = String(index)
    const video = document.createElement('video'); video.autoplay = true; video.playsInline = true; video.muted = true
    const wait = document.createElement('span'); wait.className = 'chess3-camera-wait'
    const label = document.createElement('span'); label.className = 'chess3-camera-name'
    const item = { tile, video, wait, label, player, index, waitMessage:null }
    setCameraWait(item, testMode ? 'De lokale camera staat uit' : (player.id === userId ? 'Je camera staat uit' : '{naam} kan de camera aanzetten'), { naam:playerName(index) })
    tile.append(video, wait, label)
    if (player.id === userId) {
      const button = document.createElement('button'); button.type='button'
      setCameraButton(button, testMode ? (testStream ? 'Testcamera’s uitzetten' : 'Testcamera’s aanzetten') : 'Camera aanzetten')
      button.setAttribute('aria-pressed',String(Boolean(testMode && testStream)))
      button.addEventListener('click', () => toggleCamera(button, tile, video))
      tile.append(button)
    }
    cameraRow.append(tile)
    return item
  })

  function translateCameras() {
    for (const item of cameraTiles) {
      const { player, index } = item
      item.label.textContent = `${t(COLORS[index])} · ${player.id === userId && testMode ? t('JIJ · TEST') : (testMode ? `TEST · ${playerName(index)}` : playerName(index))}`
      if (item.waitMessage) {
        const values = { ...item.waitMessage.values }
        if (Object.hasOwn(values, 'naam')) values.naam = playerName(index)
        item.wait.textContent = item.waitMessage.key ? t(item.waitMessage.key, values) : ''
      }
      const button = item.tile.querySelector('button')
      if (button?.dataset.chessCameraText) button.textContent = t(button.dataset.chessCameraText)
    }
  }
  function paintTestCamera(stream) {
    localStream = stream || null
    for (const item of cameraTiles) {
      item.video.srcObject = localStream
      item.tile.classList.toggle('has-video', Boolean(localStream))
      setCameraWait(item, localStream ? null : 'De lokale camera staat uit')
      item.video.style.display = localStream ? 'block' : 'none'
      if (localStream) item.video.play().catch(() => {})
      const button = item.tile.querySelector('button')
      if (button) {
        setCameraButton(button, localStream ? 'Testcamera’s uitzetten' : 'Testcamera’s aanzetten')
        button.setAttribute('aria-pressed', String(Boolean(localStream)))
      }
    }
  }
  if (testMode && testStream) paintTestCamera(testStream)
  const resetButton = controls.querySelector('.chess3-reset')
  resetButton?.addEventListener('click', () => {
    state = newThreePlayerGame(); selected = null; highlighted = []; draw()
    say('Het bord met 96 velden staat weer in de beginstelling.')
  })

  function draw(preserveStatus = false) {
    if (!preserveStatus) statusMessage = null
    svg.dataset.turn = state.winner === null ? String(state.turn) : 'finished'
    const cells = state.board.cells.map(cell => {
      const piece = state.pieces.get(cell.id)
      const points = threePlayerCellPolygon(cell)
      const pointList = points.map(point => point.join(',')).join(' ')
      const moves = highlighted.includes(cell.id)
      const capture = moves && state.pieces.has(cell.id)
      const classes = ['chess3-cell', selected === cell.id ? 'is-selected' : '', moves ? 'is-legal' : '', capture ? 'is-capture' : ''].filter(Boolean).join(' ')
      const title = piece ? veilig(`${playerName(piece.player)}: ${t(LABELS[piece.type])}${state.active[piece.player] ? '' : t(' (uitgeschakeld)')}`) : veilig(t('Leeg veld'))
      const glyph = piece ? threePlayerPieceArtwork(piece, points) : ''
      return `<g class="${classes}" data-cell-id="${cell.id}" data-player="${piece?.player ?? ''}" role="button" tabindex="0" aria-label="${title}, ${cell.id}"><title>${title}</title><polygon points="${pointList}" fill="transparent"/>${glyph}</g>`
    }).join('')
    const spotlight = state.winner === null ? turnSpotlight(state.turn) : ''
    svg.innerHTML = `<image class="chess3-original-board" href="${THREE_PLAYER_BOARD_ARTWORK}" x="-458" y="-396" width="916" height="792" aria-hidden="true"/>${pieceLighting(state.winner === null ? state.turn : null)}${spotlight}${cells}`
    const turn = state.winner === null ? state.turn : state.winner
    if (statusMessage) status.textContent = t(statusMessage.key, statusMessage.values)
    else if (state.winner !== null) status.textContent = t('{naam} wint — de laatste koning is over.', { naam:playerName(state.winner) })
    else if (!state.active[myPlayer] && !localPreview) status.textContent = t('{naam} is uitgeschakeld. {volgende} is aan zet.', { naam:playerName(myPlayer), volgende:playerName(turn) })
    else status.textContent = t('{naam} is aan zet', { naam:playerName(turn) }) + (localPreview || turn === myPlayer ? t(' · jouw zet') : '')
    status.dataset.player = String(turn)
    captureBar.replaceChildren(...roster.map((player, index) => {
      const entry = document.createElement('div'); entry.className = 'chess3-captures' + (state.active[index] ? '' : ' chess3-eliminated')
      const count = [...state.pieces.values()].filter(piece => piece.player === index).length
      entry.innerHTML = `<strong style="color:${COLOR_STYLES[index]}">${veilig(t(COLORS[index]))}</strong> · ${veilig(playerName(index))}<br>${veilig(t(count === 1 ? '{n} stuk' : '{n} stukken', { n:count }))}${state.active[index] ? '' : veilig(t(' · uitgeschakeld'))}`
      return entry
    }))
  }

  function onCellClick(event) {
    const cell = event.target.closest?.('[data-cell-id]')
    if (!cell) return
    const id = cell.dataset.cellId
    if (!localPreview && state.turn !== myPlayer) return
    if (selected && highlighted.includes(id)) { sendMove(selected, id); return }
    const piece = state.pieces.get(id)
    if (piece?.player === state.turn) {
      selected = id; highlighted = legalThreePlayerMoves(state, id); draw()
    } else { selected = null; highlighted = []; draw() }
  }

  function sendMove(from, to) {
    const expectedPly = state.ply
    const mover = state.turn
    if (!applyThreePlayerMove(state, from, to)) return
    playMoveSound(mover)
    selected = null; highlighted = []; draw()
    if (!localPreview) gameChannel?.send({ type:'broadcast', event:'zet', payload:{ variant:'schaken-drie', ply:expectedPly, from, to, actor:roster[myPlayer].id } })
  }

  function receiveMove(message) {
    const payload = message?.payload || {}
    if (payload.variant !== 'schaken-drie' || payload.ply !== state.ply || payload.actor !== roster[state.turn]?.id) return
    if (localPreview || payload.actor === userId) return
    const mover = state.turn
    if (applyThreePlayerMove(state, payload.from, payload.to)) { playMoveSound(mover); selected = null; highlighted = []; draw() }
  }

  svg.addEventListener('click', onCellClick)
  svg.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault(); onCellClick(event)
  })
  if (gameChannel) {
    gameChannel.on('broadcast', { event:'zet' }, receiveMove)
    gameChannel.on('broadcast', { event:'schaken-drie-signal' }, receiveSignal)
    gameChannel.on('broadcast', { event:'schaken-drie-camera' }, receiveCameraState)
  }
  function translateGame() {
    const focusedCell = document.activeElement?.closest?.('[data-cell-id]')
    const focusedId = focusedCell && svg.contains?.(focusedCell) ? focusedCell.dataset.cellId : null
    taal.translate(root)
    titleSurface?.replaceChildren(document.createTextNode(t('♟️ Schaken met drie spelers')))
    titleSurface?.setAttribute('lang', taal.language)
    languageSelect.value = taal.language
    soundButton?.setLanguage?.(taal.language)
    soundPerspective.textContent = myPlayer < 0 ? t('Geluid volgt de speler die zet.') : t('Geluid vanuit jouw perspectief: {kleur}.', { kleur:t(COLORS[myPlayer]) })
    translateCameras()
    draw(true)
    if (focusedId) svg.querySelector(`[data-cell-id="${focusedId}"]`)?.focus()
  }
  const stopLanguage = taal.subscribe(translateGame)
  translateGame()

  async function toggleCamera(button, tile, video) {
    if (destroyed) return
    if (testMode) {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
        paintTestCamera(null)
        onTestCameraChange?.(null)
        say('Alle drie de testcamera’s staan uit. Je kunt verder spelen.')
        return
      }
      button.disabled = true; setCameraButton(button, 'Testcamera’s starten…')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false })
        if (destroyed) { stream.getTracks().forEach(track => track.stop()); return }
        localStream = stream
        paintTestCamera(localStream)
        onTestCameraChange?.(localStream)
        say('Alle drie de cameravakken tonen nu je eigen webcam.')
      } catch (error) {
        setCameraButton(button, 'Testcamera’s aanzetten')
        say(error?.name === 'NotAllowedError' ? 'Je hebt geen cameratoegang gegeven. Je kunt het bord blijven testen.' : 'De camera is niet beschikbaar. Controleer de browsertoestemming en probeer opnieuw.')
      } finally { button.disabled = false }
      return
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop()); localStream = null
      for (const pc of peers.values()) {
        const sender = pc.getSenders().find(item => item.track?.kind === 'video')
        if (sender) await sender.replaceTrack(null).catch(() => {})
      }
      video.srcObject = null; tile.classList.remove('has-video')
      setCameraButton(button, 'Camera aanzetten'); button.setAttribute('aria-pressed','false')
      gameChannel?.send({ type:'broadcast', event:'schaken-drie-camera', payload:{ actor:userId, active:false } })
      return
    }
    button.disabled = true; setCameraButton(button, 'Camera starten…')
    try {
      const ice = await import('./ice-config.js?v=1')
      await ice.iceReady
      if (destroyed) return
      iceServers = ice.ICE_SERVERS
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false })
      if (destroyed) { stream.getTracks().forEach(track => track.stop()); return }
      localStream = stream
      video.srcObject = localStream; await video.play().catch(() => {})
      if (destroyed) return
      tile.classList.add('has-video')
      setCameraButton(button, 'Camera uitzetten'); button.setAttribute('aria-pressed','true')
      await Promise.all(roster.filter(player => player.id !== userId).map(player => addPeerTrack(player.id)))
      gameChannel?.send({ type:'broadcast', event:'schaken-drie-camera', payload:{ actor:userId, active:true } })
    } catch (error) {
      setCameraButton(button, 'Camera aanzetten')
      say(error?.name === 'NotAllowedError' ? 'Je hebt geen cameratoegang gegeven. Je kunt verder spelen.' : 'De camera kon niet starten. Controleer de browsertoestemming en probeer opnieuw.')
    } finally { button.disabled = false }
  }

  function signal(to, data) {
    gameChannel?.send({ type:'broadcast', event:'schaken-drie-signal', payload:{ from:userId, to, ...data } })
  }
  function ensurePeer(peerId) {
    if (peers.has(peerId)) return peers.get(peerId)
    const pc = new RTCPeerConnection(iceServers)
    const transceiver = pc.addTransceiver('video', { direction:localStream ? 'sendrecv' : 'recvonly' })
    const stream = new MediaStream()
    pc.ontrack = event => {
      const tile = cameraTiles.find(item => item.player.id === peerId)
      if (!tile) return
      const remote = event.streams?.[0]
      if (remote) tile.video.srcObject = remote
      else { stream.addTrack(event.track); tile.video.srcObject = stream }
      tile.video.play().catch(() => {})
      tile.tile.classList.add('has-video')
    }
    pc.onicecandidate = event => { if (event.candidate) signal(peerId, { candidate:event.candidate }) }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        const tile = cameraTiles.find(item => item.player.id === peerId)
        if (tile && !tile.video.srcObject) tile.tile.classList.remove('has-video')
      }
    }
    peers.set(peerId, pc)
    if (localStream) for (const track of localStream.getTracks()) transceiver.sender.replaceTrack(track).catch(() => {})
    return pc
  }
  async function addPeerTrack(peerId) {
    const pc = ensurePeer(peerId)
    const transceiver = pc.getTransceivers().find(item => item.receiver.track.kind === 'video')
    if (transceiver) {
      transceiver.direction = 'sendrecv'
      await transceiver.sender.replaceTrack(localStream.getVideoTracks()[0])
    }
    if (userId.localeCompare(peerId) < 0 && pc.signalingState === 'stable') {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      signal(peerId, { description:pc.localDescription })
    } else signal(peerId, { hello:true })
  }
  async function receiveSignal(message) {
    const payload = message?.payload || {}
    if (destroyed || payload.to !== userId || payload.from === userId || !roster.some(player => player.id === payload.from)) return
    const pc = ensurePeer(payload.from)
    try {
      if (payload.description?.type === 'offer') {
        await pc.setRemoteDescription(payload.description)
        for (const candidate of pendingIce.get(payload.from) || []) await pc.addIceCandidate(candidate).catch(() => {})
        pendingIce.delete(payload.from)
        const answer = await pc.createAnswer(); await pc.setLocalDescription(answer)
        signal(payload.from, { description:pc.localDescription })
      } else if (payload.description?.type === 'answer' && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(payload.description)
        for (const candidate of pendingIce.get(payload.from) || []) await pc.addIceCandidate(candidate).catch(() => {})
        pendingIce.delete(payload.from)
      } else if (payload.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate).catch(() => {})
        else { const queue = pendingIce.get(payload.from) || []; queue.push(payload.candidate); pendingIce.set(payload.from, queue) }
      } else if (payload.hello && userId.localeCompare(payload.from) < 0 && pc.signalingState === 'stable') {
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer)
        signal(payload.from, { description:pc.localDescription })
      }
    } catch (error) { console.warn('[chess3] webcam signaling failed:', error) }
  }
  function receiveCameraState(message) {
    const payload = message?.payload || {}
    if (!roster.some(player => player.id === payload.actor) || payload.actor === userId) return
    const tile = cameraTiles.find(item => item.player.id === payload.actor)
    if (tile && !payload.active && !tile.video.srcObject) setCameraWait(tile, '{naam} kan de camera aanzetten', { naam:playerName(tile.index) })
    if (tile && payload.active && !tile.video.srcObject) setCameraWait(tile, 'Verbinding maken met {naam}…', { naam:playerName(tile.index) })
  }

  const controller = {
    get state() { return state },
    setTestCamera(stream) {
      if (!testMode || destroyed) return false
      paintTestCamera(stream)
      onTestCameraChange?.(stream || null)
      return true
    },
    destroy({ preserveCamera = false } = {}) {
      if (destroyed) return
      destroyed = true
      stopLanguage(); taal.destroy()
      if (rulesDialog.open) rulesDialog.close()
      if (settingsDialog.open) settingsDialog.close()
      if (!preserveCamera) localStream?.getTracks().forEach(track => track.stop())
      peers.forEach(pc => pc.close())
      peers.clear(); pendingIce.clear()
      root.replaceChildren()
      root.classList.remove('chess3-layout')
      if (previousLanguage === null) root.removeAttribute?.('lang'); else root.setAttribute?.('lang', previousLanguage)
      if (previousTitleLanguage === null) titleSurface?.removeAttribute?.('lang'); else titleSurface?.setAttribute?.('lang', previousTitleLanguage)
      document.getElementById('spelOverlay')?.classList.remove('chess3-board-layout')
    }
  }
  return controller
}
