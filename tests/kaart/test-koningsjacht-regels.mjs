// Koningsjacht (13 nov 2026): de spelregels in koningsjacht.js.
import assert from 'node:assert/strict'
import * as K from '../../koningsjacht.js'

// Een vaste dobbelsteen, zodat de tests elke keer hetzelfde doen
function rngVan(zaad) { let x = zaad; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648 } }
// Een stand met precies de kaarten die we willen
function stand({ vijand = 'sB', hand = [], schade = 0, schild = 0, afleg = [], narren = 0, fase = 'aanval', vorigePas = false } = {}) {
  const s = K.nieuwSpel({ niveau: 'koning', rng: rngVan(1) })
  const alle = [...s.kasteel, ...s.taveerne, ...s.hand]
  s.kasteel = [vijand, ...s.kasteel.filter(id => id !== vijand && !hand.includes(id) && !afleg.includes(id))]
  s.hand = hand.slice(); s.afleg = afleg.slice(); s.tafel = []
  s.taveerne = alle.filter(id => !s.kasteel.includes(id) && !hand.includes(id) && !afleg.includes(id))
  Object.assign(s, { schade, schild, narren, fase, vorigePas })
  assert.ok(K.geldigeStand(s), 'teststand klopt')
  return s
}

// 1. Begin: 12 vijanden (boeren, dan vrouwen, dan heren), 40 kaarten in de taveerne, 8 in je hand
const s = K.nieuwSpel({ niveau: 'schildknaap', rng: rngVan(7) })
assert.equal(s.kasteel.length, 12)
assert.deepEqual(s.kasteel.map(id => id.slice(1)), ['B', 'B', 'B', 'B', 'V', 'V', 'V', 'V', 'H', 'H', 'H', 'H'])
assert.equal(s.hand.length, 8); assert.equal(s.taveerne.length, 32); assert.equal(s.narren, 4)
assert.ok(K.geldigeStand(s))
assert.equal(K.nieuwSpel({ niveau: 'ridder' }).narren, 2); assert.equal(K.nieuwSpel({ niveau: 'koning' }).narren, 0)
assert.deepEqual(K.vijandInfo(stand({ vijand: 'hV' })), { id: 'hV', kleur: 'h', soort: 'V', leven: 30, aanval: 15, extra: 0, over: 30, slag: 15 })

// 2. Waarden en samen spelen
assert.equal(K.waarde('hA'), 1); assert.equal(K.waarde('k7'), 7); assert.equal(K.waarde('sB'), 10); assert.equal(K.waarde('rV'), 15); assert.equal(K.waarde('hH'), 20)
assert.ok(K.geldigeAanval(['h7']))
assert.ok(K.geldigeAanval(['hA', 'k9']), 'aas met een andere kaart')
assert.ok(K.geldigeAanval(['hA', 'sA']), 'twee azen')
assert.ok(K.geldigeAanval(['h2', 'k2', 'r2', 's2']), 'vier 2en = 8')
assert.ok(K.geldigeAanval(['h5', 'k5']), 'twee 5en = 10')
assert.ok(!K.geldigeAanval(['h6', 'k6']), 'twee 6en = 12 is te veel')
assert.ok(!K.geldigeAanval(['h3', 'k4']), 'verschillende waarden zonder aas')
assert.ok(!K.geldigeAanval(['hA', 'k3', 'r3']), 'een aas met twee kaarten mag niet')
assert.ok(!K.geldigeAanval(['hB', 'kB']), 'hoofden niet samen')
assert.ok(!K.geldigeAanval([]))

// 3. Klaveren: dubbele schade. De vijand is immuun voor zijn eigen soort.
let t = stand({ vijand: 'sB', hand: ['k6', 'h2', 'h3', 'h4'] })
let n = K.valAan(t, ['k6'])
assert.equal(n.schade, 12); assert.equal(n.fase, 'verdedig'); assert.equal(K.teAfweren(n), 10)
t = stand({ vijand: 'kB', hand: ['k6', 'h9', 'h3'] })
n = K.valAan(t, ['k6'])
assert.equal(n.schade, 6, 'klaverenvijand: geen dubbele schade'); assert.equal(n.laatste.immuun, 'k')

// 4. Schoppen: een schild dat blijft. Schild groot genoeg = geen slag terug.
t = stand({ vijand: 'hB', hand: ['s7', 's3', 'h4'] })
n = K.valAan(t, ['s7']); assert.equal(n.schild, 7); assert.equal(K.teAfweren(n), 3); assert.equal(n.fase, 'verdedig')
n = K.weerAf(n, ['h4']); assert.equal(n.fase, 'aanval'); assert.deepEqual(n.afleg, ['h4'])
n = K.valAan(n, ['s3']); assert.equal(n.schild, 10); assert.equal(n.fase, 'aanval', 'schild 10 tegen aanval 10: geen slag'); assert.ok(n.laatste.geenSlag)
t = stand({ vijand: 'sB', hand: ['s7', 'h9'] }); n = K.valAan(t, ['s7']); assert.equal(n.schild, 0, 'schoppenvijand: geen schild')

