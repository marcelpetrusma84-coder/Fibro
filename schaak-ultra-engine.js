// Stockfish uses ordinary FEN/UCI; the board keeps its Dutch colour names.
export function schaakFen(staat, fullmove = 1) {
  const rows = staat.bord.map(row => {
    let result = '', empty = 0
    for (const piece of row) {
      if (!piece) { empty++; continue }
      if (empty) { result += empty; empty = 0 }
      result += piece[0] === 'w' ? piece[1].toUpperCase() : piece[1].toLowerCase()
    }
    return result + (empty || '')
  })
  const rights = [['wK', 'K'], ['wQ', 'Q'], ['zK', 'k'], ['zQ', 'q']]
    .filter(([key]) => staat.rokade?.[key]).map(([, letter]) => letter).join('') || '-'
  const enPassant = Number.isInteger(staat.enPassantKolom) && staat.enPassantKolom >= 0 && staat.enPassantKolom < 8
    ? 'abcdefgh'[staat.enPassantKolom] + (staat.aanZet === 'w' ? '6' : '3') : '-'
  const halfmove = Number.isFinite(staat.halfzetTeller) ? Math.max(0, Math.floor(staat.halfzetTeller)) : 0
  const move = Number.isFinite(fullmove) ? Math.max(1, Math.floor(fullmove)) : 1
  return `${rows.join('/')} ${staat.aanZet === 'w' ? 'w' : 'b'} ${rights} ${enPassant} ${halfmove} ${move}`
}

export function uciNaarZet(Schaak, staat, uci) {
  if (typeof uci !== 'string') return null
  const match = /^([a-h])([1-8])([a-h])([1-8])([qrbn])?$/i.exec(uci.trim())
  if (!match) return null
  const van = [8 - Number(match[2]), match[1].toLowerCase().charCodeAt(0) - 97]
  const naar = [8 - Number(match[4]), match[3].toLowerCase().charCodeAt(0) - 97]
  const piece = staat.bord[van[0]]?.[van[1]]
  if (!piece || piece[0] !== staat.aanZet) return null
  const promotion = piece[1] === 'P' && (naar[0] === 0 || naar[0] === 7)
  if (promotion !== Boolean(match[5])) return null
  const zet = Schaak.legaleZetten(staat, ...van).find(move => move.naar[0] === naar[0] && move.naar[1] === naar[1])
  return zet ? { zet, promotieStuk: match[5]?.toUpperCase() || 'Q' } : null
}

// UCI scores belong to the side to move; all callers receive White's score.
export function parseStockfishInfo(line, turn) {
  if (typeof line !== 'string' || !/^info\s/.test(line)) return null
  const tokens = line.trim().split(/\s+/)
  if (tokens.includes('string') || tokens.includes('upperbound') || tokens.includes('lowerbound')) return null
  const pv = tokens.indexOf('multipv')
  if (pv !== -1 && tokens[pv + 1] !== '1') return null
  const scoreIndex = tokens.indexOf('score')
  const type = tokens[scoreIndex + 1], raw = tokens[scoreIndex + 2]
  if (scoreIndex === -1 || !['cp', 'mate'].includes(type) || !/^-?\d+$/.test(raw || '')) return null
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) return null
  const depthIndex = tokens.indexOf('depth')
  const depth = depthIndex === -1 ? 0 : Number(tokens[depthIndex + 1])
  if (!Number.isSafeInteger(depth) || depth < 0) return null
  const sign = turn === 'w' ? 1 : -1
  // A zero-distance mate means the player to move has already been mated.
  const mate = type === 'mate' ? (value === 0 ? -0 : value) * sign : null
  return { cp: type === 'cp' ? value * sign : null, mate, depth }
}

const BOOT_TIMEOUT = 20000
const SEARCH_GRACE = 10000

function abortError() {
  const error = new Error('Stockfish-analyse geannuleerd')
  error.name = 'AbortError'
  return error
}

