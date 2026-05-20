import { supabase } from './supabase.js'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('FibroDB', 1)
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

async function laadWallpaper(userId) {
  const wallpaper = await laadFotoUitDB('bg_wallpaper_' + userId)
  if (wallpaper) {
    document.body.style.backgroundImage = 'url(' + wallpaper + ')'
    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundAttachment =
