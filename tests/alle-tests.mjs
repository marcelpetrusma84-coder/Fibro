// alle-tests.mjs (3 nov 2026): draait alle Node-tests van Fibro achter elkaar (ook op GitHub, bij elke pull request).
// Elk bestand tests/**/*.mjs (niet tests/tools, tests/fixtures, tests/gen) met node, plus de proeven van de
// pushfunctie (tests/tools/proef46, proef50, proef229; die slaan zichzelf over zonder typescript).
// Uitslag per test; eindigt met fout (exit 1) als er een mislukt.   node tests/alle-tests.mjs
import { readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const tests = []
function zoek(map) {
  for (const naam of readdirSync(map).sort()) {
    const p = path.join(map, naam), rel = path.relative(REPO, p)
    if (statSync(p).isDirectory()) { if (!/^tests\/(tools|fixtures|gen)$/.test(rel)) zoek(p) }
    else if (naam.endsWith('.mjs') && rel !== 'tests/alle-tests.mjs') tests.push(rel)
  }
}
zoek(path.join(REPO, 'tests'))
for (const t of ['proef46', 'proef50', 'proef229']) tests.push('tests/tools/' + t + '.mjs')

let goed = 0
const mis = []
for (const t of tests) {
  const r = spawnSync(process.execPath, [t], { cwd: REPO, encoding: 'utf8', timeout: 180000 })
  if (r.status === 0) { goed++; console.log('OK    ' + t) }
  else {
    mis.push(t)
    console.log('FOUT  ' + t)
    const uit = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').filter(Boolean)
    for (const regel of uit.slice(-12)) console.log('        ' + regel)
  }
}
console.log('\n' + goed + ' van ' + tests.length + ' tests goed' + (mis.length ? '; mislukt: ' + mis.join(', ') : ''))
process.exit(mis.length ? 1 : 0)
