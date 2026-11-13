// koningsjacht-geluid.js - stoere geluiden en epische achtergrondmuziek voor Koningsjacht (v1, 13 nov 2026, Marcel).
//
// In gewone woorden: alles wordt hier met Web Audio gemaakt (geen geluidsbestanden, dus ook geen auteursrecht van
// iemand anders). Zwaardslagen, inslagen, een schild dat klinkt als metaal, genezen, een vijand die brult en
// terugslaat, een oorlogshoorn bij een nieuwe vijand, fanfares bij verslagen en winnen.
// De muziek: een epische mars in d-klein (pauken/taiko's, strijkers, een koor en hoorns) die steeds doorloopt.
// Aan of uit met de knop 🎵 (bewaard op dit toestel: fibro_koningsjacht_muziek). Het spelmenu (☰ > Geluid uit)
// zet ook dit geluid uit (spelmenu.js doet dat voor elk Web Audio-geluid); bij Pauze staat de muziek stil.

let ac = null, hoofd = null, galm = null
const MUZIEK_SLEUTEL = 'fibro_koningsjacht_muziek'

function ctx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!ac && AC) {
      ac = new AC()
      hoofd = ac.createDynamicsCompressor()
      hoofd.threshold.value = -12; hoofd.ratio.value = 12; hoofd.attack.value = 0.002; hoofd.release.value = 0.25
      const eind = ac.createGain(); eind.gain.value = 0.72   // ruimte, zodat harde klappen niet kraken
      hoofd.connect(eind); eind.connect(ac.destination)
      galm = ac.createConvolver(); galm.buffer = galmBuffer(2.6)
      const terug = ac.createGain(); terug.gain.value = 0.32
      galm.connect(terug); terug.connect(hoofd)
    }
    if (ac && ac.state === 'suspended' && !gepauzeerd) ac.resume().catch(() => {})
  } catch (e) { return null }
  return ac
}
// 13 nov 2026 (Marcel: 'het geluid werkt niet'): op een iPhone mag het geluid alleen aangaan tijdens een tik. De
// geluiden komen pas na een animatie (dus niet tijdens de tik), en dan bleef alles stil. Daarom: bij elke tik het
// geluid openzetten, en de eerste keer een stil geluidje spelen (oudere iPhones openen het geluid pas echt daarmee).
// Let op: staat de iPhone op stil (het schuifje aan de zijkant), dan blijft Web Audio stil; dat is bij elk spel zo.
let stilGespeeld = false
function ontgrendel() {
  const a = ctx()
  if (!a || stilGespeeld) return
  try { const b = a.createBufferSource(); b.buffer = a.createBuffer(1, 1, 22050); b.connect(a.destination); b.start(0); stilGespeeld = true } catch (e) {}
}
if (typeof document !== 'undefined') for (const soort of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(soort, ontgrendel, { capture: true, passive: true })
export const geluidStaat = () => (ac ? ac.state : 'geen')   // voor de tests: 'running' = het geluid staat open

// Een nagalm (zaal) zonder bestand: ruis die langzaam uitsterft
function galmBuffer(sec) {
  const len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate)
  for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) }
  return b
}
const ruisBuffers = new Map()
function ruisBuffer(sec) {
  const key = Math.round(sec * 100)
  if (ruisBuffers.has(key)) return ruisBuffers.get(key)
  const len = Math.max(1, Math.floor(ac.sampleRate * sec)), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  ruisBuffers.set(key, b); return b
}
// Naar de uitgang, met een beetje (of veel) galm
function uit(node, nat = 0.25, droog = 1) {
  const g = ac.createGain(); g.gain.value = droog; node.connect(g); g.connect(hoofd)
  if (nat) { const n = ac.createGain(); n.gain.value = nat; node.connect(n); n.connect(galm) }
}
function vervorm(hard = 40) {
  const w = ac.createWaveShaper(), n = 1024, c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + hard) * x / (1 + hard * Math.abs(x)) }
  w.curve = c; return w
}

