import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maakSchaakTaal, leesSchaakTaal, schaakT, vertaalSchaak, SCHAAK_TAAL_KEY, SCHAAK_TAAL_EVENT } from '../../schaak-taal.js'
import { SCHAAK_EN } from '../../schaak-taal-en.js'

const storage = initial => {
  const values = new Map(Object.entries(initial || {}))
  return { values, getItem:key=>values.get(key) ?? null, setItem:(key,value)=>values.set(key,String(value)) }
}
class Target extends EventTarget {
  active = new Set()
  addEventListener(type, callback, options) { this.active.add(callback); super.addEventListener(type, callback, options) }
  removeEventListener(type, callback, options) { this.active.delete(callback); super.removeEventListener(type, callback, options) }
}
const store = storage({ fibro_taal:'en' }), target = new Target()
globalThis.window = target
window.T = () => 'APP ENGLISH'
globalThis.localStorage = store
const first = maakSchaakTaal({ storage:store, eventTarget:target })
assert.equal(first.language,'nl','chess starts in Dutch even with an English app')
assert.equal(first.t('Schaken'),'Schaken')
const second = maakSchaakTaal({ storage:store, eventTarget:target })
let firstCalls = 0, secondCalls = 0
const stop = first.subscribe(()=>firstCalls++)
second.subscribe(()=>secondCalls++)
assert.equal(first.setLanguage('en'),true)
assert.equal(second.language,'en','mounted chess surfaces follow the local language event')
assert.equal(store.getItem(SCHAAK_TAAL_KEY),'en')
assert.equal(firstCalls,1); assert.equal(secondCalls,1,'one notification per actual change')
assert.equal(first.t('Schaken'),'Chess')
assert.equal(first.setLanguage('en'),false)
assert.equal(firstCalls,1)
assert.equal(first.setLanguage('fr'),false)
assert.equal(first.language,'en')
assert.equal(store.getItem('fibro_taal'),'en','the app-language key is never written')
assert.equal(window.T('anything'),'APP ENGLISH','the app translator is never replaced')
const persisted = maakSchaakTaal({ storage:store, eventTarget:target })
assert.equal(persisted.language,'en','the choice survives a new game')
persisted.destroy(); stop(); first.setLanguage('nl')
assert.equal(firstCalls,1,'subscriptions can be removed')
assert.equal(secondCalls,2)
const storageEvent = (value, key = SCHAAK_TAAL_KEY) => {
  const event = new Event('storage')
  Object.defineProperties(event,{ key:{value:key}, newValue:{value}, storageArea:{value:store} })
  target.dispatchEvent(event)
}
storageEvent('en'); assert.equal(second.language,'en')
storageEvent('invalid'); assert.equal(second.language,'nl')
storageEvent('en','fibro_taal'); assert.equal(second.language,'nl','app-language changes do not change chess')

class Node {
  constructor(attributes = {}) { this.attributes = new Map(Object.entries(attributes)); this.children = []; this.textContent = '' }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  setAttribute(name,value) { this.attributes.set(name,String(value)) }
  matches(selector) { return this.attributes.has(selector.slice(1,-1)) }
  querySelectorAll(selector) { return this.children.filter(child=>child.matches(selector)) }
}
const root = new Node(), text = new Node({'data-sch-text':'Schaken'}), label = new Node({'data-sch-label':'Schaakinstellingen'}),
  title = new Node({'data-sch-title':'Cameraweergave herstellen'}), placeholder = new Node({'data-sch-placeholder':'Schaken'})
