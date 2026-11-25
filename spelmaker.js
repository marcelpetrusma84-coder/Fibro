// spelmaker.js (v1, 25 nov 2026) - Stekky Studio: een nieuw spel beschrijven (beurtspel of kaartspel).
//
// In gewone woorden: in de Studio vul je in wat voor spel je wilt (naam, icoon, spelregels, wat erin moet zitten:
// spelmenu, webcam, spraak, chatbalk met stickers, tegen de computer, titelscherm, ...). De Studio maakt daar een
// spelbestand van (naam.stekkyspel.json). Claude of Tijn zet het spel met tests/tools/studio-spel-installeer.mjs in de
// app: dat meldt het spel op alle plekken aan (studio-spellen.js), zet een werkend beginspel neer (uit het sjabloon) en
// schrijft een bouwopdracht (spellen/<id>.md) met alles wat jij hebt ingevuld. Daarna bouwt Claude de echte spelregels.
// De blauwdrukken: BLAUWDRUK-BEURTSPEL.md en BLAUWDRUK-KAARTSPEL.md.
//
// Hier staan de keuzes en de controle (valideerSpel), zodat de Studio en het installatiescript precies hetzelfde doen.

export const FORMAAT = 'stekky-spel'
export const MAX_NAAM = 30, MAX_UITLEG = 300, MAX_REGELS = 4000, MAX_REGEL = 200, MAX_SPECIAAL = 16, MAX_ICOON = 60000

export const SOORTEN = {
  beurt: { naam: 'Beurtspel', uitleg: 'Om de beurt een zet, op een bord (zoals Vier op een rij of Dammen).', blauwdruk: 'BLAUWDRUK-BEURTSPEL.md' },
  kaart: { naam: 'Kaartspel', uitleg: 'Met speelkaarten, op de kaarttafel (zoals Pesten of Toepen).', blauwdruk: 'BLAUWDRUK-KAARTSPEL.md' },
}

// Wat erin zit. vast = zit altijd in elk spel (alleen ter info in de Studio).
export const ONDERDELEN = [
  { id: 'spelmenu', naam: 'Spelmenu ☰ (pauze, geluid, microfoon, camera, menu, verlaten)', vast: true },
  { id: 'vriend', naam: 'Met een vriend spelen in de chat', standaard: true },
  { id: 'computer', naam: 'Tegen de computer (op Home, makkelijk, normaal of moeilijk)', vast: true },
  { id: 'chatbalk', naam: 'Chatbalk in het spel: stickers 🎨, emoji 😊 en berichten', standaard: true, alleenVriend: true },
  { id: 'webcam', naam: 'Webcamrondjes bovenin (met 📹-knop)', standaard: true, alleenVriend: true },
  { id: 'store', naam: 'In de Stekky Store (downloaden, dan op Home en in het spelmenu)', vast: true },
]
export const SPRAAK = {
  knop: 'Spraak pas als iemand op 📹 drukt',
  vanzelf: 'Spraak meteen aan als het spel begint (zoals bij de kaartspellen)',
  uit: 'Geen spraak',
}
// Handige extra's: die bouwt Claude in het spel zelf (ze staan in de bouwopdracht)
export const EXTRAS = [
  { id: 'uitleg', naam: 'Knop ❓ met de spelregels in het spel', standaard: true },
  { id: 'opnieuw', naam: 'Knop ↻ Opnieuw spelen na afloop', standaard: true },
  { id: 'beurtklok', naam: 'Beurtklok (een rondje dat aftelt)' },
  { id: 'trillen', naam: 'Trillen als je aan de beurt bent' },
  { id: 'score', naam: 'Scorebord over meerdere potjes' },
  { id: 'geluid', naam: 'Geluidjes bij zetten, winnen en verliezen', standaard: true },
  { id: 'animaties', naam: 'Animaties (kaarten of stukken die bewegen)', standaard: true },
  { id: 'hulp', naam: 'Hulp: laten oplichten wat je mag doen', standaard: true },
  { id: 'grootstand', naam: 'Instelling: grote kaarten of stukken' },
]
// Titelscherm en muziek in de stijl van een spel dat er al is (titelscenes.js en titelmuziek.js)
export const TITELS = { '': 'Geen titelscherm', pesten: 'zoals Pesten', toepen: 'zoals Toepen', eenentwintigen: 'zoals Black Jack',
  vieroprij: 'zoals Vier op een rij', botkaaseiren: 'zoals Boter-kaas-en-eieren', dammen: 'zoals Dammen' }
// Kaartspellen: welk spel kaarten
export const DECKS = {
  '52': 'Gewoon kaartspel (52 kaarten)',
  '54': 'Met 2 jokers (54 kaarten)',
  '32': 'Piket (32 kaarten: 7 tot en met aas)',
  '104': 'Twee spellen (104 kaarten)',
}
export const KAARTEN = ['aas', 'heer', 'vrouw', 'boer', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'joker']
export const GERESERVEERD = ['botkaaseiren', 'vieroprij', 'pesten', 'toepen', 'eenentwintigen', 'koningsjacht', 'schaken', 'schakendrie',
  'dammen', 'pong', 'flappybird', 'spaceinvaders', 'swarm', 'pacman', 'endlessrunner', 'pinball', 'breakout', 'shmup', 'sjabloon', 'spel']

