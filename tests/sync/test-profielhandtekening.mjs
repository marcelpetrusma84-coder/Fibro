// node tests/sync/test-profielhandtekening.mjs (17 nov 2026) - stap 1 van "profiel via vrienden": de eigenaar
// ondertekent zijn profiel met zijn bestaande chatsleutel; een tussenpersoon kan er niets aan veranderen.
import assert from 'node:assert/strict'
import { genereerKeypair } from '../../crypto.js'
const { ondertekenProfiel, controleerProfiel, controleerOnderdeel, isNieuwer, inhoudHash, MAX_ONDERDELEN } = await import('../../profielhandtekening.js')

const BRAM = 'bbbb0001-0000-4000-8000-000000000002', SANNE = 'cccc0001-0000-4000-8000-000000000003'
const bram = await genereerKeypair(), sanne = await genereerKeypair()   // precies de sleutels die de chat maakt
const onderdelen = { layout: '[{"id":"mood"}]', 'foto_pfoto_3x3_0': 'data:image/jpeg;base64,AAAA', naam: 'Bram' }
let ok = 0
const test = async (naam, f) => { await f(); ok++; console.log('OK  ', naam) }

const m = await ondertekenProfiel({ eigenaar: BRAM, privateKeyB64: bram.privateKeyB64, onderdelen, versie: 1_700_000_000_000 })
const ctl = (x, o = {}) => controleerProfiel(x, { eigenaar: BRAM, publicKeyB64: bram.publicKeyB64, nu: 1_700_000_100_000, ...o })

await test('de chatsleutel kan ondertekenen; de handtekening klopt', async () => {
  assert.equal(m.v, 1); assert.equal(m.eigenaar, BRAM); assert.equal(Object.keys(m.items).length, 3)
  assert.equal(m.items.layout, await inhoudHash(onderdelen.layout))
  assert.equal(await ctl(m), true)
})
await test('elk onderdeel controleren; een veranderde foto valt door de mand', async () => {
  for (const [k, v] of Object.entries(onderdelen)) assert.equal(await controleerOnderdeel(m, k, v), true, k)
  assert.equal(await controleerOnderdeel(m, 'foto_pfoto_3x3_0', 'data:image/jpeg;base64,BBBB'), false)
  assert.equal(await controleerOnderdeel(m, 'onbekend', 'x'), false)
})
await test('tussenpersoon verandert het lijstje: geweigerd', async () => {
  const nepFoto = await inhoudHash('data:image/jpeg;base64,BBBB')
  assert.equal(await ctl({ ...m, items: { ...m.items, 'foto_pfoto_3x3_0': nepFoto } }), false, 'andere hash')
  assert.equal(await ctl({ ...m, items: { ...m.items, extra: nepFoto } }), false, 'onderdeel erbij')
  const { naam, ...zonder } = m.items
  assert.equal(await ctl({ ...m, items: zonder }), false, 'onderdeel weg')
  assert.equal(await ctl({ ...m, versie: m.versie + 1 }), false, 'nieuwere versie verzonnen')
})
await test('verkeerde eigenaar of verkeerde sleutel: geweigerd', async () => {
  assert.equal(await ctl(m, { eigenaar: SANNE }), false, 'het profiel van Bram doorgeven als dat van Sanne')
  assert.equal(await ctl(m, { publicKeyB64: sanne.publicKeyB64 }), false, 'andere sleutel')
  const vanSanne = await ondertekenProfiel({ eigenaar: BRAM, privateKeyB64: sanne.privateKeyB64, onderdelen })
  assert.equal(await ctl(vanSanne), false, 'Sanne ondertekent namens Bram')
})
await test('rommel en randgevallen: geweigerd, zonder fout', async () => {
  for (const x of [null, {}, 'x', { ...m, v: 2 }, { ...m, handtekening: 'AAAA' }, { ...m, handtekening: undefined },
    { ...m, eigenaar: 'geen-uuid' }, { ...m, versie: -1 }, { ...m, items: [] }, { ...m, items: { 'a b': 'x' } }])
    assert.equal(await ctl(x), false, JSON.stringify(x)?.slice(0, 60))
  assert.equal(await ctl(m, { publicKeyB64: 'geen-sleutel' }), false)
  assert.equal(await ctl(m, { nu: m.versie - 11 * 60 * 1000 }), false, 'versie ver in de toekomst')
  await assert.rejects(ondertekenProfiel({ eigenaar: BRAM, privateKeyB64: bram.privateKeyB64, onderdelen: { 'a/b': 'x' } }))
  const teVeel = Object.fromEntries(Array.from({ length: MAX_ONDERDELEN + 1 }, (_, i) => ['o' + i, 'x']))
  await assert.rejects(ondertekenProfiel({ eigenaar: BRAM, privateKeyB64: bram.privateKeyB64, onderdelen: teVeel }))
})
await test('volgorde van onderdelen maakt niet uit; alleen een nieuwere versie telt', async () => {
  const omgedraaid = { ...m, items: Object.fromEntries(Object.entries(m.items).reverse()) }
  assert.equal(await ctl(omgedraaid), true)
  const nieuw = await ondertekenProfiel({ eigenaar: BRAM, privateKeyB64: bram.privateKeyB64, onderdelen, versie: m.versie + 5000 })
  assert.equal(isNieuwer(nieuw, m), true); assert.equal(isNieuwer(m, nieuw), false); assert.equal(isNieuwer(m, m), false); assert.equal(isNieuwer(m, null), true)
})
console.log(`\n${ok} van ${ok} goed`)
