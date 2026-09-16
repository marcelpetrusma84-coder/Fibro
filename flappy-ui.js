// flappy-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.
// Vleermuis-versie: grond en obstakels zijn massief, je bent af als je links of boven uit beeld raakt.

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
  vriendNaam = vriendNaam || 'vriend'
  isActief = isActief || (() => true)
  document.getElementById('spelTitelBar').textContent = '🦇 Flappy Vleermuis'
  const inhoud = document.getElementById('spelInhoud')

  const B = 280, H = 380
  const GROND_Y = H - 30
  const VOGEL_X = 55, VOGEL_R = 14
  const VOGEL_X_VRIEND = 95
  const HIT_R = 11                 // botsvak iets kleiner dan het lijf
  const ZWAARTEKRACHT = 0.35, FLAP_KRACHT = -7, MAX_VAL = 9
  const TERUG_SNELHEID = 0.5       // zweven terug naar startplek (0 = uit)
  const BUIS_BREEDTE = 52, BUIS_GAP = 110, BUIS_SNELHEID = 2.2
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
  <div style="color:rgba(255,255,255,0.4);font-size:11px;">Tik om te vliegen. Niet uit beeld raken!</div>
  </div>`

  const canvas = document.getElementById('fb-canvas')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('fb-status')

  // ── Spelstaat ──
  let mijnVogel = { x: VOGEL_X, y: H / 2, vy: 0, dood: false }
  let vriendVogel = { x: VOGEL_X_VRIEND, y: H / 2, vy: 0, dood: false }
  let buizen = []           // host maakt buizen, gast krijgt ze binnen
  let volgendeId = 0
  let mijnGeteld = new Set() // id's van buizen waar ik al punt voor kreeg
  let frame = 0
  let mijnScore = 0
  let vriendScore = 0
  let gameOver = false
  let aftellen = 3
  let aftelInterval = null
  let animFrame = null

  function nieuweBuis() {
    const gapY = 80 + Math.random() * (H - BUIS_GAP - 140)
    return { id: volgendeId++, x: B, gapY }
  }

  // ── Tekenen ──
  function teken() {
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#1a0a3e')
    sky.addColorStop(0.7, '#2d1b6e')
    sky.addColorStop(1, '#3d2f1a')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, B, H)

    // Maan
    ctx.beginPath()
    ctx.arc(B - 45, 45, 16, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(245,240,208,0.85)'
    ctx.fill()

    // Grond
    ctx.fillStyle = '#5a3e1b'
    ctx.fillRect(0, GROND_Y, B, 30)
    ctx.fillStyle = '#7a5c2e'
    ctx.fillRect(0, GROND_Y, B, 6)

    // Rotspilaren
    buizen.forEach(b => {
      const grad = ctx.createLinearGradient(b.x, 0, b.x + BUIS_BREEDTE, 0)
      grad.addColorStop(0, '#4a4458')
      grad.addColorStop(0.4, '#6b6580')
      grad.addColorStop(1, '#2e2a38')
      ctx.fillStyle = grad
      ctx.fillRect(b.x, 0, BUIS_BREEDTE, b.gapY)
      ctx.fillRect(b.x - 4, b.gapY - 20, BUIS_BREEDTE + 8, 20)
      ctx.fillRect(b.x, b.gapY + BUIS_GAP, BUIS_BREEDTE, H)
      ctx.fillRect(b.x - 4, b.gapY + BUIS_GAP, BUIS_BREEDTE + 8, 20)
    })

    if (!vriendVogel.dood) tekenVleermuis(vriendVogel.x, vriendVogel.y, vriendVogel.vy, '#fbbf24')
      if (!mijnVogel.dood) tekenVleermuis(mijnVogel.x, mijnVogel.y, mijnVogel.vy, '#60a5fa')
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
  }

  // ── Natuurkunde ──
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

      for (const b of buizen) {
        botsRechthoek(v, b.x - 4, -200, BUIS_BREEDTE + 8, b.gapY + 200)
        botsRechthoek(v, b.x - 4, b.gapY + BUIS_GAP, BUIS_BREEDTE + 8, H)
      }

      if (v.y + HIT_R > GROND_Y) {
        v.y = GROND_Y - HIT_R
        if (v.vy > 0) v.vy = 0
      }
  }

  function uitBeeld(v) {
    return v.x + VOGEL_R < 0 || v.y + VOGEL_R < 0
  }

  // ── Spellus ──
  function update() {
    if (gameOver) return
      frame++

      // Buizen eerst bewegen, zodat ze de vleermuis deze beurt kunnen duwen
      if (benIkHost && frame % 90 === 0) {
        const b = nieuweBuis()
        buizen.push(b)
        spelKanaal.send({ type: 'broadcast', event: 'fb-buis', payload: { id: b.id, gapY: b.gapY } })
      }
      buizen.forEach(b => b.x -= BUIS_SNELHEID)
      buizen = buizen.filter(b => b.x + BUIS_BREEDTE + 4 > -20)

      // Mijn vleermuis
      if (!mijnVogel.dood) {
        beweegVleermuis(mijnVogel)

        if (uitBeeld(mijnVogel)) {
          mijnVogel.dood = true
          spelKanaal.send({ type: 'broadcast', event: 'fb-dood', payload: {} })
          statusEl.textContent = vriendVogel.dood ? '' : `💀 Uit beeld! ${vriendNaam} vliegt nog...`
          controleerEinde()
        } else {
          // Punt voor elke pilaar die ik voorbij ben
          for (const b of buizen) {
            if (!mijnGeteld.has(b.id) && b.x + BUIS_BREEDTE + 4 < mijnVogel.x - HIT_R) {
              mijnGeteld.add(b.id)
              mijnScore++
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
            buizen: buizen.map(b => ({ id: b.id, x: b.x, gapY: b.gapY })),
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

  function herstart() {
    cancelAnimationFrame(animFrame)
    mijnVogel = { x: VOGEL_X, y: H / 2, vy: 0, dood: false }
    vriendVogel = { x: VOGEL_X_VRIEND, y: H / 2, vy: 0, dood: false }
    buizen = []
    volgendeId = 0
    mijnGeteld = new Set()
    frame = 0
    mijnScore = 0
    vriendScore = 0
    gameOver = false
    document.getElementById('fb-score-mij').textContent = '0'
    document.getElementById('fb-score-vriend').textContent = '0'
    statusEl.textContent = ''
    inhoud.querySelectorAll('button.fb-herstart').forEach(b => b.remove())
    animFrame = requestAnimationFrame(update)
    window._spelAnimFrame = animFrame
  }

  function flap() {
    if (gameOver || mijnVogel.dood) return
      mijnVogel.vy = FLAP_KRACHT
  }

  // ── Aftellen ──
  teken()
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
  function zetVriend(y, x) {
    vriendVogel.vy = (y - vriendVogel.y) / 3
    vriendVogel.y = y
    if (typeof x === 'number') vriendVogel.x = x
  }

  spelKanaal.on('broadcast', { event: 'fb-buis' }, (msg) => {
    if (!benIkHost) buizen.push({ id: msg.payload.id, x: B, gapY: msg.payload.gapY })
  })
  spelKanaal.on('broadcast', { event: 'fb-sync' }, (msg) => {
    if (!benIkHost) {
      buizen = msg.payload.buizen
      zetVriend(msg.payload.vogelY, msg.payload.vogelX)
    }
  })
  spelKanaal.on('broadcast', { event: 'fb-vogel-gast' }, (msg) => {
    if (benIkHost) zetVriend(msg.payload.y, msg.payload.x)
  })
  spelKanaal.on('broadcast', { event: 'fb-dood' }, () => {
    vriendVogel.dood = true
    if (!mijnVogel.dood) statusEl.textContent = `${vriendNaam} is uit beeld. Hou vol!`
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
