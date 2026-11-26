// studio-layout-ui.js (25 nov 2026) - Stekky Studio: een widget-layout maken (layouts.js).
// Je kiest een sjabloon (hoe de vakken liggen), wat er in elk vak komt (video, muziek, radio of berichten), een naam en
// een uitleg. De Studio laat zien hoe het eruitziet en maakt er een layoutbestand van (naam.stekkylayout.json).
// Dat bestand zet Claude of Tijn in de app met tests/tools/studio-layout-installeer.mjs; daarna staat hij in de Store.
import { SJABLONEN, VAK_SOORTEN, MAX_TITEL, MAX_UITLEG, MAX_KIES_FEEDS, MAX_FEEDNAAM, MANIEREN, WEERGAVEN, WEERGAVE_NAAM, maakLayout, valideerLayout } from './layouts.js?v=6'
import { SERVERS as PEERTUBE_SERVERS, CATEGORIEEN } from './peertube.js?v=6'

const $ = id => document.getElementById(id)
function el(tag, opties = {}, kinderen = []) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(opties)) {
    if (k === 'tekst') e.textContent = v
    else if (k === 'klas') e.className = v
    else if (k === 'stijl') e.style.cssText = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else e.setAttribute(k, v)
  }
  for (const kind of [].concat(kinderen)) if (kind) e.append(kind)
  return e
}
export const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'layout'

// 25 nov 2026: per vak ook de inhoud (kant-en-klaar): manier 'zelf' (de gebruiker vult in), 'vast' of 'kiezen'
const nieuweInhoud = () => ({ manier: 'zelf', feeds: [{ url: '', naam: '' }], server: 'spectra.video', cats: [7], reageren: true, weergave: '' })
const stand = { sjabloon: SJABLONEN[0].id, soorten: [...SJABLONEN[0].voorstel], inhoud: SJABLONEN[0].vakken.map(nieuweInhoud) }
const MANIER_NAAM = { zelf: 'De gebruiker vult het zelf in', vast: 'Kant-en-klaar: vast', kiezen: 'Kant-en-klaar: gebruiker kiest uit mijn lijst' }

function voorbeeld(layout) {
  return el('div', { klas: 'lo-voorbeeld', stijl: 'display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(' + layout.h + ',34px);gap:6px;max-width:420px;margin-top:10px' },
    layout.vakken.map((v, i) => el('div', { klas: 'lo-vak', 'data-soort': v.soort,
      stijl: 'grid-column:' + (v.x + 1) + ' / span ' + v.w + ';grid-row:' + (v.y + 1) + ' / span ' + v.h + ';background:rgba(192,132,252,0.16);border:1px solid rgba(192,132,252,0.55);border-radius:10px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;padding:4px',
      tekst: (i + 1) + '. ' + (VAK_SOORTEN[v.soort] ? VAK_SOORTEN[v.soort].icoon + ' ' + VAK_SOORTEN[v.soort].naam[0] : '?') +
        (v.inhoud ? (v.inhoud.manier === 'kiezen' ? ' · ☑️ kiezen' : ' · 🔒 vast') : '') + (v.weergave ? ' · ' + WEERGAVE_NAAM[v.weergave].split(' (')[0].toLowerCase() : '') })))
}

function huidig() {
  const inhoud = stand.soorten.map((soort, i) => {
    const x = stand.inhoud[i]
    if (!x || x.manier === 'zelf' || !(MANIEREN[soort] || []).includes(x.manier)) return undefined
    if (soort === 'rss') return { manier: x.manier, feeds: x.feeds.filter(f => f.url.trim() || f.naam.trim()).map(f => ({ url: f.url.trim(), naam: f.naam.trim() })) }
    if (soort === 'peertube') return { manier: 'vast', server: x.server, cats: CATEGORIEEN.map(c => c[0]).filter(n => x.cats.includes(n)), reageren: !!x.reageren }
    return undefined
  })
  const weergaven = stand.soorten.map((soort, i) => (inhoud[i] && stand.inhoud[i].weergave) || undefined) // alleen bij kant-en-klare vakken
  return maakLayout({ titel: $('loTitel').value, uitleg: [$('loUitlegNl').value, $('loUitlegEn').value], sjabloon: stand.sjabloon, soorten: stand.soorten, inhoud, weergaven })
}

