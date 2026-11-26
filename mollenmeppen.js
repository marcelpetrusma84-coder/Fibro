// mollenmeppen.js (v2, 26 nov 2026, Marcel; v2: het geluid deed het niet) - Mollen meppen: een mini-game voor in de wachtkamer, terwijl je wacht tot je
// vrienden er zijn (het wachtscherm in de chat en de wachtkamer van een groepsspel).
//
// In gewone woorden: een raster van 4 bij 4 holen. Er komen mollen uit; tik er zo veel mogelijk aan in 30 seconden.
// Een geraakte mol maakt een grappig geluidje (elke keer een beetje anders). Het gaat steeds sneller. Je hoogste score
// wordt onthouden (per account, op dit toestel). Gaat het wachtscherm dicht (je vriend is er, het spel begint), dan stopt
// de mini-game vanzelf: hij kijkt zelf of hij nog op het scherm staat.
//
//   const m = maakMollenMeppen()    m.el = het spel (zet het waar je wilt), m.stop(), m.record()
//   molKnop(houder)                  een knop "🔨 Mollen meppen" in houder; een tik zet het spel op die plek
export const RONDE_MS = 30000
export const GROOTTE = 4
const T = (s, v) => (typeof window !== 'undefined' && window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

// Hoe snel het gaat na t ms (0 .. RONDE_MS): eerst rustig, op het eind snel
export function tempo(t) {
  const f = Math.min(1, Math.max(0, t / RONDE_MS))
  return { elke: Math.round(900 - 450 * f), blijft: Math.round(1100 - 550 * f), dubbel: f > 0.5 ? 0.35 : 0.12 }
}

function accountId() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) { const id = JSON.parse(localStorage.getItem(k))?.user?.id; if (id) return id }
    }
  } catch (e) {}
  return 'lokaal'
}
const recordSleutel = () => 'fibro_mollen_record_' + accountId()
export function leesRecord() { try { return parseInt(localStorage.getItem(recordSleutel()), 10) || 0 } catch (e) { return 0 } }
export function bewaarRecord(n) {
  n = Math.floor(Number(n)) || 0
  if (n <= leesRecord()) return false
  try { localStorage.setItem(recordSleutel(), String(n)) } catch (e) {}
  return true
}

// ── Geluid: gemaakt met Web Audio (geen bestanden). Vier soorten: boing, piep, plop en kwak, steeds iets anders. ──
let audio = null
function geluid(soort) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
    const nu = audio.currentTime, toon = 0.9 + Math.random() * 0.25
    const osc = audio.createOscillator(), vol = audio.createGain()
    osc.connect(vol); vol.connect(audio.destination)
    const zet = (f, t) => osc.frequency.exponentialRampToValueAtTime(Math.max(30, f * toon), nu + t)
    osc.start(nu) // v2 (26 nov 2026): eerst starten, dan pas stop() plannen; andersom gaf een fout en dus geen geluid
    vol.gain.setValueAtTime(0.0001, nu); vol.gain.exponentialRampToValueAtTime(0.22, nu + 0.012)
    if (soort === 'boing') { osc.type = 'sine'; osc.frequency.setValueAtTime(520 * toon, nu); zet(140, 0.32); vol.gain.exponentialRampToValueAtTime(0.0001, nu + 0.36); osc.stop(nu + 0.37) }
    else if (soort === 'piep') { osc.type = 'square'; osc.frequency.setValueAtTime(900 * toon, nu); zet(1500, 0.08); zet(700, 0.16); vol.gain.setValueAtTime(0.08, nu + 0.012); vol.gain.exponentialRampToValueAtTime(0.0001, nu + 0.18); osc.stop(nu + 0.19) }
    else if (soort === 'plop') { osc.type = 'triangle'; osc.frequency.setValueAtTime(260 * toon, nu); zet(620, 0.05); zet(180, 0.14); vol.gain.exponentialRampToValueAtTime(0.0001, nu + 0.16); osc.stop(nu + 0.17) }
    else { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(330 * toon, nu); zet(220, 0.09); zet(300, 0.16); zet(180, 0.24); vol.gain.setValueAtTime(0.07, nu + 0.012); vol.gain.exponentialRampToValueAtTime(0.0001, nu + 0.26); osc.stop(nu + 0.27) }
  } catch (e) {}
}
// v2: het geluid alvast openzetten bij een tik op een knop (een iPhone wil dat bij een echte tik, niet bij het eerste aanraken)
function geluidOpen() {
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume() } catch (e) {}
}
export const GELUIDEN = ['boing', 'piep', 'plop', 'kwak']

