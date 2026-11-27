// kaartmaker.js (v1, 25 nov 2026) - Stekky Studio: een eigen set speelkaarten maken uit een paar grote platen.
//
// In gewone woorden: je maakt (bijvoorbeeld met Gemini) een paar platen met kaarten in een raster. De Studio knipt ze
// los, zet elk plaatje op de goede kaart (je kunt het aanpassen) en maakt er een kaartpakket van (naam.stekkykaarten.json).
// Claude of Tijn zet het in de app met tests/tools/studio-kaarten-installeer.mjs; daarna kun je de kaarten kiezen in elk
// kaartspel (Kies je kaarten).
// Twee soorten:
//   plaatjes  18 plaatjes: de azen, boeren, vrouwen en heren, de achterkant en de joker (2 platen van 3 x 3). De kaarten
//             2 tot en met 10 tekent de app zelf, met de tekens in jouw kleuren.
//   alles     alle 54 kaarten zelf (4 platen van 4 x 4, één per kleur, en 1 plaat met de achterkant en de joker).
// Hier staan de platen, de prompt voor Gemini en de controle, zodat de Studio en het installatiescript hetzelfde doen.

export const FORMAAT = 'stekky-kaarten'
export const BREED = 375, HOOG = 525            // zoals de Perkament-kaarten (5 : 7)
export const MAX_PLAATJE = 150000, MAX_NAAM = 30
export const STANDAARD_ACHTERGROND = '#fffdf9'   // 27 nov 2026: de kaartkleur van de getekende 2 t/m 10 (een set mag een eigen kleur meegeven)
export const KLEUREN = ['h', 'r', 'k', 's']
export const KLEUR_NAAM = { h: 'harten', r: 'ruiten', k: 'klaveren', s: 'schoppen' }
const KLEUR_EN = { h: 'hearts', r: 'diamonds', k: 'clubs', s: 'spades' }
export const WAARDEN = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'H']
const WAARDE_NAAM = { A: 'aas', B: 'boer', V: 'vrouw', H: 'heer' }
const WAARDE_EN = { A: 'Ace', B: 'Jack', V: 'Queen', H: 'King' }
export const HOFKAARTEN = ['A', 'B', 'V', 'H']
export const STANDAARD_KLEUR = { h: '#d62839', r: '#e8892b', k: '#1f7a45', s: '#24408f' }
export const GERESERVEERD = ['stekky', 'perkament', 'modern', 'vrolijk', 'hout', 'koningsjacht-einde', 'kaarten']

export const SOORTEN = {
  plaatjes: { naam: 'Alleen de plaatjes (18)', uitleg: 'Je maakt de azen, boeren, vrouwen, heren, de achterkant en de joker. De kaarten 2 tot en met 10 tekent de app zelf, in jouw kleuren. 2 platen.' },
  alles: { naam: 'Alle 54 kaarten', uitleg: 'Je maakt elke kaart zelf, ook 2 tot en met 10. 5 platen.' },
}

// Welke kaart in welk vakje van welke plaat staat (leesvolgorde; null = leeg vakje)
export const PLATEN = {
  plaatjes: [
    { kolommen: 3, rijen: 3, vakken: ['hA', 'hB', 'hV', 'hH', 'rA', 'rB', 'rV', 'rH', 'achterkant'] },
    { kolommen: 3, rijen: 3, vakken: ['kA', 'kB', 'kV', 'kH', 'sA', 'sB', 'sV', 'sH', 'joker'] },
  ],
  alles: [
    ...KLEUREN.map(k => ({ kolommen: 4, rijen: 4, vakken: [...WAARDEN.map(w => k + w), null, null, null] })),
    { kolommen: 2, rijen: 1, vakken: ['achterkant', 'joker'] },
  ],
}
export const nodig = soort => PLATEN[soort].flatMap(p => p.vakken).filter(Boolean)

export function kaartNaam(n) {
  if (n === 'achterkant') return 'achterkant'
  if (n === 'joker') return 'joker'
  return KLEUR_NAAM[n[0]] + ' ' + (WAARDE_NAAM[n.slice(1)] || n.slice(1))
}
function kaartEngels(n, soort) {
  if (n === 'achterkant') return 'the card back (the same for every card: a decorative pattern, no numbers or suits)'
  if (n === 'joker') return 'the Joker'
  const w = n.slice(1), k = KLEUR_EN[n[0]]
  if (WAARDE_EN[w]) return WAARDE_EN[w] + ' of ' + k
  return w + ' of ' + k + (soort === 'alles' ? ' (exactly ' + w + ' ' + k + ' symbols)' : '')
}

export const maakId = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 20)

