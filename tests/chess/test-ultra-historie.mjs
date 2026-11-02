import assert from 'node:assert/strict'
import * as Schaak from '../../schaak.js'
import { uciNaarZet } from '../../schaak-ultra-engine.js'
import { maakUltraEvaluatieHistorie, schaakNotatie } from '../../schaak-ultra-historie.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const fenAt = ply => (ply % 2 ? E4 : START).replace(/\d+$/, String(Math.floor(ply / 2) + 1))
const evaluation = (ply, cp, final = true, extra = {}) => ({ ply, fen:fenAt(ply), cp, mate:null, final, ...extra })

function stateFromFen(fen) {
  const [placement, turn, rights, enPassant] = fen.split(' ')
  return {
    bord:placement.split('/').map(row => [...row].flatMap(symbol => /\d/.test(symbol)
      ? Array(Number(symbol)).fill(null)
      : [(symbol === symbol.toUpperCase() ? 'w' : 'z') + symbol.toUpperCase()])),
    aanZet:turn === 'w' ? 'w' : 'z',
    rokade:{ wK:rights.includes('K'), wQ:rights.includes('Q'), zK:rights.includes('k'), zQ:rights.includes('q') },
    enPassantKolom:enPassant === '-' ? null : 'abcdefgh'.indexOf(enPassant[0]),
    halfzetTeller:0,
  }
}

function notation(fen, uci, expected) {
  const state = stateFromFen(fen)
  const before = structuredClone(state)
  const choice = uciNaarZet(Schaak, state, uci)
  assert(choice, `fixture has a legal move: ${uci}`)
  assert.equal(schaakNotatie(Schaak, state, choice.zet, choice.promotieStuk), expected, `${uci} in ${fen}`)
  assert.deepEqual(state, before, 'notation must not change the board, turn, castling rights or en-passant rights')
}

notation(START, 'e2e4', 'e4')
notation('7k/8/8/3p4/4P3/8/8/7K w - - 0 1', 'e4d5', 'exd5')
notation('7k/8/8/4p3/8/5N2/8/7K w - - 0 1', 'f3e5', 'Nxe5')
notation('7k/8/8/3pP3/8/8/8/7K w - d6 0 1', 'e5d6', 'exd6')
notation('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1g1', 'O-O')
notation('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1c1', 'O-O-O')
notation('r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1', 'e8g8', 'O-O')
notation('r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1', 'e8c8', 'O-O-O')
notation('5k2/8/8/8/8/8/8/4K2R w K - 0 1', 'e1g1', 'O-O+')

notation('7k/8/8/8/8/8/8/1N3N1K w - - 0 1', 'b1d2', 'Nbd2')
notation('7k/8/8/8/8/8/8/1N3N1K w - - 0 1', 'f1d2', 'Nfd2')
notation('7k/8/8/8/8/R7/8/R6K w - - 0 1', 'a1a2', 'R1a2')
notation('7k/8/8/8/8/R7/8/R6K w - - 0 1', 'a3a2', 'R3a2')
notation('6k1/8/8/8/8/4Q3/8/Q3Q2K w - - 0 1', 'e1c3', 'Qe1c3')
notation('4r2k/8/8/8/8/8/4N1N1/4K3 w - - 0 1', 'g2f4', 'Nf4')

for (const [piece, suffix] of [['q', 'Q+'], ['r', 'R+'], ['b', 'B'], ['n', 'N']]) {
  notation('7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8' + piece, 'a8=' + suffix)
}
notation('1r5k/P7/8/8/8/8/8/7K w - - 0 1', 'a7b8n', 'axb8=N')
notation('8/4P3/5k2/8/8/8/8/K7 w - - 0 1', 'e7e8n', 'e8=N+')
notation('7k/5P2/6K1/8/8/8/8/8 w - - 0 1', 'f7f8q', 'f8=Q#')
notation('7k/8/8/8/8/8/p7/7K b - - 0 1', 'a2a1n', 'a1=N')

