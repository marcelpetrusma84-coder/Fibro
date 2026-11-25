// test-layouts.mjs (25 nov 2026): widget-layouts uit Stekky Studio (layouts.js, studio-layouts.js, het installatie-script).
//  1. de sjablonen zijn geldig; valideerLayout houdt foute layouts tegen
//  2. het installatie-script zet een layout in een kopie van de app (l1, l2 ...), en weigert dubbele of foute
//  3. layoutVan / mixWidgetDef, en alles is aangesloten (Store, Home, vrienden, Profiel, Studio)
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const lees = f => readFileSync(path.join(REPO, f), 'utf8')
globalThis.window = {}
const L = await import(pathToFileURL(path.join(REPO, 'layouts.js')).href)

// ── 1. sjablonen en controle ──
for (const s of L.SJABLONEN) {
  const l = L.maakLayout({ titel: 'Test', uitleg: ['Uitleg', 'Explanation'], sjabloon: s.id })
  assert.deepEqual(L.valideerLayout(l), [], 'sjabloon ' + s.id + ' is geldig')
  assert.equal(l.vakken.length, s.vakken.length)
  // de vakken vullen de hele layout (geen gaten)
  assert.equal(l.vakken.reduce((n, v) => n + v.w * v.h, 0), L.BREED * l.h, 'sjabloon ' + s.id + ' heeft geen gaten')
}
const goed = L.maakLayout({ titel: '  Video  en nieuws ', uitleg: ['Een video met nieuws.', 'A video with news.'], sjabloon: 'drie', soorten: ['peertube', 'muziekwidget', 'rss'] })
assert.equal(goed.titel, 'Video en nieuws')
assert.deepEqual(goed.vakken.map(v => v.soort), ['peertube', 'muziekwidget', 'rss'])
const fout = wijzig => { const l = JSON.parse(JSON.stringify(goed)); wijzig(l); return L.valideerLayout(l) }
assert.deepEqual(L.valideerLayout(goed), [])
assert.match(L.valideerLayout(null)[0], /geen layoutbestand/)
assert.match(L.valideerLayout({ formaat: 'stekky-stickerpakket' })[0], /geen layoutbestand/)
assert.match(fout(l => { l.titel = '' }).join(), /naam van de layout ontbreekt/)
assert.match(fout(l => { l.titel = 'x'.repeat(41) }).join(), /te lang/)
assert.match(fout(l => { l.uitleg = ['alleen nl'] }).join(), /Nederlands en het Engels/)
assert.match(fout(l => { l.vakken[2].soort = 'rss'; l.vakken[1].soort = 'rss' }).join(), /staat er al in/, 'elke soort één keer')
assert.match(fout(l => { l.vakken[0].soort = 'youtube' }).join(), /onbekende soort/)
assert.match(fout(l => { l.vakken[1].x = 1 }).join(), /over een ander vak/)
assert.match(fout(l => { l.vakken[2].x = 3 }).join(), /buiten de layout/)
assert.match(fout(l => { l.vakken[0].y = 5 }).join(), /buiten de layout/)
assert.match(fout(l => { l.vakken = l.vakken.slice(0, 1) }).join(), /2 tot 4 vakken/)
assert.match(fout(l => { l.vakken.push({ soort: 'radio', x: 0, y: 0, w: 1, h: 1 }, { soort: 'mastodon', x: 0, y: 0, w: 1, h: 1 }) }).join(), /2 tot 4 vakken/)
assert.match(fout(l => { l.h = 9 }).join(), /hoogte/)
assert.match(fout(l => { l.vakken[0].w = 2.5 }).join(), /buiten de layout/)
console.log('PASS: sjablonen zijn geldig; valideerLayout houdt foute layouts tegen')

