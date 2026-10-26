// Three-player chess on the 96-cell, three-territory hexagonal board.
const DIRECTIONS = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]
]
const PIECES = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
const COLORS = ['white', 'black', 'red']
// Exact grid vertices from Green Chess's yalta3.svg (Uray M. János,
// CC BY-SA 3.0). Do not replace these hand-shaped rows with a projection:
// their changing slopes are the distinctive geometry of the reference.
const REFERENCE_GRID = [
  [[0,387.98],[56,387.98],[112,387.98],[168,387.98],[224,387.98]],
  [[0,303.22],[62.75,306.18],[126,315.24],[189,327.36],[252,339.48]],
  [[0,219.28],[69.20,227.91],[140,242.49],[210,266.74],[280,290.98]],
  [[0,135.20],[83.75,145.06],[162.78,173.89],[233.78,207.43],[308,242.49]],
  [[0,0],[117.08,67.60],[189.90,109.64],[262.60,151.61],[336,193.99]]
]
export const THREE_PLAYER_OUTLINE = Object.freeze([[448,0],[224,-387.98],[-224,-387.98],[-448,0],[-224,387.98],[224,387.98]])

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
        const visual = { territory:Math.floor(sector / 2), half:sector % 2 }
        const visualRow = 3 - row
        const visualFile = visual.half * 4 + file
        const cell = {
          id:cellId(sector, row, file), sector, row, file, center, corners,
          visualTerritory:visual.territory, visualRow, visualFile,
          shade:(visualRow + visualFile) % 2 === 0 ? 1 : 0
        }
        cells.push(cell)
        byPoint.set(pointKey(...center), cell)
      }
    }
  }
  const edgeNeighbors = new Map()
  const edgeBuckets = new Map()
  const vertexNeighbors = new Map()
  for (const cell of cells) {
    const polygon = threePlayerCellPolygon(cell)
    polygon.forEach((point, corner) => {
      const key = visualPointKey(point)
      if (!vertexNeighbors.has(key)) vertexNeighbors.set(key, [])
      vertexNeighbors.get(key).push({ id:cell.id, corner })
    })
    for (let edge = 0; edge < 4; edge++) {
      const key = [polygon[edge], polygon[(edge + 1) % 4]].map(visualPointKey).sort().join('|')
      const previous = edgeBuckets.get(key)
      if (previous) {
        edgeNeighbors.set(`${cell.id}:${edge}`, { id:previous.cell.id, edge:previous.edge })
        edgeNeighbors.set(`${previous.cell.id}:${previous.edge}`, { id:cell.id, edge })
      } else edgeBuckets.set(key, { cell, edge })
    }
  }
  const byVisual = new Map(cells.map(cell => [`${cell.visualTerritory}:${cell.visualRow}:${cell.visualFile}`, cell]))
  return { cells, byId:new Map(cells.map(cell => [cell.id, cell])), byPoint, byVisual, edgeNeighbors, vertexNeighbors }
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

export function legalThreePlayerMoves(state, fromId) {
  const piece = state.pieces.get(fromId)
  const from = state.board.byId.get(fromId)
  if (!piece || !from || piece.player !== state.turn || !state.active[piece.player] || state.winner !== null) return []
  if (piece.type === 'P') {
    const moves = []
    // Forward points towards the centre at home and towards the back rank
    // after crossing into an opponent's territory.
    const forward = from.visualTerritory === piece.player ? 1 : -1
    const firstStep = visualStep(state, from, forward, 0)
    const one = firstStep?.cell
    if (one && !state.pieces.has(one.id)) {
      moves.push(one.id)
      const two = visualStep(state, one, firstStep.dr, firstStep.df)?.cell
      if (!piece.hasMoved && from.visualTerritory === piece.player && from.visualRow === 1 && two && !state.pieces.has(two.id)) moves.push(two.id)
    }
    for (const file of [from.visualFile - 1, from.visualFile + 1]) {
      const df = file - from.visualFile
      const target = state.board.byVisual.get(`${from.visualTerritory}:${from.visualRow + forward}:${file}`)
      const targets = target ? [target] : visualCornerSteps(state, from, forward, df).map(step => step.cell)
      for (const candidate of targets) {
        if (state.pieces.get(candidate.id)?.player !== piece.player && state.pieces.has(candidate.id)) moves.push(candidate.id)
      }
    }
    return [...new Set(moves)]
  }
  const orthogonal = [[1,0],[-1,0],[0,1],[0,-1]]
  const diagonal = [[1,1],[1,-1],[-1,1],[-1,-1]]
  if (piece.type === 'R') return visualRayMoves(state, from, orthogonal, piece.player)
  if (piece.type === 'B') return visualRayMoves(state, from, diagonal, piece.player)
  if (piece.type === 'Q') return visualRayMoves(state, from, [...orthogonal, ...diagonal], piece.player)
  if (piece.type === 'K') {
    return [...orthogonal, ...diagonal].flatMap(([dr,df]) => {
      const target = visualStep(state, from, dr, df)?.cell
      const targets = target ? [target] : Math.abs(dr) === 1 && Math.abs(df) === 1 ? visualCornerSteps(state, from, dr, df).map(step => step.cell) : []
      return targets.filter(candidate => state.pieces.get(candidate.id)?.player !== piece.player).map(candidate => candidate.id)
    })
  }
  if (piece.type === 'N') {
    return visualKnightMoves(state, from, piece.player)
  }
  return []
}

