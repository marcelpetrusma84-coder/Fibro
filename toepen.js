// toepen.js - de spelregels van Toepen voor twee spelers (v1, 11 nov 2026). Geen scherm, alleen rekenen: gebruikt door
// toepen-ui.js (het spel), door solo.js (de computerspeler) en door de tests. Gemaakt op de BLAUWDRUK-KAARTSPEL.md.
//
// In gewone woorden, de regels:
//   - Er wordt gespeeld met 32 kaarten: 7, 8, 9, 10, boer, vrouw, heer en aas van elke kleur.
//   - Van laag naar hoog: boer, vrouw, heer, aas, 7, 8, 9, 10. De 10 is dus de hoogste!
//   - Iedereen krijgt 4 kaarten. Er worden 4 slagen gespeeld. Wie uitkomt legt een kaart; de ander moet dezelfde
//     kleur bekennen als hij die heeft. De hoogste kaart van de gevraagde kleur wint de slag en komt weer uit.
//   - Alleen de LAATSTE slag telt: wie die verliest, krijgt strafpunten (de inzet, eerst 1).
//   - Toepen: op je beurt mag je kloppen ("Toep!"). De inzet gaat dan 1 omhoog als de ander meegaat. Gaat de ander
//     niet mee, dan stopt de ronde en krijgt hij de inzet van vóór de toep als strafpunten.
//     Je mag niet twee keer achter elkaar toepen: eerst moet de ander getoept hebben.
//   - Wie 10 strafpunten heeft, verliest. De ander wint.
//
// De stand is één gewoon object (zie nieuwSpel). Alle functies geven een NIEUWE stand terug of null als het niet mag.
// Is een ronde voorbij, dan deelt dezelfde zet meteen de volgende ronde (laatste.ronde vertelt wat er gebeurde).

export const KLEUREN = ['h', 'r', 'k', 's']
export const RANG = ['B', 'V', 'H', 'A', '7', '8', '9', '10']   // van laag naar hoog
export const HANDGROOTTE = 4
export const VERLIES_BIJ = 10

export const kaartInfo = id => ({ kleur: id[0], waarde: id.slice(1) })
export const rang = id => RANG.indexOf(kaartInfo(id).waarde)
export const isKaart = id => typeof id === 'string' && KLEUREN.includes(id[0]) && RANG.includes(id.slice(1))

