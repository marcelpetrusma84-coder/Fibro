// Local round identity survives continue/reload. Never sent over the game channel.
// A finished round is immutable; an account change must not transfer the result.
export function maakScorePartij({ service, storage, uuid = () => crypto.randomUUID(), now = () => Date.now() }) {
  let current = null
  function begin(key, nieuw) {
    const storageKey = 'fibro_kj_scorepartij_' + key
    let old
    if (!nieuw) { try { old = JSON.parse(storage.getItem(storageKey)) } catch {} }
    const valid = /^[0-9a-f-]{36}$/i.test(old?.id || '') && Object.hasOwn(old, 'ownerId')
    const round = current = { id: valid ? old.id : uuid(), done: false }
    round.owner = valid ? Promise.resolve(old.ownerId) : service.captureOwner()
    round.owner.then(ownerId => {
      if (current === round) { try { storage.setItem(storageKey, JSON.stringify({ id: round.id, ownerId })) } catch {} }
    }).catch(() => {})
  }
  function finish(state, mode) {
    const round = current
    if (!round || round.done || !state) return Promise.resolve(null)
    round.done = true
    const run = { id: round.id, score: state.verslagen, playedAt: now(),
      level: { schildknaap: 1, ridder: 2, koning: 3 }[state.niveau], mode,
      won: state.verslagen === 12 }
    return round.owner.then(ownerId => service.saveRun({ ...run, ownerId }))
      .catch(error => { round.done = false; throw error })
  }
  return { begin, finish }
}
