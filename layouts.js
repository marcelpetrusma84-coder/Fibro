// layouts.js (25 nov 2026) - widget-layouts uit Stekky Studio: één widget die een paar bestaande widgets samen laat zien,
// bijvoorbeeld een grote PeerTube-video met je RSS-nieuws eronder.
//
// In gewone woorden: moderators maken in Stekky Studio een layout (welke vakken, waar, en wat er in elk vak komt). Dat
// wordt een pakketbestand (naam.stekkylayout.json); tests/tools/studio-layout-installeer.mjs zet het in de app
// (studio-layouts.js). Daarna staat de layout in de Store bij Widgets. Wie hem downloadt, krijgt op Home één widget
// 'mix_<id>' met die vakken.
//  - Een vak laat een BESTAANDE widget zien (PeerTube, Bandcamp & Funkwhale, Radio, RSS, Mastodon), met dezelfde inhoud
//    als die widget los: je vult hem één keer in. Daarom kan elke soort maar één keer in een layout.
//  - Er komt geen nieuwe opslag of synchronisatie bij: vrienden krijgen de inhoud al via die widgets (sync.js), en de
//    layout zelf staat in de app (iedereen heeft dezelfde studio-layouts.js).
//  - Gebruikers kunnen een layout (nog) niet aanpassen. Het formaat (vakken met x, y, w, h in een rooster van 4 breed)
//    is wel zo gemaakt dat dat later kan: een aangepaste layout is gewoon een andere lijst vakken.
//
// Gebruik:
//   valideerLayout(pakket)       -> [] of een lijst met fouten (Nederlands)
//   maakLayout({ titel, uitleg, sjabloon, soorten })  -> een pakket (voor de Studio)
//   layoutVan(widgetId)          -> de layout bij 'mix_<id>', of null
//   mixWidgetDef(widgetId)       -> { id, icon, titel, w, h } voor Home en Profiel, of null
//   tekenMix(el, layout, tekenVak)   -> tekent de vakken; tekenVak(soort, inhoudEl) vult er één

import { STUDIO_LAYOUTS } from './studio-layouts.js?v=1'

export const FORMAAT = 'stekky-layout'
export const BREED = 4 // Home is 4 vakjes breed
export const MIN_VAKKEN = 2, MAX_VAKKEN = 4, MIN_H = 2, MAX_H = 8
export const MAX_TITEL = 40, MAX_UITLEG = 200

// Wat er in een vak kan: een bestaande widget uit de Store (zelfde naam als die widget)
export const VAK_SOORTEN = {
  peertube: { icoon: '🎬', naam: ['Video (PeerTube)', 'Video (PeerTube)'] },
  muziekwidget: { icoon: '🎧', naam: ['Muziek (Bandcamp & Funkwhale)', 'Music (Bandcamp & Funkwhale)'] },
  radio: { icoon: '📻', naam: ['Radio', 'Radio'] },
  rss: { icoon: '📰', naam: ['Berichten (RSS)', 'Posts (RSS)'] },
  mastodon: { icoon: '🐘', naam: ['Berichten (Mastodon)', 'Posts (Mastodon)'] },
}

// De sjablonen waaruit de Studio kiest (rooster 4 breed, h hoog)
export const SJABLONEN = [
  { id: 'groot-boven', naam: 'Groot boven, breed eronder', h: 5, vakken: [{ x: 0, y: 0, w: 4, h: 3 }, { x: 0, y: 3, w: 4, h: 2 }], voorstel: ['peertube', 'rss'] },
  { id: 'naast-elkaar', naam: 'Twee naast elkaar', h: 3, vakken: [{ x: 0, y: 0, w: 2, h: 3 }, { x: 2, y: 0, w: 2, h: 3 }], voorstel: ['muziekwidget', 'mastodon'] },
  { id: 'drie', naam: 'Groot boven, twee eronder', h: 6, vakken: [{ x: 0, y: 0, w: 4, h: 3 }, { x: 0, y: 3, w: 2, h: 3 }, { x: 2, y: 3, w: 2, h: 3 }], voorstel: ['peertube', 'muziekwidget', 'rss'] },
  { id: 'vier', naam: 'Vier vakken', h: 6, vakken: [{ x: 0, y: 0, w: 2, h: 3 }, { x: 2, y: 0, w: 2, h: 3 }, { x: 0, y: 3, w: 2, h: 3 }, { x: 2, y: 3, w: 2, h: 3 }], voorstel: ['peertube', 'muziekwidget', 'rss', 'mastodon'] },
]

const tekst = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max)
const geheel = (n, min, max) => Number.isInteger(n) && n >= min && n <= max

