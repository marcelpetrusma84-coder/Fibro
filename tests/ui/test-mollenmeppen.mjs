// test-mollenmeppen.mjs (26 nov 2026, Marcel): Mollen meppen, de mini-game in de wachtkamer (mollenmeppen.js).
// Het tempo, het record (per account op dit toestel), en dat het in beide wachtschermen staat.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const opslag = new Map()
globalThis.localStorage = { get length() { return opslag.size }, key: i => [...opslag.keys()][i] ?? null,
  getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)), removeItem: k => opslag.delete(k) }
const M = await import('../../mollenmeppen.js')

// 1. raster en ronde
assert.equal(M.GROOTTE, 4, 'een raster van 4 bij 4')
assert.equal(M.RONDE_MS, 30000, 'een ronde duurt 30 seconden')
// 2. het gaat steeds sneller
const a = M.tempo(0), b = M.tempo(15000), c = M.tempo(30000)
assert.ok(a.elke > b.elke && b.elke > c.elke && a.blijft > c.blijft, 'steeds sneller')
assert.ok(c.elke >= 400 && c.blijft >= 500, 'op het eind nog te doen')
assert.deepEqual(M.tempo(-5), a); assert.deepEqual(M.tempo(99999), c)
console.log('PASS: 4x4, 30 seconden, steeds sneller (' + a.elke + ' -> ' + c.elke + ' ms)')

// 3. record per account
assert.equal(M.leesRecord(), 0)
assert.equal(M.bewaarRecord(7), true, 'eerste score = record')
assert.equal(M.bewaarRecord(5), false, 'lager is geen record')
assert.equal(M.leesRecord(), 7)
assert.ok(opslag.has('fibro_mollen_record_lokaal'))
opslag.set('sb-x-auth-token', JSON.stringify({ user: { id: 'u-marcel' } }))
assert.equal(M.leesRecord(), 0, 'een ander account heeft zijn eigen record')
M.bewaarRecord(12); assert.equal(opslag.get('fibro_mollen_record_u-marcel'), '12')
console.log('PASS: het record wordt per account onthouden')
assert.equal(M.GELUIDEN.length, 4, 'vier grappige geluidjes')

// 4. in beide wachtschermen
const chat = lees('chat.html')
assert.match(chat, /import \{ molKnop \} from '\.\/mollenmeppen\.js\?v=\d+'/)
assert.match(chat, /function toonSpelWachtscherm\(\) \{[\s\S]{0,2500}molKnop\(scherm\)/, 'op het wachtscherm in de chat')
const gk = lees('groepkaartspel.js')
assert.match(gk, /import \{ molKnop \} from '\.\/mollenmeppen\.js\?v=\d+'/)
assert.match(gk, /function toonLobby\(\) \{[\s\S]{0,3500}if \(mol && !mol\.gestopt\) kaart\.appendChild\(mol\.el\)[\s\S]{0,200}molKnop\(houder\)/, 'in de wachtkamer van de groep, en hij verhuist mee')
// 5. stopt vanzelf als het wachtscherm weg is
assert.match(lees('mollenmeppen.js'), /if \(!el\.isConnected\) \{ stop\(\); return \}/)
// 6. Engels
const en = lees('taal-en.js')
for (const z of ['Mollen meppen', '🔨 Mollen meppen terwijl je wacht', 'Gat {n}', 'Record: {n}', '▶ Start', 'Tik op de mollen!', 'Nieuw record: {n}!', '{n} mollen! Record: {r}', 'Nog een keer'])
  assert.ok(en.includes(JSON.stringify(z) + ':'), 'Engels voor: ' + z)
console.log('PASS: in het wachtscherm van de chat en de wachtkamer van de groep, ook in het Engels')
