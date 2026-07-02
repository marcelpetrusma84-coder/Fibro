import { supabase } from './supabase.js'

// ========================
// INDEXEDDB
// ========================
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('FibroDB', 2)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('fotos')) {
        db.createObjectStore('fotos', { keyPath: 'id' })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = () => reject('DB fout')
  })
}

async function laadFotoUitDB(id) {
  try {
    const db = await openDB()
    if (!db.objectStoreNames.contains('fotos')) return null
    return new Promise((resolve) => {
      const req = db.transaction('fotos').objectStore('fotos').get(id)
      req.onsuccess = e => resolve(e.target.result?.data || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

// ========================
// WALLPAPER
// ========================
async function laadWallpaper(userId) {
  const wallpaper = await laadFotoUitDB('bg_wallpaper_' + userId)
  if (wallpaper) {
    document.body.style.backgroundImage = 'url(' + wallpaper + ')'
    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundAttachment = 'fixed'
    document.body.style.backgroundRepeat = 'no-repeat'
    document.documentElement.style.setProperty('--bg', 'transparent')
    document.documentElement.style.setProperty('--card', 'rgba(0,0,0,0.70)')
    document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.15)')
    const topBar = document.querySelector('.top-bar')
    if (topBar) topBar.style.background = 'rgba(0,0,0,0.75)'
    const bottomNav = document.querySelector('.bottom-nav')
    if (bottomNav) bottomNav.style.background = 'rgba(0,0,0,0.75)'
  } else {
    document.body.style.backgroundImage = ''
    document.documentElement.style.setProperty('--card', 'rgba(255,255,255,0.06)')
    document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.12)')
  }
}

// ========================
// LETTERTYPE TOEPASSEN
// ========================
function pasLettertypeToe(lettertype) {
  if (!lettertype) return
  // Sla op voor snelle herlaad
  try { localStorage.setItem('fibro_font', lettertype) } catch(e) {}
  // Verwijder oude lettertype stijl als die er al is
  const oud = document.getElementById('fibro-font-style')
  if (oud) oud.remove()
  // Voeg nieuwe stijl toe
  const style = document.createElement('style')
  style.id = 'fibro-font-style'
  style.textContent = `* { font-family: ${lettertype} !important; }`
  document.head.appendChild(style)
}

// ========================
// THEMA LADEN
// ========================
export async function laadThema() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { data } = await supabase
    .from('profiles')
    .select('achtergrond_kleur,accent_kleur,accent_kleur2,lettertype,animatie')
    .eq('id', session.user.id)
    .single()
  if (!data) return
  if (data.accent_kleur) document.documentElement.style.setProperty('--accent', data.accent_kleur)
  if (data.accent_kleur2) document.documentElement.style.setProperty('--accent2', data.accent_kleur2)
  if (data.lettertype) pasLettertypeToe(data.lettertype)
  await laadWallpaper(session.user.id)
  const wallpaper = await laadFotoUitDB('bg_wallpaper_' + session.user.id)
  if (!wallpaper && data.achtergrond_kleur) {
    document.documentElement.style.setProperty('--bg', data.achtergrond_kleur)
  }
}
