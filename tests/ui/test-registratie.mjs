// registratie.js + de registratie-schakelaar (v226): open / alleen met uitnodiging / dicht, de bètamelding bij het
// aanmelden, het tabblad Bèta op de moderatiepagina en sql/registratie-schakelaar.sql.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const code = lees('registratie.js')
const login = lees('login.html'), invite = lees('invite.html'), moderatie = lees('moderatie.html')
const sql = lees('sql/registratie-schakelaar.sql')

function laad() {
  const ctx = vm.createContext({ window: {} })
  vm.runInContext(code, ctx)
  return ctx.window.FibroRegistratie
}
const R = laad()

// 1. Welke uitleg komt er in plaats van het formulier?
assert.equal(R.melding('open', false), null, 'open: formulier gewoon')
assert.equal(R.melding('open', true), null)
assert.equal(R.melding('uitnodiging', true), null, 'met een uitnodiging mag het bij "alleen met uitnodiging"')
assert.equal(R.melding('uitnodiging', false), R.TEKST.uitnodiging, 'login.html heeft geen uitnodiging')
assert.equal(R.melding('dicht', true), R.TEKST.dicht, 'dicht: ook niet met een uitnodiging')
assert.equal(R.melding('dicht', false), R.TEKST.dicht)
assert.equal(R.melding('kapot', false), null, 'onbekende stand telt als open (oude database)')
assert.equal(R.geldigeStand(undefined), 'open')

// 2. Na een weigering door de database
assert.equal(R.weigerTekst('uitnodiging', true), R.VERLOPEN, 'uitnodiging verlopen terwijl je het formulier invulde')
assert.equal(R.weigerTekst('uitnodiging', false), R.TEKST.uitnodiging)
assert.equal(R.weigerTekst('dicht', true), R.TEKST.dicht)
assert.equal(R.weigerTekst('open', false), R.ONBEKEND)
assert.equal(R.isGeweigerd({ message: 'Database error saving new user' }), true)
assert.equal(R.isGeweigerd({ message: 'FIBRO_REGISTRATIE_DICHT' }), true)
assert.equal(R.isGeweigerd({ message: 'User already registered' }), false, 'een bestaande naam is iets anders')
assert.equal(R.isGeweigerd(null), false)

// 3. De stand ophalen: zonder SQL (fout) of bij een rare waarde gewoon 'open'
{
  const nep = antwoord => ({ rpc: async naam => { assert.equal(naam, 'registratie_stand'); if (antwoord instanceof Error) throw antwoord; return antwoord } })
  assert.equal(await R.haalStand(nep({ data: 'dicht' })), 'dicht')
  assert.equal(await R.haalStand(nep({ data: 'uitnodiging' })), 'uitnodiging')
  assert.equal(await R.haalStand(nep({ data: null, error: { message: 'function does not exist' } })), 'open')
  assert.equal(await R.haalStand(nep({ data: '<script>' })), 'open')
  assert.equal(await R.haalStand(nep(new Error('geen internet'))), 'open')
}

// 4. De pagina's: script geladen, bètamelding, uitleg vertaald, uitnodiging mee bij het aanmelden
const BETA = '🧪 Fibro is nog in de bètafase: er kan nog iets misgaan. Zet na het aanmelden herstel aan (Face ID, vingerafdruk of je herstelsleutel). Zonder herstel kun je je berichten op een nieuw toestel niet meer lezen.'
for (const [naam, html] of [['login.html', login], ['invite.html', invite]]) {
  assert.match(html, /<script src="registratie\.js\?v=1"><\/script>/, naam + ': registratie.js geladen')
  assert.ok(html.includes('data-t>' + BETA + '</div>'), naam + ': bètamelding bij het formulier')
  for (const zin of [BETA, R.TEKST.uitnodiging, R.TEKST.dicht, R.ONBEKEND, R.VERLOPEN]) {
    assert.ok(html.includes("'" + zin + "':"), naam + ': Engelse vertaling van: ' + zin.slice(0, 40))
  }
}
assert.match(invite, /options: \{ data: \{ username: naam, geboortejaar: jaarNum, niveau, invite_token: token \} \}/, 'invite.html geeft de uitnodiging mee')
assert.doesNotMatch(login, /invite_token/, 'login.html heeft geen uitnodiging')
assert.match(login, /FibroRegistratie\.melding\(stand, false\)/)
assert.match(invite, /FibroRegistratie\.melding\(await FibroRegistratie\.haalStand\(supabase\), true\)/)
assert.match(invite, /<div id="regFormulier">[\s\S]*id="regBtn"[\s\S]*?<\/div>/, 'het formulier staat in regFormulier')

