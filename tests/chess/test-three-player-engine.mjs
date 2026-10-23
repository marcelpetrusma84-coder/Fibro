import assert from 'node:assert/strict'
import {
  applyThreePlayerMove,
  createThreePlayerBoard,
  legalThreePlayerMoves,
  newThreePlayerGame,
  threePlayerCellPolygon
} from '../../schaak-drie.js'

const board = createThreePlayerBoard()
assert.equal(board.cells.length, 96, 'the three-player board has 96 distinct cells')
assert.equal(new Set(board.cells.map(cell => cell.id)).size, 96)
assert.equal(threePlayerCellPolygon(board.cells[0]).length, 4)

const game = newThreePlayerGame()
assert.equal(game.pieces.size, 48, 'each of the three players starts with 16 pieces')
assert.deepEqual([...game.active], [true, true, true])
assert.equal(game.turn, 0, 'Blue moves first')
assert.equal(game.pieces.get('0:3:0').type, 'R')
assert.equal(game.pieces.get('1:3:0').type, 'K')
assert.equal(game.pieces.get('2:3:0').color, 'red')
assert.equal(game.pieces.get('4:3:0').color, 'green')

const pawnMoves = legalThreePlayerMoves(game, '0:2:0')
assert(pawnMoves.includes('0:1:0'), 'a pawn can advance one cell')
assert(pawnMoves.includes('0:0:0'), 'a pawn can advance two cells on its first move')
assert.equal(applyThreePlayerMove(game, '0:2:0', '0:1:0'), true)
assert.equal(game.turn, 1, 'the turn rotates Blue, Red, Green')
assert.equal(applyThreePlayerMove(game, '0:1:0', '0:0:0'), false, 'only the player to move may move')

const capture = newThreePlayerGame()
capture.pieces.clear()
capture.pieces.set('0:0:0', { color:'blue', type:'R', player:0 })
capture.pieces.set('0:2:1', { color:'blue', type:'K', player:0 })
capture.pieces.set('0:3:0', { color:'red', type:'K', player:1 })
capture.pieces.set('0:3:1', { color:'green', type:'K', player:2 })
assert.equal(applyThreePlayerMove(capture, '0:0:0', '0:3:0'), true, 'a king can be captured')
assert.deepEqual([...capture.active], [true, false, true])
assert.equal([...capture.pieces.values()].some(piece => piece.player === 1), false, 'capturing a king removes the eliminated army')
assert.equal(capture.winner, null)
assert.equal(capture.turn, 2, 'eliminated players are skipped')
assert.equal(applyThreePlayerMove(capture, '0:3:1', '0:2:1'), true)
assert.equal(capture.winner, 2, 'the last remaining king wins')

console.log('Three-player chess engine tests passed')
