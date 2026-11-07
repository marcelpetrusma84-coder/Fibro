import { maakStockfishEngine, schaakFen, uciNaarZet } from './schaak-ultra-engine.js?v=1'
import { maakLichessAnalyse } from './schaak-ultra-lichess.js?v=1'

// Ultra never falls back to the small/random local bot. Lichess supplies cached
// deep analyses where available; a bundled Stockfish 19 computes every other move.
export function schaakUltraBot({ stuur, isDicht, motor:Schaak, engineFactory = maakStockfishEngine, cloudFactory = maakLichessAnalyse, timing = {} } = {}) {
  let staat = Schaak.nieuweSpelStaat()
  let ply = 0, generation = 0, stopped = false, enabled = false, active = null, lastEvaluation = null
  let history = [structuredClone(staat)]
  let takebackEnabled = false, hintsEnabled = false, pendingHint = null
  let thinkingMs = 5000, replyStartedAt = null
  const now = timing.now || (() => globalThis.performance?.now() ?? Date.now())
  const random = timing.random || Math.random
  const scheduleTimeout = timing.setTimeout || ((callback, delay) => setTimeout(callback, delay))
  const cancelTimeout = timing.clearTimeout || (timer => clearTimeout(timer))
  const engine = engineFactory()
  let cloud = cloudFactory()
  const alive = () => !stopped && !isDicht()
  const fen = () => schaakFen(staat, Math.floor(ply / 2) + 1)
  const emit = (event, payload) => { if (alive()) stuur(event, payload) }
  const status = (phase, source) => emit('ultra-status', { phase, generation, ...(source ? { source } : {}) })
  const current = run => alive() && active === run && run.generation === generation && !run.controller.signal.aborted && fen() === run.fen
  const finished = () => Schaak.alleLegaleZetten(staat, staat.aanZet).length === 0

  function cancel() {
    const previous = active
    active = null
    if (previous?.timer !== null && previous?.timer !== undefined) cancelTimeout(previous.timer)
    previous?.controller.abort()
  }
  function hintResult(ok, reason, choice, result) {
    const promotion = ok && staat.bord[choice.zet.van[0]][choice.zet.van[1]]?.[1] === 'P' && [0,7].includes(choice.zet.naar[0])
    emit('ultra-hint-result', { ok, ply, fen:fen(), generation,
      ...(ok ? {
        from:choice.zet.van.slice(), to:choice.zet.naar.slice(),
        ...(promotion ? { promotieStuk:choice.promotieStuk } : {}),
        source:['lichess','stockfish'].includes(result?.source) ? result.source : 'stockfish',
        depth:Number.isSafeInteger(result?.depth) && result.depth >= 0 ? result.depth : 0,
        cp:Number.isFinite(result?.cp) ? result.cp : null,
        mate:Number.isFinite(result?.mate) ? result.mate : null,
      } : { reason }) })
  }
  function finishHint(run, result) {
    if (!pendingHint || !hintsEnabled || staat.aanZet !== 'w' ||
        pendingHint.ply !== ply || pendingHint.generation !== generation || pendingHint.fen !== fen() ||
        (run && !current(run))) return
    pendingHint = null
    const choice = legalResult(result)
    if (choice) hintResult(true, null, choice, result)
    else hintResult(false, 'unavailable')
  }
  function requestHint(payload) {
    if (!hintsEnabled) { hintResult(false, 'disabled'); return }
    if (payload.ply !== ply || (payload.generation !== undefined && payload.generation !== generation)) { hintResult(false, 'stale'); return }
    if (staat.aanZet !== 'w') { hintResult(false, 'turn'); return }
    if (finished()) { hintResult(false, 'unavailable'); return }
    if (pendingHint) return
    pendingHint = { ply, generation, fen:fen() }
    // Human-turn evaluation and hints share one local search. A cached final
    // best move can answer without either a cloud lookup or another analysis.
    if (lastEvaluation?.final && lastEvaluation.fen === fen() && legalResult(lastEvaluation)) finishHint(null, lastEvaluation)
    else if (!active) void search(false)
  }
  function takeback(payload) {
    const fail = reason => emit('ultra-takeback-result', { ok:false, ply, fen:fen(), generation, reason })
    if (!takebackEnabled) { fail('disabled'); return }
    // A bot reply can already be committed while its board animation is still
    // pending. That immediately preceding White ply identifies the same undo.
    const replyInTransit = payload.generation === generation && payload.ply === ply - 1 && payload.ply % 2 === 1 && ply % 2 === 0
    if ((payload.ply !== ply && !replyInTransit) || (payload.generation !== undefined && payload.generation !== generation)) { fail('stale'); return }
    const target = ply - (ply % 2 ? 1 : 2)
    if (target < 0 || !history[target] || history[target].aanZet !== 'w') { fail('unavailable'); return }
    generation++
    pendingHint = null
    cancel()
    staat = structuredClone(history[target])
    ply = target
    history.length = target + 1
    lastEvaluation = null
    replyStartedAt = null
    // Keep this game's cloud cache and request budget when revisiting a line.
    // The acknowledgement must arrive before any fresh position evaluation.
    const restoredGeneration = generation
    emit('ultra-takeback-result', { ok:true, ply, fen:fen(), generation })
    if (generation !== restoredGeneration || ply !== target) return
    status('ready')
    if (enabled && !active && generation === restoredGeneration && ply === target) void search(false)
  }
  function randomTiming() {
    const value = random()
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5
  }
  function deliver(run) {
    if (!current(run) || !run.choice) return
    status('ready', run.result.source)
    if (!current(run)) return
    active = null
    Schaak.voerZetUit(staat, run.choice.zet, run.choice.promotieStuk)
    ply++
    history[ply] = structuredClone(staat)
    replyStartedAt = null
    emit('zet', { ...run.choice, ultraPly:ply, ultraGeneration:generation })
    if (enabled && !active && generation === run.generation && ply === run.ply + 1) void search(false)
  }
  function planReply(run) {
    if (!current(run) || !run.choice) return
    if (run.timer !== null) { cancelTimeout(run.timer); run.timer = null }
    if (thinkingMs > 0 && run.randomTiming === null) run.randomTiming = randomTiming()
    const minimum = Math.min(1000, thinkingMs)
    const target = thinkingMs === 0 ? 0 : minimum + (thinkingMs - minimum) * run.randomTiming
    // Cloud lookup, Stockfish and worker startup all count toward the same
    // response time. Never add the slider's duration after the analysis ends.
    const remaining = Math.max(0, run.startedAt + target - now())
    if (remaining === 0) { deliver(run); return }
    run.timer = scheduleTimeout(() => { run.timer = null; deliver(run) }, remaining)
  }
  function evaluate(run, result, final = false) {
    if (!current(run) || !result || (!Number.isFinite(result.cp) && !Number.isFinite(result.mate))) return
    lastEvaluation = { ply:run.ply, fen:run.fen, cp:result.cp ?? null, mate:result.mate ?? null, depth:result.depth || 0, source:result.source || 'stockfish', final, generation:run.generation,
      ...(final && typeof result.bestmove === 'string' ? { bestmove:result.bestmove } : {}) }
    if (enabled) emit('ultra-evaluatie', lastEvaluation)
  }
  function legalResult(result) {
    if (!result) return null
    // Lichess PVs encode castling as king-to-rook, including standard chess.
    const move = result.bestmove
    const king = typeof move === 'string' && staat.bord[move[1] === '1' ? 7 : 0]?.[4]
    const castles = { e1h1:'e1g1', e1a1:'e1c1', e8h8:'e8g8', e8a8:'e8c8' }
    return uciNaarZet(Schaak, staat, king?.[1] === 'K' && castles[move] ? castles[move] : move)
  }
  function terminalEvaluation() {
    const mate = Schaak.isSchaakmat(staat, staat.aanZet)
      ? (staat.aanZet === 'w' ? -0 : 0) : null
    lastEvaluation = { ply, fen:fen(), cp:mate === null ? 0 : null, mate, depth:0, source:'stockfish', final:true, generation }
    if (enabled) emit('ultra-evaluatie', lastEvaluation)
    status('ready', 'stockfish')
  }
  async function search(move) {
    cancel()
    if (!alive()) return
    if (finished()) { terminalEvaluation(); return }
    const run = { controller:new AbortController(), generation, fen:fen(), ply, move,
      startedAt:move ? replyStartedAt ?? now() : now(), randomTiming:move && thinkingMs > 0 ? randomTiming() : null,
      timer:null, choice:null, result:null }
    active = run
    status('searching')
    try {
      // Only bot turns query the cloud. Evaluation on the human turn is local,
      // avoiding a second public API request for every move.
      let result = move ? await cloud.zoek(run.fen, { signal:run.controller.signal }) : null
      if (!current(run)) return
      if (result && !legalResult(result)) result = null
      if (!result) {
        status('searching', 'stockfish')
        // Keep the normal strong search when padding is disabled. Otherwise
        // account for time already spent on the cloud before setting movetime.
        const remaining = move && thinkingMs > 0 ? run.startedAt + thinkingMs - now() : 1800
        result = await engine.analyse(run.fen, {
          movetime:move ? Math.max(100, Math.min(1800, Math.floor(remaining))) : 650,
          signal:run.controller.signal,
          onInfo:info => evaluate(run, { ...info, source:'stockfish' }),
        })
        result = { ...result, source:'stockfish' }
      }
      if (!current(run)) return
      const choice = move ? legalResult(result) : null
      if (move && !choice) throw new Error('Ultra gaf geen geldige zet')
      // Commit exactly one evaluation to this half-move. Streaming depth updates
      // are provisional and must not sound or become the next move's baseline.
      evaluate(run, result, true)
      if (!current(run)) return
      if (move) {
        run.choice = choice
        run.result = result
        status('searching', result.source)
        planReply(run)
      } else {
        finishHint(run, result)
        if (current(run)) { active = null; status('ready', result.source) }
      }
    } catch (error) {
      if (!current(run)) return
      active = null
      if (pendingHint && pendingHint.generation === generation && pendingHint.ply === ply && pendingHint.fen === fen()) {
        pendingHint = null
        hintResult(false, 'unavailable')
      }
      if (error?.name !== 'AbortError') status('error', 'stockfish')
    }
  }
  return {
    ontvang(event, payload = {}) {
      if (!alive()) return
      if (event === 'zet') {
        const startedAt = now()
        if (staat.aanZet !== 'w' || !payload.zet) return
        if ((payload.ultraGeneration !== undefined && payload.ultraGeneration !== generation) ||
            (payload.ultraPly !== undefined && payload.ultraPly !== ply)) return
        const move = payload.zet
        if (!Array.isArray(move.van) || !Array.isArray(move.naar)) return
        const valid = Schaak.alleLegaleZetten(staat, 'w').find(legal => legal.van[0] === move.van[0] && legal.van[1] === move.van[1] && legal.naar[0] === move.naar[0] && legal.naar[1] === move.naar[1] && legal.type === move.type)
        if (!valid) return
        pendingHint = null
        cancel()
        lastEvaluation = null
        Schaak.voerZetUit(staat, valid, ['Q','R','B','N'].includes(payload.promotieStuk) ? payload.promotieStuk : 'Q')
        ply++
        history[ply] = structuredClone(staat)
        replyStartedAt = startedAt
        void search(true)
      } else if (event === 'ultra-evaluatie-instelling') {
        enabled = payload.enabled === true
        if (!enabled) {
          if (active && !active.move && !pendingHint) { cancel(); status('ready', lastEvaluation?.source) }
        } else if (lastEvaluation?.fen === fen() && lastEvaluation.final) emit('ultra-evaluatie', lastEvaluation)
        else if (!active) void search(staat.aanZet === 'z')
      } else if (event === 'ultra-opnieuw-proberen') {
        if (!active) void search(staat.aanZet === 'z')
      } else if (event === 'ultra-assistentie-instellingen') {
        takebackEnabled = payload.takeback === true
        hintsEnabled = payload.hints === true
        if (!hintsEnabled && pendingHint) {
          pendingHint = null
          if (active && !active.move && !enabled) { cancel(); status('ready', lastEvaluation?.source) }
        }
      } else if (event === 'ultra-takeback') {
        takeback(payload)
      } else if (event === 'ultra-hint') {
        requestHint(payload)
      } else if (event === 'bot-instellingen') {
        if (Number.isFinite(payload.thinkingMs)) {
          thinkingMs = Math.max(0, Math.min(7000, Math.round(payload.thinkingMs)))
          // A completed analysis stays valid when only the timing changes.
          // Replan its pending delivery against the original human-move time.
          if (active?.move && active.choice) planReply(active)
        }
        if (!active) status('ready', lastEvaluation?.source)
      } else if (event === 'opnieuw') {
        generation++
        pendingHint = null
        cancel()
        cloud.dispose()
        cloud = cloudFactory()
        staat = Schaak.nieuweSpelStaat()
        history = [structuredClone(staat)]
        ply = 0
        replyStartedAt = null
        lastEvaluation = null
        status('ready')
        if (enabled) void search(false)
      }
    },
    stop() {
      if (stopped) return
      stopped = true
      generation++
      pendingHint = null
      cancel()
      cloud.dispose()
      engine.dispose()
    },
  }
}