// ── 2. het installatie-script, in een tijdelijke kopie ──
const tmp = mkdtempSync(path.join(tmpdir(), 'layouts-'))
writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
for (const f of ['layouts.js', 'studio-layouts.js', 'store.js']) copyFileSync(path.join(REPO, f), path.join(tmp, f))
writeFileSync(path.join(tmp, 'studio-layouts.js'), lees('studio-layouts.js').replace(/export const STUDIO_LAYOUTS = [\s\S]*$/, 'export const STUDIO_LAYOUTS = []\n'))
mkdirSync(path.join(tmp, 'tests/tools'), { recursive: true })
copyFileSync(path.join(REPO, 'tests/tools/studio-layout-installeer.mjs'), path.join(tmp, 'tests/tools/studio-layout-installeer.mjs'))
const installeer = (layout, naam) => {
  const b = path.join(tmp, naam); writeFileSync(b, typeof layout === 'string' ? layout : JSON.stringify(layout))
  return spawnSync('node', [path.join(tmp, 'tests/tools/studio-layout-installeer.mjs'), b, '--map', tmp, '--zonder-versies'], { encoding: 'utf8' })
}
let r = installeer(goed, 'a.json')
assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /als l1 in de app.*layout-video-en-nieuws.*mix_l1/)
r = installeer(goed, 'b.json'); assert.notEqual(r.status, 0); assert.match(r.stderr, /staat al in de app/, 'dezelfde layout geen twee keer')
r = installeer({ ...goed, titel: 'Muziek & berichten', vakken: [{ soort: 'muziekwidget', x: 0, y: 0, w: 2, h: 3 }, { soort: 'mastodon', x: 2, y: 0, w: 2, h: 3 }], h: 3 }, 'c.json')
assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /als l2/)
r = installeer({ ...goed, titel: 'Kapot', vakken: [goed.vakken[0], goed.vakken[0]] }, 'd.json'); assert.notEqual(r.status, 0); assert.match(r.stderr, /klopt niet/)
r = installeer('geen json', 'e.json'); assert.notEqual(r.status, 0)
const data = await import(pathToFileURL(path.join(tmp, 'studio-layouts.js')).href + '?x=1')
assert.deepEqual(data.STUDIO_LAYOUTS.map(l => [l.id, l.store, l.titel, l.h]), [['l1', 'layout-video-en-nieuws', 'Video en nieuws', 6], ['l2', 'layout-muziek-berichten', 'Muziek & berichten', 3]])
assert.deepEqual(data.STUDIO_LAYOUTS[0].vakken, goed.vakken)
console.log('PASS: het installatie-script zet layouts in de app (l1, l2) en weigert dubbele of foute')

// ── 3. layoutVan, mixWidgetDef en de aansluiting ──
assert.equal(L.layoutVan('mix_l1', data.STUDIO_LAYOUTS).titel, 'Video en nieuws')
assert.equal(L.layoutVan('mix_l9', data.STUDIO_LAYOUTS), null)
assert.equal(L.layoutVan('peertube', data.STUDIO_LAYOUTS), null)
assert.equal(L.layoutVan('mix_x', [{ id: 'x', titel: 'Kapot', uitleg: ['a', 'b'], h: 2, vakken: [{ soort: 'rss', x: 0, y: 0, w: 4, h: 4 }, { soort: 'radio', x: 0, y: 0, w: 1, h: 1 }] }]), null, 'een kapotte layout wordt niet getekend')
assert.deepEqual(L.mixWidgetDef('mix_l2', data.STUDIO_LAYOUTS), { id: 'mix_l2', icon: '🧩', titel: 'Muziek & berichten', w: 4, h: 3 })
assert.deepEqual(L.valideerLayout({ formaat: L.FORMAAT, versie: 1, ...data.STUDIO_LAYOUTS[0] }), [])
// de echte lijst in de app is altijd geldig
for (const l of (await import(pathToFileURL(path.join(REPO, 'studio-layouts.js')).href)).STUDIO_LAYOUTS)
  assert.deepEqual(L.valideerLayout({ formaat: L.FORMAAT, versie: 1, ...l }), [], 'layout ' + l.id + ' in de app is geldig')
// alleen widgets die een vak kunnen zijn (bestaande Store-widgets)
assert.deepEqual(Object.keys(L.VAK_SOORTEN), ['peertube', 'muziekwidget', 'radio', 'rss', 'mastodon'])
assert.match(lees('store.js'), /\.\.\.STUDIO_LAYOUTS\.map\(l => \(\{ id: l\.store, soort: 'widget', titel: l\.titel, widget: 'mix_' \+ l\.id/)
assert.match(lees('index.html'), /\} else if \(id\.startsWith\('mix_'\)\) \{\n    renderMix\(c, id, window\._uid\)[^\n]*\n  \} else if \(id\.startsWith\('spel_'\)\)/)
assert.match(lees('index.html'), /const teken = \{ peertube: renderPeertube, muziekwidget: renderMuziekwidget, radio: renderRadio, rss: renderRss, mastodon: renderMastodon \}/)
assert.match(lees('vriend-profiel.html'), /if \(String\(w\.id \|\| ''\)\.startsWith\('mix_'\)\) \{/)
assert.match(lees('profiel.html'), /WMAP\[n\] \|\| stickerWidgetDef\(n\) \|\| mixWidgetDef\(n\)/)
assert.match(lees('studio.html'), /import '\.\/studio-layout-ui\.js\?v=1'/)
assert.match(lees('store.html'), /it\.layout \? layoutVoorbeeld\(it\.widget\)/)
console.log('PASS: layouts staan in de Store, op Home, bij vrienden, in Profiel en in de Studio')
