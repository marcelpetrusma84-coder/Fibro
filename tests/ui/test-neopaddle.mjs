// Neo Paddle v2 (30 okt 2026): blokjes en power-ups (samen en tegen de computer) en levels voor alleen.
// Controleert de regels uit neopaddle.js, speelt alle levels automatisch uit (neopaddle-levels.js, zonder scherm),
// de handdruk met de computerspeler, de vertalingen en de ?v=-nummers.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const pad = p => new URL('../../' + p, import.meta.url)
const lees = p => readFileSync(pad(p), 'utf8')
const NPK = await import(pad('neopaddle.js'))
const LV = await import(pad('neopaddle-levels.js'))

// 1. Samen: elke golf blokjes is eerlijk en laat altijd een doorgang open
for (const [i, g] of NPK.SAMEN_GOLVEN.entries()) {
  assert.equal(g.length, NPK.SAMEN_RIJEN, 'golf ' + i + ': 4 rijen')
  assert.ok(g.every(r => /^[.12]{10}$/.test(r)), 'golf ' + i + ': 10 tekens, geen metaal')
  assert.deepEqual([g[0], g[1]], [g[3], g[2]], 'golf ' + i + ': van boven en onder gezien hetzelfde')
  const leeg = [...Array(10).keys()].filter(k => g.every(r => r[k] === '.'))
  assert.ok(leeg.length >= 2, 'golf ' + i + ': minstens twee lege kolommen (altijd een doorgang naar de tegenstander)')
  const blokken = NPK.samenGolf(i)
  assert.ok(blokken.length > 0 && blokken.every(b => b.y >= NPK.SAMEN_Y0 && b.y + b.h <= NPK.NP.H / 2 + 40), 'golf ' + i + ': in het midden')
}
assert.equal(NPK.samenGolf(NPK.SAMEN_GOLVEN.length).length, NPK.samenGolf(0).length, 'na de laatste golf begint het weer bij de eerste')

// 2. Levels: geldig en onder de paddle blijft ruimte
for (const [i, l] of NPK.LEVELS.entries()) {
  assert.ok(l.naam.length === 2 && l.naam.every(Boolean), 'level ' + (i + 1) + ': naam in twee talen')
  assert.ok(l.rijen.length <= 8 && l.rijen.every(r => /^[.123X]{10}$/.test(r)), 'level ' + (i + 1) + ': hoogstens 8 rijen van 10')
  const b = NPK.levelBlokken(i)
  assert.ok(b.some(x => x.hp > 0), 'level ' + (i + 1) + ': iets om te breken')
  assert.ok(Math.max(...b.map(x => x.y + x.h)) < LV.PADDLE_Y - 150, 'level ' + (i + 1) + ': ruimte boven de paddle')
}

// 3. Elk level is uit te spelen (een automatische speler, vast toeval, met genoeg levens)
{
  let zaad = 7
  const rnd = () => (zaad = (zaad * 16807) % 2147483647) / 2147483647
  for (let l = 0; l < NPK.LEVELS.length; l++) {
    const s = LV.maakSpel(l, { rnd, levens: 3 })
    s.levens = 1e6 // hier gaat het om: komt hij erdoorheen? (een extra leven zet het weer op hoogstens 5: dan nog eens)
    let f = 0, afw = 0
    while (s.status === 'spelen' && f < 60 * 60 * 15) {
      if (s.levens < 3) s.levens = 1e6
      if (s.ballen.some(b => b.vast)) LV.lanceer(s)
      const bal = s.ballen.filter(b => !b.vast && b.vy > 0).sort((a, b) => b.y - a.y)[0] || s.ballen[0]
      if (f % 90 === 0) afw = (rnd() - 0.5) * NPK.paddleBreedte(s.eff) * 0.8
      LV.stap(s, bal.x - NPK.paddleBreedte(s.eff) / 2 + afw); s.gebeurtenis.length = 0; f++
    }
    assert.equal(s.status, 'gehaald', 'level ' + (l + 1) + ' is uit te spelen')
    assert.ok(s.score > 0)
  }
}
// Een gemiste bal kost een leven; zonder levens is het af
{
  const s = LV.maakSpel(0, { levens: 1, rnd: () => 0.5 })
  LV.lanceer(s)
  let f = 0
  while (s.status === 'spelen' && f < 2000) { LV.stap(s, 0); f++ } // paddle helemaal links: de bal valt ernaast
  assert.equal(s.status, 'af', 'zonder levens: game over')
}

// 4. Botsen tegen een blokje
{
  const r = { x: 100, y: 100, w: 25, h: 12 }
  const bal = { x: 112, y: 116, vx: 0.5, vy: -3 }
  assert.equal(NPK.botsBalBlok(bal, r), true); assert.ok(bal.vy > 0 && bal.y >= 112 + 4 - 0.01, 'van onder: kaatst naar beneden')
  const weg = { x: 112, y: 116, vx: 0, vy: 3 }
  assert.equal(NPK.botsBalBlok(weg, r), false, 'een bal die al wegvliegt botst niet nog eens')
  const zij = { x: 97, y: 106, vx: 3, vy: 0.2 }
  assert.equal(NPK.botsBalBlok(zij, r), true); assert.ok(zij.vx < 0, 'van opzij: kaatst opzij')
}

