// test-vernieuwen.mjs (v265): de Vernieuwen-knoppen op moderatie.html laten zien dat ze bezig zijn en wanneer ze klaar waren
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const mod = readFileSync(new URL('../../moderatie.html', import.meta.url), 'utf8')
assert.equal((mod.match(/onclick="vernieuw\(this, laad(Fouten|Feedback|Beta)/g) || []).length, 3, 'alle drie de knoppen')
for (const t of ["'Laden…': 'Loading…'", "'Bijgewerkt om {tijd}': 'Updated at {tijd}'", "'Bijgewerkt om {tijd} · {n} meldingen'"]) assert.ok(mod.includes(t), t)

const bron = mod.slice(mod.indexOf('window.vernieuw = async function'), mod.indexOf('\n}', mod.indexOf('window.vernieuw = async function')) + 2)
const ouder = { kind: null, querySelector: () => ouder.kind }
const knop = { textContent: '↻ Vernieuwen', disabled: false, parentNode: ouder, after: el => { ouder.kind = el } }
let tijdensLaden = null
const ctx = {
  window: {}, console, Date,
  T: Object.assign((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v && k in v ? v[k] : m), { taal: 'nl' }),
  document: { createElement: () => ({ style: {}, className: '', textContent: '' }) },
  foutGroepen: [{ ids: [1, 2] }, { ids: [3] }], alleFeedback: [],
}
vm.runInNewContext(bron, ctx)
await ctx.window.vernieuw(knop, async () => { tijdensLaden = { tekst: knop.textContent, uit: knop.disabled } }, 'fouten')
assert.deepEqual(tijdensLaden, { tekst: 'Laden…', uit: true }, 'tijdens het laden: Laden… en niet nog een keer te drukken')
assert.equal(knop.textContent, '↻ Vernieuwen'); assert.equal(knop.disabled, false)
assert.match(ouder.kind.textContent, /^Bijgewerkt om \d\d:\d\d · 3 meldingen$/)
await ctx.window.vernieuw(knop, async () => { throw new Error('mis') })
assert.equal(knop.disabled, false, 'ook na een fout weer te gebruiken')
assert.match(ouder.kind.textContent, /^Bijgewerkt om \d\d:\d\d$/)
console.log('PASS: Vernieuwen laat zien dat hij bezig is en wanneer hij klaar was')
