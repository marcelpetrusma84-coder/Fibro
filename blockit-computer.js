// blockit-computer.js - de computerspeler van Block It (v1, 2 nov 2026)
//
// In gewone woorden: dit bestand bedenkt waar de computer zijn steen neerlegt. Het probeert elke draaiing en elke
// kolom, rekent uit hoe de bak er daarna uitziet (met dezelfde regels als blockit-ui.js: vallen, vierkanten van 3x3
// of groter, schokgolf, bom, geladen steen) en geeft elke mogelijkheid een cijfer. De beste wint.
// Het tekent niets en praat met niemand: blockit-ui.js doet de rest (bewegen, landen, aanvallen).
//
// Rooster: RIJ rijen van KOL vakjes; null = leeg, 0-3 = een kleur, 9 = zwart blok.
//
// Niveaus:
//   makkelijk: denkt langzaam, kiest vaak een willekeurige plek en gebruikt zijn lading niet
//   normaal:   redelijk vlot, maakt af en toe een foutje
//   moeilijk:  snel en kiest altijd de beste plek

export const ZWART = 9
const BOM_STRAAL = 3

export const PC_NIVEAUS = {
    makkelijk: { denk: 800, stap: 110, val: 45, pauze: 350, fout: 0.35, keus: 15, crush: false },
    normaal:   { denk: 450, stap: 70,  val: 28, pauze: 220, fout: 0.15, keus: 4,  crush: true },
    moeilijk:  { denk: 200, stap: 40,  val: 14, pauze: 110, fout: 0,    keus: 1,  crush: true }
}
export const PC_NIVEAU_NAMEN = ['makkelijk', 'normaal', 'moeilijk']

// Draaien zoals in blockit-ui.js: [x, y] -> [grootte - 1 - y, x]
export function draaiCellen(cellen, grootte) {
    return cellen.map(([x, y]) => [grootte - 1 - y, x])
}

// Alle verschillende draaiingen van een steen (een O of een bom heeft er maar één)
export function draaiingen(cellen, grootte, vorm) {
    const uit = [cellen.map(c => [c[0], c[1]])]
    if (vorm === 'O' || vorm === 'B') return uit
    let huidig = uit[0]
    for (let i = 1; i < 4; i++) {
        huidig = draaiCellen(huidig, grootte)
        uit.push(huidig)
    }
    return uit
}

export function kopie(r) {
    return r.map(rij => rij.slice())
}

function vrij(r, pos) {
    const RIJ = r.length, KOL = r[0].length
    for (const [x, y] of pos) {
        if (x < 0 || x >= KOL || y >= RIJ) return false
        if (y >= 0 && r[y][x] !== null) return false
    }
    return true
}

export function laatVallen(r) {
    const RIJ = r.length, KOL = r[0].length
    for (let x = 0; x < KOL; x++) {
        let schrijf = RIJ - 1
        for (let y = RIJ - 1; y >= 0; y--) {
            if (r[y][x] === null) continue
            if (schrijf !== y) {
                r[schrijf][x] = r[y][x]
                r[y][x] = null
            }
            schrijf--
        }
    }
}

// Het grootste vierkant van één kleur (minstens 3x3), net als grootsteVierkant() in blockit-ui.js
export function grootsteVierkant(r) {
    const RIJ = r.length, KOL = r[0].length
    const dp = Array.from({ length: RIJ }, () => new Array(KOL).fill(0))
    let beste = null
    for (let y = 0; y < RIJ; y++) {
        for (let x = 0; x < KOL; x++) {
            const c = r[y][x]
            if (c === null || c === ZWART) continue
            let n = 1
            if (y > 0 && x > 0 && r[y - 1][x] === c && r[y][x - 1] === c && r[y - 1][x - 1] === c) {
                n = Math.min(dp[y - 1][x], dp[y][x - 1], dp[y - 1][x - 1]) + 1
            }
            dp[y][x] = n
            if (n >= 3 && (!beste || n >= beste.k)) beste = { k: n, x: x - n + 1, y: y - n + 1, kleur: c }
        }
    }
    return beste
}

