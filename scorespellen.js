// scorespellen.js (v1, 26 nov 2026, Marcel) - welk spel welk soort scorebord heeft (spelscores.js, sql/spel-scores.sql).
//
//   punten - spellen met punten: jouw 10 beste potjes en die van je vrienden (Block It, The Swarm, Flapper)
//   winst  - spellen zonder punten: hoe vaak je tegen de computer won, per niveau, en wie van je vrienden het vaakst won
//            (Tic-Tac-Toe, Four in a Row, Schaken, Dammen, Neo Paddle, de kaartspellen uit de Store en uit Stekky Studio)
//
// Koningsjacht en Neon Raiders hebben al een eigen scorebord (koningsjacht-scores.js, neon-raiders-scores.js).
// Ghost Tag, Twin Snakes en Runner & Gunner volgen later (die tellen hun punten nog op hun eigen manier).
import { STUDIO_SPELLEN } from './studio-spellen.js?v=6'
import { SCOREBORDEN, STIJLEN } from './scoreborden.js?v=1' // 26 nov 2026: per spel aan/uit en stijl uit Stekky Studio

const PUNTEN = ['breakout', 'swarm', 'flappybird']
const WINST = ['botkaaseiren', 'vieroprij', 'schaken', 'dammen', 'pong', 'pesten', 'toepen', 'eenentwintigen']
// Naam en icoon (dezelfde als in solo.js), voor de widget op Home en voor Stekky Studio
const INFO = {
  breakout: ['Block It', '🟪'], swarm: ['The Swarm', '🪲'], flappybird: ['Flapper', '🦇'],
  botkaaseiren: ['Tic-Tac-Toe', '⭕'], vieroprij: ['Four in a Row', '🔴'], schaken: ['Schaken', '♟️'], dammen: ['Draughts', '⚫'],
  pong: ['Neo Paddle', '🏓'], pesten: ['Pesten', '🃏'], toepen: ['Toepen', '✊'], eenentwintigen: ['Black Jack', '♠️'],
}

// Alle spellen die een scorebord kunnen hebben (ook als het in Studio uit staat), met naam, icoon en soort
export function alleScoreSpellen() {
  const studio = STUDIO_SPELLEN.filter(s => s.soort === 'kaart').map(s => ({ id: s.id, naam: s.naam[0], icoon: s.icoon, soort: 'winst', studio: true }))
  return [...PUNTEN.map(id => ({ id, naam: INFO[id][0], icoon: INFO[id][1], soort: 'punten' })),
    ...WINST.map(id => ({ id, naam: INFO[id][0], icoon: INFO[id][1], soort: 'winst' })), ...studio]
}
export const scoreSpelInfo = id => alleScoreSpellen().find(s => s.id === id) || null

// Wat Studio voor dit spel koos: { aan, stijl, titel } (zonder keuze: aan, neon, geen eigen titel)
export function scorebordInstelling(spelId) {
  const k = SCOREBORDEN[String(spelId || '')] || {}
  return { aan: k.aan !== false, stijl: STIJLEN.includes(k.stijl) ? k.stijl : 'neon', titel: typeof k.titel === 'string' ? k.titel.slice(0, 40) : '' }
}

export function scoreSoort(spelId) {
  const id = String(spelId || '')
  if (!scorebordInstelling(id).aan) return null   // in Stekky Studio uitgezet
  if (PUNTEN.includes(id)) return 'punten'
  if (WINST.includes(id)) return 'winst'
  // Stekky Studio: een kaartspel tegen de computer telt overwinningen. Studio kan het scorebord per spel uitzetten
  // (scorebord: false in studio-spellen.js).
  const studio = STUDIO_SPELLEN.find(s => s.id === id)
  if (studio && studio.soort === 'kaart' && studio.scorebord !== false) return 'winst'
  return null
}

// Stekky Studio (studio-scorebord-ui.js) en het installeerscript (tests/tools/studio-scorebord-installeer.mjs):
// klopt een scorebordenbestand? Geeft een lijst met fouten (leeg = goed).
//   { versie: 1, scoreborden: { <spel-id>: { aan, stijl, titel } } }
export function valideerScoreborden(bestand) {
  const fouten = []
  if (!bestand || typeof bestand !== 'object' || bestand.versie !== 1 || !bestand.scoreborden || typeof bestand.scoreborden !== 'object')
    return ['Dit is geen scorebordenbestand uit Stekky Studio.']
  const bekend = new Set(alleScoreSpellen().map(s => s.id))
  for (const [id, k] of Object.entries(bestand.scoreborden)) {
    if (!bekend.has(id)) { fouten.push('Onbekend spel: ' + id); continue }
    if (!k || typeof k !== 'object') { fouten.push(id + ': geen instelling'); continue }
    if (typeof k.aan !== 'boolean') fouten.push(id + ': aan moet ja of nee zijn')
    if (!STIJLEN.includes(k.stijl)) fouten.push(id + ': onbekende stijl ' + k.stijl)
    if (typeof k.titel !== 'string' || k.titel.length > 40 || /[<>]/.test(k.titel)) fouten.push(id + ': de titel mag hoogstens 40 tekens zijn, zonder < of >')
  }
  return fouten
}
