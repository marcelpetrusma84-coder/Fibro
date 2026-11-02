import assert from 'node:assert/strict'
import { maakSchaakWallpaper } from '../../schaak-wallpaper.js'

const KEY = 'fibro_chess_wallpaper_v1'
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const cssName = key => String(key).replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())

class Style {
  values = new Map()
  priorities = new Map()
  setProperty(key, value, priority = '') { this.values.set(key, String(value)); this.priorities.set(key, priority) }
  getPropertyValue(key) { return this.values.get(key) || '' }
  getPropertyPriority(key) { return this.priorities.get(key) || '' }
  removeProperty(key) { const before = this.getPropertyValue(key); this.values.delete(key); this.priorities.delete(key); return before }
  get cssText() { return [...this.values].map(([key, value]) => `${key}:${value}${this.getPropertyPriority(key) ? ' !important' : ''};`).join('') }
  set cssText(value) {
    this.values.clear(); this.priorities.clear()
    for (const entry of String(value).split(';')) {
      const colon = entry.indexOf(':')
      if (colon < 0) continue
      const key = entry.slice(0, colon).trim(), raw = entry.slice(colon + 1).trim()
      this.setProperty(key, raw.replace(/\s*!important\s*$/, ''), /!important\s*$/.test(raw) ? 'important' : '')
    }
  }
}
function style() {
  return new Proxy(new Style(), {
    get(target, key, receiver) { return key in target ? Reflect.get(target, key, receiver) : target.getPropertyValue(cssName(key)) },
    set(target, key, value, receiver) {
      if (key in target) return Reflect.set(target, key, value, receiver)
      target.setProperty(cssName(key), value); return true
    }
  })
}
class Events {
  listeners = new Map()
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback) }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback) }
  emit(type, values = {}) { for (const callback of [...(this.listeners.get(type) || [])]) callback({ type, ...values }) }
  dispatchEvent(event) { this.emit(event.type, event); return true }
  count(type) { return type ? this.listeners.get(type)?.size || 0 : [...this.listeners.values()].reduce((total, list) => total + list.size, 0) }
}
class Element extends Events {
  constructor(tag, document) {
    super(); this.tagName = tag.toUpperCase(); this.ownerDocument = document; this.style = style(); this.children = []; this.parentNode = null; this.attributes = new Map(); this.dataset = {}; this.classes = new Set()
    this.classList = {
      add:(...names) => names.forEach(name => this.classes.add(name)),
      remove:(...names) => names.forEach(name => this.classes.delete(name)),
      contains:name => this.classes.has(name),
      toggle:(name, force) => { const on = force ?? !this.classes.has(name); on ? this.classes.add(name) : this.classes.delete(name); return on }
    }
  }
  get className() { return [...this.classes].join(' ') }
  set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)) }
  get parentElement() { return this.parentNode }
  get firstChild() { return this.children[0] || null }
  get firstElementChild() { return this.firstChild }
  get isConnected() { return this._root ? this._connected !== false : this.parentNode?.isConnected || false }
  appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child }
  append(...children) { children.forEach(child => this.appendChild(child)) }
  prepend(child) { child.remove(); child.parentNode = this; this.children.unshift(child) }
  insertBefore(child, before) { if (!before) return this.appendChild(child); child.remove(); child.parentNode = this; this.children.splice(this.children.indexOf(before), 0, child); return child }
  removeChild(child) { const at = this.children.indexOf(child); if (at >= 0) this.children.splice(at, 1); child.parentNode = null; return child }
  remove() { this.parentNode?.removeChild(this) }
  contains(child) { return child === this || this.children.some(node => node.contains(child)) }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'class') this.className = value }
  getAttribute(name) { return name === 'class' ? this.className : this.attributes.get(name) ?? null }
  removeAttribute(name) { this.attributes.delete(name) }
  querySelectorAll(selector) {
    const matches = node => selector === '*' || selector.startsWith('.') && node.classList.contains(selector.slice(1)) || node.tagName.toLowerCase() === selector
    return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)])
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
  getBoundingClientRect() { return { left:100, top:80, right:900, bottom:680, x:100, y:80, width:800, height:600 } }
}
class Document extends Events {
  hidden = false
  visibilityState = 'visible'
  createElement(tag) { return new Element(tag, this) }
  contains(element) { return element.isConnected }
}
class Media extends Events {
  constructor(matches = false) { super(); this.matches = matches }
  addListener(callback) { this.addEventListener('change', callback) }
  removeListener(callback) { this.removeEventListener('change', callback) }
  set(matches) { this.matches = matches; this.emit('change', { matches }) }
}

