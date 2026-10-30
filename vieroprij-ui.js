// vieroprij-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.
// v147: teksten ook in het Engels (taal.js)
// 30 okt 2026 (Four in a Row v2): plastic speelgoed. Een glanzend blauw rek (voorpaneel met ronde gaten, pootjes
// eronder) en glimmende rode en gele schijven met een opstaand randje. Een schijf valt van boven door de kolom
// (achter het voorpaneel langs) en stuitert na; het geluid klinkt bij het landen. Tik op een hele kolom; boven het
// rek zie je waar je schijf erin gaat. Alles met CSS en SVG. De berichten naar de tegenstander zijn hetzelfde;
// de rij rekent elk scherm zelf uit (een vreemde of dubbele zet telt niet).
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m)) // taal.js (v147)

// Tekst veilig in HTML zetten (namen komen van andere gebruikers)
const htmlVeilig = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Maten (px): een vakje is 38, met 6 ertussen en 10 rand
const CEL = 38, TUSSEN = 6, RAND = 10, SCHIJF = 32
const plek = n => RAND + n * (CEL + TUSSEN)          // linker- of bovenkant van kolom/rij n
const midden = n => plek(n) + CEL / 2

const STIJL = `
.vor-speelgoed { position:relative; display:flex; flex-direction:column; align-items:center; }
.vor-rail { position:relative; height:44px; }
.vor-zweef { position:absolute; top:6px; width:${SCHIJF}px; height:${SCHIJF}px; transition:left .12s ease-out, opacity .15s; opacity:0; pointer-events:none; }
.vor-rek { position:relative; border-radius:16px; }
.vor-binnen { position:absolute; inset:4px; border-radius:12px; background:radial-gradient(ellipse at 50% 30%, #1d2a5c, #0b1230 75%); }
.vor-schijven { position:absolute; inset:0; overflow:hidden; border-radius:16px; }
.vor-schijf { position:absolute; width:${SCHIJF}px; height:${SCHIJF}px; border-radius:50%; }
.vor-schijf.rood { background:radial-gradient(circle at 34% 30%, #ff9b8f 0%, #f0453a 32%, #c81e1e 70%, #8f1111 100%);
  box-shadow: inset 0 0 0 4px rgba(120,10,10,0.35), inset 0 0 0 6px rgba(255,170,160,0.35), inset 0 -3px 5px rgba(80,0,0,0.45); }
.vor-schijf.geel { background:radial-gradient(circle at 34% 30%, #fff6c4 0%, #ffd83a 32%, #f2b20d 70%, #b77f00 100%);
  box-shadow: inset 0 0 0 4px rgba(150,95,0,0.32), inset 0 0 0 6px rgba(255,245,190,0.45), inset 0 -3px 5px rgba(120,70,0,0.4); }
.vor-schijf::after { content:''; position:absolute; left:22%; top:14%; width:34%; height:20%; border-radius:50%;
  background:linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0)); transform:rotate(-20deg); }
.vor-schijf.valt { animation: vorVal var(--duur) both; }
@keyframes vorVal {
  0%   { transform: translateY(var(--val)); animation-timing-function: cubic-bezier(.55,0,1,.45); }
  72%  { transform: translateY(0); animation-timing-function: cubic-bezier(0,.55,.45,1); }
  84%  { transform: translateY(-7px); animation-timing-function: cubic-bezier(.55,0,1,.45); }
  93%  { transform: translateY(0); animation-timing-function: cubic-bezier(0,.55,.45,1); }
  97%  { transform: translateY(-2px); }
  100% { transform: translateY(0); } }
.vor-schijf.win { animation: vorWin .7s ease-in-out infinite alternate; z-index:1; }
@keyframes vorWin { from { filter: brightness(1); } to { filter: brightness(1.35) drop-shadow(0 0 6px #fff); } }
.vor-voor { position:absolute; inset:0; pointer-events:none; filter: drop-shadow(0 10px 14px rgba(0,0,0,0.5)); }
.vor-kolommen { position:absolute; inset:0; display:flex; padding:0 ${RAND - TUSSEN / 2}px; }
.vor-kolom { flex:1; border:0; background:transparent; cursor:pointer; padding:0; border-radius:10px; -webkit-tap-highlight-color:transparent; }
.vor-kolom:disabled { cursor:default; }
.vor-kolom:not(:disabled):hover, .vor-kolom:focus-visible { background:rgba(255,255,255,0.08); outline:none; }
.vor-poten { display:flex; justify-content:space-between; width:calc(100% + 18px); margin-top:-6px; }
.vor-poot { width:34px; height:26px; background:linear-gradient(180deg,#3d7bff,#1c45c2); border-radius:6px 6px 10px 10px;
  clip-path: polygon(22% 0, 78% 0, 100% 100%, 0 100%); box-shadow: inset 0 3px 0 rgba(255,255,255,0.3); }
@media (prefers-reduced-motion: reduce) { .vor-schijf.valt, .vor-schijf.win { animation:none; } }
`

