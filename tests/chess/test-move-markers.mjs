// Een legale zet krijgt de juiste markering, zonder de paardroutes te bedekken.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../../schaken-ui.js', import.meta.url), 'utf8')
const begin = source.indexOf('        if (isMogelijkeZet && !paardRoutesUI?.active) {')
const einde = source.indexOf('\n        bordEl.appendChild(vakje)', begin)
assert.ok(begin >= 0 && einde > begin, 'Zetmarkeringen in de bordtekening gevonden')
const tekenMarkering = source.slice(begin, einde)

function teken({ mogelijk, bezet, routes = false }) {
  const children = []
  const vakje = { appendChild: kind => children.push(kind) }
  const context = {
    isMogelijkeZet: mogelijk, paardRoutesUI: { active: routes },
    staat: { bord: [[bezet ? 'bP' : null]] }, r: 0, k: 0,
    document: { createElement: () => ({ className: '' }) }, vakje
  }
  vm.runInNewContext(tekenMarkering, context)
  return children.map(child => child.className)
}

assert.deepEqual(teken({ mogelijk: true, bezet: false }), ['sch-legal-dot'], 'Leeg doel krijgt een groene stip')
assert.deepEqual(teken({ mogelijk: true, bezet: true }), ['sch-legal-capture'], 'Een slag krijgt een rode markering')
assert.deepEqual(teken({ mogelijk: false, bezet: false }), [], 'Ongeldige doelen krijgen geen markering')
assert.deepEqual(teken({ mogelijk: true, bezet: false, routes: true }), [], 'Paardroutes houden hun eigen aanduidingen')

for (const naam of ['sch-legal-dot', 'sch-legal-capture']) {
  const stijl = source.match(new RegExp(`\\.${naam} \\{([^}]+)\\}`))?.[1] || ''
  assert.match(stijl, /gradient\(/, `${naam} heeft een kleurverloop`)
  assert.match(stijl, /border:/, `${naam} heeft een rand`)
  assert.match(stijl, /box-shadow:/, `${naam} heeft schaduw en diepte`)
  assert.match(stijl, /pointer-events:none/, `${naam} blokkeert geen zetten`)
}
console.log('ok: legale zetten en slagmarkeringen met contrast en diepte')
