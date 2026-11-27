// test-sjablonen.mjs (27 nov 2026): de kaartenmotor (kaarten-motor.js) en de spelregels van de sjablonen:
// kaartspel voor 2 tot 6 spelers (sjabloon-kaartspel.js), de automaat (sjabloon-automaat.js) en arcade (sjabloon-arcade.js).
import assert from 'node:assert/strict'
const K = await import(new URL('../../kaarten-motor.js', import.meta.url))
const KS = await import(new URL('../../sjabloon-kaartspel.js', import.meta.url))
const A = await import(new URL('../../sjabloon-automaat.js', import.meta.url))
const W = await import(new URL('../../sjabloon-arcade.js', import.meta.url))
let z = 9; const rng = () => { z = (z * 1103515245 + 12345) % 2147483648; return z / 2147483648 }

// ── de kaartenmotor ──
assert.equal(K.maakDeck('52').length, 52); assert.equal(new Set(K.maakDeck('52')).size, 52)
assert.equal(K.maakDeck('32').length, 32); assert.ok(!K.maakDeck('32').includes('h6'))
assert.equal(K.maakDeck('54').length, 54); assert.ok(K.maakDeck('54').includes('J2'))
assert.equal(K.maakDeck('104').length, 104)
assert.deepEqual(K.schud(K.maakDeck(), rng).slice().sort(), K.maakDeck().slice().sort(), 'schudden houdt dezelfde kaarten')
assert.equal(K.rang('sA'), 14); assert.equal(K.rang('h2'), 2); assert.equal(K.rang('J1'), 0)
assert.ok(K.isKaart('h10')); assert.ok(!K.isKaart('h1')); assert.ok(!K.isKaart('J1')); assert.ok(K.isKaart('J1', '54')); assert.ok(!K.isKaart('h6', '32'))
assert.deepEqual(K.kaartInfo('rV'), { kleur: 'r', waarde: 'V' }); assert.equal(K.kleurNaam('k5'), 'klaveren')
// Poker en Video Poker gebruiken de motor
import { readFileSync } from 'node:fs'
for (const f of ['pokertexasholdem.js', 'videopoker.js', 'sjabloon-kaartspel.js', 'sjabloon-automaat.js']) {
  const bron = readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
  assert.match(bron, /from '\.\/kaarten-motor\.js\?v=\d+'/, f + ' gebruikt de kaartenmotor')
  assert.ok(!/export function maakDeck\(|export function schud\(/.test(bron), f + ' heeft geen eigen kopie meer')
}

// ── het kaartspel-sjabloon: computer tegen computer, 2 tot 6 spelers ──
for (let g = 0; g < 60; g++) {
  const n = 2 + (g % 5)
  let s = KS.nieuwSpel({ spelers: n, rng })
  assert.ok(KS.geldigeStand(s)); assert.equal(s.aanZet, 1)
  for (let stap = 0; s.fase !== 'klaar'; stap++) {
    assert.ok(stap < 100)
    if (s.fase === 'slag') { s = KS.volgendeRonde(s); assert.equal(s.aanZet, s.slagWinnaar, 'de winnaar van de slag begint'); continue }
    const zet = KS.computerStap(s, s.aanZet, ['makkelijk', 'normaal', 'moeilijk'][g % 3], rng)
    assert.equal(KS.doeStap(s, s.aanZet === 1 ? 2 : 1, zet), null, 'niet aan de beurt = niet leggen')
    s = KS.doeStap(s, s.aanZet, zet); assert.ok(s && KS.geldigeStand(s))
  }
  assert.equal(Object.values(s.slagen).reduce((a, b) => a + b, 0), KS.KAARTEN_PER_SPELER, '5 slagen')
}
{ // de hoogste kaart wint; bij gelijk wie hem eerst legde
  let s = KS.nieuwSpel({ spelers: 2, rng }); s.handen[1] = ['hA', 'h2', 'h3', 'h4', 'h5']; s.handen[2] = ['sA', 'k2', 'k3', 'k4', 'k5']
  s = KS.leg(s, 1, 'hA'); s = KS.leg(s, 2, 'sA')
  assert.equal(s.slagWinnaar, 1, 'gelijk: wie eerst legde'); assert.equal(KS.leg(s, 1, 'h2'), null, 'tussen twee slagen niet leggen')
  s = KS.volgendeRonde(s); s = KS.leg(s, 1, 'h2'); s = KS.leg(s, 2, 'k3'); assert.equal(s.slagWinnaar, 2)
}

// ── de automaat ──
assert.equal(A.raad({ kaart: 'h5', volgende: 'sH', klaar: false }, 'hoger').uitslag, 'winst')
assert.equal(A.raad({ kaart: 'h5', volgende: 'sH', klaar: false }, 'lager').uitslag, 'verlies')
assert.equal(A.raad({ kaart: 'h5', volgende: 's5', klaar: false }, 'lager').uitslag, 'gelijk')
assert.equal(A.raad({ kaart: 'h5', volgende: 's5', klaar: true }, 'lager'), null, 'maar één keer raden')
const r = A.nieuweRonde(rng); assert.ok(K.isKaart(r.kaart) && K.isKaart(r.volgende) && r.kaart !== r.volgende)

// ── arcade ──
let w = W.nieuweWereld()
for (let i = 0; i < 40; i++) w = W.stap(w, 0.05, { links: true }, rng)
assert.equal(w.x, W.SPELER.breed / 2, 'niet van het scherm af')
w = W.stap(w, 10, {}, rng); assert.ok(w.tijd < 2.1, 'nooit een grote sprong in de tijd')
w = { ...W.nieuweWereld(), blokken: [{ x: 0.5, y: W.SPELER.y, w: 0.1, h: 0.05, v: 0 }] }
assert.equal(W.stap(w, 0.01, {}, rng).over, true, 'geraakt = game over')
let lang = W.nieuweWereld(), stappen = 0
while (!lang.over && stappen < 20000) { lang = W.stap(lang, 0.02, { doelX: 0.5 + 0.4 * Math.sin(stappen / 30) }, rng); stappen++ }
assert.ok(lang.over, 'na een tijdje word je geraakt'); assert.ok(W.punten(lang) > 0)
console.log('test-sjablonen: kaartenmotor en de drie sjablonen werken')
