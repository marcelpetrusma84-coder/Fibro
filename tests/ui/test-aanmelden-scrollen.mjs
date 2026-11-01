// v249 (31 okt 2026): de aanmeldpagina (login.html) kan weer op en neer scrollen.
// body had overflow:hidden en stond in het midden (align-items:center). Was het formulier hoger dan het scherm (Registreren
// op een telefoon, en zelfs op een computerscherm van 800 hoog), dan viel de onderkant weg en kon je niet bij
// 'Account aanmaken'. In de testbrowser nagemeten: vóór kon je niet scrollen (knop op 1173 px bij een scherm van 844),
// nu wel; een kort formulier (Inloggen) staat nog steeds in het midden.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const login = readFileSync(new URL('../../login.html', import.meta.url), 'utf8')
const body = login.match(/\n\s*body \{([^}]*)\}/)
assert.ok(body, 'body-regel gevonden')
assert.ok(!/(^|;)\s*overflow:\s*hidden/.test(body[1]), 'body mag niet meer alles afsnijden (geen overflow:hidden)')
assert.match(body[1], /overflow-x:hidden/, 'alleen opzij niets laten uitsteken')
assert.match(body[1], /align-items:flex-start/, 'een lang formulier begint bovenaan')
assert.match(login, /\.container \{[^}]*margin:auto 0;/, 'een kort formulier blijft in het midden (margin:auto)')
console.log('ok: de aanmeldpagina kan scrollen')
