// node tests/foutmelder/test-laadherstel.mjs (v265) - een script dat niet laadt: melden en de pagina een keer
// vanzelf opnieuw laden (foutmelder.js v2); de portier haalt een mislukt script nog een keer op (service-worker.js).
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const code = readFileSync(new URL('../../foutmelder.js', import.meta.url), 'utf8')
const BASIS = 'https://marcelpetrusma84-coder.github.io/Fibro/'

function omgeving ({ online = true } = {}) {
  const opslag = new Map(), sessie = new Map(), luisteraars = { bubbel: {}, vang: {} }, verzonden = []
  let herladen = 0, klok = 1_000_000
  const mapOpslag = m => ({
    get length () { return m.size }, key: i => [...m.keys()][i] ?? null,
    getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)
  })
  const window = {
    addEventListener: (t, f, vang) => { ((vang ? luisteraars.vang : luisteraars.bubbel)[t] ||= []).push(f) }
  }
  const NepDate = class extends Date { static now () { return klok } }
  const ctx = {
    window, localStorage: mapOpslag(opslag), sessionStorage: mapOpslag(sessie),
    location: { pathname: '/Fibro/chat.html', host: 'marcelpetrusma84-coder.github.io', href: BASIS + 'chat.html', origin: 'https://marcelpetrusma84-coder.github.io', reload: () => { herladen++ } },
    navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1', onLine: online, maxTouchPoints: 5 },
    matchMedia: () => ({ matches: false }),
    fetch: (url, opt) => { verzonden.push(JSON.parse(opt.body)); return Promise.resolve({ ok: true, status: 204 }) },
    setTimeout: f => { f(); return 0 }, Date: NepDate, JSON, Set, Promise, String, Array, Object, Math, URL, Number
  }
  vm.createContext(ctx); vm.runInContext(code, ctx)
  const vuur = (soort, e, vang) => ((vang ? luisteraars.vang : luisteraars.bubbel)[soort] || []).forEach(f => f(e))
  return {
    verzonden, get herladen () { return herladen }, vuur,
    later: ms => { klok += ms }
  }
}
let ok = 0
const test = async (naam, f) => { await f(); ok++; console.log('OK  ', naam) }

await test('script van Fibro laadt niet: melden en een keer herladen, daarna een minuut niet', async () => {
  const o = omgeving()
  const fout = { target: { tagName: 'SCRIPT', src: BASIS + 'nieuwbij.js?v=1' } }
  o.vuur('error', fout, true)
  await new Promise(r => setImmediate(r))
  assert.equal(o.herladen, 1)
  assert.equal(o.verzonden.length, 1)
  assert.equal(o.verzonden[0].p_bericht, 'Laden mislukt: nieuwbij.js')
  assert.equal(o.verzonden[0].p_soort, 'fout')
  o.vuur('error', { target: { tagName: 'SCRIPT', src: BASIS + 'sync.js?v=252' } }, true)
  assert.equal(o.herladen, 1, 'niet blijven herladen')
  o.later(61000)
  o.vuur('error', { target: { tagName: 'SCRIPT', src: BASIS + 'sync.js?v=252' } }, true)
  assert.equal(o.herladen, 2, 'na een minuut mag het weer')
})
await test('stijlblad ook; plaatje, ander domein en de pagina zelf niet', async () => {
  const o = omgeving()
  o.vuur('error', { target: { tagName: 'IMG', src: BASIS + 'icon-192.png' } }, true)
  o.vuur('error', { target: { tagName: 'SCRIPT', src: 'https://cdn.jsdelivr.net/npm/x.js' } }, true)
  o.vuur('error', { target: { tagName: 'LINK', rel: 'icon', href: BASIS + 'favicon.ico' } }, true)
  o.vuur('error', { target: o }, true)
  assert.equal(o.herladen, 0)
  o.vuur('error', { target: { tagName: 'LINK', rel: 'stylesheet', href: BASIS + 'lettertypes.css?v=2' } }, true)
  assert.equal(o.herladen, 1)
})
await test('module die niet te laden is (iPhone en Chrome): herladen', async () => {
  for (const tekst of ['Importing a module script failed.', 'Failed to fetch dynamically imported module: https://x/y.js']) {
    const o = omgeving()
    o.vuur('unhandledrejection', { reason: { name: 'TypeError', message: tekst } })
    assert.equal(o.herladen, 1, tekst)
  }
  const o = omgeving()
  o.vuur('unhandledrejection', { reason: { name: 'TypeError', message: 'x is undefined' } })
  assert.equal(o.herladen, 0, 'een gewone fout herlaadt niet')
})
await test('zonder internet niet herladen (dan helpt het niet)', async () => {
  const o = omgeving({ online: false })
  o.vuur('error', { target: { tagName: 'SCRIPT', src: BASIS + 'chat.js?v=1' } }, true)
  assert.equal(o.herladen, 0)
})

// ── De portier: haalMetHerkansing ──
const sw = readFileSync(new URL('../../service-worker.js', import.meta.url), 'utf8')
const s = sw.indexOf('async function haalMetHerkansing(req)')
const e = sw.indexOf("self.addEventListener('install'", s)
assert(s > 0 && e > s)
async function portier (antwoorden) {
  const pogingen = []
  const ctx = {
    fetch: async (req, opt) => {
      pogingen.push(opt.cache)
      const a = antwoorden.shift()
      if (a === 'weg') throw new TypeError('Load failed')
      return { ok: a === 200, status: a }
    },
    setTimeout: f => { f(); return 0 }, Promise
  }
  const haal = vm.runInNewContext(sw.slice(s, e) + '; haalMetHerkansing', ctx)
  let uit
  try { uit = await haal({}) } catch (x) { uit = 'fout' }
  return { pogingen, uit }
}
await test('portier: goed in een keer, of een 403 gewoon door', async () => {
  let r = await portier([200]); assert.deepEqual(r.pogingen, ['no-cache']); assert.equal(r.uit.status, 200)
  r = await portier([403]); assert.equal(r.pogingen.length, 1)
})
await test('portier: 404, 503 of geen verbinding: nog een keer, niet uit de browsercache', async () => {
  for (const eerst of [404, 503, 'weg']) {
    const r = await portier([eerst, 200])
    assert.deepEqual(r.pogingen, ['no-cache', 'reload'], String(eerst))
    assert.equal(r.uit.status, 200)
  }
  const r = await portier(['weg', 'weg'])
  assert.equal(r.uit, 'fout', 'lukt het twee keer niet, dan de fout zoals vroeger')
})

console.log(`\n${ok} van ${ok} goed`)
