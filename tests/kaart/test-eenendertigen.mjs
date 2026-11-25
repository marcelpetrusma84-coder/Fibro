// test-eenendertigen.mjs (25 nov 2026): de regels van Eenendertigen (eenendertigen.js, uit Stekky Studio), zoals Marcel
// ze koos: pas kloppen na één rondgang, gelijk = allebei een leven, wie klopte verliest er ook maar één, 0 levens = af.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
globalThis.window = {}
const P = await import('../../eenendertigen.js')
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

// ── Punten ──
assert.equal(P.maakDeck().length, 32, 'piket: 32 kaarten')
assert.equal(P.punten(['hA', 'hH', 'h10']), 31)
assert.equal(P.punten(['hA', 'hH', 's10']), 21, 'alleen dezelfde kleur telt')
assert.equal(P.punten(['h7', 's8', 'k9']), 9, 'je beste kleur')
assert.equal(P.punten(['hV', 'sV', 'kV']), 30.5, 'drie dezelfde = 30½')
assert.equal(P.punten(['hA', 'sA', 'kA']), 30.5)
assert.equal(P.toonPunten(30.5), '30½')
console.log('PASS: punten tellen (31, beste kleur, 30½)')

// Een vaste stand om mee te rekenen
function stand(h1, h2, tafel, extra = {}) {
  const rest = P.maakDeck().filter(id => ![...h1, ...h2, ...tafel].includes(id))
  return { stapel: rest, handen: { 1: h1, 2: h2 }, tafel, aanZet: 1, begint: 1, beurten: 0, geklopt: 0, fase: 'spel', uitslag: null,
    levens: { 1: 3, 2: 3 }, ronde: 1, winnaar: 0, klaar: false, laatste: { soort: 'deel', wie: 0, kaarten: [] }, ...extra }
}
let s = stand(['h7', 's8', 'k9'], ['r7', 'r8', 'r9'], ['hA', 'hH', 'sA'])
assert.ok(P.geldigeStand(s))
assert.equal(P.klop(s, 1), null, 'kloppen mag niet in de eerste beurt')
assert.equal(P.ruil(s, 2, 'r7', 'hA'), null, 'niet aan de beurt')
assert.equal(P.ruil(s, 1, 'r7', 'hA'), null, 'niet jouw kaart')
s = P.ruil(s, 1, 's8', 'hA')
assert.deepEqual(s.handen[1], ['h7', 'hA', 'k9']); assert.deepEqual(s.tafel, ['s8', 'hH', 'sA']); assert.equal(s.aanZet, 2); assert.equal(s.beurten, 1)
assert.equal(P.klop(s, 2), null, 'speler 2 mag ook nog niet kloppen in de eerste rondgang')
s = P.ruilAlles(s, 2)
assert.deepEqual(s.handen[2], ['s8', 'hH', 'sA']); assert.deepEqual(s.tafel, ['r7', 'r8', 'r9'])
assert.ok(P.magKloppen(s, 1), 'na een rondgang mag je kloppen')
s = P.klop(s, 1)
assert.equal(s.geklopt, 1); assert.equal(s.aanZet, 2); assert.equal(P.klop(s, 2), null, 'maar één keer kloppen')
s = P.ruil(s, 2, 'hH', 'r9')
assert.equal(s.fase, 'uitslag', 'na de laatste beurt is de ronde klaar')
assert.deepEqual(s.uitslag.punten, { 1: 18, 2: 19 }); assert.deepEqual(s.uitslag.verliezers, [1])
assert.deepEqual(s.levens, { 1: 2, 2: 3 }, 'wie klopte en verloor: maar één leven')
assert.equal(P.ruil(s, 1, 'h7', 'r7'), null, 'na de ronde mag niemand meer ruilen')
console.log('PASS: ruilen, alles ruilen, kloppen pas na één rondgang, de laatste beurt na kloppen')

