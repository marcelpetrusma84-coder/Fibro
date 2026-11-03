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
const fout = []
for (const [stand, f] of veranderd) {
  if (stand !== 'M' || SLA_OVER.test(f) || NOOIT.has(f) || !metVersie.has(f)) continue
  const naam = path.posix.basename(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(naam + '\\?v=').test(toegevoegd)) fout.push(f)
}
if (fout.length) {
  console.log('FOUT: deze bestanden zijn veranderd, maar hun ?v=-nummer niet. Telefoons blijven dan de oude kopie gebruiken.')
  for (const f of fout) console.log('  - ' + f + '   (hoog het nummer op overal waar ' + path.posix.basename(f) + '?v= staat)')
  process.exit(1)
}
console.log('ok: elk veranderd script met ?v= heeft een nieuw nummer (' + veranderd.length + ' bestanden bekeken)')
