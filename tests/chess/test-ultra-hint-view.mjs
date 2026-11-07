import assert from 'node:assert/strict'
import { maakHintWeergave } from '../../schaak-hint-weergave.js'

const SVG_NS='http://www.w3.org/2000/svg'
class Events {
  handlers=new Map()
  addEventListener(type,handler){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(handler)}
  removeEventListener(type,handler){this.handlers.get(type)?.delete(handler)}
  emit(type){for(const handler of [...this.handlers.get(type)||[]])handler({type,target:this})}
  get listenerCount(){return [...this.handlers.values()].reduce((sum,list)=>sum+list.size,0)}
}
class Node extends Events {
  constructor(tag,doc,namespace=null){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.namespaceURI=namespace;this.attrs=new Map();this.children=[];this.parentNode=null;this.hidden=false;this.disabled=false;this.isConnected=true;this._text='';this.classes=new Set();this.properties=new Map();this.style={setProperty:(key,value)=>this.properties.set(key,String(value)),getPropertyValue:key=>this.properties.get(key)||''};this.classList={contains:name=>this.classes.has(name),add:(...names)=>names.forEach(name=>this.classes.add(name)),remove:(...names)=>names.forEach(name=>this.classes.delete(name))}}
  set className(value){this.classes=new Set(String(value).split(/\s+/).filter(Boolean))}get className(){return [...this.classes].join(' ')}
  set textContent(value){this.replaceChildren();this._text=String(value)}get textContent(){return this._text+this.children.map(child=>child.textContent).join('')}
  get attributes(){const values=new Map(this.attrs);if(this.className)values.set('class',this.className);return [...values].map(([name,value])=>({name,value}))}
  setAttribute(name,value){if(name==='class')this.className=value;else this.attrs.set(name,String(value))}getAttribute(name){return name==='class'?this.className:this.attrs.get(name)??null}
  removeAttribute(name){this.attrs.delete(name)}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node)}}
  replaceChildren(...nodes){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...nodes)}
  remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null}}
  matches(selector){if(selector==='*')return true;if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));const attrs=[...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];if(attrs.length)return attrs.every(([,key,value])=>value===undefined?this.getAttribute(key)!==null:this.getAttribute(key)===value);return this.tagName.toLowerCase()===selector}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)])}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  cloneNode(deep){const node=new Node(this.tagName,this.ownerDocument,this.namespaceURI);for(const attribute of this.attributes)node.setAttribute(attribute.name,attribute.value);node._text=this._text;if(deep)node.append(...this.children.map(child=>child.cloneNode(true)));return node}
  scrollIntoView(options){this.scrollOptions=options;this.scrolls=(this.scrolls||0)+1}
  animate(frames,options){let finish,reject;const finished=new Promise((resolve,refuse)=>{finish=resolve;reject=refuse});const animation={target:this,frames,options,finished,cancelled:false,finish,cancel(){this.cancelled=true;reject(Error('cancelled'))}};this.ownerDocument.animations.push(animation);return animation}
}
const defaultModel=()=>({from:[7,6],to:[5,5],piece:'wN',moveLabel:'g1 → f3',reasons:[{key:'Activeer {stuk}',values:{stuk:'het paard'}}],meta:'Stockfish · diepte 18'})
function fixture({color='w',reducedMotion=false,svgRender}={}){
  const doc={animations:[],createElement:tag=>new Node(tag,doc),createElementNS:(ns,tag)=>new Node(tag,doc,ns)}
  const board=doc.createElement('div'),panel=doc.createElement('section')
  const move=doc.createElement('span'),reasons=doc.createElement('ul'),meta=doc.createElement('span'),replay=doc.createElement('button'),close=doc.createElement('button')
  for(const[node,name]of[[move,'move'],[reasons,'reasons'],[meta,'meta'],[replay,'replay'],[close,'close']]){node.setAttribute('data-hint-'+name,'');panel.append(node)}
  const model=defaultModel();if(color==='z')model.piece='zN'
  function draw(){board.replaceChildren();for(let r=0;r<8;r++)for(let k=0;k<8;k++){const square=doc.createElement('button');square.className='sch-vak';square.setAttribute('data-r',r);square.setAttribute('data-k',k);if(r===7&&k===6){square.classList.add('sch-hint-piece');const piece=doc.createElement('span');piece.className='sch-stuk';const svg=doc.createElementNS(SVG_NS,'svg');svg.className=`sch-figuur ${color==='w'?'sch-ivoor':'sch-ebben'} sch-type-N`;svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('aria-hidden','true');const path=doc.createElementNS(SVG_NS,'path');path.setAttribute('d','M 13 58 L 32 8 L 53 58 Z');svg.append(path);piece.append(svg);square.append(piece)}board.append(square)}}
  draw();let closed=0,renderCalls=0
  const view=maakHintWeergave({board,panel,playerColor:color,reducedMotion,documentTarget:doc,stukSVG:svgRender||(()=>{renderCalls++;return '<svg onload="bad()"></svg>'}),onClose:()=>closed++})
  const square=(r,k)=>board.querySelector(`[data-r="${r}"][data-k="${k}"]`)
  return {doc,board,panel,move,reasons,meta,replay,close,view,model,draw,square,get closed(){return closed},get renderCalls(){return renderCalls}}
}

