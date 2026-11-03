import assert from 'node:assert/strict'
import { maakPaardHold } from '../../schaak-paard-hold.js'

class Events {
  listeners = new Map()
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name,new Set()); this.listeners.get(name).add(callback) }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback) }
  emit(name, props = {}) {
    const event = { type:name, target:this, prevented:false, stopped:false, preventDefault(){this.prevented=true}, stopImmediatePropagation(){this.stopped=true}, ...props }
    for (const callback of [...this.listeners.get(name) || []]) { callback(event); if(event.stopped)break }
    return event
  }
  get listenerCount() { return [...this.listeners.values()].reduce((count,list)=>count+list.size,0) }
}
function fixture({ piece = 'wN' } = {}) {
  const win=new Events(),doc=new Events(),timers=new Map(),stale=[],holds=[],states=[],captureOwners=new Map()
  let time=0,nextTimer=0,allowed=true,fen='start',clicks=0
  class Element extends Events {
    isConnected=true
    captures=new Set()
    setPointerCapture(id) {
      const old=captureOwners.get(id)
      captureOwners.set(id,this);this.captures.add(id)
      if(old&&old!==this){old.captures.delete(id);win.emit('lostpointercapture',{pointerId:id,target:old})}
    }
    hasPointerCapture(id){return captureOwners.get(id)===this}
    releasePointerCapture(id){if(this.hasPointerCapture(id)){captureOwners.delete(id);this.captures.delete(id);win.emit('lostpointercapture',{pointerId:id,target:this})}}
    click(){const event=board.emit('click',{target:this,detail:0});if(!event.prevented)clicks++}
  }
  const board=new Element(),outside=new Element()
  let source=new Element()
  board.contains=node=>node===board||node===source
  const control=maakPaardHold({ board,win,doc,
    getCandidate:target=>target===source?{r:7,k:1,fen,piece}:null,
    canHold:candidate=>allowed&&candidate.fen===fen,
    onHold:candidate=>holds.push(candidate),onState:state=>states.push(state),now:()=>time,
    setTimer(callback,delay){const id=++nextTimer;timers.set(id,{callback,at:time+delay});stale.push(callback);return id},clearTimer:id=>timers.delete(id),
  })
  const pointer=(id=1,extra={})=>({pointerId:id,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:100,clientY:100,target:source,...extra})
  function down(extra={}){const event=pointer(1,extra);win.emit('pointerdown',event);return board.emit('pointerdown',event)}
  const move=(extra={})=>win.emit('pointermove',pointer(1,extra))
  const up=(extra={})=>{const event=pointer(1,{buttons:0,...extra});win.emit('pointerup',event);captureOwners.get(event.pointerId)?.releasePointerCapture(event.pointerId)}
  function advance(ms){time+=ms;for(const [id,timer]of [...timers])if(timer.at<=time&&timers.delete(id))timer.callback()}
  return {win,doc,board,outside,control,timers,holds,states,stale,pointer,down,move,up,advance,
    get source(){return source},get clicks(){return clicks},setAllowed:value=>{allowed=value},setFen:value=>{fen=value},
    redraw(){source.isConnected=false;source=new Element()},
  }
}

// Three seconds means three seconds, and activation survives the square being
// replaced while its stable board captures the held pointer.
for(const pointerType of ['touch','mouse','pen']){
  const h=fixture({piece:'zN'})
  h.down({pointerType})
  assert.equal(h.source.hasPointerCapture(1),true,'capture initially preserves the original click target')
  assert.equal(h.board.hasPointerCapture(1),false)
  h.advance(2999);assert.equal(h.holds.length,0)
  assert.deepEqual(h.states.at(-1),{phase:'holding',candidate:{r:7,k:1,fen:'start',piece:'zN'}})
  h.advance(1);assert.equal(h.holds.length,1);assert.deepEqual(h.holds[0],{r:7,k:1,fen:'start',piece:'zN'})
  assert.equal(h.board.hasPointerCapture(1),true,'the old square capture transfers without cancelling the hold')
  h.redraw();h.control.refresh();h.advance(5000)
  assert.equal(h.control.active,true);assert.equal(h.holds.length,1,'one activation per hold, even after a redraw')
  assert.equal(h.board.emit('click').prevented,true)
  h.up({pointerType,target:h.board});assert.equal(h.control.active,false)
  assert.equal(h.board.emit('click').prevented,true,'the release click cannot select or move a piece')
  h.advance(401);assert.equal(h.board.emit('click').prevented,false)
  h.control.destroy()
}

