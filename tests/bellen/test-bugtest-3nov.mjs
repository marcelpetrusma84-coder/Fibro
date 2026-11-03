// Bugtest 3 nov 2026: wat de volledige test vond (zie ook tests/tools/proef228.py voor het spelgeluid met twee spelers).
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

// 1. geluid van de ander niet steeds opnieuw laden; AbortError is geen blokkade
{
  const b = lees('bellen.js')
  assert.match(b, /if \(audioEl\.srcObject !== stream\) audioEl\.srcObject = stream/)
  assert.match(b, /if \(e && e\.name === 'AbortError'\) return !audioEl\.paused\n    meldMediaFout\('geluid afspelen', e\)/)
  for (const f of ['chat.html', 'bellen.html', 'bel-luisteraar.js']) assert.match(lees(f), /bellen\.js\?v=162/, f)
}

// 2. vriendenlijst: een vriend zonder zichtbaar profiel (profiles: null) liet de hele lijst vastlopen
{
  const v = lees('vrienden.html')
  const blok = v.slice(v.indexOf('function isGebruikerOnline('), v.indexOf('return sec < 300'))
  const isOnline = new Function('navigator', 'localStorage', blok + 'return sec < 300 }\nreturn isGebruikerOnline')({ onLine: true }, { getItem: () => null })
  assert.equal(isOnline(null), false)
  assert.equal(isOnline(undefined), false)
  assert.equal(isOnline({ online_status: true, laatst_gezien: new Date().toISOString() }), true)
  assert.match(v, /laatsteTeken = \[userId, data, geblokkeerd, vanToestel\]\n.*\n    data = \(data \|\| \[\]\)\.filter\(f => f && f\.profiles\)/)
}

// 3. de gebruikerslijst niet meer zonder inloggen: invite.html via uitnodiger_van_invite, met terugval
{
  const i = lees('invite.html')
  assert.match(i, /supabase\.rpc\('uitnodiger_van_invite', \{ token_in: token \}\)/)
  assert.ok(i.indexOf("rpc('uitnodiger_van_invite'") < i.indexOf(".from('profielen_publiek')"), 'eerst de nieuwe functie')
  const sql = lees('sql/profielen-publiek-dicht.sql')
  assert.match(sql, /create or replace function public\.uitnodiger_van_invite\(token_in text\)/)
  assert.match(sql, /and t\.is_used = false\n    and \(t\.expires_at is null or t\.expires_at > now\(\)\)/)
  assert.match(sql, /revoke all on public\.profielen_publiek from anon, authenticated;/)
  assert.match(sql, /grant execute on function public\.uitnodiger_van_invite\(text\) to anon, authenticated;/)
  assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m)
}

// 4. cacheversies: hetzelfde bestand overal met dezelfde ?v= (anders twee kopieen, of een oude uit de kast)
{
  const bestanden = [...readdirSync(new URL('../../', import.meta.url))].filter(f => /\.(html|js)$/.test(f) && !/\.min\.js$|mediabunny|supabase-lib/.test(f))
  const versies = {}
  for (const f of bestanden) for (const m of lees(f).replace(/^\s*\/\/.*$/gm, '').matchAll(/["'(]\.?\/?([\w-]+\.(?:js|css))\?v=(\d+)/g)) (versies[m[1]] ||= new Set()).add(m[2])
  const dubbel = Object.entries(versies).filter(([, s]) => s.size > 1).map(([n, s]) => n + ': ' + [...s].join(', '))
  assert.deepEqual(dubbel, [], 'zelfde bestand met verschillende ?v=')
  assert.match(lees('schaken-drie-ui.js'), /import\('\.\/ice-config\.js\?v=149'\)/)
  assert.match(lees('schaak-worker.js'), /solo-bord\.js\?v=4/)
  assert.match(lees('solo.js'), /solo-bord\.js\?v=4/)
}
console.log('bugtest 3 nov: ok')
