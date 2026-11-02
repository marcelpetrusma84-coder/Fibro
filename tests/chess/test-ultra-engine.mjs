import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import * as Schaak from '../../schaak.js'
import { schaakFen, uciNaarZet, parseStockfishInfo, maakStockfishEngine } from '../../schaak-ultra-engine.js'

const release = JSON.parse(readFileSync(new URL('../../vendor/stockfish/manifest.json', import.meta.url), 'utf8'))
assert.equal(release.version, '19.0.1')
for (const file of release.files) {
  const bytes = readFileSync(new URL('../../vendor/stockfish/' + file.file, import.meta.url))
  assert.equal(bytes.length, file.bytes, 'the pinned release asset has the recorded size: ' + file.file)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, 'the pinned release asset is intact: ' + file.file)
}

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const state = Schaak.nieuweSpelStaat()
assert.equal(schaakFen(state), startFen)
const e4 = uciNaarZet(Schaak, state, 'e2e4')
assert.equal(e4.zet.type, 'dubbelzet')
Schaak.voerZetUit(state, e4.zet)
state.halfzetTeller = 17
assert.equal(schaakFen(state, 9), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 17 9')
Schaak.voerZetUit(state, uciNaarZet(Schaak, state, 'd7d5').zet)
state.rokade = { wK: true, wQ: false, zK: false, zQ: true }
assert.equal(schaakFen(state, 10).split(' ').slice(1).join(' '), 'w Kq d6 17 10')
assert.equal(uciNaarZet(Schaak, state, 'd7d5'), null, 'wrong player cannot move')
assert.equal(uciNaarZet(Schaak, state, 'e4e6'), null, 'illegal move cannot be applied')
assert.equal(uciNaarZet(Schaak, state, '(none)'), null)
assert.equal(uciNaarZet(Schaak, state, '0000'), null)
assert.equal(uciNaarZet(Schaak, state, 'e4e5q'), null, 'promotion suffix requires a promotion')

function emptyState() {
  const state = Schaak.nieuweSpelStaat()
  state.bord = Array.from({ length: 8 }, () => Array(8).fill(null))
  state.bord[7][4] = 'wK'
  state.bord[0][4] = 'zK'
  return state
}
const castle = emptyState()
castle.bord[7][0] = castle.bord[7][7] = 'wR'
assert.equal(uciNaarZet(Schaak, castle, 'e1g1').zet.type, 'rokade-kort')
assert.equal(uciNaarZet(Schaak, castle, 'e1c1').zet.type, 'rokade-lang')
castle.aanZet = 'z'
castle.bord[0][0] = castle.bord[0][7] = 'zR'
assert.equal(uciNaarZet(Schaak, castle, 'e8g8').zet.type, 'rokade-kort')
const enPassant = emptyState()
enPassant.bord[3][4] = 'wP'
enPassant.bord[3][3] = 'zP'
enPassant.enPassantKolom = 3
assert.equal(uciNaarZet(Schaak, enPassant, 'e5d6').zet.type, 'enpassant')
const promotion = emptyState()
promotion.bord[1][0] = 'wP'
assert.equal(uciNaarZet(Schaak, promotion, 'a7a8'), null, 'UCI promotions specify a piece')
for (const type of ['q', 'r', 'b', 'n']) {
  assert.equal(uciNaarZet(Schaak, promotion, `a7a8${type}`).promotieStuk, type.toUpperCase())
}
promotion.aanZet = 'z'
promotion.bord[6][7] = 'zP'
assert.equal(uciNaarZet(Schaak, promotion, 'h2h1n').promotieStuk, 'N')

assert.deepEqual(parseStockfishInfo('info depth 21 seldepth 30 multipv 1 score cp 156 nodes 1234 pv e2e4', 'w'), { cp: 156, mate: null, depth: 21 })
assert.deepEqual(parseStockfishInfo('info depth 18 score cp -81 pv e7e5', 'z'), { cp: 81, mate: null, depth: 18 })
assert.deepEqual(parseStockfishInfo('info depth 14 score mate 3 pv e7e5', 'b'), { cp: null, mate: -3, depth: 14 })
assert.deepEqual(parseStockfishInfo('info depth 14 score mate -3', 'z'), { cp: null, mate: 3, depth: 14 })
assert(Object.is(parseStockfishInfo('info depth 0 score mate 0', 'w').mate, -0))
assert(Object.is(parseStockfishInfo('info depth 0 score mate 0', 'z').mate, 0))
for (const line of [
  'info depth 10 score cp 200 lowerbound', 'info depth 10 score mate 2 upperbound',
  'info depth 10 multipv 2 score cp 100', 'info depth 10 nodes 1234',
  'info depth 10 score cp NaN', 'info depth 10 score cp 12.5',
  'info depth -1 score cp 100', 'info depth 10 score cp 99999999999999999999999',
  'info string score cp 12', 'bestmove e2e4',
]) assert.equal(parseStockfishInfo(line, 'w'), null, `ignore invalid/non-exact score: ${line}`)

class FakeWorker {
  constructor(url) { this.url = url; this.commands = []; this.listeners = new Map(); this.terminated = false }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(callback)
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback) }
  postMessage(command) { this.commands.push(command); this.onPost?.(command) }
  terminate() { this.terminated = true }
  emit(data) { for (const listener of [...(this.listeners.get('message') || [])]) listener({ data }) }
  error(message = 'worker failed') { for (const listener of [...(this.listeners.get('error') || [])]) listener({ message }) }
}
const tick = () => Promise.resolve()
function harness(options = {}) {
  const workers = []
  const engine = maakStockfishEngine({ ...options, workerFactory: url => {
    const worker = new FakeWorker(url)
    workers.push(worker)
    return worker
  } })
  return { engine, workers }
}
async function ready(worker) { worker.emit('uciok'); worker.emit('readyok'); await tick() }

