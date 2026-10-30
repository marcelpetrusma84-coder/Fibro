// Tic-Tac-Toe v2 (30 okt 2026): houten bord en houten stukken (bke-ui.js).
// Het tekenen zelf is in een echte browser bekeken; hier: de opbouw, de vertalingen en de ?v=-nummers.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const bke = lees('bke-ui.js')

// 1. Hout: een plank met vakjes, twee houtsoorten, nerf, neerleggen en oplichten bij winst
for (const stuk of ['.bke-plank', '.bke-vak', 'bkeEsdoorn', 'bkeNoot', 'bkeNerf', '@keyframes bkeLeg', '.bke-vak.win', 'prefers-reduced-motion'])
  assert.ok(bke.includes(stuk), 'bke-ui.js bevat ' + stuk)
// De nerf-filter mag de stukken niet afsnijden (de O had een vierkant randje met objectBoundingBox)
assert.match(bke, /<filter id="bkeNerf" filterUnits="userSpaceOnUse" x="0" y="0" width="66" height="66">/)
// De nerf als data:-adres: '#' moet gecodeerd worden, en dat doet encodeURIComponent (niet zelf %23 schrijven)
assert.ok(!bke.includes("url(%23n)"), 'geen dubbel gecodeerde #')
// Geen plaatjes van andere websites (Fibro laadt niets van buiten)
assert.ok(!/https?:\/\//.test(bke.replace('http://www.w3.org/2000/svg', '')), 'geen adressen van buiten')

// 2. De spelregels zijn hetzelfde gebleven, en een vreemde zet van de ander telt niet
assert.match(bke, /\[\[0,1,2\],\[3,4,5\],\[6,7,8\],\[0,3,6\],\[1,4,7\],\[2,5,8\],\[0,4,8\],\[2,4,6\]\]/)
assert.match(bke, /if \(!Number\.isInteger\(i\) \|\| i < 0 \|\| i > 8 \|\| bord\[i\] \|\| symbool !== vriendSymbool\) return/)
assert.ok(!bke.includes('huidigLevel'), "de oude 'level-update' (met een variabele die niet bestond) is weg")

// 3. Engels voor elke tekst
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const m of bke.matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) {
  const sleutel = m[1].replace(/\\u([0-9a-f]{4})/gi, (x, h) => String.fromCharCode(parseInt(h, 16)))
  assert.ok(Object.prototype.hasOwnProperty.call(EN, sleutel), 'Engels voor "' + sleutel + '"')
}
delete globalThis.window

// 4. Overal dezelfde ?v=, en een hoger spelnummer
const versies = new Set(['chat.html', 'solo.js'].flatMap(f => [...lees(f).matchAll(/bke-ui\.js\?v=(\d+)/g)].map(m => m[1])))
assert.equal(versies.size, 1, 'bke-ui.js: overal dezelfde versie')
assert.ok(Number([...versies][0]) > 147, 'bke-ui.js: nieuwer dan v147')
const { SPEL_VERSIES } = await import(new URL('../../spelversies.js', import.meta.url))
assert.ok(SPEL_VERSIES.botkaaseiren >= 2)

console.log('ok: Tic-Tac-Toe met houten bord en houten stukken')
