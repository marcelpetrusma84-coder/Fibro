// node tests/sync/test-doorgeven.mjs (17 nov 2026) - stap 4 van "profiel via vrienden": een profiel via een
// gezamenlijke vriend (doorgeven.js). Tussenpersoon Bram, eigenaar Anna, ontvanger Sanne.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { genereerKeypair, sleutelVingerafdruk, isZelfdeSleutel } from '../../crypto.js'
const { ondertekenProfiel, inhoudHash } = await import('../../profielhandtekening.js')
const D = await import('../../doorgeven.js')

const ANNA = 'aaaa0001-0000-4000-8000-000000000001', BRAM = 'bbbb0001-0000-4000-8000-000000000002'
const SANNE = 'cccc0001-0000-4000-8000-000000000003', VREEMD = 'eeee0001-0000-4000-8000-000000000005'
const anna = await genereerKeypair(), nep = await genereerKeypair()
const FOTO = 'data:image/png;base64,AAAA', QUOTE = '{"tekst":"Hoi"}', LAYOUT = '[{"id":"quote"}]'
const STICKER = JSON.stringify({ d: 'data:image/webp;base64,UklG', b: 'stuiter', g: 'geen', n: 'Hoi', t: 5 })
const lijst = await ondertekenProfiel({ eigenaar: ANNA, privateKeyB64: anna.privateKeyB64, versie: 2_000_000,
  onderdelen: { layout: LAYOUT, quote: QUOTE, foto_pfoto_2x2_0: FOTO, 'sticker_e1-01': STICKER, muziek_nr0: 'data:audio/mp3;base64,AAAA' } })
const snel = s => 'h' + s.length
const db = (start = {}) => { const m = new Map(Object.entries(start)); return { m, get: async k => m.get(k), put: async r => { m.set(r.id, r) }, sleutels: async p => [...m.keys()].filter(k => k.startsWith(p)) } }
const maakLs = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) } }
let ok = 0
const test = async (naam, f) => { D.vergeetDeelCache(); await f(); ok++; console.log('OK  ', naam) }

// Bram: heeft Anna's lijstje en onderdelen (zoals sync.js ze bewaart)
const bramDb = () => db({
  ['vriend_' + ANNA + '_handtekening']: { data: JSON.stringify(lijst) },
  ['vriend_' + ANNA + '_layout']: { id: 'vriend_' + ANNA + '_layout', data: LAYOUT },
  ['vriend_' + ANNA + '_quote']: { id: 'vriend_' + ANNA + '_quote', data: QUOTE },
  ['vriend_' + ANNA + '_foto_pfoto_2x2_0']: { id: 'vriend_' + ANNA + '_foto_pfoto_2x2_0', data: FOTO },
  ['vriend_' + ANNA + '_sticker_e1-01']: { id: 'vriend_' + ANNA + '_sticker_e1-01', data: 'data:image/webp;base64,UklG', b: 'stuiter', g: 'geen', naam: 'Hoi', tijd: 5 },
})
const bram = (extra = {}) => ({ eigenId: BRAM, vrienden: new Set([ANNA, SANNE]), db: bramDb(), deeltVriend: async (e, a) => e === ANNA && a === SANNE, ...extra })
const sanne = (extra = {}) => ({ eigenId: SANNE, vrienden: new Set([ANNA, BRAM]), ls: maakLs(), haalSleutel: async () => anna.publicKeyB64,
  crypto: { sleutelVingerafdruk, isZelfdeSleutel }, db: db(), snel, relay: false, laatstRechtstreeks: () => 0, nu: 2_000_100, ...extra })

