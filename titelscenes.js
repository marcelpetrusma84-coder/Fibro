// titelscenes.js - de bewegende plaatjes van de titelschermen (v1, 2 nov 2026)
//
// In gewone woorden: voor elk spel een tekening in code (dus altijd scherp, op elk scherm) die een beetje beweegt.
// teken(ctx, b, h, t, st): b x h = grootte in beeldpunten, t = seconden sinds het begin, st = een eigen kladblok.
// De naam van het spel tekent titelscherm.js er bovenop (in het lettertype en de kleuren van 'titel').
// Geen ctx.filter: dat kent Safari op de iPhone niet.

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
    // batjes en bal (in het midden van het scherm, boven de vloer)
    const vy = h * 0.5, vh = h * 0.28, mx = b * 0.12
    const bx = b / 2 + Math.sin(t * 1.7) * (b / 2 - mx - 22)
    const by = vy + Math.sin(t * 2.9) * vh * 0.4
    const batje = (x, y, kleur) => {
        ctx.fillStyle = kleur; ctx.shadowColor = kleur; ctx.shadowBlur = 18
        rond(ctx, x - 6, y - vh * 0.16, 12, vh * 0.32, 6); ctx.fill()
        ctx.shadowBlur = 0
    }
    batje(mx, vy + Math.sin(t * 2.9 - 0.4) * vh * 0.35, '#00f0ff')
    batje(b - mx, vy + Math.sin(t * 2.9 + 0.3) * vh * 0.35, '#ff3df2')
    for (let i = 6; i >= 0; i--) {
        const tt = t - i * 0.03
        ctx.globalAlpha = 1 - i / 7
        ctx.fillStyle = '#fff'
        ctx.shadowColor = '#fff'; ctx.shadowBlur = i ? 0 : 20
        ctx.beginPath(); ctx.arc(b / 2 + Math.sin(tt * 1.7) * (b / 2 - mx - 22), vy + Math.sin(tt * 2.9) * vh * 0.4, 8 - i * 0.6, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0
    void bx; void by
}

// ── Ghost Tag: nacht, een doolhof van neon en zwevende spookjes ──
function pacman(ctx, b, h, t) {
    lucht(ctx, b, h, ['#02021a', '#0a0a3a', '#02021a'])
    const c = Math.max(26, Math.min(b, h) / 12)
    ctx.strokeStyle = '#2f5bff'
    ctx.shadowColor = '#2f5bff'; ctx.shadowBlur = 12
    ctx.lineWidth = 3
    const r = reeks(5)
    for (let y = 0; y < h / c; y++) for (let x = 0; x < b / c; x++) {
        if (r() < 0.22) { rond(ctx, x * c + 6, y * c + 6, c - 12, c * (r() < 0.5 ? 1 : 2) - 12, 8); ctx.stroke() }
    }
    ctx.shadowBlur = 0
    // bolletjes
    ctx.fillStyle = '#ffd9a8'
    for (let i = 0; i < 14; i++) {
        const x = b * 0.08 + i * (b * 0.84 / 13)
        if ((t * 2.5 - i * 0.4) % 6 < 3.2) continue
        ctx.beginPath(); ctx.arc(x, h * 0.73, 4, 0, TAU); ctx.fill()
    }
    const spook = (x, y, kleur, kijk) => {
        const s = Math.min(b, h) * 0.11
        ctx.fillStyle = kleur
        ctx.shadowColor = kleur; ctx.shadowBlur = 22
        ctx.beginPath()
        ctx.arc(x, y, s, Math.PI, 0)
        const golf = 4
        for (let i = 0; i <= golf * 2; i++) {
            const px = x + s - (i / (golf * 2)) * s * 2
            const py = y + s * 1.05 + (i % 2 ? -s * 0.18 : 0) + Math.sin(t * 8 + i) * s * 0.05
            ctx.lineTo(px, py)
        }
        ctx.closePath(); ctx.fill()
        ctx.shadowBlur = 0
        for (const dx of [-0.38, 0.38]) {
            ctx.fillStyle = '#fff'
            ctx.beginPath(); ctx.ellipse(x + dx * s, y - s * 0.1, s * 0.26, s * 0.32, 0, 0, TAU); ctx.fill()
            ctx.fillStyle = '#1a1a5a'
            ctx.beginPath(); ctx.arc(x + dx * s + kijk * s * 0.12, y - s * 0.06, s * 0.13, 0, TAU); ctx.fill()
        }
        // blosjes
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath(); ctx.ellipse(x - s * 0.55, y + s * 0.35, s * 0.12, s * 0.07, 0, 0, TAU); ctx.ellipse(x + s * 0.55, y + s * 0.35, s * 0.12, s * 0.07, 0, 0, TAU); ctx.fill()
    }
    const kleuren = ['#ff5a7a', '#7af0ff', '#ffb34d', '#c08bff']
    kleuren.forEach((k, i) => {
        const fase = t * 0.55 + i * 0.9
        const x = b / 2 + Math.sin(fase) * b * 0.36
        const y = h * 0.62 + Math.sin(fase * 2 + i) * h * 0.04 - (i % 2) * h * 0.08
        spook(x, y, k, Math.cos(fase) > 0 ? 1 : -1)
    })
}

// ── Block It: vallende blokjes in vier kleuren, af en toe een knal ──
const BLOK = [['#ff4d6d', '#ff9aae', '#9d1537'], ['#ffb627', '#ffd98a', '#a86a0c'], ['#2ee6a6', '#98f6d4', '#0b8560'], ['#4d9dff', '#a5ccff', '#1c49b8']]
function blok(ctx, x, y, s, k, alpha = 1) {
    const [basis, licht, donker] = BLOK[k]
    const bev = s * 0.17
    ctx.globalAlpha = alpha
    ctx.fillStyle = donker; ctx.fillRect(x, y, s, s)
    ctx.fillStyle = licht
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s - bev, y + bev); ctx.lineTo(x + bev, y + bev); ctx.lineTo(x + bev, y + s - bev); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill()
    ctx.fillStyle = basis; ctx.fillRect(x + bev, y + bev, s - bev * 2, s - bev * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x + bev, y + bev, s - bev * 2, (s - bev * 2) * 0.38)
    ctx.globalAlpha = 1
}
function breakout(ctx, b, h, t, st) {
    lucht(ctx, b, h, ['#0d0620', '#231044', '#0d0620'])
    const kol = 10, c = Math.min(b / kol, h / 18), x0 = (b - c * kol) / 2
    // achtergrondraster
    ctx.strokeStyle = 'rgba(198,184,255,0.06)'
    for (let x = 0; x <= kol; x++) { ctx.beginPath(); ctx.moveTo(x0 + x * c, 0); ctx.lineTo(x0 + x * c, h); ctx.stroke() }
    // regen van blokjes
    const r = reeks(21)
    for (let i = 0; i < 26; i++) {
        const k = Math.floor(r() * kol), kleur = Math.floor(r() * 4), snel = 0.6 + r() * 0.8, start = r() * 10
        const y = ((t * snel * c * 2 + start * h) % (h + c * 4)) - c * 2
        blok(ctx, x0 + k * c, y, c, kleur, 0.35)
    }
    // stapel onderaan met een 3x3 dat knalt
    const vloer = h * 0.85
    const stapel = ['0011223300', '3011220330', '3311200331', '1122003311']
    stapel.forEach((rij, ry) => [...rij].forEach((k, x) => blok(ctx, x0 + x * c, vloer - (4 - ry) * c, c, Number(k))))
    const cyclus = t % 3.2
    const plek = { x: x0 + 3 * c, y: vloer - 7 * c }
    if (cyclus < 2.2) {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
            const val = glad(klem(cyclus / 1.2 - y * 0.15))
            blok(ctx, plek.x + x * c, plek.y - c * 6 * (1 - val) + y * c, c, 2)
        }
        if (cyclus > 1.5) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([8, 6])
            ctx.strokeRect(plek.x - 2, plek.y - 2, c * 3 + 4, c * 3 + 4); ctx.setLineDash([])
        }
    } else {
        const p = (cyclus - 2.2) / 1
        ctx.strokeStyle = '#2ee6a6'; ctx.lineWidth = 6 * (1 - p)
        ctx.globalAlpha = 1 - p
        ctx.beginPath(); ctx.arc(plek.x + c * 1.5, plek.y + c * 1.5, c * (1 + p * 4), 0, TAU); ctx.stroke()
        const rr = reeks(9)
        for (let i = 0; i < 30; i++) {
            const hoek = rr() * TAU, v = c * (1 + rr() * 5) * p
            ctx.fillStyle = rr() < 0.5 ? '#98f6d4' : '#ffffff'
            ctx.fillRect(plek.x + c * 1.5 + Math.cos(hoek) * v, plek.y + c * 1.5 + Math.sin(hoek) * v + p * p * c * 3, 5, 5)
        }
        ctx.globalAlpha = 1
    }
    void st
}