function fixture({ saved = 'off', permission, secureContext = true, reduced = false, deniedStorage = false, position = 'static', isolation = 'auto', orientation = null } = {}) {
  const document = new Document(), window = new Events(), media = new Media(reduced), frames = new Map(), observers = [], changes = []
  let nextFrame = 0, timestamp = 0, permissionCalls = 0, storageValue = saved
  window.innerWidth = 1000; window.innerHeight = 800; window.isSecureContext = secureContext
  window.CustomEvent = class { constructor(type, { detail }) { this.type = type; this.detail = detail } }
  const root = document.createElement('main'); root._root = true; root.className = 'existing-board-root'
  root.style.setProperty('position', position, 'important'); root.style.setProperty('isolation', isolation, 'important'); root.style.setProperty('color', 'rgb(1, 2, 3)')
  const board = document.createElement('section'), camera = document.createElement('video')
  board.className = 'existing-board'; camera.className = 'existing-camera'; camera.srcObject = { live:true }
  root.append(board, camera)
  const originalStyles = root.style.cssText, originalChildren = [...root.children]
  const originalProperties = [...root.style.values].sort(), originalPriorities = [...root.style.priorities].sort()
  const orientationEvent = permission === undefined ? orientation : { requestPermission() { permissionCalls++; return typeof permission === 'function' ? permission() : Promise.resolve(permission) } }
  const storage = {
    getItem(key) { assert.equal(key, KEY); if (deniedStorage) throw Error('storage denied'); return storageValue },
    setItem(key, value) { assert.equal(key, KEY); if (deniedStorage) throw Error('storage denied'); storageValue = String(value) }
  }
  const options = {
    root, eventTarget:window, documentTarget:document, storage, reducedMotion:media,
    orientationEvent, secureContext,
    getComputedStyle:element => ({ position:element.style.getPropertyValue('position') || 'static', isolation:element.style.getPropertyValue('isolation') || 'auto' }),
    requestFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id }, cancelFrame:id => frames.delete(id),
    MutationObserver:class { constructor(callback) { this.callback = callback; observers.push(this) } observe() {} disconnect() { this.disconnected = true } },
    isVisible:element => element.isConnected && !document.hidden,
    onChange:state => changes.push(state)
  }
  const wallpaper = maakSchaakWallpaper(options)
  return {
    wallpaper, options, root, board, camera, document, window, media, frames, observers, changes, originalStyles, originalProperties, originalPriorities, originalChildren,
    get saved() { return storageValue }, get permissionCalls() { return permissionCalls },
    layer:() => root.querySelector('.sch-wallpaper-layer'),
    photo:() => root.querySelector('.sch-wallpaper-photo'),
    glare:() => root.querySelector('.sch-wallpaper-glare'),
    flush(count = 120) {
      for (let i = 0; i < count && frames.size; i++) {
        assert(frames.size <= 1, 'all inputs share one scheduled animation frame')
        const callbacks = [...frames.values()]; frames.clear(); timestamp += 16
        callbacks.forEach(callback => callback(timestamp))
      }
    },
    hide(hidden) { document.hidden = hidden; document.visibilityState = hidden ? 'hidden' : 'visible'; document.emit('visibilitychange') },
    detach() { root._connected = false; for (const observer of observers) if (!observer.disconnected) observer.callback([{ removedNodes:[root] }]) }
  }
}

const noMotionWork = h => {
  assert.equal(h.frames.size, 0, 'inactive wallpaper leaves no pending animation frame')
  assert.equal(h.window.count('deviceorientation'), 0, 'inactive wallpaper detaches sensor input')
  assert.equal(h.window.count('pointermove'), 0, 'inactive wallpaper detaches pointer input')
}
const restored = h => {
  assert.equal(h.layer(), null)
  assert.equal(h.root.classList.contains('sch-wallpaper-active'), false)
  assert.equal(h.root.classList.contains('existing-board-root'), true)
  assert.deepEqual([...h.root.style.values].sort(), h.originalProperties, 'root style values are restored exactly')
  assert.deepEqual([...h.root.style.priorities].sort(), h.originalPriorities, 'root !important priorities are restored exactly')
  assert.deepEqual(h.root.children, h.originalChildren, 'board and camera nodes retain their identity')
  assert.equal(h.camera.srcObject.live, true)
}
const boundedMotion = h => {
  for (const [element, limits] of [[h.photo(), [18, 14]], [h.glare(), [26, 20]]]) {
    const pixels = [...element.style.transform.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]))
    assert.equal(pixels.length, 2)
    pixels.forEach((value, axis) => assert(Math.abs(value) <= limits[axis], 'parallax stays inside its small physical bounds'))
  }
  for (const [axis, limit] of [['X',1.4], ['Y',1.8], ['Z',.35]]) {
    const angle = Number(new RegExp('rotate' + axis + '\\((-?[\\d.]+)deg\\)').exec(h.photo().style.transform)?.[1])
    assert(Number.isFinite(angle) && Math.abs(angle) <= limit, 'room rotation stays bounded')
  }
}

