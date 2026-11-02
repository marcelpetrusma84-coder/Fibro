// v251 (2 nov 2026): elk spel heeft een titelscherm met een bewegend plaatje (titelscenes.js) en een eigen deuntje
// (titelmuziek.js). Eén tik en je bent in het menu van het spel; in de chat begint het spel pas als je hebt getikt.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { SCENES } from '../../titelscenes.js'
import { DEUNTJES, stappen, frequentie } from '../../titelmuziek.js'
import { SOLO_SPELLEN } from '../../solo.js'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const chat = lees('chat.html'), spel = lees('spel.html'), en = lees('taal-en.js')

// 1. Alle 12 spellen (en schaken met drie) hebben een plaatje en een deuntje
const ids = Object.keys(SOLO_SPELLEN)
assert.equal(ids.length, 12)
for (const id of [...ids, 'schakendrie']) {
  assert.equal(typeof SCENES[id]?.teken, 'function', 'plaatje voor ' + id)
  assert.ok(DEUNTJES[id], 'deuntje voor ' + id)
  if (!SCENES[id].css) continue   // v2: The Swarm gebruikt Courier New, net als het spel
  assert.ok(existsSync(new URL('../../lettertypen/' + SCENES[id].css + '.css', import.meta.url)), 'lettertype ' + SCENES[id].css)
  assert.match(lees('lettertypen/' + SCENES[id].css + '.css'), new RegExp("font-family:'" + SCENES[id].font + "'"), 'lettertypenaam ' + id)
}
// ook elk spel dat de chat kent
const beschikbaar = /const beschikbaar = \[([^\]]+)\]/.exec(chat)[1].match(/'([a-z]+)'/g).map(s => s.slice(1, -1))
for (const id of beschikbaar) assert.ok(SCENES[id] && DEUNTJES[id], 'chat-spel ' + id)

// 2. De deuntjes: alleen geldige noten, en elke stem past precies in de lengte van het hele deuntje (geen scheve herhaling)
for (const [id, d] of Object.entries(DEUNTJES)) {
  const tellen = d.stemmen.map(s => {
    const r = stappen(s.noten)
    for (const n of r) {
      if (s.slag) assert.ok('ksh.'.includes(n) && n.length === 1, id + ': slag ' + n)
      else assert.ok(n === '.' || n === '-' || frequentie(n), id + ': noot ' + n)
    }
    return r.length / s.stap
  })
  const lang = Math.max(...tellen)
  for (const t of tellen) assert.equal(lang % t, 0, id + ': stemmen passen in elkaar (' + tellen + ')')
  assert.ok(d.bpm >= 60 && d.bpm <= 200, id + ': tempo')
}
assert.equal(Math.round(frequentie('A4')), 440)
assert.equal(Math.round(frequentie('C4')), 262)

// 3. Elk plaatje tekent zonder fouten (met een nep-canvas)
const nep = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({ width: 10 }) : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {})), set: (o, k, v) => { o[k] = v; return true } })
// (de drie in de stijl van het spel hebben een echte pagina nodig; die test proef227.py in de browser)
for (const [id, s] of Object.entries(SCENES)) if (!s.eigenTitel && !['pacman', 'schakendrie'].includes(id) || id === 'schakendrie') for (const t of [0, 1.3, 2.2, 7.9]) s.teken(nep, 390, 844, t, {})
assert.ok(['swarm', 'endlessrunner', 'shmup'].every(id => typeof SCENES[id].eigenTitel === 'function'), 'drie spellen met hun eigen titel')
const bron = lees('titelscenes.js')
assert.ok(!/\.filter\s*=/.test(bron), 'geen ctx.filter (kent Safari niet)')

// 4. Chat: titelscherm bij het openen, het spel wacht op de tik, sluiten ruimt het op
assert.match(chat, /import \{ toonTitelscherm, sluitTitelscherm, stopTitelMuziek, heeftTitelscherm \} from '\.\/titelscherm\.js\?v=3'/)
const mee = chat.slice(chat.indexOf('window.speelMee = async function'), chat.indexOf("if (spelType === 'botkaaseiren') await startBotKaasEieren()"))
assert.ok(mee.indexOf('toonTitelscherm(') < mee.indexOf('const wachtOpVriend'), 'titelscherm voor het wachten')
assert.match(mee, /if \(!await titelKlaar \|\| spelActief !== spelType \|\| spelKanaal !== verbinding\) return \/\/ v251\n    stopTitelMuziek\(\)\n/)
const sluit = chat.slice(chat.indexOf('window.sluitSpel = function(stil)'), chat.indexOf('// ─── Boter-Kaas-Eieren'))
assert.match(sluit, /sluitTitelscherm\(\)/)

