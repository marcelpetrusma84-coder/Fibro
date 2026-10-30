// Achtergrondanimatie voor alle paginas.
// v234: een tekenaar per doek (startOp), zodat de voorbeeldweergave op Profiel precies dezelfde code gebruikt als de
// echte achtergrond. Nieuw: vuurwerk, onweer (regen met bliksem) en glitter.
// Bliksem: hoogstens een flits per paar seconden, nooit snel achter elkaar, en zacht (geen fel wit scherm).
// Wie op zijn toestel 'minder beweging' heeft aangezet, krijgt de schicht zonder flits van het hele scherm.

export const SOORTEN = ['geen', 'sterren', 'sneeuw', 'regen', 'bladeren', 'bubbels', 'vlinders', 'vuurvliegjes', 'confetti', 'vuurwerk', 'onweer', 'glitter']

const rnd = (a, b) => a + Math.random() * (b - a)
const GLITTER = ['#fde68a', '#facc15', '#f5f5f4', '#e5e7eb', '#f9a8d4', '#f0abfc', '#c4b5fd', '#ffffff']

function minderBeweging() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) } catch (e) { return false }
}

// Hoeveel deeltjes: glitter is 'zeer veel', maar afgestemd op de grootte van het doek (een klein voorbeeld minder)
export function aantalDeeltjes(soort, breedte, hoogte) {
  const opp = Math.max(1, breedte * hoogte)
  if (soort === 'glitter') return Math.max(120, Math.min(700, Math.round(opp / 800)))
  if (soort === 'onweer') return Math.max(60, Math.min(220, Math.round(opp / 3500)))
  if (soort === 'vuurwerk') return 0 // vuurwerk maakt zijn eigen vonken
  return 60
}

