// sjabloon-automaat.js - SJABLOON: de regels van een automaat die je alleen speelt (v1, 27 nov 2026). Hoort bij
// sjabloon-automaat-ui.js. Stekky Studio kopieert allebei naar <id>.js en <id>-ui.js voor een kaartspel zonder vriend
// (zoals Video Poker); daarna komen hier de echte regels.
//
// Het voorbeeld "Hoger of lager": je ziet een kaart en raadt of de volgende hoger of lager is. Goed = gewonnen,
// dezelfde waarde = gelijk (je inzet terug), fout = verloren. Aas is het hoogst.
//   nieuweRonde(rng)          { kaart, volgende, klaar: false } (de volgende kaart ligt al klaar, maar is nog dicht)
//   raad(ronde, 'hoger'|'lager')  { ...ronde, klaar: true, uitslag: 'winst' | 'gelijk' | 'verlies' }
// Gaat het om veel tokens (meer dan 2× terug), laat dan de SERVER delen en uitbetalen, zoals Video Poker
// (sql/videopoker.sql). Bij 2× terug mag het op het toestel, met casino.js (zie sjabloon-automaat-ui.js).
import { maakDeck, schud, rang } from './kaarten-motor.js?v=1'

export function nieuweRonde(rng = Math.random) {
  const d = schud(maakDeck('52'), rng)
  return { kaart: d[0], volgende: d[1], klaar: false }
}
export function raad(ronde, keuze) {
  if (!ronde || ronde.klaar || !['hoger', 'lager'].includes(keuze)) return null
  const a = rang(ronde.kaart), b = rang(ronde.volgende)
  const uitslag = a === b ? 'gelijk' : (b > a) === (keuze === 'hoger') ? 'winst' : 'verlies'
  return { ...ronde, klaar: true, keuze, uitslag }
}

// Een automaat speel je alleen: geen spelkanaal en geen computerspeler (studio-spellen.js: zonderKanaal).
export function bot() { return { ontvang() {}, stop() {} } }
