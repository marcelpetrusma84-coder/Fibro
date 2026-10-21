/* Neon Raiders — schietspel (shmup) voor Fibro. v192 (21 oktober 2026).
   Zelfde stijl als Runner & Gunner: alles in code getekend (geen plaatjes), Phaser 3.80.1 uit de eigen repo,
   het lettertype Press Start 2P en geluid en muziek met Web Audio.
   Stap 1: alleen spelen, level 1 (aarde: je ziet de grond) met eindbaas TITAN.
   Besturing: een vinger slepen = vliegen (je schip beweegt mee, je vinger zit er niet op);
   een tweede vinger tikken of ingedrukt houden = schieten. Met de muis: slepen = vliegen en schieten.
   De tegel linksboven: wapen wisselen of een power-up gebruiken (het spel loopt dan even in slow motion).
   Toetsen: pijltjes of WASD = vliegen, spatie = schieten, Q = de tegel, 1-6 = kiezen in de tegel.
   De golven komen uit een vaste toevalsreeks per level: later spelen twee spelers samen precies hetzelfde level. */

const vertaal = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const PHASER_URL = new URL('./phaser.min.js?v=1', import.meta.url).href
const FONT_URL = 'lettertypen/press-start-2p.css?v=1'

function laadPhaser() {
  if (window.Phaser) return Promise.resolve()
  if (window._rgPhaserLaden) return window._rgPhaserLaden   // dezelfde lader als Runner & Gunner
  window._rgPhaserLaden = new Promise((ok, fout) => {
    const s = document.createElement('script')
    s.src = PHASER_URL
    s.onload = () => ok()
    s.onerror = () => { window._rgPhaserLaden = null; fout(new Error('Phaser kon niet laden')) }
    document.head.appendChild(s)
  })
  return window._rgPhaserLaden
}

function zetStijl() {
  if (!document.getElementById('rg-font')) {
    const l = document.createElement('link')
    l.id = 'rg-font'; l.rel = 'stylesheet'; l.href = FONT_URL
    document.head.appendChild(l)
  }
  if (document.getElementById('nr-stijl')) return
  const st = document.createElement('style')
  st.id = 'nr-stijl'
  st.textContent = `
  .nr{--diep:#07051a;--paneel:#140f2e;--rand:#3a2a6e;--inkt:#e8f6ff;--zacht:#8f9cc8;--cyaan:#5ee7e0;--roze:#ff5d9e;--geel:#ffe14a;
    position:absolute;inset:0;padding:52px 8px 8px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;
    color:var(--inkt);font-family:"Press Start 2P",monospace;font-size:10px;line-height:1.9;
    touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .nr *{box-sizing:border-box}
  .nr .veld{position:relative;overflow:hidden;border:3px solid #3a4250;border-radius:10px;background:var(--diep);
    touch-action:none;-webkit-tap-highlight-color:transparent;flex:none;
    box-shadow:0 0 0 1px #0b0d12,0 0 22px rgba(94,231,224,.22),inset 0 0 0 1px rgba(94,231,224,.4)}
  .nr .hoek{position:absolute;width:20px;height:20px;bottom:3px;z-index:5;pointer-events:none;border:0 solid var(--cyaan);filter:drop-shadow(0 0 4px var(--cyaan))}
  .nr .hoek.l{left:3px;border-width:0 0 2px 2px}
  .nr .hoek.r{right:3px;border-width:0 2px 2px 0}
  .nr .veld canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
  .nr .hud{position:absolute;top:6px;right:8px;text-align:right;pointer-events:none;z-index:2}
  .nr .scoreRij{display:flex;align-items:baseline;gap:6px;justify-content:flex-end}
  .nr .p1{font-size:7px;color:var(--cyaan);text-shadow:0 0 6px var(--cyaan)}
  .nr .score{font-size:12px;color:#fff;text-shadow:0 0 6px var(--cyaan),2px 2px 0 #07051a;letter-spacing:1px}
  .nr .combo{font-size:8px;color:var(--geel);text-shadow:0 0 6px var(--geel);min-height:12px}
  .nr .levens{display:flex;gap:3px;justify-content:flex-end;margin-top:2px}
  .nr .levens svg{width:11px;height:13px;filter:drop-shadow(0 0 3px var(--cyaan))}
  .nr .tegel{position:absolute;top:6px;left:6px;width:46px;height:46px;z-index:4;padding:0;cursor:pointer;
    background:rgba(20,15,46,.82);border:2px solid var(--cyaan);border-radius:8px;box-shadow:0 0 10px rgba(94,231,224,.55),inset 0 0 8px rgba(94,231,224,.25);
    display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-tap-highlight-color:transparent}
  .nr .tegel canvas{width:28px;height:28px;image-rendering:pixelated;image-rendering:crisp-edges}
  .nr .tegel .stip{position:absolute;bottom:3px;left:0;right:0;display:flex;gap:3px;justify-content:center}
  .nr .tegel .stip i{width:4px;height:4px;background:var(--zacht)}
  .nr .tegel .stip i.aan{background:#fff;box-shadow:0 0 4px #fff}
  .nr .tegel .extra{position:absolute;top:-7px;right:-9px;font-size:7px;line-height:1;padding:3px 3px 2px;color:#07051a;background:var(--geel);border-radius:3px;box-shadow:0 0 6px var(--geel)}
  .nr .tegel .extra:empty{display:none}
  .nr .tegel.open{border-color:var(--geel);box-shadow:0 0 14px rgba(255,225,74,.7)}
  .nr .arsenaal{position:absolute;top:6px;left:58px;right:6px;z-index:4;display:flex;flex-wrap:wrap;gap:6px}
  .nr .arsenaal[hidden]{display:none}
  .nr .arsenaal button{position:relative;width:42px;height:46px;padding:2px 0 0;font-family:inherit;font-size:6px;line-height:1;color:var(--inkt);
    background:rgba(20,15,46,.9);border:2px solid var(--rand);border-radius:7px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
    touch-action:none;-webkit-tap-highlight-color:transparent}
  .nr .arsenaal button canvas{width:21px;height:21px;image-rendering:pixelated;image-rendering:crisp-edges}
  .nr .arsenaal button.nu{border-color:var(--cyaan);box-shadow:0 0 8px rgba(94,231,224,.6)}
  .nr .arsenaal button:disabled{opacity:.35}
  .nr .arsenaal button .n{position:absolute;top:2px;right:3px;color:var(--geel)}
  .nr .baas{position:absolute;left:60px;right:96px;top:12px;z-index:2;pointer-events:none;font-size:7px;color:#ff8ad8;text-shadow:0 0 6px #ff3dd2}
  .nr .baas[hidden]{display:none}
  .nr .baas .balk{height:6px;margin-top:4px;border:1px solid #ff3dd2;background:rgba(40,0,40,.7);box-shadow:0 0 6px #ff3dd2}
  .nr .baas .balk i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff3dd2,#ffe14a);transition:width .12s linear}
  .nr .laag{position:absolute;inset:0;display:grid;place-items:center;text-align:center;background:rgba(7,5,26,.88);padding:14px;overflow-y:auto;z-index:6}
  .nr .laag[hidden]{display:none}
  .nr .laag h1{margin:0 0 12px;font-size:20px;line-height:1.5;font-weight:400;color:#fff;
    text-shadow:0 0 4px var(--roze),0 0 12px var(--roze),0 0 28px var(--roze)}
  .nr .laag h1 span{display:block;color:#fff;text-shadow:0 0 4px var(--cyaan),0 0 12px var(--cyaan),0 0 28px var(--cyaan)}
  .nr .laag .sub{margin:0 0 12px;font-size:9px;color:var(--geel);text-shadow:0 0 6px var(--geel)}
  .nr .laag p{margin:0 auto 12px;color:var(--zacht);max-width:30ch;font-size:8px;line-height:2}
  .nr .knop{font-family:inherit;font-size:11px;color:#07051a;background:var(--cyaan);border:none;border-radius:0;padding:11px 22px;cursor:pointer;
    box-shadow:0 0 12px rgba(94,231,224,.7),3px 3px 0 #1c9aa2}
  .nr .knop:active{transform:translate(2px,2px)}
  .nr .klein{font-family:inherit;font-size:8px;color:var(--zacht);background:none;border:1px solid var(--rand);border-radius:0;padding:6px 10px;margin:10px 4px 0;cursor:pointer}
  .nr .bord{position:absolute;left:0;right:0;top:36%;text-align:center;pointer-events:none;z-index:3;
    font-size:clamp(13px,5vw,22px);line-height:1.6;color:#fff;letter-spacing:2px;opacity:0;padding:0 8px;
    text-shadow:0 0 3px var(--k),0 0 10px var(--k),0 0 22px var(--k),0 0 40px var(--k)}
  .nr .bord small{display:block;font-size:.5em;letter-spacing:1px}
  .nr .bord.aan{animation:nrBord 2.8s linear forwards}
  .nr .bord.lang{animation:nrBord 3.6s linear forwards}
  .nr .bord.vast{opacity:1}
  @keyframes nrBord{0%{opacity:0}4%{opacity:1}7%{opacity:.15}10%{opacity:1}13%{opacity:.35}16%{opacity:1}80%{opacity:1}100%{opacity:0}}
  .nr .meldbalk{position:absolute;left:7%;right:7%;bottom:16px;z-index:4;pointer-events:none;text-align:center;font-size:9px;line-height:1.6;padding:7px 14px;color:#fff;
    background:linear-gradient(90deg,rgba(20,10,40,.4),rgba(20,10,40,.92) 12%,rgba(20,10,40,.92) 88%,rgba(20,10,40,.4));border-top:2px solid var(--k);border-bottom:2px solid var(--k);
    text-shadow:0 0 6px var(--k);clip-path:polygon(5% 0,95% 0,100% 50%,95% 100%,5% 100%,0 50%);opacity:0;transition:opacity .3s}
  .nr .meldbalk.aan{opacity:1;animation:nrKnipper .6s steps(2) 5}
  @keyframes nrKnipper{50%{opacity:.4}}
  .nr .fout{padding:18px;color:var(--roze);font-size:10px;line-height:2;text-align:center}
  `
  document.head.appendChild(st)
}

/* ---------- kleine hulpjes ---------- */
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
function hexInt(h) { return parseInt(String(h).slice(1), 16) }

/* tekenhulpjes (wereldmaten; de doeken staan op dubbele scherpte, zie R) */
let R = 2, SB = 0.5   // R: beeldpunten per wereldpunt (2 op telefoons, 1 op een gewoon scherm); SB = 1 / R: schaal van elk plaatje
function veelhoek(g, p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath() }
function lijn(g, kleur, dikte, p) { g.strokeStyle = kleur; g.lineWidth = dikte; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke() }
function lin(g, x0, y0, x1, y1, kleuren) { const k = g.createLinearGradient(x0, y0, x1, y1); kleuren.forEach((c, i) => k.addColorStop(i / (kleuren.length - 1), c)); return k }
function rad(g, x, y, r, kleuren) { const k = g.createRadialGradient(x, y, 0, x, y, r); kleuren.forEach((c, i) => k.addColorStop(i / (kleuren.length - 1), c)); return k }
function rondRect(g, x, y, b, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + b, y, x + b, y + h, r); g.arcTo(x + b, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + b, y, r); g.closePath() }
function getal(n) { try { return Number(n).toLocaleString((window.T && window.T.locale) || 'nl-NL') } catch (e) { return String(n) } }

/* iconen voor de tegel, de keuzes en de capsules (7 x 7) */
const ICOON = {
  puls: ['.......', '.#.#.#.', '.#.#.#.', '.#.#.#.', '.......', '.#.#.#.', '.#.#.#.'],
  spreid: ['#..#..#', '.#.#.#.', '..###..', '...#...', '..###..', '.#####.', '.......'],
  straal: ['..###..', '..#w#..', '..#w#..', '..#w#..', '..#w#..', '.#####.', '#######'],
  raket: ['...#...', '..###..', '..#w#..', '..###..', '.#####.', '.#.#.#.', '...#...'],
  bom: ['#..#..#', '.#.#.#.', '..###..', '###w###', '..###..', '.#.#.#.', '#..#..#'],
  schild: ['#######', '#.....#', '#..w..#', '#.www.#', '.#.w.#.', '..#.#..', '...#...'],
  leven: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...', '.......'],
}
const KLEUR = { puls: '#5ee7e0', spreid: '#ff5d9e', straal: '#b6ff3c', raket: '#ffa53c', bom: '#ffe14a', schild: '#7fd4ff', leven: '#ff4f86' }
const WAPENS = ['puls', 'spreid', 'straal', 'raket']
const NAAM = () => ({ puls: vertaal('PULS'), spreid: vertaal('SPREID'), straal: vertaal('STRAAL'), raket: vertaal('RAKET'),
  bom: vertaal('BOM'), schild: vertaal('SCHILD'), leven: vertaal('+1 LEVEN') })

function tekenIcoon(canvas, soort, schaal) {
  const g = canvas.getContext('2d'), s = schaal || 3, rijen = ICOON[soort]
  canvas.width = 7 * s; canvas.height = 7 * s
  g.clearRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const c = rijen[y][x]; if (c === '.') continue
    g.fillStyle = c === 'w' ? '#ffffff' : KLEUR[soort]; g.fillRect(x * s, y * s, s, s)
  }
}

