// pokertexasholdem.js - de spelregels van Poker Texas Hold'em voor 2 tot 6 spelers (v1, 27 nov 2026, uit Stekky Studio:
// spellen/pokertexasholdem.md). Geen scherm, alleen rekenen: gebruikt door pokertexasholdem-ui.js (het spel, via
// groepspel.js), door de computerspeler hieronder (computerStap) en door de tests.
//
// In gewone woorden, de regels (zoals Marcel ze koos):
//   - Een gewoon kaartspel van 52 kaarten. Iedereen begint met 1000 speelfiches.
//   - Elke hand: de dealerknop schuift één plek op. Links van de knop legt de small blind in, daarnaast de big blind
//     (met z'n tweeën is de knop zelf de small blind). De blinds beginnen op 10/20 en gaan elke 10 handen omhoog.
//   - Iedereen krijgt 2 eigen kaarten. Dan 4 inzetrondes: pre-flop, flop (3 kaarten op tafel), turn (de 4e), river (de 5e).
//     Voor elke tafelkaart gaat er eerst één kaart dicht weg (verbranden).
//   - In een inzetronde: check (niets inzetten als er nog niets ligt), call (meegaan), raise (verhogen, minstens zoveel
//     als de vorige verhoging, de eerste keer minstens de big blind), all-in (al je fiches) of fold (weggooien).
//   - Pre-flop begint links van de big blind; daarna links van de knop.
//   - Blijft er één speler over, dan krijgt die de pot. Na de river laten de anderen hun kaarten zien: de beste vijf
//     kaarten uit je 2 eigen en de 5 op tafel winnen. Gelijk = de pot delen (een fiche die overblijft gaat naar wie
//     het eerst links van de knop zit).
//   - Wie all-in is, kan alleen winnen wat hij zelf inzette, van ieder ander (zijpotten).
//   - Wie geen fiches meer heeft, ligt eruit. Wie als laatste fiches heeft, wint.
//
// De stand is één gewoon object (zie nieuwSpel). Alle functies geven een NIEUWE stand terug of null als het niet mag.
// fase: 'spel' (er wordt gespeeld), 'uitslag' (hand klaar, de volgende moet nog gedeeld), 'klaar' (iemand heeft alles).
// straat: 'preflop', 'flop', 'turn', 'river'.

export const KLEUREN = ['h', 'r', 'k', 's']
export const WAARDEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const MIN_SPELERS = 2, MAX_SPELERS = 6
export const BEGIN_FICHES = 1000
export const HANDEN_PER_NIVEAU = 10
// De blinds per niveau (klein, groot); na het laatste niveau gaan ze steeds × 2
export const BLINDS = [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000]]
const STRATEN = ['preflop', 'flop', 'turn', 'river']

export const kaartInfo = id => ({ kleur: id[0], waarde: id.slice(1) })
export const isKaart = id => typeof id === 'string' && KLEUREN.includes(id[0]) && WAARDEN.includes(id.slice(1))
export const rang = id => WAARDEN.indexOf(id.slice(1)) + 2   // 2 .. 14 (aas)
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
const kopie = s => JSON.parse(JSON.stringify(s))
export const zetels = s => Array.from({ length: s.n }, (_, i) => i + 1)
export function blindsVoorHand(hand) {
  const niveau = Math.floor((hand - 1) / HANDEN_PER_NIVEAU)
  if (niveau < BLINDS.length) return BLINDS[niveau]
  const [k, g] = BLINDS[BLINDS.length - 1], keer = 2 ** (niveau - BLINDS.length + 1)
  return [k * keer, g * keer]
}

