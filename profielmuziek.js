// profielmuziek.js - je profielnummer speelt vanzelf (v179, 17 oktober 2026)
//
// Op Home speelt je eigen profielnummer (Profiel > tabblad Profiel > Profielmuziek; op dit toestel bewaard als
// 'muziek_track' en 'muziek_titel' in de toesteldatabase), op het profiel van een vriend zijn nummer (dat komt via
// sync.js binnen als 'vriend_<id>_muziek_profiel', alleen over een rechtstreekse verbinding). Het nummer herhaalt.
// Mag de browser nog geen geluid maken (iPhone: pas na een tik), dan begint het bij de eerste tik op de pagina.
// Rechtsonder staat een knopje: pauze of verder. Zelf gepauzeerd = in deze sessie niet meer vanzelf voor dit nummer.
// Kom je terug op de pagina, dan gaat het verder waar het was (sessionStorage).
// Gaat er ander geluid van Fibro spelen (de muziekspeler, een video met geluid, de beltoon), dan pauzeert het
// profielnummer; stickergeluidjes niet (die zijn kort). Gaat de app naar de achtergrond, dan pauzeert het ook.
// Instelling 'Muziek vanzelf afspelen' (menu > Instellingen): localStorage fibro_muziek_auto = '0' is uit.
//
// Gebruik: speelProfielMuziek({ data: 'data:audio/...', titel: 'Mijn nummer', sleutel: 'eigen' of 'vriend_<id>' })

const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const AUTO = 'fibro_muziek_auto'

export function autoAan() {
  try { return localStorage.getItem(AUTO) !== '0' } catch (e) { return true }
}
export function zetAuto(aan) {
  try { localStorage.setItem(AUTO, aan ? '1' : '0') } catch (e) {}
  if (!aan && huidige) huidige.stop()
}

let huidige = null
let beurt = 0

// Ander geluid van Fibro merken, ook van een <audio> die niet in de pagina hangt (zoals de muziekspeler): play() van
// elk ander media-element meldt zich bij het profielnummer.
let gehaakt = false
function haakPlay() {
  if (gehaakt) return
  gehaakt = true
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    const r = speel.apply(this, arguments)
    try { if (huidige && this !== huidige.audio) huidige.ander(this) } catch (e) {}
    return r
  }
}

function sessie(sleutel, waarde) {
  try {
    if (waarde === undefined) return sessionStorage.getItem(sleutel)
    if (waarde === null) sessionStorage.removeItem(sleutel); else sessionStorage.setItem(sleutel, String(waarde))
  } catch (e) {}
  return null
}

export async function speelProfielMuziek({ data, titel, sleutel }) {
  const mijn = ++beurt
  if (huidige) huidige.stop()
  if (!data || !/^data:audio\//.test(String(data)) || !autoAan()) return null
  let url
  try { url = URL.createObjectURL(await (await fetch(data)).blob()) } catch (e) { return null }
  if (mijn !== beurt) { URL.revokeObjectURL(url); return null }  // intussen opnieuw gevraagd
  if (huidige) huidige.stop()
  const POS = 'fibro_muziek_pos_' + sleutel, PAUZE = 'fibro_muziek_pauze_' + sleutel
  const audio = new Audio()
  audio.dataset.profielmuziek = '1'
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

  let wachtOpTik = false, wasSpelend = false, weg = false
  const probeer = () => {
    if (weg || !autoAan()) return
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
    if (audio.paused) { sessie(PAUZE, null); const p = audio.play(); if (p && p.catch) p.catch(() => {}) }
    else { sessie(PAUZE, '1'); audio.pause() }
  })
  audio.addEventListener('play', toon)
  audio.addEventListener('pause', toon)
  // Ander geluid van Fibro (niet de stickers): het profielnummer pauzeert. Eerst even kijken of het echt speelt: een stil
  // ontgrendel-geluidje (beltoon.js speelt op de eerste tik 50 ms stilte) of een stille video telt niet.
  const anderGeluid = (t) => {
    if (!t || t === audio || (t.dataset && t.dataset.stickerfx)) return
    setTimeout(() => { if (!weg && !t.paused && !t.ended && !t.muted && t.volume > 0 && !audio.paused) audio.pause() }, 300)
  }
  haakPlay()
  const zicht = () => {
    if (document.hidden) { wasSpelend = !audio.paused; if (wasSpelend) audio.pause() }
    else if (wasSpelend && autoAan() && sessie(PAUZE) !== '1') { wasSpelend = false; const p = audio.play(); if (p && p.catch) p.catch(() => {}) }
  }
  document.addEventListener('visibilitychange', zicht)
  const bewaarPlek = () => { try { if (audio.currentTime > 0) sessie(POS, audio.currentTime.toFixed(1)) } catch (e) {} }
  window.addEventListener('pagehide', bewaarPlek)
  const plekTimer = setInterval(bewaarPlek, 2000)

  huidige = {
    audio, knop, ander: anderGeluid,
    stop() {
      weg = true
      bewaarPlek()
      stopWachten()
      clearInterval(plekTimer)
      document.removeEventListener('visibilitychange', zicht)
      window.removeEventListener('pagehide', bewaarPlek)
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
