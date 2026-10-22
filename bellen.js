// bellen.js — WebRTC P2P audio/video bellen via Supabase Realtime signaling
// Gebruikt het bewezen spel-patroon: gedeeld kanaal met gesorteerde IDs
// v143: meldingen ook in het Engels (taal.js)
// v150: camera in HD (1280x720) als dat kan, en zonder (vrije) camera verder met alleen geluid
// v151: pushmelding bij bellen ('belt je'), en 'gemiste oproep' als niemand opnam (stuur-push)
// v152: na het gesprek zet de beller een regel in de chat (gemist, geweigerd of gesprek met duur)
import { supabase } from './supabase.js?v=95'
import { ICE_SERVERS, iceReady } from './ice-config.js?v=149'
import { houOpen } from './lijntjes.js?v=1'
import { maakBelregel } from './belregel.js?v=152'

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
let onEigenVideoOntvangenCallback = null
let onGeenCameraCallback = null
let videoActiefLokaal = false
let videoSender = null
let geinitialiseerd = false
let gesprekKlaar = null   // belofte: klaar zodra het gesprekskanaal echt open is
let iceBuffer = []        // ICE-gegevens die binnenkomen voordat offer/answer verwerkt is
let videoGewenst = false  // v150: met video gebeld/opgenomen (ook als de eigen camera niet lukte)
const BELLEN_VERSIE = 107 // gaat mee in elk signaal: zo toont het log welke versie de ander draait

// v151: pushmelding naar de vriend. De tekst maakt stuur-push zelf (in de taal van de ontvanger);
// 'gemist' heeft dezelfde tag als 'belt je' en vervangt die melding op de telefoon van de ander.
const PUSH_URL = 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push'
let belMeldingNaar = null  // naar wie een 'belt je'-melding ging, tot er opgenomen of opgegeven is
let belPas = null          // inlogpas van dat moment (voor 'gemist', ook als de pagina net sluit)
let oproepBezig = null     // het versturen van 'belt je' (eerst klaar, dan pas 'gemist')
let opgenomen = false      // de ander nam op ('geaccepteerd')

async function stuurOproepMelding(naar, type) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || belMeldingNaar !== naar || opgenomen) return // al opgenomen of opgehangen
    belPas = session.access_token
    await fetch(PUSH_URL, { method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + belPas },
      body: JSON.stringify({ receiver_id: naar, type }) })
  } catch (e) { console.log('[bellen] belmelding versturen mislukt:', e) }
}

// Niemand nam op (en de ander weigerde ook niet): 'gemiste oproep'. direct = de pagina sluit net.
function meldGemist(direct) {
  const naar = belMeldingNaar
  belMeldingNaar = null
  if (!naar || opgenomen) return null
  const stuur = () => {
    if (!belPas) return
    return fetch(PUSH_URL, { method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + belPas },
      body: JSON.stringify({ receiver_id: naar, type: 'gemist' }) }).catch(e => console.log('[bellen] gemist versturen mislukt:', e))
  }
  return direct ? stuur() : Promise.resolve(oproepBezig).then(stuur)
}
// Pagina dicht terwijl het nog overgaat: toch 'gemist' (keepalive: het verzoek overleeft het sluiten)
window.addEventListener('pagehide', () => {
  if (belMeldingNaar && !opgenomen) meldGemist(true)
  if (belregelNaar) schrijfBelregel(opgenomen ? 'gesprek' : 'gemist', true) // v152: poging, niet zeker
})

// v152: de belregel in de chat. Alleen de beller schrijft hem (niet bij een spel), een keer per
// gesprek, als gewoon bericht (sender = ik, receiver = de ander). Inhoud: zie belregel.js.
const REST_URL = 'https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/messages'
const SLEUTEL = 'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf' // de openbare sleutel uit supabase.js
let belregelNaar = null    // naar wie de regel moet, tot hij geschreven is
let belregelVideo = false  // met video gebeld
let geweigerd = false      // de ander weigerde ('ophangen' voordat er opgenomen was)
let verbondenOp = 0        // tijdstip waarop de verbinding er was (voor de duur)
let belregelBezig = null   // het wegschrijven; bellen.html wacht erop voordat het naar de chat gaat

