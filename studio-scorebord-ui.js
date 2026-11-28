// studio-scorebord-ui.js (26 nov 2026, Marcel) - Stekky Studio: de scoreborden van de spellen (scoreborden.js).
// Per spel: scorebord aan of uit, een stijl (neon, goud, paars, roze, groen) en eventueel een eigen titel.
// "👁 Voorbeeld" laat het echte scorebord zien met voorbeeldscores. De Studio maakt er een bestand van
// (scoreborden.stekky.json); dat zet Claude of Tijn in de app met tests/tools/studio-scorebord-installeer.mjs.
import { alleScoreSpellen, scorebordInstelling, valideerScoreborden } from './scorespellen.js?v=8'
import { STIJLEN } from './scoreborden.js?v=1'
import { maakNeonScorebord } from './neon-raiders-scoreboard.js?v=7'

const $ = id => document.getElementById(id)
const STIJL_NAAM = { neon: 'Neon (standaard)', goud: 'Goud', paars: 'Paars', roze: 'Roze', groen: 'Groen' }
const lijst = $('sbLijst')
const stand = {}
for (const s of alleScoreSpellen()) stand[s.id] = { ...scorebordInstelling(s.id) }

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

// Voorbeeldscores (niet echt): zo zie je meteen hoe de stijl eruitziet
const NU = new Date().toISOString()
function voorbeeldDienst(soort) {
  return { loadBoards: async () => soort === 'punten'
    ? { status: 'online', global: { score: 1280, niveau: '' },
        personal: [{ id: 'a', score: 940, playedAt: NU, isSelf: true }, { id: 'b', score: 610, playedAt: NU, isSelf: true }],
        friends: [{ id: 'c', score: 1280, playedAt: NU, name: 'Radox007' }, { id: 'a', score: 940, playedAt: NU, name: 'Jij', isSelf: true }] }
    : { status: 'online', global: null,
        personal: [{ id: 'm', score: 4, gespeeld: 6, regel: 'Makkelijk', isSelf: true }, { id: 'n', score: 2, gespeeld: 5, regel: 'Normaal', isSelf: true }],
        friends: [{ id: 'c', score: 9, gespeeld: 12, playedAt: NU, name: 'Radox007' }, { id: 'a', score: 6, gespeeld: 11, playedAt: NU, name: 'Jij', isSelf: true }] } }
}
let open = null
function toonVoorbeeld(spel) {
  try { open?.destroy() } catch (e) {}
  const k = stand[spel.id], winst = spel.soort === 'winst'
  open = maakNeonScorebord({ host: document.body, service: voorbeeldDienst(spel.soort), stijl: k.stijl,
    title: spel.naam + ' scores', brand: (k.titel || spel.naam).toUpperCase(),
    formatScore: winst ? n => n + '× gewonnen' : undefined,
    formatDetail: winst ? r => 'van ' + (r.gespeeld || 0) + ' potjes' : () => '',
    kolommen: winst ? { personal: ['Jouw overwinningen', 'Per niveau, tegen de computer'], friends: ['Vrienden top 10', 'Wie won het vaakst?'] } : null,
    zonderRecord: winst, statusOnline: winst ? 'Hoe vaak jij en je vrienden wonnen, de meeste bovenaan.' : null })
  open.open()
}

function teken() {
  lijst.replaceChildren()
  for (const s of alleScoreSpellen()) {
    const k = stand[s.id]
    const aan = el('input', { type: 'checkbox', 'aria-label': 'Scorebord aan voor ' + s.naam, 'data-spel': s.id })
    aan.checked = k.aan
    aan.onchange = () => { k.aan = aan.checked; teken() }
    const stijl = el('select', { 'aria-label': 'Stijl voor ' + s.naam, 'data-stijl-van': s.id }, STIJLEN.map(x => el('option', { value: x, tekst: STIJL_NAAM[x] })))
    stijl.value = k.stijl; stijl.disabled = !k.aan
    stijl.onchange = () => { k.stijl = stijl.value }
    const titel = el('input', { type: 'text', maxlength: '40', placeholder: s.naam, 'aria-label': 'Titel voor ' + s.naam, 'data-titel-van': s.id, stijl: 'width:150px' })
    titel.value = k.titel; titel.disabled = !k.aan
    titel.oninput = () => { k.titel = titel.value.replace(/[<>]/g, '').slice(0, 40) }
    const kijk = el('button', { type: 'button', klas: 'knop stil', tekst: '👁 Voorbeeld', 'data-voorbeeld': s.id, onclick: () => toonVoorbeeld(s) })
    kijk.disabled = !k.aan
    lijst.append(el('div', { klas: 'rij sb-rij', 'data-rij': s.id, stijl: 'align-items:center;gap:10px;padding:8px 0;border-top:1px solid #ffffff14' }, [
      el('label', { stijl: 'display:flex;align-items:center;gap:8px;flex:1 1 200px' }, [aan,
        el('span', { tekst: s.icoon + ' ' + s.naam }),
        el('span', { klas: 'uitleg', stijl: 'margin:0;font-size:12px', tekst: s.soort === 'punten' ? '· punten' : '· keer gewonnen' })]),
      stijl, titel, kijk]))
  }
}

$('sbMaak').onclick = () => {
  const m = $('sbMelding')
  const bestand = { versie: 1, scoreborden: Object.fromEntries(Object.entries(stand).map(([id, k]) => [id, { aan: k.aan, stijl: k.stijl, titel: k.titel.trim() }])) }
  const fouten = valideerScoreborden(bestand)
  if (fouten.length) { m.textContent = '⚠️ ' + fouten.join(' · '); return }
  const blob = new Blob([JSON.stringify(bestand, null, 2)], { type: 'application/json' })
  const a = el('a', { href: URL.createObjectURL(blob), download: 'scoreborden.stekky.json' })
  document.body.append(a); a.click(); a.remove()
  const uit = Object.values(stand).filter(k => !k.aan).length
  m.textContent = '✅ scoreborden.stekky.json is gemaakt' + (uit ? ' (' + uit + ' spel' + (uit === 1 ? '' : 'len') + ' zonder scorebord)' : '') + '. Geef het aan Claude of Tijn: dan staat het in de app na "Merge".'
}

teken()
