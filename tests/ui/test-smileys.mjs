// node tests/ui/test-smileys.mjs (17 nov 2026) - :) wordt 🙂 in de chat en de groepschat (smileys.js)
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { smileysNaarEmoji: om, zetOmTijdensTypen, SMILEYS } = await import('../../smileys.js')
let ok = 0
const test = (naam, f) => { f(); ok++; console.log('OK  ', naam) }

test('de bekende smileys worden emoji', () => {
  const v = { ':)': '🙂', ':-)': '🙂', ':(': '🙁', ':D': '😃', 'xD': '😆', ';)': '😉', ':P': '😛', ':p': '😛', ':O': '😮',
    ":'(": '😢', '<3': '❤️', '</3': '💔', ':*': '😘', 'B-)': '😎', ':/': '😕', '>:(': '😠', 'O:)': '😇', '^^': '😊', '(y)': '👍' }
  for (const [s, e] of Object.entries(v)) assert.equal(om(s), e, s)
})
test('in een zin, met leestekens, en meerdere', () => {
  assert.equal(om('hoi :) hoe gaat het :D'), 'hoi 🙂 hoe gaat het 😃')
  assert.equal(om('super :)!'), 'super 🙂!')
  assert.equal(om('ik hou van je <3 <3'), 'ik hou van je ❤️ ❤️')
  assert.equal(om('regel 1 :)\nregel 2 ;)'), 'regel 1 🙂\nregel 2 😉')
  assert.equal(om(':-) :-('), '🙂 🙁')
})
test('niet als het geen losse smiley is', () => {
  for (const t of ['https://stekky.nl', 'om 12:30', 'abc:)', 'punt 8)', 'B)', 'tijd:D', '3<3', 'Note:P', 'a^^b', '(yes)'])
    assert.equal(om(t), t, t)
})
test('tijdens typen: pas na een spatie, de cursor blijft goed', () => {
  assert.equal(zetOmTijdensTypen('hoi :)', 6), null, 'nog niet af: misschien wordt het :)) of iets anders')
  assert.equal(zetOmTijdensTypen('hoi :-', 6), null)
  const r = zetOmTijdensTypen('hoi :) ', 7)
  assert.deepEqual(r, { waarde: 'hoi 🙂 ', cursor: 'hoi 🙂 '.length })
  const m = zetOmTijdensTypen(':D en dan|rest :)', 9)  // cursor midden in de tekst: achter de cursor niets veranderen
  assert.equal(m.waarde, '😃 en dan|rest :)')
})
test('alle smileys hebben een emoji, chat en groep gebruiken het', () => {
  for (const [s, e] of Object.entries(SMILEYS)) { assert.ok(e && e !== s, s); assert.equal(om(s), e, s) }
  const chat = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
  const groep = readFileSync(new URL('../../groep.html', import.meta.url), 'utf8')
  assert.match(chat, /koppelSmileys\(document\.getElementById\('msgInput'\)\)/)
  assert.match(chat, /const tekst = smileysNaarEmoji\(input\.value\.trim\(\)\)/)
  assert.match(groep, /koppelSmileys\(document\.getElementById\('bericht'\)\)/)
  assert.match(groep, /const tekst = smileysNaarEmoji\(inv\.value\.trim\(\)\)/)
})
console.log(`\n${ok} van ${ok} goed`)