// A cancelled drag can be released outside the browser. Observing a fresh
// primary mouse down or a mouse move with no buttons restores normal input.
{
  const h=fixture()
  h.down({pointerType:'mouse'});h.move({pointerType:'mouse',clientX:130})
  assert.equal(h.control.shouldIgnoreClick(),true)
  h.move({pointerType:'mouse',buttons:0});h.advance(401)
  assert.equal(h.control.shouldIgnoreClick(),false)
  h.down({pointerType:'mouse'});h.move({pointerType:'mouse',clientX:130})
  h.down({pointerType:'mouse'});h.advance(100);h.up({pointerType:'mouse'})
  assert.equal(h.board.emit('click').prevented,false,'a deliberate fresh click is never stranded by a missed release')
  h.control.destroy()
}

// A short tap remains a normal square click. The prevented native actions are
// scoped to an eligible knight, not unrelated pieces, fields or settings.
{
  const h=fixture()
  h.down();h.advance(150);h.up();assert.equal(h.holds.length,0)
  assert.equal(h.board.emit('click',{target:h.source}).prevented,false)
  for(const type of ['contextmenu','selectstart','dragstart']){
    assert.equal(h.board.emit(type,{target:h.source}).prevented,true)
    assert.equal(h.board.emit(type,{target:h.outside}).prevented,false)
  }
  h.setAllowed(false)
  assert.equal(h.board.emit('contextmenu',{target:h.source}).prevented,false)
  h.down();h.advance(4000);assert.equal(h.control.active,false);assert.equal(h.holds.length,0)
  h.control.destroy()
}

// Movement is measured against the original location rather than movementX,
// and a cancelled pointer cannot turn into a late hold or compatibility click.
{
  const h=fixture()
  h.down();h.move({clientX:108});h.move({clientX:112});assert.equal(h.control.active,true)
  h.move({clientX:113});assert.equal(h.control.active,false);assert.equal(h.timers.size,0)
  h.advance(4000);assert.equal(h.holds.length,0)
  assert.equal(h.board.emit('click').prevented,true,'still suppress while the cancelled finger remains down')
  h.up();h.advance(401);assert.equal(h.board.emit('click').prevented,false)
  h.down();h.move({clientY:NaN});h.up();h.advance(4000);assert.equal(h.holds.length,0)
  h.control.destroy()
}

// A second finger anywhere cancels, without consuming the events needed by
// Ultra's independent two-finger board-sizing controller.
{
  const h=fixture()
  h.down()
  const second=h.win.emit('pointerdown',h.pointer(2,{isPrimary:false,target:h.outside}))
  assert.equal(second.prevented,false);assert.equal(second.stopped,false)
  assert.equal(h.control.active,false);assert.equal(h.timers.size,0)
  h.advance(4000);assert.equal(h.holds.length,0)
  h.up();assert.equal(h.control.shouldIgnoreClick(),true)
  h.win.emit('pointerup',h.pointer(2));h.advance(401)
  h.down();h.advance(3000);assert.equal(h.holds.length,1,'a fresh single-finger hold recovers normally')
  h.up();h.control.destroy()
}

for(const cancellation of ['pointercancel','lostpointercapture','blur','resize','visibilitychange']){
  const h=fixture()
  h.down();const late=h.stale.at(-1)
  if(cancellation==='visibilitychange'){h.doc.hidden=true;h.doc.emit(cancellation)}
  else if(cancellation==='lostpointercapture')h.source.releasePointerCapture(1)
  else h.win.emit(cancellation,h.pointer())
  assert.equal(h.control.active,false,cancellation);assert.equal(h.timers.size,0,cancellation)
  late();h.advance(4000);assert.equal(h.holds.length,0,'a stale cancelled timer cannot fire')
  h.up();h.doc.hidden=false;h.advance(401);assert.equal(h.board.emit('click').prevented,false)
  h.control.destroy()
}