export function applyThreePlayerMove(state, fromId, toId, promoteTo = 'Q') {
  if (!legalThreePlayerMoves(state, fromId).includes(toId)) return false
  const piece = state.pieces.get(fromId)
  const to = state.board.byId.get(toId)
  const captured = state.pieces.get(toId) || null
  state.pieces.delete(fromId)
  state.pieces.delete(toId)
  const promoted = piece.type === 'P' && to.visualRow === 0 && to.visualTerritory !== piece.player
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
  const pointAt = (row, file) => {
    const left = cell.sector % 2 === 0
    const reference = REFERENCE_GRID[row][left ? 4 - file : file]
    const x = left ? -reference[0] : reference[0], y = reference[1]
    const angle = cell.visualTerritory === 0 ? 0 : cell.visualTerritory === 1 ? 2 * Math.PI / 3 : -2 * Math.PI / 3
    return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]
  }
  const row = cell.visualRow
  const file = cell.file
  return [pointAt(row,file), pointAt(row+1,file), pointAt(row+1,file+1), pointAt(row,file+1)]
}

function visualStep(state, cell, dr, df) {
  const row = cell.visualRow + dr, file = cell.visualFile + df
  const inside = state.board.byVisual.get(`${cell.visualTerritory}:${row}:${file}`)
  if (inside) return { cell:inside, dr, df }
  if (Math.abs(dr) + Math.abs(df) !== 1) return null
  const edge = dr > 0 ? 1 : dr < 0 ? 3 : df > 0 ? 2 : 0
  const crossing = state.board.edgeNeighbors.get(`${cell.id}:${edge}`)
  if (!crossing) return null
  const next = state.board.byId.get(crossing.id)
  const inward = [[0,1],[-1,0],[0,-1],[1,0]][crossing.edge]
  return { cell:next, dr:inward[0], df:inward[1] }
}

function visualRayMoves(state, from, directions, player) {
  const moves = []
  for (const [initialDr, initialDf] of directions) {
    const trace = (current, dr, df, depth, path) => {
      if (depth >= 24) return
      const next = visualStep(state, current, dr, df)
      const candidates = next ? [next] : Math.abs(dr) === 1 && Math.abs(df) === 1
        ? visualCornerSteps(state, current, dr, df)
        : []
      for (const candidate of candidates) {
        const key = `${candidate.cell.id}:${candidate.dr}:${candidate.df}`
        if (path.has(key)) continue
        const occupant = state.pieces.get(candidate.cell.id)
        if (occupant?.player === player) continue
        moves.push(candidate.cell.id)
        if (occupant) continue
        trace(candidate.cell, candidate.dr, candidate.df, depth + 1, new Set([...path, key]))
      }
    }
    trace(from, initialDr, initialDf, 0, new Set())
  }
  return [...new Set(moves)]
}

function visualKnightMoves(state, from, player) {
  const moves = new Set()
  // Trace the board's files/ranks to transport the L-shaped jump across a
  // seam. Intermediate squares are deliberately not checked for occupants.
  for (const [dr, df] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    for (const longLegFirst of [true, false]) {
      const firstLength = longLegFirst ? 2 : 1
      const secondLength = longLegFirst ? 1 : 2
      let first = { cell:from, dr, df }
      for (let step = 0; step < firstLength && first; step++) first = visualStep(state, first.cell, first.dr, first.df)
      if (!first) continue
      for (const turn of [-1, 1]) {
        let second = { cell:first.cell, dr:-first.df * turn, df:first.dr * turn }
        for (let step = 0; step < secondLength && second; step++) second = visualStep(state, second.cell, second.dr, second.df)
        if (second && second.cell.id !== from.id && state.pieces.get(second.cell.id)?.player !== player) moves.add(second.cell.id)
      }
    }
  }
  return [...moves]
}

function visualCornerSteps(state, cell, dr, df) {
  const polygon = threePlayerCellPolygon(cell)
  const corner = dr > 0 ? (df > 0 ? 2 : 1) : (df > 0 ? 3 : 0)
  const key = visualPointKey(polygon[corner])
  const inwardByCorner = [[1,1],[-1,1],[-1,-1],[1,-1]]
  const edgeNeighbors = new Set([0,1,2,3].map(edge => state.board.edgeNeighbors.get(`${cell.id}:${edge}`)?.id))
  return (state.board.vertexNeighbors.get(key) || [])
    .filter(entry => {
      const target = state.board.byId.get(entry.id)
      return target.id !== cell.id && target.visualTerritory !== cell.visualTerritory &&
        !edgeNeighbors.has(target.id) && target.shade === cell.shade
    })
    .map(entry => ({ cell:state.board.byId.get(entry.id), dr:inwardByCorner[entry.corner][0], df:inwardByCorner[entry.corner][1] }))
}

const visualPointKey = point => point.map(value => Math.round(value * 10) / 10).join(',')

export const THREE_PLAYER_COLORS = Object.freeze([...COLORS])
export const THREE_PLAYER_NAMES = Object.freeze(['White', 'Black', 'Red'])
export const THREE_PLAYER_SYMBOLS = Object.freeze({ K:'♚', Q:'♛', R:'♜', B:'♝', N:'♞', P:'♟' })
