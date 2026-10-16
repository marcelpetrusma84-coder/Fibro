// stickerwidget.js - stickers als widget op Home (v157, 16 oktober 2026; v160: stickerfx.js met mp3-geluiden)
// In Profiel, bij Stickers, staat onder elke sticker (je eigen stickers en de stickervellen van Fibro) een
// knopje met een huisje, net als bij de widgets. Aan + Opslaan = de sticker staat op Home, bij 'Jouw profiel',
// en je vrienden zien hem op jouw profiel. Daar gedraagt hij zich als een widget (verslepen door hem
// ingedrukt te houden, volgorde.js) en een tik speelt zijn beweging en geluid af (stickerfx.js).
// In de widget-indeling heet een sticker 'sticker_<code>': sticker_f1-05 (vel van Fibro) of sticker_e1-03
// (eigen sticker). Een eigen sticker van een vriend komt via de sync (sync.js); is hij er nog niet, dan
// staat er een zandlopertje dat vanzelf bijwerkt (vriend-profiel.html ververst de widgets).
import { FIBRO_VELLEN, zoekSticker } from './stickervellen.js?v=156'
import { zoekEigenSticker, zoekVriendSticker } from './eigenstickers.js?v=155'
import { BEWEGINGEN, speel } from './stickerfx.js?v=160'

const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

const ID = /^sticker_((?:f[1-6]|e[12])-(?:0[1-9]|1[0-2]))$/
export const widgetId = code => 'sticker_' + code
export const codeVan = id => { const m = ID.exec(String(id || '')); return m ? m[1] : null }
// De widget in de indeling (profiel.html, Opslaan): een klein vakje zonder kop
export function stickerWidgetDef(id) {
  return codeVan(id) ? { id: String(id), icon: '\u{1F3A8}', titel: 'Sticker', w: 1, h: 1, geenHeader: true } : null
}
// Naam van een sticker: van Fibro [Nederlands, Engels], van jezelf een tekst
export function stickerNaam(st) {
  if (!st) return T('Sticker')
  if (Array.isArray(st.naam)) return (window.T && window.T.taal === 'en' ? st.naam[1] : st.naam[0]) || T('Sticker')
  return String(st.naam || '').trim() || T('Sticker')
}

const STIJL = `
.sw-sectie [hidden] { display:none !important; }
.sw-uitleg { margin:0 0 10px; font-size:15px; line-height:1.5; color:var(--text); }
.sw-raster { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; align-items:start; }
.sw-cel { display:flex; flex-direction:column; align-items:center; min-width:0; }
.sw-plek { width:100%; aspect-ratio:1; box-sizing:border-box; border-radius:14px; border:1px solid var(--border); background:var(--card); padding:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; -webkit-tap-highlight-color:transparent; }
.sw-plek img { width:100%; height:100%; object-fit:contain; pointer-events:none; -webkit-user-drag:none; }
.sw-schakel { min-height:44px; min-width:44px; display:inline-flex; align-items:center; justify-content:center; gap:5px; background:none; border:0; padding:0 4px; margin:0; cursor:pointer; color:var(--text); font:inherit; -webkit-tap-highlight-color:transparent; }
.sw-huis { font-size:13px; line-height:1; opacity:0.5; transition:opacity 0.2s; }
.sw-baan { width:36px; height:20px; border-radius:10px; background:rgba(255,255,255,0.15); position:relative; flex-shrink:0; transition:background 0.2s; }
.sw-bol { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:left 0.2s; }
.sw-schakel[aria-checked="true"] .sw-huis { opacity:1; }
.sw-schakel[aria-checked="true"] .sw-baan { background:var(--accent); }
.sw-schakel[aria-checked="true"] .sw-bol { left:18px; }
.sw-schakel:focus-visible, .sw-plek:focus-visible, .sw-blok:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.widget-blok.sw-blok { cursor:pointer; -webkit-tap-highlight-color:transparent; }
.widget-blok.sw-blok > .widget-inhoud.sw-inhoud { padding:0 !important; overflow:visible !important; display:flex; align-items:center; justify-content:center; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35)); }
.sw-sticker { display:block; width:100%; max-width:120px; height:auto; aspect-ratio:1; object-fit:contain; pointer-events:none; -webkit-user-drag:none; user-select:none; }
.sw-wacht { width:100%; max-width:120px; aspect-ratio:1; box-sizing:border-box; border:1.5px dashed rgba(192,132,252,0.5); border-radius:18px; display:flex; align-items:center; justify-content:center; font-size:22px; opacity:0.8; }
`
export function zetStijl() {
  if (document.getElementById('sw-stijl')) return
  const s = document.createElement('style'); s.id = 'sw-stijl'; s.textContent = STIJL
  document.head.appendChild(s)
}
function el(tag, attrs = {}, ...kind) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v
    else if (k === 'text') e.textContent = v
    else e.setAttribute(k, v)
  }
  e.append(...kind)
  return e
}

