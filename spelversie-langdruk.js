// A game card still opens on a normal tap. A deliberate 3-second hold reveals
// its version history, without letting the follow-up click launch the game.
export function maakSpelVersieLangDruk({
  element,
  onLongPress,
  holdMs = 3000,
  win = element?.ownerDocument?.defaultView || globalThis.window,
  doc = element?.ownerDocument || globalThis.document,
  setTimer = (fn, ms) => win.setTimeout(fn, ms),
  clearTimer = id => win.clearTimeout(id),
} = {}) {
  if (!element?.addEventListener || typeof onLongPress !== 'function') throw new TypeError('A game card and long-press action are required.')
  if (!Number.isFinite(holdMs) || holdMs < 500) throw new RangeError('The hold duration must be at least 500ms.')

  let timer = null, expiryTimer = null, activePointer = null, keyHeld = false
  let fired = false, consumeClick = false, destroyed = false
  const cleanups = []
  const listen = (target, type, fn, options) => {
    if (!target?.addEventListener) return
    target.addEventListener(type, fn, options)
    cleanups.push(() => target.removeEventListener(type, fn, options))
  }
  const inHistory = target => Boolean(target?.closest?.('.spelversie-controller'))
  const isControl = target => Boolean(target?.closest?.('button,a,input,select,textarea,[contenteditable="true"]'))

  function clearTimers() {
    if (timer !== null) clearTimer(timer)
    timer = null
  }
  function expireClickGuard() {
    if (expiryTimer !== null) clearTimer(expiryTimer)
    expiryTimer = null
    consumeClick = false
    fired = false
  }
  function cancel({ keepClickGuard = false } = {}) {
    clearTimers()
    activePointer = null
    keyHeld = false
    element.classList?.remove('game-version-holding')
    if (!keepClickGuard && !fired) expireClickGuard()
  }
  function fire() {
    if (destroyed || timer === null) return
    timer = null
    fired = true
    consumeClick = true
    element.classList?.remove('game-version-holding')
    try { onLongPress() } catch (error) { console.warn('[game-version-history] could not open history', error) }
    if (expiryTimer !== null) clearTimer(expiryTimer)
    expiryTimer = setTimer(expireClickGuard, 1200)
  }
  function arm() {
    if (destroyed || timer !== null) return
    if (expiryTimer !== null && !consumeClick) { clearTimer(expiryTimer); expiryTimer = null }
    fired = false
    element.classList?.add('game-version-holding')
    timer = setTimer(fire, holdMs)
  }
  function pointerDown(event) {
    if (destroyed) return
    if (event.isPrimary === false) { if (timer !== null) cancel(); return }
    if (event.button !== undefined && event.button !== 0 || inHistory(event.target) || isControl(event.target)) return
    if (activePointer !== null || keyHeld) { cancel(); return }
    activePointer = { id:event.pointerId, x:event.clientX || 0, y:event.clientY || 0 }
    arm()
  }
  function pointerMove(event) {
    if (!activePointer || event.pointerId !== activePointer.id || timer === null) return
    if (Math.hypot((event.clientX || 0) - activePointer.x, (event.clientY || 0) - activePointer.y) > 12) cancel()
  }
  function pointerEnd(event) {
    if (!activePointer || event.pointerId !== activePointer.id) return
    const long = fired
    cancel({ keepClickGuard:long })
  }
  function clickCapture(event) {
    if (!consumeClick || inHistory(event.target)) return
    consumeClick = false
    if (expiryTimer !== null) clearTimer(expiryTimer)
    expiryTimer = null
    fired = false
    event.preventDefault?.()
    event.stopImmediatePropagation?.()
  }
  function keyDown(event) {
    if (event.code !== 'Space' || event.repeat || inHistory(event.target) || isControl(event.target)) return
    event.preventDefault?.()
    if (keyHeld) return
    keyHeld = true
    arm()
  }
  function keyUp(event) {
    if (event.code !== 'Space' || !keyHeld) return
    event.preventDefault?.()
    const long = fired
    cancel({ keepClickGuard:long })
  }
  function contextMenu(event) {
    if (timer !== null || consumeClick) event.preventDefault?.()
  }
  function blur() { cancel({ keepClickGuard:fired }) }
  function visibility() { if (doc?.hidden) cancel({ keepClickGuard:fired }) }

  listen(element, 'pointerdown', pointerDown)
  listen(win, 'pointermove', pointerMove, true)
  listen(win, 'pointerup', pointerEnd, true)
  listen(win, 'pointercancel', pointerEnd, true)
  listen(element, 'click', clickCapture, true)
  listen(element, 'keydown', keyDown)
  listen(win, 'keyup', keyUp, true)
  listen(element, 'contextmenu', contextMenu)
  listen(win, 'blur', blur)
  listen(doc, 'visibilitychange', visibility)

  return {
    cancel,
    destroy() {
      if (destroyed) return
      destroyed = true
      clearTimers()
      if (expiryTimer !== null) clearTimer(expiryTimer)
      expiryTimer = null
      element.classList?.remove('game-version-holding')
      while (cleanups.length) cleanups.pop()()
    },
    get active() { return timer !== null },
  }
}
