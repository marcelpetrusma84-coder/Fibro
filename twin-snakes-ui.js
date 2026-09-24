/* Twin Snakes (vakje Pinball) — als spel in de Fibro-chat.
   Zelfde opbouw als ecto-ui.js (Ghost Tag), pong-ui.js en runner-gunner-ui.js:
   één ingang, start(), die zichzelf in #spelInhoud tekent en zichzelf
   opruimt zodra het spel gesloten wordt.

   v1: eerste versie.
   - Twee slangen op één veld. Een appel geeft een punt en maakt je twee
     stukjes langer.
   - Je gaat dood tegen de rand, een muur, jezelf of de andere slang. Wie
     overblijft wint de ronde; gaan jullie vrijwel tegelijk dood, dan is het
     gelijkspel. De stand (gewonnen rondes) telt door.
   - Zes velden; elke ronde het volgende level. Na level 6 komen de velden
     terug, maar sneller (level 7, 8, ...). Elk veld is puntsymmetrisch en
     jullie beginnen gespiegeld, dus niemand heeft een makkelijkere kant.
   - Vegen op de telefoon, pijltjes (of WASD) op de pc. Twee snelle vegen na
     elkaar tellen allebei, zodat een U-bocht lukt.
   - Samen spelen over het spelkanaal, net als Ghost Tag: elke telefoon stuurt
     zijn eigen slang, zodat bochten meteen reageren. De uitnodiger
     (benIkSpeler1) is de baas: hij start de ronde, legt de appel neer,
     beslist wie hem had en geeft de uitslag. Zonder spelkanaal speel je
     tegen de computer.
*/

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
const KLANK_HZ = 22050

const KOLOM = 20, RIJEN = 28
const T = 14                      // één tegel, in beeldpunten van het spel
const HUD = 34                    // balk bovenin met de stand
const W = KOLOM * T, H = HUD + RIJEN * T

const CFG = {
  startLengte: 4,
  groei: 2,           // stukjes erbij per appel
  tempoBasis: 6.5,    // stappen per seconde in level 1
  tempoLevel: 0.45,   // erbij per level
  tempoRondje: 1.5,   // erbij per keer dat alle velden geweest zijn
  tempoTijd: 0.03,    // erbij per seconde dat de ronde duurt
  tempoMax: 13,
  gelijkVenster: 0.35, // zo kort na elkaar dood = gelijkspel (seconden)
  aftelTijd: 3,
  weg: 5,             // zoveel seconden niets van de ander: ronde stopt
  maxVooruit: 1,      // hooguit zoveel stappen schatten we de slang van de ander vooruit
  aiFout: 0.06,       // kans dat de computer net niet de beste keus maakt
}

const KLEUR = ['#5ff4ff', '#ff6bd6']
const APPEL = '#ff3b4e'
const BLAD = '#7dff6a'
const DONKER = '#07030f'
const RICHT = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }
const TEGEN = { L: 'R', R: 'L', U: 'D', D: 'U' }
const BUREN = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// Elk veld: een naam, een kleur en muurtjes als [x, y, breed, hoog]. Van elk
// muurtje komt vanzelf een kopie aan de overkant (180° gedraaid), zodat het
// veld voor allebei precies even moeilijk is. 'start' is de richting waarin
// de slang van de uitnodiger begint (standaard omhoog).
const LEVELS = [
  { naam: 'OPEN VELD', kleur: '#b44dff', muren: [] },
  { naam: 'BLOKJES', kleur: '#3d7bff', muren: [[4, 7, 2, 2], [14, 7, 2, 2], [9, 3, 2, 2], [9, 13, 2, 2]] },
  { naam: 'MIDDENMUUR', kleur: '#ffd23d', muren: [[3, 13, 6, 2]] },
  { naam: 'KAMERS', kleur: '#7dff6a', muren: [[9, 3, 2, 8], [2, 13, 6, 2]] },
  { naam: 'ZIGZAG', kleur: '#ff8a3d', start: 'R', muren: [[0, 6, 13, 1], [7, 11, 13, 1]] },
  { naam: 'DOOLHOF', kleur: '#e8f0ff', muren: [[6, 4, 8, 1], [2, 8, 1, 5], [17, 8, 1, 5], [6, 9, 3, 1], [11, 9, 3, 1], [8, 13, 4, 2]] },
]

