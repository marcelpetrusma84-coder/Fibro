// Blauwdruk kaartspellen (11 nov 2026): kaartspel-hulp.js, en Pesten als eerste kaartspel erop.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const K = await import('../../kaartspel-hulp.js')
const P = await import('../../pesten.js')

// 1. Elke kaart is een eigen vectorplaatje (SVG), ook de achterkant
const plaatjes = new Set()
for (const id of P.maakDeck()) {
  const svg = K.kaartSvg(id)
  assert.match(svg, /^<svg class="kt-svg" viewBox="0 0 250 350"[^>]*>.*<\/svg>$/s, id + ' is een svg')
  assert.ok(!/undefined|NaN/.test(svg), id + ': netjes getekend')
  plaatjes.add(svg)
}
assert.equal(plaatjes.size, 54, '54 verschillende kaarten')
assert.match(K.achterkantSvg(), /linearGradient.*#8b3fd1.*#6a2bab.*#1a0a2e/s, 'achterkant in de Stekky-kleuren')
assert.equal(K.kaartNaam('hA'), 'harten aas')
assert.deepEqual(['sA', 'h3', 'J1', 'k10', 'h10'].sort(K.SORTEER.kleur), ['h3', 'h10', 'k10', 'sA', 'J1'])
assert.deepEqual(['sA', 'h3', 'J1', 'k10', 'h10'].sort(K.SORTEER.waarde), ['h3', 'h10', 'k10', 'sA', 'J1'])
assert.equal(K.draaiVan('h5', 3), K.draaiVan('h5', 3), 'de draai op de aflegstapel is bij allebei hetzelfde')

// 2. De tafel kan alles uit de blauwdruk
const hulp = lees('kaartspel-hulp.js')
for (const naam of ['speelAnimatie', 'anderSpeeltAnimatie', 'pakAnimatie', 'anderPaktAnimatie', 'deelAnimatie', 'schudAnimatie',
  'beurtKlok', 'effect', 'reactie', 'knoppen', 'anderKnop', 'kiesUit', 'einde']) assert.match(hulp, new RegExp('\\b' + naam + '\\b'), 'tafel: ' + naam)
assert.match(hulp, /manier === 'veeg' && gesleept/, 'vegen vanaf de stapel heeft een eigen animatie')
assert.match(hulp, /navigator\.vibrate/, 'trillen')
assert.match(hulp, /spelVideoEigen/, 'de beurtklok komt ook om het webcamrondje')

// 3. chat.html: Pesten is een beurtspel (chatbalk, stickers, webcamrondjes) en een kaartspel (spraak vanzelf aan)
const chat = lees('chat.html')
const KAARTSPELLEN = JSON.parse(chat.match(/const KAARTSPELLEN = (\[[^\]]*\])/)[1].replace(/'/g, '"'))
const BEURTSPELLEN = JSON.parse(chat.match(/const BEURTSPELLEN = (\[[^\]]*\])/)[1].replace(/'/g, '"'))
assert.deepEqual(KAARTSPELLEN, ['pesten'])
for (const spel of KAARTSPELLEN) assert.ok(BEURTSPELLEN.includes(spel), spel + ' krijgt de chatbalk en de webcamrondjes')
assert.match(chat, /onActivity:\(\) => \{ if \(spelKanaal === verbinding && \(spelActief === 'schaken' \|\| KAARTSPELLEN\.includes\(spelActief\)\)\) startSpelBel\(\) \}/, 'spraak vanzelf aan bij kaartspellen')
assert.ok(!/onclick="startSpel\('pesten'\)"/.test(chat), 'geen vaste knop: Pesten komt uit de Store')
assert.match(chat, /function toonStoreSpellen\(\)/, 'knop in het spelmenu alleen met de widget spel_pesten')
assert.match(chat, /widget: 'spel_pesten'/)
assert.match(chat, /gameAan\(huidigeUser\.id, sp\)/, 'v2: download + widget op dit toestel (niet de server)')
assert.match(lees('store.js'), /export async function verwijderDownload\(/, 'alles uit de Store kan weer weg')
assert.match(chat, /else if \(spelType === 'pesten'\) await startPesten\(\)/)
assert.match(chat, /const beschikbaar = \[[^\]]*'pesten'/)
const versie = f => [...new Set([...lees(f).matchAll(/pesten-ui\.js\?v=(\d+)/g)].map(m => m[1]))]
assert.equal(versie('chat.html').length, 1); assert.deepEqual(versie('chat.html'), versie('solo.js'), 'overal dezelfde versie van pesten-ui.js')
assert.match(lees('solo.js'), /pesten: +\{ naam: 'Pesten'.*bot: pestenBot/, 'ook tegen de computer (spel.html)')
assert.match(lees('speluitnodiging.js'), /pesten: \{ icon: '🃏', naam: 'Pesten' \}/)

// 4. Elke tekst heeft een Engelse vertaling
const en = lees('taal-en.js')
for (const f of ['kaartspel-hulp.js', 'pesten-ui.js'])
  for (const m of lees(f).matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) assert.ok(en.includes(JSON.stringify(m[1]) + ':'), f + ': Engels voor ' + m[1])
assert.match(lees('BLAUWDRUK-KAARTSPEL.md'), /KAARTSPELLEN/)
console.log('blauwdruk kaartspel: ok')
