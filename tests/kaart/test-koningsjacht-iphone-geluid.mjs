// Koningsjacht op de iPhone (14 nov 2026, Marcel: "het geluid werkt niet op de iPhone").
// 1. Staat de iPhone op stil, dan bleef Web Audio stil. Nu zegt Koningsjacht (alleen als de tafel .kj in beeld is)
//    tegen iOS dat het geluid 'afspelen' is (navigator.audioSession.type = 'playback'); buiten het spel weer 'auto'.
// 2. Een iPhone zet het geluid soms op 'interrupted' (niet 'suspended'). Ook dan gaat het bij een tik weer aan.
// Gaat mis op koningsjacht-geluid.js v3, goed vanaf v4.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../../koningsjacht-geluid.js', import.meta.url), 'utf8')
class Param { constructor(v = 0) { this.value = v } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} cancelScheduledValues() {} }
class Node {
  constructor() { for (const n of ['gain', 'frequency', 'detune', 'Q', 'threshold', 'ratio', 'attack', 'release']) this[n] = new Param() }
  connect(n) { return n } disconnect() {} start() {} stop() {}
}
let context = null, resumes = 0
class Audio {
  constructor() { context = this; this.currentTime = 0; this.sampleRate = 4000; this.state = 'running'; this.destination = new Node() }
  createDynamicsCompressor() { return new Node() } createGain() { return new Node() } createConvolver() { return new Node() }
  createBiquadFilter() { return new Node() } createWaveShaper() { return new Node() } createOscillator() { return new Node() }
  createBufferSource() { return new Node() }
  createBuffer(c, len, sr) { const d = Array.from({ length: c }, () => new Float32Array(len)); return { length: len, sampleRate: sr, getChannelData: k => d[k] } }
  async resume() { resumes++; this.state = 'running' }
  async suspend() { this.state = 'suspended' }
}
const luisteraars = {}
let tafelInBeeld = true
const document = {
  addEventListener(soort, fn) { (luisteraars[soort] = luisteraars[soort] || []).push(fn) },
  querySelector: sel => (sel === '.kj' && tafelInBeeld ? {} : null),
}
const tik = () => { for (const fn of luisteraars.pointerdown || []) fn({}) }
const window = new EventTarget(); window.AudioContext = Audio
const navigator = { audioSession: { type: 'auto' } }
const sandbox = vm.createContext({
  window, document, navigator, Float32Array, Math, Map, Set,
  localStorage: { getItem: () => null, setItem() {} },
  setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
})
vm.runInContext(source.replace(/^export /gm, '') + '\nglobalThis.api = { speel, geluidStaat };', sandbox)
const { api } = sandbox

// 1. Een tik op de tafel van Koningsjacht: geluid ook als de iPhone op stil staat
tik()
assert.equal(navigator.audioSession.type, 'playback', 'in Koningsjacht: audioSession playback (geluid ook met het stil-schuifje)')
assert.ok(context, 'na een tik is er een geluid')

// 2. 'interrupted' (bijvoorbeeld na een melding of een telefoontje): de volgende tik zet het weer aan
context.state = 'interrupted'; resumes = 0
tik()
await Promise.resolve()
assert.ok(resumes >= 1 && context.state === 'running', 'na interrupted gaat het geluid bij een tik weer aan')
context.state = 'interrupted'; resumes = 0
api.speel('tik')
assert.ok(resumes >= 1, 'ook een geluid van het spel zelf probeert het weer aan te zetten')

// 3. Buiten het spel: weer gewoon (het stil-schuifje telt dan weer)
tafelInBeeld = false
tik()
assert.equal(navigator.audioSession.type, 'auto', 'buiten Koningsjacht: audioSession weer auto')

// 4. Zonder audioSession (Android, oudere iPhone) gaat er niets mis
delete navigator.audioSession
tafelInBeeld = true
tik()
assert.equal(api.geluidStaat(), 'running')

console.log('koningsjacht iPhone-geluid: ok')
