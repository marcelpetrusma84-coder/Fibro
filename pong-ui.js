// pong-ui.js - Pong voor Fibro.
// Tekent zichzelf in #spelInhoud en praat met de tegenstander via het
// spelkanaal dat chat.html aanlevert. De host rekent de bal uit.

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
  // isActief() zegt of Pong nog het geopende spel is; zonder die controle blijft
  // het spel naar aanrakingen luisteren nadat je het gesloten hebt.
  isActief = isActief || (() => true)
  vriendNaam = vriendNaam || 'vriend'
  let pongTrail = null
  document.getElementById('spelTitelBar').textContent = '🏓 Neo Paddle'
  const inhoud = document.getElementById('spelInhoud')

  const BREEDTE = 280, HOOGTE = 380
  const PADDLE_BREEDTE = 60, PADDLE_HOOGTE = 10, PADDLE_Y_ONDER = HOOGTE - 30, PADDLE_Y_BOVEN = 20
  const BAL_GROOTTE = 8
  const WIN_SCORE = 7

  // Ben ik de host? Host rekent de bal-physics uit, gast volgt alleen mee.
  const benIkHost = benIkSpeler1
  // Mijn paddle staat altijd ONDERAAN op mijn scherm (eigen perspectief), tegenstander BOVEN
  let mijnPaddleX = BREEDTE / 2 - PADDLE_BREEDTE / 2
  let vriendPaddleX = BREEDTE / 2 - PADDLE_BREEDTE / 2
  // De paddle van de ander komt via het netwerk binnen, en die berichten komen
  // niet even vaak als we tekenen. Daarom loopt de getekende paddle vloeiend
  // naar de laatst ontvangen positie toe. De fysica gebruikt de echte positie.
  let vriendPaddleTekenX = vriendPaddleX
  // Voor 'effect': hoe hard bewoog de paddle op het moment van raken?
  // Vonkjes en een klein schokje bij een botsing (alleen visueel)
  let vonken = []
  let schok = 0
  function maakVonken(x, y, nx, ny, kracht) {
    schok = Math.min(6, 2 + kracht * 0.6)
    for (let i = 0; i < 7; i++) {
      const hoek = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.6
      const snel = 0.8 + Math.random() * 2.2
      vonken.push({ x: x, y: y, vx: Math.cos(hoek) * snel, vy: Math.sin(hoek) * snel, leven: 1 })
    }
    if (vonken.length > 60) vonken = vonken.slice(-60)
  }
  let vorigMijnPaddleX = mijnPaddleX, vorigVriendPaddleX = vriendPaddleX
  let mijnPaddleV = 0, vriendPaddleV = 0
  // Geeft de bal een zetje mee in de richting waarin de paddle beweegt.
  function geefEffect(paddleV) {
    const zet = Math.max(-2.5, Math.min(2.5, paddleV * 0.35))
    bal.vx += zet
    // Voorkom dat de bal bijna horizontaal gaat en de rally eindeloos duurt
    const minVy = 1.6
    if (Math.abs(bal.vy) < minVy) bal.vy = bal.vy < 0 ? -minVy : minVy
  }
  let bal = { x: BREEDTE/2, y: HOOGTE/2, vx: 2.4, vy: -3.2 }
  let mijnScore = 0, vriendScore = 0
  let huidigLevel = 1
  const MAX_LEVEL = 7

  // Obstakels per level (gebaseerd op jouw tekeningen)
  // type: rect={x,y,b,h}, bumper={x,y,r} (driehoek-hoek), zijkant={x,y,b,h}
  // ── Botsingen: werk met de ECHTE vorm, niet met een vierkant eromheen ──
  // Elke vorm is een veelhoek. De bal weerkaatst netjes tegen het vlak dat
  // hij raakt, in plaats van simpelweg om te keren.
  function vormPunten(o) {
    const bs = 22
    if (o.type === 'hoek') {
      if (o.richting === 'lt') return [[o.x,o.y],[o.x+bs,o.y],[o.x,o.y+bs]]
      if (o.richting === 'rt') return [[o.x,o.y],[o.x-bs,o.y],[o.x,o.y+bs]]
      if (o.richting === 'lb') return [[o.x,o.y],[o.x+bs,o.y],[o.x,o.y-bs]]
      return [[o.x,o.y],[o.x-bs,o.y],[o.x,o.y-bs]]
    }
    if (o.type === 'zijkant') {
      if (o.richting === 'l') return [[o.x,o.y],[o.x+bs,o.y+25],[o.x,o.y+50]]
      return [[o.x,o.y],[o.x-bs,o.y+25],[o.x,o.y+50]]
    }
    if (o.type === 'ruit') return [[o.x,o.y-o.r],[o.x+o.r,o.y],[o.x,o.y+o.r],[o.x-o.r,o.y]]
    if (o.type === 'rect') return [[o.x,o.y],[o.x+o.b,o.y],[o.x+o.b,o.y+o.h],[o.x,o.y+o.h]]
    return []
  }

  function inVorm(px, py, pts) {
    let binnen = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) binnen = !binnen
    }
    return binnen
  }

  let laatsteNx = 0, laatsteNy = -1
  function botsVorm(o) {
    const pts = vormPunten(o)
    if (pts.length < 3) return false
    const straal = BAL_GROOTTE / 2
    let besteD = Infinity, bdx = 0, bdy = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      const vx = b[0] - a[0], vy = b[1] - a[1]
      const l2 = vx * vx + vy * vy
      let t = l2 ? ((bal.x - a[0]) * vx + (bal.y - a[1]) * vy) / l2 : 0
      t = Math.max(0, Math.min(1, t))
      const dx = bal.x - (a[0] + t * vx), dy = bal.y - (a[1] + t * vy)
      const d = Math.hypot(dx, dy)
      if (d < besteD) { besteD = d; bdx = dx; bdy = dy }
    }
    const binnen = inVorm(bal.x, bal.y, pts)
    if (!binnen && besteD > straal) return false
    let nx, ny
    if (besteD > 0.0001) { nx = bdx / besteD; ny = bdy / besteD } else { nx = 0; ny = -1 }
    if (binnen) { nx = -nx; ny = -ny }
    const dot = bal.vx * nx + bal.vy * ny
    if (dot > 0) return false
    bal.vx -= 2 * dot * nx
    bal.vy -= 2 * dot * ny
    const diep = (binnen ? straal + besteD : straal - besteD) + 0.5
    bal.x += nx * diep
    bal.y += ny * diep
    laatsteNx = nx; laatsteNy = ny
    return true
  }

  function getLevelObstakels(level) {
    const W = BREEDTE, H = HOOGTE
    const bs = 22 // bumper size
    switch(level) {
      case 1: return []
      case 2: return [ // hoek-bumpers
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'}]
      case 3: return [ // 3 extra hoeken midden
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'hoek',x:0,y:H/3,richting:'lb'},{type:'hoek',x:W,y:H/3,richting:'rb'},
        {type:'hoek',x:0,y:2*H/3,richting:'lt'},{type:'hoek',x:W,y:2*H/3,richting:'rt'},
        {type:'ruit',x:W/2,y:H/2,r:20}]
      case 4: return [ // hoek-bumpers + ruit midden
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'ruit',x:W/2,y:H/2,r:28}]
      case 5: return [ // hoek + zijkant + 2 ruiten
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'zijkant',x:0,y:H/2-25,richting:'l'},{type:'zijkant',x:W,y:H/2-25,richting:'r'},
        {type:'ruit',x:W/2,y:H/3,r:22},{type:'ruit',x:W/2,y:2*H/3,r:22}]
      case 6: return [ // zijkant-bumpers + ruit
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'zijkant',x:0,y:60,richting:'l'},{type:'zijkant',x:W,y:60,richting:'r'},
        {type:'zijkant',x:0,y:H-110,richting:'l'},{type:'zijkant',x:W,y:H-110,richting:'r'},
        {type:'ruit',x:W/2,y:H/2,r:28}]
      case 7: return [ // zijkant-bumpers + 2 verticale staven
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'zijkant',x:0,y:60,richting:'l'},{type:'zijkant',x:W,y:60,richting:'r'},
        {type:'zijkant',x:0,y:H-110,richting:'l'},{type:'zijkant',x:W,y:H-110,richting:'r'},
        {type:'rect',x:W/2-30,y:H/2-30,b:14,h:60},{type:'rect',x:W/2+16,y:H/2-30,b:14,h:60}]
      default: return []
    }
  }
  let gameOver = false
  let animatieFrame = null
  let laatsteVerstuurd = 0
  let beideKlaar = false
  let aftellen = 0  // >0 = bezig met aftellen

  // ── Geluid via Web Audio ──
  let audioCtx = null
  function piep(freq, duur, volume) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain); gain.connect(audioCtx.destination)
      osc.frequency.value = freq
      osc.type = 'square'
      gain.gain.setValueAtTime(volume || 0.15, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (duur || 0.1))
      osc.start()
      osc.stop(audioCtx.currentTime + (duur || 0.1))
    } catch(e) {}
  }
  let geluidBuffer = []
  // Hoe sneller de bal, hoe hoger de toon
  const toonhoogte = (basis) => basis * (1 + Math.max(0, Math.min(1, (Math.hypot(bal.vx, bal.vy) - 3.5) / 3.5)) * 0.5)
  const geluidStuiter = () => { piep(toonhoogte(440), 0.06, 0.12); geluidBuffer.push('stuiter') }
  const geluidScore = () => { piep(220, 0.25, 0.18); geluidBuffer.push('score') }
  const geluidWin = () => { piep(523,0.12,0.2); setTimeout(()=>piep(659,0.12,0.2),120); setTimeout(()=>piep(784,0.2,0.2),240) }
  const geluidTik = () => { piep(toonhoogte(660), 0.08, 0.15); geluidBuffer.push('tik') }
  function speelGeluid(soort) {
    if (soort === 'stuiter') piep(440, 0.06, 0.12)
    else if (soort === 'score') piep(220, 0.25, 0.18)
    else if (soort === 'tik') piep(660, 0.08, 0.15)
  }

  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
      <div id="pong-status" style="color:#00f0ff;font-size:14px;font-weight:700;letter-spacing:1px;text-shadow:0 0 8px #00f0ff;">Jij: <span id="pong-mijn-score">0</span> — <span id="pong-naam">${vriendNaam}</span>: <span id="pong-vriend-score">0</span></div>
      <div id="pong-match" style="font-size:12px;font-weight:700;letter-spacing:1px;min-height:15px;"></div>
      <canvas id="pong-canvas" width="${BREEDTE}" height="${HOOGTE}" style="background:#050510;border:2px solid #ff00cc;border-radius:8px;touch-action:none;box-shadow:0 0 30px rgba(255,0,204,0.5),0 0 60px rgba(255,0,204,0.2),inset 0 0 30px rgba(0,0,0,0.8);"></canvas>
      <div style="font-size:11px;color:rgba(255,255,255,0.6);">Sleep om je paddle te bewegen</div>
      <button id="pong-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">↻ Opnieuw spelen</button>
    </div>`

  const canvas = document.getElementById('pong-canvas')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('pong-status')
  const mijnScoreEl = document.getElementById('pong-mijn-score')
  const vriendScoreEl = document.getElementById('pong-vriend-score')
  const matchEl = document.getElementById('pong-match')
  const opnieuwBtn = document.getElementById('pong-opnieuw')

  function tekenScherm() {
    ctx.fillStyle = "#050510"
    ctx.fillRect(0, 0, BREEDTE, HOOGTE)
    ctx.save()
    if (schok > 0.2) {
      ctx.translate((Math.random() - 0.5) * schok, (Math.random() - 0.5) * schok)
      schok *= 0.82
    } else schok = 0
    ctx.strokeStyle = "rgba(255,255,255,0.03)"
    ctx.lineWidth = 1
    for (let gx = 0; gx < BREEDTE; gx += 20) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,HOOGTE); ctx.stroke() }
    for (let gy = 0; gy < HOOGTE; gy += 20) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(BREEDTE,gy); ctx.stroke() }
    ctx.strokeStyle = "rgba(255,255,255,0.08)"
    ctx.setLineDash([8, 8])
    ctx.beginPath(); ctx.moveTo(0, HOOGTE/2); ctx.lineTo(BREEDTE, HOOGTE/2); ctx.stroke()
    ctx.setLineDash([])
    ctx.save(); ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 16; ctx.fillStyle = "#00f0ff"
    const verschil = vriendPaddleX - vriendPaddleTekenX
    // Klein verschil: soepel bijtrekken. Groot verschil (na een pauze): meteen goed zetten.
    vriendPaddleTekenX += Math.abs(verschil) > 60 ? verschil : verschil * 0.25
    ctx.fillRect(vriendPaddleTekenX, PADDLE_Y_BOVEN, PADDLE_BREEDTE, PADDLE_HOOGTE); ctx.restore()
    ctx.save(); ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 16; ctx.fillStyle = "#00f0ff"
    ctx.fillRect(mijnPaddleX, PADDLE_Y_ONDER, PADDLE_BREEDTE, PADDLE_HOOGTE); ctx.restore()
    if (!pongTrail) pongTrail = []
    pongTrail.push({x: bal.x, y: bal.y})
    if (pongTrail.length > 10) pongTrail.shift()
    for (let i = 0; i < pongTrail.length; i++) {
      const tp = pongTrail[i]
      const alpha = (i / pongTrail.length) * 0.4
      const tr = (BAL_GROOTTE/2) * (i / pongTrail.length) * 0.8
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#ffffff"
      ctx.beginPath(); ctx.arc(tp.x, tp.y, tr, 0, Math.PI*2); ctx.fill(); ctx.restore()
    }
    // De bal kleurt mee met zijn snelheid: rustig = wit, snel = oranjerood.
    const balSnelheid = Math.hypot(bal.vx, bal.vy)
    const heet = Math.max(0, Math.min(1, (balSnelheid - 3.5) / 3.5))
    const balKleur = heet < 0.5
      ? 'rgb(255,255,' + Math.round(255 - heet * 2 * 90) + ')'
      : 'rgb(255,' + Math.round(255 - (heet - 0.5) * 2 * 150) + ',' + Math.round(165 - (heet - 0.5) * 2 * 165) + ')'
    ctx.save()
    ctx.shadowColor = heet > 0.35 ? balKleur : "#00f0ff"
    ctx.shadowBlur = 20 + heet * 18
    ctx.fillStyle = balKleur
    ctx.beginPath(); ctx.arc(bal.x, bal.y, BAL_GROOTTE/2 + heet, 0, Math.PI*2); ctx.fill(); ctx.restore()
    // Teken obstakels
    const obs = getLevelObstakels(huidigLevel)
    const bs = 22
    obs.forEach(o => {
      ctx.save(); ctx.shadowColor = "#ff00cc"; ctx.shadowBlur = 12; ctx.fillStyle = "#ff00cc"
      if (o.type === "rect") {
        ctx.fillRect(o.x, o.y, o.b, o.h)
      } else if (o.type === "ruit") {
        ctx.beginPath(); ctx.moveTo(o.x,o.y-o.r); ctx.lineTo(o.x+o.r,o.y); ctx.lineTo(o.x,o.y+o.r); ctx.lineTo(o.x-o.r,o.y); ctx.closePath(); ctx.fill()
      } else if (o.type === "hoek") {
        ctx.beginPath()
        if(o.richting==="lt"){ ctx.moveTo(o.x,o.y); ctx.lineTo(o.x+bs,o.y); ctx.lineTo(o.x,o.y+bs) }
        else if(o.richting==="rt"){ ctx.moveTo(o.x,o.y); ctx.lineTo(o.x-bs,o.y); ctx.lineTo(o.x,o.y+bs) }
        else if(o.richting==="lb"){ ctx.moveTo(o.x,o.y); ctx.lineTo(o.x+bs,o.y); ctx.lineTo(o.x,o.y-bs) }
        else if(o.richting==="rb"){ ctx.moveTo(o.x,o.y); ctx.lineTo(o.x-bs,o.y); ctx.lineTo(o.x,o.y-bs) }
        ctx.closePath(); ctx.fill()
      } else if (o.type === "zijkant") {
        ctx.beginPath()
        if(o.richting==="l"){ ctx.moveTo(o.x,o.y); ctx.lineTo(o.x+bs,o.y+25); ctx.lineTo(o.x,o.y+50) }
        else{ ctx.moveTo(o.x,o.y); ctx.lineTo(o.x-bs,o.y+25); ctx.lineTo(o.x,o.y+50) }
        ctx.closePath(); ctx.fill()
      }
      ctx.restore()
    })
    // Vonkjes
    for (let i = vonken.length - 1; i >= 0; i--) {
      const v = vonken[i]
      v.x += v.vx; v.y += v.vy; v.vx *= 0.92; v.vy *= 0.92; v.leven -= 0.06
      if (v.leven <= 0) { vonken.splice(i, 1); continue }
      ctx.save(); ctx.globalAlpha = v.leven
      ctx.fillStyle = "#ff00cc"; ctx.shadowColor = "#ff00cc"; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.arc(v.x, v.y, 1.6 * v.leven + 0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
    ctx.restore()

    // Level indicator
    ctx.save(); ctx.fillStyle = "rgba(255,0,204,0.4)"; ctx.font = "bold 11px monospace"
    ctx.textAlign = "right"; ctx.textBaseline = "top"
    ctx.fillText("LVL " + huidigLevel, BREEDTE-4, 4); ctx.restore()
    ctx.save(); ctx.fillStyle = "#ff00cc"; ctx.shadowColor = "#ff00cc"; ctx.shadowBlur = 12
    ctx.font = "bold 22px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    ctx.fillText(vriendScore, BREEDTE/2, 36)
    ctx.fillStyle = "#00f0ff"; ctx.shadowColor = "#00f0ff"
    ctx.textBaseline = "bottom"
    ctx.fillText(mijnScore, BREEDTE/2, HOOGTE - 36)
    ctx.restore()
  }

  // ── Drag-besturing voor mijn paddle (werkt overal op het scherm, niet alleen op canvas) ──
  const besturingsVlak = document.getElementById('spelOverlay')

  function paddleVanX(clientX) {
    const rect = canvas.getBoundingClientRect()
    const schaal = BREEDTE / rect.width
    let x = (clientX - rect.left) * schaal - PADDLE_BREEDTE / 2
    return Math.max(0, Math.min(BREEDTE - PADDLE_BREEDTE, x))
  }
  function pongTouchMove(e) {
    if (!isActief()) return
    if (e.target.tagName === 'BUTTON') return
    e.preventDefault()
    mijnPaddleX = paddleVanX(e.touches[0].clientX)
    verstuurPaddle()
  }
  function pongTouchStart(e) {
    if (!isActief()) return
    if (e.target.tagName === 'BUTTON') return
    mijnPaddleX = paddleVanX(e.touches[0].clientX)
    verstuurPaddle()
  }
  besturingsVlak.addEventListener('touchmove', pongTouchMove, { passive: false })
  besturingsVlak.addEventListener('touchstart', pongTouchStart, { passive: true })
  let muisActief = false
  besturingsVlak.addEventListener('mousedown', e => {
    if (!isActief()) return
    if (e.target.tagName === 'BUTTON') return
    muisActief = true
    mijnPaddleX = paddleVanX(e.clientX)
    verstuurPaddle()
  })
  window.addEventListener('mouseup', () => muisActief = false)
  besturingsVlak.addEventListener('mousemove', e => {
    if (!isActief() || !muisActief) return
    mijnPaddleX = paddleVanX(e.clientX)
    verstuurPaddle()
  })

  function verstuurPaddle() {
    spelKanaal.send({ type: 'broadcast', event: 'paddle', payload: { x: mijnPaddleX } })
  }

  spelKanaal.on('broadcast', { event: 'paddle' }, msg => {
    vriendPaddleX = msg.payload.x
  })

  // ── Host-only: bal physics ──
  function botsPaddle(px) {
    return bal.x + BAL_GROOTTE/2 > px && bal.x - BAL_GROOTTE/2 < px + PADDLE_BREEDTE
  }

  function physicsStap() {
    bal.x += bal.vx
    bal.y += bal.vy

    // Zijwanden
    if (bal.x - BAL_GROOTTE/2 < 0 || bal.x + BAL_GROOTTE/2 > BREEDTE) {
      bal.vx *= -1
      bal.x = Math.max(BAL_GROOTTE/2, Math.min(BREEDTE - BAL_GROOTTE/2, bal.x))
      geluidStuiter()
    }

    mijnPaddleV = mijnPaddleX - vorigMijnPaddleX
    vriendPaddleV = vriendPaddleX - vorigVriendPaddleX
    vorigMijnPaddleX = mijnPaddleX
    vorigVriendPaddleX = vriendPaddleX

    // Mijn paddle (onder) — host speelt zelf ook gewoon mee
    if (bal.y + BAL_GROOTTE/2 > PADDLE_Y_ONDER && bal.y + BAL_GROOTTE/2 < PADDLE_Y_ONDER + PADDLE_HOOGTE + 6 && bal.vy > 0) {
      if (botsPaddle(mijnPaddleX)) {
        const raak1 = (bal.x - (mijnPaddleX + PADDLE_BREEDTE/2)) / (PADDLE_BREEDTE/2)
        const snelheid1 = Math.sqrt(bal.vx*bal.vx + bal.vy*bal.vy) * 1.04
        const hoek1 = raak1 * 1.1
        bal.vx = Math.sin(hoek1) * snelheid1
        bal.vy = -Math.abs(Math.cos(hoek1) * snelheid1)
        bal.y = PADDLE_Y_ONDER - BAL_GROOTTE/2
        geefEffect(mijnPaddleV)
        geluidStuiter()
      }
    }
    // Vriend paddle (boven)
    if (bal.y - BAL_GROOTTE/2 < PADDLE_Y_BOVEN + PADDLE_HOOGTE && bal.y - BAL_GROOTTE/2 > PADDLE_Y_BOVEN - 6 && bal.vy < 0) {
      if (botsPaddle(vriendPaddleX)) {
        const raak2 = (bal.x - (vriendPaddleX + PADDLE_BREEDTE/2)) / (PADDLE_BREEDTE/2)
        const snelheid2 = Math.sqrt(bal.vx*bal.vx + bal.vy*bal.vy) * 1.04
        const hoek2 = raak2 * 1.1
        bal.vx = Math.sin(hoek2) * snelheid2
        bal.vy = Math.abs(Math.cos(hoek2) * snelheid2)
        bal.y = PADDLE_Y_BOVEN + PADDLE_HOOGTE + BAL_GROOTTE/2
        geefEffect(vriendPaddleV)
        geluidStuiter()
      }
    }

    // Score: bal voorbij boven (ik scoor) of onder (vriend scoort)
    if (bal.y < -20) {
      mijnScore++
      geluidScore()
      resetBal(-1)
    } else if (bal.y > HOOGTE + 20) {
      vriendScore++
      geluidScore()
      resetBal(1)
    }

    // Obstakels botsen
    getLevelObstakels(huidigLevel).forEach(o => { if (botsVorm(o)) { geluidTik(); maakVonken(bal.x, bal.y, laatsteNx, laatsteNy, Math.hypot(bal.vx, bal.vy)) } })

    // Snelheid begrenzen
    const maxSnelheid = 7
    bal.vx = Math.max(-maxSnelheid, Math.min(maxSnelheid, bal.vx))
    bal.vy = Math.max(-maxSnelheid, Math.min(maxSnelheid, bal.vy))

    checkWinst()
  }

  function controleerLevel() {
    if (mijnScore >= WIN_SCORE || vriendScore >= WIN_SCORE) {
      if (huidigLevel < MAX_LEVEL) {
        huidigLevel++
        spelKanaal.send({ type: "broadcast", event: "level-update", payload: { level: huidigLevel } })
      }
    }
  }
  function resetBal(richting) {
    const startX = mijnPaddleX + PADDLE_BREEDTE/2
    const startY = richting < 0 ? PADDLE_Y_ONDER - 20 : PADDLE_Y_BOVEN + PADDLE_HOOGTE + 20
    const hoek = (Math.random()-0.5) * 0.8
    const snelheid = 3.5
    bal = { x: startX, y: startY, vx: Math.sin(hoek)*snelheid, vy: richting < 0 ? -snelheid : snelheid }
  }

  function tekenEindScherm() {
    const winnaar = mijnScore >= WIN_SCORE
    ctx.fillStyle = "#050510"
    ctx.fillRect(0, 0, BREEDTE, HOOGTE)
    ctx.save()
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    const winNaam = winnaar ? "JIJ" : vriendNaam.toUpperCase()
    const verliesNaam = winnaar ? vriendNaam.toUpperCase() : "JIJ"
    ctx.font = "bold 14px monospace"; ctx.fillStyle = winnaar ? "#00f0ff" : "#ff00cc"; ctx.shadowColor = winnaar ? "#00f0ff" : "#ff00cc"; ctx.shadowBlur = 20
    ctx.fillText("WINNAAR", BREEDTE/2, HOOGTE/2 - 60)
    ctx.font = "bold 32px monospace"
    ctx.fillText(winNaam, BREEDTE/2, HOOGTE/2 - 30)
    ctx.font = "bold 48px monospace"; ctx.shadowBlur = 40
    ctx.fillText(mijnScore + " — " + vriendScore, BREEDTE/2, HOOGTE/2 + 20)
    ctx.font = "bold 14px monospace"; ctx.fillStyle = winnaar ? "#ff00cc" : "#00f0ff"; ctx.shadowColor = winnaar ? "#ff00cc" : "#00f0ff"; ctx.shadowBlur = 20
    ctx.fillText("VERLIEZER", BREEDTE/2, HOOGTE/2 + 60)
    ctx.font = "bold 20px monospace"
    ctx.fillText(verliesNaam, BREEDTE/2, HOOGTE/2 + 82)
    ctx.restore()
  }
  function checkWinst() {
    if (mijnScore >= WIN_SCORE || vriendScore >= WIN_SCORE) {
      gameOver = true
      controleerLevel()
      const winnaar = mijnScore >= WIN_SCORE
    statusEl.textContent = winnaar ? '🎉 Jij wint!' : '😢 ' + (vriendNaam) + ' wint!'

      opnieuwBtn.style.display = 'block'
      if (animatieFrame) cancelAnimationFrame(animatieFrame)
    }
  }

  function updateScoreUI() {
    mijnScoreEl.textContent = mijnScore
    vriendScoreEl.textContent = vriendScore
    // Matchpoint: laat zien wanneer iemand op winst staat
    if (!gameOver && (mijnScore === WIN_SCORE - 1 || vriendScore === WIN_SCORE - 1)) {
      const wie = mijnScore === WIN_SCORE - 1 && vriendScore === WIN_SCORE - 1 ? 'BESLISSEND PUNT'
        : mijnScore === WIN_SCORE - 1 ? 'JIJ STAAT OP WINST' : 'LET OP: TEGENSTANDER OP WINST'
      matchEl.textContent = wie
      matchEl.style.color = mijnScore === WIN_SCORE - 1 ? '#00f0ff' : '#ff00cc'
      matchEl.style.textShadow = '0 0 8px ' + matchEl.style.color
    } else matchEl.textContent = ''
  }

  // ── Game loop ──
  function loop(tijdstip) {
    if (gameOver) return

    if (gameOver) { tekenEindScherm(); return }
    if (benIkHost) {
      physicsStap()
      if (tijdstip - laatsteVerstuurd > 50) {
        laatsteVerstuurd = tijdstip
        spelKanaal.send({ type: 'broadcast', event: 'balstaat', payload: { bal, mijnScore, vriendScore, geluiden: geluidBuffer } })
        geluidBuffer = []
        updateScoreUI()
      }
    }

    tekenScherm()
    animatieFrame = requestAnimationFrame(loop)
  }

  // Gast ontvangt bal-staat van de host. BELANGRIJK: de host stuurt zijn EIGEN coordinatenstelsel
  // door (host's paddle = onder, bal.y groot = dicht bij host). Bij de gast staat zijn eigen paddle
  // OOK altijd onderaan op zijn scherm — dus de bal-positie moet gespiegeld worden (y -> HOOGTE - y,
  // vx/vy omgedraaid) zodat de bal bij de gast fysiek correct lijkt te bewegen.
  spelKanaal.on('broadcast', { event: 'balstaat' }, msg => {
    if (benIkHost) return
    const ontvangenBal = msg.payload.bal
    bal = {
      x: ontvangenBal.x,
      y: HOOGTE - ontvangenBal.y,
      vx: ontvangenBal.vx,
      vy: -ontvangenBal.vy,
    }
    vriendScore = msg.payload.mijnScore   // host's score = mijn tegenstander
    mijnScore = msg.payload.vriendScore   // host's vriendScore = mijn eigen score
    if (msg.payload.geluiden && msg.payload.geluiden.length) {
      msg.payload.geluiden.forEach(g => speelGeluid(g))
    }
    updateScoreUI()
    checkWinst()
  })

  function gastLoop() {
    if (gameOver) { tekenEindScherm(); return }
    tekenScherm()
    animatieFrame = requestAnimationFrame(gastLoop)
  }

  function herstartLoop() {
    if (animatieFrame) cancelAnimationFrame(animatieFrame)
    if (benIkHost) animatieFrame = requestAnimationFrame(loop)
    else animatieFrame = requestAnimationFrame(gastLoop)
  }

  spelKanaal.on('broadcast', { event: 'level-update' }, msg => {
    huidigLevel = msg.payload.level
  })
  spelKanaal.on('broadcast', { event: 'opnieuw' }, () => {
    mijnScore = 0; vriendScore = 0
    gameOver = false
    opnieuwBtn.style.display = 'none'
    resetBal(benIkHost ? 1 : -1)
    updateScoreUI()
    herstartLoop()
  })

  opnieuwBtn.addEventListener('click', () => {
    mijnScore = 0; vriendScore = 0
    gameOver = false
    opnieuwBtn.style.display = 'none'
    resetBal(1)
    updateScoreUI()
    spelKanaal.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
    herstartLoop()
  })

  // ── Wachtkamer: wacht tot beide spelers klaar zijn ──
  let ikKlaarGemeld = false
  let anderKlaar = false

  function meldIkBenKlaar() {
    if (ikKlaarGemeld) return
    ikKlaarGemeld = true
    spelKanaal.send({ type: 'broadcast', event: 'pong-klaar', payload: {} })
    checkBeideKlaar()
  }

  spelKanaal.on('broadcast', { event: 'pong-klaar' }, () => {
    anderKlaar = true
    // Stuur ook terug zodat de ander ook weet dat wij klaar zijn
    if (ikKlaarGemeld) spelKanaal.send({ type: 'broadcast', event: 'pong-klaar-terug', payload: {} })
    checkBeideKlaar()
  })
  spelKanaal.on('broadcast', { event: 'pong-klaar-terug' }, () => {
    anderKlaar = true
    checkBeideKlaar()
  })

  function checkBeideKlaar() {
    if (ikKlaarGemeld && anderKlaar && !beideKlaar) {
      beideKlaar = true
      startAftellen()
    }
  }

  function startAftellen() {
    aftellen = 3
    geluidTik()
    tekenWachtScherm()
    const interval = setInterval(() => {
      aftellen--
      if (aftellen > 0) {
        geluidTik()
        tekenWachtScherm()
      } else {
        clearInterval(interval)
        geluidStuiter()
        statusEl.textContent = 'Jij: 0 — ' + vriendNaam + ': 0'
        // Herbouw status met scores
        statusEl.innerHTML = 'Jij: <span id="pong-mijn-score">0</span> — <span id="pong-naam">' + vriendNaam + '</span>: <span id="pong-vriend-score">0</span>'
        herstartLoop()
      }
    }, 1000)
  }

  function tekenWachtScherm() {
    ctx.fillStyle = '#050510'
    ctx.fillRect(0, 0, BREEDTE, HOOGTE)
    ctx.save()
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 40
    ctx.fillStyle = '#00f0ff'
    ctx.font = 'bold 80px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(aftellen, BREEDTE/2, HOOGTE/2)
    ctx.restore()
    ctx.save()
    ctx.fillStyle = '#00f0ff'
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 16
    ctx.font = 'bold 28px monospace'
    ctx.fillText(mijnScore + '  —  ' + vriendScore, BREEDTE/2, 24)
    ctx.restore()
  }

  // Start: toon wachtscherm en meld dat ik klaar ben
  statusEl.textContent = 'Wachten op tegenstander...'
  ctx.clearRect(0, 0, BREEDTE, HOOGTE)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Wachten...', BREEDTE/2, HOOGTE/2)
  // Meld na klein moment dat ik klaar ben (kanaal moet subscribed zijn)
  setTimeout(meldIkBenKlaar, 800)
  // Blijf melden tot de ander reageert (voor het geval de ander later klaar is)
  const klaarHerhaal = setInterval(() => {
    if (beideKlaar) { clearInterval(klaarHerhaal); return }
    spelKanaal.send({ type: 'broadcast', event: 'pong-klaar', payload: {} })
  }, 1500)

}
