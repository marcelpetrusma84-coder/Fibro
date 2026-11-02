// Block It v150 (2 nov 2026): de computerspeler (blockit-computer.js) en hoe blockit-ui.js hem gebruikt.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { kiesZet, simuleerLanding, grootsteVierkant, draaiingen, PC_NIVEAUS, PC_NIVEAU_NAMEN, ZWART } from '../../blockit-computer.js'

const RIJ = 20, KOL = 10
const VORMEN = { I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[0, 1], [1, 1], [2, 1], [1, 0]], L: [[0, 1], [1, 1], [2, 1], [2, 0]], J: [[0, 1], [1, 1], [2, 1], [0, 0]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], B: [[0, 0]] }
const NAMEN = ['I', 'O', 'T', 'L', 'J', 'S', 'Z']
const leeg = () => Array.from({ length: RIJ }, () => new Array(KOL).fill(null))
const grootte = v => v === 'I' || v === 'O' ? 4 : v === 'B' ? 1 : 3
const stuk = (vorm, k, extra = {}) => ({ vorm, cellen: VORMEN[vorm], grootte: grootte(vorm), k, bom: vorm === 'B', crush: 0, ...extra })
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 } }
// onderaan beginnend: rijen als tekst, '.' leeg, 0-3 kleur, 9 zwart
function bak(...rijen) {
  const r = leeg()
  rijen.reverse().forEach((t, i) => [...t].forEach((c, x) => { r[RIJ - 1 - i][x] = c === '.' ? null : Number(c) }))
  return r
}

// 1. Draaiingen: een O en een bom hebben er één, de andere vier
assert.equal(draaiingen(VORMEN.O, 4, 'O').length, 1)
assert.equal(draaiingen(VORMEN.B, 1, 'B').length, 1)
assert.equal(draaiingen(VORMEN.T, 3, 'T').length, 4)

// 2. Zwart telt nooit mee in een vierkant
assert.equal(grootsteVierkant(bak('999.......', '999.......', '999.......')), null)
assert.deepEqual(grootsteVierkant(bak('111.......', '111.......', '111.......')), { k: 3, x: 0, y: 17, kleur: 1 })

// 3. Landen: een vierkant van 3x3 verdwijnt en geeft 1 punt en 1 rij aanval
{
  const r = bak('11........', '11........', '11........')
  const u = simuleerLanding(r, [[2, 17], [2, 18], [2, 19]], 1, false, false, 0)
  assert.equal(u.punten, 1); assert.equal(u.aanval, 1); assert.equal(u.lading, 2)
  assert.ok(r.every(rij => rij.every(c => c === null)), 'de bak is leeg')
}

// 4. Een bom haalt zwarte blokken weg
{
  const r = bak('9999......', '9999......')
  const u = simuleerLanding(r, [[1, 17]], 0, false, true, 0)
  assert.ok(u.zwartWeg >= 6, 'de bom blies zwart weg')
}

// 5. De computer maakt een vierkant af als dat kan (ook op makkelijk zonder foutje)
{
  const r = bak('22........', '22........', '22........')
  for (const niveau of PC_NIVEAU_NAMEN) {
    const z = kiesZet(r, stuk('I', 2), niveau, () => 0.99)   // 0.99: geen foutje
    const cellen = draaiingen(VORMEN.I, 4, 'I')[z.draai].map(([cx, cy]) => z.x + cx)
    assert.ok(cellen.every(x => x === 2), niveau + ': de I gaat rechtop in kolom 2 (' + JSON.stringify(z) + ')')
  }
}

// 6. Hij kiest geen zet die meteen verliest als het ook anders kan
{
  const r = leeg()
  for (let y = 2; y < RIJ; y++) for (let x = 0; x < KOL; x++) r[y][x] = x < 7 ? ZWART : null   // links bijna vol, rechts leeg
  const z = kiesZet(r, stuk('O', 0), 'moeilijk')
  assert.ok(z.x >= 6, 'de O gaat naar de lege kant (x=' + z.x + ')')
}

