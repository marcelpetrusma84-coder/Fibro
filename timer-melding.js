import { toonMelding } from './meldingen.js?v=29'

function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('FibroDB',2)
    r.onsuccess=e=>res(e.target.result)
    r.onerror=()=>rej()
  })
}

async function leesTimers(){
  const db=await openDB()
  return new Promise((res)=>{
    const s=db.transaction('fotos').objectStore('fotos')
    const out=[]
    const r=s.openCursor()
    r.onsuccess=e=>{
      const c=e.target.result
      if(!c){ res(out); return }
      if(String(c.key).startsWith('vriend_')&&String(c.key).endsWith('_aftel')){
        out.push({key:c.key,data:c.value?.data||null})
      }
      c.continue()
    }
    r.onerror=()=>res(out)
  })
}

export async function checkTimers(){
  let ruiw
  try{ ruiw=await leesTimers() }catch(e){ return }
  const nu=Date.now()
  for(const t of ruiw){
    if(!t.data) continue
    let cfg=null
    try{ cfg=JSON.parse(t.data) }catch(e){ continue }
    if(!cfg||!cfg.datum) continue
    const ms=new Date(cfg.datum+'T'+(cfg.tijd||'00:00')+':00').getTime()
    if(isNaN(ms)||ms>nu) continue
    if(nu-ms>7*24*60*60*1000) continue
    const sl='fibro_timer_gemeld_'+t.key
    if(localStorage.getItem(sl)===String(ms)) continue
    localStorage.setItem(sl,String(ms))
    const bericht=(cfg.bericht||'Er is een afteltimer afgelopen')
    toonMelding(bericht,'#c084fc')
  }
}