// 5. Alleen spelen: eerst het titelscherm, dan het menu; de muziek stopt als het spel begint
assert.match(spel, /import \{ toonTitelscherm, stopTitelMuziek \} from '\.\/titelscherm\.js\?v=3'/)
assert.match(spel, /\(titelGezien \? Promise\.resolve\(true\) : toonTitelscherm\(\{ spelId, naam: spelNaam\(\) \}\)\)\.then\(\(\) => \{\n      if \(spel\.zonderKanaal\) start\('normaal'\)\n      else if \(spel\.arcade\) startScherm\(\)\n      else kiesNiveau\(\)/)
assert.match(spel, /async function start\(niveau\) \{\n    stopTitelMuziek\(\)/)

// 6. Engels en versienummers
for (const k of ['Tik om te beginnen', 'Muziek uit', 'Muziek aan']) assert.ok(en.includes(JSON.stringify(k) + ':'), 'Engels: ' + k)
assert.match(lees('titelscherm.js'), /from '\.\/titelscenes\.js\?v=3'/)
assert.match(lees('titelscherm.js'), /from '\.\/titelmuziek\.js\?v=2'/)

// 7. v252: op Home, het profiel van een vriend en de uitnodiging komt het titelscherm al bij je tik (muziek meteen,
//    ook op de iPhone); daarna spel.html?...&titel=1, dat het titelscherm dan overslaat
assert.match(spel, /const titelGezien = new URLSearchParams\(location\.search\)\.get\('titel'\) === '1'/)
for (const [f, patroon] of [['index.html', /blok\.onclick = \(\) => openSpelMetTitel\(spel, 'spel\.html\?spel=' \+ encodeURIComponent\(spel\)\)/],
                            ['vriend-profiel.html', /el\.onclick = \(\) => openSpelMetTitel\(spel, 'spel\.html\?spel=' \+ encodeURIComponent\(spel\)\)/],
                            ['invite.html', /knop\.onclick = \(e\) => \{ e\.preventDefault\(\); openSpelMetTitel\(id, knop\.getAttribute\('href'\)\) \}/]]) {
  const bron = lees(f)
  assert.match(bron, /import \{ openSpelMetTitel \} from '\.\/titelscherm\.js\?v=3'/, f + ': laadt het titelscherm meteen (dan telt je tik voor het geluid)')
  assert.match(bron, patroon, f)
}
const muziek = lees('titelmuziek.js')
assert.match(muziek, /\['pointerdown', 'touchend', 'click', 'keydown'\]/, 'geluid aan bij elke soort tik')
assert.match(muziek, /a\.createBuffer\(1, 1, 22050\)/, 'stil geluidje voor oudere iPhones')
for (const f of ['chat.html', 'spel.html', 'index.html', 'vriend-profiel.html', 'invite.html']) assert.ok(!lees(f).includes('titelscherm.js?v=2'), f + ': geen oude versie')

// 8. v252: drie spellen in hun eigen stijl; titelstijl.js is gemaakt uit de spellen zelf
const stijl = lees('titelstijl.js')
assert.match(stijl, /GEMAAKT door tests\/gen\/maak_titelstijl\.py/)
for (const stuk of ['function tekenFiguur(g, cx, cy, u, kleur', 'function bgHuis(FL)', 'var FIG = (function(){', "this.teken(k('dart')", "['schip', { licht: '#ff5d9e'"]) assert.ok(stijl.includes(stuk), 'overgenomen: ' + stuk)
assert.match(lees('titelscenes.js'), /from '\.\/titelstijl\.js\?v=2'/)

console.log('PASS: titelschermen voor alle 12 spellen (plaatje, lettertype, deuntje), in de chat en bij alleen spelen.')
