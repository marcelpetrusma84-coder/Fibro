import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const bron = readFileSync(new URL('../../supabase/functions/stuur-push/index.ts', import.meta.url), 'utf8')
const js = stripTypeScriptTypes(bron.replace(/^import .*$/gm, ''))
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
const afzender = id(1), vriend = id(2), groepslid = id(3), groep = id(4)
const nu = new Date().toISOString()
const bericht = (n, content = 'e2e:test') => ({ id: id(n), sender_id: afzender, receiver_id: vriend, content, created_at: nu })
const tabellen = {
  messages: [],
  groep_berichten: [{ id: id(30), groep_id: groep, sender_id: afzender, stil: false, created_at: nu }],
  groep_leden: [afzender, vriend, groepslid].map(user_id => ({ groep_id: groep, user_id })),
  friendships: [{ user_id: afzender, friend_id: vriend, status: 'accepted' }],
  profiles: [
    { id: afzender, taal: 'nl', geblokkeerd: false },
    { id: vriend, taal: 'en' },
    { id: groepslid, taal: 'nl' },
  ],
  push_subscriptions: [vriend, vriend, groepslid].map((user_id, i) => ({ id: id(40 + i), user_id, subscription: { user_id } })),
}
const sloten = new Set(), rpcGebruikers = [], verzonden = []
const meting = aantal => ({ aantal, gemeten: 1795000000000 })
const metingen = new Map([[vriend, meting(6)], [groepslid, meting(2)]])
let handler

function tabel(naam) {
  let rijen = [...(tabellen[naam] || [])], error = null
  const vraag = {
    select() { return vraag },
    eq(k, v) { rijen = rijen.filter(rij => rij[k] === v); return vraag },
    in(k, v) { rijen = rijen.filter(rij => v.includes(rij[k])); return vraag },
    gte(k, v) { rijen = rijen.filter(rij => rij[k] >= v); return vraag },
    order(k) { rijen.sort((a, b) => b[k].localeCompare(a[k])); return vraag },
    limit(n) { rijen = rijen.slice(0, n); return vraag },
    maybeSingle() { rijen = rijen[0] || null; return vraag },
    insert({ message_id }) {
      assert.equal(naam, 'push_log')
      if (sloten.has(message_id)) error = { code: '23505' }
      sloten.add(message_id)
      return vraag
    },
    then(resolve) { resolve({ data: rijen, error }) },
  }
  return vraag
}

new Function('createClient', 'Deno', 'webpush', js)(
  () => ({
    from: tabel,
    auth: { getUser: async () => ({ data: { user: { id: afzender } } }) },
    rpc: async (naam, { p_gebruiker }) => {
      assert.equal(naam, 'chat_melding_teller_voor')
      rpcGebruikers.push(p_gebruiker)
      return metingen.has(p_gebruiker) ? { data: metingen.get(p_gebruiker) } : { error: { code: 'PGRST202' } }
    },
  }),
  { serve: f => { handler = f }, env: { get: () => 'test' } },
  { setVapidDetails() {}, sendNotification(sub, payload) { verzonden.push({ sub, payload: JSON.parse(payload) }) } },
)

async function stuur(invoer) {
  const respons = await handler(new Request('https://mock.invalid/stuur-push', {
    method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(invoer),
  }))
  assert.equal(respons.status, 200)
  return respons.json()
}

async function stuurDirect(n, content) {
  tabellen.messages.push(bericht(n, content))
  return stuur({ message_id: id(n) })
}

assert.deepEqual(await stuurDirect(10), { ok: true })
assert.deepEqual(rpcGebruikers.splice(0), [vriend], 'één meting voor beide toestellen van dezelfde ontvanger')
assert.equal(verzonden.length, 2)
for (const { sub, payload } of verzonden.splice(0)) {
  assert.equal(payload.type, 'bericht')
  assert.equal(payload.ontvanger, sub.user_id)
  assert.equal(payload.taal, 'en')
  assert.equal(payload.berichtId, id(10))
  assert.deepEqual(payload.chatTeller, meting(6))
}

assert.equal((await stuur({ message_id: id(10) })).reden, 'al verstuurd')
assert.equal(verzonden.length, 0)
assert.deepEqual(await stuur({ groep_bericht_id: id(30) }), { ok: true })
assert.deepEqual(rpcGebruikers.splice(0), [vriend, groepslid])
assert.equal(verzonden.length, 3)
for (const { sub, payload } of verzonden.splice(0)) {
  assert.equal(payload.type, 'groep')
  assert.equal(payload.ontvanger, sub.user_id)
  assert.equal(payload.taal, sub.user_id === vriend ? 'en' : 'nl')
  assert.equal(payload.berichtId, id(30))
  assert.deepEqual(payload.chatTeller, metingen.get(sub.user_id))
}

metingen.set(vriend, meting(0))
assert.deepEqual(await stuurDirect(11), { ok: true }, 'zelfde antwoord als bij bezorging')
assert.equal(verzonden.length, 0, 'een lege telling geeft geen push')

metingen.delete(vriend)
await stuurDirect(12)
const ontbrekendeTeller = verzonden.splice(0)[0].payload
assert.equal(Object.hasOwn(ontbrekendeTeller, 'chatTeller'), false)
assert.equal(ontbrekendeTeller.berichtId, id(12))
metingen.set(vriend, meting(-1))
await stuurDirect(13)
assert.equal(Object.hasOwn(verzonden.splice(0)[0].payload, 'chatTeller'), false, 'ongeldige aantallen worden niet doorgegeven')

rpcGebruikers.length = 0
await stuurDirect(14, 'buzz:')
const buzz = verzonden.splice(0)[0].payload
assert.equal(buzz.type, 'buzz')
assert.equal(Object.hasOwn(buzz, 'ontvanger'), false)
assert.equal(rpcGebruikers.length, 0)

metingen.set(vriend, meting(7))
tabellen.messages = [bericht(15)]
assert.deepEqual(await stuur({ receiver_id: vriend, type: 'bericht' }), { ok: true })
assert.deepEqual(verzonden.splice(0)[0].payload.chatTeller, meting(7))
tabellen.messages = []
rpcGebruikers.length = 0
assert.equal((await stuur({ receiver_id: vriend, type: 'bericht' })).verstuurd, 2)
assert.equal(Object.hasOwn(verzonden[0].payload, 'chatTeller'), false)
assert.equal(rpcGebruikers.length, 0, 'een oude app kan geen ontvangerstelling opvragen zonder echt bericht')

console.log('Chatpush: gedeelde teller, ontvangers gescheiden en zonder telling in het HTTP-antwoord.')
