// bellen.js — WebRTC P2P audio/video bellen via Supabase Realtime signaling
// Gebruikt het bewezen spel-patroon: gedeeld kanaal met gesorteerde IDs
import { supabase } from './supabase.js?v=95'
import { ICE_SERVERS, iceReady } from './ice-config.js?v=106'
import { houOpen } from './lijntjes.js?v=1'

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
let videoSender = null
let geinitialiseerd = false
let gesprekKlaar = null   // belofte: klaar zodra het gesprekskanaal echt open is
let iceBuffer = []        // ICE-gegevens die binnenkomen voordat offer/answer verwerkt is
const BELLEN_VERSIE = 105 // gaat mee in elk signaal: zo toont het log welke versie de ander draait

// Soort ICE-adres uit een kandidaat halen: host (eigen netwerk), srflx (via de router), relay (via TURN)
function kandidaatSoort(k) {
  const m = / typ ([a-z]+)/.exec((k && k.candidate) || '')
  return m ? m[1] : '?'
}

// ICE_SERVERS komt uit ice-config.js (import staat bovenaan)

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
  if (uitnodigingKanaal) { uitnodigingKanaal.stop(); uitnodigingKanaal = null }
  // v131: via houOpen (lijntjes.js): gaat weer open als de server het sluit
  uitnodigingKanaal = houOpen('bel-uitnodiging-' + huidigeUserId, () => supabase
    .channel('bel-uitnodiging-' + huidigeUserId, { config: { broadcast: { self: false }, private: true } })
    .on('broadcast', { event: 'uitnodiging' }, (msg) => {
      const { van, video, spel } = msg.payload
      console.log('Uitnodiging ontvangen van:', van)
      vriendId = van
      isInitiator = false
      openGesprekKanaal(van)
      if (spel) { accepteerOproep(false); return }
      if (onOproepCallback) onOproepCallback({ van, videoModus: video })
    }))
}

// Een afgeschermd kanaal heeft bij het openen even nodig (Supabase controleert dan de
// regels). openGesprekKanaal geeft daarom een belofte terug (gesprekKlaar) die pas klaar
// is als het kanaal echt open is; wie uitnodigt, opneemt of een signaal stuurt, wacht
// daarop. Een kanaal met dezelfde naam dat nog aan het sluiten is (bijvoorbeeld het
// wachtkanaal van bellen.html) wordt eerst helemaal gesloten: anders geeft
// supabase.channel() dat sluitende kanaal terug en komt er geen verbinding.
function openGesprekKanaal(anderId) {
  iceBuffer = []
  gesprekKlaar = bouwGesprekKanaal(anderId)
  return gesprekKlaar
}

function wachtMs(ms) { return new Promise(r => setTimeout(r, ms)) }

async function bouwGesprekKanaal(anderId) {
  if (gesprekKanaal) {
    const oud = gesprekKanaal
    gesprekKanaal = null
    await Promise.race([supabase.removeChannel(oud), wachtMs(3000)])
  }
  const naam = gesprekKanaalNaam(huidigeUserId, anderId)
  for (const k of supabase.getChannels()) {
    if (k.topic === 'realtime:' + naam) await Promise.race([supabase.removeChannel(k), wachtMs(3000)])
  }
  const kanaal = supabase
    .channel(naam, { config: { broadcast: { self: false }, private: true } })
    .on('broadcast', { event: 'signaal' }, (msg) => {
      const { type, data, v } = msg.payload
      verwerkSignaal(type, data, v)
    })
  gesprekKanaal = kanaal
  return new Promise((resolve) => {
    const t = setTimeout(() => { console.warn('Gesprekkanaal: na 8 s nog niet open'); resolve(false) }, 8000)
    kanaal.subscribe((status) => {
      console.log('Gesprekkanaal status:', status)
      if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(true) }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); resolve(false) }
    })
  })
}

async function stuurSignaal(type, data = {}) {
  if (gesprekKlaar) await gesprekKlaar
  if (!gesprekKanaal) { console.warn('Geen gesprekkanaal:', type); return }
  await gesprekKanaal.send({ type: 'broadcast', event: 'signaal', payload: { type, data, v: BELLEN_VERSIE } })
}

async function verwerkSignaal(type, data, v) {
  if (type === 'ice') console.log('Signaal ontvangen: ice', kandidaatSoort(data))
  else console.log('Signaal ontvangen:', type, '(versie ander: ' + (v || 'oud') + ')')
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
    await leegIceBuffer()
  }
  if (type === 'ice') {
    if (!data) return
    // Komt te vroeg binnen (offer/answer nog niet verwerkt): bewaren in plaats van weggooien
    if (!peerConnection || !peerConnection.remoteDescription) { iceBuffer.push(data); return }
    try { await peerConnection.addIceCandidate(new RTCIceCandidate(data)) } catch(e) { console.warn('ICE fout:', e) }
  }
  if (type === 'ophangen') { beeindigGesprek(false) }
  if (type === 'video-status') {
    if (onVideoStatusCallback) onVideoStatusCallback(data.actief)
  }
}