export function maakStockfishEngine({ onInfo: defaultOnInfo, workerFactory } = {}) {
  const makeWorker = workerFactory || (url => new Worker(url))
  let transport = null, active = null, disposed = false

  function finish(run, error, result) {
    if (active !== run) return
    active = null
    clearTimeout(run.timer)
    run.signal?.removeEventListener('abort', run.abort)
    if (error) run.reject(error)
    else run.resolve(result)
  }

  function closeTransport(connection, reason) {
    if (transport === connection) transport = null
    clearTimeout(connection.timer)
    connection.detach()
    connection.worker.terminate()
    if (!connection.settled) {
      connection.settled = true
      connection.reject(reason)
    }
  }

  function failTransport(connection, error) {
    if (transport !== connection) return
    closeTransport(connection, error)
    if (active) finish(active, error)
  }

  function notify(run, info) {
    for (const callback of new Set([defaultOnInfo, run.onInfo])) {
      if (active !== run) break
      if (typeof callback === 'function') {
        // Rendering an evaluation must never interrupt the worker protocol.
        try { callback(info) } catch (_) { /* the analysis still completes */ }
      }
    }
  }

  function ensureWorker() {
    if (transport) return transport.ready
    const worker = makeWorker(new URL('./vendor/stockfish/stockfish-19-lite-single.js', import.meta.url))
    const connection = { worker, phase: 'uci', settled: false, detach: () => {} }
    connection.ready = new Promise((resolve, reject) => { connection.resolve = resolve; connection.reject = reject })
    transport = connection

    const onMessage = event => {
      if (transport !== connection || typeof event.data !== 'string') return
      for (const raw of event.data.split(/\r?\n/)) {
        if (transport !== connection) return
        const line = raw.trim()
        if (line === 'uciok' && connection.phase === 'uci') {
          connection.phase = 'ready-check'
          try {
            for (const option of [
              'Threads value 1', 'Hash value 32', 'MultiPV value 1',
              'Skill Level value 20', 'UCI_LimitStrength value false',
            ]) worker.postMessage(`setoption name ${option}`)
            worker.postMessage('isready')
          } catch (error) { failTransport(connection, error) }
        } else if (line === 'readyok' && connection.phase === 'ready-check') {
          connection.phase = 'ready'
          connection.settled = true
          clearTimeout(connection.timer)
          connection.resolve()
        } else if (active?.searchStarted && connection.phase === 'ready') {
          const run = active
          const info = parseStockfishInfo(line, run.turn)
          if (info) { run.score = info; notify(run, info) }
          if (active !== run || transport !== connection) continue
          const best = /^bestmove\s+(\S+)/.exec(line)
          if (best) finish(run, null, { bestmove: best[1], ...run.score })
        }
      }
    }
    const onError = event => failTransport(connection, event?.error instanceof Error ? event.error : new Error(event?.message || 'Stockfish-worker kon niet worden geladen'))
    const onMessageError = () => failTransport(connection, new Error('Ongeldig bericht van Stockfish-worker'))
    if (typeof worker.addEventListener === 'function') {
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      worker.addEventListener('messageerror', onMessageError)
      connection.detach = () => {
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        worker.removeEventListener('messageerror', onMessageError)
      }
    } else {
      worker.onmessage = onMessage
      worker.onerror = onError
      worker.onmessageerror = onMessageError
      connection.detach = () => { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null }
    }
    connection.timer = setTimeout(() => failTransport(connection, new Error('Stockfish startte niet op tijd')), BOOT_TIMEOUT)
    try { worker.postMessage('uci') } catch (error) { failTransport(connection, error) }
    return connection.ready
  }

  function analyse(fen, { movetime = 1200, signal, onInfo } = {}) {
    if (disposed) return Promise.reject(new Error('Stockfish-engine is afgesloten'))
    if (signal?.aborted) return Promise.reject(abortError())
    if (active) return Promise.reject(new Error('Stockfish voert al een analyse uit'))
    if (typeof fen !== 'string' || /[\r\n]/.test(fen) || !/\s[wb]\s/.test(fen)) return Promise.reject(new Error('Ongeldige FEN voor Stockfish'))
    const duration = Number.isFinite(movetime) ? Math.max(1, Math.min(30000, Math.floor(movetime))) : 1200
    return new Promise((resolve, reject) => {
      const run = { resolve, reject, signal, onInfo, turn: fen.trim().split(/\s+/)[1], score: { cp: null, mate: null, depth: 0 }, searchStarted: false }
      active = run
      run.abort = () => {
        if (active !== run) return
        if (transport) closeTransport(transport, abortError())
        finish(run, abortError())
      }
      signal?.addEventListener('abort', run.abort, { once: true })
      let ready
      try { ready = ensureWorker() } catch (error) { finish(run, error); return }
      ready.then(() => {
        if (active !== run || signal?.aborted) return
        const connection = transport
        run.searchStarted = true
        run.timer = setTimeout(() => failTransport(connection, new Error('Stockfish antwoordde niet op tijd')), duration + SEARCH_GRACE)
        try {
          connection.worker.postMessage(`position fen ${fen}`)
          connection.worker.postMessage(`go movetime ${duration}`)
        } catch (error) { failTransport(connection, error) }
      }).catch(error => finish(run, error))
    })
  }

  function dispose() {
    disposed = true
    const error = new Error('Stockfish-engine is afgesloten')
    if (transport) closeTransport(transport, error)
    if (active) finish(active, error)
  }

  return { analyse, dispose }
}
