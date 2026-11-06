import assert from 'node:assert/strict'
import * as Schaak from '../../schaak.js'
import { schaakFen, uciNaarZet } from '../../schaak-ultra-engine.js'
import { beschrijfUltraHint } from '../../schaak-hint-uitleg.js'

const at = field => [8-Number(field[1]),field.charCodeAt(0)-97]
function position(pieces, extra = {}) {
  const state = Schaak.nieuweSpelStaat()
  state.bord = Array.from({length:8},()=>Array(8).fill(null))
  state.rokade = { wK:false,wQ:false,zK:false,zQ:false }
  for(const [field,piece] of Object.entries(pieces)){const [r,k]=at(field);state.bord[r][k]=piece}
  return {...state,...extra}
}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
function explain(state,uci,evaluation){
  const choice=uciNaarZet(Schaak,state,uci)
  assert(choice,'the fixture uses a genuinely legal move: '+uci)
  const before=structuredClone(state),move=structuredClone(choice.zet)
  const result=beschrijfUltraHint({Schaak,staat:freeze(state),zet:freeze(move),promotieStuk:choice.promotieStuk,evaluation})
  assert(result,'a current legal move has a verified explanation: '+uci)
  assert.equal(result.verified,true);assert.deepEqual(result.from,choice.zet.van);assert.deepEqual(result.to,choice.zet.naar)
  assert.deepEqual(state,before,'explaining a move never changes pieces, turn, castling, en-passant or counters')
  assert.deepEqual(move,choice.zet,'the caller move is not rewritten')
  assert(result.reasons.length>0&&result.reasons.length<=4)
  assert.equal(result.reasons.length,result.motifs.length)
  for(const reason of result.reasons){assert.equal(typeof reason.key,'string');for(const value of Object.values(reason.values))assert(['number','string'].includes(typeof value),'reason values remain safe language-neutral data')}
  return result
}
function reason(result,motif){return result.reasons[result.motifs.indexOf(motif)]}

// Actual mate and check are proved from the resulting board, never guessed
// from a positive centipawn score or a candidate line from another position.
{
  const result=explain(position({f6:'wK',g6:'wQ',h8:'zK'}),'g6g7')
  assert.deepEqual(result.motifs,['mate']);assert.match(result.reasons[0].key,/schaakmat/)
  assert.equal(result.moveLabel,'g6 → g7')
}
{
  const result=explain(position({g1:'wK',a1:'wR',h8:'zK'}),'a1a8')
  assert(result.motifs.includes('check'));assert(!result.motifs.includes('mate'))
}
{
  const result=explain(position({e1:'wK',e8:'zR',a8:'zK'}),'e1f1')
  assert(result.motifs.includes('escape-check'))
}

// Capturing value means the actual victim's gross value. A legal immediate
// recapture is explained separately instead of being called a guaranteed gain.
{
  const result=explain(position({g1:'wK',d1:'wR',d5:'zQ',d8:'zR',h8:'zK'}),'d1d5')
  assert.equal(result.capture.piece,'zQ');assert.equal(result.capture.points,9);assert.deepEqual(result.capture.at,at('d5'))
  assert.deepEqual(reason(result,'capture').values,{veld:'d5',punten:9})
  assert(result.motifs.includes('recapture'))
  assert(result.reasons.every(item=>!/winst|gewonnen|zeker|gegarandeerd/.test(item.key)))
}
{
  const result=explain(position({a1:'wK',e5:'wP',d5:'zP',h8:'zK'},{enPassantKolom:3}),'e5d6')
  assert.deepEqual(result.capture.at,at('d5'));assert.equal(result.capture.points,1)
  assert.equal(reason(result,'capture').values.veld,'d5','en-passant explains the captured pawn square, not the empty destination')
}

// The chosen promotion is retained, including underpromotion. Castling is
// explained only when it is the genuine legal special move.
{
  const result=explain(position({a1:'wK',a7:'wP',h8:'zK'}),'a7a8n')
  assert.equal(result.promotieStuk,'N');assert.equal(result.moveLabel,'a7 → a8 = N')
  assert(result.motifs.includes('promotion'));assert(!result.motifs.includes('mate'))
}
{
  const result=explain(position({e1:'wK',h1:'wR',e8:'zK'},{rokade:{wK:true,wQ:false,zK:false,zQ:false}}),'e1g1')
  assert(result.motifs.includes('castling'))
  assert(!('promotieStuk' in result),'ordinary moves do not acquire a promotion label')
}

