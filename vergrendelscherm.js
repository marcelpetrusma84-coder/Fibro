// vergrendelscherm.js (v1, 19 nov 2026) - het spelertje op het vergrendelscherm, in het bedieningspaneel en op de
// koptelefoon (Media Session). Eén plek voor alle geluid van Stekky.
//
// In gewone woorden: speelt Stekky iets af (muziek, radio, een spraakbericht, een gesprek), dan laat de telefoon op het
// vergrendelscherm een spelertje zien. Zonder deze module stond daar alleen "Stekky", een leeg vakje, --:-- en knoppen
// van 10 seconden (foto van Marcel, 19 nov 2026). Nu geeft elk stuk geluid door wat er speelt:
//  - titel, artiest en album (bijv. het nummer en de artiest, "Gesprek met Bram", "Radio · NPO Radio 2")
//  - een plaatje (de albumhoes als die er is, anders het Stekky-icoon)
//  - een tijdbalk die klopt, en spoelen door te slepen (niet bij live: radio en gesprekken)
//  - ⏮ ⏭ als er iets is om naar te springen (vorige/volgende nummer, of vorige/volgende zender bij de radio)
//  - bij een gesprek: ⏸ = je microfoon dempen, ▶ = weer aan (en op Android/Chrome ook ophangen)
// Speelt er meer tegelijk of na elkaar, dan staat bovenaan wat het laatst begon te spelen. Stopt dat, dan komt wat
// daarvoor speelde weer terug in beeld.
//
// Gebruik (elk stuk geluid kiest een eigen sleutel; dezelfde sleutel opnieuw = bijwerken):
//   nuSpeelt('radio', { el: audio, titel, artiest, album, hoes, live: true, vorige, volgende, stop })
//   nuSpeelt('gesprek', { titel, artiest, live: true, speelt: true, pauze, verder, ophangen })  (zonder el)
//   nuWeg('radio')   of   nuWeg('spraak', audio): alleen als dat element er nog bij hoort
// Velden: el = het <audio>/<video>-element (dan volgen tijdbalk en ⏸/▶ vanzelf). Zonder el: speelt (true/false) zelf
// bijhouden en opnieuw nuSpeelt(...) aanroepen als het verandert. pauze/verder vervangen el.pause()/el.play().
//
// Verschillende pagina's laden misschien verschillende ?v= van deze module: daarom staat alles in één gedeeld
// voorwerp op window (__fibroNuSpeelt).

const G = window.__fibroNuSpeelt || (window.__fibroNuSpeelt = { lijst: [], teller: 0, getoond: null, metaSleutel: '' })

const abs = p => { try { return new URL(p, document.baseURI).href } catch (e) { return p } }
const ICONEN = [
  { src: abs('icon-192.png'), sizes: '192x192', type: 'image/png' },
  { src: abs('icon-512.png'), sizes: '512x512', type: 'image/png' },
]
const tekst = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 120)
// Alleen echte plaatjes als hoes (geen emoji-avatar en geen vreemde links)
const goedPlaatje = s => typeof s === 'string' && /^(https:\/\/|data:image\/|blob:)/i.test(s)

function sessie() { try { return navigator.mediaSession || null } catch (e) { return null } }

function levend(item) {
  if (!item.el) return true
  const el = item.el
  if (el.__fibroNuWeg) return false
  // let op: audio.src = '' maakt van src het adres van de pagina; daarom naar het attribuut kijken
  return !!(el.srcObject || (el.getAttribute && el.getAttribute('src')) || (el.querySelector && el.querySelector('source')))
}
function speelt(item) {
  if (!item.el) return item.speelt !== false
  if (item.speelt === false) return false // bijv. gesprek: microfoon gedempt
  return !item.el.paused && !item.el.ended
}

// Wat er bovenaan staat: wat nu speelt (het laatst begonnen eerst); speelt er niets, dan het laatst gebruikte.
function kies() {
  const lijst = G.lijst.filter(levend)
  if (!lijst.length) return null
  const spelend = lijst.filter(speelt)
  const uit = spelend.length ? spelend : lijst
  return uit.reduce((a, b) => (b.tijd > a.tijd ? b : a))
}

function zet(ms, actie, f) { try { ms.setActionHandler(actie, f || null) } catch (e) {} }

function duurVan(el) { return el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0 }

function positie(item) {
  const ms = sessie()
  if (!ms || !ms.setPositionState) return
  try {
    const d = item && !item.live ? duurVan(item.el) : 0
    if (!d) { ms.setPositionState(); return }
    ms.setPositionState({ duration: d, position: Math.min(d, Math.max(0, item.el.currentTime || 0)), playbackRate: item.el.playbackRate || 1 })
  } catch (e) {}
}

function speel(item) {
  if (item.verder) { try { item.verder() } catch (e) {} return }
  const el = item.el
  if (!el) return
  el.__fibroAuto = false // geluidregelaar.js: met de hand gestart, dus niet "wachten tot het stil is"
  try { const p = el.play(); if (p && p.catch) p.catch(() => {}) } catch (e) {}
}
function pauzeer(item) {
  if (item.pauze) { try { item.pauze() } catch (e) {} return }
  try { item.el && item.el.pause() } catch (e) {}
}
function spoelNaar(item, t) {
  const el = item.el, d = duurVan(el)
  if (!d) return
  t = Math.max(0, Math.min(d - 0.05, t))
  try { el.currentTime = t } catch (e) {}
  positie(item)
}

