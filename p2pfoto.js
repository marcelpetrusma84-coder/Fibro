// p2pfoto.js — P2P foto-overdracht via WebRTC DataChannel
// Foto's gaan rechtstreeks van apparaat naar apparaat, NIET via de server,
// zolang beide kanten tegelijk online zijn (fase 1 — geen offline-fallback nog).

import { supabase } from './supabase.js'

// ─── ICE servers (zelfde STUN+TURN als bellen.js, los geïmporteerd zodat bellen.js
//     niet belast wordt met logica die niets met audio/video te maken heeft) ───
const ICE_SERVERS = {
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

let huidigeUserId = null
let presenceKanaal = null
let onlineVrienden = new Set()      // user-ID's die nu live in de app zitten

// Per-vriend WebRTC state — meerdere gelijktijdige P2P-verbindingen mogelijk
const verbindingen = {}             // { vriendId: { pc, dataChannel, status } }
const ontvangstBuffers = {}         // { transferId: { chunks:[], ontvangen:0, totaal:0, meta:{} } }

let onFotoOntvangenCallback = null
let onStatusCallback = null         // (vriendId, status) — voor UI-feedback

// ════════════════════════════════
// INIT: presence bijhouden + signaling-listener
// ════════════════════════════════
export function initP2pFoto(userId, callbacks = {}) {
  huidigeUserId = userId
  onFotoOntvangenCallback = callbacks.onFotoOntvangen || null
  onStatusCallback = callbacks.onStatus || null

  if (presenceKanaal) supabase.removeChannel(presenceKanaal)
  presenceKanaal = supabase.channel('fibro-aanwezigheid', {
    config: { presence: { key: userId } }
  })

  presenceKanaal
    .on('presence', { event: 'sync' }, () => {
      const staat = presenceKanaal.presenceState()
      onlineVrienden = new Set(Object.keys(staat))
    })
    .on('broadcast', { event: 'p2p-signaal' }, (msg) => {
      verwerkSignaal(msg.payload)
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceKanaal.track({ online_op: new Date().toISOString() })
      }
    })
}

export function isVriendOnline(vriendId) {
  return onlineVrienden.has(vriendId)
}

function meldStatus(vriendId, status) {
  if (onStatusCallback) onStatusCallback(vriendId, status)
}

// ════════════════════════════════
// SIGNALING (via broadcast op het gedeelde presence-kanaal)
// ════════════════════════════════
async function stuurSignaal(naarVriendId, type, data) {
  await presenceKanaal.send({
    type: 'broadcast',
    event: 'p2p-signaal',
    payload: { van: huidigeUserId, naar: naarVriendId, type, data }
  })
}

async function verwerkSignaal(payload) {
  const { van, naar, type, data } = payload
  if (naar !== huidigeUserId) return // niet voor mij bedoeld

  if (type === 'offer') {
    await accepteerVerbinding(van, data)
  } else if (type === 'answer') {
    const v = verbindingen[van]
    if (v?.pc) await v.pc.setRemoteDescription(new RTCSessionDescription(data))
  } else if (type === 'ice-candidate') {
    const v = verbindingen[van]
    if (v?.pc && data) {
      try { await v.pc.addIceCandidate(new RTCIceCandidate(data)) } catch(e) {}
    }
  }
}

// ════════════════════════════════
// VERBINDING OPZETTEN
// ════════════════════════════════
function maakPeerConnection(vriendId, isInitiator) {
  const pc = new RTCPeerConnection(ICE_SERVERS)
  verbindingen[vriendId] = { pc, dataChannel: null, status: 'verbinden' }

  pc.onicecandidate = (event) => {
    if (event.candidate) stuurSignaal(vriendId, 'ice-candidate', event.candidate)
  }

  pc.onconnectionstatechange = () => {
    const v = verbindingen[vriendId]
    if (!v) return
    if (pc.connectionState === 'connected') {
      v.status = 'verbonden'
      meldStatus(vriendId, 'verbonden')
    } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      meldStatus(vriendId, 'verbroken')
      delete verbindingen[vriendId]
    }
  }

  if (isInitiator) {
    const dc = pc.createDataChannel('foto-overdracht', { ordered: true })
    koppelDataChannel(vriendId, dc)
  } else {
    pc.ondatachannel = (event) => koppelDataChannel(vriendId, event.channel)
  }

  return pc
}

function koppelDataChannel(vriendId, dc) {
  verbindingen[vriendId].dataChannel = dc

  dc.onopen = () => {
    verbindingen[vriendId].status = 'klaar'
    meldStatus(vriendId, 'klaar')
  }
  dc.onclose = () => {
    meldStatus(vriendId, 'verbroken')
  }
  dc.onmessage = (event) => verwerkOntvangenData(vriendId, event.data)
}

