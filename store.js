// store.js (10 nov 2026, v1): de Stekky Store. Wat je gedownload hebt, staat in je account (tabel store_downloads,
// sql/stekky-store.sql) en ook op dit toestel (fibro_store_<id>), zodat Stijl > Lettertype het meteen weet.
// Sinds 11 nov 2026 voor iedereen met een account (eerst alleen moderators): het Store-vakje bij Stijl staat bij
// iedereen, en de database laat iedereen downloaden die niet geblokkeerd is (sql/stekky-store-iedereen.sql).
// Soorten: lettertype (nu), game, sticker en widget (later). Lettertypes komen per thema in een pakket van 4
// (v2, 11 nov 2026): een nieuw pakket staat in STORE_PAKKETTEN (lettertypes.js), de bestanden in lettertypen/.
import { STORE_PAKKETTEN } from './lettertypes.js?v=132'

export const STORE_SOORTEN = [
  { id: 'lettertype', titel: 'Lettertypes' },
  { id: 'game', titel: 'Games' },
  { id: 'sticker', titel: 'Stickers' },
  { id: 'widget', titel: 'Widgets' },
]

// Alles wat in de store staat. Elk item: id (uniek, kleine letters/cijfers/streepjes), soort, titel.
// Een lettertype-pakket heeft ook lettertypes (4 stuks).
// Games (11 nov 2026): een spel uit de store staat NIET vanzelf in de app. Na downloaden verschijnt het bij
// Profiel > Widgets > Spellen; zet je die widget aan, dan staat het op Home (tegen de computer) en in het spelmenu
// van de chat (met een vriend). widget = de naam van die widget.
export const STORE_GAMES = [
  { id: 'pesten', soort: 'game', titel: 'Pesten', widget: 'spel_pesten', icoon: 'spelicoon/pesten.webp?v=2',
    uitleg: 'Het kaartspel: leg dezelfde kleur of waarde, pest met een 2 of joker, en roep op tijd "Laatste kaart!". Tegen de computer of met een vriend in de chat.' },
]
export const STORE_ITEMS = [...STORE_PAKKETTEN.map(p => Object.assign({ soort: 'lettertype' }, p)), ...STORE_GAMES]
// Welke game-widgets mag je aanzetten (wat je gedownload hebt)
export const gameWidgets = ids => STORE_GAMES.filter(g => ids.has(g.id)).map(g => g.widget)

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
