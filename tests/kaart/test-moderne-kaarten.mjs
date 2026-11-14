import assert from 'node:assert/strict'

const opslag = new Map()
globalThis.localStorage = { getItem: k => opslag.get(k) ?? null, setItem: (k, v) => opslag.set(k, String(v)) }
globalThis.window = {}
const K = await import('../../kaartspel-hulp.js')
const ids = ['J1', 'J2', ...K.KAART_KLEUREN.flatMap(k => K.KAART_WAARDEN.map(w => k + w))]
const modern = ids.map(id => K.kaartSvg(id, 'modern'))
assert.equal(new Set(modern).size, 54, 'elke moderne kaart blijft herkenbaar en uniek')
for (const [n, svg] of modern.entries()) {
  assert.match(svg, /^<svg class="kt-svg kt-modern" viewBox="0 0 250 350".*<\/svg>$/s, ids[n])
  assert.doesNotMatch(svg, /undefined|NaN|<img|(?:src|href)="https?:\/\//, ids[n] + ': zelfstandig getekend zonder netwerkafbeelding')
  assert.match(svg, /#10151c/, ids[n] + ': donkere ondergrond')
  assert.match(svg, /#d9ba75/, ids[n] + ': goudkader')
}
assert.match(K.kaartSvg('h10', 'modern'), /fill="#ff7890"/, 'harten heeft een helder rood teken')
assert.match(K.kaartSvg('r10', 'modern'), /fill="#ff7890"/, 'ruiten heeft een helder rood teken')
assert.match(K.kaartSvg('s10', 'modern'), /fill="#fff0c6"/, 'schoppen steekt licht af tegen de donkere kaart')
for (const waarde of ['B', 'V', 'H']) assert.equal((K.kaartSvg('s' + waarde, 'modern').match(new RegExp('>' + waarde + '</text>', 'g')) || []).length, 2, 'beide hoekwaarden van ' + waarde)
assert.notEqual(K.kaartSvg('sB', 'modern'), K.kaartSvg('sV', 'modern'))
assert.notEqual(K.kaartSvg('sV', 'modern'), K.kaartSvg('sH', 'modern'))
assert.match(K.achterkantSvg('modern'), /class="kt-svg kt-modern"/)
assert.doesNotMatch(K.achterkantSvg('modern'), /#8b3fd1/)

// De stijlkeuze voor Koningsjacht verandert geen globale voorkeuren of de bestaande stijlen.
assert.equal(K.kaartStijl(), 'stekky')
assert.equal(opslag.has('fibro_kaartstijl'), false)
assert.equal(K.KAARTSTIJLEN.modern.verborgen, true)
assert.match(K.kaartSvg('sH', 'perkament'), /kaarten\/perkament\/sH.webp/)
assert.match(K.kaartSvg('sH', 'stekky'), /^<svg class="kt-svg"/)
assert.match(K.achterkantSvg('stekky'), /#8b3fd1/)

// Cache en hoekwaarden volgen de taal; de grafische hofillustratie blijft hetzelfde.
const T = s => s
T.taal = 'en'; window.T = T
for (const [waarde, engels] of [['B', 'J'], ['V', 'Q'], ['H', 'K']]) {
  const svg = K.kaartSvg('s' + waarde, 'modern')
  assert.equal((svg.match(new RegExp('>' + engels + '</text>', 'g')) || []).length, 2)
}
T.taal = 'nl'
assert.match(K.kaartSvg('sH', 'modern'), />H<\/text>/)
console.log('Moderne kaarten: 54 eigen SVG-kaarten, heldere kleuren, hofkaarten, achterkant, taal en bestaande stijlen goed')
