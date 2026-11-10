// groepbellen.js (10 nov 2026, groepschat stap 2): voice chat met de groep, tot 8 personen.
//
// Hoe het werkt: iedereen in het gesprek praat rechtstreeks met iedereen (WebRTC, alleen geluid), via onze eigen
// STUN/TURN-server (ice-config.js), net als gewoon bellen. Wie er in het gesprek zit, staat op het live-kanaal van de
// groep (presence: { bel: true, stil, hand }). Voor elk paar maakt degene met het kleinste id het aanbod (offer).
// De seintjes daarvoor (offer, answer, ice) gaan over hetzelfde kanaal (broadcast 'rtc'), versleuteld voor alleen de
// ontvanger en vast aan de afzender (groepsleutel.js, soort 'media'): een ander lid kan ze niet lezen of namaken.
//
// Wie praat: per stem een AnalyserNode (alleen meten, niet afspelen), zoals de webcamrondjes bij dammen. Microfoon uit
// = praat nooit.
import { versleutelGroepsBytes, openGroepsBytes } from './groepsleutel.js?v=2'
import { ICE_SERVERS, iceReady } from './ice-config.js?v=149'

export const MAX_BELLERS = 8
const GELUID = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
const naarB64 = b => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s) }
const vanB64 = t => { const bin = atob(t); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o }

// Wie zit er in het gesprek volgens presence? -> Map id -> { stil, hand }
export function bellersUit(presenceState) {
  const uit = new Map()
  for (const [key, metas] of Object.entries(presenceState || {})) {
    const m = (metas || []).find(x => x && x.bel)
    if (m) uit.set(key, { stil: !!m.stil, hand: !!m.hand })
  }
  return uit
}
// Moet ik het aanbod maken voor dit paar? (altijd precies een van de twee)
export const ikBegin = (ik, ander) => String(ik) < String(ander)

