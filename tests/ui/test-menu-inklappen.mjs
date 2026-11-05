// v268 (5 nov 2026): de paarse kopjes in het menu (☰) op Home klappen open en dicht. Standaard dicht, met een grijs
// regeltje wat erin zit; Fibro onthoudt wat je openzette (fibro_menu_open).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../taal-en.js', import.meta.url), 'utf8')
const begin = index.indexOf('window.openMenu = function()'), eind = index.indexOf('async function openBewaren()')
const menu = index.slice(begin, eind)
assert.ok(begin > 0 && eind > begin)
assert.match(menu, /k\.setAttribute\('aria-expanded', open \? 'true' : 'false'\)/, 'kopje zegt of het open is')
assert.match(menu, /lijst\.hidden = !open/, 'dicht = verborgen')
assert.match(menu, /zet\(menuOpen\.includes\(id\)\)/, 'standaard dicht, tenzij je het openzette')
assert.match(menu, /localStorage\.setItem\('fibro_menu_open'/, 'onthouden')
const koppen = [...menu.matchAll(/groep\(T\('([^']+)'\), '(menuKop\w+)', T\('([^']+)'\)\)/g)]
assert.deepEqual(koppen.map(k => k[2]), ['menuKopInstellingen', 'menuKopPush', 'menuKopAccount', 'menuKopFibro', 'menuKopModerator'], 'elk kopje inklapbaar met een regeltje')
for (const k of koppen) assert.ok(en.includes(JSON.stringify(k[3]) + ':'), 'Engels voor: ' + k[3])
console.log('test-menu-inklappen: alles goed')
