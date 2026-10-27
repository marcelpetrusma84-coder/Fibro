// node tests/foutmelder/test-foutmelder.mjs - foutmelder.js: privacy (schoon), toestel, zuinigheid, versturen
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const code = readFileSync(new URL('../../foutmelder.js', import.meta.url), 'utf8')
function omgeving ({ ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', online = true, pad = '/Fibro/chat.html' } = {}) {
  const opslag = new Map(), luisteraars = {}, verzonden = []
  const localStorage = {
    get length () { return opslag.size }, key: i => [...opslag.keys()][i] ?? null,
    getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)), removeItem: k => opslag.delete(k)
  }
  const window = {
    addEventListener: (t, f) => { (luisteraars[t] ||= []).push(f) }
  }
  const ctx = {
    window, localStorage, location: { pathname: pad, host: 'marcelpetrusma84-coder.github.io' },
    navigator: { userAgent: ua, onLine: online, maxTouchPoints: 5, standalone: true },
    matchMedia: () => ({ matches: false }),
    fetch: (url, opt) => { verzonden.push({ url, opt, body: JSON.parse(opt.body) }); return Promise.resolve({ ok: true, status: 204 }) },
    setTimeout: () => 0, Date, JSON, Set, Promise, String, Array, Object, Math
  }
  vm.createContext(ctx); vm.runInContext(code, ctx)
  return { api: window.__fibroFoutmelder, luisteraars, verzonden, opslag, ctx }
}
let ok = 0
const test = (naam, f) => { f(); ok++; console.log('OK  ', naam) }

