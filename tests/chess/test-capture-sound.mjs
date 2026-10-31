import assert from 'node:assert/strict'
import { renderCaptureSound } from '../../schaak-slaggeluid.js'
import { capturePiece, schaak } from '../../bordgeluid.js'

class Param {
  value = 0
  events = []
  setValueAtTime(value, time) { this.events.push({ value, time }) }
  exponentialRampToValueAtTime(value, time) { assert(value>0); this.events.push({ value, time }) }
}
class AudioNode {
  constructor(kind) { this.kind=kind; this.gain=new Param(); this.frequency=new Param(); this.Q=new Param(); this.connections=[]; this.stopped=false }
  connect(node) { this.connections.push(node); return node }
  disconnect() { this.disconnected=true }
  start(time) { this.startTime=time }
  stop(time) { this.stopTime=time }
}
class AudioContext {
  currentTime = 3
  sampleRate = 8000
  destination = {}
  nodes = []
  state = 'running'
  create(kind) { const node=new AudioNode(kind);this.nodes.push(node);return node }
  createGain() { return this.create('gain') }
  createBiquadFilter() { return this.create('filter') }
  createBufferSource() { return this.create('noise') }
  createOscillator() { return this.create('oscillator') }
  createDynamicsCompressor() { const node=this.create('compressor');for(const key of ['threshold','knee','ratio','attack','release'])node[key]=new Param();return node }
  createBuffer(channels,length,rate) { assert.equal(channels,1);assert.equal(rate,this.sampleRate);const data=new Float32Array(length);return {getChannelData:()=>data} }
}

for(const outcome of ['win','loss']) {
  let previousDuration=0
  for(const value of [1,3,5,9]) {
    const context=new AudioContext()
    const result=renderCaptureSound(context,{value,outcome},4)
    assert.ok(result.duration>previousDuration,'valuable captures have a longer physical body')
    previousDuration=result.duration
    const sources=context.nodes.filter(node=>['oscillator','noise'].includes(node.kind))
    assert.ok(sources.length>=3,'impact, body and harmonic resonance are present')
    for(const source of sources) {
      assert(source.startTime>=4)
      assert(source.stopTime>source.startTime && source.stopTime<(outcome==='win'?6.2:5.6),'every source has a bounded tail')
      if(outcome==='loss')for(const event of source.frequency.events)assert(event.value<300,'loss voices retain their dark low-frequency impact')
      if(outcome==='win'&&source.kind==='oscillator'){assert.equal(source.frequency.events.length,1,'chime modes ring at fixed pitches instead of electronic pitch sweeps');assert.equal(source.type,'sine');assert(source.frequency.events[0].value<=4500)}
    }
    const limiter=context.nodes.find(node=>node.kind==='compressor')
    assert(limiter && limiter.ratio.value>=4,'the sound has headroom and peak compression')
    const noise=context.nodes.find(node=>node.kind==='noise').buffer.getChannelData(0)
    assert(noise.some(sample=>sample!==0),'the material impact is real non-silent noise')
    assert(noise.every(Number.isFinite))
    for(const source of sources) source.onended()
    assert(context.nodes.every(node=>node.disconnected),'all sources, envelopes, filters and output nodes are released')
  }
}

// One bar has multiple non-harmonic partials with shorter upper-mode tails.
const bell=new AudioContext()
renderCaptureSound(bell,{value:1,outcome:'win'})
const modes=bell.nodes.filter(node=>node.kind==='oscillator').sort((a,b)=>a.frequency.events[0].value-b.frequency.events[0].value)
assert(modes.length>=3,'a chime has several resonant modes')
const ratio=modes[1].frequency.events[0].value/modes[0].frequency.events[0].value
assert(Math.abs(ratio-Math.round(ratio))>.1,'the modal spectrum differs from a plain harmonic UI oscillator')
assert(modes[0].stopTime>modes[1].stopTime&&modes[1].stopTime>modes[2].stopTime,'high partials decay before the fundamental')

const positive=new AudioContext(), negative=new AudioContext()
renderCaptureSound(positive,{value:9,outcome:'win'})
renderCaptureSound(negative,{value:9,outcome:'loss'})
const frequencies=context=>context.nodes.filter(node=>node.kind==='oscillator').flatMap(node=>node.frequency.events.map(event=>event.value))
assert.notDeepEqual(frequencies(positive),frequencies(negative),'queen reward and queen loss have different harmony and pitch envelopes')
const wood=new AudioContext(), classic=new AudioContext()
renderCaptureSound(wood,{value:5,outcome:'loss',theme:'wood'})
renderCaptureSound(classic,{value:5,outcome:'loss',theme:'classic'})
assert(wood.nodes.find(node=>node.kind==='filter').frequency.events[0].value<classic.nodes.find(node=>node.kind==='filter').frequency.events[0].value,'the wooden material is more damped')
const invalid=new AudioContext()
for(const config of [{value:0,outcome:'win'},{value:9,outcome:'neutral'},{value:'9',outcome:'loss'},{}])assert.equal(renderCaptureSound(invalid,config),false)
assert.equal(invalid.nodes.length,0)

let preference='uit', constructions=0, active
globalThis.localStorage={getItem:()=>preference}
globalThis.window={AudioContext:class extends AudioContext {constructor(){super();constructions++;active=this}}}
assert.equal(capturePiece({value:9,outcome:'win'}),false)
assert.equal(constructions,0,'mute is checked before creating audio hardware')
preference='aan'
assert.equal(capturePiece({value:5,outcome:'loss'}),true)
assert.equal(constructions,1)
let checks=0
const engine={isSchaakmat(){checks++;return false},isPat:()=>false,staatInSchaak:()=>false}
const state={aanZet:'z',bord:Array.from({length:8},()=>Array(8).fill(null))}
active.nodes=[]
schaak(engine,state,{type:'slag'},'w','wood',{value:9,outcome:'win'})
assert.equal(checks,1,'capture audio still advances the existing outcome/promotion selector')
assert(active.nodes.filter(node=>node.kind==='oscillator').every(node=>node.frequency.events.length===1),'the graded chime is not mixed with the legacy pitched check/promotion effects')
preference='uit';active.nodes=[]
schaak(engine,state,{type:'slag'},'w','classic',{value:9,outcome:'loss'})
assert.equal(active.nodes.length,0,'the game capture route respects mute too')

console.log('PASS: weighted physical capture voices, win/loss harmony, bounded envelopes/peaks, source cleanup, themes, mute and single-effect chess dispatch.')
