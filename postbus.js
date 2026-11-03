// postbus.js (v1, 3 nov 2026): kleine profielupdates ook als je vriend niet tegelijk online is.
//
// De sync (sync.js) gaat rechtstreeks tussen twee telefoons en werkt dus alleen als jullie TEGELIJK online zijn. Voor de
// KLEINE onderdelen van je profiel zet Fibro nu ook een versleuteld pakketje klaar op de server, per vriend:
//   - de indeling van je widgets (layout), de tekstwidgets (quote, aftelteller, opteller, poll), je blokstijl en je
//     weergavenaam.
// Foto's, muziek, video's en stickers gaan hier NIET mee: die blijven rechtstreeks gaan, zoals altijd.
//
// - Versleuteld met dezelfde sleutels als berichten (crypto.js): de server kan het niet lezen.
// - Per vriend alleen de NIEUWSTE stand (tabel profiel_post, sleutel afzender+ontvanger): er stapelt niets op.
// - Je vriend haalt het op zodra hij Fibro opent, zet het op zijn toestel en wist het meteen van de server.
// - Kregen jullie elkaar intussen rechtstreeks te pakken, dan wordt het klaargezette pakketje ook gewist.
// - Is de sleutel van een vriend veranderd (en heb je dat nog niet bevestigd in de chat), dan gaat er niets heen en
//   wordt er niets van hem geopend.
// sql/profiel-post.sql maakt de tabel. Bestaat die nog niet, dan doet dit bestand stil niets.

export const VOORVOEGSEL = 'fibro-profiel-v1:'
export const KLEIN = ['quote', 'aftel', 'optel', 'poll']
const KLEIN_MAX = 20000          // zoals de sync
const LAYOUT_MAX = 60000
const PAKKET_MAX = 150000        // tekens, na versleutelen; de server staat 200000 toe
const NAAM_MAX = 40

export function hashString(s) { // dezelfde als in sync.js
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return h.toString(36)
}

function leesLs(ls, sleutel) { try { return ls.getItem(sleutel) } catch (e) { return null } }

function normaalBlokstijl(r) {
  if (!r || typeof r !== 'object') return null
  const kleur = typeof r.kleur === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.kleur) ? r.kleur : null
  const d = Number(r.doorzicht), h = Number(r.hoek)
  const doorzicht = r.doorzicht != null && r.doorzicht !== '' && Number.isFinite(d) ? Math.max(0, Math.min(100, Math.round(d))) : null
  const hoek = r.hoek != null && r.hoek !== '' && Number.isFinite(h) ? Math.max(0, Math.min(50, Math.round(h))) : null
  return kleur !== null && doorzicht !== null && hoek !== null ? { kleur, doorzicht, hoek } : null
}

// Het pakketje met je eigen kleine onderdelen, uit dit toestel (dezelfde plekken als sync.js maakManifest gebruikt)
export function maakKleinPakket(uid, ls) {
  const pakket = { layout: '[]', klein: {}, blokstijl: null, naam: '' }
  const layout = leesLs(ls, 'fibro_widgets_profiel_' + uid) || '[]'
  if (layout.length <= LAYOUT_MAX) pakket.layout = layout
  for (const sl of KLEIN) {
    const w = leesLs(ls, sl + '_' + uid)
    if (w && w.length <= KLEIN_MAX) pakket.klein[sl] = w
  }
  try {
    const r = JSON.parse(leesLs(ls, 'fibro_blokstijl') || '{}') || {}
    pakket.blokstijl = normaalBlokstijl({ kleur: r.kleur || '#ffffff', doorzicht: r.doorzicht ?? 12, hoek: r.hoek ?? 14 })
  } catch (e) {}
  try { pakket.naam = String(JSON.parse(leesLs(ls, 'fibro_profiel_' + uid) || '{}').naam || '').slice(0, NAAM_MAX) } catch (e) {}
  return pakket
}

export function pakketHash(pakket) { return hashString(JSON.stringify(pakket)) }

export function inpakken(pakket) { return VOORVOEGSEL + JSON.stringify(pakket) }

