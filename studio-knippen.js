// studio-knippen.js (23 nov 2026, Stekky Studio stap 1) - stickers uit één plaat knippen. Geen scherm, alleen rekenen op
// pixels (een rij RGBA-waarden zoals canvas die geeft), zodat het ook in de tests draait. studio-ui.js gebruikt het.
//
// In gewone woorden:
//   1. De achtergrond van de plaat: de kleur die langs de rand het vaakst voorkomt.
//   2. Alles wat daar genoeg van verschilt, hoort bij een sticker (gevoeligheid = hoeveel verschil).
//   3. Stukken die dicht bij elkaar liggen (een sticker met los tekstje, twee delen van een figuur) worden één sticker.
//   4. De stickers worden op leesvolgorde gezet: rij voor rij, links naar rechts.
//   5. Per sticker: een uitsnede met de achtergrond doorzichtig. Kleine gaatjes en spleten binnenin worden dichtgemaakt.
// Staan de stickers netjes in een rooster (bijvoorbeeld 6 x 4), dan kan ook knipRooster: elk vakje wordt een sticker.

// ── De achtergrond van de plaat ──
export function schatAchtergrond(data, w, h) {
  const strook = Math.max(1, Math.round(Math.min(w, h) * 0.02))
  const emmers = new Map()
  const tel = (x, y) => {
    const i = (y * w + x) * 4
    if (data[i + 3] < 128) return
    const sleutel = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const e = emmers.get(sleutel)
    if (e) { e.n++; e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2] } else emmers.set(sleutel, { n: 1, r: data[i], g: data[i + 1], b: data[i + 2] })
  }
  for (let y = 0; y < h; y++) {
    if (y < strook || y >= h - strook) { for (let x = 0; x < w; x++) tel(x, y) }          // boven- en onderrand
    else { for (let x = 0; x < strook; x++) tel(x, y); for (let x = w - strook; x < w; x++) tel(x, y) }   // links en rechts
  }
  let beste = null
  for (const e of emmers.values()) if (!beste || e.n > beste.n) beste = e
  return beste ? [beste.r / beste.n, beste.g / beste.n, beste.b / beste.n] : [255, 255, 255]
}

// ── Masker: 1 = hoort bij een sticker ──
export function maakMasker(data, w, h, achtergrond, gevoeligheid = 40) {
  const masker = new Uint8Array(w * h)
  const [br, bg, bb] = achtergrond, grens = gevoeligheid * gevoeligheid
  for (let p = 0, i = 0; p < masker.length; p++, i += 4) {
    if (data[i + 3] < 128) continue                   // al doorzichtig: achtergrond
    const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb
    if (dr * dr + dg * dg + db * db > grens) masker[p] = 1
  }
  return masker
}

// Verbreden (dilate) en versmallen (erode) met een vierkant van straal r; gesplitst in rijen en kolommen (snel).
function schuif(masker, w, h, r, uitbreiden) {
  if (r <= 0) return masker.slice()
  const tussen = new Uint8Array(w * h), uit = new Uint8Array(w * h)
  const tegenstander = uitbreiden ? 1 : 0
  // Van elke pixel de afstand tot de dichtstbijzijnde 'tegenstander' (bij verbreden: een 1, bij versmallen: een 0),
  // eerst langs de rijen, dan langs de kolommen. Is die afstand hoogstens r, dan wordt de pixel de tegenstander.
  const links = new Int32Array(Math.max(w, h))
  for (let y = 0; y < h; y++) {
    const rij = y * w
    let laatste = -1e9
    for (let x = 0; x < w; x++) { if (masker[rij + x] === tegenstander) laatste = x; links[x] = laatste }
    let volgende = 1e9
    for (let x = w - 1; x >= 0; x--) {
      if (masker[rij + x] === tegenstander) volgende = x
      tussen[rij + x] = Math.min(x - links[x], volgende - x) <= r ? tegenstander : 1 - tegenstander
    }
  }
  for (let x = 0; x < w; x++) {
    let laatste = -1e9
    for (let y = 0; y < h; y++) { if (tussen[y * w + x] === tegenstander) laatste = y; links[y] = laatste }
    let volgende = 1e9
    for (let y = h - 1; y >= 0; y--) {
      if (tussen[y * w + x] === tegenstander) volgende = y
      uit[y * w + x] = Math.min(y - links[y], volgende - y) <= r ? tegenstander : 1 - tegenstander
    }
  }
  return uit
}
export const verbreed = (m, w, h, r) => schuif(m, w, h, r, true)
export const versmal = (m, w, h, r) => schuif(m, w, h, r, false)

