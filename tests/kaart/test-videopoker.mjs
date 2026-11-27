// test-videopoker.mjs (27 nov 2026): de regels van Video Poker (videopoker.js) en de SQL (sql/videopoker.sql).
// Handen en uitbetaling (Jacks or Better 9/6), ruilen (de volgende kaarten van de stapel), de tip, wat de server
// terugstuurt, en dat de SQL dezelfde tabel gebruikt.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const V = await import(new URL('../../videopoker.js', import.meta.url))
const sql = readFileSync(new URL('../../sql/videopoker.sql', import.meta.url), 'utf8')

const hand = k => V.beoordeel(k).hand
assert.equal(hand(['sA', 'sH', 'sV', 'sB', 's10']), 'royal')
assert.equal(hand(['h9', 'h8', 'h7', 'h6', 'h5']), 'straight_flush')
assert.equal(hand(['hA', 'h2', 'h3', 'h4', 'h5']), 'straight_flush', 'aas laag')
assert.equal(hand(['kH', 'rH', 'hH', 'sH', 'k4']), 'four')
assert.equal(hand(['sV', 'hV', 'rV', 'k8', 's8']), 'full_house')
assert.equal(hand(['rA', 'rB', 'r8', 'r6', 'r2']), 'flush')
assert.equal(hand(['k10', 'r9', 'h8', 's7', 'k6']), 'straight')
assert.equal(hand(['h10', 'sB', 'rV', 'kH', 'hA']), 'straight')
assert.equal(hand(['hA', 'r2', 'k3', 's4', 'h5']), 'straight')
assert.equal(hand(['hV', 'hH', 'hA', 'h2', 'h3']), 'flush', 'geen straight rond de aas')
assert.equal(hand(['s7', 'h7', 'r7', 'kA', 's3']), 'three')
assert.equal(hand(['sB', 'rB', 'h5', 'k5', 'rA']), 'two_pair')
assert.equal(hand(['hB', 'sB', 'r2', 'k5', 'h9']), 'jacks')
assert.equal(hand(['hA', 'sA', 'r3', 'k4', 'h9']), 'jacks')
assert.equal(hand(['h10', 's10', 'rA', 'k9', 'h2']), 'niets', 'een paar tienen levert niets op')
assert.equal(hand(['sA', 'kV', 'r9', 'h6', 's3']), 'niets')
assert.equal(hand(['sA', 'sA', 'r9', 'h6', 's3']), 'niets', 'dubbele kaart = ongeldig')
assert.deepEqual(V.TABEL.map(t => t.maal), [250, 50, 25, 9, 6, 4, 3, 2, 1])

// ruilen: de kaarten die je niet houdt worden vervangen door de volgende van de stapel, in volgorde
const r = { kaarten: ['h2', 'h3', 'h4', 'h5', 'h6'], stapel: ['sA', 'sH', 'sV', 'sB'], klaar: false }
const na = V.ruil(r, [true, false, true, false, true])
assert.deepEqual(na.kaarten, ['h2', 'sA', 'h4', 'sH', 'h6']); assert.equal(na.klaar, true)
assert.equal(V.ruil(na, [true, true, true, true, true]), null, 'maar één keer ruilen')
assert.equal(V.houdMasker([true, false, true, false, true]), 21)
let z = 11; const rng = () => { z = (z * 1103515245 + 12345) % 2147483648; return z / 2147483648 }
const nr = V.nieuweRonde(rng); assert.equal(new Set([...nr.kaarten, ...nr.stapel]).size, 52)

// de tip
assert.deepEqual(V.tip(['sA', 'sH', 'sV', 'sB', 's10']), [true, true, true, true, true])
assert.deepEqual(V.tip(['hB', 'sB', 'r2', 'k5', 'h9']), [true, true, false, false, false], 'paar boeren houden')
assert.deepEqual(V.tip(['hA', 'hH', 'hV', 'hB', 'sB']), [true, true, true, true, false], '4 naar een royal gaat voor een paar boeren')
assert.deepEqual(V.tip(['h4', 'h9', 'h2', 'hH', 's7']), [true, true, true, true, false], '4 naar een flush')
assert.deepEqual(V.tip(['k3', 's3', 'h9', 'rH', 's7']), [true, true, false, false, false], 'een laag paar')
assert.deepEqual(V.tip(['s5', 'h6', 'r7', 'k8', 'sV']), [true, true, true, true, false], '4 op een rij')
// met de tip kom je dicht bij je inzet terug (de automaat wint net)
let terug = 0; for (let i = 0; i < 20000; i++) { const x = V.nieuweRonde(rng); terug += V.ruil(x, V.tip(x.kaarten)).uitslag.maal }
assert.ok(terug / 20000 > 0.9 && terug / 20000 < 1.05, 'tip-strategie: ' + (terug / 20000).toFixed(3))

// de server: wat de app stuurt en terugkrijgt
const UID = 'aaaaaaaa-0000-4000-8000-000000000001', RID = '22222222-0000-4000-8000-000000000001'
const aanroepen = []
const nep = { auth: { getSession: async () => ({ data: { session: { user: { id: UID } } } }) },
  async rpc(naam, a) {
    aanroepen.push([naam, a])
    if (naam === 'videopoker_deel') return a.p_inzet === 100 ? { data: null, error: { message: 'Not enough tokens' } }
      : { data: { ronde_id: RID, kaarten: ['hB', 'sB', 'r2', 'k5', 'h9'], inzet: a.p_inzet, saldo: 215, al: false }, error: null }
    return { data: { kaarten: ['hB', 'sB', 'rB', 'k5', 'h9'], hand: 'three', uitbetaling: 75, saldo: 290 }, error: null }
  } }
const srv = V.maakVideoPokerServer({ supabase: nep, uuid: () => RID })
await assert.rejects(srv.deel(100), e => e.reden === 'te-weinig')
const d = await srv.deel(25)
assert.deepEqual(d, { rondeId: RID, kaarten: ['hB', 'sB', 'r2', 'k5', 'h9'], inzet: 25, saldo: 215, verder: false })
const u = await srv.ruil(RID, [true, true, false, false, false])
assert.equal(aanroepen.at(-1)[1].p_houd, 3); assert.equal(u.uitslag.hand, 'three'); assert.equal(u.uitbetaling, 75); assert.equal(u.saldo, 290)

// de SQL: dezelfde tabel, alleen eigen rondes, de kaarten van de server
assert.match(sql, /when 'royal' then 250 when 'straight_flush' then 50 when 'four' then 25 when 'full_house' then 9\s+when 'flush' then 6 when 'straight' then 4 when 'three' then 3 when 'two_pair' then 2 when 'jacks' then 1 else 0/)
assert.match(sql, /order by gen_random_uuid\(\)/)
assert.match(sql, /revoke all on public\.videopoker_rondes from public, anon, authenticated/)
assert.match(sql, /s - p_inzet < -100/)
assert.match(sql, /revoke all on function public\.videopoker_hand\(text\[\]\) from public, anon, authenticated/)
for (const f of ['videopoker_deel', 'videopoker_ruil']) assert.match(sql, new RegExp('grant execute on function public\\.' + f + '\\('))
console.log('test-videopoker: alles goed (tip-strategie ' + (terug / 20000).toFixed(3) + ')')
