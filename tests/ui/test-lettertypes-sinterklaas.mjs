// Lettertype-pakket Sinterklaas (13 nov 2026): vier lettertypes in de Stekky Store. Hier: het pakket staat in de Store,
// elk lettertype heeft zijn css en woff2-bestanden in lettertypen/, een licentieregel, mag geladen worden (EIGEN) en
// heeft een Engelse naam.
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
const pad = p => new URL('../../' + p, import.meta.url)
const lees = p => readFileSync(pad(p), 'utf8')
globalThis.document = { getElementById: () => null, createElement: () => ({}), head: { appendChild: e => geladen.push(e.href) } }
const geladen = []
const { STORE_PAKKETTEN, STORE_LETTERTYPES, laadFont, lettertypeSlug } = await import(pad('lettertypes.js'))

const pakket = STORE_PAKKETTEN.find(p => p.id === 'pakket-sinterklaas')
assert.ok(pakket && pakket.titel === 'Sinterklaas', 'pakket Sinterklaas staat in de Store')
assert.deepEqual(pakket.lettertypes.map(f => f.naam), ['Eagle Lake', 'Berkshire Swash', 'Emilys Candy', 'Henny Penny'])
const licenties = lees('lettertypen/LICENTIES.txt'), en = lees('taal-en.js')
for (const f of pakket.lettertypes) {
  const slug = lettertypeSlug(f.naam), css = lees('lettertypen/' + slug + '.css')
  assert.match(css, new RegExp("font-family:'" + f.naam + "'"), slug + '.css noemt het lettertype')
  for (const m of css.matchAll(/url\('([^']+)'\)/g)) assert.ok(existsSync(pad('lettertypen/' + m[1])), m[1] + ' bestaat')
  assert.ok(licenties.includes('- ' + f.naam + ' (OFL-1.1): Copyright'), 'licentie van ' + f.naam)
  assert.ok(en.includes(JSON.stringify('lettertype|' + f.label) + ':'), 'Engels voor ' + f.label)
  laadFont(f.naam)
  assert.equal(geladen.at(-1), 'lettertypen/' + slug + '.css?v=1', f.naam + ' mag geladen worden (EIGEN)')
  assert.ok(STORE_LETTERTYPES.some(x => x.naam === f.naam && x.ids.includes('pakket-sinterklaas')))
}
assert.ok(en.includes('"pakket|Sinterklaas":'), 'Engels voor het pakket')
console.log('lettertype-pakket Sinterklaas: ok')
