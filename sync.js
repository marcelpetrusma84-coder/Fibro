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
let isRelayConnection = false // TURN/relay detectie

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
  dataChannel.onopen = async () => {
    console.log('[sync] DataChannel OPEN')
    zetP2pStatus('P2P open')
    // Detecteer TURN/relay verbinding
    await detecteerRelayConnection()
    stuurManifest()
  }
  dataChannel.onmessage = (event) => {
    const bericht = JSON.parse(event.data)
    console.log('[sync] P2P bericht:', bericht.type)
    verwerkP2pBericht(bericht)
  }
  dataChannel.onclose = () => zetP2pStatus('')
}

async function detecteerRelayConnection() {
  if (!peerConnection) return
  try {
    const stats = await peerConnection.getStats()
    let relayGebruikt = false
    stats.forEach(report => {
      // Kijk naar candidate-pair die data transporteert
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        const type = report.currentRoundTripTime ? 'selected' : ''
        // Als dit de actieve pair is, check de candidate types
        const localCandidate = stats.get(report.localCandidateId)
        const remoteCandidate = stats.get(report.remoteCandidateId)
        if (localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay') {
          relayGebruikt = true
          console.log('[sync] RELAY VERBINDING GEDETECTEERD — muziek wordt overgeslagen')
        }
      }
    })
    isRelayConnection = relayGebruikt
    if (isRelayConnection) {
      zetP2pStatus('⚠️ relay-verbinding (muziek overgeslagen)')
    }
  } catch(e) {
    console.warn('[sync] TURN-detectie fout:', e)
  }
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

async function verzamelEigenMuziek() {
  // Muziek: twee systemen
  // Systeem 1 (profiel.html): muziek_track + muziek_titel (los item, geen uid-suffix)
  // Systeem 2 (index.html): muziek_tracks_<uid> (playlist als JSON-array in IndexedDB)
  const muziek = {}
  
  // ── Systeem 1: profiel-muziek (losstaande track) ──
  try {
    const track1 = localStorage.getItem('muziek_track') || (await dbGet('muziek_track'))?.data
    if (track1 && track1.startsWith('data:audio')) {
      muziek['muziek_profiel'] = { hash: hashString(track1) }
      console.log('[sync] Systeem 1 (profiel-muziek) gevonden')
    }
  } catch(e) { console.warn('[sync] Systeem 1 muziek-ophalen fout:', e) }
  
  // ── Systeem 2: playlist (index.html widget) ──
  try {
    const playlistKey = 'muziek_tracks_' + huidigeUserId
    let playlistJson = localStorage.getItem(playlistKey)
    if (!playlistJson) {
      const dbResult = await dbGet(playlistKey)
      if (dbResult?.data) playlistJson = dbResult.data
    }
    if (playlistJson) {
      try {
        const tracks = JSON.parse(playlistJson)
        if (Array.isArray(tracks) && tracks.length > 0) {
          // Stuur hele playlist als één item
          muziek['muziek_playlist'] = { hash: hashString(playlistJson), count: tracks.length }
          console.log('[sync] Systeem 2 (playlist) gevonden:', tracks.length, 'nummers')
        }
      } catch(e) { console.warn('[sync] Playlist JSON parse fout:', e) }
    }
  } catch(e) { console.warn('[sync] Systeem 2 muziek-ophalen fout:', e) }
  
  return muziek
}

