import { supabase } from './supabase.js?v=95'

let heartbeatInterval = null
let heartbeatUserId = null

// Eigen keuze in het profiel: toon_online = false is "helemaal offline".
// Dan zet de heartbeat online_status nooit op true, en ziet deze gebruiker
// zelf ook niemand online (vlag fibro_ik_offline in localStorage).
function ikOffline() {
  try { return localStorage.getItem('fibro_ik_offline') === '1' } catch (e) { return false }
}

function bewaarKeuze(toon) {
  try { localStorage.setItem('fibro_ik_offline', toon ? '0' : '1') } catch (e) {}
}

export async function startHeartbeat() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  heartbeatUserId = session.user.id

  // Direct eerste ping
  await ping()

  // Stop eventueel lopende interval
  if (heartbeatInterval) clearInterval(heartbeatInterval)

  // Elke 60 seconden pingen
  heartbeatInterval = setInterval(ping, 60000)

  // App verbergen (bijv. telefoon vergrendeld of andere app)
  document.addEventListener('visibilitychange', handleVisibility)

  // Pagina verlaten of tab sluiten
  window.addEventListener('pagehide', zetOffline)
}

// Helemaal offline: na de eerste ping (die toon_online ophaalt en de status op
// offline zet) geen verzoeken meer naar de server. De database laat
// laatst_gezien dan toch staan. Zet je jezelf in het profiel weer online, dan
// pingt de volgende ronde gewoon weer.
let eerstePingGedaan = false
async function ping() {
  if (!heartbeatUserId) return
  if (eerstePingGedaan && ikOffline()) return
  eerstePingGedaan = true
  const nu = new Date().toISOString()
  const verwacht = !ikOffline()
  const { data, error } = await supabase.from('profiles')
    .update({ online_status: verwacht, laatst_gezien: nu })
    .eq('id', heartbeatUserId)
    .select('toon_online')
    .single()
  if (error || !data) {
    // Bijv. kolom toon_online bestaat (nog) niet: alleen status bijwerken
    await supabase.from('profiles').update({
      online_status: verwacht,
      laatst_gezien: nu
    }).eq('id', heartbeatUserId)
    return
  }
  const toon = data.toon_online !== false
  bewaarKeuze(toon)
  if (toon !== verwacht) {
    // Keuze is elders gewijzigd: meteen rechtzetten
    await supabase.from('profiles').update({ online_status: toon }).eq('id', heartbeatUserId)
  }
}

async function zetOffline() {
  if (!heartbeatUserId) return
  clearInterval(heartbeatInterval)
  heartbeatInterval = null
  if (eerstePingGedaan && ikOffline()) return // staat al op offline
  await supabase.from('profiles').update({
    online_status: false,
    laatst_gezien: new Date().toISOString()
  }).eq('id', heartbeatUserId)
}

function handleVisibility() {
  if (document.hidden) {
    // App op achtergrond: stop interval, zet offline
    zetOffline()
  } else {
    // App weer zichtbaar: herstart heartbeat
    ping()
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    heartbeatInterval = setInterval(ping, 60000)
  }
}
