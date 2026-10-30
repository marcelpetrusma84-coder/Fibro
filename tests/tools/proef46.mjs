// proef46: de functie stuur-push (v148) met een nagemaakte Supabase en web-push, in Node.
// Inlogpas verplicht, alleen naar een vriend (accepted), niet als geblokkeerd account, de tekst in de
// taal van de ontvanger (een meegestuurde title/body telt niet), buzz met de naam van de afzender,
// verlopen abonnementen (410) weg, en zonder kolom taal gewoon Nederlands.
// Nodig: typescript (npm install typescript) in <map met node_modules>.
// node proef46.mjs <supabase/functions/stuur-push/index.ts> <map met node_modules>
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
  console.log('proef46: OVERGESLAGEN - typescript 5 niet gevonden. Zo draai je hem wel: npm install typescript@5 in een map,')
  console.log('  dan: node tests/tools/proef46.mjs supabase/functions/stuur-push/index.ts <die map>')
  process.exit(0)
}
const bron = fs.readFileSync(process.argv[2] || path.join(REPO, 'supabase/functions/stuur-push/index.ts'), 'utf8')
let js = ts.transpileModule(bron, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m, 'const { createClient } = globalThis.__nep;')
       .replace(/^import webpush from "npm:web-push";$/m, 'const webpush = globalThis.__nep.webpush;')
if (/^import /m.test(js)) throw new Error('import niet vervangen')

const A = 'aaaa', B = 'bbbb', C = 'cccc', G = 'gggg'
const DB = {
  tokens: { 'pas-a': A, 'pas-b': B, 'pas-c': C, 'pas-g': G },
  friendships: [{ user_id: A, friend_id: B, status: 'accepted' }, { user_id: B, friend_id: A, status: 'accepted' },
                { user_id: A, friend_id: C, status: 'pending' }, { user_id: G, friend_id: B, status: 'accepted' }],
  profiles: [{ id: A, username: 'Marcel', taal: 'nl', geblokkeerd: false }, { id: B, username: 'Bram', taal: 'en', geblokkeerd: false },
             { id: C, username: null, taal: 'nl', geblokkeerd: false }, { id: G, username: 'Gerrit', taal: 'nl', geblokkeerd: true }],
  push_subscriptions: [{ id: 's1', user_id: B, subscription: { endpoint: 'b1' } }, { id: 's2', user_id: B, subscription: { endpoint: 'weg' } },
                       { id: 's3', user_id: A, subscription: { endpoint: 'a1' } }],
}
let verzonden = [], gewist = [], vragen = 0
function tabel(naam) {
  let rijen = DB[naam].slice(), wis = false, beperk = null, kolommen = ''
  const q = {
    select(k) { kolommen = k || ''; return q }, delete() { wis = true; return q },
    eq(k, v) { rijen = rijen.filter(r => r[k] === v); return q },
    in(k, l) { rijen = rijen.filter(r => l.includes(r[k])); return q },
    limit(n) { beperk = n; return q },
    then(ok, f) {
      vragen++
      if (naam === 'profiles' && globalThis.__zonderTaal && kolommen.includes('taal')) return Promise.resolve({ data: null, error: { code: '42703', message: 'column profiles.taal does not exist' } }).then(ok, f)
      if (wis) { gewist.push(...rijen.map(r => r.id)); DB[naam] = DB[naam].filter(r => !rijen.includes(r)) }
      let uit = beperk ? rijen.slice(0, beperk) : rijen
      if (kolommen) { const ks = kolommen.split(',').map(x => x.trim()); uit = uit.map(r => Object.fromEntries(ks.map(k => [k, r[k]]))) }
      return Promise.resolve({ data: uit, error: null }).then(ok, f)
    },
  }
  return q
}
globalThis.__nep = {
  createClient: () => ({
    auth: { getUser: async (pas) => { vragen++; return DB.tokens[pas] ? { data: { user: { id: DB.tokens[pas] } }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } } } },
    from: tabel,
  }),
  webpush: {
    setVapidDetails() {},
    async sendNotification(sub, payload) {
      if (sub.endpoint === 'weg') { const e = new Error('gone'); e.statusCode = 410; throw e }
      verzonden.push([sub.endpoint, JSON.parse(payload)])
    },
  },
}
let handler
globalThis.Deno = { env: { get: k => 'x-' + k }, serve: h => { handler = h } }
await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

