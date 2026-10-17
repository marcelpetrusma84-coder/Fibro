// geluidregelaar.js - nooit twee geluiden door elkaar (v180, 17 oktober 2026)
//
// Eén plek die bijhoudt wat er klinkt (Home en het profiel van een vriend laden hem; profielmuziek.js ook):
// - Begint er geluid (de muziekspeler, een video met geluid, de beltoon, je profielmuziek), dan pauzeert wat er speelde.
// - Wat zo onderbroken is, gaat vanzelf verder als het nieuwe geluid stopt (gepauzeerd, klaar of weg), in de goede
//   volgorde: een stapel. Wat je zelf pauzeert, start de regelaar nooit vanzelf weer.
// - Korte geluiden (een sticker, de buzz) melden zich met de gebeurtenis 'fibro-geluid' { soort: 'kort', ms }: wat er
//   speelt pauzeert zo lang en gaat daarna verder.
// - Je profielmuziek die vanzelf start (data-profielmuziek, __fibroAuto) wacht netjes als er al iets anders klinkt.
// - Zacht faden (niet op de iPhone/iPad: daar laat Safari het volume van een speler niet regelen).
// - Vergrendelscherm en koptelefoonknop (Media Session): titel van de muziek, pauze en verder.
// - Gesprekken (een speler met een MediaStream, srcObject) raakt de regelaar nooit aan.
// Herkennen: play() van elk media-element komt langs (ook spelers die niet in de pagina hangen), plus de gebeurtenissen
// 'play' en 'volumechange' van spelers in de pagina (een video die je met zijn eigen knoppen start of harder zet).
// Een onbekende speler telt pas als hij na 250 ms nog klinkt: de stille ontgrendel-geluidjes (beltoon.js, 50 ms) niet.
// Stickerspelers (data-stickerfx) melden zich zelf als kort. Soort van een speler: data-fibro-geluid="muziek"
// (de muziekspelers), <video> = video, data-profielmuziek = achtergrond.

const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const FADE_UIT = 250, FADE_IN = 600, FADE_KORT = 120, HERVAT_NA = 350

let actief = null        // wat nu klinkt (lang geluid)
const stapel = []        // onderbroken spelers, de laatste bovenaan
let kortTot = 0, kortTimer = null, hervatTimer = null
let laatsteMuziek = null // voor het vergrendelscherm: de laatste muziek (profielmuziek of muziekspeler)
const gevolgd = new WeakSet()

function soortVan(el) {
  const d = el.dataset || {}
  if (d.stickerfx) return 'sticker'
  if (d.profielmuziek) return 'achtergrond'
  if (d.fibroGeluid) return d.fibroGeluid
  if (el.tagName === 'VIDEO') return 'video'
  return 'onbekend'
}
const isMuziek = el => !!el && (soortVan(el) === 'achtergrond' || soortVan(el) === 'muziek')
const kortBezig = () => Date.now() < kortTot
function basis(el) { if (el.__fibroBasis == null) el.__fibroBasis = el.volume > 0 ? el.volume : 1; return el.__fibroBasis }

// Volume langzaam naar 'naar' (ms). Op de iPhone kan dat niet: meteen klaar.
function fade(el, naar, ms, klaar) {
  const mijn = el.__fibroFade = (el.__fibroFade || 0) + 1
  if (IOS || !ms) { try { if (!IOS) el.volume = naar } catch (e) {} if (klaar) klaar(); return }
  const van = el.volume, start = performance.now()
  const stap = () => {
    if (el.__fibroFade !== mijn) return
    const f = Math.min(1, (performance.now() - start) / ms)
    try { el.volume = Math.max(0, Math.min(1, van + (naar - van) * f)) } catch (e) {}
    if (f < 1) setTimeout(stap, 25); else if (klaar) klaar()
  }
  stap()
}

function uitStapel(el) { const i = stapel.indexOf(el); if (i >= 0) stapel.splice(i, 1) }
function opStapel(el, onderaan) { uitStapel(el); if (onderaan) stapel.unshift(el); else stapel.push(el) }

// De regelaar pauzeert: dat is geen pauze van jou, dus hij mag later verder
function systeemPauze(el, ms) {
  basis(el)
  el.__fibroSysteem = true
  fade(el, 0, ms, () => {
    if (el.__fibroSysteem && !el.paused) { try { el.pause() } catch (e) {} }
    try { if (!IOS) el.volume = basis(el) } catch (e) {}
  })
}

function volg(el) {
  if (gevolgd.has(el)) return
  gevolgd.add(el)
  const stop = () => gestopt(el)
  el.addEventListener('pause', stop)
  el.addEventListener('ended', stop)
  el.addEventListener('emptied', stop)
}

function gestopt(el) {
  if (el.__fibroSysteem) { el.__fibroSysteem = false; return } // door de regelaar: ligt op de stapel
  uitStapel(el) // door jou gepauzeerd, klaar of weg: niet meer vanzelf verder
  if (el === actief) { actief = null; mediaSessie(); planHervat() }
}

function neemOver(el) {
  if (!el || el.srcObject || el.paused || el.ended) return
  volg(el)
  basis(el)
  if (el === actief) return
  // Je profielmuziek die vanzelf start terwijl er al iets klinkt: onderaan de stapel wachten
  if (soortVan(el) === 'achtergrond' && el.__fibroAuto && ((actief && !actief.paused) || kortBezig())) {
    el.__fibroSysteem = true
    try { el.pause() } catch (e) {}
    opStapel(el, true)
    return
  }
  uitStapel(el)
  if (actief && !actief.paused) { systeemPauze(actief, FADE_UIT); opStapel(actief) }
  actief = el
  if (isMuziek(el)) laatsteMuziek = el
  if (el.__fibroAuto && soortVan(el) === 'achtergrond' && !IOS) { try { el.volume = 0 } catch (e) {} fade(el, basis(el), FADE_IN) } // zacht beginnen
  mediaSessie()
}

