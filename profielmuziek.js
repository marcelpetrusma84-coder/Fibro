// profielmuziek.js - je profielnummer speelt vanzelf (v179, 17 oktober 2026)
//
// Op Home speelt je eigen profielnummer (Profiel > tabblad Profiel > Profielmuziek; op dit toestel bewaard als
// 'muziek_track' en 'muziek_titel' in de toesteldatabase), op het profiel van een vriend zijn nummer (dat komt via
// sync.js binnen als 'vriend_<id>_muziek_profiel', alleen over een rechtstreekse verbinding). Het nummer herhaalt.
// Mag de browser nog geen geluid maken (iPhone: pas na een tik), dan begint het bij de eerste tik op de pagina.
// Rechtsonder staat een knopje: pauze of verder. Zelf gepauzeerd = in deze sessie niet meer vanzelf voor dit nummer.
// Kom je terug op de pagina, dan gaat het verder waar het was (sessionStorage).
// Gaat de app naar de achtergrond, dan pauzeert het.
// v180: wat er verder klinkt regelt geluidregelaar.js (nooit twee geluiden tegelijk; onderbroken = later verder). Het
// nummer dat vanzelf start heet __fibroAuto: klinkt er al iets, dan wacht het. Twee instellingen (menu > Instellingen):
// fibro_muziek_auto = '0' (je eigen nummer niet vanzelf; dan ook geen knopje) en fibro_muziek_auto_vrienden = '0' (dat
// van een vriend niet vanzelf; het knopje met ▶ staat er wel). Stil 's nachts: tussen 23:00 en 07:00 niets vanzelf.
//
// v184: het knopje is met je vinger (of de muis) te verslepen. Loslaten = het klikt vast aan de dichtstbijzijnde zijkant,
// op de hoogte waar je het losliet, altijd tussen de balk bovenaan en de balk onderaan. Die plek geldt op dit toestel
// voor Home en het profiel van een vriend (localStorage fibro_muziek_knop_plek: { kant, y }; y = 0 bovenaan tot 1
// onderaan, zodat het ook klopt na draaien of op een ander scherm). Gewoon tikken = pauze of verder, zoals altijd.
// Nooit verplaatst = de oude plek rechtsonder.
//
// Gebruik: speelProfielMuziek({ data: 'data:audio/...', titel: 'Mijn nummer', sleutel: 'eigen' of 'vriend_<id>', vriend })

import './geluidregelaar.js?v=180'
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const AUTO = 'fibro_muziek_auto', AUTO_VRIENDEN = 'fibro_muziek_auto_vrienden'

export function autoAan(vriend) {
  try { return localStorage.getItem(vriend ? AUTO_VRIENDEN : AUTO) !== '0' } catch (e) { return true }
}
export function zetAuto(aan, vriend) {
  try { localStorage.setItem(vriend ? AUTO_VRIENDEN : AUTO, aan ? '1' : '0') } catch (e) {}
  if (!aan && !vriend && huidige && !huidige.vriend) huidige.stop()
}
export function nacht(nu) {
  const u = (nu || new Date()).getHours()
  return u >= 23 || u < 7
}

let huidige = null
let beurt = 0