/* ---------- Profiel: het knopje ---------- */
// widgets = { aan(id) -> true/false, zet(id, aan) } uit profiel.html (de lijst met widgets, bewaard met Opslaan)
export function maakSchakelaar(id, label, widgets) {
  zetStijl()
  const aan = !!(widgets && widgets.aan(id))
  const knop = el('button', { type: 'button', class: 'sw-schakel', role: 'switch', 'aria-checked': aan ? 'true' : 'false', 'aria-label': label, 'data-widget': id },
    el('span', { class: 'sw-huis', 'aria-hidden': 'true', text: '\u{1F3E0}' }),
    el('span', { class: 'sw-baan', 'aria-hidden': 'true' }, el('span', { class: 'sw-bol' })))
  knop.addEventListener('click', () => {
    const nieuw = knop.getAttribute('aria-checked') !== 'true'
    if (widgets) widgets.zet(id, nieuw)
    knop.setAttribute('aria-checked', nieuw ? 'true' : 'false')
  })
  return knop
}

/* ---------- Profiel: de stickervellen van Fibro ---------- */
// Elk gevuld vel als een eigen blok (zoals 'Stickervel 1'): tik = afspelen, knopje = op Home
export function tekenFibroVellen(houder, widgets) {
  if (!houder) return
  zetStijl()
  houder.textContent = ''
  FIBRO_VELLEN.forEach((vel, vi) => {
    if (!vel.stickers.length) return
    const raster = el('div', { class: 'sw-raster' })
    vel.stickers.forEach(s => {
      const code = vel.id + '-' + s.nr
      const st = zoekSticker(code)
      if (!st) return
      const naam = stickerNaam(st)
      const img = el('img', { src: st.src, alt: '', width: '384', height: '384', loading: 'lazy', draggable: 'false' })
      const knop = el('button', { type: 'button', class: 'sw-plek', 'aria-label': T('Speel sticker {naam}', { naam }), 'data-code': code }, img)
      knop.addEventListener('click', () => speel(img, st))
      raster.append(el('div', { class: 'sw-cel' }, knop, maakSchakelaar(widgetId(code), T('{naam} op Home', { naam }), widgets)))
    })
    houder.append(el('div', { class: 'section sw-sectie', 'data-vel': vel.id },
      el('div', { class: 'section-label', text: T('Stickervel {n}', { n: vi + 1 }) }),
      el('p', { class: 'sw-uitleg', text: T('Tik op een sticker: hij beweegt en maakt geluid. Zet het knopje \u{1F3E0} aan en druk op Opslaan, dan staat hij op Home.') }),
      raster))
  })
}

/* ---------- Home en het profiel van een vriend: de widget zelf ---------- */
// c = .widget-inhoud van het blok. uid = jij (Home), vriendId = de vriend (vriend-profiel.html).
export async function tekenStickerWidget(c, id, { uid = null, vriendId = null } = {}) {
  if (!c) return
  zetStijl()
  const code = codeVan(id)
  const blok = c.closest('.widget-blok') || c
  blok.classList.add('sw-blok', 'widget-blok-naakt')
  c.classList.add('sw-inhoud')
  let st = null
  if (code && code[0] === 'f') st = zoekSticker(code)
  else if (code) st = await (vriendId ? zoekVriendSticker(vriendId, code) : zoekEigenSticker(uid, code))
  if (!st) {
    if (code && code[0] === 'e' && vriendId) {
      // eigen sticker van de vriend, nog niet binnen
      c.replaceChildren(el('div', { class: 'sw-wacht', role: 'img', 'aria-label': T('Sticker komt eraan'), text: '⏳' }))
      return
    }
    blok.remove() // weggegooid (of een vel dat er niet meer is): niets laten zien
    return
  }
  const naam = stickerNaam(st)
  const img = el('img', { class: 'sw-sticker', src: st.src, alt: '', width: '384', height: '384', draggable: 'false' })
  c.replaceChildren(img)
  blok.setAttribute('role', 'button')
  blok.setAttribute('tabindex', '0')
  blok.setAttribute('aria-label', T('Speel sticker {naam}', { naam }))
  blok.dataset.b = st.b
  blok.dataset.g = st.g
  let klok = null
  const speelAf = () => {
    speel(img, st)
    // tijdens de beweging boven de buren, anders valt een grote sprong half achter het volgende blok
    const ms = (BEWEGINGEN[st.b] && BEWEGINGEN[st.b].ms) || 0
    blok.style.zIndex = '5'
    clearTimeout(klok); klok = setTimeout(() => { blok.style.zIndex = '' }, ms + 50)
  }
  blok.addEventListener('click', speelAf)
  blok.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); speelAf() } })
}
