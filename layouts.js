// layouts.js (25 nov 2026) - widget-layouts uit Stekky Studio: één widget die een paar bestaande widgets samen laat zien,
// bijvoorbeeld een grote PeerTube-video met je RSS-nieuws eronder.
//
// In gewone woorden: moderators maken in Stekky Studio een layout (welke vakken, waar, en wat er in elk vak komt). Dat
// wordt een pakketbestand (naam.stekkylayout.json); tests/tools/studio-layout-installeer.mjs zet het in de app
// (studio-layouts.js). Daarna staat de layout in de Store bij Widgets. Wie hem downloadt, krijgt op Home één widget
// 'mix_<id>' met die vakken.
//  - Een vak laat een BESTAANDE widget zien (PeerTube, Funkwhale, Radio, RSS, Mastodon), met dezelfde inhoud
//    als die widget los: je vult hem één keer in. Daarom kan elke soort maar één keer in een layout.
//  - Er komt geen nieuwe opslag of synchronisatie bij: vrienden krijgen de inhoud al via die widgets (sync.js), en de
//    layout zelf staat in de app (iedereen heeft dezelfde studio-layouts.js).
//  - Gebruikers kunnen een layout (nog) niet aanpassen. Het formaat (vakken met x, y, w, h in een rooster van 4 breed)
//    is wel zo gemaakt dat dat later kan: een aangepaste layout is gewoon een andere lijst vakken.
//
// Kant-en-klare vakken (25 nov 2026): de maker kan in de Studio bij een vak de inhoud al invullen (vak.inhoud):
//  - RSS, "vast": de feeds van de maker (hoogstens 3), de gebruiker kan niets veranderen;
//  - RSS, "kiezen": de maker zet 2 tot 8 feeds klaar, de gebruiker vinkt er hoogstens 3 aan (bijvoorbeeld NU.nl Sport en Tech);
//  - PeerTube, "vast": een goedgekeurde server en categorieën (bijvoorbeeld Gaming), en of liken en reageren aan staat.
//  Zo'n vak heeft zijn EIGEN inhoud, los van de gewone widget: localStorage 'mix_<uid>' = { '<layout-id>:<soort>': cfg }.
//  Die gaat via sync naar vrienden ('klein:mix'), net als de andere widgets. Een vak zonder inhoud werkt zoals hierboven.
//
// Gebruik:
//   valideerLayout(pakket)       -> [] of een lijst met fouten (Nederlands)
//   maakLayout({ titel, uitleg, sjabloon, soorten })  -> een pakket (voor de Studio)
//   layoutVan(widgetId)          -> de layout bij 'mix_<id>', of null
//   mixWidgetDef(widgetId)       -> { id, icon, titel, w, h } voor Home en Profiel, of null
//   tekenMix(el, layout, tekenVak)   -> tekent de vakken; tekenVak(soort, inhoudEl) vult er één

import { STUDIO_LAYOUTS } from './studio-layouts.js?v=2'
import { netteFeedUrl, MAX_FEEDS } from './rsswidget.js?v=5'
import { SERVERS as PEERTUBE_SERVERS, CATEGORIEEN, MAX_CATS } from './peertube.js?v=6'

export const FORMAAT = 'stekky-layout'
export const BREED = 4 // Home is 4 vakjes breed
export const MIN_VAKKEN = 1, MAX_VAKKEN = 4, MIN_H = 2, MAX_H = 8 // v3: ook één vak (bijvoorbeeld alleen een nieuws-widget)
// v3 (25 nov 2026): de weergave per vak. Eerst de standaard. Video: lijst of carrousel (vegen, middelste groot, miniaturen);
// nieuws (RSS): met fotootjes of alleen koppen.
export const WEERGAVEN = { peertube: ['lijst', 'carrousel'], rss: ['fotos', 'koppen'] }
export const WEERGAVE_NAAM = { lijst: 'Lijst', carrousel: 'Carrousel (vegen, middelste groot)', fotos: 'Lijst met fotootjes', koppen: 'Alleen koppen' }
export const MAX_TITEL = 40, MAX_UITLEG = 200
export const MAX_KIES_FEEDS = 8, MAX_FEEDNAAM = 30
// Welke soorten een kant-en-klare inhoud kunnen hebben, en op welke manier
export const MANIEREN = { rss: ['vast', 'kiezen'], peertube: ['vast'] }
const CAT_NRS = new Set(CATEGORIEEN.map(c => c[0]))

