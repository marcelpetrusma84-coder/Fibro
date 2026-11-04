// spraak.js (v264, 4 nov 2026): spraakberichtjes opnemen en afspelen in de chat.
//
// OPNEMEN: neemOp() vraagt de microfoon en neemt op met MediaRecorder. Liefst audio/mp4 (dat speelt op elke iPhone en
// elke Android), anders webm/opus. Hoogstens MAX_SEC seconden; dan stopt hij vanzelf. stop() geeft { blob, duur },
// annuleer() gooit alles weg. De microfoon gaat daarna meteen weer uit (het rode bolletje op de iPhone verdwijnt).
//
// AFSPELEN: maakSpeler(url, duur) geeft een balkje: ▶︎/⏸, een voortgangsbalk (tikken = daarheen) en de tijd. Er
// speelt er altijd maar een tegelijk. Met eenmalig: het speelt een keer helemaal af, terugspoelen kan niet, en daarna
// roept het opKlaar() (de chat zet er dan '👂 Beluisterd' neer).
//
// Versturen gaat net als foto's rechtstreeks van telefoon naar telefoon (p2pfoto.js), niet via de server.
const T = (s, v) => (window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
export const MAX_SEC = 120
export const MAX_BYTES = 5 * 1024 * 1024
export const GELDIG_TYPE = /^audio\/(mp4|webm|ogg|mpeg|aac|x-m4a)(;.*)?$/i

export function kanOpnemen() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)
}
function kiesType() {
  const lijst = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  for (const t of lijst) { try { if (MediaRecorder.isTypeSupported(t)) return t } catch (e) {} }
  return ''
}
export const tijdTekst = s => { s = Math.max(0, Math.round(Number(s) || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }

// Opnemen. opTik(seconden) elke ~250 ms; opVol() als de maximale duur bereikt is (dan stopt hij zelf).
export async function neemOp({ opTik, opVol } = {}) {
  const stroom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  const type = kiesType()
  let rec
  try { rec = type ? new MediaRecorder(stroom, { mimeType: type, audioBitsPerSecond: 32000 }) : new MediaRecorder(stroom) }
  catch (e) { rec = new MediaRecorder(stroom) }
  const delen = []
  rec.ondataavailable = e => { if (e.data && e.data.size) delen.push(e.data) }
  const begin = performance.now()
  let klaarBelofte = null, klaar = null, gestopt = false
  klaarBelofte = new Promise(r => { klaar = r })
  rec.onstop = () => klaar()
  rec.start(250)
  const duur = () => (performance.now() - begin) / 1000
  const tikker = setInterval(() => {
    const d = duur()
    if (opTik) try { opTik(d) } catch (e) {}
    if (d >= MAX_SEC && !gestopt) { if (opVol) try { opVol() } catch (e) {} }
  }, 250)
  const opruimen = () => { clearInterval(tikker); for (const t of stroom.getTracks()) { try { t.stop() } catch (e) {} } }
  return {
    async stop() {
      if (gestopt) return null
      gestopt = true
      const d = Math.min(MAX_SEC, duur())
      try { if (rec.state !== 'inactive') rec.stop() } catch (e) {}
      await Promise.race([klaarBelofte, new Promise(r => setTimeout(r, 1500))])
      opruimen()
      const blobType = (rec.mimeType || type || 'audio/webm').split(';')[0]
      const blob = new Blob(delen, { type: blobType })
      return { blob, duur: d }
    },
    annuleer() {
      if (gestopt) return
      gestopt = true
      try { if (rec.state !== 'inactive') rec.stop() } catch (e) {}
      opruimen()
    },
    duur,
  }
}

// ── Afspelen ──
let speeltNu = null
export function maakSpeler(url, duur, { eenmalig = false, opKlaar = null, mijn = false } = {}) {
  const vak = document.createElement('div')
  vak.className = 'spraak-speler'
  vak.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:190px;max-width:240px;padding:2px 0'
  const knop = document.createElement('button')
  knop.type = 'button'
  knop.className = 'spraak-knop'
  knop.setAttribute('aria-label', T('Afspelen'))
  knop.style.cssText = 'flex:0 0 auto;width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;'
    + (mijn ? 'background:rgba(255,255,255,0.25);color:#fff' : 'background:var(--accent,#c084fc);color:#1a0a2e')
  knop.textContent = '▶︎'
  const midden = document.createElement('div')
  midden.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:5px'
  const balk = document.createElement('div')
  balk.className = 'spraak-balk'
  balk.style.cssText = 'position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,0.22);cursor:' + (eenmalig ? 'default' : 'pointer')
  const vul = document.createElement('div')
  vul.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:0;border-radius:3px;background:' + (mijn ? '#fff' : 'var(--accent,#c084fc)')
  balk.appendChild(vul)
  const tijd = document.createElement('div')
  tijd.className = 'spraak-tijd'
  tijd.style.cssText = 'font-size:12px;opacity:0.8;font-variant-numeric:tabular-nums'
  tijd.textContent = (eenmalig ? '\u{1F442} ' : '\u{1F3A4} ') + tijdTekst(duur)
  midden.append(balk, tijd)
  vak.append(knop, midden)

  const audio = new Audio()
  audio.preload = 'metadata'
  audio.src = url
  let lengte = Number(duur) || 0
  audio.addEventListener('loadedmetadata', () => { if (Number.isFinite(audio.duration) && audio.duration > 0) lengte = audio.duration })
  const teken = () => {
    const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : lengte
    const p = d ? Math.min(1, audio.currentTime / d) : 0
    vul.style.width = (p * 100) + '%'
    tijd.textContent = (eenmalig ? '\u{1F442} ' : '\u{1F3A4} ') + (audio.paused && audio.currentTime === 0 ? tijdTekst(d) : tijdTekst(audio.currentTime) + ' / ' + tijdTekst(d))
  }
  audio.addEventListener('timeupdate', teken)
  audio.addEventListener('play', () => { knop.textContent = '⏸︎'; knop.setAttribute('aria-label', T('Pauze')) })
  audio.addEventListener('pause', () => { knop.textContent = '▶︎'; knop.setAttribute('aria-label', T('Afspelen')) })
  let afgespeeld = false
  audio.addEventListener('ended', () => {
    teken()
    if (speeltNu === audio) speeltNu = null
    if (eenmalig && !afgespeeld) { afgespeeld = true; if (opKlaar) opKlaar() }
    else { audio.currentTime = 0; teken() }
  })
  knop.onclick = (e) => {
    e.stopPropagation()
    if (afgespeeld) return
    if (audio.paused) {
      if (speeltNu && speeltNu !== audio) { try { speeltNu.pause() } catch (er) {} }
      speeltNu = audio
      audio.play().catch(er => console.warn('[spraak] afspelen lukte niet', er))
    } else audio.pause()
  }
  if (!eenmalig) {
    balk.onclick = (e) => {
      e.stopPropagation()
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : lengte
      if (!d) return
      const r = balk.getBoundingClientRect()
      audio.currentTime = Math.max(0, Math.min(d, (e.clientX - r.left) / r.width * d))
      teken()
    }
  }
  vak._audio = audio
  return vak
}
