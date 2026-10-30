// neopaddle-levels.js - Neo Paddle alleen spelen: levels (30 okt 2026).
// Haal alle blokjes weg (metaal hoeft niet). Je hebt 3 levens; vang power-ups (neopaddle.js). Een gehaald level
// zet het volgende open; je voortgang en je record blijven op dit toestel (per account, via spel.html).
// Opbouw: eerst de spelregels zonder scherm (maakSpel, stap, lanceer: te testen in Node, zie
// tests/ui/test-neopaddle.mjs, die alle levels automatisch uitspeelt), daarna het scherm (start).
import * as NPK from './neopaddle.js?v=1'

const { B, H, BAL, PH } = NPK.NP
export const PADDLE_Y = H - 30
export const START_LEVENS = 3, MAX_LEVENS = 5
const BASIS_SNELHEID = 3.6, MAX_SNELHEID = 6.8
const SCHILD_Y = H - 8

// ── Spelregels (zonder scherm) ──
export function maakSpel(level, { score = 0, levens = START_LEVENS, rnd = Math.random } = {}) {
  const spel = {
    level, blokken: NPK.levelBlokken(level), score, levens, rnd,
    eff: NPK.nieuwEffect(), traag: 0, capsules: [], ballen: [],
    paddleX: B / 2 - NPK.NP.PB / 2, vorigePaddleX: B / 2 - NPK.NP.PB / 2,
    status: 'spelen',          // 'spelen' | 'gehaald' | 'af'
    gebeurtenis: [],           // voor het scherm: geluiden en meldingen ({ soort, ... })
    tijd: 0,
  }
  nieuweBalOpPaddle(spel)
  return spel
}
const snelheidVan = spel => BASIS_SNELHEID + spel.level * 0.15
function nieuweBalOpPaddle(spel) {
  spel.ballen = [{ x: 0, y: 0, vx: 0, vy: 0, vast: true }]
  plakVast(spel)
}
function plakVast(spel) {
  const pb = NPK.paddleBreedte(spel.eff)
  for (const b of spel.ballen) if (b.vast) { b.x = spel.paddleX + pb / 2; b.y = PADDLE_Y - BAL / 2 - 0.5 }
}
// Tik of spatie: de bal(len) op de paddle schieten weg, schuin omhoog
export function lanceer(spel) {
  if (spel.status !== 'spelen') return false
  let gelanceerd = false
  for (const b of spel.ballen) if (b.vast) {
    const s = snelheidVan(spel), hoek = (spel.rnd() - 0.5) * 0.7
    b.vast = false; b.vx = Math.sin(hoek) * s; b.vy = -Math.cos(hoek) * s
    gelanceerd = true
  }
  if (gelanceerd) spel.gebeurtenis.push({ soort: 'lanceer' })
  return gelanceerd
}

// Eén beeldje (1/60 seconde). doelX: waar de paddle (links) heen wil; het scherm rekent 'omgekeerd' al om.
export function stap(spel, doelX) {
  if (spel.status !== 'spelen') return
  spel.tijd++
  const pb = NPK.paddleBreedte(spel.eff)
  spel.vorigePaddleX = spel.paddleX
  spel.paddleX = Math.max(0, Math.min(B - pb, doelX))
  const paddleV = spel.paddleX - spel.vorigePaddleX
  NPK.tikEffect(spel.eff)
  if (spel.traag > 0) spel.traag--
  // Na 'klein' of 'groot' kan de paddle te ver staan
  spel.paddleX = Math.max(0, Math.min(B - NPK.paddleBreedte(spel.eff), spel.paddleX))
  plakVast(spel)
  const factor = spel.traag > 0 ? NPK.TRAAG_FACTOR : 1

  for (let i = spel.ballen.length - 1; i >= 0; i--) {
    const b = spel.ballen[i]
    if (b.vast) continue
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * factor / 3))
    let weg = false
    for (let s = 0; s < n && !weg; s++) weg = stapBal(spel, b, factor / n, paddleV)
    if (weg) spel.ballen.splice(i, 1)
  }
  if (!spel.ballen.length) {
    spel.levens--
    spel.gebeurtenis.push({ soort: 'mis' })
    if (spel.levens <= 0) { spel.status = 'af'; spel.gebeurtenis.push({ soort: 'af' }); return }
    // Een leven kwijt: de effecten zijn weg, een nieuwe bal op de paddle
    spel.eff = NPK.nieuwEffect(); spel.traag = 0; spel.capsules = []
    nieuweBalOpPaddle(spel)
  }

  // Capsules vallen naar beneden; vangen met de paddle
  for (let i = spel.capsules.length - 1; i >= 0; i--) {
    const c = spel.capsules[i]
    c.y += c.vy * factor
    if (NPK.vangtCapsule(c, spel.paddleX, PADDLE_Y, NPK.paddleBreedte(spel.eff))) { spel.capsules.splice(i, 1); vang(spel, c.soort) }
    else if (c.y > H + 20) spel.capsules.splice(i, 1)
  }

  if (NPK.allesWeg(spel.blokken)) {
    spel.status = 'gehaald'
    spel.score += 500 + 100 * spel.levens
    spel.gebeurtenis.push({ soort: 'gehaald' })
  }
}

