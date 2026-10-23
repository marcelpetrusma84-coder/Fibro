// Eén recente uitnodiging per vriendenpaar. Tijdgebaseerde ids maken het
// mogelijk om vertraagde broadcasts en oude links veilig te negeren.
const PREFIX = 'fibro_nieuwste_spelsessie_'
const MAX_LEEFTIJD = 12 * 60 * 60 * 1000

export function nieuweSpelSessie() {
  return Date.now().toString(36)
}

function tijdVan(sessieId) {
  if (typeof sessieId !== 'string' || !/^[0-9a-z]{6,16}$/.test(sessieId)) return null
  const tijd = parseInt(sessieId, 36)
  return Number.isSafeInteger(tijd) && tijd > 1700000000000 ? tijd : null
}

export function isNieuwsteSpelSessie(mijnId, vriendId, sessieId) {
  const tijd = tijdVan(sessieId)
  // Oude UUID-uitnodigingen blijven bruikbaar tijdens de overgang.
  if (tijd === null || !mijnId || !vriendId) return true
  const sleutel = PREFIX + [mijnId, vriendId].sort().join('_')
  try {
    const oud = JSON.parse(localStorage.getItem(sleutel) || 'null')
    const bekendeTijd = Number(oud?.tijd) || 0
    const bewaardOp = Number(oud?.bewaardOp) || 0
    if (bewaardOp && Date.now() - bewaardOp < MAX_LEEFTIJD && bekendeTijd > tijd) return false
    localStorage.setItem(sleutel, JSON.stringify({ tijd, bewaardOp: Date.now() }))
  } catch (e) {}
  return true
}
