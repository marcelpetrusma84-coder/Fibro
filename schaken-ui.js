// schaken-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.

export function start({ Schaak, Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
  vriendNaam = vriendNaam || 'vriend'
  document.getElementById('spelTitelBar').textContent = '♟️ Schaken'
  const inhoud = document.getElementById('spelInhoud')

  let staat = Schaak.nieuweSpelStaat()
  const mijnKleur = benIkSpeler1 ? 'w' : 'z'
  const vriendKleur = benIkSpeler1 ? 'z' : 'w'
  let geselecteerd = null      // [r,k] van geselecteerd stuk
  let mogelijkeZetten = []     // legale zetten voor geselecteerd stuk
  let gameOver = false
  let laatsteZet = null        // voor highlight van laatste zet

  // Bord wordt altijd getoond met wit onderaan vanuit perspectief van de witte speler,
  // en zwart onderaan vanuit perspectief van de zwarte speler
  const omgedraaid = mijnKleur === 'z'

  inhoud.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
      <div id="sch-status" style="color:white;font-size:14px;font-weight:600;text-align:center;min-height:20px;"></div>
      <div id="sch-bord" style="display:grid;grid-template-columns:repeat(8,38px);grid-template-rows:repeat(8,38px);border:3px solid #3a2a5e;border-radius:6px;overflow:hidden;"></div>
      <div id="sch-promotie" style="display:none;gap:8px;background:rgba(0,0,0,0.85);padding:10px;border-radius:10px;"></div>
      <button id="sch-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">↻ Opnieuw spelen</button>
    </div>`

  const bordEl = document.getElementById('sch-bord')
  const statusEl = document.getElementById('sch-status')
  const opnieuwBtn = document.getElementById('sch-opnieuw'); Bordgeluid.knop(statusEl)
  const promotieEl = document.getElementById('sch-promotie')

  function rijVolgorde() { return omgedraaid ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7] }
  function kolVolgorde() { return omgedraaid ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7] }

  function tekenBord() {
    bordEl.innerHTML = ''
    const rijen = rijVolgorde()
    const kols = kolVolgorde()

    for (const r of rijen) {
      for (const k of kols) {
        const vakje = document.createElement('div')
        const isLicht = (r + k) % 2 === 0
        const isGeselecteerd = geselecteerd && geselecteerd[0] === r && geselecteerd[1] === k
        const isMogelijkeZet = mogelijkeZetten.some(z => z.naar[0] === r && z.naar[1] === k)
        const isLaatsteZet = laatsteZet && (
          (laatsteZet.van[0]===r && laatsteZet.van[1]===k) || (laatsteZet.naar[0]===r && laatsteZet.naar[1]===k)
        )

        let achtergrond = isLicht ? '#eed9b8' : '#8a6242'
        if (isLaatsteZet) achtergrond = isLicht ? '#f3e08a' : '#c9a93a'
        if (isGeselecteerd) achtergrond = '#7ec8e3'

        vakje.style.cssText = `width:38px;height:38px;background:${achtergrond};display:flex;align-items:center;justify-content:center;font-size:26px;cursor:pointer;position:relative;user-select:none;`
        vakje.dataset.r = r
        vakje.dataset.k = k

        const stuk = staat.bord[r][k]
        if (stuk) {
          const kleurSchaduw = stuk[0] === 'w' ? '0 1px 1px rgba(0,0,0,0.5)' : '0 1px 1px rgba(255,255,255,0.3)'
          vakje.innerHTML = `<span style="text-shadow:${kleurSchaduw};color:${stuk[0]==='w' ? '#fff' : '#1a0a2e'};pointer-events:none;">${Schaak.STUK_SYMBOLEN[stuk]}</span>`
        }

        if (isMogelijkeZet) {
          const stip = document.createElement('div')
          const heeftStuk = !!staat.bord[r][k]
          stip.style.cssText = heeftStuk
            ? 'position:absolute;inset:2px;border:3px solid rgba(220,38,38,0.7);border-radius:4px;pointer-events:none;'
            : 'position:absolute;width:12px;height:12px;border-radius:50%;background:rgba(34,197,94,0.6);pointer-events:none;'
          vakje.appendChild(stip)
        }

        bordEl.appendChild(vakje)
      }
    }
  }

  // Event delegation — één listener op het bord, nooit per-vakje (voorkomt iOS re-render bug)
  bordEl.addEventListener('click', (e) => {
    const vakje = e.target.closest('[data-r]')
    if (!vakje) return
    vakjeKlik(parseInt(vakje.dataset.r), parseInt(vakje.dataset.k))
  })

  function vakjeKlik(r, k) {
    if (gameOver || staat.aanZet !== mijnKleur) return

    // Als er al een stuk geselecteerd is en dit is een geldige zet
    if (geselecteerd) {
      const zet = mogelijkeZetten.find(z => z.naar[0] === r && z.naar[1] === k)
      if (zet) {
        uitvoerenZet(zet)
        return
      }
    }

    // Selecteer een nieuw stuk (alleen eigen stukken)
    const stuk = staat.bord[r][k]
    if (stuk && stuk[0] === mijnKleur) {
      geselecteerd = [r, k]
      mogelijkeZetten = Schaak.legaleZetten(staat, r, k)
    } else {
      geselecteerd = null
      mogelijkeZetten = []
    }
    tekenBord()
  }

  function uitvoerenZet(zet, promotieStuk) {
    const stuk = staat.bord[zet.van[0]][zet.van[1]]
    const isPromotie = Schaak.typeVan(stuk) === 'P' && (zet.naar[0] === 0 || zet.naar[0] === 7)

    if (isPromotie && !promotieStuk) {
      // Toon promotie-keuze voordat de zet wordt afgerond
      toonPromotieKeuze(zet)
      return
    }

    Schaak.voerZetUit(staat, zet, promotieStuk)
    laatsteZet = zet
    geselecteerd = null
    mogelijkeZetten = []

    verstuurZet(zet, promotieStuk)
    naBeurtControle()
  }

  function toonPromotieKeuze(zet) {
    const kleur = mijnKleur
    promotieEl.style.display = 'flex'
    promotieEl.innerHTML = ['Q','R','B','N'].map(t =>
      `<button class="sch-promo-btn" data-t="${t}" style="font-size:28px;background:rgba(255,255,255,0.1);border:1px solid var(--accent);border-radius:8px;padding:6px 10px;cursor:pointer;color:white;">${Schaak.STUK_SYMBOLEN[kleur+t]}</button>`
    ).join('')
    promotieEl.querySelectorAll('.sch-promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        promotieEl.style.display = 'none'
        uitvoerenZet(zet, btn.dataset.t)
      })
    })
  }

  function naBeurtControle() {
    const volgendeKleur = staat.aanZet; Bordgeluid.schaak(Schaak, staat, laatsteZet, mijnKleur)
    if (Schaak.isSchaakmat(staat, volgendeKleur)) {
      gameOver = true
      const ikWin = volgendeKleur !== mijnKleur
      statusEl.textContent = ikWin ? '🎉 Schaakmat — Jij wint!' : '😢 Schaakmat — ' + (vriendNaam) + ' wint!'
      opnieuwBtn.style.display = 'block'
    } else if (Schaak.isPat(staat, volgendeKleur)) {
      gameOver = true
      statusEl.textContent = '🤝 Pat — gelijkspel!'
      opnieuwBtn.style.display = 'block'
    } else if (Schaak.staatInSchaak(staat, volgendeKleur)) {
      statusEl.textContent = (volgendeKleur === mijnKleur ? 'Jij staat schaak! ' : vriendNaam + ' staat schaak! ') +
        (volgendeKleur === mijnKleur ? 'Jouw beurt' : 'Wachten...')
    } else {
      statusEl.textContent = volgendeKleur === mijnKleur ? 'Jouw beurt' : 'Wachten op ' + vriendNaam + '...'
    }
    tekenBord()
  }

  function verstuurZet(zet, promotieStuk) {
    spelKanaal.send({ type: 'broadcast', event: 'zet', payload: { zet, promotieStuk } })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, (msg) => {
    const { zet, promotieStuk } = msg.payload
    Schaak.voerZetUit(staat, zet, promotieStuk)
    laatsteZet = zet
    geselecteerd = null
    mogelijkeZetten = []
    naBeurtControle()
  })

  spelKanaal.on('broadcast', { event: 'level-update' }, msg => {
    huidigLevel = msg.payload.level
  })
  spelKanaal.on('broadcast', { event: 'opnieuw' }, () => {
    staat = Schaak.nieuweSpelStaat()
    geselecteerd = null
    mogelijkeZetten = []
    laatsteZet = null
    gameOver = false
    opnieuwBtn.style.display = 'none'
    naBeurtControle()
  })

  opnieuwBtn.addEventListener('click', () => {
    staat = Schaak.nieuweSpelStaat()
    geselecteerd = null
    mogelijkeZetten = []
    laatsteZet = null
    gameOver = false
    opnieuwBtn.style.display = 'none'
    spelKanaal.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
    naBeurtControle()
  })

  statusEl.textContent = mijnKleur === 'w' ? 'Jouw beurt (wit begint)' : 'Wachten op ' + vriendNaam + ' (wit begint)...'
  tekenBord()
}
