// De blokken bestaan uit afzonderlijke 3D-vlakken. Berichten blijven gewone HTML.
const VOORKEUR = 'fibro_chat_depth'
const BEWEGING = 'fibro_chat_depth_beweging'
const BERICHT = '.bubble:not(.emoji-1,.emoji-2,.emoji-3), .bubbel, .citaat'
const schaduwMarge = 140
const maxTilt = value => Math.max(-1, Math.min(1, value))

function maakBlokken(breedte, hoogte, stap) {
  const blokken = []
  const hoek = -.16, c = Math.cos(hoek), s = Math.sin(hoek)
  const bereik = Math.ceil(Math.hypot(breedte, hoogte) / (2 * stap)) + 3
  for (let rij = -bereik; rij <= bereik; rij++) {
    for (let kolom = -bereik; kolom <= bereik; kolom++) {
      // Dezelfde muur bij hertekenen, met een verspreide reeks hoge, lage en verzonken blokken.
      const n = ((Math.imul(kolom + 161, 374761393) ^ Math.imul(rij + 271, 668265263)) >>> 0) % 997
      const z = stap * [.10, .16, .24, .36, .50, .65, .83][n % 7]
      const x = (kolom + .5) * stap, y = (rij + .5) * stap
      const midden = [x * c - y * s, x * s + y * c, 0]
      if (Math.abs(midden[0]) > breedte / 2 + 2 * stap || Math.abs(midden[1]) > hoogte / 2 + 2 * stap) continue
      const rand = stap * .482
      const basis = [[-rand,-rand], [rand,-rand], [rand,rand], [-rand,rand]].map(([dx,dy]) =>
        [midden[0] + dx * c - dy * s, midden[1] + dx * s + dy * c, 0])
      const top = basis.map(([x,y]) => [x,y,z])
      const accent = n % 11 < 2
      const licht = 5 + n % 8 + Math.round(z / stap * 10) + (accent ? 13 : 0)
      const kleur = (l, sat) => `hsl(${219 + n % 7} ${sat}% ${l}%)`
      const vlakken = [{ punten: top, kleuren: [kleur(licht + 10, 84), kleur(licht, 83)], voorkant: true }]
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        const l = [6, 14, 9, 5][i] + (accent ? 6 : 0)
        vlakken.push({ punten: [top[j], top[i], basis[i], basis[j]], kleuren: [kleur(l + 6, 83), kleur(l, 79)] })
      }
      blokken.push({ midden, vlakken })
    }
  }
  return blokken
}

function camera(w, h, x, y) {
  const yaw = -.21 + x * .27, pitch = -.21 + y * .23
  const cx = Math.cos(yaw), sx = Math.sin(yaw), cy = Math.cos(pitch), sy = Math.sin(pitch)
  const afstand = Math.max(w, h) * 1.1 + 320
  const diepte = ([a,b,z]) => (z * cx - a * sx) * cy + b * sy
  function projecteer(punt) {
    const [a,b,z] = punt
    const k = afstand / (afstand - diepte(punt))
    return [w / 2 + (a * cx + z * sx) * k, h / 2 + (b * cy - (z * cx - a * sx) * sy) * k]
  }
  return { projecteer, diepte }
}

const kruis = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
function pad(ctx, punten) {
  ctx.beginPath()
  for (const [i, [x,y]] of punten.entries()) { if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y) }
  ctx.closePath()
}
function grenzen(punten) {
  const [a,b,c,d] = punten
  return [Math.min(a[0],b[0],c[0],d[0]), Math.min(a[1],b[1],c[1],d[1]),
    Math.max(a[0],b[0],c[0],d[0]), Math.max(a[1],b[1],c[1],d[1])]
}
function raakt(a,b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1] }

// Zet een uitsnede van de silhouetkaart op dit ene 3D-vlak. Een vlak hoger op
// de muur onderschept het licht eerder en krijgt de schaduw op een andere plek.
function projecteerSchaduw(ctx, masker, bron, doel, rechthoek) {
  const [s0,s1,,s3] = bron, [d0,d1,,d3] = doel
  const ux = s1[0] - s0[0], uy = s1[1] - s0[1], vx = s3[0] - s0[0], vy = s3[1] - s0[1]
  const det = ux * vy - uy * vx
  if (Math.abs(det) < .01) return
  const dx = d1[0] - d0[0], dy = d1[1] - d0[1], ex = d3[0] - d0[0], ey = d3[1] - d0[1]
  const a = (dx * vy - ex * uy) / det, b = (dy * vy - ey * uy) / det
  const c = (ex * ux - dx * vx) / det, d = (ey * ux - dy * vx) / det
  const [links,boven,rechts,onder] = rechthoek
  const x = Math.max(-schaduwMarge, Math.floor(links - 3))
  const y = Math.max(-schaduwMarge, Math.floor(boven - 3))
  const w = Math.min(masker.width - schaduwMarge, Math.ceil(rechts + 3)) - x
  const h = Math.min(masker.height - schaduwMarge, Math.ceil(onder + 3)) - y
  if (w <= 0 || h <= 0) return
  ctx.save()
  ctx.clip()
  ctx.globalAlpha = .74
  ctx.transform(a,b,c,d,d0[0] - a*s0[0] - c*s0[1], d0[1] - b*s0[0] - d*s0[1])
  ctx.drawImage(masker,x + schaduwMarge,y + schaduwMarge,w,h,x,y,w,h)
  ctx.restore()
}