// ── Bouwstenen ──
function ruis(t, duur, { type = 'bandpass', van = 2000, naar = 2000, q = 1, luid = 0.3, nat = 0.2 } = {}) {
  const b = ac.createBufferSource(); b.buffer = ruisBuffer(duur + 0.05)
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q
  f.frequency.setValueAtTime(van, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, naar), t + duur)
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(luid, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
  b.connect(f); f.connect(g); uit(g, nat); b.start(t); b.stop(t + duur + 0.05)
}
function osc(t, freq, duur, { type = 'sine', luid = 0.2, naar = null, aan = 0.005, nat = 0.25, filter = null } = {}) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t)
  if (naar) o.frequency.exponentialRampToValueAtTime(naar, t + duur)
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(luid, t + aan); g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
  let laatste = o
  if (filter) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); laatste = f }
  laatste.connect(g); uit(g, nat); o.start(t); o.stop(t + duur + 0.05)
}
// Een zware klap: lage toon die wegzakt, met een stofwolk van ruis
function boem(t, kracht = 1) {
  const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110 + 30 * kracht, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.45)
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75 * Math.min(1.3, kracht), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
  const v = vervorm(8); o.connect(v); v.connect(g); uit(g, 0.35); o.start(t); o.stop(t + 0.65)
  ruis(t, 0.35, { type: 'lowpass', van: 2400, naar: 120, q: 0.7, luid: 0.45 * kracht, nat: 0.3 })
}
// Metaal: een paar niet-harmonische tonen die lang naklinken
function metaal(t, basis = 520, luid = 0.12, duur = 1.3) {
  for (const [m, l] of [[1, 1], [2.38, 0.7], [3.48, 0.5], [5.1, 0.35], [6.9, 0.2]]) osc(t, basis * m, duur * (1.1 - m / 10), { type: 'sine', luid: luid * l, aan: 0.002, nat: 0.4 })
}
const noot = n => 440 * Math.pow(2, (n - 69) / 12)   // MIDI-nummer -> Hz

