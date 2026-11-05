// v266 (5 nov 2026): het kopje "Pushmeldingen" in het menu (☰) op Home: zelf kiezen welke pushmeldingen je krijgt
// (standaard alles aan; berichten en bellen altijd), en de trigger voor "🟢 Bram is nu online".
// De regels van de server (wat uit staat, niet 's nachts, eens per 3 uur, ...) test tests/tools/proef266.mjs.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const SOORTEN = ['buzz', 'spel', 'vriend', 'gastenboek', 'like', 'online']

// 1. De database
const sql = lees('sql/pushmeldingen.sql')
assert.match(sql, /add column if not exists push_uit text\[\] not null default '\{\}'/, 'standaard niets uit')
const lijst = sql.match(/check \(push_uit <@ array\[([^\]]*)\]::text\[\]\)/)
assert.ok(lijst, 'alleen bekende soorten')
assert.deepEqual(lijst[1].split(',').map(x => x.trim().replace(/'/g, '')), SOORTEN, 'zelfde soorten als de app')
assert.ok(!/'bericht'/.test(lijst[1]), 'berichten kun je niet uitzetten')
assert.match(sql, /raise exception 'onbekende soort melding'/, 'zet_push weigert een onbekende soort (zoals bericht)')
const when = sql.match(/create trigger online_push[\s\S]*?when \(([\s\S]*?)\)\s*execute function public\.online_push\(\)/)
assert.ok(when, 'trigger online_push gevonden')
assert.match(when[1], /new\.online_status is true/, 'alleen bij online komen')
assert.match(when[1], /new\.toon_online is not false/, 'niet als iemand onzichtbaar is')
assert.match(when[1], /old\.laatst_gezien < now\(\) - interval '30 minutes'/, 'alleen na minstens 30 minuten weg')
assert.match(sql, /revoke all on public\.online_meldingen from public, anon, authenticated/, 'logboek alleen voor de server')
assert.match(sql, /^begin;[\s\S]*^commit;/m, 'alles of niets')

// 2. De server: dezelfde soorten, berichten en bellen niet
const push = lees('supabase/functions/stuur-push/index.ts')
const groep = push.match(/const PUSH_GROEP: Record<string, string> = \{([\s\S]*?)\};/)
assert.ok(groep, 'PUSH_GROEP gevonden')
assert.deepEqual([...new Set([...groep[1].matchAll(/: "(\w+)"/g)].map(m => m[1]))].sort(), [...SOORTEN].sort())
assert.ok(!/\bbericht\b|oproep|gemist:/.test(groep[1]), 'berichten en bellen niet uit te zetten')
assert.match(push, /if \(await staatUit\(supabase, receiver_id, String\(type\)\)\) return antwoord/, 'controle voor elke vriendmelding')

// 3. Het menu op Home
const index = lees('index.html')
assert.match(index, /import \{ PUSH_SOORTEN, pushAan, haalPushKeuzes, wisselPush, uitlegPush \} from '\.\/pushmeldingen\.js\?v=4'/,
  'gewone import (geen import() bij de tik: anders vraagt de iPhone geen toestemming)')
const kop = index.indexOf("groep(T('Pushmeldingen'), 'menuKopPush'")
assert.ok(kop > index.indexOf("groep(T('Instellingen')") && kop < index.indexOf("groep(T('Accountinstellingen')"), 'eigen kopje tussen Instellingen en Accountinstellingen')
assert.match(index, /Berichten en \\u\{1F4DE\} bellen: altijd aan/, 'uitleg dat berichten en bellen altijd aan staan')
const en = lees('taal-en.js')
assert.match(en, /"Pushmeldingen": "Push notifications"/)

// 4. pushmeldingen.js met een nep-supabase en nep-toestemming
let bron = lees('pushmeldingen.js')
bron = bron.replace(/^import \{ zetMeldingenAan \} from '\.\/meldingen-aan\.js\?v=4'$/m, 'const zetMeldingenAan = (...a) => globalThis.__toestemming(...a)')
assert.ok(!/^import /m.test(bron), 'import vervangen')
const opslag = new Map()
globalThis.localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)) }
globalThis.window = { T: s => s }
const M = await import('data:text/javascript;base64,' + Buffer.from(bron).toString('base64'))
assert.deepEqual(M.PUSH_SOORTEN.map(s => s.id).sort(), [...SOORTEN].sort(), 'menu kent dezelfde soorten')
// De Engelse woordenlijst echt inlezen (het is een gewoon script dat window.FIBRO_EN vult)
new Function('window', en)(globalThis.window)
const EN = globalThis.window.FIBRO_EN || {}
for (const s of M.PUSH_SOORTEN) assert.ok(EN[s.tekst] && EN[s.tekst] !== s.tekst || s.id === 'buzz', 'Engelse vertaling voor ' + s.id)
for (const zin of ['Pushmeldingen', '\u{1F4AC} Berichten en \u{1F4DE} bellen: altijd aan']) assert.ok(EN[zin], 'Engels: ' + zin)
let rpc = [], toestemming = 'aan', rpcFout = null, rij = null, gevraagd = 0, serverUit = []
const supabase = {
  rpc: async (naam, args) => {
    rpc.push([naam, args]); if (rpcFout) return { data: null, error: rpcFout }
    serverUit = args.p_aan ? serverUit.filter(x => x !== args.p_soort) : serverUit.filter(x => x !== args.p_soort).concat(args.p_soort)
    return { data: serverUit, error: null }
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rij, error: null }) }) }) }),
}
globalThis.__toestemming = () => { gevraagd++; return Promise.resolve(toestemming) }