export const maakId = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 20)
const tekst = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max)
const lang = (s, max) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
const isTekst = s => typeof s === 'string'

// Een spel uit wat er in de Studio is ingevuld (alles netjes gemaakt; valideerSpel kijkt daarna of het klopt)
export function maakSpel(v) {
  const kaart = v.soort === 'kaart'
  const met = {}
  for (const o of ONDERDELEN) met[o.id] = o.vast ? true : Boolean(v.met && v.met[o.id])
  if (!met.vriend) { met.chatbalk = false; met.webcam = false }
  const spraak0 = SPRAAK[v.spraak] ? v.spraak : 'knop'
  const spel = {
    formaat: FORMAAT, versie: 1, id: maakId(v.id || v.naam), soort: kaart ? 'kaart' : 'beurt',
    naam: [tekst(v.naam, MAX_NAAM), tekst(v.naamEn, MAX_NAAM) || tekst(v.naam, MAX_NAAM)],
    icoon: tekst(v.icoon, 8),
    uitleg: [tekst(v.uitleg, MAX_UITLEG), tekst(v.uitlegEn, MAX_UITLEG)],
    regels: lang(v.regels, MAX_REGELS),
    doel: tekst(v.doel, MAX_REGEL),
    met, spraak: !met.vriend ? 'uit' : (spraak0 === 'knop' && !met.webcam ? 'uit' : spraak0),
    extras: EXTRAS.filter(x => v.extras && v.extras[x.id]).map(x => x.id),
    titel: TITELS[v.titel] ? v.titel : '',
  }
  if (kaart) spel.kaarten = {
    deck: DECKS[v.deck] ? v.deck : '52',
    perSpeler: Math.max(1, Math.min(26, Math.round(Number(v.perSpeler) || 7))),
    speciaal: (v.speciaal || []).filter(s => s && tekst(s.wat, MAX_REGEL)).slice(0, MAX_SPECIAAL)
      .map(s => ({ kaart: KAARTEN.includes(s.kaart) ? s.kaart : 'aas', wat: tekst(s.wat, MAX_REGEL) })),
  }
  else spel.bord = tekst(v.bord, MAX_REGEL)
  if (isTekst(v.plaatje) && v.plaatje) spel.plaatje = v.plaatje
  return spel
}

