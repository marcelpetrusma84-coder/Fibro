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
//
// De stand is één gewoon object (zie nieuwSpel). Alle functies geven een NIEUWE stand terug of null als het niet mag.
// fase: 'spel' (er wordt gespeeld), 'uitslag' (ronde klaar, de volgende moet nog gedeeld), 'klaar' (iemand is af).

export const KLEUREN = ['h', 'r', 'k', 's']
export const WAARDEN = ['7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const DOEL = 31, LEVENS = 3
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
  s.handen = { 1: [], 2: [] }
  for (let i = 0; i < 3; i++) for (const sp of [begint, ander(begint)]) s.handen[sp].push(stapel.pop())
  s.tafel = [stapel.pop(), stapel.pop(), stapel.pop()]
  s.stapel = stapel
  s.aanZet = begint; s.begint = begint
  s.beurten = 0; s.geklopt = 0; s.fase = 'spel'; s.uitslag = null
  s.laatste = { soort: 'deel', wie: 0, kaarten: [] }
  // Iemand heeft meteen 31: meteen laten zien
  if (punten(s.handen[1]) === DOEL || punten(s.handen[2]) === DOEL) rondeKlaar(s, '31')
}

export function nieuwSpel({ begint = 1, rng = Math.random } = {}) {
  const s = { levens: { 1: LEVENS, 2: LEVENS }, ronde: 1, winnaar: 0, klaar: false }
  deel(s, begint, rng)
  return s
}
export function volgendeRonde(oud, rng = Math.random) {
  if (!oud || oud.fase !== 'uitslag') return null
  const s = kopie(oud)
  s.ronde++
  deel(s, ander(oud.begint), rng)
  return s
}

// De ronde is klaar: tellen, levens eraf, misschien is iemand af
function rondeKlaar(s, reden) {
  const p = { 1: punten(s.handen[1]), 2: punten(s.handen[2]) }
  let verliezers
  if (reden === '31') verliezers = [1, 2].filter(sp => p[sp] !== DOEL)       // wie 31 heeft, wint; de ander verliest
  else verliezers = p[1] === p[2] ? [1, 2] : [p[1] < p[2] ? 1 : 2]
  if (!verliezers.length) verliezers = []                                      // allebei 31: niemand verliest
  for (const sp of verliezers) s.levens[sp] = Math.max(0, s.levens[sp] - 1)
  s.uitslag = { punten: p, verliezers, reden, geklopt: s.geklopt }
  const af = [1, 2].filter(sp => s.levens[sp] === 0)
  if (af.length) { s.fase = 'klaar'; s.klaar = true; s.winnaar = af.length === 2 ? 0 : ander(af[0]) }
  else s.fase = 'uitslag'
}
// Na een ruil: 31 = meteen klaar; was er geklopt, dan was dit de laatste beurt; anders is de ander
function naBeurt(s, sp) {
  s.beurten++
  if (punten(s.handen[sp]) === DOEL) { rondeKlaar(s, '31'); return }
  if (s.geklopt && s.geklopt !== sp) { rondeKlaar(s, 'klop'); return }
  s.aanZet = ander(sp)
}

const aanDeBeurt = (s, sp) => Boolean(s && s.fase === 'spel' && s.aanZet === sp)
export const magRuilen = aanDeBeurt
export function ruil(oud, sp, handKaart, tafelKaart) {
  if (!aanDeBeurt(oud, sp)) return null
  const h = oud.handen[sp].indexOf(handKaart), t = oud.tafel.indexOf(tafelKaart)
  if (h < 0 || t < 0) return null
  const s = kopie(oud)
  s.handen[sp][h] = tafelKaart; s.tafel[t] = handKaart
  s.laatste = { soort: 'ruil', wie: sp, kaarten: [handKaart], gepakt: [tafelKaart] }
  naBeurt(s, sp)
  return s
}
export function ruilAlles(oud, sp) {
  if (!aanDeBeurt(oud, sp)) return null
  const s = kopie(oud)
  const weg = s.handen[sp]
  s.handen[sp] = s.tafel; s.tafel = weg
  s.laatste = { soort: 'alles', wie: sp, kaarten: weg.slice(), gepakt: s.handen[sp].slice() }
  naBeurt(s, sp)
  return s
}
// Kloppen: pas als iedereen één keer aan de beurt is geweest, en maar één keer per ronde
export const magKloppen = (s, sp) => Boolean(aanDeBeurt(s, sp) && !s.geklopt && s.beurten >= 2)
export function klop(oud, sp) {
  if (!magKloppen(oud, sp)) return null
  const s = kopie(oud)
  s.geklopt = sp; s.beurten++
  s.laatste = { soort: 'klop', wie: sp, kaarten: [] }
  s.aanZet = ander(sp)
  return s
}