// Existing device preferences opt in explicitly; unrelated/legacy strings do
// not enable a background or ask a phone for sensor access.
for (const saved of [null, '', 'off', 'true', 'wood', '{broken']) {
  const h = fixture({ saved, permission:'granted' })
  assert.equal(h.wallpaper.enabled, false)
  assert.equal(h.wallpaper.motionState, 'off')
  assert.equal(h.permissionCalls, 0)
  noMotionWork(h); restored(h)
  await h.wallpaper.activateMotion()
  assert.equal(h.permissionCalls, 0, 'a hidden/off effect never requests sensor permission')
  h.wallpaper.destroy()
}

{
  const h = fixture()
  let notifications = 0
  const unsubscribe = h.wallpaper.subscribe(() => notifications++)
  await h.wallpaper.setEnabled(true)
  assert.equal(h.wallpaper.enabled, true); assert.equal(h.saved, 'table')
  assert.equal(h.root.classList.contains('sch-wallpaper-active'), true)
  assert.equal(h.root.style.position, 'relative'); assert.equal(h.root.style.isolation, 'isolate')
  assert.equal(h.layer().style.pointerEvents, 'none', 'the wallpaper never intercepts board or webcam controls')
  assert.equal(h.layer().style.position, 'fixed'); assert.equal(h.layer().style.zIndex, '-1')
  assert.match(h.photo().style.backgroundImage, /assets\/chess\/walnut-table-room\.png/)
  assert(h.glare()); assert(h.root.querySelector('.sch-wallpaper-shade'))
  assert.equal(h.root.querySelectorAll('.sch-wallpaper-layer').length, 1)
  const layer = h.layer(), photo = h.photo()
  await h.wallpaper.setEnabled(true)
  assert.equal(h.layer(), layer); assert.equal(h.photo(), photo, 'repeated enable keeps one mounted effect')
  assert(notifications > 0); const notified = notifications
  unsubscribe()
  await h.wallpaper.setEnabled(false)
  assert.equal(h.saved, 'off'); assert.equal(notifications, notified)
  noMotionWork(h); restored(h)
  h.wallpaper.destroy(); h.wallpaper.destroy()
  await h.wallpaper.setEnabled(true)
  assert.equal(h.wallpaper.enabled, false, 'destroyed effects cannot reactivate')
  noMotionWork(h); restored(h)
}

{
  const h = fixture({ saved:'table', position:'absolute', isolation:'isolate' })
  await tick()
  assert.equal(h.wallpaper.enabled, true)
  assert.equal(h.root.style.position, 'absolute', 'existing positioned roots are preserved')
  assert.equal(h.root.style.getPropertyPriority('position'), 'important')
  assert.equal(h.permissionCalls, 0, 'restoring an enabled wallpaper never prompts automatically')
  await h.wallpaper.setEnabled(false); restored(h); noMotionWork(h)
  h.wallpaper.destroy()
}

{
  const h = fixture({ deniedStorage:true })
  assert.equal(h.wallpaper.enabled, false)
  await h.wallpaper.setEnabled(true)
  assert.equal(h.wallpaper.enabled, true, 'unavailable storage still permits an in-memory opt-in')
  await h.wallpaper.setEnabled(false)
  restored(h); noMotionWork(h); h.wallpaper.destroy()
}

