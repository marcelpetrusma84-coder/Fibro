// ice-config.js — Gedeelde WebRTC ICE-servers
//
// Basis: STUN (gratis, voor iedereen).
// Na het laden wordt TURN automatisch toegevoegd via de Supabase edge
// function 'get-turn-credentials' (alleen voor ingelogde gebruikers).
// De API-key staat veilig als secret in Supabase — NOOIT hier in de code!
import { supabase } from './supabase.js'

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

// TURN-servers ophalen en aan hetzelfde object toevoegen.
// bellen.js/sync.js lezen ICE_SERVERS pas bij het opzetten van een
// verbinding, dus zodra dit klaar is profiteert alles er automatisch van.
async function laadTurnServers() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return // niet ingelogd → alleen STUN
    const { data, error } = await supabase.functions.invoke('get-turn-credentials')
    if (error) { console.warn('[ice] TURN ophalen mislukt:', error); return }
    if (data && Array.isArray(data.iceServers)) {
      // Alleen echte TURN-entries toevoegen (STUN hebben we al)
      const turn = data.iceServers.filter(s =>
        typeof s.urls === 'string' ? s.urls.startsWith('turn') :
        Array.isArray(s.urls) ? s.urls.some(u => u.startsWith('turn')) : false
      )
      ICE_SERVERS.iceServers.push(...turn)
      console.log('[ice] TURN geladen:', turn.length, 'server(s)')
    }
  } catch (e) {
    console.warn('[ice] TURN laden fout:', e)
  }
}

// Promise waar bellen.js/sync.js op kunnen wachten vóór het opzetten
// van een verbinding. Max 5 sec — daarna door met wat er is (STUN).
export const iceReady = Promise.race([
  laadTurnServers(),
  new Promise(r => setTimeout(r, 5000))
])
