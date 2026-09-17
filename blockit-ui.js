// blockit-ui.js - Block It voor Fibro, multiplayer via het spelkanaal.
// Spelvormen: gedeelde bak (gemengde of eigen kleuren) en twee velden.
// Gedeelde bak: de host beheert de bak, de wachtrij en de punten.
// Twee velden: ieder beheert zijn eigen bak; vierkanten sturen rijen naar je vriend.
// Een vierkant laadt je volgende steen met Crush; een vierkant van 4x4 of groter maakt hem een bom.
// Crush: je steen boort door alles heen en verdwijnt daarna zelf ook.

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
    vriendNaam = vriendNaam || 'vriend'
    isActief = isActief || (() => true)
    document.getElementById('spelTitelBar').textContent = '🟪 Block It'
    const inhoud = document.getElementById('spelInhoud')
    const benIkHost = benIkSpeler1
    const IK = benIkHost ? 0 : 1
    const ANDER = 1 - IK

    // ── Instellingen ──
    const KOL_SAMEN = 20, KOL_VERSUS = 10, RIJ = 20
    const LOCK_MS = 380
    const BOM_STRAAL = 1              // 1 = gat van 3x3
    const HUD_H = 66
    const CRUSH_KLEUR = '#ffe066'
    const BOM_KLEUR = '#ff9f1c'
    const KLEUREN = [
        { basis: '#ff4d6d', licht: '#ff9aae', donker: '#9d1537' },
        { basis: '#ffb627', licht: '#ffd98a', donker: '#a86a0c' },
        { basis: '#2ee6a6', licht: '#98f6d4', donker: '#0b8560' },
        { basis: '#4d9dff', licht: '#a5ccff', donker: '#1c49b8' }
    ]
    const EIGEN_KLEUREN = [[0, 1], [2, 3]]   // speler 1: koraal en amber, speler 2: mint en blauw
    const VORMEN = {
        I: [[0, 1], [1, 1], [2, 1], [3, 1]],
        O: [[1, 0], [2, 0], [1, 1], [2, 1]],
        T: [[0, 1], [1, 1], [2, 1], [1, 0]],
        L: [[0, 1], [1, 1], [2, 1], [2, 0]],
        J: [[0, 1], [1, 1], [2, 1], [0, 0]],
        S: [[1, 0], [2, 0], [0, 1], [1, 1]],
        Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
        B: [[0, 0]]
    }
    const VORM_NAMEN = ['I', 'O', 'T', 'L', 'J', 'S', 'Z']
    const MIJN_KLEUR = '#c6b8ff', VRIEND_KLEUR = '#ffc9a3'
    const SPELER_KLEUR = [IK === 0 ? MIJN_KLEUR : VRIEND_KLEUR, IK === 0 ? VRIEND_KLEUR : MIJN_KLEUR]
    const FONT = "'Chakra Petch', 'Segoe UI', system-ui, sans-serif"
    const KNOP_STIJL = 'background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 18px;color:#1a0a2e;font-weight:700;cursor:pointer;text-align:left;'
    const nu = () => performance.now()

    inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;">
    <div id="bi-status" style="color:white;font-size:13px;font-weight:600;min-height:18px;text-align:center;"></div>
    <div id="bi-keuze" style="display:none;flex-direction:column;gap:8px;width:min(340px,100%);"></div>
    <canvas id="bi-canvas" style="display:block;touch-action:none;border-radius:12px;"></canvas>
    <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;">
    <button id="bi-geluid" style="background:rgba(255,255,255,0.12);border:none;border-radius:8px;color:white;padding:4px 12px;font-size:16px;cursor:pointer;">🔊</button>
    <div style="color:rgba(255,255,255,0.45);font-size:11px;text-align:center;">Veeg om te schuiven, tik om te draaien, veeg snel omlaag om te laten vallen</div>
    </div>
    </div>`

    const canvas = document.getElementById('bi-canvas')
    const ctx = canvas.getContext('2d')
    const statusEl = document.getElementById('bi-status')
    const keuzeEl = document.getElementById('bi-keuze')
    const geluidKnop = document.getElementById('bi-geluid')

    // ── Geluid ──
    const geluid = maakGeluid()
    geluidKnop.textContent = geluid.aan ? '🔊' : '🔇'
    geluidKnop.onclick = (e) => {
        e.stopPropagation()
        geluidKnop.textContent = geluid.wissel() ? '🔊' : '🔇'
    }

    // ── Spelstaat ──
    // Index 0 = host (speler 1), index 1 = gast (speler 2)
    let modus = null                  // null (kiezen) | 'samen' | 'eigen' | 'versus'
    let KOL = KOL_SAMEN
    let rooster, pop, wachtrij, scores
    let lading, ladingStuk, bom, bomStuk
    let vriendRooster = null          // twee velden: de bak van je vriend, alleen om te tekenen
    let mijnStuk, vriendStuk, wachtOpSteen, vraagNr, vraagTijd, wachtendeData
    let spawnWacht, valTimer, lockTimer, bezig, gameOver, starttijd
    let schud = 0, stoot = 0, flits = null, deeltjes = [], teksten = [], ringen = []
    let laatsteStukSync = 0, laatste = 0, animFrame = null, aftelInterval = null, pingInterval = null
    let gastAntwoorden = new Map()
    let vriendAanwezig = false
    let cel = 16, celV = 10, B = 300, H = 400, gx = 6, gy = HUD_H + 6, vgx = 0, vgy = 0

    function leegRooster(kol) {
        return Array.from({ length: RIJ }, () => new Array(kol).fill(null))
    }

    function resetStaat(nieuweModus) {
        modus = nieuweModus
        KOL = modus === 'versus' ? KOL_VERSUS : KOL_SAMEN
        rooster = leegRooster(KOL)
        pop = Array.from({ length: RIJ }, () => new Array(KOL).fill(0))
        wachtrij = benIkHost || modus === 'versus' ? [nieuwStukData(), nieuwStukData(), nieuwStukData()] : []
        vriendRooster = modus === 'versus' ? leegRooster(KOL) : null
        scores = [0, 0]
        lading = [false, false]
        ladingStuk = [false, false]
        bom = [false, false]
        bomStuk = [false, false]
        mijnStuk = null
        vriendStuk = null
        wachtOpSteen = false
        vraagNr = 0
        vraagTijd = 0
        wachtendeData = null
        spawnWacht = 300
        valTimer = 0
        lockTimer = 0
        bezig = false
        gameOver = false
        starttijd = nu()
        stoot = 0
        gastAntwoorden = new Map()
        deeltjes = []
        teksten = []
        ringen = []
        flits = null
    }
    resetStaat(null)

    // In twee velden ben je zelf de baas over je bak; in de gedeelde bak is de host de baas
    function isBaas() {
        return modus === 'versus' || benIkHost
    }

    function nieuwStukData() {
        return {
            vorm: VORM_NAMEN[Math.floor(Math.random() * VORM_NAMEN.length)],
            k: Math.floor(Math.random() * KLEUREN.length),
            keuze: Math.floor(Math.random() * 2)
        }
    }

    function kleurVoor(data, speler) {
        return modus === 'eigen' ? EIGEN_KLEUREN[speler][data.keuze] : data.k
    }

    // ── Stenen en rooster ──
    function grootteVan(vorm) {
        return vorm === 'I' || vorm === 'O' ? 4 : vorm === 'B' ? 1 : 3
    }

    function draai(cellen, grootte) {
        return cellen.map(([x, y]) => [grootte - 1 - y, x])
    }

    function maakStuk(data, x) {
        return {
            vorm: data.vorm, k: data.k, crush: !!data.crush, bom: !!data.bom,
            cellen: VORMEN[data.vorm].map(c => [c[0], c[1]]), x, y: 0
        }
    }

    function absoluut(stuk, dx = 0, dy = 0) {
        return stuk.cellen.map(([cx, cy]) => [stuk.x + cx + dx, stuk.y + cy + dy])
    }

    function vrijInRooster(pos) {
        for (const [x, y] of pos) {
            if (x < 0 || x >= KOL || y >= RIJ) return false
                if (y >= 0 && rooster[y][x] !== null) return false
        }
        return true
    }

    function vrijVanVriend(pos) {
        if (modus === 'versus' || !vriendStuk || !vriendStuk.cellen) return true
            const bezet = new Set(vriendStuk.cellen.map(([x, y]) => x + ',' + y))
            return pos.every(([x, y]) => !bezet.has(x + ',' + y))
    }

    function past(pos) {
        return vrijInRooster(pos) && vrijVanVriend(pos)
    }

    function naZwaartekracht(pos) {
        const perKolom = new Map()
        for (const [x, y] of pos) {
            if (!perKolom.has(x)) perKolom.set(x, [])
                perKolom.get(x).push(y)
        }
        const uit = []
        for (const [x, ys] of perKolom) {
            let y = Math.max(...ys)
            while (y + 1 < RIJ && (y + 1 < 0 || rooster[y + 1][x] === null)) y++
                for (let i = 0; i < ys.length; i++) uit.push([x, y - i])
        }
        return uit
    }

    function laatVallen() {
        for (let x = 0; x < KOL; x++) {
            let schrijf = RIJ - 1
            for (let y = RIJ - 1; y >= 0; y--) {
                if (rooster[y][x] === null) continue
                    if (schrijf !== y) {
                        rooster[schrijf][x] = rooster[y][x]
                        rooster[y][x] = null
                    }
                    schrijf--
            }
        }
    }

    function grootsteVierkant() {
        const dp = Array.from({ length: RIJ }, () => new Array(KOL).fill(0))
        let beste = null
        for (let y = 0; y < RIJ; y++) {
            for (let x = 0; x < KOL; x++) {
                const c = rooster[y][x]
                if (c === null) continue
                    let n = 1
                    if (y > 0 && x > 0 && rooster[y - 1][x] === c && rooster[y][x - 1] === c && rooster[y - 1][x - 1] === c) {
                        n = Math.min(dp[y - 1][x], dp[y][x - 1], dp[y - 1][x - 1]) + 1
                    }
                    dp[y][x] = n
                    if (n >= 3 && (!beste || n >= beste.k)) beste = { k: n, x: x - n + 1, y: y - n + 1, kleur: c }
            }
        }
        return beste
    }

    function naarTekst(r) {
        let t = ''
        for (let y = 0; y < RIJ; y++) for (let x = 0; x < KOL; x++) t += r[y][x] === null ? '.' : r[y][x]
            return t
    }

    function uitTekst(t, r) {
        for (let y = 0; y < RIJ; y++) {
            for (let x = 0; x < KOL; x++) {
                const ch = t[y * KOL + x]
                r[y][x] = ch === '.' || ch === undefined ? null : Number(ch)
            }
        }
    }

    // ── De baas over de bak ──
    function geefSteen(speler) {
        const crush = lading[speler]
        lading[speler] = false
        ladingStuk[speler] = crush
        // Beloning na een 4x4 of groter: deze steen is een bom (de wachtrij schuift niet door)
        if (bom[speler]) {
            bom[speler] = false
            bomStuk[speler] = true
            return { vorm: 'B', k: 0, crush, bom: true }
        }
        bomStuk[speler] = false
        const data = wachtrij.shift()
        wachtrij.push(nieuwStukData())
        return { vorm: data.vorm, k: kleurVoor(data, speler), crush, bom: false }
    }

    function landInBak(speler, cellen, k, isCrush, isBom) {
        const effecten = []
        let geplaatst = cellen.map(c => [c[0], c[1]])

        // Alleen een geladen steen mag crushen, alleen een echte bom mag ontploffen
        if (isCrush && !ladingStuk[speler]) isCrush = false
            if (isBom && !bomStuk[speler]) isBom = false
                ladingStuk[speler] = false
                bomStuk[speler] = false

                if (isCrush) {
                    const onderste = new Map()
                    for (const [x, y] of geplaatst) onderste.set(x, Math.max(onderste.has(x) ? onderste.get(x) : -99, y))
                        let geplet = 0
                        for (const [x, yOnder] of onderste) {
                            for (let y = Math.max(0, yOnder + 1); y < RIJ; y++) {
                                if (rooster[y][x] !== null) {
                                    rooster[y][x] = null
                                    geplet++
                                }
                            }
                        }
                        const van = geplaatst
                        let d = 0
                        while (geplaatst.every(([x, y]) => y + d + 1 < RIJ && (y + d + 1 < 0 || rooster[y + d + 1][x] === null))) d++
                            geplaatst = geplaatst.map(([x, y]) => [x, y + d])
                            effecten.push({ t: 'crush', speler, geplet, van, naar: geplaatst })
                }

                let overloop = false
                if (isBom) {
                    let [bx, by] = geplaatst[0]
                    while (by >= 0 && rooster[by][bx] !== null) by--
                        by = Math.max(0, by)
                        let geplet = 0
                        for (let y = by - BOM_STRAAL; y <= by + BOM_STRAAL; y++) {
                            for (let x = bx - BOM_STRAAL; x <= bx + BOM_STRAAL; x++) {
                                if (y >= 0 && y < RIJ && x >= 0 && x < KOL && rooster[y][x] !== null) {
                                    rooster[y][x] = null
                                    geplet++
                                }
                            }
                        }
                        effecten.push({ t: 'bom', speler, x: bx, y: by, geplet })
                } else if (!isCrush) {
                    // Is een plek intussen bezet (de ander landde net eerder)? Dan schuift het blokje omhoog.
                    const landing = []
                    geplaatst.sort((a, b) => b[1] - a[1])
                    for (const [x, y0] of geplaatst) {
                        let y = y0
                        while (y >= 0 && rooster[y][x] !== null) y--
                            if (y < 0) {
                                overloop = true
                                continue
                            }
                            rooster[y][x] = k
                            landing.push([x, y])
                    }
                    effecten.push({ t: 'land', speler, cellen: landing })
                }
                laatVallen()
                const aanval = overloop ? 0 : vierkantenInBak(speler, effecten)
                // Raakt een blok de bovenkant van het speelveld? Dan is het spel voorbij.
                if (rooster[0].some(c => c !== null)) overloop = true
                    return { effecten, overloop, aanval }
    }

    function vierkantenInBak(speler, effecten) {
        let keten = 0
        let aanval = 0
        for (let veilig = 0; veilig < 25; veilig++) {
            const v = grootsteVierkant()
            if (!v) break
                keten++
                const punten = (v.k === 3 ? 1 : (v.k - 3) * 2 + 1) * keten
                scores[speler] += punten
                aanval += v.k - 2
                for (let y = v.y; y < v.y + v.k; y++) for (let x = v.x; x < v.x + v.k; x++) rooster[y][x] = null

                    let dikte = 0
                    if (v.k >= 4) {
                        dikte = Math.floor(v.k / 2)
                        for (let y = v.y - dikte; y < v.y + v.k + dikte; y++) {
                            for (let x = v.x - dikte; x < v.x + v.k + dikte; x++) {
                                if (y >= 0 && y < RIJ && x >= 0 && x < KOL) rooster[y][x] = null
                            }
                        }
                    }

                    let beloning = null
                    if (v.k >= 4 && !bom[speler]) {
                        bom[speler] = true
                        beloning = 'bom'
                    }
                    if (!lading[speler]) {
                        lading[speler] = true
                        if (!beloning) beloning = 'crush'
                    }
                    effecten.push({ t: 'vierkant', speler, x: v.x, y: v.y, k: v.k, kleur: v.kleur, keten, punten, dikte, beloning })
                    laatVallen()
        }
        return aanval
    }

    function hostStuurStaat(effecten) {
        spelKanaal.send({
            type: 'broadcast', event: 'bi-staat', payload: {
                rooster: naarTekst(rooster), wachtrij, scores, lading, bom, effecten
            }
        })
    }

    function stuurVeld() {
        spelKanaal.send({
            type: 'broadcast', event: 'bi-veld', payload: {
                rooster: naarTekst(rooster), score: scores[IK], lading: lading[IK], bom: bom[IK]
            }
        })
    }

    function hostEinde() {
        if (gameOver) return
            spelKanaal.send({ type: 'broadcast', event: 'bi-einde', payload: { scores } })
            toonEinde(null)
    }

    function verloren() {
        if (gameOver) return
            spelKanaal.send({ type: 'broadcast', event: 'bi-verloren', payload: { scores: scores[IK] } })
            toonEinde(true)
    }

    // Twee velden: je vriend stuurt rijen
    function krijgRijen(n) {
        if (modus !== 'versus' || gameOver || !bezig) return
            let overloop = false
            for (let i = 0; i < n; i++) {
                if (rooster[0].some(c => c !== null)) overloop = true
                    rooster.shift()
                    pop.shift()
                    const gat = Math.floor(Math.random() * KOL)
                    rooster.push(Array.from({ length: KOL }, (_, x) => (x === gat ? null : Math.floor(Math.random() * KLEUREN.length))))
                    pop.push(new Array(KOL).fill(0.8))
            }
            if (mijnStuk) {
                let m = 0
                while (!vrijInRooster(absoluut(mijnStuk)) && m++ < RIJ) mijnStuk.y--
            }
            schok(0.7)
            stoot = Math.max(stoot, 0.6)
            geluid.rommel()
            if (rooster[0].some(c => c !== null)) overloop = true
                zweef(KOL / 2, RIJ - 3, '+' + n + (n === 1 ? ' RIJ!' : ' RIJEN!'), '#ff4d6d', 1.1)
                stuurVeld()
                if (overloop) verloren()
    }

    // ── Eigen steen ──
    function vraagSteen() {
        if (mijnStuk || wachtOpSteen || gameOver) return
            wachtOpSteen = true
            if (isBaas()) {
                const data = geefSteen(IK)
                if (modus === 'versus') stuurVeld()
                    else hostStuurStaat([])
                        ontvangSteen(data)
            } else {
                vraagNr++
                vraagTijd = nu()
                spelKanaal.send({ type: 'broadcast', event: 'bi-vraag', payload: { n: vraagNr } })
            }
    }

    function ontvangSteen(data) {
        wachtOpSteen = false
        if (gameOver) return
            const voorkeur = modus === 'versus' ? Math.round(KOL / 2) - 2
            : IK === 0 ? Math.round(KOL * 0.25) - 2 : Math.round(KOL * 0.75) - 2
            const volgorde = [voorkeur]
            for (let d = 1; d < KOL; d++) volgorde.push(voorkeur - d, voorkeur + d)
                let doorVriend = false
                for (const x of volgorde) {
                    const stuk = maakStuk(data, x)
                    const pos = absoluut(stuk)
                    if (!vrijInRooster(pos)) continue
                        if (!vrijVanVriend(pos)) {
                            doorVriend = true
                            continue
                        }
                        mijnStuk = stuk
                        valTimer = 0
                        lockTimer = 0
                        if (stuk.bom) {
                            geluid.crushKlaar()
                            meld('💣 Bom! Laat hem vallen, of veeg snel omlaag om eerst door de blokken te boren')
                        } else if (stuk.crush) {
                            geluid.crushKlaar()
                            meld('⚡ Crush! Veeg snel omlaag om door de blokken te boren')
                        }
                        stuurStuk()
                        return
                }
                if (doorVriend) {
                    wachtendeData = data
                    spawnWacht = 200
                    return
                }
                // Er past nergens meer een steen
                if (modus === 'versus') verloren()
                    else if (benIkHost) hostEinde()
                        else spelKanaal.send({ type: 'broadcast', event: 'bi-vol', payload: {} })
    }

    function meld(tekst) {
        statusEl.textContent = tekst
        setTimeout(() => {
            if (statusEl.textContent === tekst) statusEl.textContent = ''
        }, 2600)
    }

    function stuurStuk() {
        laatsteStukSync = nu()
        spelKanaal.send({
            type: 'broadcast', event: 'bi-stuk',
            payload: mijnStuk ? { cellen: absoluut(mijnStuk), k: mijnStuk.k, crush: mijnStuk.crush, bom: mijnStuk.bom } : { cellen: null }
        })
    }

    function landLokaal(isCrush) {
        const cellen = absoluut(mijnStuk)
        const k = mijnStuk.k
        const isBom = mijnStuk.bom
        mijnStuk = null
        spawnWacht = 140
        stuurStuk()
        if (isBaas()) {
            const r = landInBak(IK, cellen, k, isCrush, isBom)
            speelEffecten(r.effecten)
            if (modus === 'versus') {
                if (r.aanval > 0) {
                    spelKanaal.send({ type: 'broadcast', event: 'bi-aanval', payload: { rijen: r.aanval } })
                    zweef(KOL / 2, 3, 'AANVAL! ' + r.aanval + (r.aanval === 1 ? ' rij' : ' rijen'), VRIEND_KLEUR, 0.9)
                    geluid.aanval()
                }
                stuurVeld()
                if (r.overloop) verloren()
            } else {
                hostStuurStaat(r.effecten)
                if (r.overloop) hostEinde()
            }
        } else {
            // Alvast tonen tot de host antwoordt (niet bij Crush of een bom)
            if (!isCrush && !isBom) for (const [x, y] of cellen) if (y >= 0 && rooster[y][x] === null) rooster[y][x] = k
                spelKanaal.send({ type: 'broadcast', event: 'bi-land', payload: { cellen, k, crush: isCrush, bom: isBom } })
        }
    }

    function beweeg(dx, dy) {
        if (!mijnStuk || !bezig) return false
            if (!past(absoluut(mijnStuk, dx, dy))) return false
                mijnStuk.x += dx
                mijnStuk.y += dy
                if (dx) {
                    geluid.schuif()
                    lockTimer = Math.min(lockTimer, LOCK_MS * 0.5)
                }
                if (dy) valTimer = 0
                    return true
    }

    function draaiStuk() {
        const s = mijnStuk
        if (!s || !bezig || s.vorm === 'O' || s.vorm === 'B') return
            const nieuw = draai(s.cellen, grootteVan(s.vorm))
            for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
                const pos = nieuw.map(([cx, cy]) => [s.x + cx + kx, s.y + cy + ky])
                if (past(pos)) {
                    s.cellen = nieuw
                    s.x += kx
                    s.y += ky
                    lockTimer = Math.min(lockTimer, LOCK_MS * 0.5)
                    geluid.draai()
                    return
                }
            }
    }

    function hardeVal() {
        if (!mijnStuk || !bezig) return
            let d = 0
            while (past(absoluut(mijnStuk, 0, d + 1))) d++
                mijnStuk.y += d
                if (d > 2) schok(Math.min(0.2 + d * 0.035, 0.6))
                    geluid.land(Math.min(1, 0.2 + d / 14))
                    landLokaal(false)
    }

    function crushOfVal() {
        if (!mijnStuk || !bezig) return
            if (mijnStuk.crush) {
                // Meteen voelbaar, ook voordat de host antwoordt
                schok(1)
                stoot = 1
                landLokaal(true)
            } else {
                hardeVal()
            }
    }

    // ── Effecten ──
    function schok(kracht) {
        schud = Math.min(1, schud + kracht)
    }

    function spat(x, y, kleur, kracht) {
        for (let i = 0; i < 5; i++) {
            const hoek = Math.random() * Math.PI * 2
            const snel = (2 + Math.random() * 6) * kracht
            deeltjes.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(hoek) * snel, vy: Math.sin(hoek) * snel - 3, leven: 1, kleur, grootte: 0.18 + Math.random() * 0.22 })
        }
    }

    function zweef(x, y, tekst, kleur, schaal) {
        teksten.push({ x, y, tekst, kleur, schaal, leven: 1 })
    }

    function midden(pos) {
        let sx = 0, sy = 0
        for (const [x, y] of pos) {
            sx += x + 0.5
            sy += y + 0.5
        }
        return { x: sx / Math.max(1, pos.length), y: sy / Math.max(1, pos.length) }
    }

    function speelEffecten(effecten) {
        for (const e of effecten) {
            const spelerKleur = SPELER_KLEUR[e.speler]
            if (e.t === 'land') {
                for (const [x, y] of e.cellen) if (y >= 0 && y < RIJ) pop[y][x] = 1
            } else if (e.t === 'crush') {
                const m = midden(e.naar)
                for (const [x, y] of e.van) {
                    for (let yy = Math.max(0, y); yy < m.y + 1; yy += 0.6) {
                        deeltjes.push({ x: x + Math.random(), y: yy, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, leven: 0.7, kleur: CRUSH_KLEUR, grootte: 0.14 })
                    }
                }
                zweef(m.x, m.y - 1.5, e.geplet ? 'CRUSH! ' + e.geplet + ' weg' : 'CRUSH!', spelerKleur, 1.15)
                ringen.push({ x: m.x, y: m.y, max: 6, kleur: '#ffffff', leven: 1 })
                schok(1)
                stoot = 1
                flits = { kleur: CRUSH_KLEUR, a: 0.3 }
                geluid.crush()
            } else if (e.t === 'bom') {
                const cx = e.x + 0.5, cy = e.y + 0.5
                for (let i = 0; i < 40; i++) {
                    const hoek = Math.random() * Math.PI * 2
                    const snel = 4 + Math.random() * 14
                    deeltjes.push({ x: cx, y: cy, vx: Math.cos(hoek) * snel, vy: Math.sin(hoek) * snel - 4, leven: 1, kleur: Math.random() < 0.5 ? BOM_KLEUR : '#ffd23f', grootte: 0.2 + Math.random() * 0.3 })
                }
                ringen.push({ x: cx, y: cy, max: BOM_STRAAL * 2 + 4, kleur: BOM_KLEUR, leven: 1 })
                ringen.push({ x: cx, y: cy, max: BOM_STRAAL * 2 + 1.5, kleur: '#ffffff', leven: 1 })
                zweef(cx, cy - 1.2, 'BOEM!' + (e.geplet ? ' ' + e.geplet + ' weg' : ''), BOM_KLEUR, 1.5)
                flits = { kleur: BOM_KLEUR, a: 0.45 }
                schok(1)
                stoot = 1
                geluid.bom()
            } else if (e.t === 'vierkant') {
                const kleur = KLEUREN[e.kleur]
                const cx = e.x + e.k / 2, cy = e.y + e.k / 2
                for (let y = e.y; y < e.y + e.k; y++) for (let x = e.x; x < e.x + e.k; x++) spat(x, y, kleur.licht, 1)
                    flits = { kleur: kleur.basis, a: e.k >= 4 ? 0.42 : 0.22 }
                    ringen.push({ x: cx, y: cy, max: e.k * 0.9, kleur: kleur.basis, leven: 1 })
                    zweef(cx, cy, '+' + e.punten + (e.punten === 1 ? ' PUNT!' : ' PUNTEN!'), kleur.basis, e.k >= 4 ? 1.35 : 1)
                    if (modus !== 'versus') zweef(cx, cy + 1.3, e.speler === IK ? 'Jij' : vriendNaam, spelerKleur, 0.7)
                        if (e.keten > 1) zweef(cx, cy + 2.5, 'KETTING x' + e.keten, '#ffffff', 0.85)
                            geluid.vierkant(e.kleur, e.keten)
                            if (e.dikte > 0) {
                                for (let i = 0; i < 24; i++) spat(e.x - e.dikte + Math.random() * (e.k + e.dikte * 2), e.y - e.dikte + Math.random() * (e.k + e.dikte * 2), '#ffffff', 2)
                                    ringen.push({ x: cx, y: cy, max: e.k + e.dikte * 2 + 1, kleur: '#ffffff', leven: 1 })
                                    zweef(cx, cy - 1.6, 'SCHOKGOLF!', '#ffffff', 1.5)
                                    geluid.schokgolf(e.k)
                                    schok(1)
                            } else {
                                ringen.push({ x: cx, y: cy, max: e.k + 1.5, kleur: 'rgba(255,255,255,0.7)', leven: 1 })
                                schok(0.35)
                            }
                            if (e.beloning === 'bom') {
                                zweef(cx, cy + 3.6, 'VOLGENDE STEEN: BOM!', BOM_KLEUR, 0.85)
                                if (e.speler === IK) geluid.ontgrendeld()
                            } else if (e.beloning === 'crush') {
                                zweef(cx, cy + 3.6, 'VOLGENDE STEEN: CRUSH!', CRUSH_KLEUR, 0.8)
                                if (e.speler === IK) geluid.ontgrendeld()
                            }
            }
        }
    }

    // ── Spellus ──
    function update(dt) {
        const interval = Math.max(170, 760 - ((nu() - starttijd) / 1000) * 5)

        if (!mijnStuk) {
            if (wachtendeData) {
                spawnWacht -= dt
                if (spawnWacht <= 0) {
                    const data = wachtendeData
                    wachtendeData = null
                    ontvangSteen(data)
                }
            } else if (wachtOpSteen) {
                // Geen antwoord van de host? Opnieuw vragen.
                if (!isBaas() && nu() - vraagTijd > 1500) {
                    vraagTijd = nu()
                    spelKanaal.send({ type: 'broadcast', event: 'bi-vraag', payload: { n: vraagNr } })
                }
            } else {
                spawnWacht -= dt
                if (spawnWacht <= 0) vraagSteen()
            }
        } else if (!past(absoluut(mijnStuk, 0, 1))) {
            lockTimer += dt
            if (lockTimer >= LOCK_MS) {
                // Ligt hij alleen op de steen van je vriend? Dan nog even wachten.
                if (vrijInRooster(absoluut(mijnStuk, 0, 1))) lockTimer = LOCK_MS * 0.6
                    else {
                        geluid.land(0.15)
                        landLokaal(false)
                    }
            }
        } else {
            lockTimer = 0
            valTimer += dt
            if (valTimer >= interval) {
                valTimer = 0
                mijnStuk.y++
            }
        }

        if (nu() - laatsteStukSync > 100) stuurStuk()
    }

    function updateEffecten(dt) {
        const s = dt / 1000
        if (mijnStuk && (mijnStuk.crush || mijnStuk.bom) && Math.random() < dt / 60) {
            const cellen = absoluut(mijnStuk)
            const [x, y] = cellen[Math.floor(Math.random() * cellen.length)]
            deeltjes.push({ x: x + Math.random(), y: y + Math.random(), vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 3, leven: 0.6, kleur: mijnStuk.bom ? BOM_KLEUR : CRUSH_KLEUR, grootte: 0.12 })
        }
        schud = Math.max(0, schud - s * 1.8)
        stoot = Math.max(0, stoot - s * 2.2)
        if (flits) {
            flits.a -= s * 2.2
            if (flits.a <= 0) flits = null
        }
        for (let y = 0; y < RIJ; y++) for (let x = 0; x < KOL; x++) if (pop[y][x] > 0) pop[y][x] = Math.max(0, pop[y][x] - s * 5)
            for (const d of deeltjes) {
                d.vy += 18 * s
                d.x += d.vx * s
                d.y += d.vy * s
                d.leven -= s * 1.4
            }
            deeltjes = deeltjes.filter(d => d.leven > 0)
            if (deeltjes.length > 600) deeltjes.splice(0, deeltjes.length - 600)
                for (const r of ringen) r.leven -= s * 2.2
                    ringen = ringen.filter(r => r.leven > 0)
                    for (const t of teksten) {
                        t.leven -= s * 0.9
                        t.y -= s * 1.2
                    }
                    teksten = teksten.filter(t => t.leven > 0)
    }

    function lus(t) {
        if (!isActief()) {
            opruimen()
            return
        }
        const dt = Math.min(50, t - (laatste || t))
        laatste = t
        if (bezig && !gameOver) update(dt)
            updateEffecten(dt)
            teken()
            animFrame = requestAnimationFrame(lus)
            window._spelAnimFrame = animFrame
    }

    // ── Spelvorm kiezen, starten en eindigen ──
    const SPELVORMEN = [
        { modus: 'samen', titel: 'Gedeelde bak', uitleg: 'Samen in één bak, gemengde kleuren' },
        { modus: 'eigen', titel: 'Gedeelde bak, eigen kleuren', uitleg: 'Jij koraal en amber, ' + vriendNaam + ' mint en blauw' },
        { modus: 'versus', titel: 'Twee velden', uitleg: 'Ieder een eigen bak. Vierkanten sturen rijen naar je vriend' }
    ]

    function naamVan(m) {
        const v = SPELVORMEN.find(s => s.modus === m)
        return v ? v.titel : ''
    }

    function toonKeuze() {
        clearInterval(aftelInterval)
        verwijderKnoppen()
        resetStaat(null)
        resize()
        keuzeEl.innerHTML = ''
        keuzeEl.style.display = 'flex'
        if (!vriendAanwezig) {
            statusEl.textContent = '⏳ Wachten tot ' + vriendNaam + ' in het spel zit...'
            return
        }
        if (benIkHost) {
            statusEl.textContent = 'Kies een spelvorm'
            for (const v of SPELVORMEN) {
                const knop = document.createElement('button')
                knop.style.cssText = KNOP_STIJL
                knop.innerHTML = '<div style="font-size:15px;">' + v.titel + '</div><div style="font-size:11px;font-weight:500;opacity:0.75;">' + v.uitleg + '</div>'
                knop.onclick = () => {
                    spelKanaal.send({ type: 'broadcast', event: 'bi-modus', payload: { modus: v.modus } })
                    beginSpel(v.modus)
                }
                keuzeEl.appendChild(knop)
            }
        } else {
            statusEl.textContent = '⏳ Wachten tot ' + vriendNaam + ' een spelvorm kiest...'
        }
    }

    function beginSpel(m) {
        clearInterval(aftelInterval)
        verwijderKnoppen()
        keuzeEl.style.display = 'none'
        resetStaat(m)
        resize()
        if (benIkHost && m !== 'versus') hostStuurStaat([])
            aftellen()
    }

    function aftellen() {
        let tel = 3
        statusEl.textContent = naamVan(modus) + ': start in ' + tel + '...'
        geluid.tel()
        aftelInterval = setInterval(() => {
            tel--
            if (tel > 0) {
                statusEl.textContent = naamVan(modus) + ': start in ' + tel + '...'
                geluid.tel()
            } else {
                clearInterval(aftelInterval)
                window._spelAftelInterval = null
                statusEl.textContent = ''
                geluid.start()
                bezig = true
                starttijd = nu()
            }
        }, 1000)
        window._spelAftelInterval = aftelInterval
    }

    function verwijderKnoppen() {
        inhoud.querySelectorAll('button.bi-herstart').forEach(b => b.remove())
    }

    // ikVerloor: true/false bij twee velden, null bij de gedeelde bak (dan telt de score)
    function toonEinde(ikVerloor) {
        gameOver = true
        bezig = false
        mijnStuk = null
        vriendStuk = null
        geluid.einde()
        schok(1)
        const mij = scores[IK], vriend = scores[ANDER]
        if (ikVerloor === true) statusEl.textContent = '😢 Je bak liep vol. ' + vriendNaam + ' wint!'
            else if (ikVerloor === false) statusEl.textContent = '🎉 De bak van ' + vriendNaam + ' liep vol. Jij wint!'
                else {
                    statusEl.textContent = mij === vriend ? '🤝 Gelijkspel! ' + mij + ' - ' + vriend
                    : mij > vriend ? '🎉 Jij wint! ' + mij + ' - ' + vriend
                    : '😢 ' + vriendNaam + ' wint! ' + mij + ' - ' + vriend
                }
                const gespeeld = modus
                setTimeout(() => {
                    if (!gameOver || modus !== gespeeld) return
                        verwijderKnoppen()
                        const rij = inhoud.querySelector('div')
                        const opnieuw = document.createElement('button')
                        opnieuw.className = 'bi-herstart'
                        opnieuw.textContent = '↻ Opnieuw'
                        opnieuw.style.cssText = KNOP_STIJL + 'text-align:center;margin-top:4px;'
                        opnieuw.onclick = () => {
                            spelKanaal.send({ type: 'broadcast', event: 'bi-herstart', payload: { modus: gespeeld } })
                            beginSpel(gespeeld)
                        }
                        rij.appendChild(opnieuw)
                        if (benIkHost) {
                            const ander = document.createElement('button')
                            ander.className = 'bi-herstart'
                            ander.textContent = 'Andere spelvorm'
                            ander.style.cssText = 'background:rgba(255,255,255,0.12);border:none;border-radius:10px;padding:8px 18px;color:white;font-weight:600;cursor:pointer;'
                            ander.onclick = () => {
                                spelKanaal.send({ type: 'broadcast', event: 'bi-keuze', payload: {} })
                                toonKeuze()
                            }
                            rij.appendChild(ander)
                        }
                }, 900)
    }

    // ── Tekenen ──
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const ruimteB = Math.max(260, Math.min(inhoud.clientWidth || window.innerWidth, window.innerWidth) - 8)
        const ruimteH = Math.max(260, window.innerHeight * 0.72 - HUD_H)
        if (modus === 'versus') {
            // Eigen veld groot, veld van je vriend kleiner ernaast
            cel = Math.max(10, Math.floor(Math.min((ruimteB - 30) / (KOL * 1.6), ruimteH / RIJ)))
            celV = Math.max(6, Math.floor(cel * 0.6))
            B = cel * KOL + celV * KOL + 30
            H = HUD_H + Math.max(cel * RIJ, celV * RIJ + 18) + 12
            gx = 6
            gy = HUD_H + 6
            vgx = gx + cel * KOL + 18
            vgy = HUD_H + 6 + 18
        } else {
            cel = Math.max(10, Math.floor(Math.min((ruimteB - 12) / KOL, ruimteH / RIJ)))
            B = cel * KOL + 12
            H = HUD_H + cel * RIJ + 12
            gx = 6
            gy = HUD_H + 6
        }
        canvas.width = Math.round(B * dpr)
        canvas.height = Math.round(H * dpr)
        canvas.style.width = B + 'px'
        canvas.style.height = H + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function rondeRect(x, y, b, h, r) {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + b, y, x + b, y + h, r)
        ctx.arcTo(x + b, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + b, y, r)
        ctx.closePath()
    }

    function tekenBlok(x, y, s, k, alpha = 1, schaal = 1) {
        const kleur = KLEUREN[k]
        const g = Math.max(1, s * 0.05)
        const bs = s * schaal - g * 2
        const bx = x + (s - s * schaal) / 2 + g
        const by = y + (s - s * schaal) / 2 + g
        const bevel = Math.max(2, bs * 0.17)
        ctx.globalAlpha = alpha
        ctx.fillStyle = kleur.donker
        ctx.fillRect(bx, by, bs, bs)
        ctx.fillStyle = kleur.licht
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx + bs, by)
        ctx.lineTo(bx + bs - bevel, by + bevel)
        ctx.lineTo(bx + bevel, by + bevel)
        ctx.lineTo(bx + bevel, by + bs - bevel)
        ctx.lineTo(bx, by + bs)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = kleur.basis
        ctx.fillRect(bx + bevel, by + bevel, bs - bevel * 2, bs - bevel * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.16)'
        ctx.fillRect(bx + bevel, by + bevel, bs - bevel * 2, (bs - bevel * 2) * 0.38)
        ctx.globalAlpha = 1
    }

    function tekenBom(x, y, s) {
        const cx = x + s / 2, cy = y + s * 0.56, r = s * 0.36
        ctx.save()
        ctx.fillStyle = '#1b1b24'
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = BOM_KLEUR
        ctx.lineWidth = Math.max(1, s * 0.05)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.beginPath()
        ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.28, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#caa472'
        ctx.lineWidth = Math.max(1.5, s * 0.07)
        ctx.beginPath()
        ctx.moveTo(cx + r * 0.5, cy - r * 0.75)
        ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.25, cx + r * 0.3, cy - r * 1.35)
        ctx.stroke()
        if (Math.sin(nu() / 50) > -0.3) {
            ctx.fillStyle = Math.random() < 0.5 ? '#ffd23f' : '#ffffff'
            ctx.beginPath()
            ctx.arc(cx + r * 0.3, cy - r * 1.35, s * (0.07 + Math.random() * 0.05), 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.restore()
    }

    function tekenCellen(cellen, x0, y0, c, stuk) {
        for (const [x, y] of cellen) {
            if (y < 0) continue
                if (stuk.bom) tekenBom(x0 + x * c, y0 + y * c, c)
                    else tekenBlok(x0 + x * c, y0 + y * c, c, stuk.k)
        }
    }

    function tekenBak(r, x0, y0, c, popRooster) {
        const gb = c * KOL, gh = c * RIJ
        rondeRect(x0 - 5, y0 - 5, gb + 10, gh + 10, 10)
        ctx.fillStyle = 'rgba(8,4,22,0.85)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(198,184,255,0.2)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.035)'
        ctx.lineWidth = 1
        for (let x = 1; x < KOL; x++) {
            ctx.beginPath()
            ctx.moveTo(x0 + x * c + 0.5, y0)
            ctx.lineTo(x0 + x * c + 0.5, y0 + gh)
            ctx.stroke()
        }
        for (let y = 0; y < RIJ; y++) {
            for (let x = 0; x < KOL; x++) {
                if (r[y][x] !== null) tekenBlok(x0 + x * c, y0 + y * c, c, r[y][x], 1, popRooster ? 1 + popRooster[y][x] * 0.12 : 1)
            }
        }
    }

    function tekenGrens(r, x0, y0, c) {
        // Rode lijn bovenaan; hoe dichter de blokken bij de bovenkant, hoe feller hij knippert
        let hoogste = RIJ
        for (let y = 0; y < RIJ && hoogste === RIJ; y++) if (r[y].some(v => v !== null)) hoogste = y
            const gevaar = hoogste <= 4 ? 1 - hoogste / 5 : 0
            const puls = 0.5 + 0.5 * Math.sin(nu() / (gevaar > 0 ? 90 : 400))
            ctx.save()
            if (gevaar > 0) {
                const verloop = ctx.createLinearGradient(0, y0, 0, y0 + c * 5)
                verloop.addColorStop(0, 'rgba(255,60,90,' + (0.35 * gevaar * (0.6 + 0.4 * puls)) + ')')
                verloop.addColorStop(1, 'rgba(255,60,90,0)')
                ctx.fillStyle = verloop
                ctx.fillRect(x0, y0, c * KOL, c * 5)
            }
            ctx.strokeStyle = '#ff3c5a'
            ctx.lineWidth = gevaar > 0 ? 2 + gevaar * 2 : 1.5
            ctx.setLineDash([6, 4])
            ctx.globalAlpha = gevaar > 0 ? 0.6 + 0.4 * puls : 0.45
            ctx.beginPath()
            ctx.moveTo(x0, y0 + 0.5)
            ctx.lineTo(x0 + c * KOL, y0 + 0.5)
            ctx.stroke()
            ctx.restore()
    }

    function teken() {
        ctx.clearRect(0, 0, B, H)
        ctx.save()
        if (schud > 0) {
            const kracht = schud * schud * cel * 0.9
            ctx.translate((Math.random() * 2 - 1) * kracht, (Math.random() * 2 - 1) * kracht)
        }

        tekenHud()

        // Veld van je vriend (twee velden)
        if (modus === 'versus' && vriendRooster) {
            ctx.textAlign = 'left'
            ctx.fillStyle = VRIEND_KLEUR
            ctx.font = '600 11px ' + FONT
            ctx.fillText(vriendNaam, vgx, vgy - 8)
            tekenBak(vriendRooster, vgx, vgy, celV, null)
            tekenGrens(vriendRooster, vgx, vgy, celV)
            if (vriendStuk && vriendStuk.cellen) {
                tekenCellen(vriendStuk.cellen, vgx, vgy, celV, vriendStuk)
                if (vriendStuk.crush || vriendStuk.bom) tekenContour(vriendStuk.cellen, vriendStuk.bom ? BOM_KLEUR : CRUSH_KLEUR, true, vgx, vgy, celV)
            }
        }

        // Crush of bom: het speelveld dreunt na
        if (stoot > 0) {
            const t = nu() / 1000
            ctx.translate(Math.sin(t * 57) * stoot * cel * 0.25, Math.abs(Math.sin(t * 38)) * stoot * cel * 0.55)
        }

        tekenBak(rooster, gx, gy, cel, pop)
        tekenGrens(rooster, gx, gy, cel)

        // Gloed onder je eigen steen
        const eigenKleur = mijnStuk ? (mijnStuk.bom ? BOM_KLEUR : mijnStuk.crush ? CRUSH_KLEUR : MIJN_KLEUR) : MIJN_KLEUR
        const knippert = !!(mijnStuk && (mijnStuk.crush || mijnStuk.bom))
        if (mijnStuk) tekenHalo(absoluut(mijnStuk), eigenKleur, knippert)

            // Steen van je vriend in de gedeelde bak
            if (modus !== 'versus' && vriendStuk && vriendStuk.cellen) {
                const vriendKnippert = vriendStuk.crush || vriendStuk.bom
                if (vriendKnippert) tekenHalo(vriendStuk.cellen, vriendStuk.bom ? BOM_KLEUR : CRUSH_KLEUR, true, 0.45)
                    tekenCellen(vriendStuk.cellen, gx, gy, cel, vriendStuk)
                    if (vriendKnippert) tekenContour(vriendStuk.cellen, vriendStuk.bom ? BOM_KLEUR : CRUSH_KLEUR, true)
                        else {
                            ctx.strokeStyle = VRIEND_KLEUR
                            ctx.lineWidth = 2
                            for (const [x, y] of vriendStuk.cellen) if (y >= 0) ctx.strokeRect(gx + x * cel + 1, gy + y * cel + 1, cel - 2, cel - 2)
                        }
            }

            // Eigen steen met schaduw
            if (mijnStuk) {
                let d = 0
                while (past(absoluut(mijnStuk, 0, d + 1))) d++
                    ctx.strokeStyle = eigenKleur
                    ctx.globalAlpha = 0.45
                    ctx.setLineDash([4, 4])
                    ctx.lineWidth = 1.5
                    for (const [x, y] of naZwaartekracht(absoluut(mijnStuk, 0, d))) {
                        if (y >= 0) ctx.strokeRect(gx + x * cel + 3, gy + y * cel + 3, cel - 6, cel - 6)
                    }
                    ctx.setLineDash([])
                    ctx.globalAlpha = 1
                    tekenCellen(absoluut(mijnStuk), gx, gy, cel, mijnStuk)
                    tekenContour(absoluut(mijnStuk), eigenKleur, knippert)
            }

            for (const r of ringen) {
                ctx.globalAlpha = Math.max(0, r.leven)
                ctx.strokeStyle = r.kleur
                ctx.lineWidth = Math.max(1, cel * 0.35 * r.leven)
                ctx.beginPath()
                ctx.arc(gx + r.x * cel, gy + r.y * cel, (1 - r.leven) * r.max * cel, 0, Math.PI * 2)
                ctx.stroke()
            }
            for (const d of deeltjes) {
                const s = d.grootte * cel * Math.max(0.2, d.leven)
                ctx.globalAlpha = Math.min(1, d.leven * 1.5)
                ctx.fillStyle = d.kleur
                ctx.fillRect(gx + d.x * cel - s / 2, gy + d.y * cel - s / 2, s, s)
            }
            ctx.globalAlpha = 1

            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            for (const t of teksten) {
                const maat = Math.max(11, Math.round(cel * 0.95 * t.schaal))
                ctx.font = '700 ' + maat + 'px ' + FONT
                ctx.globalAlpha = Math.min(1, t.leven * 2)
                ctx.lineWidth = Math.max(3, maat * 0.16)
                ctx.strokeStyle = 'rgba(13,8,32,0.9)'
                ctx.strokeText(t.tekst, gx + t.x * cel, gy + t.y * cel)
                ctx.fillStyle = t.kleur
                ctx.fillText(t.tekst, gx + t.x * cel, gy + t.y * cel)
            }
            ctx.globalAlpha = 1
            ctx.textBaseline = 'alphabetic'
            ctx.restore()

            if (flits) {
                ctx.globalAlpha = Math.max(0, flits.a)
                ctx.fillStyle = flits.kleur
                ctx.fillRect(0, 0, B, H)
                ctx.globalAlpha = 1
            }
    }

    function contourVan(cellen) {
        const bezet = new Set(cellen.map(([x, y]) => x + ',' + y))
        const lijnen = []
        for (const [x, y] of cellen) {
            if (!bezet.has(x + ',' + (y - 1))) lijnen.push([x, y, x + 1, y])
                if (!bezet.has(x + ',' + (y + 1))) lijnen.push([x, y + 1, x + 1, y + 1])
                    if (!bezet.has((x - 1) + ',' + y)) lijnen.push([x, y, x, y + 1])
                        if (!bezet.has((x + 1) + ',' + y)) lijnen.push([x + 1, y, x + 1, y + 1])
        }
        return lijnen
    }

    // Gloed onder een steen: een geladen steen of bom knippert snel, een gewone steen klopt rustig
    function tekenHalo(cellen, kleur, knipper = false, sterkte = 1) {
        const puls = knipper ? (Math.sin(nu() / 70) > 0 ? 1 : 0.25) : 0.55 + 0.45 * Math.sin(nu() / 180)
        ctx.save()
        ctx.shadowColor = kleur
        ctx.shadowBlur = cel * (knipper ? 1.2 : 0.6 + 0.5 * puls)
        ctx.fillStyle = kleur
        ctx.globalAlpha = (knipper ? 0.25 + 0.45 * puls : 0.35 + 0.25 * puls) * sterkte
        for (const [x, y] of cellen) if (y >= 0) ctx.fillRect(gx + x * cel, gy + y * cel, cel, cel)
            ctx.restore()
    }

    // Lichtende rand om de buitenkant van een steen
    function tekenContour(cellen, kleur, knipper = false, x0 = gx, y0 = gy, c = cel) {
        const puls = knipper ? (Math.sin(nu() / 70) > 0 ? 1 : 0.35) : 0.55 + 0.45 * Math.sin(nu() / 180)
        ctx.save()
        ctx.lineCap = 'round'
        ctx.strokeStyle = knipper && puls === 1 ? '#ffffff' : kleur
        ctx.shadowColor = kleur
        ctx.shadowBlur = knipper ? c * 0.9 : c * 0.5 * puls + 4
        ctx.lineWidth = Math.max(2, c * (knipper ? 0.18 : 0.12))
        ctx.globalAlpha = 0.75 + 0.25 * puls
        ctx.beginPath()
        for (const [x1, y1, x2, y2] of contourVan(cellen)) {
            if (y1 < 0 && y2 < 0) continue
                ctx.moveTo(x0 + x1 * c, y0 + y1 * c)
                ctx.lineTo(x0 + x2 * c, y0 + y2 * c)
        }
        ctx.stroke()
        ctx.restore()
    }

    function tekenHud() {
        const wb = Math.min(170, B * 0.34)
        const pb = (B - wb - 24) / 2
        tekenSpeler(IK, 'Jij', MIJN_KLEUR, 6, 4, pb, HUD_H - 12)
        tekenSpeler(ANDER, vriendNaam, VRIEND_KLEUR, B - 6 - pb, 4, pb, HUD_H - 12)

        const wx = (B - wb) / 2, wy = 4, wh = HUD_H - 12
        rondeRect(wx, wy, wb, wh, 10)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(244,239,255,0.25)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.fillStyle = '#a99cc9'
        ctx.font = '500 10px ' + FONT
        ctx.fillText(modus === 'versus' ? 'Jouw volgende' : 'Volgende', B / 2, wy + 12)
        const vakB = (wb - 8) / 3
        const mini = Math.max(4, Math.min(10, vakB / 4.5, (wh - 18) / 2.3))
        wachtrij.slice(0, 3).forEach((data, n) => {
            const cellen = VORMEN[data.vorm]
            const minX = Math.min(...cellen.map(c => c[0])), maxX = Math.max(...cellen.map(c => c[0]))
            const minY = Math.min(...cellen.map(c => c[1])), maxY = Math.max(...cellen.map(c => c[1]))
            const vakX = wx + 4 + n * vakB
            const bx = vakX + (vakB - (maxX - minX + 1) * mini) / 2 - minX * mini
            const by = wy + 16 + (wh - 18 - (maxY - minY + 1) * mini) / 2 - minY * mini
            const k = kleurVoor(data, IK)
            for (const [cx, cy] of cellen) tekenBlok(bx + cx * mini, by + cy * mini, mini, k, n === 0 ? 1 : 0.7)
        })
    }

    function tekenSpeler(i, naam, kleur, x, y, b, h) {
        rondeRect(x, y, b, h, 10)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        ctx.strokeStyle = kleur
        ctx.globalAlpha = 0.45
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.globalAlpha = 1

        ctx.textAlign = 'left'
        ctx.fillStyle = kleur
        ctx.font = '600 12px ' + FONT
        ctx.fillText(naam.length > 12 ? naam.slice(0, 11) + '…' : naam, x + 10, y + 16)
        ctx.fillStyle = '#f4efff'
        ctx.font = '700 22px ' + FONT
        ctx.fillText(String(scores[i]), x + 10, y + 38)

        // Kleurtjes in de spelvorm met eigen kleuren
        if (modus === 'eigen') {
            EIGEN_KLEUREN[i].forEach((k, n) => tekenBlok(x + b - 32 + n * 12, y + 26, 11, k))
        }

        const stuk = i === IK ? mijnStuk : vriendStuk
        const bomNu = !!(stuk && stuk.bom)
        const crushNu = !bomNu && !!(stuk && stuk.crush)
        ctx.textAlign = 'right'
        ctx.font = '600 10px ' + FONT
        let balk = 'rgba(255,255,255,0.08)'
        if (bomNu) {
            ctx.fillStyle = Math.sin(nu() / 70) > 0 ? BOM_KLEUR : '#ffffff'
            ctx.fillText('💣 BOM!', x + b - 8, y + 16)
            balk = BOM_KLEUR
        } else if (crushNu) {
            ctx.fillStyle = Math.sin(nu() / 70) > 0 ? CRUSH_KLEUR : '#ffffff'
            ctx.fillText('⚡ CRUSH!', x + b - 8, y + 16)
            balk = CRUSH_KLEUR
        } else if (bom[i]) {
            ctx.fillStyle = BOM_KLEUR
            ctx.fillText('Bom bij volgende', x + b - 8, y + 16)
            balk = 'rgba(255,159,28,0.35)'
        } else if (lading[i]) {
            ctx.fillStyle = CRUSH_KLEUR
            ctx.fillText('Crush bij volgende', x + b - 8, y + 16)
            balk = 'rgba(255,224,102,0.35)'
        } else {
            ctx.fillStyle = '#a99cc9'
            ctx.font = '500 10px ' + FONT
            ctx.fillText('Maak een vierkant', x + b - 8, y + 16)
        }
        ctx.textAlign = 'left'
        rondeRect(x + 10, y + h - 9, b - 20, 4, 2)
        ctx.fillStyle = balk
        ctx.fill()
    }

    // ── Besturing ──
    const aanrakingen = new Map()

    function opPointerDown(e) {
        if (!isActief() || !bezig) return
            e.preventDefault()
            aanrakingen.set(e.pointerId, { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t: nu(), bewogen: false, accX: 0, accY: 0 })
            try { canvas.setPointerCapture(e.pointerId) } catch (fout) {}
    }

    function opPointerMove(e) {
        const a = aanrakingen.get(e.pointerId)
        if (!a) return
            e.preventDefault()
            const stap = cel * 0.9
            a.accX += e.clientX - a.lx
            a.accY += e.clientY - a.ly
            a.lx = e.clientX
            a.ly = e.clientY
            while (a.accX >= stap) { beweeg(1, 0); a.accX -= stap; a.bewogen = true }
            while (a.accX <= -stap) { beweeg(-1, 0); a.accX += stap; a.bewogen = true }
            if (a.accY < 0) a.accY = 0
                while (a.accY >= cel) { beweeg(0, 1); a.accY -= cel; a.bewogen = true }
    }

    function opPointerUp(e) {
        const a = aanrakingen.get(e.pointerId)
        if (!a) return
            aanrakingen.delete(e.pointerId)
            const duur = nu() - a.t
            const dy = e.clientY - a.sy
            const dx = Math.abs(e.clientX - a.sx)
            if (dy > cel * 2.5 && duur < 320 && dy > dx * 1.4) crushOfVal()
                else if (!a.bewogen && duur < 300 && Math.hypot(dx, dy) < 14) draaiStuk()
    }

    function opToets(e) {
        if (!isActief() || !bezig) return
            const acties = {
                ArrowLeft: () => beweeg(-1, 0), KeyA: () => beweeg(-1, 0),
                ArrowRight: () => beweeg(1, 0), KeyD: () => beweeg(1, 0),
                ArrowDown: () => beweeg(0, 1), KeyS: () => beweeg(0, 1),
                ArrowUp: () => draaiStuk(), KeyW: () => draaiStuk(),
                Space: () => { if (!e.repeat) crushOfVal() }, Enter: () => { if (!e.repeat) crushOfVal() }
            }
            const actie = acties[e.code]
            if (!actie) return
                e.preventDefault()
                actie()
    }

    canvas.addEventListener('pointerdown', opPointerDown)
    canvas.addEventListener('pointermove', opPointerMove)
    canvas.addEventListener('pointerup', opPointerUp)
    canvas.addEventListener('pointercancel', (e) => aanrakingen.delete(e.pointerId))
    window.addEventListener('keydown', opToets)
    window.addEventListener('resize', resize)

    function opruimen() {
        window.removeEventListener('keydown', opToets)
        window.removeEventListener('resize', resize)
        clearInterval(aftelInterval)
        clearInterval(pingInterval)
    }

    // ── Ontvangen berichten ──
    // Spelvorm: de gast meldt zich tot de host een spelvorm stuurt
    spelKanaal.on('broadcast', { event: 'bi-hier' }, () => {
        const eerst = !vriendAanwezig
        vriendAanwezig = true
        // Meld jezelf één keer terug, zodat je vriend ook weet dat jij er bent
        if (eerst) {
            spelKanaal.send({ type: 'broadcast', event: 'bi-hier', payload: {} })
            if (!modus) toonKeuze()
        }
        if (benIkHost && modus) spelKanaal.send({ type: 'broadcast', event: 'bi-modus', payload: { modus } })
    })
    spelKanaal.on('broadcast', { event: 'bi-modus' }, (msg) => {
        if (benIkHost) return
            if (modus === msg.payload.modus && !gameOver) return
                beginSpel(msg.payload.modus)
    })
    spelKanaal.on('broadcast', { event: 'bi-keuze' }, () => toonKeuze())
    spelKanaal.on('broadcast', { event: 'bi-herstart' }, (msg) => beginSpel(msg.payload.modus || modus))

    // Gedeelde bak
    spelKanaal.on('broadcast', { event: 'bi-vraag' }, (msg) => {
        if (!benIkHost || modus === 'versus' || !modus || gameOver) return
            const n = msg.payload.n
            if (!gastAntwoorden.has(n)) gastAntwoorden.set(n, geefSteen(1))
                spelKanaal.send({ type: 'broadcast', event: 'bi-steen', payload: { n, data: gastAntwoorden.get(n), wachtrij } })
    })
    spelKanaal.on('broadcast', { event: 'bi-steen' }, (msg) => {
        if (benIkHost || modus === 'versus' || msg.payload.n !== vraagNr || !wachtOpSteen) return
            wachtrij = msg.payload.wachtrij
            ontvangSteen(msg.payload.data)
    })
    spelKanaal.on('broadcast', { event: 'bi-land' }, (msg) => {
        if (!benIkHost || modus === 'versus' || !modus || gameOver) return
            const p = msg.payload
            const r = landInBak(1, p.cellen, p.k, p.crush, p.bom)
            speelEffecten(r.effecten)
            hostStuurStaat(r.effecten)
            if (r.overloop) hostEinde()
    })
    spelKanaal.on('broadcast', { event: 'bi-staat' }, (msg) => {
        if (benIkHost || modus === 'versus' || !modus) return
            const p = msg.payload
            uitTekst(p.rooster, rooster)
            wachtrij = p.wachtrij
            scores = p.scores
            lading = p.lading || [false, false]
            bom = p.bom || [false, false]
            if (mijnStuk) {
                let n = 0
                while (!vrijInRooster(absoluut(mijnStuk)) && n++ < RIJ) mijnStuk.y--
            }
            speelEffecten(p.effecten || [])
    })
    spelKanaal.on('broadcast', { event: 'bi-vol' }, () => {
        if (benIkHost && modus !== 'versus') hostEinde()
    })
    spelKanaal.on('broadcast', { event: 'bi-einde' }, (msg) => {
        if (benIkHost || modus === 'versus') return
            scores = msg.payload.scores
            if (!gameOver) toonEinde(null)
    })

    // Twee velden
    spelKanaal.on('broadcast', { event: 'bi-veld' }, (msg) => {
        if (modus !== 'versus' || !vriendRooster) return
            const p = msg.payload
            uitTekst(p.rooster, vriendRooster)
            scores[ANDER] = p.score
            lading[ANDER] = !!p.lading
            bom[ANDER] = !!p.bom
    })
    spelKanaal.on('broadcast', { event: 'bi-aanval' }, (msg) => krijgRijen(msg.payload.rijen))
    spelKanaal.on('broadcast', { event: 'bi-verloren' }, (msg) => {
        if (modus !== 'versus' || gameOver) return
            scores[ANDER] = msg.payload.scores
            toonEinde(false)
    })

    // Beide
    spelKanaal.on('broadcast', { event: 'bi-stuk' }, (msg) => {
        vriendStuk = msg.payload.cellen ? msg.payload : null
    })

    // ── Start ──
    toonKeuze()
    spelKanaal.send({ type: 'broadcast', event: 'bi-hier', payload: {} })
    pingInterval = setInterval(() => {
        if (!isActief()) {
            clearInterval(pingInterval)
            return
        }
        if (!vriendAanwezig) spelKanaal.send({ type: 'broadcast', event: 'bi-hier', payload: {} })
    }, 1200)
    animFrame = requestAnimationFrame(lus)
    window._spelAnimFrame = animFrame
}

// ── Geluid (Web Audio, geen bestanden nodig) ──
function maakGeluid() {
    let ac = null
    let aan = true
    try { aan = localStorage.getItem('fibro_blockit_geluid') !== 'uit' } catch (fout) {}

    function audio() {
        if (!aan) return null
            try {
                const AC = window.AudioContext || window.webkitAudioContext
                if (!ac && AC) ac = new AC()
                    if (ac && ac.state === 'suspended') ac.resume()
            } catch (fout) {
                return null
            }
            return ac
    }

    function toon({ freq, eind = freq, duur = 0.12, type = 'sine', volume = 0.15, vertraging = 0 }) {
        const a = audio()
        if (!a) return
            const t = a.currentTime + vertraging
            const osc = a.createOscillator()
            const gain = a.createGain()
            osc.type = type
            osc.frequency.setValueAtTime(freq, t)
            osc.frequency.exponentialRampToValueAtTime(Math.max(eind, 1), t + duur)
            gain.gain.setValueAtTime(0.0001, t)
            gain.gain.exponentialRampToValueAtTime(volume, t + 0.008)
            gain.gain.exponentialRampToValueAtTime(0.0001, t + duur)
            osc.connect(gain)
            gain.connect(a.destination)
            osc.start(t)
            osc.stop(t + duur + 0.05)
    }

    function ruis({ duur = 0.2, volume = 0.3, filter = 1000, filterEind = filter, soort = 'lowpass', vertraging = 0 }) {
        const a = audio()
        if (!a) return
            const t = a.currentTime + vertraging
            const lengte = Math.max(1, Math.floor(a.sampleRate * duur))
            const buffer = a.createBuffer(1, lengte, a.sampleRate)
            const data = buffer.getChannelData(0)
            for (let i = 0; i < lengte; i++) data[i] = Math.random() * 2 - 1
                const bron = a.createBufferSource()
                bron.buffer = buffer
                const f = a.createBiquadFilter()
                f.type = soort
                f.frequency.setValueAtTime(filter, t)
                f.frequency.exponentialRampToValueAtTime(Math.max(filterEind, 1), t + duur)
                const gain = a.createGain()
                gain.gain.setValueAtTime(volume, t)
                gain.gain.exponentialRampToValueAtTime(0.0001, t + duur)
                bron.connect(f)
                f.connect(gain)
                gain.connect(a.destination)
                bron.start(t)
    }

    const GRONDTOON = [523.25, 587.33, 659.25, 783.99]

    return {
        get aan() { return aan },
        wissel() {
            aan = !aan
            try { localStorage.setItem('fibro_blockit_geluid', aan ? 'aan' : 'uit') } catch (fout) {}
            if (aan) toon({ freq: 660, duur: 0.08, type: 'triangle', volume: 0.12 })
                return aan
        },
        schuif() { toon({ freq: 340, duur: 0.03, type: 'square', volume: 0.025 }) },
        draai() { toon({ freq: 620, eind: 880, duur: 0.06, type: 'triangle', volume: 0.07 }) },
        land(kracht) {
            ruis({ duur: 0.08 + kracht * 0.18, volume: 0.08 + kracht * 0.3, filter: 1200, filterEind: 120 })
            toon({ freq: 140, eind: 55, duur: 0.1 + kracht * 0.15, volume: 0.06 + kracht * 0.25 })
        },
        vierkant(kleur, keten) {
            const basis = GRONDTOON[kleur] * Math.pow(2, Math.min(keten - 1, 6) * 2 / 12)
            ;[1, 1.25, 1.5, 2].forEach((m, i) => toon({ freq: basis * m, duur: 0.22, type: 'triangle', volume: 0.12, vertraging: i * 0.055 }))
        },
        schokgolf(k) {
            const kracht = Math.min(1, 0.6 + (k - 4) * 0.15)
            toon({ freq: 120, eind: 30, duur: 0.7, volume: 0.45 * kracht })
            ruis({ duur: 0.9, volume: 0.45 * kracht, filter: 2400, filterEind: 60 })
        },
        crush() {
            ruis({ duur: 0.35, volume: 0.45, filter: 700, filterEind: 60, soort: 'bandpass' })
            toon({ freq: 200, eind: 40, duur: 0.35, type: 'square', volume: 0.12 })
        },
        bom() {
            toon({ freq: 95, eind: 25, duur: 0.9, volume: 0.5 })
            ruis({ duur: 1.1, volume: 0.55, filter: 3000, filterEind: 50 })
            ruis({ duur: 0.15, volume: 0.35, filter: 5000, filterEind: 1500, soort: 'highpass' })
        },
        rommel() {
            ruis({ duur: 0.4, volume: 0.35, filter: 500, filterEind: 80 })
            toon({ freq: 160, eind: 80, duur: 0.3, type: 'square', volume: 0.1 })
        },
        aanval() {
            ;[880, 660, 440].forEach((f, i) => toon({ freq: f, duur: 0.1, type: 'square', volume: 0.07, vertraging: i * 0.06 }))
        },
        ontgrendeld() {
            ;[440, 554.37, 659.25, 880].forEach((f, i) => toon({ freq: f, duur: 0.16, type: 'square', volume: 0.06, vertraging: i * 0.07 }))
        },
        crushKlaar() { toon({ freq: 1320, duur: 0.18, type: 'triangle', volume: 0.08 }) },
        tel() { toon({ freq: 520, duur: 0.1, type: 'square', volume: 0.08 }) },
        start() {
            ;[392, 523.25, 659.25].forEach((f, i) => toon({ freq: f, duur: 0.14, type: 'triangle', volume: 0.1, vertraging: i * 0.09 }))
        },
        einde() {
            ;[523.25, 392, 329.63, 261.63].forEach((f, i) => toon({ freq: f, duur: 0.28, type: 'triangle', volume: 0.14, vertraging: i * 0.16 }))
        }
    }
}
