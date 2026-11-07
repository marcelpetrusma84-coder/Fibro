// Bugtest 3 nov 2026: wat de volledige test vond (zie ook tests/tools/proef228.py voor het spelgeluid met twee spelers).
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

// 1. geluid van de ander niet steeds opnieuw laden; AbortError is geen blokkade
{
  const b = lees('bellen.js')
  assert.match(b, /if \(audioEl\.srcObject !== stream\) audioEl\.srcObject = stream/)
  assert.match(b, /if \(e && e\.name === 'AbortError'\) return !audioEl\.paused\n    meldMediaFout\('geluid afspelen', e\)/)
  for (const f of ['chat.html', 'bellen.html', 'bel-luisteraar.js']) assert.match(lees(f), /bellen\.js\?v=16[2-9]/, f)
}

// 2. vriendenlijst: een vriend zonder zichtbaar profiel (profiles: null) liet de hele lijst vastlopen
{
  const v = lees('vrienden.html')
  // v274: de regel zelf staat nu in onlinestip.js (isVriendOnline, eigen test test-online-bolletje.mjs)
  const eind = '(onlinestip.js)\n  }'
  const blok = v.slice(v.indexOf('function isGebruikerOnline('), v.indexOf(eind) + eind.length)
  const isOnline = new Function('navigator', 'localStorage', 'isVriendOnline', blok + '\nreturn isGebruikerOnline')({ onLine: true }, { getItem: () => null }, (id, p) => !!(p && p.online_status))
  assert.equal(isOnline(null), false)
  assert.equal(isOnline(undefined), false)
  assert.equal(isOnline({ online_status: true, laatst_gezien: new Date().toISOString() }), true)
  assert.match(v, /laatsteTeken = \[userId, data, geblokkeerd, vanToestel\]\n.*\n    data = \(data \|\| \[\]\)\.filter\(f => f && f\.profiles\)/)
}

// 3. de gebruikerslijst niet meer zonder inloggen: invite.html via uitnodiger_van_invite, met terugval
{
  const i = lees('invite.html')
  assert.match(i, /supabase\.rpc\('uitnodiger_van_invite', \{ token_in: token \}\)/)
  assert.doesNotMatch(i, /\.from\('profielen_publiek'\)/, 'de view is dicht en wordt niet meer gebruikt')
  const sql = lees('sql/profielen-publiek-dicht.sql')
  assert.match(sql, /create or replace function public\.uitnodiger_van_invite\(token_in text\)/)
  assert.match(sql, /and t\.is_used = false\n    and \(t\.expires_at is null or t\.expires_at > now\(\)\)/)
  assert.match(sql, /revoke all on public\.profielen_publiek from anon, authenticated;/)
  assert.match(sql, /grant execute on function public\.uitnodiger_van_invite\(text\) to anon, authenticated;/)
  assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m)
  const f = lees('sql/functies-afgeschermd.sql')
  assert.match(f, /revoke execute on function public\.handle_new_user\(\) from public, anon, authenticated;/)
  for (const fn of ['handle_new_user', 'delete_expired_messages', 'berichten_bewaren_start']) assert.match(f, new RegExp('alter function public\\.' + fn + "\\(\\) set search_path = '';"))
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
