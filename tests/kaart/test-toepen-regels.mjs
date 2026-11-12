// Toepen (11 nov 2026): de spelregels in toepen.js en de computerspeler.
import assert from 'node:assert/strict'
import * as P from '../../toepen.js'

function zaad(n) { return () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296 } }

// ── Delen ──
const s0 = P.nieuwSpel({ rng: zaad(1) })
assert.equal(P.maakDeck().length, 32, '32 kaarten: 7 t/m aas')
assert.equal(s0.handen[1].length, 4); assert.equal(s0.handen[2].length, 4)
assert.equal(s0.inzet, 1); assert.equal(s0.aanZet, 1); assert.equal(s0.slagNr, 1)
assert.ok(P.geldigeStand(s0), 'een nieuw spel is een geldige stand')
assert.deepEqual(P.RANG, ['B', 'V', 'H', 'A', '7', '8', '9', '10'], 'boer laagst, 10 hoogst')

// Een zelfgemaakte stand
function stand(hand1, hand2, extra = {}) {
  const gebruikt = new Set([...hand1, ...hand2])
  return { ...P.nieuwSpel({ rng: zaad(2) }), handen: { 1: hand1, 2: hand2 }, stapel: P.maakDeck().filter(id => !gebruikt.has(id)),
    slag: [], weg: [], slagNr: 1, aanZet: 1, voorhand: 1, rondeBegint: 1, ...extra }
}

// ── Bekennen ──
let s = stand(['h7', 'k10', 'sB', 'r9'], ['hB', 'h10', 'kV', 's8'])
assert.equal(P.speel(s, 2, 'hB'), null, 'niet op de beurt van de ander')
s = P.speel(s, 1, 'h7')
assert.equal(s.aanZet, 2)
assert.ok(!P.magSpelen(s, 2, 'kV'), 'wie harten heeft, moet harten bekennen')
assert.deepEqual(P.speelbaar(s, 2).sort(), ['h10', 'hB'])
// ── De hoogste van de gevraagde kleur wint; 10 is hoger dan 7 ──
let t = P.speel(s, 2, 'h10')
assert.equal(t.laatste.slagWinnaar, 2, '10 wint van 7')
assert.equal(t.aanZet, 2, 'wie de slag wint, komt uit'); assert.equal(t.slagNr, 2); assert.deepEqual(t.laatste.slag, ['h7', 'h10'])
t = P.speel(s, 2, 'hB')
assert.equal(t.laatste.slagWinnaar, 1, 'boer is lager dan 7')
// Niet bekennen = verliezen, ook met een 10
s = stand(['h7', 'k10'], ['k9', 's10'], { handen: { 1: ['h7', 'k10'], 2: ['k9', 's10'] } })
s = P.speel(s, 1, 'h7'); assert.ok(P.magSpelen(s, 2, 's10'), 'geen harten: alles mag')
assert.equal(P.speel(s, 2, 's10').laatste.slagWinnaar, 1, 'wie niet bekent, verliest de slag')

// ── Alleen de laatste slag telt; de volgende ronde wordt meteen gedeeld ──
s = stand(['h7'], ['h8'], { slagNr: 4 })
s.stapel = P.maakDeck().filter(id => !['h7', 'h8'].includes(id))
s = P.speel(P.speel(s, 1, 'h7'), 2, 'h8')
assert.equal(s.laatste.ronde.verliezer, 1); assert.equal(s.laatste.ronde.punten, 1)
assert.equal(s.straf[1], 1); assert.equal(s.straf[2], 0)
assert.equal(s.ronde, 2); assert.equal(s.handen[1].length, 4); assert.equal(s.handen[2].length, 4)
assert.equal(s.aanZet, 2, 'de volgende ronde begint de ander'); assert.equal(s.inzet, 1)
assert.ok(P.geldigeStand(s))

