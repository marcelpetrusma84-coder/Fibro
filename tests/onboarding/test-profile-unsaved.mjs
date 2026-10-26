import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { maakWidgetWijzigingsBewaking, synchroniseerWidgetSchakelaars } from '../../profile-unsaved.js'

class Events {
  listeners = new Map()
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener) }
  emit(type, event = {}) { for (const listener of this.listeners.get(type) || []) listener(event) }
  count(type) { return this.listeners.get(type)?.size || 0 }
}
function harness({ initial = ['gastenboek', 'mood'], english = false, controls = [] } = {}) {
  let widgets = [...initial]
  const classes = new Set(), timers = new Map(), notes = [], decisions = []
  const view = Object.assign(new Events(), {
    location:{ href:'https://example.test/Fibro/profiel.html#widgets' },
    FIBRO_EN:{},
    messages:[],
    confirm(message) { this.messages.push(message); return decisions.shift() ?? false },
    setTimeout(callback) { const id = Symbol(); timers.set(id, callback); return id },
    clearTimeout(id) { timers.delete(id) }
  })
  view.T = key => english ? (view.FIBRO_EN[key] || key) : key
  const page = Object.assign(new Events(), {
    body:{ dataset:{}, classList:{ toggle(name, state) { state ? classes.add(name) : classes.delete(name) }, remove(name) { classes.delete(name) } } },
    querySelector:() => ({ before(note) { notes.push(note) } }),
    querySelectorAll:selector => { assert.equal(selector, '#panel-widgets .toggle[id^="widget-"]'); return controls },
    createElement:() => ({ setAttribute() {}, remove() { notes.splice(notes.indexOf(this), 1) } })
  })
  const guard = maakWidgetWijzigingsBewaking({ view, page, getWidgets:() => widgets })
  return {
    guard, view, page, notes, decisions,
    get widgets() { return widgets },
    set widgets(next) { widgets = next },
    initialize(saved) { widgets = guard.initialize(saved); guard.changed() },
    flushTimers() { for (const callback of [...timers.values()]) callback() }
  }
}
function event(target) {
  return { target, defaultPrevented:false, stopped:false, preventDefault() { this.defaultPrevented = true }, stopImmediatePropagation() { this.stopped = true } }
}
function target(attributes = {}, inline = null) {
  const element = { getAttribute:name => attributes[name] ?? null, hasAttribute:name => Object.hasOwn(attributes, name) }
  return { closest(selector) { return selector === 'a[href]' ? (attributes.href ? element : null) : inline ? { getAttribute:() => inline } : null } }
}
function widgetControl(name, initiallyOn = true, labelId = '') {
  const attributes = new Map(), classes = new Set([initiallyOn ? 'on' : 'off'])
  const label = { id:labelId }
  return {
    id:'widget-' + name, attributes, classes, label,
    classList:{ toggle(name, on) { on ? classes.add(name) : classes.delete(name) } },
    setAttribute(name, value) { attributes.set(name, value) },
    closest(selector) { assert.equal(selector, '.widget-item'); return { querySelector:selector => { assert.equal(selector, '.widget-name'); return label } } }
  }
}

const h = harness()
assert.equal(h.guard.isDirty(), false)
assert.equal(h.view.count('beforeunload'), 0, 'clean page keeps native back/forward caching available')
h.initialize(['gastenboek', 'spel_schaken'])
assert.equal(h.guard.isDirty(), false, 'asynchronous initialization is not a user edit')
assert.equal(h.page.body.dataset.widgetsUnsaved, 'false')
assert.equal(h.notes[0].hidden, true)
h.widgets.push('spel_pong')
assert.equal(h.guard.changed(), true)
assert.equal(h.view.count('beforeunload'), 1)
assert.equal(h.page.body.dataset.widgetsUnsaved, 'true')
assert.equal(h.notes[0].textContent, 'Niet opgeslagen')
assert.equal(h.notes[0].hidden, false)
h.guard.changed()
assert.equal(h.view.count('beforeunload'), 1, 'no duplicate unload listener')
const reload = event()
h.view.emit('beforeunload', reload)
assert.equal(reload.defaultPrevented, true)
assert.equal(reload.returnValue, '')

