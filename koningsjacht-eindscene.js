const STANDEN = [0, 4, 6, 8, 12]
const BEELDEN = {
  0: { 0: 'stand-0-anatomie-v2.jpg', 4: 'stand-4-anatomie-v2.jpg', 6: 'stand-6-anatomie-v2.jpg', 8: 'stand-8-anatomie-v2.jpg', 12: 'stand-12-anatomie-v2.jpg' },
  2: { 0: 'narren-2/stand-0-anatomie-v2.jpg', 4: 'narren-2/stand-4-anatomie-v2.jpg', 6: 'narren-2/stand-6-anatomie-v2.jpg', 8: 'narren-2/stand-8-anatomie-v2.jpg', 12: 'narren-2/stand-12-anatomie-v2.jpg' },
  4: { 0: 'narren-4/stand-0-anatomie-v2.jpg', 4: 'narren-4/stand-4-anatomie-v2.jpg', 6: 'narren-4/stand-6-anatomie-v2.jpg', 8: 'narren-4/stand-8-anatomie-v2.jpg', 12: 'narren-4/stand-12-anatomie-v2.jpg' },
}
const MODERNE_BEELDEN = {
  0: { 0: 'modern/narren-0/stand-0.jpg', 4: 'modern/narren-0/stand-4.jpg', 6: 'modern/narren-0/stand-6.jpg', 8: 'modern/narren-0/stand-8.jpg', 12: 'modern/narren-0/stand-12.jpg' },
  2: { 0: 'modern/narren-2/stand-0.jpg', 4: 'modern/narren-2/stand-4.jpg', 6: 'modern/narren-2/stand-6.jpg', 8: 'modern/narren-2/stand-8.jpg', 12: 'modern/narren-2/stand-12.jpg' },
  4: { 0: 'modern/narren-4/stand-0.jpg', 4: 'modern/narren-4/stand-4.jpg', 6: 'modern/narren-4/stand-6.jpg', 8: 'modern/narren-4/stand-8.jpg', 12: 'modern/narren-4/stand-12.jpg' },
}
export function eindsceneNarren(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0))
  return n === 0 ? 0 : n <= 2 ? 2 : 4
}
export function eindsceneStand(value) {
  const n = Math.max(0, Math.min(12, Math.floor(Number(value) || 0)))
  const beeld = STANDEN.filter(stand => stand <= n).at(-1)
  return { n, over: 12 - n, beeld }
}

