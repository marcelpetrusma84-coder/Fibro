import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Schaak from '../../schaak.js'
import { schaakFen, uciNaarZet } from '../../schaak-ultra-engine.js'
import { maakUltraEvaluatieHistorie, schaakNotatie } from '../../schaak-ultra-historie.js'

// Run production markup and controller with the real SAN/evaluation model.
const source = readFileSync(new URL('../../schaken-ui.js', import.meta.url), 'utf8')
const settingsReader = source.match(/function readSettings\(\) \{[\s\S]*?\n\}/)[0]
const render = source.slice(source.indexOf('export function start('), source.indexOf('  const bordEl =')).replace('export function start(', 'function render(') + '\nreturn { markup:inhoud.innerHTML, isUltra, instellingen, mijnKleur }; }'
const startController = source.indexOf('  // Ultra evaluation is a solo-only aid.')
const controller = source.slice(startController, source.indexOf("  if (spelKanaal.isSolo) spelKanaal.send({ type:'broadcast', event:'bot-instellingen'", startController))
const t = (key, values) => key.replace(/\{(\w+)\}/g, (match, name) => values?.[name] ?? match)
function node() {
  const classes = new Set(), attributes = new Map(), properties = new Map(), handlers = new Map()
  return {
    hidden:false, checked:false, textContent:'', innerHTML:'', dataset:{}, isConnected:true,
    scrollHeight:100, scrollTop:0, clientHeight:100,
    classList:{ toggle(name, on) { on ? classes.add(name) : classes.delete(name) }, contains:name => classes.has(name) },
    style:{ setProperty:(key, value) => properties.set(key, value), getPropertyValue:key => properties.get(key) },
    setAttribute:(key, value) => attributes.set(key, String(value)), getAttribute:key => attributes.get(key),
    addEventListener:(event, handler) => handlers.set(event, handler), change() { handlers.get('change')?.() }, click() { handlers.get('click')?.() }
  }
}
function fixture({ isSolo=true, niveau='ultra', saved='{}', benIkSpeler1=true }={}) {
  const root=node(), listeners=new Map(), sent=[], cleanups=[], audio=[]
  let storage=saved, ply=0, created=0, cancelled=0, destroyed=0
  const channel = { isSolo, niveau,
    on(type, {event}, handler) { assert.equal(type, 'broadcast'); listeners.set(event, handler) },
    send(message) { assert.ok(listeners.has('ultra-evaluatie')); sent.push(JSON.parse(JSON.stringify(message))) }
  }
  const context = vm.createContext({ localStorage:{getItem:()=>storage}, document:{getElementById:id=>id==='spelInhoud'?root:node()}, matchMedia:()=>({matches:true}), maakSchaakTaal:()=>({t}) })
  vm.runInContext(`const SETTINGS_KEY='test'; ${settingsReader}; ${render}; globalThis.render=render`, context)
  const result = context.render({Schaak, spelKanaal:channel, benIkSpeler1})
  const nodes = new Map([...result.markup.matchAll(/id="([^"]+)"/g)].map(match=>['#'+match[1],node()]))
  const select = selector=>nodes.get(selector)??null
  Object.assign(context, {isUltra:result.isUltra, mijnKleur:result.mijnKleur, instellingen:result.instellingen,
    menu:{querySelector:select}, inhoud:{querySelector:select}, spelEl:root, spelKanaal:channel, opruimers:cleanups,
    staat:Schaak.nieuweSpelStaat(), Schaak, schaakFen, maakUltraEvaluatieHistorie, schaakNotatie, esc:String,
    taal:{language:'nl'}, t, bewaarInstellingen(){storage=JSON.stringify(result.instellingen)},
    Bordgeluid:{maakSchaakAnalyseGeluid(){created++; return {speel:delta=>audio.push(delta), annuleer:()=>cancelled++, destroy:()=>destroyed++}}}
  })
  vm.runInContext(controller+'\nglobalThis.refresh=toonUltraEvaluatie; globalThis.addMove=voegUltraZetToe; globalThis.resetHistory=resetUltraHistorie', context)
  return {...result, select, sent, cleanups, context, audio, refresh:context.refresh, read:()=>JSON.parse(storage),
    get state(){return context.staat}, get counts(){return {created,cancelled,destroyed}},
    emit:(event,payload)=>listeners.get(event)?.({payload}),
    evaluation(cp,{final=true,mate=null,fen=schaakFen(context.staat),atPly=ply}={}) { listeners.get('ultra-evaluatie')?.({payload:{cp,mate,final,fen,ply:atPly}}) },
    move(uci) { const move=uciNaarZet(Schaak,context.staat,uci); assert.ok(move); context.addMove(move.zet,move.promotieStuk); Schaak.voerZetUit(context.staat,move.zet,move.promotieStuk); ply++; context.refresh() },
    reset() { context.staat=Schaak.nieuweSpelStaat(); ply=0; context.resetHistory(); context.refresh() }
  }
}
for (const saved of ['{}','null','{broken','{"showUltraEvaluation":"true","ultraEvaluationSound":1,"ultraThinking":"2"}']) {
  const ui=fixture({saved})
  assert.equal(ui.instellingen.showUltraEvaluation,false)
  assert.equal(ui.instellingen.ultraEvaluationSound,false,'analysis sound strictly defaults OFF')
  assert.equal(ui.instellingen.ultraGradedCaptureSounds,true,'Ultra graded capture default is independently ON')
  assert.equal(ui.instellingen.gradedCaptureSounds,false)
  assert.equal(ui.instellingen.ultraThinking,5)
  assert.equal(ui.instellingen.thinking,7)
  assert.equal(ui.select('#sch-evaluation').hidden,true)
  assert.equal(ui.select('#sch-history').hidden,false,'history is visible with the meter OFF')
  assert.equal(ui.sent[0].payload.enabled,false)
}
for (const mode of [{isSolo:true,niveau:'hard'},{isSolo:false,niveau:'ultra'},{isSolo:'true',niveau:'ultra'}]) {
  const ui=fixture({...mode,saved:'{"showUltraEvaluation":true,"ultraEvaluationSound":true}'})
  assert.equal(ui.isUltra,false)
  for (const id of ['#sch-ultra-evaluation-enabled','#sch-ultra-evaluation-sound','#sch-evaluation','#sch-history']) assert.equal(ui.select(id),null)
  assert.equal(ui.sent.length,0,'ordinary and friend games never opt into analysis')
  assert.equal(ui.counts.created,0)
}
const ui=fixture({saved:'{"showUltraEvaluation":true,"board":"glass","custom":"keep"}'})
const toggle=ui.select('#sch-ultra-evaluation-enabled'), sound=ui.select('#sch-ultra-evaluation-sound')
const meter=ui.select('#sch-evaluation'), score=ui.select('#sch-evaluation-score')
const delta=()=>ui.select('#sch-evaluation-white-delta').textContent
assert.equal(score.textContent,'—'); assert.equal(delta(),'')
assert.equal(ui.select('#sch-evaluation-ply').textContent,'Start')
assert.match(ui.select('#sch-ultra-status').textContent,/Lichess \+ Stockfish 19.*Laden/)
ui.emit('ultra-status',{phase:'ready',source:'lichess'})
assert.equal(ui.select('#sch-ultra-status').textContent,'Ultra · Lichess')
ui.evaluation(150,{final:false}); assert.equal(score.textContent,'↑+1,5')
ui.context.taal.language='en'; ui.refresh(); assert.equal(score.textContent,'↑+1.5')
ui.context.taal.language='nl'; ui.evaluation(100)
assert.equal(delta(),'','the initial final has no fabricated zero baseline')
assert.deepEqual(ui.audio,[])
const future=Schaak.nieuweSpelStaat()
Schaak.voerZetUit(future,uciNaarZet(Schaak,future,'e2e4').zet)
ui.evaluation(120,{final:false,atPly:1,fen:schaakFen(future)})
assert.equal(score.textContent,'↑+1,0','future analysis leaves the current position intact')
ui.move('e2e4'); assert.equal(score.textContent,'↑+1,2')
assert.equal(ui.select('#sch-evaluation-ply').textContent,'Zet #1')
assert.equal(ui.select('#sch-history-moves').innerHTML,'<tr><td>1.</td><td>e4</td><td></td></tr>')
assert.equal(meter.dataset.magnitude,'small'); assert.equal(meter.dataset.direction,'gain')
assert.equal(delta(),'+0,2'); assert.equal(ui.select('#sch-evaluation-black-delta').textContent,'−0,2')
assert.ok(parseFloat(meter.style.getPropertyValue('--sch-delta-height'))>0)
ui.evaluation(180,{final:false}); assert.equal(delta(),'+0,8','streaming compares against the previous FINAL ply')
assert.equal(meter.dataset.magnitude,'medium')
ui.evaluation(300); assert.equal(delta(),'+2,0'); assert.equal(meter.dataset.magnitude,'large')
assert.match(meter.getAttribute('aria-label'),/Wit \+2,0; zwart −2,0/)
assert.deepEqual(ui.audio,[],'meter ON keeps sound OFF')
ui.evaluation(NaN); assert.equal(score.textContent,'↑+3,0')
ui.move('e7e5'); ui.evaluation(300)
assert.equal(ui.select('#sch-evaluation-ply').textContent,'Zet #2')
assert.equal(ui.select('#sch-history-moves').innerHTML,'<tr><td>1.</td><td>e4</td><td>e5</td></tr>')
assert.equal(meter.dataset.direction,'equal'); assert.equal(meter.style.getPropertyValue('--sch-delta-height'),'0%')
sound.checked=true; sound.change(); toggle.checked=false; toggle.change()
assert.equal(meter.hidden,true); assert.equal(ui.select('#sch-history').hidden,false)
assert.equal(ui.sent.at(-1).payload.enabled,true,'sound alone keeps analysis running')
assert.equal(ui.read().ultraEvaluationSound,true); assert.equal(ui.read().showUltraEvaluation,false)
assert.equal(ui.read().board,'glass'); assert.equal(ui.read().custom,'keep')
ui.move('g1f3'); ui.evaluation(250,{final:false}); ui.evaluation(200,{final:false})
assert.deepEqual(ui.audio,[],'streaming does not sound')
ui.evaluation(200); assert.deepEqual(ui.audio,[-100])
ui.evaluation(200); ui.evaluation(199,{final:false}); ui.refresh()
assert.deepEqual(ui.audio,[-100],'replays, late info and redraws do not repeat audio')
ui.move('b8c6'); ui.evaluation(200); assert.deepEqual(ui.audio,[-100,0],'neutral final uses the neutral voice once')
sound.checked=false; sound.change(); assert.equal(ui.sent.at(-1).payload.enabled,false)
assert.ok(ui.counts.cancelled>0)
assert.match(ui.select('#sch-history-moves').innerHTML,/<td>2\.<\/td><td>Nf3<\/td><td>Nc6<\/td>/)
const black=fixture({benIkSpeler1:false,saved:'{"showUltraEvaluation":true,"ultraEvaluationSound":true}'})
black.evaluation(0); black.move('e2e4'); black.evaluation(null,{mate:3})
assert.equal(black.select('#sch-evaluation-score').textContent,'↑#3')
assert.equal(black.select('#sch-evaluation-white').style.getPropertyValue('--sch-white-share'),'98%')
assert.deepEqual(black.audio,[-10000],'black hears white improvement as loss')
black.move('e7e5'); black.evaluation(null,{mate:0})
assert.equal(black.select('#sch-evaluation-score').textContent,'↓#0')
assert.equal(black.select('#sch-evaluation-white').style.getPropertyValue('--sch-white-share'),'2%')
assert.deepEqual(black.audio,[-10000,20000])
black.move('g1f3'); black.evaluation(null,{mate:0}); assert.equal(black.select('#sch-evaluation-score').textContent,'↑#0')
black.reset()
assert.equal(black.select('#sch-history-moves').innerHTML,''); assert.equal(black.select('#sch-history-empty').hidden,false)
assert.equal(black.select('#sch-evaluation-ply').textContent,'Start'); assert.equal(black.select('#sch-evaluation-score').textContent,'—')
assert.equal(black.select('#sch-evaluation-white-delta').textContent,''); assert.ok(black.counts.cancelled>0)
const afterReset=black.audio.length
black.move('e2e4'); black.evaluation(50); assert.equal(black.audio.length,afterReset,'missing prior final after reset makes no delta sound')
ui.emit('ultra-status',{phase:'error',source:'stockfish'})
assert.match(ui.select('#sch-ultra-status').textContent,/Stockfish 19.*Niet beschikbaar/)
const retry=ui.select('#sch-ultra-retry'); assert.equal(retry.hidden,false); retry.click()
assert.deepEqual(ui.sent.at(-1),{type:'broadcast',event:'ultra-opnieuw-proberen',payload:{}})
assert.equal(retry.hidden,true)
const retryCount=ui.sent.length; retry.click(); assert.equal(ui.sent.length,retryCount)
ui.cleanups.forEach(cleanup=>cleanup())
assert.equal(ui.sent.at(-1).payload.enabled,false); assert.equal(ui.counts.destroyed,1)
const afterClose=ui.audio.length; ui.evaluation(900); assert.equal(ui.audio.length,afterClose)
assert.match(source,/voegUltraZetToe\(zet, promotieStuk\)\s+Schaak\.voerZetUit\(staat, zet/)
assert.match(source,/voegUltraZetToe\(geldig, promotie\)\s+Schaak\.voerZetUit\(staat, geldig/)
assert.equal((source.match(/staat = Schaak\.nieuweSpelStaat\(\)\s+resetUltraHistorie\(\)/g)||[]).length,2)
assert.doesNotMatch(controller,/pushState|replaceState|popstate/)
assert.match(ui.markup,/contain:size/)
console.log('PASS: Ultra defaults, independent settings, SAN history, previous-final deltas, pending FEN/ply alignment, neutral/mate audio, reset and teardown.')
