// studio-scorebord-installeer.mjs (26 nov 2026): zet de scoreborden uit Stekky Studio in de app (scoreborden.js).
//   node tests/tools/studio-scorebord-installeer.mjs <scoreborden.stekky.json> [--basis origin/main] [--zonder-versies] [--map <hoofdmap>]
// Wat het doet:
//   1. Kijkt het bestand na (scorespellen.js valideerScoreborden: bekende spellen, aan ja/nee, een bekende stijl, korte titel).
//   2. Schrijft scoreborden.js opnieuw. Alleen wat afwijkt van de standaard (aan, neon, geen titel) komt erin.
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
if (!bestand) { console.error('Gebruik: node tests/tools/studio-scorebord-installeer.mjs <scoreborden.stekky.json>'); process.exit(2) }

globalThis.window ||= {}
const { valideerScoreborden } = await import(pathToFileURL(path.join(HOOFD, 'scorespellen.js')).href + '?x=' + Date.now())

let invoer
try { invoer = JSON.parse(readFileSync(bestand, 'utf8')) } catch (e) { console.error('Dit bestand is geen geldige JSON.'); process.exit(1) }
const fouten = valideerScoreborden(invoer)
if (fouten.length) { console.error('Het scorebordenbestand klopt niet:\n  - ' + fouten.join('\n  - ')); process.exit(1) }

// Alleen wat afwijkt van de standaard bewaren; zo blijft het bestand kort en is te zien wat Studio veranderde
const afwijkend = Object.entries(invoer.scoreborden)
  .map(([id, k]) => [id, { aan: k.aan, stijl: k.stijl, titel: k.titel.trim() }])
  .filter(([, k]) => !k.aan || k.stijl !== 'neon' || k.titel)
  .sort(([a], [b]) => a.localeCompare(b))

const pad = path.join(HOOFD, 'scoreborden.js')
const bron = readFileSync(pad, 'utf8')
const kop = bron.slice(0, bron.indexOf('export const SCOREBORDEN'))
const regel = ([id, k]) => '  ' + JSON.stringify(id) + ': { aan: ' + k.aan + ', stijl: ' + JSON.stringify(k.stijl) + ', titel: ' + JSON.stringify(k.titel) + ' },'
writeFileSync(pad, kop + 'export const SCOREBORDEN = {' + (afwijkend.length ? '\n' + afwijkend.map(regel).join('\n') + '\n' : '') + '}\n')
const uit = afwijkend.filter(([, k]) => !k.aan).map(([id]) => id)
console.log('De scoreborden staan nu in scoreborden.js: ' + afwijkend.length + ' spel(len) met een eigen keuze' + (uit.length ? ' (uit: ' + uit.join(', ') + ')' : '') + '.')

if (!vlag('--zonder-versies')) {
  const basis = vlag('--basis', true) || 'origin/main'
  console.log(execFileSync('node', [path.join(HOOFD, 'tests/tools/verhoog-versies.mjs'), basis], { encoding: 'utf8', cwd: HOOFD }).trim())
}