{
  const infos = [], local = []
  const { engine, workers } = harness({ onInfo: info => infos.push(info) })
  const analysis = engine.analyse(startFen, { movetime: 777, onInfo: info => local.push(info) })
  const worker = workers[0]
  await assert.rejects(engine.analyse(startFen), /al een analyse/)
  assert.equal(worker.url.pathname.endsWith('/vendor/stockfish/stockfish-19-lite-single.js'), true)
  assert.deepEqual(worker.commands, ['uci'])
  worker.emit('id name Stockfish 19\nuciok')
  assert.deepEqual(worker.commands, [
    'uci', 'setoption name Threads value 1', 'setoption name Hash value 32',
    'setoption name MultiPV value 1', 'setoption name Skill Level value 20',
    'setoption name UCI_LimitStrength value false', 'isready',
  ])
  worker.emit('info depth 1 score cp 999\nbestmove a2a3')
  assert.equal(infos.length, 0, 'no search scores accepted before ready')
  worker.emit('readyok')
  await tick()
  assert.deepEqual(worker.commands.slice(-2), [`position fen ${startFen}`, 'go movetime 777'])
  worker.emit('info depth 10 score cp 31\ninfo depth 11 score cp 300 lowerbound\ninfo depth 12 multipv 2 score cp 99\ninfo depth 13 score cp 52\nbestmove e2e4 ponder e7e5')
  assert.deepEqual(await analysis, { bestmove: 'e2e4', cp: 52, mate: null, depth: 13 })
  assert.equal(infos.length, 2)
  assert.deepEqual(infos, local)
  const blackAnalysis = engine.analyse(startFen.replace(' w ', ' b '))
  await tick()
  assert.equal(workers.length, 1, 'completed searches reuse the ready worker')
  worker.emit('info depth 16 score cp 72\nbestmove e7e5')
  assert.deepEqual(await blackAnalysis, { bestmove: 'e7e5', cp: -72, mate: null, depth: 16 })
  const noScore = engine.analyse(startFen)
  await tick()
  worker.emit('bestmove (none)')
  assert.deepEqual(await noScore, { bestmove: '(none)', cp: null, mate: null, depth: 0 }, 'previous scores do not leak into the next search')
  engine.dispose()
  assert(worker.terminated)
  engine.dispose()
  await assert.rejects(engine.analyse(startFen), /afgesloten/)
}