// ── The Swarm: kevers zwermen rond een lamp ──
function swarm(ctx, b, h, t) {
    lucht(ctx, b, h, ['#04110a', '#0b2614', '#020804'])
    // grassprieten
    ctx.strokeStyle = '#123d1f'
    ctx.lineWidth = 3
    const r = reeks(4)
    for (let i = 0; i < 60; i++) {
        const x = r() * b, hh = h * (0.06 + r() * 0.1)
        ctx.beginPath(); ctx.moveTo(x, h); ctx.quadraticCurveTo(x + Math.sin(t + i) * 8, h - hh * 0.6, x + Math.sin(t * 1.3 + i) * 14, h - hh); ctx.stroke()
    }
    const lx = b / 2, ly = h * 0.6
    const gl = ctx.createRadialGradient(lx, ly, 4, lx, ly, Math.min(b, h) * 0.45)
    gl.addColorStop(0, 'rgba(255,240,150,0.9)'); gl.addColorStop(0.15, 'rgba(255,220,90,0.4)'); gl.addColorStop(1, 'rgba(255,200,60,0)')
    ctx.fillStyle = gl; ctx.fillRect(0, 0, b, h)
    ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.arc(lx, ly, 10, 0, TAU); ctx.fill()
    const kever = (x, y, hoek, s, kleur) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(hoek)
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5
        const poot = Math.sin(t * 20 + x) * 0.3
        for (const z of [-1, 1]) for (const p of [-0.4, 0, 0.4]) {
            ctx.beginPath(); ctx.moveTo(p * s, 0); ctx.lineTo(p * s + poot * s * 0.3, z * s * 0.75); ctx.stroke()
        }
        ctx.beginPath(); ctx.moveTo(s * 0.55, -s * 0.1); ctx.lineTo(s * 0.95, -s * 0.4); ctx.moveTo(s * 0.55, s * 0.1); ctx.lineTo(s * 0.95, s * 0.4); ctx.stroke()
        ctx.fillStyle = kleur
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.42, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = '#111'
        ctx.beginPath(); ctx.arc(s * 0.55, 0, s * 0.2, 0, TAU); ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.4, 0); ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-s * 0.05, -s * 0.2, s * 0.25, s * 0.09, 0, 0, TAU); ctx.fill()
        ctx.restore()
    }
    const kleuren = ['#3fd16b', '#e84a3c', '#2fa3ff', '#f2c230', '#b45cff']
    for (let i = 0; i < 22; i++) {
        const rad = Math.min(b, h) * (0.12 + (i % 7) * 0.045)
        const snel = (0.5 + (i % 5) * 0.15) * (i % 2 ? 1 : -1)
        const a = t * snel + i * 1.7
        const x = lx + Math.cos(a) * rad * 1.3 + Math.sin(t * 2 + i) * 6
        const y = ly + Math.sin(a) * rad * 0.8 + Math.cos(t * 2.4 + i) * 6
        kever(x, y, a + (snel > 0 ? Math.PI / 2 : -Math.PI / 2), 15 + (i % 4) * 4, kleuren[i % kleuren.length])
    }
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
            const u = (t * 0.22 * richting + fase - i * 0.018) % 1
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

