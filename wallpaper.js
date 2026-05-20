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

export async function laadWallpaper() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const userId = session.user.id
    const db = await openDB()
    if (!db.objectStoreNames.contains('fotos')) return
    const data = await new Promise(res => {
      const r = db.transaction('fotos').objectStore('fotos').get('bg_wallpaper_' + userId)
      r.onsuccess = e => res(e.target.result?.data || null)
      r.onerror = () => res(null)
    })
    if (data) {
      let bg = document.getElementById('wallpaper-bg')
      if (!bg) {
        bg = document.createElement('div')
        bg.id = 'wallpaper-bg'
        bg.style.cssText = 'position:fixed;inset:0;z-index:-1;background-size:cover;background-position:center;background-repeat:no-repeat;'
        document.body.prepend(bg)
      }
      bg.style.backgroundImage = 'url(' + data + ')'
      document.body.classList.add('heeft-wallpaper')
    }
  } catch(e) { console.error('wallpaper fout:', e) }
}
