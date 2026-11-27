// videopoker.js - de regels van Video Poker (Jacks or Better), v1 27 nov 2026, uit Stekky Studio (spellen/videopoker.md).
// Geen scherm, alleen rekenen: gebruikt door videopoker-ui.js en door de tests. Dezelfde regels staan ook op de server
// (sql/videopoker.sql, videopoker_hand); test-videopoker.mjs controleert dat ze hetzelfde zijn.
//
// In gewone woorden:
//   - Je zet in en krijgt 5 open kaarten uit een vers geschud spel van 52.
//   - Je kiest welke kaarten je houdt; de rest wordt één keer vervangen (door de volgende kaarten van de stapel).
//   - Je eindhand bepaalt de uitbetaling (TABEL, × je inzet). Een paar boeren of hoger = je inzet terug.
//   - Met tokens doet de SERVER dit (deelt, ruilt en betaalt uit), zodat niemand een hand kan verzinnen
//     (maakVideoPokerServer). Zonder tokens speelt het toestel zelf (nieuweRonde, ruil).

export const KLEUREN = ['h', 'r', 'k', 's']
export const WAARDEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const INZETTEN = [10, 25, 50, 100]
// De uitbetalingstabel (Jacks or Better 9/6), van hoog naar laag
export const TABEL = [
  { hand: 'royal', naam: 'Royal flush', maal: 250 },
  { hand: 'straight_flush', naam: 'Straight flush', maal: 50 },
  { hand: 'four', naam: 'Four of a kind', maal: 25 },
  { hand: 'full_house', naam: 'Full house', maal: 9 },
  { hand: 'flush', naam: 'Flush', maal: 6 },
  { hand: 'straight', naam: 'Straight', maal: 4 },
  { hand: 'three', naam: 'Three of a kind', maal: 3 },
  { hand: 'two_pair', naam: 'Twee paar', maal: 2 },
  { hand: 'jacks', naam: 'Boeren of beter', maal: 1 },
]
export const NIETS = { hand: 'niets', naam: 'Geen winst', maal: 0 }

export const rang = id => WAARDEN.indexOf(id.slice(1)) + 2   // 2 .. 14 (aas)
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

// Wat is deze hand van 5 kaarten waard? Geeft een regel uit TABEL (of NIETS).
export function beoordeel(kaarten) {
  if (!Array.isArray(kaarten) || kaarten.length !== 5 || !kaarten.every(isKaart) || new Set(kaarten).size !== 5) return NIETS
  const r = kaarten.map(rang).sort((a, b) => a - b)
  const flush = kaarten.every(k => k[0] === kaarten[0][0])
  const uniek = new Set(r).size === 5
  const wiel = r.join() === '2,3,4,5,14'
  const straat = uniek && (r[4] - r[0] === 4 || wiel)
  const tel = {}
  for (const x of r) tel[x] = (tel[x] || 0) + 1
  const aantallen = Object.values(tel).sort((a, b) => b - a)
  const regel = h => TABEL.find(t => t.hand === h)
  if (flush && straat) return regel(r[0] === 10 ? 'royal' : 'straight_flush')
  if (aantallen[0] === 4) return regel('four')
  if (aantallen[0] === 3 && aantallen[1] === 2) return regel('full_house')
  if (flush) return regel('flush')
  if (straat) return regel('straight')
  if (aantallen[0] === 3) return regel('three')
  if (aantallen[0] === 2 && aantallen[1] === 2) return regel('two_pair')
  if (aantallen[0] === 2 && Object.entries(tel).some(([w, n]) => n === 2 && Number(w) >= 11)) return regel('jacks')
  return NIETS
}

// ── Zonder tokens: het toestel deelt ──
// Een ronde: { kaarten: [5], stapel: [de rest, de volgende kaart achteraan], klaar: false }
export function nieuweRonde(rng = Math.random) {
  const d = schud(maakDeck(), rng)
  return { kaarten: d.slice(0, 5), stapel: d.slice(5), klaar: false }
}
// houd: 5 keer ja/nee. De kaarten die je niet houdt, worden vervangen door de volgende kaarten van de stapel.
export function ruil(ronde, houd) {
  if (!ronde || ronde.klaar || !Array.isArray(houd) || houd.length !== 5) return null
  let i = 0
  const kaarten = ronde.kaarten.map((k, p) => houd[p] ? k : ronde.stapel[i++])
  const uitslag = beoordeel(kaarten)
  return { ...ronde, kaarten, klaar: true, uitslag }
}
// houd als getal (bit 0 = eerste kaart), zoals de server het wil
export const houdMasker = houd => houd.reduce((m, h, i) => m | (h ? 1 << i : 0), 0)

