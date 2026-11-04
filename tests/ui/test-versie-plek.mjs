// test-versie-plek.mjs (v265): de versie van een spel (met versiehistorie) staat in Mijn stijl > Spellen, niet op de spelwidget
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const profiel = lees('profiel.html'), index = lees('index.html')
const rijen = profiel.match(/<div class="widget-versie" data-spelversie="[a-z]+" data-spelversie-history><\/div>/g) || []
assert.equal(rijen.length, 12, 'alle twaalf spellen in de lijst met versiehistorie')
assert.match(profiel, /\.widget-versie\[data-spelversie-history\]\{order:3;flex:1 0 100%/, 'onder het spel, over de hele breedte')
assert.match(profiel, /import \{ vulSpelVersies \} from "\.\/spelversies\.js\?v=\d+"\n[^\n]*\nkoppelSpelIcoonFallback\(\)\nvulSpelVersies\(\)/)
assert.doesNotMatch(index, /data-spelversie/, 'niet meer op de spelwidgets')
assert.doesNotMatch(index, /vulSpelVersies/)
console.log('PASS: spelversies staan in Mijn stijl > Spellen, niet op de widgets')
