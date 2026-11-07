import assert from 'node:assert/strict'
import * as Schaak from '../../schaak.js'
import { schaakUltraBot } from '../../schaak-ultra.js'
import { schaakFen, uciNaarZet } from '../../schaak-ultra-engine.js'

const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const result = (bestmove = 'e7e5', source = 'lichess') => ({ bestmove, source, cp:35, mate:null, depth:26 })
const clone = state => structuredClone(state)

function emptyState() {
  const state = Schaak.nieuweSpelStaat()
  state.bord = Array.from({ length:8 }, () => Array(8).fill(null))
  state.bord[7][7] = 'wK'; state.bord[0][4] = 'zK'
  state.rokade = { wK:false, wQ:false, zK:false, zQ:false }
  return state
}
function fakeClock() {
  let time = 0, next = 0
  const timers = new Map()
  const timing = {
    now:() => time, random:() => 1,
    setTimeout(fn, delay) { const id = ++next; timers.set(id, { fn, at:time + delay }); return id },
    clearTimeout:id => timers.delete(id),
  }
  return {
    timing, get pending() { return timers.size },
    async advance(ms) {
      const target = time + ms
      await tick()
      while (true) {
        const first = [...timers].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!first) break
        const [id, task] = first
        timers.delete(id); time = task.at; task.fn(); await tick()
      }
      time = target; await tick()
    }
  }
}

