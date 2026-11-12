// Pesten (11 nov 2026): de spelregels in pesten.js en de computerspeler.
import assert from 'node:assert/strict'
import * as P from '../../pesten.js'

// Een vaste "toevalsgenerator", zodat de test elke keer hetzelfde doet
function zaad(n) { return () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296 } }
const alleKaarten = s => [...s.stapel, ...s.aflegstapel, ...s.handen[1], ...s.handen[2]]

// ── Delen ──
const s0 = P.nieuwSpel({ rng: zaad(1) })
assert.equal(P.maakDeck().length, 54, '52 kaarten en 2 jokers')
assert.equal(s0.handen[1].length, 7); assert.equal(s0.handen[2].length, 7)
assert.equal(s0.aflegstapel.length, 1)
assert.ok(P.geldigeStand(s0), 'een nieuw spel is een geldige stand')
const open = P.kaartInfo(P.bovenste(s0)).waarde
assert.ok(!['2', 'J', 'B', '7', '8', 'A'].includes(open), 'je begint met een gewone kaart open: ' + open)

// Een zelfgemaakte stand om de regels precies te testen
function stand(hand1, hand2, top, extra = {}) {
  const gebruikt = new Set([...hand1, ...hand2, top])
  return { ...P.nieuwSpel({ rng: zaad(2) }), handen: { 1: hand1, 2: hand2 }, aflegstapel: [top],
    stapel: P.maakDeck().filter(id => !gebruikt.has(id)), aanZet: 1, straf: 0, kleur: null, getrokken: false,
    geroepen: { 1: false, 2: false }, betrapbaar: 0, winnaar: 0, ...extra }
}

// ── Opleggen: zelfde kleur of zelfde waarde ──
let s = stand(['h3', 'k9', 's5', 'r6'], ['h4', 'k4'], 'h9')
assert.ok(P.magOp(s, 'h3'), 'zelfde kleur'); assert.ok(P.magOp(s, 'k9'), 'zelfde waarde'); assert.ok(!P.magOp(s, 's5'), 'past niet')
assert.equal(P.speel(s, 1, ['s5']), null, 'een kaart die niet past mag niet')
assert.equal(P.speel(s, 2, ['h4']), null, 'niet op de beurt van de ander')
let n = P.speel(s, 1, ['h3'])
assert.equal(n.aanZet, 2); assert.equal(P.bovenste(n), 'h3'); assert.deepEqual(n.handen[1], ['k9', 's5', 'r6'])
assert.ok(P.geldigeStand(n))
// meer kaarten van dezelfde waarde tegelijk
s = stand(['h3', 'k3', 's3', 'r6'], ['h4'], 'h9')
n = P.speel(s, 1, ['h3', 'k3', 's3'])
assert.deepEqual(n.handen[1], ['r6']); assert.equal(P.bovenste(n), 's3')
assert.equal(P.speel(s, 1, ['h3', 'r6']), null, 'verschillende waarden mag niet samen')

// ── 2 en joker: pakken, en terugpesten stapelt ──
s = stand(['h2', 'k5', 's8'], ['k2', 'J1', 'r9'], 'h9')
n = P.speel(s, 1, ['h2'])
assert.equal(n.straf, 2); assert.equal(n.aanZet, 2)
assert.ok(!P.magOp(n, 'r9'), 'met straf mag je alleen terugpesten')
const terug = P.speel(n, 2, ['J1'])
assert.equal(terug.straf, 7, '2 + joker = 7 kaarten')
const gepakt = P.pak(terug, 1)
assert.equal(gepakt.handen[1].length, 2 + 7); assert.equal(gepakt.straf, 0); assert.equal(gepakt.aanZet, 2)
assert.equal(gepakt.laatste.soort, 'straf'); assert.equal(gepakt.laatste.n, 7)
assert.ok(P.magOp(gepakt, 's8'), 'na een joker (straf gepakt) mag alles')

// ── 7, 8 en aas: nog een keer ──
for (const id of ['h7', 'h8', 'hA']) {
  n = P.speel(stand([id, 'k5', 's5'], ['r4'], 'h9'), 1, [id])
  assert.equal(n.aanZet, 1, id + ': nog een keer')
}

