// solo-bord.js - computerspelers voor dammen en schaken (spel.html).
// Ze gebruiken dezelfde spelregels als het spel zelf (dammen.js, schaak.js),
// die spel.html meegeeft als "motor". Mens = wit, computer = zwart.

const willekeurig = lijst => lijst[Math.floor(Math.random() * lijst.length)]
// Even wachten voor de zet. Op moeilijk denkt de computer zelf al lang genoeg.
const bedenktijd = niveau => niveau === 'moeilijk' ? 100 : 450 + Math.floor(Math.random() * 400)
class TijdOp extends Error {}

// Zoeken met steeds een stap dieper, tot de tijd op is.
// zetten(stand) geeft de mogelijke zetten, doe(stand, zet) geeft een nieuwe stand,
// waarde(stand) geeft de stand vanuit de speler die aan zet is, eind(stand) geeft
// een waarde als het spel afgelopen is (anders null).
function zoek({ stand, zetten, doe, waarde, eind, maxDiepte, tijd, ruis }) {
  const stopOm = Date.now() + tijd
  let n = 0
  function negamax(s, diepte, alfa, beta, ply) {
    if ((++n & 63) === 0 && Date.now() > stopOm) throw new TijdOp()
    const lijst = zetten(s)
    if (!lijst.length) return eind(s, ply)
    if (diepte <= 0) return waarde(s)
    let beste = -Infinity
    for (const z of lijst) {
      const v = -negamax(doe(s, z), diepte - 1, -beta, -alfa, ply + 1)
      if (v > beste) beste = v
      if (beste > alfa) alfa = beste
      if (alfa >= beta) break
    }
    return beste
  }
  const wortel = zetten(stand)
  if (!wortel.length) return null
  let gekozen = wortel[0]
  let volgorde = wortel.slice()
  for (let d = 1; d <= maxDiepte; d++) {
    try {
      const scores = []
      let alfa = -Infinity
      for (const z of volgorde) {
        // Met ruis zonder snoeien in de wortel, anders zijn de scores alleen grenzen.
        const v = ruis
          ? -negamax(doe(stand, z), d - 1, -Infinity, Infinity, 1) + Math.random() * ruis
          : -negamax(doe(stand, z), d - 1, -Infinity, -alfa, 1)
        scores.push([v, z])
        if (v > alfa) alfa = v
      }
      scores.sort((a, b) => b[0] - a[0])
      volgorde = scores.map(x => x[1])
      gekozen = volgorde[0]
      if (scores[0][0] > 50000) break
    } catch (e) {
      if (e instanceof TijdOp) break
      throw e
    }
  }
  return gekozen
}

// ─────────────────────────────────────────────
// Dammen (10x10). Bord met 'wS','wD','zS','zD'. Wit loopt naar rij 0.
// ─────────────────────────────────────────────
function damWaarde(s) {
  let w = 0
  const b = s.bord
  for (let r = 0; r < 10; r++) for (let k = 0; k < 10; k++) {
    const x = b[r][k]
    if (!x) continue
    let v = x[1] === 'D' ? 300 : 100
    if (x[1] === 'S') {
      v += (x[0] === 'w' ? 9 - r : r) * 3          // vooruit is goed
      if (k >= 3 && k <= 6) v += 4                    // midden is goed
      if ((x[0] === 'w' && r === 9) || (x[0] === 'z' && r === 0)) v += 6   // achterste rij bewaken
    }
    w += x[0] === 'w' ? v : -v
  }
  return s.aanZet === 'w' ? w : -w
}

export function damKies(Dammen, staat, niveau) {
  const zetten = s => Dammen.alleZetten(s, s.aanZet).ketens
  const doe = (s, keten) => Dammen.voerKetenUit({ bord: s.bord, aanZet: s.aanZet }, keten)
  const stand = { bord: staat.bord, aanZet: staat.aanZet }
  const lijst = zetten(stand)
  if (!lijst.length) return null
  if (niveau === 'makkelijk') {
    if (Math.random() < 0.5) return willekeurig(lijst)
    return zoek({ stand, zetten, doe, waarde: damWaarde, eind: (s, ply) => -100000 + ply, maxDiepte: 1, tijd: 300, ruis: 60 })
  }
  if (niveau === 'normaal') return zoek({ stand, zetten, doe, waarde: damWaarde, eind: (s, ply) => -100000 + ply, maxDiepte: 3, tijd: 600, ruis: 8 })
  return zoek({ stand, zetten, doe, waarde: damWaarde, eind: (s, ply) => -100000 + ply, maxDiepte: 7, tijd: 1500 })
}

