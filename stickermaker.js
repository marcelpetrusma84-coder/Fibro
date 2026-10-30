// stickermaker.js - het Stickerlab in Profiel, bij Stickers (v154, 15 oktober 2026; v160: mp3-geluiden via stickerfx.js; v162: eigenstickers.js met versies)
// Twee eigen vellen van 12 plekken. Tik op een lege plek: kies een afbeelding, knip hem uit (effen
// achtergrond weg, met je vinger, of alles houden), witte rand eromheen, kies een beweging en een geluid
// (stickerfx.js) en bewaar hem op dit toestel (eigenstickers.js). Tik op een sticker om hem aan te passen
// of te verwijderen. v155: je vrienden krijgen ze vanzelf (sync.js) zodra jullie allebei online zijn.
// v157: onder elke sticker een knopje (stickerwidget.js): aan + Opslaan = de sticker staat op Home.
// Gebruik: startStickermaker(element, uid, widgets)   (widgets = { aan(id), zet(id, aan) } uit profiel.html)
import { EIGEN_VELLEN, PER_VEL, maakCode, leesEigen, bewaarEigen, wisEigen, laadAfbeelding, bekijkRand, achtergrondWeg, knipMetLijn, maakSticker } from './eigenstickers.js?v=162'
import { BEWEGINGEN, GELUIDEN, naamVan, speel } from './stickerfx.js?v=214'
import { maakSchakelaar, widgetId, zetStijl as zetWidgetStijl } from './stickerwidget.js?v=215'
import { KWAST_MIN, KWAST_MAX, KWAST_STANDAARD, kwastStraal, voegPuntToe, tekenStreek, pasStrekenToe } from './stickerkwast.js?v=1'

// v231: bijwerken met je vinger (weghalen / terugzetten, met een grootte), ook na 'Achtergrond weg'
Object.assign(window.FIBRO_EN ||= {}, {
  'Begin met': 'Start with', 'Lijn eromheen': 'Line around it',
  'Bijwerken met je vinger': 'Touch up with your finger',
  '✂️ Lijn': '✂️ Line', '🧽 Weghalen': '🧽 Erase', '🖌️ Terugzetten': '🖌️ Restore', 'Grootte': 'Size',
  '↶ Ongedaan maken': '↶ Undo', 'Opnieuw beginnen': 'Start over',
  'Veeg met je vinger over wat weg moet.': 'Swipe your finger over what should go.',
  'Veeg met je vinger over wat terug moet komen.': 'Swipe your finger over what should come back.',
  'Trek met je vinger een lijn om wat je wilt houden. Daarna kun je nog bijwerken.': 'Draw a line around what you want to keep with your finger. You can touch it up afterwards.',
  'Kwastgrootte': 'Brush size'
})

const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const STANDAARD = { b: 'stuiter', g: 'boing' }

