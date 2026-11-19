// node tests/ui/test-vergrendelscherm.mjs (19 nov 2026) - het spelertje op het vergrendelscherm (vergrendelscherm.js).
// Foto van Marcel: alleen "Stekky", een leeg vakje, --:-- en knoppen van 10 seconden. Nu: titel, artiest, hoes,
// tijdbalk, spoelen, ⏮ ⏭, live zonder spoelen, en wat het laatst begon staat bovenaan.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

let ok = 0
const test = async (naam, f) => { await f(); ok++; console.log('OK  ', naam) }
const wacht = () => new Promise(r => setTimeout(r, 0))

// nep-browser
const handlers = {}
const sessie = {
  metadata: null, playbackState: 'none', positie: null,
  setActionHandler(a, f) { if (f) handlers[a] = f; else delete handlers[a] },
  setPositionState(p) { this.positie = p || null },
}
globalThis.window = globalThis
Object.defineProperty(globalThis, 'navigator', { value: { mediaSession: sessie }, configurable: true })
globalThis.document = { baseURI: 'https://marcelpetrusma84-coder.github.io/Fibro/index.html' }
globalThis.MediaMetadata = class { constructor(m) { Object.assign(this, m) } }

class NepAudio extends EventTarget {
  constructor(src, duur = 180) { super(); this.attr = { src }; this.paused = true; this.ended = false; this.currentTime = 0; this.duration = duur; this.playbackRate = 1 }
  getAttribute(n) { return this.attr[n] ?? null }
  querySelector() { return null }
  play() { this.paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve() }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')) }
}

const { nuSpeelt, nuWeg, nuGetoond } = await import('../../vergrendelscherm.js')

