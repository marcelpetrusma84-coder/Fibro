import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const bron = readFileSync(new URL('../../service-worker.js', import.meta.url), 'utf8')
const scope = 'https://stekky.example/Fibro/'
const tag = 'stekky-chat-ongelezen'
const ontvanger = 'd4e41ab9-1c18-4e07-93e9-f62561eeb9bc'
const anderAccount = 'f203715f-708b-44af-ac3d-0600927baf33'
const berichtId = nummer => '39f8158f-82f4-4b75-8dfd-' + String(nummer).padStart(12, '0')

function maakWorker() {
  const meldingen = new Map(), kast = new Map(), handlers = new Map()
  const getoond = [], geopend = []
  function start() {
    runInNewContext(bron, {
      self: {
        addEventListener: (type, handler) => handlers.set(type, handler),
        registration: {
          scope,
          async getNotifications({ tag }) { return meldingen.has(tag) ? [meldingen.get(tag)] : [] },
          async showNotification(title, options) {
            const melding = { title, ...options, close: () => meldingen.delete(options.tag) }
            meldingen.set(options.tag, melding)
            getoond.push(melding)
          },
        },
      },
      caches: { open: async () => ({
        match: async sleutel => kast.get(sleutel)?.clone(),
        put: async (sleutel, antwoord) => kast.set(sleutel, antwoord),
      }) },
      clients: { openWindow: async url => geopend.push(url) },
      Response, URL,
    })
  }
  const meld = (type, velden, url = scope + 'chat.html') => verzend('message', {
    data: { type, ontvanger, ...velden }, source: { url },
  })
  async function verzend(type, velden) {
    let werk
    handlers.get(type)({ ...velden, waitUntil: belofte => { werk = belofte } })
    await werk
  }
  start()
  return {
    meldingen, getoond, geopend, start,
    push: data => verzend('push', { data: { json: () => data } }),
    sync: (aantal, gemeten, velden, url) => meld('fibro-chat-melding-teller', { aantal, gemeten, ...velden }, url),
    wis: () => meld('fibro-chat-melding-wis'),
    klik: () => verzend('notificationclick', { notification: meldingen.get(tag) }),
  }
}

function chatPush(type, nummer, aantal, gemeten, velden) {
  return { type, ontvanger, berichtId: berichtId(nummer), chatTeller: { aantal, gemeten }, ...velden }
}

const worker = maakWorker()
await Promise.all([
  worker.push(chatPush('bericht', 1, 2, 100)),
  worker.push(chatPush('groep', 2, 5, 200, { tag: 'groep-oud' })),
])
assert.equal(worker.meldingen.size, 1, 'privé en groep delen één kaart in het systeem')
assert.equal(worker.meldingen.get(tag).title, 'Stekky')
assert.equal(worker.meldingen.get(tag).body, '5 ongelezen chatberichten')
assert.equal(worker.meldingen.get(tag).renotify, true)
worker.start() // Cache blijft behouden wanneer Android de worker opnieuw start.
await worker.push(chatPush('groep', 2, 5, 201))
await worker.push(chatPush('bericht', 3, 2, 150))
assert.equal(worker.getoond.length, 2, 'duplicaten en vertraagde oude standen wijzigen de kaart niet')
await worker.sync(0, 300, {}, 'https://ander.example/chat.html')
assert.equal(worker.meldingen.get(tag).body, '5 ongelezen chatberichten')
await worker.sync(1, 300)
assert.equal(worker.meldingen.get(tag).body, '1 ongelezen chatbericht')
assert.equal(worker.meldingen.get(tag).silent, true, 'lezen geeft geen nieuwe trilling')
await worker.push({ type: 'buzz', tag: 'buzz', body: 'Een buzz' })
assert.equal(worker.meldingen.get(tag).body, '1 ongelezen chatbericht')
await worker.sync(0, 400)
assert.equal(worker.meldingen.has(tag), false)
assert.equal(worker.meldingen.get('buzz').body, 'Een buzz', 'andere meldingen blijven onafhankelijk')
await worker.push(chatPush('groep', 4, 3, 500, { taal: 'en' }))
assert.equal(worker.meldingen.get(tag).body, '3 unread chat messages')
await worker.klik()
assert.deepEqual(worker.geopend, [scope + 'chat.html'])
await worker.sync(2, 600)
assert.equal(worker.meldingen.has(tag), false, 'synchronisatie heropent geen gesloten kaart')
await worker.wis()
await worker.push(chatPush('bericht', 5, 1, 700))
assert.equal(worker.meldingen.has(tag), false, 'na uitloggen toont de worker de vorige stand niet')
await worker.sync(0, 800, { ontvanger: anderAccount })
await worker.push(chatPush('bericht', 6, 1, 900))
assert.equal(worker.meldingen.has(tag), false)
await worker.push(chatPush('groep', 7, 1, 1000, { ontvanger: anderAccount }))
assert.equal(worker.meldingen.get(tag).body, '1 ongelezen chatbericht')

const oudeServer = maakWorker()
await oudeServer.push({ type: 'bericht' })
assert.equal(oudeServer.meldingen.get(tag).body, '1 nieuw chatbericht')
await oudeServer.push({ type: 'groep' })
assert.equal(oudeServer.meldingen.get(tag).body, '2 nieuwe chatberichten')
console.log('chatmeldingenteller: ok')
