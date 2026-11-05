// v266 (5 nov 2026): Home bleef op de iPhone soms half leeg (geen widgets, 'Opslag op dit apparaat —') tot je de app
// afsloot: het openen van de opslag op het toestel (IndexedDB) bleef hangen. openDB in index.html heeft nu een wekker:
// één verbinding voor de hele pagina, na 4 s nog een keer proberen, hangt ook dat: melden en één keer vanzelf herladen.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const begin = index.indexOf('let _fibroDB=null'), eind = index.indexOf('window.openDB=openDB')
assert.ok(begin > 0 && eind > begin, 'openDB met wekker gevonden')
const bron = index.slice(begin, eind) + 'window.openDB=openDB'
assert.match(index, /function openFibroDB\(\)\{return window\.openDB\(\)\}/, 'de module gebruikt dezelfde verbinding')
assert.equal((index.match(/indexedDB\.open\('FibroDB',2\)/g) || []).length, 1, 'nog maar één plek die de opslag opent')

function maak(gedrag) {
  let pogingen = 0, herladen = 0, gemeld = []
  const opslag = new Map()
  const indexedDB = { open() {
    const req = {}; const n = pogingen++
    const wat = gedrag[n] ?? 'hangt'
    if (wat === 'goed') setTimeout(() => req.onsuccess({ target: { result: { close() {}, naam: 'db' + n } } }), 10)
    if (wat === 'laat') setTimeout(() => req.onsuccess({ target: { result: { close() { req.dicht = true }, naam: 'laat' } } }), 4500)
    return req
  } }
  const window = { __fibroFoutmelder: { meld: (...a) => gemeld.push(a) } }
  const ctx = vm.createContext({ window, indexedDB, setTimeout, clearTimeout, Date,
    sessionStorage: { getItem: k => opslag.get(k) ?? null, setItem: (k, v) => opslag.set(k, v) },
    location: { reload: () => herladen++ }, Promise })
  vm.runInContext(bron, ctx)
  return { open: () => window.openDB(), info: () => ({ pogingen, herladen, gemeld }) }
}

// 1. gewoon: één keer openen, daarna dezelfde verbinding
let t = maak(['goed'])
const a = await t.open(), b = await t.open()
assert.equal(a, b, 'dezelfde verbinding'); assert.equal(t.info().pogingen, 1)

// 2. eerste keer hangt: na 4 s opnieuw, dan lukt het (geen herladen)
t = maak(['hangt', 'goed'])
const c = await t.open()
assert.equal(c.naam, 'db1'); assert.equal(t.info().pogingen, 2); assert.equal(t.info().herladen, 0)

// 3. alles hangt: melden en één keer herladen (niet steeds opnieuw)
t = maak(['hangt', 'hangt'])
await assert.rejects(t.open())
assert.equal(t.info().herladen, 1, 'één keer vanzelf opnieuw laden'); assert.equal(t.info().gemeld.length, 1, 'gemeld')
console.log('ok: Home opent de opslag met een wekker')
