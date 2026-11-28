// hogerlager.js (v2, 28 nov 2026, Marcel) - de regels van Hoger of lager (spellen/hogerlager.md). Het scherm staat in
// hogerlager-ui.js. Gemaakt uit het sjabloon sjabloon-automaat.js.
//
// In gewone woorden: je ziet een kaart en raadt of de volgende hoger of lager is. Goed = gewonnen, dezelfde waarde =
// gelijk (je inzet terug), fout = verloren. Aas is het hoogst. Met tokens: winst = 2× je inzet terug (casino.js; dat mag
// op het toestel, want het is niet meer dan 2×).
//   nieuweRonde(rng)              { kaart, volgende, klaar: false } (de volgende kaart ligt al klaar, maar is nog dicht)
//   raad(ronde, 'hoger'|'lager')  { ...ronde, klaar: true, uitslag: 'winst' | 'gelijk' | 'verlies' }
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