{
  const state = Schaak.nieuweSpelStaat()
  for (const [uci, san] of [['e2e4', 'e4'], ['e7e5', 'e5'], ['d1h5', 'Qh5'], ['b8c6', 'Nc6'], ['f1c4', 'Bc4'], ['g8f6', 'Nf6'], ['h5f7', 'Qxf7#']]) {
    const { zet, promotieStuk } = uciNaarZet(Schaak, state, uci)
    assert.equal(schaakNotatie(Schaak, state, zet, promotieStuk), san)
    Schaak.voerZetUit(state, zet, promotieStuk)
  }
}

{
  const state = Schaak.nieuweSpelStaat()
  const choice = uciNaarZet(Schaak, state, 'g1f3')
  for (const row of state.bord) Object.freeze(row)
  Object.freeze(state.bord); Object.freeze(state.rokade); Object.freeze(state)
  Object.freeze(choice.zet.van); Object.freeze(choice.zet.naar); Object.freeze(choice.zet)
  assert.equal(schaakNotatie(Schaak, state, choice.zet), 'Nf3', 'frozen caller inputs work')
  for (const invalid of [null, {}, { van:[9, 0], naar:[1, 0] }, { van:[6, 4], naar:[3, 4] }, { van:[1, 4], naar:[3, 4] }]) {
    assert.equal(schaakNotatie(Schaak, state, invalid), null)
  }
  const promotionState = stateFromFen('7k/P7/8/8/8/8/8/7K w - - 0 1')
  const move = uciNaarZet(Schaak, promotionState, 'a7a8q').zet
  assert.equal(schaakNotatie(Schaak, promotionState, move), 'a8=Q+')
  assert.equal(schaakNotatie(Schaak, promotionState, move, 'K'), null)
}

{
  const history = maakUltraEvaluatieHistorie()
  assert.equal(history.getSnapshot(), null)
  let value = history.update(evaluation(0, 25, false))
  assert.equal(value.deltaCp, null, 'an unanalysed starting position is not invented as 0 cp')
  assert.equal(value.isNewFinal, false)
  value = history.update(evaluation(0, 25))
  assert.equal(value.isNewFinal, true)
  assert.equal(value.previousCp, null)

  value = history.update(evaluation(1, 10, false))
  assert.equal(value.deltaCp, -15)
  assert.equal(value.previousCp, 25)
  assert.equal(value.direction, 'loss')
  assert.equal(value.magnitude, 'small')
  assert.equal(value.isNewFinal, false)
  value = history.update(evaluation(1, 55, false))
  assert.equal(value.deltaCp, 30, 'stream messages compare to the prior ply, never the prior message')
  assert.equal(value.previousCp, 25)
  value = history.update(evaluation(1, 70))
  assert.equal(value.deltaCp, 45)
  assert.equal(value.isNewFinal, true)
  assert.equal(value.whiteShare, 50 + 46 * Math.tanh(70 / 600))
  assert.equal(value.previousWhiteShare, 50 + 46 * Math.tanh(25 / 600))
  value.cp = 9000
  value = history.update(evaluation(1, 99))
  assert.equal(value.cp, 70, 'the first final score is immutable')
  assert.equal(value.isNewFinal, false, 'replayed final evaluations cannot replay their sound')
  value = history.update(evaluation(1, -999, false))
  assert.equal(value.cp, 70, 'late stream messages cannot replace the final score')
  assert.equal(value.isNewFinal, false)
  value = history.update(evaluation(2, 220))
  assert.equal(value.previousCp, 70)
  assert.equal(value.deltaCp, 150)
  assert.equal(value.direction, 'gain')
  assert.equal(value.magnitude, 'large')
  assert.equal(value.isNewFinal, true)
  assert.equal(history.update(evaluation(1, 70)), null, 'older plies are ignored')
  const copy = history.getSnapshot()
  assert.equal(copy.isNewFinal, false, 'reading state does not create a final event')
  copy.cp = -5000
  assert.equal(history.getSnapshot().cp, 220)
  history.reset()
  assert.equal(history.getSnapshot(), null)
  assert.equal(history.update(evaluation(0, 0)).isNewFinal, true)
}

