import assert from 'node:assert/strict'
import { maakLichessAnalyse } from '../../schaak-ultra-lichess.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const D4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1'
const tick = async () => { await Promise.resolve(); await Promise.resolve() }
const payload = (fen = START, extra = {}) => ({ fen, depth: 24, knodes: 1234, pvs: [{ moves: 'e2e4 e7e5 g1f3', cp: 31 }], ...extra })
const response = (data = payload(), status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function harness(queue = []) {
  let timestamp = 0
  const calls = []
  const client = maakLichessAnalyse({ now: () => timestamp, fetchImpl: (url, options) => {
    calls.push({ url, options })
    assert(queue.length, 'test must provide a response for every network attempt')
    const next = queue.shift()
    if (next instanceof Error) return Promise.reject(next)
    return typeof next === 'function' ? next(url, options) : Promise.resolve(next)
  } })
  return { client, calls, setTime: value => { timestamp = value }, advance: (value = 2500) => { timestamp += value } }
}

{
  const { client, calls } = harness([response()])
  const result = await client.zoek(START)
  assert.deepEqual(result, { bestmove: 'e2e4', cp: 31, mate: null, depth: 24, source: 'lichess' })
  assert.equal(calls.length, 1, 'a first request at time zero is allowed')
  const { url, options } = calls[0]
  const parsed = new URL(url)
  assert.equal(parsed.origin + parsed.pathname, 'https://lichess.org/api/cloud-eval')
  assert.deepEqual([...parsed.searchParams], [['fen', START], ['multiPv', '1'], ['variant', 'standard']])
  assert.equal(options.method, 'GET')
  assert.equal(options.mode, 'cors')
  assert.equal(options.credentials, 'omit')
  assert.equal(options.referrer, '')
  assert.equal(options.referrerPolicy, 'no-referrer')
  assert.equal(options.redirect, 'error')
  assert.deepEqual(options.headers, { Accept: 'application/json' })
  assert(options.signal instanceof AbortSignal)
  result.cp = 9999
  const cached = await client.zoek(START.replace('0 1', '17 42'))
  assert.equal(cached.cp, 31, 'successful cache keys ignore only the two move counters and return copies')
  assert.equal(calls.length, 1)
  client.dispose()
  assert.equal(await client.zoek(START), null, 'closed clients cannot return cached results')
  assert.equal(calls.length, 1)
  client.dispose()
}

{
  const { client, calls, setTime } = harness([response(), response(payload(E4))])
  await client.zoek(START)
  setTime(2499)
  assert.equal(await client.zoek(E4), null)
  assert.equal(calls.length, 1)
  setTime(2500)
  const result = await client.zoek(E4)
  assert.equal(result.cp, 31, 'cloud scores already use White perspective, even with Black to move')
  assert.equal(calls.length, 2)
  client.dispose()
}

for (const uci of ['e1h1', 'e1a1', 'e8h8', 'e8a8', 'a7a8n']) {
  const { client } = harness([response(payload(START, { pvs: [{ moves: `${uci} e7e5`, mate: -3 }] }))])
  assert.deepEqual(await client.zoek(START), { bestmove: uci, cp: null, mate: -3, depth: 24, source: 'lichess' }, 'PV castling and underpromotion stay available for the caller to validate')
  client.dispose()
}

for (const invalid of [
  null, [], {},
  payload(E4),
  payload(START.replace('KQkq', 'KQk')),
  payload(START, { depth: 17 }),
  payload(START, { depth: 18.5 }),
  payload(START, { depth: '24' }),
  payload(START, { pvs: [] }),
  payload(START, { pvs: null }),
  payload(START, { pvs: [null] }),
  payload(START, { pvs: [{ moves: 'e2e4' }] }),
  payload(START, { pvs: [{ moves: 'e2e4', cp: 1, mate: 2 }] }),
  payload(START, { pvs: [{ moves: 'e2e4', cp: null }] }),
  payload(START, { pvs: [{ moves: 'e2e4', cp: 1.2 }] }),
  payload(START, { pvs: [{ moves: 'e2e4', cp: '12' }] }),
  payload(START, { pvs: [{ moves: 'e2e4', cp: Number.MAX_SAFE_INTEGER + 1 }] }),
  payload(START, { pvs: [{ moves: 'e2e4', mate: null }] }),
  ...['', '0000', '(none)', 'e2-e4', 'e2e4x', 'e2e9', 'E2E4', '<script>'].map(moves => payload(START, { pvs: [{ moves, cp: 1 }] })),
]) {
  const { client } = harness([response(invalid)])
  assert.equal(await client.zoek(START), null, `reject malformed/mismatched cloud data: ${JSON.stringify(invalid)}`)
  client.dispose()
}

{
  const { client, calls } = harness([])
  for (const fen of [null, '', 'https://evil.example/', START + '\nposition startpos', START.replace(' w ', ' z '), START.replace('KQkq', 'invalid'), START.replace(' - ', ' e4 '), START.replace('rnbqkbnr', '9'), START.repeat(20)]) {
    assert.equal(await client.zoek(fen), null)
  }
  assert.equal(calls.length, 0, 'invalid FENs cause no requests')
  client.dispose()
}

{
  const { client, calls, advance } = harness([response({}, 404), response({}, 404)])
  assert.equal(await client.zoek(START), null)
  advance()
  assert.equal(await client.zoek(E4), null)
  advance(60000)
  assert.equal(await client.zoek(D4), null)
  assert.equal(calls.length, 2, 'two consecutive cache misses stop further attempts for this game')
  client.dispose()
}

{
  const { client, calls, advance } = harness([response({}, 404), response(payload(E4)), response({}, 404), response(payload(D4))])
  await client.zoek(START)
  advance()
  assert((await client.zoek(E4)).bestmove)
  advance()
  await client.zoek(START)
  advance()
  assert((await client.zoek(D4)).bestmove)
  assert.equal(calls.length, 4, 'a successful response resets the consecutive-miss count')
  client.dispose()
}

for (const [header, wait] of [[null, 60000], ['120', 120000], [new Date(180000).toUTCString(), 180000]]) {
  const { client, calls, setTime } = harness([response({}, 429, header ? { 'retry-after': header } : {}), response()])
  assert.equal(await client.zoek(START), null)
  setTime(wait - 1)
  assert.equal(await client.zoek(START), null)
  assert.equal(calls.length, 1, '429 backoff never causes an immediate retry')
  setTime(wait)
  assert.equal((await client.zoek(START)).cp, 31)
  assert.equal(calls.length, 2)
  client.dispose()
}

{
  const { client, calls, advance } = harness([response(), response({}, 429)])
  await client.zoek(START)
  advance()
  await client.zoek(E4)
  assert.equal((await client.zoek(START)).cp, 31, 'known cache hits remain available during backoff')
  assert.equal(calls.length, 2)
  client.dispose()
}

function uniqueFen(index) {
  const row = index % 8
  const rows = Array(8).fill('8')
  rows[0] = '7k'; rows[7] = 'K7'
  rows[Math.floor(index / 8) + 1] = `${row || ''}Q${7 - row || ''}`
  return `${rows.join('/')} w - - 0 1`
}
{
  const { client, calls, advance } = harness(Array.from({ length: 8 }, (_, index) => response(payload(uniqueFen(index)))))
  for (let index = 0; index < 8; index++) {
    assert(await client.zoek(uniqueFen(index)))
    advance()
  }
  assert.equal(await client.zoek(uniqueFen(8)), null)
  assert.equal(calls.length, 8, 'each game makes at most eight network attempts')
  assert.equal((await client.zoek(uniqueFen(0))).source, 'lichess', 'cache hits remain available after the attempt budget')
  assert.equal(calls.length, 8)
  client.dispose()
}

{
  const stall = deferred()
  const { client, calls, advance } = harness([() => stall.promise, response()])
  const controller = new AbortController()
  const pending = client.zoek(START, { signal: controller.signal })
  assert.equal(await client.zoek(E4), null, 'only one network request can be active')
  assert.equal(calls.length, 1)
  controller.abort()
  assert.equal(await pending, null, 'a noncooperative fetch still settles on caller cancellation')
  assert(calls[0].options.signal.aborted, 'cancellation aborts the real fetch signal')
  advance()
  const replacement = await client.zoek(START)
  assert.equal(replacement.cp, 31)
  stall.resolve(response(payload(START, { pvs: [{ moves: 'a2a3', cp: 999 }] })))
  await tick()
  assert.equal((await client.zoek(START)).cp, 31, 'late cancelled results cannot overwrite the success cache')
  client.dispose()
}

{
  const { client, calls } = harness([])
  const controller = new AbortController()
  controller.abort()
  assert.equal(await client.zoek(START, { signal: controller.signal }), null)
  assert.equal(calls.length, 0)
  client.dispose()
}

{
  const stall = deferred()
  const { client, calls } = harness([() => stall.promise])
  const pending = client.zoek(START)
  client.dispose()
  assert.equal(await pending, null)
  assert(calls[0].options.signal.aborted)
  stall.resolve(response())
  await tick()
  assert.equal(await client.zoek(START), null)
  assert.equal(calls.length, 1)
}

for (const badResponse of [
  new Error('offline'), response({}, 500), response({}, 403),
  new Response('{broken json', { headers: { 'content-type': 'application/json' } }),
  new Response(JSON.stringify(payload()), { headers: { 'content-type': 'text/html' } }),
  new Response(JSON.stringify(payload()), { headers: { 'content-type': 'application/json', 'content-length': '20000' } }),
  new Response(' '.repeat(17000) + JSON.stringify(payload())),
  { status: 200, text: () => { throw new Error('unbounded text fallback must not be used') } },
]) {
  const { client } = harness([badResponse])
  assert.equal(await client.zoek(START), null, 'network errors, non-JSON and oversized bodies are misses')
  client.dispose()
}

{
  const encoded = new TextEncoder().encode(JSON.stringify(payload()))
  const stream = new ReadableStream({ start(controller) {
    for (let offset = 0; offset < encoded.length; offset += 7) controller.enqueue(encoded.slice(offset, offset + 7))
    controller.close()
  } })
  const { client } = harness([new Response(stream, { headers: { 'content-type': 'application/json; charset=utf-8' } })])
  assert.equal((await client.zoek(START)).cp, 31, 'small streamed chunks reconstruct one bounded JSON payload')
  client.dispose()
}

// Virtual timers make deadlines deterministic while the passed fetch signal is real.
{
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout
  const timers = new Map()
  let nextTimer = 0
  globalThis.setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id }
  globalThis.clearTimeout = id => timers.delete(id)
  try {
    for (const phase of ['fetch', 'body']) {
      let bodyCancelled = false
      const body = new ReadableStream({ cancel() { bodyCancelled = true } })
      const { client, calls } = harness([phase === 'fetch' ? () => new Promise(() => {}) : new Response(body)])
      const pending = client.zoek(START)
      await tick()
      assert.equal(timers.size, 1)
      const timer = [...timers.values()][0]
      assert.equal(timer.delay, 1500)
      timer.callback()
      assert.equal(await pending, null, `${phase} timeout settles without a cooperating network`)
      assert(calls[0].options.signal.aborted, `${phase} timeout aborts the underlying request`)
      if (phase === 'body') assert(bodyCancelled, 'body reading is included in the real cancellation')
      assert.equal(timers.size, 0)
      client.dispose()
    }
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear }
}

console.log('PASS: Lichess fixed endpoint/privacy, bounded validation/cache, request limits, misses/backoff, timeout/cancellation and stale-response isolation')