// ── Handen beoordelen ──
// Een score is een lijst getallen: eerst de soort (8 straight flush ... 0 hoge kaart), dan wat bij gelijke soort beslist.
export const HAND_NAMEN = ['Hoge kaart', 'Eén paar', 'Twee paar', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Royal flush']
export function vergelijk(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d }
  return 0
}
function straatHoog(rangen) {   // rangen: uniek, van hoog naar laag. Geeft de hoogste kaart van een straat, of 0
  const r = rangen.includes(14) ? [...rangen, 1] : rangen
  for (let i = 0; i + 4 < r.length; i++) if (r[i] - r[i + 4] === 4) return r[i]
  return 0
}
export function score5(kaarten) {
  const r = kaarten.map(rang).sort((a, b) => b - a)
  const flush = kaarten.every(k => k[0] === kaarten[0][0])
  const uniek = [...new Set(r)]
  const straat = uniek.length === 5 ? straatHoog(uniek) : 0
  if (flush && straat) return [8, straat]
  const tel = new Map(); for (const x of r) tel.set(x, (tel.get(x) || 0) + 1)
  const groepen = [...tel.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])   // meeste eerst, dan hoogste
  const vorm = groepen.map(g => g[1]).join('')
  const op = groepen.map(g => g[0])
  if (vorm === '41') return [7, ...op]
  if (vorm === '32') return [6, ...op]
  if (flush) return [5, ...r]
  if (straat) return [4, straat]
  if (vorm === '311') return [3, ...op]
  if (vorm === '221') return [2, ...op]
  if (vorm === '2111') return [1, ...op]
  return [0, ...r]
}
// De beste 5 uit 5, 6 of 7 kaarten: { score, kaarten, naam }
export function besteHand(kaarten) {
  let beste = null
  const n = kaarten.length
  const kies = (start, gekozen) => {
    if (gekozen.length === 5) { const s = score5(gekozen); if (!beste || vergelijk(s, beste.score) > 0) beste = { score: s, kaarten: gekozen.slice() }; return }
    for (let i = start; i <= n - (5 - gekozen.length); i++) { gekozen.push(kaarten[i]); kies(i + 1, gekozen); gekozen.pop() }
  }
  if (n >= 5) kies(0, [])
  if (!beste) return null
  beste.naam = handNaam(beste.score)
  return beste
}
export const handNaam = score => score[0] === 8 && score[1] === 14 ? HAND_NAMEN[9] : HAND_NAMEN[score[0]]
// Wat heb je nu (ook met minder dan 5 kaarten: een paar, twee paar, three of a kind of four of a kind)
export function huidigeHand(kaarten) {
  if (kaarten.length >= 5) return besteHand(kaarten).naam
  const tel = new Map(); for (const k of kaarten) tel.set(rang(k), (tel.get(rang(k)) || 0) + 1)
  const v = [...tel.values()].sort((a, b) => b - a)
  if (v[0] === 4) return HAND_NAMEN[7]
  if (v[0] === 3) return HAND_NAMEN[3]
  if (v[0] === 2 && v[1] === 2) return HAND_NAMEN[2]
  if (v[0] === 2) return HAND_NAMEN[1]
  return HAND_NAMEN[0]
}

// ── De stand ──
const speeltMee = (s, z) => s.handen[z].length === 2 && !s.gepast[z]          // nog in de hand
const kanHandelen = (s, z) => speeltMee(s, z) && s.fiches[z] > 0               // niet gefold, niet all-in
export const inSpel = s => zetels(s).filter(z => s.fiches[z] > 0 || (s.fase === 'spel' && s.handen[z].length === 2 && s.totaal[z] > 0))
export const pot = s => zetels(s).reduce((t, z) => t + s.totaal[z] + s.inzet[z], 0)
function volgendeVan(s, z, mag) {
  for (let i = 1; i <= s.n; i++) { const x = ((z - 1 + i) % s.n) + 1; if (mag(x)) return x }
  return 0
}

export function nieuwSpel({ spelers = 2, rng = Math.random, fiches = BEGIN_FICHES, knop } = {}) {
  const n = Math.max(MIN_SPELERS, Math.min(MAX_SPELERS, spelers))
  const leeg = w => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, typeof w === 'function' ? w() : w]))
  const s = { n, fase: 'spel', klaar: false, winnaar: 0, hand: 0, ronde: 0, knop: knop || n, fiches: leeg(fiches), begint: 1,
    handen: leeg(() => []), gepast: leeg(false), inzet: leeg(0), totaal: leeg(0), gehandeld: leeg(false),
    bord: [], stapel: [], verbrand: [], straat: 'preflop', aanZet: 0, hoogste: 0, minRaise: 0, blinds: [0, 0], laatste: null, uitslag: null }
  return deel(s, rng)
}

