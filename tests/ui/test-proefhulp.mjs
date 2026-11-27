// test-proefhulp.mjs (27 nov 2026): tests/tools/proefhulp.py (de gedeelde opzet voor browsertests) blijft compleet,
// staat beschreven in BOUWSTENEN.md, en elke proef die hem gebruikt kan hem ook vinden. De proeven draaien met
// python3 -I; dan zoekt Python niet in de eigen map, dus zonder de sys.path-regel faalt `from proefhulp import *`.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TOOLS = path.join(REPO, 'tests/tools')
const hulp = readFileSync(path.join(TOOLS, 'proefhulp.py'), 'utf8')
const NAMEN = ['MAP', 'BASIS', 'check', 'klaar', 'fouten', 'wacht', 'browser', 'context', 'nep_supabase', 'sessie',
  'inloggen', 'nieuwe_pagina', 'lege_spelpagina', 'KANAAL', 'start_spel', 'RUST', 'HAND', 'dubbeltik']
for (const n of NAMEN) {
  assert.ok(new RegExp('^(def ' + n + '\\(|' + n + '\\b[^\\n]*=)', 'm').test(hulp), 'proefhulp.py mist ' + n)
  assert.ok(hulp.split('\n').slice(0, 30).some(r => r.startsWith('#') && r.includes(n)), 'de uitleg bovenaan proefhulp.py noemt ' + n + ' niet')
}
assert.ok(!/time\.sleep/.test(hulp), 'proefhulp.py: gebruik pg.wait_for_timeout, geen time.sleep')

const bouw = readFileSync(path.join(REPO, 'BOUWSTENEN.md'), 'utf8')
assert.ok(bouw.includes('`tests/tools/proefhulp.py`'), 'proefhulp.py staat niet in BOUWSTENEN.md')

const gebruikers = []
for (const f of readdirSync(TOOLS).filter(f => /^proef\d+\.py$/.test(f))) {
  const t = readFileSync(path.join(TOOLS, f), 'utf8')
  if (!/^\s*from proefhulp import/m.test(t)) continue
  gebruikers.push(f)
  const imp = t.indexOf('from proefhulp import'), pad = t.indexOf('sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))')
  assert.ok(pad >= 0 && pad < imp, f + ': zet eerst `import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))`')
  assert.ok(/^klaar\(/m.test(t), f + ': eindig met klaar()')
  assert.ok(!/^\s*klaar\s*=/m.test(t), f + ': gebruik de naam klaar niet voor iets anders')
}
assert.ok(gebruikers.includes('proef353.py') && gebruikers.includes('proef356.py'), 'proef353 en proef356 gebruiken proefhulp.py')
console.log('test-proefhulp: ' + NAMEN.length + ' hulpjes, ' + gebruikers.length + ' proeven gebruiken ze')
