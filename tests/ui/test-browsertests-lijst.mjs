// test-browsertests-lijst.mjs (27 nov 2026): de lijst met browsertests die op GitHub draaien (tests/tools/browsertests.txt)
// klopt: elke regel heeft een bestaande proef, niemand staat er twee keer in, en elke nieuwe browsertest (proef228 en
// later) staat erin. Zo kan een nieuwe proef niet per ongeluk buiten de controles vallen.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tools')
const NIET_IN_CI = new Set(['proef230'])   // een meting (hoe snel laadt Stekky op een trage telefoon), geen test
const regels = readFileSync(path.join(TOOLS, 'browsertests.txt'), 'utf8').split('\n').map(r => r.trim()).filter(r => r && !r.startsWith('#'))
const namen = []
for (const r of regels) {
  const [proef, duur, naam] = r.split('|').map(d => d.trim())
  assert.match(proef, /^proef\d+$/, 'regel klopt niet: ' + r)
  assert.match(duur, /^\d+$/, 'geen seconden: ' + r)
  assert.ok(naam && naam.length > 3, 'geen naam: ' + r)
  assert.ok(existsSync(path.join(TOOLS, proef + '.py')), 'bestaat niet: ' + proef)
  namen.push(proef)
}
assert.equal(new Set(namen).size, namen.length, 'een proef staat er twee keer in')
const ontbreekt = readdirSync(TOOLS).map(f => /^(proef(\d+))\.py$/.exec(f)).filter(m => m && Number(m[2]) >= 228 && !NIET_IN_CI.has(m[1]) && !namen.includes(m[1])).map(m => m[1])
assert.deepEqual(ontbreekt, [], 'Zet deze browsertests in tests/tools/browsertests.txt: ' + ontbreekt.join(', '))
console.log('test-browsertests-lijst: ' + namen.length + ' browsertests, allemaal in de lijst')
