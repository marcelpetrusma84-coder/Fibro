// onderwerp.js (v232; v2 = v265: voortgang van het laden, opVoortgang): in het Stickerlab 'Tik op het onderwerp': je tikt (of drukt) op iets in je foto, en
// alleen dat ding blijft over. Het slimme knippen doet MediaPipe met het model MagicTouch van Google
// (Apache 2.0, zie BIBLIOTHEKEN.txt en onderwerp/LICENSE.txt). Alles gebeurt op je eigen toestel: de foto gaat
// nergens heen. De bibliotheek (± 15 MB) en het model (± 30 MB) worden pas geladen als iemand dit voor het eerst gebruikt.
//
// Gebruik:  const knipper = await laadKnipper()        (eenmalig; daarna meteen klaar)
//           knipper.zetAfbeelding(doek)                 (zwaar werk, een keer per afbeelding)
//           const uit = knipper.knip(stippen)           (snel; stippen = [{ x, y, erbij }] in pixels van de afbeelding)
const BIBLIOTHEEK = './onderwerp/vision_bundle.mjs'
const WASM_MAP = 'onderwerp/wasm'
const MODEL = 'onderwerp/interactive_segmentation.task'

let laden = null

// Kan dit toestel het? (WebAssembly met SIMD: Chrome 91+, Safari 16.4+, Firefox 89+)
export function kanHet() {
  try {
    if (typeof WebAssembly !== 'object') return false
    // een heel klein programma met SIMD-opdrachten (zoals wasm-feature-detect het doet)
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]))
  } catch (e) { return false }
}

// Stippen (pixels van de afbeelding) naar de streken van MediaPipe (tussen 0 en 1)
export function naarStreken(stippen, breedte, hoogte, BrushMode = { POSITIVE: 1, NEGATIVE: 2 }) {
  const binnen = v => Math.max(0, Math.min(1, v))
  return (stippen || []).map(s => {
    const p = { x: binnen(s.x / breedte), y: binnen(s.y / hoogte) }
    return { brushMode: s.erbij === false ? BrushMode.NEGATIVE : BrushMode.POSITIVE, point: [p, p], isCompleted: true }
  })
}

// Zekerheid van het model (0..1) naar doorzichtigheid, met een zachte rand
export function zekerheidNaarAlfa(v) {
  const a = (Number(v) - 0.35) / 0.3
  return Math.round(Math.max(0, Math.min(1, a)) * 255)
}

// v265: hoe ver het laden is, zodat het Stickerlab dat kan laten zien ("12 van 45 MB").
// De twee grote bestanden (programma ± 14 MB, model ± 30 MB) haalt dit bestand zelf op, stukje voor stukje.
// Het programma komt daarna uit de browsercache als MediaPipe het opvraagt; het model gaat direct mee.
const GROOT = [
  { pad: WASM_MAP + '/vision_wasm_internal.wasm', schatting: 14466654 },
  { pad: MODEL, schatting: 30525312 },
]
let stand = { geladen: 0, totaal: GROOT.reduce((s, b) => s + b.schatting, 0), klaar: false }
const luisteraars = new Set()
function meldStand() { for (const f of luisteraars) { try { f(stand) } catch (e) {} } }
export function opVoortgang(f) { luisteraars.add(f); f(stand); return () => luisteraars.delete(f) }

// Een bestand ophalen en onderweg tellen. Lukt tellen niet (geen stroom), dan gewoon in een keer.
export async function haalMetVoortgang(adres, telBij, haal = fetch) {
  const res = await haal(adres)
  if (!res.ok) throw new Error('laden-' + res.status)
  if (!res.body || !res.body.getReader) { const b = new Uint8Array(await res.arrayBuffer()); telBij(b.length); return b }
  const lezer = res.body.getReader(), stukken = []
  let n = 0
  for (;;) {
    const { done, value } = await lezer.read()
    if (done) break
    stukken.push(value); n += value.length; telBij(value.length)
  }
  const uit = new Uint8Array(n)
  let p = 0
  for (const s of stukken) { uit.set(s, p); p += s.length }
  return uit
}

export function laadKnipper() {
  if (laden) return laden
  laden = (async () => {
    if (!kanHet()) throw new Error('te-oud')
    stand = { geladen: 0, totaal: stand.totaal, klaar: false }; meldStand()
    const tel = n => { stand.geladen = Math.min(stand.totaal, stand.geladen + n); meldStand() }
    const [lib, , model] = await Promise.all([
      import(BIBLIOTHEEK),
      haalMetVoortgang(new URL(GROOT[0].pad, location.href).href, tel),
      haalMetVoortgang(new URL(GROOT[1].pad, location.href).href, tel),
    ])
    const { FilesetResolver, InteractiveSegmenter, BrushMode } = lib
    const map = new URL(WASM_MAP, location.href).href
    const bestanden = await FilesetResolver.forVisionTasks(map)
    const seg = await InteractiveSegmenter.createFromOptions(bestanden, {
      baseOptions: { modelAssetBuffer: model, delegate: 'CPU' }
    })
    stand = { geladen: stand.totaal, totaal: stand.totaal, klaar: true }; meldStand()
    let huidige = null

    function zetAfbeelding(doek) {
      if (huidige === doek) return
      seg.setImage(doek)
      huidige = doek
    }

    // Een nieuw doek zo groot als de afbeelding: alleen het onderwerp, de rest doorzichtig
    function knip(stippen) {
      if (!huidige) throw new Error('geen-afbeelding')
      const w = huidige.width, h = huidige.height
      const masker = seg.segment(naarStreken(stippen, w, h, BrushMode))
      try {
        const mw = masker.width, mh = masker.height
        const z = masker.getAsFloat32Array()
        // het masker als plaatje (alleen doorzichtigheid), daarna geschaald over de afbeelding gelegd
        const m = document.createElement('canvas'); m.width = mw; m.height = mh
        const mp = m.getContext('2d'), md = mp.createImageData(mw, mh)
        for (let i = 0; i < mw * mh; i++) md.data[i * 4 + 3] = zekerheidNaarAlfa(z[i])
        mp.putImageData(md, 0, 0)
        const uit = document.createElement('canvas'); uit.width = w; uit.height = h
        const p = uit.getContext('2d')
        p.drawImage(huidige, 0, 0)
        p.globalCompositeOperation = 'destination-in'
        p.imageSmoothingEnabled = true; p.imageSmoothingQuality = 'high'
        p.drawImage(m, 0, 0, w, h)
        return uit
      } finally {
        try { masker.close() } catch (e) {}
      }
    }

    return { zetAfbeelding, knip }
  })()
  laden.catch(() => { laden = null }) // mislukt: volgende keer opnieuw proberen
  return laden
}
