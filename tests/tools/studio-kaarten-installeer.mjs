// studio-kaarten-installeer.mjs (25 nov 2026): zet speelkaarten uit Stekky Studio (naam.stekkykaarten.json, kaartmaker.js)
// in de app.
//   node tests/tools/studio-kaarten-installeer.mjs <naam.stekkykaarten.json> [--basis origin/main] [--zonder-versies] [--map <hoofdmap>]
// Wat het doet:
//   1. Kijkt het pakket na (kaartmaker.js valideerKaartset), en of er nog geen kaarten met die naam zijn.
//   2. Zet de plaatjes neer in kaarten/<id>/<kaart>.webp.
//   3. Zet de set in studio-kaarten.js. Daarmee staat hij vanzelf bij "Kies je kaarten" in elk kaartspel (kaartspel-hulp.js).
//   4. Verhoogt de ?v=-nummers die daardoor omhoog moeten (tests/tools/verhoog-versies.mjs).
// Er wordt niets gepubliceerd: het gaat in een pull request en Marcel of Tijn zegt "Merge".
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const vlag = (naam, metWaarde = false) => { const i = argv.indexOf(naam); if (i < 0) return metWaarde ? null : false; return metWaarde ? argv[i + 1] : true }
const HOOFD = path.resolve(vlag('--map', true) || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'))
const bestand = argv.find(a => !a.startsWith('--') && a !== vlag('--basis', true) && a !== vlag('--map', true))
if (!bestand) { console.error('Gebruik: node tests/tools/studio-kaarten-installeer.mjs <naam.stekkykaarten.json>'); process.exit(2) }
const stop = t => { console.error(t); process.exit(1) }

globalThis.window ||= {}
const nu = Date.now()
const { valideerKaartset, nodig } = await import(pathToFileURL(path.join(HOOFD, 'kaartmaker.js')).href + '?x=' + nu)
const dataPad = path.join(HOOFD, 'studio-kaarten.js')
const { STUDIO_KAARTSETS } = await import(pathToFileURL(dataPad).href + '?x=' + nu)

let set
try { set = JSON.parse(readFileSync(bestand, 'utf8')) } catch (e) { stop('Dit bestand is geen geldige JSON.') }
const fouten = valideerKaartset(set, { bestaand: STUDIO_KAARTSETS.map(s => s.id) })
if (fouten.length) stop('Het kaartpakket klopt niet:\n  - ' + fouten.join('\n  - '))
const map = path.join(HOOFD, 'kaarten', set.id)
if (existsSync(map)) stop('Deze map bestaat al: kaarten/' + set.id)

// 2. De plaatjes
mkdirSync(map, { recursive: true })
for (const n of nodig(set.soort)) writeFileSync(path.join(map, n + '.webp'), Buffer.from(set.kaarten[n].split(',')[1], 'base64'))

// 3. In studio-kaarten.js
const nieuw = { id: set.id, naam: set.naam, soort: set.soort, kleur: set.kleur, v: 1 }
const bron = readFileSync(dataPad, 'utf8')
const lijst = /export const STUDIO_KAARTSETS = \[[\s\S]*?\]\n/
if (!lijst.test(bron)) stop('studio-kaarten.js is veranderd: de lijst staat er niet meer zoals verwacht.')
writeFileSync(dataPad, bron.replace(lijst, () => 'export const STUDIO_KAARTSETS = [\n' + [...STUDIO_KAARTSETS, nieuw].map(s => '  ' + JSON.stringify(s) + ',').join('\n') + '\n]\n'))
console.log('Kaarten "' + set.naam[0] + '" staan nu in de app als ' + set.id + ' (' + nodig(set.soort).length + ' plaatjes in kaarten/' + set.id + '/).')

// 4. Versies
if (!vlag('--zonder-versies')) {
  const basis = vlag('--basis', true) || 'origin/main'
  console.log(execFileSync('node', [path.join(HOOFD, 'tests/tools/verhoog-versies.mjs'), basis], { encoding: 'utf8', cwd: HOOFD }).trim())
}
