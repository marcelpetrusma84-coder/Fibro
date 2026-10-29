// camerafilters.js — camerafilters voor het videobellen (Fibro). v1.
//
// Alles gebeurt op het toestel zelf: de camerabeelden gaan door een onzichtbaar
// tekenvel (<canvas>), daar komt een effect op, en van dat tekenvel maken we met
// captureStream() een nieuwe videostroom. Die sturen we door (en tonen we lokaal),
// zodat je gesprekspartner het filter ook ziet. Geen server, geen AI-model.
//
// Gebruik:
//   const f = maakCameraFilter()
//   f.zetBron(track)                 // de rauwe camera-track (of null)
//   f.kies('oudefilm')               // een filter aanzetten ('geen' = niets)
//   const track = f.uitTrack()       // de bewerkte track om te versturen/tonen
//   f.zetNieuwsTekst({ kop, naam, plek, ticker })
//   f.stop()                         // alles opruimen
//
// 'geen' geeft gewoon de rauwe track terug (geen tekenvel, geen kosten), zodat
// bellen zonder filter precies werkt als voorheen.

export const FILTERS = [
  { id: 'geen', naam: 'Geen', emoji: '🚫' },
  { id: 'oudefilm', naam: 'Oude film', emoji: '🎞️' },
  { id: 'oudetv', naam: 'Oude tv', emoji: '📺' },
  { id: 'anaglyph', naam: '3D-bril', emoji: '🔴' },
  { id: 'beveiliging', naam: 'Beveiliging', emoji: '🎥' },
  { id: 'nieuws', naam: 'Nieuws', emoji: '📰' },
]

const NIEUWS_STANDAARD = { kop: 'LIVE VANAF DE BANK', naam: 'ONZE CORRESPONDENT', plek: 'THUIS', ticker: 'FIBRO NIEUWS • laatste nieuws • je ziet er geweldig uit • terug naar de studio •' }

function tweeCijfers(n) { return (n < 10 ? '0' : '') + n }

