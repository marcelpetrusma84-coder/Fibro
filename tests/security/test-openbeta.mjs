// v255 (2 nov 2026): klaar voor de open bèta: grens aan uitnodigingen, contact en Lichess op de Over-pagina.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

// 1. Hoogstens 5 nieuwe mensen per uitnodiger per week (in de database), moderators onbeperkt
const sql = lees('sql/uitnodigingen-grens.sql')
assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m)
assert.match(sql, /raise exception 'STOP: voer eerst sql\/registratie-schakelaar\.sql uit/)
assert.match(sql, /grens constant int := 5;/)
assert.match(sql, /u\.created_at > now\(\) - interval '7 days'/)
assert.match(sql, /and u\.created_at >= i\.created_at/, 'alleen NIEUWE accounts tellen, geen bestaande vrienden')
assert.match(sql, /if not coalesce\(\(select is_moderator from profiles where id = maker\), false\)\s+and public\.nieuw_via_uitnodiger\(maker\) >= grens then\s+raise exception 'FIBRO_UITNODIGINGEN_OP';/)
assert.match(sql, /revoke execute on function public\.nieuw_via_uitnodiger\(uuid\) from public, anon, authenticated;/)
assert.match(sql, /grant execute on function public\.uitnodiging_vol\(text\) to anon, authenticated;/)
// de rest van de controle is gelijk aan registratie-schakelaar.sql
for (const stuk of ["raise exception 'FIBRO_REGISTRATIE_ALLEEN_UITNODIGING';", "raise exception 'FIBRO_REGISTRATIE_DICHT';", 'and i.is_used = false', 'and not public.is_geblokkeerd(i.created_by)'])
  assert.ok(sql.includes(stuk), stuk)

// 2. invite.html legt het uit (meteen bij openen en na een weigering), in twee talen
const invite = lees('invite.html')
const tekst = 'Wie jou uitnodigde, heeft deze week al 5 nieuwe mensen op Fibro gebracht. Dat is het maximum. Probeer het over een paar dagen opnieuw.'
assert.equal(invite.split("supabase.rpc('uitnodiging_vol', { token_in: token })").length - 1, 2)
assert.ok(invite.includes("'" + tekst + "': 'The person who invited you"), 'Engels')
assert.equal(invite.split("registratieGeweigerd('" + tekst + "')").length - 1, 2, 'Nederlandse sleutel (registratieGeweigerd vertaalt zelf)')

// 3. Over Fibro: contact (verantwoordelijke en e-mailadres) en Lichess; spelregels: contact voor wie niet kan inloggen
const over = lees('over.html'), regels = lees('spelregels.html')
assert.match(over, /<div class="blok" id="contact">\s*<h2 data-t>Contact<\/h2>/)
assert.match(over, /Fibro is gemaakt door Marcel\. Hij is verantwoordelijk voor wat Fibro met je gegevens doet\./)
assert.ok(over.split('mailto:fibro.contact@proton.me').length >= 3, 'mailadres in de pagina en in de vertaling')
assert.match(over, /<li data-t>Speel je schaken op het niveau Ultra, dan vraagt je toestel bij Lichess/)
assert.ok(regels.split('mailto:fibro.contact@proton.me').length >= 3)
assert.match(regels, /Laatst bijgewerkt: 2 november 2026/)
assert.match(lees('supabase/functions/stuur-push/index.ts'), /mailto:fibro\.contact@proton\.me/)
console.log('PASS: open bèta: grens van 5 nieuwe mensen per week, uitleg bij de uitnodiging, contact en Lichess op Over Fibro.')
