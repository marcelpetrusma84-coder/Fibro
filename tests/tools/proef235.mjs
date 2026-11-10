// proef235 (3 nov 2026): stuur-push v258, makkelijker contact. Twee meldingen die alleen van de server komen
// (triggers in sql/contact-push.sql), met alleen een id:
//  - 'vriend-nieuw' { invite_id }: wie de uitnodiging maakte hoort "<naam> heeft je uitnodiging aangenomen! Zeg hoi",
//    een tik opent de chat met de nieuwe vriend. Alleen als de uitnodiging net gebruikt is en jullie vrienden zijn.
//  - 'gastenboek' { gastenboek_id }: "<naam> schreef in je gastenboek". Niet je eigen gastenboek, niet als dezelfde
//    vriend de laatste 10 minuten al schreef, en elke rij maar een keer.
//  - 'like' { like_id } (4 nov): "<emoji> <naam> reageerde op je foto/nummer/video", dezelfde vriend hoogstens een per
//    10 minuten bij dezelfde eigenaar, alleen een geldige emoji en soort, alleen tussen vrienden.
// Een app kan deze meldingen niet zelf sturen (receiver_id + type): dan 400. proef233 (spellen) blijft ook slagen.
// node proef235.mjs [supabase/functions/stuur-push/index.ts] [map met node_modules]
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
  console.log('proef235: OVERGESLAGEN - typescript 5 niet gevonden. Zo draai je hem wel: npm install typescript@5 in een map,')
  console.log('  dan: node tests/tools/proef235.mjs supabase/functions/stuur-push/index.ts <die map>')
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
  messages: [], push_log: [], invite_tokens: [], guestbook_entries: [], profiel_likes: [],
}
let verzonden = []
function tabel(naam) {
  let rijen = (DB[naam] || []).slice(), beperk = null, kolommen = '', invoeg = null, enkel = false, volg = null
  const q = {
    select(k) { kolommen = k || ''; return q }, eq(k, v) { rijen = rijen.filter(r => r[k] === v); return q },
    in(k, l) { rijen = rijen.filter(r => l.includes(r[k])); return q }, gte(k, v) { rijen = rijen.filter(r => r[k] >= v); return q },
    lte(k, v) { rijen = rijen.filter(r => r[k] <= v); return q }, neq(k, v) { rijen = rijen.filter(r => r[k] !== v); return q },
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
const U = n => '11111111-0000-4000-8000-' + String(n).padStart(12, '0')
const uitnodiging = (n, maker, gebruiker, tijd = nu()) => { DB.invite_tokens.push({ id: U(n), created_by: maker, used_by: gebruiker, used_at: gebruiker ? tijd : null }); return U(n) }
const gastenboek = (n, profiel, schrijver, tijd = nu()) => { DB.guestbook_entries.push({ id: U(100 + n), profile_id: profiel, author_id: schrijver, created_at: tijd }); return U(100 + n) }

// 1. Bram nam de uitnodiging van Marcel aan: Marcel (Nederlands) krijgt de melding, tik = chat met Bram
verzonden = []
let id = uitnodiging(1, A, B)
let r = await vraag({ invite_id: id })
const p1 = verzonden[0] && verzonden[0][1]
check('nieuwe vriend: melding naar wie uitnodigde', r.status === 200 && verzonden.length === 1 && verzonden[0][0] === 'a1', [r, verzonden])
check('nieuwe vriend: tekst met naam', p1 && p1.body === '🎉 Bram heeft je uitnodiging aangenomen! Zeg hoi 👋' && p1.type === 'vriend-nieuw', p1)
check('nieuwe vriend: tik opent de chat met de nieuwe vriend', p1 && p1.url === '/Fibro/chat.html?vriend=' + B && p1.tag === 'vriend-' + B, p1)
verzonden = []; r = await vraag({ invite_id: id })
check('nieuwe vriend: maar een keer', verzonden.length === 0 && r.data.reden === 'al verstuurd', r)
// 2. Engels: Marcel nam een uitnodiging van Bram aan
verzonden = []; await vraag({ invite_id: uitnodiging(2, B, A) })
check('nieuwe vriend: Engels', verzonden[0] && verzonden[0][1].body === '🎉 Marcel accepted your invite! Say hi 👋', verzonden)
// 3. niet gebruikt, te oud, onbekend, geen vrienden, geblokkeerd: niets
verzonden = []
const r3 = [await vraag({ invite_id: uitnodiging(3, A, null) }), await vraag({ invite_id: uitnodiging(4, A, B, oud()) }),
            await vraag({ invite_id: U(99) }), await vraag({ invite_id: uitnodiging(5, A, C) }), await vraag({ invite_id: uitnodiging(6, B, G) }),
            await vraag({ invite_id: 'geen-id' })]
check('nieuwe vriend: alleen bij een echte, verse uitnodiging tussen vrienden', verzonden.length === 0 &&
  r3[0].status === 404 && r3[1].data.reden === 'te oud' && r3[2].status === 404 && r3[3].status === 403 && r3[4].status === 403 && r3[5].status === 400, r3.map(x => [x.status, x.data.reden]))

// 4. gastenboek: Marcel schrijft bij Bram (Engels), tik = beginscherm (daar staat je gastenboek)
verzonden = []
id = gastenboek(1, B, A)
r = await vraag({ gastenboek_id: id })
const p4 = verzonden[0] && verzonden[0][1]
check('gastenboek: melding naar de eigenaar', r.status === 200 && verzonden.length === 1 && verzonden[0][0] === 'b1', [r, verzonden])
check('gastenboek: tekst en tik', p4 && p4.body === '📖 Marcel wrote in your guestbook' && p4.url === '/Fibro/index.html' && p4.tag === 'gastenboek-' + A && p4.type === 'gastenboek', p4)
verzonden = []; r = await vraag({ gastenboek_id: id })
check('gastenboek: elk bericht maar een keer', verzonden.length === 0 && r.data.reden === 'al verstuurd', r)
// 5. meteen nog een bericht van Marcel: rustig aan (10 minuten); van Bram bij Marcel wel (Nederlands)
verzonden = []; r = await vraag({ gastenboek_id: gastenboek(2, B, A) })
check('gastenboek: niet opnieuw binnen 10 minuten van dezelfde vriend', verzonden.length === 0 && r.data.reden === 'net al gemeld', r)
verzonden = []; await vraag({ gastenboek_id: gastenboek(3, A, B) })
check('gastenboek: Nederlands', verzonden[0] && verzonden[0][1].body === '📖 Bram schreef in je gastenboek', verzonden)
// 6. in je eigen gastenboek, oud, onbekend, geen vrienden: niets
verzonden = []
const r6 = [await vraag({ gastenboek_id: gastenboek(4, A, A) }), await vraag({ gastenboek_id: gastenboek(5, A, C, oud()) }),
            await vraag({ gastenboek_id: U(98) }), await vraag({ gastenboek_id: gastenboek(6, B, C) })]
check('gastenboek: niet eigen, oud, onbekend of van een niet-vriend', verzonden.length === 0 &&
  r6[0].data.reden === 'geen melding nodig' && r6[1].data.reden === 'te oud' && r6[2].status === 404 && r6[3].status === 403, r6.map(x => [x.status, x.data.reden]))

// 7. een app kan deze meldingen niet zelf sturen
verzonden = []
const r7 = [await vraag({ receiver_id: B, type: 'vriend-nieuw' }, 'pas-a'), await vraag({ receiver_id: B, type: 'gastenboek' }, 'pas-a'), await vraag({ receiver_id: B, type: 'spel' }, 'pas-a')]
check('vriend-nieuw, gastenboek en spel niet vanuit de app', verzonden.length === 0 && r7.every(x => x.status === 400), r7.map(x => [x.status, x.data.reden]))
// 9. likes (sql/profiel-likes.sql): Bram vindt een foto van Marcel leuk
const like = (n, eigenaar, liker, soort, emoji, tijd = nu()) => { DB.profiel_likes.push({ id: U(200 + n), eigenaar, liker, soort, item: 'abc' + n, emoji, created_at: tijd }); return U(200 + n) }
verzonden = []
id = like(1, A, B, 'foto', '❤️')
r = await vraag({ like_id: id })
const p9 = verzonden[0] && verzonden[0][1]
check('like: melding naar de eigenaar, met emoji en wat', r.status === 200 && verzonden.length === 1 && verzonden[0][0] === 'a1' && p9.body === '❤️ Bram reageerde op je foto'
  && p9.url === '/Fibro/index.html' && p9.tag === 'like-' + B && p9.type === 'like', [r, p9])
verzonden = []; r = await vraag({ like_id: id })
check('like: elke like maar een keer', verzonden.length === 0 && r.data.reden === 'al verstuurd', r)
verzonden = []; r = await vraag({ like_id: like(2, A, B, 'video', '🔥') })
check('like: dezelfde vriend binnen 10 minuten nog een like: geen nieuwe melding', verzonden.length === 0 && r.data.reden === 'net al gemeld', r)
verzonden = []; await vraag({ like_id: like(3, B, A, 'muziek', '😂') })
check('like: Engels, nummer', verzonden[0] && verzonden[0][1].body === '😂 Marcel reacted to your song', verzonden)
verzonden = []
const r10 = [await vraag({ like_id: like(4, A, C, 'foto', '❤️') }), await vraag({ like_id: like(5, B, A, 'foto', '💩') }), await vraag({ like_id: like(6, B, A, 'sticker', '❤️') }),
             await vraag({ like_id: like(7, A, B, 'foto', '❤️', oud()) }), await vraag({ like_id: U(299) }), await vraag({ receiver_id: B, type: 'like' }, 'pas-a')]
check('like: geen vrienden, rare emoji of soort, oud, onbekend, of vanuit de app: niets', verzonden.length === 0 &&
  r10[0].status === 403 && r10[1].status === 400 && r10[2].status === 400 && r10[3].data.reden === 'te oud' && r10[4].status === 404 && r10[5].status === 400, r10.map(x => [x.status, x.data.reden]))

// 8. berichten zoals vroeger
verzonden = []; DB.messages.push({ id: M(1), sender_id: A, receiver_id: B, content: 'e2e:v2:q', created_at: nu() })
await vraag({ message_id: M(1) })
check('bericht ongewijzigd', verzonden.length === 1 && verzonden[0][1].type === 'bericht' && !('tag' in verzonden[0][1]), verzonden)
console.log(fout ? fout + ' FOUT' : 'ALLES GOED')
process.exit(fout ? 1 : 0)
