// Ruimteschipscènes hebben geen kaarsen en zijn de enige scène met hologramkaarten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ui = readFileSync(new URL('../../koningsjacht-ui.js', import.meta.url), 'utf8')
const cards = readFileSync(new URL('../../kaartspel-hulp.js', import.meta.url), 'utf8')
const fixture = readFileSync(new URL('../fixtures/koningsjacht-preview.html', import.meta.url), 'utf8')

for (const value of ["['none', T('Epoxytafel')]", "['old', T('Inside · oud schip')]", "['futuristic', T('Inside · futuristisch')]"]) {
  assert.ok(ui.includes(value), 'moderne instelling kent ' + value)
}
assert.match(ui, /const ruimteschipActief = \(\) => !multiplayer && instellingen\.scene === 'modern' && instellingen\.modernInterior !== 'none'/)
assert.match(ui, /classList\.toggle\('kj-ruimteschip', ruimteschipActief\(\)\)/)
assert.match(ui, /classList\.toggle\('kj-holografisch', ruimteschipActief\(\)\)/)
assert.match(ui, /kj-instellingen\.kj-spaceship-interior \.kj-kaars-instelling\{display:none\}/)
assert.match(ui, /kj-ruimteschip \.kj-kaars,\.kj-ruimteschip \.kj-kaarslicht\{display:none!important\}/)
assert.match(ui, /modernInterior: \['none', 'old', 'futuristic'\]/)
assert.match(fixture, /scene:\s*'modern', modernInterior:\s*'futuristic'/)
assert.match(cards, /\.kt-tafel\.kj\.kj-holografisch/)
assert.doesNotMatch(cards, /\.kt-tafel\.kj\.kj-modern \.kt-hand \.kt-kaart/, 'Modern epoxy krijgt geen hologramprojectie')

console.log('OK: alleen ruimteschipscènes tonen hologrammen; kaarsen zijn daar weg')