// ─── v184: de plek van het knopje ───
const PLEK = 'fibro_muziek_knop_plek'
const RAND = 12      // px van de zijkant
const BOVEN = 64     // px vrij voor de balk bovenaan
const ONDER = 84     // px vrij voor de balk onderaan (zoals de oude plek)
const DREMPEL = 8    // px bewegen voordat het slepen begint (minder = gewoon een tik)
function leesPlek() {
  try {
    const p = JSON.parse(localStorage.getItem(PLEK) || 'null')
    if (p && (p.kant === 'links' || p.kant === 'rechts') && typeof p.y === 'number' && p.y >= 0 && p.y <= 1) return p
  } catch (e) {}
  return null
}
function bewaarKnopPlek(p) { try { localStorage.setItem(PLEK, JSON.stringify(p)) } catch (e) {} }
let veilig = null
function veiligeRand() {  // de inham van de iPhone (notch, streep onderaan)
  if (veilig) return veilig
  const meet = (kant) => {
    const d = document.createElement('div')
    d.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;left:0;top:0;width:1px;height:env(safe-area-inset-' + kant + ', 0px)'
    document.body.appendChild(d); const h = d.offsetHeight || 0; d.remove(); return h
  }
  veilig = { boven: meet('top'), onder: meet('bottom') }
  return veilig
}
function hoogteGrenzen(knop) {
  const v = veiligeRand(), h = knop.offsetHeight || 40
  const min = v.boven + BOVEN, max = window.innerHeight - v.onder - ONDER - h
  if (max >= min) return { min, max }
  const m = Math.max(0, Math.min(min, window.innerHeight - h))  // heel laag scherm (liggend): zo goed als het gaat
  return { min: m, max: m }
}
const tussen = (x, a, b) => Math.min(Math.max(x, a), Math.max(a, b))
function zetPlek(knop, p) {
  if (!p) return
  const g = hoogteGrenzen(knop)
  knop.style.bottom = 'auto'
  knop.style.top = Math.round(g.min + p.y * (g.max - g.min)) + 'px'
  if (p.kant === 'links') { knop.style.left = RAND + 'px'; knop.style.right = 'auto' }
  else { knop.style.right = RAND + 'px'; knop.style.left = 'auto' }
}
function maakVersleepbaar(knop) {
  knop.dataset.geenSwipe = '1'           // swipe.js: niet naar een andere pagina vegen
  knop.style.touchAction = 'none'        // de browser schuift de pagina niet mee
  knop.style.userSelect = 'none'
  knop.style.webkitUserSelect = 'none'
  knop.style.webkitTouchCallout = 'none'
  zetPlek(knop, leesPlek())
  let sleep = null, versleept = false, snapTimer = 0
  const stil = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  knop.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const r = knop.getBoundingClientRect()
    sleep = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, bezig: false }
    try { knop.setPointerCapture(e.pointerId) } catch (x) {}
  })
  knop.addEventListener('pointermove', (e) => {
    if (!sleep || e.pointerId !== sleep.id) return
    if (!sleep.bezig) {
      if (Math.hypot(e.clientX - sleep.x, e.clientY - sleep.y) < DREMPEL) return
      sleep.bezig = true
      clearTimeout(snapTimer)
      knop.style.transition = 'none'
      knop.style.right = 'auto'; knop.style.bottom = 'auto'
      knop.style.transform = 'scale(1.06)'
    }
    e.preventDefault()
    const g = hoogteGrenzen(knop)
    knop.style.left = Math.round(tussen(e.clientX - sleep.dx, 0, window.innerWidth - knop.offsetWidth)) + 'px'
    knop.style.top = Math.round(tussen(e.clientY - sleep.dy, g.min, g.max)) + 'px'
  })
  const los = (e) => {
    if (!sleep || e.pointerId !== sleep.id) return
    const was = sleep.bezig
    sleep = null
    if (!was) return
    versleept = true
    setTimeout(() => { versleept = false }, 400)
    knop.style.transform = ''  // eerst weer gewone maat, dan meten
    const r = knop.getBoundingClientRect(), g = hoogteGrenzen(knop)
    const p = { kant: (r.left + r.width / 2) < window.innerWidth / 2 ? 'links' : 'rechts',
                y: g.max > g.min ? Math.round(((tussen(r.top, g.min, g.max) - g.min) / (g.max - g.min)) * 1000) / 1000 : 1 }
    bewaarKnopPlek(p)
    if (stil()) { knop.style.transition = ''; zetPlek(knop, p); return }
    // eerst schuiven naar de kant, daarna vastzetten (rechts gemeten vanaf de rechterkant: het knopje wordt soms breder)
    knop.style.transition = 'left 0.2s ease, top 0.2s ease'
    knop.style.left = (p.kant === 'links' ? RAND : window.innerWidth - knop.offsetWidth - RAND) + 'px'
    knop.style.top = Math.round(g.min + p.y * (g.max - g.min)) + 'px'
    snapTimer = setTimeout(() => { knop.style.transition = ''; zetPlek(knop, p) }, 220)
  }
  knop.addEventListener('pointerup', los)
  knop.addEventListener('pointercancel', los)
  // na slepen geen tik (geen pauze of verder)
  knop.addEventListener('click', (e) => { if (versleept) { versleept = false; e.stopImmediatePropagation(); e.preventDefault() } }, true)
  const opnieuw = () => zetPlek(knop, leesPlek())  // draaien of ander venster: weer netjes binnen de balken
  window.addEventListener('resize', opnieuw)
  return () => { clearTimeout(snapTimer); window.removeEventListener('resize', opnieuw) }
}

function sessie(sleutel, waarde) {
  try {
    if (waarde === undefined) return sessionStorage.getItem(sleutel)
    if (waarde === null) sessionStorage.removeItem(sleutel); else sessionStorage.setItem(sleutel, String(waarde))
  } catch (e) {}
  return null
}