// Streng controleren wat er binnenkomt; null = niet gebruiken
export function uitpakken(tekst) {
  if (typeof tekst !== 'string' || !tekst.startsWith(VOORVOEGSEL) || tekst.length > PAKKET_MAX) return null
  let p
  try { p = JSON.parse(tekst.slice(VOORVOEGSEL.length)) } catch (e) { return null }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const uit = { layout: null, klein: {}, blokstijl: null, naam: '' }
  if (typeof p.layout === 'string' && p.layout.length <= LAYOUT_MAX) {
    try { if (Array.isArray(JSON.parse(p.layout))) uit.layout = p.layout } catch (e) {}
  }
  if (p.klein && typeof p.klein === 'object' && !Array.isArray(p.klein)) {
    for (const sl of KLEIN) if (typeof p.klein[sl] === 'string' && p.klein[sl].length <= KLEIN_MAX) uit.klein[sl] = p.klein[sl]
  }
  uit.blokstijl = normaalBlokstijl(p.blokstijl)
  if (typeof p.naam === 'string') uit.naam = p.naam.slice(0, NAAM_MAX).trim()
  return uit
}

// Een uitgepakt pakketje van een vriend op dit toestel zetten, op precies de plekken waar de sync het ook zet.
// db: { get, put, del } (die van sync.js, zodat open pagina's meteen bijwerken). Geeft terug wat er veranderde.
export async function pasToe(vriendId, eigenId, p, db, ls) {
  const veranderd = []
  const pre = 'vriend_' + vriendId + '_'
  const zet = async (id, data) => {
    const hash = hashString(data)
    const oud = await db.get(id)
    if (oud && oud.hash === hash) return
    await db.put({ id, hash, data, ontvangen: Date.now() })
    veranderd.push(id.slice(pre.length))
  }
  if (p.layout !== null) await zet(pre + 'layout', p.layout)
  for (const sl of KLEIN) {
    if (typeof p.klein[sl] === 'string') await zet(pre + sl, p.klein[sl])
    else if (await db.get(pre + sl)) { await db.del(pre + sl); veranderd.push(sl) } // weggehaald bij de vriend
  }
  if (p.blokstijl) await zet(pre + 'blokstijl', JSON.stringify(p.blokstijl))
  if (p.naam) {
    const sleutel = 'vriend_naam_' + vriendId + '_' + eigenId
    try { if (ls.getItem(sleutel) !== p.naam) { ls.setItem(sleutel, p.naam); veranderd.push('naam') } } catch (e) {}
  }
  return veranderd
}

// ---- met de server ----
// deps: { supabase, crypto: { versleutel, ontsleutelBericht, sleutelVingerafdruk, isZelfdeSleutel }, privateKey,
//         eigenId, ls, db, log }
const BIJ = uid => 'fibro_postbus_' + uid          // { [vriendId]: hash van wat die vriend al heeft of klaarstaat }
const VERTROUWD = (uid, id) => 'fibro_vriendsleutel_' + uid + '_' + id // dezelfde als chat.html

function leesBij(ls, uid) { try { return JSON.parse(ls.getItem(BIJ(uid)) || '{}') || {} } catch (e) { return {} } }
function zetBij(ls, uid, bij) { try { ls.setItem(BIJ(uid), JSON.stringify(bij)) } catch (e) {} }

// Mag ik met deze sleutel van deze vriend werken? Een onthouden vingerafdruk die niet past = nee.
async function sleutelOk(deps, vriendId, publicKey) {
  if (typeof publicKey !== 'string' || publicKey.length <= 10) return false
  let onthouden = null
  try { onthouden = deps.ls.getItem(VERTROUWD(deps.eigenId, vriendId)) } catch (e) {}
  if (!onthouden) return true
  try { return deps.crypto.isZelfdeSleutel(onthouden, await deps.crypto.sleutelVingerafdruk(publicKey)) } catch (e) { return false }
}

let tabelOntbreekt = false
function ontbreekt(error) {
  if (error && (error.code === '42P01' || error.code === 'PGRST205' || /profiel_post/.test(error.message || '') && /exist|schema cache/i.test(error.message || ''))) {
    tabelOntbreekt = true
    return true
  }
  return false
}

