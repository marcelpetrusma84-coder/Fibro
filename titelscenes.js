// titelscenes.js - de bewegende plaatjes van de titelschermen (v3, 2 nov 2026)
// v3: Ghost Tag met de spookjes en stippen uit het spel; Twin Snakes allebei vooruit; Neo Paddle: de bal kaatst echt.
// v2: The Swarm, Runner & Gunner en Neon Raiders in de stijl van het spel zelf (titelstijl.js, met hun eigen titel);
//     Block It laat zien wat er in het spel gebeurt: een steen valt, er ontstaat een vierkant van 3x3 en dat knalt.
//
// In gewone woorden: voor elk spel een tekening in code (dus altijd scherp, op elk scherm) die een beetje beweegt.
// teken(ctx, b, h, t, st): b x h = grootte in beeldpunten, t = seconden sinds het begin, st = een eigen kladblok.
// De naam van het spel tekent titelscherm.js er bovenop (in het lettertype en de kleuren van 'titel').
// Geen ctx.filter: dat kent Safari op de iPhone niet.

import { maakSwarm, maakRunner, maakNeon, maakEcto } from './titelstijl.js?v=2'   // v2: drie spellen in hun eigen stijl

const TAU = Math.PI * 2

function rond(ctx, x, y, b, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + b, y, x + b, y + h, r)
    ctx.arcTo(x + b, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + b, y, r)
    ctx.closePath()
}
function verloop(ctx, h, kleuren) {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    kleuren.forEach((k, i) => g.addColorStop(i / (kleuren.length - 1), k))
    return g
}
function lucht(ctx, b, h, kleuren) {
    ctx.fillStyle = verloop(ctx, h, kleuren)
    ctx.fillRect(0, 0, b, h)
}
// vaste 'willekeur' (elke keer hetzelfde plaatje)
function reeks(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
}
const glad = x => x * x * (3 - 2 * x)
const klem = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))

function sterren(ctx, b, h, t, n, seed, snelheid = 0, kleur = '#ffffff') {
    const r = reeks(seed)
    ctx.fillStyle = kleur
    for (let i = 0; i < n; i++) {
        const x = r() * b, y0 = r() * h, z = 0.3 + r() * 0.7
        const y = (y0 + t * snelheid * z * 60) % h
        ctx.globalAlpha = 0.35 + 0.65 * z * (0.6 + 0.4 * Math.sin(t * 3 + i))
        const s = z * 2
        ctx.fillRect(x, y, s, s)
    }
    ctx.globalAlpha = 1
}

// ── Tic-Tac-Toe: houten bord, kruisjes en rondjes komen erbij ──
function botkaaseiren(ctx, b, h, t) {
    lucht(ctx, b, h, ['#8a5a2f', '#5c3518', '#341c0b'])
    // houtnerf
    ctx.strokeStyle = 'rgba(255,220,170,0.07)'
    ctx.lineWidth = 2
    for (let i = 0; i < 26; i++) {
        ctx.beginPath()
        for (let x = 0; x <= b; x += 12) {
            const y = (i / 26) * h + Math.sin(x / 70 + i * 1.7) * 8 + Math.sin(x / 23 + i) * 2
            x ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
        }
        ctx.stroke()
    }
    const z = Math.min(b * 0.78, h * 0.42), x0 = (b - z) / 2, y0 = h * 0.47
    rond(ctx, x0 - 12, y0 - 12, z + 24, z + 24, 22)
    ctx.fillStyle = '#c99257'
    ctx.fill()
    ctx.strokeStyle = '#7a4a22'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#6b3d18'
    ctx.lineWidth = z * 0.035
    for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(x0 + z * i / 3, y0 + 8); ctx.lineTo(x0 + z * i / 3, y0 + z - 8); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + z * i / 3); ctx.lineTo(x0 + z - 8, y0 + z * i / 3); ctx.stroke()
    }
    const zetten = [[1, 1], [0, 0], [2, 0], [0, 2], [2, 2], [1, 0], [2, 1]]
    const ronde = (t % 7) / 0.7
    const c = z / 3
    zetten.forEach(([cx, cy], i) => {
        const p = klem(ronde - i)
        if (p <= 0) return
        const s = glad(klem(p * 1.6)) * (1 + 0.15 * Math.sin(klem(p * 1.6) * Math.PI))
        const mx = x0 + c * cx + c / 2, my = y0 + c * cy + c / 2, r = c * 0.3 * s
        ctx.lineWidth = c * 0.12
        if (i % 2 === 0) {
            ctx.strokeStyle = '#2f1606'
            ctx.beginPath(); ctx.moveTo(mx - r, my - r); ctx.lineTo(mx + r, my + r); ctx.moveTo(mx + r, my - r); ctx.lineTo(mx - r, my + r); ctx.stroke()
        } else {
            ctx.strokeStyle = '#fff1d6'
            ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.stroke()
        }
    })
    // winnende lijn (rechts: 2,0 - 2,1 - 2,2)
    const lijn = klem(ronde - 7.2)
    if (lijn > 0) {
        ctx.strokeStyle = '#ffd34d'
        ctx.lineWidth = c * 0.09
        ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 18
        ctx.beginPath(); ctx.moveTo(x0 + c * 2.5, y0 + c * 0.2); ctx.lineTo(x0 + c * 2.5, y0 + c * (0.2 + 2.6 * glad(lijn))); ctx.stroke()
        ctx.shadowBlur = 0
    }
}

// ── Four in a Row: blauw speelgoedrek, schijven vallen erin ──
function vieroprij(ctx, b, h, t, st) {
    lucht(ctx, b, h, ['#7fd3ff', '#3fa6f5', '#1d6fd1'])
    // wolkjes
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    for (let i = 0; i < 4; i++) {
        const x = ((i * 0.31 + t * 0.015 * (1 + i * 0.3)) % 1.3 - 0.15) * b, y = h * (0.06 + i * 0.07)
        for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 20]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.fill() }
    }
    const kol = 7, rij = 6
    const c = Math.min(b * 0.9 / kol, h * 0.42 / rij), rb = c * kol, rh = c * rij
    const x0 = (b - rb) / 2, y0 = h * 0.5
    if (!st.vul) {
        const r = reeks(7)
        st.vul = []
        const hoogte = new Array(kol).fill(0)
        for (let i = 0; i < 26; i++) {
            let k = Math.floor(r() * kol)
            if (hoogte[k] >= rij) k = hoogte.findIndex(v => v < rij)
            st.vul.push({ k, r: rij - 1 - hoogte[k], kleur: i % 2 })
            hoogte[k]++
        }
    }
    const ronde = (t % 15) / 0.5
    // schijven (achter het rek)
    st.vul.forEach((s, i) => {
        const p = ronde - i
        if (p <= 0) return
        const doelY = y0 + s.r * c + c / 2
        let y = y0 - c + (doelY - y0 + c) * Math.min(1, p * p * 2.2)
        if (p * p * 2.2 > 1) y = doelY - Math.abs(Math.sin(Math.min(p - 0.67, 0.6) * Math.PI / 0.6)) * c * 0.25 * Math.max(0, 1 - (p - 0.67) * 1.6)
        const x = x0 + s.k * c + c / 2
        ctx.fillStyle = s.kleur ? '#ffd23f' : '#ff3b4f'
        ctx.beginPath(); ctx.arc(x, y, c * 0.4, 0, TAU); ctx.fill()
        ctx.fillStyle = s.kleur ? '#ffe98a' : '#ff8592'
        ctx.beginPath(); ctx.arc(x - c * 0.1, y - c * 0.1, c * 0.17, 0, TAU); ctx.fill()
    })
    // het rek met gaten (gaten uitsparen met evenodd)
    ctx.beginPath()
    rond(ctx, x0 - c * 0.2, y0 - c * 0.15, rb + c * 0.4, rh + c * 0.3, c * 0.3)
    for (let k = 0; k < kol; k++) for (let r = 0; r < rij; r++) {
        ctx.moveTo(x0 + k * c + c / 2 + c * 0.4, y0 + r * c + c / 2)
        ctx.arc(x0 + k * c + c / 2, y0 + r * c + c / 2, c * 0.4, 0, TAU, true)
    }
    ctx.fillStyle = '#1e4fd8'
    ctx.fill('evenodd')
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 3
    rond(ctx, x0 - c * 0.2, y0 - c * 0.15, rb + c * 0.4, rh + c * 0.3, c * 0.3)
    ctx.stroke()
    // pootjes
    ctx.fillStyle = '#163ea8'
    ctx.fillRect(x0 - c * 0.5, y0 + rh + c * 0.1, c * 0.5, c * 0.5)
    ctx.fillRect(x0 + rb, y0 + rh + c * 0.1, c * 0.5, c * 0.5)
}

