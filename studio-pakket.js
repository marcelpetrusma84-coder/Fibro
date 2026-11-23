// studio-pakket.js (23 nov 2026, Stekky Studio stap 1) - het pakketbestand van een stickervel: maken, nakijken en
// voorstellen doen voor beweging en geluid. Geen scherm en geen stickerfx.js nodig, zodat het ook in de tests en in het
// installatie-script (tests/tools/studio-installeer.mjs) draait. studio-ui.js gebruikt het.
//
// Een pakketbestand (naam.stekkypakket.json) is gewoon tekst:
//   { formaat: 'stekky-stickerpakket', versie: 1, id: 'stickers-<naam>', titel, uitleg: [nl, en],
//     stickers: [ { naam: [nl, en], b: beweging, g: geluid, webp: <het plaatje als base64>,
//                   mp3: <eigen geluid als base64, mag ontbreken>, bron: <waar dat geluid vandaan komt>,
//                   licentie: <zelf | cc0 | cc-by | betaald> } x 12 ] }
// Heeft een sticker een eigen geluid (mp3), dan klinkt dat; het geluid uit de bibliotheek (g) is dan de terugval.
// Het wordt daarna (door tests/tools/studio-installeer.mjs) een vel in stickers/<fN>/ en een regel in studio-pakketten.js.

export const FORMAAT = 'stekky-stickerpakket'
export const AANTAL = 12                      // een pakket heeft precies 12 stickers, zoals alle vellen in de app
export const MAX_PLAATJE = 150 * 1024         // een plaatje van meer dan 150 kB is te zwaar voor de chat
export const MAX_MP3 = 40 * 1024              // een eigen geluid (hoogstens 3 seconden, 64 kbps = ongeveer 24 kB)
export const MAX_BRON = 120
// De licenties waaruit je kiest bij een eigen geluid. Bewust zonder "niet-commercieel" (NC) en "geen bewerkingen" (ND): met
// NC mag het niet in een betaald product, met ND mag de Studio het niet inkorten en even hard maken. 'vermelding': komt de bron
// in de Store te staan? (Bij CC BY moet het; bij CC0 mag het als dank.)
export const LICENTIES = {
  zelf: { naam: 'Zelf gemaakt of opgenomen', vermelding: false, uitleg: 'Je hoeft niets te vermelden. Zet bij Bron bijvoorbeeld "zelf opgenomen".' },
  cc0: { naam: 'CC0 (vrij te gebruiken)', vermelding: true, uitleg: 'Vrij te gebruiken, ook commercieel. Zet bij Bron waar je het vond; dat komt als dank in de Store.' },
  'cc-by': { naam: 'CC BY (de maker moet genoemd worden)', vermelding: true, uitleg: 'Commercieel mag, mits de maker genoemd wordt. Zet bij Bron de naam van de maker en de site; dat komt in de Store te staan.' },
  betaald: { naam: 'Gekocht of via een betaald abonnement', vermelding: false, uitleg: 'Alleen als de voorwaarden commercieel gebruik toestaan, ook als losse geluidsbestanden in een app. Bewaar de voorwaarden.' },
}
export const ID_PATROON = /^stickers-[a-z0-9]+(?:-[a-z0-9]+)*$/

// Beweging en geluid die de Studio zelf voorstelt (de volgorde is de volgorde van de stickers). Allemaal bestaande
// namen uit stickerfx.js; je kunt ze op de pagina veranderen.
export const VOORSTEL_BEWEGING = ['stuiter', 'hup', 'wiebel', 'groei', 'zweef', 'kantel', 'knik', 'schud', 'draai', 'oplichten', 'hartslag', 'duw']
export const VOORSTEL_GELUID = ['pop', 'boing', 'pling', 'ting', 'popcorn', 'sprong', 'tadaa', 'bling', 'yes', 'woesj', 'pieuw', 'ooh']
export const voorstelFx = i => ({ b: VOORSTEL_BEWEGING[i % VOORSTEL_BEWEGING.length], g: VOORSTEL_GELUID[i % VOORSTEL_GELUID.length] })

// 'Zomer-stickers!' -> 'zomer-stickers' (voor de bestandsnaam en het id in de Store)
export function maakSlug(tekst) {
  return String(tekst || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/g, '')
}
export const storeId = titel => 'stickers-' + maakSlug(titel)

// De namen van de bewegingen en geluiden uit de tekst van stickerfx.js (voor de plekken zonder browser)
export function fxNamenUitBron(bron) {
  const i = bron.indexOf('export const BEWEGINGEN'), j = bron.indexOf('export const GELUIDEN'), k = bron.indexOf('export function speelBeweging')
  if (i < 0 || j < i || k < j) throw new Error('stickerfx.js heeft een andere indeling dan verwacht')
  const namen = deel => new Set([...deel.matchAll(/^  (\w+):\s+\{ naam:/gm)].map(m => m[1]))
  return { bewegingen: namen(bron.slice(i, j)), geluiden: namen(bron.slice(j, k)) }
}

const alsBytes = b64 => {
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64')
  const s = atob(b64), u = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i)
  return u
}
export const isWebp = b64 => {
  try { const u = alsBytes(b64); return u.length > 12 && String.fromCharCode(u[0], u[1], u[2], u[3]) === 'RIFF' && String.fromCharCode(u[8], u[9], u[10], u[11]) === 'WEBP' } catch (e) { return false }
}
export const groottePlaatje = b64 => { try { return alsBytes(b64).length } catch (e) { return 0 } }
// Een mp3 begint met een ID3-label of met een blok (11 bits 1, zoals lame ze maakt: FF FB)
export const isMp3 = b64 => {
  try {
    const u = alsBytes(b64)
    if (u.length < 200) return false
    return (u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) || (u[0] === 0xFF && (u[1] & 0xE0) === 0xE0)
  } catch (e) { return false }
}

