// kaartspel-hulp.js - BLAUWDRUK voor alle kaartspellen in Stekky (v1, 11 nov 2026). Zie BLAUWDRUK-KAARTSPEL.md.
// v2: de tafel is een eigen laag (isolation), zodat het pauzescherm van het spelmenu (spelmenu.js) er in de chat altijd boven ligt.
//     Tegen de computer (solo) geen reactieknop 😀.
// v5: opties stijl (vaste kaartstijl, dan geen knop 🎴), ondergrond: 'hout' (een houten tafelblad) en onSelectie;
//     voor Koningsjacht (koningsjacht-ui.js).
// v6: zwart-gouden moderne kaarten en een lokale stijlwissel op een vaste kaarttafel.
// v7 (14 nov 2026, Marcel): met je vinger over de waaier schuiven = de kaart onder je vinger komt groot omhoog (loslaten
//     = die kaart kiezen); een gekozen kaart op tafel leggen door op de aflegstapel te tikken; dubbeltik = meteen spelen;
//     tik op de aflegstapel zonder gekozen kaart = de laatste zet van de ander groot; knop ⚙️ met Hulp (kaarten
//     oplichten, standaard aan), Grote kaarten en Trillen (bewaard op dit toestel: fibro_kaarttafel).
// v4: scherpe hoekjes over de perkamentkaarten (beter te zien welke kaart het is), zie plaatjeMetHoek.
// v3: kaartstijl kiezen met de knop 🎴: de gewone Stekky-kaarten of de perkamentkaarten van Marcel (plaatjes in
//     kaarten/perkament/, met een eigen achterkant en joker). De keuze staat op dit toestel (fibro_kaartstijl).
//
// In gewone woorden: hier zit alles wat elk kaartspel hetzelfde doet, zodat een nieuw kaartspel alleen nog zijn
// eigen spelregels hoeft te maken (zoals pesten.js). Wat je hier krijgt:
//   - kaarten als vectorplaatjes (SVG): kaartSvg('h10'), kaartSvg('J1'), achterkantSvg()
//   - een tafel (maakKaartTafel): bovenin de ander (dichte waaier, aantal, beurtklok), in het midden de stapel en de
//     aflegstapel, onderin jouw kaarten als waaier, en een rij knoppen;
//   - jouw waaier: tik = kaart wordt groot en goed zichtbaar (tik meer kaarten van dezelfde waarde om ze samen te
//     spelen), veeg omhoog = spelen (hoe harder je veegt, hoe verder de kaart over tafel glijdt), lang vasthouden en
//     schuiven = de kaart op een andere plek zetten, de knop ⇅ = sorteren op kleur of waarde;
//   - kaarten die je mag spelen lichten paars op, de rest wordt iets donkerder;
//   - de stapel: tik = de kaart springt op, draait om en vliegt naar je hand; veeg = de kaart gaat met je vinger mee
//     en tolt naar je hand (een andere animatie);
//   - schudden en delen aan het begin, de kaarten van de ander vliegen naar zijn waaier;
//   - een beurtklok: een paarse ring die leegloopt rond de speler die aan de beurt is (ook om het webcamrondje);
//   - reacties: een emoji die over tafel vliegt; een opvallend effect bij een sterke kaart;
//   - trillen (waar het toestel dat kan) en geluidjes (gemaakt met Web Audio, geen bestanden).
// De chatbalk, stickers, webcamrondjes en het spraakgesprek regelt chat.html (zet het spel in KAARTSPELLEN).
//
// Kaartnamen: kleur + waarde. Kleuren h (harten) r (ruiten) k (klaveren) s (schoppen); waarden 2..10, B, V, H, A.
// Jokers: J1 en J2. Voorbeelden: 'h10', 'sA', 'kB', 'J2'.

import { webcamRuimte } from './beurtspel-hulp.js?v=1'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
const isEngels = () => Boolean(window.T && window.T.taal === 'en')

// ─────────────────────────────── Kaarten (SVG) ───────────────────────────────
const ROOD = '#d62246', ZWART = '#1a0a2e', GOUD = '#f5b301'
export const KAART_KLEUREN = ['h', 'r', 'k', 's']
export const KAART_WAARDEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const KLEUR_TEKEN = { h: '♥', r: '♦', k: '♣', s: '♠' }
export function kaartDelen(id) {
  if (/^J[12]$/.test(id)) return { kleur: 'j', waarde: 'J' }
  return { kleur: String(id)[0], waarde: String(id).slice(1) }
}
const kleurVan = k => (k === 'h' || k === 'r') ? ROOD : ZWART
// Zichtbare waarde: in het Engels J, Q, K in plaats van B, V, H
export const toonWaarde = w => isEngels() ? ({ B: 'J', V: 'Q', H: 'K' }[w] || w) : w
export function kaartNaam(id) {
  const { kleur, waarde } = kaartDelen(id)
  if (waarde === 'J') return T('Joker')
  const kn = { h: T('harten'), r: T('ruiten'), k: T('klaveren'), s: T('schoppen') }[kleur]
  const wn = { B: T('boer'), V: T('vrouw'), H: T('heer'), A: T('aas') }[waarde] || waarde
  return kn + ' ' + wn
}

// Kleurtekens getekend in een vak van 100 x 100
function tekenKleur(k, cx, cy, maat, omgekeerd, kleur) {
  const f = kleur || kleurVan(k)
  const t = 'translate(' + (cx - maat / 2) + ' ' + (cy - maat / 2) + ') scale(' + (maat / 100) + ')' + (omgekeerd ? ' rotate(180 50 50)' : '')
  let vorm
  if (k === 'h') vorm = '<path d="M50 90C22 68 5 51 5 31C5 15 17 5 30 5c10 0 17 6 20 14C53 11 60 5 70 5c13 0 25 10 25 26 0 20-17 37-45 59z"/>'
  else if (k === 'r') vorm = '<path d="M50 2Q68 28 90 50Q68 72 50 98Q32 72 10 50Q32 28 50 2z"/>'
  else if (k === 's') vorm = '<path d="M50 3C36 24 6 39 6 60c0 14 11 24 24 24 8 0 14-4 17-9-1 10-5 17-13 21h32c-8-4-12-11-13-21 3 5 9 9 17 9 13 0 24-10 24-24C94 39 64 24 50 3z"/>'
  else vorm = '<circle cx="50" cy="27" r="20"/><circle cx="27" cy="57" r="20"/><circle cx="73" cy="57" r="20"/><circle cx="50" cy="50" r="12"/><path d="M47 58c-1 18-5 29-13 38h32c-8-9-12-20-13-38z"/>'
  return '<g transform="' + t + '" fill="' + f + '">' + vorm + '</g>'
}

// Waar de tekens staan op de cijferkaarten (x, y; y > 175 = ondersteboven)
const L = 80, M = 125, R = 170
const PITTEN = {
  2: [[M, 82], [M, 268]],
  3: [[M, 82], [M, 175], [M, 268]],
  4: [[L, 82], [R, 82], [L, 268], [R, 268]],
  5: [[L, 82], [R, 82], [M, 175], [L, 268], [R, 268]],
  6: [[L, 82], [R, 82], [L, 175], [R, 175], [L, 268], [R, 268]],
  7: [[L, 82], [R, 82], [M, 128], [L, 175], [R, 175], [L, 268], [R, 268]],
  8: [[L, 82], [R, 82], [M, 128], [L, 175], [R, 175], [M, 222], [L, 268], [R, 268]],
  9: [[L, 82], [R, 82], [L, 144], [R, 144], [M, 175], [L, 206], [R, 206], [L, 268], [R, 268]],
  10: [[L, 82], [R, 82], [M, 113], [L, 144], [R, 144], [L, 206], [R, 206], [M, 237], [L, 268], [R, 268]],
}
const LETTER = 'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-weight="800" text-anchor="middle"'

function hoek(k, w, kleur) {
  const tekst = toonWaarde(w)
  const groot = tekst.length > 1 ? 40 : 50
  return '<text x="27" y="56" font-size="' + groot + '" ' + LETTER + ' fill="' + kleur + '"' + (tekst.length > 1 ? ' letter-spacing="-4"' : '') + '>' + tekst + '</text>'
    + tekenKleur(k, 27, 84, 30, false, kleur)
}

function gezicht(k, w, kleur) {
  const licht = kleur === ROOD ? '#fde8ec' : '#ece6f5'
  let hoofd
  if (w === 'H') hoofd = '<path d="M84 112V78l19 17 22-26 22 26 19-17v34z" fill="' + GOUD + '" stroke="' + kleur + '" stroke-width="4" stroke-linejoin="round"/><circle cx="125" cy="66" r="6" fill="' + kleur + '"/>'
  else if (w === 'V') hoofd = '<path d="M86 112q39-56 78 0z" fill="' + GOUD + '" stroke="' + kleur + '" stroke-width="4"/><circle cx="125" cy="80" r="7" fill="' + kleur + '"/><circle cx="104" cy="96" r="4" fill="' + kleur + '"/><circle cx="146" cy="96" r="4" fill="' + kleur + '"/>'
  else hoofd = '<path d="M88 112q2-32 37-34 35 2 37 34z" fill="' + kleur + '"/><path d="M152 84q28-20 22-44-12 24-28 36z" fill="' + GOUD + '"/><rect x="84" y="106" width="82" height="9" rx="4" fill="' + GOUD + '"/>'
  return '<rect x="52" y="46" width="146" height="258" rx="14" fill="' + licht + '" stroke="' + kleur + '" stroke-width="3"/>'
    + hoofd
    + '<text x="125" y="212" font-size="96" ' + LETTER + ' fill="' + kleur + '">' + toonWaarde(w) + '</text>'
    + tekenKleur(k, 125, 258, 48, false, kleur)
}

function joker(id) {
  const kleur = id === 'J2' ? '#c2185b' : '#8b3fd1'
  const ster = (cx, cy, r) => { let p = ''; for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; p += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1) } return p + 'z' }
  const hoekTekst = (x, y) => '<text x="' + x + '" y="' + y + '" font-size="22" ' + LETTER + ' fill="' + kleur + '" letter-spacing="1">' + ['J', 'O', 'K', 'E', 'R'].map((l, i) => '<tspan x="' + x + '" dy="' + (i ? 22 : 0) + '">' + l + '</tspan>').join('') + '</text>'
  return '<rect x="52" y="46" width="146" height="258" rx="14" fill="' + kleur + '" opacity=".12"/>'
    + '<path d="M80 168q4-62 45-78 41 16 45 78-22-14-45-14t-45 14z" fill="' + kleur + '"/>'
    + '<path d="M125 92q-40-20-58 6 22-4 36 12zM125 92q40-20 58 6-22-4-36 12z" fill="' + GOUD + '"/>'
    + '<circle cx="67" cy="98" r="9" fill="' + GOUD + '"/><circle cx="183" cy="98" r="9" fill="' + GOUD + '"/><circle cx="125" cy="84" r="9" fill="' + GOUD + '"/>'
    + '<path d="' + ster(125, 226, 52) + '" fill="' + GOUD + '" stroke="' + kleur + '" stroke-width="4" stroke-linejoin="round"/>'
    + hoekTekst(27, 40) + '<g transform="rotate(180 125 175)">' + hoekTekst(27, 40) + '</g>'
}