// ── De geluiden van het spel ──
const G = {
  // het zwaard gaat door de lucht en raakt: 'sjiing' + een klap. kracht 1 = gewoon, 2 = hard
  zwaard(kracht = 1) {
    const t = ac.currentTime + 0.01
    ruis(t, 0.22, { van: 1500, naar: 7000, q: 3, luid: 0.22, nat: 0.15 })
    metaal(t + 0.16, 1180, 0.05, 0.7)
    boem(t + 0.18, kracht)
  },
  // klaveren: dubbele schade = twee slagen kort na elkaar, de tweede harder
  dubbel() {
    const t = ac.currentTime + 0.01
    ruis(t, 0.18, { van: 1800, naar: 7500, q: 3, luid: 0.2 }); boem(t + 0.14, 1)
    ruis(t + 0.26, 0.18, { van: 1400, naar: 8000, q: 3, luid: 0.24 }); boem(t + 0.4, 1.6); metaal(t + 0.4, 990, 0.06, 0.9)
  },
  // schoppen: een schild schuift ervoor, klinkt als een grote gong
  schild() {
    const t = ac.currentTime + 0.01
    metaal(t, 330, 0.16, 2.2); metaal(t + 0.02, 495, 0.08, 1.6)
    ruis(t, 0.5, { van: 300, naar: 2400, q: 0.8, luid: 0.12, nat: 0.4 })
  },
  // harten: genezen, een glinsterend loopje omhoog
  genezen() {
    const t = ac.currentTime + 0.01
    ;[74, 77, 81, 84, 86, 89, 93].forEach((n, i) => osc(t + i * 0.07, noot(n), 0.9, { type: 'triangle', luid: 0.07, nat: 0.6 }))
    osc(t, noot(62), 1.6, { type: 'sine', luid: 0.08, aan: 0.3, nat: 0.6 })
  },
  // ruiten: kaarten pakken, een windvlaag met fonkels
  pakken() {
    const t = ac.currentTime + 0.01
    ruis(t, 0.5, { van: 600, naar: 5000, q: 0.7, luid: 0.16, nat: 0.4 })
    for (let i = 0; i < 6; i++) osc(t + 0.05 + i * 0.06, noot(88 + (i * 5) % 12), 0.35, { type: 'sine', luid: 0.08, nat: 0.6 })
  },
  // de vijand kan tegen deze soort: een doffe klank, alsof je tegen steen slaat
  immuun() {
    const t = ac.currentTime + 0.01
    ruis(t, 0.25, { type: 'lowpass', van: 900, naar: 200, luid: 0.3 })
    osc(t, 98, 0.5, { type: 'sawtooth', luid: 0.12, naar: 73, filter: 500, nat: 0.2 })
    osc(t + 0.05, 92, 0.5, { type: 'sawtooth', luid: 0.1, naar: 69, filter: 500, nat: 0.2 })
  },
  // de vijand brult en slaat terug
  vijandSlaat(kracht = 1) {
    const t = ac.currentTime + 0.01
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(62, t); o.frequency.linearRampToValueAtTime(48, t + 0.7)
    const lfo = ac.createOscillator(); lfo.frequency.value = 23; const lg = ac.createGain(); lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency)
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1300, t + 0.25); f.frequency.linearRampToValueAtTime(250, t + 0.75)
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
    const v = vervorm(20); o.connect(v); v.connect(f); f.connect(g); uit(g, 0.3); o.start(t); lfo.start(t); o.stop(t + 0.85); lfo.stop(t + 0.85)
    ruis(t + 0.35, 0.3, { van: 800, naar: 5000, q: 1.5, luid: 0.2 })
    boem(t + 0.55, 1.2 * kracht)
  },
  // afweren: je schild vangt de klap op
  afweren() {
    const t = ac.currentTime + 0.01
    boem(t, 0.7); metaal(t, 640, 0.1, 1.1)
  },
  // een nieuwe vijand: een oorlogshoorn en een paukenslag
  hoorn() {
    const t = ac.currentTime + 0.05
    for (const [d, l] of [[0, 0.16], [7, 0.12], [-12, 0.1]]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(noot(50 + d) * 0.94, t); o.frequency.exponentialRampToValueAtTime(noot(50 + d), t + 0.25)
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1500, t + 0.4); f.frequency.linearRampToValueAtTime(700, t + 1.4)
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(l, t + 0.2); g.gain.setValueAtTime(l, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
      o.connect(f); f.connect(g); uit(g, 0.5); o.start(t); o.stop(t + 1.7)
    }
    boem(t, 1)
  },
  // verslagen: de vijand valt (gekraak) en een korte fanfare
  verslagen(precies = false) {
    const t = ac.currentTime + 0.01
    ruis(t, 0.9, { type: 'lowpass', van: 3000, naar: 80, q: 0.5, luid: 0.4, nat: 0.4 })
    for (let i = 0; i < 7; i++) ruis(t + 0.05 + Math.random() * 0.5, 0.06, { van: 1500 + Math.random() * 2500, naar: 800, q: 2, luid: 0.12 })
    fanfare(t + 0.35, precies ? [62, 66, 69, 74, 78] : [62, 65, 69, 74], 0.16)
  },
  // een nar: belletjes en een gekke sprong
  nar() {
    const t = ac.currentTime + 0.01
    for (let i = 0; i < 10; i++) osc(t + i * 0.05, noot(84 + [0, 4, 7, 12, 7, 4, 9, 12, 16, 19][i]), 0.25, { type: 'triangle', luid: 0.1, nat: 0.3 })
    osc(t + 0.5, 300, 0.3, { type: 'square', luid: 0.05, naar: 900, filter: 2000 })
  },
  passen() { const t = ac.currentTime + 0.01; ruis(t, 0.3, { van: 400, naar: 1200, q: 0.6, luid: 0.1 }) },
  win() { const t = ac.currentTime + 0.01; fanfare(t, [62, 66, 69, 74, 78, 81, 86], 0.22); boem(t, 1.2); boem(t + 1.1, 1.4) },
  verlies() {
    const t = ac.currentTime + 0.01; boem(t, 1.4)
    for (const n of [38, 41, 45, 50]) osc(t + 0.1, noot(n), 2.4, { type: 'sawtooth', luid: 0.05, aan: 0.3, filter: 700, nat: 0.5 })
  },
}
// Een korte koperen fanfare (noten als MIDI-nummers)
function fanfare(t, noten, stap = 0.18) {
  noten.forEach((n, i) => {
    const lang = i === noten.length - 1 ? 1.1 : stap * 1.1
    for (const d of [0, 0.06]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = noot(n); o.detune.value = d ? 9 : -9
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t + i * stap); f.frequency.linearRampToValueAtTime(2600, t + i * stap + 0.08)
      const g = ac.createGain(); const s = t + i * stap
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.1, s + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, s + lang)
      o.connect(f); f.connect(g); uit(g, 0.4); o.start(s); o.stop(s + lang + 0.05)
    }
  })
}