// opties: { ik, groepId, kanaal(): supabase-kanaal, sleutel(): { mijnPriv, mijnPub, pubVan(id) }, opStaat(staat) }
export function maakGroepGesprek({ ik, groepId, kanaal, sleutel, opStaat }) {
  const peers = new Map()      // id -> { pc, audio, stroom, wachtIce: [], uitIce: [], klaar }
  let stroom = null, mee = false, stil = false, hand = false, luid = true, geblokkeerd = false
  let bellers = new Map()
  let ac = null, meterTimer = null
  const praat = new Map()      // id -> tot wanneer 'praat'
  const meters = new Map()     // id -> { analyser, data, track }

  const staat = () => ({ mee, stil, hand, luid, geblokkeerd, bellers: new Map(bellers), praat: new Set([...praat].filter(([, t]) => t > performance.now()).map(([id]) => id)),
    verbonden: new Set([...peers].filter(([, p]) => ['connected', 'completed'].includes(p.pc.iceConnectionState)).map(([id]) => id)) })
  const meld = () => { try { opStaat && opStaat(staat()) } catch (e) {} }

  // ── seintjes versleuteld ──
  async function stuurSein(naar, soort, data) {
    const k = kanaal(), s = sleutel()
    const pub = s.pubVan(naar)
    if (!k || !pub) return
    const bytes = new TextEncoder().encode(JSON.stringify({ soort, data }))
    const p = await versleutelGroepsBytes(bytes, { groepId, van: ik, mijnPriv: s.mijnPriv, leden: [{ id: ik, public_key: s.mijnPub }, { id: naar, public_key: pub }] })
    await k.send({ type: 'broadcast', event: 'rtc', payload: { van: ik, naar, t: p.t, d: naarB64(p.d), k: p.k } })
  }
  async function ontvangSein(payload) {
    const p = payload && payload.payload ? payload.payload : payload
    if (!p || p.naar !== ik || !p.van || p.van === ik || typeof p.d !== 'string') return
    if (!mee) return
    const s = sleutel(), pub = s.pubVan(p.van)
    if (!pub) return
    let d; try { d = vanB64(p.d) } catch (e) { return }
    const uit = await openGroepsBytes({ t: p.t, d, k: p.k }, { groepId, van: p.van, ik, mijnPriv: s.mijnPriv, afzenderPub: pub })
    if (uit.status !== 'ok') return
    let sein; try { sein = JSON.parse(new TextDecoder().decode(uit.bytes)) } catch (e) { return }
    await verwerk(p.van, sein)
  }

  // ── verbindingen ──
  function maakPeer(id) {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    const peer = { pc, audio: null, stroom: null, wachtIce: [], uitIce: [], klaar: false }
    peers.set(id, peer)
    if (stroom) for (const t of stroom.getAudioTracks()) pc.addTrack(t, stroom)
    // ice pas na het offer/answer versturen: anders kan het eerder aankomen dan het offer en gaat het verloren
    pc.onicecandidate = e => { if (!e.candidate) return; const c = e.candidate.toJSON(); if (peer.klaar) stuurSein(id, 'ice', c).catch(() => {}); else peer.uitIce.push(c) }
    pc.ontrack = e => {
      const st = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track])
      peer.stroom = st
      if (!peer.audio) { peer.audio = document.createElement('audio'); peer.audio.autoplay = true; peer.audio.setAttribute('playsinline', ''); peer.audio.hidden = true; document.body.appendChild(peer.audio) }
      peer.audio.srcObject = st
      peer.audio.muted = !luid
      speel(peer.audio)
      meet(id, st)
      meld()
    }
    pc.oniceconnectionstatechange = () => {
      meld()
      if (pc.iceConnectionState === 'failed' && ikBegin(ik, id)) { sluitPeer(id); verbind(id) }
    }
    return peer
  }
  async function klaarVoorIce(id, peer) {
    peer.klaar = true
    for (const c of peer.uitIce.splice(0)) await stuurSein(id, 'ice', c).catch(() => {})
  }
  async function verbind(id) {
    if (!mee || peers.has(id) || !ikBegin(ik, id)) return
    const peer = maakPeer(id), { pc } = peer
    const offer = await pc.createOffer({ offerToReceiveAudio: true })
    await pc.setLocalDescription(offer)
    await stuurSein(id, 'offer', { type: offer.type, sdp: offer.sdp })
    await klaarVoorIce(id, peer)
    // Geen verbinding na 12 seconden (offer kwam niet aan, of de ander was nog niet klaar)? Dan opnieuw.
    setTimeout(() => {
      if (!mee || peers.get(id) !== peer || !bellers.has(id) || ['connected', 'completed'].includes(pc.iceConnectionState)) return
      sluitPeer(id); verbind(id).catch(() => {})
    }, 12000)
  }
  async function verwerk(van, sein) {
    if (!sein || typeof sein.soort !== 'string') return
    if (sein.soort === 'offer') {
      // (van is een lid: zijn sleutel klopte. Hij hoeft nog niet in mijn presence te staan, die kan later komen.)
      if (ikBegin(ik, van)) return
      if (peers.has(van)) sluitPeer(van)
      const peer = maakPeer(van), { pc, wachtIce } = peer
      await pc.setRemoteDescription(sein.data)
      for (const c of wachtIce.splice(0)) { try { await pc.addIceCandidate(c) } catch (e) {} }
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await stuurSein(van, 'answer', { type: answer.type, sdp: answer.sdp })
      await klaarVoorIce(van, peer)
    } else if (sein.soort === 'answer') {
      const p = peers.get(van)
      if (p && p.pc.signalingState === 'have-local-offer') {
        await p.pc.setRemoteDescription(sein.data)
        for (const c of p.wachtIce.splice(0)) { try { await p.pc.addIceCandidate(c) } catch (e) {} }
      }
    } else if (sein.soort === 'ice') {
      const p = peers.get(van)
      if (!p) return
      if (!p.pc.remoteDescription) p.wachtIce.push(sein.data)
      else { try { await p.pc.addIceCandidate(sein.data) } catch (e) {} }
    }
  }
  function sluitPeer(id) {
    const p = peers.get(id)
    if (!p) return
    try { p.pc.close() } catch (e) {}
    if (p.audio) { try { p.audio.srcObject = null } catch (e) {} p.audio.remove() }
    meters.delete(id); praat.delete(id)
    peers.delete(id)
  }

  // ── geluid afspelen (iPhone: alleen na een tik) ──
  function speel(el) {
    try {
      const p = el.play()
      if (p && p.catch) p.catch(e => { if (e && e.name === 'NotAllowedError') { geblokkeerd = true; meld() } })
    } catch (e) {}
  }

  // ── wie praat ──
  function wek() {
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!ac && AC) ac = new AC(); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}) } catch (e) {}
  }
  function meet(id, st) {
    wek()
    const track = st && st.getAudioTracks().find(t => t.readyState === 'live')
    if (!ac || !track) return
    try {
      const bron = ac.createMediaStreamSource(new MediaStream([track]))
      const analyser = ac.createAnalyser(); analyser.fftSize = 512
      bron.connect(analyser)
      meters.set(id, { analyser, data: new Uint8Array(analyser.fftSize), track })
    } catch (e) {}
    if (!meterTimer) meterTimer = setInterval(stapMeter, 100)
  }
  function stapMeter() {
    const nu = performance.now()
    let anders = false
    for (const [id, m] of meters) {
      const uit = id === ik ? stil : !!(bellers.get(id) || {}).stil
      if (uit || m.track.readyState !== 'live' || !m.track.enabled) continue
      m.analyser.getByteTimeDomainData(m.data)
      let som = 0
      for (let i = 0; i < m.data.length; i++) { const x = (m.data[i] - 128) / 128; som += x * x }
      if (Math.sqrt(som / m.data.length) > 0.035) { const was = (praat.get(id) || 0) > nu; praat.set(id, nu + 350); if (!was) anders = true }
    }
    for (const [id, t] of praat) if (t <= nu && t > nu - 150) anders = true
    if (anders) meld()
  }

  // ── presence ──
  function track() {
    const k = kanaal()
    if (k && k.track) k.track({ bel: mee, stil, hand }).catch?.(() => {})
  }
  function presence(state) {
    bellers = bellersUit(state)
    if (mee) bellers.set(ik, { stil, hand })
    if (mee) {
      for (const id of bellers.keys()) if (id !== ik) verbind(id).catch(e => console.warn('[groepbellen] verbinden', e))
      for (const id of [...peers.keys()]) if (!bellers.has(id)) sluitPeer(id)
    }
    meld()
  }

  return {
    staat,
    presence,
    track,
    ontvangSein: p => { ontvangSein(p).catch(e => console.warn('[groepbellen] sein', e)) },
    async doeMee() {
      if (mee) return
      if (bellers.size >= MAX_BELLERS) throw new Error('vol')
      wek()
      await iceReady.catch?.(() => {})
      stroom = await navigator.mediaDevices.getUserMedia({ audio: GELUID, video: false })
      mee = true; stil = false; hand = false; geblokkeerd = false
      bellers.set(ik, { stil, hand })
      meet(ik, stroom)
      track()
      for (const id of bellers.keys()) if (id !== ik) verbind(id).catch(() => {})
      meld()
    },
    verlaat() {
      if (!mee) return
      mee = false; hand = false
      for (const id of [...peers.keys()]) sluitPeer(id)
      if (stroom) for (const t of stroom.getTracks()) { try { t.stop() } catch (e) {} }
      stroom = null; meters.clear(); praat.clear()
      bellers.delete(ik)
      track()
      meld()
    },
    zetStil(aan) { stil = !!aan; if (stroom) for (const t of stroom.getAudioTracks()) t.enabled = !stil; if (mee) bellers.set(ik, { stil, hand }); track(); meld() },
    zetHand(aan) { hand = !!aan; if (mee) bellers.set(ik, { stil, hand }); track(); meld() },
    zetLuid(aan) { luid = !!aan; for (const p of peers.values()) if (p.audio) p.audio.muted = !luid; meld() },
    speelAlles() { wek(); geblokkeerd = false; for (const p of peers.values()) if (p.audio) speel(p.audio); meld() },
  }
}
