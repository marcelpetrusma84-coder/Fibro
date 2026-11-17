// UX-iconen: dezelfde knoppen en meldingen, een bewaarde keuze voor lijniconen of kleur.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../../icoonthema.js', import.meta.url), 'utf8')
function browser({ stored = null, ready = 'complete', readError = false, writeError = false } = {}) {
  class Element {
    constructor(tag, text = '', classes = []) {
      this.tag = tag; this.text = text; this.children = []; this.dataset = {}; this.attributes = {}
      this.className = classes.join(' ')
      this.classList = {
        add: value => { if (!this.classList.contains(value)) this.className += (this.className ? ' ' : '') + value },
        contains: value => this.className.split(/\s+/).includes(value)
      }
    }
    get textContent() { return this.text + this.children.map(e => e.textContent).join('') }
    set textContent(value) { this.text = String(value); this.children = [] }
    setAttribute(name, value) { this.attributes[name] = String(value) }
    append(child) { child.parent = this; this.children.push(child); return child }
    after(child) { child.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, child) }
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1) }
    querySelector(selector) {
      if (selector === ':scope > svg') return this.children.find(e => e.tag === 'svg') || null
      if (selector === ':scope > .icoon-nostalgia') return this.children.find(e => e.classList.contains('icoon-nostalgia')) || null
      throw new Error('Onverwachte selector: ' + selector)
    }
    matches(selector) { return selector === '[data-icoonthema-keuze]' && this.isRadio }
  }
  const places = [], radios = [], docEvents = new Map(), winEvents = new Map(), writes = []
  for (const [name, label, tab] of [['home','Home'],['vrienden','Vrienden'],['chat','Chat'],['stijl','Stijl'],['ux','UX',true],['foto','Foto']]) {
    const place = new Element('div'); place.dataset.icoon = name
    place.append(new Element('svg', '', tab ? ['tab-icoon'] : []))
    const text = place.append(new Element('span', label)); place.label = text
    places.push(place)
  }
  const badge = places[2].append(new Element('span', '2', ['fo-bol']))
  const unknown = new Element('div'); unknown.dataset.icoon = 'onbekend'; unknown.append(new Element('svg')); places.push(unknown)
  const noSvg = new Element('div'); noSvg.dataset.icoon = 'home'; places.push(noSvg)
  for (const value of ['modern','nostalgia']) {
    const radio = new Element('input'); radio.value = value; radio.isRadio = true; radio.checked = false; radios.push(radio)
  }
  const values = new Map(stored === null ? [] : [['fibro_icoonthema', stored]])
  const document = {
    readyState: ready, documentElement: { dataset: {} }, createElement: tag => new Element(tag),
    querySelectorAll: selector => {
      if (selector === '[data-icoon]') return places
      if (selector === '[data-icoonthema-keuze]') return radios
      throw new Error('Onverwachte selector: ' + selector)
    },
    addEventListener: (name, callback) => { if (!docEvents.has(name)) docEvents.set(name, []); docEvents.get(name).push(callback) }
  }
  const window = { addEventListener: (name, callback) => { if (!winEvents.has(name)) winEvents.set(name, []); winEvents.get(name).push(callback) } }
  const localStorage = {
    getItem: key => { if (readError) throw new Error('Geen opslag'); return values.get(key) ?? null },
    setItem: (key, value) => { if (writeError) throw new Error('Opslag vol'); values.set(key, String(value)); writes.push([key, String(value)]) }
  }
  const context = vm.createContext({ window, document, localStorage })
  vm.runInContext(source, context)
  const emit = (events, name, event = {}) => { for (const callback of events.get(name) || []) callback(event) }
  return { window, document, places, radios, badge, values, writes, context, docEvents, winEvents,
    api: window.FibroIcoonthema,
    dom: () => emit(docEvents, 'DOMContentLoaded'),
    interactive: () => { document.readyState = 'interactive'; emit(docEvents, 'readystatechange') },
    change: target => emit(docEvents, 'change', { target }),
    storage: event => emit(winEvents, 'storage', event) }
}
const nostalgia = place => place.querySelector(':scope > .icoon-nostalgia')

