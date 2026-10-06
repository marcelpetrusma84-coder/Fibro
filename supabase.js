// supabase-js 2.113.0 staat in de eigen repo (supabase-lib.js), niet meer via jsdelivr
import { createClient } from './supabase-lib.js?v=1'

export const supabase = createClient(
  'https://qmgatbphiplrfxrljtbe.supabase.co',
  'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
)

// Inlogpas ook op de achtergrond vernieuwen (fibro-v29).
// De pas is een uur geldig. supabase-js vernieuwt hem alleen zolang de pagina in beeld
// is. Verloopt hij terwijl de pagina op de achtergrond staat, dan sluit Supabase alle
// realtime-kanalen (buzz, belverzoeken, spel- en chatberichten, vrienden online), en
// die gaan niet vanzelf weer open. Daarom vernieuwen we de pas zelf, 5 minuten voor
// het verlopen, als de pagina verborgen is. Dat kost een verzoek per uur.
let pasTimer = null
async function planPas() {
  clearTimeout(pasTimer)
  let verloopt = null
  try {
    const { data } = await supabase.auth.getSession()
    verloopt = data && data.session ? data.session.expires_at : null
  } catch (e) {}
  if (!verloopt) return
  const wacht = Math.max(60000, verloopt * 1000 - Date.now() - 5 * 60000)
  pasTimer = setTimeout(async () => {
    if (document.hidden) {
      try { await supabase.auth.refreshSession() } catch (e) {}
    }
    planPas()
  }, wacht)
}
supabase.auth.onAuthStateChange((soort) => {
  if (soort === 'SIGNED_OUT') { clearTimeout(pasTimer); return }
  // niet direct in deze callback: supabase-js wil hier geen andere aanroepen
  if (soort === 'INITIAL_SESSION' || soort === 'SIGNED_IN' || soort === 'TOKEN_REFRESHED') setTimeout(planPas, 0)
})