// Maak het pakketobject uit wat op de pagina staat. stickers: [{ naam: [nl, en], b, g, webp }]
export function maakPakket({ titel, uitleg, stickers }) {
  return {
    formaat: FORMAAT, versie: 1, id: storeId(titel), titel: String(titel || '').trim(),
    uitleg: [String(uitleg?.[0] || '').trim(), String(uitleg?.[1] || '').trim()],
    stickers: stickers.map(s => ({
      naam: [String(s.naam?.[0] || '').trim(), String(s.naam?.[1] || s.naam?.[0] || '').trim()], b: s.b, g: s.g, webp: s.webp,
      ...(s.mp3 ? { mp3: s.mp3, bron: String(s.bron || '').trim(), licentie: s.licentie } : {}),
    })),
  }
}

// Klopt het pakket? Geeft een lijst met problemen (leeg = goed), in gewoon Nederlands.
// fx: { bewegingen: Set, geluiden: Set } (uit stickerfx.js, of fxNamenUitBron)
export function valideerPakket(p, fx) {
  const fout = []
  if (!p || typeof p !== 'object') return ['Dit is geen pakketbestand.']
  if (p.formaat !== FORMAAT || p.versie !== 1) return ['Dit is geen pakketbestand van Stekky Studio (of een te nieuwe versie).']
  if (typeof p.titel !== 'string' || p.titel.trim().length < 2 || p.titel.length > 40) fout.push('De naam van het pakket moet 2 tot 40 tekens zijn.')
  if (typeof p.id !== 'string' || !ID_PATROON.test(p.id) || p.id.length > 40) fout.push('Het id van het pakket klopt niet (kleine letters, cijfers en streepjes, beginnend met "stickers-").')
  else if (p.id === 'stickers-') fout.push('De naam van het pakket heeft letters of cijfers nodig.')
  if (!Array.isArray(p.uitleg) || p.uitleg.length !== 2 || p.uitleg.some(t => typeof t !== 'string' || !t.trim() || t.length > 300)) fout.push('Het pakket heeft een uitleg nodig in het Nederlands en het Engels (elk tot 300 tekens).')
  if (!Array.isArray(p.stickers) || p.stickers.length !== AANTAL) { fout.push('Een pakket heeft precies ' + AANTAL + ' stickers.'); return fout }
  p.stickers.forEach((s, i) => {
    const nr = 'Sticker ' + (i + 1)
    if (!s || typeof s !== 'object') { fout.push(nr + ' ontbreekt.'); return }
    if (!Array.isArray(s.naam) || s.naam.length !== 2 || s.naam.some(t => typeof t !== 'string' || !t.trim() || t.length > 40)) fout.push(nr + ' heeft een naam nodig in het Nederlands en het Engels (tot 40 tekens).')
    if (!fx.bewegingen.has(s.b)) fout.push(nr + ': de beweging "' + s.b + '" bestaat niet.')
    if (!fx.geluiden.has(s.g)) fout.push(nr + ': het geluid "' + s.g + '" bestaat niet.')
    if (typeof s.webp !== 'string' || !isWebp(s.webp)) fout.push(nr + ' heeft geen geldig WebP-plaatje.')
    else if (groottePlaatje(s.webp) > MAX_PLAATJE) fout.push(nr + ' is te zwaar (meer dan ' + Math.round(MAX_PLAATJE / 1024) + ' kB).')
    if (s.mp3 !== undefined) {
      if (typeof s.mp3 !== 'string' || !isMp3(s.mp3)) fout.push(nr + ' heeft geen geldig mp3-geluid.')
      else if (groottePlaatje(s.mp3) > MAX_MP3) fout.push(nr + ': het eigen geluid is te zwaar (meer dan ' + Math.round(MAX_MP3 / 1024) + ' kB).')
      if (typeof s.bron !== 'string' || s.bron.trim().length < 2) fout.push(nr + ' heeft een eigen geluid, maar de bron ontbreekt. Vul in waar het geluid vandaan komt (bijvoorbeeld "Kenney.nl, CC0" of "zelf opgenomen").')
      else if (s.bron.length > MAX_BRON) fout.push(nr + ': de bron is te lang (hoogstens ' + MAX_BRON + ' tekens).')
      if (s.licentie === undefined || s.licentie === '') fout.push(nr + ' heeft een eigen geluid, maar de licentie ontbreekt. Kies er een uit de lijst.')
      else if (!Object.hasOwn(LICENTIES, s.licentie)) fout.push(nr + ': onbekende licentie "' + String(s.licentie).slice(0, 20) + '".')
    } else if (s.bron !== undefined || s.licentie !== undefined) fout.push(nr + ' heeft een bron of licentie, maar geen eigen geluid.')
  })
  return fout
}
