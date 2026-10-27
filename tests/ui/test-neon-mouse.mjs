import assert from 'node:assert/strict'
import { maakNeonMuis, muisPunt } from '../../neon-raiders-input.js'

const values = new Map()
const opslag = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
const muis = maakNeonMuis({ opslag })
const neer = { pointerType: 'mouse', button: 0, buttons: 1 }
const dubbel = { button: 0 }
const schip = { x: 100, y: 200, width: 36, height: 44 }
assert.equal(muis.modus, 'slepen', 'the existing drag mode remains the default')
muis.neer(neer, { x: 100, y: 200 })
assert.equal(muis.vuurt, true)
assert.equal(muis.stap(schip, .016), null, 'drag mode does not track an absolute mouse target')
assert.equal(muis.wissel(dubbel, { x: 140, y: 200 }, schip), false, 'double-clicking away from own ship does not change mode')
assert.equal(muis.wissel({ ...dubbel, button: 2 }, schip, schip), false)
assert.equal(muis.wissel(dubbel, schip, schip), true)
assert.equal(muis.modus, 'volgen')
assert.equal(muis.vuurt, false, 'switching mode releases the double-click button')
assert.equal(maakNeonMuis({ opslag }).modus, 'volgen', 'the mouse preference persists')

muis.beweeg({ pointerType: 'mouse', buttons: 0 }, { x: 400, y: 600 })
const stap = muis.stap(schip, .02)
assert.ok(Math.abs(Math.hypot(stap.x, stap.y) - 5) < 1e-9, 'free mouse movement steers at normal keyboard speed without a button')
assert.equal(muis.vuurt, false, 'following without a button never starts shooting')
assert.ok(Math.hypot(...Object.values(muis.stap(schip, 10))) <= 12.5 + 1e-9, 'long frames never teleport the ship')
muis.neer(neer, { x: 103, y: 204 })
assert.equal(muis.vuurt, true, 'left click shoots in follow mode')
assert.deepEqual(muis.stap(schip, .05), { x: 3, y: 4 }, 'the target is not overshot')
muis.los({ pointerType: 'mouse', button: 0 })
assert.equal(muis.vuurt, false)
muis.verlorenVangst()
assert.deepEqual(muis.stap(schip, .05), { x: 3, y: 4 }, 'ordinary mouseup and automatic capture release preserve the follow target')
muis.neer(neer, { x: 300, y: 400 })
muis.los({ pointerType: 'mouse', button: 0 })
muis.verlorenVangst()
let positie = { x: schip.x, y: schip.y }
for (let frame = 0; frame < 100; frame++) {
  const verder = muis.stap(positie, .02)
  if (verder) positie = { x: positie.x + verder.x, y: positie.y + verder.y }
}
assert.deepEqual(positie, { x: 300, y: 400 }, 'the ship reaches a distant clicked target without holding the button or moving the pointer again')
muis.neer(neer, { x: 300, y: 400 })
muis.verlorenVangst()
assert.equal(muis.vuurt, false, 'unexpected capture loss releases a held fire button')
assert.equal(muis.stap(schip, .02), null, 'unexpected capture loss while held clears the target')
muis.neer(neer, schip)
muis.beweeg({ pointerType: 'mouse', buttons: 0 }, schip)
assert.equal(muis.vuurt, false, 'a missed mouseup is repaired on the next pointermove')
muis.neer(neer, schip)
muis.stopVolgen()
assert.equal(muis.stap(schip, .016), null, 'keyboard/controller input can discard the old mouse target')
assert.equal(muis.vuurt, true, 'keyboard steering does not release a held fire button')
muis.leeg()
assert.equal(muis.vuurt, false)
assert.equal(muis.stap(schip, .016), null, 'blur/cancel removes both held fire and the target')

for (const type of ['touch', 'pen']) {
  muis.neer({ pointerType: type, button: 0 }, schip)
  assert.equal(muis.wissel(dubbel, schip, schip), false, `${type} double-tap cannot toggle PC controls`)
  muis.beweeg({ pointerType: type, buttons: 1 }, { x: 300, y: 300 })
  assert.equal(muis.stap(schip, .016), null, `${type} remains under existing relative touch controls`)
}
muis.neer(neer, schip)
assert.equal(muis.wissel({ ...dubbel, sourceCapabilities: { firesTouchEvents: true } }, schip, schip), false)
assert.equal(muis.wissel(dubbel, schip, schip), true, 'a real second double-click returns to drag')
assert.equal(muis.modus, 'slepen')

assert.deepEqual(muisPunt({ clientX: 150, clientY: 210 }, { left: 50, top: 10, width: 200, height: 400 }, 360, 720), { x: 180, y: 360 }, 'CSS-scaled canvas coordinates map to the logical game world')
assert.equal(muisPunt({ clientX: NaN, clientY: 0 }, { left: 0, top: 0, width: 1, height: 1 }, 360, 640), null)
assert.equal(muisPunt({ clientX: 0, clientY: 0 }, { width: 0, height: 0 }, 360, 640), null)
assert.equal(maakNeonMuis({ opslag: { getItem() { throw Error('blocked') } } }).modus, 'slepen', 'blocked storage never prevents playing')
console.log('PASS: Neon Raiders drag/follow, own-ship double-click, mouse-only selection, fire, scaled coordinates, speed and input cleanup.')
