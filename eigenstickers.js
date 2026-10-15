// eigenstickers.js - je eigen stickers: bewaren op dit toestel en het plaatje maken (v154, 15 oktober 2026)
// v155: ook de stickers van een vriend opzoeken ('vriend_<id>_sticker_<code>', binnengekomen via sync.js).
// Een eigen sticker staat in de toesteldatabase van Fibro (IndexedDB 'FibroDB', bak 'fotos'), onder
// 'eigensticker_<jouw id>_<vel>-<nr>' (vel e1 of e2, nr 01 t/m 12). Het id staat in de naam, dus
// 'account verwijderen' (account.js) gooit ze mee weg en een ander account op dit toestel ziet ze niet.
// Uitloggen laat ze staan: ze staan alleen op dit toestel, nergens anders.
// Het plaatje: een afbeelding van het toestel, de achtergrond weg (bij een effen achtergrond) of met je
// vinger uitgeknipt, een witte rand eromheen, 256 x 256 pixels als WebP (Safari kan geen WebP maken: PNG).

export const EIGEN_VELLEN = ['e1', 'e2']
export const PER_VEL = 12
export const MAAT = 256
const RANDKLEUR = [251, 243, 230]

export const isCode = c => /^e[12]-(0[1-9]|1[0-2])$/.test(String(c || ''))
export const maakCode = (vel, nr) => vel + '-' + String(nr).padStart(2, '0')
const voorvoegsel = uid => 'eigensticker_' + uid + '_'

/* ---------- opslag op het toestel ---------- */
function openDB() {
  return new Promise((ok, nee) => {
    const r = indexedDB.open('FibroDB', 2)
    r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => nee(r.error)
    r.onblocked = () => nee(new Error('geblokkeerd'))
  })
}
// Alle eigen stickers van dit account: { 'e1-01': { code, data, b, g, naam, tijd }, ... }
export async function leesEigen(uid) {
  const uit = {}
  if (!uid) return uit
  const db = await openDB()
  const pre = voorvoegsel(uid)
  await new Promise(klaar => {
    const tx = db.transaction('fotos')
    const r = tx.objectStore('fotos').openCursor(IDBKeyRange.bound(pre, pre + '￿'))
    r.onsuccess = e => {
      const c = e.target.result
      if (!c) return
      const v = c.value || {}
      const code = String(c.key).slice(pre.length)
      if (isCode(code) && typeof v.data === 'string' && /^data:image\/(webp|png);base64,/.test(v.data))
        uit[code] = { code, data: v.data, b: String(v.b || 'geen'), g: String(v.g || 'geen'), naam: String(v.naam || '').slice(0, 30), tijd: v.tijd || 0 }
      c.continue()
    }
    tx.oncomplete = klaar; tx.onerror = klaar; tx.onabort = klaar
  })
  return uit
}
function schrijf(doe) {
  return openDB().then(db => new Promise((ok, nee) => {
    const tx = db.transaction('fotos', 'readwrite')
    doe(tx.objectStore('fotos'))
    tx.oncomplete = () => ok()
    tx.onerror = () => nee(tx.error || new Error('opslaan mislukt'))
    tx.onabort = () => nee(tx.error || new Error('opslaan mislukt'))
  }))
}
// Eén sticker opzoeken voor de chat: { vel, nr, naam, b, g, src } of null
function leesEen(sleutel, code) {
  return openDB().then(db => new Promise(ok => {
    const q = db.transaction('fotos').objectStore('fotos').get(sleutel)
    q.onsuccess = () => {
      const v = q.result
      if (!v || typeof v.data !== 'string' || !/^data:image\/(webp|png);base64,/.test(v.data)) return ok(null)
      ok({ vel: code.slice(0, 2), nr: code.slice(3), naam: String(v.naam || '').slice(0, 30), b: String(v.b || 'geen'), g: String(v.g || 'geen'), src: v.data })
    }
    q.onerror = () => ok(null)
  })).catch(() => null)
}
export function zoekEigenSticker(uid, code) {
  return (uid && isCode(code)) ? leesEen(voorvoegsel(uid) + code, code) : Promise.resolve(null)
}
export const vriendStickerSleutel = (vriendId, code) => 'vriend_' + vriendId + '_sticker_' + code
export function zoekVriendSticker(vriendId, code) {
  return (vriendId && isCode(code)) ? leesEen(vriendStickerSleutel(vriendId, code), code) : Promise.resolve(null)
}

