// Stekky Studio: het pakketbestand (studio-pakket.js) en het installatie-script (tests/tools/studio-installeer.mjs).
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as P from '../../studio-pakket.js'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const fx = P.fxNamenUitBron(readFileSync(path.join(REPO, 'stickerfx.js'), 'utf8'))
assert.ok(fx.bewegingen.has('stuiter') && fx.bewegingen.size >= 16, 'bewegingen uit stickerfx.js gelezen: ' + fx.bewegingen.size)
assert.ok(fx.geluiden.has('boing') && fx.geluiden.has('sintklok') && fx.geluiden.size >= 100, 'geluiden uit stickerfx.js gelezen: ' + fx.geluiden.size)

// Alles wat de Studio zelf voorstelt, bestaat echt
for (let i = 0; i < 40; i++) { const v = P.voorstelFx(i); assert.ok(fx.bewegingen.has(v.b) && fx.geluiden.has(v.g), 'voorstel ' + i + ': ' + v.b + ' / ' + v.g) }

// Een heel klein, echt WebP-plaatje (1 x 1)
const WEBP = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
assert.ok(P.isWebp(WEBP)); assert.ok(!P.isWebp('aGVsbG8gd2VyZWxk')); assert.ok(!P.isWebp(''))

// ── De naam wordt een id ──
assert.equal(P.maakSlug('Zomer-stickers!'), 'zomer-stickers')
assert.equal(P.maakSlug('  Café  Crème  '), 'cafe-creme')
assert.equal(P.storeId('Dieren & Vrienden'), 'stickers-dieren-vrienden')
assert.equal(P.maakSlug('!!!'), '')

const pak = (naam = 'Zomer', extra = {}) => P.maakPakket({
  titel: naam, uitleg: ['Twaalf zomerse stickers.', 'Twelve summery stickers.'],
  stickers: Array.from({ length: 12 }, (_, i) => ({ naam: ['Sticker ' + (i + 1)], ...P.voorstelFx(i), webp: WEBP })), ...extra,
})
let p = pak()
assert.equal(p.id, 'stickers-zomer'); assert.equal(p.stickers[0].naam[1], 'Sticker 1', 'zonder Engelse naam: de Nederlandse')
assert.deepEqual(P.valideerPakket(p, fx), [], 'een goed pakket heeft geen problemen')

