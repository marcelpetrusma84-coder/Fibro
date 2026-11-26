// test-startkaart.mjs (26 nov 2026, Marcel): de kaart "Speel met een vriend" op Home (startkaart.js).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const opslag = new Map()
const ls = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)) }
const K = await import('../../startkaart.js')
const { SOLO_SPELLEN } = await import('../../solo.js').catch(() => ({ SOLO_SPELLEN: null }))
const { kanMetVriend } = await import('../../samenspelen.js')
const UID = 'aaaaaaaa-0000-4000-8000-000000000001'

// 1. alleen spellen die iedereen meteen heeft (geen download) en die met een vriend kunnen
assert.deepEqual(K.KAART_SPELLEN.map(s => s.id), ['vieroprij', 'botkaaseiren', 'schaken'])
for (const s of K.KAART_SPELLEN) assert.ok(kanMetVriend(s.id), s.id + ' kan met een vriend')
if (SOLO_SPELLEN) for (const s of K.KAART_SPELLEN) assert.ok(SOLO_SPELLEN[s.id] && !SOLO_SPELLEN[s.id].store, s.id + ' is geen downloadspel')
console.log('PASS: drie spellen zonder download, allemaal met een vriend te spelen')
// 2. klaar per account op dit toestel
assert.equal(K.isKlaar(ls, UID), false)
assert.equal(K.markeerKlaar(ls, UID), true)
assert.equal(K.isKlaar(ls, UID), true)
assert.equal(K.isKlaar(ls, 'aaaaaaaa-0000-4000-8000-000000000002'), false, 'een ander account heeft zijn eigen stand')
assert.equal(K.markeerKlaar(ls, '../x'), false, 'alleen een echt accountnummer')
assert.equal(K.isKlaar(ls, ''), true, 'zonder account geen kaart')
assert.equal(K.maakStartKaart({ uid: UID, vrienden: 2, ls }), null, 'klaar = geen kaart')
console.log('PASS: de kaart verdwijnt per account')
// 3. Home en spel.html
const home = lees('index.html'), spel = lees('spel.html')
assert.match(home, /import \{ maakStartKaart \} from '\.\/startkaart\.js\?v=\d+'/)
assert.match(home, /<div id="start-kaart-slot"><\/div>\s*<div id="home-sectie">/, 'boven de widgets')
assert.match(spel, /import \{ markeerKlaar \} from '\.\/startkaart\.js\?v=\d+'/)
assert.match(spel, /markeerKlaar\(localStorage, user\.id\)[\s\S]{0,200}const q = new URLSearchParams/, 'na een verstuurde uitnodiging')
console.log('PASS: de kaart staat op Home en spel.html markeert een verstuurde uitnodiging')
// 4. Engels
const en = lees('taal-en.js')
for (const z of ['Speel met een vriend', 'Kies een spel en nodig een vriend uit.', 'Nodig eerst een vriend uit, dan kun je samen spelen.', '+ Vriend uitnodigen', 'Sluiten'])
  assert.ok(en.includes(JSON.stringify(z) + ':'), 'Engels voor: ' + z)
console.log('PASS: ook in het Engels')