// Een nieuwe hand: knop schuift door, blinds, 2 kaarten voor iedereen met fiches
function deel(s, rng = Math.random) {
  const levend = zetels(s).filter(z => s.fiches[z] > 0)
  s.hand++; s.ronde = s.hand; s.beurten = 0
  s.fase = 'spel'; s.uitslag = null; s.bord = []; s.verbrand = []; s.straat = 'preflop'
  for (const z of zetels(s)) { s.handen[z] = []; s.gepast[z] = false; s.inzet[z] = 0; s.totaal[z] = 0; s.gehandeld[z] = false }
  s.knop = volgendeVan(s, s.knop, z => s.fiches[z] > 0)
  const [klein, groot] = blindsVoorHand(s.hand)
  s.blinds = [klein, groot]
  const sb = levend.length === 2 ? s.knop : volgendeVan(s, s.knop, z => s.fiches[z] > 0)
  const bb = volgendeVan(s, sb, z => s.fiches[z] > 0)
  s.stapel = schud(maakDeck(), rng)
  for (let r = 0; r < 2; r++) { let z = sb; for (let i = 0; i < levend.length; i++) { s.handen[z].push(s.stapel.pop()); z = volgendeVan(s, z, x => s.fiches[x] > 0) } }
  const leg = (z, b) => { const x = Math.min(b, s.fiches[z]); s.fiches[z] -= x; s.inzet[z] += x }
  leg(sb, klein); leg(bb, groot)
  s.hoogste = groot; s.minRaise = groot; s.raises = 0
  s.kleineBlind = sb; s.groteBlind = bb
  s.laatste = { soort: 'deel', wie: 0, kaarten: [] }
  s.aanZet = volgendeVan(s, bb, z => kanHandelen(s, z))
  // niemand (of maar één die nog iets moet) kan handelen: meteen door (bijvoorbeeld als de blinds iedereen all-in zetten)
  if (!s.aanZet || rondeKlaar(s)) volgendeStraat(s)
  return s
}

// Is de inzetronde klaar? Iedereen die nog kan handelen heeft gehandeld en evenveel ingezet.
function rondeKlaar(s) {
  const mee = zetels(s).filter(z => speeltMee(s, z))
  if (mee.length <= 1) return true
  const kunnen = mee.filter(z => s.fiches[z] > 0)
  if (kunnen.length === 0) return true
  if (kunnen.length === 1 && s.inzet[kunnen[0]] >= Math.max(...mee.map(z => s.inzet[z]))) return true
  return kunnen.every(z => s.gehandeld[z] && s.inzet[z] === s.hoogste)
}
// Na een inzetronde: de inzetten gaan in de pot, de volgende tafelkaart(en), of de uitslag
function volgendeStraat(s) {
  for (const z of zetels(s)) { s.totaal[z] += s.inzet[z]; s.inzet[z] = 0; s.gehandeld[z] = false }
  s.hoogste = 0; s.minRaise = s.blinds[1]; s.raises = 0
  const mee = zetels(s).filter(z => speeltMee(s, z))
  if (mee.length <= 1) { uitslag(s); return }
  const i = STRATEN.indexOf(s.straat)
  if (i === 3) { uitslag(s); return }
  s.straat = STRATEN[i + 1]
  s.verbrand.push(s.stapel.pop())
  const erbij = s.straat === 'flop' ? 3 : 1
  const nieuw = []
  for (let k = 0; k < erbij; k++) nieuw.push(s.stapel.pop())
  s.bord.push(...nieuw)
  s.laatste = { ...(s.laatste || {}), straat: s.straat, nieuwBord: [...(s.laatste?.nieuwBord || []), ...nieuw] }
  // Kan er nog maar één (of niemand) handelen? Dan gaan alle kaarten vanzelf open.
  const kunnen = mee.filter(z => s.fiches[z] > 0)
  if (kunnen.length <= 1) { volgendeStraat(s); return }
  s.aanZet = volgendeVan(s, s.knop, z => kanHandelen(s, z))
}

