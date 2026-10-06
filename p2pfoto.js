// p2pfoto.js — P2P foto-overdracht via WebRTC DataChannel
// Foto's gaan rechtstreeks van apparaat naar apparaat, NIET via de server,
// zolang beide kanten tegelijk online zijn (fase 1 — geen offline-fallback nog).

import { ICE_SERVERS } from './ice-config.js?v=106'
// v121 (stap B deel 4): aanwezigheid en signalen gaan via paren.js, een afgeschermd
// kanaal per vriendenpaar, in plaats van het openbare kanaal fibro-aanwezigheid.
import { startParen, isOnline, heeftKenmerk, opBericht, stuurNaar, zetKenmerk } from './paren.js?v=1'

let huidigeUserId = null
let signaalAfmelden = null

// Per-vriend WebRTC state — meerdere gelijktijdige P2P-verbindingen mogelijk
const verbindingen = {}             // { vriendId: { pc, dataChannel, status } }
const ontvangstBuffers = {}         // { transferId: { chunks:[], ontvangen:0, totaal:0, meta:{} } }

let onFotoOntvangenCallback = null
let onStatusCallback = null         // (vriendId, status) — voor UI-feedback

// ════════════════════════════════
// INIT: aanwezigheid (via paren.js) + signaling-listener
// ════════════════════════════════
export function initP2pFoto(userId, callbacks = {}) {
  huidigeUserId = userId
  onFotoOntvangenCallback = callbacks.onFotoOntvangen || null
  onStatusCallback = callbacks.onStatus || null

  // Vrienden zien zo dat deze pagina foto's kan ontvangen
  zetKenmerk('foto', true)
  if (!signaalAfmelden) {
    signaalAfmelden = opBericht('p2p-signaal', (bericht, vanVriendId) => {
      verwerkSignaal(vanVriendId, bericht).catch((e) => console.warn('[p2pfoto] signaal fout:', e))
    })
  }
  startParen(userId)
}

// Online met een pagina die foto's kan ontvangen (chat of profiel)
export function isVriendOnline(vriendId) {
  return isOnline(vriendId) && heeftKenmerk(vriendId, 'foto')
}

function meldStatus(vriendId, status) {
  if (onStatusCallback) onStatusCallback(vriendId, status)
}

// ════════════════════════════════
// SIGNALING (via het afgeschermde kanaal van het vriendenpaar, paren.js)
// ════════════════════════════════
async function stuurSignaal(naarVriendId, type, data) {
  // JSON-kopie: een RTCIceCandidate of RTCSessionDescription wordt zo een gewoon object
  await stuurNaar(naarVriendId, 'p2p-signaal', JSON.parse(JSON.stringify({ type, data })))
}

async function verwerkSignaal(van, bericht) {
  // van komt van paren.js: alleen de vriend van dat kanaal kan het sturen
  const { type, data } = bericht || {}

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
      if (buf) {
        buf._volgendeTransferId = bericht.transferId
        buf._volgendeIndex = bericht.index
      }
    }
  } else {
    // Binary chunk data — zoek transfer via _volgendeTransferId (ingesteld bij chunk-info)
    const transferId = Object.keys(ontvangstBuffers).find(id => 
      ontvangstBuffers[id]._volgendeTransferId !== undefined && 
      ontvangstBuffers[id]._volgendeIndex !== undefined
    )
    if (!transferId) return
    const buf = ontvangstBuffers[transferId]
    const index = buf._volgendeIndex
    buf.chunks[index] = data
    buf.ontvangen++
    delete buf._volgendeTransferId
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
}
