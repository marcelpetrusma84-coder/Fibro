// proef47: de functie get-turn-credentials (v149) met een nagemaakte Supabase, in Node.
// Zonder (bruikbaar) TURN_GEHEIM 503 (alleen a-z telt, v149b), zonder/valse inlogpas 401, geblokkeerd 403, en een goed pasje:
// gebruikersnaam <verloopt>:<uid> (24 uur), wachtwoord = base64(HMAC-SHA1(geheim, gebruikersnaam)),
// nagerekend met node:crypto. Met PROEF_PASJE=<bestand> schrijft hij een goed pasje weg, zodat
// een echte coturn het kan narekenen (turnutils_uclient -u <gebruikersnaam> -w <wachtwoord>).
// Nodig: typescript (npm install typescript) in <map met node_modules>.
// node proef47.mjs <supabase/functions/get-turn-credentials/index.ts> <map met node_modules>
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(path.join(path.resolve(process.argv[3] || '.'), 'x.js'))
const ts = require('typescript')
const bron = fs.readFileSync(process.argv[2], 'utf8')
let js = ts.transpileModule(bron, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m, 'const { createClient } = globalThis.__nep;')
if (/^import /m.test(js)) throw new Error('import niet vervangen')

const A = 'aaaaaaaa-0000-0000-0000-000000000001', G = 'gggggggg-0000-0000-0000-000000000002', Z = 'zzzzzzzz-0000-0000-0000-000000000003'
const GEHEIM = 'proefgeheimnietechtabcdefgh'
const DB = {
  tokens: { 'pas-a': A, 'pas-g': G, 'pas-z': Z },
  profiles: [{ id: A, username: 'Bram', geblokkeerd: false }, { id: G, username: 'Lotte', geblokkeerd: true }],
}
let vragen = 0, profielFout = false
globalThis.__nep = {
  createClient: () => ({
    auth: { getUser: async (pas) => { vragen++; return DB.tokens[pas] ? { data: { user: { id: DB.tokens[pas] } }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } } } },
    from: (naam) => {
      let rijen = DB[naam].slice(), kolommen = ''
      const q = {
        select(k) { kolommen = k; return q },
        eq(k, v) { rijen = rijen.filter(r => r[k] === v); return q },
        async maybeSingle() {
          vragen++
          if (profielFout) return { data: null, error: { message: 'kapot' } }
          const r = rijen[0]
          return { data: r ? Object.fromEntries(kolommen.split(',').map(k => [k.trim(), r[k.trim()]])) : null, error: null }
        },
      }
      return q
    },
  }),
}
let env = { SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y', TURN_GEHEIM: GEHEIM }
let handler
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h } }
await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const hmac = (g, u) => crypto.createHmac('sha1', g).update(u).digest('base64')
let fout = 0
async function proef(naam, pas, verwacht, methode = 'GET') {
  vragen = 0
  const h = { apikey: 'publiek' }
  if (pas) h.Authorization = 'Bearer ' + pas
  const res = await handler(new Request('https://x/functions/v1/get-turn-credentials', { method: methode, headers: h }))
  const data = await res.json()
  const ok = verwacht({ status: res.status, data, res })
  if (!ok) fout++
  console.log((ok ? 'OK   ' : 'FOUT ') + naam + ' | ' + JSON.stringify({ status: res.status, data, vragen }))
  return data
}
env.TURN_GEHEIM = ''
await proef('zonder TURN_GEHEIM: 503, niets gevraagd', 'pas-a', u => u.status === 503 && u.data.reden === 'server nog niet ingesteld' && vragen === 0)
env.TURN_GEHEIM = GEHEIM
await proef('geen inlogpas', null, u => u.status === 401 && u.data.reden === 'niet ingelogd' && !u.data.iceServers)
await proef('valse inlogpas', 'nep', u => u.status === 401 && !u.data.iceServers)
await proef('geblokkeerd account', 'pas-g', u => u.status === 403 && u.data.reden === 'geblokkeerd' && !u.data.iceServers)
const nu = Math.floor(Date.now() / 1000)
const goed = await proef('goed pasje (GET)', 'pas-a', u => {
  const s = u.data.iceServers && u.data.iceServers[0]
  if (!s || u.status !== 200 || u.data.iceServers.length !== 1) return false
  const [v, id] = s.username.split(':')
  return JSON.stringify(s.urls) === JSON.stringify(['turn:136.144.154.200:3478?transport=udp', 'turn:136.144.154.200:3478?transport=tcp']) &&
    id === A && Number(v) === u.data.verloopt && Math.abs(Number(v) - nu - 86400) <= 2 &&
    s.credential === hmac(GEHEIM, s.username) && s.credential !== hmac('ander geheim', s.username) &&
    u.res.headers.get('Cache-Control') === 'no-store' && u.res.headers.get('Access-Control-Allow-Origin') === '*'
})
await proef('goed pasje (POST, zoals supabase.functions.invoke)', 'pas-a', u => u.status === 200 && u.data.iceServers[0].credential === hmac(GEHEIM, u.data.iceServers[0].username), 'POST')
await proef('account zonder profiel: wel een pasje', 'pas-z', u => u.status === 200 && u.data.iceServers[0].username.endsWith(':' + Z))
env.TURN_GEHEIM = '  ' + GEHEIM + '\n'
await proef('geheim met spaties/enter eromheen telt als hetzelfde', 'pas-a', u => u.status === 200 && u.data.iceServers[0].credential === hmac(GEHEIM, u.data.iceServers[0].username))
env.TURN_GEHEIM = 'Proef geheim\u200b niet ECHT abcd efgh\r\n'
await proef('hoofdletters, spaties, onzichtbare tekens: alleen a-z telt', 'pas-a', u => u.status === 200 && u.data.iceServers[0].credential === hmac(GEHEIM, u.data.iceServers[0].username))
env.TURN_GEHEIM = 'proefgeheimx'
await proef('te kort geheim (minder dan 16 letters): 503', 'pas-a', u => u.status === 503 && !u.data.iceServers && vragen === 0)
env.TURN_GEHEIM = '1234-5678 9012 3456 7890'
await proef('geheim zonder letters: 503', 'pas-a', u => u.status === 503 && !u.data.iceServers)
env.TURN_GEHEIM = GEHEIM
profielFout = true
await proef('database-fout: 500, geen pasje', 'pas-a', u => u.status === 500 && !u.data.iceServers)
profielFout = false
const opties = await handler(new Request('https://x/', { method: 'OPTIONS' }))
console.log(opties.status === 200 && opties.headers.get('Access-Control-Allow-Origin') === '*' && /authorization/.test(opties.headers.get('Access-Control-Allow-Headers')) ? 'OK   OPTIONS' : (fout++, 'FOUT OPTIONS'))
if (process.env.PROEF_PASJE) {
  fs.writeFileSync(process.env.PROEF_PASJE, JSON.stringify({ geheim: GEHEIM, username: goed.iceServers[0].username, credential: goed.iceServers[0].credential }))
  console.log('pasje weggeschreven naar', process.env.PROEF_PASJE)
}
console.log(fout ? fout + ' FOUT' : 'ALLES GOED')
process.exit(fout ? 1 : 0)
