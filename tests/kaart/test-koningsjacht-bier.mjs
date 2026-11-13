import assert from 'node:assert/strict'
import { verbindBierpul } from '../../koningsjacht-bier.js'

const listeners = new Map(), heartbeat = new Set(), berichten = []
const timers = { setInterval(fn) { heartbeat.add(fn); return fn }, clearInterval(fn) { heartbeat.delete(fn) } }
let nu = 1000
function kanaal(id) {
  const handlers = new Map(); listeners.set(id, handlers)
  return {
    on(_, { event }, fn) { handlers.set(event, fn) },
    send(m) { berichten.push(m); for (const [nr, map] of listeners) if (nr !== id) map.get(m.event)?.({ payload: m.payload }); return Promise.resolve('ok') }
  }
}
const stand1 = { zichtbaar: true, inhoud: 65, oorRechts: true, ronde: 0 }
const stand2 = { zichtbaar: false, inhoud: 100, oorRechts: false, ronde: 0 }
let gezien1, gezien2, actief = true
const a = verbindBierpul(kanaal(1), { speler: 1, lees: () => stand1, toon: s => { gezien1 = s }, timers, klok: () => ++nu, actief: () => actief })
const b = verbindBierpul(kanaal(2), { speler: 2, lees: () => stand2, toon: s => { gezien2 = s }, timers, klok: () => ++nu })
assert.deepEqual(gezien2, stand1, 'laat aansluitende speler vraagt onmiddellijk de huidige stand')
assert.deepEqual(gezien1, stand2)
stand1.inhoud = 20; a.update()
assert.equal(gezien2.inhoud, 20, 'inhoud komt bij de ander aan')
const oud = berichten.find(m => m.event === 'kj-bier-stand' && m.payload.speler === 1)
listeners.get(2).get('kj-bier-stand')({ payload: oud.payload })
assert.equal(gezien2.inhoud, 20, 'een vertraagd oud bericht overschrijft de huidige stand niet')
for (const inhoud of [-1, 101, NaN, '50']) listeners.get(2).get('kj-bier-stand')({ payload: { ...oud.payload, inhoud, versie: 999999 } })
assert.equal(gezien2.inhoud, 20, 'ongeldige vulling wordt genegeerd')
listeners.get(2).get('kj-bier-stand')({ payload: { ...oud.payload, speler: 2, inhoud: 99, versie: 999999 } })
assert.equal(gezien2.inhoud, 20, 'eigen echo wordt genegeerd')
stand1.inhoud = 100; stand1.ronde++; stand1.oorRechts = false; a.update()
assert.deepEqual(gezien2, stand1, 'nieuwe volle pul met andere oorstand')
// Simuleer een verloren bericht: na het herstelinterval komt de actuele stand alsnog aan.
const ontvang = listeners.get(2).get('kj-bier-stand')
listeners.get(2).delete('kj-bier-stand'); stand1.inhoud = 7; a.update()
assert.equal(gezien2.inhoud, 100)
listeners.get(2).set('kj-bier-stand', ontvang)
for (const fn of heartbeat) fn()
assert.equal(gezien2.inhoud, 7)
actief = false; for (const fn of heartbeat) fn()
assert.equal(heartbeat.size, 1, 'verlaten spel stopt het herstelinterval')
a.stop(); b.stop()
assert.equal(heartbeat.size, 0)
assert.equal(verbindBierpul(null, {}).update(), undefined, 'solo heeft geen netwerk nodig')
console.log('Koningsjacht bierpul: eigen status, late join, volgorde, validatie, herstel en opruimen goed')
