// invaders-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
  vriendNaam = vriendNaam || 'vriend'
  isActief = isActief || (() => true)
  document.getElementById('spelTitelBar').textContent = '👾 Space Invaders'
  const inhoud = document.getElementById('spelInhoud')
  const B = 280, H = 400
  const benIkHost = benIkSpeler1

  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;">
      <div style="display:flex;justify-content:space-between;width:${B}px;color:white;font-size:12px;padding:0 4px;">
        <span>🚀 Jij: <b id="si-score-mij">0</b></span>
        <span id="si-level" style="color:var(--accent);">Level 1</span>
        <span>👾 ${vriendNaam}: <b id="si-score-vriend">0</b></span>
      </div>
      <canvas id="si-canvas" width="${B}" height="${H}" style="border-radius:10px;border:2px solid rgba(255,255,255,0.15);display:block;touch-action:none;"></canvas>
      <div id="si-status" style="color:white;font-size:13px;font-weight:600;min-height:18px;text-align:center;"></div>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;">← Tik links/rechts om te bewegen · Midden om te schieten</div>
    </div>`

  const canvas = document.getElementById('si-canvas')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('si-status')

  // ── Constanten ──
  const SCHIP_B = 36, SCHIP_H = 20, SCHIP_Y = H - 40
  const KOGEL_B = 3, KOGEL_H = 10, KOGEL_SNELHEID = 6
  const ALIEN_RIJEN = 4, ALIEN_COLS = 8
  const ALIEN_B = 24, ALIEN_H = 18, ALIEN_GAP_X = 32, ALIEN_GAP_Y = 28
  const ALIEN_START_X = 12, ALIEN_START_Y = 50

  // ── Staat ──
  let mijnSchip = { x: B / 2 - SCHIP_B / 2 }
  let vriendSchip = { x: B / 2 - SCHIP_B / 2 }
  let mijnKogels = []
  let vriendKogels = []
  let alienKogels = []
  let aliens = []
  let alienDir = 1, alienSnelheid = 0.4, alienDaalY = 0
  let mijnScore = 0, vriendScore = 0
  let huidigLevel = 1
  const MAX_LEVEL = 7

  // Obstakels per level (gebaseerd op jouw tekeningen)
  // type: rect={x,y,b,h}, bumper={x,y,r} (driehoek-hoek), zijkant={x,y,b,h}
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
        {type:'hoek',x:0,y:H/2,richting:'lb'},{type:'hoek',x:W,y:H/2,richting:'rb'},
        {type:'hoek',x:W/2,y:H/2,richting:'lt'}]
      case 4: return [ // hoek-bumpers + ruit midden
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'ruit',x:W/2,y:H/2,r:28}]
      case 5: return [ // hoek + zijkant + 2 ruiten
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'zijkant',x:0,y:H/2-50,richting:'l'},{type:'zijkant',x:W,y:H/2-50,richting:'r'},
        {type:'ruit',x:W/2,y:H/3,r:22},{type:'ruit',x:W/2,y:2*H/3,r:22}]
      case 6: return [ // zijkant-bumpers + ruit
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'zijkant',x:0,y:H/3,richting:'l'},{type:'zijkant',x:W,y:H/3,richting:'r'},
        {type:'zijkant',x:0,y:2*H/3,richting:'l'},{type:'zijkant',x:W,y:2*H/3,richting:'r'},
        {type:'ruit',x:W/2,y:H/2,r:28}]
      case 7: return [ // zijkant-bumpers + 2 verticale staven
        {type:'hoek',x:0,y:0,richting:'lt'},{type:'hoek',x:W,y:0,richting:'rt'},
        {type:'hoek',x:0,y:H,richting:'lb'},{type:'hoek',x:W,y:H,richting:'rb'},
        {type:'zijkant',x:0,y:H/3,richting:'l'},{type:'zijkant',x:W,y:H/3,richting:'r'},
        {type:'zijkant',x:0,y:2*H/3,richting:'l'},{type:'zijkant',x:W,y:2*H/3,richting:'r'},
        {type:'rect',x:W/2-30,y:H/2-50,b:14,h:60},{type:'rect',x:W/2+16,y:H/2-50,b:14,h:60}]
      default: return []
    }
  }
  let level = 1
  let gameOver = false, gewonnen = false
  let animFrame = null
  let schietCooldown = 0
  let toetsLinks = false, toetsRechts = false

  function maakAliens() {
    aliens = []
    for (let r = 0; r < ALIEN_RIJEN; r++) {
      for (let k = 0; k < ALIEN_COLS; k++) {
        aliens.push({
          x: ALIEN_START_X + k * ALIEN_GAP_X,
          y: ALIEN_START_Y + r * ALIEN_GAP_Y,
          type: r === 0 ? 2 : r < 2 ? 1 : 0,
          dood: false
        })
      }
    }
  }

  const ALIEN_ICOON = ['👾', '🤖', '👽']
  const ALIEN_PUNTEN = [10, 20, 30]

  function teken() {
    // Achtergrond
    ctx.fillStyle = '#050518'
    ctx.fillRect(0, 0, B, H)

    // Sterren
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    for (let i = 0; i < 40; i++) {
      const sx = (i * 73 + level * 7) % B
      const sy = (i * 47 + level * 13) % H
      ctx.fillRect(sx, sy, 1, 1)
    }

    // Grondlijn
    ctx.fillStyle = 'rgba(100,255,100,0.2)'
    ctx.fillRect(0, H - 20, B, 2)

    // Aliens
    ctx.font = `${ALIEN_H}px serif`
    ctx.textAlign = 'center'
    aliens.forEach(a => {
      if (a.dood) return
      ctx.globalAlpha = 1
      ctx.fillText(ALIEN_ICOON[a.type], a.x + ALIEN_B / 2, a.y + ALIEN_H)
    })
    ctx.globalAlpha = 1

    // Mijn schip (groen)
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.moveTo(mijnSchip.x + SCHIP_B / 2, SCHIP_Y - SCHIP_H)
    ctx.lineTo(mijnSchip.x, SCHIP_Y)
    ctx.lineTo(mijnSchip.x + SCHIP_B, SCHIP_Y)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#86efac'
    ctx.fillRect(mijnSchip.x + SCHIP_B / 2 - 3, SCHIP_Y - SCHIP_H - 6, 6, 8)

    // Vriend schip (blauw)
    ctx.fillStyle = '#60a5fa'
    ctx.beginPath()
    ctx.moveTo(vriendSchip.x + SCHIP_B / 2, SCHIP_Y - SCHIP_H)
    ctx.lineTo(vriendSchip.x, SCHIP_Y)
    ctx.lineTo(vriendSchip.x + SCHIP_B, SCHIP_Y)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#bfdbfe'
    ctx.fillRect(vriendSchip.x + SCHIP_B / 2 - 3, SCHIP_Y - SCHIP_H - 6, 6, 8)

    // Mijn kogels (groen)
    ctx.fillStyle = '#4ade80'
    mijnKogels.forEach(k => ctx.fillRect(k.x, k.y, KOGEL_B, KOGEL_H))

    // Vriend kogels (blauw)
    ctx.fillStyle = '#93c5fd'
    vriendKogels.forEach(k => ctx.fillRect(k.x, k.y, KOGEL_B, KOGEL_H))

    // Alien kogels (rood)
    ctx.fillStyle = '#f87171'
    alienKogels.forEach(k => {
      ctx.beginPath()
      ctx.arc(k.x, k.y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  function update() {
    if (gameOver) return

    // Schip bewegen
    const SCHIP_SNELHEID = 3.5
    if (toetsLinks) mijnSchip.x = Math.max(0, mijnSchip.x - SCHIP_SNELHEID)
    if (toetsRechts) mijnSchip.x = Math.min(B - SCHIP_B, mijnSchip.x + SCHIP_SNELHEID)

    // Schip positie sturen
    spelKanaal.send({ type: 'broadcast', event: 'si-schip', payload: { x: mijnSchip.x } })

    // Kogels bewegen
    mijnKogels = mijnKogels.filter(k => { k.y -= KOGEL_SNELHEID; return k.y > 0 })
    vriendKogels = vriendKogels.filter(k => { k.y -= KOGEL_SNELHEID; return k.y > 0 })

    // Cooldown
    if (schietCooldown > 0) schietCooldown--

    // Aliens bewegen (alleen host)
    if (benIkHost) {
      let raakteRand = false
      aliens.forEach(a => {
        if (!a.dood) {
          a.x += alienDir * alienSnelheid
          if (a.x <= 0 || a.x + ALIEN_B >= B) raakteRand = true
        }
      })
      if (raakteRand) {
        alienDir *= -1
        aliens.forEach(a => { if (!a.dood) a.y += 12 })
      }

      // Alien schiet willekeurig
      if (Math.random() < 0.008 * level) {
        const levend = aliens.filter(a => !a.dood)
        if (levend.length > 0) {
          const schutter = levend[Math.floor(Math.random() * levend.length)]
          const kogel = { x: schutter.x + ALIEN_B / 2, y: schutter.y + ALIEN_H }
          alienKogels.push(kogel)
          spelKanaal.send({ type: 'broadcast', event: 'si-alien-kogel', payload: { x: kogel.x, y: kogel.y } })
        }
      }

      // Sync alien posities elke 30 frames
      if (animFrame && animFrame % 30 === 0) {
        spelKanaal.send({ type: 'broadcast', event: 'si-sync', payload: {
          aliens: aliens.map(a => ({ x: a.x, y: a.y, dood: a.dood })),
          dir: alienDir
        }})
      }
    }

    // Alien kogels bewegen
    alienKogels = alienKogels.filter(k => { k.y += 2.5; return k.y < H })

    // Botsing: mijn kogels vs aliens
    mijnKogels = mijnKogels.filter(kogel => {
      let raak = false
      aliens.forEach(a => {
        if (a.dood || raak) return
        if (kogel.x < a.x + ALIEN_B && kogel.x + KOGEL_B > a.x &&
            kogel.y < a.y + ALIEN_H && kogel.y + KOGEL_H > a.y) {
          a.dood = true; raak = true
          mijnScore += ALIEN_PUNTEN[a.type]
          document.getElementById('si-score-mij').textContent = mijnScore
          spelKanaal.send({ type: 'broadcast', event: 'si-raak', payload: {
            alienIdx: aliens.indexOf(a), score: mijnScore, door: 'mij'
          }})
        }
      })
      return !raak
    })

    // Botsing: vriend kogels vs aliens
    vriendKogels = vriendKogels.filter(kogel => {
      let raak = false
      aliens.forEach(a => {
        if (a.dood || raak) return
        if (kogel.x < a.x + ALIEN_B && kogel.x + KOGEL_B > a.x &&
            kogel.y < a.y + ALIEN_H && kogel.y + KOGEL_H > a.y) {
          a.dood = true; raak = true
        }
      })
      return !raak
    })

    // Alien kogel raakt schip
    alienKogels = alienKogels.filter(k => {
      const raakMij = k.x > mijnSchip.x && k.x < mijnSchip.x + SCHIP_B && k.y > SCHIP_Y - SCHIP_H && k.y < SCHIP_Y
      const raakVriend = k.x > vriendSchip.x && k.x < vriendSchip.x + SCHIP_B && k.y > SCHIP_Y - SCHIP_H && k.y < SCHIP_Y
      if (raakMij || raakVriend) {
        // Verlies een leven (vereenvoudigd: direct game over voor dit prototype)
      }
      return !raakMij && !raakVriend
    })

    // Aliens bereiken grond
    const gevaarlijk = aliens.filter(a => !a.dood)
    if (gevaarlijk.some(a => a.y + ALIEN_H >= SCHIP_Y - 10)) {
      eindSpel(false)
      return
    }

    // Alle aliens dood → volgend level
    if (gevaarlijk.length === 0) {
      level++
      document.getElementById('si-level').textContent = 'Level ' + level
      alienSnelheid = Math.min(2, 0.4 + level * 0.2)
      maakAliens()
      spelKanaal.send({ type: 'broadcast', event: 'si-nieuw-level', payload: { level, aliens: aliens.map(a => ({ x: a.x, y: a.y, dood: a.dood })) } })
    }

    teken()
    animFrame = requestAnimationFrame(update)
    window._spelAnimFrame = animFrame
  }

  function schiet() {
    if (gameOver || schietCooldown > 0) return
    schietCooldown = 18
    const kogel = { x: mijnSchip.x + SCHIP_B / 2 - KOGEL_B / 2, y: SCHIP_Y - SCHIP_H }
    mijnKogels.push(kogel)
    spelKanaal.send({ type: 'broadcast', event: 'si-kogel', payload: { x: kogel.x, y: kogel.y } })
  }

  function eindSpel(gewonnen_) {
    gameOver = true
    gewonnen = gewonnen_
    cancelAnimationFrame(animFrame)
    teken()
    const totaalMij = mijnScore, totaalVriend = vriendScore
    statusEl.textContent = totaalMij > totaalVriend ? '🎉 Jij wint! ' + totaalMij + ' vs ' + totaalVriend
      : totaalMij < totaalVriend ? '😢 ' + vriendNaam + ' wint!'
      : '🤝 Gelijkspel!'
    setTimeout(() => {
      const btn = document.createElement('button')
      btn.textContent = '↻ Opnieuw'
      btn.style.cssText = 'background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:700;cursor:pointer;margin-top:8px;'
      btn.onclick = () => { spelKanaal.send({ type: 'broadcast', event: 'si-herstart', payload: {} }); herstart() }
      statusEl.after(btn)
    }, 600)
  }

  function herstart() {
    mijnSchip = { x: B / 2 - SCHIP_B / 2 }
    vriendSchip = { x: B / 2 - SCHIP_B / 2 }
    mijnKogels = []; vriendKogels = []; alienKogels = []
    mijnScore = 0; vriendScore = 0; level = 1
    alienDir = 1; alienSnelheid = 0.4
    gameOver = false; gewonnen = false
    document.getElementById('si-score-mij').textContent = '0'
    document.getElementById('si-score-vriend').textContent = '0'
    document.getElementById('si-level').textContent = 'Level 1'
    statusEl.textContent = ''
    statusEl.nextElementSibling?.tagName === 'BUTTON' && statusEl.nextElementSibling.remove()
    maakAliens()
    animFrame = requestAnimationFrame(update)
    window._spelAnimFrame = animFrame
  }

  // ── Input: touch ──
  let raakX = null
  const siOverlay = document.getElementById('spelOverlay')

  function siTouchStart(e) {
    if (!isActief()) return
    if (e.target.tagName === 'BUTTON') return
    e.preventDefault()
    const t = e.touches[0]
    raakX = t.clientX
    const rect = canvas.getBoundingClientRect()
    const relX = t.clientX - rect.left
    // Midden derde = schieten, links = links, rechts = rechts
    if (relX < rect.width / 3) { toetsLinks = true; toetsRechts = false }
    else if (relX > rect.width * 2 / 3) { toetsRechts = true; toetsLinks = false }
    else schiet()
  }
  function siTouchEnd(e) {
    if (!isActief()) return
    toetsLinks = false; toetsRechts = false; raakX = null
  }
  function siTouchMove(e) {
    if (!isActief()) return
    e.preventDefault()
    const relX = e.touches[0].clientX - canvas.getBoundingClientRect().left
    if (relX < canvas.getBoundingClientRect().width / 3) { toetsLinks = true; toetsRechts = false }
    else if (relX > canvas.getBoundingClientRect().width * 2 / 3) { toetsRechts = true; toetsLinks = false }
    else { toetsLinks = false; toetsRechts = false }
  }

  siOverlay.addEventListener('touchstart', siTouchStart, { passive: false })
  siOverlay.addEventListener('touchend', siTouchEnd)
  siOverlay.addEventListener('touchmove', siTouchMove, { passive: false })

  // Keyboard voor desktop
  function siKeyDown(e) {
    if (!isActief()) return
    if (e.key === 'ArrowLeft')  toetsLinks = true
    if (e.key === 'ArrowRight') toetsRechts = true
    if (e.key === ' ') { e.preventDefault(); schiet() }
  }
  function siKeyUp(e) {
    if (e.key === 'ArrowLeft')  toetsLinks = false
    if (e.key === 'ArrowRight') toetsRechts = false
  }
  window.addEventListener('keydown', siKeyDown)
  window.addEventListener('keyup', siKeyUp)

  // ── Realtime events ontvangen ──
  spelKanaal.on('broadcast', { event: 'si-schip' }, msg => {
    vriendSchip.x = msg.payload.x
  })
  spelKanaal.on('broadcast', { event: 'si-kogel' }, msg => {
    vriendKogels.push({ x: msg.payload.x, y: msg.payload.y })
  })
  spelKanaal.on('broadcast', { event: 'si-raak' }, msg => {
    const a = aliens[msg.payload.alienIdx]
    if (a) a.dood = true
    if (msg.payload.door === 'mij') {
      // De ander schoot hem neer — update vriends score
      vriendScore = msg.payload.score
      document.getElementById('si-score-vriend').textContent = vriendScore
    }
  })
  spelKanaal.on('broadcast', { event: 'si-alien-kogel' }, msg => {
    if (!benIkHost) alienKogels.push({ x: msg.payload.x, y: msg.payload.y })
  })
  spelKanaal.on('broadcast', { event: 'si-sync' }, msg => {
    if (!benIkHost) {
      msg.payload.aliens.forEach((a, i) => { if (aliens[i]) { aliens[i].x = a.x; aliens[i].y = a.y; aliens[i].dood = a.dood } })
      alienDir = msg.payload.dir
    }
  })
  spelKanaal.on('broadcast', { event: 'si-nieuw-level' }, msg => {
    if (!benIkHost) {
      level = msg.payload.level
      document.getElementById('si-level').textContent = 'Level ' + level
      alienSnelheid = Math.min(2, 0.4 + level * 0.2)
      msg.payload.aliens.forEach((a, i) => { if (aliens[i]) { aliens[i].x = a.x; aliens[i].y = a.y; aliens[i].dood = a.dood } })
    }
  })
  spelKanaal.on('broadcast', { event: 'si-herstart' }, () => herstart())

  // ── Start ──
  maakAliens()
  statusEl.textContent = 'Start in 3...'
  let tel = 3
  const startInterval = setInterval(() => {
    tel--
    if (tel > 0) statusEl.textContent = 'Start in ' + tel + '...'
    else {
      clearInterval(startInterval)
      statusEl.textContent = ''
      animFrame = requestAnimationFrame(update)
      window._spelAnimFrame = animFrame
    }
  }, 1000)
  window._spelAftelInterval = startInterval
}