// ── Schaken: schaakbord in perspectief, grote stukken in een spotlicht ──
function schaken(ctx, b, h, t) {
    lucht(ctx, b, h, ['#06110d', '#0d2219', '#03070a'])
    const horizon = h * 0.55
    // bord in perspectief
    const n = 8
    for (let r = 0; r < n; r++) {
        const y1 = horizon + (h - horizon) * Math.pow(r / n, 1.6), y2 = horizon + (h - horizon) * Math.pow((r + 1) / n, 1.6)
        const w1 = b * (0.5 + 1.3 * r / n), w2 = b * (0.5 + 1.3 * (r + 1) / n)
        for (let k = 0; k < n; k++) {
            ctx.fillStyle = (r + k) % 2 ? '#1c3b2d' : '#d8cfb4'
            ctx.globalAlpha = 0.25 + 0.75 * (r / n)
            ctx.beginPath()
            ctx.moveTo(b / 2 - w1 / 2 + w1 * k / n, y1)
            ctx.lineTo(b / 2 - w1 / 2 + w1 * (k + 1) / n, y1)
            ctx.lineTo(b / 2 - w2 / 2 + w2 * (k + 1) / n, y2)
            ctx.lineTo(b / 2 - w2 / 2 + w2 * k / n, y2)
            ctx.closePath()
            ctx.fill()
        }
    }
    ctx.globalAlpha = 1
    // spotlicht
    const sp = ctx.createRadialGradient(b / 2, horizon + h * 0.08, 10, b / 2, horizon + h * 0.08, b * 0.6)
    sp.addColorStop(0, 'rgba(255,236,170,0.35)')
    sp.addColorStop(1, 'rgba(255,236,170,0)')
    ctx.fillStyle = sp
    ctx.fillRect(0, 0, b, h)
    const g = Math.min(b * 0.3, h * 0.2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const stukken = [['♞', -0.3, 0.8, '#101010', '#d9c48a'], ['♚', 0.02, 1.15, '#fff6dc', '#c9a64a'], ['♛', 0.3, 0.95, '#101010', '#d9c48a']]
    stukken.forEach(([teken, dx, s, kleur, rand], i) => {
        const bob = Math.sin(t * 1.4 + i * 1.3) * g * 0.04
        ctx.font = `${Math.round(g * s)}px 'DejaVu Sans', 'Segoe UI Symbol', 'Apple Symbols', serif`
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8
        ctx.fillStyle = kleur
        ctx.fillText(teken, b / 2 + dx * b, horizon + h * 0.2 + bob)
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
        ctx.lineWidth = 2; ctx.strokeStyle = rand
        ctx.strokeText(teken, b / 2 + dx * b, horizon + h * 0.2 + bob)
    })
    // gouden stofjes
    const r = reeks(3)
    for (let i = 0; i < 30; i++) {
        const x = r() * b, y = (r() * h * 0.7 - t * 12 * (0.5 + r())) % (h * 0.7)
        ctx.fillStyle = 'rgba(255,215,120,' + (0.25 + 0.25 * Math.sin(t * 2 + i)) + ')'
        ctx.fillRect(x, (y + h * 0.7) % (h * 0.7), 2, 2)
    }
}

// ── Dammen: houten bord, schijven springen over elkaar ──
function dammen(ctx, b, h, t) {
    lucht(ctx, b, h, ['#2a1608', '#4a2a12', '#1c0e05'])
    const n = 6, c = Math.min(b * 0.92 / n, h * 0.5 / n), z = c * n, x0 = (b - z) / 2, y0 = h * 0.45
    rond(ctx, x0 - 10, y0 - 10, z + 20, z + 20, 12)
    ctx.fillStyle = '#7a4a22'
    ctx.fill()
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
        ctx.fillStyle = (r + k) % 2 ? '#5b3415' : '#ecd6ad'
        ctx.fillRect(x0 + k * c, y0 + r * c, c, c)
    }
    const schijf = (x, y, wit, s = 1, hoog = 0) => {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath(); ctx.ellipse(x, y + c * 0.12, c * 0.38 * (1 - hoog * 0.3), c * 0.18, 0, 0, TAU); ctx.fill()
        const yy = y - hoog * c
        ctx.fillStyle = wit ? '#d8d2c4' : '#141414'
        ctx.beginPath(); ctx.ellipse(x, yy + c * 0.06, c * 0.38 * s, c * 0.3 * s, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = wit ? '#fbf8f0' : '#2c2c2c'
        ctx.beginPath(); ctx.ellipse(x, yy, c * 0.38 * s, c * 0.3 * s, 0, 0, TAU); ctx.fill()
        ctx.strokeStyle = wit ? '#bdb5a3' : '#4a4a4a'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.ellipse(x, yy, c * 0.24 * s, c * 0.19 * s, 0, 0, TAU); ctx.stroke()
    }
    const mid = (k, r) => [x0 + k * c + c / 2, y0 + r * c + c / 2]
    // vaste schijven
    const zwart = [[1, 0], [3, 0], [5, 0], [0, 1], [4, 1]]
    const wit = [[0, 5], [2, 5], [4, 5], [5, 4], [1, 4]]
    // het spel: wit springt over zwart (2,3)->(4,1) en dan weer terug
    const cyclus = t % 4
    const geslagen = cyclus > 2.2
    for (const [k, r] of zwart) schijf(...mid(k, r), false)
    if (!geslagen) schijf(...mid(2, 3), false, 1 - klem((cyclus - 1.9) * 3) * 0.6)
    for (const [k, r] of wit) if (!(k === 1 && r === 4)) schijf(...mid(k, r), true)
    // springende witte schijf: (1,4) -> (3,2), boog
    const p = glad(klem((cyclus - 1) / 1.2))
    const [ax, ay] = mid(1, 4), [bx, by] = mid(3, 2)
    schijf(ax + (bx - ax) * p, ay + (by - ay) * p, true, 1, Math.sin(p * Math.PI) * 0.9)
}

// ── Neo Paddle: synthwave, zon, raster, twee batjes en een bal ──
function pong(ctx, b, h, t) {
    lucht(ctx, b, h, ['#12002b', '#3a0a5e', '#ff3d8b'])
    const horizon = h * 0.62
    sterren(ctx, b, horizon * 0.8, t, 60, 11)
    // zon met strepen
    const zr = Math.min(b, h) * 0.24, zx = b / 2, zy = horizon - zr * 0.25
    const zg = ctx.createLinearGradient(0, zy - zr, 0, zy + zr)
    zg.addColorStop(0, '#ffe66d'); zg.addColorStop(0.6, '#ff6ec7'); zg.addColorStop(1, '#ff2e88')
    ctx.save()
    ctx.beginPath(); ctx.arc(zx, zy, zr, 0, TAU); ctx.clip()
    ctx.fillStyle = zg
    ctx.fillRect(zx - zr, zy - zr, zr * 2, zr * 2)
    ctx.fillStyle = '#3a0a5e'
    for (let i = 0; i < 6; i++) {
        const y = zy + zr * (0.05 + i * 0.16) + ((t * 8) % (zr * 0.16)) - zr * 0.16
        ctx.fillRect(zx - zr, y, zr * 2, 2 + i * 1.6)
    }
    ctx.restore()
    // vloer
    ctx.fillStyle = '#0d0020'
    ctx.fillRect(0, horizon, b, h - horizon)
    ctx.strokeStyle = '#ff2fd6'
    ctx.shadowColor = '#ff2fd6'; ctx.shadowBlur = 10
    ctx.lineWidth = 1.5
    for (let i = -12; i <= 12; i++) {
        ctx.beginPath(); ctx.moveTo(b / 2 + i * 8, horizon); ctx.lineTo(b / 2 + i * b * 0.18, h); ctx.stroke()
    }
    const loop = (t * 0.6) % 1
    for (let i = 0; i < 10; i++) {
        const d = Math.pow((i + loop) / 10, 2.2)
        const y = horizon + (h - horizon) * d
        ctx.globalAlpha = d
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(b, y); ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    // batjes en bal: de bal vliegt echt van batje naar batje en kaatst terug (v2)
    const vy = h * 0.5, vh = h * 0.28, mx = b * 0.12, br = 8, bh = vh * 0.32
    const xL = mx + 6 + br, xR = b - mx - 6 - br, boven = vy - vh * 0.42, onder = vy + vh * 0.42
    const OVER = 1.25                                           // seconden van batje naar batje
    const zaag = (x, p) => { const f = ((x / p) % 2 + 2) % 2; return f < 1 ? f : 2 - f }   // 0..1..0
    const balX = tt => xL + (xR - xL) * zaag(tt, OVER)
    const balY = tt => boven + (onder - boven) * zaag(tt + 0.37, 0.83)   // kaatst ook tegen boven- en onderkant
    // een batje staat precies waar de bal hem raakt: links op 0, 2, 4.. x OVER, rechts op 1, 3, 5.. x OVER
    const batY = (eerste) => {
        const per = 2 * OVER, na = ((t - eerste) % per + per) % per
        const vorige = t - na, volgende = vorige + per
        return balY(vorige) + (balY(volgende) - balY(vorige)) * glad(klem(na / (per * 0.8)))
    }
    const raak = (eerste) => { const per = 2 * OVER, na = ((t - eerste) % per + per) % per; return Math.max(0, 1 - Math.min(na, per - na) / 0.18) }
    const batje = (x, y, kleur, licht) => {
        ctx.fillStyle = licht > 0 ? '#ffffff' : kleur; ctx.shadowColor = kleur; ctx.shadowBlur = 18 + licht * 30
        rond(ctx, x - 6, y - bh / 2, 12, bh, 6); ctx.fill()
        ctx.shadowBlur = 0
        if (licht > 0) { ctx.globalAlpha = licht; ctx.strokeStyle = kleur; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 14 + (1 - licht) * 30, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1 }
    }
    batje(mx, batY(0), '#00f0ff', raak(0))
    batje(b - mx, batY(OVER), '#ff3df2', raak(OVER))
    for (let i = 6; i >= 0; i--) {
        const tt = t - i * 0.03
        ctx.globalAlpha = 1 - i / 7
        ctx.fillStyle = '#fff'
        ctx.shadowColor = '#fff'; ctx.shadowBlur = i ? 0 : 20
        ctx.beginPath(); ctx.arc(balX(tt), balY(tt), br - i * 0.6, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0
}

// ── Ghost Tag: het doolhof, de ectoplasma-stippen en de spookjes uit het spel (v2) ──
// Het roze spookje is de jager (boos, groter) en zit het blauwe (bang) achterna; het blauwe eet de stippen op.
function pacman(ctx, b, h, t, st) {
    if (!st.ec) {
        const E = st.ec = maakEcto(2)
        // een rondje door het doolhof: kortste wegen tussen vier hoeken
        const punten = [[1, 1], [17, 3], [17, 19], [1, 19], [1, 1]]
        const pad = []
        for (let i = 0; i + 1 < punten.length; i++) {
            const [sx, sy] = punten[i], [dx, dy] = punten[i + 1]
            const vorige = new Map([[sx + ',' + sy, null]]), rij = [[sx, sy]]
            for (let k = 0; k < rij.length; k++) {
                const [x, y] = rij[k]
                if (x === dx && y === dy) break
                for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const n = (x + ax) + ',' + (y + ay)
                    if (!vorige.has(n) && E.openZonderWrap(x + ax, y + ay)) { vorige.set(n, [x, y]); rij.push([x + ax, y + ay]) }
                }
            }
            const stuk = []
            for (let p = [dx, dy]; p; p = vorige.get(p[0] + ',' + p[1])) stuk.unshift(p)
            pad.push(...stuk.slice(1))
        }
        st.pad = pad
        st.ronde = -1
    }
    const E = st.ec, pad = st.pad, L = pad.length
    const plek = (afstand) => {   // waar op het rondje, met de kijkrichting
        const a = ((afstand % L) + L) % L, i = Math.floor(a), f = a - i
        const [x1, y1] = pad[(i + L - 1) % L], [x2, y2] = pad[i]
        const kijk = x2 > x1 ? 'R' : x2 < x1 ? 'L' : y2 > y1 ? 'D' : 'U'
        return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, kijk, f >= 0.5 ? i : i - 1]   // laatste: de tegel waar hij nu is
    }
    const loop = t * 5.2   // tegels per seconde, net als in het spel
    const ronde = Math.floor(loop / L)
    if (ronde !== st.ronde) {   // een nieuw rondje: alle stippen terug
        st.ronde = ronde
        const stippen = new Uint8Array(E.KOLOM * E.RIJEN)
        for (let y = 0; y < E.RIJEN; y++) for (let x = 0; x < E.KOLOM; x++) if (E.KAART[y][x] === '.') stippen[y * E.KOLOM + x] = 1
        E.bouw(stippen)
        st.gegeten = 0
    }
    const prooi = plek(loop)
    while (st.gegeten <= prooi[3] && st.gegeten < L) {   // opgegeten stippen weg
        const [x, y] = pad[st.gegeten]; E.wisStip(x, y); st.gegeten++
    }
    ctx.fillStyle = '#07030f'; ctx.fillRect(0, 0, b, h)
    const W = E.W, HH = E.RIJEN * E.T
    const sc = Math.min(b * 0.96 / W, h * 0.56 / HH)
    const ox = (b - W * sc) / 2, oy = h * 0.31
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc)
    E.zet(ctx, t)
    ctx.drawImage(E.doolhof, 0, 0, W, HH)
    ctx.drawImage(E.stippenLaag, 0, 0, W, HH)
    E.tekenBol(9.5 * E.T, 9.5 * E.T, 1)
    const T = E.T, u = T * 0.95 / 14
    const jager = plek(loop - 3.2)
    const bang = E.meng(E.KLEUR[0], E.BANG_BLAUW, 0.55)
    E.tekenFiguur(ctx, (prooi[0] + 0.5) * T + (Math.random() - 0.5) * 0.9, (prooi[1] + 0.5) * T + Math.sin(t * 6) * 0.8, u, bang, 'bang', prooi[2], t * 7)
    E.tekenFiguur(ctx, (jager[0] + 0.5) * T, (jager[1] + 0.5) * T + Math.sin(t * 6 + 2) * 0.8, u * E.CFG.jagerGroot, E.KLEUR[1], 'boos', jager[2], t * 7 + 1.3)
    ctx.restore()
}

// ── Block It: precies zoals in het spel. Een steen valt, maakt een vierkant van 3x3 en dat knalt ──
// Dezelfde blokjes, bak, gloed, deeltjes, ringen, flits, schok en tekst '+1 PUNT!' als in blockit-ui.js.
const BLOK = [['#ff4d6d', '#ff9aae', '#9d1537'], ['#ffb627', '#ffd98a', '#a86a0c'], ['#2ee6a6', '#98f6d4', '#0b8560'], ['#4d9dff', '#a5ccff', '#1c49b8']]
function blok(ctx, x, y, s, k, alpha = 1, schaal = 1) {   // tekenBlok uit blockit-ui.js
    const [basis, licht, donker] = BLOK[k]
    const g = Math.max(1, s * 0.05)
    const bs = s * schaal - g * 2
    const bx = x + (s - s * schaal) / 2 + g, by = y + (s - s * schaal) / 2 + g
    const bev = Math.max(2, bs * 0.17)
    ctx.globalAlpha = alpha
    ctx.fillStyle = donker; ctx.fillRect(bx, by, bs, bs)
    ctx.fillStyle = licht
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bs, by); ctx.lineTo(bx + bs - bev, by + bev); ctx.lineTo(bx + bev, by + bev); ctx.lineTo(bx + bev, by + bs - bev); ctx.lineTo(bx, by + bs); ctx.closePath(); ctx.fill()
    ctx.fillStyle = basis; ctx.fillRect(bx + bev, by + bev, bs - bev * 2, bs - bev * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(bx + bev, by + bev, bs - bev * 2, (bs - bev * 2) * 0.38)
    ctx.globalAlpha = 1
}
const BI_KOL = 10, BI_RIJ = 14, BI_LUS = 3.4
// de stapel (bovenaan = hoger in de bak); '.' = leeg. In kolom 3-5 ligt bijna een vierkant van mint (2).
const BI_STAPEL = ['0.......1.', '331...0130', '3102221301', '1102223013']
const BI_L = [[0, 1], [1, 1], [2, 1], [2, 0]]    // de L-steen uit het spel, in mint
function breakout(ctx, b, h, t, st) {
    lucht(ctx, b, h, ['#1a0a2e', '#231044', '#120724'])
    const c = Math.floor(Math.min(b * 0.86 / BI_KOL, h * 0.5 / BI_RIJ))
    const gb = c * BI_KOL, gh = c * BI_RIJ, gx = Math.round((b - gb) / 2), gy = Math.round(h * 0.34)
    const lt = t % BI_LUS
    // het rooster op dit moment
    const r = Array.from({ length: BI_RIJ }, () => new Array(BI_KOL).fill(null))
    BI_STAPEL.forEach((rij, i) => [...rij].forEach((k, x) => { if (k !== '.') r[BI_RIJ - BI_STAPEL.length + i][x] = Number(k) }))
    const LAND = 1.0, KNAL = 1.16
    const yNu = Math.max(0, Math.min(10, Math.floor((lt - 0.2) / 0.08)))
    const xNu = lt < 0.3 ? 6 : lt < 0.45 ? 5 : lt < 0.6 ? 4 : 3
    const stuk = lt < LAND ? BI_L.map(([cx, cy]) => [xNu + cx, yNu + cy]) : null
    const geland = BI_L.map(([cx, cy]) => [3 + cx, 10 + cy])
    if (lt >= LAND && lt < KNAL) for (const [x, y] of geland) r[y][x] = 2
    if (lt >= KNAL) {   // vierkant weg, de rest valt (laatVallen)
        for (let y = 11; y < 14; y++) for (let x = 3; x < 6; x++) r[y][x] = null
        r[13][5] = 2
    }
    // schok (schud) en dreun, zoals schok(0.35)
    let schud = 0
    if (lt >= KNAL) schud = Math.max(0, 0.35 - (lt - KNAL) * 1.8)
    ctx.save()
    if (schud > 0) { const kr = schud * schud * c * 0.9; ctx.translate((Math.random() * 2 - 1) * kr, (Math.random() * 2 - 1) * kr) }
    // de bak (tekenBak)
    rond(ctx, gx - 5, gy - 5, gb + 10, gh + 10, 10)
    ctx.fillStyle = 'rgba(8,4,22,0.85)'; ctx.fill()
    ctx.strokeStyle = 'rgba(198,184,255,0.2)'; ctx.lineWidth = 2; ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1
    for (let x = 1; x < BI_KOL; x++) { ctx.beginPath(); ctx.moveTo(gx + x * c + 0.5, gy); ctx.lineTo(gx + x * c + 0.5, gy + gh); ctx.stroke() }
    // rode stippellijn bovenaan (tekenGrens)
    ctx.save(); ctx.strokeStyle = '#ff3c5a'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.globalAlpha = 0.45
    ctx.beginPath(); ctx.moveTo(gx, gy + 0.5); ctx.lineTo(gx + gb, gy + 0.5); ctx.stroke(); ctx.restore()
    // vervagen aan het eind van de lus
    const zicht = lt > BI_LUS - 0.45 ? Math.max(0, (BI_LUS - lt) / 0.45) : lt < 0.15 ? lt / 0.15 : 1
    const pop = lt >= LAND && lt < KNAL ? 1 - (lt - LAND) * 5 : 0
    for (let y = 0; y < BI_RIJ; y++) for (let x = 0; x < BI_KOL; x++) {
        if (r[y][x] === null) continue
        const isNieuw = lt >= LAND && lt < KNAL && geland.some(([gx2, gy2]) => gx2 === x && gy2 === y)
        blok(ctx, gx + x * c, gy + y * c, c, r[y][x], zicht, isNieuw ? 1 + Math.max(0, pop) * 0.12 : 1)
    }
    if (stuk) {
        // gloed onder je steen (tekenHalo), schaduw (stippels) en de steen zelf met een lichtende rand (tekenContour)
        const KL = '#c6b8ff', puls = 0.55 + 0.45 * Math.sin(t * 1000 / 180)
        ctx.save(); ctx.shadowColor = KL; ctx.shadowBlur = c * (0.6 + 0.5 * puls); ctx.fillStyle = KL; ctx.globalAlpha = 0.35 + 0.25 * puls
        for (const [x, y] of stuk) ctx.fillRect(gx + x * c, gy + y * c, c, c)
        ctx.restore()
        ctx.save(); ctx.strokeStyle = KL; ctx.globalAlpha = 0.45; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5
        for (const [x, y] of BI_L.map(([cx, cy]) => [xNu + cx, 10 + cy])) ctx.strokeRect(gx + x * c + 3, gy + y * c + 3, c - 6, c - 6)
        ctx.restore()
        for (const [x, y] of stuk) blok(ctx, gx + x * c, gy + y * c, c, 2)
        const bezet = new Set(stuk.map(([x, y]) => x + ',' + y))
        ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = KL; ctx.shadowColor = KL; ctx.shadowBlur = c * 0.5 * puls + 4
        ctx.lineWidth = Math.max(2, c * 0.12); ctx.globalAlpha = 0.75 + 0.25 * puls; ctx.beginPath()
        for (const [x, y] of stuk) {
            const X = gx + x * c, Y = gy + y * c
            if (!bezet.has(x + ',' + (y - 1))) { ctx.moveTo(X, Y); ctx.lineTo(X + c, Y) }
            if (!bezet.has(x + ',' + (y + 1))) { ctx.moveTo(X, Y + c); ctx.lineTo(X + c, Y + c) }
            if (!bezet.has((x - 1) + ',' + y)) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + c) }
            if (!bezet.has((x + 1) + ',' + y)) { ctx.moveTo(X + c, Y); ctx.lineTo(X + c, Y + c) }
        }
        ctx.stroke(); ctx.restore()
    }
    // de knal (speelEffecten, soort 'vierkant'): deeltjes, ringen, tekst
    if (lt >= KNAL) {
        const s = lt - KNAL
        const [basis, licht] = BLOK[2]
        const mx = gx + 4.5 * c, my = gy + 12.5 * c
        const rr = reeks(Math.floor(t / BI_LUS) + 5)
        for (let y = 11; y < 14; y++) for (let x = 3; x < 6; x++) for (let i = 0; i < 5; i++) {   // spat(): 5 per blokje
            const hoek = rr() * TAU, snel = 2 + rr() * 6, grootte = 0.18 + rr() * 0.22
            const leven = 1 - s * 1.4
            if (leven <= 0) continue
            const px = x + 0.5 + Math.cos(hoek) * snel * s, py = y + 0.5 + (Math.sin(hoek) * snel - 3) * s + 9 * s * s
            const m = grootte * c * Math.max(0.2, leven)
            ctx.globalAlpha = Math.min(1, leven * 1.5); ctx.fillStyle = licht
            ctx.fillRect(gx + px * c - m / 2, gy + py * c - m / 2, m, m)
        }
        for (const [max, kleur] of [[3 * 0.9, basis], [3 + 1.5, 'rgba(255,255,255,0.7)']]) {   // twee ringen
            const leven = 1 - s * 2.2
            if (leven <= 0) continue
            ctx.globalAlpha = leven; ctx.strokeStyle = kleur; ctx.lineWidth = Math.max(1, c * 0.35 * leven)
            ctx.beginPath(); ctx.arc(mx, my, (1 - leven) * max * c, 0, TAU); ctx.stroke()
        }
        const tl = 1 - s * 0.9   // zwevende tekst '+1 PUNT!'
        if (tl > 0) {
            const maat = Math.max(11, Math.round(c * 0.95))
            ctx.font = '700 ' + maat + "px 'Chakra Petch', 'Segoe UI', system-ui, sans-serif"
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.globalAlpha = Math.min(1, tl * 2); ctx.lineWidth = Math.max(3, maat * 0.16); ctx.strokeStyle = 'rgba(13,8,32,0.9)'
            const tekst = vertaalTekst('+{n} PUNT!', { n: 1 })
            ctx.strokeText(tekst, mx, my - s * 1.2 * c); ctx.fillStyle = basis; ctx.fillText(tekst, mx, my - s * 1.2 * c)
            ctx.textBaseline = 'alphabetic'
        }
        ctx.globalAlpha = 1
    }
    ctx.restore()
    // flits over alles (kleur van het vierkant, 0.22)
    if (lt >= KNAL && lt < KNAL + 0.1) { ctx.globalAlpha = 0.22 - (lt - KNAL) * 2.2; ctx.fillStyle = BLOK[2][0]; ctx.fillRect(0, 0, b, h); ctx.globalAlpha = 1 }
    void st
}
const vertaalTekst = (s, v) => (typeof window !== 'undefined' && window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)))

