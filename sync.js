// sync.js — P2P widget-sync via WebRTC DataChannel
// Stap A: presence ✓ | Stap B: DataChannel ping-pong
// Zelfde signaling-patroon als bellen.js: gedeeld kanaal met gesorteerde IDs
import { supabase } from './supabase.js'

let presenceKanaal = null
let huidigeUserId = null
let onlineGebruikers = new Set()
let onOnlineChangeCallback = null
let vrienden = new Set()

let syncKanaal = null
let peerConnection = null
let dataChannel = null
let syncPartnerId = null
let isInitiator = false
let p2pStatus = ''
let iceBuffer = []

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

export function initSync(userId, callbacks = {}) {
  huidigeUserId = userId
  onOnlineChangeCallback = callbacks.onOnlineChange || null
  laadVrienden().then(() => startPresence())
}

function startPresence() {
  if (presenceKanaal) { supabase.removeChannel(presenceKanaal); presenceKanaal = null }
  presenceKanaal = supabase
    .channel('fibro-online', { config: { presence: { key: huidigeUserId } } })
    .on('presence', { event: 'sync' }, () => {
      const state = presenceKanaal.presenceState()
      onlineGebruikers = new Set(Object.keys(state).filter((id) => id !== huidigeUserId))
      console.log('[sync] Online gebruikers:', [...onlineGebruikers])
      if (onOnlineChangeCallback) onOnlineChangeCallback([...onlineGebruikers])
      toonDebugBadge()
      if (syncPartnerId && !onlineGebruikers.has(syncPartnerId)) stopSync()
      checkSyncStart()
    })
    .subscribe(async (status) => {
      console.log('[sync] Presence-kanaal status:', status)
      if (status === 'SUBSCRIBED') {
        await presenceKanaal.track({ online_sinds: new Date().toISOString() })
      }
    })
}

async function laadVrienden() {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_id,friend_id')
    .or('user_id.eq.' + huidigeUserId + ',friend_id.eq.' + huidigeUserId)
    .eq('status', 'accepted')
  if (error) { console.warn('[sync] vrienden laden mislukt:', error); return }
  vrienden = new Set((data || []).map((f) => f.user_id === huidigeUserId ? f.friend_id : f.user_id))
  console.log('[sync] Vrienden geladen:', vrienden.size)
}

function checkSyncStart() {
  if (syncPartnerId) return
  const ander = [...onlineGebruikers].find((id) => vrienden.has(id))
  if (!ander) return
  syncPartnerId = ander
  isInitiator = huidigeUserId < ander
  console.log('[sync] Start sync met', ander, '- initiator:', isInitiator)
  zetP2pStatus('verbinden...')
  openSyncKanaal(ander)
}

function openSyncKanaal(anderId) {
  const ids = [huidigeUserId, anderId].sort()
  syncKanaal = supabase
    .channel('syncdata_' + ids[0] + '_' + ids[1], { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'signaal' }, (msg) => {
      verwerkSignaal(msg.payload.type, msg.payload.data)
    })
    .subscribe((status) => {
      console.log('[sync] Synckanaal status:', status)
      if (status === 'SUBSCRIBED' && isInitiator) {
        setTimeout(maakEnStuurOffer, 2000)
      }
    })
}

async function stuurSignaal(type, data = {}) {
  if (!syncKanaal) return
  await syncKanaal.send({ type: 'broadcast', event: 'signaal', payload: { type, data } })
}

function maakPeerConnection() {
  peerConnection = new RTCPeerConnection(ICE_SERVERS)
  iceBuffer = []
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) stuurSignaal('ice', event.candidate)
  }
  peerConnection.ondatachannel = (event) => koppelDataChannel(event.channel)
}

function koppelDataChannel(kanaal) {
  dataChannel = kanaal
  dataChannel.onopen = () => {
    console.log('[sync] DataChannel OPEN')
    zetP2pStatus('P2P open')
    if (isInitiator) dataChannel.send(JSON.stringify({ type: 'ping' }))
  }
  dataChannel.onmessage = (event) => {
    const bericht = JSON.parse(event.data)
    console.log('[sync] P2P bericht:', bericht.type)
    if (bericht.type === 'ping') {
      dataChannel.send(JSON.stringify({ type: 'pong' }))
      zetP2pStatus('PING-PONG OK')
    }
    if (bericht.type === 'pong') zetP2pStatus('PING-PONG OK')
  }
  dataChannel.onclose = () => zetP2pStatus('')
}

async function maakEnStuurOffer() {
  maakPeerConnection()
  koppelDataChannel(peerConnection.createDataChannel('fibro-sync'))
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  await stuurSignaal('offer', offer)
}

async function verwerkSignaal(type, data) {
  console.log('[sync] Signaal:', type)
  if (type === 'offer') {
    if (isInitiator) return
    maakPeerConnection()
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
    await leegIceBuffer()
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    await stuurSignaal('answer', answer)
  }
  if (type === 'answer') {
    if (!isInitiator || !peerConnection) return
    if (peerConnection.signalingState !== 'have-local-offer') return
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
    await leegIceBuffer()
  }
  if (type === 'ice') {
    if (!peerConnection || !peerConnection.remoteDescription) {
      iceBuffer.push(data)
      return
    }
    try { await peerConnection.addIceCandidate(new RTCIceCandidate(data)) }
    catch (e) { console.warn('[sync] ice fout:', e) }
  }
}

async function leegIceBuffer() {
  for (const kandidaat of iceBuffer) {
    try { await peerConnection.addIceCandidate(new RTCIceCandidate(kandidaat)) }
    catch (e) { console.warn('[sync] ice-buffer fout:', e) }
  }
  iceBuffer = []
}

function stopSync() {
  console.log('[sync] Sync gestopt')
  if (dataChannel) { dataChannel.close(); dataChannel = null }
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  if (syncKanaal) { supabase.removeChannel(syncKanaal); syncKanaal = null }
  syncPartnerId = null
  iceBuffer = []
  zetP2pStatus('')
}

function zetP2pStatus(status) {
  p2pStatus = status
  toonDebugBadge()
}

function toonDebugBadge() {
  let b = document.getElementById('sync-debug-badge')
  if (!b) {
    b = document.createElement('div')
    b.id = 'sync-debug-badge'
    b.style.cssText = 'position:fixed;bottom:70px;right:10px;background:rgba(0,0,0,0.8);color:#0f0;padding:6px 10px;border-radius:8px;font-size:13px;z-index:9999;font-family:monospace'
    document.body.appendChild(b)
  }
  b.textContent = 'sync: ' + onlineGebruikers.size + ' online' + (p2pStatus ? ' | ' + p2pStatus : '')
}

export function isOnline(userId) {
  return onlineGebruikers.has(userId)
}

export function getOnlineGebruikers() {
  return [...onlineGebruikers]
}