// Wat er in een vak kan: een bestaande widget uit de Store (zelfde naam als die widget)
export const VAK_SOORTEN = {
  peertube: { icoon: '🎬', naam: ['Video (PeerTube)', 'Video (PeerTube)'] },
  muziekwidget: { icoon: '🎧', naam: ['Muziek (Funkwhale)', 'Music (Funkwhale)'] },
  radio: { icoon: '📻', naam: ['Radio', 'Radio'] },
  rss: { icoon: '📰', naam: ['Berichten (RSS)', 'Posts (RSS)'] },
  mastodon: { icoon: '🐘', naam: ['Berichten (Mastodon)', 'Posts (Mastodon)'] },
}

// De sjablonen waaruit de Studio kiest (rooster 4 breed, h hoog)
export const SJABLONEN = [
  { id: 'een', naam: 'Eén groot vak', h: 4, vakken: [{ x: 0, y: 0, w: 4, h: 4 }], voorstel: ['rss'] },
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
    if (vak.inhoud !== undefined) for (const t of controleerInhoud(vak.soort, vak.inhoud)) f.push(nr + ': ' + t)
    if (vak.weergave !== undefined && !(WEERGAVEN[vak.soort] || []).includes(vak.weergave)) f.push(nr + ': onbekende weergave "' + vak.weergave + '".')
    for (let x = vak.x; x < vak.x + vak.w; x++) for (let y = vak.y; y < vak.y + vak.h; y++) {
      const k = x + ',' + y
      if (bezet.has(k)) { f.push(nr + ' ligt over een ander vak.'); return }
      bezet.add(k)
    }
  })
  return f
}

// De kant-en-klare inhoud van één vak controleren. Geeft een lijst met fouten.
export function controleerInhoud(soort, i) {
  if (!i || typeof i !== 'object') return ['de inhoud klopt niet.']
  if (!MANIEREN[soort]) return ['dit soort vak kan geen vaste inhoud hebben (de gebruiker vult het zelf in).']
  if (!MANIEREN[soort].includes(i.manier)) return ['onbekende manier "' + i.manier + '".']
  const f = []
  if (soort === 'rss') {
    const feeds = Array.isArray(i.feeds) ? i.feeds : []
    const min = i.manier === 'kiezen' ? 2 : 1, max = i.manier === 'kiezen' ? MAX_KIES_FEEDS : MAX_FEEDS
    if (feeds.length < min || feeds.length > max) f.push(i.manier === 'kiezen' ? 'om uit te kiezen zijn ' + min + ' tot ' + max + ' feeds nodig.' : 'een vast vak heeft 1 tot ' + max + ' feeds.')
    const gezien = new Set()
    feeds.forEach((x, n) => {
      const url = x && netteFeedUrl(x.url)
      if (!url || url !== x.url) f.push('feed ' + (n + 1) + ' heeft geen goede https-link.')
      else if (gezien.has(url)) f.push('feed ' + (n + 1) + ' staat er twee keer in.')
      gezien.add(url)
      if (!x || typeof x.naam !== 'string' || !x.naam.trim() || x.naam.length > MAX_FEEDNAAM) f.push('feed ' + (n + 1) + ' heeft geen naam (hoogstens ' + MAX_FEEDNAAM + ' tekens).')
    })
  }
  if (soort === 'peertube') {
    if (!PEERTUBE_SERVERS.includes(i.server)) f.push('de PeerTube-server staat niet in de lijst.')
    const cats = Array.isArray(i.cats) ? i.cats : []
    if (!cats.length || cats.length > MAX_CATS || cats.some(n => !CAT_NRS.has(n)) || new Set(cats).size !== cats.length) f.push('kies 1 tot ' + MAX_CATS + ' categorieën.')
    if (typeof i.reageren !== 'boolean') f.push('kies of liken en reageren aan staat.')
  }
  return f
}
export const kantEnKlaar = vak => !!(vak && vak.inhoud && MANIEREN[vak.soort])

