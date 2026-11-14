// Visuele slijtage: de kandelaar blijft op zijn plek, alleen de was wordt korter.
// De spelstatus en de beslissing wanneer een nieuwe pul verschijnt blijven elders.
const asset = naam => new URL('./assets/koningsjacht/' + naam, import.meta.url).href

function onderdeel(kaars, naam, tag = 'div') {
  let element = kaars.querySelector('.' + naam)
  if (!element) {
    element = kaars.ownerDocument.createElement(tag)
    element.className = naam
    element.setAttribute('aria-hidden', 'true')
    kaars.appendChild(element)
  }
  return element
}

export function zetKaarsSlijtage(tafelElement, { scene = 'standaard', bierpul = false, ronde = 0 } = {}) {
  if (!tafelElement?.querySelectorAll) return
  const stappen = bierpul && Number.isFinite(ronde) ? Math.max(0, Math.min(9, Math.floor(ronde))) : 0
  const verbruikt = stappen / 10
  for (const kaars of tafelElement.querySelectorAll('.kj-kaars')) {
    kaars.dataset.slijtage = String(stappen)
    const frame = kaars.querySelector('.kj-kandelaar')
    const vlam = kaars.querySelector('.kj-vlam')
    if (!frame || !vlam) continue
    const modern = scene === 'modern'
    const links = kaars.classList.contains('kj-links')
    const bestand = modern ? (links ? 'candle-modern-left.png' : 'candle-modern-right.png') : 'chamberstick.png'
    const was = onderdeel(kaars, 'kj-slijtage-was')
    const druppels = onderdeel(kaars, 'kj-slijtage-druppels')
    const plas = onderdeel(kaars, 'kj-slijtage-plas')
    const licht = onderdeel(kaars, 'kj-slijtage-licht')
    for (const el of [was, druppels, plas, licht]) el.style.pointerEvents = 'none'
    was.hidden = druppels.hidden = plas.hidden = licht.hidden = true
    frame.style.removeProperty('clip-path')
    frame.style.removeProperty('z-index')
    vlam.style.removeProperty('bottom')
    vlam.style.removeProperty('z-index')
    vlam.style.removeProperty('scale')

    if (!stappen) {
      const url = asset(bestand)
      if (frame.src !== url) frame.src = url
      continue
    }

    // Alleen de was verandert; de hele foto van de lege houder blijft ongeschaald.
    const leeg = modern ? (links ? 'candle-modern-left-empty.png' : 'candle-modern-right-empty.png') : 'chamberstick-empty.png'
    const url = asset(leeg)
    if (frame.src !== url) frame.src = url
    frame.style.zIndex = '2'
    const vorm = modern ? (links ? { links:31, breed:37, voet:10, hoog:68 } : { links:45.5, breed:8.5, voet:60, hoog:36 }) : { links:40.5, breed:11, voet:38, hoog:54.5 }
    const hoogte = vorm.hoog * (1 - verbruikt)
    was.hidden = false
    was.style.cssText = `position:absolute;left:${vorm.links}%;width:${vorm.breed}%;bottom:${vorm.voet}%;height:${hoogte}%;z-index:1;pointer-events:none;border-radius:45% 45% 10% 10% / 7% 7% 3% 3%;background:radial-gradient(ellipse at 50% 3%,#fff7dc 0 47%,#dbc39b 49%,transparent 52%) top/100% 10% no-repeat,linear-gradient(90deg,#ad916b,#f1e4c6 24%,#fff6df 52%,#ccb590 90%,#9e805b);box-shadow:inset 0 0 8px #9d784b88;`
    vlam.style.bottom = `${vorm.voet + hoogte - .5}%`
    vlam.style.zIndex = modern ? '1' : '3'
    vlam.style.scale = String(1 - verbruikt * .2)
    druppels.hidden = false
    druppels.style.cssText = `position:absolute;inset:0;z-index:3;pointer-events:none;opacity:${.35 + verbruikt * .6};`
    druppels.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true"><g fill="none" stroke="#fff0d2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="100" stroke-dashoffset="${100 - verbruikt * 100}"><path pathLength="100" d="M48 38 C45 44 48 48 45 54 S49 63 45 71 S42 86 34 95" stroke-width="2.2"/><path pathLength="100" d="M54 43 C57 50 51 56 55 62 S51 76 57 82 S62 90 59 96" stroke-width="1.5"/></g></svg>`

    // Statische was en reflectie reageren op de instelling voor kaarslicht,
    // omdat ze binnen de bestaande kaarslaag blijven en geen eigen timer hebben.
    plas.hidden = false
    plas.style.cssText = `position:absolute;left:27%;bottom:3%;width:47%;height:${2 + stappen * .35}%;z-index:2;pointer-events:none;border-radius:50%;background:radial-gradient(ellipse,#fff6d9dd 0,#e4c99ca8 48%,#d2a36d55 68%,transparent 75%);`
    if (modern) {
      licht.hidden = false
      licht.style.cssText = 'position:absolute;left:-65%;bottom:-10%;width:230%;height:28%;z-index:0;pointer-events:none;opacity:.9;mix-blend-mode:screen;background:repeating-conic-gradient(from 12deg at 50% 50%,#ffdc8c99 0deg,#fff1bb99 5deg,transparent 10deg,transparent 18deg),repeating-radial-gradient(ellipse at 50% 50%,transparent 0 5px,#fff3c277 6px,transparent 8px);mask-image:radial-gradient(ellipse,#000 0%,transparent 72%);-webkit-mask-image:radial-gradient(ellipse,#000 0%,transparent 72%);transform:perspective(130px) rotateX(62deg);'
    }
  }
}
