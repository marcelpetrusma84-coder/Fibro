// Swipe navigatie: Home → Vrienden → Chat → Profiel
const PAGINAS = ['index.html', 'vrienden.html', 'chat.html', 'profiel.html']

function huidigePagina() {
  const pad = window.location.pathname
  let bestand = pad.split('/').pop()
  if (!bestand || bestand === '') bestand = 'index.html'
  if (!bestand.includes('.')) bestand += '.html'
  const idx = PAGINAS.indexOf(bestand)
  if (idx === -1) {
    return PAGINAS.findIndex(p => pad.includes(p.replace('.html', '')))
  }
  return idx
}

function swipeNaar(richting) {
  const huidig = huidigePagina()
  if (huidig === -1) return
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
  if (Math.abs(dx) < Math.abs(dy)) return
  if (Math.abs(dx) < 50) return
  bezig = true
  if (dx < 0) swipeNaar(1)
  else swipeNaar(-1)
}, { passive: true })
