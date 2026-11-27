// store.js (10 nov 2026, v1): de Stekky Store. Wat je gedownload hebt, staat in je account (tabel store_downloads,
// sql/stekky-store.sql) en ook op dit toestel (fibro_store_<id>), zodat Stijl > Lettertype het meteen weet.
// v5 (11 nov 2026): Verwijderen (verwijderDownload) en games alleen aan met download + widget (gameAan).
// v8 (13 nov 2026): stickervellen (STORE_STICKERS), het eerste is Sinterklaas.
// v15 (18 nov 2026): widgets (STORE_WIDGETS), de eerste is PeerTube (peertube.js). Werkt net als een game: na
// downloaden staat hij op Home en bij Profiel > Widgets; Verwijderen haalt hem overal weg.
// v16 (18 nov 2026): de muziek-widget (muziekwidget.js): een album of nummer van Funkwhale (25 nov 2026: Bandcamp is eruit).
// v17 (18 nov 2026): de radio (radio.js): internetradio in een vintage radio.
// v18 (19 nov 2026): de RSS-widget (rsswidget.js): de nieuwste koppen van tot 3 feeds.
// v19 (19 nov 2026): de Mastodon-widget (mastodon.js): je openbare berichten, alleen meelezen.
// v20 (19 nov 2026): de weer-widget (weer.js): het weer van een plaats die je kiest, via Open-Meteo.
// 25 nov 2026: de weer-widget is weer weg (Open-Meteo is gratis alleen voor niet-commercieel gebruik).
// Sinds 11 nov 2026 voor iedereen met een account (eerst alleen moderators): het Store-vakje bij Stijl staat bij
// iedereen, en de database laat iedereen downloaden die niet geblokkeerd is (sql/stekky-store-iedereen.sql).
// Soorten: lettertype (nu), game, sticker en widget (later). Lettertypes komen per thema in een pakket van 4
// (v2, 11 nov 2026): een nieuw pakket staat in STORE_PAKKETTEN (lettertypes.js), de bestanden in lettertypen/.
import { STORE_PAKKETTEN } from './lettertypes.js?v=134'
import { STORE_VELLEN } from './stickervellen.js?v=244'
import { legStoreVakkenVast, zetStoreVelActief } from './stickervakken.js?v=8'   // 13 nov 2026: stickers aanzetten bij Stijl
import { zetStandaardWidgets } from './standaardwidgets.js?v=2'   // 17 nov 2026: games meteen op Home
import { STUDIO_LAYOUTS } from './studio-layouts.js?v=3'
import { STUDIO_SPELLEN, spelIcoon as studioIcoon } from './studio-spellen.js?v=8' // 25 nov 2026: spellen uit Stekky Studio (spelmaker.js) // 25 nov 2026: widget-layouts uit Stekky Studio (layouts.js)

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
  { id: 'pesten', soort: 'game', titel: 'Pesten', widget: 'spel_pesten', homeIcoon: '🃏', icoon: 'spelicoon/pesten.webp?v=2',
    uitleg: 'Het kaartspel: leg dezelfde kleur of waarde, pest met een 2 of joker, en roep op tijd "Laatste kaart!". Tegen de computer of met een vriend in de chat.' },
  // 11 nov 2026: twee kaartspellen erbij
  { id: 'toepen', soort: 'game', titel: 'Toepen', widget: 'spel_toepen', homeIcoon: '✊', icoon: 'spelicoon/toepen.webp?v=2',
    uitleg: 'Vier kaarten, vier slagen, alleen de laatste slag telt. Klop "Toep!" om de inzet te verhogen, en durf te bluffen. Wie 10 strafpunten heeft, verliest.' },
  { id: 'eenentwintigen', soort: 'game', titel: 'Black Jack', widget: 'spel_eenentwintigen', homeIcoon: '♠️', icoon: 'spelicoon/eenentwintigen.webp?v=2',
    uitleg: 'Pak kaarten tot je zo dicht mogelijk bij 21 zit, maar niet erover. Durf jij nog een kaart? Tegen de computer of met een vriend in de chat.' },
  // 13 nov 2026: Koningsjacht, alleen te spelen (op Home), met de perkamentkaarten op een houten tafel
  { id: 'koningsjacht', soort: 'game', titel: 'Koningsjacht', widget: 'spel_koningsjacht', homeIcoon: '👑', icoon: 'spelicoon/koningsjacht.webp?v=2',
    uitleg: 'Versla de twaalf boeren, vrouwen en heren uit het kasteel. Alleen, of in de chat met een vriend: samen, als wedstrijd of als duel. Elke soort kaart heeft een eigen kracht.' },
  // 25 nov 2026: spellen uit Stekky Studio
  ...STUDIO_SPELLEN.map(s => ({ id: s.id, soort: 'game', titel: s.naam[0], widget: 'spel_' + s.id, homeIcoon: s.icoon, icoon: studioIcoon(s),
    uitleg: s.uitleg[0], uitlegEn: s.uitleg[1], studio: true })),
]
// Stickers (13 nov 2026): een vel van 12 bewegende stickers met geluid (STORE_VELLEN in stickervellen.js). Na downloaden
// staat het bij Stijl > Stickers; zet je het daar aan, dan staat het in de stickerkeuze van de chat bij 'Winkel'.
// Verwijderen (in de Store of bij Stijl): dan is het daar weg (wat je al stuurde, blijft).
// 23 nov 2026: een vel uit Stekky Studio heeft zijn eigen uitleg [nl, en] (v.uitleg); Sinterklaas houdt zijn vaste tekst.
// Een eigen geluid met licentie CC0 of CC BY: de bron komt onder het pakket te staan (bij CC BY moet het, bij CC0 als dank).
// Dezelfde twee als in studio-pakket.js (LICENTIES, 'vermelding'); een test houdt ze gelijk.
export const LICENTIES_MET_VERMELDING = ['cc0', 'cc-by']
export function geluidVermelding(vel) {
  const bronnen = []
  for (const s of vel.stickers || []) if (s.bron && LICENTIES_MET_VERMELDING.includes(s.licentie) && !bronnen.includes(s.bron)) bronnen.push(s.bron)
  return bronnen.join('; ')
}
export const STORE_STICKERS = STORE_VELLEN.map(v => ({ id: v.store, soort: 'sticker', titel: v.titel, vel: v.id,
  uitleg: v.uitleg ? v.uitleg[0] : 'Twaalf stickers die bewegen en geluid maken: de Sint, Piet, de pakjesboot, Ozosnel, chocoladeletters en meer.',
  uitlegEn: v.uitleg ? v.uitleg[1] : undefined, vermelding: geluidVermelding(v) }))
