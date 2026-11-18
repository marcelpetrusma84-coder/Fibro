// proef314 (18 nov 2026, Marcel): stuur-push, de melding bij een vriendverzoek uit een groepschat (sql/vriendverzoek-push.sql):
// { vriendverzoek_id } van de trigger. Alleen een open, vers verzoek; niet bij een blokkade of geblokkeerd account, niet als
// 'Vrienden' uit staat in Pushmeldingen; hoogstens een keer per verzoek; in de taal van de ontvanger; niet vanuit de app.
// (Harnas uit proef233.) node proef314.mjs [index.ts] [map met node_modules]
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
  console.log('proef314: OVERGESLAGEN - typescript 5 niet gevonden. Zo draai je hem wel: npm install typescript@5 in een map,')
  console.log('  dan: node tests/tools/proef314.mjs supabase/functions/stuur-push/index.ts <die map>')
  process.exit(0)
}
const bron = fs.readFileSync(process.argv[2] || path.join(REPO, 'supabase/functions/stuur-push/index.ts'), 'utf8')
let js = ts.transpileModule(bron, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m, 'const { createClient } = globalThis.__nep;')
       .replace(/^import webpush from "npm:web-push(@[0-9.]+)?";.*$/m, 'const webpush = globalThis.__nep.webpush;')
if (/^import /m.test(js)) throw new Error('import niet vervangen')



const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002', G = 'gggggggg-0000-4000-8000-000000000003', C = 'cccccccc-0000-4000-8000-000000000004'
const nu = () => new Date().toISOString(), oud = () => new Date(Date.now() - 5 * 60 * 1000).toISOString()
const V = n => '11111111-0000-4000-8000-' + String(n).padStart(12, '0')
const DB = {
  tokens: { 'pas-a': A },
  friendships: [],
  profiles: [{ id: A, username: 'Lotte', taal: 'nl', geblokkeerd: false }, { id: B, username: 'Bram', taal: 'en', geblokkeerd: false },
             { id: G, username: 'Gerrit', taal: 'nl', geblokkeerd: true }, { id: C, username: 'Cor', taal: 'nl', geblokkeerd: false }],
  push_subscriptions: [{ id: 's1', user_id: B, subscription: { endpoint: 'b1' } }, { id: 's2', user_id: C, subscription: { endpoint: 'c1' } },
                       { id: 's3', user_id: A, subscription: { endpoint: 'a1' } }],
  vriendverzoeken: [], mijn_blokkades: [], chat_instellingen: [], push_log: [],
}
let verzonden = []
function tabel(naam) {
  let rijen = (DB[naam] || []).slice(), beperk = null, kolommen = '', invoeg = null, enkel = false, volg = null
  const q = {
    select(k) { kolommen = k || ''; return q }, eq(k, v) { rijen = rijen.filter(r => r[k] === v); return q },
    in(k, l) { rijen = rijen.filter(r => l.includes(r[k])); return q }, gte(k, v) { rijen = rijen.filter(r => r[k] >= v); return q },
    order(k, o) { volg = [k, o && o.ascending === false ? -1 : 1]; return q }, limit(n) { beperk = n; return q },
    maybeSingle() { enkel = true; return q }, insert(r) { invoeg = r; return q }, delete() { return q },
    like(k, patroon) { const re = new RegExp('^' + patroon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); rijen = rijen.filter(r => re.test(r[k])); return q },
    or(expr) { const groepen = [...expr.matchAll(/and\(([^)]+)\)/g)].map(m => m[1].split(',').map(d => d.split('.eq.'))); rijen = rijen.filter(r => groepen.some(g => g.every(([k, v]) => r[k] === v))); return q },
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

const verzoek = (n, van, naar, extra = {}) => { DB.vriendverzoeken.push({ id: V(n), van, naar, status: 'open', created_at: nu(), ...extra }); return V(n) }
// 1. Lotte vraagt Bram (Engels): "👋 Lotte wants to be friends", tik opent Vrienden, tag per vrager
verzonden = []
let id = verzoek(1, A, B), r = await vraag({ vriendverzoek_id: id })
const p1 = verzonden[0] && verzonden[0][1]
check('verzoek: melding naar Bram, in het Engels', r.status === 200 && verzonden.length === 1 && verzonden[0][0] === 'b1' && p1.body === '👋 Lotte wants to be friends', [r, verzonden])
check('verzoek: tik opent Vrienden, type en tag', p1 && p1.url === '/Fibro/vrienden.html' && p1.type === 'vriendverzoek' && p1.tag === 'vriendverzoek-' + A, p1)
verzonden = []; r = await vraag({ vriendverzoek_id: id })
check('verzoek: maar één melding', verzonden.length === 0 && r.data.reden === 'al verstuurd', r)
// 2. Nederlands voor Cor
verzonden = []; await vraag({ vriendverzoek_id: verzoek(2, A, C) })
check('verzoek: Nederlands', verzonden[0] && verzonden[0][1].body === '👋 Lotte wil vrienden worden', verzonden)
// 3. geen melding: al beantwoord, te oud, blokkade, geblokkeerd account, 'Vrienden' uitgezet, onzin-id
verzonden = []
const res = [
  await vraag({ vriendverzoek_id: verzoek(3, C, B, { status: 'nee' }) }),
  await vraag({ vriendverzoek_id: verzoek(4, C, B, { created_at: oud() }) }),
  await vraag({ vriendverzoek_id: verzoek(6, G, B) }),
]
DB.mijn_blokkades.push({ blokkeerder_id: B, geblokkeerde_id: C }); res.push(await vraag({ vriendverzoek_id: verzoek(5, C, B) }))
DB.chat_instellingen.push({ gebruiker_id: A, push_uit: ['vriend'] }); res.push(await vraag({ vriendverzoek_id: verzoek(7, C, A) }))
res.push(await vraag({ vriendverzoek_id: 'kapot' }))
check('geen melding bij: beantwoord, oud, geblokkeerd account, blokkade, uitgezet, onzin', verzonden.length === 0, res.map(x => x.status + ' ' + x.data.reden))
check('redenen kloppen', JSON.stringify(res.map(x => x.data.reden)) === JSON.stringify(['geen open verzoek', 'te oud', 'geblokkeerd', 'blokkade', 'uitgezet', 'ongeldig verzoek']), res.map(x => x.data.reden))
// 4. de app kan 'vriendverzoek' niet zelf als type vragen (alleen de server)
verzonden = []; r = await vraag({ receiver_id: B, type: 'vriendverzoek' }, 'pas-a')
check('alleen vanaf de server', r.status === 400 && !verzonden.length, r)
console.log('\n' + (fout ? fout + ' FOUT(EN)' : 'ALLES GOED')); process.exit(fout ? 1 : 0)
