const MOVE_TOLERANCE = 12
const CLICK_COOLDOWN = 400

// A native click requests a short hint; holding the same button requests the
// detailed hint. Only this button owns the gesture, never the surrounding board.
// getContext should return a stable primitive (for example FEN + revision).
export function maakHintHold({ element, canActivate = () => true, getContext = () => null,
  onShort, onLong, onState, holdMs = 3000,
  win = element?.ownerDocument?.defaultView || globalThis.window,
  doc = element?.ownerDocument || globalThis.document,
  setTimer = win?.setTimeout?.bind(win) || globalThis.setTimeout,
  clearTimer = win?.clearTimeout?.bind(win) || globalThis.clearTimeout,
  now = () => win?.performance?.now?.() ?? Date.now(),
} = {}) {
  if (!element?.addEventListener) throw new TypeError('A hint hold needs a button element.')
  const delay = Number.isFinite(holdMs) && holdMs > 0 ? holdMs : 3000
  const cleanups = [], contacts = new Set(), blockedPointers = new Set(), blockedKeys = new Set()
  let press = null, timer = null, epoch = 0, disposed = false, blockedUntil = 0, recoverFreshInput = false
  let shortContext = null, hasShortContext = false
  const inside = target => target === element || element.contains?.(target) === true
  function listen(target, type, handler, options) {
    if (!target?.addEventListener) return
    target.addEventListener(type, handler, options)
    cleanups.push(() => target.removeEventListener(type, handler, options))
  }
  function eligible() {
    if (disposed || element.isConnected === false || element.disabled || element.hidden ||
        element.getAttribute?.('aria-disabled') === 'true' || element.closest?.('[hidden]') ||
        doc?.hidden || doc?.visibilityState === 'hidden') return false
    try {
      if (element.checkVisibility?.({ checkVisibilityCSS:true }) === false) return false
      const style = win?.getComputedStyle?.(element)
      if (style?.display === 'none' || ['hidden','collapse'].includes(style?.visibility)) return false
      return canActivate() === true
    } catch { return false }
  }
  function snapshot() { try { return { valid:true, value:getContext() } } catch { return { valid:false } } }
  function current(context) { const value = snapshot(); return eligible() && value.valid && Object.is(context,value.value) }
  function announce(phase) { try { onState?.({ phase }) } catch { /* feedback must not interrupt a gesture */ } }
  function clearPress({ suppress = false } = {}) {
    const previous = press
    press = null; epoch++
    if (timer !== null) { clearTimer(timer); timer = null }
    if (previous && (suppress || previous.fired)) {
      blockedUntil = now() + CLICK_COOLDOWN
      if (previous.kind === 'pointer') blockedPointers.add(previous.id)
      else blockedKeys.add(previous.key)
    }
    if (previous?.kind === 'pointer') {
      try { if (element.hasPointerCapture?.(previous.id)) element.releasePointerCapture(previous.id) } catch { /* capture may already be lost */ }
    }
    if (previous) announce('idle')
    return previous
  }
  function cancel() {
    if (hasShortContext) blockedUntil = now() + CLICK_COOLDOWN
    hasShortContext = false; clearPress({ suppress:true })
  }
  function refresh() {
    if (press && !current(press.context) || hasShortContext && !current(shortContext)) cancel()
  }
  function start(value) {
    if (!eligible()) return
    const context = snapshot()
    if (!context.valid) return
    hasShortContext = false
    press = { ...value, context:context.value, fired:false }
    const token = ++epoch
    announce('holding')
    timer = setTimer(() => {
      if (disposed || token !== epoch || !press) return
      timer = null
      if (!current(press.context)) { cancel(); return }
      press.fired = true
      const payload = { context:press.context }
      announce('fired')
      try { onLong?.(payload) } catch { cancel() }
    }, delay)
  }
  function recover() {
    blockedPointers.clear(); blockedKeys.clear(); contacts.clear()
    blockedUntil = 0; recoverFreshInput = false; hasShortContext = false
  }
  function contactDown(event) {
    if (!['touch','pen'].includes(event.pointerType) || !Number.isFinite(event.pointerId)) return
    if (!press && event.isPrimary === true && blockedPointers.size) recover()
    contacts.add(event.pointerId)
    if (blockedPointers.size) blockedPointers.add(event.pointerId)
    if (press && (contacts.size > 1 || press.kind !== 'pointer' || press.id !== event.pointerId)) {
      for (const id of contacts) blockedPointers.add(id)
      cancel()
    }
  }
  function pointerDown(event) {
    if (disposed || !inside(event.target) || !['mouse','touch','pen'].includes(event.pointerType) || event.isPrimary === false ||
        !Number.isFinite(event.pointerId) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) ||
        (event.pointerType === 'mouse' && event.button !== 0)) return
    if (press) { cancel(); return }
    if (event.pointerType === 'mouse' || recoverFreshInput) {
      if (blockedPointers.size || blockedKeys.size || recoverFreshInput) recover()
    }
    if (contacts.size > (event.pointerType === 'mouse' ? 0 : 1) || blockedPointers.size || blockedKeys.size) return
    blockedUntil = 0
    start({ kind:'pointer', id:event.pointerId, pointerType:event.pointerType, x:event.clientX, y:event.clientY })
    if (press) try { element.setPointerCapture?.(event.pointerId) } catch { /* window listeners remain available */ }
  }
  function pointerMove(event) {
    if (!press && event.pointerType === 'mouse' && !(event.buttons & 1) && blockedPointers.delete(event.pointerId) && !blockedPointers.size) {
      blockedUntil = now() + CLICK_COOLDOWN; recoverFreshInput = false
    }
    if (press?.kind !== 'pointer' || press.id !== event.pointerId) return
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || !current(press.context) ||
        (press.pointerType === 'mouse' && !(event.buttons & 1)) ||
        Math.hypot(event.clientX - press.x,event.clientY - press.y) > MOVE_TOLERANCE) cancel()
  }
  function pointerEnd(event, cancelled = false) {
    contacts.delete(event.pointerId)
    if (press?.kind === 'pointer' && press.id === event.pointerId) {
      const value = press, valid = !cancelled && !value.fired && current(value.context)
      clearPress({ suppress:!valid })
      if (valid) { shortContext = value.context; hasShortContext = true }
    }
    if (blockedPointers.delete(event.pointerId) && !blockedPointers.size) {
      blockedUntil = now() + CLICK_COOLDOWN; recoverFreshInput = false
    }
  }
  function lostCapture(event) {
    if (press?.kind === 'pointer' && press.id === event.pointerId && event.target === element && !element.hasPointerCapture?.(event.pointerId)) cancel()
  }
  function forget() {
    cancel(); contacts.clear()
    // Keep consuming a held finger/key's eventual release even after a long
    // app switch; a new primary press is the explicit missed-release recovery.
    recoverFreshInput = blockedPointers.size > 0 || blockedKeys.size > 0
  }
  function consume(event) { event.preventDefault(); event.stopImmediatePropagation?.() }
  function click(event) {
    const blocked = press || blockedPointers.size || blockedKeys.size || now() < blockedUntil
    const value = snapshot()
    const valid = !blocked && value.valid && eligible() && (!hasShortContext || current(shortContext))
    const context = hasShortContext ? shortContext : value.value
    hasShortContext = false
    if (!valid) { consume(event); return }
    event.preventDefault()
    onShort?.({ context, event })
  }
  function suppressNative(event) { if (press || eligible()) event.preventDefault() }
  function keyDown(event) {
    if (event.key === 'Escape') { if (press) { event.preventDefault(); cancel() }; return }
    if (!inside(event.target) || !['Enter',' '].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey || !eligible()) return
    event.preventDefault()
    if (press?.kind === 'keyboard' && press.key === event.key || event.repeat) return
    if (!press && recoverFreshInput) recover()
    if (press || blockedPointers.size || blockedKeys.size || contacts.size) { cancel(); return }
    blockedUntil = 0
    start({ kind:'keyboard', key:event.key })
  }
  function keyUp(event) {
    if (press?.kind === 'keyboard' && press.key === event.key) {
      event.preventDefault()
      const value = press, valid = !value.fired && current(value.context)
      clearPress({ suppress:!valid })
      blockedKeys.delete(event.key)
      if (valid) {
        shortContext = value.context; hasShortContext = true
        element.click?.()
        // Enter/Space defaults were prevented. Also consume any compatibility
        // activation a browser/assistive tool emits for this same key release.
        blockedUntil = now() + CLICK_COOLDOWN
      } else blockedUntil = now() + CLICK_COOLDOWN
    } else if (blockedKeys.delete(event.key)) {
      event.preventDefault(); blockedUntil = now() + CLICK_COOLDOWN; recoverFreshInput = false
    }
  }
  listen(win,'pointerdown',contactDown,{ capture:true, passive:true })
  listen(element,'pointerdown',pointerDown,{ passive:true })
  listen(win,'pointermove',pointerMove,{ passive:true })
  listen(win,'pointerup',event=>pointerEnd(event))
  listen(win,'pointercancel',event=>pointerEnd(event,true))
  listen(win,'lostpointercapture',lostCapture,{ capture:true })
  listen(element,'click',click,{ capture:true })
  for (const type of ['contextmenu','selectstart','dragstart']) listen(element,type,suppressNative)
  listen(element,'keydown',keyDown)
  listen(win,'keyup',keyUp,{ capture:true })
  listen(element,'blur',forget)
  listen(win,'blur',forget)
  listen(win,'resize',forget,{ passive:true })
  listen(doc,'visibilitychange',forget)
  return {
    refresh, cancel,
    get active() { return press !== null },
    destroy() {
      if (disposed) return
      forget(); disposed = true; epoch++; recover();
      while (cleanups.length) cleanups.pop()()
    },
  }
}
