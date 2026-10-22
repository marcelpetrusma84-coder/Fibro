// Shared sizing for the chess board and its independently resizable cameras.
const mountedLayouts = new WeakMap()
// v197: teksten via taal.js (Nederlands, Engels uit taal-en.js)
const T = s => (window.T ? window.T(s) : s)
const CONTROL_SELECTOR = 'button, a, input, select, textarea, summary, [contenteditable], [role="button"]'

export function mountChessLayout({ root, cameraSelector, frameSelector = '#spelInhoud .sch-frame' }) {
  if (!root || typeof root.querySelectorAll !== 'function') throw new TypeError('A chess layout root is required.')
  if (!cameraSelector) throw new TypeError('A camera selector is required.')
  mountedLayouts.get(root)?.destroy()

  const hadRootClass = root.classList.contains('chess-media-layout')
  const originalWidth = root.style.getPropertyValue('--chess-board-width')
  const originalPriority = root.style.getPropertyPriority('--chess-board-width')
  const cameras = [...root.querySelectorAll(cameraSelector)]
  // Preserve the real DOM order when switching layouts, including keyboard focus.
  const cameraHomes = cameras.map(camera => {
    const anchor = document.createComment('Camera position')
    camera.before(anchor)
    return { camera, anchor }
  })
  const cameraGroup = document.createElement('section')
  cameraGroup.className = 'chess-camera-group'
  cameraGroup.setAttribute('aria-label', 'Player cameras')
  const listeners = new AbortController()
  const cleanups = []
  let frame = null
  let destroyed = false
  let pendingSync = 0
  let drag = null

  root.classList.add('chess-media-layout')

  const rail = document.createElement('nav')
  rail.className = 'chess-scroll-rail'
  rail.setAttribute('aria-label', 'Game scrolling')
  const makeJump = (label, text, getTop) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = text
    button.setAttribute('aria-label', label)
    button.title = label
    button.addEventListener('click', () => root.scrollTo({ top:getTop(), behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }), { signal:listeners.signal })
    return button
  }
  const track = document.createElement('div')
  track.className = 'chess-scroll-track'
  track.tabIndex = 0
  track.setAttribute('role', 'scrollbar')
  track.setAttribute('aria-label', 'Swipe here to scroll the game')
  track.setAttribute('aria-orientation', 'vertical')
  track.setAttribute('aria-valuemin', '0')
  track.setAttribute('aria-valuemax', '100')
  if (root.id) track.setAttribute('aria-controls', root.id)
  track.title = 'Swipe up or down here to scroll'
  const thumb = document.createElement('span')
  thumb.className = 'chess-scroll-thumb'
  track.append(thumb)
  rail.append(
    makeJump('Scroll to the top camera', '↑', () => 0),
    track,
    makeJump('Scroll to the chess board', '♟', () => Math.max(0, root.scrollTop + (frame?.getBoundingClientRect().top || 0) - root.getBoundingClientRect().top - 112)),
    makeJump('Scroll to the bottom', '↓', () => root.scrollHeight)
  )
  root.append(rail)

  const scheduleSync = () => {
    if (!destroyed && !pendingSync) pendingSync = requestAnimationFrame(() => { pendingSync = 0; sync() })
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleSync) : null
  resizeObserver?.observe(root)
  cameras.forEach(camera => resizeObserver?.observe(camera))
  const mutations = new MutationObserver(scheduleSync)
  mutations.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['data-camera-layout', 'class'] })

  track.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    event.preventDefault()
    drag = { id:event.pointerId, y:event.clientY, top:root.scrollTop }
    track.setPointerCapture(event.pointerId)
    rail.classList.add('is-dragging')
  }, { signal:listeners.signal })
  track.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return
    root.scrollTop = drag.top + (drag.y - event.clientY) * 1.6
  }, { signal:listeners.signal })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    track.addEventListener(type, () => { drag = null; rail.classList.remove('is-dragging') }, { signal:listeners.signal })
  }
  track.addEventListener('keydown', event => {
    const steps = { ArrowDown:64, ArrowUp:-64, PageDown:root.clientHeight * .8, PageUp:-root.clientHeight * .8 }
    if (event.key === 'Home') root.scrollTop = 0
    else if (event.key === 'End') root.scrollTop = root.scrollHeight
    else if (Object.hasOwn(steps, event.key)) root.scrollTop += steps[event.key]
    else return
    event.preventDefault()
  }, { signal:listeners.signal })
  root.addEventListener('scroll', scheduleSync, { passive:true, signal:listeners.signal })

  function sync() {
    if (destroyed) return
    const nextFrame = root.querySelector(frameSelector)
    if (frame !== nextFrame) {
      if (frame) resizeObserver?.unobserve(frame)
      frame = nextFrame
      if (frame) resizeObserver?.observe(frame)
    }
    const together = root.querySelector('.sch-spel')?.dataset.cameraLayout === 'top'
    if (together && cameras.length) {
      let boardSection = frame
      while (boardSection && boardSection.parentElement !== root) boardSection = boardSection.parentElement
      if (boardSection && cameraGroup.parentElement !== root) root.insertBefore(cameraGroup, boardSection)
      for (const camera of cameras) if (camera.parentElement !== cameraGroup) cameraGroup.append(camera)
      cameraGroup.hidden = !cameras.some(camera => getComputedStyle(camera).display !== 'none')
    } else {
      for (const { camera, anchor } of cameraHomes) if (camera.previousSibling !== anchor) anchor.after(camera)
      cameraGroup.remove()
    }
    const width = frame?.getBoundingClientRect().width || 0
    const size = `${Math.round(width)}px`
    if (width > 0 && root.style.getPropertyValue('--chess-board-width') !== size) root.style.setProperty('--chess-board-width', size)
    const range = root.scrollHeight - root.clientHeight
    rail.hidden = range < 2
    const progress = range > 0 ? Math.max(0, Math.min(1, root.scrollTop / range)) : 0
    const thumbHeight = Math.min(track.clientHeight, Math.max(28, track.clientHeight * root.clientHeight / Math.max(1, root.scrollHeight)))
    track.style.setProperty('--scroll-thumb-height', `${thumbHeight}px`)
    track.style.setProperty('--scroll-thumb-offset', `${progress * Math.max(0, track.clientHeight - thumbHeight)}px`)
    track.setAttribute('aria-valuenow', String(Math.round(progress * 100)))
    for (const camera of cameras) updateCameraLabel(camera)
  }

  function updateCameraLabel(camera) {
    const expanded = camera.classList.contains('is-expanded')
    camera.setAttribute('aria-pressed', String(expanded))
    camera.setAttribute('aria-label', expanded ? 'Restore camera view' : 'Show larger camera view')
  }

  for (const camera of cameras) {
    const hadCameraClass = camera.classList.contains('chess-camera')
    const wasExpanded = camera.classList.contains('is-expanded')
    const attributes = new Map(['role', 'tabindex', 'aria-label', 'aria-pressed'].map(name => [name, camera.getAttribute(name)]))

    const updateLabel = () => {
      const expanded = camera.classList.contains('is-expanded')
      camera.setAttribute('aria-pressed', String(expanded))
      camera.setAttribute('aria-label', expanded ? T('Camerabeeld weer kleiner') : T('Camerabeeld groter'))
    }
    const toggle = () => {
      camera.classList.toggle('is-expanded')
      updateLabel()
    }
    const onClick = event => {
      const control = event.target instanceof Element ? event.target.closest(CONTROL_SELECTOR) : null
      if (control && control !== camera) return
      toggle()
    }
    const onKeyDown = event => {
      if (event.target !== camera || !['Enter', ' '].includes(event.key) || event.repeat) return
      event.preventDefault()
      toggle()
    }

    camera.classList.add('chess-camera')
    camera.setAttribute('role', 'button')
    camera.tabIndex = 0
    updateLabel()
    camera.addEventListener('click', onClick, { signal:listeners.signal })
    camera.addEventListener('keydown', onKeyDown, { signal:listeners.signal })
    cleanups.push(() => {
      if (!hadCameraClass) camera.classList.remove('chess-camera')
      camera.classList.toggle('is-expanded', wasExpanded)
      for (const [name, value] of attributes) {
        if (value === null) camera.removeAttribute(name)
        else camera.setAttribute(name, value)
      }
    })
  }

  window.addEventListener('resize', sync, { passive:true, signal:listeners.signal })
  sync()

  const controller = {
    sync,
    resetCameras() { cameras.forEach(camera => camera.classList.remove('is-expanded')); sync() },
    destroy() {
      if (destroyed) return
      destroyed = true
      resizeObserver?.disconnect()
      mutations.disconnect()
      cancelAnimationFrame(pendingSync)
      listeners.abort()
      rail.remove()
      for (const { camera, anchor } of cameraHomes) {
        anchor.after(camera)
        anchor.remove()
      }
      cameraGroup.remove()
      cleanups.forEach(cleanup => cleanup())
      if (!hadRootClass) root.classList.remove('chess-media-layout')
      if (originalWidth) root.style.setProperty('--chess-board-width', originalWidth, originalPriority)
      else root.style.removeProperty('--chess-board-width')
      if (mountedLayouts.get(root) === controller) mountedLayouts.delete(root)
    }
  }
  mountedLayouts.set(root, controller)
  return controller
}
