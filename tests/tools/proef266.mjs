// proef266 (5 nov 2026): stuur-push v266, de melding "🟢 Bram is nu online" (type 'online', { online_id }, alleen vanaf
// de server: trigger in sql/online-melding.sql). Slim en niet irritant:
//  - alleen naar vrienden (beide kanten) die de schakelaar aan hebben (chat_instellingen.melding_online);
//  - niet als de vriend niet echt (meer) online is of zichzelf onzichtbaar maakte (toon_online = false);
//  - niet 's nachts (23:00 tot 8:00 in Nederland), niet als je zelf al online bent;
//  - dezelfde vriend hoogstens eens per 3 uur; hoogstens een online-melding per 20 minuten en 6 per dag;
//  - tag 'online' (een nieuwe vervangt de vorige), korte levensduur, en een tik opent de chat met die vriend.
// Draait index.ts met een nep-database (zoals proef229). Zonder typescript: OVERGESLAGEN.
// node tests/tools/proef266.mjs [supabase/functions/stuur-push/index.ts] [map met node_modules]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
let ts = null
for (const m of [process.argv[3], REPO, path.dirname(REPO), '.'].filter(Boolean)) {
  try { const t = createRequire(path.join(path.resolve(m), 'x.js'))('typescript'); if (t && t.ScriptTarget) { ts = t; break } } catch (e) {}
}
if (!ts) {
  console.log('proef266: OVERGESLAGEN - typescript 5 niet gevonden (npm install typescript@5).')
  process.exit(0)
}
const bron = fs.readFileSync(process.argv[2] || path.join(REPO, 'supabase/functions/stuur-push/index.ts'), 'utf8')
let js = ts.transpileModule(bron, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m, 'const { createClient } = globalThis.__nep;')
       .replace(/^import webpush from "npm:web-push";$/m, 'const webpush = globalThis.__nep.webpush;')
if (/^import /m.test(js)) throw new Error('import niet vervangen')

