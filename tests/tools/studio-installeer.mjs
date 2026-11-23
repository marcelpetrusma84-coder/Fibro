// studio-installeer.mjs (23 nov 2026, Stekky Studio stap 1): zet een pakketbestand van de Studio in de app.
//   node tests/tools/studio-installeer.mjs <pakket.stekkypakket.json> [--basis origin/main] [--zonder-versies] [--map <hoofdmap>]
// Wat het doet:
//   1. Kijkt het pakket na (studio-pakket.js: precies 12 stickers, bestaande bewegingen en geluiden, echte WebP-plaatjes).
//   2. Kiest het volgende vel-nummer (f8, f9, ...) en zet de plaatjes in stickers/<fN>/01.webp t/m 12.webp.
//   3. Zet het vel erbij in studio-pakketten.js (daar leest de app het vandaan: Store, stickerkeuze, widgets).
//   4. Verhoogt de ?v=-nummers die daardoor omhoog moeten (tests/tools/verhoog-versies.mjs).
// Een pakket dat al in de app staat (zelfde id), wordt niet nog eens gezet. Er wordt niets gepubliceerd: het gaat in een
// pull request en Marcel of Tijn zegt "Merge".
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { valideerPakket, fxNamenUitBron } from '../../studio-pakket.js'

const argv = process.argv.slice(2)
const vlag = (naam, metWaarde = false) => { const i = argv.indexOf(naam); if (i < 0) return metWaarde ? null : false; return metWaarde ? argv[i + 1] : true }
const HOOFD = path.resolve(vlag('--map', true) || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'))
const bestand = argv.find(a => !a.startsWith('--') && a !== vlag('--basis', true) && a !== vlag('--map', true))
if (!bestand) { console.error('Gebruik: node tests/tools/studio-installeer.mjs <pakket.stekkypakket.json>'); process.exit(2) }

const pakket = JSON.parse(readFileSync(bestand, 'utf8'))
const fx = fxNamenUitBron(readFileSync(path.join(HOOFD, 'stickerfx.js'), 'utf8'))
const fouten = valideerPakket(pakket, fx)
if (fouten.length) { console.error('Het pakket klopt niet:\n  - ' + fouten.join('\n  - ')); process.exit(1) }

const dataPad = path.join(HOOFD, 'studio-pakketten.js')
const nu = (await import(pathToFileURL(dataPad).href + '?x=' + Date.now())).STUDIO_VELLEN
if (nu.some(v => v.store === pakket.id)) { console.error('Dit pakket staat al in de app (' + pakket.id + ').'); process.exit(1) }
// een id mag ook niet gelijk zijn aan een bestaand Store-item
const storeBron = readFileSync(path.join(HOOFD, 'store.js'), 'utf8') + readFileSync(path.join(HOOFD, 'stickervellen.js'), 'utf8')
if (new RegExp("store: '" + pakket.id + "'").test(storeBron)) { console.error('Dit id bestaat al: ' + pakket.id); process.exit(1) }

// volgende vel-nummer: hoger dan alles wat er is (f1 t/m f7 in stickervellen.js, en wat al uit de Studio komt)
const nummers = [...readFileSync(path.join(HOOFD, 'stickervellen.js'), 'utf8').matchAll(/id: 'f(\d+)'/g)].map(m => Number(m[1])).concat(nu.map(v => Number(v.id.slice(1))), [7])
const velId = 'f' + (Math.max(...nummers) + 1)
const map = path.join(HOOFD, 'stickers', velId)
if (existsSync(map)) { console.error('De map stickers/' + velId + ' bestaat al.'); process.exit(1) }
// Een eigen geluid (mp3) komt in geluiden/<vel>-<nr>.mp3 (de map die de app en de portier al kennen); de sticker krijgt dan dat
// als geluid (g), met het gekozen bibliotheekgeluid als terugval (terug) en de bron erbij. stickerfx.js leest dat uit studio-pakketten.js.
const geluidenMap = path.join(HOOFD, 'geluiden')
const bezet = pakket.stickers.map((s, i) => s.mp3 && path.join(geluidenMap, velId + '-' + String(i + 1).padStart(2, '0') + '.mp3')).filter(p => p && existsSync(p))
if (bezet.length) { console.error('Er staat al een geluid op deze plek: ' + bezet.map(p => path.relative(HOOFD, p)).join(', ')); process.exit(1) }
if (pakket.stickers.some(s => s.mp3)) mkdirSync(geluidenMap, { recursive: true })
mkdirSync(map, { recursive: true })
const stickers = pakket.stickers.map((s, i) => {
  const nr = String(i + 1).padStart(2, '0')
  writeFileSync(path.join(map, nr + '.webp'), Buffer.from(s.webp, 'base64'))
  const st = { nr, naam: s.naam.map(t => t.trim()), b: s.b, g: s.g }
  if (s.mp3) {
    writeFileSync(path.join(geluidenMap, velId + '-' + nr + '.mp3'), Buffer.from(s.mp3, 'base64'))
    st.g = velId + '-' + nr; st.terug = s.g; st.bron = s.bron.trim(); st.licentie = s.licentie
  }
  return st
})
const vel = { id: velId, store: pakket.id, titel: pakket.titel.trim(), uitleg: pakket.uitleg.map(t => t.trim()), stickers }

// studio-pakketten.js opnieuw schrijven (de kop blijft, de lijst wordt bijgewerkt)
const bron = readFileSync(dataPad, 'utf8')
const kop = bron.slice(0, bron.indexOf('export const STUDIO_VELLEN'))
const regel = s => '    { nr: ' + JSON.stringify(s.nr).replace(/"/g, "'") + ', naam: ' + JSON.stringify(s.naam) + ', b: ' + JSON.stringify(s.b) + ', g: ' + JSON.stringify(s.g) +
  (s.terug ? ', terug: ' + JSON.stringify(s.terug) + ', bron: ' + JSON.stringify(s.bron) + ', licentie: ' + JSON.stringify(s.licentie) : '') + ' },'
const tekst = v => '  { id: ' + JSON.stringify(v.id) + ', store: ' + JSON.stringify(v.store) + ', titel: ' + JSON.stringify(v.titel) + ',\n    uitleg: ' + JSON.stringify(v.uitleg) + ',\n    stickers: [\n' + v.stickers.map(s => '  ' + regel(s)).join('\n') + '\n    ] },'
writeFileSync(dataPad, kop + 'export const STUDIO_VELLEN = [\n' + [...nu, vel].map(tekst).join('\n') + '\n]\n')
console.log('Pakket "' + vel.titel + '" staat nu als vel ' + velId + ' in de app (' + stickers.length + ' stickers).')

if (!vlag('--zonder-versies')) {
  const basis = vlag('--basis', true) || 'origin/main'
  console.log(execFileSync('node', [path.join(HOOFD, 'tests/tools/verhoog-versies.mjs'), basis], { encoding: 'utf8', cwd: HOOFD }).trim())
}
