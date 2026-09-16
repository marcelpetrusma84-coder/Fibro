import { maakGeluid } from './flappy-geluid.js?v=86'
// flappy-ui.js - Flappy Friends voor Fibro.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.
// Grot-level: rotsen, plafond en grond zijn massief.
// Scherpe punten, spijkers, fakkelvuur en vallende rotsen zijn dodelijk.
// Je bent ook af als je links uit beeld wordt geduwd.

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
    vriendNaam = vriendNaam || 'vriend'
    isActief = isActief || (() => true)
    document.getElementById('spelTitelBar').textContent = '🦇 Flappy Friends'
    const inhoud = document.getElementById('spelInhoud')

    // ── Instellingen ──
    const B = 280, H = 380
    const PLAFOND_Y = 16, GROND_Y = H - 30
    const VOGEL_X = 55, VOGEL_R = 14, VOGEL_X_VRIEND = 95
    const HIT_R = 11                  // botsvak tegen rotsen
    const GEVAAR_R = 8                // botsvak tegen gevaren (iets vergevingsgezind)
    const ZWAARTEKRACHT = 0.35, FLAP_KRACHT = -7, MAX_VAL = 9
    const TERUG_SNELHEID = 0.5        // zweven terug naar startplek (0 = uit)
    const ROTS_BREEDTE = 52, GAP = 110, GAP_MET_PUNTEN = 134, SNELHEID = 2.2
    const PUNT_H = 16, SPIJKER_H = 14, VAL_ZWAARTEKRACHT = 0.25
    // Na hoeveel rotsen elk gevaar begint
    const LEVEL_PUNTEN = 6, LEVEL_SPIJKERS = 12, LEVEL_FAKKELS = 18, LEVEL_VALLEND = 24
    const MELDINGEN = {
        [LEVEL_PUNTEN]: 'Pas op: scherpe punten!',
        [LEVEL_SPIJKERS]: 'Pas op: spijkers!',
        [LEVEL_FAKKELS]: 'Pas op: fakkels!',
        [LEVEL_VALLEND]: 'Pas op: vallende rotsen!'
    }
    const benIkHost = benIkSpeler1

    inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
    <div id="fb-status" style="color:white;font-size:13px;font-weight:600;min-height:18px;text-align:center;"></div>
    <canvas id="fb-canvas" width="${B}" height="${H}" style="border-radius:12px;border:2px solid rgba(255,255,255,0.15);touch-action:none;display:block;"></canvas>
    <div style="display:flex;gap:20px;">
    <div style="color:white;font-size:12px;text-align:center;">
    <div style="font-size:22px;">🦇</div>
    <div id="fb-score-mij" style="font-weight:700;font-size:18px;color:#60a5fa;">0</div>
    <div style="opacity:0.6;font-size:11px;">Jij</div>
    </div>
    <div style="color:white;font-size:12px;text-align:center;">
    <div style="font-size:22px;">🦇</div>
    <div id="fb-score-vriend" style="font-weight:700;font-size:18px;color:#fbbf24;">0</div>
    <div style="opacity:0.6;font-size:11px;">${vriendNaam}</div>
    </div>
    </div>
    <button id="fb-geluid" style="background:rgba(255,255,255,0.12);border:none;border-radius:8px;color:white;padding:4px 12px;font-size:16px;cursor:pointer;">🔊</button>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;">Tik om te vliegen. Rotsen mag je raken, punten en vuur niet!</div>
    </div>`

    const canvas = document.getElementById('fb-canvas')
    const ctx = canvas.getContext('2d')
    const statusEl = document.getElementById('fb-status')
  const geluid = maakGeluid()
  const geluidKnop = document.getElementById('fb-geluid')
  geluidKnop.textContent = geluid.aan ? '🔊' : '🔇'
  geluidKnop.onclick = (e) => { e.stopPropagation(); geluidKnop.textContent = geluid.wissel() ? '🔊' : '🔇' }

    // ── Spelstaat ──
    let mijnVogel, vriendVogel, obstakels, volgendeId, rotsTeller
    let mijnGeteld, frame, mijnScore, vriendScore, gameOver, melding
    let aftellen = 3
    let aftelInterval = null
    let animFrame = null

    function resetStaat() {
        mijnVogel = { x: VOGEL_X, y: H / 2, vy: 0, dood: false }
        vriendVogel = { x: VOGEL_X_VRIEND, y: H / 2, vy: 0, dood: false }
        obstakels = []
        volgendeId = 0
        rotsTeller = 0
        mijnGeteld = new Set()
        frame = 0
        mijnScore = 0
        vriendScore = 0
        gameOver = false
        melding = null
    }
    resetStaat()

    // Vaste "willekeur" zodat rotsen er bij beide spelers hetzelfde uitzien
    function ruis(n) {
        const s = Math.sin(n * 12.9898) * 43758.5453
        return s - Math.floor(s)
    }

    // ── Obstakels maken (alleen host) ──
    function maakRots() {
        const n = rotsTeller++
        const kansPunten = n < LEVEL_PUNTEN ? 0 : Math.min(0.5 + (n - LEVEL_PUNTEN) * 0.05, 0.9)
        const punten = n === LEVEL_PUNTEN || Math.random() < kansPunten
        const gap = punten ? GAP_MET_PUNTEN : GAP
        const gapY = PLAFOND_Y + 50 + Math.random() * (GROND_Y - gap - PLAFOND_Y - 100)
        return { id: volgendeId++, soort: 'rots', n, x: B, gapY, gap, punten }
    }

    function maakExtra() {
        const n = rotsTeller
        const keuzes = []
        if (n >= LEVEL_SPIJKERS) keuzes.push('spijkers')
            if (n >= LEVEL_FAKKELS) keuzes.push('fakkel')
                if (n >= LEVEL_VALLEND) keuzes.push('vallend')
                    if (!keuzes.length) return null
                        // Het nieuwste gevaar komt de eerste keer altijd
                        let soort
                        if (n === LEVEL_SPIJKERS) soort = 'spijkers'
                            else if (n === LEVEL_FAKKELS) soort = 'fakkel'
                                else if (n === LEVEL_VALLEND) soort = 'vallend'
                                    else {
                                        if (Math.random() < 0.35) return null
                                            soort = keuzes[Math.floor(Math.random() * keuzes.length)]
                                    }
                                    const midden = B + 26          // midden tussen twee rotsen
                                    const id = volgendeId++
                                    if (soort === 'spijkers') return { id, soort, x: midden - 30, breedte: 60 }
                                    if (soort === 'fakkel') return { id, soort, x: midden, hoogte: 40 + Math.random() * 60 }
                                    return {
                                        id, soort, x: midden, y: PLAFOND_Y, vy: 0, valt: false,
                                        blok: Math.random() < 0.5, trigger: 130 + Math.random() * 60
                                    }
    }

    function toonMeldingVoor(o) {
        if (o.soort === 'rots' && MELDINGEN[o.n] && !obstakels.some(x => x.id === o.id)) {
            melding = { tekst: MELDINGEN[o.n], tot: frame + 120 }; geluid.waarschuwing()
        }
    }

    function voegToe(o) {
        toonMeldingVoor(o)
        if (!obstakels.some(x => x.id === o.id)) obstakels.push(o)
    }

    function stuurNieuw(o) {
        voegToe(o)
        spelKanaal.send({ type: 'broadcast', event: 'fb-nieuw', payload: { ...o } })
    }

    function valHoogte(o) {
        return o.blok ? 20 : 30
    }

    function beweegObstakels() {
        for (const o of obstakels) {
            o.x -= SNELHEID
            if (o.soort === 'vallend') {
                if (!o.valt && o.x < o.trigger) { o.valt = true; geluid.vallen() }
                    if (o.valt) {
                        o.vy += VAL_ZWAARTEKRACHT
                        o.y += o.vy
                        if (o.y + valHoogte(o) >= GROND_Y) o.weg = true
                    }
            }
        }
        obstakels = obstakels.filter(o => !o.weg && o.x > -100)
    }

    // ── Vormen van gevaren ──
    function puntDriehoeken(o) {
        const l = o.x - 4, w = (ROTS_BREEDTE + 8) / 2
        const boven = o.gapY, onder = o.gapY + o.gap
        const lijst = []
        for (let i = 0; i < 2; i++) {
            const a = l + i * w
            lijst.push([a, boven, a + w, boven, a + w / 2, boven + PUNT_H])   // stalactiet
            lijst.push([a, onder, a + w, onder, a + w / 2, onder - PUNT_H])   // stalagmiet
        }
        return lijst
    }

    function spijkerDriehoeken(o) {
        const aantal = 5, w = o.breedte / aantal, lijst = []
        for (let i = 0; i < aantal; i++) {
            const a = o.x + i * w
            lijst.push([a, GROND_Y, a + w, GROND_Y, a + w / 2, GROND_Y - SPIJKER_H])
        }
        return lijst
    }

    function valDriehoek(o) {
        return [o.x - 9, o.y, o.x + 9, o.y, o.x, o.y + 30]
    }

    function fakkelVlam(o) {
        return { x: o.x, y: GROND_Y - o.hoogte - 8, r: 7 }
    }  // ── Botsingen ──
    function afstandTotLijn(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    }

    function cirkelDriehoek(cx, cy, r, d) {
        const [ax, ay, bx, by, qx, qy] = d
        const k1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        const k2 = (qx - bx) * (cy - by) - (qy - by) * (cx - bx)
        const k3 = (ax - qx) * (cy - qy) - (ay - qy) * (cx - qx)
        if ((k1 >= 0 && k2 >= 0 && k3 >= 0) || (k1 <= 0 && k2 <= 0 && k3 <= 0)) return true
            return afstandTotLijn(cx, cy, ax, ay, bx, by) < r ||
            afstandTotLijn(cx, cy, bx, by, qx, qy) < r ||
            afstandTotLijn(cx, cy, qx, qy, ax, ay) < r
    }

    function cirkelRechthoek(cx, cy, r, rx, ry, rw, rh) {
        const nx = Math.max(rx, Math.min(cx, rx + rw))
        const ny = Math.max(ry, Math.min(cy, ry + rh))
        return Math.hypot(cx - nx, cy - ny) < r
    }

    function raaktGevaar(v) {
        const cx = v.x, cy = v.y, r = GEVAAR_R
        for (const o of obstakels) {
            if (o.soort === 'rots' && o.punten) {
                for (const d of puntDriehoeken(o)) if (cirkelDriehoek(cx, cy, r, d)) return true
            } else if (o.soort === 'spijkers') {
                for (const d of spijkerDriehoeken(o)) if (cirkelDriehoek(cx, cy, r, d)) return true
            } else if (o.soort === 'fakkel') {
                const vlam = fakkelVlam(o)
                if (Math.hypot(cx - vlam.x, cy - vlam.y) < r + vlam.r) return true
            } else if (o.soort === 'vallend') {
                if (o.blok) {
                    if (cirkelRechthoek(cx, cy, r, o.x - 10, o.y, 20, 20)) return true
                } else if (cirkelDriehoek(cx, cy, r, valDriehoek(o))) {
                    return true
                }
            }
        }
        return false
    }

    // Duwt de vleermuis uit een rechthoek, langs de kortste weg
    function botsRechthoek(v, rx, ry, rw, rh) {
        const l = v.x - HIT_R, r = v.x + HIT_R, t = v.y - HIT_R, o = v.y + HIT_R
        if (r <= rx || l >= rx + rw || o <= ry || t >= ry + rh) return
            const duwLinks = r - rx
            const duwRechts = rx + rw - l
            const duwOmhoog = o - ry
            const duwOmlaag = ry + rh - t
            const min = Math.min(duwLinks, duwRechts, duwOmhoog, duwOmlaag)
            if (min === duwLinks) {
                v.x -= duwLinks
            } else if (min === duwRechts) {
                v.x += duwRechts
            } else if (min === duwOmhoog) {
                v.y -= duwOmhoog
                if (v.vy > 0) v.vy = 0
            } else {
                v.y += duwOmlaag
                if (v.vy < 0) v.vy = 0
            }
    }

    function beweegVleermuis(v) {
        v.vy = Math.min(v.vy + ZWAARTEKRACHT, MAX_VAL)
        v.y += v.vy
        if (v.x < VOGEL_X) v.x = Math.min(VOGEL_X, v.x + TERUG_SNELHEID)

            for (const o of obstakels) {
                if (o.soort !== 'rots') continue
                    botsRechthoek(v, o.x - 4, -200, ROTS_BREEDTE + 8, o.gapY + 200)
                    botsRechthoek(v, o.x - 4, o.gapY + o.gap, ROTS_BREEDTE + 8, H)
            }

            if (v.y - HIT_R < PLAFOND_Y) {
                v.y = PLAFOND_Y + HIT_R
                if (v.vy < 0) v.vy = 0
            }
            if (v.y + HIT_R > GROND_Y) {
                v.y = GROND_Y - HIT_R
                if (v.vy > 0) v.vy = 0
            }
    }

    function uitBeeld(v) {
        return v.x + VOGEL_R < 0
    }

    // ── Tekenen ──
    function teken() {
        tekenAchtergrond()
        tekenPlafondEnGrond()
        for (const o of obstakels) if (o.soort === 'rots') tekenRots(o)
            for (const o of obstakels) if (o.soort === 'spijkers') tekenSpijkers(o)
                for (const o of obstakels) if (o.soort === 'fakkel') tekenFakkel(o)
                    for (const o of obstakels) if (o.soort === 'vallend') tekenVallend(o)

                        if (!vriendVogel.dood) tekenVleermuis(vriendVogel.x, vriendVogel.y, vriendVogel.vy, '#fbbf24')
                            if (!mijnVogel.dood) tekenVleermuis(mijnVogel.x, mijnVogel.y, mijnVogel.vy, '#60a5fa')

                                if (melding && frame < melding.tot) {
                                    ctx.fillStyle = 'rgba(0,0,0,0.6)'
                                    ctx.fillRect(20, 40, B - 40, 30)
                                    ctx.fillStyle = '#ffd23f'
                                    ctx.font = 'bold 14px sans-serif'
                                    ctx.textAlign = 'center'
                                    ctx.fillText(melding.tekst, B / 2, 60)
                                    ctx.textAlign = 'start'
                                }
    }

    function tekenAchtergrond() {
        const g = ctx.createLinearGradient(0, 0, 0, H)
        g.addColorStop(0, '#1c1612')
        g.addColorStop(0.5, '#2a211a')
        g.addColorStop(1, '#171210')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, B, H)

        // Verre rotswand die langzaam meeschuift
        const schuif = frame * 0.5
        const periode = B + 120
        ctx.fillStyle = 'rgba(70,56,44,0.35)'
        for (let i = 0; i < 12; i++) {
            const x = ((i * 97 - schuif) % periode + periode) % periode - 60
            const y = 40 + ruis(i + 1) * (H - 110)
            const r = 14 + ruis(i + 50) * 22
            ctx.beginPath()
            ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    function tekenPlafondEnGrond() {
        const afgelegd = frame * SNELHEID
        const start = Math.floor(afgelegd / 20)
        const schuif = afgelegd - start * 20
        const stappen = Math.ceil(B / 20) + 1
        ctx.fillStyle = '#3b2f25'

        ctx.beginPath()
        ctx.moveTo(-20, 0)
        for (let i = 0; i <= stappen; i++) {
            ctx.lineTo(i * 20 - schuif, PLAFOND_Y + ruis(start + i) * 6 - 3)
        }
        ctx.lineTo(B + 20, 0)
        ctx.closePath()
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(-20, H)
        for (let i = 0; i <= stappen; i++) {
            ctx.lineTo(i * 20 - schuif, GROND_Y + ruis(start + i + 500) * 6 - 3)
        }
        ctx.lineTo(B + 20, H)
        ctx.closePath()
        ctx.fill()
    }

    function tekenRots(o) {
        const l = o.x - 4, r = o.x + ROTS_BREEDTE + 4
        const grad = ctx.createLinearGradient(l, 0, r, 0)
        grad.addColorStop(0, '#5c4f42')
        grad.addColorStop(0.5, '#4a3f35')
        grad.addColorStop(1, '#2e2620')
        ctx.fillStyle = grad
        tekenRotsblok(o, l, r, -5, o.gapY, 1)
        tekenRotsblok(o, l, r, o.gapY + o.gap, H + 5, 2)

        if (o.punten) {
            ctx.fillStyle = '#c9bcaa'
            ctx.strokeStyle = 'rgba(0,0,0,0.4)'
            ctx.lineWidth = 1
            for (const d of puntDriehoeken(o)) tekenDriehoek(d)
        }
    }  // Rotsblok met hobbelige zijkanten
    function tekenRotsblok(o, l, r, boven, onder, zaad) {
        const stap = 18
        let k = 0
        ctx.beginPath()
        ctx.moveTo(l + 2, boven)
        for (let y = boven + stap; y < onder; y += stap) {
            ctx.lineTo(l + ruis(o.id * 31 + zaad * 101 + k++) * 5, y)
        }
        ctx.lineTo(l + 2, onder)
        ctx.lineTo(r - 2, onder)
        for (let y = onder - stap; y > boven; y -= stap) {
            ctx.lineTo(r - ruis(o.id * 17 + zaad * 211 + k++) * 5, y)
        }
        ctx.lineTo(r - 2, boven)
        ctx.closePath()
        ctx.fill()
    }

    function tekenDriehoek(d) {
        ctx.beginPath()
        ctx.moveTo(d[0], d[1])
        ctx.lineTo(d[2], d[3])
        ctx.lineTo(d[4], d[5])
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
    }

    function tekenSpijkers(o) {
        ctx.fillStyle = '#d6d0c8'
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'
        ctx.lineWidth = 1
        for (const d of spijkerDriehoeken(o)) tekenDriehoek(d)
    }

    function tekenFakkel(o) {
        const topY = GROND_Y - o.hoogte
        const vlam = fakkelVlam(o)

        // Gloed
        const gloed = ctx.createRadialGradient(vlam.x, vlam.y, 2, vlam.x, vlam.y, 60)
        gloed.addColorStop(0, 'rgba(255,170,60,0.35)')
        gloed.addColorStop(1, 'rgba(255,170,60,0)')
        ctx.fillStyle = gloed
        ctx.fillRect(vlam.x - 60, vlam.y - 60, 120, 120)

        // Stok
        ctx.fillStyle = '#5a3a1e'
        ctx.fillRect(o.x - 3, topY, 6, o.hoogte)
        ctx.fillStyle = '#3a2614'
        ctx.fillRect(o.x - 5, topY - 2, 10, 6)

        // Vlam
        const flakker = Math.sin(frame * 0.4 + o.id) * 2
        ctx.fillStyle = '#ff7a1a'
        ctx.beginPath()
        ctx.moveTo(o.x - 7, topY - 2)
        ctx.quadraticCurveTo(o.x - 8, topY - 12, o.x + flakker, topY - 22)
        ctx.quadraticCurveTo(o.x + 8, topY - 12, o.x + 7, topY - 2)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#ffd23f'
        ctx.beginPath()
        ctx.moveTo(o.x - 3, topY - 2)
        ctx.quadraticCurveTo(o.x - 4, topY - 8, o.x + flakker * 0.5, topY - 14)
        ctx.quadraticCurveTo(o.x + 4, topY - 8, o.x + 3, topY - 2)
        ctx.closePath()
        ctx.fill()
    }

    function tekenVallend(o) {
        ctx.save()
        // Trillen vlak voordat hij valt
        if (!o.valt && o.x < o.trigger + 50) ctx.translate(Math.sin(frame * 1.5) * 1.5, 0)
            if (o.blok) {
                ctx.fillStyle = '#6b5a4a'
                ctx.beginPath()
                ctx.moveTo(o.x - 10, o.y + 3)
                ctx.lineTo(o.x - 4, o.y)
                ctx.lineTo(o.x + 9, o.y + 2)
                ctx.lineTo(o.x + 10, o.y + 15)
                ctx.lineTo(o.x + 3, o.y + 20)
                ctx.lineTo(o.x - 9, o.y + 17)
                ctx.closePath()
                ctx.fill()
                ctx.strokeStyle = 'rgba(0,0,0,0.4)'
                ctx.lineWidth = 1
                ctx.stroke()
            } else {
                ctx.fillStyle = '#c9bcaa'
                ctx.strokeStyle = 'rgba(0,0,0,0.4)'
                ctx.lineWidth = 1
                tekenDriehoek(valDriehoek(o))
            }
            ctx.restore()
    }

    function tekenVleermuis(x, y, vy, kleur) {
        const slag = Math.sin(frame * (vy < 0 ? 0.45 : 0.2))
        const tipY = -6 - slag * 10
        ctx.save()
        ctx.translate(x, y)

        // Vleugels
        for (const s of [-1, 1]) {
            ctx.beginPath()
            ctx.moveTo(s * 6, -4)
            ctx.lineTo(s * 22, tipY)
            ctx.quadraticCurveTo(s * 21, 2, s * 16, 6)
            ctx.quadraticCurveTo(s * 14, 2, s * 11, 6)
            ctx.quadraticCurveTo(s * 9, 2, s * 6, 5)
            ctx.closePath()
            ctx.fillStyle = '#3b2a55'
            ctx.fill()
            ctx.strokeStyle = kleur
            ctx.lineWidth = 1.5
            ctx.stroke()
        }

        // Oren
        ctx.fillStyle = kleur
        for (const s of [-1, 1]) {
            ctx.beginPath()
            ctx.moveTo(s * 8, -8)
            ctx.lineTo(s * 6, -19)
            ctx.lineTo(s * 2, -10)
            ctx.closePath()
            ctx.fill()
        }

        // Lijf
        ctx.beginPath()
        ctx.ellipse(0, 0, 11, 13, 0, 0, Math.PI * 2)
        ctx.fillStyle = kleur
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 2
        ctx.stroke()

        // Ogen
        for (const s of [-1, 1]) {
            ctx.beginPath()
            ctx.arc(s * 4, -3, 3, 0, Math.PI * 2)
            ctx.fillStyle = '#fff'
            ctx.fill()
            ctx.beginPath()
            ctx.arc(s * 4, -3, 1.5, 0, Math.PI * 2)
            ctx.fillStyle = '#1a0a2e'
            ctx.fill()
        }

        // Tandjes
        ctx.fillStyle = '#fff'
        for (const s of [-1, 1]) {
            ctx.beginPath()
            ctx.moveTo(s * 3, 5)
            ctx.lineTo(s * 2, 9)
            ctx.lineTo(s * 1, 5)
            ctx.closePath()
            ctx.fill()
        }
        ctx.restore()
    }  // ── Spellus ──
    function update() {
        if (gameOver) return
            frame++

            // Host maakt nieuwe obstakels: rots elke 90 frames, extra gevaar ertussen
            if (benIkHost) {
                if (frame % 90 === 0) stuurNieuw(maakRots())
                    if (frame % 90 === 45) {
                        const extra = maakExtra()
                        if (extra) stuurNieuw(extra)
                    }
            }
            beweegObstakels()

            // Mijn vleermuis
            if (!mijnVogel.dood) {
                beweegVleermuis(mijnVogel)
                const geraakt = raaktGevaar(mijnVogel)

                if (geraakt || uitBeeld(mijnVogel)) {
                    mijnVogel.dood = true
                    spelKanaal.send({ type: 'broadcast', event: 'fb-dood', payload: {} })
                    geluid.af(geraakt); const reden = geraakt ? '💥 Geraakt!' : '💀 Uit beeld!'
                    statusEl.textContent = vriendVogel.dood ? '' : `${reden} ${vriendNaam} vliegt nog...`
                    controleerEinde()
                } else {
                    // Punt voor elke rots die ik voorbij ben
                    for (const o of obstakels) {
                        if (o.soort !== 'rots' || mijnGeteld.has(o.id)) continue
                            if (o.x + ROTS_BREEDTE + 4 < mijnVogel.x - HIT_R) {
                                mijnGeteld.add(o.id)
                                mijnScore++; geluid.punt()
                                document.getElementById('fb-score-mij').textContent = mijnScore
                                spelKanaal.send({
                                    type: 'broadcast',
                                    event: benIkHost ? 'fb-score-host' : 'fb-score-gast',
                                    payload: { score: mijnScore }
                                })
                            }
                    }
                }
            }

            // Posities doorgeven
            if (frame % 3 === 0) {
                if (benIkHost) {
                    spelKanaal.send({ type: 'broadcast', event: 'fb-sync', payload: {
                        obstakels: obstakels.map(o => ({ ...o })),
                                    vogelY: mijnVogel.y,
                                    vogelX: mijnVogel.x
                    }})
                } else {
                    spelKanaal.send({ type: 'broadcast', event: 'fb-vogel-gast', payload: { y: mijnVogel.y, x: mijnVogel.x } })
                }
            }

            if (gameOver) return
                teken()
                animFrame = requestAnimationFrame(update)
                window._spelAnimFrame = animFrame
    }

    function controleerEinde() {
        if (!(mijnVogel.dood && vriendVogel.dood)) return

            gameOver = true
            cancelAnimationFrame(animFrame)
            teken()
            const gelijkspel = mijnScore === vriendScore
            const ikWin = mijnScore > vriendScore
            geluid.einde(gelijkspel ? 0 : ikWin ? 1 : -1); statusEl.textContent = gelijkspel ? '🤝 Gelijkspel!' : ikWin ? '🎉 Jij wint!' : '😢 ' + vriendNaam + ' wint!'
            setTimeout(() => {
                inhoud.querySelectorAll('button.fb-herstart').forEach(b => b.remove())
                const btn = document.createElement('button')
                btn.className = 'fb-herstart'
                btn.textContent = '↻ Opnieuw'
                btn.style.cssText = 'background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:700;cursor:pointer;margin-top:8px;display:block;'
                btn.onclick = () => {
                    spelKanaal.send({ type: 'broadcast', event: 'fb-herstart', payload: {} })
                    herstart()
                }
                inhoud.querySelector('div').appendChild(btn)
            }, 800)
    }

    function herstart() {
        cancelAnimationFrame(animFrame)
        resetStaat()
        document.getElementById('fb-score-mij').textContent = '0'
        document.getElementById('fb-score-vriend').textContent = '0'
        statusEl.textContent = ''
        inhoud.querySelectorAll('button.fb-herstart').forEach(b => b.remove())
        animFrame = requestAnimationFrame(update)
        window._spelAnimFrame = animFrame
    }

    function flap() {
        if (gameOver || mijnVogel.dood) return
            mijnVogel.vy = FLAP_KRACHT; geluid.flap()
    }

    // ── Aftellen ──
    teken()
    geluid.tel(); statusEl.textContent = `Start in ${aftellen}...`
    aftelInterval = setInterval(() => {
        aftellen--
        if (aftellen > 0) {
            geluid.tel(); statusEl.textContent = `Start in ${aftellen}...`
        } else {
            clearInterval(aftelInterval)
            window._spelAftelInterval = null; geluid.start()
            statusEl.textContent = ''
            animFrame = requestAnimationFrame(update)
            window._spelAnimFrame = animFrame
        }
    }, 1000)
    window._spelAftelInterval = aftelInterval

    // ── Input: tik overal op scherm om te vliegen ──
    function flapHandler(e) {
        if (!isActief()) return
            if (e.target.tagName === 'BUTTON') return
                e.preventDefault()
                flap()
    }
    canvas.addEventListener('click', flap)
    const fbOverlay = document.getElementById('spelOverlay')
    fbOverlay.addEventListener('touchstart', flapHandler, { passive: false })

    // ── Ontvangen events ──
    function zetVriend(y, x) {
        vriendVogel.vy = (y - vriendVogel.y) / 3
        vriendVogel.y = y
        if (typeof x === 'number') vriendVogel.x = x
    }

    spelKanaal.on('broadcast', { event: 'fb-nieuw' }, (msg) => {
        if (!benIkHost) voegToe(msg.payload)
    })
    spelKanaal.on('broadcast', { event: 'fb-sync' }, (msg) => {
        if (!benIkHost) {
            msg.payload.obstakels.forEach(toonMeldingVoor)
            obstakels = msg.payload.obstakels
            zetVriend(msg.payload.vogelY, msg.payload.vogelX)
        }
    })
    spelKanaal.on('broadcast', { event: 'fb-vogel-gast' }, (msg) => {
        if (benIkHost) zetVriend(msg.payload.y, msg.payload.x)
    })
    spelKanaal.on('broadcast', { event: 'fb-dood' }, () => {
        vriendVogel.dood = true; geluid.vriendAf()
        if (!mijnVogel.dood) statusEl.textContent = `${vriendNaam} is af. Hou vol!`
            controleerEinde()
    })
    spelKanaal.on('broadcast', { event: 'fb-score-host' }, (msg) => {
        if (!benIkHost) {
            vriendScore = msg.payload.score
            document.getElementById('fb-score-vriend').textContent = vriendScore
        }
    })
    spelKanaal.on('broadcast', { event: 'fb-score-gast' }, (msg) => {
        if (benIkHost) {
            vriendScore = msg.payload.score
            document.getElementById('fb-score-vriend').textContent = vriendScore
        }
    })
    spelKanaal.on('broadcast', { event: 'fb-herstart' }, () => herstart())
}
