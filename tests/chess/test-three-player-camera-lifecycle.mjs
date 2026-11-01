import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Run the real camera handler and teardown together with deferred browser media
// permission. Closing the game while the permission prompt is open must release
// any stream the browser later returns, without publishing camera state.
const source = readFileSync(new URL('../../schaken-drie-ui.js', import.meta.url), 'utf8')
const start = source.indexOf('  async function toggleCamera(')
const end = source.indexOf('\n  function signal(', start)
assert(start >= 0 && end > start, 'the three-player camera handler exists')
const handler = source.slice(start, end).replace("await import('./ice-config.js?v=1')", 'testIce')
assert(!handler.includes('await import('), 'the harness must use its local ICE fixture')
const destroy = source.match(/destroy\(\{ preserveCamera = false \} = \{\}\) \{[\s\S]*?\n    \}/)?.[0]
assert(destroy, 'the three-player controller has a teardown method')

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function setup(testMode, { pendingIce = false, pendingPlayback = false } = {}) {
  const permission = deferred(), requested = deferred(), ice = deferred(), playback = deferred(), playing = deferred()
  const effects = { captureRequests:0, stopped:0, paints:0, changes:0, signals:0, play:0 }
  const stream = { getTracks:() => [
    { stop() { effects.stopped++ } },
    { stop() { effects.stopped++ } }
  ] }
  const video = { srcObject:null, play() { effects.play++; playing.resolve(); return pendingPlayback ? playback.promise : Promise.resolve() } }
  const button = { disabled:false, textContent:'', setAttribute() {} }
  const classes = { add() {}, remove() {} }
  const context = vm.createContext({
    navigator:{ mediaDevices:{ getUserMedia() { effects.captureRequests++; requested.resolve(); return permission.promise } } },
    testIce:{ iceReady:pendingIce ? ice.promise : Promise.resolve(), ICE_SERVERS:{ iceServers:[] } },
    testMode, video, button, tile:{ classList:classes },
    status:{ textContent:'' },
    document:{ getElementById:() => ({ classList:classes }) },
    root:{ replaceChildren() {}, classList:classes },
    rulesDialog:{ open:false }, settingsDialog:{ open:false },
    stopLanguage() {}, taal:{ destroy() {} },
    previousLanguage:null, previousTitleLanguage:null, titleSurface:null,
    setCameraButton(button, key) { button.textContent = key },
    say() {},
    gameChannel:{ send() { effects.signals++ } },
    roster:[{ id:'you' }], userId:'you',
    paintTestCamera() { effects.paints++ },
    onTestCameraChange() { effects.changes++ },
    addPeerTrack() { throw new Error('Unexpected peer negotiation in this fixture') }
  })
  vm.runInContext(`
    let destroyed = false, localStream = null, iceServers = null;
    const peers = new Map(), pendingIce = new Map();
    ${handler}
    const controller = { ${destroy} };
    globalThis.api = {
      capture:() => toggleCamera(button, tile, video),
      destroy:options => controller.destroy(options),
      stream:() => localStream
    };
  `, context, { filename:'three-player-camera-lifecycle.js' })
  return { api:context.api, effects, video, stream, permission, requested, ice, playback, playing }
}

for (const testMode of [true, false]) {
  const app = setup(testMode)
  const capture = app.api.capture()
  await app.requested.promise
  app.api.destroy()
  app.permission.resolve(app.stream)
  await capture
  assert.equal(app.effects.stopped, 2, `${testMode ? 'test' : 'live'} capture releases every late track`)
  assert.equal(app.api.stream(), null, 'a closed controller does not retain the stream')
  assert.equal(app.video.srcObject, null, 'a closed controller does not attach the stream')
  assert.equal(app.effects.paints, 0, 'a detached camera tile is not updated')
  assert.equal(app.effects.changes, 0, 'a late stream is not handed to another game')
  assert.equal(app.effects.signals, 0, 'a closed game does not broadcast camera activation')
}

{
  const app = setup(false, { pendingIce:true })
  const capture = app.api.capture()
  app.api.destroy()
  app.ice.resolve()
  await capture
  assert.equal(app.effects.captureRequests, 0, 'closing during ICE setup avoids requesting camera permission')
}

{
  const app = setup(false, { pendingPlayback:true })
  const capture = app.api.capture()
  await app.requested.promise
  app.permission.resolve(app.stream)
  await app.playing.promise
  app.api.destroy()
  app.playback.resolve()
  await capture
  assert.equal(app.effects.stopped, 2, 'closing during video playback setup stops the active tracks')
  assert.equal(app.effects.signals, 0, 'playback resolving after teardown cannot announce a live camera')
}

for (const testMode of [true, false]) {
  const app = setup(testMode)
  const capture = app.api.capture()
  await app.requested.promise
  app.permission.resolve(app.stream)
  await capture
  assert.equal(app.effects.stopped, 0, 'an open game keeps its camera stream alive')
  assert.equal(app.api.stream(), app.stream)
  assert.equal(testMode ? app.effects.paints : app.effects.play, 1, 'an open game displays its camera')
  app.api.destroy()
  assert.equal(app.effects.stopped, 2, 'normal teardown still stops every active track')
}

console.log('PASS: three-player test and live camera capture release late streams after teardown.')
