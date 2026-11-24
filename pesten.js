// pesten.js - de spelregels van Pesten (v1, 11 nov 2026). Geen scherm, alleen rekenen: gebruikt door pesten-ui.js
// (het spel), door solo.js (de computerspeler) en door de tests.
//
// In gewone woorden, de regels:
//   - Iedereen krijgt 7 kaarten. Er ligt een kaart open op de aflegstapel.
//   - Je legt een kaart van dezelfde kleur (♥ ♦ ♣ ♠) of dezelfde waarde op. Meer kaarten van dezelfde waarde mag in één keer.
//   - Kun of wil je niet, dan pak je een kaart. Past die, dan mag je hem nog leggen; anders pas je.
//   - 2 = de ander pakt er 2. Joker = de ander pakt er 5. Je mag een 2 of joker terugleggen, dan stapelt het op.
//   - 7 (blijft plakken) en 8 (wacht): jij bent nog een keer.
//   - Aas: hangt af van het spel (s.aasRegel):
//       'eenmaal'        tegen de computer: de aas is maar één keer, daarna is de ander aan de beurt;
//       'nog-een-keer'   met z'n tweeën online: jij bent nog een keer (zoals het was);
//       'omkeer'         met 3 of 4 spelers (altijd): de beurtvolgorde draait om, de andere kant op.
//   - Boer: past altijd (behalve als er een 2 of joker te pakken ligt); jij kiest de nieuwe kleur.
//   - Joker: past altijd; na een joker mag alles.
//   - Heb je nog 2 kaarten? Tik dan op "Laatste kaart!" voordat je speelt. Vergeten = de ander mag je betrappen: 2 strafkaarten.
//   - Wie het eerst geen kaarten meer heeft, wint.
//
// De stand is één gewoon object (zie nieuwSpel). Wie een zet doet, rekent de nieuwe stand uit en stuurt hem helemaal
// naar de ander (zoals in BLAUWDRUK-BEURTSPEL.md). Alle functies geven een NIEUWE stand terug of null als het niet mag.

export const KLEUREN = ['h', 'r', 'k', 's']          // harten, ruiten, klaveren, schoppen
export const WAARDEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const HANDGROOTTE = 7
export const STRAF = { '2': 2, 'J': 5 }              // J = joker
export const NOG_EEN_KEER = ['7', '8', 'A']          // alleen A hangt af van de aasRegel (zie houdtBeurt)
export const AAS_REGELS = ['eenmaal', 'nog-een-keer', 'omkeer']
export const MAX_SPELERS = 4
export const BETRAP_STRAF = 2

// 'h10' -> { kleur: 'h', waarde: '10' }; 'J1' -> { kleur: 'j', waarde: 'J' }
export function kaartInfo(id) {
  if (/^J[12]$/.test(id)) return { kleur: 'j', waarde: 'J' }
  return { kleur: id[0], waarde: id.slice(1) }
}
export const isKaart = id => typeof id === 'string' && (/^J[12]$/.test(id) || (KLEUREN.includes(id[0]) && WAARDEN.includes(id.slice(1))))

export function maakDeck() {
  const d = []
  for (const k of KLEUREN) for (const w of WAARDEN) d.push(k + w)
  d.push('J1', 'J2')
  return d
}