// Vierkanten weghalen tot er geen meer zijn (met schokgolf en ketting), zoals vierkantenInBak()
export function vierkantenWeg(r) {
    const RIJ = r.length, KOL = r[0].length
    let keten = 0, aanval = 0, punten = 0, lading = 0
    for (let veilig = 0; veilig < 25; veilig++) {
        const v = grootsteVierkant(r)
        if (!v) break
        keten++
        punten += (v.k === 3 ? 1 : (v.k - 3) * 2 + 1) * keten
        aanval += v.k - 2
        lading = Math.max(lading, v.k - 1)
        for (let y = v.y; y < v.y + v.k; y++) for (let x = v.x; x < v.x + v.k; x++) r[y][x] = null
        if (v.k >= 4) {
            const dikte = Math.floor(v.k / 2)
            for (let y = v.y - dikte; y < v.y + v.k + dikte; y++) {
                for (let x = v.x - dikte; x < v.x + v.k + dikte; x++) {
                    if (y >= 0 && y < RIJ && x >= 0 && x < KOL) r[y][x] = null
                }
            }
        }
        laatVallen(r)
    }
    return { punten, aanval, lading }
}

// Een steen laten landen op een kopie van de bak, met dezelfde regels als landInBak() in blockit-ui.js.
// cellen = waar de steen ligt na het vallen (bij crush: waar hij begon te boren).
export function simuleerLanding(r, cellen, k, isCrush, isBom, verdiend) {
    const RIJ = r.length, KOL = r[0].length
    let geplaatst = cellen.map(c => [c[0], c[1]])
    if (isCrush && !verdiend) isCrush = false
    const straal = isBom ? (isCrush ? BOM_STRAAL + verdiend - 1 : BOM_STRAAL) : (isCrush ? verdiend : 0)
    let weg = 0, zwartWeg = 0
    const haalWeg = (x, y) => {
        if (r[y][x] === null) return
        if (r[y][x] === ZWART) zwartWeg++
        r[y][x] = null
        weg++
    }
    if (isCrush) {
        const onderste = new Map()
        for (const [x, y] of geplaatst) onderste.set(x, Math.max(onderste.has(x) ? onderste.get(x) : -99, y))
        for (const [x, yOnder] of onderste) for (let y = Math.max(0, yOnder + 1); y < RIJ; y++) haalWeg(x, y)
        let d = 0
        while (geplaatst.every(([x, y]) => y + d + 1 < RIJ && (y + d + 1 < 0 || r[y + d + 1][x] === null))) d++
        geplaatst = geplaatst.map(([x, y]) => [x, y + d])
    }
    let overloop = false
    if (straal > 0) {
        let [bx, by] = geplaatst[0]
        while (by >= 0 && r[by][bx] !== null) by--
        by = Math.max(0, by)
        for (let y = by - straal; y <= by + straal; y++) {
            for (let x = bx - straal; x <= bx + straal; x++) {
                if ((x - bx) * (x - bx) + (y - by) * (y - by) > straal * straal + straal) continue
                if (y >= 0 && y < RIJ && x >= 0 && x < KOL) haalWeg(x, y)
            }
        }
    } else if (!isCrush) {
        geplaatst.sort((a, b) => b[1] - a[1])
        for (const [x, y0] of geplaatst) {
            let y = y0
            while (y >= 0 && r[y][x] !== null) y--
            if (y < 0) { overloop = true; continue }
            r[y][x] = k
        }
    }
    laatVallen(r)
    const v = overloop ? { punten: 0, aanval: 0, lading: 0 } : vierkantenWeg(r)
    if (r[0].some(c => c !== null)) overloop = true
    return { ...v, overloop, weg, zwartWeg }
}

// Hoe zwaar elk ding weegt bij het beoordelen (uitgeprobeerd met tests/blockit/test-blockit-computer.mjs)
export const GEWICHT = { punten: 40, aanval: 30, lading: 6, paren: 1.3, blok2: 4, blok32: 7, som: 0.8, max: 1.5, hobbel: 0.45, zwart: 2.5, gevaar: 40, rand: 11 }