// Gelijk: allebei een leven
s = stand(['h7', 'h8', 's9'], ['r7', 'r8', 'k9'], ['k7', 's7', 'r10'], { beurten: 2 })
s = P.klop(s, 1); s = P.ruil(s, 2, 'k9', 's7')
assert.deepEqual(s.uitslag.verliezers, [1, 2], 'evenveel: allebei een leven'); assert.deepEqual(s.levens, { 1: 2, 2: 2 })
// 31: meteen klaar, ook zonder kloppen
s = stand(['hA', 'hH', 's7'], ['r7', 'r8', 'k9'], ['h10', 's8', 'k7'])
s = P.ruil(s, 1, 's7', 'h10')
assert.equal(s.fase, 'uitslag'); assert.equal(s.uitslag.reden, '31'); assert.deepEqual(s.uitslag.verliezers, [2])
// 0 levens = af
s = stand(['h7', 'h8', 's9'], ['rA', 'rH', 'k9'], ['k7', 's7', 'r10'], { beurten: 2, levens: { 1: 1, 2: 2 } })
s = P.klop(s, 1); s = P.ruil(s, 2, 'k9', 'r10')
assert.equal(s.fase, 'klaar'); assert.equal(s.klaar, true); assert.equal(s.winnaar, 2); assert.equal(s.levens[1], 0)
assert.equal(P.volgendeRonde(s), null, 'na het einde geen nieuwe ronde')
s = stand(['h7', 'h8', 's9'], ['r7', 'r8', 'k9'], ['k7', 's7', 'r10'], { beurten: 2, levens: { 1: 1, 2: 1 } })
s = P.klop(s, 1); s = P.ruil(s, 2, 'k9', 's7')
assert.equal(s.winnaar, 0, 'allebei af: gelijkspel')
console.log('PASS: gelijk = allebei een leven, 31 = meteen klaar, 0 levens = af')

// Volgende ronde: de levens blijven, wie begint wisselt
s = stand(['h7', 'h8', 's9'], ['rA', 'rH', 'k9'], ['k7', 's7', 'r10'], { beurten: 2 })
s = P.klop(s, 1); s = P.ruil(s, 2, 'k9', 'r10')
const n = P.volgendeRonde(s)
assert.equal(n.ronde, 2); assert.equal(n.begint, 2); assert.deepEqual(n.levens, { 1: 2, 2: 3 }); assert.ok(P.geldigeStand(n))
assert.equal(P.volgendeRonde(n), n.fase === 'uitslag' ? P.volgendeRonde(n) : null)
// geldigeStand houdt rommel tegen
const g = P.nieuwSpel()
assert.ok(P.geldigeStand(g))
assert.equal(P.geldigeStand({ ...g, tafel: [g.tafel[0], g.tafel[0], g.tafel[1]] }), false, 'dubbele kaart')
assert.equal(P.geldigeStand({ ...g, levens: { 1: 9, 2: 3 } }), false)
assert.equal(P.geldigeStand({ ...g, fase: 'raar' }), false)
assert.equal(P.geldigeStand(null), false)
console.log('PASS: volgende ronde en geldigeStand')

// ── Twee computers spelen 500 potjes: het loopt nooit vast en er komt altijd een einde ──
let r = 7
const rng = () => { r = (r * 16807) % 2147483647; return r / 2147483647 }
const uitslagen = { 0: 0, 1: 0, 2: 0 }
for (let pot = 0; pot < 500; pot++) {
  let st = P.nieuwSpel({ begint: 1 + (pot % 2), rng }), stappen = 0
  const niveaus = { 1: ['makkelijk', 'normaal', 'moeilijk'][pot % 3], 2: 'moeilijk' }
  while (st.fase !== 'klaar') {
    assert.ok(P.geldigeStand(st), 'altijd een geldige stand')
    if (st.fase === 'uitslag') { st = P.volgendeRonde(st, rng); continue }
    const sp = st.aanZet
    const nieuw = P.doeStap(st, sp, P.computerStap(st, sp, niveaus[sp], rng))
    assert.ok(nieuw, 'de computer doet altijd een geldige zet'); st = nieuw
    assert.ok(++stappen < 5000, 'het spel eindigt')
  }
  uitslagen[st.winnaar]++
}
assert.ok(uitslagen[2] > uitslagen[1], 'moeilijk wint vaker (' + JSON.stringify(uitslagen) + ')')
console.log('PASS: twee computers spelen 500 potjes zonder vast te lopen ' + JSON.stringify(uitslagen))