// Stukken vinden (4 buren). Geeft { labels, stukken: [{ id, x0, y0, x1, y1, n }] } (x1 en y1 zijn de laatste pixel).
export function labelStukken(masker, w, h) {
  const labels = new Int32Array(w * h), stukken = []
  const stapel = new Int32Array(w * h)
  for (let start = 0; start < masker.length; start++) {
    if (!masker[start] || labels[start]) continue
    const id = stukken.length + 1
    let n = 0, top = 0, x0 = w, y0 = h, x1 = -1, y1 = -1
    stapel[top++] = start; labels[start] = id
    while (top) {
      const p = stapel[--top], x = p % w, y = (p - x) / w
      n++
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      if (x > 0 && masker[p - 1] && !labels[p - 1]) { labels[p - 1] = id; stapel[top++] = p - 1 }
      if (x < w - 1 && masker[p + 1] && !labels[p + 1]) { labels[p + 1] = id; stapel[top++] = p + 1 }
      if (y > 0 && masker[p - w] && !labels[p - w]) { labels[p - w] = id; stapel[top++] = p - w }
      if (y < h - 1 && masker[p + w] && !labels[p + w]) { labels[p + w] = id; stapel[top++] = p + w }
    }
    stukken.push({ id, x0, y0, x1, y1, n })
  }
  return { labels, stukken }
}

// Gaten binnenin vullen: alles wat niet vanaf de rand van het vak bereikbaar is, hoort erbij.
function vulGaten(alfa, bw, bh) {
  const buiten = new Uint8Array(bw * bh), stapel = new Int32Array(bw * bh)
  let top = 0
  const duw = p => { if (!alfa[p] && !buiten[p]) { buiten[p] = 1; stapel[top++] = p } }
  for (let x = 0; x < bw; x++) { duw(x); duw((bh - 1) * bw + x) }
  for (let y = 0; y < bh; y++) { duw(y * bw); duw(y * bw + bw - 1) }
  while (top) {
    const p = stapel[--top], x = p % bw
    if (x > 0) duw(p - 1); if (x < bw - 1) duw(p + 1); if (p >= bw) duw(p - bw); if (p < bw * (bh - 1)) duw(p + bw)
  }
  for (let p = 0; p < alfa.length; p++) if (!buiten[p]) alfa[p] = 1
  return alfa
}

// Leesvolgorde: rij voor rij (een nieuwe rij begint als het midden duidelijk lager ligt), binnen een rij links naar rechts.
export function leesvolgorde(stickers) {
  if (stickers.length < 2) return stickers.slice()
  const hoogtes = stickers.map(s => s.h).sort((a, b) => a - b)
  const mediaan = hoogtes[hoogtes.length >> 1]
  const opY = stickers.slice().sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2))
  const rijen = []
  for (const s of opY) {
    const midden = s.y + s.h / 2
    const rij = rijen[rijen.length - 1]
    if (rij && midden - rij.gem < mediaan * 0.55) { rij.lijst.push(s); rij.gem = rij.lijst.reduce((a, t) => a + t.y + t.h / 2, 0) / rij.lijst.length }
    else rijen.push({ lijst: [s], gem: midden })
  }
  return rijen.flatMap(r => r.lijst.sort((a, b) => a.x - b.x))
}