export function damBot({ stuur, niveau, isDicht, motor: Dammen }) {
  const IK = 'z'
  let staat = Dammen.nieuweSpelStaat()
  let spelId = 0, nr = 0
  let timer = null
  const laatste = { keten: null }
  function denk() {
    const id = spelId, n = nr
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (isDicht() || id !== spelId || n !== nr || staat.aanZet !== IK) return
      const keten = damKies(Dammen, staat, niveau)
      if (!keten) return
      staat = Dammen.voerKetenUit({ bord: staat.bord, aanZet: staat.aanZet }, keten)
      nr++
      laatste.keten = keten
      stuur('zet', { keten, bord: staat.bord, aanZet: staat.aanZet, nr, spelId })
    }, bedenktijd(niveau))
  }
  return {
    ontvang(event, p) {
      if (event === 'zet' && p.bord) {
        const id = p.spelId ?? spelId, n = p.nr ?? nr + 1
        if (id < spelId || (id === spelId && n <= nr)) return
        spelId = id; nr = n
        staat = { bord: p.bord.map(r => r.slice()), aanZet: p.aanZet }
        laatste.keten = p.keten || null
        if (staat.aanZet === IK && !Dammen.heeftGeenZetten(staat, IK)) denk()
      } else if (event === 'vraag-stand') {
        const id = p.spelId ?? 0, n = p.nr ?? 0
        if (spelId > id || (spelId === id && nr > n)) stuur('stand', { spelId, nr, bord: staat.bord, aanZet: staat.aanZet, keten: laatste.keten })
      } else if (event === 'opnieuw') {
        const id = p.spelId ?? spelId + 1
        if (id <= spelId) return
        spelId = id; nr = 0
        staat = Dammen.nieuweSpelStaat()
        laatste.keten = null
        clearTimeout(timer)
      }
    },
    stop() { clearTimeout(timer) },
  }
}

// ─────────────────────────────────────────────
// Schaken. Bord rij 0 = zwart, rij 7 = wit.
// ─────────────────────────────────────────────
const STUKWAARDE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 }
// Klein beetje plaatsgevoel (vanuit wit gezien, rij 0 = overkant).
const MIDDEN = [0, 1, 2, 3, 3, 2, 1, 0]

function schaakWaarde(s) {
  let w = 0
  const b = s.bord
  for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) {
    const x = b[r][k]
    if (!x) continue
    const t = x[1]
    let v = STUKWAARDE[t]
    const vooruit = x[0] === 'w' ? 7 - r : r
    if (t === 'P') v += vooruit * 6 + (k >= 2 && k <= 5 ? MIDDEN[r] * 3 : 0)
    else if (t === 'N' || t === 'B') v += (MIDDEN[r] + MIDDEN[k]) * 5 - (vooruit === 0 ? 10 : 0)
    else if (t === 'Q') v += (MIDDEN[r] + MIDDEN[k]) * 2
    else if (t === 'K') v += vooruit === 0 ? 10 : -vooruit * 8
    w += x[0] === 'w' ? v : -v
  }
  return s.aanZet === 'w' ? w : -w
}

function kopieStaat(s) {
  return { bord: s.bord.map(r => r.slice()), aanZet: s.aanZet, rokade: { ...s.rokade }, enPassantKolom: s.enPassantKolom, halfzetTeller: s.halfzetTeller }
}

export function schaakKies(Schaak, staat, niveau) {
  const zetten = s => {
    const lijst = Schaak.alleLegaleZetten(s, s.aanZet)
    // slagen eerst bekijken: dan snoeit het zoeken beter
    const slag = z => { const d = s.bord[z.naar[0]][z.naar[1]]; return d ? STUKWAARDE[d[1]] * 10 - STUKWAARDE[s.bord[z.van[0]][z.van[1]][1]] / 10 : (z.type === 'enpassant' ? 990 : 0) }
    return lijst.map(z => [slag(z), z]).sort((a, b) => b[0] - a[0]).map(x => x[1])
  }
  const doe = (s, z) => Schaak.voerZetUit(kopieStaat(s), z, 'Q')
  const eind = (s, ply) => Schaak.staatInSchaak(s, s.aanZet) ? -100000 + ply : 0
  const stand = kopieStaat(staat)
  if (niveau === 'makkelijk') return zoek({ stand, zetten, doe, waarde: schaakWaarde, eind, maxDiepte: 1, tijd: 400, ruis: 250 })
  if (niveau === 'normaal') return zoek({ stand, zetten, doe, waarde: schaakWaarde, eind, maxDiepte: 2, tijd: 1200, ruis: 15 })
  return zoek({ stand, zetten, doe, waarde: schaakWaarde, eind, maxDiepte: 4, tijd: 2500 })
}

export function schaakBot({ stuur, niveau, isDicht, motor: Schaak }) {
  const IK = 'z'
  let staat = Schaak.nieuweSpelStaat()
  let ronde = 0
  let timer = null
  const klaar = () => Schaak.alleLegaleZetten(staat, staat.aanZet).length === 0
  function denk() {
    const r0 = ronde
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (isDicht() || r0 !== ronde || staat.aanZet !== IK || klaar()) return
      const zet = schaakKies(Schaak, staat, niveau)
      if (!zet) return
      Schaak.voerZetUit(staat, zet, 'Q')
      stuur('zet', { zet, promotieStuk: 'Q' })
    }, bedenktijd(niveau))
  }
  return {
    ontvang(event, p) {
      if (event === 'zet') {
        if (!p.zet || staat.aanZet === IK) return
        const stuk = staat.bord[p.zet.van[0]] && staat.bord[p.zet.van[0]][p.zet.van[1]]
        if (!stuk || stuk[0] === IK) return
        Schaak.voerZetUit(staat, p.zet, p.promotieStuk)
        if (staat.aanZet === IK && !klaar()) denk()
      } else if (event === 'opnieuw') {
        ronde++
        clearTimeout(timer)
        staat = Schaak.nieuweSpelStaat()
      }
    },
    stop() { clearTimeout(timer) },
  }
}
