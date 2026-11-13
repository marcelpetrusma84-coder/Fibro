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
// v2 (13 nov 2026, Marcel): met z'n tweeën (in de chat).
//   - Samen (samen: true): één kasteel, elk een eigen hand van 7 kaarten (handen[1], handen[2]), om de beurt
//     (aanZet). Wie aanvalt, weert ook af; daarna is de ander. Na een verslagen vijand blijf je aan de beurt.
//     ♦ ruiten delen de kaarten om en om uit, te beginnen bij wie aanvalt. Narren zijn van jullie samen
//     (Schildknaap 2, Ridder 1, Koning 0); een nar geeft wie hem inzet een nieuwe hand.
//   - Wedstrijd en duel: ieder speelt een eigen spel (gewoon solo), met hetzelfde geschudde kasteel (zaadRng).
//     In het duel kan de ander een vloek sturen: jouw vijand krijgt er leven bij (vervloek, s.extra).
// De stand is één gewoon object (zie nieuwSpel). Alle functies geven een NIEUWE stand terug of null als het niet mag.

export const KLEUREN = ['h', 'r', 'k', 's']
export const GETALLEN = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10']
export const HOOFDEN = ['B', 'V', 'H']
export const MAX_HAND = 8
export const VIJAND = { B: { leven: 20, aanval: 10 }, V: { leven: 30, aanval: 15 }, H: { leven: 40, aanval: 20 } }
export const NIVEAUS = { schildknaap: { narren: 4, samen: 2 }, ridder: { narren: 2, samen: 1 }, koning: { narren: 0, samen: 0 } }
export const MAX_HAND_SAMEN = 7
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
// Een dobbelsteen met een vast zaadje: allebei hetzelfde geschudde kasteel (wedstrijd en duel)
export function zaadRng(zaad) { let x = (Math.abs(Math.floor(zaad)) % 2147483646) + 1; return () => { x = (x * 48271) % 2147483647; return (x - 1) / 2147483646 } }

// De hand van wie aan de beurt is (alleen: s.hand; samen: s.handen[s.aanZet])
export const hand = (s, wie) => s.handen ? (s.handen[wie || s.aanZet] || []) : s.hand
function zetHand(s, h) { if (s.handen) s.handen[s.aanZet] = h; else s.hand = h }
export const maxHand = s => s.handen ? MAX_HAND_SAMEN : MAX_HAND
export const ander = wie => wie === 1 ? 2 : 1

export function nieuwSpel({ niveau = 'ridder', rng = Math.random, samen = false, begint = 1 } = {}) {
  if (!NIVEAUS[niveau]) niveau = 'ridder'
  const groep = w => schud(KLEUREN.map(k => k + w), rng)
  const kasteel = [...groep('B'), ...groep('V'), ...groep('H')]
  const taveerne = schud(KLEUREN.flatMap(k => GETALLEN.map(w => k + w)), rng)
  const s = { niveau, kasteel, taveerne, afleg: [], tafel: [], schade: 0, schild: 0, extra: 0,
    narren: NIVEAUS[niveau][samen ? 'samen' : 'narren'], narrenGebruikt: 0, fase: 'aanval', vorigePas: false, verslagen: 0,
    klaar: false, gewonnen: false, beurt: 0, laatste: { soort: 'begin', kaarten: [] } }
  if (samen) { s.handen = { 1: [], 2: [] }; s.aanZet = begint === 2 ? 2 : 1; s.begint = s.aanZet; trek(s, MAX_HAND_SAMEN * 2) }
  else { s.hand = []; trek(s, MAX_HAND) }
  return s
}

// Pak tot n kaarten van de taveerne (zo veel als er zijn en zo lang de hand niet vol is). Samen: om en om, te
// beginnen bij wie aan de beurt is. Geeft de kaarten van wie aan de beurt is; s.__per krijgt ze per speler.
function trek(s, n) {
  const max = maxHand(s), per = { 1: [], 2: [] }
  if (!s.handen) {
    while (n-- > 0 && s.taveerne.length && s.hand.length < max) { const id = s.taveerne.shift(); s.hand.push(id); per[1].push(id) }
    return per[1]
  }
  let wie = s.aanZet
  while (n > 0 && s.taveerne.length && (s.handen[1].length < max || s.handen[2].length < max)) {
    if (s.handen[wie].length < max) { const id = s.taveerne.shift(); s.handen[wie].push(id); per[wie].push(id); n-- }
    wie = ander(wie)
  }
  s.__per = per
  return per[s.aanZet]
}