// De uitslag: zijpotten, de beste handen, wie wat krijgt
function uitslag(s) {
  s.aanZet = 0
  for (const z of zetels(s)) { s.totaal[z] += s.inzet[z]; s.inzet[z] = 0 }
  const mee = zetels(s).filter(z => speeltMee(s, z))
  const totaalPot = zetels(s).reduce((t, z) => t + s.totaal[z], 0)
  const u = { potten: [], gewonnen: {}, handen: {}, getoond: mee.length > 1 }
  if (mee.length === 1) {
    u.potten.push({ bedrag: totaalPot, winnaars: [mee[0]] })
    u.gewonnen[mee[0]] = totaalPot
    s.fiches[mee[0]] += totaalPot
  } else {
    for (const z of mee) u.handen[z] = besteHand([...s.handen[z], ...s.bord])
    const niveaus = [...new Set(zetels(s).map(z => s.totaal[z]).filter(x => x > 0))].sort((a, b) => a - b)
    let vorig = 0
    for (const niv of niveaus) {
      const bedrag = zetels(s).reduce((t, z) => t + Math.min(s.totaal[z], niv) - Math.min(s.totaal[z], vorig), 0)
      const kans = mee.filter(z => s.totaal[z] >= niv)
      vorig = niv
      if (!bedrag) continue
      if (!kans.length) {   // niemand die nog meedoet zette zoveel in: terug naar wie het inzette
        const terug = zetels(s).filter(z => s.totaal[z] >= niv)
        terug.forEach((z, i) => { s.fiches[z] += Math.floor(bedrag / terug.length) + (i < bedrag % terug.length ? 1 : 0) })
        continue
      }
      let beste = []
      for (const z of kans) {
        if (!beste.length) { beste = [z]; continue }
        const d = vergelijk(u.handen[z].score, u.handen[beste[0]].score)
        if (d > 0) beste = [z]; else if (d === 0) beste.push(z)
      }
      // rest-fiche naar wie het eerst links van de knop zit
      beste.sort((a, b) => ((a - s.knop - 1 + s.n) % s.n) - ((b - s.knop - 1 + s.n) % s.n))
      const deel_ = Math.floor(bedrag / beste.length), rest = bedrag - deel_ * beste.length
      beste.forEach((z, i) => { const x = deel_ + (i < rest ? 1 : 0); s.fiches[z] += x; u.gewonnen[z] = (u.gewonnen[z] || 0) + x })
      const vorige = u.potten[u.potten.length - 1]
      if (vorige && vorige.winnaars.join() === beste.join()) vorige.bedrag += bedrag
      else u.potten.push({ bedrag, winnaars: beste.slice(), hand: u.handen[beste[0]].naam })
    }
  }
  for (const z of zetels(s)) s.totaal[z] = 0
  s.uitslag = u
  s.laatste = { ...(s.laatste || {}), uitslag: true }
  const levend = zetels(s).filter(z => s.fiches[z] > 0)
  if (levend.length <= 1) { s.fase = 'klaar'; s.klaar = true; s.winnaar = levend[0] || 0 }
  else s.fase = 'uitslag'
}

// Hand klaar: de volgende hand (de gastheer roept dit aan na een pauze)
export function volgendeRonde(oud, rng = Math.random) {
  if (!oud || oud.fase !== 'uitslag') return null
  return deel(kopie(oud), rng)
}

// ── Wat mag je? ──
export const aanDeBeurt = (s, z) => Boolean(s && s.fase === 'spel' && s.aanZet === z && kanHandelen(s, z))
export const teBetalen = (s, z) => Math.max(0, Math.min(s.hoogste - s.inzet[z], s.fiches[z]))
export const magChecken = (s, z) => aanDeBeurt(s, z) && s.inzet[z] >= s.hoogste
export const magCallen = (s, z) => aanDeBeurt(s, z) && s.inzet[z] < s.hoogste
// Raise naar 'tot' (je totale inzet in deze ronde). Minimaal: hoogste + minRaise; maximaal: al je fiches.
export const minRaiseTot = (s, z) => Math.min(s.hoogste + s.minRaise, s.inzet[z] + s.fiches[z])
export const maxRaiseTot = (s, z) => s.inzet[z] + s.fiches[z]
export const magRaisen = (s, z) => aanDeBeurt(s, z) && s.inzet[z] + s.fiches[z] > s.hoogste
  && zetels(s).some(x => x !== z && kanHandelen(s, x))   // er moet nog iemand zijn die kan meegaan