// ═══════════════ Hulpjes zonder spelstand ═══════════════
const idx = (x, y) => y * KOLOM + x
const binnen = (x, y) => x >= 0 && y >= 0 && x < KOLOM && y < RIJEN
const spiegel = ([x, y]) => [KOLOM - 1 - x, RIJEN - 1 - y]
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})` }
function meng(h1, h2, t) {
  const a = hexRgb(h1), b = hexRgb(h2)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// Alle muurblokken van een veld, met hun gespiegelde kopie erbij.
function muurBlokken(lv) {
  const uit = []
  for (const [x, y, w, h] of LEVELS[lv].muren) {
    uit.push([x, y, w, h])
    const m = [KOLOM - x - w, RIJEN - y - h, w, h]
    if (m[0] !== x || m[1] !== y) uit.push(m)
  }
  return uit
}

function bouwMuren(lv) {
  const m = new Uint8Array(KOLOM * RIJEN)
  for (const [x0, y0, w, h] of muurBlokken(lv)) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (binnen(x, y)) m[idx(x, y)] = 1
  }
  return m
}

// Beginplek: de uitnodiger linksonder, de genodigde precies gespiegeld rechtsboven.
function startSlang(lv, i) {
  const d0 = LEVELS[lv].start || 'U'
  const [dx, dy] = RICHT[d0]
  const lijf = []
  for (let n = 0; n < CFG.startLengte; n++) lijf.push([3 - dx * n, 23 - dy * n])
  if (i === 0) return { lijf, dir: d0 }
  return { lijf: lijf.map(spiegel), dir: TEGEN[d0] }
}

// Afstand (in stappen) van (x0,y0) naar elk vakje, om muren en slangen heen.
function afstanden(rooster, x0, y0) {
  const d = new Int16Array(KOLOM * RIJEN).fill(-1)
  const rij = new Int16Array(KOLOM * RIJEN)
  let kop = 0, eind = 0
  d[idx(x0, y0)] = 0; rij[eind++] = idx(x0, y0)
  while (kop < eind) {
    const i = rij[kop++], x = i % KOLOM, y = (i / KOLOM) | 0
    for (const [dx, dy] of BUREN) {
      const nx = x + dx, ny = y + dy
      if (!binnen(nx, ny)) continue
      const j = idx(nx, ny)
      if (d[j] >= 0 || rooster[j]) continue
      d[j] = d[i] + 1; rij[eind++] = j
    }
  }
  return d
}

// Hoeveel vrije vakjes zijn er vanaf (x0,y0) te bereiken (hooguit max)?
function ruimteVanaf(rooster, x0, y0, max) {
  const gezien = new Uint8Array(KOLOM * RIJEN)
  const rij = [idx(x0, y0)]
  gezien[rij[0]] = 1
  let n = 0
  while (rij.length && n < max) {
    const i = rij.pop(); n++
    const x = i % KOLOM, y = (i / KOLOM) | 0
    for (const [dx, dy] of BUREN) {
      const nx = x + dx, ny = y + dy
      if (!binnen(nx, ny)) continue
      const j = idx(nx, ny)
      if (gezien[j] || rooster[j]) continue
      gezien[j] = 1; rij.push(j)
    }
  }
  return n
}

// ═══════════════ Geluid, uitgerekend ═══════════════
function golf(vorm, fase) {
  const f = fase - Math.floor(fase)
  if (vorm === 'square') return f < 0.5 ? 1 : -1
  if (vorm === 'sawtooth') return 2 * f - 1
  if (vorm === 'triangle') return 4 * Math.abs(f - 0.5) - 1
  return Math.sin(2 * Math.PI * f)
}

// Eén toon: van -> naar in toonhoogte, met een korte aanzet en uitsterven.
function toonGolf(o) {
  const n = Math.max(1, Math.round(o.duur * KLANK_HZ))
  const uit = new Float32Array(n)
  const vorm = o.vorm || 'square', vol = o.vol == null ? 0.3 : o.vol
  const naar = o.naar || o.van
  let fase = 0
  for (let i = 0; i < n; i++) {
    const t = i / KLANK_HZ, deel = t / o.duur
    const hz = o.van * Math.pow(naar / o.van, deel)
    fase += hz / KLANK_HZ
    const aanzet = Math.min(1, t / 0.004)
    const eind = Math.min(1, (o.duur - t) / 0.01)
    uit[i] = golf(vorm, fase) * vol * Math.exp(-3.2 * deel) * aanzet * Math.max(0, eind)
  }
  return uit
}

// Een doffe klap: ruis door een eenvoudig filter, snel weg.
function ruisGolf(duur, vol) {
  const n = Math.max(1, Math.round(duur * KLANK_HZ))
  const uit = new Float32Array(n)
  let laag = 0, zaad = 12345
  for (let i = 0; i < n; i++) {
    zaad = (zaad * 16807) % 2147483647
    laag += 0.22 * ((zaad / 2147483647) * 2 - 1 - laag)
    uit[i] = laag * vol * Math.exp(-5 * i / n)
  }
  return uit
}

function mengGolf(delen) {
  let lengte = 0
  for (const d of delen) lengte = Math.max(lengte, Math.round((d.na || 0) * KLANK_HZ) + d.golf.length)
  const uit = new Float32Array(lengte)
  for (const d of delen) {
    const start = Math.round((d.na || 0) * KLANK_HZ)
    for (let i = 0; i < d.golf.length; i++) uit[start + i] += d.golf[i]
  }
  for (let i = 0; i < uit.length; i++) uit[i] = Math.max(-1, Math.min(1, uit[i]))
  return uit
}

function wavAdres(golfje) {
  const n = golfje.length
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf)
  const zet = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  zet(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); zet(8, 'WAVEfmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, KLANK_HZ, true); dv.setUint32(28, KLANK_HZ * 2, true)
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  zet(36, 'data'); dv.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, golfje[i])) * 32767, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

function zetStijl() {
  if (!document.querySelector('link[href*="Press+Start+2P"]')) {
    const l = document.createElement('link')
    l.id = 'tsnk-font'; l.rel = 'stylesheet'; l.href = FONT_URL
    document.head.appendChild(l)
  }
  if (document.getElementById('tsnk-stijl')) return
  const st = document.createElement('style')
  st.id = 'tsnk-stijl'
  st.textContent = `
  .tsnk{--muur:#b44dff;--kop:#5ff4ff;--tekst:#e9ddff;--paneel:rgba(20,10,38,.92);
    position:absolute;inset:0;padding:40px 2px 2px;box-sizing:border-box;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:#07030f;color:var(--tekst);font-family:"Press Start 2P",monospace;
    touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
  .tsnk *{box-sizing:border-box}
  .tsnk .veld{position:relative;flex:1 1 auto;width:100%;min-height:0;display:flex;align-items:center;justify-content:center}
  .tsnk .scherm{position:relative}
  .tsnk canvas.doek{display:block;border-radius:6px;box-shadow:0 0 24px rgba(95,244,255,.22);position:relative;z-index:0}
  .tsnk .scherm::after{content:"";position:absolute;inset:0;border-radius:6px;pointer-events:none;z-index:1;
    background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.12) 2px 3px),
      radial-gradient(ellipse at center,rgba(0,0,0,0) 62%,rgba(0,0,0,.4) 100%)}
  .tsnk .laag{position:absolute;left:0;right:0;bottom:5%;z-index:2;display:flex;
    justify-content:center;align-items:center;gap:12px}
  .tsnk .laag[hidden],.tsnk .knop[hidden]{display:none}
  .tsnk .knop{font-family:inherit;font-size:17px;color:var(--tekst);background:var(--paneel);
    border:2px solid var(--muur);border-radius:12px;min-width:46px;height:46px;padding:0 10px;
    box-shadow:0 0 12px var(--muur);cursor:pointer;touch-action:manipulation}
  .tsnk .knop.groot{width:60px;height:60px;border-radius:50%;font-size:24px;padding:0;
    color:var(--kop);border-color:var(--kop);box-shadow:0 0 18px rgba(95,244,255,.55)}
  .tsnk .knop:active{transform:scale(.94)}
  .tsnk .knop:disabled{opacity:.35;box-shadow:none;cursor:default}
  .tsnk .fout{font-size:10px;line-height:2;text-align:center;color:#ff9db5}
  `
  document.head.appendChild(st)
}

// ═══════════════════════════════════════════════════════
export async function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (!inhoud) return
  if (titel) titel.textContent = '🐍 Twin Snakes'
  if (getComputedStyle(inhoud).position === 'static') inhoud.style.position = 'relative'
  zetStijl()

  const wrap = document.createElement('div')
  wrap.className = 'tsnk'
  wrap.innerHTML = `
    <div class="veld">
      <div class="scherm">
        <canvas class="doek"></canvas>
        <div class="laag startLaag">
          <button class="knop groot kSpeel" type="button" aria-label="Start">▶</button>
          <button class="knop kGeluid" type="button" aria-label="Geluid">🔊</button>
        </div>
        <div class="laag eindLaag" hidden>
          <button class="knop groot kOpnieuw" type="button" aria-label="Volgende ronde">↻</button>
        </div>
      </div>
    </div>`
  inhoud.appendChild(wrap)

  const scherm = wrap.querySelector('.scherm')
  const doek = wrap.querySelector('canvas.doek')
  const ctx = doek.getContext('2d')
  const startLaag = wrap.querySelector('.startLaag')
  const eindLaag = wrap.querySelector('.eindLaag')
  if (!ctx) { wrap.innerHTML = '<p class="fout">Dit toestel kan het spel niet tekenen.</p>'; return }

  // ═══════════════ Spelstand ═══════════════
  // Samen spelen: wie ben ik, en wie beslist er
  const kanaalOk = !!(spelKanaal && typeof spelKanaal.on === 'function' && typeof spelKanaal.send === 'function')
  const leider = !!benIkSpeler1 || !kanaalOk
  const ik = leider ? 0 : 1, ander = 1 - ik
  const NAAM = String(vriendNaam || 'je vriend').toUpperCase().slice(0, 12)
  const tegenNaam = kanaalOk ? NAAM : 'COMPUTER'
  const aiAan = [false, !kanaalOk]

  let staat = 'start', aftel = 0, laatsteTel = 4, tijd = 0, eindTijd = 0, rondeTijd = 0
  let rondeNr = 0, lv = 0, rondje = 0
  let muren = bouwMuren(0)
  let slangen = []
  let appel = null, appelTeller = 0
  let appels = [0, 0], winst = [0, 0], uitslag = null
  let stapKlok = 0, stapNr = 0
  let eindeOp = null                 // leider: na mijn eigen dood nog even wachten
  let doodTijd = [null, null]
  let laatsteVanAnder = -Infinity    // tijd van het laatste bericht van de ander
  let tsKlok = 0, klaarKlok = 0, laatsteTs = -Infinity, laatsteDir = null, nuSturen = false
  let gegetenAppel = -1, gemeldeHap = null, laatsteN = -1
  // Hoe lang een bericht onderweg is (seconden, geschat), en wat we nodig
  // hebben om dat te meten: de klok van de ander in zijn laatste bericht.
  let onderweg = null, hunKlok = null, hunKlokOp = 0
  let deeltjes = [], schud = 0, flits = 0
  let geluidAan = true, draait = true

  // ═══════════════ Geluid ═══════════════
  // Alle fragmenten worden één keer uitgerekend en daarna via <audio> gespeeld.
  // Elk geluidje heeft een paar kopieën, zodat ze over elkaar heen kunnen.
  const geluid = {
    klanken: {}, adressen: [], ontgrendeld: false, kan: false,
    bouw() {
      if (typeof Audio === 'undefined' || !window.URL || !URL.createObjectURL) return
      const maak = (naam, golfje, aantal, vol) => {
        const adres = wavAdres(golfje)
        this.adressen.push(adres)
        const els = []
        for (let n = 0; n < aantal; n++) {
          const a = new Audio(adres)
          a.preload = 'auto'; a.volume = vol
          els.push(a)
        }
        this.klanken[naam] = { els, i: 0 }
      }
      try {
        maak('hap0', mengGolf([
          { golf: toonGolf({ van: 660, naar: 990, duur: 0.06, vorm: 'square', vol: 0.28 }) },
          { golf: toonGolf({ van: 990, naar: 1320, duur: 0.07, vorm: 'square', vol: 0.24 }), na: 0.05 },
        ]), 3, 0.55)
        maak('hap1', mengGolf([
          { golf: toonGolf({ van: 520, naar: 780, duur: 0.06, vorm: 'square', vol: 0.28 }) },
          { golf: toonGolf({ van: 780, naar: 1040, duur: 0.07, vorm: 'square', vol: 0.24 }), na: 0.05 },
        ]), 3, 0.55)
        maak('bots', mengGolf([
          { golf: ruisGolf(0.35, 0.9) },
          { golf: toonGolf({ van: 240, naar: 50, duur: 0.4, vorm: 'sawtooth', vol: 0.35 }) },
        ]), 2, 0.85)
        maak('winst', mengGolf([523, 659, 784, 1047, 784, 1047].map((f, n) => (
          { golf: toonGolf({ van: f, duur: 0.16, vorm: 'square', vol: 0.24 }), na: n * 0.11 }
        ))), 1, 0.8)
        maak('uit', mengGolf([523, 392, 330, 262, 196].map((f, n) => (
          { golf: toonGolf({ van: f, duur: 0.2, vorm: 'triangle', vol: 0.3 }), na: n * 0.15 }
        ))), 1, 0.8)
        maak('gelijk', mengGolf([440, 440].map((f, n) => (
          { golf: toonGolf({ van: f, duur: 0.18, vorm: 'triangle', vol: 0.3 }), na: n * 0.22 }
        ))), 1, 0.8)
        maak('telLaag', toonGolf({ van: 440, duur: 0.12, vorm: 'square', vol: 0.26 }), 2, 0.7)
        maak('telHoog', toonGolf({ van: 880, duur: 0.3, vorm: 'square', vol: 0.26 }), 2, 0.7)
        this.kan = true
      } catch (e) { console.warn('[twin-snakes] geluid kon niet gebouwd worden', e) }
    },
    // Moet tijdens een echte tik gebeuren, anders blijft geluid op slot (iPhone).
    ontgrendel() {
      if (this.ontgrendeld || !this.kan) return
      this.ontgrendeld = true
      for (const naam in this.klanken) {
        for (const a of this.klanken[naam].els) {
          try {
            const p = a.play()
            const rust = () => { try { a.pause(); a.currentTime = 0 } catch (e) {} }
            if (p && p.then) p.then(rust).catch(() => {}); else rust()
          } catch (e) {}
        }
      }
    },
    speel(naam) {
      if (!geluidAan || !this.kan) return
      const k = this.klanken[naam]
      if (!k) return
      const a = k.els[k.i++ % k.els.length]
      try {
        a.currentTime = 0
        const p = a.play()
        if (p && p.catch) p.catch(() => {})
      } catch (e) {}
    },
    init() { this.ontgrendel() },
    hap(i) { this.speel(i ? 'hap1' : 'hap0') },
    bots() { this.speel('bots') },
    winst() { this.speel('winst') },
    uit() { this.speel('uit') },
    gelijk() { this.speel('gelijk') },
    aftel(n) { this.speel(n ? 'telLaag' : 'telHoog') },
    sluit() {
      for (const naam in this.klanken) for (const a of this.klanken[naam].els) { try { a.pause(); a.src = '' } catch (e) {} }
      for (const adres of this.adressen) { try { URL.revokeObjectURL(adres) } catch (e) {} }
      this.adressen = []; this.klanken = {}; this.kan = false
    },
  }
  geluid.bouw()

  // ═══════════════ Opzetten ═══════════════
  function maakSlang(i) {
    const st = startSlang(lv, i)
    return {
      i, kleur: KLEUR[i], lijf: st.lijf, dir: st.dir, wacht: [], groei: 0,
      oudeStaart: null, dood: false, doodFlits: 0, n: 0, remote: kanaalOk && i === ander,
    }
  }

  function reset() {
    const r = Math.max(1, rondeNr)
    lv = (r - 1) % LEVELS.length
    rondje = Math.floor((r - 1) / LEVELS.length)
    muren = bouwMuren(lv)
    slangen = [maakSlang(0), maakSlang(1)]
    appel = null; appels = [0, 0]; uitslag = null
    stapKlok = 0; stapNr = 0; rondeTijd = 0; eindeOp = null; doodTijd = [null, null]
    gegetenAppel = -1; gemeldeHap = null; laatsteN = -1
    deeltjes = []; schud = 0; flits = 0
    wrap.style.setProperty('--muur', LEVELS[lv].kleur)
  }

  const levelNummer = () => lv + 1 + rondje * LEVELS.length

  function tempo() {
    return Math.min(CFG.tempoMax,
      CFG.tempoBasis + CFG.tempoLevel * lv + CFG.tempoRondje * rondje + CFG.tempoTijd * rondeTijd)
  }

  // Muren en slangen in één rooster. Met zonderStaart tellen staarten die deze
  // stap wegschuiven niet mee: daar mag je net achteraan kruipen.
  function rooster(zonderStaart) {
    const g = muren.slice()
    for (const s of slangen) {
      const n = s.lijf.length - (zonderStaart && !s.dood && s.groei === 0 ? 1 : 0)
      for (let k = 0; k < n; k++) { const [x, y] = s.lijf[k]; g[idx(x, y)] = 1 }
    }
    return g
  }

  function bezet(x, y, zonderStaart) {
    if (!binnen(x, y) || muren[idx(x, y)]) return true
    for (const s of slangen) {
      const n = s.lijf.length - (zonderStaart && !s.dood && s.groei === 0 ? 1 : 0)
      for (let k = 0; k < n; k++) if (s.lijf[k][0] === x && s.lijf[k][1] === y) return true
    }
    return false
  }

  // ═══════════════ Spelregels ═══════════════
  function nieuwKop(s) { const [dx, dy] = RICHT[s.dir]; return [s.lijf[0][0] + dx, s.lijf[0][1] + dy] }

  function volgendeRichting(s) {
    while (s.wacht.length) {
      const r = s.wacht.shift()
      if (r !== s.dir && r !== TEGEN[s.dir]) { s.dir = r; return }
    }
  }

  function schuif(s, kop) {
    s.lijf.unshift(kop)
    if (s.groei > 0) { s.groei--; s.oudeStaart = null } else s.oudeStaart = s.lijf.pop()
    s.n++
  }

  // Eén stap voor alle slangen die op dit toestel lopen (bij samen spelen
  // alleen de mijne; tegen de computer allebei, tegelijk).
  function stap() {
    stapNr++
    const lokaal = slangen.filter(s => !s.dood && !s.remote)
    for (const s of lokaal) { if (aiAan[s.i]) aiKies(s); volgendeRichting(s) }
    const koppen = lokaal.map(nieuwKop)
    const sterft = koppen.map(([x, y]) => bezet(x, y, true))
    if (lokaal.length === 2 && koppen[0][0] === koppen[1][0] && koppen[0][1] === koppen[1][1]) sterft[0] = sterft[1] = true
    lokaal.forEach((s, k) => { if (!sterft[k]) schuif(s, koppen[k]) })
    lokaal.forEach((s, k) => { if (sterft[k]) sterf(s, true) })
    if (leider && sterft.some(Boolean)) besluit()     // pas als alle botsingen van deze stap bekend zijn
    for (const s of lokaal) eetAppel(s)
    // De slang van de ander loopt tussen twee berichten vanzelf verder.
    for (const s of slangen) if (s.remote) schat(s)
  }

  function sterf(s, laterBeslissen) {
    if (s.dood) return
    s.dood = true; s.doodFlits = 1.2; s.oudeStaart = null; s.wacht.length = 0
    doodTijd[s.i] = tijd
    const [x, y] = s.lijf[0]
    spetter((x + 0.5) * T, HUD + (y + 0.5) * T, s.kleur, 30, 80, 0.7, 2)
    schud = 0.35; flits = 0.18
    geluid.bots()
    if (s.i === ik) nuSturen = true
    if (leider && !laterBeslissen) besluit()
  }

  // Alleen de uitnodiger (of tegen de computer): is de ronde voorbij?
  function besluit() {
    if (staat !== 'spel') return
    const d0 = slangen[0].dood, d1 = slangen[1].dood
    if (d0 && d1) {
      const verschil = doodTijd[0] - doodTijd[1]
      naarEinde(Math.abs(verschil) <= CFG.gelijkVenster ? -1 : (verschil < 0 ? 1 : 0))
      return
    }
    if (!d0 && !d1) return
    const dode = d0 ? 0 : 1
    // Ik ben zelf dood: nog even wachten of de ander tegelijk dood ging.
    if (kanaalOk && dode === ik) { if (eindeOp === null) eindeOp = tijd + CFG.gelijkVenster; return }
    naarEinde(1 - dode)
  }

  function eetAppel(s) {
    if (!appel || s.dood) return
    if (s.lijf[0][0] !== appel.x || s.lijf[0][1] !== appel.y) return
    s.groei += CFG.groei
    spetter((appel.x + 0.5) * T, HUD + (appel.y + 0.5) * T, APPEL, 14, 55, 0.5, 1.5)
    geluid.hap(s.i)
    if (leider) {
      appels[s.i]++
      plaatsAppel()
    } else {
      // Meteen melden (in het volgende ts-bericht, en de anderhalve seconde
      // daarna in elk ts-bericht opnieuw, voor het geval er een wegvalt).
      gegetenAppel = appel.id
      gemeldeHap = { id: appel.id, tot: tijd + 1.5 }
      appel = null     // tot de uitnodiger een nieuwe neerlegt
    }
    if (s.i === ik) nuSturen = true
  }

  function plaatsAppel() {
    const g = rooster(false)
    const vrij = []
    for (let y = 0; y < RIJEN; y++) for (let x = 0; x < KOLOM; x++) {
      if (g[idx(x, y)]) continue
      // niet pal voor iemands kop
      if (slangen.some(s => !s.dood && Math.abs(s.lijf[0][0] - x) + Math.abs(s.lijf[0][1] - y) < 3)) continue
      vrij.push([x, y])
    }
    if (!vrij.length) { appel = null; return }
    const [x, y] = vrij[Math.floor(Math.random() * vrij.length)]
    appel = { id: ++appelTeller, x, y, sinds: tijd }
    nuSturen = true
  }

  // De eerste appel van een ronde ligt voor allebei even ver weg.
  function plaatsEersteAppel() {
    const g = rooster(false)
    const a = afstanden(g, ...slangen[0].lijf[0]), b = afstanden(g, ...slangen[1].lijf[0])
    const kan = []
    for (let i = 0; i < a.length; i++) if (!g[i] && a[i] >= 6 && a[i] === b[i]) kan.push(i)
    if (!kan.length) { plaatsAppel(); return }
    const i = kan[Math.floor(Math.random() * kan.length)]
    appel = { id: ++appelTeller, x: i % KOLOM, y: (i / KOLOM) | 0, sinds: tijd }
  }

  // ═══════════════ De computer ═══════════════
  // Kiest de kant met genoeg ruimte die het dichtst bij de appel komt, en
  // blijft liever niet pal naast de kop van de ander.
  function aiKies(s) {
    const g = rooster(true)
    const naarAppel = appel ? afstanden(g, appel.x, appel.y) : null
    const tegen = slangen[1 - s.i]
    const genoeg = s.lijf.length + 3
    const [hx, hy] = s.lijf[0]
    const kandidaten = []
    for (const r of ['U', 'D', 'L', 'R']) {
      if (r === TEGEN[s.dir]) continue
      const x = hx + RICHT[r][0], y = hy + RICHT[r][1]
      if (!binnen(x, y) || g[idx(x, y)]) continue
      const ruimte = ruimteVanaf(g, x, y, genoeg)
      const naastKop = !tegen.dood && Math.abs(tegen.lijf[0][0] - x) + Math.abs(tegen.lijf[0][1] - y) === 1
      let afstand = naarAppel ? naarAppel[idx(x, y)] : 0
      if (afstand < 0) afstand = 999
      kandidaten.push({ r, ruimte, naastKop, afstand, rechtdoor: r === s.dir })
    }
    if (!kandidaten.length) return
    kandidaten.sort((a, b) => {
      const ga = a.ruimte >= genoeg, gb = b.ruimte >= genoeg
      if (ga !== gb) return ga ? -1 : 1
      if (!ga) return b.ruimte - a.ruimte
      if (a.naastKop !== b.naastKop) return a.naastKop ? 1 : -1
      if (a.afstand !== b.afstand) return a.afstand - b.afstand
      return a.rechtdoor === b.rechtdoor ? 0 : (a.rechtdoor ? -1 : 1)
    })
    let keuze = kandidaten[0]
    if (kandidaten.length > 1 && kandidaten[1].ruimte >= genoeg && Math.random() < CFG.aiFout) keuze = kandidaten[1]
    s.wacht.length = 0
    if (keuze.r !== s.dir) s.wacht.push(keuze.r)
  }

  // ═══════════════ Rondes ═══════════════
  function startRonde(r) {
    geluid.init()
    rondeNr = Number.isInteger(r) ? r : rondeNr + 1
    reset()
    staat = 'aftellen'; aftel = CFG.aftelTijd; laatsteTel = 4
    if (leider) plaatsEersteAppel()
    nuSturen = true
  }

  // uitslag: 0 of 1 = die speler wint, -1 = gelijkspel, -2 = ronde gestopt
  function naarEinde(u) {
    if (staat === 'einde') return
    staat = 'einde'; eindTijd = 0; uitslag = u; eindeOp = null
    if (leider && (u === 0 || u === 1)) winst[u]++
    if (u === ik) geluid.winst()
    else if (u === ander) geluid.uit()
    else if (u === -1) geluid.gelijk()
    if (leider && kanaalOk) {
      const r = rondeNr
      ;[0, 250, 500].forEach(ms => setTimeout(() => { if (rondeNr === r) stuurEinde() }, ms))
    }
  }

  // De uitnodiger start de ronde, voor allebei tegelijk.
  function leiderStart() {
    if (!leider) return
    if (!(staat === 'start' || (staat === 'einde' && eindTijd > 0.7))) return
    if (kanaalOk && !anderIsEr()) return
    startRonde()
    if (kanaalOk) {
      const r = rondeNr
      ;[0, 250, 500].forEach(ms => setTimeout(() => { if (rondeNr === r) stuur('ts-start', { r }) }, ms))
    }
  }

  function update(dt) {
    tijd += dt
    if (staat === 'aftellen') {
      aftel -= dt
      const tel = Math.ceil(aftel)
      if (tel !== laatsteTel && tel > 0) { laatsteTel = tel; geluid.aftel(1) }
      if (aftel <= 0) { staat = 'spel'; stapKlok = 0; geluid.aftel(0) }
    } else if (staat === 'spel') {
      rondeTijd += dt
      stapKlok += dt * tempo()
      let n = 0
      while (stapKlok >= 1 && staat === 'spel' && n++ < 4) { stapKlok -= 1; stap() }
      if (stapKlok >= 1) stapKlok = 0.999
      if (eindeOp !== null && tijd >= eindeOp && staat === 'spel') naarEinde(ander)
    } else if (staat === 'einde') eindTijd += dt

    for (const s of slangen) if (s.doodFlits > 0) s.doodFlits = Math.max(0, s.doodFlits - dt)
    for (const d of deeltjes) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.94; d.vy *= 0.94; d.t -= dt }
    if (deeltjes.length) deeltjes = deeltjes.filter(d => d.t > 0)
    schud = Math.max(0, schud - dt)
    flits = Math.max(0, flits - dt)

    netwerk(dt)
    werkKnoppen()
  }

  // ═══════════════ Samen spelen: berichten ═══════════════
  // ts        mijn slang: stapnummer, kop + de rest als richtingen, richting,
  //           groei, dood; bij de uitnodiger ook appel, appels en stand;
  //           bij de genodigde de appel die hij net at (anderhalve seconde lang)
  // ts-start  uitnodiger → genodigde: ronde r begint (3× verstuurd)
  // ts-einde  uitnodiger → genodigde: uitslag van ronde r (3× verstuurd)
  // ts-klaar  allebei, buiten een ronde: ik ben er, en zo staat het
  function anderIsEr() { return tijd - laatsteVanAnder < 3 }

  function stuur(event, payload) {
    if (!kanaalOk || !draait || (isActief && !isActief())) return
    payload.w = ik
    try {
      const p = spelKanaal.send({ type: 'broadcast', event, payload })
      if (p && p.catch) p.catch(() => {})
    } catch (e) {}
  }

  const rond3 = v => Math.round(v * 1000) / 1000

  // Heen en terug min de tijd dat het bij de ander bleef liggen, gedeeld door twee.
  function meetOnderweg(p) {
    if (Number.isFinite(p.t)) { hunKlok = p.t; hunKlokOp = tijd }
    if (!Number.isFinite(p.et) || !Number.isFinite(p.eh)) return
    const heenTerug = tijd - p.et - p.eh
    if (!(heenTerug >= 0 && heenTerug < 3)) return
    onderweg = onderweg === null ? heenTerug / 2 : onderweg * 0.8 + (heenTerug / 2) * 0.2
  }

  function schrijfLijf(lijf) {
    let s = ''
    for (let k = 1; k < lijf.length; k++) {
      const dx = lijf[k][0] - lijf[k - 1][0], dy = lijf[k][1] - lijf[k - 1][1]
      s += dx === 1 ? 'R' : dx === -1 ? 'L' : dy === 1 ? 'D' : 'U'
    }
    return s
  }

  function leesLijf(h, str) {
    if (!Array.isArray(h) || h.length !== 2 || !h.every(Number.isInteger)) return null
    if (typeof str !== 'string' || str.length > KOLOM * RIJEN || !/^[UDLR]*$/.test(str)) return null
    let [x, y] = h
    if (!binnen(x, y)) return null
    const lijf = [[x, y]]
    for (const c of str) {
      x += RICHT[c][0]; y += RICHT[c][1]
      if (!binnen(x, y)) return null
      lijf.push([x, y])
    }
    return lijf
  }

  function stuurTs() {
    const s = slangen[ik]
    const p = { r: rondeNr, n: s.n, h: s.lijf[0].slice(), s: schrijfLijf(s.lijf), d: s.dir, g: s.groei, dd: s.dood ? 1 : 0 }
    // Klok erbij, en de klok van de ander terug: zo meet hij hoe lang berichten onderweg zijn.
    p.t = rond3(tijd)
    if (hunKlok !== null) { p.et = hunKlok; p.eh = rond3(tijd - hunKlokOp) }
    if (leider) {
      p.a = appel ? [appel.id, appel.x, appel.y] : 0
      p.ap = appels.slice(); p.wn = winst.slice()
    } else if (gemeldeHap && tijd < gemeldeHap.tot) p.hap = gemeldeHap.id
    stuur('ts', p)
    // Tijdens het aftellen beweegt er niets: dan is twee keer per seconde genoeg.
    tsKlok = staat === 'aftellen' ? 0.5 : 0.25
    laatsteTs = tijd; laatsteDir = s.dir; nuSturen = false
  }

  function stuurKlaar() {
    const p = { r: rondeNr, s: staat, u: uitslag }
    if (leider) { p.wn = winst.slice(); p.ap = appels.slice() }
    stuur('ts-klaar', p)
  }

  function stuurEinde() {
    stuur('ts-einde', { r: rondeNr, u: uitslag, wn: winst.slice(), ap: appels.slice() })
  }

  // Elk beeldje: zo nodig iets versturen, en kijken of de ander er nog is.
  function netwerk(dt) {
    if (!kanaalOk) return
    if (staat === 'aftellen' || staat === 'spel') {
      // Hooguit zo'n 8 berichten per seconde: Supabase knijpt daarboven af.
      tsKlok -= dt
      const gedraaid = slangen[ik].dir !== laatsteDir
      if (tijd - laatsteTs >= 0.13 && (tsKlok <= 0 || nuSturen || gedraaid)) stuurTs()
      if (tijd - laatsteVanAnder > CFG.weg) naarEinde(-2)       // de ander is weg
    } else {
      klaarKlok -= dt
      if (klaarKlok <= 0) { klaarKlok = 0.9; stuurKlaar() }
    }
  }

  // De slang van de ander een stapje verder, zolang dat kan. Loopt hij ergens
  // tegenaan, dan blijft hij staan tot zijn eigen bericht zegt wat er gebeurde.
  function schat(s) {
    if (s.dood) return
    const [x, y] = nieuwKop(s)
    if (bezet(x, y, true)) { s.oudeStaart = null; return }
    schuif(s, [x, y])
  }

  function neemSlangOver(p) {
    const s = slangen[ander]
    if (!Number.isInteger(p.n) || p.n < laatsteN) return          // ouder bericht
    const lijf = leesLijf(p.h, p.s)
    if (!lijf) return
    laatsteN = p.n
    s.lijf = lijf; s.oudeStaart = null; s.n = p.n
    if (RICHT[p.d]) s.dir = p.d
    s.groei = Number.isInteger(p.g) && p.g >= 0 && p.g < 100 ? p.g : 0
    if (p.dd) { sterf(s); return }
    if (s.dood) return
    // Het bericht is onderweg wat ouder geworden: een klein stukje bijschatten.
    const vooruit = Math.min(CFG.maxVooruit, Math.round((onderweg || 0) * tempo()))
    for (let k = 0; k < vooruit; k++) schat(s)
  }

  // Uitnodiger: de genodigde zegt dat hij appel id at.
  function verwerkHap(id) {
    if (!leider || staat !== 'spel' || !Number.isInteger(id) || !appel || appel.id !== id) return
    const s = slangen[ander]
    if (s.dood) return
    appels[ander]++
    s.groei += CFG.groei
    spetter((appel.x + 0.5) * T, HUD + (appel.y + 0.5) * T, APPEL, 14, 55, 0.5, 1.5)
    geluid.hap(ander)
    plaatsAppel()
  }

  function neemGetallenOver(p) {
    if (Array.isArray(p.wn) && p.wn.length === 2 && p.wn.every(v => Number.isInteger(v) && v >= 0)) winst = p.wn.slice()
    if (Array.isArray(p.ap) && p.ap.length === 2 && p.ap.every(v => Number.isInteger(v) && v >= 0)) appels = p.ap.slice()
  }

  // Genodigde: wat de uitnodiger over appel en stand zegt.
  function neemStandOver(p) {
    neemGetallenOver(p)
    if (p.a === 0) appel = null
    else if (Array.isArray(p.a) && p.a.length === 3 && p.a.every(Number.isInteger)) {
      const [id, x, y] = p.a
      if (id === gegetenAppel) appel = null
      else if (binnen(x, y) && !muren[idx(x, y)] && (!appel || appel.id !== id)) appel = { id, x, y, sinds: tijd }
    }
  }

  function neemEindeOver(p) {
    neemGetallenOver(p)
    const u = [0, 1, -1, -2].includes(p.u) ? p.u : -2
    if (staat === 'aftellen' || staat === 'spel') naarEinde(u)
    else if (staat === 'einde') uitslag = u
  }

  function ontvang(soort, p) {
    if (!draait || !p || typeof p !== 'object' || p.w === ik) return
    laatsteVanAnder = tijd
    const inRonde = staat === 'aftellen' || staat === 'spel'
    if (soort === 'ts') {
      meetOnderweg(p)
      if (!inRonde || p.r !== rondeNr) {
        // Startsein gemist? Dan start het eerste bericht van de uitnodiger de ronde.
        if (leider || inRonde || !Number.isInteger(p.r) || p.r <= rondeNr) return
        startRonde(p.r)
      }
      neemSlangOver(p)
      if (leider) verwerkHap(p.hap)
      else neemStandOver(p)
    } else if (soort === 'ts-start') {
      if (leider || inRonde || !Number.isInteger(p.r) || p.r <= rondeNr) return
      startRonde(p.r)
    } else if (soort === 'ts-einde') {
      if (!leider && p.r === rondeNr) neemEindeOver(p)
    } else if (soort === 'ts-klaar') {
      if (leider) {
        // De genodigde zit al in de eindstand van deze ronde: dan wij ook.
        if (inRonde && p.s === 'einde' && p.r === rondeNr) naarEinde(-2)
        return
      }
      if (p.s === 'einde' && p.r === rondeNr) neemEindeOver(p)
      else neemGetallenOver({ wn: p.wn })
    }
  }

  if (kanaalOk) {
    for (const soort of ['ts', 'ts-start', 'ts-einde', 'ts-klaar']) {
      spelKanaal.on('broadcast', { event: soort }, m => {
        try { ontvang(soort, m && m.payload) } catch (e) { console.warn('[twin-snakes] bericht', soort, e) }
      })
    }
  }

  // ═══════════════ Tekenen ═══════════════
  let res = 1, laatsteMaat = '', veldLaag = null, veldLaagVoor = ''

  function spetter(x, y, kleur, n, snel = 40, leven = 0.5, grootte = 1.5) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = snel * (0.3 + Math.random())
      deeltjes.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: leven * (0.5 + Math.random() * 0.5), max: leven, kleur, g: grootte })
    }
    if (deeltjes.length > 240) deeltjes.splice(0, deeltjes.length - 240)
  }

  // Het veld zelf (achtergrond, rand, muren) verandert alleen per level:
  // dat tekenen we één keer op een aparte laag.
  function bouwVeldLaag() {
    const sleutel = lv + ':' + laatsteMaat
    veldLaagVoor = sleutel
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(W * res)); c.height = Math.max(1, Math.round(H * res))
    const g = c.getContext('2d')
    if (!g) { veldLaag = null; return }
    veldLaag = c
    g.setTransform(res, 0, 0, res, 0, 0)
    const kl = LEVELS[lv].kleur
    g.fillStyle = DONKER; g.fillRect(0, 0, W, H)
    g.fillStyle = rgba(kl, 0.16)
    for (let y = 0; y < RIJEN; y++) for (let x = 0; x < KOLOM; x++) {
      if (!muren[idx(x, y)]) g.fillRect(x * T + T / 2 - 0.75, HUD + y * T + T / 2 - 0.75, 1.5, 1.5)
    }
    g.save()
    g.shadowColor = kl; g.shadowBlur = 8 * res
    g.strokeStyle = kl; g.lineWidth = 1.5
    g.strokeRect(0.75, HUD + 0.75, W - 1.5, RIJEN * T - 1.5)
    for (const [x, y, w, h] of muurBlokken(lv)) {
      g.fillStyle = rgba(kl, 0.22)
      g.fillRect(x * T + 1.5, HUD + y * T + 1.5, w * T - 3, h * T - 3)
      g.strokeRect(x * T + 1.5, HUD + y * T + 1.5, w * T - 3, h * T - 3)
    }
    g.restore()
  }

  function tekst(t, x, y, kleur, grootte = 10, uitlijn = 'center', gloeien = true) {
    ctx.save()
    ctx.font = `${grootte}px "Press Start 2P", monospace`
    ctx.textAlign = uitlijn; ctx.textBaseline = 'middle'
    if (gloeien) { ctx.shadowColor = kleur; ctx.shadowBlur = 6 * res }
    ctx.fillStyle = kleur; ctx.fillText(t, x, y)
    ctx.restore()
  }

  const midden = ([x, y]) => [(x + 0.5) * T, HUD + (y + 0.5) * T]
  const tussen = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]

  function tekenAppelOp(cx, cy, s) {
    ctx.fillStyle = rgba(APPEL, 0.22)
    ctx.beginPath(); ctx.arc(cx, cy, T * 0.62 * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = APPEL
    ctx.beginPath(); ctx.arc(cx, cy + 0.6 * s, T * 0.36 * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.beginPath(); ctx.arc(cx - T * 0.13 * s, cy - T * 0.06 * s, T * 0.09 * s, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#b07a3c'; ctx.lineWidth = 1.2 * s
    ctx.beginPath(); ctx.moveTo(cx, cy - T * 0.26 * s); ctx.lineTo(cx + T * 0.06 * s, cy - T * 0.46 * s); ctx.stroke()
    ctx.fillStyle = BLAD
    ctx.beginPath(); ctx.ellipse(cx + T * 0.2 * s, cy - T * 0.4 * s, T * 0.16 * s, T * 0.07 * s, -0.5, 0, Math.PI * 2); ctx.fill()
  }

  function tekenAppel() {
    if (!appel) return
    const [cx, cy] = midden([appel.x, appel.y])
    const opkomst = Math.min(1, Math.max(0, (tijd - appel.sinds) / 0.25))
    tekenAppelOp(cx, cy, (0.92 + 0.07 * Math.sin(tijd * 6)) * (0.3 + 0.7 * opkomst))
  }

  // Een slang is één dikke lijn door de middens van zijn vakjes. Tussen twee
  // stappen schuiven kop en staart mee, zodat hij vloeiend loopt.
  function tekenSlang(s) {
    const f = staat === 'spel' && !s.dood ? Math.min(1, stapKlok) : 1
    const L = s.lijf
    const kop = L.length > 1 ? tussen(midden(L[1]), midden(L[0]), f) : midden(L[0])
    const pt = [kop]
    for (let k = 1; k < L.length; k++) pt.push(midden(L[k]))
    if (s.oudeStaart && f < 1) pt.push(tussen(midden(s.oudeStaart), midden(L[L.length - 1]), f))
    const kleur = s.dood ? meng(s.kleur, '#2a2440', 0.55) : s.kleur
    const pad = () => {
      ctx.beginPath(); ctx.moveTo(pt[0][0], pt[0][1])
      for (let k = 1; k < pt.length; k++) ctx.lineTo(pt[k][0], pt[k][1])
    }
    ctx.save()
    if (s.doodFlits > 0 && Math.floor(s.doodFlits * 10) % 2) ctx.globalAlpha = 0.45
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    pad(); ctx.strokeStyle = rgba(kleur, 0.2); ctx.lineWidth = T * 1.05; ctx.stroke()
    pad(); ctx.strokeStyle = kleur; ctx.lineWidth = T * 0.66; ctx.stroke()
    pad(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = T * 0.16; ctx.stroke()
    const [hx, hy] = kop
    const [dx, dy] = RICHT[s.dir]
    // tongetje, af en toe
    if (!s.dood && (tijd * 0.8 + s.i * 0.45) % 1 < 0.14) {
      const bx = hx + dx * T * 0.4, by = hy + dy * T * 0.4
      const px = bx + dx * T * 0.32, py = by + dy * T * 0.32
      ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(px, py)
      ctx.moveTo(px, py); ctx.lineTo(px + (dx - dy) * T * 0.12, py + (dy + dx) * T * 0.12)
      ctx.moveTo(px, py); ctx.lineTo(px + (dx + dy) * T * 0.12, py + (dy - dx) * T * 0.12)
      ctx.stroke()
    }
    ctx.fillStyle = kleur
    ctx.beginPath(); ctx.arc(hx, hy, T * 0.44, 0, Math.PI * 2); ctx.fill()
    // oogjes
    for (const k of [-1, 1]) {
      const ox = hx + dx * T * 0.1 - dy * k * T * 0.2, oy = hy + dy * T * 0.1 + dx * k * T * 0.2
      if (s.dood) {
        const r = T * 0.09
        ctx.strokeStyle = DONKER; ctx.lineWidth = 1.3
        ctx.beginPath(); ctx.moveTo(ox - r, oy - r); ctx.lineTo(ox + r, oy + r)
        ctx.moveTo(ox + r, oy - r); ctx.lineTo(ox - r, oy + r); ctx.stroke()
      } else {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath(); ctx.arc(ox, oy, T * 0.12, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = DONKER
        ctx.beginPath(); ctx.arc(ox + dx * T * 0.05, oy + dy * T * 0.05, T * 0.065, 0, Math.PI * 2); ctx.fill()
      }
    }
    ctx.restore()
  }

  function tekenDeeltjes() {
    for (const d of deeltjes) {
      ctx.globalAlpha = Math.max(0, Math.min(1, d.t / d.max))
      ctx.fillStyle = d.kleur
      ctx.fillRect(d.x - d.g / 2, d.y - d.g / 2, d.g, d.g)
    }
    ctx.globalAlpha = 1
  }

  function tekenHud() {
    ctx.fillStyle = '#0d0619'; ctx.fillRect(0, 0, W, HUD)
    const kl = LEVELS[lv].kleur
    ctx.fillStyle = rgba(kl, 0.6); ctx.fillRect(0, HUD - 1, W, 1)
    for (const i of [0, 1]) {
      const links = i === 0
      const x = links ? 8 : W - 8, al = links ? 'left' : 'right'
      tekst(i === ik ? 'JIJ' : tegenNaam, x, 10, KLEUR[i], 6, al, false)
      tekst(String(winst[i]), x, 24, KLEUR[i], 11, al, false)
      const ax = links ? x + 36 : x - 36
      tekenAppelOp(ax, 24, 0.62)
      tekst(String(appels[i]), links ? ax + 8 : ax - 8, 25, '#e9ddff', 7, al, false)
    }
    tekst('LEVEL ' + levelNummer(), W / 2, 11, '#e9ddff', 7, 'center', false)
    tekst(LEVELS[lv].naam, W / 2, 24, kl, 6, 'center', false)
  }

  function paneel(px, py, pw, ph, rand) {
    ctx.fillStyle = 'rgba(20,10,38,0.94)'; ctx.fillRect(px, py, pw, ph)
    ctx.save(); ctx.shadowColor = rand; ctx.shadowBlur = 8 * res
    ctx.strokeStyle = rand; ctx.lineWidth = 1.5; ctx.strokeRect(px + 0.75, py + 0.75, pw - 1.5, ph - 1.5)
    ctx.restore()
  }

  function tekenUitleg() {
    ctx.fillStyle = 'rgba(5,2,12,0.72)'; ctx.fillRect(0, HUD, W, H - HUD)
    const px = 22, py = 62, pw = W - 44, ph = 212
    paneel(px, py, pw, ph, LEVELS[lv].kleur)
    const x0 = W / 2 - (11 * 13) / 2
    tekst('TWIN', x0, py + 24, KLEUR[0], 13, 'left')
    tekst('SNAKES', x0 + 5 * 13, py + 24, KLEUR[1], 13, 'left')
    // een slangetje en een appel
    const y = py + 58
    ctx.save()
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.strokeStyle = KLEUR[0]; ctx.lineWidth = T * 0.66
    ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(112, y); ctx.stroke()
    ctx.fillStyle = KLEUR[0]; ctx.beginPath(); ctx.arc(112, y, T * 0.44, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    tekenAppelOp(150, y, 1.1)
    tekst('+1', 190, y + 1, BLAD, 11)
    const regels = ['EET APPELS EN GROEI', 'BOTS NIET TEGEN MUREN', 'OF TEGEN EEN SLANG', 'WIE OVERBLIJFT WINT', 'ELKE RONDE EEN NIEUW LEVEL']
    regels.forEach((r, n) => tekst(r, W / 2, py + 92 + n * 18, '#e9ddff', 7, 'center', false))
    tekst('VEEG OF GEBRUIK DE PIJLTJES', W / 2, py + ph - 16, LEVELS[lv].kleur, 6, 'center', false)
  }

  function tekenAftel() {
    ctx.fillStyle = 'rgba(5,2,12,0.45)'; ctx.fillRect(0, HUD, W, H - HUD)
    const kl = LEVELS[lv].kleur
    tekst('LEVEL ' + levelNummer(), W / 2, H * 0.34, '#e9ddff', 14)
    tekst(LEVELS[lv].naam, W / 2, H * 0.34 + 24, kl, 9)
    const tel = Math.max(1, Math.ceil(aftel))
    tekst(String(tel), W / 2, H * 0.52, kl, 30)
    // welke slang ben ik?
    const s = slangen[ik]
    if (s) {
      // het labeltje komt vóór de kop, niet op het lijf
      const [hx, hy] = midden(s.lijf[0])
      const boven = s.dir !== 'D'
      const ty = boven ? hy - 22 : hy + 22
      tekst('JIJ', hx, ty, s.kleur, 7)
      ctx.fillStyle = s.kleur
      ctx.beginPath()
      if (boven) { ctx.moveTo(hx - 4, ty + 7); ctx.lineTo(hx + 4, ty + 7); ctx.lineTo(hx, ty + 12) }
      else { ctx.moveTo(hx - 4, ty - 7); ctx.lineTo(hx + 4, ty - 7); ctx.lineTo(hx, ty - 12) }
      ctx.fill()
    }
  }

  function tekenEinde() {
    ctx.fillStyle = 'rgba(5,2,12,0.8)'; ctx.fillRect(0, HUD, W, H - HUD)
    let kop = 'RONDE GESTOPT', kleur = '#e9ddff'
    if (uitslag === ik) { kop = 'JIJ WINT!'; kleur = KLEUR[ik] }
    else if (uitslag === ander) { kop = tegenNaam + ' WINT!'; kleur = KLEUR[ander] }
    else if (uitslag === -1) kop = 'GELIJKSPEL!'
    const groot = kop.length > 16 ? 10 : 12
    tekst(kop, W / 2, H * 0.24, kleur, groot)
    // de stand
    const sy = H * 0.37
    tekst(String(winst[0]), W / 2 - 44, sy, KLEUR[0], 24)
    tekst('-', W / 2, sy, '#e9ddff', 16, 'center', false)
    tekst(String(winst[1]), W / 2 + 44, sy, KLEUR[1], 24)
    tekst(ik === 0 ? 'JIJ' : tegenNaam, W / 2 - 44, sy + 24, KLEUR[0], 6, 'center', false)
    tekst(ik === 1 ? 'JIJ' : tegenNaam, W / 2 + 44, sy + 24, KLEUR[1], 6, 'center', false)
    // appels deze ronde
    const ay = H * 0.5
    for (const i of [0, 1]) {
      const cx = W / 2 + (i ? 44 : -44)
      tekenAppelOp(cx - 10, ay, 0.8)
      tekst(String(appels[i]), cx + 4, ay + 1, '#e9ddff', 9, 'left', false)
    }
    // wat komt er
    const volgende = rondeNr + 1
    const vlv = (volgende - 1) % LEVELS.length
    const vnr = vlv + 1 + Math.floor((volgende - 1) / LEVELS.length) * LEVELS.length
    tekst('VOLGENDE: LEVEL ' + vnr, W / 2, H * 0.6, '#e9ddff', 7, 'center', false)
    tekst(LEVELS[vlv].naam, W / 2, H * 0.6 + 16, LEVELS[vlv].kleur, 7, 'center', false)
  }

  // Onder de uitleg en de eindstand: op wie we wachten.
  function tekenStatus() {
    let regel = '', tweede = ''
    if (!kanaalOk) regel = 'OEFENEN TEGEN DE COMPUTER'
    else if (!anderIsEr()) regel = 'WACHT OP ' + NAAM
    else if (!leider) regel = NAAM + ' START HET SPEL'
    if (kanaalOk && !leider && geluidAan && geluid.kan && !geluid.ontgrendeld) tweede = 'TIK HIER VOOR GELUID'
    if (regel) tekst(regel, W / 2, H - 100, '#e9ddff', 7)
    if (tweede) tekst(tweede, W / 2, H - 84, BLAD, 7)
  }

  function teken() {
    if (!veldLaag || veldLaagVoor !== lv + ':' + laatsteMaat) bouwVeldLaag()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (veldLaag) ctx.drawImage(veldLaag, 0, 0)
    else { ctx.fillStyle = DONKER; ctx.fillRect(0, 0, doek.width, doek.height) }
    ctx.setTransform(res, 0, 0, res, 0, 0)
    if (schud > 0) ctx.translate((Math.random() - 0.5) * 6 * schud, (Math.random() - 0.5) * 6 * schud)
    tekenAppel()
    for (const s of slangen) if (s.i !== ik) tekenSlang(s)
    if (slangen[ik]) tekenSlang(slangen[ik])      // de mijne bovenop
    tekenDeeltjes()
    ctx.setTransform(res, 0, 0, res, 0, 0)
    if (flits > 0) { ctx.fillStyle = `rgba(255,255,255,${flits})`; ctx.fillRect(0, HUD, W, H - HUD) }
    tekenHud()
    if (staat === 'start') { tekenUitleg(); tekenStatus() }
    else if (staat === 'aftellen') tekenAftel()
    else if (staat === 'einde') { tekenEinde(); tekenStatus() }
  }

  function indeling() {
    const volB = wrap.clientWidth, volH = wrap.clientHeight
    if (!volB || !volH) return
    const vak = wrap.querySelector('.veld').getBoundingClientRect()
    let k = Math.min(vak.width / W, vak.height / H)
    if (!(k > 0)) k = 1
    const cssW = Math.floor(W * k), cssH = Math.floor(H * k)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const maat = cssW + 'x' + cssH + 'x' + dpr
    if (maat === laatsteMaat) return      // niets veranderd: niets herbouwen
    laatsteMaat = maat
    doek.style.width = cssW + 'px'; doek.style.height = cssH + 'px'
    scherm.style.width = cssW + 'px'; scherm.style.height = cssH + 'px'
    doek.width = Math.round(cssW * dpr); doek.height = Math.round(cssH * dpr)
    res = doek.width / W
  }

  // ═══════════════ Bediening ═══════════════
  // Richtingen gaan in een rijtje van hooguit twee, zodat twee snelle vegen
  // (bijvoorbeeld rechts en dan omlaag) allebei meetellen.
  function zet(i, r) {
    const s = slangen[i]
    if (!s || s.dood || s.remote || aiAan[i] || !RICHT[r]) return
    if (staat !== 'spel' && staat !== 'aftellen') return
    const laatste = s.wacht.length ? s.wacht[s.wacht.length - 1] : s.dir
    if (r === laatste || r === TEGEN[laatste] || s.wacht.length >= 2) return
    s.wacht.push(r)
  }

  function bijToets(e) {
    if (!draait) return
    const a = document.activeElement
    if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return
    const pijlen = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' }
    const wasd = { a: 'L', d: 'R', w: 'U', s: 'D', A: 'L', D: 'R', W: 'U', S: 'D' }
    if (pijlen[e.key]) { e.preventDefault(); geluid.ontgrendel(); zet(ik, pijlen[e.key]) }
    else if (wasd[e.key]) zet(ik, wasd[e.key])
    else if ((e.key === ' ' || e.key === 'Enter') && (staat === 'start' || (staat === 'einde' && eindTijd > 0.7))) {
      e.preventDefault(); geluid.ontgrendel(); leiderStart()
    }
  }
  window.addEventListener('keydown', bijToets)

  const vegen = new Map()
  // Op de iPhone is een veeg vanaf de linkerrand "terug" in Safari. Tijdens het
  // spelen begint je duim daar juist vaak. Beginnen we in een randstrook, dan
  // houden we de aanraking vast zodat de browser hem niet afpakt.
  const RANDBREEDTE = 30
  function inRand(x) {
    return x <= RANDBREEDTE || x >= (window.innerWidth || 0) - RANDBREEDTE
  }
  function veegStap(t) {
    const a = vegen.get(t.identifier); if (!a) return
    const dx = t.clientX - a.x, dy = t.clientY - a.y
    if (Math.hypot(dx, dy) < 18) return
    zet(ik, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'))
    a.x = t.clientX; a.y = t.clientY
  }
  wrap.addEventListener('touchstart', e => {
    let rand = false
    for (const t of e.changedTouches) if (inRand(t.clientX)) rand = true
    if (rand && e.cancelable && !e.target.closest('button')) e.preventDefault()
  }, { passive: false })

  scherm.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) vegen.set(t.identifier, { x: t.clientX, y: t.clientY })
  }, { passive: true })
  scherm.addEventListener('touchmove', e => {
    e.preventDefault()
    for (const t of e.changedTouches) veegStap(t)
  }, { passive: false })
  const losLaten = e => { for (const t of e.changedTouches) vegen.delete(t.identifier) }
  scherm.addEventListener('touchend', losLaten)
  scherm.addEventListener('touchcancel', losLaten)
  // Begint de veeg naast het veld (in de randstrook), dan telt hij ook mee.
  wrap.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) if (!vegen.has(t.identifier)) vegen.set(t.identifier, { x: t.clientX, y: t.clientY })
  }, { passive: true })
  wrap.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) veegStap(t)
  }, { passive: true })
  wrap.addEventListener('touchend', losLaten)
  wrap.addEventListener('touchcancel', losLaten)

  // Eerste echte tik: geluid van het slot (verplicht op de iPhone).
  const bijEersteTik = e => { if (e.isTrusted !== false) geluid.ontgrendel() }
  wrap.addEventListener('pointerdown', bijEersteTik, { passive: true })
  wrap.addEventListener('touchstart', bijEersteTik, { passive: true })

  // ▶ en ↻ zijn er alleen voor de uitnodiger, en werken pas als de ander er is.
  const kSpeel = wrap.querySelector('.kSpeel'), kOpnieuw = wrap.querySelector('.kOpnieuw')
  kSpeel.addEventListener('click', leiderStart)
  kOpnieuw.addEventListener('click', leiderStart)
  kSpeel.hidden = !leider
  kOpnieuw.hidden = !leider
  let knopStand = ''
  function werkKnoppen() {
    const mag = !kanaalOk || anderIsEr()
    const toonStart = staat === 'start'
    const toonEind = staat === 'einde' && eindTijd > 0.7 && leider
    const stand = [mag, toonStart, toonEind].join()
    if (stand === knopStand) return
    knopStand = stand
    kSpeel.disabled = !mag; kOpnieuw.disabled = !mag
    startLaag.hidden = !toonStart
    eindLaag.hidden = !toonEind
  }
  wrap.querySelector('.kGeluid').addEventListener('click', e => {
    geluidAan = !geluidAan
    e.currentTarget.textContent = geluidAan ? '🔊' : '🔇'
    if (geluidAan) geluid.init()
  })

  // ═══════════════ Lopen en opruimen ═══════════════
  const kijker = window.ResizeObserver ? new ResizeObserver(() => indeling()) : null
  if (kijker) kijker.observe(wrap)
  window.addEventListener('resize', indeling)

  // De chat zet zelf een balk met emoji's en een invoervak over het spel heen
  // (bouwSpelChatUI, ná start). Die zit hier in de weg, dus we leggen hem
  // tijdelijk weg en zetten hem terug zodra het spel dicht gaat.
  let chatBalk = null, chatBalkStijl = ''
  function verbergChatBalk() {
    if (chatBalk) return
    const el = document.getElementById('spelChatWrap')
    if (!el) return
    chatBalk = el; chatBalkStijl = el.style.display
    el.style.display = 'none'
  }
  function herstelChatBalk() {
    if (chatBalk && chatBalk.isConnected) chatBalk.style.display = chatBalkStijl
    chatBalk = null
  }

  function meldFout(e) {
    draait = false
    const m = document.createElement('div')
    m.className = 'fout'
    m.style.cssText = 'position:absolute;inset:auto 8px 8px 8px;background:rgba(20,10,38,.95);' +
      'border:2px solid #ff4d6d;border-radius:10px;padding:10px;z-index:9'
    m.textContent = 'Er ging iets mis: ' + (e && e.message ? e.message : e)
    wrap.appendChild(m)
  }

  function stop() {
    if (!draait) return
    draait = false
    herstelChatBalk()
    window.removeEventListener('keydown', bijToets)
    window.removeEventListener('resize', indeling)
    if (kijker) kijker.disconnect()
    geluid.sluit()
    if (wrap.isConnected) wrap.remove()
  }

  reset()
  indeling()

  let vorige = performance.now()
  function lus(nu) {
    if (!draait) return
    if (!wrap.isConnected || (isActief && !isActief())) { stop(); return }
    verbergChatBalk()
    const dt = Math.min(0.05, Math.max(0, (nu - vorige) / 1000))
    vorige = nu
    try {
      update(dt); teken()
    } catch (e) {
      // Niet stilletjes stoppen: laat zien wat er misging.
      console.error('[twin-snakes]', e)
      meldFout(e)
      return
    }
    requestAnimationFrame(lus)
  }
  requestAnimationFrame(lus)

  // Voor tests; de chat gebruikt dit niet.
  return {
    stop,
    _proef: {
      get staat() { return staat }, get slangen() { return slangen }, get appel() { return appel },
      get appels() { return appels }, get winst() { return winst }, get uitslag() { return uitslag },
      get rondeNr() { return rondeNr }, get lv() { return lv }, get ik() { return ik }, get leider() { return leider },
      get eindTijd() { return eindTijd }, get muren() { return muren }, get tijd() { return tijd },
      startRonde, update, teken, reset, zet, stap, leiderStart, ontvang, tempo, anderIsEr,
      zetAI: (i, v) => { aiAan[i] = v },
      zetAppel: (x, y) => { appel = { id: ++appelTeller, x, y, sinds: tijd } },
    },
  }
}