function schrijfBelregel(soort, paginaSluit) {
  const naar = belregelNaar
  belregelNaar = null
  if (!naar || !huidigeUserId) return null
  const sec = soort === 'gesprek' && verbondenOp ? (Date.now() - verbondenOp) / 1000 : 0
  const rij = { sender_id: huidigeUserId, receiver_id: naar, content: maakBelregel(soort, belregelVideo, sec) }
  if (paginaSluit) {
    // De pagina gaat dicht: supabase-js haalt het niet meer, een keepalive-verzoek misschien wel
    if (!belPas) return null
    try {
      fetch(REST_URL, { method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'apikey': SLEUTEL, 'Authorization': 'Bearer ' + belPas, 'Prefer': 'return=minimal' },
        body: JSON.stringify(rij) }).catch(() => {})
    } catch (e) {}
    return null
  }
  belregelBezig = supabase.from('messages').insert(rij)
    .then(({ error }) => { if (error) console.warn('[bellen] belregel niet opgeslagen:', error.message) },
      e => console.warn('[bellen] belregel niet opgeslagen:', e))
  return belregelBezig
}

// bellen.html: eerst de belregel weg laten gaan, dan pas naar de chat (hoogstens ms wachten)
export function wachtOpBelregel(ms = 2000) {
  return belregelBezig ? Promise.race([belregelBezig, wachtMs(ms)]) : Promise.resolve()
}

// De pushmelding van een oproep van deze vriend weghalen (opgenomen, geweigerd of verbonden)
export async function sluitBelMelding(vanId) {
  try {
    if (!vanId || !('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg || !reg.getNotifications) return
    for (const n of await reg.getNotifications({ tag: 'oproep-' + vanId })) n.close()
  } catch (e) {}
}

// v150: zonder wens gaf de browser meestal 640x480: wazig op een groot scherm. 'ideal' = als het kan.
const CAMERA = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }
const GELUID = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

// Microfoon (en camera). Lukt de camera niet (geen camera, of hij is in gebruik), dan verder met
// alleen geluid in plaats van het hele gesprek te stoppen (v150, fout 21). De ander kan wel video sturen.
async function haalMicEnCamera(video) {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: GELUID, video: video ? CAMERA : false })
  } catch (e) {
    if (!video) throw e
    console.warn('[bellen] camera lukt niet (' + (e && e.name) + '), verder met alleen geluid')
    const s = await navigator.mediaDevices.getUserMedia({ audio: GELUID, video: false })
    if (onGeenCameraCallback) { try { onGeenCameraCallback() } catch (er) {} }
    return s
  }
}

