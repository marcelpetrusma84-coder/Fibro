// stickervellen.js - de stickervellen van Fibro (v153, 15 oktober 2026; v156: vel 1; v161: eigen geluiden voor vel 1;
// v164: vel 2, voor beurtspellen, met eigen geluiden; v165: vel 3, handgebaren;
// v166: vel 4, moderne handgebaren; v206-v208: vel 5, chattaal (lol, brb, GOAT ...), met geluiden die er al waren;
// v215: acht stickers van vel 5 met een van de meme-geluiden van v214)
// Zes vaste vakjes (f1 t/m f6), elk voor een vel van 12 stickers. Een vel dat nog leeg is, toont
// "binnenkort". Een sticker staat in stickers/<vel>/<nr>.webp en heeft een naam ([Nederlands, Engels]),
// een beweging (b) en een geluid (g) uit stickerfx.js.
// Voorbeeld van een gevuld vel:
//   { id: 'f1', stickers: [ { nr: '01', naam: ['Grote ogen', 'Big eyes'], b: 'groei', g: 'boing' }, ... ] }
// In een bericht gaat alleen '<vel>-<nr>' mee (bijv. fxsticker:f1-01); het plaatje staat op elk toestel.

export const FIBRO_VELLEN = [
  { id: 'f1', stickers: [
    { nr: '01', naam: ['Tranen van het lachen', 'Tears of joy'], b: 'hup', g: 'lach' },
    { nr: '02', naam: ['Ssst', 'Shh'], b: 'kantel', g: 'ssst' },
    { nr: '03', naam: ['Slaap lekker', 'Sleep tight'], b: 'zweef', g: 'snurk' },
    { nr: '04', naam: ['Kapot', 'Exhausted'], b: 'knik', g: 'moe' },
    { nr: '05', naam: ['Huilen', 'Crying'], b: 'wiebel', g: 'huil' },
    { nr: '06', naam: ['Verliefd', 'In love'], b: 'hartslag', g: 'hartklop' },
    { nr: '07', naam: ['Boos', 'Angry'], b: 'schud', g: 'grom' },
    { nr: '08', naam: ['Geschrokken', 'Shocked'], b: 'duw', g: 'schrik' },
    { nr: '09', naam: ['Offline', 'Offline'], b: 'glitch', g: 'uitval' },
    { nr: '10', naam: ['Druk', 'Busy'], b: 'hup', g: 'druk' },
    { nr: '11', naam: ['Spookje', 'Spooked'], b: 'zweef', g: 'spook' },
    { nr: '12', naam: ['Sluw', 'Sly'], b: 'kantel', g: 'sluw' },
  ] },
  // v164: vel 2, om te sturen tijdens een beurtspel (en gewoon in de chat). Geluiden: tests/tools/geluiden3.py
  { id: 'f2', stickers: [
    { nr: '01', naam: ['Ik denk na', 'Let me think'], b: 'kantel', g: 'peins' },
    { nr: '02', naam: ['Even laden\u2026', 'Loading\u2026'], b: 'glitch', g: 'laden' },
    { nr: '03', naam: ['Wachten\u2026', 'Waiting\u2026'], b: 'draai', g: 'tiktak' },
    { nr: '04', naam: ['Zzz', 'Zzz'], b: 'zweef', g: 'zzz' },
    { nr: '05', naam: ['Huh?', 'Huh?'], b: 'wiebel', g: 'hmm' },
    { nr: '06', naam: ['Idee!', 'Idea!'], b: 'oplichten', g: 'idee' },
    { nr: '07', naam: ['Pas op!', 'Watch out!'], b: 'schud', g: 'sirene' },
    { nr: '08', naam: ['Ugh', 'Ugh'], b: 'knik', g: 'facepalm' },
    { nr: '09', naam: ['Krekels\u2026', 'Crickets\u2026'], b: 'stuiter', g: 'krekels' },
    { nr: '10', naam: ['Mind blown', 'Mind blown'], b: 'ontplof', g: 'ontploft' },
    { nr: '11', naam: ['Winnaar!', 'Winner!'], b: 'groei', g: 'winnaar' },
    { nr: '12', naam: ['Loser', 'Loser'], b: 'hup', g: 'loser' },
  ] },
  // v165: vel 3, handgebaren met witte cartoonhandschoenen. Geluiden: tests/tools/geluiden4.py
  { id: 'f3', stickers: [
    { nr: '01', naam: ['Duim omhoog', 'Thumbs up'], b: 'hup', g: 'duimop' },
    { nr: '02', naam: ['Boe!', 'Boo!'], b: 'knik', g: 'boe' },
    { nr: '03', naam: ['Die kant op!', 'This way!'], b: 'duw', g: 'pijl' },
    { nr: '04', naam: ['Stop!', 'Stop!'], b: 'groei', g: 'halt' },
    { nr: '05', naam: ['Peace', 'Peace'], b: 'wiebel', g: 'vrede' },
    { nr: '06', naam: ['Ok\u00e9!', 'Okay!'], b: 'stuiter', g: 'oke' },
    { nr: '07', naam: ['Rock on!', 'Rock on!'], b: 'schud', g: 'rock' },
    { nr: '08', naam: ['Power!', 'Power!'], b: 'oplichten', g: 'kracht' },
    { nr: '09', naam: ['Hallo!', 'Hello!'], b: 'kantel', g: 'hallo' },
    { nr: '10', naam: ['Klap klap!', 'Clap clap!'], b: 'hartslag', g: 'applaus' },
    { nr: '11', naam: ['Yes!', 'Yes!'], b: 'hup', g: 'yes' },
    { nr: '12', naam: ['Leef lang!', 'Live long!'], b: 'zweef', g: 'warp' },
  ] },
  // v166: vel 4, moderne handgebaren (witte cartoonhandschoenen). Geluiden: tests/tools/geluiden5.py
  { id: 'f4', stickers: [
    { nr: '01', naam: ['Liefde!', 'Love!'], b: 'hartslag', g: 'liefde' },
    { nr: '02', naam: ['Heerlijk!', "Chef's kiss"], b: 'kantel', g: 'kus' },
    { nr: '03', naam: ['High five!', 'High five!'], b: 'schud', g: 'vijf' },
    { nr: '04', naam: ['Succes!', 'Good luck!'], b: 'wiebel', g: 'geluk' },
    { nr: '05', naam: ['Alsjeblieft', 'Please'], b: 'knik', g: 'engel' },
    { nr: '06', naam: ['Twijfel\u2026', 'Not sure\u2026'], b: 'zweef', g: 'twijfel' },
    { nr: '07', naam: ['Boks!', 'Bump!'], b: 'duw', g: 'boks' },
    { nr: '08', naam: ['Wat?', 'What?'], b: 'stuiter', g: 'wat' },
    { nr: '09', naam: ['Raak!', 'Gotcha!'], b: 'hup', g: 'pieuw' },
    { nr: '10', naam: ['Momentje', 'One moment'], b: 'groei', g: 'ahum' },
    { nr: '11', naam: ['Jij!', 'You!'], b: 'oplichten', g: 'jij' },
    { nr: '12', naam: ['Deal!', 'Deal!'], b: 'schud', g: 'deal' },
  ] },
  // v206-v208: vel 5, chattaal, uit twee plaatjes van Marcel (tests/tools/knip5.py). v215: acht kregen een meme-geluid
  // (was: schrik, liefde, yes, zoemer, pijl, loser, facepalm, winnaar).
  { id: 'f5', stickers: [
    { nr: '01', naam: ['LOL', 'LOL'], b: 'hup', g: 'lach' },
    { nr: '02', naam: ['Rollen van het lachen', 'ROFL'], b: 'draai', g: 'boing' },
    { nr: '03', naam: ['OMG!', 'OMG!'], b: 'duw', g: 'ooh' },
    { nr: '04', naam: ['Bedankt!', 'Thanks!'], b: 'hartslag', g: 'dankbaar' },
    { nr: '05', naam: ['Gelukt!', 'Done!'], b: 'stuiter', g: 'tadaa' },
    { nr: '06', naam: ['Nee!', 'No!'], b: 'schud', g: 'fout' },
    { nr: '07', naam: ['Ben zo terug', 'Be right back'], b: 'flakker', g: 'zoefweg' },
    { nr: '08', naam: ['Vibing', 'Vibing'], b: 'wiebel', g: 'rock' },
    { nr: '09', naam: ['Noob', 'Noob'], b: 'glitch', g: 'gameover' },
    { nr: '10', naam: ['Cringe', 'Cringe'], b: 'knik', g: 'kras' },
    { nr: '11', naam: ['GOAT', 'GOAT'], b: 'oplichten', g: 'hoorn' },
    { nr: '12', naam: ['Meh', 'Meh'], b: 'kantel', g: 'moe' },
  ] },
  { id: 'f6', stickers: [] },
]

export const PER_VEL = 12

// Zoek een sticker op met de code uit een bericht ('f1-01'). Geeft null als hij niet (meer) bestaat.
export function zoekSticker(code) {
  const m = /^(f[1-6])-(\d{2})$/.exec(String(code || ''))
  if (!m) return null
  const vel = FIBRO_VELLEN.find(v => v.id === m[1])
  const s = vel && vel.stickers.find(x => x.nr === m[2])
  return s ? { vel: vel.id, nr: s.nr, naam: s.naam, b: s.b, g: s.g, src: stickerSrc(vel.id, s.nr) } : null
}

export function stickerSrc(vel, nr) {
  return 'stickers/' + vel + '/' + nr + '.webp'
}
