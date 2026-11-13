// Stickervakken (13 nov 2026, Marcel): een gedownload stickervel uit de Store staat eerst alleen bij Stijl > Stickers.
// Daar zet je het aan (dan komt het in een Winkelvakje van de chat) of verwijder je het.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const pad = p => new URL('../../' + p, import.meta.url)
const lees = p => readFileSync(pad(p), 'utf8')
const opslag = new Map()
globalThis.localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)), removeItem: k => opslag.delete(k) }
const V = await import(pad('stickervakken.js'))
const sint = 'stickers-sinterklaas'
const ids = uid => V.actieveStoreVellen(uid).map(v => v.store)

// 1. Oude toestellen (nog geen fibro_stickervakken_): wat je al gedownload had, blijft in de chat staan
opslag.set('fibro_store_oud', JSON.stringify([sint]))
assert.deepEqual(ids('oud'), [sint])
// 2. Een nieuwe download staat eerst uit (de Store legt de stand vast vóór het downloaden)
V.legStoreVakkenVast('nieuw')
opslag.set('fibro_store_nieuw', JSON.stringify([sint]))
assert.deepEqual(ids('nieuw'), []); assert.equal(V.isStoreVelActief('nieuw', sint), false)
// 3. Aanzetten bij Stijl = in een vakje; uitzetten = weg; niet gedownload = kan niet
assert.equal(V.zetStoreVelActief('nieuw', sint, true), true); assert.deepEqual(ids('nieuw'), [sint])
assert.equal(V.zetStoreVelActief('nieuw', sint, true), true); assert.deepEqual(ids('nieuw'), [sint], 'niet dubbel')
assert.equal(V.zetStoreVelActief('nieuw', sint, false), true); assert.deepEqual(ids('nieuw'), [])
assert.equal(V.zetStoreVelActief('leeg', sint, true), false)
// 4. Verwijderd uit de Store = ook niet meer in de chat
V.zetStoreVelActief('nieuw', sint, true); opslag.set('fibro_store_nieuw', '[]')
assert.deepEqual(ids('nieuw'), [])
opslag.set('fibro_stickervakken_x', 'kapot'); opslag.set('fibro_store_x', JSON.stringify([sint])); assert.deepEqual(ids('x'), [sint], 'kapotte opslag = zoals vroeger')
assert.equal(V.WINKEL_VAKJES, 4)

// 5. Waar het zit: de chat leest de actieve vellen, de Store zet nieuwe stickers uit en haalt verwijderde weg,
//    Stijl > Stickers heeft een lijst met een schakelaar en Verwijderen
assert.match(lees('stickerkeuze.js'), /winkel = id \? actieveStoreVellen\(id\) : \[\]/)
const store = lees('store.js')
assert.match(store, /STORE_STICKERS\.some\(s => s\.id === id\) && !bewaardeDownloads\(uid\)\.has\(id\)\) legStoreVakkenVast\(uid\)/)
assert.match(store, /zetStoreVelActief\(uid, id, false\)/); assert.match(store, /zetGameWidgetUit\(uid, 'sticker_' \+ vel\.vel/, 'verwijderd = ook van Home')
const profiel = lees('profiel.html')
const paneel = profiel.slice(profiel.indexOf('id="panel-stickers"'), profiel.indexOf('</main>'))
assert.match(paneel, /id="eigenStickers"[\s\S]*id="storeStickersSectie"[\s\S]*id="fibroStickers"/, 'bij Stijl > Stickers, onder het Stickerlab')
assert.match(profiel, /function bouwStoreStickers\(ids\)/); assert.match(profiel, /maakSchakelaar\(widgetId\(code\)/, 'elke sticker een knopje 🏠'); assert.match(profiel, /speelSticker\(img,st\)/, 'tik = beweging en geluid'); assert.match(profiel, /zetStoreVelActief\(uid,it\.id,!aan\)/); assert.match(profiel, /verwijderDownload\(supabase,uid,it\.id\)/)
const en = lees('taal-en.js')
for (const z of ['{naam} in de chat', 'Alle {n} vakjes in de chat zijn vol. Zet eerst een ander stickervel uit.', 'In de chat: Winkelvak {n}',
  'Staat uit: zet het aan, dan staat het in de chat bij Stickers → Winkel'])
  assert.ok(en.includes(JSON.stringify(z) + ':'), 'Engels voor ' + z)
console.log('stickervakken: ok')