// De prompt voor Gemini, voor één plaat (nr begint bij 0)
export function maakKaartPrompt({ soort = 'plaatjes', nr = 0, stijl = '' } = {}) {
  const p = PLATEN[soort][nr]
  if (!p) return ''
  const lijst = p.vakken.map((v, i) => (i + 1) + '. ' + (v ? kaartEngels(v, soort) : 'leave this cell completely empty')).join('\n')
  return 'Create one image: a sheet of ' + p.vakken.filter(Boolean).length + ' playing cards in a grid of ' + p.kolommen + ' columns and ' + p.rijen + ' rows.\n' +
    'Every card is a portrait rectangle with the proportions 5:7, all exactly the same size, with rounded corners, evenly spaced, with a clear gap between the cards, on a plain flat white background. No shadows, no text outside the cards.\n' +
    'Art style for all cards: ' + (stijl.trim() || 'a friendly, colourful illustrated style with clean lines') + '. Keep the style, colours and border identical on every card of the deck.\n' +
    (soort === 'plaatjes'
      ? 'Leave the top-left and bottom-right corners of each card plain (no letters, numbers or suit symbols there): the app adds those itself.\n'
      : 'Leave the top-left and bottom-right corners plain: the app adds the value and suit there itself. Number cards show exactly that many suit symbols in the classic layout.\n') +
    'Hearts and diamonds are red, clubs and spades are dark. The cards, in reading order (left to right, top to bottom):\n' + lijst
}

// Een kaartpakket uit wat er in de Studio is gekozen
export function maakKaartset({ naam, naamEn, soort, kleur, kaarten, achtergrond }) {
  const s = SOORTEN[soort] ? soort : 'plaatjes'
  const k = {}
  for (const c of KLEUREN) k[c] = /^#[0-9a-f]{6}$/i.test(kleur && kleur[c]) ? kleur[c].toLowerCase() : STANDAARD_KLEUR[c]
  const n0 = String(naam || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAAM)
  return { formaat: FORMAAT, versie: 1, id: maakId(n0), naam: [n0, String(naamEn || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAAM) || n0], soort: s, kleur: k,
    ...(/^#[0-9a-f]{6}$/i.test(achtergrond || '') ? { achtergrond: achtergrond.toLowerCase() } : {}),
    kaarten: Object.fromEntries(nodig(s).filter(n => kaarten && kaarten[n]).map(n => [n, kaarten[n]])) }
}

// Klopt het kaartpakket? Geeft een lijst met wat er mis is (leeg = goed).
export function valideerKaartset(set, { bestaand = [] } = {}) {
  const f = []
  if (!set || typeof set !== 'object') return ['Dit is geen kaartpakket.']
  if (set.formaat !== FORMAAT) f.push('Dit is geen kaartpakket van Stekky Studio.')
  const naamGoed = Array.isArray(set.naam) && typeof set.naam[0] === 'string' && set.naam[0].trim()
  if (!naamGoed) f.push('De naam van de kaarten ontbreekt.')
  else {
    if (set.naam.some(n => typeof n !== 'string' || n.length > MAX_NAAM || /[<>"`\\]/.test(n))) f.push('De naam is te lang of heeft rare tekens.')
    if (!/^[a-z][a-z0-9]{2,19}$/.test(String(set.id || ''))) f.push('De naam moet minstens 3 letters hebben (alleen letters en cijfers, begint met een letter).')
    else if (GERESERVEERD.includes(set.id) || bestaand.includes(set.id)) f.push('Er zijn al kaarten met deze naam (' + set.id + ').')
  }
  if (!SOORTEN[set.soort]) f.push('Kies alleen de plaatjes of alle 54 kaarten.')
  if (!set.kleur || KLEUREN.some(k => !/^#[0-9a-f]{6}$/.test(set.kleur[k]))) f.push('De kleuren van harten, ruiten, klaveren en schoppen kloppen niet.')
  if (set.achtergrond !== undefined && !/^#[0-9a-f]{6}$/.test(set.achtergrond)) f.push('De achtergrondkleur van de kaarten klopt niet.')
  const kaarten = set.kaarten && typeof set.kaarten === 'object' ? set.kaarten : {}
  if (SOORTEN[set.soort]) {
    const mist = nodig(set.soort).filter(n => !kaarten[n])
    if (mist.length) f.push('Deze kaarten hebben nog geen plaatje: ' + mist.map(kaartNaam).join(', ') + '.')
    const over = Object.keys(kaarten).filter(n => !nodig(set.soort).includes(n))
    if (over.length) f.push('Deze kaarten horen er niet bij: ' + over.join(', ') + '.')
  }
  for (const [n, d] of Object.entries(kaarten))
    if (typeof d !== 'string' || !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(d) || d.length > MAX_PLAATJE * 1.37) { f.push('Het plaatje van ' + n + ' is geen goed webp-plaatje (of te groot).'); break }
  return f
}
