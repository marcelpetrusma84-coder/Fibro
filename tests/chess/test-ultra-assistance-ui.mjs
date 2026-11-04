import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Schaak from '../../schaak.js'
import { registreerSlag } from '../../schaak-stukken.js'
import { schaakFen, uciNaarZet } from '../../schaak-ultra-engine.js'
import { maakUltraEvaluatieHistorie, schaakNotatie } from '../../schaak-ultra-historie.js'

const source=readFileSync(new URL('../../schaken-ui.js',import.meta.url),'utf8')
const reader=source.match(/function readSettings\(\) \{[\s\S]*?\n\}/)[0]
const render=source.slice(source.indexOf('export function start('),source.indexOf('  const bordEl =')).replace('export function start(','function render(')+'\nreturn {markup:inhoud.innerHTML,isUltra,instellingen,mijnKleur}; }'
const controllerStart=source.indexOf('  // Ultra evaluation is a solo-only aid.')
const controller=source.slice(controllerStart,source.indexOf("  if (spelKanaal.isSolo) spelKanaal.send({ type:'broadcast', event:'bot-instellingen'",controllerStart))
const menuController=source.match(/  function toonMenu\(aan\) \{[\s\S]*?\n  \}/)[0]
const board=source.match(/  function tekenBord\(\) \{[\s\S]*?\n  \}/)[0]
const animation=source.match(/  async function animeerZet\(zet\) \{[\s\S]*?\n  \}/)[0]
const received=source.slice(source.indexOf("  spelKanaal.on('broadcast', { event: 'zet' }"),source.indexOf("  spelKanaal.on('broadcast', { event: 'opnieuw' }"))
const plain=value=>JSON.parse(JSON.stringify(value))
const t=(key,values)=>key.replace(/\{(\w+)\}/g,(match,name)=>values?.[name]??match)
function node() {
  let classes=new Set(),html=''
  const attributes=new Map(),properties=new Map(),handlers=new Map()
  return {
    hidden:false,disabled:false,checked:false,textContent:'',dataset:{},isConnected:true,children:[],
    scrollHeight:100,scrollTop:0,clientHeight:100,
    get innerHTML(){return html},set innerHTML(value){html=value;this.children=[]},
    get className(){return [...classes].join(' ')},set className(value){classes=new Set(value.split(/\s+/))},
    classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),toggle(name,on){on?classes.add(name):classes.delete(name)}},
    style:{setProperty:(key,value)=>properties.set(key,value),getPropertyValue:key=>properties.get(key)},
    setAttribute:(key,value)=>attributes.set(key,String(value)),getAttribute:key=>attributes.get(key),
    addEventListener:(name,handler)=>handlers.set(name,handler),click(){handlers.get('click')?.()},change(){handlers.get('change')?.()},
    append(child){this.children.push(child)},appendChild(child){this.children.push(child)},
    getBoundingClientRect(){return {x:Number(this.dataset.k)*40,y:Number(this.dataset.r)*40}},
    querySelector(selector){const coords=selector.match(/data-r="(\d+)".*data-k="(\d+)"/);return coords?this.children.find(child=>String(child.dataset.r)===coords[1]&&String(child.dataset.k)===coords[2]):this.children.find(child=>child.classList.contains(selector.slice(1)))},
    querySelectorAll(selector){return this.children.filter(child=>selector.startsWith('.')?child.classList.contains(selector.slice(1)):child.dataset.r!==undefined)}
  }
}
function fixture({saved='{}',isSolo=true,niveau='ultra',state=Schaak.nieuweSpelStaat()}={}) {
  const root=node(),listeners=new Map(),sent=[],cleanups=[],sounds=[]
  let storage=saved,clearedOverlays=0,cancelledAnimations=0,cancelledAudio=0,swipe=null
  const channel={isSolo,niveau,on(_type,{event},handler){listeners.set(event,handler)},send(message){sent.push(plain(message))}}
  const document={getElementById:id=>id==='spelInhoud'?root:node(),createElement:()=>node()}
  const context=vm.createContext({document,localStorage:{getItem:()=>storage},matchMedia:()=>({matches:true}),maakSchaakTaal:()=>({t}),console,Promise})
  vm.runInContext(`const SETTINGS_KEY='test'; ${reader}; ${render}; globalThis.render=render`,context)
  const result=context.render({Schaak,spelKanaal:channel,benIkSpeler1:true})
  const nodes=new Map([...result.markup.matchAll(/id="([^"]+)"/g)].map(match=>['#'+match[1],node()]))
  const select=id=>nodes.get(id)??null
  const boardEl=select('#sch-bord')
  boardEl.getAnimations=()=>[{cancel(){cancelledAnimations++}}]
  Object.assign(context,{isUltra:result.isUltra,isVriendPartij:!isSolo,mijnKleur:'w',vriendKleur:'z',instellingen:result.instellingen,
    menu:{hidden:true,querySelector:select,querySelectorAll:()=>[]},menuBackdrop:node(),zoomBtn:node(),settingsBtn:node(),inhoud:{querySelector:select},spelEl:root,spelKanaal:channel,opruimers:cleanups,
    staat:state,Schaak,schaakFen,maakUltraEvaluatieHistorie,schaakNotatie,esc:String,t,taal:{language:'nl'},
    bordEl:boardEl,paardRoutesUI:null,veroverd:{w:[],z:[]},laatsteZet:null,routeStuk:null,geselecteerd:null,mogelijkeZetten:[],gameOver:false,
    bezig:false,promotieOpen:false,generatie:0,pendingNoobMove:null,statusBericht:{key:'Jij bent aan zet'},statusEl:node(),promotieEl:node(),noobDialog:node(),opnieuwBtn:node(),wachtrij:Promise.resolve(),
    stukSVG:()=>'',READABLE_NAMES:{P:'pion',N:'paard',B:'loper',R:'toren',Q:'dame',K:'koning'},kleurBijStuk:()=>'',tekenVeroverd(){},
    rijVolgorde:()=>[0,1,2,3,4,5,6,7],kolVolgorde:()=>[0,1,2,3,4,5,6,7],
    bewaarInstellingen(){storage=JSON.stringify(result.instellingen)},wisCheckmateOverlay(){clearedOverlays++},
    toonStatus(key){context.statusBericht={key};context.statusEl.textContent=t(key)},
    Bordgeluid:{maakSchaakAnalyseGeluid:()=>({speel:value=>sounds.push(value),annuleer(){cancelledAudio++},destroy(){}}),kiesSchaakGeluid(){},schaak(){sounds.push('move')}},
    animeerZet:async()=>true,schaakSlagEffect:()=>null,registreerSlag,
    naBeurtControle(){context.tekenBord()},
    maakUltraSwipe(options){
      assert.equal(options.element,select('#sch-ultra-swipe'),'the controller owns the dedicated strip below the board')
      swipe={options,destroyed:false,refreshes:0,
        refresh(){this.refreshes++;this.enabled=options.canUndo();options.element.setAttribute('aria-disabled',String(!this.enabled));options.onChange({active:true,enabled:this.enabled,state:this.enabled?'idle':'disabled'})},
        trigger(){return !this.destroyed&&options.canUndo()?options.onUndo():false},
        ready(){options.onChange({active:true,enabled:options.canUndo(),state:'ready'})},
        destroy(){this.destroyed=true}}
      swipe.refresh()
      return swipe
    }
  })
  vm.runInContext(board+'\n'+controller+'\n'+menuController+'\n'+received+`\nglobalThis.refresh=tekenBord; globalThis.beforeMove=bewaarUltraMoment; globalThis.addMove=voegUltraZetToe; globalThis.clearHint=wisUltraHint; globalThis.reset=resetUltraHistorie; globalThis.showMenu=toonMenu;
    globalThis.view=()=>({ply:ultraZetten.length,generation:ultraGeneration,history:[...ultraZetten],snapshots:ultraBordMomenten.size,pending:!!ultraTakebackPending,hint:ultraHint,hintPending:!!ultraHintPending,evaluation:ultraHistorie?.getSnapshot()});`,context)
  context.refresh()
  return {...result,context,select,sent,sounds,cleanups,refresh:context.refresh,view:()=>plain(context.view()),read:()=>JSON.parse(storage),
    get state(){return context.staat},get captures(){return plain(context.veroverd)},get counters(){return {clearedOverlays,cancelledAnimations,cancelledAudio}},get swipe(){return swipe},
    emit:(event,payload)=>listeners.get(event)?.({payload}),
    evaluate(cp){const view=context.view();listeners.get('ultra-evaluatie')?.({payload:{ply:view.ply,generation:view.generation,fen:schaakFen(context.staat),cp,mate:null,final:true}})},
    move(uci){const move=uciNaarZet(Schaak,context.staat,uci);assert.ok(move,'legal fixture move '+uci);context.clearHint();context.beforeMove();registreerSlag(context.staat,move.zet,context.veroverd);context.addMove(move.zet,move.promotieStuk);Schaak.voerZetUit(context.staat,move.zet,move.promotieStuk);context.laatsteZet=move.zet;context.routeStuk=move.zet.naar.slice();context.geselecteerd=null;context.mogelijkeZetten=[];context.refresh()},
    async settle(){await context.wachtrij},
    toggle(id,on){const input=select(id);input.checked=on;input.change()},
    restart(){context.staat=Schaak.nieuweSpelStaat();context.reset();context.refresh()}
  }
}
for(const saved of ['{}','null','{broken','{"ultraTakeback":"true","ultraHints":1}']) {
  const ui=fixture({saved})
  assert.equal(ui.instellingen.ultraTakeback,false);assert.equal(ui.instellingen.ultraHints,false)
  assert.equal(ui.select('#sch-ultra-takeback').hidden,true);assert.equal(ui.select('#sch-ultra-hint').hidden,true)
  assert.equal(ui.select('#sch-ultra-swipe').hidden,true);assert.equal(ui.swipe.options.canUndo(),false,'the swipe respects the strict default-OFF takeback preference')
  assert.deepEqual(ui.sent.find(message=>message.event==='ultra-assistentie-instellingen').payload,{takeback:false,hints:false})
  assert.equal(ui.instellingen.ultraGradedCaptureSounds,true);assert.equal(ui.instellingen.ultraThinking,5)
}
for(const mode of [{isSolo:false,niveau:'ultra'},{isSolo:true,niveau:'hard'}]) {
  const ui=fixture({...mode,saved:'{"ultraTakeback":true,"ultraHints":true}'})
  for(const id of ['#sch-ultra-takeback','#sch-ultra-hint','#sch-ultra-takeback-enabled','#sch-ultra-hints-enabled','#sch-ultra-swipe'])assert.equal(ui.select(id),null)
  assert.equal(ui.swipe,null,'friend and ordinary-level games never mount the undo gesture')
  assert.equal(ui.sent.length,0)
}
const ui=fixture({saved:'{"ultraTakeback":true,"ultraHints":true,"showUltraEvaluation":true,"ultraEvaluationSound":true,"custom":"keep"}'})
const undo=ui.select('#sch-ultra-takeback'),hint=ui.select('#sch-ultra-hint')
assert.equal(undo.disabled,true);assert.equal(hint.hidden,false)
assert.equal((ui.markup.match(/id="sch-bord"[\s\S]*?<\/div><button class="sch-hint-button"/)||[]).length,1,'hint button is a sibling outside the 64-square grid')
hint.click();assert.equal(hint.disabled,true);assert.equal(hint.getAttribute('aria-busy'),'true')
assert.equal(ui.select('#sch-ultra-assistance-status').textContent,'Een tip zoeken…')
assert.deepEqual(ui.sent.at(-1),{type:'broadcast',event:'ultra-hint',payload:{ply:0,generation:0}})
ui.emit('ultra-hint-result',{ok:true,ply:0,generation:0,fen:schaakFen(ui.state),from:[6,4],source:'lichess'})
let marked=ui.select('#sch-bord').querySelectorAll('.sch-hint-piece')
assert.equal(marked.length,1);assert.equal(marked[0].dataset.r,6);assert.equal(marked[0].dataset.k,4)
assert.equal(ui.context.geselecteerd,null);assert.deepEqual(plain(ui.context.mogelijkeZetten),[],'hint gives no destination markers')
ui.toggle('#sch-ultra-hints-enabled',false);assert.equal(hint.hidden,true);assert.equal(ui.view().hint,null)
assert.equal(ui.read().ultraHints,false);assert.equal(ui.read().custom,'keep')
ui.toggle('#sch-ultra-hints-enabled',true);hint.click()
ui.emit('ultra-hint-result',{ok:true,ply:0,generation:0,fen:schaakFen(ui.state),from:[1,4]})
assert.equal(ui.view().hint,null,'opponent origins are rejected');assert.equal(ui.view().hintPending,false)
hint.click();ui.emit('ultra-hint-result',{ok:true,ply:0,generation:0,fen:schaakFen(ui.state).replace(' w ',' b '),from:[6,4]})
assert.equal(ui.view().hintPending,false,'a stale position clears its pending hint')
ui.evaluate(0)
const initialFen=schaakFen(ui.state)
ui.move('e2e4');assert.equal(undo.disabled,false);assert.equal(hint.hidden,true);assert.equal(ui.view().hint,null)
ui.evaluate(50);assert.deepEqual(ui.sounds,[50])
ui.context.promotieOpen=true;ui.refresh();assert.equal(undo.disabled,true)
ui.context.promotieOpen=false;ui.context.bezig=true;ui.refresh();assert.equal(undo.disabled,true)
ui.context.bezig=false;ui.refresh();undo.click();undo.click()
assert.equal(ui.sent.filter(message=>message.event==='ultra-takeback').length,1)
assert.deepEqual(ui.sent.at(-1).payload,{ply:1,generation:0})
ui.emit('ultra-takeback-result',{ok:true,ply:0,generation:1,fen:initialFen.replace(' w ',' b ')})
assert.equal(ui.view().pending,true,'mismatched acknowledgement cannot mutate the board')
ui.emit('ultra-takeback-result',{ok:true,ply:0,generation:1,fen:initialFen})
assert.equal(schaakFen(ui.state),initialFen);assert.equal(ui.view().ply,0);assert.equal(ui.view().generation,1)
assert.deepEqual(ui.view().history,[]);assert.equal(ui.view().snapshots,0);assert.equal(ui.view().evaluation,null)
assert.equal(ui.select('#sch-evaluation-score').textContent,'—');assert.equal(ui.view().pending,false)
assert.equal(ui.context.generatie,1);assert.equal(ui.context.promotieOpen,false);assert.equal(ui.context.noobDialog.hidden,true)
assert.deepEqual(ui.sounds,[50],'undo does not replay historical move audio')
assert.ok(ui.counters.clearedOverlays>0&&ui.counters.cancelledAnimations>0&&ui.counters.cancelledAudio>0)
// Old black replies and evaluations cannot repopulate an undone game.
const oldReply=uciNaarZet(Schaak,(()=>{const state=Schaak.nieuweSpelStaat();Schaak.voerZetUit(state,uciNaarZet(Schaak,state,'e2e4').zet);return state})(),'e7e5')
ui.emit('zet',{zet:oldReply.zet,ultraPly:2,ultraGeneration:0});await ui.settle()
assert.equal(ui.view().ply,0)
ui.emit('ultra-evaluatie',{ply:0,generation:0,fen:initialFen,cp:900,mate:null,final:true})
assert.equal(ui.select('#sch-evaluation-score').textContent,'—')
hint.click();ui.emit('ultra-hint-result',{ok:true,ply:0,generation:0,fen:initialFen,from:[6,4]})
assert.equal(ui.view().hint,null,'old generation cannot answer a new hint request')
ui.emit('ultra-hint-result',{ok:true,ply:0,generation:1,fen:initialFen,from:[6,4]});assert.deepEqual(ui.view().hint,[6,4])
ui.move('e2e4');ui.move('d7d5')
const beforeCapture=plain(ui.state)
ui.move('e4d5');ui.move('d8d5');assert.deepEqual(ui.captures,{w:['zP'],z:['wP']})
undo.click();ui.emit('ultra-takeback-result',{ok:true,ply:2,generation:2,fen:schaakFen(beforeCapture)})
assert.deepEqual(plain(ui.state),beforeCapture,'undo restores the full board before the last own move and its reply')
assert.deepEqual(ui.captures,{w:[],z:[]});assert.deepEqual(ui.view().history,['e4','d5'])
assert.deepEqual(plain(ui.context.laatsteZet),uciNaarZet(Schaak,(()=>{const state=Schaak.nieuweSpelStaat();Schaak.voerZetUit(state,uciNaarZet(Schaak,state,'e2e4').zet);return state})(),'d7d5').zet)
ui.toggle('#sch-ultra-takeback-enabled',false);assert.equal(undo.hidden,true);assert.equal(ui.read().ultraTakeback,false)
ui.toggle('#sch-ultra-takeback-enabled',true);undo.click()
ui.emit('ultra-takeback-result',{ok:false,ply:2,generation:2,fen:schaakFen(ui.state)})
assert.equal(ui.view().pending,false);assert.equal(schaakFen(ui.state),schaakFen(beforeCapture))
ui.restart();assert.equal(ui.view().generation,3);assert.equal(ui.view().snapshots,0);assert.equal(ui.view().hint,null)
// Castling and promotions restore rights and pieces, not just the visible squares.
const castle=Schaak.nieuweSpelStaat();castle.bord=Array.from({length:8},()=>Array(8).fill(null));castle.bord[7][4]='wK';castle.bord[7][7]='wR';castle.bord[0][4]='zK'
const castling=fixture({state:castle,saved:'{"ultraTakeback":true}'})
const castleBefore=plain(castling.state);castling.move('e1g1');castling.select('#sch-ultra-takeback').click()
castling.emit('ultra-takeback-result',{ok:true,ply:0,generation:1,fen:schaakFen(castleBefore)})
assert.deepEqual(plain(castling.state),castleBefore)
const promotion=Schaak.nieuweSpelStaat();promotion.bord=Array.from({length:8},()=>Array(8).fill(null));promotion.bord[7][4]='wK';promotion.bord[0][7]='zK';promotion.bord[1][0]='wP';promotion.rokade={wK:false,wQ:false,zK:false,zQ:false}
const promoting=fixture({state:promotion,saved:'{"ultraTakeback":true}'})
const promotionBefore=plain(promoting.state);promoting.move('a7a8q');assert.equal(promoting.state.bord[0][0],'wQ')
promoting.context.gameOver=true;promoting.context.promotieEl.style.display='flex';promoting.context.pendingNoobMove={zet:{}};promoting.context.noobDialog.hidden=false
promoting.select('#sch-ultra-takeback').click();promoting.emit('ultra-takeback-result',{ok:true,ply:0,generation:1,fen:schaakFen(promotionBefore)})
assert.deepEqual(plain(promoting.state),promotionBefore);assert.equal(promoting.context.gameOver,false);assert.equal(promoting.context.promotieEl.style.display,'none');assert.equal(promoting.context.pendingNoobMove,null)
// Exercise the real animation and received-move handler while an undo races a reply.
const racing=fixture({saved:'{"ultraTakeback":true}'})
const racingInitial=schaakFen(racing.state)
racing.move('e2e4');racing.select('#sch-ultra-takeback').click()
const reply=uciNaarZet(Schaak,racing.state,'e7e5')
let rejectMotion,cancelledMotion=0
const finished=new Promise((_resolve,reject)=>{rejectMotion=reject})
const motion={finished,cancel(){cancelledMotion++;const error=new Error('cancelled');error.name='AbortError';rejectMotion(error)}}
const movingPiece=racing.select('#sch-bord').querySelector('[data-r="1"][data-k="4"]').querySelector('.sch-stuk')
movingPiece.animate=()=>motion
racing.select('#sch-bord').getAnimations=()=>[motion]
racing.context.minderBeweging={matches:false}
racing.context.animeerSlag=()=>null // v265: geen geslagen stuk bij e7e5
vm.runInContext(animation,racing.context)
racing.emit('zet',{zet:reply.zet,ultraPly:2,ultraGeneration:0})
const oldTask=racing.context.wachtrij
await Promise.resolve()
assert.equal(racing.context.bezig,true,'a black reply is currently in its held animation')
racing.emit('ultra-takeback-result',{ok:true,ply:0,generation:1,fen:racingInitial})
await oldTask
assert.ok(cancelledMotion>0);assert.equal(racing.context.bezig,false)
assert.equal(schaakFen(racing.state),racingInitial);assert.equal(racing.view().ply,0)
racing.emit('zet',{zet:reply.zet,ultraPly:2,ultraGeneration:0});await racing.settle()
assert.equal(racing.view().ply,0,'a queued old reply cannot resume after the undo acknowledgement')
assert.match(source,/bewaarUltraMoment\(\)\s+registreerSlag\(staat, zet/)
assert.match(source,/bewaarUltraMoment\(\)\s+registreerSlag\(staat, geldig/)
assert.match(source,/@media \(prefers-reduced-motion:reduce\) \{ \.sch-hint-piece \{ animation:none; \} \}/)

// The swipe controller receives the same guarded takeback action as the normal
// button. Its release-time eligibility is live, not a cached button state.
const swiping=fixture({saved:'{"ultraTakeback":true,"custom":"keep"}'})
const swipe=swiping.swipe,strip=swiping.select('#sch-ultra-swipe'),swipeLabel=swiping.select('#sch-ultra-swipe-label')
const undoRequests=()=>swiping.sent.filter(message=>message.event==='ultra-takeback')
assert.equal(strip.hidden,false);assert.equal(swipe.options.canUndo(),false)
assert.equal(swipeLabel.textContent,'Geen zet om terug te nemen.')
assert.match(swiping.markup,/<\/aside><\/div><div class="sch-swipe-takeback" id="sch-ultra-swipe" role="button" tabindex="0"/,'the strip is outside the board/history row and never covers a square')
const swipeInitial=schaakFen(swiping.state)
swiping.move('e2e4');swiping.move('e7e5')
assert.equal(swipe.options.canUndo(),true);assert.ok(swipe.refreshes>1)
assert.equal(swipeLabel.textContent,'Veeg naar links om je zet terug te nemen.')
swipe.ready();assert.equal(swipeLabel.textContent,'Laat los om je zet terug te nemen.')
// Opening and closing the actual settings controller must refresh the strip's
// appearance immediately; release-time safety alone leaves a stale disabled UI.
const beforeMenu=swipe.refreshes
swiping.context.showMenu(true)
assert.equal(swiping.context.menu.hidden,false);assert.equal(swiping.context.menuBackdrop.hidden,false)
assert.equal(swiping.context.settingsBtn.getAttribute('aria-expanded'),'true')
assert.equal(swipe.refreshes,beforeMenu+1);assert.equal(swipe.enabled,false)
assert.equal(strip.getAttribute('aria-disabled'),'true');assert.equal(swipe.options.canUndo(),false)
assert.equal(swipeLabel.textContent,'Geen zet om terug te nemen.');assert.equal(swipe.trigger(),false)
swiping.context.showMenu(false)
assert.equal(swiping.context.menu.hidden,true);assert.equal(swiping.context.menuBackdrop.hidden,true)
assert.equal(swiping.context.settingsBtn.getAttribute('aria-expanded'),'false')
assert.equal(swipe.refreshes,beforeMenu+2);assert.equal(swipe.enabled,true)
assert.equal(strip.getAttribute('aria-disabled'),'false');assert.equal(swipe.options.canUndo(),true)
assert.equal(swipeLabel.textContent,'Veeg naar links om je zet terug te nemen.')
// Eligibility can change during a drag, before a new UI render. Both the
// controller's canUndo and the retained callback must reject the stale release.
for(const key of ['bezig','promotieOpen']){
  swiping.context[key]=true
  assert.equal(swipe.options.canUndo(),false,key+' blocks a drag that started earlier')
  assert.equal(swipe.trigger(),false);assert.equal(swipe.options.onUndo(),false)
  swiping.context[key]=false
}
swiping.context.spelEl.isConnected=false
assert.equal(swipe.options.canUndo(),false);assert.equal(swipe.options.onUndo(),false)
swiping.context.spelEl.isConnected=true
swiping.context.menu.hidden=false
assert.equal(swipe.options.canUndo(),false,'the settings dialog blocks gesture releases behind it')
assert.equal(swipe.trigger(),false)
swiping.context.menu.hidden=true
swiping.toggle('#sch-ultra-takeback-enabled',false)
assert.equal(strip.hidden,true);assert.equal(swipe.options.canUndo(),false);assert.equal(swipe.options.onUndo(),false)
assert.equal(swiping.read().ultraTakeback,false);assert.equal(swiping.read().custom,'keep')
assert.equal(undoRequests().length,0,'blocked releases never broadcast a takeback')
swiping.toggle('#sch-ultra-takeback-enabled',true)
assert.equal(strip.hidden,false);assert.equal(swipe.options.canUndo(),true)
assert.equal(swipe.trigger(),true)
assert.deepEqual(undoRequests().at(-1),{type:'broadcast',event:'ultra-takeback',payload:{ply:2,generation:0}})
assert.equal(swipeLabel.textContent,'Zet terugnemen…')
swiping.select('#sch-ultra-takeback').click()
assert.equal(swipe.trigger(),false);assert.equal(swipe.options.onUndo(),false)
assert.equal(undoRequests().length,1,'a swipe and button cannot duplicate an in-flight request')
swiping.emit('ultra-takeback-result',{ok:true,ply:0,generation:1,fen:swipeInitial})
assert.equal(schaakFen(swiping.state),swipeInitial);assert.equal(swiping.view().ply,0)
assert.equal(swipe.options.canUndo(),false);assert.equal(swipeLabel.textContent,'Geen zet om terug te nemen.')
swiping.move('e2e4');swiping.move('e7e5')
swiping.select('#sch-ultra-takeback').click()
assert.equal(swipe.trigger(),false)
assert.equal(undoRequests().length,2,'the ordinary button shares the same pending guard in the reverse order')
const beforeDispose=schaakFen(swiping.state)
swiping.cleanups.forEach(cleanup=>cleanup())
assert.equal(swipe.destroyed,true);assert.equal(swipe.options.canUndo(),false)
assert.equal(swipe.options.onUndo(),false);assert.equal(undoRequests().length,2)
swiping.emit('ultra-takeback-result',{ok:true,ply:0,generation:2,fen:swipeInitial})
assert.equal(schaakFen(swiping.state),beforeDispose,'a disposed game cannot process an old swipe acknowledgement')
console.log('PASS: Ultra-only strict assistance defaults, persisted opt-ins, origin-only hints, full-state takeback before/after replies, capture/castling/promotion rollback, stale generation protection, guarded swipe/button requests, reset and quiet audio.')
