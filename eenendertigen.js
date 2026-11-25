// eenendertigen.js - de spelregels van Eenendertigen voor twee spelers (v1, 25 nov 2026, uit Stekky Studio:
// spellen/eenendertigen.md). Geen scherm, alleen rekenen: gebruikt door eenendertigen-ui.js (het spel), door de
// computerspeler hieronder (export bot, solo.js laadt hem via studio-spellen.js) en door de tests.
//
// In gewone woorden, de regels (zoals Marcel ze koos):
//   - Een piketspel (32 kaarten: 7 tot en met aas). Iedereen krijgt 3 kaarten, er liggen 3 kaarten open op tafel.
//   - Om de beurt doe je één ding: één kaart ruilen met de tafel, alle drie ruilen, of kloppen. Kloppen mag pas als
//     iedereen één keer aan de beurt is geweest.
//   - Punten: alleen kaarten van dezelfde kleur tellen op. Aas 11, heer/vrouw/boer 10, de rest de waarde. Je beste
//     kleur telt; het hoogste is 31. Drie kaarten met dezelfde waarde = 30½.
//   - Klopt iemand, dan mag de ander nog één keer ruilen; daarna worden de kaarten getoond.
//   - Precies 31 (ook meteen na het delen): de kaarten worden meteen getoond.
//   - Wie de minste punten heeft, verliest een leven; evenveel = allebei een leven. Wie klopte verliest ook maar één.
//   - Iedereen begint met 3 levens. Wie geen levens meer heeft, heeft verloren (allebei tegelijk = gelijkspel).
//   - Na een ronde deelt speler 1 de volgende (volgendeRonde); wie begint wisselt per ronde.
// v2 (25 nov 2026, Marcel): 2 tot 6 spelers (n). Om de beurt in de rondte (1, 2, ..., n). Na kloppen krijgt iedereen
//   nog één beurt tot de klopper weer aan de beurt zou zijn. Heeft iemand 31, dan verliezen ALLE anderen een leven.
//   Wie geen levens meer heeft, ligt eruit (krijgt geen kaarten meer); de rest speelt door tot er één over is.
//   Allemaal tegelijk af = gelijkspel (winnaar 0).
// v3 (25 nov 2026, Marcel): passen. Je mag je beurt overslaan (dat telt wel als beurt). Past iedereen die meedoet een
//   hele rondgang achter elkaar, dan gaan de 3 tafelkaarten onder de stapel en komen er 3 nieuwe open te liggen.
//
// De stand is één gewoon object (zie nieuwSpel). Alle functies geven een NIEUWE stand terug of null als het niet mag.
// fase: 'spel' (er wordt gespeeld), 'uitslag' (ronde klaar, de volgende moet nog gedeeld), 'klaar' (iemand is af).

export const KLEUREN = ['h', 'r', 'k', 's']
export const WAARDEN = ['7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const DOEL = 31, LEVENS = 3, MIN_SPELERS = 2, MAX_SPELERS = 6
export const DRIE_GELIJK = 30.5

export const kaartInfo = id => ({ kleur: id[0], waarde: id.slice(1) })
export const isKaart = id => typeof id === 'string' && KLEUREN.includes(id[0]) && WAARDEN.includes(id.slice(1))
export function maakDeck() {
  const d = []
  for (const k of KLEUREN) for (const w of WAARDEN) d.push(k + w)
  return d
}
export function schud(lijst, rng = Math.random) {
  const a = lijst.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const ander = sp => sp === 1 ? 2 : 1
export const zetels = s => Array.from({ length: s.n || 2 }, (_, i) => i + 1)
export const inSpel = s => zetels(s).filter(sp => s.levens[sp] > 0)          // wie nog levens heeft
// De volgende speler in de rondte die nog meedoet
export function volgende(s, sp) {
  const n = s.n || 2
  for (let i = 1; i <= n; i++) { const v = ((sp - 1 + i) % n) + 1; if (s.levens[v] > 0) return v }
  return sp
}
const kopie = s => JSON.parse(JSON.stringify(s))
export const waarde = id => { const w = kaartInfo(id).waarde; return w === 'A' ? 11 : ['B', 'V', 'H'].includes(w) ? 10 : Number(w) }

// De punten van een hand van 3 kaarten
export function punten(hand) {
  if (hand.length === 3 && hand.every(id => kaartInfo(id).waarde === kaartInfo(hand[0]).waarde)) return DRIE_GELIJK
  let beste = 0
  for (const k of KLEUREN) beste = Math.max(beste, hand.filter(id => id[0] === k).reduce((t, id) => t + waarde(id), 0))
  return beste
}
export const toonPunten = p => p === DRIE_GELIJK ? '30½' : String(p)

function deel(s, begint, rng) {
  const stapel = schud(maakDeck(), rng)
  s.handen = Object.fromEntries(zetels(s).map(sp => [sp, []]))
  const mee = []
  for (let sp = begint, i = 0; i < s.n && !mee.includes(sp); i++, sp = volgende(s, sp)) mee.push(sp)
  for (let i = 0; i < 3; i++) for (const sp of mee) s.handen[sp].push(stapel.pop())
  s.tafel = [stapel.pop(), stapel.pop(), stapel.pop()]
  s.stapel = stapel
  s.aanZet = begint; s.begint = begint
  s.beurten = 0; s.passen = 0; s.geklopt = 0; s.fase = 'spel'; s.uitslag = null
  s.laatste = { soort: 'deel', wie: 0, kaarten: [] }
  // Iemand heeft meteen 31: meteen laten zien
  if (mee.some(sp => punten(s.handen[sp]) === DOEL)) rondeKlaar(s, '31')
}

export function nieuwSpel({ begint = 1, spelers = 2, rng = Math.random } = {}) {
  const n = Math.max(MIN_SPELERS, Math.min(MAX_SPELERS, Math.round(Number(spelers)) || 2))
  const s = { n, levens: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, LEVENS])), ronde: 1, winnaar: 0, klaar: false }
  deel(s, Math.min(Math.max(1, begint), n), rng)
  return s
}
export function volgendeRonde(oud, rng = Math.random) {
  if (!oud || oud.fase !== 'uitslag') return null
  const s = kopie(oud)
  s.n ||= 2
  s.ronde++
  deel(s, volgende(s, oud.begint), rng)
  return s
}