// ── Boer: kleur kiezen ──
s = stand(['kB', 'h5', 's6'], ['r4', 'r5'], 'h9')
assert.ok(P.magOp(s, 'kB'), 'een boer past altijd')
n = P.speel(s, 1, ['kB'], 'r')
assert.equal(n.kleur, 'r'); assert.equal(P.geldendeKleur(n), 'r')
assert.ok(P.magOp(n, 'r4')); assert.ok(!P.magOp(n, 'k5'), 'na de boer telt de gekozen kleur')
assert.ok(!P.magOp(stand(['kB'], ['r4'], 'h9', { straf: 2 }), 'kB'), 'een boer helpt niet tegen een 2')

// ── Pakken en passen ──
s = stand(['s5', 'k6'], ['r4'], 'h9')
n = P.pak(s, 1)
assert.equal(n.handen[1].length, 3); assert.ok(n.getrokken); assert.equal(n.aanZet, 1, 'na pakken mag je nog spelen')
const gepast = P.pas(n, 1)
assert.equal(gepast.aanZet, 2); assert.ok(!gepast.getrokken)
assert.equal(P.pas(s, 1), null, 'passen kan pas na pakken')
assert.equal(P.pak(n, 1).aanZet, 2, 'nog eens op de stapel tikken = passen')

// ── Laatste kaart en betrappen ──
s = stand(['h3', 'h4'], ['k4', 'k5', 'k6'], 'h9')
n = P.speel(s, 1, ['h3'])
assert.equal(n.betrapbaar, 1, 'niet geroepen met 1 kaart: betrapbaar')
const betrapt = P.betrap(n, 2)
assert.equal(betrapt.handen[1].length, 1 + P.BETRAP_STRAF); assert.equal(betrapt.betrapbaar, 0); assert.equal(betrapt.aanZet, 2)
assert.ok(P.magRoepen(s, 1))
const geroepen = P.roep(s, 1)
n = P.speel(geroepen, 1, ['h3'])
assert.equal(n.betrapbaar, 0, 'wel geroepen: niet te betrappen')
assert.equal(P.betrap(n, 2), null)
assert.equal(P.roep(stand(['h3', 'h4', 'h5'], ['k4'], 'h9'), 1), null, 'roepen kan pas bij 2 kaarten')

// ── Winnen ──
n = P.speel(stand(['h3'], ['k4'], 'h9'), 1, ['h3'])
assert.equal(n.winnaar, 1)
assert.equal(P.speel(n, 2, ['k4']), null, 'na het einde geen zetten meer')

// ── Stapel op: de aflegstapel wordt geschud ──
s = stand(['s5'], ['r4'], 'h9')
s.aflegstapel = [...s.stapel, 'h9']; s.stapel = []
n = P.pak(s, 1, zaad(3))
assert.equal(n.handen[1].length, 2); assert.equal(n.aflegstapel.length, 1); assert.equal(P.bovenste(n), 'h9')
assert.ok(P.geldigeStand(n))

// ── Ongeldige standen worden geweigerd ──
assert.ok(!P.geldigeStand({ ...s0, handen: { 1: ['h3', 'h3'], 2: [] } }))
assert.ok(!P.geldigeStand(null))

// ── De computer speelt hele spellen tegen zichzelf zonder vast te lopen ──
for (const niveau of ['makkelijk', 'normaal', 'moeilijk']) {
  for (let spel = 0; spel < 40; spel++) {
    const rng = zaad(100 + spel)
    let st = P.nieuwSpel({ rng, begint: spel % 2 ? 2 : 1 })
    let stappen = 0
    while (!st.winnaar && stappen < 3000) {
      const sp = st.aanZet
      const stap = P.computerStap(st, sp, niveau, rng)
      const nieuw = P.doeStap(st, sp, stap, rng)
      assert.ok(nieuw, niveau + ': de computer doet een geldige stap (' + JSON.stringify(stap) + ')')
      assert.ok(P.geldigeStand(nieuw), 'altijd 54 kaarten')
      st = nieuw; stappen++
    }
    assert.ok(st.winnaar, niveau + ': het spel heeft een winnaar (na ' + stappen + ' stappen)')
  }
}
console.log('pesten regels: ok')