// 5. Ruiten: kaarten pakken (tot 8). Harten: van de aflegstapel onder de taveerne. Eerst harten, dan ruiten.
t = stand({ vijand: 'sB', hand: ['r5', 'h9'] })
n = K.valAan(t, ['r5']); assert.equal(n.hand.length, 6); assert.equal(n.laatste.gepakt.length, 5)
t = stand({ vijand: 'sB', hand: ['r5', 'h2', 'h3', 'h4', 'h6', 'h7', 'h8', 'k2'] })
n = K.valAan(t, ['r5']); assert.equal(n.hand.length, 8, 'niet meer dan 8')
t = stand({ vijand: 'sB', hand: ['h4', 'k9'], afleg: ['r2', 'r3', 'r4', 'r6', 'r7', 'r8'] })
const onder = t.taveerne.length
n = K.valAan(t, ['h4']); assert.equal(n.afleg.length, 2); assert.equal(n.taveerne.length, onder + 4); assert.equal(n.laatste.genezen, 4)
assert.ok(n.taveerne.slice(-4).every(id => id[0] === 'r'), 'onderop de taveerne')
// aas van harten met ruiten 6: kracht 7, eerst 7 terug onder de taveerne, dan 7 pakken
t = stand({ vijand: 'kB', hand: ['hA', 'r6', 'k2'], afleg: ['s2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'] })
n = K.valAan(t, ['hA', 'r6'])
assert.equal(n.laatste.kracht, 7); assert.equal(n.laatste.genezen, 7); assert.equal(n.hand.length, 8); assert.equal(n.schade, 7)

// 6. Verslagen: precies = bovenop de taveerne, anders naar de aflegstapel. Geen slag terug, nieuwe vijand.
t = stand({ vijand: 'hB', hand: ['s10', 'k9'], schade: 10 })
n = K.valAan(t, ['s10'])
assert.ok(n.laatste.verslagen && n.laatste.precies); assert.equal(n.taveerne[0], 'hB'); assert.equal(n.verslagen, 1)
assert.equal(n.fase, 'aanval'); assert.equal(n.schade, 0); assert.equal(n.schild, 0); assert.notEqual(K.vijand(n), 'hB'); assert.deepEqual(n.tafel, [])
assert.ok(n.afleg.includes('s10'))
t = stand({ vijand: 'hB', hand: ['k9', 's3'], schade: 10 })
n = K.valAan(t, ['k9']); assert.ok(n.laatste.verslagen && !n.laatste.precies); assert.ok(n.afleg.includes('hB')); assert.ok(n.afleg.includes('k9'))
assert.ok(K.geldigeStand(n))
// een hoofd in je hand telt 10/15/20
t = stand({ vijand: 'sV', hand: ['hB', 'k2'] })
n = K.valAan(t, ['hB']); assert.equal(n.schade, 10)

// 7. Afweren: genoeg waarde, anders verloren
t = stand({ vijand: 'sH', hand: ['h9', 'k9', 'r2', 'h3'] })
n = K.valAan(t, ['h3']); assert.equal(n.fase, 'verdedig'); assert.equal(K.teAfweren(n), 20)
assert.ok(!K.magAfweren(n, ['h9', 'k9']), '18 is te weinig'); assert.ok(K.magAfweren(n, ['h9', 'k9', 'r2']))
t = stand({ vijand: 'sH', hand: ['h9', 'h3'] })
n = K.valAan(t, ['h3']); assert.ok(n.klaar && !n.gewonnen, 'kan niet afweren en geen nar: verloren'); assert.equal(n.laatste.verloren, 'afweren')

// 8. Passen: niet twee keer achter elkaar
t = stand({ vijand: 'sB', hand: ['h9', 'k4'] })
n = K.pas(t); assert.equal(n.fase, 'verdedig'); n = K.weerAf(n, ['h9', 'k4'])
assert.equal(n.fase, 'aanval'); assert.ok(!K.magPassen(n)); assert.equal(K.pas(n), null)

// 9. Nar: hand weg, 8 nieuwe; redt je bij afweren
t = stand({ vijand: 'sH', hand: ['h9', 'h3'], narren: 1 })
n = K.valAan(t, ['h3']); assert.ok(!n.klaar, 'met een nar ben je nog niet af'); assert.ok(K.magNar(n))
n = K.nar(n); assert.equal(n.hand.length, 8); assert.equal(n.narren, 0); assert.equal(n.narrenGebruikt, 1); assert.ok(n.afleg.includes('h9'))
assert.ok(!K.magNar(n))

