// test-fediverse.mjs (25 nov 2026): liken en reageren met je eigen fediverse-account.
//  1. regels.js (de controles van de edge function): servers, video-links, terugadres, wat er teruggaat
//  2. de edge function zelf (index.ts), met een nagemaakte Deno, Supabase en fediverse-server
//  3. fediverse.js in de app: inloggen met PKCE, terugkomen, sleutel alleen op dit toestel, uitloggen
//  4. de huisregel: de app praat niet zelf met fediverse-servers; alles gaat via Stekky
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const R = await import(new URL('../../supabase/functions/fediverse/regels.js', import.meta.url))
const P = await import(new URL('../../peertube.js', import.meta.url))

// ── 1. regels.js ──
assert.deepEqual(R.PEERTUBE, P.SERVERS, 'dezelfde PeerTube-servers als peertube.js')
assert.equal(R.netteServer('Mastodon.Social'), 'mastodon.social')
assert.equal(R.netteServer('https://mastodon.social/'), 'mastodon.social')
assert.equal(R.netteServer('@marcel@mastodon.social'), 'mastodon.social')
for (const slecht of ['localhost', 'server.local', 'intranet', '10.0.0.1', '127.0.0.1', 'mastodon.social:8443', 'a..b', '-a.nl', 'masto don.nl', 'x', '', null, 'a.nl/pad', 'nas.home.arpa'])
  assert.equal(R.netteServer(slecht), null, 'geen server: ' + slecht)
const kort = 'kkGMgK9ZtnKfYAgnEtQxbv'
assert.equal(R.netteVideo('https://spectra.video/videos/watch/' + kort), 'https://spectra.video/videos/watch/' + kort)
assert.equal(R.netteVideo('https://spectra.video/w/' + kort), 'https://spectra.video/videos/watch/' + kort)
for (const slecht of ['https://kwaad.nl/videos/watch/' + kort, 'http://spectra.video/w/' + kort, 'https://spectra.video/w/' + kort + '?x=1', 'https://spectra.video/w/../api', 'https://spectra.video/api/v1/videos'])
  assert.equal(R.netteVideo(slecht), null, 'geen video: ' + slecht)
assert.ok(R.goedTerugAdres('https://marcelpetrusma84-coder.github.io/Fibro/fediverse-terug.html'))
assert.ok(R.goedTerugAdres('https://deploy-preview-249--stately-llama-4b380e.netlify.app/fediverse-terug.html'))
for (const slecht of ['https://kwaad.nl/fediverse-terug.html', 'https://marcelpetrusma84-coder.github.io/Fibro/index.html', 'https://marcelpetrusma84-coder.github.io.kwaad.nl/Fibro/fediverse-terug.html', 'http://marcelpetrusma84-coder.github.io/Fibro/fediverse-terug.html'])
  assert.ok(!R.goedTerugAdres(slecht), 'geen terugadres: ' + slecht)
assert.equal(R.SCOPES, 'read:search read:accounts read:statuses write:favourites write:statuses', 'geen privéberichten, geen volgers beheren')
assert.ok(!/\bread\b(?!:)|\bwrite\b(?!:)|follow|push|admin|conversations|notifications/.test(R.SCOPES))
assert.equal(R.netteTekst('  hoi  '), 'hoi'); assert.equal(R.netteTekst(''), null); assert.equal(R.netteTekst('x'.repeat(501)), null)
assert.equal(R.metVermelding('Mooi!', 'gamekanaal@spectra.video'), '@gamekanaal@spectra.video Mooi!')
assert.equal(R.metVermelding('@gamekanaal@spectra.video mooi', 'gamekanaal@spectra.video'), '@gamekanaal@spectra.video mooi', 'niet twee keer')
assert.deepEqual(R.klein('zoek', { statuses: [{ id: '123', favourited: true, favourites_count: 4, replies_count: 2, content: '<p>x</p>', account: { acct: 'kanaal@spectra.video', note: 'geheim' } }] }),
  { id: '123', favoriet: true, likes: 4, reacties: 2, acct: 'kanaal@spectra.video' }, 'alleen de paar velden die de app nodig heeft')
