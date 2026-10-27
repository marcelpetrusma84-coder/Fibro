// Alleen muisbesturing. Touch/pen en toetsen blijven in het spel hun eigen bediening houden.
const SLEUTEL = 'nr-muisbesturing'
const puntGeldig = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.y)

export function muisPunt(event, rect, breedte, hoogte) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null
  const punt = {
    x: (event.clientX - rect.left) * breedte / rect.width,
    y: (event.clientY - rect.top) * hoogte / rect.height
  }
  return puntGeldig(punt) ? punt : null
}

export function maakNeonMuis({ opslag } = {}) {
  let modus = 'slepen', doel = null, links = false, laatstePointer = null
  try { if (opslag?.getItem(SLEUTEL) === 'volgen') modus = 'volgen' } catch {}

  function leeg() { doel = null; links = false }
  return {
    get modus() { return modus },
    get vuurt() { return links },
    neer(event, punt) {
      laatstePointer = event.pointerType
      if (event.pointerType !== 'mouse') { leeg(); return false }
      if (event.button !== 0) return false
      links = true
      if (modus === 'volgen' && puntGeldig(punt)) doel = { ...punt }
      return true
    },
    beweeg(event, punt) {
      if (event.pointerType !== 'mouse') return false
      if (!(event.buttons & 1)) links = false // ook herstellen na een buiten het venster gemiste mouseup
      if (modus === 'volgen' && puntGeldig(punt)) doel = { ...punt }
      return true
    },
    los(event) { if (event.pointerType === 'mouse' && event.button === 0) links = false },
    verlorenVangst() {
      // pointerup laat capture automatisch los: het loslaten stopt vuur, niet het volgen.
      // Valt capture onverwacht weg terwijl de knop nog vaststaat, ruim dan wel alles op.
      if (links) leeg()
    },
    leeg,
    stopVolgen() { doel = null },
    wissel(event, punt, schip) {
      // Een touch-dubbeltik mag ook via een nagebootste MouseEvent nooit de PC-modus veranderen.
      if (laatstePointer !== 'mouse' || (event.pointerType && event.pointerType !== 'mouse') ||
          event.sourceCapabilities?.firesTouchEvents || event.button !== 0 || !puntGeldig(punt) || !schip) return false
      if (![schip.x, schip.y, schip.width, schip.height].every(Number.isFinite) ||
          Math.abs(punt.x - schip.x) > schip.width / 2 || Math.abs(punt.y - schip.y) > schip.height / 2) return false
      modus = modus === 'slepen' ? 'volgen' : 'slepen'
      leeg()
      try { opslag?.setItem(SLEUTEL, modus) } catch {}
      return true
    },
    stap(schip, seconden) {
      if (modus !== 'volgen' || !doel || !puntGeldig(schip) || !(seconden > 0)) return null
      const dx = doel.x - schip.x, dy = doel.y - schip.y, afstand = Math.hypot(dx, dy)
      // Dezelfde 250 wereldpunten/s als toetsen; een grote sprong in muispositie teleporteert niet.
      const stap = Math.min(afstand, 250 * Math.min(seconden, .05))
      return afstand > 0 ? { x: dx / afstand * stap, y: dy / afstand * stap } : null
    }
  }
}