// ─────────────── Kaartstijl (v3): getekend (Stekky) of plaatjes (Perkament) ───────────────
// Plaatjes: kaarten/<stijl>/<kaart>.webp met de kaartnamen van hierboven (h10, sB, kV, rH, hA ...), plus joker.webp
// en achterkant.webp. Vervang je een plaatje, verhoog dan v hieronder (de service worker bewaart per ?v=).
// De plaatjes zijn gemaakt met tests/gen/kaarten_perkament/ (zie LEESMIJ daar).
const STIJL_SLEUTEL = 'fibro_kaartstijl'
export const KAARTSTIJLEN = {
  stekky: { naam: 'Stekky' },
  perkament: { naam: 'Perkament', map: './kaarten/perkament/', v: 1 },
  modern: { naam: 'Modern', verborgen: true }, // de complete Modern-scene in Koningsjacht kiest deze stijl
}
export function kaartStijl() {
  try { const s = localStorage.getItem(STIJL_SLEUTEL); return KAARTSTIJLEN[s] ? s : 'stekky' } catch (e) { return 'stekky' }
}
function plaatjeUrl(stijl, naam) { const s = KAARTSTIJLEN[stijl]; return s.map + naam + '.webp?v=' + s.v }
function plaatje(stijl, naam) {
  return '<img class="kt-svg kt-img" src="' + plaatjeUrl(stijl, naam) + '" alt="" draggable="false" decoding="async">'
}
const vooruitGeladen = new Set()
function laadVooruit(stijl) {
  if (!KAARTSTIJLEN[stijl]?.map || vooruitGeladen.has(stijl) || typeof Image === 'undefined') return
  vooruitGeladen.add(stijl)
  const namen = ['achterkant', 'joker']
  for (const k of KAART_KLEUREN) for (const w of KAART_WAARDEN) namen.push(k + w)
  for (const n of namen) { const i = new Image(); i.decoding = 'async'; i.src = plaatjeUrl(stijl, n) }
}
export function zetKaartStijl(stijl) {
  if (!KAARTSTIJLEN[stijl]) return
  try { localStorage.setItem(STIJL_SLEUTEL, stijl) } catch (e) {}
  laadVooruit(stijl)
  try { window.dispatchEvent(new CustomEvent('fibro-kaartstijl', { detail: { stijl } })) } catch (e) {}
}
laadVooruit(kaartStijl())   // alvast ophalen, zodat vliegende kaarten niet even leeg zijn

const svgCache = new Map()
const modernCache = new Map()
const MODERN_GOUD = '#d9ba75', MODERN_LICHT = '#fff0c6', MODERN_ROOD = '#ff7890'
// Originele lijnillustraties: twee gespiegelde helften, zoals op klassieke hofkaarten,
// met een eigentijds zwart glazen vlak en geometrische goudlijnen.
function modernKader(achter = false) {
  return '<rect x="2" y="2" width="246" height="346" rx="12" fill="#10151c" stroke="' + MODERN_GOUD + '" stroke-width="3"/>'
    + '<path d="M12 12h226v118L12 278z" fill="#d1e7f2" opacity=".065"/>'
    + '<path d="M12 16L232 338h-86L12 146z" fill="#ffffff" opacity=".035"/>'
    + '<rect x="10" y="10" width="230" height="330" rx="7" fill="none" stroke="' + MODERN_GOUD + '" stroke-width=".8" opacity=".65"/>'
    + (achter ? '' : '<path d="M59 17h132M59 333h132" stroke="' + MODERN_GOUD + '" stroke-width="1" opacity=".65"/>')
}
function modernHof(k, w, kleur) {
  const kroon = w === 'H'
    ? '<path d="M93 90V66l16 13 16-25 16 25 16-13v24z" fill="#50432a"/><path d="M93 83h64M101 70l6 14m18-26v26m24-14-6 14"/><circle cx="125" cy="54" r="3" fill="' + MODERN_LICHT + '"/>'
    : w === 'V'
      ? '<path d="M93 90q4-35 32-35t32 35M100 81l9-13 16 16 16-16 9 13M125 55v25"/><path d="M94 91q-20 15-13 45m75-45q20 15 13 45"/>'
      : '<path d="M91 88q9-29 43-22l24 19z" fill="#3a3121"/><path d="M89 89h70M138 66q10-21 29-21-1 21-26 27m0-7 18-12"/>'
  const attribuut = w === 'H'
    ? '<path d="M78 157V97l-4-13-4 13v60m-8-30h24M67 154h15"/><path d="M74 101v22" stroke="' + MODERN_LICHT + '"/>'
    : w === 'V'
      ? '<path d="M176 160v-42m0 9-10-11m10 19 10-10"/><path d="M176 104c-16-15-22 7-8 12-1 14 18 14 18 0 15-6 8-26-10-12z" fill="#6b3f44"/>'
      : '<path d="M76 160V113m0 15q-18-21-11-34 18 9 11 34zm0 10q18-20 20-32-18 1-20 32z" fill="#303d39"/>'
  const mozaiek = Array.from({ length: 6 }, (_, n) => {
    const y = 135 + n * 6
    return '<path d="M96 ' + y + 'l14 7 15-7 15 7 14-7"/>'
  }).join('')
  const helft = '<g stroke="' + MODERN_GOUD + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" fill="none">'
    + kroon
    + '<path d="M106 93v19q1 15 19 18 18-3 19-18V93z" fill="#746349"/>'
    + '<path d="M109 102h9m14 0h9m-16 3-4 12h7m-8 7h12" stroke="#171a20" stroke-width="1.9"/>'
    + '<path d="M112 125v12l-24 10-17 28h108l-17-28-24-10v-12M112 136l13 18 13-18M88 147l17 28m57-28-17 28" fill="#222a32"/>'
    + mozaiek + attribuut
    + '<path d="M119 155l6 8 6-8-6-7z" fill="' + kleur + '"/>'
    + '</g>'
  return '<rect x="54" y="45" width="142" height="260" rx="4" fill="#141b23" stroke="' + MODERN_GOUD + '" stroke-width="1.2"/>'
    + '<path d="M59 49h132v252H59zM65 55h120v240H65z" fill="none" stroke="' + MODERN_GOUD + '" stroke-width=".6" opacity=".45"/>'
    + helft + '<g transform="rotate(180 125 175)">' + helft + '</g>'
    + '<path d="M59 175h132" stroke="' + MODERN_GOUD + '" stroke-width="1"/>'
    + tekenKleur(k, 125, 175, 27, false, kleur)
}
function modernKaart(id) {
  const sleutel = id + (isEngels() ? '|en' : '|nl')
  if (modernCache.has(sleutel)) return modernCache.get(sleutel)
  const { kleur: k, waarde: w } = kaartDelen(id)
  const kleur = k === 'h' || k === 'r' || id === 'J2' ? MODERN_ROOD : MODERN_LICHT
  let binnen = ''
  if (w === 'J') {
    const letters = '<text x="30" y="48" font-size="19" ' + LETTER + ' fill="' + kleur + '">' + ['J', 'O', 'K', 'E', 'R'].map((l, i) => '<tspan x="30" dy="' + (i ? 20 : 0) + '">' + l + '</tspan>').join('') + '</text>'
    binnen = letters + '<g transform="rotate(180 125 175)">' + letters + '</g>'
      + '<g stroke="' + MODERN_GOUD + '" stroke-width="2" fill="none"><path d="M71 181q-5-54 10-72 24 10 44 46 20-36 44-46 15 18 10 72l-25-14-29 18-29-18z" fill="#26323c"/><circle cx="81" cy="109" r="6"/><circle cx="169" cy="109" r="6"/><path d="M125 220l13 23 26 5-18 18 3 27-24-12-24 12 3-27-18-18 26-5z" fill="' + kleur + '"/><path d="M81 117l15 40m73-40-15 40M125 155v22"/></g>'
  } else {
    binnen = hoek(k, w, kleur) + '<g transform="rotate(180 125 175)">' + hoek(k, w, kleur) + '</g>'
    if (w === 'A') binnen += '<path d="M125 71l66 104-66 104-66-104zM125 89l54 86-54 86-54-86z" fill="none" stroke="' + MODERN_GOUD + '" stroke-width="1.4"/>' + tekenKleur(k, 125, 175, 93, false, kleur)
    else if (PITTEN[w]) binnen += PITTEN[w].map(([x, y]) => tekenKleur(k, x, y, 39, y > 175, kleur)).join('')
    else binnen += modernHof(k, w, kleur)
  }
  const svg = '<svg class="kt-svg kt-modern" viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + modernKader() + binnen + '</svg>'
  modernCache.set(sleutel, svg)
  return svg
}
function modernAchterkant() {
  let stralen = ''
  for (let n = 0; n < 12; n++) {
    const d = 9 + n * 6
    stralen += '<path d="M125 ' + (22 + n * 3) + 'l' + d + ' ' + (153 - n * 3) + '-' + d + ' ' + (153 - n * 3) + '-' + d + '-' + (153 - n * 3) + 'z"/>'
  }
  return '<svg class="kt-svg kt-modern" viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + modernKader(true)
    + '<g fill="none" stroke="' + MODERN_GOUD + '" stroke-width=".8" opacity=".55">' + stralen + '</g>'
    + '<path d="M125 123l35 52-35 52-35-52z" fill="#111820" stroke="' + MODERN_LICHT + '" stroke-width="2"/>'
    + '<path d="M125 146l19 29-19 29-19-29z" fill="' + MODERN_GOUD + '"/><circle cx="125" cy="175" r="7" fill="#131921"/></svg>'
}
// v4 (13 nov 2026): op de plaatjes (Perkament) waren de hoekjes klein en wazig, dus in je waaier zag je slecht welke
// kaart het was. Nu staat er over beide hoeken een scherp, getekend hoekje: de waarde (B/V/H in het Nederlands, net
// als in de spellen) en het teken, in de kleur van die soort op de perkamentkaarten.
const PERK_KLEUR = { h: '#a3212b', r: '#6d2a84', k: '#2e5b2a', s: '#1d2d55' }
function perkHoek(k, w) {
  const kleur = PERK_KLEUR[k] || ZWART, tekst = toonWaarde(w)
  return '<rect x="7" y="9" width="46" height="98" rx="11" fill="#f5e8cb" stroke="#d9c49a" stroke-width="1.5"/>'
    + '<text x="30" y="52" font-size="' + (tekst.length > 1 ? 34 : 42) + '" font-family="Georgia,\'Times New Roman\',serif" font-weight="700" text-anchor="middle" fill="' + kleur + '"'
    + (tekst.length > 1 ? ' letter-spacing="-3"' : '') + '>' + tekst + '</text>'
    + tekenKleur(k, 30, 80, 30, false, kleur)
}
function plaatjeMetHoek(stijl, id) {
  const { kleur: k, waarde: w } = kaartDelen(id)
  return '<span class="kt-svg kt-pk">' + plaatje(stijl, id)
    + '<svg class="kt-pk-hoek" viewBox="0 0 250 350" aria-hidden="true">' + perkHoek(k, w)
    + '<g transform="rotate(180 125 175)">' + perkHoek(k, w) + '</g></svg></span>'
}
export function kaartSvg(id, stijl = kaartStijl()) {
  if (stijl === 'modern') return modernKaart(id)
  if (KAARTSTIJLEN[stijl]?.map) return /^J[12]$/.test(id) ? plaatje(stijl, 'joker') : plaatjeMetHoek(stijl, id)
  const sleutel = id + (isEngels() ? '|en' : '')
  if (svgCache.has(sleutel)) return svgCache.get(sleutel)
  const { kleur: k, waarde: w } = kaartDelen(id)
  let binnen
  if (w === 'J') binnen = joker(id)
  else {
    const kleur = kleurVan(k)
    let midden
    if (w === 'A') midden = tekenKleur(k, 125, 175, k === 's' ? 128 : 112, false, kleur) + (k === 's' ? '<circle cx="125" cy="175" r="78" fill="none" stroke="' + GOUD + '" stroke-width="3" opacity=".6"/>' : '')
    else if (PITTEN[w]) midden = PITTEN[w].map(([x, y]) => tekenKleur(k, x, y, 46, y > 175, kleur)).join('')
    else midden = gezicht(k, w, kleur)
    binnen = hoek(k, w, kleur) + '<g transform="rotate(180 125 175)">' + hoek(k, w, kleur) + '</g>' + midden
  }
  const svg = '<svg class="kt-svg" viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<rect x="2" y="2" width="246" height="346" rx="18" fill="#fffdf9" stroke="#d6c8e6" stroke-width="3"/>' + binnen + '</svg>'
  svgCache.set(sleutel, svg)
  return svg
}

