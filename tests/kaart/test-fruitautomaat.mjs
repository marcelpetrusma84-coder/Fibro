// test-fruitautomaat.mjs (28 nov 2026): de Fruitautomaat (fruitautomaat.js) en Hoger of lager (hogerlager.js, v3: eerlijke
// uitbetaling naar de kans), de fiches 5 tot 100, en dat de
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
assert.match(sql, /p_inzet not in \(5, 10, 25, 50, 100\)/)
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

// ── Hoger of lager (v3, 28 nov 2026: de uitbetaling hangt af van de kans) ──
let r = H.nieuweRonde(() => 0.5)
assert.equal(r.klaar, false)
assert.notEqual(r.kaart, r.volgende)
const vast = { kaart: 'h7', volgende: 'sH', klaar: false }
assert.equal(H.raad(vast, 'hoger').uitslag, 'winst')
assert.equal(H.raad(vast, 'lager').uitslag, 'verlies')
const gelijk = H.raad({ kaart: 'h7', volgende: 's7', klaar: false }, 'lager')
assert.equal(gelijk.uitslag, 'verlies', 'dezelfde waarde = verloren'); assert.equal(gelijk.gelijk, true)
assert.equal(H.raad(H.raad(vast, 'hoger'), 'hoger'), null, 'niet twee keer raden')
assert.equal(H.raad(vast, 'raar'), null)
assert.equal(H.raad({ kaart: 'h2', volgende: 's9', klaar: false }, 'lager'), null, 'lager dan een 2 kan niet')
assert.equal(H.raad({ kaart: 'hA', volgende: 's9', klaar: false }, 'hoger'), null, 'hoger dan een aas kan niet')
assert.equal(H.winKaarten('h8', 'hoger'), 24); assert.equal(H.winKaarten('h3', 'lager'), 4)
assert.equal(H.maal100('h8', 'hoger'), 206); assert.equal(H.maal100('h8', 'lager'), 206)
assert.equal(H.maal100('h3', 'hoger'), 112); assert.equal(H.maal100('h3', 'lager'), 1236)
assert.equal(H.maal100('h2', 'hoger'), 103); assert.equal(H.maal100('h2', 'lager'), 0); assert.equal(H.maal100('hA', 'hoger'), 0)
assert.equal(H.uitbetaling(25, 'h8', 'hoger'), 51, '25 × 2,06 = 51,5 -> 51')
assert.equal(H.uitbetaling(5, 'h2', 'hoger'), 5)
assert.equal(H.maalTekst(206), '2,06×')
// eerlijk: elke keuze geeft ongeveer 97 van de 100 terug (dus slim kiezen helpt niet meer; eerst was het 150)
for (let w = 2; w <= 14; w++) for (const keuze of H.KEUZES) {
  const k = 'h' + ({ 11: 'B', 12: 'V', 13: 'H', 14: 'A' }[w] || w), m = H.maal100(k, keuze)
  if (!m) continue
  const terug = H.winKaarten(k, keuze) / 51 * m / 100
  assert.ok(terug > 0.95 && terug <= 0.97, k + ' ' + keuze + ': ' + terug)
}
const hk = H.terugKans()
assert.ok(hk.beste <= 0.97 && hk.slechtste > 0.95, JSON.stringify(hk))
// de server: dezelfde regel
assert.match(sql, /return 4947 \/ w;/)
assert.match(sql, /w := case keuze when 'hoger' then 4 \* \(14 - r\) else 4 \* \(r - 2\) end;/)
assert.match(sql, /uit := case when a <> b and \(\(b > a\) = \(p_keuze = 'hoger'\)\) then 'winst' else 'verlies' end;/)
assert.match(sql, /terug := case when uit = 'winst' then \(p_inzet \* m\) \/ 100 else 0 end;/)
assert.match(sql, /revoke all on public\.hogerlager_rondes from public, anon, authenticated/)
for (const f of ['hogerlager_deel(uuid, uuid)', 'hogerlager_raad(uuid, text, integer, uuid)']) assert.ok(sql.includes('grant execute on function public.' + f + ' to authenticated'), f)
for (const f of ['hogerlager_rang(text)', 'hogerlager_maal100(text, text)']) assert.ok(!sql.includes('grant execute on function public.' + f), f + ' is privé')
// maakHogerLagerServer met een nagemaakte server
const hls = H.maakHogerLagerServer({ supabase: nep((naam, a) => {
  if (naam === 'hogerlager_deel' && a.p_expected_user === UID) return { data: { ronde_id: '44444444-4444-4444-8444-444444444444', kaart: 'h8' }, error: null }
  if (naam === 'hogerlager_raad' && a.p_keuze === 'hoger' && a.p_inzet === 25) return { data: { kaart: 'h8', volgende: 'sH', uitslag: 'winst', uitbetaling: 51, inzet: 25, saldo: 526 }, error: null }
  return { data: null, error: { message: 'x' } } }), uuid: () => '44444444-4444-4444-8444-444444444444' })
assert.deepEqual(await hls.deel(), { rondeId: '44444444-4444-4444-8444-444444444444', kaart: 'h8' })
assert.deepEqual(await hls.raad('44444444-4444-4444-8444-444444444444', 'hoger', 25), { kaart: 'h8', volgende: 'sH', uitslag: 'winst', gelijk: false, uitbetaling: 51, inzet: 25, saldo: 526 })
await assert.rejects(hls.raad('44444444-4444-4444-8444-444444444444', 'hoger', 7), e => e.reden === 'ongeldig')
await assert.rejects(hls.raad('44444444-4444-4444-8444-444444444444', 'lager', 25), e => e.reden === 'offline')
// de fiches zijn overal hetzelfde (5 tot 100)
const C = await import(new URL('../../casino.js', import.meta.url))
const V = await import(new URL('../../videopoker.js', import.meta.url))
assert.deepEqual(F.INZETTEN, C.INZETTEN); assert.deepEqual(V.INZETTEN, C.INZETTEN); assert.deepEqual(C.INZETTEN, [5, 10, 25, 50, 100])
console.log('test-fruitautomaat: alles goed (terug ' + (k.terug * 100).toFixed(1) + '%, prijs ' + (k.winkans * 100).toFixed(1) + '%; hoger of lager ' + (hk.slechtste * 100).toFixed(1) + '-' + (hk.beste * 100).toFixed(1) + '%)')
