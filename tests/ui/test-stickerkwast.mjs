// Stickerlab (v231): bijwerken met je vinger na 'Achtergrond weg', 'Lijn eromheen' of 'Alles houden':
// weghalen en terugzetten, met een kwast waarvan je de grootte instelt, en ongedaan maken.
// Het tekenen zelf (canvas) is in een echte browser getest; hier de rekenstukjes en de opbouw.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const { KWAST_MIN, KWAST_MAX, KWAST_STANDAARD, kwastStraal, voegPuntToe } = await import(new URL('../../stickerkwast.js', import.meta.url))

// 1. De grootte: wat je op het scherm ziet, omgerekend naar pixels van de afbeelding
assert.equal(kwastStraal(20, 640, 320), 20, 'afbeelding twee keer zo groot als op het scherm: straal 10 → 20')
assert.equal(kwastStraal(20, 320, 320), 10)
assert.equal(kwastStraal(1000, 320, 320), KWAST_MAX / 2, 'niet groter dan de grootste kwast')
assert.equal(kwastStraal(0, 320, 320), KWAST_STANDAARD / 2, 'geen waarde: de standaard')
assert.equal(kwastStraal(2, 320, 320), KWAST_MIN / 2, 'niet kleiner dan de kleinste kwast')
assert.equal(kwastStraal(20, 320, 0), 10, 'nog niet op het scherm: geen deling door nul')
assert.ok(KWAST_MIN < KWAST_STANDAARD && KWAST_STANDAARD < KWAST_MAX)

// 2. Punten van een streek: niet elk klein trillertje
{
  const s = { soort: 'gum', r: 8, punten: [[10, 10]] }
  assert.equal(voegPuntToe(s, [10.5, 10]), false, 'te dichtbij')
  assert.equal(voegPuntToe(s, [14, 10]), true)
  assert.deepEqual(s.punten, [[10, 10], [14, 10]])
  const leeg = { soort: 'terug', r: 8, punten: [] }
  assert.equal(voegPuntToe(leeg, [1, 1]), true, 'het eerste punt altijd')
}

// 3. Het Stickerlab gebruikt het, en alle nieuwe teksten bestaan in het Engels
const sm = lees('stickermaker.js')
assert.match(sm, /from '\.\/stickerkwast\.js\?v=1'/)
assert.match(lees('profiel.html'), /import \{ startStickermaker \} from '\.\/stickermaker\.js\?v=231'/, 'nieuwe versie geladen')
for (const id of ['smKwast', 'data-tuig']) assert.ok(sm.includes(id), id)
assert.match(sm, /\['gum', T\('🧽 Weghalen'\)\], \['terug', T\('🖌️ Terugzetten'\)\]/)
assert.match(sm, /streken\.pop\(\); verwerk\(\)/, 'ongedaan maken haalt de laatste streek weg')
assert.match(sm, /uit = b \? pasStrekenToe\(b, bron, streken\) : null/, 'streken blijven staan als het begin verandert')
{
  const blok = sm.match(/Object\.assign\(window\.FIBRO_EN \|\|= \{\}, (\{[\s\S]*?\})\)\n/)[1]
  const en = new Function('return ' + blok)()
  const nieuw = ['Begin met', 'Lijn eromheen', 'Bijwerken met je vinger', '✂️ Lijn', '🧽 Weghalen', '🖌️ Terugzetten', 'Grootte', '↶ Ongedaan maken', 'Opnieuw beginnen', 'Kwastgrootte',
    'Veeg met je vinger over wat weg moet.', 'Veeg met je vinger over wat terug moet komen.', 'Trek met je vinger een lijn om wat je wilt houden. Daarna kun je nog bijwerken.']
  for (const z of nieuw) {
    assert.ok(en[z], 'Engels ontbreekt: ' + z)
    assert.ok(sm.includes("T('" + z + "')"), 'gebruikt: ' + z)
  }
}
console.log('test-stickerkwast: alles goed')