// ── v2: meer spelers (2 tot 6) ──
const stand4 = (handen, tafel, extra = {}) => {
  const alle = Object.values(handen).flat().concat(tafel)
  return { n: 4, stapel: P.maakDeck().filter(id => !alle.includes(id)), handen, tafel, aanZet: 1, begint: 1, beurten: 0, geklopt: 0, fase: 'spel', uitslag: null,
    levens: { 1: 3, 2: 3, 3: 3, 4: 3 }, ronde: 1, winnaar: 0, klaar: false, laatste: { soort: 'deel', wie: 0, kaarten: [] }, ...extra }
}
let m = stand4({ 1: ['h7', 'h8', 's9'], 2: ['r7', 'r8', 'k9'], 3: ['k7', 'k8', 'sV'], 4: ['hA', 'hH', 's7'] }, ['h10', 's8', 'r10'])
assert.ok(P.geldigeStand(m))
m = P.ruil(m, 1, 's9', 's8'); assert.equal(m.aanZet, 2)
m = P.ruil(m, 2, 'k9', 's9'); assert.equal(m.aanZet, 3)
assert.equal(P.klop(m, 3), null, 'kloppen pas als iedereen (4) één keer was')
m = P.ruil(m, 3, 'sV', 'k9'); assert.equal(m.aanZet, 4)
assert.equal(P.magKloppen(m, 4), false, 'zetel 4 zit nog in de eerste rondgang')
m = P.ruil(m, 4, 's7', 'sV'); assert.equal(m.aanZet, 1)
assert.ok(P.magKloppen(m, 1)); m = P.klop(m, 1); assert.equal(m.aanZet, 2)
m = P.ruil(m, 2, 'r7', 'h10'); m = P.ruil(m, 3, 'k7', 'r7')
assert.equal(m.fase, 'spel'); assert.equal(m.aanZet, 4, 'na kloppen krijgt iedereen nog één beurt')
m = P.ruil(m, 4, 'hA', 'k7')
assert.equal(m.fase, 'uitslag', 'terug bij de klopper: klaar')
const laagst = Math.min(...Object.values(m.uitslag.punten))
assert.deepEqual(m.uitslag.verliezers, Object.keys(m.uitslag.punten).map(Number).filter(z => m.uitslag.punten[z] === laagst))
// 31 bij 4 spelers: alle anderen verliezen een leven
m = stand4({ 1: ['hA', 'hH', 's7'], 2: ['r7', 'r8', 'k9'], 3: ['k7', 'k8', 'sV'], 4: ['h7', 'h8', 's9'] }, ['h10', 's8', 'r10'])
m = P.ruil(m, 1, 's7', 'h10')
assert.equal(m.uitslag.reden, '31'); assert.deepEqual(m.uitslag.verliezers, [2, 3, 4], 'bij 31 verliezen alle anderen')
// eruit: wie 0 levens heeft, krijgt geen kaarten meer en wordt overgeslagen
m = stand4({ 1: ['hA', 'hH', 's7'], 2: ['r7', 'r8', 'k9'], 3: ['k7', 'k8', 'sV'], 4: ['h7', 'h8', 's9'] }, ['h10', 's8', 'r10'], { levens: { 1: 3, 2: 1, 3: 2, 4: 2 } })
m = P.ruil(m, 1, 's7', 'h10')
assert.deepEqual(m.uitslag.eruit, [2]); assert.equal(m.levens[2], 0)
const r2 = P.volgendeRonde(m)
assert.equal(r2.handen[2].length, 0, 'wie eruit ligt krijgt geen kaarten'); assert.ok([1, 3, 4].every(z => r2.handen[z].length === 3)); assert.ok(P.geldigeStand(r2))
assert.equal(P.volgende(r2, 1), 3, 'zetel 2 wordt overgeslagen')
// de laatste die over is, wint
m = stand4({ 1: ['hA', 'hH', 's7'], 2: [], 3: [], 4: ['h7', 'h8', 's9'] }, ['h10', 's8', 'r10'], { levens: { 1: 2, 2: 0, 3: 0, 4: 1 } })
m = P.ruil(m, 1, 's7', 'h10')
assert.equal(m.fase, 'klaar'); assert.equal(m.winnaar, 1)
for (const n of [1, 7, 'x']) assert.equal(P.nieuwSpel({ spelers: n }).n, n === 7 ? 6 : 2, 'tussen 2 en 6 spelers')
console.log('PASS: meer spelers: in de rondte, kloppen, 31 = alle anderen een leven, eruit liggen, de laatste wint')

for (const n of [3, 4, 5, 6]) {
  let st = P.nieuwSpel({ spelers: n, rng }), stappen = 0
  while (st.fase !== 'klaar') {
    assert.ok(P.geldigeStand(st), 'altijd een geldige stand (' + n + ')')
    if (st.fase === 'uitslag') { st = P.volgendeRonde(st, rng); continue }
    st = P.doeStap(st, st.aanZet, P.computerStap(st, st.aanZet, 'normaal', rng))
    assert.ok(st && ++stappen < 20000)
  }
  assert.ok([0, ...P.zetels(st)].includes(st.winnaar))
}
console.log('PASS: computers spelen met 3, 4, 5 en 6 spelers tot het einde')

