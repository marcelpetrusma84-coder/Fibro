// v245 (31 okt 2026): op het profiel van een vriend staat wanneer zijn foto's en widgets voor het laatst rechtstreeks
// binnenkwamen (die komen via sync.js alleen als jullie allebei online zijn).
// sync.js bewaart de tijd (fibro_syncbij_<ik>_<vriend>) zodra het overzicht van de vriend binnen is; vriend-profiel.html
// toont "Foto's en widgets bijgewerkt: ..." met uitleg.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const sync = lees('sync.js'), vp = lees('vriend-profiel.html')

// 1. sync.js bewaart alleen een tijd per vriend, op het moment dat het manifest van de vriend verwerkt is
const blok = sync.slice(sync.indexOf("if (bericht.type === 'manifest')"), sync.indexOf("if (bericht.type === 'geef')"))
// v246: { t, v, oud, nieuw } in plaats van alleen de tijd (zie test-profiel-versie.mjs)
assert.match(blok, /const nu = Date\.now\(\), sl = 'fibro_syncbij_' \+ huidigeUserId \+ '_' \+ syncPartnerId/)
assert.match(blok, /localStorage\.setItem\(sl, JSON\.stringify\(\{ t: nu, v, oud, nieuw \}\)\)/)
assert.match(blok, /new CustomEvent\('fibro-sync-bijgewerkt', \{ detail: \{ vriendId: syncPartnerId, tijd: nu, nieuw \} \}\)/)
assert.ok(blok.indexOf("fibro_syncbij_") < blok.indexOf("type: 'geef', items: nodig"), 'de tijd wordt gezet voordat de nieuwe dingen gevraagd worden')

// 2. De tijd leesbaar maken (de echte functie uit vriend-profiel.html)
const bron = vp.slice(vp.indexOf('function syncWanneer(t) {'), vp.indexOf('function toonSyncRegel()'))
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

// 3. De regel op het profiel, en hij ververst vanzelf
assert.match(vp, /<div class="sync-regel" id="syncRegel" hidden><span id="syncWanneer"><\/span><span class="sync-uitleg" id="syncUitleg"><\/span><\/div>/)
assert.match(vp, /window\.addEventListener\('fibro-sync-bijgewerkt'/)
assert.match(vp, /setInterval\(toonSyncRegel, 30000\)/)
assert.match(vp, /syncNaam = naam\s+toonSyncRegel\(\)/)

// 4. Engels voor alle teksten, en de nieuwe versies overal
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const m of (bron + vp.slice(vp.indexOf('function toonSyncRegel()'), vp.indexOf('function toonProfielData'))).matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) {
  const k = m[1].replace(/\\'/g, "'")
  assert.ok(Object.prototype.hasOwnProperty.call(EN, k), 'Engels voor "' + k + '"')
}
delete globalThis.window
for (const f of ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html']) {
  const v = [...lees(f).matchAll(/sync\.js\?v=(\d+)/g)].map(m => Number(m[1]))
  assert.ok(v.length === 1 && v[0] >= 245, f + ': sync.js v245 of nieuwer')
}
console.log("ok: 'Foto's en widgets bijgewerkt' op het profiel van een vriend")
