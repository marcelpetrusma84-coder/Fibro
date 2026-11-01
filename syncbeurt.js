// syncbeurt.js (v247, 31 okt 2026): met welke vriend synct Fibro, en wat zeg je als een vriend vraagt om te syncen?
//
// Fibro synct met één vriend tegelijk (sync.js). Vroeger koos het steeds de eerste online vriend en bleef daaraan
// hangen; twee telefoons kwamen alleen bij elkaar als ze toevallig allebei voor elkaar kozen. Nu:
//  - Elke vriend komt om de beurt: wie het langst niet klaar was (of nog nooit), gaat voor. Een vriend waarmee net
//    alles klaar is, komt pas na OPNIEUW_NA_MS weer aan de beurt; heeft hij volgens de server iets nieuws
//    (profiel_versie), dan al na NIEUW_NA_MS. De vriend van een open chat (of een gevraagde video) gaat altijd voor.
//  - Vrienden met een oudere Fibro (kennen de vraag niet) komen na de anderen.
//  - Voordat je een verbinding opent, vraag je het de vriend (paren.js, bericht 'syncbeurt'). Hij zegt ja (en begint
//    ook), of nee: hij is bezig met iemand anders, vraagt zelf net iemand anders, of de relay-rust loopt nog.
//  - Is het met een vriend klaar (alles binnen, aan beide kanten), dan ga je door naar de volgende.
// Alleen beslissingen, geen netwerk: zo is het zonder telefoons te testen (tests/sync/test-syncbeurt.mjs).

export const OPNIEUW_NA_MS = 10 * 60 * 1000   // klaar met een vriend: 10 minuten niet opnieuw
export const NIEUW_NA_MS = 2 * 60 * 1000      // ...tenzij hij iets nieuws heeft: dan na 2 minuten
export const BEZIG_MS = 15 * 1000             // "nee, ik ben bezig": 15 s later opnieuw vragen
export const RUST_MS = 15 * 60 * 1000         // "nee, relay-rust": niet binnen 15 minuten opnieuw
export const VRAAG_MS = 6000                  // zo lang wachten op ja of nee

// De volgende vriend om mee te syncen, of null (iedereen is al aan de beurt geweest: dan even wachten).
//   kandidaten: online vrienden die nu mogen (geen pauze na een mislukking, geen relay-rust)
//   voorkeur:   vrienden die altijd voorgaan (open chat, gevraagde video), in volgorde
//   klaarOp:    { vriendId: tijd } wanneer het met die vriend voor het laatst helemaal klaar was
//   bezigTot:   { vriendId: tijd } tot wanneer die vriend 'nee' zei
//   nieuw:      Set van vrienden met iets nieuws volgens de server
//   behalve:    deze vriend niet (waar je net mee klaar bent)
//   achteraan:  Set van vrienden met een oudere Fibro (die kennen de vraag niet): pas na de anderen
export function kiesVolgende({ kandidaten = [], voorkeur = [], klaarOp = {}, bezigTot = {}, nieuw = new Set(), achteraan = new Set(), nu = Date.now(), behalve = null } = {}) {
  const mag = (id) => !!id && id !== behalve && kandidaten.includes(id) && !(Number(bezigTot[id]) > nu)
  for (const id of voorkeur) if (mag(id)) return id
  const ooit = (id) => Number(klaarOp[id]) > 0
  const wanneer = (id) => (ooit(id) ? Number(klaarOp[id]) : -Infinity)   // nog nooit klaar: altijd aan de beurt, en eerst
  const lijst = kandidaten.filter(mag).filter((id) => !ooit(id) || nu - wanneer(id) >= (nieuw.has(id) ? NIEUW_NA_MS : OPNIEUW_NA_MS))
  // eerst wie iets nieuws heeft, dan wie het langst geleden was; bij gelijke stand op id (altijd dezelfde volgorde)
  const verschil = (a, b) => (wanneer(a) === wanneer(b) ? 0 : wanneer(a) < wanneer(b) ? -1 : 1)
  lijst.sort((a, b) => (nieuw.has(b) - nieuw.has(a)) || (achteraan.has(a) - achteraan.has(b)) || verschil(a, b) || (a < b ? -1 : a > b ? 1 : 0))
  return lijst[0] || null
}

// Wanneer is er weer iemand aan de beurt? (voor een wekker als kiesVolgende null gaf) Infinity = niemand.
export function volgendeMoment({ kandidaten = [], klaarOp = {}, bezigTot = {}, nieuw = new Set(), nu = Date.now() } = {}) {
  let eerst = Infinity
  for (const id of kandidaten) {
    const klaar = Number(klaarOp[id]) > 0 ? Number(klaarOp[id]) + (nieuw.has(id) ? NIEUW_NA_MS : OPNIEUW_NA_MS) : nu
    eerst = Math.min(eerst, Math.max(klaar, Number(bezigTot[id]) || 0, nu))
  }
  return eerst
}

// Een vriend vraagt om te syncen. Wat zeg je?
//   partner:   met wie je nu synct (of null)
//   klaar:     met die partner is alles klaar, aan beide kanten
//   beschermd: die partner mag niet onderbroken worden (open chat, video)
//   wachtOp:   wie je zelf net gevraagd hebt (of null)
//   inRust:    met de vrager loopt de relay-rust nog
// Geeft { antwoord: 'ja' | 'nee', reden, stopEerst }: stopEerst = eerst de huidige sync stoppen.
export function beslisVraag({ van, partner = null, klaar = false, beschermd = false, wachtOp = null, inRust = false } = {}) {
  if (inRust) return { antwoord: 'nee', reden: 'rust' }
  if (wachtOp && wachtOp === van) return { antwoord: 'ja' }              // jullie vroegen elkaar tegelijk
  if (wachtOp) return { antwoord: 'nee', reden: 'wacht' }               // ik vraag net iemand anders
  if (!partner) return { antwoord: 'ja' }
  if (partner === van) return { antwoord: 'ja', stopEerst: true }        // hij begint opnieuw (bijv. nieuwe pagina)
  if (klaar && !beschermd) return { antwoord: 'ja', stopEerst: true }    // klaar met de vorige: hij is aan de beurt
  return { antwoord: 'nee', reden: 'bezig' }
}

// Hoe lang wacht je na een 'nee' voordat je die vriend weer vraagt? (wacht: kort en een beetje willekeurig, zodat
// drie vrienden die elkaar in een kring vragen elkaar daarna wel vinden)
export function wachtNaNee(reden, toeval = Math.random()) {
  if (reden === 'rust') return RUST_MS
  if (reden === 'wacht') return 1500 + Math.floor(toeval * 3500)
  return BEZIG_MS
}
