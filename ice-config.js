// ice-config.js — Gedeelde WebRTC ICE-servers
// Basis: STUN. TURN wordt toegevoegd via edge function 'get-turn-credentials'.
// Geen keys in dit bestand — die staan veilig als secrets in Supabase.
import { supabase } from './supabase.js?v=95'

const FUNCTIE_URL = 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/get-turn-credentials'
const ANON_KEY = 'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
// TURN-gegevens 10 minuten bewaren in dit tabblad, zodat niet elke pagina de edge function aanroept
const TURN_CACHE = 'fibro_turn_cache'
const TURN_CACHE_MS = 10 * 60 * 1000

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ]
}

async function laadTurnServers() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { console.log('[ice] Niet ingelogd — alleen STUN'); return }
    try {
      const c = JSON.parse(sessionStorage.getItem(TURN_CACHE) || 'null')
      if (c && c.uid === session.user.id && Date.now() - c.tijd < TURN_CACHE_MS && Array.isArray(c.turn) && c.turn.length) {
        ICE_SERVERS.iceServers.push(...c.turn)
        console.log('[ice] TURN uit tabblad-geheugen:', c.turn.length, 'server(s)')
        return
      }
    } catch (e) {}
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
      // Max 2 TURN-servers: meer vertraagt de verbinding (WebRTC-richtlijn).
      // De eerste, plus altijd een TLS-adres (turns: of poort 443): dat komt het best door strenge netwerken.
      const heeft = (s, f) => [].concat(s.urls).some(u => typeof u === 'string' && f(u))
      const kies = turn.slice(0, 1)
      const tls = turn.find(s => heeft(s, u => u.startsWith('turns:'))) || turn.find(s => heeft(s, u => /:443(\?|$)/.test(u)))
      if (tls && !kies.includes(tls)) kies.push(tls)
      else if (turn[1]) kies.push(turn[1])
      ICE_SERVERS.iceServers.push(...kies)
      console.log('[ice] TURN geladen:', kies.length, 'van', turn.length, 'server(s):', kies.map(s => [].concat(s.urls).join(' ')).join(', '))
      try { sessionStorage.setItem(TURN_CACHE, JSON.stringify({ uid: session.user.id, tijd: Date.now(), turn: kies })) } catch (e) {}
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
