// Vriend worden vanuit een groepschat (18 nov 2026, Marcel): sql/vriendverzoek-groep.sql, groep.html, vrienden.html.
// Altijd: de belangrijkste controles staan in de SQL en de app gebruikt alleen de functies.
// Met een lokale PostgreSQL (VRIENDVERZOEK_PG="-h /tmp -p 5499 -U postgres"): de echte proef
// (vriendverzoek-groep-pg.sql + de SQL + vriendverzoek-groep-pg-proef.sql, 31 controles).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const sql = lees('sql/vriendverzoek-groep.sql')
assert.match(sql, /revoke all on public\.vriendverzoeken from public, anon, authenticated/, 'tabel dicht voor de app')
for (const f of ['vraag_vriend(uuid, uuid)', 'mijn_vriendverzoeken()', 'beantwoord_vriendverzoek(uuid, boolean)']) {
  assert.ok(sql.includes('revoke execute on function public.' + f + ' from public, anon;'), f + ': niet voor anon')
  assert.ok(sql.includes('grant execute on function public.' + f + ' to authenticated;'), f + ': wel ingelogd')
}
assert.match(sql, /revoke execute on function public\.maak_vrienden\(uuid, uuid\) from public, anon, authenticated/, 'maak_vrienden niet zelf')
assert.match(sql, /niet in dezelfde groep/, 'alleen binnen een groep')
assert.match(sql, /geen_blokkade\(ik, p_naar\)/, 'blokkade telt')
assert.match(sql, /interval '30 days'/, 'nee = 30 dagen rust'); assert.match(sql, /n >= 20/, 'hoogstens 20 per dag')
assert.match(sql, /where id = p_id and naar = ik and status = 'open'/, 'alleen je eigen verzoek beantwoorden')
const groep = lees('groep.html'), vrienden = lees('vrienden.html')
for (const rpc of ['vraag_vriend', 'mijn_vriendverzoeken', 'beantwoord_vriendverzoek']) assert.ok(groep.includes("rpc('" + rpc + "'"), 'groep.html: ' + rpc)
assert.ok(vrienden.includes("rpc('mijn_vriendverzoeken'") && vrienden.includes("rpc('beantwoord_vriendverzoek'"), 'vrienden.html: verzoeken')
assert.doesNotMatch(groep + vrienden, /from\('vriendverzoeken'\)/, 'de app komt niet zelf aan de tabel')
// 18 nov 2026: de pushmelding (sql/vriendverzoek-push.sql + stuur-push; de functie zelf: tests/tools/proef314.mjs)
const push = lees('sql/vriendverzoek-push.sql'), sp = lees('supabase/functions/stuur-push/index.ts')
assert.match(push, /after insert on public\.vriendverzoeken/, 'trigger bij een nieuw verzoek')
assert.match(push, /when \(new\.status = 'open'\)/, 'alleen open verzoeken')
assert.match(push, /jsonb_build_object\('vriendverzoek_id', new\.id\)/, 'alleen het id gaat mee')
assert.match(push, /exception when others then\n    null;/, 'een mislukte melding houdt het verzoek niet tegen')
assert.match(push, /revoke execute on function public\.vriendverzoek_push\(\) from public, anon, authenticated/)
assert.match(sp, /if \(invoer\.vriendverzoek_id\)/); assert.match(sp, /"groep", "vriendverzoek"\]\)/, 'alleen vanaf de server')
assert.match(sp, /vriendverzoek: "vriend"/, 'valt onder Vrienden in Pushmeldingen')
const pg = process.env.VRIENDVERZOEK_PG
if (pg) {
  const a = pg.split(' ')
  execFileSync('psql', [...a, '-q', '-c', 'drop database if exists vriendproef', '-c', 'create database vriendproef'])
  const uit = execFileSync('psql', [...a, '-d', 'vriendproef', '-q', '-v', 'ON_ERROR_STOP=1',
    '-f', 'tests/groep/vriendverzoek-groep-pg.sql', '-f', 'sql/vriendverzoek-groep.sql', '-f', 'tests/groep/vriendverzoek-groep-pg-proef.sql'],
    { cwd: new URL('../../', import.meta.url).pathname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  void uit
  console.log('vriendverzoek-groep: ok (met PostgreSQL)')
} else console.log('vriendverzoek-groep: ok')