// Maakt een tekenaar voor een doek. stap() tekent een beeld en schuift alles een stukje op.
export function maakTekenaar(canvas, soort) {
  const ctx = canvas.getContext('2d')
  let deeltjes = []
  // vuurwerk
  let pijlen = [], vonken = [], volgendePijl = 0
  // onweer
  let flits = 0, schicht = null, volgendeBliksem = performance.now() + rnd(2500, 5000)
  const zacht = minderBeweging()

  function vul() {
    deeltjes = []
    const w = canvas.width, h = canvas.height
    const n = aantalDeeltjes(soort, w, h)
    for (let i = 0; i < n; i++) {
      if (soort === 'glitter') {
        deeltjes.push({ x: rnd(0, w), y: rnd(0, h), vy: rnd(0.08, 0.5), vx: rnd(-0.15, 0.15), r: rnd(0.8, 3), fase: rnd(0, 6.3), snel: rnd(0.002, 0.008), kleur: GLITTER[(Math.random() * GLITTER.length) | 0], ster: Math.random() < 0.28 })
      } else if (soort === 'onweer') {
        deeltjes.push({ x: rnd(-w * 0.2, w), y: rnd(0, h), vy: rnd(9, 15), lengte: rnd(10, 22), alpha: rnd(0.25, 0.6) })
      } else {
        deeltjes.push({
          x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.5, vy: Math.random() * 0.8 + 0.2,
          grootte: Math.random() * 3 + 1, alpha: Math.random(),
          kleur: soort === 'confetti' ? 'hsl(' + (Math.random() * 360) + ',80%,60%)' : 'white'
        })
      }
    }
    pijlen = []; vonken = []; volgendePijl = 0; flits = 0; schicht = null
  }

  // ---- de oude soorten (zoals ze altijd waren) ----
  function klassiek() {
    const w = canvas.width, h = canvas.height
    deeltjes.forEach(function (d) {
      ctx.globalAlpha = d.alpha
      ctx.fillStyle = d.kleur
      if (soort === 'sterren' || soort === 'vuurvliegjes') {
        ctx.beginPath(); ctx.arc(d.x, d.y, d.grootte, 0, Math.PI * 2); ctx.fill()
        d.alpha = 0.3 + Math.sin(Date.now() * 0.003 + d.x) * 0.7
      } else if (soort === 'sneeuw' || soort === 'bubbels') {
        ctx.beginPath(); ctx.arc(d.x, d.y, d.grootte + 1, 0, Math.PI * 2); ctx.fill()
        d.y += d.vy * 0.5; d.x += Math.sin(Date.now() * 0.001 + d.y) * 0.3
      } else if (soort === 'regen') {
        ctx.fillRect(d.x, d.y, 1, d.grootte * 4); d.y += d.vy * 3; d.x += 0.5
      } else {
        ctx.fillRect(d.x, d.y, d.grootte * 2, d.grootte)
        d.y += d.vy; d.x += Math.sin(Date.now() * 0.002 + d.y) * 0.8
      }
      if (d.y > h) d.y = -10
      if (d.x > w) d.x = 0
      if (d.x < 0) d.x = w
    })
  }

  // ---- vuurwerk: pijlen omhoog, dan uiteenspatten in vonken die vallen en uitdoven ----
  function vuurwerk(nu) {
    const w = canvas.width, h = canvas.height
    const schaal = Math.max(0.45, Math.min(1, h / 700))
    if (nu >= volgendePijl) {
      pijlen.push({ x: rnd(w * 0.12, w * 0.88), y: h + 4, vx: rnd(-0.6, 0.6), vy: -rnd(6.5, 9) * Math.sqrt(schaal), doel: rnd(h * 0.15, h * 0.5), tint: rnd(0, 360) })
      volgendePijl = nu + rnd(350, 1000)
    }
    for (let i = pijlen.length - 1; i >= 0; i--) {
      const p = pijlen[i]
      p.x += p.vx; p.y += p.vy; p.vy += 0.06
      ctx.globalAlpha = 0.9; ctx.fillStyle = 'hsl(' + p.tint + ',90%,75%)'
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill()
      if (p.y <= p.doel || p.vy >= -1) {
        pijlen.splice(i, 1)
        const n = Math.round(rnd(40, 70) * schaal + 10)
        const tweeKleuren = Math.random() < 0.4, tint2 = (p.tint + rnd(60, 180)) % 360
        for (let k = 0; k < n; k++) {
          const hoek = (k / n) * Math.PI * 2 + rnd(-0.08, 0.08), snel = rnd(1.2, 4.2) * schaal
          vonken.push({ x: p.x, y: p.y, vx: Math.cos(hoek) * snel, vy: Math.sin(hoek) * snel, leven: 1, af: rnd(0.007, 0.013), tint: tweeKleuren && k % 2 ? tint2 : p.tint })
        }
      }
    }
    for (let i = vonken.length - 1; i >= 0; i--) {
      const v = vonken[i]
      const ox = v.x, oy = v.y
      v.vx *= 0.985; v.vy = v.vy * 0.985 + 0.045; v.x += v.vx; v.y += v.vy; v.leven -= v.af
      if (v.leven <= 0) { vonken.splice(i, 1); continue }
      const kleur = 'hsl(' + v.tint + ',100%,' + (62 + v.leven * 28) + '%)'
      ctx.globalAlpha = Math.min(1, v.leven * 1.3)
      ctx.strokeStyle = kleur; ctx.fillStyle = kleur
      ctx.lineWidth = 2.2; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(ox - v.vx * 3, oy - v.vy * 3); ctx.lineTo(v.x, v.y); ctx.stroke()
      ctx.beginPath(); ctx.arc(v.x, v.y, 1.7, 0, Math.PI * 2); ctx.fill()
    }
    if (vonken.length > 1500) vonken.splice(0, vonken.length - 1500) // nooit te veel tegelijk
  }

  // ---- onweer: schuine, harde regen; af en toe een bliksemschicht met een zachte flits ----
  function maakSchicht(w, h) {
    const punten = [[rnd(w * 0.15, w * 0.85), 0]]
    const eind = rnd(h * 0.45, h * 0.85)
    while (punten[punten.length - 1][1] < eind) {
      const [x, y] = punten[punten.length - 1]
      punten.push([x + rnd(-w * 0.06, w * 0.06), y + rnd(h * 0.04, h * 0.09)])
    }
    const takken = []
    for (let i = 2; i < punten.length - 1; i++) if (Math.random() < 0.3) {
      const tak = [punten[i]]
      for (let k = 0; k < 3; k++) { const [x, y] = tak[tak.length - 1]; tak.push([x + rnd(-w * 0.07, w * 0.07), y + rnd(h * 0.03, h * 0.07)]) }
      takken.push(tak)
    }
    return { punten, takken, leven: 1 }
  }
  function lijn(punten) {
    ctx.beginPath(); ctx.moveTo(punten[0][0], punten[0][1])
    for (let i = 1; i < punten.length; i++) ctx.lineTo(punten[i][0], punten[i][1])
    ctx.stroke()
  }
  function onweer(nu) {
    const w = canvas.width, h = canvas.height
    if (nu >= volgendeBliksem) {
      schicht = maakSchicht(w, h)
      flits = zacht ? 0 : 0.28
      volgendeBliksem = nu + rnd(4000, 9000) // nooit vaker dan eens per 4 seconden
    }
    if (flits > 0) {
      ctx.globalAlpha = flits; ctx.fillStyle = '#dbeafe'; ctx.fillRect(0, 0, w, h)
      flits = Math.max(0, flits - 0.02)
    }
    if (schicht) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, schicht.leven)
      ctx.strokeStyle = '#e0f2fe'; ctx.shadowColor = '#93c5fd'; ctx.shadowBlur = 14; ctx.lineJoin = 'round'
      ctx.lineWidth = 2.6; lijn(schicht.punten)
      ctx.lineWidth = 1.2; schicht.takken.forEach(lijn)
      ctx.restore()
      schicht.leven -= 0.035
      if (schicht.leven <= 0) schicht = null
    }
    ctx.strokeStyle = '#bfdbfe'; ctx.lineWidth = 1.1
    deeltjes.forEach(function (d) {
      ctx.globalAlpha = d.alpha
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.lengte * 0.25, d.y + d.lengte); ctx.stroke()
      d.y += d.vy; d.x += d.vy * 0.25
      if (d.y > h) { d.y = rnd(-40, -5); d.x = rnd(-w * 0.2, w) }
    })
  }

  // ---- glitter: heel veel kleine fonkelende stipjes en sterretjes ----
  function sterretje(x, y, r) {
    ctx.beginPath()
    ctx.moveTo(x, y - r * 2.6); ctx.lineTo(x + r * 0.55, y - r * 0.55); ctx.lineTo(x + r * 2.6, y); ctx.lineTo(x + r * 0.55, y + r * 0.55)
    ctx.lineTo(x, y + r * 2.6); ctx.lineTo(x - r * 0.55, y + r * 0.55); ctx.lineTo(x - r * 2.6, y); ctx.lineTo(x - r * 0.55, y - r * 0.55)
    ctx.closePath(); ctx.fill()
  }
  function glitter(nu) {
    const w = canvas.width, h = canvas.height
    deeltjes.forEach(function (d) {
      const fonkel = 0.5 + 0.5 * Math.sin(nu * d.snel + d.fase)
      ctx.globalAlpha = 0.15 + fonkel * 0.85
      ctx.fillStyle = d.kleur
      if (d.ster && fonkel > 0.55) sterretje(d.x, d.y, d.r * (0.6 + fonkel * 0.6))
      else { ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (0.5 + fonkel * 0.5), 0, Math.PI * 2); ctx.fill() }
      d.y += d.vy; d.x += d.vx + Math.sin(nu * 0.0007 + d.fase) * 0.12
      if (d.y > h + 6) { d.y = -6; d.x = rnd(0, w) }
      if (d.x > w + 6) d.x = -6
      if (d.x < -6) d.x = w + 6
    })
  }

  function stap() {
    const nu = performance.now()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (soort === 'vuurwerk' || soort === 'glitter') ctx.globalCompositeOperation = 'lighter' // vonken die elkaar raken, gloeien op
    if (soort === 'vuurwerk') vuurwerk(nu)
    else if (soort === 'onweer') onweer(nu)
    else if (soort === 'glitter') glitter(nu)
    else klassiek()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  return { vul, stap }
}

