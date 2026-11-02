import { maakWallpaperDepth } from './schaak-wallpaper-depth.js?v=2'

const STORAGE_KEY = 'fibro_chess_wallpaper_v1'
const CHANGE_EVENT = 'fibro-chess-wallpaper-change'
const preferences = new WeakMap()
const owners = new WeakMap()
const clamp = (value, limit = 1) => Math.max(-limit, Math.min(limit, value))
// Transparent layout wrappers are deliberately omitted: the exposed room in
// their gaps is still background. Every visible game surface stops mouse motion.
const POINTER_SURFACES = [
  'button', 'input', 'select', 'textarea', 'label', 'a', 'summary', 'dialog', 'video', 'canvas',
  '[contenteditable]', '[role="button"]', '[role="dialog"]', '[role="alertdialog"]', '[role="status"]',
  '.sch-frame', '.sch-vangst', '.sch-legenda', '.sch-board-tools', '.sch-menu', '.sch-menu-backdrop',
  '.sch-evaluation', '.sch-history', '.sch-noob-dialog', '.sch-checkmate', '.sch-ultra-info',
  '.chess3-frame', '.chess3-heading', '.chess3-controls', '.chess3-help-actions', '.chess3-capturebar',
  '.chess3-camera', '.chess3-test-note', '.chess-scroll-rail', '.spel-video-vak', '.spel-titel-bar',
  '.fibro-test-badge', '.fibro-test-live-status',
].join(',')