// 10. Een heel spel uitspelen (simpele speler): altijd eindigt het, en de kaarten kloppen
function speel(niveau, zaad) {
  let st = K.nieuwSpel({ niveau, rng: rngVan(zaad) })
  for (let i = 0; i < 2000 && !st.klaar; i++) {
    assert.ok(K.geldigeStand(st), 'stand klopt')
    if (st.fase === 'aanval') {
      const ids = [...st.hand].sort((a, b) => K.waarde(b) - K.waarde(a))
      const kies = ids.find(id => K.magAanvallen(st, [id]))
      st = kies ? K.valAan(st, [kies]) : (K.magPassen(st) ? K.pas(st) : K.nar(st))
    } else {
      const ids = [...st.hand].sort((a, b) => K.waarde(a) - K.waarde(b)); const weg = []
      for (const id of ids) { if (K.som(weg) >= K.teAfweren(st)) break; weg.push(id) }
      st = K.magAfweren(st, weg) ? K.weerAf(st, weg) : K.nar(st)
    }
    assert.ok(st, 'elke zet mag')
  }
  assert.ok(st.klaar)
  return st
}
let gewonnen = 0
for (let z = 1; z <= 40; z++) { const e = speel(['schildknaap', 'ridder', 'koning'][z % 3], z); if (e.gewonnen) { gewonnen++; assert.equal(e.verslagen, 12); assert.ok(K.medaille(e)) } }
assert.equal(K.medaille({ gewonnen: true, narrenGebruikt: 0 }), 'goud'); assert.equal(K.medaille({ gewonnen: true, narrenGebruikt: 3 }), 'brons'); assert.equal(K.medaille({ gewonnen: true, narrenGebruikt: 1 }), 'zilver')
assert.equal(K.medaille({ gewonnen: false }), null)
// 11. Samen (v2): twee handen van 7, om de beurt, ♦ om en om, narren samen
{
  const t0 = K.nieuwSpel({ niveau: 'schildknaap', samen: true, rng: rngVan(3) })
  assert.equal(t0.handen[1].length, 7); assert.equal(t0.handen[2].length, 7); assert.equal(t0.taveerne.length, 26); assert.equal(t0.aanZet, 1)
  assert.equal(t0.narren, 2); assert.equal(K.nieuwSpel({ niveau: 'ridder', samen: true }).narren, 1); assert.equal(K.nieuwSpel({ niveau: 'koning', samen: true }).narren, 0)
  assert.ok(K.geldigeStand(t0)); assert.equal(t0.hand, undefined)
  // een vaste stand: speler 1 heeft r5 en kleine kaarten, speler 2 iets anders
  const t = JSON.parse(JSON.stringify(t0))
  const alle = [...t.kasteel, ...t.taveerne, ...t.handen[1], ...t.handen[2]]
  t.kasteel = ['sB', ...t.kasteel.filter(id => id !== 'sB')]
  t.handen = { 1: ['r5', 'h2', 'h3', 'h4', 'h6'], 2: ['k9', 'k8', 'k7'] }
  t.taveerne = alle.filter(id => !t.kasteel.includes(id) && !t.handen[1].includes(id) && !t.handen[2].includes(id))
  assert.ok(K.geldigeStand(t))
  assert.ok(!K.magAanvallen(t, ['k9']), 'speler 1 kan niet met de kaarten van speler 2')
  let n = K.valAan(t, ['r5'])
  assert.equal(n.handen[1].length, 7, '♦: speler 1 vult aan tot 7'); assert.equal(n.handen[2].length, 5, 'en speler 2 krijgt er om en om ook (2)')
  assert.equal(n.laatste.gepaktPer[1].length + n.laatste.gepaktPer[2].length, 5)
  assert.equal(n.fase, 'verdedig'); assert.equal(n.aanZet, 1, 'wie aanvalt, weert af')
  const weg = [...n.handen[1]].sort((a, b) => K.waarde(b) - K.waarde(a)); const kies = []
  for (const id of weg) { if (K.som(kies) >= 10) break; kies.push(id) }
  n = K.weerAf(n, kies); assert.equal(n.aanZet, 2, 'daarna is de ander'); assert.equal(n.fase, 'aanval')
  assert.equal(n.laatste.wie, 1)
  n = K.pas(n); assert.equal(n.fase, 'verdedig'); assert.equal(n.aanZet, 2)
  n = K.nar(n); assert.equal(n.handen[2].length, 7); assert.equal(n.narren, 1)
  assert.ok(K.geldigeStand(n))
}
// 12. Wedstrijd en duel: hetzelfde zaadje = hetzelfde kasteel; een vloek geeft de vijand leven erbij
{
  const a = K.nieuwSpel({ niveau: 'ridder', rng: K.zaadRng(12345) }), b = K.nieuwSpel({ niveau: 'ridder', rng: K.zaadRng(12345) })
  assert.deepEqual(a.kasteel, b.kasteel); assert.deepEqual(a.hand, b.hand)
  const v = K.vervloek(a, 10); assert.equal(K.vijandInfo(v).leven, 30); assert.equal(K.vijandInfo(v).over, 30); assert.equal(v.laatste.soort, 'vloek')
  const t = stand({ vijand: 'hB', hand: ['s10', 'k9'], schade: 20 }); t.extra = 10
  const n = K.valAan(t, ['s10']); assert.ok(n.laatste.verslagen && n.laatste.precies, 'met een vloek moet je er 30 doen'); assert.equal(n.extra, 0)
}
console.log('koningsjacht regels: ok (' + gewonnen + ' van 40 gewonnen door de simpele speler)')
