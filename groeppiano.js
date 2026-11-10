// groeppiano.js (10 nov 2026, groepschat): een piano om op te spelen, deuntjes op te nemen en af te spelen.
//
// Het geluid maakt de telefoon zelf (Web Audio, geen geluidsbestanden). Een deuntje is alleen een lijstje noten
// [[toon, begin_ms, duur_ms], ...]; dat gaat als gewoon versleuteld groepsbericht 'deuntje:{...}' de groep in
// (een paar KB), zodat iedereen het kan afspelen.

export const MAX_NOTEN = 400
export const MAX_MS = 60000
export const LAAGSTE = 36, HOOGSTE = 96   // C2 .. C7

// een deuntje van buiten controleren
export function leesDeuntje(json) {
  try {
    const d = JSON.parse(json)
    if (!d || !Array.isArray(d.n) || !d.n.length) return null
    const n = []
    for (const x of d.n.slice(0, MAX_NOTEN)) {
      if (!Array.isArray(x) || x.length < 3) continue
      const toon = Math.round(Number(x[0])), t = Math.round(Number(x[1])), duur = Math.round(Number(x[2]))
      if (!(toon >= LAAGSTE && toon <= HOOGSTE) || !(t >= 0 && t <= MAX_MS) || !(duur > 0)) continue
      n.push([toon, t, Math.min(duur, 4000)])
    }
    if (!n.length) return null
    n.sort((a, b) => a[1] - b[1])
    return { naam: typeof d.naam === 'string' && d.naam.trim() ? d.naam.trim().slice(0, 40) : '', n }
  } catch (e) { return null }
}
export const lengteMs = d => d.n.reduce((m, x) => Math.max(m, x[1] + x[2]), 0)

// ── het geluid ──
let ac = null
function context() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!ac && AC) ac = new AC()
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {})
  return ac
}
const hz = toon => 440 * Math.pow(2, (toon - 69) / 12)
// een pianoachtige toon: driehoek + sinus een octaaf hoger, snel aan en langzaam uitsterven
function speelToon(toon, wanneer, duur, sterkte = 0.22) {
  const c = context()
  if (!c) return () => {}
  const t0 = Math.max(c.currentTime, wanneer || c.currentTime)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(sterkte, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(sterkte * 0.35, t0 + 0.25)
  g.connect(c.destination)
  const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = hz(toon)
  const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(toon) * 2
  const g2 = c.createGain(); g2.gain.value = 0.25
  o1.connect(g); o2.connect(g2); g2.connect(g)
  o1.start(t0); o2.start(t0)
  let gestopt = false
  const stop = (op) => {
    if (gestopt) return; gestopt = true
    const t = Math.max(c.currentTime, op || c.currentTime)
    g.gain.cancelScheduledValues(t)
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    o1.stop(t + 0.4); o2.stop(t + 0.4)
  }
  if (duur) stop(t0 + duur / 1000)
  return stop
}

// ── een deuntje afspelen (opAanslag(toon, aan) om toetsen op te laten lichten) ──
export function speelDeuntje(d, { opAanslag, opKlaar } = {}) {
  const c = context()
  if (!c) { opKlaar && opKlaar(); return () => {} }
  const start = c.currentTime + 0.08
  const timers = []
  const stops = []
  for (const [toon, t, duur] of d.n) {
    stops.push(speelToon(toon, start + t / 1000, duur))
    if (opAanslag) {
      timers.push(setTimeout(() => opAanslag(toon, true), 80 + t))
      timers.push(setTimeout(() => opAanslag(toon, false), 80 + t + duur))
    }
  }
  timers.push(setTimeout(() => opKlaar && opKlaar(), 80 + lengteMs(d) + 300))
  return () => { for (const x of timers) clearTimeout(x); for (const s of stops) s(); opKlaar && opKlaar() }
}

// ── het toetsenbord (een octaaf + de C erboven, met octaaf lager/hoger) ──
const WIT = [0, 2, 4, 5, 7, 9, 11, 12]
const ZWART = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]] // [halve toon, na witte toets nr]
const NAMEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const toonNaam = toon => NAMEN[toon % 12] + (Math.floor(toon / 12) - 1)

export function maakPiano(el, { opNoot } = {}) {
  let basis = 60 // C4
  const toetsen = new Map() // toon -> element
  const aan = new Map()     // pointerId -> { toon, stop, begin }
  const opname = { bezig: false, begin: 0, noten: [] }
  function teken() {
    el.innerHTML = ''
    toetsen.clear()
    WIT.forEach((s, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'p-wit'; b.dataset.toon = basis + s
      b.setAttribute('aria-label', toonNaam(basis + s)); b.textContent = s % 12 === 0 ? toonNaam(basis + s) : ''
      b.style.left = (i * 100 / WIT.length) + '%'; b.style.width = (100 / WIT.length) + '%'
      el.appendChild(b); toetsen.set(basis + s, b)
    })
    for (const [s, na] of ZWART) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'p-zwart'; b.dataset.toon = basis + s
      b.setAttribute('aria-label', toonNaam(basis + s))
      b.style.left = ((na + 1) * 100 / WIT.length - 100 / WIT.length * 0.3) + '%'; b.style.width = (100 / WIT.length * 0.6) + '%'
      el.appendChild(b); toetsen.set(basis + s, b)
    }
  }
  function neer(e) {
    const b = e.target.closest('[data-toon]')
    if (!b) return
    e.preventDefault()
    try { el.setPointerCapture(e.pointerId) } catch (er) {}
    druk(e.pointerId, Number(b.dataset.toon))
  }
  function druk(id, toon) {
    los(id)
    const stop = speelToon(toon, 0, 0)
    aan.set(id, { toon, stop, begin: performance.now() })
    licht(toon, true)
    opNoot && opNoot(toon)
  }
  function los(id) {
    const a = aan.get(id)
    if (!a) return
    aan.delete(id)
    a.stop(); licht(a.toon, false)
    if (opname.bezig && opname.noten.length < MAX_NOTEN) {
      const t = Math.round(a.begin - opname.begin)
      if (t >= 0 && t <= MAX_MS) opname.noten.push([a.toon, t, Math.max(60, Math.round(performance.now() - a.begin))])
    }
  }
  // over de toetsen glijden = de volgende toon
  function beweeg(e) {
    const a = aan.get(e.pointerId)
    if (!a) return
    const b = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-toon]')
    if (b && el.contains(b) && Number(b.dataset.toon) !== a.toon) druk(e.pointerId, Number(b.dataset.toon))
  }
  function licht(toon, aanUit) { const b = toetsen.get(toon); if (b) b.classList.toggle('aan', aanUit) }
  el.addEventListener('pointerdown', neer)
  el.addEventListener('pointermove', beweeg)
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, e => los(e.pointerId))
  teken()
  return {
    licht,
    octaaf(stap) { const n = basis + stap * 12; if (n >= LAAGSTE && n + 12 <= HOOGSTE) { basis = n; teken() } return toonNaam(basis) },
    basisNaam: () => toonNaam(basis),
    neemOp() { opname.bezig = true; opname.begin = performance.now(); opname.noten = [] },
    stopOpname() {
      for (const id of [...aan.keys()]) los(id)
      opname.bezig = false
      return opname.noten.slice()
    },
    neemtOp: () => opname.bezig,
    opnameDuur: () => opname.bezig ? performance.now() - opname.begin : 0,
    wek: () => context(),
  }
}