// The UI owns its own snapshots. A rollback acknowledgement must describe the
// exact same complete state before this harness restores that UI snapshot.
function harness({ initial = Schaak.nieuweSpelStaat(), cloud = () => result(), engine = () => result('e2e4', 'stockfish'), thinkingMs = 0, holdBlack = false, onEvent } = {}) {
  const clock = fakeClock(), events = [], cloudCalls = [], engineCalls = []
  let board = clone(initial), ply = 0, generation = 0, closed = false, engineDisposals = 0, cloudDisposals = 0
  const snapshots = [clone(board)]
  const motor = { ...Schaak, nieuweSpelStaat:() => clone(initial) }
  const bot = schaakUltraBot({
    motor, timing:clock.timing, isDicht:() => closed,
    cloudFactory:() => ({
      async zoek(fen, options) { const request = { fen, options }; cloudCalls.push(request); return cloud(request, cloudCalls.length - 1) },
      dispose() { cloudDisposals++ }
    }),
    engineFactory:() => ({
      async analyse(fen, options) { const request = { fen, options }; engineCalls.push(request); return engine(request, engineCalls.length - 1) },
      dispose() { engineDisposals++ }
    }),
    stuur(event, payload) {
      events.push({ event, payload })
      if (event === 'zet') {
        assert.equal(board.aanZet, 'z', 'only a legal Black reply can advance the UI')
        assert.equal(payload.ultraPly, ply + 1, 'bot replies carry their resulting half-move number')
        assert.equal(payload.ultraGeneration, generation, 'bot replies belong to the current board lifetime')
        assert(Schaak.alleLegaleZetten(board, 'z').some(move => JSON.stringify(move) === JSON.stringify(payload.zet)))
        if (!holdBlack) {
          Schaak.voerZetUit(board, payload.zet, payload.promotieStuk)
          snapshots[++ply] = clone(board)
        }
      } else if (event === 'ultra-takeback-result' && payload.ok) {
        assert(Number.isSafeInteger(payload.ply) && payload.ply >= 0 && payload.ply < ply)
        const expected = snapshots[payload.ply]
        assert(expected, 'the acknowledged position has a real UI snapshot')
        assert.equal(payload.fen, schaakFen(expected, Math.floor(payload.ply / 2) + 1), 'rollback restores pieces, turn, castling, en-passant and counters together')
        assert.equal(payload.generation, generation + 1)
        board = clone(expected); ply = payload.ply; generation = payload.generation
        snapshots.length = ply + 1
      } else if (event === 'ultra-hint-result' && payload.ok) {
        assert.equal(payload.ply, ply)
        assert.equal(payload.generation, generation)
        assert.equal(payload.fen, schaakFen(board, Math.floor(ply / 2) + 1))
        assert.equal(board.aanZet, 'w', 'only the human turn can produce a hint')
        assert(Array.isArray(payload.from) && payload.from.length === 2)
        assert(payload.from.every(value => Number.isInteger(value) && value >= 0 && value < 8))
        assert.equal(board.bord[payload.from[0]][payload.from[1]]?.[0], 'w')
        assert(Array.isArray(payload.to) && payload.to.length === 2)
        assert(payload.to.every(value => Number.isInteger(value) && value >= 0 && value < 8))
        const hintedMove = Schaak.alleLegaleZetten(board, 'w').find(move => move.van[0] === payload.from[0] && move.van[1] === payload.from[1] && move.naar[0] === payload.to[0] && move.naar[1] === payload.to[1])
        assert(hintedMove, 'the complete hinted move is legal in this exact position')
        const promotion = board.bord[payload.from[0]][payload.from[1]][1] === 'P' && [0,7].includes(payload.to[0])
        if (promotion) assert(['Q','R','B','N'].includes(payload.promotieStuk))
        else assert.equal('promotieStuk' in payload,false,'ordinary hints do not masquerade as promotions')
        assert(['lichess','stockfish'].includes(payload.source))
        assert(Number.isSafeInteger(payload.depth) && payload.depth >= 0)
        for (const score of ['cp','mate']) assert(payload[score] === null || Number.isFinite(payload[score]))
        for (const target of ['naar','target','zet','bestmove','pv']) assert.equal(target in payload, false, 'only validated move coordinates leave the engine adapter: ' + target)
      }
      onEvent?.(event, payload)
    }
  })
  bot.ontvang('bot-instellingen', { thinkingMs })
  return {
    bot, clock, events, cloudCalls, engineCalls,
    get board() { return board }, get ply() { return ply }, get generation() { return generation },
    get engineDisposals() { return engineDisposals }, get cloudDisposals() { return cloudDisposals },
    messages:event => events.filter(message => message.event === event),
    moves:() => events.filter(message => message.event === 'zet'),
    hints:() => events.filter(message => message.event === 'ultra-hint-result'),
    takebacks:() => events.filter(message => message.event === 'ultra-takeback-result'),
    settings:(takeback, hints) => bot.ontvang('ultra-assistentie-instellingen', { takeback, hints }),
    hint(payload = {}) { bot.ontvang('ultra-hint', { ply, generation, ...payload }) },
    undo(payload = {}) { bot.ontvang('ultra-takeback', { ply, generation, ...payload }) },
    white(uci = 'e2e4') {
      const choice = uciNaarZet(Schaak, board, uci)
      assert(choice, 'fixture White move is legal: ' + uci)
      assert.equal(board.aanZet, 'w')
      const before = ply
      Schaak.voerZetUit(board, choice.zet, choice.promotieStuk)
      snapshots[++ply] = clone(board)
      bot.ontvang('zet', { ...choice, ultraPly:before, ultraGeneration:generation })
      return choice
    },
    reset() {
      board = clone(initial); ply = 0; generation++; snapshots.length = 1; snapshots[0] = clone(board)
      bot.ontvang('opnieuw')
    },
    stop() { closed = true; bot.stop() }
  }
}

