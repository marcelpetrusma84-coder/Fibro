// spelnet.js — samen spelen met snelle berichten (v194, eerst voor Neon Raiders)
//
// De berichten tijdens het spel gaan rechtstreeks van telefoon naar telefoon (WebRTC DataChannel).
// Lukt dat niet rechtstreeks, dan loopt dezelfde verbinding via je eigen TURN-server bij TransIP
// (de postbode, zie ice-config.js). Supabase (het spelkanaal van de chat) wordt alleen gebruikt om
// de verbinding op te zetten: een paar berichtjes met het 'adres' van elke telefoon.
// Lukt ook dat niet binnen 10 seconden, dan gaat alles via het spelkanaal, maar dan hooguit
// 4 berichten per seconde (de snelle berichten worden samengevoegd: alleen de nieuwste telt).
//
// Twee soorten berichten:
//   snel   de stand (positie enz.), vaak; mag soms wegvallen, alleen de nieuwste telt
//   zeker  gebeurtenissen (geraakt, opgepakt, pauze, start); komen allemaal aan, op volgorde
//
// De uitnodiger (host) begint de verbinding (verbind()); de ander antwoordt vanzelf.
// Elk bericht is een gewoon object; het gaat als JSON over de lijn.

const OPEN_BINNEN = 10000      // zo lang mag het opzetten van de rechtstreekse verbinding duren
const RESERVE_MS = 250         // via het spelkanaal: hooguit 4 berichten per seconde
const MAX_BERICHT = 16000      // groter sturen we niet (ook niet rechtstreeks)

