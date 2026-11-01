// v249 (1 nov 2026): geen valse "Profiel geüpdatet" meer.
// Een vriend heeft alleen iets nieuws als er een onderdeel binnenkomt dat je nog nooit van hem zag. Een ander toestel van
// je vriend, of opnieuw inloggen met een ouder of leger profiel, telt niet. Iets weghalen ook niet.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { nieuweSyncStand, profielKenmerken } = await import('../../sync.js')

const telefoon = {
  layout: { hash: 'a1' }, fotos: { pfoto_3x3_0: { hash: 'f0' }, pfoto_3x3_1: { hash: 'f1' } }, muziek: {},
  videoMetaHash: null, videoHash: null, klein: { quote: 'q1' }, wbg: {}, blokstijl: { kleur: '#ffffff', doorzicht: 12, hoek: 14 },
  naam: 'Lazy Noodle', stickers: { 'e1-01': 's1' }
}
const kopie = m => JSON.parse(JSON.stringify(m))
const bewaar = (stand, gezienAlles) => ({ t: 1, ...stand, nieuw: gezienAlles ? false : stand.nieuw })

// kenmerken: volgorde maakt niet uit, en null telt niet
const omgedraaid = Object.fromEntries(Object.entries(kopie(telefoon)).reverse())
assert.deepEqual(new Set(profielKenmerken(omgedraaid)), new Set(profielKenmerken(telefoon)))
assert.ok(profielKenmerken(telefoon).every(x => typeof x === 'string' && x.length <= 8))

// 1. de eerste keer: beginpunt, niets nieuws
let stand = nieuweSyncStand(null, telefoon)
assert.equal(stand.nieuw, false, 'de eerste keer: geen melding')

// 2. hetzelfde profiel nog een keer: niets nieuws
stand = nieuweSyncStand(bewaar(stand), kopie(telefoon))
assert.equal(stand.nieuw, false)

// 3. je vriend logt opnieuw in op een ander toestel, met een leger profiel (nog geen foto's, geen naam): niets nieuws
const leeg = { ...kopie(telefoon), fotos: {}, naam: '', klein: {} }
delete leeg.naam
stand = nieuweSyncStand(bewaar(stand), leeg)
assert.equal(stand.nieuw, false, 'een leger profiel (ander toestel of opnieuw ingelogd) is geen update')

// 4. en weer terug naar de telefoon, en weer heen: nog steeds niets (wisselen tussen toestellen)
for (let i = 0; i < 3; i++) {
  stand = nieuweSyncStand(bewaar(stand), kopie(telefoon)); assert.equal(stand.nieuw, false, 'terug naar de telefoon')
  stand = nieuweSyncStand(bewaar(stand), leeg); assert.equal(stand.nieuw, false, 'weer het andere toestel')
}
// de vingerafdrukken van beide toestellen zijn bekend, dus ook op de pagina Vrienden geen "onderweg"
const bekend = [stand.v, ...stand.oud]
assert.equal(bekend.length, new Set(bekend).size, 'geen dubbele')
assert.ok(stand.oud.length >= 1 && stand.oud.length <= 20)

// 5. een foto weghalen: geen update
const minder = kopie(telefoon); delete minder.fotos.pfoto_3x3_1
stand = nieuweSyncStand(bewaar(stand), minder)
assert.equal(stand.nieuw, false, 'iets weghalen is geen update')

// 6. echt iets nieuws: wel een melding, en die blijft tot je het profiel bekijkt
for (const [wat, verander] of [
  ['een nieuwe foto', m => { m.fotos.pfoto_3x3_2 = { hash: 'f2' } }],
  ['een andere foto', m => { m.fotos.pfoto_3x3_0.hash = 'f9' }],
  ['een andere quote', m => { m.klein.quote = 'q2' }],
  ['een andere naam', m => { m.naam = 'Snelle Noodle' }],
  ['een nieuwe sticker', m => { m.stickers['e1-02'] = 's2' }],
]) {
  const nu = kopie(telefoon); verander(nu)
  let s = nieuweSyncStand(bewaar(stand, true), nu)
  assert.equal(s.nieuw, true, wat + ' is wel een update')
  s = nieuweSyncStand(bewaar(s), kopie(telefoon))
  assert.equal(s.nieuw, true, wat + ': blijft staan tot je het profiel bekijkt')
  s = nieuweSyncStand(bewaar(s, true), nu)
  assert.equal(s.nieuw, false, wat + ': bekeken, en daarna niets nieuws meer')
}

// 7. een bewaarde stand van voor v249 (zonder k): beginpunt, en een oude valse melding gaat weg
stand = nieuweSyncStand({ t: 1, v: 'p1-oud', oud: [], nieuw: true }, telefoon)
assert.equal(stand.nieuw, false, 'oude valse melding verdwijnt bij de volgende sync')
assert.ok(Array.isArray(stand.k) && stand.k.length > 0)

// 8. niet te veel opslag
let groot = null
for (let i = 0; i < 300; i++) { const m = kopie(telefoon); m.fotos['pfoto_x_' + i] = { hash: 'h' + i }; groot = nieuweSyncStand(groot ? bewaar(groot, true) : null, m) }
assert.ok(groot.k.length <= 400, 'hoogstens 400 kenmerken per vriend')

// 9. sync.js gebruikt dit bij een binnengekomen overzicht; overal de nieuwe sync.js
const sync = readFileSync(new URL('../../sync.js', import.meta.url), 'utf8')
assert.match(sync, /const \{ v, oud, nieuw, k \} = nieuweSyncStand\(vorig, bericht\.data\)\n      localStorage\.setItem\(sl, JSON\.stringify\(\{ t: nu, v, oud, nieuw, k \}\)\)/)
for (const f of ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html'])
  assert.match(readFileSync(new URL('../../' + f, import.meta.url), 'utf8'), /sync\.js\?v=249/, f)

console.log('ok: geen valse "Profiel geüpdatet" bij een ander toestel, opnieuw inloggen of iets weghalen')
