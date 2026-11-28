// hogerlager.js (v3, 28 nov 2026, Marcel) - de regels van Hoger of lager (spellen/hogerlager.md). Het scherm staat in
// hogerlager-ui.js. Gemaakt uit het sjabloon sjabloon-automaat.js.
//
// In gewone woorden: je ziet een kaart en raadt of de volgende hoger of lager is (aas is het hoogst, 2 het laagst).
// Goed = gewonnen; fout of dezelfde waarde = verloren (zoals in het casino).
// v3 (28 nov 2026, Marcel): de uitbetaling hangt af van de kans. Eerst kreeg je altijd 2×, maar wie bij een 3 "hoger"
// zei, won bijna altijd: dan kreeg je met slim spelen 150 van de 100 terug. Nu: hoe kleiner de kans, hoe meer je wint,
// en elke keuze geeft op de lange duur ongeveer 97 van de 100 terug (net als de Fruitautomaat).
//   maal100 = floor(4947 / winnende kaarten)   (4947 = 0,97 × 51 × 100; 51 = de kaarten die nog over zijn)
//   bij een 8: 24 hogere kaarten -> 2,06×;  bij een 3 "hoger": 44 -> 1,12×;  bij een 3 "lager": 4 -> 12,36×
//   bij een 2 kan "lager" niet, bij een aas kan "hoger" niet.
// Met tokens deelt de SERVER (sql/casino-volwassen.sql: hogerlager_deel en hogerlager_raad), want het kan meer dan 2×
// uitbetalen. Zonder tokens speelt het toestel zelf, met dezelfde regels.
//
//   nieuweRonde(rng)                 { kaart, volgende, klaar: false } (de volgende kaart ligt al klaar, maar is nog dicht)
//   winKaarten(kaart, keuze)         hoeveel van de 51 andere kaarten winnen
//   maal100(kaart, keuze)            de uitbetaling in honderdsten (206 = 2,06×), 0 = kan niet
//   uitbetaling(inzet, kaart, keuze) wat je terugkrijgt als je wint (afgerond naar beneden)
//   raad(ronde, 'hoger'|'lager')     { ...ronde, klaar: true, keuze, uitslag: 'winst' | 'verlies', gelijk }
//   terugKans()                      gemiddeld terug per 100 (voor de test en de spelregels)
//   maakHogerLagerServer({ supabase }).deel() / .raad(rondeId, keuze, inzet)
import { maakDeck, schud, rang, isKaart } from './kaarten-motor.js?v=1'

export const KEUZES = ['hoger', 'lager']
export const TERUG = 97   // van de 100

export function nieuweRonde(rng = Math.random) {
  const d = schud(maakDeck('52'), rng)
  return { kaart: d[0], volgende: d[1], klaar: false }
}
export function winKaarten(kaart, keuze) {
  if (!isKaart(kaart) || !KEUZES.includes(keuze)) return 0
  const r = rang(kaart)
  return keuze === 'hoger' ? 4 * (14 - r) : 4 * (r - 2)
}
export function maal100(kaart, keuze) {
  const w = winKaarten(kaart, keuze)
  return w > 0 ? Math.floor(TERUG * 51 / w) : 0
}
export const uitbetaling = (inzet, kaart, keuze) => Math.floor(inzet * maal100(kaart, keuze) / 100)
export const maalTekst = (m100, locale = 'nl-NL') => (m100 / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '×'

export function raad(ronde, keuze) {
  if (!ronde || ronde.klaar || !KEUZES.includes(keuze) || !maal100(ronde.kaart, keuze)) return null
  const a = rang(ronde.kaart), b = rang(ronde.volgende)
  const uitslag = a !== b && (b > a) === (keuze === 'hoger') ? 'winst' : 'verlies'
  return { ...ronde, klaar: true, keuze, uitslag, gelijk: a === b }
}

export function terugKans() {
  // over alle 13 waarden, met de beste keuze én met de slechtste keuze die nog kan
  let beste = 0, slechtste = 0
  for (let r = 2; r <= 14; r++) {
    const k = 'h' + ({ 11: 'B', 12: 'V', 13: 'H', 14: 'A' }[r] || r)
    const t = KEUZES.filter(x => maal100(k, x)).map(x => winKaarten(k, x) / 51 * maal100(k, x) / 100)
    beste += Math.max(...t) / 13; slechtste += Math.min(...t) / 13
  }
  return { beste, slechtste }
}

// ── Met tokens: de server deelt (sql/casino-volwassen.sql) ──
// deel()                         { rondeId, kaart }       (nog geen inzet)
// raad(rondeId, keuze, inzet)    { kaart, volgende, uitslag, gelijk, uitbetaling, saldo }
// Fouten hebben .reden: 'te-weinig' (niet genoeg tokens), 'offline' (geen internet of de server doet het niet)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const getal = v => Number.isSafeInteger(Number(v)) ? Number(v) : null
export function maakHogerLagerServer({ supabase, uuid = () => globalThis.crypto.randomUUID(), inzetten = [5, 10, 25, 50, 100] } = {}) {
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
    async deel() {
      const uid = await account()
      if (!uid || globalThis.navigator?.onLine === false) throw fout('offline')
      const d = await rpc('hogerlager_deel', { p_ronde_id: uuid(), p_expected_user: uid })
      if (!UUID.test(d?.ronde_id || '') || !isKaart(d.kaart)) throw fout('offline')
      return { rondeId: d.ronde_id, kaart: d.kaart }
    },
    async raad(rondeId, keuze, inzet) {
      const uid = await account()
      if (!uid) throw fout('offline')
      if (!KEUZES.includes(keuze) || !inzetten.includes(inzet)) throw fout('ongeldig')
      const d = await rpc('hogerlager_raad', { p_ronde_id: rondeId, p_keuze: keuze, p_inzet: inzet, p_expected_user: uid })
      if (!isKaart(d?.kaart) || !isKaart(d?.volgende) || !['winst', 'verlies'].includes(d.uitslag) || getal(d.saldo) === null) throw fout('offline')
      return { kaart: d.kaart, volgende: d.volgende, uitslag: d.uitslag, gelijk: rang(d.kaart) === rang(d.volgende),
        uitbetaling: getal(d.uitbetaling) || 0, inzet: getal(d.inzet) || inzet, saldo: getal(d.saldo) }
    },
  }
}

// Een automaat speel je alleen: geen spelkanaal en geen computerspeler (studio-spellen.js: zonderKanaal).
export function bot() { return { ontvang() {}, stop() {} } }
