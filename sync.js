// sync.js — P2P widget-sync via WebRTC DataChannel
// Stap A: presence ✓ | Stap B: DataChannel ping-pong
// Zelfde signaling-patroon als bellen.js: gedeeld kanaal met gesorteerde IDs
import { supabase } from './supabase.js'
import { ICE_SERVERS } from './ice-config.js'

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
let offerRetryCount = 0
let offerRetryTimer = null
let syncTimeout = null

// ICE_SERVERS komt uit ice-config.js (import staat bovenaan)

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
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.log('[sync] Presence-kanaal weggevallen — reconnect over 5 sec')
        setTimeout(startPresence, 5000)
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
        offerRetryCount = 0
        startOfferRetry()
        syncTimeout = setTimeout(() => {
          console.log('[sync] Sync timeout — geen answer na 30 sec')
          stopSync()
        }, 30000)
      }
    })
}

function startOfferRetry() {
  if (offerRetryCount >= 5) {
    console.log('[sync] Offer retries uitgeput')
    return
  }
  offerRetryCount++
  console.log('[sync] Offer poging', offerRetryCount, '/ 5')
  maakEnStuurOffer()
  offerRetryTimer = setTimeout(startOfferRetry, 5000)
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
    stuurManifest()
  }
  dataChannel.onmessage = (event) => {
    const bericht = JSON.parse(event.data)
    console.log('[sync] P2P bericht:', bericht.type)
    verwerkP2pBericht(bericht)
  }
  dataChannel.onclose = () => zetP2pStatus('')
}

function hashString(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

function verzamelEigenFotos() {
  // Foto's van de home-widgets staan in localStorage als pfoto_<stijl>_<idx>_<uid>
  // itemId = key ZONDER uid-suffix, zodat de ontvanger apparaat-onafhankelijke ids cachet
  const fotos = {}
  const suffix = '_' + huidigeUserId
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('pfoto_') && key.endsWith(suffix) && !key.includes('_fit_')) {
      const data = localStorage.getItem(key)
      if (data && data.startsWith('data:image')) {
        const itemId = key.slice(0, -suffix.length)
        fotos[itemId] = { hash: hashString(data) }
      }
    }
  }
  return fotos
}

function stuurManifest() {
  const layoutJson = localStorage.getItem('fibro_widgets_profiel') || '[]'
  const manifest = { layout: { hash: hashString(layoutJson) }, fotos: verzamelEigenFotos() }
  dataChannel.send(JSON.stringify({ type: 'manifest', data: manifest }))
  zetP2pStatus('manifest gestuurd')
}

async function verwerkP2pBericht(bericht) {
  if (bericht.type === 'manifest') {
    const cached = await dbGet('vriend_' + syncPartnerId + '_layout')
    const nodig = []
    if (!cached || cached.hash !== bericht.data.layout.hash) nodig.push('layout')
    const fotos = bericht.data.fotos || {}
    for (const itemId of Object.keys(fotos)) {
      const fCached = await dbGet('vriend_' + syncPartnerId + '_foto_' + itemId)
      if (!fCached || fCached.hash !== fotos[itemId].hash) nodig.push('foto:' + itemId)
    }
    if (nodig.length) {
      dataChannel.send(JSON.stringify({ type: 'geef', items: nodig }))
      zetP2pStatus('vraag ' + nodig.length + ' item(s)')
    } else {
      zetP2pStatus('alles up-to-date')
    }
  }
  if (bericht.type === 'geef') {
    for (const item of bericht.items) {
      if (item === 'layout') {
        const layoutJson = localStorage.getItem('fibro_widgets_profiel') || '[]'
        dataChannel.send(JSON.stringify({ type: 'item', itemId: 'layout', hash: hashString(layoutJson), data: layoutJson }))
      } else if (item.startsWith('foto:')) {
        const itemId = item.slice(5)
        await stuurFotoInChunks(itemId)
      }
    }
  }
  if (bericht.type === 'chunk') {
    await verwerkChunk(bericht)
  }
  if (bericht.type === 'item') {
    if (bericht.itemId === 'layout') {
      await dbPut({ id: 'vriend_' + syncPartnerId + '_layout', hash: bericht.hash, data: bericht.data, ontvangen: Date.now() })
      console.log('[sync] Layout van vriend opgeslagen')
      zetP2pStatus('layout ontvangen \u2713')
    }
  }
}

const CHUNK_TEKST = 12 * 1024 // 12KB tekst per chunk (dataURL is string; +JSON-overhead blijft ruim onder 16KB WebRTC-limiet)
const chunkBuffers = {}       // { itemId: { delen:[], ontvangen:0, totaal:0, hash } }

async function stuurFotoInChunks(itemId) {
  const data = localStorage.getItem(itemId + '_' + huidigeUserId)
  if (!data) { console.warn('[sync] foto niet gevonden:', itemId); return }
  const hash = hashString(data)
  const totaal = Math.ceil(data.length / CHUNK_TEKST)
  console.log('[sync] Stuur foto', itemId, 'in', totaal, 'chunks')
  for (let i = 0; i < totaal; i++) {
    // Flow control: wacht als de verzendbuffer vol raakt
    while (dataChannel.bufferedAmount > 512 * 1024) {
      await new Promise((r) => setTimeout(r, 20))
    }
    dataChannel.send(JSON.stringify({
      type: 'chunk', itemId, hash, volgnr: i, totaal,
      data: data.slice(i * CHUNK_TEKST, (i + 1) * CHUNK_TEKST)
    }))
  }
}

async function verwerkChunk(bericht) {
  const { itemId, hash, volgnr, totaal, data } = bericht
  if (!chunkBuffers[itemId] || chunkBuffers[itemId].hash !== hash) {
    chunkBuffers[itemId] = { delen: new Array(totaal), ontvangen: 0, totaal, hash }
  }
  const buf = chunkBuffers[itemId]
  if (buf.delen[volgnr] === undefined) {
    buf.delen[volgnr] = data
    buf.ontvangen++
  }
  zetP2pStatus('foto ' + itemId.replace('pfoto_', '') + ': ' + buf.ontvangen + '/' + buf.totaal)
  if (buf.ontvangen === buf.totaal) {
    const compleet = buf.delen.join('')
    if (hashString(compleet) !== hash) {
      console.warn('[sync] hash-mismatch bij', itemId, '— chunk-buffer weggegooid')
      delete chunkBuffers[itemId]
      return
    }
    await dbPut({ id: 'vriend_' + syncPartnerId + '_foto_' + itemId, hash, data: compleet, ontvangen: Date.now() })
    delete chunkBuffers[itemId]
    console.log('[sync] Foto compleet opgeslagen:', itemId)
    zetP2pStatus('foto ' + itemId.replace('pfoto_', '') + ' \u2713')
  }
}

function openFibroDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('FibroDB', 2)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGet(id) {
  const db = await openFibroDB()
  return new Promise((resolve) => {
    const req = db.transaction('fotos').objectStore('fotos').get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

async function dbPut(obj) {
  const db = await openFibroDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fotos', 'readwrite')
    tx.objectStore('fotos').put(obj)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
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
    clearTimeout(offerRetryTimer)
    clearTimeout(syncTimeout)
    console.log('[sync] Answer ontvangen — retry gestopt')
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
  clearTimeout(offerRetryTimer)
  clearTimeout(syncTimeout)
  if (dataChannel) { dataChannel.close(); dataChannel = null }
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  if (syncKanaal) { supabase.removeChannel(syncKanaal); syncKanaal = null }
  syncPartnerId = null
  iceBuffer = []
  offerRetryCount = 0
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
