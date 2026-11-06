import assert from 'node:assert/strict'
import { maakHintHold } from '../../schaak-hint-hold.js'

class Events {
  listeners = new Map()
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn) }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
  emit(type, values = {}) {
    const event = { type, target:this, prevented:false, stopped:false, preventDefault(){this.prevented=true}, stopImmediatePropagation(){this.stopped=true}, ...values }
    for (const fn of [...this.listeners.get(type) || []]) { fn(event); if(event.stopped)break }
    return event
  }
  get count(){return [...this.listeners.values()].reduce((n,set)=>n+set.size,0)}
}
function fixture(options = {}) {
  const win=new Events(),doc=new Events(),timers=new Map(),stale=[],short=[],long=[],states=[],captures=new Set()
  let time=0,next=0,allowed=true,context='position:1',contextError=false
  doc.hidden=false;doc.visibilityState='visible'
  class Element extends Events {
    isConnected=true;disabled=false;hidden=false;ancestorHidden=false;display='block';visibility='visible';attrs=new Map()
    contains(node){return node===this||node===child}
    closest(){return this.ancestorHidden?{}:null}
    getAttribute(name){return this.attrs.get(name)??null}
    click(){return this.emit('click',{target:this,detail:0})}
    setPointerCapture(id){captures.add(id)}
    hasPointerCapture(id){return captures.has(id)}
    releasePointerCapture(id){if(captures.delete(id))win.emit('lostpointercapture',{pointerId:id,target:this})}
  }
  const element=new Element(),child={},outside={}
  win.getComputedStyle=node=>({display:node.display,visibility:node.visibility})
  const control=maakHintHold({element,win,doc,...options,
    canActivate:()=>allowed,getContext:()=>{if(contextError)throw Error('unavailable');return context},
    onShort:value=>short.push(value),onLong:value=>long.push(value),onState:value=>states.push(value),now:()=>time,
    setTimer(fn,delay){const id=++next;timers.set(id,{fn,at:time+delay});stale.push(fn);return id},clearTimer:id=>timers.delete(id),
  })
  const pointer=(id=1,extra={})=>({pointerId:id,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:100,clientY:100,target:element,...extra})
  function down(extra={}){const e=pointer(1,extra);win.emit('pointerdown',e);return element.emit('pointerdown',e)}
  function up(extra={}){const e=pointer(1,{buttons:0,...extra});win.emit('pointerup',e);element.releasePointerCapture(e.pointerId)}
  function advance(ms){time+=ms;for(const[id,item]of [...timers])if(item.at<=time&&timers.delete(id))item.fn()}
  const keyDown=(key,extra={})=>element.emit('keydown',{key,target:element,...extra})
  const keyUp=(key,extra={})=>win.emit('keyup',{key,target:element,...extra})
  return {win,doc,element,child,outside,control,timers,stale,short,long,states,pointer,down,up,advance,keyDown,keyUp,
    move:extra=>win.emit('pointermove',pointer(1,extra)),setAllowed:value=>{allowed=value},setContext:value=>{context=value},setContextError:value=>{contextError=value}}
}

for(const pointerType of ['touch','mouse','pen']){
  const h=fixture()
  h.down({pointerType});assert.equal(h.element.hasPointerCapture(1),true)
  assert.deepEqual(h.states.at(-1),{phase:'holding'})
  h.advance(2999);assert.equal(h.long.length,0)
  h.advance(1);assert.equal(h.long.length,1);assert.equal(h.short.length,0)
  assert.deepEqual(h.states.at(-1),{phase:'fired'})
  h.advance(5000);assert.equal(h.long.length,1,'one detailed request per physical hold')
  assert.equal(h.element.click().stopped,true)
  h.up({pointerType});assert.equal(h.element.hasPointerCapture(1),false)
  assert.equal(h.element.click().stopped,true,'the long release cannot request the ordinary hint')
  h.advance(401);h.element.click();assert.equal(h.short.length,1,'native/accessible clicks work again after the release')
  h.control.destroy()
}