// The diagram scales with the board, respects both orientations, and leaves
// every original square, SVG and source highlight in place.
for(const color of ['w','z']){
  const h=fixture({color}),squares=h.board.children.slice(),source=h.square(7,6),piece=source.querySelector('.sch-stuk'),svg=piece.querySelector('svg')
  assert.equal(h.view.show(h.model),true);assert.equal(h.panel.hidden,false)
  assert.equal(h.move.textContent,'g1 → f3');assert.equal(h.meta.textContent,'Stockfish · diepte 18');assert.equal(h.reasons.textContent,'Activeer het paard')
  assert.equal(h.board.querySelectorAll('[data-r]').length,64)
  squares.forEach((square,index)=>assert.equal(h.board.children[index],square))
  assert.equal(source.querySelector('.sch-stuk'),piece);assert.equal(piece.querySelector('svg'),svg);assert.equal(source.classList.contains('sch-hint-piece'),true)
  assert.equal(h.square(5,5).classList.contains('sch-hint-destination'),true)
  const arrow=h.board.querySelector('.sch-hint-route');assert.equal(arrow.tagName,'SVG');assert.equal(arrow.getAttribute('viewBox'),'0 0 800 800');assert.equal(arrow.getAttribute('aria-hidden'),'true')
  const paths=arrow.querySelectorAll('path');assert.deepEqual(paths.map(node=>node.getAttribute('stroke')),['#07101e','#ffffff','#67e8f9'])
  const numbers=paths[0].getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number)
  if(color==='w'){assert(numbers[0]>600&&numbers[1]>700);assert(numbers[2]<600&&numbers[3]<650)}
  else{assert(numbers[0]<200&&numbers[1]<100);assert(numbers[2]>200&&numbers[3]>200)}
  assert.equal(h.doc.animations.length,0,'ordinary redraws draw a static arrow without replaying a demo')
  h.view.clear();assert.equal(h.panel.hidden,true);assert.equal(h.board.querySelectorAll('.sch-hint-route').length,0);assert.equal(h.square(5,5).classList.contains('sch-hint-destination'),false)
  assert.equal(source.querySelector('.sch-stuk'),piece);assert.equal(source.classList.contains('sch-hint-piece'),true)
  h.view.destroy()
}

// Replay animates only an owned copy, with percentages that stay correct when
// the board resizes. Finishing/cancelling never executes or replaces a piece.
for(const color of ['w','z']){
  const h=fixture({color}),sourcePiece=h.square(7,6).querySelector('.sch-stuk'),sourceSvg=sourcePiece.querySelector('svg')
  h.view.show(h.model,{animate:true,reveal:true})
  assert.equal(h.doc.animations.length,1);assert.equal(h.panel.scrollOptions.block,'nearest');assert.equal(h.panel.scrollOptions.behavior,'smooth')
  const first=h.doc.animations[0],copy=h.board.querySelector('.sch-hint-ghost'),arrow=h.board.querySelector('.sch-hint-route')
  assert.equal(first.options.duration,1000);assert.equal(first.target,copy);assert.equal(copy.getAttribute('aria-hidden'),'true')
  assert.equal(copy.style.getPropertyValue('left'),color==='w'?'75%':'12.5%');assert.equal(copy.style.getPropertyValue('top'),color==='w'?'87.5%':'0%')
  assert.equal(first.frames.at(-1).transform,color==='w'?'translate(-100%,-200%) scale(1)':'translate(100%,200%) scale(1)')
  assert.notEqual(copy.querySelector('svg'),sourceSvg);assert.equal(h.square(7,6).querySelector('.sch-stuk'),sourcePiece)
  assert.equal(h.renderCalls,0,'a renderer string is never inserted; the existing checked artwork is cloned')
  h.replay.emit('click');assert.equal(first.cancelled,true);assert.equal(h.doc.animations.length,2);assert.equal(h.board.querySelector('.sch-hint-route'),arrow)
  const running=h.doc.animations[1];running.finish();await Promise.resolve();assert.equal(h.board.querySelector('.sch-hint-ghost'),null);assert.equal(h.square(5,5).classList.contains('sch-hint-destination'),true)
  h.replay.emit('click');const cancelled=h.doc.animations.at(-1);h.close.emit('click');await Promise.resolve()
  assert.equal(cancelled.cancelled,true);assert.equal(h.closed,1);assert.equal(h.panel.hidden,true);assert.equal(h.board.querySelector('.sch-hint-route'),null)
  assert.equal(h.square(7,6).querySelector('.sch-stuk'),sourcePiece)
  h.view.destroy();h.view.destroy();const count=h.doc.animations.length;h.replay.emit('click');h.close.emit('click')
  assert.equal(h.doc.animations.length,count);assert.equal(h.closed,1);assert.equal(h.close.listenerCount,0);assert.equal(h.replay.listenerCount,0)
  assert.equal(h.view.show(h.model,{animate:true}),false,'destroyed views cannot decorate a future board')
}