export function maakCameraFilter() {
  const video = document.createElement('video')
  video.muted = true; video.autoplay = true; video.playsInline = true
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '')
  const canvas = document.createElement('canvas')
  canvas.width = 640; canvas.height = 480
  const ctx = canvas.getContext('2d')
  const hulp = document.createElement('canvas')          // voor de anaglyph-passes
  const hctx = hulp.getContext('2d')

  // een paar vaste ruis-tegels voor filmgrain/ruis (één keer gemaakt)
  const ruisTegels = []
  for (let t = 0; t < 6; t++) {
    const c = document.createElement('canvas'); c.width = 160; c.height = 120
    const g = c.getContext('2d'); const beeld = g.createImageData(160, 120)
    for (let i = 0; i < beeld.data.length; i += 4) { const v = (Math.random() * 255) | 0; beeld.data[i] = beeld.data[i + 1] = beeld.data[i + 2] = v; beeld.data[i + 3] = 255 }
    g.putImageData(beeld, 0, 0); ruisTegels.push(c)
  }

  let bronTrack = null, uit = null, filter = 'geen', draait = false, rafId = 0, tijd = 0
  let nieuws = laadNieuws()
  const kleine = () => ({ w: canvas.width, h: canvas.height })

  function laadNieuws() {
    try { const j = JSON.parse(localStorage.getItem('fibro-nieuwsfilter') || 'null'); if (j && typeof j === 'object') return Object.assign({}, NIEUWS_STANDAARD, j) } catch (e) {}
    return Object.assign({}, NIEUWS_STANDAARD)
  }
  function zetNieuwsTekst(t) {
    nieuws = Object.assign({}, nieuws, t || {})
    try { localStorage.setItem('fibro-nieuwsfilter', JSON.stringify(nieuws)) } catch (e) {}
  }
  function nieuwsTekst() { return Object.assign({}, nieuws) }

  function pasMaatAan() {
    const w = video.videoWidth || 640, h = video.videoHeight || 480
    const schaal = Math.min(1, 640 / Math.max(1, w))
    const nw = Math.max(16, Math.round(w * schaal)), nh = Math.max(16, Math.round(h * schaal))
    if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh; hulp.width = nw; hulp.height = nh }
  }

  function ruis(alpha, modus) {
    const { w, h } = kleine()
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = modus || 'overlay'
    const tegel = ruisTegels[(Math.random() * ruisTegels.length) | 0]
    ctx.drawImage(tegel, (Math.random() * 20) | 0, (Math.random() * 20) | 0, w, h)
    ctx.restore()
  }
  function vignet(sterkte) {
    const { w, h } = kleine()
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.62)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + sterkte + ')')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  }
  function scanlijnen(alpha, stap) {
    const { w, h } = kleine()
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#000'
    for (let y = 0; y < h; y += stap) ctx.fillRect(0, y, w, 1)
    ctx.restore()
  }
  function tekstBalk(x, y, bw, bh, vul, tekst, kleur, maat, lijn) {
    ctx.fillStyle = vul; ctx.fillRect(x, y, bw, bh)
    if (kleur) { ctx.fillStyle = kleur; ctx.font = (maat || 14) + "px 'Press Start 2P', monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = lijn || 'left'
      ctx.fillText(tekst, lijn === 'center' ? x + bw / 2 : x + 8, y + bh / 2) }
  }

  const effecten = {
    geen(w, h) { ctx.drawImage(video, 0, 0, w, h) },

    // 1. Oude film: zwart-wit met een vleugje sepia, flikkering, grain, krassen en vignet.
    oudefilm(w, h) {
      const flikker = 0.88 + Math.random() * 0.2
      ctx.filter = 'grayscale(1) contrast(1.25) sepia(0.28) brightness(' + flikker.toFixed(2) + ')'
      const sprong = (Math.random() < 0.08) ? (Math.random() * 3 - 1.5) : 0
      ctx.drawImage(video, 0, sprong, w, h)
      ctx.filter = 'none'
      ruis(0.10, 'overlay')
      if (Math.random() < 0.22) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; const sx = (Math.random() * w) | 0; ctx.fillRect(sx, 0, 1, h); ctx.restore() }
      vignet(0.55)
    },

    // 2. Oude tv: scanlijnen, een lichte kleurverschuiving, een rollende balk en ruis.
    oudetv(w, h) {
      ctx.filter = 'saturate(1.3) contrast(1.1)'
      ctx.drawImage(video, 0, 0, w, h)
      ctx.filter = 'none'
      // lichte rood/blauw-verschuiving
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25
      hctx.clearRect(0, 0, w, h); hctx.drawImage(video, 0, 0, w, h)
      hctx.globalCompositeOperation = 'multiply'; hctx.fillStyle = '#ff0000'; hctx.fillRect(0, 0, w, h); hctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(hulp, -1.5, 0, w, h); ctx.restore()
      scanlijnen(0.22, 3)
      const by = (tijd * 60) % (h + 60) - 30                 // rollende lichte balk
      ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = '#fff'; ctx.fillRect(0, by, w, 40); ctx.restore()
      ruis(0.05, 'overlay')
      vignet(0.4)
    },

    // 3. Anaglyph: rood links, cyaan rechts (de klassieke 3D-bril-look).
    anaglyph(w, h) {
      const d = Math.max(2, Math.round(w * 0.012))
      hctx.globalCompositeOperation = 'source-over'; hctx.clearRect(0, 0, w, h); hctx.drawImage(video, 0, 0, w, h)
      hctx.globalCompositeOperation = 'multiply'; hctx.fillStyle = '#ff0000'; hctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, w, h); ctx.drawImage(hulp, -d, 0, w, h)
      hctx.globalCompositeOperation = 'source-over'; hctx.clearRect(0, 0, w, h); hctx.drawImage(video, 0, 0, w, h)
      hctx.globalCompositeOperation = 'multiply'; hctx.fillStyle = '#00ffff'; hctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(hulp, d, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    },

    // 4. Beveiligingscamera: groenig, korrelig, met tijdstempel, 'REC' en een cameralabel.
    beveiliging(w, h) {
      ctx.filter = 'grayscale(0.55) contrast(1.35) brightness(1.05)'
      ctx.drawImage(video, 0, 0, w, h)
      ctx.filter = 'none'
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(40,255,120,0.10)'; ctx.fillRect(0, 0, w, h); ctx.restore()
      scanlijnen(0.12, 4); ruis(0.06, 'overlay'); vignet(0.6)
      const nu = new Date()
      const stempel = nu.getFullYear() + '-' + tweeCijfers(nu.getMonth() + 1) + '-' + tweeCijfers(nu.getDate()) + ' ' + tweeCijfers(nu.getHours()) + ':' + tweeCijfers(nu.getMinutes()) + ':' + tweeCijfers(nu.getSeconds())
      const m = Math.max(8, Math.round(w * 0.022))
      ctx.font = m + "px 'Press Start 2P', monospace"; ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(210,255,210,0.9)'; ctx.textAlign = 'left'; ctx.fillText('CAM 01', 8, 8)
      ctx.textAlign = 'right'; ctx.fillText(stempel, w - 8, 8)
      ctx.textAlign = 'left'; ctx.fillText(stempel.slice(0, 10), 8, h - m - 8)
      if (Math.floor(tijd * 1.5) % 2) { ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(w - 14, h - 16, 5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(255,120,120,0.95)'; ctx.textAlign = 'right'; ctx.fillText('REC', w - 26, h - m - 6) }
    },

    // 5. Nieuws: volledige kleur met een onderbalk (kop + naam/plek) en een lopende ticker.
    nieuws(w, h) {
      ctx.drawImage(video, 0, 0, w, h)
      const bh = Math.max(46, Math.round(h * 0.2)), by = h - bh
      const kopH = Math.round(bh * 0.46), m1 = Math.max(10, Math.round(bh * 0.2)), m2 = Math.max(8, Math.round(bh * 0.15))
      // rode "LIVE"-kadertje
      ctx.fillStyle = '#c20000'; ctx.fillRect(8, by - kopH - 6, Math.round(w * 0.2), kopH)
      ctx.fillStyle = '#fff'; ctx.font = m2 + "px 'Press Start 2P', monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
      ctx.fillText('● LIVE', 8 + Math.round(w * 0.1), by - kopH - 6 + kopH / 2)
      // kopbalk
      ctx.fillStyle = 'rgba(8,24,64,0.92)'; ctx.fillRect(8 + Math.round(w * 0.2), by - kopH - 6, w - 16 - Math.round(w * 0.2), kopH)
      ctx.fillStyle = '#ffd23c'; ctx.textAlign = 'left'; ctx.font = m1 + "px 'Press Start 2P', monospace"
      ctx.fillText(String(nieuws.kop || '').slice(0, 32), 16 + Math.round(w * 0.2), by - kopH - 6 + kopH / 2)
      // naam/plek-balk
      ctx.fillStyle = 'rgba(8,24,64,0.96)'; ctx.fillRect(8, by, w - 16, bh - 18)
      ctx.fillStyle = '#fff'; ctx.font = m1 + "px 'Press Start 2P', monospace"
      ctx.fillText(String(nieuws.naam || '').slice(0, 24), 16, by + (bh - 18) * 0.5)
      ctx.fillStyle = '#9fc4ff'; ctx.font = m2 + "px 'Press Start 2P', monospace"; ctx.textAlign = 'right'
      ctx.fillText(String(nieuws.plek || '').slice(0, 18), w - 16, by + (bh - 18) * 0.5)
      // lopende ticker onderaan
      const tH = 16, ty = h - tH
      ctx.fillStyle = '#c20000'; ctx.fillRect(0, ty, w, tH)
      ctx.save(); ctx.beginPath(); ctx.rect(0, ty, w, tH); ctx.clip()
      ctx.fillStyle = '#fff'; ctx.font = (m2) + "px 'Press Start 2P', monospace"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const tekst = String(nieuws.ticker || '') + '   '
      const breedte = ctx.measureText(tekst).width || 1
      let x = w - ((tijd * 80) % (breedte + w))
      for (let n = 0; n < 3; n++) ctx.fillText(tekst, x + n * breedte, ty + tH / 2)
      ctx.restore()
    },
  }

  function stap(nu) {
    if (!draait) return
    rafId = requestAnimationFrame(stap)
    tijd = (nu || performance.now()) / 1000
    if (!video.videoWidth) return
    pasMaatAan()
    const { w, h } = kleine()
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'
    try { (effecten[filter] || effecten.geen)(w, h) }
    catch (e) { ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(video, 0, 0, w, h) }
  }

  function startLus() {
    if (draait) return
    draait = true
    if (!uit) uit = canvas.captureStream(30)
    rafId = requestAnimationFrame(stap)
  }
  function stopLus() {
    draait = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  function zetBron(track) {
    bronTrack = track || null
    if (track) {
      const ms = new MediaStream([track]); video.srcObject = ms
      video.play().catch(() => {})
      if (filter !== 'geen') startLus()
    } else {
      video.srcObject = null; stopLus()
    }
  }

  // De track die bellen moet versturen/tonen: de rauwe track bij 'geen', anders die van het tekenvel.
  function uitTrack() {
    if (filter === 'geen' || !bronTrack) return bronTrack
    startLus()
    return uit ? uit.getVideoTracks()[0] : bronTrack
  }

  function kies(id) {
    if (!FILTERS.some(f => f.id === id)) return
    const vorig = filter
    filter = id
    if (id === 'geen') { stopLus() }
    else if (bronTrack) { startLus() }
    return vorig !== filter
  }

  function stop() {
    stopLus()
    try { video.srcObject = null } catch (e) {}
    if (uit) { uit.getTracks().forEach(t => t.stop()); uit = null }
    bronTrack = null
  }

  return { zetBron, uitTrack, kies, stop, zetNieuwsTekst, nieuwsTekst, huidig: () => filter, get canvas() { return canvas } }
}

// Een knop met uitklapmenu om een filter te kiezen (en bij 'Nieuws' de tekst aan te passen).
// Losgekoppeld van het bellen: de aanroeper geeft hoe te lezen/kiezen/tekst-zetten.
export function bouwFilterKiezer(container, api) {
  if (!container || container.querySelector('.cf-knop')) return null
  const vertaal = (typeof window !== 'undefined' && window.T) || (s => s)
  const knop = document.createElement('button')
  knop.type = 'button'; knop.className = 'cf-knop'; knop.title = vertaal('Camerafilter'); knop.textContent = '🎭'
  knop.style.cssText = 'background:rgba(0,0,0,0.5);border:none;border-radius:50%;width:44px;height:44px;font-size:20px;cursor:pointer;color:#fff'
  const paneel = document.createElement('div')
  paneel.className = 'cf-paneel'; paneel.hidden = true
  paneel.style.cssText = 'position:absolute;bottom:60px;left:50%;transform:translateX(-50%);z-index:60;background:rgba(14,10,30,0.97);border:1px solid #3a2f66;border-radius:14px;padding:12px;width:min(300px,92vw);box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:system-ui,sans-serif'
  const rij = document.createElement('div')
  rij.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center'
  const NAMEN = { geen: vertaal('Geen'), oudefilm: vertaal('Oude film'), oudetv: vertaal('Oude tv'), anaglyph: vertaal('3D-bril'), beveiliging: vertaal('Beveiliging'), nieuws: vertaal('Nieuws') }
  const chips = {}
  const nieuwsVak = document.createElement('div')
  nieuwsVak.className = 'cf-nieuws'; nieuwsVak.hidden = true
  nieuwsVak.style.cssText = 'margin-top:10px;display:flex;flex-direction:column;gap:6px'
  function werkChips() {
    const nu = api.huidig()
    for (const id in chips) chips[id].style.outline = id === nu ? '2px solid #5ff4ff' : 'none'
    nieuwsVak.hidden = nu !== 'nieuws'
  }
  for (const f of FILTERS) {
    const chip = document.createElement('button')
    chip.type = 'button'; chip.dataset.id = f.id
    chip.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;width:78px;padding:8px 4px;background:#201841;border:1px solid #3a2f66;border-radius:10px;color:#fff;font-size:11px;cursor:pointer'
    chip.innerHTML = '<span style="font-size:20px">' + f.emoji + '</span>' + (NAMEN[f.id] || f.naam)
    chip.addEventListener('click', () => { api.kies(f.id); werkChips() })
    chips[f.id] = chip; rij.appendChild(chip)
  }
  const velden = {}
  for (const [sleutel, label] of [['kop', vertaal('Kop')], ['naam', vertaal('Jouw naam')], ['plek', vertaal('Plek')], ['ticker', vertaal('Lopende balk')]]) {
    const inv = document.createElement('input')
    inv.type = 'text'; inv.placeholder = label; inv.dataset.veld = sleutel
    inv.style.cssText = 'width:100%;box-sizing:border-box;background:#120d28;border:1px solid #3a2f66;border-radius:8px;color:#fff;padding:7px 9px;font-size:13px'
    inv.addEventListener('input', () => api.zetTekst({ [sleutel]: inv.value }))
    velden[sleutel] = inv; nieuwsVak.appendChild(inv)
  }
  function vulVelden() { const t = api.tekst ? api.tekst() : {}; for (const k in velden) velden[k].value = t[k] || '' }
  paneel.append(rij, nieuwsVak)
  knop.addEventListener('click', e => { e.stopPropagation(); paneel.hidden = !paneel.hidden; if (!paneel.hidden) { werkChips(); vulVelden() } })
  document.addEventListener('click', e => { if (!paneel.hidden && !paneel.contains(e.target) && e.target !== knop) paneel.hidden = true })
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  container.append(knop, paneel)
  return knop
}
