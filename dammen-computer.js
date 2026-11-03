// dammen-computer.js - de damcomputer van Fibro (v1, 3 nov 2026)
//
// In gewone woorden: de computer probeert zetten vooruit (zoeken met alfa-beta, steeds een stap dieper tot de tijd op
// is) en geeft elke stand een cijfer. Hij gebruikt precies dezelfde spelregels als het spel (dammen.js, de 'motor').
//   - Slagen zijn in dammen verplicht. Moet er aan het eind van het vooruitdenken nog geslagen worden, dan rekent hij
//     door tot de slagen op zijn (anders mist hij dat hij twee schijven verliest).
//   - Een geheugen (tabel) onthoudt standen die hij al eens heeft uitgerekend, zodat hij dieper komt.
// Niveaus: makkelijk (doet vaak iets willekeurigs), normaal, moeilijk, expert (rekent het langst en het diepst).
// Mens = wit, computer = zwart, maar de motor werkt voor allebei (hij speelt voor wie aan zet is).

export const DAM_NIVEAUS = ['makkelijk', 'normaal', 'moeilijk', 'expert']

// Hoe lang (ms) en hoe diep, per niveau. ruis = een beetje toeval zodat het niet elke keer hetzelfde gaat.
export const DAM_INSTELLING = {
    makkelijk: { tijd: 250, diepte: 1, ruis: 70, gok: 0.4 },
    normaal: { tijd: 500, diepte: 3, ruis: 12, gok: 0 },
    moeilijk: { tijd: 1200, diepte: 7, ruis: 0, gok: 0 },
    expert: { tijd: 3000, diepte: 24, ruis: 0, gok: 0 }
}

const WINST = 100000
class TijdOp extends Error {}

// ── Waardering (vanuit wit), daarna gedraaid voor wie aan zet is ──
export function waardeer(stand) {
    const b = stand.bord
    let w = 0, stukken = 0
    for (let r = 0; r < 10; r++) {
        for (let k = (r + 1) % 2; k < 10; k += 2) {
            const x = b[r][k]
            if (x) stukken++
        }
    }
    const vroeg = stukken > 24
    for (let r = 0; r < 10; r++) {
        for (let k = (r + 1) % 2; k < 10; k += 2) {
            const x = b[r][k]
            if (!x) continue
            const wit = x[0] === 'w'
            let v
            if (x[1] === 'D') {
                v = 320
                if (k >= 2 && k <= 7 && r >= 2 && r <= 7) v += 8           // een dam in het midden is sterker
            } else {
                const vooruit = wit ? 9 - r : r                              // 0..9
                v = 100 + vooruit * 3
                if (vooruit >= 7) v += (vooruit - 6) * 12                   // bijna dam
                if (k >= 3 && k <= 6) v += 5                                 // midden
                else if (k === 0 || k === 9) v -= 3                          // rand: minder vrij
                if (vroeg && vooruit === 0) v += 7                           // achterste rij bewaken (in het begin)
                // gesteund van achteren: een eigen stuk schuin achter je
                const achter = wit ? r + 1 : r - 1
                if (achter >= 0 && achter < 10) {
                    const l = k > 0 ? b[achter][k - 1] : null, rr = k < 9 ? b[achter][k + 1] : null
                    if ((l && l[0] === x[0]) || (rr && rr[0] === x[0])) v += 3
                }
            }
            w += wit ? v : -v
        }
    }
    return stand.aanZet === 'w' ? w : -w
}

function sleutel(stand) {
    let s = stand.aanZet
    const b = stand.bord
    for (let r = 0; r < 10; r++) for (let k = (r + 1) % 2; k < 10; k += 2) s += b[r][k] ? b[r][k] : '.'
    return s
}

// De zet die de computer doet. opties: { tijdFactor } om in tests sneller te rekenen.
export function damKies(Dammen, staat, niveau, opties = {}) {
    const inst = DAM_INSTELLING[niveau] || DAM_INSTELLING.normaal
    const rnd = opties.rnd || Math.random
    const zetten = s => Dammen.alleZetten(s, s.aanZet)
    const doe = (s, keten) => Dammen.voerKetenUit({ bord: s.bord, aanZet: s.aanZet }, keten)
    const wortel = { bord: staat.bord, aanZet: staat.aanZet }
    const lijst = zetten(wortel).ketens
    if (!lijst.length) return null
    if (lijst.length === 1) return lijst[0]
    if (inst.gok && rnd() < inst.gok) return lijst[Math.floor(rnd() * lijst.length)]

    const stopOm = Date.now() + inst.tijd * (opties.tijdFactor || 1)
    const tabel = new Map()
    let knopen = 0

    function rust(s, alfa, beta, ply, qd) {
        // Aan het eind van het vooruitdenken: zijn er slagen, dan die nog uitrekenen (ze zijn verplicht)
        const { ketens, verplichtSlaan } = zetten(s)
        if (!ketens.length) return -WINST + ply
        if (!verplichtSlaan || qd <= 0) return waardeer(s)
        let beste = -Infinity
        for (const z of ketens) {
            const v = -rust(doe(s, z), -beta, -alfa, ply + 1, qd - 1)
            if (v > beste) beste = v
            if (v > alfa) alfa = v
            if (alfa >= beta) break
        }
        return beste
    }

    function zoek(s, diepte, alfa, beta, ply) {
        if ((++knopen & 255) === 0 && Date.now() > stopOm) throw new TijdOp()
        if (diepte <= 0) return rust(s, alfa, beta, ply, 10)
        const sl = sleutel(s)
        const bekend = tabel.get(sl)
        if (bekend && bekend.d >= diepte) {
            if (bekend.f === 0) return bekend.v
            if (bekend.f === 1 && bekend.v >= beta) return bekend.v
            if (bekend.f === -1 && bekend.v <= alfa) return bekend.v
        }
        const { ketens } = zetten(s)
        if (!ketens.length) return -WINST + ply
        // de beste zet van een eerdere keer eerst
        if (bekend && bekend.z > 0 && bekend.z < ketens.length) { const z = ketens[bekend.z]; ketens.splice(bekend.z, 1); ketens.unshift(z) }
        const alfa0 = alfa
        let beste = -Infinity, besteI = 0
        for (let i = 0; i < ketens.length; i++) {
            const v = -zoek(doe(s, ketens[i]), diepte - 1, -beta, -alfa, ply + 1)
            if (v > beste) { beste = v; besteI = i }
            if (v > alfa) alfa = v
            if (alfa >= beta) break
        }
        const f = beste <= alfa0 ? -1 : beste >= beta ? 1 : 0
        if (tabel.size > 400000) tabel.clear()
        tabel.set(sl, { d: diepte, v: beste, f, z: besteI })
        return beste
    }

    let volgorde = lijst.slice()
    let gekozen = volgorde[0]
    for (let d = 1; d <= inst.diepte; d++) {
        try {
            const scores = []
            let alfa = -Infinity
            for (const z of volgorde) {
                let v
                if (inst.ruis) v = -zoek(doe(wortel, z), d - 1, -Infinity, Infinity, 1) + rnd() * inst.ruis
                else v = -zoek(doe(wortel, z), d - 1, -Infinity, -alfa, 1)
                scores.push([v, z])
                if (v > alfa) alfa = v
            }
            scores.sort((a, b) => b[0] - a[0])
            volgorde = scores.map(x => x[1])
            gekozen = volgorde[0]
            if (Math.abs(scores[0][0]) > WINST / 2) break      // winst of verlies gevonden: niet verder rekenen
        } catch (e) {
            if (e instanceof TijdOp) break
            throw e
        }
    }
    return gekozen
}