// A board repaint invalidates old DOM references; show replaces only its own
// drawings and preserves a destination highlight that was already present.
{
  const h=fixture();h.square(5,5).classList.add('sch-hint-destination');h.view.show(h.model);h.view.clear()
  assert.equal(h.square(5,5).classList.contains('sch-hint-destination'),true)
  h.view.show(h.model,{animate:true});const oldDestination=h.square(5,5),oldArrow=h.board.querySelector('.sch-hint-route'),count=h.doc.animations.length
  h.draw();h.view.show(h.model)
  assert.notEqual(h.board.querySelector('.sch-hint-route'),oldArrow);assert.equal(h.square(5,5).classList.contains('sch-hint-destination'),true)
  assert.notEqual(h.square(5,5),oldDestination);assert.equal(h.doc.animations.length,count)
  h.view.destroy();await Promise.resolve()
}

// Payloads are inert text, and malformed geometry/pieces never reach SVG attrs.
{
  const h=fixture();const payload='<img src=x onerror=bad()>'
  h.model.moveLabel=payload;h.model.meta=payload;h.model.reasons=[{key:'Reden: {waarde}',values:{waarde:payload}}]
  assert.equal(h.view.show(h.model),true);assert.equal(h.move.textContent,payload);assert.equal(h.meta.textContent,payload);assert.equal(h.reasons.textContent,'Reden: '+payload)
  assert.equal(h.panel.querySelectorAll('img').length,0);assert.equal(h.panel.querySelectorAll('script').length,0)
  for(const changed of [{from:[-1,0]},{to:[8,0]},{from:['7',6]},{from:[NaN,0]},{to:[7,6]},{piece:'wX'},{piece:'wN\" onload=bad()'},{piece:null}]){
    assert.equal(h.view.show({...h.model,...changed},{animate:true}),false);assert.equal(h.panel.hidden,true);assert.equal(h.board.querySelector('.sch-hint-route'),null)
  }
  h.view.destroy()
}
for(const malicious of ['onload','href','style']){
  const h=fixture();h.square(7,6).querySelector('svg').setAttribute(malicious,'bad()')
  assert.equal(h.view.show(h.model,{animate:true}),true,'a rejected ghost still leaves a usable static explanation')
  assert.equal(h.doc.animations.length,0);assert.equal(h.board.querySelector('.sch-hint-ghost'),null);assert(h.board.querySelector('.sch-hint-route'))
  h.view.destroy()
}
{
  const h=fixture(),svg=h.square(7,6).querySelector('svg');svg.append(h.doc.createElementNS(SVG_NS,'script'))
  h.view.show(h.model,{animate:true});assert.equal(h.doc.animations.length,0);h.view.destroy()
}

// Reduced motion suppresses the demo while retaining diagram and explanation.
for(const reducedMotion of [true,()=>true,{matches:true}]){
  const h=fixture({reducedMotion});h.view.show(h.model,{animate:true,reveal:true});h.replay.emit('click')
  assert.equal(h.doc.animations.length,0);assert(h.board.querySelector('.sch-hint-route'));assert.equal(h.panel.scrollOptions.behavior,'auto');h.view.destroy()
}
{
  const reducedMotion=Object.assign(new Events(),{matches:false}),h=fixture({reducedMotion})
  h.view.show(h.model,{animate:true});const running=h.doc.animations[0]
  reducedMotion.matches=true;reducedMotion.emit('change');await Promise.resolve()
  assert.equal(running.cancelled,true);assert.equal(h.board.querySelector('.sch-hint-ghost'),null);assert(h.board.querySelector('.sch-hint-route'))
  h.view.destroy();assert.equal(reducedMotion.listenerCount,0)
}
console.log('PASS: hint diagrams, orientation, inert explanations, isolated ghost replay, responsive geometry, redraw, safety, reduced motion and complete cleanup.')