// ── Wat er mis kan ──
const slecht = (wijzig, bevat) => {
  const q = structuredClone(pak()); wijzig(q)
  const f = P.valideerPakket(q, fx)
  assert.ok(f.some(t => t.includes(bevat)), `verwacht een probleem met "${bevat}", kreeg: ${JSON.stringify(f)}`)
}
slecht(q => q.stickers.pop(), 'precies 12')
slecht(q => { q.stickers[3].b = 'vliegen' }, 'Sticker 4: de beweging')
slecht(q => { q.stickers[0].g = 'bestaatniet' }, 'Sticker 1: het geluid')
slecht(q => { q.stickers[5].webp = 'aGVsbG8=' }, 'Sticker 6 heeft geen geldig WebP')
slecht(q => { q.stickers[1].naam = ['', ''] }, 'Sticker 2 heeft een naam')
slecht(q => { q.titel = 'x' }, 'naam van het pakket')
slecht(q => { q.id = 'Stickers Zomer' }, 'id van het pakket')
slecht(q => { q.id = 'stickers-' }, 'id van het pakket')
slecht(q => { q.uitleg = ['alleen nl', ''] }, 'uitleg')
slecht(q => { q.stickers[0].webp = Buffer.concat([Buffer.from(WEBP, 'base64'), Buffer.alloc(160000)]).toString('base64') }, 'te zwaar')
// Een eigen geluid (mp3) met een bron
const MP3 = Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x00]), Buffer.alloc(3000, 7)]).toString('base64')   // een stuk dat als mp3 begint
const metGeluid = (nr = 2, bron = 'Kenney.nl, CC0') => { const q = pak('Zomer'); q.stickers[nr].mp3 = MP3; q.stickers[nr].bron = bron; return q }
assert.ok(P.isMp3(MP3) && !P.isMp3('aGVsbG8=') && !P.isMp3(WEBP) && !P.isMp3(''), 'isMp3 kent een mp3')
assert.ok(P.isMp3(Buffer.concat([Buffer.from('ID3'), Buffer.alloc(400)]).toString('base64')), 'ook een mp3 met een ID3-label')
assert.deepEqual(P.valideerPakket(metGeluid(), fx), [], 'een pakket met een eigen geluid klopt')
assert.equal(P.maakPakket({ titel: 'Z', uitleg: ['a', 'b'], stickers: [{ naam: ['x'], b: 'hup', g: 'pop', webp: WEBP, mp3: MP3, bron: '  eigen opname ' }] }).stickers[0].bron, 'eigen opname', 'maakPakket neemt mp3 en bron over')
assert.ok(!('mp3' in pak().stickers[0]) && !('bron' in pak().stickers[0]), 'zonder eigen geluid staat er niets extra')
slecht(q => { q.stickers[2].mp3 = 'aGVsbG8gd2VyZWxk'; q.stickers[2].bron = 'x1' }, 'Sticker 3 heeft geen geldig mp3')
slecht(q => { q.stickers[2].mp3 = MP3 }, 'Sticker 3 heeft een eigen geluid, maar de bron ontbreekt')
slecht(q => { q.stickers[2].mp3 = MP3; q.stickers[2].bron = ' ' }, 'de bron ontbreekt')
slecht(q => { q.stickers[2].mp3 = MP3; q.stickers[2].bron = 'x'.repeat(121) }, 'de bron is te lang')
slecht(q => { q.stickers[2].bron = 'Kenney.nl' }, 'heeft een bron, maar geen eigen geluid')
slecht(q => { q.stickers[2].mp3 = Buffer.concat([Buffer.from(MP3, 'base64'), Buffer.alloc(41 * 1024)]).toString('base64'); q.stickers[2].bron = 'x1' }, 'het eigen geluid is te zwaar')
assert.ok(P.valideerPakket(null, fx)[0].includes('geen pakketbestand')); assert.ok(P.valideerPakket({ formaat: 'iets' }, fx)[0].includes('geen pakketbestand'))

