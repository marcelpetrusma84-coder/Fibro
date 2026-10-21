import { stukSVG, registreerSlag, veroverdePunten } from './schaak-stukken.js?v=1'
// schaken-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.
// v147: teksten ook in het Engels (taal.js)
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m)) // taal.js (v147)

export function start({ Schaak, Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
  vriendNaam = vriendNaam || T('vriend')
  document.getElementById('spelTitelBar').textContent = '♟️ Chess'
  const inhoud = document.getElementById('spelInhoud')

  let staat = Schaak.nieuweSpelStaat()
  const mijnKleur = benIkSpeler1 ? 'w' : 'z'
  const vriendKleur = benIkSpeler1 ? 'z' : 'w'
  let veroverd = { w:[], z:[] }
  let geselecteerd = null      // [r,k] van geselecteerd stuk
  let mogelijkeZetten = []     // legale zetten voor geselecteerd stuk
  let gameOver = false
  let bezig = false
  let promotieOpen = false
  let generatie = 0
  let wachtrij = Promise.resolve()
  const minderBeweging = matchMedia('(prefers-reduced-motion: reduce)')
  let laatsteZet = null        // voor highlight van laatste zet

  // Bord wordt altijd getoond met wit onderaan vanuit perspectief van de witte speler,
  // en zwart onderaan vanuit perspectief van de zwarte speler
  const omgedraaid = mijnKleur === 'z'

  inhoud.innerHTML = `
    <style>
      .sch-spel { display:flex; flex-direction:column; align-items:center; gap:8px; width:100%; }
      .sch-frame { box-sizing:border-box; container-type:inline-size; width:min(360px,calc(100vw - 32px),calc(100dvh - 290px)); padding:7px; border-radius:12px;
        background:linear-gradient(135deg,#d9ae76,#765032 45%,#39271e); box-shadow:0 9px 0 #39271e,0 12px 0 #211811,0 22px 30px #0008,inset 0 1px 1px #fff9; }
      .sch-spel.sch-groot .sch-frame { width:min(calc(100vw - 4px),calc(100dvh - 260px)); }
      #sch-bord { display:grid; grid-template-columns:repeat(8,1fr); aspect-ratio:1; width:100%; touch-action:none; user-select:none; }
      .sch-vak { border:0; border-radius:0; padding:0; min-width:0; position:relative; display:grid; place-items:center; cursor:pointer; aspect-ratio:1; }
      .sch-vak:focus-visible { outline:3px solid #55dfff; outline-offset:-3px; z-index:2; }
      .sch-stuk { display:block; width:88%; aspect-ratio:1; line-height:1; pointer-events:none; position:relative; z-index:1; filter:drop-shadow(0 2px 1px #0006); }
      .sch-figuur { display:block; width:100%; height:100%; overflow:visible; }
      .sch-ivoor { color:#fff9e9; --sch-line:#40362e; }
      .sch-ebben { color:#282634; --sch-line:#d5c6b2; }
      .sch-type-N { transform:scale(1.09); transform-origin:50% 85%; }
      .sch-vangst { box-sizing:border-box; width:min(420px,calc(100vw - 20px)); padding:6px 10px; border:1px solid #bca98b70; border-radius:9px; background:linear-gradient(120deg,#39303e,#211c2b); color:#fff8ed; }
      .sch-vangst-kop { display:flex; justify-content:space-between; gap:8px; font-size:12px; }
      .sch-vangst-stukken { display:flex; flex-wrap:wrap; gap:0; min-height:24px; align-items:center; }
      .sch-vangst-stukken .sch-figuur { width:22px; height:24px; }
      .sch-promo-btn .sch-figuur { width:40px; height:40px; }
      .sch-legenda { font-size:11px; color:#eee1cf; text-align:center; }
      .sch-zoom { border:1px solid #ffffff35; background:linear-gradient(135deg,#544065,#2a2038); color:white; padding:10px 16px; border-radius:12px; min-height:44px; cursor:pointer; }
    </style>
    <div class="sch-spel">
      <div id="sch-status" role="status" aria-live="polite" style="color:white;font-size:14px;font-weight:600;text-align:center;min-height:20px;"></div>
      <div class="sch-vangst" id="sch-tegenstander"></div>
      <div class="sch-frame"><div id="sch-bord" role="group" aria-label="Chess"></div></div>
      <div class="sch-vangst" id="sch-eigen"></div>
      <div class="sch-legenda"></div>
      <button class="sch-zoom" type="button" aria-pressed="false">⤢</button>
      <div id="sch-promotie" style="display:none;gap:8px;background:rgba(0,0,0,0.85);padding:10px;border-radius:10px;"></div>
      <button id="sch-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">${T('↻ Opnieuw spelen')}</button>
    </div>`

  const bordEl = document.getElementById('sch-bord')
  const statusEl = document.getElementById('sch-status')
  const opnieuwBtn = document.getElementById('sch-opnieuw'); Bordgeluid.knop(statusEl)
  const promotieEl = document.getElementById('sch-promotie')

  const spelEl = inhoud.querySelector('.sch-spel')
  const zoomBtn = inhoud.querySelector('.sch-zoom')
  const engels = document.documentElement.lang.startsWith('en')
  inhoud.querySelector('.sch-legenda').textContent = engels ? 'Pawn 1 · Knight 3 · Bishop 3 · Rook 5 · Queen 9' : 'Pion 1 · Paard 3 · Loper 3 · Toren 5 · Dame 9'
  function tekenVeroverd() {
    for (const [id,kleur,naam] of [['sch-eigen',mijnKleur,engels ? 'You' : 'Jij'],['sch-tegenstander',vriendKleur,vriendNaam]]) {
      const paneel = document.getElementById(id)
      paneel.replaceChildren()
      const kop = document.createElement('div')
      kop.className = 'sch-vangst-kop'
      const label = document.createElement('strong')
      label.textContent = naam
      const score = document.createElement('span')
      const punten = veroverdePunten(veroverd[kleur])
      score.textContent = engels ? `Captured: ${punten} ${punten === 1 ? 'point' : 'points'}` : `Veroverd: ${punten} ${punten === 1 ? 'punt' : 'punten'}`
      kop.append(label,score)
      const lijst = document.createElement('div')
      lijst.className = 'sch-vangst-stukken'
      lijst.setAttribute('aria-label', `${score.textContent} (${veroverd[kleur].join(', ')})`)
      lijst.innerHTML = veroverd[kleur].map(stukSVG).join('')
      if (!veroverd[kleur].length) lijst.textContent = '—'
      paneel.append(kop,lijst)
    }
  }
  function vergroot(aan) {
    spelEl.classList.toggle('sch-groot', aan)
    zoomBtn.setAttribute('aria-pressed', String(aan))
    zoomBtn.textContent = aan ? (engels ? '⤡ Smaller board' : '⤡ Bord verkleinen') : (engels ? '⤢ Enlarge board' : '⤢ Bord vergroten')
  }
  vergroot(false)
  zoomBtn.addEventListener('click', () => vergroot(!spelEl.classList.contains('sch-groot')))
  const vingers = new Map()
  let afstand = 0, negeerKlikTot = 0
  const meetAfstand = () => {
    const [a,b] = [...vingers.values()]
    return Math.hypot(a.x-b.x, a.y-b.y)
  }
  bordEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return
    vingers.set(e.pointerId, { x:e.clientX, y:e.clientY })
    e.target.setPointerCapture(e.pointerId)
    if (vingers.size === 2) { afstand = meetAfstand(); negeerKlikTot = Infinity }
  })
  bordEl.addEventListener('pointermove', e => {
    if (!vingers.has(e.pointerId)) return
    vingers.set(e.pointerId, { x:e.clientX, y:e.clientY })
    if (vingers.size !== 2) return
    const nu = meetAfstand()
    if (nu - afstand > 24) vergroot(true)
    if (afstand - nu > 24) vergroot(false)
  })
  function los(e) {
    vingers.delete(e.pointerId)
    if (!vingers.size && negeerKlikTot === Infinity) negeerKlikTot = performance.now() + 400
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) bordEl.addEventListener(event, los)

  async function animeerZet(zet) {
    bezig = true
    const ronde = generatie
    const bewegingen = [[zet.van, zet.naar]]
    if (zet.type === 'rokade-kort') bewegingen.push([[zet.van[0],7],[zet.van[0],5]])
    if (zet.type === 'rokade-lang') bewegingen.push([[zet.van[0],0],[zet.van[0],3]])
    try {
      if (!minderBeweging.matches) await Promise.all(bewegingen.map(async ([van,naar]) => {
        const bron = bordEl.querySelector(`[data-r="${van[0]}"][data-k="${van[1]}"]`)
        const doel = bordEl.querySelector(`[data-r="${naar[0]}"][data-k="${naar[1]}"]`)
        const stuk = bron?.querySelector('.sch-stuk')
        if (!stuk?.animate || !doel) return
        const a = bron.getBoundingClientRect(), b = doel.getBoundingClientRect()
        const x = b.x-a.x, y = b.y-a.y
        bron.style.zIndex = '5'
        const animatie = stuk.animate([
          { transform:'translate(0,0) scale(1)', offset:0 },
          { transform:`translate(${x*.15}px,${y*.15-10}px) scale(1.18)`, offset:.22 },
          { transform:`translate(${x}px,${y-7}px) scale(1.12)`, offset:.8 },
          { transform:`translate(${x}px,${y}px) scale(1)`, offset:1 }
        ], { duration:680, easing:'cubic-bezier(.3,.05,.25,1)', fill:'forwards' })
        try { await animatie.finished } finally { animatie.cancel(); bron.style.zIndex = '' }
      }))
      return ronde === generatie && bordEl.isConnected
    } finally { if (ronde === generatie) bezig = false }
  }

  function rijVolgorde() { return omgedraaid ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7] }
  function kolVolgorde() { return omgedraaid ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7] }

  function tekenBord() {
    tekenVeroverd()
    bordEl.innerHTML = ''
    const rijen = rijVolgorde()
    const kols = kolVolgorde()

    for (const r of rijen) {
      for (const k of kols) {
        const vakje = document.createElement('button')
        const isLicht = (r + k) % 2 === 0
        const isGeselecteerd = geselecteerd && geselecteerd[0] === r && geselecteerd[1] === k
        const isMogelijkeZet = mogelijkeZetten.some(z => z.naar[0] === r && z.naar[1] === k)
        const isLaatsteZet = laatsteZet && (
          (laatsteZet.van[0]===r && laatsteZet.van[1]===k) || (laatsteZet.naar[0]===r && laatsteZet.naar[1]===k)
        )

        let achtergrond = isLicht ? '#eed9b8' : '#8a6242'
        if (isLaatsteZet) achtergrond = isLicht ? '#f3e08a' : '#c9a93a'
        if (isGeselecteerd) achtergrond = '#7ec8e3'

        vakje.type = 'button'
        vakje.className = 'sch-vak'
        vakje.style.background = `linear-gradient(145deg,#ffffff18,#00000018),${achtergrond}`
        vakje.setAttribute('aria-label', `${String.fromCharCode(97+k)}${8-r} ${staat.bord[r][k] || ''}`)
        vakje.setAttribute('aria-pressed', String(Boolean(isGeselecteerd)))
        vakje.dataset.r = r
        vakje.dataset.k = k

        const stuk = staat.bord[r][k]
        if (stuk) {
          const figuur = document.createElement('span')
          figuur.className = 'sch-stuk'
          figuur.innerHTML = stukSVG(stuk)
          vakje.append(figuur)
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
    if (performance.now() < negeerKlikTot) return
    const vakje = e.target.closest('[data-r]')
    if (!vakje) return
    vakjeKlik(parseInt(vakje.dataset.r), parseInt(vakje.dataset.k))
  })

  function vakjeKlik(r, k) {
    if (bezig || promotieOpen || gameOver || staat.aanZet !== mijnKleur) return

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

  async function uitvoerenZet(zet, promotieStuk) {
    const stuk = staat.bord[zet.van[0]][zet.van[1]]
    const isPromotie = Schaak.typeVan(stuk) === 'P' && (zet.naar[0] === 0 || zet.naar[0] === 7)

    if (isPromotie && !promotieStuk) {
      // Toon promotie-keuze voordat de zet wordt afgerond
      toonPromotieKeuze(zet)
      return
    }

    if (!await animeerZet(zet)) return
    registreerSlag(staat, zet, veroverd)
    Schaak.voerZetUit(staat, zet, promotieStuk)
    laatsteZet = zet
    geselecteerd = null
    mogelijkeZetten = []

    verstuurZet(zet, promotieStuk)
    naBeurtControle()
  }

  function toonPromotieKeuze(zet) {
    const kleur = mijnKleur
    promotieOpen = true
    promotieEl.style.display = 'flex'
    promotieEl.innerHTML = ['Q','R','B','N'].map(t =>
      `<button class="sch-promo-btn ${kleur === 'w' ? 'sch-wit' : 'sch-zwart'}" data-t="${t}" style="font-size:28px;background:#b6a18a;border:1px solid var(--accent);border-radius:8px;padding:6px 10px;cursor:pointer;">${stukSVG(kleur+t)}</button>`
    ).join('')
    promotieEl.querySelectorAll('.sch-promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        promotieOpen = false
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
      statusEl.textContent = ikWin ? T('🎉 Schaakmat — Jij wint!') : T('😢 Schaakmat — {naam} wint!', { naam: vriendNaam })
      opnieuwBtn.style.display = 'block'
    } else if (Schaak.isPat(staat, volgendeKleur)) {
      gameOver = true
      statusEl.textContent = T('🤝 Pat — gelijkspel!')
      opnieuwBtn.style.display = 'block'
    } else if (Schaak.staatInSchaak(staat, volgendeKleur)) {
      statusEl.textContent = volgendeKleur === mijnKleur ? T('Jij staat schaak! Jouw beurt') : T('{naam} staat schaak! Wachten...', { naam: vriendNaam })
    } else {
      statusEl.textContent = volgendeKleur === mijnKleur ? T('Jouw beurt') : T('Wachten op {naam}...', { naam: vriendNaam })
    }
    tekenBord()
  }

  function verstuurZet(zet, promotieStuk) {
    spelKanaal.send({ type: 'broadcast', event: 'zet', payload: { zet, promotieStuk } })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, (msg) => {
    const ronde = generatie
    wachtrij = wachtrij.then(async () => {
      if (ronde !== generatie || !bordEl.isConnected || gameOver) return
      const { zet, promotieStuk } = msg.payload || {}
      if (!zet || staat.aanZet !== vriendKleur) return
      const geldig = Schaak.alleLegaleZetten(staat, vriendKleur).find(z =>
        z.van[0] === zet.van?.[0] && z.van[1] === zet.van?.[1] &&
        z.naar[0] === zet.naar?.[0] && z.naar[1] === zet.naar?.[1] && z.type === zet.type)
      if (!geldig || !await animeerZet(geldig)) return
      registreerSlag(staat, geldig, veroverd)
      Schaak.voerZetUit(staat, geldig, ['Q','R','B','N'].includes(promotieStuk) ? promotieStuk : 'Q')
      laatsteZet = geldig
      geselecteerd = null
      mogelijkeZetten = []
      naBeurtControle()
    }).catch(error => console.error('[schaken] zet mislukt', error))
  })

  spelKanaal.on('broadcast', { event: 'opnieuw' }, () => {
    generatie++
    bezig = false
    promotieOpen = false
    promotieEl.style.display = 'none'
    veroverd = { w:[], z:[] }
    staat = Schaak.nieuweSpelStaat()
    geselecteerd = null
    mogelijkeZetten = []
    laatsteZet = null
    gameOver = false
    opnieuwBtn.style.display = 'none'
    naBeurtControle()
  })

  opnieuwBtn.addEventListener('click', () => {
    generatie++
    bezig = false
    promotieOpen = false
    promotieEl.style.display = 'none'
    veroverd = { w:[], z:[] }
    staat = Schaak.nieuweSpelStaat()
    geselecteerd = null
    mogelijkeZetten = []
    laatsteZet = null
    gameOver = false
    opnieuwBtn.style.display = 'none'
    spelKanaal.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
    naBeurtControle()
  })

  statusEl.textContent = mijnKleur === 'w' ? T('Jouw beurt (wit begint)') : T('Wachten op {naam} (wit begint)...', { naam: vriendNaam })
  tekenBord()
}
