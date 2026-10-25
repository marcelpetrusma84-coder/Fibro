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
assert.equal(board.edgeNeighbors.size, 336, 'the 96 cells share 168 complete interior edges')
assert.equal(board.cells.length * 4 - board.edgeNeighbors.size, 48, 'each outside hexagon side has eight cell edges')
for (const cell of board.cells) {
  for (let edge = 0; edge < 4; edge++) {
    const neighbor = board.edgeNeighbors.get(`${cell.id}:${edge}`)
    if (neighbor) assert.notEqual(cell.shade, board.byId.get(neighbor.id).shade, 'checker colours alternate across every shared edge')
  }
}

const game = newThreePlayerGame()
assert.equal(game.pieces.size, 48, 'each of the three players starts with 16 pieces')
assert.deepEqual([...game.active], [true, true, true])
assert.equal(game.turn, 0, 'White moves first')
assert.equal(game.pieces.get('0:3:0').type, 'R')
assert.equal(game.pieces.get('1:3:0').type, 'K')
assert.equal(game.pieces.get('2:3:0').color, 'black')
assert.equal(game.pieces.get('4:3:0').color, 'red')
const centreY = cell => threePlayerCellPolygon(cell).reduce((sum, point) => sum + point[1] / 4, 0)
const redBackRank = game.board.cells.filter(cell => cell.visualTerritory === 2 && cell.visualRow === 0).sort((a,b) => centreY(a) - centreY(b))
assert.deepEqual(redBackRank.map(cell => game.pieces.get(cell.id).type), ['R','N','B','K','Q','B','N','R'], 'Red follows the reference king/queen order from top to right')

const pawnMoves = legalThreePlayerMoves(game, '0:2:0')
assert(pawnMoves.includes('0:1:0'), 'a pawn can advance one cell')
assert(pawnMoves.includes('0:0:0'), 'a pawn can advance two cells on its first move')
assert.equal(applyThreePlayerMove(game, '0:2:0', '0:1:0'), true)
assert.equal(game.turn, 1, 'the turn rotates White, Black, Red')
assert.equal(applyThreePlayerMove(game, '0:1:0', '0:0:0'), false, 'only the player to move may move')

const capture = newThreePlayerGame()
capture.pieces.clear()
capture.pieces.set('0:0:0', { color:'white', type:'R', player:0 })
capture.pieces.set('0:2:1', { color:'white', type:'K', player:0 })
capture.pieces.set('0:3:0', { color:'black', type:'K', player:1 })
capture.pieces.set('0:3:1', { color:'red', type:'K', player:2 })
assert.equal(applyThreePlayerMove(capture, '0:0:0', '0:3:0'), true, 'a king can be captured')
assert.deepEqual([...capture.active], [true, false, true])
assert.equal([...capture.pieces.values()].some(piece => piece.player === 1), false, 'capturing a king removes the eliminated army')
assert.equal(capture.winner, null)
assert.equal(capture.turn, 2, 'eliminated players are skipped')
assert.equal(applyThreePlayerMove(capture, '0:3:1', '0:2:1'), true)
assert.equal(capture.winner, 2, 'the last remaining king wins')

const at = (state, territory, rank, file) => state.board.byVisual.get(`${territory}:${rank}:${file}`)
const emptyGame = () => {
  const state = newThreePlayerGame()
  state.pieces.clear()
  return state
}

const pawn = emptyGame()
const pawnFrom = at(pawn, 0, 3, 2)
pawn.pieces.set(pawnFrom.id, { color:'white', type:'P', player:0, hasMoved:true })
const crossing = legalThreePlayerMoves(pawn, pawnFrom.id)
assert.equal(crossing.length, 1)
assert.equal(pawn.board.byId.get(crossing[0]).visualTerritory, 1, 'a pawn crosses the centre into the adjacent opponent territory')
assert.equal(applyThreePlayerMove(pawn, pawnFrom.id, crossing[0]), true)
pawn.turn = 0
const continued = legalThreePlayerMoves(pawn, crossing[0])
assert.equal(continued.length, 1)
assert.equal(pawn.board.byId.get(continued[0]).visualRow, 2, 'after crossing, the pawn continues towards the enemy back rank')
assert(!continued.includes(pawnFrom.id), 'a pawn cannot reverse across the centre')

const promotion = emptyGame()
const nearBack = at(promotion, 1, 1, 2), backRank = at(promotion, 1, 0, 2)
promotion.pieces.set(nearBack.id, { color:'white', type:'P', player:0, hasMoved:true })
assert.equal(applyThreePlayerMove(promotion, nearBack.id, backRank.id, 'N'), true)
assert.equal(promotion.pieces.get(backRank.id).type, 'N', 'a pawn promotes after moving within an opponent territory onto its back rank')
assert.equal(promotion.lastMove.promoted, true)

const knight = emptyGame()
const knightFrom = at(knight, 0, 3, 2)
knight.pieces.set(knightFrom.id, { color:'white', type:'N', player:0 })
knight.pieces.set(at(knight, 0, 3, 3).id, { color:'white', type:'P', player:0 })
knight.pieces.set(at(knight, 1, 3, 5).id, { color:'white', type:'P', player:0 })
assert(legalThreePlayerMoves(knight, knightFrom.id).includes(at(knight, 1, 2, 6).id), 'a knight jumps over occupied centre squares into another territory')
const ordinaryKnight = emptyGame()
const ordinaryFrom = at(ordinaryKnight, 0, 1, 2)
ordinaryKnight.pieces.set(ordinaryFrom.id, { color:'white', type:'N', player:0 })
assert.equal(legalThreePlayerMoves(ordinaryKnight, ordinaryFrom.id).length, 6, 'a knight keeps its ordinary L-shaped moves away from the centre')

const bishop = emptyGame()
for (const origin of bishop.board.cells) {
  bishop.pieces.clear()
  bishop.pieces.set(origin.id, { color:'white', type:'B', player:0 })
  const edges = new Set([0,1,2,3].map(edge => bishop.board.edgeNeighbors.get(`${origin.id}:${edge}`)?.id))
  for (const id of legalThreePlayerMoves(bishop, origin.id)) {
    assert.equal(bishop.board.byId.get(id).shade, origin.shade, 'bishops remain on the same checker colour through the centre')
    assert(!edges.has(id), 'a bishop cannot capture an edge-adjacent square across a territory seam')
  }
}

console.log('Three-player chess engine tests passed')