const STIJL = `
.sm [hidden], .sm-scherm [hidden] { display:none !important; }
.sm { display:flex; flex-direction:column; gap:12px; }
.sm-uitleg { margin:0; font-size:15px; line-height:1.5; color:var(--text); }
.sm-velkop { display:flex; justify-content:space-between; align-items:baseline; font-size:14px; color:var(--text); margin-bottom:6px; }
.sm-velkop span { font-size:13px; opacity:0.75; font-variant-numeric:tabular-nums; }
.sm-raster { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; }
/* v217: een lege plek met een witte stippellijn en een wit plusje, met schaduw (was licht paars): ook op een lichte foto te zien */
.sm-plek { aspect-ratio:1; min-width:0; border-radius:14px; border:2px dashed rgba(255,255,255,0.9); background:rgba(0,0,0,0.25); color:#ffffff; font-size:28px; font-weight:600; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:4px; -webkit-tap-highlight-color:transparent; box-shadow:0 2px 8px rgba(0,0,0,0.5), inset 0 0 8px rgba(0,0,0,0.4); }
.sm-plek:not(.vol) { filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8)); }
.sm-plek.vol { border:1px solid var(--border); background:var(--card); box-shadow:none; }
.sm-plek img { width:100%; height:100%; object-fit:contain; pointer-events:none; }
.sw-cel > .sm-plek { width:100%; box-sizing:border-box; }
.sm-plek:focus-visible, .sm-scherm button:focus-visible, .sm-scherm select:focus-visible, .sm-scherm input:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.sm-status { font-size:14px; color:var(--accent); min-height:1.2em; margin:0; }
.sm-scherm { position:fixed; inset:0; z-index:60; background:rgba(10,3,20,0.82); display:flex; align-items:flex-start; justify-content:center; overflow-y:auto; -webkit-overflow-scrolling:touch;
  padding:calc(12px + env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px)); }
.sm-scherm[hidden] { display:none; }
.sm-kaart { width:100%; max-width:420px; background:#1e0d35; border:0.5px solid var(--border); border-radius:18px; padding:16px; display:flex; flex-direction:column; gap:14px; box-sizing:border-box; }
.sm-kop { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.sm-kop h2 { margin:0; font-size:19px; color:var(--text); font-weight:600; }
.sm-x { width:44px; height:44px; border-radius:50%; border:0.5px solid var(--border); background:var(--card); color:var(--text); font-size:18px; cursor:pointer; flex-shrink:0; }
.sm-stap { display:flex; flex-direction:column; gap:10px; }
.sm-stap[hidden] { display:none; }
.sm-label { font-size:13px; color:var(--text); opacity:0.75; text-transform:uppercase; letter-spacing:1.2px; }
.sm-klein { margin:0; font-size:14px; line-height:1.5; color:var(--text); opacity:0.85; }
.sm-knop { min-height:44px; border-radius:12px; border:0.5px solid var(--border); background:var(--card); color:var(--text); font:inherit; font-size:15px; padding:10px 14px; cursor:pointer; }
.sm-knop.hoofd { background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#1a0a2e; border:none; font-weight:600; }
.sm-knop.wis { color:#fca5a5; border-color:rgba(239,68,68,0.5); }
.sm-knop.wis.zeker { background:rgba(239,68,68,0.2); }
.sm-knop[hidden] { display:none; }
.sm-segment { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px; }
.sm-segment button { min-height:44px; border-radius:10px; border:1px solid var(--border); background:transparent; color:var(--text); font:inherit; font-size:13px; line-height:1.2; padding:6px 4px; cursor:pointer; }
.sm-segment button[aria-checked="true"] { border:2px solid var(--accent); background:rgba(192,132,252,0.16); }
.sm-ruit { background-color:#2a1745; background-image:conic-gradient(rgba(255,255,255,0.08) 25%, transparent 0 50%, rgba(255,255,255,0.08) 0 75%, transparent 0); background-size:20px 20px; border-radius:12px; }
.sm-werk { display:block; max-width:100%; max-height:300px; margin:0 auto; touch-action:none; cursor:crosshair; }
.sm-hint { margin:0; font-size:14px; line-height:1.45; color:var(--text); }
.sm-schuif { display:grid; grid-template-columns:auto minmax(0, 1fr); align-items:center; gap:10px; font-size:14px; color:var(--text); }
.sm-kwast { grid-template-columns:auto minmax(0, 1fr) 44px; }
.sm-bol { justify-self:center; display:block; border-radius:50%; border:2px solid #ffffff; box-shadow:0 0 0 1px rgba(0,0,0,0.6); max-width:44px; max-height:44px; box-sizing:border-box; }
.sm-segment button[hidden] { display:none; }
.sm-knop:disabled { opacity:0.45; cursor:default; }
.sm-vink { display:flex; align-items:center; gap:10px; font-size:15px; color:var(--text); cursor:pointer; min-height:44px; }
.sm-vink input { width:22px; height:22px; accent-color:var(--accent); }
.sm-rij { display:flex; flex-wrap:wrap; gap:8px; }
.sm-voorbeeld { align-self:center; width:180px; height:180px; max-width:100%; border:0; padding:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.sm-voorbeeld img { width:100%; height:100%; object-fit:contain; pointer-events:none; }
.sm-voorbeeld .sm-leeg { font-size:14px; color:var(--text); opacity:0.7; text-align:center; padding:0 10px; }
.sm-veld { display:grid; grid-template-columns:5.5em minmax(0, 1fr); align-items:center; gap:10px; font-size:15px; color:var(--text); }
.sm-veld select, .sm-veld input { min-width:0; width:100%; box-sizing:border-box; min-height:44px; border-radius:10px; border:0.5px solid var(--border); background:rgba(0,0,0,0.3); color:var(--text); font:inherit; font-size:16px; padding:8px 10px; }
.sm-fout { margin:0; font-size:14px; color:#fca5a5; min-height:1em; }
.sm-onder { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; }
.sm-onder .sm-knop.wis { margin-right:auto; }
`

