// Local-only chess opponent for the explicit FIBRO TEST flow.
// It intentionally has no Supabase, WebRTC, or message persistence dependency.
export function isFibroTestCommand(value) {
  return value === 'FIBRO TEST'
}

export function maakSchaakTestKanaal(Schaak, { responseDelayMs = 850, onStatus = () => {} } = {}) {
  if (!Schaak?.nieuweSpelStaat || !Schaak?.alleLegaleZetten || !Schaak?.voerZetUit) {
    throw new TypeError('The chess engine is required for the local test channel.')
  }
  const handlers = new Map()
  const timers = new Set()
  let state = Schaak.nieuweSpelStaat()
  let stopped = false

  function subscribeEvent(event, callback) {
    const listeners = handlers.get(event) || new Set()
    listeners.add(callback)
    handlers.set(event, listeners)
  }

  function dispatch(event, payload = {}) {
    if (stopped) return
    for (const callback of handlers.get(event) || []) {
      try { callback({ payload }) } catch (error) { console.warn('[fibro-test] local event failed:', error) }
    }
  }

  function sameMove(left, right) {
    return left && right && left.van?.[0] === right.van?.[0] && left.van?.[1] === right.van?.[1] &&
      left.naar?.[0] === right.naar?.[0] && left.naar?.[1] === right.naar?.[1] && left.type === right.type
  }

  function replyTo(move, promotion) {
    if (stopped || state.aanZet !== 'w') return
    const legalWhite = Schaak.alleLegaleZetten(state, 'w').find(candidate => sameMove(candidate, move))
    if (!legalWhite) return
    Schaak.voerZetUit(state, legalWhite, ['Q', 'R', 'B', 'N'].includes(promotion) ? promotion : 'Q')
    if (state.aanZet !== 'z') return
    const choices = Schaak.alleLegaleZetten(state, 'z')
    if (!choices.length) {
      onStatus('The test opponent has no legal reply. Restart the local test game to continue.')
      return
    }
    onStatus('Test opponent is choosing a move…')
    const delay = typeof responseDelayMs === 'function' ? responseDelayMs() : responseDelayMs
    onStatus(`Test opponent is thinking${delay > 0 ? ` · ${Math.ceil(delay / 1000)}s` : ''}…`)
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (stopped || state.aanZet !== 'z') return
      const currentChoices = Schaak.alleLegaleZetten(state, 'z')
      if (!currentChoices.length) return
      // Randomize among legal replies so repeated test runs feel less scripted.
      const reply = currentChoices[Math.floor(Math.random() * currentChoices.length)]
      Schaak.voerZetUit(state, reply, 'Q')
      onStatus('Local test opponent moved. No other player is connected.')
      dispatch('zet', { zet: reply, promotieStuk: 'Q', testOnly: true })
    }, Math.max(0, Number(delay) || 0))
    timers.add(timer)
  }

  return {
    isSolo: false,
    isTest: true,
    on(type, filter, callback) {
      if (type === 'broadcast' && filter?.event && typeof callback === 'function') subscribeEvent(filter.event, callback)
      return this
    },
    send(message = {}) {
      if (stopped || message.type !== 'broadcast') return Promise.resolve('closed')
      const { event, payload = {} } = message
      if (event === 'zet') replyTo(payload.zet, payload.promotieStuk)
      else if (event === 'opnieuw') {
        timers.forEach(clearTimeout)
        timers.clear()
        state = Schaak.nieuweSpelStaat()
        onStatus('Local test game restarted.')
        dispatch('opnieuw', {})
      }
      return Promise.resolve('ok')
    },
    subscribe() { return this },
    stop() {
      if (stopped) return
      stopped = true
      timers.forEach(clearTimeout)
      timers.clear()
      handlers.clear()
    }
  }
}
