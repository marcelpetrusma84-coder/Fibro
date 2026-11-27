// studio-kaarten-ui.js (25 nov 2026) - Stekky Studio: eigen speelkaarten maken uit een paar platen (kaartmaker.js).
// Je kiest alleen de plaatjes (18) of alle 54 kaarten, een naam en de kleuren. Per plaat krijg je een prompt voor Gemini;
// je laadt de platen in (meerdere tegelijk), de Studio knipt ze in kaarten en zet elk plaatje op de goede kaart. Klopt een
// kaart niet, dan kies je bij die kaart een ander plaatje. Dan maakt de Studio een kaartpakket (naam.stekkykaarten.json).
import { SOORTEN, PLATEN, KLEUREN, KLEUR_NAAM, STANDAARD_KLEUR, BREED, HOOG, MAX_NAAM, nodig, kaartNaam, maakKaartPrompt, maakKaartset, valideerKaartset } from './kaartmaker.js?v=2'
import { knipRooster } from './studio-knippen.js?v=1'
import { STUDIO_KAARTSETS } from './studio-kaarten.js?v=2'

const $ = id => document.getElementById(id)
function el(tag, opties = {}, kinderen = []) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(opties)) {
    if (k === 'tekst') e.textContent = v
    else if (k === 'klas') e.className = v
    else if (k === 'stijl') e.style.cssText = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v)
  }
  for (const kind of [].concat(kinderen)) if (kind) e.append(kind)
  return e
}
const MAX_KANT = 2400

const stand = { soort: 'plaatjes', kleur: { ...STANDAARD_KLEUR }, stijl: '', naam: '', naamEn: '' }
let stukken = []          // alle losgeknipte plaatjes: { plaat, vak, data }
let toewijzing = {}       // kaart -> index in stukken
let platen = {}           // nr -> { kolommen, rijen, beeld }
const blok = $('kaartBlok')

function lees() {
  const v = id => $(id) ? $(id).value : undefined
  stand.naam = v('ktNaam') ?? stand.naam; stand.naamEn = v('ktNaamEn') ?? stand.naamEn; stand.stijl = v('ktStijl') ?? stand.stijl
  for (const k of KLEUREN) if ($('ktKleur-' + k)) stand.kleur[k] = $('ktKleur-' + k).value
}