// ── Het installatie-script, in een tijdelijke kopie van de app ──
const tmp = mkdtempSync(path.join(tmpdir(), 'studio-'))
writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
for (const f of ['stickerfx.js', 'stickervellen.js', 'store.js', 'studio-pakket.js', 'studio-pakketten.js']) copyFileSync(path.join(REPO, f), path.join(tmp, f))
mkdirSync(path.join(tmp, 'tests/tools'), { recursive: true }); mkdirSync(path.join(tmp, 'tests/tools'), { recursive: true })
for (const f of ['studio-installeer.mjs', 'verhoog-versies.mjs']) copyFileSync(path.join(REPO, 'tests/tools', f), path.join(tmp, 'tests/tools', f))
const installeer = (pakket, naam) => {
  const bestand = path.join(tmp, naam); writeFileSync(bestand, JSON.stringify(pakket))
  return spawnSync('node', [path.join(tmp, 'tests/tools/studio-installeer.mjs'), bestand, '--map', tmp, '--zonder-versies'], { encoding: 'utf8' })
}
let r = installeer(p, 'a.json')
assert.equal(r.status, 0, 'installeren lukt: ' + r.stderr)
assert.match(r.stdout, /vel f8/)
assert.deepEqual(readdirSync(path.join(tmp, 'stickers/f8')).sort(), Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0') + '.webp'), 'twaalf plaatjes op hun plek')
assert.equal(readFileSync(path.join(tmp, 'stickers/f8/01.webp')).toString('base64'), WEBP, 'het plaatje is onveranderd')
// de app leest het nu
const data = await import(pathToFileURL(path.join(tmp, 'studio-pakketten.js')).href + '?a')
assert.equal(data.STUDIO_VELLEN.length, 1); assert.equal(data.STUDIO_VELLEN[0].id, 'f8'); assert.equal(data.STUDIO_VELLEN[0].store, 'stickers-zomer')
assert.equal(data.STUDIO_VELLEN[0].stickers.length, 12); assert.equal(data.STUDIO_VELLEN[0].stickers[2].nr, '03')
const app = await import(pathToFileURL(path.join(tmp, 'stickervellen.js')).href + '?a')
const s = app.zoekSticker('f8-03')
assert.ok(s && s.src === 'stickers/f8/03.webp' && s.naam[0] === 'Sticker 3' && s.b === P.voorstelFx(2).b, 'zoekSticker kent de nieuwe sticker')
assert.ok(app.STORE_VELLEN.some(v => v.id === 'f8' && v.store === 'stickers-zomer'), 'het vel staat in de Store-lijst')
assert.equal(app.zoekSticker('f9-01'), null)
// een tweede pakket wordt f9; hetzelfde nog eens kan niet; een slecht pakket komt er niet in
r = installeer(pak('Winter'), 'b.json'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /vel f9/); assert.ok(existsSync(path.join(tmp, 'stickers/f9/12.webp')))
r = installeer(pak('Zomer'), 'c.json'); assert.equal(r.status, 1); assert.match(r.stderr, /staat al in de app/)
const kapot = pak('Herfst'); kapot.stickers.pop()
r = installeer(kapot, 'd.json'); assert.equal(r.status, 1); assert.match(r.stderr, /precies 12/); assert.ok(!existsSync(path.join(tmp, 'stickers/f10')), 'een slecht pakket laat niets achter')
assert.equal((await import(pathToFileURL(path.join(tmp, 'studio-pakketten.js')).href + '?b')).STUDIO_VELLEN.length, 2)

// ── Een pakket met eigen geluiden ──
r = installeer(metGeluid(2, 'Kenney.nl, CC0'), 'e.json'); assert.equal(r.status, 1, 'Zomer staat al, dus dit is een tweede keer')
const geluidPakket = metGeluid(4, 'zelf opgenomen'); geluidPakket.id = 'stickers-lente'; geluidPakket.titel = 'Lente'
r = installeer(geluidPakket, 'f.json'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /vel f10/)
assert.equal(readFileSync(path.join(tmp, 'geluiden/f10-05.mp3')).toString('base64'), MP3, 'het geluid staat in geluiden/f10-05.mp3, onveranderd')
assert.deepEqual(readdirSync(path.join(tmp, 'geluiden')), ['f10-05.mp3'], 'alleen de sticker met een eigen geluid krijgt een mp3')
const lente = (await import(pathToFileURL(path.join(tmp, 'studio-pakketten.js')).href + '?c')).STUDIO_VELLEN.find(v => v.id === 'f10')
assert.equal(lente.stickers[4].g, 'f10-05'); assert.equal(lente.stickers[4].terug, P.voorstelFx(4).g, 'het gekozen bibliotheekgeluid is de terugval'); assert.equal(lente.stickers[4].bron, 'zelf opgenomen')
assert.ok(!('terug' in lente.stickers[3]) && lente.stickers[3].g === P.voorstelFx(3).g, 'de andere stickers houden hun bibliotheekgeluid')
// (een verse Node, want de eerdere import heeft studio-pakketten.js al in het geheugen)
const gevonden = JSON.parse(execFileSync('node', ['--input-type=module', '-e', `import('${pathToFileURL(path.join(tmp, 'stickervellen.js')).href}').then(m => console.log(JSON.stringify(m.zoekSticker('f10-05'))))`], { encoding: 'utf8' }))
assert.equal(gevonden.g, 'f10-05', 'zoekSticker geeft het eigen geluid door')

// ── Het echte studio-pakketten.js in de repo blijft een geldige lijst ──
const echt = await import('../../studio-pakketten.js')
assert.ok(Array.isArray(echt.STUDIO_VELLEN))
for (const v of echt.STUDIO_VELLEN) { assert.equal(v.stickers.length, 12); assert.ok(existsSync(path.join(REPO, 'stickers', v.id, '12.webp')), v.id + ': plaatjes bestaan') }

console.log('studio pakket en installeren: ok')