assert.deepEqual(R.klein('zoek', { statuses: [] }), { geen: true })
assert.deepEqual(R.klein('ik', { acct: 'marcel', display_name: 'Marcel', email: 'x@y.nl', source: { privacy: 'public' } }), { acct: 'marcel', naam: 'Marcel' })
console.log('PASS: regels.js controleert servers, video\'s en terugadres, en geeft alleen een paar velden terug')

// ── 2. de edge function ──
const MAP = new URL('../../supabase/functions/fediverse/', import.meta.url)
const tmp = mkdtempSync(path.join(tmpdir(), 'fediverse-'))
copyFileSync(new URL('regels.js', MAP), path.join(tmp, 'regels.js'))
writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
const bron = readFileSync(new URL('index.ts', MAP), 'utf8')
const regel = 'import { createClient } from "npm:@supabase/supabase-js@2";'
assert.ok(bron.includes(regel))
writeFileSync(path.join(tmp, 'index.ts'), bron.replace(regel, 'const createClient = () => globalThis.__supa;'))
let handler = null
globalThis.Deno = { serve: h => { handler = h }, env: { get: () => 'x' },
  resolveDns: async (h, soort) => soort === 'A' ? (h === 'intern.example.nl' ? ['192.168.1.5'] : ['145.58.1.1']) : [] }
