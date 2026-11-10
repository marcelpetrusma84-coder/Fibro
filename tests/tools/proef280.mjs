// proef280 (10 nov 2026): stuur-push - een pushmelding bij een nieuw bericht in een groep ({ groep_bericht_id }, van de
// trigger in sql/groep-extra.sql).
//  - alle leden behalve de afzender, in hun eigen taal, zonder naam of inhoud; een tik opent de groep; tag per groep
//  - een 'stil' bericht (reactie, weggehaald) geeft niets; een oud bericht niets; elk bericht hoogstens een keer
//  - een geblokkeerde afzender niets
// Draait index.ts met een nep-database (zoals proef266). Zonder typescript: OVERGESLAGEN.
// node tests/tools/proef280.mjs [supabase/functions/stuur-push/index.ts] [map met node_modules]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
let ts = null
for (const m of [process.argv[3], REPO, path.dirname(REPO), '.'].filter(Boolean)) {
  try { const t = createRequire(path.join(path.resolve(m), 'x.js'))('typescript'); if (t && t.ScriptTarget) { ts = t; break } } catch (e) {}
}
if (!ts) {
  console.log('proef280: OVERGESLAGEN - typescript 5 niet gevonden (npm install typescript@5).')
  process.exit(0)
}
const bron = fs.readFileSync(process.argv[2] || path.join(REPO, 'supabase/functions/stuur-push/index.ts'), 'utf8')
let js = ts.transpileModule(bron, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m, 'const { createClient } = globalThis.__nep;')
       .replace(/^import webpush from "npm:web-push(@[0-9.]+)?";.*$/m, 'const webpush = globalThis.__nep.webpush;')
if (/^import /m.test(js)) throw new Error('import niet vervangen')

const M = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002', L = 'cccccccc-0000-4000-8000-000000000003', X = 'dddddddd-0000-4000-8000-000000000004'
const G = '99999999-9999-4999-8999-999999999999', BID = '11111111-2222-4333-8444-555555555555'
const iso = ms => new Date(ms).toISOString()
let NU = Date.UTC(2026, 10, 10, 14, 0, 0)
Date.now = () => NU
let DB
function begin(extra = {}) {
  DB = {
    profiles: [{ id: M, taal: 'nl', geblokkeerd: false }, { id: B, taal: 'nl', geblokkeerd: false }, { id: L, taal: 'en', geblokkeerd: false }, { id: X, taal: 'nl', geblokkeerd: false }],
    groep_leden: [M, B, L].map(u => ({ groep_id: G, user_id: u })),
    groep_berichten: [{ id: BID, groep_id: G, sender_id: M, stil: false, created_at: iso(NU - 5000), ...extra }],
    push_subscriptions: [M, B, L, X].map((u, i) => ({ id: 's' + i, user_id: u, subscription: { endpoint: u } })),
    push_log: [],
  }
}
let verzonden = []
function tabel(naam) {
  let rijen = (DB[naam] || []).slice(), kolommen = '', invoeg = null, enkel = false
  const q = {
    select(k) { kolommen = k || ''; return q }, eq(k, v) { rijen = rijen.filter(r => r[k] === v); return q },
    in(k, l) { rijen = rijen.filter(r => l.includes(r[k])); return q }, gte() { return q },
    order() { return q }, limit() { return q }, maybeSingle() { enkel = true; return q }, insert(r) { invoeg = r; return q }, delete() { return q },
    then(ok, f) {
      if (invoeg) {
        if (naam === 'push_log' && DB.push_log.some(p => p.message_id === invoeg.message_id)) return Promise.resolve({ data: null, error: { code: '23505' } }).then(ok, f)
        DB[naam].push({ ...invoeg }); return Promise.resolve({ data: null, error: null }).then(ok, f)
      }
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
await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
let fout = 0
function check(naam, ok, info) { if (!ok) fout++; console.log((ok ? 'OK   ' : 'FOUT ') + naam + (info && !ok ? ' | ' + JSON.stringify(info) : '')) }
async function push(id = BID) {
  verzonden = []
  const res = await handler(new Request('https://x/functions/v1/stuur-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groep_bericht_id: id }) }))
  return { status: res.status, data: await res.json() }
}
const naar = () => verzonden.map(v => v[0]).sort()

begin(); let r = await push()
check('leden behalve de afzender, geen niet-lid', r.status === 200 && JSON.stringify(naar()) === JSON.stringify([B, L].sort()), [r, naar()])
const nl = verzonden.find(v => v[0] === B), en = verzonden.find(v => v[0] === L)
check('tekst zonder naam of inhoud, in de taal van de ontvanger', nl && nl[1].body === 'Nieuw bericht in een groep 👥' && en && en[1].body === 'New message in a group 👥', verzonden)
check('tik opent de groep, tag per groep', nl[1].url === '/Fibro/groep.html?id=' + G && nl[1].tag === 'groep-' + G && nl[1].type === 'groep', nl[1])
r = await push()
check('hoogstens een keer per bericht', verzonden.length === 0 && r.data.reden === 'al verstuurd', r)
begin({ stil: true }); r = await push()
check('stil bericht (reactie): niets', verzonden.length === 0 && r.data.reden === 'geen melding nodig', r)
begin({ created_at: iso(NU - 10 * 60 * 1000) }); r = await push()
check('oud bericht: niets', verzonden.length === 0 && r.data.reden === 'te oud', r)
begin(); DB.profiles[0].geblokkeerd = true; r = await push()
check('geblokkeerde afzender: niets', verzonden.length === 0 && r.status === 403, r)
begin(); r = await push('geen-uuid')
check('ongeldig id: 400', r.status === 400, r)
console.log(fout ? '\n' + fout + ' FOUT(EN)' : '\nALLES GOED')
process.exit(fout ? 1 : 0)
