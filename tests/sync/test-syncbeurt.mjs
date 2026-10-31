// syncbeurt.js (v247): om de beurt syncen met alle online vrienden, met vragen en antwoorden.
// 1. De losse regels. 2. Een nagebootste groep telefoons (berichten met vertraging, syncs die even duren): iedereen
// moet met iedereen klaar komen, zonder vast te lopen, ook als ze in een kring tegelijk vragen.
import assert from 'node:assert/strict'
import * as SB from '../../syncbeurt.js'

// ── 1. Regels ──
const nu = 1e9
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], nu }), 'b', 'nog nooit gesynct: op volgorde')
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], klaarOp: { b: nu - 60e3 }, nu }), 'c', 'b was net klaar: c')
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], klaarOp: { b: nu - 60e3, c: nu - 120e3 }, nu }), null, 'iedereen net klaar: wachten')
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], klaarOp: { b: nu - 11 * 60e3, c: nu - 20 * 60e3 }, nu }), 'c', 'langst geleden eerst')
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], klaarOp: { b: nu - 3 * 60e3, c: nu - 60e3 }, nieuw: new Set(['b']), nu }), 'b', 'iets nieuws: al na 2 minuten')
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], klaarOp: { c: nu - 60e3 }, voorkeur: ['c'], nu }), 'c', 'chatvriend gaat altijd voor')
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], bezigTot: { b: nu + 1000 }, nu }), 'c', 'b zei net nee')
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], behalve: 'b', nu }), 'c')
assert.equal(SB.kiesVolgende({ kandidaten: ['b', 'c'], achteraan: new Set(['b']), nu }), 'c', 'oudere Fibro achteraan')
assert.equal(SB.kiesVolgende({ kandidaten: [], voorkeur: ['b'], nu }), null, 'voorkeur alleen als hij online is en mag')
assert.equal(SB.volgendeMoment({ kandidaten: ['b'], klaarOp: { b: nu - 60e3 }, nu }), nu - 60e3 + SB.OPNIEUW_NA_MS)
assert.equal(SB.volgendeMoment({ kandidaten: [], nu }), Infinity)

assert.deepEqual(SB.beslisVraag({ van: 'b' }), { antwoord: 'ja' })
assert.deepEqual(SB.beslisVraag({ van: 'b', wachtOp: 'b' }), { antwoord: 'ja' }, 'tegelijk gevraagd')
assert.deepEqual(SB.beslisVraag({ van: 'b', wachtOp: 'c' }), { antwoord: 'nee', reden: 'wacht' })
assert.deepEqual(SB.beslisVraag({ van: 'b', partner: 'c' }), { antwoord: 'nee', reden: 'bezig' })
assert.deepEqual(SB.beslisVraag({ van: 'b', partner: 'c', klaar: true }), { antwoord: 'ja', stopEerst: true })
assert.deepEqual(SB.beslisVraag({ van: 'b', partner: 'c', klaar: true, beschermd: true }), { antwoord: 'nee', reden: 'bezig' }, 'open chat niet onderbreken')
assert.deepEqual(SB.beslisVraag({ van: 'b', partner: 'b' }), { antwoord: 'ja', stopEerst: true })
assert.deepEqual(SB.beslisVraag({ van: 'b', inRust: true }), { antwoord: 'nee', reden: 'rust' })
assert.ok(SB.wachtNaNee('wacht', 0) >= 1500 && SB.wachtNaNee('wacht', 0.999) <= 5000)

