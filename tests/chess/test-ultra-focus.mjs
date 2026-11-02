import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maakUltraFocus } from '../../schaak-ultra-focus.js'

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
  classes = new Set()
  captures = new Set()
  hidden = false
  classList = { contains:name=>this.classes.has(name), toggle:(name, on)=>on?this.classes.add(name):this.classes.delete(name) }
  getAttribute(name) { return this.attrs.get(name) ?? null }
  setAttribute(name, value) { this.attrs.set(name, String(value)) }
  removeAttribute(name) { this.attrs.delete(name) }
  setPointerCapture(id) { this.captures.add(id) }
  hasPointerCapture(id) { return this.captures.has(id) }
  releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', { pointerId:id }) }
  focus() { this.focused = true }
}
function fixture({ mobile = true } = {}) {
  const root = new Element(), board = new Element(), host = new Element(), restoreButton = new Element(), win = new Events(), media = new Events(), changes = []
  restoreButton.hidden = true; media.matches = mobile
  let time = 0
  const focus = maakUltraFocus({ root, board, host, restoreButton, win, media, now:()=>time, onChange:state=>changes.push(state) })
  const touch = (id, x, y = 100) => ({ pointerId:id, pointerType:'touch', clientX:x, clientY:y })
  const down = (id, x, y) => board.emit('pointerdown', touch(id, x, y))
  const move = (id, x, y) => win.emit('pointermove', touch(id, x, y))
  const up = id => { board.captures.delete(id); win.emit('pointerup', { pointerId:id }) }
  const pause = () => { time += 401 }
  const gesture = direction => { down(1,100); down(2,200); move(2,direction>0?270:140); up(1); up(2); pause() }
  return {root,board,host,restoreButton,win,media,focus,changes,down,move,up,pause,gesture}
}

// Every separate spread hides one further group; a continuing spread cannot
// race through all four stages. Closing gestures undo exactly the same steps.
{
  const h = fixture()
  assert.equal(h.focus.active,true); assert.equal(h.focus.stage,0)
  assert.equal(h.board.getAttribute('tabindex'),'0')
  for (let stage = 1; stage <= 4; stage++) {
    h.down(1,100); assert.equal(h.board.captures.size,0,'a one-finger square tap keeps its original target')
    h.down(2,200); assert.equal(h.board.captures.size,2)
    h.move(2,260); assert.equal(h.focus.stage,stage)
    h.move(2,440); h.move(1,0); assert.equal(h.focus.stage,stage,'one step per gesture, even after a large spread')
    const click = h.board.emit('click'); assert.equal(click.prevented,true); assert.equal(click.stopped,true)
    h.up(1); assert.equal(h.focus.shouldIgnoreClick(),true,'one remaining finger cannot click a square')
    h.up(2); assert.equal(h.focus.shouldIgnoreClick(),true); h.pause()
    assert.equal(h.board.emit('click').prevented,false,'ordinary square taps resume after the gesture')
  }
  assert.equal(h.restoreButton.hidden,false); assert.equal(h.root.getAttribute('data-ultra-focus'),'4')
  h.gesture(1); assert.equal(h.focus.stage,4,'upper bound')
  for(let stage=3;stage>=0;stage--) { h.gesture(-1); assert.equal(h.focus.stage,stage) }
  h.gesture(-1); assert.equal(h.focus.stage,0,'lower bound')
  assert.equal(h.host.classList.contains('sch-ultra-focus-host'),false)
  h.focus.destroy()
}

