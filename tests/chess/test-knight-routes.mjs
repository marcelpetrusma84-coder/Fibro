import assert from 'node:assert/strict'
import * as Schaak from '../../schaak.js'
import { berekenPaardroutes } from '../../schaak-paardroutes.js'

const empty = (van = [4,3], kleur = 'w') => ({ ...Schaak.nieuweSpelStaat(), aanZet:kleur,
  bord:Array.from({ length:8 }, (_, r) => Array.from({ length:8 }, (_, k) => r === van[0] && k === van[1] ? kleur + 'N' : null)) })
const routes = (staat, van, stappen) => berekenPaardroutes({ Schaak, staat, van, ...(stappen === undefined ? {} : { stappen }) })
const at = (result, r, k) => result.find(veld => veld.r === r && veld.k === k)?.steps || []
const fields = (result, depth) => result.filter(veld => veld.steps.includes(depth)).map(({r,k}) => `${r},${k}`).sort()
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }

// The first horizon agrees with the existing engine, while the complete search
// leaves all board data, rights and auxiliary position fields untouched.
{
  const staat = Schaak.nieuweSpelStaat(), van = [7,1]
  const expected = Schaak.legaleZetten(staat, ...van).map(zet => zet.naar.join(',')).sort()
  const before = JSON.stringify(staat)
  freeze(staat)
  const result = routes(staat, van)
  assert.deepEqual(fields(result, 1), expected)
  assert.deepEqual(fields(result, 1), ['5,0','5,2'])
  assert.equal(JSON.stringify(staat), before, 'route search must not mutate the live position')
  assert.deepEqual(result, [...result].sort((a,b) => a.r - b.r || a.k - b.k), 'stable board-coordinate order')
  assert.ok(result.every(veld => veld.steps.every((depth, i, list) => depth >= 1 && depth <= 4 && (!i || depth > list[i-1]))))
}

// An independent knight-graph oracle checks exact jump counts on an otherwise
// empty board. No quadrant is removed and legal loops are not silently pruned.
{
  const van = [4,3], staat = empty(van)
  const result = routes(staat, van)
  let frontier = new Set([van.join(',')])
  for (let depth = 1; depth <= 4; depth++) {
    const next = new Set()
    for (const field of frontier) {
      const [r,k] = field.split(',').map(Number)
      for (let dr = -2; dr <= 2; dr++) for (let dk = -2; dk <= 2; dk++) {
        if (Math.abs(dr * dk) !== 2 || r + dr < 0 || r + dr > 7 || k + dk < 0 || k + dk > 7) continue
        next.add(`${r+dr},${k+dk}`)
      }
    }
    assert.deepEqual(fields(result, depth), [...next].sort(), `exact ${depth}-jump geometry across the full board`)
    frontier = next
  }
  assert.deepEqual(at(result, ...van), [2,4], 'returning to the source is a possible two/four-jump route')
  assert.deepEqual(at(result, 2,2), [1,3], 'one destination can have several enabled horizons')
  for (const [rowSide,colSide] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    assert.ok(result.some(({r,k}) => Math.sign(r - van[0]) === rowSide && Math.sign(k - van[1]) === colSide), 'every quadrant remains available')
  }
}

// Independent toggles hide result layers, not the intermediate jumps needed to
// reach a later layer. Extra toggle entries never permit more than four jumps.
{
  const van = [0,0], staat = empty(van), full = routes(staat, van)
  assert.deepEqual(fields(full, 1), ['1,2','2,1'])
  for (let selected = 1; selected <= 4; selected++) {
    const toggles = Array.from({length:4}, (_, i) => i === selected - 1)
    const result = routes(staat, van, toggles)
    assert.deepEqual(fields(result, selected), fields(full, selected))
    assert.ok(result.every(veld => veld.steps.length === 1 && veld.steps[0] === selected))
  }
  const odd = routes(staat, van, [true,false,true,false])
  assert.deepEqual(fields(odd,1),fields(full,1)); assert.deepEqual(fields(odd,3),fields(full,3))
  assert.deepEqual(fields(odd,2),[]); assert.deepEqual(fields(odd,4),[])
  assert.deepEqual(routes(staat, van, [false,false,false,false]), [])
  assert.deepEqual(routes(staat, van, [false,false,false,false,true]), [])
}

