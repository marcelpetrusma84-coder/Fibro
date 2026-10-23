import assert from 'node:assert/strict'
import * as S from '../../schaak.js'
import { registreerSlag, veroverdePunten, stukSVG } from '../../schaak-stukken.js'
function zet(s,van,naar,score,promotie) {
  const z=S.legaleZetten(s,...van).find(z=>z.naar[0]===naar[0]&&z.naar[1]===naar[1])
  assert(z);registreerSlag(s,z,score);S.voerZetUit(s,z,promotie)
}
let s=S.nieuweSpelStaat(),score={w:[],z:[]}
zet(s,[6,4],[4,4],score);zet(s,[1,3],[3,3],score);zet(s,[4,4],[3,3],score);zet(s,[0,3],[3,3],score)
assert.deepEqual(score,{w:['zP'],z:['wP']});assert.equal(veroverdePunten(score.w),1)
s=S.nieuweSpelStaat();score={w:[],z:[]}
for(const [a,b] of [[[6,4],[4,4]],[[1,0],[2,0]],[[4,4],[3,4]],[[1,3],[3,3]],[[3,4],[2,3]]])zet(s,a,b,score)
assert.deepEqual(score,{w:['zP'],z:[]});assert.equal(s.bord[3][3],null)
s=S.nieuweSpelStaat();s.bord=Array.from({length:8},()=>Array(8).fill(null));s.bord[7][4]='wK';s.bord[0][4]='zK';s.bord[1][0]='wP';s.bord[0][1]='zR';score={w:[],z:[]}
zet(s,[1,0],[0,1],score,'N');assert.equal(s.bord[0][1],'wN');assert.deepEqual(score.w,['zR']);assert.equal(veroverdePunten(score.w),5)
assert.equal(veroverdePunten(['zP','zN','zB','zR','zQ']),21)
for(const kleur of ['w','z']) for(const type of ['P','N','B','R','Q','K'])assert(stukSVG(kleur+type).includes('<svg'))
console.log('PASS: captures for both players; en passant; capture with promotion; points; all vector pieces')