export const weergaveVan = vak => (vak && vak.weergave) || (WEERGAVEN[vak && vak.soort] || [])[0] || ''
export function maakLayout({ titel, uitleg, sjabloon, soorten, inhoud, weergaven }) {
  const s = SJABLONEN.find(x => x.id === sjabloon) || SJABLONEN[0]
  return {
    formaat: FORMAAT, versie: 1, titel: tekst(titel, MAX_TITEL),
    uitleg: [tekst(uitleg && uitleg[0], MAX_UITLEG), tekst(uitleg && uitleg[1], MAX_UITLEG)],
    h: s.h, vakken: s.vakken.map((v, i) => {
      const vak = { soort: (soorten || [])[i] || s.voorstel[i], ...v }
      const inh = (inhoud || [])[i]
      if (inh && MANIEREN[vak.soort]) vak.inhoud = inh
      const wg = (weergaven || [])[i]
      if (wg && (WEERGAVEN[vak.soort] || [])[0] !== wg && (WEERGAVEN[vak.soort] || []).includes(wg)) vak.weergave = wg // de standaard schrijven we niet op
      return vak
    }),
  }
}

// ── De eigen inhoud van kant-en-klare vakken (localStorage 'mix_<uid>', gaat via sync naar vrienden) ──
export const MIX_MAX = 120000 // v3: ruimte voor de miniaturen van een carrousel (hoogstens 40 kB per vak)
export const mixSleutel = uid => 'mix_' + uid
export const vakSleutel = (layout, soort) => layout.id + ':' + soort
export function leesMix(uid, ls = globalThis.localStorage) {
  try { const m = JSON.parse(ls.getItem(mixSleutel(uid)) || '{}'); return m && typeof m === 'object' && !Array.isArray(m) ? m : {} } catch (e) { return {} }
}
// Eén vak bewaren. Wordt het te groot voor sync, dan eerst de berichten van andere layouts weg (die komen vanzelf terug).
export function zetMixVak(uid, sleutel, cfg, ls = globalThis.localStorage) {
  const m = leesMix(uid, ls)
  if (cfg == null) delete m[sleutel]; else m[sleutel] = cfg
  let tekstM = JSON.stringify(m)
  for (const k of Object.keys(m)) {
    if (tekstM.length < MIX_MAX) break
    if (k !== sleutel && m[k] && Array.isArray(m[k].berichten)) { m[k] = { ...m[k], berichten: [], bijgewerkt: 0 }; tekstM = JSON.stringify(m) }
    if (k !== sleutel && m[k] && m[k].sprite) { const { sprite, spriteN, ...rest } = m[k]; m[k] = { ...rest, bijgewerkt: 0 }; tekstM = JSON.stringify(m) }
  }
  try { ls.setItem(mixSleutel(uid), tekstM) } catch (e) {}
  return m
}
// De inhoud waarmee een kant-en-klaar vak begint, of wat er bewaard is (als dat nog bij de layout past)
export function vakCfg(layout, vak, bewaard) {
  const i = vak.inhoud
  if (vak.soort === 'rss') {
    const mag = i.feeds.map(f => f.url)
    const goed = bewaard && Array.isArray(bewaard.feeds) && bewaard.feeds.length && bewaard.feeds.every(f => f && mag.includes(f.url)) &&
      (i.manier === 'kiezen' || JSON.stringify(bewaard.feeds.map(f => f.url)) === JSON.stringify(mag))
    const koppen = weergaveVan(vak) === 'koppen'
    if (goed && (bewaard.plaatjes === false) === koppen) return { ...bewaard, feeds: bewaard.feeds.map(f => i.feeds.find(x => x.url === f.url)) }
    const nieuw = { feeds: (goed ? bewaard.feeds.map(f => i.feeds.find(x => x.url === f.url)) : (i.manier === 'kiezen' ? i.feeds.slice(0, MAX_FEEDS) : i.feeds)).map(f => ({ url: f.url, naam: f.naam })), berichten: [], bijgewerkt: 0 }
    if (koppen) nieuw.plaatjes = false
    return nieuw
  }
  if (vak.soort === 'peertube') {
    const goed = bewaard && bewaard.server === i.server && JSON.stringify(bewaard.cats) === JSON.stringify(i.cats)
    return goed ? bewaard : { server: i.server, soort: 'categorie', cats: i.cats.slice(), videos: [], titel: '', bijgewerkt: 0 }
  }
  return null
}

