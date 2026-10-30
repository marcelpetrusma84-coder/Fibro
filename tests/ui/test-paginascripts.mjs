// Elk gewoon <script>-blok in de html-pagina's moet geldige JavaScript zijn (v230).
// Aanleiding: in v229 stond in een Engelse vertaling op Over Fibro een " te veel, waardoor dat hele blok niet liep.
// Modules (<script type="module">) controleert node --check niet zonder bestand; die slaan we hier over.
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const map = new URL('../../', import.meta.url)
const paginas = readdirSync(map).filter(f => f.endsWith('.html'))
assert.ok(paginas.length >= 12, 'pagina’s gevonden')

let aantal = 0
for (const p of paginas) {
  const html = readFileSync(new URL(p, map), 'utf8')
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    aantal++
    try { new vm.Script(m[1], { filename: p }) } catch (e) {
      assert.fail(p + ': script klopt niet (' + e.message + '):\n' + m[1].slice(0, 200))
    }
  }
}
assert.ok(aantal > 20, 'scripts gevonden')
console.log('test-paginascripts: alles goed (' + aantal + ' scripts in ' + paginas.length + ' pagina’s)')
