// Spelmenu ☰ in elk spel en berichten linksboven (11 nov 2026): spelmenu.js, spelbericht.js v2, ongelezen.js v171.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const menu = lees('spelmenu.js'), chat = lees('chat.html'), spel = lees('spel.html')

// de volgorde in het menu
const volgorde = [...menu.matchAll(/const (\w+)Item = item\('(\w+)'/g)].map(m => m[2])
assert.deepEqual(volgorde, ['pauze', 'geluid', 'mic', 'cam', 'menu', 'exit'])
// de kranen voor pauze en geluid, en het seintje voor spellen die zelf iets willen doen
assert.match(menu, /window\.requestAnimationFrame = function/)
assert.match(menu, /performance\.now = spelNu/)
assert.match(menu, /proto\.connect = function/)
assert.match(menu, /new CustomEvent\('fibro-spel-pauze'/)
// spelmenu.js als eerste geladen, zodat de kranen er zijn voor de spellen geluid maken of tekenen
for (const [naam, bron, voor] of [['chat.html', chat, "import * as Bordgeluid from './bordgeluid.js"], ['spel.html', spel, "import * as Bordgeluid from './bordgeluid.js"]]) {
  const i = bron.indexOf("from './spelmenu.js?v=1'")
  assert.ok(i > 0 && i < bron.indexOf(voor), naam + ': spelmenu.js voor de rest')
}
// chat: de oude knoppen bovenin weg, pauze voor allebei, wolkje alleen voor andere vrienden
assert.match(chat, /\.spel-overlay\.met-spelmenu \.spel-sluit-btn, \.spel-overlay\.met-spelmenu #spelMuteBtn, \.spel-overlay\.met-spelmenu #spelCamKnop \{ display:none !important; \}/)
assert.match(chat, /event: 'spelpauze'/)
assert.match(chat, /spelMenu\?\.pauzeVanAnder\(Boolean\(msg\.payload\?\.aan\), spelVriendUsername\(\)\)/, 'de naam komt van dit toestel, niet uit het bericht')
assert.match(chat, /startSpelBerichtInChat\(\{/)
assert.match(lees('ongelezen.js'), /if \(leestNu\(m\.sender_id\)\) \{ markeer\(m\.sender_id\); return \}[\s\S]*new CustomEvent\('fibro-nieuw-bericht'/, 'je tegenspeler (open gesprek) geeft geen wolkje')
for (const f of ['chat.html', 'index.html', 'profiel.html', 'vrienden.html']) assert.ok(!lees(f).includes('ongelezen.js?v=170'), f + ': ongelezen.js v171')
// spel.html: de computer wacht tijdens de pauze
assert.match(spel, /if \(isGepauzeerd\(\)\) wachtrij\.push/)
assert.match(spel, /#sluitKnop \{ display:none !important; \}/)
// Engels
const en = lees('taal-en.js')
for (const f of ['spelmenu.js', 'spelbericht.js']) for (const m of lees(f).matchAll(/\b[Tt]\('((?:[^'\\]|\\.)*)'/g)) assert.ok(en.includes(JSON.stringify(m[1]) + ':'), f + ': Engels voor ' + m[1])
console.log('spelmenu: ok')
