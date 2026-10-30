// onderwerp.js (v232): in het Stickerlab 'Tik op het onderwerp': je tikt (of drukt) op iets in je foto, en
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

export function laadKnipper() {
  if (laden) return laden
  laden = (async () => {
    if (!kanHet()) throw new Error('te-oud')
    const { FilesetResolver, InteractiveSegmenter, BrushMode } = await import(BIBLIOTHEEK)
    const map = new URL(WASM_MAP, location.href).href
    const bestanden = await FilesetResolver.forVisionTasks(map)
    const seg = await InteractiveSegmenter.createFromOptions(bestanden, {
      baseOptions: { modelAssetPath: new URL(MODEL, location.href).href, delegate: 'CPU' }
    })
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
