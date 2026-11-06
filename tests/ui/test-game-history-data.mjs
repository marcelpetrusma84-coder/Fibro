import assert from 'node:assert/strict'
import { SPEL_HISTORIE, SPEL_VERSIES, spelHistorie, vergelijkVersies, versieLabel } from '../../spelversie-data.js'

const expectedGames = ['botkaaseiren','vieroprij','schaken','dammen','pong','pacman','pinball','flappybird','breakout','swarm','endlessrunner','shmup']
assert.deepEqual(Object.keys(SPEL_HISTORIE), expectedGames)
assert.deepEqual(Object.keys(SPEL_VERSIES), expectedGames)
assert.ok(Object.isFrozen(SPEL_HISTORIE)); assert.ok(Object.isFrozen(SPEL_VERSIES))

let pending = 0, records = 0
for (const game of expectedGames) {
  const entries = spelHistorie(game)
  assert.ok(Object.isFrozen(entries)); assert.ok(entries.length > 0)
  assert.equal(SPEL_VERSIES[game], entries[0].version, 'one canonical history supplies the current version')
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    records++
    assert.ok(Object.isFrozen(entry))
    assert.match(entry.version, /^\d+\.\d+\.\d+$/)
    assert.equal(typeof entry.firstRecorded, 'boolean')
    assert.ok(entry.summary.length > 0); assert.ok(entry.summaryEn.length > 0)
    if (entry.updatedAt === null || entry.sourceCommit === null) {
      pending++
      assert.equal(game, 'schaken'); assert.equal(i, 0); assert.equal(entry.version, '6.1.0')
      assert.equal(entry.updatedAt, null); assert.equal(entry.sourceCommit, null)
      assert.equal(entry.firstRecorded, false, 'only the upcoming implementation record can temporarily lack provenance')
    } else {
      assert.match(entry.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/)
      assert.ok(Number.isFinite(Date.parse(entry.updatedAt)))
      assert.match(entry.sourceCommit, /^[0-9a-f]{40}$/)
    }
    if (i > 0) {
      assert.equal(vergelijkVersies(entries[i - 1].version, entry.version), 1, 'history is newest first with no duplicates or branch regressions')
      if (entry.updatedAt && entries[i - 1].updatedAt) assert.ok(Date.parse(entries[i - 1].updatedAt) >= Date.parse(entry.updatedAt), 'known timestamps follow version chronology')
    }
    assert.equal(entry.firstRecorded, i === entries.length - 1, 'only the oldest recorded entry is a baseline')
  }
  assert.throws(() => entries.push(entries[0]), TypeError)
  assert.throws(() => { entries[0].summary = 'changed' }, TypeError)
}
assert.equal(records, 29, '26 verified existing records plus Chess 6.2 knight routes, Chess 6.3 Ultra hints and a mobile pinch patch')
assert.equal(pending, 0, 'every shipped version has a real commit and timestamp')
assert.equal(SPEL_VERSIES.schaken, '6.3.1')
assert.equal(SPEL_VERSIES.shmup, '5.0.0')

// The old branch briefly carried Chess 4 again while integrating Neon. It is
// not a release and must never replace the real main sequence or timestamps.
assert.deepEqual(spelHistorie('schaken').map(entry => entry.version), ['6.3.1','6.3.0','6.2.0','6.1.1','6.1.0','6.0.0','5.0.0','4.0.0','3.0.0','2.0.0'])
const chess = new Map(spelHistorie('schaken').map(entry => [entry.version,entry]))
assert.equal(chess.get('6.3.1').sourceCommit, '7d9626a9373d52e1fc317ba84887a146be96de3a')
assert.equal(chess.get('6.3.1').updatedAt, '2026-11-06T18:15:14+01:00')
assert.equal(chess.get('6.3.0').sourceCommit, 'a3e222e24ac0e895681644bccd7ec8c6411b54bb')
assert.equal(chess.get('6.3.0').updatedAt, '2026-11-06T17:53:27+01:00')
assert.equal(chess.get('6.2.0').sourceCommit, '76fc7dc4d1226068b12b9fe3a331e3817a01a043')
assert.equal(chess.get('6.2.0').updatedAt, '2026-11-06T17:20:18+01:00')
assert.equal(chess.get('6.0.0').sourceCommit, '6289a3fde4d7ad93e7c97f4924dc017fbe12fc3a')
assert.equal(chess.get('6.0.0').updatedAt, '2026-11-02T13:16:03+01:00')
assert.equal(chess.get('3.0.0').sourceCommit, '8fa72a338aca029249863eb46cc0e09f95222071')
assert.equal(chess.get('3.0.0').updatedAt, '2026-10-22T18:28:32+02:00')
for (const game of expectedGames) {
  const baseline = spelHistorie(game).at(-1)
  assert.equal(baseline.updatedAt, '2026-10-21T21:08:23+02:00')
  assert.equal(baseline.sourceCommit, 'fbe8d756386a42fb8c6dbaa3436f7bf2534fc033')
}

// Compare integer segments, not decimals or string order. A future tenth
// minor release remains greater than the ninth and never collapses to 6.1.
for (const [a,b,expected] of [['6.10.0','6.9.0',1],['6.1.10','6.1.2',1],['10.0.0','9.99.99',1],['6.1','6.1.0',0],['6.1.0','6.1.1',-1],['0.0','0.0.0',0]]) {
  assert.equal(vergelijkVersies(a,b), expected)
  assert.equal(vergelijkVersies(b,a), -expected || 0)
}
for (const value of ['6','06.1','6.01','6.1.00','6.1-beta','-1.0','6.1.0.0','6.1.9007199254740992',null,undefined,6.1]) {
  assert.throws(() => vergelijkVersies(value,'6.1.0'), TypeError)
  assert.equal(versieLabel(value), '', 'invalid input never gets an invented public version')
}
assert.equal(versieLabel('6.1.0'), 'v6.1')
assert.equal(versieLabel('6.1'), 'v6.1')
assert.equal(versieLabel('6.1.2'), 'v6.1.2')
assert.equal(versieLabel('6.10.0'), 'v6.10')
for (const game of ['unknown','__proto__','constructor','toString',null,undefined]) {
  assert.deepEqual(spelHistorie(game), [])
  assert.ok(Object.isFrozen(spelHistorie(game)))
}
console.log('PASS: canonical immutable game history, verified date provenance, exact version chronology, multi-digit semantic versions and unknown games.')
