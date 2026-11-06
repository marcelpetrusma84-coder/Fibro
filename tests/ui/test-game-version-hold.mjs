import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maakSpelVersieLangDruk } from '../../spelversie-langdruk.js'
import { mountSpelVersie } from '../../spelversies.js?v=22'
import { SPEL_VERSIES } from '../../spelversie-data.js'

class EventTargetFake {
  listeners = new Map()
  addEventListener(type, fn, options) { const list=this.listeners.get(type)||[];list.push({fn,options});this.listeners.set(type,list) }
  removeEventListener(type, fn) { this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item.fn!==fn)) }
  dispatch(type, props={}) {
    const event={type,defaultPrevented:false,immediateStopped:false,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.immediateStopped=true},...props}
    for(const{fn}of this.listeners.get(type)||[]){fn(event);if(event.immediateStopped)break}
    return event
  }
}
class Card extends EventTargetFake {
  ownerDocument
  classes=new Set()
  classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)}
  constructor(doc){super();this.ownerDocument=doc}
}
let now=0,nextTimer=0
const timers=new Map()
const win=new EventTargetFake()
win.setTimeout=(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:now+ms});return id}
win.clearTimeout=id=>timers.delete(id)
const doc=new EventTargetFake();doc.hidden=false;doc.defaultView=win
function advance(ms){now+=ms;while(true){const ready=[...timers].filter(([,entry])=>entry.at<=now).sort((a,b)=>a[1].at-b[1].at)[0];if(!ready)break;timers.delete(ready[0]);ready[1].fn()}}
const card=new Card(doc), historyTarget={closest:selector=>selector==='.spelversie-controller'}
let opened=0, played=0
const controller=maakSpelVersieLangDruk({element:card,onLongPress:()=>opened++,holdMs:3000,win,doc,setTimer:win.setTimeout,clearTimer:win.clearTimeout})
card.addEventListener('click',()=>played++)

card.dispatch('pointerdown',{isPrimary:true,button:0,pointerId:1,clientX:10,clientY:10,target:card})
advance(2999)
assert.equal(opened,0,'a hold shorter than three seconds does not reveal history')
win.dispatch('pointerup',{pointerId:1})
card.dispatch('click',{target:card})
assert.equal(played,1,'a normal tap still opens the game')

card.dispatch('pointerdown',{isPrimary:true,button:0,pointerId:2,clientX:10,clientY:10,target:card})
advance(3000)
assert.equal(opened,1,'three seconds reveals the history')
assert.equal(card.classes.has('game-version-holding'),false,'the hold affordance clears after activation')
win.dispatch('pointerup',{pointerId:2})
const swallowed=card.dispatch('click',{target:card})
assert.equal(swallowed.defaultPrevented,true)
assert.equal(played,1,'the release click cannot also start the game')

card.dispatch('pointerdown',{isPrimary:true,button:0,pointerId:3,clientX:0,clientY:0,target:card})
win.dispatch('pointermove',{pointerId:3,clientX:20,clientY:0})
advance(4000)
assert.equal(opened,1,'moving the finger cancels rather than opening history')

card.dispatch('pointerdown',{isPrimary:true,button:0,pointerId:5,clientX:0,clientY:0,target:card})
card.dispatch('pointerdown',{isPrimary:false,button:0,pointerId:6,clientX:0,clientY:0,target:card})
advance(4000)
assert.equal(opened,1,'a second touch cancels the pending hold')

card.dispatch('pointerdown',{isPrimary:true,button:0,pointerId:4,clientX:0,clientY:0,target:historyTarget})
advance(4000)
assert.equal(opened,1,'interacting with the version arrows never re-arms the card')

card.dispatch('keydown',{code:'Space',repeat:false,target:card})
advance(3000)
assert.equal(opened,2,'keyboard users can hold Space to reveal history')
win.dispatch('keyup',{code:'Space'})
card.dispatch('click',{target:card})
assert.equal(played,1,'the keyboard release click is consumed after revealing history')

controller.destroy()
assert.equal(card.classes.has('game-version-holding'),false)
assert.equal([...card.listeners.values()].flat().length,1,'destroy removes only its listeners')

const home=readFileSync(new URL('../../index.html',import.meta.url),'utf8')
const english=readFileSync(new URL('../../taal-en.js',import.meta.url),'utf8')
const games=home.match(/const ICONEN = \{([^}]+)\}/)?.[1]||''
const gameIds=[...games.matchAll(/([a-z][a-z0-9]*):/g)].map(match=>match[1])
assert.ok(gameIds.length>0)
for(const game of gameIds)assert.ok(SPEL_VERSIES[game],`${game} has a version history`)
assert.match(home,/maakSpelVersieLangDruk\(\{ element:blok, onLongPress:toonHistorie \}\)/)
assert.match(home,/import\('\.\/spelversies\.js\?v=22'\)/,'the full history loads only after the hold gesture')
assert.equal(typeof mountSpelVersie,'function','Home can import the version-history renderer from the shared module')
assert.match(home,/versieVlak\.hidden = true/,'version details start hidden on every game card')
assert.match(home,/Druk op Enter om te spelen\. Houd de spelkaart 3 seconden vast voor de versiegeschiedenis/)
assert.match(english,/Press Enter to play\. Hold the game card for 3 seconds to view version history/)
console.log('Home game version hold tests passed')