async function accepteerVerbinding(vanVriendId, offerData) {
  const pc = maakPeerConnection(vanVriendId, false)
  await pc.setRemoteDescription(new RTCSessionDescription(offerData))
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await stuurSignaal(vanVriendId, 'answer', answer)
}

async function maakVerbindingNaar(vriendId) {
  const bestaand = verbindingen[vriendId]
  if (bestaand?.status === 'klaar' && bestaand.dataChannel?.readyState === 'open') {
    return bestaand
  }

  meldStatus(vriendId, 'verbinden')
  const pc = maakPeerConnection(vriendId, true)
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await stuurSignaal(vriendId, 'offer', offer)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Verbinding timeout — vriend reageert niet')), 10000)
    const checkInterval = setInterval(() => {
      const v = verbindingen[vriendId]
      if (v?.dataChannel?.readyState === 'open') {
        clearTimeout(timeout)
        clearInterval(checkInterval)
        resolve(v)
      } else if (!v) {
        clearTimeout(timeout)
        clearInterval(checkInterval)
        reject(new Error('Verbinding mislukt'))
      }
    }, 150)
  })
}

// ════════════════════════════════
// FOTO VERSTUREN (chunked — DataChannel heeft een berichtgrootte-limiet)
// ════════════════════════════════
const CHUNK_GROOTTE = 16 * 1024 // 16KB per chunk, veilige marge onder WebRTC-limieten

export async function stuurFotoP2P(vriendId, blob, metadata = {}) {
  if (!isVriendOnline(vriendId)) {
    throw new Error('OFFLINE')
  }

  const verbinding = await maakVerbindingNaar(vriendId)
  const dc = verbinding.dataChannel

  const transferId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const buffer = await blob.arrayBuffer()
  const totaalChunks = Math.ceil(buffer.byteLength / CHUNK_GROOTTE)

  meldStatus(vriendId, 'versturen')

  dc.send(JSON.stringify({
    soort: 'meta', transferId, totaalChunks, mimeType: blob.type, grootte: buffer.byteLength, ...metadata
  }))

  for (let i = 0; i < totaalChunks; i++) {
    const start = i * CHUNK_GROOTTE
    const chunk = buffer.slice(start, start + CHUNK_GROOTTE)

    while (dc.bufferedAmount > 1024 * 1024) {
      await new Promise(r => setTimeout(r, 20))
    }

    dc.send(JSON.stringify({ soort: 'chunk-info', transferId, index: i }))
    dc.send(chunk)
  }

  meldStatus(vriendId, 'klaar')
  return transferId
}

function verwerkOntvangenData(vriendId, data) {
  if (typeof data === 'string') {
    const bericht = JSON.parse(data)

    if (bericht.soort === 'meta') {
      ontvangstBuffers[bericht.transferId] = {
        chunks: new Array(bericht.totaalChunks),
        ontvangen: 0,
        totaal: bericht.totaalChunks,
        mimeType: bericht.mimeType,
        grootte: bericht.grootte,
        meta: bericht,
        vanVriendId: vriendId,
      }
      meldStatus(vriendId, 'ontvangen')
    } else if (bericht.soort === 'chunk-info') {
      const buf = ontvangstBuffers[bericht.transferId]
      if (buf) buf._volgendeIndex = bericht.index
    }
  } else {
    const transferId = Object.keys(ontvangstBuffers).find(id => ontvangstBuffers[id]._volgendeIndex !== undefined)
    if (!transferId) return
    const buf = ontvangstBuffers[transferId]
    const index = buf._volgendeIndex
    buf.chunks[index] = data
    buf.ontvangen++
    delete buf._volgendeIndex

    if (buf.ontvangen === buf.totaal) {
      const volledigeBlob = new Blob(buf.chunks, { type: buf.mimeType })
      if (onFotoOntvangenCallback) {
        onFotoOntvangenCallback(buf.vanVriendId, volledigeBlob, buf.meta)
      }
      delete ontvangstBuffers[transferId]
    }
  }
}

// ════════════════════════════════
// Opruimen
// ════════════════════════════════
export function sluitP2pVerbinding(vriendId) {
  const v = verbindingen[vriendId]
  if (v?.dataChannel) v.dataChannel.close()
  if (v?.pc) v.pc.close()
  delete verbindingen[vriendId]
}

export function sluitAlleP2pVerbindingen() {
  Object.keys(verbindingen).forEach(sluitP2pVerbinding)
  if (presenceKanaal) { supabase.removeChannel(presenceKanaal); presenceKanaal = null }
}