function gestart(el) {
  if (!el || el.srcObject) return
  if (el.__fibroHervat) { el.__fibroHervat = false; return } // de regelaar zelf
  const s = soortVan(el)
  if (s === 'sticker' || el._zegen) return
  if (s === 'video' && el.muted) return // stille video telt pas als hij geluid krijgt
  if (s === 'onbekend') {
    setTimeout(() => { if (!el.paused && !el.ended && !el.muted && el.volume > 0) neemOver(el) }, 250)
    return
  }
  // play() is net gevraagd: even wachten tot hij echt loopt (of geweigerd is)
  if (el.paused) { const ok = () => { el.removeEventListener('playing', ok); neemOver(el) }; el.addEventListener('playing', ok); setTimeout(() => el.removeEventListener('playing', ok), 5000); return }
  neemOver(el)
}

function geldig(el) {
  if (!el || el.srcObject) return false
  const src = el.currentSrc || el.getAttribute('src') || el.src || ''
  return !!src && !el.ended && el.error == null
}

function planHervat() {
  clearTimeout(hervatTimer)
  hervatTimer = setTimeout(hervat, HERVAT_NA) // even wachten: de muziekspeler start na een nummer meteen het volgende
}
function hervat() {
  if ((actief && !actief.paused) || kortBezig() || document.hidden) return // op de achtergrond niets vanzelf starten
  while (stapel.length) {
    const el = stapel.pop()
    if (!geldig(el)) continue
    actief = el
    if (isMuziek(el)) laatsteMuziek = el
    el.__fibroHervat = true
    try { if (!IOS) el.volume = 0 } catch (e) {}
    let p
    try { p = el.play() } catch (e) { p = Promise.reject(e) }
    const goed = () => { fade(el, basis(el), FADE_IN); mediaSessie() }
    if (p && p.then) p.then(goed, () => { el.__fibroHervat = false; try { if (!IOS) el.volume = basis(el) } catch (e) {} if (actief === el) { actief = null; mediaSessie() } })
    else goed()
    return
  }
  mediaSessie()
}

function kort(ms) {
  kortTot = Math.max(kortTot, Date.now() + ms)
  clearTimeout(kortTimer)
  if (actief && !actief.paused) { systeemPauze(actief, FADE_KORT); opStapel(actief); actief = null }
  kortTimer = setTimeout(() => planHervat(), Math.max(0, kortTot - Date.now()))
}

// Vergrendelscherm en koptelefoon
function mediaSessie() {
  const ms = navigator.mediaSession
  if (!ms) return
  try {
    if (actief && !isMuziek(actief)) return // een video of de beltoon: daar gaat de browser zelf over
    const el = actief
    if (el && typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({ title: el.dataset.fibroTitel || 'Fibro', artist: 'Fibro',
        artwork: [{ src: new URL('icon-192.png', location.href).href, sizes: '192x192', type: 'image/png' }] })
      ms.playbackState = 'playing'
    } else if (laatsteMuziek && geldig(laatsteMuziek)) {
      ms.playbackState = 'paused'
    } else {
      ms.playbackState = 'none'
    }
  } catch (e) {}
}
function koppelSessie() {
  const ms = navigator.mediaSession
  if (!ms || !ms.setActionHandler) return
  const zet = (actie, f) => { try { ms.setActionHandler(actie, f) } catch (e) {} }
  zet('play', () => {
    const el = laatsteMuziek
    if (!el || !geldig(el) || !el.paused) return
    el.__fibroAuto = false
    try { const p = el.play(); if (p && p.catch) p.catch(() => {}) } catch (e) {}
  })
  const pauze = () => { if (actief && !actief.paused) { try { actief.pause() } catch (e) {} } }
  zet('pause', pauze)
  zet('stop', pauze)
}

// Aansluiten (één keer per pagina)
function start() {
  if (window.__fibroGeluidregelaar) return
  window.__fibroGeluidregelaar = true
  const speel = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    const r = speel.apply(this, arguments)
    try { gestart(this) } catch (e) {}
    return r
  }
  document.addEventListener('play', e => { try { gestart(e.target) } catch (x) {} }, true)
  document.addEventListener('volumechange', e => {
    const el = e.target
    if (el && el.tagName === 'VIDEO' && !el.muted && el.volume > 0 && !el.paused && el !== actief) { try { neemOver(el) } catch (x) {} }
  }, true)
  window.addEventListener('fibro-geluid', e => {
    const d = (e && e.detail) || {}
    if (d.soort === 'kort') kort(Math.max(200, Math.min(10000, Number(d.ms) || 1500)))
  })
  koppelSessie()
  document.addEventListener('visibilitychange', () => { if (!document.hidden) planHervat() })
  // voor de proeven: wat de regelaar nu weet
  window.fibroGeluid = { stand: () => ({ actief: actief ? soortVan(actief) : null, stapel: stapel.map(soortVan), kort: kortBezig() }) }
}
start()

// Een kort geluid melden (stickers, de buzz). Werkt ook als de regelaar op deze pagina niet geladen is (dan gebeurt er niets).
export function meldKort(ms) {
  try { window.dispatchEvent(new CustomEvent('fibro-geluid', { detail: { soort: 'kort', ms } })) } catch (e) {}
}
