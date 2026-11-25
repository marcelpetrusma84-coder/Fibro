// studio-spel-ui.js (25 nov 2026) - Stekky Studio: een nieuw spel beschrijven (spelmaker.js).
// Je kiest beurtspel of kaartspel, vult de naam, het icoon, de spelregels en (bij een kaartspel) de kaarten in, en vinkt
// aan wat erin moet zitten: chatbalk met stickers, webcam, spraak, titelscherm en handige extra's. De Studio maakt er een
// spelbestand van (naam.stekkyspel.json). Dat zet Claude of Tijn in de app met tests/tools/studio-spel-installeer.mjs:
// dan staat het spel meteen overal (Store, chat, Home), en bouwt Claude de echte regels uit de bouwopdracht.
import { SOORTEN, ONDERDELEN, SPRAAK, EXTRAS, TITELS, DECKS, KAARTEN, MAX_NAAM, MAX_UITLEG, MAX_REGELS, MAX_SPECIAAL, maakSpel, valideerSpel, maakId } from './spelmaker.js?v=1'
import { STUDIO_SPELLEN } from './studio-spellen.js?v=5'

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
const veld = (label, invoer, breed) => el('label', { klas: 'veld', stijl: breed ? 'flex:2 1 300px' : 'flex:1 1 200px' }, [label, invoer])
const vinkje = (id, naam, aan, vast) => el('label', { stijl: 'display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:4px 0' + (vast ? ';opacity:.75' : '') },
  [el('input', { type: 'checkbox', 'data-id': id, checked: aan, disabled: vast, stijl: 'margin-top:2px' }), el('span', { tekst: naam + (vast ? ' (zit er altijd in)' : '') })])

const stand = { soort: 'beurt', speciaal: [], plaatje: '' }
const blok = $('spelBlok')