// Hoe goed is deze bak? Hoger = beter.
export function beoordeel(r, uitkomst) {
    const RIJ = r.length, KOL = r[0].length
    if (uitkomst.overloop) return -1e6
    const hoogte = new Array(KOL).fill(0)
    let zwart = 0, paren = 0, blok2 = 0, blok32 = 0
    for (let x = 0; x < KOL; x++) {
        for (let y = 0; y < RIJ; y++) if (r[y][x] !== null) { hoogte[x] = RIJ - y; break }
    }
    for (let y = 0; y < RIJ; y++) {
        for (let x = 0; x < KOL; x++) {
            const c = r[y][x]
            if (c === null) continue
            if (c === ZWART) { zwart++; continue }
            if (x + 1 < KOL && r[y][x + 1] === c) paren++
            if (y + 1 < RIJ && r[y + 1][x] === c) paren++
            if (x + 1 < KOL && y + 1 < RIJ && r[y][x + 1] === c && r[y + 1][x] === c && r[y + 1][x + 1] === c) {
                blok2++
                // twee 2x2's naast of onder elkaar: bijna een 3x3
                if (x + 2 < KOL && r[y][x + 2] === c && r[y + 1][x + 2] === c) blok32++
                if (y + 2 < RIJ && r[y + 2][x] === c && r[y + 2][x + 1] === c) blok32++
            }
        }
    }
    let som = 0, max = 0, hobbel = 0
    for (let x = 0; x < KOL; x++) {
        som += hoogte[x]
        max = Math.max(max, hoogte[x])
        if (x) hobbel += Math.abs(hoogte[x] - hoogte[x - 1])
    }
    const g = GEWICHT
    const gevaar = Math.max(0, max - (RIJ - g.rand))
    return uitkomst.punten * g.punten + uitkomst.aanval * g.aanval + uitkomst.lading * g.lading
        + paren * g.paren + blok2 * g.blok2 + blok32 * g.blok32
        - som * g.som - max * g.max - hobbel * g.hobbel - zwart * g.zwart
        - gevaar * gevaar * g.gevaar
}

// Alle plekken waar de steen kan landen, met hun cijfer
export function alleZetten(rooster, stuk) {
    const RIJ = rooster.length, KOL = rooster[0].length
    const zetten = []
    const vormen = draaiingen(stuk.cellen, stuk.grootte, stuk.vorm)
    const crushOpties = stuk.crush ? [false, true] : [false]
    vormen.forEach((cellen, draai) => {
        for (let x = -3; x < KOL + 3; x++) {
            const start = cellen.map(([cx, cy]) => [x + cx, cy])
            if (!vrij(rooster, start)) continue
            let d = 0
            while (vrij(rooster, start.map(([px, py]) => [px, py + d + 1]))) d++
            const geland = start.map(([px, py]) => [px, py + d])
            for (const crush of crushOpties) {
                const r = kopie(rooster)
                const uitkomst = simuleerLanding(r, crush ? start : geland, stuk.k, crush, !!stuk.bom, crush ? stuk.crush : 0)
                zetten.push({ draai, x, crush, cijfer: beoordeel(r, uitkomst) + (crush ? uitkomst.zwartWeg * 3 : 0) })
            }
        }
    })
    return zetten
}

// De zet die de computer doet. rnd = een functie die een getal van 0 tot 1 geeft (standaard Math.random).
export function kiesZet(rooster, stuk, niveau, rnd = Math.random) {
    const n = PC_NIVEAUS[niveau] || PC_NIVEAUS.normaal
    const s = n.crush ? stuk : { ...stuk, crush: 0 }
    const zetten = alleZetten(rooster, s)
    if (!zetten.length) return null
    zetten.sort((a, b) => b.cijfer - a.cijfer)
    if (n.fout && rnd() < n.fout) {
        // Een foutje: een willekeurige plek uit de beste 'keus', maar niet een die meteen verliest als het anders kan
        const veilig = zetten.filter(z => z.cijfer > -1e5)
        const lijst = (veilig.length ? veilig : zetten).slice(0, n.keus)
        return lijst[Math.floor(rnd() * lijst.length)]
    }
    return zetten[0]
}
