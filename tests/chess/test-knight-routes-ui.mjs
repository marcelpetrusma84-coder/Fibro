import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Schaak from '../../schaak.js'
import { berekenPaardroutes } from '../../schaak-paardroutes.js'
import { maakPaardRoutesUI } from '../../schaak-paardroutes-ui.js'
import { SCHAAK_EN } from '../../schaak-taal-en.js'

const source = readFileSync(new URL('../../schaken-ui.js', import.meta.url), 'utf8')
const reader = source.match(/function readSettings\(\) \{[\s\S]*?\n\}/)[0]
const render = source.slice(source.indexOf('export function start('), source.indexOf('  const bordEl =')).replace('export function start(', 'function render(') + '\nreturn { markup:inhoud.innerHTML, instellingen, isUltra }; }'
const plain = value => JSON.parse(JSON.stringify(value))
const substitute = (key, values) => key.replace(/\{(\w+)\}/g, (match, name) => values?.[name] ?? match)

function markup({ saved = '{}', solo = true, level = 'ultra' } = {}) {
  const root = { innerHTML:'' }
  const context = vm.createContext({ document:{ getElementById:()=>root }, localStorage:{ getItem:()=>saved }, matchMedia:()=>({ matches:true }), maakSchaakTaal:()=>({ t:substitute }) })
  vm.runInContext(`const SETTINGS_KEY='test'; ${reader}; ${render}; globalThis.render=render`, context)
  return context.render({ Schaak, spelKanaal:{ isSolo:solo, niveau:level }, benIkSpeler1:true })
}
for (const level of ['makkelijk', 'normaal', 'moeilijk', 'ultra']) {
  const view = markup({ level })
  assert.deepEqual(plain(view.instellingen.knightRouteSteps), [true,true,true,false], 'three horizons start enabled in every solo level')
  assert.equal([...view.markup.matchAll(/data-knight-step="[1-4]"/g)].length, 4)
}
assert.equal(markup({ solo:false }).markup.includes('data-knight-step='), false, 'friend matches never expose the coaching controls')
for (const saved of ['{broken', 'null', '{"knightRouteSteps":[true]}', '{"knightRouteSteps":[1,1,1,1]}']) {
  assert.deepEqual(plain(markup({ saved }).instellingen.knightRouteSteps), [true,true,true,false], 'malformed preferences use safe defaults')
}
const saved = markup({ saved:'{"knightRouteSteps":[false,true,false,true],"custom":"keep","ultraTakeback":true}' }).instellingen
assert.deepEqual(plain(saved.knightRouteSteps), [false,true,false,true]); assert.equal(saved.custom, 'keep'); assert.equal(saved.ultraTakeback, true)

