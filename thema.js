import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabase = createClient('https://qmgatbphiplrfxrljtbe.supabase.co','sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf')
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('FibroDB',1);req.onupgradeneeded=e=>e.target.result.createObjectStore('fotos',{keyPath:'id'});req.onsuccess=e=>resolve(e.target.result);req.onerror=()=>reject('DB fout')})}
async function laadFotoUitDB(id){try{const db=await openDB();return new Promise((resolve)=>{const req=db.transaction('fotos').objectStore('fotos').get(id);req.onsuccess=e=>resolve(e.target.result?.data||null);req.onerror=()=>resolve(null)})}catch{return null}}
async function laadWallpaper(userId){
  const wallpaper=await laadFotoUitDB('bg_wallpaper_'+userId)
  if(wallpaper){
    document.body.style.backgroundImage=`url(${wallpaper})`
    document.body.style.backgroundSize='cover'
    document.body.style.backgroundPosition='center'
    document.body.style.backgroundAttachment='fixed'
    document.body.style.backgroundRepeat='no-repeat'
    document.documentElement.style.setProperty('--bg','transparent')
    document.documentElement.style.setProperty('--card','rgba(0,0,0,0.55)')
    document.documentElement.style.setProperty('--border','rgba(255,255,255,0.15)')
    const topBar=document.querySelector('.top-bar')
    if(topBar)topBar.style.background='rgba(0,0,0,0.6)'
    const bottomNav=document.querySelector('.bottom-nav')
    if(bottomNav)bottomNav.style.background='rgba(0,0,0,0.6)'
  }else{
    document.body.style.backgroundImage=''
    document.body.style.backgroundSize=''
    document.body.style.backgroundPosition=''
    document.body.style.backgroundAttachment=''
    document.body.style.backgroundRepeat=''
    document.documentElement.style.setProperty('--card','rgba(255,255,255,0.06)')
    document.documentElement.style.setProperty('--border','rgba(255,255,255,0.12)')
  }
}
export async function laadThema(){
  const{data:{session}}=await supabase.auth.getSession()
  if(!session)return
  const{data}=await supabase.from('profiles').select('achtergrond_kleur,accent_kleur,accent_kleur2,lettertype,animatie').eq('id',session.user.id).single()
  if(!data)return
  if(data.accent_kleur)document.documentElement.style.setProperty('--accent',data.accent_kleur)
  if(data.accent_kleur2)document.documentElement.style.setProperty('--accent2',data.accent_kleur2)
  if(data.lettertype)document.body.style.fontFamily=data.lettertype
  await laadWallpaper(session.user.id)
  const wallpaper=await laadFotoUitDB('bg_wallpaper_'+session.user.id)
  if(!wallpaper&&data.achtergrond_kleur)document.documentElement.style.setProperty('--bg',data.achtergrond_kleur)
}
