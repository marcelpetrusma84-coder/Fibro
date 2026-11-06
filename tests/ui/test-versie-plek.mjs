// test-versie-plek.mjs: Home houdt spelkaarten compact; drie seconden vasthouden toont de versiehistorie.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const profiel = lees('profiel.html'), index = lees('index.html')
const rijen = profiel.match(/<div class="widget-versie" data-spelversie="[a-z]+"><\/div>/g) || []
assert.equal(rijen.length, 12, 'alle twaalf spellen in de lijst, compact (alleen het versienummer)')
assert.doesNotMatch(profiel, /data-spelversie-history/)
assert.match(profiel, /import \{ vulSpelVersies \} from "\.\/spelversies\.js\?v=\d+"\n[^\n]*\nkoppelSpelIcoonFallback\(\)\nvulSpelVersies\(\)/)
assert.match(index, /versieVlak\.setAttribute\('data-spelversie', spel\)/, 'version history is attached to each game card')
assert.match(index, /versieVlak\.hidden = true/, 'game versions stay hidden until the three-second hold')
assert.match(index, /import\('\.\/spelversies\.js\?v=22'\)/, 'history data is lazy-loaded on demand')
assert.doesNotMatch(index, /vulSpelVersies/)
console.log('PASS: Home game cards stay compact until a three-second hold reveals version history')