function maakWand(canvas, venster) {
  const ctx = canvas.getContext('2d', { alpha: false })
  const masker = document.createElement('canvas')
  const m = masker.getContext('2d')
  if (!ctx || !m) return null
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let bewegingAan = false
  const kanBewegen = () => bewegingAan && !motion.matches
  const touch = matchMedia('(pointer: coarse)')
  let w = 0, h = 0, stap = 0, blokken = [], schaduwVakken = []
  let x = 0, y = 0, doelX = 0, doelY = 0, basis = null
  let pixels = 1, frame = 0, vorigFrame = 0, meetOpnieuw = true, grenzenVenster
  let laatsteSensor = -Infinity, scrollTimer, vorigeY = venster.scrollTop
  const luisteraars = new AbortController()
  const signaal = { signal: luisteraars.signal, passive: true }

  function plan() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(teken)
  }
  function meet() { meetOpnieuw = true; plan() }
  function resetBeweging() {
    x = y = doelX = doelY = 0
    basis = null
    laatsteSensor = -Infinity
    vorigeY = venster.scrollTop
    clearTimeout(scrollTimer)
    plan()
  }
  function leesBeweging() {
    let nieuw = false
    try { nieuw = localStorage.getItem(BEWEGING) === '1' } catch {}
    if (nieuw === bewegingAan) return
    bewegingAan = nieuw
    resetBeweging()
  }
  function teken(tijd) {
    frame = 0
    if (document.hidden || !venster.isConnected) return
    if (tijd - vorigFrame < 29 && !meetOpnieuw) { plan(); return }
    vorigFrame = tijd
    if (meetOpnieuw) {
      meetOpnieuw = false
      const r = venster.getBoundingClientRect()
      if (!r.width || !r.height) { canvas.hidden = true; return }
      canvas.hidden = false
      canvas.style.inset = `${venster.offsetTop}px auto auto ${venster.offsetLeft}px`
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px'
      const breedte = Math.round(r.width), hoogte = Math.round(r.height)
      if (breedte !== w || hoogte !== h) {
        w = breedte; h = hoogte
        stap = Math.max(49, Math.max(w,h) / 11.5, w / 7.3)
        pixels = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1050000 / (w*h)))
        canvas.width = Math.ceil(w*pixels); canvas.height = Math.ceil(h*pixels)
        masker.width = w + 2 * schaduwMarge; masker.height = h + 2 * schaduwMarge
        blokken = maakBlokken(w,h,stap)
      }
      grenzenVenster = [-2,-2,w+2,h+2]
      m.setTransform(1,0,0,1,schaduwMarge,schaduwMarge)
      m.clearRect(-schaduwMarge,-schaduwMarge,masker.width,masker.height)
      m.fillStyle = '#000b23'
      m.shadowColor = '#000b23b5'; m.shadowBlur = 10
      schaduwVakken = []
      for (const bubbel of venster.querySelectorAll(BERICHT)) {
        const vak = bubbel.getBoundingClientRect()
        const a = [vak.left - r.left, vak.top - r.top, vak.right - r.left, vak.bottom - r.top]
        if (!vak.width || !vak.height || !raakt(a, [-125,-125,w+125,h+125])) continue
        schaduwVakken.push([a[0]-15,a[1]-15,a[2]+15,a[3]+15])
        m.beginPath()
        const radius = Math.min(14, vak.height / 2)
        if (m.roundRect) m.roundRect(a[0],a[1],vak.width,vak.height,radius)
        else m.rect(a[0],a[1],vak.width,vak.height)
        m.fill()
      }
    }
    if (canvas.hidden || !w || !h) return
    if (!kanBewegen()) { x = 0; y = 0 }
    else { x += (doelX - x) * .23; y += (doelY - y) * .23 }
    const { projecteer, diepte } = camera(w,h,x,y)
    ctx.setTransform(pixels,0,0,pixels,0,0)
    ctx.fillStyle = '#020c22'
    ctx.fillRect(0,0,w,h)
    const dieptes = blokken.map(blok => ({ blok, z: diepte(blok.midden) }))
    dieptes.sort((a,b) => a.z - b.z)
    const bubbelHoogte = stap * 1.26
    for (const {blok} of dieptes) {
      for (const vlak of blok.vlakken) {
        const punten = vlak.punten.map(projecteer)
        if (kruis(punten[0],punten[1],punten[2]) < .1 || !raakt(grenzen(punten),grenzenVenster)) continue
        pad(ctx,punten)
        const g = ctx.createLinearGradient(...punten[0], ...punten[2])
        g.addColorStop(0,vlak.kleuren[0]); g.addColorStop(1,vlak.kleuren[1])
        ctx.fillStyle = g; ctx.fill()
        if (vlak.voorkant) {
          ctx.strokeStyle = '#a8d7ff35'; ctx.lineWidth = .85; ctx.stroke()
        }
        if (schaduwVakken.length) {
          const bron = vlak.punten.map(([px,py,pz]) => {
            const dz = bubbelHoogte - pz
            return projecteer([px + dz * .62, py - dz * .70, bubbelHoogte])
          })
          const rechthoek = grenzen(bron)
          if (schaduwVakken.some(vak => raakt(vak,rechthoek))) projecteerSchaduw(ctx,masker,bron,punten,rechthoek)
        }
      }
    }
    const licht = ctx.createRadialGradient(w*.35,h*.25,Math.min(w,h)*.1,w*.48,h*.4,Math.hypot(w,h)*.68)
    licht.addColorStop(0,'#2289ff18'); licht.addColorStop(.60,'#03133109'); licht.addColorStop(1,'#01091bdd')
    ctx.fillStyle = licht; ctx.fillRect(0,0,w,h)
    if (kanBewegen() && (Math.abs(x-doelX) > .004 || Math.abs(y-doelY) > .004)) plan()
  }

  const resize = new ResizeObserver(meet)
  resize.observe(venster)
  // Afbeeldingen, emoji en nieuwe of bewerkte berichten kunnen de zichtbare vormen wijzigen.
  const mutaties = new MutationObserver(meet)
  mutaties.observe(venster,{ subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class','style','hidden'] })
  venster.addEventListener('load',meet,{ ...signaal, capture:true })
  venster.addEventListener('scroll',() => {
    const delta = venster.scrollTop - vorigeY
    vorigeY = venster.scrollTop
    meet()
    // Op een telefoon zonder sensortoegang beweegt de wand subtiel met het scrollen.
    if (!kanBewegen() || !touch.matches || performance.now() - laatsteSensor < 1200) return
    richt(0, delta / -65)
    clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => richt(0,0),150)
  },signaal)
  window.addEventListener('resize',meet,signaal)
  window.visualViewport?.addEventListener('resize',meet,signaal)
  document.addEventListener('visibilitychange',() => { basis = null; meet() },signaal)
  motion.addEventListener('change',resetBeweging,signaal)
  window.addEventListener('storage',event => {
    if (event.key === BEWEGING || event.key === null) leesBeweging()
  },signaal)
  window.addEventListener('pageshow',leesBeweging,signaal)
  const richt = (rx,ry) => { doelX = maxTilt(rx); doelY = maxTilt(ry); plan() }
  venster.addEventListener('pointermove',event => {
    if (!kanBewegen() || event.pointerType !== 'mouse' || event.buttons) return
    const r = venster.getBoundingClientRect()
    if (r.width && r.height) richt(2*(event.clientX-r.left)/r.width-1, 2*(event.clientY-r.top)/r.height-1)
  },signaal)
  venster.addEventListener('pointerleave',() => { if (kanBewegen()) richt(0,0) },signaal)
  window.addEventListener('deviceorientation',event => {
    if (!kanBewegen() || document.hidden || canvas.hidden || !Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return
    laatsteSensor = performance.now()
    clearTimeout(scrollTimer)
    if (!basis) basis = { gamma:event.gamma, beta:event.beta }
    const draaiing = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180
    const verschil = (a,b) => ((a-b+540) % 360)-180
    const g = verschil(event.gamma,basis.gamma), b = verschil(event.beta,basis.beta)
    richt((g*Math.cos(draaiing)+b*Math.sin(draaiing))/24,(b*Math.cos(draaiing)-g*Math.sin(draaiing))/28)
  },signaal)
  screen.orientation?.addEventListener('change',resetBeweging,signaal)
  leesBeweging()
  meet()
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(scrollTimer)
    resize.disconnect(); mutaties.disconnect(); luisteraars.abort()
    canvas.width = masker.width = 0
  }
}

// De laag is een broer van de scrollende berichtenlijst en zit achter de onlinegolf.
export function koppelChatDepth(venster) {
  if (!venster?.parentElement) return
  const ouder = venster.parentElement
  let wis = null
  function werkBij() {
    let aan = false
    try { aan = localStorage.getItem(VOORKEUR) === '1' } catch { /* instelling niet beschikbaar */ }
    if (aan === Boolean(wis)) return
    if (!aan) { wis(); wis = null; return }
    const canvas = document.createElement('canvas')
    canvas.className = 'chat-depth-wand'
    canvas.hidden = true
    canvas.setAttribute('aria-hidden','true')
    ouder.classList.add('chat-depth-actief')
    ouder.insertBefore(canvas,venster)
    const stop = maakWand(canvas,venster)
    wis = () => { stop?.(); canvas.remove(); ouder.classList.remove('chat-depth-actief') }
    if (!stop) { wis(); wis = null }
  }
  window.addEventListener('storage',event => { if (event.key === VOORKEUR || event.key === null) werkBij() })
  window.addEventListener('pageshow',werkBij)
  werkBij()
}
