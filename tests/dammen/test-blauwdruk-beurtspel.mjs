// Blauwdruk beurtspellen (3 nov 2026): elk beurtspel krijgt vanzelf de chatbalk en de webcamrondjes.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const chat = lees('chat.html')

const lijst = chat.match(/const BEURTSPELLEN = (\[[^\]]*\])/)
assert.ok(lijst, 'BEURTSPELLEN staat in chat.html')
const BEURTSPELLEN = JSON.parse(lijst[1].replace(/'/g, '"'))
assert.deepEqual(BEURTSPELLEN, ['botkaaseiren', 'vieroprij', 'schaken', 'dammen', 'pesten', 'toepen', 'eenentwintigen'])   // 11 nov 2026: de kaartspellen
assert.match(chat, /const SPELCHAT_SPELLEN = BEURTSPELLEN/, 'de chatbalk komt uit dezelfde lijst')
assert.match(chat, /BEURTSPELLEN\.map\(spel => \[spel, 'groot'\]\)/, 'de webcamrondjes komen uit dezelfde lijst (v265: schaken ook)')
assert.match(chat, /window\.addEventListener\('fibro-spel-geslagen', kleurRondjeRood\)/)
assert.match(chat, /window\.addEventListener\('fibro-dam-geslagen', kleurRondjeRood\)/, 'dammen blijft werken')
// elk beurtspel kan echt gestart worden
for (const spel of BEURTSPELLEN) {
    assert.match(chat, new RegExp("else if \\(spelType === '" + spel + "'\\) await start|if \\(spelType === '" + spel + "'\\) await start"), spel + ' wordt gestart')
}

const hulp = lees('beurtspel-hulp.js')
for (const naam of ['webcamRuimte', 'opWebcamWissel', 'meldGeslagen', 'geslagenGeluid', 'isSolo']) assert.match(hulp, new RegExp('export function ' + naam + '\\('))
assert.match(hulp, /new CustomEvent\('fibro-spel-geslagen'/)

const sj = lees('sjabloon-beurtspel-ui.js')
assert.match(sj, /export function start\(\{ Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam \}\)/)
for (const ev of ['zet', 'vraag-stand', 'stand', 'opnieuw']) assert.match(sj, new RegExp("event: '" + ev + "'"), 'sjabloon luistert naar ' + ev)
assert.match(sj, /beurtspel-hulp\.js\?v=1/)
const en = lees('taal-en.js')
for (const m of sj.matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) assert.ok(en.includes(JSON.stringify(m[1]) + ':'), 'Engels voor: ' + m[1])
assert.match(lees('BLAUWDRUK-BEURTSPEL.md'), /BEURTSPELLEN/)
console.log('blauwdruk beurtspel: ok')
