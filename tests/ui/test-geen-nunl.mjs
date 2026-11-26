// De Store heeft geen NU.nl-widget meer (NU.nl staat commercieel gebruik van de feeds niet toe).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STUDIO_LAYOUTS } from '../../studio-layouts.js'
assert.ok(!JSON.stringify(STUDIO_LAYOUTS).match(/nu\.nl/i), 'geen NU.nl-layout in de Store')
assert.ok(!STUDIO_LAYOUTS.some(l => l.store === 'layout-nu-nl'))
console.log('ok: geen NU.nl in de Store')
