/* Spookjes (vakje Pac-Man) — als spel in de Fibro-chat.
   Zelfde opbouw als pong-ui.js en runner-gunner-ui.js: één ingang, start(),
   die zichzelf in #spelInhoud tekent en zichzelf opruimt zodra het spel
   gesloten wordt.

   STAP 1: je speelt tegen de computer. Samen spelen over het spelkanaal komt
   in stap 2; de plek van de ecto-bol komt nu al uit de naam van het
   spelkanaal, dus beide telefoons krijgen straks dezelfde bollen.

   v6: vier speelvelden, elk met een eigen kleur. Welk veld je krijgt komt uit
   de naam van het spelkanaal, en elke ronde is het een ander.

   v5: veegt langs de schermrand pikt Safari niet meer af (terugveeg), en het
   tekenen is een stuk lichter gemaakt.

   v4: geluid via <audio> met in code gemaakte WAV-fragmenten, zodat het ook
   op de iPhone klinkt.

   v3: eigen spookje (rond, armpjes, deinende rok), grappig geluidje bij een
   tik.

   v2: geen pijlknoppen meer (vegen over het veld, of pijltjes/WASD op een
   toetsenbord), de emojibalk van de chat gaat tijdelijk weg en het doolhof
   krijgt zoveel mogelijk ruimte.

   Doel: wie aan het eind de meeste ectoplasma-stippen heeft, wint.
   Wie de grote bol pakt wordt de jager: groter en sneller. De ander wordt
   bang en verliest een druppel bij een tik. Drie druppels kwijt = af. */

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'

// ═══════════════ Doolhoven ═══════════════
// # = muur, . = stip, X = leegte. Rij 9 is een tunnel: links eruit = rechts erin.
// Alle velden zijn even groot. Welk veld je krijgt komt uit de naam van het
// spelkanaal, dus beide telefoons spelen in hetzelfde doolhof.
const VELDEN = [
  {
    naam: 'stad', muur: '#b44dff', binnen: '#150a26', achter: '#07030f',
    start: [[1, 1, 'R'], [17, 19, 'L']],
    kaart: [
    '###################', '#........#........#', '#.##.###.#.###.##.#', '#.................#',
    '#.##.#.#####.#.##.#', '#....#...#...#....#', '####.###.#.###.####', 'XXX#.#.......#.#XXX',
    '####.#.##.##.#.####', '........#X#........', '####.#.#####.#.####', 'XXX#.#.......#.#XXX',
    '####.#.#####.#.####', '#........#........#', '#.##.###.#.###.##.#', '#..#...........#..#',
    '##.#.#.#####.#.#.##', '#....#...#...#....#', '#.######.#.######.#', '#.................#',
    '###################',
    ],
  },
  {
    naam: 'riool', muur: '#3ddc84', binnen: '#0b1a12', achter: '#04100a',
    start: [[10, 5, 'R'], [6, 19, 'L']],
    kaart: [
    '###################', '#........#........#', '#.#####..#..#####.#', '#.#...#..#..#...#.#',
    '#...#.#.###.#.#...#', '###.#.#.....#.#.###', '#...#.###.###.#...#', '#.#...#.....#...#.#',
    '#.#.#####.#####.#.#', '....#.........#....', '#.#.#####.#####.#.#', '#.#.....#.#.....#.#',
    '#.#####.#.#.#####.#', '#.......#.#.......#', '#.#####.#.#.#####.#', '#.....#.#.#.#.....#',
    '###.#.#.#.#.#.#.###', '#...#...#.#...#...#', '#.#############.#.#', '#.................#',
    '###################',
    ],
  },
  {
    naam: 'tempel', muur: '#ffb347', binnen: '#241505', achter: '#0f0803',
    start: [[2, 1, 'R'], [14, 19, 'L']],
    kaart: [
    '###################', '#........#........#', '#.##.##..#..##.##.#', '#.................#',
    '#.##.#.#####.#.##.#', '#....#...#...#....#', '##.#.#.#.#.#.#.#.##', '#..#.#.#.#.#.#.#..#',
    '#.##...#...#...##.#', '.........#.........', '#.##...#...#...##.#', '#..#.#.#.#.#.#.#..#',
    '##.#.#.#.#.#.#.#.##', '#....#...#...#....#', '#.##.#.#####.#.##.#', '#.................#',
    '#.##.##..#..##.##.#', '#........#........#', '#.###.#######.###.#', '#.................#',
    '###################',
    ],
  },
  {
    naam: 'ijsgrot', muur: '#7aa2ff', binnen: '#0d1730', achter: '#04060f',
    start: [[13, 7, 'R'], [3, 19, 'L']],
    kaart: [
    '###################', '#.................#', '#.###.###.###.###.#', '#.#.....#.#.....#.#',
    '#.#.###.#.#.###.#.#', '#...#.....#...#...#', '###.#.###.#.#.#.###', '#...#...#.#...#...#',
    '#.#####.#.#.#####.#', '.......#...#.......', '#.#####.#.#.#####.#', '#...#...#.#...#...#',
    '###.#.###.#.#.#.###', '#...#.....#...#...#', '#.#.###.#.#.###.#.#', '#.#.....#.#.....#.#',
    '#.###.###.###.###.#', '#.................#', '#.##.##.###.##.##.#', '#.................#',
    '###################',
    ],
  },
]

let veldNr = 0
let KAART = VELDEN[0].kaart
let NEON = VELDEN[0].muur, MUURBINNEN = VELDEN[0].binnen, ACHTER = VELDEN[0].achter
let STARTPLEK = VELDEN[0].start

function zetVeld(n) {
  veldNr = ((n % VELDEN.length) + VELDEN.length) % VELDEN.length
  const v = VELDEN[veldNr]
  KAART = v.kaart; NEON = v.muur; MUURBINNEN = v.binnen; ACHTER = v.achter
  STARTPLEK = v.start
}

const RIJEN = KAART.length, KOLOM = KAART[0].length
const T = 16, HUD = 32
const W = KOLOM * T, H = RIJEN * T + HUD

// ═══════════════ Om aan te draaien ═══════════════
const CFG = {
  snelProoi: 5.2,     // tegels per seconde
  snelJager: 6.8,     // de jager is sneller
  jagerGroot: 1.4,    // en groter
  jagerDuur: 8,       // seconden jager
  waarschuw: 2,       // laatste seconden knippert de jager
  bolTerug: 5,        // seconden tot de volgende bol
  onkwetsbaar: 2.5,   // seconden knipperen na een tik
  levens: 3,
  raakAfstand: 0.85,  // in tegels
  aiFout: 0.12,       // kans dat de computer iets doms doet
}

const KLEUR = ['#5ff4ff', '#ff6bd6']
const BANG_BLAUW = '#2a38ff'
const ECTO = '#7dff6a'
const RICHT = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }
const TEGEN = { L: 'R', R: 'L', U: 'D', D: 'U' }

