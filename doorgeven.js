// doorgeven.js (17 nov 2026, stap 4 van docs/profiel-via-vrienden.md)
//
// In gewone woorden: Bram (B) en Sanne (C) synchroniseren rechtstreeks. Bram heeft het nieuwste profiel van Anna (A),
// met haar ondertekende lijstje (stap 3). Sanne heeft Anna al een tijd niet tegelijk online getroffen.
//  1. Bram vraagt de server per vriend: "is Sanne ook een vriend van Anna?" (deelt_vriend, stap 2). Alleen dan biedt
//     hij Sanne het lijstje van Anna aan. Zo krijgt niemand een profiel van iemand die geen vriend van hem is.
//  2. Sanne controleert het lijstje: Anna is haar vriend, de handtekening klopt met Anna's sleutel (en de onthouden
//     vingerafdruk), en het is nieuwer dan wat ze al had.
//  3. Sanne vraagt alleen de onderdelen die ze nog niet (zo) heeft. Elk onderdeel moet precies passen bij de SHA-256
//     uit het lijstje; anders gooit ze het weg. Bram kan er dus niets aan veranderen.
//  4. Pas als alles binnen is, bewaart Sanne het lijstje, zodat zij het op haar beurt ook kan doorgeven.
// Video gaat niet mee. Muziek niet over een relay-verbinding (net als bij het gewone synchroniseren).
// Wat Anna verwijderde (een foto weg) wordt pas weggehaald bij de volgende rechtstreekse sync met Anna zelf.

import { controleerOnderdeel, inhoudHash, isNieuwer } from './profielhandtekening.js?v=2'
import { controleerVriendLijst, VRIEND_SLEUTEL } from './profielbundel.js?v=2'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KLEIN = ['quote', 'aftel', 'optel', 'poll', 'quiz', 'peertube', 'muziekwidget', 'radio', 'rss', 'mastodon', 'weer', 'mix'] // v10 (25 nov 2026): kant-en-klare widgets (layouts.js) // v2: peertube.js; v3 (18 nov 2026): muziekwidget.js; v4: hun achtergrond (wbg_) ook; v5: de radio; v6 (19 nov 2026): de RSS-widget; v7: zijn fotootjes (wbg_rss); v8: de Mastodon-widget en zijn fotootjes; v9: de weer-widget
export const MAX_AANBOD = 30          // hoogstens zoveel profielen per verbinding
const DEELT_GELDIG_MS = 10 * 60 * 1000

// Welke onderdelen mogen via een vriend, en hoe ziet een goed onderdeel eruit
export function isDoorgeefNaam(naam) {
  return typeof naam === 'string' && (naam === 'layout' || naam === 'video_meta' || KLEIN.includes(naam)
    || /^foto_pfoto_[A-Za-z0-9_]{1,60}$/.test(naam) || /^muziek_(profiel|index|nr\d{1,4})$/.test(naam)
    || /^wbg_(poll|quote|aftel|optel|quiz|peertube|muziekwidget|rss|mastodon)$/.test(naam) || /^sticker_e[12]-(0[1-9]|1[0-2])$/.test(naam))
}
export function isGoedeInhoud(naam, d) {
  if (typeof d !== 'string' || !d) return false
  if (naam === 'layout') return d.length <= 60000
  if (naam === 'video_meta') return d.length <= 400000
  if (KLEIN.includes(naam)) return d.length <= ((naam === 'quiz' || naam === 'mix') ? 40000 : 20000)
  if (naam.startsWith('foto_') || naam.startsWith('wbg_')) return d.startsWith('data:image')
  if (naam === 'muziek_index') return d.length <= 200000
  if (naam.startsWith('muziek_')) return d.startsWith('data:audio')
  if (naam.startsWith('sticker_')) {
    try { const s = JSON.parse(d); return typeof s.d === 'string' && s.d.length <= 600000 && /^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(s.d) } catch (e) { return false }
  }
  return false
}
export const muziekNaam = naam => naam.startsWith('muziek_')

// De inhoud zoals hij verstuurd (en ondertekend) wordt, uit wat er in de opslag staat
export function inhoudUitRecord(naam, rec) {
  if (!rec || typeof rec.data !== 'string') return null
  if (naam.startsWith('sticker_')) {
    return JSON.stringify({ d: rec.data, b: String(rec.b || 'geen'), g: String(rec.g || 'geen'), n: String(rec.naam || '').slice(0, 30), t: Number(rec.tijd) || 0 })
  }
  return rec.data
}
// En andersom: het record dat bewaard wordt (zoals sync.js het rechtstreeks ook doet)
export function recordUitInhoud(eigenaar, naam, inhoud, snel, vorig) {
  const rec = { id: 'vriend_' + eigenaar + '_' + naam, hash: snel(inhoud), data: inhoud, ontvangen: Date.now(), viaVriend: true }
  if (naam.startsWith('sticker_')) {
    const s = JSON.parse(inhoud)
    const woord = w => (typeof w === 'string' && /^[a-z]{1,20}$/.test(w)) ? w : 'geen'
    Object.assign(rec, { data: s.d, b: woord(s.b), g: woord(s.g), naam: typeof s.n === 'string' ? s.n.slice(0, 30) : '', tijd: Number(s.t) > 0 ? Number(s.t) : 0 })
  }
  if (naam.startsWith('wbg_')) rec.pos = vorig && typeof vorig.pos === 'string' ? vorig.pos : ''
  if (naam === 'video_meta') rec.dataHash = null
  return rec
}