class Events {
  listeners = new Map()
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn) }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
  emit(type, values = {}) {
    const event = { type, target:this, defaultPrevented:false, preventDefault(){this.defaultPrevented=true}, stopPropagation(){this.stopped=true}, ...values }
    for (const fn of [...this.listeners.get(type) || []]) fn(event)
    if (!event.stopped && this.parentNode) this.parentNode.emit(type, event)
    return event
  }
  get count() { return [...this.listeners.values()].reduce((n,list)=>n+list.size,0) }
}
const dataName = name => name.slice(5).replace(/-([a-z])/g, (_match, c)=>c.toUpperCase())
class Node extends Events {
  constructor(tag = 'div', ownerDocument = null) {
    super(); this.tagName=tag.toUpperCase(); this.ownerDocument=ownerDocument; this.children=[]; this.parentNode=null; this.attrs=new Map(); this.dataset={}; this.classes=new Set(); this.hidden=false; this.checked=false; this.disabled=false; this._text=''; this._html=''; this.isConnected=true
    this.classList={ add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),contains:n=>this.classes.has(n),toggle:(n,on)=>{const value=on??!this.classes.has(n);value?this.classes.add(n):this.classes.delete(n);return value} }
    this.style={ values:new Map(),setProperty(name,value){this.values.set(name,String(value))},getPropertyValue(name){return this.values.get(name)||''},removeProperty(name){this.values.delete(name)} }
  }
  get className(){return [...this.classes].join(' ')} set className(value){this.classes=new Set(String(value).split(/\s+/).filter(Boolean))}
  get parentElement(){return this.parentNode}
  get childNodes(){return this.children}
  get firstChild(){return this.children[0]||null}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('')} set textContent(value){this._text=String(value);this.replaceChildren()}
  get innerHTML(){return this._html} set innerHTML(value){this._html=String(value);this.replaceChildren()}
  setAttribute(name,value){this.attrs.set(name,String(value));if(name==='class')this.className=value;if(name.startsWith('data-'))this.dataset[dataName(name)]=String(value)}
  getAttribute(name){return name==='class'?this.className:this.attrs.get(name)??null}
  removeAttribute(name){this.attrs.delete(name);if(name.startsWith('data-'))delete this.dataset[dataName(name)]}
  append(...children){for(const child of children){child.remove();child.parentNode=this;this.children.push(child)}}
  appendChild(child){this.append(child);return child}
  replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];this.append(...children)}
  remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null}}
  contains(other){for(let node=other;node;node=node.parentNode)if(node===this)return true;return false}
  matches(selector){
    if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()))
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1))
    if(selector.startsWith('#'))return this.getAttribute('id')===selector.slice(1)
    const attrs=[...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)]
    if(attrs.length)return attrs.every(([,name,value])=>{const actual=name.startsWith('data-')?this.dataset[dataName(name)]:this.getAttribute(name);return value===undefined?actual!==undefined&&actual!==null:actual===value})
    return this.tagName.toLowerCase()===selector
  }
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)])}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  closest(selector){for(let node=this;node;node=node.parentNode)if(node.matches(selector))return node;return null}
  focus(){this.focused=true}
}
function initialState() {
  const state=Schaak.nieuweSpelStaat();state.bord=Array.from({length:8},()=>Array(8).fill(null));state.bord[7][4]='wK';state.bord[0][4]='zK';state.bord[4][3]='wN';state.bord[3][5]='zP';state.bord[5][5]='wP';state.bord[2][2]='zN';state.rokade={wK:false,wQ:false,zK:false,zQ:false};return state
}
function fixture({ state=initialState(), steps=[true,true,true,true], solo=true, redraw=false }={}) {
  const win=new Events(),doc={ hidden:false,visibilityState:'visible',defaultView:win,createElement:tag=>new Node(tag,doc) }
  const root=new Node('main',doc),board=new Node('div',doc),menu=new Node('section',doc),legend=new Node('section',doc)
  const label=new Node('span',doc),legendSteps=new Node('span',doc),close=new Node('button',doc)
  label.setAttribute('data-knight-legend-label','');legendSteps.setAttribute('data-knight-legend-steps','');close.setAttribute('data-knight-close','');legend.append(label,legendSteps,close)
  menu.hidden=true;legend.hidden=true;root.append(board,menu,legend)
  const inputs=Array.from({length:4},(_,index)=>{const input=new Node('input',doc);input.setAttribute('data-knight-step',String(index+1));menu.append(input);return input})
  const settings={knightRouteSteps:steps.slice(),custom:'keep'},saved=[],inspected=[],flags={solo,busy:false,promotion:false,over:false,pending:false,noob:false}
  let language='nl',hold,controller,revision=0
  const t=(key,values)=>substitute(language==='en'?(SCHAAK_EN[key]||key):key,values)
  function draw(){board.replaceChildren();for(let r=0;r<8;r++)for(let k=0;k<8;k++){
    const square=new Node('button',doc);square.className='sch-vak';square.setAttribute('data-r',r);square.setAttribute('data-k',k);square.setAttribute('aria-label',`${String.fromCharCode(97+k)}${8-r}, ${state.bord[r][k]||'leeg'}`)
    if(state.bord[r][k]){const piece=new Node('span',doc);piece.className='sch-stuk';piece.innerHTML='<svg></svg>';square.append(piece)}board.append(square)
  }}
  draw()
  controller=maakPaardRoutesUI({Schaak,board,root,menu,legend,win,doc,playerColor:'w',getState:()=>state,getRevision:()=>revision,getSteps:()=>settings.knightRouteSteps,
    saveSteps:value=>{settings.knightRouteSteps=value.slice();saved.push(value.slice())},
    canInspect:()=>flags.solo&&!flags.busy&&!flags.promotion&&!flags.over&&!flags.pending&&!flags.noob&&state.aanZet==='w'&&root.isConnected,
    t,onInspect:value=>{inspected.push(value);if(redraw){draw();controller?.refresh()}},
    holdFactory:options=>{hold={options,destroyed:false,refreshes:0,cancels:0,refresh(){this.refreshes++},cancel(){this.cancels++},shouldIgnoreClick(){return false},destroy(){this.destroyed=true}};return hold}
  })
  const square=(r,k)=>board.querySelector(`[data-r="${r}"][data-k="${k}"]`)
  return {controller,hold,root,board,menu,legend,label,legendSteps,close,inputs,state,settings,saved,inspected,flags,square,draw,
    candidate:(r=4,k=3)=>hold.options.getCandidate(square(r,k)),show(r=4,k=3){hold.options.onHold(this.candidate(r,k))},
    toggle(index,on){inputs[index].checked=on;inputs[index].emit('change')},language(value){language=value;controller.refresh()},advanceRevision(){revision++},
    markers:()=>board.querySelectorAll('.sch-knight-marker')}
}