root.children.push(text,label,title,placeholder)
first.setLanguage('en'); first.translate(root)
assert.equal(text.textContent,'Chess'); assert.equal(label.getAttribute('aria-label'),'Chess settings')
assert.equal(title.getAttribute('title'),'Restore camera view'); assert.equal(placeholder.getAttribute('placeholder'),'Chess')
assert.equal(root.getAttribute('lang'),'en')
first.setLanguage('nl'); first.translate(root)
assert.equal(text.textContent,'Schaken'); assert.equal(label.getAttribute('aria-label'),'Schaakinstellingen')
assert.equal(root.children.length,4,'translation never rebuilds controls')
assert.equal(vertaalSchaak('{naam} is aan zet',{naam:'<img src=x onerror=alert(1)>'},'nl'),'<img src=x onerror=alert(1)> is aan zet','values remain plain text')
assert.equal(vertaalSchaak('{n}',{n:0},'nl'),'0')
assert.equal(vertaalSchaak('{n}',Object.create({n:'inherited'}),'nl'),'{n}')
first.destroy(); second.destroy()
assert.equal(target.active.size,0,'leaving chess removes its listeners')
assert.equal(first.setLanguage('en'),false)
target.dispatchEvent(new CustomEvent(SCHAAK_TAAL_EVENT,{detail:{language:'en'}}))
assert.equal(first.language,'nl')
const blocked = maakSchaakTaal({ storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},eventTarget:new Target() })
assert.equal(blocked.language,'nl'); assert.doesNotThrow(()=>blocked.setLanguage('en'))
assert.equal(blocked.t('Schaken'),'Chess'); blocked.destroy()
for (const value of ['EN','', 'de', '{"language":"en"}']) {
  const invalid = maakSchaakTaal({ storage:storage({[SCHAAK_TAAL_KEY]:value}),eventTarget:new Target() })
  assert.equal(invalid.language,'nl'); invalid.destroy()
}
store.setItem(SCHAAK_TAAL_KEY,'en')
assert.equal(leesSchaakTaal(),'en'); assert.equal(schaakT('Schaken'),'Chess')

// Changing a sound label never clicks the button or changes the saved mute state.
globalThis.document = { createElement(){return {style:{},addEventListener(){}}},addEventListener(){} }
const { knop } = await import('../../bordgeluid.js')
store.setItem('fibro_spelgeluid','uit')
const sound = knop({parentElement:{},insertAdjacentElement(){}},{language:'nl'})
assert.equal(sound.textContent,'🔇 Geluid uit','explicit Dutch ignores the app translator')
sound.setLanguage('en'); assert.equal(sound.textContent,'🔇 Sound off')
assert.equal(store.getItem('fibro_spelgeluid'),'uit')
sound.setLanguage('nl'); assert.equal(sound.textContent,'🔇 Geluid uit')
globalThis.localStorage = { getItem:()=>null,setItem(){throw Error('storage full')} }
const memoryOnly = maakSchaakTaal()
memoryOnly.setLanguage('en')
assert.equal(schaakT('Schaken'),'Chess','media callbacks share the choice even when storage is readable but cannot write')
const remounted = maakSchaakTaal()
assert.equal(remounted.language,'en','a new mounted view keeps the in-page preference after storage denial')
memoryOnly.setLanguage('nl'); memoryOnly.destroy(); remounted.destroy()
delete globalThis.document; delete globalThis.localStorage; delete globalThis.window

// Every annotated static text and literal translator call needs English coverage.
for (const name of ['schaken-ui.js','schaken-drie-ui.js','chess-layout.js','chat.html','spel.html']) {
  const source = readFileSync(new URL('../../'+name,import.meta.url),'utf8')
  const keys = [...source.matchAll(/\b(?:t|msg|tekst|staticText|say|schaakT|spelT)\('((?:[^'\\]|\\.)*)'/g)].map(match=>match[1].replace(/\\'/g,"'"))
  for (const match of source.matchAll(/data-sch-(?:text|label|title|placeholder)="([^"]+)"/g)) {
    if (!match[1].includes('$'+'{')) keys.push(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'))
  }
  for (const key of keys) assert.equal(typeof SCHAAK_EN[key],'string',name+': English translation exists for '+key)
}
console.log('PASS: independent Dutch default, persisted English choice, live/cross-tab updates, blocked storage, accessible labels, cleanup, sound state and dictionary coverage.')
