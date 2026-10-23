import assert from 'node:assert/strict'
import * as Schaak from '../../schaak.js'
import { schaakBot, schaakKies } from '../../solo-bord.js'
let now = 0, id = 0
const timers = new Map()
globalThis.performance = { now: () => now }
globalThis.setTimeout = (fn, ms) => { timers.set(++id, { fn, at:now+ms }); return id }
globalThis.clearTimeout = id => timers.delete(id)
function advance(ms) {
  const end = now+ms
  while (true) {
    const next = [...timers].sort((a,b)=>a[1].at-b[1].at)[0]
    if (!next || next[1].at>end) break
    now=next[1].at; timers.delete(next[0]); next[1].fn()
  }
  now=end
}
let latest
globalThis.Worker = class {
  constructor() { latest=this }
  postMessage(data) { this.data=data }
  terminate() { this.terminated=true }
}
const delays=[]
for(let i=0;i<25;i++) {
  const results=[]; const start=now
  const bot=schaakBot({stuur:(event,p)=>results.push({at:now,event,p}),niveau:'normaal',isDicht:()=>false,motor:Schaak})
  const state=Schaak.nieuweSpelStaat(), move=Schaak.legaleZetten(state,6,4).find(z=>z.naar[0]===4)
  bot.ontvang('zet',{zet:move}); Schaak.voerZetUit(state,move)
  const reply=schaakKies(Schaak,state,'makkelijk')
  if(i!==0) latest.onmessage({data:reply}) // first iteration simulates a stuck worker
  advance(7000)
  assert.equal(results.length,1)
  const delay=results[0].at-start; assert(delay>=1000 && delay<=7000); delays.push(Math.round(delay))
  assert(Schaak.alleLegaleZetten(state,'z').some(z=>JSON.stringify(z)===JSON.stringify(results[0].p.zet)))
  bot.stop(); assert.equal(timers.size,0)
}
for(const action of ['opnieuw','stop']) {
  let sent=0;const bot=schaakBot({stuur:()=>sent++,niveau:'normaal',isDicht:()=>false,motor:Schaak})
  bot.ontvang('zet',{zet:Schaak.legaleZetten(Schaak.nieuweSpelStaat(),6,4)[0]})
  if(action==='stop') bot.stop(); else bot.ontvang('opnieuw',{})
  assert(latest.terminated); advance(8000); assert.equal(sent,0)
}
assert(new Set(delays).size>15)
console.log('PASS: 25 legal replies; varied 1.4–7s timing; 7s worker deadline; restart/stop cancellation.',delays)
