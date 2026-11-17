// Bescherm de linker bovenhoek (waarde + soort) tegen hoger liggende kaarten.
export function berekenLeesbareWaaier({ breedte, kw, kh, aantal, selectie = [], loep = -1 }) {
  if (![breedte, kw, kh].every(n => Number.isFinite(n) && n > 0) || !Number.isInteger(aantal) || aantal < 1) return null
  const gekozen = new Set(selectie.filter(i => Number.isInteger(i) && i >= 0 && i < aantal))
  const kijk = Number.isInteger(loep) && loep >= 0 && loep < aantal ? loep : -1
  if (!gekozen.size && kijk < 0) return null
  const ruimte = Math.max(kw * 1.4, breedte - 16)
  const kaarten = Array.from({ length:aantal }, (_, i) => ({
    i, schaal:i === kijk ? 1.4 : gekozen.has(i) ? 1.25 : 1,
    z:i === kijk ? 400 : gekozen.has(i) ? 200 + i : 10 + i,
    y:kh * (.3 - (i === kijk ? .46 : gekozen.has(i) ? .36 : 0))
  }))
  function rij(indices, uitspreiden = false) {
    const r = []
    for (const i of indices) {
      const kaart = kaarten[i], overhang = (kaart.schaal - 1) * kw / 2
      let x = 0
      for (const links of r) {
        const l = links.x - (links.schaal - 1) * kw / 2
        // Links ligt hoger: zijn hele rechterrand moet voorbij onze hoek zijn.
        // Rechts ligt hoger: hij moet voorbij de waarde én soort van links beginnen.
        const grens = links.z > kaart.z
          ? l + kw * links.schaal + overhang - kw * kaart.schaal * .015 + 3
          : l + kw * links.schaal * .245 + overhang + 3
        x = Math.max(x, grens)
      }
      r.push({ ...kaart, x })
    }
    const grenzen = () => ({
      links:Math.min(...r.map(k => k.x - (k.schaal - 1) * kw / 2)),
      rechts:Math.max(...r.map(k => k.x + kw + (k.schaal - 1) * kw / 2))
    })
    let g = grenzen(), minimaal = g.rechts - g.links
    if (uitspreiden && r.length > 1) {
      const extra = Math.max(0, Math.min(kw * .22, (ruimte - minimaal) / (r.length - 1)))
      r.forEach((k, i) => { k.x += extra * i })
      g = grenzen()
    }
    const verschuif = (breedte - (g.rechts - g.links)) / 2 - g.links
    r.forEach((k, i) => { k.x += verschuif; k.r = 0; k.stap = i + 1 < r.length ? r[i + 1].x + verschuif - k.x : kw * .3 })
    return { kaarten:r, minimaal }
  }
  const alle = kaarten.map(k => k.i)
  let rijen = [alle]
  if (rij(alle).minimaal > ruimte && aantal <= 12) {
    let beste = null, prijs = Infinity
    for (let masker = 1; masker < (1 << aantal) - 1; masker++) {
      const voor = alle.filter(i => masker & (1 << i)), achter = alle.filter(i => !(masker & (1 << i)))
      const a = rij(voor), b = rij(achter)
      if (a.minimaal > ruimte || b.minimaal > ruimte) continue
      const actief = i => gekozen.has(i) || i === kijk
      const score = voor.filter(i => !actief(i)).length * 50 + achter.filter(actief).length * 35 + (a.minimaal + b.minimaal) / 1000
      if (score < prijs) { prijs = score; beste = [voor, achter] }
    }
    if (beste) rijen = beste
  }
  if (rijen.length === 1 && rij(alle).minimaal > ruimte) {
    // Ook buiten de Koningsjacht-handlimiet blijft de plaatsing eindig en leesbaar.
    rijen = [[]]
    for (const i of alle) {
      const laatste = rijen[rijen.length - 1]
      if (laatste.length && rij([...laatste, i]).minimaal > ruimte) rijen.push([i])
      else laatste.push(i)
    }
  }
  const resultaat = Array(aantal)
  let onderkant = -Infinity
  rijen.forEach((indices, nummer) => {
    const r = rij(indices, true).kaarten
    const boven = Math.min(...r.map(k => k.y - (k.schaal - 1) * kh / 2))
    const dy = nummer ? onderkant + 10 - boven : Math.max(0, 8 - boven)
    r.forEach(k => { k.y += dy; k.rij = nummer; resultaat[k.i] = k })
    onderkant = Math.max(...r.map(k => k.y + kh + (k.schaal - 1) * kh / 2))
  })
  return { kaarten:resultaat, hoogte:Math.ceil(Math.max(kh * 1.42, onderkant + 8)), rijen:rijen.length }
}