function naActie(s, z) {
  s.gehandeld[z] = true
  s.beurten++
  if (rondeKlaar(s)) { volgendeStraat(s); return }
  s.aanZet = volgendeVan(s, z, x => kanHandelen(s, x))
  if (!s.aanZet) volgendeStraat(s)
}
export function fold(oud, z) {
  if (!aanDeBeurt(oud, z)) return null
  const s = kopie(oud)
  s.gepast[z] = true
  s.laatste = { soort: 'fold', wie: z }
  naActie(s, z)
  return s
}
export function check(oud, z) {
  if (!magChecken(oud, z)) return null
  const s = kopie(oud)
  s.laatste = { soort: 'check', wie: z }
  naActie(s, z)
  return s
}
export function call(oud, z) {
  if (!magCallen(oud, z)) return null
  const s = kopie(oud)
  const x = teBetalen(s, z)
  s.fiches[z] -= x; s.inzet[z] += x
  s.laatste = { soort: s.fiches[z] === 0 ? 'allin' : 'call', wie: z, bedrag: x, tot: s.inzet[z] }
  naActie(s, z)
  return s
}
export function raise(oud, z, tot) {
  if (!magRaisen(oud, z) || !Number.isInteger(tot)) return null
  const max = maxRaiseTot(oud, z)
  if (tot > max || tot <= oud.hoogste) return null
  if (tot < oud.hoogste + oud.minRaise && tot !== max) return null   // te weinig verhoogd (alleen all-in mag minder)
  const s = kopie(oud)
  const x = tot - s.inzet[z]
  s.fiches[z] -= x; s.inzet[z] = tot
  const verhoging = tot - s.hoogste
  if (verhoging >= s.minRaise) s.minRaise = verhoging
  const eerste = s.hoogste === 0
  s.hoogste = tot
  s.raises = (s.raises || 0) + 1
  // iedereen moet weer iets doen (behalve wie raisede)
  for (const x2 of zetels(s)) if (x2 !== z) s.gehandeld[x2] = false
  s.laatste = { soort: s.fiches[z] === 0 ? 'allin' : eerste ? 'bet' : 'raise', wie: z, bedrag: x, tot }
  naActie(s, z)
  return s
}
export function allIn(oud, z) {
  if (!aanDeBeurt(oud, z)) return null
  const tot = maxRaiseTot(oud, z)
  return tot > oud.hoogste && magRaisen(oud, z) ? raise(oud, z, tot) : magCallen(oud, z) ? call(oud, z) : null
}
export function doeStap(s, z, stap) {
  if (!stap || typeof stap !== 'object') return null
  if (stap.soort === 'fold') return fold(s, z)
  if (stap.soort === 'check') return check(s, z)
  if (stap.soort === 'call') return call(s, z)
  if (stap.soort === 'raise') return raise(s, z, Number(stap.tot))
  if (stap.soort === 'allin') return allIn(s, z)
  return null
}

// Klopt een stand die van de gastheer komt? (52 kaarten, elk precies één keer; fiches kloppen)
export function geldigeStand(s) {
  try {
    if (!s || typeof s !== 'object') return false
    if (!Number.isInteger(s.n) || s.n < MIN_SPELERS || s.n > MAX_SPELERS) return false
    const zet = zetels(s)
    if (!['spel', 'uitslag', 'klaar'].includes(s.fase) || typeof s.klaar !== 'boolean' || !STRATEN.includes(s.straat)) return false
    if (![0, ...zet].includes(s.winnaar) || ![0, ...zet].includes(s.aanZet) || !zet.includes(s.knop)) return false
    if (s.fase === 'spel' && !zet.includes(s.aanZet)) return false
    const getal = x => Number.isSafeInteger(x) && x >= 0
    if (!zet.every(z => getal(s.fiches[z]) && getal(s.inzet[z]) && getal(s.totaal[z]) && typeof s.gepast[z] === 'boolean')) return false
    if (!zet.every(z => Array.isArray(s.handen[z]) && (s.handen[z].length === 0 || s.handen[z].length === 2))) return false
    if (!Array.isArray(s.bord) || s.bord.length > 5 || !Array.isArray(s.verbrand) || s.verbrand.length > 3) return false
    const alle = [...s.stapel, ...s.bord, ...s.verbrand, ...zet.flatMap(z => s.handen[z])]
    if (alle.length !== 52 || new Set(alle).size !== 52 || !alle.every(isKaart)) return false
    if (!Number.isInteger(s.hand) || s.hand < 1 || !getal(s.hoogste) || !getal(s.minRaise)) return false
    return true
  } catch (e) { return false }
}

