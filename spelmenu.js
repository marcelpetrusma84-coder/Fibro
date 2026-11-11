// spelmenu.js - het hamburgermenu rechtsboven in ELK spel (v1, 11 nov 2026, op verzoek van Marcel).
//
// In gewone woorden: rechtsboven staat ☰. Tik erop en je krijgt, in deze volgorde:
//   ⏸ Pauze / ▶ Verder spelen     het spel staat stil (met een vriend: bij jullie allebei; wie pauzeerde gaat verder)
//   🔊 Geluid aan / 🔇 Geluid uit  alle geluiden en muziek van het spel (niet de stem van je vriend)
//   🎤 Microfoon aan/uit           alleen met een vriend
//   📹 Camera aan/uit              alleen met een vriend, in spellen met webcam
//   🏠 Menu                        tegen de computer: terug naar het kiezen van het niveau; met een vriend: het spel
//                                  dicht en het spelmenu van de chat open (een ander spel kiezen)
//   🚪 Spel verlaten
// Linksboven komt het wolkje voor berichten van andere vrienden (spelbericht.js).
//
// Hoe pauze werkt zonder dat elk spel iets hoeft te doen: zolang het spel stilstaat, worden requestAnimationFrame
// (de beeldjes van de snelle spellen) en de klok (performance.now) vastgehouden. Na Verder loopt de klok door alsof er
// niets gebeurde, dus je bent niet ineens dood of een stuk verder. Een spel dat zelf iets wil doen, luistert naar
// het seintje 'fibro-spel-pauze' (detail.aan).
// Hoe geluid uit werkt: elk Web Audio-geluid gaat via een volumeknop per AudioContext (die staat op 0 bij uit).
// Spraak met je vriend loopt via een <audio>-element en blijft dus te horen.

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
const GELUID_SLEUTEL = 'fibro_spelgeluid'

// ─────────── Geluid aan/uit ───────────
let geluidAan = true
try { geluidAan = localStorage.getItem(GELUID_SLEUTEL) !== 'uit' } catch (e) {}
const meesters = new WeakMap()      // AudioContext -> GainNode
const alleMeesters = new Set()
;(function geluidKraan() {
  if (typeof window === 'undefined' || !window.AudioNode || window.AudioNode.prototype.__fibroKraan) return
  const proto = window.AudioNode.prototype
  const echt = proto.connect
  proto.__fibroKraan = true
  function meester(ctx) {
    let g = meesters.get(ctx)
    if (!g) {
      g = ctx.createGain()
      echt.call(g, ctx.destination)
      g.gain.value = geluidAan ? 1 : 0
      meesters.set(ctx, g); alleMeesters.add(new WeakRef(g))
    }
    return g
  }
  proto.connect = function (doel, ...rest) {
    try {
      if (window.AudioDestinationNode && doel instanceof window.AudioDestinationNode && !this.context.__fibroGeenSpelgeluid && this !== meesters.get(this.context))
        return echt.call(this, meester(this.context), ...rest) && doel
    } catch (e) {}
    return echt.call(this, doel, ...rest)
  }
})()
export function spelgeluidAan() { return geluidAan }
export function zetSpelgeluid(aan) {
  geluidAan = Boolean(aan)
  try { localStorage.setItem(GELUID_SLEUTEL, geluidAan ? 'aan' : 'uit') } catch (e) {}
  for (const ref of alleMeesters) { const g = ref.deref(); if (g) try { g.gain.value = geluidAan ? 1 : 0 } catch (e) {} else alleMeesters.delete(ref) }
  for (const m of document.querySelectorAll('audio[data-spelgeluid], video[data-spelgeluid]')) m.muted = !geluidAan
  window.dispatchEvent(new CustomEvent('fibro-spel-geluid', { detail: { aan: geluidAan } }))
}

// ─────────── Pauze: de klok en de beeldjes vasthouden ───────────
let gepauzeerd = false, pauzeSinds = 0, pauzeTotaal = 0
const wachtend = []                  // [ons id, functie] van beeldjes die wachten tot Verder
const rafIds = new Map()             // ons id -> echt id, of 'wacht'
const echtNu = typeof performance !== 'undefined' ? performance.now.bind(performance) : () => Date.now()
const echtRaf = typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null
const echtCancel = typeof window !== 'undefined' && window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : null
const spelNu = () => (gepauzeerd ? pauzeSinds : echtNu()) - pauzeTotaal
;(function klokKraan() {
  if (typeof window === 'undefined' || !echtRaf || window.__fibroPauzeKlok) return
  window.__fibroPauzeKlok = true
  try { performance.now = spelNu } catch (e) {}
  let volgnr = 1
  window.requestAnimationFrame = function (fn) {
    const id = volgnr++
    const roep = () => { rafIds.delete(id); fn(spelNu()) }
    const wacht = () => { rafIds.set(id, 'wacht'); wachtend.push([id, roep]) }
    if (gepauzeerd) wacht()
    else rafIds.set(id, echtRaf(() => { if (gepauzeerd) wacht(); else roep() }))
    return id
  }
  window.cancelAnimationFrame = function (id) {
    const e = rafIds.get(id); rafIds.delete(id)
    if (e === 'wacht') { const i = wachtend.findIndex(w => w[0] === id); if (i >= 0) wachtend.splice(i, 1) }
    else if (e) echtCancel(e)
  }
})()
export const isGepauzeerd = () => gepauzeerd
export function zetPauze(aan) {
  aan = Boolean(aan)
  if (aan === gepauzeerd) return
  if (aan) { pauzeSinds = echtNu(); gepauzeerd = true }
  else {
    pauzeTotaal += Math.max(0, echtNu() - pauzeSinds)
    gepauzeerd = false
    for (const [id, roep] of wachtend.splice(0)) if (rafIds.get(id) === 'wacht') rafIds.set(id, echtRaf(roep))
  }
  window.dispatchEvent(new CustomEvent('fibro-spel-pauze', { detail: { aan } }))
}

