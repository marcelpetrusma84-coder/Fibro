// node tests/meldingen/test-berichten-aantal.mjs (17 nov 2026) - gewone chatberichten komen samen in één pushmelding met
// het aantal ("Je hebt 3 nieuwe berichtjes 💬"), zoals andere apps in het meldingenscherm van de telefoon laten zien.
// Privé en groep delen een teller. Buzz en bellen hebben hun eigen melding.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const code = readFileSync(new URL('../../service-worker.js', import.meta.url), 'utf8')

function portier () {
  const luisteraars = {}, getoond = []
  const scherm = [] // meldingen die nu op het scherm staan
  const kast = new Map()
  const registration = {
    scope: 'https://stekky.example/Fibro/',
    showNotification: async (titel, opties) => {
      getoond.push({ titel, ...opties })
      if (opties.tag) { const i = scherm.findIndex(m => m.tag === opties.tag); if (i >= 0) scherm.splice(i, 1) }
      scherm.push({ title: titel, ...opties, close () { scherm.splice(scherm.indexOf(this), 1) } })
    },
    getNotifications: async ({ tag } = {}) => scherm.filter(m => !tag || m.tag === tag)
  }
  const self = { addEventListener: (t, f) => { luisteraars[t] = f }, registration, navigator: {} }
  const caches = {
    open: async () => ({ match: async k => kast.has(k) ? new Response(kast.get(k)) : undefined, put: async (k, r) => kast.set(k, await r.text()) }),
    keys: async () => [], delete: async () => true
  }
  const ctx = { self, caches, importScripts: () => {}, clients: {}, Response, URL, Promise, Date, Math, String, Set, setTimeout, fetch: () => {} }
  vm.createContext(ctx); vm.runInContext(code, ctx)
  async function push (data) {
    let klaar
    luisteraars.push({ data: { json: () => data }, waitUntil: p => { klaar = p } })
    await klaar
    return getoond[getoond.length - 1]
  }
  return { push, scherm, getoond }
}
const BERICHT = { title: 'Stekky', body: 'Je hebt een nieuw bericht 💬', url: '/Fibro/chat.html', type: 'bericht' }
let ok = 0
const test = async (naam, f) => { await f(); ok++; console.log('OK  ', naam) }

await test('drie berichten: één melding, die telt 1, 2, 3', async () => {
  const p = portier()
  let m = await p.push(BERICHT)
  assert.equal(m.body, '1 nieuw chatbericht')
  assert.equal(m.tag, 'stekky-chat-ongelezen'); assert.equal(m.renotify, true); assert.equal(m.data.aantal, undefined)
  m = await p.push(BERICHT)
  assert.equal(m.body, '2 nieuwe chatberichten')
  m = await p.push(BERICHT)
  assert.equal(m.body, '3 nieuwe chatberichten'); assert.equal(m.data.aantal, undefined)
  assert.equal(p.scherm.length, 1, 'maar één melding op het scherm')
})
await test('wegvegen laat ongelezen berichten staan in de teller', async () => {
  const p = portier()
  await p.push(BERICHT); await p.push(BERICHT)
  p.scherm[0].close()
  const m = await p.push(BERICHT)
  assert.equal(m.body, '3 nieuwe chatberichten')
})
await test('Engels: 2 new chat messages', async () => {
  const p = portier()
  const en = { ...BERICHT, body: 'You have a new message 💬' }
  await p.push(en)
  assert.equal((await p.push(en)).body, '2 new chat messages')
})
await test('ook een oud bericht zonder type telt mee', async () => {
  const p = portier()
  await p.push({ title: 'Stekky', body: 'Je hebt een nieuw bericht 💬' })
  assert.equal((await p.push({ title: 'Stekky', body: 'Je hebt een nieuw bericht 💬' })).body, '2 nieuwe chatberichten')
})
await test('groep telt mee in de chatmelding, buzz en oproep blijven apart', async () => {
  const p = portier()
  await p.push(BERICHT)
  const buzz = await p.push({ title: 'Stekky', body: 'Bram buzzt je!', type: 'buzz' })
  assert.equal(buzz.tag, 'buzz'); assert.equal(buzz.data.aantal, undefined)
  const bel = await p.push({ title: 'Stekky', body: 'Bram belt je', type: 'oproep', tag: 'oproep-x' })
  assert.equal(bel.tag, 'oproep-x'); assert.equal(bel.requireInteraction, true)
  const groep = await p.push({ title: 'Stekky', body: 'Nieuw bericht in een groep 👥', type: 'groep', tag: 'groep-1' })
  assert.equal(groep.tag, 'stekky-chat-ongelezen'); assert.equal(groep.body, '2 nieuwe chatberichten')
  const m = await p.push(BERICHT)
  assert.equal(m.body, '3 nieuwe chatberichten', 'privé en groep tellen samen')
  assert.equal(p.scherm.length, 3)
})

console.log(`\n${ok} van ${ok} goed`)
