import assert from 'node:assert/strict'
import { maakUltraSwipe } from '../../schaak-ultra-swipe.js'

class Events {
  listeners = new Map()
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn) }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn) }
  emit(name, props = {}) {
    const event = { type:name, target:this, prevented:false, stopped:false, preventDefault(){this.prevented=true}, stopImmediatePropagation(){this.stopped=true}, ...props }
    for (const fn of [...this.listeners.get(name) || []]) { fn(event); if (event.stopped) break }
    return event
  }
  get count() { return [...this.listeners.values()].reduce((n, list) => n + list.size, 0) }
}
class Element extends Events {
  attrs = new Map()
  captures = new Set()
  hidden = false
  isConnected = true
  style = { values:new Map(), priorities:new Map(), getPropertyValue(name){return this.values.get(name)||''}, getPropertyPriority(name){return this.priorities.get(name)||''}, setProperty(name,value,priority=''){this.values.set(name,String(value));this.priorities.set(name,priority)}, removeProperty(name){this.values.delete(name);this.priorities.delete(name)} }
  getAttribute(name) { return this.attrs.get(name) ?? null }
  setAttribute(name, value) { this.attrs.set(name, String(value)) }
  removeAttribute(name) { this.attrs.delete(name) }
  getBoundingClientRect() { return {left:100,top:500,right:400,bottom:560,width:300,height:60} }
  setPointerCapture(id) { this.captures.add(id) }
  hasPointerCapture(id) { return this.captures.has(id) }
  releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', { pointerId:id }) }
}
function fixture({mobile=true,allowed=true}={}) {
  const element=new Element(),win=new Events(),doc=new Events(),media=new Events(),changes=[]
  doc.hidden=false;doc.visibilityState='visible';media.matches=mobile
  let time=0,canUndo=allowed,undos=0
  const control=maakUltraSwipe({element,win,doc,media,canUndo:()=>canUndo,onUndo:()=>undos++,now:()=>time,onChange:state=>changes.push(state)})
  const pointer=(id,x,y=530,extra={})=>({pointerId:id,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:x,clientY:y,...extra})
  const down=(x=370,y=530,extra={})=>{const p=pointer(1,x,y,extra);win.emit('pointerdown',p);return element.emit('pointerdown',p)}
  const move=(x,y=530,extra={})=>win.emit('pointermove',pointer(1,x,y,extra))
  const up=(x,y=530,extra={})=>{element.captures.delete(1);return win.emit('pointerup',pointer(1,x,y,{buttons:0,...extra}))}
  const pause=()=>{time+=401}
  const swipe=()=>{down();move(220);up(220);pause()}
  return {element,win,doc,media,control,changes,down,move,up,swipe,pause,pointer,get undos(){return undos},allowed(value){canUndo=value;control.refresh()},setAllowed(value){canUndo=value}}
}

// Slightly beyond the midpoint commits once on release, never on crossing. A
// dragged-back thumb or a normal tap cannot undo an unexpectedly large turn.
{
  const h=fixture()
  h.down();assert.equal(h.control.state,'dragging');assert.equal(h.element.captures.size,1)
  h.move(226);assert.equal(h.control.state,'ready');assert.equal(h.control.progress,1);assert.equal(h.undos,0)
  h.up(226);assert.equal(h.undos,1,'exact 42% end threshold and sufficient travel commits on release')
  h.win.emit('pointerup',h.pointer(1,226));h.element.emit('lostpointercapture',{pointerId:1})
  h.element.emit('click',{detail:1,pointerType:'touch'});h.element.emit('click',{detail:0})
  assert.equal(h.undos,1,'release, lost capture and compatibility clicks still mean one takeback')
  h.pause();h.down();h.move(210);h.move(320);assert.equal(h.control.state,'dragging')
  h.up(320);assert.equal(h.undos,1,'returning to the right before releasing cancels readiness')
  h.pause();h.down();h.up(370);h.element.emit('click',{detail:1,pointerType:'touch'});assert.equal(h.undos,1,'a tap is never an undo')
  h.pause();h.swipe();h.swipe();assert.equal(h.undos,3,'separate deliberate swipes each undo once')
  h.control.destroy()
}

// Starts are restricted to the right end; both the travel distance and the
// absolute release point are required. Scrolling and wrong-way drags are safe.
{
  const h=fixture()
  for(const x of [100,250,309,401]) {h.down(x);h.move(100);h.up(100);assert.equal(h.undos,0)}
  h.down(310);h.move(235);h.up(235);assert.equal(h.undos,0,'stopping at 45% is not far enough')
  h.pause();h.down(310);h.move(226);h.up(226);assert.equal(h.undos,1,'starting at 70% and releasing at exactly 42% is enough')
  h.pause();h.down(325);h.move(223);h.up(223);assert.equal(h.undos,2,'starting at 75% and releasing just beyond the middle qualifies')
  h.pause();h.down();h.move(227);h.up(227);assert.equal(h.undos,2,'one pixel before the end threshold is not ready')
  h.pause();h.down();h.move(390);h.up(390);assert.equal(h.undos,2,'left-to-right is not undo')
  h.pause();h.down();const vertical=h.move(368,550);assert.equal(vertical.prevented,false,'vertical pan stays available to browser')
  h.move(180,550);h.up(180,550);assert.equal(h.undos,2,'a cancelled vertical scroll cannot turn into an undo')
  h.down();h.move(180,580);h.up(180,580);assert.equal(h.undos,2,'large vertical deviation cancels even a long horizontal drag')
  h.down();h.move(Number.NaN);h.up(180);assert.equal(h.undos,2,'invalid coordinates clear prior readiness')
  h.control.destroy()
}