// Een pixelwereld (vaste maat) zo groot mogelijk op het scherm, zonder zachte randen (pixelart blijft scherp)
function pixelsOpScherm(ctx, wereld, b, h, vullen = true) {
    const s = vullen ? Math.max(b / wereld.width, h / wereld.height) : Math.min(b / wereld.width, h / wereld.height)
    const w = wereld.width * s, hh = wereld.height * s
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(wereld, (b - w) / 2, (h - hh) / 2, w, hh)
    ctx.imageSmoothingEnabled = true
    return { s, x: (b - w) / 2, y: (h - hh) / 2 }
}

// ── The Swarm: het huis uit level 1, de beestjes en de held, in de pixels van het spel ──
function swarm(ctx, b, h, t, st) {
    if (!st.sw) {
        st.sw = maakSwarm()
        st.wereld = st.sw.mk(st.sw.W, st.sw.H)
        st.spat = []
        st.volgendeSpat = 1.2
    }
    const S = st.sw, W = S.W, H = S.H, q = st.wereld.getContext('2d')
    const tik = Math.floor(t * 8)
    q.clearRect(0, 0, W, H)
    q.drawImage(S.bg, 0, 0)
    for (const [c, x] of S.dekking) q.drawImage(c, x, H - 2 - c.height)
    q.fillStyle = 'rgba(140,0,30,0.10)'; q.fillRect(0, 0, W, H)   // de tint van level 1
    const teken = (s, x, y, ga) => {   // draw() uit swarm-ui.js
        const X = Math.round(x - s.w / 2 - s.p), Y = Math.round(y - s.h / 2 - s.p)
        if (ga > 0) { q.globalAlpha = Math.min(1, ga); q.drawImage(s.g, X, Y); q.globalAlpha = 1 }
        q.drawImage(s.b, X, Y)
    }
    // de zwerm: elk beestje vliegt zijn eigen rondje
    const soorten = ['sp', 'hg', 'ws', 'hg', 'mt', 'kv', 'sl', 'hg', 'ws', 'sp', 'br', 'hg']
    const plekken = soorten.map((ty, i) => {
        const fase = t * (0.45 + (i % 4) * 0.12) * (i % 2 ? 1 : -1) + i * 1.9
        return [ty, W / 2 + Math.cos(fase) * (24 + (i % 5) * 9) + Math.sin(t * 1.7 + i) * 4, 52 + Math.sin(fase * 1.3) * (16 + (i % 3) * 8) + (ty === 'br' ? -8 : 0)]
    })
    for (const [ty, x, y] of plekken) teken((tik + Math.round(x)) % 2 ? S.TY[ty].A : S.TY[ty].B, x, y, 0.6)
    // de held loopt heen en weer en schiet
    const hx = W / 2 + Math.sin(t * 0.9) * 38, hy = H - 14
    teken(Math.cos(t * 0.9) !== 0 && tik % 2 ? S.held.A : S.held.B, hx, hy, 0.5)
    q.fillStyle = '#2ee8ff'
    for (let i = 0; i < 4; i++) {
        const v = (t * 1.6 + i * 0.25) % 1
        const sx = Math.round(W / 2 + Math.sin((t - v * 0.6) * 0.9) * 38 + 5), sy = Math.round(hy - 10 - v * 130)
        q.globalAlpha = 0.35; q.fillRect(sx - 1, sy - 1, 3, 5); q.globalAlpha = 1
        q.fillRect(sx, sy, 1, 3)
    }
    // af en toe een groene spat (slijm), zoals splat()
    if (t > st.volgendeSpat) {
        const [, x, y] = plekken[Math.floor(t * 7) % plekken.length]
        for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, v = 0.3 + Math.random() * 1.6; st.spat.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - Math.random(), l: 60 + Math.random() * 50, land: Math.min(H - 3, y + 15 + Math.random() * 55), c: S.SLIME[i % 5], s: Math.random() < 0.35 ? 2 : 1 }) }
        st.volgendeSpat = t + 0.9 + Math.random() * 0.8
    }
    for (const p of st.spat) {
        if (p.y < p.land) { p.x += p.vx; p.y += p.vy; p.vy += 0.08 } else p.y = p.land
        p.l -= 0.6
        q.globalAlpha = Math.max(0, Math.min(1, p.l / 30)); q.fillStyle = p.c; q.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s)
    }
    q.globalAlpha = 1
    st.spat = st.spat.filter(p => p.l > 0)
    // groot op het scherm, met de scanlijnen en de donkere randen van het spel
    ctx.fillStyle = '#15101c'; ctx.fillRect(0, 0, b, h)
    pixelsOpScherm(ctx, st.wereld, b, h)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, b, 1)
    const vg = ctx.createRadialGradient(b / 2, h / 2, Math.min(b, h) * 0.3, b / 2, h / 2, Math.max(b, h) * 0.65)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, b, h)
}
// De titel zoals in het spel: THE (rood neon), SWARM (groen, met druppels), 'samen tegen de zwerm'
function swarmTitel(ctx, b, h, t) {
    const maat = Math.min(b * 0.2, h * 0.1)
    const y = h * 0.2
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y - maat * 1.2, b, maat * 2.5)
    ctx.font = '900 ' + Math.round(maat * 0.36) + "px 'Courier New', monospace"
    spatie(ctx, 'THE', b / 2, y - maat * 0.82, maat * 0.19, '#ff3050', '#ff1030')
    ctx.font = '900 ' + Math.round(maat) + "px 'Courier New', monospace"
    // druppels onder SWARM
    const breed = ctx.measureText('SWARM').width + maat * 0.1 * 4
    const r = reeks(13)
    for (let i = 0; i < 13; i++) {
        const dx = b / 2 - breed / 2 + 6 + i * (breed - 12) / 12 + r() * 3, lang = (5 + r() * 15) * maat / 42
        const sch = 0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI / (1.6 + r() * 1.5) + i))
        const g = ctx.createLinearGradient(0, y + maat * 0.4, 0, y + maat * 0.4 + lang * sch)
        g.addColorStop(0, '#b6ff3a'); g.addColorStop(1, '#3a9a00')
        ctx.fillStyle = g; rond(ctx, dx, y + maat * 0.38, 3, lang * sch + 1, 1.5); ctx.fill()
    }
    ctx.fillStyle = '#1a4a00'
    spatie(ctx, 'SWARM', b / 2, y + 3, maat * 0.1, '#1a4a00', null)
    spatie(ctx, 'SWARM', b / 2, y, maat * 0.1, '#b6ff3a', '#6dff1a')
    ctx.font = Math.round(Math.max(12, maat * 0.29)) + "px 'Courier New', monospace"
    ctx.fillStyle = '#ffb0c0'
    ctx.fillText(vertaalTekst('samen tegen de zwerm'), b / 2, y + maat * 1.0)
    ctx.textBaseline = 'alphabetic'
}
// tekst met letterafstand en neongloed (zoals letter-spacing en text-shadow in het spel)
function spatie(ctx, tekst, x, y, afstand, kleur, gloed) {
    const letters = [...tekst], breedtes = letters.map(l => ctx.measureText(l).width)
    let px = x - (breedtes.reduce((a, b) => a + b, 0) + afstand * (letters.length - 1)) / 2
    ctx.textAlign = 'left'
    for (let i = 0; i < letters.length; i++) {
        if (gloed) { ctx.shadowColor = gloed; ctx.shadowBlur = 16; ctx.fillStyle = kleur; ctx.fillText(letters[i], px, y); ctx.shadowBlur = 5 }
        ctx.fillStyle = kleur; ctx.fillText(letters[i], px, y)
        ctx.shadowBlur = 0
        px += breedtes[i] + afstand
    }
    ctx.textAlign = 'center'
}

