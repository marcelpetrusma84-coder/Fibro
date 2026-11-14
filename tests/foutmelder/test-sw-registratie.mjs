// test-sw-registratie.mjs (14 nov 2026): elke navigator.serviceWorker.register(...) in een html-pagina moet zijn fout
// opvangen (.catch, of await binnen try). Anders komt een mislukte download van service-worker.js (iPhone, slecht
// netwerk) als 'TypeError: Script service-worker.js load failed' in public.foutmeldingen terecht.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const mis = []
for (const naam of readdirSync(REPO).filter(n => n.endsWith('.html'))) {
  const regels = readFileSync(path.join(REPO, naam), 'utf8').split('\n')
  regels.forEach((r, i) => {
    if (!/navigator\.serviceWorker\.register\(/.test(r)) return
    if (/\.catch\(/.test(r)) return
    if (/\bawait\b/.test(r)) {
      // await: er moet een try { boven staan (in de 40 regels ervoor)
      const ervoor = regels.slice(Math.max(0, i - 40), i).join('\n')
      if (/\btry\s*\{/.test(ervoor)) return
      // of de hele functie wordt met .catch aangeroepen; dat kunnen we hier niet zien, dus alleen melden als er geen try is
    }
    mis.push(naam + ':' + (i + 1) + '  ' + r.trim())
  })
}
if (mis.length) {
  console.error('register() zonder foutafhandeling:\n  ' + mis.join('\n  '))
  process.exit(1)
}
console.log('alle serviceWorker.register-aanroepen vangen hun fout op')