// Widgets (18 nov 2026): na downloaden meteen op Home (zetGameWidgetAan, met hun eigen maat w × h) en bij
// Profiel > Widgets (widgetRij-<widget>). widget = de naam van de widget, homeIcoon = het icoon in de kop.
export const STORE_WIDGETS = [
  { id: 'peertube', soort: 'widget', titel: 'PeerTube', widget: 'peertube', homeIcoon: '\u{1F3AC}', w: 4, h: 3,
    uitleg: 'Zet een video van PeerTube op je profiel. Je vrienden zien eerst een kaartje; pas als iemand op afspelen tikt, maakt zijn toestel verbinding met PeerTube. Geen reclame, geen aanbevelingen.' },
  { id: 'muziekwidget', soort: 'widget', titel: 'Funkwhale', widget: 'muziekwidget', homeIcoon: '\u{1F3A7}', w: 4, h: 3,
    uitleg: 'Zet een album of nummer van Funkwhale op je profiel: vrij gelicentieerde muziek. Je vrienden zien eerst een kaartje; pas als iemand op luisteren tikt, maakt zijn toestel verbinding met Funkwhale. Geen reclame.' },
  { id: 'radio', soort: 'widget', titel: 'Radio', widget: 'radio', homeIcoon: '\u{1F4FB}', w: 4, h: 3,
    uitleg: 'Een ouderwetse radio op je profiel, met tot 4 zenders van over de hele wereld: zoek op naam, land of muzieksoort, of plak je eigen stream-link. Pas als iemand op afspelen tikt, maakt zijn toestel verbinding met de zender.' },
  { id: 'rss', soort: 'widget', titel: 'RSS-feed', widget: 'rss', homeIcoon: '\u{1F4F0}', w: 4, h: 3,
    uitleg: 'De nieuwste koppen van je favoriete sites op je profiel, van tot 3 RSS-feeds. De server van Stekky haalt de koppen op, niet je toestel; daarna stuurt je toestel ze naar je vrienden. Pas als iemand op een kop tikt, opent het artikel op de site zelf.' },
  { id: 'mastodon', soort: 'widget', titel: 'Mastodon', widget: 'mastodon', homeIcoon: '\u{1F418}', w: 4, h: 3,
    uitleg: 'Je openbare Mastodon-berichten op je profiel, met een knop "Volg mij op Mastodon". Stekky logt niet in bij Mastodon: alleen openbare berichten, de server van Stekky leest mee (niet je toestel) en daarna stuurt je toestel ze naar je vrienden. Gevoelige plaatjes worden overgeslagen en berichten met een waarschuwing blijven dicht tot je erop tikt.' },
  // 26 nov 2026 (Marcel): al je spellen op een rij, jouw beste score naast die van je beste vriend (scorebordwidget.js)
  { id: 'scorebord', soort: 'widget', titel: 'Scorebord', widget: 'scorebord', homeIcoon: '\u{1F3C6}', w: 4, h: 3,
    uitleg: 'Al je spellen op een rij: jouw beste score naast die van je beste vriend. Wie staat er voor? Tik op een spel om meteen te spelen. Alleen je echte vrienden doen mee, en alleen jij ziet deze widget.',
    uitlegEn: 'All your games in a row: your best score next to your best friend\'s. Who is ahead? Tap a game to play right away. Only your real friends take part, and only you see this widget.' },
  // 27 nov 2026 (Marcel): je casino-tokens, elke week 250 erbij (casinowidget.js, sql/casino-tokens.sql)
  { id: 'casino', soort: 'widget', titel: 'Casino', widget: 'casino', homeIcoon: '\u{1F3B0}', w: 4, h: 3,
    uitleg: 'Je casino-tokens op Home: elke week krijg je er 250 bij en je kunt tot -100 staan. Zet ze in bij Black Jack tegen de computer en kijk wie van je vrienden de rijkste is. Tokens zijn speelgeld: je kunt ze niet kopen of inwisselen.',
    uitlegEn: 'Your casino tokens on Home: you get 250 more every week and you can go down to -100. Bet them at Black Jack against the computer and see which of your friends is the richest. Tokens are play money: you cannot buy or cash them in.' },
  // 25 nov 2026: widget-layouts uit Stekky Studio: één widget met een paar bestaande widgets samen (layouts.js)
  ...STUDIO_LAYOUTS.map(l => ({ id: l.store, soort: 'widget', titel: l.titel, widget: 'mix_' + l.id, homeIcoon: '\u{1F9E9}', w: 4, h: l.h,
    uitleg: l.uitleg[0], uitlegEn: l.uitleg[1], layout: true })),
]
export const STORE_ITEMS = [...STORE_PAKKETTEN.map(p => Object.assign({ soort: 'lettertype' }, p)), ...STORE_GAMES, ...STORE_WIDGETS, ...STORE_STICKERS]
// Welke widgets uit de Store mag je aanzetten (wat je gedownload hebt): games en (sinds v15) widgets
export const gameWidgets = ids => [...STORE_GAMES, ...STORE_WIDGETS].filter(g => ids.has(g.id)).map(g => g.widget)
// Een game of widget uit de Store bij zijn id
export const storeWidgetItem = id => STORE_GAMES.find(g => g.id === id) || STORE_WIDGETS.find(g => g.id === id) || null

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
// 17 nov 2026: na downloaden komt een game meteen op Home (in "Jouw profiel"), tenzij daar geen ruimte meer is. Home
// is 4 vakjes breed; we tellen de vakjes die de widgets nu gebruiken (breed × hoog). Een game is 2 × 1.
// HOME_MAX_VAKJES = 12 rijen van 4. Past hij niet meer, dan zet je hem zelf aan bij Profiel > Widgets > Spellen.
// Geeft 'aan' (staat nu op Home), 'al' (stond er al) of 'vol' (geen ruimte meer).
export const HOME_MAX_VAKJES = 48
export function vakjesInGebruik(layout) {
  return (Array.isArray(layout) ? layout : []).filter(w => w && w.aan)
    .reduce((n, w) => n + Math.max(1, Math.min(4, Number(w.w) || 2)) * Math.max(1, Number(w.h) || 1), 0)
}
export function zetGameWidgetAan(uid, game, ls = localStorage) {
  const def = { id: game.widget, icon: game.homeIcoon || '🎮', titel: game.titel, w: game.w || 2, h: game.h || 1 } // v15: een widget heeft zijn eigen maat
  try {
    const sleutelL = LAYOUT(uid)
    // Nog nooit een indeling bewaard (nieuw account): eerst de standaard-widgets, zodat die niet wegvallen
    if (ls.getItem(sleutelL) === null) zetStandaardWidgets(ls, uid)
    let l = JSON.parse(ls.getItem(sleutelL) || '[]')
    if (!Array.isArray(l)) l = []
    if (l.some(w => w && w.id === def.id && w.aan)) return 'al'
    l = l.filter(w => w && w.id !== def.id)
    if (vakjesInGebruik(l) + def.w * def.h > HOME_MAX_VAKJES) return 'vol'
    const volgorde = l.reduce((m, w) => Math.max(m, Number(w.volgorde) || 0), -1) + 1
    l.push(Object.assign({}, def, { volgorde, aan: true }))
    ls.setItem(sleutelL, JSON.stringify(l))
    // Stijl (profiel.html) leest de schakelaars uit fibro_profiel_<id>.widgets als die er is: daar ook bij zetten,
    // anders zou de volgende keer Opslaan hem weer van Home halen.
    const sleutelP = 'fibro_profiel_' + uid
    const p = JSON.parse(ls.getItem(sleutelP) || 'null')
    if (p && Array.isArray(p.widgets) && !p.widgets.includes(def.id)) { p.widgets.push(def.id); ls.setItem(sleutelP, JSON.stringify(p)) }
    return 'aan'
  } catch (e) { return 'vol' }
}
// Een game uit de store staat aan als hij gedownload is EN de widget aan staat (op dit toestel)
export const gameAan = (uid, game) => bewaardeDownloads(uid).has(game.id) && gameWidgetAan(uid, game.widget)
export async function verwijderDownload(supabase, uid, id) {
  const r = await weghalenItem(supabase, uid, id)
  if (r.error) return r
  const game = storeWidgetItem(id) // v15: ook een widget gaat van Home
  if (game) zetGameWidgetUit(uid, game.widget)
  const vel = STORE_STICKERS.find(s => s.id === id)
  if (vel) {
    zetStoreVelActief(uid, id, false)   // 13 nov 2026: ook uit het vakje in de chat
    for (let i = 1; i <= 12; i++) zetGameWidgetUit(uid, 'sticker_' + vel.vel + '-' + String(i).padStart(2, '0'))   // en van Home
  }
  return r
}
// Wat er bij een gedownload id hoort (voor de lijstjes met Verwijderen)
export function itemVan(id) {
  const it = STORE_ITEMS.find(i => i.id === id)
  if (it) return it
  const oud = STORE_PAKKETTEN.flatMap(p => p.lettertypes).find(f => f.oud === id)
  return oud ? { id, soort: 'lettertype', titel: oud.label, los: true } : null
}