// Een camera die al als lokale preview draait behouden wanneer het audiogesprek
// later begint. Zo verdwijnt het eigen beeld niet tijdens de WebRTC-handshake.
async function haalGespreksStream(video) {
  const vorigeStream = lokaleStream
  const voorbereid = vorigeStream?.getVideoTracks().find(track => track.readyState === 'live') || null
  const stream = await haalMicEnCamera(video)
  if (voorbereid && !stream.getVideoTracks().length) stream.addTrack(voorbereid)
  else if (voorbereid) voorbereid.stop()
  if (vorigeStream && vorigeStream !== stream) {
    vorigeStream.getTracks().forEach(track => { if (track !== voorbereid) track.stop() })
  }
  return stream
}

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
  onEigenVideoOntvangenCallback = callbacks.onEigenVideoOntvangen || null
  onGeenCameraCallback = callbacks.onGeenCamera || null
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
    opgenomen = true // v151: geen 'gemiste oproep' meer
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
  if (type === 'ophangen') { // geweigerd: geen 'gemist' (v152: wel de regel 'geweigerd' in de chat)
    if (isInitiator && !opgenomen) geweigerd = true
    belMeldingNaar = null; beeindigGesprek(false)
  }
  if (type === 'video-status') {
    if (onVideoStatusCallback) onVideoStatusCallback(data.actief)
  }
  if (type === 'video-ontvangen') {
    if (onEigenVideoOntvangenCallback) onEigenVideoOntvangenCallback(Boolean(data.actief))
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
  videoGewenst = !!video
  belMeldingNaar = null; opgenomen = false; oproepBezig = null
  belregelNaar = null; geweigerd = false; verbondenOp = 0
  try {
    lokaleStream = await haalGespreksStream(video)
  } catch(e) { alert(window.T ? window.T('Geen toegang tot microfoon/camera.') : 'Geen toegang tot microfoon/camera.'); return false }
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
  // v151: ook een pushmelding ('belt je'), voor als Fibro bij de ander niet open staat (niet bij een spel)
  if (!spelModus) {
    belMeldingNaar = naarVriendId
    oproepBezig = stuurOproepMelding(naarVriendId, video ? 'oproep-video' : 'oproep')
    belregelNaar = naarVriendId; belregelVideo = !!video // v152: na afloop een regel in de chat
  }
  // Zonder timeout blijft de microfoon oneindig aan als niemand opneemt
  stopBelTimeout()
  belTimeout = setTimeout(() => {
    console.log('Niemand nam op — gesprek beëindigd na timeout')
    meldGemist(false)
    stuurSignaal('ophangen', {})
    beeindigGesprek(true)
  }, BEL_TIMEOUT_MS)
  return true
}

export async function accepteerOproep(video = false) {
  await iceReady // TURN-servers eerst binnen laten komen
  videoGewenst = !!video
  try {
    lokaleStream = await haalGespreksStream(video)
  } catch(e) { alert(window.T ? window.T('Geen toegang tot microfoon/camera.') : 'Geen toegang tot microfoon/camera.'); return false }
  // Zorg dat het gesprekkanaal echt open is (bij paginawissel kan het nog ontbreken,
  // en bij een spel is het misschien net pas geopend)
  if (gesprekKlaar) await gesprekKlaar
  if (!gesprekKanaal && vriendId) await openGesprekKanaal(vriendId)
  sluitBelMelding(vriendId) // v151: de 'belt je'-melding is nu niet meer nodig
  if (!lokaleStream) return false // v197: intussen opgehangen (bijv. het spel net dicht): geen gesprek meer opzetten
  maakPeerConnection()
  await stuurSignaal('geaccepteerd', {})
  return true
}

export async function weigerooproep() {
  sluitBelMelding(vriendId) // v151
  await stuurSignaal('ophangen', {})
  // Kanaal opruimen — anders lekt elk geweigerd gesprek een open Supabase-kanaal
  if (gesprekKanaal) { supabase.removeChannel(gesprekKanaal); gesprekKanaal = null }
  gesprekKlaar = null
  vriendId = null
}

function maakPeerConnection() {
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  peerConnection = new RTCPeerConnection(ICE_SERVERS)
  // v197: lokaleStream kan leeg zijn als het gesprek tijdens het wachten al eindigde (gaf 'getTracks of null')
  if (lokaleStream) lokaleStream.getTracks().forEach(track => {
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
        speelAf(remoteEl)
        const bevestigOntvangst = () => stuurSignaal('video-ontvangen', { actief:true }).catch(()=>{})
        if (track.muted) track.addEventListener('unmute', bevestigOntvangst, { once:true })
        else bevestigOntvangst()
      }
    }
    const audioEl = document.getElementById('remoteAudio')
    if (audioEl) { audioEl.srcObject = remoteStream; speelAf(audioEl) }
    track.onended = () => {
      if (!remoteStream) return // gesprek is al afgelopen
      remoteStream.getTracks().forEach(t => { if (t.kind === 'video' && t.readyState === 'ended') remoteStream.removeTrack(t) })
      if (remoteEl && remoteStream.getVideoTracks().length === 0) {
        remoteEl.style.display = 'none'
        stuurSignaal('video-ontvangen', { actief:false }).catch(()=>{})
      }
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
      if (!verbondenOp) verbondenOp = Date.now() // v152: de duur telt vanaf de eerste verbinding
      stuurSignaal('video-status', { actief:videoActiefLokaal }).catch(()=>{})
      if (onVerbondenCallback) onVerbondenCallback()
    }
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) { beeindigGesprek(false) }
  }
}

