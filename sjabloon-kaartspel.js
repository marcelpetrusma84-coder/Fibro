// sjabloon-kaartspel.js - SJABLOON: de spelregels van een kaartspel voor 2 tot 6 spelers (v1, 27 nov 2026).
// Hoort bij sjabloon-kaartspel-ui.js. Stekky Studio (tests/tools/studio-spel-installeer.mjs) kopieert allebei naar
// <id>.js en <id>-ui.js voor een nieuw kaartspel; daarna komen hier de echte regels (spellen/<id>.md).
//
// Het voorbeeldspel "Hoogste kaart" (zo klein mogelijk, maar met alles wat een kaartspel nodig heeft):
//   - iedereen krijgt 5 kaarten uit een gewoon spel van 52;
//   - om de beurt legt iedereen één kaart op tafel; de hoogste kaart wint de slag (bij gelijk: wie hem het eerst legde);
//   - de winnaar van een slag begint de volgende; na 5 slagen wint wie de meeste slagen heeft (gelijk = gelijkspel).
//
// De vorm is dezelfde als bij Eenendertigen en Poker (BLAUWDRUK-KAARTSPEL.md), zodat groepspel.js het kan spelen:
//   nieuwSpel({ spelers, rng }), doeStap(stand, zetel, stap), computerStap(stand, zetel, niveau, rng),
//   geldigeStand(stand), volgendeRonde(stand) (na een slag; de gastheer roept dit na een pauze aan), aanZet via stand.aanZet.
// Alle functies geven een NIEUWE stand terug, of null als het niet mag. De kaarten komen uit kaarten-motor.js.
import { maakDeck, schud, rang, isKaart } from './kaarten-motor.js?v=1'

export const MIN_SPELERS = 2, MAX_SPELERS = 6
export const KAARTEN_PER_SPELER = 5
const kopie = s => JSON.parse(JSON.stringify(s))
export const zetels = s => Array.from({ length: s.n }, (_, i) => i + 1)
const volgende = (s, z) => (z % s.n) + 1

// fase: 'spel' (er wordt gelegd), 'slag' (slag klaar, de volgende komt zo), 'klaar' (potje voorbij)
export function nieuwSpel({ spelers = 2, rng = Math.random, begint = 1 } = {}) {
  const n = Math.max(MIN_SPELERS, Math.min(MAX_SPELERS, spelers))
  const stapel = schud(maakDeck('52'), rng)
  const handen = {}, slagen = {}
  for (let z = 1; z <= n; z++) { handen[z] = stapel.splice(0, KAARTEN_PER_SPELER); slagen[z] = 0 }
  return { n, fase: 'spel', klaar: false, winnaar: 0, slag: 1, ronde: 1, handen, slagen, tafel: [], stapel,
    aanZet: Math.min(Math.max(1, begint), n), begint: Math.min(Math.max(1, begint), n), slagWinnaar: 0, laatste: { soort: 'deel' } }
}

export const aanDeBeurt = (s, z) => Boolean(s && s.fase === 'spel' && s.aanZet === z)
export const magLeggen = (s, z, kaart) => aanDeBeurt(s, z) && s.handen[z].includes(kaart)

// Een kaart leggen
export function leg(oud, z, kaart) {
  if (!magLeggen(oud, z, kaart)) return null
  const s = kopie(oud)
  s.handen[z] = s.handen[z].filter(k => k !== kaart)
  s.tafel.push({ z, kaart })
  s.laatste = { soort: 'leg', wie: z, kaart }
  if (s.tafel.length < s.n) { s.aanZet = volgende(s, z); return s }
  // iedereen heeft gelegd: wie wint de slag?
  let beste = s.tafel[0]
  for (const t of s.tafel) if (rang(t.kaart) > rang(beste.kaart)) beste = t
  s.slagen[beste.z]++
  s.slagWinnaar = beste.z
  s.aanZet = 0
  s.laatste = { soort: 'slag', wie: z, kaart, winnaar: beste.z }
  if (s.slag < KAARTEN_PER_SPELER) { s.fase = 'slag'; return s }
  s.fase = 'klaar'; s.klaar = true
  const meeste = Math.max(...zetels(s).map(x => s.slagen[x]))
  const top = zetels(s).filter(x => s.slagen[x] === meeste)
  s.winnaar = top.length === 1 ? top[0] : 0   // 0 = gelijkspel
  return s
}
// Na een slag: de tafel leeg, de winnaar van de slag begint
export function volgendeRonde(oud) {
  if (!oud || oud.fase !== 'slag') return null
  const s = kopie(oud)
  s.tafel = []; s.slag++; s.ronde = s.slag; s.fase = 'spel'; s.aanZet = s.slagWinnaar
  s.laatste = { soort: 'nieuweSlag', wie: s.slagWinnaar }
  return s
}
export function doeStap(s, z, stap) {
  if (!stap || typeof stap !== 'object') return null
  if (stap.soort === 'leg') return leg(s, z, stap.kaart)
  return null
}

// De computer: makkelijk legt zomaar iets; normaal en moeilijk winnen de slag zo goedkoop mogelijk (de laagste kaart
// die nog wint), en gooien anders hun laagste kaart weg. Moeilijk houdt zijn hoogste kaart achter als hij als eerste legt.
export function computerStap(s, z, niveau = 'normaal', rng = Math.random) {
  if (!aanDeBeurt(s, z)) return null
  const hand = s.handen[z].slice().sort((a, b) => rang(a) - rang(b))
  if (niveau === 'makkelijk') return { soort: 'leg', kaart: hand[Math.floor(rng() * hand.length)] }
  const hoogste = s.tafel.length ? Math.max(...s.tafel.map(t => rang(t.kaart))) : 0
  if (!s.tafel.length) return { soort: 'leg', kaart: niveau === 'moeilijk' && hand.length > 1 ? hand[hand.length - 2] : hand[hand.length - 1] }
  const wint = hand.find(k => rang(k) > hoogste)
  return { soort: 'leg', kaart: wint || hand[0] }
}

// Klopt een stand die van de gastheer komt? (elke kaart precies één keer; alles op de goede plek)
export function geldigeStand(s) {
  try {
    if (!s || typeof s !== 'object' || !Number.isInteger(s.n) || s.n < MIN_SPELERS || s.n > MAX_SPELERS) return false
    if (!['spel', 'slag', 'klaar'].includes(s.fase) || typeof s.klaar !== 'boolean') return false
    const zet = zetels(s)
    if (![0, ...zet].includes(s.aanZet) || ![0, ...zet].includes(s.winnaar) || (s.fase === 'spel' && !zet.includes(s.aanZet))) return false
    if (!Number.isInteger(s.slag) || s.slag < 1 || s.slag > KAARTEN_PER_SPELER) return false
    if (!Array.isArray(s.tafel) || s.tafel.length > s.n || !s.tafel.every(t => zet.includes(t.z) && isKaart(t.kaart))) return false
    if (!zet.every(z => Array.isArray(s.handen[z]) && Number.isInteger(s.slagen[z]) && s.slagen[z] >= 0)) return false
    const alle = [...s.stapel, ...s.tafel.map(t => t.kaart), ...zet.flatMap(z => s.handen[z])]
    const weg = (s.slag - 1) * s.n   // de kaarten van eerdere slagen zijn van tafel
    if (alle.length + weg !== 52 || new Set(alle).size !== alle.length || !alle.every(k => isKaart(k))) return false
    return true
  } catch (e) { return false }
}

// Tegen de computer speelt groepspel.js de computerzetels zelf; solo.js wil wel een bot voor het nagemaakte kanaal.
export function bot() { return { ontvang() {}, stop() {} } }
