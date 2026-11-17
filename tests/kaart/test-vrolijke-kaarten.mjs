// De Vrolijke kaarten (17 nov 2026, Marcel; kaartspel-hulp.js v10): de standaard voor de kaartspellen.
import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
globalThis.localStorage = { getItem: () => null, setItem() {} }
globalThis.window = { dispatchEvent() {} }
globalThis.CustomEvent = class { constructor(t) { this.type = t } }
const K = await import('../../kaartspel-hulp.js')
const bestaat = f => existsSync(new URL('../../' + f, import.meta.url))
const plaatjesIn = svg => [...svg.matchAll(/href="\.\/([^"?]+)\?v=\d+"/g)].map(m => m[1])

assert.equal(K.kaartStijl(), 'vrolijk', 'de standaard')
assert.equal(K.KAARTSTIJLEN.vrolijk.naam, 'Vrolijk')
const alle = ['J1', 'J2']; for (const k of K.KAART_KLEUREN) for (const w of K.KAART_WAARDEN) alle.push(k + w)
const gebruikt = new Set(), verschillend = new Set()
for (const id of alle) {
  const svg = K.kaartSvg(id)
  assert.match(svg, /^<svg class="kt-svg kt-vrolijk" viewBox="0 0 250 350"[^>]*>.*<\/svg>$/s, id + ': een svg')
  assert.ok(!/undefined|NaN/.test(svg), id + ': netjes getekend')
  const w = id.slice(1), p = plaatjesIn(svg)
  if (/^[4-9]$|^10$/.test(w)) assert.equal(p.length, 0, id + ': tekens 4-10 zijn getekend, geen plaatje')
  else assert.equal(p.length, 1, id + ': een plaatje')
  for (const f of p) { assert.ok(bestaat(f), id + ': ' + f + ' bestaat'); gebruikt.add(f) }
  if (!id.startsWith('J')) {
    const toon = { B: 'J', V: 'Q', H: 'K' }[w] || w   // op deze kaarten altijd Engels (Marcel)
    assert.ok(svg.includes('>' + toon + '</text>'), id + ': waarde ' + toon + ' in de hoek')
  }
  verschillend.add(svg)
}
assert.equal(verschillend.size, 53, 'J1 en J2 zijn dezelfde joker, de rest is allemaal anders')
assert.equal(gebruikt.size, 4 * 6 + 1, 'per kleur A, 2, 3, B, V, H en een joker')
// het gezichtje op klaveren- en hartenaas (gegeven door Marcel), niet op de andere azen (die hadden er al een)
for (const id of ['hA', 'kA']) assert.match(K.kaartSvg(id), /fill="#4a1717"/, id + ': lachende mond')
for (const id of ['rA', 'sA']) assert.doesNotMatch(K.kaartSvg(id), /fill="#4a1717"/, id + ': gezicht zit al in het plaatje')
// de verkeerde tekens in de tekening zijn vervangen door het goede teken (kleur van de soort)
assert.match(K.kaartSvg('hB'), /fill="#e8474f"/); assert.match(K.kaartSvg('rV'), /fill="#d0494b"/); assert.match(K.kaartSvg('kH'), /fill="#2f8a52"/)
// namen onder de hofkaarten: altijd Engels (Marcel), ook als de app in het Nederlands staat; en de achterkant
assert.match(K.kaartSvg('sB'), />JACK<\/text>/); assert.match(K.kaartSvg('sV'), />QUEEN<\/text>/); assert.match(K.kaartSvg('sH'), />KING<\/text>/)
assert.doesNotMatch(K.kaartSvg('sB') + K.kaartSvg('sV') + K.kaartSvg('sH'), />(BOER|VROUW|KONING|B|V|H)<\/text>/)
assert.deepEqual(plaatjesIn(K.achterkantSvg()), ['kaarten/vrolijk/achterkant.webp'])
assert.ok(bestaat('kaarten/vrolijk/achterkant.webp'))
// niet te zwaar voor telefoons
let totaal = 0; for (const f of [...gebruikt, 'kaarten/vrolijk/achterkant.webp']) totaal += statSync(new URL('../../' + f, import.meta.url)).size
assert.ok(totaal < 1200 * 1024, 'samen ' + Math.round(totaal / 1024) + ' kB')
// in het Engels: J/Q/K en JACK/QUEEN/KING
const T = s => s; T.taal = 'en'; window.T = T
assert.match(K.kaartSvg('hB'), />J<\/text>/); assert.match(K.kaartSvg('hB'), />JACK<\/text>/)
assert.match(K.kaartSvg('kV'), />QUEEN<\/text>/); assert.match(K.kaartSvg('sH'), />K<\/text>.*>KING<\/text>/s)
console.log('vrolijke kaarten: ok')
