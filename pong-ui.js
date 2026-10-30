// pong-ui.js - Pong voor Fibro.
// Tekent zichzelf in #spelInhoud en praat met de tegenstander via het
// spelkanaal dat chat.html aanlevert. De host rekent de bal uit.
// v147: teksten ook in het Engels (taal.js)
// 30 okt 2026 (Neo Paddle v2): blokjes in het midden en power-ups (neopaddle.js). Een gebroken blokje laat soms een
// capsule vallen, richting de speler van wie de bal kwam: vangen = het effect (groen = goed, rood = ontwijken).
// Groot/klein, omgekeerd, krachtveld (houdt 1 bal tegen), slow motion, drie ballen, vuurbal. In elke golf blokjes
// zijn minstens twee kolommen leeg: er is altijd een doorgang naar de tegenstander. Is een golf op, dan komt de
// volgende. Alleen als beide kanten deze versie hebben (de 'pong-klaar'-melding draagt v: 2); anders gewoon Pong.
import * as NPK from './neopaddle.js?v=1'
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m)) // taal.js (v147)
const PROTOCOL = 2

export function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
  // isActief() zegt of Pong nog het geopende spel is; zonder die controle blijft
  // het spel naar aanrakingen luisteren nadat je het gesloten hebt.
  isActief = isActief || (() => true)
  vriendNaam = vriendNaam || T('vriend')
  let pongTrail = null
  document.getElementById('spelTitelBar').textContent = '🏓 Neo Paddle'
  const inhoud = document.getElementById('spelInhoud')

  const BREEDTE = 280, HOOGTE = 380
  const PADDLE_BREEDTE = 60, PADDLE_HOOGTE = 10, PADDLE_Y_ONDER = HOOGTE - 30, PADDLE_Y_BOVEN = 20
  const BAL_GROOTTE = 8
  const WIN_SCORE = 7
  // Het krachtveld ligt net voor het doel
  const SCHILD_Y_ONDER = HOOGTE - 8, SCHILD_Y_BOVEN = 8

  // Ben ik de host? Host rekent de bal-physics uit, gast volgt alleen mee.
  const benIkHost = benIkSpeler1
  // Mijn paddle staat altijd ONDERAAN op mijn scherm (eigen perspectief), tegenstander BOVEN
  let mijnPaddleX = BREEDTE / 2 - PADDLE_BREEDTE / 2
  let vriendPaddleX = BREEDTE / 2 - PADDLE_BREEDTE / 2
  // De paddle van de ander komt via het netwerk binnen, en die berichten komen
  // niet even vaak als we tekenen. Daarom loopt de getekende paddle vloeiend
  // naar de laatst ontvangen positie toe. De fysica gebruikt de echte positie.
  let vriendPaddleTekenX = vriendPaddleX

  // ── Blokjes en power-ups (neopaddle.js) ──
  // De host beslist (blokkenAan) en rekent alles uit, in zijn eigen beeld: 'onder' = de host, 'boven' = de gast.
  let anderVersie = 1
  let blokkenAan = false
  let golfNr = 0, golfPauze = 0
  let blokken = []
  let capsules = []                      // { x, y, vy, soort }
  const eff = { onder: NPK.nieuwEffect(), boven: NPK.nieuwEffect() }
  let traagTijd = 0
  let meldingen = []                      // voor de gast: { wie: 'onder'|'boven', soort }
  // Wat de gast van de host hoort (in het beeld van de host)
  let effKort = { onder: { b: PADDLE_BREEDTE, o: 0, s: 0, v: 0 }, boven: { b: PADDLE_BREEDTE, o: 0, s: 0, v: 0 } }
  let melding = { tekst: '', leven: 0 }
  // Mijn effect en dat van de ander, vanuit mijn eigen scherm gezien
  const mijnKant = benIkHost ? 'onder' : 'boven'
  const mijnEff = () => benIkHost ? NPK.effectKort(eff.onder) : effKort.boven
  const vriendEff = () => benIkHost ? NPK.effectKort(eff.boven) : effKort.onder
  const mijnBreedte = () => mijnEff().b || PADDLE_BREEDTE
  const vriendBreedte = () => vriendEff().b || PADDLE_BREEDTE

  // Vonkjes en een klein schokje bij een botsing (alleen visueel)
  let vonken = []
  let schok = 0
  function maakVonken(x, y, nx, ny, kracht, kleur) {
    schok = Math.min(6, 2 + kracht * 0.6)
    for (let i = 0; i < 7; i++) {
      const hoek = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.6
      const snel = 0.8 + Math.random() * 2.2
      vonken.push({ x: x, y: y, vx: Math.cos(hoek) * snel, vy: Math.sin(hoek) * snel, leven: 1, kleur: kleur || '#ff00cc' })
    }
    if (vonken.length > 60) vonken = vonken.slice(-60)
  }
  let vorigMijnPaddleX = mijnPaddleX, vorigVriendPaddleX = vriendPaddleX
  let mijnPaddleV = 0, vriendPaddleV = 0
  // Geeft de bal een zetje mee in de richting waarin de paddle beweegt.
  function geefEffect(b, paddleV) {
    const zet = Math.max(-2.5, Math.min(2.5, paddleV * 0.35))
    b.vx += zet
    // Voorkom dat de bal bijna horizontaal gaat en de rally eindeloos duurt
    const minVy = 1.6
    if (Math.abs(b.vy) < minVy) b.vy = b.vy < 0 ? -minVy : minVy
  }
  // Er kunnen meer ballen tegelijk zijn (power-up 'drie ballen'). ballen[0] is de 'hoofdbal'.
  // laatste: wie raakte hem het laatst ('onder' of 'boven'), voor de vuurbal.
  let ballen = [{ x: BREEDTE/2, y: HOOGTE/2, vx: 2.4, vy: -3.2, laatste: null }]
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
  function botsVorm(o, bal) {
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
  // Met blokjes: de obstakels die in de strook van de blokjes liggen, vallen weg (zoals de ruit in het midden).
  const STROOK = { y0: NPK.SAMEN_Y0 - 12, y1: NPK.SAMEN_Y0 + NPK.SAMEN_RIJEN * (NPK.RASTER.bh + NPK.RASTER.gy) + 12 }
  function obstakels() {
    const alle = getLevelObstakels(huidigLevel)
    if (!blokken.length && !blokkenAan) return alle
    return alle.filter(o => {
      const ys = vormPunten(o).map(p => p[1])
      return Math.max(...ys) < STROOK.y0 || Math.min(...ys) > STROOK.y1
    })
  }
  let gameOver = false
  let animatieFrame = null
  let laatsteVerstuurd = 0
  let beideKlaar = false
  let aftellen = 0  // >0 = bezig met aftellen

  // ── Geluid via Web Audio ──
  let audioCtx = null
  function piep(freq, duur, volume, soort) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain); gain.connect(audioCtx.destination)
      osc.frequency.value = freq
      osc.type = soort || 'square'
      gain.gain.setValueAtTime(volume || 0.15, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (duur || 0.1))
      osc.start()
      osc.stop(audioCtx.currentTime + (duur || 0.1))
    } catch(e) {}
  }
  let geluidBuffer = []
  // Hoe sneller de bal, hoe hoger de toon
  const toonhoogte = (basis, b) => basis * (1 + Math.max(0, Math.min(1, (Math.hypot(b.vx, b.vy) - 3.5) / 3.5)) * 0.5)
  const geluidStuiter = (b) => { piep(b ? toonhoogte(440, b) : 440, 0.06, 0.12); geluidBuffer.push('stuiter') }
  const geluidScore = () => { piep(220, 0.25, 0.18); geluidBuffer.push('score') }
  const geluidTik = (b) => { piep(b ? toonhoogte(660, b) : 660, 0.08, 0.15); geluidBuffer.push('tik') }
  const geluidBlok = () => { piep(880, 0.05, 0.1, 'triangle'); geluidBuffer.push('blok') }
  function geluidPowerAf(goed) {
    if (goed) { piep(660, 0.08, 0.14, 'triangle'); setTimeout(() => piep(990, 0.12, 0.14, 'triangle'), 80) }
    else { piep(330, 0.1, 0.14, 'sawtooth'); setTimeout(() => piep(220, 0.14, 0.14, 'sawtooth'), 90) }
  }
  const geluidPower = (goed) => { geluidPowerAf(goed); geluidBuffer.push(goed ? 'goed' : 'slecht') }
  const geluidSchild = () => { piep(1200, 0.15, 0.14, 'sine'); geluidBuffer.push('schild') }
  function speelGeluid(soort) {
    if (soort === 'stuiter') piep(440, 0.06, 0.12)
    else if (soort === 'score') piep(220, 0.25, 0.18)
    else if (soort === 'tik') piep(660, 0.08, 0.15)
    else if (soort === 'blok') piep(880, 0.05, 0.1, 'triangle')
    else if (soort === 'goed' || soort === 'slecht') geluidPowerAf(soort === 'goed')
    else if (soort === 'schild') piep(1200, 0.15, 0.14, 'sine')
  }

  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
      <div id="pong-status" style="color:#00f0ff;font-size:14px;font-weight:700;letter-spacing:1px;text-shadow:0 0 8px #00f0ff;"></div>
      <div id="pong-match" style="font-size:12px;font-weight:700;letter-spacing:1px;min-height:15px;"></div>
      <canvas id="pong-canvas" width="${BREEDTE}" height="${HOOGTE}" style="background:#050510;border:2px solid #ff00cc;border-radius:8px;touch-action:none;box-shadow:0 0 30px rgba(255,0,204,0.5),0 0 60px rgba(255,0,204,0.2),inset 0 0 30px rgba(0,0,0,0.8);"></canvas>
      <div id="pong-uitleg" style="font-size:11px;color:rgba(255,255,255,0.6);text-align:center;max-width:280px;">${T('Sleep om je paddle te bewegen')}</div>
      <button id="pong-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">${T('↻ Opnieuw spelen')}</button>
    </div>`

  const canvas = document.getElementById('pong-canvas')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('pong-status')
  const uitlegEl = document.getElementById('pong-uitleg')
  // De scoreregel wordt met textContent opgebouwd (de naam komt van de vriend)
  // en opnieuw gemaakt als hij vervangen is (wachten, aftellen, winst).
  let mijnScoreEl = null, vriendScoreEl = null
  function bouwScoreRegel() {
    mijnScoreEl = document.createElement('span'); mijnScoreEl.id = 'pong-mijn-score'
    vriendScoreEl = document.createElement('span'); vriendScoreEl.id = 'pong-vriend-score'
    const naamEl = document.createElement('span'); naamEl.id = 'pong-naam'; naamEl.textContent = vriendNaam
    mijnScoreEl.textContent = mijnScore; vriendScoreEl.textContent = vriendScore
    statusEl.textContent = ''
    statusEl.append(T('Jij: '), mijnScoreEl, ' — ', naamEl, ': ', vriendScoreEl)
  }
  const matchEl = document.getElementById('pong-match')
  const opnieuwBtn = document.getElementById('pong-opnieuw')

  function tekenPaddle(x, y, b, e) {
    // omgekeerd = oranje, vuur = rood-oranje gloed, anders cyaan
    const kleur = e && e.o ? '#ff9f1c' : '#00f0ff'
    ctx.save(); ctx.shadowColor = e && e.v ? '#ff5a1f' : kleur; ctx.shadowBlur = e && e.v ? 24 : 16; ctx.fillStyle = kleur
    ctx.fillRect(x, y, b, PADDLE_HOOGTE)
    ctx.restore()
  }

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
    // Blokjes en capsules: de gast ziet het veld van de host gespiegeld
    if (blokken.length) NPK.tekenBlokken(ctx, blokken, !benIkHost)
    for (const c of capsules) NPK.tekenCapsule(ctx, c, !benIkHost)
    // Krachtvelden voor de doelen
    const nu = performance.now()
    if (mijnEff().s) NPK.tekenSchild(ctx, SCHILD_Y_ONDER, nu)
    if (vriendEff().s) NPK.tekenSchild(ctx, SCHILD_Y_BOVEN, nu)
    const verschil = vriendPaddleX - vriendPaddleTekenX
    // Klein verschil: soepel bijtrekken. Groot verschil (na een pauze): meteen goed zetten.
    vriendPaddleTekenX += Math.abs(verschil) > 60 ? verschil : verschil * 0.25
    tekenPaddle(vriendPaddleTekenX, PADDLE_Y_BOVEN, vriendBreedte(), vriendEff())
    tekenPaddle(mijnPaddleX, PADDLE_Y_ONDER, mijnBreedte(), mijnEff())
    const hoofd = ballen[0]
    if (!pongTrail) pongTrail = []
    if (hoofd) { pongTrail.push({x: hoofd.x, y: hoofd.y}); if (pongTrail.length > 10) pongTrail.shift() }
    for (let i = 0; i < pongTrail.length; i++) {
      const tp = pongTrail[i]
      const alpha = (i / pongTrail.length) * 0.4
      const tr = (BAL_GROOTTE/2) * (i / pongTrail.length) * 0.8
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#ffffff"
      ctx.beginPath(); ctx.arc(tp.x, tp.y, tr, 0, Math.PI*2); ctx.fill(); ctx.restore()
    }
    for (const bal of ballen) {
      // De bal kleurt mee met zijn snelheid: rustig = wit, snel = oranjerood. Een vuurbal is altijd vuurrood.
      const balSnelheid = Math.hypot(bal.vx, bal.vy)
      const heet = bal.vuur ? 1 : Math.max(0, Math.min(1, (balSnelheid - 3.5) / 3.5))
      const balKleur = heet < 0.5
        ? 'rgb(255,255,' + Math.round(255 - heet * 2 * 90) + ')'
        : 'rgb(255,' + Math.round(255 - (heet - 0.5) * 2 * 150) + ',' + Math.round(165 - (heet - 0.5) * 2 * 165) + ')'
      ctx.save()
      ctx.shadowColor = heet > 0.35 ? balKleur : "#00f0ff"
      ctx.shadowBlur = 20 + heet * 18
      ctx.fillStyle = balKleur
      ctx.beginPath(); ctx.arc(bal.x, bal.y, BAL_GROOTTE/2 + heet, 0, Math.PI*2); ctx.fill(); ctx.restore()
    }
    // Teken obstakels
    const obs = obstakels()
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
      ctx.fillStyle = v.kleur; ctx.shadowColor = v.kleur; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.arc(v.x, v.y, 1.6 * v.leven + 0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
    ctx.restore()

    // Level indicator
    ctx.save(); ctx.fillStyle = "rgba(255,0,204,0.4)"; ctx.font = "bold 11px monospace"
    ctx.textAlign = "right"; ctx.textBaseline = "top"
    ctx.fillText("LVL " + huidigLevel, BREEDTE-4, 4); ctx.restore()
    ctx.save(); ctx.fillStyle = "#ff00cc"; ctx.shadowColor = "#ff00cc"; ctx.shadowBlur = 12
    ctx.font = "bold 22px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    // Met blokjes staan de cijfers aan de zijkant, anders zitten ze achter de blokjes
    const sx = blokken.length ? 18 : BREEDTE/2
    ctx.fillText(vriendScore, sx, 36)
    ctx.fillStyle = "#00f0ff"; ctx.shadowColor = "#00f0ff"
    ctx.textBaseline = "bottom"
    ctx.fillText(mijnScore, sx, HOOGTE - 36)
    ctx.restore()
    if (melding.leven > 0) { NPK.tekenMelding(ctx, melding.tekst, melding.leven, HOOGTE / 2 + 66); melding.leven-- }
  }

  // ── Drag-besturing voor mijn paddle (werkt overal op het scherm, niet alleen op canvas) ──
  const besturingsVlak = document.getElementById('spelOverlay')
  let laatsteVingerX = null

  function paddleVanX(clientX) {
    laatsteVingerX = clientX
    const rect = canvas.getBoundingClientRect()
    const schaal = BREEDTE / rect.width
    let x = (clientX - rect.left) * schaal
    // Power-up 'omgekeerd': je paddle gaat de andere kant op
    if (mijnEff().o) x = BREEDTE - x
    const b = mijnBreedte()
    return Math.max(0, Math.min(BREEDTE - b, x - b / 2))
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

  // Wordt mijn paddle breder of smaller, of draait de besturing om: paddle meteen op de goede plek zetten
  let vorigeMijnSleutel = ''
  function volgMijnEffect() {
    const e = mijnEff(), sleutel = e.b + ':' + e.o
    if (sleutel === vorigeMijnSleutel) return
    const eerste = vorigeMijnSleutel === ''
    vorigeMijnSleutel = sleutel
    if (eerste) return
    if (laatsteVingerX !== null) mijnPaddleX = paddleVanX(laatsteVingerX)
    else mijnPaddleX = Math.max(0, Math.min(BREEDTE - e.b, mijnPaddleX))
    verstuurPaddle()
  }

  // ── Host-only: bal physics ──
  function botsPaddle(b, px, pb) {
    return b.x + BAL_GROOTTE/2 > px && b.x - BAL_GROOTTE/2 < px + pb
  }
  // Een gevangen power-up: het effect, een melding en een geluid (de gast krijgt ze via de balstaat)
  function vangPowerup(wie, soort) {
    const p = NPK.POWERUPS[soort]
    if (!NPK.pasEffectToe(eff[wie], soort)) {
      if (soort === 'traag') traagTijd = p.duur
      else if (soort === 'multibal') {
        // twee extra ballen, uit de bal die het dichtst bij de vanger is
        const doelY = wie === 'onder' ? HOOGTE : 0
        const bron = ballen.reduce((best, b) => !best || Math.abs(b.y - doelY) < Math.abs(best.y - doelY) ? b : best, null)
        if (bron) for (const draai of [-0.45, 0.45]) {
          if (ballen.length >= 5) break
          const s = Math.max(3.2, Math.hypot(bron.vx, bron.vy)), h = Math.atan2(bron.vx, bron.vy) + draai
          let vy = Math.cos(h) * s
          if (Math.abs(vy) < 1.6) vy = vy < 0 ? -1.6 : 1.6
          ballen.push({ x: bron.x, y: bron.y, vx: Math.sin(h) * s, vy, laatste: bron.laatste })
        }
      }
    }
    meldingen.push({ wie, soort })
    toonMelding(wie, soort)
    geluidPower(p.goed)
  }
  function toonMelding(wie, soort) {
    const p = NPK.POWERUPS[soort]; if (!p) return
    const naam = NPK.powerupNaam(soort)
    melding = { tekst: p.icoon + ' ' + (wie === mijnKant ? naam : T('{naam}: {effect}', { naam: vriendNaam, effect: naam })), leven: 90 }
  }

  // Een blokje geraakt: misschien valt er een capsule, naar de kant waar de bal vandaan kwam
  function blokGeraakt(blok, vanOnder) {
    if (blok.hp > 0) blok.hp--
    geluidBlok()
    maakVonken(blok.x + blok.w / 2, blok.y + blok.h / 2, 0, vanOnder ? 1 : -1, 2, blok.hp > 0 ? '#ff00cc' : '#00f0ff')
    if (blok.hp === 0 && Math.random() < NPK.DROPKANS_SAMEN && capsules.length < 4) {
      capsules.push({ x: blok.x + blok.w / 2, y: blok.y + blok.h / 2, vy: vanOnder ? 1.7 : -1.7, soort: NPK.kiesPowerup('samen', Math.random()) })
    }
  }

  // Een bal één stapje verder (de host). Geeft 'onder' of 'boven' als de bal daar uit het veld gaat, anders null.
  function stapBal(b, f) {
    b.x += b.vx * f
    b.y += b.vy * f

    // Zijwanden
    if (b.x - BAL_GROOTTE/2 < 0 || b.x + BAL_GROOTTE/2 > BREEDTE) {
      b.vx *= -1
      b.x = Math.max(BAL_GROOTTE/2, Math.min(BREEDTE - BAL_GROOTTE/2, b.x))
      geluidStuiter(b)
    }
    const mijnB = NPK.paddleBreedte(eff.onder), vriendB = NPK.paddleBreedte(eff.boven)
    // Mijn paddle (onder) — host speelt zelf ook gewoon mee
    if (b.y + BAL_GROOTTE/2 > PADDLE_Y_ONDER && b.y + BAL_GROOTTE/2 < PADDLE_Y_ONDER + PADDLE_HOOGTE + 6 && b.vy > 0) {
      if (botsPaddle(b, mijnPaddleX, mijnB)) {
        const raak1 = (b.x - (mijnPaddleX + mijnB/2)) / (mijnB/2)
        const snelheid1 = Math.sqrt(b.vx*b.vx + b.vy*b.vy) * 1.04
        const hoek1 = raak1 * 1.1
        b.vx = Math.sin(hoek1) * snelheid1
        b.vy = -Math.abs(Math.cos(hoek1) * snelheid1)
        b.y = PADDLE_Y_ONDER - BAL_GROOTTE/2
        b.laatste = 'onder'
        geefEffect(b, mijnPaddleV)
        geluidStuiter(b)
      }
    }
    // Vriend paddle (boven)
    if (b.y - BAL_GROOTTE/2 < PADDLE_Y_BOVEN + PADDLE_HOOGTE && b.y - BAL_GROOTTE/2 > PADDLE_Y_BOVEN - 6 && b.vy < 0) {
      if (botsPaddle(b, vriendPaddleX, vriendB)) {
        const raak2 = (b.x - (vriendPaddleX + vriendB/2)) / (vriendB/2)
        const snelheid2 = Math.sqrt(b.vx*b.vx + b.vy*b.vy) * 1.04
        const hoek2 = raak2 * 1.1
        b.vx = Math.sin(hoek2) * snelheid2
        b.vy = Math.abs(Math.cos(hoek2) * snelheid2)
        b.y = PADDLE_Y_BOVEN + PADDLE_HOOGTE + BAL_GROOTTE/2
        b.laatste = 'boven'
        geefEffect(b, vriendPaddleV)
        geluidStuiter(b)
      }
    }
    // Krachtveld: houdt de bal één keer tegen en is dan weg
    if (b.vy > 0 && b.y + BAL_GROOTTE/2 >= SCHILD_Y_ONDER && eff.onder.schild) {
      eff.onder.schild = false; b.vy = -Math.abs(b.vy); b.y = SCHILD_Y_ONDER - BAL_GROOTTE/2
      maakVonken(b.x, SCHILD_Y_ONDER, 0, -1, 4, '#39ff88'); geluidSchild()
    } else if (b.vy < 0 && b.y - BAL_GROOTTE/2 <= SCHILD_Y_BOVEN && eff.boven.schild) {
      eff.boven.schild = false; b.vy = Math.abs(b.vy); b.y = SCHILD_Y_BOVEN + BAL_GROOTTE/2
      maakVonken(b.x, SCHILD_Y_BOVEN, 0, 1, 4, '#39ff88'); geluidSchild()
    }
    if (b.y < -20) return 'boven'
    if (b.y > HOOGTE + 20) return 'onder'

    // Blokjes. Een vuurbal (de paddle die hem het laatst raakte heeft 'vuur') gaat er dwars doorheen.
    const vuur = !!(b.laatste && eff[b.laatste].vuur > 0)
    b.vuur = vuur ? 1 : 0
    for (const blok of blokken) {
      if (blok.hp === 0) continue
      const vanOnder = b.vy < 0
      if (vuur) {
        if (blok.hp > 0 && NPK.raaktBlok(b, blok)) { blok.hp = 1; blokGeraakt(blok, vanOnder) }
        continue
      }
      if (NPK.botsBalBlok(b, blok)) { blokGeraakt(blok, vanOnder); break }
    }

    // Obstakels botsen
    obstakels().forEach(o => { if (botsVorm(o, b)) { geluidTik(b); maakVonken(b.x, b.y, laatsteNx, laatsteNy, Math.hypot(b.vx, b.vy)) } })
    return null
  }

  function physicsStap() {
    mijnPaddleV = mijnPaddleX - vorigMijnPaddleX
    vriendPaddleV = vriendPaddleX - vorigVriendPaddleX
    vorigMijnPaddleX = mijnPaddleX
    vorigVriendPaddleX = vriendPaddleX

    tikEffecten()
    const factor = traagTijd > 0 ? NPK.TRAAG_FACTOR : 1
    for (let i = ballen.length - 1; i >= 0; i--) {
      const b = ballen[i]
      // In kleine stapjes, zodat een snelle bal niet door een blokje heen schiet
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * factor / 3))
      let uit = null
      for (let s = 0; s < n && !uit; s++) uit = stapBal(b, factor / n)
      // Snelheid begrenzen
      const maxSnelheid = 7
      b.vx = Math.max(-maxSnelheid, Math.min(maxSnelheid, b.vx))
      b.vy = Math.max(-maxSnelheid, Math.min(maxSnelheid, b.vy))
      if (uit) {
        if (uit === 'boven') mijnScore++
        else vriendScore++
        geluidScore()
        ballen.splice(i, 1)
        // Was dit de laatste bal: een nieuwe opslag
        if (!ballen.length) resetBal(uit === 'boven' ? -1 : 1)
      }
    }
    if (blokkenAan) stapBlokkenEnCapsules()
    checkWinst()
  }

  function tikEffecten() {
    NPK.tikEffect(eff.onder); NPK.tikEffect(eff.boven)
    if (traagTijd > 0) traagTijd--
    volgMijnEffect()
  }

  function stapBlokkenEnCapsules() {
    // Capsules vallen; vangen met je paddle
    for (let i = capsules.length - 1; i >= 0; i--) {
      const c = capsules[i]
      c.y += c.vy * (traagTijd > 0 ? NPK.TRAAG_FACTOR : 1)
      if (c.vy > 0 && NPK.vangtCapsule(c, mijnPaddleX, PADDLE_Y_ONDER, NPK.paddleBreedte(eff.onder))) { capsules.splice(i, 1); vangPowerup('onder', c.soort); continue }
      if (c.vy < 0 && NPK.vangtCapsule(c, vriendPaddleX, PADDLE_Y_BOVEN, NPK.paddleBreedte(eff.boven))) { capsules.splice(i, 1); vangPowerup('boven', c.soort); continue }
      if (c.y < -20 || c.y > HOOGTE + 20) capsules.splice(i, 1)
    }
    // Golf op: even wachten, dan de volgende (niet als er net een bal in de strook zit)
    if (NPK.allesWeg(blokken)) {
      if (golfPauze === 0) golfPauze = 150
      else if (--golfPauze <= 1) {
        const inStrook = ballen.some(b => b.y > STROOK.y0 && b.y < STROOK.y1)
        if (inStrook) golfPauze = 2
        else { golfNr++; blokken = NPK.samenGolf(golfNr); golfPauze = 0 }
      }
    }
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
    const startX = mijnPaddleX + mijnBreedte()/2
    const startY = richting < 0 ? PADDLE_Y_ONDER - 20 : PADDLE_Y_BOVEN + PADDLE_HOOGTE + 20
    const hoek = (Math.random()-0.5) * 0.8
    const snelheid = 3.5
    ballen = [{ x: startX, y: startY, vx: Math.sin(hoek)*snelheid, vy: richting < 0 ? -snelheid : snelheid, laatste: null }]
  }
  // Alles van blokjes en power-ups terug naar het begin (nieuw potje)
  function resetExtra() {
    golfNr = 0; golfPauze = 0; capsules = []; traagTijd = 0; meldingen = []
    eff.onder = NPK.nieuwEffect(); eff.boven = NPK.nieuwEffect()
    blokken = blokkenAan ? NPK.samenGolf(0) : []
    melding = { tekst: '', leven: 0 }
  }

  function tekenEindScherm() {
    const winnaar = mijnScore >= WIN_SCORE
    ctx.fillStyle = "#050510"
    ctx.fillRect(0, 0, BREEDTE, HOOGTE)
    ctx.save()
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    const winNaam = winnaar ? T('JIJ') : vriendNaam.toUpperCase()
    const verliesNaam = winnaar ? vriendNaam.toUpperCase() : T('JIJ')
    ctx.font = "bold 14px monospace"; ctx.fillStyle = winnaar ? "#00f0ff" : "#ff00cc"; ctx.shadowColor = winnaar ? "#00f0ff" : "#ff00cc"; ctx.shadowBlur = 20
    ctx.fillText(T('WINNAAR'), BREEDTE/2, HOOGTE/2 - 60)
    ctx.font = "bold 32px monospace"
    ctx.fillText(winNaam, BREEDTE/2, HOOGTE/2 - 30)
    ctx.font = "bold 48px monospace"; ctx.shadowBlur = 40
    ctx.fillText(mijnScore + " — " + vriendScore, BREEDTE/2, HOOGTE/2 + 20)
    ctx.font = "bold 14px monospace"; ctx.fillStyle = winnaar ? "#ff00cc" : "#00f0ff"; ctx.shadowColor = winnaar ? "#ff00cc" : "#00f0ff"; ctx.shadowBlur = 20
    ctx.fillText(T('VERLIEZER'), BREEDTE/2, HOOGTE/2 + 60)
    ctx.font = "bold 20px monospace"
    ctx.fillText(verliesNaam, BREEDTE/2, HOOGTE/2 + 82)
    ctx.restore()
  }
  function checkWinst() {
    if (mijnScore >= WIN_SCORE || vriendScore >= WIN_SCORE) {
      gameOver = true
      controleerLevel()
      const winnaar = mijnScore >= WIN_SCORE
      statusEl.textContent = winnaar ? T('🎉 Jij wint!') : T('😢 {naam} wint!', { naam: vriendNaam })
      opnieuwBtn.style.display = 'block'
      if (animatieFrame) cancelAnimationFrame(animatieFrame)
    }
  }

  function updateScoreUI() {
    if (!gameOver && !statusEl.contains(mijnScoreEl)) bouwScoreRegel()
    if (mijnScoreEl) { mijnScoreEl.textContent = mijnScore; vriendScoreEl.textContent = vriendScore }
    // Matchpoint: laat zien wanneer iemand op winst staat
    if (!gameOver && (mijnScore === WIN_SCORE - 1 || vriendScore === WIN_SCORE - 1)) {
      const wie = mijnScore === WIN_SCORE - 1 && vriendScore === WIN_SCORE - 1 ? T('BESLISSEND PUNT')
        : mijnScore === WIN_SCORE - 1 ? T('JIJ STAAT OP WINST') : T('LET OP: TEGENSTANDER OP WINST')
      matchEl.textContent = wie
      matchEl.style.color = mijnScore === WIN_SCORE - 1 ? '#00f0ff' : '#ff00cc'
      matchEl.style.textShadow = '0 0 8px ' + matchEl.style.color
    } else matchEl.textContent = ''
  }

  // Afronden voor het netwerk: 1 cijfer achter de komma is genoeg
  const r1 = n => Math.round(n * 10) / 10
  function balstaat() {
    const eerste = ballen[0]
    const p = {
      // 'bal' blijft voor een oudere versie aan de andere kant (die kent alleen één bal)
      bal: eerste ? { x: r1(eerste.x), y: r1(eerste.y), vx: r1(eerste.vx), vy: r1(eerste.vy) } : { x: BREEDTE / 2, y: HOOGTE / 2, vx: 0, vy: 0 },
      mijnScore, vriendScore, geluiden: geluidBuffer,
    }
    if (blokkenAan) {
      p.ballen = ballen.map(b => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.vuur ? 1 : 0])
      p.golf = golfNr
      p.blok = blokken.map(b => b.hp)
      p.caps = capsules.map(c => [r1(c.x), r1(c.y), r1(c.vy), c.soort])
      p.eff = { onder: NPK.effectKort(eff.onder), boven: NPK.effectKort(eff.boven) }
      p.traag = traagTijd > 0 ? 1 : 0
      if (meldingen.length) p.meld = meldingen
    }
    meldingen = []
    return p
  }

  // ── Game loop ──
  function loop(tijdstip) {
    // Afgelopen: het eindscherm (vroeger zag alleen de gast dat; de host bleef op het laatste beeld staan)
    if (gameOver) { tekenEindScherm(); return }
    if (benIkHost) {
      physicsStap()
      if (gameOver) {
        spelKanaal.send({ type: 'broadcast', event: 'balstaat', payload: balstaat() })
        updateScoreUI(); tekenEindScherm(); return
      }
      if (tijdstip - laatsteVerstuurd > 50) {
        laatsteVerstuurd = tijdstip
        spelKanaal.send({ type: 'broadcast', event: 'balstaat', payload: balstaat() })
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
  // Blokjes en capsules bewaart de gast in het beeld van de host; tekenBlokken/tekenCapsule spiegelen ze.
  spelKanaal.on('broadcast', { event: 'balstaat' }, msg => {
    if (benIkHost) return
    const p = msg.payload || {}
    if (Array.isArray(p.ballen) && p.ballen.length) {
      ballen = p.ballen.map(a => ({ x: a[0], y: HOOGTE - a[1], vx: a[2], vy: -a[3], vuur: a[4] }))
    } else if (p.bal) {
      ballen = [{ x: p.bal.x, y: HOOGTE - p.bal.y, vx: p.bal.vx, vy: -p.bal.vy }]
    }
    if (Array.isArray(p.blok)) {
      if (p.golf !== golfNr || blokken.length !== p.blok.length) { golfNr = p.golf | 0; blokken = NPK.samenGolf(golfNr) }
      if (blokken.length === p.blok.length) p.blok.forEach((hp, i) => { blokken[i].hp = hp })
    } else blokken = []
    capsules = Array.isArray(p.caps) ? p.caps.filter(c => Object.prototype.hasOwnProperty.call(NPK.POWERUPS, c[3])).map(c => ({ x: c[0], y: c[1], vy: c[2], soort: c[3] })) : []
    if (p.eff && p.eff.onder && p.eff.boven) { effKort = p.eff; volgMijnEffect() }
    if (Array.isArray(p.meld)) p.meld.forEach(m => m && toonMelding(m.wie, m.soort))
    vriendScore = p.mijnScore   // host's score = mijn tegenstander
    mijnScore = p.vriendScore   // host's vriendScore = mijn eigen score
    if (p.geluiden && p.geluiden.length) {
      p.geluiden.forEach(g => speelGeluid(g))
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
    resetExtra()
    resetBal(benIkHost ? 1 : -1)
    updateScoreUI()
    herstartLoop()
  })

  opnieuwBtn.addEventListener('click', () => {
    mijnScore = 0; vriendScore = 0
    gameOver = false
    opnieuwBtn.style.display = 'none'
    resetExtra()
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
    spelKanaal.send({ type: 'broadcast', event: 'pong-klaar', payload: { v: PROTOCOL } })
    checkBeideKlaar()
  }

  const leesVersie = msg => Number(msg && msg.payload && msg.payload.v) || 1
  spelKanaal.on('broadcast', { event: 'pong-klaar' }, msg => {
    anderKlaar = true
    anderVersie = Math.max(anderVersie, leesVersie(msg))
    // Stuur ook terug zodat de ander ook weet dat wij klaar zijn
    if (ikKlaarGemeld) spelKanaal.send({ type: 'broadcast', event: 'pong-klaar-terug', payload: { v: PROTOCOL } })
    checkBeideKlaar()
  })
  spelKanaal.on('broadcast', { event: 'pong-klaar-terug' }, msg => {
    anderKlaar = true
    anderVersie = Math.max(anderVersie, leesVersie(msg))
    checkBeideKlaar()
  })

  function checkBeideKlaar() {
    if (ikKlaarGemeld && anderKlaar && !beideKlaar) {
      beideKlaar = true
      // De host beslist: blokjes en power-ups alleen als de ander ze ook kent
      if (benIkHost) { blokkenAan = anderVersie >= PROTOCOL; resetExtra() }
      if (anderVersie >= PROTOCOL) uitlegEl.textContent = T('Sleep om je paddle te bewegen. Breek blokjes: vang groene power-ups, ontwijk rode.')
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
        bouwScoreRegel()
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
  statusEl.textContent = T('Wachten op tegenstander...')
  ctx.clearRect(0, 0, BREEDTE, HOOGTE)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(T('Wachten...'), BREEDTE/2, HOOGTE/2)
  // Meld na klein moment dat ik klaar ben (kanaal moet subscribed zijn)
  setTimeout(meldIkBenKlaar, 800)
  // Blijf melden tot de ander reageert (voor het geval de ander later klaar is)
  const klaarHerhaal = setInterval(() => {
    if (beideKlaar) { clearInterval(klaarHerhaal); return }
    spelKanaal.send({ type: 'broadcast', event: 'pong-klaar', payload: { v: PROTOCOL } })
  }, 1500)

}
