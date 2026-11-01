// node tests/neon/test-neon-scores.mjs — fake API/storage only, no real scores submitted.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const source = await readFile(new URL('../../neon-raiders-scores.js', import.meta.url), 'utf8')
const { maakNeonScoreService } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const ME = '10000000-0000-4000-8000-000000000001'
const FRIEND = '20000000-0000-4000-8000-000000000002'
const OTHER = '30000000-0000-4000-8000-000000000003'
const time = Date.parse('2026-10-27T12:00:00Z')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const storage = () => {
  const items = new Map()
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), items }
}
function fixture({ uid = ME, online = true, failure = null } = {}) {
  let serial = 0
  const saved = [], store = storage()
  const session = { uid }, network = { online, failure }
  const response = { personal: [], friends: [], global: null, known_players: [] }
  const api = {
    auth: { getSession: async () => ({ data: { session: session.uid ? { user: { id: session.uid } } : null } }) },
    rpc: async (name, params) => {
      if (network.failure) return { error: network.failure }
      if (name === 'neon_raiders_save_score') { saved.push(params); return { data: null, error: null } }
      assert.equal(name, 'neon_raiders_boards')
      return { data: response, error: null }
    }
  }
  const service = maakNeonScoreService({ supabase: api, storage: store,
    now: () => time + serial * 1000, uuid: () => id(++serial), isOnline: () => network.online })
  return { service, saved, store, network, response, session }
}
const row = (n, score, user = ME, username = 'GeneratedName', level = 1, won = false) => ({
  run_id: id(n), user_id: user, score, played_at: new Date(time + n * 1000).toISOString(), username, level, won
})

// Best ten completed runs, score descending, earlier date first on a tie; duplicates never count twice.
const f = fixture({ online: false })
await Promise.all(Array.from({ length: 14 }, (_, n) => f.service.saveRun({ score: n * 100, level: n % 7 + 1, won: n === 13 })))
let boards = await f.service.loadBoards()
assert.equal(boards.status, 'offline')
assert.deepEqual(boards.personal.map(r => r.score), [1300,1200,1100,1000,900,800,700,600,500,400])
assert.ok(boards.personal.every(r => r.playedAt && r.isSelf))
assert.equal(boards.personal[0].level, 7, 'local personal results retain the level reached')
assert.equal(boards.personal[0].won, true, 'completion is distinct from being stranded in level seven')
assert.equal(f.saved.length, 0)
f.network.online = true
await f.service.loadBoards()
assert.equal(f.saved.length, 14, 'offline runs retry, not merely the best ten')
assert.equal(f.saved[0].p_level, 7)
assert.equal(f.saved[0].p_won, true)
await f.service.loadBoards()
assert.equal(f.saved.length, 14, 'a refreshed list does not resubmit saved runs')

// Same id can be retried without creating a second personal entry.
await f.service.saveRun({ id: id(99), score: 3000, playedAt: time })
await f.service.saveRun({ id: id(99), score: 3000, playedAt: time })
assert.equal((await f.service.loadBoards()).personal.filter(r => r.id === id(99)).length, 1)
assert.equal(f.saved.at(-1).p_run_id, id(99))
assert.ok(!('user_id' in f.saved.at(-1)), 'the caller cannot select the server owner')
assert.equal(f.saved.at(-1).p_expected_user, ME, 'mid-request account switch cannot reassign a run')
await f.service.saveRun({ id: id(99), score: 9999, playedAt: time })
assert.equal((await f.service.loadBoards()).personal.find(r => r.id === id(99)).score, 3000, 'an existing round is immutable')

// Local chosen names have priority; server display_name is never consulted.
const names = fixture()
names.store.setItem('fibro_profiel_' + ME, JSON.stringify({ naam: 'My chosen name' }))
names.store.setItem(`vriend_naam_${FRIEND}_${ME}`, 'P2P friend name')
names.response.personal = [row(1, 100, ME, 'GeneratedName', 3)]
names.response.friends = [row(2, 700, FRIEND, 'FriendUsername', 5), row(1, 100, ME, 'GeneratedName', 3)]
names.response.global = { score: 700, level: 5, won: false, user_id: FRIEND, username: 'FriendUsername', played_at: new Date(time).toISOString() }
names.response.known_players = [{ user_id: FRIEND }]
boards = await names.service.loadBoards()
assert.equal(boards.personal[0].name, 'My chosen name')
assert.equal(boards.friends[0].name, 'P2P friend name')
assert.equal(boards.global.name, 'P2P friend name')
assert.equal(boards.personal[0].level, 3)
assert.equal(boards.friends[0].level, 5)
assert.equal(boards.global.level, 5)
assert.equal(boards.global.won, false)
names.store.items.delete(`vriend_naam_${FRIEND}_${ME}`)
assert.equal((await names.service.loadBoards()).friends[0].name, 'FriendUsername')

