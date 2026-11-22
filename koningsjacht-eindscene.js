const STANDEN = [0, 4, 6, 8, 12]
const BEELDEN = {
  0: { 0: 'stand-0-v3.jpg', 4: 'stand-4-v3.jpg', 6: 'stand-6-v2.jpg', 8: 'stand-8.webp', 12: 'stand-12.webp' },
  2: { 0: 'narren-2/stand-0.jpg', 4: 'narren-2/stand-4.jpg', 6: 'narren-2/stand-6.jpg', 8: 'narren-2/stand-8.jpg', 12: 'narren-2/stand-12.jpg' },
  4: { 0: 'narren-4/stand-0.jpg', 4: 'narren-4/stand-4.jpg', 6: 'narren-4/stand-6.jpg', 8: 'narren-4/stand-8.jpg', 12: 'narren-4/stand-12.jpg' },
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

export function maakEindscene(value, { narren = 0, doc = document, T = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v?.[k] ?? '') } = {}) {
  if (!doc.getElementById('kj-eindscene-css')) {
    const link = doc.createElement('link')
    link.id = 'kj-eindscene-css'; link.rel = 'stylesheet'
    link.href = new URL('./koningsjacht-eindscene.css?v=2', import.meta.url).href
    doc.head.appendChild(link)
  }
  const figure = doc.createElement('figure'); figure.className = 'kj-eindscene'
  figure.dataset.narren = String(eindsceneNarren(narren))
  const beelden = doc.createElement('div'); beelden.className = 'kj-eindscene-beeld'
  const imgs = STANDEN.map(n => {
    const img = doc.createElement('img'); img.alt = ''; img.decoding = 'async'
    img.src = new URL(`./kaarten/koningsjacht-einde/${BEELDEN[eindsceneNarren(narren)][n]}`, import.meta.url).href
    img.width = 1536; img.height = 1024; img.style.display = 'none'
    beelden.appendChild(img); return img
  })
  const vaandel = doc.createElement('div'); vaandel.className = 'kj-eindscene-vaandel'
  vaandel.setAttribute('aria-hidden', 'true')
  const shields = doc.createElement('div'); shields.className = 'kj-eindscene-schilden'
  const tekens = Array.from({ length: 12 }, () => {
    const el = doc.createElement('span'); el.textContent = '♜'; shields.appendChild(el); return el
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
    caption.textContent = s.n === 12 ? T('Alle twaalf wachters verslagen — het kasteel is veroverd!')
      : s.n === 1 ? T('1 wachter verslagen · nog 11 te gaan') : T('{n} wachters verslagen · nog {over} te gaan', { n: s.n, over: s.over })
  }
  update(value)
  return { element: figure, update }
}