{
  const history = maakUltraEvaluatieHistorie()
  history.update(evaluation(0, 12))
  history.update(evaluation(1, 50, false))
  const value = history.update(evaluation(2, 100))
  for (const key of ['previousCp', 'previousMate', 'previousWhiteShare', 'deltaCp', 'direction', 'magnitude']) {
    assert.equal(value[key], null, `${key} is absent when the previous ply has no final evaluation`)
  }
  assert.equal(history.update(evaluation(1, 50)), null, 'late final scores cannot move history backwards')
  assert.equal(history.update(evaluation(4, 130)).deltaCp, null, 'a skipped ply does not reuse an older baseline')
}

{
  const history = maakUltraEvaluatieHistorie()
  history.update(evaluation(0, 100))
  let value = history.update(evaluation(1, null, true, { mate:3 }))
  assert.equal(value.deltaCp, 9900)
  assert.equal(value.whiteShare, 98)
  assert.equal(value.previousCp, 100)
  value = history.update(evaluation(2, null, true, { mate:-2 }))
  assert.equal(value.deltaCp, -20000)
  assert.equal(value.whiteShare, 2)
  assert.equal(value.previousMate, 3)
  assert.equal(value.direction, 'loss')
  value = history.update(evaluation(3, null, true, { mate:0 }))
  assert.equal(value.whiteShare, 98, 'mate 0 with Black to move is a White win')
  assert.equal(value.deltaCp, 20000)
  value = history.update(evaluation(4, null, true, { mate:JSON.parse(JSON.stringify(-0)) }))
  assert.equal(value.whiteShare, 2, 'mate 0 with White to move is a Black win even after JSON loses negative zero')
  assert.equal(value.deltaCp, -20000)
  value = history.update(evaluation(5, 0))
  assert.equal(value.deltaCp, 10000)
  assert.equal(value.whiteShare, 50)
}

for (const [delta, magnitude] of [[0, 'small'], [49, 'small'], [50, 'medium'], [149, 'medium'], [150, 'large'], [-50, 'medium'], [-150, 'large']]) {
  const history = maakUltraEvaluatieHistorie()
  history.update(evaluation(0, 0))
  const value = history.update(evaluation(1, delta))
  assert.equal(value.magnitude, magnitude)
  assert.equal(value.direction, delta === 0 ? 'equal' : delta > 0 ? 'gain' : 'loss')
}

{
  const history = maakUltraEvaluatieHistorie()
  history.update(evaluation(0, 0))
  for (const invalid of [
    null, {}, evaluation(-1, 1), evaluation(1.2, 1), evaluation('1', 1),
    evaluation(1, null), evaluation(1, NaN), evaluation(1, Infinity), evaluation(1, '12'),
    evaluation(1, Number.MAX_SAFE_INTEGER + 1), evaluation(1, 1, true, { mate:2 }),
    evaluation(1, null, true, { mate:1.2 }), evaluation(1, null, true, { mate:Infinity }),
    evaluation(1, 1, true, { final:undefined }), evaluation(1, 1, 'true'),
    ...['', START.replace(' w ', ' z '), START.replace('rnbqkbnr', '9'), START.replace('KQkq', 'bad'), START.replace(' - ', ' e4 '), START + '\n'].map(fen => evaluation(99, 1, true, { fen })),
  ]) {
    assert.equal(history.update(invalid), null, `invalid evaluations are ignored: ${JSON.stringify(invalid)}`)
  }
  assert.equal(history.update(evaluation(1, 20, false)).previousCp, 0, 'invalid high plies do not advance history')
  assert.equal(history.update(evaluation(1, 20, true, { fen:START })), null, 'one ply cannot silently change position')
  assert.equal(history.update(evaluation(1, 20)).isNewFinal, true)
}

console.log('Ultra history and SAN tests passed')
