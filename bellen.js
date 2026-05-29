// bellen.js — WebRTC P2P audio/video bellen via Supabase Realtime signaling

import { supabase } from './supabase.js'

// ─── State ───
let lokaleStream = null
let remoteStream = null
let peerConnection = null
let belKanaal = null
let huidigeUserId = null
let vriendId = null
let isInitiator = false
let onOproepCallback = null
let onEindCallback = null

// ─── ICE servers (Google STUN — gratis) ───
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}

// ─── Initialiseer bellen module ───
export function initBellen(userId, callbacks = {}) {
  huidigeUserId = userId
  onOproepCallback = callbacks.onOproep || null
  onEindCallback = callbacks.onEind || null
  luisterNaarOproepen()
}

// ─── Luister naar inkomende oproepen via Supabase Realtime ───
function luisterNaarOproepen() {
  if (belKanaal) supabase.removeChannel(belKanaal)

  belKanaal = supabase
    .channel('bellen-' + huidigeUserId)
    .on('broadcast', { event: 'oproep' }, (payload) => {
      const { van, type, data } = payload.payload
      verwerkSignaal(van, type, data)
    })
    .subscribe()
}

// ─── Verwerk inkomend signaal ───
async function verwerkSignaal(van, type, data) {
  if (type === 'uitnodiging') {
    // Inkomende oproep
    vriendId = van
    isInitiator = false
    if (onOproepCallback) {
      onOproepCallback({ van, videoModus: data.video })
    }
  }

  if (type === 'geaccepteerd') {
    // Vriend heeft aangenomen — stuur offer
    await maakEnStuurOffer()
  }

  if (type === 'offer') {
    await verwerkOffer(data)
  }

  if (type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
  }

  if (type === 'ice') {
    if (peerConnection && data) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data))
      } catch(e) {}
    }
  }

  if (type === 'ophangen') {
    beeindigGesprek(false)
  }
}

// ─── Stuur signaal naar vriend ───
async function stuurSignaal(naar, type, data = {}) {
  await supabase.channel('bellen-' + naar).send({
    type: 'broadcast',
    event: 'oproep',
    payload: { van: huidigeUserId, type, data }
  })
}

// ─── Bel iemand op ───
export async function belOp(naarVriendId, video = false) {
  vriendId = naarVriendId
  isInitiator = true

  // Haal lokale stream op
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video
    })
  } catch(e) {
    alert('Geen toegang tot microfoon/camera. Controleer je browserinstellingen.')
    return false
  }

  // Stuur uitnodiging
  await stuurSignaal(vriendId, 'uitnodiging', { video })
  return true
}

// ─── Oproep accepteren ───
export async function accepteerOproep(video = false) {
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video
    })
  } catch(e) {
    alert('Geen toegang tot microfoon/camera.')
    return false
  }

  maakPeerConnection()

  // Laat initiator weten dat we hebben aangenomen
  await stuurSignaal(vriendId, 'geaccepteerd', {})
  return true
}

// ─── Oproep weigeren ───
export async function weigerooproep() {
  await stuurSignaal(vriendId, 'ophangen', {})
  vriendId = null
}

// ─── Maak RTCPeerConnection aan ───
function maakPeerConnection() {
  peerConnection = new RTCPeerConnection(ICE_SERVERS)

  // Voeg lokale stream toe
  lokaleStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, lokaleStream)
  })

  // Ontvang remote stream
  remoteStream = new MediaStream()
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track)
    })
    // Update remote video/audio element
    const remoteEl = document.getElementById('remoteMedia')
    if (remoteEl) remoteEl.srcObject = remoteStream
  }

  // Stuur ICE candidates door
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await stuurSignaal(vriendId, 'ice', event.candidate.toJSON())
    }
  }

  // Update lokale video
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = lokaleStream

  peerConnection.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
      beeindigGesprek(false)
    }
  }
}

// ─── Maak en stuur offer (initiator) ───
async function maakEnStuurOffer() {
  maakPeerConnection()
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  await stuurSignaal(vriendId, 'offer', offer)
}

// ─── Verwerk offer en stuur answer ───
async function verwerkOffer(offer) {
  maakPeerConnection()
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  await stuurSignaal(vriendId, 'answer', answer)
}

// ─── Ophangen ───
export async function hangOp() {
  await stuurSignaal(vriendId, 'ophangen', {})
  beeindigGesprek(true)
}

// ─── Beëindig gesprek ───
function beeindigGesprek(doorOns) {
  if (lokaleStream) {
    lokaleStream.getTracks().forEach(t => t.stop())
    lokaleStream = null
  }
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  remoteStream = null
  vriendId = null

  if (onEindCallback) onEindCallback(doorOns)
}

// ─── Microfoon aan/uit ───
export function toggleMic() {
  if (!lokaleStream) return false
  const track = lokaleStream.getAudioTracks()[0]
  if (track) track.enabled = !track.enabled
  return track ? track.enabled : false
}

// ─── Camera aan/uit ───
export function toggleCamera() {
  if (!lokaleStream) return false
  const track = lokaleStream.getVideoTracks()[0]
  if (track) track.enabled = !track.enabled
  return track ? track.enabled : false
}
