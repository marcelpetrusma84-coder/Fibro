// proef229 (3 nov 2026): stuur-push v256, de melding bij een nieuw bericht komt van de server (trigger op messages,
// sql/push-vanaf-server.sql) met { message_id }. Elk bericht hoogstens EEN melding (push_log is het slot), ook als de
// trigger, de nieuwe app (ook met message_id) en een oude app (receiver_id + inlogpas) allemaal vragen.
// Zonder inlogpas: alleen voor een bestaand bericht van minder dan 2 minuten; afzender/ontvanger uit het bericht.
// Speluitnodigingen en belregels krijgen geen berichtmelding. proef46 en proef229 moeten ook nog slagen.
// Nodig: typescript (npm install typescript) in <map met node_modules>.
// node proef229.mjs <supabase/functions/stuur-push/index.ts> <map met node_modules>
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
// 30 okt 2026: zonder argumenten (zoals in de testlijst: for f in $(find tests -name '*.mjs')) zoekt hij zelf
// supabase/functions/stuur-push/index.ts in deze repo, en typescript 5 in de opgegeven map, de repo of een map hoger.
// Geen (bruikbare) typescript: OVERGESLAGEN, met uitleg, en geen fout (het is gereedschap, geen onderdeel van Fibro).
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
let ts = null
for (const m of [process.argv[3], REPO, path.dirname(REPO), '.'].filter(Boolean)) {
  try { const t = createRequire(path.join(path.resolve(m), 'x.js'))('typescript'); if (t && t.ScriptTarget) { ts = t; break } } catch (e) {}
}
if (!ts) {
  console.log('proef229: OVERGESLAGEN - typescript 5 niet gevonden. Zo draai je hem wel: npm install typescript@5 in een map,')
  console.log('  dan: node tests/tools/proef229.mjs supabase/functions/stuur-push/index.ts <die map>')
  process.exit(0)
}
const bron = fs.readFileSync(process.argv[2] || path.join(REPO, 'supabase/functions/stuur-push/index.ts'), 'utf8')
let js = ts.transpileModule(bron, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m, 'const { createClient } = globalThis.__nep;')
       .replace(/^import webpush from "npm:web-push";$/m, 'const webpush = globalThis.__nep.webpush;')
if (/^import /m.test(js)) throw new Error('import niet vervangen')


const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002', G = 'gggggggg-0000-4000-8000-000000000003', C = 'cccccccc-0000-4000-8000-000000000004'
const nu = () => new Date().toISOString(), oud = () => new Date(Date.now() - 5 * 60 * 1000).toISOString()
const M = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const DB = {
  tokens: { 'pas-a': A, 'pas-b': B },
  friendships: [{ user_id: A, friend_id: B, status: 'accepted' }, { user_id: B, friend_id: A, status: 'accepted' }, { user_id: G, friend_id: B, status: 'accepted' }],
  profiles: [{ id: A, username: 'Marcel', taal: 'nl', geblokkeerd: false }, { id: B, username: 'Bram', taal: 'en', geblokkeerd: false },
             { id: G, username: 'Gerrit', taal: 'nl', geblokkeerd: true }, { id: C, username: 'Cor', taal: 'nl', geblokkeerd: false }],
  push_subscriptions: [{ id: 's1', user_id: B, subscription: { endpoint: 'b1' } }, { id: 's3', user_id: A, subscription: { endpoint: 'a1' } }],
  messages: [], push_log: [],
}
let verzonden = []
function tabel(naam) {
  let rijen = (DB[naam] || []).slice(), beperk = null, kolommen = '', invoeg = null, enkel = false, volg = null
  const q = {
    select(k) { kolommen = k || ''; return q }, eq(k, v) { rijen = rijen.filter(r => r[k] === v); return q },
    in(k, l) { rijen = rijen.filter(r => l.includes(r[k])); return q }, gte(k, v) { rijen = rijen.filter(r => r[k] >= v); return q },
    order(k, o) { volg = [k, o && o.ascending === false ? -1 : 1]; return q }, limit(n) { beperk = n; return q },
    maybeSingle() { enkel = true; return q }, insert(r) { invoeg = r; return q }, delete() { return q },
    then(ok, f) {
      if (invoeg) {
        if (!DB[naam]) return Promise.resolve({ data: null, error: { code: '42P01' } }).then(ok, f)
        if (naam === 'push_log' && DB.push_log.some(x => x.message_id === invoeg.message_id)) return Promise.resolve({ data: null, error: { code: '23505' } }).then(ok, f)
        DB[naam].push({ ...invoeg }); return Promise.resolve({ data: null, error: null }).then(ok, f)
      }
      if (volg) rijen.sort((a, b) => (a[volg[0]] < b[volg[0]] ? -1 : 1) * volg[1])
      let uit = beperk ? rijen.slice(0, beperk) : rijen
      if (kolommen) { const ks = kolommen.split(',').map(x => x.trim()); uit = uit.map(r => Object.fromEntries(ks.map(k => [k, r[k]]))) }
      return Promise.resolve({ data: enkel ? (uit[0] || null) : uit, error: null }).then(ok, f)
    },
  }
  return q
}
globalThis.__nep = {
  createClient: () => ({ auth: { getUser: async pas => DB.tokens[pas] ? { data: { user: { id: DB.tokens[pas] } }, error: null } : { data: { user: null }, error: {} } }, from: tabel }),
  webpush: { setVapidDetails() {}, async sendNotification(sub, payload) { verzonden.push([sub.endpoint, JSON.parse(payload)]) } },
}
let handler
globalThis.Deno = { env: { get: k => 'x-' + k }, serve: h => { handler = h } }
await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
let fout = 0
async function vraag(body, pas) {
  const h = { 'Content-Type': 'application/json' }; if (pas) h.Authorization = 'Bearer ' + pas
  const res = await handler(new Request('https://x/functions/v1/stuur-push', { method: 'POST', headers: h, body: JSON.stringify(body) }))
  return { status: res.status, data: await res.json() }
}
function check(naam, ok, info) { if (!ok) fout++; console.log((ok ? 'OK   ' : 'FOUT ') + naam + (info ? ' | ' + JSON.stringify(info) : '')) }
const bericht = (n, van, naar, inhoud, tijd = nu()) => { DB.messages.push({ id: M(n), sender_id: van, receiver_id: naar, content: inhoud, created_at: tijd }); return M(n) }