export function bewaarEigen(uid, code, s) {
  if (!uid || !isCode(code)) return Promise.reject(new Error('ongeldig'))
  return schrijf(st => st.put({ id: voorvoegsel(uid) + code, data: s.data, b: s.b, g: s.g, naam: String(s.naam || '').slice(0, 30), tijd: Date.now() }))
}
export function wisEigen(uid, code) {
  if (!uid || !isCode(code)) return Promise.resolve()
  return schrijf(st => st.delete(voorvoegsel(uid) + code))
}

/* ---------- het plaatje ---------- */
function doek(b, h) { const c = document.createElement('canvas'); c.width = b; c.height = h; return c }
const pen = c => c.getContext('2d', { willReadFrequently: true })

// Afbeelding van het toestel naar een doek van hoogstens max pixels (de iPhone draait foto's zelf rechtop)
export async function laadAfbeelding(file, max = 640) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('geen-afbeelding')
  if (file.size > 30 * 1024 * 1024) throw new Error('te-groot')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const w = img.naturalWidth, h = img.naturalHeight
    if (!w || !h) throw new Error('geen-afbeelding')
    const s = Math.min(1, max / Math.max(w, h))
    const c = doek(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)))
    const p = pen(c); p.imageSmoothingQuality = 'high'
    p.drawImage(img, 0, 0, c.width, c.height)
    return c
  } catch (e) {
    throw (e && /te-groot|geen-afbeelding/.test(e.message)) ? e : new Error('geen-afbeelding')
  } finally { URL.revokeObjectURL(url) }
}

function ring(c) {
  const { width: w, height: h } = c
  const d = pen(c).getImageData(0, 0, w, h).data
  const px = []
  const neem = (x, y) => { const i = (y * w + x) * 4; px.push([d[i], d[i + 1], d[i + 2], d[i + 3]]) }
  for (let x = 0; x < w; x++) { neem(x, 0); neem(x, h - 1); if (h > 3) { neem(x, 1); neem(x, h - 2) } }
  for (let y = 2; y < h - 2; y++) { neem(0, y); neem(w - 1, y); if (w > 3) { neem(1, y); neem(w - 2, y) } }
  return px
}
const mediaan = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
const afstand = (d, i, k) => Math.sqrt((d[i] - k[0]) ** 2 + (d[i + 1] - k[1]) ** 2 + (d[i + 2] - k[2]) ** 2)

// Wat voor rand heeft de afbeelding? { doorzichtig: al zonder achtergrond, effen: één kleur, kleur }
export function bekijkRand(c) {
  const px = ring(c)
  const doorzichtig = px.filter(p => p[3] < 20).length > px.length * 0.6
  const vol = px.filter(p => p[3] >= 20)
  if (!vol.length) return { doorzichtig: true, effen: false, kleur: [0, 0, 0] }
  const kleur = [0, 1, 2].map(k => mediaan(vol.map(p => p[k])))
  const dichtbij = vol.filter(p => Math.sqrt((p[0] - kleur[0]) ** 2 + (p[1] - kleur[1]) ** 2 + (p[2] - kleur[2]) ** 2) < 40).length
  return { doorzichtig, effen: dichtbij > vol.length * 0.7, kleur }
}

