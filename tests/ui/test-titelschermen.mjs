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
// v4: The Swarm weer met de kevers rond de lamp: allemaal groen, geen gras, wel de titel uit het spel
const swarmBron = lees('titelscenes.js').slice(lees('titelscenes.js').indexOf('// ── The Swarm: kevers zwermen rond een lamp'), lees('titelscenes.js').indexOf('function swarmTitel('))
assert.ok(!swarmBron.includes('grassprieten') && !swarmBron.includes('#e84a3c'), 'geen gras en geen rode kevers')
assert.match(swarmBron, /const kleuren = \['#3fd16b', '#8dff2a', '#2fa84a', '#b6ff3a', '#5fbf1a'\]/)
for (const t of [0, 2.5]) SCENES.swarm.teken(nep, 390, 844, t, {})
const bron = lees('titelscenes.js')
assert.ok(!/\.filter\s*=/.test(bron), 'geen ctx.filter (kent Safari niet)')

// 4. Chat: titelscherm bij het openen, het spel wacht op de tik, sluiten ruimt het op
// 3 nov 2026 (sneller): de chat laadt het titelscherm als de pagina rustig is (niet meer in het eerste laden)
assert.match(chat, /laadModule\('\.\/titelscherm\.js\?v=7'\)\.then\(m => \(titelModule = m\)\)/)
assert.match(chat, /laadRustig\(\(\) => laadTitelscherm\(\)\.catch\(\(\) => \{\}\)\)/)
const mee = chat.slice(chat.indexOf('window.speelMee = async function'), chat.indexOf("if (spelType === 'botkaaseiren') await startBotKaasEieren()"))
assert.ok(mee.indexOf('toonTitelscherm(') < mee.indexOf('const wachtOpVriend'), 'titelscherm voor het wachten')
assert.match(mee, /if \(!await titelKlaar \|\| spelActief !== spelType \|\| spelKanaal !== verbinding\) return \/\/ v251\n    titelModule\?\.spelStart\(spelType\)/)
const sluit = chat.slice(chat.indexOf('window.sluitSpel = function(stil)'), chat.indexOf('// ─── Boter-Kaas-Eieren'))
assert.match(sluit, /titelModule\?\.sluitTitelscherm\(\)/)

