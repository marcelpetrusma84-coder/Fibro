// node tests/sync/test-profielbundel.mjs (17 nov 2026) - stap 3 van "profiel via vrienden": bij het synchroniseren
// gaat een ondertekend lijstje mee; de vriend controleert het en bewaart het naast het profiel.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { genereerKeypair, sleutelVingerafdruk, isZelfdeSleutel } from '../../crypto.js'
const { eigenHandtekening, bewaarVriendHandtekening, VRIEND_SLEUTEL } = await import('../../profielbundel.js')
const { controleerOnderdeel } = await import('../../profielhandtekening.js')

const BRAM = 'bbbb0001-0000-4000-8000-000000000002', IK = 'aaaa0001-0000-4000-8000-000000000001'
const bram = await genereerKeypair(), ander = await genereerKeypair()
const maakLs = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m } }
const maakDb = () => { const m = new Map(); return { get: async k => m.get(k), put: async r => { m.set(r.id, r) }, m } }
const onderdelen = { layout: { data: '[{"id":"mood"}]', snel: 'a1' }, 'foto_pfoto_3x3_0': { data: 'data:image/jpeg;base64,AAAA', snel: 'b2' }, quote: { data: 'Hoi', snel: 'c3' } }
let ok = 0
const test = async (naam, f) => { await f(); ok++; console.log('OK  ', naam) }

const lsBram = maakLs()
const l1 = await eigenHandtekening({ eigenId: BRAM, privateKey: bram.privateKeyB64, onderdelen, ls: lsBram, nu: 1_700_000_000_000 })

await test('eigen lijstje: ondertekend, met alle onderdelen; zelfde profiel = zelfde versie', async () => {
  assert.equal(l1.eigenaar, BRAM); assert.deepEqual(Object.keys(l1.items).sort(), ['foto_pfoto_3x3_0', 'layout', 'quote'])
  for (const [k, o] of Object.entries(onderdelen)) assert.equal(await controleerOnderdeel(l1, k, o.data), true)
  const l2 = await eigenHandtekening({ eigenId: BRAM, privateKey: bram.privateKeyB64, onderdelen, ls: lsBram, nu: 1_700_000_500_000 })
  assert.equal(l2.versie, l1.versie); assert.equal(l2.handtekening, l1.handtekening)
})
await test('iets veranderd: nieuwe, hogere versie (ook als de klok terugsprong)', async () => {
  const anders = { ...onderdelen, quote: { data: 'Doei', snel: 'c4' } }
  const l3 = await eigenHandtekening({ eigenId: BRAM, privateKey: bram.privateKeyB64, onderdelen: anders, ls: lsBram, nu: 1_600_000_000_000 })
  assert.ok(l3.versie > l1.versie); assert.equal(await controleerOnderdeel(l3, 'quote', 'Doei'), true)
})
await test('de SHA-256 van een groot onderdeel wordt onthouden bij zijn snelle controlegetal', async () => {
  const cache = JSON.parse(lsBram.getItem('fibro_profielsha_' + BRAM))
  assert.ok(cache['4:c4'] && /^[0-9a-f]{64}$/.test(cache['4:c4']) && cache['3:c3'] === undefined, 'alleen wat er nu is')
})
const deps = (extra = {}) => ({ eigenId: IK, ls: maakLs(), haalSleutel: async () => bram.publicKeyB64, crypto: { sleutelVingerafdruk, isZelfdeSleutel }, db: maakDb(), nu: 1_700_000_100_000, ...extra })
await test('vriend: klopt = bewaard; hetzelfde of ouder = oud', async () => {
  const d = deps()
  assert.equal(await bewaarVriendHandtekening(d, BRAM, l1), 'bewaard')
  assert.deepEqual(JSON.parse(d.db.m.get(VRIEND_SLEUTEL(BRAM)).data), l1)
  assert.equal(await bewaarVriendHandtekening(d, BRAM, l1), 'oud')
})
await test('vervalst, verkeerde eigenaar of verkeerde sleutel: niet bewaard', async () => {
  const d = deps()
  assert.equal(await bewaarVriendHandtekening(d, BRAM, { ...l1, items: { ...l1.items, quote: 'f'.repeat(64) } }), 'vals')
  assert.equal(await bewaarVriendHandtekening(d, IK, l1), 'vals', 'lijstje van Bram als dat van een ander')
  assert.equal(await bewaarVriendHandtekening(deps({ haalSleutel: async () => ander.publicKeyB64 }), BRAM, l1), 'vals')
  assert.equal(await bewaarVriendHandtekening(deps({ haalSleutel: async () => null }), BRAM, l1), 'sleutel')
  assert.equal(d.db.m.size, 0)
})
await test('onthouden vingerafdruk (zoals de chat): andere sleutel = niet bewaard', async () => {
  const d = deps({ haalSleutel: async () => ander.publicKeyB64 })
  d.ls.setItem('fibro_vriendsleutel_' + IK + '_' + BRAM, await sleutelVingerafdruk(bram.publicKeyB64))
  assert.equal(await bewaarVriendHandtekening(d, BRAM, l1), 'sleutel')
  const goed = deps(); goed.ls.setItem('fibro_vriendsleutel_' + IK + '_' + BRAM, await sleutelVingerafdruk(bram.publicKeyB64))
  assert.equal(await bewaarVriendHandtekening(goed, BRAM, l1), 'bewaard')
})
await test('sync.js stuurt het lijstje mee en controleert dat van de vriend', async () => {
  const s = readFileSync(new URL('../../sync.js', import.meta.url), 'utf8')
  assert.match(s, /import \{ eigenHandtekening, bewaarVriendHandtekening \} from '\.\/profielbundel\.js\?v=1'/)
  assert.match(s, /\{ type: 'manifest', data: manifest, handtekening \}/)
  assert.match(s, /bewaarVriendHandtekening\(\{ eigenId: huidigeUserId/)
  assert.doesNotMatch(s.slice(s.indexOf('async function eigenOnderdelen'), s.indexOf('const vriendSleutels')), /video_data/, 'geen video')
})
console.log(`\n${ok} van ${ok} goed`)
