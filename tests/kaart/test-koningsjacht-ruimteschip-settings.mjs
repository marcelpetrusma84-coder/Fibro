// Ruimteschipscènes hebben geen kaarsen en zijn de enige scène met hologramkaarten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ui = readFileSync(new URL('../../koningsjacht-ui.js', import.meta.url), 'utf8')
const cards = readFileSync(new URL('../../kaartspel-hulp.js', import.meta.url), 'utf8')
const scene = readFileSync(new URL('../../koningsjacht-scene.js', import.meta.url), 'utf8')

for (const value of ['ruimteschip-oud', 'ruimteschip-futuristisch']) {
  assert.ok(ui.includes(value), 'instellingen kennen ' + value)
}
assert.match(ui, /classList\.toggle\('kj-ruimteschip', isRuimteScene\(instellingen\.scene\)\)/)
assert.match(ui, /classList\.toggle\('kj-holografisch', isRuimteScene\(instellingen\.scene\)\)/)
assert.match(ui, /kj-instellingen\.kj-ruimteschip \.kj-kaars-instelling\{display:none\}/)
assert.match(ui, /kj-ruimteschip \.kj-kaars,\.kj-ruimteschip \.kj-kaarslicht\{display:none!important\}/)
assert.match(cards, /\.kt-tafel\.kj\.kj-holografisch/)
assert.doesNotMatch(cards, /\.kt-tafel\.kj\.kj-modern \.kt-hand \.kt-kaart/, 'Modern epoxy krijgt geen hologramprojectie')
assert.match(scene, /ruimteAchtergrond\(gekozenScene\)/)

console.log('OK: alleen ruimteschipscènes tonen hologrammen; kaarsen zijn daar weg')
