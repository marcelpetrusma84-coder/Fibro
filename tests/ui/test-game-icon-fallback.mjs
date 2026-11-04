import assert from 'node:assert/strict'
import { koppelSpelIcoonFallback, spelIcoonHtml, VERSIE } from '../../spelicoon.js'

class Node {
  constructor(tag, doc) { this.tagName=tag.toUpperCase(); this.ownerDocument=doc; this.children=[]; this.parentNode=null; this.attrs=new Map(); this.style={}; this.listeners=new Map(); this.textContent='' }
  setAttribute(name,value) { this.attrs.set(name,String(value)) }
  getAttribute(name) { return this.attrs.get(name) ?? null }
  append(...nodes) { for(const node of nodes){node.parentNode=this;this.children.push(node)} }
  contains(other) { return other===this||this.children.some(node=>node.contains(other)) }
  querySelectorAll(tag) { return this.children.flatMap(node=>[...(node.tagName.toLowerCase()===tag?[node]:[]),...node.querySelectorAll(tag)]) }
  addEventListener(type,callback,capture) { const handlers=this.listeners.get(type)||new Map();handlers.set(callback,capture);this.listeners.set(type,handlers) }
  removeEventListener(type,callback,capture) { assert.equal(this.listeners.get(type)?.get(callback),capture);this.listeners.get(type)?.delete(callback) }
  error(target) { for(const [callback,capture] of [...this.listeners.get('error')||[]]){assert.equal(capture,true,'image errors are captured, even though they do not bubble');callback({target})} }
  replaceWith(node) { const at=this.parentNode.children.indexOf(this);node.parentNode=this.parentNode;this.parentNode.children[at]=node;this.parentNode=null }
  getBoundingClientRect() { return this.rect||{width:0,height:0} }
}
function fixture(baseURI='http://127.0.0.1:8127/index.html') {
  const doc=new Node('document');doc.nodeType=9;doc.baseURI=baseURI;doc.createElement=tag=>new Node(tag,doc)
  function image(src,{complete=false,naturalWidth=0,width=40,height=40,rect}={}) {
    const img=doc.createElement('img');if(src!==null)img.setAttribute('src',src);Object.assign(img,{complete,naturalWidth,width,height,rect});return img
  }
  return {doc,image}
}

// An already-broken icon becomes a decorative reserve of exactly its rendered
// size. Successful assets remain the actual game artwork.
{
  const {doc,image}=fixture(),bad=image('spelicoon/schaken.webp?v=2',{complete:true,rect:{width:38.5,height:26.25}}),good=image('spelicoon/shmup.webp?v=2',{complete:true,naturalWidth:128})
  doc.append(bad,good)
  const cleanup=koppelSpelIcoonFallback(doc)
  const reserve=doc.children[0]
  assert.equal(reserve.tagName,'SPAN');assert.equal(reserve.textContent,'♟️')
  assert.equal(reserve.getAttribute('aria-hidden'),'true');assert.equal(reserve.getAttribute('data-spelicoon'),'schaken')
  assert.equal(reserve.style.width,'38.5px');assert.equal(reserve.style.height,'26.25px')
  assert.equal(doc.children[1],good,'a loaded WebP is not replaced')
  assert.equal(bad.parentNode,null)
  cleanup()
}

// The listener handles dynamic game widgets, only once, and leaves user images,
// foreign origins, similarly named directories and unknown games untouched.
{
  const {doc,image}=fixture(),cleanup=koppelSpelIcoonFallback(doc)
  const icon=image('/spelicoon/pong.webp?v=42',{width:26,height:26});doc.append(icon);doc.error(icon)
  assert.equal(doc.children[0].textContent,'🏓');assert.equal(doc.children[0].style.width,'26px')
  const original=doc.children[0];doc.error(icon);doc.error(original);assert.equal(doc.children[0],original,'no retry/replacement loop')
  const paths=['avatars/me.webp','https://other.example/spelicoon/pong.webp','spelicoon/unknown.webp','images/spelicoon/pong.webp','spelicoon/pong.webp.png','data:image/webp;base64,AA==','javascript:alert(1)','http://[invalid',null,'http://user:secret@127.0.0.1:8127/spelicoon/pong.webp']
  for(const src of paths){const img=image(src,{complete:true});doc.append(img);doc.error(img);assert.equal(img.parentNode,doc,'unrelated or malformed image is untouched: '+src)}
  cleanup()
}

// Multiple views can mount safely without duplicate listeners; cleanup is
// idempotent, and remount scans missed errors without changing asset versions.
{
  const {doc,image}=fixture(),first=koppelSpelIcoonFallback(doc),second=koppelSpelIcoonFallback(doc)
  assert.equal(first,second);assert.equal(doc.listeners.get('error').size,1)
  first();second();assert.equal(doc.listeners.get('error').size,0)
  const missed=image('./spelicoon/shmup.webp?v=2',{complete:true,width:NaN,height:0});doc.append(missed);doc.error(missed);assert.equal(doc.children[0],missed)
  const cleanup=koppelSpelIcoonFallback(doc);assert.equal(doc.children[0].textContent,'🚀');assert.equal(doc.children[0].style.width,'32px');assert.equal(doc.children[0].style.height,'32px')
  cleanup();assert.equal(VERSIE,2);assert.match(spelIcoonHtml('pong',40),/^<img src="spelicoon\/pong\.webp\?v=2"/)
}

// A scoped view cannot touch a neighbouring profile, and root-relative paths
// also work when the app is hosted in a subdirectory.
{
  const {doc,image}=fixture('https://example.test/Fibro/profiel.html'),view=doc.createElement('section'),outside=doc.createElement('section');doc.append(view,outside)
  const mine=image('/Fibro/spelicoon/vieroprij.webp'),other=image('spelicoon/vieroprij.webp');view.append(mine);outside.append(other)
  const cleanup=koppelSpelIcoonFallback(view);view.error(other);assert.equal(other.parentNode,outside)
  view.error(mine);assert.equal(view.children[0].textContent,'🔴');cleanup()
}
assert.doesNotThrow(()=>koppelSpelIcoonFallback(null)())
console.log('PASS: local game-icon fallback, already-failed and dynamic assets, preserved dimensions, unrelated images, scoped mounting and complete cleanup.')