// Forks and newly attacked valuable pieces require real legal captures from
// the moved piece. They describe threats, not an assumed opponent response.
{
  const result=explain(position({a1:'wK',c3:'wN',d6:'zQ',f6:'zR',h8:'zK'}),'c3e4')
  const fork=reason(result,'fork')
  assert(fork);assert.equal(fork.values.n,2);assert.equal(fork.values.veld,'e4')
  assert.deepEqual(new Set(fork.values.doelen.split(', ')),new Set(['d6','f6']))
  assert(!result.reasons.some(item=>/wint/.test(item.key)))
}
{
  const result=explain(position({a1:'wK',c3:'wN',d6:'zQ',h8:'zK'}),'c3e4')
  assert.equal(reason(result,'attack').values.doel,'d6');assert(!result.motifs.includes('fork'))
}

// Quiet moves get observable positional facts. Unproved tactics are never
// invented just because an engine evaluation is large or favourable.
{
  assert(explain(Schaak.nieuweSpelStaat(),'g1f3').motifs.includes('development'))
  assert(explain(Schaak.nieuweSpelStaat(),'e2e4').motifs.includes('centre'))
  const result=explain(position({a1:'wK',a3:'wN',h8:'zK'}),'a3c4')
  assert(result.motifs.includes('mobility'));assert(reason(result,'mobility').values.na>reason(result,'mobility').values.voor)
}
{
  const state=position({g1:'wK',h8:'zK'})
  const generic=explain(structuredClone(state),'g1h1',{cp:9000,mate:2,source:'unknown',depth:25})
  assert.deepEqual(generic.motifs,['legal'],'a score is not proof of a local tactic or a real engine recommendation')
  const searched=explain(structuredClone(state),'g1h1',{cp:null,mate:2,source:'stockfish',depth:24,fen:schaakFen(state,12)})
  assert.deepEqual(searched.motifs,['engine']);assert.match(searched.reasons[0].key,/onderzochte/)
  assert(!searched.motifs.includes('mate'),'engine mate distance does not replace board proof')
}

// Illegal, stale or malformed input produces no explanation and cannot alter
// the live game. Opposing moves and king captures are not accepted as hints.
{
  const state=Schaak.nieuweSpelStaat(),before=structuredClone(state)
  const legal=uciNaarZet(Schaak,state,'e2e4').zet
  const other=structuredClone(state);other.bord[1][7]=null
  for(const args of [
    {},{Schaak,staat:state,zet:{van:at('e2'),naar:at('e5')}},
    {Schaak,staat:state,zet:{...legal,type:'invented'}},
    {Schaak,staat:state,zet:{van:at('e7'),naar:at('e5'),type:'dubbelzet'}},
    {Schaak,staat:state,zet:legal,evaluation:{fen:schaakFen(other)}},
    {Schaak,staat:state,zet:legal,evaluation:{fen:null}},
    {Schaak,staat:state,zet:{van:[6,4.1],naar:[4,4]}},
    {Schaak,staat:{...state,bord:[]},zet:legal},
    {Schaak,staat:state,zet:legal,promotieStuk:'K'},
  ])assert.equal(beschrijfUltraHint(args),null)
  assert.deepEqual(state,before)
  const pinned=position({e1:'wK',e2:'wN',e8:'zR',h8:'zK'})
  assert.equal(beschrijfUltraHint({Schaak,staat:pinned,zet:{van:at('e2'),naar:at('c3')}}),null,'a pinned knight does not create an invented fork')
  const kingTarget=position({e1:'wK',e7:'wR',e8:'zK'})
  assert.equal(beschrijfUltraHint({Schaak,staat:kingTarget,zet:{van:at('e7'),naar:at('e8')}}),null,'a king is never a capturable material target')
}
console.log('PASS: legal immutable Ultra hint explanations, proven mate/check/escape, gross captures and recaptures, en-passant, underpromotion, castling, real forks, quiet positional facts and stale/illegal rejection.')