// ── groepspel.js: een gastheer, twee gasten en een computer op één nagemaakt kanaal ──
const { maakGroepSpel } = await import('../../groepspel.js')
const luisteraars = []
const kanaal = id => ({ on(_, f, fn) { luisteraars.push({ id, ev: f.event, fn }); return this },
  send(b) { for (const l of luisteraars) if (l.id !== id && l.ev === b.event) setTimeout(() => l.fn({ payload: JSON.parse(JSON.stringify(b.payload)) }), 1); return Promise.resolve('ok') } })
const spelers = [{ zetel: 1, naam: 'Marcel' }, { zetel: 2, naam: 'Tijn' }, { zetel: 3, naam: 'Bram' }, { zetel: 4, naam: 'Computer', computer: true }]
const regels = { aanZet: s => (s && s.fase === 'spel' ? s.aanZet : 0), doeStap: P.doeStap, computerStap: P.computerStap, geldigeStand: P.geldigeStand,
  volgendeRonde: s => (s && s.fase === 'uitslag' ? P.volgendeRonde(s) : null) }
const standen = { 1: [], 2: [], 3: [] }
const spellen = [1, 2, 3].map(z => maakGroepSpel({ kanaal: kanaal(z), zetel: z, spelers, regels, beurtMs: 400, speling: 100, rondePauze: 30, denkMs: () => 3,
  onStand: (oud, nieuw) => standen[z].push(nieuw) }))
assert.equal(spellen[0].gastheer, true); assert.equal(spellen[1].gastheer, false)
assert.equal(spellen[1].doe({ soort: 'alles' }), false, 'zonder stand kan een gast niets')
spellen[0].start(P.nieuwSpel({ spelers: 4, rng }))
await new Promise(k => setTimeout(k, 50))
assert.deepEqual(standen[2].at(-1), spellen[0].staat(), 'de gasten krijgen de stand van de gastheer')
assert.equal(spellen[1].doe({ soort: 'alles' }), spellen[0].staat().aanZet === 2, 'een gast mag alleen als hij aan de beurt is')
// iedereen speelt: de mensen doen een computerzet zodra ze aan de beurt zijn; de computer speelt zelf (op de gastheer)
let rondes = 0
const speel = setInterval(() => {
  for (const g of spellen) { const st = g.staat(); if (st && st.fase === 'spel' && st.aanZet === g.zetel) g.doe(P.computerStap(st, g.zetel, 'normaal', rng)) }
}, 5)
for (let t = 0; t < 600 && spellen[0].staat().fase !== 'klaar'; t++) await new Promise(k => setTimeout(k, 20))
clearInterval(speel)
const eind = spellen[0].staat()
assert.equal(eind.fase, 'klaar', 'het spel met 4 (3 mensen + computer) speelt tot het einde')
await new Promise(k => setTimeout(k, 50))
assert.deepEqual(spellen[1].staat(), eind); assert.deepEqual(spellen[2].staat(), eind)
assert.ok(standen[1].some(s => s.laatste.wie === 4), 'de computer (zetel 4) heeft gespeeld')
for (const g of spellen) g.stop()
console.log('PASS: groepspel: de gastheer heeft de stand, de gasten sturen hun zet, de computer speelt mee, iedereen ziet hetzelfde einde')

// een gast laat zijn beurt verlopen: de computer zet voor hem; een gast gaat weg: de computer neemt over
const luis2 = []
const kan2 = id => ({ on(_, f, fn) { luis2.push({ id, ev: f.event, fn }); return this },
  send(b) { for (const l of luis2) if (l.id !== id && l.ev === b.event) setTimeout(() => l.fn({ payload: JSON.parse(JSON.stringify(b.payload)) }), 1); return Promise.resolve('ok') } })
const g1 = maakGroepSpel({ kanaal: kan2(1), zetel: 1, spelers: spelers.slice(0, 2), regels, beurtMs: 100, speling: 50, rondePauze: 10, onStand() {} })
const g2 = maakGroepSpel({ kanaal: kan2(2), zetel: 2, spelers: spelers.slice(0, 2), regels, beurtMs: 100, speling: 50, rondePauze: 10, onStand() {} })
g1.start(P.nieuwSpel({ spelers: 2, begint: 2, rng }))
await new Promise(k => setTimeout(k, 400))
assert.ok(g1.staat().beurten >= 1, 'de computer zette voor de gast die niets deed')
g2.stop(); await new Promise(k => setTimeout(k, 20))
assert.equal(g1.computer(2), true, 'wie weggaat, wordt de computer')
g1.stop()
console.log('PASS: groepspel: een verlopen beurt of iemand die weggaat speelt de computer')