const b = browser()
assert.equal(b.api.huidig(), 'modern', 'bestaande bezoekers houden de moderne lijniconen')
assert.equal(b.document.documentElement.dataset.icoonthema, 'modern')
assert.ok(b.places.every(place => !nostalgia(place)), 'Modern voegt geen verborgen emoji-tekst toe')
assert.equal(b.radios[0].checked, true)
assert.equal(b.api.kies('onbekend'), false, 'een ongeldige keuze verandert niets')
assert.equal(b.api.huidig(), 'modern'); assert.equal(b.writes.length, 0)
const labels = b.places.slice(0,6).map(place => place.label)
assert.equal(b.api.kies('nostalgia'), true)
assert.equal(b.values.get('fibro_icoonthema'), 'nostalgia')
assert.deepEqual(b.places.slice(0,6).map(place => nostalgia(place)?.textContent), ['🏠','👥','💬','🖍️','💜','📷'])
assert.equal(b.radios[0].checked, false); assert.equal(b.radios[1].checked, true)
assert.ok(nostalgia(b.places[4]).classList.contains('tab-icoon'), 'profieltab-iconen behouden hun maat')
assert.equal(nostalgia(b.places[2]).attributes['aria-hidden'], 'true', 'decoratieve emoji heeft geen dubbele toegankelijke naam')
assert.equal(b.places[2].children.at(-1), b.badge, 'het ongelezen bolletje wordt niet vervangen')
assert.deepEqual(b.places.slice(0,6).map(place => place.label), labels, 'bestaande labels en hun handlers blijven dezelfde elementen')
assert.equal(b.places[2].label.textContent, 'Chat', 'de zoektekst voor Chat blijft ongewijzigd')
assert.equal(nostalgia(b.places[6]), null, 'onbekende iconen blijven intact')
assert.equal(nostalgia(b.places[7]), null, 'een plek zonder lijnicoon blijft intact')
b.api.toon(); b.api.toon()
assert.ok(b.places.slice(0,6).every(place => place.children.filter(e => e.classList.contains('icoon-nostalgia')).length === 1), 'opnieuw tekenen dupliceert geen iconen')
const writes = b.writes.length
b.storage({ key: 'andere_voorkeur', newValue: 'modern' })
assert.equal(b.api.huidig(), 'nostalgia', 'een andere opslagwijziging doet niets')
b.storage({ key: 'fibro_icoonthema', newValue: 'modern' })
assert.equal(b.api.huidig(), 'modern', 'een ander tabblad kan de keuze bijwerken')
assert.equal(b.writes.length, writes, 'opslaggebeurtenis schrijft niet terug en veroorzaakt geen lus')
assert.ok(b.places.every(place => !nostalgia(place)))
b.radios[1].checked = true; b.change(b.radios[1])
assert.equal(b.api.huidig(), 'nostalgia', 'een aangeklikte radiokeuze werkt via het change-event')
b.radios[0].checked = false; b.change(b.radios[0])
assert.equal(b.api.huidig(), 'nostalgia', 'een niet-aangevinkte radiokeuze verandert het thema niet')
b.change({ matches: () => false })
b.storage({ key: 'fibro_icoonthema', newValue: 'corrupt' })
assert.equal(b.api.huidig(), 'modern', 'ongeldige externe opslag valt terug op Modern')
b.api.kies('nostalgia'); b.storage({ key: null, newValue: null })
assert.equal(b.api.huidig(), 'modern', 'opslag wissen herstelt de standaard')
const api = b.api, listenerCount = b.docEvents.get('change').length
vm.runInContext(source, b.context)
assert.equal(b.window.FibroIcoonthema, api, 'dubbel laden houdt dezelfde API')
assert.equal(b.docEvents.get('change').length, listenerCount, 'dubbel laden voegt geen events toe')

const loading = browser({ stored: 'nostalgia', ready: 'loading' })
assert.equal(loading.document.documentElement.dataset.icoonthema, 'nostalgia', 'bewaarde voorkeur staat al in de head vóór de eerste weergave')
assert.ok(loading.places.every(place => !nostalgia(place)), 'het script wacht op de pagina-elementen')
loading.dom()
assert.equal(nostalgia(loading.places[0]).textContent, '🏠')
assert.equal(loading.writes.length, 0, 'herladen schrijft de voorkeur niet opnieuw')
const vroeg = browser({ stored: 'nostalgia', ready: 'loading' })
vroeg.interactive()
assert.equal(nostalgia(vroeg.places[0]).textContent, '🏠', 'Nostalgia verschijnt bij interactive, vóór netwerkafhankelijke modules en DOMContentLoaded')
assert.ok(vroeg.places[0].querySelector(':scope > svg').classList.contains('icoon-modern'), 'de SVG wordt pas na aanmaak van de vervanging als vervangbaar gemarkeerd')
vroeg.dom()
assert.equal(vroeg.places[0].children.filter(e => e.classList.contains('icoon-nostalgia')).length, 1, 'DOMContentLoaded na interactive voegt geen tweede icoon toe')
assert.equal(vroeg.writes.length, 0)
const css = readFileSync(new URL('../../icoonthema.css', import.meta.url), 'utf8')
const verborgenSvg = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(m => /display\s*:\s*none/.test(m[2]) && m[1].includes('[data-icoon]') && m[1].includes('svg'))
assert.ok(verborgenSvg.length > 0, 'de vervangbare lijniconen hebben een verbergregel')
for (const regel of verborgenSvg) {
  assert.match(regel[1], />\s*svg\.icoon-modern/, 'de CSS verbergt alleen SVG-iconen die de controller al vervangen heeft')
  assert.doesNotMatch(regel[1], />\s*svg\s*(?:,|$)/, 'een generieke SVG blijft zichtbaar zolang de vervanging nog niet klaarstaat')
}
assert.equal(browser({ stored: '<script>' }).api.huidig(), 'modern')
assert.equal(browser({ readError: true }).api.huidig(), 'modern', 'geblokkeerde opslag breekt de pagina niet')
const noWrite = browser({ writeError: true })
assert.doesNotThrow(() => noWrite.api.kies('nostalgia'))
assert.equal(noWrite.api.huidig(), 'nostalgia', 'bij volle opslag blijft de keuze in deze pagina werken')
assert.equal(nostalgia(noWrite.places[0]).textContent, '🏠')
console.log('Icoonthema: voorkeur, head-herstel, wisselen, labels/meldingen, idempotentie en opslagfouten goed')
