// v274: het groene bolletje bij een vriend, nauwkeuriger (onlinestip.js). Met een nep live verbinding (paren.js) en
// een nep server: komt online, zet de app weg, gaat naar een spel (alleen het seintje), telefoon valt uit, helemaal offline.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const map = mkdtempSync(join(tmpdir(), 'online-'))
writeFileSync(join(map, 'nep-paren.mjs'), `
export const kamer = new Map(); export const luisteraars = new Set(); export const eigen = {}
export function startParen() {}
export function isOnline(id) { return kamer.has(id) }
export function heeftKenmerk(id, n) { return kamer.has(id) && kamer.get(id)[n] === true }
export function opOnline(fn) { luisteraars.add(fn) }
export function zetKenmerk(n, w) { if (w === undefined) delete eigen[n]; else eigen[n] = w }
export function roep(w) { for (const fn of luisteraars) fn(w) }`)
writeFileSync(join(map, 'nep-supa.mjs'), `
export const server = new Map(); export const vragen = []
export const supabase = { from: () => ({ select: () => ({ in: (k, ids) => { vragen.push(ids); return Promise.resolve({ data: ids.filter(i => server.has(i)).map(i => ({ id: i, ...server.get(i) })), error: null }) } }) }) }`)
writeFileSync(join(map, 'o.mjs'), lees('onlinestip.js')
  .replace(/from '\.\/paren\.js\?v=2'/, "from './nep-paren.mjs'").replace(/from '\.\/supabase\.js\?v=95'/, "from './nep-supa.mjs'"))

// nep browser: tijd, timers en zichtbaarheid in eigen hand
let nu = Date.parse('2026-11-06T14:00:00Z')
const timers = []
globalThis.Date.now = () => nu
globalThis.setTimeout = (fn, ms) => { timers.push({ t: nu + (ms || 0), fn }); return timers.length }
globalThis.clearTimeout = () => {}
globalThis.setInterval = (fn, ms) => { const herhaal = () => { fn(); timers.push({ t: nu + ms, fn: herhaal }) }; timers.push({ t: nu + ms, fn: herhaal }); return 1 }
const ls = new Map()
globalThis.localStorage = { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)) }
const docLuist = []
globalThis.document = { hidden: false, addEventListener: (n, fn) => docLuist.push(fn) }
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
async function wacht(ms) {
  const tot = nu + ms
  for (;;) {
    timers.sort((a, b) => a.t - b.t)
    const v = timers[0]
    if (!v || v.t > tot) break
    timers.shift(); nu = Math.max(nu, v.t); v.fn()
    await new Promise(r => setImmediate(r))
  }
  nu = tot
  await new Promise(r => setImmediate(r))
}
const iso = t => new Date(t).toISOString()

const P = await import(pathToFileURL(join(map, 'nep-paren.mjs')).href)
const S = await import(pathToFileURL(join(map, 'nep-supa.mjs')).href)
const O = await import(pathToFileURL(join(map, 'o.mjs')).href)

// ── de regel ──
const R = O.beslisOnline
const vers = { online_status: true, laatst: nu - 60000 }
assert.equal(R({ nu, live: true, server: null }), true, 'live in de app: groen, ook zonder server')
assert.equal(R({ nu, live: true, stil: true, server: vers }), false, 'helemaal offline: grijs')
assert.equal(R({ nu, verborgen: true, server: vers }), false, 'app weggezet: meteen grijs')
assert.equal(R({ nu, server: vers }), true, 'alleen het seintje (in een spel of gesprek): groen')
assert.equal(R({ nu, server: { online_status: true, laatst: nu - 5 * 60000 } }), false, 'seintje 5 minuten oud: grijs')
assert.equal(R({ nu, server: { online_status: false, laatst: nu } }), false, 'server zegt offline')
assert.equal(R({ nu, server: vers, wegOp: nu - 1000 }), false, 'uit de live verbinding en daarna geen seintje: weg (telefoon uit)')
assert.equal(R({ nu, server: { online_status: true, laatst: nu - 2000 }, wegOp: nu - 8000 }), true, 'na het verlaten nog een seintje: in een spel')

// ── met de nep verbinding ──
let getekend = 0
const BRAM = 'b1', KIM = 'k1'
O.volgOnline('ik', () => [BRAM, KIM], () => { getekend++ })
assert.deepEqual(P.eigen, { actief: true }, 'je laat zelf zien dat je de app in beeld hebt')
S.server.set(BRAM, { online_status: false, laatst_gezien: iso(nu - 3600000) })
S.server.set(KIM, { online_status: false, laatst_gezien: iso(nu - 3600000) })
await wacht(2000)
assert.equal(S.vragen.length, 1, 'bij het begin een keer de server')
assert.equal(O.isVriendOnline(BRAM), false)

