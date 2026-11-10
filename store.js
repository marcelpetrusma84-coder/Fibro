// store.js (10 nov 2026, v1): de Stekky Store. Wat je gedownload hebt, staat in je account (tabel store_downloads,
// sql/stekky-store.sql) en ook op dit toestel (fibro_store_<id>), zodat Stijl > Lettertype het meteen weet.
// Voorlopig alleen voor moderators: het Store-vakje bij Stijl staat alleen bij moderators, store.html vraagt het
// nog eens aan de server (ben_ik_moderator), en de database laat alleen moderators iets downloaden.
// Soorten: lettertype (nu), game, sticker en widget (later). Een nieuw lettertype: een regel in STORE_LETTERTYPES
// (lettertypes.js) en de bestanden in lettertypen/.
import { STORE_LETTERTYPES } from './lettertypes.js?v=131'

export const STORE_SOORTEN = [
  { id: 'lettertype', titel: 'Lettertypes' },
  { id: 'game', titel: 'Games' },
  { id: 'sticker', titel: 'Stickers' },
  { id: 'widget', titel: 'Widgets' },
]

// Alles wat in de store staat. Elk item: id (uniek, kleine letters/cijfers/streepjes), soort, naam.
export const STORE_ITEMS = STORE_LETTERTYPES.map(f => Object.assign({ soort: 'lettertype' }, f))

const GELDIG = /^[a-z0-9-]{1,64}$/
const sleutel = uid => 'fibro_store_' + uid

// Wat op dit toestel bewaard is (snel, ook zonder internet).
export function bewaardeDownloads(uid) {
  try {
    const lijst = JSON.parse(localStorage.getItem(sleutel(uid)) || '[]')
    return new Set(Array.isArray(lijst) ? lijst.filter(id => GELDIG.test(String(id))) : [])
  } catch (e) { return new Set() }
}
function bewaar(uid, set) {
  try { localStorage.setItem(sleutel(uid), JSON.stringify([...set].sort())) } catch (e) {}
}

// Is de tabel er nog niet (sql/stekky-store.sql nog niet uitgevoerd)?
export function tabelOntbreekt(error) {
  if (!error) return false
  const t = String(error.code || '') + ' ' + String(error.message || '')
  return /42P01|PGRST205|store_downloads/.test(t) && /42P01|PGRST205|does not exist|not find|schema cache/i.test(t)
}

// Haalt je downloads uit je account en werkt het toestel bij. Lukt dat niet: { ids: wat op het toestel staat, error }.
export async function mijnDownloads(supabase, uid) {
  const { data, error } = await supabase.from('store_downloads').select('item_id').eq('user_id', uid)
  if (error) return { ids: bewaardeDownloads(uid), error }
  const ids = new Set((data || []).map(r => String(r.item_id)).filter(id => GELDIG.test(id)))
  bewaar(uid, ids)
  return { ids, error: null }
}

export async function downloadItem(supabase, uid, id) {
  if (!GELDIG.test(String(id))) return { error: { message: 'ongeldig item' } }
  const { error } = await supabase.from('store_downloads').insert({ user_id: uid, item_id: id })
  if (error && String(error.code) !== '23505') return { error } // 23505 = had je al: ook goed
  const ids = bewaardeDownloads(uid); ids.add(id); bewaar(uid, ids)
  return { error: null }
}

export async function weghalenItem(supabase, uid, id) {
  if (!GELDIG.test(String(id))) return { error: { message: 'ongeldig item' } }
  const { error } = await supabase.from('store_downloads').delete().eq('user_id', uid).eq('item_id', id)
  if (error) return { error }
  const ids = bewaardeDownloads(uid); ids.delete(id); bewaar(uid, ids)
  return { error: null }
}