{
  const h = fixture()
  await h.wallpaper.setEnabled(true)
  assert.equal(h.wallpaper.motionState, 'pointer')
  h.flush(); const resting = h.photo().style.transform
  for (const event of [{ pointerType:'touch', buttons:0 }, { pointerType:'pen', buttons:0 }, { pointerType:'mouse', buttons:1 }]) {
    h.window.emit('pointermove', { ...event, clientX:900, clientY:680 }); h.flush()
    assert.equal(h.photo().style.transform, resting, 'touch, stylus and dragging never move the room')
  }
  h.window.emit('pointermove', { pointerType:'mouse', buttons:0, clientX:100000, clientY:-100000 })
  assert(h.frames.size > 0)
  h.flush()
  assert.notEqual(h.photo().style.transform, resting, 'pointer movement creates a subtle depth effect')
  assert(!/NaN|Infinity/.test(h.photo().style.transform))
  boundedMotion(h)
  const atEdge = h.photo().style.transform
  h.window.emit('pointermove', { pointerType:'mouse', buttons:0, clientX:NaN, clientY:Infinity }); h.flush()
  assert.equal(h.photo().style.transform, atEdge, 'invalid pointer coordinates cannot corrupt the CSS transform')
  h.hide(true); noMotionWork(h)
  assert(h.layer(), 'background remains static while the document is hidden')
  h.hide(false)
  assert(h.window.count('pointermove') > 0)
  h.media.set(true); noMotionWork(h)
  assert.equal(h.wallpaper.motionState, 'reduced')
  assert(h.layer(), 'reduced motion keeps the static room image')
  h.media.set(false)
  assert(h.window.count('pointermove') > 0)
  h.wallpaper.destroy(); restored(h); noMotionWork(h)
  assert.equal(h.window.count(), 0); assert.equal(h.document.count(), 0); assert.equal(h.media.count(), 0)
}

{
  const h = fixture({ permission:'granted' })
  await h.wallpaper.setEnabled(true)
  assert.equal(h.permissionCalls, 0)
  await h.wallpaper.activateMotion()
  assert.equal(h.permissionCalls, 1)
  assert.equal(h.wallpaper.motionState, 'motion')
  assert.equal(h.window.count('deviceorientation'), 1)
  h.window.emit('deviceorientation', { beta:10, gamma:5 }); h.flush()
  const before = h.photo().style.transform
  h.window.emit('deviceorientation', { beta:80, gamma:80 }); h.flush()
  assert.notEqual(h.photo().style.transform, before)
  assert(!/NaN|Infinity/.test(h.photo().style.transform))
  boundedMotion(h)
  h.hide(true); noMotionWork(h)
  h.hide(false)
  assert.equal(h.window.count('deviceorientation'), 1)
  assert.equal(h.permissionCalls, 1, 'visibility recovery never requests permission again')
  h.media.set(true); noMotionWork(h)
  h.media.set(false)
  assert.equal(h.window.count('deviceorientation'), 1)
  h.wallpaper.destroy(); noMotionWork(h); restored(h)
}

for (const permission of ['denied', () => Promise.reject(Error('permission unavailable'))]) {
  const h = fixture({ permission })
  await h.wallpaper.setEnabled(true, { requestMotion:true })
  assert.equal(h.permissionCalls, 1)
  assert.equal(h.wallpaper.motionState, 'denied')
  assert.equal(h.window.count('deviceorientation'), 0)
  assert(h.window.count('pointermove') > 0, 'denied sensors retain a working pointer fallback')
  h.wallpaper.destroy(); noMotionWork(h); restored(h)
}

