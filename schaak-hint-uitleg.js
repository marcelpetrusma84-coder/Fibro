import { schaakFen } from './schaak-ultra-engine.js?v=1'

const values = { P:1, N:3, B:3, R:5, Q:9, K:0 }
const coordinate = square => 'abcdefgh'[square[1]] + (8 - square[0])
const validSquare = square => Array.isArray(square) && square.length === 2 && square.every(n => Number.isInteger(n) && n >= 0 && n < 8)
const sameSquare = (a,b) => a[0] === b[0] && a[1] === b[1]
const copy = state => ({ ...state, bord:state.bord.map(row=>row.slice()), rokade:{ ...state.rokade } })
const positionKey = fen => typeof fen === 'string' ? fen.trim().split(/\s+/).slice(0,4).join(' ') : null

// Explain only facts that the current legal position proves. Engine scores are
// not material gains, and a discovered attack is never a promised capture.
export function beschrijfUltraHint({ Schaak, staat, zet, promotieStuk, evaluation } = {}) {
  if (!['legaleZetten','voerZetUit','staatInSchaak','isSchaakmat','alleLegaleZetten'].every(name=>typeof Schaak?.[name] === 'function') ||
      !['w','z'].includes(staat?.aanZet) || !Array.isArray(staat.bord) || staat.bord.length !== 8 ||
      !staat.bord.every(row=>Array.isArray(row) && row.length === 8 && row.every(piece=>piece == null || (typeof piece === 'string' && /^[wz][PNBRQK]$/.test(piece)))) ||
      !validSquare(zet?.van) || !validSquare(zet?.naar)) return null
  const pieces = staat.bord.flat()
  if (pieces.filter(piece=>piece === 'wK').length !== 1 || pieces.filter(piece=>piece === 'zK').length !== 1) return null
  const piece = staat.bord[zet.van[0]][zet.van[1]], color = staat.aanZet, opponent = color === 'w' ? 'z' : 'w'
  if (!piece || piece[0] !== color || staat.bord[zet.naar[0]][zet.naar[1]]?.[1] === 'K') return null
  if (promotieStuk !== undefined && !['Q','R','B','N'].includes(promotieStuk)) return null
  try {
    if (evaluation?.fen !== undefined && positionKey(evaluation.fen) !== positionKey(schaakFen(staat))) return null
    const move = Schaak.legaleZetten(staat,...zet.van).find(candidate=>sameSquare(candidate.van,zet.van) && sameSquare(candidate.naar,zet.naar) && (zet.type === undefined || candidate.type === zet.type))
    if (!move) return null
    const promotion = piece[1] === 'P' && (move.naar[0] === 0 || move.naar[0] === 7) ? promotieStuk || 'Q' : null
    const captureAt = move.type === 'enpassant' ? [move.van[0],move.naar[1]] : move.naar
    const victim = staat.bord[captureAt[0]][captureAt[1]]
    const captured = victim?.[0] === opponent && victim[1] !== 'K' ? { piece:victim, at:captureAt.slice(), points:values[victim[1]] } : null
    const wasChecked = Schaak.staatInSchaak(staat,color), after = copy(staat)
    Schaak.voerZetUit(after,move,promotion || 'Q')
    if (Schaak.staatInSchaak(after,color)) return null
    const result = {
      verified:true, from:move.van.slice(), to:move.naar.slice(), piece,
      ...(promotion ? { promotieStuk:promotion } : {}),
      moveLabel:coordinate(move.van) + ' → ' + coordinate(move.naar) + (promotion ? ' = ' + promotion : ''),
      reasons:[], motifs:[], ...(captured ? { capture:captured } : {}),
    }
    const add = (motif,key,values = {}) => { result.motifs.push(motif); result.reasons.push({ key, values }) }
    const finish = () => ({ ...result, reasons:result.reasons.slice(0,4), motifs:result.motifs.slice(0,4) })
    if (Schaak.isSchaakmat(after,opponent)) {
      add('mate','Deze zet zet de koning van de tegenstander schaakmat.')
      return finish()
    }
    if (wasChecked) add('escape-check','Je heft het schaak op je eigen koning op.')
    if (promotion) add('promotion','Je pion promoveert op {veld} en krijgt de kracht van het gekozen promotiestuk.',{veld:coordinate(move.naar)})
    if (captured) add('capture','Je slaat het stuk op {veld}. De materiaalwaarde van dat stuk is {punten}.',{veld:coordinate(captured.at),punten:captured.points})
    const checking = Schaak.staatInSchaak(after,opponent)
    if (checking) add('check','Je zet de koning van de tegenstander schaak.')
    if (move.type === 'rokade-kort' || move.type === 'rokade-lang') add('castling','Met de rokade breng je de koning uit het centrum.')
    const legalDestinations = (position,square) => Schaak.legaleZetten(position,...square).filter(candidate=>position.bord[candidate.naar[0]][candidate.naar[1]]?.[1] !== 'K')
    const attacks = (position,square) => legalDestinations(position,square).filter(candidate=>position.bord[candidate.naar[0]][candidate.naar[1]]?.[0] === opponent)
    const targets = attacks(after,move.naar).filter(candidate=>values[after.bord[candidate.naar[0]][candidate.naar[1]][1]] >= 3)
    if (targets.length >= 2) {
      add('fork','Vanaf {veld} valt dit stuk tegelijk {n} vijandelijke stukken aan: {doelen}.',{veld:coordinate(move.naar),n:targets.length,doelen:targets.map(candidate=>coordinate(candidate.naar)).join(', ')})
    } else if (targets.length === 1) {
      const target=targets[0], oldTargets=attacks(staat,move.van)
      if (values[after.bord[target.naar[0]][target.naar[1]][1]] > values[after.bord[move.naar[0]][move.naar[1]][1]] && !oldTargets.some(candidate=>sameSquare(candidate.naar,target.naar))) {
        add('attack','Vanaf {veld} valt dit stuk een waardevoller vijandelijk stuk op {doel} aan.',{veld:coordinate(move.naar),doel:coordinate(target.naar)})
      }
    }
    if (captured && Schaak.alleLegaleZetten(after,opponent).some(reply=>sameSquare(reply.naar,move.naar))) {
      add('recapture','De tegenstander kan je stuk daarna direct terugslaan op {veld}.',{veld:coordinate(move.naar)})
    }
    if (!result.reasons.length && ['B','N'].includes(piece[1]) && move.van[0] === (color === 'w' ? 7 : 0) && move.naar[0] !== move.van[0]) {
      add('development','Je brengt een loper of paard van de achterste rij het spel in.')
    }
    if (!result.reasons.length && [3,4].includes(move.naar[0]) && [3,4].includes(move.naar[1])) add('centre','Je bezet een centraal veld: {veld}.',{veld:coordinate(move.naar)})
    if (!result.reasons.length) {
      const beforeCount=new Set(legalDestinations(staat,move.van).map(candidate=>coordinate(candidate.naar))).size
      const afterCount=new Set(legalDestinations(after,move.naar).map(candidate=>coordinate(candidate.naar))).size
      if (afterCount > beforeCount) add('mobility','Het directe bereik van dit stuk groeit van {voor} naar {na} legale bestemmingen.',{voor:beforeCount,na:afterCount})
    }
    if (!result.reasons.length) {
      const searched = ['stockfish','lichess'].includes(evaluation?.source) && Number.isSafeInteger(evaluation?.depth) && evaluation.depth > 0
      add(searched ? 'engine' : 'legal',searched ? 'De engine kiest dit als de beste onderzochte voortzetting; er is geen direct tactisch motief vastgesteld.' : 'Deze voortzetting is legaal; er is geen direct tactisch motief vastgesteld.')
    }
    return finish()
  } catch { return null }
}