// The decoration owns its transforms. Neither the game host nor any board,
// camera, controls or pieces are moved when the phone changes orientation.
export function maakSchaakWallpaper(options = {}) {
  const root = options.root
  // Mode switches can mount the next game before the old game's observer runs.
  // Synchronously release the old owner before snapshotting this shared host.
  if (root) owners.get(root)?.destroy()
  const doc = options.documentTarget || root?.ownerDocument || globalThis.document
  const win = options.eventTarget || doc?.defaultView || globalThis.window || globalThis
  const orientationEvent = options.orientationEvent === undefined ? win.DeviceOrientationEvent : options.orientationEvent
  const secure = options.secureContext ?? win.isSecureContext === true
  const requestFrame = options.requestFrame || win.requestAnimationFrame?.bind(win)
  const cancelFrame = options.cancelFrame || win.cancelAnimationFrame?.bind(win)
  const computed = options.getComputedStyle || win.getComputedStyle?.bind(win)
  const Observer = options.MutationObserver ?? win.MutationObserver
  const media = options.reducedMotion || win.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches:false }
  const subscribers = new Set(typeof options.onChange === 'function' ? [options.onChange] : [])
  const preference = preferences.get(win) || { value:'off' }
  preferences.set(win, preference)
  let storage = options.storage
  if (storage === undefined) { try { storage = win.localStorage } catch { storage = null } }
  try { const value = storage?.getItem(STORAGE_KEY); if (value === 'table' || value === 'off') preference.value = value } catch { /* retain this page's preference */ }
  let enabled = false, motionState = 'off', destroyed = false, permission = 'unknown', permissionEpoch = 0, permissionPromise = null
  let layer = null, photo = null, glare = null, shade = null, depth = null, savedRoot = null, observer = null, frame = null, motionKey = ''
  let x = 0, y = 0, targetX = 0, targetY = 0, baseline = null
  let lastTouchTime = -Infinity, inputSource = ''
  const inputTime = () => win.performance?.now?.() ?? Date.now()
  const cleanups = [], enabledCleanups = [], motionCleanups = []
  const snapshot = () => ({ enabled, motionState })
  function notify() { for (const fn of subscribers) { try { fn(snapshot()) } catch { /* a settings view must not interrupt cleanup */ } } }
  function state(value) { if (motionState !== value) { motionState = value; notify() } }
  function listen(target, name, fn, list, settings) {
    if (!target?.addEventListener) return
    target.addEventListener(name, fn, settings)
    list.push(() => target.removeEventListener(name, fn, settings))
  }
  function drain(list) { while (list.length) list.pop()() }
  function visible() {
    if (doc?.hidden || doc?.visibilityState === 'hidden' || root?.isConnected === false) return false
    if (options.isVisible && !options.isVisible(root)) return false
    for (let node = root; node; node = node.parentElement) {
      if (node.hidden || node.getAttribute?.('aria-hidden') === 'true') return false
      const style = computed?.(node)
      if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return false
    }
    return true
  }
  function paint() {
    if (!photo) return
    photo.style.transform = `translate3d(${(x * 18).toFixed(3)}px,${(y * 14).toFixed(3)}px,0) rotateX(${(y * 1.4).toFixed(3)}deg) rotateY(${(-x * 1.8).toFixed(3)}deg) rotateZ(${(x * .35).toFixed(3)}deg) scale(1.04)`
    depth?.paint(x, y)
    glare.style.transform = `translate3d(${(-x * 26).toFixed(3)}px,${(-y * 20).toFixed(3)}px,0)`
    glare.style.opacity = String(.44 + (x - y) * .055)
    shade.style.boxShadow = `inset ${(x * 35).toFixed(2)}px ${(y * 28).toFixed(2)}px 110px 20px rgba(5,3,3,.30)`
  }
  function stopFrame() { if (frame !== null) { cancelFrame?.(frame); frame = null } }
  function neutral() { stopFrame(); x = y = targetX = targetY = 0; baseline = null; inputSource = ''; paint() }
  function animate() {
    frame = null
    if (!enabled || destroyed || media.matches || !motionKey || !visible()) return
    x += (targetX - x) * .14; y += (targetY - y) * .14
    const resting = Math.abs(targetX - x) < .002 && Math.abs(targetY - y) < .002
    if (resting) { x = targetX; y = targetY }
    paint()
    if (!resting) frame = requestFrame?.(animate) ?? null
  }
  function target(nextX, nextY, source = 'pointer') {
    inputSource = source
    targetX = clamp(nextX); targetY = clamp(nextY)
    if (Math.abs(targetX - x) < .002 && Math.abs(targetY - y) < .002) return
    if (!requestFrame) { x = targetX; y = targetY; paint(); return }
    if (frame === null) frame = requestFrame(animate)
  }
  function freezePointer() {
    // Stop the easing too: merely ignoring a move would let the room drift
    // underneath a board square or button until its old target was reached.
    if (inputSource !== 'pointer') return
    stopFrame(); targetX = x; targetY = y
  }
  function backgroundHit(event) {
    const path = event.composedPath?.() || []
    if (!path.length) for (let node = event.target; node; node = node.parentElement) path.push(node)
    const rootIndex = path.indexOf(root)
    return rootIndex >= 0 && !path.slice(0, rootIndex).some(node => node.matches?.(POINTER_SURFACES))
  }
  function pointer(event) {
    if (event.pointerType !== 'mouse' || !visible()) return
    if (event.buttons || !backgroundHit(event)) { freezePointer(); return }
    const rect = root?.getBoundingClientRect?.() || {}
    const width = rect.width || win.innerWidth || 1, height = rect.height || win.innerHeight || 1
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
    target(((event.clientX - (rect.left || 0)) / width - .5) * 2, ((event.clientY - (rect.top || 0)) / height - .5) * 2)
  }
  function mouse(event) {
    if (event.sourceCapabilities?.firesTouchEvents || inputTime() - lastTouchTime < 1500) return
    pointer({ pointerType:'mouse', buttons:event.buttons || 0, clientX:event.clientX, clientY:event.clientY, target:event.target, composedPath:event.composedPath?.bind(event) })
  }
  function orientation(event) {
    if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta) || !visible()) return
    if (!baseline) { baseline = { gamma:event.gamma, beta:event.beta }; return }
    const difference = (value, start) => ((value - start + 540) % 360) - 180
    const gamma = difference(event.gamma, baseline.gamma), beta = difference(event.beta, baseline.beta)
    const rawAngle = Number(win.screen?.orientation?.angle ?? win.orientation ?? 0)
    const angle = (Number.isFinite(rawAngle) ? rawAngle : 0) * Math.PI / 180
    target((gamma * Math.cos(angle) + beta * Math.sin(angle)) / 24, (beta * Math.cos(angle) - gamma * Math.sin(angle)) / 30, 'sensor')
  }
  function stopMotion() { drain(motionCleanups); motionKey = ''; neutral() }
  function reconcile() {
    if (!enabled || destroyed) { stopMotion(); state('off'); return }
    const sensor = secure && Boolean(orientationEvent)
    const needsPermission = sensor && typeof orientationEvent.requestPermission === 'function'
    state(media.matches ? 'reduced' : needsPermission && permission !== 'granted' ? (permission === 'denied' ? 'denied' : 'permission') : sensor ? 'motion' : win.addEventListener ? 'pointer' : 'unavailable')
    const key = !media.matches && visible() ? (sensor && (!needsPermission || permission === 'granted') ? 'sensor' : 'pointer') : ''
    if (key === motionKey) return
    stopMotion()
    if (!key) return
    motionKey = key
    listen(win, 'pointermove', pointer, motionCleanups, { passive:true })
    if (!win.PointerEvent) {
      listen(win, 'mousemove', mouse, motionCleanups, { passive:true })
      listen(win, 'touchstart', () => { lastTouchTime = inputTime() }, motionCleanups, { passive:true })
      listen(win, 'mouseleave', freezePointer, motionCleanups, { passive:true })
    }
    listen(win, 'pointerleave', event => { if (event.pointerType === 'mouse') freezePointer() }, motionCleanups, { passive:true })
    const reorient = () => neutral()
    listen(win, 'orientationchange', reorient, motionCleanups)
    listen(win.screen?.orientation, 'change', reorient, motionCleanups)
    if (key === 'sensor') listen(win, 'deviceorientation', orientation, motionCleanups, { passive:true })
  }
  function mount() {
    if (layer || !root || !doc?.createElement) return
    const property = name => ({ value:root.style.getPropertyValue(name), priority:root.style.getPropertyPriority(name) })
    savedRoot = { position:property('position'), isolation:property('isolation'), active:root.classList.contains('sch-wallpaper-active'), hadStyle:root.hasAttribute?.('style') }
    if (!computed || !computed(root)?.position || computed(root).position === 'static') root.style.setProperty('position', 'relative')
    root.style.setProperty('isolation', 'isolate')
    root.classList.add('sch-wallpaper-active')
    layer = doc.createElement('div'); layer.className = 'sch-wallpaper-layer'
    layer.setAttribute('aria-hidden', 'true')
    layer.style.cssText = 'position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;user-select:none;background:#211912;perspective:1200px;contain:layout paint style;'
    photo = doc.createElement('div'); photo.className = 'sch-wallpaper-photo'
    // Assign the photo only after opt-in; OFF does not fetch the image.
    photo.style.cssText = 'position:absolute;inset:-9%;background-size:cover;background-position:center 58%;background-repeat:no-repeat;filter:brightness(.84) saturate(.97);transform-origin:50% 55%;backface-visibility:hidden;will-change:transform;'
    const imageUrl = new URL('./assets/chess/walnut-table-room-3d.png', import.meta.url).href
    photo.style.backgroundImage = `url("${imageUrl}")`
    glare = doc.createElement('div'); glare.className = 'sch-wallpaper-glare'
    glare.style.cssText = 'position:absolute;inset:-15%;background:radial-gradient(ellipse at 34% 12%,rgba(255,235,197,.21),transparent 58%);mix-blend-mode:screen;opacity:.44;will-change:transform;'
    shade = doc.createElement('div'); shade.className = 'sch-wallpaper-shade'
    shade.style.cssText = 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,8,14,.38),rgba(10,7,10,.10) 48%,rgba(7,5,12,.40));'
    layer.append(photo, glare, shade); root.prepend(layer)
    depth = maakWallpaperDepth({ host:photo, doc, win, imageUrl })
    paint()
  }
  function unmount() {
    depth?.destroy(); depth = null
    layer?.remove(); layer = photo = glare = shade = null
    if (!savedRoot) return
    for (const name of ['position','isolation']) {
      const original = savedRoot[name]
      if (original.value) root.style.setProperty(name, original.value, original.priority)
      else root.style.removeProperty(name)
    }
    if (!savedRoot.active) root.classList.remove('sch-wallpaper-active')
    if (!savedRoot.hadStyle && root.style.length === 0) root.removeAttribute?.('style')
    savedRoot = null
  }
  function watchEnabled() {
    listen(doc, 'visibilitychange', reconcile, enabledCleanups)
    if (media.addEventListener) listen(media, 'change', reconcile, enabledCleanups)
    else if (media.addListener) { media.addListener(reconcile); enabledCleanups.push(() => media.removeListener(reconcile)) }
    if (Observer && root) {
      observer = new Observer(reconcile)
      for (let node = root; node; node = node.parentElement) observer.observe(node, { attributes:true, childList:true, attributeFilter:['style','class','hidden','aria-hidden'] })
      enabledCleanups.push(() => { observer?.disconnect(); observer = null })
    }
  }
  function apply(value) {
    if (destroyed || enabled === value) return
    enabled = value
    if (enabled) { mount(); watchEnabled(); reconcile() }
    else { permissionEpoch++; permissionPromise = null; drain(enabledCleanups); stopMotion(); unmount(); state('off') }
    notify()
  }
  function save(value) {
    preference.value = value ? 'table' : 'off'
    try { storage?.setItem(STORAGE_KEY, preference.value) } catch { /* keep working in memory */ }
    const Event = win.CustomEvent || globalThis.CustomEvent
    if (Event && win.dispatchEvent) { try { win.dispatchEvent(new Event(CHANGE_EVENT, { detail:{ value:preference.value, source:api } })) } catch { /* cross-view sync is optional */ } }
  }
  async function activateMotion() {
    if (destroyed || !enabled || media.matches || !visible() || !secure || !orientationEvent) { reconcile(); return snapshot() }
    if (typeof orientationEvent.requestPermission !== 'function' || permission === 'granted') { reconcile(); return snapshot() }
    if (permissionPromise) return permissionPromise
    const epoch = permissionEpoch
    let request
    // Invoke this before the first await, inside the checkbox/button gesture.
    try { request = orientationEvent.requestPermission() } catch { permission = 'denied'; reconcile(); return snapshot() }
    permissionPromise = Promise.resolve(request).then(result => {
      if (!destroyed && enabled && epoch === permissionEpoch) { permission = result === 'granted' ? 'granted' : 'denied'; reconcile() }
      return snapshot()
    }, () => {
      if (!destroyed && enabled && epoch === permissionEpoch) { permission = 'denied'; reconcile() }
      return snapshot()
    }).finally(() => { if (epoch === permissionEpoch) permissionPromise = null })
    return permissionPromise
  }
  const api = {
    get enabled() { return enabled },
    get motionState() { return motionState },
    async setEnabled(value, { requestMotion = false } = {}) {
      if (destroyed) return snapshot()
      apply(value === true); save(enabled)
      return requestMotion && enabled ? activateMotion() : snapshot()
    },
    activateMotion,
    subscribe(fn) { if (typeof fn !== 'function' || destroyed) return () => {}; subscribers.add(fn); try { fn(snapshot()) } catch { /* ignore settings rendering errors */ }; return () => subscribers.delete(fn) },
    destroy() {
      if (destroyed) return
      apply(false); destroyed = true; permissionEpoch++; drain(cleanups); subscribers.clear()
      if (root && owners.get(root) === api) owners.delete(root)
    },
  }
  listen(win, 'storage', event => { if (event.key === STORAGE_KEY && (event.newValue === 'table' || event.newValue === 'off')) { preference.value = event.newValue; apply(event.newValue === 'table') } }, cleanups)
  listen(win, CHANGE_EVENT, event => { if (event.detail?.source !== api && ['table','off'].includes(event.detail?.value)) { preference.value = event.detail.value; apply(event.detail.value === 'table') } }, cleanups)
  if (root) owners.set(root, api)
  apply(preference.value === 'table')
  if (!enabled) notify()
  return api
}
