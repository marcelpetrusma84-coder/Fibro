// sync.js — P2P widget-sync via WebRTC DataChannel
// Stap A: presence ✓ | Stap B: DataChannel ping-pong
// Zelfde signaling-patroon als bellen.js: gedeeld kanaal met gesorteerde IDs
import { supabase } from './supabase.js?v=95'
import { ICE_SERVERS, iceReady } from './ice-config.js?v=106'
import { startParen, opOnline, opNieuwePagina, onlineVrienden, vrienden as parenVrienden } from './paren.js?v=1'

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
let relayCheck = null        // belofte: relay-detectie klaar (v106)
let eigenKlaar = false       // ik heb alles van de vriend (v106)
let anderKlaar = false       // de vriend heeft alles van mij (v106)
// v112: de video van een vriend wordt pas opgehaald als iemand hem wil zien
let videoVraag = null        // { vriendId, opVoortgang, resolve, reject, timer }
let voorkeurVriend = null    // met deze vriend eerst verbinden (voor een videovraag)
let manifestVan = null       // van welke vriend het laatste manifest binnenkwam
let laatsteVideoHash = null  // video volgens dat manifest (null = geen video)

// ── Rust na relay-sync (v106): via TURN kost elke sync tegoed. Is alles aan beide
// kanten up-to-date, dan wordt de relay-verbinding gesloten en start sync met die
// vriend een kwartier niet opnieuw. Directe verbindingen merken hier niets van.
const RELAY_RUST_MS = 15 * 60 * 1000
function rustSleutel(id) { return 'fibro_relay_rust_' + huidigeUserId + '_' + id }
function inRust(id) {
  try { return Date.now() - Number(localStorage.getItem(rustSleutel(id)) || 0) < RELAY_RUST_MS }
  catch (e) { return false }
}
// -- Herstel na mislukte verbinding (v107): mislukt een sync-verbinding, dan stopt
// sync netjes en probeert het later opnieuw, met een pauze die steeds langer wordt
// (30 s, 1, 2, 4, max 5 min; v116). Bewaard per account en vriend, zodat een
// paginawissel de pauze niet opheft. Een gelukte verbinding wist de pauze.
// v116: komt de app weer in beeld of het netwerk terug, dan vervalt de pauze (zie wekSync).
function pauzeSleutel(id) { return 'fibro_sync_pauze_' + huidigeUserId + '_' + id }
function leesPauze(id) {
  try { const p = JSON.parse(localStorage.getItem(pauzeSleutel(id)) || 'null'); return p && typeof p === 'object' ? p : null }
  catch (e) { return null }
}
function inPauze(id) { const p = leesPauze(id); return !!p && Date.now() < Number(p.tot || 0) }
function wisPauze(id) { try { localStorage.removeItem(pauzeSleutel(id)) } catch (e) {} }
let pauzeTimer = null
function mislukking(id, reden) {
  if (!id) return
  const n = Math.min(10, (Number((leesPauze(id) || {}).n) || 0) + 1)
  const ms = Math.min(5 * 60 * 1000, 30000 * Math.pow(2, n - 1))
  try { localStorage.setItem(pauzeSleutel(id), JSON.stringify({ n, tot: Date.now() + ms })) } catch (e) {}
  console.log('[sync] ' + reden + ' - nieuwe poging met deze vriend over ' + Math.round(ms / 1000) + ' s')
  planPauze()
}
// Wekker voor het einde van de eerstvolgende pauze van een online vriend (ook na een paginawissel)
function planPauze() {
  clearTimeout(pauzeTimer)
  pauzeTimer = null
  let eerst = Infinity
  for (const id of onlineGebruikers) {
    if (!vrienden.has(id) || inRust(id) || !inPauze(id)) continue
    eerst = Math.min(eerst, Number(leesPauze(id).tot))
  }
  if (eerst === Infinity) return
  pauzeTimer = setTimeout(() => { pauzeTimer = null; checkSyncStart() }, Math.max(0, eerst - Date.now()) + 100)
}

// -- Wekken (v116): komt de app weer in beeld (na minstens 10 s weg) of komt het
// netwerk terug, dan meteen opnieuw proberen in plaats van de pauze uit te zitten.
// Het aantal mislukkingen blijft staan: mislukt het weer, dan loopt de pauze verder op.
const WEK_NA_VERBORGEN_MS = 10000
let verborgenSinds = 0
function wekSync(reden) {
  if (!heeftSlot || !huidigeUserId) return
  let opgeheven = 0
  for (const id of vrienden) {
    const p = leesPauze(id)
    if (!p || Date.now() >= Number(p.tot || 0)) continue
    try { localStorage.setItem(pauzeSleutel(id), JSON.stringify({ n: Number(p.n) || 0, tot: 0 })) } catch (e) {}
    opgeheven++
  }
  console.log('[sync] ' + reden + (opgeheven ? ' - pauze opgeheven voor ' + opgeheven + ' vriend(en)' : ''))
  const pc = peerConnection
  if (pc && pc._wasVerbonden && (pc.connectionState === 'disconnected' || pc.connectionState === 'failed')) verbindingHapert(pc)
  checkSyncStart()
}
function luisterNaarWekkers() {
  window.addEventListener('online', () => wekSync('Netwerk terug'))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { verborgenSinds = Date.now(); return }
    const weg = verborgenSinds ? Date.now() - verborgenSinds : 0
    verborgenSinds = 0
    if (weg >= WEK_NA_VERBORGEN_MS) wekSync('App weer in beeld')
  })
}

// -- Herstel van een weggevallen verbinding (v116): eerst een ICE-restart op dezelfde
// verbinding (het datakanaal blijft bestaan, een video-overdracht loopt door). Alleen de
// initiatiefnemer start die; de ander vraagt erom met 'herstart-vraag'. Lukt het niet
// binnen 15 s (of heeft de vriend nog een oude sync.js), dan helemaal opnieuw zoals voorheen.
const HERSTART_MS = 15000
let herstartTimer = null
let herstartPogingen = 0
function verbindingHapert(pc) {
  if (pc !== peerConnection || !pc._wasVerbonden || herstartTimer) return
  if (herstartPogingen >= 2) { volledigOpnieuw('Herstel lukt niet'); return }
  herstartPogingen++
  console.log('[sync] Verbinding hapert - ICE-restart (poging ' + herstartPogingen + ')')
  zetP2pStatus('herstellen...')
  herstartTimer = setTimeout(() => {
    herstartTimer = null
    if (pc !== peerConnection || pc.connectionState === 'connected') return
    volledigOpnieuw('ICE-restart lukte niet binnen ' + (HERSTART_MS / 1000) + ' s')
  }, HERSTART_MS)
  if (isInitiator) doeIceRestart(pc)
  else stuurSignaal('herstart-vraag').catch(() => {})
}
function volledigOpnieuw(reden) {
  console.log('[sync] ' + reden + ' - sync opnieuw')
  stopSync()
  setTimeout(checkSyncStart, 1000)
}
async function doeIceRestart(pc) {
  try {
    if (pc !== peerConnection || pc.signalingState === 'closed') return
    if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
      // vorige restart nog niet beantwoord: hetzelfde offer nog eens sturen
      await stuurSignaal('herstart', pc.localDescription)
      return
    }
    if (pc.signalingState !== 'stable') return
    const offer = await pc.createOffer({ iceRestart: true })
    if (pc !== peerConnection) return
    await pc.setLocalDescription(offer)
    await stuurSignaal('herstart', pc.localDescription)
  } catch (e) { console.log('[sync] ICE-restart fout:', e && e.message) }
}
function dtlsVingerafdruk(sdp) {
  const m = /a=fingerprint:(\S+ \S+)/.exec(typeof sdp === 'string' ? sdp : '')
  return m ? m[1].toLowerCase() : null
}