// Achterkanten. Later kunnen er meer bij komen (bijvoorbeeld uit de Stekky Store): zet ze in ACHTERKANTEN.
export const ACHTERKANTEN = {
  stekky: { van: '#8b3fd1', midden: '#6a2bab', naar: '#1a0a2e', lijn: '#c084fc' },
}
export function achterkantSvg(stijl) {
  if (stijl === 'modern' || (!stijl && kaartStijl() === 'modern')) return modernAchterkant()
  if (KAARTSTIJLEN[stijl]?.map) return plaatje(stijl, 'achterkant')   // v5: de achterkant van een plaatjesstijl
  if (!stijl) { const ks = kaartStijl(); if (KAARTSTIJLEN[ks].map) return plaatje(ks, 'achterkant'); stijl = 'stekky' }
  const a = ACHTERKANTEN[stijl] || ACHTERKANTEN.stekky
  const id = 'ktA' + (Object.keys(ACHTERKANTEN).indexOf(stijl) + 1 || 1)
  let lijnen = ''
  for (let i = -350; i < 600; i += 28) lijnen += '<path d="M' + i + ' 0l350 350M' + (i + 350) + ' 0l-350 350"/>'
  const vonk = 'M125 140q4 31 35 35-31 4-35 35-4-31-35-35 31-4 35-35z'
  return '<svg class="kt-svg" viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a.van + '"/><stop offset=".55" stop-color="' + a.midden + '"/><stop offset="1" stop-color="' + a.naar + '"/></linearGradient>'
    + '<clipPath id="' + id + 'c"><rect x="16" y="16" width="218" height="318" rx="10"/></clipPath></defs>'
    + '<rect x="2" y="2" width="246" height="346" rx="18" fill="url(#' + id + ')" stroke="#ffffff55" stroke-width="3"/>'
    + '<g clip-path="url(#' + id + 'c)" stroke="' + a.lijn + '" stroke-opacity=".22" stroke-width="3" fill="none">' + lijnen + '</g>'
    + '<rect x="16" y="16" width="218" height="318" rx="10" fill="none" stroke="' + a.lijn + '" stroke-opacity=".7" stroke-width="3"/>'
    + '<path d="M125 112l63 63-63 63-63-63z" fill="' + a.naar + '" stroke="' + a.lijn + '" stroke-width="4"/>'
    + '<path d="' + vonk + '" fill="' + a.lijn + '"/></svg>'
}

// Standaard sorteren: op kleur (♥ ♣ ♦ ♠, rood en zwart om en om) of op waarde (2 .. aas, jokers achteraan)
const KLEUR_VOLG = { h: 0, k: 1, r: 2, s: 3, j: 4 }
const waardeNr = w => w === 'J' ? 99 : KAART_WAARDEN.indexOf(w)
export const SORTEER = {
  kleur: (a, b) => { const x = kaartDelen(a), y = kaartDelen(b); return (KLEUR_VOLG[x.kleur] - KLEUR_VOLG[y.kleur]) || (waardeNr(x.waarde) - waardeNr(y.waarde)) || a.localeCompare(b) },
  waarde: (a, b) => { const x = kaartDelen(a), y = kaartDelen(b); return (waardeNr(x.waarde) - waardeNr(y.waarde)) || (KLEUR_VOLG[x.kleur] - KLEUR_VOLG[y.kleur]) || a.localeCompare(b) },
}

// Vaste, kleine draai voor een kaart op de aflegstapel (bij jou en de ander hetzelfde)
export function draaiVan(id, n = 0) {
  let h = 7 + n * 31
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 997
  return (h % 25) - 12
}

// ─────────────────────────────── Geluid en trillen ───────────────────────────────
let ac = null
function audio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!ac && AC) ac = new AC()
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {})
  } catch (e) { return null }
  return ac
}
function ruis(duur, { van = 4000, naar = 800, luid = 0.18, q = 0.8, wacht = 0 } = {}) {
  const a = audio(); if (!a) return
  const t = a.currentTime + 0.01 + wacht
  const len = Math.max(1, Math.floor(a.sampleRate * duur))
  const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const bron = a.createBufferSource(); bron.buffer = buf
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q
  f.frequency.setValueAtTime(van, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, naar), t + duur)
  const g = a.createGain(); g.gain.setValueAtTime(luid, t); g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
  bron.connect(f); f.connect(g); g.connect(a.destination); bron.start(t); bron.stop(t + duur + 0.02)
}
function toon(freq, duur, { type = 'sine', luid = 0.08, wacht = 0, naar } = {}) {
  const a = audio(); if (!a) return
  const t = a.currentTime + 0.01 + wacht
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t)
  if (naar) o.frequency.exponentialRampToValueAtTime(naar, t + duur)
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(luid, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + duur + 0.02)
}
export const kaartGeluid = {
  tik: () => ruis(0.04, { van: 5000, naar: 3000, luid: 0.08, q: 2 }),
  pak: () => { ruis(0.12, { van: 2500, naar: 5000, luid: 0.12 }); ruis(0.03, { van: 3000, naar: 2500, luid: 0.1, q: 3, wacht: 0.12 }) },
  veeg: () => ruis(0.22, { van: 1200, naar: 6000, luid: 0.14, q: 0.6 }),
  leg: (hard = 0) => ruis(0.07 + hard * 0.04, { van: 1800, naar: 500, luid: 0.2 + Math.min(0.15, hard * 0.1), q: 0.9 }),
  schud: () => { for (let i = 0; i < 9; i++) ruis(0.05, { van: 3500, naar: 1800, luid: 0.09, q: 1.5, wacht: i * 0.07 }) },
  deel: () => ruis(0.05, { van: 4200, naar: 2200, luid: 0.07, q: 1.4 }),
  nee: () => { toon(220, 0.12, { type: 'square', luid: 0.04 }); toon(180, 0.14, { type: 'square', luid: 0.04, wacht: 0.1 }) },
  beurt: () => { toon(880, 0.18, { luid: 0.06 }); toon(1320, 0.25, { luid: 0.05, wacht: 0.09 }) },
  speciaal: () => [523, 659, 784, 1047].forEach((f, i) => toon(f, 0.22, { type: 'triangle', luid: 0.07, wacht: i * 0.06 })),
  straf: () => toon(420, 0.4, { type: 'sawtooth', luid: 0.05, naar: 140 }),
  pop: () => toon(600, 0.12, { luid: 0.08, naar: 1200 }),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => toon(f, 0.3, { type: 'triangle', luid: 0.08, wacht: i * 0.1 })),
  verlies: () => [392, 330, 262].forEach((f, i) => toon(f, 0.35, { type: 'triangle', luid: 0.07, wacht: i * 0.16 })),
  roep: () => { toon(988, 0.12, { type: 'square', luid: 0.05 }); toon(1319, 0.2, { type: 'square', luid: 0.05, wacht: 0.1 }) },
}
export function tril(patroon = 12) { if (!kaartInstellingen().trillen) return; try { if (navigator.vibrate) navigator.vibrate(patroon) } catch (e) {} }

// ─────────────── Instellingen van de tafel (v7): per toestel, voor alle kaartspellen ───────────────
// hulp: kaarten die je mag spelen lichten op (en de stapel als je niets kunt). groot: grotere kaarten in je waaier.
// trillen: de telefoon trilt bij kaarten en effecten. Een spel met een eigen instellingenscherm (Koningsjacht) zet
// instellingKnop: false en toont KAART_INSTELLINGEN zelf, met kaartInstellingen() en zetKaartInstelling().
const INSTELLING_SLEUTEL = 'fibro_kaarttafel'
const STANDAARD_INSTELLINGEN = { hulp: true, groot: false, trillen: true }
export const KAART_INSTELLINGEN = [
  { sleutel: 'hulp', titel: 'Hulp: kaarten oplichten', uitleg: 'Kaarten die je mag spelen lichten op, de rest wordt donkerder.' },
  { sleutel: 'groot', titel: 'Grote kaarten', uitleg: 'Je kaarten zijn groter: makkelijker te lezen en te tikken.' },
  { sleutel: 'trillen', titel: 'Trillen', uitleg: 'Je telefoon trilt een beetje bij kaarten en effecten.' },
]
export function kaartInstellingen() {
  let bewaard = {}
  try { bewaard = JSON.parse(localStorage.getItem(INSTELLING_SLEUTEL) || '{}') || {} } catch (e) {}
  const uit = { ...STANDAARD_INSTELLINGEN }
  for (const k of Object.keys(uit)) if (typeof bewaard[k] === 'boolean') uit[k] = bewaard[k]
  return uit
}
export function zetKaartInstelling(sleutel, aan) {
  if (!(sleutel in STANDAARD_INSTELLINGEN)) return
  const nu = { ...kaartInstellingen(), [sleutel]: Boolean(aan) }
  try { localStorage.setItem(INSTELLING_SLEUTEL, JSON.stringify(nu)) } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('fibro-kaarttafel', { detail: nu })) } catch (e) {}
}