// 7. Moeilijk houdt het langer vol dan makkelijk (zelfde stenen, zonder tegenstander)
function speel(niveau, seed, max = 260) {
  const rnd = rng(seed)
  const r = leeg()
  let lading = 0, n = 0
  for (; n < max; n++) {
    const bom = rnd() < 1 / 12
    const vorm = bom ? 'B' : NAMEN[Math.floor(rnd() * 7)]
    const s = stuk(vorm, bom ? 0 : Math.floor(rnd() * 4), { crush: lading })
    const z = kiesZet(r, s, niveau, rnd)
    if (!z) break
    const start = draaiingen(s.cellen, s.grootte, vorm)[z.draai].map(([cx, cy]) => [z.x + cx, cy])
    const vrij = p => p.every(([x, y]) => x >= 0 && x < KOL && y < RIJ && (y < 0 || r[y][x] === null))
    let d = 0
    while (vrij(start.map(([x, y]) => [x, y + d + 1]))) d++
    const u = simuleerLanding(r, z.crush ? start : start.map(([x, y]) => [x, y + d]), s.k, z.crush, bom, z.crush ? s.crush : 0)
    lading = u.lading
    if (u.overloop) break
  }
  return n
}
const gem = niveau => [1, 2, 3, 4, 5].reduce((t, s) => t + speel(niveau, s), 0) / 5
const makkelijk = gem('makkelijk'), moeilijk = gem('moeilijk')
assert.ok(moeilijk > makkelijk * 1.5, `moeilijk (${moeilijk}) duidelijk sterker dan makkelijk (${makkelijk})`)
assert.ok(moeilijk >= 200, 'moeilijk overleeft minstens 200 stenen alleen (' + moeilijk + ')')

// 8. Niveaus: moeilijk is sneller en maakt geen foutjes, makkelijk gebruikt geen lading
assert.ok(PC_NIVEAUS.moeilijk.denk < PC_NIVEAUS.normaal.denk && PC_NIVEAUS.normaal.denk < PC_NIVEAUS.makkelijk.denk)
assert.equal(PC_NIVEAUS.moeilijk.fout, 0)
assert.equal(PC_NIVEAUS.makkelijk.crush, false)

// 9. blockit-ui.js: laadt de computer, kent zwarte aanval, en de versienummers kloppen
const ui = readFileSync(new URL('../../blockit-ui.js', import.meta.url), 'utf8')
assert.match(ui, /from '\.\/blockit-computer\.js\?v=1'/)
assert.match(ui, /function krijgAanval\(n\) \{\n        if \(zwartAanval\) krijgZwart\(n \* ZWART_PER_RIJ\)\n        else krijgRijen\(n\)/)
assert.match(ui, /event: 'bi-aanval' \}, \(msg\) => krijgAanval\(msg\.payload\.rijen\)/, 'samen: de aanval van je vriend volgt zwarte aanval')
assert.match(ui, /zwartAanval: true, titel: vertaal\('Twee velden, zwarte aanval'\)/)
assert.match(ui, /payload: \{ modus: v\.modus, zwart: zwartAan, zwartAanval \}/, 'de uitnodiger stuurt zwarte aanval mee')
assert.match(ui, /if \(solo && !pcNiveau\) \{\n            const nieuw = solo\.nieuweScore/, 'tegen de computer telt niet als record')
for (const [bestand, patroon] of [['solo.js', /blockit-ui\.js\?v=150/], ['chat.html', /blockit-ui\.js\?v=150/], ['spel.html', /solo\.js\?v=246/]]) {
  assert.match(readFileSync(new URL('../../' + bestand, import.meta.url), 'utf8'), patroon, bestand)
}
const chat = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
assert.ok(!chat.includes('blockit-ui.js?v=149'), 'geen oude versie meer in chat.html')

// 10. Alle nieuwe teksten hebben een Engelse vertaling
const en = readFileSync(new URL('../../taal-en.js', import.meta.url), 'utf8')
for (const [, tekst] of ui.matchAll(/vertaal\('([^']+)'/g)) assert.ok(en.includes(JSON.stringify(tekst) + ':'), 'Engels voor: ' + tekst)
assert.match(readFileSync(new URL('../../taal.js', import.meta.url), 'utf8'), /taal-en\.js\?v=48/)

console.log(`PASS: Block It tegen de computer (alleen gemiddeld ${makkelijk} stenen op makkelijk, ${moeilijk} op moeilijk), zwarte aanval, versies en Engels.`)
