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
let onVideoStatusCallback = null
let videoActiefLokaal = false
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
  onVideoStatusCallback = callbacks.onVideoStatus || null
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
  if (type === 'offer-renegotiate') {
    if (peerConnection === null) return
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      await stuurSignaal('answer-renegotiate', answer)
    } catch(e) { console.warn('renegotiate offer fout:', e) }
  }
  if (type === 'answer-renegotiate') {
    if (peerConnection === null) return
    if (peerConnection.signalingState !== 'have-local-offer') return
    try { await peerConnection.setRemoteDescription(new RTCSessionDescription(data)) } catch(e) { console.warn('renegotiate answer fout:', e) }
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
  if (type === 'video-status') {
    if (onVideoStatusCallback) onVideoStatusCallback(data.actief)
  }
}

export async function belOp(naarVriendId, video = false) {
  vriendId = naarVriendId
  isInitiator = true
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video })
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
    lokaleStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video })
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
    const track = event.track
    const bestaat = remoteStream.getTracks().some(t => t.id === track.id)
    if (!bestaat) remoteStream.addTrack(track)
    const remoteEl = document.getElementById('remoteMedia')
    if (remoteEl) {
      remoteEl.srcObject = remoteStream
      if (track.kind === 'video') {
        remoteEl.style.display = 'block'
        remoteEl.play().catch(()=>{})
      }
    }
    const audioEl = document.getElementById('remoteAudio')
    if (audioEl) { audioEl.srcObject = remoteStream; audioEl.play().catch(()=>{}) }
    track.onended = () => {
      remoteStream.getTracks().forEach(t => { if (t.kind === 'video' && t.readyState === 'ended') remoteStream.removeTrack(t) })
      if (remoteEl && remoteStream.getVideoTracks().length === 0) remoteEl.style.display = 'none'
    }
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

export async function schakelVideo(aanzetten) {
  if (lokaleStream === null || peerConnection === null) return false
  try {
    if (aanzetten) {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
      const videoTrack = videoStream.getVideoTracks()[0]
      lokaleStream.addTrack(videoTrack)
      peerConnection.addTrack(videoTrack, lokaleStream)
      const lokaalEl = document.getElementById('lokaalMedia')
      if (lokaalEl) lokaalEl.srcObject = lokaleStream
      videoActiefLokaal = true
    } else {
      const track = lokaleStream.getVideoTracks()[0]
      if (track) {
        lokaleStream.removeTrack(track)
        track.stop()
        const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video')
        if (sender) peerConnection.removeTrack(sender)
      }
      videoActiefLokaal = false
    }
    // Renegotiation: nieuwe offer op de bestaande connectie (sluit hem niet)
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
    await stuurSignaal('offer-renegotiate', offer)
    await stuurSignaal('video-status', { actief: videoActiefLokaal })
    return true
  } catch(e) {
    console.warn('schakelVideo fout:', e)
    return false
  }
}

export function isVideoActiefLokaal() {
  return videoActiefLokaal
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