function controleerRust() {
  if (!eigenKlaar || !anderKlaar || !isRelayConnection || !syncPartnerId) return
  const partner = syncPartnerId
  try { localStorage.setItem(rustSleutel(partner), String(Date.now())) } catch (e) {}
  console.log('[sync] Relay-sync compleet - verbinding dicht, 15 min rust met', partner)
  setTimeout(() => { if (syncPartnerId === partner) stopSync() }, 2000)
}

// ── Tabblad-slot: maar één tabblad mag de sync draaien ──
const SLOT_SLEUTEL = 'fibro_sync_slot'
const SLOT_ID = Math.random().toString(36).slice(2)
let slotTimer = null
let heeftSlot = false

function slotProberen() {
  try {
    const nu = Date.now()
    const ruw = localStorage.getItem(SLOT_SLEUTEL)
    const huidig = ruw ? JSON.parse(ruw) : null
    if (!huidig || huidig.id === SLOT_ID || nu - huidig.tijd > 8000) {
      localStorage.setItem(SLOT_SLEUTEL, JSON.stringify({ id: SLOT_ID, tijd: nu }))
      return true
    }
    return false
  } catch (e) { return true }
}

function slotVrijgeven() {
  try {
    const ruw = localStorage.getItem(SLOT_SLEUTEL)
    if (ruw && JSON.parse(ruw).id === SLOT_ID) localStorage.removeItem(SLOT_SLEUTEL)
  } catch (e) {}
}

// ICE_SERVERS komt uit ice-config.js (import staat bovenaan)

export function initSync(userId, callbacks = {}) {
  huidigeUserId = userId
  onOnlineChangeCallback = callbacks.onOnlineChange || null
  window.addEventListener('pagehide', slotVrijgeven)
  luisterNaarWekkers()
  slotTimer = setInterval(() => {
    const nu = slotProberen()
    if (nu && !heeftSlot) {
      heeftSlot = true
      console.log('[sync] Slot verkregen - sync actief in dit tabblad (v121)')
      laadVrienden().then(() => startPresence())
    } else if (!nu && heeftSlot) {
      heeftSlot = false
      console.log('[sync] Slot verloren - sync gestopt')
    }
  }, 3000)
  if (slotProberen()) {
    heeftSlot = true
    console.log('[sync] Slot verkregen - sync actief in dit tabblad (v121)')
    laadVrienden().then(() => startPresence())
  } else {
    console.log('[sync] Ander tabblad heeft de sync - dit tabblad wacht')
  }
}

// v121 (stap B deel 4): wie er online is, komt uit paren.js: per vriend een afgeschermd
// kanaal (paar_<a>_<b>, private), gedeeld met p2pfoto.js en meldingen.js. Het oude
// openbare kanaal fibro-online is weg: alleen vrienden zien nog dat je online bent.
let presenceBezig = false
function startPresence() {
  if (presenceBezig) { console.log('[sync] Presence al bezig - dubbele start genegeerd'); return }
  presenceBezig = true
  opOnline(onlineVeranderd)
  opNieuwePagina(vriendNieuwePagina)
  onlineVeranderd()
}

function onlineVeranderd() {
  vrienden = new Set(parenVrienden())
  const nu = new Set(onlineVrienden())
  const anders = nu.size !== onlineGebruikers.size || [...nu].some((id) => !onlineGebruikers.has(id))
  onlineGebruikers = nu
  if (anders) {
    console.log('[sync] Online vrienden:', [...onlineGebruikers])
    if (onOnlineChangeCallback) onOnlineChangeCallback([...onlineGebruikers])
    toonDebugBadge()
  }
  if (syncPartnerId && !onlineGebruikers.has(syncPartnerId)) stopSync()
  checkSyncStart()
}

// v107: de vriend opende een nieuwe pagina terwijl wij nog aan zijn oude pagina hingen
// (zelfde naam, dus geen 'weg'-melding). Opnieuw beginnen; de online-melding die hierna
// komt (paren.js), start de sync weer.
function vriendNieuwePagina(id) {
  if (id && id === syncPartnerId && !(dataChannel && dataChannel.readyState === 'open')) {
    console.log('[sync] Vriend opnieuw online - sync opnieuw')
    stopSync()
  }
}

async function laadVrienden() {
  vrienden = new Set(await startParen(huidigeUserId))
  console.log('[sync] Vrienden geladen:', vrienden.size)
}

function checkSyncStart() {
  if (syncPartnerId) return
  const kan = (id) => vrienden.has(id) && !inRust(id) && !inPauze(id)
  const ander = (voorkeurVriend && onlineGebruikers.has(voorkeurVriend) && kan(voorkeurVriend))
    ? voorkeurVriend
    : [...onlineGebruikers].find(kan)
  if (!ander) { planPauze(); return }
  syncPartnerId = ander
  isInitiator = huidigeUserId < ander
  console.log('[sync] Start sync met', ander, '- initiator:', isInitiator)
  zetP2pStatus('verbinden...')
  openSyncKanaal(ander).catch((e) => console.log('[sync] Synckanaal openen mislukt:', e && e.message))
}

// v121: het synckanaal is afgeschermd (private): alleen jij en die vriend kunnen erin.
// Een kanaal met dezelfde naam dat nog aan het sluiten is, eerst helemaal laten sluiten:
// anders geeft supabase.channel() dat sluitende kanaal terug en gaat het nooit open
// (zelfde les als bellen.js). Is het kanaal na 15 s niet open (bijv. geweigerd), dan
// stopt deze poging en volgt later een nieuwe.
const KANAAL_OPEN_MS = 15000
let kanaalPoging = 0
let kanaalTimer = null
async function openSyncKanaal(anderId) {
  const poging = ++kanaalPoging
  const ids = [huidigeUserId, anderId].sort()
  const naam = 'syncdata_' + ids[0] + '_' + ids[1]
  for (const k of supabase.getChannels()) {
    if (k.topic === 'realtime:' + naam) await Promise.race([supabase.removeChannel(k), new Promise((r) => setTimeout(r, 3000))])
  }
  if (poging !== kanaalPoging || syncPartnerId !== anderId) return
  clearTimeout(kanaalTimer)
  kanaalTimer = setTimeout(() => {
    if (poging !== kanaalPoging || syncPartnerId !== anderId) return
    stopSync()
    mislukking(anderId, 'Synckanaal niet open binnen ' + (KANAAL_OPEN_MS / 1000) + ' s')
  }, KANAAL_OPEN_MS)
  syncKanaal = supabase
    .channel(naam, { config: { broadcast: { self: false }, private: true } })
    .on('broadcast', { event: 'signaal' }, (msg) => {
      verwerkSignaal(msg.payload.type, msg.payload.data)
    })
    .subscribe((status, fout) => {
      console.log('[sync] Synckanaal status:', status)
      if (poging !== kanaalPoging) return
      if (status === 'CHANNEL_ERROR' && /unauthori[sz]ed|permission/i.test(String((fout && fout.message) || fout || ''))) {
        // geweigerd (bijv. geen vrienden meer): niet blijven proberen, later opnieuw
        stopSync()
        mislukking(anderId, 'Synckanaal geweigerd')
        return
      }
      if (status === 'SUBSCRIBED') clearTimeout(kanaalTimer)
      if (status === 'SUBSCRIBED' && isInitiator) {
        offerRetryCount = 0
        startOfferRetry()
        syncTimeout = setTimeout(() => {
          console.log('[sync] Sync timeout — geen answer na 30 sec')
          const partner = syncPartnerId
          stopSync()
          mislukking(partner, 'Geen antwoord')
        }, 30000)
      }
    })
}

