// vriendfotos.js - de avatarfoto's van je vrienden in Vrienden en Chat (8 oktober 2026)
//
// Een avatarfoto is ongeveer 20 KB. Die wordt niet bij elk bezoek opgehaald: de foto staat op
// dit toestel (IndexedDB, 'vriend_avatar_<id>', dezelfde plek als op vriend-profiel), en wordt
// alleen opnieuw opgehaald als die vriend zijn profiel sindsdien heeft opgeslagen
// (profiles.updated_at is anders) of als de foto hier ontbreekt. Alle vrienden die iets nodig
// hebben in een keer (50 per vraag). Zonder internet: alleen wat er al op het toestel staat.
//
// Gebruik:
//   const fotos = await haalVriendFotos(mijnId, vrienden, (bijgewerkt) => { ...opnieuw tekenen... })
//     vrienden: [{ id, updated_at }] (zonder updated_at: niets ophalen, alleen van dit toestel)
//     fotos: Map vriend-id -> data:image/...; opBijgewerkt komt (eventueel) later met de nieuwe Map
//   zetAvatar(element, emoji, foto)  // foto als achtergrond, anders de emoji
import { supabase } from './supabase.js?v=95'

const GELDIG = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i
export function geldigeFoto(f) { return typeof f === 'string' && GELDIG.test(f) ? f : null }

function openDB() {
  return new Promise((ok, mis) => {
    const q = indexedDB.open('FibroDB', 2)
    q.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos', { keyPath: 'id' })
    }
    q.onsuccess = () => ok(q.result)
    q.onerror = () => mis(q.error)
  })
}
function lees(db, id) {
  return new Promise((ok) => {
    try {
      const q = db.transaction('fotos').objectStore('fotos').get('vriend_avatar_' + id)
      q.onsuccess = () => ok(q.result ? q.result.data : null)
      q.onerror = () => ok(null)
    } catch (e) { ok(null) }
  })
}
function schrijf(db, id, data) {
  return new Promise((ok) => {
    try {
      const tx = db.transaction('fotos', 'readwrite')
      if (data) tx.objectStore('fotos').put({ id: 'vriend_avatar_' + id, data })
      else tx.objectStore('fotos').delete('vriend_avatar_' + id)
      tx.oncomplete = () => ok(true)
      tx.onerror = () => ok(false)
      tx.onabort = () => ok(false)
    } catch (e) { ok(false) }
  })
}

export async function haalVriendFotos(ikId, vrienden, opBijgewerkt) {
  const fotos = new Map()
  if (!ikId || !Array.isArray(vrienden) || !vrienden.length) return fotos
  let db
  try { db = await openDB() } catch (e) { return fotos }
  const sleutel = 'fibro_vriendfotos_' + ikId
  let versies = {}
  try { versies = JSON.parse(localStorage.getItem(sleutel) || '{}') || {} } catch (e) {}
  const nodig = []
  for (const v of vrienden) {
    const id = v && typeof v.id === 'string' ? v.id : null
    if (!id) continue
    const f = geldigeFoto(await lees(db, id))
    if (f) fotos.set(id, f)
    if (!('updated_at' in v)) continue // lijst van dit toestel: niets ophalen
    const w = versies[id]
    const actueel = !!(w && w.v === (v.updated_at || '') && (!w.f || f))
    if (!actueel) nodig.push(id)
  }
  if (nodig.length && navigator.onLine !== false) {
    ;(async () => {
      let veranderd = false
      for (let i = 0; i < nodig.length; i += 50) {
        const { data, error } = await supabase.from('profiles').select('id, avatar_data, updated_at').in('id', nodig.slice(i, i + 50))
        if (error || !Array.isArray(data)) break // later opnieuw
        for (const r of data) {
          if (!r || typeof r.id !== 'string') continue
          const f = geldigeFoto(r.avatar_data)
          if (f || fotos.has(r.id)) {
            await schrijf(db, r.id, f)
            if (f) fotos.set(r.id, f); else fotos.delete(r.id)
            veranderd = true
          }
          versies[r.id] = { v: r.updated_at || '', f: !!f }
        }
      }
      try { localStorage.setItem(sleutel, JSON.stringify(versies)) } catch (e) {}
      if (veranderd && opBijgewerkt) { try { opBijgewerkt(fotos) } catch (e) { console.warn('[vriendfotos]', e) } }
    })().catch((e) => console.warn('[vriendfotos] ophalen mislukt', e))
  }
  return fotos
}

// Foto als achtergrond van het rondje (andere onderdelen, zoals het online-stipje, blijven staan)
export function zetAvatar(el, emoji, foto) {
  if (!el) return
  const f = geldigeFoto(foto)
  for (const n of [...el.childNodes]) if (n.nodeType === 3) n.remove()
  if (f) {
    el.style.backgroundImage = 'url("' + f + '")'
    el.style.backgroundSize = 'cover'
    el.style.backgroundPosition = 'center'
    el.dataset.foto = '1'
  } else {
    el.style.backgroundImage = ''
    delete el.dataset.foto
    el.insertBefore(document.createTextNode(emoji || '\u{1F464}'), el.firstChild)
  }
}
