// Three-player, 96-cell chess on a hexagonal trisection board.
// The board is six 4x4 rhombi; each player owns two adjacent rhombi.
const DIRECTIONS = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]
]
const PIECES = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
const COLORS = ['blue', 'red', 'green']

const cellId = (sector, row, file) => `${sector}:${row}:${file}`
const pointKey = (q, r) => `${Math.round(q * 2) / 2},${Math.round(r * 2) / 2}`
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const scale = (a, n) => [a[0] * n, a[1] * n]

export function createThreePlayerBoard() {
  const cells = []
  const byPoint = new Map()
  for (let sector = 0; sector < 6; sector++) {
    const u = DIRECTIONS[sector]
    const v = DIRECTIONS[(sector + 1) % 6]
    for (let row = 0; row < 4; row++) {
      for (let file = 0; file < 4; file++) {
        const center = add(scale(u, row + .5), scale(v, file + .5))
        const corners = [
          add(scale(u, row), scale(v, file)),
          add(scale(u, row + 1), scale(v, file)),
          add(scale(u, row + 1), scale(v, file + 1)),
          add(scale(u, row), scale(v, file + 1))
        ]
        const cell = { id:cellId(sector, row, file), sector, row, file, center, corners, shade:(sector + row + file) % 2 }
        cells.push(cell)
        byPoint.set(pointKey(...center), cell)
      }
    }
  }
  return { cells, byId:new Map(cells.map(cell => [cell.id, cell])), byPoint }
}

export function newThreePlayerGame() {
  const board = createThreePlayerBoard()
  const pieces = new Map()
  for (let player = 0; player < 3; player++) {
    const sectors = [player * 2, player * 2 + 1]
    const army = [...PIECES]
    for (let side = 0; side < 2; side++) {
      const sector = sectors[side]
      for (let file = 0; file < 4; file++) {
        pieces.set(cellId(sector, 3, file), { color:COLORS[player], type:army[side * 4 + file], player })
        pieces.set(cellId(sector, 2, file), { color:COLORS[player], type:'P', player, hasMoved:false })
      }
    }
  }
  return { board, pieces, active:[true, true, true], turn:0, ply:0, winner:null, lastMove:null }
}

function targetAt(state, cell, delta, step = 1) {
  const point = add(cell.center, scale(delta, step))
  return state.board.byPoint.get(pointKey(...point)) || null
}

function unitDirections(cell) {
  const u = DIRECTIONS[cell.sector]
  const v = DIRECTIONS[(cell.sector + 1) % 6]
  return { u, v }
}

function rayMoves(state, from, directions, player) {
  const moves = []
  for (const direction of directions) {
    for (let step = 1; step <= 8; step++) {
      const target = targetAt(state, from, direction, step)
      if (!target) break
      const occupant = state.pieces.get(target.id)
      if (occupant?.player === player) break
      moves.push(target.id)
      if (occupant) break
    }
  }
  return moves
}

export function legalThreePlayerMoves(state, fromId) {
  const piece = state.pieces.get(fromId)
  const from = state.board.byId.get(fromId)
  if (!piece || !from || piece.player !== state.turn || !state.active[piece.player] || state.winner !== null) return []
  const { u, v } = unitDirections(from)
  const orthogonal = [u, scale(u,-1), v, scale(v,-1)]
  const diagonal = [add(u,v), scale(add(u,v),-1), add(u,scale(v,-1)), scale(add(u,scale(v,-1)),-1)]
  if (piece.type === 'R') return rayMoves(state, from, orthogonal, piece.player)
  if (piece.type === 'B') return rayMoves(state, from, diagonal, piece.player)
  if (piece.type === 'Q') return rayMoves(state, from, [...orthogonal, ...diagonal], piece.player)
  if (piece.type === 'K') {
    return [...orthogonal, ...diagonal].flatMap(direction => {
      const target = targetAt(state, from, direction)
      return target && state.pieces.get(target.id)?.player !== piece.player ? [target.id] : []
    })
  }
  if (piece.type === 'N') {
    const leaps = []
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      leaps.push(add(scale(u, 2 * su), scale(v, sv)))
      leaps.push(add(scale(v, 2 * sv), scale(u, su)))
    }
    return [...new Set(leaps.map(delta => targetAt(state, from, delta)?.id).filter(Boolean))]
      .filter(id => state.pieces.get(id)?.player !== piece.player)
  }
  if (piece.type === 'P') {
    const direction = scale(u, -1)
    const moves = []
    const one = targetAt(state, from, direction)
    if (one && !state.pieces.has(one.id)) {
      moves.push(one.id)
      const two = targetAt(state, from, direction, 2)
      if (!piece.hasMoved && from.row === 2 && two && !state.pieces.has(two.id)) moves.push(two.id)
    }
    for (const captureDirection of [add(direction, v), add(direction, scale(v,-1))]) {
      const target = targetAt(state, from, captureDirection)
      if (target && state.pieces.has(target.id) && state.pieces.get(target.id).player !== piece.player) moves.push(target.id)
    }
    return moves
  }
  return []
}

export function applyThreePlayerMove(state, fromId, toId, promoteTo = 'Q') {
  if (!legalThreePlayerMoves(state, fromId).includes(toId)) return false
  const piece = state.pieces.get(fromId)
  const from = state.board.byId.get(fromId)
  const to = state.board.byId.get(toId)
  const captured = state.pieces.get(toId) || null
  state.pieces.delete(fromId)
  state.pieces.delete(toId)
  const promoted = piece.type === 'P' && to.row === 3 && to.sector !== piece.player * 2 && to.sector !== piece.player * 2 + 1
  state.pieces.set(toId, { ...piece, hasMoved:true, type:promoted ? (['Q','R','B','N'].includes(promoteTo) ? promoteTo : 'Q') : piece.type })
  if (captured?.type === 'K') {
    state.active[captured.player] = false
    for (const [id, remaining] of state.pieces) {
      if (remaining.player === captured.player) state.pieces.delete(id)
    }
  }
  state.lastMove = { from:fromId, to:toId, captured, promoted }
  state.ply++
  const survivors = state.active.map((active, player) => active ? player : -1).filter(player => player >= 0)
  if (survivors.length === 1) state.winner = survivors[0]
  if (state.winner === null) {
    for (let tries = 0; tries < 3; tries++) {
      state.turn = (state.turn + 1) % 3
      if (state.active[state.turn]) break
    }
  }
  return true
}

export function threePlayerCellPolygon(cell) {
  return cell.corners.map(([q, r]) => [q + r * .5, r * Math.sqrt(3) / 2])
}

export const THREE_PLAYER_COLORS = Object.freeze([...COLORS])
export const THREE_PLAYER_NAMES = Object.freeze(['Blue', 'Red', 'Green'])
export const THREE_PLAYER_SYMBOLS = Object.freeze({ K:'♚', Q:'♛', R:'♜', B:'♝', N:'♞', P:'♟' })