const MOL = '<svg viewBox="0 0 60 60" aria-hidden="true"><ellipse cx="30" cy="34" rx="20" ry="22" fill="#8a5a33"/><ellipse cx="30" cy="40" rx="12" ry="11" fill="#b98258"/>'
  + '<circle cx="22" cy="27" r="3.4" fill="#1a0a2e"/><circle cx="38" cy="27" r="3.4" fill="#1a0a2e"/><circle cx="23" cy="26" r="1.1" fill="#fff"/><circle cx="39" cy="26" r="1.1" fill="#fff"/>'
  + '<ellipse cx="30" cy="35" rx="5.5" ry="4" fill="#f29bb5"/><rect x="26.5" y="40" width="3" height="5" rx="1" fill="#fff"/><rect x="30.5" y="40" width="3" height="5" rx="1" fill="#fff"/></svg>'

const STIJL = `
.mol-spel{width:min(300px,78vw);max-width:100%;margin:6px auto 0;padding:12px;border-radius:16px;background:#1a0a2e;border:1px solid #c084fc66;color:#fff;font-family:inherit;box-sizing:border-box;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.mol-kop{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;margin-bottom:8px}
.mol-kop b{font-size:15px}
.mol-tellers{display:flex;gap:10px;color:#e9d5ff}
.mol-veld{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.mol-gat{position:relative;aspect-ratio:1;border:0;padding:0;border-radius:50%;overflow:hidden;cursor:pointer;background:radial-gradient(ellipse at 50% 72%,#0b0416 0 46%,#3b2160 47% 62%,#2a1747 63%);-webkit-tap-highlight-color:transparent}
.mol-gat .mol{position:absolute;left:6%;right:6%;bottom:-95%;transition:bottom .12s ease-out;pointer-events:none}
.mol-gat.op .mol{bottom:-2%}
.mol-gat.raak .mol{bottom:-2%;transform:scaleY(.6) translateY(18%);filter:brightness(1.25)}
.mol-gat.raak::after{content:"💫";position:absolute;top:2%;left:0;right:0;text-align:center;font-size:18px}
.mol-onder{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:10px;min-height:38px;font-size:13px;text-align:center}
.mol-knop{background:#8b3fd1;color:#fff;border:0;border-radius:10px;padding:9px 18px;font:inherit;font-weight:700;cursor:pointer}
.mol-start{background:#8b3fd1;color:#fff;border:1px solid #c084fc;border-radius:10px;padding:9px 16px;font:inherit;font-weight:700;cursor:pointer;margin-top:4px}
@media (prefers-reduced-motion:reduce){.mol-gat .mol{transition:none}}
`
function zetStijl() {
  if (typeof document === 'undefined' || document.getElementById('mol-stijl')) return
  const s = document.createElement('style'); s.id = 'mol-stijl'; s.textContent = STIJL; document.head.appendChild(s)
}