function startOfferRetry() {
  if (offerRetryCount >= 5) {
    console.log('[sync] Offer retries uitgeput')
    const partner = syncPartnerId
    stopSync()
    mislukking(partner, 'Geen antwoord')
    return
  }
  offerRetryCount++
  console.log('[sync] Offer poging', offerRetryCount, '/ 5')
  if (offerRetryCount === 1 || !peerConnection) {
    // Eerste poging: maak connectie + offer
    maakEnStuurOffer()
  } else if (peerConnection.localDescription) {
    // RACE-FIX (bug #3): bij retry NIET een nieuwe RTCPeerConnection maken,
    // maar hetzelfde offer opnieuw sturen. Nieuwe connecties per retry
    // veroorzaakten lekkende connecties, stale ICE-candidates en een
    // ontvanger die zijn (soms al werkende) verbinding weggooide.
    stuurSignaal('offer', peerConnection.localDescription)
  }
  offerRetryTimer = setTimeout(startOfferRetry, 5000)
}

async function stuurSignaal(type, data = {}) {
  if (!syncKanaal) return
  await syncKanaal.send({ type: 'broadcast', event: 'signaal', payload: { type, data } })
}

function maakPeerConnection() {
  // Oude connectie netjes sluiten — voorkomt lekken en stale ICE-events (bug #3)
  if (peerConnection) {
    peerConnection.onicecandidate = null
    peerConnection.ondatachannel = null
    peerConnection.onconnectionstatechange = null
    peerConnection.oniceconnectionstatechange = null
    peerConnection.onicecandidateerror = null
    peerConnection.close()
    peerConnection = null
    dataChannel = null
  }
  peerConnection = new RTCPeerConnection(ICE_SERVERS)
  iceBuffer = []
  const pc = peerConnection
  pc.onicecandidate = (event) => {
    // Alleen candidates van de HUIDIGE connectie doorsturen
    if (pc !== peerConnection) return
    if (event.candidate) stuurSignaal('ice', event.candidate)
  }
  pc.ondatachannel = (event) => {
    if (pc !== peerConnection) return
    koppelDataChannel(event.channel)
  }
  pc.onconnectionstatechange = () => {
    if (pc !== peerConnection) return
    console.log('[sync] Verbinding:', pc.connectionState)
    if (pc.connectionState === 'connected') {
      if (pc._wasVerbonden && herstartTimer) console.log('[sync] Verbinding hersteld (ICE-restart)')
      pc._wasVerbonden = true
      clearTimeout(herstartTimer)
      herstartTimer = null
      herstartPogingen = 0
      if (syncPartnerId) wisPauze(syncPartnerId)
    }
    if (pc.connectionState === 'disconnected' && pc._wasVerbonden) {
      // v116: 'disconnected' herstelt zich vaak vanzelf; pas na 3 s ingrijpen
      setTimeout(() => { if (pc === peerConnection && pc.connectionState === 'disconnected') verbindingHapert(pc) }, 3000)
    }
    if (pc.connectionState === 'failed') {
      zetP2pStatus('P2P mislukt')
      // v107: niet blijven hangen aan een mislukte verbinding
      const partner = syncPartnerId
      if (pc._wasVerbonden) {
        // werkte eerst wel: v116 eerst herstellen (ICE-restart), anders opnieuw zonder pauze
        verbindingHapert(pc)
        return
      }
      logKandidaten(pc).finally(() => {
        if (pc !== peerConnection) return
        stopSync()
        mislukking(partner, 'Verbinding mislukt')
      })
    }
  }
  const iceFouten = new Set()
  pc.onicecandidateerror = (e) => {
    if (pc !== peerConnection) return
    const sleutel = (e.url || '?') + ' ' + e.errorCode
    if (iceFouten.has(sleutel)) return
    iceFouten.add(sleutel)
    console.log('[sync] ICE-serverfout:', e.url || '?', e.errorCode, e.errorText || '')
  }
  pc.oniceconnectionstatechange = () => {
    if (pc !== peerConnection) return
    console.log('[sync] ICE-status:', pc.iceConnectionState)
  }
}

function koppelDataChannel(kanaal) {
  dataChannel = kanaal
  dataChannel.onopen = async () => {
    console.log('[sync] DataChannel OPEN')
    zetP2pStatus('P2P open')
    // Detecteer TURN/relay verbinding
    eigenKlaar = false
    anderKlaar = false
    relayCheck = detecteerRelayConnection()
    await relayCheck
    // v107: verbinding kan tussendoor wegvallen; dan geen rode fout in de console
    stuurManifest().catch(e => console.log('[sync] Manifest afgebroken (verbinding weg):', e && e.message))
  }
  dataChannel.onmessage = (event) => {
    // VALIDATIE (bug #5): nooit blind parsen/vertrouwen wat de peer stuurt
    if (typeof event.data !== 'string' || event.data.length > 256 * 1024) {
      console.warn('[sync] P2P bericht geweigerd: geen string of te groot')
      return
    }
    let bericht
    try { bericht = JSON.parse(event.data) }
    catch(e) { console.warn('[sync] P2P bericht geweigerd: ongeldige JSON'); return }
    if (!bericht || typeof bericht !== 'object' || typeof bericht.type !== 'string') return
    if (!['manifest', 'geef', 'chunk', 'item', 'klaar'].includes(bericht.type)) {
      console.warn('[sync] P2P bericht geweigerd: onbekend type', bericht.type)
      return
    }
    console.log('[sync] P2P bericht:', bericht.type)
    verwerkP2pBericht(bericht).catch(e => console.log('[sync] Verwerken afgebroken (verbinding weg):', e && e.message))
  }
  dataChannel.onclose = () => {
    zetP2pStatus('')
    // v107: de andere kant sloot de verbinding (bijv. paginawissel): opnieuw beginnen
    if (dataChannel !== kanaal || !syncPartnerId) return
    console.log('[sync] DataChannel dicht - sync opnieuw')
    stopSync()
    setTimeout(checkSyncStart, 1000)
  }
}

// v107: bij een mislukte verbinding laten zien welke soorten adressen geprobeerd zijn
// (zonder de adressen zelf)
function soortAdres(a) {
  if (!a) return 'verborgen'
  if (/\.local$/i.test(a)) return 'mdns'
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|127\.)/.test(a)) return 'prive'
  if (/^(fe80:|f[cd][0-9a-f]{2}:)/i.test(a)) return 'prive6'
  if (a.includes(':')) return 'openbaar6'
  return 'openbaar'
}

async function logKandidaten(pc) {
  try {
    const stats = await pc.getStats()
    const lokaal = {}, remote = {}, paren = {}
    stats.forEach(r => {
      if (r.type === 'local-candidate' || r.type === 'remote-candidate') {
        const k = (r.candidateType || '?') + '/' + soortAdres(r.address || r.ip) + '/' + (r.relayProtocol || r.protocol || '?')
        const doel = r.type === 'local-candidate' ? lokaal : remote
        doel[k] = (doel[k] || 0) + 1
      } else if (r.type === 'candidate-pair') {
        const st = r.state || '?'
        paren[st] = (paren[st] || 0) + 1
      }
    })
    const tekst = o => Object.entries(o).map(([k, n]) => k + ' x' + n).join(', ') || 'geen'
    const servers = (ICE_SERVERS.iceServers || []).map(s => [].concat(s.urls).join(' ')).join(', ')
    console.log('[sync] ICE-servers: ' + servers)
    console.log('[sync] Kandidaten lokaal: ' + tekst(lokaal))
    console.log('[sync] Kandidaten remote: ' + tekst(remote))
    console.log('[sync] Paren: ' + tekst(paren))
  } catch (e) { console.warn('[sync] Kandidaten-log fout:', e) }
}