function bouw() {
  blok.querySelector('.kt-inhoud')?.remove()
  const w = el('div', { klas: 'kt-inhoud' })
  w.append(el('div', { klas: 'vakken', id: 'ktSoorten', stijl: 'grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin-top:8px' },
    Object.entries(SOORTEN).map(([id, s]) => el('button', { type: 'button', klas: 'kt-soort', 'data-soort': id,
      stijl: 'text-align:left;padding:10px;border-radius:12px;border:' + (stand.soort === id ? '2px solid var(--accent)' : '0.5px solid var(--border)') + ';background:var(--card);color:var(--text);cursor:pointer;font:inherit',
      onclick: () => { lees(); if (stand.soort !== id) { stand.soort = id; stukken = []; toewijzing = {}; platen = {} } bouw() } },
    [el('div', { tekst: s.naam, stijl: 'font-weight:700' }), el('div', { tekst: s.uitleg, stijl: 'font-size:12px;color:var(--muted);margin-top:4px' })]))))
  w.append(el('div', { klas: 'rij', stijl: 'margin-top:12px' }, [
    el('label', { klas: 'veld' }, ['Naam van de kaarten', el('input', { type: 'text', id: 'ktNaam', maxlength: MAX_NAAM, value: stand.naam, placeholder: 'bijvoorbeeld Ruimtekaarten' })]),
    el('label', { klas: 'veld' }, ['Naam in het Engels', el('input', { type: 'text', id: 'ktNaamEn', maxlength: MAX_NAAM, value: stand.naamEn, placeholder: 'bijvoorbeeld Space cards' })]),
  ]))
  w.append(el('div', { klas: 'rij', stijl: 'margin-top:8px;align-items:flex-end' }, KLEUREN.map(k => el('label', { klas: 'veld smal', stijl: 'flex:0 0 90px' },
    [KLEUR_NAAM[k], el('input', { type: 'color', id: 'ktKleur-' + k, value: stand.kleur[k], stijl: 'width:100%;height:34px' })]))
    .concat([el('div', { stijl: 'font-size:12px;color:var(--muted);flex:1 1 200px', tekst: stand.soort === 'plaatjes' ? 'De kleur van de tekens op 2 tot en met 10 en in de hoekjes.' : 'De kleur van de hoekjes (waarde en teken).' })])))
  w.append(el('label', { klas: 'veld', stijl: 'display:block;margin-top:8px' }, ['Stijl voor Gemini (in het Engels, voor alle platen hetzelfde)',
    el('input', { type: 'text', id: 'ktStijl', value: stand.stijl, placeholder: 'bijvoorbeeld retro space adventure, astronauts and planets, bold outlines', stijl: 'width:100%', oninput: () => { lees(); for (const [i] of PLATEN[stand.soort].entries()) { const t = $('ktPrompt-' + i); if (t) t.value = maakKaartPrompt({ soort: stand.soort, nr: i, stijl: stand.stijl }) } } })]))

  // De platen: prompt, plaatje inladen, raster
  PLATEN[stand.soort].forEach((p, i) => {
    const info = platen[i]
    w.append(el('div', { klas: 'kt-plaat', 'data-plaat': i, stijl: 'margin-top:12px;padding:10px;border:0.5px solid var(--border);border-radius:12px' }, [
      el('div', { stijl: 'font-weight:700;font-size:14px', tekst: 'Plaat ' + (i + 1) + ' (' + p.kolommen + ' × ' + p.rijen + '): ' + p.vakken.filter(Boolean).map(kaartNaam).join(', ') }),
      el('details', { stijl: 'margin-top:6px' }, [el('summary', { tekst: '🪄 Prompt voor Gemini', stijl: 'font-size:13px;cursor:pointer' }),
        el('textarea', { id: 'ktPrompt-' + i, readonly: true, rows: 8, stijl: 'width:100%;margin-top:6px;font-size:12px;line-height:1.4' }, [maakKaartPrompt({ soort: stand.soort, nr: i, stijl: stand.stijl })]),
        el('button', { type: 'button', klas: 'speel', tekst: '📋 Kopiëren', onclick: e => { navigator.clipboard?.writeText($('ktPrompt-' + i).value); e.target.textContent = '✓ Gekopieerd' } })]),
      el('div', { klas: 'rij', stijl: 'margin-top:8px;align-items:flex-end' }, [
        el('label', { klas: 'veld', stijl: 'flex:2 1 220px' }, ['De plaat', el('input', { type: 'file', accept: 'image/*', klas: 'kt-bestand', 'data-plaat': i, onchange: e => laadPlaat(i, e.target.files[0]) })]),
        el('label', { klas: 'veld smal' }, ['Kolommen', el('input', { type: 'number', min: 1, max: 8, value: info ? info.kolommen : p.kolommen, id: 'ktKol-' + i, onchange: () => knip(i) })]),
        el('label', { klas: 'veld smal' }, ['Rijen', el('input', { type: 'number', min: 1, max: 8, value: info ? info.rijen : p.rijen, id: 'ktRij-' + i, onchange: () => knip(i) })]),
        el('span', { klas: 'kt-plaatstatus', stijl: 'font-size:12px;color:var(--muted)', tekst: info ? info.status : 'Nog niet ingeladen' }),
      ]),
    ]))
  })
  w.append(el('div', { klas: 'rij', stijl: 'margin-top:8px' }, [el('label', { klas: 'veld', stijl: 'flex:1 1 100%' }, ['Of laad alle platen tegelijk (in volgorde: plaat 1, plaat 2, ...)',
    el('input', { type: 'file', accept: 'image/*', multiple: true, id: 'ktAlle', onchange: e => [...e.target.files].slice(0, PLATEN[stand.soort].length).forEach((f, i) => laadPlaat(i, f)) })])]))

  // Het overzicht: elke kaart met zijn plaatje
  w.append(el('div', { stijl: 'margin-top:14px;font-size:13px;font-weight:600', tekst: 'Je kaarten (klopt een kaart niet, kies dan een ander plaatje)' }),
    el('div', { id: 'ktOverzicht', stijl: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:6px' }))
  w.append(el('div', { klas: 'rij', stijl: 'margin-top:14px' }, [el('button', { type: 'button', klas: 'knop', id: 'ktMaak', tekst: '🃏 Kaartpakket maken', onclick: maak })]),
    el('div', { klas: 'melding', id: 'ktMelding', 'aria-live': 'polite' }))
  blok.append(w)
  overzicht()
}

function overzicht() {
  const o = $('ktOverzicht'); if (!o) return
  o.innerHTML = ''
  for (const n of nodig(stand.soort)) {
    const st = stukken[toewijzing[n]]
    const kies = el('select', { klas: 'kt-kies', 'data-kaart': n, stijl: 'width:100%;font-size:11px', onchange: e => {
      if (e.target.value === '') delete toewijzing[n]; else toewijzing[n] = Number(e.target.value); overzicht() } },
      [el('option', { value: '', tekst: '(geen)' }), ...stukken.map((s, i) => el('option', { value: i, selected: toewijzing[n] === i, tekst: 'plaat ' + (s.plaat + 1) + ', vak ' + (s.vak + 1) }))])
    o.append(el('div', { klas: 'kt-kaart' + (st ? '' : ' leeg'), 'data-kaart': n, stijl: 'display:flex;flex-direction:column;gap:4px;font-size:11px;text-align:center' }, [
      st ? el('img', { src: st.data, alt: kaartNaam(n), stijl: 'width:100%;aspect-ratio:5/7;object-fit:cover;border-radius:8px;background:#fff' })
        : el('div', { stijl: 'width:100%;aspect-ratio:5/7;border-radius:8px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted)', tekst: 'ontbreekt' }),
      el('div', { tekst: kaartNaam(n) }), kies]))
  }
}

// Een plaat inladen en knippen
function laadPlaat(i, f) {
  if (!f) return
  const r = new FileReader()
  r.onload = () => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, MAX_KANT / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      platen[i] = { beeld: c, kolommen: PLATEN[stand.soort][i].kolommen, rijen: PLATEN[stand.soort][i].rijen, status: '' }
      knip(i)
    }
    img.src = r.result
  }
  r.readAsDataURL(f)
}
function knip(i) {
  const p = platen[i]; if (!p) return
  lees()
  p.kolommen = Math.max(1, Math.min(8, Number($('ktKol-' + i)?.value) || p.kolommen))
  p.rijen = Math.max(1, Math.min(8, Number($('ktRij-' + i)?.value) || p.rijen))
  const c = p.beeld, g = c.getContext('2d'), data = g.getImageData(0, 0, c.width, c.height).data
  const { stickers } = knipRooster(data, c.width, c.height, p.kolommen, p.rijen)
  const plan = PLATEN[stand.soort][i].vakken
  // de oude stukken van deze plaat weg
  const oud = new Set(stukken.map((s, j) => s.plaat === i ? j : -1).filter(j => j >= 0))
  const nieuweIndex = []; let n = 0
  stukken = stukken.filter((s, j) => { nieuweIndex[j] = oud.has(j) ? -1 : n; if (!oud.has(j)) n++; return !oud.has(j) })
  for (const [k, j] of Object.entries(toewijzing)) { if (nieuweIndex[j] < 0) delete toewijzing[k]; else toewijzing[k] = nieuweIndex[j] }
  for (const st of stickers) {
    const vak = st.vakje[1] * p.kolommen + st.vakje[0]
    stukken.push({ plaat: i, vak, data: uitsnede(c, st) })
    const kaart = plan[vak]
    if (kaart) toewijzing[kaart] = stukken.length - 1
  }
  p.status = stickers.length + ' kaarten gevonden'
  const st = blok.querySelector('.kt-plaat[data-plaat="' + i + '"] .kt-plaatstatus'); if (st) st.textContent = p.status
  overzicht()
}
// Een kaart uit de plaat: het gevonden vlak, bijgesneden tot 5 : 7, als webp van 375 x 525
function uitsnede(bron, st) {
  let x = st.x, y = st.y, w = st.w, h = st.h
  const doel = BREED / HOOG
  if (w / h > doel) { const nw = h * doel; x += (w - nw) / 2; w = nw } else { const nh = w / doel; y += (h - nh) / 2; h = nh }
  const c = document.createElement('canvas'); c.width = BREED; c.height = HOOG
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, BREED, HOOG)
  g.drawImage(bron, x, y, w, h, 0, 0, BREED, HOOG)
  return c.toDataURL('image/webp', 0.82)
}