// The DOM uses the real route model, covers every quadrant, keeps captured
// pieces intact beneath the markers, and preserves independent horizons.
{
  const h=fixture(),candidate=h.candidate(),capturePiece=h.square(3,5).querySelector('.sch-stuk')
  assert.equal(h.hold.options.canHold(candidate),true);h.show();assert.equal(h.controller.active,true)
  const expected=berekenPaardroutes({Schaak,staat:h.state,van:[4,3]})
  assert.equal(h.markers().length,expected.reduce((n,field)=>n+field.steps.length,0))
  const quadrants=new Set()
  for(const field of expected){
    const square=h.square(field.r,field.k),markers=square.querySelectorAll('.sch-knight-marker')
    assert.deepEqual(markers.map(marker=>Number(marker.dataset.depth)),field.steps)
    for(const marker of markers)assert.equal(marker.getAttribute('aria-hidden'),'true')
    quadrants.add(`${field.r<4},${field.k<4}`)
  }
  assert.equal(quadrants.size,4,'no quadrant is cropped or omitted')
  assert.deepEqual(h.square(3,5).querySelectorAll('.sch-knight-marker').map(marker=>Number(marker.dataset.depth)),[1,3])
  assert.equal(h.square(3,5).querySelectorAll('.sch-stuk').length,1,'the piece underneath the capture target remains in the DOM')
  assert.equal(h.square(3,5).querySelector('.sch-stuk'),capturePiece,'inspection preserves the existing SVG node itself')
  assert.equal(h.square(5,5).querySelectorAll('.sch-knight-marker').length,0,'own pieces remain blockers at every depth')
  h.menu.hidden=false;assert.equal(h.hold.options.canHold(candidate),false,'a settings dialog prevents a new hold')
  h.controller.refresh();assert.equal(h.controller.active,true,'opening settings does not discard the displayed plan')
  const second=h.legendSteps.querySelector('[data-knight-legend-step="2"]')
  second.emit('click');assert.equal(h.settings.knightRouteSteps[1],false,'legend toggles the selected horizon')
  h.legendSteps.querySelector('[data-knight-legend-step="2"]').emit('click');assert.equal(h.settings.knightRouteSteps[1],true)
  for(let i=0;i<3;i++)h.toggle(i,false)
  assert(h.markers().length>0);assert(h.markers().every(marker=>marker.dataset.depth==='4'),'hiding early horizons does not remove fourth-jump routes')
  assert.deepEqual(h.settings.knightRouteSteps,[false,false,false,true]);assert.equal(h.settings.custom,'keep')
  h.toggle(3,false);assert.equal(h.controller.active,true);assert.equal(h.markers().length,0);assert.equal(h.hold.options.canHold(candidate),false)
  h.toggle(0,true);h.menu.hidden=true;h.show();assert.equal(h.controller.active,true)
  const existingDescription=h.square(3,5).getAttribute('aria-describedby')
  assert.ok(existingDescription,'reachable squares expose their jump counts to assistive technology')
  h.close.emit('click');assert.equal(h.controller.active,false);assert.equal(h.markers().length,0);assert.equal(h.legend.hidden,true)
  assert.equal(h.square(3,5).getAttribute('aria-describedby'),null,'closing removes only the temporary route description')
  assert.equal(h.inspected.at(-1),null,'closing restores normal board interaction')
  h.controller.destroy();assert.equal(h.hold.destroyed,true)
}