function teken() {
  const sjabloonRij = $('loSjablonen'); sjabloonRij.textContent = ''
  for (const s of SJABLONEN) {
    const mini = maakLayout({ titel: 'x', uitleg: ['x', 'x'], sjabloon: s.id, soorten: s.voorstel })
    const b = el('button', { type: 'button', klas: 'vak lo-sjabloon' + (s.id === stand.sjabloon ? ' gekozen' : ''), 'data-sjabloon': s.id, 'aria-pressed': s.id === stand.sjabloon ? 'true' : 'false',
      stijl: 'background:rgba(0,0,0,0.25);padding:8px;text-align:left;color:inherit;font:inherit;font-size:12px',
      onclick: () => { stand.sjabloon = s.id; stand.soorten = [...s.voorstel]; stand.inhoud = s.vakken.map(nieuweInhoud); teken() } },
    [el('div', { tekst: s.naam, stijl: 'font-weight:600;margin-bottom:6px' }),
      el('div', { stijl: 'display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(' + mini.h + ',8px);gap:2px' },
        mini.vakken.map(v => el('div', { stijl: 'grid-column:' + (v.x + 1) + ' / span ' + v.w + ';grid-row:' + (v.y + 1) + ' / span ' + v.h + ';background:#c084fc;border-radius:2px;opacity:0.7' })))])
    sjabloonRij.appendChild(b)
  }
  const vakken = $('loVakken'); vakken.textContent = ''
  const s = SJABLONEN.find(x => x.id === stand.sjabloon)
  s.vakken.forEach((v, i) => {
    const blok = el('div', { klas: 'lo-vakblok', 'data-vak': String(i), stijl: 'flex:1 1 280px;display:flex;flex-direction:column;gap:6px;background:rgba(0,0,0,0.2);border:0.5px solid var(--border);border-radius:12px;padding:10px' })
    const kies = el('select', { klas: 'lo-soort', 'data-vak': String(i) }, Object.entries(VAK_SOORTEN).map(([k, w]) => el('option', { value: k, tekst: w.icoon + ' ' + w.naam[0] })))
    kies.value = stand.soorten[i]
    kies.addEventListener('change', () => { stand.soorten[i] = kies.value; stand.inhoud[i] = nieuweInhoud(); teken() })
    blok.appendChild(el('label', { klas: 'veld' }, ['Vak ' + (i + 1) + (v.w === 4 ? ' (breed)' : ' (half)'), kies]))
    tekenInhoud(blok, i)
    vakken.appendChild(blok)
  })
  tekenVoorbeeld()
}