// Een bal een klein stapje verder. Geeft true als hij onderaan het veld uit is.
function stapBal(spel, b, f, paddleV) {
  b.x += b.vx * f; b.y += b.vy * f
  const r = BAL / 2
  if (b.x - r < 0) { b.x = r; b.vx = Math.abs(b.vx); spel.gebeurtenis.push({ soort: 'muur' }) }
  else if (b.x + r > B) { b.x = B - r; b.vx = -Math.abs(b.vx); spel.gebeurtenis.push({ soort: 'muur' }) }
  if (b.y - r < 0) { b.y = r; b.vy = Math.abs(b.vy); spel.gebeurtenis.push({ soort: 'muur' }) }
  // De paddle: de plek waar je raakt bepaalt de hoek, en je beweging geeft een zetje
  const pb = NPK.paddleBreedte(spel.eff)
  if (b.vy > 0 && b.y + r >= PADDLE_Y && b.y + r <= PADDLE_Y + PH + 6 && b.x + r > spel.paddleX && b.x - r < spel.paddleX + pb) {
    const raak = Math.max(-1, Math.min(1, (b.x - (spel.paddleX + pb / 2)) / (pb / 2)))
    const s = Math.min(MAX_SNELHEID, Math.hypot(b.vx, b.vy) * 1.01)
    const hoek = raak * 1.05 + Math.max(-0.25, Math.min(0.25, paddleV * 0.03))
    b.vx = Math.sin(hoek) * s; b.vy = -Math.abs(Math.cos(hoek) * s)
    if (Math.abs(b.vy) < 1.8) b.vy = -1.8
    b.y = PADDLE_Y - r
    spel.gebeurtenis.push({ soort: 'paddle' })
  }
  // Krachtveld: houdt de bal één keer tegen
  if (b.vy > 0 && b.y + r >= SCHILD_Y && spel.eff.schild) {
    spel.eff.schild = false; b.vy = -Math.abs(b.vy); b.y = SCHILD_Y - r
    spel.gebeurtenis.push({ soort: 'schild', x: b.x })
  }
  if (b.y - r > H) return true
  // Blokjes. Vuurbal: dwars door alles wat breekt (metaal kaatst hem nog wel terug).
  const vuur = spel.eff.vuur > 0
  for (const blok of spel.blokken) {
    if (blok.hp === 0) continue
    if (vuur && blok.hp > 0) {
      if (NPK.raaktBlok(b, blok)) { blok.hp = 1; raakBlok(spel, blok) }
      continue
    }
    if (NPK.botsBalBlok(b, blok)) { raakBlok(spel, blok); break }
  }
  // Nooit (bijna) horizontaal: dan duurt het eindeloos
  if (Math.abs(b.vy) < 1.2) b.vy = b.vy < 0 ? -1.2 : 1.2
  return false
}

