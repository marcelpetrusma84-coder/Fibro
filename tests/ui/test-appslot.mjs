// v266 (5 nov 2026): het app-slot (appslot.js): Fibro op slot met Face ID, vingerafdruk of een pincode.
// Standaard uit; alleen op slot na de gekozen tijd weg; bellen gaat voor; pincode alleen als hash; na 5 keer fout wachten.
// (In een testbrowser ook helemaal doorgelopen: instellen, op slot na 60 s, verkeerde/goede pincode, oproep boven het slot,
// ander account geen slot, vergeten = uitloggen.)
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const bron = lees('appslot.js')

// 1. Draaien in een nep-browser
const opslag = new Map()
const localStorage = {
  getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)), removeItem: k => opslag.delete(k),
  key: i => [...opslag.keys()][i] ?? null, get length() { return opslag.size },
}
const klassen = new Set()
const nepEl = () => ({ style: {}, setAttribute() {}, appendChild() {}, set textContent(v) {}, classList: { add() {}, remove() {} } })
const document = {
  documentElement: { classList: { add: k => klassen.add(k), remove: k => klassen.delete(k), contains: k => klassen.has(k) }, appendChild() {} },
  head: { appendChild() {} }, body: null, visibilityState: 'visible',
  createElement: nepEl, addEventListener() {},
}
const window = { localStorage, document, addEventListener() {}, T: null }
const ctx = vm.createContext({ window, localStorage, document, crypto: webcrypto, TextEncoder, btoa, atob, setInterval() {}, setTimeout, CustomEvent: class {}, navigator: {}, location: { pathname: '/Fibro/index.html' }, Math, Date, JSON, String, Promise, Uint8Array, console })
vm.runInContext(bron, ctx)
const S = window.FibroSlot
assert.ok(S && S._intern, 'FibroSlot geladen')
const { moetDicht, wachtNa, geldigePin, hashPin, maakPin, MARGE_MS } = S._intern

// 2. Wanneer gaat het slot dicht?
const nu = 1_800_000_000_000
const aan = m => ({ aan: true, minuten: m, uid: 'u1', pin: { zout: 'x', hash: 'y', iter: 1 } })
assert.equal(moetDicht(null, nu, nu - 3600e3, 'u1'), false, 'standaard uit')
assert.equal(moetDicht({ ...aan(1), aan: false }, nu, nu - 3600e3, 'u1'), false, 'uitgezet')
assert.equal(moetDicht(aan(1), nu, nu - 30e3, 'u1'), false, '30 s weg bij 1 minuut: open')
assert.equal(moetDicht(aan(1), nu, nu - 61e3, 'u1'), true, '61 s weg bij 1 minuut: dicht')
assert.equal(moetDicht(aan(15), nu, nu - 10 * 60e3, 'u1'), false)
assert.equal(moetDicht(aan(15), nu, nu - 16 * 60e3, 'u1'), true)
assert.equal(moetDicht(aan(0), nu, nu - 3e3, 'u1'), false, 'meteen: naar een andere pagina van Fibro telt niet')
assert.equal(moetDicht(aan(0), nu, nu - MARGE_MS - 1, 'u1'), true, 'meteen: wel na even weg')
assert.equal(moetDicht(aan(1), nu, nu - 3600e3, 'u2'), false, 'ander account op dit toestel: geen slot')
assert.equal(moetDicht(aan(1), nu, nu - 3600e3, null), false, 'niet ingelogd: geen slot')
assert.equal(moetDicht({ ...aan(1), pin: null }, nu, nu - 3600e3, 'u1'), false, 'zonder pincode nooit dicht (anders kom je er niet meer in)')
assert.equal(moetDicht(aan(7), nu, nu - 3600e3, 'u1'), false, 'onbekende tijd: niet dicht')

// 3. Pincode: 4 tot 6 cijfers, alleen een hash, en wachten na 5 keer fout
assert.ok(geldigePin('1234') && geldigePin('123456') && !geldigePin('123') && !geldigePin('1234567') && !geldigePin('12a4'))
const p = await maakPin('2468')
assert.ok(p.hash && p.zout && p.iter >= 100000, 'PBKDF2 met veel rondes')
assert.ok(!JSON.stringify(p).includes('2468'), 'de pincode zelf wordt niet bewaard')
assert.equal(await hashPin('2468', p.zout, p.iter), p.hash, 'goede pincode klopt')
assert.notEqual(await hashPin('2469', p.zout, p.iter), p.hash, 'verkeerde pincode klopt niet')
assert.equal(wachtNa(4), 0); assert.equal(wachtNa(5), 30000); assert.equal(wachtNa(6), 60000); assert.equal(wachtNa(50), 15 * 60000)

// 3b. Altijd twee manieren (op verzoek van Marcel): pincode én Face ID/vingerafdruk. Bij Bewaren vraagt de telefoon meteen
// (nog in de tik) om Face ID; mislukt dat, dan wordt er niets bewaard. Alleen een toestel zonder Face ID krijgt alleen de pincode.
assert.match(bron, /var bioKlaar = cred \|\| !kan \? Promise\.resolve\(cred\) : maakBiometrie\(\)/, 'Face ID verplicht als het toestel het kan')
assert.ok(bron.indexOf('maakBiometrie().then(function (id) { cred = id') < bron.indexOf('return nieuwePin ? maakPin(p1)'), 'Face ID eerst (in de tik), daarna de pincode')
assert.match(bron, /throw null\n      \}\)\.then\(klaar,/, 'Face ID mislukt: niet bewaren')
assert.ok(!/Ook Face ID of vingerafdruk gebruiken/.test(bron), 'geen losse knop meer om Face ID over te slaan')
assert.match(bron, /T\('of met je pincode'\)/, 'op het slot: Face ID-knop en daaronder de pincode')
// (In een testbrowser met een nep-Face ID nagelopen: bewaren = pincode + Face ID, ontgrendelen met allebei, niet herkend = dicht,
// toestel zonder Face ID = alleen pincode met uitleg.)

// 4. Bellen gaat voor, en de pagina's
assert.match(bron, /html\.fibro-slot-dicht #oproepModal\{z-index:100001!important\}/, 'oproepvenster van de chat boven het slot')
assert.match(bron, /#fibroSlot\{position:fixed;inset:0;z-index:99990;/, 'slot onder het oproepvenster van bel-luisteraar.js (100000)')
assert.match(lees('bel-luisteraar.js'), /z-index:100000/)
assert.ok(!lees('bellen.html').includes('appslot.js'), 'het belscherm heeft geen slot')
for (const f of ['login.html', 'invite.html']) assert.ok(!lees(f).includes('appslot.js'), f + ' heeft geen slot')
for (const f of ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html', 'spel.html', 'setup.html', 'moderatie.html']) {
  const s = lees(f)
  assert.match(s, /<script src="appslot\.js\?v=\d+"><\/script>/, f + ' laadt het slot')
  assert.ok(s.indexOf('appslot.js') < s.indexOf('<body'), f + ': in <head>, zodat er niets zichtbaar is voor het slot')
}
assert.match(lees('spellen/runner-gunner.html'), /<script src="\.\.\/appslot\.js\?v=\d+"><\/script>/)
assert.match(lees('index.html'), /b\.id = 'menuAppSlot'/, 'in het menu')
const en = lees('taal-en.js')
for (const zin of ['Stekky is op slot', 'Ontgrendelen', 'Pincode vergeten? Uitloggen', '🔒 App-slot']) assert.ok(en.includes(JSON.stringify(zin)), 'Engels: ' + zin)
console.log('ok: app-slot')