await test('muziek: titel, artiest, album, hoes (plus Stekky-icoon), tijdbalk en spoelen', async () => {
  const a = new NepAudio('blob:x', 200)
  let vorige = 0, volgende = 0
  nuSpeelt('muziek', { el: a, titel: 'Mijn liedje', artiest: 'De Band', album: 'Mijn muziek', hoes: 'data:image/png;base64,AAAA', vorige: () => vorige++, volgende: () => volgende++ })
  a.currentTime = 30; await a.play(); await wacht()
  assert.equal(sessie.metadata.title, 'Mijn liedje')
  assert.equal(sessie.metadata.artist, 'De Band')
  assert.equal(sessie.metadata.album, 'Mijn muziek')
  assert.equal(sessie.metadata.artwork[0].src, 'data:image/png;base64,AAAA')
  assert.ok(sessie.metadata.artwork.some(x => x.src === 'https://marcelpetrusma84-coder.github.io/Fibro/icon-512.png'))
  assert.equal(sessie.playbackState, 'playing')
  assert.deepEqual(sessie.positie, { duration: 200, position: 30, playbackRate: 1 })
  for (const h of ['play', 'pause', 'seekto', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack']) assert.ok(handlers[h], h)
  handlers.seekto({ seekTime: 90 }); assert.equal(a.currentTime, 90)
  handlers.seekforward({}); assert.equal(a.currentTime, 100)
  handlers.seekbackward({ seekOffset: 30 }); assert.equal(a.currentTime, 70)
  handlers.previoustrack(); handlers.nexttrack(); assert.equal(vorige + volgende, 2)
  handlers.pause(); await wacht(); assert.equal(a.paused, true); assert.equal(sessie.playbackState, 'paused')
  handlers.play(); await wacht(); assert.equal(a.paused, false); assert.equal(sessie.playbackState, 'playing')
  a.pause(); nuWeg('muziek'); await wacht()
})

await test('emoji of vreemde link als hoes: alleen het Stekky-icoon', async () => {
  const a = new NepAudio('blob:y')
  nuSpeelt('x', { el: a, titel: 'A', hoes: '🐸' }); await a.play(); await wacht()
  assert.equal(sessie.metadata.artwork[0].src.endsWith('icon-192.png'), true)
  nuSpeelt('x', { el: a, titel: 'B', hoes: 'javascript:alert(1)' }); await wacht()
  assert.equal(sessie.metadata.artwork[0].src.endsWith('icon-192.png'), true)
  a.pause(); nuWeg('x'); await wacht()
})

await test('live (radio): geen tijdbalk en geen spoelen; ⏮ ⏭ = zappen; leeg vergrendelscherm na weghalen', async () => {
  const r = new NepAudio('https://stream.example/radio', Infinity)
  let zap = 0
  nuSpeelt('radio', { el: r, titel: 'NPO Radio 2', artiest: 'Live radio', live: true, vorige: () => zap--, volgende: () => zap++ })
  await r.play(); await wacht()
  assert.equal(sessie.metadata.title, 'NPO Radio 2')
  assert.equal(sessie.positie, null)
  assert.ok(!handlers.seekto && !handlers.seekforward && !handlers.seekbackward)
  handlers.nexttrack(); handlers.nexttrack(); assert.equal(zap, 2)
  nuWeg('radio'); await wacht()
  assert.equal(sessie.playbackState, 'none')
  assert.equal(nuGetoond(), null)
})

await test('gesprek zonder element: ⏸ = microfoon uit, ▶ = aan; ophangen', async () => {
  let mic = true, opgehangen = false
  const zet = () => nuSpeelt('gesprek', { titel: 'Gesprek met Bram', live: true, speelt: mic, pauze: () => { mic = false; zet() }, verder: () => { mic = true; zet() }, ophangen: () => { opgehangen = true } })
  zet(); await wacht()
  assert.equal(sessie.metadata.title, 'Gesprek met Bram')
  assert.equal(sessie.playbackState, 'playing')
  handlers.pause(); await wacht(); assert.equal(mic, false); assert.equal(sessie.playbackState, 'paused')
  handlers.play(); await wacht(); assert.equal(mic, true)
  handlers.hangup(); assert.equal(opgehangen, true)
  nuWeg('gesprek'); await wacht()
})

await test('wat het laatst begon staat bovenaan; stopt het, dan komt het vorige terug', async () => {
  const m = new NepAudio('blob:m'), s = new NepAudio('blob:s', 12)
  nuSpeelt('muziek', { el: m, titel: 'Muziek' }); await m.play(); await wacht()
  assert.equal(nuGetoond().titel, 'Muziek')
  nuSpeelt('spraak', { el: s, titel: 'Spraakbericht van Bram' }); m.pause(); await s.play(); await wacht()
  assert.equal(sessie.metadata.title, 'Spraakbericht van Bram')
  s.pause(); nuWeg('spraak', s); await wacht()
  assert.equal(sessie.metadata.title, 'Muziek')
  assert.equal(sessie.playbackState, 'paused')
  // nuWeg met een ander element: blijft staan
  nuSpeelt('spraak', { el: s, titel: 'Spraak' }); nuWeg('spraak', new NepAudio('blob:z')); await wacht()
  assert.ok(nuGetoond())
  nuWeg('spraak'); nuWeg('muziek'); await wacht()
})

await test('een element zonder src (audio.src = \'\') telt niet meer', async () => {
  const a = new NepAudio('blob:q')
  nuSpeelt('q', { el: a, titel: 'Q' }); await a.play(); await wacht()
  a.pause(); a.attr.src = ''; await wacht()
  assert.equal(nuGetoond(), null)
  nuWeg('q')
})

await test('aangesloten: geluidregelaar, radio, spraak, profielmuziek, bellen, muziekspelers', async () => {
  const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
  assert.match(lees('geluidregelaar.js'), /import \{ nuSpeelt \} from '\.\/vergrendelscherm\.js\?v=1'/)
  assert.doesNotMatch(lees('geluidregelaar.js'), /navigator\.mediaSession/) // één baas over het spelertje
  assert.match(lees('radio.js'), /nuSpeelt\('radio'/)
  assert.match(lees('spraak.js'), /nuSpeelt\('spraak'/)
  assert.match(lees('profielmuziek.js'), /dataset\.fibroArtiest/)
  assert.match(lees('bellen.js'), /nuSpeelt\('gesprek'/)
  assert.match(lees('bellen.js'), /export function zetGesprekInfo/)
  for (const f of ['index.html', 'vriend-profiel.html']) {
    assert.match(lees(f), /audio\.dataset\.fibroArtiest/, f)
    assert.match(lees(f), /audio\.__fibroVolgende/, f)
  }
  assert.match(lees('chat.html'), /zetGesprekInfo\(\{ id: tegenstanderId/)
  assert.match(lees('bellen.html'), /zetGesprekInfo\(\{ id: vriendId/)
})

console.log(`\n${ok} van ${ok} goed`)
