// studio-geluid.js (23 nov 2026, Stekky Studio) - een eigen geluid voor een sticker opruimen en er een kleine mp3 van maken.
// Geen scherm en geen Web Audio nodig (alleen getallen), zodat het ook in de tests draait; het inlezen van het bestand
// (decodeAudioData) en het laden van lame.min.js doet studio-ui.js. Dezelfde afwerking als de geluiden die er al zijn
// (tests/tools/geluiden6.py): stilte eraf, korte fade, even hard (RMS -21 dB), piek hoogstens -1 dB, mono, 64 kbps.

export const SAMPLERATE = 44100
export const MAX_SEC = 3               // een stickergeluid is kort; langer wordt ingekort
export const MIN_SEC = 0.05            // korter dan 50 ms is geen geluid
export const DOEL_RMS_DB = -21
export const MAX_PIEK_DB = -1
export const STILTE = 0.01             // onder -40 dB telt als stilte aan het begin en eind
export const KBPS = 64

const db = x => 20 * Math.log10(Math.max(x, 1e-9))
const van_db = d => Math.pow(10, d / 20)

// Meerdere kanalen (links, rechts) worden één kanaal: het gemiddelde.
export function naarMono(kanalen) {
  if (!kanalen.length) return new Float32Array(0)
  if (kanalen.length === 1) return Float32Array.from(kanalen[0])
  const uit = new Float32Array(kanalen[0].length)
  for (const k of kanalen) for (let i = 0; i < uit.length; i++) uit[i] += k[i] / kanalen.length
  return uit
}

// De stilte aan het begin en eind eraf (met 5 ms ruimte), zodat het geluid meteen begint als je tikt.
export function knipStilte(x, sr = SAMPLERATE, drempel = STILTE) {
  let a = 0, b = x.length - 1
  while (a < x.length && Math.abs(x[a]) < drempel) a++
  while (b > a && Math.abs(x[b]) < drempel) b--
  if (a >= x.length) return new Float32Array(0)
  const ruimte = Math.round(sr * 0.005)
  return x.slice(Math.max(0, a - ruimte), Math.min(x.length, b + 1 + ruimte))
}

// Een zachte in- en uitfade (standaard 12 ms), tegen tikjes aan het begin en eind. Verandert x zelf.
export function fade(x, sr = SAMPLERATE, msIn = 12, msUit = 12) {
  const n1 = Math.min(Math.round(sr * msIn / 1000), x.length >> 1), n2 = Math.min(Math.round(sr * msUit / 1000), x.length >> 1)
  for (let i = 0; i < n1; i++) x[i] *= i / n1
  for (let i = 0; i < n2; i++) x[x.length - 1 - i] *= i / n2
  return x
}

// RMS en piek in dB (dBFS) van het stuk
export function meet(x) {
  if (!x.length) return { rmsDb: -Infinity, piekDb: -Infinity }
  let som = 0, piek = 0
  for (let i = 0; i < x.length; i++) { som += x[i] * x[i]; const a = Math.abs(x[i]); if (a > piek) piek = a }
  return { rmsDb: db(Math.sqrt(som / x.length)), piekDb: db(piek) }
}

// Even hard als de andere stickergeluiden: RMS -21 dB, maar de piek blijft onder -1 dB (anders gaat het kraken).
export function maakEvenHard(x, doelRmsDb = DOEL_RMS_DB, maxPiekDb = MAX_PIEK_DB) {
  const { rmsDb, piekDb } = meet(x)
  if (!isFinite(rmsDb)) return x
  const versterking = van_db(Math.min(doelRmsDb - rmsDb, maxPiekDb - piekDb))
  const uit = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) uit[i] = x[i] * versterking
  return uit
}

// Alles achter elkaar. x: mono, op SAMPLERATE (studio-ui.js zet het eerst om). Geeft { samples, duur, rmsDb, piekDb, ingekort }
// of { fout: '...' } in gewoon Nederlands.
export function verwerk(x, sr = SAMPLERATE) {
  if (!x || !x.length) return { fout: 'Dit bestand bevat geen geluid.' }
  let y = knipStilte(x, sr)
  if (y.length < sr * MIN_SEC) return { fout: 'Dit geluid is bijna stil of veel te kort.' }
  let ingekort = false
  const max = Math.round(sr * MAX_SEC)
  if (y.length > max) { y = y.slice(0, max); ingekort = true }
  y = Float32Array.from(y)
  fade(y, sr, 12, ingekort ? 150 : 12)
  const hard = maakEvenHard(y)
  const m = meet(hard)
  return { samples: hard, duur: hard.length / sr, rmsDb: m.rmsDb, piekDb: m.piekDb, ingekort }
}

export function naarInt16(x) {
  const uit = new Int16Array(x.length)
  for (let i = 0; i < x.length; i++) { const s = Math.max(-1, Math.min(1, x[i])); uit[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7FFF) }
  return uit
}

// mp3 maken met lamejs (lame.min.js). lamejs wordt meegegeven, zodat dit ook buiten de browser kan. Geeft Uint8Array.
export function codeerMp3(samples, lamejs, sr = SAMPLERATE, kbps = KBPS) {
  const enc = new lamejs.Mp3Encoder(1, sr, kbps)
  const pcm = naarInt16(samples), delen = []
  for (let i = 0; i < pcm.length; i += 1152) {
    const d = enc.encodeBuffer(pcm.subarray(i, i + 1152))
    if (d.length) delen.push(d)
  }
  const staart = enc.flush()
  if (staart.length) delen.push(staart)
  const lengte = delen.reduce((n, d) => n + d.length, 0), uit = new Uint8Array(lengte)
  let pos = 0
  for (const d of delen) { uit.set(new Uint8Array(d.buffer, d.byteOffset, d.length), pos); pos += d.length }
  return uit
}
