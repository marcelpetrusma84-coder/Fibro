// Gedeelde kaarttafel moet voor elk kaartspel dezelfde cacheversie gebruiken.
// Een mismatch laadt in de browser meerdere ES-modules voor dezelfde tafel-helper,
// waardoor delen van de gedeelde kaartinstellingen niet synchroon lopen.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const kaartspellen = [
  'koningsjacht-ui.js',
  'pesten-ui.js',
  'toepen-ui.js',
  'eenentwintigen-ui.js',
]

const imports = kaartspellen.map(bestand => {
  const bron = readFileSync(new URL(`../../${bestand}`, import.meta.url), 'utf8')
  const match = bron.match(/from\s+['"]\.\/kaartspel-hulp\.js\?v=(\d+)['"];?/)
  assert.ok(match, `${bestand} importeert kaartspel-hulp.js met een expliciete cacheversie`)
  return [bestand, match[1]]
})

const versies = new Set(imports.map(([, versie]) => versie))
assert.equal(
  versies.size,
  1,
  `alle kaartspellen moeten dezelfde kaartspel-hulp cacheversie gebruiken: ${imports.map(([bestand, versie]) => `${bestand}=${versie}`).join(', ')}`,
)

console.log(`OK kaartspel-hulp cacheversie is gelijk in ${kaartspellen.length} spellen (v${imports[0][1]})`)
