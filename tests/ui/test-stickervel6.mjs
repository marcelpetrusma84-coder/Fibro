// Stickervel 6 (30 okt 2026): twaalf emoji-gezichtjes uit een plaatje van Marcel, elk met een beweging en een geluid.
// Hier: het vel is vol, elke sticker heeft een plaatje (WebP, 384 x 384), een naam in twee talen, een beweging en
// een geluid die bestaan, en elk mp3-geluid staat in geluiden/. Plus: de ?v= van de stickerbestanden klopt overal.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import assert from 'node:assert/strict'

const pad = p => new URL('../../' + p, import.meta.url)
const lees = p => readFileSync(pad(p), 'utf8')
const { FIBRO_VELLEN, zoekSticker } = await import(pad('stickervellen.js'))

// De namen van bewegingen en geluiden uit stickerfx.js (als tekst: dat bestand verwacht een browser)
const fx = lees('stickerfx.js')
const tabel = naam => {
  const m = new RegExp('\\b' + naam + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\}').exec(fx)
  assert.ok(m, 'tabel ' + naam + ' in stickerfx.js')
  return m[1]
}
const sleutels = t => new Set([...t.matchAll(/^\s{2}([a-z0-9]+):\s*\{/gm)].map(m => m[1]))
const BEWEGINGEN = sleutels(tabel('BEWEGINGEN')), GELUIDEN = sleutels(tabel('GELUIDEN'))
const geluidRegel = g => (tabel('GELUIDEN').split('\n').find(r => new RegExp('^\\s{2}' + g + ':').test(r)) || '')

// 1. Vel 6 is vol: 12 stickers, 01 t/m 12
const vel = FIBRO_VELLEN.find(v => v.id === 'f6')
assert.ok(vel, 'vel f6 bestaat')
assert.deepEqual(vel.stickers.map(s => s.nr), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])

// 1b. Op verzoek van Marcel staat dit vel vooraan (Vel 1); de andere volgen in hun oude volgorde.
//     De id's blijven: f1-01 is nog steeds 'Tranen van het lachen' (dat staat in oude berichten en moods).
assert.deepEqual(FIBRO_VELLEN.map(v => v.id), ['f6', 'f1', 'f2', 'f3', 'f4', 'f5'])
assert.equal(zoekSticker('f1-01').naam[0], 'Tranen van het lachen')
assert.equal(zoekSticker('f6-12').naam[0], 'Vloeken')

// 2. Per sticker: plaatje, naam, beweging, geluid
for (const s of vel.stickers) {
  const bestand = 'stickers/f6/' + s.nr + '.webp'
  assert.ok(existsSync(pad(bestand)), bestand + ' bestaat')
  const b = readFileSync(pad(bestand))
  assert.equal(b.toString('ascii', 0, 4), 'RIFF'); assert.equal(b.toString('ascii', 8, 12), 'WEBP', bestand + ' is WebP')
  assert.equal(b.toString('ascii', 12, 16), 'VP8X', bestand + ' heeft doorzichtigheid (VP8X)')
  const breed = 1 + b.readUIntLE(24, 3), hoog = 1 + b.readUIntLE(27, 3)
  assert.deepEqual([breed, hoog], [384, 384], bestand + ' is 384 x 384, zoals de andere vellen')
  assert.ok(b.length < 40000, bestand + ' is klein (' + b.length + ' bytes)')
  assert.ok(Array.isArray(s.naam) && s.naam.length === 2 && s.naam.every(n => n && n.trim()), 'naam in twee talen: ' + s.nr)
  assert.ok(BEWEGINGEN.has(s.b) && s.b !== 'geen', 'beweging bestaat: ' + s.b)
  assert.ok(GELUIDEN.has(s.g), 'geluid bestaat: ' + s.g)
  if (/mp3:\s*true/.test(geluidRegel(s.g))) assert.ok(existsSync(pad('geluiden/' + s.g + '.mp3')), 'mp3 van ' + s.g)
  assert.equal(zoekSticker('f6-' + s.nr)?.nr, s.nr, 'zoekSticker vindt f6-' + s.nr)
}

// 3. Het nieuwe geluid 'censuur': in de tabel, met een terug-geluid dat bestaat, en een kleine mp3
{
  const r = geluidRegel('censuur')
  assert.match(r, /mp3:\s*true/)
  const terug = /terug:\s*'([a-z0-9]+)'/.exec(r)?.[1]
  assert.ok(terug && GELUIDEN.has(terug), 'terug-geluid van censuur bestaat')
  const grootte = statSync(pad('geluiden/censuur.mp3')).size
  assert.ok(grootte > 1000 && grootte < 20000, 'censuur.mp3 ' + grootte + ' bytes')
}

// 4. Elke sticker in een vel heeft een plaatje (ook vel 1-5 nog)
for (const v of FIBRO_VELLEN) for (const s of v.stickers) assert.ok(existsSync(pad('stickers/' + v.id + '/' + s.nr + '.webp')), v.id + '-' + s.nr)

// 5. Overal dezelfde ?v= voor de stickerbestanden (anders laadt een pagina twee versies van hetzelfde bestand)
const bestanden = readdirSync(pad('')).filter(f => /\.(html|js)$/.test(f)).concat(readdirSync(pad('spellen')).filter(f => f.endsWith('.html')).map(f => 'spellen/' + f))
for (const naam of ['stickervellen.js', 'stickerfx.js', 'stickerkeuze.js', 'stickerwidget.js', 'stickermaker.js', 'moodsticker.js']) {
  const versies = new Set()
  for (const f of bestanden) for (const m of lees(f).matchAll(new RegExp('(?<![\\w.-])' + naam.replace('.', '\\.') + '\\?v=(\\d+)', 'g'))) versies.add(m[1])
  assert.ok(versies.size <= 1, naam + ' wordt overal met dezelfde ?v= geladen: ' + [...versies].join(', '))
}

console.log('ok: stickervel 6 (12 stickers met beweging en geluid)')