export function maakDeck() {
  const d = []
  for (const k of KLEUREN) for (const w of RANG) d.push(k + w)
  return d
}
export function schud(lijst, rng = Math.random) {
  const a = lijst.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

const ander = sp => sp === 1 ? 2 : 1
const kopie = s => JSON.parse(JSON.stringify(s))

// Schudden en delen voor een (nieuwe) ronde. begint = wie de eerste slag uitkomt.
function deel(s, begint, rng) {
  s.stapel = schud(maakDeck(), rng)
  s.handen = { 1: [], 2: [] }
  for (let i = 0; i < HANDGROOTTE; i++) for (const sp of [begint, ander(begint)]) s.handen[sp].push(s.stapel.pop())
  s.slag = []; s.weg = []; s.slagNr = 1
  s.inzet = 1; s.laatsteToeper = 0; s.toep = 0
  s.rondeBegint = begint; s.voorhand = begint; s.aanZet = begint
}

export function nieuwSpel({ begint = 1, rng = Math.random } = {}) {
  const s = { straf: { 1: 0, 2: 0 }, begint, ronde: 1, winnaar: 0, beurt: 0, laatste: { soort: 'deel', wie: 0 } }
  deel(s, begint, rng)
  return s
}

// De kleur die gevraagd is in deze slag (of null als jij uitkomt)
export const gevraagd = s => s.slag.length ? kaartInfo(s.slag[0].kaart).kleur : null

// Mag deze kaart nu? Op je beurt, geen toep open, en bekennen als je de gevraagde kleur hebt.
export function magSpelen(s, sp, id) {
  if (!s || s.winnaar || s.toep || s.aanZet !== sp || !s.handen[sp].includes(id)) return false
  const kleur = gevraagd(s)
  if (!kleur) return true
  return kaartInfo(id).kleur === kleur || !s.handen[sp].some(k => kaartInfo(k).kleur === kleur)
}
export const speelbaar = (s, sp) => (s && !s.winnaar && !s.toep && s.aanZet === sp) ? s.handen[sp].filter(id => magSpelen(s, sp, id)) : []

// Wie wint de slag? De hoogste kaart van de gevraagde kleur; wie niet bekent, verliest altijd.
export function slagWinnaar(slag) {
  const [a, b] = slag
  if (kaartInfo(b.kaart).kleur !== kaartInfo(a.kaart).kleur) return a.wie
  return rang(b.kaart) > rang(a.kaart) ? b.wie : a.wie
}

// Een ronde is voorbij: strafpunten, en meteen de volgende ronde delen (of het spel is uit)
function rondeKlaar(s, verliezer, reden, rng) {
  const punten = s.inzet
  s.straf[verliezer] += punten
  const ronde = { winnaar: ander(verliezer), verliezer, punten, reden }
  if (s.straf[verliezer] >= VERLIES_BIJ) {
    s.winnaar = ander(verliezer)
    s.toep = 0
    return ronde
  }
  s.ronde++
  deel(s, ander(s.rondeBegint), rng)
  return ronde
}

export function speel(oud, sp, id, rng = Math.random) {
  if (!magSpelen(oud, sp, id)) return null
  const s = kopie(oud)
  s.handen[sp] = s.handen[sp].filter(k => k !== id)
  s.slag.push({ wie: sp, kaart: id })
  s.beurt++
  s.laatste = { soort: 'speel', wie: sp, kaart: id }
  if (s.slag.length === 1) { s.aanZet = ander(sp); return s }
  const slag = s.slag.slice()
  const w = slagWinnaar(slag)
  s.weg.push(...slag.map(x => x.kaart))
  s.slag = []
  s.laatste.slag = slag.map(x => x.kaart)
  s.laatste.slagWinnaar = w
  s.laatste.slagNr = s.slagNr
  if (s.slagNr >= HANDGROOTTE) { s.laatste.ronde = rondeKlaar(s, ander(w), 'slag', rng); return s }
  s.slagNr++
  s.voorhand = w; s.aanZet = w
  return s
}

// Toepen mag op je beurt (voordat je een kaart legt of als je moet bekennen), niet twee keer achter elkaar
export const magToepen = (s, sp) => Boolean(s && !s.winnaar && !s.toep && s.aanZet === sp && s.laatsteToeper !== sp)
export function toep(oud, sp) {
  if (!magToepen(oud, sp)) return null
  const s = kopie(oud)
  s.toep = sp
  s.aanZet = ander(sp)
  s.beurt++
  s.laatste = { soort: 'toep', wie: sp, inzet: s.inzet + 1 }
  return s
}
// Antwoord op een toep: meegaan (inzet + 1) of eruit gaan (de oude inzet als strafpunten)
export const moetAntwoorden = (s, sp) => Boolean(s && !s.winnaar && s.toep === ander(sp) && s.aanZet === sp)
export function mee(oud, sp) {
  if (!moetAntwoorden(oud, sp)) return null
  const s = kopie(oud)
  s.inzet++
  s.laatsteToeper = s.toep
  s.aanZet = s.toep
  s.toep = 0
  s.beurt++
  s.laatste = { soort: 'mee', wie: sp, inzet: s.inzet }
  return s
}
export function gaUit(oud, sp, rng = Math.random) {
  if (!moetAntwoorden(oud, sp)) return null
  const s = kopie(oud)
  s.toep = 0
  s.beurt++
  s.laatste = { soort: 'uit', wie: sp }
  s.laatste.ronde = rondeKlaar(s, sp, 'uit', rng)
  return s
}

// Klopt een stand die van de ander komt? (32 kaarten, elk precies één keer)
export function geldigeStand(s) {
  try {
    if (!s || typeof s !== 'object' || ![1, 2].includes(s.aanZet) || ![0, 1, 2].includes(s.winnaar)) return false
    if (!Array.isArray(s.slag) || s.slag.length > 1 || !Array.isArray(s.weg)) return false
    const alle = [...s.stapel, ...s.handen[1], ...s.handen[2], ...s.slag.map(x => x.kaart), ...s.weg]
    if (alle.length !== 32 || new Set(alle).size !== 32 || !alle.every(isKaart)) return false
    if (!Number.isInteger(s.inzet) || s.inzet < 1 || ![0, 1, 2].includes(s.toep)) return false
    if (![1, 2].every(sp => Number.isInteger(s.straf[sp]) && s.straf[sp] >= 0)) return false
    return true
  } catch (e) { return false }
}

// ── De computerspeler ──
// Stap: { soort: 'toep' } | { soort: 'mee' } | { soort: 'uit' } | { soort: 'speel', kaart }
// niveau: 'makkelijk' (speelt zomaar wat, gaat bijna altijd mee), 'normaal', 'moeilijk' (bewaart zijn hoogste kaart
// voor de laatste slag, toept met goede kaarten en bluft soms).
function kracht(s, sp) {
  const hand = s.handen[sp]
  if (!hand.length) return 0
  const r = hand.map(rang).sort((a, b) => b - a)
  // de hoogste kaart telt het meest; een tweede hoge kaart helpt (dan heb je er nog een voor de laatste slag)
  return r[0] + (r[1] >= 5 ? 1 : 0)
}
export function computerStap(s, sp, niveau = 'normaal', rng = Math.random) {
  if (!s || s.winnaar || s.aanZet !== sp) return null
  const k = kracht(s, sp)
  if (moetAntwoorden(s, sp)) {
    const meeGaan = niveau === 'makkelijk' ? rng() < 0.8
      : niveau === 'moeilijk' ? (k >= 6 || (k >= 5 && rng() < 0.6) || rng() < 0.15)
      : (k >= 6 || (k >= 5 && rng() < 0.4) || rng() < 0.2)
    return { soort: meeGaan ? 'mee' : 'uit' }
  }
  if (magToepen(s, sp)) {
    const toepen = niveau === 'makkelijk' ? rng() < 0.08
      : niveau === 'moeilijk' ? ((k >= 7 && rng() < 0.7) || (k >= 6 && rng() < 0.35) || rng() < 0.1)
      : ((k >= 7 && rng() < 0.5) || rng() < 0.06)
    if (toepen) return { soort: 'toep' }
  }
  const opties = speelbaar(s, sp)
  if (!opties.length) return null
  if (niveau === 'makkelijk') return { soort: 'speel', kaart: opties[Math.floor(rng() * opties.length)] }
  const laag = opties.slice().sort((a, b) => rang(a) - rang(b))
  const kleur = gevraagd(s)
  if (kleur && niveau === 'moeilijk' && s.slagNr < HANDGROOTTE) {
    // De slag winnen met de laagste kaart die het kan, als je dan je hoogste kaart nog overhoudt voor het einde
    const tegen = s.slag[0].kaart
    const winnend = laag.filter(id => kaartInfo(id).kleur === kleur && rang(id) > rang(tegen))
    const hoogste = s.handen[sp].slice().sort((a, b) => rang(b) - rang(a))[0]
    const goedkoop = winnend.find(id => id !== hoogste)
    if (goedkoop) return { soort: 'speel', kaart: goedkoop }
  }
  // Anders: de laagste kaart (de hoge bewaren voor de laatste slag)
  return { soort: 'speel', kaart: laag[0] }
}

export function doeStap(s, sp, stap, rng = Math.random) {
  if (!stap) return null
  if (stap.soort === 'speel') return speel(s, sp, stap.kaart, rng)
  if (stap.soort === 'toep') return toep(s, sp)
  if (stap.soort === 'mee') return mee(s, sp)
  if (stap.soort === 'uit') return gaUit(s, sp, rng)
  return null
}
