// Swipe navigatie: Home → Vrienden → Chat → Profiel
const PAGINAS = ['index.html', 'vrienden.html', 'chat.html', 'profiel.html']

function huidigePagina() {
  const pad = window.location.pathname
  const bestand = pad.split('/').pop() || 'index.html'
  return PAGINAS.indexOf(bestand)
}

function swipeNaar(richting) {
  const huidig = huidigePagina()
  const nieuw = huidig + richting
  if (nieuw < 0 || nieuw >= PAGINAS.length) return
  window.location.href = PAGINAS[nieuw]
}

let startX = 0
let startY = 0
let bezig = false

document.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
  bezig = false
}, { passive: true })

document.addEventListener('touchmove', (e) => {
  if (bezig) return
  const dx = e.touches[0].clientX - startX
  const dy = e.touches[0].clientY - startY
  // Alleen horizontale swipes (hoek < 45°)
  if (Math.abs(dx) < Math.abs(dy)) return
  if (Math.abs(dx) < 50) return
  bezig = true
  if (dx < 0) swipeNaar(1)   // links → volgende pagina
  else swipeNaar(-1)          // rechts → vorige pagina
}, { passive: true })