// ── Twin Snakes: twee slangen kronkelen door de jungle ──
function pinball(ctx, b, h, t) {
    lucht(ctx, b, h, ['#062b1c', '#0d3d22', '#03140c'])
    // bladeren
    const r = reeks(8)
    for (let i = 0; i < 18; i++) {
        const x = r() * b, y = r() * h, s = 30 + r() * 50, hoek = r() * TAU + Math.sin(t * 0.7 + i) * 0.1
        ctx.save(); ctx.translate(x, y); ctx.rotate(hoek)
        ctx.fillStyle = i % 2 ? 'rgba(40,120,60,0.45)' : 'rgba(25,90,45,0.5)'
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.35, 0, 0, TAU); ctx.fill()
        ctx.restore()
    }
    // appel
    const ax = b * 0.5, ay = h * 0.66 + Math.sin(t * 3) * 4
    ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(ax - 6, ay, 14, 0, TAU); ctx.arc(ax + 6, ay, 14, 0, TAU); ctx.fill()
    ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.arc(ax - 9, ay - 5, 4, 0, TAU); ctx.fill()
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay - 12); ctx.lineTo(ax + 3, ay - 22); ctx.stroke()
    ctx.fillStyle = '#3fd16b'; ctx.beginPath(); ctx.ellipse(ax + 9, ay - 20, 7, 3.5, -0.4, 0, TAU); ctx.fill()
    const slang = (kleur, licht, fase, yy, richting) => {
        const n = 26, s = Math.min(b, h) * 0.034
        const punten = []
        for (let i = 0; i < n; i++) {
            const u = (t * 0.22 + fase - i * 0.018) % 1   // v2: de kop gaat altijd voorop (de tweede slang gespiegeld)
            const uu = (u + 1) % 1
            const x = -s * 4 + uu * (b + s * 8)
            const y = yy + Math.sin(uu * 12 + t * 0.3) * h * 0.06
            punten.push([richting > 0 ? x : b - x, y])
        }
        for (let i = n - 1; i >= 0; i--) {
            const [x, y] = punten[i]
            const s2 = s * (i === 0 ? 1.35 : 1 - i / n * 0.45)
            ctx.fillStyle = i % 3 === 0 ? licht : kleur
            ctx.beginPath(); ctx.arc(x, y, s2, 0, TAU); ctx.fill()
        }
        const [kx, ky] = punten[0], [nx, ny] = punten[1]
        const hoek = Math.atan2(ky - ny, kx - nx)
        ctx.save(); ctx.translate(kx, ky); ctx.rotate(hoek)
        ctx.fillStyle = '#fff'
        for (const z of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.4, z * s * 0.55, s * 0.38, 0, TAU); ctx.fill() }
        ctx.fillStyle = '#000'
        for (const z of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.55, z * s * 0.55, s * 0.18, 0, TAU); ctx.fill() }
        if (Math.sin(t * 6 + fase * 10) > 0.3) {
            ctx.strokeStyle = '#ff3b6b'; ctx.lineWidth = 2
            ctx.beginPath(); ctx.moveTo(s * 1.3, 0); ctx.lineTo(s * 2.1, 0); ctx.lineTo(s * 2.4, -s * 0.3); ctx.moveTo(s * 2.1, 0); ctx.lineTo(s * 2.4, s * 0.3); ctx.stroke()
        }
        ctx.restore()
    }
    slang('#2ee66b', '#b6ff7a', 0.1, h * 0.55, 1)
    slang('#a35cff', '#f0a8ff', 0.6, h * 0.78, -1)
}

