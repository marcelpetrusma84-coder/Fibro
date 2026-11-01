// spelicoon.js - de plaatjes van de spellen. v2 (31 okt 2026): alleen het losse speelstuk, op een doorzichtige
// achtergrond (de X, de gele schijf, het paard, de paddle, de vleermuis, ...). De plaatjes staan in
// spelicoon/<spel>.webp (128 x 128) en komen uit de spellen zelf: zie tests/tools/spelicoon/LEESMIJ.txt.
// Gebruikt in het spelmenu van de chat, de widgetlijst in Profiel, de spelwidget op Home en op het profiel van een vriend. Een nieuw plaatje voor een bestaand spel: verhoog VERSIE (ook in de html).
export const VERSIE = 2
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
    'style="display:block;width:' + p + 'px;height:' + p + 'px;flex-shrink:0">'
}
