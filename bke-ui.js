// bke-ui.js - boter-kaas-en-eieren voor Fibro.
// Het spel tekent zichzelf in #spelInhoud en praat met de tegenstander via
// het spelkanaal dat chat.html aanlevert.
// v147: teksten ook in het Engels (taal.js)
// 30 okt 2026 (Tic-Tac-Toe v2): een houten bord (eiken, met nerf en negen uitgefreesde vakjes) en houten stukken:
// X is rood geverfd hout, O blauw geverfd hout (de nerf schijnt erdoor). Een nieuw stuk wordt neergelegd (kleine val), op je beurt zie je
// waar je stuk zou komen, en bij winst lichten de drie stukken op. Alles met CSS en SVG, geen plaatjes.
// De spelregels en de berichten naar de tegenstander zijn niet veranderd.
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m)) // taal.js (v147)

// Houtnerf als achtergrond: SVG-ruis die in de lengte is uitgerekt (data:-adres; de huisregel staat data: toe)
const NERF = (kleur, freq, alfa) => "url(\"data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' seed='7'/>` +
  `<feColorMatrix values='0 0 0 0 ${kleur[0]}  0 0 0 0 ${kleur[1]}  0 0 0 0 ${kleur[2]}  0 0 0 ${alfa} 0'/></filter><rect width='300' height='300' filter='url(#n)'/></svg>`
) + "\")"

const STIJL = `
.bke-plank { position:relative; padding:14px; border-radius:18px;
  background:${NERF([0.22, 0.12, 0.05], '0.012 0.22', 0.55)}, linear-gradient(160deg,#c48a52 0%,#a8703c 45%,#8f5c2f 100%);
  box-shadow: 0 14px 30px rgba(0,0,0,0.55), 0 3px 0 #5e3a1a, inset 0 2px 0 rgba(255,232,190,0.45), inset 0 -3px 6px rgba(60,30,10,0.45); }
.bke-plank::after { content:''; position:absolute; inset:5px; border-radius:14px; pointer-events:none;
  box-shadow: inset 0 0 0 1px rgba(60,30,10,0.35), inset 0 0 0 2px rgba(255,225,180,0.12); }
.bke-raster { display:grid; grid-template-columns:repeat(3,84px); grid-template-rows:repeat(3,84px); gap:10px; }
.bke-vak { position:relative; border-radius:12px; display:flex; align-items:center; justify-content:center;
  background:${NERF([0.18, 0.09, 0.03], '0.014 0.26', 0.5)}, linear-gradient(170deg,#93602f,#a5703e);
  box-shadow: inset 0 4px 7px rgba(40,18,4,0.6), inset 0 -2px 2px rgba(255,220,170,0.22), 0 1px 0 rgba(255,230,190,0.25);
  -webkit-tap-highlight-color:transparent; }
.bke-vak.kan { cursor:pointer; }
.bke-vak.kan:hover .bke-geest, .bke-vak.kan:focus-visible .bke-geest { opacity:0.32; }
.bke-vak:focus-visible { outline:2px solid #ffe2a8; outline-offset:2px; }
.bke-geest { position:absolute; opacity:0; transition:opacity .15s; pointer-events:none; filter:grayscale(0.2); }
.bke-stuk { width:66px; height:66px; filter: drop-shadow(0 4px 3px rgba(30,12,2,0.55)); }
.bke-stuk.nieuw { animation: bkeLeg .32s cubic-bezier(.3,1.4,.5,1) both; }
@keyframes bkeLeg { 0% { transform: translateY(-14px) scale(1.18); opacity:0; filter: drop-shadow(0 16px 8px rgba(30,12,2,0.35)); }
  70% { transform: translateY(1px) scale(0.97); opacity:1; } 100% { transform:none; } }
.bke-vak.win { box-shadow: inset 0 4px 7px rgba(40,18,4,0.6), 0 0 0 3px #ffd36b, 0 0 18px rgba(255,200,90,0.8); }
.bke-vak.win .bke-stuk { animation: bkeWin 1.1s ease-in-out infinite alternate; }
@keyframes bkeWin { from { transform: scale(1); } to { transform: scale(1.08); filter: drop-shadow(0 0 8px rgba(255,214,120,0.95)) drop-shadow(0 4px 3px rgba(30,12,2,0.5)); } }
@media (prefers-reduced-motion: reduce) { .bke-stuk.nieuw, .bke-vak.win .bke-stuk { animation:none; } }
`