function raakBlok(spel, blok) {
  if (blok.hp < 0) { spel.gebeurtenis.push({ soort: 'metaal', x: blok.x + blok.w / 2, y: blok.y + blok.h / 2 }); return }
  blok.hp--
  spel.score += 10
  if (blok.hp === 0) {
    spel.score += 10 * blok.max
    spel.gebeurtenis.push({ soort: 'breek', x: blok.x + blok.w / 2, y: blok.y + blok.h / 2, max: blok.max })
    if (spel.rnd() < NPK.DROPKANS_LEVELS && spel.capsules.length < 3) {
      spel.capsules.push({ x: blok.x + blok.w / 2, y: blok.y + blok.h / 2, vy: 1.6, soort: NPK.kiesPowerup('levels', spel.rnd()) })
    }
  } else spel.gebeurtenis.push({ soort: 'tik', x: blok.x + blok.w / 2, y: blok.y + blok.h / 2 })
}

function vang(spel, soort) {
  const p = NPK.POWERUPS[soort]
  if (!NPK.pasEffectToe(spel.eff, soort)) {
    if (soort === 'traag') spel.traag = p.duur
    else if (soort === 'leven') spel.levens = Math.min(MAX_LEVENS, spel.levens + 1)
    else if (soort === 'multibal') {
      const bron = spel.ballen.find(b => !b.vast) || spel.ballen[0]
      if (bron && bron.vast) lanceer(spel)
      for (const draai of [-0.5, 0.5]) {
        if (spel.ballen.length >= 6) break
        const s = Math.max(snelheidVan(spel), Math.hypot(bron.vx, bron.vy))
        const h = Math.atan2(bron.vx, -Math.abs(bron.vy) || -1) + draai
        spel.ballen.push({ x: bron.x, y: bron.y, vx: Math.sin(h) * s, vy: -Math.abs(Math.cos(h) * s) || -2, vast: false })
      }
    }
  }
  spel.score += 25
  spel.gebeurtenis.push({ soort: 'power', welke: soort, goed: p.goed })
}

