import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Run the production module with browser/WebRTC doubles. No real devices,
// Supabase requests, browser permissions, or wall-clock delays are used.
const source = readFileSync(new URL('../../bellen.js', import.meta.url), 'utf8')
const exports = [...source.matchAll(/^export (?:async )?function (\w+)/gm)].map(match => match[1])
const script = source.replace(/^import .*$/gm, '').replace(/^export /gm, '') +
  '\nglobalThis.api = { ' + exports.join(', ') + ' };'
const settle = async () => { for (let i = 0; i < 32; i++) await Promise.resolve() }

function fakeClock() {
  let now = 100000, nextId = 0
  const tasks = new Map()
  return {
    now: () => now,
    setTimeout(fn, delay = 0) { const id = ++nextId; tasks.set(id, { fn, at: now + delay }); return id },
    clearTimeout(id) { tasks.delete(id) },
    async advance(ms) {
      const end = now + ms
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0]
        if (!next || next[1].at > end) break
        now = next[1].at
        tasks.delete(next[0])
        next[1].fn()
        await settle()
      }
      now = end
      await settle()
    }
  }
}

let nextTrack = 0
class Track extends EventTarget {
  constructor(kind, { muted = false } = {}) {
    super()
    this.id = kind + '-' + ++nextTrack
    this.kind = kind
    this.enabled = true
    this.muted = muted
    this.readyState = 'live'
  }
  stop() { this.readyState = 'ended' }
  getSettings() { return { deviceId: this.id, facingMode: 'user' } }
  setMuted(value) { this.muted = value; this.fire(value ? 'mute' : 'unmute') }
  end() { this.stop(); this.fire('ended') }
  fire(type) { this.dispatchEvent(new Event(type)); this['on' + type]?.(new Event(type)) }
}

class Stream extends EventTarget {
  constructor(tracks = []) { super(); this.tracks = [...tracks] }
  getTracks() { return [...this.tracks] }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video') }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio') }
  addTrack(track) { if (!this.tracks.includes(track)) this.tracks.push(track) }
  removeTrack(track) { this.tracks = this.tracks.filter(item => item !== track) }
}

function mediaElement() {
  const element = new EventTarget()
  return Object.assign(element, {
    srcObject: null, muted: false, autoplay: false, playsInline: false,
    style: {}, playCount: 0, rejectPlay: false, paused: true,
    setAttribute(name, value) { this[name] = value },
    removeAttribute(name) { delete this[name] },
    async play() {
      this.playCount++
      if (this.rejectPlay) throw Object.assign(new Error('A gesture is required'), { name: 'NotAllowedError' })
      this.paused = false
      this.dispatchEvent(new Event('playing'))
    },
    pause() { this.paused = true }
  })
}

