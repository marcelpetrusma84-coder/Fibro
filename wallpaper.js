import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(
  'https://qmgatbphiplrfxrljtbe.supabase.co',
  'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
)

export async function laadWallpaper() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const userId = session.user.id
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('FibroDB', 1)
      r.onsuccess = e => res(e.target.result)
      r.onerror = () => rej()
    })
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
