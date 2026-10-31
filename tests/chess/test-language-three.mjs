import assert from 'node:assert/strict'
import { legalThreePlayerMoves } from '../../schaak-drie.js?v=10'

// Exercise the real renderer and preference controller with a small DOM fixture.
// No camera permissions, account, socket or network is used.
const decode = value => String(value).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
class Node {
  constructor(tag, doc) {
    this.tagName=tag; this.ownerDocument=doc; this.children=[]; this.parentElement=null; this.attrs=new Map(); this.dataset={}; this.style={}; this.handlers=new Map(); this._classes=new Set(); this._text=''; this.open=false; this.playCalls=0
    this.classList={add:(...names)=>names.forEach(name=>this._classes.add(name)),remove:(...names)=>names.forEach(name=>this._classes.delete(name)),contains:name=>this._classes.has(name),toggle:(name,force=!this._classes.has(name))=>{force?this._classes.add(name):this._classes.delete(name);return force}}
  }
  get className(){return [...this._classes].join(' ')} set className(value){this._classes=new Set(String(value).split(/\s+/).filter(Boolean))}
  setAttribute(name,value){value=String(value);this.attrs.set(name,value);if(name==='class')this.className=value;if(name==='id')this.id=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value}
  getAttribute(name){return name==='class'?this.className:this.attrs.get(name)??null}
  removeAttribute(name){this.attrs.delete(name)}
  append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentElement=this}}
  appendChild(node){this.append(node);return node}
  replaceChildren(...nodes){this.children.forEach(node=>node.parentElement=null);this.children=[];this._text='';this.append(...nodes)}
  insertBefore(node,before){node.remove();const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,node);node.parentElement=this}
  remove(){if(this.parentElement){const nodes=this.parentElement.children;nodes.splice(nodes.indexOf(this),1);this.parentElement=null}}
  get isConnected(){return this===this.ownerDocument.root||Boolean(this.parentElement?.isConnected)}
  set textContent(value){this.replaceChildren();this._text=String(value)} get textContent(){return this._text+this.children.map(node=>node.textContent).join('')}
  set innerHTML(value){
    this.replaceChildren();this._html=String(value);const stack=[this];const tokens=String(value).match(/<\/?[^>]+>|[^<]+/g)||[]
    for(const token of tokens){
      if(token.startsWith('</')){if(stack.length>1)stack.pop();continue}
      if(token.startsWith('<')){
        const name=token.match(/^<([\w:-]+)/)?.[1];if(!name)continue
        const node=new Node(name,this.ownerDocument)
        for(const item of token.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g))node.setAttribute(item[1],decode(item[2]))
        stack.at(-1).append(node)
        if(!/\/$/.test(token.slice(0,-1))&&!['br','input','image','path','polygon','stop','feDropShadow','feGaussianBlur'].includes(name))stack.push(node)
      }else{const node=new Node('#text',this.ownerDocument);node._text=decode(token);stack.at(-1).append(node)}
    }
  }
  get innerHTML(){return this._html||''}
  insertAdjacentHTML(_where,html){const holder=new Node('fragment',this.ownerDocument);holder.innerHTML=html;this.append(...holder.children.slice())}
  matches(selector){
    if(selector[0]==='#')return this.id===selector.slice(1)
    if(selector[0]==='.')return this.classList.contains(selector.slice(1))
    if(selector[0]==='['){const match=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return Boolean(match&&this.getAttribute(match[1])!==null&&(match[2]===undefined||this.getAttribute(match[1])===match[2]))}
    return this.tagName===selector
  }
  querySelectorAll(selector){const selectors=selector.split(',').map(part=>part.trim());const found=[];const visit=node=>{for(const child of node.children){if(selectors.some(part=>child.matches(part)))found.push(child);visit(child)}};visit(this);return found}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null}
  contains(target){for(let node=target;node;node=node.parentElement)if(node===this)return true;return false}
  addEventListener(name,fn){this.handlers.set(name,[...(this.handlers.get(name)||[]),fn])}
  emit(name,event={}){for(const fn of this.handlers.get(name)||[])fn({target:this,preventDefault(){},...event})}
  focus(){this.ownerDocument.activeElement=this}
  showModal(){this.open=true} close(){this.open=false;this.emit('close')}
  play(){this.playCalls++;return Promise.resolve()}
  getBoundingClientRect(){return {left:0,right:700,top:0,bottom:700,width:700,height:700}}
}
const doc={createElement(tag){return new Node(tag,doc)},createElementNS(_ns,tag){return new Node(tag,doc)},createTextNode(text){const node=new Node('#text',doc);node._text=text;return node},getElementById(id){return doc.root.id===id?doc.root:doc.root.querySelector('#'+id)}}
doc.root=new Node('body',doc)
for(const id of ['spelOverlay','spelTitelBar','spelInhoud']){const node=new Node('div',doc);node.setAttribute('id',id);doc.root.append(node)}
globalThis.document=doc
const saved=new Map([['fibro_taal','en']])
globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,String(value))}
globalThis.window=new EventTarget()
window.T=()=>{throw Error('The chess renderer must not invoke the global app translator')}
const {start}=await import('../../schaken-drie-ui.js')
const {maakSchaakTaal}=await import('../../schaak-taal.js?v=3')
const root=doc.getElementById('spelInhoud')
const hostile='<img src=x onerror=alert(1)>'
let stopped=0
const stream={getTracks:()=>[{stop(){stopped++}}]}
const audio=[]
const sound={capturePiece:effect=>audio.push(effect),previewSchaakGeluid:()=>audio.push('quiet')}
const controller=start({Bordgeluid:sound,players:[{id:'you',username:hostile},{id:'black',username:'PersonalName'},{id:'red',username:'RedName'}],userId:'you',localPreview:true,testMode:true,testStream:stream})
const state=controller.state
assert.equal(root.getAttribute('lang'),'nl','Dutch is the chess default even when the app is English')
assert.match(root.querySelector('.chess3-heading').textContent,/Schaken met drie spelers/)
assert.match(root.querySelector('.chess3-status').textContent,/is aan zet/)
assert.ok(root.querySelector('.chess3-board').innerHTML.includes('&lt;img src=x'),'player names remain escaped in the SVG')
assert.ok(!root.querySelector('.chess3-board').innerHTML.includes('<img src=x'))
const cameraNodes=root.querySelectorAll('video')
assert.equal(cameraNodes.length,3)
assert.ok(cameraNodes.every(video=>video.srcObject===stream))
const plays=cameraNodes.reduce((n,video)=>n+video.playCalls,0)
const [from,piece]=[...state.pieces].find(([id,piece])=>piece.player===0&&legalThreePlayerMoves(state,id).length)
const to=legalThreePlayerMoves(state,from)[0]
const board=root.querySelector('.chess3-board')
board.emit('click',{target:board.querySelector(`[data-cell-id="${from}"]`)})
assert.ok(board.querySelector('.is-selected'),'the selected piece is visible')
const snapshot=JSON.stringify([...state.pieces])
const settingsButton=root.querySelectorAll('.chess3-rules-button').find(node=>node.textContent.includes('Instellingen'))
settingsButton.emit('click')
const select=root.querySelector('#chess3-language')
assert.equal(doc.activeElement,select)
select.value='en';select.emit('change')
assert.equal(root.getAttribute('lang'),'en')
assert.match(root.querySelector('.chess3-heading').textContent,/Three-player chess/)
assert.match(root.querySelector('.chess3-status').textContent,/to move/)
assert.equal(controller.state,state,'changing the language keeps the actual game instance')
assert.equal(JSON.stringify([...state.pieces]),snapshot,'language changes do not move or replace pieces')
assert.ok(board.querySelector('.is-selected'),'the current piece selection survives')
assert.equal(doc.activeElement,select,'the settings selector retains focus')
assert.ok(root.querySelector('#chess3-settings').open,'the settings window stays open')
assert.ok(cameraNodes.every(video=>video.srcObject===stream),'the same camera stream stays attached')
assert.equal(cameraNodes.reduce((n,video)=>n+video.playCalls,0),plays,'changing labels never restarts video playback')
assert.equal(stopped,0)
assert.equal(saved.get('fibro_taal'),'en','the app preference remains unchanged')
assert.equal(root.querySelector('.chess3-camera-name').textContent,'White · YOU · TEST')
assert.match(root.querySelector('#chess3-rules').textContent,/The goal/)
board.emit('click',{target:board.querySelector(`[data-cell-id="${to}"]`)})
assert.equal(state.ply,1,'the selected legal move is still playable after switching language')
assert.deepEqual(audio,['quiet'],'a legal quiet move uses the ordinary placement sound once')
const remote=maakSchaakTaal()
const focusedId=[...state.pieces.keys()][0]
board.querySelector(`[data-cell-id="${focusedId}"]`).focus()
remote.setLanguage('nl')
assert.equal(doc.activeElement.dataset.cellId,focusedId,'keyboard focus follows the same board square after a shared language update')
assert.match(root.querySelector('.chess3-status').textContent,/is aan zet/,'a shared preference event updates a mounted view')
assert.equal(state.ply,1)
// Real board events use the local listener's perspective even when testing all three colours.
function capture(mover,victim){
  state.pieces.clear();state.active=[true,true,true];state.winner=null;state.turn=mover
  const from=state.board.cells[0].id
  state.pieces.set(from,{type:'R',player:mover})
  const to=legalThreePlayerMoves(state,from)[0]
  assert.ok(to)
  state.pieces.set(to,{type:'Q',player:victim})
  board.emit('click',{target:board.querySelector(`[data-cell-id="${from}"]`)})
  board.emit('click',{target:board.querySelector(`[data-cell-id="${to}"]`)})
}
capture(0,1);assert.deepEqual(audio.at(-1),{value:9,outcome:'win',theme:'classic'})
capture(1,0);assert.deepEqual(audio.at(-1),{value:9,outcome:'loss',theme:'classic'})
capture(1,2);assert.equal(audio.at(-1),'quiet','a capture between the other two players never gives a fake win/loss cue')
assert.equal(audio.length,4,'one audio effect for each valid move')
state.winner=1
remote.setLanguage('en')
assert.equal(root.querySelector('.chess3-status').textContent,'PersonalName wins — last king standing.','a real chosen name remains unchanged')
controller.destroy({preserveCamera:true});remote.destroy()
assert.equal(stopped,0,'preserveCamera teardown keeps the stream for the next board')
assert.equal(root.getAttribute('lang'),null,'other games do not inherit the chess language attribute')
assert.equal(doc.getElementById('spelTitelBar').getAttribute('lang'),null)
assert.equal(root.children.length,0)

saved.delete('fibro_chess_language_v1')
const fallback=start({players:['white','black','red'],userId:'white',localPreview:true})
assert.equal(root.querySelector('.chess3-status').textContent,'Wit is aan zet · jouw zet','only fallback colour names are translated')
fallback.destroy()
console.log('PASS: three-player default Dutch and live English, selected move/state/focus preserved, camera stream identity, escaped usernames, rules, shared language updates and cleanup.')