// ── Runner & Gunner: stad bij zonsondergang, een renner met een blaster ──
function endlessrunner(ctx, b, h, t) {
    lucht(ctx, b, h, ['#1a0b3b', '#7a1f5c', '#ff7a3d', '#ffc56b'])
    const zon = ctx.createRadialGradient(b * 0.7, h * 0.62, 5, b * 0.7, h * 0.62, h * 0.25)
    zon.addColorStop(0, '#fff2b0'); zon.addColorStop(0.3, '#ffd06b'); zon.addColorStop(1, 'rgba(255,160,80,0)')
    ctx.fillStyle = zon; ctx.fillRect(0, 0, b, h)
    const laag = (seed, snel, kleur, grond, max) => {
        const r = reeks(seed)
        const gebouwen = []
        let x = 0
        while (x < b * 2 + 200) { const w = 30 + r() * 60; gebouwen.push([x, w, (0.3 + r() * 0.7) * max, r()]); x += w + 4 }
        const totaal = x
        const verschuif = (t * snel) % totaal
        ctx.fillStyle = kleur
        for (const [gx, w, hh, ram] of gebouwen) {
            for (const extra of [0, totaal]) {
                const xx = gx - verschuif + extra
                if (xx > b || xx + w < 0) continue
                ctx.fillRect(xx, grond - hh, w, hh)
                if (ram > 0.5 && max > h * 0.3) {
                    ctx.fillStyle = 'rgba(255,214,120,0.6)'
                    for (let wy = grond - hh + 8; wy < grond - 8; wy += 14) for (let wx = xx + 6; wx < xx + w - 6; wx += 12) if ((wx * 7 + wy) % 5 < 2) ctx.fillRect(wx, wy, 5, 6)
                    ctx.fillStyle = kleur
                }
            }
        }
    }
    const grond = h * 0.8
    laag(1, 15, '#4a1a5a', grond, h * 0.32)
    laag(2, 40, '#2a0c3a', grond, h * 0.42)
    ctx.fillStyle = '#12051c'; ctx.fillRect(0, grond, b, h - grond)
    // strepen op de grond
    ctx.fillStyle = '#ff9a5a'
    for (let i = 0; i < 12; i++) { const x = ((i * 90 - t * 260) % (b + 90) + b + 90) % (b + 90) - 45; ctx.fillRect(x, grond + 14, 40, 4) }
    // renner (pixelachtig)
    const px = b * 0.28, py = grond, s = Math.max(4, Math.min(b, h) / 66)
    const loop = Math.sin(t * 14)
    ctx.save(); ctx.translate(px, py - Math.abs(loop) * s * 2)
    ctx.fillStyle = '#ffe0b8'; ctx.fillRect(-2 * s, -16 * s, 4 * s, 4 * s)
    ctx.fillStyle = '#ff2f5a'; ctx.fillRect(-3 * s, -17 * s, 6 * s, 2 * s)
    ctx.fillStyle = '#1fd1ff'; ctx.fillRect(-3 * s, -12 * s, 6 * s, 6 * s)
    ctx.fillStyle = '#30304a'
    ctx.save(); ctx.translate(0, -6 * s); ctx.rotate(loop * 0.7); ctx.fillRect(-1.2 * s, 0, 2.4 * s, 6 * s); ctx.restore()
    ctx.save(); ctx.translate(0, -6 * s); ctx.rotate(-loop * 0.7); ctx.fillRect(-1.2 * s, 0, 2.4 * s, 6 * s); ctx.restore()
    ctx.fillStyle = '#ffe0b8'; ctx.fillRect(2 * s, -11 * s, 5 * s, 2 * s)
    ctx.fillStyle = '#c9c9d9'; ctx.fillRect(6 * s, -12 * s, 5 * s, 3 * s)
    ctx.restore()
    // kogels
    for (let i = 0; i < 4; i++) {
        const v = ((t * 2.2 + i * 0.25) % 1)
        const x = px + 11 * s + v * b * 0.75, y = py - 10.5 * s - Math.abs(loop) * s * 2
        ctx.fillStyle = '#fff38a'; ctx.shadowColor = '#ffde3b'; ctx.shadowBlur = 12
        ctx.fillRect(x, y, 14, 3)
    }
    ctx.shadowBlur = 0
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

// ── Neon Raiders: sterren, een neonschip, vijanden en lasers ──
function shmup(ctx, b, h, t) {
    lucht(ctx, b, h, ['#000008', '#070226', '#120042'])
    // nevel
    const ng = ctx.createRadialGradient(b * 0.25, h * 0.35, 10, b * 0.25, h * 0.35, b * 0.7)
    ng.addColorStop(0, 'rgba(255,0,170,0.18)'); ng.addColorStop(1, 'rgba(255,0,170,0)')
    ctx.fillStyle = ng; ctx.fillRect(0, 0, b, h)
    sterren(ctx, b, h, t, 120, 31, 2.5)
    const sx = b / 2 + Math.sin(t * 1.1) * b * 0.22, sy = h * 0.8
    const s = Math.min(b, h) * 0.06
    // lasers
    ctx.fillStyle = '#00f0ff'; ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 14
    for (let i = 0; i < 5; i++) {
        const v = (t * 3 + i * 0.2) % 1
        const x = b / 2 + Math.sin((t - v * 0.33) * 1.1) * b * 0.22
        ctx.fillRect(x - 2, sy - s - v * h * 0.75, 4, 18)
    }
    // vijanden
    for (let i = 0; i < 6; i++) {
        const x = b * (0.15 + 0.14 * i) + Math.sin(t * 1.5 + i) * 18
        const y = h * 0.42 + Math.sin(t * 2 + i * 0.8) * h * 0.04 + (i % 2) * h * 0.06
        const kleur = i % 2 ? '#ff2fd6' : '#ffe14d'
        ctx.strokeStyle = kleur; ctx.shadowColor = kleur; ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(x, y + s * 0.6); ctx.lineTo(x - s * 0.6, y - s * 0.4); ctx.lineTo(x, y - s * 0.1); ctx.lineTo(x + s * 0.6, y - s * 0.4); ctx.closePath(); ctx.stroke()
    }
    // schip
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 20
    const vlam = s * (0.6 + 0.3 * Math.sin(t * 40))
    ctx.fillStyle = '#ff7a1a'
    ctx.beginPath(); ctx.moveTo(sx - s * 0.25, sy + s * 0.7); ctx.lineTo(sx, sy + s * 0.7 + vlam); ctx.lineTo(sx + s * 0.25, sy + s * 0.7); ctx.fill()
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 3; ctx.fillStyle = '#071a3a'
    ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * 0.9, sy + s * 0.7); ctx.lineTo(sx, sy + s * 0.35); ctx.lineTo(sx - s * 0.9, sy + s * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#ff2fd6'; ctx.beginPath(); ctx.arc(sx, sy - s * 0.1, s * 0.18, 0, TAU); ctx.fill()
    ctx.shadowBlur = 0
}

// Lettertype (bestand in lettertypen/), kleuren van de titel, en de tekening
export const SCENES = {
    botkaaseiren: { font: 'Chewy', css: 'chewy', titel: '#fff1d6', rand: '#4a2509', gloed: '#ffb35a', teken: botkaaseiren },
    vieroprij: { font: 'Titan One', css: 'titan-one', titel: '#ffd23f', rand: '#1e4fd8', gloed: '#ffffff', teken: vieroprij },
    schaken: { font: 'Cinzel Decorative', css: 'cinzel-decorative', titel: '#f3dc96', rand: '#2b1d05', gloed: '#d9a83a', teken: schaken },
    dammen: { font: 'Cinzel', css: 'cinzel', titel: '#fbf3df', rand: '#2a1608', gloed: '#c98a3e', teken: dammen },
    pong: { font: 'Monoton', css: 'monoton', titel: '#7af7ff', rand: '#12002b', gloed: '#ff3df2', teken: pong },
    pacman: { font: 'Creepster', css: 'creepster', titel: '#ffe14d', rand: '#0a0a3a', gloed: '#2f5bff', teken: pacman },
    breakout: { font: 'Bungee', css: 'bungee', titel: '#c6b8ff', rand: '#1a0a2e', gloed: '#ff4d6d', teken: breakout },
    swarm: { font: 'Rubik Spray Paint', css: 'rubik-spray-paint', titel: '#d6ff6b', rand: '#06200d', gloed: '#3fd16b', teken: swarm },
    pinball: { font: 'Bagel Fat One', css: 'bagel-fat-one', titel: '#b6ff7a', rand: '#14301c', gloed: '#a35cff', teken: pinball },
    endlessrunner: { font: 'Press Start 2P', css: 'press-start-2p', titel: '#ffe36b', rand: '#2a0c3a', gloed: '#ff2f5a', teken: endlessrunner, klein: true },
    flappybird: { font: 'Fascinate', css: 'fascinate', titel: '#e9d8ff', rand: '#120830', gloed: '#a07aff', teken: flappybird },
    shmup: { font: 'Orbitron', css: 'orbitron', titel: '#ffffff', rand: '#05001a', gloed: '#00f0ff', teken: shmup }
}
SCENES.schakendrie = SCENES.schaken
