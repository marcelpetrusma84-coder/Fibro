// De lokale hologram-preview moet het ruimteschip kiezen zonder externe scene-assets.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fixture = readFileSync(new URL('../fixtures/koningsjacht-preview.html', import.meta.url), 'utf8')
const helper = readFileSync(new URL('../../kaartspel-hulp.js', import.meta.url), 'utf8')

assert.match(fixture, /ruimteschip-futuristisch/)
assert.match(fixture, /scene:\s*'ruimteschip-futuristisch'/)
assert.match(helper, /\.kt-tafel\.kj\.kj-holografisch \.kt-hand \.kt-kaart/)
assert.match(helper, /\.kt-tafel\.kj\.kj-holografisch \.kt-stapel-groep/)

assert.match(readFileSync(new URL('../../koningsjacht-scene.js', import.meta.url), 'utf8'), /data:image\/svg\+xml/)

console.log('OK ruimteschip-hologram-preview bestaat zonder externe scène-afbeeldingen')