// ── De computerspeler ──
// Hoe goed is mijn hand? Een kans (0 tot 1) om te winnen tegen de spelers die nog meedoen, door de rest van de kaarten
// een paar honderd keer na te spelen (Monte Carlo). Pre-flop met minder potjes, want dat gaat vaak.
export function winKans(hand, bord, tegen, { potjes = 200, rng = Math.random, weg = [] } = {}) {
  const bekend = new Set([...hand, ...bord, ...weg])
  const rest = maakDeck().filter(k => !bekend.has(k))
  let winst = 0
  for (let p = 0; p < potjes; p++) {
    const d = rest.slice()
    const trek = () => { const i = Math.floor(rng() * d.length); const k = d[i]; d[i] = d[d.length - 1]; d.pop(); return k }
    const anderen = Array.from({ length: Math.max(1, tegen) }, () => [trek(), trek()])
    const b = bord.slice(); while (b.length < 5) b.push(trek())
    const mijn = besteHand([...hand, ...b]).score
    let beter = 0, gelijk = 0
    for (const a of anderen) { const d2 = vergelijk(besteHand([...a, ...b]).score, mijn); if (d2 > 0) { beter++; break } if (d2 === 0) gelijk++ }
    if (!beter) winst += 1 / (gelijk + 1)
  }
  return winst / potjes
}
// niveau: makkelijk (speelt bijna alles mee, raiset zelden, doet soms iets geks), normaal (kijkt naar de kans en de pot),
// moeilijk (rekent preciezer, raiset met goede handen en bluft af en toe).
export function computerStap(s, z, niveau = 'normaal', rng = Math.random) {
  if (!aanDeBeurt(s, z)) return null
  const stap = denk(s, z, niveau, rng)
  if (stap && doeStap(s, z, stap)) return stap
  return magChecken(s, z) ? { soort: 'check' } : { soort: 'call' }   // voor de zekerheid: nooit vastlopen
}
function denk(s, z, niveau, rng) {
  const tegen = zetels(s).filter(x => x !== z && speeltMee(s, x)).length
  const potjes = niveau === 'moeilijk' ? 160 : niveau === 'makkelijk' ? 50 : 100
  const kans = winKans(s.handen[z], s.bord, tegen, { potjes, rng })
  const betalen = teBetalen(s, z)
  const potNu = pot(s)
  const potKans = betalen > 0 ? betalen / (potNu + betalen) : 0
  const gelijkDeel = 1 / (tegen + 1)          // wat je gemiddeld zou winnen
  const kracht = kans / gelijkDeel            // > 1 = beter dan gemiddeld
  const raiseNaar = factor => {
    const tot = Math.round((s.hoogste + Math.max(s.minRaise, (potNu + betalen) * factor)) / 5) * 5
    return Math.max(minRaiseTot(s, z), Math.min(maxRaiseTot(s, z), tot))
  }
  const r = rng()
  if (niveau === 'makkelijk') {
    if (r < 0.08 && magRaisen(s, z)) return { soort: 'raise', tot: raiseNaar(0.5) }
    if (betalen === 0) return kracht > 1.6 && r < 0.4 && magRaisen(s, z) ? { soort: 'raise', tot: raiseNaar(0.5) } : { soort: 'check' }
    if (kans > potKans * 0.7 || r < 0.25) return { soort: 'call' }
    return { soort: 'fold' }
  }
  const moeilijk = niveau === 'moeilijk'
  // hoe vaker er deze ronde al verhoogd is, hoe sterker je moet zijn om nog eens te verhogen (anders gaan de computers
  // elkaar eindeloos opjagen)
  const raises = s.raises || 0
  const sterk = (moeilijk ? 1.5 : 1.7) + raises * 0.5
  if (magRaisen(s, z) && kracht > sterk && kans > 0.3 + raises * 0.15 && r < (moeilijk ? 0.8 : 0.6)) {
    // heel sterk: soms all-in, anders flink verhogen
    if (kans > 0.8 && s.straat !== 'preflop' && r < 0.3) return { soort: 'allin' }
    return { soort: 'raise', tot: raiseNaar(kracht > 2.2 ? 0.9 : 0.55) }
  }
  if (betalen === 0) {
    if (moeilijk && magRaisen(s, z) && r < 0.12 && s.straat !== 'preflop') return { soort: 'raise', tot: raiseNaar(0.5) }   // bluf
    return { soort: 'check' }
  }
  const marge = moeilijk ? 0.02 : 0.06
  if (kans > potKans + marge) return { soort: 'call' }
  if (betalen <= s.blinds[1] && kans > potKans * 0.6) return { soort: 'call' }   // goedkoop meekijken
  return { soort: 'fold' }
}

// Tegen de computer (spel.html): de computer speelt binnen het spel zelf (groepspel.js, op de gastheer), voor alle
// zetels die geen mens zijn. solo.js wil wel een bot voor het nagemaakte kanaal: deze doet niets.
export function bot() { return { ontvang() {}, stop() {} } }
