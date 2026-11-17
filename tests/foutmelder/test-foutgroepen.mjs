// node tests/foutmelder/test-foutgroepen.mjs (17 nov 2026) - Moderatie > Fouten: dezelfde fout op één kaart, ook als
// hij op een andere regel of pagina gebeurde (voorbeelden uit de foutmeldingen van 7-13 nov 2026).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { groepeerFouten, kernBron, kernBericht } = await import('../../foutgroepen.js')
let ok = 0
const test = (naam, f) => { f(); ok++; console.log('OK  ', naam) }
let id = 0
const r = (t, pagina, soort, bericht, bron, toestel = 'iPhone iOS 18.7 · Safari 27.2') => ({ id: ++id, created_at: '2026-11-' + t, pagina, soort, bericht, bron, toestel, stapel: null })

const rijen = [
  r('09T15:33', 'index.html', 'fout', "ReferenceError: Can't find variable: FileReader", 'index.html:1144:36'),
  r('09T15:29', 'index.html', 'fout', "ReferenceError: Can't find variable: FileReader", 'index.html:1144:36'),
  r('09T15:30', 'index.html', 'fout', "ReferenceError: Can't find variable: FileReader", 'index.html:1542:36'),
  r('09T15:33', 'vriend-profiel.html', 'belofte', "ReferenceError: Can't find variable: indexedDB", ''),
  r('09T15:31', 'profiel.html', 'belofte', "ReferenceError: Can't find variable: indexedDB", ''),
  r('07T14:59', 'chat.html', 'belofte', 'Spelgesprek: na 20 s nog geen goed geluid', 'chat.html startSpelBel · verbonden=ja · speler1=ja', 'Windows · Edge 156'),
  r('07T14:59', 'chat.html', 'belofte', 'Spelgesprek: na 20 s nog geen goed geluid', 'chat.html startSpelBel · verbonden=ja · speler1=nee', 'Android 10 · Chrome 156'),
  r('09T20:14', 'profiel.html', 'fout', 'Laden mislukt: pacifico.css', 'pacifico.css', 'Windows · Chrome 157'),
  r('09T20:14', 'profiel.html', 'fout', 'Laden mislukt: lobster.css', 'lobster.css', 'Windows · Chrome 157'),
  r('13T11:21', 'index.html', 'belofte', 'TypeError: Script service-worker.js load failed', ''),
]
const g = groepeerFouten(rijen)

test('kern van bron en bericht', () => {
  assert.equal(kernBron('index.html:1144:36'), 'index.html')
  assert.equal(kernBron('chat.html startSpelBel · verbonden=ja'), 'chat.html startSpelBel')
  assert.equal(kernBron('bellen.js microfoon (spel) · toestemming microfoon: prompt'), 'bellen.js microfoon (spel)')
  assert.equal(kernBericht('x  bij aaaaaaaa-0000-4000-8000-000000000001 na 123456 ms'), 'x bij … na # ms')
  assert.equal(kernBericht('na 20 s'), 'na 20 s', 'korte getallen blijven')
})
test('FileReader op twee regels = één kaart van 3 keer, met beide varianten', () => {
  const f = g.find(x => x.bericht.includes('FileReader'))
  assert.equal(f.ids.length, 3); assert.equal(f.laatst, '2026-11-09T15:33'); assert.equal(f.eerst, '2026-11-09T15:29')
  assert.equal(f.varianten.length, 2)
})
test('indexedDB op profiel en vriend-profiel = één kaart met beide pagina\'s', () => {
  const f = g.filter(x => x.bericht.includes('indexedDB'))
  assert.equal(f.length, 1); assert.deepEqual([...f[0].paginas.keys()].sort(), ['profiel.html', 'vriend-profiel.html'])
})
test('spelgesprek van twee toestellen = één kaart; verschillende bestanden en soorten blijven apart', () => {
  const s = g.filter(x => x.bericht.startsWith('Spelgesprek'))
  assert.equal(s.length, 1); assert.equal(s[0].ids.length, 2); assert.equal(s[0].toestellen.size, 2)
  assert.equal(g.filter(x => x.bericht.startsWith('Laden mislukt')).length, 2, 'pacifico en lobster zijn andere bestanden')
  assert.equal(g.length, 6)
})
test('nieuwste bovenaan', () => {
  assert.equal(g[0].bericht, 'TypeError: Script service-worker.js load failed')
  for (let i = 1; i < g.length; i++) assert.ok(g[i - 1].laatst >= g[i].laatst)
})
test('moderatie.html gebruikt het', () => {
  const m = readFileSync(new URL('../../moderatie.html', import.meta.url), 'utf8')
  assert.match(m, /import \{ groepeerFouten \} from '\.\/foutgroepen\.js\?v=1'/)
  assert.match(m, /foutGroepen = groepeerFouten\(data \|\| \[\]\)/)
})
console.log(`\n${ok} van ${ok} goed`)