// Een tip: welke kaarten zou je houden? (een eenvoudige versie van de gebruikelijke strategie)
// Houdt een gemaakte hand, dan 4 naar een royal/straight flush/flush, een laag paar, 4 naar een straight,
// en anders de hoge kaarten (boer of hoger, hoogstens 2).
export function tip(kaarten) {
  const nu = beoordeel(kaarten)
  const houdAls = f => kaarten.map(f)
  if (['royal', 'straight_flush', 'four', 'full_house', 'flush', 'straight'].includes(nu.hand)) return houdAls(() => true)
  const tel = {}; for (const k of kaarten) tel[rang(k)] = (tel[rang(k)] || 0) + 1
  if (nu.hand === 'three' || nu.hand === 'two_pair') return houdAls(k => tel[rang(k)] >= 2)
  // 4 naar een flush (of meer)
  const perKleur = {}; for (const k of kaarten) perKleur[k[0]] = (perKleur[k[0]] || 0) + 1
  const kleur4 = Object.keys(perKleur).find(c => perKleur[c] >= 4)
  if (nu.hand === 'jacks') {
    // 4 naar een royal is beter dan een paar boeren
    if (kleur4) { const hoog = kaarten.filter(k => k[0] === kleur4 && rang(k) >= 10); if (hoog.length >= 4) return houdAls(k => hoog.includes(k)) }
    return houdAls(k => tel[rang(k)] === 2)
  }
  if (kleur4) return houdAls(k => k[0] === kleur4)
  if (Object.values(tel).includes(2)) return houdAls(k => tel[rang(k)] === 2)   // een laag paar
  // 4 opeenvolgend (open aan twee kanten of met een gat): 4 verschillende waarden binnen 5 op een rij
  const uniek = [...new Set(kaarten.map(rang))].sort((a, b) => a - b)
  const metAas = uniek.includes(14) ? [1, ...uniek] : uniek
  for (let lo = 1; lo <= 10; lo++) {
    const in5 = metAas.filter(x => x >= lo && x <= lo + 4)
    if (new Set(in5).size >= 4) {
      const set = new Set(in5.map(x => x === 1 ? 14 : x)); const gehouden = new Set()
      return houdAls(k => { const x = rang(k); if (set.has(x) && !gehouden.has(x)) { gehouden.add(x); return true } return false })
    }
  }
  // hoge kaarten: de twee laagste van boer of hoger (die maken het makkelijkst een paar)
  const hoog = kaarten.filter(k => rang(k) >= 11).sort((a, b) => rang(a) - rang(b)).slice(0, 2)
  return houdAls(k => hoog.includes(k))
}

// ── Met tokens: de server deelt (sql/videopoker.sql) ──
//   maakVideoPokerServer({ supabase })
//     .deel(inzet)            { rondeId, kaarten, inzet, saldo, verder }  (verder = een ronde van eerder die nog open stond)
//     .ruil(rondeId, houd)    { kaarten, uitslag, uitbetaling, saldo }
//   Fouten hebben .reden: 'te-weinig' (niet genoeg tokens), 'offline' (geen internet of de server doet het niet)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const getal = v => Number.isSafeInteger(Number(v)) ? Number(v) : null
export function maakVideoPokerServer({ supabase, uuid = () => globalThis.crypto.randomUUID() } = {}) {
  const fout = reden => Object.assign(new Error(reden), { reden })
  async function account() {
    try { const { data } = await supabase.auth.getSession(); const id = data?.session?.user?.id; return UUID.test(id || '') ? id : null } catch { return null }
  }
  async function rpc(naam, args) {
    let data, error
    try { ({ data, error } = await supabase.rpc(naam, args)) } catch (f) { error = f }
    if (error) throw fout(/Not enough tokens/.test(String(error.message || '')) ? 'te-weinig' : 'offline')
    return data
  }
  return {
    async deel(inzet) {
      const uid = await account()
      if (!uid || globalThis.navigator?.onLine === false) throw fout('offline')
      if (!INZETTEN.includes(inzet)) throw fout('ongeldig')
      const d = await rpc('videopoker_deel', { p_ronde_id: uuid(), p_inzet: inzet, p_expected_user: uid })
      const kaarten = Array.isArray(d?.kaarten) ? d.kaarten : []
      if (!UUID.test(d?.ronde_id || '') || kaarten.length !== 5 || !kaarten.every(isKaart) || getal(d.saldo) === null) throw fout('offline')
      return { rondeId: d.ronde_id, kaarten, inzet: getal(d.inzet) || inzet, saldo: getal(d.saldo), verder: d.al === true }
    },
    async ruil(rondeId, houd) {
      const uid = await account()
      if (!uid) throw fout('offline')
      const d = await rpc('videopoker_ruil', { p_ronde_id: rondeId, p_houd: houdMasker(houd), p_expected_user: uid })
      const kaarten = Array.isArray(d?.kaarten) ? d.kaarten : []
      if (kaarten.length !== 5 || !kaarten.every(isKaart) || getal(d.saldo) === null) throw fout('offline')
      // de server zegt welke hand het is; die moet kloppen met de kaarten
      const uitslag = TABEL.find(t => t.hand === d.hand) || NIETS
      return { kaarten, uitslag, uitbetaling: getal(d.uitbetaling) || 0, saldo: getal(d.saldo) }
    },
  }
}

// Video Poker speel je alleen: geen spelkanaal en geen computerspeler (solo.js: zonderKanaal).
export function bot() { return { ontvang() {}, stop() {} } }
