// Eenentwintigen (11 nov 2026): de spelregels in eenentwintigen.js en de computerspeler.
import assert from 'node:assert/strict'
import * as P from '../../eenentwintigen.js'

function zaad(n) { return () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296 } }

// ── Tellen ──
assert.equal(P.totaal(['h10', 'kH']), 20)
assert.equal(P.totaal(['hA', 'kH']), 21, 'aas + heer = 21')
assert.equal(P.totaal(['hA', 'kA', 's9']), 21, 'aas telt 11 of 1')
assert.equal(P.totaal(['hA', 'k9', 's5']), 15, 'aas telt 1 als 11 te veel is')
assert.deepEqual(P.telling(['hA', 'k6']), { totaal: 17, zacht: true })

// ── Delen ──
const s0 = P.nieuwSpel({ rng: zaad(1) })
assert.equal(P.maakDeck().length, 52)
assert.equal(s0.handen[1].length, 2); assert.equal(s0.handen[2].length, 2)
assert.ok(P.geldigeStand(s0))

function stand(hand1, hand2, extra = {}) {
  const gebruikt = new Set([...hand1, ...hand2])
  return { ...P.nieuwSpel({ rng: zaad(3) }), handen: { 1: hand1, 2: hand2 }, stapel: P.maakDeck().filter(id => !gebruikt.has(id)),
    aanZet: 1, gestopt: { 1: false, 2: false }, klaar: false, winnaar: 0, ...extra }
}

// ── Om de beurt: eerst speler 1 helemaal, dan speler 2 ──
let s = stand(['h10', 'k6'], ['s9', 'r8'])
assert.equal(P.pak(s, 2), null, 'niet op de beurt van de ander')
s.stapel.push('k3')
s = P.pak(s, 1)
assert.deepEqual(s.handen[1], ['h10', 'k6', 'k3']); assert.equal(s.aanZet, 1, 'na pakken nog steeds jij')
s = P.stop(s, 1)
assert.equal(s.aanZet, 2); assert.ok(s.gestopt[1])
assert.equal(P.pak(s, 1), null, 'wie blijft, kan niet meer pakken')
s.stapel.push('h2')
s = P.stop(P.pak(s, 2), 2)
assert.ok(s.klaar, 'allebei gebleven: klaar')
assert.equal(P.totaal(s.handen[1]), 19); assert.equal(P.totaal(s.handen[2]), 19)
assert.equal(s.winnaar, 0, 'evenveel = gelijkspel')

// ── Te veel = meteen af ──
s = stand(['h10', 'k9'], ['s9', 'r8'])
s.stapel.push('k5')
s = P.pak(s, 1)
assert.equal(s.laatste.soort, 'dood'); assert.ok(s.klaar); assert.equal(s.winnaar, 2, 'boven 21: de ander wint meteen')
// De tweede gaat te ver
s = stand(['h10', 'k8'], ['s9', 'r8'], { gestopt: { 1: true, 2: false }, aanZet: 2 })
s.stapel.push('kH')
s = P.pak(s, 2)
assert.equal(s.winnaar, 1)

// ── Precies 21 = vanzelf blijven ──
s = stand(['h10', 'k5'], ['s9', 'r8'])
s.stapel.push('k6')
s = P.pak(s, 1)
assert.ok(s.gestopt[1]); assert.ok(s.laatste.eenentwintig); assert.equal(s.aanZet, 2)
s = P.stop(s, 2)
assert.equal(s.winnaar, 1, '21 tegen 17')

// ── Kapotte standen ──
assert.ok(!P.geldigeStand({ ...s0, handen: { 1: s0.handen[1], 2: [s0.handen[1][0], s0.handen[2][1]] } }))

// ── De computer speelt hele spellen uit ──
for (const niveau of ['makkelijk', 'normaal', 'moeilijk']) {
  for (let z = 1; z <= 30; z++) {
    const rng = zaad(z * 11 + niveau.length)
    let st = P.nieuwSpel({ rng, begint: 1 + (z % 2) }), n = 0
    while (!st.klaar && n++ < 60) {
      const sp = st.aanZet
      const stap = P.computerStap(st, sp, niveau, rng)
      const nieuw = P.doeStap(st, sp, stap)
      assert.ok(nieuw && P.geldigeStand(nieuw), niveau + ': stap mag')
      st = nieuw
    }
    assert.ok(st.klaar, niveau + ': het spel eindigt')
  }
}
assert.deepEqual(P.computerStap(stand(['h10', 'k6'], ['s9', 'r8']), 1, 'normaal'), { soort: 'pak' }, '16: pakken')
assert.deepEqual(P.computerStap(stand(['h10', 'k7'], ['s9', 'r8']), 1, 'normaal'), { soort: 'stop' }, '17: blijven')
console.log('eenentwintigen regels: ok')