/* ---------- geluid: alles in code (zoals Runner & Gunner) ---------- */
const GELUID = (function () {
  let ctx = null, meester = null, muziekBus = null, aan = true, ruisBuf = null
  let loopt = false, klok = null, stap = 0, volgende = 0, stand = 'level', straal = null
  const laatst = {}
  try { aan = localStorage.getItem('nr-geluid') !== 'uit' } catch (e) {}
  function wek() {
    if (!aan) return
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
        ctx = new AC()
        meester = ctx.createGain(); meester.gain.value = 0.3; meester.connect(ctx.destination)
        muziekBus = ctx.createGain(); muziekBus.gain.value = 0.5; muziekBus.connect(meester)
      }
      if (ctx.state === 'suspended') ctx.resume()
    } catch (e) {}
  }
  function klaar() { return ctx && aan && ctx.state !== 'closed' }
  function toon(f1, f2, duur, vorm, vol, wanneer, uit) {
    if (!klaar()) return
    try {
      const t = wanneer || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
      o.type = vorm || 'square'
      o.frequency.setValueAtTime(f1, t)
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + duur)
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
      o.connect(g); g.connect(uit || meester); o.start(t); o.stop(t + duur + 0.03)
    } catch (e) {}
  }
  function ruis(duur, vol, f1, f2, wanneer) {
    if (!klaar()) return
    try {
      if (!ruisBuf) { ruisBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = ruisBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 }
      const t = wanneer || ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
      s.buffer = ruisBuf; f.type = 'lowpass'
      f.frequency.setValueAtTime(f1 || 2000, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + duur)
      g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
      s.connect(f); f.connect(g); g.connect(meester); s.start(t); s.stop(t + duur + 0.03)
    } catch (e) {}
  }
  const SFX = {
    puls: () => toon(1700, 800, 0.05, 'square', 0.025),
    spreid: () => toon(1100, 420, 0.06, 'sawtooth', 0.022),
    raket: () => { ruis(0.12, 0.06, 3000, 600); toon(260, 620, 0.12, 'triangle', 0.04) },
    raak: () => toon(520, 260, 0.04, 'square', 0.03),
    ketsen: () => toon(2600, 1900, 0.04, 'triangle', 0.025),
    klein: () => { ruis(0.25, 0.22, 2600, 200); toon(180, 45, 0.22, 'square', 0.08) },
    groot: () => { ruis(0.8, 0.42, 1800, 50); toon(90, 28, 0.6, 'sine', 0.35); toon(60, 22, 0.75, 'triangle', 0.22) },
    vijandSchiet: () => toon(900, 600, 0.05, 'triangle', 0.02),
    pak: () => { const t = ctx.currentTime;[660, 880, 1100, 1320].forEach((f, i) => toon(f, 0, 0.08, 'square', 0.06, t + i * 0.05)) },
    leven: () => { const t = ctx.currentTime;[523, 659, 784, 1047, 1319].forEach((f, i) => toon(f, 0, 0.12, 'square', 0.07, t + i * 0.07)) },
    bom: () => { ruis(1.2, 0.5, 4000, 60); toon(140, 30, 1.0, 'sawtooth', 0.25); toon(70, 20, 1.1, 'sine', 0.4) },
    schild: () => { toon(300, 1200, 0.35, 'triangle', 0.1); toon(450, 1800, 0.35, 'sine', 0.05) },
    pijn: () => { toon(440, 80, 0.45, 'sawtooth', 0.16); ruis(0.6, 0.35, 2000, 80) },
    tel: () => toon(440, 0, 0.12, 'square', 0.1),
    go: () => { toon(880, 0, 0.3, 'square', 0.12); toon(1320, 0, 0.3, 'triangle', 0.06) },
    alarm: () => { const t = ctx.currentTime; for (let i = 0; i < 6; i++) toon(i % 2 ? 660 : 880, 0, 0.22, 'square', 0.1, t + i * 0.25) },
    richt: () => toon(180, 520, 0.9, 'sine', 0.06),
    laser: () => { ruis(1.3, 0.18, 1400, 300); toon(120, 90, 1.3, 'sawtooth', 0.1) },
    wissel: () => toon(1200, 1600, 0.06, 'square', 0.04),
    klaar: () => { const t = ctx.currentTime;[0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => toon(262 * Math.pow(2, n / 12), 0, 0.16, 'square', 0.08, t + i * 0.11)) },
    einde: () => { const t = ctx.currentTime;[7, 4, 0, -5].forEach((n, i) => toon(220 * Math.pow(2, n / 12), 0, 0.3, 'square', 0.09, t + i * 0.22)) },
  }
  const PAUZE = { puls: 60, spreid: 60, raak: 45, ketsen: 60, vijandSchiet: 70, klein: 40 }
  /* muziek: voortstuwende bas, arpeggio en een simpele drum; de eindbaas krijgt een snellere variant */
  const LIED = {
    level: { tempo: 148, bas: [0, 0, -4, -2], arp: [0, 7, 12, 7, 15, 12, 7, 3] },
    baas: { tempo: 168, bas: [0, 1, 0, -2], arp: [0, 3, 6, 12, 6, 3, 13, 12] },
  }
  function noot(n) { return 110 * Math.pow(2, n / 12) }
  function plan() {
    if (!loopt || !klaar()) return
    const L = LIED[stand], achtste = 60 / L.tempo / 2
    while (volgende < ctx.currentTime + 0.25) {
      const i = stap % 8, maat = Math.floor(stap / 8) % 4, b = L.bas[maat]
      toon(noot(b - 12), 0, achtste * 0.9, 'sawtooth', i % 2 ? 0.05 : 0.08, volgende, muziekBus)
      toon(noot(L.arp[i] + b + 12), 0, achtste * 0.7, 'square', 0.022, volgende, muziekBus)
      if (i % 4 === 0) toon(150, 40, 0.12, 'sine', 0.22, volgende, muziekBus)          // trommel
      if (i % 4 === 2) ruis(0.06, 0.06, 6000, 2000, volgende)                          // snare
      volgende += achtste; stap++
    }
  }
  return {
    wek,
    speel(n) {
      try {
        if (!SFX[n] || !klaar()) return
        const nu = ctx.currentTime * 1000
        if (PAUZE[n] && nu - (laatst[n] || -1e9) < PAUZE[n]) return
        laatst[n] = nu; SFX[n]()
      } catch (e) {}
    },
    muziek(start, soort) {
      if (soort) stand = soort
      if (start) { if (loopt) return; wek(); if (!klaar()) return; loopt = true; volgende = ctx.currentTime + 0.05; stap = 0; klok = setInterval(plan, 60) }
      else { loopt = false; if (klok) clearInterval(klok); klok = null }
    },
    straal(aanZet) {                               // brom van de straal zolang hij aan staat
      if (!klaar()) { straal = null; return }
      try {
        if (aanZet && !straal) {
          const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain()
          o.type = 'sawtooth'; o.frequency.value = 96; o2.type = 'square'; o2.frequency.value = 193
          g.gain.value = 0.035; o.connect(g); o2.connect(g); g.connect(meester); o.start(); o2.start()
          straal = { o, o2, g }
        } else if (!aanZet && straal) {
          const s = straal; straal = null
          s.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); s.o.stop(ctx.currentTime + 0.15); s.o2.stop(ctx.currentTime + 0.15)
        }
      } catch (e) { straal = null }
    },
    staatAan() { return aan },
    zet(v) {
      aan = !!v; try { localStorage.setItem('nr-geluid', aan ? 'aan' : 'uit') } catch (e) {}
      if (!aan) { this.muziek(false); this.straal(false) } else wek()
      if (meester) try { meester.gain.value = aan ? 0.3 : 0 } catch (e) {}
    },
    stop() { this.muziek(false); this.straal(false); try { if (ctx && ctx.state === 'running') ctx.suspend() } catch (e) {} },
  }
})()

/* ---------- level 1: de golven ----------
   t = seconden na de start. Alles komt uit een vaste toevalsreeks, dus elke keer (en straks bij allebei) gelijk. */
function golvenLevel1(r) {
  const g = []
  const op = (t, f) => g.push({ t, f })
  const lijn = (t, n, x, soort) => { for (let i = 0; i < n; i++) op(t + i * 0.28, s => s.maak(soort || 'dart', { x, fase: i * 0.7 })) }
  const zwaai = (t, n, kant) => { for (let i = 0; i < n; i++) op(t + i * 0.3, s => s.maak('zwaai', { kant, y: 70 + i * 10 })) }
  const vorm = (t, n) => { for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; op(t + Math.abs(k) * 0.22, s => s.maak('dart', { x: 180 + k * 34, fase: 0, recht: true })) } }
  const tanks = (t, n) => { for (let i = 0; i < n; i++) { const x = 40 + Math.floor(r() * 280); op(t + i * 0.9, s => s.maak('tank', { x })) } }
  const schutters = (t, n) => { for (let i = 0; i < n; i++) { const x = 60 + (i + 0.5) * (240 / n); op(t + i * 0.4, s => s.maak('schutter', { x, doelY: 110 + (i % 2) * 50 })) } }
  const regen = (t, n) => { for (let i = 0; i < n; i++) { const x = 24 + Math.floor(r() * 312); op(t + i * 0.18, s => s.maak('dart', { x, fase: r() * 6, recht: true, snel: 1.35 })) } }
  op(0.5, s => s.toonBord('LEVEL 1', vertaal('AARDE'), '#5ee7e0'))
  lijn(4, 5, 180); lijn(7, 5, 90); lijn(9.5, 5, 270)
  zwaai(12, 4, -1); zwaai(14.5, 4, 1)
  op(17, s => s.maak('drager', { x: 120, buit: 'spreid' }))
  tanks(18, 2); schutters(21, 2); vorm(25, 7)
  zwaai(28, 3, -1); zwaai(28.4, 3, 1); tanks(31, 3)
  op(34, s => s.maak('drager', { x: 250, buit: 'raket' }))
  schutters(36, 3); lijn(37, 6, 60); lijn(38, 6, 300)
  op(41, s => s.maak('kolos', { x: 180 }))
  lijn(46, 6, 120); lijn(47.5, 6, 240)
  op(50, s => s.maak('drager', { x: 180, buit: 'bom' }))
  tanks(52, 4); zwaai(53, 4, -1); schutters(57, 2); vorm(58, 9)
  op(62, s => s.maak('drager', { x: 90, buit: 'straal' }))
  zwaai(64, 4, -1); zwaai(64.6, 4, 1)
  op(68, s => s.maak('kolos', { x: 110 })); tanks(69, 2)
  regen(75, 14)
  op(80, s => s.maak('drager', { x: 270, buit: 'schild' }))
  schutters(82, 4); zwaai(88, 4, 1); zwaai(88.5, 4, -1); tanks(89, 3)
  op(94, s => s.maak('kolos', { x: 100 })); op(95.5, s => s.maak('kolos', { x: 260 }))
  op(100, s => s.maak('drager', { x: 180, buit: 'leven' }))
  regen(103, 18)
  op(109, s => s.startBaas())
  return g.sort((a, b) => a.t - b.t)
}

/* soorten vijanden: levens, raakstraal (r), punten */
const SOORT = {
  dart: { hp: 1, r: 10, punten: 100, kleur: ['#ff4848', '#ffd23c', '#ffffff'] },
  zwaai: { hp: 2, r: 11, punten: 150, kleur: ['#ff3dd2', '#b6ff3c', '#ffffff'] },
  schutter: { hp: 8, r: 15, punten: 500, kleur: ['#4aa3ff', '#ffffff', '#ffd23c'] },
  tank: { hp: 6, r: 13, punten: 400, kleur: ['#b6ff3c', '#ffd23c', '#ffffff'], grond: true },
  kolos: { hp: 45, r: 27, punten: 2000, kleur: ['#ff3dd2', '#ffd23c', '#ffffff', '#ff4848'] },
  drager: { hp: 5, r: 12, punten: 300, kleur: ['#ffd23c', '#ffffff'] },
}