async function maakEnStuurOffer() {
  maakPeerConnection()
  // Met video gebeld maar de eigen camera lukte niet: toch om video van de ander vragen (v150)
  if (videoGewenst && lokaleStream && !lokaleStream.getVideoTracks().length) peerConnection.addTransceiver('video', { direction: 'recvonly' })
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

// v198: de uitkomst is wat de camera ECHT doet (heeftLokaleVideo), niet of de vriend de wijziging kreeg.
// Eerst ging een mislukte stap richting de vriend (replaceTrack, offer, signaal) als 'mislukt' terug,
// terwijl de camera al aan stond: het scherm zei 'uit' en het lampje brandde. Melding van Tijn.
export async function schakelVideo(aanzetten) {
  if (aanzetten) {
    let videoTrack = null
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: CAMERA })
      videoTrack = videoStream.getVideoTracks()[0] || null
    } catch (e) { console.warn('schakelVideo: geen camera:', e) }
    if (!videoTrack) return heeftLokaleVideo()
    if (!lokaleStream) lokaleStream = new MediaStream()
    const oudeVideo = lokaleStream.getVideoTracks()[0]
    if (oudeVideo) { lokaleStream.removeTrack(oudeVideo); oudeVideo.stop() }
    lokaleStream.addTrack(videoTrack)
    // Stopt de camera vanzelf (andere app, toestemming ingetrokken): de pagina hoort het
    videoTrack.addEventListener('ended', () => {
      if (lokaleStream && lokaleStream.getVideoTracks().includes(videoTrack)) videoActiefLokaal = false
      window.dispatchEvent(new CustomEvent('fibro-eigen-video-gestopt'))
    })
    const lokaalEl = document.getElementById('lokaalMedia')
    if (lokaalEl) { lokaalEl.srcObject = lokaleStream; lokaalEl.play().catch(()=>{}) }
    videoActiefLokaal = true
  } else {
    const track = lokaleStream ? lokaleStream.getVideoTracks()[0] : null
    if (track) { lokaleStream.removeTrack(track); track.stop() }
    videoActiefLokaal = false
  }
  // De lokale preview werkt ook zonder vriendverbinding. Zodra er een peer is, gaat dezelfde track mee en
  // bevestigt de ontvanger het beeld. Lukt dit deel niet, dan blijft de camera zoals hij is (een volgende
  // verbinding neemt hem vanzelf mee, zie maakPeerConnection).
  if (peerConnection) {
    try {
      const track = aanzetten && lokaleStream ? lokaleStream.getVideoTracks()[0] : null
      if (videoSender) await videoSender.replaceTrack(track)
      else if (track) videoSender = peerConnection.addTrack(track, lokaleStream)
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      await stuurSignaal('offer-renegotiate', offer)
      await stuurSignaal('video-status', { actief: videoActiefLokaal })
    } catch (e) { console.warn('schakelVideo: de vriend kreeg de wijziging niet:', e) }
    if (!videoActiefLokaal && onEigenVideoOntvangenCallback) onEigenVideoOntvangenCallback(false)
  }
  return aanzetten ? heeftLokaleVideo() : !heeftLokaleVideo()
}