// De inhoud van één vak: de manier, en bij kant-en-klaar de feeds of de PeerTube-server met categorieën
function tekenInhoud(blok, i) {
  const soort = stand.soorten[i], x = stand.inhoud[i]
  const manieren = ['zelf', ...(MANIEREN[soort] || [])]
  if (manieren.length === 1) { blok.appendChild(el('div', { klas: 'nr', tekst: 'De gebruiker vult dit vak zelf in.' })); return }
  const manier = el('select', { klas: 'lo-manier', 'data-vak': String(i) }, manieren.map(m => el('option', { value: m, tekst: MANIER_NAAM[m] })))
  manier.value = x.manier
  manier.addEventListener('change', () => { x.manier = manier.value; teken() })
  blok.appendChild(el('label', { klas: 'veld' }, ['Inhoud', manier]))
  if (x.manier === 'zelf') return
  // v3: de weergave (bij kant-en-klare vakken)
  if (WEERGAVEN[soort]) {
    const wg = el('select', { klas: 'lo-weergave', 'data-vak': String(i) }, WEERGAVEN[soort].map(w => el('option', { value: w, tekst: WEERGAVE_NAAM[w] })))
    wg.value = x.weergave || WEERGAVEN[soort][0]
    wg.addEventListener('change', () => { x.weergave = wg.value; tekenVoorbeeld() })
    blok.appendChild(el('label', { klas: 'veld' }, ['Weergave', wg]))
  }
  if (soort === 'rss') {
    const max = x.manier === 'kiezen' ? MAX_KIES_FEEDS : 3
    blok.appendChild(el('div', { klas: 'nr', tekst: x.manier === 'kiezen' ? 'Zet 2 tot ' + max + ' feeds klaar. De gebruiker vinkt er hoogstens 3 aan.' : 'Hoogstens ' + max + ' feeds. De gebruiker kan ze niet veranderen.' }))
    x.feeds.forEach((f, n) => {
      const naam = el('input', { type: 'text', klas: 'lo-feednaam', placeholder: 'Naam, bijvoorbeeld Sport', maxlength: String(MAX_FEEDNAAM), stijl: 'flex:1 1 110px' })
      naam.value = f.naam
      naam.addEventListener('input', () => { f.naam = naam.value; tekenVoorbeeld() })
      const url = el('input', { type: 'text', klas: 'lo-feedurl', placeholder: 'https://… (de RSS-link)', inputmode: 'url', stijl: 'flex:2 1 180px' })
      url.value = f.url
      url.addEventListener('input', () => { f.url = url.value; tekenVoorbeeld() })
      const weg = el('button', { type: 'button', klas: 'speel stil lo-feedweg', tekst: '✕', 'aria-label': 'Feed weghalen', onclick: () => { x.feeds.splice(n, 1); if (!x.feeds.length) x.feeds.push({ url: '', naam: '' }); teken() } })
      blok.appendChild(el('div', { klas: 'rij', stijl: 'gap:6px' }, [naam, url, weg]))
    })
    if (x.feeds.length < max) blok.appendChild(el('button', { type: 'button', klas: 'speel stil lo-feederbij', tekst: '＋ Feed erbij', onclick: () => { x.feeds.push({ url: '', naam: '' }); teken() } }))
  }
  if (soort === 'peertube') {
    const server = el('select', { klas: 'lo-server' }, PEERTUBE_SERVERS.map(s => el('option', { value: s, tekst: s })))
    server.value = x.server
    server.addEventListener('change', () => { x.server = server.value; tekenVoorbeeld() })
    blok.appendChild(el('label', { klas: 'veld' }, ['PeerTube-server', server]))
    const cats = el('div', { klas: 'lo-cats', stijl: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:3px;max-height:140px;overflow:auto' })
    for (const [nr, icoon, naam] of CATEGORIEEN) {
      const v = el('input', { type: 'checkbox', value: String(nr) })
      v.checked = x.cats.includes(nr)
      v.addEventListener('change', () => { x.cats = v.checked ? [...x.cats, nr] : x.cats.filter(n => n !== nr); tekenVoorbeeld() })
      cats.appendChild(el('label', { stijl: 'display:flex;gap:6px;align-items:center;font-size:12px' }, [v, icoon + ' ' + naam]))
    }
    blok.appendChild(cats)
    const reageren = el('input', { type: 'checkbox', klas: 'lo-reageren' })
    reageren.checked = !!x.reageren
    reageren.addEventListener('change', () => { x.reageren = reageren.checked; tekenVoorbeeld() })
    blok.appendChild(el('label', { stijl: 'display:flex;gap:8px;align-items:center;font-size:13px' }, [reageren, 'Liken en reageren met je fediverse-account (alleen op Home van de gebruiker)']))
  }
}
function tekenVoorbeeld() {
  const l = huidig()
  const plek = $('loVoorbeeld'); plek.textContent = ''
  plek.appendChild(voorbeeld(l))
  const f = valideerLayout(l).filter(x => !/naam van de layout ontbreekt|uitleg moet/.test(x)) // naam en uitleg pas bij het maken
  const m = $('loMelding')
  m.className = 'melding' + (f.length ? ' let-op' : '')
  m.textContent = f.length ? f[0] : ''
}

function maakBestand() {
  const l = huidig()
  const f = valideerLayout(l)
  const m = $('loMelding')
  if (f.length) { m.className = 'melding fout'; m.textContent = 'Nog niet goed:'; m.append(el('ul', {}, f.map(t => el('li', { tekst: t })))); return null }
  const naam = slug(l.titel) + '.stekkylayout.json'
  const blob = new Blob([JSON.stringify(l, null, 2)], { type: 'application/json' })
  const a = el('a', { href: URL.createObjectURL(blob), download: naam })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  m.className = 'melding goed'
  m.textContent = '✓ ' + naam + ' is gemaakt. Stuur dit bestand naar Claude of Tijn: die zetten het in de app (in een pull request), daarna staat de layout in de Store bij Widgets.'
  return l
}

export function startLayoutMaker() {
  if (!$('loSjablonen')) return
  $('loTitel').maxLength = MAX_TITEL; $('loUitlegNl').maxLength = MAX_UITLEG; $('loUitlegEn').maxLength = MAX_UITLEG
  for (const id of ['loTitel', 'loUitlegNl', 'loUitlegEn']) $(id).addEventListener('input', tekenVoorbeeld)
  $('loMaak').addEventListener('click', maakBestand)
  teken()
}
startLayoutMaker()