function setup(userId = 'a') {
  const clock = fakeClock(), channels = [], signals = [], peers = [], statuses = []
  const media = Object.fromEntries(['lokaalMedia', 'remoteMedia', 'remoteAudio'].map(id => [id, mediaElement()]))
  let ended = 0, connected = 0, failOffer = false, failCapture = false, failAudioCapture = false, captureWait = null
  class Peer extends EventTarget {
    constructor() {
      super()
      this.connectionState = 'new'
      this.iceConnectionState = 'new'
      this.signalingState = 'stable'
      this.localDescription = null
      this.remoteDescription = null
      this.senders = []
      this.transceivers = []
      this.localDescriptions = []
      this.candidates = []
      this.restartCount = 0
      peers.push(this)
    }
    addTrack(track) {
      const sender = { track, async replaceTrack(value) { this.track = value } }
      this.senders.push(sender)
      return sender
    }
    addTransceiver(kind, options) {
      const transceiver = { sender: this.addTrack(null), receiver: { track: new Track(kind) }, direction: options?.direction }
      this.transceivers.push(transceiver)
      return transceiver
    }
    getSenders() { return this.senders }
    getTransceivers() { return this.transceivers }
    async createOffer() {
      if (failOffer) throw new Error('Negotiation temporarily unavailable')
      return { type: 'offer', sdp: 'test-offer' }
    }
    async createAnswer() { return { type: 'answer', sdp: 'test-answer' } }
    async setLocalDescription(description) {
      this.localDescription = description || { type: 'offer', sdp: 'test-offer' }
      this.localDescriptions.push(this.localDescription)
      this.signalingState = this.localDescription.type === 'offer' ? 'have-local-offer' : 'stable'
      this.onsignalingstatechange?.()
    }
    async setRemoteDescription(description) {
      this.remoteDescription = description
      this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'
      this.onsignalingstatechange?.()
    }
    async addIceCandidate(candidate) { this.candidates.push(candidate) }
    restartIce() { this.restartCount++ }
    close() { this.connectionState = 'closed'; this.onconnectionstatechange?.() }
    state(value) { this.connectionState = value; this.onconnectionstatechange?.() }
    track(track) { this.ontrack?.({ track, streams: [new Stream([track])] }) }
  }
  const supabase = {
    auth: { async getSession() { return { data: { session: null } } } },
    getChannels: () => channels.filter(channel => !channel.removed),
    async removeChannel(channel) { channel.removed = true },
    from() { return { async insert() { return { error: null } } } },
    channel(name) {
      const channel = {
        topic: 'realtime:' + name, handlers: [], removed: false,
        on(type, filter, callback) { this.handlers.push({ type, filter, callback }); return this },
        subscribe(callback) { queueMicrotask(() => callback?.('SUBSCRIBED')); return this },
        async send(message) { signals.push({ name, ...message }); return 'ok' },
        stop() { this.removed = true },
        emit(event, payload) {
          for (const handler of this.handlers.filter(item => item.filter.event === event)) handler.callback({ payload })
        }
      }
      channels.push(channel)
      return channel
    }
  }
  const page = new EventTarget()
  page.getElementById = id => media[id] || null
  const browser = new EventTarget()
  const context = vm.createContext({
    console: { log() {}, warn() {} }, window: browser, document: page,
    navigator: { mediaDevices: {
      async getUserMedia(constraints) {
        if (failCapture || (failAudioCapture && constraints.audio)) throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
        const stream = new Stream([
          ...(constraints.audio ? [new Track('audio')] : []),
          ...(constraints.video ? [new Track('video')] : [])
        ])
        const gate = captureWait
        captureWait = null
        if (gate) { gate.stream = stream; await gate.promise }
        return stream
      },
      async enumerateDevices() { return [{ kind: 'videoinput', deviceId: 'camera' }, { kind: 'audioinput', deviceId: 'mic' }] }
    } },
    Event, EventTarget, MediaStream: Stream, RTCPeerConnection: Peer,
    RTCSessionDescription: class { constructor(value) { Object.assign(this, value) } },
    RTCIceCandidate: class { constructor(value) { Object.assign(this, value) } },
    supabase, ICE_SERVERS: {}, iceReady: Promise.resolve(),
    houOpen(name, factory) { return factory().subscribe() },
    maakBelregel() { return 'test call' }, alert() {},
    // camerafilters.js (v157) staat in deze test altijd op 'geen': dan geeft het filter de rauwe track terug
    maakCameraFilter() { let bron = null; return { zetBron(t) { bron = t || null }, uitTrack() { return bron }, kies() {}, huidig: () => 'geen', nieuwsTekst: () => ({}), zetNieuwsTekst() {} } },
    bouwFilterKiezer() {}, CAMERA_FILTERS: [],
    fetch() { throw new Error('Unexpected network request in media tests') },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    Date: class extends Date { static now() { return clock.now() } }, queueMicrotask
  })
  vm.runInContext(script, context, { filename: 'bellen.js' })
  const api = context.api
  assert.equal(typeof api.getMediaStatus, 'function', 'media status API is exported')
  assert.equal(typeof api.hervatGeluid, 'function', 'manual audio playback recovery is exported')
  api.initBellen(userId, {
    onEind() { ended++ }, onVerbonden() { connected++ },
    onMediaStatus(status) { statuses.push({ ...status }) }
  })
  return {
    api, media, peers, statuses, clock, channels, signals,
    get ended() { return ended }, get connected() { return connected },
    set failOffer(value) { failOffer = value }, set failCapture(value) { failCapture = value },
    set failAudioCapture(value) { failAudioCapture = value },
    delayNextCapture() {
      const gate = { stream: null }
      gate.promise = new Promise(resolve => { gate.release = resolve })
      captureWait = gate
      return gate
    },
    async signal(type, data = {}) {
      const channel = channels.findLast(item => item.topic.startsWith('realtime:belgesprek_') && !item.removed)
      assert.ok(channel, 'a call signaling channel is open')
      channel.emit('signaal', { type, data, v: 999 })
      await settle()
    },
    async startCall() {
      assert.equal(await api.belOp(userId === 'a' ? 'b' : 'a', false, true), true)
      await this.signal('geaccepteerd')
      assert.equal(peers.length, 1)
      return peers[0]
    }
  }
}

