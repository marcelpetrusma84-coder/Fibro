// test-widgets-lijst.mjs (27 nov 2026): widgets uit één lijst (widgets.js). Klopt de lijst, bestaat elk bestand met zijn
// tekenfunctie, en gebruiken Home, de Store en het profiel van een vriend de lijst (en niet meer losse regels)?
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const W = await import(new URL('../../widgets.js', import.meta.url))

assert.deepEqual(W.controleerLijst(), [], 'de lijst klopt')
assert.ok(W.WIDGET_LIJST.length >= 2)
for (const w of W.WIDGET_LIJST) {
  const bestand = w.bestand.slice(2).split('?')[0]
  assert.ok(existsSync(new URL('../../' + bestand, import.meta.url)), w.id + ': ' + bestand + ' bestaat')
  assert.match(lees(bestand), new RegExp('export (async )?function ' + w.teken + '\\('), w.id + ': ' + bestand + ' heeft ' + w.teken)
}
// fouten worden gevonden
assert.ok(W.controleerLijst([{ id: 'x' }]).length > 0)
assert.ok(W.controleerLijst([...W.WIDGET_LIJST, W.WIDGET_LIJST[0]]).some(f => f.startsWith('Dubbel')))
assert.equal(W.isPersoonlijk('casino'), true); assert.equal(W.isPersoonlijk('gastenboek'), false)
const store = W.storeDefs().find(s => s.id === 'casino')
assert.equal(store.widget, 'casino'); assert.equal(store.soort, 'widget'); assert.ok(store.uitlegEn.length > 20)

// Home, de Store en het profiel van een vriend gebruiken de lijst
const index = lees('index.html'), storeJs = lees('store.js'), vriend = lees('vriend-profiel.html')
assert.match(index, /\.\.\.homeDefs\(\)/); assert.match(index, /lijstWidget\(id\)/)
assert.match(storeJs, /\.\.\.storeDefs\(\)/)
assert.match(vriend, /isPersoonlijk\(w\.id\)/)
for (const w of W.WIDGET_LIJST) {
  assert.ok(!index.includes("id === '" + w.id + "'"), 'index.html tekent ' + w.id + ' niet meer apart')
  assert.ok(!new RegExp("id: '" + w.id + "', soort: 'widget'").test(storeJs), 'store.js heeft ' + w.id + ' niet meer apart')
}
// het sjabloon
assert.match(lees('sjabloon-widget.js'), /export function tekenSjabloonWidget\(c, \{/)
console.log('test-widgets-lijst: ' + W.WIDGET_LIJST.length + ' widgets uit één lijst')