// "Kiezen uit de lijst" bij een RSS-vak: vinkjes bij de feeds van de maker, hoogstens 3. klaar(feeds) of annuleer().
export function tekenFeedKeuze(el, inhoud, gekozen, klaar, annuleer) {
  el.textContent = ''
  const w = document.createElement('div')
  w.className = 'mix-keuze'
  w.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:4px;font-size:13px'
  const kop = document.createElement('div')
  kop.style.cssText = 'font-weight:700'
  const T = (globalThis.window && window.T) || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
  kop.textContent = T('Kies hoogstens {n} feeds', { n: MAX_FEEDS })
  const melding = document.createElement('div')
  melding.style.cssText = 'font-size:12px;color:#fca5a5;min-height:0'
  const aan = new Set(gekozen)
  w.appendChild(kop)
  for (const f of inhoud.feeds) {
    const l = document.createElement('label')
    l.style.cssText = 'display:flex;gap:8px;align-items:center;cursor:pointer;padding:4px 6px;border-radius:8px;background:rgba(255,255,255,0.06)'
    const v = document.createElement('input')
    v.type = 'checkbox'; v.value = f.url; v.checked = aan.has(f.url); v.style.accentColor = '#8b3fd1'
    v.onchange = () => {
      if (v.checked && aan.size >= MAX_FEEDS) { v.checked = false; melding.textContent = T('Hoogstens {n} feeds.', { n: MAX_FEEDS }); return }
      if (v.checked) aan.add(f.url); else aan.delete(f.url)
      melding.textContent = ''
    }
    l.onclick = e => e.stopPropagation()
    l.append(v, document.createTextNode(f.naam))
    w.appendChild(l)
  }
  const rij = document.createElement('div')
  rij.style.cssText = 'display:flex;gap:6px;justify-content:center;margin-top:4px'
  const ok = document.createElement('button')
  ok.type = 'button'; ok.className = 'mix-klaar'; ok.textContent = T('Klaar ✓')
  ok.style.cssText = 'border:none;border-radius:10px;padding:7px 14px;font:inherit;font-weight:600;cursor:pointer;background:#8b3fd1;color:#fff'
  ok.onclick = e => {
    e.stopPropagation()
    const feeds = inhoud.feeds.filter(f => aan.has(f.url))
    if (!feeds.length) { melding.textContent = T('Vink eerst een feed aan.'); return }
    klaar(feeds.map(f => ({ url: f.url, naam: f.naam })))
  }
  const weg = document.createElement('button')
  weg.type = 'button'; weg.textContent = T('Annuleren')
  weg.style.cssText = 'border:none;border-radius:10px;padding:7px 14px;font:inherit;cursor:pointer;background:rgba(255,255,255,0.12);color:#fff'
  weg.onclick = e => { e.stopPropagation(); annuleer() }
  rij.append(ok, weg)
  w.append(melding, rij)
  el.appendChild(w)
  return w
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

// De vakken tekenen (v3: vaste hoogte, ongeveer 95 px per rij; een lange lijst scrolt binnen zijn vak): een rooster met per vak een kopje (icoon en naam) en een inhoud die tekenVak vult.
export function tekenMix(el, layout, tekenVak, { taal = 'nl' } = {}) {
  el.textContent = ''
  const rooster = document.createElement('div')
  rooster.className = 'mix-rooster'
  rooster.style.cssText = 'display:grid;grid-template-columns:repeat(' + BREED + ',minmax(0,1fr));grid-template-rows:repeat(' + layout.h + ',minmax(0,1fr));gap:8px;width:100%;height:' + (layout.h * 95) + 'px;flex:none'
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