// 5. Moderatie: tabblad Bèta, alle zichtbare teksten in het Engels
assert.match(moderatie, /id="tabBeta" onclick="kiesTab\('beta'\)"/)
assert.match(moderatie, /id="deelBeta"/)
assert.match(moderatie, /laadFeedback\(\), laadBeta\(\)\]\)/, 'het overzicht laadt bij het openen')
assert.match(moderatie, /supabase\.rpc\('zet_registratie_stand', \{ stand_in: stand \}\)/)
assert.match(moderatie, /\$\{mEsc\(van\)\} → \$\{mEsc\(naar\)\}/, 'namen van gebruikers altijd ontsnapt')
{
  const deel = moderatie.slice(moderatie.indexOf('// ─── Bèta'), moderatie.indexOf('// ─── Feedback van testers'))
  const zinnen = new Set([...deel.matchAll(/T\('([^']+)'/g)].map(m => m[1]))
  for (const z of ['Iedereen kan een account maken.', 'Alleen wie een uitnodiging van een Fibro-gebruiker heeft, kan een account maken.', 'Niemand kan een account maken. Inloggen werkt gewoon.', 'Open', 'Alleen met uitnodiging', 'Dicht']) zinnen.add(z)
  assert.ok(zinnen.size >= 15, 'teksten gevonden')
  for (const z of zinnen) assert.ok(moderatie.includes("'" + z + "':"), 'moderatie: Engelse vertaling van: ' + z)
}

// 5b. Bèta-cijfers (v227): ook de vaste teksten van het tabblad in het Engels, en de eerlijke zin op Over Fibro
{
  const blok = moderatie.slice(moderatie.indexOf('<div id="deelBeta"'), moderatie.indexOf('<div class="venster-achter"'))
  const vast = [...blok.matchAll(/data-t[^>]*>([^<]+)</g)].map(m => m[1].trim()).filter(Boolean)
  assert.ok(vast.length >= 20, 'vaste teksten gevonden')
  for (const z of vast) assert.ok(moderatie.includes("'" + z + "':"), 'moderatie: Engelse vertaling van: ' + z)
  for (const id of ['actief24', 'actief7', 'actief30', 'betaActiefPerDag', 'terugDag', 'terugWeek', 'betaLeeftijd']) assert.ok(blok.includes('id="' + id + '"'), id)
  const over = lees('over.html')
  const zin = 'Voor de bèta ziet de moderator alleen totalen'
  assert.ok(over.includes('<li data-t>' + zin), 'Over Fibro: eerlijk over de bèta-cijfers')
  assert.ok(over.includes("{ '" + zin), 'Over Fibro: ook in het Engels')
  const terug = new Function('T', moderatie.match(/function terugTekst\(t\) \{[\s\S]*?\n\}/)[0] + '; return terugTekst')(
    (k, v) => k.replace(/\{(\w+)\}/g, (_, n) => v[n]))
  assert.equal(terug({ van: 4, terug: 3 }), '3 van 4 (75%)')
  assert.equal(terug({ van: 0, terug: 0 }), 'nog te vroeg')
  assert.equal(terug(null), 'nog te vroeg')
}

// 6. De SQL: alles of niets, de controle in de database, de juiste rechten
assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m)
assert.match(sql, /create trigger fibro_registratie_controle\s+before insert on auth\.users/)
assert.match(sql, /check \(stand in \('open', 'uitnodiging', 'dicht'\)\)/)
assert.match(sql, /insert into public\.registratie_instelling \(id, stand\) values \(1, 'open'\) on conflict \(id\) do nothing/, 'beginstand open, en een tweede keer uitvoeren verandert de stand niet')
assert.match(sql, /grant execute on function public\.registratie_stand\(\) to anon, authenticated/)
assert.match(sql, /revoke execute on function public\.zet_registratie_stand\(text\) from public, anon;/)
assert.match(sql, /revoke all on public\.registratie_instelling from public, anon, authenticated/)
for (const f of ['zet_registratie_stand', 'beta_overzicht']) {
  const lijf = sql.slice(sql.indexOf('function public.' + f + '('), sql.indexOf('$$;', sql.indexOf('function public.' + f + '(')))
  assert.match(lijf, /if not public\.ben_ik_moderator\(\) then\s+raise exception/, f + ': alleen moderators')
}
{
  const poort = sql.slice(sql.indexOf('function public.controleer_nieuw_account()'), sql.indexOf('drop trigger'))
  assert.match(poort, /new\.raw_user_meta_data ->> 'invite_token'/)
  assert.match(poort, /i\.is_used = false/)
  assert.match(poort, /i\.expires_at is null or i\.expires_at > now\(\)/)
  assert.match(poort, /not public\.is_geblokkeerd\(i\.created_by\)/, 'een uitnodiging van een geblokkeerd account telt niet')
  assert.doesNotMatch(poort, /update invite_tokens/, 'de poortwachter boekt de uitnodiging niet af')
}

{
  // v227: tellen per dag, alleen een datum en een getal
  assert.match(sql, /create table if not exists public\.actief_per_dag \(\s+dag date primary key,\s+aantal integer/)
  assert.doesNotMatch(sql.slice(sql.indexOf('create table if not exists public.actief_per_dag'), sql.indexOf('alter table public.actief_per_dag')), /user|uuid|_id/, 'geen personen in actief_per_dag')
  assert.match(sql, /revoke all on public\.actief_per_dag from public, anon, authenticated/)
  assert.match(sql, /after update of laatst_gezien on public\.profiles/)
  assert.match(sql, /nu_gezien < now\(\) - interval '10 minutes' or nu_gezien > now\(\) \+ interval '10 minutes'/, 'geen zelf ingevulde datums')
  const lijf = sql.slice(sql.indexOf('function public.beta_overzicht('))
  for (const k of ['actief_24u', 'actief_7d', 'actief_30d', 'actief_per_dag', 'terug_dag', 'terug_week', 'leeftijd']) assert.ok(lijf.includes("'" + k + "'"), 'beta_overzicht: ' + k)
  assert.equal((lijf.match(/coalesce\(p\.toon_online, true\)/g) || []).length, 5, 'wie helemaal offline staat, telt nergens mee')
}

console.log('test-registratie: alles goed')
