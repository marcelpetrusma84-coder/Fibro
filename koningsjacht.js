// koningsjacht.js - de spelregels van Koningsjacht, alleen tegen het kasteel (v1, 13 nov 2026). Geen scherm, alleen
// rekenen: gebruikt door koningsjacht-ui.js en door tests/kaart/test-koningsjacht-regels.mjs.
// Gebaseerd op het idee van Regicide (Badgers From Mars); de naam, de teksten en de uitwerking zijn van Stekky.
//
// In gewone woorden, de regels:
//   - Het kasteel: 12 vijanden op een stapel. Eerst de 4 boeren, dan de 4 vrouwen, dan de 4 heren (elk groepje
//     geschud). De bovenste is de vijand die je nu bevecht.
//       boer:  20 leven, valt aan met 10        vrouw: 30 leven, valt aan met 15        heer: 40 leven, valt aan met 20
//   - De taveerne: de stapel met alle kaarten aas t/m 10 (40 kaarten). Je hebt er 8 in je hand (meer mag niet).
//   - Een beurt heeft twee stappen:
//       1. AANVALLEN: speel een kaart. Hij doet zoveel schade als erop staat (aas = 1). Of speel samen:
//            - een aas met één andere kaart (de waarden tellen op), of
//            - 2 t/m 4 kaarten met dezelfde waarde, als ze samen niet meer dan 10 zijn (vier 2'en, drie 3'en, twee 5'en).
//          Of pas (maar niet twee beurten achter elkaar).
//          Elke soort in je aanval geeft een kracht, zo sterk als de aanval:
//            ♥ harten  - zoveel kaarten van de aflegstapel gaan (geschud) onder de taveerne (genezen)
//            ♦ ruiten  - pak zoveel kaarten van de taveerne (tot je 8 hebt)
//            ♣ klaveren - dubbele schade
//            ♠ schoppen - een schild: de vijand valt zoveel minder hard aan (het schild blijft tot hij verslagen is)
//          Eerst ♥, dan ♦. Een vijand kan niet tegen zijn eigen soort: die kracht werkt dan niet (de schade wel).
//       2. AFWEREN: de vijand slaat terug. Gooi kaarten af die samen minstens zijn aanval (min je schild) waard zijn.
//          Lukt dat niet, dan heb je verloren.
//   - Verslagen? Precies op nul = de vijand komt bij jou: bovenop de taveerne. Anders gaat hij naar de aflegstapel.
//     De kaarten die je tegen hem speelde gaan naar de aflegstapel. Er komt meteen een nieuwe vijand, en hij slaat
//     niet terug (je slaat stap 2 over).
//   - Een kaart van het kasteel in je hand telt mee: een boer is 10, een vrouw 15, een heer 20.
//   - Narren: een nar gooit je hele hand weg en geeft je 8 nieuwe kaarten. Hoeveel je er krijgt hangt af van het
//     niveau: Schildknaap 4, Ridder 2, Koning 0. Je mag een nar inzetten bij aanvallen en bij afweren.
//   - Gewonnen als alle 12 verslagen zijn. Een gouden medaille zonder narren, zilver met 1, brons met meer.
//
// De stand is één gewoon object (zie nieuwSpel). Alle functies geven een NIEUWE stand terug of null als het niet mag.

export const KLEUREN = ['h', 'r', 'k', 's']
export const GETALLEN = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10']
export const HOOFDEN = ['B', 'V', 'H']
export const MAX_HAND = 8
export const VIJAND = { B: { leven: 20, aanval: 10 }, V: { leven: 30, aanval: 15 }, H: { leven: 40, aanval: 20 } }
export const NIVEAUS = { schildknaap: { narren: 4 }, ridder: { narren: 2 }, koning: { narren: 0 } }
export const AANTAL_VIJANDEN = 12

export const kaartInfo = id => ({ kleur: String(id)[0], waarde: String(id).slice(1) })
export const isKaart = id => typeof id === 'string' && KLEUREN.includes(id[0]) && (GETALLEN.includes(id.slice(1)) || HOOFDEN.includes(id.slice(1)))
// Wat een kaart waard is: aas 1, 2..10 wat erop staat, boer 10, vrouw 15, heer 20
export function waarde(id) {
  const w = kaartInfo(id).waarde
  if (w === 'A') return 1
  if (VIJAND[w]) return VIJAND[w].aanval
  return Number(w)
}
export const som = ids => ids.reduce((t, id) => t + waarde(id), 0)

