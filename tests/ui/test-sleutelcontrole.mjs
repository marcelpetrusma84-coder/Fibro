// v266 (5 nov 2026): "Sleutel controleren" (sleutelcontrole.js): elkaars sleutel controleren met een QR-code of 60 cijfers.
// Standaard uit (☰ > Instellingen > 🔐 Sleutels controleren). Gecontroleerd = ✅; verandert een sleutel, dan is het ✅ weg.
// (In een testbrowser ook nagelopen: de QR-code is leesbaar met jsQR en klopt bij de vriend, "De cijfers kloppen" geeft ✅,
// een nieuwe sleutel haalt het ✅ weg.)
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const opslag = new Map()
globalThis.localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)), removeItem: k => opslag.delete(k) }
const SC = await import('../../sleutelcontrole.js')

// 1. Het veiligheidsnummer: 60 cijfers, voor allebei hetzelfde, anders bij een andere sleutel of ander account
const sleutel = async () => {
  const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  return Buffer.from(await crypto.subtle.exportKey('spki', k.publicKey)).toString('base64')
}
const [A, B, C] = [await sleutel(), await sleutel(), await sleutel()]
const n1 = await SC.veiligheidsnummer('aaa', A, 'bbb', B)
assert.match(n1, /^\d{60}$/)
assert.equal(await SC.veiligheidsnummer('bbb', B, 'aaa', A), n1, 'voor allebei hetzelfde')
assert.notEqual(await SC.veiligheidsnummer('aaa', A, 'bbb', C), n1, 'andere sleutel van de vriend')
assert.notEqual(await SC.veiligheidsnummer('aaa', C, 'bbb', B), n1, 'andere eigen sleutel')
assert.notEqual(await SC.veiligheidsnummer('aaa', A, 'ccc', B), n1, 'ander account')
await assert.rejects(SC.veiligheidsnummer('aaa', A, 'aaa', B), 'niet met jezelf')
assert.deepEqual(SC.groepjes(n1).length, 12)

// 2. De QR-code: wie, aan wie, en het nummer; scannen vergelijkt met wat je zelf hebt
const qr = SC.qrTekst('aaa', 'bbb', n1)
assert.deepEqual(SC.leesQr(qr), { van: 'aaa', naar: 'bbb', cijfers: n1 })
assert.equal(SC.leesQr('https://example.com'), null)
assert.equal(SC.leesQr('fibro-sleutel:1:aaa:bbb:123'), null)
assert.equal(SC.vergelijkScan(qr, 'bbb', 'aaa', n1), 'goed', 'Bram scant de code van Marcel: klopt')
assert.equal(SC.vergelijkScan(qr, 'bbb', 'aaa', await SC.veiligheidsnummer('bbb', B, 'aaa', C)), 'anders', 'iemand zette een andere sleutel tussen')
assert.equal(SC.vergelijkScan(qr, 'ccc', 'aaa', n1), 'ander-account')
assert.equal(SC.vergelijkScan(SC.qrTekst('aaa', 'ddd', n1), 'bbb', 'aaa', n1), 'ander-account', 'code voor iemand anders bedoeld')
assert.equal(SC.vergelijkScan('onzin', 'bbb', 'aaa', n1), 'geen')

// 3. Standaard uit; gecontroleerd hoort bij het nummer (verandert een sleutel, dan niet meer gecontroleerd)
assert.equal(SC.controleAan(), false, 'standaard uit')
SC.zetControle(true); assert.equal(SC.controleAan(), true)
assert.equal(SC.isGecontroleerd('aaa', 'bbb', n1), false)
opslag.set('fibro_gecontroleerd_aaa_bbb', n1)
assert.equal(SC.isGecontroleerd('aaa', 'bbb', n1), true)
assert.equal(SC.isGecontroleerd('aaa', 'bbb', await SC.veiligheidsnummer('aaa', A, 'bbb', C)), false, 'nieuwe sleutel: niet meer gecontroleerd')

// 4. Chat, menu, bibliotheek en vertalingen
const chat = lees('chat.html'), index = lees('index.html')
assert.match(chat, /<button id="sleutelKnop" type="button" hidden/, 'knop in de chat, standaard verborgen')
assert.match(chat, /import \{ werkKnopBij as werkSleutelKnopBij \} from '\.\/sleutelcontrole\.js\?v=\d+'/)
assert.match(chat, /async function controleerVriendSleutel\(vriendId, pub\) \{\n    werkSleutelKnop\(\)/, 'bij elke chat en elke nieuwe sleutel bijwerken')
assert.match(chat, /mijnPub = await eigenPubliekeSleutel\(mijnPrivateKey\)/, 'eigen sleutel van dit toestel, niet van de server')
assert.match(index, /b\.id = 'menuSleutelcontrole'/)
assert.match(index, /localStorage\.getItem\('fibro_sleutelcontrole'\) === '1'/, 'menu: standaard uit')
const bib = lees('BIBLIOTHEKEN.txt')
const sha = createHash('sha512').update(readFileSync(new URL('../../vendor/jsqr/jsQR.js', import.meta.url))).digest('hex')
assert.ok(bib.includes('sha512: ' + sha), 'jsQR ongewijzigd (sha512 in BIBLIOTHEKEN.txt)')
assert.ok(lees('vendor/jsqr/LICENSE.txt').includes('Apache License'))
const en = lees('taal-en.js')
for (const zin of ['🔐 Sleutel controleren met {naam}', '✅ De cijfers kloppen', '📷 Scan de code van {naam}', 'Nog niet gecontroleerd']) assert.ok(en.includes(JSON.stringify(zin)), 'Engels: ' + zin)
console.log('ok: sleutels controleren')
