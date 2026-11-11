// v244 (1 nov 2026):
// 1. Hoor je al 2 minuten niets van je vriend in een spel (status 'waiting'), dan de vraag: blijven wachten of sluiten.
// 2. Het wachtscherm en de verbindingsteksten volgen bij schaken de taal van het schaakspel.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const chat = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
const deel = (van, tot) => { const a = chat.indexOf(van); assert.ok(a >= 0, van); const b = chat.indexOf(tot, a); assert.ok(b > a, tot); return chat.slice(a, b) }

// 1. vriend weg
assert.match(chat, /const VRIEND_WEG_MS = 2 \* 60 \* 1000/)
const volg = deel('function volgVriendWeg(status)', 'function toonVriendWegVraag()')
assert.match(volg, /if \(status !== 'waiting'\) \{\n      clearTimeout\(spelVriendWegTimer\); spelVriendWegTimer = null\n      document\.getElementById\('spelVriendWegVraag'\)\?\.remove\(\)/, 'komt je vriend terug (of andere status), dan weg met timer en vraag')
assert.match(volg, /if \(spelVriendWegTimer \|\| document\.getElementById\('spelVriendWegVraag'\)\) return/, 'niet opnieuw starten als hij al loopt')
const vraag = deel('function toonVriendWegVraag()', 'function toonSpelVerbindingStatus(status)')
assert.match(vraag, /if \(!inhoud \|\| !spelActief \|\| spelGestopt \|\| !spelKanaal \|\| fibroChessTest\?\.active\) return/)
assert.match(vraag, /if \(laatsteSpelVerbindingStatus !== 'waiting'/, 'alleen als je vriend nog steeds stil is')
assert.match(vraag, /wacht\.onclick = \(\) => \{ box\.remove\(\); if \(laatsteSpelVerbindingStatus === 'waiting'\) volgVriendWeg\('waiting'\) \}/, 'blijven wachten: over 2 minuten weer vragen')
assert.match(vraag, /sluit\.onclick = \(\) => window\.sluitSpel\(\)/, 'sluiten meldt het ook aan je vriend')
const status = deel('function toonSpelVerbindingStatus(status)', 'function toonSpelMelding(tekst)')
assert.ok(status.indexOf('laatsteSpelVerbindingStatus = status') < status.indexOf('volgVriendWeg(status)'), 'eerst de status onthouden')
assert.ok(status.indexOf("getElementById('spelWachtExtra')") < status.indexOf('volgVriendWeg(status)'), 'niet op het wachtscherm (daar is een eigen melding)')
const sluit = deel('window.sluitSpel = function(stil)', '// ─── Boter-Kaas-Eieren')
assert.match(sluit, /clearTimeout\(spelVriendWegTimer\); spelVriendWegTimer = null/)

// 2. schaaktaal: de teksten van het wachtscherm, de verbinding en 'vriend weg' staan in schaak-taal-en.js
const { SCHAAK_EN } = await import('../../schaak-taal-en.js')
for (const k of ['⏳ Wachten tot {naam} in het spel zit...', '{naam} is er na 2 minuten nog niet. Probeer het later opnieuw, of wacht nog even.',
  'Verbinding herstellen; je spel blijft open.', 'Wachten op internet; je spel blijft open.', 'Wachten op je vriend; je spel blijft open.',
  'Spel met je vriend openen…', '{naam} heeft het spel verlaten.', '{naam} reageert al 2 minuten niet. Misschien is {naam} weg.', 'Blijven wachten',
  'Annuleren', 'Sluiten'])
  assert.ok(Object.hasOwn(SCHAAK_EN, k), 'schaak-Engels voor ' + k)
const scherm = deel('function toonSpelWachtscherm()', '// v244: hoor je al 2 minuten niets')
assert.doesNotMatch(scherm, /[^l]T\('/, 'het wachtscherm gebruikt overal spelT')
assert.match(chat, /toonSpelMelding\(spelT\('\{naam\} heeft het spel verlaten\.'/)
// nieuwe schaakteksten: verse versies, zodat iedereen ze ophaalt
assert.match(readFileSync(new URL('../../schaak-taal.js', import.meta.url), 'utf8'), /schaak-taal-en\.js\?v=13/)
assert.match(chat, /schaak-taal\.js\?v=13/)

// de app-taal (Engels) heeft ook de nieuwe teksten
globalThis.window = {}
new Function('window', readFileSync(new URL('../../taal-en.js', import.meta.url), 'utf8'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const k of ['{naam} reageert al 2 minuten niet. Misschien is {naam} weg.', 'Blijven wachten', 'Sluiten'])
  assert.ok(Object.hasOwn(EN, k), 'Engels voor ' + k)
delete globalThis.window

console.log('ok: na 2 minuten stilte de vraag blijven wachten of sluiten; wachtscherm volgt de schaaktaal')
