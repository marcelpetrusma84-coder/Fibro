// lijntjes.js - de open lijntjes naar de server open houden (8 oktober 2026)
//
// Langs open lijntjes (Supabase Realtime) komen nieuwe berichten, buzzen, oproepen en
// speluitnodigingen meteen binnen. Twee dingen gingen mis:
//
// 1. Na een netwerkwissel (wifi -> 4G, telefoon uit de slaap, Deck op een ander netwerk)
//    leek de verbinding nog open, maar kwam er niets meer door. Supabase merkt dat pas na
//    30 tot 60 seconden. Daarom stuurt Fibro bij terugkomen in de app, bij 'weer internet'
//    en bij een ander netwerk meteen een hartslag. Komt daar binnen 5 seconden geen
//    antwoord op, dan wordt er meteen opnieuw verbonden.
//    Staat de pagina op de achtergrond (ander tabblad), dan verbindt Supabase zelf niet
//    opnieuw; daarom kijkt Fibro dan eens per minuut na of er weer verbonden moet worden.
// 2. Sluit de server een lijntje (bijvoorbeeld als de inlogpas verlopen is), dan kwam het
//    nooit meer terug. houOpen() opent het dan opnieuw (na 2 s, 10 s, 1 min, 5 min).
//
// Wat er binnenkwam terwijl een lijntje weg was, stuurt de server niet na. Daarom roept
// houOpen() opTerug() aan zodra het lijntje na een onderbreking weer open is: de pagina
// haalt het gemiste dan zelf op (een keer, alleen na een onderbreking).
//
// Gebruik:
//   const lijn = houOpen('berichten-' + mijnId,
//     () => supabase.channel('berichten-' + mijnId, { ... }).on(...),   // nog zonder subscribe
//     () => haalGemistOp())                                               // mag weggelaten worden
//   lijn.stop()   // sluiten (bijvoorbeeld bij het verlaten van een gesprek)
import { supabase } from './supabase.js?v=95'

const ANTWOORD_MS = 5000                             // zo lang wachten op antwoord op de hartslag
const ACHTERGROND_MS = 60000                         // op de achtergrond: zo vaak nakijken
const GESLOTEN_WACHT = [2000, 10000, 60000, 300000]  // door de server gesloten: opnieuw openen na

function wacht(ms) { return new Promise((r) => setTimeout(r, ms)) }
function kort(naam) { return String(naam).replace(/-[0-9a-f-]{36}$/i, '') }

// ── Een lijntje open houden ──
export function houOpen(naam, maak, opTerug) {
  const lijn = { k: null, gestopt: false, timer: null, gesloten: 0, openSinds: 0, ooitOpen: false, weg: false }

  async function open() {
    if (lijn.gestopt) return
    // Een kanaal met dezelfde naam dat nog aan het sluiten is eerst helemaal laten sluiten,
    // anders geeft supabase.channel() dat sluitende kanaal terug (zelfde les als paren.js).
    for (const k of supabase.getChannels()) {
      if (k.topic === 'realtime:' + naam) await Promise.race([supabase.removeChannel(k), wacht(3000)])
    }
    if (lijn.gestopt || lijn.k) return
    const k = maak()
    lijn.k = k
    k.subscribe((status) => {
      if (lijn.k !== k) return
      if (status === 'SUBSCRIBED') {
        const terug = lijn.weg
        lijn.weg = false
        lijn.ooitOpen = true
        lijn.openSinds = Date.now()
        if (terug) {
          console.log('[lijntjes] ' + kort(naam) + ' weer open')
          if (opTerug) {
            try { Promise.resolve(opTerug()).catch((e) => console.warn('[lijntjes] ophalen mislukt:', e)) } catch (e) { console.warn('[lijntjes] ophalen mislukt:', e) }
          }
        }
        return
      }
      if (lijn.ooitOpen) lijn.weg = true
      if (status === 'CLOSED') gesloten(k)
      // CHANNEL_ERROR of TIMED_OUT: Supabase probeert het zelf opnieuw
    })
  }

  function gesloten(k) {
    if (lijn.k !== k) return
    lijn.k = null
    if (lijn.gestopt) return
    lijn.weg = true
    if (Date.now() - lijn.openSinds > 120000) lijn.gesloten = 0
    const ms = GESLOTEN_WACHT[Math.min(lijn.gesloten++, GESLOTEN_WACHT.length - 1)]
    console.log('[lijntjes] ' + kort(naam) + ' door de server gesloten - opnieuw over ' + Math.round(ms / 1000) + ' s')
    clearTimeout(lijn.timer)
    lijn.timer = setTimeout(async () => {
      if (lijn.gestopt || lijn.k) return
      try { await supabase.auth.getSession() } catch (e) {} // inlogpas zo nodig eerst vernieuwen
      open().catch((e) => console.warn('[lijntjes] openen mislukt:', e))
    }, ms)
  }

  open().catch((e) => console.warn('[lijntjes] openen mislukt:', e))
  waakhond()
  return {
    stop() {
      lijn.gestopt = true
      clearTimeout(lijn.timer)
      const k = lijn.k
      lijn.k = null
      return k ? supabase.removeChannel(k).catch(() => {}) : Promise.resolve()
    },
    kanaal() { return lijn.k }
  }
}