export function maakMollenMeppen({ nu = () => Date.now(), kans = Math.random } = {}) {
  zetStijl()
  const el = document.createElement('div'); el.className = 'mol-spel'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', T('Mollen meppen'))
  el.innerHTML = '<div class="mol-kop"><b>🔨 ' + T('Mollen meppen') + '</b><span class="mol-tellers"><span class="mol-score"></span><span class="mol-tijd"></span></span></div>'
    + '<div class="mol-veld"></div><div class="mol-onder"></div>'
  const veld = el.querySelector('.mol-veld'), onder = el.querySelector('.mol-onder')
  const scoreEl = el.querySelector('.mol-score'), tijdEl = el.querySelector('.mol-tijd')
  const gaten = []
  for (let i = 0; i < GROOTTE * GROOTTE; i++) {
    const g = document.createElement('button'); g.type = 'button'; g.className = 'mol-gat'; g.dataset.nr = i
    g.setAttribute('aria-label', T('Gat {n}', { n: i + 1 })); g.innerHTML = '<span class="mol">' + MOL + '</span>'
    g.addEventListener('pointerdown', e => { e.preventDefault(); mep(i) })
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mep(i) } })
    veld.appendChild(g); gaten.push(g)
  }
  let score = 0, begin = 0, bezig = false, gestopt = false
  const tijden = new Set(), weg = new Map()
  const later = (f, ms) => { const t = setTimeout(() => { tijden.delete(t); f() }, ms); tijden.add(t); return t }
  const toonTellers = () => {
    scoreEl.textContent = '⭐ ' + score
    tijdEl.textContent = '⏱ ' + Math.max(0, Math.ceil((RONDE_MS - (bezig ? nu() - begin : RONDE_MS)) / 1000)) + 's'
  }
  function toonStart(tekst) {
    onder.innerHTML = ''
    const r = document.createElement('span'); r.className = 'mol-uitslag'; r.textContent = tekst || T('Record: {n}', { n: leesRecord() })
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mol-knop'; b.textContent = tekst ? T('Nog een keer') : T('▶ Start')
    b.onclick = () => { geluidOpen(); start() }
    onder.append(r, b)
  }
  function zet(i, op) {
    const g = gaten[i]; clearTimeout(weg.get(i)); weg.delete(i)
    g.classList.toggle('op', op); g.classList.remove('raak')
    if (op) weg.set(i, later(() => zet(i, false), tempo(nu() - begin).blijft))
  }
  function nieuweMol() {
    if (!bezig) return
    const vrij = gaten.map((g, i) => i).filter(i => !gaten[i].classList.contains('op') && !gaten[i].classList.contains('raak'))
    const p = tempo(nu() - begin)
    for (let n = kans() < p.dubbel ? 2 : 1; n > 0 && vrij.length; n--) zet(vrij.splice(Math.floor(kans() * vrij.length), 1)[0], true)
    later(nieuweMol, p.elke)
  }
  function mep(i) {
    const g = gaten[i]
    if (!bezig || !g.classList.contains('op')) return
    clearTimeout(weg.get(i)); weg.delete(i)
    g.classList.remove('op'); g.classList.add('raak')
    score++; toonTellers()
    geluid(GELUIDEN[Math.floor(kans() * GELUIDEN.length)])
    try { navigator.vibrate?.(12) } catch (e) {}
    later(() => g.classList.remove('raak'), 260)
  }
  function start() {
    if (gestopt) return
    for (const t of tijden) clearTimeout(t); tijden.clear()
    for (const g of gaten) g.classList.remove('op', 'raak')
    score = 0; begin = nu(); bezig = true
    onder.innerHTML = '<span class="mol-uitslag">' + T('Tik op de mollen!') + '</span>'
    toonTellers(); nieuweMol()
  }
  function einde() {
    bezig = false
    for (const t of tijden) clearTimeout(t); tijden.clear()
    for (const g of gaten) g.classList.remove('op', 'raak')
    const nieuw = bewaarRecord(score)
    toonTellers()
    toonStart((nieuw ? '🏆 ' + T('Nieuw record: {n}!', { n: score }) : T('{n} mollen! Record: {r}', { n: score, r: leesRecord() })))
  }
  // elke kwart seconde: de klok, het einde van de ronde, en stoppen als het wachtscherm weg is
  const klok = setInterval(() => {
    if (!el.isConnected) { stop(); return }
    if (bezig) { toonTellers(); if (nu() - begin >= RONDE_MS) einde() }
  }, 250)
  function stop() {
    if (gestopt) return
    gestopt = true; bezig = false; clearInterval(klok)
    for (const t of tijden) clearTimeout(t); tijden.clear()
  }
  toonTellers(); toonStart()
  return { el, stop, start, record: leesRecord, get score() { return score }, get bezig() { return bezig }, get gestopt() { return gestopt }, _mep: mep, _einde: einde }
}

// Een knop in het wachtscherm; een tik zet de mini-game op die plek en start meteen een ronde.
export function molKnop(houder, opties) {
  zetStijl()
  const b = document.createElement('button'); b.type = 'button'; b.className = 'mol-start'
  b.textContent = T('🔨 Mollen meppen terwijl je wacht')
  b.onclick = () => { geluidOpen(); const m = maakMollenMeppen(opties); b.replaceWith(m.el); m.start(); b._mol = m; houder?.dispatchEvent?.(new CustomEvent('mollen', { detail: m })) }
  houder?.appendChild(b)
  return b
}
