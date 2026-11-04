const HOLD_MS = 2000
const MOVE_TOLERANCE = 12

// The board owns the gesture, never a square that can disappear in a redraw.
// Board capture is delayed until activation so ordinary taps still reach the
// square's native click handler. No game state or route preference lives here.
export function maakPaardHold({ board, getCandidate, canHold = () => false, onHold, onState,
  win = board?.ownerDocument?.defaultView || globalThis.window,
  doc = board?.ownerDocument || globalThis.document,
  setTimer = win?.setTimeout?.bind(win) || globalThis.setTimeout,
  clearTimer = win?.clearTimeout?.bind(win) || globalThis.clearTimeout,
  now = () => win?.performance?.now?.() ?? Date.now(),
} = {}) {
  if (!board || typeof getCandidate !== 'function') throw new TypeError('A knight hold needs a board and candidate reader.')
  const cleanups = [], contacts = new Set(), blockedPointers = new Set()
  let press = null, timer = null, epoch = 0, destroyed = false, blockedUntil = 0, recoverFreshInput = false
  function listen(target, type, handler, options) {
    if (!target?.addEventListener) return
    target.addEventListener(type, handler, options)
    cleanups.push(() => target.removeEventListener(type, handler, options))
  }
  function candidateFor(target) {
    if (!target || (board.contains && !board.contains(target))) return null
    let value
    try { value = getCandidate(target) } catch { return null }
    if (!value || !Number.isInteger(value.r) || !Number.isInteger(value.k) || value.r < 0 || value.r > 7 || value.k < 0 || value.k > 7) return null
    return { ...value, r:value.r, k:value.k }
  }
  function eligible(candidate) {
    if (destroyed || !candidate || board.isConnected === false || doc?.hidden || doc?.visibilityState === 'hidden') return false
    try { return canHold(candidate) === true } catch { return false }
  }
  function announce(phase, candidate = null) {
    try { onState?.({ phase, candidate:candidate ? { ...candidate } : null }) } catch { /* visual feedback must not interrupt play */ }
  }
  function clearPress({ suppress = false } = {}) {
    const previous = press
    press = null; epoch++
    if (timer !== null) { clearTimer(timer); timer = null }
    if (previous && (suppress || previous.fired)) {
      blockedUntil = now() + 400
      if (previous.kind === 'pointer') blockedPointers.add(previous.id)
    }
    if (previous?.kind === 'pointer') {
      try { if (board.hasPointerCapture?.(previous.id)) board.releasePointerCapture(previous.id) } catch { /* capture may already be gone */ }
      try { if (previous.source?.hasPointerCapture?.(previous.id)) previous.source.releasePointerCapture(previous.id) } catch { /* the square may have been redrawn */ }
    }
    if (previous) announce('idle')
  }
  function cancel() { clearPress({ suppress:true }) }
  function refresh() { if (press && !eligible(press.candidate)) cancel() }
  function start(value) {
    if (!eligible(value.candidate)) return
    press = { ...value, fired:false }
    const token = ++epoch
    announce('holding', press.candidate)
    timer = setTimer(() => {
      if (destroyed || token !== epoch || !press) return
      timer = null
      if (!eligible(press.candidate)) { cancel(); return }
      press.fired = true
      if (press.kind === 'pointer') {
        try { board.setPointerCapture?.(press.id) } catch { /* window listeners still finish the gesture */ }
      }
      const candidate = { ...press.candidate }
      announce('shown', candidate)
      try { onHold?.(candidate) } catch { cancel() }
    }, HOLD_MS)
  }
  function contactDown(event) {
    if (!['touch','pen'].includes(event.pointerType)) return
    if (recoverFreshInput && event.isPrimary === true && !press) {
      blockedPointers.clear(); blockedUntil = 0; recoverFreshInput = false
    }
    contacts.add(event.pointerId)
    if (blockedPointers.size) blockedPointers.add(event.pointerId)
    if (press && (contacts.size > 1 || (press.kind === 'pointer' && event.pointerId !== press.id))) {
      for (const id of contacts) blockedPointers.add(id)
      cancel()
    }
  }
  function pointerDown(event) {
    if (destroyed || !['mouse','touch','pen'].includes(event.pointerType) || event.isPrimary === false || !Number.isFinite(event.pointerId)) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
    if (press) { cancel(); return }
    if (recoverFreshInput && event.isPrimary !== false) {
      blockedPointers.clear(); blockedUntil = 0; recoverFreshInput = false
    }
    // A new primary mouse down proves its previous release happened, even if
    // it took place outside the browser after a cancelled drag.
    if (event.pointerType === 'mouse' && blockedPointers.delete(event.pointerId) && !blockedPointers.size) blockedUntil = 0
    if (contacts.size > (event.pointerType === 'mouse' ? 0 : 1) || blockedPointers.size) return
    const candidate = candidateFor(event.target)
    if (!eligible(candidate)) return
    start({ kind:'pointer', id:event.pointerId, pointerType:event.pointerType, candidate, x:event.clientX, y:event.clientY, source:event.target })
    // Keep a short tap's original target, while still receiving its release if
    // the pointer leaves the square. Only activation transfers it to the board.
    try { event.target.setPointerCapture?.(event.pointerId) } catch { /* window listeners remain the fallback */ }
  }
  function pointerMove(event) {
    if (!press && event.pointerType === 'mouse' && !(event.buttons & 1) && blockedPointers.delete(event.pointerId) && !blockedPointers.size) { blockedUntil = now() + 400; recoverFreshInput = false }
    if (press?.kind !== 'pointer' || press.id !== event.pointerId) return
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || !eligible(press.candidate) ||
        (press.pointerType === 'mouse' && !(event.buttons & 1)) ||
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) cancel()
  }
  function pointerEnd(event, cancelled = false) {
    contacts.delete(event.pointerId)
    if (press?.kind === 'pointer' && press.id === event.pointerId) clearPress({ suppress:cancelled || press.fired })
    if (blockedPointers.delete(event.pointerId) && !blockedPointers.size) { blockedUntil = now() + 400; recoverFreshInput = false }
  }
  function lostCapture(event) {
    if (press?.kind !== 'pointer' || press.id !== event.pointerId) return
    // Activating transfers implicit capture from the old square to the board.
    // Its bubbling old-square loss is expected, not a cancelled long press.
    if (press.fired && (event.target !== board || board.hasPointerCapture?.(event.pointerId))) return
    cancel()
  }
  function forget() {
    cancel(); contacts.clear()
    // A resize/blur can occur while the finger is still physically held. Keep
    // blocking that release even after the ordinary click cooldown has passed.
    // If the browser omits its end event, a fresh primary press or key is the
    // explicit recovery signal; it must not leave subsequent input stranded.
    recoverFreshInput = blockedPointers.size > 0
  }
  function shouldIgnoreClick() { return !destroyed && (!!press?.fired || blockedPointers.size > 0 || now() < blockedUntil) }
  function click(event) {
    if (!shouldIgnoreClick()) return
    event.preventDefault(); event.stopImmediatePropagation()
  }
  function suppressNative(event) {
    if (press || eligible(candidateFor(event.target))) event.preventDefault()
  }
  function keyDown(event) {
    if (event.key === 'Escape') { if (press) cancel(); return }
    if (!['Enter',' '].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return
    if (press?.kind === 'keyboard' && press.key === event.key) { event.preventDefault(); return }
    const candidate = candidateFor(event.target)
    if (!eligible(candidate)) return
    event.preventDefault()
    if (event.repeat) return
    if (recoverFreshInput && !press) { blockedPointers.clear(); blockedUntil = 0; recoverFreshInput = false }
    if (press || blockedPointers.size || contacts.size) { cancel(); return }
    start({ kind:'keyboard', key:event.key, source:event.target, candidate })
  }
  function keyUp(event) {
    if (press?.kind !== 'keyboard' || event.key !== press.key) return
    event.preventDefault()
    const previous = press, activate = !previous.fired && eligible(previous.candidate) && previous.source.isConnected !== false
    clearPress()
    // Native Enter activates on keydown; Space activates on keyup. Waiting
    // until release supports both long holds while preserving short activation.
    if (activate) previous.source.click?.()
  }
  listen(win, 'pointerdown', contactDown, { capture:true, passive:true })
  listen(board, 'pointerdown', pointerDown, { passive:true })
  listen(win, 'pointermove', pointerMove, { passive:true })
  listen(win, 'pointerup', event => pointerEnd(event))
  listen(win, 'pointercancel', event => pointerEnd(event, true))
  listen(win, 'lostpointercapture', lostCapture, { capture:true })
  listen(board, 'click', click, { capture:true })
  for (const type of ['contextmenu','selectstart','dragstart']) listen(board, type, suppressNative)
  listen(board, 'keydown', keyDown)
  listen(win, 'keyup', keyUp, { capture:true })
  listen(win, 'blur', forget)
  listen(win, 'resize', forget, { passive:true })
  listen(doc, 'visibilitychange', forget)
  return {
    refresh, cancel, shouldIgnoreClick,
    get active() { return press !== null },
    destroy() {
      if (destroyed) return
      forget(); destroyed = true; epoch++; contacts.clear(); blockedPointers.clear(); recoverFreshInput = false
      while (cleanups.length) cleanups.pop()()
    },
  }
}
