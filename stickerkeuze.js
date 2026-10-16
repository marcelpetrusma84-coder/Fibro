// stickerkeuze.js - de stickerkeuze in de chat (v153, 15 oktober 2026; v154: tekst bij Eigen;
// v155: de vakjes Eigen tonen je eigen stickers uit Profiel en je kunt ze versturen; v156: vel 1; v160: mp3-geluiden; v162: eigenstickers.js met versies)
// Twee rijen van zes vakjes: bovenaan de zes vellen van Fibro (stickervellen.js), daaronder twee
// vakjes voor eigen stickers en vier voor vellen uit de winkel. Elk vel heeft 12 stickers; op de
// telefoon 4 naast elkaar, op een breed scherm 6. Een leeg vakje zegt wat er later komt.
// Gebruik: const k = maakStickerkeuze(element, { onKies: sticker => ..., uid: () => id }); k.vernieuw() leest
// je eigen stickers opnieuw (bij het openen). sticker = { vel, nr, naam, b, g, src }.
import { FIBRO_VELLEN, zoekSticker } from './stickervellen.js?v=161'
import { leesEigen } from './eigenstickers.js?v=162'
import { speelBeweging } from './stickerfx.js?v=161'

const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const naamVan = n => Array.isArray(n) ? ((window.T && window.T.taal === 'en') ? n[1] : n[0]) : ''
const SLEUTEL = 'fibro_stickervak'

const STIJL = `
.sk { display:flex; flex-direction:column; gap:6px; padding:8px 10px 10px; width:100%; box-sizing:border-box; }
.sk-label { display:grid; grid-template-columns:2fr 4fr; gap:6px; font-size:11px; color:var(--muted); opacity:0.8; padding:0 2px; }
.sk-label.boven { grid-template-columns:1fr; }
.sk-rij { display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:6px; }
.sk-vak { height:42px; min-width:0; border-radius:10px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:15px; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; -webkit-tap-highlight-color:transparent; }
.sk-vak.leeg { opacity:0.55; }
.sk-vak.stippel { border-style:dashed; background:transparent; }
.sk-vak[aria-selected="true"] { border:2px solid var(--accent); opacity:1; background:rgba(192,132,252,0.14); }
.sk-vak img { width:32px; height:32px; object-fit:contain; pointer-events:none; }
.sk-vak:focus-visible, .sk-sticker:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.sk-inhoud { border-top:0.5px solid var(--border); padding-top:8px; max-height:216px; overflow-y:auto; -webkit-overflow-scrolling:touch; } /* v156: een heel vel (3 rijen) zonder schuiven */
.sk-raster { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px; }
@media (min-width:600px) { .sk-raster { grid-template-columns:repeat(6, minmax(0, 1fr)); } }
.sk-sticker { height:64px; min-width:0; border:0; border-radius:10px; background:transparent; padding:2px; cursor:pointer; display:flex; align-items:center; justify-content:center; -webkit-tap-highlight-color:transparent; }
.sk-sticker:active { background:rgba(192,132,252,0.14); }
.sk-sticker img { max-width:100%; max-height:100%; object-fit:contain; pointer-events:none; }
.sk-leeg { font-size:14px; line-height:1.45; color:var(--text); opacity:0.85; text-align:center; padding:14px 12px 16px; }
`

function zetStijl() {
  if (document.getElementById('sk-stijl')) return
  const s = document.createElement('style'); s.id = 'sk-stijl'; s.textContent = STIJL
  document.head.appendChild(s)
}

// De twaalf vakjes: f1..f6 (Fibro), e1..e2 (eigen), w1..w4 (winkel)
function vakken() {
  const uit = FIBRO_VELLEN.map((v, i) => ({ id: v.id, soort: 'fibro', n: i + 1, vel: v }))
  for (let i = 1; i <= 2; i++) uit.push({ id: 'e' + i, soort: 'eigen', n: i })
  for (let i = 1; i <= 4; i++) uit.push({ id: 'w' + i, soort: 'winkel', n: i })
  return uit
}

