import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createThreePlayerBoard, newThreePlayerGame, threePlayerCellPolygon, THREE_PLAYER_NAMES } from '../../schaak-drie.js'
import { THREE_PLAYER_VIEWBOX, THREE_PLAYER_BOARD_ARTWORK, threePlayerPieceArtwork } from '../../schaak-drie-artwork.js'

const source = await readFile(new URL('../../assets/chess-three/board.svg', import.meta.url), 'utf8')
assert.equal(THREE_PLAYER_VIEWBOX, '-458 -396 916 792')
assert(THREE_PLAYER_BOARD_ARTWORK.endsWith('/assets/chess-three/board.svg'))
assert(source.includes('Uray M.'))
assert(!source.includes('<!DOCTYPE'), 'runtime artwork has no external DTD dependency')

const pointSet = points => points.map(point => point.map(value => Number(value.toFixed(2))).join(',')).sort().join('|')
const bottomSource = source.match(/<g>([\s\S]*?)<\/g>/)[1]
const whiteSourceCells = [...bottomSource.matchAll(/<polygon fill="#FFF" points="([^"]+)"/g)].map(match => {
  const values = match[1].match(/[+-]?\d*\.?\d+/g).map(Number)
  return pointSet(Array.from({length:4}, (_, index) => values.slice(index * 2, index * 2 + 2)))
})
assert.equal(whiteSourceCells.length, 16)
const board = createThreePlayerBoard()
const whiteHitCells = new Set(board.cells.filter(cell => cell.visualTerritory === 0 && !cell.shade).map(cell => pointSet(threePlayerCellPolygon(cell))))
for (const polygon of whiteSourceCells) {
  assert(whiteHitCells.has(polygon), 'interactive hit cells use the original hand-shaped field coordinates')
}

const game = newThreePlayerGame()
assert.deepEqual(THREE_PLAYER_NAMES, ['White','Black','Red'])
for (const [id, piece] of game.pieces) {
  const markup = threePlayerPieceArtwork(piece, threePlayerCellPolygon(board.byId.get(id)))
  assert(markup.startsWith('<image '), 'pieces use the original vector drawings rather than a font glyph')
  assert(!markup.includes('<text'))
  const file = markup.match(/href="([^"]+)"/)[1]
  const svg = await readFile(new URL(file), 'utf8')
  assert(svg.includes('viewBox="0 0 45 45"'))
  if (piece.color === 'red') assert(svg.includes('fill="#F66"'))
  if (piece.color === 'white') assert(svg.includes('fill="#FFF"'))
}
console.log('Three-player reference artwork tests passed')
