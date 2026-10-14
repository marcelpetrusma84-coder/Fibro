// ice-config.js — Gedeelde WebRTC ICE-servers
// Basis: STUN. TURN wordt toegevoegd via edge function 'get-turn-credentials'.
// Geen keys in dit bestand — die staan veilig als secrets in Supabase.
// v149: STUN (de spiegel) en TURN (de postbode) zijn allebei onze eigen server bij TransIP (NL),
// niet meer Google/Cloudflare. Het pasje voor de postbode is 24 uur geldig; de app bewaart het
// 12 uur op dit toestel (localStorage, voor alle tabbladen samen), zodat niet elke pagina de
// edge function aanroept. Uitloggen wist het (account.js wist alle fibro_-sleutels).
import { supabase } from './supabase.js?v=95'

const FUNCTIE_URL = 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/get-turn-credentials'
const ANON_KEY = 'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
const EIGEN_SERVER = '136.144.154.200'
// TURN-pasje 12 uur bewaren op dit toestel; met minder dan een uur geldigheid over: een nieuw
const TURN_CACHE = 'fibro_turn_pasje'
const TURN_CACHE_MS = 12 * 60 * 60 * 1000
const MIN_OVER_MS = 60 * 60 * 1000

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:' + EIGEN_SERVER + ':3478' },
  ]
}

function bewaardPasje(uid) {
  try {
    const c = JSON.parse(localStorage.getItem(TURN_CACHE) || 'null')
    const nu = Date.now()
    if (!c || c.uid !== uid || typeof c.tijd !== 'number' || !Array.isArray(c.turn) || !c.turn.length) return null
    if (nu < c.tijd || nu - c.tijd >= TURN_CACHE_MS) return null // te oud (of de klok ging terug)
    if (typeof c.verloopt === 'number' && c.verloopt * 1000 - nu < MIN_OVER_MS) return null
    return c
  } catch (e) { return null }
}

async function laadTurnServers() {
  try {
    try { sessionStorage.removeItem('fibro_turn_cache') } catch (e) {} // v106-v148: per tabblad, 10 min
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { console.log('[ice] Niet ingelogd — alleen STUN'); return }
    const c = bewaardPasje(session.user.id)
    if (c) {
      ICE_SERVERS.iceServers.push(...c.turn)
      console.log('[ice] TURN uit toestel-geheugen:', c.turn.length, 'server(s), nog', Math.round((TURN_CACHE_MS - (Date.now() - c.tijd)) / 60000), 'min')
      return
    }
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
      if (kies.length) {
        const verloopt = typeof data.verloopt === 'number' ? data.verloopt : null
        try { localStorage.setItem(TURN_CACHE, JSON.stringify({ uid: session.user.id, tijd: Date.now(), verloopt, turn: kies })) } catch (e) {}
      }
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
