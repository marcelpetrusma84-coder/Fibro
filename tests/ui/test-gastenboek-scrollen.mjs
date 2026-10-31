// v2 van gastenboekstijl.js (31 okt 2026): met het muiswiel over het gastenboek scrollen.
// Met overscroll-behavior:contain op de berichtenlijst scrolde de pagina in Chrome niet meer zodra de muis boven het
// gastenboek stond, ook als er in de lijst niets te scrollen viel. In een echte browser nagemeten: nu scrolt eerst de
// lijst (als een bladzijde te vol is) en daarna de pagina, en anders meteen de pagina.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const gb = lees('gastenboekstijl.js')

const lijst = gb.match(/<div id="\$\{lijstId\}" class="gb-blad" style="([^"]*)"/)
assert.ok(lijst, 'de berichtenlijst staat in binnenHtml')
assert.ok(!/overscroll-behavior/.test(lijst[1]), 'de lijst houdt het scrollen niet vast (geen overscroll-behavior)')
assert.match(lijst[1], /overflow-y:auto/, 'een te volle bladzijde kun je nog steeds scrollen')
assert.ok(!/addEventListener\('wheel'/.test(gb + lees('index.html') + lees('vriend-profiel.html').replace(/[\s\S]*?(?=renderGastenboek|$)/, '')), 'niets vangt het muiswiel af')

for (const f of ['index.html', 'vriend-profiel.html']) {
  const v = [...lees(f).matchAll(/gastenboekstijl\.js\?v=(\d+)/g)].map(m => Number(m[1]))
  assert.ok(v.length === 1 && v[0] >= 2, f + ' laadt gastenboekstijl.js v2 of nieuwer')
}
console.log('ok: met de muis over het gastenboek scrollen')