// An anonymous record includes gameplay result, never identity or time, even with extra response fields.
names.response.global = { score: 1000, level: 6, won: false, user_id: OTHER, username: 'Private', played_at: new Date(time).toISOString() }
names.response.known_players = []
assert.deepEqual((await names.service.loadBoards()).global, { score: 1000, level: 6, won: false })
names.response.global = { score: 1200, level: 7, won: true }
assert.deepEqual((await names.service.loadBoards()).global, { score: 1200, level: 7, won: true })
names.response.global = { score: 9000 }
assert.deepEqual((await names.service.loadBoards()).global, { score: 9000, level: null, won: false }, 'old responses do not invent a reached level')
for (const level of [0, 8, 1.5, '4', null]) {
  names.response.global = { score: 9000, level }
  assert.equal((await names.service.loadBoards()).global.level, null)
}

// Previously cached rows gain their missing metadata when the server RPC is updated.
const legacy = fixture()
const old = row(1, 500)
delete old.level; delete old.won
legacy.response.personal = [old]
assert.equal((await legacy.service.loadBoards()).personal[0].level, null)
legacy.response.personal = [row(1, 500, ME, 'GeneratedName', 7, true)]
const upgraded = await legacy.service.loadBoards()
assert.equal(upgraded.personal[0].level, 7)
assert.equal(upgraded.personal[0].won, true)

// An old RPC response cannot erase a level/result already recorded by this device.
const rollout = fixture({ online: false })
const oldServerRow = row(60, 500)
delete oldServerRow.level; delete oldServerRow.won
await rollout.service.saveRun({ id: id(60), score: 500, playedAt: oldServerRow.played_at, level: 7, won: true })
rollout.response.personal = [oldServerRow]
rollout.network.online = true
const preserved = await rollout.service.loadBoards()
assert.equal(preserved.personal[0].level, 7)
assert.equal(preserved.personal[0].won, true)

// Missing migration and offline transport preserve local records and the retry queue.
const missing = fixture({ failure: { code: 'PGRST202' } })
assert.equal((await missing.service.saveRun({ score: 777 })).status, 'setup')
assert.equal((await missing.service.loadBoards()).personal[0].score, 777)
missing.network.failure = { message: 'Failed to fetch' }
assert.equal((await missing.service.loadBoards()).status, 'offline')
missing.network.failure = null
assert.equal((await missing.service.loadBoards()).status, 'online')
assert.equal(missing.saved.length, 1)

// Partition every account and local guest data, without moving guest scores into an account.
const accounts = fixture({ online: false })
const ownerId = await accounts.service.captureOwner()
assert.equal(ownerId, ME)
await accounts.service.saveRun({ score: 123 })
accounts.session.uid = FRIEND
assert.equal((await accounts.service.saveRun({ score: 888, ownerId })).reason, 'account-changed')
assert.equal((await accounts.service.loadBoards()).personal.length, 0)
await accounts.service.saveRun({ score: 456 })
accounts.session.uid = null
await accounts.service.saveRun({ score: 789 })
assert.equal((await accounts.service.loadBoards()).status, 'local')
accounts.session.uid = ME
assert.equal((await accounts.service.loadBoards()).personal[0].score, 123)

// Storage denial still allows this session's top ten; malformed input never reaches the RPC.
const denied = maakNeonScoreService({ storage: { getItem() { throw Error('denied') }, setItem() { throw Error('denied') } },
  now: () => time, uuid: () => id(1) })
assert.equal((await denied.saveRun({ score: 17 })).persisted, false)
assert.equal((await denied.saveRun({ score: 17 })).savedLocal, false)
assert.equal((await denied.loadBoards()).personal[0].score, 17)
assert.equal((await denied.loadBoards()).durable, false)
for (const score of [-1, NaN, Infinity, 1.5, '40', 2147483648]) {
  await assert.rejects(denied.saveRun({ score }), TypeError)
}
await assert.rejects(denied.saveRun({ score: 4, id: 'unsafe' }), TypeError)
await assert.rejects(denied.saveRun({ score: 4, playedAt: 'broken' }), TypeError)
// In-flight response for A must not be rendered after B logs in.
let changedAccount = ME
const switching = maakNeonScoreService({ storage: storage(), supabase: {
  auth: { getSession: async () => ({ data: { session: { user: { id: changedAccount } } } }) },
  rpc: async () => { changedAccount = FRIEND; return { data: {
    personal: [row(1, 999, ME, 'Private A')], friends: [row(1, 999, ME, 'Private A')], global: { score: 999 }
  }, error: null } }
} })
const switched = await switching.loadBoards()
assert.deepEqual(switched.personal, [])
assert.deepEqual(switched.friends, [])
assert.equal(switched.global, null)
console.log('PASS Neon Raiders scores: top ten, levels/completion, legacy upgrade, local retry, account isolation, names and anonymous global')