// Het voorpaneel: blauw plastic met gaten (een masker), een randje om elk gat en een glansrand
function voorpaneel(B, H, KOL, RIJ) {
  let gaten = '', randjes = ''
  for (let r = 0; r < RIJ; r++) for (let k = 0; k < KOL; k++) {
    const x = midden(k), y = midden(r)
    gaten += `<circle cx="${x}" cy="${y}" r="${SCHIJF / 2 + 1.5}" fill="black"/>`
    randjes += `<circle cx="${x}" cy="${y}" r="${SCHIJF / 2 + 2.5}" fill="none" stroke="rgba(10,30,110,0.55)" stroke-width="2"/>` +
      `<path d="M${x - 13} ${y + 9} A16 16 0 0 0 ${x + 13} ${y + 9}" fill="none" stroke="rgba(170,205,255,0.55)" stroke-width="1.5"/>`
  }
  return `<svg class="vor-voor" width="${B}" height="${H}" viewBox="0 0 ${B} ${H}" aria-hidden="true">
    <defs>
      <linearGradient id="vorPlastic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c8bff"/><stop offset=".45" stop-color="#2a63f0"/><stop offset="1" stop-color="#1a3fb5"/></linearGradient>
      <linearGradient id="vorGlans" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,0)"/><stop offset=".5" stop-color="rgba(255,255,255,0.35)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></linearGradient>
      <mask id="vorGaten"><rect width="${B}" height="${H}" rx="16" fill="white"/>${gaten}</mask>
    </defs>
    <g mask="url(#vorGaten)">
      <rect width="${B}" height="${H}" rx="16" fill="url(#vorPlastic)"/>
      <rect x="8" y="3" width="${B - 16}" height="5" rx="2.5" fill="url(#vorGlans)"/>
      <rect x="1" y="1" width="${B - 2}" height="${H - 2}" rx="15" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
      <rect x="0.5" y="0.5" width="${B - 1}" height="${H - 1}" rx="15.5" fill="none" stroke="rgba(10,25,90,0.6)" stroke-width="1"/>
    </g>
    ${randjes}
  </svg>`
}

