const FILES = 'abcdefgh'
const PROMOTIONS = new Set(['Q', 'R', 'B', 'N'])

function square(value) {
  return Array.isArray(value) && value.length === 2 && value.every(n => Number.isInteger(n) && n >= 0 && n < 8)
}

function sameSquare(a, b) {
  return a[0] === b[0] && a[1] === b[1]
}

// SAN is computed from the position before the move. Simulate on our own copy:
// voerZetUit changes both the board and castling rights in its argument.
export function schaakNotatie(Schaak, staatBefore, zet, promotieStuk = 'Q') {
  if (!Schaak || !staatBefore || !square(zet?.van) || !square(zet?.naar)) return null
  const piece = staatBefore.bord?.[zet.van[0]]?.[zet.van[1]]
  if (!piece || piece[0] !== staatBefore.aanZet) return null
  const legal = Schaak.legaleZetten(staatBefore, ...zet.van).find(move => sameSquare(move.naar, zet.naar) && (!zet.type || move.type === zet.type))
  if (!legal) return null

  const type = piece[1]
  const promotion = type === 'P' && (legal.naar[0] === 0 || legal.naar[0] === 7)
  if (promotion && !PROMOTIONS.has(promotieStuk)) return null
  let notation
  if (legal.type === 'rokade-kort') notation = 'O-O'
  else if (legal.type === 'rokade-lang') notation = 'O-O-O'
  else {
    const capture = Boolean(staatBefore.bord[legal.naar[0]][legal.naar[1]]) || legal.type === 'enpassant'
    let prefix = type === 'P' ? (capture ? FILES[legal.van[1]] : '') : type
    if (type !== 'P' && type !== 'K') {
      const rivals = Schaak.alleLegaleZetten(staatBefore, piece[0]).filter(move =>
        !sameSquare(move.van, legal.van) && sameSquare(move.naar, legal.naar) &&
        staatBefore.bord[move.van[0]][move.van[1]] === piece)
      if (rivals.length) {
        const sameFile = rivals.some(move => move.van[1] === legal.van[1])
        const sameRank = rivals.some(move => move.van[0] === legal.van[0])
        prefix += !sameFile ? FILES[legal.van[1]] : !sameRank ? String(8 - legal.van[0]) : FILES[legal.van[1]] + (8 - legal.van[0])
      }
    }
    notation = prefix + (capture ? 'x' : '') + FILES[legal.naar[1]] + (8 - legal.naar[0]) + (promotion ? '=' + promotieStuk : '')
  }

  const after = { ...staatBefore, bord:staatBefore.bord.map(row => row.slice()), rokade:{ ...staatBefore.rokade } }
  Schaak.voerZetUit(after, legal, promotieStuk)
  if (Schaak.staatInSchaak(after, after.aanZet)) notation += Schaak.isSchaakmat(after, after.aanZet) ? '#' : '+'
  return notation
}

function normaliseEvaluation(payload) {
  if (!payload || !Number.isSafeInteger(payload.ply) || payload.ply < 0 || typeof payload.final !== 'boolean') return null
  if (typeof payload.fen !== 'string' || /[\r\n]/.test(payload.fen)) return null
  const fen = payload.fen.trim().replace(/\s+/g, ' ')
  const fields = fen.split(' ')
  if (fields.length !== 6 || !['w', 'b'].includes(fields[1])) return null
  const rows = fields[0].split('/')
  if (rows.length !== 8 || rows.some(row => !/^[prnbqkPRNBQK1-8]+$/.test(row) || [...row].reduce((width, symbol) => width + (/\d/.test(symbol) ? Number(symbol) : 1), 0) !== 8)) return null
  if (!/^(?:-|K?Q?k?q?)$/.test(fields[2]) || !/^(?:-|[a-h][36])$/.test(fields[3]) || !/^\d+$/.test(fields[4]) || !/^[1-9]\d*$/.test(fields[5])) return null

  const hasCp = payload.cp !== null && payload.cp !== undefined
  const hasMate = payload.mate !== null && payload.mate !== undefined
  if (hasCp === hasMate) return null
  if (hasCp && (!Number.isFinite(payload.cp) || Math.abs(payload.cp) > Number.MAX_SAFE_INTEGER)) return null
  if (hasMate && !Number.isSafeInteger(payload.mate)) return null
  const cp = hasCp ? payload.cp : null
  const mate = hasMate ? payload.mate : null
  // A terminal mate belongs to the side opposite the FEN player to move.
  // Use the FEN because JSON transport does not preserve a negative zero.
  const score = mate === null ? cp : (mate === 0 ? (fields[1] === 'w' ? -1 : 1) : Math.sign(mate)) * 10000
  const whiteShare = mate === null ? 50 + 46 * Math.tanh(cp / 600) : score > 0 ? 98 : 2
  return { ply:payload.ply, fen, cp, mate, final:payload.final, score, whiteShare }
}

// One position is one ply, regardless of how many Stockfish info messages it
// produces. Only the first final score commits the baseline for the next ply.
export function maakUltraEvaluatieHistorie() {
  const finals = new Map()
  let latestPly = -1, latestFen = null, snapshot = null
  const copy = value => value ? { ...value } : null

  function update(payload) {
    const value = normaliseEvaluation(payload)
    if (!value || value.ply < latestPly || (value.ply === latestPly && value.fen !== latestFen)) return null
    if (value.ply > latestPly) { latestPly = value.ply; latestFen = value.fen }

    // Re-enabling the display can replay the same final score. It must neither
    // change a committed position nor emit the new-final/audio marker again.
    if (finals.has(value.ply)) {
      snapshot = { ...snapshot, isNewFinal:false }
      return copy(snapshot)
    }
    const previous = finals.get(value.ply - 1)
    const deltaCp = previous ? value.score - previous.score : null
    snapshot = {
      ply:value.ply, fen:value.fen, cp:value.cp, mate:value.mate, final:value.final,
      previousCp:previous?.cp ?? null,
      previousMate:previous?.mate ?? null,
      deltaCp,
      whiteShare:value.whiteShare,
      previousWhiteShare:previous?.whiteShare ?? null,
      direction:deltaCp === null ? null : deltaCp > 0 ? 'gain' : deltaCp < 0 ? 'loss' : 'equal',
      magnitude:deltaCp === null ? null : Math.abs(deltaCp) >= 150 ? 'large' : Math.abs(deltaCp) >= 50 ? 'medium' : 'small',
      isNewFinal:value.final,
    }
    if (value.final) finals.set(value.ply, value)
    return copy(snapshot)
  }

  return {
    update,
    reset() { finals.clear(); latestPly = -1; latestFen = null; snapshot = null },
    getSnapshot() { return snapshot ? { ...snapshot, isNewFinal:false } : null },
  }
}
