// studio-spel-installeer.mjs (25 nov 2026): zet een spel uit Stekky Studio (naam.stekkyspel.json, spelmaker.js) in de app.
//   node tests/tools/studio-spel-installeer.mjs <naam.stekkyspel.json> [--basis origin/main] [--zonder-versies] [--map <hoofdmap>]
// Wat het doet:
//   1. Kijkt het bestand na (spelmaker.js valideerSpel), en of het spel er nog niet is.
//   2. Zet het spelicoon neer (spelicoon/<id>.webp, 128 x 128).
//   3. Zet een werkend beginspel neer: <id>-ui.js en <id>.js uit het sjabloon dat bij het spel past (27 nov 2026):
//        beurtspel                     sjabloon-beurtspel(-ui).js  (om de beurt, met z'n tweeën)
//        kaartspel met een vriend      sjabloon-kaartspel(-ui).js  (2 tot 6 spelers, groepspel.js; "max" komt er vanzelf bij)
//        kaartspel zonder vriend       sjabloon-automaat(-ui).js   (alleen spelen, zoals Video Poker; "zonderKanaal")
//        arcadespel                    sjabloon-arcade(-ui).js     (alleen, punten en record; "arcade")
//      Zo staat het spel meteen overal en kun je het al spelen.
//   4. Zet het spel in studio-spellen.js. Daarmee staat het vanzelf in de Store, het spelmenu van de chat, spel.html,
//      Home, Profiel > Widgets, uitnodigingen en (als gekozen) met een titelscherm.
//   5. Schrijft de bouwopdracht: spellen/<id>.md (alles wat in de Studio is ingevuld) en spellen/<id>.stekkyspel.json.
//   6. Verhoogt de ?v=-nummers die daardoor omhoog moeten (tests/tools/verhoog-versies.mjs).
// Meer spelers (kaarten.spelers > 2): het kaartspel-sjabloon kan dat al (2 tot 6), dus `max` staat er meteen bij.
// Er wordt niets gepubliceerd: het gaat in een pull request. Daarna bouwt Claude de echte regels (spellen/<id>.md), en
// Marcel of Tijn zegt "Merge".
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const vlag = (naam, metWaarde = false) => { const i = argv.indexOf(naam); if (i < 0) return metWaarde ? null : false; return metWaarde ? argv[i + 1] : true }
const HOOFD = path.resolve(vlag('--map', true) || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'))
const bestand = argv.find(a => !a.startsWith('--') && a !== vlag('--basis', true) && a !== vlag('--map', true))
if (!bestand) { console.error('Gebruik: node tests/tools/studio-spel-installeer.mjs <naam.stekkyspel.json>'); process.exit(2) }
const stop = t => { console.error(t); process.exit(1) }

globalThis.window ||= {}
const nu = Date.now()
const { valideerSpel, bouwopdracht, sjabloonVoor } = await import(pathToFileURL(path.join(HOOFD, 'spelmaker.js')).href + '?x=' + nu)
const dataPad = path.join(HOOFD, 'studio-spellen.js')
const { STUDIO_SPELLEN } = await import(pathToFileURL(dataPad).href + '?x=' + nu)

let spel
try { spel = JSON.parse(readFileSync(bestand, 'utf8')) } catch (e) { stop('Dit bestand is geen geldige JSON.') }
const fouten = valideerSpel(spel, { bestaand: STUDIO_SPELLEN.map(s => s.id) })
if (!spel.plaatje) fouten.push('Het spelicoon ontbreekt (maak het bestand opnieuw in de Studio).')
if (fouten.length) stop('Het spel klopt niet:\n  - ' + fouten.join('\n  - '))
const id = spel.id
for (const f of [id + '-ui.js', id + '.js', 'spelicoon/' + id + '.webp']) if (existsSync(path.join(HOOFD, f))) stop('Dit bestand bestaat al: ' + f)

// 2. Het spelicoon (de Studio maakt webp; png wordt hier webp gemaakt)
const [, soort, b64] = /^data:image\/(webp|png);base64,(.+)$/.exec(spel.plaatje)
const icoonPad = path.join(HOOFD, 'spelicoon', id + '.webp')
if (soort === 'webp') writeFileSync(icoonPad, Buffer.from(b64, 'base64'))
else {
  const tmp = icoonPad + '.png'
  writeFileSync(tmp, Buffer.from(b64, 'base64'))
  try { execFileSync('python3', ['-I', '-c', 'import sys,os\nfrom PIL import Image\nImage.open(sys.argv[1]).convert("RGBA").resize((128,128)).save(sys.argv[2],"WEBP",quality=90)\nos.remove(sys.argv[1])', tmp, icoonPad]) }
  catch (e) { stop('Het icoon kon niet naar webp (is python3 met Pillow er?).') }
}

// 3. Het beginspel uit het passende sjabloon
const sjabloon = sjabloonVoor(spel)
const BLAUWDRUK = { beurtspel: 'BLAUWDRUK-BEURTSPEL.md', kaartspel: 'BLAUWDRUK-KAARTSPEL.md', automaat: 'BLAUWDRUK-KAARTSPEL.md', arcade: 'BLAUWDRUK-ARCADE.md' }
const kop = (wat) => '// ' + id + wat + ' (uit Stekky Studio, sjabloon ' + sjabloon + ') - ' + spel.naam[0] + ' ' + spel.icoon + '.\n' +
  '// BEGINSPEL uit het sjabloon. De echte regels staan in spellen/' + id + '.md: bouw die hier (zie ' + BLAUWDRUK[sjabloon] + ' en BOUWSTENEN.md).\n//\n'
let ui = readFileSync(path.join(HOOFD, 'sjabloon-' + sjabloon + '-ui.js'), 'utf8')
const titelRegel = ui.split('\n').find(r => r.includes('// STUDIO-TITEL'))
if (!titelRegel) stop('Het sjabloon is veranderd: de titelregel (// STUDIO-TITEL) staat er niet meer in.')
const inspring = titelRegel.match(/^\s*/)[0]
ui = ui.replace(titelRegel, inspring + 'if (titel) titel.textContent = ' + JSON.stringify(spel.icoon + ' ') + ' + T(' + JSON.stringify(spel.naam[0]) + ')')
// de regels van het sjabloon worden de regels van dit spel
ui = ui.replace(new RegExp("\\./sjabloon-" + sjabloon + "\\.js\\?v=\\d+", 'g'), './' + id + '.js?v=1')
writeFileSync(path.join(HOOFD, id + '-ui.js'), kop('-ui.js') + ui)
writeFileSync(path.join(HOOFD, id + '.js'), kop('.js') + readFileSync(path.join(HOOFD, 'sjabloon-' + sjabloon + '.js'), 'utf8'))

// 4. In studio-spellen.js
const nieuw = { id, soort: spel.soort, naam: spel.naam, icoon: spel.icoon, uitleg: spel.uitleg, v: 1,
  met: { vriend: spel.met.vriend, computer: true, chatbalk: spel.met.chatbalk, webcam: spel.met.webcam }, spraak: spel.spraak, titel: spel.titel }
if (sjabloon === 'kaartspel' && (spel.kaarten.spelers || 2) > 2) nieuw.max = Math.min(6, spel.kaarten.spelers)
if (sjabloon === 'automaat') nieuw.zonderKanaal = true
if (sjabloon === 'arcade') nieuw.arcade = true
const bron = readFileSync(dataPad, 'utf8')
const lijst = /export const STUDIO_SPELLEN = \[[\s\S]*?\]\n/
if (!lijst.test(bron)) stop('studio-spellen.js is veranderd: de lijst staat er niet meer zoals verwacht.')
const alles = [...STUDIO_SPELLEN, nieuw]
writeFileSync(dataPad, bron.replace(lijst, () => 'export const STUDIO_SPELLEN = [\n' + alles.map(s => '  ' + JSON.stringify(s) + ',').join('\n') + '\n]\n'))

// 5. De bouwopdracht
mkdirSync(path.join(HOOFD, 'spellen'), { recursive: true })
writeFileSync(path.join(HOOFD, 'spellen', id + '.md'), bouwopdracht(spel))
const zonderPlaatje = { ...spel }; delete zonderPlaatje.plaatje
writeFileSync(path.join(HOOFD, 'spellen', id + '.stekkyspel.json'), JSON.stringify(zonderPlaatje, null, 2) + '\n')

console.log('Spel "' + spel.naam[0] + '" staat nu in de app als ' + id + ' (Store, chat, spel.html, Home). Bouwopdracht: spellen/' + id + '.md')

// 6. Versies
if (!vlag('--zonder-versies')) {
  const basis = vlag('--basis', true) || 'origin/main'
  console.log(execFileSync('node', [path.join(HOOFD, 'tests/tools/verhoog-versies.mjs'), basis], { encoding: 'utf8', cwd: HOOFD }).trim())
}