export function valideerLayout(p) {
  const f = []
  if (!p || typeof p !== 'object' || p.formaat !== FORMAAT) return ['Dit is geen layoutbestand van Stekky Studio.']
  if (p.versie !== 1) f.push('Onbekende versie van het layoutbestand.')
  if (typeof p.titel !== 'string' || !p.titel.trim()) f.push('De naam van de layout ontbreekt.')
  else if (p.titel.trim().length > MAX_TITEL) f.push('De naam is te lang (hoogstens ' + MAX_TITEL + ' tekens).')
  if (!Array.isArray(p.uitleg) || p.uitleg.length !== 2 || p.uitleg.some(u => typeof u !== 'string' || !u.trim() || u.length > MAX_UITLEG))
    f.push('De uitleg moet er in het Nederlands en het Engels zijn (elk hoogstens ' + MAX_UITLEG + ' tekens).')
  if (!geheel(p.h, MIN_H, MAX_H)) f.push('De hoogte moet tussen ' + MIN_H + ' en ' + MAX_H + ' vakjes zijn.')
  const v = Array.isArray(p.vakken) ? p.vakken : []
  if (v.length < MIN_VAKKEN || v.length > MAX_VAKKEN) f.push('Een layout heeft ' + MIN_VAKKEN + ' tot ' + MAX_VAKKEN + ' vakken.')
  const bezet = new Set(), soorten = new Set()
  v.forEach((vak, i) => {
    const nr = 'Vak ' + (i + 1)
    if (!vak || typeof vak !== 'object') { f.push(nr + ' is leeg.'); return }
    if (!VAK_SOORTEN[vak.soort]) f.push(nr + ': onbekende soort "' + vak.soort + '".')
    else if (soorten.has(vak.soort)) f.push(nr + ': ' + VAK_SOORTEN[vak.soort].naam[0] + ' staat er al in (elke soort kan één keer).')
    soorten.add(vak.soort)
    if (!geheel(vak.x, 0, BREED - 1) || !geheel(vak.y, 0, MAX_H - 1) || !geheel(vak.w, 1, BREED) || !geheel(vak.h, 1, MAX_H) ||
      vak.x + vak.w > BREED || (geheel(p.h, MIN_H, MAX_H) && vak.y + vak.h > p.h)) { f.push(nr + ' valt buiten de layout.'); return }
    for (let x = vak.x; x < vak.x + vak.w; x++) for (let y = vak.y; y < vak.y + vak.h; y++) {
      const k = x + ',' + y
      if (bezet.has(k)) { f.push(nr + ' ligt over een ander vak.'); return }
      bezet.add(k)
    }
  })
  return f
}

export function maakLayout({ titel, uitleg, sjabloon, soorten }) {
  const s = SJABLONEN.find(x => x.id === sjabloon) || SJABLONEN[0]
  return {
    formaat: FORMAAT, versie: 1, titel: tekst(titel, MAX_TITEL),
    uitleg: [tekst(uitleg && uitleg[0], MAX_UITLEG), tekst(uitleg && uitleg[1], MAX_UITLEG)],
    h: s.h, vakken: s.vakken.map((v, i) => ({ soort: (soorten || [])[i] || s.voorstel[i], ...v })),
  }
}

export function layoutVan(widgetId, lijst = STUDIO_LAYOUTS) {
  if (typeof widgetId !== 'string' || !widgetId.startsWith('mix_')) return null
  const l = lijst.find(x => 'mix_' + x.id === widgetId)
  return l && valideerLayout({ formaat: FORMAAT, versie: 1, ...l }).length === 0 ? l : null
}
export function mixWidgetDef(widgetId, lijst = STUDIO_LAYOUTS) {
  const l = layoutVan(widgetId, lijst)
  return l ? { id: widgetId, icon: '🧩', titel: l.titel, w: BREED, h: l.h } : null
}

// De vakken tekenen: een rooster met per vak een kopje (icoon en naam) en een inhoud die tekenVak vult.
export function tekenMix(el, layout, tekenVak, { taal = 'nl' } = {}) {
  el.textContent = ''
  const rooster = document.createElement('div')
  rooster.className = 'mix-rooster'
  rooster.style.cssText = 'display:grid;grid-template-columns:repeat(' + BREED + ',minmax(0,1fr));grid-template-rows:repeat(' + layout.h + ',minmax(0,1fr));gap:8px;width:100%;height:100%;min-height:' + (layout.h * 70) + 'px'
  for (const vak of layout.vakken) {
    const s = VAK_SOORTEN[vak.soort]
    if (!s) continue
    const v = document.createElement('div')
    v.className = 'mix-vak'; v.dataset.soort = vak.soort
    v.style.cssText = 'grid-column:' + (vak.x + 1) + ' / span ' + vak.w + ';grid-row:' + (vak.y + 1) + ' / span ' + vak.h +
      ';display:flex;flex-direction:column;min-width:0;min-height:0;background:rgba(0,0,0,0.22);border:0.5px solid rgba(255,255,255,0.12);border-radius:12px;padding:6px;position:relative;overflow:hidden'
    const kop = document.createElement('div')
    kop.className = 'mix-kop'
    kop.style.cssText = 'font-size:11px;font-weight:700;color:var(--accent,#c084fc);margin:0 0 4px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;z-index:3'
    kop.textContent = s.icoon + ' ' + s.naam[taal === 'en' ? 1 : 0]
    const inhoud = document.createElement('div')
    inhoud.className = 'mix-inhoud widget-inhoud'
    inhoud.style.cssText = 'flex:1;min-height:0;overflow:auto;position:relative'
    v.append(kop, inhoud)
    rooster.appendChild(v)
    try { tekenVak(vak.soort, inhoud) } catch (e) { console.warn('[layout]', vak.soort, e) }
  }
  el.appendChild(rooster)
  return rooster
}