async function stuurManifest() {
  const layoutJson = localStorage.getItem('fibro_widgets_profiel') || '[]'
  const fotos = verzamelEigenFotos()
  const muziek = await verzamelEigenMuziek()
  const manifest = { 
    layout: { hash: hashString(layoutJson) }, 
    fotos,
    muziek
  }
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
    const muziek = bericht.data.muziek || {}
    for (const itemId of Object.keys(muziek)) {
      const mCached = await dbGet('vriend_' + syncPartnerId + '_muziek_' + itemId)
      // Skip muziek als we relay gebruiken (datalimiet)
      if (!isRelayConnection && (!mCached || mCached.hash !== muziek[itemId].hash)) {
        nodig.push('muziek:' + itemId)
      } else if (isRelayConnection) {
        console.log('[sync] Muziek', itemId, 'overgeslagen vanwege relay-verbinding')
      }
    }
    // Opruimen foto's: gecachte foto's die niet meer in het manifest staan zijn verwijderd bij de vriend
    const fotoPrefix = 'vriend_' + syncPartnerId + '_foto_'
    const bestaandeKeys = await dbListKeys(fotoPrefix)
    for (const key of bestaandeKeys) {
      const oudItemId = key.slice(fotoPrefix.length)
      if (!fotos[oudItemId]) {
        await dbDelete(key)
        console.log('[sync] Verouderde foto verwijderd:', key)
        zetP2pStatus('oude foto opgeruimd')
      }
    }
    
    // Opruimen muziek: gecachte muziek-items die niet meer in het manifest staan
    const muziekPrefix = 'vriend_' + syncPartnerId + '_muziek_'
    const muziekKeys = await dbListKeys(muziekPrefix)
    const muziek = bericht.data.muziek || {}
    for (const key of muziekKeys) {
      const itemId = key.slice(muziekPrefix.length)
      if (!muziek[itemId]) {
        await dbDelete(key)
        console.log('[sync] Verouderde muziek verwijderd:', key)
        zetP2pStatus('oude muziek opgeruimd')
      }
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
      } else if (item.startsWith('muziek:')) {
        const itemId = item.slice(7)
        await stuurMuziekInChunks(itemId)
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
    } else if (bericht.itemId.startsWith('muziek_')) {
      const muziekItemId = bericht.itemId.slice(7) // 'profiel' of 'playlist'
      await dbPut({ id: 'vriend_' + syncPartnerId + '_muziek_' + muziekItemId, hash: bericht.hash, data: bericht.data, ontvangen: Date.now() })
      console.log('[sync] Muziek van vriend opgeslagen:', muziekItemId)
      zetP2pStatus('muziek ' + muziekItemId + ' ontvangen \u2713')
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

async function stuurMuziekInChunks(itemId) {
  // itemId = 'profiel' of 'playlist'
  let data = null
  
  if (itemId === 'profiel') {
    // Systeem 1: muziek_track uit localStorage of IndexedDB
    data = localStorage.getItem('muziek_track')
    if (!data) {
      const dbResult = await dbGet('muziek_track')
      data = dbResult?.data
    }
  } else if (itemId === 'playlist') {
    // Systeem 2: muziek_tracks_<uid> (hele JSON-array)
    const playlistKey = 'muziek_tracks_' + huidigeUserId
    data = localStorage.getItem(playlistKey)
    if (!data) {
      const dbResult = await dbGet(playlistKey)
      data = dbResult?.data
    }
  }
  
  if (!data) { console.warn('[sync] muziek niet gevonden:', itemId); return }
  
  const hash = hashString(data)
  const totaal = Math.ceil(data.length / CHUNK_TEKST)
  console.log('[sync] Stuur muziek', itemId, 'in', totaal, 'chunks')
  
  for (let i = 0; i < totaal; i++) {
    // Flow control: wacht als de verzendbuffer vol raakt
    while (dataChannel.bufferedAmount > 512 * 1024) {
      await new Promise((r) => setTimeout(r, 20))
    }
    dataChannel.send(JSON.stringify({
      type: 'chunk', itemId: 'muziek_' + itemId, hash, volgnr: i, totaal,
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
  
  // Status-message: onderscheid foto vs muziek
  let statusLabel = itemId
  if (itemId.startsWith('pfoto_')) {
    statusLabel = 'foto ' + itemId.replace('pfoto_', '')
  } else if (itemId.startsWith('muziek_')) {
    statusLabel = 'muziek ' + itemId.replace('muziek_', '')
  }
  zetP2pStatus(statusLabel + ': ' + buf.ontvangen + '/' + buf.totaal)
  
  if (buf.ontvangen === buf.totaal) {
    const compleet = buf.delen.join('')
    if (hashString(compleet) !== hash) {
      console.warn('[sync] hash-mismatch bij', itemId, '— chunk-buffer weggegooid')
      delete chunkBuffers[itemId]
      return
    }
    
    // Opslaan: bepaal de juiste key op basis van itemId
    let dbKey = itemId
    if (itemId.startsWith('pfoto_')) {
      dbKey = 'vriend_' + syncPartnerId + '_foto_' + itemId
    } else if (itemId.startsWith('muziek_')) {
      dbKey = 'vriend_' + syncPartnerId + '_muziek_' + itemId.slice(7)
    } else {
      // layout of ander item — dit zou niet via chunks moeten komen
      dbKey = 'vriend_' + syncPartnerId + '_' + itemId
    }
    
    await dbPut({ id: dbKey, hash, data: compleet, ontvangen: Date.now() })
    delete chunkBuffers[itemId]
    console.log('[sync] Item compleet opgeslagen:', itemId)
    zetP2pStatus(statusLabel + ' \u2713')
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

async function dbDelete(id) {
  const db = await openFibroDB()
  return new Promise((resolve) => {
    const tx = db.transaction('fotos', 'readwrite')
    tx.objectStore('fotos').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

async function dbListKeys(prefix) {
  const db = await openFibroDB()
  return new Promise((resolve) => {
    const req = db.transaction('fotos').objectStore('fotos').getAllKeys()
    req.onsuccess = () => resolve((req.result || []).filter(k => typeof k === 'string' && k.startsWith(prefix)))
    req.onerror = () => resolve([])
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
  isRelayConnection = false
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