// A short pointer activation is the native click, not a second callback on up.
{
  const h=fixture();h.down({target:h.child});h.advance(80);h.up()
  assert.equal(h.short.length,0);h.element.click();assert.equal(h.short.length,1);assert.equal(h.long.length,0)
  h.element.click();assert.equal(h.short.length,2,'standalone synthetic/assistive clicks remain usable')
  for(const type of ['selectstart','contextmenu','dragstart'])assert.equal(h.element.emit(type).prevented,true)
  h.setAllowed(false);assert.equal(h.element.click().stopped,true);assert.equal(h.short.length,2)
  h.control.destroy()
}

// Movement beyond twelve CSS pixels cancels; invalid movement and cancellations
// never turn into a late detailed hint or a native compatibility activation.
for(const cancellation of ['move','invalid','pointercancel','lostpointercapture','buttonblur','blur','resize','visibilitychange']){
  const h=fixture();h.down();const late=h.stale.at(-1)
  if(cancellation==='move'){h.move({clientX:112});assert.equal(h.control.active,true);h.move({clientX:113})}
  else if(cancellation==='invalid')h.move({clientY:NaN})
  else if(cancellation==='lostpointercapture')h.element.releasePointerCapture(1)
  else if(cancellation==='visibilitychange'){h.doc.hidden=true;h.doc.emit('visibilitychange')}
  else if(cancellation==='buttonblur')h.element.emit('blur')
  else h.win.emit(cancellation,h.pointer())
  assert.equal(h.control.active,false,cancellation);assert.equal(h.timers.size,0)
  if(cancellation==='pointercancel')assert.equal(h.element.click().stopped,true,'consume an immediate compatibility click after cancellation')
  late();h.advance(6000);h.doc.hidden=false;assert.equal(h.long.length,0)
  if(cancellation==='pointercancel')h.element.click()
  else {
    assert.equal(h.element.click().stopped,true,'still consume the physically held cancelled pointer')
    h.up();assert.equal(h.element.click().stopped,true);h.advance(401);h.element.click()
  }
  assert.equal(h.short.length,1)
  h.control.destroy()
}

// A second contact anywhere cancels without preventing another component's
// pinch/scroll input. A new single primary contact can start normally afterward.
{
  const h=fixture();h.down()
  const event=h.win.emit('pointerdown',h.pointer(2,{isPrimary:false,target:h.outside}))
  assert.equal(event.prevented,false);assert.equal(event.stopped,false);assert.equal(h.control.active,false)
  h.up();h.advance(4000);assert.equal(h.element.click().stopped,true)
  h.win.emit('pointerup',h.pointer(2));h.down({pointerId:3});h.advance(3000);assert.equal(h.long.length,1)
  h.up({pointerId:3});h.control.destroy()
}

// App switches after firing preserve the release block even beyond its normal
// cooldown. Missed releases recover only with a new primary input or fresh key.
for(const type of ['blur','resize','visibilitychange'])for(const recovery of ['release','touch','mouse','keyboard']){
  const h=fixture();h.down();h.advance(3000)
  if(type==='visibilitychange'){h.doc.hidden=true;h.doc.emit(type)}else h.win.emit(type)
  h.advance(5000);h.doc.hidden=false;assert.equal(h.element.click().stopped,true)
  if(recovery==='release'){h.up();assert.equal(h.element.click().stopped,true);h.advance(401);h.element.click();assert.equal(h.short.length,1)}
  else if(recovery==='keyboard'){h.keyDown('Enter');h.advance(100);h.keyUp('Enter');assert.equal(h.short.length,1)}
  else{h.down({pointerType:recovery,pointerId:4});h.advance(3000);assert.equal(h.long.length,2);h.up({pointerId:4})}
  h.control.destroy()
}

// Hidden, disabled, disconnected and stale-position buttons never activate,
// including when their status changes only immediately before a timer fires.
for(const gate of ['disabled','hidden','ancestorHidden','disconnected','aria','display','visibility','allowed','context','contextError','docHidden']){
  const h=fixture();h.down()
  if(gate==='disconnected')h.element.isConnected=false
  else if(gate==='aria')h.element.attrs.set('aria-disabled','true')
  else if(gate==='display')h.element.display='none'
  else if(gate==='visibility')h.element.visibility='hidden'
  else if(gate==='allowed')h.setAllowed(false)
  else if(gate==='context')h.setContext('position:2')
  else if(gate==='contextError')h.setContextError(true)
  else if(gate==='docHidden')h.doc.hidden=true
  else h.element[gate]=true
  h.advance(3000);assert.equal(h.long.length,0,gate);assert.equal(h.control.active,false)
  assert.equal(h.element.click().stopped,true);h.up();h.control.destroy()
}
{
  const h=fixture();h.down();h.setContext('new');h.control.refresh();assert.equal(h.control.active,false)
  h.up();h.advance(401);h.down();h.advance(50);h.up();h.setContext('newer');h.control.refresh()
  assert.equal(h.element.click().stopped,true,'a stale short-release click is consumed too');assert.equal(h.short.length,0)
  h.control.destroy()
}

