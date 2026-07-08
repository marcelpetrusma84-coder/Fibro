// ice-config.js — Gedeelde WebRTC ICE-servers (STUN + TURN)
// TURN-credentials LATER vervangen via ENV of geheime backend-RPC

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:80', username: '3d8f6969f613be308e4de56c', credential: '9pioPuLlUDLd7sPT' },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '3d8f6969f613be308e4de56c', credential: '9pioPuLlUDLd7sPT' },
    { urls: 'turn:global.relay.metered.ca:443', username: '3d8f6969f613be308e4de56c', credential: '9pioPuLlUDLd7sPT' },
    { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '3d8f6969f613be308e4de56c', credential: '9pioPuLlUDLd7sPT' },
  ]
}
