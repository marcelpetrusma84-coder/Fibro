const STANDEN = [0, 4, 8, 12]
export function eindsceneStand(value) {
  const n = Math.max(0, Math.min(12, Math.floor(Number(value) || 0)))
  const laag = Math.min(8, Math.floor(n / 4) * 4)
  return { n, over: 12 - n, laag, hoog: laag + 4, mix: (n - laag) / 4 }
}

export function maakEindscene(value, { doc = document, T = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v?.[k] ?? '') } = {}) {
  if (!doc.getElementById('kj-eindscene-css')) {
    const link = doc.createElement('link')
    link.id = 'kj-eindscene-css'; link.rel = 'stylesheet'
    link.href = new URL('./koningsjacht-eindscene.css?v=1', import.meta.url).href
    doc.head.appendChild(link)
  }
  const figure = doc.createElement('figure'); figure.className = 'kj-eindscene'
  const beelden = doc.createElement('div'); beelden.className = 'kj-eindscene-beeld'
  const imgs = STANDEN.map(n => {
    const img = doc.createElement('img'); img.alt = ''; img.decoding = 'async'
    img.src = new URL(`./kaarten/koningsjacht-einde/stand-${n}.webp`, import.meta.url).href
    img.width = 1536; img.height = 1024; img.style.opacity = '0'
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
    // Two registered drawings blend in place; every single guard changes the condition.
    imgs.forEach((img, i) => { img.style.opacity = STANDEN[i] === s.laag ? '1' : STANDEN[i] === s.hoog ? String(s.mix) : '0' })
    tekens.forEach((el, i) => el.classList.toggle('verdiend', i < s.n))
    teller.textContent = `${s.n} / 12`
    caption.textContent = s.n === 12 ? T('Alle twaalf wachters verslagen — het kasteel is veroverd!')
      : s.n === 1 ? T('1 wachter verslagen · nog 11 te gaan') : T('{n} wachters verslagen · nog {over} te gaan', { n: s.n, over: s.over })
  }
  update(value)
  return { element: figure, update }
}