await test('Bram biedt Anna\'s profiel alleen aan als de server bevestigt dat Sanne ook haar vriend is', async () => {
  const a = await D.aanbodVoor(bram(), SANNE)
  assert.equal(a.length, 1); assert.equal(a[0].eigenaar, ANNA); assert.deepEqual(a[0].lijst, lijst)
  D.vergeetDeelCache()
  assert.equal((await D.aanbodVoor(bram({ deeltVriend: async () => false }), SANNE)).length, 0, 'geen vriend van Anna')
  D.vergeetDeelCache()
  assert.equal((await D.aanbodVoor(bram({ deeltVriend: async () => { throw new Error('server weg') } }), SANNE)).length, 0, 'server weg = niets')
  assert.equal((await D.aanbodVoor(bram(), ANNA)).length, 0, 'Anna haar eigen profiel aanbieden: nee')
  assert.equal((await D.aanbodVoor(bram({ vrienden: new Set([SANNE]) }), SANNE)).length, 0, 'Anna is geen vriend (meer) van Bram')
})
await test('Bram geeft alleen onderdelen die precies passen (ook een sticker)', async () => {
  const b = bram()
  assert.equal(await D.inhoudVoor(b, SANNE, ANNA, 'foto_pfoto_2x2_0', lijst), FOTO)
  assert.equal(await D.inhoudVoor(b, SANNE, ANNA, 'sticker_e1-01', lijst), STICKER)
  b.db.m.get('vriend_' + ANNA + '_quote').data = '{"tekst":"anders"}'
  assert.equal(await D.inhoudVoor(b, SANNE, ANNA, 'quote', lijst), null, 'past niet bij het lijstje')
  assert.equal(await D.inhoudVoor(b, SANNE, ANNA, 'muziek_nr0', lijst), null, 'heeft hij niet')
  assert.equal(await D.inhoudVoor(b, SANNE, ANNA, '../tokens', lijst), null, 'rare naam')
  assert.equal(await D.inhoudVoor(b, VREEMD, ANNA, 'foto_pfoto_2x2_0', lijst), null, 'aan een vreemde: nee (de server zegt nee)')
})
await test('Sanne: lijstje klopt, ze vraagt wat ze nog niet heeft; via relay geen muziek', async () => {
  const s = sanne()
  s.db.m.set('vriend_' + ANNA + '_layout', { id: 'vriend_' + ANNA + '_layout', hash: 'x', data: LAYOUT })
  const r = await D.beoordeelLijst(s, BRAM, ANNA, lijst)
  assert.equal(r.ok, true); assert.deepEqual(r.nodig.sort(), ['foto_pfoto_2x2_0', 'muziek_nr0', 'quote', 'sticker_e1-01'])
  const rr = await D.beoordeelLijst(sanne({ relay: true }), BRAM, ANNA, lijst)
  assert.ok(!rr.nodig.includes('muziek_nr0'))
})
await test('Sanne weigert: geen vriend, vervalst, verkeerde sleutel, oud, of al nieuwer rechtstreeks gezien', async () => {
  assert.equal((await D.beoordeelLijst(sanne({ vrienden: new Set([BRAM]) }), BRAM, ANNA, lijst)).reden, 'geen vriend')
  assert.equal((await D.beoordeelLijst(sanne(), BRAM, ANNA, { ...lijst, items: { ...lijst.items, quote: 'f'.repeat(64) } })).reden, 'vals')
  assert.equal((await D.beoordeelLijst(sanne({ haalSleutel: async () => nep.publicKeyB64 }), BRAM, ANNA, lijst)).reden, 'vals')
  const vast = sanne({ haalSleutel: async () => nep.publicKeyB64 }); vast.ls.setItem('fibro_vriendsleutel_' + SANNE + '_' + ANNA, await sleutelVingerafdruk(anna.publicKeyB64))
  assert.equal((await D.beoordeelLijst(vast, BRAM, ANNA, lijst)).reden, 'sleutel', 'sleutel veranderd t.o.v. onthouden')
  const al = sanne(); al.db.m.set('vriend_' + ANNA + '_handtekening', { data: JSON.stringify(lijst) })
  assert.equal((await D.beoordeelLijst(al, BRAM, ANNA, lijst)).reden, 'oud')
  assert.equal((await D.beoordeelLijst(sanne({ laatstRechtstreeks: () => 3_000_000 }), BRAM, ANNA, lijst)).reden, 'oud')
  assert.equal((await D.beoordeelLijst(sanne(), BRAM, SANNE, lijst)).reden, 'wie')
})
await test('Sanne bewaart alleen wat precies past, in hetzelfde formaat als rechtstreeks', async () => {
  const s = sanne()
  assert.equal(await D.bewaarOnderdeel(s, ANNA, 'foto_pfoto_2x2_0', FOTO, lijst), true)
  assert.deepEqual({ ...s.db.m.get('vriend_' + ANNA + '_foto_pfoto_2x2_0'), ontvangen: 0 }, { id: 'vriend_' + ANNA + '_foto_pfoto_2x2_0', hash: snel(FOTO), data: FOTO, ontvangen: 0, viaVriend: true })
  assert.equal(await D.bewaarOnderdeel(s, ANNA, 'sticker_e1-01', STICKER, lijst), true)
  const st = s.db.m.get('vriend_' + ANNA + '_sticker_e1-01')
  assert.equal(st.data, 'data:image/webp;base64,UklG'); assert.equal(st.b, 'stuiter'); assert.equal(st.tijd, 5); assert.equal(st.hash, snel(STICKER))
  assert.equal(await D.bewaarOnderdeel(s, ANNA, 'quote', '{"tekst":"NEP"}', lijst), false, 'vervalst')
  assert.equal(await D.bewaarOnderdeel(s, ANNA, 'foto_pfoto_2x2_0', 'javascript:alert(1)', lijst), false, 'geen plaatje')
  assert.equal(s.db.m.has('vriend_' + ANNA + '_quote'), false)
})
await test('sync.js gebruikt het: aanbod met het manifest, één voor één verwerkt, lijstje pas na alles', async () => {
  const s = readFileSync(new URL('../../sync.js', import.meta.url), 'utf8')
  assert.match(s, /import \* as Doorgeven from '\.\/doorgeven\.js\?v=\d+'/)
  assert.match(s, /'dg-lijst', 'dg-geef', 'dg-chunk'\]\.includes\(bericht\.type\)/)
  assert.match(s, /if \(aanbod\.length\) bericht\.doorgeven = aanbod\.map\(a => a\.eigenaar\)/)
  assert.match(s, /p2pRij = p2pRij\.then\(\(\) => verwerkP2pBericht\(bericht\)\)/)
  assert.match(s, /if \(!b\.mislukt\) \{\n    await Doorgeven\.bewaarLijst/)
  assert.match(s, /supabase\.rpc\('deelt_vriend', \{ eigenaar, ander \}\)/)
})
console.log(`\n${ok} van ${ok} goed`)