// 5. Alleen spelen: eerst het titelscherm, dan het menu; de muziek stopt als het spel begint
assert.match(spel, /import \{ toonTitelscherm, stopTitelMuziek, spelStart, menuMuziek \} from '\.\/titelscherm\.js\?v=7'/)
assert.match(spel, /\(titelGezien \? Promise\.resolve\(true\) : toonTitelscherm\(\{ spelId, naam: spelNaam\(\) \}\)\)\.then\(\(\) => \{\n      if \(spel\.zonderKanaal\) start\('normaal'\)\n      else if \(spel\.arcade\) startScherm\(\)\n      else kiesNiveau\(\)/)
assert.match(spel, /async function start\(niveau\) \{\n    spelStart\(spelId\)/)

// 9. v253: de muziek speelt door in het menu van het spel en stopt als het spel echt begint ('fibro-spel-begint')
assert.match(lees('titelmuziek.js'), /window\.addEventListener\('fibro-spel-begint', \(\) => stopTitelMuziek\(0\.8\)\)/)
const ts = lees('titelscherm.js')
assert.match(ts, /const MET_MENU = \['breakout', 'swarm', 'pacman', 'pinball', 'endlessrunner', 'shmup', 'pong'\]/)
for (const [id, bestand] of [['breakout', 'blockit-ui.js'], ['swarm', 'swarm-ui.js'], ['pacman', 'ecto-ui.js'], ['pinball', 'twin-snakes-ui.js'],
                             ['endlessrunner', 'runner-gunner-ui.js'], ['shmup', 'neon-raiders-ui.js'], ['pong', 'pong-ui.js']]) {
  assert.match(lees(bestand), /window\.dispatchEvent\(new Event\('fibro-spel-begint'\)\)/, bestand + ' laat weten dat het spel begint')
  const v = new RegExp(bestand.replace('.', '\\.') + '\\?v=(\\d+)')
  assert.equal(v.exec(lees('solo.js'))[1], v.exec(chat)[1], bestand + ': zelfde versie in solo.js en chat.html')
}
assert.match(spel, /if \(titelGezien && !ingebed\) menuMuziek\(spelId\)/, 'na het titelscherm op Home speelt de muziek ook in het menu')

// 10. v254: het spel opent in een venster op Home (iframe), zodat de muziek ook op de iPhone doorspeelt in de menu's
assert.match(ts, /openSpelVenster\(adres \+ \(adres\.includes\('\?'\) \? '&' : '\?'\) \+ 'titel=1&ingebed=1'\)/)
assert.match(ts, /e\.source !== venster\.contentWindow \|\| e\.origin !== location\.origin/, 'alleen berichten van ons eigen spelvenster')
assert.match(ts, /d\.adres\.startsWith\('chat\.html\?'\)/, 'alleen naar de chat doorsturen')
assert.match(spel, /if \(ingebed\) \{ window\.parent\.postMessage\(\{ fibro: 'sluit-spel' \}, location\.origin\); return \}/, 'sluiten: het venster gaat dicht')
assert.match(spel, /if \(!ingebed\) startSpelUitnodigingLuisteraar\(\)/, 'geen dubbele uitnodigingen in het venster')
assert.match(lees('titelmuziek.js'), /if \(ingebed\) \{ try \{ window\.parent\.postMessage\(\{ fibro: 'spel-begint' \}, location\.origin\) \} catch \(e\) \{\} \}/)

// 6. Engels en versienummers
for (const k of ['Tik om te beginnen', 'Muziek uit', 'Muziek aan']) assert.ok(en.includes(JSON.stringify(k) + ':'), 'Engels: ' + k)
assert.match(lees('titelscherm.js'), /from '\.\/titelscenes\.js\?v=4'/)
assert.match(lees('titelscherm.js'), /from '\.\/titelmuziek\.js\?v=4'/)

// 7. v252: op Home, het profiel van een vriend en de uitnodiging komt het titelscherm al bij je tik (muziek meteen,
//    ook op de iPhone); daarna spel.html?...&titel=1, dat het titelscherm dan overslaat
assert.match(spel, /const titelGezien = new URLSearchParams\(location\.search\)\.get\('titel'\) === '1'/)
for (const [f, patroon] of [['index.html', /blok\.onclick = \(\) => openSpelMetTitel\(spel, 'spel\.html\?spel=' \+ encodeURIComponent\(spel\)\)/],
                            ['vriend-profiel.html', /el\.onclick = \(\) => openSpelMetTitel\(spel, 'spel\.html\?spel=' \+ encodeURIComponent\(spel\)\)/],
                            ['invite.html', /knop\.onclick = \(e\) => \{ e\.preventDefault\(\); openSpelMetTitel\(id, knop\.getAttribute\('href'\)\) \}/]]) {
  const bron = lees(f)
  assert.match(bron, /import \{ openSpelMetTitel \} from '\.\/titelscherm\.js\?v=7'/, f + ': laadt het titelscherm meteen (dan telt je tik voor het geluid)')
  assert.match(bron, patroon, f)
}
const muziek = lees('titelmuziek.js')
assert.match(muziek, /\['pointerdown', 'touchend', 'click', 'keydown'\]/, 'geluid aan bij elke soort tik')
assert.match(muziek, /a\.createBuffer\(1, 1, 22050\)/, 'stil geluidje voor oudere iPhones')
for (const f of ['chat.html', 'spel.html', 'index.html', 'vriend-profiel.html', 'invite.html']) assert.ok(/titelscherm\.js\?v=7'/.test(lees(f)), f + ': titelscherm v4')

// 8. v252: drie spellen in hun eigen stijl; titelstijl.js is gemaakt uit de spellen zelf
const stijl = lees('titelstijl.js')
assert.match(stijl, /GEMAAKT door tests\/gen\/maak_titelstijl\.py/)
for (const stuk of ['function tekenFiguur(g, cx, cy, u, kleur', 'function bgHuis(FL)', 'var FIG = (function(){', "this.teken(k('dart')", "['schip', { licht: '#ff5d9e'"]) assert.ok(stijl.includes(stuk), 'overgenomen: ' + stuk)
assert.match(lees('titelscenes.js'), /from '\.\/titelstijl\.js\?v=2'/)

console.log('PASS: titelschermen voor alle 12 spellen (plaatje, lettertype, deuntje), in de chat en bij alleen spelen.')
