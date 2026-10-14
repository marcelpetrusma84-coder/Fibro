// proef50: de functie stuur-push (v151) met belmeldingen: 'oproep', 'oproep-video' en 'gemist', in de taal van
// de ontvanger, met de naam van de beller. Een oproep opent het belscherm (bellen.html?vriend=..&naam=..&inkomend=1,
// video: &video=1), leeft 45 s bij de pushdienst (TTL, urgency high); 'gemist' opent de chat, 1 dag, zelfde tag
// (oproep-<beller>) zodat hij de 'belt je'-melding vervangt. Bericht/buzz blijven precies zoals vroeger (zonder
// opties, zonder tag); proef46 moet ook nog slagen. Vreemde types ('__proto__') = bericht.
// Nodig: typescript (npm install typescript) in <map met node_modules>.
// node proef50.mjs <supabase/functions/stuur-push/index.ts> <map met node_modules>
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(path.join(path.resolve(process.argv[3] || '.'), 'x.js'))
const ts = require('typescript')
const bron = fs.readFileSync(process.argv[2], 'utf8')
let js = ts.transpileModule(bron, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m, 'const { createClient } = globalThis.__nep;')
       .replace(/^import webpush from "npm:web-push";$/m, 'const webpush = globalThis.__nep.webpush;')
if (/^import /m.test(js)) throw new Error('import niet vervangen')

const A = 'aaaa', B = 'bbbb', C = 'cccc', G = 'gggg', D = 'dddd'
const DB = {
  tokens: { 'pas-a': A, 'pas-b': B, 'pas-c': C, 'pas-g': G, 'pas-d': D },
  friendships: [{ user_id: A, friend_id: B, status: 'accepted' }, { user_id: B, friend_id: A, status: 'accepted' },
                { user_id: A, friend_id: C, status: 'pending' }, { user_id: G, friend_id: B, status: 'accepted' }, { user_id: D, friend_id: A, status: 'accepted' }],
  profiles: [{ id: A, username: 'Marcel', taal: 'nl', geblokkeerd: false }, { id: B, username: 'Bram', taal: 'en', geblokkeerd: false },
             { id: C, username: null, taal: 'nl', geblokkeerd: false }, { id: G, username: 'Gerrit', taal: 'nl', geblokkeerd: true },
             { id: D, username: 'Jan & Piet?', taal: 'nl', geblokkeerd: false }],
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
    async sendNotification(sub, payload, opties) {
      if (sub.endpoint === 'weg') { const e = new Error('gone'); e.statusCode = 410; throw e }
      verzonden.push([sub.endpoint, JSON.parse(payload), opties])
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
const p = u => u.verzonden[0] && u.verzonden[0][1], o = u => u.verzonden[0] && u.verzonden[0][2]
await proef('oproep naar Engelse vriend', { receiver_id: B, type: 'oproep' }, 'pas-a', u => u.status === 200 && u.verzonden.length === 1
  && p(u).body === '📞 Marcel is calling you' && p(u).title === 'Fibro' && p(u).type === 'oproep' && p(u).tag === 'oproep-' + A
  && p(u).url === '/Fibro/bellen.html?vriend=' + A + '&naam=Marcel&inkomend=1' && o(u).TTL === 45 && o(u).urgency === 'high')
await proef('videooproep naar Nederlandse vriend', { receiver_id: A, type: 'oproep-video' }, 'pas-b', u => u.verzonden.length === 1
  && p(u).body === '📹 Bram belt je (video)' && p(u).url === '/Fibro/bellen.html?vriend=' + B + '&naam=Bram&inkomend=1&video=1'
  && p(u).tag === 'oproep-' + B && o(u).TTL === 45)
await proef('videooproep in het Engels', { receiver_id: B, type: 'oproep-video' }, 'pas-a', u => p(u).body === '📹 Marcel is video calling you')
await proef('gemiste oproep (Nederlands): opent de chat, 1 dag, zelfde tag', { receiver_id: A, type: 'gemist' }, 'pas-b', u => u.verzonden.length === 1
  && p(u).body === '📵 Gemiste oproep van Bram' && p(u).url === '/Fibro/chat.html' && p(u).tag === 'oproep-' + B && p(u).type === 'gemist'
  && o(u).TTL === 86400 && o(u).urgency === 'normal')
await proef('gemiste oproep (Engels)', { receiver_id: B, type: 'gemist' }, 'pas-a', u => p(u).body === '📵 Missed call from Marcel')
await proef('naam met & en ? veilig in het adres', { receiver_id: A, type: 'oproep' }, 'pas-d', u => p(u).body === '📞 Jan & Piet? belt je'
  && p(u).url === '/Fibro/bellen.html?vriend=' + D + '&naam=Jan%20%26%20Piet%3F&inkomend=1')
await proef('bericht: zoals vroeger (geen opties, geen tag)', { receiver_id: B }, 'pas-a', u => o(u) === undefined && !('tag' in p(u))
  && JSON.stringify(p(u)) === JSON.stringify({ title: 'Fibro', body: 'You have a new message 💬', url: '/Fibro/chat.html', type: 'bericht' }))
await proef('buzz: zoals vroeger', { receiver_id: B, type: 'buzz' }, 'pas-a', u => o(u) === undefined && !('tag' in p(u)) && p(u).type === 'buzz')
await proef('vreemd type (__proto__) = bericht', { receiver_id: B, type: '__proto__' }, 'pas-a', u => u.status === 200 && p(u).type === 'bericht')
await proef('vreemd type (constructor) = bericht', { receiver_id: B, type: 'constructor' }, 'pas-a', u => u.status === 200 && p(u).type === 'bericht')
await proef('oproep naar geen-vriend: geweigerd', { receiver_id: C, type: 'oproep' }, 'pas-a', u => u.status === 403 && !u.verzonden.length)
await proef('oproep van geblokkeerd account: geweigerd', { receiver_id: B, type: 'oproep' }, 'pas-g', u => u.status === 403 && !u.verzonden.length)
await proef('oproep zonder inlogpas: geweigerd', { receiver_id: B, type: 'oproep' }, null, u => u.status === 401 && !u.verzonden.length)
globalThis.__zonderTaal = true
await proef('zonder kolom taal: oproep in het Nederlands', { receiver_id: B, type: 'oproep' }, 'pas-a', u => u.verzonden.length >= 1 && u.verzonden.every(v => v[1].body === '📞 Marcel belt je'))
globalThis.__zonderTaal = false
const opties = await handler(new Request('https://x/', { method: 'OPTIONS' }))
console.log(opties.status === 200 && opties.headers.get('Access-Control-Allow-Origin') === '*' ? 'OK   OPTIONS' : (fout++, 'FOUT OPTIONS'))
console.log(fout ? fout + ' FOUT' : 'ALLES GOED')
process.exit(fout ? 1 : 0)