// Bram opent Stekky: binnen een paar seconden groen
P.kamer.set(BRAM, { actief: true }); P.roep({ id: BRAM, online: true })
await wacht(100)
assert.equal(O.isVriendOnline(BRAM), true, 'Bram komt online: meteen groen')
assert.ok(getekend > 0, 'en de pagina tekent opnieuw')

// Bram zet de app weg (andere app, telefoon op slot): meteen grijs
P.kamer.set(BRAM, { verborgen: true }); P.roep({ id: BRAM, online: true, gelijk: true })
assert.equal(O.isVriendOnline(BRAM), false, 'app weggezet: grijs')
P.kamer.set(BRAM, { actief: true }); P.roep({ id: BRAM, online: true, gelijk: true })
assert.equal(O.isVriendOnline(BRAM), true, 'weer terug: groen')

// Bram opent een spel: weg uit de live verbinding, maar het spel stuurt het seintje
const voor = S.vragen.length
P.kamer.delete(BRAM); P.roep({ id: BRAM, online: false })
await wacht(1000)
S.server.set(BRAM, { online_status: true, laatst_gezien: iso(nu) })
await wacht(6000)
assert.equal(S.vragen.length, voor + 1, 'na het verlaten een keer de server')
assert.deepEqual(S.vragen.at(-1), [BRAM], 'alleen voor Bram')
assert.equal(O.isVriendOnline(BRAM), true, 'in een spel: nog steeds groen')
await wacht(4 * 60000)                       // het seintje blijft komen
S.server.set(BRAM, { online_status: true, laatst_gezien: iso(nu) })
await wacht(2 * 60000)
assert.equal(O.isVriendOnline(BRAM), true, 'lang in een spel: groen (elke 2 minuten opnieuw gevraagd)')

// Kim was live, haar telefoon valt uit: de verbinding valt weg, geen nieuw seintje meer
P.kamer.set(KIM, { actief: true }); P.roep({ id: KIM, online: true })
S.server.set(KIM, { online_status: true, laatst_gezien: iso(nu - 30000) })
await wacht(40000)
P.kamer.delete(KIM); P.roep({ id: KIM, online: false })
await wacht(7000)
assert.equal(O.isVriendOnline(KIM), false, 'telefoon uit: grijs, niet nog 5 minuten groen')

// Kim gaat even naar een andere pagina (meteen weer live): niet eens de server vragen
P.kamer.set(KIM, { actief: true }); P.roep({ id: KIM, online: true })
const n2 = S.vragen.length
P.kamer.delete(KIM); P.roep({ id: KIM, online: false })
await wacht(1500)
P.kamer.set(KIM, { actief: true }); P.roep({ id: KIM, online: true })
await wacht(7000)
assert.equal(S.vragen.length, n2, 'andere pagina in Stekky: geen extra vraag')
assert.equal(O.isVriendOnline(KIM), true)

// live vrienden worden niet bij de server nagevraagd
await wacht(2 * 60000)
assert.ok(!S.vragen.at(-1).includes(KIM), 'wie live is, kost geen vraag')

// zelf helemaal offline: niemand groen
ls.set('fibro_ik_offline', '1')
assert.equal(O.isVriendOnline(KIM), false, 'zelf helemaal offline: je ziet niemand online')
ls.delete('fibro_ik_offline')

// zelf de app wegzetten: dat zien je vrienden
document.hidden = true; docLuist.forEach(fn => fn())
assert.deepEqual(P.eigen, { verborgen: true }, 'app weg: verborgen')
document.hidden = false; docLuist.forEach(fn => fn())
assert.deepEqual(P.eigen, { actief: true })

// ── de pagina's ──
for (const f of ['vrienden.html', 'chat.html', 'vriend-profiel.html', 'profiel.html'])
  assert.match(lees(f), /from '\.\/onlinestip\.js\?v=1'/, f + ' gebruikt onlinestip.js')
assert.match(lees('index.html'), /import\('\.\/onlinestip\.js\?v=1'\)/, 'Home: het getal vrienden online')
for (const f of ['vrienden.html', 'chat.html', 'vriend-profiel.html'])
  assert.match(lees(f), /return (isVriendOnline|stipOnline)\(profiel\.id/, f + ': dezelfde regel')
assert.match(lees('chat.html'), /isVriendOnline as stipOnline/, 'Chat: andere naam, want p2pfoto.js heeft ook een isVriendOnline')
for (const f of ['spel.html', 'bellen.html', 'vriend-profiel.html'])
  assert.match(lees(f), /startHeartbeat\(\)/, f + ': het seintje loopt ook hier')
console.log('online-bolletje: alles goed')
