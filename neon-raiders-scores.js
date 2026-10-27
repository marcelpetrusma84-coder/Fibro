// Neon Raiders: persoonlijke scores eerst op dit toestel; delen via afgeschermde RPC's.
// Weergavenamen blijven lokaal/P2P, net zoals op de vriendenpagina.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_SCORE = 2147483647
const PREFIX = 'fibro_nr_scores_v1_'
const MAX_PENDING = 100

function cleanScore(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_SCORE
}
function timestamp(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}
function compare(a, b) {
  return b.score - a.score || a.playedAt.localeCompare(b.playedAt) || a.id.localeCompare(b.id)
}
function unique(runs, limit = 10) {
  const seen = new Set()
  return runs.filter(run => run && typeof run.id === 'string' && cleanScore(run.score) && timestamp(run.playedAt))
    .map(run => ({ ...run, playedAt: timestamp(run.playedAt) }))
    .sort(compare).filter(run => !seen.has(run.id) && seen.add(run.id)).slice(0, limit)
}
function setupError(error) {
  return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error?.code)
}
function clippedName(value) { return typeof value === 'string' ? value.trim().slice(0, 80) : '' }

export function maakNeonScoreService({ supabase, storage, now = () => Date.now(),
  uuid = () => globalThis.crypto.randomUUID(), isOnline = () => globalThis.navigator?.onLine !== false } = {}) {
  if (storage === undefined) { try { storage = globalThis.localStorage } catch {} }
  const memory = new Map()
  let queue = Promise.resolve()
  // Een instantie schrijft na elkaar: ook bij snel herstarten/scorelijst openen geen verloren updates.
  function serial(task) {
    const result = queue.then(task, task)
    queue = result.catch(() => {})
    return result
  }
  async function account() {
    try {
      const { data } = await supabase.auth.getSession()
      const id = data?.session?.user?.id
      return UUID.test(id || '') ? id : null
    } catch { return null }
  }
  function read(uid) {
    const key = PREFIX + (uid || 'local')
    const cached = memory.get(key)
    let persisted
    try { persisted = JSON.parse(storage?.getItem(key) || 'null') } catch {}
    const list = (data, field) => Array.isArray(data?.[field]) ? data[field] : []
    return { personal: unique([...list(persisted, 'personal'), ...list(cached, 'personal')]),
      pending: unique([...list(persisted, 'pending'), ...list(cached, 'pending')].filter(run => UUID.test(run?.id || '')), MAX_PENDING) }
  }
  function write(uid, value) {
    const key = PREFIX + (uid || 'local')
    memory.set(key, value)
    try { if (storage) { storage.setItem(key, JSON.stringify(value)); return true } } catch {}
    return false
  }
  function readName(key) {
    try { return clippedName(storage?.getItem(key)) } catch { return '' }
  }
  function nameFor(uid, owner, username) {
    if (uid === owner) {
      try {
        const own = JSON.parse(storage?.getItem('fibro_profiel_' + uid) || 'null')
        const name = clippedName(own?.naam)
        if (name) return name
      } catch {}
    } else {
      const friend = readName('vriend_naam_' + owner + '_' + uid)
      if (friend) return friend
    }
    return clippedName(username)
  }
  function localRuns(uid, runs, username = '') {
    const name = uid ? nameFor(uid, uid, username) : ''
    return runs.map(run => ({ ...run, name, isSelf: true }))
  }
  function serverRun(row, uid) {
    if (!row || !UUID.test(row.run_id || '') || !UUID.test(row.user_id || '') ||
      !cleanScore(row.score) || !timestamp(row.played_at)) return null
    return { id: row.user_id === uid ? row.run_id : row.user_id + ':' + row.run_id,
      score: row.score, playedAt: timestamp(row.played_at),
      name: nameFor(uid, row.user_id, row.username), isSelf: row.user_id === uid }
  }
  async function flush(uid, state) {
    if (!uid) return 'local'
    if (!isOnline()) return 'offline'
    for (const run of [...state.pending]) {
      if (await account() !== uid) return 'local'
      let error
      try {
        ;({ error } = await supabase.rpc('neon_raiders_save_score', {
          p_run_id: run.id, p_score: run.score, p_played_at: run.playedAt,
          p_level: run.level || 1, p_won: !!run.won, p_mode: run.mode === 'co-op' ? 'co-op' : 'solo',
          p_expected_user: uid
        }))
      } catch (failure) { error = failure }
      if (error) return setupError(error) ? 'setup' : 'offline'
      state.pending = state.pending.filter(item => item.id !== run.id)
      write(uid, state)
    }
    return 'online'
  }

  return {
    captureOwner: account,
    saveRun(run) {
      return serial(async () => {
        if (!run || !cleanScore(run.score)) throw new TypeError('Invalid Neon Raiders score')
        const id = run.id || uuid()
        if (!UUID.test(id)) throw new TypeError('Invalid Neon Raiders run id')
        const playedAt = timestamp(run.playedAt ?? now())
        if (!playedAt) throw new TypeError('Invalid Neon Raiders date')
        const uid = await account()
        if (Object.hasOwn(run, 'ownerId') && run.ownerId !== uid) {
          return { savedLocal: false, persisted: false, inMemory: false, synced: false,
            status: uid ? 'offline' : 'local', reason: 'account-changed' }
        }
        const state = read(uid)
        const existing = [...state.personal, ...state.pending].find(item => item.id === id)
        const saved = existing || { id, score: run.score, playedAt,
          level: Math.max(1, Math.min(7, Math.floor(Number(run.level)) || 1)),
          won: !!run.won, mode: run.mode === 'co-op' ? 'co-op' : 'solo' }
        // Eén ronde heeft één UUID. Opnieuw tonen of een netwerkherhaling telt niet dubbel.
        state.personal = unique([...state.personal, saved])
        if (uid) state.pending = unique([...state.pending, saved], MAX_PENDING)
        const persisted = write(uid, state)
        const status = await flush(uid, state)
        return { savedLocal: persisted, persisted, inMemory: true, synced: status === 'online', status }
      })
    },
    loadBoards() {
      return serial(async () => {
        const uid = await account(), state = read(uid)
        let status = await flush(uid, state)
        const localResult = (owner, local, mode) => ({ personal: localRuns(owner, local.personal),
          friends: [], global: null, status: mode, durable: write(owner, local) })
        let current = await account()
        if (current !== uid) return localResult(current, read(current), current ? 'offline' : 'local')
        const result = localResult(uid, state, status)
        if (!uid || status !== 'online') return result
        let data, error
        try { ({ data, error } = await supabase.rpc('neon_raiders_boards')) } catch (failure) { error = failure }
        current = await account()
        if (current !== uid) return localResult(current, read(current), current ? 'offline' : 'local')
        if (error || !data || typeof data !== 'object') {
          result.status = setupError(error) ? 'setup' : 'offline'
          return result
        }
        const ownRows = Array.isArray(data.personal) ? data.personal.filter(row => row?.user_id === uid) : []
        const personal = ownRows.map(row => serverRun(row, uid)).filter(Boolean)
        state.personal = unique([...state.personal, ...personal.map(({ name, isSelf, ...run }) => run)])
        write(uid, state)
        const ownUsername = ownRows[0]?.username || ''
        result.personal = localRuns(uid, state.personal, ownUsername)
        result.friends = unique((Array.isArray(data.friends) ? data.friends : []).map(row => serverRun(row, uid)).filter(Boolean))
        const global = data.global
        if (global && cleanScore(global.score)) {
          // Een onbekende wereldrecordhouder krijgt uitsluitend een score, zelfs bij extra responsevelden.
          result.global = { score: global.score }
          if (UUID.test(global.user_id || '')) {
            const authorised = global.user_id === uid || (Array.isArray(data.known_players) &&
              data.known_players.some(person => person?.user_id === global.user_id))
            if (authorised) {
              result.global.name = nameFor(uid, global.user_id, global.username)
              result.global.isSelf = global.user_id === uid
              if (timestamp(global.played_at)) result.global.playedAt = timestamp(global.played_at)
            }
          }
        }
        return result
      })
    }
  }
}
