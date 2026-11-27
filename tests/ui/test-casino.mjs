// test-casino.mjs (27 nov 2026): casino-tokens (casino.js). De regels: tot -100, hoogstens 100 per potje, winst = 2× terug,
// gelijk = inzet terug; een uitslag die niet aankomt (geen internet) wordt onthouden en later alsnog verstuurd;
// en sql/casino-tokens.sql houdt zich aan dezelfde getallen.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const C = await import(new URL('../../casino.js', import.meta.url))
const sql = readFileSync(new URL('../../sql/casino-tokens.sql', import.meta.url), 'utf8')

// ── de regels ──
assert.equal(C.WEEKBEDRAG, 250); assert.equal(C.MINIMUM, -100); assert.equal(C.MAX_INZET, 100)
assert.deepEqual(C.INZETTEN, [10, 25, 50, 100])
assert.equal(C.magInzetten(0, 100), true)
assert.equal(C.magInzetten(-50, 50), true)
assert.equal(C.magInzetten(-50, 100), false)
assert.equal(C.magInzetten(-100, 10), false)
assert.equal(C.magInzetten(500, 33), false, 'alleen de vaste fiches')
assert.equal(C.uitbetaling(50, 'winst'), 100); assert.equal(C.uitbetaling(50, 'gelijk'), 50); assert.equal(C.uitbetaling(50, 'verlies'), 0)
assert.equal(C.verschil(25, 'winst'), 25); assert.equal(C.verschil(25, 'gelijk'), 0); assert.equal(C.verschil(25, 'verlies'), -25)
assert.throws(() => C.maakCasino({ supabase: {}, spel: 'pesten' }))

// ── de server gebruikt dezelfde getallen ──
assert.match(sql, /saldo between -100 and/)
assert.match(sql, /inzet between 1 and 100/)
assert.match(sql, /250::bigint \* \(\(nu - c\.week\) \/ 7\)/)
assert.match(sql, /when 'winst' then 2 \* rij\.inzet when 'gelijk' then rij\.inzet else 0/)
assert.match(sql, /s - p_inzet < -100/)
assert.match(sql, /revoke all on public\.casino_saldo from public, anon, authenticated/)
for (const f of ['casino_inzet', 'casino_uitslag', 'casino_overzicht']) assert.match(sql, new RegExp('grant execute on function public\\.' + f + '\\('))

// ── met een nep-Supabase ──
const UID = 'aaaaaaaa-0000-4000-8000-000000000001'
function nep() {
  const s = { saldo: 0, online: true, aanroepen: [], kapot: false }
  s.supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: UID } } } }) },
    async rpc(naam, args) {
      s.aanroepen.push([naam, args])
      if (s.kapot) return { data: null, error: { message: 'Failed to fetch' } }
      if (naam === 'casino_overzicht') return { data: { saldo: s.saldo, volgende: '2026-11-30T00:00:00+01:00', vrienden: [{ user_id: UID, username: 'm', saldo: s.saldo }], laatste: [] }, error: null }
      if (naam === 'casino_inzet') {
        if (s.saldo - args.p_inzet < -100) return { data: null, error: { message: 'Not enough tokens', code: 'P0001' } }
        s.saldo -= args.p_inzet; s[args.p_run_id] = args.p_inzet; return { data: { saldo: s.saldo }, error: null }
      }
      if (naam === 'casino_uitslag') { s.saldo += C.uitbetaling(s[args.p_run_id], args.p_uitslag); return { data: { saldo: s.saldo }, error: null } }
      return { data: null, error: { message: 'onbekend' } }
    },
  }
  return s
}
const opslag = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m } }
let n = 0
const uuid = () => '11111111-0000-4000-8000-' + String(++n).padStart(12, '0')

{
  const s = nep(); s.saldo = -50
  const st = opslag()
  const c = C.maakCasino({ supabase: s.supabase, spel: 'eenentwintigen', storage: st, uuid, isOnline: () => s.online })
  const ov = await c.overzicht()
  assert.equal(ov.saldo, -50); assert.equal(ov.vrienden[0].isSelf, true); assert.equal(typeof ov.volgende, 'number')
  await assert.rejects(c.zetIn(100), e => e.reden === 'te-weinig')
  await assert.rejects(c.zetIn(30), e => e.reden === 'ongeldig')
  const pot = await c.zetIn(50)
  assert.equal(pot.saldo, -100); assert.equal(pot.inzet, 50)
  // internet weg: de uitslag wordt onthouden
  s.online = false
  assert.equal(await c.uitslag(pot.runId, 'winst'), null)
  assert.equal(JSON.parse(st.getItem('fibro_casino_open_' + UID)).length, 1)
  assert.equal(await c.overzicht(), null, 'zonder internet geen overzicht')
  await assert.rejects(c.zetIn(10), e => e.reden === 'offline')
  // weer online: eerst de oude uitslag, dan het overzicht
  s.online = true
  const ov2 = await c.overzicht()
  assert.equal(ov2.saldo, 0, '-100 + 2×50')
  assert.equal(st.getItem('fibro_casino_open_' + UID), null)
  // server kapot: ook onthouden
  const pot2 = await c.zetIn(10)
  s.kapot = true
  assert.equal(await c.uitslag(pot2.runId, 'gelijk'), null)
  assert.equal(await c.overzicht(), null)
  s.kapot = false
  assert.equal((await c.overzicht()).saldo, 0)
}
{
  // zonder account: niets
  const c = C.maakCasino({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => { throw new Error('mag niet') } }, spel: 'eenentwintigen', storage: opslag() })
  assert.equal(await c.overzicht(), null)
  await assert.rejects(c.zetIn(10), e => e.reden === 'offline')
}
// Black Jack gebruikt het alleen tegen de computer (window.fibroCasino uit spel.html)
const ui = readFileSync(new URL('../../eenentwintigen-ui.js', import.meta.url), 'utf8')
assert.match(ui, /const casino = solo && window\.fibroCasino/)
assert.match(readFileSync(new URL('../../spel.html', import.meta.url), 'utf8'), /window\.fibroCasino = CASINO_SPELLEN\.includes\(spelId\)/)
console.log('test-casino: alles goed')