function zetStijl() {
  if (document.getElementById('sm-stijl')) return
  const s = document.createElement('style'); s.id = 'sm-stijl'; s.textContent = STIJL
  document.head.appendChild(s)
}
function el(tag, attrs = {}, ...kind) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v
    else if (k === 'text') e.textContent = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else e.setAttribute(k, v)
  }
  e.append(...kind)
  return e
}

export async function startStickermaker(houder, uid, widgets = null) {
  if (!houder || !uid) return
  zetStijl()
  zetWidgetStijl()
  let eigen = {}
  try { eigen = await leesEigen(uid) } catch (e) { console.warn('[stickermaker] lezen mislukt', e) }

  /* ---------- de twee vellen ---------- */
  const status = el('p', { class: 'sm-status', 'aria-live': 'polite' })
  const vellen = el('div', { class: 'sm' })
  houder.textContent = ''
  houder.append(vellen)
  function tekenVellen() {
    vellen.textContent = ''
    vellen.append(el('p', { class: 'sm-uitleg', text: T('Maak een sticker van je eigen afbeelding, met een beweging en een geluid. Je stickers staan op dit toestel. Je vrienden krijgen ze vanzelf zodra jullie allebei online zijn.') }))
    if (widgets) vellen.append(el('p', { class: 'sm-uitleg', text: T('Met het knopje \u{1F3E0} onder een sticker zet je hem op Home (druk daarna op Opslaan).') }))
    EIGEN_VELLEN.forEach((vel, vi) => {
      const aantal = Object.keys(eigen).filter(c => c.startsWith(vel + '-')).length
      const kop = el('div', { class: 'sm-velkop' }, el('b', { text: T('Eigen vel {n}', { n: vi + 1 }) }), el('span', { text: T('{n} van 12', { n: aantal }) }))
      const raster = el('div', { class: 'sm-raster', style: 'align-items:start' })
      for (let nr = 1; nr <= PER_VEL; nr++) {
        const code = maakCode(vel, nr), s = eigen[code]
        const knop = el('button', { type: 'button', class: 'sm-plek' + (s ? ' vol' : ''), 'data-code': code })
        if (s) {
          knop.setAttribute('aria-label', s.naam ? T('Sticker {naam} aanpassen', { naam: s.naam }) : T('Sticker aanpassen'))
          knop.append(el('img', { src: s.data, alt: '' }))
        } else {
          knop.setAttribute('aria-label', T('Nieuwe sticker in eigen vel {v}, plek {n}', { v: vi + 1, n: nr }))
          knop.textContent = '+'
        }
        knop.addEventListener('click', () => open(code, knop))
        const cel = el('div', { class: 'sw-cel' }, knop)
        if (s && widgets) cel.append(maakSchakelaar(widgetId(code), s.naam ? T('{naam} op Home', { naam: s.naam }) : T('Sticker {n} van eigen vel {v} op Home', { n: nr, v: vi + 1 }), widgets))
        raster.append(cel)
      }
      vellen.append(el('div', {}, kop, raster))
    })
    vellen.append(status)
  }
  tekenVellen()

  /* ---------- de maker ---------- */
  const opties = (lijst) => Object.keys(lijst).map(k => el('option', { value: k, text: naamVan(lijst[k]) }))
  const bestand = el('input', { type: 'file', accept: 'image/*', hidden: '' })
  const titel = el('h2', { id: 'smTitel' })
  const sluit = el('button', { type: 'button', class: 'sm-x', 'aria-label': T('Sluiten'), text: '✕' })
  const kiesKnop = el('button', { type: 'button', class: 'sm-knop hoofd' })
  const kiesUitleg = el('p', { class: 'sm-klein', text: T('Een foto of plaatje van je toestel. Heeft hij een effen achtergrond, dan haalt {app} die zelf weg.') })
  const stapKies = el('div', { class: 'sm-stap' }, kiesKnop, kiesUitleg, bestand)

  const MODI = [['achtergrond', T('Achtergrond weg')], ['vinger', T('Lijn eromheen')], ['alles', T('Alles houden')]]
  const segment = el('div', { class: 'sm-segment', role: 'radiogroup', 'aria-label': T('Begin met') })
  const modusKnop = {}
  MODI.forEach(([m, tekst]) => { const b = el('button', { type: 'button', role: 'radio', 'data-modus': m, text: tekst }); b.addEventListener('click', () => zetModus(m)); modusKnop[m] = b; segment.append(b) })
  const werk = el('canvas', { class: 'sm-werk sm-ruit', 'aria-label': T('Je afbeelding') })
  const hint = el('p', { class: 'sm-hint' })
  const schuif = el('input', { type: 'range', min: '10', max: '120', step: '5', value: '45', id: 'smStreng' })
  const schuifRij = el('label', { class: 'sm-schuif' }, el('span', { text: T('Hoe streng') }), schuif)
  // v231: bijwerken met je vinger: lijn (alleen bij 'Lijn eromheen'), weghalen of terugzetten, met een grootte
  const GEREEDSCHAP = [['lijn', T('✂️ Lijn')], ['gum', T('🧽 Weghalen')], ['terug', T('🖌️ Terugzetten')]]
  const tuig = el('div', { class: 'sm-segment', role: 'radiogroup', 'aria-label': T('Bijwerken met je vinger') })
  const tuigKnop = {}
  GEREEDSCHAP.forEach(([g, tekst]) => { const b = el('button', { type: 'button', role: 'radio', 'data-tuig': g, text: tekst }); b.addEventListener('click', () => zetTuig(g)); tuigKnop[g] = b; tuig.append(b) })
  const tuigHint = el('p', { class: 'sm-hint' })
  const kwast = el('input', { type: 'range', min: String(KWAST_MIN), max: String(KWAST_MAX), step: '2', value: String(KWAST_STANDAARD), id: 'smKwast', 'aria-label': T('Kwastgrootte') })
  const kwastBolletje = el('span', { class: 'sm-bol', 'aria-hidden': 'true' })
  const kwastRij = el('label', { class: 'sm-schuif sm-kwast' }, el('span', { text: T('Grootte') }), kwast, kwastBolletje)
  const ongedaan = el('button', { type: 'button', class: 'sm-knop', text: T('↶ Ongedaan maken') })
  const opnieuw = el('button', { type: 'button', class: 'sm-knop', text: T('Opnieuw beginnen') })
  const randVink = el('input', { type: 'checkbox', id: 'smRand' }); randVink.checked = true
  const randRij = el('label', { class: 'sm-vink' }, randVink, el('span', { text: T('Witte rand') }))
  const stapKnip = el('div', { class: 'sm-stap' }, el('div', { class: 'sm-label', text: T('Begin met') }), segment, hint, schuifRij, werk,
    el('div', { class: 'sm-label', text: T('Bijwerken met je vinger') }), tuig, tuigHint, kwastRij, el('div', { class: 'sm-rij' }, ongedaan, opnieuw), randRij)

  const voorbeeldImg = el('img', { alt: '' })
  const voorbeeldLeeg = el('span', { class: 'sm-leeg', text: T('Kies eerst een afbeelding.') })
  const voorbeeld = el('button', { type: 'button', class: 'sm-voorbeeld sm-ruit', 'aria-label': T('Speel je sticker af') }, voorbeeldLeeg, voorbeeldImg)
  const kiesB = el('select', { id: 'smBeweging' }, ...opties(BEWEGINGEN))
  const kiesG = el('select', { id: 'smGeluid' }, ...opties(GELUIDEN))
  const naam = el('input', { type: 'text', id: 'smNaam', maxlength: '30', autocomplete: 'off', placeholder: T('Bijvoorbeeld: Blije kat') })
  const fout = el('p', { class: 'sm-fout', role: 'alert' })
  const stapAf = el('div', { class: 'sm-stap' }, el('div', { class: 'sm-label', text: T('Je sticker') }), voorbeeld,
    el('div', { class: 'sm-veld' }, el('label', { for: 'smBeweging', text: T('Beweging') }), kiesB),
    el('div', { class: 'sm-veld' }, el('label', { for: 'smGeluid', text: T('Geluid') }), kiesG),
    el('div', { class: 'sm-veld' }, el('label', { for: 'smNaam', text: T('Naam') }), naam), fout)

  const wis = el('button', { type: 'button', class: 'sm-knop wis', text: T('Verwijderen') })
  const annuleer = el('button', { type: 'button', class: 'sm-knop', text: T('Annuleren') })
  const bewaar = el('button', { type: 'button', class: 'sm-knop hoofd', text: T('Bewaren') })
  const kaart = el('div', { class: 'sm-kaart' }, el('div', { class: 'sm-kop' }, titel, sluit), stapKies, stapKnip, stapAf, el('div', { class: 'sm-onder' }, wis, annuleer, bewaar))
  const scherm = el('div', { class: 'sm-scherm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'smTitel', hidden: '' }, kaart)
  document.body.append(scherm)

  // toestand van de maker
  let code = null, terugNaar = null, bron = null, rand = null, modus = 'achtergrond', lijn = null, tekent = false
  let tuigNu = 'gum', streken = [], streek = null, begin = null, beginSleutel = '', uit = null // v231
  let resultaat = null, wisZeker = false, wisKlok = null

  function toonFout(t) { fout.textContent = t || '' }
  function zetVoorbeeld(data) {
    resultaat = data
    voorbeeldImg.hidden = !data; voorbeeldLeeg.hidden = !!data
    if (data) voorbeeldImg.src = data; else voorbeeldImg.removeAttribute('src')
  }

  function open(c, knop) {
    code = c; terugNaar = knop || null
    const s = eigen[c]
    bron = null; lijn = null; rand = null; wisZeker = false
    wis.classList.remove('zeker'); wis.textContent = T('Verwijderen')
    toonFout('')
    titel.textContent = s ? T('Sticker aanpassen') : T('Nieuwe sticker')
    kiesKnop.textContent = s ? T('Andere afbeelding') : T('Kies een afbeelding')
    kiesKnop.className = 'sm-knop' + (s ? '' : ' hoofd')
    kiesUitleg.hidden = !!s
    stapKnip.hidden = true
    wis.hidden = !s
    zetVoorbeeld(s ? s.data : null)
    kiesB.value = (s && BEWEGINGEN[s.b]) ? s.b : STANDAARD.b
    kiesG.value = (s && GELUIDEN[s.g]) ? s.g : STANDAARD.g
    naam.value = s ? s.naam : ''
    scherm.hidden = false
    document.body.style.overflow = 'hidden'
    scherm.scrollTop = 0
    ;(s ? voorbeeld : kiesKnop).focus()
  }
  function dicht() {
    scherm.hidden = true
    document.body.style.overflow = ''
    bron = null; lijn = null
    if (terugNaar && document.body.contains(terugNaar)) terugNaar.focus()
  }
  sluit.addEventListener('click', dicht)
  annuleer.addEventListener('click', dicht)
  scherm.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); dicht() } })
  scherm.addEventListener('click', e => { if (e.target === scherm) dicht() })

  kiesKnop.addEventListener('click', () => { bestand.value = ''; bestand.click() })
  bestand.addEventListener('change', async () => {
    const f = bestand.files && bestand.files[0]
    if (!f) return
    toonFout('')
    kiesKnop.textContent = T('Afbeelding laden…')
    try {
      bron = await laadAfbeelding(f)
    } catch (e) {
      bron = null
      toonFout(e && e.message === 'te-groot' ? T('Deze afbeelding is te groot (meer dan 30 MB).') : T('Dit bestand is geen afbeelding die {app} kan openen.'))
    }
    kiesKnop.textContent = T('Andere afbeelding'); kiesKnop.className = 'sm-knop'; kiesUitleg.hidden = true
    if (!bron) return
    rand = bekijkRand(bron)
    lijn = null; streken = []; streek = null; begin = null; beginSleutel = ''
    werk.width = bron.width; werk.height = bron.height
    stapKnip.hidden = false
    zetModus((rand.doorzichtig || rand.effen) ? 'achtergrond' : 'vinger')
  })

  function zetModus(m) {
    modus = m
    for (const [k, b] of Object.entries(modusKnop)) b.setAttribute('aria-checked', k === m ? 'true' : 'false')
    schuifRij.hidden = m !== 'achtergrond' || (rand && rand.doorzichtig)
    if (m === 'achtergrond') hint.textContent = (rand && rand.doorzichtig) ? T('Deze afbeelding heeft al geen achtergrond.') : T('Alles wat op de kleur van de rand lijkt, wordt doorzichtig.')
    else if (m === 'vinger') hint.textContent = T('Trek met je vinger een lijn om wat je wilt houden. Daarna kun je nog bijwerken.')
    else hint.textContent = T('De hele afbeelding wordt de sticker.')
    tuigKnop.lijn.hidden = m !== 'vinger'
    tuig.style.gridTemplateColumns = m === 'vinger' ? '' : 'repeat(2, minmax(0, 1fr))'
    zetTuig(m === 'vinger' && !lijn ? 'lijn' : (tuigNu === 'lijn' ? 'gum' : tuigNu), true)
    verwerk()
  }
  function zetTuig(g, stil) {
    if (g === 'lijn' && modus !== 'vinger') g = 'gum'
    tuigNu = g
    for (const [k, b] of Object.entries(tuigKnop)) b.setAttribute('aria-checked', k === g ? 'true' : 'false')
    tuigHint.textContent = g === 'lijn' ? T('Trek met je vinger een lijn om wat je wilt houden.') : g === 'gum' ? T('Veeg met je vinger over wat weg moet.') : T('Veeg met je vinger over wat terug moet komen.')
    kwastRij.hidden = g === 'lijn'
    if (!stil) teken()
  }
  function zetKnoppen() {
    ongedaan.disabled = !streken.length
    opnieuw.disabled = !streken.length && !(modus === 'vinger' && lijn)
  }
  schuif.addEventListener('input', () => verwerk())
  randVink.addEventListener('change', () => verwerk())
  opnieuw.addEventListener('click', () => { streken = []; streek = null; if (modus === 'vinger') { lijn = null; zetTuig('lijn', true) } verwerk() })
  ongedaan.addEventListener('click', () => { if (streken.length) { streken.pop(); verwerk() } })
  const toonBol = () => { const d = Number(kwast.value); kwastBolletje.style.width = kwastBolletje.style.height = d + 'px' }
  kwast.addEventListener('input', () => { toonBol(); if (!uit) return; teken(); const r = werk.getBoundingClientRect(); cirkel([werk.width / 2, werk.height / 2], kwastStraal(kwast.value, werk.width, r.width)) })
  toonBol()

  // uitknippen en het voorbeeld maken. v231: begin (achtergrond weg / lijn / alles) + de streken van de kwast
  function maakBegin() {
    const sleutel = modus + '|' + (modus === 'achtergrond' ? schuif.value : '') + '|' + (modus === 'vinger' && lijn ? lijn.length + ':' + lijn[0] + ':' + lijn[lijn.length - 1] : '')
    if (begin && sleutel === beginSleutel) return begin
    beginSleutel = sleutel
    if (modus === 'achtergrond') begin = achtergrondWeg(bron, Number(schuif.value))
    else if (modus === 'alles') begin = bron
    else begin = (lijn && lijn.length >= 3 && !tekent) ? knipMetLijn(bron, lijn) : null
    return begin
  }
  function verwerk() {
    if (!bron) return
    toonFout('')
    const b = maakBegin()
    uit = b ? pasStrekenToe(b, bron, streken) : null
    teken()
    zetKnoppen()
    if (!uit) { zetVoorbeeld(null); voorbeeldLeeg.textContent = T('Trek met je vinger een lijn om wat je wilt houden.'); return }
    maakVoorbeeld()
  }
  function maakVoorbeeld() {
    try {
      zetVoorbeeld(maakSticker(uit, { rand: randVink.checked }).data)
    } catch (e) {
      zetVoorbeeld(null)
      voorbeeldLeeg.textContent = T('Er blijft niets over.')
      toonFout(modus === 'achtergrond' && !streken.length ? T('Er blijft niets over van de afbeelding. Zet ‘Hoe streng’ lager of knip met je vinger.') : T('Er blijft niets over van de afbeelding.'))
    }
  }
  // het werkvlak: bij lijn en terugzetten de hele afbeelding vaag erachter, zodat je ziet wat er was
  function teken() {
    if (!bron) return
    const p = werk.getContext('2d')
    p.clearRect(0, 0, werk.width, werk.height)
    const vaag = tuigNu === 'terug' || (modus === 'vinger' && tuigNu === 'lijn')
    if (!uit) { p.drawImage(bron, 0, 0); tekenLijn(p, false); return }
    if (vaag) { p.globalAlpha = 0.25; p.drawImage(bron, 0, 0); p.globalAlpha = 1 }
    p.drawImage(uit, 0, 0)
    if (modus === 'vinger' && tuigNu === 'lijn') tekenLijn(p, !tekent)
  }
  // een rondje waar je vinger is, zo groot als de kwast
  function cirkel(q, r) {
    const p = werk.getContext('2d'), dik = Math.max(1.5, werk.width / 260)
    p.save(); p.lineWidth = dik * 2; p.strokeStyle = 'rgba(0,0,0,0.6)'
    p.beginPath(); p.arc(q[0], q[1], r, 0, Math.PI * 2); p.stroke()
    p.lineWidth = dik; p.strokeStyle = '#ffffff'; p.stroke(); p.restore()
  }
  function tekenLijn(p, dicht) {
    if (!lijn || lijn.length < 2) return
    const dik = Math.max(2, werk.width / 160)
    p.save()
    p.lineJoin = 'round'; p.lineCap = 'round'; p.lineWidth = dik
    p.strokeStyle = '#f0abfc'; p.setLineDash(dicht ? [dik * 3, dik * 2] : [])
    p.beginPath(); p.moveTo(lijn[0][0], lijn[0][1])
    for (const [x, y] of lijn.slice(1)) p.lineTo(x, y)
    if (dicht) p.closePath()
    p.stroke()
    p.restore()
  }
  // met de vinger (of muis) tekenen op de afbeelding
  function punt(e) {
    const r = werk.getBoundingClientRect()
    return [Math.max(0, Math.min(werk.width, (e.clientX - r.left) * werk.width / r.width)), Math.max(0, Math.min(werk.height, (e.clientY - r.top) * werk.height / r.height))]
  }
  werk.addEventListener('pointerdown', e => {
    if (!bron) return
    if (modus === 'vinger' && tuigNu === 'lijn') {
      e.preventDefault()
      try { werk.setPointerCapture(e.pointerId) } catch (x) {}
      tekent = true; lijn = [punt(e)]; verwerk()
      return
    }
    if (!uit) return
    // v231: de kwast (weghalen of terugzetten)
    e.preventDefault()
    try { werk.setPointerCapture(e.pointerId) } catch (x) {}
    const r = werk.getBoundingClientRect()
    streek = { soort: tuigNu === 'terug' ? 'terug' : 'gum', r: kwastStraal(kwast.value, werk.width, r.width), punten: [punt(e)] }
    streken.push(streek)
    tekenStreek(uit, bron, streek, 0)
    teken(); cirkel(streek.punten[0], streek.r)
  })
  werk.addEventListener('pointermove', e => {
    if (streek) {
      const q = punt(e)
      if (voegPuntToe(streek, q)) tekenStreek(uit, bron, streek, streek.punten.length - 1)
      teken(); cirkel(q, streek.r)
      return
    }
    if (!tekent) return
    const q = punt(e), v = lijn[lijn.length - 1]
    if (Math.hypot(q[0] - v[0], q[1] - v[1]) < werk.width / 200) return
    lijn.push(q)
    const p = werk.getContext('2d'); p.clearRect(0, 0, werk.width, werk.height); p.drawImage(bron, 0, 0); tekenLijn(p, false)
  })
  const klaarMetTekenen = () => {
    if (streek) { streek = null; teken(); zetKnoppen(); maakVoorbeeld(); return }
    if (!tekent) return
    tekent = false
    if (lijn.length < 8) lijn = null
    if (lijn) zetTuig('gum', true) // de lijn staat: nu kun je bijwerken
    verwerk()
  }
  werk.addEventListener('pointerup', klaarMetTekenen)
  werk.addEventListener('pointercancel', klaarMetTekenen)

  // afspelen en kiezen
  voorbeeld.addEventListener('click', () => { if (resultaat) speel(voorbeeldImg, { b: kiesB.value, g: kiesG.value }) })
  kiesB.addEventListener('change', () => { if (resultaat) speel(voorbeeldImg, { b: kiesB.value, g: kiesG.value }, false) })
  kiesG.addEventListener('change', () => { if (resultaat) speel(voorbeeldImg, { b: 'geen', g: kiesG.value }) })

  bewaar.addEventListener('click', async () => {
    if (!resultaat) { toonFout(modus === 'vinger' && bron ? T('Trek eerst met je vinger een lijn om wat je wilt houden.') : T('Kies eerst een afbeelding.')); return }
    const s = { data: resultaat, b: kiesB.value, g: kiesG.value, naam: naam.value.trim().slice(0, 30) }
    try {
      await bewaarEigen(uid, code, s)
    } catch (e) {
      toonFout(T('Bewaren lukte niet. Is er genoeg ruimte op je toestel?')); return
    }
    eigen[code] = Object.assign({ code }, s)
    const c = code
    dicht(); tekenVellen()
    status.textContent = T('Sticker bewaard')
    const knop = vellen.querySelector('[data-code="' + c + '"]')
    if (knop) { knop.focus(); speel(knop.querySelector('img'), s, false) }
  })
  wis.addEventListener('click', async () => {
    if (!wisZeker) {
      wisZeker = true; wis.classList.add('zeker'); wis.textContent = T('Echt verwijderen?')
      clearTimeout(wisKlok); wisKlok = setTimeout(() => { wisZeker = false; wis.classList.remove('zeker'); wis.textContent = T('Verwijderen') }, 4000)
      return
    }
    clearTimeout(wisKlok)
    try { await wisEigen(uid, code) } catch (e) { toonFout(T('Verwijderen lukte niet.')); return }
    delete eigen[code]
    if (widgets) widgets.zet(widgetId(code), false) // v157: weg van Home (na Opslaan)
    const c = code
    dicht(); tekenVellen()
    status.textContent = T('Sticker verwijderd')
    const knop = vellen.querySelector('[data-code="' + c + '"]')
    if (knop) knop.focus()
  })
}