export function maakEindscene(value, { narren = 0, scene = 'middeleeuws', doc = document, T = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v?.[k] ?? '') } = {}) {
  if (!doc.getElementById('kj-eindscene-css')) {
    const link = doc.createElement('link')
    link.id = 'kj-eindscene-css'; link.rel = 'stylesheet'
    link.href = new URL('./koningsjacht-eindscene.css?v=4', import.meta.url).href
    doc.head.appendChild(link)
  }
  const figure = doc.createElement('figure'); figure.className = 'kj-eindscene'
  figure.dataset.narren = String(eindsceneNarren(narren))
  figure.dataset.scene = scene === 'modern' ? 'modern' : 'middeleeuws'
  const beeldenReeks = (scene === 'modern' ? MODERNE_BEELDEN : BEELDEN)[eindsceneNarren(narren)]
  const beelden = doc.createElement('div'); beelden.className = 'kj-eindscene-beeld'
  beelden.setAttribute('role', 'button')
  beelden.tabIndex = 0
  beelden.setAttribute('aria-label', 'Dubbeltik om de eindscène groot te bekijken')
  const imgs = STANDEN.map(n => {
    const img = doc.createElement('img'); img.alt = ''; img.decoding = 'async'
    img.src = new URL(`./kaarten/koningsjacht-einde/${beeldenReeks[n]}`, import.meta.url).href
    img.width = 1536; img.height = 1024; img.style.display = 'none'
    beelden.appendChild(img); return img
  })
  const vaandel = doc.createElement('div'); vaandel.className = 'kj-eindscene-vaandel'
  vaandel.setAttribute('aria-hidden', 'true')
  const shields = doc.createElement('div'); shields.className = 'kj-eindscene-schilden'
  const tekens = Array.from({ length: 12 }, () => {
    const el = doc.createElement('span'); el.textContent = scene === 'modern' ? '●' : '♜'; shields.appendChild(el); return el
  })
  const teller = doc.createElement('strong')
  vaandel.append(shields, teller); beelden.appendChild(vaandel)
  const caption = doc.createElement('figcaption'); caption.setAttribute('aria-live', 'polite')
  figure.append(beelden, caption)
  function update(v) {
    const s = eindsceneStand(v)
    figure.dataset.wachters = String(s.n)
    // Verschillende houdingen mogen niet over elkaar vervagen: de teller toont wel elke exacte score.
    imgs.forEach((img, i) => { img.style.display = STANDEN[i] === s.beeld ? 'block' : 'none' })
    tekens.forEach((el, i) => el.classList.toggle('verdiend', i < s.n))
    teller.textContent = `${s.n} / 12`
    caption.textContent = s.n === 12 ? T(scene === 'modern' ? 'Alle twaalf wachters verslagen — het onderwaterstation is gered!' : 'Alle twaalf wachters verslagen — het kasteel is veroverd!')
      : s.n === 1 ? T('1 wachter verslagen · nog 11 te gaan') : T('{n} wachters verslagen · nog {over} te gaan', { n: s.n, over: s.over })
  }

  let laatsteTik = 0
  let vergrootOverlay = null
  function vergroot() {
    if (vergrootOverlay) return
    const overlay = doc.createElement('div')
    overlay.className = 'kj-eindscene-vergroot'
    overlay.dataset.scene = figure.dataset.scene
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Eindscène — grote weergave')

    const grootBeeld = beelden.cloneNode(true)
    grootBeeld.classList.add('kj-eindscene-beeld--groot')
    grootBeeld.setAttribute('aria-hidden', 'true')
    grootBeeld.tabIndex = -1
    const sluiten = doc.createElement('button')
    sluiten.className = 'kj-eindscene-sluiten'
    sluiten.type = 'button'
    sluiten.textContent = '×'
    sluiten.setAttribute('aria-label', 'Sluit grote afbeelding en ga terug naar het menu')
    overlay.append(grootBeeld, sluiten)

    const vorigeOverflow = doc.body.style.overflow
    const wasInert = figure.inert
    function sluit() {
      if (!vergrootOverlay) return
      doc.removeEventListener('keydown', bijToets)
      doc.body.style.overflow = vorigeOverflow
      figure.inert = wasInert
      overlay.remove()
      vergrootOverlay = null
      beelden.focus?.({ preventScroll: true })
    }
    function bijToets(event) {
      if (event.key === 'Escape') sluit()
      else if (event.key === 'Tab') {
        event.preventDefault()
        sluiten.focus()
      }
    }
    sluiten.addEventListener('click', sluit)
    overlay.addEventListener('click', event => { if (event.target === overlay) sluit() })
    doc.addEventListener('keydown', bijToets)
    doc.body.style.overflow = 'hidden'
    figure.inert = true
    doc.body.appendChild(overlay)
    vergrootOverlay = overlay
    sluiten.focus({ preventScroll: true })
  }
  beelden.addEventListener('pointerup', event => {
    if (event.pointerType !== 'touch') return
    const nu = Date.now()
    if (nu - laatsteTik < 420) {
      event.preventDefault()
      laatsteTik = 0
      vergroot()
    } else laatsteTik = nu
  })
  beelden.addEventListener('dblclick', event => {
    event.preventDefault()
    vergroot()
  })
  beelden.addEventListener('click', event => {
    // Toetsenbord- en hulptechnologie-activatie; gewone enkele tikken openen niets.
    if (event.detail === 0) vergroot()
  })
  beelden.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      vergroot()
    }
  })
  update(value)
  return { element: figure, update }
}
