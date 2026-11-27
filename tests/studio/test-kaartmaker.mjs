// test-kaartmaker.mjs (25 nov 2026): Stekky Studio, eigen speelkaarten (kaartmaker.js), het installatiescript
// (tests/tools/studio-kaarten-installeer.mjs) en hoe de kaarttafel zo'n set tekent (kaartspel-hulp.js).
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, symlinkSync, readdirSync, copyFileSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const lees = f => readFileSync(path.join(REPO, f), 'utf8')
globalThis.window = {}
const M = await import(pathToFileURL(path.join(REPO, 'kaartmaker.js')).href)
const WEBP = (lees('tests/studio/test-spelmaker.mjs').match(/const WEBP = '([^']+)'/) || [])[1]
assert.ok(WEBP && WEBP.startsWith('data:image/webp;base64,'))

// ── De platen ──
assert.equal(M.nodig('plaatjes').length, 18, 'alleen de plaatjes: 18')
assert.equal(M.nodig('alles').length, 54, 'alles: 54')
assert.equal(new Set(M.nodig('alles')).size, 54, 'elke kaart één keer')
assert.deepEqual(M.PLATEN.plaatjes.map(p => p.vakken.length), [9, 9])
assert.deepEqual(M.PLATEN.alles.map(p => [p.kolommen, p.rijen]), [[4, 4], [4, 4], [4, 4], [4, 4], [2, 1]])
for (const s of Object.keys(M.SOORTEN)) for (const p of M.PLATEN[s]) assert.equal(p.vakken.length, p.kolommen * p.rijen, 'elk vakje staat in het plan')
assert.ok(M.nodig('plaatjes').every(n => n === 'achterkant' || n === 'joker' || M.HOFKAARTEN.includes(n.slice(1))))
assert.equal(M.kaartNaam('hV'), 'harten vrouw'); assert.equal(M.kaartNaam('s10'), 'schoppen 10'); assert.equal(M.kaartNaam('achterkant'), 'achterkant')
console.log('PASS: de platen: 2 voor de plaatjes, 5 voor alle 54 kaarten')

// ── De prompt voor Gemini ──
const p1 = M.maakKaartPrompt({ soort: 'plaatjes', nr: 0, stijl: 'retro space' })
for (const t of ['grid of 3 columns and 3 rows', '5:7', 'plain flat white background', 'retro space', '1. Ace of hearts', '4. King of hearts', '9. the card back', 'no letters, numbers or suit symbols'])
  assert.ok(p1.includes(t), 'prompt plaatjes: ' + t)
const p2 = M.maakKaartPrompt({ soort: 'alles', nr: 3 })
for (const t of ['13 playing cards', 'grid of 4 columns and 4 rows', '10. 10 of spades (exactly 10 spades symbols)', '14. leave this cell completely empty', 'friendly, colourful'])
  assert.ok(p2.includes(t), 'prompt alles: ' + t)
assert.equal(M.maakKaartPrompt({ soort: 'alles', nr: 9 }), '')
console.log('PASS: per plaat een prompt voor Gemini, met de kaarten in de goede volgorde')