const originalFetch = globalThis.fetch
globalThis.fetch = () => { throw Error('assistance tests must never access the network') }
try {
  // Both settings require explicit boolean true; disabled assistance cannot
  // interrupt a required Black reply or silently opt into engine work.
  for (const invalid of [undefined, false, 'true', 1, null]) {
    const wait = deferred(), h = harness({ cloud:() => wait.promise })
    if (invalid !== undefined) h.settings(invalid, invalid)
    h.hint(); h.undo()
    assert.equal(h.hints().at(-1).payload.reason, 'disabled')
    assert.equal(h.takebacks().at(-1).payload.ok, false)
    assert.equal(h.engineCalls.length, 0)
    h.white(); await tick(); h.undo()
    assert.equal(h.cloudCalls[0].options.signal.aborted, false)
    wait.resolve(result()); await tick()
    assert.equal(h.moves().length, 1)
    h.stop()
  }

  {
    const h = harness()
    const before = clone(h.board)
    h.settings(false, true); h.hint(); h.hint(); await tick()
    assert.equal(h.cloudCalls.length, 0, 'hints never spend a cloud lookup')
    assert.equal(h.engineCalls.length, 1, 'repeated clicks share one current-position analysis')
    assert.equal(h.engineCalls[0].options.movetime, 650)
    assert.equal(h.hints().filter(message => message.payload.ok).length, 1)
    assert.deepEqual(h.hints()[0].payload.from, [6, 4])
    assert.deepEqual(h.hints()[0].payload.to,[4,4]);assert.equal(h.hints()[0].payload.depth,26);assert.equal(h.hints()[0].payload.cp,35)
    assert.deepEqual(h.board, before, 'asking for a hint never executes the suggested move')
    h.hint(); await tick()
    assert.equal(h.engineCalls.length, 1, 'a completed current-position best move is cached')
    assert.equal(h.hints().filter(message => message.payload.ok).length, 2)
    for (const payload of [{ ply:-1 }, { ply:1 }, { generation:1 }]) {
      h.hint(payload)
      assert.equal(h.hints().at(-1).payload.reason, 'stale')
    }
    h.stop()
  }

  // Detailed hint metadata identifies an actual underpromotion and never
  // passes non-finite scores/depth through to UI explanations.
  {
    const initial=emptyState();initial.bord[1][0]='wP'
    const h=harness({initial,engine:()=>result('a7a8n','stockfish')})
    h.settings(false,true);h.hint();await tick()
    const hint=h.hints().at(-1).payload
    assert.deepEqual(hint.to,[0,0]);assert.equal(hint.promotieStuk,'N')
    assert.deepEqual(h.board,initial,'a detailed promotion hint never promotes a live pawn')
    h.stop()
  }
  {
    const h=harness({engine:()=>({bestmove:'g1f3',depth:Infinity,cp:Infinity,mate:NaN})})
    h.settings(false,true);h.hint();await tick()
    const hint=h.hints().at(-1).payload
    assert.equal(hint.ok,true);assert.equal(hint.depth,0);assert.equal(hint.cp,null);assert.equal(hint.mate,null)
    assert.deepEqual(hint.to,[5,5]);h.stop()
  }

  // Evaluation and hints share human-turn work in either settings order.
  {
    const wait = deferred(), h = harness({ engine:() => wait.promise })
    h.settings(false, true); h.hint(); await tick()
    h.bot.ontvang('ultra-evaluatie-instelling', { enabled:true })
    h.bot.ontvang('ultra-evaluatie-instelling', { enabled:false })
    assert.equal(h.engineCalls[0].options.signal.aborted, false, 'meter OFF preserves a requested hint')
    assert.equal(h.engineCalls.length, 1)
    wait.resolve(result('g1f3', 'stockfish')); await tick()
    assert.deepEqual(h.hints().at(-1).payload.from, [7, 6])
    assert.equal(h.messages('ultra-evaluatie').length, 0, 'a hidden meter stays quiet while its shared hint finishes')
    h.stop()
  }
  {
    const wait = deferred(), h = harness({ engine:() => wait.promise })
    h.bot.ontvang('ultra-evaluatie-instelling', { enabled:true }); await tick()
    h.settings(false, true); h.hint(); h.settings(false, false)
    assert.equal(h.engineCalls[0].options.signal.aborted, false, 'hint OFF preserves still-enabled meter work')
    wait.resolve(result('e2e4', 'stockfish')); await tick()
    assert.equal(h.hints().filter(message => message.payload.ok).length, 0)
    assert(h.messages('ultra-evaluatie').some(message => message.payload.final))
    h.stop()
  }
  {
    const h = harness({ engine:(_request, index) => result(index === 0 ? 'e2e4' : 'g1f3', 'stockfish') })
    h.bot.ontvang('ultra-evaluatie-instelling', { enabled:true }); await tick()
    h.settings(false, true); h.hint()
    assert.equal(h.engineCalls.length, 1, 'the final meter result answers the first hint')
    assert.deepEqual(h.hints().at(-1).payload.from, [6, 4])
    h.white(); await tick(); h.hint()
    assert.equal(h.engineCalls.length, 2, 'the next human position has its own final cache')
    assert.deepEqual(h.hints().at(-1).payload.from, [7, 6], 'the previous pawn origin cannot leak into a new position')
    assert.equal(h.hints().at(-1).payload.ply, 2)
    assert.equal(h.cloudCalls.length, 1)
    h.stop()
  }

  // Bad engine results fail quietly without inventing an origin or moving.
  for (const failure of [result('e7e5', 'stockfish'), result('e2e5', 'stockfish'), new Error('engine unavailable')]) {
    const h = harness({ engine:() => { if (failure instanceof Error) throw failure; return failure } })
    h.settings(false, true); h.hint(); await tick()
    assert.equal(h.hints().at(-1).payload.ok, false)
    assert.equal(h.hints().at(-1).payload.reason, 'unavailable')
    assert.equal('from' in h.hints().at(-1).payload, false)
    assert.equal(h.moves().length, 0)
    h.stop()
  }

  {
    const wait = deferred(), h = harness({ cloud:() => wait.promise })
    h.settings(true, true); h.white(); await tick(); h.hint()
    assert.equal(h.hints().at(-1).payload.reason, 'turn')
    assert.equal(h.engineCalls.length, 0)
    assert.equal(h.cloudCalls[0].options.signal.aborted, false, 'a Black-turn hint cannot replace the required reply')
    h.stop()
  }

  // The same FEN after reset is a different generation: late analyses cannot
  // satisfy the new hint or populate its cache.
  {
    const waits = [deferred(), deferred()], h = harness({ engine:(_request, index) => waits[index].promise })
    h.settings(false, true); h.hint(); await tick()
    h.reset(); h.hint(); await tick()
    assert.equal(h.engineCalls[0].options.signal.aborted, true)
    assert.equal(h.engineCalls[0].fen, h.engineCalls[1].fen)
    waits[0].resolve(result('e2e4', 'stockfish')); await tick()
    assert.equal(h.hints().filter(message => message.payload.ok).length, 0)
    waits[1].resolve(result('g1f3', 'stockfish')); await tick()
    assert.deepEqual(h.hints().at(-1).payload.from, [7, 6])
    assert.equal(h.hints().at(-1).payload.generation, 1)
    h.stop()
  }
  for (const action of ['white','off','stop']) {
    const wait = deferred(), cloudWait = deferred(), h = harness({ engine:() => wait.promise, cloud:() => cloudWait.promise })
    h.settings(false, true); h.hint(); await tick()
    if (action === 'white') h.white()
    else if (action === 'off') h.settings(false, false)
    else h.stop()
    assert.equal(h.engineCalls[0].options.signal.aborted, true, action + ' cancels optional hint work')
    const before = h.events.length
    wait.resolve(result('e2e4', 'stockfish')); await tick()
    assert.equal(h.hints().filter(message => message.payload.ok).length, 0)
    if (action === 'stop') assert.equal(h.events.length, before)
    h.stop()
  }

  // Odd rollback removes White's still-pending move and cancels old cloud work.
  {
    const wait = deferred(), h = harness({ cloud:(_request, index) => index === 0 ? wait.promise : result('d7d5') })
    h.settings(true, true); h.white(); await tick()
    h.undo({ generation:99 }); assert.equal(h.takebacks().at(-1).payload.reason, 'stale')
    h.undo({ ply:0 }); assert.equal(h.takebacks().at(-1).payload.reason, 'stale')
    assert.equal(h.cloudCalls[0].options.signal.aborted, false, 'invalid rollback requests cannot cancel the active turn')
    h.undo()
    assert.equal(h.ply, 0); assert.equal(h.generation, 1)
    assert.equal(h.cloudCalls[0].options.signal.aborted, true)
    assert.deepEqual(h.board, Schaak.nieuweSpelStaat())
    h.white('d2d4'); await tick()
    wait.resolve(result()); await tick()
    assert.equal(h.moves().length, 1, 'the canceled earlier branch never replies on the restored board')
    assert.equal(h.board.bord[3][3], 'zP')
    assert.equal(h.cloudDisposals, 0, 'undo keeps this game\'s cloud cache and request budget')
    h.stop()
  }
  {
    const h = harness({ thinkingMs:5000 })
    h.settings(true, false); h.white(); await tick()
    assert.equal(h.clock.pending, 1, 'the analyzed reply is waiting for its human timing')
    h.undo()
    assert.equal(h.clock.pending, 0, 'rollback cancels delayed delivery as well as engine work')
    await h.clock.advance(7000)
    assert.equal(h.moves().length, 0)
    assert.equal(h.ply, 0)
    h.stop()
  }
  {
    const h = harness({ holdBlack:true })
    h.settings(true, false); h.white(); await tick()
    assert.equal(h.ply, 1, 'the UI still shows the White move while the bot reply is in transit')
    assert.equal(h.moves()[0].payload.ultraPly, 2, 'the backend has already committed its reply')
    h.undo({ generation:undefined })
    assert.equal(h.takebacks().at(-1).payload.reason, 'stale', 'the in-transit exception requires explicit current-generation metadata')
    h.undo({ generation:99 })
    assert.equal(h.takebacks().at(-1).payload.reason, 'stale')
    h.undo()
    assert.equal(h.ply, 0); assert.equal(h.generation, 1)
    assert.deepEqual(h.board, Schaak.nieuweSpelStaat(), 'rollback identifies the same last White move on both sides of delivery')
    assert.notEqual(h.moves()[0].payload.ultraGeneration, h.generation, 'the delayed old reply can be rejected by the restored UI')
    h.stop()
  }

  // Even rollback removes the bot reply and the preceding White move. Repeated
  // undo trims the branch, and the next White move receives fresh metadata.
  {
    const replies = ['e7e5','b8c6','d7d5'], h = harness({ cloud:(_request, index) => result(replies[index]) })
    h.settings(true, false)
    h.white(); await tick(); const firstRound = clone(h.board)
    h.white('g1f3'); await tick()
    h.undo(); assert.equal(h.ply, 2); assert.deepEqual(h.board, firstRound)
    h.undo(); assert.equal(h.ply, 0); assert.equal(h.generation, 2)
    h.undo(); assert.equal(h.takebacks().at(-1).payload.ok, false)
    const stale = uciNaarZet(Schaak, h.board, 'e2e4')
    h.bot.ontvang('zet', { ...stale, ultraPly:0, ultraGeneration:0 })
    h.bot.ontvang('zet', { ...stale, ultraPly:2, ultraGeneration:2 })
    await tick()
    assert.equal(h.cloudCalls.length, 2, 'old-generation and wrong-ply human events are ignored')
    h.white('d2d4'); await tick()
    assert.equal(h.moves().at(-1).payload.ultraGeneration, 2)
    assert.equal(h.moves().at(-1).payload.ultraPly, 2)
    h.stop()
  }

  const fixtures = []
  {
    const initial = emptyState()
    initial.bord[7][7] = 'wR'; initial.bord[7][4] = 'wK'; initial.bord[0][7] = 'zR'
    initial.bord[3][1] = 'wP'; initial.bord[3][2] = 'zP'
    initial.rokade.wK = true; initial.rokade.zK = true
    initial.enPassantKolom = 2; initial.halfzetTeller = 37
    fixtures.push({ name:'rook capture and both castling rights', initial, white:'h1h2', black:'h8h2' })
  }
  {
    const initial = emptyState()
    initial.bord[7][7] = 'wR'; initial.bord[7][4] = 'wK'; initial.rokade.wK = true
    fixtures.push({ name:'White castling', initial, white:'e1g1', black:'e8d8' })
  }
  {
    const initial = emptyState(); initial.bord[0][7] = 'zR'; initial.rokade.zK = true
    fixtures.push({ name:'Black castling', initial, white:'h1g1', black:'e8h8' })
  }
  {
    const initial = emptyState(); initial.bord[1][0] = 'wP'
    fixtures.push({ name:'White underpromotion', initial, white:'a7a8n', black:'e8f8' })
  }
  {
    const initial = emptyState(); initial.bord[6][0] = 'zP'
    fixtures.push({ name:'Black underpromotion', initial, white:'h1g1', black:'a2a1n' })
  }
  {
    const initial = emptyState(); initial.bord[4][3] = 'zP'; initial.bord[6][4] = 'wP'
    fixtures.push({ name:'Black en-passant capture', initial, white:'e2e4', black:'d4e3' })
  }
  for (const fixture of fixtures) {
    const h = harness({ initial:fixture.initial, cloud:() => result(fixture.black) })
    h.settings(true, false); h.white(fixture.white); await tick()
    assert.equal(h.ply, 2, fixture.name + ' has a complete legal round')
    h.undo()
    assert.deepEqual(h.board, fixture.initial, fixture.name + ' is undone as a complete state')
    h.white(fixture.white); await tick()
    assert.equal(h.ply, 2, fixture.name + ' can be replayed legally after restoring rights and pieces')
    h.stop()
  }
  {
    const initial = emptyState(); initial.bord[3][4] = 'wP'; initial.bord[1][3] = 'zP'
    const replies = ['d7d5','e8f8','e8f8'], h = harness({ initial, cloud:(_request, index) => result(replies[index]) })
    h.settings(true, false); h.white('h1g1'); await tick()
    const enPassantPosition = clone(h.board)
    assert.equal(enPassantPosition.enPassantKolom, 3)
    const capture = h.white('e5d6'); assert.equal(capture.zet.type, 'enpassant'); await tick()
    h.undo(); assert.deepEqual(h.board, enPassantPosition, 'undo reinstates an active en-passant opportunity and its captured pawn')
    assert.equal(h.white('e5d6').zet.type, 'enpassant'); await tick()
    h.stop()
  }
  {
    const replies = ['d7d5','d8d5'], h = harness({ cloud:(_request, index) => result(replies[index]) })
    h.settings(true, false); h.white(); await tick(); const beforeCapture = clone(h.board)
    h.white('e4d5'); await tick()
    assert.equal(h.board.bord[3][3], 'zQ')
    h.undo(); assert.deepEqual(h.board, beforeCapture, 'both captured pawns and the queen return to the previous White turn')
    h.stop()
  }

  {
    const replies = ['e7e5','d8h4'], h = harness({ cloud:(_request, index) => result(replies[index]) })
    h.settings(true, true); h.white('f2f3'); await tick(); const beforeMistake = clone(h.board)
    h.white('g2g4'); await tick()
    assert.equal(Schaak.isSchaakmat(h.board, 'w'), true)
    h.hint(); assert.equal(h.hints().at(-1).payload.reason, 'unavailable')
    h.undo(); assert.deepEqual(h.board, beforeMistake, 'takeback can recover from Black delivering checkmate')
    h.hint(); await tick(); assert.equal(h.hints().at(-1).payload.ok, true)
    h.stop()
  }
  {
    const replies = ['e7e5','b8c6','g8f6'], h = harness({ cloud:(_request, index) => result(replies[index]) })
    h.settings(true, false)
    for (const white of ['e2e4','d1h5','f1c4']) { h.white(white); await tick() }
    const beforeMate = clone(h.board)
    h.white('h5f7'); await tick()
    assert.equal(h.ply, 7); assert.equal(Schaak.isSchaakmat(h.board, 'z'), true)
    h.undo(); assert.equal(h.ply, 6); assert.deepEqual(h.board, beforeMate, 'a terminal White move rolls back one half-move')
    h.stop()
  }

  // Rollback also clears an outstanding hint even when the restored line can
  // later reach exactly the same board again.
  {
    const wait = deferred(), h = harness({ engine:() => wait.promise })
    h.settings(true, true); h.white(); await tick(); h.hint(); await tick()
    h.undo()
    assert.equal(h.engineCalls[0].options.signal.aborted, true)
    wait.resolve(result('g1f3', 'stockfish')); await tick()
    assert.equal(h.hints().filter(message => message.payload.ok).length, 0)
    assert.equal(h.generation, 1); assert.equal(h.ply, 0)
    h.stop()
  }

  // The normal solo channel is asynchronous, but direct adapters may react
  // synchronously to a status/evaluation/reply. Those callbacks cannot allow an
  // old delivery to move the restored board or replace its fresh analysis.
  {
    let h, undone = false
    h = harness({ onEvent(event, payload) {
      if (!undone && event === 'ultra-status' && payload.phase === 'ready' && payload.source === 'lichess') { undone = true; h.undo() }
    } })
    h.settings(true, false); h.white(); await tick()
    assert(undone); assert.equal(h.moves().length, 0); assert.equal(h.ply, 0)
    h.stop()
  }
  {
    let h, undone = false
    h = harness({ onEvent(event, payload) {
      if (!undone && event === 'ultra-evaluatie' && payload.final && payload.ply === 1) { undone = true; h.undo() }
    } })
    h.settings(true, false); h.bot.ontvang('ultra-evaluatie-instelling', { enabled:true }); await tick()
    h.white(); await tick()
    assert(undone); assert.equal(h.moves().length, 0); assert.equal(h.ply, 0)
    h.stop()
  }
  {
    const fresh = deferred()
    let h, undone = false
    h = harness({ engine:(_request, index) => index === 0 ? result('e2e4', 'stockfish') : fresh.promise,
      onEvent(event) { if (!undone && event === 'zet') { undone = true; h.undo() } }
    })
    h.settings(true, false); h.bot.ontvang('ultra-evaluatie-instelling', { enabled:true }); await tick()
    h.white(); await tick()
    assert(undone); assert.equal(h.ply, 0)
    assert.equal(h.engineCalls.length, 2, 'the restored board receives one fresh search')
    assert.equal(h.engineCalls[1].options.signal.aborted, false, 'old reply follow-up cannot cancel the new generation')
    fresh.resolve(result('e2e4', 'stockfish')); await tick()
    assert.equal(h.messages('ultra-evaluatie').at(-1).payload.generation, 1)
    h.stop()
  }
  {
    const black = deferred()
    let h, played = false
    h = harness({ cloud:() => black.promise, onEvent(event, payload) {
      if (!played && event === 'ultra-hint-result' && payload.ok) { played = true; h.white() }
    } })
    h.settings(false, true); h.hint(); await tick()
    assert(played); assert.equal(h.ply, 1)
    assert.equal(h.cloudCalls.length, 1)
    assert.equal(h.cloudCalls[0].options.signal.aborted, false)
    black.resolve(result()); await tick()
    assert.equal(h.moves().length, 1, 'finishing the old hint cannot detach the next Black search')
    h.stop()
  }
} finally {
  globalThis.fetch = originalFetch
}

console.log('PASS: opt-in Ultra takeback/hints, complete-state rollback, special moves and mate recovery, stale generation/cloud/timer isolation, local legal exact-move hints with validated metadata, shared meter work and cancellation.')
