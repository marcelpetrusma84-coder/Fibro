// studio-prompt.js (23 nov 2026, Stekky Studio) - de prompt voor Gemini (of een andere beeldmaker): één stickervel in één stijl,
// zo gemaakt dat de Studio (studio-knippen.js) de stickers netjes kan losknippen. Geen scherm: studio-ui.js laat het zien en
// kopieert het. De uitleg waarom de regels zo zijn: de Studio schat de achtergrond uit de randen van de plaat, dus de achtergrond
// moet één effen kleur zijn; een schaduw of een sticker die een ander raakt, knipt hij niet schoon los.

export const STANDAARD = {
  thema: 'schattige zomerdieren',
  stijl: 'vrolijke cartoonstijl, dikke zwarte omlijning, heldere effen kleuren, simpele vormen',
  achtergrond: 'licht beige',
  kolommen: 5,
  rijen: 3,
}
export const MAX_KOLOMMEN = 8, MAX_RIJEN = 8
export const MIN_STICKERS = 12   // een pakket heeft er precies 12 nodig

const heelGetal = (v, min, max, standaard) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : standaard
}
const tekst = (v, standaard) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t || standaard }

// Maak de prompt. Lege velden krijgen de standaardwaarde, zodat er nooit "[...]" in de tekst blijft staan.
export function maakPrompt(opties = {}) {
  const kolommen = heelGetal(opties.kolommen, 1, MAX_KOLOMMEN, STANDAARD.kolommen)
  const rijen = heelGetal(opties.rijen, 1, MAX_RIJEN, STANDAARD.rijen)
  const aantal = kolommen * rijen
  const thema = tekst(opties.thema, STANDAARD.thema)
  const stijl = tekst(opties.stijl, STANDAARD.stijl)
  const achtergrond = tekst(opties.achtergrond, STANDAARD.achtergrond)
  const richting = kolommen > rijen ? '16:9 liggend' : kolommen < rijen ? '9:16 staand' : 'vierkant'
  return [
    'Maak één afbeelding met een stickervel: ' + aantal + ' losse stickers in een strak rooster van ' + kolommen + ' kolommen en ' + rijen + ' rijen.',
    '',
    'Thema: ' + thema,
    'Elke sticker is een ander voorwerp of dier binnen dit thema.',
    '',
    'Stijl (voor alle stickers precies hetzelfde):',
    '- ' + stijl,
    '- Dezelfde lijndikte, hetzelfde kleurenpalet en hetzelfde detailniveau bij alle stickers.',
    '- Rond elke sticker een dikke, gelijkmatige witte rand, zoals bij een echte sticker.',
    '',
    'Voor het uitknippen (heel belangrijk):',
    '- De achtergrond is één effen, egale kleur: ' + achtergrond + '. Geen verloop, geen structuur, geen vignet.',
    '- Geen enkele sticker gebruikt die achtergrondkleur.',
    '- Elke sticker staat helemaal los, met veel lege ruimte eromheen. Niets raakt of overlapt elkaar.',
    '- Geen schaduwen, geen gloed, geen spiegelingen onder of rond de stickers.',
    '- Geen tekst, geen cijfers, geen kaders en geen lijnen van het rooster.',
    '- Elke sticker staat in het midden van zijn vakje en alle stickers zijn ongeveer even groot.',
    '- Hoge resolutie, ' + richting + ', alles scherp.',
  ].join('\n')
}

// Een korte opmerking onder de velden (of '' als alles goed is): is het rooster te klein voor een pakket?
export function roosterOpmerking(opties = {}) {
  const kolommen = heelGetal(opties.kolommen, 1, MAX_KOLOMMEN, STANDAARD.kolommen)
  const rijen = heelGetal(opties.rijen, 1, MAX_RIJEN, STANDAARD.rijen)
  if (kolommen * rijen < MIN_STICKERS) return 'Een pakket heeft er ' + MIN_STICKERS + ' nodig, en dit rooster geeft er maar ' + (kolommen * rijen) + '. Kies meer kolommen of rijen.'
  return 'Zet bij stap 1 in de Studio "vaste indeling" aan met ' + kolommen + ' kolommen en ' + rijen + ' rijen.'
}