// ── maakKaartset en valideerKaartset ──
const kaarten = Object.fromEntries(M.nodig('plaatjes').map(n => [n, WEBP]))
const set = M.maakKaartset({ naam: 'Ruimtekaarten', naamEn: 'Space cards', soort: 'plaatjes', kleur: { h: '#FF0000', r: 'rood', k: '#00aa00', s: '#0000ff' }, kaarten: { ...kaarten, h5: WEBP } })
assert.equal(set.id, 'ruimtekaarten'); assert.deepEqual(set.naam, ['Ruimtekaarten', 'Space cards'])
assert.deepEqual(set.kleur, { h: '#ff0000', r: M.STANDAARD_KLEUR.r, k: '#00aa00', s: '#0000ff' }, 'een foute kleur wordt de standaard')
assert.equal(Object.keys(set.kaarten).length, 18, 'h5 hoort niet bij alleen de plaatjes')
assert.deepEqual(M.valideerKaartset(set), [])
const fout = (wijzig, tekst) => { const f = M.valideerKaartset({ ...set, ...wijzig }); assert.ok(f.some(x => x.includes(tekst)), tekst + ' (' + f.join(' | ') + ')') }
fout({ formaat: 'x' }, 'geen kaartpakket')
fout({ naam: ['', ''] }, 'naam van de kaarten ontbreekt')
fout({ id: 'vrolijk' }, 'al kaarten met deze naam')
fout({ id: '../x' }, 'minstens 3 letters')
fout({ soort: 'half' }, 'alle 54')
fout({ kleur: { ...set.kleur, s: 'blauw' } }, 'kleuren')
fout({ kaarten: { ...kaarten, hA: undefined } }, 'harten aas')
fout({ kaarten: { ...kaarten, h5: WEBP } }, 'horen er niet bij')
fout({ kaarten: { ...kaarten, hA: 'data:image/png;base64,AAAA' } }, 'geen goed webp')
fout({ kaarten: { ...kaarten, hA: 'data:image/webp;base64,' + 'A'.repeat(300000) } }, 'te groot')
fout({ soort: 'alles' }, 'harten 2')
assert.ok(M.valideerKaartset(set, { bestaand: ['ruimtekaarten'] }).some(x => x.includes('al kaarten')))
// 27 nov 2026: een eigen achtergrondkleur (voor de getekende 2 t/m 10) mag, maar hoeft niet
assert.equal(set.achtergrond, undefined, 'zonder achtergrond: geen veld')
const creme = M.maakKaartset({ naam: 'Salon', soort: 'plaatjes', kleur: set.kleur, kaarten, achtergrond: '#E4D7BC' })
assert.equal(creme.achtergrond, '#e4d7bc'); assert.deepEqual(M.valideerKaartset(creme), [])
assert.equal(M.maakKaartset({ naam: 'Salon', soort: 'plaatjes', kleur: set.kleur, kaarten, achtergrond: 'creme' }).achtergrond, undefined, 'een foute kleur valt weg')
fout({ achtergrond: 'url(x)' }, 'achtergrondkleur')
// 28 nov 2026: een tweede joker mag erbij
const twee = M.maakKaartset({ naam: 'Salon', soort: 'plaatjes', kleur: set.kleur, kaarten: { ...kaarten, joker2: WEBP } })
assert.equal(twee.kaarten.joker2, WEBP); assert.deepEqual(M.valideerKaartset(twee), [])
fout({ kaarten: { ...kaarten, joker3: WEBP } }, 'horen er niet bij')
fout({ kaarten: { ...kaarten, joker2: 'data:image/png;base64,AAAA' } }, 'geen goed webp')
console.log('PASS: valideerKaartset houdt foute kaartpakketten tegen')

