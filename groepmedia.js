// groepmedia.js (10 nov 2026, groepschat): foto's en spraakberichtjes in een groep, alleen naar wie online is.
//
// Zoals Marcel koos: niet via de database. De foto of het spraakberichtje gaat versleuteld (groepsleutel.js, soort
// 'media': een eigen sleutel per stuk, per lid ingepakt) in stukjes over het live-kanaal van de groep (groep-<id>,
// alleen voor leden). Wie op dat moment de groep open heeft, krijgt hem; de server bewaart niets.
// In de database komt alleen een gewoon (versleuteld) bericht 'groepmedia:<id>:<foto|spraak>:<seconden>', zodat iedereen
// ziet dat er iets gestuurd is. Wie niet online was, ziet '📷 Foto - je was niet online'.
// Elk toestel bewaart wat het stuurde of kreeg zelf, in FibroDB (bak 'fotos', 'groep_<groep>_media_<id>'), 31 dagen.
import { versleutelGroepsBytes, openGroepsBytes } from './groepsleutel.js?v=2'

export const STUK = 60000                 // tekens per stukje over het kanaal (ruim onder de grens van Supabase)
export const MAX_BYTES = 5 * 1024 * 1024  // zoals spraak.js
export const GELDIG_ID = /^[a-z0-9]{8,24}$/
export const MARKER = /^groepmedia:([a-z0-9]{8,24}):(foto|spraak):(\d{1,4})$/
const GELDIG_MIME = /^(image\/(jpeg|webp|png|avif)|audio\/(mp4|webm|ogg|mpeg|aac|x-m4a)(;[a-z0-9=.,\s-]*)?)$/i
const BEWAAR_DAGEN = 31

export const nieuwId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join('')
export const marker = (id, soort, duur) => 'groepmedia:' + id + ':' + soort + ':' + Math.max(0, Math.min(9999, Math.round(Number(duur) || 0)))

function naarB64(b) { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s) }
function vanB64(t) { const bin = atob(t); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o }

// ── Een foto kleiner maken (zoals in de chat: hoogstens 1280 px, WebP of anders JPEG) ──
const kanWebp = (() => { try { const c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/webp').startsWith('data:image/webp') } catch (e) { return false } })()
export function maakFoto(file) {
  return new Promise((ok, nee) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1280
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r) }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const x = c.getContext('2d')
      if (!kanWebp) { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h) }
      x.drawImage(img, 0, 0, w, h)
      c.toBlob(b => b ? ok(b) : nee(new Error('foto maken mislukt')), kanWebp ? 'image/webp' : 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); nee(new Error('foto niet te lezen')) }
    img.src = url
  })
}

// ── Versturen over het kanaal ──
// kanaal: het supabase-kanaal groep-<id>; sleutel: { groepId, van, mijnPriv, leden } (zoals versleutelGroepsBericht).
export async function verstuurMedia(kanaal, { id, soort, mime, duur, blob }, sleutel) {
  if (!kanaal) throw new Error('geen verbinding')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.length > MAX_BYTES) throw new Error('te groot')
  const p = await versleutelGroepsBytes(bytes, sleutel)
  const b64 = naarB64(p.d)
  const n = Math.max(1, Math.ceil(b64.length / STUK))
  for (let i = 0; i < n; i++) {
    const payload = { id, i, n, van: sleutel.van, d: b64.slice(i * STUK, (i + 1) * STUK) }
    if (i === 0) payload.kop = { t: p.t, k: p.k, soort, mime, duur: Math.round(Number(duur) || 0) }
    let r = await kanaal.send({ type: 'broadcast', event: 'media', payload })
    if (r !== 'ok') r = await kanaal.send({ type: 'broadcast', event: 'media', payload })
    if (r !== 'ok') throw new Error('versturen mislukt (' + r + ')')
  }
  return p.overgeslagen
}

// ── Ontvangen: stukjes verzamelen, openen en doorgeven ──
// sleutelVoor(van) geeft { groepId, ik, mijnPriv, afzenderPub } of null; opKlaar(id, { blob, soort, mime, duur, van }).
export function maakOntvanger({ sleutelVoor, opKlaar }) {
  const bezig = new Map()
  return async function ontvang(payload) {
    const p = payload && payload.payload ? payload.payload : payload
    if (!p || !GELDIG_ID.test(String(p.id)) || typeof p.d !== 'string' || !Number.isInteger(p.i) || !Number.isInteger(p.n) || p.n < 1 || p.n > 200 || p.i < 0 || p.i >= p.n) return
    let b = bezig.get(p.id)
    if (!b) {
      if (bezig.size > 20) return
      b = { n: p.n, van: p.van, delen: new Array(p.n), kop: null, binnen: 0, timer: setTimeout(() => bezig.delete(p.id), 120000) }
      bezig.set(p.id, b)
    }
    if (b.n !== p.n || b.van !== p.van || b.delen[p.i] !== undefined) return
    b.delen[p.i] = p.d; b.binnen++
    if (p.i === 0 && p.kop) b.kop = p.kop
    if (b.binnen < b.n || !b.kop) return
    clearTimeout(b.timer); bezig.delete(p.id)
    const kop = b.kop
    if (!['foto', 'spraak'].includes(kop.soort) || !GELDIG_MIME.test(String(kop.mime || ''))) return
    const opts = sleutelVoor(b.van)
    if (!opts) return
    let d
    try { d = vanB64(b.delen.join('')) } catch (e) { return }
    const uit = await openGroepsBytes({ t: kop.t, d, k: kop.k }, { ...opts, van: b.van })
    if (uit.status !== 'ok') return
    opKlaar(p.id, { blob: new Blob([uit.bytes], { type: kop.mime }), soort: kop.soort, mime: kop.mime, duur: Number(kop.duur) || 0, van: b.van })
  }
}

// ── Bewaren op dit toestel ──
function db() {
  return new Promise((ok, nee) => {
    const r = indexedDB.open('FibroDB', 2)
    r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }
    r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error); r.onblocked = () => nee(new Error('geblokkeerd'))
  })
}
const sleutel = (gid, id) => 'groep_' + gid + '_media_' + id
export async function bewaarMedia(gid, id, { blob, soort, mime, duur, van }) {
  try {
    const d = await db()
    await new Promise(ok => { const tx = d.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: sleutel(gid, id), data: blob, soort, mime, duur, van, tijd: Date.now() }); tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok })
    d.close()
  } catch (e) {}
}
export async function leesMedia(gid, id) {
  try {
    const d = await db()
    const r = await new Promise(ok => { const q = d.transaction('fotos').objectStore('fotos').get(sleutel(gid, id)); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null) })
    d.close()
    if (!r || !(r.data instanceof Blob) || Date.now() - (r.tijd || 0) > BEWAAR_DAGEN * 864e5) return null
    return { blob: r.data, soort: r.soort, mime: r.mime, duur: Number(r.duur) || 0, van: r.van }
  } catch (e) { return null }
}
export async function ruimOp(gid, alles = false) {
  try {
    const d = await db()
    const vv = 'groep_' + gid + '_media_'
    await new Promise(ok => {
      const tx = d.transaction('fotos', 'readwrite'), st = tx.objectStore('fotos')
      const q = st.openCursor(IDBKeyRange.bound(vv, vv + '￿'))
      q.onsuccess = () => { const c = q.result; if (!c) return; if (alles || Date.now() - (c.value.tijd || 0) > BEWAAR_DAGEN * 864e5) c.delete(); c.continue() }
      tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok
    })
    d.close()
  } catch (e) {}
}