export function speel(naam, ...args) {
  if (!ctx() || !G[naam]) return
  try { G[naam](...args) } catch (e) {}
}

// ─────────────── Epische achtergrondmuziek ───────────────
// 16 maten in d-klein, 84 tellen per minuut. Maat 1-8: pauken en strijkers; maat 9-16 komen er een koor en hoorns
// bij met de melodie. Dan begint het weer van voren. Wordt steeds een stukje vooruit ingepland (kijkVooruit).
const BPM = 84, TEL = 60 / BPM
const AKKOORDEN = [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55], [50, 53, 57], [43, 46, 50], [46, 50, 53], [45, 49, 52]]   // Dm Bb F C Dm Gm Bb A
// de melodie (MIDI-nummer, tellen), per maat 4 tellen
const MELODIE = [[[62, 2], [65, 1], [69, 1]], [[70, 3], [69, 1]], [[65, 2], [69, 1], [72, 1]], [[71, 2], [67, 2]],
  [[74, 2], [72, 1], [69, 1]], [[70, 2], [67, 1], [70, 1]], [[74, 1.5], [72, 0.5], [70, 1], [69, 1]], [[69, 4]]]
let muziekAan = false, volgendeMaat = 0, maatTijd = 0, planner = null, muziekGain = null, muziekNat = null, gepauzeerd = false