// Explicit refresh/cancel and a fresh primary press do not strand a button.
for(const fired of [false,true]){
  const h=fixture();h.down();h.advance(fired?3000:500);h.control.cancel();h.advance(5000)
  assert.equal(h.element.click().stopped,true);assert.equal(h.long.length,fired?1:0)
  h.up();assert.equal(h.element.click().stopped,true)
  h.down({pointerId:8,pointerType:'mouse'});h.advance(50);h.up({pointerId:8,pointerType:'mouse'});h.element.click()
  assert.equal(h.short.length,1,'a new primary sequence may be activated without waiting for the old cooldown')
  h.control.destroy()
}
{
  const h=fixture();h.setContextError(true);h.element.click();h.down();h.advance(3000)
  assert.equal(h.short.length,0);assert.equal(h.long.length,0);h.control.destroy()
}
{
  const h=fixture({holdMs:1000});h.down();h.advance(999);assert.equal(h.long.length,0)
  h.advance(1);assert.equal(h.long.length,1);h.up();h.control.destroy()
}
{
  const h=fixture()
  for(const event of [{pointerType:'mouse',button:2},{isPrimary:false},{clientX:NaN},{pointerId:NaN},{target:h.outside}]){
    h.down(event);h.advance(3000);assert.equal(h.control.active,false);assert.equal(h.long.length,0)
    h.win.emit('blur')
  }
  h.control.destroy()
}

for(const key of ['Enter',' ']){
  const h=fixture()
  assert.equal(h.keyDown(key).prevented,true);h.advance(100);assert.equal(h.short.length,0)
  assert.equal(h.keyUp(key).prevented,true);assert.equal(h.short.length,1)
  assert.equal(h.element.click().stopped,true,'compatibility key click cannot duplicate the hint')
  h.keyDown(key);h.advance(100);h.keyUp(key);assert.equal(h.short.length,2,'two deliberate quick key presses both work')
  h.keyDown(key);h.keyDown(key,{repeat:true});assert.equal(h.timers.size,1)
  h.advance(2999);assert.equal(h.long.length,0);h.advance(1);assert.equal(h.long.length,1)
  h.keyUp(key);h.element.click();assert.equal(h.short.length,2,'held key release does not request a short hint')
  h.keyDown(key);h.keyDown('Escape');h.advance(5000);h.keyUp(key);h.element.click();assert.equal(h.short.length,2)
  h.advance(401)
  for(const mod of ['ctrlKey','altKey','metaKey'])assert.equal(h.keyDown(key,{[mod]:true}).prevented,false)
  h.control.destroy()
}
for(const key of ['Enter',' ']){
  const h=fixture();h.keyDown(key);h.advance(3000);h.win.emit('blur');h.advance(5000)
  assert.equal(h.keyUp(key).prevented,true);h.element.click();assert.equal(h.short.length,0,'late key release remains blocked')
  h.keyDown(key);h.advance(50);h.keyUp(key);assert.equal(h.short.length,1,'fresh key recovers after cancelled long press')
  h.control.destroy()
}
{
  const h=fixture();h.down();const late=h.stale.at(-1);h.control.destroy();h.control.destroy();late();h.advance(5000)
  assert.equal(h.long.length,0);assert.equal(h.short.length,0);assert.equal(h.control.active,false);assert.equal(h.timers.size,0)
  assert.equal(h.element.hasPointerCapture(1),false)
  for(const node of [h.win,h.doc,h.element])assert.equal(node.count,0,'all handlers are removed')
}
console.log('PASS: three-second detailed hints; native short clicks; touch/mouse/pen and keyboard; state/context gates; cancellation, missed releases, compatibility-click suppression and cleanup.')
