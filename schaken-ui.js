import { stukSVG, registreerSlag, veroverdePunten } from './schaak-stukken.js?v=1'
const SETTINGS_KEY = 'fibro_chess_settings_v1'
// v195: alle teksten weer via taal.js (Nederlands, en Engels uit taal-en.js), zoals de andere spellen
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const STUKNAAM = { P: () => T('pion'), N: () => T('paard'), B: () => T('loper'), R: () => T('toren'), Q: () => T('dame'), K: () => T('koning') }
const stukMetKleur = stuk => stuk[0] === 'w' ? T('witte {stuk}', { stuk: STUKNAAM[stuk[1]]() }) : T('zwarte {stuk}', { stuk: STUKNAAM[stuk[1]]() })
const seconden = n => n === 0 ? T('Meteen') : n === 1 ? T('{n} seconde', { n }) : T('{n} seconden', { n })
function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    const thinking = Number(saved.thinking ?? 7)
    return { thinking:Number.isFinite(thinking) ? Math.min(7,Math.max(0,thinking)) : 7, pieces:['small','medium','large'].includes(saved.pieces) ? saved.pieces : 'medium', board:['classic','wood','marble'].includes(saved.board) ? saved.board : 'classic', showAttackRoutes:saved.showAttackRoutes === true, exaggerate:saved.exaggerate === true }
  } catch { return { thinking:7, pieces:'medium', board:'classic', showAttackRoutes:false, exaggerate:false } }
}
// schaken-ui.js - spel voor Fibro, losgetrokken uit chat.html.
// Tekent zichzelf in #spelInhoud en praat via het spelkanaal dat chat.html aanlevert.
// v147: teksten ook in het Engels (taal.js). 21 okt 2026: nieuwe stukken, bewegende zetten, geslagen stukken met
// punten, instellingen (lang drukken op 'Bord groter') en aanvalsroutes, van valentijnpeters (PR #2).
// v195: die nieuwe teksten weer in het Nederlands en het Engels.
export function start({ Schaak, Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
  vriendNaam = vriendNaam || T('vriend')
  document.getElementById('spelTitelBar').textContent = '♟️ Chess'
  const inhoud = document.getElementById('spelInhoud')

  let staat = Schaak.nieuweSpelStaat()
  const mijnKleur = benIkSpeler1 ? 'w' : 'z'
  const vriendKleur = benIkSpeler1 ? 'z' : 'w'
  let veroverd = { w:[], z:[] }
  let routeStuk = null
  let geselecteerd = null      // [r,k] van geselecteerd stuk
  let mogelijkeZetten = []     // legale zetten voor geselecteerd stuk
  let gameOver = false
  let bezig = false
  let promotieOpen = false
  let generatie = 0
  let wachtrij = Promise.resolve()
  const minderBeweging = matchMedia('(prefers-reduced-motion: reduce)')
  const instellingen = readSettings()
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
      .sch-zoom { position:relative; overflow:hidden; border:1px solid #ffffff35; background:linear-gradient(135deg,#544065,#2a2038); color:white; padding:10px 16px; border-radius:12px; min-height:44px; cursor:pointer; touch-action:manipulation; user-select:none; -webkit-touch-callout:none; }
      .sch-zoom::after { content:""; position:absolute; height:3px; left:10px; right:10px; bottom:3px; background:#f5ce86; transform:scaleX(0); transform-origin:left; transition:transform 1s linear; }
      .sch-zoom.sch-lange-druk::after { transform:scaleX(1); }
      .sch-acties { position:relative; z-index:5; }
      .sch-menu { position:absolute; z-index:6; left:50%; bottom:calc(100% + 8px); transform:translateX(-50%); box-sizing:border-box; width:min(340px,calc(100vw - 24px)); max-height:min(68dvh,480px); overflow:auto; padding:15px; border:1px solid #e8d7bd88; border-radius:16px; background:linear-gradient(145deg,#30243a,#17121f); color:#fff8ed; box-shadow:0 16px 40px #000b; text-align:left; }
      .sch-menu[hidden] { display:none; }
      .sch-menu h2 { font-size:17px; margin:0 0 12px; }
      .sch-menu label,.sch-menu legend { font-size:13px; font-weight:650; }
      .sch-menu fieldset { border:0; padding:0; margin:12px 0; }
      .sch-menu input[type="range"] { display:block; width:100%; min-height:36px; accent-color:#ddb477; }
      .sch-menu-opties { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:7px; }
      .sch-keuze { min-height:40px; padding:6px 3px; border:1px solid #ffffff40; border-radius:8px; background:#ffffff0b; color:inherit; font:inherit; font-size:11px; cursor:pointer; }
      .sch-keuze[aria-pressed="true"] { border-color:#f2cf97; background:linear-gradient(135deg,#71533e,#45364f); box-shadow:inset 0 0 0 1px #f2cf9780; }
      .sch-menu-hint { color:#d8c9b5; font-size:11px; line-height:1.45; }
      .sch-attack-toggle { display:flex; align-items:center; gap:9px; min-height:44px; font-size:13px; font-weight:650; }
      .sch-attack-toggle input { width:20px; height:20px; accent-color:#ddb477; }
      .sch-attack-toggle[hidden] { display:none; }
      .sch-threat::before { content:""; position:absolute; z-index:0; inset:0; pointer-events:none; background:radial-gradient(ellipse at 50% 60%,#ffe18fbb 0,#ffc85c88 35%,#ffb52b35 62%,transparent 80%); box-shadow:inset 0 0 14px #ffe293aa; animation:sch-threat-pulse 1.5s ease-in-out infinite alternate; }
      .sch-threat .sch-stuk { filter:drop-shadow(0 0 5px #fff1b8) drop-shadow(0 0 10px #ffbb45) drop-shadow(0 3px 2px #000b); }
      .sch-threat-exaggerated { z-index:2; }
      .sch-threat-exaggerated::before { background:radial-gradient(ellipse at 50% 55%,#ff8b8bdd 0,#f3263bba 36%,#a80021a8 67%,transparent 88%); box-shadow:inset 0 0 16px #ff5369d9,0 0 9px #fa354e99; }
      .sch-threat-exaggerated .sch-stuk { transform:scale(1.14); filter:sepia(1) saturate(9) brightness(1.05) hue-rotate(315deg) drop-shadow(0 0 5px #ff243dcc) drop-shadow(0 0 11px #f00b) drop-shadow(0 3px 2px #000b); }
      @keyframes sch-threat-pulse { from { opacity:.62; } to { opacity:1; } }
      @media (prefers-reduced-motion:reduce) { .sch-threat::before { animation:none; } }
      .sch-board-wood { background:repeating-linear-gradient(3deg,#6c462d 0 3px,#a87346 4px 7px,#774b30 8px 11px,#bd8c59 12px 13px)!important; }
      .sch-board-wood .sch-vak { background-image:repeating-linear-gradient(2deg,transparent 0 5px,#52351c22 6px,#fff5dd24 8px,transparent 10px)!important; }
      .sch-board-marble { background:repeating-linear-gradient(132deg,#d8d4cf 0 3px,#85818c 4px 6px,#ede8dc 7px 11px,#696876 12px 14px)!important; }
      .sch-board-marble .sch-vak:nth-child(odd) { filter:contrast(1.02) brightness(1.15); }
      .sch-board-marble .sch-vak:nth-child(even) { filter:contrast(1.08) brightness(.72); }
      .sch-pieces-small .sch-stuk { width:72%; }
      .sch-pieces-medium .sch-stuk { width:88%; }
      .sch-pieces-large .sch-stuk { width:100%; }
    </style>
    <div class="sch-spel">
      <div id="sch-status" role="status" aria-live="polite" style="color:white;font-size:14px;font-weight:600;text-align:center;min-height:20px;"></div>
      <div class="sch-vangst" id="sch-tegenstander"></div>
      <div class="sch-frame"><div id="sch-bord" role="group" aria-label="${T('Schaakbord')}"></div></div>
      <div class="sch-vangst" id="sch-eigen"></div>
      <div class="sch-legenda"></div>
      <div class="sch-acties">
        <button class="sch-zoom" type="button" aria-pressed="false" aria-haspopup="dialog" aria-expanded="false">${T('⤢ Bord groter')}</button>
        <section class="sch-menu" id="sch-menu" role="dialog" aria-label="${T('Schaakinstellingen')}" hidden>
          <h2>${T('Schaakinstellingen')}</h2>
          <fieldset><legend>${T('Bedenktijd van de computer')}</legend>
            <label for="sch-denktijd">${T('Hoogstens:')} <output id="sch-denktijd-waarde">${seconden(7)}</output></label>
            <input id="sch-denktijd" type="range" min="0" max="7" step="1" value="7" aria-describedby="sch-denktijd-hint">
            <p class="sch-menu-hint" id="sch-denktijd-hint">${T('0 = meteen. Anders denkt de computer steeds anders lang na, tot hoogstens de gekozen tijd.')}</p>
          </fieldset>
          <fieldset><legend>${T('Grootte van de stukken')}</legend><div class="sch-menu-opties" data-options="pieces">
            <button class="sch-keuze" type="button" data-value="small">${T('Kleiner')}</button><button class="sch-keuze" type="button" data-value="medium">${T('Standaard')}</button><button class="sch-keuze" type="button" data-value="large">${T('Groter')}</button>
          </div></fieldset>
          <label class="sch-attack-toggle"><input id="sch-aanvalsroutes" type="checkbox"> ${T('Aanvalsroutes tonen')}</label>
          <label class="sch-attack-toggle" id="sch-exaggerate-wrap" hidden><input id="sch-exaggerate" type="checkbox"> ${T('Extra duidelijk')}</label>
          <p class="sch-menu-hint">${T('Licht de stukken op die het laatst verzette stuk mag slaan.')}</p>
          <fieldset><legend>${T('Soort bord')}</legend><div class="sch-menu-opties" data-options="board">
            <button class="sch-keuze" type="button" data-value="classic">${T('Klassiek')}</button><button class="sch-keuze" type="button" data-value="wood">${T('Hout')}</button><button class="sch-keuze" type="button" data-value="marble">${T('Marmer / graniet')}</button>
          </div></fieldset>
          <p class="sch-menu-hint">${T('Houd “Bord groter” 3 seconden ingedrukt voor deze instellingen. Kort tikken maakt het bord groter of kleiner.')}</p>
        </section>
      </div>
      <div id="sch-promotie" style="display:none;gap:8px;background:rgba(0,0,0,0.85);padding:10px;border-radius:10px;"></div>
      <button id="sch-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">${T('↻ Opnieuw spelen')}</button>
    </div>`

  const bordEl = document.getElementById('sch-bord')
  const statusEl = document.getElementById('sch-status')
  const opnieuwBtn = document.getElementById('sch-opnieuw'); Bordgeluid.knop(statusEl)
  const promotieEl = document.getElementById('sch-promotie')

  const spelEl = inhoud.querySelector('.sch-spel')
  const zoomBtn = inhoud.querySelector('.sch-zoom')
  inhoud.querySelector('.sch-legenda').textContent = T('Pion 1 · Paard 3 · Loper 3 · Toren 5 · Dame 9')
  function tekenVeroverd() {
    for (const [id,kleur,naam] of [['sch-eigen',mijnKleur,T('Jij')],['sch-tegenstander',vriendKleur,vriendNaam]]) {
      const paneel = document.getElementById(id)
      paneel.replaceChildren()
      const kop = document.createElement('div')
      kop.className = 'sch-vangst-kop'
      const label = document.createElement('strong')
      label.textContent = naam
      const score = document.createElement('span')
      const punten = veroverdePunten(veroverd[kleur])
      score.textContent = punten === 1 ? T('Geslagen: {n} punt', { n: punten }) : T('Geslagen: {n} punten', { n: punten })
      kop.append(label,score)
      const lijst = document.createElement('div')
      lijst.className = 'sch-vangst-stukken'
      lijst.setAttribute('aria-label', veroverd[kleur].length ? `${score.textContent} (${veroverd[kleur].map(stuk => STUKNAAM[stuk[1]]()).join(', ')})` : score.textContent)
      lijst.innerHTML = veroverd[kleur].map(stukSVG).join('')
      if (!veroverd[kleur].length) lijst.textContent = '—'
      paneel.append(kop,lijst)
    }
  }
  function vergroot(aan) {
    spelEl.classList.toggle('sch-groot', aan)
    zoomBtn.setAttribute('aria-pressed', String(aan))
    zoomBtn.textContent = aan ? T('⤡ Bord kleiner') : T('⤢ Bord groter')
  }
  vergroot(false)
  const menu = inhoud.querySelector('#sch-menu')
  const acties = inhoud.querySelector('.sch-acties')
  let voortgangTimer = null, menuTimer = null, menuDruk = false, onderdrukKlik = false
  function bewaarInstellingen() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(instellingen)) } catch {}
    spelEl.classList.toggle('sch-pieces-small', instellingen.pieces === 'small')
    spelEl.classList.toggle('sch-pieces-medium', instellingen.pieces === 'medium')
    spelEl.classList.toggle('sch-pieces-large', instellingen.pieces === 'large')
    bordEl.classList.toggle('sch-board-wood', instellingen.board === 'wood')
    bordEl.classList.toggle('sch-board-marble', instellingen.board === 'marble')
    bordEl.classList.toggle('sch-board-classic', instellingen.board === 'classic')
  }
  function toonMenu(aan) {
    menu.hidden = !aan
    zoomBtn.setAttribute('aria-expanded', String(aan))
    if (aan) menu.querySelector('input').focus()
  }
  function kiesMenuOptie(groep, waarde) {
    instellingen[groep] = waarde
    menu.querySelectorAll(`[data-options="${groep}"] .sch-keuze`).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === waarde)))
    bewaarInstellingen()
  }
  bewaarInstellingen()
  const denktijd = menu.querySelector('#sch-denktijd')
  const denktijdWaarde = menu.querySelector('#sch-denktijd-waarde')
  menu.querySelector('#sch-denktijd').closest('fieldset').hidden = !spelKanaal.isSolo
  denktijd.value = String(instellingen.thinking)
  denktijdWaarde.value = seconden(instellingen.thinking)
  denktijd.addEventListener('input', () => {
    instellingen.thinking = Number(denktijd.value)
    denktijdWaarde.value = seconden(instellingen.thinking)
    bewaarInstellingen()
    if (spelKanaal.isSolo) spelKanaal.send({ type:'broadcast', event:'bot-instellingen', payload:{ thinkingMs:instellingen.thinking * 1000 } })
  })
  menu.querySelectorAll('.sch-keuze').forEach(button => button.addEventListener('click', () => kiesMenuOptie(button.closest('[data-options]').dataset.options, button.dataset.value)))
  for (const group of ['pieces','board']) menu.querySelectorAll(`[data-options="${group}"] .sch-keuze`).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === instellingen[group])))
  const aanvalToggle = menu.querySelector('#sch-aanvalsroutes')
  const exaggerateToggle = menu.querySelector('#sch-exaggerate')
  const exaggerateWrap = menu.querySelector('#sch-exaggerate-wrap')
  aanvalToggle.checked = instellingen.showAttackRoutes
  exaggerateWrap.hidden = !instellingen.showAttackRoutes
  exaggerateToggle.checked = instellingen.exaggerate
  aanvalToggle.addEventListener('change', () => {
    instellingen.showAttackRoutes = aanvalToggle.checked
    exaggerateWrap.hidden = !instellingen.showAttackRoutes
    bewaarInstellingen()
    tekenBord()
  })
  exaggerateToggle.addEventListener('change', () => {
    instellingen.exaggerate = exaggerateToggle.checked
    bewaarInstellingen()
    tekenBord()
  })
  if (spelKanaal.isSolo) spelKanaal.send({ type:'broadcast', event:'bot-instellingen', payload:{ thinkingMs:instellingen.thinking * 1000 } })
  function openMenuLater() {
    menuDruk = true
    onderdrukKlik = true
    zoomBtn.classList.add('sch-lange-druk')
    toonMenu(true)
  }
  zoomBtn.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    if (event.pointerId !== undefined && zoomBtn.setPointerCapture) {
      try { zoomBtn.setPointerCapture(event.pointerId) } catch {}
    }
    menuDruk = false
    zoomBtn.classList.remove('sch-lange-druk')
    clearTimeout(voortgangTimer)
    clearTimeout(menuTimer)
    voortgangTimer = setTimeout(() => zoomBtn.classList.add('sch-lange-druk'), 2000)
    menuTimer = setTimeout(openMenuLater, 3000)
  })
  zoomBtn.addEventListener('pointermove', event => {
    if (menuTimer && (Math.abs(event.movementX || 0) > 12 || Math.abs(event.movementY || 0) > 12)) eindigLangeDruk()
  })
  function eindigLangeDruk() {
    clearTimeout(voortgangTimer)
    clearTimeout(menuTimer)
    zoomBtn.classList.remove('sch-lange-druk')
    if (menuDruk) onderdrukKlik = true
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) zoomBtn.addEventListener(event, eindigLangeDruk)
  window.addEventListener('blur', eindigLangeDruk)
  zoomBtn.addEventListener('contextmenu', event => event.preventDefault())
  zoomBtn.addEventListener('click', () => {
    if (onderdrukKlik || menuDruk) { menuDruk = false; onderdrukKlik = false; return }
    vergroot(!spelEl.classList.contains('sch-groot'))
  })
  spelEl.addEventListener('pointerdown', event => { if (!acties.contains(event.target)) toonMenu(false) })
  menu.addEventListener('keydown', event => { if (event.key === 'Escape') { toonMenu(false); zoomBtn.focus() } })
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
    const bedreigdeVelden = new Set()
    const route = routeStuk && staat.bord[routeStuk[0]]?.[routeStuk[1]]
    if (instellingen.showAttackRoutes && route) {
      for (const zet of Schaak.legaleZetten(staat, routeStuk[0], routeStuk[1])) {
        const doel = staat.bord[zet.naar[0]][zet.naar[1]]
        if (doel && doel[0] !== route[0]) bedreigdeVelden.add(`${zet.naar[0]},${zet.naar[1]}`)
      }
    }

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
        const bedreigd = bedreigdeVelden.has(`${r},${k}`)
        if (bedreigd) {
          vakje.classList.add('sch-threat')
          if (instellingen.exaggerate) vakje.classList.add('sch-threat-exaggerated')
        }
        vakje.style.background = `linear-gradient(145deg,#ffffff18,#00000018),${achtergrond}`
        const stukNaam = staat.bord[r][k] ? stukMetKleur(staat.bord[r][k]) : T('leeg')
        vakje.setAttribute('aria-label', `${String.fromCharCode(97+k)}${8-r}, ${stukNaam}${bedreigd ? T(', kan geslagen worden door {stuk}', { stuk: stukMetKleur(route) }) : ''}`)
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
    routeStuk = zet.naar.slice()
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
      `<button class="sch-promo-btn ${kleur === 'w' ? 'sch-wit' : 'sch-zwart'}" data-t="${t}" aria-label="${T('Promoveren tot {stuk}', { stuk: STUKNAAM[t]() })}" style="font-size:28px;background:#b6a18a;border:1px solid var(--accent);border-radius:8px;padding:6px 10px;cursor:pointer;">${stukSVG(kleur+t)}</button>`
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
      routeStuk = geldig.naar.slice()
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
    routeStuk = null
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
    routeStuk = null
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
