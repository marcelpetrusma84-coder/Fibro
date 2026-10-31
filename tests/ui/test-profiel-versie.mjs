// v246 (31 okt 2026): op de pagina Vrienden zie je welke vriend zijn profiel heeft geüpdatet.
// - sync.js zet een vingerafdruk van je eigen profiel-overzicht op de server (profiles.profiel_versie,
//   sql/profiel-versie.sql) en onthoudt per vriend wat er binnenkwam (fibro_syncbij_<ik>_<vriend> = { t, v, oud, nieuw }).
// - vrienden.html: "✨ Profiel geüpdatet" (binnen, nog niet bekeken) of "🔄 Profiel geüpdatet · zie je zodra jullie
//   allebei online zijn" (op de server staat iets nieuwers dan wat hier binnen is).
// - vriend-profiel.html: als je het profiel bekijkt, is het nieuwe gezien.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const sync = lees('sync.js'), vrienden = lees('vrienden.html'), vp = lees('vriend-profiel.html'), sql = lees('sql/profiel-versie.sql')
const knip = (src, begin, eind) => { const a = src.indexOf(begin), b = src.indexOf(eind, a + 1); assert.ok(a >= 0 && b > a, begin); return src.slice(a, b) }

// 1. De vingerafdruk: de echte functies uit sync.js
const hashString = new Function(knip(sync, 'function hashString(s) {', '\n}\n') + '\n}; return hashString')()
const vingerafdrukVan = new Function('hashString', knip(sync, 'export function vingerafdrukVan(manifest) {', '\n}\n').replace('export ', '') + '\n}; return vingerafdrukVan')(hashString)
const manifest = {
  layout: { hash: 'a1' }, fotos: { pfoto_3x3_0: { hash: 'f0' }, pfoto_3x3_1: { hash: 'f1' } }, muziek: {},
  videoMetaHash: null, videoHash: null, klein: { quote: 'q1' }, wbg: {}, blokstijl: { kleur: '#ffffff', doorzicht: 12, hoek: 14 },
  naam: 'Tijn', stickers: { 'e1-01': 's1' }, nietMee: undefined
}
const afzender = vingerafdrukVan(manifest)
// de ontvanger krijgt het als JSON, met de sleutels in een andere volgorde
const ontvangen = JSON.parse(JSON.stringify(manifest))
const omgedraaid = Object.fromEntries(Object.entries(ontvangen).reverse())
omgedraaid.fotos = Object.fromEntries(Object.entries(omgedraaid.fotos).reverse())
assert.equal(vingerafdrukVan(ontvangen), afzender, 'afzender en ontvanger: dezelfde vingerafdruk')
assert.equal(vingerafdrukVan(omgedraaid), afzender, 'volgorde van de sleutels maakt niet uit')
assert.match(afzender, /^p1-[0-9a-f]{1,8}[0-9a-f]{1,8}$/)
assert.ok(afzender.length <= 40, 'past in de kolom (hoogstens 40 tekens)')
for (const [wat, verander] of [
  ['een nieuwe foto', m => { m.fotos.pfoto_3x3_2 = { hash: 'f2' } }],
  ['een andere foto', m => { m.fotos.pfoto_3x3_0.hash = 'f9' }],
  ['een andere indeling', m => { m.layout.hash = 'a2' }],
  ['een nieuwe sticker', m => { m.stickers['e1-02'] = 's2' }],
  ['een andere quote', m => { m.klein.quote = 'q2' }],
  ['een andere naam', m => { m.naam = 'Valentijn' }],
]) {
  const m = JSON.parse(JSON.stringify(manifest)); verander(m)
  assert.notEqual(vingerafdrukVan(m), afzender, wat + ' geeft een andere vingerafdruk')
}

