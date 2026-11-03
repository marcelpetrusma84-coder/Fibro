const inBord = vak => Array.isArray(vak) && vak.length === 2 && vak.every(n => Number.isInteger(n) && n >= 0 && n < 8)
const geldigBord = bord => Array.isArray(bord) && bord.length === 8 && bord.every(rij =>
  Array.isArray(rij) && rij.length === 8 && rij.every(stuk => stuk == null || /^[wz][PNBRQK]$/.test(stuk)))
const kopie = staat => ({ ...staat, bord:staat.bord.map(rij => rij.slice()), rokade:{ ...staat.rokade } })
const stellingSleutel = (staat, vak) => `${vak[0]},${vak[1]}|${staat.bord.map(rij => rij.map(stuk => stuk || '--').join('')).join('/')}|${JSON.stringify(staat.rokade)}|${staat.enPassantKolom}`

// These are hypothetical consecutive moves of the same knight, not a prediction
// of an alternating game. Other pieces stand still except pieces captured along
// a branch. Each jump must still leave the moving side's own king safe. Returning
// to an earlier square is allowed; a square may therefore belong to several
// exact jump counts. Depth toggles filter the result, never intermediate routes.
export function berekenPaardroutes({ Schaak, staat, van, stappen = [true,true,true,true] } = {}) {
  if (typeof Schaak?.legaleZetten !== 'function' || typeof Schaak?.voerZetUit !== 'function' ||
      !geldigBord(staat?.bord) || !inBord(van)) return []
  const stuk = staat.bord[van[0]][van[1]]
  if (!/^[wz]N$/.test(stuk || '')) return []
  const tonen = Array.from({ length:4 }, (_, i) => Array.isArray(stappen) && stappen[i] === true)
  const maximum = tonen.lastIndexOf(true) + 1
  if (!maximum) return []
  const kleur = stuk[0], velden = new Map()
  const begin = kopie(staat)
  // Inspecting an opposing knight during the human turn uses that knight's
  // colour for the hypothetical jumps, without changing whose turn it is live.
  begin.aanZet = kleur
  let front = [{ staat:begin, vak:van.slice() }]
  for (let diepte = 1; diepte <= maximum && front.length; diepte++) {
    const volgende = new Map()
    for (const positie of front) {
      for (const zet of Schaak.legaleZetten(positie.staat, ...positie.vak)) {
        if (!inBord(zet?.van) || !inBord(zet?.naar) || zet.van[0] !== positie.vak[0] || zet.van[1] !== positie.vak[1]) continue
        const [r,k] = zet.naar, doel = positie.staat.bord[r][k]
        // Standard chess never captures the opposing king. The compact engine
        // can expose that target in a hypothetical position after a prior check.
        if (doel?.[1] === 'K' || doel?.[0] === kleur) continue
        if (tonen[diepte - 1]) {
          const sleutel = `${r},${k}`
          if (!velden.has(sleutel)) velden.set(sleutel, { r, k, steps:[] })
          const veld = velden.get(sleutel)
          if (veld.steps.at(-1) !== diepte) veld.steps.push(diepte)
        }
        if (diepte < maximum) {
          const simulatie = kopie(positie.staat)
          Schaak.voerZetUit(simulatie, zet)
          simulatie.aanZet = kleur
          // Merge only identical boards at the same depth. Distinct capture
          // histories that leave different pieces must remain distinct branches.
          const sleutel = stellingSleutel(simulatie, zet.naar)
          if (!volgende.has(sleutel)) volgende.set(sleutel, { staat:simulatie, vak:zet.naar.slice() })
        }
      }
    }
    front = [...volgende.values()]
  }
  return [...velden.values()].sort((a,b) => a.r - b.r || a.k - b.k)
}
