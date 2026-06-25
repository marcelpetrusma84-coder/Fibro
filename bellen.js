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
let geinitialiseerd = false

// ─── ICE servers ───
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}

// ─── Initialiseer bellen module ───
export function initBellen(userId, callbacks = {}) {
  if (geinitialiseerd && huidigeUserId === userId) return
  huidigeUserId = userId
  onOproepCallback = callbacks.onOproep || null
  onEindCallback = callbacks.onEind || null
  geinitialiseerd = true
  luisterNaarOproepen()
}

// ─── Luister naar inkomende oproepen ───
function luisterNaarOproepen() {
  if (belKanaal) {
    supabase.removeChannel(belKanaal)
    belKanaal = null
  }
  belKanaal = supabase
    .channel('bellen-' + huidigeUserId, {
      config: { broadcast: { self: false } }
    })
    .on('broadcast', { event: 'oproep' }, (payload) => {
      const { van, type, data } = payload.payload
      verwerkSignaal(van, type, data)
    })
    .subscribe((status) => {
      console.log('Belkanaal status:', status)
    })
}

// ─── Verwerk inkomend signaal ───
async function verwerkSignaal(van, type, data) {
  console.log('Signaal ontvangen:', type, 'van:', van)

  if (type === 'uitnodiging') {
    vriendId = van
    isInitiator = false
    if (onOproepCallback) onOproepCallback({ van, videoModus: data.video })
  }

  if (type === 'geaccepteerd') {
    if (!isInitiator) return
    await maakEnStuurOffer()
  }

  if (type === 'offer') {
    if (isInitiator) return
    await verwerkOffer(data)
  }

  if (type === 'answer') {
    if (!peerConnection) return
    if (peerConnection.signalingState !== 'have-local-offer') return
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
  }

  if (type === 'ice') {
    if (peerConnection && data && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data))
      } catch(e) { console.warn('ICE fout:', e) }
    }
  }

  if (type === 'ophangen') {
    beeindigGesprek(false)
  }
}

// ─── Stuur signaal naar vriend ───
// Hergebruik één zend-kanaal per ontvanger (voorkomt CHANNEL_ERROR en verloren signalen)
let zendKanalen = {}

async function stuurSignaal(naar, type, data = {}) {
  let kanaal = zendKanalen[naar]
  if (!kanaal) {
    kanaal = supabase.channel('bellen-' + naar)
    zendKanalen[naar] = kanaal
    await new Promise((resolve) => {
      kanaal.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
      })
    })
  }
  await kanaal.send({
    type: 'broadcast',
    event: 'oproep',
    payload: { van: huidigeUserId, type, data }
  })
}

// ─── Bel iemand op ───
export async function belOp(naarVriendId, video = false) {
  vriendId = naarVriendId
  isInitiator = true
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
  } catch(e) {
    alert('Geen toegang tot microfoon/camera.')
    return false
  }
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = lokaleStream
  await stuurSignaal(vriendId, 'uitnodiging', { video })
  return true
}

// ─── Oproep accepteren ───
export async function accepteerOproep(video = false) {
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
  } catch(e) {
    alert('Geen toegang tot microfoon/camera.')
    return false
  }
  maakPeerConnection()
  await new Promise(r => setTimeout(r, 300))
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
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  peerConnection = new RTCPeerConnection(ICE_SERVERS)
  lokaleStream.getTracks().forEach(track => peerConnection.addTrack(track, lokaleStream))
  remoteStream = new MediaStream()
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track))
    const remoteEl = document.getElementById('remoteMedia')
    if (remoteEl) remoteEl.srcObject = remoteStream
  }
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) await stuurSignaal(vriendId, 'ice', event.candidate.toJSON())
  }
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = lokaleStream
  peerConnection.onconnectionstatechange = () => {
    console.log('Connectie state:', peerConnection.connectionState)
    if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
      beeindigGesprek(false)
    }
  }
}

// ─── Maak en stuur offer ───
async function maakEnStuurOffer() {
  maakPeerConnection()
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  await stuurSignaal(vriendId, 'offer', offer)
}

// ─── Verwerk offer en stuur answer ───
async function verwerkOffer(offer) {
  if (!peerConnection) maakPeerConnection()
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
  if (lokaleStream) { lokaleStream.getTracks().forEach(t => t.stop()); lokaleStream = null }
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  remoteStream = null
  vriendId = null
  isInitiator = false
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
