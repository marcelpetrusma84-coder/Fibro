import assert from 'node:assert/strict'
import { koppelNeonVerder } from '../../neon-raiders-verder.js'

class FakeClock {
  now = 0
  nextId = 0
  timers = new Map()

  setTimeout = (callback, delay = 0, ...args) => {
    const id = ++this.nextId
    this.timers.set(id, { due: this.now + Math.max(0, Number(delay)), callback, args })
    return id
  }
  clearTimeout = id => this.timers.delete(id)
  tick(milliseconds) {
    const end = this.now + milliseconds
    while (true) {
      const next = [...this.timers].filter(([, timer]) => timer.due <= end)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0]
      if (!next) break
      const [id, timer] = next
      this.now = timer.due
      this.timers.delete(id)
      timer.callback(...timer.args)
    }
    this.now = end
  }
}

class Surface extends EventTarget {
  hidden = false
  emit(type, properties = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    for (const [name, value] of Object.entries(properties)) {
      Object.defineProperty(event, name, { value, configurable: true })
    }
    this.dispatchEvent(event)
    return event
  }
}

class Button extends Surface {
  disabled = false
  attributes = new Map()
  classes = new Set()
  classList = {
    add: name => this.classes.add(name),
    remove: name => this.classes.delete(name),
    contains: name => this.classes.has(name)
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  getBoundingClientRect() {
    return { left: 10, top: 20, right: 210, bottom: 80, width: 200, height: 60 }
  }
}

let passed = 0
function check(name, body, level = 4) {
  const clock = new FakeClock()
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  globalThis.setTimeout = clock.setTimeout
  globalThis.clearTimeout = clock.clearTimeout
  const start = new Button(), further = new Button()
  const windowTarget = new Surface(), documentTarget = new Surface()
  const state = { level, ready: true, restartScreen: true, leader: true }
  const starts = []
  const control = koppelNeonVerder({
    startKnop: start,
    verderKnop: further,
    kanTonen: () => state.level > 1 && state.ready && state.restartScreen && state.leader && !start.disabled && !start.hidden,
    onStart: () => starts.push(1),
    windowTarget, documentTarget
  })
  const pointer = (type, properties = {}) => start.emit(type, {
    button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true,
    pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 50, ...properties
  })
  const keyboard = (type, code = 'Space', properties = {}) => start.emit(type, { code, repeat: false, ...properties })
  const click = () => start.emit('click', { detail: 1 })
  try {
    body({ clock, start, further, windowTarget, documentTarget, state, starts, control, pointer, keyboard, click })
    passed++
  } catch (error) {
    error.message = `${name}: ${error.message}`
    throw error
  } finally {
    control.destroy()
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
}

check('binding and reset hide a previously visible shortcut', ({ start, further, control, pointer, clock }) => {
  assert.equal(further.hidden, true)
  assert.equal(start.getAttribute('aria-expanded'), 'false')
  pointer('pointerdown')
  clock.tick(3000)
  assert.equal(further.hidden, false)
  control.reset()
  assert.equal(further.hidden, true)
  assert.equal(start.getAttribute('aria-expanded'), 'false')
  assert.equal(start.classList.contains('nr-vasthouden'), false)
})

for (let level = 2; level <= 7; level++) {
  check(`saved level ${level} stays hidden on the initial screen`, ({ state, pointer, clock, further }) => {
    state.restartScreen = false
    pointer('pointerdown')
    clock.tick(5000)
    assert.equal(further.hidden, true)
  }, level)

  check(`level ${level} requires one uninterrupted three-second hold`, ({ pointer, clock, further, starts, click, start }) => {
    assert.equal(further.hidden, true)
    pointer('pointerdown')
    clock.tick(2999)
    assert.equal(further.hidden, true)
    clock.tick(1)
    assert.equal(further.hidden, false)
    assert.equal(start.getAttribute('aria-expanded'), 'true')
    pointer('pointerup')
    assert.equal(click().defaultPrevented, true)
    assert.deepEqual(starts, [], 'release of a completed hold must not restart level one')
  }, level)
}

check('release at 2999 ms remains a normal restart', ({ pointer, clock, further, starts, click }) => {
  pointer('pointerdown')
  clock.tick(2999)
  pointer('pointerup')
  assert.equal(further.hidden, true)
  click()
  assert.deepEqual(starts, [1])
  clock.tick(5000)
  assert.equal(further.hidden, true, 'the released hold has no late reveal')
})

check('a short click at level one still starts level one', ({ pointer, clock, starts, click, further }) => {
  pointer('pointerdown')
  clock.tick(100)
  pointer('pointerup')
  click()
  assert.deepEqual(starts, [1])
  assert.equal(further.hidden, true)
}, 1)

for (const code of ['Space', 'Enter', 'NumpadEnter']) {
  check(`${code} short release starts exactly once`, ({ keyboard, clock, starts, further }) => {
    assert.equal(keyboard('keydown', code).defaultPrevented, true, 'native keydown activation is suppressed')
    clock.tick(2999)
    assert.equal(keyboard('keyup', code).defaultPrevented, true, 'native keyup activation is suppressed')
    assert.deepEqual(starts, [1])
    clock.tick(5000)
    assert.equal(further.hidden, true)
  })

  check(`${code} repeat neither restarts nor postpones the hold`, ({ keyboard, clock, starts, further }) => {
    keyboard('keydown', code)
    clock.tick(1000)
    assert.equal(keyboard('keydown', code, { repeat: true }).defaultPrevented, true)
    clock.tick(1999)
    assert.equal(further.hidden, true)
    clock.tick(1)
    assert.equal(further.hidden, false)
    assert.equal(keyboard('keyup', code).defaultPrevented, true)
    assert.deepEqual(starts, [])
  })
}

check('keyboard activation without an eligible shortcut still starts once', ({ state, keyboard, clock, starts, further }) => {
  state.restartScreen = false
  keyboard('keydown', 'Enter')
  clock.tick(100)
  keyboard('keydown', 'Enter', { repeat: true })
  keyboard('keyup', 'Enter')
  assert.deepEqual(starts, [1])
  assert.equal(further.hidden, true)
})

check('button focus loss cancels a keyboard hold before keyup moves elsewhere', ({ keyboard, clock, start, further, starts }) => {
  keyboard('keydown')
  clock.tick(1500)
  start.emit('blur')
  new Surface().emit('keyup', { code: 'Space' })
  clock.tick(5000)
  assert.equal(further.hidden, true)
  assert.deepEqual(starts, [])
  assert.equal(start.classList.contains('nr-vasthouden'), false)
})

check('Escape cancels a keyboard hold', ({ keyboard, clock, further, starts }) => {
  keyboard('keydown', 'Enter')
  clock.tick(1500)
  keyboard('keydown', 'Escape')
  keyboard('keyup', 'Enter')
  clock.tick(5000)
  assert.equal(further.hidden, true)
  assert.deepEqual(starts, [])
})

for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture']) {
  check(`${type} cancels without restart and a new hold starts from zero`, ({ pointer, clock, further, starts, click }) => {
    pointer('pointerdown')
    clock.tick(2000)
    pointer(type)
    pointer('pointerup')
    click()
    clock.tick(2000)
    assert.equal(further.hidden, true)
    assert.deepEqual(starts, [])
    pointer('pointerdown')
    clock.tick(2999)
    assert.equal(further.hidden, true)
    clock.tick(1)
    assert.equal(further.hidden, false)
  })
}

check('a captured touch moving outside the button cancels without pointerleave', ({ pointer, clock, further, starts, click }) => {
  pointer('pointerdown', { pointerType: 'touch' })
  clock.tick(1500)
  pointer('pointermove', { pointerType: 'touch', clientX: 230 })
  clock.tick(3000)
  assert.equal(further.hidden, true)
  pointer('pointerup', { pointerType: 'touch', clientX: 230 })
  click()
  assert.deepEqual(starts, [])
})

check('touch movement within the button preserves a continuous hold', ({ pointer, clock, further }) => {
  pointer('pointerdown', { pointerType: 'touch' })
  clock.tick(1500)
  pointer('pointermove', { pointerType: 'touch', clientX: 30, clientY: 30 })
  clock.tick(1500)
  assert.equal(further.hidden, false)
})

check('window blur cancels a pointer hold', ({ pointer, clock, windowTarget, further, starts, click }) => {
  pointer('pointerdown')
  clock.tick(1500)
  windowTarget.emit('blur')
  clock.tick(5000)
  pointer('pointerup')
  click()
  assert.equal(further.hidden, true)
  assert.deepEqual(starts, [])
})

check('backgrounding the document cancels a keyboard hold', ({ keyboard, clock, documentTarget, further, starts }) => {
  keyboard('keydown')
  clock.tick(1500)
  documentTarget.hidden = true
  documentTarget.emit('visibilitychange')
  documentTarget.hidden = false
  clock.tick(5000)
  keyboard('keyup')
  assert.equal(further.hidden, true)
  assert.deepEqual(starts, [])
})

check('readiness is checked again at the deadline', ({ pointer, clock, state, start, further, starts, click }) => {
  pointer('pointerdown')
  clock.tick(2999)
  state.ready = false
  start.disabled = true
  clock.tick(1)
  assert.equal(further.hidden, true)
  pointer('pointerup')
  click()
  assert.deepEqual(starts, [])
})

check('guests cannot reveal the shortcut', ({ state, pointer, clock, further }) => {
  state.leader = false
  pointer('pointerdown')
  clock.tick(5000)
  assert.equal(further.hidden, true)
})

check('reset cancels late callbacks and restarts the hold duration', ({ control, pointer, clock, further, start }) => {
  pointer('pointerdown')
  clock.tick(2999)
  control.reset()
  assert.equal(clock.timers.size, 0)
  assert.equal(start.classList.contains('nr-vasthouden'), false)
  clock.tick(5000)
  assert.equal(further.hidden, true)
  pointer('pointerdown')
  clock.tick(2999)
  assert.equal(further.hidden, true)
  clock.tick(1)
  assert.equal(further.hidden, false)
})

check('destroy cancels timers and removes every activation listener', ({ control, pointer, keyboard, click, clock, further, starts, start }) => {
  pointer('pointerdown')
  clock.tick(2999)
  control.destroy()
  control.destroy()
  assert.equal(clock.timers.size, 0)
  clock.tick(5000)
  assert.equal(further.hidden, true)
  assert.equal(start.getAttribute('aria-expanded'), 'false')
  pointer('pointerdown')
  keyboard('keydown')
  clock.tick(5000)
  pointer('pointerup')
  keyboard('keyup')
  click()
  assert.equal(clock.timers.size, 0)
  assert.equal(further.hidden, true)
  assert.deepEqual(starts, [])
})

check('another click cannot start a round while a hold is still active', ({ pointer, click, clock, starts, further }) => {
  pointer('pointerdown')
  clock.tick(1000)
  click()
  assert.deepEqual(starts, [])
  clock.tick(2000)
  assert.equal(further.hidden, false)
  pointer('pointerup'); click()
  assert.deepEqual(starts, [])
})

console.log(`PASS: ${passed} Neon Raiders hold checks for saved levels 2–7, timing, restart suppression, keyboard, touch cancellation, readiness and cleanup.`)