for (const s of SOORTEN) assert.equal(M.pushAan(s), true, s + ' standaard aan')
let u = await M.wisselPush(supabase, 'u1', 'online')
assert.deepEqual(u, { aan: false, reden: 'ok' }, 'eerste tik zet hem uit')
assert.deepEqual(rpc.at(-1), ['zet_push', { p_soort: 'online', p_aan: false }])
assert.equal(gevraagd, 0, 'uitzetten vraagt niets')
assert.equal(M.pushAan('online'), false); assert.equal(M.pushAan('buzz'), true, 'de andere blijven aan')
u = await M.wisselPush(supabase, 'u1', 'like')
assert.equal(M.pushAan('like'), false); assert.equal(M.pushAan('online'), false, 'twee tegelijk uit')
u = await M.wisselPush(supabase, 'u1', 'online')
assert.deepEqual(u, { aan: true, reden: 'ok' }, 'weer aanzetten')
assert.equal(gevraagd, 1, 'aanzetten vraagt toestemming voor meldingen')
assert.deepEqual(rpc.at(-1), ['zet_push', { p_soort: 'online', p_aan: true }])
assert.equal(M.pushAan('like'), false, 'like blijft uit')

u = await M.wisselPush(supabase, 'u1', 'bericht')
assert.equal(u.reden, 'onbekend', 'berichten kun je niet uitzetten')

toestemming = 'geweigerd'; rpc = []
u = await M.wisselPush(supabase, 'u1', 'like')
assert.deepEqual(u, { aan: false, reden: 'geweigerd' }, 'geen toestemming: blijft uit')
assert.equal(rpc.length, 0, 'en dan niets naar de server')
assert.ok(M.uitlegPush('geweigerd'), 'met uitleg')
assert.equal(M.uitlegPush('uit'), null, 'vraag weggetikt: geen extra melding')

toestemming = 'aan'; rpcFout = { message: 'kapot' }
u = await M.wisselPush(supabase, 'u1', 'like')
assert.deepEqual(u, { aan: false, reden: 'server' }, 'server faalt: blijft uit')
rpcFout = null

rij = { push_uit: ['buzz', 'onzin'] }
assert.deepEqual(await M.haalPushKeuzes(supabase, 'u1'), ['buzz'], 'keuzes van een ander toestel overnemen (onzin eruit)')
assert.equal(M.pushAan('buzz'), false); assert.equal(M.pushAan('like'), true)
rij = null
assert.deepEqual(await M.haalPushKeuzes(supabase, 'u1'), [], 'geen rij = alles aan')
console.log('ok: kopje Pushmeldingen, zelf kiezen, en de trigger voor de online-melding')