async function detecteerRelayConnection() {
  if (!peerConnection) return
  try {
    const stats = await peerConnection.getStats()
    let relayGebruikt = false
    let selectedPairId = null
    // Stap 1: vind het GESELECTEERDE candidate-pair (via transport)
    stats.forEach(report => {
      if (report.type === 'transport' && report.selectedCandidatePairId) {
        selectedPairId = report.selectedCandidatePairId
      }
    })
    // Fallback (Firefox): pair met selected=true of nominated+succeeded
    stats.forEach(report => {
      if (report.type === 'candidate-pair') {
        if (report.selected === true) selectedPairId = report.id
        else if (!selectedPairId && report.nominated && report.state === 'succeeded') selectedPairId = report.id
      }
    })
    // Stap 2: check ALLEEN dat pair op relay
    if (selectedPairId) {
      const pair = stats.get(selectedPairId)
      if (pair) {
        const localCandidate = stats.get(pair.localCandidateId)
        const remoteCandidate = stats.get(pair.remoteCandidateId)
        if (localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay') {
          relayGebruikt = true
          console.log('[sync] RELAY VERBINDING GEDETECTEERD — muziek en video worden overgeslagen')
        } else {
          console.log('[sync] Directe P2P-verbinding (' + (localCandidate?.candidateType || '?') + ') — muziek toegestaan')
        }
      }
    } else {
      console.log('[sync] Geen geselecteerd pair gevonden — muziek toegestaan (voordeel van de twijfel)')
    }
    // Via relay (TURN) nooit muziek of video, ook niet met Fibro+ (v106): dat kost te veel TURN-tegoed
    isRelayConnection = relayGebruikt
    if (isRelayConnection) {
      console.log('[sync] STATUS: relay -> geen muziek en video')
      zetP2pStatus('⚠️ relay-verbinding (muziek en video overgeslagen)')
    }
    else {
      console.log('[sync] STATUS: directe verbinding -> geen beperking')
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

async function verzamelEigenFotos() {
  // Foto's van de home-widgets staan in localStorage als pfoto_<stijl>_<idx>_<uid>
  // itemId = key ZONDER uid-suffix, zodat de ontvanger apparaat-onafhankelijke ids cachet
  const fotos = {}
  const suffix = '_' + huidigeUserId
  const keys = await dbListKeys('pfoto_')
  for (const key of keys) {
    if (!key.endsWith(suffix) || key.includes('_fit_')) continue
    const rec = await dbGet(key)
    const data = rec && rec.data
    if (data && typeof data === 'string' && data.startsWith('data:image')) {
      const itemId = key.slice(0, -suffix.length)
      fotos[itemId] = { hash: hashString(data) }
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
      muziek['profiel'] = { hash: hashString(track1) }
      console.log('[sync] Systeem 1 (profiel-muziek) gevonden')
    }
  } catch(e) { console.warn('[sync] Systeem 1 muziek-ophalen fout:', e) }

  // ── Systeem 2: playlist (index.html widget) ──
  try {
    const idxKey = 'muziek_index_' + huidigeUserId
    const idxRes = await dbGet(idxKey)
    if (idxRes?.data) {
      muziek['index'] = { hash: hashString(idxRes.data) }
      let lijst = []
      try { lijst = JSON.parse(idxRes.data) || [] } catch(e) {}
      for (let i = 0; i < lijst.length; i++) {
        const tr = await dbGet('muziek_nr_' + huidigeUserId + '_' + i)
        if (tr?.data) muziek['nr' + i] = { hash: hashString(tr.data) }
      }
      console.log('[sync] Muziek gevonden:', lijst.length, 'nummers (los)')
    }
  } catch(e) { console.warn('[sync] Systeem 2 muziek-ophalen fout:', e) }

  return muziek
}

const WBG_WIDGETS = ['poll', 'quote', 'aftel', 'optel']
        const wbgPosWacht = {}

// v112: controlegetal van de eigen video onthouden bij dat van de video-info, zodat de
// hele video niet bij elke verbinding opnieuw ingelezen en doorgerekend hoeft te worden
async function eigenVideoHash(metaHash) {
  const sl = 'fibro_videohash_' + huidigeUserId
  try {
    const c = JSON.parse(localStorage.getItem(sl) || 'null')
    if (c && c.meta === metaHash && typeof c.data === 'string') return c.data
  } catch (e) {}
  const vd = await dbGet('video_data_' + huidigeUserId)
  if (!vd?.data) return null
  const h = hashString(vd.data)
  try { localStorage.setItem(sl, JSON.stringify({ meta: metaHash, data: h })) } catch (e) {}
  return h
}

        async function stuurManifest() {
  const layoutJson = localStorage.getItem('fibro_widgets_profiel_' + huidigeUserId) || '[]'
  const fotos = await verzamelEigenFotos()
  const muziek = await verzamelEigenMuziek()
  // Weergavenaam reist mee over P2P: hij staat bewust niet op de server.
  let eigenNaam = ''
  try { eigenNaam = String(JSON.parse(localStorage.getItem('fibro_profiel_' + huidigeUserId) || '{}').naam || '').slice(0, 40) } catch(e) {}
  let videoMetaHash = null
  try {
    const vm = await dbGet('video_meta_' + huidigeUserId)
    if (vm?.data) videoMetaHash = hashString(vm.data)
  } catch(e) {}
  let videoHash = null
  try { if (videoMetaHash) videoHash = await eigenVideoHash(videoMetaHash) } catch(e) {}
  // Kleine tekstwidgets: quote, afteltimer, opteltimer
  const klein = {}
  for (const [sl, key] of [['quote','quote_'],['aftel','aftel_'],['optel','optel_'],['poll','poll_']]) {
    try {
      const w = localStorage.getItem(key + huidigeUserId)
      if (w) klein[sl] = hashString(w)
    } catch(e) {}
  }
  // Achtergrondfoto's achter tekstwidgets (v79)
                    // Blokstijl: kleur, doorzichtigheid en hoeken (v80). Kantelen blijft lokaal.
          let eigenBlokstijl = null
          try {
              const r = JSON.parse(localStorage.getItem('fibro_blokstijl') || '{}') || {}
              const kleur = /^#[0-9a-fA-F]{6}$/.test(r.kleur) ? r.kleur : '#ffffff'
              const d = Number(r.doorzicht), h = Number(r.hoek)
              const doorzicht = r.doorzicht != null && r.doorzicht !== '' && Number.isFinite(d) ? d : 12
              const hoek = r.hoek != null && r.hoek !== '' && Number.isFinite(h) ? h : 14
              eigenBlokstijl = { kleur, doorzicht, hoek }
          } catch (e) {}
          const wbg = {}
                    for (const sl of WBG_WIDGETS) {
                        try {
                            const rec = await dbGet('widgetbg_' + sl + '_' + huidigeUserId)
                            const d = rec && rec.data
                            if (typeof d === 'string' && d.startsWith('data:image')) {
                                const pos = (localStorage.getItem('widgetbgpos_widgetbg_' + sl + '_' + huidigeUserId) || '').slice(0, 200)
                                wbg[sl] = { hash: hashString(d), pos }
                            }
                        } catch (e) {}
                    }
                    const manifest = {
    layout: { hash: hashString(layoutJson) },
    fotos,
    muziek,
    videoMetaHash,
    videoHash,
    klein,
    wbg,
                                blokstijl: eigenBlokstijl,
          naam: eigenNaam
  }
  dataChannel.send(JSON.stringify({ type: 'manifest', data: manifest }))
  zetP2pStatus('manifest gestuurd')
}

async function verwerkP2pBericht(bericht) {
  if (relayCheck) await relayCheck // eerst weten of het via relay gaat (v106)
  if (bericht.type === 'klaar') {
    anderKlaar = true
    controleerRust()
    return
  }
  if (bericht.type === 'manifest') {
    let videoNodig = false
    // Naam van de vriend lokaal bewaren; laatste verbinding is leidend.
    try {
      const binnen = String(bericht.data?.naam || '').slice(0, 40).trim()
      const sleutel = 'vriend_naam_' + syncPartnerId + '_' + huidigeUserId
      // Alleen een echte naam overschrijft; een leeg veld laat de
      // bestaande naam met rust.
      if (binnen) localStorage.setItem(sleutel, binnen)
    } catch(e) { console.warn('[sync] naam opslaan mislukt', e) }
    let videoMetaNodig = false
    try {
      if (bericht.data.videoMetaHash) {
        const vm = await dbGet('vriend_' + syncPartnerId + '_video_meta')
        if (!vm || vm.hash !== bericht.data.videoMetaHash) videoMetaNodig = true
      }
    } catch(e) {}
    try {
      if (bericht.data.videoHash) {
        const vCached = await dbGet('vriend_' + syncPartnerId + '_video_data')
        if (!vCached || vCached.hash !== bericht.data.videoHash) videoNodig = true
      }
    } catch(e) {}
    const cached = await dbGet('vriend_' + syncPartnerId + '_layout')
    const nodig = []
    if (!cached || cached.hash !== bericht.data.layout.hash) nodig.push('layout')
    const fotos = bericht.data.fotos || {}
    for (const itemId of Object.keys(fotos)) {
      const fCached = await dbGet('vriend_' + syncPartnerId + '_foto_' + itemId)
      if (!fCached || fCached.hash !== fotos[itemId].hash) nodig.push('foto:' + itemId)
    }
    // Achtergrondfoto's achter tekstwidgets (v79)
                                // Blokstijl van de vriend (v80): streng controleren, dan bewaren
    try {
        const bs = bericht.data.blokstijl
        if (bs && typeof bs === 'object') {
            const kleur = typeof bs.kleur === 'string' && /^#[0-9a-fA-F]{6}$/.test(bs.kleur) ? bs.kleur : null
            const d = Number(bs.doorzicht), h = Number(bs.hoek)
            const doorzicht = Number.isFinite(d) ? Math.max(0, Math.min(100, Math.round(d))) : null
            const hoek = Number.isFinite(h) ? Math.max(0, Math.min(50, Math.round(h))) : null
            if (kleur !== null && doorzicht !== null && hoek !== null) {
                const json = JSON.stringify({ kleur, doorzicht, hoek })
                const bKey = 'vriend_' + syncPartnerId + '_blokstijl'
                const bCached = await dbGet(bKey)
                const bHash = hashString(json)
                if (!bCached || bCached.hash !== bHash) {
                    await dbPut({ id: bKey, hash: bHash, data: json, ontvangen: Date.now() })
                    console.log('[sync] Blokstijl van vriend bijgewerkt:', json)
                }
            }
        }
    } catch (e) { console.warn('[sync] blokstijl verwerken mislukt', e) }
    if (bericht.data.wbg && typeof bericht.data.wbg === 'object') {
                                    for (const sl of WBG_WIDGETS) {
                                        const wKey = 'vriend_' + syncPartnerId + '_wbg_' + sl
                                        const binnenW = bericht.data.wbg[sl]
                                        const wCached = await dbGet(wKey)
                                        if (!binnenW || typeof binnenW.hash !== 'string') {
                                            if (wCached) { await dbDelete(wKey); console.log('[sync] Achtergrond verwijderd bij vriend:', sl) }
                                            continue
                                        }
                                        const wPos = typeof binnenW.pos === 'string' ? binnenW.pos.slice(0, 200) : ''
                                        if (!wCached || wCached.hash !== binnenW.hash) {
                                            wbgPosWacht[sl] = wPos
                                            nodig.push('wbg:' + sl)
                                        } else if (wCached.pos !== wPos) {
                                            await dbPut({ ...wCached, pos: wPos })
                                        }
                                    }
                                }
                                const muziek = bericht.data.muziek || {}
    const muziekNodig = []
    for (const itemId of Object.keys(muziek)) {
      const mCached = await dbGet('vriend_' + syncPartnerId + '_muziek_' + itemId)
      if (!mCached || mCached.hash !== muziek[itemId].hash) muziekNodig.push('muziek:' + itemId)
    }
    if (muziekNodig.length && !isRelayConnection) {
      nodig.push(...muziekNodig)
    } else if (muziekNodig.length && isRelayConnection) {
      console.log('[sync] Relay-verbinding - muziek overgeslagen (geen Fibro+)')
      zetP2pStatus('muziek niet opgehaald (relay)')
      window._muziekGeblokkeerdDoorRelay = true
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
    for (const key of muziekKeys) {
      const itemId = key.slice(muziekPrefix.length)
      if (!muziek[itemId]) {
        await dbDelete(key)
        console.log('[sync] Verouderde muziek verwijderd:', key)
        zetP2pStatus('oude muziek opgeruimd')
      }
    }

    // Kleine tekstwidgets
    const klein = bericht.data.klein || {}
    for (const sl of Object.keys(klein)) {
      if (!['quote','aftel','optel','poll'].includes(sl)) continue
      const kc = await dbGet('vriend_' + syncPartnerId + '_' + sl)
      if (!kc || kc.hash !== klein[sl]) nodig.push('klein:' + sl)
    }
    if (videoMetaNodig) nodig.push('videometa')
    // v112: de video zelf alleen ophalen als iemand hem wil zien (vraagVriendVideo).
    // Heeft de vriend geen video meer, of een andere, dan de oude hier weggooien.
    manifestVan = syncPartnerId
    laatsteVideoHash = bericht.data.videoHash || null
    try {
      if (!bericht.data.videoMetaHash) await dbDelete('vriend_' + syncPartnerId + '_video_meta')
      if (videoNodig || !bericht.data.videoHash) await dbDelete('vriend_' + syncPartnerId + '_video_data')
    } catch (e) {}
    if (videoVraag && videoVraag.vriendId === syncPartnerId) {
      if (isRelayConnection) videoVraagFout('relay')
      else if (!laatsteVideoHash) videoVraagFout('geen-video')
      else if (videoNodig) nodig.push('video')
      else videoVraagKlaar()
    }
    if (nodig.length) {
      dataChannel.send(JSON.stringify({ type: 'geef', items: nodig }))
      zetP2pStatus('vraag ' + nodig.length + ' item(s)')
    } else {
      zetP2pStatus('alles up-to-date')
      eigenKlaar = true
      try { dataChannel.send(JSON.stringify({ type: 'klaar' })) } catch (e) {}
      controleerRust()
    }
  }
  if (bericht.type === 'geef') {
    // VALIDATIE (bug #5): items moet een lijst van bekende, korte strings zijn
    if (!Array.isArray(bericht.items) || bericht.items.length > 300) return
    for (const item of bericht.items) {
      if (typeof item !== 'string' || item.length > 200) continue
      // Ook als verzender: via relay geen muziek of video (v106), wat de ander ook vraagt
      if (isRelayConnection && (item.startsWith('muziek:') || item === 'video')) {
        console.log('[sync] Relay-verbinding - niet verstuurd:', item)
        continue
      }
      if (item === 'layout') {
        const layoutJson = localStorage.getItem('fibro_widgets_profiel_' + huidigeUserId) || '[]'
        dataChannel.send(JSON.stringify({ type: 'item', itemId: 'layout', hash: hashString(layoutJson), data: layoutJson }))
      } else if (item.startsWith('foto:')) {
        const itemId = item.slice(5)
        await stuurFotoInChunks(itemId)
                    } else if (item.startsWith('wbg:')) {
                        await stuurWbgInChunks(item.slice(4))
      } else if (item.startsWith('muziek:')) {
        const itemId = item.slice(7)
        await stuurMuziekInChunks(itemId)
      } else if (item.startsWith('klein:')) {
        const sl = item.slice(6)
        if (!['quote','aftel','optel','poll'].includes(sl)) continue
        const key = sl + '_' + huidigeUserId
        const w = localStorage.getItem(key)
        if (w && w.length < 20000) {
          dataChannel.send(JSON.stringify({ type: 'item', itemId: 'klein_' + sl, hash: hashString(w), data: w }))
        }
      } else if (item === 'video') {
        await stuurVideoInChunks()
      } else if (item === 'videometa') {
        const vm = await dbGet('video_meta_' + huidigeUserId)
        if (vm?.data) {
          let vdHash = null
          try { vdHash = await eigenVideoHash(hashString(vm.data)) } catch(e) {}
          dataChannel.send(JSON.stringify({ type: 'item', itemId: 'videometa', hash: hashString(vm.data), dataHash: vdHash, data: vm.data }))
        }
      }
    }
  }
  if (bericht.type === 'chunk') {
    await verwerkChunk(bericht)
  }
  if (bericht.type === 'item') {
    // VALIDATIE (bug #5): alleen bekende itemIds, met size-cap
    if (typeof bericht.itemId !== 'string' || typeof bericht.data !== 'string') return
    if (typeof bericht.hash !== 'string' || bericht.hash.length > 16) return
    if (bericht.data.length > 5 * 1024 * 1024) { console.warn('[sync] item te groot — geweigerd'); return }
    if (bericht.itemId === 'layout') {
      await dbPut({ id: 'vriend_' + syncPartnerId + '_layout', hash: bericht.hash, data: bericht.data, ontvangen: Date.now() })
      console.log('[sync] Layout van vriend opgeslagen')
      zetP2pStatus('layout ontvangen \u2713')
    } else if (bericht.itemId.startsWith('muziek_')) {
      const muziekItemId = bericht.itemId.slice(7) // 'profiel' of 'playlist'
      await dbPut({ id: 'vriend_' + syncPartnerId + '_muziek_' + muziekItemId, hash: bericht.hash, data: bericht.data, ontvangen: Date.now() })
      console.log('[sync] Muziek van vriend opgeslagen:', muziekItemId)
      zetP2pStatus('muziek ' + muziekItemId + ' ontvangen \u2713')
    } else if (bericht.itemId.startsWith('klein_')) {
      const sl = bericht.itemId.slice(6)
      if (!['quote','aftel','optel','poll'].includes(sl)) return
      if (bericht.data.length > 20000) return
      await dbPut({ id: 'vriend_' + syncPartnerId + '_' + sl, hash: bericht.hash, data: bericht.data, ontvangen: Date.now() })
      console.log('[sync] Widget van vriend opgeslagen:', sl)
      zetP2pStatus(sl + ' ontvangen \u2713')
    } else if (bericht.itemId === 'videometa') {
      await dbPut({ id: 'vriend_' + syncPartnerId + '_video_meta', hash: bericht.hash, dataHash: bericht.dataHash || null, data: bericht.data, ontvangen: Date.now() })
      console.log('[sync] Video-info van vriend opgeslagen')
      zetP2pStatus('video-info ontvangen \u2713')
    }
  }
}

const CHUNK_TEKST = 12 * 1024 // 12KB tekst per chunk (dataURL is string; +JSON-overhead blijft ruim onder 16KB WebRTC-limiet)
const MAX_CHUNKS_PER_ITEM = 12000   // ± 140 MB max per item — ruim boven 75MB-limiet, blokkeert geheugen-bommen
const MAX_CHUNK_BUFFERS = 10        // max aantal items tegelijk in ontvangst
const chunkBuffers = {}             // { itemId: { delen:[], ontvangen:0, totaal:0, hash } }

function isGeldigeChunk(b) {
  // VALIDATIE (bug #5): alle velden checken vóór gebruik.
  // Zonder deze check kon een peer bijv. totaal=1e9 sturen → new Array(1e9) → crash
  if (typeof b.itemId !== 'string' || b.itemId.length > 200) return false
  if (!b.itemId.startsWith('pfoto_') && !b.itemId.startsWith('muziek_') && b.itemId !== 'video' && !/^widgetbg_(poll|quote|aftel|optel)$/.test(b.itemId)) return false
  if (typeof b.hash !== 'string' || b.hash.length > 16) return false
  if (!Number.isInteger(b.totaal) || b.totaal < 1 || b.totaal > MAX_CHUNKS_PER_ITEM) return false
  if (!Number.isInteger(b.volgnr) || b.volgnr < 0 || b.volgnr >= b.totaal) return false
  if (typeof b.data !== 'string' || b.data.length > CHUNK_TEKST * 2) return false
  return true
}

async function stuurFotoInChunks(itemId) {
  // VALIDATIE (bug #5): alleen echte foto-keys — anders kon een peer via
  // 'geef' willekeurige localStorage-keys opvragen (bijv. tokens)
  if (typeof itemId !== 'string' || !itemId.startsWith('pfoto_') || itemId.includes('_fit_')) {
    console.warn('[sync] foto-verzoek geweigerd:', itemId)
    return
  }
  const rec = await dbGet(itemId + '_' + huidigeUserId)
  const data = rec && rec.data
  if (!data) { console.warn('[sync] foto niet gevonden:', itemId); return }
  if (!data.startsWith('data:image')) { console.warn('[sync] geen afbeelding — niet verstuurd:', itemId); return }
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

async function stuurWbgInChunks(sl) {
                                    // Alleen de vier bekende widgets, nooit willekeurige keys (bug #5)
                                    if (!WBG_WIDGETS.includes(sl)) { console.warn('[sync] achtergrond-verzoek geweigerd:', sl); return }
                                    const itemId = 'widgetbg_' + sl
                                    const rec = await dbGet(itemId + '_' + huidigeUserId)
                                    const data = rec && rec.data
                                    if (typeof data !== 'string' || !data.startsWith('data:image')) { console.warn('[sync] achtergrond niet gevonden:', sl); return }
                                    const hash = hashString(data)
                                    const totaal = Math.ceil(data.length / CHUNK_TEKST)
                                    if (totaal > MAX_CHUNKS_PER_ITEM) { console.warn('[sync] achtergrond te groot:', sl); return }
                                    console.log('[sync] Stuur achtergrond', sl, 'in', totaal, 'chunks')
                                    for (let i = 0; i < totaal; i++) {
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
  // Alleen bekende namen toestaan (bug #5): oude systemen + nieuwe losse nummers
  if (itemId !== 'profiel' && itemId !== 'playlist' && itemId !== 'index' && !/^nr\d{1,4}$/.test(itemId)) {
    console.warn('[sync] muziek-verzoek geweigerd:', itemId)
    return
  }
  let data = null

  if (itemId === 'profiel') {
    // Systeem 1: muziek_track uit localStorage of IndexedDB
    data = localStorage.getItem('muziek_track')
    if (!data) {
      const dbResult = await dbGet('muziek_track')
      data = dbResult?.data
    }
  } else if (itemId === 'index') {
    const r = await dbGet('muziek_index_' + huidigeUserId)
    data = r?.data
  } else if (/^nr\d+$/.test(itemId)) {
    const r = await dbGet('muziek_nr_' + huidigeUserId + '_' + itemId.slice(2))
    data = r?.data
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

async function stuurVideoInChunks() {
  const r = await dbGet('video_data_' + huidigeUserId)
  const data = r?.data
  if (!data || typeof data !== 'string') { console.warn('[sync] video niet gevonden'); return }
  const hash = hashString(data)
  const totaal = Math.ceil(data.length / CHUNK_TEKST)
  console.log('[sync] Stuur video in', totaal, 'chunks')
  for (let i = 0; i < totaal; i++) {
    while (dataChannel.bufferedAmount > 512 * 1024) {
      await new Promise((r2) => setTimeout(r2, 20))
    }
    if (!dataChannel || dataChannel.readyState !== 'open') { console.warn('[sync] verbinding weg tijdens video'); return }
    dataChannel.send(JSON.stringify({
      type: 'chunk', itemId: 'video', hash, volgnr: i, totaal,
      data: data.slice(i * CHUNK_TEKST, (i + 1) * CHUNK_TEKST)
    }))
  }
}

async function verwerkChunk(bericht) {
  if (!isGeldigeChunk(bericht)) {
    console.warn('[sync] Ongeldige chunk geweigerd')
    return
  }
  const { itemId, hash, volgnr, totaal, data } = bericht
  if (!chunkBuffers[itemId] || chunkBuffers[itemId].hash !== hash) {
    // Cap op aantal gelijktijdige buffers — voorkomt geheugen-uitputting
    if (!chunkBuffers[itemId] && Object.keys(chunkBuffers).length >= MAX_CHUNK_BUFFERS) {
      console.warn('[sync] Te veel gelijktijdige chunk-buffers — chunk geweigerd')
      return
    }
    chunkBuffers[itemId] = { delen: new Array(totaal), ontvangen: 0, totaal, hash }
  }
  const buf = chunkBuffers[itemId]
  if (buf.totaal !== totaal) { console.warn('[sync] totaal-mismatch — chunk geweigerd'); return }
  if (buf.delen[volgnr] === undefined) {
    buf.delen[volgnr] = data
    buf.ontvangen++
  }
  if (itemId === 'video' && videoVraag && videoVraag.vriendId === syncPartnerId) {
    zetVideoTimer(30000) // zolang er stukjes binnenkomen, niet opgeven
    try { videoVraag.opVoortgang(buf.ontvangen / buf.totaal) } catch (e) {}
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
      if (itemId === 'video') videoVraagFout('fout')
      return
    }

    // Opslaan: bepaal de juiste key op basis van itemId
    let dbKey = itemId
    if (itemId.startsWith('pfoto_')) {
      dbKey = 'vriend_' + syncPartnerId + '_foto_' + itemId
    } else if (itemId.startsWith('muziek_')) {
      dbKey = 'vriend_' + syncPartnerId + '_muziek_' + itemId.slice(7)
    } else if (itemId === 'video') {
      dbKey = 'vriend_' + syncPartnerId + '_video_data'
    } else {
      // layout of ander item — dit zou niet via chunks moeten komen
      dbKey = 'vriend_' + syncPartnerId + '_' + itemId
    }

    const opslagRecord = { id: dbKey, hash, data: compleet, ontvangen: Date.now() }
                                            if (itemId.startsWith('widgetbg_')) {
                                                const sl = itemId.slice(9)
                                                if (!compleet.startsWith('data:image')) {
                                                    console.warn('[sync] achtergrond is geen afbeelding, niet opgeslagen:', sl)
                                                    delete chunkBuffers[itemId]
                                                    return
                                                }
                                                opslagRecord.id = 'vriend_' + syncPartnerId + '_wbg_' + sl
                                                opslagRecord.pos = wbgPosWacht[sl] || ''
                                                delete wbgPosWacht[sl]
                                            }
                                            await dbPut(opslagRecord)
    delete chunkBuffers[itemId]
    console.log('[sync] Item compleet opgeslagen:', itemId)
    if (itemId === 'video' && videoVraag && videoVraag.vriendId === syncPartnerId) videoVraagKlaar()
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
  await iceReady // TURN-servers eerst binnen laten komen
  maakPeerConnection()
  koppelDataChannel(peerConnection.createDataChannel('fibro-sync'))
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  await stuurSignaal('offer', offer)
}

async function verwerkSignaal(type, data) {
  console.log('[sync] Signaal:', type)
  if (type === 'herstart') {
    // v116: ICE-restart van de vriend op de bestaande verbinding
    const pc = peerConnection
    if (isInitiator || !pc || !pc.remoteDescription) return
    if (dtlsVingerafdruk(data && data.sdp) !== dtlsVingerafdruk(pc.remoteDescription.sdp)) return // ander/oud toestel
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data))
      if (pc !== peerConnection) return
      await leegIceBuffer()
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await stuurSignaal('answer', answer)
      console.log('[sync] ICE-restart van de vriend beantwoord')
    } catch (e) { console.log('[sync] ICE-restart beantwoorden mislukt:', e && e.message) }
    return
  }
  if (type === 'herstart-vraag') {
    // v116: de vriend merkt dat de verbinding hapert; de initiatiefnemer herstelt
    if (isInitiator && peerConnection && peerConnection._wasVerbonden) verbindingHapert(peerConnection)
    return
  }
  if (type === 'offer') {
    if (isInitiator) return
    const ufrag = iceUfrag(data && data.sdp)
    // RACE-FIX (bug #3): duplicate offer (van een retry) negeren als er al
    // een verbinding loopt of staat — anders wordt een werkende verbinding weggegooid
    if (peerConnection) {
      const staat = peerConnection.connectionState
      const dcOpen = dataChannel && dataChannel.readyState === 'open'
      const oud = iceUfrag(peerConnection.remoteDescription && peerConnection.remoteDescription.sdp)
      // v107: een offer met een andere ice-ufrag komt van een nieuwe verbinding van de vriend
      const nieuw = !!(ufrag && oud && ufrag !== oud)
      if (!nieuw && (dcOpen || staat === 'connected' || staat === 'connecting')) {
        console.log('[sync] Duplicate offer genegeerd (verbinding al actief)')
        return
      }
      if (nieuw) console.log('[sync] Nieuw offer van de vriend - verbinding opnieuw')
    }
    // v107: ice die vóór het offer binnenkwam niet weggooien (kan via REST in andere volgorde aankomen)
    const vroeg = iceBuffer
    await iceReady // TURN-servers eerst binnen laten komen
    maakPeerConnection()
    iceBuffer = vroeg.filter(c => !c || !c.usernameFragment || !ufrag || c.usernameFragment === ufrag)
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
    const rd = peerConnection && peerConnection.remoteDescription
    const uf = data && data.usernameFragment, rdUf = rd && iceUfrag(rd.sdp)
    // v116: ook kandidaten van een nieuwere ICE-ronde (restart) even bewaren
    if (!rd || (uf && rdUf && uf !== rdUf)) {
      iceBuffer.push(data)
      if (iceBuffer.length > 60) iceBuffer = iceBuffer.slice(-60)
      return
    }
    try { await peerConnection.addIceCandidate(new RTCIceCandidate(data)) }
    catch (e) { console.warn('[sync] ice fout:', e) }
  }
}

function iceUfrag(sdp) {
  const m = /a=ice-ufrag:(\S+)/.exec(typeof sdp === 'string' ? sdp : '')
  return m ? m[1] : null
}

async function leegIceBuffer() {
  // v116: alleen kandidaten van de huidige ICE-ronde toevoegen; nieuwere bewaren
  const pc = peerConnection
  if (!pc) return
  const uf = iceUfrag(pc.remoteDescription && pc.remoteDescription.sdp)
  const nu = [], later = []
  for (const k of iceBuffer) (k && k.usernameFragment && uf && k.usernameFragment !== uf ? later : nu).push(k)
  iceBuffer = later.slice(-60)
  for (const kandidaat of nu) {
    try { await pc.addIceCandidate(new RTCIceCandidate(kandidaat)) }
    catch (e) { console.warn('[sync] ice-buffer fout:', e) }
  }
}

// ── Relay-vraag: muziek toch versturen via relay? ──
function toonRelayMuziekVraag(muziekItems) {
  // Niet dubbel tonen
  if (document.getElementById('sync-relay-vraag')) return
  const box = document.createElement('div')
  box.id = 'sync-relay-vraag'
  box.style.cssText = 'position:fixed;bottom:110px;right:10px;background:rgba(20,10,40,0.95);color:#fff;padding:12px 14px;border-radius:12px;font-size:13px;z-index:9999;font-family:inherit;max-width:240px;border:1px solid rgba(192,132,252,0.4);box-shadow:0 4px 20px rgba(0,0,0,0.5)'
  box.innerHTML = '🎵 Muziek van je vriend gevonden, maar de verbinding loopt via een relay-server (kost extra data).<div style="display:flex;gap:8px;margin-top:10px;">' +
    '<button id="sync-relay-ja" style="flex:1;background:linear-gradient(135deg,#c084fc,#818cf8);border:none;border-radius:8px;padding:8px;color:#1a0a2e;font-weight:600;cursor:pointer;min-height:40px;">Toch ophalen</button>' +
    '<button id="sync-relay-nee" style="flex:1;background:rgba(255,255,255,0.1);border:none;border-radius:8px;padding:8px;color:#fff;cursor:pointer;min-height:40px;">Overslaan</button></div>'
  document.body.appendChild(box)
  document.getElementById('sync-relay-ja').onclick = () => {
    box.remove()
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({ type: 'geef', items: muziekItems }))
      zetP2pStatus('muziek ophalen via relay...')
    }
  }
  document.getElementById('sync-relay-nee').onclick = () => box.remove()
}

// ── Video van een vriend ophalen als je hem wilt zien (v112) ──
// Belofte: klaar als de video binnen is (opgeslagen als vriend_<id>_video_data).
// Mislukt met een Error waarvan message is: 'offline', 'relay', 'geen-video',
// 'ander-tabblad', 'tijd', 'fout' of 'afgebroken'.
function zetVideoTimer(ms) {
  if (!videoVraag) return
  clearTimeout(videoVraag.timer)
  videoVraag.timer = setTimeout(() => videoVraagFout('tijd'), ms)
}
function videoVraagKlaar() {
  const v = videoVraag
  if (!v) return
  videoVraag = null
  voorkeurVriend = null
  clearTimeout(v.timer)
  console.log('[sync] Video van vriend binnen')
  v.resolve(true)
}
function videoVraagFout(reden) {
  const v = videoVraag
  if (!v) return
  videoVraag = null
  voorkeurVriend = null
  clearTimeout(v.timer)
  console.log('[sync] Video van vriend niet opgehaald:', reden)
  v.reject(new Error(reden))
}
export function vraagVriendVideo(vriendId, opVoortgang) {
  return new Promise((resolve, reject) => {
    if (videoVraag) videoVraagFout('afgebroken')
    if (!heeftSlot) { reject(new Error('ander-tabblad')); return }
    if (!vriendId || !vrienden.has(vriendId) || !onlineGebruikers.has(vriendId)) { reject(new Error('offline')); return }
    if (inRust(vriendId)) { reject(new Error('relay')); return }
    videoVraag = { vriendId, opVoortgang: opVoortgang || (() => {}), resolve, reject, timer: null }
    zetVideoTimer(45000)
    voorkeurVriend = vriendId
    wisPauze(vriendId)
    if (syncPartnerId === vriendId) {
      // Al verbonden en het manifest is binnen: meteen vragen. Anders gebeurt het bij het manifest.
      if (dataChannel && dataChannel.readyState === 'open' && manifestVan === vriendId) {
        (async () => {
          if (relayCheck) await relayCheck
          if (!videoVraag || videoVraag.vriendId !== vriendId) return
          if (isRelayConnection) { videoVraagFout('relay'); return }
          if (!laatsteVideoHash) { videoVraagFout('geen-video'); return }
          try { dataChannel.send(JSON.stringify({ type: 'geef', items: ['video'] })) } catch (e) { videoVraagFout('fout') }
        })()
      }
    } else {
      if (syncPartnerId) stopSync()
      checkSyncStart()
    }
  })
}

function stopSync() {
  console.log('[sync] Sync gestopt')
  kanaalPoging++
  clearTimeout(kanaalTimer)
  clearTimeout(offerRetryTimer)
  clearTimeout(syncTimeout)
  clearTimeout(herstartTimer)
  herstartTimer = null
  herstartPogingen = 0
  if (dataChannel) { dataChannel.close(); dataChannel = null }
  if (peerConnection) { peerConnection.close(); peerConnection = null }
  if (syncKanaal) { supabase.removeChannel(syncKanaal); syncKanaal = null }
  syncPartnerId = null
  iceBuffer = []
  offerRetryCount = 0
  isRelayConnection = false
  relayCheck = null
  eigenKlaar = false
  anderKlaar = false
  manifestVan = null
  laatsteVideoHash = null
  zetP2pStatus('')
}

function zetP2pStatus(status) {
  p2pStatus = status
  toonDebugBadge()
}

function toonDebugBadge() {
  return // debug-badge uitgeschakeld: lag over de chatbalk
  let b = document.getElementById('sync-debug-badge')
  if (!b) {
    b = document.createElement('div')
    b.id = 'sync-debug-badge'
    b.style.cssText = 'position:fixed;bottom:70px;right:10px;background:rgba(0,0,0,0.8);color:#0f0;padding:6px 10px;border-radius:8px;font-size:13px;z-index:9999;font-family:monospace'
    document.body.appendChild(b)
  }
  b.textContent = 'sync5: ' + onlineGebruikers.size + ' online' + (p2pStatus ? ' | ' + p2pStatus : '')
}

export function isOnline(userId) {
  return onlineGebruikers.has(userId)
}

export function getOnlineGebruikers() {
  return [...onlineGebruikers]
}


// ── Lokaal opgeslagen weergavenaam van een vriend (via P2P ontvangen) ──
export function lokaleVriendNaam(vriendId, eigenId) {
  try {
    return localStorage.getItem('vriend_naam_' + vriendId + '_' + eigenId) || null
  } catch(e) { return null }
}
