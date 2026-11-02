import assert from 'node:assert/strict'
import { evaluationSoundProfile, renderEvaluationSound } from '../../schaak-evaluatiegeluid.js'
import { capturePiece, geluid, knop, maakSchaakAnalyseGeluid, previewSchaakGeluid } from '../../bordgeluid.js'

const clock = {
    now: 3, next: 0, timers: new Map(), contexts: [],
    set(fn, ms = 0) { const id = ++this.next; this.timers.set(id, { fn, at:this.now + ms / 1000 }); return id },
    advance(ms) {
        const until = this.now + ms / 1000
        let steps = 0
        while (true) {
            assert(++steps < 1000, 'the scheduler cannot spin on zero-delay timers')
            const sources = this.contexts.flatMap(c => c.nodes).filter(n => !n.ended && n.stopTime !== undefined)
            const next = Math.min(...[...this.timers.values()].map(t => t.at), ...sources.map(n => n.stopTime))
            if (next > until) break
            this.now = next
            for (const node of sources) if (node.stopTime <= next) { node.ended = true; node.onended?.() }
            const due = [...this.timers].filter(([, t]) => t.at <= next)
            for (const [id, task] of due) if (this.timers.delete(id)) task.fn()
        }
        this.now = until
    }
}
class Param {
    value = 0
    events = []
    setValueAtTime(value, time) { this.events.push({ value, time }) }
    exponentialRampToValueAtTime(value, time) { assert(value > 0); this.events.push({ value, time }) }
    cancelScheduledValues(time) { this.events = this.events.filter(event => event.time < time) }
}
class AudioNode {
    constructor(kind) { this.kind = kind; this.gain = new Param(); this.frequency = new Param(); this.Q = new Param() }
    connect(node) { return node }
    disconnect() { this.disconnected = true }
    start(time) { this.startTime = time }
    stop(time) { this.stopTime = time }
}
class AudioContext {
    sampleRate = 8000
    destination = {}
    nodes = []
    state = 'running'
    constructor() { clock.contexts.push(this) }
    get currentTime() { return clock.now }
    create(kind) { const node = new AudioNode(kind); this.nodes.push(node); return node }
    createGain() { return this.create('gain') }
    createBiquadFilter() { return this.create('filter') }
    createBufferSource() { return this.create('noise') }
    createOscillator() { return this.create('oscillator') }
    createDynamicsCompressor() {
        const node = this.create('compressor')
        for (const key of ['threshold','knee','ratio','attack','release']) node[key] = new Param()
        return node
    }
    createBuffer(channels, length, rate) {
        assert.equal(channels, 1); assert.equal(rate, this.sampleRate)
        const samples = new Float32Array(length)
        return { getChannelData:() => samples }
    }
}
const sources = nodes => nodes.filter(node => ['oscillator','noise'].includes(node.kind))
const endOf = node => node.stopTime ?? node.startTime + node.buffer.getChannelData(0).length / 8000
const complete = context => { for (const node of sources(context.nodes)) { node.ended = true; node.onended?.() } }

