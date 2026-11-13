// Stickervel 7, Sinterklaas (13 nov 2026): het eerste stickervel uit de Stekky Store. Twaalf stickers uit een plaatje
// van Marcel (tests/tools/knip7.py), elk met een beweging en een eigen geluid (tests/tools/geluiden8.py).
// Hier: het vel staat in STORE_VELLEN (niet bij de vaste vellen), elke sticker heeft een plaatje, naam, beweging en
// geluid; elk nieuw geluid is een mp3 met een terug-geluid; de Store kent het vel; overal mag de code f7-xx.
import { readFileSync, existsSync, statSync } from 'node:fs'
import assert from 'node:assert/strict'

const pad = p => new URL('../../' + p, import.meta.url)
const lees = p => readFileSync(pad(p), 'utf8')
const opslag = new Map()
globalThis.localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)) }
const { FIBRO_VELLEN, STORE_VELLEN, zoekSticker, mijnStoreVellen } = await import(pad('stickervellen.js'))

const fx = lees('stickerfx.js')
const tabel = naam => new RegExp('\\b' + naam + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\}').exec(fx)[1]
const sleutels = t => new Set([...t.matchAll(/^\s{2}([a-z0-9]+):\s*\{/gm)].map(m => m[1]))
const BEWEGINGEN = sleutels(tabel('BEWEGINGEN')), GELUIDEN = sleutels(tabel('GELUIDEN'))
const geluidRegel = g => (tabel('GELUIDEN').split('\n').find(r => new RegExp('^\\s{2}' + g + ':').test(r)) || '')

// 1. Vel 7 staat in de Store, niet bij de vaste vellen (die blijven f6, f1, f2, f5, f3, f4)
assert.ok(!FIBRO_VELLEN.some(v => v.id === 'f7'), 'f7 is geen vast vel')
const vel = STORE_VELLEN.find(v => v.id === 'f7')
assert.ok(vel && vel.store === 'stickers-sinterklaas' && vel.titel === 'Sinterklaas')
assert.deepEqual(vel.stickers.map(s => s.nr), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])
assert.equal(new Set(vel.stickers.map(s => s.g)).size, 12, 'elke sticker een eigen geluid')

// 2. Per sticker: plaatje (WebP, 384 x 384, doorzichtig), naam, beweging, geluid (mp3 met een terug-geluid)
for (const s of vel.stickers) {
  const bestand = 'stickers/f7/' + s.nr + '.webp'
  const b = readFileSync(pad(bestand))
  assert.equal(b.toString('ascii', 8, 12), 'WEBP', bestand); assert.equal(b.toString('ascii', 12, 16), 'VP8X', bestand + ' doorzichtig')
  assert.deepEqual([1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)], [384, 384], bestand + ' 384 x 384')
  assert.ok(b.length < 40000, bestand + ' klein')
  assert.ok(s.naam.length === 2 && s.naam.every(n => n.trim()), 'naam in twee talen ' + s.nr)
  assert.ok(BEWEGINGEN.has(s.b) && s.b !== 'geen', 'beweging ' + s.b)
  const r = geluidRegel(s.g)
  assert.match(r, /mp3:\s*true/, s.g + ' is een mp3')
  const terug = /terug:\s*'([a-z0-9]+)'/.exec(r)?.[1]
  assert.ok(terug && GELUIDEN.has(terug) && !/mp3:\s*true/.test(geluidRegel(terug)), s.g + ': terug-geluid met code (' + terug + ')')
  const grootte = statSync(pad('geluiden/' + s.g + '.mp3')).size
  assert.ok(grootte > 3000 && grootte < 25000, s.g + '.mp3 ' + grootte + ' bytes')
  const st = zoekSticker('f7-' + s.nr)
  assert.equal(st?.src, bestand, 'een ontvangen f7-' + s.nr + ' is altijd te zien, ook zonder download')
}
assert.equal(zoekSticker('f7-13'), null); assert.equal(zoekSticker('f8-01'), null)

// 3. Pas na downloaden in je stickerkeuze (op dit toestel: fibro_store_<uid>)
assert.deepEqual(mijnStoreVellen('u1'), [])
opslag.set('fibro_store_u1', JSON.stringify(['pakket-retro', 'stickers-sinterklaas']))
assert.deepEqual(mijnStoreVellen('u1').map(v => v.id), ['f7'])
opslag.set('fibro_store_u1', 'kapot'); assert.deepEqual(mijnStoreVellen('u1'), [])

// 4. In de Store, en de stickerkeuze toont het bij Winkel
assert.match(lees('store.js'), /STORE_STICKERS = STORE_VELLEN\.map/)
assert.match(lees('store.js'), /\.\.\.STORE_GAMES, \.\.\.STORE_STICKERS\]/)
assert.match(lees('store.html'), /it\.soort === 'sticker'/)
assert.match(lees('stickerkeuze.js'), /actieveStoreVellen\(id\)/, 'de chat toont alleen de vellen die je bij Stijl aanzette')

// 5. Overal mag de code f7 (berichten, spelchat, moods, widgets)
for (const [f, re] of [['chat.html', /SPELSTICKER_CODE = \/\^\(f\[1-7\]\|e\[12\]\)/], ['spelchat-crypto.js', /\(f\[1-7\]\|e\[12\]\)/],
  ['moodsticker.js', /f\[1-7\]\|e\[12\]/], ['stickerwidget.js', /f\[1-7\]\|e\[12\]/], ['index.html', /f\[1-7\]\|e\[12\]/], ['profiel.html', /f\[1-7\]\|e\[12\]/]])
  assert.match(lees(f), re, f + ' kent f7')

// 6. De Engelse teksten
const en = lees('taal-en.js')
for (const z of ['Hier komen de stickervellen uit de Stekky Store. Na downloaden zet je ze aan bij Stijl, bij Stickers.', 'Gedownload! Zet ze aan bij Stijl → Stickers, dan staan ze in de chat.', 'Sticker {naam} bekijken'])
  assert.ok(en.includes(JSON.stringify(z) + ':'), 'Engels voor ' + z)
console.log('stickervel 7 (Sinterklaas, Store): ok')