{
  const app = setup()
  assert.equal(await app.api.schakelVideo(true), true)
  const track = app.media.lokaalMedia.srcObject.getVideoTracks()[0]
  assert.equal(app.api.getMediaStatus().localVideo, true)
  assert.equal(app.statuses.at(-1).localVideo, true, 'UI is notified before a peer exists')
  const pc = await app.startCall()
  assert.equal(app.media.lokaalMedia.srcObject.getVideoTracks()[0], track, 'call acquisition preserves the camera already visible locally')
  assert.equal(track.readyState, 'live')
  assert.ok(pc.getSenders().some(sender => sender.track === track), 'existing preview is attached to the call')
  assert.equal(app.api.getMediaStatus().localVideo, true)
  app.api.toggleCamera()
  assert.equal(app.api.getMediaStatus().localVideo, false)
  app.api.toggleCamera()
  assert.equal(app.api.getMediaStatus().localVideo, true)
  track.end()
  assert.equal(app.api.getMediaStatus().localVideo, false)
  assert.equal(app.statuses.at(-1).localVideo, false, 'ended local track clears the status')
}

{
  const app = setup(), pc = await app.startCall()
  // Initial offer has not received an answer. Capturing a camera must still
  // succeed immediately; the negotiation can wait for a stable connection.
  assert.equal(pc.signalingState, 'have-local-offer')
  assert.equal(await app.api.schakelVideo(true), true)
  assert.equal(app.api.getMediaStatus().localVideo, true)
  await app.signal('answer', { type: 'answer', sdp: 'test-answer' })
  await settle()
  // A later renegotiation failure must not claim an already live camera is off.
  pc.signalingState = 'stable'
  app.failOffer = true
  assert.equal(await app.api.schakelVideo(true), true)
  assert.equal(app.api.getMediaStatus().localVideo, true)
  assert.equal(app.media.lokaalMedia.srcObject.getVideoTracks()[0].readyState, 'live')
}

{
  const app = setup(), gate = app.delayNextCapture()
  const calling = app.api.belOp('b', false, true)
  await settle()
  assert.ok(gate.stream?.getAudioTracks().length, 'the initial microphone request is still waiting')
  assert.equal(await app.api.schakelVideo(true), true)
  const camera = app.media.lokaalMedia.srcObject.getVideoTracks()[0]
  gate.release()
  assert.equal(await calling, true)
  await app.signal('geaccepteerd')
  const pc = app.peers[0]
  assert.equal(app.api.getMediaStatus().localVideo, true, 'a camera enabled during microphone acquisition remains on')
  assert.equal(app.media.lokaalMedia.srcObject.getVideoTracks()[0], camera, 'the overlapping microphone request must merge the current camera')
  assert.ok(pc.getSenders().some(sender => sender.track === camera), 'the retained camera is sent rather than left as an orphaned live track')
  await app.api.hangOp()
  assert.equal(camera.readyState, 'ended', 'closing the call also releases the overlapping camera')
}