// ── De waakhond: is de verbinding echt nog in leven? ──
let waakhondAan = false
let laatsteAntwoord = 0, verstuurdOp = 0, bezig = false, laatsteKeer = 0

function waakhond() {
  if (waakhondAan) return
  waakhondAan = true
  const rt = supabase.realtime
  try {
    rt.onHeartbeat((status) => {
      if (status === 'sent') { verstuurdOp = Date.now(); return }
      verstuurdOp = 0
      if (status === 'ok') laatsteAntwoord = Date.now()
    })
  } catch (e) { console.warn('[lijntjes] hartslag volgen lukt niet:', e) }

  async function controleer(reden) {
    if (bezig || navigator.onLine === false) return
    if (!rt.getChannels().length) return
    if (Date.now() - laatsteKeer < 3000) return
    laatsteKeer = Date.now()
    bezig = true
    try {
      if (!rt.isConnected()) {
        if (!rt.isConnecting()) { console.log('[lijntjes] opnieuw verbinden (' + reden + ')'); rt.connect() }
        return
      }
      const start = Date.now()
      // Wacht er al een hartslag langer dan 5 s op antwoord, dan ziet Supabase dat bij het
      // versturen en verbindt het meteen opnieuw. Anders gaat er nu een nieuwe hartslag.
      if (!(verstuurdOp && start - verstuurdOp < ANTWOORD_MS)) rt.sendHeartbeat()
      await wacht(ANTWOORD_MS)
      if (laatsteAntwoord >= start || !rt.isConnected()) return
      console.log('[lijntjes] geen antwoord van de server (' + reden + '): opnieuw verbinden')
      rt.sendHeartbeat() // de hartslag wacht nog op antwoord: Supabase sluit en verbindt opnieuw
    } catch (e) {
      console.warn('[lijntjes] nakijken mislukt:', e)
    } finally { bezig = false }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') controleer('terug in de app')
  })
  window.addEventListener('online', () => controleer('weer internet'))
  window.addEventListener('pageshow', (e) => { if (e.persisted) controleer('pagina terug') })
  try { if (navigator.connection) navigator.connection.addEventListener('change', () => controleer('ander netwerk')) } catch (e) {}
  setInterval(() => {
    if (document.visibilityState !== 'hidden' || navigator.onLine === false) return
    if (!rt.getChannels().length || rt.isConnected() || rt.isConnecting()) return
    console.log('[lijntjes] op de achtergrond opnieuw verbinden')
    rt.connect()
  }, ACHTERGROND_MS)
}
