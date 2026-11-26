// scorespellen.js (v1, 26 nov 2026, Marcel) - welk spel welk soort scorebord heeft (spelscores.js, sql/spel-scores.sql).
//
//   punten - spellen met punten: jouw 10 beste potjes en die van je vrienden (Block It, The Swarm, Flapper)
//   winst  - spellen zonder punten: hoe vaak je tegen de computer won, per niveau, en wie van je vrienden het vaakst won
//            (Tic-Tac-Toe, Four in a Row, Schaken, Dammen, Neo Paddle, de kaartspellen uit de Store en uit Stekky Studio)
//
// Koningsjacht en Neon Raiders hebben al een eigen scorebord (koningsjacht-scores.js, neon-raiders-scores.js).
// Ghost Tag, Twin Snakes en Runner & Gunner volgen later (die tellen hun punten nog op hun eigen manier).
import { STUDIO_SPELLEN } from './studio-spellen.js?v=6'

const PUNTEN = ['breakout', 'swarm', 'flappybird']
const WINST = ['botkaaseiren', 'vieroprij', 'schaken', 'dammen', 'pong', 'pesten', 'toepen', 'eenentwintigen']

export function scoreSoort(spelId) {
  const id = String(spelId || '')
  if (PUNTEN.includes(id)) return 'punten'
  if (WINST.includes(id)) return 'winst'
  // Stekky Studio: een kaartspel tegen de computer telt overwinningen. Studio kan het scorebord per spel uitzetten
  // (scorebord: false in studio-spellen.js).
  const studio = STUDIO_SPELLEN.find(s => s.id === id)
  if (studio && studio.soort === 'kaart' && studio.scorebord !== false) return 'winst'
  return null
}