// ── Toepen ──
s = stand(['h7', 'k10', 'sB', 'r9'], ['hB', 'h10', 'kV', 's8'])
assert.ok(P.magToepen(s, 1)); assert.ok(!P.magToepen(s, 2), 'alleen op je beurt')
s = P.toep(s, 1)
assert.equal(s.toep, 1); assert.equal(s.aanZet, 2, 'de ander moet antwoorden')
assert.ok(!P.magSpelen(s, 2, 'hB'), 'eerst antwoorden, dan pas spelen')
let m = P.mee(s, 2)
assert.equal(m.inzet, 2); assert.equal(m.aanZet, 1, 'na meegaan speelt de toeper verder'); assert.equal(m.toep, 0)
assert.ok(!P.magToepen(m, 1), 'niet twee keer achter elkaar toepen')
m = P.speel(m, 1, 'h7')
assert.ok(P.magToepen(m, 2), 'de ander mag wel terugtoepen')
m = P.mee(P.toep(m, 2), 1)
assert.equal(m.inzet, 3, 'terugtoepen: inzet 3'); assert.equal(m.aanZet, 2, 'de toeper (2) speelt verder')
// Eruit gaan: de oude inzet als strafpunten, nieuwe ronde
let u = P.gaUit(s, 2)
assert.equal(u.straf[2], 1, 'eruit = de inzet van vóór de toep'); assert.equal(u.laatste.ronde.reden, 'uit')
assert.equal(u.ronde, 2); assert.equal(u.inzet, 1); assert.ok(P.geldigeStand(u))
assert.equal(P.gaUit(s, 1), null, 'de toeper kan niet zelf eruit gaan')

// ── 10 strafpunten = verloren ──
s = stand(['h7'], ['h8'], { slagNr: 4, straf: { 1: 8, 2: 3 }, inzet: 2 })
s.stapel = P.maakDeck().filter(id => !['h7', 'h8'].includes(id))
s = P.speel(P.speel(s, 1, 'h7'), 2, 'h8')
assert.equal(s.straf[1], 10); assert.equal(s.winnaar, 2, 'wie 10 strafpunten heeft, verliest')
assert.equal(P.speel(s, 2, s.handen[2][0]), null, 'na het einde mag er niets meer')

// ── Kapotte standen ──
assert.ok(!P.geldigeStand({ ...s0, handen: { 1: s0.handen[1], 2: [...s0.handen[2], s0.handen[1][0]] } }), 'dubbele kaart')
assert.ok(!P.geldigeStand(null))

// ── De computer speelt hele spellen uit, op elk niveau ──
for (const niveau of ['makkelijk', 'normaal', 'moeilijk']) {
  for (let z = 1; z <= 15; z++) {
    const rng = zaad(z * 7 + niveau.length)
    let st = P.nieuwSpel({ rng, begint: 1 + (z % 2) })
    let stappen = 0
    while (!st.winnaar && stappen < 2000) {
      const sp = st.aanZet
      const stap = P.computerStap(st, sp, niveau, rng)
      assert.ok(stap, 'de computer weet altijd iets')
      const nieuw = P.doeStap(st, sp, stap, rng)
      assert.ok(nieuw, niveau + ': de stap mag: ' + JSON.stringify(stap))
      assert.ok(P.geldigeStand(nieuw), 'altijd een geldige stand')
      st = nieuw; stappen++
    }
    assert.ok(st.winnaar, niveau + ': het spel eindigt')
    assert.ok(Math.max(st.straf[1], st.straf[2]) >= P.VERLIES_BIJ)
  }
}
// Moeilijk bewaart zijn hoogste kaart voor de laatste slag
s = stand(['k7', 'k10', 'sB', 'r9'], ['hB', 'h10', 'kV', 's8'], { aanZet: 1 })
assert.notEqual(P.computerStap(s, 1, 'moeilijk', () => 0.99).kaart, 'k10', 'de 10 niet meteen weggooien')
console.log('toepen regels: ok')
