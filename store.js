// store.js (10 nov 2026, v1): de Stekky Store. Wat je gedownload hebt, staat in je account (tabel store_downloads,
// sql/stekky-store.sql) en ook op dit toestel (fibro_store_<id>), zodat Stijl > Lettertype het meteen weet.
// v5 (11 nov 2026): Verwijderen (verwijderDownload) en games alleen aan met download + widget (gameAan).
// v8 (13 nov 2026): stickervellen (STORE_STICKERS), het eerste is Sinterklaas.
// Sinds 11 nov 2026 voor iedereen met een account (eerst alleen moderators): het Store-vakje bij Stijl staat bij
// iedereen, en de database laat iedereen downloaden die niet geblokkeerd is (sql/stekky-store-iedereen.sql).
// Soorten: lettertype (nu), game, sticker en widget (later). Lettertypes komen per thema in een pakket van 4
// (v2, 11 nov 2026): een nieuw pakket staat in STORE_PAKKETTEN (lettertypes.js), de bestanden in lettertypen/.
import { STORE_PAKKETTEN } from './lettertypes.js?v=133'
import { STORE_VELLEN } from './stickervellen.js?v=237'
import { legStoreVakkenVast, zetStoreVelActief } from './stickervakken.js?v=1'   // 13 nov 2026: stickers aanzetten bij Stijl

export const STORE_SOORTEN = [
  // 11 nov 2026: volgorde van de paarse balk in store.html; achtergronden erbij
  { id: 'game', titel: 'Games' },
  { id: 'widget', titel: 'Widgets' },
  { id: 'sticker', titel: 'Stickers' },
  { id: 'achtergrond', titel: 'Achtergronden' },
  { id: 'lettertype', titel: 'Lettertypes' },
]

// Alles wat in de store staat. Elk item: id (uniek, kleine letters/cijfers/streepjes), soort, titel.
// Een lettertype-pakket heeft ook lettertypes (4 stuks).
// Games (11 nov 2026): een spel uit de store staat NIET vanzelf in de app. Na downloaden verschijnt het bij
// Profiel > Widgets > Spellen; zet je die widget aan, dan staat het op Home (tegen de computer) en in het spelmenu
// van de chat (met een vriend). widget = de naam van die widget.
export const STORE_GAMES = [
  { id: 'pesten', soort: 'game', titel: 'Pesten', widget: 'spel_pesten', icoon: 'spelicoon/pesten.webp?v=2',
    uitleg: 'Het kaartspel: leg dezelfde kleur of waarde, pest met een 2 of joker, en roep op tijd "Laatste kaart!". Tegen de computer of met een vriend in de chat.' },
  // 11 nov 2026: twee kaartspellen erbij
  { id: 'toepen', soort: 'game', titel: 'Toepen', widget: 'spel_toepen', icoon: 'spelicoon/toepen.webp?v=2',
    uitleg: 'Vier kaarten, vier slagen, alleen de laatste slag telt. Klop "Toep!" om de inzet te verhogen, en durf te bluffen. Wie 10 strafpunten heeft, verliest.' },
  { id: 'eenentwintigen', soort: 'game', titel: 'Eenentwintigen', widget: 'spel_eenentwintigen', icoon: 'spelicoon/eenentwintigen.webp?v=2',
    uitleg: 'Pak kaarten tot je zo dicht mogelijk bij 21 zit, maar niet erover. Durf jij nog een kaart? Tegen de computer of met een vriend in de chat.' },
  // 13 nov 2026: Koningsjacht, alleen te spelen (op Home), met de perkamentkaarten op een houten tafel
  { id: 'koningsjacht', soort: 'game', titel: 'Koningsjacht', widget: 'spel_koningsjacht', icoon: 'spelicoon/koningsjacht.webp?v=2',
    uitleg: 'Versla in je eentje de twaalf boeren, vrouwen en heren uit het kasteel. Elke soort kaart heeft een eigen kracht. Gebaseerd op Regicide.' },
]
// Stickers (13 nov 2026): een vel van 12 bewegende stickers met geluid (STORE_VELLEN in stickervellen.js). Na downloaden
// staat het bij Stijl > Stickers; zet je het daar aan, dan staat het in de stickerkeuze van de chat bij 'Winkel'.
// Verwijderen (in de Store of bij Stijl): dan is het daar weg (wat je al stuurde, blijft).
export const STORE_STICKERS = STORE_VELLEN.map(v => ({ id: v.store, soort: 'sticker', titel: v.titel, vel: v.id,
  uitleg: 'Twaalf stickers die bewegen en geluid maken: de Sint, Piet, de pakjesboot, Ozosnel, chocoladeletters en meer.' }))