// Je eigen kleine onderdelen klaarzetten voor elke vriend die ze nog niet heeft. vrienden: [{ id, public_key }]
export async function verstuur(deps, vrienden) {
  if (tabelOntbreekt || !deps.privateKey || !deps.eigenId) return 0
  const pakket = maakKleinPakket(deps.eigenId, deps.ls)
  const hash = pakketHash(pakket)
  const tekst = inpakken(pakket)
  const bij = leesBij(deps.ls, deps.eigenId)
  let gezet = 0
  for (const v of vrienden || []) {
    if (!v || typeof v.id !== 'string' || v.id === deps.eigenId || bij[v.id] === hash) continue
    if (!(await sleutelOk(deps, v.id, v.public_key))) { deps.log && deps.log('[postbus] sleutel van vriend veranderd, niets klaargezet'); continue }
    let inhoud
    try { inhoud = await deps.crypto.versleutel(tekst, deps.privateKey, v.public_key, { soort: 'bericht', van: deps.eigenId, naar: v.id }) } catch (e) { continue }
    if (inhoud.length > PAKKET_MAX) { deps.log && deps.log('[postbus] pakketje te groot'); return gezet }
    const { error } = await deps.supabase.from('profiel_post').upsert({ afzender: deps.eigenId, ontvanger: v.id, inhoud }, { onConflict: 'afzender,ontvanger' })
    if (error) { if (ontbreekt(error)) return gezet; deps.log && deps.log('[postbus] klaarzetten mislukt:', error.code || error.message); continue }
    bij[v.id] = hash
    gezet++
  }
  zetBij(deps.ls, deps.eigenId, bij)
  return gezet
}

// Wat vrienden voor mij klaarzetten: ophalen, openen, op dit toestel zetten en van de server wissen.
// sindsRechtstreeks(vriendId): wanneer ik voor het laatst rechtstreeks met hem synchroniseerde (ms, of 0).
export async function haalOp(deps, sindsRechtstreeks = () => 0) {
  if (tabelOntbreekt || !deps.privateKey || !deps.eigenId) return []
  const { data, error } = await deps.supabase.from('profiel_post').select('afzender, inhoud, bijgewerkt').eq('ontvanger', deps.eigenId)
  if (error) { if (!ontbreekt(error)) deps.log && deps.log('[postbus] ophalen mislukt:', error.code || error.message); return [] }
  if (!Array.isArray(data) || !data.length) return []
  const ids = data.map(r => r.afzender).filter(id => typeof id === 'string')
  const { data: profielen } = await deps.supabase.from('profiles').select('id, public_key').in('id', ids)
  const sleutels = {}
  for (const p of profielen || []) sleutels[p.id] = p.public_key
  const klaar = []
  for (const r of data) {
    const van = r.afzender
    if (typeof van !== 'string' || van === deps.eigenId) continue
    const tijd = new Date(r.bijgewerkt).getTime() || 0
    // Rechtstreeks gesynchroniseerd NA dit pakketje? Dan is wat ik heb nieuwer: alleen wissen.
    if (sindsRechtstreeks(van) > tijd + 60000) { await wis(deps, van, deps.eigenId); continue }
    if (!(await sleutelOk(deps, van, sleutels[van]))) { deps.log && deps.log('[postbus] sleutel van vriend veranderd, pakketje niet geopend'); continue }
    let open
    try { open = await deps.crypto.ontsleutelBericht(r.inhoud, deps.privateKey, sleutels[van], { soort: 'bericht', van, naar: deps.eigenId }) } catch (e) { open = null }
    const p = open && (open.status === 'v2' || open.status === 'tijd') ? uitpakken(open.tekst) : null
    if (p) {
      const veranderd = await pasToe(van, deps.eigenId, p, deps.db, deps.ls)
      klaar.push({ van, veranderd })
    }
    await wis(deps, van, deps.eigenId) // ook een onleesbaar pakketje heeft geen zin meer
  }
  return klaar
}

export async function wis(deps, afzender, ontvanger) {
  if (tabelOntbreekt) return
  const { error } = await deps.supabase.from('profiel_post').delete().eq('afzender', afzender).eq('ontvanger', ontvanger)
  if (error) ontbreekt(error)
}

// Rechtstreeks klaar met deze vriend: hij heeft mijn nieuwste stand, een klaargezet pakketje is niet meer nodig.
export async function rechtstreeksKlaar(deps, vriendId) {
  if (!deps.eigenId || !vriendId) return
  const bij = leesBij(deps.ls, deps.eigenId)
  bij[vriendId] = pakketHash(maakKleinPakket(deps.eigenId, deps.ls))
  zetBij(deps.ls, deps.eigenId, bij)
  await wis(deps, deps.eigenId, vriendId)
}
