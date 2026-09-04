// Achtergrondanimatie voor alle paginas.
// Tekenlus overgenomen uit de voorbeeldweergave in profiel.html.
let canvas = null, ctx = null, frame = null, deeltjes = [], soort = 'geen'

function maakCanvas() {
  if (canvas) return canvas
  canvas = document.createElement('canvas')
  canvas.id = 'fibro-animatie-canvas'
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;background:transparent'
  document.body.insertBefore(canvas, document.body.firstChild)
  ctx = canvas.getContext('2d')
  window.addEventListener('resize', pasMaatAan)
  return canvas
}

function pasMaatAan() {
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

function vulDeeltjes() {
  deeltjes = []
  for (let i = 0; i < 60; i++) deeltjes.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: Math.random() * 0.8 + 0.2,
    grootte: Math.random() * 3 + 1,
    alpha: Math.random(),
    kleur: soort === 'confetti' ? 'hsl(' + (Math.random()*360) + ',80%,60%)' : 'white'
  })
}

function teken() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  deeltjes.forEach(function(d) {
    ctx.globalAlpha = d.alpha
    ctx.fillStyle = d.kleur
    if (soort === 'sterren' || soort === 'vuurvliegjes') {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.grootte, 0, Math.PI*2); ctx.fill()
      d.alpha = 0.3 + Math.sin(Date.now()*0.003 + d.x) * 0.7
    } else if (soort === 'sneeuw' || soort === 'bubbels') {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.grootte+1, 0, Math.PI*2); ctx.fill()
      d.y += d.vy * 0.5; d.x += Math.sin(Date.now()*0.001 + d.y) * 0.3
    } else if (soort === 'regen') {
      ctx.fillRect(d.x, d.y, 1, d.grootte*4); d.y += d.vy*3; d.x += 0.5
    } else {
      ctx.fillRect(d.x, d.y, d.grootte*2, d.grootte)
      d.y += d.vy; d.x += Math.sin(Date.now()*0.002 + d.y) * 0.8
    }
    if (d.y > canvas.height) d.y = -10
    if (d.x > canvas.width) d.x = 0
    if (d.x < 0) d.x = canvas.width
  })
  ctx.globalAlpha = 1
  frame = requestAnimationFrame(teken)
}

export function stopAnimatie() {
  if (frame) { cancelAnimationFrame(frame); frame = null }
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
}

export function pasAnimatieToe(naam) {
  soort = naam || 'geen'
  stopAnimatie()
  if (soort === 'geen') { if (canvas) canvas.style.display = 'none'; return }
  maakCanvas()
  canvas.style.display = ''
  pasMaatAan()
  vulDeeltjes()
  teken()
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) stopAnimatie()
  else if (soort !== 'geen' && canvas) { pasMaatAan(); vulDeeltjes(); teken() }
})
