import assert from 'node:assert/strict'
import { berekenLeesbareWaaier } from '../../kaartwaaier.js'

const raakt = (a,b) => a.l < b.r - .001 && a.r > b.l + .001 && a.t < b.b - .001 && a.b > b.t + .001
let gevallen = 0
for (const [breedte,hoogte] of [[320,568],[390,844],[768,700],[1280,720]]) {
  for (const groot of [false,true]) {
    const f = groot ? 1.25 : 1
    const kw = Math.round(Math.max(54*f,Math.min(96*f,breedte*.21*f,hoogte*.125*f))), kh = Math.round(kw*1.4)
    for (let masker=0;masker<256;masker++) for(let loep=-1;loep<8;loep++) {
      const selectie=Array.from({length:8},(_,i)=>i).filter(i=>masker&(1<<i))
      const plan=berekenLeesbareWaaier({breedte,kw,kh,aantal:8,selectie,loep})
      if(!masker&&loep<0){assert.equal(plan,null);continue}
      assert.equal(plan.kaarten.length,8)
      assert.ok(plan.rijen<=2,'een Koningsjacht-hand past in maximaal twee rijen')
      const dozen=plan.kaarten.map(k=>({l:k.x-(k.schaal-1)*kw/2,r:k.x+kw+(k.schaal-1)*kw/2,t:k.y-(k.schaal-1)*kh/2,b:k.y+kh+(k.schaal-1)*kh/2}))
      plan.kaarten.forEach((k,i)=>{
        assert.ok([k.x,k.y,k.r,k.schaal,k.z,k.stap,plan.hoogte].every(Number.isFinite))
        assert.equal(k.schaal,i===loep?1.4:selectie.includes(i)?1.25:1,'vergrootfactoren blijven behouden')
        assert.ok(dozen[i].l>=7.99 && dozen[i].r<=breedte-7.99,'vergrote kaart blijft binnen de tafel')
        assert.ok(dozen[i].b<=plan.hoogte,'de hand reserveert voldoende hoogte')
        const hoek={l:dozen[i].l+kw*k.schaal*7/250,r:dozen[i].l+kw*k.schaal*53/250,t:dozen[i].t+kh*k.schaal*9/350,b:dozen[i].t+kh*k.schaal*107/350}
        plan.kaarten.forEach((ander,j)=>{if(ander.z>k.z)assert.ok(!raakt(hoek,dozen[j]),`hoek ${i} afgedekt door ${j}, breedte ${breedte}, groot ${groot}, selectie ${masker}, loep ${loep}`)})
      })
      gevallen++
    }
  }
}
assert.equal(berekenLeesbareWaaier({breedte:390,kw:80,kh:112,aantal:0,selectie:[0]}),null)
assert.equal(berekenLeesbareWaaier({breedte:NaN,kw:80,kh:112,aantal:8,selectie:[0]}),null)
const voorbeeld=berekenLeesbareWaaier({breedte:390,kw:82,kh:115,aantal:8,selectie:[4,6]})
assert.ok(voorbeeld.kaarten[5],'schoppen 5 blijft in de hand tussen beide geselecteerde harten')
assert.deepEqual(voorbeeld.kaarten.map(k=>k.i),[0,1,2,3,4,5,6,7],'logische handvolgorde blijft intact')
console.log(`Leesbare waaier: ${gevallen} selecties/loepen, vier schermmaten, gewone en grote kaarten; alle waarde- en soorthoeken vrij`)