let belTimeout = null
const BEL_TIMEOUT_MS = 45000 // na 45 sec niet opgenomen → gesprek + microfoon netjes afsluiten

function stopBelTimeout() {
  if (belTimeout) { clearTimeout(belTimeout); belTimeout = null }
}

export async function belOp(naarVriendId, video = false, spelModus = false) {
  await iceReady // TURN-servers eerst binnen laten komen
  vriendId = naarVriendId
  isInitiator = true
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video })
  } catch(e) { alert('Geen toegang tot microfoon/camera.'); return false }
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = lokaleStream
  // Eerst het gesprekskanaal echt open, dan pas uitnodigen: bij een spel neemt de ander
  // meteen op, en dat antwoord mag niet aankomen voordat wij luisteren
  await openGesprekKanaal(naarVriendId)
  // Afgeschermde brievenbus van de vriend: alleen sturen, niet openen (lezen mag alleen hij zelf)
  const uitnodiging = supabase.channel('bel-uitnodiging-' + naarVriendId, { config: { private: true } })
  const verstuurd = await uitnodiging.send({ type: 'broadcast', event: 'uitnodiging', payload: { van: huidigeUserId, video, spel: spelModus } })
  if (verstuurd !== 'ok') console.warn('[bellen] uitnodiging niet verstuurd:', verstuurd)
  supabase.removeChannel(uitnodiging)
  // Zonder timeout blijft de microfoon oneindig aan als niemand opneemt
  stopBelTimeout()
  belTimeout = setTimeout(() => {
    console.log('Niemand nam op — gesprek beëindigd na timeout')
    stuurSignaal('ophangen', {})
    beeindigGesprek(true)
  }, BEL_TIMEOUT_MS)
  return true
}

export async function accepteerOproep(video = false) {
  await iceReady // TURN-servers eerst binnen laten komen
  try {
    lokaleStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video })
  } catch(e) { alert('Geen toegang tot microfoon/camera.'); return false }
  // Zorg dat het gesprekkanaal echt open is (bij paginawissel kan het nog ontbreken,
  // en bij een spel is het misschien net pas geopend)
  if (gesprekKlaar) await gesprekKlaar
  if (!gesprekKanaal && vriendId) await openGesprekKanaal(vriendId)
  maakPeerConnection()
  await stuurSignaal('geaccepteerd', {})
  return true
}

export async function weigerooproep() {
  await stuurSignaal('ophangen', {})
  // Kanaal opruimen — anders lekt elk geweigerd gesprek een open Supabase-kanaal
  if (gesprekKanaal) { supabase.removeChannel(gesprekKanaal); gesprekKanaal = null }
  gesprekKlaar = null
  vriendId = null
}

function maakPeerConnection() {
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  peerConnection = new RTCPeerConnection(ICE_SERVERS)
  lokaleStream.getTracks().forEach(track => {
    const sender = peerConnection.addTrack(track, lokaleStream)
    // Gesprek begint met video: onthoud de videobron, dan werken de cameraknoppen meteen goed
    if (track.kind === 'video') { videoSender = sender; videoActiefLokaal = true }
  })
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
      if (!remoteStream) return // gesprek is al afgelopen
      remoteStream.getTracks().forEach(t => { if (t.kind === 'video' && t.readyState === 'ended') remoteStream.removeTrack(t) })
      if (remoteEl && remoteStream.getVideoTracks().length === 0) remoteEl.style.display = 'none'
    }
  }
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      const k = event.candidate.toJSON()
      console.log('Eigen ice:', kandidaatSoort(k))
      await stuurSignaal('ice', k)
    } else console.log('Eigen ice: klaar met verzamelen')
  }
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = lokaleStream
  const pc = peerConnection
  pc.oniceconnectionstatechange = () => { console.log('ICE state:', pc.iceConnectionState) }
  pc.onconnectionstatechange = () => {
    // pc (lokale referentie) i.p.v. globale peerConnection:
    // voorkomt crash als de globale al op null staat na beeindigGesprek()
    console.log('Connectie state:', pc.connectionState)
    if (pc !== peerConnection) return // oude, al vervangen connectie: negeren
    if (pc.connectionState === 'connected') {
      stopBelTimeout()
      if (onVerbondenCallback) onVerbondenCallback()
    }
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) { beeindigGesprek(false) }
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
  await leegIceBuffer()
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  await stuurSignaal('answer', answer)
}

// Bewaarde ICE-gegevens alsnog toevoegen, nu offer/answer verwerkt is
async function leegIceBuffer() {
  const lijst = iceBuffer
  iceBuffer = []
  for (const k of lijst) {
    if (!peerConnection) return
    try { await peerConnection.addIceCandidate(new RTCIceCandidate(k)) } catch (e) { console.warn('ICE-buffer fout:', e) }
  }
}

