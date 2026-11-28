// verhoog-versies.mjs (23 nov 2026): zet het ?v=-nummer omhoog van elk veranderd script waar dat nog niet gebeurd is.
// Het omgekeerde van controleer-versies.mjs: dat controleert, dit repareert. Een script dat een ander script met ?v=
// laadt, verandert zelf als dat nummer omhoog gaat; daarom gaat het door tot er niets meer te doen is.
// node tests/tools/verhoog-versies.mjs [basis, standaard origin/main]   (kijkt naar de bestanden zoals ze nu op schijf staan)
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const basis = process.argv[2] || 'origin/main'
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const SLA_OVER = /^(tests|supabase|server|sql|docs|android|\.github)\//
const NOOIT = new Set(['service-worker.js'])
const isOpmerking = r => /^\s*(\/\/|\/\*|\*|#)/.test(r)
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const bestanden = git('ls-files').split('\n').filter(f => /\.(html|js|css|mjs)$/.test(f) && !SLA_OVER.test(f))
const lees = f => readFileSync(path.join(REPO, f), 'utf8')
const verhoogd = []

// 28 nov 2026: spellen uit Studio (studio-spellen.js) laden <id>-ui.js en <id>.js met "v" van dat spel
{
  const studioV = tekst => { const m = new Map(); for (const x of tekst.matchAll(/\{"id":"([a-z0-9]+)"[^\n]*?"v":(\d+)/g)) m.set(x[1], Number(x[2])); return m }
  let basisTekst = ''
  try { basisTekst = git('show', basis + ':studio-spellen.js') } catch (e) {}
  const vOud = studioV(basisTekst)
  const veranderd = git('diff', '--name-status', basis).split('\n').filter(Boolean).map(r => r.split('\t')).filter(([s]) => s === 'M').map(([, f]) => f)
  let tekst = lees('studio-spellen.js')
  const vNu = studioV(tekst)
  const ids = new Set(veranderd.filter(f => /^[a-z0-9]+(-ui)?\.js$/.test(f)).map(f => f.replace(/(-ui)?\.js$/, '')))
  for (const id of ids) {
    if (!vOud.has(id) || !vNu.has(id) || vNu.get(id) > vOud.get(id)) continue
    tekst = tekst.replace(new RegExp('(\\{"id":"' + id + '"[^\\n]*?"v":)\\d+'), '$1' + (vOud.get(id) + 1))
    verhoogd.push('studio-spellen.js: ' + id + ' -> v' + (vOud.get(id) + 1))
  }
  if (ids.size) writeFileSync(path.join(REPO, 'studio-spellen.js'), tekst)
}
for (let ronde = 0; ronde < 12; ronde++) {
  const veranderd = git('diff', '--name-status', basis).split('\n').filter(Boolean).map(r => r.split('\t')).filter(([s, f]) => s === 'M' && !SLA_OVER.test(f) && !NOOIT.has(f))
  let gedaan = 0
  for (const [, f] of veranderd) {
    const naam = path.posix.basename(f)
    const patroon = new RegExp('(?<![\\w.-])' + esc(naam) + '\\?v=(\\d+)', 'g')
    // waar wordt dit bestand met ?v= geladen (niet in een opmerking)?
    const plekken = []
    for (const g of bestanden) {
      const regels = lees(g).split('\n')
      regels.forEach((r, i) => { if (!isOpmerking(r) && new RegExp(patroon.source).test(r)) plekken.push([g, i]) })
    }
    if (!plekken.length) continue                                    // wordt nergens met ?v= geladen
    let hoogste = 0
    for (const [g, i] of plekken) for (const m of lees(g).split('\n')[i].matchAll(patroon)) hoogste = Math.max(hoogste, Number(m[1]))
    // al verhoogd = het hoogste nummer is nu hoger dan in de basis (niet: "er staat een veranderde regel met dit nummer in",
    // want wie een import-regel aanpast om iets anders, laat het oude nummer gewoon staan)
    let hoogsteBasis = 0
    try {
      for (const r of git('grep', '-h', '-E', esc(naam) + '\\?v=[0-9]+', basis, '--', '*.html', '*.js', '*.css', '*.mjs').split('\n'))
        if (!isOpmerking(r)) for (const m of r.matchAll(patroon)) hoogsteBasis = Math.max(hoogsteBasis, Number(m[1]))
    } catch (e) { /* geen treffers in de basis */ }
    if (hoogste > hoogsteBasis) continue
    const nieuw = hoogste + 1
    const perBestand = new Map()
    for (const [g, i] of plekken) perBestand.set(g, [...(perBestand.get(g) || []), i])
    for (const [g, regelNrs] of perBestand) {
      const regels = lees(g).split('\n')
      for (const i of regelNrs) regels[i] = regels[i].replace(patroon, naam + '?v=' + nieuw)
      writeFileSync(path.join(REPO, g), regels.join('\n'))
    }
    verhoogd.push(naam + ' -> ' + nieuw); gedaan++
  }
  if (!gedaan) break
}
console.log(verhoogd.length ? 'verhoogd:\n  ' + verhoogd.join('\n  ') : 'niets te verhogen')
