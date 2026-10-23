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
  const listeners = new AbortController()
  const cleanups = []
  let frame = null
  let destroyed = false

  root.classList.add('chess-media-layout')

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => sync()) : null

  function sync() {
    if (destroyed) return
    const nextFrame = root.querySelector(frameSelector)
    if (frame !== nextFrame) {
      if (frame) resizeObserver?.unobserve(frame)
      frame = nextFrame
      if (frame) resizeObserver?.observe(frame)
    }
    const width = frame?.getBoundingClientRect().width || 0
    if (width > 0) root.style.setProperty('--chess-board-width', `${Math.round(width)}px`)
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
    destroy() {
      if (destroyed) return
      destroyed = true
      resizeObserver?.disconnect()
      listeners.abort()
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
