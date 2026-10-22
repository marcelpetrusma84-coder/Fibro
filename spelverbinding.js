// A game owns its listeners and move history; a temporary socket does not.
const RELIABLE = new Set(['zet', 'opnieuw'])
const ACK = '__spel_ack'
const RESUME = '__spel_resume'
const RETRY_DELAYS = [1000, 2000, 5000, 10000]

export function maakSpelVerbinding({
  client, naam, onStatus = () => {}, onActivity = () => {},
  clock = {}, events = globalThis.window, page = globalThis.document,
  isOnline = () => globalThis.navigator?.onLine !== false,
  instanceId = globalThis.crypto.randomUUID()
}) {
  const now = clock.now ?? (() => Date.now())
  const later = clock.setTimeout ?? ((fn, ms) => setTimeout(fn, ms))
  const cancel = clock.clearTimeout ?? (id => clearTimeout(id))
  const listeners = []
  const history = new Map()
  const pending = new Map()
  const received = new Set()
  const streams = new Map()
  let raw = null, generation = 0, sequence = 0
  let started = false, stopped = false, joined = false, opening = false
  let tickTimer = null, rebuildTimer = null, retryCount = 0, subscribeCallback
  let lastPing = 0, lastActivity = null, errorSince = null, status
  let peerProtocol = false

  function report(next) {
    if (next === status || stopped) return
    status = next
    onStatus(next)
  }

  function transmit(message) {
    if (stopped || !joined || !raw || !isOnline()) return Promise.resolve('error')
    try { return Promise.resolve(raw.send(message)).catch(() => 'error') }
    catch { return Promise.resolve('error') }
  }

  function control(event, payload = {}) {
    return transmit({ type: 'broadcast', event, payload: { ...payload, from: instanceId } })
  }

  function sendPing() {
    lastPing = now()
    return control('ping', { protocol: 2 })
  }

  function replay(onlyPending = false) {
    const messages = onlyPending ? pending.values() : history.values()
    for (const item of messages) {
      // Repeating a legacy move could apply it twice. Retry/replay only after
      // the other side advertises the delivery protocol; unsent moves go once.
      if (!peerProtocol && item.lastSent !== null) continue
      item.lastSent = now()
      transmit(item.message)
    }
  }

  function enableProtocol() {
    if (peerProtocol) return
    peerProtocol = true
    control(RESUME)
    replay(true)
  }

  function dispatch(message) {
    for (const listener of [...listeners]) {
      if (listener.type === message.type &&
          (listener.filter.event === '*' || listener.filter.event === message.event)) {
        listener.fn(message)
      }
    }
  }

  function acknowledge(delivery) {
    control(ACK, { id: delivery.id, to: delivery.from })
  }

  function receive(message) {
    const payload = message.payload ?? {}
    const delivery = payload._fibroDelivery
    if (payload.from === instanceId || delivery?.from === instanceId) return
    lastActivity = now()
    report('connected')
    onActivity(message)

    if (message.event === ACK) {
      if (payload.to === instanceId && typeof payload.id === 'string') pending.delete(payload.id)
      enableProtocol()
      return
    }
    if (message.event === RESUME) {
      enableProtocol()
      replay()
      return
    }
    if (message.event === 'ping') {
      if (payload.protocol === 2) enableProtocol()
      dispatch(message)
      return
    }
    if (!RELIABLE.has(message.event) || !delivery ||
        typeof delivery.id !== 'string' || typeof delivery.from !== 'string' ||
        !Number.isSafeInteger(delivery.seq) || delivery.seq < 1) {
      dispatch(message) // Older clients keep their original best-effort behavior.
      return
    }

    enableProtocol()
    if (received.has(delivery.id)) { acknowledge(delivery); return }
    let stream = streams.get(delivery.from)
    if (!stream) { stream = { next: 1, buffered: new Map() }; streams.set(delivery.from, stream) }
    if (delivery.seq < stream.next) { acknowledge(delivery); return }
    stream.buffered.set(delivery.seq, message)
    while (stream.buffered.has(stream.next)) {
      const next = stream.buffered.get(stream.next)
      const meta = next.payload._fibroDelivery
      // Game listeners enqueue their animations synchronously. Acknowledge only
      // after that enqueue, so retries cannot reorder two consecutive moves.
      dispatch(next)
      stream.buffered.delete(stream.next++)
      received.add(meta.id)
      acknowledge(meta)
    }
  }

  function scheduleRebuild() {
    if (stopped || !started || rebuildTimer !== null || opening || !isOnline()) return
    const delay = RETRY_DELAYS[Math.min(retryCount++, RETRY_DELAYS.length - 1)]
    rebuildTimer = later(() => {
      rebuildTimer = null
      open()
    }, delay)
  }

  async function open() {
    if (stopped || opening || !started) return
    if (!isOnline()) { report('offline'); return }
    opening = true
    joined = false
    const token = ++generation
    const old = raw
    raw = null
    report(lastActivity === null ? 'connecting' : 'reconnecting')
    try {
      // Supabase can return an existing closing channel for the same topic.
      // Fully dispose it before asking for a fresh channel.
      const leftovers = new Set(old ? [old] : [])
      for (const channel of client.getChannels?.() ?? []) {
        if (channel.topic === 'realtime:' + naam) leftovers.add(channel)
      }
      await Promise.all([...leftovers].map(channel => Promise.resolve(client.removeChannel(channel)).catch(() => {})))
      if (stopped || token !== generation) return
      const channel = client.channel(naam, { config: { private: true, broadcast: { self: false, ack: true } } })
      raw = channel
      channel.on('broadcast', { event: '*' }, message => {
        if (!stopped && token === generation) receive(message)
      })
      channel.subscribe(state => {
        if (stopped || token !== generation) return
        subscribeCallback?.(state)
        if (state === 'SUBSCRIBED') {
          joined = true
          errorSince = null
          retryCount = 0
          cancel(rebuildTimer); rebuildTimer = null
          report(lastActivity !== null && now() - lastActivity <= 20000 ? 'connected' : 'waiting')
          sendPing()
          control(RESUME)
          replay()
        } else {
          joined = false
          errorSince ??= now()
          report(isOnline() ? 'reconnecting' : 'offline')
        }
      })
    } catch {
      if (!stopped && token === generation) {
        errorSince ??= now()
        report(isOnline() ? 'reconnecting' : 'offline')
        scheduleRebuild()
      }
    } finally {
      if (token === generation) opening = false
    }
  }

  function tick() {
    if (stopped) return
    if (!isOnline()) report('offline')
    else {
      if (joined && now() - lastPing >= 5000) sendPing()
      if (lastActivity !== null && now() - lastActivity > 20000 && joined) report('waiting')
      if (!joined && errorSince !== null && now() - errorSince >= 20000) scheduleRebuild()
      if (joined && peerProtocol) {
        for (const item of pending.values()) {
          if (item.lastSent !== null && now() - item.lastSent < 3000) continue
          item.lastSent = now()
          transmit(item.message)
        }
      }
    }
    tickTimer = later(tick, 1000)
  }

  function reconnect() {
    if (stopped || !started) return Promise.resolve()
    if (!isOnline()) { report('offline'); return Promise.resolve() }
    if (joined && raw?.state !== 'closed' && raw?.state !== 'errored') {
      sendPing()
      return control(RESUME)
    }
    if (opening || raw?.state === 'joining') return Promise.resolve()
    cancel(rebuildTimer); rebuildTimer = null
    return open()
  }

  const visible = () => { if (!page || page.visibilityState === 'visible') reconnect() }
  const offline = () => report('offline')
  const api = {
    isSolo: false,
    on(type, filter, fn) { listeners.push({ type, filter, fn }); return api },
    send(message) {
      if (stopped) return Promise.resolve('error')
      if (!RELIABLE.has(message.event) || message.type !== 'broadcast') return transmit(message)
      const delivery = { id: globalThis.crypto.randomUUID(), seq: ++sequence, from: instanceId }
      const reliable = { ...message, payload: { ...message.payload, _fibroDelivery: delivery } }
      const item = { message: reliable, lastSent: joined && isOnline() ? now() : null }
      history.set(delivery.id, item)
      pending.set(delivery.id, item)
      return transmit(reliable)
    },
    subscribe(callback) {
      subscribeCallback = callback
      if (started || stopped) return api
      started = true
      page?.addEventListener('visibilitychange', visible)
      events?.addEventListener('online', reconnect)
      events?.addEventListener('offline', offline)
      events?.addEventListener('pageshow', visible)
      tickTimer = later(tick, 1000)
      open()
      return api
    },
    reconnect,
    stop() {
      if (stopped) return Promise.resolve()
      stopped = true
      joined = false
      generation++
      cancel(tickTimer); cancel(rebuildTimer)
      page?.removeEventListener('visibilitychange', visible)
      events?.removeEventListener('online', reconnect)
      events?.removeEventListener('offline', offline)
      events?.removeEventListener('pageshow', visible)
      listeners.length = 0
      history.clear(); pending.clear(); received.clear(); streams.clear()
      const channel = raw
      raw = null
      return channel ? Promise.resolve(client.removeChannel(channel)).catch(() => {}) : Promise.resolve()
    }
  }
  return api
}