// De ronde is klaar: tellen, levens eraf, misschien is iemand af
function rondeKlaar(s, reden) {
  const mee = inSpel(s)
  const p = Object.fromEntries(mee.map(sp => [sp, punten(s.handen[sp])]))
  let verliezers
  if (reden === '31') verliezers = mee.filter(sp => p[sp] !== DOEL)              // wie 31 heeft, wint; alle anderen verliezen
  else { const laagst = Math.min(...mee.map(sp => p[sp])); verliezers = mee.filter(sp => p[sp] === laagst) }   // evenveel: allemaal
  for (const sp of verliezers) s.levens[sp] = Math.max(0, s.levens[sp] - 1)
  s.uitslag = { punten: p, verliezers, reden, geklopt: s.geklopt, eruit: verliezers.filter(sp => s.levens[sp] === 0) }
  const over = inSpel(s)
  if (over.length <= 1) { s.fase = 'klaar'; s.klaar = true; s.winnaar = over.length === 1 ? over[0] : 0 }
  else s.fase = 'uitslag'
}
// Na een ruil: 31 = meteen klaar; was er geklopt en is de klopper weer aan de beurt, dan is de ronde klaar
function naBeurt(s, sp) {
  s.beurten++
  if (punten(s.handen[sp]) === DOEL) { rondeKlaar(s, '31'); return }
  const v = volgende(s, sp)
  if (s.geklopt && v === s.geklopt) { rondeKlaar(s, 'klop'); return }
  s.aanZet = v
}

const aanDeBeurt = (s, sp) => Boolean(s && s.fase === 'spel' && s.aanZet === sp)
export const magRuilen = aanDeBeurt
export function ruil(oud, sp, handKaart, tafelKaart) {
  if (!aanDeBeurt(oud, sp)) return null
  const h = oud.handen[sp].indexOf(handKaart), t = oud.tafel.indexOf(tafelKaart)
  if (h < 0 || t < 0) return null
  const s = kopie(oud)
  s.handen[sp][h] = tafelKaart; s.tafel[t] = handKaart; s.passen = 0
  s.laatste = { soort: 'ruil', wie: sp, kaarten: [handKaart], gepakt: [tafelKaart] }
  naBeurt(s, sp)
  return s
}
export function ruilAlles(oud, sp) {
  if (!aanDeBeurt(oud, sp)) return null
  const s = kopie(oud)
  const weg = s.handen[sp]
  s.handen[sp] = s.tafel; s.tafel = weg; s.passen = 0
  s.laatste = { soort: 'alles', wie: sp, kaarten: weg.slice(), gepakt: s.handen[sp].slice() }
  naBeurt(s, sp)
  return s
}
// Kloppen: pas als iedereen één keer aan de beurt is geweest, en maar één keer per ronde
export const magKloppen = (s, sp) => Boolean(aanDeBeurt(s, sp) && !s.geklopt && s.beurten >= inSpel(s).length)
export function klop(oud, sp) {
  if (!magKloppen(oud, sp)) return null
  const s = kopie(oud)
  s.geklopt = sp; s.beurten++; s.passen = 0
  s.laatste = { soort: 'klop', wie: sp, kaarten: [] }
  s.aanZet = volgende(s, sp)
  return s
}
// Passen: niets doen, de volgende is aan de beurt. Past iedereen een rondgang, dan 3 nieuwe tafelkaarten van de stapel
// (de oude gaan onder de stapel, zodat er altijd genoeg zijn).
export const magPassen = aanDeBeurt
export function pas(oud, sp) {
  if (!magPassen(oud, sp)) return null
  const s = kopie(oud)
  s.passen = (s.passen || 0) + 1
  s.laatste = { soort: 'pas', wie: sp, kaarten: [] }
  if (s.passen >= inSpel(s).length) {
    const weg = s.tafel
    s.stapel = [...weg, ...s.stapel]
    s.tafel = [s.stapel.pop(), s.stapel.pop(), s.stapel.pop()]
    s.passen = 0
    s.laatste.nieuweTafel = true; s.laatste.kaarten = weg.slice()
  }
  naBeurt(s, sp)
  return s
}

