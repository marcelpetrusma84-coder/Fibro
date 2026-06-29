// bellen.js — WebRTC P2P audio/video bellen via Supabase Realtime signaling
// Gebruikt het bewezen spel-patroon: gedeeld kanaal met gesorteerde IDs
import { supabase } from './supabase.js'

let lokaleStream = null
let remoteStream = null
let peerConnection = null
let uitnodigingKanaal = null
let gesprekKanaal = null
let huidigeUserId = null
let vriendId = null
let isInitiator = false
let onOproepCallback = null
let onEindCallback = null
let onVerbondenCallback = null
let geinitialiseerd = false

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:80', username: '3d8f6969f613be308e4de56c', credential: '9pioPuLlUDLd7sPT' },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '3d8f6969f613be308e4de56c', credential: '9pioPuLlUDLd7sPT' },
    { urls: 'turn:global.relay.metered.ca:443', username: '3d8f6969f613be308e4de56c', credential: '9pioPuLlUDLd7sPT' },
    { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '3d8f6969f613be308e4de56c', credential: '9pioPuLlUDLd7sPT' }
  ]
}

function gesprekKanaalNaam(id1, id2) {
  const ids = [id1, id2].sort()
  return 'belgesprek_' + ids[0] + '_' + ids[1]
}

export function initBellen(userId, callbacks = {}) {
  if (geinitialiseerd && huidigeUserId === userId) return
  huidigeUserId = userId
  onOproepCallback = callbacks.onOproep || null
  onEindCallback = callbacks.onEind || null
  onVerbondenCallback = callbacks.onVerbonden || null
  geinitialiseerd = true
  luisterNaarUitnodigingen()
}

function luisterNaarUitnodigingen() {
  if (uitnodigingKanaal) { supabase.removeChannel(uitnodigingKanaal); uitnodigingKanaal = null }
  uitnodigingKanaal = supabase
    .channel('bel-uitnodiging-' + huidigeUserId, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'uitnodiging' }, (msg) => {
      const { van, video } = msg.payload
      console.log('Uitnodiging ontvangen van:', van)
      vriendId = van
      isInitiator = false
      openGesprekKanaal(van)
      if (onOproepCallback) onOproepCallback({ van, videoModus: video })
    })
    .subscribe((status) => { console.log('Uitnodigingskanaal status:', status) })
}

function openGesprekKanaal(anderId) {
  if (gesprekKanaal) { supabase.removeChannel(gesprekKanaal); gesprekKanaal = null }
  gesprekKanaal = supabase
    .channel(gesprekKanaalNaam(huidigeUserId, anderId), { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'signaal' }, (msg) => {
      const { type, data } = msg.payload
      verwerkSignaal(type, data)
    })
    .subscribe((status) => { console.log('Gesprekkanaal status:', status) })
}

async function stuurSignaal(type, data = {}) {
  if (!gesprekKanaal) { console.warn('Geen gesprekkanaal:', type); return }
  await gesprekKanaal.send({ type: 'broadcast', event: 'signaal', payload: { type, data } })
}

async function verwerkSignaal(type, data) {
  console.log('Signaal ontvangen:', type)
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
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(data)) } catch(e) { console.warn('ICE fout:', e) }
    }
  }
  if (type === 'ophangen') { beeindigGesprek(false) }
}

export async function belOp(naarVriendId, video = false) {
  vriendId = naarVriendId
  isInitiator = true
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
  } catch(e) { alert('Geen toegang tot microfoon/camera.'); return false }
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = lokaleStream
  openGesprekKanaal(naarVriendId)
  const uitnodiging = supabase.channel('bel-uitnodiging-' + naarVriendId)
  await new Promise((resolve) => { uitnodiging.subscribe((s) => { if (s === 'SUBSCRIBED') resolve() }) })
  await uitnodiging.send({ type: 'broadcast', event: 'uitnodiging', payload: { van: huidigeUserId, video } })
  supabase.removeChannel(uitnodiging)
  return true
}

export async function accepteerOproep(video = false) {
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
  } catch(e) { alert('Geen toegang tot microfoon/camera.'); return false }
  // Zorg dat het gesprekkanaal open is (bij paginawissel kan het nog ontbreken)
  if (!gesprekKanaal && vriendId) {
    openGesprekKanaal(vriendId)
    await new Promise(r => setTimeout(r, 500))
  }
  maakPeerConnection()
  await stuurSignaal('geaccepteerd', {})
  return true
}

export async function weigerooproep() {
  await stuurSignaal('ophangen', {})
  vriendId = null
}

function maakPeerConnection() {
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  peerConnection = new RTCPeerConnection(ICE_SERVERS)
  lokaleStream.getTracks().forEach(track => peerConnection.addTrack(track, lokaleStream))
  remoteStream = new MediaStream()
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track))
    const remoteEl = document.getElementById('remoteMedia')
    if (remoteEl) remoteEl.srcObject = remoteStream
    const audioEl = document.getElementById('remoteAudio')
    if (audioEl) { audioEl.srcObject = remoteStream; audioEl.play().catch(()=>{}) }
  }
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) await stuurSignaal('ice', event.candidate.toJSON())
  }
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = lokaleStream
  peerConnection.onconnectionstatechange = () => {
    console.log('Connectie state:', peerConnection.connectionState)
    if (peerConnection.connectionState === 'connected') { if (onVerbondenCallback) onVerbondenCallback() }
    if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) { beeindigGesprek(false) }
  }
}

async function maakEnStuurOffer() {
  maakPeerConnection()
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  await stuurSignaal('offer', offer)
}

async function verwerkOffer(offer) {
  if (!peerConnection) maakPeerConnection()
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  await stuurSignaal('answer', answer)
}

export async function hangOp() {
  await stuurSignaal('ophangen', {})
  beeindigGesprek(true)
}

function beeindigGesprek(doorOns) {
  if (lokaleStream) { lokaleStream.getTracks().forEach(t => t.stop()); lokaleStream = null }
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  if (gesprekKanaal) { supabase.removeChannel(gesprekKanaal); gesprekKanaal = null }
  remoteStream = null
  vriendId = null
  isInitiator = false
  if (onEindCallback) onEindCallback(doorOns)
}

export function toggleMic() {
  if (!lokaleStream) return false
  const track = lokaleStream.getAudioTracks()[0]
  if (track) track.enabled = !track.enabled
  return track ? track.enabled : false
}

export function toggleCamera() {
  if (!lokaleStream) return false
  const track = lokaleStream.getVideoTracks()[0]
  if (track) track.enabled = !track.enabled
  return track ? track.enabled : false
}

// ─── Zet vriendId handmatig (voor inkomend gesprek na paginawissel) ───
export function zetVriendId(id) {
  vriendId = id
}
