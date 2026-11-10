// proef233 (3 nov 2026): stuur-push v257, meldingen voor spellen: 'spel' (uitnodiging, via het id van het
// uitnodigingsbericht), 'spel-gemist' en 'spel-verlaten' (met inlogpas, alleen als er echt een uitnodiging was).
// (Gebaseerd op proef233:) stuur-push v256, de melding bij een nieuw bericht komt van de server (trigger op messages,
// sql/push-vanaf-server.sql) met { message_id }. Elk bericht hoogstens EEN melding (push_log is het slot), ook als de
// trigger, de nieuwe app (ook met message_id) en een oude app (receiver_id + inlogpas) allemaal vragen.
// Zonder inlogpas: alleen voor een bestaand bericht van minder dan 2 minuten; afzender/ontvanger uit het bericht.
// Speluitnodigingen en belregels krijgen geen berichtmelding. proef46 en proef233 moeten ook nog slagen.
// Nodig: typescript (npm install typescript) in <map met node_modules>.
// node proef233.mjs <supabase/functions/stuur-push/index.ts> <map met node_modules>
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
  console.log('proef233: OVERGESLAGEN - typescript 5 niet gevonden. Zo draai je hem wel: npm install typescript@5 in een map,')
  console.log('  dan: node tests/tools/proef233.mjs supabase/functions/stuur-push/index.ts <die map>')
  process.exit(0)
}
const bron = fs.readFileSync(process.argv[2] || path.join(REPO, 'supabase/functions/stuur-push/index.ts'), 'utf8')
let js = ts.transpileModule(bron, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m, 'const { createClient } = globalThis.__nep;')
       .replace(/^import webpush from "npm:web-push(@[0-9.]+)?";.*$/m, 'const webpush = globalThis.__nep.webpush;')
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
    like(k, patroon) { const re = new RegExp('^' + patroon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); rijen = rijen.filter(r => re.test(r[k])); return q },
    or(expr) { const paren = [...expr.matchAll(/and\(sender_id\.eq\.([^,]+),receiver_id\.eq\.([^)]+)\)/g)].map(m => [m[1], m[2]]); rijen = rijen.filter(r => paren.some(([a, b]) => r.sender_id === a && r.receiver_id === b)); return q },
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


// 1. uitnodiging via het id van het bericht: Engels voor Bram, tik opent het spel, 2 minuten, tag spel-<afzender>
verzonden = []; const sessie = 'ab12cd'
let id = bericht(1, A, B, 'spelinvite:dammen:' + A + ':' + sessie)
let r = await vraag({ message_id: id })
const p1 = verzonden[0] && verzonden[0][1]
check('uitnodiging: Engels, met naam en spel', r.status === 200 && p1 && p1.body === '🎮 Marcel challenges you to Draughts!' && p1.type === 'spel', [r, p1])
check('uitnodiging: tik opent het spel', p1 && p1.url === '/Fibro/chat.html?spelVriend=' + A + '&spelType=dammen&sessieId=' + sessie + '&starterId=' + A, p1 && p1.url)
check('uitnodiging: tag spel-<afzender>', p1 && p1.tag === 'spel-' + A)
verzonden = []; r = await vraag({ message_id: id })
check('uitnodiging: maar één keer', verzonden.length === 0 && r.data.reden === 'al verstuurd', r)
// 2. schaken in het Nederlands
verzonden = []; await vraag({ message_id: bericht(2, B, A, 'spelinvite:schaken:' + B + ':s1') })
check('uitnodiging schaken: Nederlands', verzonden[0] && verzonden[0][1].body === '🎮 Bram daagt je uit voor Schaken!', verzonden)
// 3. onzin in een uitnodiging: geen melding
verzonden = []
const rr = [await vraag({ message_id: bericht(3, A, B, 'spelinvite:bestaatniet:' + A + ':s1') }),
            await vraag({ message_id: bericht(4, A, B, 'spelinvite:dammen:' + B + ':s1') }),
            await vraag({ message_id: bericht(5, A, B, 'spelinvite:dammen:' + A + ':<script>') })]
check('onbekend spel, verkeerde afzender of rare sessie: geen melding', verzonden.length === 0, rr.map(x => x.data.reden))
// 4. gemiste uitnodiging (Marcel nodigde Bram uit, bericht 1): Bram krijgt hem, zelfde tag, opent de chat
verzonden = []; r = await vraag({ receiver_id: B, type: 'spel-gemist', spel: 'dammen' }, 'pas-a')
const p4 = verzonden[0] && verzonden[0][1]
check('gemist: melding met naam en spel', p4 && p4.body === '🎮 Marcel wanted to play Draughts with you' && p4.tag === 'spel-' + A && p4.url === '/Fibro/chat.html?vriend=' + A, [r, p4])
// 5. gemist zonder uitnodiging (Bram nodigde Marcel nooit uit voor pong): geweigerd
verzonden = []; r = await vraag({ receiver_id: A, type: 'spel-gemist', spel: 'pong' }, 'pas-b')
check('gemist zonder uitnodiging: geweigerd', r.status === 403 && !verzonden.length, r)
// 6. gemist van de verkeerde kant (Bram had Marcel niet voor dammen uitgenodigd): geweigerd
verzonden = []; r = await vraag({ receiver_id: A, type: 'spel-gemist', spel: 'dammen' }, 'pas-b')
check('gemist: alleen wie uitnodigde', r.status === 403 && !verzonden.length, r)
// 7. verlaten: wie ook uitnodigde, beide kanten mogen
verzonden = []; r = await vraag({ receiver_id: A, type: 'spel-verlaten', spel: 'dammen' }, 'pas-b')
const p7 = verzonden[0] && verzonden[0][1]
check('verlaten: melding (Nederlands)', p7 && p7.body === '🎮 Bram heeft jullie spel Draughts verlaten' && p7.tag === 'spel-' + B, [r, p7])
// 8. verlaten zonder spel, en een oude uitnodiging (5 uur geleden)
bericht(6, A, B, 'spelinvite:vieroprij:' + A + ':s9', new Date(Date.now() - 5 * 3600 * 1000).toISOString())
verzonden = []; const r8 = [await vraag({ receiver_id: B, type: 'spel-verlaten', spel: 'pong' }, 'pas-a'), await vraag({ receiver_id: B, type: 'spel-verlaten', spel: 'vieroprij' }, 'pas-a')]
check('verlaten zonder (recent) spel: geweigerd', r8.every(x => x.status === 403) && !verzonden.length, r8)
// 9. zonder inlogpas, onbekend spel, of 'spel' zonder bericht
verzonden = []; const r9 = [await vraag({ receiver_id: B, type: 'spel-verlaten', spel: 'dammen' }), await vraag({ receiver_id: B, type: 'spel-gemist', spel: 'x' }, 'pas-a'), await vraag({ receiver_id: B, type: 'spel' }, 'pas-a')]
check('zonder pas 401, onbekend spel 400, spel zonder bericht 400', r9[0].status === 401 && r9[1].status === 400 && r9[2].status === 400 && !verzonden.length, r9.map(x => x.status))
// 10. berichten en bellen zoals vroeger
verzonden = []; await vraag({ message_id: bericht(7, A, B, 'e2e:v2:q') }); await vraag({ receiver_id: B, type: 'oproep' }, 'pas-a')
check('bericht en oproep ongewijzigd', verzonden.length === 2 && verzonden[0][1].type === 'bericht' && verzonden[1][1].type === 'oproep' && !('tag' in verzonden[0][1]))
console.log(fout ? fout + ' FOUT' : 'ALLES GOED')
process.exit(fout ? 1 : 0)
