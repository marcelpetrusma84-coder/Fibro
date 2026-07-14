// ice-config.js — Gedeelde WebRTC ICE-servers (alleen STUN)
//
// TURN is hier bewust VERWIJDERD:
// - Gratis gebruikers krijgen alleen STUN (P2P werkt in de meeste gevallen)
// - Fibro+ gebruikers krijgen straks tijdelijke TURN-credentials via een
//   Supabase edge function (get-turn-credentials) — zie fibro-plus-relay.js
// - Zet NOOIT vaste TURN-credentials in dit bestand: het staat openbaar op GitHub

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}