// Layout/visibility changes may happen after showing routes while the user
// keeps holding. Their eventual release is still a consumed long-press click,
// even if it comes well after the ordinary 400ms post-release cooldown.
for(const cancellation of ['blur','resize','visibilitychange']){
  const h=fixture()
  h.down();h.advance(3000);assert.equal(h.holds.length,1)
  if(cancellation==='visibilitychange'){h.doc.hidden=true;h.doc.emit(cancellation)}
  else h.win.emit(cancellation)
  h.advance(2500);assert.equal(h.control.shouldIgnoreClick(),true,cancellation)
  h.doc.hidden=false;h.up()
  assert.equal(h.board.emit('click').prevented,true,'the late release cannot clear the displayed routes')
  h.advance(401);assert.equal(h.board.emit('click').prevented,false)
  h.control.destroy()
}

// A browser can omit that physical release after switching apps. A genuinely
// fresh primary touch, mouse press or key recovers without swallowing input.
for(const input of ['touch','mouse','keyboard']){
  const h=fixture()
  h.down();h.advance(3000);h.win.emit('blur');h.advance(2500)
  if(input==='keyboard'){
    h.board.emit('keydown',{key:'Enter',target:h.source});h.advance(100)
    h.win.emit('keyup',{key:'Enter',target:h.source});assert.equal(h.clicks,1)
  }else{
    h.down({pointerType:input,pointerId:2});h.advance(3000)
    assert.equal(h.holds.length,2,'a fresh primary pointer recovers from the missing old release')
    h.up({pointerType:input,pointerId:2})
  }
  h.control.destroy()
}

// Both redraw-driven refresh and the timer's own eligibility check protect
// against turn/FEN changes, menus, promotion, finished games or disabled toggles.
{
  const h=fixture()
  h.down();h.setFen('next');h.control.refresh();assert.equal(h.control.active,false)
  h.advance(3000);assert.equal(h.holds.length,0);h.up();h.advance(401)
  h.down();h.setAllowed(false);h.advance(3000);assert.equal(h.holds.length,0)
  h.up();h.advance(401);h.setAllowed(true)
  h.down({pointerType:'mouse',button:2});h.advance(3000);assert.equal(h.control.active,false)
  h.down({isPrimary:false});h.advance(3000);assert.equal(h.control.active,false)
  h.win.emit('blur');h.down({clientX:NaN});assert.equal(h.control.active,false)
  h.down({target:h.outside});assert.equal(h.control.active,false)
  h.control.destroy()
}

// Button keyboard activation remains available on a short press; holding Space
// or Enter has the same three-second behavior and blocks native repeat clicks.
for(const key of ['Enter',' ']){
  const h=fixture()
  assert.equal(h.board.emit('keydown',{key,target:h.source}).prevented,true)
  h.advance(100);h.win.emit('keyup',{key,target:h.source});assert.equal(h.clicks,1);assert.equal(h.holds.length,0)
  h.board.emit('keydown',{key,target:h.source})
  assert.equal(h.board.emit('keydown',{key,target:h.source,repeat:true}).prevented,true)
  assert.equal(h.timers.size,1)
  h.advance(3000);h.redraw();h.control.refresh();h.win.emit('keyup',{key,target:h.board})
  assert.equal(h.holds.length,1);assert.equal(h.clicks,1,'a held key does not activate the old square')
  h.advance(401);h.board.emit('keydown',{key,target:h.source});h.board.emit('keydown',{key:'Escape',target:h.source})
  h.win.emit('keyup',{key,target:h.source});assert.equal(h.clicks,1)
  for(const modifier of ['ctrlKey','metaKey','altKey'])assert.equal(h.board.emit('keydown',{key,target:h.source,[modifier]:true}).prevented,false)
  h.control.destroy()
}

{
  const h=fixture()
  h.down();const late=h.stale.at(-1)
  h.control.destroy();h.control.destroy();late();h.advance(5000)
  assert.equal(h.holds.length,0);assert.equal(h.control.active,false);assert.equal(h.control.shouldIgnoreClick(),false)
  assert.equal(h.source.hasPointerCapture(1),false)
  for(const target of [h.board,h.win,h.doc])assert.equal(target.listenerCount,0,'every listener is removed')
}
console.log('PASS: three-second knight holds, original-target taps, stable capture/redraws, FEN/turn guards, mobile selection suppression, pinch coexistence, keyboard and complete cleanup.')