// ── Flapper: een vleermuis fladdert door een grot bij volle maan ──
function flappybird(ctx, b, h, t) {
    lucht(ctx, b, h, ['#0b0624', '#24124a', '#0b0624'])
    sterren(ctx, b, h * 0.6, t, 40, 17)
    const mx = b * 0.75, my = h * 0.3, mr = Math.min(b, h) * 0.13
    const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 2.6)
    mg.addColorStop(0, 'rgba(255,250,220,0.35)'); mg.addColorStop(1, 'rgba(255,250,220,0)')
    ctx.fillStyle = mg; ctx.fillRect(0, 0, b, h)
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill()
    ctx.fillStyle = 'rgba(200,190,160,0.5)'
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.15, 0.14], [-0.1, 0.35, 0.1]]) { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); ctx.fill() }
    // druipstenen boven en onder, schuiven naar links
    const pilaar = (x, w, boven, lengte) => {
        ctx.fillStyle = '#1a0f33'
        ctx.beginPath()
        if (boven) { ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 0.55, lengte); ctx.lineTo(x + w * 0.4, lengte * 0.92) }
        else { ctx.moveTo(x, h); ctx.lineTo(x + w, h); ctx.lineTo(x + w * 0.5, h - lengte) }
        ctx.closePath(); ctx.fill()
        ctx.strokeStyle = 'rgba(160,120,255,0.25)'; ctx.lineWidth = 2; ctx.stroke()
    }
    const r = reeks(12)
    const stenen = Array.from({ length: 14 }, () => [r() * 1.6, 40 + r() * 50, r() < 0.5, h * (0.12 + r() * 0.2)])
    for (const [p, w, boven, lengte] of stenen) {
        const x = ((p * b - t * 60) % (b * 1.6) + b * 1.6) % (b * 1.6) - w
        pilaar(x, w, boven, lengte)
    }
    // vleermuis
    const bx = b * 0.4 + Math.sin(t * 0.8) * b * 0.12, by = h * 0.58 + Math.sin(t * 2.1) * h * 0.06
    const s = Math.min(b, h) * 0.15
    const klap = Math.sin(t * 13)
    ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(t * 2.1) * 0.15)
    ctx.shadowColor = '#b48cff'; ctx.shadowBlur = 24
    ctx.fillStyle = '#4a2f6e'
    for (const z of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(z * s * 0.25, -s * 0.1)
        ctx.quadraticCurveTo(z * s * 1.1, -s * (0.9 * klap + 0.2), z * s * 1.8, -s * 0.5 * klap)
        ctx.lineTo(z * s * 1.4, s * 0.1)
        ctx.lineTo(z * s * 1.05, -s * 0.05)
        ctx.lineTo(z * s * 0.75, s * 0.2)
        ctx.lineTo(z * s * 0.45, s * 0.05)
        ctx.closePath(); ctx.fill()
    }
    ctx.shadowBlur = 0
    ctx.fillStyle = '#5c3d86'
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.5, 0, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.35); ctx.lineTo(-s * 0.18, -s * 0.8); ctx.lineTo(-s * 0.05, -s * 0.42); ctx.moveTo(s * 0.3, -s * 0.35); ctx.lineTo(s * 0.18, -s * 0.8); ctx.lineTo(s * 0.05, -s * 0.42); ctx.fill()
    ctx.fillStyle = '#ffe14d'
    for (const z of [-1, 1]) { ctx.beginPath(); ctx.arc(z * s * 0.15, -s * 0.12, s * 0.09, 0, TAU); ctx.fill() }
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.12); ctx.lineTo(-s * 0.05, s * 0.24); ctx.lineTo(0, s * 0.12); ctx.moveTo(s * 0.1, s * 0.12); ctx.lineTo(s * 0.05, s * 0.24); ctx.lineTo(0, s * 0.12); ctx.fill()
    ctx.restore()
}