// ─────────────────────────────── Stijl ───────────────────────────────
const STIJL = `
.kt-tafel{position:relative;isolation:isolate;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overflow:hidden;background:radial-gradient(ellipse at 50% 46%,#3a1a5e 0%,#24103d 45%,#1a0a2e 80%)}
.kt-tafel *{box-sizing:border-box}
.kt-tafel.kt-hout{background:radial-gradient(ellipse at 50% 46%,#0000 35%,#0000004d 72%,#000000b3 100%),url(kaarten/hout.webp?v=1) center/cover #4a2c16}
.kt-hout .kt-status{text-shadow:0 1px 3px #000,0 0 8px #000}
.kt-svg{display:block;width:100%;height:100%}
.kt-img{object-fit:fill;pointer-events:none;-webkit-user-drag:none;user-select:none;border-radius:7%}
.kt-pk{position:relative;pointer-events:none}.kt-pk>.kt-img{display:block;width:100%;height:100%}.kt-pk-hoek{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.kt-kaart{position:absolute;left:0;top:0;border-radius:calc(var(--kw)*.075);box-shadow:0 2px 8px #0007;transition:transform .22s cubic-bezier(.2,.8,.3,1.2),filter .2s,box-shadow .2s;touch-action:none;will-change:transform;cursor:pointer}
.kt-kaart.kt-mag{box-shadow:0 0 0 2px #c084fc,0 0 16px #c084fcb0,0 2px 8px #0007}
.kt-kaart.kt-niet{filter:brightness(.62) saturate(.8)}
.kt-kaart.kt-gekozen{box-shadow:0 0 0 3px #fff,0 0 22px #c084fc,0 8px 20px #000a;filter:none}
.kt-kaart.kt-sleep{transition:none;z-index:300!important}
.kt-kaart.kt-weg{visibility:hidden}
.kt-kaart.kt-loep{z-index:400!important;box-shadow:0 0 0 2px #fff,0 0 20px #c084fcb0,0 10px 24px #000b;filter:none}
.kt-afleg{cursor:pointer;touch-action:manipulation}
.kt-afleg.kt-doel{border-radius:calc(var(--pw)*.075);box-shadow:0 0 0 2px #c084fc,0 0 18px #c084fcb0}
.kt-instelrij{display:flex;flex-direction:column;gap:2px;margin-top:10px;text-align:left;max-width:300px}
.kt-instelling{display:flex;align-items:center;gap:12px;padding:10px 2px;border-top:1px solid #ffffff1c;cursor:pointer}
.kt-instelling span{flex:1}.kt-instelling small{display:block;opacity:.75;font-size:12px;margin-top:2px;font-weight:400}
.kt-instelling input{width:22px;height:22px;accent-color:#8b3fd1;flex:none}
.kt-laatste{display:flex;justify-content:center;gap:8px;margin-top:12px}
.kt-laatste>div{width:min(30vw,110px);aspect-ratio:5/7;border-radius:7%;box-shadow:0 4px 14px #000a}
.kt-ander{flex:none;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 12px 2px;min-height:76px}
.kt-zetel{position:relative;width:46px;height:46px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:19px;background:linear-gradient(135deg,#8b3fd1,#6a2bab);border:2px solid #ffffff40}
.kt-klok{position:absolute;inset:-7px;border-radius:50%;pointer-events:none;opacity:0;transition:opacity .25s;background:conic-gradient(var(--kt-klokkleur,#c084fc) calc(var(--kt-rest,1)*360deg),#ffffff14 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4px));mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4px))}
.kt-klok.kt-aan{opacity:1}
.kt-klok.kt-bijna{--kt-klokkleur:#f87171;animation:ktKlop .6s ease-in-out infinite alternate}
.spel-video-vak>.kt-klok{inset:-11px;z-index:3}
@keyframes ktKlop{to{filter:brightness(1.6)}}
.kt-anderinfo{display:flex;flex-direction:column;gap:2px;min-width:0}
.kt-andernaam{font-weight:700;font-size:14px;max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kt-anderaantal{font-size:12px;opacity:.75}
.kt-anderwaaier{position:relative;height:60px;width:120px;flex:none}
.kt-anderwaaier .kt-mini{position:absolute;left:50%;top:4px;width:34px;height:48px;margin-left:-17px;transform-origin:50% 160%;border-radius:4px;box-shadow:0 1px 4px #0008}
.kt-ander{position:relative}
.kt-anderknop{position:absolute;left:50%;top:100%;transform:translateX(-50%);z-index:20;margin-top:4px}
.kt-midden{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;gap:clamp(18px,7vw,46px);position:relative}
.kt-stapel,.kt-afleg{position:relative;width:var(--pw);height:calc(var(--pw)*1.4)}
.kt-stapel{cursor:pointer;touch-action:none}
.kt-stapel .kt-st{position:absolute;inset:0;border-radius:calc(var(--pw)*.075);box-shadow:0 1px 3px #0009}
.kt-stapel.kt-leeg{opacity:.35}
.kt-stapel.kt-wijs .kt-st:last-child{box-shadow:0 0 0 2px #c084fc,0 0 18px #c084fcb0}
.kt-teller{position:absolute;left:50%;bottom:-22px;transform:translateX(-50%);font-size:12px;opacity:.75;white-space:nowrap}
.kt-afleg .kt-ak{position:absolute;inset:0;border-radius:calc(var(--pw)*.075);box-shadow:0 2px 6px #0008;transition:filter .3s}
.kt-afleg .kt-ak.kt-gloed{animation:ktGloed 1.1s ease-out}
@keyframes ktGloed{0%{box-shadow:0 0 0 0 #fff0}25%{box-shadow:0 0 0 5px #fff,0 0 40px 10px #c084fc}100%{box-shadow:0 2px 6px #0008}}
.kt-info{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);display:flex;gap:8px;pointer-events:none;white-space:nowrap}
.kt-status{flex:none;text-align:center;font-weight:700;font-size:15px;min-height:22px;padding:2px 10px;text-shadow:0 1px 3px #000}
.kt-hand{flex:none;position:relative;width:100%}
.kt-onder{flex:none;display:flex;align-items:center;justify-content:center;gap:8px;padding:4px 10px 6px;flex-wrap:wrap;min-height:50px}
.kt-onder .kt-zetel{width:38px;height:38px;font-size:15px}
.kt-knop{min-height:40px;padding:8px 13px;border-radius:12px;border:1px solid #ffffff33;background:#ffffff1c;color:#fff;font:inherit;font-weight:700;font-size:14px;cursor:pointer;touch-action:manipulation}
.kt-knop.kt-nadruk{background:#8b3fd1;border-color:#c084fc;box-shadow:0 0 14px #8b3fd1aa}
.kt-knop.kt-schud{animation:ktSchudKnop .5s ease-in-out infinite alternate}
@keyframes ktSchudKnop{from{transform:rotate(-3deg) scale(1)}to{transform:rotate(3deg) scale(1.06)}}
.kt-knop:disabled{opacity:.4}
.kt-reacties{display:none;gap:4px;padding:6px;border-radius:14px;background:#000c;border:1px solid #ffffff22;position:absolute;bottom:calc(100% + 6px);right:0;z-index:60}
.kt-reacties.kt-open{display:flex}
.kt-reacties button{font-size:26px;background:none;border:none;padding:4px 6px;cursor:pointer}
.kt-laag{position:fixed;inset:0;pointer-events:none;z-index:48}
.kt-vlieg{position:fixed;left:0;top:0;transform-style:preserve-3d;will-change:transform}
.kt-vlieg .kt-v{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:7%;box-shadow:0 6px 18px #000a}
.kt-vlieg .kt-v.kt-achter{transform:rotateY(180deg)}
.kt-effect{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);font-weight:900;font-size:clamp(28px,9vw,54px);color:#fff;text-shadow:0 0 18px #c084fc,0 0 4px #8b3fd1,0 3px 0 #1a0a2e;white-space:nowrap;pointer-events:none;z-index:49}
.kt-reactie{position:fixed;font-size:54px;pointer-events:none;z-index:49}
.kt-einde{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1a0a2ecc;z-index:55;backdrop-filter:blur(2px)}
.kt-eindekaart{display:flex;flex-direction:column;align-items:center;gap:12px;padding:22px 26px;border-radius:20px;background:linear-gradient(160deg,#8b3fd1,#6a2bab 55%,#1a0a2e);border:1px solid #c084fc;box-shadow:0 10px 40px #000c;text-align:center}
.kt-eindetitel{font-size:26px;font-weight:900}
.kt-eindesub{font-size:14px;opacity:.85}
.kt-keuze{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0009;z-index:56}
.kt-keuzekaart{padding:18px;border-radius:18px;background:#24103d;border:1px solid #c084fc;text-align:center}
.kt-keuzerij{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
.kt-keuzerij button{width:62px;height:62px;border-radius:14px;border:2px solid #ffffff33;background:#fffdf9;font-size:36px;cursor:pointer;line-height:1}
.kt-stijlrij{display:flex;gap:12px;justify-content:center;margin-top:12px}
.kt-stijlkeuze{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px;border-radius:14px;border:2px solid #ffffff22;background:#ffffff10;color:#fff;font:inherit;font-weight:700;cursor:pointer}
.kt-stijlkeuze[aria-pressed=true]{border-color:#c084fc;background:#8b3fd140;box-shadow:0 0 14px #8b3fd1aa}
.kt-stijlvoorbeeld{display:flex}
.kt-stijlvoorbeeld>div{width:52px;height:73px;border-radius:5px;box-shadow:0 2px 6px #0008}
.kt-stijlvoorbeeld>div+div{margin-left:-14px;transform:rotate(8deg)}
@media (prefers-reduced-motion:reduce){.kt-kaart{transition:none}.kt-klok.kt-bijna,.kt-knop.kt-schud{animation:none}}
`
// v5: ook los te gebruiken (Koningsjacht toont kaarten op het beginscherm, nog zonder tafel)
export function zetStijl() {
  if (document.getElementById('kt-stijl')) return
  const s = document.createElement('style'); s.id = 'kt-stijl'; s.textContent = STIJL
  document.head.appendChild(s)
}
const rustig = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false } }
const wacht = ms => new Promise(r => setTimeout(r, ms))
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// ─────────────────────────────── De tafel ───────────────────────────────
// opties:
//   solo            true in spel.html (geen chatbalk onderin, dus geen ruimte daarvoor nodig)
//   naamAnder       naam van de tegenstander
//   achterkant      'stekky' (of een andere uit ACHTERKANTEN)
//   groep(id)       kaarten met dezelfde groep mag je samen kiezen (bijvoorbeeld dezelfde waarde)
//   magSpelen(ids)  mogen deze kaarten nu gespeeld worden?
//   onSpeel(ids, { snelheid, element })   de speler veegt kaarten omhoog
//   onPak({ manier })                     de speler tikt ('tik') of veegt ('veeg') op de stapel
//   onReactie(emoji)                      de speler kiest een reactie
//   onSelectie(ids)                       v5: de gekozen kaarten veranderen (tikken)
//   stijl           v5: vaste kaartstijl ('perkament'): altijd die kaarten, geen knop 🎴
//   stapelTekst(n)  v5: eigen tekst onder de stapel (Koningsjacht: 'Taveerne: 32')
//   ondergrond      v5: 'hout' = een houten tafelblad (kaarten/hout.webp) in plaats van paars
//   instellingKnop  v7: false = geen knop ⚙️ (het spel toont KAART_INSTELLINGEN in zijn eigen instellingen)
export const REACTIES = ['😂', '😱', '🔥', '😎', '🙈', '👏']