{
  const app = setup(), pc = await app.startCall()
  const remoteVideo = new Track('video', { muted: true })
  pc.track(remoteVideo)
  await settle()
  assert.equal(app.api.getMediaStatus().remoteVideo, false, 'a negotiated but muted video track is not received video')
  remoteVideo.setMuted(false)
  await settle()
  assert.equal(app.api.getMediaStatus().remoteVideo, true)
  assert.equal(app.statuses.at(-1).remoteVideo, true)
  assert.ok(app.signals.some(signal => signal.payload?.type === 'video-ontvangen' && signal.payload.data.actief === true))
  await app.signal('video-status', { actief: false })
  assert.equal(app.api.getMediaStatus().remoteVideo, false, 'camera off signaling hides a frozen last frame')
  remoteVideo.setMuted(true)
  await settle()
  assert.equal(app.api.getMediaStatus().remoteVideo, false)
  assert.equal(app.statuses.at(-1).remoteVideo, false)
  remoteVideo.setMuted(false)
  remoteVideo.end()
  await settle()
  assert.equal(app.api.getMediaStatus().remoteVideo, false)
  assert.ok(app.signals.some(signal => signal.payload?.type === 'video-ontvangen' && signal.payload.data.actief === false))
}

{
  const app = setup(), pc = await app.startCall()
  const audio = new Track('audio')
  app.media.remoteAudio.rejectPlay = true
  pc.track(audio)
  await settle()
  assert.equal(app.api.getMediaStatus().remoteAudio, true, 'received microphone track is distinguished from playback permission')
  assert.equal(app.api.getMediaStatus().audioBlocked, true)
  assert.equal(app.statuses.at(-1).audioBlocked, true, 'UI gets a usable audio permission state')
  assert.equal(app.media.remoteMedia.muted, true, 'remote video must never be a second audio output')
  assert.equal(app.media.lokaalMedia.muted, true, 'local preview must never echo the microphone')
  assert.equal(await app.api.hervatGeluid(), false, 'blocked playback remains recoverable')
  app.media.remoteAudio.rejectPlay = false
  assert.equal(await app.api.hervatGeluid(), true, 'a user gesture can enable playback')
  assert.equal(app.api.getMediaStatus().audioBlocked, false)
  assert.equal(app.media.remoteAudio.muted, false)
  assert.equal(app.media.remoteMedia.muted, true)
  assert.ok(app.media.remoteAudio.playCount < 10, 'playing events must not recursively retry play()')
  audio.setMuted(true)
  assert.equal(app.api.getMediaStatus().remoteAudio, false)
  audio.setMuted(false)
  assert.equal(app.api.getMediaStatus().remoteAudio, true)
  app.api.toggleMic()
  assert.equal(app.api.getMediaStatus().localAudio, false)
  app.api.toggleMic()
  assert.equal(app.api.getMediaStatus().localAudio, true)
}

{
  const app = setup()
  await app.api.schakelVideo(true)
  const pc = await app.startCall()
  pc.state('connected')
  await settle()
  assert.equal(app.api.getMediaStatus().connected, true)
  pc.state('disconnected')
  await app.clock.advance(10000)
  assert.equal(app.ended, 0, 'a temporary network interruption does not immediately hang up')
  assert.equal(app.api.getMediaStatus().localVideo, true)
  pc.state('connected')
  await app.clock.advance(25000)
  assert.equal(app.ended, 0, 'reconnection cancels the pending disconnect teardown')
  assert.equal(app.api.getMediaStatus().connected, true)
  assert.equal(app.api.getMediaStatus().localVideo, true)
  await app.api.hangOp()
  assert.equal(app.ended, 1)
  assert.equal(app.api.getMediaStatus().connected, false)
  assert.equal(app.api.getMediaStatus().localVideo, false)
  assert.equal(app.media.remoteAudio.srcObject, null)
}

{
  const app = setup()
  await app.api.schakelVideo(true)
  const camera = app.media.lokaalMedia.srcObject.getVideoTracks()[0]
  app.failCapture = true
  await app.startCall()
  assert.equal(app.api.getMediaStatus().localVideo, true, 'microphone permission failure preserves an already working camera')
  assert.equal(app.api.getMediaStatus().localAudio, false)
  assert.equal(app.api.getMediaStatus().localAudioAvailable, false)
  assert.equal(camera.readyState, 'live')
}