// ── Runner & Gunner: de neonstad uit het spel, Runner en Gunner rennen en schieten ──
function endlessrunner(ctx, b, h, t, st) {
    if (!st.rg) st.rg = maakRunner()
    const G = st.rg
    // schaal: de laag van 360 hoog vult het onderste deel van het scherm; hele beeldpunten op het toestel
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 2) : 1
    const k = Math.max(1, Math.round(h * 0.78 / G.LAAG_H * dpr)) / dpr
    const top = h - G.LAAG_H * k
    const zichtbaar = b / k
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = G.STAD.lucht[0]; ctx.fillRect(0, 0, b, Math.ceil(top) + 1)
    const tegel = (beeld, snelheid, breed) => {
        const schuif = (t * snelheid) % breed
        for (let x = -schuif; x < zichtbaar; x += breed) ctx.drawImage(beeld, Math.floor(x * k), top, breed * k, G.LAAG_H * k)
    }
    tegel(G.lucht, 4, 320)
    tegel(G.ver, 18, G.LAAG_B)
    tegel(G.dicht, 45, G.LAAG_B)
    // de grond: tegels van 32, de bovenste rij en daaronder
    const schuif = (t * 150) % 32
    for (let x = -schuif; x < zichtbaar; x += 32) {
        ctx.drawImage(G.grondT, Math.floor(x * k), top + G.GROND_Y * k, 32 * k, 32 * k)
        ctx.drawImage(G.grondB, Math.floor(x * k), top + (G.GROND_Y + 32) * k, 32 * k, 32 * k)
        ctx.drawImage(G.grondB, Math.floor(x * k), top + (G.GROND_Y + 64) * k, 32 * k, 32 * k)
    }
    // Runner en Gunner, 8 loopbeeldjes per seconde ronde
    const nr = Math.floor(t * 12) % 8
    const voet = top + (G.GROND_Y + 2) * k
    const plaats = (beelden, x) => { const im = beelden[nr]; ctx.drawImage(im, Math.round(x * k), Math.round(voet - im.height * k), im.width * k, im.height * k); return im }
    const rx = zichtbaar * 0.12, gx2 = zichtbaar * 0.12 + 58
    plaats(G.runner, rx)
    plaats(G.gunner, gx2)
    // kogels uit de lopen (cyaan van Runner, oranje van Gunner)
    for (let i = 0; i < 3; i++) {
        const v = (t * 1.8 + i / 3) % 1
        ctx.drawImage(G.kogelR, Math.round((rx + 40 + v * zichtbaar) * k), Math.round(voet - 34 * k), 12 * k, 6 * k)
        const w = (t * 1.5 + i / 3 + 0.15) % 1
        ctx.drawImage(G.kogelG, Math.round((gx2 + 46 + w * zichtbaar) * k), Math.round(voet - 36 * k), 10 * k, 10 * k)
    }
    ctx.imageSmoothingEnabled = true
}
function runnerTitel(ctx, b, h, t) {
    const maat = Math.max(12, Math.min(b * 0.075, h * 0.05))
    ctx.font = Math.round(maat) + "px 'Press Start 2P', monospace"
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const y = h * 0.14 + Math.sin(t * 2) * 2
    for (const [tekst, dy] of [['RUNNER', -maat * 0.9], ['& GUNNER', maat * 0.9]]) {
        ctx.fillStyle = '#0b1020'; ctx.fillText(tekst, b / 2 + maat * 0.18, y + dy + maat * 0.18)   // text-shadow 2px 2px 0 #0b1020
        ctx.fillStyle = '#5ee7e0'; ctx.fillText(tekst, b / 2, y + dy)
    }
    ctx.font = Math.round(maat * 0.42) + "px 'Press Start 2P', monospace"
    ctx.fillStyle = '#ff3d9a'
    ctx.fillText(vertaalTekst('NEON STAD'), b / 2, y + maat * 2.4)
    ctx.textBaseline = 'alphabetic'
}

