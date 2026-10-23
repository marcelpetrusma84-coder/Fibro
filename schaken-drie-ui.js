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

export function start({ gameChannel = null, players = [], userId = null, localPreview = false, inviteThird = null } = {}) {
  const root = document.getElementById('spelInhoud')
  if (!root) throw new Error('The chess game surface is missing.')
  if (players.length !== 3) throw new TypeError('Three player identities are required.')
  const roster = players.map((player, index) => typeof player === 'string'
    ? { id:player, username:THREE_PLAYER_NAMES[index] }
    : { id:String(player.id), username:String(player.username || THREE_PLAYER_NAMES[index]) })
  const myPlayer = roster.findIndex(player => player.id === userId)
  if (!localPreview && myPlayer < 0) throw new TypeError('Your account is not in the chess roster.')
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
  cameraRow.hidden = localPreview
  const controls = document.createElement('div')
  controls.className = 'chess3-controls'
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
  heading.innerHTML = '<span class="chess3-kicker">FIBRO · THREE PLAYER</span><h2>Three-player chess</h2><p>Capture a king to eliminate that player. The last king standing wins.</p>'
  controls.innerHTML = '<span class="chess3-turns" aria-label="Turn order"><b>BLUE</b><i>→</i><b>RED</b><i>→</i><b>GREEN</b></span>'
  if (localPreview && inviteThird) {
    const inviteButton = document.createElement('button')
    inviteButton.type = 'button'; inviteButton.className = 'chess3-invite'; inviteButton.textContent = 'Invite a third player'
    inviteButton.addEventListener('click', () => inviteThird())
    controls.append(inviteButton)
  }
  root.replaceChildren()
  root.append(heading, cameraRow, controls, status, boardWrap, captureBar)
  root.insertAdjacentHTML('afterbegin', `<style>
    .chess3-shell{color:#f8fbff}.chess3-heading{text-align:center;margin:0 auto 12px;max-width:620px}.chess3-heading h2{margin:3px 0;font-size:clamp(20px,4vw,28px);letter-spacing:-.04em}.chess3-heading p{margin:3px 0;color:#b9c6d6;font-size:13px}.chess3-kicker{color:#81e6cb;font-size:10px;font-weight:850;letter-spacing:.18em}.chess3-status{min-height:24px;margin:6px 0 10px;text-align:center;color:#fff;font-weight:750}.chess3-status[data-player="0"]{color:#7ac4ff}.chess3-status[data-player="1"]{color:#ff9095}.chess3-status[data-player="2"]{color:#76eba5}.chess3-controls{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin:8px 0 12px}.chess3-turns{display:flex;align-items:center;gap:9px;border:1px solid #bccae738;border-radius:999px;padding:8px 13px;background:linear-gradient(145deg,#20293a,#141a27);box-shadow:inset 0 1px #ffffff17,0 4px 12px #0005;font-size:10px;letter-spacing:.12em}.chess3-turns b:nth-of-type(1){color:#7ac4ff}.chess3-turns b:nth-of-type(2){color:#ff9095}.chess3-turns b:nth-of-type(3){color:#76eba5}.chess3-turns i{color:#93a1b3;font-style:normal}.chess3-invite,.chess3-camera button{border:1px solid #82ead088;border-radius:12px;background:linear-gradient(145deg,#baffeb,#58cdb7 60%,#37a994);color:#092a2b;font:inherit;font-size:12px;font-weight:800;padding:9px 13px;cursor:pointer;box-shadow:inset 0 1px #fff9,0 4px 0 #267c70,0 8px 16px #0004}.chess3-frame{width:min(740px,94vw,calc(100dvh - 210px));margin:auto;padding:9px;border:1px solid #d8e9ff70;border-radius:18px;background:linear-gradient(145deg,#d8e4f3,#5a6a7e 55%,#243143);box-shadow:inset 0 1px #fff,0 8px 0 #192331,0 12px 28px #0009}.chess3-board{display:block;width:100%;height:auto;overflow:visible;touch-action:manipulation}.chess3-cell polygon{stroke:#18223570;stroke-width:.035;transition:filter .12s ease}.chess3-cell[role="button"]{cursor:pointer;outline:none}.chess3-cell[role="button"]:focus-visible polygon{stroke:#7bf0d9;stroke-width:.13}.chess3-cell .chess3-piece{font-family:"Noto Sans Symbols 2","Segoe UI Symbol",serif;font-size:.78px;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:#101722;stroke-width:.035;stroke-linejoin:round;filter:drop-shadow(0 .045px .055px #000b);pointer-events:none}.chess3-cell[data-player="0"] .chess3-piece{fill:#55aaff}.chess3-cell[data-player="1"] .chess3-piece{fill:#ff626d}.chess3-cell[data-player="2"] .chess3-piece{fill:#53dc8c}.chess3-cell.is-selected polygon{stroke:#ffe68d;stroke-width:.14;filter:brightness(1.25)}.chess3-cell.is-legal polygon{stroke:#b5ffdb;stroke-width:.10;filter:brightness(1.18)}.chess3-cell.is-capture polygon{stroke:#ff8a8f;stroke-width:.13}.chess3-capturebar{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin:12px auto;color:#d5dfed;font-size:12px}.chess3-captures{min-width:100px;padding:7px 10px;border:1px solid #bccae725;border-radius:12px;background:linear-gradient(145deg,#252b3b,#151a25)}.chess3-captures strong{font-size:11px}.chess3-eliminated{opacity:.45;text-decoration:line-through}.chess3-cameras{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;width:min(740px,94vw);margin:8px auto}.chess3-camera{position:relative;width:min(220px,29vw);aspect-ratio:16/9;overflow:hidden;border:1px solid #ffffff36;border-radius:15px;background:linear-gradient(145deg,#20293a,#111721);box-shadow:inset 0 1px #fff2,0 5px 14px #0006}.chess3-camera video{display:none;width:100%;height:100%;object-fit:cover}.chess3-camera.has-video video{display:block}.chess3-camera-name{position:absolute;left:8px;bottom:7px;border-radius:999px;padding:4px 8px;background:#07111dcc;color:#fff;font-size:11px;font-weight:750}.chess3-camera[data-player="0"]{outline-color:#55aaff}.chess3-camera[data-player="1"]{outline-color:#ff626d}.chess3-camera[data-player="2"]{outline-color:#53dc8c}.chess3-camera.has-video{outline:2px solid currentColor}.chess3-camera[data-player="0"].has-video{color:#55aaff}.chess3-camera[data-player="1"].has-video{color:#ff626d}.chess3-camera[data-player="2"].has-video{color:#53dc8c}.chess3-camera button{position:absolute;inset:auto 7px 7px auto;padding:6px 8px;font-size:10px}.chess3-camera.has-video button{background:linear-gradient(145deg,#ffc6cc,#fb6875);color:#3d0d17;border-color:#ffb3be}.chess3-camera-wait{position:absolute;inset:0;display:grid;place-items:center;padding:10px;text-align:center;color:#c1ccdc;font-size:11px;pointer-events:none}.chess3-camera.has-video .chess3-camera-wait{display:none}@media(max-width:560px){.chess3-frame{width:min(96vw,calc(100dvh - 235px));padding:5px;border-radius:12px}.chess3-camera{width:calc(50% - 6px)}.chess3-cameras{gap:7px}.chess3-heading p{font-size:12px}}@media(prefers-reduced-motion:reduce){.chess3-cell polygon{transition:none}}
  </style>`)

  const cameraTiles = roster.map((player, index) => {
    const tile = document.createElement('section'); tile.className = 'chess3-camera'; tile.dataset.player = String(index)
    const video = document.createElement('video'); video.autoplay = true; video.playsInline = true; video.muted = true
    const wait = document.createElement('span'); wait.className = 'chess3-camera-wait'; wait.textContent = player.id === userId ? 'Your camera is off' : `${player.username} can turn on their camera`
    const label = document.createElement('span'); label.className = 'chess3-camera-name'; label.textContent = `${THREE_PLAYER_NAMES[index]} · ${player.username}`
    tile.append(video, wait, label)
    if (player.id === userId) {
      const button = document.createElement('button'); button.type='button'; button.textContent='Turn on camera'; button.setAttribute('aria-pressed','false')
      button.addEventListener('click', () => toggleCamera(button, tile, video))
      tile.append(button)
    }
    cameraRow.append(tile)
    return { tile, video, wait, player }
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
      const points = threePlayerCellPolygon(cell).map(point => point.join(',')).join(' ')
      const fill = cell.shade ? '#52647b' : '#edf2f5'
      const moves = highlighted.includes(cell.id)
      const capture = moves && state.pieces.has(cell.id)
      const classes = ['chess3-cell', selected === cell.id ? 'is-selected' : '', moves ? 'is-legal' : '', capture ? 'is-capture' : ''].filter(Boolean).join(' ')
      const title = piece ? `${roster[piece.player].username}: ${LABELS[piece.type]}${state.active[piece.player] ? '' : ' (eliminated)'}` : 'Empty square'
      const center = cell.corners.reduce((sum, point) => [sum[0]+point[0]/4, sum[1]+point[1]/4], [0,0])
      const xy = [center[0]+center[1]*.5, center[1]*Math.sqrt(3)/2]
      const glyph = piece ? `<text class="chess3-piece" x="${xy[0]}" y="${xy[1]}">${THREE_PLAYER_SYMBOLS[piece.type]}</text>` : ''
      return `<g class="${classes}" data-cell-id="${cell.id}" data-player="${piece?.player ?? ''}" role="button" tabindex="0" aria-label="${title}, ${cell.id}"><title>${title}</title><polygon points="${points.map(p=>`${p[0]},${p[1]}`).join(' ')}" fill="${fill}"/>${glyph}</g>`
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
    state,
    destroy() {
      if (destroyed) return
      destroyed = true
      localStream?.getTracks().forEach(track => track.stop())
      peers.forEach(pc => pc.close())
      peers.clear(); pendingIce.clear()
      root.replaceChildren()
    }
  }
  return controller
}