// Effen achtergrond weg: vanaf de rand alles wat op de randkleur lijkt (tolerantie 10-120) doorzichtig maken.
// Al doorzichtig (png zonder achtergrond)? Dan blijft hij zoals hij is.
export function achtergrondWeg(bron, tolerantie = 45) {
  const { width: w, height: h } = bron
  const uit = doek(w, h), p = pen(uit)
  p.drawImage(bron, 0, 0)
  const rand = bekijkRand(bron)
  if (rand.doorzichtig) return uit
  const beeld = p.getImageData(0, 0, w, h), d = beeld.data
  const k = rand.kleur, n = w * h
  const weg = new Uint8Array(n), rij = new Int32Array(n)
  let kop = 0, staart = 0
  const probeer = j => { if (!weg[j] && afstand(d, j * 4, k) < tolerantie) { weg[j] = 1; rij[staart++] = j } }
  for (let x = 0; x < w; x++) { probeer(x); probeer((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { probeer(y * w); probeer(y * w + w - 1) }
  while (kop < staart) {
    const j = rij[kop++], x = j % w
    if (x > 0) probeer(j - 1)
    if (x < w - 1) probeer(j + 1)
    if (j >= w) probeer(j - w)
    if (j < n - w) probeer(j + w)
  }
  for (let j = 0; j < n; j++) {
    if (weg[j]) { d[j * 4 + 3] = 0; continue }
    // zachte rand: een pixel naast de achtergrond wordt deels doorzichtig
    const x = j % w
    let buren = 0, bg = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, jj = j + dy * w + dx
      if (xx < 0 || xx >= w || jj < 0 || jj >= n) continue
      buren++; bg += weg[jj]
    }
    if (bg) d[j * 4 + 3] = Math.round(d[j * 4 + 3] * Math.max(0.35, 1 - bg / buren))
  }
  p.putImageData(beeld, 0, 0)
  return uit
}

// Met je vinger uitgeknipt: alleen wat binnen de lijn (punten in pixels van de afbeelding) ligt blijft
export function knipMetLijn(bron, punten) {
  const uit = doek(bron.width, bron.height), p = pen(uit)
  p.drawImage(bron, 0, 0)
  if (!punten || punten.length < 3) return uit
  p.globalCompositeOperation = 'destination-in'
  p.beginPath(); p.moveTo(punten[0][0], punten[0][1])
  for (const [x, y] of punten.slice(1)) p.lineTo(x, y)
  p.closePath(); p.fill()
  return uit
}

// Het eindplaatje: bijgesneden, in het midden van 256 x 256, met een witte rand (rand = true)
export function maakSticker(bron, { rand = true } = {}) {
  const { width: w, height: h } = bron
  const a = pen(bron).getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 16) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  if (x1 < 0) throw new Error('leeg')
  const r = rand ? Math.round(MAAT * 0.035) : 0
  const ruimte = MAAT - 2 * (r + 3)
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1
  const s = Math.min(ruimte / bw, ruimte / bh)
  const dw = Math.max(1, Math.round(bw * s)), dh = Math.max(1, Math.round(bh * s))
  const kern = doek(MAAT, MAAT), pk = pen(kern)
  pk.imageSmoothingQuality = 'high'
  pk.drawImage(bron, x0, y0, bw, bh, Math.round((MAAT - dw) / 2), Math.round((MAAT - dh) / 2), dw, dh)
  if (!rand) return { doek: kern, data: alsData(kern) }
  // witte rand: afstand tot de sticker uitrekenen (twee keer over het plaatje) en tot r pixels wit maken
  const n = MAAT * MAAT, ka = pk.getImageData(0, 0, MAAT, MAAT).data
  const D = new Float32Array(n), VER = 1e9, S2 = Math.SQRT2
  for (let j = 0; j < n; j++) D[j] = ka[j * 4 + 3] > 110 ? 0 : VER
  for (let y = 0; y < MAAT; y++) for (let x = 0; x < MAAT; x++) {
    const j = y * MAAT + x; let v = D[j]
    if (x > 0) v = Math.min(v, D[j - 1] + 1)
    if (y > 0) { v = Math.min(v, D[j - MAAT] + 1); if (x > 0) v = Math.min(v, D[j - MAAT - 1] + S2); if (x < MAAT - 1) v = Math.min(v, D[j - MAAT + 1] + S2) }
    D[j] = v
  }
  for (let y = MAAT - 1; y >= 0; y--) for (let x = MAAT - 1; x >= 0; x--) {
    const j = y * MAAT + x; let v = D[j]
    if (x < MAAT - 1) v = Math.min(v, D[j + 1] + 1)
    if (y < MAAT - 1) { v = Math.min(v, D[j + MAAT] + 1); if (x < MAAT - 1) v = Math.min(v, D[j + MAAT + 1] + S2); if (x > 0) v = Math.min(v, D[j + MAAT - 1] + S2) }
    D[j] = v
  }
  const eind = doek(MAAT, MAAT), pe = pen(eind)
  const rb = pe.createImageData(MAAT, MAAT), rd = rb.data
  for (let j = 0; j < n; j++) {
    const al = Math.max(0, Math.min(1, r + 0.5 - D[j]))
    if (!al) continue
    rd[j * 4] = RANDKLEUR[0]; rd[j * 4 + 1] = RANDKLEUR[1]; rd[j * 4 + 2] = RANDKLEUR[2]; rd[j * 4 + 3] = Math.round(al * 255)
  }
  pe.putImageData(rb, 0, 0)
  pe.drawImage(kern, 0, 0)
  return { doek: eind, data: alsData(eind) }
}
function alsData(c) {
  let d = ''
  try { d = c.toDataURL('image/webp', 0.86) } catch (e) {}
  return d.startsWith('data:image/webp') ? d : c.toDataURL('image/png')
}
