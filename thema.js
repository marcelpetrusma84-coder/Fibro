import { supabase } from './supabase.js?v=95'
import { pasAnimatieToe } from './animatie.js?v=95'
import { laadFont } from './lettertypes.js?v=130'

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
    // Wallpaper op een vaste laag ter grootte van het SCHERM (viewport),
    // niet op de body. Zo blijft 'cover' altijd correct geschaald:
    // - iPhone: geen inzoom-bug van background-attachment:fixed
    // - Desktop: pagina mag groeien (sync/profiel), achtergrond blijft gelijk
    let laag = document.getElementById('fibro-wallpaper')
    if (!laag) {
      laag = document.createElement('div')
      laag.id = 'fibro-wallpaper'
      laag.style.cssText = 'position:fixed;inset:0;z-index:-1;background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none;'
      document.body.prepend(laag)
    }
    laag.style.backgroundImage = 'url(' + wallpaper + ')'
    document.body.style.backgroundImage = '' // oude body-achtergrond weghalen
    document.documentElement.style.setProperty('--bg', 'transparent')
    document.body.style.background = 'transparent'
    document.documentElement.style.setProperty('--card', 'rgba(0,0,0,0.70)')
    document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.15)')
    const topBar = document.querySelector('.top-bar')
    if (topBar) topBar.style.background = 'rgba(0,0,0,0.75)'
    const bottomNav = document.querySelector('.bottom-nav')
    if (bottomNav) bottomNav.style.background = 'rgba(0,0,0,0.75)'
  } else {
    const laag = document.getElementById('fibro-wallpaper')
    if (laag) laag.remove()
    document.body.style.backgroundImage = ''
    document.documentElement.style.setProperty('--card', 'rgba(255,255,255,0.06)')
    document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.12)')
  }
  return !!wallpaper
}

// ========================
// LETTERTYPE TOEPASSEN
// ========================
// v130: wie eerder Press Start 2P koos, krijgt de kleinere versie (even breed als de rest)
const nieuweLetter = lt => /^'Press Start 2P',/.test(String(lt || '')) ? String(lt).replace("'Press Start 2P',", "'Press Start 2P Tekst',") : lt
function pasLettertypeToe(lettertype) {
  if (!lettertype) return
  lettertype = nieuweLetter(lettertype)
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
// v119: het thema wordt onthouden (localStorage) en meteen toegepast. De server wordt
// op de achtergrond gevraagd of er iets veranderd is; zo wacht een pagina daar niet meer op.
const THEMA_VELDEN = ['achtergrond_kleur', 'accent_kleur', 'accent_kleur2', 'lettertype', 'animatie']
const themaSleutel = uid => 'fibro_thema_' + uid
function leesThemaCache(uid) {
  try {
    const d = JSON.parse(localStorage.getItem(themaSleutel(uid)) || 'null')
    return d && typeof d === 'object' ? d : null
  } catch (e) { return null }
}
export function bewaarThemaCache(uid, data) {
  if (!uid || !data) return
  const d = {}
  for (const k of THEMA_VELDEN) d[k] = data[k] == null ? null : data[k]
  try { localStorage.setItem(themaSleutel(uid), JSON.stringify(d)) } catch (e) {}
}
const zelfdeThema = (a, b) => THEMA_VELDEN.every(k => (a[k] == null ? null : a[k]) === (b[k] == null ? null : b[k]))

async function pasThemaToe(data, uid) {
  if (data.accent_kleur) document.documentElement.style.setProperty('--accent', data.accent_kleur)
  if (data.accent_kleur2) document.documentElement.style.setProperty('--accent2', data.accent_kleur2)
  if (data.lettertype) { const lt = nieuweLetter(data.lettertype); laadFont(String(lt).split(",")[0].replace(/['"]/g, "").trim()); pasLettertypeToe(lt) }
  pasAnimatieToe(data.animatie)
  const heeftWallpaper = await laadWallpaper(uid)
  if (!heeftWallpaper && data.achtergrond_kleur) {
    document.documentElement.style.setProperty('--bg', data.achtergrond_kleur)
  }
}

export async function laadThema() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const uid = session.user.id
  const vanServer = supabase
    .from('profiles')
    .select('achtergrond_kleur,accent_kleur,accent_kleur2,lettertype,animatie')
    .eq('id', uid)
    .single()
    .then(r => r.data || null, () => null)
  const bewaard = leesThemaCache(uid)
  if (bewaard) {
    await pasThemaToe(bewaard, uid)
    vanServer.then(data => {
      if (!data || zelfdeThema(data, bewaard)) return
      bewaarThemaCache(uid, data)
      pasThemaToe(data, uid).catch(() => {})
    })
    return
  }
  const data = await vanServer
  if (!data) return
  bewaarThemaCache(uid, data)
  await pasThemaToe(data, uid)
}
