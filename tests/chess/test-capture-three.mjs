import assert from 'node:assert/strict'
import { drieSlagEffect } from '../../schaken-drie-ui.js'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { newThreePlayerGame, legalThreePlayerMoves, applyThreePlayerMove } from '../../schaak-drie.js'

for(const [type,value] of [['P',1],['N',3],['B',3],['R',5],['Q',9],['K',9]]) {
  for(const mover of [0,1,2]) for(const victim of [0,1,2].filter(player=>player!==mover)) {
    assert.deepEqual(drieSlagEffect({type,player:victim},mover,mover),{value,outcome:'win'})
    assert.deepEqual(drieSlagEffect({type,player:victim},mover,victim),{value,outcome:'loss'})
    const spectator=[0,1,2].find(player=>player!==victim&&player!==mover)
    assert.equal(drieSlagEffect({type,player:victim},mover,spectator),null,'the two other opponents capturing one another is neutral')
  }
}
assert.equal(drieSlagEffect(null,0,0),null)
assert.equal(drieSlagEffect({type:'Q',player:0},0,0),null)
assert.equal(drieSlagEffect({type:'Q',player:1},0,-1),null)

// Exercise the actual receive path with a legal remote capture. Replayed or
// invalid packets must not play the same effect twice.
const source=readFileSync(new URL('../../schaken-drie-ui.js',import.meta.url),'utf8')
const handlers=['playMoveSound','receiveMove'].map(name=>{
  const match=source.match(new RegExp('  function '+name+'\\([\\s\\S]*?\\n  \\}'))
  assert.ok(match,name+' exists');return match[0]
}).join('\n')
for(const viewer of [0,2]) {
  const state=newThreePlayerGame();state.pieces.clear();state.turn=1
  const from=state.board.cells[0].id
  state.pieces.set(from,{type:'R',player:1})
  const to=legalThreePlayerMoves(state,from)[0]
  state.pieces.set(to,{type:'Q',player:0})
  const effects=[]
  const roster=[{id:'white'},{id:'black'},{id:'red'}]
  const context=vm.createContext({state,myPlayer:viewer,roster,userId:roster[viewer].id,localPreview:false,drieSlagEffect,applyThreePlayerMove,
    localStorage:{getItem:()=>'{"soundTheme":"wood"}'},
    Bordgeluid:{capturePiece:effect=>effects.push({...effect}),previewSchaakGeluid:theme=>effects.push({neutral:true,theme})},draw(){}})
  vm.runInContext('let selected=null,highlighted=[];'+handlers+'\nglobalThis.receive=receiveMove',context)
  const payload={variant:'schaken-drie',ply:0,actor:'black',from,to}
  context.receive({payload})
  assert.equal(state.ply,1)
  assert.deepEqual(effects,viewer===0?[{value:9,outcome:'loss',theme:'wood'}]:[{neutral:true,theme:'wood'}])
  context.receive({payload})
  context.receive({payload:{...payload,ply:1,actor:'red',from:'invalid'}})
  assert.equal(effects.length,1,'duplicate or invalid moves cannot replay capture audio')
}
console.log('PASS: three perspectives, piece weights, king elimination, neutral captures, legal remote moves and duplicate-packet rejection.')
