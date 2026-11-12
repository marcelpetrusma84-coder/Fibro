// pesten.js - de spelregels van Pesten (v1, 11 nov 2026). Geen scherm, alleen rekenen: gebruikt door pesten-ui.js
// (het spel), door solo.js (de computerspeler) en door de tests.
//
// In gewone woorden, de regels:
//   - Iedereen krijgt 7 kaarten. Er ligt een kaart open op de aflegstapel.
//   - Je legt een kaart van dezelfde kleur (♥ ♦ ♣ ♠) of dezelfde waarde op. Meer kaarten van dezelfde waarde mag in één keer.
//   - Kun of wil je niet, dan pak je een kaart. Past die, dan mag je hem nog leggen; anders pas je.
//   - 2 = de ander pakt er 2. Joker = de ander pakt er 5. Je mag een 2 of joker terugleggen, dan stapelt het op.
//   - 7 (blijft plakken), 8 (wacht) en aas (keer om): jij bent nog een keer.
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
export const NOG_EEN_KEER = ['7', '8', 'A']
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

const ander = sp => sp === 1 ? 2 : 1
const kopie = s => JSON.parse(JSON.stringify(s))

// Een nieuw spel: schudden, 7 kaarten elk, een gewone kaart open (geen 2, joker, boer, 7, 8 of aas om mee te beginnen).
export function nieuwSpel({ begint = 1, rng = Math.random } = {}) {
  let stapel = schud(maakDeck(), rng)
  const handen = { 1: [], 2: [] }
  for (let i = 0; i < HANDGROOTTE; i++) for (const sp of [1, 2]) handen[sp].push(stapel.pop())
  let i = stapel.length - 1
  while (i > 0 && !gewoneBegin(stapel[i])) i--
  const open = stapel.splice(i, 1)[0]
  return {
    stapel, aflegstapel: [open], handen,
    aanZet: begint, begint,
    straf: 0, kleur: null, getrokken: false,
    geroepen: { 1: false, 2: false }, betrapbaar: 0,
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

function wieGaatVerder(s, sp, waarde) { return NOG_EEN_KEER.includes(waarde) ? sp : ander(sp) }
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
    s.aanZet = ander(sp)
  } else {
    const kaarten = trek(s, sp, 1, rng)
    s.laatste = { soort: 'pak', wie: sp, kaarten, n: kaarten.length }
    s.getrokken = true
    if (!kaarten.length) { s.getrokken = false; s.aanZet = ander(sp) }   // niets meer te pakken: beurt om
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
  s.aanZet = ander(sp)
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

// Betrappen: de ander heeft nog 1 kaart en riep niet. Mag op je eigen beurt. De ander pakt 2 strafkaarten.
export function magBetrappen(s, sp) { return Boolean(s && !s.winnaar && s.aanZet === sp && s.betrapbaar === ander(sp)) }
export function betrap(oud, sp, rng = Math.random) {
  if (!magBetrappen(oud, sp)) return null
  const s = kopie(oud)
  const dader = ander(sp)
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
    if (!s || typeof s !== 'object' || ![1, 2].includes(s.aanZet) || ![0, 1, 2].includes(s.winnaar)) return false
    const alle = [...s.stapel, ...s.aflegstapel, ...s.handen[1], ...s.handen[2]]
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
      else if (w === '2') p = niveau === 'moeilijk' && s.handen[ander(sp)].length <= 3 ? -2 : 2
      else if (NOG_EEN_KEER.includes(w)) p = hand.length > 1 ? -1 : 1   // nog een keer: fijn, maar niet als laatste
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