// ── tegen de computer (solo.js): de bot doet niets, het spel zelf speelt de computers ──
const b = P.bot({ stuur() { throw new Error('mag niet') }, niveau: 'normaal', isDicht: () => false })
b.ontvang('stand', { staat: P.nieuwSpel(), nr: 1, spelId: 1 }); b.stop()
console.log('PASS: de bot voor solo.js is stil')

// ── Passen (v3) ──
{
  let q = stand(['h7', 's8', 'k9'], ['r7', 'r8', 'r9'], ['hA', 'hH', 'sA'])
  assert.equal(P.pas(q, 2), null, 'passen alleen als je aan de beurt bent')
  const tafel0 = q.tafel.slice()
  q = P.pas(q, 1)
  assert.equal(q.aanZet, 2); assert.equal(q.passen, 1); assert.equal(q.beurten, 1); assert.deepEqual(q.tafel, tafel0, 'één keer passen: tafel blijft')
  assert.ok(P.geldigeStand(q))
  const q2 = P.ruil(q, 2, 'r7', 'hA'); assert.equal(q2.passen, 0, 'ruilen: de passen tellen opnieuw')
  q = P.doeStap(q, 2, { soort: 'pas' })
  assert.equal(q.passen, 0); assert.ok(q.laatste.nieuweTafel, 'iedereen paste: nieuwe tafel')
  assert.ok(q.tafel.every(k => !tafel0.includes(k)), '3 nieuwe tafelkaarten'); assert.deepEqual(q.stapel.slice(0, 3), tafel0, 'de oude onder de stapel')
  assert.ok(P.geldigeStand(q), 'nog steeds 32 kaarten'); assert.equal(q.aanZet, 1)
  // na kloppen telt passen als je laatste beurt
  q = P.klop(q, 1); q = P.pas(q, 2); assert.equal(q.fase, 'uitslag', 'passen na kloppen: de ronde is klaar')
  // met 4 spelers: pas na 4 keer passen een nieuwe tafel
  let m = P.nieuwSpel({ spelers: 4, rng: (() => { let x = 7; return () => (x = (x * 9301 + 49297) % 233280) / 233280 })() })
  if (m.fase === 'spel') {
    const t0 = m.tafel.slice()
    for (let i = 0; i < 3; i++) m = P.pas(m, m.aanZet)
    assert.deepEqual(m.tafel, t0); m = P.pas(m, m.aanZet); assert.ok(m.laatste.nieuweTafel); assert.ok(P.geldigeStand(m))
  }
  // de computer past als niets beter wordt
  const c = stand(['hA', 'hH', 'h9'], ['r7', 'r8', 'r9'], ['s7', 'k8', 'r10'])
  assert.deepEqual(P.computerStap(c, 1, 'normaal'), { soort: 'pas' })
  assert.equal(P.geldigeStand({ ...c, passen: 9 }), false)
}
console.log('PASS: passen; iedereen past = 3 nieuwe tafelkaarten')

// ── Het spel ──
const ui = lees('eenendertigen-ui.js')
assert.match(ui, /import \* as P from '\.\/eenendertigen\.js\?v=\d+'/)
assert.match(ui, /import \{ maakGroepSpel \} from '\.\/groepspel\.js\?v=\d+'/)
assert.match(ui, /maakKaartTafel\(inhoud/)
for (const t of ["naam: 'alles'", "naam: 'klop'", "naam: 'pas'", "soort: 'pas'", 'Iedereen paste: 3 nieuwe kaarten op tafel', "naam: 'uitleg'", 'deelAnimatie', 'anderSpeeltAnimatie', 'beurtKlok', 'tafel.tril', 'meldGeslagen', 'tafel.tegenstanders', "'kaartreactie'", 'Tegen hoeveel computers wil je spelen?'])
  assert.ok(ui.includes(t), 'het spel heeft: ' + t)
const sp = await import('../../studio-spellen.js')
assert.deepEqual(sp.studioSpel('eenendertigen')?.met, { vriend: true, computer: true, chatbalk: true, webcam: true })
assert.equal(sp.studioSpel('eenendertigen').spraak, 'vanzelf')
const hulp = lees('kaartspel-hulp.js')
for (const t of ['function tegenstanders(lijst)', 'function vanZetel(z)', "lijst['zetel:' + z.dataset.zetel]", '.kt-tz.kt-beurt']) assert.ok(hulp.includes(t), 'kaarttafel: ' + t)
console.log('PASS: het spel gebruikt groepspel en de kaarttafel met meer spelers')
