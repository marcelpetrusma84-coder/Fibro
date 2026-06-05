import { supabase } from './supabase.js'

let heartbeatInterval = null
let heartbeatUserId = null

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

  // Browser/tab sluiten
  window.addEventListener('beforeunload', handleUnload)
}

async function ping() {
  if (!heartbeatUserId) return
  await supabase.from('profiles').update({
    online_status: true,
    laatst_gezien: new Date().toISOString()
  }).eq('id', heartbeatUserId)
}

async function zetOffline() {
  if (!heartbeatUserId) return
  clearInterval(heartbeatInterval)
  heartbeatInterval = null
  await supabase.from('profiles').update({
    online_status: false,
    laatst_gezien: new Date().toISOString()
  }).eq('id', heartbeatUserId)
}

function handleVisibility() {
  if (document.hidden) {
    // App op achtergrond → stop interval, zet offline
    zetOffline()
  } else {
    // App weer zichtbaar → herstart heartbeat
    ping()
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    heartbeatInterval = setInterval(ping, 60000)
  }
}

function handleUnload() {
  // navigator.sendBeacon voor betrouwbaar offline zetten bij sluiten
  const url = 'https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/profiles?id=eq.' + heartbeatUserId
  const body = JSON.stringify({ online_status: false, laatst_gezien: new Date().toISOString() })
  navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
  zetOffline()
}