function strijkers(t, noten, duur, luid) {
  for (const n of noten) for (const d of [-7, 6]) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = noot(n + 12); o.detune.value = d
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(luid, t + duur * 0.3); g.gain.setValueAtTime(luid, t + duur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + duur)
    o.connect(f); f.connect(g); g.connect(muziekGain); const n2 = ac.createGain(); n2.gain.value = 0.5; g.connect(n2); n2.connect(muziekNat)
    o.start(t); o.stop(t + duur + 0.05)
  }
}
function bas(t, n, duur) {
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = noot(n - 12)
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.05); g.gain.setValueAtTime(0.14, t + duur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
  o.connect(f); f.connect(g); g.connect(muziekGain); o.start(t); o.stop(t + duur + 0.05)
}
function pauk(t, luid = 0.5, hoog = false) {
  const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(hoog ? 150 : 95, t); o.frequency.exponentialRampToValueAtTime(hoog ? 70 : 42, t + 0.35)
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(luid, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
  o.connect(g); g.connect(muziekGain); const n = ac.createGain(); n.gain.value = 0.35; g.connect(n); n.connect(muziekNat); o.start(t); o.stop(t + 0.75)
  const b = ac.createBufferSource(); b.buffer = ruisBuffer(0.2)
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900
  const g2 = ac.createGain(); g2.gain.setValueAtTime(luid * 0.4, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
  b.connect(f); f.connect(g2); g2.connect(muziekGain); b.start(t); b.stop(t + 0.2)
}
function koor(t, noten, duur) {
  for (const n of noten) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = noot(n + 12)
    const vib = ac.createOscillator(); vib.frequency.value = 5.2; const vg = ac.createGain(); vg.gain.value = 3.5; vib.connect(vg); vg.connect(o.frequency)
    const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 750; f1.Q.value = 5
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + duur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + duur)
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g)
    const n2 = ac.createGain(); n2.gain.value = 0.9; g.connect(n2); n2.connect(muziekNat); g.connect(muziekGain)
    o.start(t); vib.start(t); o.stop(t + duur + 0.05); vib.stop(t + duur + 0.05)
  }
}
function hoornNoot(t, n, duur) {
  for (const d of [-6, 5]) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = noot(n); o.detune.value = d
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1700, t + Math.min(0.3, duur * 0.5)); f.frequency.linearRampToValueAtTime(900, t + duur)
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.06); g.gain.setValueAtTime(0.055, t + duur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
    o.connect(f); f.connect(g); g.connect(muziekGain); const n2 = ac.createGain(); n2.gain.value = 0.6; g.connect(n2); n2.connect(muziekNat)
    o.start(t); o.stop(t + duur + 0.05)
  }
}
function planMaat(maat, t) {
  const i = maat % 16, a = AKKOORDEN[i % 8], lang = TEL * 4
  strijkers(t, a, lang + 0.1, i < 8 ? 0.022 : 0.03)
  bas(t, a[0], TEL * 2); bas(t + TEL * 2, a[0], TEL * 2)
  // pauken: BOEM .. boem-boem BOEM .. ; de laatste maat van elk deel een roffel
  const slagen = (i % 8 === 7) ? [[0, 0.6], [1, 0.35], [1.5, 0.35], [2, 0.45], [2.5, 0.45], [3, 0.5], [3.25, 0.5], [3.5, 0.55], [3.75, 0.6]]
    : [[0, 0.6], [1.5, 0.3], [2, 0.45], [2.75, 0.25], [3, 0.4]]
  for (const [tel, l] of slagen) pauk(t + tel * TEL, l, tel % 1 !== 0)
  if (i >= 8) {
    koor(t, a, lang + 0.1)
    let tel = 0
    for (const [n, d] of MELODIE[i - 8]) { hoornNoot(t + tel * TEL, n, d * TEL * 0.95); tel += d }
  }
}
function kijkVooruit() {
  if (!muziekAan || !ac) return
  while (maatTijd < ac.currentTime + 1.2) { planMaat(volgendeMaat, maatTijd); maatTijd += TEL * 4; volgendeMaat++ }
}
export function muziekStaatAan() { try { return localStorage.getItem(MUZIEK_SLEUTEL) === 'aan' } catch (e) { return false } }
export function zetMuziek(aan) {
  try { localStorage.setItem(MUZIEK_SLEUTEL, aan ? 'aan' : 'uit') } catch (e) {}
  if (aan) startMuziek(); else stopMuziek()
}
export function startMuziek() {
  if (muziekAan || !ctx()) return
  muziekAan = true
  muziekGain = ac.createGain(); muziekGain.gain.setValueAtTime(0.0001, ac.currentTime); muziekGain.gain.exponentialRampToValueAtTime(0.7, ac.currentTime + 1.5)
  muziekGain.connect(hoofd)
  muziekNat = ac.createGain(); muziekNat.gain.value = 1; muziekNat.connect(galm)   // de galm van de muziek, met de muziek mee uit
  volgendeMaat = 0; maatTijd = ac.currentTime + 0.15
  kijkVooruit(); planner = setInterval(kijkVooruit, 250)
}
export function stopMuziek() {
  if (!muziekAan) return
  muziekAan = false; clearInterval(planner); planner = null
  for (const g of [muziekGain, muziekNat]) {
    try { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.6) } catch (e) {}
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, 800)
  }
  muziekGain = null; muziekNat = null
}
export const speeltMuziek = () => muziekAan
// Pauze (spelmenu): alles stil, daarna gewoon verder
if (typeof window !== 'undefined') window.addEventListener('fibro-spel-pauze', e => {
  gepauzeerd = Boolean(e.detail && e.detail.aan)
  if (!ac) return
  if (gepauzeerd) ac.suspend().catch(() => {}); else ac.resume().catch(() => {})
})