function bouw() {
  blok.querySelector('.sp-inhoud')?.remove()
  const w = el('div', { klas: 'sp-inhoud' })

  // De blauwdruk: wat elk spel vanzelf krijgt
  w.append(el('details', { stijl: 'margin:8px 0 12px' }, [el('summary', { tekst: '📘 De blauwdruk: wat zit er vanzelf in een spel?', stijl: 'font-size:13px;cursor:pointer' }),
    el('ul', { stijl: 'font-size:13px;line-height:1.5;margin:6px 0' }, [
      el('li', { tekst: 'Spelmenu ☰ rechtsboven: pauze, geluid aan/uit, microfoon, camera, terug naar het menu, spel verlaten.' }),
      el('li', { tekst: 'Met een vriend: de chatbalk onderin (stickers 🎨, emoji 😊, berichten), de webcamrondjes bovenin met 📹, een gouden rand als iemand praat en een rode rand als iemand verliest.' }),
      el('li', { tekst: 'Tegen de computer op Home (spel.html), met makkelijk, normaal en moeilijk.' }),
      el('li', { tekst: 'Berichten van andere vrienden linksboven, en een uitnodiging voor je vriend in de chat.' }),
      el('li', { tekst: 'Kaartspellen: de kaarttafel met kaartstijlen (Vrolijk, Perkament, Modern, Stekky), ondergrond, animaties, beurtklok en trillen.' }),
      el('li', { tekst: 'Overal aangemeld: Store, spelmenu, Home, Profiel > Widgets, uitnodigingen, spelicoon en Engelse naam.' }),
    ]),
    el('div', { stijl: 'font-size:12px;color:var(--muted)' }, ['Alles staat in ', el('a', { href: 'BLAUWDRUK-BEURTSPEL.md', target: '_blank', tekst: 'BLAUWDRUK-BEURTSPEL.md', stijl: 'color:var(--accent)' }),
      ' en ', el('a', { href: 'BLAUWDRUK-KAARTSPEL.md', target: '_blank', tekst: 'BLAUWDRUK-KAARTSPEL.md', stijl: 'color:var(--accent)' }), '.'])]))

  // Soort
  w.append(el('div', { klas: 'vakken', id: 'spSoorten', stijl: 'grid-template-columns:repeat(auto-fill,minmax(200px,1fr))' },
    Object.entries(SOORTEN).map(([id, s]) => el('button', { type: 'button', klas: 'sp-soort' + (stand.soort === id ? ' gekozen' : ''), 'data-soort': id,
      stijl: 'text-align:left;padding:10px;border-radius:12px;border:' + (stand.soort === id ? '2px solid var(--accent)' : '0.5px solid var(--border)') + ';background:var(--card);color:var(--text);cursor:pointer;font:inherit',
      onclick: () => { lees(); if (stand.soort !== id) { stand.spraak = undefined; stand.titel = undefined } stand.soort = id; bouw() } }, [el('div', { tekst: (id === 'kaart' ? '🃏 ' : '♟️ ') + s.naam, stijl: 'font-weight:700' }), el('div', { tekst: s.uitleg, stijl: 'font-size:12px;color:var(--muted);margin-top:4px' })]))))

  // Naam, icoon, uitleg
  const icoonVeld = el('input', { type: 'text', id: 'spIcoon', maxlength: 8, value: stand.icoon || '🎲', stijl: 'font-size:20px;width:70px', oninput: maakIcoon })
  const eigenPlaatje = el('input', { type: 'file', id: 'spPlaatje', accept: 'image/*', stijl: 'font-size:12px', onchange: e => laadPlaatje(e.target.files[0]) })
  w.append(el('div', { klas: 'rij', stijl: 'margin-top:12px;align-items:flex-start' }, [
    veld('Naam van het spel', el('input', { type: 'text', id: 'spNaam', maxlength: MAX_NAAM, value: stand.naam || '', placeholder: 'bijvoorbeeld Kleurenjacht' })),
    veld('Naam in het Engels', el('input', { type: 'text', id: 'spNaamEn', maxlength: MAX_NAAM, value: stand.naamEn || '', placeholder: 'bijvoorbeeld Colour Hunt' })),
    el('label', { klas: 'veld smal', stijl: 'flex:0 0 auto' }, ['Icoon', icoonVeld]),
    el('div', { stijl: 'display:flex;flex-direction:column;gap:4px;font-size:13px' }, ['Of een eigen plaatje', eigenPlaatje]),
    el('canvas', { id: 'spIcoonVoorbeeld', width: 128, height: 128, stijl: 'width:64px;height:64px;border-radius:12px;background:#ffffff10' }),
  ]))
  w.append(el('div', { klas: 'rij', stijl: 'margin-top:8px' }, [
    veld('Uitleg in de Store (Nederlands)', el('input', { type: 'text', id: 'spUitleg', maxlength: MAX_UITLEG, value: stand.uitleg || '' }), true),
    veld('Uitleg in de Store (Engels)', el('input', { type: 'text', id: 'spUitlegEn', maxlength: MAX_UITLEG, value: stand.uitlegEn || '' }), true),
  ]))
  w.append(el('div', { klas: 'rij', stijl: 'margin-top:8px' }, [veld('Doel (wanneer win je?)', el('input', { type: 'text', id: 'spDoel', maxlength: 200, value: stand.doel || '', placeholder: 'bijvoorbeeld Wie het eerst geen kaarten meer heeft, wint.' }), true)]))
  w.append(el('label', { klas: 'veld', stijl: 'display:block;margin-top:8px' }, ['Spelregels (zo precies mogelijk, in gewone woorden)',
    el('textarea', { id: 'spRegels', maxlength: MAX_REGELS, rows: 7, stijl: 'width:100%;margin-top:4px;line-height:1.5' }, [stand.regels || ''])]))

  // Bord of kaarten
  if (stand.soort === 'kaart') {
    w.append(el('div', { klas: 'rij', stijl: 'margin-top:8px' }, [
      veld('Welk kaartspel', el('select', { id: 'spDeck' }, Object.entries(DECKS).map(([id, n]) => el('option', { value: id, selected: (stand.deck || '52') === id, tekst: n })))),
      veld('Kaarten per speler', el('input', { type: 'number', id: 'spPerSpeler', min: 1, max: 26, value: stand.perSpeler || 7 })),
    ]))
    const lijst = el('div', { id: 'spSpeciaal' })
    stand.speciaal.forEach((x, i) => lijst.append(el('div', { klas: 'rij sp-speciaal', stijl: 'margin-top:6px' }, [
      el('select', { klas: 'sp-kaart', stijl: 'flex:0 0 110px' }, KAARTEN.map(k => el('option', { value: k, selected: x.kaart === k, tekst: k }))),
      el('input', { type: 'text', klas: 'sp-wat', maxlength: 200, value: x.wat || '', placeholder: 'wat doet deze kaart? bijvoorbeeld: de ander pakt 2 kaarten', stijl: 'flex:1 1 260px' }),
      el('button', { type: 'button', klas: 'speel stil', tekst: '✕', 'aria-label': 'Weghalen', onclick: () => { lees(); stand.speciaal.splice(i, 1); bouw() } }),
    ])))
    w.append(el('div', { stijl: 'margin-top:10px;font-size:13px;font-weight:600', tekst: 'Speciale kaarten' }), lijst,
      el('button', { type: 'button', klas: 'speel', id: 'spSpeciaalErbij', stijl: 'margin-top:6px', tekst: '➕ Speciale kaart', disabled: stand.speciaal.length >= MAX_SPECIAAL,
        onclick: () => { lees(); stand.speciaal.push({ kaart: 'aas', wat: '' }); bouw() } }))
  } else {
    w.append(el('div', { klas: 'rij', stijl: 'margin-top:8px' }, [veld('Het bord', el('input', { type: 'text', id: 'spBord', maxlength: 200, value: stand.bord || '', placeholder: 'bijvoorbeeld 8 bij 8 vakjes, elk 12 stukken' }), true)]))
  }

  // Wat erin zit
  const met = stand.met || Object.fromEntries(ONDERDELEN.map(o => [o.id, o.vast || o.standaard]))
  w.append(el('div', { stijl: 'margin-top:14px;font-size:13px;font-weight:600', tekst: 'Wat zit erin?' }),
    el('div', { id: 'spMet' }, ONDERDELEN.map(o => vinkje(o.id, o.naam, met[o.id], o.vast))))
  w.append(el('div', { klas: 'rij', stijl: 'margin-top:8px' }, [
    veld('Spraak met je vriend', el('select', { id: 'spSpraak' }, Object.entries(SPRAAK).map(([id, n]) => el('option', { value: id, selected: (stand.spraak || (stand.soort === 'kaart' ? 'vanzelf' : 'knop')) === id, tekst: n })))),
    veld('Titelscherm en muziek', el('select', { id: 'spTitel' }, Object.entries(TITELS).map(([id, n]) => el('option', { value: id, selected: (stand.titel ?? (stand.soort === 'kaart' ? 'pesten' : 'vieroprij')) === id, tekst: n })))),
  ]))
  const extras = stand.extras || Object.fromEntries(EXTRAS.map(x => [x.id, x.standaard]))
  w.append(el('div', { stijl: 'margin-top:14px;font-size:13px;font-weight:600', tekst: 'Handige extra\'s (die bouwt Claude in het spel)' }),
    el('div', { id: 'spExtras' }, EXTRAS.map(x => vinkje(x.id, x.naam, extras[x.id]))))

  w.append(el('div', { klas: 'rij', stijl: 'margin-top:14px' }, [el('button', { type: 'button', klas: 'knop', id: 'spMaak', tekst: '🎲 Spelbestand maken', onclick: maak })]),
    el('div', { klas: 'melding', id: 'spMelding', 'aria-live': 'polite' }))
  blok.append(w)
  if (stand.plaatje) tekenPlaatje(stand.plaatje); else maakIcoon()
}

