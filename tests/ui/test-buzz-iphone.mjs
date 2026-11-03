// Buzz op de iPhone (3 nov 2026): het geluid via een gezegende geluidsspeler (buzzgeluid.js), niet meer via een
// AudioContext die Safari stilzet. Zie ook tests/tools/proef232.py (Chrome met de regel van de iPhone).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const code = s => s.replace(/^\s*\/\/.*$/gm, '')
const bz = lees('buzzgeluid.js'), m = lees('meldingen.js'), c = lees('chat.html')

// buzzgeluid.js: zegenen bij elke tik (ook touchend, zoals stickerfx), korte speler voor de geluidregelaar
assert.match(bz, /for \(const soort of \['pointerdown', 'touchend', 'click', 'keydown'\]\) document\.addEventListener\(soort, zegen/)
assert.match(bz, /a\.dataset\.stickerfx = '1'/)
assert.match(bz, /if \(wachtend && Date\.now\(\) - wachtend < 4000\) \{ wachtend = 0; speel\(\); return \}/, 'nog nooit getikt: bij de eerste tik alsnog')
assert.doesNotMatch(code(bz), /AudioContext/)

// het geluid zelf: dezelfde zoem als vroeger (1,1 s, hoogstens 0,28)
globalThis.document = undefined
const { buzzSamples } = await import('../../buzzgeluid.js')
const s = buzzSamples()
assert.equal(s.length, Math.round(22050 * 1.1))
let max = 0; for (const x of s) max = Math.max(max, Math.abs(x))
assert.ok(max > 0.25 && max <= 0.28 + 1e-6, 'luidheid ' + max)
assert.ok(s.slice(Math.round(22050 * 1.06)).every(x => x === 0), 'na 1,05 s stil')

// meldingen.js en chat.html gebruiken het, zonder eigen AudioContext voor de buzz
assert.match(m, /import \{ speelBuzz \} from '\.\/buzzgeluid\.js\?v=1'/)
assert.doesNotMatch(code(m), /gedeeldeCtx|new AC\(\)/)
assert.match(c, /import \{ speelBuzz \} from '\.\/buzzgeluid\.js\?v=1'/)
assert.match(c, /function speelBuzzGeluid\(\) \{ speelBuzz\(\) \}/)
for (const f of ['chat.html', 'index.html', 'vrienden.html', 'vriend-profiel.html', 'profiel.html', 'timer-melding.js']) assert.match(lees(f), /meldingen\.js\?v=188/, f)
console.log('buzz iphone: ok')