export function maakKaartTafel(container, opties = {}) {
  zetStijl()
  const o = { groep: id => kaartDelen(id).waarde, magSpelen: () => false, onSpeel() {}, onPak() {}, onReactie() {}, onSelectie() {}, ...opties }
  // v5: een spel met een vaste kaartstijl (o.stijl) tekent altijd die kaarten en achterkant, zonder knop 🎴
  let vast = KAARTSTIJLEN[o.stijl] ? o.stijl : null
  const kaart = id => kaartSvg(id, vast || kaartStijl())
  const rug = () => vast ? achterkantSvg(vast) : achterkantSvg(o.achterkant)
  if (vast) laadVooruit(vast)
  container.innerHTML = ''
  const el = document.createElement('div')
  el.className = 'kt-tafel' + (o.ondergrond === 'hout' ? ' kt-hout' : '')
  el.innerHTML = '<div class="kt-ander"><div class="kt-zetel kt-zetel-ander"><span></span><div class="kt-klok"></div></div>'
    + '<div class="kt-anderinfo"><div class="kt-andernaam"></div><div class="kt-anderaantal"></div></div><div class="kt-anderwaaier"></div><div class="kt-anderknop"></div></div>'
    + '<div class="kt-midden"><div class="kt-info"></div><div class="kt-stapel" role="button" tabindex="0"></div><div class="kt-afleg"></div></div>'
    + '<div class="kt-status" role="status" aria-live="polite"></div>'
    + '<div class="kt-hand"></div>'
    + '<div class="kt-onder"><div class="kt-zetel kt-zetel-ik"><span style="font-size:12px">' + esc(T('Jij')) + '</span><div class="kt-klok"></div></div>'
    + '<span class="kt-knoppen" style="display:contents"></span>'
    + (o.instellingKnop === false ? '' : '<button type="button" class="kt-knop kt-instelknop" aria-label="' + esc(T('Instellingen')) + '" title="' + esc(T('Instellingen')) + '">⚙️</button>')
    + (vast ? '' : '<button type="button" class="kt-knop kt-stijlknop" aria-label="' + esc(T('Kaarten kiezen')) + '" title="' + esc(T('Kaarten kiezen')) + '">🎴</button>')
    + '<span style="position:relative"><button type="button" class="kt-knop kt-sorteer" aria-label="' + esc(T('Sorteren')) + '" title="' + esc(T('Sorteren')) + '">⇅</button></span>'
    // reacties (😀) alleen met een vriend: tegen de computer heb je er niets aan (Marcel, 11 nov 2026)
    + (o.solo ? '' : '<span style="position:relative"><button type="button" class="kt-knop kt-reactieknop" aria-label="' + esc(T('Reactie')) + '">😀</button><div class="kt-reacties"></div></span>') + '</div>'
  container.appendChild(el)
  const laag = document.createElement('div'); laag.className = 'kt-laag'; el.appendChild(laag)
  const $ = s => el.querySelector(s)
  const handEl = $('.kt-hand'), stapelEl = $('.kt-stapel'), aflegEl = $('.kt-afleg'), statusEl = $('.kt-status')
  const anderWaaier = $('.kt-anderwaaier'), knoppenEl = $('.kt-knoppen'), infoEl = $('.kt-info')
  $('.kt-zetel-ander span').textContent = String(o.naamAnder || '?').trim().slice(0, 1).toUpperCase()
  $('.kt-andernaam').textContent = o.naamAnder || T('vriend')

  let stand = { hand: [], anderAantal: 0, stapelAantal: 0, afleg: [], mijnBeurt: false, speelbaar: new Set() }
  let volgorde = [], selectie = [], sorteer = 'eigen'
  let maat = { kw: 70, kh: 98, pw: 64 }
  let verborgen = new Set()                 // kaarten die nog onderweg zijn (animatie)
  let anderVerborgen = 0, aflegVerborgen = 0
  let gesleept = null                       // de kaart die je van de stapel veegt
  let loep = null                           // v7: de kaart onder je vinger (schuiven over de waaier)
  let laatsteTik = null                     // v7: voor de dubbeltik
  let laatsteZet = null                     // v7: wat de ander het laatst speelde
  let inst = kaartInstellingen()

  // ── Maten: kaarten zo groot als past ──
  function meet() {
    const b = el.clientWidth || 360, h = el.clientHeight || 640
    const f = inst.groot ? 1.25 : 1             // v7: grote kaarten
    const kw = Math.round(Math.max(54 * f, Math.min(96 * f, b * 0.21 * f, h * 0.125 * f)))
    maat = { kw, kh: Math.round(kw * 1.4), pw: Math.round(kw * 0.92) }
    el.style.setProperty('--kw', kw + 'px'); el.style.setProperty('--pw', maat.pw + 'px')
    handEl.style.height = Math.round(maat.kh * 1.42) + 'px'
    el.style.paddingBottom = o.solo ? '6px' : '62px'   // ruimte voor de chatbalk van chat.html
    el.style.paddingTop = webcamRuimte() ? '0px' : '40px'   // zonder webcamrondjes: ruimte voor de titel en de sluitknop
  }

  // ── Jouw waaier ──
  function plekken(n) {
    const b = handEl.clientWidth || 360
    const ruimte = b - maat.kw * 1.3 - 16          // de schuine buitenste kaarten moeten ook binnen beeld blijven
    const stap = n > 1 ? Math.min(maat.kw * 0.62, ruimte / (n - 1)) : 0
    const graden = Math.min(6, 48 / Math.max(1, n))
    const midden = (n - 1) / 2
    const boven = Math.round(maat.kh * 0.3)
    return Array.from({ length: n }, (_, i) => {
      const t = i - midden
      return { x: b / 2 - maat.kw / 2 + t * stap, y: boven + (midden ? (t * t) / (midden * midden) * 12 : 0), r: t * graden, stap }
    })
  }
  function kaartEl(id) { return handEl.querySelector('.kt-kaart[data-id="' + id + '"]') }
  function legHand() {
    const ids = volgorde
    const p = plekken(ids.length)
    ids.forEach((id, i) => {
      let k = kaartEl(id)
      if (!k) {
        k = document.createElement('div'); k.className = 'kt-kaart'; k.dataset.id = id
        k.innerHTML = kaart(id); k.setAttribute('role', 'button'); k.tabIndex = 0
        k.setAttribute('aria-label', kaartNaam(id))
        koppelKaart(k)
        handEl.appendChild(k)
      }
      k.style.width = maat.kw + 'px'; k.style.height = maat.kh + 'px'
      const gekozen = selectie.includes(id)
      const onder = loep === id                    // v7: de kaart onder je vinger
      const groot = gekozen || onder
      const b = handEl.clientWidth || 360
      const tx = groot ? Math.max(maat.kw * 0.14, Math.min(b - maat.kw * 1.14, p[i].x)) : p[i].x   // een grote kaart blijft binnen beeld
      const ty = p[i].y - (onder ? maat.kh * 0.46 : gekozen ? maat.kh * 0.36 : 0)
      k.dataset.basis = JSON.stringify(p[i])
      if (!k.classList.contains('kt-sleep')) k.style.transform = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + (groot ? 0 : p[i].r) + 'deg) scale(' + (onder ? 1.4 : gekozen ? 1.25 : 1) + ')'
      k.style.zIndex = onder ? 400 : gekozen ? 200 + i : 10 + i
      k.dataset.plek = i
      k.classList.toggle('kt-gekozen', gekozen)
      k.classList.toggle('kt-loep', onder)
      // v7: zonder hulp (⚙️) licht niets op en wordt niets donkerder
      k.classList.toggle('kt-mag', inst.hulp && stand.mijnBeurt && stand.speelbaar.has(id) && !gekozen)
      k.classList.toggle('kt-niet', inst.hulp && stand.mijnBeurt && !stand.speelbaar.has(id) && !gekozen && !onder)
      k.classList.toggle('kt-weg', verborgen.has(id))
      k.setAttribute('aria-pressed', String(gekozen))
    })
    for (const k of [...handEl.querySelectorAll('.kt-kaart')]) if (!ids.includes(k.dataset.id)) k.remove()
    aflegEl.classList.toggle('kt-doel', Boolean(inst.hulp && stand.mijnBeurt && selectie.length && o.magSpelen(selectie.slice())))
  }

  function kies(id) {
    kaartGeluid.tik()
    if (selectie.includes(id)) selectie = selectie.filter(x => x !== id)
    else if (selectie.length && o.groep(selectie[0]) === o.groep(id)) selectie = [...selectie, id]
    else selectie = [id]
    legHand()
    o.onSelectie(selectie.slice())
  }

  // v7: spelen zonder vegen (dubbeltik, tik op de aflegstapel): de kaarten vliegen van je hand naar de aflegstapel
  function speelGroep(groep, k) {
    if (stand.mijnBeurt && groep.length && o.magSpelen(groep)) {
      const r = (kaartEl(groep[0]) || handEl).getBoundingClientRect(), d = aflegEl.getBoundingClientRect()
      const dx = d.left + d.width / 2 - (r.left + r.width / 2), dy = d.top + d.height / 2 - (r.top + r.height / 2), n = Math.hypot(dx, dy) || 1
      o.onSpeel(groep, { snelheid: 1, richting: { x: dx / n, y: dy / n }, element: k || kaartEl(groep[0]) })
      return true
    }
    weiger(k || aflegEl)
    return false
  }
  // v7: welke kaart in je hand ligt onder je vinger? (de bovenste)
  function kaartOnder(x, y) {
    let lijst = []
    try { lijst = document.elementsFromPoint(x, y) } catch (e) {}
    for (const e of lijst) { const k = e.closest && e.closest('.kt-kaart'); if (k && handEl.contains(k)) return k.dataset.id }
    // tussen of naast de kaarten: de dichtstbijzijnde kaart op die hoogte
    const h = handEl.getBoundingClientRect()
    if (y < h.top - maat.kh * 0.6 || y > h.bottom + 10) return null
    let beste = null, afstand = Infinity
    for (const k of handEl.querySelectorAll('.kt-kaart')) {
      const r = k.getBoundingClientRect(), a = Math.abs(r.left + r.width / 2 - x)
      if (a < afstand) { afstand = a; beste = k.dataset.id }
    }
    return beste
  }

  // Tik, veeg omhoog of lang vasthouden en schuiven
  function koppelKaart(k) {
    let start = null, modus = null, lang = null, punten = []
    const id = () => k.dataset.id
    k.addEventListener('pointerdown', e => {
      if (e.button > 0 || start) return
      audio()
      start = { x: e.clientX, y: e.clientY, t: performance.now() }; modus = null; punten = [{ x: e.clientX, y: e.clientY, t: start.t }]
      try { k.setPointerCapture(e.pointerId) } catch (x) {}
      lang = setTimeout(() => { if (!modus) { modus = 'schuif'; k.classList.add('kt-sleep'); tril(10); kaartGeluid.tik() } }, 420)
    })
    k.addEventListener('pointermove', e => {
      if (!start) return
      const dx = e.clientX - start.x, dy = e.clientY - start.y
      punten.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (punten.length > 6) punten.shift()
      if (!modus && Math.hypot(dx, dy) > 9) {
        clearTimeout(lang)
        if (dy < -8 && Math.abs(dy) > Math.abs(dx) * 0.9) { modus = 'omhoog'; k.classList.add('kt-sleep') }
        else modus = 'kijk'   // v7: opzij schuiven = over de waaier kijken
      }
      if (modus === 'kijk') {
        const onder = kaartOnder(e.clientX, e.clientY)
        if (onder !== loep) { loep = onder; legHand(); if (onder) kaartGeluid.tik() }
        return
      }
      const p = JSON.parse(k.dataset.basis || '{}')
      if (modus === 'omhoog') {
        k.style.transform = 'translate(' + (p.x + dx) + 'px,' + (p.y + dy) + 'px) rotate(' + (p.r * Math.max(0, 1 + dy / 120)) + 'deg) scale(' + (1.1 + Math.min(0.2, -dy / 600)) + ')'
      } else if (modus === 'schuif') {
        k.style.transform = 'translate(' + (p.x + dx) + 'px,' + (p.y + dy * 0.3 - 14) + 'px) rotate(0deg) scale(1.12)'
        const nu = volgorde.indexOf(id())
        const naar = Math.max(0, Math.min(volgorde.length - 1, nu + Math.round(dx / Math.max(12, p.stap || 30))))
        if (naar !== nu) {
          volgorde.splice(nu, 1); volgorde.splice(naar, 0, id()); sorteer = 'eigen'
          start.x += (naar - nu) * (p.stap || 30)
          legHand(); kaartGeluid.tik()
        }
      }
    })
    const los = e => {
      if (!start) return
      clearTimeout(lang)
      const dx = e.clientX - start.x, dy = e.clientY - start.y, duur = performance.now() - start.t
      const m = modus; start = null; modus = null
      k.classList.remove('kt-sleep')
      if (m === 'kijk') {   // v7: loslaten na het schuiven = die kaart kiezen
        const gekozen = e.type === 'pointercancel' ? null : (loep || kaartOnder(e.clientX, e.clientY))
        loep = null
        if (gekozen && !selectie.includes(gekozen)) kies(gekozen); else legHand()
        return
      }
      if (e.type === 'pointercancel') { legHand(); return }
      if (!m && duur < 600) {
        // v7: dubbeltik op dezelfde kaart = meteen spelen (de eerste tik koos hem al)
        const nu = performance.now()
        if (laatsteTik && laatsteTik.id === id() && nu - laatsteTik.t < 380) {
          laatsteTik = null
          if (!selectie.includes(id())) kies(id())
          speelGroep(selectie.includes(id()) ? selectie.slice() : [id()], k)
          return
        }
        laatsteTik = { id: id(), t: nu }
        kies(id()); return
      }
      if (m === 'omhoog') {
        const a = punten[0], b = punten[punten.length - 1]
        const vy = (b.y - a.y) / Math.max(1, b.t - a.t), vx = (b.x - a.x) / Math.max(1, b.t - a.t)
        if (dy < -maat.kh * 0.5 || vy < -0.55) {
          const groep = selectie.includes(id()) ? selectie.slice() : [id()]
          if (groep[0] !== id()) { groep.splice(groep.indexOf(id()), 1); groep.unshift(id()) }
          if (stand.mijnBeurt && o.magSpelen(groep)) {
            o.onSpeel(groep, { snelheid: Math.min(3, Math.hypot(vx, vy)), richting: { x: vx, y: vy }, element: k })
            return
          }
          weiger(k)
        }
      }
      legHand()
    }
    k.addEventListener('pointerup', los)
    k.addEventListener('pointercancel', los)
    k.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kies(id()) }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const groep = selectie.includes(id()) ? selectie.slice() : [id()]
        if (stand.mijnBeurt && o.magSpelen(groep)) o.onSpeel(groep, { snelheid: 1, richting: { x: 0, y: -1 }, element: k })
        else weiger(k)
      }
    })
  }
  function weiger(k) {
    kaartGeluid.nee(); tril([20, 40, 20])
    try { k.animate([{ translate: '0 0' }, { translate: '-8px 0' }, { translate: '8px 0' }, { translate: '0 0' }], { duration: 260 }) } catch (e) {}
  }

  // ── De stapel: tik of veeg ──
  ;(function koppelStapel() {
    let start = null, punten = []
    stapelEl.addEventListener('pointerdown', e => {
      if (e.button > 0) return
      audio()
      start = { x: e.clientX, y: e.clientY }; punten = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
      try { stapelEl.setPointerCapture(e.pointerId) } catch (x) {}
    })
    stapelEl.addEventListener('pointermove', e => {
      if (!start) return
      punten.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (punten.length > 6) punten.shift()
      const dx = e.clientX - start.x, dy = e.clientY - start.y
      if (!gesleept && Math.hypot(dx, dy) > 16 && stand.mijnBeurt && stand.stapelAantal) {
        const r = stapelEl.getBoundingClientRect()
        gesleept = vliegEl(rug(), null, r)
        gesleept.dataset.van = JSON.stringify({ x: r.left, y: r.top })
        kaartGeluid.veeg()
      }
      if (gesleept) {
        const van = JSON.parse(gesleept.dataset.van)
        gesleept.style.transform = 'translate(' + (van.x + dx) + 'px,' + (van.y + dy) + 'px) rotate(' + (dx / 6) + 'deg) scale(1.08)'
      }
    })
    const los = e => {
      if (!start) return
      start = null
      if (e.type === 'pointercancel') { if (gesleept) { gesleept.remove(); gesleept = null } return }
      if (!stand.mijnBeurt) { weiger(stapelEl); return }
      if (gesleept) {
        const a = punten[0], b = punten[punten.length - 1]
        gesleept.dataset.snelheid = String(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t))
        o.onPak({ manier: 'veeg' })
        setTimeout(() => { if (gesleept) { gesleept.remove(); gesleept = null } }, 50)   // niet gebruikt? weg ermee
      } else o.onPak({ manier: 'tik' })
    }
    stapelEl.addEventListener('pointerup', los)
    stapelEl.addEventListener('pointercancel', los)
    stapelEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (stand.mijnBeurt) o.onPak({ manier: 'tik' }) } })
  })()

  // ── v7: tik op de aflegstapel. Met een gekozen kaart: leg hem daar neer. Zonder: de laatste zet van de ander groot ──
  aflegEl.setAttribute('role', 'button'); aflegEl.tabIndex = 0
  const tikAfleg = () => {
    audio()
    if (selectie.length) { speelGroep(selectie.slice(), kaartEl(selectie[0])); return }
    toonLaatsteZet()
  }
  aflegEl.addEventListener('click', tikAfleg)
  aflegEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tikAfleg() } })
  function toonLaatsteZet() {
    const zicht = stand.afleg.slice(0, Math.max(0, stand.afleg.length - aflegVerborgen))
    const ids = laatsteZet && laatsteZet.length ? laatsteZet : zicht.slice(-1)
    if (!ids.length) return
    kaartGeluid.tik()
    el.querySelector('.kt-laatstekeus')?.remove()
    const d = document.createElement('div'); d.className = 'kt-keuze kt-laatstekeus'
    const titel = laatsteZet && laatsteZet.length ? T('Laatste zet van {naam}', { naam: o.naamAnder || T('vriend') }) : T('Bovenop de aflegstapel')
    d.innerHTML = '<div class="kt-keuzekaart"><div style="font-weight:800;font-size:17px">' + esc(titel) + '</div><div class="kt-laatste"></div>'
      + '<button type="button" class="kt-knop" style="margin-top:12px">' + esc(T('Sluiten')) + '</button></div>'
    for (const id of ids.slice(-4)) { const c = document.createElement('div'); c.dataset.id = id; c.innerHTML = kaart(id); c.setAttribute('aria-label', kaartNaam(id)); d.querySelector('.kt-laatste').appendChild(c) }
    d.querySelector('.kt-keuzekaart > .kt-knop').onclick = () => d.remove()
    d.addEventListener('click', e => { if (e.target === d) d.remove() })
    el.appendChild(d)
  }

  // ── v7: instellingen (⚙️): hulp, grote kaarten, trillen ──
  function toonInstellingen() {
    el.querySelector('.kt-instelkeus')?.remove()
    const d = document.createElement('div'); d.className = 'kt-keuze kt-instelkeus'
    d.innerHTML = '<div class="kt-keuzekaart"><div style="font-weight:800;font-size:17px">' + esc(T('Instellingen')) + '</div><div class="kt-instelrij"></div>'
      + '<button type="button" class="kt-knop" style="margin-top:12px">' + esc(T('Sluiten')) + '</button></div>'
    for (const i of KAART_INSTELLINGEN) {
      const l = document.createElement('label'); l.className = 'kt-instelling'
      l.innerHTML = '<span><b>' + esc(T(i.titel)) + '</b><small>' + esc(T(i.uitleg)) + '</small></span><input type="checkbox" data-kaartinstelling="' + i.sleutel + '">'
      const inp = l.querySelector('input'); inp.checked = inst[i.sleutel]
      inp.addEventListener('change', () => { kaartGeluid.tik(); zetKaartInstelling(i.sleutel, inp.checked) })
      d.querySelector('.kt-instelrij').appendChild(l)
    }
    d.querySelector('.kt-keuzekaart > .kt-knop').onclick = () => d.remove()
    d.addEventListener('click', e => { if (e.target === d) d.remove() })
    el.appendChild(d)
  }
  if (o.instellingKnop !== false) $('.kt-instelknop').onclick = () => { audio(); toonInstellingen() }
  const nieuweInstellingen = () => { inst = kaartInstellingen(); meet(); legRest(); legHand() }
  window.addEventListener('fibro-kaarttafel', nieuweInstellingen)

  // ── Kaartstijl kiezen (🎴): de kaarten op tafel veranderen meteen mee ──
  function kiesKaartStijl() {
    el.querySelector('.kt-stijlkeus')?.remove()
    const d = document.createElement('div'); d.className = 'kt-keuze kt-stijlkeus'
    d.innerHTML = '<div class="kt-keuzekaart"><div style="font-weight:800;font-size:17px">' + esc(T('Kies je kaarten')) + '</div><div class="kt-stijlrij"></div>'
      + '<button type="button" class="kt-knop" style="margin-top:12px">' + esc(T('Sluiten')) + '</button></div>'
    const nu = kaartStijl()
    for (const [id, s] of Object.entries(KAARTSTIJLEN)) {
      if (s.verborgen) continue
      const b = document.createElement('button'); b.type = 'button'; b.className = 'kt-stijlkeuze'; b.dataset.stijl = id
      b.setAttribute('aria-pressed', String(id === nu))
      b.innerHTML = '<span class="kt-stijlvoorbeeld"><div>' + (s.map ? plaatje(id, 'achterkant') : achterkantSvg('stekky')) + '</div><div>' + kaartSvg('hH', id) + '</div></span>'
        + '<span>' + esc(id === 'stekky' ? s.naam : T(s.naam)) + '</span>'
      b.onclick = () => { kaartGeluid.tik(); zetKaartStijl(id); d.remove() }
      d.querySelector('.kt-stijlrij').appendChild(b)
    }
    d.querySelector('.kt-keuzekaart > .kt-knop').onclick = () => d.remove()
    d.addEventListener('click', e => { if (e.target === d) d.remove() })
    el.appendChild(d)
  }
  if (!vast) $('.kt-stijlknop').onclick = () => { audio(); kiesKaartStijl() }
  function nieuweStijl() {
    for (const k of handEl.querySelectorAll('.kt-kaart')) k.innerHTML = kaart(k.dataset.id)
    anderWaaier.innerHTML = ''; stapelEl.innerHTML = ''
    legRest()
  }
  // Een spel mag zijn vaste kaartstijl lokaal wijzigen zonder voorkeuren van andere
  // spellen of de spelstand aan te passen. Selectie en kaartvolgorde blijven intact.
  function zetTafelKaartStijl(stijl) {
    if (!vast || !KAARTSTIJLEN[stijl] || stijl === vast) return
    vast = stijl; laadVooruit(stijl); nieuweStijl()
  }
  window.addEventListener('fibro-kaartstijl', nieuweStijl)

  // ── Sorteren en reacties ──
  $('.kt-sorteer').onclick = () => {
    sorteer = sorteer === 'kleur' ? 'waarde' : 'kleur'
    volgorde.sort(SORTEER[sorteer]); kaartGeluid.schud(); legHand()
    toonStatusTip(sorteer === 'kleur' ? T('Gesorteerd op kleur') : T('Gesorteerd op waarde'))
  }
  const reactieRij = $('.kt-reacties')
  if (reactieRij) for (const r of REACTIES) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = r
    b.onclick = () => { reactieRij.classList.remove('kt-open'); o.onReactie(r); reactie(r, 'ik') }
    reactieRij.appendChild(b)
  }
  if (reactieRij) $('.kt-reactieknop').onclick = () => reactieRij.classList.toggle('kt-open')

  let tipTimer = null, statusTekst = ''
  function toonStatusTip(t) { clearTimeout(tipTimer); statusEl.textContent = t; tipTimer = setTimeout(() => { statusEl.textContent = statusTekst }, 1400) }

  // ── Tekenen van alles behalve je hand ──
  function legRest() {
    const n = Math.max(0, stand.anderAantal - anderVerborgen)
    $('.kt-anderaantal').textContent = n === 1 ? T('1 kaart') : T('{n} kaarten', { n })
    const minis = Math.min(n, 12)
    if (anderWaaier.children.length !== minis) {
      anderWaaier.innerHTML = ''
      for (let i = 0; i < minis; i++) {
        const m = document.createElement('div'); m.className = 'kt-mini'; m.innerHTML = rug()
        const t = i - (minis - 1) / 2
        m.style.transform = 'translateX(' + (t * 5) + 'px) rotate(' + (t * 7) + 'deg)'
        anderWaaier.appendChild(m)
      }
    }
    const st = Math.min(5, Math.ceil(stand.stapelAantal / 8))
    if (stapelEl.querySelectorAll('.kt-st').length !== Math.max(1, st) || !stapelEl.querySelector('.kt-teller')) {
      stapelEl.innerHTML = ''
      for (let i = 0; i < Math.max(1, st); i++) {
        const d = document.createElement('div'); d.className = 'kt-st'; d.innerHTML = rug()
        d.style.transform = 'translate(' + (-i * 1.5) + 'px,' + (-i * 2) + 'px)'
        stapelEl.appendChild(d)
      }
      const t = document.createElement('div'); t.className = 'kt-teller'; stapelEl.appendChild(t)
    }
    stapelEl.querySelector('.kt-teller').textContent = o.stapelTekst ? o.stapelTekst(stand.stapelAantal) : T('{n} op de stapel', { n: stand.stapelAantal })
    stapelEl.classList.toggle('kt-leeg', !stand.stapelAantal)
    stapelEl.classList.toggle('kt-wijs', inst.hulp && stand.mijnBeurt && !stand.speelbaar.size && stand.stapelAantal > 0)
    stapelEl.setAttribute('aria-label', T('Stapel: tik om een kaart te pakken'))
    const zicht = stand.afleg.slice(0, Math.max(0, stand.afleg.length - aflegVerborgen)).slice(-4)
    aflegEl.innerHTML = ''
    zicht.forEach((id, i) => {
      const d = document.createElement('div'); d.className = 'kt-ak'; d.dataset.id = id; d.innerHTML = kaart(id)
      d.style.transform = 'rotate(' + draaiVan(id, stand.afleg.length - zicht.length + i) + 'deg)'
      aflegEl.appendChild(d)
    })
    const top = zicht[zicht.length - 1]
    aflegEl.setAttribute('aria-label', top ? T('Bovenste kaart: {kaart}', { kaart: kaartNaam(top) }) : T('Aflegstapel'))
  }

  // ── Wat de tafel laat zien. stand = { hand, anderAantal, stapelAantal, afleg, mijnBeurt, speelbaar (ids), status } ──
  function toonStand(s) {
    stand = { ...stand, ...s, speelbaar: new Set(s.speelbaar || []) }
    const hand = stand.hand
    const nieuw = hand.filter(id => !volgorde.includes(id))
    volgorde = volgorde.filter(id => hand.includes(id))
    if (sorteer === 'eigen') volgorde.push(...nieuw)
    else { volgorde.push(...nieuw); volgorde.sort(SORTEER[sorteer]) }
    selectie = selectie.filter(id => hand.includes(id))
    if (typeof s.status === 'string') { statusTekst = s.status; statusEl.textContent = s.status }
    el.classList.toggle('kt-mijnbeurt', stand.mijnBeurt)   // voor de tests: jij kunt nu iets doen
    meet(); legRest(); legHand()
  }

  // ── Vliegende kaarten ──
  function vliegEl(voor, achter, r) {
    const v = document.createElement('div'); v.className = 'kt-vlieg'
    v.style.width = r.width + 'px'; v.style.height = r.height + 'px'
    v.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)'
    v.innerHTML = '<div class="kt-v">' + voor + '</div>' + (achter ? '<div class="kt-v kt-achter">' + achter + '</div>' : '')
    laag.appendChild(v)
    return v
  }
  const midden = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  // Van rechthoek a naar rechthoek b. omdraaien: de achterkant draait naar de voorkant (of andersom).
  function vlieg({ voor, achter, van, naar, duur = 420, draai = 0, eindDraai = 0, boog = 0, omdraaien = false, tollen = 0, overschiet = null, element = null }) {
    if (rustig()) duur = Math.min(duur, 160)
    const v = element || vliegEl(omdraaien ? achter : voor, omdraaien ? voor : achter, van)
    if (element && !v.querySelector('.kt-achter') && voor) { v.innerHTML = '<div class="kt-v kt-achter">' + voor + '</div>' + v.innerHTML }
    v.style.width = van.width + 'px'; v.style.height = van.height + 'px'
    const sx = naar.width / van.width
    const a = midden(van), b = midden(naar)
    const T0 = 'translate(' + van.left + 'px,' + van.top + 'px)'
    const pos = (x, y) => 'translate(' + (x - van.width / 2) + 'px,' + (y - van.height / 2) + 'px)'
    const flip = d => omdraaien ? ' rotateY(' + d + 'deg)' : ''
    const frames = [{ transform: (element ? v.style.transform : T0 + ' rotate(' + draai + 'deg)') + flip(0), offset: 0 }]
    if (boog) frames.push({ transform: pos((a.x + b.x) / 2, Math.min(a.y, b.y) - boog) + ' rotate(' + ((draai + eindDraai) / 2 + tollen / 2) + 'deg) scale(' + (1 + sx) / 1.8 + ')' + flip(90), offset: 0.5 })
    if (overschiet) frames.push({ transform: pos(b.x + overschiet.x, b.y + overschiet.y) + ' rotate(' + (eindDraai + overschiet.r) + 'deg) scale(' + sx + ')' + flip(180), offset: 0.72 })
    frames.push({ transform: pos(b.x, b.y) + ' rotate(' + (eindDraai + tollen) + 'deg) scale(' + sx + ')' + flip(180), offset: 1 })
    let anim
    try { anim = v.animate(frames, { duration: duur, easing: overschiet ? 'cubic-bezier(.15,.7,.25,1)' : 'cubic-bezier(.3,.6,.25,1)', fill: 'forwards' }) } catch (e) { anim = null }
    return new Promise(klaar => {
      const weg = () => { v.remove(); klaar() }
      if (anim) { anim.onfinish = weg; anim.oncancel = weg } else setTimeout(weg, 10)
    })
  }

  const aflegRect = () => aflegEl.getBoundingClientRect()
  const stapelRect = () => { const st = stapelEl.querySelectorAll('.kt-st'); return (st[st.length - 1] || stapelEl).getBoundingClientRect() }
  const anderRect = () => anderWaaier.getBoundingClientRect()
  function kaartRechthoek(id) {
    const k = kaartEl(id)
    if (!k) return null
    const r = k.getBoundingClientRect()
    return { left: r.left + r.width / 2 - maat.kw / 2, top: r.top + r.height / 2 - maat.kh / 2, width: maat.kw, height: maat.kh }
  }

  // Jij speelt kaarten: ze vliegen naar de aflegstapel. Hoe harder geveegd, hoe verder ze doorglijden.
  async function speelAnimatie(ids, { snelheid = 1, richting = { x: 0, y: -1 }, vanRects } = {}) {
    aflegVerborgen = ids.length; legRest()
    const doel = aflegRect()
    const n = Math.hypot(richting.x, richting.y) || 1
    const ver = Math.min(90, 20 + snelheid * 35)
    const tochten = ids.map((id, i) => wacht(i * 90).then(() => {
      const van = vanRects?.[i] || doel
      kaartGeluid.veeg()
      return vlieg({ voor: kaart(id), van, naar: doel, duur: Math.max(260, 520 - snelheid * 90), draai: 0,
        eindDraai: draaiVan(id, stand.afleg.length - ids.length + i), tollen: (richting.x / n) * snelheid * 40,
        overschiet: { x: (richting.x / n) * ver, y: (richting.y / n) * ver * 0.6, r: (richting.x >= 0 ? 1 : -1) * snelheid * 12 } })
        .then(() => { aflegVerborgen--; legRest(); kaartGeluid.leg(snelheid); tril(8) })
    }))
    await Promise.all(tochten)
    aflegVerborgen = 0; legRest()
  }

  // De ander speelt kaarten: van zijn waaier, omdraaien, op de aflegstapel
  async function anderSpeeltAnimatie(ids) {
    laatsteZet = ids.slice()   // v7: tik op de aflegstapel = deze kaarten groot
    aflegVerborgen = ids.length; legRest()
    const van = anderRect(), doel = aflegRect()
    const start = { left: van.left + van.width / 2 - doel.width * 0.4, top: van.top, width: doel.width * 0.8, height: doel.height * 0.8 }
    for (let i = 0; i < ids.length; i++) {
      kaartGeluid.veeg()
      await vlieg({ voor: kaart(ids[i]), achter: rug(), van: start, naar: doel, duur: 480, omdraaien: true, boog: 30,
        eindDraai: draaiVan(ids[i], stand.afleg.length - ids.length + i) })
      aflegVerborgen--; legRest(); kaartGeluid.leg(0.5)
    }
    aflegVerborgen = 0; legRest()
  }

  // Jij pakt kaarten. manier 'tik': springt op, draait om, boog naar je hand. 'veeg': vanaf je vinger, tollend.
  async function pakAnimatie(ids, { manier = 'tik' } = {}) {
    verborgen = new Set(ids); legHand()
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const naar = kaartRechthoek(id) || aflegRect()
      if (manier === 'veeg' && gesleept && i === 0) {
        const el2 = gesleept; gesleept = null
        const sn = parseFloat(el2.dataset.snelheid || '1')
        const r = el2.getBoundingClientRect()
        const van = { left: r.left, top: r.top, width: stapelRect().width, height: stapelRect().height }
        kaartGeluid.pak()
        await vlieg({ element: el2, voor: kaart(id), van, naar, duur: 520, omdraaien: true, tollen: 360 * (sn > 1.2 ? 2 : 1) })
      } else {
        const van = stapelRect()
        kaartGeluid.pak()
        await vlieg({ voor: kaart(id), achter: rug(), van, naar, duur: ids.length > 2 ? 360 : 560, omdraaien: true, boog: ids.length > 2 ? 40 : 90, eindDraai: 0 })
      }
      verborgen.delete(id); legHand(); tril(6)
    }
    verborgen.clear(); legHand()
  }

  // De ander pakt kaarten
  async function anderPaktAnimatie(n) {
    anderVerborgen = n; legRest()
    for (let i = 0; i < n; i++) {
      const doel = anderRect()
      const naar = { left: doel.left + doel.width / 2 - 17, top: doel.top + 4, width: 34, height: 48 }
      kaartGeluid.pak()
      await vlieg({ voor: rug(), van: stapelRect(), naar, duur: n > 2 ? 280 : 420, boog: 30 })
      anderVerborgen--; legRest()
    }
    anderVerborgen = 0; legRest()
  }

  // Schudden: twee halve stapels gaan uit elkaar en ritselen weer samen (3 keer)
  async function schudAnimatie() {
    const r = stapelRect()
    kaartGeluid.schud()
    if (rustig()) { await wacht(200); return }
    const helften = [-1, 1].map(kant => {
      const v = vliegEl(rug(), null, r)
      const frames = []
      for (let i = 0; i < 3; i++) frames.push({ transform: 'translate(' + r.left + 'px,' + r.top + 'px)' }, { transform: 'translate(' + (r.left + kant * r.width * 0.65) + 'px,' + (r.top - 10) + 'px) rotate(' + kant * 14 + 'deg)' })
      frames.push({ transform: 'translate(' + r.left + 'px,' + r.top + 'px)' })
      return new Promise(k => { const a = v.animate(frames, { duration: 900, easing: 'ease-in-out' }); a.onfinish = () => { v.remove(); k() }; a.oncancel = () => { v.remove(); k() } })
    })
    await Promise.all(helften)
  }

  // Delen: om en om een kaart naar jou en de ander, daarna de open kaart
  async function deelAnimatie({ mijnKaarten, anderAantal, open }) {
    verborgen = new Set(mijnKaarten); anderVerborgen = anderAantal; aflegVerborgen = open ? 1 : 0
    legHand(); legRest()
    await schudAnimatie()
    const snel = rustig()
    for (let i = 0; i < Math.max(mijnKaarten.length, anderAantal); i++) {
      if (i < anderAantal) {
        const d = anderRect()
        vlieg({ voor: rug(), van: stapelRect(), naar: { left: d.left + d.width / 2 - 17, top: d.top + 4, width: 34, height: 48 }, duur: 300 })
          .then(() => { anderVerborgen--; legRest() })
        kaartGeluid.deel()
        if (!snel) await wacht(80)
      }
      if (i < mijnKaarten.length) {
        const id = mijnKaarten[i]
        vlieg({ voor: kaart(id), achter: rug(), van: stapelRect(), naar: kaartRechthoek(id) || aflegRect(), duur: 340, omdraaien: true })
          .then(() => { verborgen.delete(id); legHand() })
        kaartGeluid.deel()
        if (!snel) await wacht(80)
      }
    }
    await wacht(360)
    if (open) {
      await vlieg({ voor: kaart(open), achter: rug(), van: stapelRect(), naar: aflegRect(), duur: 420, omdraaien: true, boog: 20, eindDraai: draaiVan(open, 0) })
      kaartGeluid.leg(0.3)
    }
    verborgen.clear(); anderVerborgen = 0; aflegVerborgen = 0; legHand(); legRest()
  }

  // ── Beurtklok: de ring rond wie aan de beurt is loopt leeg (alleen om te zien; er gebeurt niets bij nul) ──
  let klok = null
  const klokken = () => {
    const lijst = { ik: [$('.kt-zetel-ik .kt-klok')], ander: [$('.kt-zetel-ander .kt-klok')] }
    for (const [wie, vakId] of [['ik', 'spelVideoEigen'], ['ander', 'spelVideoAnder']]) {
      const vak = document.getElementById(vakId)
      if (!vak || !el.isConnected) continue
      let ring = vak.querySelector(':scope > .kt-klok')
      if (!ring) { ring = document.createElement('div'); ring.className = 'kt-klok'; vak.appendChild(ring) }
      lijst[wie].push(ring)
    }
    return lijst
  }
  function beurtKlok(wie, seconden = 30) {
    clearInterval(klok?.timer)
    const lijst = klokken()
    for (const r of [...lijst.ik, ...lijst.ander]) r.classList.remove('kt-aan', 'kt-bijna')
    if (!wie) { klok = null; return }
    const ringen = lijst[wie], begin = performance.now()
    const stap = () => {
      const rest = Math.max(0, 1 - (performance.now() - begin) / (seconden * 1000))
      for (const r of ringen) { r.style.setProperty('--kt-rest', rest.toFixed(3)); r.classList.add('kt-aan'); r.classList.toggle('kt-bijna', rest < 0.2) }
      if (rest <= 0) clearInterval(klok.timer)
    }
    klok = { timer: setInterval(stap, 200) }
    stap()
  }

  // ── Effecten ──
  function effect(tekst, { gloed = true, geluid = true } = {}) {
    if (geluid) kaartGeluid.speciaal()
    tril([15, 30, 15])
    const top = aflegEl.lastElementChild
    if (gloed && top) { top.classList.remove('kt-gloed'); void top.offsetWidth; top.classList.add('kt-gloed') }
    const e = document.createElement('div'); e.className = 'kt-effect'; e.textContent = tekst
    const r = aflegRect(); e.style.top = (r.top - 10) + 'px'; e.style.left = (r.left + r.width / 2) + 'px'
    laag.appendChild(e)
    try {
      const a = e.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-80%) scale(1.15)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-140%) scale(.9)', opacity: 0 }], { duration: rustig() ? 900 : 1500, easing: 'ease-out' })
      a.onfinish = () => e.remove()
    } catch (x) { setTimeout(() => e.remove(), 1200) }
  }
  function reactie(emoji, van = 'ander') {
    if (!REACTIES.includes(emoji)) return
    kaartGeluid.pop()
    const bron = (van === 'ik' ? $('.kt-zetel-ik') : $('.kt-zetel-ander')).getBoundingClientRect()
    const doel = aflegRect()
    const e = document.createElement('div'); e.className = 'kt-reactie'; e.textContent = emoji
    e.style.left = '0px'; e.style.top = '0px'
    laag.appendChild(e)
    const x0 = bron.left + bron.width / 2 - 27, y0 = bron.top + bron.height / 2 - 30
    const x1 = doel.left + doel.width / 2 - 27 + (van === 'ik' ? -40 : 40), y1 = doel.top + doel.height / 2 - 30
    try {
      const a = e.animate([{ transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(.4)', opacity: 0.4 },
        { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(1.5) rotate(' + (van === 'ik' ? -12 : 12) + 'deg)', opacity: 1, offset: 0.45 },
        { transform: 'translate(' + x1 + 'px,' + (y1 - 20) + 'px) scale(1.3)', opacity: 1, offset: 0.8 },
        { transform: 'translate(' + x1 + 'px,' + (y1 - 60) + 'px) scale(1)', opacity: 0 }], { duration: rustig() ? 900 : 1800, easing: 'ease-out' })
      a.onfinish = () => e.remove()
    } catch (x) { setTimeout(() => e.remove(), 1500) }
  }

  // Knoppen van het spel zelf: [{ tekst, opKlik, nadruk, schud, uit }]
  function knoppen(lijst) {
    knoppenEl.innerHTML = ''
    for (const k of lijst || []) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'kt-knop' + (k.nadruk ? ' kt-nadruk' : '') + (k.schud ? ' kt-schud' : '')
      b.textContent = k.tekst; b.disabled = Boolean(k.uit); if (k.naam) b.dataset.naam = k.naam
      b.onclick = () => { audio(); k.opKlik?.() }
      knoppenEl.appendChild(b)
    }
  }
  function anderKnop(k) {
    const plek = $('.kt-anderknop'); plek.innerHTML = ''
    if (!k) return
    const b = document.createElement('button'); b.type = 'button'; b.className = 'kt-knop kt-nadruk kt-schud'; b.textContent = k.tekst
    if (k.naam) b.dataset.naam = k.naam
    b.onclick = () => { audio(); k.opKlik?.() }
    plek.appendChild(b)
  }
  function info(html) { infoEl.innerHTML = html || '' }

  // Een vraag met knoppen midden op tafel (bijvoorbeeld: welke kleur na een boer?)
  function kiesUit(titel, keuzes) {
    return new Promise(klaar => {
      const d = document.createElement('div'); d.className = 'kt-keuze'
      d.innerHTML = '<div class="kt-keuzekaart"><div style="font-weight:800;font-size:17px">' + esc(titel) + '</div><div class="kt-keuzerij"></div></div>'
      for (const k of keuzes) {
        const b = document.createElement('button'); b.type = 'button'; b.innerHTML = k.html; b.setAttribute('aria-label', k.label || '')
        if (k.kleur) b.style.color = k.kleur
        b.onclick = () => { kaartGeluid.tik(); d.remove(); klaar(k.waarde) }
        d.querySelector('.kt-keuzerij').appendChild(b)
      }
      el.appendChild(d)
    })
  }

  function einde({ titel, sub, gewonnen, opnieuw }) {
    el.querySelector('.kt-einde')?.remove()
    beurtKlok(null)
    if (gewonnen) { kaartGeluid.win(); tril([30, 50, 30, 50, 60]) } else kaartGeluid.verlies()
    const d = document.createElement('div'); d.className = 'kt-einde'
    d.innerHTML = '<div class="kt-eindekaart"><div class="kt-eindetitel"></div><div class="kt-eindesub"></div><button type="button" class="kt-knop kt-nadruk kt-opnieuw"></button></div>'
    d.querySelector('.kt-eindetitel').textContent = titel
    d.querySelector('.kt-eindesub').textContent = sub || ''
    const b = d.querySelector('.kt-opnieuw'); b.textContent = T('↻ Opnieuw spelen')
    b.onclick = () => { d.remove(); opnieuw?.() }
    el.appendChild(d)
    if (gewonnen && !rustig()) for (let i = 0; i < 14; i++) setTimeout(() => {
      const r = el.getBoundingClientRect()
      const id = ['hA', 'sA', 'rA', 'kA', 'J1', 'J2'][i % 6]
      const w = 46, x = r.left + Math.random() * (r.width - w)
      vlieg({ voor: kaart(id), van: { left: x, top: r.top - 70, width: w, height: w * 1.4 }, naar: { left: x + (Math.random() - 0.5) * 120, top: r.bottom + 20, width: w, height: w * 1.4 }, duur: 1600, tollen: (Math.random() - 0.5) * 720 })
    }, i * 90)
  }
  function sluitEinde() { el.querySelector('.kt-einde')?.remove() }

  // Opnieuw schalen als het scherm of de webcamrondjes veranderen; opruimen als het spel dicht gaat
  const opnieuw = () => { meet(); legRest(); legHand() }
  window.addEventListener('resize', opnieuw)
  window.addEventListener('fibro-chess-video-state', () => setTimeout(opnieuw, 40))
  const wachter = setInterval(() => {
    if (el.isConnected) return
    clearInterval(wachter); clearInterval(klok?.timer)
    window.removeEventListener('resize', opnieuw)
    window.removeEventListener('fibro-kaartstijl', nieuweStijl)
    window.removeEventListener('fibro-kaarttafel', nieuweInstellingen)
    for (const r of document.querySelectorAll('.spel-video-vak > .kt-klok')) r.remove()
  }, 1000)
  meet()

  return {
    element: el, toon: toonStand, kaartRechthoek, selectie: () => selectie.slice(), wisSelectie() { selectie = []; legHand(); o.onSelectie([]) },
    speelAnimatie, anderSpeeltAnimatie, pakAnimatie, anderPaktAnimatie, deelAnimatie, schudAnimatie,
    beurtKlok, effect, reactie, knoppen, anderKnop, info, kiesUit, einde, sluitEinde, zetKaartStijl: zetTafelKaartStijl,
    laatsteZet(ids) { laatsteZet = Array.isArray(ids) ? ids.slice() : null }, instellingen: () => ({ ...inst }), openInstellingen: () => toonInstellingen(),
    status(t) { statusTekst = t; statusEl.textContent = t }, webcamRuimte, geluid: kaartGeluid, tril,
  }
}