/* ---------- het spel ---------- */
export async function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief, solo }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (!inhoud) return
  if (typeof isActief !== 'function') isActief = () => true
  if (titel) titel.textContent = '🚀 Neon Raiders'
  if (getComputedStyle(inhoud).position === 'static') inhoud.style.position = 'relative'
  zetStijl()

  let autovuur = false
  try { autovuur = localStorage.getItem('nr-autovuur') === 'aan' } catch (e) {}
  const wrap = document.createElement('div')
  wrap.className = 'nr'
  wrap.innerHTML = `
    <div class="veld">
      <button type="button" class="tegel" aria-label="${vertaal('Wapen wisselen of power-up gebruiken')}" aria-expanded="false">
        <canvas class="tIcoon"></canvas><span class="stip"><i></i><i></i><i></i></span><span class="extra"></span>
      </button>
      <div class="arsenaal" hidden></div>
      <div class="hud" aria-hidden="true"><div class="scoreRij"><span class="p1">P1</span><span class="score">0000000</span></div><div class="combo"></div><div class="levens"></div></div>
      <div class="meldbalk" aria-live="polite"></div><span class="hoek l"></span><span class="hoek r"></span>
      <div class="baas" hidden aria-hidden="true"><span class="baasNaam">TITAN</span><div class="balk"><i></i></div></div>
      <div class="bord" aria-live="polite"></div>
      <div class="laag">
        <div>
          <h1>NEON<span>RAIDERS</span></h1>
          <div class="sub">${vertaal('LEVEL 1 · AARDE')}</div>
          <p class="uitleg">${vertaal('Sleep met één vinger om te vliegen. Tik of houd een tweede vinger op het scherm om te schieten.')}</p>
          <p class="uitleg2">${vertaal('De tegel linksboven: wapen wisselen of een power-up gebruiken.')}</p>
          <p class="record"></p>
          <button type="button" class="knop">START</button>
          <div><button type="button" class="klein autoKnop">${autovuur ? vertaal('AUTOVUUR: AAN') : vertaal('AUTOVUUR: UIT')}</button><button type="button" class="klein geluidKnop">${GELUID.staatAan() ? vertaal('GELUID: AAN') : vertaal('GELUID: UIT')}</button></div>
        </div>
      </div>
    </div>`
  inhoud.appendChild(wrap)

  const veld = wrap.querySelector('.veld')
  const laag = wrap.querySelector('.laag')
  const h1 = laag.querySelector('h1')
  const sub = laag.querySelector('.sub')
  const uitleg = laag.querySelector('.uitleg')
  const uitleg2 = laag.querySelector('.uitleg2')
  const recordVak = laag.querySelector('.record')
  const startKnop = laag.querySelector('.knop')
  const autoKnop = laag.querySelector('.autoKnop')
  const geluidKnop = laag.querySelector('.geluidKnop')
  const tegel = wrap.querySelector('.tegel')
  const tegelIcoon = tegel.querySelector('.tIcoon')
  const tegelStip = tegel.querySelectorAll('.stip i')
  const tegelExtra = tegel.querySelector('.extra')
  const arsenaal = wrap.querySelector('.arsenaal')
  const scoreVak = wrap.querySelector('.score')
  const comboVak = wrap.querySelector('.combo')
  const levensVak = wrap.querySelector('.levens')
  const baasVak = wrap.querySelector('.baas')
  const baasBalk = baasVak.querySelector('.balk i')
  const bordVak = wrap.querySelector('.bord')
  const balkVak = wrap.querySelector('.meldbalk')

  try { await laadPhaser() } catch (e) {
    wrap.innerHTML = '<p class="fout">' + vertaal('Het spel kon niet laden.<br>Controleer je verbinding en probeer opnieuw.') + '</p>'
    return
  }
  if (!isActief() || !wrap.isConnected) { wrap.remove(); return }
  const Phaser = window.Phaser

  let W = 360, H = 640
  let spel = null, huidige = null

  /* ---------- indeling: een staand veld dat in de ruimte past ---------- */
  function indeling() {
    const volB = wrap.clientWidth - 16, volH = wrap.clientHeight - 60
    let vh = volH, vb = Math.min(volB, Math.round(vh * 0.5625))
    if (vb < vh * 0.45) vh = Math.round(vb / 0.45)
    vb = Math.max(160, vb); vh = Math.max(280, vh)
    veld.style.width = vb + 'px'
    veld.style.height = vh + 'px'
  }
  indeling()
  window.addEventListener('resize', indeling)
  window.addEventListener('orientationchange', indeling)

  function tekenLevens(n) {
    const schip = '<svg viewBox="0 0 12 14"><path fill="#5ee7e0" d="M6 0L7.6 4 7.8 8 12 11 12 12.5 7.8 11.5 7 14H5L4.2 11.5 0 12.5V11L4.2 8 4.4 4Z"/></svg>'
    let uit = ''
    for (let i = 0; i < Math.max(0, Math.min(n, 6)); i++) uit += schip
    levensVak.innerHTML = uit
  }

  /* ---------- bediening: vinger, muis, toetsen ---------- */
  const vingers = new Map()   // pointerId -> { rol: 'stuur' | 'vuur', x, y }
  let toets = { l: 0, r: 0, o: 0, n: 0, vuur: 0 }
  function stuurVinger() { for (const [id, v] of vingers) if (v.rol === 'stuur') return id; return null }
  function schaal() { return W / Math.max(1, veld.clientWidth) }
  veld.addEventListener('pointerdown', e => {
    if (e.target.closest('.tegel,.arsenaal,.laag')) return
    e.preventDefault()
    GELUID.wek()
    try { veld.setPointerCapture(e.pointerId) } catch (x) {}
    const muis = e.pointerType === 'mouse'
    const rol = (stuurVinger() === null) ? 'stuur' : 'vuur'
    vingers.set(e.pointerId, { rol, x: e.clientX, y: e.clientY, muis })
    if (huidige && huidige.pauze) huidige.hervat()
  })
  veld.addEventListener('pointermove', e => {
    const v = vingers.get(e.pointerId); if (!v) return
    if (v.rol === 'stuur' && huidige) huidige.duw((e.clientX - v.x) * schaal() * 1.15, (e.clientY - v.y) * schaal() * 1.15)
    v.x = e.clientX; v.y = e.clientY
  })
  const los = e => { vingers.delete(e.pointerId) }
  veld.addEventListener('pointerup', los)
  veld.addEventListener('pointercancel', los)
  /* iOS: geen zoom of tekstselectie bij dubbeltikken in het veld */
  const stopTouch = e => { if (e.target.closest('.laag button')) return; e.preventDefault() }
  veld.addEventListener('touchstart', stopTouch, { passive: false })
  veld.addEventListener('touchend', stopTouch, { passive: false })
  function vuurtNu() {
    if (autovuur || toets.vuur) return true
    for (const v of vingers.values()) if (v.rol === 'vuur' || v.muis) return true
    return false
  }
  const TOETS = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'o', KeyW: 'o', ArrowDown: 'n', KeyS: 'n', Space: 'vuur', KeyJ: 'vuur' }
  function toetsNeer(e) {
    if (!isActief() || !wrap.isConnected) return
    GELUID.wek()
    if (TOETS[e.code]) { toets[TOETS[e.code]] = 1; if (laag.hidden) e.preventDefault() }
    if (e.code === 'KeyQ' || e.code === 'Tab') { e.preventDefault(); if (laag.hidden) wisselArsenaal() }
    if (/^Digit[1-6]$/.test(e.code) && !arsenaal.hidden) { const k = arsenaal.querySelectorAll('button')[+e.code.slice(5) - 1]; if (k && !k.disabled) k.click() }
    if (e.code === 'Escape' && !arsenaal.hidden) sluitArsenaal()
  }
  function toetsOp(e) { if (TOETS[e.code]) toets[TOETS[e.code]] = 0 }
  window.addEventListener('keydown', toetsNeer)
  window.addEventListener('keyup', toetsOp)

  /* ---------- de tegel en het arsenaal ---------- */
  let arsenaalKlok = null
  function werkTegelBij() {
    const s = huidige
    const wapen = s ? s.wapen : 'puls', niv = s ? s.niveau[wapen] || 1 : 1
    tekenIcoon(tegelIcoon, wapen, 4)
    tegelStip.forEach((el, i) => el.classList.toggle('aan', i < niv))
    const extra = s ? (s.voorraad.bom || 0) + (s.voorraad.schild || 0) : 0
    tegelExtra.textContent = extra ? '+' + extra : ''
    tegel.style.borderColor = KLEUR[wapen]
  }
  function bouwArsenaal() {
    const s = huidige; if (!s) return
    const namen = NAAM()
    arsenaal.innerHTML = ''
    const knop = (soort, n, actief, nu) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.soort = soort
      const c = document.createElement('canvas'); tekenIcoon(c, soort, 3); b.appendChild(c)
      const t = document.createElement('span'); t.textContent = namen[soort]; b.appendChild(t)
      if (n != null) { const m = document.createElement('span'); m.className = 'n'; m.textContent = n; b.appendChild(m) }
      if (nu) b.classList.add('nu')
      b.disabled = !actief
      b.setAttribute('aria-label', namen[soort] + (n != null ? ' ' + n : ''))
      // kiezen bij loslaten (pointerup): het veld houdt de touch-klik tegen (geen zoom op iOS), dus click komt niet altijd
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); b._neer = e.pointerId })
      b.addEventListener('pointerup', e => { e.stopPropagation(); if (b._neer !== e.pointerId || b.disabled) return; b._neer = null; kiesUitArsenaal(soort) })
      b.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0 && !b.disabled) kiesUitArsenaal(soort) })   // toetsenbord
      arsenaal.appendChild(b)
    }
    WAPENS.forEach(w => { if (s.niveau[w]) knop(w, null, true, w === s.wapen) })
    knop('bom', s.voorraad.bom || 0, (s.voorraad.bom || 0) > 0)
    knop('schild', s.voorraad.schild || 0, (s.voorraad.schild || 0) > 0 && !(s.schild > 0))
  }
  function openArsenaal() {
    if (!huidige || huidige.voorbij || huidige.pauze) return
    bouwArsenaal()
    arsenaal.hidden = false; tegel.classList.add('open'); tegel.setAttribute('aria-expanded', 'true')
    huidige.tijdSchaal = 0.3
    GELUID.speel('wissel')
    clearTimeout(arsenaalKlok); arsenaalKlok = setTimeout(sluitArsenaal, 3200)
  }
  function sluitArsenaal() {
    clearTimeout(arsenaalKlok)
    arsenaal.hidden = true; tegel.classList.remove('open'); tegel.setAttribute('aria-expanded', 'false')
    if (huidige) huidige.tijdSchaal = 1
  }
  function wisselArsenaal() { if (arsenaal.hidden) openArsenaal(); else sluitArsenaal() }
  function kiesUitArsenaal(soort) {
    const s = huidige; if (!s) return
    if (WAPENS.includes(soort)) { if (s.niveau[soort]) { s.wapen = soort; GELUID.speel('wissel') } }
    else if (soort === 'bom') s.gebruikBom()
    else if (soort === 'schild') s.gebruikSchild()
    sluitArsenaal(); werkTegelBij()
  }
  tegel.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); GELUID.wek(); if (laag.hidden) wisselArsenaal() })
  tegel.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0 && laag.hidden) wisselArsenaal() })  // toetsenbord (Enter)

  /* ---------- neonbord ---------- */
  function bord(tekst, klein, kleur, lang) {
    bordVak.innerHTML = ''
    bordVak.appendChild(document.createTextNode(tekst))
    if (klein) { const s = document.createElement('small'); s.textContent = klein; bordVak.appendChild(s) }
    bordVak.style.setProperty('--k', kleur || '#5ee7e0')
    bordVak.className = 'bord'; void bordVak.offsetWidth; bordVak.className = 'bord ' + (lang ? 'lang' : 'aan')
  }

  /* balk onderaan (zoals 'eindbaas nadert') */
  let balkKlok = null
  function balk(tekst, kleur, ms) {
    balkVak.textContent = tekst
    balkVak.style.setProperty('--k', kleur || '#ff4848')
    balkVak.classList.remove('aan'); void balkVak.offsetWidth; balkVak.classList.add('aan')
    clearTimeout(balkKlok); balkKlok = setTimeout(() => balkVak.classList.remove('aan'), ms || 3500)
  }

  /* ================= de Phaser-scène ================= */
  class Spel extends Phaser.Scene {
    constructor() { super({ key: 'spel' }) }

    /* ---- texturen: alles in code getekend, in wereldmaten en op dubbele scherpte (R) ----
       Een plaatje is dus scherp op de telefoon, en het spel blijft klein: geen enkel plaatjesbestand. */
    teken(key, b, h, f, gloed, sterkte) {
      const pad = gloed ? 6 : 0
      const c = document.createElement('canvas'); c.width = Math.ceil((b + pad * 2) * R); c.height = Math.ceil((h + pad * 2) * R)
      const g = c.getContext('2d')
      if (gloed) {
        const o = document.createElement('canvas'); o.width = Math.ceil(b * R); o.height = Math.ceil(h * R)
        const og = o.getContext('2d'); og.scale(R, R); f(og, b, h)
        g.shadowColor = gloed; g.shadowBlur = (sterkte || 7) * R; g.drawImage(o, pad * R, pad * R)
        g.shadowBlur = 0; g.drawImage(o, pad * R, pad * R)
      } else { g.scale(R, R); f(g, b, h) }
      if (this.textures.exists(key)) this.textures.remove(key)
      this.textures.addCanvas(key, c)
    }
    maakTexturen() {
      /* het schip van de speler: metalen romp, cyaan cockpit, twee motoren */
      this.teken('schip', 36, 44, g => {
        g.fillStyle = lin(g, 0, 16, 0, 36, ['#6b778b', '#3a4354'])
        veelhoek(g, [14, 15, 2, 30, 1, 35, 6, 36, 14, 32]); g.fill()
        veelhoek(g, [22, 15, 34, 30, 35, 35, 30, 36, 22, 32]); g.fill()
        lijn(g, '#a8b6ca', 0.7, [14, 15, 2, 30]); lijn(g, '#a8b6ca', 0.7, [22, 15, 34, 30])
        g.fillStyle = '#ff5d9e'; veelhoek(g, [4, 31, 7, 28, 8, 30, 5, 33]); g.fill(); veelhoek(g, [32, 31, 29, 28, 28, 30, 31, 33]); g.fill()
        g.fillStyle = '#5ee7e0'; veelhoek(g, [9, 27, 13, 22, 13, 24, 10, 28]); g.fill(); veelhoek(g, [27, 27, 23, 22, 23, 24, 26, 28]); g.fill()
        g.fillStyle = lin(g, 8, 0, 15, 0, ['#2a303c', '#5e6a7e', '#2a303c']); rondRect(g, 8.5, 25, 6, 16, 2); g.fill()
        g.fillStyle = lin(g, 21, 0, 28, 0, ['#2a303c', '#5e6a7e', '#2a303c']); rondRect(g, 21.5, 25, 6, 16, 2); g.fill()
        g.fillStyle = '#12151c'; g.fillRect(9.5, 40, 4, 2.5); g.fillRect(22.5, 40, 4, 2.5)
        g.fillStyle = lin(g, 12, 0, 24, 0, ['#5d6878', '#e8eef5', '#c3cdd9', '#4b5566'])
        veelhoek(g, [18, 0, 21.5, 9, 23, 20, 23, 33, 21, 41, 15, 41, 13, 33, 13, 20, 14.5, 9]); g.fill()
        lijn(g, 'rgba(25,32,45,.75)', 0.5, [13.5, 22, 22.5, 22]); lijn(g, 'rgba(25,32,45,.75)', 0.5, [13.3, 30, 22.7, 30]); lijn(g, 'rgba(25,32,45,.6)', 0.5, [18, 24, 18, 40])
        g.fillStyle = rad(g, 17.2, 11, 6, ['#ffffff', '#8ff6ff', '#1aa7b8', '#0b3c48']); g.beginPath(); g.ellipse(18, 12, 2.7, 5.6, 0, 0, 7); g.fill()
        g.fillStyle = '#5ee7e0'; g.fillRect(17.3, 31, 1.4, 7)
      }, '#5ee7e0', 5)
      /* blauwe motorvlammen (twee standen, om en om) */
      for (const [key, L] of [['vlam0', 10], ['vlam1', 15]]) {
        this.teken(key, 36, 16, g => {
          for (const x of [11.5, 24.5]) {
            g.fillStyle = lin(g, 0, 0, 0, L, ['rgba(255,255,255,1)', 'rgba(150,240,255,.95)', 'rgba(70,150,255,.55)', 'rgba(60,90,255,0)'])
            g.beginPath(); g.ellipse(x, 0, 2.6, L, 0, 0, Math.PI); g.fill()
          }
        }, '#4ab8ff', 4)
      }
      /* vijanden: rode alienjagers, paarse vleermuizen, grijze kanonneerboten, zware kruisers */
      this.teken('dart', 26, 28, g => {
        g.fillStyle = lin(g, 0, 0, 0, 28, ['#3b0a18', '#7a1028'])
        veelhoek(g, [0, 4, 9, 2, 13, 6, 17, 2, 26, 4, 22, 12, 13, 28, 4, 12]); g.fill()
        g.fillStyle = lin(g, 6, 0, 20, 0, ['#8a1430', '#ff4d6d', '#c0283c'])
        veelhoek(g, [13, 4, 18, 10, 16, 20, 13, 27, 10, 20, 8, 10]); g.fill()
        lijn(g, '#ff9ab0', 0.6, [0, 4, 4, 12, 13, 28, 22, 12, 26, 4])
        g.fillStyle = rad(g, 13, 15, 3.6, ['#ffffff', '#ffd23c', 'rgba(255,140,30,0)']); g.beginPath(); g.arc(13, 15, 3.6, 0, 7); g.fill()
        g.fillStyle = '#ff3dd2'; g.fillRect(4, 2.5, 3, 1.5); g.fillRect(19, 2.5, 3, 1.5)
      }, '#ff3d6d', 5)
      this.teken('zwaai', 32, 26, g => {
        g.fillStyle = lin(g, 0, 0, 0, 26, ['#5a1a8a', '#2a0b45'])
        g.beginPath(); g.moveTo(16, 6); g.quadraticCurveTo(8, 0, 0, 4); g.lineTo(5, 10); g.lineTo(2, 16); g.lineTo(9, 15); g.lineTo(16, 26)
        g.lineTo(23, 15); g.lineTo(30, 16); g.lineTo(27, 10); g.lineTo(32, 4); g.quadraticCurveTo(24, 0, 16, 6); g.closePath(); g.fill()
        lijn(g, '#d07bff', 0.7, [0, 4, 5, 10, 2, 16, 9, 15, 16, 26, 23, 15, 30, 16, 27, 10, 32, 4])
        g.fillStyle = lin(g, 12, 0, 20, 0, ['#7d2bb8', '#c56bff', '#7d2bb8']); veelhoek(g, [16, 6, 20, 12, 16, 22, 12, 12]); g.fill()
        g.fillStyle = rad(g, 16, 13, 3.4, ['#ffffff', '#b6ff3c', 'rgba(80,160,20,0)']); g.beginPath(); g.arc(16, 13, 3.4, 0, 7); g.fill()
      }, '#b13cff', 5)
      this.teken('schutter', 38, 36, g => {
        g.fillStyle = '#1b2029'; rondRect(g, 2, 14, 6, 20, 2); g.fill(); rondRect(g, 30, 14, 6, 20, 2); g.fill()
        g.fillStyle = '#ffa53c'; g.fillRect(3.5, 32, 3, 3); g.fillRect(31.5, 32, 3, 3)
        g.fillStyle = lin(g, 0, 0, 38, 0, ['#262c38', '#6a7488', '#3a4252', '#262c38'])
        veelhoek(g, [10, 2, 28, 2, 34, 12, 31, 26, 22, 35, 16, 35, 7, 26, 4, 12]); g.fill()
        lijn(g, '#8f9bb0', 0.6, [10, 2, 4, 12, 7, 26, 16, 35]); lijn(g, '#59647a', 0.6, [28, 2, 34, 12, 31, 26, 22, 35])
        lijn(g, 'rgba(15,18,26,.8)', 0.6, [6, 14, 32, 14]); lijn(g, 'rgba(15,18,26,.8)', 0.6, [8, 24, 30, 24])
        g.fillStyle = '#ff4848'; g.fillRect(8, 16.5, 7, 1.4); g.fillRect(23, 16.5, 7, 1.4)
        g.fillStyle = rad(g, 19, 22, 5, ['#ffffff', '#ff6b6b', '#7a0f1a']); veelhoek(g, [14, 19, 24, 19, 22, 26, 16, 26]); g.fill()
        g.fillStyle = '#4aa3ff'; g.fillRect(12, 0, 4, 2.5); g.fillRect(22, 0, 4, 2.5)
      }, '#4aa3ff', 5)
      this.teken('kolos', 66, 60, g => {
        g.fillStyle = lin(g, 0, 0, 0, 60, ['#3a4252', '#1a1e27']); rondRect(g, 0, 14, 14, 36, 4); g.fill(); rondRect(g, 52, 14, 14, 36, 4); g.fill()
        g.fillStyle = lin(g, 0, 0, 66, 0, ['#1c2029', '#555f72', '#3b4352', '#1c2029'])
        veelhoek(g, [20, 0, 46, 0, 56, 12, 54, 40, 42, 58, 24, 58, 12, 40, 10, 12]); g.fill()
        lijn(g, '#8590a6', 0.7, [20, 0, 10, 12, 12, 40, 24, 58]); lijn(g, '#4b5466', 0.7, [46, 0, 56, 12, 54, 40, 42, 58])
        g.fillStyle = '#2a303c'; veelhoek(g, [24, 5, 42, 5, 48, 15, 18, 15]); g.fill()
        lijn(g, 'rgba(10,12,18,.8)', 0.6, [14, 26, 52, 26]); lijn(g, 'rgba(10,12,18,.8)', 0.6, [18, 44, 48, 44])
        g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 4 * R; g.fillStyle = '#ffa53c'
        for (let i = 0; i < 4; i++) { g.fillRect(3, 20 + i * 6, 8, 1.6); g.fillRect(55, 20 + i * 6, 8, 1.6) }
        g.restore()
        g.fillStyle = rad(g, 33, 31, 8, ['#ffffff', '#ff7ae0', '#ff3dd2', '#4a0a40']); g.beginPath(); g.arc(33, 31, 7.5, 0, 7); g.fill()
        g.strokeStyle = '#ffd23c'; g.lineWidth = 1; g.beginPath(); g.arc(33, 31, 9.5, 0, 7); g.stroke()
        g.fillStyle = '#14171e'; g.fillRect(25, 50, 4, 10); g.fillRect(37, 50, 4, 10)
        g.fillStyle = '#ffa53c'; g.fillRect(25, 58, 4, 2); g.fillRect(37, 58, 4, 2)
      }, '#ff3dd2', 4)
      this.teken('drager', 26, 32, g => {
        g.fillStyle = '#4a3c12'; veelhoek(g, [2, 10, 6, 4, 6, 26, 2, 22]); g.fill(); veelhoek(g, [24, 10, 20, 4, 20, 26, 24, 22]); g.fill()
        g.fillStyle = lin(g, 4, 0, 22, 0, ['#a8780e', '#ffe28a', '#ffd23c', '#8a5d08']); rondRect(g, 5, 1, 16, 30, 7); g.fill()
        g.fillStyle = '#2b2208'; g.fillRect(5, 9, 16, 2); g.fillRect(5, 21, 16, 2)
        g.fillStyle = rad(g, 13, 16, 5, ['#ffffff', '#fff3b0', 'rgba(255,210,60,0)']); g.beginPath(); g.arc(13, 16, 4.5, 0, 7); g.fill()
        g.fillStyle = '#ff4848'; g.beginPath(); g.arc(13, 4, 1.3, 0, 7); g.fill()
      }, '#ffd23c', 6)
      /* tank op de grond (van boven gezien); de loop draait los */
      this.teken('tank', 30, 30, g => {
        g.fillStyle = '#16120e'; rondRect(g, 1, 2, 7, 26, 2); g.fill(); rondRect(g, 22, 2, 7, 26, 2); g.fill()
        g.fillStyle = '#4a4036'; for (let y = 4; y < 27; y += 3) { g.fillRect(1.5, y, 6, 1); g.fillRect(22.5, y, 6, 1) }
        g.fillStyle = lin(g, 0, 0, 0, 30, ['#4f5c38', '#2c3520']); rondRect(g, 6, 4, 18, 22, 3); g.fill()
        g.strokeStyle = '#b6ff3c'; g.lineWidth = 0.8; rondRect(g, 6.5, 4.5, 17, 21, 3); g.stroke()
        g.fillStyle = '#b6ff3c'; g.fillRect(8, 6, 2, 2); g.fillRect(20, 6, 2, 2)
      }, '#b6ff3c', 3)
      this.teken('loop', 14, 26, g => {
        g.fillStyle = '#20281a'; g.fillRect(5.5, 0, 3, 18)
        g.fillStyle = '#b6ff3c'; g.fillRect(5.5, 0, 3, 2)
        g.fillStyle = rad(g, 6, 17, 7, ['#9ab06a', '#4f5c38', '#1e2614']); g.beginPath(); g.arc(7, 19, 6, 0, 7); g.fill()
        g.strokeStyle = '#b6ff3c'; g.lineWidth = 0.7; g.beginPath(); g.arc(7, 19, 6, 0, 7); g.stroke()
      }, '#b6ff3c', 3)
      /* kogels en effecten */
      this.teken('puls', 4, 22, g => { g.fillStyle = lin(g, 0, 0, 0, 22, ['#ffffff', '#b8fdff', '#5ee7e0', 'rgba(94,231,224,0)']); rondRect(g, 0.4, 0, 3.2, 22, 1.6); g.fill() }, '#5ee7e0', 4)
      this.teken('spreidKogel', 10, 14, g => { g.fillStyle = '#ff5d9e'; veelhoek(g, [5, 0, 10, 7, 5, 14, 0, 7]); g.fill(); g.fillStyle = '#ffffff'; veelhoek(g, [5, 3, 7, 7, 5, 11, 3, 7]); g.fill() }, '#ff5d9e', 5)
      this.teken('raketKogel', 6, 16, g => {
        g.fillStyle = lin(g, 0, 0, 6, 0, ['#7d8a9c', '#e8eef5', '#7d8a9c']); rondRect(g, 1.5, 2, 3, 11, 1.2); g.fill()
        g.fillStyle = '#ff4848'; veelhoek(g, [1.5, 3, 3, 0, 4.5, 3]); g.fill()
        g.fillStyle = '#596579'; veelhoek(g, [0, 13, 1.5, 9, 1.5, 13]); g.fill(); veelhoek(g, [6, 13, 4.5, 9, 4.5, 13]); g.fill()
        g.fillStyle = '#ffd23c'; g.fillRect(2, 13, 2, 3)
      }, '#ffa53c', 3)
      this.teken('orb', 12, 12, g => { g.fillStyle = rad(g, 6, 6, 6, ['#ffffff', '#ffc2ee', '#ff3dd2', 'rgba(255,61,210,0)']); g.fillRect(0, 0, 12, 12) })
      this.teken('orbO', 12, 12, g => { g.fillStyle = rad(g, 6, 6, 6, ['#ffffff', '#ffe0a0', '#ff8a1a', 'rgba(255,138,26,0)']); g.fillRect(0, 0, 12, 12) })
      this.teken('naald', 4, 16, g => { g.fillStyle = lin(g, 0, 0, 0, 16, ['rgba(255,72,72,0)', '#ff4848', '#ffd0d0', '#ffffff']); rondRect(g, 0.5, 0, 3, 16, 1.5); g.fill() }, '#ff4848', 4)
      this.teken('vonk', 3, 3, g => { g.fillStyle = rad(g, 1.5, 1.5, 1.5, ['#ffffff', '#ffffff', 'rgba(255,255,255,0)']); g.fillRect(0, 0, 3, 3) })
      this.teken('flits', 64, 64, g => { g.fillStyle = rad(g, 32, 32, 32, ['rgba(255,255,255,1)', 'rgba(255,255,255,.55)', 'rgba(255,255,255,0)']); g.fillRect(0, 0, 64, 64) })
      this.teken('schildBel', 56, 56, g => {
        g.strokeStyle = '#7fd4ff'; g.lineWidth = 2; g.beginPath(); g.arc(28, 28, 24, 0, 7); g.stroke()
        g.globalAlpha = 0.15; g.fillStyle = '#7fd4ff'; g.beginPath(); g.arc(28, 28, 24, 0, 7); g.fill()
        g.globalAlpha = 0.35; g.lineWidth = 0.6
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; lijn(g, '#bfeaff', 0.6, [28 + Math.cos(a) * 12, 28 + Math.sin(a) * 12, 28 + Math.cos(a) * 24, 28 + Math.sin(a) * 24]) }
        g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.fillRect(14, 12, 6, 2)
      }, '#7fd4ff', 6)
      /* capsules met power-ups: een zeshoekig metalen kader met het neonicoon */
      for (const soort of Object.keys(ICOON)) {
        this.teken('cap_' + soort, 28, 28, g => {
          const zes = r => { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; p.push(14 + Math.cos(a) * r, 14 + Math.sin(a) * r) } return p }
          g.fillStyle = lin(g, 0, 0, 0, 28, ['#3a4252', '#14171e']); veelhoek(g, zes(13)); g.fill()
          g.strokeStyle = KLEUR[soort]; g.lineWidth = 1.6; veelhoek(g, zes(13)); g.stroke()
          g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.6; veelhoek(g, zes(10)); g.stroke()
          const ic = document.createElement('canvas'); tekenIcoon(ic, soort, 4)
          g.imageSmoothingEnabled = false; g.drawImage(ic, 7, 7, 14, 14)
        }, KLEUR[soort], 6)
      }
      this.maakBaas()
      this.maakGrond()
    }

    /* ---- de grond van level 1: een neonstad 's nachts, van boven gezien. Loopt naadloos rond. ---- */
    maakGrond() {
      const B = 360, HH = 720, r = rng(424242)
      const DAK = [['#221a44', '#16112e', '#3a2f6a'], ['#1d2240', '#121529', '#34406e'], ['#2a1a3e', '#180f26', '#4a2f6a'], ['#1a2333', '#0f1520', '#2f4058']]
      const NEON = ['#ff3dd2', '#5ee7e0', '#9b6bff', '#ff5d9e', '#ffd23c']
      this.teken('grond', B, HH, g => {
        const gloei = (kleur, sterkte, f) => { g.save(); g.shadowColor = kleur; g.shadowBlur = sterkte * R; f(); g.restore() }
        g.fillStyle = '#0a0716'; g.fillRect(0, 0, B, HH)
        const wegX = [0, 124, 244, 360], wegY = [0, 120, 240, 360, 480, 600]
        const RIV0 = 510, RIV1 = 570
        const gebouw = (x, y, b, h) => {
          const k = DAK[Math.floor(r() * DAK.length)]
          g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + 3, y + 4, b, h)
          g.fillStyle = lin(g, x, y, x + b, y + h, [k[0], k[1]]); g.fillRect(x, y, b, h)
          g.strokeStyle = k[2]; g.lineWidth = 0.8; g.strokeRect(x + 0.8, y + 0.8, b - 1.6, h - 1.6)
          const n = 1 + Math.floor(r() * 3)
          for (let i = 0; i < n; i++) {
            const tp = r(), dx = x + 3 + r() * Math.max(1, b - 12), dy = y + 3 + r() * Math.max(1, h - 11)
            if (tp < 0.35) { g.fillStyle = '#2c2a44'; g.fillRect(dx, dy, 6, 5); g.strokeStyle = '#4a476a'; g.lineWidth = 0.5; g.beginPath(); g.arc(dx + 3, dy + 2.5, 1.6, 0, 7); g.stroke() }
            else if (tp < 0.55) { g.fillStyle = '#24223a'; g.beginPath(); g.arc(dx + 3, dy + 3, 3, 0, 7); g.fill(); g.fillStyle = '#3c3a5c'; g.fillRect(dx + 1.5, dy + 1.5, 1.5, 1) }
            else if (tp < 0.75) { g.fillStyle = '#152448'; g.fillRect(dx, dy, 8, 6); g.strokeStyle = '#3b5ba8'; g.lineWidth = 0.4; for (let j = 1; j < 4; j++) { g.beginPath(); g.moveTo(dx + j * 2, dy); g.lineTo(dx + j * 2, dy + 6); g.stroke() } }
            else gloei('#ffe9a8', 3, () => { g.fillStyle = 'rgba(255,233,168,.75)'; g.fillRect(dx, dy, 4, 3) })
          }
          if (r() < 0.4) { const nk = NEON[Math.floor(r() * NEON.length)]; gloei(nk, 4, () => { g.fillStyle = nk; if (r() < 0.5) g.fillRect(x, y + h - 1.4, b, 1.2); else g.fillRect(x + b - 1.4, y, 1.2, h) }) }
          if (r() < 0.12 && b > 24 && h > 24) { g.strokeStyle = '#ff5d9e'; g.lineWidth = 1; g.beginPath(); g.arc(x + b / 2, y + h / 2, 7, 0, 7); g.stroke(); lijn(g, '#ff5d9e', 1, [x + b / 2 - 3, y + h / 2 - 3.5, x + b / 2 - 3, y + h / 2 + 3.5]); lijn(g, '#ff5d9e', 1, [x + b / 2 + 3, y + h / 2 - 3.5, x + b / 2 + 3, y + h / 2 + 3.5]); lijn(g, '#ff5d9e', 1, [x + b / 2 - 3, y + h / 2, x + b / 2 + 3, y + h / 2]) }
          if (r() < 0.25) gloei('#ff4848', 4, () => { g.fillStyle = '#ff4848'; g.beginPath(); g.arc(x + b - 3, y + 3, 1, 0, 7); g.fill() })
        }
        const gebouwen = (x0, y0, x1, y1) => {
          let x = x0
          while (x < x1 - 8) {
            const b = Math.min(x1 - x, 18 + Math.floor(r() * 24)); let y = y0
            while (y < y1 - 8) { const h = Math.min(y1 - y, 18 + Math.floor(r() * 24)); gebouw(x, y, b - 3, h - 3); y += h }
            x += b
          }
        }
        const park = (x0, y0, x1, y1) => {
          g.fillStyle = lin(g, x0, y0, x1, y1, ['#0f2a1d', '#0a1d14']); g.fillRect(x0, y0, x1 - x0, y1 - y0)
          g.fillStyle = '#2a3628'; g.fillRect(x0, (y0 + y1) / 2 - 1, x1 - x0, 2); g.fillRect((x0 + x1) / 2 - 1, y0, 2, y1 - y0)
          for (let n = 0; n < 30; n++) {
            const tx = x0 + 4 + r() * (x1 - x0 - 8), ty = y0 + 4 + r() * (y1 - y0 - 8), tr = 2.5 + r() * 3
            g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(tx + 1.5, ty + 2, tr, 0, 7); g.fill()
            g.fillStyle = r() < 0.5 ? '#1d5a34' : '#246b3d'; g.beginPath(); g.arc(tx, ty, tr, 0, 7); g.fill()
            g.fillStyle = '#3f8a52'; g.beginPath(); g.arc(tx - tr * 0.3, ty - tr * 0.3, tr * 0.4, 0, 7); g.fill()
          }
          for (let n = 0; n < 4; n++) gloei('#ffe14a', 4, () => { g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(x0 + 8 + n * (x1 - x0 - 16) / 3, (y0 + y1) / 2 - 3, 0.9, 0, 7); g.fill() })
        }
        // blokken tussen de wegen
        for (let i = 0; i < wegX.length - 1; i++) for (let j = 0; j < wegY.length; j++) {
          const x0 = wegX[i] + 9, x1 = wegX[i + 1] - 9, y0 = wegY[j] + 8, y1 = (j + 1 < wegY.length ? wegY[j + 1] : HH) - 8
          if (y0 < RIV1 && y1 > RIV0) { gebouwen(x0, y0, x1, RIV0 - 6); gebouwen(x0, RIV1 + 6, x1, y1); continue }
          if (r() < 0.13) park(x0, y0, x1, y1); else gebouwen(x0, y0, x1, y1)
        }
        // de rivier
        g.fillStyle = lin(g, 0, RIV0, 0, RIV1, ['#061a33', '#0b2c55', '#061a33']); g.fillRect(0, RIV0, B, RIV1 - RIV0)
        g.fillStyle = 'rgba(59,130,214,.45)'
        for (let n = 0; n < 70; n++) g.fillRect(r() * B, RIV0 + 4 + r() * (RIV1 - RIV0 - 8), 4 + r() * 10, 0.7)
        for (let n = 0; n < 16; n++) { g.fillStyle = NEON[n % NEON.length]; g.globalAlpha = 0.35; g.fillRect(r() * B, RIV0 + 6 + r() * 48, 1, 4 + r() * 6); g.globalAlpha = 1 }
        gloei('#5ee7e0', 4, () => { g.fillStyle = '#5ee7e0'; g.fillRect(0, RIV0, B, 1); g.fillRect(0, RIV1 - 1, B, 1) })
        // wegen
        g.fillStyle = '#141020'
        for (const y of wegY) for (const yy of [y, y + HH]) g.fillRect(0, yy - 7, B, 14)
        for (const x of wegX) { g.fillRect(x - 8, 0, 16, RIV0); g.fillRect(x - 8, RIV1, 16, HH - RIV1) }
        g.fillStyle = '#251d38'
        for (const y of wegY) for (const yy of [y, y + HH]) { g.fillRect(0, yy - 7, B, 0.8); g.fillRect(0, yy + 6.2, B, 0.8) }
        // bruggen
        for (const x of wegX) {
          g.fillStyle = '#2a2240'; g.fillRect(x - 9, RIV0 - 2, 18, RIV1 - RIV0 + 4)
          gloei('#ff3dd2', 3, () => { g.fillStyle = '#ff3dd2'; g.fillRect(x - 9, RIV0 - 2, 1, RIV1 - RIV0 + 4); g.fillRect(x + 8, RIV0 - 2, 1, RIV1 - RIV0 + 4) })
        }
        // middenstrepen
        g.globalAlpha = 0.55
        g.fillStyle = '#5ee7e0'; for (const y of wegY) for (const yy of [y, y + HH]) for (let x = 0; x < B; x += 10) g.fillRect(x, yy - 0.4, 5, 0.8)
        g.fillStyle = '#ff5d9e'; for (const x of wegX) for (let y = 0; y < HH; y += 10) { if (y > RIV0 - 4 && y < RIV1 + 4) continue; g.fillRect(x - 0.4, y, 0.8, 5) }
        g.globalAlpha = 1
        // zebrapaden bij de kruispunten
        g.fillStyle = 'rgba(230,230,255,.22)'
        for (const x of wegX) for (const y of wegY) for (let k = -6; k <= 5; k += 2.4) { g.fillRect(x + k, y - 13, 1.2, 4); g.fillRect(x + 10, y + k, 4, 1.2) }
        // auto's met koplampen
        for (let n = 0; n < 34; n++) {
          const verticaal = r() < 0.5
          const x = verticaal ? wegX[Math.floor(r() * wegX.length)] + (r() < 0.5 ? -4 : 4) : r() * B
          const y = verticaal ? r() * HH : wegY[Math.floor(r() * wegY.length)] + (r() < 0.5 ? -3.5 : 3.5)
          if (y > RIV0 - 6 && y < RIV1 + 6 && !verticaal) continue
          const kleur = ['#c9d3df', '#ff5d9e', '#4aa3ff', '#ffd23c', '#7d8a9c'][Math.floor(r() * 5)]
          g.fillStyle = kleur
          if (verticaal) { rondRect(g, x - 1.6, y, 3.2, 6, 1); g.fill(); gloei('#ffffff', 3, () => { g.fillStyle = '#ffffff'; g.fillRect(x - 1.4, y - 0.4, 1, 0.8); g.fillRect(x + 0.4, y - 0.4, 1, 0.8) }); g.fillStyle = '#ff2a2a'; g.fillRect(x - 1.4, y + 5.6, 2.8, 0.6) }
          else { rondRect(g, x, y - 1.6, 6, 3.2, 1); g.fill(); gloei('#ffffff', 3, () => { g.fillStyle = '#ffffff'; g.fillRect(x + 5.6, y - 1.4, 0.8, 1); g.fillRect(x + 5.6, y + 0.4, 0.8, 1) }) }
        }
      })
      // nevel: een laag die sneller schuift
      this.teken('nevel', 360, 640, g => {
        const r2 = rng(99)
        for (let n = 0; n < 9; n++) {
          const x = r2() * 360, y = r2() * 640, rx = 40 + r2() * 60, ry = 16 + r2() * 24
          for (const dy of [0, -640, 640]) {
            g.save(); g.translate(x, y + dy); g.scale(1, ry / rx)
            g.fillStyle = rad(g, 0, 0, rx, ['rgba(150,110,255,.32)', 'rgba(150,110,255,0)']); g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore()
          }
        }
      })
    }

    /* ---- de eindbaas TITAN: een zwaar moederschip; romp, kern en twee kanonnen apart ---- */
    maakBaas() {
      this.teken('baasRomp', 280, 104, g => {
        g.fillStyle = lin(g, 0, 0, 0, 104, ['#3b4252', '#181c24'])
        veelhoek(g, [140, 0, 196, 10, 278, 50, 268, 66, 206, 64, 188, 88, 92, 88, 74, 64, 12, 66, 2, 50, 84, 10]); g.fill()
        lijn(g, '#8590a6', 1, [84, 10, 2, 50]); lijn(g, '#5b6478', 1, [196, 10, 278, 50])
        g.fillStyle = lin(g, 100, 0, 180, 0, ['#262c38', '#4d5668', '#353d4c', '#262c38'])
        veelhoek(g, [140, 6, 180, 18, 176, 80, 104, 80, 100, 18]); g.fill()
        lijn(g, 'rgba(10,12,18,.85)', 0.8, [101, 40, 179, 40]); lijn(g, 'rgba(10,12,18,.85)', 0.8, [102, 62, 178, 62]); lijn(g, 'rgba(10,12,18,.85)', 0.8, [140, 6, 140, 34])
        for (const p of [[92, 20, 30, 50], [188, 20, 250, 50], [58, 34, 66, 60], [222, 34, 214, 60], [120, 20, 116, 40], [160, 20, 164, 40]]) lijn(g, 'rgba(10,12,18,.7)', 0.7, p)
        g.fillStyle = '#5e6a7e'; for (const [x, y] of [[110, 24], [170, 24], [110, 70], [170, 70], [60, 44], [220, 44]]) { g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill() }
        g.save(); g.shadowColor = '#ffa53c'; g.shadowBlur = 5 * R; g.fillStyle = '#ffa53c'
        for (let i = 0; i < 5; i++) { g.fillRect(26 + i * 12, 53 - i * 4.4, 7, 1.8); g.fillRect(247 - i * 12, 53 - i * 4.4, 7, 1.8) }
        for (const x of [116, 130, 150, 164]) g.fillRect(x - 3, 9, 6, 2.5)
        g.restore()
        g.save(); g.shadowColor = '#ff3dd2'; g.shadowBlur = 4 * R; lijn(g, '#ff3dd2', 1.2, [2, 50, 12, 66, 74, 64, 92, 88, 188, 88, 206, 64, 268, 66, 278, 50]); g.restore()
        g.fillStyle = '#0b0d12'; g.beginPath(); g.arc(140, 80, 22, Math.PI, 0); g.fill()
        g.strokeStyle = '#ff3dd2'; g.lineWidth = 1; g.beginPath(); g.arc(140, 80, 22, Math.PI, 0); g.stroke()
        g.fillStyle = lin(g, 0, 44, 0, 74, ['#2a303c', '#14171e']); rondRect(g, 40, 44, 36, 28, 4); g.fill(); rondRect(g, 204, 44, 36, 28, 4); g.fill()
        g.strokeStyle = '#596579'; g.lineWidth = 0.7; rondRect(g, 40, 44, 36, 28, 4); g.stroke(); rondRect(g, 204, 44, 36, 28, 4); g.stroke()
        g.fillStyle = '#5ee7e0'; for (const x of [120, 160]) g.fillRect(x - 1, 84, 2, 3)
      }, '#ff3dd2', 6)
      this.teken('baasKern', 46, 46, g => {
        g.fillStyle = rad(g, 23, 23, 21, ['#ffffff', '#ffb3f0', '#ff3dd2', '#7a0c6a', '#22061e']); g.beginPath(); g.arc(23, 23, 20, 0, 7); g.fill()
        g.fillStyle = '#12041e'; g.beginPath(); g.ellipse(23, 23, 2.6, 12, 0, 0, 7); g.fill()
        g.strokeStyle = '#ffd23c'; g.lineWidth = 1.4
        for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(23, 23, 21.5, i * Math.PI / 4 + 0.1, i * Math.PI / 4 + 0.6); g.stroke() }
      }, '#ff3dd2', 7)
      this.teken('baasKanon', 34, 46, g => {
        g.fillStyle = '#14171e'; g.fillRect(9, 22, 6, 24); g.fillRect(19, 22, 6, 24)
        g.fillStyle = '#ffa53c'; g.fillRect(9, 43, 6, 3); g.fillRect(19, 43, 6, 3)
        g.fillStyle = lin(g, 0, 0, 34, 0, ['#2a303c', '#6a7488', '#2a303c']); rondRect(g, 3, 2, 28, 24, 4); g.fill()
        g.strokeStyle = '#ffd23c'; g.lineWidth = 1.2; rondRect(g, 3.5, 2.5, 27, 23, 4); g.stroke()
        lijn(g, 'rgba(10,12,18,.8)', 0.6, [5, 14, 29, 14])
        g.fillStyle = rad(g, 17, 9, 4, ['#ffffff', '#ff6b6b', '#7a0f1a']); g.beginPath(); g.arc(17, 9, 3.4, 0, 7); g.fill()
      }, '#ffd23c', 5)
      this.teken('baasKapot', 34, 46, g => {
        g.fillStyle = '#120f16'; veelhoek(g, [4, 4, 14, 2, 30, 6, 28, 22, 18, 26, 6, 22]); g.fill()
        g.fillStyle = '#2a2430'; veelhoek(g, [8, 8, 16, 6, 14, 14]); g.fill(); veelhoek(g, [20, 12, 27, 10, 26, 18]); g.fill()
        g.fillStyle = '#14171e'; g.fillRect(10, 24, 5, 10)
        g.save(); g.shadowColor = '#ff8a1a'; g.shadowBlur = 4 * R; g.fillStyle = '#ff8a1a'; g.fillRect(16, 14, 2, 2); g.fillRect(9, 18, 1.5, 1.5); g.restore()
      })
    }

    /* ---- opbouw ---- */
    create() {
      huidige = this
      this.maakTexturen()
      this.tijdSchaal = 1
      this.klok = 0
      this.golven = golvenLevel1(rng(1001))
      this.golfNr = 0
      this.vijanden = []; this.kogelsV = []; this.kogelsS = []; this.buit = []
      this.pool = {}
      this.score = 0; this.getoond = 0; this.combo = 1; this.comboTijd = 0
      this.levens = 3; this.onraakbaar = 2.2; this.schild = 0
      this.niveau = { puls: 1 }; this.wapen = 'puls'
      this.voorraad = { bom: 2, schild: 0 }
      this.herlaad = 0; this.raketKlok = 0; this.straalAan = false
      this.voorbij = false; this.pauze = false
      this.baas = null
      this.dropTel = 0

      this.cameras.main.setZoom(R).setOrigin(0, 0)   // de wereld is W x H; het beeld heeft R keer zoveel punten
      this.grond = this.add.tileSprite(0, 0, W * R, H * R, 'grond').setOrigin(0, 0).setScale(SB).setDepth(-50).setAlpha(0.62)   // gedimd: vijanden en kogels moeten opvallen
      this.nevel = this.add.tileSprite(0, 0, W * R, H * R, 'nevel').setOrigin(0, 0).setScale(SB).setDepth(30).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD)
      this.schaduw = this.add.image(0, 0, 'schip').setTint(0x000000).setAlpha(0.35).setDepth(-5).setScale(0.8 * SB)
      this.speler = this.add.image(W / 2, H - 90, 'schip').setDepth(20).setScale(SB)
      this.vlam = this.add.image(0, 0, 'vlam0').setDepth(19).setScale(SB).setOrigin(0.5, 6 / 28).setBlendMode(Phaser.BlendModes.ADD)
      this.bel = this.add.image(0, 0, 'schildBel').setDepth(21).setScale(SB).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
      this.baasG = this.add.graphics().setDepth(31)
      this.straalG = this.add.graphics().setDepth(18).setBlendMode(Phaser.BlendModes.ADD)
      this.fx = this.add.graphics().setDepth(25).setBlendMode(Phaser.BlendModes.ADD)
      this.vonken = {}
      for (const k of ['#5ee7e0', '#ff5d9e', '#ff3dd2', '#ffd23c', '#ffffff', '#b6ff3c', '#4aa3ff', '#ff4848', '#ffa53c', '#7fd4ff']) {
        this.vonken[k] = this.add.particles(0, 0, 'vonk', {
          lifespan: { min: 260, max: 820 }, speed: { min: 50, max: 300 }, angle: { min: 0, max: 360 },
          scale: { start: 1.5, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', tint: hexInt(k), emitting: false
        }).setDepth(26)
      }
      tekenLevens(this.levens)
      werkTegelBij()
      scoreVak.textContent = '0000000'; comboVak.textContent = ''
      baasVak.hidden = true
      if (window.__fibroProef) window.__neonRaiders = { scene: this, W, H, vingers, vuurtNu }   // alleen in de proeven (tests/tools/proef88.py)
    }

    toonBord(a, b, k) { bord(a, b, k) }

    /* ---- de speler duwen (vanuit de vinger) ---- */
    duw(dx, dy) {
      if (this.voorbij || this.pauze) return
      this.speler.x = Phaser.Math.Clamp(this.speler.x + dx, 18, W - 18)
      this.speler.y = Phaser.Math.Clamp(this.speler.y + dy, 70, H - 24)
    }

    /* ---- pool: plaatjes hergebruiken in plaats van steeds nieuw maken ---- */
    pak(key) {
      const p = this.pool[key] || (this.pool[key] = [])
      const img = p.pop() || this.add.image(0, 0, key)
      img.setVisible(true).setActive(true).setAlpha(1).setScale(SB).setRotation(0).clearTint().setBlendMode(Phaser.BlendModes.NORMAL)
      return img
    }
    weg(img) { if (!img) return; img.setVisible(false).setActive(false); (this.pool[img.texture.key] || (this.pool[img.texture.key] = [])).push(img) }

    /* ---- vijanden maken ---- */
    maak(soort, o) {
      const S = SOORT[soort]
      const v = { soort, hp: S.hp, max: S.hp, r: S.r, punten: S.punten, t: 0, x: o.x || W / 2, y: -30, o, vx: 0, vy: 0, schiet: 0, grond: !!S.grond }
      if (soort === 'zwaai') { v.x = o.kant < 0 ? -20 : W + 20; v.y = o.y || 80; v.vx = o.kant < 0 ? 170 : -170; v.vy = 10 }
      if (soort === 'tank') { v.y = -24; v.vx = (o.x < W / 2 ? 1 : -1) * 8 }
      if (soort === 'kolos') v.y = -50
      v.spr = this.pak(soort === 'tank' ? 'tank' : soort).setDepth(v.grond ? -10 : 10)
      if (soort === 'tank') v.loop = this.pak('loop').setDepth(-9).setOrigin(0.5, 25 / 38)
      if (soort === 'kolos' || soort === 'schutter') v.schaduw = this.pak(soort).setTint(0x000000).setAlpha(0.3).setDepth(-5).setScale(0.75 * SB)
      v.spr.setPosition(v.x, v.y)
      this.vijanden.push(v)
      return v
    }

    vijandStap(v, dt) {
      v.t += dt
      const sp = this.speler
      switch (v.soort) {
        case 'dart': {
          const snel = v.o.snel || 1
          v.y += 130 * snel * dt
          if (!v.o.recht) v.x = v.o.x + Math.sin(v.t * 2.6 + v.o.fase) * 46
          else v.x = v.o.x + Math.sin(v.t * 3 + v.o.fase) * 8
          break
        }
        case 'zwaai': {
          v.x += v.vx * dt; v.y += v.vy * dt
          v.vy += 95 * dt; v.vx *= Math.pow(0.55, dt)
          if (v.schiet === 0 && v.t > 0.9 && v.y > 20) { v.schiet = 1; this.mik(v.x, v.y, 'orb', 150, 0) }
          break
        }
        case 'schutter': {
          const doel = v.o.doelY || 140
          if (v.t < 6.5) { v.y += (doel - v.y) * Math.min(1, 2.2 * dt) }
          else { v.y += 110 * dt; v.x += (v.x < W / 2 ? -40 : 40) * dt }
          v.x += Math.sin(v.t * 1.4) * 12 * dt
          v.schiet -= dt
          if (v.t > 1.2 && v.t < 6.5 && v.schiet <= 0) { v.schiet = 1.5; for (let i = -1; i <= 1; i++) this.mik(v.x, v.y + 10, 'orb', 140, i * 0.22) }
          break
        }
        case 'tank': {
          v.y += this.grondSnelheid * dt; v.x += v.vx * dt
          if (v.x < 30 || v.x > W - 30) v.vx = -v.vx
          const hoek = Math.atan2(sp.y - v.y, sp.x - v.x)
          v.loop.setRotation(hoek + Math.PI / 2)
          v.schiet -= dt
          if (v.y > 40 && v.y < H - 140 && v.schiet <= 0) { v.schiet = 2; this.mik(v.x + Math.cos(hoek) * 14, v.y + Math.sin(hoek) * 14, 'naald', 165, 0) }
          break
        }
        case 'kolos': {
          if (v.t < 4) v.y += (150 - v.y) * Math.min(1, 1.2 * dt)
          else if (v.t < 14) v.x = v.o.x + Math.sin((v.t - 4) * 0.7) * 50
          else v.y += 60 * dt
          v.schiet -= dt
          if (v.t > 2 && v.t < 14 && v.schiet <= 0) {
            v.schiet = 2.3
            const n = 10, a0 = v.t
            for (let i = 0; i < n; i++) this.kogel(v.x, v.y, 'orbO', Math.cos(a0 + i * Math.PI * 2 / n) * 105, Math.sin(a0 + i * Math.PI * 2 / n) * 105)
            GELUID.speel('vijandSchiet')
          }
          break
        }
        case 'drager': {
          v.y += 52 * dt; v.x = v.o.x + Math.sin(v.t * 1.5) * 30
          break
        }
      }
      v.spr.setPosition(v.x, v.y)
      if (v.loop) v.loop.setPosition(v.x, v.y)
      if (v.schaduw) v.schaduw.setPosition(v.x + 20, v.y + 28)
      if (v.flits > 0) { v.flits -= dt; if (v.flits <= 0) v.spr.clearTint() }
      return v.y < H + 60 && v.x > -80 && v.x < W + 80 && !(v.soort === 'zwaai' && v.t > 6)
    }

    ruimVijand(v) {
      this.weg(v.spr); if (v.loop) this.weg(v.loop); if (v.schaduw) this.weg(v.schaduw)
      v.dood = true
    }

    /* ---- kogels ---- */
    kogel(x, y, key, vx, vy) {
      const k = { spr: this.pak(key).setDepth(24).setBlendMode(Phaser.BlendModes.ADD), x, y, vx, vy, r: key === 'naald' ? 4 : 5 }
      if (key === 'naald') k.spr.setRotation(Math.atan2(vy, vx) - Math.PI / 2)
      k.spr.setPosition(x, y)
      this.kogelsV.push(k)
      return k
    }
    mik(x, y, key, snelheid, extraHoek) {
      const a = Math.atan2(this.speler.y - y, this.speler.x - x) + (extraHoek || 0)
      this.kogel(x, y, key, Math.cos(a) * snelheid, Math.sin(a) * snelheid)
      GELUID.speel('vijandSchiet')
    }
    schot(key, x, y, vx, vy, dmg, extra) {
      const k = Object.assign({ spr: this.pak(key).setDepth(15).setBlendMode(Phaser.BlendModes.ADD), x, y, vx, vy, dmg, r: 6 }, extra || {})
      k.spr.setPosition(x, y).setRotation(Math.atan2(vy, vx) + Math.PI / 2)
      this.kogelsS.push(k)
    }
    vuur(dt) {
      const sp = this.speler, niv = this.niveau[this.wapen] || 1
      this.herlaad -= dt; this.raketKlok -= dt
      const straal = this.wapen === 'straal'
      if (straal !== this.straalAan || !vuurtNu()) { if (this.straalAan) GELUID.straal(false); this.straalAan = false }
      if (!vuurtNu()) return
      if (straal) { if (!this.straalAan) { this.straalAan = true; GELUID.straal(true) } return }
      if (this.herlaad > 0) return
      if (this.wapen === 'puls') {
        this.herlaad = 0.11
        const rijen = niv === 1 ? [0] : niv === 2 ? [-6, 6] : [-10, 0, 10]
        rijen.forEach(dx => this.schot('puls', sp.x + dx, sp.y - 16, 0, -620, 1))
        if (niv === 3) { this.schot('puls', sp.x - 14, sp.y - 6, -90, -580, 0.7); this.schot('puls', sp.x + 14, sp.y - 6, 90, -580, 0.7) }
        GELUID.speel('puls')
      } else if (this.wapen === 'spreid') {
        this.herlaad = 0.17
        const n = niv === 1 ? 3 : niv === 2 ? 5 : 7, br = niv === 3 ? 0.9 : 0.7
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * (br / (n - 1)); this.schot('spreidKogel', sp.x, sp.y - 12, Math.cos(a) * 470, Math.sin(a) * 470, 0.75) }
        GELUID.speel('spreid')
      } else if (this.wapen === 'raket') {
        this.herlaad = 0.16
        this.schot('puls', sp.x, sp.y - 16, 0, -620, 0.6)
        if (this.raketKlok <= 0) {
          this.raketKlok = niv === 1 ? 0.55 : niv === 2 ? 0.42 : 0.3
          const paar = niv === 3 ? [-14, -6, 6, 14] : [-10, 10]
          paar.forEach(dx => this.schot('raketKogel', sp.x + dx, sp.y - 4, dx * 6, -160, 3, { raket: true, leeft: 0 }))
          GELUID.speel('raket')
        }
      }
    }
    /* de straal raakt het eerste doel recht voor je */
    straalStap(dt) {
      const g = this.straalG; g.clear()
      if (!this.straalAan) return
      const sp = this.speler, niv = this.niveau.straal || 1, breed = 8 + niv * 6, dps = 10 + niv * 6
      let doel = null, eind = -20
      const doelen = this.doelen()
      for (const d of doelen) { if (Math.abs(d.x - sp.x) < d.r + breed / 2 && d.y < sp.y - 10 && d.y > eind) { eind = d.y; doel = d } }
      const top = doel ? doel.y + doel.r * 0.4 : -20
      const flikker = 0.85 + Math.random() * 0.15
      g.fillStyle(0xb6ff3c, 0.18 * flikker); g.fillRect(sp.x - breed, top, breed * 2, sp.y - 14 - top)
      g.fillStyle(0xb6ff3c, 0.55 * flikker); g.fillRect(sp.x - breed / 2, top, breed, sp.y - 14 - top)
      g.fillStyle(0xffffff, 0.9); g.fillRect(sp.x - 1.5, top, 3, sp.y - 14 - top)
      if (doel) {
        this.raak(doel, dps * dt, true)
        if (Math.random() < 0.5) this.vonken['#b6ff3c'].explode(1, sp.x + (Math.random() - 0.5) * breed, top)
      }
    }
    /* alles wat geraakt kan worden: vijanden en de onderdelen van de baas */
    doelen() {
      const uit = []
      for (const v of this.vijanden) if (!v.dood && v.y > -10) uit.push(v)
      if (this.baas && this.baas.binnen) for (const d of this.baas.delen) if (!d.dood) uit.push(d)
      return uit
    }

    /* ---- raken, ontploffen, punten ---- */
    raak(d, schade, stil) {
      if (d.dood) return
      if (d.baasdeel) { this.raakBaas(d, schade, stil); return }
      d.hp -= schade
      if (!stil || Math.random() < 0.08) { d.spr.setTintFill(0xffffff); d.flits = 0.05; GELUID.speel('raak') }
      if (d.hp <= 0) this.dood(d)
    }
    dood(v) {
      const S = SOORT[v.soort]
      this.ontplof(v.x, v.y, v.soort === 'kolos' ? 3 : v.soort === 'schutter' || v.soort === 'tank' ? 1.6 : 1, S.kleur)
      this.punten(v.punten, v.x, v.y, v.soort === 'kolos')
      if (v.soort === 'drager') this.laatVallen(v.x, v.y, v.o.buit)
      if (v.soort === 'kolos') { this.laatVallen(v.x - 16, v.y, this.dropTel++ % 2 ? 'bom' : 'schild'); this.laatVallen(v.x + 16, v.y, WAPENS[this.dropTel++ % 4]) }
      this.ruimVijand(v)
    }
    punten(n, x, y, groot) {
      this.comboTijd = 1.4
      this.combo = Math.min(8, this.combo + (n >= 300 ? 1 : 0.25))
      const m = Math.floor(this.combo)
      const erbij = n * m
      this.score += erbij
      comboVak.textContent = m > 1 ? 'x' + m : ''
      if (groot || n >= 400) {
        const t = this.add.text(x, y - 10, '+' + getal(erbij), { fontFamily: '"Press Start 2P",monospace', fontSize: groot ? '12px' : '8px', color: groot ? '#ffe14a' : '#ffffff', stroke: groot ? '#b5106a' : '#ff3dd2', strokeThickness: 3 }).setOrigin(0.5).setDepth(40).setResolution(R)
        t.setShadow(0, 0, groot ? '#ffe14a' : '#ff3dd2', 8, true, true)
        this.tweens.add({ targets: t, y: y - (groot ? 56 : 40), alpha: 0, duration: groot ? 1400 : 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() })
      }
    }
    ontplof(x, y, grootte, kleuren) {
      const n = Math.round((this.zuinig ? 5 : 10) * grootte)
      ;(kleuren || ['#ff3dd2', '#ffffff']).forEach((k, i) => { const em = this.vonken[k] || this.vonken['#ffffff']; em.explode(i === 0 ? n : Math.ceil(n / 2), x, y) })
      const f = this.add.image(x, y, 'flits').setDepth(27).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3 * grootte * SB)
      this.tweens.add({ targets: f, scale: 1.3 * grootte * SB, alpha: 0, duration: 260 + 60 * grootte, onComplete: () => f.destroy() })
      const ring = this.add.circle(x, y, 6, 0xffffff, 0).setStrokeStyle(2, hexInt((kleuren || ['#ff3dd2'])[0]), 1).setDepth(27).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: ring, scale: 2.5 + grootte * 2, alpha: 0, duration: 380 + 80 * grootte, onComplete: () => ring.destroy() })
      if (grootte >= 1.5) this.cameras.main.shake(120 + grootte * 60, 0.004 + grootte * 0.002)
      GELUID.speel(grootte >= 2 ? 'groot' : 'klein')
    }

    /* ---- power-ups ---- */
    laatVallen(x, y, soort) {
      if (!soort) return
      const b = { soort, x, y, t: 0, spr: this.pak('cap_' + soort).setDepth(16) }
      b.spr.setPosition(x, y)
      this.buit.push(b)
    }
    pakBuit(b) {
      const s = b.soort, namen = NAAM()
      let tekst = namen[s]
      if (WAPENS.includes(s)) {
        const was = this.niveau[s] || 0
        if (was >= 3) { this.punten(1000, b.x, b.y); tekst = 'MAX +1000' }
        else { this.niveau[s] = was + 1; tekst += ' ' + this.niveau[s] }
        if (!was) this.wapen = s
        GELUID.speel('pak')
      } else if (s === 'bom' || s === 'schild') { this.voorraad[s] = Math.min(9, (this.voorraad[s] || 0) + 1); tekst += ' +1'; GELUID.speel('pak') }
      else if (s === 'leven') { this.levens = Math.min(6, this.levens + 1); tekenLevens(this.levens); GELUID.speel('leven') }
      const t = this.add.text(b.x, b.y - 14, tekst, { fontFamily: '"Press Start 2P",monospace', fontSize: '8px', color: '#ffffff', stroke: KLEUR[s], strokeThickness: 3 }).setOrigin(0.5).setDepth(40).setResolution(R)
      this.tweens.add({ targets: t, y: b.y - 50, alpha: 0, duration: 1100, onComplete: () => t.destroy() })
      this.vonken[KLEUR[s]] ? this.vonken[KLEUR[s]].explode(14, b.x, b.y) : this.vonken['#ffffff'].explode(14, b.x, b.y)
      werkTegelBij(); if (!arsenaal.hidden) bouwArsenaal()
    }
    gebruikBom() {
      if (!(this.voorraad.bom > 0) || this.voorbij) return
      this.voorraad.bom--
      const sp = this.speler
      GELUID.speel('bom')
      this.cameras.main.flash(260, 255, 240, 160)
      this.cameras.main.shake(500, 0.016)
      const ring = this.add.circle(sp.x, sp.y, 10, 0xffe14a, 0.25).setStrokeStyle(6, 0xffe14a, 1).setDepth(28).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: ring, scale: 70, alpha: 0, duration: 900, onComplete: () => ring.destroy() })
      for (const k of this.kogelsV) { this.vonken['#ffd23c'].explode(2, k.x, k.y); this.weg(k.spr); k.dood = true }
      this.kogelsV = []
      for (const d of this.doelen()) this.raak(d, d.baasdeel ? 30 : 40)
      this.onraakbaar = Math.max(this.onraakbaar, 1.2)
      werkTegelBij()
    }
    gebruikSchild() {
      if (!(this.voorraad.schild > 0) || this.schild > 0 || this.voorbij) return
      this.voorraad.schild--
      this.schild = 9
      GELUID.speel('schild')
      werkTegelBij()
    }

    /* ---- geraakt worden ---- */
    geraakt() {
      if (this.onraakbaar > 0 || this.voorbij || this.godmode) return
      if (this.schild > 0) return
      this.levens--
      tekenLevens(this.levens)
      const sp = this.speler
      this.ontplof(sp.x, sp.y, 2.4, ['#5ee7e0', '#ffffff', '#ff5d9e'])
      GELUID.speel('pijn')
      this.cameras.main.flash(180, 255, 80, 140)
      const w = this.wapen; if (this.niveau[w] > 1) this.niveau[w]--
      this.combo = 1; comboVak.textContent = ''
      for (const k of this.kogelsV) { this.weg(k.spr); k.dood = true }
      this.kogelsV = []
      werkTegelBij()
      if (this.levens <= 0) { this.einde(false); return }
      sp.setPosition(W / 2, H - 70)
      this.onraakbaar = 2.6
    }

    /* ---- de eindbaas ---- */
    startBaas() {
      this.golfStop = true
      this.baasWacht = 0
    }
    baasKomt() {
      bord(vertaal('WAARSCHUWING'), 'TITAN', '#ff4848', true)
      balk(vertaal('EINDBAAS NADERT: {naam}', { naam: 'TITAN' }), '#ff4848', 4200)
      GELUID.speel('alarm')
      GELUID.muziek(false)
      this.time.delayedCall(2200, () => { if (!this.voorbij) { GELUID.muziek(true, 'baas') } })
      const b = { x: W / 2, y: -90, t: 0, binnen: false, fase: 1, spiraal: 0, spiraalHoek: 0, ring: 0, laser: null, laserKlok: 3, spawn: 6, dood: false, sterft: 0 }
      b.romp = this.add.image(b.x, b.y, 'baasRomp').setDepth(9).setScale(SB)
      b.schaduw = this.add.image(b.x, b.y, 'baasRomp').setDepth(-6).setTint(0x000000).setAlpha(0.3).setScale(0.7 * SB)
      const stijl = { fontFamily: '"Press Start 2P",monospace', fontSize: '6px', color: '#ffffff', stroke: '#07051a', strokeThickness: 2 }
      const deel = (naam, label, dx, dy, key, hp, r) => ({ naam, dx, dy, hp, max: hp, r, baasdeel: true, dood: false, x: 0, y: 0, spr: this.add.image(0, 0, key).setDepth(11).setScale(SB), schiet: 1 + (dx > 0 ? 0.85 : 0),
        label: this.add.text(0, 0, label, stijl).setOrigin(0.5, 1).setDepth(32).setResolution(R).setVisible(false) })
      b.delen = [deel('kanonL', vertaal('KANON L'), -82, 16, 'baasKanon', 70, 18), deel('kanonR', vertaal('KANON R'), 82, 16, 'baasKanon', 70, 18), deel('kern', vertaal('KERN'), 0, 28, 'baasKern', 220, 21)]
      this.baas = b
      baasBalk.style.width = '100%'
    }
    raakBaas(d, schade, stil) {
      const b = this.baas; if (!b || b.dood || !b.binnen) return
      if (d.naam === 'kern' && b.fase === 1) { schade *= 0.2; if (!stil || Math.random() < 0.1) GELUID.speel('ketsen') }
      d.hp -= schade
      if (!stil || Math.random() < 0.1) { d.spr.setTintFill(0xffffff); d.flits = 0.05; if (d.naam !== 'kern' || b.fase > 1) GELUID.speel('raak') }
      if (d.hp <= 0) {
        d.dood = true
        if (d.naam === 'kern') { this.baasSterft(); return }
        this.ontplof(b.x + d.dx, b.y + d.dy, 2.5, ['#ffd23c', '#ff3dd2', '#ffffff'])
        this.punten(3000, b.x + d.dx, b.y + d.dy, true)
        d.spr.setTexture('baasKapot').clearTint(); d.label.setVisible(false)
        if (b.delen.filter(x => x.naam !== 'kern' && !x.dood).length === 0) { b.fase = 2; b.laserKlok = 1.5; b.ring = 1.5 }
      }
      this.werkBaasBalkBij()
    }
    /* kleine balkjes met naam boven de kanonnen en onder de kern */
    tekenBaasBalkjes() {
      const b = this.baas, g = this.baasG
      g.clear()
      if (!b || !b.binnen || b.dood) { if (b && b.delen) b.delen.forEach(d => d.label.setVisible(false)); return }
      for (const d of b.delen) {
        if (d.dood) { d.label.setVisible(false); continue }
        const kern = d.naam === 'kern', bw = kern ? 40 : 30, x = d.x - bw / 2, y = kern ? d.y + 26 : d.y - 30
        const kleur = kern ? 0xff3dd2 : 0xffd23c
        g.fillStyle(0x07051a, 0.85); g.fillRect(x - 1, y - 1, bw + 2, 5)
        g.fillStyle(kleur, 1); g.fillRect(x, y, bw * Math.max(0, d.hp / d.max), 3)
        g.lineStyle(0.6, kleur, 0.9); g.strokeRect(x - 1, y - 1, bw + 2, 5)
        if (kern) d.label.setOrigin(0.5, 0).setPosition(d.x, y + 6)
        else d.label.setPosition(d.x, y - 2)
        d.label.setColor(kern && b.fase === 1 ? '#8f9cc8' : '#ffffff').setVisible(true)
      }
    }
    werkBaasBalkBij() {
      const b = this.baas; if (!b) return
      let hp = 0, max = 0
      for (const d of b.delen) { hp += Math.max(0, d.hp); max += d.max }
      baasBalk.style.width = Math.max(0, Math.round(100 * hp / max)) + '%'
    }
    baasStap(dt) {
      const b = this.baas; if (!b) return
      b.t += dt
      if (b.sterft > 0) { this.baasDoodStap(dt); return }
      if (!b.binnen) {
        b.y += (118 - b.y) * Math.min(1, 1.1 * dt)
        if (b.t > 3.2) { b.binnen = true; baasVak.hidden = false }
      } else b.x = W / 2 + Math.sin((b.t - 3.2) * 0.55) * W * 0.1
      b.romp.setPosition(b.x, b.y)
      b.schaduw.setPosition(b.x + 30, b.y + 48)
      for (const d of b.delen) {
        d.x = b.x + d.dx; d.y = b.y + d.dy
        d.spr.setPosition(d.x, d.y)
        if (d.flits > 0) { d.flits -= dt; if (d.flits <= 0) d.spr.clearTint() }
      }
      const kern = b.delen[2]
      kern.spr.setScale((1 + Math.sin(b.t * 6) * 0.06) * SB)
      this.tekenBaasBalkjes()
      if (!b.binnen) return
      if (b.fase < 3 && kern.hp < kern.max * 0.35) { b.fase = 3; bord(vertaal('WOEDEND'), '', '#ff4848') }
      if (b.fase === 3) b.romp.setTint(Math.sin(b.t * 14) > 0 ? 0xff9090 : 0xffffff)
      // kanonnen: om de beurt een waaier van drie
      for (const d of b.delen) {
        if (d.naam === 'kern' || d.dood) continue
        d.schiet -= dt
        if (d.schiet <= 0) { d.schiet = 1.7; for (let i = -1; i <= 1; i++) this.mik(d.x, d.y + 22, 'orb', 150, i * 0.2) }
      }
      // spiraal uit de kern
      b.spiraal -= dt
      if (b.spiraal <= 0 && b.spiraal > -1.6) {
        b.spiraalTik = (b.spiraalTik || 0) - dt
        if (b.spiraalTik <= 0) {
          b.spiraalTik = b.fase === 3 ? 0.05 : 0.07
          b.spiraalHoek += 0.42
          this.kogel(kern.x, kern.y, 'orb', Math.cos(b.spiraalHoek) * 120, Math.sin(b.spiraalHoek) * 120)
          if (b.fase === 3) this.kogel(kern.x, kern.y, 'orbO', Math.cos(-b.spiraalHoek) * 105, Math.sin(-b.spiraalHoek) * 105)
        }
      } else if (b.spiraal <= -1.6) b.spiraal = b.fase === 1 ? 4.5 : 6
      if (b.fase >= 2) {
        // ringen
        b.ring -= dt
        if (b.ring <= 0) {
          b.ring = b.fase === 3 ? 1.6 : 2.6
          const n = 14, a0 = b.t * 0.7
          for (let i = 0; i < n; i++) this.kogel(kern.x, kern.y, 'orbO', Math.cos(a0 + i * Math.PI * 2 / n) * 115, Math.sin(a0 + i * Math.PI * 2 / n) * 115)
          GELUID.speel('vijandSchiet')
        }
        // laser: eerst een dun lijntje (richten), dan de straal
        b.laserKlok -= dt
        if (!b.laser && b.laserKlok <= 0) { b.laser = { t: 0, x: this.speler.x }; GELUID.speel('richt') }
        if (b.laser) {
          const L = b.laser; L.t += dt
          if (L.t > 0.9 && !L.vuur) { L.vuur = true; GELUID.speel('laser') }
          if (L.vuur) L.x += Phaser.Math.Clamp(this.speler.x - L.x, -42 * dt, 42 * dt)
          if (L.t > 2.3) { b.laser = null; b.laserKlok = b.fase === 3 ? 4 : 6 }
        }
        // hulpjes
        b.spawn -= dt
        if (b.spawn <= 0) { b.spawn = 9; for (let i = 0; i < 3; i++) this.maak('dart', { x: 60 + i * 120, fase: i, recht: false }) }
      }
    }
    laserStap() {
      const b = this.baas, g = this.fx
      g.clear()
      if (!b || !b.laser || b.sterft > 0) return
      const L = b.laser, kern = b.delen[2], top = kern.y + 16
      if (!L.vuur) {
        g.lineStyle(1, 0xff4848, 0.4 + 0.4 * Math.sin(L.t * 40)); g.lineBetween(L.x, top, L.x, H)
        return
      }
      const f = 0.85 + Math.random() * 0.15
      g.fillStyle(0xff3dd2, 0.25 * f); g.fillRect(L.x - 22, top, 44, H - top)
      g.fillStyle(0xff3dd2, 0.6 * f); g.fillRect(L.x - 12, top, 24, H - top)
      g.fillStyle(0xffffff, 0.95); g.fillRect(L.x - 4, top, 8, H - top)
      if (Math.abs(this.speler.x - L.x) < 15 && this.speler.y > top) this.geraakt()
    }
    baasSterft() {
      const b = this.baas
      b.sterft = 0.001; b.laser = null; b.dood = true; this.fx.clear()
      b.delen.forEach(d => { d.dood = true })
      this.tekenBaasBalkjes()
      for (const k of this.kogelsV) { this.weg(k.spr); k.dood = true }
      this.kogelsV = []
      GELUID.muziek(false)
      baasVak.hidden = true
      this.onraakbaar = 99
    }
    baasDoodStap(dt) {
      const b = this.baas
      if (b.weg) return
      b.sterft += dt
      b.x += (Math.random() - 0.5) * 3
      b.romp.setPosition(b.x, b.y)
      b.romp.setTint(Math.random() < 0.5 ? 0xffffff : 0xff9090)
      b.knal = (b.knal || 0) - dt
      if (b.knal <= 0 && b.sterft < 2.3) {
        b.knal = 0.15
        this.ontplof(b.x + (Math.random() - 0.5) * 220, b.y + (Math.random() - 0.5) * 90, 1.4 + Math.random(), ['#ff3dd2', '#ffd23c', '#ffffff', '#5ee7e0'])
      }
      if (b.sterft >= 2.3 && !b.weg) {
        b.weg = true
        this.ontplof(b.x, b.y, 6, ['#ffffff', '#ff3dd2', '#ffd23c', '#5ee7e0', '#ffa53c'])
        this.cameras.main.flash(500, 255, 255, 255)
        this.cameras.main.shake(700, 0.02)
        b.romp.destroy(); b.schaduw.destroy(); b.delen.forEach(d => { d.spr.destroy(); d.label.destroy() }); this.baasG.clear()
        this.punten(20000, b.x, b.y, true)
        this.time.delayedCall(2200, () => this.einde(true))
      }
    }

    /* ---- elke tik ---- */
    update(tijd, delta) {
      if (this.pauze || this.voorbij) return
      const dt = Math.min(delta, 50) / 1000 * this.tijdSchaal
      this.klok += dt
      if (!this.zuinig && this.klok > 5 && this.klok < 6 && this.game.loop.actualFps < 40) {
        this.zuinig = true; this.nevel.setVisible(false)   // trage telefoon: geen nevel en minder vonken
      }
      this.grondSnelheid = this.baas && this.baas.binnen ? 30 : 46
      this.grond.tilePositionY -= this.grondSnelheid * R * dt
      this.nevel.tilePositionY -= 95 * R * dt

      // golven
      while (!this.golfStop && this.golfNr < this.golven.length && this.golven[this.golfNr].t <= this.klok) this.golven[this.golfNr++].f(this)
      if (this.golfStop && !this.baas) {
        this.baasWacht += dt
        const lucht = this.vijanden.some(v => !v.dood && !v.grond)
        if (this.baasWacht > 6 || (!lucht && this.baasWacht > 1.5)) this.baasKomt()
      }

      // speler: toetsen
      const sp = this.speler
      const kx = toets.r - toets.l, ky = toets.n - toets.o
      if (kx || ky) this.duw(kx * 250 * dt / Math.max(0.3, this.tijdSchaal), ky * 250 * dt / Math.max(0.3, this.tijdSchaal))
      this.schaduw.setPosition(sp.x + 16, sp.y + 24)
      this.vlam.setTexture(Math.floor(tijd / 60) % 2 ? 'vlam0' : 'vlam1').setPosition(sp.x, sp.y + 19)
      if (this.onraakbaar > 0) { this.onraakbaar -= dt; sp.setAlpha(Math.floor(this.onraakbaar * 12) % 2 ? 0.35 : 1) } else sp.setAlpha(1)
      if (this.schild > 0) { this.schild -= dt; this.bel.setVisible(this.schild > 2 || Math.floor(this.schild * 8) % 2 === 0).setPosition(sp.x, sp.y).setRotation(tijd / 300) }
      else this.bel.setVisible(false)

      // schieten
      this.vuur(dt)

      // vijanden
      for (const v of this.vijanden) if (!v.dood && !this.vijandStap(v, dt)) this.ruimVijand(v)
      this.vijanden = this.vijanden.filter(v => !v.dood)
      this.baasStap(dt)

      // kogels van de speler
      const doelen = this.doelen()
      for (const k of this.kogelsS) {
        if (k.raket) {
          k.leeft += dt
          if (k.leeft > 0.12) {
            let best = null, bd = 1e9
            for (const d of doelen) { if (d.dood) continue; const dd = (d.x - k.x) ** 2 + (d.y - k.y) ** 2; if (dd < bd) { bd = dd; best = d } }
            const sn = 430, wens = best ? Math.atan2(best.y - k.y, best.x - k.x) : -Math.PI / 2
            let a = Math.atan2(k.vy, k.vx), verschil = Phaser.Math.Angle.Wrap(wens - a)
            a += Phaser.Math.Clamp(verschil, -7 * dt, 7 * dt)
            k.vx = Math.cos(a) * sn; k.vy = Math.sin(a) * sn
            k.spr.setRotation(a + Math.PI / 2)
            if (Math.random() < 0.6) this.vonken['#ffa53c'].explode(1, k.x, k.y)
          }
        }
        k.x += k.vx * dt; k.y += k.vy * dt
        k.spr.setPosition(k.x, k.y)
        if (k.y < -30 || k.x < -30 || k.x > W + 30 || k.y > H + 30 || (k.raket && k.leeft > 2.4)) { k.dood = true; continue }
        for (const d of doelen) {
          if (d.dood) continue
          const rr = d.r + k.r
          if ((d.x - k.x) ** 2 + (d.y - k.y) ** 2 < rr * rr) {
            this.raak(d, k.dmg)
            k.dood = true
            this.vonken[k.raket ? '#ffa53c' : this.wapen === 'spreid' ? '#ff5d9e' : '#5ee7e0'].explode(3, k.x, k.y)
            break
          }
        }
        // de romp van de baas houdt kogels tegen
        const b = this.baas
        if (!k.dood && b && b.binnen && !b.weg && Math.abs(k.x - b.x) < 132 && k.y < b.y + 10 && k.y > b.y - 52) {
          k.dood = true; this.vonken['#ffffff'].explode(2, k.x, k.y); GELUID.speel('ketsen')
        }
      }
      this.kogelsS = this.kogelsS.filter(k => { if (k.dood) this.weg(k.spr); return !k.dood })
      this.straalStap(dt)

      // kogels van de vijand
      const hit = 4
      for (const k of this.kogelsV) {
        k.x += k.vx * dt; k.y += k.vy * dt
        k.spr.setPosition(k.x, k.y)
        if (k.y < -30 || k.x < -30 || k.x > W + 30 || k.y > H + 30) { k.dood = true; continue }
        const dx = k.x - sp.x, dy = k.y - sp.y
        if (this.schild > 0 && dx * dx + dy * dy < 26 * 26) { k.dood = true; this.vonken['#7fd4ff'].explode(4, k.x, k.y); continue }
        if (dx * dx + dy * dy < (hit + k.r) * (hit + k.r)) { k.dood = true; this.geraakt(); break }
      }
      this.kogelsV = this.kogelsV.filter(k => { if (k.dood) this.weg(k.spr); return !k.dood })

      // botsen met vijanden in de lucht
      for (const v of this.vijanden) {
        if (v.dood || v.grond) continue
        const rr = v.r + (this.schild > 0 ? 20 : 8)
        if ((v.x - sp.x) ** 2 + (v.y - sp.y) ** 2 < rr * rr) {
          if (this.schild > 0) this.raak(v, 12)
          else if (this.onraakbaar <= 0) { this.raak(v, 10); this.geraakt() }
        }
      }
      this.laserStap()

      // buit
      for (const b of this.buit) {
        b.t += dt; b.y += 55 * dt; b.x += Math.sin(b.t * 3) * 20 * dt
        b.spr.setPosition(b.x, b.y).setScale((1 + Math.sin(b.t * 8) * 0.08) * SB)
        if ((b.x - sp.x) ** 2 + (b.y - sp.y) ** 2 < 30 * 30) { b.dood = true; this.pakBuit(b) }
        else if (b.y > H + 30) b.dood = true
      }
      this.buit = this.buit.filter(b => { if (b.dood) this.weg(b.spr); return !b.dood })

      // combo en score
      if (this.comboTijd > 0) { this.comboTijd -= dt; if (this.comboTijd <= 0) { this.combo = 1; comboVak.textContent = '' } }
      if (this.getoond < this.score) {
        this.getoond += Math.max(1, Math.ceil((this.score - this.getoond) * 0.2))
        if (this.getoond > this.score) this.getoond = this.score
        scoreVak.textContent = String(this.getoond).padStart(7, '0')
      }
    }

    /* ---- pauze (app op de achtergrond) ---- */
    pauzeer() {
      if (this.pauze || this.voorbij) return
      this.pauze = true
      GELUID.muziek(false); GELUID.straal(false); this.straalAan = false
      sluitArsenaal()
      bord(vertaal('GEPAUZEERD'), vertaal('Tik om verder te gaan'), '#5ee7e0', true)
      bordVak.className = 'bord vast'
    }
    hervat() {
      if (!this.pauze) return
      this.pauze = false
      bordVak.className = 'bord'
      GELUID.muziek(true, this.baas && this.baas.binnen ? 'baas' : 'level')
    }

    einde(gewonnen) {
      if (this.voorbij) return
      this.voorbij = true
      GELUID.muziek(false); GELUID.straal(false)
      sluitArsenaal()
      this.straalG.clear(); this.fx.clear()
      for (const k of this.kogelsS.concat(this.kogelsV)) this.weg(k.spr)
      this.kogelsS = []; this.kogelsV = []
      if (gewonnen) { this.score += this.levens * 5000; GELUID.speel('klaar') } else GELUID.speel('einde')
      scoreVak.textContent = String(this.score).padStart(7, '0')
      toonEinde(gewonnen, this.score, this.levens)
    }
  }

  /* ---------- schermen ---------- */
  function toonRecord() {
    const r = solo && typeof solo.record === 'function' ? solo.record() : 0
    recordVak.textContent = r ? vertaal('RECORD {n}', { n: String(r).padStart(7, '0') }) : ''
  }
  function toonEinde(gewonnen, score, levens) {
    const nieuw = solo && typeof solo.nieuweScore === 'function' ? solo.nieuweScore(score) : false
    h1.innerHTML = gewonnen ? 'LEVEL 1<span>' + vertaal('GEHAALD!') + '</span>' : 'GAME<span>OVER</span>'
    sub.textContent = 'SCORE ' + String(score).padStart(7, '0') + (nieuw ? ' · ' + vertaal('NIEUW RECORD!') : '')
    uitleg.textContent = gewonnen ? vertaal('TITAN is verslagen. Bonus voor je levens: {n}.', { n: levens * 5000 }) : vertaal('Je schip is neergeschoten.')
    uitleg2.textContent = gewonnen ? vertaal('De volgende levels komen binnenkort.') : vertaal('De tegel linksboven: wapen wisselen of een power-up gebruiken.') + toetsUitleg
    toonRecord()
    startKnop.textContent = vertaal('OPNIEUW')
    laag.hidden = false
    try { startKnop.focus({ preventScroll: true }) } catch (e) {}
  }
  const toonAuto = () => { autoKnop.textContent = autovuur ? vertaal('AUTOVUUR: AAN') : vertaal('AUTOVUUR: UIT') }
  const toonGeluid = () => { geluidKnop.textContent = GELUID.staatAan() ? vertaal('GELUID: AAN') : vertaal('GELUID: UIT') }
  const aanraak = window.matchMedia && window.matchMedia('(pointer:coarse)').matches
  const toetsUitleg = aanraak ? '' : ' ' + vertaal('Toetsen: pijltjes = vliegen, spatie = schieten, Q = tegel.')
  uitleg2.textContent += toetsUitleg
  toonAuto(); toonGeluid(); toonRecord(); werkTegelBij()
  autoKnop.addEventListener('click', e => { e.stopPropagation(); autovuur = !autovuur; try { localStorage.setItem('nr-autovuur', autovuur ? 'aan' : 'uit') } catch (x) {} toonAuto() })
  geluidKnop.addEventListener('click', e => { e.stopPropagation(); GELUID.zet(!GELUID.staatAan()); toonGeluid() })

  let aftellen = false
  function startRonde() {
    if (aftellen) return
    GELUID.wek()
    aftellen = true
    indeling()
    H = Math.round(Math.min(800, Math.max(560, W * veld.clientHeight / Math.max(1, veld.clientWidth))) / 2) * 2
    R = window.__nrScherpte || ((window.devicePixelRatio || 1) >= 1.5 ? 2 : 1); SB = 1 / R
    h1.innerHTML = 'NEON<span>RAIDERS</span>'
    let n = 3
    const stap = () => {
      if (!isActief() || !wrap.isConnected) return
      if (n === 0) {
        GELUID.speel('go'); aftellen = false
        laag.hidden = true
        vingers.clear()
        huidige = null
        if (spel) { try { spel.destroy(true) } catch (e) {} spel = null }
        spel = new Phaser.Game({
          type: Phaser.AUTO, width: W * R, height: H * R, parent: veld,
          antialias: true, backgroundColor: '#07051a',
          input: { activePointers: 4, keyboard: false, mouse: false, touch: false },
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          scene: [Spel]
        })
        GELUID.muziek(true, 'level')
        return
      }
      sub.textContent = String(n)
      GELUID.speel('tel')
      n--; setTimeout(stap, 600)
    }
    stap()
  }
  startKnop.addEventListener('click', e => { e.stopPropagation(); startRonde() })

  const zichtbaarheid = () => { if (document.hidden && huidige) huidige.pauzeer() }
  document.addEventListener('visibilitychange', zichtbaarheid)
  const wekGeluid = () => GELUID.wek()
  wrap.addEventListener('pointerdown', wekGeluid)

  /* ---------- opruimen zodra het spel gesloten wordt ---------- */
  const waker = setInterval(() => {
    if (isActief() && wrap.isConnected) return
    clearInterval(waker)
    clearTimeout(arsenaalKlok)
    GELUID.stop()
    window.removeEventListener('keydown', toetsNeer)
    window.removeEventListener('keyup', toetsOp)
    window.removeEventListener('resize', indeling)
    window.removeEventListener('orientationchange', indeling)
    document.removeEventListener('visibilitychange', zichtbaarheid)
    huidige = null
    if (spel) { try { spel.destroy(true) } catch (e) {} spel = null }
    if (wrap.isConnected) wrap.remove()
  }, 300)

  return { _proef: { scene: () => huidige, spel: () => spel, start: startRonde } }
}
