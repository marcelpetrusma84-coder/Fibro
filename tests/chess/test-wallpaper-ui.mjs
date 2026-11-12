import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Schaak from '../../schaak.js'

const two=readFileSync(new URL('../../schaken-ui.js',import.meta.url),'utf8')
const three=readFileSync(new URL('../../schaken-drie-ui.js',import.meta.url),'utf8')
const reader=two.match(/function readSettings\(\) \{[\s\S]*?\n\}/)[0]
const render=two.slice(two.indexOf('export function start('),two.indexOf('  const bordEl =')).replace('export function start(','function render(')+'\nreturn inhoud.innerHTML; }'
const twoController=two.slice(two.indexOf('  // The background has a shared preference'),two.indexOf('  const threePlayerToggle ='))
const threeController=three.slice(three.indexOf("  const wallpaperToggle = settingsDialog.querySelector"),three.indexOf('  const soundButton ='))
const threeMarkupLine=three.split('\n').find(line=>line.includes('id="chess3-wallpaper-enabled"'))
const nl=(key,values)=>key.replace(/\{(\w+)\}/g,(match,name)=>values?.[name]??match)
function node() {
  const handlers=new Map()
  return {checked:false,hidden:false,textContent:'',addEventListener:(name,handler)=>handlers.set(name,handler),
    change(){handlers.get('change')?.()},click(){handlers.get('click')?.()}}
}
function markup({isSolo=true,niveau='ultra'}={}) {
  const root={innerHTML:''}
  const context=vm.createContext({document:{getElementById:()=>root},localStorage:{getItem:()=>null},matchMedia:()=>({matches:true}),maakSchaakTaal:()=>({t:nl})})
  vm.runInContext(`const SETTINGS_KEY='test'; ${reader}; ${render}; globalThis.render=render`,context)
  return context.render({Schaak,spelKanaal:{isSolo,niveau},benIkSpeler1:true})
}
for(const niveau of ['easy','medium','hard','ultra']) {
  const html=markup({niveau})
  assert.match(html,/id="sch-wallpaper-enabled"/)
  assert.match(html,/4D wallpaper/)
  assert.match(html,/id="sch-wallpaper-status" role="status" aria-live="polite"/)
  assert.equal(html.includes('id="sch-ultra-hints-enabled"'),niveau==='ultra','assistance remains Ultra-only')
}
assert.match(markup({isSolo:false}),/id="sch-wallpaper-enabled"/,'friend games also have the wallpaper setting')
let threeMarkup=''
vm.runInNewContext(threeMarkupLine,{tekst:key=>key,settingsDialog:{querySelector:()=>({insertAdjacentHTML(_where,html){threeMarkup=html}})}})
assert.match(threeMarkup,/id="chess3-wallpaper-enabled"/)
assert.match(threeMarkup,/role="status" aria-live="polite"/)