{
  const app = setup()
  app.failAudioCapture = true
  const pc = await app.startCall()
  assert.equal(app.api.getMediaStatus().localAudioAvailable, false, 'microphone denial still allows a receive-only call')
  assert.equal(await app.api.schakelVideo(true), true)
  const camera = app.media.lokaalMedia.srcObject.getVideoTracks()[0]
  assert.equal(typeof app.api.activeerMicrofoon, 'function', 'microphone permission can be retried on a gesture')
  assert.equal(await app.api.activeerMicrofoon(), false, 'denied microphone acquisition does not fake a live microphone')
  assert.equal(app.api.getMediaStatus().localVideo, true)
  app.failAudioCapture = false
  assert.equal(await app.api.activeerMicrofoon(), true)
  assert.equal(app.api.getMediaStatus().localAudioAvailable, true)
  assert.equal(app.api.getMediaStatus().localAudio, true)
  assert.equal(app.media.lokaalMedia.srcObject.getVideoTracks()[0], camera, 'microphone recovery preserves the visible camera')
  assert.equal(camera.readyState, 'live')
  assert.ok(pc.getSenders().some(sender => sender.track?.kind === 'audio' && sender.track.readyState === 'live'), 'microphone recovery attaches the new audio track to the existing peer')
}

for (const userId of ['a', 'b']) {
  const app = setup(userId)
  await app.api.schakelVideo(true)
  const track = app.media.lokaalMedia.srcObject.getVideoTracks()[0]
  const pc = await app.startCall()
  assert.equal(pc.signalingState, 'have-local-offer')
  await app.signal('ice', { candidate: 'candidate:1 typ relay' })
  assert.equal(pc.candidates.length, 0, 'ICE arriving before a remote description is buffered')
  await app.signal('offer-renegotiate', { type: 'offer', sdp: 'simultaneous-camera-offer' })
  if (userId === 'a') {
    assert.equal(pc.signalingState, 'have-local-offer', 'the deterministic impolite peer keeps its pending offer')
    assert.equal(pc.remoteDescription, null)
    await app.signal('ice', { candidate: 'candidate:2 typ relay' })
    await app.signal('answer-renegotiate', { type: 'answer', sdp: 'answer-to-surviving-offer' })
  } else {
    assert.ok(pc.localDescriptions.some(description => description.type === 'rollback'), 'the polite peer rolls back its colliding offer')
    assert.ok(app.signals.some(signal => signal.payload?.type === 'answer-renegotiate'), 'the polite peer answers the surviving offer')
    assert.equal(pc.remoteDescription.sdp, 'simultaneous-camera-offer')
  }
  assert.equal(pc.candidates.length, 1, 'buffered ICE is drained once, while ICE belonging to an ignored offer is dropped')
  assert.equal(pc.candidates[0].candidate, 'candidate:1 typ relay')
  assert.equal(pc.signalingState, 'stable', 'simultaneous camera offers recover to stable signaling')
  assert.equal(track.readyState, 'live')
  assert.equal(app.api.getMediaStatus().localVideo, true, 'offer collision must not stop the local camera')
}

{
  const app = setup()
  await app.startCall()
  const gate = app.delayNextCapture()
  const enablingCamera = app.api.schakelVideo(true)
  await settle()
  assert.ok(gate.stream, 'camera permission request is in flight')
  await app.api.hangOp()
  gate.release()
  assert.equal(await enablingCamera, false, 'a stale camera request cannot resurrect a closed call')
  assert.equal(app.api.getMediaStatus().localVideo, false)
  assert.equal(gate.stream.getVideoTracks()[0].readyState, 'ended', 'a late camera track is released')
  assert.equal(app.media.lokaalMedia.srcObject, null)
}

console.log('PASS: actual track status, camera before/during call setup, pending/failed negotiation, remote mute/unmute/off/end, single audio output, autoplay recovery, transient disconnect recovery, receive-only call and microphone permission recovery, simultaneous camera offers with buffered ICE, and hangup during camera capture.')