export function maakStickerkeuze(el, { onKies, uid } = {}) {
  if (!el) return null
  let eigen = {} // je eigen stickers: { 'e1-01': { code, data, b, g, naam } }
  zetStijl()
  const alle = vakken()
  let gekozen = null
  try { gekozen = localStorage.getItem(SLEUTEL) } catch (e) {}
  if (!alle.some(v => v.id === gekozen)) {
    const eerste = alle.find(v => v.soort === 'fibro' && v.vel.stickers.length)
    gekozen = eerste ? eerste.id : 'f1'
  }

  el.textContent = ''
  const sk = document.createElement('div'); sk.className = 'sk'
  const lijst = document.createElement('div'); lijst.setAttribute('role', 'tablist'); lijst.setAttribute('aria-label', T('Stickervellen'))
  lijst.style.cssText = 'display:flex;flex-direction:column;gap:6px'
  const labelBoven = document.createElement('div'); labelBoven.className = 'sk-label boven'
  labelBoven.textContent = T('Vellen van {app}')
  const rij1 = document.createElement('div'); rij1.className = 'sk-rij'
  const labelOnder = document.createElement('div'); labelOnder.className = 'sk-label'
  const lE = document.createElement('span'); lE.textContent = T('Eigen')
  const lW = document.createElement('span'); lW.textContent = T('Winkel')
  labelOnder.append(lE, lW)
  const rij2 = document.createElement('div'); rij2.className = 'sk-rij'
  lijst.append(labelBoven, rij1, labelOnder, rij2)
  const inhoud = document.createElement('div'); inhoud.className = 'sk-inhoud'; inhoud.setAttribute('role', 'tabpanel'); inhoud.id = 'sk-inhoud'
  sk.append(lijst, inhoud)
  el.appendChild(sk)

  const knoppen = {}
  alle.forEach(v => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sk-vak'
    b.setAttribute('role', 'tab'); b.dataset.vak = v.id; b.setAttribute('aria-controls', 'sk-inhoud')
    if (v.soort === 'fibro') {
      b.setAttribute('aria-label', T('Vel {n}', { n: v.n }))
      const eerste = v.vel.stickers[0]
      if (eerste) {
        const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'
        img.src = zoekSticker(v.id + '-' + eerste.nr).src
        b.appendChild(img)
      } else { b.textContent = String(v.n); b.classList.add('leeg') }
    } else if (v.soort === 'eigen') {
      b.setAttribute('aria-label', T('Eigen vel {n}', { n: v.n }))
    } else {
      b.setAttribute('aria-label', T('Winkelvak {n}', { n: v.n }))
      b.textContent = '\u{1F6CD}️'; b.classList.add('stippel', 'leeg')
    }
    b.addEventListener('click', () => kies(v.id))
    knoppen[v.id] = b
    ;(v.soort === 'fibro' ? rij1 : rij2).appendChild(b)
  })

  // eigen stickers van een vel, op volgorde
  const eigenVan = vel => Object.keys(eigen).filter(c => c.startsWith(vel + '-')).sort().map(c => eigen[c])
  function zetEigenVakjes() {
    for (const v of alle) {
      if (v.soort !== 'eigen') continue
      const b = knoppen[v.id], eerste = eigenVan(v.id)[0]
      b.textContent = ''
      if (eerste) {
        const img = document.createElement('img'); img.alt = ''; img.src = eerste.data
        b.appendChild(img); b.classList.remove('stippel', 'leeg')
      } else { b.textContent = '+'; b.classList.add('stippel', 'leeg') }
    }
  }
  zetEigenVakjes()

  function toonInhoud(v) {
    inhoud.textContent = ''
    if (v.soort === 'fibro' && v.vel.stickers.length) {
      const raster = document.createElement('div'); raster.className = 'sk-raster'
      v.vel.stickers.forEach(s => {
        const st = zoekSticker(v.id + '-' + s.nr)
        if (!st) return
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sk-sticker'
        b.setAttribute('aria-label', T('Stuur sticker {naam}', { naam: naamVan(st.naam) }))
        const img = document.createElement('img'); img.src = st.src; img.alt = ''; img.loading = 'lazy'
        b.appendChild(img)
        b.addEventListener('click', () => { speelBeweging(img, st.b); if (onKies) onKies(st) })
        raster.appendChild(b)
      })
      inhoud.appendChild(raster)
      return
    }
    if (v.soort === 'eigen' && eigenVan(v.id).length) {
      const raster = document.createElement('div'); raster.className = 'sk-raster'
      eigenVan(v.id).forEach(s => {
        const st = { vel: v.id, nr: s.code.slice(3), naam: s.naam, b: s.b, g: s.g, src: s.data }
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sk-sticker'
        b.setAttribute('aria-label', T('Stuur sticker {naam}', { naam: s.naam || T('Eigen sticker') }))
        const img = document.createElement('img'); img.src = s.data; img.alt = ''
        b.appendChild(img)
        b.addEventListener('click', () => { speelBeweging(img, st.b); if (onKies) onKies(st) })
        raster.appendChild(b)
      })
      inhoud.appendChild(raster)
      return
    }
    const p = document.createElement('div'); p.className = 'sk-leeg'
    if (v.soort === 'fibro') p.textContent = T('Vel {n} is nog leeg. Hier komen binnenkort stickers die bewegen en geluid maken.', { n: v.n })
    else if (v.soort === 'eigen') p.textContent = T('Je eigen stickers maak je in Profiel, bij Stickers.')
    else p.textContent = T('Hier komen stickervellen uit de winkel. De winkel komt later.')
    inhoud.appendChild(p)
  }

  function kies(id) {
    const v = alle.find(x => x.id === id) || alle[0]
    gekozen = v.id
    try { localStorage.setItem(SLEUTEL, gekozen) } catch (e) {}
    Object.entries(knoppen).forEach(([k, b]) => {
      b.setAttribute('aria-selected', k === gekozen ? 'true' : 'false')
      b.tabIndex = k === gekozen ? 0 : -1
    })
    toonInhoud(v)
  }

  // Pijltjestoetsen tussen de vakjes (toetsenbord op de Deck/pc)
  lijst.addEventListener('keydown', e => {
    const i = alle.findIndex(v => v.id === gekozen)
    let j = -1
    if (e.key === 'ArrowRight') j = (i + 1) % alle.length
    else if (e.key === 'ArrowLeft') j = (i - 1 + alle.length) % alle.length
    else if (e.key === 'ArrowDown') j = Math.min(alle.length - 1, i + 6)
    else if (e.key === 'ArrowUp') j = Math.max(0, i - 6)
    if (j < 0) return
    e.preventDefault(); kies(alle[j].id); knoppen[alle[j].id].focus()
  })

  kies(gekozen)

  // je eigen stickers (opnieuw) lezen: bij het openen van de keuze, want je maakt ze in Profiel
  async function vernieuw() {
    const id = typeof uid === 'function' ? uid() : uid
    if (!id) return
    try { eigen = await leesEigen(id) } catch (e) { eigen = {} }
    zetEigenVakjes()
    const v = alle.find(x => x.id === gekozen)
    if (v && v.soort === 'eigen') toonInhoud(v)
  }
  vernieuw()
  return { vernieuw }
}
