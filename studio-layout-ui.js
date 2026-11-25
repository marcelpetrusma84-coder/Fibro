// studio-layout-ui.js (25 nov 2026) - Stekky Studio: een widget-layout maken (layouts.js).
// Je kiest een sjabloon (hoe de vakken liggen), wat er in elk vak komt (video, muziek, radio of berichten), een naam en
// een uitleg. De Studio laat zien hoe het eruitziet en maakt er een layoutbestand van (naam.stekkylayout.json).
// Dat bestand zet Claude of Tijn in de app met tests/tools/studio-layout-installeer.mjs; daarna staat hij in de Store.
import { SJABLONEN, VAK_SOORTEN, MAX_TITEL, MAX_UITLEG, maakLayout, valideerLayout } from './layouts.js?v=1'

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
export const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'layout'

const stand = { sjabloon: SJABLONEN[0].id, soorten: [...SJABLONEN[0].voorstel] }

function voorbeeld(layout) {
  return el('div', { klas: 'lo-voorbeeld', stijl: 'display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(' + layout.h + ',34px);gap:6px;max-width:420px;margin-top:10px' },
    layout.vakken.map((v, i) => el('div', { klas: 'lo-vak', 'data-soort': v.soort,
      stijl: 'grid-column:' + (v.x + 1) + ' / span ' + v.w + ';grid-row:' + (v.y + 1) + ' / span ' + v.h + ';background:rgba(192,132,252,0.16);border:1px solid rgba(192,132,252,0.55);border-radius:10px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;padding:4px',
      tekst: (i + 1) + '. ' + (VAK_SOORTEN[v.soort] ? VAK_SOORTEN[v.soort].icoon + ' ' + VAK_SOORTEN[v.soort].naam[0] : '?') })))
}

function huidig() {
  return maakLayout({ titel: $('loTitel').value, uitleg: [$('loUitlegNl').value, $('loUitlegEn').value], sjabloon: stand.sjabloon, soorten: stand.soorten })
}

function teken() {
  const sjabloonRij = $('loSjablonen'); sjabloonRij.textContent = ''
  for (const s of SJABLONEN) {
    const mini = maakLayout({ titel: 'x', uitleg: ['x', 'x'], sjabloon: s.id, soorten: s.voorstel })
    const b = el('button', { type: 'button', klas: 'vak lo-sjabloon' + (s.id === stand.sjabloon ? ' gekozen' : ''), 'data-sjabloon': s.id, 'aria-pressed': s.id === stand.sjabloon ? 'true' : 'false',
      stijl: 'background:rgba(0,0,0,0.25);padding:8px;text-align:left;color:inherit;font:inherit;font-size:12px',
      onclick: () => { stand.sjabloon = s.id; stand.soorten = [...s.voorstel]; teken() } },
    [el('div', { tekst: s.naam, stijl: 'font-weight:600;margin-bottom:6px' }),
      el('div', { stijl: 'display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(' + mini.h + ',8px);gap:2px' },
        mini.vakken.map(v => el('div', { stijl: 'grid-column:' + (v.x + 1) + ' / span ' + v.w + ';grid-row:' + (v.y + 1) + ' / span ' + v.h + ';background:#c084fc;border-radius:2px;opacity:0.7' })))])
    sjabloonRij.appendChild(b)
  }
  const vakken = $('loVakken'); vakken.textContent = ''
  const s = SJABLONEN.find(x => x.id === stand.sjabloon)
  s.vakken.forEach((v, i) => {
    const kies = el('select', { klas: 'lo-soort', 'data-vak': String(i) }, Object.entries(VAK_SOORTEN).map(([k, w]) => el('option', { value: k, tekst: w.icoon + ' ' + w.naam[0] })))
    kies.value = stand.soorten[i]
    kies.addEventListener('change', () => { stand.soorten[i] = kies.value; tekenVoorbeeld() })
    vakken.appendChild(el('label', { klas: 'veld', stijl: 'flex:1 1 200px' }, ['Vak ' + (i + 1) + (v.w === 4 ? ' (breed)' : ' (half)'), kies]))
  })
  tekenVoorbeeld()
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