export function maakSpelNet({ spelKanaal, host, naam, isActief, opBericht, opModus }) {
  const SIG = naam + '-sig', PAK = naam + '-pak'
  let modus = 'zoeken'          // zoeken | direct | turn | supabase
  let pc = null, snelDc = null, zekerDc = null, poging = 0, openKlok = null, iceBuffer = []
  let reserveSnel = null, reserveZeker = [], reserveKlok = null, laatsteReserve = 0
  let iceConfig = null
  let dicht = false
  const actief = () => !dicht && (typeof isActief !== 'function' || isActief())

  function zetModus(m) {
    if (modus === m) return
    modus = m
    try { if (opModus) opModus(m) } catch (e) { console.warn('[spelnet] opModus', e) }
  }
  function ontvangen(tekst, zeker) {
    let m = null
    try { m = typeof tekst === 'string' ? JSON.parse(tekst) : tekst } catch (e) { return }
    if (!m || typeof m !== 'object') return
    try { opBericht(m, zeker) } catch (e) { console.warn('[spelnet] bericht', e) }
  }

  /* ---------- het spelkanaal (Supabase): opzetten, en de reserve ---------- */
  function kanaalStuur(event, payload) {
    if (!actief()) return
    try { spelKanaal.send({ type: 'broadcast', event, payload }) } catch (e) {}
  }
  spelKanaal.on('broadcast', { event: PAK }, msg => {
    const p = msg && msg.payload
    if (!p || typeof p !== 'object') return
    if (Array.isArray(p.z)) for (const z of p.z.slice(0, 200)) ontvangen(z, true)
    if (p.s) ontvangen(p.s, false)
  })
  spelKanaal.on('broadcast', { event: SIG }, msg => {
    const p = msg && msg.payload
    if (!p || typeof p !== 'object' || dicht) return
    signaal(p).catch(e => console.warn('[spelnet] signaal', e))
  })

  function reserveVerstuur() {
    reserveKlok = null
    if (!actief()) return
    if (!reserveSnel && !reserveZeker.length) return
    const payload = {}
    if (reserveSnel) payload.s = reserveSnel
    if (reserveZeker.length) payload.z = reserveZeker
    reserveSnel = null; reserveZeker = []
    laatsteReserve = performance.now()
    kanaalStuur(PAK, payload)
  }
  function reservePlan() {
    if (reserveKlok) return
    const wacht = Math.max(0, RESERVE_MS - (performance.now() - laatsteReserve))
    reserveKlok = setTimeout(reserveVerstuur, wacht)
  }

  /* ---------- rechtstreeks (WebRTC) ---------- */
  async function laadIce() {
    if (iceConfig) return iceConfig
    try {
      const ice = await import('./ice-config.js?v=149')
      try { await ice.iceReady } catch (e) {}
      iceConfig = { iceServers: (ice.ICE_SERVERS && ice.ICE_SERVERS.iceServers || []).slice() }
    } catch (e) {
      console.warn('[spelnet] ice-config niet geladen, alleen rechtstreeks', e)
      iceConfig = { iceServers: [] }
    }
    return iceConfig
  }
  function sluitPc() {
    clearTimeout(openKlok); openKlok = null
    for (const dc of [snelDc, zekerDc]) { if (dc) { dc.onopen = dc.onclose = dc.onmessage = null; try { dc.close() } catch (e) {} } }
    snelDc = zekerDc = null
    if (pc) { pc.onicecandidate = pc.ondatachannel = pc.onconnectionstatechange = null; try { pc.close() } catch (e) {} }
    pc = null
  }
  function open() { return !!(zekerDc && zekerDc.readyState === 'open' && snelDc && snelDc.readyState === 'open') }
  function koppel(dc) {
    if (dc.label === 'snel') snelDc = dc; else zekerDc = dc
    dc.onmessage = e => ontvangen(e.data, dc.label !== 'snel')
    dc.onopen = () => { if (open()) verbonden() }
    dc.onclose = () => { if (modus === 'direct' || modus === 'turn') { sluitPc(); zetModus('supabase') } }
  }
  async function verbonden() {
    clearTimeout(openKlok); openKlok = null
    let relay = false
    try {
      const stats = await pc.getStats()
      let paar = null
      stats.forEach(s => { if (s.type === 'transport' && s.selectedCandidatePairId) paar = stats.get(s.selectedCandidatePairId) })
      if (!paar) stats.forEach(s => { if (s.type === 'candidate-pair' && s.state === 'succeeded' && (s.nominated || s.selected)) paar = paar || s })
      if (paar) {
        const l = stats.get(paar.localCandidateId), r = stats.get(paar.remoteCandidateId)
        relay = (l && l.candidateType === 'relay') || (r && r.candidateType === 'relay')
      }
    } catch (e) {}
    if (!open()) return
    zetModus(relay ? 'turn' : 'direct')
    // wat nog voor het spelkanaal klaarstond, gaat nu rechtstreeks
    clearTimeout(reserveKlok); reserveKlok = null
    const z = reserveZeker; reserveZeker = []; reserveSnel = null
    for (const m of z) stuurZeker(m)
  }
  function maakPc(nr) {
    sluitPc()
    pc = new RTCPeerConnection(iceConfig)
    const deze = pc
    pc.onicecandidate = e => { if (e.candidate && pc === deze) kanaalStuur(SIG, { soort: 'ice', poging: nr, d: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }) }
    pc.onconnectionstatechange = () => {
      if (pc !== deze) return
      if (pc.connectionState === 'failed') { sluitPc(); zetModus('supabase') }
    }
    pc.ondatachannel = e => { if (pc === deze) koppel(e.channel) }
    return pc
  }
  function startWachten() {
    clearTimeout(openKlok)
    openKlok = setTimeout(() => { if (!open()) { sluitPc(); zetModus('supabase') } }, OPEN_BINNEN)
  }

  async function signaal(p) {
    if (p.soort === 'offer' && !host) {
      // meteen onthouden: de adressen (ice) van deze poging kunnen binnenkomen terwijl ice-config nog laadt
      if (p.poging !== poging) { poging = p.poging; iceBuffer = [] }
      await laadIce()
      if (dicht || p.poging !== poging) return
      const nu = maakPc(poging)
      zetModus('zoeken')
      startWachten()
      await nu.setRemoteDescription(p.d)
      const antwoord = await nu.createAnswer()
      await nu.setLocalDescription(antwoord)
      kanaalStuur(SIG, { soort: 'answer', poging, d: { type: nu.localDescription.type, sdp: nu.localDescription.sdp } })
      for (const c of iceBuffer.splice(0)) { try { await nu.addIceCandidate(c) } catch (e) {} }
    } else if (p.soort === 'answer' && host && pc && p.poging === poging) {
      if (pc.signalingState !== 'have-local-offer') return
      await pc.setRemoteDescription(p.d)
      for (const c of iceBuffer.splice(0)) { try { await pc.addIceCandidate(c) } catch (e) {} }
    } else if (p.soort === 'ice' && p.poging === poging && p.d) {
      if (!pc || !pc.remoteDescription) { iceBuffer.push(p.d); return }
      try { await pc.addIceCandidate(p.d) } catch (e) {}
    }
  }

  /* host: een (nieuwe) poging om rechtstreeks te verbinden */
  async function verbind() {
    if (!host || dicht || open()) return
    if (typeof RTCPeerConnection !== 'function') { zetModus('supabase'); return }
    await laadIce()
    if (dicht || open()) return
    poging = Date.now() % 1e9
    iceBuffer = []
    const nu = maakPc(poging)
    zetModus('zoeken')
    koppel(nu.createDataChannel('zeker', { ordered: true }))
    koppel(nu.createDataChannel('snel', { ordered: false, maxRetransmits: 0 }))
    startWachten()
    const aanbod = await nu.createOffer()
    await nu.setLocalDescription(aanbod)
    kanaalStuur(SIG, { soort: 'offer', poging, d: { type: nu.localDescription.type, sdp: nu.localDescription.sdp } })
  }

  /* ---------- versturen ---------- */
  function stuurSnel(m) {
    if (!actief()) return
    if (open()) { try { const t = JSON.stringify(m); if (t.length < MAX_BERICHT) snelDc.send(t) } catch (e) {} return }
    reserveSnel = m; reservePlan()
  }
  function stuurZeker(m) {
    if (!actief()) return
    if (open()) { try { const t = JSON.stringify(m); if (t.length < MAX_BERICHT) zekerDc.send(t) } catch (e) {} return }
    reserveZeker.push(m); if (reserveZeker.length > 200) reserveZeker.splice(0, reserveZeker.length - 200)
    reservePlan()
  }
  /* meteen weg (bijvoorbeeld net voor de app naar de achtergrond gaat) */
  function stuurNu(m) {
    if (open()) { stuurZeker(m); return }
    reserveZeker.push(m); clearTimeout(reserveKlok); reserveKlok = null; reserveVerstuur()
  }
  function sluit() {
    dicht = true
    clearTimeout(reserveKlok); reserveKlok = null
    sluitPc()
  }
  return { verbind, stuurSnel, stuurZeker, stuurNu, sluit, modus: () => modus, rechtstreeks: open }
}