// ── Stickers vinden ──
// opties: gevoeligheid (kleurverschil, 40), samenvoegen (afstand in pixels waarbinnen stukken één sticker worden; standaard
// 1,2% van de kortste kant), minimum (kleinste sticker, als deel van de kortste kant; standaard 4%).
// Geeft { stickers: [{ x, y, w, h, n, samengeklonterd }], achtergrond } in leesvolgorde. Elke sticker heeft ook 'alfa'
// (w x h, 1 = sticker; gaatjes dicht) voor maakUitsnede.
export function vindStickers(data, w, h, opties = {}) {
  const kort = Math.min(w, h)
  const achtergrond = opties.achtergrond || schatAchtergrond(data, w, h)
  const masker = maakMasker(data, w, h, achtergrond, opties.gevoeligheid ?? 40)
  const R = Math.max(1, Math.round(opties.samenvoegen ?? kort * 0.012))
  const dik = verbreed(masker, w, h, R)
  const { labels, stukken } = labelStukken(dik, w, h)
  const minimum = Math.max(8, Math.round(kort * (opties.minimum ?? 0.04)))
  const gevonden = []
  for (const s of stukken) {
    const bw = s.x1 - s.x0 + 1, bh = s.y1 - s.y0 + 1
    if (bw < minimum || bh < minimum) continue
    if (bw >= w * 0.98 && bh >= h * 0.98) continue    // het hele plaatje: geen sticker
    // het stuk (na verbreden) weer versmallen: de spleten blijven dicht, de omtrek klopt weer
    const alfa = new Uint8Array(bw * bh)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) alfa[y * bw + x] = labels[(s.y0 + y) * w + s.x0 + x] === s.id ? 1 : 0
    // versmallen kan alleen binnen het vak als er R pixels rand omheen zit: werk op een iets groter vak
    const pad = R + 1, gw = bw + 2 * pad, gh = bh + 2 * pad
    const groot = new Uint8Array(gw * gh)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) groot[(y + pad) * gw + x + pad] = alfa[y * bw + x]
    const dun = versmal(groot, gw, gh, R)
    const sluit = new Uint8Array(bw * bh)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const orig = masker[(s.y0 + y) * w + s.x0 + x] && labels[(s.y0 + y) * w + s.x0 + x] === s.id
      sluit[y * bw + x] = (dun[(y + pad) * gw + x + pad] || orig) ? 1 : 0
    }
    vulGaten(sluit, bw, bh)
    let n = 0; for (let p = 0; p < sluit.length; p++) n += sluit[p]
    if (n < minimum * minimum * 0.5) continue
    gevonden.push({ x: s.x0, y: s.y0, w: bw, h: bh, n, alfa: sluit })
  }
  // een stuk dat veel groter is dan de rest: waarschijnlijk twee stickers die elkaar raken
  if (gevonden.length > 3) {
    const opMaat = gevonden.map(s => s.n).sort((a, b) => a - b)
    const mediaan = opMaat[opMaat.length >> 1]
    for (const s of gevonden) s.samengeklonterd = s.n > mediaan * 1.5
  }
  return { stickers: leesvolgorde(gevonden), achtergrond }
}

// Staan de stickers in een rooster (kolommen x rijen)? Dan wordt elk vakje één sticker: het grootste stuk in dat vakje.
export function knipRooster(data, w, h, kolommen, rijen, opties = {}) {
  const achtergrond = opties.achtergrond || schatAchtergrond(data, w, h)
  const uit = []
  for (let r = 0; r < rijen; r++) for (let k = 0; k < kolommen; k++) {
    const vx = Math.round(k * w / kolommen), vy = Math.round(r * h / rijen)
    const vw = Math.round((k + 1) * w / kolommen) - vx, vh = Math.round((r + 1) * h / rijen) - vy
    const deel = new Uint8ClampedArray(vw * vh * 4)
    for (let y = 0; y < vh; y++) deel.set(data.subarray(((vy + y) * w + vx) * 4, ((vy + y) * w + vx + vw) * 4), y * vw * 4)
    const { stickers } = vindStickers(deel, vw, vh, { ...opties, achtergrond, minimum: opties.minimum ?? 0.08 })
    if (!stickers.length) continue
    const grootste = stickers.reduce((a, b) => (b.n > a.n ? b : a))
    uit.push({ ...grootste, x: grootste.x + vx, y: grootste.y + vy, vakje: [k, r] })
  }
  return { stickers: uit, achtergrond }
}

// ── De uitsnede van één sticker ──
// Geeft { w, h, rgba } van het vak rond de sticker (met marge), de achtergrond doorzichtig, de rand een heel klein beetje
// zacht (1 pixel). Pixels binnen de omtrek houden hun eigen kleur, ook de witte rand van de sticker.
export function maakUitsnede(data, w, h, sticker, marge = 2) {
  const bw = sticker.w + 2 * marge, bh = sticker.h + 2 * marge
  const rgba = new Uint8ClampedArray(bw * bh * 4)
  for (let y = 0; y < sticker.h; y++) for (let x = 0; x < sticker.w; x++) {
    if (!sticker.alfa[y * sticker.w + x]) continue
    const van = ((sticker.y + y) * w + sticker.x + x) * 4, naar = ((y + marge) * bw + x + marge) * 4
    rgba[naar] = data[van]; rgba[naar + 1] = data[van + 1]; rgba[naar + 2] = data[van + 2]; rgba[naar + 3] = 255
  }
  // de rand zacht: een pixel met minder dan 4 volle buren krijgt minder dekking
  const kopie = rgba.slice()
  for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) {
    const p = (y * bw + x) * 4
    if (!kopie[p + 3]) continue
    let buren = 0
    if (kopie[p - 4 + 3]) buren++; if (kopie[p + 4 + 3]) buren++; if (kopie[p - bw * 4 + 3]) buren++; if (kopie[p + bw * 4 + 3]) buren++
    if (buren < 4) rgba[p + 3] = 130 + buren * 30
  }
  return { w: bw, h: bh, rgba }
}
