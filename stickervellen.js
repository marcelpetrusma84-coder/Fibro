// stickervellen.js - de stickervellen van Fibro (v153, 15 oktober 2026; v156: vel 1; v161: eigen geluiden voor vel 1)
// Zes vaste vakjes (f1 t/m f6), elk voor een vel van 12 stickers. Een vel dat nog leeg is, toont
// "binnenkort". Een sticker staat in stickers/<vel>/<nr>.webp en heeft een naam ([Nederlands, Engels]),
// een beweging (b) en een geluid (g) uit stickerfx.js.
// Voorbeeld van een gevuld vel:
//   { id: 'f1', stickers: [ { nr: '01', naam: ['Grote ogen', 'Big eyes'], b: 'groei', g: 'boing' }, ... ] }
// In een bericht gaat alleen '<vel>-<nr>' mee (bijv. fxsticker:f1-01); het plaatje staat op elk toestel.

export const FIBRO_VELLEN = [
  { id: 'f1', stickers: [
    { nr: '01', naam: ['Tranen van het lachen', 'Tears of joy'], b: 'hup', g: 'lach' },
    { nr: '02', naam: ['Ssst', 'Shh'], b: 'kantel', g: 'ssst' },
    { nr: '03', naam: ['Slaap lekker', 'Sleep tight'], b: 'zweef', g: 'snurk' },
    { nr: '04', naam: ['Kapot', 'Exhausted'], b: 'knik', g: 'moe' },
    { nr: '05', naam: ['Huilen', 'Crying'], b: 'wiebel', g: 'huil' },
    { nr: '06', naam: ['Verliefd', 'In love'], b: 'hartslag', g: 'hartklop' },
    { nr: '07', naam: ['Boos', 'Angry'], b: 'schud', g: 'grom' },
    { nr: '08', naam: ['Geschrokken', 'Shocked'], b: 'duw', g: 'schrik' },
    { nr: '09', naam: ['Offline', 'Offline'], b: 'glitch', g: 'uitval' },
    { nr: '10', naam: ['Druk', 'Busy'], b: 'hup', g: 'druk' },
    { nr: '11', naam: ['Spookje', 'Spooked'], b: 'zweef', g: 'spook' },
    { nr: '12', naam: ['Sluw', 'Sly'], b: 'kantel', g: 'sluw' },
  ] },
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
