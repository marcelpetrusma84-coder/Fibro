// flappy-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
  vriendNaam = vriendNaam || 'vriend'
  isActief = isActief || (() => true)
  document.getElementById('spelTitelBar').textContent = '🐦 Flappy Bird'
  const inhoud = document.getElementById('spelInhoud')

  const B = 280, H = 380
  const VOGEL_X = 55, VOGEL_R = 14
  const VOGEL_X_VRIEND = 95  // ver genoeg uit elkaar (55 + 14 + 14 + 12 = 95)
  const ZWAARTEKRACHT = 0.35, FLAP_KRACHT = -7
  const BUIS_BREEDTE = 52, BUIS_GAP = 110, BUIS_SNELHEID = 2.2
  const benIkHost = benIkSpeler1

  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
      <div id="fb-status" style="color:white;font-size:13px;font-weight:600;min-height:18px;text-align:center;"></div>
      <canvas id="fb-canvas" width="${B}" height="${H}" style="border-radius:12px;border:2px solid rgba(255,255,255,0.15);touch-action:none;display:block;"></canvas>
      <div style="display:flex;gap:20px;">
        <div style="color:white;font-size:12px;text-align:center;">
          <div style="font-size:22px;">🐦</div>
          <div id="fb-score-mij" style="font-weight:700;font-size:18px;">0</div>
          <div style="opacity:0.6;font-size:11px;">Jij</div>
        </div>
        <div style="color:white;font-size:12px;text-align:center;">
          <div style="font-size:22px;">🐤</div>
          <div id="fb-score-vriend" style="font-weight:700;font-size:18px;">0</div>
          <div style="opacity:0.6;font-size:11px;">${vriendNaam}</div>
        </div>
      </div>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;">Tik op het scherm om te vliegen</div>
    </div>`

  const canvas = document.getElementById('fb-canvas')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('fb-status')

  // ── Spelstaat ──
  let mijnVogel = { y: H / 2, vy: 0, dood: false }
  let vriendVogel = { y: H / 2, vy: 0, dood: false }
  let buizen = []           // alleen host berekent/verstuurt buizen
  let frame = 0
  let mijnScore = 0
  let vriendScore = 0
  let gameOver = false
  let aftellen = 3
  let aftelInterval = null
  let animFrame = null

  function nieuweBuis() {
    const gapY = 80 + Math.random() * (H - BUIS_GAP - 140)
    return { x: B, gapY, geteld: false }
  }

  function teken() {
    // Achtergrond: lucht -> grond
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#1a0a3e')
    sky.addColorStop(0.7, '#2d1b6e')
    sky.addColorStop(1, '#3d2f1a')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, B, H)

    // Grond
    ctx.fillStyle = '#5a3e1b'
    ctx.fillRect(0, H - 30, B, 30)
    ctx.fillStyle = '#7a5c2e'
    ctx.fillRect(0, H - 30, B, 6)

    // Buizen
    buizen.forEach(b => {
      // Boven buis
      const gradBuis = ctx.createLinearGradient(b.x, 0, b.x + BUIS_BREEDTE, 0)
      gradBuis.addColorStop(0, '#2d7a2d')
      gradBuis.addColorStop(0.4, '#3da83d')
      gradBuis.addColorStop(1, '#1a4d1a')
      ctx.fillStyle = gradBuis
      ctx.fillRect(b.x, 0, BUIS_BREEDTE, b.gapY)
      ctx.fillRect(b.x - 4, b.gapY - 20, BUIS_BREEDTE + 8, 20)
      // Onder buis
      ctx.fillStyle = gradBuis
      ctx.fillRect(b.x, b.gapY + BUIS_GAP, BUIS_BREEDTE, H)
      ctx.fillRect(b.x - 4, b.gapY + BUIS_GAP, BUIS_BREEDTE + 8, 20)
    })

    // Mijn vogel (blauw)
    tekenVogel(ctx, VOGEL_X, mijnVogel.y, mijnVogel.dood, '#60a5fa')

    // Vriend vogel (geel) — eigen X-baan, nooit overlap mogelijk
    tekenVogel(ctx, VOGEL_X_VRIEND, vriendVogel.y, vriendVogel.dood, '#fbbf24')
  }

  function tekenVogel(ctx, x, y, dood, kleur) {
    ctx.save()
    if (dood) {
      ctx.globalAlpha = 0.4
      ctx.translate(x, y)
      ctx.rotate(Math.PI / 2)
    } else {
      ctx.translate(x, y)
      // Lichte rotatie obv snelheid
    }
    ctx.beginPath()
    ctx.arc(0, 0, VOGEL_R, 0, Math.PI * 2)
    ctx.fillStyle = kleur
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 2
    ctx.stroke()
    // Oog
    ctx.beginPath()
    ctx.arc(5, -3, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(6, -3, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = '#1a0a2e'
    ctx.fill()
    ctx.restore()
  }

  function controleerBotsing(vogelY, vogelX) {
    if (vogelY - VOGEL_R < 0 || vogelY + VOGEL_R > H - 30) return true
    for (const b of buizen) {
      if (vogelX + VOGEL_R > b.x + 4 && vogelX - VOGEL_R < b.x + BUIS_BREEDTE - 4) {
        if (vogelY - VOGEL_R < b.gapY || vogelY + VOGEL_R > b.gapY + BUIS_GAP) return true
      }
    }
    return false
  }

  function update() {
    if (gameOver) return
    frame++

    // Mijn vogel physics
    if (!mijnVogel.dood) {
      mijnVogel.vy += ZWAARTEKRACHT
      mijnVogel.y += mijnVogel.vy
      if (controleerBotsing(mijnVogel.y, VOGEL_X)) {
        mijnVogel.dood = true
        spelKanaal.send({ type: 'broadcast', event: 'fb-dood', payload: {} })
        controleerEinde()
      }
    }

    // Host: buizen bewegen en synchroniseren
    if (benIkHost) {
      // Nieuwe buis elke ~90 frames
      if (frame % 90 === 0) {
        const b = nieuweBuis()
        buizen.push(b)
        spelKanaal.send({ type: 'broadcast', event: 'fb-buis', payload: { gapY: b.gapY } })
      }
      buizen.forEach(b => b.x -= BUIS_SNELHEID)
      buizen = buizen.filter(b => b.x + BUIS_BREEDTE > 0)

      // Score: buis voorbij gevlogen
      buizen.forEach(b => {
        if (!b.geteld && b.x + BUIS_BREEDTE < VOGEL_X) {
          b.geteld = true
          if (!mijnVogel.dood) {
            mijnScore++
            document.getElementById('fb-score-mij').textContent = mijnScore
          }
          spelKanaal.send({ type: 'broadcast', event: 'fb-score-host', payload: { score: mijnScore } })
        }
      })

      // Sync vogelposities periodiek
      if (frame % 3 === 0) {
        spelKanaal.send({ type: 'broadcast', event: 'fb-sync', payload: {
          buizen: buizen.map(b => ({ x: b.x, gapY: b.gapY, geteld: b.geteld })),
          vogelY: mijnVogel.y
        }})
      }
    } else {
      // Gast: score eigen doorgangen
      buizen.forEach(b => {
        if (!b.geteld && b.x + BUIS_BREEDTE < VOGEL_X) {
          b.geteld = true
          if (!mijnVogel.dood) {
            mijnScore++
            document.getElementById('fb-score-mij').textContent = mijnScore
            spelKanaal.send({ type: 'broadcast', event: 'fb-score-gast', payload: { score: mijnScore } })
          }
        }
      })
      if (frame % 3 === 0) {
        spelKanaal.send({ type: 'broadcast', event: 'fb-vogel-gast', payload: { y: mijnVogel.y } })
      }
    }

    teken()
    animFrame = requestAnimationFrame(update)
  }

  function controleerEinde() {
    const beideDood = mijnVogel.dood && vriendVogel.dood
    const ikDood = mijnVogel.dood && !vriendVogel.dood

    if (beideDood) {
      gameOver = true
      cancelAnimationFrame(animFrame)
      teken()
      const gelijkspel = mijnScore === vriendScore
      const ikWin = mijnScore > vriendScore
      statusEl.textContent = gelijkspel ? '🤝 Gelijkspel!' : ikWin ? '🎉 Jij wint!' : '😢 ' + vriendNaam + ' wint!'
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
  }

  function herstart() {
    mijnVogel = { y: H / 2, vy: 0, dood: false }
    vriendVogel = { y: H / 2, vy: 0, dood: false }
    buizen = []
    frame = 0
    mijnScore = 0
    vriendScore = 0
    gameOver = false
    document.getElementById('fb-score-mij').textContent = '0'
    document.getElementById('fb-score-vriend').textContent = '0'
    statusEl.textContent = ''
    inhoud.querySelectorAll('button.fb-herstart').forEach(b => b.remove())
    animFrame = requestAnimationFrame(update)
  }

  function flap() {
    if (gameOver || mijnVogel.dood) return
    mijnVogel.vy = FLAP_KRACHT
  }

  // ── Aftellen ──
  statusEl.textContent = `Start in ${aftellen}...`
  aftelInterval = setInterval(() => {
    aftellen--
    if (aftellen > 0) {
      statusEl.textContent = `Start in ${aftellen}...`
    } else {
      clearInterval(aftelInterval)
      window._spelAftelInterval = null
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
  spelKanaal.on('broadcast', { event: 'fb-buis' }, (msg) => {
    if (!benIkHost) buizen.push({ x: B, gapY: msg.payload.gapY, geteld: false })
  })
  spelKanaal.on('broadcast', { event: 'fb-sync' }, (msg) => {
    if (!benIkHost) {
      buizen = msg.payload.buizen
      vriendVogel.y = msg.payload.vogelY
    }
  })
  spelKanaal.on('broadcast', { event: 'fb-vogel-gast' }, (msg) => {
    if (benIkHost) vriendVogel.y = msg.payload.y
  })
  spelKanaal.on('broadcast', { event: 'fb-dood' }, () => {
    vriendVogel.dood = true
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
