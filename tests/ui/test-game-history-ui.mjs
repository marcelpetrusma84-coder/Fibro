import assert from 'node:assert/strict'
import { mountSpelVersie, dagenTussenVersies } from '../../spelversie-ui.js'

class Node {
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentNode=null;this.attrs=new Map();this.classes=new Set();this.listeners=new Map();this.disabled=false;this.hidden=false;this._text='';this.classList={add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),contains:n=>this.classes.has(n)}}
  get className(){return [...this.classes].join(' ')}set className(value){this.classes=new Set(String(value).split(/\s+/).filter(Boolean))}
  get childNodes(){return this.children}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('')}set textContent(value){this.replaceChildren();this._text=String(value)}
  get id(){return this.getAttribute('id')}set id(value){this.setAttribute('id',value)}
  setAttribute(name,value){this.attrs.set(name,String(value))}getAttribute(name){return this.attrs.get(name)??null}removeAttribute(name){this.attrs.delete(name)}
  append(...children){for(const child of children){child.remove();child.parentNode=this;this.children.push(child)}}
  replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...children)}
  remove(){if(this.parentNode){const children=this.parentNode.children;children.splice(children.indexOf(this),1);this.parentNode=null}}
  matches(selector){return selector.startsWith('.')?this.classes.has(selector.slice(1)):selector.startsWith('#')?this.id===selector.slice(1):this.tagName.toLowerCase()===selector}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)])}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn)}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn)}
  emit(name,values={}){
    const event=values.type?values:{type:name,target:this,prevented:false,stopped:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},...values}
    for(const fn of [...this.listeners.get(name)||[]])fn(event)
    if(!event.stopped)this.parentNode?.emit(name,event)
    return event
  }
  click(){if(this.disabled)return null;this.focus();return this.emit('click')}
  focus(){this.ownerDocument.activeElement=this}
}
function fixture(history,currentVersion='6.10.0'){
  const doc={createElement:tag=>new Node(tag,doc),activeElement:null};doc.head=new Node('head',doc);doc.body=new Node('body',doc);doc.documentElement=new Node('html',doc);doc.documentElement.append(doc.head,doc.body);doc.getElementById=id=>doc.documentElement.querySelector('#'+id)
  const card=new Node('section',doc),host=new Node('span',doc),original=new Node('b',doc);original.textContent='v6.0';host.append(original);host.setAttribute('aria-label','old label');host.setAttribute('lang','fr');host.className='widget-spelversie';card.append(host);doc.body.append(card)
  let plays=0;card.addEventListener('click',()=>plays++);card.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key))plays++})
  const controller=mountSpelVersie(host,{game:'Chess',history,currentVersion,language:'nl',timeZone:'Europe/Amsterdam'})
  const node=selector=>host.querySelector(selector)
  return {doc,host,original,card,controller,node,get plays(){return plays}}
}
const history=[
  {version:'6.10.0',updatedAt:'2026-11-03T21:48:00Z',summary:'Paardroutes',summaryEn:'Knight routes'},
  {version:'6.9.1',updatedAt:'2026-11-01T21:48:00Z',summary:'Correctie',summaryEn:'Fix'},
  {version:'6.9.0',updatedAt:'2026-11-01T20:48:00Z',summary:'Uitbreiding',summaryEn:'Feature'},
  {version:'6.0.0',updatedAt:'2026-10-21T14:00:00Z',summary:'Eerst geregistreerd',summaryEn:'First recorded',firstRecorded:true},
]
const untouched=JSON.stringify(history)

// Browse metadata without launching the surrounding game. Both boundaries,
// keyboard navigation and the return-to-current action share the same state.
{
  const h=fixture(history),up=h.node('.sv-arrow-up'),down=h.node('.sv-arrow-down')
  assert.equal(h.node('.sv-version').textContent,'v6.10','minor 10 is not decimal 1')
  assert.equal(h.node('.sv-date').getAttribute('datetime'),history[0].updatedAt.replace('00Z','00.000Z'))
  assert.match(h.node('.sv-date').textContent,/22:48/,'the displayed time follows the device timezone')
  assert.match(h.node('.sv-date').textContent,/2026/)
  assert.equal(h.node('.sv-gap').textContent,'+2 dagen na vorige')
  assert.equal(up.disabled,true);assert.equal(down.disabled,false)
  assert.equal(down.click().prevented,true);assert.equal(h.plays,0)
  assert.equal(h.controller.selectedVersion,'6.9.1');assert.equal(h.node('.sv-version').textContent,'v6.9.1')
  assert.equal(h.node('.sv-state').textContent,'Historie');assert.equal(h.node('.sv-context').textContent,'Actueel: v6.10')
  assert.equal(h.node('.sv-gap').textContent,'Minder dan 1 dag na vorige')
  assert.match(h.node('.sv-version').getAttribute('aria-label'),/speelbare versie is v6.10/)
  down.click();down.click();assert.equal(h.controller.selectedVersion,'6.0.0');assert.equal(down.disabled,true)
  assert.equal(h.node('.sv-gap').textContent,'Begin registratie')
  assert.equal(h.doc.activeElement,up,'reaching the last entry preserves a usable keyboard focus')
  const arrow=up.emit('keydown',{key:'ArrowUp'});assert.equal(arrow.prevented,true);assert.equal(h.controller.selectedVersion,'6.9.0')
  up.emit('keyup',{key:'Enter'});up.emit('keydown',{key:'Enter'});assert.equal(h.plays,0,'card-level keyboard launching stays isolated')
  h.node('.sv-version').click();assert.equal(h.controller.selectedVersion,'6.10.0');assert.equal(up.disabled,true)
  assert.equal(h.doc.activeElement,down,'returning to the current release preserves usable keyboard focus')
  down.emit('keydown',{key:'ArrowDown'});assert.equal(h.controller.selectedVersion,'6.9.1')
  down.emit('keydown',{key:'Home'});assert.equal(h.controller.selectedVersion,'6.10.0')
  h.card.emit('click');assert.equal(h.plays,1,'the surrounding card still launches normally')
  assert.equal(JSON.stringify(history),untouched,'browsing does not edit canonical release data')
  h.controller.destroy()
}

