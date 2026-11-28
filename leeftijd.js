// leeftijd.js (v1, 28 nov 2026, Marcel) - ben je 18 of ouder? Voor alles met casino-tokens.
//
// In gewone woorden: je geboortejaar staat in je account (ingevuld bij het aanmelden). Net als bij de minimumleeftijd
// van 16 telt alleen het jaar: dit jaar min je geboortejaar is 18 of meer = volwassen. Onder de 18 zie je de
// casino-widget niet en speel je de casinospellen zonder tokens. De server controleert het nog een keer
// (sql/casino-volwassen.sql), dus wie hier iets aan verandert, krijgt toch geen tokens.
//
//   geboortejaar({ storage })        het jaar uit je inlog op dit toestel, of null
//   isVolwassenJaar(jaar, nuJaar)    true / false
//   benIkVolwassen({ storage, nu })  true, false, of null als het niet bekend is (niet ingelogd)
//   casinoMagHier({ supabase, vriend, groep })  mogen de wachtspelletjes in deze chat met tokens? true / false
//       (jij 18+ en iedereen in de chat ook; vraagt het aan de server: casino_mag_hier)
export const VOLWASSEN = 18
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function geboortejaar({ storage } = {}) {
  if (storage === undefined) { try { storage = globalThis.localStorage } catch (e) { storage = null } }
  try {
    for (let i = 0; i < (storage?.length || 0); i++) {
      const k = storage.key(i)
      if (!k || !k.startsWith('sb-') || !k.endsWith('-auth-token')) continue
      const j = JSON.parse(storage.getItem(k))?.user?.user_metadata?.geboortejaar
      const n = Number(j)
      if (Number.isInteger(n) && n >= 1900 && n <= 2100) return n
    }
  } catch (e) {}
  return null
}

export const isVolwassenJaar = (jaar, nuJaar = new Date().getFullYear()) =>
  Number.isInteger(jaar) && Number.isInteger(nuJaar) && nuJaar - jaar >= VOLWASSEN

export function benIkVolwassen({ storage, nu = () => Date.now() } = {}) {
  const j = geboortejaar({ storage })
  return j === null ? null : isVolwassenJaar(j, new Date(nu()).getFullYear())
}

export async function casinoMagHier({ supabase, vriend = null, groep = null, storage } = {}) {
  if (benIkVolwassen({ storage }) !== true || !supabase) return false
  if ((vriend && !UUID.test(vriend)) || (groep && !UUID.test(groep))) return false
  try {
    const { data, error } = await supabase.rpc('casino_mag_hier', { p_vriend: vriend || null, p_groep: groep || null })
    return !error && data === true
  } catch (e) { return false }
}