{
  const h = fixture({ permission:'granted', secureContext:false })
  await h.wallpaper.setEnabled(true, { requestMotion:true })
  assert.equal(h.permissionCalls, 0, 'an insecure page never requests protected sensor access')
  assert.notEqual(h.wallpaper.motionState, 'motion')
  assert.equal(h.window.count('deviceorientation'), 0)
  h.wallpaper.destroy(); restored(h); noMotionWork(h)
}
{
  const h = fixture({ permission:'granted', reduced:true })
  await h.wallpaper.setEnabled(true, { requestMotion:true })
  assert.equal(h.wallpaper.motionState, 'reduced')
  assert.equal(h.permissionCalls, 0, 'reduced-motion users never receive an unnecessary permission prompt')
  noMotionWork(h)
  h.wallpaper.destroy(); restored(h)
}
{
  const h = fixture({ permission:'granted' })
  h.hide(true)
  await h.wallpaper.setEnabled(true, { requestMotion:true })
  assert.equal(h.permissionCalls, 0, 'a hidden board cannot trigger a sensor prompt')
  noMotionWork(h)
  h.hide(false)
  await h.wallpaper.activateMotion()
  assert.equal(h.permissionCalls, 1)
  assert.equal(h.wallpaper.motionState, 'motion')
  h.wallpaper.destroy(); restored(h); noMotionWork(h)
}
{
  const h = fixture({ orientation:{} })
  await h.wallpaper.setEnabled(true, { requestMotion:true })
  assert.equal(h.permissionCalls, 0, 'sensors without a permission API work without an artificial prompt')
  assert.equal(h.wallpaper.motionState, 'motion')
  h.window.screen = { orientation:{ angle:NaN } }
  h.window.emit('deviceorientation', { beta:10, gamma:5 })
  h.window.emit('deviceorientation', { beta:60, gamma:65 }); h.flush()
  boundedMotion(h)
  assert(!/NaN|Infinity/.test(h.photo().style.transform), 'invalid screen orientation cannot poison a sensor transform')
  const before = h.photo().style.transform
  h.window.emit('deviceorientation', { beta:NaN, gamma:Infinity }); h.flush()
  assert.equal(h.photo().style.transform, before, 'invalid sensor samples are ignored')
  h.wallpaper.destroy(); restored(h); noMotionWork(h)
}

{
  const grants = [deferred(), deferred()]
  let request = 0
  const h = fixture({ permission:() => grants[request++].promise })
  const oldEnable = h.wallpaper.setEnabled(true, { requestMotion:true })
  const duplicate = h.wallpaper.activateMotion()
  assert.equal(h.permissionCalls, 1, 'concurrent requests share the same permission prompt')
  await h.wallpaper.setEnabled(false)
  const newEnable = h.wallpaper.setEnabled(true, { requestMotion:true })
  assert.equal(h.permissionCalls, 2)
  grants[0].resolve('granted'); await oldEnable; await duplicate
  assert.equal(h.window.count('deviceorientation'), 0, 'an old grant cannot authorize a newly enabled lifetime')
  assert.equal(h.wallpaper.motionState, 'permission')
  grants[1].resolve('granted'); await newEnable
  assert.equal(h.window.count('deviceorientation'), 1)
  assert.equal(h.wallpaper.motionState, 'motion')
  h.wallpaper.destroy(); restored(h); noMotionWork(h)
}

for (const action of ['off','destroy','hide','reduce']) {
  const grant = deferred(), h = fixture({ permission:() => grant.promise })
  const enabling = h.wallpaper.setEnabled(true, { requestMotion:true })
  assert.equal(h.permissionCalls, 1, 'the permission request starts synchronously within the initiating gesture')
  if (action === 'off') await h.wallpaper.setEnabled(false)
  else if (action === 'destroy') h.wallpaper.destroy()
  else if (action === 'hide') h.hide(true)
  else h.media.set(true)
  grant.resolve('granted'); await enabling; await tick()
  noMotionWork(h)
  if (action === 'off' || action === 'destroy') { assert.equal(h.wallpaper.enabled, false); restored(h) }
  else assert(h.layer(), 'suspended motion retains the static wallpaper')
  h.wallpaper.destroy(); restored(h); noMotionWork(h)
}

{
  const h = fixture({ saved:'table' })
  await tick(); h.window.emit('pointermove', { pointerType:'mouse', buttons:0, clientX:800, clientY:600 })
  h.detach()
  noMotionWork(h)
  h.wallpaper.destroy(); restored(h)
}

{
  const h = fixture({ saved:'table' })
  const replacement = maakSchaakWallpaper(h.options)
  assert.equal(replacement.enabled, true)
  assert.equal(h.root.querySelectorAll('.sch-wallpaper-layer').length, 1, 'switching chess modes on one overlay retains one owned layer')
  h.wallpaper.destroy()
  assert.equal(replacement.enabled, true, 'delayed old-board cleanup cannot destroy the replacement effect')
  assert.equal(h.root.classList.contains('sch-wallpaper-active'), true)
  assert.equal(h.root.style.isolation, 'isolate')
  replacement.destroy()
  restored(h); noMotionWork(h)
  assert.equal(h.window.count(), 0); assert.equal(h.document.count(), 0); assert.equal(h.media.count(), 0)
}

console.log('PASS: opt-in chess wallpaper, preserved board/camera/style identity, bounded pointer/sensor motion, explicit permissions and stale grants, reduced/hidden lifecycle, denied storage and complete disposal.')
