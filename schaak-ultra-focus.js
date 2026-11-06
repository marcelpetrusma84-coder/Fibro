const MOBILE_QUERY = '(max-width:760px), (pointer:coarse) and (max-width:1024px)'
const clampStage = value => Math.max(0, Math.min(4, Math.trunc(Number(value) || 0)))

// One complete two-finger gesture advances one step. Layout is expressed only
// through temporary classes: evaluation, audio and assistance preferences stay
// untouched and continue updating while their panels are out of view.
export function maakUltraFocus({ root, board, host = root, restoreButton = null, win = globalThis.window, media = win?.matchMedia?.(MOBILE_QUERY), now = () => win?.performance?.now?.() ?? Date.now(), onChange } = {}) {
  if (!root || !board) throw new TypeError('Ultra focus needs a board and game root.')
  const previous = {
    rootClass:root.classList.contains('sch-ultra-focus-active'),
    hostClass:host.classList.contains('sch-ultra-focus-host'),
    stage:root.getAttribute('data-ultra-focus'),
    tabIndex:board.getAttribute('tabindex'), shortcuts:board.getAttribute('aria-keyshortcuts'),
    restoreHidden:restoreButton?.hidden,
  }
  const touches = new Map(), captured = new Set(), cleanups = []
  let stage = 0, active = false, destroyed = false, initialDistance = 0, multi = false, stepped = false, cancelled = false, blockedUntil = 0
  function listen(target, type, handler, options) {
    if (!target?.addEventListener) return
    target.addEventListener(type, handler, options)
    cleanups.push(() => target.removeEventListener(type, handler, options))
  }
  function render() {
    root.classList.toggle('sch-ultra-focus-active', active)
    host.classList.toggle('sch-ultra-focus-host', active && stage > 0)
    if (active) {
      root.setAttribute('data-ultra-focus', String(stage))
      board.setAttribute('tabindex', '0')
      board.setAttribute('aria-keyshortcuts', '+ - Escape')
    } else {
      restoreAttribute(root, 'data-ultra-focus', previous.stage)
      restoreAttribute(board, 'tabindex', previous.tabIndex)
      restoreAttribute(board, 'aria-keyshortcuts', previous.shortcuts)
    }
    if (restoreButton) restoreButton.hidden = !active || stage !== 4
    try { onChange?.({ active, stage }) } catch { /* decoration must not interrupt play */ }
  }
  function restoreAttribute(node, name, value) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value) }
  function setStage(value) {
    if (!active || destroyed) return false
    const next = clampStage(value)
    if (next === stage) return false
    stage = next; render(); return true
  }
  function distance() {
    const [a,b] = touches.values()
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }
  function releaseCaptures() {
    const ids = [...captured]; captured.clear()
    for (const id of ids) { try { if (board.hasPointerCapture?.(id)) board.releasePointerCapture(id) } catch { /* already released by the browser */ } }
  }
  function clearGesture() {
    if (multi) blockedUntil = now() + 400
    touches.clear(); multi = stepped = cancelled = false; initialDistance = 0
    releaseCaptures()
  }
  function reconcile() {
    clearGesture()
    active = !destroyed && media?.matches === true
    if (!active) stage = 0
    render()
  }
  function pointerDown(event) {
    if (!active || destroyed || event.pointerType !== 'touch') return
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
    touches.set(event.pointerId, { x:event.clientX, y:event.clientY })
    if (touches.size < 2) return
    event.preventDefault()
    if (!multi) { multi = true; stepped = false; cancelled = false; initialDistance = distance() }
    if (touches.size > 2) cancelled = true
    // Capture only after the second finger. Capturing the first finger on the
    // board would retarget an ordinary square tap and break normal chess input.
    for (const id of touches.keys()) {
      try { board.setPointerCapture?.(id); captured.add(id) } catch { /* window listeners still finish the gesture */ }
    }
  }
  function pointerMove(event) {
    if (!active || !touches.has(event.pointerId)) return
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
    touches.set(event.pointerId, { x:event.clientX, y:event.clientY })
    if (!multi) return
    event.preventDefault()
    if (stepped || cancelled || touches.size !== 2 || initialDistance < 12) return
    const delta = distance() - initialDistance
    // A modest 14px / 10% spread already feels like an intentional pinch on
    // a phone; the previous 24px / 16% demanded an unnecessarily large move.
    if (Math.abs(delta) < Math.max(14, initialDistance * .1)) return
    stepped = true
    setStage(stage + Math.sign(delta))
  }
  function pointerEnd(event) {
    if (!touches.has(event.pointerId)) return
    touches.delete(event.pointerId); captured.delete(event.pointerId)
    if (multi && touches.size) cancelled = true
    if (!touches.size) clearGesture()
  }
  function lostCapture(event) {
    // Touch starts with implicit capture on the square. Transferring that
    // capture to the stable board also emits a bubbling loss on the old square.
    if (event.target !== board || !touches.has(event.pointerId) || board.hasPointerCapture?.(event.pointerId)) return
    clearGesture()
  }
  function pointerCancel(event) { if (touches.has(event.pointerId)) { cancelled = true; pointerEnd(event) } }
  function click(event) {
    if (!shouldIgnoreClick()) return
    event.preventDefault(); event.stopImmediatePropagation()
  }
  function shouldIgnoreClick() { return multi || now() < blockedUntil }
  function keyDown(event) {
    if (!active || event.target !== board || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === '+' || event.key === '=') setStage(stage + 1)
    else if (event.key === '-' || event.key === '_') setStage(stage - 1)
    else if (event.key === 'Escape') setStage(0)
    else return
    event.preventDefault()
  }
  listen(board, 'pointerdown', pointerDown, { passive:false })
  listen(win, 'pointermove', pointerMove, { passive:false })
  listen(win, 'pointerup', pointerEnd)
  listen(win, 'pointercancel', pointerCancel)
  listen(board, 'lostpointercapture', lostCapture)
  listen(board, 'click', click, { capture:true })
  listen(board, 'keydown', keyDown)
  listen(win, 'blur', clearGesture)
  if (media?.addEventListener) listen(media, 'change', reconcile)
  else if (media?.addListener) { media.addListener(reconcile); cleanups.push(() => media.removeListener(reconcile)) }
  listen(restoreButton, 'click', () => { setStage(0); board.focus?.({ preventScroll:true }) })
  reconcile()
  return {
    get active() { return active }, get stage() { return stage }, setStage, shouldIgnoreClick,
    destroy() {
      if (destroyed) return
      destroyed = true; active = false; clearGesture()
      while (cleanups.length) cleanups.pop()()
      root.classList.toggle('sch-ultra-focus-active', previous.rootClass)
      host.classList.toggle('sch-ultra-focus-host', previous.hostClass)
      restoreAttribute(root, 'data-ultra-focus', previous.stage)
      restoreAttribute(board, 'tabindex', previous.tabIndex)
      restoreAttribute(board, 'aria-keyshortcuts', previous.shortcuts)
      if (restoreButton) restoreButton.hidden = previous.restoreHidden
    },
  }
}
