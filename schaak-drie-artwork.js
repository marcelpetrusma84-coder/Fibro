// Original board and modified Wikipedia pieces: Uray M. János / Green Chess,
// CC BY-SA 3.0. See assets/chess-three/README.md for sources and attribution.
export const THREE_PLAYER_VIEWBOX = '-458 -396 916 792'
export const THREE_PLAYER_BOARD_ARTWORK = new URL('./assets/chess-three/board.svg', import.meta.url).href

const PIECE_FILES = Object.freeze({ P:'pawn', N:'knight', B:'bishop', R:'rook', Q:'queen', K:'king' })
const COLOR_FILES = Object.freeze({ white:'w', black:'b', red:'r' })

export function threePlayerPieceArtwork(piece, polygon) {
  const kind = PIECE_FILES[piece.type], colour = COLOR_FILES[piece.color]
  if (!kind || !colour) return ''
  const center = polygon.reduce((sum, point) => [sum[0] + point[0] / 4, sum[1] + point[1] / 4], [0,0])
  const size = 64
  const href = new URL(`./assets/chess-three/glass/${kind}-${colour}.svg?v=2`, import.meta.url).href
  return `<image class="chess3-piece" href="${href}" x="${center[0] - size / 2}" y="${center[1] - size / 2}" width="${size}" height="${size}" aria-hidden="true"/>`
}