const B = 'bbbbbbbb-0000-4000-8000-000000000002' // Bram komt online
const M = 'aaaaaaaa-0000-4000-8000-000000000001' // Marcel: schakelaar aan
const S = 'cccccccc-0000-4000-8000-000000000003' // Sanne: schakelaar uit
const E = 'eeeeeeee-0000-4000-8000-000000000004' // Eva: schakelaar aan, Engels
const V = 'dddddddd-0000-4000-8000-000000000005' // Vreemde: schakelaar aan, maar geen vriend
const iso = ms => new Date(ms).toISOString()
let NU = Date.UTC(2026, 10, 5, 14, 0, 0) // 15:00 in Nederland
const realNow = Date.now
Date.now = () => NU
let DB
function begin() {
  DB = {
    friendships: [[B, M], [M, B], [B, S], [S, B], [B, E], [E, B], [V, B]].map(([u, f]) => ({ user_id: u, friend_id: f, status: 'accepted' })),
    profiles: [
      { id: B, username: 'Bram', taal: 'nl', online_status: true, laatst_gezien: iso(NU - 10 * 1000), toon_online: true, geblokkeerd: false },
      { id: M, username: 'Marcel', taal: 'nl', online_status: false, laatst_gezien: iso(NU - 60 * 60 * 1000), toon_online: true, geblokkeerd: false },
      { id: S, username: 'Sanne', taal: 'nl', online_status: false, laatst_gezien: null, toon_online: true, geblokkeerd: false },
      { id: E, username: 'Eva', taal: 'en', online_status: false, laatst_gezien: null, toon_online: true, geblokkeerd: false },
      { id: V, username: 'Vreemd', taal: 'nl', online_status: false, laatst_gezien: null, toon_online: true, geblokkeerd: false },
    ],
    chat_instellingen: [{ gebruiker_id: M, melding_online: true }, { gebruiker_id: S, melding_online: false },
                        { gebruiker_id: E, melding_online: true }, { gebruiker_id: V, melding_online: true }],
    push_subscriptions: [M, S, E, V].map((u, i) => ({ id: 's' + i, user_id: u, subscription: { endpoint: u } })),
    online_meldingen: [],
  }
}
let verzonden = []
function tabel(naam) {
  let rijen = (DB[naam] || []).slice(), kolommen = '', invoeg = null, enkel = false
  const q = {
    select(k) { kolommen = k || ''; return q }, eq(k, v) { rijen = rijen.filter(r => r[k] === v); return q },
    in(k, l) { rijen = rijen.filter(r => l.includes(r[k])); return q }, gte(k, v) { rijen = rijen.filter(r => r[k] >= v); return q },
    order() { return q }, limit() { return q }, maybeSingle() { enkel = true; return q }, insert(r) { invoeg = r; return q }, delete() { return q },
    then(ok, f) {
      if (invoeg) { DB[naam].push({ ...invoeg, tijd: iso(NU) }); return Promise.resolve({ data: null, error: null }).then(ok, f) }
      let uit = rijen
      if (kolommen) { const ks = kolommen.split(',').map(x => x.trim()); uit = uit.map(r => Object.fromEntries(ks.map(k => [k, r[k]]))) }
      return Promise.resolve({ data: enkel ? (uit[0] || null) : uit, error: null }).then(ok, f)
    },
  }
  return q
}
globalThis.__nep = {
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) }, from: tabel }),
  webpush: { setVapidDetails() {}, async sendNotification(sub, payload, opties) { verzonden.push([sub.endpoint, JSON.parse(payload), opties]) } },
}
let handler
globalThis.Deno = { env: { get: k => 'x-' + k }, serve: h => { handler = h } }
const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
let fout = 0
async function online(id = B) {
  verzonden = []
  const res = await handler(new Request('https://x/functions/v1/stuur-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ online_id: id }) }))
  return { status: res.status, data: await res.json() }
}
function check(naam, ok, info) { if (!ok) fout++; console.log((ok ? 'OK   ' : 'FOUT ') + naam + (info && !ok ? ' | ' + JSON.stringify(info) : '')) }
const naar = () => verzonden.map(v => v[0]).sort()
const bram = () => DB.profiles.find(p => p.id === B)
const minuut = 60 * 1000

// 1. Bram komt online: Marcel en Eva (schakelaar aan, wederzijdse vrienden), niet Sanne (uit) en niet Vreemd (geen vriend)
begin(); let r = await online()
check('online: alleen vrienden met de schakelaar aan', r.status === 200 && JSON.stringify(naar()) === JSON.stringify([M, E].sort()), [r, naar()])
const nl = verzonden.find(v => v[0] === M), en = verzonden.find(v => v[0] === E)
check('tekst in de taal van de ontvanger', nl && nl[1].body === '🟢 Bram is nu online' && en && en[1].body === '🟢 Bram is online now', verzonden)
check('tag online, type online, tik opent de chat', nl[1].tag === 'online' && nl[1].type === 'online' && nl[1].url === '/Fibro/chat.html?vriend=' + B, nl[1])
check('korte levensduur (10 min) en lage urgentie', nl[2] && nl[2].TTL === 600 && nl[2].urgency === 'low', nl[2])

// 2. Bram gaat weg en komt na 40 minuten terug: geen tweede melding (zelfde vriend hoogstens eens per 3 uur)
NU += 40 * minuut; bram().laatst_gezien = iso(NU); r = await online()
check('zelfde vriend binnen 3 uur: geen melding', verzonden.length === 0 && r.data.reden === 'rustig houden', r)
// 3. na ruim 3 uur wel weer
NU += 3 * 60 * minuut; bram().laatst_gezien = iso(NU); r = await online()
check('na 3 uur: wel weer een melding', JSON.stringify(naar()) === JSON.stringify([M, E].sort()), naar())

// 4. hoogstens een online-melding per 20 minuten: een andere vriend (Sanne) komt 5 minuten later online
NU = Date.UTC(2026, 10, 5, 14, 0, 0); begin()
DB.chat_instellingen.find(c => c.gebruiker_id === S).melding_online = true
await online() // Marcel, Sanne en Eva krijgen 'Bram is online'
NU += 5 * minuut
Object.assign(DB.profiles.find(p => p.id === S), { online_status: true, laatst_gezien: iso(NU) })
DB.chat_instellingen.find(c => c.gebruiker_id === M).melding_online = true
DB.friendships.push({ user_id: S, friend_id: M, status: 'accepted' }, { user_id: M, friend_id: S, status: 'accepted' })
r = await online(S)
check('binnen 20 minuten na een andere online-melding: niets', verzonden.length === 0, [r, naar()])
NU += 20 * minuut; DB.profiles.find(p => p.id === S).laatst_gezien = iso(NU); r = await online(S)
check('na 20 minuten: Sanne online komt wel door', JSON.stringify(naar()) === JSON.stringify([M]), [r, naar()])

// 5. hoogstens 6 per dag
NU = Date.UTC(2026, 10, 5, 14, 0, 0); begin()
for (let i = 0; i < 6; i++) DB.online_meldingen.push({ ontvanger: M, vriend: 'x' + i, tijd: iso(NU - (60 + i * 30) * minuut) })
r = await online()
check('al 6 vandaag: Marcel niet meer, Eva wel', JSON.stringify(naar()) === JSON.stringify([E]), naar())

// 6. 's nachts niets (01:30 in Nederland)
NU = Date.UTC(2026, 10, 5, 0, 30, 0); begin(); r = await online()
check("'s nachts: geen meldingen", verzonden.length === 0, r)
check('uurInNederland: 0:30 UTC in november = 1 uur, in juli 14:00 UTC = 16 uur',
  mod.uurInNederland(Date.UTC(2026, 10, 5, 0, 30)) === 1 && mod.uurInNederland(Date.UTC(2026, 6, 1, 14, 0)) === 16)

// 7. zelf al online: dan zie je het al in Fibro
NU = Date.UTC(2026, 10, 5, 14, 0, 0); begin()
Object.assign(DB.profiles.find(p => p.id === M), { online_status: true, laatst_gezien: iso(NU - minuut) })
r = await online()
check('zelf al online: geen melding', JSON.stringify(naar()) === JSON.stringify([E]), naar())

// 8. Bram is niet (meer) online, maakte zich onzichtbaar, is geblokkeerd, of zijn laatste teken is oud
for (const [naam, wijzig] of [['niet online', { online_status: false }], ['onzichtbaar', { toon_online: false }],
  ['geblokkeerd', { geblokkeerd: true }], ['laatste teken oud', { laatst_gezien: iso(NU - 10 * minuut) }]]) {
  NU = Date.UTC(2026, 10, 5, 14, 0, 0); begin(); Object.assign(bram(), wijzig); r = await online()
  check(naam + ': geen melding', verzonden.length === 0 && DB.online_meldingen.length === 0, r)
}

// 9. vriendschap maar van een kant (bijvoorbeeld net geblokkeerd): geen melding
begin(); DB.friendships = DB.friendships.filter(f => !(f.user_id === M && f.friend_id === B)); r = await online()
check('vriendschap van een kant: geen melding', JSON.stringify(naar()) === JSON.stringify([E]), naar())

// 10. onzin en de app mag 'online' niet zelf vragen
begin(); r = await online("x' or 1=1")
const res = await handler(new Request('https://x/functions/v1/stuur-push', { method: 'POST', headers: { Authorization: 'Bearer x' }, body: JSON.stringify({ receiver_id: M, type: 'online' }) }))
check('onzin-id 400; app kan online niet zelf sturen', r.status === 400 && res.status !== 200 && verzonden.length === 0, r)

// 11. het logboek: per ontvanger een regel, zodat de regels de volgende keer werken
begin(); await online()
check('logboek: een regel per ontvanger', DB.online_meldingen.length === 2 && DB.online_meldingen.every(l => l.vriend === B))

Date.now = realNow
console.log(fout ? fout + ' FOUT' : 'ALLES GOED')
process.exit(fout ? 1 : 0)