for (const invalid of [0, NaN, Infinity, -Infinity, null, undefined, '100']) {
    assert.equal(evaluationSoundProfile(invalid), null)
    const context = new AudioContext()
    assert.equal(renderEvaluationSound(context, { deltaCp:invalid }), false)
    assert.equal(context.nodes.length, 0)
}
for (const [delta, tier] of [[1,0],[49,0],[50,1],[149,1],[150,2],[10000,2],[-10000,2]]) {
    assert.equal(evaluationSoundProfile(delta).tier, tier)
}
for (const sign of [1, -1]) {
    let previousDuration = 0, previousPeak = 0
    for (const delta of [25, 100, 300]) {
        const context = new AudioContext()
        let ended = 0
        const result = renderEvaluationSound(context, { deltaCp:sign * delta, onended:() => ended++ }, 4)
        assert(result.duration > previousDuration && result.peak > previousPeak, 'larger swings make a longer, fuller swell')
        previousDuration = result.duration; previousPeak = result.peak
        assert(result.end < 5 && result.peak <= .075, 'magnitude has a strict duration/volume ceiling')
        const oscillators = context.nodes.filter(node => node.kind === 'oscillator')
        assert.equal(oscillators.length, 3)
        assert(oscillators.some(node => node.type === 'triangle'), 'the warm harmonic pad differs from capture chimes')
        for (const node of oscillators) {
            const [from, to] = node.frequency.events
            assert.equal(node.frequency.events.length, 2, 'each strand glides once, without repeated notes')
            assert.equal(Math.sign(to.value - from.value), sign)
            assert(from.value < 500 && to.value < 500, 'the voice remains in a warm low register')
        }
        for (const node of sources(context.nodes)) assert(node.startTime === 4 && node.stopTime <= result.end)
        const envelopes = context.nodes.filter(node => node.kind === 'gain' && node.gain.events.length === 3)
        assert(envelopes.length >= 4)
        assert(envelopes.every(node => node.gain.events[1].time - 4 > .1), 'a gradual breath replaces a struck/chime attack')
        assert(context.nodes.some(node => node.kind === 'compressor' && node.ratio.value >= 4))
        const wind = context.nodes.find(node => node.kind === 'noise').buffer.getChannelData(0)
        assert(wind.some(value => value !== 0) && wind.every(Number.isFinite))
        complete(context)
        assert(context.nodes.every(node => node.disconnected), 'all sources, filters, envelopes and outputs are released')
        assert.equal(ended, 1)
        complete(context)
        assert.equal(ended, 1, 'cleanup is idempotent')
    }
}
const cancelled = new AudioContext()
const cancelVoice = renderEvaluationSound(cancelled, { deltaCp:10000 })
assert.equal(cancelVoice.cancel(), clock.now + .012)
assert(sources(cancelled.nodes).every(node => node.stopTime === clock.now + .012))
complete(cancelled)
assert(cancelled.nodes.every(node => node.disconnected))

