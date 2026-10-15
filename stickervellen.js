// stickervellen.js - de stickervellen van Fibro (v153, 15 oktober 2026)
// Zes vaste vakjes (f1 t/m f6), elk voor een vel van 12 stickers. Een vel dat nog leeg is, toont
// "binnenkort". Een sticker staat in stickers/<vel>/<nr>.webp en heeft een naam ([Nederlands, Engels]),
// een beweging (b) en een geluid (g) uit stickerfx.js.
// Voorbeeld van een gevuld vel:
//   { id: 'f1', stickers: [ { nr: '01', naam: ['Grote ogen', 'Big eyes'], b: 'groei', g: 'boing' }, ... ] }
// In een bericht gaat alleen '<vel>-<nr>' mee (bijv. fxsticker:f1-01); het plaatje staat op elk toestel.

export const FIBRO_VELLEN = [
  { id: 'f1', stickers: [] },
  { id: 'f2', stickers: [] },
  { id: 'f3', stickers: [] },
  { id: 'f4', stickers: [] },
  { id: 'f5', stickers: [] },
  { id: 'f6', stickers: [] },
]

export const PER_VEL = 12

// Zoek een sticker op met de code uit een bericht ('f1-01'). Geeft null als hij niet (meer) bestaat.
export function zoekSticker(code) {
  const m = /^(f[1-6])-(\d{2})$/.exec(String(code || ''))
  if (!m) return null
  const vel = FIBRO_VELLEN.find(v => v.id === m[1])
  const s = vel && vel.stickers.find(x => x.nr === m[2])
  return s ? { vel: vel.id, nr: s.nr, naam: s.naam, b: s.b, g: s.g, src: stickerSrc(vel.id, s.nr) } : null
}

export function stickerSrc(vel, nr) {
  return 'stickers/' + vel + '/' + nr + '.webp'
}