// The opponent knight can be inspected during the player's turn, using a
// hypothetical turn for its colour while preserving the real game state.
{
  const h=fixture(),before=plain(h.state)
  const candidate=h.candidate(2,2)
  assert.equal(h.hold.options.canHold(candidate),true);h.show(2,2)
  assert.equal(h.controller.active,true);assert(h.markers().length>0,'enemy inspection produces actual routes, not just a legend')
  assert(h.markers().every(marker=>marker.classList.contains('sch-knight-enemy')))
  const expected=berekenPaardroutes({Schaak,staat:{...h.state,aanZet:'z'},van:[2,2]})
  assert.equal(h.markers().length,expected.reduce((n,field)=>n+field.steps.length,0))
  assert.deepEqual(plain(h.state),before,'enemy inspection does not change the active player or board')
  h.controller.destroy()
}

// Live game gates and position identity reject stale timer callbacks even if
// the pointer controller has not yet seen a refresh or a cancel event.
{
  const h=fixture(),candidate=h.candidate()
  for(const flag of ['busy','promotion','over','pending','noob']){h.flags[flag]=true;assert.equal(h.hold.options.canHold(candidate),false);h.hold.options.onHold(candidate);assert.equal(h.controller.active,false);h.flags[flag]=false}
  h.state.aanZet='z';h.hold.options.onHold(candidate);assert.equal(h.controller.active,false);h.state.aanZet='w'
  h.state.bord[6][0]='wP';h.hold.options.onHold(candidate);assert.equal(h.controller.active,false,'a callback for an old FEN cannot inspect a new board')
  h.flags.solo=false;h.show();assert.equal(h.controller.active,false,'friend games never expose plans')
  h.flags.solo=true;h.show();assert.equal(h.controller.active,true)
  h.state.aanZet='z';h.controller.refresh();assert.equal(h.controller.active,false);assert.equal(h.markers().length,0)
  h.controller.destroy();h.hold.options.onHold(h.candidate());assert.equal(h.controller.active,false)
}

// A new generation invalidates old callbacks even when an undo/reset produces
// the same board position; route descriptions preserve unrelated accessibility.
{
  const h=fixture(),candidate=h.candidate()
  h.advanceRevision();h.hold.options.onHold(candidate);assert.equal(h.controller.active,false)
  h.square(3,5).setAttribute('aria-describedby','existing-description')
  h.show();assert.equal(h.controller.active,true)
  assert.match(h.square(3,5).getAttribute('aria-describedby'),/^existing-description /)
  h.advanceRevision();h.controller.refresh();assert.equal(h.controller.active,false)
  assert.equal(h.square(3,5).getAttribute('aria-describedby'),'existing-description')
  h.controller.destroy()
}

// Routes survive a source-square redraw, update accessible text on language
// changes, and dispose all settings/close handlers without touching the game.
{
  const h=fixture({redraw:true}),before=plain(h.state)
  h.show();assert.equal(h.controller.active,true);assert(h.markers().length>0)
  const original=h.label.textContent;h.language('en');assert.notEqual(h.label.textContent,original)
  assert.deepEqual(plain(h.state),before,'inspection never executes a move')
  h.controller.clear();assert.equal(h.markers().length,0)
  h.controller.destroy();h.controller.destroy()
  const count=h.saved.length;h.inputs[0].emit('change');h.close.emit('click');assert.equal(h.saved.length,count)
  assert.equal(h.hold.destroyed,true)
}
console.log('PASS: solo knight-route settings, full-board exact horizons, preserved pieces, live gates/stale positions, redraw, language, close and cleanup.')