// ── Neon Raiders: de ruimte uit level 3, het schip, de vijanden en de laser uit het spel ──
function shmup(ctx, b, h, t, st) {
    if (!st.nr) st.nr = maakNeon()
    const { tex, lagen } = st.nr
    const s = Math.max(b / 360, h / 640)
    const ox = (b - 360 * s) / 2, oy = (h - 640 * s) / 2
    ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s)
    for (const laag of lagen) {
        const T = tex[laag.key]
        if (!T) continue
        ctx.globalAlpha = laag.alpha || 1
        ctx.globalCompositeOperation = laag.add ? 'lighter' : 'source-over'
        if (laag.vast) { ctx.drawImage(T.c, 0, 0, T.b, T.h); continue }
        const y = (t * laag.v) % T.h
        ctx.drawImage(T.c, 0, y - T.h, T.b, T.h)
        ctx.drawImage(T.c, 0, y, T.b, T.h)
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
    const zet = (key, x, y, schaal = 1) => { const T = tex[key]; ctx.drawImage(T.c, x - T.b * schaal / 2, y - T.h * schaal / 2, T.b * schaal, T.h * schaal) }
    // vijanden in een V, ze zakken langzaam en wiebelen
    for (let i = 0; i < 7; i++) {
        const rij = Math.abs(i - 3)
        const x = 180 + (i - 3) * 40 + Math.sin(t * 1.6 + i) * 6
        const y = 250 - rij * 26 + Math.sin(t * 2 + i * 0.7) * 8
        zet(i % 2 ? 'dart_zwart' : 'dart_rood', x, y, 1.15)
    }
    // het schip met vlam en lasers
    const sx = 180 + Math.sin(t * 1.1) * 70, sy = 520
    for (let i = 0; i < 6; i++) {
        const v = (t * 2.6 + i / 6) % 1
        const lx = 180 + Math.sin((t - v * 0.35) * 1.1) * 70
        zet('puls', lx - 7, sy - 30 - v * 330); zet('puls', lx + 7, sy - 30 - v * 330)
    }
    zet(Math.floor(t * 20) % 2 ? 'vlam0' : 'vlam1', sx, sy + 28)
    zet('schip', sx, sy, 1.2)
    ctx.restore()
}
function neonTitel(ctx, b, h, t) {
    const maat = Math.max(14, Math.min(b * 0.09, h * 0.05))
    ctx.font = Math.round(maat) + "px 'Press Start 2P', monospace"
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const y = h * 0.15
    const neon = (tekst, yy, kleur) => {   // text-shadow 0 0 4px, 0 0 12px, 0 0 28px in de kleur
        ctx.fillStyle = '#ffffff'
        for (const blur of [28, 12, 4]) { ctx.shadowColor = kleur; ctx.shadowBlur = blur * (0.85 + 0.15 * Math.sin(t * 3)); ctx.fillText(tekst, b / 2, yy) }
        ctx.shadowBlur = 0; ctx.fillText(tekst, b / 2, yy)
    }
    neon('NEON', y - maat * 0.8, '#ff5d9e')
    neon('RAIDERS', y + maat * 0.8, '#5ee7e0')
    ctx.textBaseline = 'alphabetic'
}

