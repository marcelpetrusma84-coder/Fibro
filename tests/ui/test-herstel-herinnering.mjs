// v270: herstel korter na het registreren (een zin, de code, kopiëren) en een herinnering op Home voor wie herstel
// nog niet aan heeft (herstel-herinnering.js): pas na een paar dagen, niet naast het meldingenkaartje, na wegtikken een week niet.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

// ── moetHerinneren (de module zonder zijn imports, die horen bij de browser) ──
const bron = lees('herstel-herinnering.js').replace(/^import .*$/gm, '')
const map = mkdtempSync(join(tmpdir(), 'herstel-'))
writeFileSync(join(map, 'h.mjs'), bron)
const { moetHerinneren, NA_DAGEN, RUST_DAGEN } = await import(pathToFileURL(join(map, 'h.mjs')).href)
const DAG = 86400000, nu = Date.parse('2026-11-06T12:00:00Z')
const oud = new Date(nu - 5 * DAG).toISOString(), nieuw = new Date(nu - 1 * DAG).toISOString()
const basis = { nu, aangemaakt: oud, heeftHerstel: false, heeftSleutel: true, wegSinds: 0, anderKaartje: false }
assert.equal(NA_DAGEN, 3); assert.equal(RUST_DAGEN, 7)
assert.equal(moetHerinneren(basis), true, 'account van 5 dagen zonder herstel: herinneren')
assert.equal(moetHerinneren({ ...basis, aangemaakt: nieuw }), false, 'pas na een paar dagen')
assert.equal(moetHerinneren({ ...basis, heeftHerstel: true }), false, 'herstel staat al aan')
assert.equal(moetHerinneren({ ...basis, heeftSleutel: false }), false, 'geen sleutel op dit toestel: niets aan te zetten')
assert.equal(moetHerinneren({ ...basis, anderKaartje: true }), false, 'nooit twee kaartjes tegelijk')
assert.equal(moetHerinneren({ ...basis, wegSinds: nu - 2 * DAG }), false, 'weggetikt: een week niet')
assert.equal(moetHerinneren({ ...basis, wegSinds: nu - 8 * DAG }), true, 'na een week weer')
assert.equal(moetHerinneren({ ...basis, aangemaakt: null }), false, 'onbekende datum: niet zeuren')

// ── Home laadt het, na het meldingenkaartje ──
const index = lees('index.html')
assert.match(index, /import\('\.\/herstel-herinnering\.js\?v=1'\)\.then\(m => m\.toonHerstelKaart\(document\.getElementById\('beginschermTip'\), supabase, window\._uid\)\)/)
assert.ok(index.indexOf("herstel-herinnering.js?v=1") > index.indexOf("meldingen-aan.js?v=3').then(m => m.toonMeldkaart"), 'na de meldingenkaart')

// ── korter na het registreren ──
const KORT = 'Schrijf hem op: zonder deze code ben je je berichten kwijt op een nieuwe telefoon.'
const login = lees('login.html'), invite = lees('invite.html'), en = lees('taal-en.js')
for (const [naam, html] of [['login.html', login], ['invite.html', invite]]) {
  assert.ok(html.includes('Krijg je ooit een nieuwe telefoon? Met Face ID krijg je je berichten terug.'), naam + ': Face ID in een zin')
  assert.ok(!html.includes("T('Zet nu Face ID-herstel aan. Dan krijg je je berichten op een nieuw toestel terug"), naam + ': de lange zin is weg')
  assert.ok(html.includes(KORT), naam + ': herstelcode in een zin')
}
assert.ok(!login.includes('🔒 Encryptie sleutels aangemaakt'), 'login: geen extra badge meer')
assert.match(login, /function kopieerKnop\(code\)/, 'login: kopieerknop bij de code')
for (const zin of [KORT, 'Krijg je ooit een nieuwe telefoon? Met Face ID krijg je je berichten terug.', 'Je ziet hem maar één keer.', '📋 Kopiëren', 'Ik heb hem opgeschreven'])
  assert.ok(en.includes(JSON.stringify(zin) + ':'), 'Engels: ' + zin)
console.log('herstel: alles goed')
