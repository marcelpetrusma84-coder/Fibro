// service-worker.js (1 nov 2026): geeft GitHub een storing (5xx, de eenhoorn-pagina "We're having a really bad day"),
// dan krijg je de bewaarde kopie van de pagina, niet de foutpagina. Zonder kopie: gewoon wat de server geeft.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const code = readFileSync(new URL('../../service-worker.js', import.meta.url), 'utf8')
const ORIGIN = 'https://marcelpetrusma84-coder.github.io'

function laad({ netwerk, kopie }) {
  const kast = new Map()
  if (kopie) kast.set(ORIGIN + '/Fibro/chat.html', kopie)
  const caches = {
    open: async () => ({ match: async k => kast.get(typeof k === 'string' ? k : k.url) || undefined, put: async (k, v) => kast.set(k, v), keys: async () => [] }),
    keys: async () => [], delete: async () => true
  }
  const luisteraars = {}
  const self = { addEventListener: (t, f) => { luisteraars[t] = f }, location: { origin: ORIGIN }, skipWaiting() {}, clients: { claim() {} }, registration: {} }
  const ctx = vm.createContext({ self, caches, fetch: async () => netwerk(), URL, Response, Date, Promise, setTimeout, clearTimeout, console })
  vm.runInContext(code, ctx)
  return async function bezoek() {
    let antwoord = null
    const event = {
      request: { method: 'GET', url: ORIGIN + '/Fibro/chat.html?vriend=x', mode: 'navigate', headers: new Headers() },
      respondWith(p) { antwoord = p }, waitUntil() {}
    }
    luisteraars.fetch(event)
    assert.ok(antwoord, 'de portier antwoordt zelf')
    return await antwoord
  }
}
const pagina = (tekst, status = 200, datum = new Date()) => new Response(tekst, { status, headers: { date: datum.toUTCString() } })
const tekst = async r => r.text()

// 1. storing, kopie van vandaag: de kopie
assert.equal(await tekst(await laad({ netwerk: () => pagina('eenhoorn', 503), kopie: pagina('fibro-kopie') })()), 'fibro-kopie')
// 2. storing (500), kopie ouder dan een week: toch de kopie (beter dan de foutpagina)
const oud = new Date(Date.now() - 30 * 86400000)
assert.equal(await tekst(await laad({ netwerk: () => pagina('eenhoorn', 500), kopie: pagina('oude-kopie', 200, oud) })()), 'oude-kopie')
// 3. geen internet: de kopie (zoals altijd)
assert.equal(await tekst(await laad({ netwerk: () => Promise.reject(new Error('offline')), kopie: pagina('fibro-kopie') })()), 'fibro-kopie')
// 4. alles goed: de nieuwe pagina
assert.equal(await tekst(await laad({ netwerk: () => pagina('nieuw'), kopie: pagina('fibro-kopie') })()), 'nieuw')
// 5. 404 is geen storing: gewoon doorgeven
assert.equal((await laad({ netwerk: () => pagina('weg', 404), kopie: pagina('fibro-kopie') })()).status, 404)
// 6. nog geen kopie: wat de server geeft
assert.equal((await laad({ netwerk: () => pagina('eenhoorn', 503), kopie: null })()).status, 503)
// 7. een foutpagina wordt nooit bewaard
assert.match(code, /if \(!res\.ok \|\| res\.type !== 'basic'\) return/)

console.log('ok: bij een storing van GitHub de bewaarde pagina in plaats van de eenhoorn')
