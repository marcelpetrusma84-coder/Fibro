// vieroprij-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.

export function start({ Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
  vriendNaam = vriendNaam || 'vriend'
  document.getElementById('spelTitelBar').textContent = '🔴 Vier op een rij'
  const inhoud = document.getElementById('spelInhoud')
  const KOLOMMEN = 7
  const RIJEN = 6
  let bord = Array(RIJEN).fill(null).map(() => Array(KOLOMMEN).fill(null))
  let mijnBeurt = benIkSpeler1
  let gameOver = false
  const mijnKleur = benIkSpeler1 ? 'rood' : 'geel'
  let beginner = benIkSpeler1  // wisselt elke ronde, zodat het eerlijk blijft
  let scoreIk = 0, scoreVriend = 0, scoreGelijk = 0
  const KLEUR_HEX = { rood: '#ef4444', geel: '#fbbf24' }

  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
      <div id="vor-status" style="color:white;font-size:15px;font-weight:600;text-align:center;">Jij speelt <span style="color:${KLEUR_HEX[mijnKleur]}">●</span> ${mijnKleur}${mijnBeurt ? ' — jouw beurt!' : ' — wachten...'}</div>
      <div id="vor-score" style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:-10px;"></div>
      <div id="vor-bord" style="display:grid;grid-template-columns:repeat(${KOLOMMEN},38px);grid-template-rows:repeat(${RIJEN},38px);gap:4px;background:#1e3a8a;padding:8px;border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,0.4);"></div>
      <button id="vor-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">↻ Opnieuw spelen</button>
    </div>`

  const bordEl = document.getElementById('vor-bord')
  const statusEl = document.getElementById('vor-status')
  const opnieuwBtn = document.getElementById('vor-opnieuw')
  const scoreEl = document.getElementById('vor-score')
  try { Bordgeluid.knop(statusEl) } catch (e) {}

  function toonScore() {
    const naam = vriendNaam
    scoreEl.textContent = 'Jij ' + scoreIk + ' \u00b7 ' + naam + ' ' + scoreVriend + ' \u00b7 ' + scoreGelijk + ' gelijk'
  }

  function nieuweRonde() {
    bord = Array(RIJEN).fill(null).map(() => Array(KOLOMMEN).fill(null))
    gameOver = false
    winLijn = []
    beginner = !beginner
    mijnBeurt = beginner
    opnieuwBtn.style.display = 'none'
    verwerkBeurt()
  }

  function tekenBord() {
    bordEl.innerHTML = ''
    for (let r = 0; r < RIJEN; r++) {
      for (let k = 0; k < KOLOMMEN; k++) {
        const vakje = document.createElement('div')
        const cel = bord[r][k]
        const isWinnend = winLijn.some(([wr, wk]) => wr === r && wk === k)
        vakje.style.cssText = 'width:38px;height:38px;background:#1a2f6e;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;'
        if (cel) {
          const fiche = document.createElement('div')
          const gloed = isWinnend ? ', 0 0 14px 4px ' + KLEUR_HEX[cel] : ''
          fiche.style.cssText = 'width:32px;height:32px;border-radius:50%;background:' + KLEUR_HEX[cel] + ';box-shadow:inset 0 -3px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)' + gloed + ';transition:box-shadow 0.3s;' + (isWinnend ? 'animation:vorPuls 0.8s ease-in-out infinite alternate;' : '')
          vakje.appendChild(fiche)
        }
        if (!gameOver && mijnBeurt) {
          vakje.addEventListener('click', () => zetDoen(k))
        }
        bordEl.appendChild(vakje)
      }
    }
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

  function zetDoen(kolom) {
    if (gameOver || !mijnBeurt) return
    const rij = eersteVrijeRij(kolom)
    if (rij === -1) return // kolom vol
    bord[rij][kolom] = mijnKleur
    mijnBeurt = false
    Bordgeluid.geluid('damzet')
    verstuurZet(kolom, rij)
    verwerkBeurt()
  }

  function verwerkBeurt() {
    const winnaar = checkWinnaar()
    if (winnaar) {
      gameOver = true
      if (winnaar === 'gelijk') { scoreGelijk++; statusEl.textContent = "🤝 Gelijkspel — bord vol!"; Bordgeluid.geluid('remise') }
      else if (winnaar === mijnKleur) { scoreIk++; statusEl.textContent = "🎉 Jij wint!"; Bordgeluid.geluid('win') }
      else { scoreVriend++; statusEl.textContent = "😢 " + (vriendNaam) + " wint!"; Bordgeluid.geluid('verlies') }
      opnieuwBtn.textContent = '\u21bb Volgende ronde'
      opnieuwBtn.style.display = 'block'
    } else {
      statusEl.innerHTML = mijnBeurt
        ? 'Jouw beurt! <span style="color:' + KLEUR_HEX[mijnKleur] + '">●</span>'
        : 'Wachten op ' + vriendNaam + '...'
    }
    toonScore()
    tekenBord()
  }

  function verstuurZet(kolom, rij) {
    spelKanaal.send({ type: 'broadcast', event: 'zet', payload: { kolom, rij, kleur: mijnKleur } })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, (msg) => {
    const { kolom, rij, kleur } = msg.payload
    if (kleur === mijnKleur) return
    bord[rij][kolom] = kleur
    mijnBeurt = true
    Bordgeluid.geluid('damzet')
    verwerkBeurt()
  })

  spelKanaal.on('broadcast', { event: 'level-update' }, msg => {
    huidigLevel = msg.payload.level
  })
  spelKanaal.on('broadcast', { event: 'opnieuw' }, () => nieuweRonde())

  opnieuwBtn.addEventListener('click', () => {
    nieuweRonde()
    spelKanaal.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
  })

  toonScore()
  tekenBord()
}
