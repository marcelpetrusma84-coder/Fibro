// test-leeftijd.mjs (28 nov 2026): het casino is alleen voor 18+ (leeftijd.js, casino.js, widgets.js en
// sql/casino-volwassen.sql), en de wachtspelletjes staan op de goede plekken (wachtspellen.js).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const L = await import(new URL('../../leeftijd.js', import.meta.url))
const UID = '11111111-1111-4111-8111-111111111111'
// een nagemaakte localStorage met een inlog (zoals supabase-js hem bewaart)
function opslag(jaar) {
  const m = new Map()
  if (jaar !== undefined) m.set('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify({ user: { id: UID, user_metadata: jaar === null ? {} : { geboortejaar: jaar } } }))
  m.set('iets_anders', 'x')
  return { get length() { return m.size }, key: i => [...m.keys()][i] ?? null, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }
}
const NU = () => Date.UTC(2026, 10, 28)

// ── leeftijd.js ──
assert.equal(L.VOLWASSEN, 18)
assert.equal(L.isVolwassenJaar(2008, 2026), true, '2026 - 2008 = 18')
assert.equal(L.isVolwassenJaar(2009, 2026), false)
assert.equal(L.isVolwassenJaar(1980, 2026), true)
assert.equal(L.isVolwassenJaar(null, 2026), false)
assert.equal(L.geboortejaar({ storage: opslag(1990) }), 1990)
assert.equal(L.geboortejaar({ storage: opslag('2001') }), 2001, 'ook als tekst')
assert.equal(L.geboortejaar({ storage: opslag(null) }), null)
assert.equal(L.geboortejaar({ storage: opslag() }), null)
assert.equal(L.benIkVolwassen({ storage: opslag(1990), nu: NU }), true)
assert.equal(L.benIkVolwassen({ storage: opslag(2009), nu: NU }), false)
assert.equal(L.benIkVolwassen({ storage: opslag(), nu: NU }), null, 'niet ingelogd = onbekend')

// casinoMagHier: eerst zelf 18+, dan de server (alleen ja of nee)
let gevraagd = null
const sb = antwoord => ({ rpc: async (naam, a) => { gevraagd = { naam, a }; return antwoord } })
const V = '22222222-2222-4222-8222-222222222222'
assert.equal(await L.casinoMagHier({ supabase: sb({ data: true, error: null }), vriend: V, storage: opslag(1990) }), true)
assert.deepEqual(gevraagd, { naam: 'casino_mag_hier', a: { p_vriend: V, p_groep: null } })
assert.equal(await L.casinoMagHier({ supabase: sb({ data: false, error: null }), groep: V, storage: opslag(1990) }), false, 'iemand in de groep is onder de 18')
assert.equal(await L.casinoMagHier({ supabase: sb({ data: null, error: { message: 'x' } }), vriend: V, storage: opslag(1990) }), false, 'fout = zonder tokens')
gevraagd = null
assert.equal(await L.casinoMagHier({ supabase: sb({ data: true, error: null }), vriend: V, storage: opslag(2010) }), false, 'zelf onder de 18')
assert.equal(gevraagd, null, 'dan wordt de server niet eens gevraagd')
assert.equal(await L.casinoMagHier({ supabase: sb({ data: true, error: null }), vriend: 'raar', storage: opslag(1990) }), false)
console.log('PASS: leeftijd.js')

// ── casino.js: onder de 18 geen overzicht en geen inzet ──
const C = await import(new URL('../../casino.js', import.meta.url))
assert.ok(C.CASINO_SPELLEN.includes('hogerlager') && C.CASINO_SPELLEN.includes('fruitautomaat'))
const server = { auth: { getSession: async () => ({ data: { session: { user: { id: UID } } } }) },
  rpc: async naam => naam === 'casino_overzicht' ? { data: { saldo: 250, vrienden: [], laatste: [] }, error: null } : { data: { saldo: 240 }, error: null } }
const jong = C.maakCasino({ supabase: server, spel: 'hogerlager', storage: opslag(2010), isOnline: () => true })
assert.equal(await jong.overzicht(), null)
await assert.rejects(jong.zetIn(10), e => e.reden === 'offline')
const oud = C.maakCasino({ supabase: server, spel: 'hogerlager', storage: opslag(1990), isOnline: () => true, uuid: () => '33333333-3333-4333-8333-333333333333' })
assert.equal((await oud.overzicht()).saldo, 250)
assert.equal((await oud.zetIn(10)).saldo, 240)
console.log('PASS: casino.js: alleen 18+')

// ── widgets.js: de casino-widget niet onder de 18 ──
globalThis.localStorage = opslag(2010)
const W = await import(new URL('../../widgets.js', import.meta.url))
assert.deepEqual(W.controleerLijst(), [])
assert.equal(W.lijstWidget('casino').alleenVolwassen, true)
assert.ok(!W.homeDefs().some(d => d.id === 'casino'), 'niet op Home')
assert.ok(!W.storeDefs().some(d => d.id === 'casino'), 'niet in de Store')
assert.ok(W.homeDefs().some(d => d.id === 'scorebord'), 'het scorebord wel')
assert.equal(await W.tekenLijstWidget('casino', {}), false, 'niet tekenen')
globalThis.localStorage = opslag(1990)
assert.ok(W.homeDefs().some(d => d.id === 'casino') && W.storeDefs().some(d => d.id === 'casino'), '18+: wel')
assert.equal(W.magZien(W.lijstWidget('casino'), null), true, 'onbekend: wel (de server beslist)')
assert.equal(W.magZien(W.lijstWidget('casino'), false), false)
assert.match(lees('index.html'), /!\(w && lijstWidget\(w\.id\) && !magZien\(lijstWidget\(w\.id\)\)\)/, 'Home: ook een opgeslagen casino-widget niet')
assert.match(lees('profiel.html'), /lijstWidget\(it\.widget\)&&magZien\(lijstWidget\(it\.widget\)\)/, 'Profiel > Widgets: niet')
console.log('PASS: widgets.js: Casino alleen 18+')

// ── de server ──
const sql = lees('sql/casino-volwassen.sql')
assert.match(sql, /if not public\.casino_volwassen\(me\) then raise exception 'Adults only'/)
assert.match(sql, /extract\(year from now\(\) at time zone 'Europe\/Amsterdam'\)::int - g\.jaar >= 18/)
assert.match(sql, /revoke all on public\.casino_geboortejaar from public, anon, authenticated/)
assert.match(sql, /after insert on auth\.users/)
assert.match(sql, /and public\.casino_volwassen\(c\.user_id\)\n/, 'geen vrienden onder de 18 in de lijst')
assert.match(sql, /p_spel not in \('eenentwintigen', 'pokertexasholdem', 'hogerlager'\)/)
assert.match(sql, /not public\.spel_vriend\(me, p_vriend\) or not public\.casino_volwassen\(p_vriend\)/)
assert.match(sql, /l\.groep_id = p_groep and not public\.casino_volwassen\(l\.user_id\)/)
assert.match(sql, /returns boolean language plpgsql stable security definer/, 'casino_mag_hier geeft alleen ja of nee')
for (const f of ['casino_mag_hier(uuid, uuid)', 'casino_inzet(uuid, text, integer, uuid)', 'casino_overzicht()', 'fruitautomaat_draai(uuid, integer, uuid)'])
  assert.ok(sql.includes('grant execute on function public.' + f + ' to authenticated'), f)
for (const f of ['casino_volwassen(uuid)', 'casino_geboortejaar_bewaar()', 'fruitautomaat_symbool(integer)', 'fruitautomaat_maal(text[])'])
  assert.ok(sql.includes('revoke all on function public.' + f + ' from public, anon, authenticated') && !sql.includes('grant execute on function public.' + f), f + ' is privé')
assert.match(lees('sql/casino-tokens.sql'), /voer daarna ALTIJD ook sql\/casino-volwassen\.sql uit/)
console.log('PASS: sql/casino-volwassen.sql')

// ── de wachtspelletjes op de goede plekken ──
const ws = lees('wachtspellen.js')
assert.match(ws, /export const CASINO_WACHT = \['eenentwintigen', 'pokertexasholdem'\]/)
assert.match(ws, /casinoMagHier\(\{ supabase: c, vriend, groep \}\)/, 'tokens alleen als iedereen in de chat 18+ is')
assert.match(ws, /metTokens && c \? maakCasino\(\{ supabase: c, spel: w\.id \}\) : null/)
const gk = lees('groepkaartspel.js')
assert.match(gk, /if \(isCasinoSpel\(lobby\.spel\)\) \{\n\s+if \(!gokje \|\| gokje\.sessie !== lobby\.sessie\) gokje = \{ sessie: lobby\.sessie, el: wachtspelKnoppen\(null, \{ groep: groepId \}\)\.el \}/)
assert.match(lees('chat.html'), /if \(isCasinoSpel\(spelActief\)\) \{[^\n]*wachtspelKnoppen\(scherm, \{ vriend: spelTegenstander\?\.id \|\| null, supabase \}\) \}\n\s+else molKnop\(scherm\)/)
const pk = lees('pokertexasholdem-ui.js')
assert.match(pk, /const gokje = Array\.isArray\(groep\) && groep\.length > 2 \? wachtspelKnop\(tafel\.element, \{ groep: groepId \}\) : null/)
assert.match(pk, /gokje\?\.zichtbaar\(ligtEruit\(staat\) && !voorbij\(staat\)\)/)
assert.match(pk, /REGELS\.filter\(t => volwassen \|\| !\/tokens\/\.test\(t\)\)/, 'onder de 18 niets over tokens in de spelregels')
assert.match(lees('videopoker-ui.js'), /REGELS\.filter\(t => casino \|\| !\/tokens\/\.test\(t\)\)/)
console.log('PASS: wachtspellen: wachtkamer, wachtscherm en Poker')
