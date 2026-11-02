const MOBILE_QUERY = '(max-width:760px), (pointer:coarse) and (max-width:1024px)'
const clamp = value => Math.max(0, Math.min(1, value))

// A deliberate right-to-left gesture on the dedicated strip, never on board
// squares. Releasing commits at most one existing takeback; crossing the mark
// and dragging back does not commit. There is no game state or preference here.
export function maakUltraSwipe({ element, canUndo = () => false, onUndo, onChange,
  win = element?.ownerDocument?.defaultView || globalThis.window,
  doc = element?.ownerDocument || globalThis.document,
  media = win?.matchMedia?.(MOBILE_QUERY), now = () => win?.performance?.now?.() ?? Date.now(),
} = {}) {
  if (!element) throw new TypeError('Ultra swipe needs a gesture strip.')
  const attributes = new Map(['data-swipe-active', 'data-swipe-state', 'aria-disabled', 'tabindex'].map(name => [name, element.getAttribute(name)]))
  const previousProgress = element.style.getPropertyValue('--sch-swipe-progress')
  const previousPriority = element.style.getPropertyPriority('--sch-swipe-progress')
  const cleanups = [], contacts = new Set()
  let destroyed = false, gesture = null, active = false, enabled = false, progress = 0, state = 'disabled', blockedUntil = 0
  function listen(target, type, fn, options) {
    if (!target?.addEventListener) return
    target.addEventListener(type, fn, options)
    cleanups.push(() => target.removeEventListener(type, fn, options))
  }
  function available() {
    if (destroyed || media?.matches !== true || doc?.hidden || doc?.visibilityState === 'hidden' || element.hidden || element.isConnected === false) return false
    try { return canUndo() === true } catch { return false }
  }
  function render() {
    active = !destroyed && media?.matches === true
    enabled = available()
    progress = gesture?.progress || 0
    state = !enabled ? 'disabled' : gesture ? (gesture.ready ? 'ready' : 'dragging') : 'idle'
    element.setAttribute('data-swipe-active', String(active))
    element.setAttribute('data-swipe-state', state)
    element.setAttribute('aria-disabled', String(!enabled))
    element.setAttribute('tabindex', enabled ? '0' : '-1')
    element.style.setProperty('--sch-swipe-progress', String(progress))
    try { onChange?.({ active, enabled, state, progress }) } catch { /* visual feedback must not interrupt chess */ }
  }
  function reset() {
    const old = gesture
    gesture = null
    if (old) {
      blockedUntil = now() + 400
      try { if (element.hasPointerCapture?.(old.id)) element.releasePointerCapture(old.id) } catch { /* the browser may already have released capture */ }
    }
  }
  function refresh() {
    if (destroyed) return
    if (gesture && !available()) reset()
    render()
  }
  function cancel() { reset(); refresh() }
  function forget() { contacts.clear(); cancel() }
  function contactDown(event) {
    if (event.pointerType !== 'touch') return
    contacts.add(event.pointerId)
    if (contacts.size > 1) cancel()
  }
  function pointerDown(event) {
    if (!available() || !['touch','mouse'].includes(event.pointerType) || event.isPrimary === false || !Number.isFinite(event.pointerId)) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.pointerType === 'touch') contacts.add(event.pointerId)
    if (contacts.size > 1 || gesture) { cancel(); return }
    const rect = element.getBoundingClientRect()
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || !Number.isFinite(rect.width) || rect.width <= 0) return
    const start = (event.clientX - rect.left) / rect.width
    if (start < .70 || start > 1) return
    gesture = { id:event.pointerId, type:event.pointerType, x:event.clientX, y:event.clientY, rect, progress:0, ready:false }
    // Do not prevent the down event: pan-y and the browser retain vertical
    // scrolling. Only an established horizontal drag consumes move events.
    try { element.setPointerCapture?.(event.pointerId) } catch { /* window listeners still finish/cancel the gesture */ }
    render()
  }
  function update(event) {
    if (!gesture || event.pointerId !== gesture.id) return false
    if (!available() || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) { cancel(); return false }
    if (gesture.type === 'mouse' && event.type === 'pointermove' && !(event.buttons & 1)) { cancel(); return false }
    const dx = gesture.x - event.clientX, dy = Math.abs(event.clientY - gesture.y)
    if (dy > Math.max(20, gesture.rect.width * .12) || (dy > 12 && dy > Math.abs(dx) * 1.2)) { cancel(); return false }
    const needed = Math.max(gesture.rect.width * .28, gesture.x - gesture.rect.left - gesture.rect.width * .42)
    gesture.progress = clamp(dx / needed)
    gesture.ready = dx + .0001 >= needed && event.clientX <= gesture.rect.left + gesture.rect.width * .42 + .0001
    if (dx > 8 && dx > dy) event.preventDefault()
    render()
    return true
  }
  function undo() {
    if (!available() || now() < blockedUntil) return false
    blockedUntil = now() + 400
    try { onUndo?.() } finally { refresh() }
    return true
  }
  function pointerUp(event) {
    contacts.delete(event.pointerId)
    if (!gesture || gesture.id !== event.pointerId) return
    if (!update(event)) return
    const commit = gesture.ready && available()
    reset()
    // reset suppresses the following compatibility click. This committed
    // pointer release is the sole exception, not a second user activation.
    if (commit) { try { onUndo?.() } finally { refresh() } }
    else refresh()
  }
  function pointerCancel(event) {
    contacts.delete(event.pointerId)
    if (gesture?.id === event.pointerId) cancel()
  }
  function lostCapture(event) {
    // Implicit capture moves from a nested label to the stable strip on down.
    // Its old bubbled loss is not a loss of the strip's actual capture.
    if (event.target !== element || gesture?.id !== event.pointerId || element.hasPointerCapture?.(event.pointerId)) return
    cancel()
  }
  function click(event) {
    event.preventDefault(); event.stopImmediatePropagation()
    // AT/keyboard activation is intentional; a normal tap/click does nothing.
    if (event.detail === 0 && !event.pointerType && !gesture) undo()
  }
  function keyDown(event) {
    if (event.target !== element || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Escape') { cancel(); return }
    if (!['Enter',' '].includes(event.key)) return
    event.preventDefault()
    if (!gesture) undo()
  }
  listen(win, 'pointerdown', contactDown, { capture:true, passive:true })
  listen(element, 'pointerdown', pointerDown, { passive:true })
  listen(win, 'pointermove', update, { passive:false })
  listen(win, 'pointerup', pointerUp)
  listen(win, 'pointercancel', pointerCancel)
  listen(element, 'lostpointercapture', lostCapture)
  listen(element, 'click', click, { capture:true })
  listen(element, 'keydown', keyDown)
  listen(win, 'blur', forget)
  listen(win, 'resize', forget, { passive:true })
  listen(doc, 'visibilitychange', forget)
  if (media?.addEventListener) listen(media, 'change', forget)
  else if (media?.addListener) { media.addListener(forget); cleanups.push(() => media.removeListener(forget)) }
  refresh()
  return {
    refresh,
    get active() { return active }, get enabled() { return enabled }, get state() { return state }, get progress() { return progress },
    destroy() {
      if (destroyed) return
      destroyed = true; contacts.clear(); reset(); active = enabled = false; state = 'disabled'; progress = 0
      while (cleanups.length) cleanups.pop()()
      for (const [name, value] of attributes) { if (value === null) element.removeAttribute(name); else element.setAttribute(name, value) }
      if (previousProgress) element.style.setProperty('--sch-swipe-progress', previousProgress, previousPriority)
      else element.style.removeProperty('--sch-swipe-progress')
    },
  }
}
