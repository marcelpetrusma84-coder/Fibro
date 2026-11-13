// Test de scenelaag met nagebootste DOM en sensoren, zonder browser of netwerk.
import assert from 'node:assert/strict'
import { maakKoningsjachtScene } from '../../koningsjacht-scene.js'

class Events {
  listeners = new Map()
  addEventListener(type, fn) { const set = this.listeners.get(type) || new Set(); set.add(fn); this.listeners.set(type, set) }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
  emit(type, event = {}) { for (const fn of [...(this.listeners.get(type) || [])]) fn(event) }
  count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0) }
}

class Style {
  values = new Map()
  setProperty(name, value, priority = '') { this.values.set(name, [value, priority]) }
  getPropertyValue(name) { return this.values.get(name)?.[0] || '' }
  getPropertyPriority(name) { return this.values.get(name)?.[1] || '' }
  removeProperty(name) { this.values.delete(name) }
}

class Element extends Events {
  constructor(doc) {
    super()
    this.ownerDocument = doc; this.style = new Style(); this.dataset = {}; this.children = []
    this.classes = new Set(); this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), contains: c => this.classes.has(c) }
    this.isConnected = true
  }
  setAttribute(name, value) { this[name] = String(value) }
  removeAttribute(name) { delete this[name] }
  appendChild(child) { child.parentNode = this; this.children.push(child) }
  append(...children) { children.forEach(child => this.appendChild(child)) }
  prepend(child) { child.parentNode = this; this.children.unshift(child) }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null }
  getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 100 } }
  matches() { return false }
}

function omgeving({ reduced = false, sensor = false, toestemming } = {}) {
  const motion = new Events(); motion.matches = reduced
  const doc = new Events(); doc.hidden = false; doc.visibilityState = 'visible'
  doc.createElement = () => new Element(doc)
  const win = new Events(); win.isSecureContext = true; win.matchMedia = () => motion
  win.screen = { orientation: new Events() }; win.screen.orientation.angle = 0
  if (sensor) { win.DeviceOrientationEvent = {}; if (toestemming) win.DeviceOrientationEvent.requestPermission = toestemming }
  const frames = new Map(); let next = 0
  win.requestAnimationFrame = fn => { const id = ++next; frames.set(id, fn); return id }
  win.cancelAnimationFrame = id => frames.delete(id)
  doc.defaultView = win
  const root = new Element(doc)
  function flush() { for (let i = 0; i < 500 && frames.size; i++) { const tasks = [...frames.values()]; frames.clear(); tasks.forEach(fn => fn()) } }
  const muis = (x, target = root) => root.emit('pointermove', { pointerType: 'mouse', clientX: x, clientY: 50, buttons: 0, target, composedPath: () => [target, root] })
  return { root, doc, win, motion, frames, flush, muis }
}

// Standaard is de beweging uit en brandt de kaars rustig met flikkering aan.
{
  const o = omgeving(), scene = maakKoningsjachtScene(o.root)
  assert.equal(scene.bewegingsStatus, 'uit')
  assert.equal(scene.laag.dataset.flikkeren, 'aan')
  assert.match(scene.decorLayer.style.backgroundImage, /wood-table\.png/)
  assert.equal(o.root.classList.contains('kj-scene-actief'), true)
  o.muis(200); o.flush()
  assert.ok(['', '0.00px'].includes(o.root.style.getPropertyValue('--kj-scene-x')))
  scene.update({ flikkeren: false, middeleeuws: true, bierpul: true })
  assert.equal(scene.laag.dataset.flikkeren, 'uit')
  assert.match(scene.decorLayer.style.backgroundImage, /medieval-scene\.png/)
  assert.equal(scene.bierLayer.children[0].hidden, false)
  assert.match(scene.bierLayer.children[0].children[0].src, /beer-medieval\.png/)
  scene.update({ bierInhoud: 34, bierOorRechts: false, eigenNaam: 'Ik', anderBier: { zichtbaar: true, inhoud: 72, oorRechts: true, naam: 'Vriend' } })
  const [eigen, ander] = scene.bierLayer.children
  assert.equal(eigen.children[0].style.transform, 'scaleX(-1)')
  assert.equal(eigen.children[1].children[0].style.height, '34%')
  assert.equal(ander.hidden, false)
  assert.equal(ander.children[1].children[0].style.height, '72%')
  assert.equal(ander.children[2].children[0].textContent, 'Vriend')
  assert.match(eigen.children[0].src, /beer-medieval-empty\.png/)
  assert.equal(eigen.children[2].children.length, 1, 'geen zichtbaar percentage naast de naam')
  scene.update({ bierInhoud: 95, middeleeuws: false })
  assert.match(eigen.children[0].src, /beer-modern-full\.png/, 'volle moderne pul toont schuim')
  scene.update({ bierInhoud: 94 })
  assert.match(eigen.children[0].src, /beer-modern\.png/, 'niet-volle moderne pul gebruikt de gewone afbeelding')
  scene.update({ bierpul: false })
  assert.equal(scene.bierLayer.children[0].hidden, true)
  scene.stop()
  assert.equal(o.root.children.length, 0)
  assert.equal(o.root.classList.contains('kj-scene-actief'), false)
  assert.equal(o.root.count(), 0); assert.equal(o.win.count(), 0); assert.equal(o.doc.count(), 0)
}