export function start({ Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
  vriendNaam = vriendNaam || T('vriend')
  document.getElementById('spelTitelBar').textContent = '🔴 Four in a Row'
  const inhoud = document.getElementById('spelInhoud')
  const KOLOMMEN = 7
  const RIJEN = 6
  let bord = Array(RIJEN).fill(null).map(() => Array(KOLOMMEN).fill(null))
  let mijnBeurt = benIkSpeler1
  let gameOver = false
  const mijnKleur = benIkSpeler1 ? 'rood' : 'geel'
  const vriendKleur = benIkSpeler1 ? 'geel' : 'rood'
  let beginner = benIkSpeler1  // wisselt elke ronde, zodat het eerlijk blijft
  let scoreIk = 0, scoreVriend = 0, scoreGelijk = 0
  let laatste = null  // [rij, kolom] van de schijf die nu valt
  const KLEUR_HEX = { rood: '#ef4444', geel: '#fbbf24' }
  const B = 2 * RAND + KOLOMMEN * CEL + (KOLOMMEN - 1) * TUSSEN
  const H = 2 * RAND + RIJEN * CEL + (RIJEN - 1) * TUSSEN

  if (!document.getElementById('vor-stijl')) {
    const st = document.createElement('style'); st.id = 'vor-stijl'; st.textContent = STIJL; document.head.appendChild(st)
  }
  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
      <div id="vor-status" style="color:white;font-size:15px;font-weight:600;text-align:center;">${T('Jij speelt')} <span style="color:${KLEUR_HEX[mijnKleur]}">●</span> ${mijnKleur === 'rood' ? T('rood') : T('geel')}${mijnBeurt ? T(' — jouw beurt!') : T(' — wachten...')}</div>
      <div id="vor-score" style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:-6px;"></div>
      <div class="vor-speelgoed">
        <div class="vor-rail" style="width:${B}px"><div id="vor-zweef" class="vor-zweef vor-schijf ${mijnKleur}"></div></div>
        <div class="vor-rek" style="width:${B}px;height:${H}px">
          <div class="vor-binnen"></div>
          <div id="vor-schijven" class="vor-schijven"></div>
          ${voorpaneel(B, H, KOLOMMEN, RIJEN)}
          <div id="vor-kolommen" class="vor-kolommen" role="group" aria-label="${T('Kolommen')}"></div>
        </div>
        <div class="vor-poten" aria-hidden="true"><div class="vor-poot"></div><div class="vor-poot"></div></div>
      </div>
      <button id="vor-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">${T('↻ Opnieuw spelen')}</button>
    </div>`

  const schijvenEl = document.getElementById('vor-schijven')
  const kolommenEl = document.getElementById('vor-kolommen')
  const zweefEl = document.getElementById('vor-zweef')
  const statusEl = document.getElementById('vor-status')
  const opnieuwBtn = document.getElementById('vor-opnieuw')
  const scoreEl = document.getElementById('vor-score')
  try { Bordgeluid.knop(statusEl) } catch (e) {}

  // De kolommen: grote knoppen over het hele rek (ook met het toetsenbord)
  const kolomKnoppen = []
  for (let k = 0; k < KOLOMMEN; k++) {
    const knop = document.createElement('button')
    knop.type = 'button'; knop.className = 'vor-kolom'
    knop.setAttribute('aria-label', T('Kolom {n}', { n: k + 1 }))
    knop.addEventListener('click', () => zetDoen(k))
    // Boven het rek zweeft je schijf boven de kolom waar je bent
    const toon = () => { if (mijnBeurt && !gameOver && eersteVrijeRij(k) >= 0) { zweefEl.style.left = (midden(k) - SCHIJF / 2) + 'px'; zweefEl.style.opacity = '1' } }
    knop.addEventListener('mouseenter', toon); knop.addEventListener('focus', toon)
    knop.addEventListener('mouseleave', () => { zweefEl.style.opacity = '0' }); knop.addEventListener('blur', () => { zweefEl.style.opacity = '0' })
    kolommenEl.appendChild(knop); kolomKnoppen.push(knop)
  }

  function toonScore() {
    const naam = vriendNaam
    scoreEl.textContent = T('Jij {ik} · {naam} {vriend} · {gelijk} gelijk', { ik: scoreIk, naam, vriend: scoreVriend, gelijk: scoreGelijk })
  }

  function nieuweRonde() {
    bord = Array(RIJEN).fill(null).map(() => Array(KOLOMMEN).fill(null))
    gameOver = false
    winLijn = []
    laatste = null
    beginner = !beginner
    mijnBeurt = beginner
    opnieuwBtn.style.display = 'none'
    verwerkBeurt()
  }

  // Hoe lang valt een schijf over zoveel rijen? (een beetje zoals echte zwaartekracht: langer, maar niet evenredig)
  const valDuur = rijen => Math.round(260 + 95 * Math.sqrt(rijen + 1) * 2)

  function tekenBord() {
    schijvenEl.innerHTML = ''
    for (let r = 0; r < RIJEN; r++) {
      for (let k = 0; k < KOLOMMEN; k++) {
        const cel = bord[r][k]
        if (!cel) continue
        const schijf = document.createElement('div')
        const isWinnend = winLijn.some(([wr, wk]) => wr === r && wk === k)
        schijf.className = 'vor-schijf ' + cel + (isWinnend ? ' win' : '')
        schijf.style.left = (midden(k) - SCHIJF / 2) + 'px'
        schijf.style.top = (midden(r) - SCHIJF / 2) + 'px'
        if (laatste && laatste[0] === r && laatste[1] === k && !isWinnend) {
          // Deze valt nog: van boven het rek naar zijn plek
          schijf.classList.add('valt')
          schijf.style.setProperty('--val', -(midden(r) + SCHIJF) + 'px')
          schijf.style.setProperty('--duur', valDuur(r) + 'ms')
        }
        schijvenEl.appendChild(schijf)
      }
    }
    for (let k = 0; k < KOLOMMEN; k++) {
      const vol = eersteVrijeRij(k) === -1
      kolomKnoppen[k].disabled = gameOver || !mijnBeurt || vol
      kolomKnoppen[k].setAttribute('aria-label', vol ? T('Kolom {n} (vol)', { n: k + 1 }) : T('Kolom {n}', { n: k + 1 }))
    }
    if (!mijnBeurt || gameOver) zweefEl.style.opacity = '0'
  }

  function eersteVrijeRij(kolom) {
    for (let r = RIJEN - 1; r >= 0; r--) {
      if (!bord[r][kolom]) return r
    }
    return -1
  }

  let winLijn = []

  function checkWinnaar() {
    const richtingen = [[0,1],[1,0],[1,1],[1,-1]]
    for (let r = 0; r < RIJEN; r++) {
      for (let k = 0; k < KOLOMMEN; k++) {
        const kleur = bord[r][k]
        if (!kleur) continue
        for (const [dr, dk] of richtingen) {
          const posities = [[r,k]]
          for (let i = 1; i < 4; i++) {
            const nr = r + dr*i, nk = k + dk*i
            if (nr < 0 || nr >= RIJEN || nk < 0 || nk >= KOLOMMEN || bord[nr][nk] !== kleur) break
            posities.push([nr, nk])
          }
          if (posities.length >= 4) { winLijn = posities; return kleur }
        }
      }
    }
    if (bord.every(rij => rij.every(c => c))) return 'gelijk'
    return null
  }

  // Het geluid klinkt pas als de schijf landt
  function plofGeluid(rij) {
    const wacht = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.round(valDuur(rij) * 0.72)
    setTimeout(() => { try { Bordgeluid.geluid('damzet') } catch (e) {} }, wacht)
    return wacht
  }

  function zetDoen(kolom) {
    if (gameOver || !mijnBeurt) return
    const rij = eersteVrijeRij(kolom)
    if (rij === -1) return // kolom vol
    bord[rij][kolom] = mijnKleur
    laatste = [rij, kolom]
    mijnBeurt = false
    zweefEl.style.opacity = '0'
    const wacht = plofGeluid(rij)
    verstuurZet(kolom, rij)
    verwerkBeurt(wacht)
  }

  // wacht: de uitslag (winst, gelijk) pas laten zien als de schijf geland is
  function verwerkBeurt(wacht) {
    const winnaar = checkWinnaar()
    if (winnaar) {
      gameOver = true
      const lijn = winLijn
      winLijn = []  // eerst laten vallen, daarna oplichten
      toonScore()
      tekenBord()
      setTimeout(() => {
        winLijn = lijn
        if (winnaar === 'gelijk') { scoreGelijk++; statusEl.textContent = T('🤝 Gelijkspel — bord vol!'); Bordgeluid.geluid('remise') }
        else if (winnaar === mijnKleur) { scoreIk++; statusEl.textContent = T('🎉 Jij wint!'); Bordgeluid.geluid('win') }
        else { scoreVriend++; statusEl.textContent = T('😢 {naam} wint!', { naam: vriendNaam }); Bordgeluid.geluid('verlies') }
        opnieuwBtn.textContent = T('↻ Volgende ronde')
        opnieuwBtn.style.display = 'block'
        laatste = null
        toonScore()
        tekenBord()
      }, (wacht || 0) + 120)
      return
    }
    statusEl.innerHTML = mijnBeurt
      ? T('Jouw beurt!') + ' <span style="color:' + KLEUR_HEX[mijnKleur] + '">●</span>'
      : T('Wachten op {naam}...', { naam: htmlVeilig(vriendNaam) })
    toonScore()
    tekenBord()
  }

  function verstuurZet(kolom, rij) {
    spelKanaal.send({ type: 'broadcast', event: 'zet', payload: { kolom, rij, kleur: mijnKleur } })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, (msg) => {
    const { kolom, kleur } = msg.payload || {}
    if (kleur === mijnKleur) return
    // Alleen een geldige zet van de ander, op zijn beurt. De rij rekenen we zelf uit (zwaartekracht).
    if (kleur !== vriendKleur || gameOver || mijnBeurt || !Number.isInteger(kolom) || kolom < 0 || kolom >= KOLOMMEN) return
    const rij = eersteVrijeRij(kolom)
    if (rij === -1) return
    bord[rij][kolom] = kleur
    laatste = [rij, kolom]
    mijnBeurt = true
    const wacht = plofGeluid(rij)
    verwerkBeurt(wacht)
  })

  spelKanaal.on('broadcast', { event: 'opnieuw' }, () => nieuweRonde())

  opnieuwBtn.addEventListener('click', () => {
    nieuweRonde()
    spelKanaal.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
  })

  toonScore()
  tekenBord()
}
