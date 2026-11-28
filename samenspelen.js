// samenspelen.js (v1, 26 nov 2026, Marcel) - samen spelen vanaf het startscherm van een spel (spel.html, ook vanaf Home).
//
// In gewone woorden: start je op Home een spel, dan kies je niet alleen een niveau tegen de computer, maar ook
//   👤 Tegen een vriend  - de vriend krijgt een uitnodiging (zoals in de chat) en jij gaat naar de chat met hem;
//   👥 Met een groep     - alleen bij spellen voor meer spelers (Stekky Studio, max > 2): je gaat naar de groepschat
//                          en daar staat meteen de wachtkamer open (groep.html?id=...&spel=...).
//
//   kanMetVriend(id)  welke spellen met een vriend kunnen (dezelfde lijst als in chat.html bij speelMee)
//   kanMetGroep(id)   welke spellen met de groep kunnen (dezelfde regel als groepSpellen in groepkaartspel.js)
import { STUDIO_SPELLEN } from './studio-spellen.js?v=13'

// Met een vriend in de chat (chat.html, speelMee). Driespelerschaak niet: dat is met z'n drieën.
export const VRIEND_SPELLEN = ['botkaaseiren', 'vieroprij', 'pesten', 'toepen', 'eenentwintigen', 'koningsjacht', 'schaken',
  'dammen', 'pong', 'flappybird', 'swarm', 'breakout', 'endlessrunner', 'pacman', 'pinball', 'shmup',
  ...STUDIO_SPELLEN.filter(s => s.met && s.met.vriend).map(s => s.id)]

export const kanMetVriend = id => VRIEND_SPELLEN.includes(id)
export const kanMetGroep = id => STUDIO_SPELLEN.some(s => s.id === id && s.soort === 'kaart' && (s.max || 2) > 2 && s.met && s.met.vriend)

const GELDIG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const groepAdres = (groepId, spel) => GELDIG_ID.test(String(groepId)) && kanMetGroep(spel)
  ? 'groep.html?' + new URLSearchParams({ id: groepId, spel }).toString() : null
