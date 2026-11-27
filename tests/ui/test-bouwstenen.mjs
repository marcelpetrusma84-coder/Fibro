// test-bouwstenen.mjs (27 nov 2026, Marcel): het pakhuis (BOUWSTENEN.md) blijft bij.
//  - elk script in de hoofdmap (*.js), elk SQL-bestand (sql/*.sql), elke edge function (supabase/functions/*) en elk
//    installeerscript (tests/tools/studio-*-installeer.mjs) staat erin (als bouwsteen of bij "Alleen voor één onderdeel");
//  - alles wat erin genoemd wordt (`naam.js`, `sql/...`, `tests/...`), bestaat ook echt.
// Iets nieuws gebouwd? Zet het in BOUWSTENEN.md, anders wordt deze test rood.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tekst = readFileSync(path.join(REPO, 'BOUWSTENEN.md'), 'utf8')
const genoemd = new Set([...tekst.matchAll(/`([^`\s]+)`/g)].map(m => m[1]))
const staatErin = naam => genoemd.has(naam) || tekst.includes('`' + naam + '`')

const mis = []
for (const f of readdirSync(REPO).filter(f => f.endsWith('.js')).sort()) if (!staatErin(f)) mis.push(f)
for (const f of readdirSync(path.join(REPO, 'sql')).filter(f => f.endsWith('.sql')).sort())
  if (!staatErin(f) && !staatErin('sql/' + f)) mis.push('sql/' + f)
for (const f of readdirSync(path.join(REPO, 'supabase/functions')).filter(f => statSync(path.join(REPO, 'supabase/functions', f)).isDirectory()))
  if (!staatErin(f) && !staatErin('supabase/functions/' + f)) mis.push('supabase/functions/' + f)
for (const f of readdirSync(path.join(REPO, 'tests/tools')).filter(f => /^studio-.*installeer\.mjs$/.test(f)))
  if (!staatErin('tests/tools/' + f)) mis.push('tests/tools/' + f)
assert.deepEqual(mis, [], 'Deze staan nog niet in BOUWSTENEN.md: ' + mis.join(', '))

// alles wat genoemd wordt, bestaat
const weg = []
for (const n of genoemd) {
  let p = null
  if (/^[\w.-]+\.(js|html)$/.test(n)) p = n
  else if (/^(sql|tests|supabase|docs)\/[\w./*-]+$/.test(n) && !n.includes('*')) p = n
  else if (/^[\w-]+\.sql$/.test(n)) p = 'sql/' + n
  else if (/^proef\d+\.(mjs|py)$/.test(n)) p = 'tests/tools/' + n
  if (p && !existsSync(path.join(REPO, p))) weg.push(n)
}
for (const m of tekst.matchAll(/\]\(([\w./-]+\.md)\)/g)) if (!existsSync(path.join(REPO, m[1]))) weg.push(m[1])
assert.deepEqual(weg, [], 'BOUWSTENEN.md noemt bestanden die niet (meer) bestaan: ' + weg.join(', '))
console.log('test-bouwstenen: alles staat in het pakhuis (' + genoemd.size + ' namen)')