// Exercise the real bindings with a deterministic controller, independent of the
// wallpaper renderer's own sensor/storage tests. The photo preference is shared.
let sharedEnabled=false
function fixture(mode,{overlay=true}={}) {
  const prefix=mode==='two'?'sch':'chess3',nodes=new Map(),events=[],cleanup=[]
  for(const key of ['enabled','motion','status'])nodes.set('#'+prefix+'-wallpaper-'+key,node())
  const select=id=>nodes.get(id)
  const root={classList:{remove(){}}},overlayRoot={classList:{remove(){}}}
  let state=sharedEnabled?'permission':'off',callback,disposed=false,unsubscribed=false,language='nl'
  const factory=options=>{
    assert.equal(options.root,overlay?overlayRoot:root,'the background attaches to the overlay, with a content fallback')
    events.push('created')
    return {get enabled(){return sharedEnabled},get motionState(){return state},
      setEnabled(on,options){events.push(['enable',on,options.requestMotion]);sharedEnabled=on;state=on?'permission':'off';callback?.();return Promise.resolve()},
      activateMotion(){events.push('activate');state='motion';callback?.();return Promise.resolve()},
      subscribe(fn){callback=fn;return ()=>{unsubscribed=true;callback=null}},destroy(){disposed=true;events.push('destroy')}}
  }
  const context=vm.createContext({document:{getElementById:()=>overlay?overlayRoot:null},inhoud:root,root,wallpaperRoot:overlay?overlayRoot:root,
    menu:{querySelector:select},settingsDialog:{querySelector:select},maakSchaakWallpaper:factory,opruimers:cleanup,
    t:key=>language==='nl'?key:'EN:'+key})
  vm.runInContext((mode==='two'?twoController:threeController)+'\nglobalThis.refresh=toonSchaakWallpaper; globalThis.dispose=()=>{stopWallpaper();schaakWallpaper.destroy()}',context)
  return {events,context,cleanup,toggle:select('#'+prefix+'-wallpaper-enabled'),motion:select('#'+prefix+'-wallpaper-motion'),status:select('#'+prefix+'-wallpaper-status'),
    state(next){state=next;callback?.()},language(next){language=next;context.refresh()},dispose(){mode==='two'?cleanup.forEach(fn=>fn()):context.dispose()},
    get disposed(){return disposed},get unsubscribed(){return unsubscribed}}
}
for(const mode of ['two','three']) {
  sharedEnabled=true
  const firstUse=fixture(mode)
  assert.equal(firstUse.toggle.checked,true,'the enabled first-use controller is reflected in the menu')
  assert.equal(firstUse.motion.hidden,false,'a permission-gated phone offers a user gesture')
  assert.deepEqual(firstUse.events,['created'],'an enabled first-use background never requests permission on mounting')
  firstUse.toggle.checked=false;firstUse.toggle.change();firstUse.dispose()
  const savedOff=fixture(mode)
  assert.equal(savedOff.toggle.checked,false,'an explicit OFF is preserved when the menu is mounted again')
  assert.equal(savedOff.motion.hidden,true)
  savedOff.dispose()
  sharedEnabled=false
  const ui=fixture(mode)
  assert.equal(ui.toggle.checked,false);assert.equal(ui.motion.hidden,true);assert.equal(ui.status.textContent,'')
  ui.toggle.checked=true;ui.toggle.change()
  assert.deepEqual(ui.events.at(-1),['enable',true,true],'permission is requested directly in the checkbox user handler')
  assert.equal(ui.toggle.checked,true);assert.equal(ui.motion.hidden,false)
  assert.match(ui.status.textContent,/Activeer telefoonbeweging/)
  ui.motion.click();assert.equal(ui.events.at(-1),'activate');assert.equal(ui.motion.hidden,true)
  assert.match(ui.status.textContent,/Telefoonbeweging actief/)
  ui.language('en');assert.match(ui.status.textContent,/^EN:/,'status translates without recreating the background')
  assert.equal(ui.events.filter(event=>event==='created').length,1)
  for(const state of ['denied','reduced','unavailable','pointer']) {
    ui.state(state);assert.ok(ui.status.textContent.length>0)
    assert.equal(ui.toggle.checked,true,'sensor fallback keeps the wallpaper enabled')
  }
  ui.toggle.checked=false;ui.toggle.change();assert.deepEqual(ui.events.at(-1),['enable',false,true]);assert.equal(ui.status.textContent,'')
  ui.dispose();assert.equal(ui.disposed,true);assert.equal(ui.unsubscribed,true)
}
sharedEnabled=false
const ordinary=fixture('two',{overlay:false});ordinary.toggle.checked=true;ordinary.toggle.change();ordinary.dispose()
const trio=fixture('three');assert.equal(trio.toggle.checked,true,'three-player chess reads the same wallpaper preference')
assert.equal(trio.motion.hidden,false,'persisted phone wallpaper offers a fresh gesture for motion permission')
assert.deepEqual(trio.events,['created'],'persisted wallpaper does not prompt on mounting')
trio.dispose()
assert.match(two,/toonDenktijd\(\)\s+toonSchaakWallpaper\(\)/,'two-player language refresh updates the wallpaper text')
assert.match(three,/soundButton\?\.setLanguage\?\.\(taal.language\)\s+toonSchaakWallpaper\(\)/)
assert.match(three,/stopLanguage\(\); taal.destroy\(\)\s+stopWallpaper\(\); schaakWallpaper.destroy\(\)/)
console.log('PASS: wallpaper settings in every chess mode, shared independent preference, direct permission gestures, friendly fallbacks, live language and cleanup.')
