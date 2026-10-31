// v241 (31 okt 2026): een spel met een vriend begint pas als de vriend er ook is.
// chat.html zet een wachtscherm voor het spel en houdt de berichten vast (hold) tot het spel klaarstaat (release).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maakSpelVerbinding } from '../../spelverbinding.js'

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function fakeClock() {
  let time = 0, id = 0
  const timers = new Map()
  return {
    now: () => time,
    setTimeout(fn, ms) { timers.set(++id, { fn, at: time + ms }); return id },
    clearTimeout(timer) { timers.delete(timer) },
    async advance(ms) {
      const end = time + ms
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0]
        if (!next || next[1].at > end) break
        time = next[1].at; timers.delete(next[0]); next[1].fn(); await settle()
      }
      time = end; await settle()
    }
  }
}
function network() {
  const channels = []
  return label => ({
    getChannels: () => channels.filter(c => c.owner === label && c.state !== 'closed'),
    async removeChannel(c) { c.state = 'closed' },
    channel(name) {
      const c = {
        owner: label, topic: 'realtime:' + name, state: 'closed',
        on(type, filter, fn) { this.listener = fn; return this },
        subscribe(cb) { this.state = 'joining'; queueMicrotask(() => { this.state = 'joined'; cb('SUBSCRIBED') }); return this },
        async send(m) {
          for (const p of channels.filter(p => p !== this && p.topic === this.topic && p.state === 'joined'))
            queueMicrotask(() => p.listener(structuredClone(m)))
          return 'ok'
        }
      }
      channels.push(c)
      return c
    }
  })
}

// 1. Alleen ik: ik blijf wachten, ook na een minuut. Mijn vriend komt later: dan zijn we allebei meteen 'connected'
{
  const clock = fakeClock(), client = network(), states = { a: [], b: [] }
  const common = { naam: 'sessie-1', clock, events: new EventTarget(), page: null, isOnline: () => true }
  const a = maakSpelVerbinding({ ...common, client: client('a'), instanceId: 'a', onStatus: s => states.a.push(s) })
  a.hold().subscribe()
  await clock.advance(60000)
  assert.ok(!states.a.includes('connected'), 'zonder vriend begint het spel niet')
  assert.equal(states.a.at(-1), 'waiting')

  const b = maakSpelVerbinding({ ...common, client: client('b'), instanceId: 'b', onStatus: s => states.b.push(s) })
  b.hold().subscribe()
  await settle()
  assert.equal(states.a.at(-1), 'connected', 'ik zie mijn vriend binnenkomen')
  assert.equal(states.b.at(-1), 'connected', 'mijn vriend ziet mij meteen (geen 5 seconden wachten op een ping)')

  // 2. a start het spel en stuurt al iets voordat b's spel klaarstaat: b mist niets, en in de goede volgorde
  const ontvangen = []
  a.release()
  await a.send({ type: 'broadcast', event: 'pong-klaar', payload: { v: 2 } })
  await a.send({ type: 'broadcast', event: 'zet', payload: { move: 4 } })
  await settle()
  assert.deepEqual(ontvangen, [])
  b.on('broadcast', { event: 'pong-klaar' }, () => ontvangen.push('klaar'))
  b.on('broadcast', { event: 'zet' }, m => ontvangen.push(m.payload.move))
  b.release()
  assert.deepEqual(ontvangen, ['klaar', 4], 'bewaarde berichten komen na release, in volgorde')
  await a.send({ type: 'broadcast', event: 'zet', payload: { move: 5 } })
  await settle()
  assert.deepEqual(ontvangen, ['klaar', 4, 5], 'na release gaat alles gewoon direct')
  a.stop(); b.stop()
}

// 3. Een vriend met een oudere Fibro (zonder ping) telt ook als aanwezig zodra er iets van hem binnenkomt
{
  const clock = fakeClock(), client = network(), states = []
  const a = maakSpelVerbinding({ naam: 'sessie-2', clock, events: new EventTarget(), page: null, isOnline: () => true,
    client: client('a'), instanceId: 'a', onStatus: s => states.push(s) })
  a.hold().subscribe()
  await settle()
  const oud = client('oud').channel('sessie-2')
  oud.on('broadcast', {}, () => {}).subscribe(() => {})
  await settle()
  await oud.send({ type: 'broadcast', event: 'pong-klaar', payload: {} })
  await settle()
  assert.equal(states.at(-1), 'connected')
  a.stop()
}

// 4. chat.html: wachtscherm, hold voor subscribe, release na het starten, stoppen tijdens het wachten
{
  const chat = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
  assert.match(chat, /spelverbinding\.js\?v=2'/)
  const deel = chat.slice(chat.indexOf('window.speelMee = async function'), chat.indexOf('const SPELCHAT_SPELLEN'))
  const iHold = deel.indexOf('verbinding.hold()'), iScherm = deel.indexOf('toonSpelWachtscherm()')
  const iSub = deel.indexOf('verbinding.subscribe()'), iStart = deel.indexOf("await startBotKaasEieren()")
  const iRelease = deel.indexOf('verbinding.release()')
  assert.ok(iHold > 0 && iHold < iScherm && iScherm < iSub && iSub < iStart && iStart < iRelease, 'volgorde: hold, wachtscherm, verbinden, spel starten, release')
  assert.match(deel, /spelType !== 'schakendrie'/, 'schaken met drie heeft een eigen wachtkamer')
  assert.match(chat, /status === 'connected' && spelWachtKlaar/)
  assert.match(chat, /if \(spelWachtKlaar\) \{ const klaar = spelWachtKlaar; spelWachtKlaar = null; klaar\(false\) \}/, 'sluiten stopt het wachten')
  // de teksten op het wachtscherm hebben Engels
  globalThis.window = {}
  new Function('window', readFileSync(new URL('../../taal-en.js', import.meta.url), 'utf8'))(globalThis.window)
  const EN = globalThis.window.FIBRO_EN
  for (const k of ['⏳ Wachten tot {naam} in het spel zit...', 'Annuleren', 'Verbinding herstellen; je spel blijft open.', 'Wachten op internet; je spel blijft open.'])
    assert.ok(Object.prototype.hasOwnProperty.call(EN, k), 'Engels voor ' + k)
  delete globalThis.window
}

console.log('ok: een spel met een vriend begint pas als de vriend er is')
