// v249/v250 (1 nov 2026): "Profiel geüpdatet" alleen bij belangrijke dingen.
// - Telt wel: een nieuwe of andere foto, een video, muziek, een achtergrondfoto achter een widget, en een andere
//   profielachtergrond (kleur, verloop, wallpaper of eigen foto; die staat op de server, zie vrienden.html).
// - Telt niet: widgets verschuiven, de blokstijl, teksten in kleine widgets, de naam, stickers, profielfoto, mood,
//   de volgorde van de afspeellijst, iets weghalen, een ander toestel van je vriend of opnieuw inloggen.
// Een onderdeel telt alleen als je het nog nooit van die vriend zag.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { nieuweSyncStand, profielKenmerken, belangrijkeVingerafdruk } = await import('../../sync.js')
const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')

const telefoon = {
  layout: { hash: 'a1' }, fotos: { pfoto_3x3_0: { hash: 'f0' }, pfoto_3x3_1: { hash: 'f1' } },
  muziek: { index: { hash: 'i1' }, nr0: { hash: 'm0' } }, videoMetaHash: 'vm1', videoHash: 'v1',
  klein: { quote: 'q1' }, wbg: { quote: { hash: 'b1', pos: '50% 50%' } }, blokstijl: { kleur: '#ffffff', doorzicht: 12, hoek: 14 },
  naam: 'Lazy Noodle', stickers: { 'e1-01': 's1' }
}
const kopie = m => JSON.parse(JSON.stringify(m))
const bewaar = (stand, gezien) => ({ t: 1, ...stand, nieuw: gezien ? false : stand.nieuw })

// kenmerken en vingerafdruk: volgorde maakt niet uit
const omgedraaid = Object.fromEntries(Object.entries(kopie(telefoon)).reverse())
assert.deepEqual(new Set(profielKenmerken(omgedraaid)), new Set(profielKenmerken(telefoon)))
assert.equal(belangrijkeVingerafdruk(omgedraaid), belangrijkeVingerafdruk(telefoon))
assert.match(belangrijkeVingerafdruk(telefoon), /^p2-[0-9a-f]{2,16}$/)

// 1. de eerste keer: beginpunt, niets nieuws
let stand = nieuweSyncStand(null, telefoon)
assert.equal(stand.nieuw, false, 'de eerste keer: geen melding')
stand = nieuweSyncStand(bewaar(stand), kopie(telefoon))
assert.equal(stand.nieuw, false, 'hetzelfde profiel: niets nieuws')

// 2. kleine dingen: geen update, en ook geen andere vingerafdruk (dus ook geen "onderweg" op de pagina Vrienden)
for (const [wat, verander] of [
  ['widgets verschoven', m => { m.layout.hash = 'a2' }],
  ['een andere quote', m => { m.klein.quote = 'q2' }],
  ['een andere naam', m => { m.naam = 'Snelle Noodle' }],
  ['een nieuwe sticker', m => { m.stickers['e1-02'] = 's2' }],
  ['een andere blokstijl', m => { m.blokstijl.kleur = '#000000' }],
  ['een achtergrondfoto verschoven', m => { m.wbg.quote.pos = '10% 20%' }],
  ['de afspeellijst in een andere volgorde', m => { m.muziek.index.hash = 'i2' }],
  ['een andere video-info', m => { m.videoMetaHash = 'vm2' }],
]) {
  const nu = kopie(telefoon); verander(nu)
  assert.equal(nieuweSyncStand(bewaar(stand, true), nu).nieuw, false, wat + ' is geen update')
  assert.equal(belangrijkeVingerafdruk(nu), belangrijkeVingerafdruk(telefoon), wat + ': dezelfde vingerafdruk op de server')
}

// 3. ander toestel of opnieuw inloggen (leger profiel), heen en weer: niets nieuws
const leeg = { ...kopie(telefoon), fotos: {}, muziek: {}, videoHash: null, wbg: {} }
for (let i = 0; i < 3; i++) {
  stand = nieuweSyncStand(bewaar(stand), leeg); assert.equal(stand.nieuw, false, 'leger profiel')
  stand = nieuweSyncStand(bewaar(stand), kopie(telefoon)); assert.equal(stand.nieuw, false, 'terug')
}
const bekend = [stand.v, ...stand.oud]
assert.equal(bekend.length, new Set(bekend).size, 'geen dubbele vingerafdrukken')
assert.ok(stand.oud.length >= 1 && stand.oud.length <= 20)

// 4. iets weghalen: geen update
const minder = kopie(telefoon); delete minder.fotos.pfoto_3x3_1
assert.equal(nieuweSyncStand(bewaar(stand, true), minder).nieuw, false, 'iets weghalen is geen update')

