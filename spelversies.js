// spelversies.js — het versienummer van elk spel, los van het versienummer van de app (v196)
//
// "Fibro v196" (menu op Home) telt elke wijziging aan de app. Elk spel heeft hier zijn eigen nummer,
// dat alleen omhoog gaat als dat spel zelf verandert (nieuwe levels, ander gedrag, een fout eruit).
// Regel voor een nieuw maak-script: raakt het een spel aan? Zet dan het nummer van dat spel hier een hoger.
//
// De sleutel is de spelnaam zoals in chat.html (startSpel('shmup')) en in de widgetlijst op Profiel (spel_shmup).
// Stand bij het begin van het tellen (v196): Neon Raiders v3 (v192 eerste, v193 alle 7 levels, v194 samen spelen),
// Schaken v2 (het vernieuwde schaken van Tijn, v195 weer in twee talen); de rest begint op v1.
export const SPEL_VERSIES = {
  botkaaseiren: 2,   // Tic-Tac-Toe (v2 = 30 okt 2026: houten bord en houten stukken)
  vieroprij: 2,      // Four in a Row (v2 = 30 okt 2026: plastic speelgoed, vallende schijven)
  schaken: 4,        // Chess (v3 = v197: webcam, vriend uitnodigen, nieuwe instellingen, PR #3 van Tijn;
                     //  v4 = v198: webcam-status volgt de echte camera, knop voor tegengehouden geluid)
  dammen: 1,         // Draughts
  pong: 3,           // Neo Paddle (v2 = 30 okt 2026: blokjes en power-ups, levels voor alleen;
                     //  v3 = 31 okt 2026: kies Klassiek (de oude 7 levels met obstakels) of Blokjes)
  pacman: 1,         // Ghost Tag
  pinball: 1,        // Twin Snakes
  flappybird: 1,     // Flapper
  breakout: 1,       // Block It
  swarm: 1,          // The Swarm
  endlessrunner: 1,  // Runner & Gunner
  shmup: 5,          // Neon Raiders (v5: VERDER pas na 3 seconden OPNIEUW vasthouden)
}

export function spelVersie(naam) {
  return Object.prototype.hasOwnProperty.call(SPEL_VERSIES, naam) ? SPEL_VERSIES[naam] : null
}

// Zet "v3.0" in elk element met data-spelversie="<spelnaam>" (zo staat het in het widgetmenu op Profiel,
// tussen de tekst en de toggle-knop). Een spel zonder nummer krijgt niets.
export function vulSpelVersies(wortel) {
  const w = typeof T === 'function' && T.taal === 'en' ? 'version' : 'versie'
  for (const el of (wortel || document).querySelectorAll('[data-spelversie]')) {
    const n = spelVersie(el.getAttribute('data-spelversie'))
    if (n === null) { el.textContent = ''; continue }
    const label = Number.isInteger(n) ? n.toFixed(1) : String(n)
    el.textContent = 'v' + label
    el.setAttribute('aria-label', w + ' ' + label)
  }
}
