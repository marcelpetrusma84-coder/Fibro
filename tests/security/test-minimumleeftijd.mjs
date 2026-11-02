// v255 (2 nov 2026): Fibro is vanaf 16 jaar, ook in de database (sql/minimumleeftijd.sql).
// De webpagina's weigerden het al (v225); de database weigert nu ook wie om de pagina heen gaat.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

const sql = lees('sql/minimumleeftijd.sql')
assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m)
assert.match(sql, /create trigger fibro_leeftijd_controle\s+before insert on auth\.users\s+for each row execute function public\.controleer_leeftijd\(\);/)
assert.match(sql, /jaar_tekst !~ '\^\[0-9\]\{4\}\$'/, 'een geboortejaar van 4 cijfers is verplicht')
assert.match(sql, /extract\(year from now\(\)\)::int - jaar_tekst::int < 16/, 'jonger dan 16: geweigerd')
assert.match(sql, /revoke execute on function public\.controleer_leeftijd\(\) from public, anon, authenticated;/)

// beide aanmeldpagina's sturen het geboortejaar mee én controleren het zelf al
for (const f of ['login.html', 'invite.html']) {
  const bron = lees(f)
  assert.match(bron, /data: \{ username[^}]*geboortejaar: jaarNum/, f + ': geboortejaar gaat mee naar Supabase')
  assert.match(bron, /new Date\(\)\.getFullYear\(\) - jaarNum < 16/, f + ': de pagina weigert al onder de 16')
}
console.log('PASS: minimumleeftijd 16 in de database, en beide aanmeldpagina\'s sturen het geboortejaar mee.')
