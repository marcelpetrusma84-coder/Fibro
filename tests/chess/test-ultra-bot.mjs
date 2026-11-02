import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as Schaak from '../../schaak.js'
import { schaakUltraBot } from '../../schaak-ultra.js'
import { schaakFen, uciNaarZet } from '../../schaak-ultra-engine.js'
import { maakSoloKanaal, NIVEAUS, SOLO_SPELLEN } from '../../solo.js'

// The solo entry page needs the exact public API endpoint in its CSP. Other
// pages keep their existing policy; navigation to spel.html has its own policy.
const entry = readFileSync(new URL('../../spel.html', import.meta.url), 'utf8')
const policy = entry.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1]
const connections = policy.split(';').find(value => value.trim().startsWith('connect-src')).trim().split(/\s+/)
assert(connections.includes('https://lichess.org/api/cloud-eval'), 'the production CSP permits the actual Ultra API request')
assert(!connections.includes('*') && !connections.includes('https:'), 'Ultra does not broadly allow arbitrary network destinations')

const tick = async () => { for (let i=0; i<12; i++) await Promise.resolve() }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve=yes; reject=no })
  return { promise, resolve, reject }
}
const result = (bestmove='e7e5', source='lichess') => ({ bestmove, source, cp:42, mate:null, depth:28 })
function emptyState() {
  const state = Schaak.nieuweSpelStaat()
  state.bord = Array.from({length:8}, () => Array(8).fill(null))
  state.bord[7][7] = 'wK'; state.bord[0][4] = 'zK'
  state.rokade = { wK:false, wQ:false, zK:false, zQ:false }
  return state
}
function harness({ initial, cloud=() => result(), engine=() => result('e7e5', 'stockfish') }={}) {
  const events=[], cloudCalls=[], engineCalls=[], clouds=[]
  let board = structuredClone(initial || Schaak.nieuweSpelStaat()), closed=false, engineDisposals=0
  const motor = { ...Schaak, nieuweSpelStaat:() => structuredClone(initial || Schaak.nieuweSpelStaat()) }
  const engineFactory = () => ({
    async analyse(fen, options) {
      const request = {fen, options}; engineCalls.push(request)
      return engine(request, engineCalls.length-1)
    },
    dispose() { engineDisposals++ }
  })
  const cloudFactory = () => {
    const instance = { disposed:0 }; clouds.push(instance)
    return {
      async zoek(fen, options) {
        const request = {fen, options, instance}; cloudCalls.push(request)
        return cloud(request, cloudCalls.length-1)
      },
      dispose() { instance.disposed++ }
    }
  }
  const bot = schaakUltraBot({ motor, engineFactory, cloudFactory, isDicht:() => closed, stuur(event, payload) {
    events.push({event,payload})
    if (event === 'zet') {
      assert.equal(board.aanZet, 'z', 'only a black reply is delivered to the UI')
      assert.ok(Schaak.alleLegaleZetten(board, 'z').some(move => JSON.stringify(move) === JSON.stringify(payload.zet)), 'each delivered reply is legal on the real UI board')
      Schaak.voerZetUit(board, payload.zet, payload.promotieStuk)
    }
  } })
  // These tests cover move/evaluation correctness; fake-clock timing has its own
  // suite. Disable human padding so promise-only tests remain deterministic.
  bot.ontvang('bot-instellingen', {thinkingMs:0})
  return {
    bot, events, cloudCalls, engineCalls, clouds,
    get board() { return board }, get engineDisposals() { return engineDisposals },
    moves:() => events.filter(message => message.event === 'zet'),
    evaluations:() => events.filter(message => message.event === 'ultra-evaluatie'),
    white(uci) {
      const move = uciNaarZet(Schaak, board, uci)
      assert.ok(move, 'test white move is legal: ' + uci)
      assert.equal(board.aanZet, 'w')
      // The UI applies its move once before sending it through the solo channel.
      Schaak.voerZetUit(board, move.zet, move.promotieStuk)
      bot.ontvang('zet', move)
      return move
    },
    reset() { bot.ontvang('opnieuw'); board=structuredClone(initial || Schaak.nieuweSpelStaat()) },
    close() { closed=true }, stop:() => bot.stop()
  }
}

