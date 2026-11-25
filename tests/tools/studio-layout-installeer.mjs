// studio-layout-installeer.mjs (25 nov 2026): zet een widget-layout uit Stekky Studio in de app (layouts.js).
//   node tests/tools/studio-layout-installeer.mjs <naam.stekkylayout.json> [--basis origin/main] [--zonder-versies] [--map <hoofdmap>]
// Wat het doet:
//   1. Kijkt het bestand na (layouts.js valideerLayout: 2 tot 4 vakken, binnen de layout, niet over elkaar, elke soort één keer).
//   2. Kiest het volgende id (l1, l2, ...) en een Store-id (layout-<naam>), en zet de layout in studio-layouts.js.
//   3. Verhoogt de ?v=-nummers die daardoor omhoog moeten (tests/tools/verhoog-versies.mjs).
// Er wordt niets gepubliceerd: het gaat in een pull request en Marcel of Tijn zegt "Merge".
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const vlag = (naam, metWaarde = false) => { const i = argv.indexOf(naam); if (i < 0) return metWaarde ? null : false; return metWaarde ? argv[i + 1] : true }
const HOOFD = path.resolve(vlag('--map', true) || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'))
const bestand = argv.find(a => !a.startsWith('--') && a !== vlag('--basis', true) && a !== vlag('--map', true))
if (!bestand) { console.error('Gebruik: node tests/tools/studio-layout-installeer.mjs <naam.stekkylayout.json>'); process.exit(2) }

globalThis.window ||= {}
const { valideerLayout } = await import(pathToFileURL(path.join(HOOFD, 'layouts.js')).href + '?x=' + Date.now())
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'layout' // zelfde als in studio-layout-ui.js

let layout
try { layout = JSON.parse(readFileSync(bestand, 'utf8')) } catch (e) { console.error('Dit bestand is geen geldige JSON.'); process.exit(1) }
const fouten = valideerLayout(layout)
if (fouten.length) { console.error('De layout klopt niet:\n  - ' + fouten.join('\n  - ')); process.exit(1) }

const dataPad = path.join(HOOFD, 'studio-layouts.js')
const nu = (await import(pathToFileURL(dataPad).href + '?x=' + Date.now())).STUDIO_LAYOUTS
const store = 'layout-' + slug(layout.titel)
if (nu.some(l => l.store === store)) { console.error('Deze layout staat al in de app (' + store + ').'); process.exit(1) }
if (new RegExp("id: '" + store + "'").test(readFileSync(path.join(HOOFD, 'store.js'), 'utf8'))) { console.error('Dit id bestaat al: ' + store); process.exit(1) }
const id = 'l' + (Math.max(0, ...nu.map(l => Number(String(l.id).slice(1)) || 0)) + 1)
const nieuw = { id, store, titel: layout.titel.trim(), uitleg: layout.uitleg.map(t => t.trim()), h: layout.h,
  vakken: layout.vakken.map(v => Object.assign({ soort: v.soort, x: v.x, y: v.y, w: v.w, h: v.h }, v.inhoud ? { inhoud: v.inhoud } : {})) } // 25 nov 2026: ook kant-en-klare inhoud

const bron = readFileSync(dataPad, 'utf8')
const kop = bron.slice(0, bron.indexOf('export const STUDIO_LAYOUTS'))
const tekst = l => '  { id: ' + JSON.stringify(l.id) + ', store: ' + JSON.stringify(l.store) + ', titel: ' + JSON.stringify(l.titel) + ',\n    uitleg: ' + JSON.stringify(l.uitleg) +
  ',\n    h: ' + l.h + ', vakken: [\n' + l.vakken.map(v => '      { soort: ' + JSON.stringify(v.soort) + ', x: ' + v.x + ', y: ' + v.y + ', w: ' + v.w + ', h: ' + v.h + (v.inhoud ? ',\n        inhoud: ' + JSON.stringify(v.inhoud) : '') + ' },').join('\n') + '\n    ] },'
writeFileSync(dataPad, kop + 'export const STUDIO_LAYOUTS = [\n' + [...nu, nieuw].map(tekst).join('\n') + '\n]\n')
console.log('Layout "' + nieuw.titel + '" staat nu als ' + id + ' in de app (Store-id ' + store + ', widget mix_' + id + ').')

if (!vlag('--zonder-versies')) {
  const basis = vlag('--basis', true) || 'origin/main'
  console.log(execFileSync('node', [path.join(HOOFD, 'tests/tools/verhoog-versies.mjs'), basis], { encoding: 'utf8', cwd: HOOFD }).trim())
}