export function schud(lijst, rng = Math.random) {
  const a = lijst.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const kopie = s => JSON.parse(JSON.stringify(s))

export function nieuwSpel({ niveau = 'ridder', rng = Math.random } = {}) {
  if (!NIVEAUS[niveau]) niveau = 'ridder'
  const groep = w => schud(KLEUREN.map(k => k + w), rng)
  const kasteel = [...groep('B'), ...groep('V'), ...groep('H')]
  const taveerne = schud(KLEUREN.flatMap(k => GETALLEN.map(w => k + w)), rng)
  const s = { niveau, kasteel, taveerne, afleg: [], hand: [], tafel: [], schade: 0, schild: 0,
    narren: NIVEAUS[niveau].narren, narrenGebruikt: 0, fase: 'aanval', vorigePas: false, verslagen: 0,
    klaar: false, gewonnen: false, beurt: 0, laatste: { soort: 'begin', kaarten: [] } }
  trek(s, MAX_HAND)
  return s
}

// Pak tot n kaarten van de taveerne (zo veel als er zijn en zo lang je hand niet vol is)
function trek(s, n) {
  const gepakt = []
  while (n-- > 0 && s.taveerne.length && s.hand.length < MAX_HAND) { const id = s.taveerne.shift(); s.hand.push(id); gepakt.push(id) }
  return gepakt
}

export const vijand = s => s.kasteel[0] || null
export function vijandInfo(s) {
  const id = vijand(s)
  if (!id) return null
  const { kleur, waarde: w } = kaartInfo(id)
  return { id, kleur, soort: w, leven: VIJAND[w].leven, aanval: VIJAND[w].aanval, over: Math.max(0, VIJAND[w].leven - s.schade),
    slag: Math.max(0, VIJAND[w].aanval - s.schild) }
}
// Hoeveel je nu moet afweren
export const teAfweren = s => (vijandInfo(s) || { slag: 0 }).slag

// Mag je deze kaarten samen spelen bij het aanvallen?
export function geldigeAanval(ids) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || !ids.every(isKaart)) return false
  if (ids.length === 1) return true
  const w = ids.map(id => kaartInfo(id).waarde)
  if (ids.length === 2 && w.includes('A')) return true                          // aas met één andere kaart
  if (ids.length > 4 || !w.every(x => x === w[0]) || HOOFDEN.includes(w[0])) return false
  return som(ids) <= 10                                                        // zelfde waarde, samen niet meer dan 10
}

// Wat een aanval doet (zonder iets te veranderen): voor de knop en de uitleg in het spel
export function aanvalUitkomst(s, ids) {
  const v = vijandInfo(s)
  if (!v || !geldigeAanval(ids)) return null
  const kracht = som(ids)
  const soorten = [...new Set(ids.map(id => kaartInfo(id).kleur))]
  const werkt = soorten.filter(k => k !== v.kleur)
  const schade = kracht * (werkt.includes('k') ? 2 : 1)
  return { kracht, schade, soorten, werkt, immuun: soorten.includes(v.kleur) ? v.kleur : null, verslagen: s.schade + schade >= v.leven }
}

const inHand = (s, ids) => ids.every(id => s.hand.includes(id))

export function magAanvallen(s, ids) {
  return Boolean(s && !s.klaar && s.fase === 'aanval' && geldigeAanval(ids) && inHand(s, ids))
}
export function magPassen(s) { return Boolean(s && !s.klaar && s.fase === 'aanval' && !s.vorigePas) }
export function magNar(s) { return Boolean(s && !s.klaar && s.narren > 0 && (s.fase === 'aanval' || s.fase === 'verdedig')) }
export function magAfweren(s, ids) {
  return Boolean(s && !s.klaar && s.fase === 'verdedig' && Array.isArray(ids) && ids.length && new Set(ids).size === ids.length
    && inHand(s, ids) && som(ids) >= teAfweren(s))
}

// Kun je nog verder? Zo niet, dan is het verloren.
function controleer(s) {
  if (s.klaar) return s
  if (s.fase === 'verdedig' && som(s.hand) < teAfweren(s) && s.narren === 0) { s.klaar = true; s.gewonnen = false; s.laatste.verloren = 'afweren' }
  else if (s.fase === 'aanval' && !s.hand.length && s.vorigePas && s.narren === 0) { s.klaar = true; s.gewonnen = false; s.laatste.verloren = 'leeg' }
  return s
}

