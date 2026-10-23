import {
  applyThreePlayerMove,
  legalThreePlayerMoves,
  newThreePlayerGame,
  threePlayerCellPolygon,
  THREE_PLAYER_COLORS,
  THREE_PLAYER_NAMES,
  THREE_PLAYER_SYMBOLS
} from './schaak-drie.js?v=2'

const COLOR_STYLES = ['#55aaff', '#ff626d', '#53dc8c']
const LABELS = { K:'King', Q:'Queen', R:'Rook', B:'Bishop', N:'Knight', P:'Pawn' }

export function start({ gameChannel = null, players = [], userId = null, localPreview = false, inviteThird = null, testMode = false, testStream = null, onTestCameraChange = null, onReturnToTwoPlayer = null } = {}) {
  const root = document.getElementById('spelInhoud')
  if (!root) throw new Error('The chess game surface is missing.')
  if (players.length !== 3) throw new TypeError('Three player identities are required.')
  const roster = players.map((player, index) => typeof player === 'string'
    ? { id:player, username:THREE_PLAYER_NAMES[index] }
    : { id:String(player.id), username:String(player.username || THREE_PLAYER_NAMES[index]) })
  const myPlayer = roster.findIndex(player => player.id === userId)
  if (!localPreview && myPlayer < 0) throw new TypeError('Your account is not in the chess roster.')
  root.classList.add('chess3-layout')
  document.getElementById('spelOverlay')?.classList.add('chess3-board-layout')
  let state = newThreePlayerGame()
  let selected = null
  let highlighted = []
  let destroyed = false
  let localStream = null
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
  svg.setAttribute('aria-label', 'Three-player chess board, 96 squares')
  svg.setAttribute('viewBox', boardViewBox())
  boardWrap.append(svg)
  const captureBar = document.createElement('div')
  captureBar.className = 'chess3-capturebar'
  const heading = document.createElement('header')
  heading.className = 'chess3-heading'
  heading.innerHTML = '<span class="chess3-kicker">FIBRO · THREE PLAYER</span><h2>Three-player chess</h2><p>Capture a king to eliminate that player. The last king standing wins. When a third player joins mid-match, everyone starts from this opening position.</p>'
  controls.innerHTML = '<span class="chess3-turns" aria-label="Turn order"><b>BLUE</b><i>→</i><b>RED</b><i>→</i><b>GREEN</b></span>'
  if (testMode) {
    const resetButton = document.createElement('button')
    resetButton.type = 'button'; resetButton.className = 'chess3-reset'; resetButton.textContent = '↻ Reset 96-square board'
    controls.append(resetButton)
    if (onReturnToTwoPlayer) {
      const backButton = document.createElement('button')
      backButton.type = 'button'; backButton.className = 'chess3-return'; backButton.textContent = '← Back to 2-player test'
      backButton.addEventListener('click', () => onReturnToTwoPlayer())
      helpActions.append(backButton)
    }
  } else if (localPreview && inviteThird) {
    const inviteButton = document.createElement('button')
    inviteButton.type = 'button'; inviteButton.className = 'chess3-invite'; inviteButton.textContent = 'Invite a third player'
    inviteButton.addEventListener('click', () => inviteThird())
    controls.append(inviteButton)
  }
  const rulesButton = document.createElement('button')
  rulesButton.type = 'button'
  rulesButton.className = 'chess3-rules-button'
  rulesButton.textContent = 'ⓘ Rules'
  rulesButton.title = 'How to play three-player chess'
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
      <div><span class="chess3-kicker">FIBRO · HOW TO PLAY</span><h2 id="chess3-rules-title">Three players. Last king wins.</h2></div>
      <button class="chess3-rules-close" type="button" aria-label="Close rules">✕</button>
    </header>
    <div class="chess3-rules-content">
      <p class="chess3-rules-lead">Three armies, 96 squares. Each colour starts with 16 pieces. This is Fibro’s <strong>king-capture variant</strong>.</p>
      <section class="chess3-rules-goal"><h3>The goal</h3><p><strong>Keep your king alive.</strong> Capture an opponent’s king to eliminate that player. The last player with a king wins.</p></section>
      <section><h3>1 · Take turns</h3><p class="chess3-rules-order"><b>BLUE</b><span>→</span><b>RED</b><span>→</span><b>GREEN</b><span>→ repeat</span></p><p>Make <strong>one move</strong>, then the next colour plays. The turn message tells you whose move it is.</p></section>
      <section><h3>2 · Click a piece, then a highlighted square</h3><p>Select a piece belonging to the colour whose turn it is. The board shows where it can go:</p><ul><li><strong>Green outline:</strong> an available move.</li><li><strong>Red outline:</strong> capture an opponent’s piece.</li></ul><p>Click a highlighted destination to move. Click another one of your pieces to change your selection. You can attack either opponent.</p></section>
      <section><h3>3 · Follow the board’s paths</h3><p>The squares change direction around the centre. Follow their rows and diagonals rather than the screen’s edges. <strong>The highlights are your guide.</strong></p>
        <dl class="chess3-rules-pieces">
          <div><dt>♜ Rook</dt><dd>Along a straight path, as far as the path is clear.</dd></div>
          <div><dt>♝ Bishop</dt><dd>Along a diagonal path, as far as the path is clear.</dd></div>
          <div><dt>♛ Queen</dt><dd>Combines the rook’s and bishop’s moves.</dd></div>
          <div><dt>♞ Knight</dt><dd>An L-shaped jump: two squares in one direction and one across. It can jump over pieces.</dd></div>
          <div><dt>♚ King</dt><dd>One square along a straight or diagonal path. Protect it from both opponents.</dd></div>
          <div><dt>♟ Pawn</dt><dd>One empty square forward; optionally two on its first move if both squares are clear. Captures one square diagonally. Reaching an opponent’s back row automatically makes it a queen.</dd></div>
        </dl><p>Only the knight jumps over pieces. You cannot land on a piece of your own colour.</p>
      </section>
      <section class="chess3-rules-important"><h3>King capture ends a player’s game</h3><p><strong>A king can be captured. Moves that expose your king are allowed.</strong> There is no check or checkmate protection in this variant, so look at both opponents’ threats before you move.</p><p><strong>Example:</strong> Blue captures Red’s king → every red piece disappears → Blue and Green continue taking turns. If Green’s king is then captured, Blue wins.</p></section>
      <section><h3>Joining & special rules</h3><ul><li>When a third player joins a two-player match, everyone starts a <strong>fresh three-player opening</strong>. The previous position is not carried over.</li><li>This version has no castling or en passant.</li><li>Draws and stalemate are not detected automatically.</li></ul></section>
      ${localPreview ? `<section class="chess3-rules-test"><h3>${testMode ? 'In FIBRO TEST' : 'In this local preview'}</h3><p><strong>You control all three colours.</strong> After moving Blue, play a Red move, then a Green move.</p>${testMode ? '<p>The three camera tiles mirror your own webcam. No invitations are sent. <strong>Reset</strong> restores the opening; <strong>Back to 2-player test</strong> returns to the regular test board.</p>' : ''}</section>` : ''}
    </div>
    <footer class="chess3-rules-footer"><button class="chess3-rules-done" type="button">Got it — back to the game</button></footer>`
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
  root.replaceChildren()
  root.append(heading, cameraRow, controls, status, boardWrap, captureBar, rulesDialog)
  root.insertAdjacentHTML('afterbegin', `<style>
    .chess3-shell{color:#f8fbff}.chess3-heading{text-align:center;margin:0 auto 12px;max-width:620px}.chess3-heading h2{margin:3px 0;font-size:clamp(20px,4vw,28px);letter-spacing:-.04em}.chess3-heading p{margin:3px 0;color:#b9c6d6;font-size:13px}.chess3-kicker{color:#81e6cb;font-size:10px;font-weight:850;letter-spacing:.18em}.chess3-status{min-height:24px;margin:6px 0 10px;text-align:center;color:#fff;font-weight:750}.chess3-status[data-player="0"]{color:#7ac4ff}.chess3-status[data-player="1"]{color:#ff9095}.chess3-status[data-player="2"]{color:#76eba5}.chess3-controls{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin:8px 0 12px}.chess3-turns{display:flex;align-items:center;gap:9px;border:1px solid #bccae738;border-radius:999px;padding:8px 13px;background:linear-gradient(145deg,#20293a,#141a27);box-shadow:inset 0 1px #ffffff17,0 4px 12px #0005;font-size:10px;letter-spacing:.12em}.chess3-turns b:nth-of-type(1){color:#7ac4ff}.chess3-turns b:nth-of-type(2){color:#ff9095}.chess3-turns b:nth-of-type(3){color:#76eba5}.chess3-turns i{color:#93a1b3;font-style:normal}.chess3-invite,.chess3-camera button,.chess3-reset,.chess3-return{border:1px solid #82ead088;border-radius:12px;background:linear-gradient(145deg,#baffeb,#58cdb7 60%,#37a994);color:#092a2b;font:inherit;font-size:12px;font-weight:800;padding:9px 13px;cursor:pointer;box-shadow:inset 0 1px #fff9,0 4px 0 #267c70,0 8px 16px #0004}.chess3-reset{background:linear-gradient(145deg,#ffe98a,#ffc629 60%,#e69a00);border-color:#ffec9a;color:#211800;box-shadow:inset 0 1px #fff9,0 4px 0 #9a6500,0 8px 16px #0004}.chess3-return{background:linear-gradient(145deg,#242424,#101010);border-color:#ffd400;color:#ffe34a;box-shadow:inset 0 1px #ffffff33,0 4px 0 #050505,0 8px 16px #0004}.chess3-frame{width:min(740px,94vw,calc(100dvh - 210px));margin:auto;padding:9px;border:1px solid #d8e9ff70;border-radius:18px;background:linear-gradient(145deg,#d8e4f3,#5a6a7e 55%,#243143);box-shadow:inset 0 1px #fff,0 8px 0 #192331,0 12px 28px #0009}.chess3-board{display:block;width:100%;height:auto;overflow:visible;touch-action:manipulation}.chess3-cell polygon{stroke:#18223570;stroke-width:.035;transition:filter .12s ease}.chess3-cell[role="button"]{cursor:pointer;outline:none}.chess3-cell[role="button"]:focus-visible polygon{stroke:#7bf0d9;stroke-width:.13}.chess3-cell .chess3-piece{font-family:"Noto Sans Symbols 2","Segoe UI Symbol",serif;font-size:.78px;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:#101722;stroke-width:.035;stroke-linejoin:round;filter:drop-shadow(0 .045px .055px #000b);pointer-events:none}.chess3-cell[data-player="0"] .chess3-piece{fill:#55aaff}.chess3-cell[data-player="1"] .chess3-piece{fill:#ff626d}.chess3-cell[data-player="2"] .chess3-piece{fill:#53dc8c}.chess3-cell.is-selected polygon{stroke:#ffe68d;stroke-width:.14;filter:brightness(1.25)}.chess3-cell.is-legal polygon{stroke:#b5ffdb;stroke-width:.10;filter:brightness(1.18)}.chess3-cell.is-capture polygon{stroke:#ff8a8f;stroke-width:.13}.chess3-capturebar{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin:12px auto;color:#d5dfed;font-size:12px}.chess3-captures{min-width:100px;padding:7px 10px;border:1px solid #bccae725;border-radius:12px;background:linear-gradient(145deg,#252b3b,#151a25)}.chess3-captures strong{font-size:11px}.chess3-eliminated{opacity:.45;text-decoration:line-through}.chess3-cameras{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;width:min(740px,94vw);margin:8px auto}.chess3-camera{position:relative;width:min(220px,29vw);aspect-ratio:16/9;overflow:hidden;border:1px solid #ffffff36;border-radius:15px;background:linear-gradient(145deg,#20293a,#111721);box-shadow:inset 0 1px #fff2,0 5px 14px #0006}.chess3-camera video{display:none;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}.chess3-camera.has-video video{display:block}.chess3-camera-name{position:absolute;left:8px;bottom:7px;border-radius:999px;padding:4px 8px;background:#07111dcc;color:#fff;font-size:11px;font-weight:750}.chess3-camera[data-player="0"]{outline-color:#55aaff}.chess3-camera[data-player="1"]{outline-color:#ff626d}.chess3-camera[data-player="2"]{outline-color:#53dc8c}.chess3-camera.has-video{outline:2px solid currentColor}.chess3-camera[data-player="0"].has-video{color:#55aaff}.chess3-camera[data-player="1"].has-video{color:#ff626d}.chess3-camera[data-player="2"].has-video{color:#53dc8c}.chess3-camera button{position:absolute;inset:auto 7px 7px auto;padding:6px 8px;font-size:10px}.chess3-camera.has-video button{background:linear-gradient(145deg,#ffc6cc,#fb6875);color:#3d0d17;border-color:#ffb3be}.chess3-camera-wait{position:absolute;inset:0;display:grid;place-items:center;padding:10px;text-align:center;color:#c1ccdc;font-size:11px;pointer-events:none}.chess3-camera.has-video .chess3-camera-wait{display:none}.chess3-test-note{width:min(740px,94vw);margin:5px auto;padding:7px 10px;border:1px solid #ffd40099;border-radius:10px;background:repeating-linear-gradient(135deg,#171717 0 8px,#242424 8px 16px);color:#ffe34a;font-size:10px;font-weight:850;letter-spacing:.1em;text-align:center}@media(max-width:560px){.chess3-frame{width:min(96vw,calc(100dvh - 255px));padding:5px;border-radius:12px}.chess3-camera{width:calc(50% - 6px)}.chess3-cameras{gap:7px}.chess3-heading p{font-size:12px}}@media(prefers-reduced-motion:reduce){.chess3-cell polygon{transition:none}}
  </style>`)

  root.insertAdjacentHTML('afterbegin', `<style>
    .chess3-help-actions{display:inline-flex;align-items:center;gap:8px;flex-wrap:nowrap}
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
    .chess3-rules-order{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 0;font-size:12px;letter-spacing:.06em}.chess3-rules-order b:nth-of-type(1){color:#7ac4ff}.chess3-rules-order b:nth-of-type(2){color:#ff9095}.chess3-rules-order b:nth-of-type(3){color:#76eba5}.chess3-rules-order span{color:#b1c0d6}
    .chess3-rules-pieces{display:grid;gap:0;margin:10px 0;border:1px solid #bbd7ff26;border-radius:12px;overflow:hidden}.chess3-rules-pieces div{display:grid;grid-template-columns:95px 1fr;gap:8px;padding:11px 12px;background:#ffffff05}.chess3-rules-pieces div+div{border-top:1px solid #bbd7ff1a}.chess3-rules-pieces dt{font-weight:750;color:#e4eeff}.chess3-rules-pieces dd{margin:0;color:#c9d5e8;font-size:13px}
    .chess3-rules-footer{padding:0 22px 22px}.chess3-rules-done{width:100%;min-height:44px;padding:10px 16px;border:1px solid #b9ffe8;border-radius:12px;background:linear-gradient(145deg,#c4ffec,#67cfb8);color:#092d2b;font:800 13px system-ui,sans-serif;box-shadow:inset 0 1px #fff9,0 3px 0 #277c71;cursor:pointer}
    @media(max-width:420px){.chess3-rules-header{padding:17px 16px 14px}.chess3-rules-content{padding:2px 16px 18px}.chess3-rules-footer{padding:0 16px 18px}.chess3-rules-pieces div{grid-template-columns:78px 1fr;padding:10px 9px;gap:6px}}
  </style>`)

  if (testMode) {
    const note = document.createElement('div')
    note.className = 'chess3-test-note'
    note.textContent = 'TEST DUMMY · LOCAL SIMULATION · 3 CAMERA TILES · NO INVITES SENT'
    root.insertBefore(note, cameraRow)
  }

  const cameraTiles = roster.map((player, index) => {
    const tile = document.createElement('section'); tile.className = 'chess3-camera'; tile.dataset.player = String(index)
    const video = document.createElement('video'); video.autoplay = true; video.playsInline = true; video.muted = true
    const wait = document.createElement('span'); wait.className = 'chess3-camera-wait'; wait.textContent = testMode ? 'Local camera mirror is off' : (player.id === userId ? 'Your camera is off' : `${player.username} can turn on their camera`)
    const label = document.createElement('span'); label.className = 'chess3-camera-name'; label.textContent = `${THREE_PLAYER_NAMES[index]} · ${player.id === userId && testMode ? 'YOU · TEST' : (testMode ? `TEST · ${player.username}` : player.username)}`
    tile.append(video, wait, label)
    if (player.id === userId) {
      const button = document.createElement('button'); button.type='button'; button.textContent=testMode && testStream ? 'Turn test cameras off' : 'Turn on camera'; button.setAttribute('aria-pressed',String(Boolean(testMode && testStream)))
      button.addEventListener('click', () => toggleCamera(button, tile, video))
      tile.append(button)
    }
    cameraRow.append(tile)
    return { tile, video, wait, player }
  })

  function paintTestCamera(stream) {
    localStream = stream || null
    for (const item of cameraTiles) {
      item.video.srcObject = localStream
      item.tile.classList.toggle('has-video', Boolean(localStream))
      item.wait.textContent = localStream ? '' : 'Local camera mirror is off'
      item.video.style.display = localStream ? 'block' : 'none'
      if (localStream) item.video.play().catch(() => {})
      const button = item.tile.querySelector('button')
      if (button) {
        button.textContent = localStream ? 'Turn test cameras off' : 'Turn test cameras on'
        button.setAttribute('aria-pressed', String(Boolean(localStream)))
      }
    }
  }
  if (testMode && testStream) paintTestCamera(testStream)
  const resetButton = controls.querySelector('.chess3-reset')
  resetButton?.addEventListener('click', () => {
    state = newThreePlayerGame(); selected = null; highlighted = []; draw()
    status.textContent = '96-square board reset to the opening position.'
  })

  function boardViewBox() {
    const points = state.board.cells.flatMap(cell => threePlayerCellPolygon(cell))
    const xs = points.map(point => point[0]), ys = points.map(point => point[1])
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys)
    const pad=.18
    return `${minX-pad} ${minY-pad} ${maxX-minX+2*pad} ${maxY-minY+2*pad}`
  }

  function draw() {
    const cells = state.board.cells.map(cell => {
      const piece = state.pieces.get(cell.id)
      const points = threePlayerCellPolygon(cell)
      const pointList = points.map(point => point.join(',')).join(' ')
      const fill = cell.shade ? '#52647b' : '#edf2f5'
      const moves = highlighted.includes(cell.id)
      const capture = moves && state.pieces.has(cell.id)
      const classes = ['chess3-cell', selected === cell.id ? 'is-selected' : '', moves ? 'is-legal' : '', capture ? 'is-capture' : ''].filter(Boolean).join(' ')
      const title = piece ? `${roster[piece.player].username}: ${LABELS[piece.type]}${state.active[piece.player] ? '' : ' (eliminated)'}` : 'Empty square'
      const center = cell.corners.reduce((sum, point) => [sum[0]+point[0]/4, sum[1]+point[1]/4], [0,0])
      const xy = [center[0]+center[1]*.5, center[1]*Math.sqrt(3)/2]
      const glyph = piece ? `<text class="chess3-piece" x="${xy[0]}" y="${xy[1]}">${THREE_PLAYER_SYMBOLS[piece.type]}</text>` : ''
      return `<g class="${classes}" data-cell-id="${cell.id}" data-player="${piece?.player ?? ''}" role="button" tabindex="0" aria-label="${title}, ${cell.id}"><title>${title}</title><polygon points="${pointList}" fill="${fill}"/>${glyph}</g>`
    }).join('')
    svg.innerHTML = cells
    const turn = state.winner === null ? state.turn : state.winner
    if (state.winner !== null) status.textContent = `${roster[state.winner].username} wins — last king standing.`
    else if (!state.active[myPlayer] && !localPreview) status.textContent = `${roster[myPlayer].username} has been eliminated. ${roster[turn].username} to move.`
    else status.textContent = `${roster[turn].username} to move${localPreview || turn === myPlayer ? ' · your move' : ''}`
    status.dataset.player = String(turn)
    captureBar.replaceChildren(...roster.map((player, index) => {
      const entry = document.createElement('div'); entry.className = 'chess3-captures' + (state.active[index] ? '' : ' chess3-eliminated')
      const count = [...state.pieces.values()].filter(piece => piece.player === index).length
      entry.innerHTML = `<strong style="color:${COLOR_STYLES[index]}">${THREE_PLAYER_NAMES[index]}</strong> · ${player.username}<br>${count} pieces${state.active[index] ? '' : ' · eliminated'}`
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
    if (!applyThreePlayerMove(state, from, to)) return
    selected = null; highlighted = []; draw()
    if (!localPreview) gameChannel?.send({ type:'broadcast', event:'zet', payload:{ variant:'schaken-drie', ply:expectedPly, from, to, actor:roster[myPlayer].id } })
  }

  function receiveMove(message) {
    const payload = message?.payload || {}
    if (payload.variant !== 'schaken-drie' || payload.ply !== state.ply || payload.actor !== roster[state.turn]?.id) return
    if (localPreview || payload.actor === userId) return
    if (applyThreePlayerMove(state, payload.from, payload.to)) { selected = null; highlighted = []; draw() }
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
  draw()

  async function toggleCamera(button, tile, video) {
    if (testMode) {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
        paintTestCamera(null)
        onTestCameraChange?.(null)
        status.textContent = 'All three test camera tiles are off. The board remains playable.'
        return
      }
      button.disabled = true; button.textContent = 'Starting test cameras…'
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false })
        paintTestCamera(localStream)
        onTestCameraChange?.(localStream)
        status.textContent = 'All three camera tiles now mirror your local webcam.'
      } catch (error) {
        button.textContent = 'Turn test cameras on'
        status.textContent = error?.name === 'NotAllowedError' ? 'Camera permission was declined. You can still test the board.' : 'Camera unavailable. Check browser permission and retry.'
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
      button.textContent='Turn on camera'; button.setAttribute('aria-pressed','false')
      gameChannel?.send({ type:'broadcast', event:'schaken-drie-camera', payload:{ actor:userId, active:false } })
      return
    }
    button.disabled = true; button.textContent='Starting camera…'
    try {
      const ice = await import('./ice-config.js?v=1')
      await ice.iceReady
      iceServers = ice.ICE_SERVERS
      localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false })
      video.srcObject = localStream; await video.play().catch(() => {})
      tile.classList.add('has-video')
      button.textContent='Turn camera off'; button.setAttribute('aria-pressed','true')
      await Promise.all(roster.filter(player => player.id !== userId).map(player => addPeerTrack(player.id)))
      gameChannel?.send({ type:'broadcast', event:'schaken-drie-camera', payload:{ actor:userId, active:true } })
    } catch (error) {
      button.textContent='Turn on camera'
      status.textContent = error?.name === 'NotAllowedError' ? 'Camera permission was not granted. You can keep playing.' : 'The camera could not start. Check its browser permission and try again.'
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
    if (tile && !payload.active && !tile.video.srcObject) tile.wait.textContent = `${tile.player.username} can turn on their camera`
    if (tile && payload.active && !tile.video.srcObject) tile.wait.textContent = `Connecting to ${tile.player.username}…`
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
      if (rulesDialog.open) rulesDialog.close()
      if (!preserveCamera) localStream?.getTracks().forEach(track => track.stop())
      peers.forEach(pc => pc.close())
      peers.clear(); pendingIce.clear()
      root.replaceChildren()
      root.classList.remove('chess3-layout')
      document.getElementById('spelOverlay')?.classList.remove('chess3-board-layout')
    }
  }
  return controller
}