// Ons eigen spookje: 14 breed, 12 rijen bol lijf. De onderkant is geen vaste
// tekening maar een golf die meedeint, en aan de zijkanten zitten armpjes.
const SPOOK = ['.....####.....', '...########...', '..##########..', '.############.',
  '##############', '##############', '##############', '##############',
  '##############', '##############', '##############', '##############']
const KROON = ['#..#..#', '##.#.##', '#######', '#.#.#.#', '#######']

// ═══════════════ Hulpjes zonder spelstand ═══════════════
const wrapX = x => ((x % KOLOM) + KOLOM) % KOLOM
function isOpen(x, y) {
  if (y < 0 || y >= RIJEN) return false
  const c = KAART[y][wrapX(x)]
  return c !== '#' && c !== 'X'
}
function openZonderWrap(x, y) {
  if (x < 0 || x >= KOLOM || y < 0 || y >= RIJEN) return false
  const c = KAART[y][x]
  return c !== '#' && c !== 'X'
}
function kan(x, y, r) { const [dx, dy] = RICHT[r]; return isOpen(x + dx, y + dy) }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})` }
function meng(h1, h2, t) {
  const a = hexRgb(h1), b = hexRgb(h2)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
const pad3 = n => String(n).padStart(3, '0')
function seedUit(tekst) {
  let h = 2166136261
  for (let i = 0; i < tekst.length; i++) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) || 1
}
function afstandVeld(bronnen) {
  const d = new Int16Array(KOLOM * RIJEN).fill(-1)
  const q = []
  for (const [x, y] of bronnen) { const i = y * KOLOM + x; if (d[i] < 0) { d[i] = 0; q.push(i) } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % KOLOM, y = (i / KOLOM) | 0
    for (const r in RICHT) {
      const [dx, dy] = RICHT[r]
      if (!isOpen(x + dx, y + dy)) continue
      const j = (y + dy) * KOLOM + wrapX(x + dx)
      if (d[j] < 0) { d[j] = d[i] + 1; q.push(j) }
    }
  }
  return d
}
function pixels(g, rijen, x0, y0, u, kleur) {
  g.fillStyle = kleur
  rijen.forEach((rij, r) => {
    let c = 0
    while (c < rij.length) {
      if (rij[c] !== '#') { c++; continue }
      let e = c; while (e < rij.length && rij[e] === '#') e++
      g.fillRect(x0 + c * u, y0 + r * u, (e - c) * u + 0.05, u + 0.05)
      c = e
    }
  })
}

// ═══════════════ Geluid in code, als echte fragmenten ═══════════════
// De iPhone houdt Web Audio op slot, ook na een tik. Een <audio>-element doet
// het daar wel. Daarom rekenen we elk geluidje hier uit tot een WAV-fragment
// (net als de beltoon) en spelen we dat af via <audio>.
const KLANK_HZ = 22050

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

// "Oef", "au", "woeps": een zaagtand door een filter dat als een mondje
// open- en dichtgaat.
function stemGolf(o) {
  const n = Math.round(o.duur * KLANK_HZ)
  const uit = new Float32Array(n)
  let fase = 0, laag = 0, band = 0
  for (let i = 0; i < n; i++) {
    const t = i / KLANK_HZ, deel = t / o.duur
    const hz = o.van * Math.pow(o.naar / o.van, deel) * (1 + 0.05 * Math.sin(2 * Math.PI * 11 * t))
    fase += hz / KLANK_HZ
    const bron = golf('sawtooth', fase)
    const fc = o.f1 * Math.pow(o.f2 / o.f1, deel)
    const f = 2 * Math.sin(Math.PI * Math.min(fc, KLANK_HZ * 0.45) / KLANK_HZ)
    const hoog = bron - laag - 0.18 * band
    band += f * hoog
    laag += f * band
    const aanzet = Math.min(1, t / 0.02)
    const eind = Math.min(1, (o.duur - t) / 0.05)
    uit[i] = band * aanzet * Math.max(0, eind) * Math.exp(-1.6 * deel)
  }
  // het filter versterkt, dus terugschalen tot een nette hoogte
  let piek = 0
  for (let i = 0; i < n; i++) piek = Math.max(piek, Math.abs(uit[i]))
  if (piek > 0) { const f = 0.42 / piek; for (let i = 0; i < n; i++) uit[i] *= f }
  return uit
}

// Meerdere golfjes na elkaar of over elkaar heen.
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

// Sirene tijdens de jacht: precies één seconde, zodat hij rond loopt zonder tik.
function sireneGolf() {
  const n = KLANK_HZ
  const uit = new Float32Array(n)
  let fase = 0
  for (let i = 0; i < n; i++) {
    const t = i / KLANK_HZ
    fase += (230 + 60 * Math.sin(2 * Math.PI * 5 * t)) / KLANK_HZ
    uit[i] = golf('triangle', fase) * 0.16
  }
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
  if (!document.getElementById('ecto-font')) {
    const l = document.createElement('link')
    l.id = 'ecto-font'; l.rel = 'stylesheet'; l.href = FONT_URL
    document.head.appendChild(l)
  }
  if (document.getElementById('ecto-stijl')) return
  const st = document.createElement('style')
  st.id = 'ecto-stijl'
  st.textContent = `
  .ecto{--muur:#b44dff;--ecto:#7dff6a;--tekst:#e9ddff;--paneel:rgba(20,10,38,.92);
    position:absolute;inset:0;padding:40px 2px 2px;box-sizing:border-box;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:#07030f;color:var(--tekst);font-family:"Press Start 2P",monospace;
    touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
  .ecto *{box-sizing:border-box}
  .ecto .veld{position:relative;flex:1 1 auto;width:100%;min-height:0;display:flex;align-items:center;justify-content:center}
  .ecto .scherm{position:relative}
  .ecto canvas.doek{display:block;border-radius:6px;box-shadow:0 0 24px rgba(180,77,255,.35);position:relative;z-index:0}
  .ecto .scherm::after{content:"";position:absolute;inset:0;border-radius:6px;pointer-events:none;z-index:1;
    background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.16) 2px 3px),
      radial-gradient(ellipse at center,rgba(0,0,0,0) 60%,rgba(0,0,0,.45) 100%)}
  .ecto .laag{position:absolute;left:0;right:0;bottom:5%;z-index:2;display:flex;
    justify-content:center;align-items:center;gap:12px}
  .ecto .laag[hidden]{display:none}
  .ecto .knop{font-family:inherit;font-size:17px;color:var(--tekst);background:var(--paneel);
    border:2px solid var(--muur);border-radius:12px;min-width:46px;height:46px;padding:0 10px;
    box-shadow:0 0 12px rgba(180,77,255,.45);cursor:pointer;touch-action:manipulation}
  .ecto .knop.groot{width:60px;height:60px;border-radius:50%;font-size:24px;padding:0;
    color:var(--ecto);border-color:var(--ecto);box-shadow:0 0 18px rgba(125,255,106,.55)}
  .ecto .knop:active{transform:scale(.94)}
  .ecto .fout{font-size:10px;line-height:2;text-align:center;color:#ff9db5}
  `
  document.head.appendChild(st)
}

// ═══════════════════════════════════════════════════════
export async function start({ spelKanaal, benIkSpeler1, vriendNaam, isActief }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (!inhoud) return
  if (titel) titel.textContent = '👻 Spookjes'
  if (getComputedStyle(inhoud).position === 'static') inhoud.style.position = 'relative'
  zetStijl()

  const wrap = document.createElement('div')
  wrap.className = 'ecto'
  wrap.innerHTML = `
    <div class="veld">
      <div class="scherm">
        <canvas class="doek"></canvas>
        <div class="laag startLaag">
          <button class="knop kModus" type="button" aria-label="Tegenstander">👤🆚🤖</button>
          <button class="knop groot kSpeel" type="button" aria-label="Start">▶</button>
          <button class="knop kGeluid" type="button" aria-label="Geluid">🔊</button>
        </div>
        <div class="laag eindLaag" hidden>
          <button class="knop groot kOpnieuw" type="button" aria-label="Opnieuw">↻</button>
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

  // Zelfde kanaalnaam bij beide spelers → straks dezelfde bollen
  const kanaalNaam = (spelKanaal && (spelKanaal.topic || spelKanaal.subTopic)) || 'los'
  let zaad = seedUit(String(kanaalNaam))
  const rnd = () => { zaad = (zaad * 16807) % 2147483647; return zaad / 2147483647 }
  const kiesUit = lijst => lijst[Math.floor(rnd() * lijst.length)]

  // ═══════════════ Spelstand ═══════════════
  let stippen, aantalStippen = 0, totaalStippen = 0
  let spelers = []
  let bol = null, bolTimer = 0
  let jager = null, jagerTijd = 0
  let staat = 'start', aftel = 0, laatsteTel = 4, tijd = 0, eindTijd = 0
  let tweeSpelers = false
  let deeltjes = [], schud = 0, flits = 0
  let geluidAan = true, draait = true
  let rondeNr = 0
  const veldStart = seedUit(String(kanaalNaam) + 'veld') % VELDEN.length

  // ═══════════════ Geluid ═══════════════
  // Alle fragmenten worden één keer uitgerekend en daarna via <audio> gespeeld.
  // Elk geluidje heeft een paar kopieën, zodat ze over elkaar heen kunnen.
  const geluid = {
    klanken: {}, adressen: [], sirene: null, ontgrendeld: false, kan: false,
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
        maak('stip0', toonGolf({ van: 880, naar: 1100, duur: 0.05, vorm: 'square', vol: 0.3 }), 4, 0.5)
        maak('stip1', toonGolf({ van: 620, naar: 480, duur: 0.05, vorm: 'square', vol: 0.3 }), 4, 0.5)
        const auSoorten = [
          { van: 330, naar: 150, f1: 950, f2: 420, duur: 0.3, piep: [700, 260] },   // oeeef
          { van: 260, naar: 380, f1: 600, f2: 1100, duur: 0.26, piep: [520, 900] }, // auw?
          { van: 420, naar: 170, f1: 1200, f2: 500, duur: 0.34, piep: [880, 300] }, // woeps
        ]
        auSoorten.forEach((s, n) => maak('au' + n, mengGolf([
          { golf: stemGolf(s) },
          { golf: toonGolf({ van: s.piep[0], naar: s.piep[1], duur: 0.12, vorm: 'triangle', vol: 0.18 }), na: 0.02 },
        ]), 2, 0.85))
        maak('bol', mengGolf([
          { golf: toonGolf({ van: 180, naar: 1200, duur: 0.5, vorm: 'sawtooth', vol: 0.26 }) },
          { golf: toonGolf({ van: 300, naar: 1600, duur: 0.45, vorm: 'square', vol: 0.16 }), na: 0.06 },
        ]), 2, 0.8)
        maak('uit', mengGolf([523, 392, 330, 262, 196].map((f, n) => (
          { golf: toonGolf({ van: f, duur: 0.2, vorm: 'triangle', vol: 0.3 }), na: n * 0.15 }
        ))), 1, 0.8)
        maak('winst', mengGolf([523, 659, 784, 1047, 784, 1047].map((f, n) => (
          { golf: toonGolf({ van: f, duur: 0.16, vorm: 'square', vol: 0.24 }), na: n * 0.11 }
        ))), 1, 0.8)
        maak('telLaag', toonGolf({ van: 440, duur: 0.12, vorm: 'square', vol: 0.26 }), 2, 0.7)
        maak('telHoog', toonGolf({ van: 880, duur: 0.3, vorm: 'square', vol: 0.26 }), 2, 0.7)
        maak('jachtEind', toonGolf({ van: 900, naar: 300, duur: 0.25, vorm: 'triangle', vol: 0.22 }), 2, 0.7)
        const sAdres = wavAdres(sireneGolf())
        this.adressen.push(sAdres)
        this.sirene = new Audio(sAdres)
        this.sirene.loop = true; this.sirene.volume = 0.35; this.sirene.preload = 'auto'
        this.kan = true
      } catch (e) { console.warn('[spookjes] geluid kon niet gebouwd worden', e) }
    },
    // Moet tijdens een echte tik gebeuren, anders blijft geluid op slot (iPhone).
    ontgrendel() {
      if (this.ontgrendeld || !this.kan) return
      this.ontgrendeld = true
      const alles = [this.sirene]
      for (const naam in this.klanken) alles.push(...this.klanken[naam].els)
      for (const a of alles) {
        if (!a) continue
        try {
          const p = a.play()
          const rust = () => { try { a.pause(); a.currentTime = 0 } catch (e) {} }
          if (p && p.then) p.then(rust).catch(() => {}); else rust()
        } catch (e) {}
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
    stip(i) { this.speel(i ? 'stip1' : 'stip0') },
    au() { this.speel('au' + Math.floor(Math.random() * 3)) },
    bol() { this.speel('bol') },
    uit() { this.speel('uit') },
    winst() { this.speel('winst') },
    aftel(n) { this.speel(n ? 'telLaag' : 'telHoog') },
    jachtEinde() { this.speel('jachtEind') },
    jachtStart() {
      if (!geluidAan || !this.kan || !this.sirene) return
      try { this.sirene.currentTime = 0; const p = this.sirene.play(); if (p && p.catch) p.catch(() => {}) } catch (e) {}
    },
    jachtStop() { if (this.sirene) { try { this.sirene.pause() } catch (e) {} } },
    sluit() {
      this.jachtStop()
      for (const naam in this.klanken) for (const a of this.klanken[naam].els) { try { a.pause(); a.src = '' } catch (e) {} }
      if (this.sirene) { try { this.sirene.src = '' } catch (e) {} }
      for (const adres of this.adressen) { try { URL.revokeObjectURL(adres) } catch (e) {} }
      this.adressen = []; this.klanken = {}; this.sirene = null; this.kan = false
    },
  }
  geluid.bouw()

  // ═══════════════ Opzetten ═══════════════
  function maakSpeler(i) {
    const [x, y, kijk] = STARTPLEK[i]
    return {
      i, x, y, tx: x, ty: y, dir: null, volgende: null, kijk,
      levens: CFG.levens, score: 0, onkw: 0, schaal: 1,
      uit: false, uitTijd: 0, kleur: KLEUR[i], ai: false, spoorT: 0,
    }
  }
  function tegel(s) { return [wrapX(Math.round(s.x)), Math.round(s.y)] }
  function afstandTussen(a, b) {
    let dx = Math.abs(a.x - b.x); dx = Math.min(dx, KOLOM - dx)
    return Math.hypot(dx, a.y - b.y)
  }

  function reset() {
    zetVeld(veldStart + rondeNr)
    wrap.style.background = ACHTER
    stippen = new Uint8Array(KOLOM * RIJEN); totaalStippen = 0
    for (let y = 0; y < RIJEN; y++) for (let x = 0; x < KOLOM; x++) {
      if (KAART[y][x] === '.') { stippen[y * KOLOM + x] = 1; totaalStippen++ }
    }
    for (const [x, y] of STARTPLEK) if (stippen[y * KOLOM + x]) { stippen[y * KOLOM + x] = 0; totaalStippen-- }
    aantalStippen = totaalStippen
    spelers = [maakSpeler(0), maakSpeler(1)]
    spelers[1].ai = !tweeSpelers
    jager = null; jagerTijd = 0; bol = null; bolTimer = 0
    deeltjes = []; schud = 0; flits = 0
    plaatsBol()
    if (stipBeeld) { bouwDoolhof(); bouwStippen() }
    geluid.jachtStop()
  }

  function plaatsBol() {
    if (spelers.filter(s => !s.uit).length < 2) { bol = null; return }
    const v0 = afstandVeld([tegel(spelers[0])]), v1 = afstandVeld([tegel(spelers[1])])
    const eerlijk = [], rest = []
    for (let y = 0; y < RIJEN; y++) for (let x = 0; x < KOLOM; x++) {
      if (!openZonderWrap(x, y)) continue
      const i = y * KOLOM + x, a = v0[i], b = v1[i]
      if (a < 6 || b < 6) continue
      ;(Math.abs(a - b) <= 2 ? eerlijk : rest).push([x, y])
    }
    const [x, y] = kiesUit(eerlijk.length ? eerlijk : rest.length ? rest : [[9, 3]])
    bol = { x, y }
    spetter((x + 0.5) * T, HUD + (y + 0.5) * T, ECTO, 16, 50, 0.6, 1.5)
  }

  // ═══════════════ Beweging ═══════════════
  function bewegen(s, dt, tempo) {
    if (s.uit) return
    const snel = (jager === s.i ? CFG.snelJager : CFG.snelProoi) * tempo
    let rest = snel * dt, veilig = 10
    while (rest > 1e-6 && veilig--) {
      if (s.x === s.tx && s.y === s.ty) {
        aangekomen(s)
        if (staat !== 'spel') return
        if (s.ai) s.volgende = aiKies(s)
        if (s.volgende && kan(s.x, s.y, s.volgende)) s.dir = s.volgende
        if (!s.dir || !kan(s.x, s.y, s.dir)) { s.dir = null; return }
        s.kijk = s.dir
        const [dx, dy] = RICHT[s.dir]
        s.tx = s.x + dx; s.ty = s.y + dy
      } else if (s.volgende && s.dir && s.volgende === TEGEN[s.dir]) {
        const [dx, dy] = RICHT[s.dir]
        s.tx -= dx; s.ty -= dy; s.dir = s.volgende; s.kijk = s.dir
      }
      const ddx = s.tx - s.x, ddy = s.ty - s.y
      const weg = Math.abs(ddx) + Math.abs(ddy)
      const stap = Math.min(rest, weg)
      s.x += Math.sign(ddx) * stap; s.y += Math.sign(ddy) * stap; rest -= stap
      if (stap >= weg - 1e-9) {
        s.x = s.tx; s.y = s.ty
        if (s.x < 0 || s.x >= KOLOM) { s.x = wrapX(s.x); s.tx = s.x }
      }
    }
  }

  function aangekomen(s) {
    const i = s.y * KOLOM + s.x
    if (stippen[i]) {
      stippen[i] = 0; aantalStippen--; s.score++
    wisStip(s.x, s.y)
      geluid.stip(s.i)
      spetter((s.x + 0.5) * T, HUD + (s.y + 0.5) * T, ECTO, 4, 25, 0.3, 1)
    }
    if (bol && bol.x === s.x && bol.y === s.y) pakBol(s)
  }

  function pakBol(s) {
    const cx = (bol.x + 0.5) * T, cy = HUD + (bol.y + 0.5) * T
    bol = null; jager = s.i; jagerTijd = CFG.jagerDuur; flits = 0.25
    spetter(cx, cy, ECTO, 36, 90, 0.7, 2)
    spetter(cx, cy, s.kleur, 20, 60, 0.6, 2)
    geluid.bol(); geluid.jachtStart()
  }

  function tik(j, p) {
    p.levens--; p.onkw = CFG.onkwetsbaar; schud = 0.3
    const cx = (p.x + 0.5) * T, cy = HUD + (p.y + 0.5) * T
    spetter(cx, cy, p.kleur, 24, 80, 0.6, 2)
    geluid.au()
    if (navigator.vibrate) { try { navigator.vibrate(80) } catch (e) {} }
    if (p.levens <= 0) {
      p.uit = true; p.uitTijd = 0
      spetter(cx, cy, p.kleur, 40, 110, 0.9, 2.5)
      geluid.uit()
      jager = null; bol = null; geluid.jachtStop()
    }
  }

  // ═══════════════ Computer-spookje ═══════════════
  function aiKies(s) {
    const opties = Object.keys(RICHT).filter(r => kan(s.x, s.y, r))
    if (!opties.length) return null
    let vooruit = opties.filter(r => r !== TEGEN[s.dir])
    if (!vooruit.length) vooruit = opties
    if (Math.random() < CFG.aiFout) return vooruit[Math.floor(Math.random() * vooruit.length)]

    const ander = spelers[1 - s.i]
    let veld = null, zoekMax = false, keus = vooruit
    if (!ander.uit && jager === s.i) {
      veld = afstandVeld([tegel(ander)])                         // achterna
    } else if (!ander.uit && jager === ander.i) {
      const dv = afstandVeld([tegel(ander)])
      if (dv[s.y * KOLOM + s.x] < 9) { veld = dv; zoekMax = true; keus = opties }   // vluchten
    } else if (bol && !ander.uit) {
      const vb = afstandVeld([[bol.x, bol.y]])
      const [ax, ay] = tegel(ander)
      if (vb[s.y * KOLOM + s.x] <= vb[ay * KOLOM + ax] + 3) veld = vb               // wedren
    }
    if (!veld) {
      const bronnen = []
      for (let i = 0; i < stippen.length; i++) if (stippen[i]) bronnen.push([i % KOLOM, (i / KOLOM) | 0])
      if (!bronnen.length) return vooruit[Math.floor(Math.random() * vooruit.length)]
      veld = afstandVeld(bronnen)
    }
    let beste = [], besteW = zoekMax ? -Infinity : Infinity
    for (const r of keus) {
      const [dx, dy] = RICHT[r]
      let w = veld[(s.y + dy) * KOLOM + wrapX(s.x + dx)]
      if (w < 0) w = zoekMax ? -1 : 9999
      if (zoekMax ? w > besteW : w < besteW) { besteW = w; beste = [r] }
      else if (w === besteW) beste.push(r)
    }
    return beste[Math.floor(Math.random() * beste.length)]
  }

  // ═══════════════ Deeltjes ═══════════════
  function spetter(x, y, kleur, n, snel = 40, leven = 0.5, grootte = 1.5) {
    for (let k = 0; k < n; k++) {
      if (deeltjes.length > 500) deeltjes.shift()
      const h = Math.random() * Math.PI * 2, v = snel * (0.3 + Math.random() * 0.7)
      const t = leven * (0.5 + Math.random() * 0.5)
      deeltjes.push({ x, y, vx: Math.cos(h) * v, vy: Math.sin(h) * v, t, max: t, kleur, g: grootte })
    }
  }

  // ═══════════════ Rondeverloop ═══════════════
  function rondeKlaar() {
    if (aantalStippen === 0) return true
    const levend = spelers.filter(s => !s.uit)
    if (!levend.length) return true
    if (levend.length === 1) {
      const l = levend[0], u = spelers.find(s => s.uit)
      if (l.score > u.score) return true
      if (l.score + aantalStippen < u.score) return true
    }
    return false
  }

  function update(dt) {
    tijd += dt
    schud = Math.max(0, schud - dt)
    flits = Math.max(0, flits - dt)
    for (const p of deeltjes) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; p.t -= dt }
    deeltjes = deeltjes.filter(p => p.t > 0)
    for (const s of spelers) {
      const doel = jager === s.i ? CFG.jagerGroot : 1
      s.schaal += (doel - s.schaal) * Math.min(1, dt * 10)
      if (s.uit) s.uitTijd += dt
    }

    if (staat === 'aftellen') {
      aftel -= dt
      const n = Math.ceil(aftel)
      if (n !== laatsteTel && n > 0) { laatsteTel = n; geluid.aftel(n) }
      if (aftel <= 0) { staat = 'spel'; geluid.aftel(0) }
      return
    }
    if (staat === 'einde') {
      eindTijd += dt
      if (Math.random() < dt * 8) {
        const max = Math.max(...spelers.map(s => s.score))
        const winnaars = spelers.filter(s => s.score === max)
        const w = winnaars[Math.floor(Math.random() * winnaars.length)]
        spetter(W * (w.i ? 0.7 : 0.3), H * 0.3, Math.random() < 0.5 ? ECTO : w.kleur, 6, 70, 1, 2)
      }
      if (eindTijd > 0.7) eindLaag.hidden = false
      return
    }
    if (staat !== 'spel') return

    const mensLeeft = spelers.some(s => !s.ai && !s.uit)
    const tempo = mensLeeft ? 1 : 2
    for (const s of spelers) if (s.onkw > 0) s.onkw -= dt * tempo
    for (const s of spelers) bewegen(s, dt, tempo)

    if (jager !== null) {
      const j = spelers[jager]
      jagerTijd -= dt * tempo
      j.spoorT -= dt
      if (j.spoorT <= 0) { j.spoorT = 0.04; spetter((j.x + 0.5) * T, HUD + (j.y + 0.5) * T, j.kleur, 1, 10, 0.4, 2) }
      const p = spelers[1 - jager]
      if (!p.uit && p.onkw <= 0 && afstandTussen(j, p) < CFG.raakAfstand) tik(j, p)
      if (jager !== null && jagerTijd <= 0) {
        jager = null; bolTimer = CFG.bolTerug
        geluid.jachtStop(); geluid.jachtEinde()
      }
    } else if (!bol && spelers.every(s => !s.uit)) {
      bolTimer -= dt * tempo
      if (bolTimer <= 0) plaatsBol()
    }

    if (rondeKlaar()) {
      staat = 'einde'; eindTijd = 0; jager = null
      geluid.jachtStop(); geluid.winst()
    }
  }

  function startRonde() {
    geluid.init()
    rondeNr++
    reset()
    staat = 'aftellen'; aftel = 3; laatsteTel = 4
    startLaag.hidden = true
    eindLaag.hidden = true
  }

  // ═══════════════ Tekenen ═══════════════
  let res = 1, doolhofLaag = null, stipBeeld = null, druppelBeeld = []
  let stippenLaag = null, stippenCtx = null, gloedBeelden = new Map()
  let laatsteMaat = ''

  function maakLaag(w, h) {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.ceil(w * res)); c.height = Math.max(1, Math.ceil(h * res))
    const g = c.getContext('2d'); g.setTransform(res, 0, 0, res, 0, 0)
    return [c, g]
  }

  function bouwDoolhof() {
    const [m, mg] = maakLaag(W, RIJEN * T)
    let z = 7
    const r2 = () => (z = (z * 16807) % 2147483647) / 2147483647
    const d = 2
    for (let y = 0; y < RIJEN; y++) for (let x = 0; x < KOLOM; x++) {
      if (KAART[y][x] !== '#') continue
      const px = x * T, py = y * T
      const l = openZonderWrap(x - 1, y), r = openZonderWrap(x + 1, y)
      const o = openZonderWrap(x, y - 1), b = openZonderWrap(x, y + 1)
      mg.fillStyle = NEON; mg.fillRect(px, py, T, T)
      mg.fillStyle = MUURBINNEN
      mg.fillRect(px + (l ? d : 0), py + (o ? d : 0), T - (l ? d : 0) - (r ? d : 0), T - (o ? d : 0) - (b ? d : 0))
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (openZonderWrap(x + dx, y + dy) && !openZonderWrap(x + dx, y) && !openZonderWrap(x, y + dy)) {
          mg.fillStyle = NEON; mg.fillRect(dx < 0 ? px : px + T - d, dy < 0 ? py : py + T - d, d, d)
        }
      }
      mg.fillStyle = 'rgba(180,77,255,0.12)'
      if (r2() < 0.55) mg.fillRect(px + 4 + Math.floor(r2() * 7), py + 4 + Math.floor(r2() * 8), 3, 1)
      if (r2() < 0.25) mg.fillRect(px + 4 + Math.floor(r2() * 8), py + 4 + Math.floor(r2() * 8), 1, 1)
    }
    const [c, g] = maakLaag(W, RIJEN * T)
    g.shadowColor = NEON; g.shadowBlur = 7 * res
    g.drawImage(m, 0, 0, W, RIJEN * T)
    g.shadowBlur = 0
    g.drawImage(m, 0, 0, W, RIJEN * T)
    doolhofLaag = c
  }

  function bouwSprites() {
    const [c, g] = maakLaag(10, 10)
    const gr = g.createRadialGradient(5, 5, 0, 5, 5, 5)
    gr.addColorStop(0, rgba(ECTO, 0.6)); gr.addColorStop(1, rgba(ECTO, 0))
    g.fillStyle = gr; g.fillRect(0, 0, 10, 10)
    g.fillStyle = ECTO; g.fillRect(4.5, 3.2, 1, 1); g.fillRect(4, 4.2, 2, 2.2)
    g.fillStyle = '#eaffe4'; g.fillRect(4.3, 4.6, 0.8, 0.8)
    stipBeeld = c
    druppelBeeld = KLEUR.map(kl => {
      const [c2, g2] = maakLaag(8, 8)
      const gr2 = g2.createRadialGradient(4, 4.5, 0, 4, 4.5, 4)
      gr2.addColorStop(0, rgba(kl, 0.7)); gr2.addColorStop(1, rgba(kl, 0))
      g2.fillStyle = gr2; g2.fillRect(0, 0, 8, 8)
      g2.fillStyle = kl
      g2.fillRect(3.5, 1.5, 1, 1); g2.fillRect(3, 2.5, 2, 1); g2.fillRect(2.5, 3.5, 3, 2); g2.fillRect(3, 5.5, 2, 1)
      g2.fillStyle = '#ffffff'; g2.fillRect(3.1, 3.7, 0.8, 0.8)
      return c2
    })
    gloedBeelden = new Map()
  }

  // Alle stippen staan in één laag. Een opgegeten stip wordt uit die laag
  // gewist; dat is veel lichter dan er tweehonderd per beeldje tekenen.
  function bouwStippen() {
    const [c, g] = maakLaag(W, RIJEN * T)
    stippenLaag = c; stippenCtx = g
    if (!stippen) return
    for (let i = 0; i < stippen.length; i++) {
      if (!stippen[i]) continue
      const x = i % KOLOM, y = (i / KOLOM) | 0
      g.drawImage(stipBeeld, x * T + 3, y * T + 3, 10, 10)
    }
  }

  function wisStip(x, y) {
    if (stippenCtx) stippenCtx.clearRect(x * T, y * T, T, T)
  }

  // De gloed om een spookje is een vast plaatje per kleur, niet elk beeldje opnieuw.
  function gloed(kleur) {
    let b = gloedBeelden.get(kleur)
    if (!b) {
      const [c, g] = maakLaag(64, 64)
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, rgba(kleur, 0.4)); gr.addColorStop(1, rgba(kleur, 0))
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
      b = c; gloedBeelden.set(kleur, b)
    }
    return b
  }

  // fase laat de rok deinen; gezicht is 'normaal', 'boos' of 'bang'
  function tekenFiguur(g, cx, cy, u, kleur, gezicht, kijk, fase, alpha = 1, wit = false) {
    const x0 = cx - 7 * u, y0 = cy - 7.5 * u
    g.save()
    g.globalAlpha = alpha
    g.drawImage(gloed(kleur), cx - 13 * u, cy - 13 * u, 26 * u, 26 * u)
    const lijf = wit ? '#ffffff' : kleur
    const px = (x, y, w = 1, h = 1) => g.fillRect(x0 + x * u, y0 + y * u, w * u + 0.05, h * u + 0.05)
    pixels(g, SPOOK, x0, y0, u, lijf)
    g.fillStyle = lijf
    px(-1, 6, 1, 2); px(14, 6, 1, 2)                       // armpjes
    for (let c = 0; c < 14; c++) {                          // deinende rok
      const laag = 1.7 + Math.sin(c * 0.85 + fase) * 1.4
      px(c, 12, 1, Math.max(0.2, laag))
    }
    if (gezicht === 'bang') {
      g.fillStyle = '#ffffff'; px(2, 4, 3, 3); px(9, 4, 3, 3)
      g.fillStyle = '#1b1245'; px(3, 5); px(10, 5)
      for (let i = 0; i < 8; i++) px(3 + i, i % 2 ? 8 : 9)   // zigzagmondje
    } else if (gezicht === 'boos') {
      g.fillStyle = '#ffffff'; px(2, 4, 4, 4); px(8, 4, 4, 4)
      const [dx, dy] = RICHT[kijk] || [0, 1]
      const ox = dx < 0 ? 0 : dx > 0 ? 2 : 1, oy = dy < 0 ? 0 : dy > 0 ? 2 : 1
      g.fillStyle = '#ff2a2a'; px(2 + ox, 4 + oy, 2, 2); px(8 + ox, 4 + oy, 2, 2)
      g.fillStyle = '#2a0014'
      px(1, 2, 2, 1); px(3, 3, 2, 1); px(11, 2, 2, 1); px(9, 3, 2, 1)   // boze wenkbrauwen
      px(4, 9, 6, 2)                                                     // grijns
      g.fillStyle = '#ffffff'; px(4, 9); px(6, 9); px(8, 9); px(5, 10); px(7, 10); px(9, 10)
    } else {
      g.fillStyle = '#ffffff'; px(2, 3, 4, 5); px(8, 3, 4, 5)
      const [dx, dy] = RICHT[kijk] || [0, 1]
      const ox = dx < 0 ? 0 : dx > 0 ? 2 : 1, oy = dy < 0 ? 0 : dy > 0 ? 3 : 1.5
      g.fillStyle = '#1b1245'; px(2 + ox, 3 + oy, 2, 2); px(8 + ox, 3 + oy, 2, 2)
      g.fillStyle = 'rgba(255,255,255,0.85)'; px(2 + ox, 3 + oy, 0.7, 0.7); px(8 + ox, 3 + oy, 0.7, 0.7)
      g.fillStyle = rgba('#ff6b9d', 0.5); px(0, 8, 2, 1); px(12, 8, 2, 1)   // blosjes
      g.fillStyle = '#1b1245'; px(6, 9, 2, 2)                                // mondje
    }
    g.restore()
  }

  function tekenKroon(cx, cy, u) {
    const x0 = cx - 3.5 * u, y0 = cy - 2.5 * u
    ctx.save()
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8 * res
    pixels(ctx, KROON, x0, y0, u, '#ffd23f')
    ctx.shadowBlur = 0
    ctx.fillStyle = '#ff3b6b'
    for (const x of [1, 3, 5]) ctx.fillRect(x0 + x * u, y0 + 3 * u, u, u)
    ctx.restore()
  }

  function tekenBol(cx, cy, s = 1) {
    const p = 1 + 0.15 * Math.sin(tijd * 6)
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12 * p * s)
    gr.addColorStop(0, rgba(ECTO, 0.75)); gr.addColorStop(0.45, rgba(ECTO, 0.3)); gr.addColorStop(1, rgba(ECTO, 0))
    ctx.fillStyle = gr; ctx.fillRect(cx - 13 * s, cy - 13 * s, 26 * s, 26 * s)
    ctx.fillStyle = ECTO
    ctx.beginPath(); ctx.arc(cx, cy, 4.2 * p * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f2ffe9'; ctx.fillRect(cx - 2 * s, cy - 2.5 * s, 1.6 * s, 1.6 * s)
    for (let n = 0; n < 3; n++) {
      const h = tijd * 3 + n * 2.094
      ctx.fillStyle = rgba(ECTO, 0.9)
      ctx.fillRect(cx + Math.cos(h) * 8 * s - 0.75, cy + Math.sin(h) * 8 * s - 0.75, 1.5, 1.5)
    }
  }

  function tekenSpeler(s) {
    if (s.uit && s.uitTijd > 1.2) return
    const bx = (s.x + 0.5) * T, by = HUD + (s.y + 0.5) * T
    tekenSpelerOp(s, bx, by)
    if (bx < T) tekenSpelerOp(s, bx + W, by)
    if (bx > W - T) tekenSpelerOp(s, bx - W, by)
  }

  function tekenSpelerOp(s, cx, cy) {
    const boos = jager === s.i
    const bang = jager !== null && jager !== s.i && !s.uit
    let alpha = 1, dy = Math.sin(tijd * 6 + s.i * 2) * 0.8, dx = 0
    if (s.uit) { alpha = Math.max(0, 1 - s.uitTijd / 1.2); dy -= s.uitTijd * 14 }
    if (bang) { dx = (Math.random() - 0.5) * 0.9; dy += (Math.random() - 0.5) * 0.5 }
    const u = T * 0.95 / 14 * s.schaal
    const knipper = s.onkw > 0 && Math.floor(tijd * 14) % 2 === 0
    if (!knipper) {
      const kleur = bang || s.uit ? meng(s.kleur, BANG_BLAUW, 0.55) : s.kleur
      const wit = boos && jagerTijd < CFG.waarschuw && Math.floor(tijd * 8) % 2 === 0
      const gezicht = s.uit || bang ? 'bang' : boos ? 'boos' : 'normaal'
      tekenFiguur(ctx, cx + dx, cy + dy, u, kleur, gezicht, s.kijk, tijd * 7 + s.i * 1.3, alpha, wit)
    }
    if (!s.uit) {
      const top = cy + dy - 7.5 * u - 5
      for (let n = 0; n < s.levens; n++) {
        const lx = cx + (n - (CFG.levens - 1) / 2) * 6
        ctx.drawImage(druppelBeeld[s.i], lx - 4, top - 4 + Math.sin(tijd * 4 + n) * 0.8, 8, 8)
      }
    }
  }

  function pijl(x, y) {
    ctx.fillStyle = '#e9ddff'
    ctx.fillRect(x - 8, y - 1, 11, 2)
    ctx.fillRect(x + 2, y - 3, 2, 6); ctx.fillRect(x + 4, y - 2, 2, 4); ctx.fillRect(x + 6, y - 1, 1, 2)
  }

  function tekst(t, x, y, kleur, grootte = 10, uitlijn = 'center', gloeien = true) {
    ctx.save()
    ctx.font = `${grootte}px "Press Start 2P", monospace`
    ctx.textAlign = uitlijn; ctx.textBaseline = 'middle'
    if (gloeien) { ctx.shadowColor = kleur; ctx.shadowBlur = 6 * res }
    ctx.fillStyle = kleur; ctx.fillText(t, x, y)
    ctx.restore()
  }

  function tekenHud() {
    ctx.fillStyle = '#0d0619'; ctx.fillRect(0, 0, W, HUD)
    ctx.fillStyle = rgba(NEON, 0.6); ctx.fillRect(0, HUD - 1, W, 1)
    for (const s of spelers) {
      const links = s.i === 0
      const bang = jager !== null && jager !== s.i
      tekenFiguur(ctx, links ? 14 : W - 14, 16, 0.95,
        bang || s.uit ? meng(s.kleur, BANG_BLAUW, 0.55) : s.kleur,
        s.uit || bang ? 'bang' : jager === s.i ? 'boos' : 'normaal', links ? 'R' : 'L', tijd * 7 + s.i, s.uit ? 0.4 : 1)
      tekst(pad3(s.score), links ? 28 : W - 28, 17, s.kleur, 10, links ? 'left' : 'right', false)
    }
    const bw = 84, bx = (W - bw) / 2, by = 13, bh = 6
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, by, bw, bh)
    let frac, kleur
    if (jager !== null) { frac = Math.max(0, jagerTijd / CFG.jagerDuur); kleur = spelers[jager].kleur }
    else { frac = totaalStippen ? aantalStippen / totaalStippen : 0; kleur = ECTO }
    ctx.fillStyle = kleur; ctx.fillRect(bx, by, bw * frac, bh)
  }

  function tekenUitleg() {
    ctx.fillStyle = 'rgba(5,2,12,0.72)'; ctx.fillRect(0, 0, W, H)
    const px = 26, py = 70, pw = W - 52, ph = 186
    ctx.fillStyle = 'rgba(20,10,38,0.94)'; ctx.fillRect(px, py, pw, ph)
    ctx.save(); ctx.shadowColor = NEON; ctx.shadowBlur = 8 * res
    ctx.strokeStyle = NEON; ctx.lineWidth = 1.5; ctx.strokeRect(px + 0.75, py + 0.75, pw - 1.5, ph - 1.5)
    ctx.restore()
    const f = tijd * 7, u = 1.2
    const bangKleur = meng(KLEUR[1], BANG_BLAUW, 0.55)
    const r1 = py + 34, r2 = py + 93, r3 = py + 152
    tekenFiguur(ctx, 78, r1, u, KLEUR[0], 'normaal', 'R', f)
    pijl(112, r1)
    ctx.drawImage(stipBeeld, 140, r1 - 10, 20, 20)
    tekst('+1', 196, r1 + 1, ECTO, 11)
    tekenBol(70, r2, 0.9)
    pijl(102, r2)
    tekenFiguur(ctx, 146, r2, u * CFG.jagerGroot, KLEUR[0], 'boos', 'R', f)
    pijl(185, r2)
    tekenFiguur(ctx, 224, r2, u, bangKleur, 'bang', 'L', f)
    tekenFiguur(ctx, 70, r3, u * CFG.jagerGroot, KLEUR[0], 'boos', 'R', f)
    tekenFiguur(ctx, 96, r3, u, bangKleur, 'bang', 'L', f)
    pijl(130, r3)
    ctx.drawImage(druppelBeeld[1], 151, r3 - 9, 18, 18)
    tekst('-1', 196, r3 + 1, '#ff4d6d', 11)
  }

  function tekenEinde() {
    ctx.fillStyle = 'rgba(5,2,12,0.8)'; ctx.fillRect(0, 0, W, H)
    const max = Math.max(...spelers.map(s => s.score))
    for (const s of spelers) {
      const cx = W * (s.i ? 0.7 : 0.3), cy = H * 0.42
      const win = s.score === max
      const u = win ? 2.6 : 2
      const dy = win ? Math.sin(tijd * 4 + s.i) * 3 : 0
      tekenFiguur(ctx, cx, cy + dy, u, win ? s.kleur : meng(s.kleur, BANG_BLAUW, 0.55),
        win ? 'normaal' : 'bang', 'D', tijd * 6 + s.i, win ? 1 : 0.75)
      if (win) tekenKroon(cx, cy + dy - 7.5 * u - 10, 2.4)
      tekst(pad3(s.score), cx, cy + 7.5 * u + 22, s.kleur, 14)
      for (let n = 0; n < CFG.levens; n++) {
        ctx.globalAlpha = n < s.levens ? 1 : 0.18
        ctx.drawImage(druppelBeeld[s.i], cx + (n - 1) * 12 - 6, cy + 7.5 * u + 38, 12, 12)
        ctx.globalAlpha = 1
      }
    }
  }

  function teken() {
    ctx.setTransform(res, 0, 0, res, 0, 0)
    ctx.fillStyle = ACHTER; ctx.fillRect(0, 0, W, H)
    ctx.save()
    if (schud > 0) ctx.translate((Math.random() - 0.5) * schud * 14, (Math.random() - 0.5) * schud * 14)
    if (doolhofLaag) ctx.drawImage(doolhofLaag, 0, HUD, W, RIJEN * T)
    if (stippenLaag) {
      ctx.globalAlpha = 0.78 + 0.22 * Math.sin(tijd * 3)
      ctx.drawImage(stippenLaag, 0, HUD, W, RIJEN * T)
      ctx.globalAlpha = 1
    }
    if (bol) tekenBol((bol.x + 0.5) * T, HUD + (bol.y + 0.5) * T)
    for (const p of deeltjes) {
      ctx.globalAlpha = Math.max(0, p.t / p.max)
      ctx.fillStyle = p.kleur; ctx.fillRect(p.x - p.g / 2, p.y - p.g / 2, p.g, p.g)
    }
    ctx.globalAlpha = 1
    const volgorde = [...spelers].sort((a, b) => (a.i === jager) - (b.i === jager))
    for (const s of volgorde) tekenSpeler(s)
    ctx.restore()

    tekenHud()
    if (flits > 0) { ctx.fillStyle = rgba(ECTO, flits * 1.2); ctx.fillRect(0, HUD, W, RIJEN * T) }

    if (staat === 'start') tekenUitleg()
    if (staat === 'aftellen') {
      const n = Math.ceil(aftel), f = aftel - Math.floor(aftel)
      ctx.fillStyle = 'rgba(5,2,12,0.35)'; ctx.fillRect(0, HUD, W, RIJEN * T)
      if (n > 0) tekst(String(n), W / 2, HUD + RIJEN * T / 2, ECTO, 26 + 22 * f)
    }
    if (staat === 'einde') {
      tekenEinde()
      for (const p of deeltjes) {
        ctx.globalAlpha = Math.max(0, p.t / p.max)
        ctx.fillStyle = p.kleur; ctx.fillRect(p.x - p.g / 2, p.y - p.g / 2, p.g, p.g)
      }
      ctx.globalAlpha = 1
    }
  }

  // ═══════════════ Indeling ═══════════════
  function indeling() {
    const volB = wrap.clientWidth, volH = wrap.clientHeight
    if (!volB || !volH) return
    wrap.classList.toggle('liggend', volB > volH)
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
    bouwDoolhof(); bouwSprites(); bouwStippen()
  }

  // ═══════════════ Bediening ═══════════════
  function zet(i, r) { const s = spelers[i]; if (s && !s.ai && !s.uit) s.volgende = r }

  function bijToets(e) {
    if (!draait) return
    const a = document.activeElement
    if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return
    const pijlen = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' }
    const wasd = { a: 'L', d: 'R', w: 'U', s: 'D', A: 'L', D: 'R', W: 'U', S: 'D' }
    if (pijlen[e.key]) { e.preventDefault(); zet(tweeSpelers ? 1 : 0, pijlen[e.key]) }
    else if (wasd[e.key]) zet(0, wasd[e.key])
    else if ((e.key === ' ' || e.key === 'Enter') && (staat === 'start' || (staat === 'einde' && eindTijd > 0.7))) {
      e.preventDefault(); startRonde()
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
    for (const t of e.changedTouches) {
      const a = vegen.get(t.identifier); if (!a) continue
      const dx = t.clientX - a.x, dy = t.clientY - a.y
      if (Math.hypot(dx, dy) < 18) continue
      const r = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U')
      const vak = doek.getBoundingClientRect()
      zet(tweeSpelers && t.clientX >= vak.left + vak.width / 2 ? 1 : 0, r)
      a.x = t.clientX; a.y = t.clientY
    }
  }, { passive: false })
  const losLaten = e => { for (const t of e.changedTouches) vegen.delete(t.identifier) }
  scherm.addEventListener('touchend', losLaten)
  scherm.addEventListener('touchcancel', losLaten)
  // Begint de veeg naast het veld (in de randstrook), dan telt hij ook mee.
  wrap.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) if (!vegen.has(t.identifier)) vegen.set(t.identifier, { x: t.clientX, y: t.clientY })
  }, { passive: true })
  wrap.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      const a = vegen.get(t.identifier); if (!a) continue
      const dx = t.clientX - a.x, dy = t.clientY - a.y
      if (Math.hypot(dx, dy) < 18) continue
      const r = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U')
      const vak = doek.getBoundingClientRect()
      zet(tweeSpelers && t.clientX >= vak.left + vak.width / 2 ? 1 : 0, r)
      a.x = t.clientX; a.y = t.clientY
    }
  }, { passive: true })
  wrap.addEventListener('touchend', losLaten)
  wrap.addEventListener('touchcancel', losLaten)

  // Eerste echte tik: geluid van het slot (verplicht op de iPhone).
  const bijEersteTik = e => { if (e.isTrusted !== false) geluid.ontgrendel() }
  wrap.addEventListener('pointerdown', bijEersteTik, { passive: true })
  wrap.addEventListener('touchstart', bijEersteTik, { passive: true })

  wrap.querySelector('.kSpeel').addEventListener('click', startRonde)
  wrap.querySelector('.kOpnieuw').addEventListener('click', startRonde)
  wrap.querySelector('.kModus').addEventListener('click', e => {
    tweeSpelers = !tweeSpelers
    e.currentTarget.textContent = tweeSpelers ? '👤🆚👤' : '👤🆚🤖'
    reset(); indeling()
  })
  wrap.querySelector('.kGeluid').addEventListener('click', e => {
    geluidAan = !geluidAan
    e.currentTarget.textContent = geluidAan ? '🔊' : '🔇'
    if (geluidAan) geluid.init(); else geluid.jachtStop()
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
    geluid.jachtStop()
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
      console.error('[spookjes]', e)
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
      get staat() { return staat }, get spelers() { return spelers }, get jager() { return jager },
      get bol() { return bol }, get stippen() { return aantalStippen },
      startRonde, update, teken, reset, zet,
      zetAI: (i, v) => { spelers[i].ai = v },
    },
  }
}