// Wat er nu is ingevuld (zodat het blijft staan als het formulier opnieuw getekend wordt)
function lees() {
  const v = id => $(id) ? $(id).value : undefined
  Object.assign(stand, { naam: v('spNaam'), naamEn: v('spNaamEn'), icoon: v('spIcoon'), uitleg: v('spUitleg'), uitlegEn: v('spUitlegEn'),
    doel: v('spDoel'), regels: v('spRegels'), bord: v('spBord') ?? stand.bord, deck: v('spDeck') ?? stand.deck, perSpeler: v('spPerSpeler') ?? stand.perSpeler,
    spraak: v('spSpraak'), titel: v('spTitel') })
  stand.met = Object.fromEntries([...document.querySelectorAll('#spMet input')].map(i => [i.dataset.id, i.checked]))
  stand.extras = Object.fromEntries([...document.querySelectorAll('#spExtras input')].map(i => [i.dataset.id, i.checked]))
  const rijen = [...document.querySelectorAll('#spSpeciaal .sp-speciaal')]
  if (rijen.length) stand.speciaal = rijen.map(r => ({ kaart: r.querySelector('.sp-kaart').value, wat: r.querySelector('.sp-wat').value }))
}

// Het spelicoon: 128 x 128, uit de emoji of een eigen plaatje (webp; lukt dat niet, dan png)
const naarData = c => { const d = c.toDataURL('image/webp', 0.9); return d.startsWith('data:image/webp') ? d : c.toDataURL('image/png') }
function maakIcoon() {
  if (stand.eigen) return
  const c = $('spIcoonVoorbeeld'); if (!c) return
  const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128)
  g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(($('spIcoon').value || '🎲').trim(), 64, 70)
  stand.plaatje = naarData(c)
}
function tekenPlaatje(data) {
  const c = $('spIcoonVoorbeeld'); if (!c) return
  const img = new Image()
  img.onload = () => { const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128); const s = Math.min(128 / img.width, 128 / img.height)
    g.drawImage(img, (128 - img.width * s) / 2, (128 - img.height * s) / 2, img.width * s, img.height * s); stand.plaatje = naarData(c) }
  img.src = data
}
function laadPlaatje(f) {
  if (!f) { stand.eigen = false; maakIcoon(); return }
  const r = new FileReader()
  r.onload = () => { stand.eigen = true; tekenPlaatje(r.result) }
  r.readAsDataURL(f)
}

function maak() {
  lees()
  const spel = maakSpel({ ...stand, id: maakId(stand.naam) })
  const m = $('spMelding')
  const f = valideerSpel(spel, { bestaand: STUDIO_SPELLEN.map(s => s.id) })
  if (!spel.plaatje) f.push('Het spelicoon ontbreekt.')
  if (f.length) { m.className = 'melding fout'; m.textContent = 'Nog niet goed:'; m.append(el('ul', {}, f.map(t => el('li', { tekst: t })))); return null }
  const blob = new Blob([JSON.stringify(spel, null, 2)], { type: 'application/json' })
  const a = el('a', { href: URL.createObjectURL(blob), download: spel.id + '.stekkyspel.json' })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  m.className = 'melding goed'
  m.textContent = 'Het spelbestand ' + spel.id + '.stekkyspel.json is gemaakt. Geef het aan Claude: dan staat het spel meteen in de app, en bouwt Claude de regels.'
  return spel
}

if (blok) bouw()
