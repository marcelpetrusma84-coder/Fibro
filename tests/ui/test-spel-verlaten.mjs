// v243 (1 nov 2026): gaat je vriend weg uit een spel, dan loopt het spel bij jou niet meer door.
// - 'verlaten' ontvangen: de melding komt, en snelle spellen (Block It, Pong, ...) stoppen via isActief.
// - Ga je zelf weg uit de chat (terugknop, tabblad dicht) zonder op het kruisje te tikken, dan krijgt je vriend
//   toch 'verlaten' (pagehide).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const chat = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')

assert.match(chat, /let spelGestopt = false/)

// alle snelle spellen stoppen als de vriend weg is
const closures = [...chat.matchAll(/isActief: \(\) => spelActief === '([a-z]+)'([^}]*)\}/g)]
assert.equal(closures.length, 9, 'negen snelle spellen')
for (const [, spel, rest] of closures) assert.match(rest, /&& !spelGestopt/, spel + ' stopt als je vriend weg is')
for (const spel of ['breakout', 'pong', 'flappybird', 'spaceinvaders', 'swarm', 'pacman', 'endlessrunner', 'pinball', 'shmup'])
  assert.ok(closures.some(c => c[1] === spel), spel)

// 'verlaten' zet het spel stil, voor de melding
const verlaten = chat.slice(chat.indexOf("spelKanaal.on('broadcast', { event: 'verlaten' }"), chat.indexOf("if (spelType === 'schaken') spelKanaal.on('broadcast', { event:'schaken-drie-start' }"))
assert.ok(verlaten.indexOf('spelGestopt = true') > 0 && verlaten.indexOf('spelGestopt = true') < verlaten.indexOf('toonSpelMelding('), 'eerst stilzetten, dan de melding')

// een nieuw spel en sluiten zetten het weer terug
assert.match(chat, /spelActief = spelType\n    spelGestopt = false\n/, 'een nieuw spel begint niet stilgezet')
const sluit = chat.slice(chat.indexOf('window.sluitSpel = function(stil)'), chat.indexOf('// ─── Boter-Kaas-Eieren'))
assert.match(sluit, /spelActief = null\n    spelGestopt = false\n/, 'sluiten zet het terug')

// weggaan uit de chat: je vriend krijgt 'verlaten'
const ph = chat.slice(chat.indexOf("window.addEventListener('pagehide'"), chat.indexOf('window.sluitSpel = function(stil)'))
assert.ok(ph.length > 0, 'pagehide-luisteraar')
assert.match(ph, /if \(!spelKanaal \|\| !spelActief \|\| fibroChessTest\?\.active\) return/, 'alleen bij een echt spel met een vriend')
assert.match(ph, /spelKanaal\.send\(\{ type:'broadcast', event:'verlaten', payload:\{\} \}\)/)

// Block It: de lus ruimt op (toetsen los, timers weg) zodra isActief() false is
const bi = readFileSync(new URL('../../blockit-ui.js', import.meta.url), 'utf8')
assert.match(bi, /function lus\(t\) \{\n        if \(!isActief\(\)\) \{\n            opruimen\(\)\n            return\n        \}/)
assert.match(bi, /function opToets\(e\) \{\n        if \(!isActief\(\) \|\| !bezig\) return/)

console.log('ok: gaat je vriend weg, dan stopt het spel; ga je zelf weg uit de chat, dan hoort je vriend het ook')
