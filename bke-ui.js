// bke-ui.js - boter-kaas-en-eieren voor Fibro.
// Het spel tekent zichzelf in #spelInhoud en praat met de tegenstander via
// het spelkanaal dat chat.html aanlevert.

export function start({ Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
  vriendNaam = vriendNaam || 'vriend'
  document.getElementById('spelTitelBar').textContent = '⭕ Boter-Kaas-Eieren'
  const inhoud = document.getElementById('spelInhoud')
  let bord = Array(9).fill(null)
  let mijnBeurt = benIkSpeler1  // speler 1 (X) begint
  let beginner = benIkSpeler1  // wisselt elke ronde, zodat het eerlijk blijft
  let scoreIk = 0, scoreVriend = 0, scoreGelijk = 0
  let gameOver = false
  const mijnSymbool = benIkSpeler1 ? 'X' : 'O'
  const vriendSymbool = benIkSpeler1 ? 'O' : 'X'

  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:20px;">
      <div id="bke-status" style="color:white;font-size:16px;font-weight:600;">Jij bent ${mijnSymbool}${mijnBeurt ? ' — jouw beurt!' : ' — wachten...'}</div>
      <div id="bke-score" style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:-12px;"></div>
      <div id="bke-bord" style="display:grid;grid-template-columns:repeat(3,80px);grid-template-rows:repeat(3,80px);gap:6px;background:rgba(255,255,255,0.1);padding:6px;border-radius:12px;"></div>
      <button id="bke-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">↻ Opnieuw spelen</button>
    </div>`

  const bordEl = document.getElementById('bke-bord')
  const statusEl = document.getElementById('bke-status')
  const opnieuwBtn = document.getElementById('bke-opnieuw')
  const scoreEl = document.getElementById('bke-score')
  try { Bordgeluid.knop(statusEl) } catch (e) {}

  function toonScore() {
    const naam = vriendNaam
    scoreEl.textContent = 'Jij ' + scoreIk + ' \u00b7 ' + naam + ' ' + scoreVriend + ' \u00b7 ' + scoreGelijk + ' gelijk'
  }

  function nieuweRonde() {
    bord = Array(9).fill(null)
    gameOver = false
    beginner = !beginner
    mijnBeurt = beginner
    opnieuwBtn.style.display = 'none'
    verwerkBeurt()
  }

  function tekenBord() {
    bordEl.innerHTML = ''
    bord.forEach((cel, i) => {
      const vakje = document.createElement('div')
      vakje.style.cssText = 'width:80px;height:80px;background:rgba(255,255,255,0.08);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;cursor:pointer;color:' + (cel === 'X' ? '#c084fc' : '#f0abfc')
      vakje.textContent = cel || ''
      if (!cel && mijnBeurt && !gameOver) {
        vakje.addEventListener('click', () => zetDoen(i))
      }
      bordEl.appendChild(vakje)
    })
  }

  function checkWinnaar(b) {
    const lijnen = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
    for (const [a,c,d] of lijnen) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
    }
    if (b.every(x => x)) return 'gelijk'
    return null
  }

  function zetDoen(i) {
    if (bord[i] || gameOver || !mijnBeurt) return
    bord[i] = mijnSymbool
    mijnBeurt = false
    Bordgeluid.geluid('zet')
    verstuurZet(i)
    verwerkBeurt()
  }

  function verwerkBeurt() {
    const winnaar = checkWinnaar(bord)
    if (winnaar) {
      gameOver = true
      if (winnaar === 'gelijk') { scoreGelijk++; statusEl.textContent = "🤝 Gelijkspel!"; Bordgeluid.geluid('remise') }
      else if (winnaar === mijnSymbool) { scoreIk++; statusEl.textContent = "🎉 Jij wint!"; Bordgeluid.geluid('win') }
      else { scoreVriend++; statusEl.textContent = "😢 " + (vriendNaam) + " wint!"; Bordgeluid.geluid('verlies') }
      opnieuwBtn.textContent = '\u21bb Volgende ronde'
      opnieuwBtn.style.display = 'block'
    } else {
      statusEl.textContent = mijnBeurt ? 'Jouw beurt!' : 'Wachten op ' + vriendNaam + '...'
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
    bord[i] = symbool
    mijnBeurt = true
    Bordgeluid.geluid('zet')
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