// 5. Power-ups
{
  for (let i = 0; i < 400; i++) assert.notEqual(NPK.kiesPowerup('samen', i / 400), 'leven', 'samen geen extra leven')
  const lv = new Set(); for (let i = 0; i < 400; i++) lv.add(NPK.kiesPowerup('levels', i / 400))
  assert.deepEqual([...lv].sort(), Object.keys(NPK.POWERUPS).sort(), 'in de levels kan elke power-up vallen')
  for (const [k, p] of Object.entries(NPK.POWERUPS)) assert.ok(p.icoon && p.naam.length === 2 && p.naam.every(Boolean), 'power-up ' + k)
  const e = NPK.nieuwEffect()
  NPK.pasEffectToe(e, 'groot'); assert.equal(NPK.paddleBreedte(e), 90)
  NPK.pasEffectToe(e, 'klein'); assert.equal(NPK.paddleBreedte(e), 36, 'klein na groot: klein wint')
  for (let i = 0; i < NPK.POWERUPS.klein.duur; i++) NPK.tikEffect(e)
  assert.equal(NPK.paddleBreedte(e), 60, 'na de tijd weer gewoon')
  NPK.pasEffectToe(e, 'schild'); NPK.pasEffectToe(e, 'omgekeerd'); NPK.pasEffectToe(e, 'vuur')
  assert.deepEqual(NPK.effectKort(e), { b: 60, o: 1, s: 1, v: 1 })
  assert.equal(NPK.pasEffectToe(e, 'traag'), false, 'traag regelt het spel zelf')
  // Krachtveld in de levels: houdt één bal tegen
  const s = LV.maakSpel(0, { rnd: () => 0.5 })
  s.eff.schild = true; LV.lanceer(s)
  s.ballen[0].x = 10; s.ballen[0].y = 300; s.ballen[0].vx = 0; s.ballen[0].vy = 5
  for (let i = 0; i < 40; i++) LV.stap(s, 200)
  assert.equal(s.eff.schild, false, 'het krachtveld is gebruikt'); assert.equal(s.levens, 3, 'en de bal is niet kwijt')
}

// 6. De computerspeler kent v2 (anders komen er tegen de computer geen blokjes)
{
  const { pongBot } = await import(pad('solo.js'))
  const gestuurd = []
  const bot = pongBot({ stuur: (e, p) => gestuurd.push([e, p]), niveau: 'normaal', isDicht: () => false })
  bot.ontvang('pong-klaar', {})
  assert.deepEqual(gestuurd.find(g => g[0] === 'pong-klaar-terug'), ['pong-klaar-terug', { v: 2 }])
  bot.ontvang('balstaat', { ballen: [[140, 200, 1, -3, 0]], eff: { boven: { b: 90 } }, caps: [[50, 100, -1.7, 'groot']] })
  bot.stop()
  const pong = lees('pong-ui.js')
  assert.match(pong, /const PROTOCOL = 2/)
  assert.match(pong, /blokkenAan = anderVersie >= PROTOCOL/, 'alleen blokjes als de ander v2 heeft')
  assert.match(pong, /\bbal: eerste \?/, "de balstaat houdt 'bal' voor een oudere versie aan de andere kant")
}

// 7. Elke tekst in het spel heeft een Engelse vertaling
{
  globalThis.window = {}
  new Function('window', lees('taal-en.js'))(globalThis.window)
  const EN = globalThis.window.FIBRO_EN
  for (const f of ['neopaddle-levels.js', 'pong-ui.js']) {
    for (const m of lees(f).matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) assert.ok(Object.prototype.hasOwnProperty.call(EN, m[1]), f + ': Engels voor "' + m[1] + '"')
  }
  for (const m of lees('spel.html').matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) if (/level|Levels/i.test(m[1])) assert.ok(EN[m[1]], 'spel.html: Engels voor "' + m[1] + '"')
  delete globalThis.window
}

// 8. Overal dezelfde ?v=
{
  const versies = (naam, bestanden) => new Set(bestanden.flatMap(f => [...lees(f).matchAll(new RegExp(naam.replace('.', '\\.') + '\\?v=(\\d+)', 'g'))].map(m => m[1])))
  assert.equal(versies('pong-ui.js', ['chat.html', 'solo.js']).size, 1, 'pong-ui.js: overal dezelfde versie')
  assert.equal(versies('neopaddle.js', ['pong-ui.js', 'neopaddle-levels.js']).size, 1, 'neopaddle.js: overal dezelfde versie')
  assert.match(lees('solo.js'), /levels: '\.\/neopaddle-levels\.js\?v=\d+'/)
  const { SPEL_VERSIES } = await import(pad('spelversies.js'))
  assert.ok(SPEL_VERSIES.pong >= 2, 'Neo Paddle heeft een hoger spelnummer')
}

console.log('ok: Neo Paddle v2 (blokjes, power-ups, ' + NPK.LEVELS.length + ' levels uitgespeeld)')
