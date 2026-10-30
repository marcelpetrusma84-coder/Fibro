// spelicoon.js - de plaatjes van de spellen (30 okt 2026): een stukje uit het spel zelf, als rond tegeltje.
// De plaatjes staan in spelicoon/<spel>.webp (128 x 128), geknipt uit schermafbeeldingen van het spel met
// tests/tools/knip_spelicoon.py. Gebruikt in het spelmenu van de chat, de widgetlijst in Profiel, de spelwidget op
// Home en op het profiel van een vriend. Een nieuw plaatje voor een bestaand spel: verhoog VERSIE (ook in de html).
export const VERSIE = 1
export const SPELLEN = ['botkaaseiren', 'vieroprij', 'schaken', 'dammen', 'pong', 'pacman', 'pinball',
  'endlessrunner', 'breakout', 'swarm', 'shmup', 'flappybird']

export function spelIcoonSrc(spel) {
  return SPELLEN.includes(spel) ? 'spelicoon/' + spel + '.webp?v=' + VERSIE : null
}
// Een <img> van px bij px, of '' als het spel geen plaatje heeft (dan blijft de emoji staan)
export function spelIcoonHtml(spel, px) {
  const src = spelIcoonSrc(spel)
  if (!src) return ''
  const p = Math.round(Number(px) || 32)
  return '<img src="' + src + '" width="' + p + '" height="' + p + '" alt="" draggable="false" ' +
    'style="display:block;width:' + p + 'px;height:' + p + 'px;border-radius:22%;flex-shrink:0">'
}
