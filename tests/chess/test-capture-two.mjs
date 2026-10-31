import assert from 'node:assert/strict'
import * as Schaak from '../../schaak.js'
import { schaakSlagEffect } from '../../schaken-ui.js'
import { registreerSlag } from '../../schaak-stukken.js'

function findMove(state, from, to) {
  const move = Schaak.legaleZetten(state, ...from).find(move => move.naar[0] === to[0] && move.naar[1] === to[1])
  assert.ok(move, `the engine accepts ${from} → ${to}`)
  return move
}
function emptyState(turn = 'w') {
  const state = Schaak.nieuweSpelStaat()
  state.bord = Array.from({ length:8 }, () => Array(8).fill(null))
  state.bord[7][7] = 'wK'; state.bord[0][7] = 'zK'; state.aanZet = turn
  return state
}

// Every supported capture value comes from the victim, from either player's perspective.
for (const [type, value] of [['P',1],['N',3],['B',3],['R',5],['Q',9]]) {
  const state = emptyState()
  state.bord[7][0] = 'wR'; state.bord[3][0] = 'z' + type
  const move = findMove(state, [7,0], [3,0])
  const snapshot = JSON.stringify(state.bord)
  assert.deepEqual(schaakSlagEffect(state, move, 'w'), { value, outcome:'win' })
  assert.deepEqual(schaakSlagEffect(state, move, 'z'), { value, outcome:'loss' })
  assert.equal(JSON.stringify(state.bord), snapshot, 'preparing audio never changes the position')
}

// An opponent/PC move that removes your queen is a loss cue, regardless of whose turn follows.
{
  const state = emptyState('z')
  state.bord[0][0] = 'zR'; state.bord[4][0] = 'wQ'
  const move = findMove(state, [0,0], [4,0])
  assert.deepEqual(schaakSlagEffect(state, move, 'w'), { value:9, outcome:'loss' })
  assert.deepEqual(schaakSlagEffect(state, move, 'z'), { value:9, outcome:'win' })
}

// En passant removes a pawn beside the attacker, even though the target square is empty.
{
  const state = Schaak.nieuweSpelStaat()
  for (const [from,to] of [[[6,4],[4,4]],[[1,0],[2,0]],[[4,4],[3,4]],[[1,3],[3,3]]]) {
    Schaak.voerZetUit(state, findMove(state, from, to))
  }
  const move = findMove(state, [3,4], [2,3])
  assert.equal(move.type, 'enpassant')
  assert.equal(state.bord[2][3], null)
  assert.deepEqual(schaakSlagEffect(state, move, 'w'), { value:1, outcome:'win' })
  assert.deepEqual(schaakSlagEffect(state, move, 'z'), { value:1, outcome:'loss' })
  const captures = { w:[], z:[] }
  registreerSlag(state, move, captures); Schaak.voerZetUit(state, move)
  assert.deepEqual(captures.w, ['zP'])
  assert.equal(state.bord[3][3], null)
}

// A capture-promotion sounds like the rook that was captured, not the new queen.
{
  const state = emptyState()
  state.bord[1][0] = 'wP'; state.bord[0][1] = 'zR'
  const move = findMove(state, [1,0], [0,1])
  const receipt = schaakSlagEffect(state, move, 'w')
  assert.deepEqual(receipt, { value:5, outcome:'win' })
  Schaak.voerZetUit(state, move, 'Q')
  assert.equal(state.bord[0][1], 'wQ')
  assert.deepEqual(receipt, { value:5, outcome:'win' }, 'the completed move cannot alter the audio receipt')
}

// Quiet moves and own-colour pieces do not fabricate a successful capture cue.
{
  const state = Schaak.nieuweSpelStaat()
  const move = findMove(state, [6,4], [4,4])
  assert.equal(schaakSlagEffect(state, move, 'w'), null)
  assert.equal(schaakSlagEffect(state, { van:[7,0], naar:[6,0] }, 'w'), null)
  assert.equal(schaakSlagEffect(state, move, 'invalid'), null)
  assert.equal(schaakSlagEffect(state, null, 'w'), null)
}

console.log('PASS: capture audio values and win/loss perspective with real legal captures, PC/opponent loss, en passant, promotion and quiet moves.')