// Directe bediening blijft bruikbaar met aanraking, muis en toetsenbord.
{
  const o = omgeving(), meldingen = []
  const scene = maakKoningsjachtScene(o.root, { bierpul: true, onBierInhoud: (niveau, klaar) => meldingen.push([niveau, klaar]), bierLabel: 'Eigen bierpul' })
  const pul = scene.bierLayer.children[0]
  const event = extra => ({ preventDefault() {}, stopPropagation() {}, isPrimary: true, button: 0, pointerId: 7, ...extra })
  assert.equal(pul.role, 'slider'); assert.equal(pul['aria-label'], 'Eigen bierpul')
  pul.emit('pointerdown', event({ pointerType: 'touch', clientY: 75 }))
  assert.deepEqual(meldingen.at(-1), [25, false])
  o.win.emit('pointermove', event({ pointerType: 'touch', clientY: 40 }))
  assert.deepEqual(meldingen.at(-1), [60, false])
  o.win.emit('pointermove', event({ pointerId: 8, clientY: 5 }))
  assert.deepEqual(meldingen.at(-1), [60, false], 'andere vinger verandert de pul niet')
  o.win.emit('pointerup', event({ clientY: -5 }))
  assert.deepEqual(meldingen.at(-1), [100, true], 'afgeronde sleep wordt begrensd op 100')
  assert.equal(pul['aria-valuenow'], '100')
  pul.emit('keydown', event({ key: 'ArrowDown', shiftKey: true }))
  assert.deepEqual(meldingen.at(-1), [90, true])
  pul.emit('keydown', event({ key: 'Home' }))
  assert.deepEqual(meldingen.at(-1), [0, true])
  pul.emit('keydown', event({ key: 'End' }))
  assert.deepEqual(meldingen.at(-1), [100, true])
  pul.emit('pointerdown', event({ pointerType: 'mouse', clientY: 80 }))
  o.win.emit('pointercancel', event())
  assert.deepEqual(meldingen.at(-1), [20, true], 'afgebroken sleep publiceert de laatste stand')
  scene.stop()
  assert.equal(pul.count(), 0); assert.equal(o.win.count(), 0)
}

// Muisbeweging beïnvloedt alleen de achtergrond en stopt bij de speelbediening.
{
  const o = omgeving(), scene = maakKoningsjachtScene(o.root, { beweging: true })
  assert.equal(scene.bewegingsStatus, 'muis')
  o.muis(200); o.flush()
  assert.equal(o.root.style.getPropertyValue('--kj-scene-x'), '9.00px')
  const knop = new Element(o.doc); knop.matches = () => true
  o.muis(0, knop); o.flush()
  assert.equal(o.root.style.getPropertyValue('--kj-scene-x'), '9.00px')
  scene.update({ beweging: false })
  assert.equal(o.root.style.getPropertyValue('--kj-scene-x'), '0.00px')
  scene.stop()
}

// Een gebruiker met verminderde beweging krijgt een stil beeld.
{
  const o = omgeving({ reduced: true }), scene = maakKoningsjachtScene(o.root, { beweging: true, flikkeren: true })
  assert.equal(scene.bewegingsStatus, 'verminderde-beweging')
  assert.equal(scene.laag.dataset.flikkeren, 'uit')
  o.muis(200); o.flush()
  assert.equal(o.root.style.getPropertyValue('--kj-scene-x'), '0.00px')
  o.motion.matches = false; o.motion.emit('change')
  assert.equal(scene.laag.dataset.flikkeren, 'aan')
  scene.stop()
}

// Sensortoestemming mag alleen op verzoek en een eerste meting stelt de nulstand in.
{
  let aanvragen = 0
  const o = omgeving({ sensor: true, toestemming: () => { aanvragen++; return Promise.resolve('granted') } })
  const scene = maakKoningsjachtScene(o.root, { beweging: true })
  assert.equal(scene.bewegingsStatus, 'toestemming-nodig'); assert.equal(aanvragen, 0)
  assert.equal(await scene.verplaatsingsToestemming(), 'toegestaan'); assert.equal(aanvragen, 1)
  o.win.emit('deviceorientation', { beta: 10, gamma: 0 }); o.flush()
  assert.ok(['', '0.00px'].includes(o.root.style.getPropertyValue('--kj-scene-x')))
  o.win.emit('deviceorientation', { beta: 10, gamma: 28 }); o.flush()
  assert.equal(o.root.style.getPropertyValue('--kj-scene-x'), '9.00px')
  scene.stop()
}

// Een tweede scene ruimt de oude listeners en animatie op.
{
  const o = omgeving(), eerste = maakKoningsjachtScene(o.root, { beweging: true })
  o.muis(200)
  const tweede = maakKoningsjachtScene(o.root)
  assert.equal(eerste.bewegingsStatus, 'uit')
  assert.equal(o.root.children.length, 2)
  assert.equal(o.frames.size, 0)
  tweede.stop()
  assert.equal(o.root.count(), 0)
}

console.log('Koningsjacht scene: voorkeuren, beweging, sensoren en opruimen goed')