const home = target({}, "window.location.href='index.html'")
const cancelled = event(home)
h.page.emit('click', cancelled)
assert.equal(cancelled.defaultPrevented, true)
assert.equal(cancelled.stopped, true)
assert.equal(h.guard.isDirty(), true, 'cancelling preserves pending widget choices')
assert(h.view.messages[0].includes('nog niet opgeslagen'))

for (const nonLeavingTarget of [
  target({}, "switchTab('kleur')"),
  target({}, "toggleWidget('spel_schaken')"),
  target({ href:'#profiel' }),
  target({ href:'index.html', target:'_blank' }),
  target({ href:'index.html', download:'' }),
  target({ href:'mailto:test@example.test' })
]) {
  const before = h.view.messages.length
  h.page.emit('click', event(nonLeavingTarget))
  assert.equal(h.view.messages.length, before, 'tabs, downloads and other windows do not leave this page')
}
const modifiedClick = event(target({ href:'index.html' }))
modifiedClick.ctrlKey = true
h.page.emit('click', modifiedClick)
assert.equal(modifiedClick.defaultPrevented, false)

h.decisions.push(true)
const accepted = event(home)
h.page.emit('click', accepted)
assert.equal(accepted.defaultPrevented, false)
const confirmedUnload = event()
h.view.emit('beforeunload', confirmedUnload)
assert.equal(confirmedUnload.defaultPrevented, false, 'one confirmed navigation must not prompt twice')
assert.equal(h.guard.isDirty(), true, 'consenting to navigation is not saving')
const nextUnload = event()
h.view.emit('beforeunload', nextUnload)
assert.equal(nextUnload.defaultPrevented, true)
h.decisions.push(true)
h.page.emit('click', event(home))
h.flushTimers()
const failedNavigationThenReload = event()
h.view.emit('beforeunload', failedNavigationThenReload)
assert.equal(failedNavigationThenReload.defaultPrevented, true, 'a cancelled/failed navigation cannot leave permanent bypass')

h.widgets = h.widgets.filter(name => name !== 'spel_pong')
assert.equal(h.guard.changed(), false, 'reverting a toggle removes the warning')
assert.equal(h.view.count('beforeunload'), 0)
h.widgets.reverse()
h.widgets.push(h.widgets[0])
assert.equal(h.guard.changed(), false, 'membership, not ordering/duplicate entries, is compared')
h.widgets.push('spel_pong')
h.guard.changed()
const savingSnapshot = [...h.widgets]
h.widgets.push('spel_dammen') // User edits while the asynchronous save is pending.
h.guard.markSaved(savingSnapshot)
assert.equal(h.guard.isDirty(), true, 'save success only acknowledges the captured save snapshot')
h.guard.markSaved([...h.widgets])
assert.equal(h.view.count('beforeunload'), 0)
assert.equal(h.notes[0].hidden, true)

const early = harness()
early.widgets.push('spel_schaken')
early.guard.changed()
early.initialize(['gastenboek', 'quote'])
assert.deepEqual(early.widgets, ['gastenboek', 'quote', 'spel_schaken'], 'early clicks survive saved-profile loading')
assert.equal(early.guard.isDirty(), true)
const alreadySaved = harness()
alreadySaved.widgets.push('spel_schaken')
alreadySaved.initialize(['gastenboek', 'spel_schaken'])
assert.equal(alreadySaved.guard.isDirty(), false, 'loaded data already matching the requested choice is clean')

