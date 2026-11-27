// test-poker.mjs (27 nov 2026): de regels van Poker Texas Hold'em (pokertexasholdem.js). Handen beoordelen, blinds en
// wie begint, raise-regels, zijpotten, een gedeelde pot, en potjes computer tegen computer (2 tot 6 spelers) waarin
// de fiches altijd kloppen en de stand altijd geldig is.
import assert from 'node:assert/strict'
const P = await import(new URL('../../pokertexasholdem.js', import.meta.url))

let zaad = 7
const rng = () => { zaad = (zaad * 1103515245 + 12345) % 2147483648; return zaad / 2147483648 }

// ── handen ──
const naam = k => P.besteHand(k).naam
assert.equal(naam(['sA', 'sH', 'sV', 'sB', 's10', 'h2', 'r3']), 'Royal flush')
assert.equal(naam(['h9', 'h8', 'h7', 'h6', 'h5', 'sA', 'rA']), 'Straight flush')
assert.equal(naam(['kH', 'rH', 'hH', 'sH', 'k4', 'h2', 'r3']), 'Four of a kind')
assert.equal(naam(['sV', 'hV', 'rV', 'k8', 's8', 'h2', 'r3']), 'Full house')
assert.equal(naam(['rA', 'rB', 'r8', 'r6', 'r2', 's9', 'h9']), 'Flush')
assert.equal(naam(['k10', 'r9', 'h8', 's7', 'k6', 'h2', 'r2']), 'Straight')
assert.equal(naam(['hA', 'r2', 'k3', 's4', 'h5', 'kH', 'rB']), 'Straight', 'aas laag: A-2-3-4-5')
assert.equal(naam(['s7', 'h7', 'r7', 'kA', 's3', 'h9', 'rB']), 'Three of a kind')
assert.equal(naam(['sB', 'rB', 'h5', 'k5', 'rA', 's9', 'h2']), 'Twee paar')
assert.equal(naam(['h10', 's10', 'rH', 'k9', 'h2', 's4', 'r7']), 'Eén paar')
assert.equal(naam(['sA', 'kV', 'r9', 'h6', 's3', 'k2', 'r7']), 'Hoge kaart')
const sterker = (a, b) => P.vergelijk(P.besteHand(a).score, P.besteHand(b).score)
assert.ok(sterker(['hA', 'r2', 'k3', 's4', 'h5'], ['h6', 'r2', 'k3', 's4', 'h5']) < 0, 'wiel is de laagste straight')
assert.ok(sterker(['sV', 'hV', 'rA', 'k9', 's3'], ['kV', 'rV', 'rH', 'k9', 's3']) > 0, 'kicker beslist (aas boven heer)')
assert.equal(sterker(['sV', 'hV', 'rA', 'k9', 's3'], ['kV', 'rV', 'hA', 's9', 'h3']), 0, 'precies gelijk')
assert.ok(sterker(['sB', 'rB', 'h5', 'k5', 'rA'], ['sB', 'rB', 'h5', 'k5', 'r10']) > 0, 'twee paar met hogere kicker')
assert.equal(P.huidigeHand(['sA', 'hA', 'r5']), 'Eén paar')
assert.equal(P.blindsVoorHand(1).join('/'), '10/20'); assert.equal(P.blindsVoorHand(11).join('/'), '15/30')
assert.equal(P.blindsVoorHand(101).join('/'), '1000/2000')

// ── een stand met vaste kaarten maken ──
// handen: { zetel: [k1, k2] }, bord: 5 kaarten die (in volgorde) op tafel komen
function vast(s, handen, bord) {
  const genomen = new Set([...Object.values(handen).flat(), ...bord])
  const rest = P.maakDeck().filter(k => !genomen.has(k))
  for (const [z, h] of Object.entries(handen)) s.handen[z] = h.slice()
  // de stapel wordt van achter gepakt: verbrand, 3 flop, verbrand, turn, verbrand, river
  const volgorde = [rest[0], bord[0], bord[1], bord[2], rest[1], bord[3], rest[2], bord[4]]
  s.stapel = [...rest.slice(3), ...volgorde.reverse()]
  return s
}
const totaalFiches = s => P.zetels(s).reduce((t, z) => t + s.fiches[z] + s.inzet[z] + s.totaal[z], 0)

// ── met z'n tweeën: de knop is de small blind en begint pre-flop; na de flop begint de big blind ──
{
  zaad = 1
  let s = P.nieuwSpel({ spelers: 2, rng })
  assert.equal(s.knop, 1); assert.equal(s.kleineBlind, 1); assert.equal(s.groteBlind, 2)
  assert.equal(s.inzet[1], 10); assert.equal(s.inzet[2], 20); assert.equal(s.aanZet, 1)
  assert.equal(P.teBetalen(s, 1), 10)
  assert.equal(P.check(s, 1), null, 'je mag niet checken als je nog moet betalen')
  assert.equal(P.raise(s, 1, 30), null, 'raise naar 30 is te weinig (minstens 40)')
  s = P.call(s, 1)
  assert.equal(s.aanZet, 2, 'de big blind mag nog')
  s = P.check(s, 2)
  assert.equal(s.straat, 'flop'); assert.equal(s.bord.length, 3); assert.equal(s.verbrand.length, 1)
  assert.equal(s.aanZet, 2, 'na de flop begint de big blind (links van de knop)')
  s = P.raise(s, 2, 40)   // bet 40
  assert.equal(s.laatste.soort, 'bet')
  assert.equal(P.raise(s, 1, 60), null, 'minstens 40 erbij'); s = P.raise(s, 1, 80)
  assert.equal(s.minRaise, 40); s = P.call(s, 2)
  assert.equal(s.straat, 'turn'); assert.equal(P.pot(s), 200)
  s = P.fold(s, 2)
  assert.equal(s.fase, 'uitslag'); assert.equal(s.uitslag.getoond, false); assert.equal(s.fiches[1], 1100); assert.equal(s.fiches[2], 900)
  s = P.volgendeRonde(s, rng)
  assert.equal(s.knop, 2, 'de knop schuift door'); assert.equal(s.aanZet, 2)
}

