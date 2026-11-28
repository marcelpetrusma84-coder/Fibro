// test-fruitautomaat.mjs (28 nov 2026): de Fruitautomaat (fruitautomaat.js) en Hoger of lager (hogerlager.js), en dat de
// server (sql/casino-volwassen.sql) precies dezelfde gewichten en uitbetalingstabel gebruikt.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const F = await import(new URL('../../fruitautomaat.js', import.meta.url))
const H = await import(new URL('../../hogerlager.js', import.meta.url))
const sql = readFileSync(new URL('../../sql/casino-volwassen.sql', import.meta.url), 'utf8')

// ── de gewichten: samen 32, en symboolVan verdeelt 0..31 precies zo ──
assert.equal(Object.values(F.GEWICHT).reduce((a, b) => a + b, 0), 32)
const tel = {}
for (let n = 0; n < 32; n++) tel[F.symboolVan(n)] = (tel[F.symboolVan(n)] || 0) + 1
assert.deepEqual(tel, F.GEWICHT)

// ── de uitbetaling ──
assert.equal(F.maal(['zeven', 'zeven', 'zeven']), 200)
assert.equal(F.maal(['ster', 'ster', 'ster']), 60)
assert.equal(F.maal(['kers', 'kers', 'kers']), 10)
assert.equal(F.maal(['kers', 'bel', 'kers']), 4, 'twee kersen, waar dan ook')
assert.equal(F.maal(['bel', 'kers', 'kers']), 4)
assert.equal(F.maal(['kers', 'bel', 'druif']), 1, 'een kers op de eerste rol = inzet terug')
assert.equal(F.maal(['bel', 'kers', 'druif']), 0, 'een kers op een andere rol = niets')
assert.equal(F.maal(['bel', 'bel', 'druif']), 0)
assert.equal(F.maal(['bel', 'bel']), 0, 'geen drie rollen = niets')
assert.equal(F.maal(['bom', 'bom', 'bom']), 0)

// ── eerlijk: ongeveer 97 van de 100 terug en ongeveer 1 op 4 een prijs (staat zo in de spelregels) ──
const k = F.terugKans()
assert.ok(k.terug > 0.95 && k.terug < 0.98, 'terug ' + k.terug)
assert.ok(k.winkans > 0.22 && k.winkans < 0.26, 'winkans ' + k.winkans)
// en het toestel draait volgens dezelfde kansen (met een vaste toevalsreeks)
let zaad = 7
const rng = () => ((zaad = (zaad * 1103515245 + 12345) % 2147483648) / 2147483648)
let terug = 0
for (let i = 0; i < 40000; i++) { const r = F.draai(rng); assert.ok(F.isRollen(r)); terug += F.maal(r) }
assert.ok(Math.abs(terug / 40000 - k.terug) < 0.08, 'gedraaid ' + terug / 40000)

// ── de server: dezelfde grenzen en dezelfde tabel ──
let grens = 0
for (const s of F.SYMBOLEN.slice(0, -1)) { grens += F.GEWICHT[s]; assert.match(sql, new RegExp('when n < ' + grens + " then '" + s + "'")) }
for (const [s, m] of Object.entries(F.TABEL)) assert.match(sql, new RegExp("when '" + s + "' then " + m + '\\b'))
assert.match(sql, new RegExp('if kersen = 2 then return ' + F.TWEE_KERSEN))
assert.match(sql, new RegExp("if kersen = 1 and r\\[1\\] = 'kers' then return " + F.EERSTE_KERS))
assert.match(sql, /get_byte\(uuid_send\(gen_random_uuid\(\)\), 0\) % 32/)
assert.match(sql, /p_inzet not in \(10, 25, 50, 100\)/)
assert.match(sql, /s - p_inzet < -100/)
assert.match(sql, /revoke all on public\.fruitautomaat_rondes from public, anon, authenticated/)
assert.match(sql, /grant execute on function public\.fruitautomaat_draai\(uuid, integer, uuid\) to authenticated/)
assert.match(sql, /me uuid := public\.casino_ik\(p_expected_user\);\n  oud public\.fruitautomaat_rondes/, 'eerst de gewone controles (en 18+)')

// ── maakFruitServer met een nagemaakte server ──
const UID = '11111111-1111-4111-8111-111111111111'
const nep = (antwoord) => ({ auth: { getSession: async () => ({ data: { session: { user: { id: UID } } } }) }, rpc: async (naam, a) => antwoord(naam, a) })
const srv = F.maakFruitServer({ supabase: nep((naam, a) => naam === 'fruitautomaat_draai' && a.p_inzet === 25 && a.p_expected_user === UID
  ? { data: { rollen: ['bel', 'bel', 'bel'], inzet: 25, uitbetaling: 1000, saldo: 1225 }, error: null } : { data: null, error: { message: 'x' } }) })
assert.deepEqual(await srv.draai(25), { rollen: ['bel', 'bel', 'bel'], inzet: 25, uitbetaling: 1000, saldo: 1225 })
await assert.rejects(srv.draai(33), e => e.reden === 'ongeldig')
const arm = F.maakFruitServer({ supabase: nep(() => ({ data: null, error: { message: 'Not enough tokens' } })) })
await assert.rejects(arm.draai(100), e => e.reden === 'te-weinig')
const raar = F.maakFruitServer({ supabase: nep(() => ({ data: { rollen: ['bom', 'bel', 'bel'], saldo: 5 }, error: null })) })
await assert.rejects(raar.draai(10), e => e.reden === 'offline', 'een rare uitslag van de server telt niet')

// ── Hoger of lager ──
let r = H.nieuweRonde(() => 0.5)
assert.equal(r.klaar, false)
assert.notEqual(r.kaart, r.volgende)
const vast = { kaart: 'h7', volgende: 'sH', klaar: false }
assert.equal(H.raad(vast, 'hoger').uitslag, 'winst')
assert.equal(H.raad(vast, 'lager').uitslag, 'verlies')
assert.equal(H.raad({ kaart: 'h7', volgende: 's7', klaar: false }, 'lager').uitslag, 'gelijk')
assert.equal(H.raad(H.raad(vast, 'hoger'), 'hoger'), null, 'niet twee keer raden')
assert.equal(H.raad(vast, 'raar'), null)
console.log('test-fruitautomaat: alles goed (terug ' + (k.terug * 100).toFixed(1) + '%, prijs ' + (k.winkans * 100).toFixed(1) + '%)')