// Lettertype (bestand in lettertypen/), kleuren van de titel, en de tekening
export const SCENES = {
    botkaaseiren: { font: 'Chewy', css: 'chewy', titel: '#fff1d6', rand: '#4a2509', gloed: '#ffb35a', teken: botkaaseiren },
    vieroprij: { font: 'Titan One', css: 'titan-one', titel: '#ffd23f', rand: '#1e4fd8', gloed: '#ffffff', teken: vieroprij },
    schaken: { font: 'Cinzel Decorative', css: 'cinzel-decorative', titel: '#f3dc96', rand: '#2b1d05', gloed: '#d9a83a', teken: schaken },
    dammen: { font: 'Cinzel', css: 'cinzel', titel: '#fbf3df', rand: '#2a1608', gloed: '#c98a3e', teken: dammen },
    pong: { font: 'Monoton', css: 'monoton', titel: '#7af7ff', rand: '#12002b', gloed: '#ff3df2', teken: pong },
    pacman: { font: 'Creepster', css: 'creepster', titel: '#7dff6a', rand: '#150a26', gloed: '#b44dff', teken: pacman },
    breakout: { font: 'Bungee', css: 'bungee', titel: '#c6b8ff', rand: '#1a0a2e', gloed: '#ff4d6d', teken: breakout },
    swarm: { font: 'Courier New', titel: '#b6ff3a', rand: '#1a4a00', gloed: '#6dff1a', teken: swarm, eigenTitel: swarmTitel },
    pinball: { font: 'Bagel Fat One', css: 'bagel-fat-one', titel: '#b6ff7a', rand: '#14301c', gloed: '#a35cff', teken: pinball },
    endlessrunner: { font: 'Press Start 2P', css: 'press-start-2p', titel: '#5ee7e0', rand: '#0b1020', gloed: '#ff3d9a', teken: endlessrunner, eigenTitel: runnerTitel },
    flappybird: { font: 'Fascinate', css: 'fascinate', titel: '#e9d8ff', rand: '#120830', gloed: '#a07aff', teken: flappybird },
    shmup: { font: 'Press Start 2P', css: 'press-start-2p', titel: '#ffffff', rand: '#07051a', gloed: '#5ee7e0', teken: shmup, eigenTitel: neonTitel }
}
SCENES.schakendrie = SCENES.schaken
