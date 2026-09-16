// blockit-ui.js - Block It voor Fibro, multiplayer via het spelkanaal.
// De host beheert de gedeelde bak, de wachtrij en de punten.
// Ieder bestuurt zijn eigen steen en meldt de host waar die landt.

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
    vriendNaam = vriendNaam || 'vriend'
    isActief = isActief || (() => true)
    document.getElementById('spelTitelBar').textContent = '🟪 Block It'
    const inhoud = document.getElementById('spelInhoud')
    const benIkHost = benIkSpeler1
    const IK = benIkHost ? 0 : 1
    const ANDER = 1 - IK

    // ── Instellingen ──
    const KOL = 20, RIJ = 20
    const LOCK_MS = 380, CRUSH_WACHT = 6000
    const HUD_H = 66
    const KLEUREN = [
        { basis: '#ff4d6d', licht: '#ff9aae', donker: '#9d1537' },
        { basis: '#ffb627', licht: '#ffd98a', donker: '#a86a0c' },
        { basis: '#2ee6a6', licht: '#98f6d4', donker: '#0b8560' },
        { basis: '#4d9dff', licht: '#a5ccff', donker: '#1c49b8' }
    ]
    const VORMEN = {
        I: [[0, 1], [1, 1], [2, 1], [3, 1]],
        O: [[1, 0], [2, 0], [1, 1], [2, 1]],
        T: [[0, 1], [1, 1], [2, 1], [1, 0]],
        L: [[0, 1], [1, 1], [2, 1], [2, 0]],
        J: [[0, 1], [1, 1], [2, 1], [0, 0]],
        S: [[1, 0], [2, 0], [0, 1], [1, 1]],
        Z: [[0, 0], [1, 0], [1, 1], [2, 1]]
    }
    const VORM_NAMEN = Object.keys(VORMEN)
    const SPELER_KLEUR = [IK === 0 ? '#c6b8ff' : '#ffc9a3', IK === 0 ? '#ffc9a3' : '#c6b8ff']
    const MIJN_KLEUR = '#c6b8ff', VRIEND_KLEUR = '#ffc9a3'
    const FONT = "'Chakra Petch', 'Segoe UI', system-ui, sans-serif"
    const nu = () => performance.now()

    inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;">
    <div id="bi-status" style="color:white;font-size:13px;font-weight:600;min-height:18px;text-align:center;"></div>
    <canvas id="bi-canvas" style="display:block;touch-action:none;border-radius:12px;"></canvas>
    <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;">
    <button id="bi-geluid" style="background:rgba(255,255,255,0.12);border:none;border-radius:8px;color:white;padding:4px 12px;font-size:16px;cursor:pointer;">🔊</button>
    <div style="color:rgba(255,255,255,0.45);font-size:11px;text-align:center;">Veeg om te schuiven, tik om te draaien, veeg snel omlaag om te laten vallen</div>
    </div>
    </div>`

    const canvas = document.getElementById('bi-canvas')
    const ctx = canvas.getContext('2d')
    const statusEl = document.getElementById('bi-status')
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
    let rooster, pop, wachtrij, scores, crushOpen, crushKlaarOp
    let mijnStuk, vriendStuk, wachtOpSteen, vraagNr, vraagTijd, wachtendeData
    let spawnWacht, valTimer, lockTimer, bezig, gameOver, starttijd, crushGemeld
    let schud = 0, flits = null, deeltjes = [], teksten = [], ringen = []
    let laatsteStukSync = 0, laatste = 0, animFrame = null, aftelInterval = null
    let gastAntwoorden = new Map()   // host: vraagnummer van gast -> gegeven steen
    let cel = 16, B = 300, H = 400, gx = 6, gy = HUD_H + 6

    function resetStaat() {
        rooster = Array.from({ length: RIJ }, () => new Array(KOL).fill(null))
        pop = Array.from({ length: RIJ }, () => new Array(KOL).fill(0))
        wachtrij = benIkHost ? [nieuwStukData(), nieuwStukData(), nieuwStukData()] : []
        scores = [0, 0]
        crushOpen = [false, false]
        crushKlaarOp = [0, 0]
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
        crushGemeld = false
        gastAntwoorden = new Map()
        deeltjes = []
        teksten = []
        ringen = []
        flits = null
    }
    resetStaat()

    function nieuwStukData() {
        return { vorm: VORM_NAMEN[Math.floor(Math.random() * VORM_NAMEN.length)], k: Math.floor(Math.random() * KLEUREN.length) }
    }

    // ── Stenen en rooster ──
    function grootteVan(vorm) {
        return vorm === 'I' || vorm === 'O' ? 4 : 3
    }

    function draai(cellen, grootte) {
        return cellen.map(([x, y]) => [grootte - 1 - y, x])
    }

    function maakStuk(data, x) {
        return { vorm: data.vorm, k: data.k, cellen: VORMEN[data.vorm].map(c => [c[0], c[1]]), x, y: 0 }
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
        if (!vriendStuk) return true
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

    function roosterNaarTekst() {
        let t = ''
        for (let y = 0; y < RIJ; y++) for (let x = 0; x < KOL; x++) t += rooster[y][x] === null ? '.' : rooster[y][x]
            return t
    }

    function tekstNaarRooster(t) {
        for (let y = 0; y < RIJ; y++) {
            for (let x = 0; x < KOL; x++) {
                const ch = t[y * KOL + x]
                rooster[y][x] = ch === '.' || ch === undefined ? null : Number(ch)
            }
        }
    }

    function crushKlaar(i) {
        return crushOpen[i] && nu() >= crushKlaarOp[i]
    }

    // ── Host: de echte bak ──
    function hostGeefSteen() {
        const data = wachtrij.shift()
        wachtrij.push(nieuwStukData())
        return data
    }

    function hostLand(speler, cellen, k, isCrush) {
        const effecten = []
        let geplaatst = cellen.map(c => [c[0], c[1]])

        // Crush alleen als die echt klaar is (met wat speling voor vertraging)
        if (isCrush && !(crushOpen[speler] && nu() >= crushKlaarOp[speler] - 400)) isCrush = false

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
                        crushKlaarOp[speler] = nu() + CRUSH_WACHT
                        effecten.push({ t: 'crush', speler, geplet, van, naar: geplaatst })
            }

            // Is een plek intussen bezet (de ander landde net eerder)? Dan schuift het blokje omhoog.
            let overloop = false
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
            effecten.push({ t: 'land', speler, cellen: landing, hard: isCrush })
            laatVallen()
            if (!overloop) hostVierkanten(speler, effecten)
                return { effecten, overloop }
    }

    function hostVierkanten(speler, effecten) {
        let keten = 0
        for (let veilig = 0; veilig < 25; veilig++) {
            const v = grootsteVierkant()
            if (!v) break
                keten++
                const punten = (v.k === 3 ? 1 : (v.k - 3) * 2 + 1) * keten
                scores[speler] += punten
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

                    let ontgrendeld = false
                    if (!crushOpen[speler]) {
                        crushOpen[speler] = true
                        crushKlaarOp[speler] = nu()
                        ontgrendeld = true
                    }
                    effecten.push({ t: 'vierkant', speler, x: v.x, y: v.y, k: v.k, kleur: v.kleur, keten, punten, dikte, ontgrendeld })
                    laatVallen()
        }
    }

    function hostStuurStaat(effecten) {
        const n = nu()
        spelKanaal.send({
            type: 'broadcast', event: 'bi-staat', payload: {
                rooster: roosterNaarTekst(),
                        wachtrij,
                        scores,
                        crushOpen,
                        crushWacht: crushKlaarOp.map(t => Math.max(0, t - n)),
                        effecten
            }
        })
    }

    function hostEinde() {
        if (gameOver) return
            spelKanaal.send({ type: 'broadcast', event: 'bi-einde', payload: { scores } })
            toonEinde()
    }

    // ── Eigen steen ──
    function vraagSteen() {
        if (mijnStuk || wachtOpSteen || gameOver) return
            wachtOpSteen = true
            if (benIkHost) {
                const data = hostGeefSteen()
                hostStuurStaat([])
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
            const voorkeur = IK === 0 ? Math.round(KOL * 0.25) - 2 : Math.round(KOL * 0.75) - 2
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
                        stuurStuk()
                        return
                }
                if (doorVriend) {
                    wachtendeData = data
                    spawnWacht = 200
                    return
                }
                // Er past nergens meer een steen
                if (benIkHost) hostEinde()
                    else spelKanaal.send({ type: 'broadcast', event: 'bi-vol', payload: {} })
    }

    function stuurStuk() {
        laatsteStukSync = nu()
        spelKanaal.send({
            type: 'broadcast', event: 'bi-stuk',
            payload: mijnStuk ? { cellen: absoluut(mijnStuk), k: mijnStuk.k } : { cellen: null }
        })
    }

    function landLokaal(isCrush) {
        const cellen = absoluut(mijnStuk)
        const k = mijnStuk.k
        mijnStuk = null
        spawnWacht = 140
        stuurStuk()
        if (benIkHost) {
            const r = hostLand(0, cellen, k, isCrush)
            speelEffecten(r.effecten)
            hostStuurStaat(r.effecten)
            if (r.overloop) hostEinde()
        } else {
            // Alvast tonen tot de host antwoordt (niet bij Crush, die boort eerst)
            if (!isCrush) for (const [x, y] of cellen) if (y >= 0 && rooster[y][x] === null) rooster[y][x] = k
                spelKanaal.send({ type: 'broadcast', event: 'bi-land', payload: { cellen, k, crush: isCrush } })
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
        if (!s || !bezig || s.vorm === 'O') return
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
            if (crushKlaar(IK)) {
                crushGemeld = false
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

    function speelEffecten(effecten) {
        for (const e of effecten) {
            const spelerKleur = SPELER_KLEUR[e.speler]
            if (e.t === 'land') {
                for (const [x, y] of e.cellen) if (y >= 0 && y < RIJ) pop[y][x] = 1
            } else if (e.t === 'crush') {
                const m = midden(e.naar)
                for (const [x, y] of e.van) {
                    for (let yy = Math.max(0, y); yy < m.y + 1; yy += 0.6) {
                        deeltjes.push({ x: x + Math.random(), y: yy, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, leven: 0.7, kleur: spelerKleur, grootte: 0.14 })
                    }
                }
                zweef(m.x, m.y - 1.5, e.geplet ? 'CRUSH! ' + e.geplet + ' weg' : 'CRUSH!', spelerKleur, 1.15)
                ringen.push({ x: m.x, y: m.y, max: 6, kleur: '#ffffff', leven: 1 })
                schok(Math.min(1, 0.6 + e.geplet * 0.02))
                geluid.crush()
            } else if (e.t === 'vierkant') {
                const kleur = KLEUREN[e.kleur]
                const cx = e.x + e.k / 2, cy = e.y + e.k / 2
                for (let y = e.y; y < e.y + e.k; y++) for (let x = e.x; x < e.x + e.k; x++) spat(x, y, kleur.licht, 1)
                    flits = { kleur: kleur.basis, a: e.k >= 4 ? 0.42 : 0.22 }
                    ringen.push({ x: cx, y: cy, max: e.k * 0.9, kleur: kleur.basis, leven: 1 })
                    zweef(cx, cy, '+' + e.punten + (e.punten === 1 ? ' PUNT!' : ' PUNTEN!'), kleur.basis, e.k >= 4 ? 1.35 : 1)
                    zweef(cx, cy + 1.3, e.speler === IK ? 'Jij' : vriendNaam, spelerKleur, 0.7)
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
                        if (e.ontgrendeld) {
                            zweef(cx, cy + 3.6, 'CRUSH ONTGRENDELD', spelerKleur, 0.8)
                            if (e.speler === IK) geluid.ontgrendeld()
                        }
            }
        }
    }

    function midden(pos) {
        let sx = 0, sy = 0
        for (const [x, y] of pos) {
            sx += x + 0.5
            sy += y + 0.5
        }
        return { x: sx / Math.max(1, pos.length), y: sy / Math.max(1, pos.length) }
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
                if (!benIkHost && nu() - vraagTijd > 1500) {
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

        if (crushOpen[IK] && !crushGemeld && nu() >= crushKlaarOp[IK]) {
            crushGemeld = true
            geluid.crushKlaar()
        }
        if (nu() - laatsteStukSync > 100) stuurStuk()
    }

    function updateEffecten(dt) {
        const s = dt / 1000
        schud = Math.max(0, schud - s * 1.8)
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

    function toonEinde() {
        gameOver = true
        bezig = false
        mijnStuk = null
        vriendStuk = null
        geluid.einde()
        schok(1)
        const mij = scores[IK], vriend = scores[ANDER]
        statusEl.textContent = mij === vriend ? '🤝 Gelijkspel! ' + mij + ' - ' + vriend
        : mij > vriend ? '🎉 Jij wint! ' + mij + ' - ' + vriend
        : '😢 ' + vriendNaam + ' wint! ' + mij + ' - ' + vriend
        setTimeout(() => {
            inhoud.querySelectorAll('button.bi-herstart').forEach(b => b.remove())
            const btn = document.createElement('button')
            btn.className = 'bi-herstart'
            btn.textContent = '↻ Opnieuw'
            btn.style.cssText = 'background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:700;cursor:pointer;margin-top:4px;display:block;'
            btn.onclick = () => {
                spelKanaal.send({ type: 'broadcast', event: 'bi-herstart', payload: {} })
                herstart()
            }
            inhoud.querySelector('div').appendChild(btn)
        }, 900)
    }

    function herstart() {
        clearInterval(aftelInterval)
        inhoud.querySelectorAll('button.bi-herstart').forEach(b => b.remove())
        resetStaat()
        if (benIkHost) hostStuurStaat([])
            aftellen()
    }

    function aftellen() {
        let tel = 3
        statusEl.textContent = 'Start in ' + tel + '...'
        geluid.tel()
        aftelInterval = setInterval(() => {
            tel--
            if (tel > 0) {
                statusEl.textContent = 'Start in ' + tel + '...'
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

    // ── Tekenen ──
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const ruimteB = Math.max(260, Math.min(inhoud.clientWidth || window.innerWidth, window.innerWidth) - 8)
        const ruimteH = Math.max(260, window.innerHeight * 0.74 - HUD_H)
        cel = Math.max(10, Math.floor(Math.min((ruimteB - 12) / KOL, ruimteH / RIJ)))
        B = cel * KOL + 12
        H = HUD_H + cel * RIJ + 12
        gx = 6
        gy = HUD_H + 6
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

    function teken() {
        ctx.clearRect(0, 0, B, H)
        ctx.save()
        if (schud > 0) {
            const kracht = schud * schud * cel * 0.9
            ctx.translate((Math.random() * 2 - 1) * kracht, (Math.random() * 2 - 1) * kracht)
        }

        tekenHud()

        // Bak
        const gb = cel * KOL, gh = cel * RIJ
        rondeRect(gx - 5, gy - 5, gb + 10, gh + 10, 10)
        ctx.fillStyle = 'rgba(8,4,22,0.85)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(198,184,255,0.2)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.035)'
        ctx.lineWidth = 1
        for (let x = 1; x < KOL; x++) {
            ctx.beginPath()
            ctx.moveTo(gx + x * cel + 0.5, gy)
            ctx.lineTo(gx + x * cel + 0.5, gy + gh)
            ctx.stroke()
        }

        for (let y = 0; y < RIJ; y++) {
            for (let x = 0; x < KOL; x++) {
                if (rooster[y][x] !== null) tekenBlok(gx + x * cel, gy + y * cel, cel, rooster[y][x], 1, 1 + pop[y][x] * 0.12)
            }
        }

        // Steen van je vriend
        if (vriendStuk && vriendStuk.cellen) {
            for (const [x, y] of vriendStuk.cellen) {
                if (y < 0) continue
                    tekenBlok(gx + x * cel, gy + y * cel, cel, vriendStuk.k)
                    ctx.strokeStyle = VRIEND_KLEUR
                    ctx.lineWidth = 2
                    ctx.strokeRect(gx + x * cel + 1, gy + y * cel + 1, cel - 2, cel - 2)
            }
        }

        // Eigen steen met schaduw
        if (mijnStuk) {
            let d = 0
            while (past(absoluut(mijnStuk, 0, d + 1))) d++
                ctx.strokeStyle = MIJN_KLEUR
                ctx.globalAlpha = 0.45
                ctx.setLineDash([4, 4])
                ctx.lineWidth = 1.5
                for (const [x, y] of naZwaartekracht(absoluut(mijnStuk, 0, d))) {
                    if (y >= 0) ctx.strokeRect(gx + x * cel + 3, gy + y * cel + 3, cel - 6, cel - 6)
                }
                ctx.setLineDash([])
                ctx.globalAlpha = 1
                for (const [x, y] of absoluut(mijnStuk)) {
                    if (y < 0) continue
                        tekenBlok(gx + x * cel, gy + y * cel, cel, mijnStuk.k)
                        ctx.strokeStyle = MIJN_KLEUR
                        ctx.lineWidth = 2
                        ctx.strokeRect(gx + x * cel + 1, gy + y * cel + 1, cel - 2, cel - 2)
                }
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

    function tekenHud() {
        const wb = Math.min(170, B * 0.34)
        const pb = (B - wb - 24) / 2
        tekenSpeler(IK, 'Jij', MIJN_KLEUR, 6, 4, pb, HUD_H - 12)
        tekenSpeler(ANDER, vriendNaam, VRIEND_KLEUR, B - 6 - pb, 4, pb, HUD_H - 12)

        // Gedeelde wachtrij
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
        ctx.fillText('Volgende', B / 2, wy + 12)
        const vakB = (wb - 8) / 3
        const mini = Math.max(4, Math.min(10, vakB / 4.5, (wh - 18) / 2.3))
        wachtrij.slice(0, 3).forEach((data, n) => {
            const cellen = VORMEN[data.vorm]
            const minX = Math.min(...cellen.map(c => c[0])), maxX = Math.max(...cellen.map(c => c[0]))
            const minY = Math.min(...cellen.map(c => c[1])), maxY = Math.max(...cellen.map(c => c[1]))
            const vakX = wx + 4 + n * vakB
            const bx = vakX + (vakB - (maxX - minX + 1) * mini) / 2 - minX * mini
            const by = wy + 16 + (wh - 18 - (maxY - minY + 1) * mini) / 2 - minY * mini
            for (const [cx, cy] of cellen) tekenBlok(bx + cx * mini, by + cy * mini, mini, data.k, n === 0 ? 1 : 0.7)
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

        let deel = 0
        let tekst = 'op slot'
        if (crushOpen[i]) {
            const rest = crushKlaarOp[i] - nu()
            deel = rest <= 0 ? 1 : 1 - rest / CRUSH_WACHT
            tekst = rest <= 0 ? 'klaar' : 'laadt'
        }
        ctx.textAlign = 'right'
        ctx.font = '500 10px ' + FONT
        ctx.fillStyle = deel === 1 ? kleur : '#a99cc9'
        ctx.fillText('Crush ' + tekst, x + b - 8, y + 16)
        ctx.textAlign = 'left'
        rondeRect(x + 10, y + h - 9, b - 20, 4, 2)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fill()
        if (deel > 0) {
            rondeRect(x + 10, y + h - 9, Math.max(4, (b - 20) * deel), 4, 2)
            ctx.fillStyle = kleur
            ctx.fill()
        }
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
    }

    // ── Ontvangen berichten ──
    spelKanaal.on('broadcast', { event: 'bi-vraag' }, (msg) => {
        if (!benIkHost || gameOver) return
            const n = msg.payload.n
            if (!gastAntwoorden.has(n)) gastAntwoorden.set(n, hostGeefSteen())
                spelKanaal.send({ type: 'broadcast', event: 'bi-steen', payload: { n, data: gastAntwoorden.get(n), wachtrij } })
    })
    spelKanaal.on('broadcast', { event: 'bi-steen' }, (msg) => {
        if (benIkHost || msg.payload.n !== vraagNr || !wachtOpSteen) return
            wachtrij = msg.payload.wachtrij
            ontvangSteen(msg.payload.data)
    })
    spelKanaal.on('broadcast', { event: 'bi-land' }, (msg) => {
        if (!benIkHost || gameOver) return
            const p = msg.payload
            const r = hostLand(1, p.cellen, p.k, p.crush)
            speelEffecten(r.effecten)
            hostStuurStaat(r.effecten)
            if (r.overloop) hostEinde()
    })
    spelKanaal.on('broadcast', { event: 'bi-staat' }, (msg) => {
        if (benIkHost) return
            const p = msg.payload
            tekstNaarRooster(p.rooster)
            wachtrij = p.wachtrij
            scores = p.scores
            crushOpen = p.crushOpen
            crushKlaarOp = p.crushWacht.map(ms => nu() + ms)
            if (mijnStuk) {
                let n = 0
                while (!vrijInRooster(absoluut(mijnStuk)) && n++ < RIJ) mijnStuk.y--
            }
            speelEffecten(p.effecten || [])
    })
    spelKanaal.on('broadcast', { event: 'bi-stuk' }, (msg) => {
        vriendStuk = msg.payload.cellen ? msg.payload : null
    })
    spelKanaal.on('broadcast', { event: 'bi-vol' }, () => {
        if (benIkHost) hostEinde()
    })
    spelKanaal.on('broadcast', { event: 'bi-einde' }, (msg) => {
        if (benIkHost) return
            scores = msg.payload.scores
            if (!gameOver) toonEinde()
    })
    spelKanaal.on('broadcast', { event: 'bi-herstart' }, () => herstart())

    // ── Start ──
    resize()
    teken()
    aftellen()
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