let fout = 0
async function proef(naam, body, pas, verwacht) {
  verzonden = []; gewist = []; vragen = 0
  const h = { 'Content-Type': 'application/json' }
  if (pas) h.Authorization = 'Bearer ' + pas
  const res = await handler(new Request('https://x/functions/v1/stuur-push', { method: 'POST', headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) }))
  const data = await res.json()
  const uit = { status: res.status, data, verzonden, gewist }
  const ok = verwacht(uit)
  if (!ok) fout++
  console.log((ok ? 'OK   ' : 'FOUT ') + naam + ' | ' + JSON.stringify({ status: res.status, data, verzonden, gewist, vragen }))
}
await proef('leeg verzoek: zelfde fout als vroeger', {}, null, u => u.status === 500 && u.data.error === 'Error: receiver_id ontbreekt')
await proef('geen inlogpas', { receiver_id: B }, null, u => u.status === 401 && !u.verzonden.length)
await proef('valse inlogpas', { receiver_id: B }, 'nep', u => u.status === 401 && !u.verzonden.length)
await proef('naar jezelf', { receiver_id: A }, 'pas-a', u => u.status === 400 && !u.verzonden.length)
await proef('geen vriend (pending)', { receiver_id: C }, 'pas-a', u => u.status === 403 && !u.verzonden.length)
await proef('geblokkeerd account', { receiver_id: B }, 'pas-g', u => u.status === 403 && u.data.reden === 'geblokkeerd' && !u.verzonden.length)
await proef('bericht naar Engelse vriend, zelfgekozen tekst telt niet', { receiver_id: B, title: 'GRATIS', body: 'klik hier', type: 'bericht' }, 'pas-a',
  u => u.status === 200 && u.data.ok && u.data.verstuurd === 1 && u.verzonden.length === 1 && u.verzonden[0][1].body === 'You have a new message 💬' && u.verzonden[0][1].title === 'Fibro' && u.verzonden[0][1].type === 'bericht' && u.gewist.join() === 's2')
await proef('buzz naar Engelse vriend', { receiver_id: B, type: 'buzz' }, 'pas-a',
  u => u.status === 200 && u.verzonden.length === 1 && u.verzonden[0][1].body === 'Marcel is buzzing you!' && u.verzonden[0][1].title === '⚡ Buzz!' && u.verzonden[0][1].type === 'buzz')
await proef('buzz naar Nederlandse vriend', { receiver_id: A, type: 'buzz' }, 'pas-b',
  u => u.status === 200 && u.verzonden.length === 1 && u.verzonden[0][1].body === 'Bram buzzt je!' && u.verzonden[0][1].url === '/Fibro/chat.html')
await proef('zonder type = bericht, Nederlands', { receiver_id: A }, 'pas-b', u => u.verzonden.length === 1 && u.verzonden[0][1].body === 'Je hebt een nieuw bericht 💬')
await proef('onbekend type = bericht', { receiver_id: A, type: 'iets' }, 'pas-b', u => u.verzonden.length === 1 && u.verzonden[0][1].type === 'bericht')
DB.push_subscriptions = DB.push_subscriptions.filter(r => r.user_id !== A)
await proef('geen abonnementen', { receiver_id: A }, 'pas-b', u => u.status === 200 && u.data.reden === 'geen abonnementen')
DB.push_subscriptions.push({ id: 's4', user_id: B, subscription: { endpoint: 'b4' } })
globalThis.__zonderTaal = true
await proef('zonder kolom taal: Nederlands, zoals vroeger', { receiver_id: B, type: 'buzz' }, 'pas-a', u => u.status === 200 && u.verzonden.length === 2 && u.verzonden.every(v => v[1].body === 'Marcel buzzt je!'))
globalThis.__zonderTaal = false
await proef('kapotte json', '{x', 'pas-a', u => u.status === 500)
const opties = await handler(new Request('https://x/', { method: 'OPTIONS' }))
console.log(opties.status === 200 && opties.headers.get('Access-Control-Allow-Origin') === '*' ? 'OK   OPTIONS' : (fout++, 'FOUT OPTIONS'))
console.log(fout ? fout + ' FOUT' : 'ALLES GOED')
process.exit(fout ? 1 : 0)
