// The secondary level shortcut is a deliberate three-second hold, never a
// normal start/restart action. The game supplies its current level/readiness.
export function koppelNeonVerder({ startKnop, verderKnop, kanTonen, onStart,
  windowTarget = globalThis.window, documentTarget = globalThis.document }) {
  const events = new AbortController()
  let hold = null, timer = null, consumeClick = false, destroyed = false
  const listen = (node, type, callback) => node?.addEventListener(type, callback, { signal:events.signal })
  const key = event => ['Space','Enter','NumpadEnter'].includes(event.code)

  function clearHold() {
    clearTimeout(timer); timer = null; hold = null
    startKnop.classList.remove('nr-vasthouden')
  }
  function cancel() {
    if (hold?.type === 'pointer') consumeClick = true
    clearHold()
  }
  function begin(press) {
    hold = press
    startKnop.classList.add('nr-vasthouden')
    timer = setTimeout(() => {
      if (destroyed || hold !== press) return
      if (!kanTonen() || documentTarget?.hidden) { cancel(); return }
      press.fired = true
      startKnop.classList.remove('nr-vasthouden')
      verderKnop.hidden = false
      startKnop.setAttribute('aria-expanded','true')
    }, 3000)
  }
  function reset() {
    clearHold(); consumeClick = false
    verderKnop.hidden = true
    startKnop.setAttribute('aria-expanded','false')
  }
  listen(startKnop, 'pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false || hold) return
    consumeClick = false
    if (kanTonen()) begin({ type:'pointer', id:event.pointerId, fired:false })
  })
  listen(startKnop, 'pointerup', event => {
    if (hold?.type !== 'pointer' || event.pointerId !== hold.id) return
    consumeClick = hold.fired
    clearHold()
  })
  listen(startKnop, 'pointermove', event => {
    if (hold?.type !== 'pointer' || event.pointerId !== hold.id) return
    const rect = startKnop.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cancel()
  })
  for (const type of ['pointercancel','pointerleave','lostpointercapture']) listen(startKnop, type, event => {
    if (hold?.type === 'pointer' && event.pointerId === hold.id) cancel()
  })
  listen(startKnop, 'keydown', event => {
    if (event.code === 'Escape') { cancel(); return }
    if (!key(event)) return
    event.preventDefault(); event.stopPropagation()
    if (event.repeat || hold || startKnop.disabled || startKnop.hidden) return
    consumeClick = false
    // Even when no level shortcut exists, keyboard activation still starts once
    // on release; Enter's native keydown-click must not restart during a hold.
    const press = { type:'key', key:event.code, fired:false }
    if (kanTonen()) begin(press)
    else hold = press
  })
  listen(startKnop, 'keyup', event => {
    if (!key(event)) return
    event.preventDefault(); event.stopPropagation()
    if (hold?.type !== 'key' || hold.key !== event.code) return
    const short = !hold.fired
    clearHold(); consumeClick = false
    if (short && !destroyed && !startKnop.disabled && !startKnop.hidden) onStart()
  })
  listen(startKnop, 'click', event => {
    event.stopPropagation()
    if (consumeClick || hold) { event.preventDefault(); consumeClick = false; return }
    if (!destroyed && !startKnop.disabled && !startKnop.hidden) onStart()
  })
  listen(startKnop, 'blur', () => { if (hold?.type === 'key') cancel() })
  listen(windowTarget, 'blur', cancel)
  listen(documentTarget, 'visibilitychange', () => { if (documentTarget.hidden) cancel() })
  reset()
  return {
    reset, cancel,
    destroy() {
      if (destroyed) return
      destroyed = true; reset(); events.abort()
    }
  }
}
