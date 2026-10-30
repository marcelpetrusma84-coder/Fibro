// Stickerlab 'Tik op het onderwerp' (v232, onderwerp.js): de rekenstukjes, de bestanden met hun sha512 uit
// BIBLIOTHEKEN.txt, de huisregel (alleen Profiel mag WebAssembly) en de vertalingen.
// Het echte knippen (MediaPipe + MagicTouch) is in een echte browser getest met foto's van een kat en een kopje.
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const pad = p => new URL('../../' + p, import.meta.url)
const lees = p => readFileSync(pad(p), 'utf8')
const { kanHet, naarStreken, zekerheidNaarAlfa } = await import(pad('onderwerp.js'))

// 1. Rekenstukjes
assert.equal(kanHet(), true, 'Node kan WebAssembly met SIMD')
assert.deepEqual(naarStreken([{ x: 50, y: 25 }], 100, 100),
  [{ brushMode: 1, point: [{ x: 0.5, y: 0.25 }, { x: 0.5, y: 0.25 }], isCompleted: true }])
assert.equal(naarStreken([{ x: 10, y: 10, erbij: false }], 100, 100)[0].brushMode, 2, 'eraf = negatief')
assert.deepEqual(naarStreken([{ x: -5, y: 500 }], 100, 100)[0].point[0], { x: 0, y: 1 }, 'binnen de afbeelding')
assert.deepEqual(naarStreken(null, 100, 100), [])
assert.equal(zekerheidNaarAlfa(0), 0); assert.equal(zekerheidNaarAlfa(0.2), 0)
assert.equal(zekerheidNaarAlfa(1), 255); assert.equal(zekerheidNaarAlfa(0.9), 255)
assert.ok(zekerheidNaarAlfa(0.5) > 0 && zekerheidNaarAlfa(0.5) < 255, 'zachte rand')

// 2. De bestanden staan er, ongewijzigd (sha512 zoals in BIBLIOTHEKEN.txt)
const bib = lees('BIBLIOTHEKEN.txt')
for (const [bestand, naam] of [['onderwerp/vision_bundle.mjs', 'vision_bundle.mjs'], ['onderwerp/wasm/vision_wasm_internal.js', 'vision_wasm_internal.js'], ['onderwerp/wasm/vision_wasm_internal.wasm', 'vision_wasm_internal.wasm']]) {
  const h = createHash('sha512').update(readFileSync(pad(bestand))).digest('hex')
  assert.ok(bib.includes('sha512 ' + naam + ': ' + h), 'sha512 klopt: ' + bestand)
}
{
  const h = createHash('sha512').update(readFileSync(pad('onderwerp/interactive_segmentation.task'))).digest('hex')
  assert.ok(bib.includes('sha512: ' + h), 'sha512 klopt: het model')
  assert.ok(statSync(pad('onderwerp/interactive_segmentation.task')).size > 20e6, 'het echte model, geen leeg bestand')
}
assert.match(lees('onderwerp/LICENSE.txt'), /Apache License\s+Version 2\.0/)
const ow = lees('onderwerp.js')
assert.match(ow, /const BIBLIOTHEEK = '\.\/onderwerp\/vision_bundle\.mjs'/)
assert.match(ow, /const MODEL = 'onderwerp\/interactive_segmentation\.task'/)
assert.match(ow, /delegate: 'CPU'/)
assert.doesNotMatch(ow, /https?:\/\//, 'niets van andere websites')

// 3. De huisregel: alleen Profiel (waar het Stickerlab is) mag WebAssembly starten
assert.match(lees('profiel.html'), /script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';/)
for (const p of ['index.html', 'chat.html', 'login.html', 'over.html']) assert.doesNotMatch(lees(p), /wasm-unsafe-eval/, p)

// 4. Het Stickerlab: de keuze, het laden pas bij gebruik, en de vertalingen
const sm = lees('stickermaker.js')
assert.match(sm, /import \{ kanHet as kanOnderwerp, laadKnipper \} from '\.\/onderwerp\.js\?v=1'/)
assert.match(sm, /\['onderwerp', T\('✨ Tik op het onderwerp'\)\]/)
assert.match(sm, /if \(!kanOnderwerp\(\)\) modusKnop\.onderwerp\.hidden = true/, 'oude toestellen zien de knop niet')
assert.doesNotMatch(sm, /^import .*vision_bundle/m, 'de bibliotheek wordt niet meteen geladen')
assert.match(lees('profiel.html'), /stickermaker\.js\?v=232'/)
{
  const blok = sm.match(/Object\.assign\(window\.FIBRO_EN \|\|= \{\}, (\{[\s\S]*?\})\)\n/)[1]
  const en = new Function('return ' + blok)()
  const nieuw = ['✨ Tik op het onderwerp', '👆 Aanwijzen', 'Tik of druk op wat je als sticker wilt. Daarna kun je nog bijwerken.',
    'Tik op nog een stuk om het erbij te nemen.', 'De slimme knipper wordt geladen. Dat gebeurt maar één keer en kan even duren (± 45 MB).',
    'Even denken…', 'Dit toestel of deze browser kan dit niet. Kies een andere manier.',
    'Het slimme knippen lukte niet. Probeer het nog eens, of kies een andere manier.', 'Tik eerst op het onderwerp.']
  for (const z of nieuw) {
    assert.ok(en[z], 'Engels ontbreekt: ' + z)
    assert.ok(sm.includes("T('" + z + "')"), 'gebruikt: ' + z)
  }
}
console.log('test-onderwerp: alles goed')
