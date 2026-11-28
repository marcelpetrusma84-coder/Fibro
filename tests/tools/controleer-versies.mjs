// controleer-versies.mjs (3 nov 2026): krijgt een veranderd script ook een nieuw ?v=-nummer?
// De service worker bewaart scripts en stijlen met ?v= tot dat nummer verandert. Verander je een bestand zonder het
// nummer op te hogen, dan blijven telefoons die het al hadden de oude kopie gebruiken (bugtest 3 nov: 7 bestanden).
// Voor elk bestand dat in deze pull request verandert en ergens met ?v= geladen wordt: in dezelfde pull request moet
// ook een regel met '<naam>?v=' veranderd zijn (het nummer opgehoogd). Nieuwe bestanden tellen niet (geen oude kopie).
// node tests/tools/controleer-versies.mjs <basis, bijvoorbeeld origin/main> [kop, standaard HEAD]
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const basis = process.argv[2] || 'origin/main', kop = process.argv[3] || 'HEAD'
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const SLA_OVER = /^(tests|supabase|server|sql|docs|android|\.github)\//
const NOOIT = new Set(['service-worker.js']) // de browser haalt die zelf opnieuw op

// Welke bestanden worden ergens met ?v= geladen (in de versie van de kop)?
const alle = git('ls-tree', '-r', '--name-only', kop).split('\n').filter(f => /\.(html|js|css|mjs)$/.test(f) && !SLA_OVER.test(f))
const metVersie = new Set()
for (const f of alle) {
  let s = ''
  try { s = git('show', kop + ':' + f) } catch (e) { continue }
  s = s.replace(/^\s*\/\/.*$/gm, '')
  for (const m of s.matchAll(/["'(`]\.{0,2}\/?([\w./-]+\.(?:js|css|mjs))\?v=[\w.-]+/g)) {
    metVersie.add(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])))
  }
}

const veranderd = git('diff', '--name-status', basis + '...' + kop).split('\n').filter(Boolean).map(r => r.split('\t'))
const diff = git('diff', '-U0', basis + '...' + kop)
const toegevoegd = diff.split('\n').filter(r => r.startsWith('+') && !r.startsWith('+++')).join('\n')
// 26 nov 2026: welke nummers had een bestand al op de basis? Een nieuw nummer moet echt nieuw zijn. Eerder telde elke
// toegevoegde regel met '<naam>?v=', ook een nieuw bestand dat het oude nummer gebruikte (zo bleef
// neon-raiders-scoreboard.js in #279 op v5 staan terwijl het veranderde).
function nummers(rev, naam) {
  const uit = new Set()
  let lijst = []
  try { lijst = git('grep', '-h', '-o', '-E', naam + '\\?v=[A-Za-z0-9._-]+', rev, '--', '*.js', '*.html', '*.css', '*.mjs').split('\n') } catch (e) {}
  for (const r of lijst) { const m = r.match(/\?v=([\w.-]+)/); if (m) uit.add(m[1]) }
  return uit
}
const fout = []
for (const [stand, f] of veranderd) {
  if (stand !== 'M' || SLA_OVER.test(f) || NOOIT.has(f) || !metVersie.has(f)) continue
  const naam = path.posix.basename(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(naam + '\\?v=').test(toegevoegd)) { fout.push(f); continue }
  const oud = nummers(basis, naam), nu = nummers(kop, naam)
  if (![...nu].some(v => !oud.has(v))) fout.push(f)   // alleen oude nummers: telefoons houden de oude kopie
}
// 28 nov 2026: spellen uit Studio laden hun scherm als './' + id + '-ui.js?v=' + v (studio-spellen.js). Dat staat niet
// letterlijk in de code, dus hierboven telde het niet mee (zo bleven pokertexasholdem-ui.js en videopoker-ui.js in #294 op
// hun oude nummer). Verandert <id>-ui.js of <id>.js, dan moet "v" van dat spel in studio-spellen.js omhoog.
const studioV = rev => { const m = new Map(); try { for (const x of git('show', rev + ':studio-spellen.js').matchAll(/\{"id":"([a-z0-9]+)"[^\n]*?"v":(\d+)/g)) m.set(x[1], Number(x[2])) } catch (e) {} return m }
const vOud = studioV(basis), vNu = studioV(kop), studioFout = []
for (const [stand, f] of veranderd) {
  const id = stand === 'M' && /^[a-z0-9]+(-ui)?\.js$/.test(f) ? f.replace(/(-ui)?\.js$/, '') : null
  if (id && vOud.has(id) && vNu.has(id) && vNu.get(id) <= vOud.get(id)) studioFout.push(f + '   (verhoog "v" van ' + id + ' in studio-spellen.js)')
}
if (studioFout.length) {
  console.log('FOUT: deze spellen uit Studio zijn veranderd, maar hun "v" in studio-spellen.js niet. Telefoons blijven dan de oude kopie gebruiken.')
  for (const f of studioFout) console.log('  - ' + f)
  if (!fout.length) process.exit(1)
}
if (fout.length) {
  console.log('FOUT: deze bestanden zijn veranderd, maar hun ?v=-nummer niet. Telefoons blijven dan de oude kopie gebruiken.')
  for (const f of fout) console.log('  - ' + f + '   (hoog het nummer op overal waar ' + path.posix.basename(f) + '?v= staat)')
  process.exit(1)
}
console.log('ok: elk veranderd script met ?v= heeft een nieuw nummer (' + veranderd.length + ' bestanden bekeken)')
