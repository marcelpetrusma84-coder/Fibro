// UX: de huidige lijniconen of de oorspronkelijke kleurrijke emoji's.
// Alleen een voorkeur op dit apparaat; verandert geen profiel- of spelgegevens.
;(function () {
  if (typeof window === 'undefined' || window.FibroIcoonthema) return
  const SLEUTEL = 'fibro_icoonthema'
  const EMOJI = Object.freeze({
    home: '🏠', vrienden: '👥', chat: '💬', stijl: '🖍️',
    profiel: '👤', achtergrond: '🖼️', animatie: '✨', lettertype: '🔤',
    ux: '💜', widgets: '🧩', stickers: '🎨', store: '🛍️',
    emoji: '😊', spel: '🎮', foto: '📷', microfoon: '🎤', buzz: '⚡'
  })
  const geldig = waarde => waarde === 'modern' || waarde === 'nostalgia'
  const normaliseer = waarde => geldig(waarde) ? waarde : 'modern'
  let huidig = 'modern'
  try { huidig = normaliseer(localStorage.getItem(SLEUTEL)) } catch (e) {}
  // De bewaarde keuze is bekend voordat de pagina klaar is.
  document.documentElement.dataset.icoonthema = huidig

  function toon() {
    document.documentElement.dataset.icoonthema = huidig
    for (const plek of document.querySelectorAll('[data-icoon]')) {
      const emoji = EMOJI[plek.dataset.icoon]
      const lijn = plek.querySelector(':scope > svg')
      if (!emoji || !lijn) continue
      lijn.classList.add('icoon-modern')
      let oud = plek.querySelector(':scope > .icoon-nostalgia')
      if (huidig === 'modern') { oud?.remove(); continue }
      if (oud) continue
      oud = document.createElement('span')
      oud.className = 'icoon-nostalgia'
      if (lijn.classList.contains('tab-icoon')) oud.classList.add('tab-icoon')
      oud.setAttribute('aria-hidden', 'true')
      oud.textContent = emoji
      // Voor de tekst, zodat bijv. de ongelezen-berichtenzoeker "Chat" blijft vinden.
      lijn.after(oud)
    }
    for (const keuze of document.querySelectorAll('[data-icoonthema-keuze]')) {
      keuze.checked = keuze.value === huidig
    }
  }

  function kies(waarde, bewaren = true) {
    if (!geldig(waarde)) return false
    huidig = waarde
    if (bewaren) try { localStorage.setItem(SLEUTEL, huidig) } catch (e) {}
    toon()
    return true
  }

  document.addEventListener('change', e => {
    const keuze = e.target
    if (keuze?.matches('[data-icoonthema-keuze]') && keuze.checked) kies(keuze.value)
  })
  window.addEventListener('storage', e => {
    if (e.key === SLEUTEL || e.key === null) kies(normaliseer(e.newValue), false)
  })
  window.FibroIcoonthema = Object.freeze({ kies, huidig: () => huidig, toon })
  if (document.readyState === 'loading') {
    // Interactive wacht op de HTML, maar niet op netwerkafhankelijke modules.
    document.addEventListener('readystatechange', toon, { once: true })
    document.addEventListener('DOMContentLoaded', toon, { once: true })
  }
  else toon()
})()
