// Plaatjes van de spellen (30 okt 2026): in het spelmenu van de chat, de widgetlijst in Profiel en de spelwidgets
// op Home en bij een vriend staat een stukje uit het spel zelf (spelicoon/<spel>.webp, spelicoon.js).
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'

const pad = p => new URL('../../' + p, import.meta.url)
const lees = p => readFileSync(pad(p), 'utf8')
const SI = await import(pad('spelicoon.js'))
const { SPEL_VERSIES } = await import(pad('spelversies.js'))

// 1. Elk spel heeft een plaatje: WebP, 128 x 128, klein
assert.deepEqual([...SI.SPELLEN].sort(), Object.keys(SPEL_VERSIES).sort(), 'een plaatje voor elk spel')
for (const spel of SI.SPELLEN) {
  const f = 'spelicoon/' + spel + '.webp'
  assert.ok(existsSync(pad(f)), f)
  const b = readFileSync(pad(f))
  assert.equal(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12), 'RIFFWEBP', f + ' is WebP')
  assert.equal(b.toString('ascii', 12, 16), 'VP8X', f + ' heeft doorzichtige hoeken')
  assert.deepEqual([1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)], [128, 128], f + ' is 128 x 128')
  assert.ok(b.length < 12000, f + ' is klein')
}
assert.equal(SI.spelIcoonHtml('nietbestaand', 30), '', 'onbekend spel: geen plaatje (de emoji blijft)')
assert.match(SI.spelIcoonHtml('pong', 40), /^<img src="spelicoon\/pong\.webp\?v=\d+" width="40" height="40" alt=""/)

// 2. Het spelmenu in de chat: twaalf knoppen, elk met zijn eigen plaatje
const chat = lees('chat.html')
const knoppen = [...chat.matchAll(/startSpel\('(\w+)'\)"><span[^>]*><img src="spelicoon\/(\w+)\.webp\?v=(\d+)"/g)]
assert.equal(knoppen.length, 12)
for (const [, spel, plaatje, v] of knoppen) { assert.equal(spel, plaatje, 'knop ' + spel); assert.equal(Number(v), SI.VERSIE) }

// 3. De widgetlijst in Profiel: twaalf spellen, elk met zijn eigen plaatje
const profiel = lees('profiel.html')
const widgets = [...profiel.matchAll(/<img src="spelicoon\/(\w+)\.webp\?v=(\d+)"[^>]*><\/div><div><div class="widget-name" data-t>[^<]*<\/div><div class="widget-desc" data-t>[^<]*<\/div><\/div><\/div><div class="widget-versie" data-spelversie="(\w+)"/g)]
assert.equal(widgets.length, 12)
for (const [, plaatje, v, spel] of widgets) { assert.equal(plaatje, spel, 'widget ' + spel); assert.equal(Number(v), SI.VERSIE) }

// 4. Home en het profiel van een vriend gebruiken spelicoon.js
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(lees(f), /import \{ spelIcoonHtml \} from '\.\/spelicoon\.js\?v=\d+'/, f)
assert.match(lees('index.html'), /const icon = spelIcoonHtml\(spel, 40\) \|\| ICONEN\[spel\]/)
assert.match(lees('vriend-profiel.html'), /spelIcoonHtml\(spel, 40\) \|\| vEsc\(w\.icon/)

console.log('ok: plaatjes uit de spellen (' + SI.SPELLEN.length + ')')
