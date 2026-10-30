// stickerkwast.js (v231): in het Stickerlab een uitgeknipte afbeelding bijwerken met je vinger.
// Na 'Achtergrond weg', 'Lijn eromheen' of 'Alles houden' kun je met de kwast stukjes weghalen (gum) of
// terugzetten (uit de oorspronkelijke afbeelding). De grootte van de kwast stel je zelf in.
// Een streek: { soort: 'gum' | 'terug', r: straal in pixels van de afbeelding, punten: [[x, y], ...] }.
// De streken worden steeds opnieuw over het begin gelegd, dus 'Hoe streng' of een andere begin-keuze
// verandert later nog gewoon, zonder dat je bijwerkingen kwijt bent.

export const KWAST_MIN = 6, KWAST_MAX = 90, KWAST_STANDAARD = 28 // doorsnede op het scherm, in css-pixels

// Straal in pixels van de afbeelding, uit de doorsnede op het scherm en hoe groot de afbeelding getoond wordt
export function kwastStraal(doorsnedeScherm, breedteAfbeelding, breedteOpScherm) {
  const d = Math.max(KWAST_MIN, Math.min(KWAST_MAX, Number(doorsnedeScherm) || KWAST_STANDAARD))
  const schaal = breedteOpScherm > 0 ? breedteAfbeelding / breedteOpScherm : 1
  return Math.max(1, (d / 2) * schaal)
}

// Een nieuw punt alleen als het ver genoeg van het vorige ligt (scheelt werk, de lijn blijft vloeiend)
export function voegPuntToe(streek, punt) {
  const v = streek.punten[streek.punten.length - 1]
  if (v && Math.hypot(punt[0] - v[0], punt[1] - v[1]) < Math.max(1, streek.r / 4)) return false
  streek.punten.push(punt)
  return true
}

let hulp = null // een tweede doek, hergebruikt voor 'terugzetten'
function hulpDoek(w, h) {
  if (!hulp) hulp = document.createElement('canvas')
  if (hulp.width !== w || hulp.height !== h) { hulp.width = w; hulp.height = h }
  return hulp
}

function pad(p, punten, r) {
  p.lineCap = 'round'; p.lineJoin = 'round'; p.lineWidth = r * 2
  p.beginPath()
  if (punten.length === 1) {
    p.arc(punten[0][0], punten[0][1], r, 0, Math.PI * 2); p.fill()
    return
  }
  p.moveTo(punten[0][0], punten[0][1])
  for (let i = 1; i < punten.length; i++) p.lineTo(punten[i][0], punten[i][1])
  p.stroke()
}

// Een streek (vanaf punt 'van') op doel zetten. bron = de oorspronkelijke afbeelding (voor 'terug').
export function tekenStreek(doel, bron, streek, van = 0) {
  const punten = streek.punten.slice(Math.max(0, van - 1))
  if (!punten.length) return
  const p = doel.getContext('2d')
  p.save()
  p.fillStyle = p.strokeStyle = '#000'
  if (streek.soort === 'gum') {
    p.globalCompositeOperation = 'destination-out'
    pad(p, punten, streek.r)
  } else {
    // terugzetten: alleen binnen de streek de oorspronkelijke afbeelding eroverheen
    const h = hulpDoek(doel.width, doel.height), hp = h.getContext('2d')
    hp.save()
    hp.clearRect(0, 0, h.width, h.height)
    hp.fillStyle = hp.strokeStyle = '#000'
    pad(hp, punten, streek.r)
    hp.globalCompositeOperation = 'source-in'
    hp.drawImage(bron, 0, 0)
    hp.restore()
    p.globalCompositeOperation = 'source-over'
    p.drawImage(h, 0, 0)
  }
  p.restore()
}

// Het begin (na Achtergrond weg / Lijn eromheen / Alles houden) met alle streken erover: een nieuw doek
export function pasStrekenToe(begin, bron, streken) {
  const uit = document.createElement('canvas')
  uit.width = begin.width; uit.height = begin.height
  uit.getContext('2d').drawImage(begin, 0, 0)
  for (const s of streken || []) tekenStreek(uit, bron, s, 0)
  return uit
}