export function schud(lijst, rng = Math.random) {
  const a = lijst.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Spelers zijn genummerd 1 t/m n (oudere standen hebben geen n: dan 2 spelers). Richting 1 = oplopend, -1 = omgekeerd.
export const aantalSpelers = s => (s && s.n) || 2
export const aasRegelVan = s => (s && s.aasRegel) || 'nog-een-keer'
const richtingVan = s => (s && s.richting) || 1
// Wie na sp aan de beurt is, in de richting van dat moment
export function volgende(s, sp) {
  const n = aantalSpelers(s)
  return ((sp - 1 + richtingVan(s) + n) % n) + 1
}
// Houdt deze kaart de beurt bij de speler zelf? (7 en 8 altijd; de aas alleen in 'nog-een-keer')
const houdtBeurt = (s, waarde) => waarde === '7' || waarde === '8' || (waarde === 'A' && aasRegelVan(s) === 'nog-een-keer')
const kopie = s => JSON.parse(JSON.stringify(s))

// Een nieuw spel: schudden, 7 kaarten elk, een gewone kaart open (geen 2, joker, boer, 7, 8 of aas om mee te beginnen).
// spelers: 2 t/m 4. aas: 'eenmaal' (tegen de computer) of 'nog-een-keer' (2 spelers online); met 3 of 4 spelers is het altijd 'omkeer'.
export function nieuwSpel({ begint = 1, rng = Math.random, spelers = 2, aas = 'nog-een-keer' } = {}) {
  const n = Math.min(MAX_SPELERS, Math.max(2, Math.floor(spelers) || 2))
  let stapel = schud(maakDeck(), rng)
  const nummers = Array.from({ length: n }, (_, i) => i + 1)
  const handen = {}, geroepen = {}
  for (const sp of nummers) { handen[sp] = []; geroepen[sp] = false }
  for (let i = 0; i < HANDGROOTTE; i++) for (const sp of nummers) handen[sp].push(stapel.pop())
  let i = stapel.length - 1
  while (i > 0 && !gewoneBegin(stapel[i])) i--
  const open = stapel.splice(i, 1)[0]
  return {
    stapel, aflegstapel: [open], handen,
    aanZet: begint, begint,
    n, richting: 1, aasRegel: n > 2 ? 'omkeer' : (aas === 'eenmaal' ? 'eenmaal' : 'nog-een-keer'),
    straf: 0, kleur: null, getrokken: false,
    geroepen, betrapbaar: 0,
    winnaar: 0, beurt: 0,
    laatste: { soort: 'deel', wie: 0, kaarten: [], n: 0 },
  }
}
function gewoneBegin(id) {
  const { waarde } = kaartInfo(id)
  return !(waarde in STRAF) && waarde !== 'B' && !NOG_EEN_KEER.includes(waarde)
}

export const bovenste = s => s.aflegstapel[s.aflegstapel.length - 1]
// De kleur die nu geldt: door een boer gekozen, of de kleur van de bovenste kaart
export const geldendeKleur = s => s.kleur || kaartInfo(bovenste(s)).kleur

// Mag deze ene kaart nu op de aflegstapel?
export function magOp(s, id) {
  const k = kaartInfo(id), top = kaartInfo(bovenste(s))
  if (s.straf > 0) return k.waarde in STRAF                 // alleen terugpesten met een 2 of joker
  if (k.waarde === 'J' || k.waarde === 'B') return true
  if (top.waarde === 'J') return true                       // na een joker (straf al gepakt) mag alles
  return k.kleur === geldendeKleur(s) || k.waarde === top.waarde
}

// Mogen deze kaarten samen gespeeld worden? Allemaal dezelfde waarde, allemaal in je hand, de eerste past.
export function magSpelen(s, sp, ids) {
  if (!s || s.winnaar || s.aanZet !== sp || !Array.isArray(ids) || !ids.length) return false
  if (new Set(ids).size !== ids.length) return false
  const hand = s.handen[sp]
  if (!ids.every(id => hand.includes(id))) return false
  const w = kaartInfo(ids[0]).waarde
  if (!ids.every(id => kaartInfo(id).waarde === w)) return false
  return magOp(s, ids[0])
}

// Welke kaarten in de hand passen nu (voor het oplichten en voor de computer)
export const speelbaar = (s, sp) => (s && !s.winnaar && s.aanZet === sp) ? s.handen[sp].filter(id => magOp(s, id)) : []

// Na een zet (s heeft de richting al bijgewerkt): wie is nu aan de beurt?
function wieGaatVerder(s, sp, waarde) { return houdtBeurt(s, waarde) ? sp : volgende(s, sp) }
function opruimRoep(s, sp) { if (s.handen[sp].length > 2) s.geroepen[sp] = false }

// Speel kaarten. kleurKeuze is nodig bij een boer ('h' 'r' 'k' 's'); zonder keuze blijft de kleur van de boer.
export function speel(oud, sp, ids, kleurKeuze) {
  if (!magSpelen(oud, sp, ids)) return null
  const s = kopie(oud)
  if (s.betrapbaar === sp) s.betrapbaar = 0                // je bent weer aan de beurt: te laat om je te betrappen
  s.handen[sp] = s.handen[sp].filter(id => !ids.includes(id))
  s.aflegstapel.push(...ids)
  const w = kaartInfo(ids[0]).waarde
  s.kleur = null
  if (w in STRAF) s.straf += STRAF[w] * ids.length
  if (w === 'A' && aasRegelVan(s) === 'omkeer' && ids.length % 2 === 1) s.richting = -richtingVan(s)   // keer om (twee azen samen heffen elkaar op)
  if (w === 'B') s.kleur = KLEUREN.includes(kleurKeuze) ? kleurKeuze : kaartInfo(ids[ids.length - 1]).kleur
  s.getrokken = false
  s.beurt++
  s.laatste = { soort: 'speel', wie: sp, kaarten: ids.slice(), n: ids.length, kleur: s.kleur }
  const over = s.handen[sp].length
  if (over === 0) { s.winnaar = sp; return s }
  if (over === 1 && !s.geroepen[sp]) s.betrapbaar = sp
  if (over === 1) s.geroepen[sp] = false
  s.aanZet = wieGaatVerder(s, sp, w)
  return s
}

// Pak kaarten van de stapel. Is de stapel leeg, dan wordt de aflegstapel (behalve de bovenste) geschud.
function trek(s, sp, n, rng) {
  const getrokken = []
  for (let i = 0; i < n; i++) {
    if (!s.stapel.length && s.aflegstapel.length > 1) {
      const top = s.aflegstapel.pop()
      s.stapel = schud(s.aflegstapel, rng)
      s.aflegstapel = [top]
    }
    if (!s.stapel.length) break
    const id = s.stapel.pop()
    s.handen[sp].push(id); getrokken.push(id)
  }
  return getrokken
}

// Tik op de stapel. Ligt er straf: alles pakken en de beurt is om. Anders: 1 kaart pakken (daarna spelen of passen).
// Heb je deze beurt al gepakt, dan is dit hetzelfde als passen.
export function pak(oud, sp, rng = Math.random) {
  if (!oud || oud.winnaar || oud.aanZet !== sp) return null
  if (oud.getrokken && oud.straf === 0) return pas(oud, sp)
  const s = kopie(oud)
  if (s.betrapbaar === sp) s.betrapbaar = 0
  s.beurt++
  if (s.straf > 0) {
    const kaarten = trek(s, sp, s.straf, rng)
    s.laatste = { soort: 'straf', wie: sp, kaarten, n: kaarten.length }
    s.straf = 0
    s.getrokken = false
    s.aanZet = volgende(s, sp)
  } else {
    const kaarten = trek(s, sp, 1, rng)
    s.laatste = { soort: 'pak', wie: sp, kaarten, n: kaarten.length }
    s.getrokken = true
    if (!kaarten.length) { s.getrokken = false; s.aanZet = volgende(s, sp) }   // niets meer te pakken: beurt om
  }
  opruimRoep(s, sp)
  return s
}

export function pas(oud, sp) {
  if (!oud || oud.winnaar || oud.aanZet !== sp || !oud.getrokken) return null
  const s = kopie(oud)
  s.getrokken = false
  s.beurt++
  s.laatste = { soort: 'pas', wie: sp, kaarten: [], n: 0 }
  s.aanZet = volgende(s, sp)
  return s
}

// "Laatste kaart!" roepen: op je eigen beurt, met 2 kaarten of minder.
export function magRoepen(s, sp) { return Boolean(s && !s.winnaar && s.aanZet === sp && s.handen[sp].length <= 2 && !s.geroepen[sp]) }
export function roep(oud, sp) {
  if (!magRoepen(oud, sp)) return null
  const s = kopie(oud)
  s.geroepen[sp] = true
  s.beurt++
  s.laatste = { soort: 'roep', wie: sp, kaarten: [], n: 0 }
  return s
}

// Betrappen: een ander heeft nog 1 kaart en riep niet. Mag op je eigen beurt. Die ander pakt 2 strafkaarten.
export function magBetrappen(s, sp) { return Boolean(s && !s.winnaar && s.aanZet === sp && s.betrapbaar && s.betrapbaar !== sp) }
export function betrap(oud, sp, rng = Math.random) {
  if (!magBetrappen(oud, sp)) return null
  const s = kopie(oud)
  const dader = s.betrapbaar
  const kaarten = trek(s, dader, BETRAP_STRAF, rng)
  s.betrapbaar = 0
  s.beurt++
  s.laatste = { soort: 'betrapt', wie: dader, kaarten, n: kaarten.length }
  opruimRoep(s, dader)
  return s
}

// Klopt een stand die van de ander komt? (54 kaarten, elk precies één keer, geldige spelers)
export function geldigeStand(s) {
  try {
    if (!s || typeof s !== 'object') return false
    const n = aantalSpelers(s)
    if (!Number.isInteger(n) || n < 2 || n > MAX_SPELERS) return false
    if (!Number.isInteger(s.aanZet) || s.aanZet < 1 || s.aanZet > n || !Number.isInteger(s.winnaar) || s.winnaar < 0 || s.winnaar > n) return false
    if (s.richting !== undefined && s.richting !== 1 && s.richting !== -1) return false
    if (s.aasRegel !== undefined && !AAS_REGELS.includes(s.aasRegel)) return false
    if (n > 2 && s.aasRegel !== 'omkeer') return false
    const handen = Array.from({ length: n }, (_, i) => s.handen[i + 1])
    if (handen.some(h => !Array.isArray(h))) return false
    const alle = [...s.stapel, ...s.aflegstapel, ...handen.flat()]
    if (alle.length !== 54 || new Set(alle).size !== 54 || !alle.every(isKaart)) return false
    if (!s.aflegstapel.length || !Number.isInteger(s.straf) || s.straf < 0) return false
    if (s.kleur !== null && !KLEUREN.includes(s.kleur)) return false
    return true
  } catch (e) { return false }
}

// ── De computerspeler ──
// Geeft de volgende stap terug: { soort: 'betrap' } | { soort: 'roep' } | { soort: 'speel', kaarten, kleur } | { soort: 'pak' } | { soort: 'pas' }
// niveau: 'makkelijk' (vergeet soms te roepen, betrapt zelden), 'normaal', 'moeilijk' (bewaart jokers en boeren, pest terug).
export function computerStap(s, sp, niveau = 'normaal', rng = Math.random) {
  if (!s || s.winnaar || s.aanZet !== sp) return null
  const kans = { makkelijk: [0.25, 0.55], normaal: [0.65, 0.85], moeilijk: [0.95, 1] }[niveau] || [0.65, 0.85]
  if (magBetrappen(s, sp) && rng() < kans[0]) return { soort: 'betrap' }
  const hand = s.handen[sp]
  const opties = speelbaar(s, sp)
  if (magRoepen(s, sp) && hand.length === 2 && opties.length && rng() < kans[1]) return { soort: 'roep' }
  if (!opties.length) return s.getrokken ? { soort: 'pas' } : { soort: 'pak' }
  let keuze
  if (niveau === 'makkelijk') keuze = opties[Math.floor(rng() * opties.length)]
  else {
    const waarde = id => {
      const w = kaartInfo(id).waarde
      let p = 0
      if (s.straf > 0) return w === '2' ? 2 : 1            // goedkoopste eerst terugpesten
      if (w === 'J') p = niveau === 'moeilijk' ? 8 : 4       // jokers en boeren bewaren
      else if (w === 'B') p = niveau === 'moeilijk' ? 7 : 3
      else if (w === '2') p = niveau === 'moeilijk' && Math.min(...Object.keys(s.handen).filter(k => +k !== sp).map(k => s.handen[k].length)) <= 3 ? -2 : 2
      else if (houdtBeurt(s, w)) p = hand.length > 1 ? -1 : 1   // nog een keer: fijn, maar niet als laatste
      return p + rng() * 0.5
    }
    keuze = opties.slice().sort((a, b) => waarde(a) - waarde(b))[0]
  }
  const w = kaartInfo(keuze).waarde
  let kaarten = [keuze]
  if (niveau !== 'makkelijk' && w !== 'J') kaarten = [keuze, ...hand.filter(id => id !== keuze && kaartInfo(id).waarde === w)]
  let kleur
  if (w === 'B') {
    const tel = { h: 0, r: 0, k: 0, s: 0 }
    for (const id of hand) { const k = kaartInfo(id); if (!kaarten.includes(id) && k.kleur in tel) tel[k.kleur]++ }
    kleur = Object.keys(tel).sort((a, b) => tel[b] - tel[a])[0]
  }
  return { soort: 'speel', kaarten, kleur }
}

// Voer een stap uit (van de computer of van een test)
export function doeStap(s, sp, stap, rng = Math.random) {
  if (!stap) return null
  if (stap.soort === 'speel') return speel(s, sp, stap.kaarten, stap.kleur)
  if (stap.soort === 'pak') return pak(s, sp, rng)
  if (stap.soort === 'pas') return pas(s, sp)
  if (stap.soort === 'roep') return roep(s, sp)
  if (stap.soort === 'betrap') return betrap(s, sp, rng)
  return null
}
