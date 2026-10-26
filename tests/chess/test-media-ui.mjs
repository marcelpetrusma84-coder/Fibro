import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Exercise the actual chat UI functions without loading an authenticated page,
// media devices, or network. Assertions are on the visible labels and controls.
const html = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
const functionNames = ['syncSpelMedia', 'zetSpelVideoVoortgang', 'zetSpelVideoStatus', 'activeerAangevraagdeSpelCamera']
const functions = functionNames.map(name => {
  const match = html.match(new RegExp('  (?:async )?function ' + name + '\\([\\s\\S]*?\\n  \\}'))
  assert.ok(match, name + ' exists in chat.html')
  return match[0]
}).join('\n')

function setup() {
  const elements = new Map(), events = []
  function element(id) {
    const classes = new Set()
    const node = {
      hidden: false, textContent: '', title: '', style: {}, attributes: {},
      classList: {
        toggle(name, force) { const on = force ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); return on },
        contains(name) { return classes.has(name) }
      },
      setAttribute(name, value) { this.attributes[name] = value }
    }
    elements.set(id, node)
    return node
  }
  for (const id of ['spelAudioStartBtn', 'spelMuteBtn', 'spelOverlay', 'spelVideoEigenWachten', 'spelVideoAnderWachten', 'lokaalMedia', 'remoteMedia', 'spelVideoEigen']) element(id)
  let mediaStatus = { localVideo: false, remoteVideo: false, localAudio: true, localAudioAvailable: true, remoteAudio: false, audioBlocked: false, connected: false }
  let captureResult = true
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id) || null },
    window: { dispatchEvent(event) { events.push(event) } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail } },
    getMediaStatus() { return { ...mediaStatus } },
    async schakelVideo() { return captureResult }
  })
  vm.runInContext(`
    let spelActief = 'schaken', spelCameraLayout = null, fibroChessTest = null;
    let spelEigenVideo = false, spelAnderVideo = false, spelMijnVideoGezien = false;
    let spelVideoAanvragen = true, spelVideoBezig = false, spelAnderCameraGewenst = false;
    ${functions}
    globalThis.api = {
      sync: syncSpelMedia, camera: activeerAangevraagdeSpelCamera,
      seen(value) { zetSpelVideoStatus({ gezien: value }) },
      requested(value) { spelAnderCameraGewenst = value; syncSpelMedia() },
      setGame(value) { spelActief = value },
      setTestMode(value) { fibroChessTest = value ? { active:true } : null; syncSpelMedia() },
      state() { return { spelVideoAanvragen, spelVideoBezig } }
    };
  `, context, { filename: 'chat-media-ui.js' })
  return {
    api: context.api, elements, events,
    status(patch) { mediaStatus = { ...mediaStatus, ...patch }; context.api.sync() },
    set captureResult(value) { captureResult = value }
  }
}

{
  const app = setup(), mic = app.elements.get('spelMuteBtn'), audio = app.elements.get('spelAudioStartBtn')
  audio.hidden = false
  app.api.setTestMode(true)
  assert.equal(mic.style.display, 'none', 'the local test does not expose the real call microphone')
  assert.equal(audio.hidden, true, 'the local webcam mirror does not claim to be a voice connection')
}

{
  const app = setup()
  app.status({ localVideo: true })
  app.captureResult = false
  assert.equal(await app.api.camera(), true, 'a live local track takes priority over a stale capture result')
  assert.equal(app.elements.get('spelVideoEigenWachten').hidden, true)
  assert.equal(app.elements.get('spelVideoEigenWachten').textContent, '')
  assert.equal(app.elements.get('lokaalMedia').style.display, 'block')
  assert.equal(app.api.state().spelVideoAanvragen, false)
  assert.equal(app.api.state().spelVideoBezig, false)
  assert.ok(app.events.some(event => event.type === 'fibro-chess-video-progress' && event.detail.tekst.startsWith('Your camera is on')))
}

{
  const app = setup()
  app.api.sync()
  assert.match(app.elements.get('spelVideoAnderWachten').textContent, /can switch on/)
  app.api.requested(true)
  assert.match(app.elements.get('spelVideoAnderWachten').textContent, /Waiting for/)
  app.status({ remoteVideo: true })
  assert.equal(app.elements.get('spelVideoAnderWachten').hidden, true, 'actual video clears the placeholder even if the status signal was lost')
  assert.equal(app.elements.get('spelVideoAnderWachten').textContent, '')
  assert.equal(app.elements.get('remoteMedia').style.display, 'block')
  app.status({ remoteVideo: false })
  assert.equal(app.elements.get('spelVideoAnderWachten').hidden, false)
}

{
  const app = setup(), button = app.elements.get('spelAudioStartBtn'), mic = app.elements.get('spelMuteBtn')
  app.status({ audioBlocked: true })
  assert.equal(button.hidden, false, 'blocked audio has a visible user action')
  app.status({ audioBlocked: false, localAudio: false })
  assert.equal(button.hidden, true)
  assert.equal(mic.title, 'Unmute microphone')
  assert.equal(mic.attributes['aria-pressed'], 'false')
  app.status({ localAudioAvailable: false })
  assert.equal(mic.title, 'Enable microphone')
  app.api.setGame(null)
  app.status({ audioBlocked: true })
  assert.equal(button.hidden, true, 'the game audio action is hidden when no game is active')
}

{
  const app = setup(), ownFrame = app.elements.get('spelVideoEigen')
  app.status({ localVideo: true, connected: true })
  assert.equal(ownFrame.classList.contains('is-seen'), false, 'a connection alone does not mean the friend sees a picture')
  app.api.seen(true)
  assert.equal(ownFrame.classList.contains('is-seen'), true)
  app.status({ connected: false })
  assert.equal(ownFrame.classList.contains('is-seen'), false)
  app.api.seen(true)
  assert.equal(ownFrame.classList.contains('is-seen'), false, 'a late acknowledgement cannot make a disconnected camera green')
  app.status({ localVideo: false, connected: true })
  assert.equal(ownFrame.classList.contains('is-seen'), false)
}

console.log('PASS: camera labels follow live tracks, remote picture clears placeholder, audio playback action, microphone state, and confirmed camera border.')