// Extra fingers anywhere in the window cancel the strip, as do real capture
// losses, cancellation, blur, resize, hidden documents and leaving mobile.
{
  const h=fixture()
  h.down();h.win.emit('pointerdown',h.pointer(2,390,530,{isPrimary:false}));h.move(180);h.up(180)
  assert.equal(h.undos,0,'second finger outside the strip cancels')
  h.win.emit('pointerup',h.pointer(2,390));h.pause()
  h.down();h.element.emit('lostpointercapture',{pointerId:1,target:new Element()});h.move(220);h.up(220)
  assert.equal(h.undos,1,'implicit capture transferring from nested label does not cancel')
  h.pause();h.down();h.move(220);h.element.captures.delete(1);h.element.emit('lostpointercapture',{pointerId:1});h.up(220)
  assert.equal(h.undos,1,'actual strip capture loss cancels')
  for(const type of ['pointercancel','blur','resize']) {
    h.pause();h.down();h.move(220);h.win.emit(type,h.pointer(1,220));h.up(220);assert.equal(h.undos,1,type)
  }
  h.pause();h.down();h.move(220);h.doc.hidden=true;h.doc.emit('visibilitychange');h.up(220);assert.equal(h.undos,1)
  h.doc.hidden=false;h.doc.emit('visibilitychange')
  h.pause();h.down();h.move(220);h.media.matches=false;h.media.emit('change');h.up(220);assert.equal(h.undos,1)
  assert.equal(h.control.enabled,false);assert.equal(h.element.getAttribute('data-swipe-active'),'false')
  h.media.matches=true;h.media.emit('change');h.pause();h.swipe();assert.equal(h.undos,2,'fresh swipes recover normally')
  h.control.destroy()
}

// The live game gate is checked again when releasing, including mutations that
// occur between a UI refresh and the release event. Pen/nonprimary mouse stay inert.
{
  const h=fixture({allowed:false})
  h.swipe();assert.equal(h.undos,0);assert.equal(h.control.state,'disabled');assert.equal(h.element.getAttribute('aria-disabled'),'true')
  h.allowed(true)
  h.down();h.move(220);h.setAllowed(false);h.up(220);assert.equal(h.undos,0,'busy/off/pending at release cannot undo')
  h.allowed(true);h.pause();h.down();h.move(220);h.element.isConnected=false;h.up(220);assert.equal(h.undos,0,'detached game cannot undo')
  h.element.isConnected=true;h.control.refresh()
  for(const extra of [{pointerType:'pen'},{pointerType:'mouse',button:2},{pointerType:'touch',isPrimary:false}]) {
    h.down(370,530,extra);h.move(220,530,extra);h.up(220,530,extra);assert.equal(h.undos,0)
  }
  h.win.emit('blur')
  h.down(370,530,{pointerType:'mouse'});h.move(220,530,{pointerType:'mouse',buttons:0});h.up(220,530,{pointerType:'mouse'});assert.equal(h.undos,0,'released mouse drag cannot retain readiness')
  h.down(370,530,{pointerType:'mouse'});h.move(220,530,{pointerType:'mouse'});h.up(220,530,{pointerType:'mouse'});assert.equal(h.undos,1,'primary mouse supports the phone preview')
  h.control.destroy()
}

// Keyboard and AT activation are deliberate alternatives. Repeats/modifiers,
// duplicate native clicks and post-disposal events cannot invoke another undo.
{
  const h=fixture()
  for(const extra of [{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{target:new Element()}]) h.element.emit('keydown',{key:'Enter',...extra})
  assert.equal(h.undos,0)
  h.element.emit('keydown',{key:'Enter'});h.element.emit('click',{detail:0});assert.equal(h.undos,1)
  h.pause();h.element.emit('keydown',{key:' '});assert.equal(h.undos,2)
  h.pause();h.element.emit('click',{detail:0});assert.equal(h.undos,3,'assistive activation works without forcing a drag')
  h.pause();h.element.emit('click',{detail:1,pointerType:'mouse'});assert.equal(h.undos,3,'ordinary mouse click remains inert')
  h.down();h.move(220);h.control.destroy();h.up(220);h.element.emit('keydown',{key:'Enter'});assert.equal(h.undos,3)
  h.control.destroy()
  for(const target of [h.element,h.win,h.doc,h.media])assert.equal(target.count,0,'all listeners released')
  for(const name of ['data-swipe-active','data-swipe-state','aria-disabled','tabindex']) assert.equal(h.element.getAttribute(name),null)
  assert.equal(h.element.style.getPropertyValue('--sch-swipe-progress'),'')
}
{
  const element=new Element(),media=new Events(),win=new Events();media.matches=false
  element.setAttribute('aria-disabled','mixed');element.setAttribute('tabindex','5');element.style.setProperty('--sch-swipe-progress','.2','important')
  const control=maakUltraSwipe({element,media,win,canUndo:()=>true})
  assert.equal(control.enabled,false);control.destroy()
  assert.equal(element.getAttribute('aria-disabled'),'mixed');assert.equal(element.getAttribute('tabindex'),'5')
  assert.equal(element.style.getPropertyValue('--sch-swipe-progress'),'.2');assert.equal(element.style.getPropertyPriority('--sch-swipe-progress'),'important')
}
console.log('PASS: mobile Ultra release-to-undo swipe, exact thresholds, backtracking, scrolling/multitouch cancellation, live gate, capture/viewport lifecycle, keyboard/AT and cleanup.')
