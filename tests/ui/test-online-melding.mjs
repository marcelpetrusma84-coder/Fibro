// v266 (5 nov 2026): de schakelaar "🟢 Melding als een vriend online komt" (☰ op Home) en de trigger die de melding
// start. De regels van de server zelf (niet 's nachts, eens per 3 uur, ...) test tests/tools/proef266.mjs.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

// 1. De database: standaard uit, en alleen na minstens 30 minuten weg (even wegklikken telt niet), nooit als onzichtbaar
const sql = lees('sql/online-melding.sql')
assert.match(sql, /add column if not exists melding_online boolean not null default true/, 'schakelaar standaard aan')
const when = sql.match(/create trigger online_push[\s\S]*?when \(([\s\S]*?)\)\s*execute function public\.online_push\(\)/)
assert.ok(when, 'trigger online_push gevonden')
assert.match(when[1], /new\.online_status is true/, 'alleen bij online komen')
assert.match(when[1], /new\.toon_online is not false/, 'niet als iemand onzichtbaar is')
assert.match(when[1], /old\.laatst_gezien < now\(\) - interval '30 minutes'/, 'alleen na minstens 30 minuten weg')
assert.match(sql, /'online_id', new\.id/, 'alleen het id gaat mee')
assert.match(sql, /revoke all on public\.online_meldingen from public, anon, authenticated/, 'logboek alleen voor de server')
assert.match(sql, /^begin;[\s\S]*^commit;/m, 'alles of niets')

// 2. Het menu op Home
const index = lees('index.html')
assert.match(index, /import \{ onlineMeldingAan, haalOnlineKeuze, wisselOnlineMelding, uitlegOnlineMelding \} from '\.\/online-melding\.js\?v=1'/,
  'gewone import (geen import() bij de tik: anders vraagt de iPhone geen toestemming)')
assert.match(index, /b\.id = 'menuOnlineMelding'[\s\S]*?role', 'menuitemcheckbox'/, 'schakelaar in het menu')
const kop = index.indexOf("groep(T('Pushmeldingen'), 'menuKopPush')")
assert.ok(kop > index.indexOf("groep(T('Instellingen')") && kop < index.indexOf("menuOnlineMelding"), 'eigen kopje Pushmeldingen boven de schakelaar')
assert.ok(index.indexOf("menuOnlineMelding") < index.indexOf("groep(T('Accountinstellingen')"), 'voor Accountinstellingen')
const en = lees('taal-en.js')
assert.match(en, /"Pushmeldingen": "Push notifications"/, 'kopje in het Engels')
assert.match(en, /"\\u\{1F7E2\} Melding als een vriend online komt": "\\u\{1F7E2\} Notify me when a friend comes online"/, 'Engels')

// 3. online-melding.js met een nep-supabase en nep-toestemming
let bron = lees('online-melding.js')
bron = bron.replace(/^import \{ zetMeldingenAan \} from '\.\/meldingen-aan\.js\?v=1'$/m, 'const zetMeldingenAan = (...a) => globalThis.__toestemming(...a)')
assert.ok(!/^import /m.test(bron), 'import vervangen')
const opslag = new Map()
globalThis.localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)) }
globalThis.window = { T: s => s }
const M = await import('data:text/javascript;base64,' + Buffer.from(bron).toString('base64'))
let rpc = [], toestemming = 'aan', rpcFout = null, rij = null, gevraagd = 0
const supabase = {
  rpc: async (naam, args) => { rpc.push([naam, args]); return { error: rpcFout } },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rij, error: null }) }) }) }),
}
globalThis.__toestemming = () => { gevraagd++; return Promise.resolve(toestemming) }

assert.equal(M.onlineMeldingAan(), true, 'standaard aan')
let u = await M.wisselOnlineMelding(supabase, 'u1')
assert.deepEqual(u, { aan: false, reden: 'ok' }, 'eerste tik zet hem uit')
assert.deepEqual(rpc.at(-1), ['zet_melding_online', { p_aan: false }])
assert.equal(gevraagd, 0, 'uitzetten vraagt niets')
u = await M.wisselOnlineMelding(supabase, 'u1')
assert.deepEqual(u, { aan: true, reden: 'ok' }, 'aanzetten lukt')
assert.equal(gevraagd, 1, 'aanzetten vraagt om toestemming voor meldingen')
assert.deepEqual(rpc.at(-1), ['zet_melding_online', { p_aan: true }], 'keuze naar de server')
assert.equal(M.onlineMeldingAan(), true)
u = await M.wisselOnlineMelding(supabase, 'u1')
assert.deepEqual(u, { aan: false, reden: 'ok' }, 'uitzetten lukt')
assert.equal(gevraagd, 1, 'uitzetten vraagt nog steeds niets')
assert.deepEqual(rpc.at(-1), ['zet_melding_online', { p_aan: false }])

opslag.set('fibro_melding_online', '0'); toestemming = 'geweigerd'; rpc = []
u = await M.wisselOnlineMelding(supabase, 'u1')
assert.deepEqual(u, { aan: false, reden: 'geweigerd' }, 'geen toestemming: blijft uit')
assert.equal(rpc.length, 0, 'en dan niets naar de server')
assert.ok(M.uitlegOnlineMelding('geweigerd'), 'met uitleg')
assert.equal(M.uitlegOnlineMelding('uit'), null, 'vraag weggetikt: geen extra melding')

opslag.set('fibro_melding_online', '0'); toestemming = 'aan'; rpcFout = { message: 'kapot' }
u = await M.wisselOnlineMelding(supabase, 'u1')
assert.deepEqual(u, { aan: false, reden: 'server' }, 'server faalt: blijft uit')
assert.equal(M.onlineMeldingAan(), false)

rij = { melding_online: true }
assert.equal(await M.haalOnlineKeuze(supabase, 'u1'), true, 'keuze van een ander toestel overnemen')
assert.equal(M.onlineMeldingAan(), true)
rij = { melding_online: false }
assert.equal(await M.haalOnlineKeuze(supabase, 'u1'), false, 'uitgezet op een ander toestel')
assert.equal(M.onlineMeldingAan(), false)
rij = null
assert.equal(await M.haalOnlineKeuze(supabase, 'u1'), true, 'geen rij = aan (standaard)')
console.log('ok: schakelaar en trigger voor de online-melding')
