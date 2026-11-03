// buzzgeluid.js (v1, 3 nov 2026): het buzzgeluid, ook op de iPhone meteen hoorbaar.
//
// Wat er mis was (Marcel, 3 nov): op de iPhone schudde het scherm bij een buzz wel, maar het geluid kwam soms pas als je
// het scherm aanraakte. Het buzzgeluid liep via Web Audio (AudioContext). Op de iPhone mag die pas klinken na een tik,
// en Safari zet hem stil ('interrupted' of 'suspended') zodra Fibro even op de achtergrond was of het scherm uit ging.
// In de chat kwam er zelfs bij elke buzz een NIEUWE AudioContext, die op de iPhone altijd stil begint.
//
// Nu zoals de stickergeluiden (stickerfx.js), die dit probleem niet hebben: een gewone geluidsspeler (<audio>) die bij
// elke tik even 'gezegend' wordt (een stil stukje van 50 ms). Een gezegende speler mag daarna ook zonder tik geluid
// maken, ook na de achtergrond. Het geluid zelf (dezelfde zoemende zaagtand als altijd) maakt dit bestand als WAV.
// Lukt het toch niet (nog nooit getikt op deze pagina), dan klinkt de buzz alsnog bij de eerste tik binnen 4 seconden.

const SR = 22050
const SPELERS = 2
let buzzUrl = null, stilUrl = null

function wavUrl(samples) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf)
  const zet = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)) }
  zet(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); zet(8, 'WAVE'); zet(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); zet(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

// Hetzelfde geluid als vroeger met Web Audio: zaagtand 95 Hz, 78 Hz (0,35-0,7 s), weer 95 Hz; 15 keer aan (0,28) en
// bijna uit (0,02), 0,07 s per keer; na 1,05 s stil.
export function buzzSamples() {
  const n = Math.round(SR * 1.1), uit = new Float32Array(n)
  let fase = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const f = t >= 0.35 && t < 0.7 ? 78 : 95
    fase += f / SR
    const zaag = 2 * (fase - Math.floor(fase + 0.5))
    let g = 0
    if (t < 1.05) { const k = Math.floor(t / 0.07); g = k < 15 && (t - k * 0.07) < 0.035 ? 0.28 : 0.02 }
    uit[i] = zaag * g
  }
  return uit
}
function buzz() { return buzzUrl || (buzzUrl = wavUrl(buzzSamples())) }
function stil() { return stilUrl || (stilUrl = wavUrl(new Float32Array(Math.round(SR * 0.05)))) }

const spelers = []
function nieuweSpeler() {
  const a = new Audio()
  a.preload = 'auto'
  a.dataset.stickerfx = '1' // geluidregelaar.js: een kort geluid, de muziek wacht even
  try { a.disableRemotePlayback = true } catch (e) {}
  spelers.push(a)
  return a
}

// Bij elke tik: spelers die nog niet gezegend zijn (of het niet meer zijn) even een stil stukje laten spelen
function zegen() {
  while (spelers.length < SPELERS) nieuweSpeler()
  if (wachtend && Date.now() - wachtend < 4000) { wachtend = 0; speel(); return } // alsnog, bij deze tik
  wachtend = 0
  for (const a of spelers) {
    if (a._ok || a._bezig || !a.paused) continue
    a._bezig = true
    try {
      a.src = stil()
      const p = a.play()
      const klaar = ok => { a._bezig = false; a._ok = ok; try { if (ok) a.pause() } catch (e) {} }
      if (p && p.then) p.then(() => klaar(true), () => klaar(false)); else klaar(true)
    } catch (e) { a._bezig = false }
  }
}
if (typeof document !== 'undefined') {
  for (const soort of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(soort, zegen, { passive: true, capture: true })
}

let wachtend = 0
function speel() {
  while (spelers.length < SPELERS) nieuweSpeler()
  const a = spelers.find(x => x._ok && x.paused && !x._bezig) || spelers.find(x => x.paused && !x._bezig) || spelers[0]
  try {
    a.src = buzz()
    a.currentTime = 0
    const p = a.play()
    if (p && p.catch) p.catch(() => { a._ok = false; wachtend = Date.now() }) // niet mogen: bij de volgende tik alsnog
    return a
  } catch (e) { wachtend = Date.now(); return null }
}

export function speelBuzz() {
  try { window.dispatchEvent(new CustomEvent('fibro-geluid', { detail: { soort: 'kort', ms: 1150 } })) } catch (e) {}
  return speel()
}
