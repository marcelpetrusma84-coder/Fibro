// eenentwintigen.js - de spelregels van Eenentwintigen voor twee spelers (v1, 11 nov 2026). Geen scherm, alleen rekenen:
// gebruikt door eenentwintigen-ui.js (het spel), door solo.js (de computerspeler) en door de tests.
//
// In gewone woorden, de regels:
//   - Iedereen krijgt 2 kaarten. Je ziet alleen je eigen kaarten; van de ander zie je hoeveel hij er heeft.
//   - Kaarten 2 t/m 10 tellen wat erop staat, boer, vrouw en heer tellen 10, een aas telt 11 of 1 (wat het beste uitkomt).
//   - Om de beurt: wie begint, pakt kaarten tot hij zegt "Ik blijf". Daarna is de ander.
//   - Kom je boven de 21, dan ben je meteen af ("te veel") en wint de ander. Precies 21 = je blijft vanzelf.
//   - Hebben allebei "Ik blijf" gezegd, dan worden de kaarten omgedraaid: wie het dichtst bij 21 zit, wint.
//     Evenveel = gelijkspel.
//
// De stand is één gewoon object (zie nieuwSpel). Alle functies geven een NIEUWE stand terug of null als het niet mag.

export const KLEUREN = ['h', 'r', 'k', 's']
export const WAARDEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const DOEL = 21

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
const kopie = s => JSON.parse(JSON.stringify(s))

// De waarde van een hand. zacht = er telt een aas als 11 (dan kun je nog veilig pakken).
export function telling(hand) {
  let totaal = 0, azen = 0
  for (const id of hand) {
    const w = kaartInfo(id).waarde
    if (w === 'A') { azen++; totaal += 11 } else if (['B', 'V', 'H'].includes(w)) { totaal += 10 } else { totaal += Number(w) }
  }
  while (totaal > DOEL && azen) { totaal -= 10; azen-- }
  return { totaal, zacht: azen > 0 }
}
export const totaal = hand => telling(hand).totaal

export function nieuwSpel({ begint = 1, rng = Math.random } = {}) {
  const stapel = schud(maakDeck(), rng)
  const handen = { 1: [], 2: [] }
  for (let i = 0; i < 2; i++) for (const sp of [begint, ander(begint)]) handen[sp].push(stapel.pop())
  const s = { stapel, handen, aanZet: begint, begint, gestopt: { 1: false, 2: false }, klaar: false, winnaar: 0, beurt: 0,
    laatste: { soort: 'deel', wie: 0, kaarten: [] } }
  // Wie met twee kaarten al 21 heeft, blijft vanzelf
  if (totaal(handen[begint]) === DOEL) blijf(s, begint)
  return s
}

// Klaar: kaarten omdraaien en kijken wie wint
function uitslag(s) {
  s.klaar = true
  const a = totaal(s.handen[1]), b = totaal(s.handen[2])
  s.winnaar = a > DOEL ? 2 : b > DOEL ? 1 : a > b ? 1 : b > a ? 2 : 0
}
// Iemand blijft: de ander is aan de beurt, of het spel is klaar
function blijf(s, sp) {
  s.gestopt[sp] = true
  if (s.gestopt[ander(sp)]) { uitslag(s); return }
  s.aanZet = ander(sp)
  if (totaal(s.handen[s.aanZet]) === DOEL) blijf(s, s.aanZet)   // de ander heeft al 21
}

export const magPakken = (s, sp) => Boolean(s && !s.klaar && s.aanZet === sp && !s.gestopt[sp] && s.stapel.length)
export function pak(oud, sp) {
  if (!magPakken(oud, sp)) return null
  const s = kopie(oud)
  const id = s.stapel.pop()
  s.handen[sp].push(id)
  s.beurt++
  const t = totaal(s.handen[sp])
  s.laatste = { soort: 'pak', wie: sp, kaarten: [id], totaal: t }
  if (t > DOEL) { s.laatste.soort = 'dood'; s.gestopt[sp] = true; uitslag(s) }
  else if (t === DOEL) { s.laatste.eenentwintig = true; blijf(s, sp) }
  return s
}
export const magBlijven = (s, sp) => Boolean(s && !s.klaar && s.aanZet === sp && !s.gestopt[sp])
export function stop(oud, sp) {
  if (!magBlijven(oud, sp)) return null
  const s = kopie(oud)
  s.beurt++
  s.laatste = { soort: 'stop', wie: sp, kaarten: [] }
  blijf(s, sp)
  return s
}

// Klopt een stand die van de ander komt? (52 kaarten, elk precies één keer)
export function geldigeStand(s) {
  try {
    if (!s || typeof s !== 'object' || ![1, 2].includes(s.aanZet) || ![0, 1, 2].includes(s.winnaar)) return false
    const alle = [...s.stapel, ...s.handen[1], ...s.handen[2]]
    if (alle.length !== 52 || new Set(alle).size !== 52 || !alle.every(isKaart)) return false
    if (s.handen[1].length < 2 || s.handen[2].length < 2 || typeof s.klaar !== 'boolean') return false
    return true
  } catch (e) { return false }
}

// ── De computerspeler ──
// niveau: 'makkelijk' (stopt ergens tussen 13 en 18), 'normaal' (pakt tot 17), 'moeilijk' (pakt ook bij een zachte 17,
// en als tweede een beetje meer als de ander veel kaarten heeft gepakt).
export function computerStap(s, sp, niveau = 'normaal', rng = Math.random) {
  if (!magBlijven(s, sp)) return null
  const { totaal: t, zacht } = telling(s.handen[sp])
  let grens = 17
  if (niveau === 'makkelijk') grens = 13 + Math.floor(rng() * 6)
  else if (niveau === 'moeilijk') {
    if (zacht && t === 17) grens = 18
    if (s.gestopt[ander(sp)] && s.handen[ander(sp)].length >= 4) grens = Math.max(grens, 18)
  }
  return t < grens && s.stapel.length ? { soort: 'pak' } : { soort: 'stop' }
}
export function doeStap(s, sp, stap) {
  if (!stap) return null
  if (stap.soort === 'pak') return pak(s, sp)
  if (stap.soort === 'stop') return stop(s, sp)
  return null
}