// Jitter, three fingers, cancellation and capture loss never produce moves or
// leave the controller permanently swallowing clicks.
{
  const h = fixture()
  h.down(1,100); h.down(2,200); h.move(2,215); assert.equal(h.focus.stage,0)
  h.down(3,300); h.move(2,270); assert.equal(h.focus.stage,0,'third finger cancels that gesture')
  h.up(1);h.up(2);h.up(3);h.pause()
  h.down(1,100);h.down(2,200)
  h.board.emit('lostpointercapture',{pointerId:1,target:new Element()})
  h.move(2,270);assert.equal(h.focus.stage,1,'implicit square capture transferring to the board does not cancel a real pinch')
  h.up(1);h.up(2);h.pause()
  h.down(1,100);h.down(2,200)
  h.board.captures.delete(1);h.board.emit('lostpointercapture',{pointerId:1})
  h.move(2,270);assert.equal(h.focus.stage,1,'unexpected board capture loss cancels movement')
  h.pause();assert.equal(h.board.emit('click').prevented,false,'capture loss cannot permanently block clicks')
  h.gesture(1);assert.equal(h.focus.stage,2)
  h.down(1,100);h.down(2,200);h.win.emit('pointercancel',{pointerId:1});h.move(2,270)
  assert.equal(h.focus.stage,2);h.up(2);h.pause()
  h.gesture(1);assert.equal(h.focus.stage,3,'fresh gesture after cancellation')
  h.down(1,100);h.down(2,200);h.win.emit('blur');h.pause();assert.equal(h.board.emit('click').prevented,false)
  h.down(1,100);h.down(2,200);h.media.matches=false;h.media.emit('change')
  assert.equal(h.board.emit('click').prevented,true,'viewport change during a pinch still suppresses its compatibility click')
  h.pause();assert.equal(h.board.emit('click').prevented,false)
  h.focus.destroy()
}

// The same stage state drives accessible board keys, the small restore button,
// viewport changes and cleanup, without storage or game-setting writes.
{
  const h=fixture({mobile:false})
  h.gesture(1);assert.equal(h.focus.stage,0);assert.equal(h.board.getAttribute('tabindex'),null)
  h.media.matches=true;h.media.emit('change')
  h.board.emit('keydown',{key:'+',target:new Element()});assert.equal(h.focus.stage,0,'piece keyboard input is unchanged')
  h.board.emit('keydown',{key:'+',ctrlKey:true});assert.equal(h.focus.stage,0,'browser zoom shortcut is unchanged')
  for(let i=0;i<4;i++)assert.equal(h.board.emit('keydown',{key:'+'}).prevented,true)
  assert.equal(h.focus.stage,4);h.restoreButton.emit('click');assert.equal(h.focus.stage,0);assert.equal(h.board.focused,true)
  h.board.emit('keydown',{key:'='});assert.equal(h.focus.stage,1)
  h.board.emit('keydown',{key:'-'});assert.equal(h.focus.stage,0)
  h.focus.setStage(3);h.board.emit('keydown',{key:'Escape'});assert.equal(h.focus.stage,0)
  h.focus.setStage(4);h.media.matches=false;h.media.emit('change')
  assert.equal(h.focus.stage,0);assert.equal(h.restoreButton.hidden,true);assert.equal(h.root.getAttribute('data-ultra-focus'),null)
  h.media.matches=true;h.media.emit('change');assert.equal(h.focus.stage,0,'returning to mobile starts with all panels visible')
  h.focus.destroy();h.focus.destroy()
  for(const node of [h.board,h.win,h.media,h.restoreButton])assert.equal(node.count,0,'every listener is released')
  assert.equal(h.board.getAttribute('tabindex'),null);assert.equal(h.root.getAttribute('data-ultra-focus'),null)
  assert.equal(h.host.classList.contains('sch-ultra-focus-host'),false)
  assert.equal(h.focus.setStage(4),false)
}

const ui=readFileSync(new URL('../../schaken-ui.js',import.meta.url),'utf8')
assert.match(ui,/const ultraFocus = isUltra \? maakUltraFocus\(/,'ordinary chess and friend games keep their existing sizing')
assert.match(ui,/opruimers\.push\(\(\) => ultraFocus\.destroy\(\)\)/)
assert.match(ui,/if \(ultraFocus\?\.active\) return[\s\S]*?vingers\.set/,'legacy pinch is bypassed only while mobile Ultra focus is active')
assert.match(ui,/data-ultra-focus="4"\] \.sch-board-row \.sch-frame \{ width:100%; padding:2px/)
assert.match(ui,/data-ultra-focus="4"\] \.sch-frame\.sch-has-hints \{ padding-top:31px/,'hint header never covers enlarged squares')
console.log('PASS: Ultra four-stage mobile focus, reverse pinches, no accidental moves, capture transfer/cancel recovery, keyboard/restore, desktop and complete cleanup.')
