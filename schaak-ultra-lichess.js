// A few optional hits from Lichess's existing evaluation cache, alongside the local engine.
// API/schema: https://lichess.org/api#tag/Analysis/operation/apiCloudEval
const ENDPOINT = 'https://lichess.org/api/cloud-eval'
const MAX_ATTEMPTS = 8
const REQUEST_INTERVAL = 2500
const REQUEST_TIMEOUT = 1500
const MAX_BODY_BYTES = 16384
const MAX_CACHE = 16

function fenParts(fen) {
  if (typeof fen !== 'string' || fen.length > 256 || /[\r\n]/.test(fen)) return null
  const fields = fen.trim().split(/\s+/)
  if (![4, 6].includes(fields.length)) return null
  const rows = fields[0].split('/')
  if (rows.length !== 8 || rows.some(row => !/^[prnbqkPRNBQK1-8]+$/.test(row) || [...row].reduce((count, square) => count + (/\d/.test(square) ? Number(square) : 1), 0) !== 8)) return null
  if (!/^[wb]$/.test(fields[1]) || !/^(?:-|K?Q?k?q?)$/.test(fields[2]) || !/^(?:-|[a-h][36])$/.test(fields[3])) return null
  if (fields.length === 6 && (!/^\d+$/.test(fields[4]) || !/^[1-9]\d*$/.test(fields[5]))) return null
  return { key: fields.slice(0, 4).join(' '), fen: fields.join(' ') }
}

function evaluation(data, key) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || fenParts(data.fen)?.key !== key) return null
  if (!Number.isSafeInteger(data.depth) || data.depth < 18 || !Array.isArray(data.pvs) || !data.pvs.length || data.pvs.length > 5) return null
  const pv = data.pvs[0]
  if (!pv || typeof pv !== 'object' || Array.isArray(pv) || typeof pv.moves !== 'string' || pv.moves.length > 4096) return null
  const bestmove = pv.moves.trim().split(/\s+/, 1)[0]
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestmove)) return null
  const hasCp = Object.prototype.hasOwnProperty.call(pv, 'cp')
  const hasMate = Object.prototype.hasOwnProperty.call(pv, 'mate')
  if (hasCp === hasMate || !Number.isSafeInteger(hasCp ? pv.cp : pv.mate)) return null
  // Lichess cp and mate are already from White's point of view.
  return { bestmove, cp: hasCp ? pv.cp : null, mate: hasMate ? pv.mate : null, depth: data.depth, source: 'lichess' }
}

function ignoreCancellation(reader) {
  try { Promise.resolve(reader?.cancel()).catch(() => {}) } catch (_) { /* already closed */ }
}

async function boundedJson(response, request, isCurrent) {
  const length = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null
  const contentType = response.headers?.get?.('content-type')
  if (contentType && !/^application\/json(?:\s*;|$)/i.test(contentType)) return null
  let text = ''
  if (response.body?.getReader) {
    const reader = response.body.getReader()
    request.reader = reader
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let size = 0
    try {
      while (isCurrent()) {
        const part = await reader.read()
        if (!isCurrent()) return null
        if (part.done) {
          text += decoder.decode()
          break
        }
        if (!(part.value instanceof Uint8Array)) return null
        size += part.value.byteLength
        if (size > MAX_BODY_BYTES) return null
        text += decoder.decode(part.value, { stream: true })
      }
    } finally {
      ignoreCancellation(reader)
      try { reader.releaseLock() } catch (_) { /* an aborted read can still be pending */ }
      if (request.reader === reader) request.reader = null
    }
  } else return null
  if (!isCurrent()) return null
  return JSON.parse(text)
}

function retryDelay(response, timestamp) {
  const value = response.headers?.get?.('retry-after')
  if (!value) return 60000
  const delay = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - timestamp
  return Number.isFinite(delay) ? Math.max(60000, delay) : 60000
}

export function maakLichessAnalyse({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map()
  let attempts = 0, misses = 0, lastAttempt = -Infinity, blockedUntil = -Infinity
  let closed = false, active = null

  async function zoek(fen, { signal } = {}) {
    if (closed || signal?.aborted) return null
    const position = fenParts(fen)
    if (!position) return null
    if (cache.has(position.key)) {
      const value = cache.get(position.key)
      cache.delete(position.key)
      cache.set(position.key, value)
      return { ...value }
    }
    const timestamp = now()
    if (active || typeof fetchImpl !== 'function' || !Number.isFinite(timestamp) || attempts >= MAX_ATTEMPTS || misses >= 2 || timestamp < blockedUntil || timestamp - lastAttempt < REQUEST_INTERVAL) return null
    attempts++
    lastAttempt = timestamp
    const controller = new AbortController()
    const request = { controller, reader: null, cancel: null }
    active = request
    const isCurrent = () => active === request && !closed && !controller.signal.aborted && !signal?.aborted
    const cancelled = new Promise(resolve => {
      request.cancel = () => {
        controller.abort()
        ignoreCancellation(request.reader)
        resolve(null)
      }
    })
    const abort = () => request.cancel()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(abort, REQUEST_TIMEOUT)
    const work = async () => {
      try {
        if (!isCurrent()) return null
        const url = new URL(ENDPOINT)
        url.search = new URLSearchParams({ fen: position.fen, multiPv: '1', variant: 'standard' }).toString()
        const response = await fetchImpl(url.toString(), {
          method: 'GET', mode: 'cors', credentials: 'omit', referrer: '', referrerPolicy: 'no-referrer',
          redirect: 'error', headers: { Accept: 'application/json' }, signal: controller.signal,
        })
        if (!isCurrent()) return null
        if (response.status === 404) { misses++; return null }
        misses = 0
        if (response.status === 429) {
          const receivedAt = now()
          const current = Number.isFinite(receivedAt) ? receivedAt : timestamp
          blockedUntil = current + retryDelay(response, current)
          return null
        }
        if (response.status !== 200) return null
        const data = await boundedJson(response, request, isCurrent)
        if (!isCurrent()) return null
        const result = evaluation(data, position.key)
        if (!result) return null
        cache.set(position.key, { ...result })
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value)
        return result
      } catch (_) {
        if (isCurrent()) misses = 0
        return null
      }
    }
    try { return await Promise.race([work(), cancelled]) }
    finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      controller.abort()
      ignoreCancellation(request.reader)
      if (active === request) active = null
    }
  }

  function dispose() {
    closed = true
    active?.cancel()
    cache.clear()
  }

  return { zoek, dispose }
}
