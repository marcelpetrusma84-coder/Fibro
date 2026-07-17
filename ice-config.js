// ice-config.js — Gedeelde WebRTC ICE-servers
// Basis: STUN. TURN wordt toegevoegd via edge function 'get-turn-credentials'.
// Geen keys in dit bestand — die staan veilig als secrets in Supabase.
import { supabase } from './supabase.js'

const FUNCTIE_URL = 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/get-turn-credentials'
const ANON_KEY = 'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

async function laadTurnServers() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { console.log('[ice] Niet ingelogd — alleen STUN'); return }
    // Directe fetch i.p.v. invoke, zodat we status + foutmelding kunnen zien
    const resp = await fetch(FUNCTIE_URL, {
      headers: {
        'Authorization': 'Bearer ' + session.access_token,
        'apikey': ANON_KEY
      }
    })
    const tekst = await resp.text()
    if (!resp.ok) {
      console.warn('[ice] TURN fout — status', resp.status, '— antwoord:', tekst)
      return
    }
    const data = JSON.parse(tekst)
    if (data && Array.isArray(data.iceServers)) {
      const turn = data.iceServers.filter(s =>
        typeof s.urls === 'string' ? s.urls.startsWith('turn') :
        Array.isArray(s.urls) ? s.urls.some(u => u.startsWith('turn')) : false
      )
      ICE_SERVERS.iceServers.push(...turn)
      console.log('[ice] TURN geladen:', turn.length, 'server(s)')
    } else {
      console.warn('[ice] Onverwacht antwoord:', tekst.slice(0, 200))
    }
  } catch (e) {
    console.warn('[ice] TURN laden fout:', e)
  }
}

// Promise waar bellen.js/sync.js op wachten vóór het verbinden (max 5 sec)
export const iceReady = Promise.race([
  laadTurnServers(),
  new Promise(r => setTimeout(r, 5000))
])
