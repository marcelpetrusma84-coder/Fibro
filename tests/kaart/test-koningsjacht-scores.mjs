import assert from 'node:assert/strict'
import { maakKoningsjachtScoreService } from '../../koningsjacht-scores.js'
import { maakScorePartij } from '../../koningsjacht-score-partij.js'
import { eindsceneStand } from '../../koningsjacht-eindscene.js'
import { stapelProfiel, maakStapelFeedback } from '../../kaart-stapel-feedback.js'
const ME='10000000-0000-4000-8000-000000000001', OTHER='20000000-0000-4000-8000-000000000002'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const data=new Map(), storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}
let uid=ME,online=false,next=0
const saved=[], remote={personal:[],friends:[],global:null}
const api={auth:{getSession:async()=>({data:{session:{user:{id:uid}}}})},rpc:async(name,args)=>{
  if(name==='koningsjacht_save_score'){saved.push(args);return {error:null}}
  assert.equal(name,'koningsjacht_boards');return {data:remote}
}}
const service=maakKoningsjachtScoreService({supabase:api,storage,isOnline:()=>online,uuid:()=>id(++next),now:()=>1700000000000+next})
for(let i=0;i<15;i++) await service.saveRun({score:i%13,level:2,mode:'solo'})
let b=await service.loadBoards()
assert.equal(b.personal.length,10);assert.equal(b.personal[0].score,12);assert.equal(b.personal[0].won,true)
for(const score of [-1,13,1.5,NaN]) await assert.rejects(service.saveRun({score,level:2,mode:'solo'}))
online=true;await service.loadBoards();assert.equal(saved.length,15)
await service.loadBoards();assert.equal(saved.length,15)
await service.saveRun({id:id(90),score:8,level:3,mode:'beleg'})
await service.saveRun({id:id(90),score:12,level:3,mode:'beleg'})
b=await service.loadBoards();assert.equal(b.personal.find(r=>r.id===id(90)).score,8)
assert.equal(saved.at(-1).p_mode,'beleg')
remote.global={score:12,level:3,mode:'samen',user_id:OTHER,username:'Private',played_at:'2026-01-01T00:00:00Z'}
b=await service.loadBoards();assert.equal(b.global.name,undefined);assert.equal(b.global.playedAt,undefined)
assert.equal(b.global.mode,'samen')
uid=OTHER;assert.equal((await service.loadBoards()).personal.length,0)
assert.equal((await service.saveRun({score:5,level:1,mode:'solo',ownerId:ME})).reason,'account-changed')
uid=ME
let ids=100, finishes=[]
const fake={captureOwner:async()=>ME,saveRun:async r=>{finishes.push(r);return {persisted:true}}}
const rounds=maakScorePartij({service:fake,storage,uuid:()=>id(++ids),now:()=>1234})
rounds.begin('solo',true);await Promise.resolve()
await rounds.finish({verslagen:3,niveau:'ridder'},'solo');await rounds.finish({verslagen:4,niveau:'ridder'},'solo')
assert.equal(finishes.length,1);assert.equal(finishes[0].score,3)
rounds.begin('solo',false);await rounds.finish({verslagen:3,niveau:'ridder'},'solo')
assert.equal(finishes[0].id,finishes[1].id,'continuing a game preserves the immutable result id')
rounds.begin('solo',true);await rounds.finish({verslagen:12,niveau:'koning'},'solo')
assert.notEqual(finishes[2].id,finishes[0].id)
for(let n=0;n<=12;n++){const s=eindsceneStand(n);assert.equal(s.n,n);assert.equal(s.over,12-n);assert.ok(s.mix>=0&&s.mix<=1)}
for(let n=1;n<=6;n++){const s=eindsceneStand(n);assert.ok(s.laag<=6);assert.ok(s.hoog<=6||s.mix===0,'eerste zes wachters tonen geen opgeheven arm')}
assert.deepEqual(eindsceneStand(5),{n:5,over:7,laag:4,hoog:6,mix:.5})
assert.deepEqual(eindsceneStand(7),{n:7,over:5,laag:6,hoog:8,mix:.5})
assert.equal(eindsceneStand(99).n,12);assert.equal(eindsceneStand(-1).n,0)
assert.ok(stapelProfiel(32).hoogte>stapelProfiel(8).hoogte)
let time=0,cb
const delta={setAttribute(){},dataset:{},remove(){}}
const teller={ownerDocument:{createElement:()=>delta},parentElement:{appendChild(){}},isConnected:true}
const feedback=maakStapelFeedback({teller,label:n=>'Taveerne: '+n,rustig:()=>false,now:()=>time,raf:f=>(cb=f,1),cancel(){}})
feedback.update(8);assert.equal(teller.textContent,'Taveerne: 8')
feedback.update(16);cb(500);assert.notEqual(teller.textContent,'Taveerne: 16');assert.equal(delta.textContent,'+8')
cb(2000);assert.equal(teller.textContent,'Taveerne: 16')
time=2000;feedback.update(5);cb(2500);assert.equal(delta.textContent,'−11');assert.notEqual(teller.textContent,'Taveerne: 5')
cb(4000);assert.equal(teller.textContent,'Taveerne: 5');feedback.destroy()
console.log('OK: scores, offline retry, privacy, account changes, round identity, 13 scenes and two-way counters')
