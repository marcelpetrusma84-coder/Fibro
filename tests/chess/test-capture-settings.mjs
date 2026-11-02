import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source=readFileSync(new URL('../../schaken-ui.js',import.meta.url),'utf8')
const reader=source.match(/function readSettings\(\) \{[\s\S]*?\n\}/)[0]
const binding=source.slice(source.indexOf('  const gradedCaptureToggle ='),source.indexOf('  const cameraLayoutToggle ='))
const afterMove=source.match(/  function naBeurtControle\([\s\S]*?\n  \}/)[0]
function fixture(isUltra=false,saved='{}') {
  const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value}}
  const context=vm.createContext({localStorage:storage,isUltra})
  vm.runInContext(`const SETTINGS_KEY='test'; ${reader}; globalThis.read=readSettings`,context)
  const settings=context.read(), audio=[]
  let handler
  const toggle={checked:false,addEventListener(type,fn){assert.equal(type,'change');handler=fn}}
  Object.assign(context,{instellingen:settings,menu:{querySelector:()=>toggle},
    bewaarInstellingen(){storage.setItem('test',JSON.stringify(settings))},
    Bordgeluid:{schaak(...args){audio.push(args)}},
    Schaak:{isSchaakmat:()=>false,isPat:()=>false,staatInSchaak:()=>false},
    staat:{aanZet:'z'},laatsteZet:{type:'slag'},mijnKleur:'w',toonStatus(){},tegenstanderNaam:()=>'Friend',tekenBord(){}
  })
  vm.runInContext(`${binding}\n${afterMove}\nglobalThis.afterMove=naBeurtControle`,context)
  return {context,settings,toggle,audio,read:context.read,change(on){toggle.checked=on;handler()},get saved(){return JSON.parse(saved)},storage}
}
for (const saved of ['{}','{broken','null','{"gradedCaptureSounds":false}','{"gradedCaptureSounds":"true","ultraGradedCaptureSounds":"false"}','{"gradedCaptureSounds":1,"ultraGradedCaptureSounds":0}']) {
  const ui=fixture(false,saved)
  assert.equal(ui.read().gradedCaptureSounds,false,'normal default is strictly OFF')
  assert.equal(ui.read().ultraGradedCaptureSounds,true,'missing or invalid Ultra preference defaults ON')
  assert.equal(ui.read().ultraEvaluationSound,false)
  assert.equal(ui.read().ultraThinking,5)
  assert.equal(ui.read().thinking,7)
}
const capture={value:9,outcome:'win'}
const normal=fixture(false,'{"gradedCaptureSounds":true,"ultraGradedCaptureSounds":true,"soundTheme":"wood","board":"glass","thinking":3,"custom":"keep"}')
assert.equal(normal.toggle.checked,true)
normal.context.afterMove(capture); assert.equal(normal.audio.at(-1)[5],capture)
normal.change(false); normal.context.afterMove(capture)
assert.equal(normal.audio.at(-1)[5],null); assert.equal(normal.audio.at(-1)[4],'wood')
assert.equal(normal.saved.gradedCaptureSounds,false); assert.equal(normal.saved.ultraGradedCaptureSounds,true)
assert.equal(normal.saved.board,'glass'); assert.equal(normal.saved.thinking,3); assert.equal(normal.saved.custom,'keep')
normal.change(true); assert.equal(normal.read().gradedCaptureSounds,true)
normal.context.afterMove(null); assert.equal(normal.audio.at(-1)[5],null)
const ultra=fixture(true,'{"gradedCaptureSounds":false,"ultraEvaluationSound":true,"ultraThinking":4,"custom":"keep"}')
assert.equal(ultra.toggle.checked,true,'the Ultra checkbox defaults ON')
ultra.context.afterMove(capture); assert.equal(ultra.audio.at(-1)[5],capture)
ultra.change(false); ultra.context.afterMove(capture)
assert.equal(ultra.audio.at(-1)[5],null)
assert.equal(ultra.read().ultraGradedCaptureSounds,false,'Ultra OFF persists')
assert.equal(ultra.read().gradedCaptureSounds,false,'Ultra toggle preserves normal OFF')
assert.equal(ultra.read().ultraEvaluationSound,true,'analysis sound is independent of capture sound')
assert.equal(ultra.read().ultraThinking,4); assert.equal(ultra.saved.custom,'keep')
const reopened=fixture(true,JSON.stringify(ultra.saved)); assert.equal(reopened.toggle.checked,false)
reopened.change(true); assert.equal(reopened.read().ultraGradedCaptureSounds,true)
normal.storage.getItem=()=>{throw Error('blocked')}
assert.equal(normal.read().gradedCaptureSounds,false); assert.equal(normal.read().ultraGradedCaptureSounds,true)

// The existing slider binds to its own mode's saved preference and sends it live.
const timingBinding=source.slice(source.indexOf('  const denktijd ='),source.indexOf("  menu.querySelectorAll('[data-options] .sch-keuze')"))
for (const isUltra of [false,true]) {
  const fieldset={hidden:false}, slider={value:'',closest:()=>fieldset,addEventListener(_type,fn){this.input=fn}}, output={value:''}, sent=[]
  const settings={thinking:7,ultraThinking:5}
  const context=vm.createContext({isUltra,instellingen:settings,menu:{querySelector:id=>id==='#sch-denktijd'?slider:output},
    t:(key,values)=>key.replace('{n}',values?.n),bewaarInstellingen(){},spelKanaal:{isSolo:true,send:message=>sent.push(message)}})
  vm.runInContext(timingBinding,context)
  assert.equal(fieldset.hidden,false,'the thinking slider is visible in every computer game')
  assert.equal(slider.value,isUltra?'5':'7')
  assert.equal(output.value,isUltra?'5 seconden':'7 seconden')
  slider.value='2'; slider.input()
  assert.equal(sent.at(-1).payload.thinkingMs,2000)
  assert.equal(settings[isUltra?'ultraThinking':'thinking'],2)
  assert.equal(settings[isUltra?'thinking':'ultraThinking'],isUltra?7:5)
}
for (const [value,expected] of [[-2,0],[20,7],['3',5],[null,5],[0,0],[3,3]]) {
  const ui=fixture(true,JSON.stringify({ultraThinking:value}))
  assert.equal(ui.read().ultraThinking,expected,'Ultra thinking accepts only finite numeric settings')
}
console.log('PASS: separate normal/Ultra capture defaults and persistence, live sound dispatch, strict analysis preference, and independent visible thinking slider.')
