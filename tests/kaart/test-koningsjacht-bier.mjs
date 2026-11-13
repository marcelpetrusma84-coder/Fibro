import assert from 'node:assert/strict'
import { verbindBierpul, herstelBierPartij } from '../../koningsjacht-bier.js'

// Een pulnummer hoort bij de partij; nooit bij algemene toestelvoorkeuren.
const volleEerste = partij => ({ partij, ronde: 0, inhoud: 100, oorRechts: true })
const bewaard = { partij: 'solo-bestaand', ronde: 3, inhoud: 28, oorRechts: false }
assert.deepEqual(herstelBierPartij(bewaard, 'solo-bestaand'), bewaard, 'hervatten bewaart het pulnummer en de inhoud')
assert.deepEqual(herstelBierPartij({ ...bewaard, ronde: 999 }, 'solo-bestaand', true), volleEerste('solo-bestaand'), 'een nieuwe partij begint met de eerste volle pul')
assert.deepEqual(herstelBierPartij(bewaard, 'solo-anders'), volleEerste('solo-anders'), 'een andere partij erft geen oude pul')
assert.deepEqual(herstelBierPartij({ bierRonde: 999 }, 'solo-nieuw'), volleEerste('solo-nieuw'), 'een oude algemene voorkeurenteller wordt niet gebruikt')
assert.deepEqual(herstelBierPartij(null, 1001), volleEerste(1001))
for (const onjuist of [
  { ...bewaard, ronde: -1 }, { ...bewaard, ronde: '3' }, { ...bewaard, ronde: Number.MAX_SAFE_INTEGER + 1 },
  { ...bewaard, inhoud: 101 }, { ...bewaard, inhoud: NaN }, { ...bewaard, oorRechts: 'false' }
]) assert.deepEqual(herstelBierPartij(onjuist, 'solo-bestaand'), volleEerste('solo-bestaand'), 'onjuiste partijopslag wordt genegeerd')

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

// Dezelfde verbinding mag een nieuwe partij openen, ook wanneer de pulstand
// toevallig hetzelfde is. Een oud partijbericht mag het versienummer niet vergiftigen.
let partij1 = 11, partij2 = 11, nieuweStand, ontvangen = 0
const eigenStand = { zichtbaar: true, inhoud: 100, oorRechts: true, ronde: 0 }
const anderStand = { zichtbaar: false, inhoud: 100, oorRechts: true, ronde: 0 }
const c = verbindBierpul(kanaal(1), { speler: 1, partij: () => partij1, lees: () => eigenStand, toon() {}, timers, klok: () => 5000 })
const d = verbindBierpul(kanaal(2), { speler: 2, partij: () => partij2, lees: () => anderStand, toon: s => { nieuweStand = s; ontvangen++ }, timers, klok: () => 5000 })
const laatsteEigen = () => berichten.filter(m => m.event === 'kj-bier-stand' && m.payload.speler === 1).at(-1).payload
const eerste = laatsteEigen()
assert.equal(eerste.partij, 11)
const eerstOntvangen = ontvangen
partij1 = partij2 = 22; c.update()
const tweede = laatsteEigen()
assert.equal(tweede.partij, 22)
assert.ok(tweede.versie > eerste.versie, 'een andere partij verhoogt de versie, ook bij dezelfde klok en pulstand')
assert.equal(ontvangen, eerstOntvangen + 1)
assert.deepEqual(nieuweStand, eigenStand)
listeners.get(2).get('kj-bier-stand')({ payload: { ...eerste, ronde: 999, versie: 999999 } })
assert.equal(nieuweStand.ronde, 0, 'een oud bericht uit de vorige partij wordt genegeerd')
eigenStand.ronde = 3; eigenStand.inhoud = 20; c.update()
assert.equal(nieuweStand.ronde, 3, 'een geldig nieuw bericht blijft na een ongeldig hoog versienummer aankomen')
partij1 = partij2 = 33; eigenStand.ronde = 0; eigenStand.inhoud = 100; c.update()
assert.equal(nieuweStand.ronde, 0, 'een volgende partij kan weer ronde 0 publiceren')
assert.equal(nieuweStand.inhoud, 100)
c.stop(); d.stop()
assert.equal(heartbeat.size, 0)
console.log('Koningsjacht bierpul: eigen status, late join, volgorde, validatie, herstel en opruimen goed')