export const vijand = s => s.kasteel[0] || null
export function vijandInfo(s) {
  const id = vijand(s)
  if (!id) return null
  const { kleur, waarde: w } = kaartInfo(id)
  const leven = VIJAND[w].leven + (s.extra || 0)
  return { id, kleur, soort: w, leven, aanval: VIJAND[w].aanval, extra: s.extra || 0, over: Math.max(0, leven - s.schade),
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

const inHand = (s, ids) => ids.every(id => hand(s).includes(id))

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
  if (s.fase === 'verdedig' && som(hand(s)) < teAfweren(s) && s.narren === 0) { s.klaar = true; s.gewonnen = false; s.laatste.verloren = 'afweren' }
  else if (s.fase === 'aanval' && !hand(s).length && s.vorigePas && s.narren === 0) { s.klaar = true; s.gewonnen = false; s.laatste.verloren = 'leeg' }
  delete s.__per
  return s
}

// Na het aanvallen of passen: slaat de vijand terug?
// Samen: na je beurt (afgeweerd, of geen slag) is de ander
function volgende(s) { if (s.handen) { s.laatste.wie = s.laatste.wie || s.aanZet; s.aanZet = ander(s.aanZet) } }
function naarAfweren(s) {
  if (teAfweren(s) <= 0) { s.fase = 'aanval'; s.laatste.geenSlag = true; volgende(s); return controleer(s) }
  s.fase = 'verdedig'
  return controleer(s)
}

export function valAan(s0, ids) {
  if (!magAanvallen(s0, ids)) return null
  const s = kopie(s0)
  const u = aanvalUitkomst(s, ids)
  const v = vijandInfo(s)
  zetHand(s, hand(s).filter(id => !ids.includes(id)))
  s.tafel.push(...ids)
  s.beurt++; s.vorigePas = false
  const l = { soort: 'aanval', kaarten: ids.slice(), vijand: v.id, kracht: u.kracht, schade: u.schade, werkt: u.werkt, immuun: u.immuun,
    genezen: 0, gepakt: [], schild: 0, wie: s.aanZet || 1 }
  // ♥ eerst: kaarten van de aflegstapel onder de taveerne
  if (u.werkt.includes('h')) {
    const terug = schud(s.afleg).slice(0, u.kracht)
    s.afleg = s.afleg.filter(id => !terug.includes(id))
    s.taveerne.push(...terug)
    l.genezen = terug.length
  }
  // ♦ dan: kaarten pakken
  if (u.werkt.includes('r')) { l.gepakt = trek(s, u.kracht); if (s.__per) l.gepaktPer = s.__per }
  // ♠ schild
  if (u.werkt.includes('s')) { s.schild += u.kracht; l.schild = u.kracht }
  s.schade += u.schade
  if (s.schade >= v.leven) {
    l.verslagen = true; l.precies = s.schade === v.leven
    s.afleg.push(...s.tafel); s.tafel = []
    s.kasteel.shift()
    if (l.precies) s.taveerne.unshift(v.id); else s.afleg.push(v.id)
    s.verslagen++; s.schade = 0; s.schild = 0; s.extra = 0
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
  s.laatste = { soort: 'pas', kaarten: [], wie: s.aanZet || 1 }
  return naarAfweren(s)
}

export function weerAf(s0, ids) {
  if (!magAfweren(s0, ids)) return null
  const s = kopie(s0)
  zetHand(s, hand(s).filter(id => !ids.includes(id)))
  s.afleg.push(...ids)
  s.fase = 'aanval'
  s.laatste = { soort: 'afweer', kaarten: ids.slice(), slag: teAfweren(s0), wie: s.aanZet || 1 }
  volgende(s)
  return controleer(s)
}

// Een nar: je hand weg, 8 nieuwe kaarten
export function nar(s0) {
  if (!magNar(s0)) return null
  const s = kopie(s0)
  const weg = hand(s).slice()
  s.afleg.push(...weg); zetHand(s, [])
  s.narren--; s.narrenGebruikt++
  // een nar vult alleen de hand van wie hem inzet
  const gepakt = []
  while (s.taveerne.length && hand(s).length < maxHand(s)) { const id = s.taveerne.shift(); hand(s).push(id); gepakt.push(id) }
  s.laatste = { soort: 'nar', kaarten: [], weg, gepakt, wie: s.aanZet || 1 }
  return controleer(s)
}

// ── Belegering (v3, 13 nov 2026, Marcel): ieder een eigen kasteel, om de beurt aanvallen en verdedigen ──
// Elke speler heeft een eigen 'front' (een gewone stand zoals alleen): de vijanden daarin zijn de wachters van het
// kasteel van de ANDER. Op jouw beurt val je de voorste wachter van de ander aan; die slaat terug en jij weert af.
// Daarna is de ander. Een verslagen wachter (of een schild dat alles tegenhoudt) beëindigt je beurt ook.
// Precies raak = je neemt de wachter gevangen (hij komt in jouw taveerne). Wie als eerste alle 12 wachters van de
// ander verslaat, wint; wie niet meer kan afweren, verliest. Narren: Schildknaap 2, Ridder 1, Koning 0 (elk).
export function nieuwBeleg({ niveau = 'ridder', begint = 1, rng = Math.random } = {}) {
  if (!NIVEAUS[niveau]) niveau = 'ridder'
  const front = () => Object.assign(nieuwSpel({ niveau, rng }), { narren: NIVEAUS[niveau].samen })
  return { modus: 'beleg', niveau, aanZet: begint === 2 ? 2 : 1, spelers: { 1: front(), 2: front() }, klaar: false, winnaar: 0, beurt: 0, laatste: { wie: 0, soort: 'begin' } }
}
// Na een zet van 'wie' (nieuw = zijn nieuwe front): wie wint er, of is de ander aan de beurt?
export function belegStap(b0, wie, nieuw) {
  if (!b0 || b0.klaar || b0.aanZet !== wie || !nieuw) return null
  const b = kopie(b0)
  b.spelers[wie] = nieuw; b.beurt++
  const l = nieuw.laatste || {}
  b.laatste = { wie, soort: l.soort, kaarten: l.kaarten || [], schade: l.schade || 0, verslagen: Boolean(l.verslagen), precies: Boolean(l.precies), vijand: l.vijand || null }
  if (nieuw.klaar) { b.klaar = true; b.winnaar = nieuw.gewonnen ? wie : ander(wie); return b }
  const klaarMetBeurt = nieuw.fase === 'aanval' && (l.soort === 'afweer' || l.verslagen || l.geenSlag)
  if (klaarMetBeurt) b.aanZet = ander(wie)
  return b
}
export function geldigBeleg(b) {
  return Boolean(b && b.modus === 'beleg' && NIVEAUS[b.niveau] && [1, 2].includes(b.aanZet) && b.spelers && geldigeStand(b.spelers[1]) && geldigeStand(b.spelers[2]))
}

// Duel: de ander stuurt een vloek; je vijand krijgt er n leven bij (tot hij verslagen is)
export function vervloek(s0, n = 10) {
  if (!s0 || s0.klaar || !vijand(s0)) return null
  const s = kopie(s0)
  s.extra = (s.extra || 0) + n
  s.laatste = { soort: 'vloek', kaarten: [], n }
  return s
}

// Medaille na het winnen: goud zonder narren, zilver met 1, brons met meer
export function medaille(s) {
  if (!s || !s.gewonnen) return null
  return ['goud', 'zilver', 'brons'][Math.min(2, s.narrenGebruikt)]
}

// Klopt deze stand? (voor een stand uit de opslag)
export function geldigeStand(s) {
  if (!s || typeof s !== 'object' || !NIVEAUS[s.niveau]) return false
  const handen = s.handen ? (s.handen && [s.handen[1], s.handen[2]]) : [s.hand]
  if (s.handen && ![1, 2].includes(s.aanZet)) return false
  for (const l of [s.kasteel, s.taveerne, s.afleg, s.tafel, ...handen]) if (!Array.isArray(l) || !l.every(isKaart)) return false
  const alle = [s.kasteel, s.taveerne, s.afleg, s.tafel, ...handen].flat()
  return alle.length === 52 && new Set(alle).size === 52 && ['aanval', 'verdedig', 'klaar'].includes(s.fase)
}