for (const phase of ['boot', 'search']) {
  const { engine, workers } = harness()
  const controller = new AbortController()
  const cancelled = engine.analyse(startFen, { signal: controller.signal })
  const rejected = assert.rejects(cancelled, { name: 'AbortError' })
  const oldWorker = workers[0]
  const oldHandler = [...oldWorker.listeners.get('message')][0]
  if (phase === 'search') await ready(oldWorker)
  controller.abort()
  await rejected
  assert(oldWorker.terminated, `${phase} abort terminates the old worker`)
  const next = engine.analyse(startFen)
  const newWorker = workers[1]
  assert.deepEqual(newWorker.commands, ['uci'], 'the replacement has its own handshake')
  await ready(newWorker)
  oldHandler({ data: 'uciok\nreadyok\ninfo depth 99 score cp 9999\nbestmove a2a3' })
  newWorker.emit('info depth 7 score cp 17\nbestmove d2d4')
  assert.deepEqual(await next, { bestmove: 'd2d4', cp: 17, mate: null, depth: 7 }, 'late replies from a cancelled worker cannot affect the new search')
  engine.dispose()
}

{
  const { engine, workers } = harness()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(engine.analyse(startFen, { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(workers.length, 0)
  const controller2 = new AbortController()
  let replacement
  const analysis = engine.analyse(startFen, { signal: controller2.signal, onInfo: () => {
    controller2.abort()
    replacement = engine.analyse(startFen)
  } })
  const rejected = assert.rejects(analysis, { name: 'AbortError' })
  await ready(workers[0])
  workers[0].emit('info depth 5 score cp 200\nbestmove a2a3\nreadyok\ninfo depth 99 score cp 9999')
  await rejected
  await ready(workers[1])
  workers[1].emit('info depth 9 score cp 41\nbestmove g1f3')
  assert.deepEqual(await replacement, { bestmove: 'g1f3', cp: 41, mate: null, depth: 9 })
  engine.dispose()
}

for (const phase of ['boot', 'search']) {
  const { engine, workers } = harness()
  const analysis = engine.analyse(startFen)
  const rejected = assert.rejects(analysis, /broken WASM/)
  if (phase === 'search') await ready(workers[0])
  workers[0].error('broken WASM')
  await rejected
  assert(workers[0].terminated)
  const retry = engine.analyse(startFen)
  await ready(workers[1])
  workers[1].emit('bestmove e2e4')
  assert.equal((await retry).bestmove, 'e2e4')
  engine.dispose()
}

{
  const engine = maakStockfishEngine({ workerFactory: () => { throw new Error('worker unavailable') } })
  await assert.rejects(engine.analyse(startFen), /worker unavailable/)
  engine.dispose()
  const worker = new FakeWorker()
  worker.onPost = () => { throw new Error('post failed') }
  const broken = maakStockfishEngine({ workerFactory: () => worker })
  await assert.rejects(broken.analyse(startFen), /post failed/)
  assert(worker.terminated)
  broken.dispose()
}

{
  const { engine, workers } = harness()
  const analysis = engine.analyse(startFen)
  const rejected = assert.rejects(analysis, /afgesloten/)
  engine.dispose()
  await rejected
  assert(workers[0].terminated)
}

{
  let engine, extraCallbacks = 0
  const setup = harness({ onInfo: () => engine.dispose() })
  engine = setup.engine
  const analysis = engine.analyse(startFen, { onInfo: () => extraCallbacks++ })
  const rejected = assert.rejects(analysis, /afgesloten/)
  await ready(setup.workers[0])
  setup.workers[0].emit('info depth 4 score cp 19\nbestmove e2e4')
  await rejected
  assert.equal(extraCallbacks, 0, 'disposing in the first callback stops further callbacks')
  assert(setup.workers[0].terminated)
}

// Run timeout callbacks directly so a failed worker never lengthens this suite.
{
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout
  const timers = new Map()
  let timerId = 0
  globalThis.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id }
  globalThis.clearTimeout = id => timers.delete(id)
  try {
    for (const phase of ['boot', 'search']) {
      const { engine, workers } = harness()
      const analysis = engine.analyse(startFen, { movetime: 80 })
      const rejected = assert.rejects(analysis, /niet op tijd/)
      if (phase === 'search') await ready(workers[0])
      assert.equal(timers.size, 1)
      const timer = [...timers.values()][0]
      assert(timer.delay > 0 && timer.delay <= 30000, 'boot and search both have a finite deadline')
      timer.callback()
      await rejected
      assert(workers[0].terminated)
      assert.equal(timers.size, 0)
      engine.dispose()
    }
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear }
}

console.log('PASS: Stockfish FEN/UCI, legal special moves, evaluation signs, handshake, sequential reuse, abort isolation, errors and bounded timeouts')