// Language changes preserve the historical selection. A new current release
// updates users viewing current, without kicking a reader out of old history.
{
  const h=fixture(history);h.node('.sv-arrow-down').click()
  h.controller.update({language:'en'})
  assert.equal(h.controller.selectedVersion,'6.9.1');assert.equal(h.host.getAttribute('lang'),'en')
  assert.equal(h.node('.sv-state').textContent,'History');assert.equal(h.node('.sv-context').textContent,'Current: v6.10')
  assert.equal(h.node('.sv-gap').textContent,'Less than 1 day after previous')
  assert.equal(h.node('.sv-arrow-up').getAttribute('aria-label'),'Newer version')
  assert.equal(h.node('.sv-shell').title,'Fix')
  const updated=[{version:'6.11.0',updatedAt:'2026-11-04T21:48:00Z'},...history]
  h.controller.update({history:updated,currentVersion:'6.11.0'})
  assert.equal(h.controller.selectedVersion,'6.9.1','an intentional historical view is preserved')
  h.node('.sv-version').click();assert.equal(h.controller.selectedVersion,'6.11.0')
  h.controller.update({history:[{version:'6.12.0',updatedAt:'2026-11-05T21:48:00Z'},...updated],currentVersion:'6.12.0'})
  assert.equal(h.controller.selectedVersion,'6.12.0','the current view follows a newly available release')
  h.controller.destroy()
}

// Missing or malformed dates never turn into fabricated epoch timestamps or
// false update intervals; first-recorded metadata is explicitly distinguished.
{
  const h=fixture([{version:'6.0.0',updatedAt:'not a date',firstRecorded:true}],'6.1.0')
  assert.equal(h.node('.sv-version').textContent,'v6.1')
  assert.equal(h.node('.sv-date').textContent,'Datum onbekend');assert.equal(h.node('.sv-date').getAttribute('datetime'),null)
  assert.equal(h.node('.sv-gap').textContent,'Tussenpoos onbekend')
  h.node('.sv-arrow-down').click();assert.equal(h.node('.sv-gap').textContent,'Begin registratie')
  h.controller.destroy()
  assert.equal(dagenTussenVersies({updatedAt:'2026-03-29T10:00:00Z'},{updatedAt:'2026-03-28T11:00:00Z'}),0,'a 23-hour DST interval is less than one full day')
  assert.equal(dagenTussenVersies({updatedAt:'2026-03-28T11:00:00Z'},{updatedAt:'2026-03-29T10:00:00Z'}),null,'reversed timestamps are not invented positive intervals')
  assert.equal(dagenTussenVersies({updatedAt:null},{updatedAt:'2026-01-01T00:00:00Z'}),null)
}

// Remount and disposal restore the host and release all listeners. Styling is
// installed once per document, even when multiple game badges are mounted.
{
  const h=fixture(history),oldButton=h.node('.sv-arrow-down')
  const extra=new Node('span',h.doc);h.doc.body.append(extra)
  const second=mountSpelVersie(extra,{game:'Neon',history,currentVersion:'6.10.0'})
  assert.equal(h.doc.head.querySelectorAll('style').length,1)
  h.controller.destroy();h.controller.destroy()
  assert.equal(h.host.children[0],h.original);assert.equal(h.host.getAttribute('aria-label'),'old label');assert.equal(h.host.getAttribute('lang'),'fr')
  assert.equal(h.host.className,'widget-spelversie');assert.equal(h.host.listeners.get('click').size,0)
  oldButton.emit('click');assert.equal(h.controller.selectedVersion,'6.10.0','retired controls do not navigate history')
  const remount=mountSpelVersie(extra,{game:'Neon',history,currentVersion:'6.9.1'})
  assert.equal(second.selectedVersion,'6.10.0');assert.equal(remount.selectedVersion,'6.9.1')
  second.destroy();assert.equal(extra.children.length,1,'destroying a replaced owner does not erase its replacement')
  remount.destroy()
}
console.log('PASS: game release browsing, timestamps and gaps, keyboard/card isolation, language and release updates, unknown dates and complete lifecycle.')
