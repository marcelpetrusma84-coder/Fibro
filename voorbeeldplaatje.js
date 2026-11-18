// voorbeeldplaatje.js (v1, 18 nov 2026) - titel en plaatje ophalen voor de PeerTube- en de muziek-widget.
//
// In gewone woorden: als JIJ een link opslaat, vraagt JOUW toestel één keer bij de server (PeerTube of Funkwhale) om
// de titel en het plaatje (miniatuur of albumhoes). Het plaatje wordt hier verkleind en als data-plaatje bewaard; het
// wordt de achtergrond van het kaartje en gaat via de gewone synchronisatie naar je vrienden (sync.js, 'wbg:peertube'
// en 'wbg:muziekwidget'). Je vrienden praten dus nog steeds pas met de server als ze zelf op afspelen tikken.
// Zonder cookies, zonder referrer, met een tijdslimiet. Lukt het niet, dan gewoon zonder titel of plaatje.

const TIJD_MS = 8000
export const MAX_ZIJDE = 640 // het plaatje wordt hooguit 640 px breed of hoog (ongeveer 30 tot 60 kB)

function metTijdslimiet(ms) {
  const c = typeof AbortController === 'function' ? new AbortController() : null
  const t = c ? setTimeout(() => c.abort(), ms) : null
  return { signal: c ? c.signal : undefined, klaar: () => { if (t) clearTimeout(t) } }
}

const OPTIES = { credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', redirect: 'error' }

// JSON van een API-adres op een goedgekeurde server. null als het niet lukt.
export async function haalJson(url, { fetch: f = globalThis.fetch, ms = TIJD_MS } = {}) {
  const tl = metTijdslimiet(ms)
  try {
    const r = await f(url, { ...OPTIES, signal: tl.signal, headers: { Accept: 'application/json' } })
    if (!r || !r.ok) return null
    return await r.json()
  } catch (e) { return null } finally { tl.klaar() }
}

// Is dit een plaatje-adres op precies deze server (https, geen poort, geen inlog)? Geeft het nette adres of null.
export function plaatjeOpServer(adres, server) {
  if (typeof adres !== 'string' || !adres || adres.length > 600) return null
  let u
  try { u = new URL(adres, 'https://' + server + '/') } catch (e) { return null }
  if (u.protocol !== 'https:' || u.hostname.toLowerCase() !== server || u.port || u.username || u.password) return null
  if (!/\.(jpe?g|png|webp)$/i.test(u.pathname)) return null
  return u.href
}

// Haalt het plaatje op en maakt er een verkleind JPEG-data-plaatje van: { data, breedte, hoogte } of null.
export async function maakPlaatje(url, { fetch: f = globalThis.fetch, ms = TIJD_MS, max = MAX_ZIJDE } = {}) {
  const tl = metTijdslimiet(ms)
  let blob = null
  try {
    const r = await f(url, { ...OPTIES, signal: tl.signal })
    if (!r || !r.ok) return null
    blob = await r.blob()
  } catch (e) { return null } finally { tl.klaar() }
  if (!blob || blob.size > 8 * 1024 * 1024 || !/^image\//.test(blob.type || 'image/')) return null
  try {
    const bron = await createImageBitmap(blob)
    let w = bron.width, h = bron.height
    if (!w || !h) return null
    const schaal = Math.min(1, max / Math.max(w, h))
    w = Math.max(1, Math.round(w * schaal)); h = Math.max(1, Math.round(h * schaal))
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    cv.getContext('2d').drawImage(bron, 0, 0, w, h)
    try { bron.close() } catch (e) {}
    const data = cv.toDataURL('image/jpeg', 0.8)
    return data.startsWith('data:image/jpeg') ? { data, breedte: w, hoogte: h } : null
  } catch (e) { return null }
}

// Hoe groot moet de achtergrond zijn om het hele vak te vullen (breedte in % van het vak, zie zetWidgetAchtergrond)
export function vulStand(vakB, vakH, plaatB, plaatH) {
  if (!(vakB > 0 && vakH > 0 && plaatB > 0 && plaatH > 0)) return { s: 100, x: 50, y: 50 }
  return { s: Math.max(100, Math.ceil(100 * (vakH / vakB) * (plaatB / plaatH))), x: 50, y: 50 }
}