const originalRandom = Math.random, originalFetch = globalThis.fetch
Math.random = () => { throw Error('Ultra must never choose a random fallback') }
globalThis.fetch = () => { throw Error('Orchestration tests must never access the network') }
try {
  {
    const h = harness({ engine:({options}, index) => {
      options.onInfo({cp:index === 0 ? 5 : 22, mate:null, depth:8})
      return { ...result('g1f3', 'stockfish'), cp:index === 0 ? 10 : 25 }
    } })
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true}); await tick()
    h.white('e2e4'); await tick()
    const finals = h.evaluations().filter(message => message.payload.final)
    assert.deepEqual(finals.map(message => message.payload.ply), [0,1,2], 'baseline, human move and bot move each have one final evaluation')
    assert(h.evaluations().filter(message => !message.payload.final).every(message => [0,2].includes(message.payload.ply)), 'streaming depth updates stay provisional for their own position')
    const finalBeforeReply = h.events.findIndex(message => message.event === 'ultra-evaluatie' && message.payload.final && message.payload.ply === 1)
    const reply = h.events.findIndex(message => message.event === 'zet')
    assert(finalBeforeReply >= 0 && finalBeforeReply < reply, 'the human move is committed before the bot advances to the next position')
    h.stop()
  }
  {
    const waits = [deferred(), deferred()]
    const h = harness({ engine:({options}, index) => {
      options.onInfo({cp:12, mate:null, depth:4})
      return waits[index].promise
    } })
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true}); await tick()
    assert.equal(h.evaluations().at(-1).payload.final, false)
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:false})
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true}); await tick()
    assert.equal(h.engineCalls.length, 2, 'a canceled provisional score cannot masquerade as a completed cached analysis')
    waits[0].resolve(result('g1f3', 'stockfish')); await tick()
    assert.equal(h.evaluations().filter(message => message.payload.final).length, 0)
    waits[1].resolve(result('g1f3', 'stockfish')); await tick()
    assert.equal(h.evaluations().filter(message => message.payload.final).length, 1)
    h.stop()
  }
  {
    const h = harness()
    const white = h.white('e2e4')
    h.bot.ontvang('zet', white)
    await tick()
    assert.equal(h.moves().length, 1, 'a repeated white event cannot duplicate the bot reply')
    assert.equal(h.cloudCalls.length, 1)
    assert.equal(h.engineCalls.length, 0, 'a legal Lichess hit avoids a local search')
    assert.equal(h.evaluations().length, 0, 'evaluation defaults OFF')
    assert.equal(h.board.bord[4][4], 'wP')
    assert.equal(h.board.bord[3][4], 'zP')
    assert.equal(h.board.aanZet, 'w')
    assert.ok(h.events.some(message => message.event === 'ultra-status' && message.payload.phase === 'ready' && message.payload.source === 'lichess'))
    h.stop()
  }
  for (const cloudResult of [null, result('a1a8'), result('e7e5q')]) {
    const h = harness({cloud:() => cloudResult})
    h.white('e2e4'); await tick()
    assert.equal(h.moves().length, 1)
    assert.equal(h.engineCalls.length, 1, 'a missing/404 or illegal cloud result uses Stockfish')
    assert.equal(h.engineCalls[0].options.movetime, 1800)
    assert.equal(h.cloudCalls.length, 1)
    assert.equal(h.evaluations().length, 0)
    assert.ok(h.events.some(message => message.event === 'ultra-status' && message.payload.phase === 'ready' && message.payload.source === 'stockfish'))
    h.stop()
  }
  for (const [uci, rookColumn, kingColumn, rookTarget, type] of [
    ['e8h8', 7, 6, 5, 'rokade-kort'], ['e8a8', 0, 2, 3, 'rokade-lang']
  ]) {
    const initial = emptyState()
    initial.bord[0][rookColumn] = 'zR'; initial.rokade[rookColumn === 7 ? 'zK' : 'zQ'] = true
    const h = harness({initial, cloud:() => result(uci)})
    h.white('h1g1'); await tick()
    assert.equal(h.engineCalls.length, 0, 'Lichess UCI_Chess960 king-to-rook castling is normalized before legality checks')
    assert.equal(h.moves()[0].payload.zet.type, type)
    assert.equal(h.board.bord[0][kingColumn], 'zK')
    assert.equal(h.board.bord[0][rookTarget], 'zR')
    assert.equal(h.board.bord[0][rookColumn], null)
    h.stop()
  }
  {
    const replies = ['d7d5', 'd8d5']
    const h = harness({cloud:(_request, index) => result(replies[index])})
    h.white('e2e4'); await tick()
    const capture = h.white('e4d5'); assert.equal(capture.zet.type, 'slag')
    await tick()
    assert.equal(h.moves().length, 2)
    assert.equal(h.moves()[1].payload.zet.type, 'slag')
    assert.equal(h.board.bord[3][3], 'zQ', 'the black queen captures the advanced white pawn')
    assert.equal(h.board.bord[0][3], null)
    h.stop()
  }
  for (const promotion of ['q','r','b','n']) {
    const initial = emptyState(); initial.bord[6][0]='zP'
    const h = harness({initial, cloud:() => result('a2a1' + promotion)})
    h.white('h1g1'); await tick()
    assert.equal(h.moves()[0].payload.promotieStuk, promotion.toUpperCase())
    assert.equal(h.board.bord[7][0], 'z' + promotion.toUpperCase())
    h.stop()
  }
  {
    const initial = emptyState(); initial.bord[6][1]='zP'; initial.bord[7][0]='wR'
    const h = harness({initial, cloud:() => result('b2a1n')})
    h.white('h1g1'); await tick()
    assert.equal(h.moves()[0].payload.zet.type, 'slag')
    assert.equal(h.board.bord[7][0], 'zN', 'a capturing underpromotion keeps both the capture and the chosen piece')
    h.stop()
  }
  {
    const initial = emptyState(); initial.bord[4][3]='zP'; initial.bord[6][4]='wP'
    const h = harness({initial, cloud:() => result('d4e3')})
    h.white('e2e4'); await tick()
    assert.equal(h.moves()[0].payload.zet.type, 'enpassant')
    assert.equal(h.board.bord[4][4], null)
    assert.equal(h.board.bord[5][4], 'zP')
    h.stop()
  }
  for (const action of ['reset','stop','close']) {
    const wait = deferred()
    const h = harness({cloud:() => wait.promise})
    h.white('e2e4'); await tick()
    const oldSignal = h.cloudCalls[0].options.signal, before=h.events.length
    h[action]()
    if (action !== 'close') assert.equal(oldSignal.aborted, true)
    wait.resolve(result()); await tick()
    assert.equal(h.moves().length, 0, 'late cloud work cannot move after ' + action)
    assert.equal(h.engineCalls.length, 0)
    if (action !== 'reset') assert.equal(h.events.length, before, 'a closed/stopped channel receives no more messages')
    if (action === 'reset') {
      assert.equal(h.clouds.length, 2, 'a restart receives a fresh cloud request budget')
      assert.equal(h.clouds[0].disposed, 1)
      assert.equal(schaakFen(h.board), schaakFen(Schaak.nieuweSpelStaat()))
    }
    h.stop(); h.stop()
    assert.equal(h.engineDisposals, 1, 'stop is idempotent')
  }
  {
    const wait = deferred()
    const h = harness({cloud:() => null, engine:() => wait.promise})
    h.white('e2e4'); await tick()
    const old = h.engineCalls[0]
    h.reset()
    old.options.onInfo({cp:900,mate:null,depth:30})
    wait.resolve(result()); await tick()
    assert.equal(old.options.signal.aborted, true)
    assert.equal(h.moves().length, 0, 'late local-engine results are also suppressed after reset')
    assert.equal(h.evaluations().length, 0)
    h.stop()
  }
  {
    const waits = [deferred(), deferred(), deferred()]
    const h = harness({cloud:(_request, index) => waits[index].promise})
    for (let index=0; index<3; index++) {
      h.white('e2e4'); await tick()
      if (index < 2) h.reset()
    }
    assert.equal(new Set(h.cloudCalls.map(call => call.fen)).size, 1, 'all three generations intentionally search the identical FEN')
    assert.equal(h.cloudCalls[0].options.signal.aborted, true)
    assert.equal(h.cloudCalls[1].options.signal.aborted, true)
    assert.equal(h.cloudCalls[2].options.signal.aborted, false)
    waits[0].resolve(result()); waits[1].resolve(result()); await tick()
    assert.equal(h.moves().length, 0, 'an identical FEN cannot revive a canceled generation')
    waits[2].resolve(result()); await tick()
    assert.equal(h.moves().length, 1)
    h.stop()
  }
  {
    const h = harness({cloud:() => null, engine:({options}) => {
      options.onInfo({cp:17,mate:null,depth:20})
      return result('e7e5','stockfish')
    }})
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:'true'}); await tick()
    assert.equal(h.engineCalls.length, 0, 'non-boolean settings do not opt in')
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true}); await tick()
    assert.equal(h.engineCalls.length, 1)
    assert.equal(h.engineCalls[0].options.movetime, 650)
    assert.equal(h.cloudCalls.length, 0, 'the human-turn meter never spends a public cloud request')
    assert.ok(h.evaluations().length >= 1)
    assert.ok(h.evaluations().every(message => message.payload.fen === schaakFen(h.board)))
    const searches = h.engineCalls.length
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:false})
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true}); await tick()
    assert.equal(h.engineCalls.length, searches, 'a cached evaluation for the same board is reusable')
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:false})
    h.white('e2e4'); await tick()
    assert.equal(h.engineCalls.length, searches+1, 'OFF leaves only the required black-move search')
    h.stop()
  }
  {
    const black = deferred(), human = deferred()
    const h = harness({cloud:() => black.promise, engine:() => human.promise})
    h.white('e2e4'); await tick()
    const moveSignal = h.cloudCalls[0].options.signal
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true})
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:false})
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true})
    assert.equal(moveSignal.aborted, false, 'meter toggles never interrupt the required black move')
    assert.equal(h.engineCalls.length, 0)
    black.resolve(result()); await tick()
    assert.equal(h.moves().length, 1)
    assert.equal(h.engineCalls.length, 1, 'ON evaluates the new human-turn position after the bot move')
    assert.equal(h.cloudCalls.length, 1)
    const analysis = h.engineCalls[0], count=h.evaluations().length
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:false})
    assert.equal(analysis.options.signal.aborted, true, 'OFF cancels optional human-turn work')
    analysis.options.onInfo({cp:300,mate:null,depth:30})
    human.resolve(result('g1f3')); await tick()
    assert.equal(h.evaluations().length, count, 'canceled optional analysis cannot repopulate the hidden meter')
    h.stop()
  }
  for (const badResult of [new Error('engine unavailable'), result('e7e6q','stockfish')]) {
    const h = harness({cloud:() => null, engine:(_request, index) => {
      if (index > 0) return result('e7e5','stockfish')
      if (badResult instanceof Error) throw badResult
      return badResult
    }})
    h.white('e2e4'); await tick()
    assert.equal(h.moves().length, 0)
    assert.equal(h.board.aanZet, 'z')
    assert.ok(h.events.some(message => message.event === 'ultra-status' && message.payload.phase === 'error'))
    h.bot.ontvang('ultra-opnieuw-proberen'); await tick()
    assert.equal(h.moves().length, 1, 'retry recovers without a weaker or random replacement bot')
    assert.equal(h.engineCalls[0].fen, h.engineCalls[1].fen, 'retry searches the same unchanged black-turn position')
    assert.equal(h.cloudCalls[0].fen, h.cloudCalls[1].fen)
    h.stop()
  }
  {
    const replies = ['e7e5', 'd8h4']
    const h = harness({cloud:(_request, index) => result(replies[index])})
    h.white('f2f3'); await tick()
    h.white('g2g4'); await tick()
    assert.equal(Schaak.isSchaakmat(h.board, 'w'), true)
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true}); await tick()
    const evaluation = h.evaluations().at(-1).payload
    assert.equal(evaluation.cp, null)
    assert.equal(Object.is(evaluation.mate, -0), true, 'a mated White is represented as White losing, including distance zero')
    assert.equal(h.engineCalls.length, 0, 'a terminal position needs no engine search')
    assert.equal(h.cloudCalls.length, 2)
    h.stop()
  }
  {
    const replies = ['e7e5', 'b8c6', 'g8f6']
    const h = harness({cloud:(_request, index) => result(replies[index])})
    for (const white of ['e2e4','d1h5','f1c4','h5f7']) { h.white(white); await tick() }
    assert.equal(Schaak.isSchaakmat(h.board, 'z'), true)
    assert.equal(h.moves().length, 3, 'checkmated Black cannot invent another reply')
    h.bot.ontvang('ultra-evaluatie-instelling', {enabled:true}); await tick()
    const evaluation = h.evaluations().at(-1).payload
    assert.equal(evaluation.cp, null)
    assert.equal(Object.is(evaluation.mate, 0), true, 'a mated Black is White winning, including distance zero')
    assert.equal(Object.is(evaluation.mate, -0), false)
    assert.equal(h.engineCalls.length, 0)
    assert.equal(h.cloudCalls.length, 3)
    h.stop()
  }
  {
    assert.deepEqual(NIVEAUS, ['makkelijk','normaal','moeilijk'], 'other games keep their three ordinary levels')
    for (const [name, game] of Object.entries(SOLO_SPELLEN)) assert.equal(game.niveaus?.includes('ultra') || false, name === 'schaken')
    const state = Schaak.nieuweSpelStaat(), events=[], localSearches=[]
    const channel = maakSoloKanaal(options => schaakUltraBot({ ...options,
      engineFactory:() => ({analyse:async (...args) => { localSearches.push(args); return result() }, dispose() {}}),
      cloudFactory:() => ({zoek:async () => result(), dispose() {}})
    }), 'ultra', Schaak)
    assert.equal(channel.isSolo, true); assert.equal(channel.niveau, 'ultra')
    await channel.send({type:'broadcast',event:'bot-instellingen',payload:{thinkingMs:0}})
    channel.on('broadcast', {event:'zet'}, message => {
      events.push(message)
      assert.equal(state.aanZet, 'z')
      Schaak.voerZetUit(state, message.payload.zet, message.payload.promotieStuk)
    })
    const white=uciNaarZet(Schaak, state, 'e2e4')
    Schaak.voerZetUit(state, white.zet)
    await channel.send({type:'broadcast',event:'zet',payload:white})
    assert.equal(events.length, 0, 'sending the local move never broadcasts it back to the UI')
    await new Promise(resolve => setTimeout(resolve, 0)); await tick()
    assert.equal(events.length, 1, 'the solo adapter delivers exactly one legal black reply')
    assert.equal(state.aanZet, 'w')
    assert.equal(state.bord[4][4], 'wP'); assert.equal(state.bord[3][4], 'zP')
    assert.equal(localSearches.length, 0)
    channel.sluit()
  }
} finally {
  Math.random = originalRandom
  globalThis.fetch = originalFetch
}
console.log('PASS: real-legality Ultra orchestration, cloud/Stockfish fallback, castling/captures/promotions, opt-in analysis, cancellation, same-position retry and non-echo solo channel.')