// Gedeelde SVG-definities: houtkleuren, nerf in de stukken en een glanslicht. Eén keer per pagina.
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="bkeRood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a74"/><stop offset=".5" stop-color="#e2412f"/><stop offset="1" stop-color="#a5221a"/></linearGradient>
  <linearGradient id="bkeBlauw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fb4ff"/><stop offset=".5" stop-color="#2f6fd6"/><stop offset="1" stop-color="#1b3f8c"/></linearGradient>
  <filter id="bkeNerf" filterUnits="userSpaceOnUse" x="0" y="0" width="66" height="66">
    <feTurbulence type="fractalNoise" baseFrequency="0.02 0.35" numOctaves="2" seed="3" result="r"/>
    <feColorMatrix in="r" values="0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0 0.04  0 0 0 0.6 -0.12" result="lijn"/>
    <feComposite in="lijn" in2="SourceGraphic" operator="in" result="nerf"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="nerf"/></feMerge>
  </filter>
</defs></svg>`

// Een houten stuk als SVG. X: twee gekruiste latjes. O: een ring. Met een randje en een glansstreep.
function stukSvg(symbool) {
  if (symbool === 'X') {
    const lat = hoek => `<rect x="27" y="4" width="12" height="58" rx="6" transform="rotate(${hoek} 33 33)" fill="url(#bkeRood)" stroke="#6e150f" stroke-width="1.5" filter="url(#bkeNerf)"/>`
    return `<svg class="bke-stuk" viewBox="0 0 66 66" aria-hidden="true">${lat(45)}${lat(-45)}
      <path d="M17 13 L23 19" stroke="rgba(255,255,255,0.55)" stroke-width="2.5" stroke-linecap="round"/></svg>`
  }
  return `<svg class="bke-stuk" viewBox="0 0 66 66" aria-hidden="true">
    <circle cx="33" cy="33" r="22" fill="none" stroke="#0f2457" stroke-width="15.5"/>
    <circle cx="33" cy="33" r="22" fill="none" stroke="url(#bkeBlauw)" stroke-width="13" filter="url(#bkeNerf)"/>
    <path d="M18 22 A19 19 0 0 1 30 13" fill="none" stroke="rgba(255,225,190,0.5)" stroke-width="2.5" stroke-linecap="round"/></svg>`
}

export function start({ Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
  vriendNaam = vriendNaam || T('vriend')
  document.getElementById('spelTitelBar').textContent = '⭕ Tic-Tac-Toe'
  const inhoud = document.getElementById('spelInhoud')
  let bord = Array(9).fill(null)
  let mijnBeurt = benIkSpeler1  // speler 1 (X) begint
  let beginner = benIkSpeler1  // wisselt elke ronde, zodat het eerlijk blijft
  let scoreIk = 0, scoreVriend = 0, scoreGelijk = 0
  let gameOver = false
  let laatsteZet = -1, winLijn = null
  const mijnSymbool = benIkSpeler1 ? 'X' : 'O'
  const vriendSymbool = benIkSpeler1 ? 'O' : 'X'

  if (!document.getElementById('bke-stijl')) {
    const st = document.createElement('style'); st.id = 'bke-stijl'; st.textContent = STIJL; document.head.appendChild(st)
  }
  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:20px;">
      ${DEFS}
      <div id="bke-status" style="color:white;font-size:16px;font-weight:600;">${mijnBeurt ? T('Jij bent {s} — jouw beurt!', { s: mijnSymbool }) : T('Jij bent {s} — wachten...', { s: mijnSymbool })}</div>
      <div id="bke-score" style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:-12px;"></div>
      <div class="bke-plank"><div id="bke-bord" class="bke-raster" role="grid" aria-label="${T('Speelbord')}"></div></div>
      <button id="bke-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">${T('↻ Opnieuw spelen')}</button>
    </div>`

  const bordEl = document.getElementById('bke-bord')
  const statusEl = document.getElementById('bke-status')
  const opnieuwBtn = document.getElementById('bke-opnieuw')
  const scoreEl = document.getElementById('bke-score')
  try { Bordgeluid.knop(statusEl) } catch (e) {}

  function toonScore() {
    const naam = vriendNaam
    scoreEl.textContent = T('Jij {ik} · {naam} {vriend} · {gelijk} gelijk', { ik: scoreIk, naam, vriend: scoreVriend, gelijk: scoreGelijk })
  }

  function nieuweRonde() {
    bord = Array(9).fill(null)
    gameOver = false
    laatsteZet = -1; winLijn = null
    beginner = !beginner
    mijnBeurt = beginner
    opnieuwBtn.style.display = 'none'
    verwerkBeurt()
  }

  const RIJ = [T('boven'), T('midden'), T('onder')], KOL = [T('links'), T('midden'), T('rechts')]
  function tekenBord() {
    bordEl.innerHTML = ''
    bord.forEach((cel, i) => {
      const vakje = document.createElement('div')
      const kan = !cel && mijnBeurt && !gameOver
      vakje.className = 'bke-vak' + (kan ? ' kan' : '') + (winLijn && winLijn.includes(i) ? ' win' : '')
      vakje.setAttribute('role', 'gridcell')
      const plek = i === 4 ? T('midden') : RIJ[Math.floor(i / 3)] + ' ' + KOL[i % 3]
      vakje.setAttribute('aria-label', cel ? T('{plek}: {s}', { plek, s: cel }) : T('{plek}: leeg', { plek }))
      if (cel) {
        vakje.innerHTML = stukSvg(cel)
        if (i === laatsteZet) vakje.firstElementChild.classList.add('nieuw')
      } else if (kan) {
        // Een schim van je eigen stuk: zo zie je waar het komt (muis of toetsenbord)
        vakje.innerHTML = stukSvg(mijnSymbool)
        vakje.firstElementChild.classList.add('bke-geest')
        vakje.tabIndex = 0
        vakje.addEventListener('click', () => zetDoen(i))
        vakje.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zetDoen(i) } })
      }
      bordEl.appendChild(vakje)
    })
  }

  // Geeft { winnaar, lijn } (lijn = de drie vakjes) of null
  function checkWinnaar(b) {
    const lijnen = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
    for (const lijn of lijnen) {
      const [a,c,d] = lijn
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winnaar: b[a], lijn }
    }
    if (b.every(x => x)) return { winnaar: 'gelijk', lijn: null }
    return null
  }

  function zetDoen(i) {
    if (bord[i] || gameOver || !mijnBeurt) return
    bord[i] = mijnSymbool
    laatsteZet = i
    mijnBeurt = false
    Bordgeluid.geluid('zet')
    verstuurZet(i)
    verwerkBeurt()
  }

  function verwerkBeurt() {
    const uitslag = checkWinnaar(bord)
    if (uitslag) {
      const winnaar = uitslag.winnaar
      gameOver = true
      winLijn = uitslag.lijn
      if (winnaar === 'gelijk') { scoreGelijk++; statusEl.textContent = T('🤝 Gelijkspel!'); Bordgeluid.geluid('remise') }
      else if (winnaar === mijnSymbool) { scoreIk++; statusEl.textContent = T('🎉 Jij wint!'); Bordgeluid.geluid('win') }
      else { scoreVriend++; statusEl.textContent = T('😢 {naam} wint!', { naam: vriendNaam }); Bordgeluid.geluid('verlies') }
      opnieuwBtn.textContent = T('↻ Volgende ronde')
      opnieuwBtn.style.display = 'block'
    } else {
      statusEl.textContent = mijnBeurt ? T('Jouw beurt!') : T('Wachten op {naam}...', { naam: vriendNaam })
    }
    toonScore()
    tekenBord()
  }

  function verstuurZet(i) {
    spelKanaal.send({ type: 'broadcast', event: 'zet', payload: { i, symbool: mijnSymbool } })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, (msg) => {
    const { i, symbool } = msg.payload
    if (symbool === mijnSymbool) return // eigen zet niet dubbel verwerken
    if (!Number.isInteger(i) || i < 0 || i > 8 || bord[i] || symbool !== vriendSymbool) return // alleen een geldige zet
    bord[i] = symbool
    laatsteZet = i
    mijnBeurt = true
    Bordgeluid.geluid('zet')
    verwerkBeurt()
  })

  spelKanaal.on('broadcast', { event: 'opnieuw' }, () => nieuweRonde())

  opnieuwBtn.addEventListener('click', () => {
    nieuweRonde()
    spelKanaal.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
  })

  toonScore()
  tekenBord()

}