// Klopt een stand die van de ander komt? (32 kaarten, elk precies één keer)
export function geldigeStand(s) {
  try {
    if (!s || typeof s !== 'object' || ![1, 2].includes(s.aanZet) || ![1, 2].includes(s.begint) || ![0, 1, 2].includes(s.winnaar)) return false
    if (!['spel', 'uitslag', 'klaar'].includes(s.fase) || typeof s.klaar !== 'boolean' || ![0, 1, 2].includes(s.geklopt)) return false
    if (s.handen[1].length !== 3 || s.handen[2].length !== 3 || s.tafel.length !== 3) return false
    const alle = [...s.stapel, ...s.tafel, ...s.handen[1], ...s.handen[2]]
    if (alle.length !== 32 || new Set(alle).size !== 32 || !alle.every(isKaart)) return false
    if (![1, 2].every(sp => Number.isInteger(s.levens[sp]) && s.levens[sp] >= 0 && s.levens[sp] <= LEVENS)) return false
    if (!Number.isInteger(s.beurten) || s.beurten < 0 || !Number.isInteger(s.ronde) || s.ronde < 1) return false
    return true
  } catch (e) { return false }
}

// ── De computerspeler ──
// Wat levert elke ruil op? De beste ruil, of alles ruilen, of kloppen als hij genoeg heeft.
// makkelijk: kijkt maar naar één kaart en klopt al bij 25; normaal: klopt vanaf 27; moeilijk: klopt slimmer (eerder als
// de ander net geklopt heeft kan het niet meer; vanaf 28, of 26 na een paar beurten). Duurt de ronde lang, dan klopt hij
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
  return keuze.soort === 'alles' ? { soort: 'alles' } : { soort: 'ruil', hand: keuze.hand, tafel: keuze.tafel }
}
export function doeStap(s, sp, stap) {
  if (!stap) return null
  if (stap.soort === 'ruil') return ruil(s, sp, stap.hand, stap.tafel)
  if (stap.soort === 'alles') return ruilAlles(s, sp)
  if (stap.soort === 'klop') return klop(s, sp)
  return null
}

// De computer als tegenstander (speler 2) over het nagemaakte kanaal van solo.js. Hij hoort 'zet', 'stand' en
// 'opnieuw' en stuurt zijn zet terug, net als een vriend. Delen doet speler 1 (het spel), niet de computer.
export function bot({ stuur, niveau, isDicht }) {
  let staat = null, spelId = -1, nr = 0, timer = null
  function plan(extra = 0) {
    clearTimeout(timer)
    if (!staat || staat.fase !== 'spel' || staat.aanZet !== 2) return
    timer = setTimeout(() => {
      if (isDicht() || !staat || staat.fase !== 'spel' || staat.aanZet !== 2) return
      const nieuw = doeStap(staat, 2, computerStap(staat, 2, niveau))
      if (!nieuw) return
      staat = nieuw; nr++
      stuur('zet', { staat, nr, spelId })
      if (nieuw.laatste.soort === 'klop' || nieuw.fase !== 'spel') { if (Math.random() < 0.5) setTimeout(() => { if (!isDicht()) stuur('kaartreactie', { emoji: nieuw.laatste.soort === 'klop' ? '😎' : '🔥' }) }, 700) }
    }, 1000 + Math.floor(Math.random() * 800) + extra)
  }
  function neem(p, nieuwSpel) {
    if (!p || !geldigeStand(p.staat)) return
    const id = p.spelId ?? spelId
    if (nieuwSpel ? id <= spelId : (id < spelId || (id === spelId && (p.nr ?? 0) <= nr))) return
    const nieuweRonde = id !== spelId || (staat && staat.ronde !== p.staat.ronde)
    staat = p.staat; spelId = id; nr = p.nr ?? 0
    plan(nieuweRonde ? 2200 : 0)
  }
  return {
    ontvang(event, payload) {
      if (isDicht()) return
      if (event === 'zet' || event === 'stand') neem(payload, false)
      else if (event === 'opnieuw') neem(payload, true)
      else if (event === 'vraag-stand' && staat && (spelId > (payload.spelId ?? -1) || (spelId === (payload.spelId ?? -1) && nr > (payload.nr ?? 0)))) stuur('stand', { staat, nr, spelId })
    },
    stop() { clearTimeout(timer) },
  }
}