export async function schakelVideo(aanzetten) {
  if (lokaleStream === null || peerConnection === null) return false
  try {
    if (aanzetten) {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
      const videoTrack = videoStream.getVideoTracks()[0]
      const oudeVideo = lokaleStream.getVideoTracks()[0]
      if (oudeVideo) { lokaleStream.removeTrack(oudeVideo); oudeVideo.stop() }
      lokaleStream.addTrack(videoTrack)
      if (videoSender) {
        await videoSender.replaceTrack(videoTrack)
      } else {
        videoSender = peerConnection.addTrack(videoTrack, lokaleStream)
      }
      const lokaalEl = document.getElementById('lokaalMedia')
      if (lokaalEl) lokaalEl.srcObject = lokaleStream
      videoActiefLokaal = true
    } else {
      const track = lokaleStream.getVideoTracks()[0]
      if (track) { lokaleStream.removeTrack(track); track.stop() }
      if (videoSender) await videoSender.replaceTrack(null)
      videoActiefLokaal = false
    }
    // Renegotiation alleen nodig als de sender nieuw is aangemaakt
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
  stopBelTimeout()
  if (lokaleStream) { lokaleStream.getTracks().forEach(t => t.stop()); lokaleStream = null }
  if (peerConnection) {
    // Handlers loskoppelen vóór close(): voorkomt na-ijlende events op dode connectie
    peerConnection.ontrack = null
    peerConnection.onicecandidate = null
    peerConnection.onconnectionstatechange = null
    peerConnection.close()
    peerConnection = null
  }
  if (gesprekKanaal) { supabase.removeChannel(gesprekKanaal); gesprekKanaal = null }
  gesprekKlaar = null
  iceBuffer = []
  remoteStream = null
  // Media-elementen leegmaken zodat de browser streams echt vrijgeeft
  const remoteEl = document.getElementById('remoteMedia')
  if (remoteEl) { remoteEl.srcObject = null; remoteEl.style.display = 'none' }
  const audioEl = document.getElementById('remoteAudio')
  if (audioEl) audioEl.srcObject = null
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = null
  vriendId = null
  isInitiator = false
  videoSender = null
  videoActiefLokaal = false
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

// --- Camera wisselen tijdens een gesprek (voor/achter, of de volgende camera) ---
// Er wordt niet opnieuw verbonden: alleen de bron van het beeld wordt vervangen.
export function heeftLokaleVideo() {
  return !!(lokaleStream && lokaleStream.getVideoTracks().some(t => t.readyState === 'live'))
}

export async function aantalCameras() {
  try {
    const lijst = await navigator.mediaDevices.enumerateDevices()
    return lijst.filter(d => d.kind === 'videoinput').length
  } catch (e) { return 0 }
}

let bezigMetWisselen = false
export async function wisselCamera() {
  if (bezigMetWisselen || !lokaleStream || !peerConnection) return false
  const oud = lokaleStream.getVideoTracks().find(t => t.readyState === 'live')
  if (!oud) return false
  bezigMetWisselen = true
  try {
    const inst = oud.getSettings ? oud.getSettings() : {}
    const pogingen = []
    // Telefoon: voor <-> achter
    if (inst.facingMode === 'user') pogingen.push({ facingMode: { exact: 'environment' } })
    else if (inst.facingMode === 'environment') pogingen.push({ facingMode: { exact: 'user' } })
    // Anders (of als dat niet lukt): de volgende camera in de lijst
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && d.deviceId)
      const i = cams.findIndex(d => d.deviceId === inst.deviceId)
      if (cams.length > 1) pogingen.push({ deviceId: { exact: cams[(i + 1) % cams.length].deviceId } })
    } catch (e) {}
    if (!pogingen.length) return false
    const senders = peerConnection.getSenders()
    const sender = senders.find(s => s.track === oud) || senders.find(s => s.track && s.track.kind === 'video') || videoSender
    const wasAan = oud.enabled
    oud.stop() // iPhone: maar een camera tegelijk open
    let nieuw = null
    for (const v of pogingen) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: v })
        nieuw = s.getVideoTracks()[0] || null
        if (nieuw) break
      } catch (e) { console.warn('Camera wisselen: poging mislukt', e && e.name) }
    }
    if (!nieuw) {
      // Andere camera lukt niet: de oude weer aanzetten
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: inst.deviceId ? { deviceId: { exact: inst.deviceId } } : true })
        nieuw = s.getVideoTracks()[0] || null
      } catch (e) { console.warn('Camera wisselen: oude camera terugzetten mislukt', e && e.name) }
    }
    lokaleStream.removeTrack(oud)
    if (!nieuw) {
      if (sender) { try { await sender.replaceTrack(null) } catch (e) {} }
      videoActiefLokaal = false
      return false
    }
    nieuw.enabled = wasAan
    lokaleStream.addTrack(nieuw)
    if (sender) await sender.replaceTrack(nieuw)
    if (sender) videoSender = sender
    videoActiefLokaal = true
    const lokaalEl = document.getElementById('lokaalMedia')
    if (lokaalEl) { lokaalEl.srcObject = lokaleStream; lokaalEl.play().catch(() => {}) }
    const nieuwInst = nieuw.getSettings ? nieuw.getSettings() : {}
    return nieuwInst.deviceId !== inst.deviceId
  } catch (e) {
    console.warn('wisselCamera fout:', e)
    return false
  } finally {
    bezigMetWisselen = false
  }
}