const en = harness({ english:true })
en.widgets.push('spel_schaken')
en.guard.changed()
en.page.emit('click', event(target({ href:'index.html' })))
assert(en.view.messages[0].startsWith('You have not saved'))
assert.equal(en.notes[0].textContent, 'Unsaved changes')
en.guard.destroy()
assert.equal(en.view.count('beforeunload'), 0)
assert.equal(en.page.count('click'), 0)
assert.equal(en.notes.length, 0)

const chess = widgetControl('spel_schaken'), mood = widgetControl('mood', false, 'existing-mood-label')
const controlPage = { querySelectorAll:selector => { assert.equal(selector, '#panel-widgets .toggle[id^="widget-"]'); return [chess, mood] } }
synchroniseerWidgetSchakelaars(controlPage, ['mood'])
assert.equal(chess.classes.has('on'), false, 'saved off removes stale markup .on')
assert.equal(chess.classes.has('off'), true)
assert.equal(chess.attributes.get('aria-checked'), 'false')
assert.equal(chess.attributes.get('role'), 'switch')
assert.equal(chess.attributes.get('tabindex'), '0')
assert.equal(chess.attributes.get('aria-labelledby'), 'widget-spel_schaken-label')
assert.equal(mood.classes.has('on'), true, 'saved on removes stale markup .off')
assert.equal(mood.classes.has('off'), false)
assert.equal(mood.attributes.get('aria-labelledby'), 'existing-mood-label', 'existing label IDs are preserved')

const keyboard = harness({ initial:[], controls:[chess] })
keyboard.initialize([])
let clicks = 0
chess.click = () => {
  clicks++
  keyboard.widgets = keyboard.widgets.includes('spel_schaken') ? [] : ['spel_schaken']
  keyboard.guard.changed()
}
const space = event(chess); space.key = ' '
keyboard.page.emit('keydown', space)
assert.equal(space.defaultPrevented, true, 'Space toggles without scrolling the page')
assert.equal(clicks, 1)
assert.equal(keyboard.guard.isDirty(), true)
assert.equal(chess.attributes.get('aria-checked'), 'true')
assert.equal(chess.classes.has('off'), false)
const repeat = event(chess); repeat.key = ' '; repeat.repeat = true
keyboard.page.emit('keydown', repeat)
assert.equal(repeat.defaultPrevented, true)
assert.equal(clicks, 1, 'holding Space does not repeatedly toggle')
const enter = event(chess); enter.key = 'Enter'
keyboard.page.emit('keydown', enter)
assert.equal(clicks, 2)
assert.equal(chess.attributes.get('aria-checked'), 'false')
assert.equal(keyboard.guard.isDirty(), false, 'keyboard revert also removes the warning')
const unrelated = event(target({}, 'toggleOnlineStatus()')); unrelated.key = 'Enter'
keyboard.page.emit('keydown', unrelated)
assert.equal(unrelated.defaultPrevented, false, 'online status and other controls remain independent')
keyboard.guard.destroy()
assert.equal(keyboard.page.count('keydown'), 0)

const html = await readFile(new URL('../../profiel.html', import.meta.url), 'utf8')
assert.match(html, /import \{ maakWidgetWijzigingsBewaking \} from '\.\/profile-unsaved\.js\?v=\d+'/u)
assert.match(html, /window\.toggleWidget=.*widgetBewaking\.changed\(\)/u)
assert.match(html, /const stickerWidgets=.*widgetBewaking\.changed\(\)/u)
assert.match(html, /window\.slaAllesOp=async function\(\)\{\s*const opgeslagenWidgets = \[\.\.\.actieveWidgets\]/u)
assert.match(html, /if\(error\)\{[^\n]*\}\s*else\{widgetBewaking\.markSaved\(opgeslagenWidgets\)/u, 'failed saving never clears the warning')
assert.match(html, /function updateWidgetToggles\(\)\{widgetBewaking\.syncToggles\(\)\}/u)
console.log('PASS: unsaved widget/game warning, unload/navigation, initialization, revert/save races, accessible synchronized switches, keyboard and NL/EN.')
