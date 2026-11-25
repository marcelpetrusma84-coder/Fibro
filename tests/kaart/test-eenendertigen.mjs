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

// ── De computerspeler over het kanaal (bot) ──
const gestuurd = []
const bot = P.bot({ stuur: (e, p) => gestuurd.push([e, p]), niveau: 'normaal', isDicht: () => false })
let st = P.ruil(stand(['h7', 's8', 'k9'], ['r7', 'r8', 'r9'], ['hA', 'hH', 'sA']), 1, 's8', 'hA')
bot.ontvang('zet', { staat: st, nr: 1, spelId: 4 })
await new Promise(k => setTimeout(k, 4500))   // eerste zet na het delen: even wachten (de kaarten worden gedeeld)
assert.equal(gestuurd[0]?.[0], 'zet', 'de computer zet'); assert.equal(gestuurd[0][1].nr, 2); assert.equal(gestuurd[0][1].staat.aanZet, 1)
assert.ok(P.geldigeStand(gestuurd[0][1].staat))
bot.ontvang('vraag-stand', { spelId: 4, nr: 1 }); assert.equal(gestuurd.at(-1)[0], 'stand')
bot.stop()
console.log('PASS: de computerspeler speelt mee over het kanaal')

// ── Het spel ──
const ui = lees('eenendertigen-ui.js')
assert.match(ui, /import \* as P from '\.\/eenendertigen\.js\?v=\d+'/)
assert.match(ui, /maakKaartTafel\(inhoud/)
for (const t of ["naam: 'alles'", "naam: 'klop'", "naam: 'uitleg'", 'deelAnimatie', 'anderSpeeltAnimatie', 'beurtKlok', 'tafel.tril', 'meldGeslagen', "stuur('vraag-stand'", "'kaartreactie'"])
  assert.ok(ui.includes(t), 'het spel heeft: ' + t)
assert.match(ui, /if \(ik === 1\) volgendeTimer = setTimeout/, 'speler 1 deelt de volgende ronde')
const sp = await import('../../studio-spellen.js')
assert.deepEqual(sp.studioSpel('eenendertigen')?.met, { vriend: true, computer: true, chatbalk: true, webcam: true })
assert.equal(sp.studioSpel('eenendertigen').spraak, 'vanzelf')
console.log('PASS: het spel gebruikt de kaarttafel en staat in studio-spellen.js')