let preference = 'uit', active, constructions = 0
globalThis.localStorage = { getItem:() => preference, setItem:(key, value) => { preference = value } }
globalThis.window = { AudioContext:class extends AudioContext { constructor() { super(); active = this; constructions++ } } }
const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout
globalThis.setTimeout = (fn, ms) => clock.set(fn, ms)
globalThis.clearTimeout = id => clock.timers.delete(id)
try {
    const muted = maakSchaakAnalyseGeluid()
    assert.equal(muted.speel(100), false)
    assert.equal(constructions, 0, 'mute is checked before requesting audio hardware')
    muted.destroy()
    preference = 'aan'
    const queue = maakSchaakAnalyseGeluid()
    assert.equal(queue.speel(NaN), false)
    assert.equal(queue.speel(0), false)
    assert.equal(constructions, 0)
    assert.equal(queue.speel(25), true)
    assert.equal(clock.timers.size, 1)
    clock.advance(0)
    assert.equal(sources(active.nodes).length, 4)
    const initial = sources(active.nodes)
    clock.advance(100)
    queue.speel(-100)
    queue.speel(300)
    assert.equal(clock.timers.size, 1, 'repeated results keep only one timer and latest delta')
    clock.advance(1500)
    const latest = sources(active.nodes).filter(node => !initial.includes(node))
    assert.equal(latest.length, 4, 'only the newest queued result is played')
    assert(latest[0].frequency.events[1].value > latest[0].frequency.events[0].value)
    assert(Math.abs(latest[0].stopTime - latest[0].startTime - .925) < .00001, 'the newest large tier wins')
    queue.annuleer(); clock.advance(1000)

    // The longest graded chime must finish, including its reserved tail.
    let mark = active.nodes.length
    capturePiece({ value:9, outcome:'win' })
    const capture = sources(active.nodes.slice(mark))
    mark = active.nodes.length
    queue.speel(-100)
    clock.advance(2000)
    assert.equal(active.nodes.length, mark, 'analysis waits through a queen capture')
    clock.advance(250)
    const afterCapture = sources(active.nodes.slice(mark))
    assert.equal(afterCapture.length, 4)
    assert(afterCapture[0].startTime > Math.max(...capture.map(node => node.stopTime)) + .05)
    queue.annuleer(); clock.advance(1500)

    // A second piece arriving while a result is queued extends the wait.
    capturePiece({ value:1, outcome:'loss' })
    queue.speel(25)
    clock.advance(100)
    mark = active.nodes.length
    geluid('verlies')
    const secondPiece = sources(active.nodes.slice(mark))
    mark = active.nodes.length
    clock.advance(1000)
    assert.equal(active.nodes.length, mark)
    clock.advance(400)
    const postponed = sources(active.nodes.slice(mark))
    assert.equal(postponed.length, 4)
    assert(postponed[0].startTime > Math.max(...secondPiece.map(endOf)))
    queue.annuleer(); clock.advance(1500)

    // Piece priority works in the opposite direction as well.
    mark = active.nodes.length
    queue.speel(300); clock.advance(0); clock.advance(200)
    const interrupted = sources(active.nodes.slice(mark))
    mark = active.nodes.length
    capturePiece({ value:1, outcome:'win' })
    const interruptingPiece = sources(active.nodes.slice(mark))
    assert(Math.max(...interrupted.map(node => node.stopTime)) < Math.min(...interruptingPiece.map(node => node.startTime)), 'the fade finishes before the next piece starts')
    mark = active.nodes.length
    queue.speel(-100)
    clock.advance(1600)
    const replacement = sources(active.nodes.slice(mark))
    assert.equal(replacement.length, 4, 'the interrupted stale voice is discarded')
    assert(replacement[0].startTime > Math.max(...interruptingPiece.map(node => node.stopTime)))
    queue.annuleer(); clock.advance(1500)

    // Every legacy cue also reserves its full oscillator/noise lifetime.
    for (const name of ['zet','damzet','slag','rokade','schaak','promotie','win','verlies','remise']) {
        mark = active.nodes.length
        geluid(name)
        const piece = sources(active.nodes.slice(mark))
        mark = active.nodes.length
        queue.speel(25); clock.advance(2000)
        const evaluation = sources(active.nodes.slice(mark))
        assert.equal(evaluation.length, 4, name)
        assert(evaluation[0].startTime > Math.max(...piece.map(endOf)), name)
        queue.annuleer(); clock.advance(1000)
    }
    mark = active.nodes.length
    previewSchaakGeluid('wood')
    const wooden = sources(active.nodes.slice(mark))
    mark = active.nodes.length
    queue.speel(25); clock.advance(1000)
    assert(sources(active.nodes.slice(mark))[0].startTime > Math.max(...wooden.map(endOf)))
    queue.annuleer(); clock.advance(1000)

    capturePiece({ value:9, outcome:'win' }); queue.speel(25)
    const other = maakSchaakAnalyseGeluid()
    other.speel(100)
    assert.equal(clock.timers.size, 2)
    queue.annuleer()
    assert.equal(clock.timers.size, 1, 'cancellation is scoped to one board')
    other.destroy()
    assert.equal(clock.timers.size, 0)
    assert.equal(other.speel(100), false, 'destroyed boards can never enqueue more audio')
    clock.advance(3000)

    capturePiece({ value:9, outcome:'win' }); queue.speel(100)
    mark = active.nodes.length
    preference = 'uit'
    clock.advance(3000)
    assert.equal(active.nodes.length, mark, 'global mute is checked again when a queued result becomes playable')
    preference = 'aan'
    clock.advance(1000)
    assert.equal(active.nodes.length, mark, 'muted queued results never leak out after unmuting')

    const button = { style:{}, addEventListener(name, fn) { this[name] = fn } }
    globalThis.document = { createElement:() => button, addEventListener() {} }
    knop({ parentElement:{}, insertAdjacentElement() {} })
    mark = active.nodes.length
    queue.speel(300); clock.advance(0); clock.advance(100)
    const playing = sources(active.nodes.slice(mark))
    queue.speel(-100)
    button.click()
    assert.equal(preference, 'uit')
    assert.equal(clock.timers.size, 0, 'the global sound button cancels pending analysis too')
    assert(playing.every(node => node.stopTime <= clock.now + .012), 'the global sound button also silences active analysis')
    queue.destroy(); clock.advance(2000)
    assert.equal(clock.timers.size, 0)
} finally {
    globalThis.setTimeout = originalSet
    globalThis.clearTimeout = originalClear
}

console.log('PASS: distinct graded evaluation swells, bounded peaks/tails and cleanup, piece-first scheduling in both directions, coalescing, scoped cancellation/disposal and global mute.')