export async function speelProfielMuziek({ data, titel, sleutel, vriend = false }) {
  const mijn = ++beurt
  if (huidige) huidige.stop()
  if (!data || !/^data:audio\//.test(String(data))) return null
  if (!vriend && !autoAan(false)) return null // je eigen muziek uit: geen knopje
  const vanzelf = () => autoAan(vriend) && !nacht()
  let url
  try { url = URL.createObjectURL(await (await fetch(data)).blob()) } catch (e) { return null }
  if (mijn !== beurt) { URL.revokeObjectURL(url); return null }  // intussen opnieuw gevraagd
  if (huidige) huidige.stop()
  const POS = 'fibro_muziek_pos_' + sleutel, PAUZE = 'fibro_muziek_pauze_' + sleutel
  const audio = new Audio()
  audio.dataset.profielmuziek = '1'
  audio.dataset.fibroTitel = titel || T('Nummer')
  audio.loop = true
  audio.preload = 'auto'
  audio.volume = 0.7
  audio.src = url
  const pos = Number(sessie(POS)) || 0
  if (pos > 0) audio.addEventListener('loadedmetadata', () => { try { if (pos < audio.duration) audio.currentTime = pos } catch (e) {} }, { once: true })

  // het knopje rechtsonder
  const knop = document.createElement('button')
  knop.type = 'button'
  knop.id = 'profielMuziekKnop'
  knop.style.cssText = 'position:fixed;right:12px;bottom:calc(84px + env(safe-area-inset-bottom, 0px));z-index:9000;display:flex;align-items:center;gap:6px;' +
    'max-width:62vw;min-height:40px;padding:0 14px;border-radius:20px;border:0.5px solid rgba(255,255,255,0.25);background:rgba(26,10,46,0.92);color:#fff;' +
    'font:600 13px/1 system-ui,-apple-system,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,0.45);cursor:pointer'
  const naam = document.createElement('span')
  naam.textContent = '\u{1F3B5} ' + (titel || T('Nummer'))
  naam.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
  const teken = document.createElement('span')
  teken.setAttribute('aria-hidden', 'true')
  knop.append(naam, teken)
  const toon = () => {
    const speelt = !audio.paused
    teken.textContent = speelt ? '\u275A\u275A' : '\u25B6' // twee streepjes: niet elk lettertype heeft het pauzeteken
    knop.setAttribute('aria-label', (speelt ? T('Profielmuziek pauzeren') : T('Profielmuziek afspelen')) + ': ' + (titel || T('Nummer')))
  }
  toon()
  document.body.appendChild(knop)
  const stopSlepen = maakVersleepbaar(knop) // v184

  let wachtOpTik = false, wasSpelend = false, weg = false
  const probeer = () => {
    if (weg || !vanzelf()) return
    audio.__fibroAuto = true // vanzelf: klinkt er al iets, dan wacht het (geluidregelaar.js)
    const p = audio.play()
    if (p && p.then) p.then(() => { stopWachten() }, () => { if (!wachtOpTik) startWachten() })
  }
  // De eerste echte tik op de pagina (niet op het knopje zelf: dat regelt zichzelf)
  const bijTik = (e) => {
    if (e.isTrusted === false || knop.contains(e.target)) return
    stopWachten()
    if (sessie(PAUZE) !== '1') probeer()
  }
  const SOORTEN = ['pointerdown', 'touchend', 'click', 'keydown']
  function startWachten() { wachtOpTik = true; for (const s of SOORTEN) document.addEventListener(s, bijTik, { capture: true, passive: true }) }
  function stopWachten() { if (!wachtOpTik) return; wachtOpTik = false; for (const s of SOORTEN) document.removeEventListener(s, bijTik, { capture: true }) }

  knop.addEventListener('click', () => {
    stopWachten()
    if (audio.paused) { sessie(PAUZE, null); audio.__fibroAuto = false; const p = audio.play(); if (p && p.catch) p.catch(() => {}) }
    else { sessie(PAUZE, '1'); audio.pause() }
  })
  audio.addEventListener('play', toon)
  audio.addEventListener('pause', toon)
  const zicht = () => {
    if (document.hidden) { wasSpelend = !audio.paused; if (wasSpelend) audio.pause() }
    else if (wasSpelend && sessie(PAUZE) !== '1') { wasSpelend = false; audio.__fibroAuto = true; const p = audio.play(); if (p && p.catch) p.catch(() => {}) }
  }
  document.addEventListener('visibilitychange', zicht)
  const bewaarPlek = () => { try { if (audio.currentTime > 0) sessie(POS, audio.currentTime.toFixed(1)) } catch (e) {} }
  window.addEventListener('pagehide', bewaarPlek)
  const plekTimer = setInterval(bewaarPlek, 2000)

  huidige = {
    audio, knop, vriend,
    stop() {
      weg = true
      bewaarPlek()
      stopWachten()
      clearInterval(plekTimer)
      document.removeEventListener('visibilitychange', zicht)
      window.removeEventListener('pagehide', bewaarPlek)
      stopSlepen()
      try { audio.pause(); audio.removeAttribute('src'); audio.load() } catch (e) {}
      try { URL.revokeObjectURL(url) } catch (e) {}
      knop.remove()
      if (huidige === this) huidige = null
    },
  }
  if (sessie(PAUZE) === '1') return huidige  // zelf gepauzeerd: niet vanzelf, het knopje staat er wel
  probeer()
  return huidige
}
