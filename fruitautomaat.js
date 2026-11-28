// fruitautomaat.js (v2, 28 nov 2026, Marcel) - de regels van de Fruitautomaat (spellen/fruitautomaat.md). Het scherm staat
// in fruitautomaat-ui.js.
//
// In gewone woorden: drie rollen. Elke rol stopt op een plaatje; sommige plaatjes komen vaker dan andere (GEWICHT, van
// de 32). Drie dezelfde wint (TABEL), twee kersen = 4×, een kers op de eerste rol = je inzet terug.
// Op de lange duur krijg je ongeveer 97 van de 100 tokens terug (terugKans), en ongeveer 1 op 4 keer win je iets.
// De server (sql/casino-volwassen.sql, fruitautomaat_draai) gebruikt precies dezelfde gewichten en tabel: met tokens
// draait de server, zonder tokens draait het toestel (draai).
//
//   SYMBOLEN, GEWICHT, TABEL      de plaatjes, hoe vaak ze komen en wat drie dezelfde opleveren
//   symboolVan(n)                 een getal 0..31 wordt een plaatje (zoals op de server)
//   draai(rng)                    ['kers', 'bel', 'kers']
//   maal(rollen)                  hoeveel keer je inzet je terugkrijgt (0, 1, 4, 10 ... 200)
//   terugKans()                   { terug: 0.967, winkans: 0.24 }  (uitgerekend, voor de spelregels en de test)
//   maakFruitServer({ supabase }).draai(inzet)   { rollen, inzet, uitbetaling, saldo } (de server draait)
export const INZETTEN = [5, 10, 25, 50, 100]   // 28 nov 2026: ook 5 (zelfde als casino.js)
export const SYMBOLEN = ['kers', 'citroen', 'sinaas', 'druif', 'bel', 'ster', 'zeven']
export const GEWICHT = { kers: 6, citroen: 7, sinaas: 6, druif: 5, bel: 4, ster: 3, zeven: 1 }   // samen 32
export const TABEL = { zeven: 200, ster: 60, bel: 40, druif: 20, sinaas: 15, citroen: 12, kers: 10 }
export const TWEE_KERSEN = 4
export const EERSTE_KERS = 1
export const PLAATJE = { kers: '🍒', citroen: '🍋', sinaas: '🍊', druif: '🍇', bel: '🔔', ster: '⭐', zeven: '7' }
export const NAAM = { kers: 'Kers', citroen: 'Citroen', sinaas: 'Sinaasappel', druif: 'Druif', bel: 'Bel', ster: 'Ster', zeven: 'Zeven' }

export function symboolVan(n) {
  let grens = 0
  for (const s of SYMBOLEN) { grens += GEWICHT[s]; if (n < grens) return s }
  return SYMBOLEN[SYMBOLEN.length - 1]
}
export function draai(rng = Math.random) {
  return [0, 1, 2].map(() => symboolVan(Math.floor(rng() * 32) % 32))
}
export const isRollen = r => Array.isArray(r) && r.length === 3 && r.every(s => SYMBOLEN.includes(s))

export function maal(r) {
  if (!isRollen(r)) return 0
  if (r[0] === r[1] && r[1] === r[2]) return TABEL[r[0]]
  const kersen = r.filter(s => s === 'kers').length
  if (kersen === 2) return TWEE_KERSEN
  if (kersen === 1 && r[0] === 'kers') return EERSTE_KERS
  return 0
}

export function terugKans() {
  let terug = 0, winkans = 0
  for (const a of SYMBOLEN) for (const b of SYMBOLEN) for (const c of SYMBOLEN) {
    const p = GEWICHT[a] * GEWICHT[b] * GEWICHT[c] / 32 ** 3, m = maal([a, b, c])
    terug += p * m; if (m > 0) winkans += p
  }
  return { terug, winkans }
}

// ── Met tokens: de server draait (sql/casino-volwassen.sql) ──
// Fouten hebben .reden: 'te-weinig' (niet genoeg tokens), 'offline' (geen internet of de server doet het niet)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const getal = v => Number.isSafeInteger(Number(v)) ? Number(v) : null
export function maakFruitServer({ supabase, uuid = () => globalThis.crypto.randomUUID() } = {}) {
  const fout = reden => Object.assign(new Error(reden), { reden })
  async function account() {
    try { const { data } = await supabase.auth.getSession(); const id = data?.session?.user?.id; return UUID.test(id || '') ? id : null } catch { return null }
  }
  return {
    async draai(inzet) {
      const uid = await account()
      if (!uid || globalThis.navigator?.onLine === false) throw fout('offline')
      if (!INZETTEN.includes(inzet)) throw fout('ongeldig')
      let data, error
      try { ({ data, error } = await supabase.rpc('fruitautomaat_draai', { p_ronde_id: uuid(), p_inzet: inzet, p_expected_user: uid })) } catch (f) { error = f }
      if (error) throw fout(/Not enough tokens/.test(String(error.message || '')) ? 'te-weinig' : 'offline')
      const rollen = data?.rollen
      if (!isRollen(rollen) || getal(data.saldo) === null) throw fout('offline')
      // wat de server uitbetaalt, moet kloppen met de rollen (dezelfde tabel)
      return { rollen, inzet: getal(data.inzet) || inzet, uitbetaling: getal(data.uitbetaling) || 0, saldo: getal(data.saldo) }
    },
  }
}

// De Fruitautomaat speel je alleen: geen spelkanaal en geen computerspeler (studio-spellen.js: zonderKanaal).
export function bot() { return { ontvang() {}, stop() {} } }
