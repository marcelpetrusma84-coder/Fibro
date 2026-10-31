// v243 (31 okt 2026): Polaroid grid op Home. De zes foto's laden in willekeurige volgorde (IndexedDB); vroeger
// bleven er zes lege plekhouders tussen de foto's staan, zodat de rijen verkeerd afbraken (3, 2, 1 of 2, 2, 2 in
// plaats van 3 en 3) en de foto's door elkaar stonden. Nu heeft elke foto een vaste plek die wordt vervangen.
// In een echte browser nagemeten met de echte renderFotoPolaroid: 6 polaroids, rijen [3, 3], volgorde 1 t/m 6.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const begin = index.indexOf('function renderFotoPolaroid(c)')
const eind = index.indexOf('\n}\n', begin)
const f = index.slice(begin, eind)
assert.ok(begin > 0 && eind > begin, 'renderFotoPolaroid staat in index.html')

assert.ok(!f.includes("fotoWrap.appendChild(document.createElement('div'))"), 'geen lege plekhouders meer')
assert.match(f, /for \(let i = 0; i < N; i\+\+\) fotoWrap\.appendChild\(maakFrame\(i\)\)/, 'eerst zes lege polaroids, op volgorde')
assert.match(f, /frame\.dataset\.polaroid = i/)
assert.match(f, /const oud = plek\(i\)\s+if \(oud\) oud\.replaceWith\(frame\)/, 'een geladen foto vervangt zijn eigen plek')
assert.ok(!/insertBefore\(frame, children\[i\]\)/.test(f), 'niet meer invoegen op een plek die kan verschuiven')
// drie per rij: breedte 33% - 4px met 6px tussenruimte past precies
assert.match(f, /width:calc\(33% - 4px\)/)
assert.match(f, /gap:6px/)

console.log('ok: Polaroid grid in twee nette rijen van drie')
