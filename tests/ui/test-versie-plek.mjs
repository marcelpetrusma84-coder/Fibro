// test-versie-plek.mjs (v265): het versienummer van een spel staat compact in Mijn stijl > Spellen, niet op de spelwidget
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const profiel = lees('profiel.html'), index = lees('index.html')
const rijen = profiel.match(/<div class="widget-versie" data-spelversie="[a-z]+"><\/div>/g) || []
assert.equal(rijen.length, 12, 'alle twaalf spellen in de lijst, compact (alleen het versienummer)')
assert.doesNotMatch(profiel, /data-spelversie-history/)
assert.match(profiel, /import \{ vulSpelVersies \} from "\.\/spelversies\.js\?v=\d+"\n[^\n]*\nkoppelSpelIcoonFallback\(\)\nvulSpelVersies\(\)/)
assert.doesNotMatch(index, /data-spelversie/, 'niet meer op de spelwidgets')
assert.doesNotMatch(index, /vulSpelVersies/)
console.log('PASS: spelversies staan in Mijn stijl > Spellen, niet op de widgets')