// Klopt het spelbestand? Geeft een lijst met wat er mis is (leeg = goed). Ook voor bestanden van buiten.
export function valideerSpel(s, { bestaand = [] } = {}) {
  const f = []
  if (!s || typeof s !== 'object') return ['Dit is geen spelbestand.']
  if (s.formaat !== FORMAAT) f.push('Dit is geen spelbestand van Stekky Studio.')
  const naamGoed = Array.isArray(s.naam) && isTekst(s.naam[0]) && s.naam[0].trim()
  if (naamGoed && !/^[a-z][a-z0-9]{2,19}$/.test(String(s.id || ''))) f.push('De naam moet minstens 3 letters hebben (alleen letters en cijfers, begint met een letter).')
  else if (naamGoed && (GERESERVEERD.includes(s.id) || bestaand.includes(s.id))) f.push('Er is al een spel met deze naam (' + s.id + ').')
  if (!SOORTEN[s.soort]) f.push('Kies beurtspel of kaartspel.')
  if (!naamGoed) f.push('De naam van het spel ontbreekt.')
  else if (s.naam.some(n => !isTekst(n) || n.length > MAX_NAAM || /[<>"`\\]/.test(n))) f.push('De naam is te lang of heeft rare tekens.')
  if (!isTekst(s.icoon) || !s.icoon.trim() || s.icoon.length > 8) f.push('Kies een icoon (één emoji).')
  if (!Array.isArray(s.uitleg) || !isTekst(s.uitleg[0]) || !s.uitleg[0].trim()) f.push('De uitleg voor de Store ontbreekt.')
  else if (!isTekst(s.uitleg[1]) || !s.uitleg[1].trim()) f.push('De Engelse uitleg voor de Store ontbreekt.')
  else if (s.uitleg.some(u => u.length > MAX_UITLEG || /[<>`\\]/.test(u))) f.push('De uitleg is te lang of heeft rare tekens.')
  if (!isTekst(s.regels) || s.regels.trim().length < 20) f.push('Schrijf de spelregels op (minstens een paar zinnen).')
  else if (s.regels.length > MAX_REGELS) f.push('De spelregels zijn te lang.')
  const met = s.met || {}
  if (met.computer !== true || met.store !== true || met.spelmenu !== true) f.push('Tegen de computer, de Store en het spelmenu zitten altijd in een spel.')
  if (s.spraak === 'knop' && !met.webcam) f.push('Spraak met de 📹-knop kan alleen met de webcamrondjes erbij.')
  if (!met.vriend && (met.chatbalk || met.webcam || s.spraak !== 'uit')) f.push('Chatbalk, webcam en spraak zijn alleen voor spelen met een vriend.')
  if (!SPRAAK[s.spraak]) f.push('Kies hoe de spraak werkt.')
  if (s.titel && !TITELS[s.titel]) f.push('Onbekend titelscherm.')
  if (!Array.isArray(s.extras) || s.extras.some(x => !EXTRAS.some(e => e.id === x))) f.push('Onbekende extra.')
  if (s.soort === 'kaart') {
    const k = s.kaarten || {}
    if (!DECKS[k.deck]) f.push('Kies welk kaartspel.')
    if (!Number.isInteger(k.perSpeler) || k.perSpeler < 1 || k.perSpeler > 26) f.push('Hoeveel kaarten krijgt elke speler (1 tot 26)?')
    else if (k.perSpeler * 2 > Number(k.deck)) f.push('Zoveel kaarten zitten er niet in het spel.')
    if (!Array.isArray(k.speciaal) || k.speciaal.length > MAX_SPECIAAL || k.speciaal.some(x => !x || !KAARTEN.includes(x.kaart) || !isTekst(x.wat) || !x.wat.trim()))
      f.push('Een speciale kaart klopt niet.')
    else {
      const dubbel = k.speciaal.map(x => x.kaart).filter((x, i, a) => a.indexOf(x) !== i)
      if (dubbel.length) f.push('Deze kaart staat twee keer bij de speciale kaarten: ' + dubbel[0] + '.')
      if (k.deck !== '54' && k.deck !== '104' && k.speciaal.some(x => x.kaart === 'joker')) f.push('Een joker zit alleen in het spel met 54 of 104 kaarten.')
      if (k.deck === '32' && k.speciaal.some(x => ['2', '3', '4', '5', '6'].includes(x.kaart))) f.push('In piket zitten geen kaarten onder de 7.')
    }
  }
  if (s.plaatje !== undefined && (!isTekst(s.plaatje) || !/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(s.plaatje) || s.plaatje.length > MAX_ICOON))
    f.push('Het spelicoon is geen goed plaatje (webp of png, niet te groot).')
  return f
}

// De bouwopdracht: alles wat er is ingevuld, als tekst voor Claude (spellen/<id>.md)
export function bouwopdracht(s) {
  const ja = b => b ? 'ja' : 'nee'
  const r = []
  r.push('# Bouwopdracht: ' + s.naam[0] + ' (' + s.icoon + ')', '')
  r.push('*Gemaakt in Stekky Studio. Bouw dit spel volgens ' + SOORTEN[s.soort].blauwdruk + '. Het spel staat al overal aangemeld (studio-spellen.js) en heeft een werkend beginspel in `' + s.id + '-ui.js` en een computerspeler in `' + s.id + '.js`. Vervang dat beginspel door de echte regels hieronder.*', '')
  r.push('## Wat', '', '- Soort: ' + SOORTEN[s.soort].naam, '- Id: `' + s.id + '`', '- Naam: ' + s.naam[0] + ' (Engels: ' + s.naam[1] + ')',
    '- Store, Nederlands: ' + s.uitleg[0], '- Store, Engels: ' + s.uitleg[1])
  if (s.doel) r.push('- Doel: ' + s.doel)
  r.push('', '## Spelregels', '', s.regels, '')
  if (s.soort === 'kaart') {
    r.push('## Kaarten', '', '- Kaartspel: ' + DECKS[s.kaarten.deck], '- Kaarten per speler: ' + s.kaarten.perSpeler)
    if (s.kaarten.speciaal.length) { r.push('- Speciale kaarten:'); for (const x of s.kaarten.speciaal) r.push('  - **' + x.kaart + '**: ' + x.wat) }
    r.push('- Gebruik de kaarttafel (`kaartspel-hulp.js`): kaartstijlen, ondergrond, animaties, beurtklok en trillen.', '')
  } else if (s.bord) r.push('## Bord', '', s.bord, '')
  r.push('## Wat erin zit', '')
  for (const o of ONDERDELEN) r.push('- ' + o.naam + ': ' + ja(s.met[o.id]))
  r.push('- Spraak: ' + SPRAAK[s.spraak], '- Titelscherm: ' + (s.titel ? TITELS[s.titel] : 'geen'), '')
  r.push('## Extra\'s', '')
  if (!s.extras.length) r.push('- (geen)')
  for (const x of EXTRAS) if (s.extras.includes(x.id)) r.push('- ' + x.naam)
  r.push('', '## Klaar is', '', '- de regels werken met een vriend en tegen de computer (wat hierboven aan staat);',
    '- alle teksten met `T(...)`, en Engels in `taal-en.js`;', '- een test in `tests/` en een browsertest in `tests/tools/`;',
    '- de `?v=` van ' + s.id + '-ui.js en ' + s.id + '.js omhoog (en `v` in studio-spellen.js).', '')
  return r.join('\n')
}