// 2. sync.js: op de server zetten (alleen als hij anders is, hoogstens eens per 90 s) en bij ontvangst onthouden
const pub = knip(sync, 'async function publiceerProfielVersie() {', '\nlet profielVersieTimer')
assert.match(pub, /Date\.now\(\) - Number\(localStorage\.getItem\(klok\) \|\| 0\) < 90000\) return/)
assert.match(pub, /if \(v === vorige \|\| uid !== huidigeUserId\) return/)
assert.match(pub, /supabase\.from\('profiles'\)\.update\(\{ profiel_versie: v \}\)\.eq\('id', uid\)\.select\('id'\)/)
assert.match(pub, /error\.code === '42703'/, 'zonder de kolom (SQL nog niet uitgevoerd) stopt het netjes')
assert.equal((sync.match(/\n\s+startProfielVersie\(\)\n/g) || []).length, 2, 'start in beide gevallen waarin dit tabblad de sync krijgt')
assert.match(sync, /async function stuurManifest\(\) \{\n  const manifest = await maakManifest\(\)\n  dataChannel\.send\(JSON\.stringify\(\{ type: 'manifest', data: manifest \}\)\)/, 'het overzicht dat verstuurd wordt is hetzelfde')
const ontvang = knip(sync, "if (bericht.type === 'manifest')", "if (bericht.type === 'geef')")
assert.match(ontvang, /const v = vingerafdrukVan\(bericht\.data\)/)
assert.match(ontvang, /localStorage\.setItem\(sl, JSON\.stringify\(\{ t: nu, v, oud, nieuw \}\)\)/)

// 3. De stand per vriend op de pagina Vrienden (de echte functie)
const opslag = new Map()
const localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)) }
const profielStand = new Function('localStorage', knip(vrienden, 'function profielStand(p, userId) {', '\n  let laatsteTeken') + '; return profielStand')(localStorage)
const zet = o => localStorage.setItem('fibro_syncbij_ik_tijn', JSON.stringify(o))
assert.equal(profielStand({ id: 'tijn', profiel_versie: 'p1-a' }, 'ik'), '', 'nog nooit gesynct: niets (geen valse melding)')
zet({ t: 1, v: 'p1-a', oud: [], nieuw: false })
assert.equal(profielStand({ id: 'tijn', profiel_versie: 'p1-a' }, 'ik'), '', 'alles binnen en bekeken: niets')
assert.equal(profielStand({ id: 'tijn', profiel_versie: null }, 'ik'), '', 'vriend met een oudere Fibro: niets')
assert.equal(profielStand({ id: 'tijn', profiel_versie: 'p1-b' }, 'ik'), 'onderweg', 'nieuwer op de server: onderweg')
zet({ t: 2, v: 'p1-b', oud: ['p1-a'], nieuw: true })
assert.equal(profielStand({ id: 'tijn', profiel_versie: 'p1-b' }, 'ik'), 'nieuw', 'binnen, nog niet bekeken: nieuw')
assert.equal(profielStand({ id: 'tijn', profiel_versie: 'p1-a' }, 'ik'), 'nieuw', 'een oude lijst van de server (p1-a) geeft geen valse onderweg')
zet({ t: 2, v: 'p1-b', oud: ['p1-a'], nieuw: false })
assert.equal(profielStand({ id: 'tijn', profiel_versie: 'p1-b' }, 'ik'), '', 'bekeken: weg')
assert.match(vrienden, /vraag\(VELDEN \+ ', avatar_versie, profiel_versie'\)/)
assert.match(vrienden, /if \(antwoord\.error && antwoord\.error\.code === '42703'\) antwoord = await vraag\(VELDEN \+ ', avatar_versie'\)/)

// 4. Het profiel bekijken = gezien
const regel = knip(vp, 'function toonSyncRegel() {', '\n  window.addEventListener')
assert.match(regel, /if \(bij && typeof bij === 'object' && bij\.nieuw\) \{ bij\.nieuw = false; localStorage\.setItem\(sl, JSON\.stringify\(bij\)\) \}/)

// 5. SQL: herhaalbaar, kort, alleen een kolom
assert.match(sql, /alter table public\.profiles add column if not exists profiel_versie text;/)
assert.match(sql, /char_length\(profiel_versie\) <= 40/)
assert.ok(!/drop |delete |grant |policy/i.test(sql.replace(/^--.*$/gm, '')), 'verandert verder niets')

// 6. Engels en versies
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
for (const k of ['Profiel geüpdatet', 'Profiel geüpdatet · zie je zodra jullie allebei online zijn']) assert.ok(globalThis.window.FIBRO_EN[k], 'Engels voor ' + k)
delete globalThis.window
for (const f of ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html']) {
  const v = [...lees(f).matchAll(/sync\.js\?v=(\d+)/g)].map(m => Number(m[1]))
  assert.ok(v.length === 1 && v[0] >= 246, f + ': sync.js v246 of nieuwer')
}
console.log('ok: Profiel geüpdatet op de pagina Vrienden')
