// foutgroepen.js (17 nov 2026, op verzoek van Marcel): foutmeldingen slimmer groeperen in Moderatie > Fouten.
//
// Eerst kwam dezelfde fout als losse kaarten binnen als hij op een andere regel, op een andere pagina of met andere
// details gebeurde. Bijvoorbeeld 'Can't find variable: indexedDB' op profiel.html én op vriend-profiel.html, of
// 'FileReader' op index.html:1144 en index.html:1542. Nu telt de fout zelf: soort + foutregel + bestand. Regel- en
// kolomnummers, details na ' · ', en lange getallen of id's tellen niet mee. Op de kaart staan alle pagina's en de
// verschillende varianten. De nieuwste fout staat bovenaan.

const MAX_VARIANTEN = 3

// De foutregel zonder dingen die per keer verschillen (id's, lange getallen)
export function kernBericht(bericht) {
  return String(bericht || '').replace(/\s+/g, ' ').trim()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '…')
    .replace(/\b\d{4,}\b/g, '#')
}
// Het bestand of de plek, zonder :regel:kolom en zonder de details na ' · '
export function kernBron(bron) {
  return String(bron || '').split(' · ')[0].replace(/:\d+(:\d+)?\b/g, '').trim()
}

// rijen: { id, created_at, pagina, soort, bericht, bron, stapel, toestel }. Geeft groepen, nieuwste bovenaan.
export function groepeerFouten(rijen) {
  const groepen = new Map()
  for (const r of rijen || []) {
    const sleutel = [r.soort, kernBericht(r.bericht), kernBron(r.bron)].join('\u0001')
    let g = groepen.get(sleutel)
    if (!g) {
      g = { soort: r.soort, bericht: r.bericht, bron: r.bron, stapel: r.stapel, laatst: r.created_at, eerst: r.created_at,
        ids: [], paginas: new Map(), toestellen: new Map(), varianten: [] }
      groepen.set(sleutel, g)
    }
    g.ids.push(r.id)
    if (r.created_at > g.laatst) { g.laatst = r.created_at; g.bericht = r.bericht; g.bron = r.bron }
    if (r.created_at < g.eerst) g.eerst = r.created_at
    if (r.pagina) g.paginas.set(r.pagina, (g.paginas.get(r.pagina) || 0) + 1)
    if (r.toestel) g.toestellen.set(r.toestel, (g.toestellen.get(r.toestel) || 0) + 1)
    if (!g.stapel && r.stapel) g.stapel = r.stapel
    const variant = [r.bericht, r.bron].filter(Boolean).join(' — ')
    if (variant && !g.varianten.includes(variant) && g.varianten.length < MAX_VARIANTEN + 1) g.varianten.push(variant)
  }
  const uit = [...groepen.values()]
  for (const g of uit) g.pagina = [...g.paginas.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p).join(', ')
  return uit.sort((a, b) => (a.laatst < b.laatst ? 1 : a.laatst > b.laatst ? -1 : b.ids.length - a.ids.length))
}