// ─────────── Het menu ───────────
const STIJL = `
#spelMenuKnop{position:fixed;top:10px;right:10px;z-index:260;width:40px;height:40px;border-radius:12px;border:1px solid #ffffff33;background:rgba(26,10,46,.72);color:#fff;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation}
#spelMenuKnop[aria-expanded="true"]{background:#8b3fd1;border-color:#c084fc}
#spelMenuLijst{position:fixed;top:56px;right:10px;z-index:261;min-width:210px;padding:6px;border-radius:16px;background:rgba(26,10,46,.97);border:1px solid #c084fc80;box-shadow:0 12px 34px #000c;display:none;flex-direction:column;gap:2px;font:600 15px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#spelMenuLijst.open{display:flex}
#spelMenuLijst button{display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:8px 12px;border:none;border-radius:11px;background:none;color:#fff;font:inherit;text-align:left;cursor:pointer}
#spelMenuLijst button:hover,#spelMenuLijst button:focus-visible{background:#ffffff14;outline:none}
#spelMenuLijst button[hidden]{display:none}
#spelMenuLijst button:disabled{opacity:.4;cursor:default}
#spelMenuLijst .sm-icoon{width:24px;text-align:center;font-size:19px}
#spelMenuLijst .sm-streep{height:1px;margin:4px 8px;background:#ffffff1f}
#spelMenuLijst [data-menu=exit]{color:#fca5a5}
#spelPauzeLaag{position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;background:rgba(26,10,46,.78);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
#spelPauzeLaag.open{display:flex}
#spelPauzeLaag .sp-kaart{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 28px;border-radius:20px;background:linear-gradient(160deg,#8b3fd1,#6a2bab 55%,#1a0a2e);border:1px solid #c084fc;color:#fff;text-align:center;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 10px 40px #000c;max-width:min(320px,86vw)}
#spelPauzeLaag .sp-titel{font-size:26px;font-weight:900}
#spelPauzeLaag .sp-sub{font-size:14px;opacity:.85}
#spelPauzeLaag button{min-height:46px;padding:10px 22px;border-radius:14px;border:none;background:#fff;color:#6a2bab;font:800 17px system-ui,sans-serif;cursor:pointer}
`
function zetStijl() {
  if (document.getElementById('spelmenu-stijl')) return
  const s = document.createElement('style'); s.id = 'spelmenu-stijl'; s.textContent = STIJL; document.head.appendChild(s)
}