// ── De kaarttafel tekent zo'n set ──
const K = await import(pathToFileURL(path.join(REPO, 'kaartspel-hulp.js')).href)
K.KAARTSTIJLEN.proefset = { naam: 'Proef', map: './kaarten/proefset/', v: 3, studio: 'plaatjes', kleur: { h: '#123456', r: '#654321', k: '#0a0b0c', s: '#abcdef' } }
assert.match(K.kaartSvg('h5', 'proefset'), /fill="#fffdf9"/, 'zonder eigen achtergrond: wit')
K.KAARTSTIJLEN.proefcreme = { ...K.KAARTSTIJLEN.proefset, achtergrond: '#e4d7bc' }
assert.match(K.kaartSvg('h7', 'proefcreme'), /<rect[^>]*fill="#e4d7bc"/, 'met eigen achtergrond: die kleur')
K.KAARTSTIJLEN.proefraar = { ...K.KAARTSTIJLEN.proefset, achtergrond: '"/><script>' }
assert.doesNotMatch(K.kaartSvg('h8', 'proefraar'), /script/, 'een rare kleur komt er niet in')
const h5 = K.kaartSvg('h5', 'proefset')
assert.match(h5, /^<svg class="kt-svg kt-studio"/, '5: getekend'); assert.match(h5, /#123456/, 'in de kleur van de set'); assert.doesNotMatch(h5, /<img|<image/)
assert.match(K.kaartSvg('hH', 'proefset'), /src="\.\/kaarten\/proefset\/hH\.webp\?v=3"/, 'heer: het plaatje'); assert.match(K.kaartSvg('hH', 'proefset'), /#123456/, 'met hoekjes in de kleur van de set')
assert.match(K.kaartSvg('sA', 'proefset'), /proefset\/sA\.webp/); assert.match(K.kaartSvg('J1', 'proefset'), /proefset\/joker\.webp/)
assert.match(K.achterkantSvg('proefset'), /proefset\/achterkant\.webp/)
assert.match(K.kaartSvg('J2', 'proefset'), /proefset\/joker\.webp/, 'zonder tweede joker: twee keer dezelfde')
K.KAARTSTIJLEN.proeftwee = { ...K.KAARTSTIJLEN.proefset, map: './kaarten/proeftwee/', joker2: true }
assert.match(K.kaartSvg('J1', 'proeftwee'), /proeftwee\/joker\.webp/); assert.match(K.kaartSvg('J2', 'proeftwee'), /proeftwee\/joker2\.webp/, 'met tweede joker: J2 is joker2')
K.KAARTSTIJLEN.proefalles = { naam: 'Proef', map: './kaarten/proefalles/', v: 1, studio: 'alles', kleur: set.kleur }
assert.match(K.kaartSvg('h5', 'proefalles'), /proefalles\/h5\.webp/, 'alles: ook 5 is een plaatje')
assert.match(K.kaartSvg('h5', 'perkament'), /#a3212b/, 'Perkament houdt zijn eigen kleuren')
const hulp = lees('kaartspel-hulp.js')
assert.match(hulp, /import \{ STUDIO_KAARTSETS \} from '\.\/studio-kaarten\.js\?v=\d+'/)
assert.match(hulp, /for \(const s of STUDIO_KAARTSETS\) KAARTSTIJLEN\[s\.id\] = \{ naam: s\.naam\[0\], map: '\.\/kaarten\/' \+ s\.id \+ '\/', v: s\.v, studio: s\.soort, kleur: s\.kleur, achtergrond: s\.achtergrond, joker2: s\.joker2 === true \}/)
assert.match(hulp, /KAARTSTIJLEN\[stijl\]\.studio !== 'plaatjes' \|\| STUDIO_PLAATJES\.includes\(w\)/, 'alleen de plaatjes die er zijn alvast ophalen')
console.log('PASS: de kaarttafel tekent een set uit de Studio (plaatjes en getekende cijferkaarten)')

// ── Het installatiescript, in een kopie ──
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kaartmaker-'))
try {
  for (const n of readdirSync(REPO)) {
    if (['.git', 'node_modules', 'studio-kaarten.js', 'kaarten'].includes(n)) continue
    symlinkSync(path.join(REPO, n), path.join(tmp, n))
  }
  copyFileSync(path.join(REPO, 'studio-kaarten.js'), path.join(tmp, 'studio-kaarten.js'))
  mkdirSync(path.join(tmp, 'kaarten'))
  const json = path.join(tmp, 'ruimtekaarten.stekkykaarten.json'); writeFileSync(json, JSON.stringify(set))
  const draai = f => spawnSync(process.execPath, [path.join(REPO, 'tests/tools/studio-kaarten-installeer.mjs'), f, '--map', tmp, '--zonder-versies'], { encoding: 'utf8' })
  let r = draai(json)
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /als ruimtekaarten \(18 plaatjes/)
  assert.deepEqual(readdirSync(path.join(tmp, 'kaarten/ruimtekaarten')).sort(), M.nodig('plaatjes').map(n => n + '.webp').sort())
  assert.ok(readFileSync(path.join(tmp, 'kaarten/ruimtekaarten/hA.webp')).subarray(0, 4).toString() === 'RIFF', 'echte webp-bestanden')
  const D = await import(pathToFileURL(path.join(tmp, 'studio-kaarten.js')).href + '?x=1')
  assert.deepEqual(D.STUDIO_KAARTSETS.at(-1), { id: 'ruimtekaarten', naam: ['Ruimtekaarten', 'Space cards'], soort: 'plaatjes', kleur: set.kleur, v: 1 })
  assert.equal(window.FIBRO_EN['Ruimtekaarten'], 'Space cards')
  const json2 = path.join(tmp, 'creme.stekkykaarten.json'); writeFileSync(json2, JSON.stringify({ ...set, id: 'cremekaarten', naam: ['Crème', 'Cream'], achtergrond: '#e4d7bc', kaarten: { ...set.kaarten, joker2: WEBP } }))
  r = draai(json2); assert.equal(r.status, 0, r.stderr)
  const D2 = await import(pathToFileURL(path.join(tmp, 'studio-kaarten.js')).href + '?x=2')
  assert.equal(D2.STUDIO_KAARTSETS.at(-1).achtergrond, '#e4d7bc', 'de achtergrond komt mee in de app')
  assert.equal(D2.STUDIO_KAARTSETS.at(-1).joker2, true, 'de tweede joker ook')
  assert.ok(existsSync(path.join(tmp, 'kaarten/cremekaarten/joker2.webp')), 'joker2.webp staat erbij')
  assert.equal(D.STUDIO_KAARTSETS.at(-1).joker2, undefined, 'zonder tweede joker: geen veld')
  r = draai(json); assert.notEqual(r.status, 0); assert.match(r.stderr, /al kaarten/)
  writeFileSync(json, JSON.stringify({ ...set, id: 'tweede', naam: ['Tweede', 'Second'], kaarten: {} })); r = draai(json)
  assert.notEqual(r.status, 0); assert.match(r.stderr, /nog geen plaatje/)
} finally { rmSync(tmp, { recursive: true, force: true }) }
console.log('PASS: het installatiescript zet de kaarten in de app')

assert.match(lees('studio.html'), /<details class="promptblok" id="kaartBlok">/)
assert.match(lees('studio.html'), /import '\.\/studio-kaarten-ui\.js\?v=\d+'/)
assert.match(lees('BLAUWDRUK-KAARTSPEL.md'), /Speelkaarten maken/)
console.log('PASS: het kaartenblok staat in de Studio en in de blauwdruk')