// ── 2. Een nagebootste groep (zoals sync.js het gebruikt) ──
function simuleer(namen, { seed = 1, duur = 30 * 60e3 } = {}) {
  let s = seed
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
  const rij = []
  let t = 0
  const plan = (na, fn) => rij.push({ t: t + na, fn, n: rij.length })
  const T = Object.fromEntries(namen.map((id) => [id, { id, partner: null, wachtOp: null, wachtNr: 0, sessie: null, klaarOp: {}, bezigTot: {} }]))
  const paren = new Set()
  const stuur = (van, naar, data) => plan(80 + rnd() * 400, () => ontvang(T[naar], van, data))
  const vrienden = (a) => namen.filter((x) => x !== a.id)

  function check(a) {
    if (a.partner || a.wachtOp) return
    const id = SB.kiesVolgende({ kandidaten: vrienden(a), klaarOp: a.klaarOp, bezigTot: a.bezigTot, nu: t })
    if (!id) { const m = SB.volgendeMoment({ kandidaten: vrienden(a), klaarOp: a.klaarOp, bezigTot: a.bezigTot, nu: t }); if (m < Infinity) plan(m - t + 100, () => check(a)); return }
    a.wachtOp = id; const nr = ++a.wachtNr
    stuur(a.id, id, { type: 'vraag' })
    plan(SB.VRAAG_MS, () => { if (a.wachtOp === id && a.wachtNr === nr) { a.wachtOp = null; a.bezigTot[id] = t + 20e3; check(a) } })
  }
  // een sync: beide kanten openen het kanaal; lukt alleen als ze allebei voor elkaar kozen (zoals het echte kanaal)
  function begin(a, id) {
    a.wachtOp = null; a.partner = id
    const b = T[id]
    if (b.partner === a.id && b.sessie && !b.sessie.klaar) { a.sessie = b.sessie; return }
    const sessie = { a: a.id, b: id, klaar: false }
    a.sessie = sessie
    plan(15000, () => { if (a.sessie === sessie && T[id].sessie !== sessie) { stop(a); a.bezigTot[id] = t + 30e3; check(a) } }) // kanaal niet open: mislukking
    plan(1500 + rnd() * 4000, () => {
      if (a.sessie !== sessie || T[id].sessie !== sessie) return
      sessie.klaar = true; a.klaarOp[id] = t; T[id].klaarOp[a.id] = t; paren.add([a.id, id].sort().join('-'))
      for (const x of [a, T[id]]) plan(1500, () => probeerVolgende(x))
    })
  }
  function stop(a) {
    const b = a.partner && T[a.partner]
    a.partner = null; const oud = a.sessie; a.sessie = null
    if (b && b.sessie === oud && oud) plan(200, () => { if (b.sessie === oud) { stop(b); plan(1000, () => check(b)) } }) // de ander ziet het kanaal dichtgaan
  }
  function probeerVolgende(a) {
    if (!a.partner || !a.sessie || !a.sessie.klaar || a.wachtOp) return
    const id = SB.kiesVolgende({ kandidaten: vrienden(a), klaarOp: a.klaarOp, bezigTot: a.bezigTot, nu: t, behalve: a.partner })
    if (!id) { const m = SB.volgendeMoment({ kandidaten: vrienden(a).filter((x) => x !== a.partner), klaarOp: a.klaarOp, bezigTot: a.bezigTot, nu: t }); if (m < Infinity) plan(m - t + 100, () => probeerVolgende(a)); return }
    stop(a); check(a)
  }
  function ontvang(a, van, data) {
    if (data.type === 'vraag') {
      const b = SB.beslisVraag({ van, partner: a.partner, klaar: !!(a.sessie && a.sessie.klaar), wachtOp: a.wachtOp })
      stuur(a.id, van, { type: b.antwoord, reden: b.reden })
      if (b.antwoord === 'ja') { if (b.stopEerst) stop(a); begin(a, van) }
    } else if (data.type === 'ja') {
      if (a.wachtOp === van) begin(a, van)
    } else if (data.type === 'nee') {
      if (a.wachtOp !== van) return
      a.wachtOp = null; a.bezigTot[van] = t + SB.wachtNaNee(data.reden, rnd()); plan(300, () => check(a))
    }
  }
  for (const id of namen) plan(rnd() * 2000, () => check(T[id]))
  const alle = namen.length * (namen.length - 1) / 2
  let klaarNa = null
  while (rij.length && t <= duur) {
    rij.sort((x, y) => x.t - y.t || x.n - y.n)
    const e = rij.shift(); t = e.t; e.fn()
    if (klaarNa === null && paren.size === alle) klaarNa = t
  }
  return { klaarNa, paren: paren.size, alle }
}

for (const n of [2, 3, 4, 5, 6]) {
  for (const seed of [1, 7, 42, 1234]) {
    const namen = Array.from({ length: n }, (_, i) => 'v' + i)
    const r = simuleer(namen, { seed })
    assert.equal(r.paren, r.alle, n + ' vrienden (seed ' + seed + '): iedereen met iedereen gesynct (' + r.paren + '/' + r.alle + ')')
    assert.ok(r.klaarNa < 5 * 60e3, n + ' vrienden (seed ' + seed + '): binnen 5 minuten (' + Math.round(r.klaarNa / 1000) + ' s)')
  }
}
const groot = simuleer(Array.from({ length: 6 }, (_, i) => 'v' + i), { seed: 99 })
console.log('ok: om de beurt syncen (6 vrienden: iedereen met iedereen na ' + Math.round(groot.klaarNa / 1000) + ' s)')