// opties:
//   solo                   true = tegen de computer (geen microfoon/camera)
//   kanMic() / micAan()    is er een microfoon-knop, staat hij aan
//   kanCam() / camAan()    is er een camera, staat hij aan
//   kanPauze()             mag er nu gepauzeerd worden (bijvoorbeeld pas als het spel loopt)
//   onMic(), onCam(), onMenu(), onExit()
//   onPauze(aan)           seintje naar de ander (met een vriend) of naar de computer
export function maakSpelMenu(opties = {}) {
  zetStijl()
  document.getElementById('spelMenuKnop')?.remove(); document.getElementById('spelMenuLijst')?.remove(); document.getElementById('spelPauzeLaag')?.remove()
  const o = { kanMic: () => false, micAan: () => false, kanCam: () => false, camAan: () => false, kanPauze: () => true, ...opties }
  const knop = document.createElement('button')
  knop.id = 'spelMenuKnop'; knop.type = 'button'; knop.textContent = '☰'
  knop.setAttribute('aria-haspopup', 'menu'); knop.setAttribute('aria-expanded', 'false'); knop.setAttribute('aria-label', T('Spelmenu'))
  const lijst = document.createElement('div')
  lijst.id = 'spelMenuLijst'; lijst.setAttribute('role', 'menu')
  const item = (naam, opKlik) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.menu = naam; b.setAttribute('role', 'menuitem')
    b.innerHTML = '<span class="sm-icoon" aria-hidden="true"></span><span class="sm-tekst"></span>'
    b.onclick = () => { sluit(); opKlik(); werkBij() }   // na een keuze gaat het menu dicht
    lijst.appendChild(b); return b
  }
  const streep = () => { const d = document.createElement('div'); d.className = 'sm-streep'; lijst.appendChild(d) }
  const pauzeItem = item('pauze', () => { sluit(); pauze(!gepauzeerd, true) })
  const geluidItem = item('geluid', () => zetSpelgeluid(!geluidAan))
  const micItem = item('mic', () => { o.onMic?.(); setTimeout(werkBij, 400) })
  const camItem = item('cam', () => { o.onCam?.(); setTimeout(werkBij, 600) })
  streep()
  const menuItem = item('menu', () => { sluit(); pauze(false, true); o.onMenu?.() })
  const exitItem = item('exit', () => { sluit(); pauze(false, true); o.onExit?.() })
  const zet = (b, icoon, tekst) => { b.querySelector('.sm-icoon').textContent = icoon; b.querySelector('.sm-tekst').textContent = tekst; b.dataset.aan = '' }

  // De pauzelaag
  const laag = document.createElement('div')
  laag.id = 'spelPauzeLaag'; laag.setAttribute('role', 'dialog'); laag.setAttribute('aria-modal', 'true')
  laag.innerHTML = '<div class="sp-kaart"><div class="sp-titel"></div><div class="sp-sub"></div><button type="button" class="sp-verder"></button></div>'
  const verderKnop = laag.querySelector('.sp-verder')
  verderKnop.onclick = () => pauze(false, true)
  let doorAnder = null   // naam van de vriend die pauzeerde (dan kun jij niet verder)

  function werkBij() {
    zet(pauzeItem, gepauzeerd ? '▶️' : '⏸️', gepauzeerd ? T('Verder spelen') : T('Pauze'))
    pauzeItem.disabled = (!gepauzeerd && !o.kanPauze()) || Boolean(doorAnder)
    zet(geluidItem, geluidAan ? '🔊' : '🔇', geluidAan ? T('Geluid uitzetten') : T('Geluid aanzetten'))
    geluidItem.dataset.aan = String(geluidAan)
    micItem.hidden = o.solo || !o.kanMic()
    const mic = o.micAan(); zet(micItem, mic ? '🎤' : '🔇', mic ? T('Microfoon uitzetten') : T('Microfoon aanzetten')); micItem.dataset.aan = String(mic)
    camItem.hidden = o.solo || !o.kanCam()
    const cam = o.camAan(); zet(camItem, '📹', cam ? T('Camera uitzetten') : T('Camera aanzetten')); camItem.dataset.aan = String(cam)
    zet(menuItem, '🏠', T('Menu'))
    zet(exitItem, '🚪', T('Spel verlaten'))
  }
  function open() { werkBij(); lijst.classList.add('open'); knop.setAttribute('aria-expanded', 'true'); (lijst.querySelector('button:not([hidden]):not(:disabled)') || knop).focus({ preventScroll: true }) }
  function sluit() { lijst.classList.remove('open'); knop.setAttribute('aria-expanded', 'false') }
  knop.onclick = e => { e.stopPropagation(); lijst.classList.contains('open') ? sluit() : open() }
  const buiten = e => { if (lijst.classList.contains('open') && !lijst.contains(e.target) && e.target !== knop) sluit() }
  document.addEventListener('pointerdown', buiten, true)
  const toets = e => { if (e.key === 'Escape' && lijst.classList.contains('open')) { sluit(); knop.focus() } }
  document.addEventListener('keydown', toets)

  // pauze(aan, zelf): zelf = jij tikte (dan gaat het seintje naar de ander); anders kwam het van de ander
  function pauze(aan, zelf, naam) {
    if (zelf && doorAnder) return
    if (!zelf) doorAnder = aan ? (naam || T('je vriend')) : null
    zetPauze(aan)
    laag.classList.toggle('open', aan)
    laag.querySelector('.sp-titel').textContent = '⏸️ ' + T('Gepauzeerd')
    laag.querySelector('.sp-sub').textContent = doorAnder ? T('{naam} heeft het spel gepauzeerd. Wacht tot {naam} verder gaat.', { naam: doorAnder }) : (o.solo ? '' : T('Het spel staat ook stil bij je vriend.'))
    verderKnop.hidden = Boolean(doorAnder)
    verderKnop.textContent = '▶ ' + T('Verder spelen')
    if (zelf) o.onPauze?.(aan)
    werkBij()
    if (aan && !doorAnder) setTimeout(() => verderKnop.focus({ preventScroll: true }), 30)
  }

  ;(opties.ouder || document.body).append(laag, knop, lijst)
  werkBij()
  return {
    knop, lijst, werkBij, sluit, open,
    pauze: aan => pauze(aan, true),
    pauzeVanAnder: (aan, naam) => pauze(Boolean(aan), false, naam),
    get gepauzeerd() { return gepauzeerd },
    weg() {
      if (gepauzeerd) zetPauze(false)
      doorAnder = null
      document.removeEventListener('pointerdown', buiten, true); document.removeEventListener('keydown', toets)
      knop.remove(); lijst.remove(); laag.remove()
    },
  }
}