function teken() {
  const ms = sessie()
  if (!ms) return
  const item = kies()
  G.getoond = item
  try {
    if (!item) {
      if (G.metaSleutel) { ms.metadata = null; G.metaSleutel = '' }
      ms.playbackState = 'none'
      for (const a of ['play', 'pause', 'stop', 'seekto', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack', 'togglemicrophone', 'hangup']) zet(ms, a, null)
      positie(null)
      return
    }
    const hoes = goedPlaatje(item.hoes) ? [{ src: item.hoes, sizes: '512x512' }].concat(ICONEN) : ICONEN
    const meta = { title: tekst(item.titel) || 'Stekky', artist: tekst(item.artiest) || 'Stekky', album: tekst(item.album), artwork: hoes }
    const sleutel = item.sleutel + '|' + meta.title + '|' + meta.artist + '|' + meta.album + '|' + (goedPlaatje(item.hoes) ? item.hoes.slice(0, 200) : '')
    if (sleutel !== G.metaSleutel && typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata(meta)
      G.metaSleutel = sleutel
    }
    ms.playbackState = speelt(item) ? 'playing' : 'paused'
  } catch (e) {}

  const kanSpoelen = !item.live && !!item.el
  zet(ms, 'play', () => speel(item))
  zet(ms, 'pause', () => pauzeer(item))
  zet(ms, 'stop', item.stop ? () => { try { item.stop() } catch (e) {} } : (item.live ? null : () => pauzeer(item)))
  zet(ms, 'seekto', kanSpoelen ? d => {
    if (d && d.fastSeek && item.el.fastSeek) { try { item.el.fastSeek(d.seekTime); positie(item); return } catch (e) {} }
    spoelNaar(item, Number(d && d.seekTime) || 0)
  } : null)
  zet(ms, 'seekbackward', kanSpoelen ? d => spoelNaar(item, item.el.currentTime - ((d && d.seekOffset) || 10)) : null)
  zet(ms, 'seekforward', kanSpoelen ? d => spoelNaar(item, item.el.currentTime + ((d && d.seekOffset) || 10)) : null)
  zet(ms, 'previoustrack', item.vorige ? () => { try { item.vorige() } catch (e) {} } : null)
  zet(ms, 'nexttrack', item.volgende ? () => { try { item.volgende() } catch (e) {} } : null)
  // Gesprekken (Chrome op Android en de computer): microfoon en ophangen
  zet(ms, 'togglemicrophone', item.microfoon ? () => { try { item.microfoon() } catch (e) {} } : null)
  zet(ms, 'hangup', item.ophangen ? () => { try { item.ophangen() } catch (e) {} } : null)
  positie(item)
}

let gepland = false
function later() {
  if (gepland) return
  gepland = true
  Promise.resolve().then(() => { gepland = false; teken() })
}

const GEBEURTENISSEN = ['play', 'playing', 'pause', 'ended', 'emptied', 'loadedmetadata', 'durationchange', 'ratechange', 'seeked']
function volgEl(item) {
  const el = item.el
  if (!el || el.__fibroNuVolg) return
  const f = e => {
    const nu = G.lijst.find(x => x.el === el)
    if (!nu) return
    if (e.type === 'play' || e.type === 'playing') nu.tijd = ++G.teller
    if (G.getoond === nu && (e.type === 'seeked' || e.type === 'ratechange' || e.type === 'durationchange' || e.type === 'loadedmetadata')) positie(nu)
    later()
  }
  el.__fibroNuVolg = f
  for (const t of GEBEURTENISSEN) el.addEventListener(t, f)
}

export function nuSpeelt(sleutel, info = {}) {
  if (!sleutel) return
  let item = G.lijst.find(x => x.sleutel === sleutel)
  const nieuw = !item
  const ander = item && info.el && item.el !== info.el
  if (!item) { item = { sleutel }; G.lijst.push(item) }
  if (ander && item.el) item.el.__fibroNuWeg = true
  Object.assign(item, info)
  if (item.el) { item.el.__fibroNuWeg = false; volgEl(item) }
  // Nieuw, een ander element, of het speelt nu: bovenaan
  if (nieuw || ander || speelt(item)) item.tijd = ++G.teller
  later()
  return item
}

// el meegeven = alleen weghalen als dat element er nog bij hoort (niet als intussen iets anders onder die sleutel speelt)
export function nuWeg(sleutel, el) {
  const i = G.lijst.findIndex(x => x.sleutel === sleutel)
  if (i < 0) return
  if (el && G.lijst[i].el !== el) return
  const item = G.lijst[i]
  G.lijst.splice(i, 1)
  if (item.el && !G.lijst.some(x => x.el === item.el)) item.el.__fibroNuWeg = true
  later()
}

// Voor de tests
export function nuGetoond() {
  const i = kies()
  return i ? { sleutel: i.sleutel, titel: i.titel || '', artiest: i.artiest || '', speelt: speelt(i), live: !!i.live } : null
}
window.__fibroNuSpeelt.stand = nuGetoond
