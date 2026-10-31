import assert from 'node:assert/strict'
import { maakNeonScorebord, scoreDatum } from '../../neon-raiders-scoreboard.js'

class Element {
  constructor(tag, doc) {
    this.tagName = tag; this.ownerDocument = doc; this.children = []; this.attributes = new Map()
    this.dataset = {}; this.listeners = new Map(); this.isConnected = true; this._text = ''
    this.classList = { add: name => { this.className += ' ' + name } }
  }
  set textContent(value) { this._text = String(value); this.children = [] }
  get textContent() { return this._text + this.children.map(child => child.textContent).join('') }
  setAttribute(name, value) { this.attributes.set(name, value) }
  removeAttribute(name) { this.attributes.delete(name) }
  append(...children) { this.children.push(...children) }
  appendChild(child) { this.append(child); return child }
  replaceChildren(...children) { this._text = ''; this.children = [...children] }
  addEventListener(name, callback) { this.listeners.set(name, [...(this.listeners.get(name) || []), callback]) }
  emit(name, event = {}) { for (const handler of this.listeners.get(name) || []) handler(event) }
  focus() { this.ownerDocument.activeElement = this }
  showModal() { this.setAttribute('open', '') }
  close() { this.removeAttribute('open'); this.emit('close') }
  remove() { this.isConnected = false }
}
function documentMock() {
  const doc = { createElement(tag) { return new Element(tag, doc) }, getElementById(id) {
    return walk(doc.head).find(node => node.id === id) || null
  } }
  doc.head = new Element('head', doc); doc.body = new Element('body', doc)
  doc.activeElement = new Element('button', doc)
  return doc
}
function walk(node) { return [node, ...node.children.flatMap(walk)] }
const byClass = (node, name) => walk(node).find(child => (child.className || '').split(' ').includes(name))
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail }); return { promise, resolve, reject } }
const T = Object.assign((key, values) => key.replace(/\{(\w+)\}/g, (match, name) => values?.[name] ?? match), { locale: 'nl-NL' })

assert.equal(scoreDatum(undefined), null)
assert.equal(scoreDatum('not-a-date'), null)
assert.equal(scoreDatum(null), null)
assert.equal(scoreDatum('2026-10-27T18:20:00Z').iso, '2026-10-27T18:20:00.000Z')
assert.ok(scoreDatum('2026-10-27T18:20:00Z', 'invalid_!locale').day, 'invalid locale uses a readable fallback')

const doc = documentMock(), initialFocus = doc.activeElement
const calls = [], loaded = []
const service = { loadBoards() { const request = deferred(); calls.push(request); return request.promise } }
let opened = 0, closed = 0
const board = maakNeonScorebord({host:doc.body,service,T,onOpen:()=>opened++,onClose:()=>closed++})
const dialog = doc.body.children[0]
const opening = board.open()
assert.equal(opened, 1)
assert.equal(dialog.attributes.has('open'), true)
assert.equal(byClass(dialog, 'nr-sb-refresh').disabled, true)
const personal = Array.from({length:12}, (_,index)=>({id:String(index),score:1200-index*10,playedAt:'2026-10-27T18:20:00Z',isSelf:true,level:index===0?7:2,won:index===0}))
const hostile = '<img src=x onerror=alert(1)>'
calls[0].resolve({personal,friends:[{score:8754,playedAt:'2026-10-27T18:20:00Z',name:hostile,level:4}],global:{score:98765,level:6,won:false},status:'online'})
await opening
assert.equal(byClass(dialog,'nr-sb-personal').children[2].children.length, 10, 'personal list contains no more than 10 runs')
assert.equal(byClass(dialog,'nr-sb-name').textContent, hostile, 'names remain literal text')
assert.equal(walk(dialog).some(node=>node.tagName==='img'), false, 'a name never becomes markup')
assert.equal(byClass(dialog,'nr-sb-global-detail').textContent, 'Level 6', 'anonymous global record shows level but no guessed name or date')
assert.equal(byClass(byClass(dialog,'nr-sb-personal'),'nr-sb-level').textContent, 'Level 7 · Uitgespeeld', 'a completed run is distinguished from failing in the final level')
assert.equal(byClass(byClass(dialog,'nr-sb-friends'),'nr-sb-level').textContent, 'Level 4', 'friends runs include the level reached')
assert.match(byClass(dialog,'nr-sb-global-score').textContent, /98[.\s,]?765/)
assert.equal(byClass(dialog,'nr-sb-refresh').disabled, false)
assert.ok(byClass(dialog,'nr-sb-date').children[1].textContent, 'every run includes a readable local time')

