// v245 (31 okt 2026): wanneer kwamen de foto's en widgets van een vriend voor het laatst rechtstreeks binnen (die komen
// via sync.js alleen als jullie allebei online zijn). sync.js bewaart de tijd (fibro_syncbij_<ik>_<vriend>).
// v248: dat staat nu in de vriendenlijst (vrienden.html), niet meer op het profiel van de vriend; de uitleg één keer
// bovenaan de lijst.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const sync = lees('sync.js'), vp = lees('vrienden.html'), profiel = lees('vriend-profiel.html')

// 1. sync.js bewaart alleen een tijd per vriend, op het moment dat het manifest van de vriend verwerkt is
const blok = sync.slice(sync.indexOf("if (bericht.type === 'manifest')"), sync.indexOf("if (bericht.type === 'geef')"))
// v246: { t, v, oud, nieuw } in plaats van alleen de tijd (zie test-profiel-versie.mjs)
assert.match(blok, /const nu = Date\.now\(\), sl = 'fibro_syncbij_' \+ huidigeUserId \+ '_' \+ syncPartnerId/)
assert.match(blok, /localStorage\.setItem\(sl, JSON\.stringify\(\{ t: nu, v, oud, nieuw \}\)\)/)
assert.match(blok, /new CustomEvent\('fibro-sync-bijgewerkt', \{ detail: \{ vriendId: syncPartnerId, tijd: nu, nieuw \} \}\)/)
assert.ok(blok.indexOf("fibro_syncbij_") < blok.indexOf("type: 'geef', items: nodig"), 'de tijd wordt gezet voordat de nieuwe dingen gevraagd worden')

// 2. De tijd leesbaar maken (de echte functie uit vrienden.html)
const bron = vp.slice(vp.indexOf('function syncWanneer(t) {'), vp.indexOf('  let laatsteTeken = null'))
const T = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m)
T.locale = 'nl-NL'
const syncWanneer = new Function('T', bron + '; return syncWanneer')(T)
const nu = Date.now()
assert.equal(syncWanneer(nu - 20 * 1000), 'zojuist')
assert.equal(syncWanneer(nu - 7 * 60 * 1000), '7 min geleden')
const vanochtend = new Date(); vanochtend.setHours(0, 30, 0, 0)
if (nu - vanochtend > 3600 * 1000) assert.match(syncWanneer(vanochtend.getTime()), /^vandaag 00:30$/)
const gisteren = new Date(); gisteren.setDate(gisteren.getDate() - 1); gisteren.setHours(14, 2, 0, 0)
assert.equal(syncWanneer(gisteren.getTime()), 'gisteren 14:02')
const lang = new Date(2026, 9, 12, 9, 5)
if (nu - lang > 3 * 86400 * 1000) assert.match(syncWanneer(lang.getTime()), /^12 okt\.? 09:05$/)

// 3. In de vriendenlijst: per vriend, en de uitleg één keer bovenaan; niet meer op het profiel van de vriend
assert.match(vp, /profielRegel\(profielStand\(p, userId\), bijgewerktOp\(p, userId\)\)/)
assert.match(vp, /T\('Bijgewerkt: \{wanneer\}', \{ wanneer: syncWanneer\(t\) \}\) : T\('Nog niet bijgewerkt'\)/)
assert.match(vp, /if \(data\.length > 0\) html \+= '<div class="sync-uitleg"/)
assert.match(vp, /T\("Nieuwe foto's en widgets van vrienden komen binnen als jullie allebei online zijn\."\)/)
assert.match(vp, /setInterval\(\(\) => \{ if \(laatsteTeken && !document\.hidden\) tekenLijst\(\.\.\.laatsteTeken\) \}, 60000\)/)
assert.ok(!/syncRegel|sync-regel|bijgewerkt: \{wanneer\}/.test(profiel), 'niet meer op het profiel van de vriend')

// 4. Engels voor alle teksten, en de nieuwe versies overal
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const m of (bron + vp.slice(vp.indexOf('function profielRegel('), vp.indexOf('function bouwRij('))).matchAll(/\bT\((['"])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
  const k = m[2].replace(/\\'/g, "'")
  assert.ok(Object.prototype.hasOwnProperty.call(EN, k), 'Engels voor "' + k + '"')
}
delete globalThis.window
for (const f of ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html']) {
  const v = [...lees(f).matchAll(/sync\.js\?v=(\d+)/g)].map(m => Number(m[1]))
  assert.ok(v.length === 1 && v[0] >= 245, f + ': sync.js v245 of nieuwer')
}
console.log("ok: 'Foto's en widgets bijgewerkt' in de vriendenlijst")