// Een animatie op een willekeurig doek laten lopen; geeft een functie terug om te stoppen
export function startOp(canvas, naam) {
  const soort = SOORTEN.includes(naam) ? naam : 'geen'
  const ctx = canvas.getContext('2d')
  if (soort === 'geen') { ctx.clearRect(0, 0, canvas.width, canvas.height); return () => {} }
  const t = maakTekenaar(canvas, soort)
  t.vul()
  let f = null
  const lus = () => { t.stap(); f = requestAnimationFrame(lus) }
  lus()
  return () => { if (f) cancelAnimationFrame(f); f = null; ctx.clearRect(0, 0, canvas.width, canvas.height) }
}

// ---- de achtergrond van de pagina ----
let canvas = null, stopper = null, soortNu = 'geen'

function maakCanvas() {
  if (canvas) return canvas
  canvas = document.createElement('canvas')
  canvas.id = 'fibro-animatie-canvas'
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;background:transparent'
  document.body.insertBefore(canvas, document.body.firstChild)
  window.addEventListener('resize', () => { if (soortNu !== 'geen') herstart() })
  return canvas
}

function pasMaatAan() {
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

function herstart() {
  if (stopper) stopper()
  pasMaatAan()
  stopper = startOp(canvas, soortNu)
}

export function stopAnimatie() {
  if (stopper) { stopper(); stopper = null }
}

export function pasAnimatieToe(naam) {
  soortNu = SOORTEN.includes(naam) ? naam : 'geen'
  stopAnimatie()
  if (soortNu === 'geen') { if (canvas) canvas.style.display = 'none'; return }
  maakCanvas()
  canvas.style.display = ''
  herstart()
}

document.addEventListener('visibilitychange', function () {
  if (document.hidden) stopAnimatie()
  else if (soortNu !== 'geen' && canvas) herstart()
})
