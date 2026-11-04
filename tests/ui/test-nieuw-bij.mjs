// test-nieuw-bij.mjs (4 nov 2026, v263): "✨ Nieuw bij je vrienden" op Home.
// 1. sync.js houdt bij WAT er nieuw is (w) en wanneer (nt): alleen echt nieuwe dingen, opgeteld tot je kijkt.
// 2. nieuwbij.js maakt er de lijst van: alleen huidige vrienden, nieuwste eerst, met de naam die de vriend zelf koos.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// een nep-localStorage en window voor nieuwbij.js
const opslag = new Map()
globalThis.localStorage = {
  get length() { return opslag.size }, key: i => [...opslag.keys()][i] ?? null,
  getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)), removeItem: k => opslag.delete(k),
}
globalThis.window = globalThis.window || {}
const { nieuweSyncStand } = await import('../../sync.js')

const basis = { fotos: { pfoto_a: { hash: 'f1' } }, muziek: { profiel: { hash: 'm1' } }, videoHash: 'v1', wbg: {}, layout: { hash: 'l1' } }
const kopie = o => JSON.parse(JSON.stringify(o))
const bewaar = (s, nieuw) => ({ t: 1, v: s.v, oud: s.oud, nieuw: nieuw ?? s.nieuw, k: s.k, w: s.w })

let s = nieuweSyncStand(null, basis)
assert.deepEqual([s.nieuw, s.w, s.erbij], [false, [], false], 'de eerste keer: beginpunt, niets nieuws')
const metFoto = kopie(basis); metFoto.fotos.pfoto_b = { hash: 'f2' }
s = nieuweSyncStand(bewaar(s), metFoto)
assert.deepEqual([s.nieuw, s.w, s.erbij], [true, ['foto'], true], 'een nieuwe foto')
const metMuziek = kopie(metFoto); metMuziek.muziek.profiel.hash = 'm2'
s = nieuweSyncStand(bewaar(s), metMuziek)
assert.deepEqual([s.nieuw, s.w.sort()], [true, ['foto', 'muziek']], 'nog niet gekeken: foto en muziek bij elkaar')
s = nieuweSyncStand(bewaar(s, false), metMuziek)
assert.deepEqual([s.nieuw, s.w, s.erbij], [false, [], false], 'gekeken en niets nieuws: leeg')
const andereLayout = kopie(metMuziek); andereLayout.layout.hash = 'l2'
s = nieuweSyncStand(bewaar(s), andereLayout)
assert.deepEqual([s.nieuw, s.w], [false, []], 'widgets verschuiven is geen nieuws')
const video = kopie(metMuziek); video.videoHash = 'v2'; video.wbg = { thema: { hash: 'w1' } }
s = nieuweSyncStand(bewaar(s), video)
assert.deepEqual([s.nieuw, s.w.sort()], [true, ['achtergrond', 'video']], 'video en achtergrondfoto')

// ---- nieuwbij.js ----
const IK = 'aaaaaaaa-0000-4000-8000-000000000001', BRAM = 'bbbb0001-0000-4000-8000-000000000002'
const LOTTE = 'cccc0003-0000-4000-8000-000000000003', WEG = 'dddd0004-0000-4000-8000-000000000004'
const { nieuwBijLijst } = await import('../../nieuwbij.js')
const vriend = (id, username) => ({ profiles: { id, username, avatar_url: '\u{1F438}' } })
localStorage.setItem('fibro_vriendenpagina_' + IK, JSON.stringify({ data: [vriend(BRAM, 'bram'), vriend(LOTTE, 'lotte')] }))
localStorage.setItem('fibro_syncbij_' + IK + '_' + BRAM, JSON.stringify({ t: 5, nieuw: true, w: ['muziek', 'foto'], nt: 100 }))
localStorage.setItem('fibro_syncbij_' + IK + '_' + LOTTE, JSON.stringify({ t: 5, nieuw: true, w: ['video'], nt: 200 }))
localStorage.setItem('fibro_syncbij_' + IK + '_' + WEG, JSON.stringify({ t: 5, nieuw: true, w: ['foto'], nt: 300 }))
localStorage.setItem('vriend_naam_' + BRAM + '_' + IK, 'Bram de Bouwer')
let l = nieuwBijLijst(IK)
assert.deepEqual(l.map(x => [x.naam, x.wat]), [['lotte', ['video']], ['Bram de Bouwer', ['foto', 'muziek']]], 'nieuwste eerst, geen ex-vriend, eigen naam')
localStorage.setItem('fibro_syncbij_' + IK + '_' + LOTTE, JSON.stringify({ t: 5, nieuw: false, w: ['video'], nt: 200 }))
localStorage.setItem('fibro_achtergrondbij_' + IK + '_' + LOTTE, JSON.stringify({ s: 'x', nieuw: true }))
l = nieuwBijLijst(IK)
assert.deepEqual(l.map(x => [x.id, x.wat]), [[BRAM, ['foto', 'muziek']], [LOTTE, ['achtergrond']]], 'gezien = weg; andere achtergrond telt')
assert.deepEqual(nieuwBijLijst('geen-id'), [])

// de pagina's
const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
assert.match(index, /<div id="nieuwBij" hidden><\/div>/)
assert.match(index, /import\('\.\/nieuwbij\.js\?v=1'\)\.then\(m => m\.toonNieuwBij\(document\.getElementById\('nieuwBij'\), session\.user\.id\)\)/)
const nb = readFileSync(new URL('../../nieuwbij.js', import.meta.url), 'utf8')
assert.doesNotMatch(nb, /supabase|innerHTML/, 'geen server en geen html uit gegevens')
console.log('ok: nieuw bij je vrienden')
