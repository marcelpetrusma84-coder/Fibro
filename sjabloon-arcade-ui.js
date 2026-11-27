// sjabloon-arcade-ui.js - SJABLOON voor een arcadespel (v1, 27 nov 2026), zoals Flapper of Block It. Hoort bij
// sjabloon-arcade.js (de spelwereld). Stekky Studio kopieert dit naar <id>-ui.js voor een arcadespel.
//
// In gewone woorden: "Ontwijk" met alles wat een arcadespel in Stekky nodig heeft:
//   - tekenen op een <canvas> dat het hele speelveld vult (ook scherp op een telefoon: devicePixelRatio);
//   - besturen met de pijltjes of A/D, door met je vinger te schuiven, of met een controller (controller.js maakt van
//     een controller vanzelf toetsen);
//   - requestAnimationFrame: het ☰-menu (spelmenu.js) zet dat vanzelf stil bij pauze;
//   - punten en je record: spel.html geeft `solo` mee (solo.record(), solo.nieuweScore(n)); dat zet de score ook op
//     het scorebord (punten, top 10);
//   - geluidjes (kaartGeluid uit kaartspel-hulp.js) en trillen.
import * as W from './sjabloon-arcade.js?v=1'
import { kaartGeluid, tril } from './kaartspel-hulp.js?v=22'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Ontwijk': 'Dodge', 'Tik om te beginnen': 'Tap to start', 'Schuif opzij, laat je niet raken!': "Slide sideways, don't get hit!",
  'Record {n}': 'Record {n}', 'Score {n}': 'Score {n}', 'Game over': 'Game over', '🏆 Nieuw record: {n}!': '🏆 New record: {n}!',
  'Tik om nog een keer te spelen': 'Tap to play again',
})

export function start({ solo } = {}) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🕹️ ' + T('Ontwijk') // STUDIO-TITEL
  const record = () => (solo && typeof solo.record === 'function' ? solo.record() : 0)

  inhoud.innerHTML = '<div class="sjr" style="position:absolute;inset:0;background:#1a0a2e;touch-action:none;user-select:none">'
    + '<canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas>'
    + '<div class="sjr-score" style="position:absolute;top:56px;left:0;right:0;text-align:center;color:#fff;font-weight:900;font-size:22px;text-shadow:0 2px 6px #000"></div>'
    + '<div class="sjr-bord" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff;text-align:center;padding:20px">'
    + '<div class="sjr-titel" style="font-size:28px;font-weight:900"></div><div class="sjr-sub" style="opacity:.85"></div>'
    + '<button type="button" class="sjr-start" style="margin-top:8px;padding:12px 22px;border:0;border-radius:14px;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;font-size:17px"></button></div></div>'
  const doos = inhoud.querySelector('.sjr'), canvas = doos.querySelector('canvas'), ctx = canvas.getContext('2d')
  const scoreEl = doos.querySelector('.sjr-score'), bord = doos.querySelector('.sjr-bord')

  let wereld = W.nieuweWereld(), speelt = false, vorige = 0, raf = 0
  const toetsen = { links: false, rechts: false }
  let doelX = null

  function maat() {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d))
  }
  function teken() {
    const b = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, b, h)
    // de blokken
    ctx.fillStyle = '#c084fc'
    for (const k of wereld.blokken) ctx.fillRect((k.x - k.w / 2) * b, (k.y - k.h / 2) * h, k.w * b, k.h * h)
    // het poppetje
    ctx.fillStyle = wereld.over ? '#ff5c7a' : '#fde68a'
    const pb = W.SPELER.breed * b, ph = W.SPELER.hoog * h
    ctx.beginPath(); ctx.roundRect(wereld.x * b - pb / 2, W.SPELER.y * h - ph / 2, pb, ph, ph / 2); ctx.fill()
    scoreEl.textContent = speelt || wereld.over ? T('Score {n}', { n: W.punten(wereld) }) : ''
  }
  function lus(nu) {
    if (!doos.isConnected) return
    const dt = vorige ? (nu - vorige) / 1000 : 0
    vorige = nu
    wereld = W.stap(wereld, dt, doelX !== null ? { doelX } : toetsen)
    teken()
    if (wereld.over) return gameOver()
    raf = requestAnimationFrame(lus)
  }
  function begin() {
    if (speelt) return
    wereld = W.nieuweWereld(); speelt = true; vorige = 0; doelX = null
    bord.style.display = 'none'
    kaartGeluid.tik()
    raf = requestAnimationFrame(lus)
  }
  function gameOver() {
    speelt = false
    const score = W.punten(wereld)
    const nieuw = solo && typeof solo.nieuweScore === 'function' ? solo.nieuweScore(score) : false   // ook naar het scorebord
    kaartGeluid.verlies(); tril([40, 60, 40])
    toonBord(nieuw ? T('🏆 Nieuw record: {n}!', { n: score }) : T('Game over'), T('Score {n}', { n: score }) + ' · ' + T('Record {n}', { n: record() }), T('Tik om nog een keer te spelen'))
  }
  function toonBord(t, sub, knop) {
    doos.querySelector('.sjr-titel').textContent = t
    doos.querySelector('.sjr-sub').textContent = sub
    doos.querySelector('.sjr-start').textContent = knop
    bord.style.display = 'flex'
  }

  // besturen: toetsen (en een controller via controller.js), en schuiven met je vinger
  const toets = (e, aan) => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) { toetsen.links = aan; doelX = null; e.preventDefault() }
    if (['ArrowRight', 'd', 'D'].includes(e.key)) { toetsen.rechts = aan; doelX = null; e.preventDefault() }
    if (aan && (e.key === ' ' || e.key === 'Enter') && !speelt) { begin(); e.preventDefault() }
  }
  const omlaag = e => toets(e, true), omhoog = e => toets(e, false)
  window.addEventListener('keydown', omlaag); window.addEventListener('keyup', omhoog)
  const vinger = e => { if (!speelt) return; const r = canvas.getBoundingClientRect(); doelX = (e.clientX - r.left) / Math.max(1, r.width) }
  doos.addEventListener('pointerdown', vinger); doos.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') vinger(e) })
  doos.querySelector('.sjr-start').onclick = e => { e.stopPropagation(); begin() }
  const ro = new ResizeObserver(() => { maat(); teken() }); ro.observe(canvas)
  // opruimen als het spel dichtgaat
  const weg = setInterval(() => {
    if (doos.isConnected) return
    clearInterval(weg); cancelAnimationFrame(raf); ro.disconnect()
    window.removeEventListener('keydown', omlaag); window.removeEventListener('keyup', omhoog)
  }, 1000)

  maat(); teken()
  toonBord(T('Ontwijk'), T('Schuif opzij, laat je niet raken!') + ' · ' + T('Record {n}', { n: record() }), T('Tik om te beginnen'))
}