function maak() {
  lees()
  const kaarten = Object.fromEntries(Object.entries(toewijzing).map(([n, j]) => [n, stukken[j] && stukken[j].data]).filter(([, d]) => d))
  const set = maakKaartset({ ...stand, kaarten })
  const m = $('ktMelding')
  const f = valideerKaartset(set, { bestaand: STUDIO_KAARTSETS.map(s => s.id) })
  const dubbel = Object.values(toewijzing).filter((j, i, a) => a.indexOf(j) !== i)
  if (dubbel.length) f.push('Eén plaatje staat bij twee kaarten (plaat ' + (stukken[dubbel[0]].plaat + 1) + ', vak ' + (stukken[dubbel[0]].vak + 1) + ').')
  if (f.length) { m.className = 'melding fout'; m.textContent = 'Nog niet goed:'; m.append(el('ul', {}, f.map(t => el('li', { tekst: t })))); return null }
  const blob = new Blob([JSON.stringify(set)], { type: 'application/json' })
  const a = el('a', { href: URL.createObjectURL(blob), download: set.id + '.stekkykaarten.json' })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  m.className = 'melding goed'
  m.textContent = 'Het kaartpakket ' + set.id + '.stekkykaarten.json is gemaakt. Geef het aan Claude: dan staan je kaarten bij "Kies je kaarten" in elk kaartspel.'
  return set
}

if (blok) bouw()
