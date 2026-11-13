import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Exercise the real scheduler and audio routing without devices or wall time.
const source = readFileSync(new URL('../../koningsjacht-geluid.js', import.meta.url), 'utf8')
const nodes = [], sources = [], intervals = new Map(), timeouts = new Map(), storage = new Map()
let id = 0, context, resumeCount = 0, writes = 0
class Param {
  constructor(value = 0) { this.value = value; this.events = [] }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]) }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['linear', value, time]) }
  exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push(['exp', value, time]) }
  cancelScheduledValues(time) { this.events.push(['cancel', time]) }
}
class Node {
  constructor(kind) {
    this.kind = kind; this.connections = []; this.stops = []
    for (const name of ['gain', 'frequency', 'detune', 'Q', 'threshold', 'ratio', 'attack', 'release']) this[name] = new Param()
    nodes.push(this)
  }
  connect(node) { this.connections.push(node); return node }
  disconnect() { this.disconnected = true }
  start(time) { this.started = time; sources.push(this) }
  stop(time) { this.stops.push(time) }
}
class Audio {
  constructor() { context = this; this.currentTime = 0; this.sampleRate = 4000; this.state = 'running'; this.destination = new Node('destination') }
  createDynamicsCompressor() { return new Node('compressor') }
  createGain() { return new Node('gain') }
  createConvolver() { return new Node('convolver') }
  createBiquadFilter() { return new Node('filter') }
  createWaveShaper() { return new Node('shaper') }
  createOscillator() { return new Node('oscillator') }
  createBufferSource() { return new Node('bufferSource') }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length:channels }, () => new Float32Array(length))
    return { length, sampleRate, getChannelData:channel => data[channel] }
  }
  async resume() { this.state = 'running'; resumeCount++ }
  async suspend() { this.state = 'suspended' }
}
const window = new EventTarget()
window.AudioContext = Audio
const sandbox = vm.createContext({
  window, Float32Array, Math, Map, Set,
  localStorage: { getItem:key => storage.get(key) ?? null, setItem(key, value) { writes++; storage.set(key, value) } },
  setInterval(fn) { const key = ++id; intervals.set(key, fn); return key },
  clearInterval:key => intervals.delete(key),
  setTimeout(fn, ms) { const key = ++id; timeouts.set(key, { fn, ms }); return key },
  clearTimeout:key => timeouts.delete(key)
})
vm.runInContext(source.replace(/^export /gm, '') + '\nglobalThis.api = { zetMuziekThema, zetMuziek, startMuziek, stopMuziek, speeltMuziek, muziekStaatAan, speel };', sandbox)
const { api } = sandbox

assert.equal(api.zetMuziekThema('middeleeuws'), 'middeleeuws')
assert.equal(nodes.length, 0, 'changing the scene does not create/unlock an audio context')
assert.equal(api.speeltMuziek(), false)
assert.equal(intervals.size, 0)
assert.equal(writes, 0, 'scene does not overwrite the stored music preference')
assert.equal(api.zetMuziekThema('standaard'), 'standaard')
api.zetMuziek(true)
assert.equal(api.speeltMuziek(), true)
assert.equal(api.muziekStaatAan(), true)
assert.equal(intervals.size, 1)
assert.ok(sources.some(node => node.type === 'sawtooth'), 'default keeps its existing string/bass arrangement')
const oldSources = [...sources], oldNodes = [...nodes], writeCount = writes
const beforeSwitch = sources.length
api.zetMuziekThema('middeleeuws')
assert.equal(intervals.size, 1, 'there is only one active scheduler after switching')
assert.equal(writes, writeCount)
assert.equal(api.muziekStaatAan(), true)
assert.ok(oldSources.every(node => node.stops.at(-1) <= context.currentTime + .65), 'all scheduled old notes stop after the short fade')
const medieval = sources.slice(beforeSwitch)
assert.ok(medieval.some(node => node.kind === 'bufferSource' && node.buffer.length > context.sampleRate), 'the lute uses decaying plucked-string buffers')
assert.ok(medieval.some(node => node.kind === 'oscillator' && node.type === 'sine'), 'flute harmonics and frame drum are scheduled')
assert.equal(medieval.some(node => node.type === 'sawtooth'), false, 'the medieval arrangement does not retain the epic strings/hoorns')
assert.ok(medieval.some(node => node.kind === 'bufferSource' && node.buffer.length < context.sampleRate), 'tambourine noise joins the rhythm')
const count = sources.length
api.zetMuziekThema('middeleeuws')
assert.equal(sources.length, count, 'selecting the same scene does not restart the tune')
for (const { fn } of timeouts.values()) fn()
assert.ok(oldNodes.some(node => node.disconnected), 'retired music buses disconnect')
assert.ok(medieval.every(node => !node.disconnected), 'late cleanup does not disconnect the new arrangement')

context.currentTime = 2.5
for (const fn of intervals.values()) fn()
assert.ok(sources.length > count, 'the medieval dance continues through later measures')
api.speel('pakken')
const effect = sources.slice(-7), effectStops = effect.map(node => node.stops.length)
api.zetMuziekThema('standaard')
assert.deepEqual(effect.map(node => node.stops.length), effectStops, 'theme changes leave game sound effects alone')
assert.equal(intervals.size, 1)

window.dispatchEvent(Object.assign(new Event('fibro-spel-pauze'), { detail:{ aan:true } }))
assert.equal(context.state, 'suspended')
const resumes = resumeCount
api.zetMuziekThema('middeleeuws')
assert.equal(context.state, 'suspended', 'scene switching respects game pause')
assert.equal(resumeCount, resumes)
assert.equal(intervals.size, 1)

api.zetMuziek(false)
assert.equal(api.speeltMuziek(), false)
assert.equal(api.muziekStaatAan(), false)
assert.equal(intervals.size, 0)
api.zetMuziekThema('standaard')
assert.equal(intervals.size, 0, 'theme change respects music off')
assert.equal(api.speeltMuziek(), false)
assert.equal(api.zetMuziekThema('invalid'), 'standaard')

// Visibility/leave can stop the player while its saved preference remains on.
api.zetMuziek(true)
api.stopMuziek()
assert.equal(api.muziekStaatAan(), true)
api.zetMuziekThema('middeleeuws')
assert.equal(api.speeltMuziek(), false, 'a stopped/hidden game cannot be restarted by scene selection')
assert.equal(intervals.size, 0)
console.log('Koningsjacht music themes: distinct lute/flute/tambourine arrangement, preference, pause, scheduling and cleanup pass')