// Klopt een stand die van de ander komt? (32 kaarten, elk precies één keer)
export function geldigeStand(s) {
  try {
    if (!s || typeof s !== 'object') return false
    const n = s.n === undefined ? 2 : s.n
    if (!Number.isInteger(n) || n < MIN_SPELERS || n > MAX_SPELERS) return false
    const zet = Array.from({ length: n }, (_, i) => i + 1)
    if (!zet.includes(s.aanZet) || !zet.includes(s.begint) || ![0, ...zet].includes(s.winnaar) || ![0, ...zet].includes(s.geklopt)) return false
    if (!['spel', 'uitslag', 'klaar'].includes(s.fase) || typeof s.klaar !== 'boolean' || s.tafel.length !== 3) return false
    if (!zet.every(sp => Number.isInteger(s.levens[sp]) && s.levens[sp] >= 0 && s.levens[sp] <= LEVENS)) return false
    if (!zet.every(sp => Array.isArray(s.handen[sp]) && (s.handen[sp].length === 3 || (s.handen[sp].length === 0 && (s.levens[sp] === 0 || s.fase !== 'spel'))))) return false
    const alle = [...s.stapel, ...s.tafel, ...zet.flatMap(sp => s.handen[sp])]
    if (alle.length !== 32 || new Set(alle).size !== 32 || !alle.every(isKaart)) return false
    if (s.passen !== undefined && (!Number.isInteger(s.passen) || s.passen < 0 || s.passen > n)) return false
    if (!Number.isInteger(s.beurten) || s.beurten < 0 || !Number.isInteger(s.ronde) || s.ronde < 1) return false
    return true
  } catch (e) { return false }
}

// ── De computerspeler ──
// Wat levert elke ruil op? De beste ruil, of alles ruilen, of kloppen als hij genoeg heeft.
// makkelijk: kijkt maar naar één kaart en klopt al bij 25; normaal: klopt vanaf 27; moeilijk: klopt slimmer (eerder als
// de ander net geklopt heeft kan het niet meer; vanaf 28, of 26 na een paar beurten). Wordt niets beter, dan past hij. Duurt de ronde lang, dan klopt hij
// steeds eerder (na 30 beurten altijd).
export function computerStap(s, sp, niveau = 'normaal', rng = Math.random) {
  if (!aanDeBeurt(s, sp)) return null
  const hand = s.handen[sp], nu = punten(hand)
  const opties = []
  for (const h of hand) for (const t of s.tafel) opties.push({ soort: 'ruil', hand: h, tafel: t, p: punten(hand.map(x => x === h ? t : x)) })
  opties.push({ soort: 'alles', p: punten(s.tafel) })
  let keuze = opties.reduce((a, b) => (b.p > a.p ? b : a))
  if (niveau === 'makkelijk' && rng() < 0.4) keuze = opties[Math.floor(rng() * opties.length)]
  // hoe langer de ronde duurt, hoe eerder hij klopt (anders kan een ronde eindeloos doorgaan)
  const grens = (niveau === 'makkelijk' ? 25 : niveau === 'moeilijk' ? (s.beurten >= 6 ? 26 : 28) : 27) - Math.floor(s.beurten / 8)
  if (magKloppen(s, sp) && (s.beurten >= 30 || (nu >= grens && keuze.p <= nu + (niveau === 'moeilijk' ? 1 : 0)))) return { soort: 'klop' }
  // niets dat beter wordt: passen (zo komen er misschien nieuwe tafelkaarten)
  if (keuze.p <= nu && niveau !== 'makkelijk') return { soort: 'pas' }
  return keuze.soort === 'alles' ? { soort: 'alles' } : { soort: 'ruil', hand: keuze.hand, tafel: keuze.tafel }
}
export function doeStap(s, sp, stap) {
  if (!stap) return null
  if (stap.soort === 'ruil') return ruil(s, sp, stap.hand, stap.tafel)
  if (stap.soort === 'alles') return ruilAlles(s, sp)
  if (stap.soort === 'klop') return klop(s, sp)
  if (stap.soort === 'pas') return pas(s, sp)
  return null
}

// Tegen de computer (spel.html): v2 speelt de computer binnen het spel zelf (groepspel.js, op de gastheer), voor alle
// zetels die geen mens zijn. solo.js wil wel een bot voor het nagemaakte kanaal: deze doet niets.
export function bot() { return { ontvang() {}, stop() {} } }