const old = board.refresh(), latest = board.refresh()
calls[2].resolve({personal:[],friends:[],global:{score:99,name:'Trusted friend'},status:'online'}); await latest
calls[1].resolve({personal:[],friends:[],global:{score:1,name:'Outdated'},status:'online'}); await old
assert.match(byClass(dialog,'nr-sb-global-detail').textContent,/Trusted friend/,'late requests cannot overwrite a newer board')
assert.doesNotMatch(byClass(dialog,'nr-sb-global-detail').textContent,/Outdated/)
const failed = board.refresh(); calls[3].reject(new Error('offline')); await failed
assert.equal(dialog.dataset.state,'offline')
assert.match(byClass(dialog,'nr-sb-global-detail').textContent,/Trusted friend/,'transport failure preserves the last readable board')

const denied = board.refresh()
calls[4].resolve({personal:[],friends:[],global:null,status:'local',durable:false}); await denied
assert.match(byClass(dialog,'nr-sb-status').textContent,/niet blijvend opslaan/,'blocked browser storage is not presented as permanently saved')

let prevented = false
dialog.emit('cancel',{preventDefault(){prevented=true}})
assert.equal(prevented,true)
assert.equal(dialog.attributes.has('open'),false)
assert.equal(closed,1)
assert.equal(doc.activeElement,initialFocus,'closing returns keyboard focus')
board.close(); assert.equal(closed,1,'closing twice is harmless')

const pending = board.open()
board.destroy()
calls[5].resolve({personal:[],friends:[],global:{score:5,name:'After destroy'},status:'online'}); await pending
assert.equal(dialog.isConnected,false)
assert.doesNotMatch(dialog.textContent,/After destroy/,'destroyed game overlays ignore pending requests')
assert.equal(doc.head.children.length,1,'one shared stylesheet is loaded')

const levelDoc = documentMock()
let levelBoards
const levels = maakNeonScorebord({host:levelDoc.body,T,service:{async loadBoards(){return levelBoards}}})
const levelDialog = levelDoc.body.children[0]
for (const invalid of [undefined,null,0,8,-1,1.5,'3','<img src=x>',Infinity]) {
  const run = {score:1,level:invalid,won:true}
  levelBoards = {personal:[run],friends:[run],global:run,status:'online'}
  await levels.open()
  const badges = walk(levelDialog).filter(node=>(node.className||'').split(' ').includes('nr-sb-level'))
  assert.equal(badges.length,3)
  assert.ok(badges.every(node=>node.textContent==='Level onbekend'), 'legacy/invalid level metadata is unknown in every board, never invented or rendered as markup')
  assert.equal(walk(levelDialog).some(node=>node.tagName==='img'),false)
}
for (const run of [{score:2,level:7,won:false},{score:2,level:7,won:'true'},{score:2,level:6,won:true}]) {
  levelBoards = {personal:[run],friends:[run],global:run,status:'online'}
  await levels.refresh()
  const badges = walk(levelDialog).filter(node=>(node.className||'').split(' ').includes('nr-sb-level'))
  assert.ok(badges.every(node=>node.textContent===`Level ${run.level}`),'only a real final-level win is labelled completed')
}
levelBoards = {personal:[],friends:[],global:{score:3,level:7,won:true},status:'online'}
await levels.refresh()
assert.equal(byClass(levelDialog,'nr-sb-global-detail').textContent,'Level 7 · Uitgespeeld','even an anonymous global win can show completion without identity')
levels.destroy()
console.log('PASS: score modal lists, all-board levels/completion and unknown legacy metadata, local dates/times, literal names, anonymous global record, request races, offline cache, Escape/focus and cleanup.')