// Na het aanvallen of passen: slaat de vijand terug?
function naarAfweren(s) {
  if (teAfweren(s) <= 0) { s.fase = 'aanval'; s.laatste.geenSlag = true; return controleer(s) }
  s.fase = 'verdedig'
  return controleer(s)
}

export function valAan(s0, ids) {
  if (!magAanvallen(s0, ids)) return null
  const s = kopie(s0)
  const u = aanvalUitkomst(s, ids)
  const v = vijandInfo(s)
  s.hand = s.hand.filter(id => !ids.includes(id))
  s.tafel.push(...ids)
  s.beurt++; s.vorigePas = false
  const l = { soort: 'aanval', kaarten: ids.slice(), vijand: v.id, kracht: u.kracht, schade: u.schade, werkt: u.werkt, immuun: u.immuun,
    genezen: 0, gepakt: [], schild: 0 }
  // ♥ eerst: kaarten van de aflegstapel onder de taveerne
  if (u.werkt.includes('h')) {
    const terug = schud(s.afleg).slice(0, u.kracht)
    s.afleg = s.afleg.filter(id => !terug.includes(id))
    s.taveerne.push(...terug)
    l.genezen = terug.length
  }
  // ♦ dan: kaarten pakken
  if (u.werkt.includes('r')) l.gepakt = trek(s, u.kracht)
  // ♠ schild
  if (u.werkt.includes('s')) { s.schild += u.kracht; l.schild = u.kracht }
  s.schade += u.schade
  if (s.schade >= v.leven) {
    l.verslagen = true; l.precies = s.schade === v.leven
    s.afleg.push(...s.tafel); s.tafel = []
    s.kasteel.shift()
    if (l.precies) s.taveerne.unshift(v.id); else s.afleg.push(v.id)
    s.verslagen++; s.schade = 0; s.schild = 0
    s.laatste = l
    if (!s.kasteel.length) { s.klaar = true; s.gewonnen = true; s.fase = 'klaar'; return s }
    s.fase = 'aanval'
    l.nieuweVijand = s.kasteel[0]
    return controleer(s)
  }
  s.laatste = l
  return naarAfweren(s)
}

export function pas(s0) {
  if (!magPassen(s0)) return null
  const s = kopie(s0)
  s.beurt++; s.vorigePas = true
  s.laatste = { soort: 'pas', kaarten: [] }
  return naarAfweren(s)
}

export function weerAf(s0, ids) {
  if (!magAfweren(s0, ids)) return null
  const s = kopie(s0)
  s.hand = s.hand.filter(id => !ids.includes(id))
  s.afleg.push(...ids)
  s.fase = 'aanval'
  s.laatste = { soort: 'afweer', kaarten: ids.slice(), slag: teAfweren(s0) }
  return controleer(s)
}

// Een nar: je hand weg, 8 nieuwe kaarten
export function nar(s0) {
  if (!magNar(s0)) return null
  const s = kopie(s0)
  const weg = s.hand.slice()
  s.afleg.push(...weg); s.hand = []
  s.narren--; s.narrenGebruikt++
  const gepakt = trek(s, MAX_HAND)
  s.laatste = { soort: 'nar', kaarten: [], weg, gepakt }
  return controleer(s)
}

// Medaille na het winnen: goud zonder narren, zilver met 1, brons met meer
export function medaille(s) {
  if (!s || !s.gewonnen) return null
  return ['goud', 'zilver', 'brons'][Math.min(2, s.narrenGebruikt)]
}

// Klopt deze stand? (voor een stand uit de opslag)
export function geldigeStand(s) {
  if (!s || typeof s !== 'object' || !NIVEAUS[s.niveau]) return false
  for (const k of ['kasteel', 'taveerne', 'afleg', 'hand', 'tafel']) if (!Array.isArray(s[k]) || !s[k].every(isKaart)) return false
  const alle = [...s.kasteel, ...s.taveerne, ...s.afleg, ...s.hand, ...s.tafel]
  return alle.length === 52 && new Set(alle).size === 52 && ['aanval', 'verdedig', 'klaar'].includes(s.fase)
}
