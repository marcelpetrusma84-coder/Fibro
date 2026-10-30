// Four in a Row v2 (30 okt 2026): plastic speelgoed en vallende schijven (vieroprij-ui.js).
// Het tekenen en vallen is in een echte browser bekeken en gemeten; hier: de opbouw, de zetten, Engels en ?v=.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const vor = lees('vieroprij-ui.js')

// 1. Plastic: een rek met gaten (masker), pootjes, glimmende schijven; vallen en nastuiteren
for (const stuk of ['vorPlastic', 'vorGaten', '.vor-poot', '.vor-schijf.rood', '.vor-schijf.geel', '@keyframes vorVal', '--val', '--duur', '.vor-schijf.win', 'prefers-reduced-motion'])
  assert.ok(vor.includes(stuk), 'vieroprij-ui.js bevat ' + stuk)
assert.ok(!/https?:\/\//.test(vor.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'niets van buiten')

// 2. De zet van de ander: alleen geldig op zijn beurt, in een bestaande kolom; de rij rekent dit scherm zelf uit
assert.match(vor, /if \(kleur !== vriendKleur \|\| gameOver \|\| mijnBeurt \|\| !Number\.isInteger\(kolom\) \|\| kolom < 0 \|\| kolom >= KOLOMMEN\) return/)
assert.match(vor, /const rij = eersteVrijeRij\(kolom\)\n    if \(rij === -1\) return/)
// Het bericht is hetzelfde gebleven (een oudere versie aan de andere kant begrijpt het nog)
assert.match(vor, /payload: \{ kolom, rij, kleur: mijnKleur \}/)
assert.ok(!vor.includes('huidigLevel'), "de oude 'level-update' (met een variabele die niet bestond) is weg")

// 3. Engels voor elke tekst
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const m of vor.matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) {
  const sleutel = m[1].replace(/\\u([0-9a-f]{4})/gi, (x, h) => String.fromCharCode(parseInt(h, 16)))
  assert.ok(Object.prototype.hasOwnProperty.call(EN, sleutel), 'Engels voor "' + sleutel + '"')
}
delete globalThis.window

// 4. Overal dezelfde ?v=, en een hoger spelnummer
const versies = new Set(['chat.html', 'solo.js'].flatMap(f => [...lees(f).matchAll(/vieroprij-ui\.js\?v=(\d+)/g)].map(m => m[1])))
assert.equal(versies.size, 1, 'vieroprij-ui.js: overal dezelfde versie')
assert.ok(Number([...versies][0]) > 147)
const { SPEL_VERSIES } = await import(new URL('../../spelversies.js', import.meta.url))
assert.ok(SPEL_VERSIES.vieroprij >= 2)

console.log('ok: Four in a Row als plastic speelgoed, met vallende schijven')
