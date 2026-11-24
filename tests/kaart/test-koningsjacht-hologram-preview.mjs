// De hologram-preview gebruikt de originele ruimteschipbeelden uit de repo.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fixture = readFileSync(new URL('../fixtures/koningsjacht-preview.html', import.meta.url), 'utf8')
const helper = readFileSync(new URL('../../kaartspel-hulp.js', import.meta.url), 'utf8')

assert.match(fixture, /ruimteschip-futuristisch/)
assert.match(fixture, /scene:\s*'modern',\s*modernInterior:\s*'futuristic'/)
assert.match(helper, /\.kt-tafel\.kj\.kj-holografisch \.kt-hand \.kt-kaart/)
assert.match(helper, /\.kt-tafel\.kj\.kj-holografisch \.kt-stapel-groep/)

for (const beeld of ['spaceship-interior.png', 'spaceship-interior-futuristic.png']) {
  const png = readFileSync(new URL('../../assets/koningsjacht/' + beeld, import.meta.url))
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', beeld + ' is een aanwezig PNG-bestand')
}

console.log('OK hologram-preview heeft beide ruimteschipbeelden')