// Friendly destinations block landing, while the knight can still jump over
// an adjacent ring of pieces. Captured enemies disappear along that branch.
{
  const van = [7,1], blocked = empty(van)
  blocked.bord[5][0] = 'wP'; blocked.bord[5][2] = 'wB'; blocked.bord[6][3] = 'wP'
  assert.deepEqual(routes(blocked, van), [], 'a knight with no legal first jump has no future routes')
  const jumping = empty([4,3])
  for (let r = 3; r <= 5; r++) for (let k = 2; k <= 4; k++) if (r !== 4 || k !== 3) jumping.bord[r][k] = 'wP'
  assert.equal(fields(routes(jumping,[4,3]),1).length,8, 'adjacent pieces do not block a knight jump')
  const capture = empty([7,1])
  capture.bord[5][0] = 'wP'; capture.bord[5][2] = 'zR'; capture.bord[6][3] = 'wP'
  assert.deepEqual(fields(routes(capture,[7,1]),1), ['5,2'], 'an opposing piece can be captured')
  assert.ok(at(routes(capture,[7,1]),7,1).includes(2), 'the capturing knight can leave the captured square on its next hypothetical jump')
}

// King safety is recomputed for every hypothetical position, not merely the
// source position. A pinned knight cannot expose its king; capturing the enemy
// king is never presented as a possible chess move.
{
  const pinned = empty([6,4])
  pinned.bord[7][4] = 'wK'; pinned.bord[0][4] = 'zR'; pinned.bord[0][0] = 'zK'
  assert.deepEqual(Schaak.legaleZetten(pinned,6,4), [])
  assert.deepEqual(routes(pinned,[6,4]), [])
  const uncover = empty([5,2])
  uncover.bord[7][4] = 'wK'; uncover.bord[0][4] = 'zR'; uncover.bord[6][4] = 'zR'; uncover.bord[0][0] = 'zK'
  // White is checked by e2's rook. c3xe2 removes it, but the knight must then
  // stay on that file to shield the king from the remaining rook on e8.
  assert.deepEqual(fields(routes(uncover,[5,2]),1), ['6,4'])
  assert.deepEqual(fields(routes(uncover,[5,2]),2), [])
  const king = empty([4,3]); king.bord[2][2] = 'zK'
  assert.ok(Schaak.legaleZetten(king,4,3).some(zet => zet.naar[0] === 2 && zet.naar[1] === 2), 'fixture exposes the compact engine king target')
  assert.deepEqual(at(routes(king,[4,3]),2,2), [], 'opposing king squares are never reachable captures, even in later hypothetical layers')
}

// Either colour can be inspected during the live human turn; the search uses
// the selected knight's colour without changing the live side to move.
{
  const staat = empty([0,1], 'z')
  const blackTurn = routes(staat,[0,1])
  assert.ok(blackTurn.length)
  staat.aanZet = 'w'
  const before = JSON.stringify(staat)
  assert.deepEqual(routes(staat,[0,1]), blackTurn, 'opponent knight routes use the knight colour, not the current player colour')
  assert.equal(JSON.stringify(staat), before, 'opponent inspection leaves the real human turn intact')
  const pinned = empty([1,4], 'z')
  pinned.aanZet = 'w'; pinned.bord[0][4] = 'zK'; pinned.bord[7][4] = 'wR'; pinned.bord[7][0] = 'wK'
  assert.deepEqual(routes(pinned,[1,4]), [], 'opponent inspection still protects the opposing knight’s own king')
}

// A non-knight or malformed options is harmless.
{
  const staat = empty([0,1], 'z')
  staat.bord[0][1] = 'wR'; assert.deepEqual(routes(staat,[0,1]), [])
  for (const van of [null, [], [-1,0], [8,0], [0,1.5], ['0',1]]) assert.deepEqual(routes(staat,van), [])
  assert.deepEqual(berekenPaardroutes(), [])
  assert.deepEqual(berekenPaardroutes({Schaak,staat:{bord:[]},van:[0,0]}), [])
  const corrupt = empty(); corrupt.bord[0][0] = 'bad'
  assert.deepEqual(routes(corrupt,[4,3]), [])
  assert.deepEqual(routes(empty(),[4,3],null), [])
  assert.deepEqual(routes(empty(),[4,3],['true',1,{},null]), [])
}

console.log('PASS: exact 1–4 knight routes, full-board horizons, independent toggles, loops, capture branches, king safety and immutable live position.')