// 5. belangrijke dingen: wel een update, die blijft tot je het profiel bekijkt
for (const [wat, verander] of [
  ['een nieuwe foto', m => { m.fotos.pfoto_3x3_2 = { hash: 'f2' } }],
  ['een andere foto', m => { m.fotos.pfoto_3x3_0.hash = 'f9' }],
  ['een nieuwe video', m => { m.videoHash = 'v2' }],
  ['een nieuw nummer', m => { m.muziek.nr1 = { hash: 'm1' } }],
  ['ander profielnummer', m => { m.muziek.profiel = { hash: 'p9' } }],
  ['een andere achtergrondfoto achter een widget', m => { m.wbg.quote.hash = 'b2' }],
]) {
  const nu = kopie(telefoon); verander(nu)
  assert.notEqual(belangrijkeVingerafdruk(nu), belangrijkeVingerafdruk(telefoon), wat + ': andere vingerafdruk')
  let s = nieuweSyncStand(bewaar(stand, true), nu)
  assert.equal(s.nieuw, true, wat + ' is wel een update')
  s = nieuweSyncStand(bewaar(s), kopie(telefoon))
  assert.equal(s.nieuw, true, wat + ': blijft staan tot je het profiel bekijkt')
  s = nieuweSyncStand(bewaar(s, true), nu)
  assert.equal(s.nieuw, false, wat + ': bekeken, daarna niets nieuws meer')
}

// 6. een bewaarde stand van voor v249 (zonder k): beginpunt, een oude valse melding gaat weg
stand = nieuweSyncStand({ t: 1, v: 'p1-oud', oud: [], nieuw: true }, telefoon)
assert.equal(stand.nieuw, false)
assert.ok(Array.isArray(stand.k) && stand.k.length > 0)

// 7. niet te veel opslag
let groot = null
for (let i = 0; i < 300; i++) { const m = kopie(telefoon); m.fotos['pfoto_x_' + i] = { hash: 'h' + i }; groot = nieuweSyncStand(groot ? bewaar(groot, true) : null, m) }
assert.ok(groot.k.length <= 400, 'hoogstens 400 kenmerken per vriend')

// 8. de profielachtergrond (server) op de pagina Vrienden (de echte functies)
const vrienden = lees('vrienden.html')
const opslag = new Map()
const localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)) }
const knip = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, a); return src.slice(i, j) }
const { volgAchtergronden, profielStand } = new Function('localStorage', knip(vrienden, 'function volgAchtergronden(userId, data) {', '\n  let laatsteTeken') + '; return { volgAchtergronden, profielStand }')(localStorage)
const vriend = (kleur, wp) => [{ profiles: { id: 'ln', achtergrond_kleur: kleur, wallpaper_versie: wp, profiel_versie: null } }]
volgAchtergronden('ik', vriend('#1a0a2e', null))
assert.equal(profielStand(vriend()[0].profiles, 'ik'), '', 'de eerste keer: beginpunt')
volgAchtergronden('ik', vriend('#1a0a2e', null))
assert.equal(profielStand(vriend()[0].profiles, 'ik'), '', 'niets veranderd')
volgAchtergronden('ik', vriend('linear-gradient(135deg,#450a0a,#2d1f14)', null))
assert.equal(profielStand(vriend()[0].profiles, 'ik'), 'nieuw', 'een andere achtergrondkleur is een update')
opslag.set('fibro_achtergrondbij_ik_ln', JSON.stringify({ s: 'linear-gradient(135deg,#450a0a,#2d1f14)|', nieuw: false })) // bekeken
volgAchtergronden('ik', vriend('linear-gradient(135deg,#450a0a,#2d1f14)', 'abc'))
assert.equal(profielStand(vriend()[0].profiles, 'ik'), 'nieuw', 'een eigen achtergrondfoto is een update')
const zonderKolom = [{ profiles: { id: 'oud' } }]
volgAchtergronden('ik', zonderKolom)
assert.equal(opslag.has('fibro_achtergrondbij_ik_oud'), false, 'zonder de kolommen: niets')
assert.match(vrienden, /vraag\(VELDEN \+ ', avatar_versie, profiel_versie, achtergrond_kleur, wallpaper_versie'\)/)
assert.match(vrienden, /if \(!error && data\) \{\n      volgAchtergronden\(userId, data\)/)
// het profiel bekijken = ook de achtergrond gezien
assert.match(lees('vriend-profiel.html'), /const al = 'fibro_achtergrondbij_' \+ _eigenUid\(\) \+ '_' \+ vriendId/)

// 9. sync.js gebruikt dit; overal de nieuwe sync.js
const sync = lees('sync.js')
assert.match(sync, /const \{ v, oud, nieuw, k \} = nieuweSyncStand\(vorig, bericht\.data\)\n      localStorage\.setItem\(sl, JSON\.stringify\(\{ t: nu, v, oud, nieuw, k \}\)\)/)
assert.match(sync, /const v = belangrijkeVingerafdruk\(await maakManifest\(\)\)/, 'op de server: ook alleen het belangrijke deel')
for (const f of ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html'])
  assert.match(lees(f), /sync\.js\?v=25[0-9]/, f)

console.log('ok: "Profiel geüpdatet" alleen bij nieuwe foto\'s, video, muziek of een andere achtergrond')