globalThis.__supa = {
  auth: { getUser: async p => ({ data: { user: p === 'GOED' ? { id: 'u1' } : p === 'GEBLOKKEERD' ? { id: 'u2' } : null } }) },
  from: () => ({ select: () => ({ eq: (k, id) => ({ maybeSingle: async () => ({ data: { geblokkeerd: id === 'u2' } }) }) }) }),
}
const TOKEN = 'tokenABC123456'
const gevraagd = []
globalThis.fetch = async (u, o = {}) => {
  gevraagd.push({ u, o })
  assert.equal(o.redirect, 'manual', 'doorverwijzingen niet volgen')
  const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } })
  const auth = (o.headers || {}).Authorization
  if (u === 'https://mastodon.social/api/v1/apps') return json({ id: '1', client_id: 'clientID12345', client_secret: 'secretXYZ12345', vapid_key: 'x' })
  if (u === 'https://mastodon.social/oauth/token') return json({ access_token: TOKEN, token_type: 'Bearer', scope: R.SCOPES, created_at: 1 })
  if (u === 'https://doorsturen.nl/api/v1/apps') return new Response(null, { status: 302, headers: { location: 'https://192.168.1.5/' } })
  if (auth !== 'Bearer ' + TOKEN) return json({ error: 'The access token is invalid' }, 401)
  if (u.startsWith('https://mastodon.social/api/v2/search?')) return json({ accounts: [{ id: 'a' }], statuses: [{ id: '777', favourited: false, favourites_count: 3, replies_count: 1, account: { acct: 'gamekanaal@spectra.video' }, content: '<script>x</script>' }], hashtags: [] })
  if (u === 'https://mastodon.social/api/v1/statuses/777/favourite') return json({ id: '777', favourited: true, favourites_count: 4, replies_count: 1, account: { acct: 'gamekanaal@spectra.video' } })
  if (u === 'https://mastodon.social/api/v1/statuses/777') return json({ id: '777', account: { acct: 'gamekanaal@spectra.video' } })
  if (u === 'https://mastodon.social/api/v1/statuses') return json({ id: '888', content: 'x', account: { acct: 'marcel' } })
  if (u === 'https://mastodon.social/api/v1/accounts/verify_credentials') return json({ acct: 'marcel', display_name: 'Marcel', source: { note: 'geheim' } })
  return json({}, 404)
}
try { await import(path.join(tmp, 'index.ts')) } catch (e) {
  if (/Unknown file extension|ERR_UNKNOWN_FILE_EXTENSION|strip/i.test(String(e))) { console.log('OVERGESLAGEN (functie): deze Node leest geen TypeScript'); handler = null } else throw e
}
if (handler) {
  const vraag = async (body, pas = 'GOED') => {
    const r = await handler(new Request('https://f.supabase.co/functions/v1/fediverse', { method: 'POST', headers: { Authorization: 'Bearer ' + pas }, body: JSON.stringify(body) }))
    return [r.status, await r.json()]
  }
  const TERUG = 'https://marcelpetrusma84-coder.github.io/Fibro/fediverse-terug.html'
  let [st, d] = await vraag({ actie: 'app', server: 'mastodon.social', terug: TERUG })
  assert.equal(st, 200); assert.deepEqual(d, { ok: true, client_id: 'clientID12345', client_secret: 'secretXYZ12345' })
  const app = JSON.parse(gevraagd.at(-1).o.body)
  assert.deepEqual(app, { client_name: 'Stekky', redirect_uris: TERUG, scopes: R.SCOPES, website: R.WEBSITE })
  ;[st] = await vraag({ actie: 'app', server: 'mastodon.social', terug: 'https://kwaad.nl/terug' }); assert.equal(st, 400, 'geen vreemd terugadres')
  ;[st] = await vraag({ actie: 'app', server: 'intern.example.nl', terug: TERUG }); assert.equal(st, 400, 'een naam die naar een eigen netwerk wijst')
  assert.ok(!gevraagd.some(g => g.u.includes('intern.example.nl')), 'een eigen netwerk wordt nooit gevraagd')
  ;[st, d] = await vraag({ actie: 'app', server: 'doorsturen.nl', terug: TERUG }); assert.equal(st, 502, 'een doorverwijzing wordt niet gevolgd')
  assert.ok(!gevraagd.some(g => g.u.includes('192.168')))
  ;[st, d] = await vraag({ actie: 'token', server: 'mastodon.social', terug: TERUG, client_id: 'clientID12345', client_secret: 'secretXYZ12345', code: 'codeCODE1234', verifier: 'v'.repeat(64) })
  assert.equal(st, 200); assert.deepEqual(d, { ok: true, token: TOKEN })
  const form = new URLSearchParams(gevraagd.at(-1).o.body)
  assert.equal(form.get('code_verifier'), 'v'.repeat(64), 'PKCE'); assert.equal(form.get('grant_type'), 'authorization_code'); assert.equal(form.get('redirect_uri'), TERUG)
  ;[st] = await vraag({ actie: 'token', server: 'mastodon.social', terug: TERUG, client_id: 'clientID12345', client_secret: 'secretXYZ12345', code: 'codeCODE1234', verifier: 'kort' }); assert.equal(st, 400)
  ;[st, d] = await vraag({ actie: 'ik', server: 'mastodon.social', token: TOKEN }); assert.deepEqual(d, { ok: true, acct: 'marcel', naam: 'Marcel' })
  ;[st, d] = await vraag({ actie: 'zoek', server: 'mastodon.social', token: TOKEN, video: 'https://spectra.video/w/' + kort })
  assert.deepEqual(d, { ok: true, id: '777', favoriet: false, likes: 3, reacties: 1, acct: 'gamekanaal@spectra.video' }, 'geen inhoud van berichten terug')
  const zoekUrl = new URL(gevraagd.at(-1).u)
  assert.equal(zoekUrl.searchParams.get('q'), 'https://spectra.video/videos/watch/' + kort); assert.equal(zoekUrl.searchParams.get('resolve'), 'true')
  assert.ok(!gevraagd.at(-1).u.includes(TOKEN), 'de sleutel staat nooit in een adres')
  ;[st] = await vraag({ actie: 'zoek', server: 'mastodon.social', token: TOKEN, video: 'https://youtube.com/watch?v=x' }); assert.equal(st, 400, 'alleen video\'s van goedgekeurde PeerTube-servers')
  ;[st, d] = await vraag({ actie: 'like', server: 'mastodon.social', token: TOKEN, id: '777', aan: true }); assert.equal(d.favoriet, true); assert.equal(d.likes, 4)
  ;[st] = await vraag({ actie: 'like', server: 'mastodon.social', token: TOKEN, id: '../../admin' }); assert.equal(st, 400)
  ;[st, d] = await vraag({ actie: 'reageer', server: 'mastodon.social', token: TOKEN, id: '777', tekst: '  Supergoed!  ' })
  assert.deepEqual(d, { ok: true, id: '888' })
  const post = JSON.parse(gevraagd.at(-1).o.body)
  assert.deepEqual(post, { status: '@gamekanaal@spectra.video Supergoed!', in_reply_to_id: '777', visibility: 'public' }, 'de maker van de video wordt genoemd, zodat hij de reactie krijgt')
  ;[st] = await vraag({ actie: 'reageer', server: 'mastodon.social', token: TOKEN, id: '777', tekst: 'x'.repeat(501) }); assert.equal(st, 400, 'hoogstens 500 tekens')
  ;[st, d] = await vraag({ actie: 'zoek', server: 'mastodon.social', token: 'verlopenTOKEN1', video: 'https://spectra.video/w/' + kort }); assert.equal(st, 401); assert.equal(d.reden, 'uitgelogd')
  ;[st] = await vraag({ actie: 'zoek', server: 'mastodon.social', video: 'https://spectra.video/w/' + kort }); assert.equal(st, 401, 'zonder sleutel')
  ;[st] = await vraag({ actie: 'iets', server: 'mastodon.social' }); assert.equal(st, 400)
  ;[st] = await vraag({ actie: 'ik', server: 'mastodon.social', token: TOKEN }, 'KWAAD'); assert.equal(st, 401, 'alleen ingelogd bij Stekky')
  ;[st] = await vraag({ actie: 'ik', server: 'mastodon.social', token: TOKEN }, 'GEBLOKKEERD'); assert.equal(st, 403)
  assert.doesNotMatch(bron, /console\.(log|info|warn|error)/, 'de functie schrijft niets weg (ook geen sleutels)')
  assert.doesNotMatch(bron, /\.from\(["'](?!profiles)/, 'de functie bewaart niets in de database')
  console.log('PASS: de edge function stuurt alleen nette vragen door, volgt geen doorverwijzingen en bewaart niets')
}

// ── 3. fediverse.js ──
const opslag = new Map()
globalThis.localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)), removeItem: k => opslag.delete(k) }
globalThis.location = new URL('https://marcelpetrusma84-coder.github.io/Fibro/index.html')
const F = await import(new URL('../../fediverse.js', import.meta.url))
assert.equal(F.SCOPES, R.SCOPES, 'app en server vragen dezelfde rechten')
assert.equal(F.terugAdres(new URL('https://marcelpetrusma84-coder.github.io/Fibro/vriend-profiel.html?id=1')), 'https://marcelpetrusma84-coder.github.io/Fibro/fediverse-terug.html')
assert.ok(R.goedTerugAdres(F.terugAdres(globalThis.location)))
for (const s of ['mastodon.social', '@a@b.nl', 'localhost', '10.0.0.1', 'a.nl:80']) assert.equal(F.netteServer(s), R.netteServer(s), 'app en server: dezelfde regels voor ' + s)
const naarFunctie = []
const nepFetch = async (u, o) => {
  const b = JSON.parse(o.body); naarFunctie.push(b)
  assert.equal(u, F.FUNCTIE_URL); assert.equal(o.headers.Authorization, 'Bearer PAS')
  const ok = d => ({ ok: true, json: async () => ({ ok: true, ...d }) })
  if (b.actie === 'app') return ok({ client_id: 'clientID12345', client_secret: 'secretXYZ12345' })
  if (b.actie === 'token') return ok({ token: TOKEN })
  if (b.actie === 'ik') return ok({ acct: 'marcel', naam: 'Marcel' })
  if (b.actie === 'zoek' && b.token === 'oud12345678') return { ok: false, json: async () => ({ ok: false, reden: 'uitgelogd' }) }
  if (b.actie === 'zoek') return ok({ id: '777', favoriet: false, likes: 3 })
  return ok({})
}
let naar = null
const fedi = F.maakFedi({ uid: 'u1', geefPas: async () => 'PAS', fetch: nepFetch, ga: u => { naar = u } })
assert.equal(fedi.account(), null)
assert.equal((await fedi.startInloggen('localhost')).fout, 'server')
assert.ok((await fedi.startInloggen('Mastodon.Social')).ok)
const au = new URL(naar)
assert.equal(au.origin + au.pathname, 'https://mastodon.social/oauth/authorize', 'inloggen op de pagina van de eigen server')
assert.equal(au.searchParams.get('code_challenge_method'), 'S256'); assert.equal(au.searchParams.get('scope'), R.SCOPES)
assert.equal(au.searchParams.get('redirect_uri'), 'https://marcelpetrusma84-coder.github.io/Fibro/fediverse-terug.html')
const wacht = JSON.parse(opslag.get('fibro_fediverse_wacht'))
assert.equal(au.searchParams.get('state'), wacht.state)
const { createHash } = await import('node:crypto')
assert.equal(au.searchParams.get('code_challenge'), createHash('sha256').update(wacht.verifier).digest('base64url'), 'PKCE: de uitdaging hoort bij het geheim')
assert.ok(!naar.includes(wacht.verifier), 'het PKCE-geheim gaat niet mee naar de server')
// twee keer inloggen bij dezelfde server: Stekky wordt maar één keer aangemeld
await fedi.startInloggen('mastodon.social')
assert.equal(naarFunctie.filter(b => b.actie === 'app').length, 1)
const w2 = JSON.parse(opslag.get('fibro_fediverse_wacht'))
// terugkomen met een verkeerde state: niets
let r = await F.verwerkTerug('?code=codeCODE1234&state=fout', { geefPas: async () => 'PAS', fetch: nepFetch })
assert.equal(r.fout, 'inloggen'); assert.equal(fedi.account(), null)
assert.equal(opslag.get('fibro_fediverse_wacht'), undefined, 'een inlogpoging is maar één keer bruikbaar')
// goed terugkomen
opslag.set('fibro_fediverse_wacht', JSON.stringify(w2))
r = await F.verwerkTerug('?code=codeCODE1234&state=' + w2.state, { geefPas: async () => 'PAS', fetch: nepFetch })
assert.ok(r.ok); assert.equal(r.terugNaar, 'https://marcelpetrusma84-coder.github.io/Fibro/index.html')
assert.equal(naarFunctie.find(b => b.actie === 'token').verifier, w2.verifier)
const acc = fedi.account()
assert.equal(acc.token, TOKEN); assert.equal(acc.acct, '@marcel@mastodon.social'); assert.equal(acc.server, 'mastodon.social')
assert.ok(opslag.has('fibro_fediverse_u1') && !opslag.has('fibro_fediverse_wacht'))
assert.equal(F.maakFedi({ uid: 'u2', geefPas: async () => 'PAS', fetch: nepFetch }).account(), null, 'de sleutel hoort bij dit Stekky-account')
assert.deepEqual(await fedi.zoek('https://spectra.video/videos/watch/' + kort), { ok: true, id: '777', favoriet: false, likes: 3 })
// de server kent de sleutel niet meer: account weg, opnieuw inloggen
opslag.set('fibro_fediverse_u1', JSON.stringify({ ...acc, token: 'oud12345678' }))
assert.equal((await fedi.zoek('https://spectra.video/videos/watch/' + kort)).fout, 'uitgelogd')
assert.equal(fedi.account(), null)
opslag.set('fibro_fediverse_u1', JSON.stringify(acc))
await fedi.uitloggen()
assert.equal(fedi.account(), null); assert.equal(naarFunctie.at(-1).actie, 'uit', 'uitloggen trekt de sleutel ook bij de server in')
// terugNaar alleen binnen de eigen app
opslag.set('fibro_fediverse_wacht', JSON.stringify({ ...w2, terugNaar: 'https://kwaad.nl/' }))
r = await F.verwerkTerug('?code=codeCODE1234&state=' + w2.state, { geefPas: async () => 'PAS', fetch: nepFetch })
assert.equal(r.terugNaar, 'index.html', 'nooit terugsturen naar een andere site')
console.log('PASS: fediverse.js logt in met PKCE, bewaart de sleutel alleen op dit toestel en logt netjes uit')

// ── 4. de huisregel en de aansluiting ──
for (const pagina of ['index.html', 'vriend-profiel.html', 'fediverse-terug.html']) {
  const csp = lees(pagina).match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1]
  const connect = csp.match(/connect-src ([^;]*);/)[1]
  assert.doesNotMatch(connect, /mastodon|https:(\s|$)|\*/, pagina + ': de app praat niet zelf met fediverse-servers')
}
assert.match(lees('supabase/config.toml'), /\[functions\.fediverse\]\nenabled = true\nverify_jwt = false\nentrypoint = "\.\/functions\/fediverse\/index\.ts"/)
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(lees(f), /import\('\.\/fediverse\.js\?v=1'\)\.then\(F => \{/, f + ': laadt fediverse.js pas bij de speler')
assert.doesNotMatch(lees('sync.js'), /fibro_fediverse/, 'de sleutel gaat niet mee naar vrienden')
console.log('PASS: de huisregel blijft streng; de sleutel gaat niet via sync')