const { api } = omgeving()
test('adres wordt alleen de bestandsnaam, zonder ?vriend=... en met regelnummer', () => {
  const s = api.schoon('at x (https://marcelpetrusma84-coder.github.io/Fibro/chat.html?vriend=aaaaaaaa-0000-4000-8000-000000000001&naam=Lotte:120:15)')
  assert.equal(s, 'at x (chat.html:120:15)')
})
test('script met ?v= en Safari-stapelregel', () => {
  assert.equal(api.schoon('start@https://marcelpetrusma84-coder.github.io/Fibro/bellen.js?v=12:88:9'), 'start@bellen.js:88:9')
})
test('ander domein: domein blijft, pad en vraag weg', () => {
  assert.equal(api.schoon('fetch https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/messages?select=*&receiver_id=eq.123'), 'fetch qmgatbphiplrfxrljtbe.supabase.co/messages')
})
test('uuid, inlogpas en foto-gegevens verdwijnen', () => {
  const s = api.schoon('kanaal paar_aaaaaaaa-0000-4000-8000-000000000001_bbbbbbbb-0000-4000-8000-000000000002 pas eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcDEF_ghi foto data:image/png;base64,iVBORw0KGgoAAAANSUhEUg== blob:https://x.github.io/1234-5678')
  assert.equal(s, 'kanaal paar_<id>_<id> pas <pas> foto data:… blob:…')
})
test('te lang wordt afgekapt', () => { assert.equal(api.schoon('x'.repeat(400), 300).length, 300) })
test('toestel iPhone op het beginscherm', () => { assert.equal(api.toestel(), 'iPhone iOS 18.1 · Safari 18.1 · beginscherm') })
test('toestel Steam Deck / Android Chrome', () => {
  assert.equal(omgeving({ ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' }).api.toestel(), 'Linux · Chrome 141 · beginscherm')
  assert.equal(omgeving({ ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' }).api.toestel(), 'Android 15 · Chrome 141 · beginscherm')
})
test('pagina, ook in spellen/', () => {
  assert.equal(omgeving({ pad: '/Fibro/' }).api.pagina(), 'index.html')
  assert.equal(omgeving({ pad: '/Fibro/spellen/runner-gunner.html' }).api.pagina(), 'spellen/runner-gunner.html')
})
test('scriptfout gaat een keer mee, met nette velden', () => {
  const o = omgeving()
  const fout = new TypeError("Cannot read properties of null (reading 'srcObject')")
  fout.stack = 'TypeError: ...\n    at startSpelBel (https://marcelpetrusma84-coder.github.io/Fibro/chat.html?x=1:1369:20)'
  const ev = { error: fout, filename: 'https://marcelpetrusma84-coder.github.io/Fibro/chat.html?x=1', lineno: 1369, colno: 20, target: o.ctx.window }
  o.luisteraars.error[0](ev); o.luisteraars.error[0](ev)
  assert.equal(o.verzonden.length, 1)
  const b = o.verzonden[0].body
  assert.equal(b.p_pagina, 'chat.html'); assert.equal(b.p_soort, 'fout')
  assert.equal(b.p_bericht, "TypeError: Cannot read properties of null (reading 'srcObject')")
  assert.equal(b.p_bron, 'chat.html:1369:20')
  assert.match(b.p_stapel, /at startSpelBel \(chat\.html:1369:20\)/)
  assert.equal(o.verzonden[0].opt.headers.apikey.startsWith('sb_publishable_'), true)
  assert.equal(o.verzonden[0].opt.headers.Authorization, undefined) // niet ingelogd: alleen de publieke sleutel
})
test('mislukte belofte (bijv. microfoon geweigerd)', () => {
  const o = omgeving()
  o.luisteraars.unhandledrejection[0]({ reason: { name: 'NotAllowedError', message: 'The request is not allowed by the user agent' } })
  assert.equal(o.verzonden[0].body.p_soort, 'belofte')
  assert.equal(o.verzonden[0].body.p_bericht, 'NotAllowedError: The request is not allowed by the user agent')
})
test('ruis gaat niet mee (ResizeObserver, Script error, extensies, AbortError)', () => {
  const o = omgeving(), w = o.ctx.window
  o.luisteraars.error[0]({ message: 'ResizeObserver loop completed with undelivered notifications.', target: w })
  o.luisteraars.error[0]({ message: 'Script error.', target: w })
  o.luisteraars.error[0]({ message: 'x is not defined', filename: 'chrome-extension://abc/content.js', target: w })
  o.luisteraars.unhandledrejection[0]({ reason: { name: 'AbortError', message: 'The operation was aborted.' } })
  assert.equal(o.verzonden.length, 0)
})
test('hoogstens 10 per pagina', () => {
  const o = omgeving()
  for (let i = 0; i < 25; i++) o.luisteraars.error[0]({ message: 'fout ' + i, target: o.ctx.window })
  assert.equal(o.verzonden.length, 10)
})
test('zelfde fout na herladen binnen 10 minuten: niet nog eens', () => {
  const o = omgeving()
  o.luisteraars.error[0]({ message: 'kapot', target: o.ctx.window })
  const bewaard = o.opslag.get('fibro_foutmelder_laatst')
  const o2 = omgeving(); o2.opslag.set('fibro_foutmelder_laatst', bewaard)
  o2.luisteraars.error[0]({ message: 'kapot', target: o2.ctx.window })
  assert.equal(o.verzonden.length + o2.verzonden.length, 1)
})
test('zonder internet: bewaard voor later', () => {
  const o = omgeving({ online: false })
  o.luisteraars.error[0]({ message: 'offline kapot', target: o.ctx.window })
  assert.equal(o.verzonden.length, 0)
  assert.equal(JSON.parse(o.opslag.get('fibro_foutmelder_wacht')).length, 1)
})
test('ingelogd: de eigen inlogpas gaat mee als Authorization', () => {
  const o = omgeving()
  o.opslag.set('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify({ access_token: 'eyJabc.def.ghi', expires_at: Math.floor(Date.now() / 1000) + 3600 }))
  o.luisteraars.error[0]({ message: 'iets', target: o.ctx.window })
  assert.equal(o.verzonden[0].opt.headers.Authorization, 'Bearer eyJabc.def.ghi')
})
test('een plaatje dat niet laadt telt niet als scriptfout', () => {
  const o = omgeving()
  o.luisteraars.error[0]({ message: '', target: { tagName: 'IMG' } })
  assert.equal(o.verzonden.length, 0)
})
console.log(`\n${ok} tests geslaagd`)