// ── Het scherm ──
const T = (s, v) => (window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export function start({ solo, isActief } = {}) {
  isActief = isActief || (() => true)
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🧱 Neo Paddle · ' + T('Levels')
  const lees = (k, standaard) => { try { return solo && solo.lees ? solo.lees(k, standaard) : standaard } catch (e) { return standaard } }
  const bewaar = (k, w) => { try { if (solo && solo.bewaar) solo.bewaar(k, w) } catch (e) {} }
  // Hoeveel levels open staan (1 = alleen het eerste)
  const open = () => Math.max(1, Math.min(NPK.LEVELS.length, parseInt(lees('open', '1'), 10) || 1))
  const record = () => (solo && solo.record ? solo.record() : 0)

  let spel = null, frame = null, laatsteTijd = 0, rest = 0
  let vingerX = null, toetsLinks = false, toetsRechts = false
  let vonken = [], melding = { tekst: '', leven: 0 }, schok = 0

  // ── Geluid ──
  let audio = null
  function piep(freq, duur, volume, soort) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audio.createOscillator(), gain = audio.createGain()
      osc.connect(gain); gain.connect(audio.destination)
      osc.type = soort || 'square'; osc.frequency.value = freq
      gain.gain.setValueAtTime(volume || 0.12, audio.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + (duur || 0.08))
      osc.start(); osc.stop(audio.currentTime + (duur || 0.08))
    } catch (e) {}
  }

  // ── Menu: kies een level ──
  function menu() {
    stopLus()
    const n = open()
    inhoud.innerHTML = ''
    const kaart = document.createElement('div')
    kaart.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px;max-width:340px;text-align:center'
    const kop = document.createElement('div'); kop.textContent = '🧱 Neo Paddle'; kop.style.cssText = 'font-size:22px;font-weight:700;color:#00f0ff;text-shadow:0 0 12px #00f0ff'
    const sub = document.createElement('div'); sub.textContent = T('Haal alle blokjes weg. Vang groene power-ups, ontwijk rode.'); sub.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.75);line-height:1.4'
    const rec = document.createElement('div'); rec.textContent = T('Jouw record: {n}', { n: record() }); rec.style.cssText = 'font-size:13px;color:#ff00cc'
    const raster = document.createElement('div'); raster.style.cssText = 'display:grid;grid-template-columns:repeat(4,64px);gap:10px;margin-top:6px'
    NPK.LEVELS.forEach((l, i) => {
      const k = document.createElement('button'); k.type = 'button'
      const dicht = i >= n
      k.disabled = dicht
      k.setAttribute('aria-label', dicht ? T('Level {n} (nog dicht)', { n: i + 1 }) : T('Level {n}: {naam}', { n: i + 1, naam: NPK.levelNaam(i) }))
      k.title = NPK.levelNaam(i)
      k.textContent = dicht ? '🔒' : String(i + 1)
      k.style.cssText = 'height:56px;border-radius:12px;font:700 18px monospace;cursor:' + (dicht ? 'default' : 'pointer') + ';' +
        (dicht ? 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4)'
               : 'background:#050510;border:2px solid #00f0ff;color:#00f0ff;box-shadow:0 0 12px rgba(0,240,255,0.35)')
      if (!dicht) k.onclick = () => begin(i, 0, START_LEVENS)
      raster.append(k)
    })
    kaart.append(kop, sub, rec, raster)
    inhoud.append(kaart)
  }

  // ── Spelen ──
  let canvas, ctx, hudEl, knopEl
  function begin(level, score, levens) {
    stopLus()
    inhoud.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        <div id="np-hud" style="color:#00f0ff;font-size:13px;font-weight:700;letter-spacing:1px;text-shadow:0 0 8px #00f0ff;min-height:18px;text-align:center"></div>
        <canvas id="np-canvas" width="${B}" height="${H}" style="background:#050510;border:2px solid #ff00cc;border-radius:8px;touch-action:none;box-shadow:0 0 30px rgba(255,0,204,0.5),0 0 60px rgba(255,0,204,0.2);"></canvas>
        <div id="np-uitleg" style="font-size:11px;color:rgba(255,255,255,0.6);text-align:center;max-width:280px"></div>
        <div id="np-knoppen" style="display:flex;gap:10px;min-height:40px"></div>
      </div>`
    canvas = document.getElementById('np-canvas'); ctx = canvas.getContext('2d')
    hudEl = document.getElementById('np-hud'); knopEl = document.getElementById('np-knoppen')
    document.getElementById('np-uitleg').textContent = T('Sleep om je paddle te bewegen. Tik om de bal weg te schieten.')
    spel = maakSpel(level, { score, levens })
    vonken = []; melding = { tekst: T('Level {n}: {naam}', { n: level + 1, naam: NPK.levelNaam(level) }), leven: 120 }
    toonHud()
    laatsteTijd = performance.now(); rest = 0
    frame = requestAnimationFrame(lus)
  }
  function stopLus() { if (frame) cancelAnimationFrame(frame); frame = null }

  function toonHud() {
    if (!spel) return
    hudEl.textContent = T('Level {n}', { n: spel.level + 1 }) + ' · ' + T('Score {n}', { n: spel.score }) + ' · ' + '♥'.repeat(Math.max(0, spel.levens))
  }

  // Waar wil de paddle heen? (vinger/muis, of de pijltjestoetsen)
  function doelX() {
    const pb = NPK.paddleBreedte(spel.eff)
    let x
    if (vingerX !== null) {
      const r = canvas.getBoundingClientRect()
      x = (vingerX - r.left) * (B / r.width)
      if (spel.eff.omgekeerd > 0) x = B - x
      return x - pb / 2
    }
    const stapje = (toetsRechts ? 6 : 0) - (toetsLinks ? 6 : 0)
    return spel.paddleX + (spel.eff.omgekeerd > 0 ? -stapje : stapje)
  }

  function lus(nu) {
    if (!isActief() || !spel) return
    // Vaste stapjes van 1/60 seconde: even snel op elk scherm (ook 120 Hz)
    rest += Math.min(100, nu - laatsteTijd); laatsteTijd = nu
    while (rest >= 1000 / 60) { rest -= 1000 / 60; stap(spel, doelX()); verwerk() }
    teken()
    if (spel.status === 'spelen') frame = requestAnimationFrame(lus)
    else klaar()
  }

  function verwerk() {
    for (const g of spel.gebeurtenis) {
      if (g.soort === 'paddle') piep(440, 0.05, 0.1)
      else if (g.soort === 'muur') piep(330, 0.03, 0.06)
      else if (g.soort === 'tik') { piep(660, 0.05, 0.1, 'triangle'); vonk(g.x, g.y, '#ff00cc', 4) }
      else if (g.soort === 'metaal') { piep(1400, 0.04, 0.08, 'sine'); vonk(g.x, g.y, '#c9cede', 3) }
      else if (g.soort === 'breek') { piep(880 + 120 * (g.max || 1), 0.06, 0.1, 'triangle'); vonk(g.x, g.y, '#00f0ff', 8); schok = Math.min(4, schok + 1.5) }
      else if (g.soort === 'schild') { piep(1200, 0.15, 0.12, 'sine'); vonk(g.x, H - 8, '#39ff88', 10) }
      else if (g.soort === 'mis') { piep(180, 0.3, 0.16, 'sawtooth'); schok = 6; melding = { tekst: spel.levens > 0 ? T('Bal kwijt!') : '', leven: 70 } }
      else if (g.soort === 'power') {
        const p = NPK.POWERUPS[g.welke]
        if (g.goed) { piep(660, 0.08, 0.12, 'triangle'); setTimeout(() => piep(990, 0.12, 0.12, 'triangle'), 80) }
        else { piep(330, 0.1, 0.12, 'sawtooth'); setTimeout(() => piep(220, 0.14, 0.12, 'sawtooth'), 90) }
        melding = { tekst: p.icoon + ' ' + NPK.powerupNaam(g.welke), leven: 90 }
      } else if (g.soort === 'gehaald') { piep(523, 0.12, 0.16); setTimeout(() => piep(659, 0.12, 0.16), 120); setTimeout(() => piep(784, 0.2, 0.16), 240) }
    }
    if (spel.gebeurtenis.length) toonHud()
    spel.gebeurtenis.length = 0
  }
  function vonk(x, y, kleur, n) {
    for (let i = 0; i < n; i++) {
      const h = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 2
      vonken.push({ x, y, vx: Math.cos(h) * s, vy: Math.sin(h) * s, leven: 1, kleur })
    }
    if (vonken.length > 80) vonken = vonken.slice(-80)
  }

  function teken() {
    ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, B, H)
    ctx.save()
    if (schok > 0.2) { ctx.translate((Math.random() - 0.5) * schok, (Math.random() - 0.5) * schok); schok *= 0.85 } else schok = 0
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1
    for (let gx = 0; gx < B; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke() }
    for (let gy = 0; gy < H; gy += 20) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(B, gy); ctx.stroke() }
    NPK.tekenBlokken(ctx, spel.blokken, false)
    for (const c of spel.capsules) NPK.tekenCapsule(ctx, c, false)
    if (spel.eff.schild) NPK.tekenSchild(ctx, SCHILD_Y, performance.now())
    // Paddle: oranje als hij omgekeerd werkt, met een vuurgloed bij de vuurbal
    const pb = NPK.paddleBreedte(spel.eff), kleur = spel.eff.omgekeerd > 0 ? '#ff9f1c' : '#00f0ff'
    ctx.save(); ctx.fillStyle = kleur; ctx.shadowColor = spel.eff.vuur > 0 ? '#ff5a1f' : kleur; ctx.shadowBlur = spel.eff.vuur > 0 ? 24 : 16
    ctx.fillRect(spel.paddleX, PADDLE_Y, pb, PH); ctx.restore()
    for (const b of spel.ballen) {
      const vuur = spel.eff.vuur > 0, k = vuur ? '#ff7a2f' : '#ffffff'
      ctx.save(); ctx.fillStyle = k; ctx.shadowColor = vuur ? '#ff5a1f' : '#00f0ff'; ctx.shadowBlur = vuur ? 26 : 18
      ctx.beginPath(); ctx.arc(b.x, b.y, BAL / 2 + (vuur ? 1 : 0), 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
    for (let i = vonken.length - 1; i >= 0; i--) {
      const v = vonken[i]
      v.x += v.vx; v.y += v.vy; v.vx *= 0.92; v.vy *= 0.92; v.leven -= 0.05
      if (v.leven <= 0) { vonken.splice(i, 1); continue }
      ctx.save(); ctx.globalAlpha = v.leven; ctx.fillStyle = v.kleur; ctx.shadowColor = v.kleur; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.arc(v.x, v.y, 1.5 * v.leven + 0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
    ctx.restore()
    // Tip zolang de bal nog op de paddle ligt
    if (spel.status === 'spelen' && spel.ballen.some(b => b.vast)) {
      ctx.save(); ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText(T('Tik om te starten'), B / 2, PADDLE_Y - 40); ctx.restore()
    }
    if (melding.leven > 0) { NPK.tekenMelding(ctx, melding.tekst, melding.leven, H / 2 + 40); melding.leven-- }
  }

  function knop(tekst, fn, hoofd) {
    const k = document.createElement('button'); k.type = 'button'; k.textContent = tekst
    k.style.cssText = 'border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;font-family:inherit;' +
      (hoofd ? 'background:linear-gradient(135deg,#00f0ff,#ff00cc);color:#050510' : 'background:rgba(255,255,255,0.12);color:white')
    k.onclick = fn
    knopEl.append(k)
    return k
  }
  function overlay(regel1, regel2, kleur) {
    ctx.save(); ctx.fillStyle = 'rgba(5,5,16,0.78)'; ctx.fillRect(0, 0, B, H)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 26px monospace'; ctx.fillStyle = kleur; ctx.shadowColor = kleur; ctx.shadowBlur = 20
    ctx.fillText(regel1, B / 2, H / 2 - 20)
    ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 8
    ctx.fillText(regel2, B / 2, H / 2 + 18)
    ctx.restore()
  }

  function klaar() {
    toonHud()
    knopEl.textContent = ''
    if (spel.status === 'gehaald') {
      const volgende = spel.level + 1
      if (volgende < NPK.LEVELS.length) {
        if (volgende + 1 > open()) bewaar('open', String(volgende + 1))
        overlay(T('Level gehaald!'), T('Score {n}', { n: spel.score }), '#39ff88')
        knop(T('Levels'), menu)
        knop(T('Volgend level ›'), () => begin(volgende, spel.score, spel.levens), true).focus()
      } else {
        const nieuw = solo && solo.nieuweScore ? solo.nieuweScore(spel.score) : false
        overlay(T('Alles uitgespeeld!'), (nieuw ? T('Nieuw record! ') : '') + T('Score {n}', { n: spel.score }), '#ffe066')
        knop(T('Levels'), menu, true).focus()
      }
    } else {
      const nieuw = solo && solo.nieuweScore ? solo.nieuweScore(spel.score) : false
      overlay(T('Game over'), (nieuw ? T('Nieuw record! ') : '') + T('Score {n}', { n: spel.score }), '#ff00cc')
      knop(T('Levels'), menu)
      knop(T('↻ Opnieuw'), () => begin(spel.level, 0, START_LEVENS), true).focus()
    }
  }

  // ── Besturing: slepen (overal op het scherm), muis over het veld, tikken, toetsen ──
  const vlak = document.getElementById('spelOverlay') || document.body
  const opKnop = e => e.target && e.target.closest && e.target.closest('button')
  vlak.addEventListener('touchstart', e => { if (!isActief() || !spel || opKnop(e)) return; vingerX = e.touches[0].clientX }, { passive: true })
  vlak.addEventListener('touchmove', e => { if (!isActief() || !spel || opKnop(e)) return; e.preventDefault(); vingerX = e.touches[0].clientX }, { passive: false })
  vlak.addEventListener('touchend', e => { if (!isActief() || !spel || opKnop(e)) return; lanceer(spel); verwerkBuiten() })
  vlak.addEventListener('mousemove', e => { if (!isActief() || !spel) return; vingerX = e.clientX })
  vlak.addEventListener('mousedown', e => { if (!isActief() || !spel || opKnop(e)) return; vingerX = e.clientX; lanceer(spel); verwerkBuiten() })
  const toets = (e, aan) => {
    if (!isActief() || !spel) return
    if (e.key === 'ArrowLeft') { toetsLinks = aan; vingerX = null; e.preventDefault() }
    else if (e.key === 'ArrowRight') { toetsRechts = aan; vingerX = null; e.preventDefault() }
    else if (aan && (e.key === ' ' || e.key === 'ArrowUp') && spel.status === 'spelen') { lanceer(spel); verwerkBuiten(); e.preventDefault() }
  }
  window.addEventListener('keydown', e => toets(e, true))
  window.addEventListener('keyup', e => toets(e, false))
  function verwerkBuiten() { if (spel && spel.status === 'spelen') verwerk() }

  menu()
}