export const STORE_ITEMS = [...STORE_PAKKETTEN.map(p => Object.assign({ soort: 'lettertype' }, p)), ...STORE_GAMES, ...STORE_STICKERS]
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
  // 13 nov 2026: een nieuw stickervel staat eerst uit; je zet het aan bij Stijl > Stickers (stickervakken.js)
  if (STORE_STICKERS.some(s => s.id === id) && !bewaardeDownloads(uid).has(id)) legStoreVakkenVast(uid)
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

// ── Verwijderen (11 nov 2026): alles wat je gedownload hebt kun je altijd weer weghalen, in de Store en op andere
// plekken (Profiel > Widgets voor games, Stijl > Lettertype voor lettertypes). Een game gaat dan ook van Home en uit
// het spelmenu van de chat: de widget gaat uit. Je widgets staan op dit toestel (fibro_widgets_profiel_<id>).
const LAYOUT = uid => 'fibro_widgets_profiel_' + uid
export function gameWidgetAan(uid, widget) {
  try {
    const l = JSON.parse(localStorage.getItem(LAYOUT(uid)) || '[]')
    return Array.isArray(l) && l.some(w => w && w.id === widget && w.aan)
  } catch (e) { return false }
}
export function zetGameWidgetUit(uid, widget) {
  try {
    const l = JSON.parse(localStorage.getItem(LAYOUT(uid)) || '[]')
    if (Array.isArray(l)) {
      const over = l.filter(w => w && w.id !== widget).sort((a, b) => (Number(a.volgorde) || 0) - (Number(b.volgorde) || 0))
        .map((w, i) => Object.assign({}, w, { volgorde: i }))
      localStorage.setItem(LAYOUT(uid), JSON.stringify(over))
    }
  } catch (e) {}
  try {
    const sleutelP = 'fibro_profiel_' + uid
    const p = JSON.parse(localStorage.getItem(sleutelP) || 'null')
    if (p && Array.isArray(p.widgets)) { p.widgets = p.widgets.filter(w => w !== widget); localStorage.setItem(sleutelP, JSON.stringify(p)) }
  } catch (e) {}
}
// Een game uit de store staat aan als hij gedownload is EN de widget aan staat (op dit toestel)
export const gameAan = (uid, game) => bewaardeDownloads(uid).has(game.id) && gameWidgetAan(uid, game.widget)
export async function verwijderDownload(supabase, uid, id) {
  const r = await weghalenItem(supabase, uid, id)
  if (r.error) return r
  const game = STORE_GAMES.find(g => g.id === id)
  if (game) zetGameWidgetUit(uid, game.widget)
  if (STORE_STICKERS.some(s => s.id === id)) zetStoreVelActief(uid, id, false)   // 13 nov 2026: ook uit het vakje in de chat
  return r
}
// Wat er bij een gedownload id hoort (voor de lijstjes met Verwijderen)
export function itemVan(id) {
  const it = STORE_ITEMS.find(i => i.id === id)
  if (it) return it
  const oud = STORE_PAKKETTEN.flatMap(p => p.lettertypes).find(f => f.oud === id)
  return oud ? { id, soort: 'lettertype', titel: oud.label, los: true } : null
}
