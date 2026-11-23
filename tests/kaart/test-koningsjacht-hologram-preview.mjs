// De lokale hologram-preview moet Modern kiezen en de scene-assets moeten aanwezig zijn.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const fixture = readFileSync(new URL('../fixtures/koningsjacht-preview.html', import.meta.url), 'utf8')
const helper = readFileSync(new URL('../../kaartspel-hulp.js', import.meta.url), 'utf8')

assert.match(fixture, /modern-hologram/)
assert.match(fixture, /scene:\s*'modern'/)
assert.match(helper, /\.kt-tafel\.kj\.kj-modern \.kt-hand \.kt-kaart/)
assert.match(helper, /\.kt-tafel\.kj\.kj-modern \.kt-stapel-groep/)

for (const asset of [
  'modern-epoxy-table.png',
  'candle-modern-left.png',
  'candle-modern-right.png',
]) {
  assert.ok(existsSync(new URL('../../assets/koningsjacht/' + asset, import.meta.url)), `preview asset bestaat: ${asset}`)
}

console.log('OK moderne hologram-preview en tafelafbeeldingen zijn aanwezig')