// v198: geluid van de ander dat de browser tegenhoudt (geen tik gehad, vooral iPhone) werd stil genegeerd:
// je hoorde je vriend niet en wist niet waarom. Nu komt er een knop 'Tik hier voor geluid'; een tik speelt
// alles wat tegengehouden werd alsnog af. Werkt op elke pagina die bellen.js gebruikt.
const geblokkeerd = new Set()
function speelAf(el) {
  if (!el) return
  const p = el.play()
  if (p && p.then) p.then(() => { geblokkeerd.delete(el); werkGeluidKnopBij() }, (e) => {
    if (e && e.name === 'NotAllowedError') { geblokkeerd.add(el); werkGeluidKnopBij() }
  })
}
export async function speelGeblokkeerdAf() {
  for (const el of [...geblokkeerd]) {
    if (!el.isConnected || !el.srcObject) { geblokkeerd.delete(el); continue }
    try { await el.play(); geblokkeerd.delete(el) } catch (e) {}
  }
  werkGeluidKnopBij()
  return geblokkeerd.size === 0
}
export function isGeluidGeblokkeerd() {
  return [...geblokkeerd].some(el => el.isConnected && el.srcObject)
}
function werkGeluidKnopBij() {
  let knop = document.getElementById('fibroGeluidKnop')
  if (!isGeluidGeblokkeerd()) { if (knop) knop.remove(); return }
  if (knop) return
  const T = window.T || (s => s)
  knop = document.createElement('button')
  knop.id = 'fibroGeluidKnop'
  knop.type = 'button'
  knop.textContent = T('🔊 Tik hier voor geluid')
  knop.setAttribute('aria-live', 'polite')
  knop.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;min-height:48px;padding:12px 20px;border:1px solid #ffffff60;border-radius:24px;background:linear-gradient(135deg,#ffcc4d,#ff8a3d);color:#2a1300;font:inherit;font-size:15px;font-weight:700;box-shadow:0 8px 24px #0009;cursor:pointer'
  knop.addEventListener('click', () => { speelGeblokkeerdAf() })
  document.body.appendChild(knop)
}

export function isVideoActiefLokaal() {
  return videoActiefLokaal
}

export async function hangOp() {
  const gemist = meldGemist(false) // v151: opgehangen voordat de ander opnam
  await stuurSignaal('ophangen', {})
  beeindigGesprek(true) // v152: schrijft ook de belregel
  const wacht = [gemist, belregelBezig].filter(Boolean)
  if (wacht.length) await Promise.race([Promise.all(wacht), wachtMs(2000)]) // daarna pas naar een andere pagina
}

function beeindigGesprek(doorOns) {
  stopBelTimeout()
  // v152: de regel in de chat (alleen als wij belden; daarna is belregelNaar leeg)
  if (belregelNaar) schrijfBelregel(opgenomen ? 'gesprek' : geweigerd ? 'geweigerd' : 'gemist', false)
  geweigerd = false; verbondenOp = 0
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
  geblokkeerd.clear(); werkGeluidKnopBij() // v198
  const audioEl = document.getElementById('remoteAudio')
  if (audioEl) audioEl.srcObject = null
  const lokaalEl = document.getElementById('lokaalMedia')
  if (lokaalEl) lokaalEl.srcObject = null
  vriendId = null
  isInitiator = false
  videoGewenst = false
  belMeldingNaar = null; opgenomen = false; oproepBezig = null // belPas blijft: 'gemist' kan nog onderweg zijn
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
    if (inst.facingMode === 'user') pogingen.push(Object.assign({}, CAMERA, { facingMode: { exact: 'environment' } }))
    else if (inst.facingMode === 'environment') pogingen.push(Object.assign({}, CAMERA, { facingMode: { exact: 'user' } }))
    // Anders (of als dat niet lukt): de volgende camera in de lijst
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && d.deviceId)
      const i = cams.findIndex(d => d.deviceId === inst.deviceId)
      if (cams.length > 1) pogingen.push(Object.assign({}, CAMERA, { deviceId: { exact: cams[(i + 1) % cams.length].deviceId } }))
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
        const s = await navigator.mediaDevices.getUserMedia({ video: inst.deviceId ? Object.assign({}, CAMERA, { deviceId: { exact: inst.deviceId } }) : CAMERA })
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
