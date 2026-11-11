// Kaartstijl kiezen (11 nov 2026, kaartspel-hulp.js v3): de gewone Stekky-kaarten of de perkamentkaarten van Marcel.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const opslag = new Map()
globalThis.localStorage = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)) }
const gezien = []
globalThis.window = { dispatchEvent: e => gezien.push(e) }
globalThis.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o?.detail } }
const K = await import('../../kaartspel-hulp.js')

// 1. Zonder keuze: de gewone getekende kaarten
assert.equal(K.kaartStijl(), 'stekky')
assert.match(K.kaartSvg('hA'), /^<svg /); assert.match(K.achterkantSvg(), /^<svg /)

// 2. Perkament kiezen: plaatjes, en een seintje zodat de tafel meteen ververst
K.zetKaartStijl('perkament')
assert.equal(K.kaartStijl(), 'perkament'); assert.equal(opslag.get('fibro_kaartstijl'), 'perkament')
assert.equal(gezien.at(-1)?.type, 'fibro-kaartstijl')
const src = html => html.match(/src="\.\/([^"?]+)\?v=\d+"/)?.[1]
const alle = ['J1', 'J2']; for (const k of K.KAART_KLEUREN) for (const w of K.KAART_WAARDEN) alle.push(k + w)
const bestanden = new Set()
for (const id of alle) {
  const html = K.kaartSvg(id)
  assert.match(html, /^<img class="kt-svg kt-img" /, id + ' is een plaatje')
  assert.ok(existsSync(new URL('../../' + src(html), import.meta.url)), id + ': ' + src(html) + ' bestaat')
  bestanden.add(src(html))
}
assert.equal(bestanden.size, 53, '52 kaarten en een joker')
assert.equal(src(K.kaartSvg('J1')), 'kaarten/perkament/joker.webp')
assert.equal(src(K.achterkantSvg()), 'kaarten/perkament/achterkant.webp', 'eigen achterkant')
assert.ok(existsSync(new URL('../../kaarten/perkament/achterkant.webp', import.meta.url)))
assert.match(K.kaartSvg('hA', 'stekky'), /^<svg /, 'een voorbeeld in een andere stijl kan altijd')
assert.match(K.achterkantSvg('stekky'), /^<svg /)

// 3. Onbekende stijl: niets veranderen
K.zetKaartStijl('bestaat-niet'); assert.equal(K.kaartStijl(), 'perkament')
opslag.set('fibro_kaartstijl', 'kapot'); assert.equal(K.kaartStijl(), 'stekky', 'rare waarde = gewone kaarten')

// 4. De knop 🎴 op tafel, en de service worker bewaart de plaatjes
const hulp = lees('kaartspel-hulp.js')
assert.match(hulp, /kt-stijlknop/); assert.match(hulp, /addEventListener\('fibro-kaartstijl', nieuweStijl\)/)
assert.match(lees('service-worker.js'), /kaarten\\\/\[a-z\]\+/, 'kaartplaatjes in de mediakast')
console.log('kaartstijl: ok')
