const STYLE_ID = 'sch-slam-effect-styles'

const CRACKS = `
  <path class="sch-slam-crack-path" pathLength="1" d="M52 57 47 49 52 43 49 36 52 28"/>
  <path class="sch-slam-crack-path" pathLength="1" d="M51 45 61 41 64 34 72 30"/>
  <path class="sch-slam-crack-path" pathLength="1" d="M48 51 39 50 35 43 27 40"/>
  <path class="sch-slam-crack-path" pathLength="1" d="M48 54 40 60 37 69 29 74"/>
  <path class="sch-slam-crack-path" pathLength="1" d="M51 57 48 67 42 72 42 82"/>
  <path class="sch-slam-crack-path" pathLength="1" d="M55 57 63 63 66 72 74 76"/>
  <path class="sch-slam-crack-path" pathLength="1" d="M56 52 67 50 72 44 81 43"/>
  <path class="sch-slam-crack-path" pathLength="1" d="M56 58 61 68 60 78 66 85"/>
`

function voegStijlToe() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .sch-slam-stage{position:relative;isolation:isolate}
    .sch-slam-overlay{position:absolute;inset:0;z-index:20;overflow:hidden;pointer-events:none;visibility:hidden}
    .sch-slam-stage.sch-slam-active .sch-slam-overlay,.sch-slam-stage.sch-slam-cracked .sch-slam-overlay,.sch-slam-stage.sch-slam-repairing .sch-slam-overlay{visibility:visible}
    .sch-slam-cracks{overflow:visible;pointer-events:none;opacity:0}
    .sch-slam-html-cracks{position:absolute;inset:0;z-index:0;width:100%;height:100%}
    .sch-slam-svg-cracks{display:block}
    .sch-slam-crack-path{fill:none;stroke:#080a10;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 1px 1px #fff8)}
    .sch-slam-stage.sch-slam-active.sch-slam-cracked .sch-slam-cracks{opacity:1}
    .sch-slam-stage.sch-slam-active .sch-slam-crack-path{animation:sch-slam-crack .58s cubic-bezier(.18,.72,.32,1) both}
    .sch-slam-stage.sch-slam-cracked .sch-slam-cracks{opacity:1}
    .sch-slam-stage.sch-slam-cracked .sch-slam-crack-path{stroke-dashoffset:0}
    .sch-slam-stage.sch-slam-repairing .sch-slam-crack-path{animation:sch-slam-repair .56s ease-in both}
    .sch-slam-fist{position:absolute;z-index:3;left:54%;top:52%;display:block;font:clamp(52px,15vw,112px)/1 system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif;filter:drop-shadow(0 9px 6px #000b);opacity:0;transform-origin:50% 85%;will-change:transform,opacity}
    .sch-slam-stage.sch-slam-hitting .sch-slam-fist{animation:sch-slam-fist .82s cubic-bezier(.2,.76,.34,1) both}
    .sch-slam-stage.sch-slam-repairing .sch-slam-fist{display:none!important;animation:none!important;opacity:0!important;visibility:hidden!important}
    .sch-slam-wand{position:absolute;z-index:3;left:24%;top:55%;display:block;width:clamp(76px,20vw,144px);height:auto;overflow:visible;filter:drop-shadow(0 7px 5px #000b);opacity:0;transform-origin:75% 90%;will-change:transform,opacity}
    .sch-slam-wand-shaft-outline{fill:#29133f;stroke:#29133f;stroke-width:2;stroke-linejoin:round}
    .sch-slam-wand-shaft{fill:url(#sch-slam-wand-metal);stroke:#603717;stroke-width:1;stroke-linejoin:round}
    .sch-slam-wand-grip{fill:none;stroke:#fff0bd;stroke-width:2.5;stroke-linecap:round;opacity:.9}
    .sch-slam-wand-tip{fill:#fff3a0;stroke:#633b18;stroke-width:2.5;stroke-linejoin:round;filter:drop-shadow(0 0 5px #fff1a0)}
    .sch-slam-wand-glint{fill:#fff;stroke:#fff8c9;stroke-width:1;filter:drop-shadow(0 0 4px #fff4a8)}
    .sch-slam-stage.sch-slam-repairing .sch-slam-wand{animation:sch-slam-wand 1.12s cubic-bezier(.2,.76,.34,1) both}
    .sch-slam-impact{position:absolute;z-index:2;left:52%;top:57%;width:8%;aspect-ratio:1;border:3px solid #ffe2a4;border-radius:50%;opacity:0;transform:translate(-50%,-50%) scale(.2);box-shadow:0 0 18px #ffd36b, inset 0 0 12px #fff8}
    .sch-slam-stage.sch-slam-active .sch-slam-impact{animation:sch-slam-ripple .52s .35s ease-out both}
    .sch-slam-magic{position:absolute;z-index:1;inset:0;overflow:hidden;opacity:0;pointer-events:none}
    .sch-slam-stage.sch-slam-repairing .sch-slam-magic{opacity:1}
    .sch-slam-smoke{position:absolute;left:20%;top:27%;width:60%;height:54%;border-radius:50%;background:radial-gradient(ellipse at 50% 58%,#d7f7ff70 0,#b8c6ff55 25%,#e9d4ff32 48%,transparent 73%);filter:blur(12px);opacity:0}
    .sch-slam-stage.sch-slam-repairing .sch-slam-smoke{animation:sch-slam-smoke 1.16s ease-out both}
    .sch-slam-sparkle{position:absolute;left:var(--sx);top:var(--sy);width:var(--size,6px);height:var(--size,6px);border-radius:50%;background:radial-gradient(circle,#fff 0 18%,#fff5bd 38%,#87f5ff 68%,transparent 100%);box-shadow:0 0 8px #c8ffff,0 0 15px #b89cff;opacity:0}
    .sch-slam-stage.sch-slam-repairing .sch-slam-sparkle{animation:sch-slam-sparkle 1.12s var(--delay,0ms) ease-out both}
    .sch-slam-wobble{transform-box:fill-box;transform-origin:center;animation:sch-slam-wobble 1.18s var(--sch-slam-delay,0ms) cubic-bezier(.18,.7,.22,1) both!important}
    .sch-slam-board{transform-box:fill-box;transform-origin:center;animation:sch-slam-board 420ms cubic-bezier(.18,.7,.22,1) both!important}
    @keyframes sch-slam-fist{
      0%{opacity:0;transform:translate(44%,-158%) rotate(24deg) scale(1.08)}
      20%{opacity:1}
      48%{opacity:1;transform:translate(-48%,-47%) rotate(-7deg) scale(.82)}
      60%{opacity:1;transform:translate(-50%,-58%) rotate(3deg) scale(1.02)}
      75%{opacity:1;transform:translate(-50%,-112%) rotate(-2deg) scale(.92)}
      100%{opacity:0;transform:translate(-45%,-210%) rotate(9deg) scale(.7)}
    }
    @keyframes sch-slam-wand{
      0%{opacity:0;transform:translate(55%,-125%) rotate(42deg) scale(.72)}
      18%{opacity:1}
      44%{opacity:1;transform:translate(-14%,-30%) rotate(-12deg) scale(1)}
      62%{opacity:1;transform:translate(-32%,-72%) rotate(18deg) scale(.96)}
      100%{opacity:0;transform:translate(-64%,-158%) rotate(-22deg) scale(.72)}
    }
    @keyframes sch-slam-crack{0%{stroke-dashoffset:1}100%{stroke-dashoffset:0}}
    @keyframes sch-slam-repair{0%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:1;opacity:0}}
    @keyframes sch-slam-ripple{0%{opacity:.9;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(7)}}
    @keyframes sch-slam-smoke{0%{opacity:0;transform:translateY(12px) scale(.5)}25%{opacity:.78}100%{opacity:0;transform:translateY(-38px) scale(1.5)}}
    @keyframes sch-slam-sparkle{0%{opacity:0;transform:translate(-50%,-50%) scale(.1)}18%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.2)}}
    @keyframes sch-slam-wobble{
      0%,100%{transform:translate(0,0) rotate(0)}
      13%{transform:translate(2px,-2px) rotate(var(--sch-slam-angle,8deg))}
      27%{transform:translate(-2px,1px) rotate(var(--sch-slam-rebound,-5deg))}
      43%{transform:translate(1px,0) rotate(var(--sch-slam-settle,2deg))}
      59%{transform:translate(-1px,0) rotate(var(--sch-slam-rebound,-5deg))}
      76%{transform:translate(1px,0) rotate(var(--sch-slam-settle,2deg))}
      90%{transform:translate(0,0) rotate(var(--sch-slam-finish,-1deg))}
    }
    @keyframes sch-slam-board{
      0%,100%{transform:translate(0,0)}
      18%{transform:translate(1px,2px)}
      38%{transform:translate(-2px,-1px)}
      59%{transform:translate(1px,1px)}
      78%{transform:translate(-1px,0)}
    }
    @media(prefers-reduced-motion:reduce){
      .sch-slam-wobble,.sch-slam-board{animation:none!important}
      .sch-slam-stage.sch-slam-hitting .sch-slam-fist{animation:none;opacity:1;transform:translate(-50%,-50%)}
      .sch-slam-stage.sch-slam-repairing .sch-slam-wand{animation:none;opacity:1;transform:translate(-50%,-50%)}
      .sch-slam-stage.sch-slam-active .sch-slam-crack-path{animation:none;stroke-dashoffset:0}
      .sch-slam-stage.sch-slam-repairing .sch-slam-smoke,.sch-slam-stage.sch-slam-repairing .sch-slam-sparkle{animation:none;opacity:.8}
      .sch-slam-stage.sch-slam-active .sch-slam-impact{animation:none;opacity:.7;transform:translate(-50%,-50%)}
      .sch-slam-stage.sch-slam-repairing .sch-slam-crack-path{animation:none;opacity:0}
    }
  `
  document.head.append(style)
}

/** Four quick board taps or typing "kak" strikes the board and syncs the effect to opponents. */
export function maakSchaakTafelklap({ stage, board = stage, pieces = '.sch-stuk', channel = null, onImpact = null } = {}) {
  if (!stage || !board) return { destroy() {} }
  voegStijlToe()

  stage.classList.add('sch-slam-stage')
  const isSvgBoard = board.namespaceURI === 'http://www.w3.org/2000/svg'
  const crackLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  crackLayer.classList.add('sch-slam-cracks', isSvgBoard ? 'sch-slam-svg-cracks' : 'sch-slam-html-cracks')
  crackLayer.setAttribute('aria-hidden', 'true')
  crackLayer.setAttribute('focusable', 'false')
  crackLayer.setAttribute('viewBox', '0 0 100 100')
  crackLayer.setAttribute('preserveAspectRatio', 'none')
  crackLayer.innerHTML = CRACKS
  if (isSvgBoard) {
    const [x, y, width, height] = (board.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
    if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
      crackLayer.setAttribute('x', String(x)); crackLayer.setAttribute('y', String(y))
      crackLayer.setAttribute('width', String(width)); crackLayer.setAttribute('height', String(height))
    }
  }

  const overlay = document.createElement('div')
  overlay.className = 'sch-slam-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  const sparkles = Array.from({ length:14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2
    const radius = 13 + (index % 3) * 5
    const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius
    const sx = 50 + Math.cos(angle) * 7, sy = 54 + Math.sin(angle) * 7
    return `<i class="sch-slam-sparkle" style="--sx:${sx}%;--sy:${sy}%;--dx:${dx}px;--dy:${dy}px;--delay:${(index % 5) * 24}ms;--size:${index % 4 === 0 ? 8 : 5}px"></i>`
  }).join('')
  overlay.innerHTML = `<span class="sch-slam-impact"></span><span class="sch-slam-magic"><span class="sch-slam-smoke"></span>${sparkles}</span><span class="sch-slam-fist">👊</span><svg class="sch-slam-wand" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><linearGradient id="sch-slam-wand-metal" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#593317"/><stop offset=".3" stop-color="#d89c48"/><stop offset=".5" stop-color="#fff4cf"/><stop offset=".72" stop-color="#f6d28a"/><stop offset="1" stop-color="#6a3d1c"/></linearGradient></defs><path class="sch-slam-wand-shaft-outline" d="M21 77 76 22Q80 19 83 22L84 25 25 85Q20 90 16 89Q12 88 12 84Q12 81 16 79Z"/><path class="sch-slam-wand-shaft" d="M21 78 76 23Q79 21 81 23L82 25 25 84Q20 89 16 88Q13 87 13 84Q13 82 17 80Z"/><path class="sch-slam-wand-grip" d="m20 78 6 6"/><path class="sch-slam-wand-tip" d="m76 25 4-9 4 9 9 3-9 3-4 9-4-9-9-3z"/><path class="sch-slam-wand-glint" d="m83 5 1 3L87 9l-3 1-1 3-1-3-3-1 3-1zM58 21l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>`
  stage.append(overlay)

  let taps = []
  let heldPointers = new Map()
  let keySequence = ''
  let keySequenceAt = 0
  let animationTimer = 0
  let repairTimer = 0
  let lockUntil = 0
  let destroyed = false
  const seenEvents = new Set()

  function attachCracks() {
    if (destroyed || crackLayer.isConnected) return
    if (!isSvgBoard) { board.append(crackLayer); return }
    const anchor = board.querySelector('.chess3-turn-spotlight, .chess3-cell')
    if (anchor) board.insertBefore(crackLayer, anchor)
  }
  const boardObserver = new MutationObserver(attachCracks)
  boardObserver.observe(board, { childList:true })
  attachCracks()

  function rememberEvent(id) {
    seenEvents.add(id)
    if (seenEvents.size > 64) seenEvents.delete(seenEvents.values().next().value)
  }

  function broadcastCracks(cracked) {
    if (!channel?.send) return
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    rememberEvent(id)
    try {
      const result = channel.send({ type:'broadcast', event:'schaak-tafelklap', payload:{ version:1, id, cracked } })
      result?.catch?.(() => {})
    } catch {}
  }

  function clearPieceMotion() {
    board.querySelectorAll('.sch-slam-wobble').forEach(piece => {
      piece.classList.remove('sch-slam-wobble')
      piece.style.removeProperty('--sch-slam-angle')
      piece.style.removeProperty('--sch-slam-rebound')
      piece.style.removeProperty('--sch-slam-settle')
      piece.style.removeProperty('--sch-slam-finish')
      piece.style.removeProperty('--sch-slam-delay')
    })
    board.classList.remove('sch-slam-board')
  }

  function strike({ remote = false, cracked = null } = {}) {
    if (destroyed || (!remote && performance.now() < lockUntil)) return
    if (!remote) lockUntil = performance.now() + 850
    const wasCracked = stage.classList.contains('sch-slam-cracked')
    const nextCracked = typeof cracked === 'boolean' ? cracked : !wasCracked
    if (!remote) broadcastCracks(nextCracked)
    clearTimeout(animationTimer)
    clearTimeout(repairTimer)
    clearPieceMotion()
    stage.classList.remove('sch-slam-active', 'sch-slam-repairing', 'sch-slam-hitting')
    void overlay.offsetWidth
    if (nextCracked) stage.classList.add('sch-slam-cracked')
    else if (!wasCracked) stage.classList.remove('sch-slam-cracked')
    stage.classList.add('sch-slam-active')
    if (!nextCracked) stage.classList.add('sch-slam-repairing')
    else stage.classList.add('sch-slam-hitting')
    if (nextCracked) {
      board.classList.add('sch-slam-board')
      board.querySelectorAll(pieces).forEach((piece, index) => {
        const angle = (index % 2 ? -1 : 1) * (5 + (index % 5) * 1.6)
        piece.style.setProperty('--sch-slam-angle', `${angle}deg`)
        piece.style.setProperty('--sch-slam-rebound', `${-angle * .58}deg`)
        piece.style.setProperty('--sch-slam-settle', `${angle * .27}deg`)
        piece.style.setProperty('--sch-slam-finish', `${-angle * .12}deg`)
        piece.style.setProperty('--sch-slam-delay', `${Math.min(index * 5, 120)}ms`)
        piece.classList.add('sch-slam-wobble')
      })
    }
    try { onImpact?.({ cracked:nextCracked, remote }) } catch {}
    animationTimer = setTimeout(() => {
      stage.classList.remove('sch-slam-active', 'sch-slam-hitting')
      clearPieceMotion()
      animationTimer = 0
    }, 1320)
    if (!nextCracked) {
      repairTimer = setTimeout(() => {
        stage.classList.remove('sch-slam-cracked', 'sch-slam-repairing')
        repairTimer = 0
      }, 1220)
    }
  }

  channel?.on?.('broadcast', { event:'schaak-tafelklap' }, message => {
    if (destroyed) return
    const payload = message?.payload || {}
    if (payload.version !== 1 || typeof payload.id !== 'string' || typeof payload.cracked !== 'boolean' || seenEvents.has(payload.id)) return
    rememberEvent(payload.id)
    strike({ remote:true, cracked:payload.cracked })
  })

  function countTap(time) {
    taps = taps.filter(previous => time - previous <= 1250)
    if (taps.length && time - taps[taps.length - 1] > 420) taps = []
    taps.push(time)
    if (taps.length >= 4) { taps = []; strike() }
  }

  function onPointerDown(event) {
    if (event.pointerType !== 'touch') return
    heldPointers.set(event.pointerId, { time:performance.now(), x:event.clientX, y:event.clientY })
  }
  function onPointerUp(event) {
    const started = heldPointers.get(event.pointerId)
    heldPointers.delete(event.pointerId)
    if (!started) return
    const duration = performance.now() - started.time
    const distance = Math.hypot(event.clientX - started.x, event.clientY - started.y)
    if (duration <= 240 && distance <= 20) countTap(performance.now())
    else taps = []
  }
  function onPointerCancel(event) { heldPointers.delete(event.pointerId); taps = [] }
  function onKeyDown(event) {
    if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target
    if (target?.isContentEditable || target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]')) {
      keySequence = ''
      return
    }
    const key = String(event.key || '').toLowerCase()
    if (!/^[a-z]$/.test(key)) { keySequence = ''; return }
    const time = performance.now()
    if (time - keySequenceAt > 1250) keySequence = ''
    keySequenceAt = time
    keySequence = (keySequence + key).slice(-3)
    if (keySequence === 'kak') { keySequence = ''; strike() }
  }

  board.addEventListener('pointerdown', onPointerDown, { passive:true })
  board.addEventListener('pointerup', onPointerUp, { passive:true })
  board.addEventListener('pointercancel', onPointerCancel, { passive:true })
  document.addEventListener('keydown', onKeyDown)

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      clearTimeout(animationTimer)
      clearTimeout(repairTimer)
      board.removeEventListener('pointerdown', onPointerDown)
      board.removeEventListener('pointerup', onPointerUp)
      board.removeEventListener('pointercancel', onPointerCancel)
      document.removeEventListener('keydown', onKeyDown)
      boardObserver.disconnect()
      clearPieceMotion()
      stage.classList.remove('sch-slam-stage', 'sch-slam-active', 'sch-slam-cracked', 'sch-slam-repairing', 'sch-slam-hitting')
      crackLayer.remove()
      overlay.remove()
    }
  }
}