// ── zijpot: A all-in met 100, B en C gaan verder; A heeft de beste hand ──
{
  let s = P.nieuwSpel({ spelers: 3, rng })
  s.fiches = { 1: 100, 2: 1000, 3: 1000 }
  s.hand = 0; s.knop = 3
  s = JSON.parse(JSON.stringify(s)); s.fase = 'uitslag'
  s = P.volgendeRonde(s, rng)          // knop 1, sb 2, bb 3, zetel 1 begint
  vast(s, { 1: ['sA', 'hA'], 2: ['sH', 'hH'], 3: ['s2', 'h7'] }, ['rA', 'kH', 'r9', 'k4', 's3'])
  assert.equal(s.knop, 1); assert.equal(s.aanZet, 1)
  s = P.allIn(s, 1); assert.equal(s.laatste.soort, 'allin')
  s = P.raise(s, 2, 300); s = P.call(s, 3)
  assert.equal(s.straat, 'flop')
  s = P.raise(s, 2, 200); s = P.call(s, 3)
  s = P.check(s, 2); s = P.check(s, 3)
  s = P.check(s, 2); s = P.check(s, 3)
  assert.equal(s.fase, 'uitslag')
  const u = s.uitslag
  assert.equal(u.potten[0].bedrag, 300); assert.deepEqual(u.potten[0].winnaars, [1], 'A (drie azen) wint de hoofdpot')
  assert.equal(u.potten[1].bedrag, 800); assert.deepEqual(u.potten[1].winnaars, [2], 'B wint de zijpot')
  assert.equal(s.fiches[1], 300); assert.equal(s.fiches[2], 1000 - 500 + 800); assert.equal(s.fiches[3], 500)
  assert.equal(totaalFiches(s), 2100)
}

// ── gedeelde pot (allebei de straight op tafel) ──
{
  let s = P.nieuwSpel({ spelers: 2, rng })
  vast(s, { 1: ['s2', 'h3'], 2: ['k2', 'r3'] }, ['sA', 'hH', 'rV', 'kB', 's10'])
  s = P.call(s, s.aanZet); s = P.check(s, s.aanZet)
  for (let i = 0; i < 6 && s.fase === 'spel'; i++) s = P.check(s, s.aanZet)
  assert.equal(s.fase, 'uitslag')
  assert.deepEqual(s.uitslag.potten[0].winnaars.sort(), [1, 2]); assert.equal(s.fiches[1], 1000); assert.equal(s.fiches[2], 1000)
}

// ── all-in en call: de rest van de kaarten gaat vanzelf open ──
{
  let s = P.nieuwSpel({ spelers: 2, rng })
  s = P.allIn(s, s.aanZet); s = P.call(s, s.aanZet)
  assert.ok(s.fase === 'uitslag' || s.fase === 'klaar'); assert.equal(s.bord.length, 5); assert.equal(totaalFiches(s), 2000)
}

// ── geldigeStand ──
{
  const s = P.nieuwSpel({ spelers: 4, rng })
  assert.ok(P.geldigeStand(s))
  const kapot = JSON.parse(JSON.stringify(s)); kapot.bord.push(kapot.handen[1][0])
  assert.ok(!P.geldigeStand(kapot), 'een kaart twee keer')
  assert.ok(!P.geldigeStand({ ...s, fiches: { ...s.fiches, 1: -5 } }), 'min-fiches')
  assert.ok(!P.geldigeStand({ ...s, n: 9 }))
}

// ── computer tegen computer ──
let handen = 0
for (let g = 0; g < 10; g++) {
  const n = 2 + (g % 5)
  let s = P.nieuwSpel({ spelers: n, rng })
  for (let stap = 0; s.fase !== 'klaar' && stap < 20000; stap++) {
    if (s.fase === 'uitslag') { s = P.volgendeRonde(s, rng); handen++ }
    else {
      const z = s.aanZet, st = P.computerStap(s, z, ['makkelijk', 'normaal', 'moeilijk'][(z + g) % 3], rng)
      const nieuw = P.doeStap(s, z, st)
      assert.ok(nieuw, 'de computer doet altijd een geldige zet (' + JSON.stringify(st) + ')')
      s = nieuw
    }
    assert.equal(totaalFiches(s), n * 1000, 'de fiches kloppen altijd')
    assert.ok(P.geldigeStand(s), 'de stand is altijd geldig')
  }
  assert.equal(s.fase, 'klaar', 'het potje eindigt'); assert.equal(s.fiches[s.winnaar], n * 1000)
}
assert.ok(handen > 50)
console.log('test-poker: alles goed (' + handen + ' handen computer tegen computer)')