// 1. trigger (zonder inlogpas) bij een versleuteld bericht: een melding, in de taal van de ontvanger
verzonden = []; let id = bericht(1, A, B, 'e2e:v2:abc')
let r = await vraag({ message_id: id })
check('trigger: bericht -> 1 melding (Engels)', r.status === 200 && verzonden.length === 1 && verzonden[0][1].body === 'You have a new message 💬' && verzonden[0][1].type === 'bericht', [r, verzonden])
// 2. dezelfde vraag nog eens (de app vraagt ook, met message_id): geen tweede melding
verzonden = []; r = await vraag({ message_id: id })
check('nog eens hetzelfde bericht: geen tweede melding', verzonden.length === 0 && r.data.reden === 'al verstuurd', r)
// 3. oude app (receiver_id + inlogpas) na de trigger: geen tweede melding
verzonden = []; r = await vraag({ receiver_id: B, type: 'bericht' }, 'pas-a')
check('oude app na de trigger: geen tweede melding', verzonden.length === 0 && r.data.reden === 'al verstuurd', r)
// 4. oude app EERST, dan de trigger: ook maar een melding
verzonden = []; id = bericht(2, A, B, 'e2e:v2:def')
r = await vraag({ receiver_id: B, type: 'bericht' }, 'pas-a'); const r2 = await vraag({ message_id: id })
check('oude app eerst, dan trigger: 1 melding', verzonden.length === 1 && r2.data.reden === 'al verstuurd', [r, r2, verzonden])
// 5. twee berichten snel na elkaar: twee meldingen
verzonden = []; const i3 = bericht(3, A, B, 'e2e:v2:x'), i4 = bericht(4, A, B, 'e2e:v2:y')
await vraag({ message_id: i3 }); await vraag({ message_id: i4 })
check('twee berichten na elkaar: twee meldingen', verzonden.length === 2)
// 6. buzz
verzonden = []; id = bericht(5, B, A, 'buzz:')
r = await vraag({ message_id: id })
check('buzz -> buzz-melding (Nederlands, met naam)', verzonden.length === 1 && verzonden[0][1].type === 'buzz' && verzonden[0][1].body === 'Bram buzzt je!', verzonden)
// 7. geen melding voor speluitnodiging en belregel
verzonden = []; await vraag({ message_id: bericht(6, A, B, 'spelinvite:dammen:x:y') }); await vraag({ message_id: bericht(7, A, B, 'oproep:gemist:a:0') })
check('speluitnodiging en belregel: geen berichtmelding', verzonden.length === 0)
// 8. te oud
verzonden = []; r = await vraag({ message_id: bericht(8, A, B, 'e2e:v2:z', oud()) })
check('bericht ouder dan 2 minuten: geen melding', verzonden.length === 0 && r.data.reden === 'te oud', r)
// 9. onbekend bericht / onzin
r = await vraag({ message_id: M(999) }); const r9 = await vraag({ message_id: "x' or 1=1" })
check('onbekend bericht 404, onzin 400', r.status === 404 && r9.status === 400 && verzonden.length === 0, [r, r9])
// 10. geblokkeerde afzender en geen vrienden
verzonden = []; const rg = await vraag({ message_id: bericht(10, G, B, 'e2e:v2:g') }); const rc = await vraag({ message_id: bericht(11, C, B, 'e2e:v2:c') })
check('geblokkeerd account 403, geen vrienden 403', rg.status === 403 && rc.status === 403 && verzonden.length === 0, [rg, rc])
// 11. zonder tabel push_log: toch sturen (liever een melding te veel)
const bewaar = DB.push_log; delete DB.push_log
verzonden = []; r = await vraag({ message_id: bericht(12, A, B, 'e2e:v2:p') })
DB.push_log = bewaar
check('slot kapot: toch een melding', verzonden.length === 1, r)
// 12. bellen werkt nog zoals vroeger
verzonden = []; r = await vraag({ receiver_id: B, type: 'oproep' }, 'pas-a')
check('oproep: zoals vroeger', verzonden.length === 1 && verzonden[0][1].type === 'oproep', r)
console.log(fout ? fout + ' FOUT' : 'ALLES GOED')
process.exit(fout ? 1 : 0)