// ── Kant van de tussenpersoon (B) ──
// deps: { eigenId, vrienden: Set, db: { get, sleutels(prefix) }, deeltVriend(eigenaar, ander) -> bool, nu }
const deeltCache = new Map()
async function magDoorgeven(deps, eigenaar, ander) {
  const k = eigenaar + '|' + ander, c = deeltCache.get(k), nu = deps.nu || Date.now()
  if (c && nu - c.t < DEELT_GELDIG_MS) return c.ok
  let ok = false
  try { ok = (await deps.deeltVriend(eigenaar, ander)) === true } catch (e) { ok = false }
  deeltCache.set(k, { ok, t: nu })
  return ok
}
export function vergeetDeelCache() { deeltCache.clear() }

// Welke profielen mag ik deze vriend aanbieden? [{ eigenaar, lijst }]
export async function aanbodVoor(deps, ander) {
  if (!UUID.test(String(ander || ''))) return []
  const uit = []
  for (const key of await deps.db.sleutels('vriend_')) {
    const m = /^vriend_([0-9a-f-]{36})_handtekening$/i.exec(key)
    if (!m) continue
    const eigenaar = m[1]
    if (eigenaar === ander || eigenaar === deps.eigenId || !deps.vrienden.has(eigenaar)) continue
    let lijst = null
    try { lijst = JSON.parse((await deps.db.get(key)).data) } catch (e) { continue }
    if (!(await magDoorgeven(deps, eigenaar, ander))) continue
    uit.push({ eigenaar, lijst })
    if (uit.length >= MAX_AANBOD) break
  }
  return uit
}

// Een gevraagd onderdeel: alleen als het precies past bij het lijstje dat ik aanbood
export async function inhoudVoor(deps, ander, eigenaar, naam, lijst) {
  if (!isDoorgeefNaam(naam) || !lijst || !lijst.items || !Object.prototype.hasOwnProperty.call(lijst.items, naam)) return null
  if (!(await magDoorgeven(deps, eigenaar, ander))) return null
  const inhoud = inhoudUitRecord(naam, await deps.db.get('vriend_' + eigenaar + '_' + naam))
  if (!inhoud || !isGoedeInhoud(naam, inhoud)) return null
  return (await controleerOnderdeel(lijst, naam, inhoud)) ? inhoud : null
}

// ── Kant van de ontvanger (C) ──
// deps: { eigenId, vrienden: Set, ls, haalSleutel, crypto, db: { get, put }, snel, laatstRechtstreeks(id) -> ms, relay }
const shaCache = new Map() // "<id>:<hash>:<lengte>" -> sha256 van wat ik al heb
async function mijnSha(naam, rec) {
  const inhoud = inhoudUitRecord(naam, rec)
  if (!inhoud) return null
  const k = rec.id + ':' + rec.hash + ':' + inhoud.length
  if (!shaCache.has(k)) { if (shaCache.size > 2000) shaCache.clear(); shaCache.set(k, await inhoudHash(inhoud)) }
  return shaCache.get(k)
}

// Klopt het aangeboden lijstje, is het nieuw voor mij, en welke onderdelen heb ik nog niet (zo)?
// Geeft { ok: false, reden } of { ok: true, nodig: [namen] }
export async function beoordeelLijst(deps, via, eigenaar, lijst) {
  if (!UUID.test(String(eigenaar || '')) || eigenaar === deps.eigenId || eigenaar === via) return { ok: false, reden: 'wie' }
  if (!deps.vrienden.has(eigenaar)) return { ok: false, reden: 'geen vriend' }
  let vorig = null
  try { const r = await deps.db.get(VRIEND_SLEUTEL(eigenaar)); vorig = r && r.data ? JSON.parse(r.data) : null } catch (e) {}
  if (vorig && !isNieuwer(lijst, vorig)) return { ok: false, reden: 'oud' }
  if (lijst && Number(lijst.versie) <= Number(deps.laatstRechtstreeks(eigenaar) || 0)) return { ok: false, reden: 'oud' }
  const r = await controleerVriendLijst(deps, eigenaar, lijst)
  if (r !== 'ok') return { ok: false, reden: r }
  const nodig = []
  for (const [naam, sha] of Object.entries(lijst.items)) {
    if (!isDoorgeefNaam(naam) || (deps.relay && muziekNaam(naam))) continue
    const rec = await deps.db.get('vriend_' + eigenaar + '_' + naam)
    if (!rec || (await mijnSha(naam, rec)) !== sha) nodig.push(naam)
  }
  return { ok: true, nodig }
}

// Een binnengekomen onderdeel bewaren, alleen als het precies past
export async function bewaarOnderdeel(deps, eigenaar, naam, inhoud, lijst) {
  if (!isDoorgeefNaam(naam) || !isGoedeInhoud(naam, inhoud)) return false
  if (!(await controleerOnderdeel(lijst, naam, inhoud))) return false
  const vorig = await deps.db.get('vriend_' + eigenaar + '_' + naam)
  await deps.db.put(recordUitInhoud(eigenaar, naam, inhoud, deps.snel, vorig))
  return true
}
export async function bewaarLijst(deps, eigenaar, lijst) {
  await deps.db.put({ id: VRIEND_SLEUTEL(eigenaar), data: JSON.stringify(lijst), ontvangen: Date.now(), viaVriend: true })
}
